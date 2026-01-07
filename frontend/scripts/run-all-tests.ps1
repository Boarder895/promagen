# scripts/run-all-tests.ps1
# ============================================================================
# Run all tests in batches to avoid memory issues
# ============================================================================
# Usage: pwsh -File ./scripts/run-all-tests.ps1
# ============================================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PROMAGEN TEST RUNNER" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$failed = @()
$passed = @()

# Batch 1: Compression tests
Write-Host "[1/4] Running compression tests..." -ForegroundColor Yellow
try {
    pnpm run test:compression
    $passed += "compression"
    Write-Host "[1/4] Compression tests PASSED" -ForegroundColor Green
} catch {
    $failed += "compression"
    Write-Host "[1/4] Compression tests FAILED" -ForegroundColor Red
}

Write-Host ""

# Batch 2: Prompt Intelligence tests
Write-Host "[2/4] Running prompt-intelligence tests..." -ForegroundColor Yellow
try {
    pnpm run test:prompt-intelligence
    $passed += "prompt-intelligence"
    Write-Host "[2/4] Prompt-intelligence tests PASSED" -ForegroundColor Green
} catch {
    $failed += "prompt-intelligence"
    Write-Host "[2/4] Prompt-intelligence tests FAILED" -ForegroundColor Red
}

Write-Host ""

# Batch 3: Data tests
Write-Host "[3/4] Running data tests..." -ForegroundColor Yellow
try {
    pnpm run test:data
    $passed += "data"
    Write-Host "[3/4] Data tests PASSED" -ForegroundColor Green
} catch {
    $failed += "data"
    Write-Host "[3/4] Data tests FAILED" -ForegroundColor Red
}

Write-Host ""

# Batch 4: Other tests
Write-Host "[4/4] Running other tests..." -ForegroundColor Yellow
try {
    pnpm run test:other
    $passed += "other"
    Write-Host "[4/4] Other tests PASSED" -ForegroundColor Green
} catch {
    $failed += "other"
    Write-Host "[4/4] Other tests FAILED" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TEST SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($passed.Count -gt 0) {
    Write-Host "PASSED: $($passed -join ', ')" -ForegroundColor Green
}

if ($failed.Count -gt 0) {
    Write-Host "FAILED: $($failed -join ', ')" -ForegroundColor Red
    Write-Host ""
    exit 1
} else {
    Write-Host ""
    Write-Host "All tests passed!" -ForegroundColor Green
    exit 0
}