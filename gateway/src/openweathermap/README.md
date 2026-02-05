# OpenWeatherMap Module

> **Promagen Gateway** — Weather data feed for exchange cities  
> **Provider:** OpenWeatherMap (api.openweathermap.org)  
> **Status:** Production-ready  
> **Security:** 10/10  
> **Version:** 3.0.0 (01 Feb 2026)

---

## Overview

This module provides real-time weather data for all 89 exchange cities in the Promagen catalog. Weather data influences Gallery Mode prompt generation (rain→moody, snow→serene, clear→vibrant).

## v3.0.0 Changes

- **4-batch rotation** (was 2-batch alternation): A→B→C→D via `hour % 4`
- **Coordinate deduplication**: 89 exchanges → 83 unique API calls (Mumbai ×4→1, Moscow ×2→1, Zurich ×2→1, Frankfurt ×2→1)
- **Single slot** at `:10` (dropped `:40`) — one batch per hour
- **Selected-16 in Batch A**: All 16 homepage default exchanges guaranteed in first batch
- **Results expanded**: After fetching 83 representative cities, data is cloned to all 89 exchange IDs

## Budget Strategy

| Metric | Value | Notes |
|--------|-------|-------|
| Daily Limit | 1,000 calls | Free tier |
| Minute Limit | 60 calls | Burst protection |
| Total Exchanges | 89 | From exchange catalog |
| Unique Locations | 83 | After coordinate dedup |
| Dedup Savings | 6 per cycle | Mumbai, Moscow, Zurich, Frankfurt |
| Batch Size | ~21 cities | Fits well within minute limit |
| Refresh Frequency | Every 4 hours per batch | 6× per day per batch |
| **Expected Daily Usage** | **498 calls** | **49.8% of budget** |
| **Headroom** | **502 calls** | **50.2% buffer** |

## Batch Distribution

| Batch | Cities | Composition | Refresh Hours (UTC) |
|-------|--------|-------------|---------------------|
| A | 21 | 16 selected + 5 fill | 0, 4, 8, 12, 16, 20 |
| B | 21 | Remaining group 1 | 1, 5, 9, 13, 17, 21 |
| C | 21 | Remaining group 2 | 2, 6, 10, 14, 18, 22 |
| D | 20 | Remaining group 3 | 3, 7, 11, 15, 19, 23 |

## Coordinate Deduplication

Exchanges at identical coordinates share a single API call:

| City | Exchanges | API Calls | Savings |
|------|-----------|-----------|---------|
| Mumbai | bse-mumbai, nse-mumbai, xbom-mumbai, xnse-mumbai | 1 | 3 |
| Moscow | misx-moscow, moex-moscow | 1 | 1 |
| Zurich | six-zurich, xswx-zurich | 1 | 1 |
| Frankfurt | xetra-frankfurt, xfra-frankfurt | 1 | 1 |
| **Total** | **10 exchanges** | **4 calls** | **6 saved** |

After fetching weather for the representative city, results are expanded (cloned) to all exchange IDs at that coordinate. The cache stores all 89 entries so any query by exchange ID finds data.

## Clock-Aligned Scheduling

```
Hour timeline (every hour, single slot at :10):
┌────┬────┬────┬────┬────┬────┬────┬────┬────┐
│:00 │:05 │:10 │:20 │:30 │:35 │    │:50 │:00 │
├────┼────┼────┼────┼────┼────┼────┼────┼────┤
│ FX │IDX │WTH │CRY │ FX │IDX │    │CRY │ FX │
└────┴────┴────┴────┴────┴────┴────┴────┴────┘
  ↑    ↑    ↑    ↑    ↑    ↑         ↑
  TD   MS   OWM  TD   TD   MS        TD

TD  = TwelveData (FX, Crypto)
MS  = Marketstack (Indices)
OWM = OpenWeatherMap (Weather) — :10 only
```

The `:40` slot is now freed and available for future feeds.

## Batch Rotation

```
Hour  0 → Batch A (21 cities including 16 selected)
Hour  1 → Batch B (21 cities)
Hour  2 → Batch C (21 cities)
Hour  3 → Batch D (20 cities)
Hour  4 → Batch A (refreshed, 4h since last)
Hour  5 → Batch B
...
Hour 23 → Batch D
```

## Verification

```powershell
# Check weather SSOT (should return 89 cities)
(Invoke-RestMethod "https://promagen.com/api/weather/config").cities.Count

# Check gateway trace (should show uniqueLocations: 83, deduplicatedSavings: 6)
(Invoke-RestMethod "https://promagen-api.fly.dev/trace").weather

# Check weather data count (should reach 89 after all 4 batches have run)
(Invoke-RestMethod "https://promagen-api.fly.dev/weather").data.Count

# Check budget usage
(Invoke-RestMethod "https://promagen-api.fly.dev/trace").weather.budget
```

## Architecture

```
Frontend SSOT                    Gateway
─────────────────                ─────────────────────────
/api/weather/config  ──────────► initWeatherHandler()
 ├─ 89 cities                    ├─ buildCoordGroups()     → 83 unique
 ├─ selectedExchangeIds (all)    ├─ splitIntoBatches()     → A(21) B(21) C(21) D(20)
 └─ freeDefaultIds (16)          └─ startBackgroundRefresh()

Every hour at :10:
 getCurrentBatch()               → hour % 4 → A/B/C/D
 fetchWeatherBatch(~21 reps)     → 21 API calls
 expandToAllExchangeIds()        → 21 → ~25 (dedup expansion)
 mergeWeatherData()              → cache stores all 89 entries
```
