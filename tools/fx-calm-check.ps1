<#
  Promagen FX Calm Check (PowerShell 5.1 friendly, JSON-safe)

  What it verifies:
    1) /api/fx returns meta (mode/provider/asOf) and looks cached on second call
    2) Cache headers present and TTL parseable
    3) Burst of requests does NOT increase trace.counters.upstreamCalls (single-flight + cache)
    4) /api/fx/trace exposes schedule + budgetIndicator + counters
    5) Violations are empty

  Why this version exists:
    PowerShell 5.1 Invoke-WebRequest can mis-decode UTF-8 JSON (especially emoji).
    Invoke-RestMethod is usually much more reliable for JSON parsing on Windows.

  Usage (run from repo root):
    powershell -ExecutionPolicy Bypass -File .\tools\fx-calm-check.ps1

  Optional:
    powershell -ExecutionPolicy Bypass -File .\tools\fx-calm-check.ps1 -BaseUrl "http://localhost:3000" -Burst 50 -SleepSeconds 2
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory = $false)]
  [string]$BaseUrl = "http://localhost:3000",

  [Parameter(Mandatory = $false)]
  [int]$SleepSeconds = 2,

  [Parameter(Mandatory = $false)]
  [int]$Burst = 20,

  [Parameter(Mandatory = $false)]
  [int]$TimeoutSec = 20,

  [Parameter(Mandatory = $false)]
  [switch]$NoColour
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$FxUrl    = ($BaseUrl.TrimEnd("/") + "/api/fx")
$TraceUrl = ($BaseUrl.TrimEnd("/") + "/api/fx/trace")

function Write-Heading {
  param([string]$Text)
  if ($NoColour) {
    Write-Host ""
    Write-Host "=== $Text ==="
    return
  }
  Write-Host ""
  Write-Host "=== $Text ===" -ForegroundColor Cyan
}

function Write-Status {
  param(
    [string]$Label,
    [bool]$Ok,
    [string]$Detail
  )
  $tag = if ($Ok) { "PASS" } else { "FAIL" }
  if ($NoColour) {
    Write-Host ("[{0}] {1} - {2}" -f $tag, $Label, $Detail)
    return
  }
  $colour = if ($Ok) { "Green" } else { "Red" }
  Write-Host ("[{0}] {1} - {2}" -f $tag, $Label, $Detail) -ForegroundColor $colour
}

function Try-GetProp {
  param([object]$Obj, [string]$Name)
  if ($null -eq $Obj) { return $null }
  $p = $Obj.PSObject.Properties | Where-Object { $_.Name -eq $Name } | Select-Object -First 1
  if ($null -eq $p) { return $null }
  return $p.Value
}

function Invoke-WebRequestSafe {
  param([string]$Uri)

  $iwr = Get-Command Invoke-WebRequest -ErrorAction Stop
  $common = @{
    Uri         = $Uri
    Method      = "GET"
    TimeoutSec  = $TimeoutSec
    ErrorAction = "Stop"
    Headers     = @{ "Accept" = "application/json" }
  }

  $hasBasic = $iwr.Parameters.ContainsKey("UseBasicParsing")
  if ($hasBasic) {
    return Invoke-WebRequest @common -UseBasicParsing
  }
  return Invoke-WebRequest @common
}

function Invoke-RestMethodSafe {
  param([string]$Uri)
  return Invoke-RestMethod -Uri $Uri -Method GET -TimeoutSec $TimeoutSec -ErrorAction Stop -Headers @{ "Accept" = "application/json" }
}

function Get-JsonAndHeaders {
  param([string]$Uri)

  # One call for headers (reliable), one for JSON (reliable in PS 5.1).
  $h = Invoke-WebRequestSafe -Uri $Uri
  $j = Invoke-RestMethodSafe -Uri $Uri

  return [pscustomobject]@{
    Uri        = $Uri
    StatusCode = $h.StatusCode
    Headers    = $h.Headers
    Json       = $j
  }
}

function Get-CacheControlTtlSeconds {
  param([object]$Headers)
  if ($null -eq $Headers) { return $null }
  $cc = $Headers["Cache-Control"]
  if ([string]::IsNullOrWhiteSpace($cc)) { return $null }

  $m = [regex]::Match($cc, 's-maxage=(\d+)', "IgnoreCase")
  if ($m.Success) { return [int]$m.Groups[1].Value }

  $m2 = [regex]::Match($cc, 'max-age=(\d+)', "IgnoreCase")
  if ($m2.Success) { return [int]$m2.Groups[1].Value }

  return $null
}

