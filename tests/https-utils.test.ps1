$ErrorActionPreference = 'Stop'

function Assert-Equal {
    param($Actual, $Expected, [string]$Message)

    if ($Actual -ne $Expected) {
        throw "$Message Expected '$Expected' but received '$Actual'."
    }
}

$projectDir = Split-Path -Parent $PSScriptRoot
$utilsPath = Join-Path $projectDir 'scripts\https-utils.ps1'

if (-not (Test-Path -LiteralPath $utilsPath)) {
    throw 'scripts\https-utils.ps1 is missing.'
}

. $utilsPath

Assert-Equal (Test-TunnelReadyLog 'Your quick Tunnel has been created!') $false 'A created hostname is not proof that the tunnel is connected.'
Assert-Equal (Test-TunnelReadyLog 'Registered tunnel connection connIndex=0') $true 'A registered tunnel connection should be ready for public checks.'

$script:successfulAttemptCount = 0
$result = Invoke-WithRetry `
    -Operation {
        $script:successfulAttemptCount++
        if ($script:successfulAttemptCount -lt 3) {
            throw 'DNS is not ready.'
        }
        return 'ready'
    } `
    -MaximumAttempts 4 `
    -DelayMilliseconds 0 `
    -OperationName 'Test HTTPS address'

Assert-Equal $result 'ready' 'The retry helper did not return the successful result.'
Assert-Equal $script:successfulAttemptCount 3 'The retry helper did not retry temporary failures.'

$script:failedAttemptCount = 0
$failureMessage = $null
try {
    Invoke-WithRetry `
        -Operation {
            $script:failedAttemptCount++
            throw 'Still unavailable.'
        } `
        -MaximumAttempts 3 `
        -DelayMilliseconds 0 `
        -OperationName 'Test permanent failure'
} catch {
    $failureMessage = $_.Exception.Message
}

Assert-Equal $script:failedAttemptCount 3 'The retry helper did not stop at the maximum attempts.'
if ($failureMessage -notmatch 'Test permanent failure' -or $failureMessage -notmatch 'Still unavailable') {
    throw "The final error message is not useful: $failureMessage"
}

Write-Host 'HTTPS retry tests passed.' -ForegroundColor Green
