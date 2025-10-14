param([switch]$fix)

$patterns      = @('\.\.\.','…')   # "..." and the Unicode ellipsis
$includeExt    = @('*.ts','*.tsx','*.js','*.jsx','*.json','*.css','*.scss','*.md')
$excludeRegex  = '\\node_modules\\|\\.next\\|\\dist\\|\\coverage\\|backup-|providers\\copypaste'

# Gather candidate files
$allFiles =
  Get-ChildItem -Recurse -File -Include $includeExt |
  Where-Object { $_.FullName -notmatch $excludeRegex }

# Scan
$hits = foreach ($f in $allFiles) {
  foreach ($p in $patterns) {
    Select-String -Path $f.FullName -Pattern $p -AllMatches |
      ForEach-Object {
        [pscustomobject]@{
          Path       = $_.Path
          LineNumber = $_.LineNumber
          Line       = $_.Line.Trim()
        }
      }
  }
}

if (-not $hits) {
  "✅ No placeholder markers detected." | Write-Host
  exit 0
}

# Save full output (no truncation) for review
$hits | Sort-Object Path,LineNumber |
  Export-Csv -NoTypeInformation -Encoding utf8 ./placeholder-hits.csv

$paths = $hits | Select-Object -ExpandProperty Path -Unique | Sort-Object
$paths | Set-Content -Encoding utf8 ./placeholder-paths.txt

# Directory summary (top hotspots)
$summary =
  $paths | ForEach-Object { Split-Path $_ } |
  Group-Object | Sort-Object Count -Descending |
  Select-Object @{n='Count';e={$_.Count}}, @{n='Directory';e={$_.Name}}

"`n⚠️  Placeholder markers found in $($paths.Count) files.`n" | Write-Host
$summary | Format-Table -Auto

if (-not $fix) {
  Write-Error "Placeholders detected. See 'placeholder-hits.csv' and 'placeholder-paths.txt'. Run with -fix to quarantine offenders."
  exit 1
}

# Quarantine mode: move files out of the way so the build can't ignore them
$offenders = $paths
foreach ($o in $offenders) {
  $rel  = Resolve-Path $o | Split-Path -NoQualifier
  $dest = Join-Path -Path "placeholder_quarantine" -ChildPath $rel
  New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
  Move-Item -Force $o $dest
  "➡ Moved $rel -> placeholder_quarantine" | Write-Host
}

"‼ Replace each quarantined file with a complete implementation, then delete 'placeholder_quarantine' when empty." | Write-Host
exit 2
