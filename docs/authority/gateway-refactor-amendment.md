# GATEWAY-REFACTOR.md Amendment: OpenWeatherMap Module

> **Add this section after the Marketstack section (around line 245)**

---

## OpenWeatherMap Module (Weather - Phase 4)

### Provider Overview

| Property | Value |
|----------|-------|
| Provider | OpenWeatherMap |
| Endpoint | `api.openweathermap.org/data/2.5/weather` |
| Budget | 1,000 calls/day (free tier) |
| Rate Limit | 60 calls/minute |
| Data | Temperature, conditions, humidity, wind for exchange cities |
| Schedule | Clock-aligned at :10 and :40 past each hour |

### File Structure

```
gateway/src/
└── openweathermap/           # ← Everything OpenWeatherMap in ONE place
    ├── README.md             # Provider documentation
    ├── index.ts              # Exports all weather functions
    ├── adapter.ts            # OpenWeatherMap API fetch logic
    ├── budget.ts             # Separate 1000/day budget (ONE instance)
    ├── scheduler.ts          # Clock-aligned slots (:10/:40)
    ├── types.ts              # Weather-specific types
    └── weather.ts            # Weather handler (init, fetch, cache)
```

### Key Differences from Other Providers

| Aspect | TwelveData/Marketstack | OpenWeatherMap |
|--------|------------------------|----------------|
| Init source | SSOT from frontend `/api/*/config` | SSOT from frontend `/api/weather/config` |
| Data granularity | Per-symbol (FX pair, crypto, index) | Per-city (exchange location) |
| Batching | All symbols in one request | 24 cities per batch (A/B alternation) |
| Handler pattern | `FeedHandler` class | Standalone functions (different lifecycle) |

### Batch System

Weather uses A/B batch alternation to stay within budget:

```
Hour N:
  :10 → Batch A (24 priority cities)
  :40 → Batch B (remaining 24 cities)

Hour N+1:
  :10 → Batch A
  :40 → Batch B
```

**Priority cities (Batch A):** All cities matching `selectedExchangeIds` from SSOT, plus extras to reach 24.

### SSOT Config Endpoint

**Frontend route:** `/api/weather/config`

**Returns:**
```typescript
{
  version: 1,
  generatedAt: "2026-01-20T12:00:00.000Z",
  ssot: "frontend/src/data/exchanges/exchanges.catalog.json",
  cities: [
    { id: "lse-london", city: "London", lat: 51.5074, lon: -0.1276 },
    { id: "nyse-new-york", city: "New York", lat: 40.7128, lon: -74.006 },
    // ... 46 more cities
  ],
  selectedExchangeIds: ["lse-london", "nyse-new-york", ...] // 16 selected
}
```

### Budget Management

```typescript
// gateway/src/openweathermap/budget.ts
export const openWeatherMapBudget = new BudgetManager({
  dailyLimit: parseInt(process.env['OPENWEATHERMAP_BUDGET_DAILY'] ?? '1000', 10),
  minuteLimit: parseInt(process.env['OPENWEATHERMAP_BUDGET_MINUTE'] ?? '60', 10),
});
```

**Budget is SEPARATE** from TwelveData (unlike FX and Crypto which share TwelveData budget).

### Response Schema

**Gateway endpoint:** `GET /weather`

```typescript
{
  meta: {
    mode: 'live' | 'cached' | 'stale' | 'fallback',
    cachedAt: "2026-01-20T12:10:00.000Z",
    expiresAt: "2026-01-20T13:10:00.000Z",
    provider: "openweathermap",
    currentBatch: "A" | "B",
    batchARefreshedAt: "2026-01-20T12:10:00.000Z",
    batchBRefreshedAt: "2026-01-20T11:40:00.000Z",
    budget: {
      state: "ok",
      dailyUsed: 48,
      dailyLimit: 1000,
      minuteUsed: 24,
      minuteLimit: 60
    }
  },
  data: [
    {
      id: "lse-london",
      city: "London",
      temperatureC: 12,
      temperatureF: 53.6,
      conditions: "Clouds",
      description: "overcast clouds",
      humidity: 78,
      windSpeedKmh: 15,
      emoji: "☁️",
      asOf: "2026-01-20T12:10:00.000Z"
    },
    // ... more cities
  ]
}
```

