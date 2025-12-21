# scripts/docs-gate.ps1
# Docs Gate CI enforcement (PowerShell)
#
# Fails CI when "authority areas" are changed without accompanying documentation changes.
#
# Default policy:
# - If any files under frontend/src/lib/fx/** change, then at least one of the following must be true:
#   A) A file under docs/authority/** changed in the same diff, OR
#   B) docs/doc-delta.md changed and the added lines include:
#        Docs Gate: Yes
#        Target doc: <path>
#        Insertion point: <heading/lines>
#
# Works for both pull_request and push events (GitHub Actions).
#
# Run locally (repo root):
#   pwsh -File .\scripts\docs-gate.ps1
#
# Notes:
# - Your checkout step MUST use fetch-depth: 0 (or otherwise ensure the base commit exists locally),
#   so git diff can compare base..head reliably.

[CmdletBinding()]
param(
  # Authority areas (paths are repo-relative, use forward slashes)
  [string[]]$AuthorityPrefixes = @(
    'frontend/src/lib/fx/'
  ),

  # Documentation area in repo (Option A: docs are in-repo)
  [string[]]$DocsPrefixes = @(
    'docs/authority/'
  ),

  # Optional repo-tracked Doc Delta ledger (allowed alternative to editing authority docs)
  [string]$DocDeltaPath = 'docs/doc-delta.md',

  # Optional override commit SHAs (useful locally)
  [string]$BaseSha,
  [string]$HeadSha
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Info([string]$Message) { Write-Host "[docs-gate] $Message" }
function Write-Warn([string]$Message) { Write-Warning "[docs-gate] $Message" }
function Write-Fail([string]$Message) { Write-Error "[docs-gate] $Message" }

function Get-EventJson {
  if (-not $env:GITHUB_EVENT_PATH) { return $null }
  if (-not (Test-Path -LiteralPath $env:GITHUB_EVENT_PATH)) { return $null }
  try {
    $raw = Get-Content -LiteralPath $env:GITHUB_EVENT_PATH -Raw
    if (-not $raw) { return $null }
    return ($raw | ConvertFrom-Json)
  } catch {
    return $null
  }
}

function Resolve-CommitRange {
  param(
    [string]$BaseOverride,
    [string]$HeadOverride
  )

  if ($BaseOverride -and $HeadOverride) {
    return @{ Base = $BaseOverride; Head = $HeadOverride; Source = 'manual' }
  }

  $event = Get-EventJson

  if ($null -ne $event) {
    # pull_request event payload includes pull_request.base.sha + pull_request.head.sha
    if ($event.pull_request -and $event.pull_request.base -and $event.pull_request.head) {
      $b = [string]$event.pull_request.base.sha
      $h = [string]$event.pull_request.head.sha
      if ($b -and $h) { return @{ Base = $b; Head = $h; Source = 'pull_request' } }
    }

    # push event payload includes before + after
    if ($event.before -and $event.after) {
      $b = [string]$event.before
      $h = [string]$event.after
      if ($b -and $h) { return @{ Base = $b; Head = $h; Source = 'push' } }
    }
  }

  # Local fallback: compare HEAD~1..HEAD
  $hLocal = (git rev-parse HEAD 2>$null).Trim()
  $bLocal = (git rev-parse HEAD~1 2>$null).Trim()
  if ($bLocal -and $hLocal) {
    return @{ Base = $bLocal; Head = $hLocal; Source = 'local' }
  }

  throw "Unable to resolve commit range (Base/Head). Ensure git is available and history exists (fetch-depth: 0)."
}

function Get-ChangedFiles([string]$Base, [string]$Head) {
  $out = git diff --name-only $Base $Head 2>$null
  if ($LASTEXITCODE -ne 0) {
    throw "git diff failed for range $Base..$Head. Ensure checkout fetch-depth is 0 so the base commit exists."
  }
  if (-not $out) { return @() }

  return $out |
    ForEach-Object { ($_ -as [string]).Trim() } |
    Where-Object { $_ -ne '' } |
    ForEach-Object { $_ -replace '\\','/' }   # normalise slashes
}

function Any-PathMatchesPrefix([string[]]$Paths, [string[]]$Prefixes) {
  foreach ($p in $Paths) {
    foreach ($prefix in $Prefixes) {
      if ($p.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) { return $true }
    }
  }
  return $false
}

function Filter-ByPrefixes([string[]]$Paths, [string[]]$Prefixes) {
  $matches = New-Object System.Collections.Generic.List[string]
  foreach ($p in $Paths) {
    foreach ($prefix in $Prefixes) {
      if ($p.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        $matches.Add($p)
        break
      }
    }
  }
  return $matches.ToArray()
}

function DocDelta-HasRequiredAddedLines([string]$Base, [string]$Head, [string]$Path) {
  # Only validate if the file exists at HEAD.
  git cat-file -e "$Head`:$Path" 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { return $false }

  $patch = git diff $Base $Head -- $Path 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $patch) { return $false }

  $added = $patch -split "`n" |
    Where-Object {
      $_.StartsWith('+') -and
      -not $_.StartsWith('+++') -and
      -not $_.StartsWith('+@@')
    } |
    ForEach-Object { $_.Substring(1).Trim() } |
    Where-Object { $_ -ne '' }

  $hasGate = $false
  $hasTarget = $false
  $hasInsertion = $false

  foreach ($line in $added) {
    if ($line -match '^(Docs\s*Gate:\s*Yes)\b') { $hasGate = $true }
    if ($line -match '^(Target\s*doc:\s*.+)') { $hasTarget = $true }
    if ($line -match '^(Insertion\s*point:\s*.+)') { $hasInsertion = $true }
  }

  return ($hasGate -and $hasTarget -and $hasInsertion)
}

