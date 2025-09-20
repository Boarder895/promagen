param([int]$Port = 4000)
$ErrorActionPreference = "Stop"
"NEXT_PUBLIC_API_BASE_URL=http://localhost:$Port" | Out-File -FilePath ".env.local" -Encoding utf8 -NoNewline
Write-Host "Frontend now points to LOCAL API → http://localhost:$Port"