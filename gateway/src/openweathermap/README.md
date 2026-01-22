# OpenWeatherMap Module

> **Promagen Gateway** — Weather data feed for exchange cities  
> **Provider:** OpenWeatherMap (api.openweathermap.org)  
> **Status:** Production-ready  
> **Security:** 10/10

---

## Overview

This module provides real-time weather data for all 48 exchange cities in the Promagen catalog. Weather data influences Gallery Mode prompt generation (rain→moody, snow→serene, clear→vibrant).

## Budget Strategy

| Metric | Value | Notes |
|--------|-------|-------|
| Daily Limit | 1,000 calls | Free tier |
| Minute Limit | 60 calls | Burst protection |
| Total Cities | 48 | From exchange catalog |
| Batch Size | 24 cities | Fits within minute limit |
| Refresh Frequency | Hourly per batch | Alternating A/B |
| **Expected Daily Usage** | **576 calls** | 57.6% of budget |
| **Headroom** | **424 calls** | 42.4% buffer |

## Batch Alternation

Cities are split into two batches:

- **Batch A (Priority):** 24 cities including all 16 selected exchanges
- **Batch B (Remaining):** 24 cities (remaining from catalog)

Batches alternate hourly:
- Odd hours (1, 3, 5, ..., 23 UTC): Batch A
- Even hours (0, 2, 4, ..., 22 UTC): Batch B

Each city gets fresh data every 2 hours — acceptable for weather.

## Clock-Aligned Scheduling

Weather slots are offset from other feeds to prevent API congestion:

```
Hour timeline:
┌────┬────┬────┬────┬────┬────┬────┬────┬────┐
│:00 │:05 │:10 │:20 │:30 │:35 │:40 │:50 │:00 │
├────┼────┼────┼────┼────┼────┼────┼────┼────┤
│ FX │IDX │WTH │CRY │ FX │IDX │WTH │CRY │ FX │
└────┴────┴────┴────┴────┴────┴────┴────┴────┘
  ↑    ↑    ↑    ↑    ↑    ↑    ↑    ↑
  TD   MS   OWM  TD   TD   MS   OWM  TD

TD  = TwelveData (FX, Crypto)
MS  = Marketstack (Indices)
OWM = OpenWeatherMap (Weather)
```

Weather refreshes at **:10** and **:40** — offset from all other feeds.

## Files

| File | Purpose |
|------|---------|
| `types.ts` | Type definitions for weather data |
| `budget.ts` | 1000/day, 60/min budget tracking |
| `scheduler.ts` | Clock-aligned scheduling with batch alternation |
| `adapter.ts` | OWM response → Promagen format |
| `weather.ts` | API fetch logic with retry |
| `index.ts` | Module exports |

## Environment Variables

```bash
# Required
OPENWEATHERMAP_API_KEY=your_api_key_here

# Optional (with defaults)
OPENWEATHERMAP_BUDGET_DAILY=1000
OPENWEATHERMAP_BUDGET_MINUTE=60
WEATHER_TTL_SECONDS=3600
```

## API Endpoint

**Gateway:** `GET /weather`

**Response:**
```json
{
  "meta": {
    "mode": "cached",
    "cachedAt": "2026-01-19T10:10:00Z",
    "expiresAt": "2026-01-19T11:10:00Z",
    "provider": "openweathermap",
    "currentBatch": "A",
    "batchARefreshedAt": "2026-01-19T10:10:00Z",
    "batchBRefreshedAt": "2026-01-19T09:10:00Z",
    "budget": {
      "state": "ok",
      "dailyUsed": 48,
      "dailyLimit": 1000,
      "minuteUsed": 0,
      "minuteLimit": 60
    }
  },
  "data": [
    {
      "id": "nyse-new-york",
      "city": "New York",
      "temperatureC": 12.5,
      "temperatureF": 54.5,
      "conditions": "Clear",
      "description": "clear sky",
      "humidity": 65,
      "windSpeedKmh": 18,
      "emoji": "☀️",
      "asOf": "2026-01-19T10:10:00Z"
    }
  ]
}
```

## Fallback Behaviour

Following the stale-while-revalidate pattern (same as indices):

1. **Fresh cache** → Return immediately
2. **Circuit breaker open / budget blocked** → Return stale (last-known-good)
3. **API failure** → Return stale (last-known-good)
4. **No data ever cached** → Return empty array (renders as "—")

**CRITICAL:** No demo/synthetic data. Either real API data or nothing.

## Security Measures

| Measure | Implementation |
|---------|----------------|
| API key protection | Environment variable only |
| Input validation | Lat/lon range checks (-90 to 90, -180 to 180) |
| Response sanitisation | Strict type parsing in adapter |
| Rate limiting | Budget manager with daily/minute tracking |
| Circuit breaker | 3 failures → 30s pause |
| HTTPS only | All OWM API calls over TLS |
| Error masking | Clients see "unavailable", not API errors |

## Usage Example

```typescript
import { openWeatherMapBudget } from './budget.js';
import { weatherScheduler, getCurrentBatch } from './scheduler.js';
import { fetchWeatherForBatch } from './weather.js';

// Check if we should refresh
if (weatherScheduler.isSlotActive()) {
  const batch = getCurrentBatch();
  const citiesCount = batch === 'A' ? 24 : 24;
  
  // Check budget
  if (openWeatherMapBudget.canSpend(citiesCount)) {
    openWeatherMapBudget.spend(citiesCount);
    
    const data = await fetchWeatherForBatch(batch);
    // Cache and serve data
  }
}
```

## Testing

```powershell
# Check budget state
$weather = Invoke-RestMethod "https://promagen-api.fly.dev/weather"
$weather.meta.budget

# Verify data count
$weather.data.Count  # Should be 48

# Spot check temperatures
$weather.data | Where-Object { $_.city -eq "London" }
```

## Cross-References

- **Authority:** `docs/authority/gallery-mode-implementation-plan.md` §21
- **Calming patterns:** `docs/authority/api-calming-efficiency.md`
- **Exchange catalog:** `frontend/src/data/exchanges/exchanges.catalog.json`
- **Selected exchanges:** `frontend/public/ssot/exchanges.selected.json`

---

**SSOT Compliance:** Cities come from the exchange catalog, not hardcoded. Adding exchanges to the catalog automatically includes them in weather fetching.

**Existing features preserved:** Yes — this module integrates with existing gateway patterns.