# ---- Main
$range = Resolve-CommitRange -BaseOverride $BaseSha -HeadOverride $HeadSha
$base = $range.Base
$head = $range.Head

Write-Info "Commit range: $base..$head (source: $($range.Source))"

$changed = Get-ChangedFiles -Base $base -Head $head

if ($changed.Count -eq 0) {
  Write-Info "No changed files detected."
  exit 0
}

$authorityTouched = Any-PathMatchesPrefix -Paths $changed -Prefixes $AuthorityPrefixes

if (-not $authorityTouched) {
  Write-Info "No authority areas changed. Gate not required."
  exit 0
}

$authorityFiles = Filter-ByPrefixes -Paths $changed -Prefixes $AuthorityPrefixes
Write-Info ("Authority areas changed (" + $authorityFiles.Count + "):")
$authorityFiles | ForEach-Object { Write-Host "  - $_" }

$docsChanged = Any-PathMatchesPrefix -Paths $changed -Prefixes $DocsPrefixes
$docDeltaChanged = $changed | Where-Object { $_.Equals($DocDeltaPath, [System.StringComparison]::OrdinalIgnoreCase) }

if ($docsChanged) {
  $docFiles = Filter-ByPrefixes -Paths $changed -Prefixes $DocsPrefixes
  Write-Info ("Docs updated (" + $docFiles.Count + "):")
  $docFiles | ForEach-Object { Write-Host "  - $_" }
  Write-Info "Docs Gate: PASS (authority change accompanied by docs/authority update)."
  exit 0
}

if ($docDeltaChanged) {
  if (DocDelta-HasRequiredAddedLines -Base $base -Head $head -Path $DocDeltaPath) {
    Write-Info "Docs Gate: PASS (docs/doc-delta.md updated with required Doc Delta fields)."
    exit 0
  }

  Write-Fail "docs/doc-delta.md changed but did not include required added lines: 'Docs Gate: Yes', 'Target doc: ...', 'Insertion point: ...'."
  exit 1
}

Write-Fail @"
Docs Gate: FAIL

Authority areas changed (e.g. frontend/src/lib/fx/**) but no in-repo documentation update was detected.

To pass:
1) Update at least one file under docs/authority/** in the same PR, OR
2) Add docs/doc-delta.md and include a Doc Delta entry with:
   - Docs Gate: Yes
   - Target doc: <path>
   - Insertion point: <heading/lines>

Tip:
- For Option A (best practice), keep the authoritative docs in docs/authority/ so CI can verify the update via git diff.
"@
exit 1
