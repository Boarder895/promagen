$ErrorActionPreference = "Stop"
"NEXT_PUBLIC_API_BASE_URL=https://api.promagen.com" | Out-File -FilePath ".env.local" -Encoding utf8 -NoNewline
Write-Host "Frontend now points to PROD API → https://api.promagen.com"