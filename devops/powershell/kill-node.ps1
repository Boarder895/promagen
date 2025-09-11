npx kill-port 4000 | Out-Null
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Write-Host "Ports cleared & Node processes stopped." -ForegroundColor Green
