# City-Vibe Prompt Tooltips — AI Provider Leaderboard

> **Feature:** Weather-driven AI image prompts on every provider flag in the leaderboard table  
> **Status:** Deployed — live on promagen.com  
> **Date:** 9 April 2026 (updated)  
> **Scope:** 40 AI providers × 93 cities × 4 prompt tiers ≈ 49,000 unique combinations

---

## 1. What This Feature Does

When a user hovers over any AI provider's country flag in the leaderboard table, a tooltip appears showing a real-time weather-driven image prompt for that provider's HQ city. The prompt adapts to:

- **Live weather** from OpenWeatherMap (temperature, humidity, wind, cloud cover, conditions)
- **Time of day** at the provider's location (golden hour, blue hour, night, noon)
- **City-specific venues** (e.g. Pike Place Market for Seattle, Golden Gate Bridge for San Francisco)
- **Optical physics** (Magnus formula humidity optics, Beaufort wind scaling, VIIRS nighttime lighting)
- **Prompt tier** matching the provider's AI model (CLIP, Midjourney, Natural Language, Plain Language)

This mirrors the existing exchange card weather tooltips — same component, same physics engine, same prompt generator — but applied to the 40 AI providers instead of stock exchanges.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      GATEWAY (Fly.io)                        │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │ OpenWeatherMap│───▸│ 4-Batch Cache│───▸│  GET /weather  │  │
│  │  API (free)   │    │ A│B│C│D ×23  │    │  → JSON array  │  │
│  └──────────────┘    └──────────────┘    └───────────────┘  │
│        │                                         │           │
│  warmAllBatches()                                │           │
│  (startup: A→B→wait 61s→C→D)                    │           │
└──────────────────────────────────────────────────│───────────┘
                                                   │
                 ┌─────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Vercel)                          │
│                                                              │
│  SSR (build time)        Client (runtime)                    │
│  ┌───────────────┐      ┌──────────────┐                    │
│  │ fetchWeather() │      │ useWeather() │                    │
│  │ → weatherIndex │      │→liveWeather  │                    │
│  └───────┬───────┘      └──────┬───────┘                    │
│          │    effectiveWeatherIndex     │                     │
│          └──────────┬──────────────────┘                     │
│                     ▼                                        │
│         providerWeatherMap (Record<string, WeatherData>)     │
│                     │                                        │
│                     ▼                                        │
│  ┌─────────────────────────────────────────────┐            │
│  │ homepage-client.tsx                          │            │
│  │   └─▸ ProvidersTable                        │            │
│  │         └─▸ ProviderCell (×42)              │            │
│  │               ├─ getProviderWeatherMapping() │            │
│  │               ├─ hookWeatherToDisplay()      │            │
│  │               ├─ generateDemoWeather()  ◂── fallback     │
│  │               └─▸ WeatherPromptTooltip      │            │
│  │                     └─▸ generateWeatherPrompt()          │
│  │                           └─▸ getCityVenue()             │
│  └─────────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Data Layer

### 3.1 Provider → Weather Mapping

**File:** `src/data/providers/provider-weather-map.ts` (167 lines)

Maps all 40 AI providers to their weather data source. Each entry contains:

| Field         | Purpose                                                                    |
| ------------- | -------------------------------------------------------------------------- |
| `weatherId`   | Key into the weather cache (e.g. `provider-san-francisco` or `lse-london`) |
| `vibesCity`   | Title Case city name for prompt generator venue lookup                     |
| `lat` / `lon` | Provider HQ coordinates for solar elevation calculations                   |

**Coverage breakdown:**

| Category                  | Count        | Example                                                |
| ------------------------- | ------------ | ------------------------------------------------------ |
| San Francisco cluster     | 13 providers | Midjourney, OpenAI, Playground, Lexica, etc.           |
| Other new provider cities | 10 providers | Seattle (2), Houston (1), Austin (1), Warsaw (1), etc. |
| Existing exchange cities  | 19 providers | Stability→London, Leonardo→Sydney, Ideogram→Toronto    |

