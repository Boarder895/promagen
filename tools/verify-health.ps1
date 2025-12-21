<# 
Promagen - verify-health.ps1
Runs local checks (lint/typecheck/tests) + FX endpoint checks and writes a dashboard report:
frontend\.reports\latest.json

Designed to be robust on Windows + PowerShell 7, and still not explode on PS 5.1.
#>

[CmdletBinding()]
param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$FxPath = "/api/fx",
  [string]$TracePath = "/api/fx/trace",

  [switch]$SkipLint,
  [switch]$SkipTypecheck,
  [switch]$SkipTests,
  [switch]$SkipFx,

  [int]$LintTimeoutSec = 900,
  [int]$TypecheckTimeoutSec = 900,
  [int]$TestsTimeoutSec = 1200,
  [int]$HttpTimeoutSec = 20
)

Set-StrictMode -Off
$ErrorActionPreference = "Stop"

function Write-Section([string]$Title) {
  Write-Host ""
  Write-Host ("=== {0} ===" -f $Title) -ForegroundColor Cyan
}

function New-RunId {
  return (Get-Date).ToString("yyyyMMdd-HHmmss-fff")
}

function Ensure-Dir([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
  }
}

function Safe-JsonRead([string]$Path) {
  try {
    if (Test-Path -LiteralPath $Path) {
      $raw = Get-Content -LiteralPath $Path -Raw -ErrorAction Stop
      if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
      return ($raw | ConvertFrom-Json -ErrorAction Stop)
    }
  } catch { }
  return $null
}

function Safe-JsonWrite([string]$Path, $Obj) {
  $json = $Obj | ConvertTo-Json -Depth 40
  Set-Content -LiteralPath $Path -Value $json -Encoding UTF8
}

function Emoji-FromCodePoint([int]$CodePoint) {
  try { return [char]::ConvertFromUtf32($CodePoint) } catch { return "" }
}

function Get-BannerAndEmoji([string]$OverallStatus) {
  # status: ok | warn | fail
  $banner = "green"
  $emoji  = Emoji-FromCodePoint 0x1F7E2   # 🟢

  if ($OverallStatus -eq "warn") {
    $banner = "amber"
    $emoji  = Emoji-FromCodePoint 0x1F7E1 # 🟡
  }
  elseif ($OverallStatus -eq "fail") {
    $banner = "red"
    $emoji  = Emoji-FromCodePoint 0x1F534 # 🔴
  }

  return @{ banner = $banner; emoji = $emoji }
}

