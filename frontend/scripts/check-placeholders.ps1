param(
  [switch]$fix
)

$ErrorActionPreference = 'Stop'

# When run via: pnpm -C frontend ..., the repo root here is the frontend dir
$repoRoot = (Resolve-Path "$PSScriptRoot/..").Path
$quarantineRoot = Join-Path $repoRoot 'placeholder_quarantine'

# Careful: add/remove patterns as you like
$patterns = @(
  'PLACEHOLDER', 'REPLACE_ME', '___STUB___', '__WIP__',
  'TODO:.*placeholder', 'ENCRYPT_' # example markers used earlier
)

$includeExt = @('*.ts','*.tsx','*.js','*.jsx','*.json','*.md')
$excludeDirs = @('\.git', 'node_modules', '\.next', 'dist', 'build', 'placeholder_quarantine', 'repo-audit-upload')

function Get-CandidateFiles {
  Get-ChildItem -Path $repoRoot -Recurse -File -Include $includeExt |
    Where-Object {
      $full = $_.FullName
      -not ($excludeDirs | ForEach-Object { $full -match [regex]::Escape($_) })
    }
}

function Has-Placeholder($fullPath) {
  $text = Get-Content -LiteralPath $fullPath -Raw -ErrorAction SilentlyContinue
  foreach ($pat in $patterns) { if ($text -match $pat) { return $true } }
  return $false
}

$files = Get-CandidateFiles

# Hits OUTSIDE quarantine
$hits = @()
foreach ($f in $files) {
  if ($f.FullName -like "$quarantineRoot*") { continue }
  if (Has-Placeholder $f.FullName) { $hits += $f }
}

if ($fix -and $hits.Count -gt 0) {
  foreach ($f in $hits) {
    $rel = [System.IO.Path]::GetRelativePath($repoRoot, $f.FullName)
    $dest = Join-Path $quarantineRoot $rel
    New-Item -ItemType Directory -Path ([System.IO.Path]::GetDirectoryName($dest)) -Force | Out-Null

    # Prefer git mv for staging; fall back to Move-Item
    $git = (Get-Command git -ErrorAction SilentlyContinue)
    if ($git) {
      & git mv -f -- "$($f.FullName)" "$dest" 2>$null
      if ($LASTEXITCODE -ne 0) { Move-Item -LiteralPath $f.FullName -Destination $dest -Force }
    } else {
      Move-Item -LiteralPath $f.FullName -Destination $dest -Force
    }
    Write-Host "➡ Moved $rel -> placeholder_quarantine"
  }
  # Refresh after moves
  $files = Get-CandidateFiles
  $hits = @()
  foreach ($f in $files) {
    if ($f.FullName -like "$quarantineRoot*") { continue }
    if (Has-Placeholder $f.FullName) { $hits += $f }
  }
}

if ($hits.Count -gt 0) {
  $outPaths = Join-Path $repoRoot 'placeholder-paths.txt'
  $hits | Select-Object -Expand FullName | Set-Content -Path $outPaths
  Write-Error ("Placeholders still present in {0} file(s) outside quarantine. See {1}." -f $hits.Count, $outPaths)
  exit 2
}

$qc = if (Test-Path $quarantineRoot) { (Get-ChildItem -Path $quarantineRoot -Recurse -File | Measure-Object).Count } else { 0 }
Write-Host "✅ No placeholders outside quarantine. Quarantined files: $qc"
exit 0