function Print-InterestingHeaders {
  param([object]$Headers)
  $keys = @(
    "Cache-Control",
    "CDN-Cache-Control",
    "Surrogate-Control",
    "Age",
    "ETag",
    "Vary",
    "Date",
    "Content-Type"
  )

  Write-Host ""
  Write-Host "Headers (interesting bits):"
  foreach ($k in $keys) {
    $v = $Headers[$k]
    if (-not [string]::IsNullOrWhiteSpace($v)) {
      Write-Host ("  {0}: {1}" -f $k, $v)
    }
  }
}

function Get-TraceCounter {
  param([object]$TraceJson, [string]$CounterName)
  $counters = Try-GetProp -Obj $TraceJson -Name "counters"
  if ($null -eq $counters) { return $null }
  $v = Try-GetProp -Obj $counters -Name $CounterName
  if ($null -eq $v) { return $null }
  try { return [int]$v } catch { return $null }
}

function Collect-Violations {
  param([object]$TraceJson)

  $all = @()

  $top = Try-GetProp -Obj $TraceJson -Name "violations"
  if ($null -ne $top) { $all += @($top) }

  $lastFetch = Try-GetProp -Obj $TraceJson -Name "lastFetch"
  if ($null -ne $lastFetch) {
    $vf = Try-GetProp -Obj $lastFetch -Name "violations"
    if ($null -ne $vf) { $all += @($vf) }
  }

  return @($all)
}

Write-Heading "Promagen FX Calm Check (IRM JSON-safe)"
Write-Host ("PowerShell: {0}" -f $PSVersionTable.PSVersion)
Write-Host ("BaseUrl:    {0}" -f $BaseUrl)
Write-Host ("FX:         {0}" -f $FxUrl)
Write-Host ("Trace:      {0}" -f $TraceUrl)

# 1) TTL cache sanity (two calls)
Write-Heading "1) TTL cache sanity (two calls)"
$r1 = Get-JsonAndHeaders -Uri $FxUrl
Start-Sleep -Seconds $SleepSeconds
$r2 = Get-JsonAndHeaders -Uri $FxUrl

$meta1 = Try-GetProp -Obj $r1.Json -Name "meta"
$meta2 = Try-GetProp -Obj $r2.Json -Name "meta"

$mode1  = Try-GetProp -Obj $meta1 -Name "mode"
$mode2  = Try-GetProp -Obj $meta2 -Name "mode"
$prov1  = Try-GetProp -Obj $meta1 -Name "sourceProvider"
$prov2  = Try-GetProp -Obj $meta2 -Name "sourceProvider"
$asOf1  = Try-GetProp -Obj $meta1 -Name "asOf"
$asOf2  = Try-GetProp -Obj $meta2 -Name "asOf"
$cached2 = Try-GetProp -Obj $meta2 -Name "cached"

Write-Host ("Call1: mode={0} provider={1} asOf={2}" -f $mode1, $prov1, $asOf1)
Write-Host ("Call2: mode={0} provider={1} asOf={2}" -f $mode2, $prov2, $asOf2)

$jsonParsed = ($null -ne $r2.Json)
Write-Status -Label "JSON parsed" -Ok $jsonParsed -Detail ("status={0}" -f $r2.StatusCode)

$call2Cached = (
  ($cached2 -eq $true) -or
  ($null -ne $mode2 -and $mode2.ToString().ToLower().Contains("cached")) -or
  ($null -ne $prov2 -and $prov2.ToString().ToLower().Contains("cache"))
)

$asOfStable = ($null -ne $asOf1 -and $null -ne $asOf2 -and ($asOf1.ToString() -eq $asOf2.ToString()))

Write-Status -Label "Call2 served from cache" -Ok $call2Cached -Detail ("cached={0} mode={1} provider={2}" -f $cached2, $mode2, $prov2)
Write-Status -Label "asOf stable within short interval" -Ok $asOfStable -Detail ("asOf1={0} asOf2={1}" -f $asOf1, $asOf2)

# 2) Cache headers
Write-Heading "2) Cache headers (CDN honest)"
Print-InterestingHeaders -Headers $r2.Headers

$ttl = Get-CacheControlTtlSeconds -Headers $r2.Headers
$cc = $r2.Headers["Cache-Control"]
Write-Status -Label "Cache-Control present" -Ok (-not [string]::IsNullOrWhiteSpace($cc)) -Detail $cc