function Invoke-CmdCapture {
  param(
    [Parameter(Mandatory=$true)][string]$Command,
    [Parameter(Mandatory=$true)][string]$WorkingDirectory,
    [int]$TimeoutSec = 600,
    [string]$Label = "process"
  )

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = "cmd.exe"
  # /d disables AutoRun, /s makes quoting consistent, /c runs then exits
  $psi.Arguments = "/d /s /c `"$Command`""
  $psi.WorkingDirectory = $WorkingDirectory
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError  = $true
  $psi.CreateNoWindow = $true

  $p = New-Object System.Diagnostics.Process
  $p.StartInfo = $psi

  $null = $p.Start()

  # Read asynchronously to avoid output-buffer deadlocks
  $stdoutTask = $p.StandardOutput.ReadToEndAsync()
  $stderrTask = $p.StandardError.ReadToEndAsync()

  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $lastBeat = -1

  while (-not $p.HasExited) {
    Start-Sleep -Milliseconds 250

    if ($TimeoutSec -gt 0 -and $sw.Elapsed.TotalSeconds -ge $TimeoutSec) {
      try { $p.Kill($true) } catch { try { $p.Kill() } catch { } }
      return @{
        exitCode = 124
        ok = $false
        timedOut = $true
        durationMs = [int]$sw.ElapsedMilliseconds
        stdout = ""
        stderr = ("Timed out after {0}s running: {1}" -f $TimeoutSec, $Command)
      }
    }

    # Heartbeat every ~5 seconds
    $beat = [int]([Math]::Floor($sw.Elapsed.TotalSeconds / 5))
    if ($beat -ne $lastBeat) {
      $lastBeat = $beat
      Write-Host ("[{0}] still running ({1}s)..." -f $Label, [int]$sw.Elapsed.TotalSeconds) -ForegroundColor DarkGray
    }
  }

  $p.WaitForExit()
  $sw.Stop()

  $stdout = ""
  $stderr = ""
  try { $stdout = $stdoutTask.GetAwaiter().GetResult() } catch { }
  try { $stderr = $stderrTask.GetAwaiter().GetResult() } catch { }

  $code = $p.ExitCode
  return @{
    exitCode = $code
    ok = ($code -eq 0)
    timedOut = $false
    durationMs = [int]$sw.ElapsedMilliseconds
    stdout = $stdout
    stderr = $stderr
  }
}

function Invoke-Http {
  param(
    [Parameter(Mandatory=$true)][string]$Url,
    [int]$TimeoutSec = 20
  )

  $sw = [System.Diagnostics.Stopwatch]::StartNew()

  try {
    if ($PSVersionTable.PSVersion.Major -lt 6) {
      $resp = Invoke-WebRequest -Uri $Url -TimeoutSec $TimeoutSec -UseBasicParsing -ErrorAction Stop
    } else {
      $resp = Invoke-WebRequest -Uri $Url -TimeoutSec $TimeoutSec -ErrorAction Stop
    }

    $sw.Stop()
    return @{
      ok = $true
      statusCode = [int]$resp.StatusCode
      headers = $resp.Headers
      body = $resp.Content
      durationMs = [int]$sw.ElapsedMilliseconds
      error = $null
    }
  } catch {
    $sw.Stop()
    return @{
      ok = $false
      statusCode = $null
      headers = $null
      body = $null
      durationMs = [int]$sw.ElapsedMilliseconds
      error = $_.Exception.Message
    }
  }
}

function New-CheckResult {
  param(
    [string]$Name,
    [string]$Status,
    [int]$DurationMs,
    [string]$Message,
    $Extra = $null
  )

  $o = @{
    name = $Name
    status = $Status   # ok | warn | fail | skip
    durationMs = $DurationMs
    message = $Message
  }
  if ($null -ne $Extra) { $o.extra = $Extra }
  return $o
}

# --------- Roots / report paths ---------
$runId = New-RunId
$generatedAt = (Get-Date).ToString("o")

$repoRoot = Split-Path -Parent $PSScriptRoot
$frontendRoot = Join-Path $repoRoot "frontend"
$reportDir = Join-Path $frontendRoot ".reports"
Ensure-Dir $reportDir
$latestPath = Join-Path $reportDir "latest.json"

$FxUrl = ($BaseUrl.TrimEnd("/") + $FxPath)
$TraceUrl = ($BaseUrl.TrimEnd("/") + $TracePath)

Write-Section "Promagen verify-health starting"
Write-Host ("RunId:        {0}" -f $runId)
Write-Host ("RepoRoot:     {0}" -f $repoRoot)
Write-Host ("FrontendRoot: {0}" -f $frontendRoot)
Write-Host ("Report:       {0}" -f $latestPath)
Write-Host ("BaseUrl:      {0}" -f $BaseUrl)
Write-Host ("FxUrl:        {0}" -f $FxUrl)
Write-Host ("TraceUrl:     {0}" -f $TraceUrl)
Write-Host ("PS:           {0}" -f $PSVersionTable.PSVersion)

$overallSw = [System.Diagnostics.Stopwatch]::StartNew()
$checks = @()
$scriptChecks = @()

# --------- pnpm checks ---------
Write-Section "Checks"

if (-not (Test-Path -LiteralPath $frontendRoot)) {
  $checks += New-CheckResult -Name "frontend.exists" -Status "fail" -DurationMs 0 -Message "frontend folder not found" -Extra @{ path = $frontendRoot }
} else {

  if ($SkipLint) {
    $checks += New-CheckResult -Name "lint" -Status "skip" -DurationMs 0 -Message "Skipped by flag"
  } else {
    Write-Host "Running pnpm run lint ..."
    $r = Invoke-CmdCapture -Command "pnpm run lint" -WorkingDirectory $frontendRoot -TimeoutSec $LintTimeoutSec -Label "lint"
    $msg = if ($r.ok) { "lint ok" } elseif ($r.timedOut) { "lint timed out" } else { "lint failed" }
    $extra = @{ exitCode = $r.exitCode; timedOut = $r.timedOut }
    if (-not [string]::IsNullOrWhiteSpace($r.stderr)) { $extra.stderr = $r.stderr.Trim() }
    $checks += New-CheckResult -Name "lint" -Status ($(if ($r.ok) { "ok" } else { "fail" })) -DurationMs $r.durationMs -Message $msg -Extra $extra
  }

  if ($SkipTypecheck) {
    $checks += New-CheckResult -Name "typecheck" -Status "skip" -DurationMs 0 -Message "Skipped by flag"
  } else {
    Write-Host "Running pnpm run typecheck ..."
    $r = Invoke-CmdCapture -Command "pnpm run typecheck" -WorkingDirectory $frontendRoot -TimeoutSec $TypecheckTimeoutSec -Label "typecheck"
    $msg = if ($r.ok) { "typecheck ok" } elseif ($r.timedOut) { "typecheck timed out" } else { "typecheck failed" }
    $extra = @{ exitCode = $r.exitCode; timedOut = $r.timedOut }
    if (-not [string]::IsNullOrWhiteSpace($r.stderr)) { $extra.stderr = $r.stderr.Trim() }
    $checks += New-CheckResult -Name "typecheck" -Status ($(if ($r.ok) { "ok" } else { "fail" })) -DurationMs $r.durationMs -Message $msg -Extra $extra
  }

  if ($SkipTests) {
    $checks += New-CheckResult -Name "tests" -Status "skip" -DurationMs 0 -Message "Skipped by flag"
  } else {
    Write-Host "Running pnpm run test:ci ..."
    $r = Invoke-CmdCapture -Command "pnpm run test:ci" -WorkingDirectory $frontendRoot -TimeoutSec $TestsTimeoutSec -Label "tests"
    $msg = if ($r.ok) { "tests ok" } elseif ($r.timedOut) { "tests timed out" } else { "tests failed" }
    $extra = @{ exitCode = $r.exitCode; timedOut = $r.timedOut }
    if (-not [string]::IsNullOrWhiteSpace($r.stderr)) { $extra.stderr = $r.stderr.Trim() }
    $checks += New-CheckResult -Name "tests" -Status ($(if ($r.ok) { "ok" } else { "fail" })) -DurationMs $r.durationMs -Message $msg -Extra $extra
  }
}

# --------- FX checks ---------
Write-Section "FX"

if ($SkipFx) {
  $checks += New-CheckResult -Name "fx" -Status "skip" -DurationMs 0 -Message "Skipped by flag"
} else {
  # Basic endpoint check
  $r = Invoke-Http -Url $FxUrl -TimeoutSec $HttpTimeoutSec
  if ($r.ok -and $r.statusCode -ge 200 -and $r.statusCode -lt 300) {
    $mode = $null
    $asOf = $null
    try {
      $j = $r.body | ConvertFrom-Json -ErrorAction Stop
      if ($null -ne $j.mode) { $mode = [string]$j.mode }
      if ($null -ne $j.asOf) { $asOf = [string]$j.asOf }
    } catch { }

    $extra = @{
      httpStatus = $r.statusCode
      mode = $mode
      asOf = $asOf
    }
    $checks += New-CheckResult -Name "fx.endpoint" -Status "ok" -DurationMs $r.durationMs -Message "FX endpoint ok" -Extra $extra
  } else {
    $extra = @{
      httpStatus = $r.statusCode
      error = $r.error
    }
    $checks += New-CheckResult -Name "fx.endpoint" -Status "fail" -DurationMs $r.durationMs -Message "FX endpoint failed" -Extra $extra
  }

  # Optional tool scripts, if present
  $toolDir = Join-Path $repoRoot "tools"

  $toolScripts = @(
    @{ name = "fx.headers"; path = (Join-Path $toolDir "fx-headers-check.ps1") },
    @{ name = "fx.calm";    path = (Join-Path $toolDir "fx-calm-check.ps1") },
    @{ name = "fx.load";    path = (Join-Path $toolDir "fx-load-test.ps1") }
  )

  foreach ($ts in $toolScripts) {
    $p = $ts.path
    if (-not (Test-Path -LiteralPath $p)) {
      $checks += New-CheckResult -Name $ts.name -Status "warn" -DurationMs 0 -Message "Script not found" -Extra @{ path = $p }
      continue
    }

    Write-Host ("Running {0} ..." -f $ts.name)
    $cmd = "pwsh -NoProfile -ExecutionPolicy Bypass -File `"$p`""

    # If the script supports -Url or -BaseUrl, pass it. (No guessing, we inspect parameters.)
    try {
      $gc = Get-Command -LiteralPath $p -ErrorAction Stop
      if ($gc.Parameters.ContainsKey("Url")) {
        $cmd = $cmd + " -Url `"$FxUrl`""
      } elseif ($gc.Parameters.ContainsKey("BaseUrl")) {
        $cmd = $cmd + " -BaseUrl `"$BaseUrl`""
      }
    } catch { }

    $rr = Invoke-CmdCapture -Command $cmd -WorkingDirectory $repoRoot -TimeoutSec 600 -Label $ts.name
    $msg = if ($rr.ok) { "ok" } elseif ($rr.timedOut) { "timed out" } else { "failed" }
    $extra = @{ exitCode = $rr.exitCode; timedOut = $rr.timedOut }
    if (-not [string]::IsNullOrWhiteSpace($rr.stderr)) { $extra.stderr = $rr.stderr.Trim() }
    $checks += New-CheckResult -Name $ts.name -Status ($(if ($rr.ok) { "ok" } else { "fail" })) -DurationMs $rr.durationMs -Message $msg -Extra $extra
    $scriptChecks += @{ name = $ts.name; path = $p; exitCode = $rr.exitCode; durationMs = $rr.durationMs }
  }
}

