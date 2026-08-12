function Test-TunnelReadyLog {
    param([AllowEmptyString()][string]$LogText)

    return $LogText -match 'Registered tunnel connection'
}

function Invoke-WithRetry {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [scriptblock]$Operation,

        [ValidateRange(1, 100)]
        [int]$MaximumAttempts = 20,

        [ValidateRange(0, 60000)]
        [int]$DelayMilliseconds = 1500,

        [string]$OperationName = 'Operation'
    )

    $lastError = $null

    for ($attempt = 1; $attempt -le $MaximumAttempts; $attempt++) {
        try {
            return (& $Operation)
        } catch {
            $lastError = $_

            if ($attempt -ge $MaximumAttempts) {
                break
            }

            Write-Host "$OperationName is not ready yet. Retrying ($attempt/$MaximumAttempts)..." -ForegroundColor DarkGray
            if ($DelayMilliseconds -gt 0) {
                Start-Sleep -Milliseconds $DelayMilliseconds
            }
        }
    }

    $lastMessage = if ($lastError) { $lastError.Exception.Message } else { 'Unknown error.' }
    throw "$OperationName failed after $MaximumAttempts attempts. Last error: $lastMessage"
}
