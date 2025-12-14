# C:\Users\Proma\Projects\promagen\frontend\scripts\fx-load-test.ps1
#
# FX load test (PowerShell) — proves caching + TTL behaviour.
# Hits /api/fx N times and prints mode + asOf each time, then summarises unique asOf values.
#
# Usage (from frontend folder):
#   .\scripts\fx-load-test.ps1
#   .\scripts\fx-load-test.ps1 -Count 100 -DelayMs 0
#   .\scripts\fx-load-test.ps1 -Url "https://promagen.com/api/fx" -Count 25 -DelayMs 250

[CmdletBinding()]
param(
  [Parameter(Mandatory = $false)]
  [string]$Url = "http://localhost:3000/api/fx",

  [Parameter(Mandatory = $false)]
  [ValidateRange(1, 10000)]
  [int]$Count = 100,

  [Parameter(Mandatory = $false)]
  [ValidateRange(0, 60000)]
  [int]$DelayMs = 0
)

$ErrorActionPreference = "Stop"

Write-Host "FX load test starting..." -ForegroundColor Cyan
Write-Host "Url:     $Url"
Write-Host "Count:   $Count"
Write-Host "DelayMs: $DelayMs"
Write-Host ""

$results = @()

for ($i = 1; $i -le $Count; $i++) {
  $sw = [System.Diagnostics.Stopwatch]::StartNew()

  try {
    $r = Invoke-RestMethod -Uri $Url -Method GET
  } catch {
    $sw.Stop()
    Write-Host ("{0,4}  ERROR  {1}ms  {2}" -f $i, $sw.ElapsedMilliseconds, $_.Exception.Message) -ForegroundColor Red
    continue
  }

  $sw.Stop()

  $mode = $null
  $asOf = $null
  $provider = $null

  if ($null -ne $r -and $null -ne $r.meta) {
    $mode = $r.meta.mode
    $asOf = $r.meta.asOf
    $provider = $r.meta.sourceProvider
  }

  if ([string]::IsNullOrWhiteSpace($mode)) { $mode = "unknown" }
  if ([string]::IsNullOrWhiteSpace($asOf)) { $asOf = "unknown" }
  if ([string]::IsNullOrWhiteSpace($provider)) { $provider = "unknown" }

  $row = [pscustomobject]@{
    i        = $i
    ms       = $sw.ElapsedMilliseconds
    mode     = $mode
    asOf     = $asOf
    provider = $provider
  }

  $results += $row

  $colour = "Gray"
  if ($mode -eq "cached") { $colour = "Green" }
  elseif ($mode -eq "live") { $colour = "Yellow" }

  Write-Host ("{0,4}  {1,-7}  {2,5}ms  asOf={3}  provider={4}" -f $i, $mode, $sw.ElapsedMilliseconds, $asOf, $provider) -ForegroundColor $colour

  if ($DelayMs -gt 0) {
    Start-Sleep -Milliseconds $DelayMs
  }
}

Write-Host ""
Write-Host "Summary" -ForegroundColor Cyan
Write-Host "-------"

if ($results.Count -eq 0) {
  Write-Host "No results collected." -ForegroundColor Red
  exit 1
}

$uniqueAsOf = $results | Where-Object { $_.asOf -ne "unknown" } | Select-Object -ExpandProperty asOf -Unique
$uniqueAsOfCount = ($uniqueAsOf | Measure-Object).Count

$cachedCount = ($results | Where-Object { $_.mode -eq "cached" } | Measure-Object).Count
$liveCount = ($results | Where-Object { $_.mode -eq "live" } | Measure-Object).Count
$unknownCount = ($results | Where-Object { $_.mode -eq "unknown" } | Measure-Object).Count

$avgMs = [math]::Round((($results | Measure-Object -Property ms -Average).Average), 1)
$minMs = ($results | Measure-Object -Property ms -Minimum).Minimum
$maxMs = ($results | Measure-Object -Property ms -Maximum).Maximum

Write-Host ("Total hits:         {0}" -f $results.Count)
Write-Host ("Unique asOf values: {0}" -f $uniqueAsOfCount)
Write-Host ("Mode=live:          {0}" -f $liveCount)
Write-Host ("Mode=cached:        {0}" -f $cachedCount)
Write-Host ("Mode=unknown:       {0}" -f $unknownCount)
Write-Host ("Latency ms (avg):   {0}" -f $avgMs)
Write-Host ("Latency ms (min):   {0}" -f $minMs)
Write-Host ("Latency ms (max):   {0}" -f $maxMs)

Write-Host ""
Write-Host "Interpretation" -ForegroundColor Cyan
Write-Host "-------------"
Write-Host "If Unique asOf is 1 (or very small) while Total hits is large, you're not calling Twelve Data each time."
Write-Host "That is the API saving: one upstream fetch per TTL window + cached fan-out for the rest."
