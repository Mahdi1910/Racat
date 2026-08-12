$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$indexFile = Join-Path $projectDir 'index.html'
$toolsDir = Join-Path $projectDir '.tools'
$cloudflared = Join-Path $toolsDir 'cloudflared.exe'
$outLog = Join-Path $toolsDir 'cloudflared-out.log'
$errLog = Join-Path $toolsDir 'cloudflared-error.log'
$serverProcess = $null
$tunnelProcess = $null

. (Join-Path $projectDir 'scripts\https-utils.ps1')

New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null

try {
    if (-not (Test-Path $indexFile)) {
        throw "index.html was not found in: $projectDir"
    }

    if (-not (Test-Path $cloudflared)) {
        Write-Host 'First run: downloading Cloudflare Tunnel...' -ForegroundColor Cyan
        $downloadUrl = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe'
        Invoke-WebRequest -Uri $downloadUrl -OutFile $cloudflared -UseBasicParsing
    }

    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
    $listener.Start()
    $port = ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port
    $listener.Stop()
    $py = Get-Command py.exe -ErrorAction SilentlyContinue
    $python = Get-Command python.exe -ErrorAction SilentlyContinue
    if ($py) {
        $serverFile = $py.Source
        $serverArgs = @('-3', '-m', 'http.server', "$port", '--bind', '127.0.0.1', '--directory', $projectDir)
    } elseif ($python) {
        $serverFile = $python.Source
        $serverArgs = @('-m', 'http.server', "$port", '--bind', '127.0.0.1', '--directory', $projectDir)
    } else {
        throw 'Python was not found on this computer.'
    }

    Write-Host "Starting Racat index.html on local port $port..." -ForegroundColor Cyan
    $serverProcess = Start-Process -FilePath $serverFile -ArgumentList $serverArgs -WindowStyle Hidden -PassThru
    Start-Sleep -Milliseconds 800

    if ($serverProcess.HasExited) {
        throw 'The Racat web server stopped immediately and could not start.'
    }

    $localUrl = "http://127.0.0.1:$port/"
    $response = Invoke-WebRequest -Uri $localUrl -UseBasicParsing
    $localAppResponse = Invoke-WebRequest -Uri ($localUrl + 'js/app.js') -UseBasicParsing
    $localModelManagerResponse = Invoke-WebRequest -Uri ($localUrl + 'js/model-manager.js') -UseBasicParsing
    $localSettingsManagerResponse = Invoke-WebRequest -Uri ($localUrl + 'js/settings-manager.js') -UseBasicParsing
    if ($response.Content -notmatch 'id="startBtn"' -or
        $response.Content -notmatch 'href="css/styles.css"' -or
        $response.Content -notmatch 'src="js/model-manager.js"' -or
        $response.Content -notmatch 'src="js/setup-guide.js"' -or
        $response.Content -notmatch 'src="js/settings-manager.js"' -or
        $response.Content -notmatch 'src="js/app.js"' -or
        $localAppResponse.Content -notmatch 'initializeApplication' -or
        $localModelManagerResponse.Content -notmatch 'poseDetection.SupportedModels.MoveNet' -or
        $localSettingsManagerResponse.Content -notmatch 'racat-settings-v1') {
        throw 'Safety check failed: the local server is not serving Racat\index.html.'
    }
    Remove-Item $outLog, $errLog -Force -ErrorAction SilentlyContinue
    Write-Host 'Creating temporary HTTPS address...' -ForegroundColor Cyan
    $tunnelProcess = Start-Process -FilePath $cloudflared `
        -ArgumentList @('tunnel', '--url', $localUrl, '--no-autoupdate') `
        -RedirectStandardOutput $outLog -RedirectStandardError $errLog `
        -WindowStyle Hidden -PassThru

    $publicUrl = $null
    for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep -Milliseconds 500
        $logText = ''
        if (Test-Path $outLog) { $logText += Get-Content $outLog -Raw -ErrorAction SilentlyContinue }
        if (Test-Path $errLog) { $logText += Get-Content $errLog -Raw -ErrorAction SilentlyContinue }
        $match = [regex]::Match($logText, 'https://[a-zA-Z0-9-]+\.trycloudflare\.com')
        if ($match.Success) {
            $publicUrl = $match.Value
            break
        }
        if ($tunnelProcess.HasExited) { break }
    }

    if (-not $publicUrl) {
        $details = if (Test-Path $errLog) { Get-Content $errLog -Raw -ErrorAction SilentlyContinue } else { '' }
        throw "Could not create the HTTPS tunnel.`n$details"
    }

    Invoke-WithRetry `
        -Operation {
            if ($tunnelProcess.HasExited) {
                throw 'Cloudflare Tunnel stopped before it connected.'
            }

            $connectionLog = ''
            if (Test-Path $outLog) { $connectionLog += Get-Content $outLog -Raw -ErrorAction SilentlyContinue }
            if (Test-Path $errLog) { $connectionLog += Get-Content $errLog -Raw -ErrorAction SilentlyContinue }
            if (-not (Test-TunnelReadyLog $connectionLog)) {
                throw 'The hostname exists, but the tunnel connection is not registered yet.'
            }

            return $true
        } `
        -MaximumAttempts 60 `
        -DelayMilliseconds 1000 `
        -OperationName 'Waiting for Cloudflare Tunnel to connect' | Out-Null

    $publicAssets = Invoke-WithRetry `
        -Operation {
            if ($tunnelProcess.HasExited) {
                throw 'Cloudflare Tunnel stopped before the public address became ready.'
            }

            $rootResponse = Invoke-WebRequest -Uri $publicUrl -UseBasicParsing
            $appResponse = Invoke-WebRequest -Uri ($publicUrl + '/js/app.js') -UseBasicParsing
            $modelManagerResponse = Invoke-WebRequest -Uri ($publicUrl + '/js/model-manager.js') -UseBasicParsing
            $settingsManagerResponse = Invoke-WebRequest -Uri ($publicUrl + '/js/settings-manager.js') -UseBasicParsing

            if ($rootResponse.Content -notmatch 'id="startBtn"' -or
                $rootResponse.Content -notmatch 'href="css/styles.css"' -or
                $rootResponse.Content -notmatch 'src="js/model-manager.js"' -or
                $rootResponse.Content -notmatch 'src="js/setup-guide.js"' -or
                $rootResponse.Content -notmatch 'src="js/settings-manager.js"' -or
                $rootResponse.Content -notmatch 'src="js/app.js"' -or
                $appResponse.Content -notmatch 'initializeApplication' -or
                $modelManagerResponse.Content -notmatch 'poseDetection.SupportedModels.MoveNet' -or
                $settingsManagerResponse.Content -notmatch 'racat-settings-v1') {
                throw 'The public address is reachable but is not serving the Racat application yet.'
            }

            return [PSCustomObject]@{
                Root = $rootResponse
                App = $appResponse
                ModelManager = $modelManagerResponse
                SettingsManager = $settingsManagerResponse
            }
        } `
        -MaximumAttempts 20 `
        -DelayMilliseconds 1500 `
        -OperationName 'Waiting for the public HTTPS address'

    $publicResponse = $publicAssets.Root
    $publicAppResponse = $publicAssets.App
    $publicModelManagerResponse = $publicAssets.ModelManager
    $publicSettingsManagerResponse = $publicAssets.SettingsManager

    Clear-Host
    Write-Host '============================================' -ForegroundColor Green
    Write-Host ' Rak''ah Counter is ready on HTTPS' -ForegroundColor Green
    Write-Host '============================================' -ForegroundColor Green
    Write-Host ''
    Write-Host "Serving: $indexFile" -ForegroundColor Gray
    Write-Host "Local port: $port" -ForegroundColor Gray
    Write-Host ''
    Write-Host 'Open this address on your phone:' -ForegroundColor White
    Write-Host $publicUrl -ForegroundColor Yellow
    Write-Host ''
    Write-Host 'The address was copied to your clipboard.' -ForegroundColor Gray
    Write-Host 'Keep this window open while using the app.' -ForegroundColor Gray
    Write-Host 'The link stops working when you close this window.' -ForegroundColor Gray
    Set-Clipboard -Value $publicUrl
    Start-Process $publicUrl
    Read-Host 'Press ENTER to stop the server'
}
catch {
    Write-Host ''
    Write-Host ('ERROR: ' + $_.Exception.Message) -ForegroundColor Red
    Read-Host 'Press ENTER to close'
    exit 1
}
finally {
    if ($tunnelProcess -and -not $tunnelProcess.HasExited) { Stop-Process -Id $tunnelProcess.Id -Force -ErrorAction SilentlyContinue }
    if ($serverProcess -and -not $serverProcess.HasExited) { Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue }
}
