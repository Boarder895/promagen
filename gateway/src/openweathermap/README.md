# OpenWeatherMap Module

> **Promagen Gateway** — Weather data feed for exchange + provider cities  
> **Provider:** OpenWeatherMap (api.openweathermap.org)  
> **Status:** Production-ready  
> **Security:** 10/10  
> **Version:** 3.1.0 (21 Feb 2026)

---

## Overview

This module provides real-time weather data for all 84 exchange cities and 10 AI provider HQ cities in the Promagen catalog. Weather data influences Gallery Mode prompt generation (rain→moody, snow→serene, clear→vibrant) and powers provider flag tooltips.

## v3.1.0 Changes

- **Provider HQ cities**: 10 new cities added via /api/weather/config for AI provider weather tooltips
- **No code changes**: Fully data-driven. Gateway handles 94 entries identically to 89.
- **Budget impact**: 552 calls/day (55.2%) — up from 498 (49.8%). Well within limits.
- **MAX_CITIES_PER_BATCH**: Raised from 24 → 28 for headroom (actual batch size: ~23).

## v3.0.0 Changes

- **4-batch rotation** (was 2-batch alternation): A→B→C→D via `hour % 4`
- **Coordinate deduplication**: 94 entries → 92 unique API calls (Mumbai ×2→1, Frankfurt ×2→1)
- **Single slot** at `:10` (dropped `:40`) — one batch per hour
- **Selected-16 in Batch A**: All 16 homepage default exchanges guaranteed in first batch
- **Results expanded**: After fetching 92 representative cities, data is cloned to all 94 entry IDs

## Budget Strategy

| Metric | Value | Notes |
|--------|-------|-------|
| Daily Limit | 1,000 calls | Free tier |
| Minute Limit | 60 calls | Burst protection |
| Total Entries | 94 | 84 exchange + 10 provider |
| Unique Locations | 92 | After coordinate dedup |
| Dedup Savings | 2 per cycle | Mumbai, Frankfurt |
| Batch Size | ~23 cities | Fits well within minute limit |
| Refresh Frequency | Every 4 hours per batch | 6× per day per batch |
| **Expected Daily Usage** | **552 calls** | **55.2% of budget** |
| **Headroom** | **448 calls** | **44.8% buffer** |

## Batch Distribution

| Batch | Cities | Composition | Refresh Hours (UTC) |
|-------|--------|-------------|---------------------|
| A | 23 | 16 selected + 7 fill | 0, 4, 8, 12, 16, 20 |
| B | 23 | Remaining group 1 | 1, 5, 9, 13, 17, 21 |
| C | 23 | Remaining group 2 | 2, 6, 10, 14, 18, 22 |
| D | 23 | Remaining group 3 | 3, 7, 11, 15, 19, 23 |

## Coordinate Deduplication

Entries at identical coordinates share a single API call:

| City | Entries | API Calls | Savings |
|------|---------|-----------|---------|
| Mumbai | bse-mumbai, nse-mumbai | 1 | 1 |
| Frankfurt | xetra-frankfurt, xfra-frankfurt | 1 | 1 |
| **Total** | **4 entries** | **2 calls** | **2 saved** |

After fetching weather for the representative city, results are expanded (cloned) to all entry IDs at that coordinate. The cache stores all 94 entries so any query by ID finds data.

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
Hour  0 → Batch A (23 cities including 16 selected)
Hour  1 → Batch B (23 cities)
Hour  2 → Batch C (23 cities)
Hour  3 → Batch D (23 cities)
Hour  4 → Batch A (refreshed, 4h since last)
Hour  5 → Batch B
...
Hour 23 → Batch D
```

## Verification

```powershell
# Check weather SSOT (should return 94 cities)
(Invoke-RestMethod "https://promagen.com/api/weather/config").cities.Count

# Check gateway trace (should show uniqueLocations: 92, deduplicatedSavings: 2)
(Invoke-RestMethod "https://promagen-api.fly.dev/trace").weather

# Check weather data count (should reach 94 after all 4 batches have run)
(Invoke-RestMethod "https://promagen-api.fly.dev/weather").data.Count

# Check budget usage
(Invoke-RestMethod "https://promagen-api.fly.dev/trace").weather.budget
```

## Architecture

```
Frontend SSOT                    Gateway
─────────────────                ─────────────────────────
/api/weather/config  ──────────► initWeatherHandler()
 ├─ 94 cities (84+10)           ├─ buildCoordGroups()     → 92 unique
 ├─ selectedExchangeIds (all)    ├─ splitIntoBatches()     → A(23) B(23) C(23) D(23)
 └─ freeDefaultIds (16)          └─ startBackgroundRefresh()

Every hour at :10:
 getCurrentBatch()               → hour % 4 → A/B/C/D
 fetchWeatherBatch(~23 reps)     → 23 API calls
 expandToAllExchangeIds()        → 23 → ~24 (dedup expansion)
 mergeWeatherData()              → cache stores all 94 entries
```
