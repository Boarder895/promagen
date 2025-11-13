<#
  verify-test-layout.ps1
  Fails CI if any "*.test.ts(x)" file is not under an allowed folder:
    - __tests__ (any level)
    - tests (any level)
    - src/__tests__ (app-scoped)
#>

$ErrorActionPreference = "Stop"

Write-Host "→ Verifying test layout..."

# Run Jest to get the definitive list of discovered tests
# (Uses your existing config so it stays in lockstep with reality.)
$jestCmd = 'pnpm exec jest --config jest.config.cjs --listTests'
$jestOutput = (& cmd /c $jestCmd) 2>&1

if ($LASTEXITCODE -ne 0) {
  Write-Error "Jest --listTests failed:`n$jestOutput"
  exit 1
}

# Collect test files
$testFiles = $jestOutput `
  | Where-Object { $_ -match '\.test\.(ts|tsx)$' } `
  | ForEach-Object { $_.Trim() } `
  | Where-Object { $_ -ne "" }

if (-not $testFiles -or $testFiles.Count -eq 0) {
  Write-Host "✓ No tests discovered by Jest; nothing to verify."
  exit 0
}

# Normalise and validate
$violations = @()
foreach ($path in $testFiles) {
  $norm = $path -replace '/', '\'
  # Allowed if it contains \__tests__\ or \tests\
  $isAllowed = ($norm -match '\\__tests__\\') -or ($norm -match '\\tests\\')

  # Also allow the app-scoped folder specifically
  if ($norm -match 'src\\__tests__\\') { $isAllowed = $true }

  if (-not $isAllowed) {
    $violations += $path
  }
}

if ($violations.Count -gt 0) {
  Write-Host ""
  Write-Host "✗ Test layout violations found:`n" -ForegroundColor Red
  $violations | ForEach-Object { Write-Host "  - $_" }
  Write-Host ""
  Write-Host "Fix by moving these files into either a '__tests__' folder (component) or a 'tests' folder (feature),"
  Write-Host "or to 'src/__tests__' if the test is app-scoped."
  exit 1
}

Write-Host "✓ Test layout looks good."
exit 0
