# Additional Documentation Updates Required

This file contains sections to add to existing documentation.

---

## 1. Updates for `fly-v2.md`

### Add to Section 8.4 (Gateway Environment Variables)

Add this new section **8.5 Gateway Environment Variables (OpenWeatherMap)**:

```markdown
### 8.5 Gateway Environment Variables (OpenWeatherMap)

| Variable | Default | Description |
|----------|---------|-------------|
| `WEATHER_CONFIG_URL` | `https://promagen.com/api/weather/config` | Frontend Weather SSOT endpoint |
| `OPENWEATHERMAP_API_KEY` | (required) | OpenWeatherMap API key |
| `OPENWEATHERMAP_BUDGET_DAILY` | `1000` | Daily API call limit |
| `OPENWEATHERMAP_BUDGET_MINUTE` | `60` | Per-minute call limit |
| `FRONTEND_BASE_URL` | `https://promagen.com` | Base URL for SSOT (derives all config URLs) |
```

### Add to Provider Table (around Section 11.1)

Update the provider table to include OpenWeatherMap:

```markdown
| Provider | Feeds | Daily Limit | TTL | Schedule |
|----------|-------|-------------|-----|----------|
| TwelveData | FX, Crypto | 800 credits | 30 min | :00/:30 (FX), :20/:50 (Crypto) |
| Marketstack | Indices | 250 credits | 2 hours | :05/:35 |
| **OpenWeatherMap** | **Weather** | **1,000 calls** | **1 hour** | **:10/:40** |
```

### Add New Section 12: Weather SSOT Architecture

```markdown
## 12. Weather SSOT Architecture (Added Jan 20, 2026)

The gateway `/weather` endpoint provides real-time weather data for exchange cities.

### 12.1 Provider: OpenWeatherMap (Separate Budget)

| Provider | Feeds | Daily Limit | Rate Limit | TTL |
|----------|-------|-------------|------------|-----|
| OpenWeatherMap | Weather | 1,000 calls | 60/min | 1 hour |

Weather uses a **separate provider and budget** — it doesn't compete with TwelveData or Marketstack.

### 12.2 SSOT Config Endpoint

**Frontend route:** `/api/weather/config`

**Returns:**
- `cities` — Array of {id, city, lat, lon} for all exchanges
- `selectedExchangeIds` — Priority exchanges for Batch A

**Gateway behavior:**
1. Fetches config from frontend on startup
2. Splits cities into Batch A (priority 24) and Batch B (remaining 24)
3. Refreshes Batch A at :10, Batch B at :40
4. Caches data with 1-hour TTL

### 12.3 Batch System

```
Hour N:
  :10 → Batch A (24 priority cities)
  :40 → Batch B (remaining 24 cities)
```

This keeps daily usage under 1,000 calls: 48 calls/hour × 24 hours = 1,152, but with caching it stays under budget.

### 12.4 Verification

```powershell
# Check weather SSOT
Invoke-RestMethod "https://promagen.com/api/weather/config" | Select-Object -ExpandProperty cities | Measure-Object

# Check gateway weather trace
(Invoke-RestMethod "https://promagen-api.fly.dev/trace").weather

# Check weather data
(Invoke-RestMethod "https://promagen-api.fly.dev/weather").meta
```
```

---

## 2. Updates for `promagen-api-brain-v2.md`

### Add to Runtime Knobs Section (around line with TWELVEDATA_API_KEY)

```markdown
OpenWeatherMap (Weather):

- OPENWEATHERMAP_API_KEY
- OPENWEATHERMAP_BUDGET_DAILY (default 1000)
- OPENWEATHERMAP_BUDGET_MINUTE (default 60)
```

### Add to Provider Catalogue Section

Add OpenWeatherMap as a documented provider:

```markdown
### OpenWeatherMap (Weather)

**Identity:**
- providerId: `openweathermap`
- name: OpenWeatherMap
- docs: https://openweathermap.org/api

**Auth / configuration:**
- Required: `OPENWEATHERMAP_API_KEY`
- Missing key semantics: Weather handler stays uninitialized, returns empty data

**Capabilities:**
- Roles: weather (exchange city conditions)
- Bulk support: Yes (one city per request, batched)
- Bulk limit: 24 cities per batch
- Cost model: 1 credit per city request

**Symbol format:**
- Uses lat/lon coordinates from exchange catalog
- ID matches exchange ID (e.g., `lse-london`, `nyse-new-york`)

**Response shape:**
```typescript
{
  id: string;
  city: string;
  temperatureC: number;
  temperatureF: number;
  conditions: string;
  description: string;
  humidity: number;
  windSpeedKmh: number;
  emoji: string;
  asOf: string;
}
```
```

### Add Weather to Clock-Aligned Schedule (Section 21)

Update the timing diagram:

```markdown
### 21.2 API Timing Stagger (Updated Jan 20, 2026)

Timeline (minutes past hour):
:00  :05  :10  :20  :30  :35  :40  :50
 FX  IDX  WTH  CRY  FX  IDX  WTH  CRY
 TD   MS  OWM   TD   TD   MS  OWM   TD

TD  = TwelveData (shared 800/day budget)
MS  = Marketstack (separate 250/day budget)
OWM = OpenWeatherMap (separate 1000/day budget)
```

---

## 3. Cross-Reference Update

Add to any "Related Documents" or "Cross-References" sections:

```markdown
| Document | Purpose |
|----------|---------|
| `dev-prod-environment-setup.md` | DEV and PROD environment configuration |
| `GATEWAY-REFACTOR.md` | Gateway architecture and provider modules |
```

---

## 4. Changelog Entries

### For `fly-v2.md`:

```markdown
| Date       | Change |
|------------|--------|
| 2026-01-20 | Added Section 12: Weather SSOT Architecture |
|            | Added OpenWeatherMap to provider table |
|            | Added cross-reference to dev-prod-environment-setup.md |
```

### For `promagen-api-brain-v2.md`:

```markdown
| Date       | Change |
|------------|--------|
| 2026-01-20 | Added OpenWeatherMap runtime knobs |
|            | Added OpenWeatherMap provider catalogue entry |
|            | Updated API timing stagger diagram with OWM |
```

---

_Apply these updates to maintain documentation consistency across the Promagen docs/authority folder._