**Helper functions exported:**

- `getProviderWeatherMapping(providerId)` → mapping or `null`
- `getProviderTier(providerId)` → prompt tier 1–4
- `isProviderWeatherId(weatherId)` → `true` if `provider-*` prefix

### 3.2 Provider Weather Cities

**File:** `src/data/providers/provider-weather-cities.json`

10 dedicated cities added to the weather batch for providers whose HQ is more than 100km from any existing exchange city:

| City ID                  | City          | Providers                                                                                                                                        |
| ------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `provider-san-francisco` | San Francisco | Midjourney, OpenAI, Playground, Lexica, OpenArt, Picsart, DeepAI, BlueWillow, Simplified, Google Imagen*, Adobe Firefly*, Hotpot*, Imagine Meta* |
| `provider-seattle`       | Seattle       | Microsoft Designer, Bing                                                                                                                         |
| `provider-houston`       | Houston       | Craiyon                                                                                                                                          |
| `provider-austin`        | Austin        | Jasper Art                                                                                                                                       |
| `provider-warsaw`        | Warsaw        | Getimg                                                                                                                                           |
| `provider-malaga`        | Málaga        | Freepik                                                                                                                                          |
| `provider-limassol`      | Limassol      | VistaCreate                                                                                                                                      |
| `provider-washington-dc` | Washington DC | Visme                                                                                                                                            |
| `provider-sheridan`      | Sheridan      | NovelAI                                                                                                                                          |
| `provider-cairns`        | Cairns        | NightCafe                                                                                                                                        |

_\* These providers are in nearby Bay Area cities (Mountain View, San Jose, Palo Alto, Menlo Park) within 68km of San Francisco, sharing its weather data._

### 3.3 City Vibes Venues

**File:** `src/data/vocabulary/weather/city-vibes.json` (93 cities, 10 venues each)

The prompt generator selects a city-specific venue for each prompt using seeded randomisation. All 10 new provider cities have 10 curated venues each. Example for San Francisco:

- Golden Gate Bridge, Fisherman's Wharf, Chinatown, Mission District murals, Alcatraz Island, Lombard Street, Palace of Fine Arts, Twin Peaks, Ferry Building, Painted Ladies

**Lookup chain:** `vibesCity` → `toLowerCase()` → `city-vibes.json` key → `getCityVenue(city, seed)` → venue name + setting + lightCharacter.

### 3.4 Weather Config API Route

**File:** `src/app/api/weather/config/route.ts` (v3.0.0)

SSOT endpoint the gateway fetches on startup. Returns:

```typescript
{
  version: 3,
  cities: CityForWeather[],       // 94 entries (84 exchange + 10 provider)
  selectedExchangeIds: string[],  // All 84 exchange IDs
  freeDefaultIds: string[],       // 16 free-tier defaults (Batch A priority)
}
```

The gateway uses `freeDefaultIds` to prioritise the 16 free-default exchanges into Batch A, ensuring they always have weather data from the first fetch cycle.

---

## 4. Gateway Layer

### 4.1 Weather Handler

**File:** `openweathermap/weather.ts` (886 lines)

The weather handler manages 94 cities across 4 batches of ~23 cities each, rotating hourly via `hour % 4`. Key constants:

| Constant               | Value | Purpose                                        |
| ---------------------- | ----- | ---------------------------------------------- |
| `NUM_BATCHES`          | 4     | A, B, C, D                                     |
| `MAX_CITIES_PER_BATCH` | 30    | Safety cap                                     |
| Unique locations       | 92    | 94 entries with 2 deduped (shared coordinates) |
| Daily API budget       | 1,000 | OpenWeatherMap free tier                       |
| Minute API budget      | 60    | Rate limit per rolling minute                  |

**Batch assignment logic** (`splitIntoBatches()`):

1. Batch A: All 16 free-default exchanges + fill from remaining to target size (~23)
2. Batches B, C, D: Remaining cities distributed round-robin
3. Provider-specific cities (`provider-*`) land in whichever batch has room — typically B, C, or D

