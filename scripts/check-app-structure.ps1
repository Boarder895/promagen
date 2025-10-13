$ErrorActionPreference = "Stop"

function Fail($msg) { Write-Error $msg; $script:failed = $true }

# 1) Resolve repo root
$repo = (& git rev-parse --show-toplevel 2>$null); if (-not $repo) { $repo = (Resolve-Path ".").Path }

# 2) Pick the Next.js app project root (prefer ./frontend if it contains next)
$candidates = @(
  (Resolve-Path "."      ).Path,
  (Join-Path $repo "frontend"),
  (Join-Path $repo "web"),
  (Join-Path $repo "apps\frontend"),
  $repo
) | Select-Object -Unique

function IsNextProject($dir) {
  $pkg = Join-Path $dir "package.json"
  if (-not (Test-Path $pkg)) { return $false }
  try { return ((Get-Content $pkg -Raw) -match '"next"') } catch { return $false }
}

$proj = ($candidates | Where-Object { IsNextProject $_ } | Select-Object -First 1)
if (-not $proj) { $proj = $repo }  # fallback

Set-Location $proj
Write-Host "== App structure check =="
Write-Host "Repo: $repo"
Write-Host "Project root: $proj`n"

# A) Root app must exist
if (-not (Test-Path ".\app")) { Fail "Missing .\app folder (root App Router)." } else { Write-Host "✔ Root .\app exists" }

# B) src\app must NOT exist (within this project root)
if (Test-Path ".\src\app") {
  Fail "Found disallowed .\src\app tree (in project root)."
  Get-ChildItem ".\src\app" -Recurse -File | Select-Object -First 20 | ForEach-Object { Write-Host "  - $($_.FullName)" }
} else {
  Write-Host "✔ No .\src\app tree (in project root)"
}

# C) No 'src/app' references (search within this project root)
$hits = Get-ChildItem . -Recurse -File -Include *.ts,*.tsx,*.js,*.jsx,*.json,*.md,*.css,*.scss,*.yml,*.yaml |
  Where-Object { $_.FullName -notlike "*\node_modules\*" -and $_.FullName -notlike "*\.next\*" } |
  Select-String -SimpleMatch "src/app"
if ($hits) {
  Fail "Found 'src/app' references:"; $hits | Select-Object Path,LineNumber,Line | Format-Table -AutoSize
} else {
  Write-Host "✔ No 'src/app' references"
}

# D) tsconfig path alias must include './app/*'
$tsPath = ".\tsconfig.json"
if (Test-Path $tsPath) {
  try {
    $ts = Get-Content $tsPath -Raw | ConvertFrom-Json
    $paths = $ts.compilerOptions.paths."@/*"
    $ok = $paths -contains "./app/*"
  } catch {
    $ok = (Select-String -Path $tsPath -SimpleMatch '"@/*": [' -Context 0,4 | Select-String -SimpleMatch "./app/*") -ne $null
  }
  if (-not $ok) { Fail "tsconfig.json paths['@/*'] must include ""./app/*""." } else { Write-Host "✔ tsconfig @/* includes ./app/*" }
} else {
  Fail "Missing tsconfig.json"
}

# E) Tailwind content globs must cover ./app
$twFiles = @(".\tailwind.config.ts", ".\tailwind.config.js") | Where-Object { Test-Path $_ }
if ($twFiles.Count -gt 0) {
  $hasAppGlob = $false
  foreach ($f in $twFiles) { if (Select-String -Path $f -SimpleMatch "./app/**/*") { $hasAppGlob = $true } }
  if (-not $hasAppGlob) { Fail "Tailwind config must include ""./app/**/*.{ts,tsx,md,mdx}"" in content." } else { Write-Host "✔ Tailwind content includes ./app/**/*" }
} else {
  Write-Host "ℹ No tailwind config found; skipping glob check"
}

if ($script:failed) { Write-Host "`n❌ App structure check FAILED"; exit 1 } else { Write-Host "`n✅ App structure check PASSED"; exit 0 }