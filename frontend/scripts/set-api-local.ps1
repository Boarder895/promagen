# FRONTEND • NEXT.JS
# Run from: C:\Users\Martin Yarnold\Projects\promagen\frontend
param(
  [int]$Port = 4000
)
$ErrorActionPreference = "Stop"
$envFile = ".env.local"

"NEXT_PUBLIC_API_BASE_URL=http://localhost:$Port" | Out-File -FilePath $envFile -Encoding utf8 -NoNewline
Write-Host "Frontend now points to LOCAL API → http://localhost:$Port"
