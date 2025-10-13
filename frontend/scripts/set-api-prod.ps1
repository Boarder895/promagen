<<<<<<< HEAD
# FRONTEND • NEXT.JS
# Run from: C:\Users\Martin Yarnold\Projects\promagen\frontend
$ErrorActionPreference = "Stop"
$envFile = ".env.local"

if (Test-Path $envFile) { Remove-Item $envFile -Force }
'NEXT_PUBLIC_API_BASE_URL=https://api.promagen.com' | Out-File -FilePath $envFile -Encoding utf8 -NoNewline
Write-Host "Frontend now points to PROD API → https://api.promagen.com"
=======
﻿$ErrorActionPreference = "Stop"
"NEXT_PUBLIC_API_BASE_URL=https://api.promagen.com" | Out-File -FilePath ".env.local" -Encoding utf8 -NoNewline
Write-Host "Frontend now points to PROD API → https://api.promagen.com"
>>>>>>> 2ae501b4f413143a9435e5c577312aa7dbda9955