### 4.2 Startup Warmup

**File:** `openweathermap/weather.ts` — `warmAllBatches()` (lines 628–700)  
**File:** `server.ts` — called at line 306 after `initWeatherHandler()`

**Problem:** Without warmup, provider cities in batches C/D have no weather data for up to 4 hours after gateway restart. This means 7 provider-specific cities (`provider-san-francisco`, `provider-austin`, `provider-houston`, `provider-malaga`, `provider-limassol`, `provider-sheridan`, `provider-cairns`) would show no tooltip.

**Solution:** `warmAllBatches()` fetches all 4 batches sequentially at startup:

```
Batch A: 23 calls → OK (23/60 minute budget)
Batch B: 23 calls → OK (46/60 minute budget)
                  → Minute budget exhausted (46 + 23 = 69 > 60)
                  → Wait ~61 seconds for minute window reset
Batch C: 23 calls → OK (23/60 new minute window)
Batch D: 23 calls → OK (46/60 new minute window)
```

**Budget impact:** 92 API calls one-time (9.2% of 1,000/day limit). Total warmup time: ~62 seconds.

**Safety guards:**

- Skips if wait would exceed 90 seconds (prevents indefinite blocking)
- Re-checks budget after wait (fails gracefully if still blocked)
- `try/catch` per batch — partial warmup is better than none
- Circuit breaker records success/failure per batch

### 4.3 Background Refresh

After warmup, the normal batch rotation resumes:

- Schedule: `:10` past each hour (v3.0.0 — dropped `:40`)
- Fetches ONE batch per cycle based on `hour % 4`
- Full rotation: 4 hours for all cities to refresh
- Budget: ~23 calls/hour = 552 calls/day (55.2% of daily limit)

### 4.4 Barrel Export

**File:** `openweathermap/index.ts`

`warmAllBatches` is exported from the weather module barrel at line 107 and imported in `server.ts` at line 45.

---

## 5. Frontend Layer

### 5.1 Data Flow: SSR → Client → Provider Cell

**Step 1 — SSR (`fetchWeatherData()`):**

- Next.js server fetches `gateway/weather` at build/request time
- Returns `weatherIndex: Map<string, ExchangeWeatherData>` containing all cached cities
- Includes both exchange IDs (`lse-london`) and provider IDs (`provider-san-francisco`)

**Step 2 — Client (`useWeather()` hook):**

- Polls `/api/weather` every 5 minutes
- Returns `liveWeatherIndex: Map<string, ExchangeWeatherData>`
- Starts empty (`{}`) on first render, populates after first fetch

**Step 3 — Merge (`homepage-client.tsx` lines 193–266):**

```typescript
// SSR + live merge (live overrides where available)
const effectiveWeatherIndex = useMemo(() => {
  if (liveWeatherIndex.size === 0) return weatherIndex;
  const merged = new Map(weatherIndex);
  for (const [id, data] of liveWeatherIndex) {
    merged.set(id, data);
  }
  return merged;
}, [liveWeatherIndex, weatherIndex]);

// Convert Map<string, ExchangeWeatherData> → Record<string, WeatherData>
const providerWeatherMap = useMemo(() => {
  const map: Record<string, WeatherData> = {};
  for (const [id, w] of effectiveWeatherIndex) {
    map[id] = {
      /* ... field conversion ... */
    };
  }
  return map;
}, [effectiveWeatherIndex]);
```

**Step 4 — Prop threading:**

```
homepage-client.tsx  →  weatherMap={providerWeatherMap}
  └─ ProvidersTable  →  weatherMap={weatherMap}  (prop passthrough)
       └─ ProviderCell  →  weatherMap={weatherMap}  (resolves per provider)
```

### 5.2 Provider Cell Weather Resolution

**File:** `src/components/providers/provider-cell.tsx` (411 lines)

Each `ProviderCell` resolves weather in this order:

