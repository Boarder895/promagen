# Run from /frontend. Replaces deprecated urlForProvider* with Routes.provider(id).
$ErrorActionPreference = "Stop"

# Find all TS/TSX files that contain the old helpers
$files = Select-String -Path "src\**\*.ts","src\**\*.tsx" -Pattern 'urlForProvider(Page)?' -List | ForEach-Object { $_.Path }

foreach ($p in $files) {
  $text = Get-Content -Path $p -Raw

  # Ensure we import the canonical Routes surface
  if ($text -match 'from\s+["'']@/lib/routes["'']') {
    # replace any deprecated helper imports on that line
    $text = $text -replace 'import\s*\{\s*urlForProviderPage\s*\}\s*from\s*["'']@/lib/routes["''];?', 'import { Routes } from ''@/lib/routes'';'
    $text = $text -replace 'import\s*\{\s*urlForProvider\s*\}\s*from\s*["'']@/lib/routes["''];?', 'import { Routes } from ''@/lib/routes'';'
    # de-dupe if file already imports Routes
    $text = $text -replace 'import\s*\{\s*Routes\s*,\s*Routes\s*\}\s*from\s*["'']@/lib/routes["''];?', 'import { Routes } from ''@/lib/routes'';'
  } else {
    # add import if there was only a deprecated one
    $text = $text -replace 'import\s*\{\s*urlForProviderPage\s*\}\s*from\s*["'']@/lib/routes["''];?', 'import { Routes } from ''@/lib/routes'';'
    $text = $text -replace 'import\s*\{\s*urlForProvider\s*\}\s*from\s*["'']@/lib/routes["''];?', 'import { Routes } from ''@/lib/routes'';'
  }

  # Replace usages
  $text = $text -replace 'urlForProviderPage\(([^)]+)\)', 'Routes.provider($1)'
  $text = $text -replace 'urlForProvider\(([^)]+)\)',    'Routes.provider($1)'

  Set-Content -Path $p -Value $text -NoNewline
  Write-Host "Refactored $p"
}

Write-Host "Route helper refactor complete."

