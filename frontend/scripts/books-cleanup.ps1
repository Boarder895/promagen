# books-cleanup.ps1
# Purpose: keep only Developers’ and Users’ books, with scan + timestamped backup.
param(
  [string]$FrontendRoot = "$PSScriptRoot\.."
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Exists($p) { Test-Path -LiteralPath $p }

$root = Resolve-Path $FrontendRoot
Set-Location $root

Write-Step "Scanning current Books components"
$booksDir = ".\src\components\Books"
if (Exists $booksDir) {
  Get-ChildItem -Recurse -File $booksDir | Select-Object FullName
} else {
  Write-Host "No Books directory found at $booksDir" -ForegroundColor Yellow
}

Write-Step "Scanning docs routes (App Router owner = app/docs/*)"
$docsDir = ".\app\docs"
if (Exists $docsDir) {
  Get-ChildItem -Directory $docsDir | Select-Object FullName
} else {
  Write-Host "No docs directory found at $docsDir" -ForegroundColor Yellow
}

# Timestamped backup OUTSIDE the project (to avoid being compiled)
$stamp = (Get-Date).ToString('yyyy-MM-dd_HH-mm-ss')
$backupRoot = Join-Path -Path "$env:USERPROFILE\Backups\promagen-frontend" -ChildPath $stamp
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null

Write-Step "Backing up Books + docs to $backupRoot"
if (Exists $booksDir) { Copy-Item $booksDir (Join-Path $backupRoot "Books") -Recurse -Force -ErrorAction SilentlyContinue }
if (Exists $docsDir)  { Copy-Item $docsDir  (Join-Path $backupRoot "docs")  -Recurse -Force -ErrorAction SilentlyContinue }

Write-Step "Pruning everything except Developers + Users"
# COMPONENTS
if (Exists $booksDir) {
  Get-ChildItem -Recurse $booksDir | ForEach-Object {
    $n = $_.Name.ToLowerInvariant()
    if ($n -notmatch 'developers' -and $n -notmatch 'users' -and $_.Name -ne 'index.ts') {
      Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
}

# DOC ROUTES
if (Exists $docsDir) {
  Get-ChildItem -Directory $docsDir | ForEach-Object {
    $n = $_.Name.ToLowerInvariant()
    if ($n -ne 'developers' -and $n -ne 'users') {
      Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
}

# Minimal barrel: named exports only (project rule)
$barrel = Join-Path $booksDir "index.ts"
if (Exists $booksDir) {
@'
export * from "./DevelopersBook";
export * from "./UsersBook";
'@ | Set-Content -Encoding UTF8 $barrel
}

Write-Step "Done. Backup is at: $backupRoot"
