# Clean build artifacts and caches
param(
  [switch]$Hard  # also nuke node_modules + lockfiles
)

$ErrorActionPreference = 'SilentlyContinue'
Write-Host "== Clean ==" -ForegroundColor Cyan

# folders to wipe
$dirs = @('.next','dist','build','coverage')
# files to wipe
$files = @('tsconfig.tsbuildinfo','build_output.txt')

foreach($d in $dirs){
  if (Test-Path -LiteralPath $d) {
    Remove-Item -LiteralPath $d -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host ("Removed {0}" -f $d) -ForegroundColor DarkGray
  }
}

foreach($f in $files){
  if (Test-Path -LiteralPath $f) {
    Remove-Item -LiteralPath $f -Force -ErrorAction SilentlyContinue
    Write-Host ("Removed {0}" -f $f) -ForegroundColor DarkGray
  }
}

if ($Hard) {
  foreach($lock in @('package-lock.json','pnpm-lock.yaml','yarn.lock')){
    if (Test-Path -LiteralPath $lock) {
      Remove-Item -LiteralPath $lock -Force -ErrorAction SilentlyContinue
      Write-Host ("Removed {0}" -f $lock) -ForegroundColor DarkGray
    }
  }
  if (Test-Path -LiteralPath 'node_modules') {
    Remove-Item -LiteralPath 'node_modules' -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "Removed node_modules" -ForegroundColor DarkGray
  }
}

Write-Host "Clean complete." -ForegroundColor Green