```typescript
const mapping = getProviderWeatherMapping(provider.id); // Static lookup
const rawWeather =
  mapping && weatherMap
    ? weatherMap[mapping.weatherId] // Live data
    : undefined;
const liveDisplay = rawWeather ? hookWeatherToDisplay(rawWeather) : null;
const demoDisplay =
  mapping && !liveDisplay
    ? generateDemoWeather(mapping.lat, mapping.lon) // Fallback
    : null;
const weatherDisplay = liveDisplay ?? demoDisplay; // Prefer live
```

**Priority chain:** Live API data → Demo weather from lat/lon → No tooltip

### 5.3 Intelligent Demo Weather Generator

**File:** `src/components/providers/provider-cell.tsx` (lines 100–205)

When the gateway hasn't fetched a provider's batch yet (e.g. during the 62-second warmup window), the frontend generates plausible weather from geographic coordinates so every tooltip has content immediately.

**Algorithm:**

1. **Climate band** from absolute latitude:
   - 0–10° → Equatorial
   - 10–23.5° → Tropical
   - 23.5–35° → Subtropical
   - 35–55° → Temperate
   - 55–90° → Subarctic

2. **Season** from month + hemisphere:
   - Northern hemisphere: May–Oct = summer, Nov–Apr = winter
   - Southern hemisphere: inverted

3. **Day/night** from longitude → timezone estimate → local hour

4. **Deterministic seed** from `Math.abs(Math.round(lat * 1000) + Math.round(lon * 1000)) % 100`
   - Same provider always gets same demo weather (no flicker on re-render)

5. **Output:** Temperature, humidity, wind, condition string, emoji, estimated sunrise/sunset

**Demo indicator:** Description field includes `"(demo)"` suffix so it's distinguishable from live data. Automatically replaced when live data arrives via `useWeather()` refresh cycle.

### 5.4 Weather Prompt Tooltip (Shared Component)

**File:** `src/components/exchanges/weather/weather-prompt-tooltip.tsx` (525 lines)

The same `WeatherPromptTooltip` component used by exchange cards. Provider cells pass:

| Prop              | Source                                                   |
| ----------------- | -------------------------------------------------------- |
| `city`            | `mapping.vibesCity` (e.g. `"San Francisco"`)             |
| `tz`              | `provider.timezone` (e.g. `"America/Los_Angeles"`)       |
| `weather`         | `weatherDisplay` (live or demo `ExchangeWeatherDisplay`) |
| `tier`            | `getProviderTier(provider.id)` (1–4)                     |
| `isPro`           | From user auth context                                   |
| `latitude`        | `mapping.lat`                                            |
| `longitude`       | `mapping.lon`                                            |
| `tooltipPosition` | `"left"` (prevents overflow on right-aligned table)      |

**Critical guard (line 487):**

```typescript
if (!prompt || weather.tempC === null) {
  return <>{children}</>;  // No tooltip, renders plain flag
}
```

This early return was the root cause of the initial bug — when weather data was `null`, the tooltip returned unwrapped children with no hover handlers, no cursor-pointer, and no tooltip.

### 5.5 Flag Component

**File:** `src/components/ui/flag.tsx` (85 lines)

Renders SVG flags from `/public/flags/` with emoji fallback. Updated for this feature:

- **Size:** 16px → 20px to match exchange card flags
- **Emoji fallback:** Explicit `fontSize`, `width`, `height` on emoji `<span>` so emoji flags are visually consistent with SVG flags
- **Styling:** `shrink-0 cursor-pointer` class when tooltip is present
- **title=""** wrapper: Suppresses native browser tooltip ("United States flag") that would conflict with the weather tooltip

---

## 6. Bugs Found and Fixed

### Bug 1: Tooltips Not Firing (Silent Failure)

**Symptom:** Hover over provider flag → city name glows (CSS `:hover`) but no tooltip appears.

**Root cause:** Original implementation used a custom `ProviderWeatherTooltip` component (518 lines) that performed internal multi-step lookup: `providerId → mapping → weatherMap[weatherId] → convert → generate prompt`. Any failure in the chain returned `null` silently — no error, no console log, no visible indicator.

