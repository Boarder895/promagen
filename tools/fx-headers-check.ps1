<# 
  Promagen FX Headers + Calm Check
  - PowerShell 5.1+ compatible
  - Uses Invoke-WebRequest with -UseBasicParsing on Windows PowerShell to avoid the HTML/script warning prompt
  - Calls:
      /api/fx
      /api/fx/trace
  - Prints key headers (Cache-Control etc), meta, lastDecision, and upstream counters
  - Runs a burst test and verifies upstreamCalls does NOT climb with every request
#>

[CmdletBinding()]
param(
  [string]$BaseUrl = "http://localhost:3000",
  [int]$GapSeconds = 2,
  [int]$BurstCount = 20,
  [int]$BurstDelayMs = 50,
  [int]$AllowedUpstreamDeltaDuringBurst = 1
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Section {
  param([string]$Title)
  Write-Host ""
  Write-Host ("=== " + $Title + " ===") -ForegroundColor Cyan
}

function Invoke-WebRequestSafe {
  param([string]$Uri)

  # Windows PowerShell 5.1 throws the "Script Execution Risk" prompt unless -UseBasicParsing is used.
  if ($PSVersionTable.PSVersion.Major -lt 6) {
    return Invoke-WebRequest -UseBasicParsing -Uri $Uri -Method Get
  }

  return Invoke-WebRequest -Uri $Uri -Method Get
}

function ConvertFrom-JsonSafe {
  param([string]$Text, [string]$UriForErrors, [string]$ContentType)

  if ($null -eq $Text) { $Text = "" }

  # Strip UTF-8 BOM if present
  if ($Text.Length -gt 0 -and $Text[0] -eq [char]0xFEFF) {
    $Text = $Text.Substring(1)
  }

  try {
    # PS 5.1: ConvertFrom-Json has no -Depth parameter. Keep it plain.
    return ($Text | ConvertFrom-Json)
  } catch {
    $msg = $_.Exception.Message
    $sampleLen = [Math]::Min(240, $Text.Length)
    $sampleHead = if ($sampleLen -gt 0) { $Text.Substring(0, $sampleLen) } else { "" }
    throw "JSON parse failed for $UriForErrors. Content-Type='$ContentType'. Error='$msg'. First chars: $sampleHead"
  }
}

function Get-JsonFromUrl {
  param([string]$Uri)

  $resp = Invoke-WebRequestSafe -Uri $Uri

  if ($null -ne $resp.StatusCode -and $resp.StatusCode -ne 200) {
    throw "HTTP $($resp.StatusCode) from $Uri"
  }

  $contentType = $resp.Headers["Content-Type"]
  if (-not $contentType) { $contentType = "" }

  $json = ConvertFrom-JsonSafe -Text ([string]$resp.Content) -UriForErrors $Uri -ContentType $contentType

  return [pscustomobject]@{
    Response = $resp
    Json     = $json
  }
}

function Get-CacheControlSeconds {
  param([string]$CacheControl)

  if ([string]::IsNullOrWhiteSpace($CacheControl)) {
    return $null
  }

  # Look for s-maxage=NNN
  $m = [regex]::Match($CacheControl, "s-maxage=(\d+)")
  if ($m.Success) {
    return [int]$m.Groups[1].Value
  }

  return $null
}

function Get-Prop {
  param(
    $Obj,
    [string]$Name
  )

  if ($null -eq $Obj) { return $null }
  $p = $Obj.PSObject.Properties[$Name]
  if ($null -eq $p) { return $null }
  return $p.Value
}

$root = $BaseUrl.TrimEnd("/")
$fxUrl = "$root/api/fx"
$traceUrl = "$root/api/fx/trace"

Write-Host "Promagen FX Headers + Calm Check" -ForegroundColor Green
Write-Host ("PowerShell: {0}" -f $PSVersionTable.PSVersion.ToString())
Write-Host ("FX:    {0}" -f $fxUrl)
Write-Host ("Trace: {0}" -f $traceUrl)

$failCount = 0
function Fail {
  param([string]$Msg)
  $script:failCount++
  Write-Host ("[FAIL] " + $Msg) -ForegroundColor Red
}
function Pass {
  param([string]$Msg)
  Write-Host ("[PASS] " + $Msg) -ForegroundColor Green
}
function Info {
  param([string]$Msg)
  Write-Host ("[INFO] " + $Msg) -ForegroundColor DarkGray
}

Write-Section "1) Call FX + Trace (two calls, short gap)"

$fx1 = Get-JsonFromUrl -Uri $fxUrl
$t1  = Get-JsonFromUrl -Uri $traceUrl

Start-Sleep -Seconds $GapSeconds

$fx2 = Get-JsonFromUrl -Uri $fxUrl
$t2  = Get-JsonFromUrl -Uri $traceUrl

# Headers (from /api/fx response)
$cc = $fx2.Response.Headers["Cache-Control"]
$ttl = Get-CacheControlSeconds -CacheControl $cc

Info ("Cache-Control: {0}" -f $cc)
if ($null -ne $ttl) {
  Pass ("Cache TTL parsable from headers: s-maxage={0}s" -f $ttl)
} else {
  Fail "Cache-Control missing s-maxage=... (CDN caching may not be configured as intended)"
}

# FX meta
$meta2 = Get-Prop -Obj $fx2.Json -Name "meta"
$mode2 = Get-Prop -Obj $meta2 -Name "mode"
$prov2 = Get-Prop -Obj $meta2 -Name "sourceProvider"
$asOf2 = Get-Prop -Obj $meta2 -Name "asOf"

Info ("FX meta: mode={0} provider={1} asOf={2}" -f $mode2, $prov2, $asOf2)

if ([string]::IsNullOrWhiteSpace([string]$mode2)) { Fail "FX meta.mode missing" } else { Pass "FX meta.mode present" }
if ([string]::IsNullOrWhiteSpace([string]$prov2)) { Fail "FX meta.sourceProvider missing" } else { Pass "FX meta.sourceProvider present" }
if ([string]::IsNullOrWhiteSpace([string]$asOf2)) { Fail "FX meta.asOf missing" } else { Pass "FX meta.asOf present" }

# Trace essentials
$lastDecision2 = Get-Prop -Obj $t2.Json -Name "lastDecision"
$counters2 = Get-Prop -Obj $t2.Json -Name "counters"
$up2 = Get-Prop -Obj $counters2 -Name "upstreamCalls"
$rl2 = Get-Prop -Obj $t2.Json -Name "rateLimit"
$isLimited2 = Get-Prop -Obj $rl2 -Name "isLimited"

Info ("Trace: lastDecision={0} upstreamCalls={1} rateLimited={2}" -f $lastDecision2, $up2, $isLimited2)

if ([string]::IsNullOrWhiteSpace([string]$lastDecision2)) { Fail "Trace lastDecision missing" } else { Pass "Trace lastDecision present" }
if ($null -eq $up2) { Fail "Trace counters.upstreamCalls missing" } else { Pass "Trace counters.upstreamCalls present" }

# Budget indicator
$budgetIndicator = Get-Prop -Obj $t2.Json -Name "budgetIndicator"
$biState = Get-Prop -Obj $budgetIndicator -Name "state"
$biEmoji = Get-Prop -Obj $budgetIndicator -Name "emoji"
if ([string]::IsNullOrWhiteSpace([string]$biState) -or [string]::IsNullOrWhiteSpace([string]$biEmoji)) {
  Fail "Trace budgetIndicator missing state/emoji"
} else {
  Pass ("Trace budgetIndicator present: state={0} emoji={1}" -f $biState, $biEmoji)
}

Write-Section "2) Burst test (prove upstreamCalls doesn't climb with spam)"

# Get starting upstreamCalls
$tBefore = Get-JsonFromUrl -Uri $traceUrl
$upBefore = Get-Prop -Obj (Get-Prop -Obj $tBefore.Json -Name "counters") -Name "upstreamCalls"
if ($null -eq $upBefore) { $upBefore = 0 }

Info ("Upstream calls (before burst): {0}" -f $upBefore)

for ($i = 1; $i -le $BurstCount; $i++) {
  $null = Invoke-WebRequestSafe -Uri $fxUrl
  Start-Sleep -Milliseconds $BurstDelayMs
}

$tAfter = Get-JsonFromUrl -Uri $traceUrl
$upAfter = Get-Prop -Obj (Get-Prop -Obj $tAfter.Json -Name "counters") -Name "upstreamCalls"
if ($null -eq $upAfter) { $upAfter = $upBefore }

$delta = [int]$upAfter - [int]$upBefore
Info ("Upstream calls (after burst):  {0}" -f $upAfter)
Info ("Upstream delta during burst:   {0}" -f $delta)

if ($delta -le $AllowedUpstreamDeltaDuringBurst) {
  Pass ("Burst calm OK: upstreamCalls delta <= {0}" -f $AllowedUpstreamDeltaDuringBurst)
} else {
  Fail ("Burst NOT calm: upstreamCalls jumped by {0} (expected <= {1})" -f $delta, $AllowedUpstreamDeltaDuringBurst)
}

# Rate limit warning (not always fatal, but important)
$rlAfter = Get-Prop -Obj $tAfter.Json -Name "rateLimit"
$isLimitedAfter = Get-Prop -Obj $rlAfter -Name "isLimited"
$untilAfter = Get-Prop -Obj $rlAfter -Name "until"
if ($isLimitedAfter -eq $true) {
  Fail ("Rate limit active (until {0})" -f $untilAfter)
} else {
  Pass "Rate limit not active"
}

Write-Section "Result"

if ($failCount -gt 0) {
  Write-Host ("FAILED with {0} issue(s)." -f $failCount) -ForegroundColor Red
  exit 1
}

Write-Host "ALL CHECKS PASSED." -ForegroundColor Green
exit 0
