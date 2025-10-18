# scripts/typecheck-summary.ps1
$ErrorActionPreference = "Stop"

# Ensure scripts folder exists (no-op if it already does)
$null = New-Item -ItemType Directory -Path scripts -Force

# Run TypeScript in no-emit mode, plain output
$lines = pnpm exec tsc --noEmit --pretty false 2>&1 | Tee-Object -Variable _ | Out-Null

# Pick only TS error lines
$errors = $lines | Where-Object { $_ -match 'error TS\d+:' }

# Count distinct files from lines like: path\file.ts:line:col - error TSxxxx: ...
$files = $errors | ForEach-Object { ($_ -split ':',3)[0] } | Sort-Object -Unique

Write-Host ("Found {0} errors in {1} files." -f $errors.Count, $files.Count)

if ($errors.Count -gt 0) { exit 2 } else { exit 0 }