if ($null -ne $ttl) {
  Write-Status -Label "TTL parseable from headers" -Ok $true -Detail ("ttlSeconds={0}" -f $ttl)
} else {
  Write-Status -Label "TTL parseable from headers" -Ok $false -Detail "Could not parse s-maxage/max-age"
}

# 3) Single-flight burst test
Write-Heading "3) Single-flight burst test"
$tb = (Get-JsonAndHeaders -Uri $TraceUrl).Json

$beforeUp = Get-TraceCounter -TraceJson $tb -CounterName "upstreamCalls"
Write-Host ("Trace counters (before): upstreamCalls={0}" -f $beforeUp)

$jobs = 1..$Burst | ForEach-Object {
  Start-Job -ArgumentList $FxUrl, $TimeoutSec -ScriptBlock {
    param($url, $timeout)
    try { Invoke-RestMethod -Uri $url -Method Get -TimeoutSec $timeout | Out-Null } catch {}
  }
}
$jobs | Wait-Job | Out-Null
$jobs | Remove-Job | Out-Null

$ta = (Get-JsonAndHeaders -Uri $TraceUrl).Json
$afterUp = Get-TraceCounter -TraceJson $ta -CounterName "upstreamCalls"
Write-Host ("Trace counters (after):  upstreamCalls={0}" -f $afterUp)

if ($null -ne $beforeUp -and $null -ne $afterUp) {
  $deltaUp = $afterUp - $beforeUp
  $okSingleFlight = ($deltaUp -le 1)
  Write-Status -Label "Burst caused <= 1 upstream refresh" -Ok $okSingleFlight -Detail ("deltaUpstreamCalls={0} (burst={1})" -f $deltaUp, $Burst)
} else {
  Write-Status -Label "Burst caused <= 1 upstream refresh" -Ok $false -Detail "Missing trace.counters.upstreamCalls (or not numeric)"
}

# 4) Schedule + violations
Write-Heading "4) Schedule + violations"
$schedule = Try-GetProp -Obj $ta -Name "schedule"
if ($null -ne $schedule) {
  $cycleIndex = Try-GetProp -Obj $schedule -Name "cycleIndex"
  $group      = Try-GetProp -Obj $schedule -Name "scheduledGroup"
  $cycleLen   = Try-GetProp -Obj $schedule -Name "cycleLengthSeconds"
  $cycleDue   = Try-GetProp -Obj $schedule -Name "cycleDue"
  Write-Host ("schedule.cycleIndex={0} group={1} cycleLengthSeconds={2} cycleDue={3}" -f $cycleIndex, $group, $cycleLen, $cycleDue)
  Write-Status -Label "Schedule present" -Ok $true -Detail "trace.schedule detected"
} else {
  Write-Status -Label "Schedule present" -Ok $false -Detail "trace.schedule not found"
}

$violations = Collect-Violations -TraceJson $ta
$violCount = 0
try { $violCount = @($violations).Count } catch { $violCount = 0 }

if ($violCount -gt 0) {
  Write-Status -Label "Trace violations" -Ok $false -Detail ("{0} violation(s) present" -f $violCount)
  Write-Host "Violations:"
  @($violations) | ForEach-Object {
    $id  = Try-GetProp -Obj $_ -Name "id"
    $msg = Try-GetProp -Obj $_ -Name "message"
    $lvl = Try-GetProp -Obj $_ -Name "level"
    Write-Host ("  - [{0}] {1}: {2}" -f $lvl, $id, $msg)
  }
} else {
  Write-Status -Label "Trace violations" -Ok $true -Detail "None"
}

# 5) Budget indicator
Write-Heading "5) Budget indicator"
$budgetIndicator = Try-GetProp -Obj $ta -Name "budgetIndicator"
if ($null -ne $budgetIndicator) {
  $state = Try-GetProp -Obj $budgetIndicator -Name "state"
  $emoji = Try-GetProp -Obj $budgetIndicator -Name "emoji"
  Write-Host ("budgetIndicator.state={0} emoji={1}" -f $state, $emoji)
  Write-Status -Label "Budget indicator present" -Ok $true -Detail ("state={0} emoji={1}" -f $state, $emoji)
} else {
  Write-Status -Label "Budget indicator present" -Ok $false -Detail "trace.budgetIndicator not found"
}

Write-Heading "Done"

if ($violCount -gt 0) { exit 1 }
exit 0