**Fix:** Replaced custom component with the proven `WeatherPromptTooltip` from exchange cards. Moved weather resolution into `provider-cell.tsx` where failures are visible. Deleted 518 lines of orphaned code.

### Bug 2: Data Source Mismatch (SSR vs Client-Only)

**Symptom:** Exchange card tooltips work on first load; provider tooltips only work after ~5 seconds (sometimes never).

**Root cause:** Exchange cards receive `effectiveWeatherIndex` (SSR data merged with live data — always has content from build time). Provider cells only received `liveWeatherById` from the `useWeather()` hook (starts as `{}` on first render, only populates after async client fetch). On slow connections or when the fetch fails, providers never get data.

**Fix:** Created `providerWeatherMap` useMemo in `homepage-client.tsx` that converts `effectiveWeatherIndex` (the same SSR+live source exchange cards use) into the `Record<string, WeatherData>` format provider cells expect. Providers now have weather data from first render.

### Bug 3: Lowercase City Names in Prompts

**Symptom:** Tooltip prompt text shows `"zurich"` instead of `"Zurich"`.

**Root cause:** `vibesCity` values in `provider-weather-map.ts` were all lowercase. The value passes through to the prompt generator and appears as-is in tooltip text. The `getCityVenue()` function does its own `.toLowerCase()` for lookup, so Title Case input is safe.

**Fix:** Capitalised all 40 `vibesCity` values (San Francisco, London, New York, Kuala Lumpur, Hong Kong, Washington DC, Málaga, etc.).

### Bug 4: 23 Providers Missing Weather Data (Batch Rotation)

**Symptom:** 19 providers show tooltips, 23 do not. Consistent across reloads.

**Root cause (traced end-to-end):**

1. Gateway `warmAllBatches()` was implemented but hit the 60/minute rate limit after batches A+B (46 calls)
2. Original code broke out of the loop on budget exhaustion instead of waiting
3. Batches C+D (containing 7 provider cities) never got fetched
4. Without warmup data, those cities had no weather until their batch naturally rotated (up to 4 hours)
5. The 19 working providers all piggyback on exchange weather IDs in batches A or B

**Fix (two-part):**

1. **Gateway:** `warmAllBatches()` now detects minute budget exhaustion and waits ~61 seconds for the minute window to reset before continuing with batches C+D
2. **Frontend:** `generateDemoWeather()` produces plausible climate-based weather as a fallback during the 62-second warmup window

### Bug 5: Gateway Diagnostic Confirmation

**Diagnostic log from gateway (the smoking gun):**

```json
{
  "message": "WEATHER-GW-DIAG: cache hit",
  "context": {
    "totalCached": 48,
    "providerCount": 3,
    "providerIds": ["provider-seattle", "provider-warsaw", "provider-washington-dc"],
    "hasSF": false
  }
}
```

After the warmup fix was deployed:

```json
{
  "message": "Weather warmup: batch A complete",
  "context": { "apiCalls": 23, "totalCached": 24 }
}
{
  "message": "Weather warmup: batch B complete",
  "context": { "apiCalls": 23, "totalCached": 48 }
}
{
  "message": "Weather warmup: waiting 61s for minute budget reset before batch C"
}
{
  "message": "Weather warmup: batch C complete",
  "context": { "apiCalls": 23, "totalCached": 72 }
}
{
  "message": "Weather warmup: batch D complete",
  "context": { "apiCalls": 23, "totalCached": 94 }
}
```

---

## 7. File Inventory

### Frontend (`src/`)

