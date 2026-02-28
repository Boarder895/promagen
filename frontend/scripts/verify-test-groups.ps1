<#
  verify-test-groups.ps1
  ─────────────────────────────────────────────────────────────────────
  Verifies that every test file on disk is discovered by exactly one
  Jest project group. Run after any change to jest.config.cjs.

  Usage:  pnpm run verify:groups
  From:   C:\Users\Proma\Projects\promagen\frontend
#>

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "  Verifying Jest project group assignments..." -ForegroundColor Cyan
Write-Host ""

# ── 1. Get files per project ────────────────────────────────────────
$groups = @('data', 'learning', 'intelligence', 'hooks', 'components', 'api', 'util', 'app')
$projectFiles = @{}
$totalProjected = 0

foreach ($group in $groups) {
  $output = pnpm exec jest --config jest.config.cjs --selectProjects $group --listTests 2>&1
  $files = @($output | Where-Object { $_ -match '\.(test|spec)\.(ts|tsx)$' } | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" })

  $projectFiles[$group] = $files
  $totalProjected += $files.Count
  $padded = $group.PadRight(14)
  Write-Host "    [$padded] $($files.Count) files" -ForegroundColor Gray
}

Write-Host ""

# ── 2. Check for duplicates (file in more than one group) ───────────
$seen = @{}
$duplicates = @()
foreach ($group in $groups) {
  foreach ($f in $projectFiles[$group]) {
    if ($seen.ContainsKey($f)) {
      $duplicates += "  $f  (in both '$($seen[$f])' and '$group')"
    } else {
      $seen[$f] = $group
    }
  }
}

if ($duplicates.Count -gt 0) {
  Write-Host "  FAIL: Duplicate assignments found:" -ForegroundColor Red
  $duplicates | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
  exit 1
}

# ── 3. Check for orphans on disk ────────────────────────────────────
$diskFiles = Get-ChildItem -Path "src" -Recurse -Include "*.test.ts","*.test.tsx" |
  Where-Object { $_.FullName -notmatch 'node_modules' }

$discoveredNorm = @{}
foreach ($f in $seen.Keys) {
  $norm = ($f -replace '\\', '/').TrimEnd()
  $discoveredNorm[$norm] = $true
}

$orphans = @()
foreach ($f in $diskFiles) {
  $norm = ($f.FullName -replace '\\', '/').TrimEnd()
  $matched = $false
  foreach ($d in $discoveredNorm.Keys) {
    if ($d -like "*$($norm.Split('/src/')[-1])") {
      $matched = $true
      break
    }
  }
  if (-not $matched) {
    $orphans += "  $($f.FullName)"
  }
}

if ($orphans.Count -gt 0) {
  Write-Host "  WARNING: Files on disk but not in any Jest project:" -ForegroundColor Yellow
  $orphans | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
}

# ── 4. Summary ──────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ───────────────────────────────────────────" -ForegroundColor Cyan
Write-Host "  Group           Files" -ForegroundColor Cyan
Write-Host "  ───────────────────────────────────────────" -ForegroundColor Cyan
foreach ($group in $groups) {
  $padded = $group.PadRight(16)
  Write-Host "  $padded$($projectFiles[$group].Count)" -ForegroundColor Gray
}
Write-Host "  ───────────────────────────────────────────" -ForegroundColor Cyan
Write-Host "  TOTAL           $totalProjected" -ForegroundColor White
Write-Host ""

if ($duplicates.Count -eq 0 -and $orphans.Count -eq 0) {
  Write-Host "  PASS: All $totalProjected test files assigned to exactly one group." -ForegroundColor Green
  Write-Host "        Zero orphans. Zero duplicates." -ForegroundColor Green
} elseif ($duplicates.Count -eq 0) {
  Write-Host "  WARN: $totalProjected files grouped, but $($orphans.Count) orphan(s) on disk." -ForegroundColor Yellow
}

Write-Host ""
exit 0
