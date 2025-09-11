param([string]$Key)
if (-not $Key) {
  Write-Host "Usage: .\set-openai-key.ps1 sk-proj_..." -ForegroundColor Yellow
  exit 1
}
$env:OPENAI_API_KEY = $Key
Write-Host "OPENAI_API_KEY set for current session." -ForegroundColor Green