# --------- Compute overall ---------
$overallSw.Stop()

$hasFail = $false
$hasWarn = $false

foreach ($c in $checks) {
  if ($c.status -eq "fail") { $hasFail = $true }
  elseif ($c.status -eq "warn") { $hasWarn = $true }
}

$overallStatus = "ok"
if ($hasFail) { $overallStatus = "fail" }
elseif ($hasWarn) { $overallStatus = "warn" }

$be = Get-BannerAndEmoji -OverallStatus $overallStatus
$banner = $be.banner
$bannerEmoji = $be.emoji

# --------- Trend strip (last 10 runs) ---------
$prev = Safe-JsonRead -Path $latestPath
$prevRuns = @()
try {
  if ($null -ne $prev -and $null -ne $prev.runs) {
    foreach ($r in $prev.runs) { $prevRuns += $r }
  }
} catch { }

$newRun = @{
  at         = $generatedAt
  runId      = $runId
  status     = $overallStatus
  banner     = $banner
  emoji      = $bannerEmoji
  durationMs = [int]$overallSw.ElapsedMilliseconds
}

$runs = @($newRun)
foreach ($r in $prevRuns) { $runs += $r }
if ($runs.Count -gt 10) { $runs = $runs[0..9] }

# --------- Build report ---------
$report = @{
  schemaVersion = 1
  generatedAt   = $generatedAt
  runId         = $runId
  repoRoot      = $repoRoot
  frontendRoot  = $frontendRoot
  env           = @{
    nodeEnv   = $env:NODE_ENV
    vercelEnv = $env:VERCEL_ENV
    machine   = $env:COMPUTERNAME
    user      = $env:USERNAME
  }
  urls          = @{
    base  = $BaseUrl
    fx    = $FxUrl
    trace = $TraceUrl
  }
  overall       = @{
    status     = $overallStatus
    banner     = $banner
    emoji      = $bannerEmoji
    durationMs = [int]$overallSw.ElapsedMilliseconds
  }
  checks        = $checks
  scripts       = $scriptChecks
  runs          = $runs
}

# --------- Write report + exit code ---------
Write-Section "Report"
try {
  Safe-JsonWrite -Path $latestPath -Obj $report
  Write-Host ("Wrote {0}" -f $latestPath) -ForegroundColor Green
} catch {
  Write-Host ("Failed to write report: {0}" -f $_.Exception.Message) -ForegroundColor Red
}

Write-Section "Summary"
Write-Host ("Overall: {0} {1} (banner={2})" -f $overallStatus.ToUpperInvariant(), $bannerEmoji, $banner)

if ($overallStatus -eq "fail") { exit 1 }
exit 0
