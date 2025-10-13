# App Router must live at .\app\** (NO .\src\app). Also scan code for "src/app".

[CmdletBinding()]
param(
  # Optional override; if omitted we compute repo root from this script's location.
  [string]$RepoRoot
)

$ErrorActionPreference = 'Stop'

# Resolve repo root robustly (no reliance on -LiteralPath/-Parent or $PSScriptRoot)
if (-not $RepoRoot -or $RepoRoot.Trim() -eq '') {
  $scriptPath = $MyInvocation.MyCommand.Path
  if ($scriptPath -and $scriptPath.Trim() -ne '') {
    $scriptDir = [System.IO.Path]::GetDirectoryName($scriptPath)       # ...\frontend\scripts
    $RepoRoot  = [System.IO.Path]::GetDirectoryName($scriptDir)        # ...\frontend
  }
  if (-not $RepoRoot -or $RepoRoot.Trim() -eq '') {
    $RepoRoot = (Get-Location).Path
  }
}

function OK   ([string]$m){ Write-Host $m -ForegroundColor Green }
function FAIL ([string]$m){ Write-Host $m -ForegroundColor Red;  exit 1 }

Write-Host "== App structure check ==" -ForegroundColor Cyan
Write-Host ("Repo: {0}" -f $RepoRoot) -ForegroundColor DarkGray

# 1) Must have .\app
$app = Join-Path $RepoRoot 'app'
if (Test-Path -LiteralPath $app) { OK 'Root .\app exists' } else { FAIL "Missing .\app (expected: $app)" }

# 2) Must NOT have .\src\app
$srcApp = Join-Path $RepoRoot 'src\app'
if (Test-Path -LiteralPath $srcApp) { FAIL 'Forbidden folder .\src\app found (move contents into .\app)' } else { OK 'No .\src\app tree' }

# 3) Scan for "src/app" string references (exclude vendor/build & non-source files)
$exts    = '.ts','.tsx','.js','.jsx','.json','.css','.scss'
$exclude = '\\node_modules\\|\\\.next\\|\\\.git\\|\\dist\\|\\build\\|\\docs\\'

$files = Get-ChildItem -Path (Join-Path $RepoRoot '*') -Recurse -File |
         Where-Object {
           $_.FullName -notmatch $exclude -and
           $exts -contains $_.Extension.ToLower()
         }

$hits = @()
foreach ($f in $files) {
  try {
    $m = Select-String -LiteralPath $f.FullName -Pattern 'src/app' -SimpleMatch -ErrorAction Stop
    if ($m) { $hits += $m }
  } catch { }
}

if ($hits.Count -gt 0) {
  Write-Host "Found 'src/app' references:" -ForegroundColor Red
  foreach ($h in ($hits | Sort-Object Path,LineNumber)) {
    Write-Host ("{0}:{1}: {2}" -f $h.Path, $h.LineNumber, $h.Line)
  }
  exit 1
} else {
  OK "No 'src/app' references in code"
  exit 0
}