| File                                                      | Lines | Role                                                  |
| --------------------------------------------------------- | ----- | ----------------------------------------------------- |
| `data/providers/provider-weather-map.ts`                  | 167   | SSOT: provider → weather city + coords                |
| `data/providers/provider-weather-cities.json`             | 12    | 10 new provider HQ cities for gateway                 |
| `data/vocabulary/weather/city-vibes.json`                 | —     | 93 cities × 10 venues each                            |
| `components/providers/provider-cell.tsx`                  | 411   | Cell component with demo weather + tooltip            |
| `components/exchanges/weather/weather-prompt-tooltip.tsx` | 525   | Shared tooltip (exchange cards + providers)           |
| `components/providers/providers-table.tsx`                | 692   | Table component (threads `weatherMap` prop)           |
| `components/home/homepage-client.tsx`                     | 483   | Merges SSR+live weather, creates `providerWeatherMap` |
| `components/ui/flag.tsx`                                  | 85    | Flag component (SVG + emoji, sizing fix)              |
| `lib/weather/fetch-weather.ts`                            | 288   | SSR weather fetch from gateway                        |
| `lib/weather/weather-prompt-generator.ts`                 | —     | Prompt generation engine                              |
| `lib/weather/vocabulary-loaders.ts`                       | —     | City venue lookup (`getCityVenue`)                    |
| `hooks/use-weather.ts`                                    | 299   | Client-side weather polling hook                      |
| `app/api/weather/route.ts`                                | 181   | API proxy: client → gateway                           |
| `app/api/weather/config/route.ts`                         | —     | SSOT config: gateway fetches on startup               |

### Gateway (`openweathermap/`)

| File           | Lines | Role                                       |
| -------------- | ----- | ------------------------------------------ |
| `weather.ts`   | 886   | Weather handler + `warmAllBatches()`       |
| `index.ts`     | —     | Barrel exports (includes `warmAllBatches`) |
| `adapter.ts`   | —     | OpenWeatherMap API calls                   |
| `budget.ts`    | —     | Rate limit tracking (daily + minute)       |
| `scheduler.ts` | —     | Batch rotation (`hour % 4`)                |
| `types.ts`     | —     | TypeScript interfaces                      |

### Gateway (`server.ts`)

| Line | What                               |
| ---- | ---------------------------------- |
| 45   | Import `warmAllBatches`            |
| 273  | `initWeatherFromConfig()` function |
| 306  | `await warmAllBatches()` call      |
| 564  | `GET /weather` endpoint            |

---

## 8. API Budget Analysis

**OpenWeatherMap Free Tier:** 1,000 calls/day, 60 calls/minute.

| Activity       | Calls | Frequency        | Daily Total             |
| -------------- | ----- | ---------------- | ----------------------- |
| Startup warmup | 92    | Once per deploy  | 92                      |
| Batch refresh  | 23    | Every hour (×24) | 552                     |
| **Total**      |       |                  | **644 / 1,000 (64.4%)** |

**Minute budget during warmup:**

| Time    | Action                         | Minute Used |
| ------- | ------------------------------ | ----------- |
| T+0s    | Batch A                        | 23/60       |
| T+0.1s  | Batch B                        | 46/60       |
| T+0.2s  | Budget blocked (46+23=69 > 60) | —           |
| T+61s   | Minute window resets           | 0/60        |
| T+61.1s | Batch C                        | 23/60       |
| T+61.2s | Batch D                        | 46/60       |

---

## 9. Diagnostic Probes (Retained in Codebase)

The following diagnostic traces are intentionally kept in the deployed code for ongoing monitoring. They log at `console.warn` level and are visible in browser DevTools and Next.js terminal:

| Tag                   | Location               | What It Shows                                                      |
| --------------------- | ---------------------- | ------------------------------------------------------------------ |
| `[WEATHER-SSR-DIAG]`  | `fetch-weather.ts`     | Gateway response: total items, provider IDs, specific city checks  |
| `[WEATHER-API-DIAG]`  | `route.ts`             | `/api/weather` proxy: what gets forwarded to client                |
| `[WEATHER-HOOK-DIAG]` | `use-weather.ts`       | `useWeather()` hook: what arrived from polling                     |
| `[WEATHER-DIAG]`      | `homepage-client.tsx`  | Full pipeline: SSR Map vs live Map vs merged vs providerWeatherMap |
| `[PROV-CELL-DIAG]`    | `provider-cell.tsx`    | Fires ONLY for broken lookups (weatherId not found in map)         |
| `[WEATHER-GW-DIAG]`   | `weather.ts` (gateway) | Cache state when GET request hits                                  |

