# scripts/docs-gate.ps1
# Docs Gate CI enforcement (PowerShell)
#
# Fails CI when "authority areas" are changed without accompanying documentation changes.
#
# Default policy:
# - If any files under frontend/src/lib/fx/** change, then at least one of the following must be true:
#   A) A file under docs/authority/** changed in the same diff AND includes a non-whitespace change
#      (CRLF/LF-only churn and whitespace-only edits do not count), OR
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

  $ev = Get-EventJson

  # GitHub Actions variables
  $eventName = $env:GITHUB_EVENT_NAME
  $sha = $env:GITHUB_SHA

  if ($eventName -eq 'pull_request' -and $ev -and $ev.pull_request) {
    $base = $ev.pull_request.base.sha
    $head = $ev.pull_request.head.sha
    if ($base -and $head) {
      return @{ Base = $base; Head = $head; Source = 'pull_request' }
    }
  }

  if ($eventName -eq 'push' -and $ev -and $ev.before -and $ev.after) {
    return @{ Base = $ev.before; Head = $ev.after; Source = 'push' }
  }

  # Fallback for local use: compare last commit to HEAD
  try {
    $headLocal = if ($sha) { $sha } else { (git rev-parse HEAD 2>$null) }
    $baseLocal = (git rev-parse "$headLocal~1" 2>$null)
    if ($headLocal -and $baseLocal) {
      return @{ Base = $baseLocal; Head = $headLocal; Source = 'local-fallback' }
    }
  } catch {
    # fall through
  }

  throw "Unable to resolve commit range. Ensure this runs in CI with proper event data, or pass -BaseSha and -HeadSha."
}

function Get-ChangedFiles([string]$Base, [string]$Head) {
  $out = git diff --name-only $Base $Head 2>$null
  if ($LASTEXITCODE -ne 0) {
    throw "git diff --name-only failed for range $Base..$Head. Ensure checkout fetch-depth: 0 so both commits exist."
  }

  if (-not $out) { return @() }

  return @($out) |
    ForEach-Object { $_.Trim() } |
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

function Get-MeaningfulDocFiles([string]$Base, [string]$Head, [string[]]$DocFiles) {
  # Returns doc files that have at least one non-whitespace change.
  # We ignore:
  # - whitespace-only edits (via -w)
  # - CRLF/LF-only churn at end-of-line (via --ignore-cr-at-eol)
  $meaningful = New-Object System.Collections.Generic.List[string]

  foreach ($f in $DocFiles) {
    $patch = git diff $Base $Head --ignore-cr-at-eol -w -- $f 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $patch) { continue }

    $patchLines = @($patch)
    $changes = $patchLines | Where-Object {
      (($_.StartsWith('+') -and -not $_.StartsWith('+++') -and -not $_.StartsWith('+@@'))) -or
      (($_.StartsWith('-') -and -not $_.StartsWith('---') -and -not $_.StartsWith('-@@')))
    }

    if (@($changes).Count -gt 0) { $meaningful.Add($f) }
  }

  return $meaningful.ToArray()
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

$docFiles = Filter-ByPrefixes -Paths $changed -Prefixes $DocsPrefixes
$docDeltaChanged = $changed | Where-Object { $_.Equals($DocDeltaPath, [System.StringComparison]::OrdinalIgnoreCase) }

$meaningfulDocFiles = Get-MeaningfulDocFiles -Base $base -Head $head -DocFiles $docFiles

if ($docFiles.Count -gt 0) {
  Write-Info ("Docs changed (" + $docFiles.Count + "):")
  $docFiles | ForEach-Object { Write-Host "  - $_" }
}

if ($meaningfulDocFiles.Count -gt 0) {
  Write-Info ("Meaningful docs updates (" + $meaningfulDocFiles.Count + "):")
  $meaningfulDocFiles | ForEach-Object { Write-Host "  - $_" }
  Write-Info "Docs Gate: PASS (authority change accompanied by meaningful docs/authority update)."
  exit 0
}

if ($docFiles.Count -gt 0) {
  Write-Warn "docs/authority changed, but only whitespace/line-ending churn was detected (ignored for passing the gate)."
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
1) Make a meaningful update to at least one file under docs/authority/** in the same PR (whitespace/CRLF-only changes do not count), OR
2) Add docs/doc-delta.md and include a Doc Delta entry with:
   - Docs Gate: Yes
   - Target doc: <path>
   - Insertion point: <heading/lines>

Tip:
- For Option A (best practice), keep the authoritative docs in docs/authority/ so CI can verify a meaningful update via git diff (ignoring whitespace/CRLF-only churn).
"@
exit 1