### Trace Output

```powershell
Invoke-RestMethod "http://localhost:8080/trace" | Select-Object -ExpandProperty weather
```

```json
{
  "initialized": true,
  "totalCities": 48,
  "batchACount": 24,
  "batchBCount": 24,
  "selectedCount": 16,
  "currentBatch": "A",
  "cache": {
    "hasData": true,
    "dataCount": 24,
    "expiresAt": "2026-01-20T13:10:00.000Z"
  },
  "circuit": {
    "state": "closed",
    "failureCount": 0
  },
  "budget": {
    "dailyUsed": 48,
    "dailyLimit": 1000,
    "minuteUsed": 0,
    "minuteLimit": 60,
    "state": "ok"
  },
  "nextRefreshAt": "2026-01-20T12:40:00.000Z",
  "batchRefreshState": {
    "batchARefreshedAt": "2026-01-20T12:10:00.000Z",
    "batchBRefreshedAt": "2026-01-20T11:40:00.000Z"
  }
}
```

### Initialization Flow

```
1. Gateway starts → server.ts calls initWeatherFromConfig()
2. initWeatherFromConfig() fetches http://localhost:3000/api/weather/config
3. Weather handler initialized with cities and selectedExchangeIds
4. Batches split: priority cities → Batch A, remaining → Batch B
5. Background refresh scheduled at :10 and :40
6. First refresh happens at next slot → cache populated
```

**Critical:** If frontend is not running when gateway starts, weather handler remains uninitialized and returns empty data.

### Fallback Behavior

Following the "No Demo Data" policy:

| Scenario | Behavior |
|----------|----------|
| API key missing | Returns `data: []`, logs warning |
| Frontend config unreachable | Returns `data: []`, handler stays uninitialized |
| API call fails | Circuit breaker opens, returns stale data if available |
| Budget exhausted | Returns stale data if available, else `data: []` |
| No stale data available | Returns `data: []` with `mode: 'fallback'` |

**Never returns synthetic/demo weather data.**

### Verification Commands

```powershell
# Check weather handler is initialized
(Invoke-RestMethod "http://localhost:8080/trace").weather.initialized  # true

# Check weather data is cached
(Invoke-RestMethod "http://localhost:8080/trace").weather.cache.hasData  # true

# Check weather endpoint returns data
(Invoke-RestMethod "http://localhost:8080/weather").data.Count  # 24 (one batch)

# Check weather mode
(Invoke-RestMethod "http://localhost:8080/weather").meta.mode  # "live" or "cached"
```

---

## Also Update: Provider Status Table

Add this row to the Provider Status table (around line 196):

```markdown
| OpenWeatherMap | Weather | ✅ LIVE | 1,000/day | :10/:40 | Exchange city weather |
```

---

## Also Update: Verification Checklist

Add to the Final Verification section:

```powershell
# Weather endpoint responds
(Invoke-RestMethod "https://promagen-api.fly.dev/weather").meta.mode  # ✅ "cached"
(Invoke-RestMethod "https://promagen-api.fly.dev/weather").data.Count  # ✅ 24+
```

---

## Also Update: Cross-References Table

Add:

```markdown
| `dev-prod-environment-setup.md` | DEV and PROD env configuration for all services | ✅ NEW |
```

---

## Also Update: Changelog

Add:

```markdown
| 2026-01-20 | Added OpenWeatherMap module documentation (Phase 4 details) |
|            | Added cross-reference to dev-prod-environment-setup.md |
```