**To disable:** Remove the `console.warn('[...-DIAG]` blocks from each file. They have no performance impact (string concatenation only runs when DevTools console is open).

---

## 10. Verification Checklist

### Frontend

```powershell
# From repo root
npx tsc --noEmit                    # TypeScript clean
npm run dev                          # Dev server starts
```

**Visual checks:**

- [ ] Hover any provider flag → tooltip appears with weather prompt
- [ ] City name in prompt is Title Case (San Francisco, not san francisco)
- [ ] Tooltip appears immediately (no delay waiting for API)
- [ ] Demo weather shows `(demo)` in description until live data arrives
- [ ] All 40 providers have working tooltips (not just the 19 exchange-piggyback ones)
- [ ] Tooltip position is `left` (doesn't overflow right edge of table)
- [ ] Flag size is 20px (matches exchange cards)
- [ ] No native browser tooltip ("United States flag") appears

### Gateway

```powershell
# Deploy to Fly.io, then watch logs
fly logs --app promagen-gateway | Select-String "Weather warmup"
```

**Expected log sequence:**

```
Weather warmup: batch A complete { apiCalls: 23, totalCached: 24 }
Weather warmup: batch B complete { apiCalls: 23, totalCached: 48 }
Weather warmup: waiting 61s for minute budget reset before batch C
Weather warmup: batch C complete { apiCalls: 23, totalCached: 72 }
Weather warmup: batch D complete { apiCalls: 23, totalCached: 94 }
Weather warmup complete { totalApiCalls: 92, totalExpanded: 94, cachedEntries: 94 }
```

### API Trace

```
GET https://promagen-gateway.fly.dev/trace
```

Check `weather.cachedEntries` equals 94 (not 48).

---

## 11. Key Design Decisions

| Decision                                                 | Rationale                                                                               |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Reuse `WeatherPromptTooltip` from exchange cards         | Battle-tested component; eliminated 518 lines of custom code that failed silently       |
| Weather resolution in `provider-cell.tsx` not in tooltip | Failures are visible at the cell level; tooltip receives clean data or nothing          |
| SSR+live merged source (not client-only)                 | Providers get weather from first render; exchange cards proved this pattern works       |
| Demo weather from lat/lon (not hardcoded)                | Climate-accurate, deterministic, requires no API calls, auto-replaced by live data      |
| `warmAllBatches()` with minute budget wait               | Ensures all 94 cities have data within 62 seconds of deploy; partial warmup as fallback |
| Title Case `vibesCity` values                            | Prompt text appears as-is in tooltip; `getCityVenue()` lowercases internally            |
| Flag size 20px with emoji sizing fix                     | Visual consistency between SVG and emoji flags across all providers                     |
| `title=""` wrapper on flag                               | Suppresses native browser tooltip that conflicts with weather tooltip                   |

---

## 12. Dependencies

| Dependency                     | Version   | Used For                                               |
| ------------------------------ | --------- | ------------------------------------------------------ |
| OpenWeatherMap API             | Free tier | Live weather data for 92 unique locations              |
| `city-vibes.json`              | v3.0.0    | 93 cities × 10 venues for prompt localisation          |
| `WeatherPromptTooltip`         | v8.0.0    | Shared tooltip component with 4-tier prompt generation |
| `generateWeatherPrompt()`      | v8.0.0    | VisualTruth physics engine + vocabulary system         |
| `getCityVenue()`               | —         | Seeded venue selection from city-vibes data            |
| `provider-weather-map.ts`      | v1.0.0    | Static provider → city mapping (42 entries)            |
| `provider-weather-cities.json` | v1.0.0    | 10 new cities for gateway batch system                 |

---

_Authority: This document is the definitive reference for the city-vibe prompt tooltip feature on the AI provider leaderboard. Cross-references: `provider-weather-map.ts`, `provider-cell.tsx`, `homepage-client.tsx`, `weather.ts` (gateway), `server.ts` (gateway)._
