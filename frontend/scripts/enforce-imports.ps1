# scripts/enforce-imports.ps1  — safe, no line continuations

$root = (Resolve-Path "$PSScriptRoot\..").Path
$utf8 = New-Object System.Text.UTF8Encoding($false)

# Only real source files
$files = Get-ChildItem -Path $root -Recurse -File -Include *.ts,*.tsx |
  Where-Object { $_.FullName -notmatch '\\(node_modules|\.next|dist|out|build|coverage|\.git)\\' }

$bad = @()

foreach ($f in $files) {
  $text  = [IO.File]::ReadAllText($f.FullName)
  $fixed = $text

  # Auto-fix common mistakes
  $fixed = $fixed -replace '(\.\./)+@/components/','@/components/'
  $fixed = $fixed -replace '(\.\./)*src/components/','@/components/'

  if ($fixed -ne $text) { [IO.File]::WriteAllText($f.FullName, $fixed, $utf8) }

  # Flag any leftovers
  $remaining = Select-String -InputObject $fixed -Pattern '\.\./@/components/|(\.\./)*src/components/' -AllMatches
  if ($remaining) { $bad += [PSCustomObject]@{ File=$f.FullName; Sample=$remaining.Matches[0].Value } }
}

if ($bad.Count -gt 0) {
  Write-Host "`nInvalid imports detected (use '@/components/...'):" -ForegroundColor Red
  $bad | ForEach-Object { Write-Host ("{0}`n  -> {1}" -f $_.File, $_.Sample) }
  exit 1
}
