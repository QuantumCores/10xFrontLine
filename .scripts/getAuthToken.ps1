param(
    [string]$ApiBaseUrl = "http://localhost:5178",
    [string]$Email = "manual-test@example.com",
    [string]$ClientMatchId = ""
)

$ErrorActionPreference = "Stop"

$requestCodeBody = @{ email = $Email } | ConvertTo-Json
$requestCodeResponse = Invoke-RestMethod `
    -Uri "$ApiBaseUrl/api/auth/request-code" `
    -Method Post `
    -ContentType "application/json" `
    -Body $requestCodeBody

Write-Host $requestCodeResponse.message
Write-Host "Retrieve the delivered local/dev sign-in code, then paste it below."

$code = Read-Host -Prompt "Code"

$verifyCodeBody = @{ email = $Email; code = $code } | ConvertTo-Json
$verifyCodeResponse = Invoke-RestMethod `
    -Uri "$ApiBaseUrl/api/auth/verify-code" `
    -Method Post `
    -ContentType "application/json" `
    -Body $verifyCodeBody

$token = $verifyCodeResponse.token

Write-Host ""
Write-Host "JWT:"
Write-Host $token

if (Get-Command Set-Clipboard -ErrorAction SilentlyContinue) {
    Set-Clipboard $token
    Write-Host ""
    Write-Host "JWT copied to clipboard. Paste it into @token in src\api\frontLineApi.http."
}

if ([string]::IsNullOrWhiteSpace($ClientMatchId)) {
    $ClientMatchId = "manual-smoke-$([Guid]::NewGuid().ToString("N").Substring(0, 8))"
}

$completedAt = [DateTimeOffset]::UtcNow.AddSeconds(-5).ToString("o")
$saveResultBody = @{
    clientMatchId = $ClientMatchId
    outcome = "Victory"
    durationSeconds = 135
    completedAt = $completedAt
    finalScore = 42
    finalFrontlinePosition = 100
} | ConvertTo-Json

$saveResultResponse = Invoke-RestMethod `
    -Uri "$ApiBaseUrl/api/results" `
    -Method Post `
    -ContentType "application/json" `
    -Headers @{ Authorization = "Bearer $token" } `
    -Body $saveResultBody

Write-Host ""
Write-Host "Saved result:"
$saveResultResponse | ConvertTo-Json | Write-Host

Read-Host -Prompt '.'
