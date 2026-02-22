# Exchange Card Weather System

> **Authority document** for the weather data pipeline, display, tooltips, prompt generation, lighting engine, and astronomical calculations on Promagen exchange cards.
>
> **Version:** 9.6.0 — 20 February 2026
>
> **Scope:** Gateway (Fly.io) → Frontend (Vercel/Next.js) — end-to-end.

---

## 1. System Overview

The exchange card weather system delivers real-time weather data for **89 stock exchanges** worldwide, displayed on interactive exchange cards. The system powers three user-facing features:

1. **Weather display** — Temperature (°C/°F), wind speed + dynamic emoji, humidity percentage.
2. **Weather emoji tooltip** — Hover the weather/moon emoji → conditions sentence, moon phase (night), next sunrise/sunset time.
3. **Image prompt tooltip** — Hover the country flag → AI-ready image prompt generated from live weather + city venue scenes + deterministic lighting engine + visual truth layer, across 4 format tiers (+ Flux variant) for 42+ AI image generators.

### Architecture — Modular Decomposition (v9.0.0)

The prompt generation system was decomposed from a single 4,311-line monolith (`weather-prompt-generator.ts`) into **18 focused modules** totalling **~7,118 lines** in the frontend weather library. Each module has a single responsibility and explicit imports/exports with zero circular dependencies.

| Module                        | Lines | Responsibility                                                                                             |
| ----------------------------- | ----- | ---------------------------------------------------------------------------------------------------------- |
| `weather-prompt-generator.ts` | 320   | Orchestrator — dispatches to subsystems, assembles final output                                            |
| `tier-generators.ts`          | 644   | 4 tier generators + Flux variant (T1 CLIP, T1F Flux, T2 MJ, T3 NL, T4 Plain)                               |
| `visual-truth.ts`             | 1,253 | Visual Truth layer — dew point physics, air clarity, contrast, moisture, thermal optics                    |
| `lighting-engine.ts`          | 917   | Procedural lighting — solar elevation bands, daytime enrichment (87 phrase pools), night competition model |
| `prompt-types.ts`             | 548   | All interfaces — PromptProfile, PromptTrace, VisualTruth, LightingState, WeatherPromptResult               |
| `vocabulary-loaders.ts`       | 519   | JSON vocabulary loading, range lookups, phrase selection, buildContext()                                   |
| `wind-system.ts`              | 476   | Beaufort-calibrated wind — 8 force tiers, venue-aware phrases, cardinal direction, gusts                   |
| `weather-types.ts`            | 336   | ExchangeWeatherFull, ExchangeWeatherDisplay, type conversions                                              |
| `camera-lens.ts`              | 283   | Camera body + lens selection per style × setting, platform-aware quality tags, negative prompts            |
| `fetch-weather.ts`            | 275   | Server-side gateway fetch + demo gap-fill + GatewayWeatherItem type                                        |
| `cloud-types.ts`              | 223   | OWM weather.id → 10 visual cloud types (cumulus, stratus, cirrus, etc.), 40 phrases                        |
| `time-utils.ts`               | 203   | 12 directional solar phases (dawn vs dusk), time descriptors, solar phase labels                           |
| `climate.ts`                  | 195   | 7 latitude-based climate zones, effective humidity/dew-spread normalization                                |
| `moon-phase.ts`               | 147   | Synodic cycle → 8 phases, 40 prompt phrases, emoji selection                                               |
| `weather.ts`                  | 113   | Shared weather utilities                                                                                   |
| `prng.ts`                     | 87    | Knuth-hash PRNG, capitalize(), hashString() — deterministic seeded selection                               |
| `sun-calculator.ts`           | 562   | NOAA sunrise/sunset + solar elevation + lunar position (Meeus ephemeris)                                   |
| `exchange-weather.ts`         | 17    | Barrel re-exports                                                                                          |

At night, the weather emoji swaps to a moon phase emoji calculated from pure astronomy (no API). The lighting engine models venue-aware urban vs moonlight competition (v7.5), with coherence validation (v7.6), iconic venue enrichment (v7.7), precipitation-aware sky source logic (v7.8), and daytime enrichment with 87 phrase pools across 8 solar bands × 4 cloud strata (v9.1.0). A unified Visual Truth layer (v7.0) cross-references all weather data to eliminate physics conflicts across prompt layers, extended with compound precipitation detection (v9.3.0), climate-aware humidity normalization (v9.4.0), cloud type classification (v9.5.0), and directional dawn/dusk solar phase (v9.5.0).

**v9.0–v9.6 additions on top of v8.0:** Monolith decomposition into 18 modules with Knuth-hash PRNG (v9.0). Daytime lighting enrichment with Kelvin colour temperature 2500K–12000K (v9.1). Camera/lens metadata system with platform-aware quality tags and negative prompts across all 4 tiers (v9.2). Compound precipitation detection with 3-source classification (v9.3). Climate-aware humidity — latitude-based zone normalization so Singapore 85% ≠ London 85% (v9.4). Cloud type classifier from OWM weather.id with 10 visual types and 40 phrases (v9.5). Directional dawn/dusk solar phase with 12 phases (v9.5). OWM weatherId pipeline through 5 type interfaces (v9.5). MJ V6/V7 natural language prompt format replacing legacy `::` multi-prompt syntax (v9.6). Flux-native T5 text encoder variant for Tier 1 (v9.6). `mjVersion` field on PromptProfile (v9.6). `fluxPrompt` field on WeatherPromptResult (v9.6).

### Data Sources

| Source          | Provider                       | Purpose                                                                                               | Refresh                            |
| --------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Live weather    | OpenWeatherMap (OWM)           | Temp, conditions, wind, humidity, cloud %, visibility, pressure, sunrise/sunset, day/night, weatherId | Every 4 hours per exchange         |
| Demo weather    | Algorithmic (built-in)         | Fallback when gateway unavailable or exchange not yet in current batch                                | Recalculated on each page load     |
| Moon phase      | Pure astronomy (synodic cycle) | Moon emoji + prompt phrases at night                                                                  | Calculated client-side, no API     |
| Lunar position  | Meeus ephemeris (§8.4)         | Moon altitude + azimuth for tooltip + prompt position phrases + night lighting competition            | Calculated client-side, no API     |
| Solar elevation | Pure astronomy (NOAA formula)  | Lighting engine base — sun angle from lat, lon, day-of-year, hour                                     | Calculated client-side, no API     |
| Urban light     | `urban-light.json` (§11A.3)    | Per-city artificial light emission factor for night lighting competition model                        | Static data, 83 cities             |
| Sunrise/sunset  | OWM timestamps + NOAA fallback | Tooltip sun event times + quiet hours boundary                                                        | API: exact. Fallback: ±5 min       |
| City scenes     | `city-vibes.json`              | Venue names + settings + optional lightCharacter for 83 cities                                        | Static vocabulary, seeded rotation |

---

## 2. Data Flow Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        GATEWAY (Fly.io)                              │
│                                                                      │
│  OpenWeatherMap API ──→ adapter.ts ──→ weather.ts (accumulator)      │
│       (83 calls)        parseWeatherResponse()    MERGE pattern      │
│                         extracts isDayTime,       4 batches rotate   │
│                         sunriseUtc, sunsetUtc,    by hour % 4        │
│                         timezoneOffset,                              │
│                         cloudCover, visibility,                      │
│                         pressure, weatherId                          │
│                                                                      │
│  scheduler.ts: Clock-aligned at :10 each hour                        │
│  budget.ts:    1,000 calls/day free tier                             │
└──────────────────────────┬───────────────────────────────────────────┘
                           │ GET /weather
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      FRONTEND (Vercel)                               │
│                                                                      │
│  fetch-weather.ts ──→ page.tsx (server) ──→ Client components        │
│    getWeatherIndex()     passes weatherIndex     ExchangeCard        │
│    5-min server cache    as prop to client        ├─ WeatherSection  │
│    demo gap-fill                                  │   └─ EmojiTooltip│
│                                                   └─ PromptTooltip   │
│                                                                      │
│  ┌─── weather-prompt-generator.ts v9.6 (ORCHESTRATOR) ────────────┐ │
│  │                                                                 │ │
│  │  ┌─ SUBSYSTEMS (dedicated modules) ──────────────────────────┐ │ │
│  │  │                                                            │ │ │
│  │  │  visual-truth.ts (1,253 lines)                            │ │ │
│  │  │    ├─ deriveVisualTruth() — unified atmospheric state     │ │ │
│  │  │    ├─ Dew point physics + air clarity + contrast          │ │ │
│  │  │    ├─ Compound precipitation (v9.3)                       │ │ │
│  │  │    └─ Climate-aware humidity via climate.ts (v9.4)        │ │ │
│  │  │                                                            │ │ │
│  │  │  lighting-engine.ts (917 lines)                           │ │ │
│  │  │    ├─ Daytime: 87 phrase pools (8 bands × 4 strata)      │ │ │
│  │  │    │   └─ Kelvin colour temp (2500K–12000K) (v9.1)       │ │ │
│  │  │    └─ Nighttime: Urban vs Moon competition model (v7.5+) │ │ │
│  │  │        ├─ urban-light.json (83 cities, 0.0–1.0)          │ │ │
│  │  │        ├─ Lunar position (Meeus ephemeris)                │ │ │
│  │  │        ├─ Venue-aware attenuation (9 settings)            │ │ │
│  │  │        ├─ Coherence validator (banned terms) (v7.6)       │ │ │
│  │  │        └─ 3-tier light priority (v7.7)                    │ │ │
│  │  │                                                            │ │ │
│  │  │  tier-generators.ts (644 lines)                           │ │ │
│  │  │    ├─ T1 CLIP: (token:1.3) weighted keywords             │ │ │
│  │  │    ├─ T1F Flux: T5-native variant (no weights) (v9.6)    │ │ │
│  │  │    ├─ T2 MJ: V6/V7 natural language (v9.6) + V5.2 legacy│ │ │
│  │  │    ├─ T3 NL: Connected scene description (default)       │ │ │
│  │  │    └─ T4 Plain: Simple comma-separated fragments         │ │ │
│  │  │                                                            │ │ │
│  │  │  wind-system.ts (476 lines)                               │ │ │
│  │  │    ├─ Beaufort-calibrated (8 force tiers)                 │ │ │
│  │  │    ├─ Venue-aware wind phrases                            │ │ │
│  │  │    └─ Cardinal direction + gust factor                    │ │ │
│  │  │                                                            │ │ │
│  │  │  camera-lens.ts (283 lines)                               │ │ │
│  │  │    ├─ Per-style × per-setting camera bodies + lenses      │ │ │
│  │  │    ├─ Platform-aware quality tags (T1–T4)                 │ │ │
│  │  │    └─ Negative prompt system (CLIP/MJ --no/NL avoid)      │ │ │
│  │  │                                                            │ │ │
│  │  │  cloud-types.ts (223 lines)                               │ │ │
│  │  │    └─ OWM weather.id → 10 visual cloud types, 40 phrases │ │ │
│  │  │                                                            │ │ │
│  │  │  time-utils.ts (203 lines)                                │ │ │
│  │  │    └─ 12 directional solar phases (dawn vs dusk) (v9.5)  │ │ │
│  │  │                                                            │ │ │
│  │  │  climate.ts (195 lines)                                   │ │ │
│  │  │    └─ 7 latitude-based zones, humidity normalization      │ │ │
│  │  │                                                            │ │ │
│  │  └──────────────────────────────────────────────────────────┘ │ │
│  │                                                                 │ │
│  │  ┌─ SHARED DATA ────────────────────────────────────────────┐ │ │
│  │  │  prompt-types.ts (548) — all interfaces                  │ │ │
│  │  │  vocabulary-loaders.ts (519) — JSON phrase selection      │ │ │
│  │  │  prng.ts (87) — Knuth-hash PRNG, deterministic seeds    │ │ │
│  │  │  moon-phase.ts (147) — 8 phases, 40 phrases             │ │ │
│  │  │  sun-calculator.ts (562) — NOAA solar + Meeus lunar     │ │ │
│  │  └──────────────────────────────────────────────────────────┘ │ │
│  │                                                                 │ │
│  │  ┌─ VOCABULARY JSON ───────────────────────────────────────┐  │ │
│  │  │  city-vibes.json — 83 cities, 842 venues, 9 settings    │  │ │
│  │  │  wind.json — 30 ranges, 240 phrases                     │  │ │
│  │  │  temperature.json — 18 ranges, 54 phrases               │  │ │
│  │  │  humidity.json — 20 ranges, 60 phrases                  │  │ │
│  │  │  time-of-day.json — 24 hours, 67 phrases                │  │ │
│  │  │  conditions.json — 14 types, 280 phrases                │  │ │
│  │  │  urban-light.json — 83 cities, emission factors          │  │ │
│  │  └─────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Gateway Layer

### 3.1 OWM API Client

**File:** `openweathermap/adapter.ts` (393 lines)

Fetches weather from the OWM Current Weather endpoint for a single city.

| Setting    | Value                                                                            |
| ---------- | -------------------------------------------------------------------------------- |
| Endpoint   | `https://api.openweathermap.org/data/2.5/weather`                                |
| Parameters | `lat`, `lon`, `units=metric`, `appid`                                            |
| Timeout    | 10 seconds                                                                       |
| Retries    | 2 (with 1s delay)                                                                |
| API key    | Environment variable, fetched dynamically per call (never cached at module load) |

**`parseWeatherResponse(raw, city) → WeatherData`**

Normalises the raw OWM JSON into the gateway's internal `WeatherData` type:

- `temperatureC` / `temperatureF` — Celsius from API, Fahrenheit derived.
- `conditions` — Primary condition label (e.g. "Clear", "Rain") from `weather[0].main`.
- `description` — Detailed string (e.g. "broken clouds", "light rain") from `weather[0].description`.
- `humidity` — Percentage from `main.humidity`.
- `windSpeedKmh` — Converted from m/s (`raw.wind.speed * 3.6`).
- `cloudCover` — Percentage from `clouds.all`. **(v6.0 — new field for lighting engine)**
- `visibility` — Metres from `visibility`. **(v6.0 — new field for lighting engine)**
- `pressure` — Hectopascals from `main.pressure`. **(v6.0 — new field for lighting engine)**
- `rainMm1h` — Millimetres from `rain["1h"]`, null when absent. **(v8.0 — numeric precipitation intensity)**
- `snowMm1h` — Millimetres from `snow["1h"]`, null when absent. **(v8.0 — numeric precipitation intensity)**
- `windDegrees` — Meteorological degrees from `wind.deg`, null when absent. **(v8.0 — wind direction)**
- `windGustKmh` — Converted from m/s (`raw.wind.gust * 3.6`), null when absent. **(v8.0 — gust factor)**
- `emoji` — Mapped from condition via `CONDITION_TO_EMOJI` lookup.
- `isDayTime` — Derived from OWM icon suffix: icon ending in `'d'` = day, `'n'` = night. OWM calculates this using the city's actual sunrise/sunset internally, making it the most accurate day/night signal available.
- `sunriseUtc` / `sunsetUtc` — Unix timestamps (seconds, UTC) from `raw.sys.sunrise` / `raw.sys.sunset`.
- `timezoneOffset` — Seconds from UTC (e.g. `28800` for UTC+8 Taipei) from `raw.timezone`.

### 3.2 Batch Scheduler

**File:** `openweathermap/scheduler.ts` (403 lines)

The 89 exchanges are divided into 4 batches (A/B/C/D). Only one batch fetches per hour, rotating by `hour % 4`. Each batch refreshes every 4 hours (6 times per day).

| Batch | Hour (UTC)           | Exchanges              |
| ----- | -------------------- | ---------------------- |
| A     | 0, 4, 8, 12, 16, 20  | ~16 priority exchanges |
| B     | 1, 5, 9, 13, 17, 21  | ~24 exchanges          |
| C     | 2, 6, 10, 14, 18, 22 | ~24 exchanges          |
| D     | 3, 7, 11, 15, 19, 23 | ~25 exchanges          |

**Schedule slot:** Weather fires at **`:10` past the hour only** (`:40` slot freed for future feeds).

**Coordinate deduplication:** 89 exchanges map to **83 unique coordinates** — exchanges sharing a city share one API call. This saves 6 calls per batch cycle.

**Daily budget:** ~83 unique calls × 6 rotations per batch = ~498 calls/day, well within the **1,000 calls/day** free tier.

### 3.3 Data Accumulation (MERGE Pattern)

**File:** `openweathermap/weather.ts` (794 lines)

The gateway accumulates weather data across batches using a MERGE pattern. When Batch B fetches, it merges new data into the existing store without overwriting Batch A's data. This means the gateway progressively builds a complete picture over 4 hours.

On a fresh gateway restart, only the current batch's data exists. The frontend handles this gracefully via demo gap-fill.

### 3.4 Gateway Response Shape

```
GET /weather → 200 OK

{
  meta: {
    mode: 'live' | 'cached' | 'stale' | 'fallback',
    provider: 'openweathermap',
    currentBatch: 'A' | 'B' | 'C' | 'D',
    batchARefreshedAt: '2026-02-12T18:10:00Z',
    batchBRefreshedAt: '2026-02-12T19:10:00Z',
    ...
    budget: {
      state: 'green',
      dailyUsed: 83,
      dailyLimit: 1000,
      minuteUsed: 21,
      minuteLimit: 60
    }
  },
  data: WeatherData[]   // up to 89 items
}
```

### 3.5 Gateway Type Reference

**File:** `openweathermap/types.ts` (386 lines)

```typescript
interface WeatherData {
  readonly id: string; // "nyse-new-york"
  readonly city: string; // "New York"
  readonly temperatureC: number; // 22.3
  readonly temperatureF: number; // 72.1
  readonly conditions: string; // "Clear"
  readonly description: string; // "clear sky"
  readonly humidity: number; // 65
  readonly windSpeedKmh: number; // 12
  readonly cloudCover: number; // 57       (v6.0)
  readonly visibility: number; // 10000    (v6.0)
  readonly pressure: number; // 1016     (v6.0)
  readonly rainMm1h: number | null; // 1.2  (v8.0 — OWM rain["1h"])
  readonly snowMm1h: number | null; // null (v8.0 — OWM snow["1h"])
  readonly windDegrees: number | null; // 220  (v8.0 — OWM wind.deg)
  readonly windGustKmh: number | null; // 45   (v8.0 — OWM wind.gust × 3.6)
  readonly emoji: string; // "☀️"
  readonly asOf: string; // ISO timestamp
  readonly sunriseUtc: number | null; // 1707721200
  readonly sunsetUtc: number | null; // 1707757800
  readonly timezoneOffset: number | null; // -18000 (UTC-5)
  readonly isDayTime: boolean; // true
}
```

---

## 4. Frontend Layer

### 4.1 Server-Side Fetch

**File:** `src/lib/weather/fetch-weather.ts` (272 lines)

`getWeatherIndex()` is called in server components (page.tsx) at build/request time.

1. Fetches `GET ${GATEWAY_URL}/weather` with a 5-second timeout.
2. Server-side cache: `next: { revalidate: 300 }` (5 minutes).
3. Converts each `GatewayWeatherItem` → `ExchangeWeatherData` via `toWeatherData()`.
4. **Demo gap-fill:** After mapping live data, iterates over all 89 demo entries. Any exchange missing from the live set gets demo data inserted. Result: always 89 entries, zero gaps in the UI.
5. Fallback: If gateway is unreachable or returns empty, falls back entirely to demo data via `buildDemoIndex()`.

**`toWeatherData(item) → ExchangeWeatherData`**

Maps gateway fields to the card's weather type. Pipes through all day/night fields and new lighting engine fields:

```typescript
{
  tempC: item.temperatureC,
  tempF: item.temperatureF,
  emoji: item.emoji,
  condition: item.conditions,
  humidity: item.humidity,
  windKmh: item.windSpeedKmh,
  description: item.description,
  cloudCover: item.cloudCover,         // v6.0
  visibility: item.visibility,         // v6.0
  pressure: item.pressure,             // v6.0
  rainMm1h: item.rainMm1h ?? null,    // v8.0
  snowMm1h: item.snowMm1h ?? null,    // v8.0
  windDegrees: item.windDegrees ?? null, // v8.0
  windGustKmh: item.windGustKmh ?? null, // v8.0
  sunriseUtc: item.sunriseUtc ?? null,
  sunsetUtc: item.sunsetUtc ?? null,
  timezoneOffset: item.timezoneOffset ?? null,
  isDayTime: item.isDayTime ?? undefined,
}
```

**`demoToWeatherData(item) → ExchangeWeatherData`**

Demo data has **no** `description`, `sunriseUtc`, `sunsetUtc`, `timezoneOffset`, `isDayTime`, `cloudCover`, `visibility`, `pressure`, `rainMm1h`, `snowMm1h`, `windDegrees`, or `windGustKmh`. All set to `undefined`. This intentionally triggers fallback paths in the prompt generator, day/night detection, lighting engine, and precipitation classification.

### 4.2 API Route (Proxy)

**File:** `src/app/api/weather/route.ts` (171 lines)

A simple proxy from the Vercel frontend to the Fly.io gateway. No authentication required (weather is public data). Sets cache headers based on data freshness mode:

- `live` / `cached` → `Cache-Control: public, max-age=300, stale-while-revalidate=600`
- Others → `Cache-Control: public, max-age=60`
- Errors → `Cache-Control: no-store`

Returns `502` on gateway failure, `504` on timeout, `500` on other errors.

### 4.3 Demo Weather (Algorithmic Fallback)

**File:** `src/data/weather/exchange-weather.demo.ts` (907 lines)

Generates plausible weather for all 89 exchanges using pure maths (no API). Four models combine:

1. **Seasonal** — Sinusoidal curve keyed to latitude, hemisphere, and month. Dubai runs hot year-round; Helsinki swings dramatically.
2. **Diurnal** — Cosine curve peaking at ~14:30 local time, amplitude scaled by climate aridity (Dubai: ±7°C swing, London: ±3°C).
3. **Condition** — Deterministic per city per day via stable hash of exchange ID + day-of-year, weighted by climate type and season.
4. **Night adjustment** — Emoji swaps (☀️ → 🌙), cloudy nights reduce cooling effect.

The demo module exports a `DEMO_EXCHANGE_WEATHER` array (computed once at module load) and a `getDynamicDemoWeather(date?)` function for testing with specific dates.

**Key limitation:** Demo data has no `description`, `cloudCover`, `visibility`, or `pressure` fields. Only live API data provides these. This means demo prompts use fallback paths: emoji-matched condition phrases for sky, and a simplified lighting fallback (time-based only, no procedural assembly).

---

## 5. Type System

### 5.1 ExchangeWeatherData (Card Input)

**File:** `src/components/exchanges/types.ts` (187 lines)

The unified weather shape consumed by exchange cards. All day/night and lighting fields are optional for backward compatibility with demo data.

```typescript
type ExchangeWeatherData = {
  tempC: number | null;
  tempF?: number | null;
  emoji: string | null;
  condition?: string | null;
  humidity?: number | null;
  windKmh?: number | null;
  windSpeedKmh?: number | null;
  description?: string | null;
  sunriseUtc?: number | null;
  sunsetUtc?: number | null;
  timezoneOffset?: number | null;
  isDayTime?: boolean | null;
  cloudCover?: number | null; // v6.0 — cloud percentage for lighting engine
  visibility?: number | null; // v6.0 — metres, for atmosphere modifier
  pressure?: number | null; // v6.0 — hPa, for stability modifier
  rainMm1h?: number | null; // v8.0 — OWM rain.1h
  snowMm1h?: number | null; // v8.0 — OWM snow.1h
  windDegrees?: number | null; // v8.0 — OWM wind.deg
  windGustKmh?: number | null; // v8.0 — OWM wind.gust
  weatherId?: number | null; // v9.5.0 — OWM weather[0].id (cloud type classification)
};
```

**Field count:** 20 (was 19 in v8.0 — `weatherId` added v9.5.0).

### 5.2 ExchangeWeatherFull (Prompt Generator Input)

**File:** `src/lib/weather/weather-types.ts` (336 lines)

The full weather type used internally by the prompt generator. All fields required (with null for missing).

```typescript
interface ExchangeWeatherFull {
  temperatureC: number;
  temperatureF: number;
  conditions: string;
  description: string;
  humidity: number;
  windSpeedKmh: number;
  emoji: string;
  sunriseUtc: number | null;
  sunsetUtc: number | null;
  timezoneOffset: number | null;
  isDayTime: boolean | null;
  cloudCover: number | null; // v6.0
  visibility: number | null; // v6.0
  pressure: number | null; // v6.0
  rainMm1h: number | null; // v8.0 — OWM rain.1h (mm in last hour)
  snowMm1h: number | null; // v8.0 — OWM snow.1h (mm in last hour)
  windDegrees: number | null; // v8.0 — OWM wind.deg (meteorological degrees)
  windGustKmh: number | null; // v8.0 — OWM wind.gust × 3.6
  weatherId: number | null; // v9.5.0 — OWM weather[0].id (cloud type classification)
}
```

**Field count:** 19 (was 18 in v8.0 — `weatherId` added v9.5.0).

### 5.2A ExchangeWeatherDisplay (Display Format)

**File:** `src/lib/weather/weather-types.ts` (336 lines)

Intermediate display type used by exchange card components. All fields required with `| null` for missing data.

```typescript
interface ExchangeWeatherDisplay {
  tempC: number | null;
  tempF: number | null;
  emoji: string | null;
  condition: string | null;
  humidity: number | null;
  windKmh: number | null;
  description: string | null;
  sunriseUtc: number | null;
  sunsetUtc: number | null;
  timezoneOffset: number | null;
  isDayTime: boolean | null;
  cloudCover: number | null;
  visibility: number | null;
  pressure: number | null;
  rainMm1h: number | null;
  snowMm1h: number | null;
  windDegrees: number | null;
  windGustKmh: number | null;
  weatherId: number | null; // v9.5.0 — OWM weather[0].id
}
```

**Field count:** 19 (was 18 in v8.0 — `weatherId` added v9.5.0).

### 5.2B GatewayWeatherItem (Gateway Response)

**File:** `src/lib/weather/fetch-weather.ts` (275 lines)

Shape received from the Fly.io gateway. Optional fields were added incrementally across versions.

```typescript
interface GatewayWeatherItem {
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
  sunriseUtc?: number | null;
  sunsetUtc?: number | null;
  timezoneOffset?: number | null;
  isDayTime?: boolean;
  cloudCover?: number | null; // v6.0
  visibility?: number | null; // v6.0
  pressure?: number | null; // v6.0
  rainMm1h?: number | null; // v8.0
  snowMm1h?: number | null; // v8.0
  windDegrees?: number | null; // v8.0
  windGustKmh?: number | null; // v8.0
  weatherId?: number | null; // v9.5.0
}
```

**Conversion functions:**

- `toWeatherData(item) → ExchangeWeatherData` — Gateway → card data. Pipes all fields including `weatherId`.
- `toDisplayWeather(full) → ExchangeWeatherDisplay` — Full → display format. Null branch returns all-null object.
- `toFullWeather(display) → ExchangeWeatherFull | null` — Display → full format, filling missing values with defaults (`humidity: 50`, `windKmh: 5`, `emoji: '🌤️'`, all optional fields → `null`).
- `getTemperatureColor(tempC) → hex` — Maps temperature to glow colour (blue → green → amber → red).
- `getWeatherEmoji(condition) → emoji` — Maps condition string to emoji.

**v9.5.0 addition:** `weatherId` piped through all 5 type interfaces (GatewayWeatherItem → ExchangeWeatherData → ExchangeWeatherDisplay → ExchangeWeatherFull). Used by `classifyCloudType()` in `cloud-types.ts` for precise OWM weather code → visual cloud type mapping.

### 5.3 ExchangeCardData (Card Component)

**File:** `src/components/exchanges/types.ts` (187 lines)

```typescript
type ExchangeCardData = {
  id: string;
  name: string;
  ribbonLabel?: string;
  city: string;
  countryCode: string;
  tz: string;
  hoursTemplate?: string;
  weather?: ExchangeWeatherData | null;
  indexName?: string;
  indexQuote?: IndexQuoteData | null;
  hoverColor?: string;
  latitude?: number; // For astronomical sunrise/sunset fallback + solar elevation
  longitude?: number; // For astronomical sunrise/sunset fallback + solar elevation
};
```

### 5.4 Data Adapter

**File:** `src/components/exchanges/adapters.ts` (123 lines)

`toCardData(exchange, weather?, indexQuote?) → ExchangeCardData`

Converts a canonical `Exchange` (from `exchanges.catalog.json`) to the card's data shape. Pipes through `latitude` and `longitude` from the catalog for the astronomical sunrise/sunset fallback and the solar elevation calculation in the lighting engine.

---

## 6. Exchange Card Component

**File:** `src/components/exchanges/exchange-card.tsx` (668 lines)

### 6.1 Snap-Fit Scaling

The card uses a CSS variable approach for proportional scaling:

1. `ResizeObserver` watches card container width.
2. Computes base font: `cardWidth × FONT_SCALE`, clamped to `[MIN, MAX]`.
3. Sets `fontSize` on the card root element.
4. All child text uses `em`-relative sizes (e.g. `0.85em`, `0.65em`, `1.3em`).
5. Everything scales proportionally in lockstep.

### 6.2 Component Hierarchy

```
ExchangeCard (root)
├── Left Section
│   ├── Exchange Name + City + Flag (with WeatherPromptTooltip)
│   ├── LedClock + MarketStatusIndicator
│   └── IndexRow (price, change, percent)
└── Right Section
    └── WeatherSection
        ├── Row 1: Temperature + Weather/Moon emoji (with WeatherEmojiTooltip)
        ├── Row 2: Wind speed + dynamic wind emoji
        └── Row 3: Humidity percentage
```

### 6.3 Day/Night Detection — 3-Tier Cascade

**Function:** `resolveIsNight(isDayTime, tz, sunriseUtc, sunsetUtc, timezoneOffset) → boolean`

Determines whether it's night at a given exchange, used to swap the weather emoji for a moon phase emoji.

| Tier | Source                                                   | Accuracy                             | Availability                        |
| ---- | -------------------------------------------------------- | ------------------------------------ | ----------------------------------- |
| 1    | `isDayTime` boolean from gateway (OWM icon suffix)       | Exact (OWM uses real sunrise/sunset) | Live data only                      |
| 2    | `sunriseUtc` / `sunsetUtc` timestamps + `timezoneOffset` | Exact (OWM API values)               | Live data only                      |
| 3    | IANA timezone → local hour check (`< 6` or `≥ 19`)       | Approximate (±30 min)                | Always (all 89 exchanges have `tz`) |

Fallback: If all three tiers fail, assumes daytime (safest default — shows weather emoji, not moon).

### 6.4 Emoji Selection

```typescript
const isNight = resolveIsNight(isDayTime, tz, sunriseUtc, sunsetUtc, timezoneOffset);
const displayEmoji = isNight ? getMoonPhase().emoji : emoji;
```

At night: the weather emoji (e.g. ☀️, 🌧️) is replaced by the current moon phase emoji (e.g. 🌕, 🌒).

### 6.5 Wind Emoji

**Function:** `getWindEmoji(windKmh) → string`

| Speed (km/h) | Emoji | Label         |
| ------------ | ----- | ------------- |
| 0–5          | 🍃    | Calm          |
| 6–19         | 🌬️    | Light breeze  |
| 20–39        | 💨    | Moderate wind |
| 40–61        | 🌪️    | Strong wind   |
| 62+          | 🌀    | Gale/Storm    |

### 6.6 Temperature Glow

**Function:** `getTemperatureColor(tempC) → hex`

| Range     | Colour    | Hex       |
| --------- | --------- | --------- |
| Below 0°C | Deep blue | `#3B82F6` |
| 0–9°C     | Ice blue  | `#60A5FA` |
| 10–14°C   | Cyan      | `#22D3EE` |
| 15–19°C   | Green     | `#22C55E` |
| 20–24°C   | Amber     | `#F59E0B` |
| 25–29°C   | Orange    | `#F97316` |
| 30°C+     | Red       | `#EF4444` |

Used by both the emoji tooltip and the prompt tooltip for border glow, box shadow, and radial gradient overlays.

---

## 7. Weather Emoji Tooltip

**File:** `src/components/exchanges/weather/weather-emoji-tooltip.tsx` (508 lines)

### 7.1 Purpose

Informational tooltip on hover over the weather/moon emoji. Displays a single coherent sentence with conditions, moon phase and real-time position (day and night), and next sun event. Moon position updates every 15 minutes with the weather refresh cycle.

**Examples:**

- Day + above horizon: _"Few clouds over Wellington. Waxing crescent moon, currently located high in the northern sky at +58°. Sunset at 20:22."_
- Day + mid-sky: _"Broken clouds over Bangkok. Waxing crescent moon, currently located mid-sky in the west at +45°. Sunset at 18:23."_
- Night + above horizon: _"Overcast clouds over Chicago. Waxing crescent moon, currently located in the western, mid sky at +15°. Sunrise at 06:43."_
- Night + below horizon: _"Overcast clouds over London. The Waxing crescent moon is currently below the horizon in the northern sky at -48°. Sunrise at 07:09."_
- Day + below horizon: _"Clear sky over Sydney. The Waxing crescent moon is currently below the horizon in the eastern sky at -12°. Sunset at 17:47."_
- No lat/lon (backward compat): _"Clear sky over Sydney. Waxing crescent moon. Sunset at 17:47."_

### 7.2 Visual Specs

| Property         | Value                                       |
| ---------------- | ------------------------------------------- |
| Width            | 320px                                       |
| Background       | `rgba(15, 23, 42, 0.97)` (dark glass)       |
| Border           | Temperature-coloured glow at 50% opacity    |
| Box shadow       | Triple-layer glow (40px, 80px, inset 25px)  |
| Radial gradients | Top ellipse + bottom accent                 |
| Close delay      | 400ms (matches prompt tooltip)              |
| Rendering        | React Portal to `document.body`             |
| Copy button      | Yes — clipboard API with checkmark feedback |

### 7.3 Content Construction (v6.1 — Rewritten)

**Function:** `buildTooltipText(city, description, isNight, sunEvent, latitude?, longitude?) → string`

1. **Weather over city** — Capitalises the OWM description: `"Broken clouds over Taipei."`. Falls back to `"Weather over Taipei."` when description is null (demo data).
2. **Moon phase + position** (always, day and night) — Calls `getMoonPhase()` for phase name and `getLunarPosition(lat, lon)` for real-time altitude/azimuth. Handles names that already contain "moon" (e.g. "New Moon", "Full Moon") to avoid "New Moon moon." duplication.
3. **Sun event** — `"Sunset at 20:22."` or `"Sunrise at 06:43."` via the 2-tier sun event cascade.

**v6.1 change:** Moon is now always shown (day and night, above and below horizon). Word order differs by day/night and altitude bin. Position data requires lat/lon — falls back to phase-only when coordinates are unavailable.

### 7.4 Moon Position Word Order (v6.1 — New)

The `buildMoonPositionPhrase()` function generates day/night-specific wording:

**Helper:** `azimuthToDirection()` converts adjectives to nouns: `"northern"` → `"north"`, `"south-western"` → `"south-west"`.

**Daytime word order** — altitude descriptor leads:

| Altitude Bin         | Output Format                                     | Example                                 |
| -------------------- | ------------------------------------------------- | --------------------------------------- |
| near overhead (60°+) | `near overhead at {alt}°`                         | `near overhead at +72°`                 |
| high (35–60°)        | `high in the {azimuthBin} sky at {alt}°`          | `high in the northern sky at +58°`      |
| mid-sky (15–35°)     | `mid-sky in the {direction} at {alt}°`            | `mid-sky in the west at +25°`           |
| low (0–15°)          | `low on the horizon in the {direction} at {alt}°` | `low on the horizon in the east at +5°` |

**Nighttime word order** — azimuth leads, altitude follows:

| Altitude Bin         | Output Format                                       | Example                                     |
| -------------------- | --------------------------------------------------- | ------------------------------------------- |
| near overhead (60°+) | `near overhead at {alt}°`                           | `near overhead at +72°`                     |
| high (35–60°)        | `in the {azimuthBin}, high sky at {alt}°`           | `in the northern, high sky at +45°`         |
| mid (15–35°)         | `in the {azimuthBin}, mid sky at {alt}°`            | `in the south-western, mid sky at +25°`     |
| low (0–15°)          | `in the {azimuthBin}, low on the horizon at {alt}°` | `in the eastern, low on the horizon at +5°` |

**Below horizon (day or night)** — same wording regardless of day/night:

```
The {moonLabel} is currently below the horizon in the {azimuthBin} sky at {alt}°.
```

Example: `"The Waxing crescent moon is currently below the horizon in the northern sky at -48°."`

**Edge cases:**

- "near overhead" drops direction for both day and night (azimuth meaningless directly above).
- "low on the horizon" at night drops "sky" since "horizon" already implies it.
- "mid-sky" at daytime uses cardinal direction noun ("west") not adjective ("western") to avoid double "sky".

### 7.5 Sun Event Cascade

**Function:** `getNextSunEvent(isNight, tz, sunriseUtc?, sunsetUtc?, latitude?, longitude?) → { label, time } | null`

**File:** `src/lib/weather/sun-calculator.ts` (562 lines)

| Tier | Source                                                | Accuracy   | When Used                           |
| ---- | ----------------------------------------------------- | ---------- | ----------------------------------- |
| 1    | OWM API timestamps (`sunriseUtc` / `sunsetUtc`)       | Exact      | Live data with valid timestamps     |
| 2    | NOAA astronomical calculation (`calculateSunTimes()`) | ±5 minutes | Demo data or missing API timestamps |

Logic: At night → show next sunrise. During day → show next sunset.

All 89 exchanges have `latitude` and `longitude` in the catalog, so Tier 2 is always available as fallback. None of the 89 exchanges are in polar regions, so `calculateSunTimes()` never returns null in practice.

---

## 8. NOAA Solar Calculator

**File:** `src/lib/weather/sun-calculator.ts` (562 lines)

Pure mathematics implementation of the NOAA simplified solar position algorithm. No API calls, works offline.

### 8.1 Algorithm Steps

1. **Julian Day Number** from UTC date (Meeus, _Astronomical Algorithms_).
2. **Solar Mean Anomaly** (M) from days since J2000.0 epoch.
3. **Equation of Center** (C) — 3-term sine series.
4. **Ecliptic Longitude** (λ) = M + C + 180° + 102.9372°.
5. **Solar Transit** (solar noon) in Julian Date.
6. **Declination** from ecliptic longitude and obliquity (23.4393°).
7. **Hour Angle** from latitude + declination at 90.833° zenith (includes atmospheric refraction).
8. **Sunrise** = solar noon − hour angle / 360. **Sunset** = solar noon + hour angle / 360.

### 8.2 Solar Elevation (v6.0 — New)

The same NOAA algorithm provides solar elevation for the lighting engine:

```
elevation = arcsin(sin(lat) × sin(declination) + cos(lat) × cos(declination) × cos(hour_angle))
```

This is calculated from latitude, longitude, day-of-year, and local hour. Pure astronomy — no API. Deterministic: same inputs always produce the same elevation.

Solar elevation feeds directly into the lighting engine as the base light descriptor (§11A.2).

### 8.3 Output

```typescript
interface SunTimes {
  sunriseUTC: Date;
  sunsetUTC: Date;
  sunriseLocal: string; // "6:23 AM" (formatted via Intl.DateTimeFormat)
  sunsetLocal: string; // "5:47 PM"
}

function getSolarElevation(lat: number, lon: number, date: Date): number;
// Returns degrees. Positive = above horizon. Negative = below horizon.
```

Returns `null` for polar regions where the sun doesn't rise or set (not applicable to any of the 89 exchanges).

### 8.4 Lunar Position Calculator (v6.1 — New)

**File:** `src/lib/weather/sun-calculator.ts` (lines 332–562)

Calculates the Moon's real-time altitude and azimuth for any location and time. Uses the simplified Meeus lunar ephemeris with 6 perturbation terms for ecliptic longitude and 5 for ecliptic latitude. Converts through ecliptic → equatorial → horizontal coordinate systems.

**Accuracy:** ~1° altitude, ~2° azimuth. Sufficient for the 5-band altitude binning and 8-sector compass direction used in tooltips and prompts.

**Algorithm steps:**

1. Julian Day Number from UTC date (same as solar calculator).
2. Mean lunar elements: Lp (mean longitude), Mp (mean anomaly), D (mean elongation), F (argument of latitude), Ms (solar mean anomaly).
3. Ecliptic longitude corrections (6 terms): +6.289° sin(Mp), +1.274° sin(2D−Mp), +0.658° sin(2D), +0.214° sin(2Mp), −0.186° sin(Ms), −0.114° sin(2F).
4. Ecliptic latitude corrections (5 terms): +5.128° sin(F), +0.281° sin(Mp+F), +0.278° sin(Mp−F), +0.173° sin(2D−F), +0.055° sin(2D−Mp+F).
5. Ecliptic → equatorial: Right ascension and declination via obliquity (23.4393°).
6. Hour angle from GMST + observer longitude − RA.
7. Horizontal: altitude = arcsin(sin(lat)·sin(dec) + cos(lat)·cos(dec)·cos(HA)). Azimuth from declination, latitude, altitude, and hour angle sign.

**Binning:**

| Altitude | Bin Descriptor         |
| -------- | ---------------------- |
| ≤ 0°     | `null` (below horizon) |
| 0–15°    | `low on the horizon`   |
| 15–35°   | `mid-sky`              |
| 35–60°   | `high in the sky`      |
| 60°+     | `near overhead`        |

| Azimuth  | Bin Direction   |
| -------- | --------------- |
| 337–22°  | `northern`      |
| 22–67°   | `north-eastern` |
| 67–112°  | `eastern`       |
| 112–157° | `south-eastern` |
| 157–202° | `southern`      |
| 202–247° | `south-western` |
| 247–292° | `western`       |
| 292–337° | `north-western` |

**Combined position phrase:** altitude bin + azimuth bin → e.g. `"low on the horizon in the eastern sky"`, `"high in the north-western sky"`, `"near overhead"` (no direction). Returns `null` when below horizon.

```typescript
export interface LunarPosition {
  altitude: number; // Degrees. Positive = above horizon.
  azimuth: number; // 0–360. 0=North, 90=East, 180=South, 270=West.
  altitudeBin: string | null; // "low on the horizon", "mid-sky", etc. null if below.
  azimuthBin: string; // "northern", "south-western", etc.
  positionPhrase: string | null; // Combined. null if below horizon.
}

export function getLunarPosition(
  latitude: number,
  longitude: number,
  date?: Date, // Defaults to new Date()
): LunarPosition;
```

**Consumers:**

- **Weather emoji tooltip** (§7) — always-on moon position display, day and night.
- **Prompt generator** (§11A.3) — moon position phrase in prompt, gated on altitude > 0° AND cloud ≤ 75% AND visibility ≥ 3000m.
- **Night competition model** (§11A.3) — lunar altitude drives altitude attenuation factor in moonlight vs urban glow competition.

---

## 9. Moon Phase System

**File:** `src/lib/weather/sun-calculator.ts` (562 lines)

### 9.1 Calculation

Pure astronomy — no API. The lunar synodic cycle is **29.53058770576 days**. Using a known reference new moon (6 January 2000 at 18:14 UTC), the function calculates days elapsed, mods by the synodic period, and maps to one of 8 phases.

Moon phase is **global** — every location on Earth sees the same phase on the same date.

### 9.2 Eight Phases

| Phase           | Emoji | Day Range   | Prompt Phrases |
| --------------- | ----- | ----------- | -------------- |
| New Moon        | 🌑    | 0–1.85      | 5 phrases      |
| Waxing Crescent | 🌒    | 1.85–7.38   | 5 phrases      |
| First Quarter   | 🌓    | 7.38–11.07  | 5 phrases      |
| Waxing Gibbous  | 🌔    | 11.07–14.76 | 5 phrases      |
| Full Moon       | 🌕    | 14.76–16.61 | 5 phrases      |
| Waning Gibbous  | 🌖    | 16.61–22.14 | 5 phrases      |
| Last Quarter    | 🌗    | 22.14–25.83 | 5 phrases      |
| Waning Crescent | 🌘    | 25.83–29.53 | 5 phrases      |

**Total: 40 rich prompt phrases** (e.g. "brilliant full moon casting sharp shadows", "thin waning crescent moon vanishing arc").

Phrase selection is **seeded by day-of-year** for deterministic variety — same day always picks same phrase, but different days rotate through the 5 options.

### 9.3 Function Signature

```typescript
function getMoonPhase(date?: Date): MoonPhaseInfo;

interface MoonPhaseInfo {
  readonly name: string; // "Full Moon"
  readonly emoji: string; // "🌕"
  readonly promptPhrase: string; // "brilliant full moon casting sharp shadows"
  readonly dayInCycle: number; // 15.2
}
```

---

## 10. Image Prompt Tooltip

**File:** `src/components/exchanges/weather/weather-prompt-tooltip.tsx` (525 lines)

### 10.1 Purpose

Generates AI-ready image prompts from live weather data. Triggered by hovering the country flag on an exchange card.

### 10.2 Visual Specs

| Property       | Value                                        |
| -------------- | -------------------------------------------- |
| Width          | 450px                                        |
| Background     | `rgba(15, 23, 42, 0.97)` (dark glass)        |
| Border         | Temperature-coloured glow at 50% opacity     |
| Box shadow     | Triple-layer glow (same as emoji tooltip)    |
| Close delay    | 400ms                                        |
| Rendering      | React Portal to `document.body`              |
| Copy button    | Yes — clipboard API with checkmark feedback  |
| Tier indicator | Shows current tier + Pro badge if applicable |

### 10.3 Interaction

- **Free users:** Locked to **Tier 3** (Natural Language — DALL·E, Imagen, Firefly).
- **Pro users:** Can select any tier (1–4) via the tooltip UI. Selection persists to `localStorage`.
- **Copy button:** Copies generated prompt to clipboard. Shows green checkmark on success.

---

## 11. 4-Tier Prompt System

**Files:** `src/lib/weather/weather-prompt-generator.ts` (320-line orchestrator) → dispatches to 17 subsystem modules (7,118 lines total) — **v9.6**

### 11.1 Tier Definitions

| Tier | Name             | Format                                                          | Target Platforms                                  | Default       |
| ---- | ---------------- | --------------------------------------------------------------- | ------------------------------------------------- | ------------- |
| 1    | CLIP-Based       | Weighted keywords `(keyword:1.2)`                               | Stable Diffusion, Leonardo, ComfyUI               |               |
| 1F   | Flux (T5)        | Natural phrases, no weights                                     | Flux, Flux Pro, Flux Dev                          |               |
| 2    | Midjourney       | V7/V6.1 natural language or V5.2 `::` weights + `--` parameters | Midjourney, BlueWillow, Niji                      |               |
| 3    | Natural Language | Full descriptive sentences                                      | DALL·E, Imagen, Adobe Firefly, Bing Image Creator | **★ Default** |
| 4    | Plain Language   | Simple, minimal prompts                                         | Canva, Craiyon, Artistly, Microsoft Designer      |               |

**Default: Tier 3.** Testing showed Tier 4's flat comma-list lost time-of-day context entirely on plain language generators. Tier 3's sentence structure produces accurate time-of-day rendering on DALL·E, Imagen, and Firefly.

**v9.6.0 changes:** Tier 1F is a parallel output (returned in `fluxPrompt` field alongside CLIP T1) — not a user-selectable tier. Flux moved from T1 targets because T5 doesn't understand CLIP weight syntax (§11K.1). Tier 2 format now branches by `profile.mjVersion`: V5.2 retains `::` weights, V6.1/V7 uses natural language (§11K.2).

### 11.2 Element Ordering (v6.0)

Each tier has a platform-optimal element ordering based on how its target platforms parse prompts. **v6.0 changes:** Activities removed (venue-only). Lighting element added. Wind uses template descriptor + exact API speed. Tier orderings rebuilt for all 4 tiers.

**Tier 1 — CLIP-Based:** Weights override position. CLIP tokenises independently. v8.0: Returns `WeatherPromptResult` with split `positive`/`negative` fields. Quality tags from `STYLE_QUALITY_TAGS[profile.style]` (default: `professional photography, sharp focus, high resolution`). Token guard caps at `VERBOSITY_T1_LIMIT[profile.verbosity]` parts (default: 15 ≈ 60 CLIP tokens). Drops time/grounding/moisture before quality tags when over budget.

```
(City:1.3) → (Venue:1.2) → (Lighting:1.3, comma-separated tokens) → (Moon:1.2) →
(Sky:1.1, conditional) → Temp → Wind → Humidity → Time → quality tags → --no
```

- Lighting shares top weight (1.3) with city — it is the visual foundation.
- Lighting rendered as **comma-separated independent tokens**, each weighted individually. Primary light source gets highest weight; modifiers unweighted or lower.
  - Example: `(faint moonlight:1.3), amber city glow, light haze`
  - NOT compressed: ~~`(faint moonlight amber city glow hazy:1.3)`~~
- Sky conditionally omitted when lighting already encodes cloud state (§11A.7).
- Time stays at position 9 — CLIP weight values control importance, not position.

**Tier 2 — Midjourney:** v8.0 (Chat 6) replaces the old dash-break folklore with Midjourney's native `::` multi-prompt weight syntax. **v9.6.0:** Format now branches by `profile.mjVersion` — V5.2 retains `::` weights below; V6.1/V7 uses natural language with period-separated scene breaks (see §11K.2). Three weighted segments (V5.2 legacy):

```
lighting+time::2  venue+sky+weather::1  surface::0.5
```

- **Seg 1 (::2):** Lighting + time — defines colour palette and mood. MJ gives ~60% attention to first segment; `::2` reinforces.
- **Seg 2 (::1):** Venue + sky + weather — the scene content.
- **Seg 3 (::0.5):** Surface detail (moisture, thermal) — lowest priority, adds realism. Dropped when over ~40 word budget.
- Parameters from profile: `--ar {profile.mjAspect} --stylize {profile.mjStylize}` (defaults: `--ar 16:9 --stylize 100`).
- People exclusion via `shouldExcludePeople()`: appends `--no people text` when active.

**Tier 3 — Natural Language (DEFAULT):** Parsed like a story. Full NLP understanding.

```
Sentence 1: "A [Time] scene in [City] at [Venue]."
Sentence 2: "[Lighting — causal structure]. [Sky — conditional]."
Sentence 3: "Under a [Moon]." (night only)
Sentence 4: "The air carries [Wind] and [Humidity], with [Temp]."
Sentence 5: "[getSettingEnding(venue, profile.style)]"
```

- v8.0 (Chat 4): Hardcoded `"Photorealistic, highly detailed urban landscape."` replaced with `getSettingEnding()` — returns venue-appropriate directives: street/narrow/market/plaza → `"city scene"`, waterfront/beach → `"coastal scene"`, monument → `"landmark scene"`, park → `"landscape scene"`, elevated → `"skyline view"`. Prefix from `STYLE_ENDING_PREFIX[profile.style]` (default: `"Photorealistic"`).

- Lighting gets its own sentence with **causal structure**: source → modifier → result.
  - Example: `"Faint crescent moonlight is diffused by light haze and reflected from broken cloud."`
  - NOT descriptive stacking: ~~`"mixing with scattered amber city glow"`~~
- Wind, humidity, and temperature grouped in one sentence — NLP models understand these are related atmospheric properties.
- Sky conditionally omitted when lighting sentence already encodes cloud state (§11A.7).

**Tier 4 — Plain Language:** Weakest parsers. Keyword-scan, left-to-right, diminishing attention. First 5-7 tokens carry ~70% of image influence.

```
City → Venue → Lighting → Time → Sky (conditional) → Moon (night) → Wind → Humidity → Temp → Directive
```

- v8.0 (Chat 4): **Fragment limit** — Hard cap of `VERBOSITY_T4_LIMIT[profile.verbosity]` comma items (default: 10). Priority-based dropping: grounding → sky → moon → thermal → moisture (least visual impact first).
- v8.0 (Chat 4): **Period nouns** — `getTimePeriod(hour)` returns simple nouns (`"dawn"`, `"dusk"`, `"night"`, `"midday"`) instead of clock phrases (`"seven in the evening"`). Weak parsers handle concrete nouns better.
- **Lighting before Time.** "golden-hour sunlight" is a concrete visual instruction. "two in the afternoon" is an abstract clock reading. Weak parsers grab the concrete token first.
- **Moon moved from last to slot 6.** At night, moon is visually critical — shouldn't be buried where weak parsers truncate.
- **Temperature deliberately last (before directive).** Least visual element. If the model catches it, it adds heat shimmer or tropical foliage. If it ignores it, nothing lost.
- Directive always final — it's a constraint, not a visual.

**`getTimePeriod(hour)` bins (v8.0):**

| Hour  | Period       | Hour  | Period          |
| ----- | ------------ | ----- | --------------- |
| 0–4   | deep night   | 12    | midday          |
| 5     | pre-dawn     | 13–14 | early afternoon |
| 6     | dawn         | 15–16 | late afternoon  |
| 7–9   | morning      | 17–18 | early evening   |
| 10–11 | late morning | 19    | dusk            |
|       |              | 20    | twilight        |
|       |              | 21–22 | night           |
|       |              | 23    | late night      |

**Ordering Matrix (v6.0):**

| Element      | Tier 1 (CLIP) | Tier 2 (MJ) | Tier 3 (NatLang) | Tier 4 (Plain) |
| ------------ | :-----------: | :---------: | :--------------: | :------------: |
| City         |      1st      |     2nd     |       1st        |      1st       |
| Venue        |      2nd      |     2nd     |       1st        |      2nd       |
| **Lighting** |    **3rd**    |   **1st**   |     **2nd**      |    **3rd**     |
| Time         |      9th      |     1st     |       1st        |      4th       |
| Sky          |  4th (cond)   | 3rd (cond)  |    2nd (cond)    |   5th (cond)   |
| Moon         |      5th      |     4th     |       3rd        |      6th       |
| Wind         |      6th      |     5th     |       4th        |      7th       |
| Humidity     |      7th      |     6th     |       4th        |      8th       |
| Temp         |      8th      |     7th     |       4th        |      9th       |
| Directive    |   --no tag    |  --no tag   |    5th (last)    |  10th (last)   |

_(cond) = conditionally included, see §11A.7 Sky/Lighting Duplication Rule_

### 11.3 City Scene Model (Venue-Only) — v6.0 / v7.5+ Venue Settings / v7.7 Enrichment / v8.0 Taxonomy

**File:** `src/data/vocabulary/weather/city-vibes.json`

**v6.0 change:** Activities removed. The scene model now provides **venue-only** location-specific subjects for 83 cities. Activities were the source of quiet-hours contradictions ("beach volleyball at 3am") and have been eliminated.

**v7.5 change:** Every venue carries a `setting` field (one of 9 types). The setting drives venue-aware lighting: dedicated night light pools for non-urban settings, per-setting urban attenuation factors, and coherence validation against banned commercial terms. See §11A.3 for details.

**v7.7 change:** 25 venues across 19 cities carry an optional `lightCharacter` array of 3 venue-specific night light phrases. When present, these override both the setting pool and city lightCharacter at night — the highest-priority tier in the 3-tier light phrase system (§11A.3).

**v8.0 change:** Venue taxonomy validated and hardened. 7 misclassified venues reclassified in `city-vibes.json`. 15 venues carry `overrideJustification` strings documenting why their name contradicts their setting. `SETTING_OVERRIDES` runtime safety net in `getCityVenue()`. Standalone CI linter `scripts/lint-venues.ts` (see §11D).

| Metric                           | Count                     |
| -------------------------------- | ------------------------- |
| Cities                           | 83                        |
| Total venues                     | 842                       |
| Average venues/city              | ~10                       |
| Venue settings (types)           | 9                         |
| Enriched venues (lightCharacter) | 25                        |
| Enrichment phrases               | 75 (3 per enriched venue) |
| Justified overrides (v8.0)       | 15                        |

**Venue setting distribution:**

| Setting      | Count | Lighting behaviour                                             |
| ------------ | ----- | -------------------------------------------------------------- |
| `monument`   | 169   | Setting pool: heritage floodlights, uplighting on stone        |
| `waterfront` | 138   | Uses city lightCharacter (urban setting)                       |
| `street`     | 120   | Uses city lightCharacter (urban setting)                       |
| `park`       | 118   | Setting pool: lamppost pools, path lighting, bollard lights    |
| `market`     | 107   | Uses city lightCharacter (urban setting, slight attenuation)   |
| `plaza`      | 79    | Uses city lightCharacter (urban setting, moderate attenuation) |
| `elevated`   | 54    | Setting pool: city glow from below, observation lamps          |
| `narrow`     | 31    | Uses city lightCharacter (urban setting)                       |
| `beach`      | 26    | Setting pool: boardwalk lamps, pier lights, string lights      |

**Enriched venues (v7.7):** 25 venues with venue-specific `lightCharacter[]`:

| City      | Venue                   | Setting  | Phrases |
| --------- | ----------------------- | -------- | ------- |
| Athens    | Acropolis               | monument | 3       |
| Athens    | Parthenon               | monument | 3       |
| Bangkok   | Lumpini Park            | park     | 3       |
| Bangkok   | Wat Arun                | monument | 3       |
| Budapest  | Hungarian Parliament    | monument | 3       |
| Cairo     | Giza Plateau            | monument | 3       |
| Chicago   | Millennium Park         | park     | 3       |
| Chicago   | Oak Street Beach        | beach    | 3       |
| Dubai     | Jumeirah Beach          | beach    | 3       |
| Hong Kong | Victoria Peak           | elevated | 3       |
| Istanbul  | Galata Tower            | elevated | 3       |
| London    | Hyde Park               | park     | 3       |
| Moscow    | Gorky Park              | park     | 3       |
| Moscow    | Sparrow Hills           | elevated | 3       |
| Mumbai    | Juhu Beach              | beach    | 3       |
| New York  | Central Park Bethesda   | park     | 3       |
| New York  | Coney Island            | beach    | 3       |
| Paris     | Eiffel Tower            | monument | 3       |
| Paris     | Montmartre              | elevated | 3       |
| Shanghai  | People's Park           | park     | 3       |
| Shenzhen  | Dameisha Beach          | beach    | 3       |
| Sydney    | Bondi Beach             | beach    | 3       |
| São Paulo | Edifício Itália Rooftop | elevated | 3       |
| Taipei    | Elephant Mountain Trail | elevated | 3       |
| Tokyo     | Ueno Park               | park     | 3       |

**`getCityVenue(city, seed) → VenueResult | null`**

1. Looks up city in `CITY_DATA` (exact match, then partial match fallback).
2. Picks a random venue from the city's venue list using the seeded random.
3. Applies `SETTING_OVERRIDES` if the venue name is in the override map (v8.0 — currently empty, all fixes in JSON).
4. Returns `{ name, setting, lightCharacter? }`. Setting defaults to `'street'` if absent in data.
5. Returns `null` if city has no data (prompt still generates without scene layer).

**v7.5 change:** Venue is now selected **once** in `generateWeatherPrompt()` before `computeLighting()` is called. The same venue object is passed to both the lighting engine and all tier generators. This prevents seed drift — the venue in the lighting phrase always matches the venue in the prompt text.

### 11.4 Vocabulary System (v6.0)

**v6.0 changes:** Wind moved to template descriptor system (§11.6). Temperature reduced from 180→54 phrases. Humidity reduced from 160→60 phrases. Time-of-day reduced from 120→67 phrases. Activities removed entirely.

Seven vocabulary/data files in `src/data/vocabulary/weather/`:

| File               | Ranges | Items | Coverage                                                                                                  |
| ------------------ | ------ | ----- | --------------------------------------------------------------------------------------------------------- |
| `city-vibes.json`  | —      | 842   | 83 cities, 842 venues, 9 settings, 25 enriched (75 lightCharacter phrases)                                |
| `conditions.json`  | 14     | 280   | 14 weather types (20 phrases each)                                                                        |
| `wind.json`        | 30     | 240   | 0–150 km/h in 5 km/h bands (legacy ranges, supplemented by `wind-system.ts` Beaufort pools)               |
| `temperature.json` | 18     | 54    | −40°C to +50°C in 5°C bands (3 phrases per bin)                                                           |
| `humidity.json`    | 20     | 60    | 0–100% in 5% bands (3 phrases per bin)                                                                    |
| `time-of-day.json` | 24     | 67    | 24 hours (1–5 phrases per hour)                                                                           |
| `urban-light.json` | —      | 83    | 83 cities with NASA/NOAA VIIRS-derived light emission factors (0.20–0.98) + 3 lightCharacter phrases each |

**Deleted in v9.0.0:** `wind-template-descriptors.json` — replaced by `wind-system.ts` + `wind.json`.

**Total prompt vocabulary: 1,626 items** — 1,333 JSON items + 87 daytime lighting phrases (v9.1) + 12 night competition phrases + 40 moon phrases + 20 setting light phrases + 75 venue enrichment phrases + 189 Beaufort wind interaction phrases (v8.0) = 1,756 total phrase slots across all systems.

### 11.5 Prompt Composition — 12 Layers (v6.0, updated v7.0/v7.8/v8.0/v9.x)

The `generateWeatherPrompt()` orchestrator (320 lines) computes shared state once, then dispatches to the correct tier generator. **v7.0:** Visual Truth (§11.12) is computed ONCE before any layer, providing unified atmospheric state. **v7.8:** Layer 5 uses `getSkySourceAware()` to allow precipitation through at night. **v9.0:** Decomposed into 18 modules. **v9.1–v9.6:** Layers 5, 7, 11, and 12 enriched by new subsystems.

| Layer | Element         | Source                                                                                                                                                                                                                                                 |
| ----- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | **City**        | Exchange card data                                                                                                                                                                                                                                     |
| 2     | **Venue**       | `city-vibes.json` → seeded random venue selection (v7.5: hoisted before lighting, includes setting)                                                                                                                                                    |
| 3     | **Lighting**    | **Deterministic procedural assembly** from solar elevation + cloud % + visibility + pressure + urban light + lunar position + venue setting (v7.5). Daytime: 87 phrase pools (v9.1) (§11A)                                                             |
| 4     | **Time**        | `time-of-day.json` → 24-hour lookup, phrase rotation. v9.5: enriched with solar phase label via `enhanceTimeWithPhase()` (§11J)                                                                                                                        |
| 5     | **Sky**         | v7.8: `getSkySourceAware()` — precipitation always passes through; cloud-only descriptions suppressed when lighting encodes cloud state (§11.7). v9.5: generic OWM cloud descriptions replaced with cloud-type phrases via `enhanceSkySource()` (§11I) |
| 6     | **Moon**        | Moon phase calculator → 40 phrases (night only)                                                                                                                                                                                                        |
| 7     | **Wind**        | `wind-system.ts` — Beaufort-calibrated force classification + venue-aware interaction phrases + cardinal direction + gust factor (§11.6). Replaces `wind-template-descriptors.json` (deleted v9.0)                                                     |
| 8     | **Moisture**    | v7.0: Optical surface effects from Visual Truth (replaces humidity phrases). v9.4: climate-normalised thresholds (§11H). Omitted when moisture invisible (~50% of cases)                                                                               |
| 9     | **Thermal**     | v7.0: Light/physics effects from Visual Truth (replaces temperature phrases). Omitted when temperature visually neutral (10–30°C)                                                                                                                      |
| 10    | **Grounding**   | v7.0: Surface-level physical details from Visual Truth. Combines moisture + thermal + venue-specific surface state                                                                                                                                     |
| 11    | **Camera/Lens** | v9.2: Platform-aware camera body + lens metadata from `camera-lens.ts` (§11G). Per-style × per-setting selection. Quality tags and negative prompts adapted per tier                                                                                   |
| 12    | **Directive**   | Quiet hours "no people or text visible" (§11.10). v8.0: `shouldExcludePeople(profile)` replaces raw `isQuietHours()`                                                                                                                                   |

### 11.6 Wind System (v8.0 — Beaufort-Calibrated, v9.0 — Decomposed)

**File:** `src/lib/weather/wind-system.ts` (476 lines)
**Vocabulary:** `src/data/vocabulary/weather/wind.json` (471 lines — 30 ranges, 240 phrases)

Replaces the v6.0 wind-template-descriptors system. The old system stored 1 descriptor per 5 km/h bin and assembled `"fresh breeze at 37 km/h"` at runtime. The new system classifies wind into Beaufort-aligned force tiers, then selects venue-specific interaction phrases that show the camera what wind _looks like_ in the scene.

**`wind-template-descriptors.json` was deleted in v9.0.0** (zero imports remaining after decomposition). All wind logic now lives in `wind-system.ts` + `wind.json`.

#### 11.6.1 Beaufort Force Classification

`classifyWind(speed: number): WindForce` — 8 force tiers aligned to the Beaufort scale:

| WindForce    | Speed (km/h) | Beaufort | Wind Noun     | Visual Register            |
| ------------ | ------------ | -------- | ------------- | -------------------------- |
| `calm`       | 0–5          | 0–1      | "air"         | Invisible in a still photo |
| `breeze`     | 6–19         | 2–3      | "breeze"      | Gentle movement visible    |
| `fresh`      | 20–29        | 4        | "breeze"      | Moderate displacement      |
| `strong`     | 30–49        | 5–6      | "wind"        | Strong visual effects      |
| `nearGale`   | 50–61        | 7        | "high wind"   | Dramatic interaction       |
| `gale`       | 62–74        | 8        | "gale"        | Destructive effects begin  |
| `strongGale` | 75–88        | 9        | "severe gale" | Major structural strain    |
| `storm`      | 89+          | 10+      | "storm"       | Extreme conditions         |

**Key design decision:** 50 km/h = `nearGale` (NOT destructive). Destructive effects begin at `gale` (62+). Human-body interaction phrases were purged from all pools — the system describes what the _environment_ looks like, not how people feel.

#### 11.6.2 Venue-Aware Wind Phrase Pools

`VENUE_WIND: Record<VenueSetting, Record<ActiveWindForce, string[]>>` — 7 active forces × 9 venue settings = **63 phrase pools**, 3 phrases each (189 total phrases). `calm` is excluded (invisible — returns `"still air"` directly).

Each pool describes what the camera _sees_ at that force level in that setting. Examples:

| Setting    | breeze                               | strong                                 | gale                                    |
| ---------- | ------------------------------------ | -------------------------------------- | --------------------------------------- |
| waterfront | "ripples crossing harbour water"     | "whitecaps forming across the harbour" | "waves crashing against quayside walls" |
| beach      | "fine sand drifting at ankle height" | "sand flying at knee height"           | "sand airborne in thick clouds"         |
| street     | "awnings swaying gently overhead"    | "awnings straining at fixings"         | "awnings ripping from brackets"         |
| narrow     | "noren curtains swaying in doorways" | "noren curtains pinned horizontal"     | "lightweight objects torn from hooks"   |
| park       | "leaves drifting from branches"      | "trees bending hard windward"          | "large branches snapping off"           |
| elevated   | "exposed shrubs leaning gently"      | "all vegetation pinned flat"           | "summit completely scoured by wind"     |

#### 11.6.3 Wind Direction & Gusts

**Cardinal direction:** `getCardinalDirection(degrees: number): string` — Converts OWM `wind.deg` (0–360) to 8 compass words (northerly, north-easterly, ..., north-westerly). Only prefixed when OWM provides `windDegrees` (live data, not demo).

**Gust factor:** When `windGustKmh > speed × 1.5`, a gust suffix is appended: `"gusting to 52 km/h"`. Threshold of 1.5× prevents trivial gusts from cluttering the prompt.

#### 11.6.4 Snow + Wind Interaction

When `PrecipState` indicates active snow/sleet AND wind is `fresh` (20+) or above, venue interaction phrases are overridden with snow-specific interaction:

| Speed      | Snow Interaction                             |
| ---------- | -------------------------------------------- |
| 20–29 km/h | "snow drifting across surfaces"              |
| 30–49 km/h | "blowing snow reducing visibility"           |
| 50+ km/h   | "snow streaming horizontal across the scene" |

#### 11.6.5 Output Format

`getWindPhrase(ctx, seed, venueSetting?, precip?): string`

Single clause, no stacking. Format varies by force:

| Force                    | Output Pattern                                                            | Example                                                                   |
| ------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| calm                     | `"still air"`                                                             | still air                                                                 |
| breeze–storm             | `"{direction} {speed} km/h {noun}, {interaction}"`                        | south-westerly 35 km/h wind, awnings straining at fixings                 |
| breeze–storm (with gust) | `"{direction} {speed} km/h {noun} gusting to {gust} km/h, {interaction}"` | northerly 45 km/h wind gusting to 68 km/h, signs swinging wildly on posts |
| fresh+ (active snow)     | `"{direction} {speed} km/h {noun}, {snow interaction}"`                   | easterly 25 km/h breeze, snow drifting across surfaces                    |

The speed number does the intensity work. The noun (breeze/wind/gale/storm) sets the register. The interaction shows what the camera sees.

#### 11.6.6 Wind JSON Vocabulary (`wind.json`)

Retained from v6.0 but no longer used for the primary wind phrase. The `wind.json` file (30 ranges, 240 phrases at 8 per bin) is still loaded by `vocabulary-loaders.ts` for supplementary context building via `buildContext()`. The primary wind output is now entirely from the Beaufort classification + venue interaction system.

### 11.7 Sky Source Logic (v7.8 — Precipitation-Aware)

**`getSkySourceAware(ctx, seed, encodesCloudState) → string | null`** (v7.8, replaces `getSkySource`)

Three-path resolution that separates cloud descriptions from precipitation phenomena:

1. **encodesCloudState = false** (daytime with low cloud): Delegates to original `getSkySource()` — uses OWM description directly, filtering wind-only descriptions. No suppression.
2. **encodesCloudState = true** (night, or heavy overcast daytime): Checks description against two filter sets:
   - **WIND_ONLY_DESCRIPTIONS** (6 entries: `windy`, `breezy`, `gusty`, `blustery`, `squall`, `squalls`) → returns `null`.
   - **CLOUD_ONLY_DESCRIPTIONS** (11 entries) → returns `null` (suppressed — lighting already covers cloud state).
   - **Everything else** (precipitation, fog, mist, thunderstorm) → **passes through** (always appears in prompt).
3. **No description fallback**: Checks `ctx.condition` for 10 precipitation keywords (`rain`, `snow`, `drizzle`, `sleet`, `hail`, `thunder`, `storm`, `mist`, `fog`, `freezing`). If match → `getConditionPhrase(ctx, seed)`. Otherwise `null`.

**CLOUD_ONLY_DESCRIPTIONS** (suppressed when `encodesCloudState` is true):

`clear sky`, `clear`, `sunny`, `few clouds`, `scattered clouds`, `broken clouds`, `overcast clouds`, `overcast`, `partly cloudy`, `mostly cloudy`, `cloudy`

**Why this matters (v7.8 critical fix):** Before v7.8, `encodesCloudState` was always `true` at night (the lighting engine always encodes cloud state at night). The old gate `!encodesCloudState ? getSkySource() : null` therefore suppressed ALL weather descriptions at night — including snow, rain, mist, fog, and thunderstorm. Toronto at night with snow would produce a prompt with no mention of snow. This was a silent data loss bug present from v6.0.

The fix: `getSkySourceAware()` treats `encodesCloudState` as a signal to suppress cloud-only descriptions (which the lighting engine already communicates), but always allows precipitation and visibility phenomena through. These fundamentally change the visual scene and must appear in every prompt.

**Before v7.8:** Toronto, night, snow → `"ambient city glow, Kensington Market, ..."` (no snow)
**After v7.8:** Toronto, night, snow → `"ambient city glow, Kensington Market, ... snow ..."` (snow present)

All 5 tier generators call `getSkySourceAware()` instead of the old conditional gate.

### 11.8 Seed & Rotation

```typescript
const twoHourWindow = Math.floor(Date.now() / 7_200_000);
const seed = ctx.tempC * 100 + ctx.humidity * 10 + ctx.windKmh + hour + twoHourWindow;
```

The seeded random (`Math.sin(seed * 9999)`) produces:

- **Deterministic within a 2-hour window** — same conditions + same time → same prompt.
- **Rotation every 2 hours** — `twoHourWindow` changes, re-rolling venue/phrase selection even if weather is unchanged.
- **Weather-sensitive** — any change in temperature, humidity, or wind speed shifts the seed, producing new phrase selections immediately.

**Note:** The lighting element (§11A) does NOT use the seed. It is fully deterministic from measured data — no rotation, no randomness. Same inputs always produce the same lighting phrase.

### 11.9 Night Integration (v6.1 — Revised, v9.6 — 5 Tier Formats)

Moon rendering in prompts is gated by `LightingState.moonVisible`:

- `moonVisible = true` → Moon phase phrase + position phrase (if available) rendered in tier-specific syntax.
- `moonVisible = false` → Entire moon layer suppressed. No phantom crescents below the horizon.
- No lat/lon available → `moonVisible = true` (backward compatibility; shows phase only, no position).

When `moonVisible` is true, the moon phase prompt phrase AND position phrase are injected with tier-specific formatting:

- **Tier 1 (CLIP):** `(moon.promptPhrase moonPositionPhrase:1.2)` — weighted keyword
- **Tier 1F (Flux):** `moon.promptPhrase moonPositionPhrase` — plain text, no weights (T5 encoder)
- **Tier 2 (MJ V5.2):** `moon.promptPhrase moonPositionPhrase` — in Seg 2 (::1 venue+sky+weather)
- **Tier 2 (MJ V6.1/V7):** `moon.promptPhrase moonPositionPhrase` — in S1 scene sentence (natural language)
- **Tier 3:** `"A [moon.promptPhrase] hangs [moonPositionPhrase]."` — sentence with position
- **Tier 4:** `moon.promptPhrase moonPositionPhrase` — plain text at position 6

Moon position phrase comes from `LightingState.moonPositionPhrase` — gated on altitude > 0° AND cloud ≤ 75% AND visibility ≥ 3000m. When the position gate fails but moonVisible is true, only the phase phrase renders (e.g. overcast night with moon above horizon — you know it's there but can't point to it).

### 11.10 Quiet Hours & People Exclusion (v6.0, updated v8.0)

**`isQuietHours(weather, localHour) → boolean`**

**v6.0 change:** Quiet hours window expanded from `midnight (00:00) → sunrise` to `23:59 local → sunrise + 1 hour`.

**v8.0 change (Chat 7):** All 5 tier generators now call `shouldExcludePeople(profile, weather, localHour, observedAtUtc)` instead of raw `isQuietHours()`. The helper reads `profile.excludePeople`:

| `profile.excludePeople` | Behaviour                                              |
| ----------------------- | ------------------------------------------------------ |
| `'always'`              | People excluded in every prompt                        |
| `'quiet-hours'`         | Calls `isQuietHours()` (default, pre-Chat-7 behaviour) |
| `'never'`               | People never excluded                                  |

Two-tier detection:

1. **Live data (precise):** If `sunriseUtc` and `timezoneOffset` are available, calculates whether local time is between 23:59 (local) and the sunrise second + 3600 seconds (1 hour after sunrise). Seconds precision.
2. **Fallback (approximate):** `localHour >= 0 && localHour < 7` (extended by 1 hour from previous `< 6`).

**Rationale:** A city isn't empty at 23:30 in the old system, but it also isn't bustling at 06:01 when sunrise is 06:00. The new window better reflects reality: quiet from just before midnight until one hour after sunrise, when early morning foot traffic picks up.

The `quiet` boolean gates the "no people or text visible" directive in all 5 tiers. Since activities are removed (v6.0), the quiet boolean now only controls the people exclusion directive — there is no activity phrase to suppress.

| Behaviour                 | Quiet hours (23:59 → sunrise + 1hr) | Active hours (sunrise + 1hr → 23:59)  |
| ------------------------- | ----------------------------------- | ------------------------------------- |
| **"No people" directive** | Present — renders empty scene       | Removed — people may naturally appear |

**Per-tier implementation:**

| Tier | Active hours output                                    | Quiet hours output                                                                |
| ---- | ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| 1    | `... --no watermarks logos blurry`                     | `... --no people text watermarks logos blurry`                                    |
| 2    | `... --ar {mjAspect} --stylize {mjStylize}`            | `... --ar {mjAspect} --stylize {mjStylize} --no people text`                      |
| 3    | `... {STYLE_ENDING_PREFIX}, high-detail {scene type}.` | `... {STYLE_ENDING_PREFIX}, high-detail {scene type}. No people or text visible.` |
| 4    | `... [temp]`                                           | `... [temp], no people or text visible`                                           |

v8.0 note: T2 parameters come from `profile.mjAspect` / `profile.mjStylize` (defaults: `16:9`, `100`). T3 ending from `getSettingEnding(venue, profile.style)` — scene type varies by venue setting (city/coastal/landmark/landscape/skyline). People exclusion controlled by `shouldExcludePeople(profile, ...)` — profile.excludePeople can be `'always'`, `'quiet-hours'` (default), or `'never'`.

### 11.11 Design Decisions (v6.1, updated v8.0)

1. **Activities removed** (v6.0) — Venue-only model. Activities were the primary source of quiet-hours contradictions and added complexity without proportional visual value. The venue alone anchors the scene; the lighting engine now does the heavy atmospheric lifting.
2. **Wind uses exact API speed** — No midpoint guessing. The descriptor comes from the bin, the number comes from the API. "fresh breeze at 37 km/h" not "wind around 42 km/h".
3. **Lighting is deterministic** — No seed, no rotation, no phrase pools. Same lat/lon + same time + same cloud + same visibility + same pressure + same urban factor + same lunar position = same lighting phrase. Always.
4. **One engine, multiple skins** — The lighting calculation runs once per exchange card, producing one lighting state object. Each tier renders that state into its own syntax. The underlying physics never changes. Only the surface language adapts to the parser. If lighting logic ever forks per tier, determinism is broken.
5. **Humidity IS in prompts but NOT in atmosphere modifier** (v6.1) / **Moisture replaces humidity** (v7.0) — In v6.1, humidity phrases from `humidity.json` appeared in all 4 tiers while the atmosphere modifier used visibility-only. In v7.0, the humidity vocabulary is replaced by the Visual Truth `moistureVisibility` property, which provides optical surface effects ("damp surfaces glistening") instead of weather-report descriptions ("humidity very close to saturation"). Omitted when moisture is invisible (~50% of conditions).
6. **No °C/°F in prompts** — Temperature units stripped from all tiers.
7. **Sky deduplication with lighting** — When a lighting phrase already encodes cloud state, Sky is conditionally omitted (§11A.7).
8. **Wind-only filtering** — OWM descriptions like "windy" and "breezy" are excluded from the sky layer.
9. **Urban vs Moon competition** (v6.1) — Night lighting is no longer a simple moon-brightness × cloud-cover lookup. Two light sources compete with physically modelled interactions: urban glow (static per city, amplified by cloud reflection) vs moonlight (phase brightness × altitude attenuation × cloud blocking). The winner determines the base phrase.
10. **Moon visibility gate** (v6.1) — The moon prompt layer is suppressed when the moon is below the horizon. No phantom crescents that can't be seen. Moon position descriptor is additionally gated on cloud ≤ 75% and visibility ≥ 3000m — you know it's there but can't point to it through thick cloud.
11. **Visual Truth eliminates physics conflicts** (v7.0) — Before any phrase is selected, ALL weather data is cross-referenced to derive what the atmosphere ACTUALLY LOOKS LIKE. Every layer reads from this shared truth. "Sharp shadows" + "fully saturated air" + "pristine clear air" can no longer co-occur.
12. **Venue-aware lighting** (v7.5) — Night lighting now receives the venue's setting type. A park in Tokyo gets "lamppost pools on gravel paths" not "LED billboard glow". Urban attenuation shifts competition toward moonlight at non-commercial venues.
13. **Coherence validation** (v7.6) — Post-lighting safety net catches commercial terms that shouldn't appear at non-urban venues. Swaps to setting pool and rebuilds the phrase.
14. **Precipitation always passes through** (v7.8) — Night scenes no longer suppress precipitation descriptions. Snow, rain, mist, fog, and thunderstorm always appear in prompts regardless of cloud state encoding.
15. **Precipitation truth replaces booleans** (v8.0) — `classifyPrecip()` returns `PrecipState { type, intensity, active, reducesVisibility }` instead of `isRainy`/`isStormy` booleans. Snow, sleet, hail, fog, mist, haze, smoke, and dust now classified correctly with intensity derived from OWM numeric data (`rain.1h`/`snow.1h`) when available.
16. **Beaufort wind over arbitrary tiers** (v8.0) — 7 force tiers aligned to Beaufort scale instead of 4 arbitrary `WindTier` thresholds. Key correction: 50 km/h = nearGale (strong effects but NOT destructive). Destructive phrases start at gale (62+). All human-body phrases purged.
17. **Venue taxonomy validation** (v8.0) — `SETTING_OVERRIDES` runtime safety net + standalone CI linter (`lint-venues.ts`) catches name↔setting mismatches. `overrideJustification` field documents legitimate exceptions. 15 venues across 83 cities carry justified overrides.
18. **PromptProfile is zero-regression** (v8.0) — `DEFAULT_PROMPT_PROFILE` produces byte-for-byte identical output to pre-Chat-7 behaviour. New consumers can customise without breaking existing output.
19. **PromptTrace is zero-cost** (v8.0) — Trace object only constructed when `debug: true` or `NODE_ENV=development`. Production never enters the trace block.

### 11.12 Visual Truth Layer (v7.0, updated v8.0/v9.3/v9.4/v9.5)

**File:** `src/lib/weather/visual-truth.ts` (1,253 lines)

**Function:** `deriveVisualTruth(tempC, humidity, windKmh, cloudCover, visibility, pressure, solarElevation, isNight, precip: PrecipState, latitude?: number | null) → VisualTruth`

**v7.0 addition.** Before any prompt phrase is selected, ALL weather data is cross-referenced to derive what the atmosphere **actually looks like**. This unified assessment is computed ONCE per prompt. Every layer reads from this shared truth. No layer can contradict another.

**v9.4.0 change:** The function receives `latitude` (optional) and calls `computeClimateContext()` internally. Air clarity, contrast, and moisture thresholds now use **climate-normalised effective values** instead of raw humidity/dew-spread. Precipitation-driven paths and thermal optics still use raw values (physics of rain/frost don't change with latitude). See §11H for zone parameters and calibration examples.

**v9.3.0 change:** Compound precipitation interaction in air clarity — when `PrecipState.compound === true`, the secondary atmospheric layer (fog, mist, haze, smoke, dust) directly overrides air clarity. Rain+fog → `'foggy'` (not the intensity-based `'hazy'` that rain alone would produce).

**v8.0 change:** The function receives `PrecipState` (from `classifyPrecip()`, see §11B) instead of the old `isRainy`/`isStormy` booleans. This fixes the biggest correctness bug in v7.x: snow, sleet, hail, fog, mist, smoke, and dust were not treated as precipitation-active, producing "clear pristine air" during heavy snowfall.

**Key innovation — dew point physics:** The Magnus formula computes dew point from temperature and humidity. The dew point spread (tempC − dewPoint) is the primary driver:

| Dew Spread | Atmospheric State                                     |
| ---------- | ----------------------------------------------------- |
| > 10°C     | Moisture invisible, clear atmosphere                  |
| 5–10°C     | Slight softening of distant detail                    |
| 2–5°C      | Visible haze, reduced contrast                        |
| 1–2°C      | Mist forming, wet surfaces, strong light scattering   |
| < 1°C      | Fog likely (wind-dependent — calm = fog, wind = mist) |

**v9.4.0 — Climate normalisation:** These thresholds are evaluated against **effective** humidity/dew-spread (from `computeClimateContext()`), not raw values. Singapore's raw 85% humidity produces an effective ~70% (normal tropical day → no fog trigger). London's raw 85% stays at 85% (cool-temperate baseline → fog trigger). Precipitation paths bypass normalisation — rain visibility is rain visibility everywhere.

**v9.3.0 — Compound precipitation overrides in air clarity:**

| Compound Layer                      | Air Clarity Override                                      |
| ----------------------------------- | --------------------------------------------------------- |
| Primary + fog secondary             | `'foggy'` (regardless of visibility)                      |
| Primary + mist secondary            | `'misty'` (regardless of visibility)                      |
| Primary + haze/smoke/dust secondary | `'misty'` if vis < 3000m, else `'hazy'`                   |
| Snow (no compound)                  | Heavy → `'foggy'`, moderate → `'misty'`, light → `'hazy'` |
| Rain (no compound)                  | Heavy → `'hazy'`, moderate/light → intensity-based        |

**4 derived properties:**

| Property             | What it describes                     | States                                                                                     |
| -------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------ |
| `airClarity`         | Air between viewer and scene          | `crystal`, `clear`, `softened`, `hazy`, `misty`, `foggy`                                   |
| `contrast`           | Shadow behaviour given full picture   | `high`, `moderate`, `low`, `flat`                                                          |
| `moistureVisibility` | Surface appearance (damp, frost, dry) | `bone-dry`, `invisible`, `subtle`, `noticeable`, `visible`, `dominant`                     |
| `thermalOptics`      | Temperature effects on light/physics  | `shimmer`, `warm-shimmer`, `heavy-tropical`, `neutral`, `cold-sharp`, `frost`, `deep-cold` |

**Air clarity** cross-references visibility, effective humidity, effective dew point spread, wind speed, temperature, precipitation (including compound layers), and climate zone. OWM caps visibility at 10000m — Visual Truth **distrusts** this when effective dew spread is narrow (< 1°C with calm wind = fog forming, regardless of OWM saying vis 10000).

**Contrast** cross-references cloud cover, air clarity, solar elevation, effective humidity, and effective dew spread. At night, contrast is `'flat'` — shadow behaviour is handled by the urban/moon competition model.

**Moisture visibility** drives the prompt's surface description (Layer 8). When moisture is invisible (~50% of conditions), Layer 8 is omitted entirely — no forced "the air feels normal" padding.

**Thermal optics** drives the prompt's temperature effects (Layer 9). When temperature is visually neutral (10–30°C, low humidity), Layer 9 is omitted — no forced "comfortable temperatures" padding.

**Physics conflict rules (post-derivation):**

| Rule   | Condition                               | Correction                                                                         |
| ------ | --------------------------------------- | ---------------------------------------------------------------------------------- |
| Rule 1 | Fog/mist present + `cold-sharp` thermal | → `neutral` (fog insulates — sharp cold air and thick fog don't coexist)           |
| Rule 2 | Crystal air + visible/dominant moisture | → `noticeable` (crystal-clear air is genuinely dry — wet surfaces need atmosphere) |

**v7.0 replacements:**

- **Humidity phrases → Moisture phrases:** Weather-report descriptions ("humidity very close to saturation") replaced with surface optical effects ("damp surfaces glistening under the light").
- **Temperature phrases → Thermal phrases:** Thermometer readings ("comfortable mild temperatures") replaced with light/physics effects ("heat shimmer distorting distant surfaces").

**v7.1 fix:** Visual Truth is ALWAYS computed. The v7.0 guard `(cloudCover != null || visibility != null)` blocked computation for demo exchanges and live data gaps, causing fallback to old humidity/temp phrases — exactly the contradictions Visual Truth was built to eliminate.

```typescript
interface VisualTruth {
  dewPoint: number; // Dew point temperature °C (Magnus formula)
  dewSpread: number; // tempC − dewPoint (distance to condensation)
  airClarity: AirClarity; // 6 states: crystal → foggy
  contrast: ContrastLevel; // 4 states: high → flat
  moistureVisibility: MoistureVisibility; // 6 states: bone-dry → dominant
  thermalOptics: ThermalOptics; // 7 states: shimmer → deep-cold
  precip: PrecipState; // v8.0: Full classification (§11B)
  climateZone: string | null; // v9.4: Zone from computeClimateContext() (§11H)
  cloudType: string | null; // v9.5: Set by orchestrator after classification (§11I)
  solarPhase: string | null; // v9.5: Set by orchestrator after phase computation (§11J)
}
```

**Note on `cloudType` and `solarPhase`:** These are set to `null` by `deriveVisualTruth()` and populated by the orchestrator (`weather-prompt-generator.ts`) after calling the respective classification functions. This avoids circular dependencies — cloud type and solar phase depend on data that Visual Truth doesn't have access to (OWM `weatherId`, sunrise/sunset times).

---

## 11A. Lighting Engine (v8.0, v9.1 Daytime Enrichment)

The lighting engine is the most significant addition in v6.0, with the night branch fully rewritten in v6.1, venue-aware attenuation in v7.5, coherence validation in v7.6, iconic venue enrichment in v7.7, precipitation-aware sky source in v7.8, and daytime pool-based phrase selection with colour temperature in v9.1. It replaces time-based implied lighting with **deterministic atmospheric optics** — a procedurally assembled lighting phrase derived from measured inputs. Daytime uses seeded phrase pool rotation (deterministic, not random); nighttime uses competition-model output. Same inputs = same output. Always.

**File:** `src/lib/weather/lighting-engine.ts` (917 lines)

**v9.1.0 changes:** Daytime branch replaced with 8 solar bands × 4 cloud strata = 87 phrase pools (was 5 static phrases + 1 cloud override). Correlated colour temperature (CCT) computed from solar elevation + cloud blend (2,500K–12,000K). `getDaylightBase()` replaces static if/else chain. `computeColourTempK()` exported. `DaylightPool` interface: `{clear, scattered, broken, overcast}` arrays per band.
**v8.0 changes:** Generator returns `WeatherPromptResult` (structured, with `positive`/`negative`/`trace` fields). Precipitation truth via `classifyPrecip()`. Beaufort wind via `classifyWind()`. Venue taxonomy validation. PromptProfile configures style/verbosity/people exclusion. PromptTrace exposes all decisions in debug mode. All tier generators receive resolved profile. T1 token guard, T2 `::` syntax, T3 setting endings, T4 fragment limit + period nouns.
**v7.8 changes:** `getSkySourceAware()` replaces old sky gate in all 4 tiers — precipitation passes through at night. Lint fix for unused `pres` variable. TypeScript cast fix for `urbanLightData`.
**v7.7 changes:** 25 iconic venues carry `lightCharacter[]` — highest priority in 3-tier night light system.
**v7.6 changes:** `validateLightingCoherence()` safety net scans lighting base for commercial terms banned at non-urban settings. Swaps to setting pool and rebuilds fullPhrase if found.
**v7.5 changes:** `computeLighting()` receives venue setting. SETTING_URBAN_ATTENUATION per-setting multiplier. SETTING_NIGHT_LIGHT pools for 4 non-urban settings. Venue hoisted before lighting.
**v6.1 changes:** Night branch replaced with Urban vs Moon competition model (§11A.3). Atmosphere modifier simplified to visibility-only (§11A.5). Lunar position calculator added (§8.4). urban-light.json added (83 cities). Moon visibility gate added. Moon position phrase rendered in all 4 tiers.

### 11A.1 Architecture — Procedural Assembly

**Daytime (v9.1.0 — pool-based):** Same 4-segment concatenation, but BASE now selects from 87 phrase pools (8 solar bands × 4 cloud strata) instead of 5 static phrases:

```
[BASE from getDaylightBase(solarElev, cloud, seed)] + [SHADOW_MODIFIER] + [ATMOSPHERE_MODIFIER] + [STABILITY_MODIFIER]
```

Phrase selection is seeded (deterministic — same city/day/conditions = same phrase). Cloud strata: clear (≤25%), scattered (26–50%), broken (51–75%), overcast (76–100%). Correlated colour temperature (CCT) computed in parallel for trace/debugging.

**Nighttime:** Urban vs Moon competition model (v6.1, venue-aware v7.5+):

```
INPUTS: urbanLightFactor, moonPhase, lunarAltitude, cloud%, visibility, pressure,
        venueSetting (v7.5), venueLightCharacter (v7.7)
  → Urban attenuation: rawUrbanFactor × settingAttenuation (v7.5)
  → Competition maths → winner (urban | moon | balanced)
  → 3-tier light phrase priority (v7.7):
      1. venue.lightCharacter (iconic venues — from city-vibes.json)
      2. SETTING_NIGHT_LIGHT[setting] (generic per setting type)
      3. city lightCharacter (urban-light.json — commercial strip)
  → BASE phrase from winner + conditions + sceneLightPhrase
  → + [ATMOSPHERE_MODIFIER] + [STABILITY_MODIFIER]
  → + moonPositionPhrase (gated: alt > 0° AND cloud ≤ 75% AND vis ≥ 3000m)
  → validateLightingCoherence() (v7.6 safety net)
```

Each segment is either present or absent depending on the data. No forced inclusion. If the modifier doesn't meaningfully change the scene, it is omitted.

### 11A.2 Data Inputs

| Input           | Source                             | Available       | Role                                                  |
| --------------- | ---------------------------------- | --------------- | ----------------------------------------------------- |
| Solar elevation | NOAA formula (lat, lon, day, hour) | Always (calc)   | Base light descriptor (daytime)                       |
| Cloud cover %   | `clouds.all` from OWM API          | Live data only  | Shadow/diffusion + cloud amplification (night)        |
| Visibility (m)  | `visibility` from OWM API          | Live data only  | Atmosphere modifier (sole input, v6.1)                |
| Pressure (hPa)  | `main.pressure` from OWM API       | Live data only  | Stability modifier                                    |
| Moon phase      | Synodic calculation (existing)     | Always (calc)   | Night base phrase input + brightness value            |
| Lunar position  | Meeus ephemeris (§8.4)             | When lat/lon    | Night altitude attenuation + position descriptor      |
| Urban light     | `urban-light.json` per city        | Always (static) | Night urban glow factor for competition model         |
| City name       | Exchange card data                 | Always          | Key for urban-light.json lookup                       |
| Venue setting   | `city-vibes.json` per venue (v7.5) | Always (static) | Urban attenuation factor + night light pool selection |
| Venue lightChar | `city-vibes.json` per venue (v7.7) | 25 venues only  | Highest-priority night light phrases (iconic venues)  |
| Visual truth    | `deriveVisualTruth()` (v7.0)       | Always (calc)   | Shadow + atmosphere modifiers use unified state       |

**Demo data fallback:** When cloud cover, visibility, or pressure are unavailable (demo data), the lighting engine falls back to a simplified time-only descriptor. This intentionally produces less-rich prompts from demo data — live data should always be richer.

### 11A.3 Segment 1: BASE — Solar Elevation

Always present. Daytime/twilight: seeded phrase selection from pool (deterministic, not random). Night: competition model output.

#### Daytime + Twilight — Pool-Based Phrase Selection (v9.1.0)

**`getDaylightBase(solarElevation, cloud, seed): string`** — 8 solar elevation bands, each with a `DaylightPool` containing 4 cloud strata arrays (`clear`, `scattered`, `broken`, `overcast`). The seed (from `cityLightSeed()`) picks deterministically within the matching pool. Replaces the v9.0.0 static 5-phrase chain.

```typescript
interface DaylightPool {
  clear: string[]; // ≤25% cloud
  scattered: string[]; // 26–50%
  broken: string[]; // 51–75%
  overcast: string[]; // 76–100%
}
```

**8 solar bands (87 phrases total):**

| Band                  | Elevation    | Pool Constant       | Phrases      | CCT (clear sky) | Visual Character                         |
| --------------------- | ------------ | ------------------- | ------------ | --------------- | ---------------------------------------- |
| Astronomical twilight | −18° to −12° | `TWILIGHT_ASTRO`    | 9 (3/2/2/2)  | 12,000K         | Indigo-violet, near-dark                 |
| Nautical twilight     | −12° to −6°  | `TWILIGHT_NAUTICAL` | 9 (3/2/2/2)  | 10,000K         | Deep navy-cobalt gradient                |
| Civil twilight        | −6° to 0°    | `TWILIGHT_CIVIL`    | 12 (4/3/2/3) | 8,500K          | Blue-hour, cool blue with warm horizon   |
| Golden hour           | 0° to 6°     | `DAYLIGHT_GOLDEN`   | 13 (4/3/3/3) | 2,500K          | Deep amber-gold, long soft shadows       |
| Low angle             | 6° to 15°    | `DAYLIGHT_LOW`      | 11 (3/3/2/3) | 3,500K          | Warm yellow, steep lateral angle         |
| Mid elevation         | 15° to 35°   | `DAYLIGHT_MID`      | 12 (3/3/3/3) | 5,200K          | Neutral daylight, well-defined direction |
| High angle            | 35° to 60°   | `DAYLIGHT_HIGH`     | 11 (3/3/2/3) | 5,600K          | Strong downward, slightly cool white     |
| Near vertical/zenith  | 60°+         | `DAYLIGHT_ZENITH`   | 10 (3/2/2/3) | 5,800K          | Harsh overhead, minimal shadow           |

**Cloud strata interaction:** Each phrase is written for its cloud condition. "Golden-hour sunlight" in the clear pool becomes "low-angle overcast daylight with no warm colour shift" in the overcast pool — the physical explanation is built into the phrase itself. No separate cloud override rule needed (v9.0.0 cloud override is absorbed into per-pool phrasing).

**Example phrases per stratum (DAYLIGHT_GOLDEN):**

- **clear:** "golden-hour sunlight with deep amber horizontal rays", "rich golden light raking across surfaces at low angle"
- **scattered:** "warm golden light filtering between scattered clouds", "intermittent golden-hour rays with cloud-shadow patterns"
- **broken:** "muted golden glow through broken cloud cover", "diffused amber light with occasional direct golden shafts"
- **overcast:** "low-angle overcast daylight with no warm colour shift", "flat grey-white light at low sun angle through heavy cloud"

**Example phrases per stratum (TWILIGHT_CIVIL — blue hour):**

- **clear:** "civil twilight with cool blue-hour light", "soft directional blue light at civil twilight", "delicate blue-to-peach gradient at the horizon"
- **scattered:** "blue-hour light with cloud edges lit warm from below", "cool twilight with scattered cloud catching peach tones"
- **overcast:** "flat cool pre-dawn light through heavy overcast", "uniform dull light at civil twilight under overcast"

#### Correlated Colour Temperature (CCT) — v9.1.0

**`computeColourTempK(solarElevation, cloud, isNight): number | null`**

Computes Kelvin from solar elevation band + cloud cover blend. Returns `null` at night (urban light is mixed warm/cool — no single CCT applies). Stored in `LightingState.colourTempK` and `PromptTrace.lighting.colourTempK`.

**Clear-sky CCT by band:**

| Band                  | Clear K | Physical Basis                               |
| --------------------- | ------- | -------------------------------------------- |
| Astronomical twilight | 12,000K | Deep indigo — extreme atmospheric scattering |
| Nautical twilight     | 10,000K | Navy-blue — long atmospheric path            |
| Civil twilight        | 8,500K  | Blue-hour — short-wave dominance             |
| Golden hour           | 2,500K  | Deep amber — maximum atmospheric filtering   |
| Low angle             | 3,500K  | Warm yellow — significant path length        |
| Mid elevation         | 5,200K  | Neutral — standard "daylight" (D52)          |
| High angle            | 5,600K  | Slightly cool — shorter path                 |
| Zenith                | 5,800K  | Cool white — minimum atmospheric path        |

**Cloud blend:** Overcast flattens CCT toward 6,500K (standard overcast, any sun position). Uses a **quadratic blend curve** — first 50% cloud barely shifts CCT, heavy overcast dominates:

```
cloudFraction = cloud / 100
blendFactor = cloudFraction^1.5
kelvin = clearK + (6500 − clearK) × blendFactor
```

| Cloud % | Blend Factor | Effect                                            |
| ------- | ------------ | ------------------------------------------------- |
| 25%     | ~12%         | Barely shifts from clear-sky value                |
| 50%     | ~35%         | Noticeable — warm tones softened                  |
| 75%     | ~65%         | Dominant — approaching overcast grey              |
| 100%    | 100%         | Full overcast — 6,500K regardless of sun position |

**AI model utility:** Generators trained on EXIF data understand Kelvin natively. Including `2500K` alongside "golden-hour sunlight" reinforces the warm colour cast; `8500K` alongside "blue-hour light" reinforces the cool tone. Currently used in trace output; future use: direct injection into T1 CLIP prompts as a technical parameter.

#### Night Bins (sun below −18°)

At night, solar elevation is irrelevant. The base phrase is determined by the **Urban vs Moon Competition Model** (v6.1).

**Two competing light sources:**

| Source         | Input                                        | Modifier                                                                     | Character                               |
| -------------- | -------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------- |
| **Urban glow** | `urban-light.json` per-city factor (0.0–1.0) | Cloud amplification: overcast adds up to 50% (light reflects off cloud base) | Omnidirectional, warm, always present   |
| **Moonlight**  | Phase brightness (synodic cycle)             | Altitude attenuation × cloud blocking (heavy cloud blocks up to 70%)         | Directional, cool, may be below horizon |

**Urban Light Data:** `src/data/vocabulary/weather/urban-light.json` — 83 cities with static emission factors derived from NASA/NOAA VIIRS nighttime lights composites. Default fallback: 0.50.

| Tier     | Range     | Cities | Examples                                                  |
| -------- | --------- | ------ | --------------------------------------------------------- |
| Extreme  | 0.85–1.0  | 10     | Hong Kong 0.98, Shanghai 0.96, Tokyo 0.93, New York 0.92  |
| High     | 0.65–0.84 | 21     | São Paulo 0.84, Paris 0.82, London 0.80, Bangkok 0.78     |
| Moderate | 0.40–0.64 | 32     | Amsterdam 0.61, Prague 0.55, Copenhagen 0.52, Zurich 0.50 |
| Low      | 0.15–0.39 | 20     | Riga 0.38, Kyiv 0.35, Reykjavik 0.25, Windhoek 0.20       |

**Competition maths (v7.5 — venue-attenuated):**

```
effectiveUrban = rawUrbanFactor × settingAttenuation × (1 + cloud/100 × 0.5)
effectiveMoon  = phaseBrightness × altitudeAttenuation × (1 − cloud/100 × 0.7)

DOMINANCE_THRESHOLD = 1.5
  effectiveUrban > effectiveMoon × 1.5 → urban dominates
  effectiveMoon > effectiveUrban × 1.5 → moon dominates
  otherwise → balanced
```

**v7.5 — Setting Urban Attenuation:** Per-setting multiplier applied to the city's raw urbanLight factor before competition. Reduces effective urban brightness at non-commercial locations. This shifts the urban vs moon competition outcome — a park in Tokyo will trend toward balanced/moon-dominant instead of always urban-dominant.

| Setting      | Attenuation | Physical rationale                                   |
| ------------ | ----------- | ---------------------------------------------------- |
| `street`     | 1.0         | You ARE in the commercial light. Full factor.        |
| `narrow`     | 1.0         | Dense commercial. Full factor.                       |
| `market`     | 0.95        | Open-air but lit. Slight reduction.                  |
| `plaza`      | 0.85        | Set back from dense commercial. Moderate reduction.  |
| `waterfront` | 0.85        | Set back from dense commercial. Moderate reduction.  |
| `monument`   | 0.7         | Floodlit but isolated from commercial strip.         |
| `park`       | 0.4         | Dramatically less urban — lamppost pools, not neon.  |
| `beach`      | 0.3         | Boardwalk-level light only. Distant city glow.       |
| `elevated`   | 0.2         | ABOVE the light. Looking down at it. Minimal direct. |

**v7.5 — Setting Night Light Pools:** Dedicated light phrases for 4 non-urban settings. 5 phrases each. Physical emitters only — boardwalk lamps, path lighting, floodlights. These replace the city's commercial lightCharacter for non-urban venues.

**`SETTING_NIGHT_LIGHT`** (4 settings, 5 phrases each = 20 phrases):

| Setting    | Example phrases                                                                               |
| ---------- | --------------------------------------------------------------------------------------------- |
| `beach`    | `scattered boardwalk lamp pools on sand`, `distant pier lights and promenade lamps`           |
| `park`     | `lamppost pools on gravel paths and grass`, `warm path lighting filtering through branches`   |
| `elevated` | `city glow illuminating from far below`, `distant skyline light and faint railing lamps`      |
| `monument` | `warm floodlighting on carved stone surfaces`, `upward-angled spotlights on historic facades` |

Urban settings (`street`, `narrow`, `market`, `plaza`, `waterfront`) use the city's unique lightCharacter from `urban-light.json`.

**v7.7 — 3-Tier Night Light Priority:** When selecting the scene light phrase for the base, the engine checks three tiers in order. The first non-empty source wins:

1. **Venue lightCharacter** (from `city-vibes.json` — 25 iconic venues only). Example: Coney Island → `"fading fairground rides and boardwalk arcade glow"`.
2. **Setting pool** (`SETTING_NIGHT_LIGHT[setting]` — 4 non-urban settings). Example: Any park → `"lamppost pools on gravel paths and grass"`.
3. **City lightCharacter** (from `urban-light.json` — commercial strip). Example: Tokyo → `"pachinko parlour glow and vending machine light"`.

Selection uses `cityLightSeed(city, moonDayInCycle)` — a Knuth multiplicative hash with XOR mixing. Same city + same moon day = same phrase. Different day = likely different phrase.

**v7.6 — Coherence Validator (post-lighting safety net):**

**`validateLightingCoherence(lighting, venueSetting, city, moonDayInCycle, venueLightCharacter?) → boolean`**

Scans the lighting base phrase for commercial terms that are physically impossible at non-urban venues. If a violation is found, the base is swapped to the venue lightCharacter or setting pool, and `fullPhrase` is rebuilt from patched components.

**`SETTING_BANNED_TERMS`** (~12 terms per non-urban setting):

| Setting    | Banned terms (examples)                                                                                                                                         |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `beach`    | `neon`, `shopfront`, `storefront`, `signage`, `fluorescent`, `billboard`, `bodega`, `vending`, `stall`, `bazaar`, `tower facade`, `boulevard`, `metro entrance` |
| `park`     | Same as beach + `harbour`, `dock`                                                                                                                               |
| `elevated` | Same as beach minus street terms + `cobblestone`, `harbour`, `dock`                                                                                             |
| `monument` | `neon`, `shopfront`, `storefront`, `signage`, `fluorescent`, `billboard`, `bodega`, `vending`, `stall`, `bazaar`, `tower facade`                                |

Urban settings (`street`, `narrow`, `market`, `plaza`, `waterfront`) have NO banned terms — city lightCharacter is correct for these.

**When it fires:** Catches edge cases that v7.5 routing can't prevent — the "balanced" competition outcome concatenating city character with moonlight, future data changes introducing unexpected phrases, or fallback/unknown venue settings. Only fires at night (daytime lighting is solar-driven and always correct). Returns `true` if a violation was corrected.

**Helper functions:**

| Function                                | Input               | Output                                       | Purpose                                    |
| --------------------------------------- | ------------------- | -------------------------------------------- | ------------------------------------------ |
| `getMoonBrightnessValue(dayInCycle)`    | Synodic day 0–29.53 | 0.0–1.0                                      | Phase brightness (full=1.0, new=0.02)      |
| `getLunarAltitudeAttenuation(altitude)` | Degrees             | 0.0–1.0                                      | Low moon = dimmer (atmospheric extinction) |
| `getLunarLightQuality(altitude)`        | Degrees             | `"cool white"`, `"soft"`, `"warm amber"`     | Altitude-driven light colour               |
| `getLunarShadowQuality(altitude)`       | Degrees             | `"short downward"`, `"long stretched"`, etc. | Altitude-driven shadow angle               |

**Base phrase selection by competition winner:**

| Winner   | Condition               | Base Phrase                                                   |
| -------- | ----------------------- | ------------------------------------------------------------- |
| Urban    | Cloud > 60%             | `dense urban skyglow reflected off overcast`                  |
| Urban    | Factor ≥ 0.85           | `intense city light from surrounding towers`                  |
| Urban    | Factor ≥ 0.65           | `strong urban glow flooding the scene`                        |
| Urban    | Factor < 0.65           | `ambient city glow`                                           |
| Moon     | Below horizon           | `faint starlight with sparse artificial light`                |
| Moon     | Cloud > 50%             | `diffused {quality} moonlight through cloud`                  |
| Moon     | Alt ≥ 35°               | `{quality} moonlight with {shadow} shadows`                   |
| Moon     | Alt ≥ 10°               | `{quality} moonlight casting {shadow} shadows`                |
| Moon     | Alt < 10°               | `{quality} moonlight on the horizon casting {shadow} shadows` |
| Balanced | Moon above, cloud ≤ 50% | `{quality} moonlight mixing with ambient city glow`           |
| Balanced | Moon above, cloud > 50% | `diffused moonlight and urban skyglow through cloud`          |
| Balanced | Moon below              | `faint urban glow under a moonless sky`                       |

**Moon position descriptor:** When the moon is above the horizon AND cloud ≤ 75% AND visibility ≥ 3000m, the position phrase (from `getLunarPosition()`, §8.4) is stored in `LightingState.moonPositionPhrase` and rendered by each tier generator in tier-specific syntax.

**moonVisible gate (v6.1):** The entire moon layer (phase name + position phrase) is suppressed when the moon is below the horizon. Gated by `LightingState.moonVisible = isNight && (lunarPosition === null || lunarPosition.altitude > 0)`. No lat/lon → assumes visible (backward compatibility with demo data).

**Example — Hong Kong, overcast, waxing crescent:**

```
urbanFactor = 0.98, cloudAmplification = 1.5
effectiveUrban = 0.98 × 1.5 = 1.47

phaseBrightness = 0.15 (crescent), altAttenuation = 0.85, cloudBlocking = 0.30
effectiveMoon = 0.15 × 0.85 × 0.30 = 0.038

→ Urban dominates (1.47 >> 0.038)
→ base = "intense city light from surrounding towers"
```

**Example — Reykjavik, clear, full moon at +40°:**

```
urbanFactor = 0.25, cloudAmplification = 1.0
effectiveUrban = 0.25

phaseBrightness = 1.0, altAttenuation = 0.95, cloudBlocking = 1.0
effectiveMoon = 0.95

→ Moon dominates (0.95 >> 0.25)
→ base = "cool white moonlight with short downward shadows"
→ moonPositionPhrase = "high in the south-western sky"
```

### 11A.4 Segment 2: SHADOW_MODIFIER — Cloud Cover (v7.0: Visual Truth)

**Daytime only** (solar elevation > 0°). At night, shadow behaviour is already encoded in the base phrase.

**v7.0 change:** Shadow modifier now reads from `VisualTruth.contrast` which cross-references cloud cover, humidity, dew point spread, and air clarity. In v6.1, shadows used cloud cover alone. In v7.0, saturated air (dew spread < 3°C) at 0°C → "faint diffused shadows" even with moderate cloud, not "sharp shadows" as before.

| Cloud % | Modifier                          | Condition                                                             |
| ------- | --------------------------------- | --------------------------------------------------------------------- |
| 0–20%   | with sharp defined shadows        | Only when solar elevation > 6° (below 6° shadows are soft from angle) |
| 20–50%  | with intermittent soft shadows    | Only when solar elevation > 6°                                        |
| 50–75%  | with diffused even light          | Always appended when in range                                         |
| 75–100% | with flat shadowless illumination | Always appended                                                       |
| —       | _(omitted)_                       | When solar elevation 0°–6° (golden hour shadows inherently soft)      |

The conditional logic prevents contradictions: "sharp shadows" cannot appear during golden hour, because golden hour light is inherently soft and directional regardless of cloud cover.

### 11A.5 Segment 3: ATMOSPHERE_MODIFIER — Visibility Only (v6.1 — Simplified, v7.0: Visual Truth)

**v6.1 change:** Humidity removed from atmosphere modifier to eliminate duplication with the separate Humidity layer (§11.5, Layer 8). Visibility is the measured optical clarity — the only signal needed. Humidity is handled exclusively by the humidity vocabulary phrases.

**v7.0 change:** Atmosphere modifier now reads from `VisualTruth.airClarity` which cross-references visibility, humidity, dew point spread, wind speed, temperature, and precipitation. OWM caps visibility at 10000m — Visual Truth distrusts this when dew spread < 1°C (fog forming despite reported 10000m visibility).

| Visibility (m) | Modifier              | Rationale                                          |
| -------------- | --------------------- | -------------------------------------------------- |
| < 1000         | in dense fog          | Visibility < 1km = fog. Measurement overrides all. |
| 1000–3000      | in heavy mist         | Measured low visibility.                           |
| 3000–5000      | in hazy air           | Visible haze confirmed by measurement.             |
| 5000–8000      | in slightly hazy air  | Marginal visibility.                               |
| 8000–10000     | in clear air          | Good visibility. No atmosphere effect.             |
| ≥ 10000        | in pristine clear air | Maximum clarity. Desert/alpine quality.            |

This system **never falsely claims haze** and **never duplicates humidity language**. The atmosphere modifier describes optical clarity only — what you can see through the air. The separate humidity phrase describes how the air feels.

### 11A.6 Segment 4: STABILITY_MODIFIER — Atmospheric Pressure

Pressure describes atmospheric stability, not light colour. Only extreme values produce a modifier. Mid-range pressure is omitted — no noise injection.

| Pressure (hPa) | Modifier                                | Condition                                                                         |
| -------------- | --------------------------------------- | --------------------------------------------------------------------------------- |
| > 1030         | under stable high-pressure air          | Always                                                                            |
| 1015–1030      | _(omitted)_                             | Normal — no modifier needed                                                       |
| 1000–1015      | under unsettled air                     | **Only when cloud > 40%** — low pressure with clear sky is just a windy clear day |
| < 1000         | under low-pressure unsettled conditions | Always                                                                            |

**Night interaction:** Pressure affects cloud behaviour at night. High pressure = clear patches more likely, stars visible. Low pressure = thick unbroken cloud base, stronger city-light reflection, no stars.

### 11A.7 Sky/Lighting Duplication Rule

The lighting engine may encode cloud state ("through broken cloud", "diffused by thick cloud"). The Sky element (§11.7) also describes cloud ("broken clouds", "overcast"). Both appearing creates duplication — especially problematic for weak parsers (Tier 4) that may over-render cloud.

**Rule:** Sky element is conditionally omitted when the lighting phrase already encodes explicit cloud state.

| Lighting phrase contains…                                                           | Sky element | Reason                                                |
| ----------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------- |
| Explicit cloud term ("overcast", "through broken cloud", "diffused by thick cloud") | **Omitted** | Lighting already tells the model the sky state        |
| Only shadow softness ("diffused even light") without naming cloud                   | **Kept**    | "diffused even light" doesn't describe sky appearance |
| No cloud reference at all (clear daytime)                                           | **Kept**    | Sky provides visible overhead description             |

**Distinction to maintain:** Lighting describes what light is doing (optical effect). Sky describes what you see when you look up (visible object). They answer different questions. The omission rule prevents saying both "diffused moonlight through overcast cloud" AND "overcast clouds" in the same prompt.

### 11A.8 Assembly Examples

**Sydney, Feb, 14:00, 10% cloud, 40% humidity, vis 10000m, pressure 1018 hPa, solar elevation ~65°:**

```
Base:        "high-angle sunlight"
Shadow:      "with sharp defined shadows"     ← 10% cloud, elevation > 6°
Atmosphere:  "in pristine clear air"          ← vis 10000 (≥10000)
Stability:   (omitted)                        ← pressure 1018, normal range

RESULT: "high-angle sunlight with sharp defined shadows in pristine clear air"
Sky: KEPT (lighting has no cloud reference)
```

**London, Feb, 15:30, 57% cloud, 60% humidity, vis 10000m, pressure 1016 hPa, solar elevation ~12°:**

```
Base:        "low-angle sunlight"
Shadow:      "with diffused even light"       ← 57% cloud
Atmosphere:  "in pristine clear air"          ← vis 10000 (≥10000)
Stability:   (omitted)                        ← pressure 1016, normal

RESULT: "low-angle sunlight with diffused even light in pristine clear air"
Sky: KEPT (shadow says "diffused even light" but doesn't name cloud)
```

**Helsinki, Dec, 14:00, 90% cloud, 85% humidity, vis 6000m, pressure 998 hPa, solar elevation ~3°:**

```
Base:        "low-angle overcast daylight"    ← cloud > 75% AND elevation < 6° (override)
Shadow:      (omitted)                        ← elevation 0-6°, shadows inherently soft
Atmosphere:  "in slightly hazy air"            ← vis 6000 (5000–8000)
Stability:   "under low-pressure unsettled conditions"  ← pressure 998, cloud 90% > 40%

RESULT: "low-angle overcast daylight in slightly hazy air under low-pressure unsettled conditions"
Sky: OMITTED (base contains "overcast")
```

**Sydney, Feb, 23:00, 30% cloud, 65% humidity, vis 10000m, pressure 1015 hPa, waxing crescent:**

```
urbanFactor: 0.85 (Sydney), cloudAmplification: 1.15
effectiveUrban: 0.98
phaseBrightness: 0.15 (crescent), altAttenuation: ~0.6, cloudBlocking: 0.79
effectiveMoon: 0.071 → Urban dominates

Base:        "strong urban glow flooding the scene"     ← urban dominant, factor ≥ 0.65
Shadow:      (omitted)                                  ← nighttime
Atmosphere:  "in pristine clear air"                    ← vis 10000 (≥10000)
Stability:   (omitted)                                  ← pressure 1015, normal

RESULT: "strong urban glow flooding the scene in pristine clear air"
Sky: KEPT (no cloud reference in lighting)
moonVisible: true (crescent above horizon) — rendered in tier generators
```

**Mumbai, Jul, 20:00, 95% cloud, 92% humidity, vis 2000m, pressure 1004 hPa, waning gibbous:**

```
urbanFactor: 0.76 (Mumbai), cloudAmplification: 1.475
effectiveUrban: 1.12
phaseBrightness: 0.85 (gibbous), altAttenuation: ~0.8, cloudBlocking: 0.335
effectiveMoon: 0.228 → Urban dominates (1.12 >> 0.228)

Base:        "dense urban skyglow reflected off overcast"  ← urban dominant, cloud > 60%
Shadow:      (omitted)                                     ← nighttime
Atmosphere:  "in heavy mist"                               ← vis 2000 (1000–3000)
Stability:   "under low-pressure unsettled conditions"     ← pressure 1004, cloud 95%

RESULT: "dense urban skyglow reflected off overcast in heavy mist under low-pressure unsettled conditions"
Sky: OMITTED (base contains "overcast")
moonVisible: true (gibbous above horizon) — but moonPositionPhrase suppressed (cloud > 75%)
```

**Dubai, Aug, 12:00, 5% cloud, 25% humidity, vis 10000m, pressure 1001 hPa, solar elevation ~82°:**

```
Base:        "near-vertical overhead sunlight"
Shadow:      "with sharp defined shadows"               ← 5% cloud, elevation > 6°
Atmosphere:  "in pristine clear air"                    ← vis 10000 (≥10000)
Stability:   (omitted)                                  ← pressure 1001, but cloud < 40% so omitted

RESULT: "near-vertical overhead sunlight with sharp defined shadows in pristine clear air"
Sky: KEPT (no cloud reference)
```

**New York, Jan, 22:00, 20% cloud, Central Park Bethesda (park, enriched), waxing gibbous (v7.5+v7.7):**

```
rawUrbanFactor: 0.92, settingAttenuation: 0.4 (park)
urbanFactor: 0.92 × 0.4 = 0.368, cloudAmplification: 1.1
effectiveUrban: 0.405

phaseBrightness: 0.75 (gibbous), altAttenuation: ~0.9, cloudBlocking: 0.86
effectiveMoon: 0.581 → Moon dominates (0.581 >> 0.405)

sceneLightPhrase: "Bethesda Fountain lamp and terrace path lanterns"  ← venue lightCharacter (tier 1)
Base: "soft moonlight casting long stretched shadows"                 ← moon dominant
  (venue lightCharacter injected by tier generator, not in lighting base)

RESULT: "soft moonlight casting long stretched shadows"
Without v7.5: effectiveUrban would be 0.92 × 1.1 = 1.012 → Urban dominant (wrong for a park)
```

**Cairo, Oct, 01:00, 0% cloud, Giza Plateau (monument, enriched), full moon at +55° (v7.7):**

```
rawUrbanFactor: 0.45, settingAttenuation: 0.7 (monument)
urbanFactor: 0.45 × 0.7 = 0.315, cloudAmplification: 1.0
effectiveUrban: 0.315

phaseBrightness: 1.0 (full), altAttenuation: 0.95, cloudBlocking: 1.0
effectiveMoon: 0.95 → Moon dominates

sceneLightPhrase: "pyramid floodlights cutting into desert darkness"  ← venue lightCharacter (tier 1)
Base: "cool white moonlight with short downward shadows"

RESULT: "cool white moonlight with short downward shadows in pristine clear air"
```

**Toronto, Feb, 23:00, 80% cloud, snow, Kensington Market (market), waning crescent (v7.8 precipitation fix):**

```
Before v7.8: encodesCloudState = true (always at night)
  → skySource = null  ← ALL descriptions suppressed, including "snow"
  → Prompt has no mention of snow (BUG)

After v7.8: getSkySourceAware() checks CLOUD_ONLY_DESCRIPTIONS
  → "snow" is NOT in CLOUD_ONLY_DESCRIPTIONS → passes through
  → skySource = "snow"
  → Prompt correctly includes snow condition
```

### 11A.9 Tier-Specific Lighting Rendering

The lighting state object is computed once. Each tier renders it differently:

| Tier | Rendering                                                                                                                                                                                                          |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | Comma-separated weighted tokens. Primary source gets 1.3, modifiers unweighted. Example: `(golden-hour sunlight:1.3), sharp defined shadows, pristine clear air`                                                   |
| 2    | v8.0: Multi-prompt `::` syntax. Lighting in Seg 1 (::2). Example: `Golden-hour sunlight with sharp defined shadows::2 Sydney, Bondi Beach, clear sky::1 pristine air on dry pavement::0.5 --ar 16:9 --stylize 100` |
| 3    | Causal sentence. Source → modifier → result. v8.0: ending from `getSettingEnding()`. Example: `Golden-hour sunlight casts sharp defined shadows through pristine clear air.`                                       |
| 4    | Full phrase as-is in comma-separated list. Example: `..., golden-hour sunlight with sharp defined shadows in pristine clear air, ...`                                                                              |

### 11A.10 Lighting Phrase Count

| Segment                        | Phrases | Notes                                             |
| ------------------------------ | ------- | ------------------------------------------------- |
| Daytime + twilight base (v9.1) | 87      | 8 bands × 4 cloud strata pools (3–4 phrases each) |
| Night base (competition)       | 12      | 4 urban + 5 moon + 3 balanced (v6.1 competition)  |
| Setting night light (v7.5)     | 20      | 5 each for beach, park, elevated, monument        |
| Venue enrichment (v7.7)        | 75      | 3 phrases × 25 iconic venues across 19 cities     |
| Shadow modifier                | 4       | + 2 omission rules                                |
| Atmosphere modifier            | 6       | Visibility-only (v6.1, humidity removed)          |
| Stability modifier             | 2       | + 1 omission rule                                 |
| Moon position descriptors      | 40      | 5 altitude bins × 8 azimuth sectors (§8.4)        |
| **Total**                      | **246** | + conditional omission rules + competition logic  |

246 phrases (was 167 at v8.0), procedurally assembled. The daytime pool system alone produces 87 distinct base phrases before shadow/atmosphere/stability modification. The night competition model with venue attenuation produces hundreds of distinct outputs from 12 base phrases × cloud modifiers × urban factors × venue attenuation × moon altitudes × 3-tier light phrase selection.

### 11A.11 LightingState Type Reference (v8.0, updated v9.1)

**File:** `src/lib/weather/prompt-types.ts` (type definition) — `src/lib/weather/lighting-engine.ts` (producer)

The `LightingState` interface is the output of `computeLighting()` and the input to all 5 tier generators (T1 CLIP, T1F Flux, T2 MJ, T3 NL, T4 Plain):

```typescript
interface LightingState {
  /** Full assembled phrase: "[BASE] [SHADOW] [ATMOSPHERE] [STABILITY]" */
  fullPhrase: string;
  /** Base light descriptor (always present) */
  base: string;
  /** Shadow modifier (daytime only, may be empty) */
  shadowModifier: string;
  /** Atmosphere modifier (may be empty) */
  atmosphereModifier: string;
  /** Stability modifier (may be empty) */
  stabilityModifier: string;
  /** Structured cloud state derived from cloud cover bins */
  cloudState: CloudState;
  /** Whether the lighting already encodes cloud state (so Sky can be omitted).
   *  v7.8: at night this is always true, but precipitation still passes through
   *  via getSkySourceAware(). */
  encodesCloudState: boolean;
  /**
   * v9.1.0: Correlated colour temperature in Kelvin (CCT).
   * Standard photography scale: 2500K = golden hour, 5500K = daylight,
   * 6500K = overcast, 10000K = blue hour. null when night (urban light is mixed).
   * Computed from solar elevation + cloud cover blend (§11A.3).
   */
  colourTempK: number | null;
  /**
   * Moon position phrase for prompt rendering. null when:
   * - Daytime (moon layer suppressed)
   * - Moon below horizon (altitude ≤ 0°)
   * - Cloud > 75% (position not visible)
   * - Visibility < 3000m (position not discernible)
   * - No lat/lon available
   * e.g. "low in the eastern sky", "high in the north-western sky"
   */
  moonPositionPhrase: string | null;
  /**
   * Which light source dominates at night. null during daytime.
   * 'urban' = city glow overpowers moonlight
   * 'moon' = moonlight is primary light source
   * 'balanced' = both contribute roughly equally
   */
  nightDominant: 'urban' | 'moon' | 'balanced' | null;
  /**
   * Whether the moon is above the horizon and renderable in the prompt.
   * When false, the entire moon layer (phase + position) is suppressed.
   */
  moonVisible: boolean;
}
```

**v9.1.0 addition:** `colourTempK` — computed by `computeColourTempK()` from solar elevation band + quadratic cloud blend. See §11A.3 for CCT reference table and blend curve.

**v7.8 change from v6.1:** `phrase` renamed to `fullPhrase`. New fields: `base`, `shadowModifier`, `atmosphereModifier`, `stabilityModifier`, `cloudState`. These sub-fields enable `validateLightingCoherence()` (v7.6) to patch individual segments and rebuild the assembled phrase.

### 11A.12 Venue Type References (v7.5/v7.7/v8.0)

**File:** `src/lib/weather/prompt-types.ts` (type definitions) — `src/lib/weather/lighting-engine.ts` (consumer)

```typescript
type VenueSetting =
  | 'waterfront'
  | 'beach'
  | 'street'
  | 'narrow'
  | 'market'
  | 'plaza'
  | 'park'
  | 'elevated'
  | 'monument';

interface CityVenueData {
  name: string;
  setting?: VenueSetting;
  /** v7.7: Optional venue-specific night light phrases. When present,
   *  these override both the setting pool and city lightCharacter. */
  lightCharacter?: string[];
  // v8.0 note: `overrideJustification` exists in JSON but is NOT in this
  // TypeScript interface — it's consumed only by lint-venues.ts, not runtime.
}

interface VenueResult {
  name: string;
  setting: VenueSetting;
  /** v7.7: Venue-specific night light phrases (when present in JSON). */
  lightCharacter?: string[];
}
```

---

## 11B. Precipitation Truth (v8.0 — Chat 1, v9.3 — Compound Detection)

**File:** `src/lib/weather/visual-truth.ts` (classifyPrecip at lines 77–200)

The biggest correctness bug in v7.x: snow, sleet, hail, fog, mist, smoke, and dust were NOT treated as precipitation-active. Only rain/drizzle/thunderstorm triggered the old `precipitationActive` boolean. Toronto at −5°C with heavy snow → air clarity "clear", surfaces "invisible moisture" — obviously wrong.

**v9.3.0 addition:** Real weather has layered atmospheric conditions. OWM often sends "light rain" with visibility=800m — that 800m MEANS fog is present, but the old single-type classifier only saw "rain" and the fog layer vanished from the prompt. Compound detection now identifies secondary atmospheric layers during falling precipitation.

### 11B.1 PrecipState

**`classifyPrecip(weather: ExchangeWeatherFull) → PrecipState`**

```typescript
type PrecipType =
  | 'none'
  | 'rain'
  | 'drizzle'
  | 'snow'
  | 'sleet'
  | 'hail'
  | 'thunderstorm'
  | 'mist'
  | 'fog'
  | 'haze'
  | 'smoke'
  | 'dust';

type PrecipIntensity = 'none' | 'light' | 'moderate' | 'heavy';

interface PrecipState {
  type: PrecipType;
  intensity: PrecipIntensity;
  active: boolean; // Something physically falling
  reducesVisibility: boolean; // All active precip + fog/mist/haze/smoke/dust
  secondaryType: PrecipType | null; // v9.3.0: Compound atmospheric layer
  visibilityMetres: number; // v9.3.0: Raw OWM visibility (0–10000)
  compound: boolean; // v9.3.0: secondaryType !== null
}
```

#### Primary Type Detection (2-priority)

**Priority 1 — Numeric measurement** (when OWM provides `rain.1h` / `snow.1h`):

| Precip | Light    | Moderate | Heavy  |
| ------ | -------- | -------- | ------ |
| Rain   | < 2 mm   | 2–6 mm   | > 6 mm |
| Snow   | < 0.5 mm | 0.5–2 mm | > 2 mm |

**Priority 2 — Keyword inference** (when numeric unavailable). Scans `conditions` + `description` for: thunder → thunderstorm, hail → hail, sleet → sleet, snow → snow, drizzle → drizzle, rain → rain, fog → fog, mist → mist, haze → haze, smoke → smoke, dust/sand → dust.

#### Compound Detection (v9.3.0 — 3-Source)

Only applies when primary type is **falling** precipitation (`active === true`). Fog/mist as primary don't get a secondary — they ARE the atmospheric layer.

| Priority | Source                    | Detection                                                                | Example                                 |
| -------- | ------------------------- | ------------------------------------------------------------------------ | --------------------------------------- |
| 1        | **Explicit OWM keywords** | Keywords in description: "rain and fog", "snow with mist"                | "light rain and fog" → rain + fog       |
| 2        | **OWM visibility**        | Vis < 1000m → fog, < 3000m → mist, < 5000m → haze                        | Rain at vis=800m → rain + fog           |
| 3        | **Dew-point proximity**   | Dew spread < 1°C + wind < 10 km/h → fog. Spread < 1°C + wind < 15 → mist | Snow at 0.5°C spread, calm → snow + fog |

### 11B.2 Visual Truth Integration

`deriveVisualTruth()` receives `PrecipState` and handles:

- **Compound precipitation → air clarity:** When `compound === true`, the secondary atmospheric layer directly overrides air clarity (see §11.12). Rain+fog → `'foggy'` regardless of intensity.
- **Snow-specific air clarity:** Diffuse scattering. Heavy snow → `'foggy'` air clarity. Moderate → `'misty'`. Light → `'hazy'`.
- **Snow surface moisture:** Accumulation at ≤0°C (frost/snow-covered surfaces), melting at >0°C (wet slush).
- **Hail surface effects:** Visible regardless of temperature.
- **Fog/mist/haze/smoke/dust:** Atmospheric classification with OWM type trust (these are primary, not compound).
- **v9.4.0:** Climate-normalised thresholds for non-precipitation paths (see §11H).

### 11B.3 Gateway Fields

5 `WeatherData` fields extracted from OWM (full pipeline: gateway types → adapter → frontend fetch → component types → exchange card → weather types):

| Field         | OWM Source      | Type             | Purpose                                                                                                      |
| ------------- | --------------- | ---------------- | ------------------------------------------------------------------------------------------------------------ |
| `rainMm1h`    | `rain["1h"]`    | `number \| null` | Numeric rain intensity (mm/hr)                                                                               |
| `snowMm1h`    | `snow["1h"]`    | `number \| null` | Numeric snow intensity (mm/hr)                                                                               |
| `windDegrees` | `wind.deg`      | `number \| null` | Wind direction (meteorological °)                                                                            |
| `windGustKmh` | `wind.gust×3.6` | `number \| null` | Wind gust speed (km/h)                                                                                       |
| `weatherId`   | `weather[0].id` | `number \| null` | v9.5.0: OWM weather condition ID (200–804). Used by cloud type classifier (§11I) and precipitation detection |

---

## 11C. Beaufort Wind Classification (v8.0 — Chat 2)

> **Note:** This section is retained for historical context (v8.0 design rationale). The comprehensive wind system documentation including venue phrase pools, output format, and snow interaction is in **§11.6** (updated v9.0).

Replaces the old 4-tier `WindTier` (`calm`/`moderate`/`strong`/`extreme`) with 7 Beaufort-aligned force tiers.

### 11C.1 classifyWind

**`classifyWind(speed: number) → WindForce`**

```typescript
type WindForce =
  | 'calm'
  | 'breeze'
  | 'fresh'
  | 'strong'
  | 'nearGale'
  | 'gale'
  | 'strongGale'
  | 'storm';
```

| Force        | Speed (km/h) | Beaufort | Visual Effects                                |
| ------------ | ------------ | -------- | --------------------------------------------- |
| `calm`       | 0–5          | 0–1      | Still air, smoke rises vertically             |
| `breeze`     | 6–19         | 2–3      | Leaves rustle, flags stir                     |
| `fresh`      | 20–29        | 4–5      | Small branches sway, flags extend             |
| `strong`     | 30–49        | 6        | Large branches move, umbrellas difficult      |
| `nearGale`   | 50–61        | 7        | Whole trees sway, walking resistance          |
| `gale`       | 62–74        | 8        | Twigs break, structural damage begins         |
| `strongGale` | 75–88        | 9        | Chimney pots removed, roof tiles loose        |
| `storm`      | 89+          | 10+      | Trees uprooted, significant structural damage |

**Key correction:** 50 km/h = `nearGale` (strong effects, NOT destructive). Destructive phrases start at `gale` (62+). All human-body phrases purged from all tiers.

### 11C.2 Wind Direction + Gusts

- **`getCardinalDirection(degrees)`** converts OWM `wind.deg` to cardinal word. Added as prefix when available: `"south-westerly 35 km/h wind"`.
- **Gust factor:** When `windGustKmh > sustained × 1.5` → appends `"gusting to {gust}"` suffix.
- **Snow + wind interaction:** When PrecipState is active snow + wind ≥ 20 km/h → blowing/drifting snow phrases override venue interaction (horizontal at 50+, reducing visibility at 30+).

---

## 11D. Venue Taxonomy Validation (v8.0 — Chat 3)

### 11D.1 SETTING_OVERRIDES

Runtime safety net in `getCityVenue()`. Overrides the setting from `city-vibes.json` for known misclassifications. Currently empty (all known errors fixed in city-vibes.json v8.0.0).

```typescript
const SETTING_OVERRIDES: Record<string, VenueSetting> = {
  // No overrides currently needed — all known errors fixed in city-vibes.json v8.0.0.
};
```

### 11D.2 overrideJustification

15 venues carry an `overrideJustification` string in `city-vibes.json`, documenting why their name contradicts their setting. Examples:

- `"Oak Street Beach"` → setting `beach` — justification: _"Genuine beach on Lake Michigan despite Street in name"_
- `"Lambton Quay"` → setting `street` — justification: _"Major commercial street — no water despite Quay in name (historic reclamation)"_
- `"Xochimilco Canals"` → setting `waterfront` — justification: _"Ancient floating gardens on active waterways with trajineras"_

### 11D.3 Venue Taxonomy Linter

**File:** `scripts/lint-venues.ts`

Standalone CI-ready linter. Validates venue name → setting assignments against 7 naming rules. Flags entries where the name implies a different setting than assigned.

**Usage:**

```
npx tsx scripts/lint-venues.ts          # Lint and report
npx tsx scripts/lint-venues.ts --strict  # Exit code 1 on ANY flag (including justified)
```

**Exit codes:** 0 = pass (0 errors), 1 = fail (unjustified mismatches), 2 = file read error. Current state: 0 errors, 8 justified overrides (from the 15 override venues, 8 match active lint rules).

---

## 11E. Prompt Profile (v8.0 — Chat 7)

### 11E.1 PromptProfile Interface

Configures the generator without introducing unpredictability. All fields optional — omitted fields use `DEFAULT_PROMPT_PROFILE` values (zero regression).

```typescript
export interface PromptProfile {
  verbosity: 'short' | 'standard' | 'rich';
  style: 'photoreal' | 'cinematic' | 'documentary';
  excludePeople: 'always' | 'quiet-hours' | 'never';
  mjAspect: '1:1' | '16:9' | '2:3';
  mjStylize: number;
  mjVersion: '5.2' | '6.1' | '7'; // v9.6.0: MJ model version (§11K.2)
  strictPhysics: boolean; // Reserved, no effect yet
}

export const DEFAULT_PROMPT_PROFILE: PromptProfile = {
  verbosity: 'standard',
  style: 'photoreal',
  excludePeople: 'quiet-hours',
  mjAspect: '16:9',
  mjStylize: 100,
  mjVersion: '7', // v9.6.0: default V7 natural language
  strictPhysics: false,
};
```

### 11E.2 Profile-Keyed Constants

| Constant              | Keys                                | Effect                                                                                 |
| --------------------- | ----------------------------------- | -------------------------------------------------------------------------------------- |
| `STYLE_QUALITY_TAGS`  | photoreal / cinematic / documentary | T1 quality tag triples (e.g. `professional photography, sharp focus, high resolution`) |
| `STYLE_ENDING_PREFIX` | photoreal / cinematic / documentary | T3 ending prefix (`Photorealistic` / `Cinematic` / `Documentary`)                      |
| `VERBOSITY_T1_LIMIT`  | short(12) / standard(15) / rich(18) | Max T1 parts (CLIP token budget)                                                       |
| `VERBOSITY_T4_LIMIT`  | short(8) / standard(10) / rich(12)  | Max T4 fragments (weak parser budget)                                                  |

### 11E.3 Threading

Profile is resolved once in `generateWeatherPrompt()` via `resolveProfile(input.profile)`, then passed to all 5 tier generators (T1 CLIP, T1F Flux, T2 MJ, T3 NL, T4 Plain). `shouldExcludePeople(profile, ...)` replaces raw `isQuietHours()` calls in tier bodies. `mjVersion` selects V5.2 legacy vs V6.1/V7 natural language format in T2 (§11K.2).

---

## 11F. Prompt Trace (v8.0 — Chat 8)

### 11F.1 PromptTrace Interface

Diagnostic trace exposing every decision the generator made. Only populated when `debug: true` in `WeatherPromptInput` or `process.env.NODE_ENV === 'development'`. Zero cost in production.

```typescript
export interface PromptTrace {
  profile: PromptProfile;
  precip: {
    type: string;
    intensity: string;
    active: boolean;
    reducesVisibility: boolean;
    secondaryType: string | null; // v9.3.0: compound precipitation
    visibilityMetres: number | null; // v9.3.0: estimated visibility
    compound: boolean; // v9.3.0: multi-source detection
  };
  windForce: string;
  windSpeedKmh: number;
  venue: { name: string; setting: string } | null;
  visualTruth: {
    airClarity: string;
    contrast: string;
    moistureVisibility: string;
    thermalOptics: string;
    precipActive: boolean;
  } | null;
  lighting: {
    base: string;
    fullPhrase: string;
    shadowModifier: string;
    atmosphereModifier: string;
    colourTempK: number; // v9.1.0: Kelvin colour temperature
    moonVisible: boolean;
    moonPositionPhrase: string | null;
    nightDominant: string | null;
    encodesCloudState: boolean;
  };
  solarElevation: number | null;
  camera: {
    // v9.2.0: Camera + lens selection (§11G)
    body: string;
    lensSpec: string;
    lensDescriptor: string;
  };
  climate: {
    // v9.4.0: Climate zone + normalisation (§11H)
    zone: string;
    effectiveHumidity: number;
    effectiveDewSpread: number;
    humidityOffset: number;
    dewSpreadScale: number;
  };
  cloudType: string; // v9.5.0: Cloud type classification (§11I)
  solarPhase: string; // v9.5.0: Dawn/dusk solar phase (§11J)
  moon: { name: string; dayInCycle: number; emoji: string };
  isNight: boolean;
  seed: number;
  excludedPeople: boolean;
  localHour: number;
  temperatureC: number;
  humidity: number;
}
```

### 11F.2 WeatherPromptResult

v8.0 (Chat 5): `generateWeatherPrompt()` returns a structured object instead of a plain string. v9.6.0: `fluxPrompt` field added for Flux-native T5 variant (§11K.1).

```typescript
export interface WeatherPromptResult {
  text: string; // Full display string (backward compat)
  positive?: string; // Positive prompt only (Tier 1 only)
  negative?: string; // Negative prompt only (Tier 1 only)
  fluxPrompt?: string; // v9.6.0: Flux T5 variant (Tier 1 only) (§11K.1)
  tier: PromptTier;
  trace?: PromptTrace; // v8.0 Chat 8 — debug mode only
}
```

Existing consumers use `.text` identically to the old string return. Tier 1 populates `positive`/`negative` separately for "copy positive only" UI. `fluxPrompt` is only populated when `tier === 1` — for all other tiers it is `undefined`.

### 11F.3 WeatherPromptInput

v8.0 adds two new optional fields:

```typescript
export interface WeatherPromptInput {
  city: string;
  weather: ExchangeWeatherFull;
  localHour: number;
  observedAtUtcSeconds?: number | null;
  tier: PromptTier;
  latitude?: number | null;
  longitude?: number | null;
  profile?: Partial<PromptProfile> | null; // v8.0 Chat 7
  debug?: boolean; // v8.0 Chat 8
}
```

---

## 11G. Camera & Lens Metadata (v9.2.0 — Chat 3)

**File:** `src/lib/weather/camera-lens.ts` (283 lines)

AI image generators trained on EXIF-tagged photography datasets respond strongly to camera/lens metadata — it controls depth of field, distortion, colour science, and perceived "look" more reliably than adjective lists. This module selects physically correct camera body + lens combinations for the scene.

### 11G.1 Camera Bodies — Style-Driven

Three pools, one per `PromptProfile.style`:

| Style         | Pool                 | Bodies                                                                                               |
| ------------- | -------------------- | ---------------------------------------------------------------------------------------------------- |
| `photoreal`   | `BODIES_PHOTOREAL`   | Canon EOS R5, Sony A7R V, Nikon Z8, Fujifilm GFX 100S, Leica SL2-S, Sony A7 IV, Canon EOS R6 Mark II |
| `cinematic`   | `BODIES_CINEMATIC`   | ARRI Alexa Mini LF, RED V-Raptor, Sony Venice 2, Blackmagic URSA Mini Pro, Canon C500 Mark II        |
| `documentary` | `BODIES_DOCUMENTARY` | Sony FX3, Canon C70, Leica Q3, Fujifilm X-T5, Ricoh GR IIIx, Nikon Zf                                |

Selection: `pickRandom(STYLE_BODIES[style], seed * 2.1)` — deterministic per city/conditions/hour.

### 11G.2 Lens Selection — Venue-Driven Focal Length

Physical rules drive focal length: can't shoot 200mm in a narrow alley (no room), elevated viewpoints need wide/ultrawide (showing expanse), beach gets wide (seascape) or tele (compressed horizon).

**6 lens classes**, each with 3–5 options:

| Class        | Lenses                                                 | Descriptor          |
| ------------ | ------------------------------------------------------ | ------------------- |
| `ultrawide`  | 14mm f/2.8, 16mm f/2.8, 12-24mm f/2.8                  | ultra-wide angle    |
| `wide`       | 24mm f/1.4, 28mm f/2, 20mm f/1.8, 24-70mm f/2.8        | wide angle          |
| `standard`   | 35mm f/1.4, 50mm f/1.2, 40mm f/2, 35mm f/2, 50mm f/1.8 | 35mm/50mm prime     |
| `portrait`   | 85mm f/1.4, 105mm f/2.8 macro, 90mm f/2                | portrait/short tele |
| `tele`       | 135mm f/1.8, 200mm f/2.8, 70-200mm f/2.8               | telephoto           |
| `anamorphic` | 40mm T2, 50mm T2, 75mm T2.8, 35mm T2 (all anamorphic)  | anamorphic lens     |

**Venue → lens class weighting:**

| Setting      | Weighted Classes           | Rationale                        |
| ------------ | -------------------------- | -------------------------------- |
| `elevated`   | ultrawide, wide, wide      | Show the expanse                 |
| `beach`      | wide, wide, tele, standard | Seascape or compressed horizon   |
| `waterfront` | wide, standard, tele       | Harbour breadth or ship detail   |
| `park`       | standard, wide, portrait   | 35–50mm classic + shallow DoF    |
| `market`     | standard, wide, standard   | Mid-range among stalls           |
| `plaza`      | standard, wide, standard   | Open space, standard perspective |
| `monument`   | standard, portrait, wide   | Architectural detail             |
| `street`     | standard, standard, wide   | Classic street photography       |
| `narrow`     | standard, wide, standard   | No room for tele                 |

**Cinematic anamorphic override:** When `style === 'cinematic'`, a 40% chance roll replaces the venue-driven lens with an anamorphic option (`LENSES_ANAMORPHIC`). This produces the characteristic horizontal flares and oval bokeh of cinema lenses.

### 11G.3 Platform-Aware Quality Tags

Different tiers need different camera metadata integration. The same `CameraLensResult` feeds four format functions:

| Tier       | Function                          | Output Format                                                     | Example                                                                                              |
| ---------- | --------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| T1 (CLIP)  | `getQualityTagsT1(camera, style)` | Weighted tokens: `shot on {full}` + style-specific technical tags | `["shot on Canon EOS R5, 35mm f/1.4", "sharp focus", "high resolution", "professional photography"]` |
| T2 (MJ)    | `getQualityT2(camera)`            | Camera body only (MJ interprets camera look natively)             | `"shot on ARRI Alexa Mini LF"`                                                                       |
| T3 (NL)    | `getQualityEndingT3(camera)`      | Woven into setting ending sentence                                | `"Shot on Canon EOS R5 with a 35mm f/1.4 lens."`                                                     |
| T4 (Plain) | `getQualityT4(camera)`            | Lens descriptor only (weak parsers)                               | `"wide angle"`                                                                                       |

**Style-specific T1 quality tags:**

| Style         | Tags after `shot on {camera}`                           |
| ------------- | ------------------------------------------------------- |
| `photoreal`   | sharp focus, high resolution, professional photography  |
| `cinematic`   | cinematic color grading, film grain, high resolution    |
| `documentary` | natural light, documentary photography, high resolution |

### 11G.4 Negative Prompt System

Three platform-specific negative prompt approaches:

**Tier 1 (CLIP/SD):** `getNegativeT1(quiet): string` — Full comma-separated anti-tokens.

- Base: `text, watermark, logo, signature, blurry, out of focus foreground, oversaturated, HDR artefacts`
- Quiet hours adds: `people, person, crowd, pedestrian, silhouette`

**Tier 2 (MJ):** `getMjNoParam(quiet): string` — MJ `--no` syntax, space-separated, max ~10 tokens.

- Base: `--no text watermark logo blur`
- Quiet hours adds: `people person crowd`

**Tier 3 (DALL·E/NL):** Inline "Avoid:" sentence (DALL·E ignores negative prompt parameters — avoidance must be woven into the positive prompt). Handled by `shouldExcludePeople()` in the tier body.

**Tier 4 (Plain):** Inline "no X" suffix for weak parsers.

### 11G.5 CameraLensResult Interface

```typescript
interface CameraLensResult {
  full: string; // "Canon EOS R5, 35mm f/1.4"
  body: string; // "Canon EOS R5"
  lensSpec: string; // "35mm f/1.4"
  lensDescriptor: string; // "35mm prime"
}
```

`getCameraLens(style, venueSetting, seed): CameraLensResult` — Main entry point. Deterministic: same inputs → same result.

---

## 11H. Climate-Aware Humidity (v9.4.0 — Chat 5)

**File:** `src/lib/weather/climate.ts` (195 lines)

### 11H.1 Problem

`deriveVisualTruth()` used fixed humidity thresholds everywhere. 85% humidity triggers "noticeable" moisture in Singapore (perfectly normal for a tropical city) AND London (genuinely fog-forming). Singapore ≠ London. The root cause is that warm air holds exponentially more water (Clausius–Clapeyron relation): at 30°C saturation is ~30 g/m³; at 5°C it's ~7 g/m³. So 85% RH at 30°C leaves plenty of capacity headroom, but 85% RH at 5°C means saturation is imminent.

### 11H.2 Solution — Climate Zone Normalisation

Compute "effective humidity" and "effective dew spread" that normalise raw values against climate expectations. Thresholds were calibrated for cool-temperate (London/Paris) — adjustments shift tropical and arid readings toward equivalent visual impact.

**7 climate zones** classified by `classifyClimate(latitude, tempC, humidity)`:

| Zone             | Latitude Band                 | Secondary Signal                      | Example Cities                              |
| ---------------- | ----------------------------- | ------------------------------------- | ------------------------------------------- |
| `tropical`       | \|lat\| < 15°                 | —                                     | Singapore, Bangkok, Jakarta, Lagos, Nairobi |
| `subtropical`    | 15–25°                        | warm                                  | Mumbai, Hong Kong, Taipei, Manila, Dhaka    |
| `arid`           | 15–35°                        | hot + dry (tempC > 25, humidity < 45) | Abu Dhabi, Cairo, Doha, Kuwait City         |
| `warm-temperate` | 25–40°                        | moderate                              | Tokyo, Shanghai, Sydney, São Paulo          |
| `cool-temperate` | 40–55°                        | — (baseline)                          | London, Paris, Frankfurt, Toronto, New York |
| `continental`    | 50–65° or very cold           | tempC < −5 at 40–55°                  | Moscow, Helsinki, Almaty                    |
| `subarctic`      | \|lat\| > 60° or extreme cold | tempC < −15 at 50°+                   | Reykjavik, Ulaanbaatar                      |

Primary signal: absolute latitude. Secondary: temperature + humidity (distinguishes arid from humid at the same latitude — Cairo ≠ Shanghai).

### 11H.3 Zone Parameters

Each zone has a `humidityOffset` (positive = thresholds effectively raised, higher raw humidity needed to trigger effects) and a `dewSpreadScale` (>1 = wider effective spread, further from condensation).

| Zone             | humidityOffset | dewSpreadScale | Effect                                                        |
| ---------------- | -------------- | -------------- | ------------------------------------------------------------- |
| `tropical`       | +15            | 1.6            | Singapore 85% → ~70% effective. Warm air headroom absorbed    |
| `subtropical`    | +10            | 1.4            | Similar but less aggressive                                   |
| `arid`           | −8             | 0.8            | Abu Dhabi 50% → ~58% effective. Rare moisture amplified       |
| `warm-temperate` | +5             | 1.15           | Mild adjustment                                               |
| `cool-temperate` | 0              | 1.0            | **Baseline** — no change. Existing thresholds calibrated here |
| `continental`    | −3             | 0.85           | Cold air near capacity, slight tightening                     |
| `subarctic`      | −5             | 0.75           | Moscow 90% RH, 1°C spread → guaranteed fog                    |

### 11H.4 ClimateContext Interface

```typescript
interface ClimateContext {
  zone: ClimateZone;
  effectiveHumidity: number; // raw - offset (clamped 0–100)
  effectiveDewSpread: number; // raw × scale (clamped ≥ 0)
  humidityOffset: number; // for trace
  dewSpreadScale: number; // for trace
}
```

`computeClimateContext(latitude, tempC, humidity, dewSpread): ClimateContext` — Computed once per prompt in the orchestrator. The `effectiveHumidity` and `effectiveDewSpread` values feed into `deriveVisualTruth()` threshold checks (replacing raw humidity/dew-spread when latitude is available). When latitude is null, `cool-temperate` baseline applies (zero regression from v8.0).

### 11H.5 Calibration Examples

| City            | Raw Humidity | Raw Dew Spread | Zone           | Effective Humidity | Effective Dew Spread | Visual Result                                   |
| --------------- | ------------ | -------------- | -------------- | ------------------ | -------------------- | ----------------------------------------------- |
| Singapore       | 85%          | 2°C            | tropical       | ~70%               | ~3.2°C               | clear / subtle (correct — normal tropical day)  |
| London          | 85%          | 2°C            | cool-temperate | 85%                | 2°C                  | hazy / noticeable (correct — fog forming)       |
| Abu Dhabi       | 50%          | 8°C            | arid           | ~58%               | ~6.4°C               | softened (correct — unusually humid for desert) |
| Moscow (winter) | 90%          | 1°C            | continental    | ~93%               | ~0.8°C               | foggy (correct — guaranteed condensation)       |

### 11H.6 Integration

Called in `weather-prompt-generator.ts` orchestrator at line 122. Result stored in `PromptTrace.climate` for debugging. The `latitude` parameter (already piped through ExchangeCardData → prompt input for solar elevation) enables zone classification with zero new data requirements.

---

## 11I. Cloud Type Classifier (v9.5.0 — Chat 6)

**File:** `src/lib/weather/cloud-types.ts` (223 lines)

### 11I.1 Problem

OWM provides cloud _coverage_ (few/scattered/broken/overcast) but prompts just said "broken clouds" — generic and visually flat. Real clouds have _type_: cumulus (puffy white towers), stratus (flat grey blankets), cirrus (wispy ice trails), cumulonimbus (towering thunderheads). Each produces distinct light, shadow, and atmospheric character in photographs.

### 11I.2 Solution — 3-Path Classification

`classifyCloudType(description, conditions, cloudCover, weatherId, tempC, precipActive): CloudType`

**10 visual cloud types:**

| CloudType       | Visual Character           | Photographic Impact                               |
| --------------- | -------------------------- | ------------------------------------------------- |
| `clear`         | No clouds — open sky       | Maximum contrast, hard shadows                    |
| `cirrus`        | High thin wispy ice clouds | Delicate streaks, minimal shadow                  |
| `cirrostratus`  | High thin uniform sheet    | Halo around sun/moon, diffused light              |
| `altocumulus`   | Mid-level puffy patches    | "Mackerel sky", dappled shadows                   |
| `altostratus`   | Mid-level uniform grey     | Sun visible as pale disc, flat light              |
| `cumulus`       | Low-mid puffy white towers | Fair weather, strong contrast between sun breaks  |
| `stratocumulus` | Low layered + lumpy        | Most common worldwide, occasional sun breaks      |
| `stratus`       | Low flat uniform grey      | Featureless blanket, diffuses all shadows         |
| `nimbostratus`  | Thick dark rain-bearing    | Grey wall, oppressive atmosphere                  |
| `cumulonimbus`  | Towering thunderheads      | Dramatic anvil tops, dark bases, storm atmosphere |

**Classification paths (tried in order):**

**Path 1 — `weatherId` (most precise):** When OWM `weather[0].id` is available (piped via v9.5.0 `weatherId` field through all 5 type interfaces — §5):

| weatherId Range | Cloud Type      | Rationale                       |
| --------------- | --------------- | ------------------------------- |
| 200–299         | `cumulonimbus`  | Thunderstorm group              |
| 300–399         | `nimbostratus`  | Drizzle → low thick cloud       |
| 500–501         | `nimbostratus`  | Light/moderate rain             |
| 502–599         | `cumulonimbus`  | Heavy/extreme rain → convective |
| 600–699         | `nimbostratus`  | Snow group                      |
| 700–799         | `stratus`       | Atmosphere (fog/mist/haze)      |
| 800             | `clear`         | Clear sky                       |
| 801             | `cumulus`       | Few clouds → fair weather       |
| 802–803         | `stratocumulus` | Scattered/broken                |
| 804             | `stratus`       | Overcast                        |

**Path 2 — Description parsing:** When `weatherId` unavailable. Matches keywords from OWM `weather.description` string:

- `thunder`/`storm` → `cumulonimbus`
- `heavy` + `rain` → `cumulonimbus`
- Active precipitation → `nimbostratus`
- `drizzle`/`rain`/`snow`/`sleet` → `nimbostratus`
- `fog`/`mist`/`haze`/`smoke`/`dust` → `stratus`
- `clear sky`/`few clouds`/`scattered clouds`/`broken clouds`/`overcast` → exact type mapping

**Path 3 — Cloud cover % inference:** Last resort when description is ambiguous:

- ≤5% → `clear`
- ≤25% → `cirrus` (if cold, high altitude implied) or `cumulus`
- 26–75% → `stratocumulus`
- 76–90% → `altostratus`
- 91–100% → `stratus`

### 11I.3 Visual Phrase Pools

`CLOUD_PHRASES: Record<CloudType, readonly string[]>` — **40 phrases total** (4 per cloud type). Seeded selection via `pickRandom()`.

Examples:

- **cumulus:** "fair-weather cumulus dotting the sky", "bright white cumulus towers with flat bases", "billowing cumulus clouds drifting lazily", "puffy cotton-white cumulus formations"
- **cumulonimbus:** "towering cumulonimbus thunderheads", "dramatic cumulonimbus anvil clouds dominating the sky", "massive convective cloud towers with dark bases", "cumulonimbus pillars rising through the atmosphere"
- **stratus:** "flat uniform stratus ceiling", "featureless grey stratus blanket overhead", "low grey stratus sheet diffusing all shadows", "unbroken stratus layer creating even grey light"

### 11I.4 Sky Source Enrichment

In `tier-generators.ts`, `enhanceSkySource()` replaces generic OWM cloud descriptions with cloud-type phrases at prompt assembly time. A `REPLACEABLE_SKY` set identifies 11 generic OWM strings that can be safely replaced:

```
clear sky, clear, sunny, few clouds, scattered clouds, broken clouds,
overcast clouds, overcast, partly cloudy, mostly cloudy, cloudy
```

Precipitation descriptions (`rain`, `snow`, `thunderstorm`, etc.) are **never** replaced — they carry critical scene information that cloud-type phrases don't cover.

### 11I.5 Integration

- Classified once per prompt in the orchestrator (line 137).
- Result stored on `VisualTruth.cloudType` (v9.5.0 field).
- Result stored in `PromptTrace.cloudType` for debugging.
- Consumed by all 5 tier generators via `enhanceSkySource()`.

---

## 11J. Dawn/Dusk Solar Phase (v9.5.0 — Chat 6)

**File:** `src/lib/weather/time-utils.ts` (+120 lines added to existing file, total 203 lines)

### 11J.1 Problem

The lighting engine uses solar elevation for band classification (golden hour, civil twilight, etc.) but cannot distinguish dawn from dusk — they have identical elevation angles but DIFFERENT colour palettes:

|                 | Dawn                              | Dusk                               |
| --------------- | --------------------------------- | ---------------------------------- |
| **Colour**      | Cooler (blue-pink)                | Warmer (amber-red)                 |
| **Air**         | Cleaner, less scattered particles | Hazier, accumulated dust/pollution |
| **Moisture**    | Dew forming, rising humidity      | Dew evaporated, falling humidity   |
| **Photography** | Crisp, high contrast              | Soft, warm, atmospheric            |

### 11J.2 Solution — 12 Directional Solar Phases

`computeSolarPhase(solarElevation, weather, localHour, observedAtUtc): SolarPhase`

Combines solar elevation bands with sunrise/sunset direction to produce 12 distinct phases:

| Phase           | Elevation    | Direction         | Description                     |
| --------------- | ------------ | ----------------- | ------------------------------- |
| `night`         | < −18°       | —                 | Full dark                       |
| `dawn-astro`    | −18° to −12° | Rising            | Astronomical twilight, pre-dawn |
| `dawn-nautical` | −12° to −6°  | Rising            | Nautical twilight, early dawn   |
| `dawn-civil`    | −6° to 0°    | Rising            | Civil twilight — "blue hour"    |
| `dawn-golden`   | 0° to 6°     | Rising            | "Golden hour" — sunrise warmth  |
| `morning`       | 6°+          | Before solar noon | Standard morning light          |
| `midday`        | > 35°        | —                 | Sun near peak                   |
| `afternoon`     | 6°+          | After solar noon  | Standard afternoon light        |
| `dusk-golden`   | 0° to 6°     | Setting           | "Golden hour" — sunset warmth   |
| `dusk-civil`    | −6° to 0°    | Setting           | Civil twilight — "blue hour"    |
| `dusk-nautical` | −12° to −6°  | Setting           | Late dusk                       |
| `dusk-astro`    | −18° to −12° | Setting           | Deep dusk                       |

### 11J.3 Direction Detection

Direction is determined by comparing current UTC time to **solar noon** (midpoint of sunrise/sunset):

```
solarNoonUtc = (sunriseUtc + sunsetUtc) / 2
sunRising = nowUtc < solarNoonUtc
```

When OWM sunrise/sunset unavailable, falls back to `localHour < 12`.

### 11J.4 Solar Phase Labels

`getSolarPhaseLabel(phase): string | null` — Human-readable labels for prompt enrichment. Returns null for phases that don't need special labelling (morning, midday, afternoon, night).

| Phase           | Label                 |
| --------------- | --------------------- |
| `dawn-astro`    | "pre-dawn"            |
| `dawn-nautical` | "early dawn"          |
| `dawn-civil`    | "dawn blue hour"      |
| `dawn-golden`   | "sunrise golden hour" |
| `dusk-golden`   | "sunset golden hour"  |
| `dusk-civil`    | "dusk blue hour"      |
| `dusk-nautical` | "late dusk"           |
| `dusk-astro`    | "deep dusk"           |

### 11J.5 Time Descriptor Enrichment

In `tier-generators.ts`, `enhanceTimeWithPhase()` prepends the solar phase label to the standard time descriptor when at dawn or dusk:

```
"Late afternoon" → "Sunset golden hour, late afternoon"
"Early morning"  → "Sunrise golden hour, early morning"
"Five in the morning" → "Dawn blue hour, five in the morning"
```

Standard phases (morning, midday, afternoon, night) return the original time descriptor unchanged.

### 11J.6 Integration

- Computed once per prompt in the orchestrator (line 148).
- Result stored on `VisualTruth.solarPhase` (v9.5.0 field).
- Result stored in `PromptTrace.solarPhase` for debugging.
- Consumed by all 5 tier generators via `enhanceTimeWithPhase()`.

---

## 11K. Flux-Native Variant & MJ V6/V7 (v9.6.0 — Chat 7)

**File:** `src/lib/weather/tier-generators.ts` (644 lines)

### 11K.1 Flux-Native Tier 1 Variant (T1F)

**Problem:** Flux uses a T5 text encoder, NOT CLIP. T5 doesn't understand `(token:1.3)` weight syntax — it's literal garbage text that corrupts the embedding. Flux users copying Tier 1 prompts get degraded results.

**Solution:** `generateTier1Flux()` produces a parallel prompt using the same atmospheric data as Tier 1 but formatted for T5 comprehension. Returned in `WeatherPromptResult.fluxPrompt` alongside the CLIP version.

**T5 strengths:** Long-form comprehension, adjective ordering, spatial relations. The Flux variant leans into these with natural adjective chains and "X with Y" constructions.

**Key differences from CLIP Tier 1:**

| Aspect          | CLIP Tier 1                           | Flux Tier 1 (T1F)                                             |
| --------------- | ------------------------------------- | ------------------------------------------------------------- |
| Weight syntax   | `(golden hour light:1.3)`             | `golden hour light` (plain text)                              |
| Negative prompt | Separate `--no` field                 | None (Flux has no native negative)                            |
| Camera metadata | `(shot on Canon EOS R5:1.1)`          | `professional photography, Canon EOS R5 with 35mm f/1.4 lens` |
| Flow style      | Comma-separated weighted tokens       | Comma-separated natural phrases                               |
| Output field    | `result.positive` + `result.negative` | `result.fluxPrompt`                                           |

**`stripClipWeight(token): string`** — Utility that removes CLIP weight parentheses: `"(golden hour light:1.3)"` → `"golden hour light"`. Applied to all phrase pool outputs that may contain weights.

**Orchestrator integration:** When `tier === 1`, the orchestrator calls both `generateTier1()` (CLIP) and `generateTier1Flux()` (T5). The Flux result is attached as `result.fluxPrompt`. UI can offer a "Copy for Flux" button alongside the standard Tier 1 output.

### 11K.2 Midjourney V6/V7 Natural Language (Tier 2)

**Problem:** MJ V6+ no longer benefits from `::` multi-prompt weight syntax. MJ V6.1 and V7 interpret natural language directly and MJ documentation warns that long prompts with complex syntax can confuse the model. The v8.0 `::` format was optimised for V5.2.

**Solution:** `generateTier2()` now checks `profile.mjVersion` and branches:

| mjVersion | Format              | Word Budget | Syntax                               |
| --------- | ------------------- | ----------- | ------------------------------------ |
| `'5.2'`   | Legacy multi-prompt | ~45 words   | `seg1::2 seg2::1 seg3::0.5 --params` |
| `'6.1'`   | Natural language    | ~60 words   | `S1. S2. S3. S4 --params`            |
| `'7'`     | Natural language    | ~75 words   | `S1. S2. S3. S4 --params` (default)  |

**V5.2 legacy format** (unchanged from v8.0):

```
{lighting+time}::2 {venue+sky+weather}::1 {surface}::0.5 --ar 16:9 --stylize 100 --v 5.2 --no text watermark
```

**V6.1/V7 natural language format** (new in v9.6.0):

```
S1: {Time}, {City} at {Venue}, {sky}, {moon}, {wind}.
S2: {Lighting sentence}.
S3: {Surface detail} (optional, word-budget aware).
S4: {Camera tag}.
--ar 16:9 --stylize 100 --v 7 --no text watermark logo blur
```

Period separators function as scene breaks in MJ V6/V7. Word budget trimming drops S3 (surface) first, then S4 (camera) if still over limit.

### 11K.3 PromptProfile — mjVersion Field

```typescript
interface PromptProfile {
  verbosity: 'short' | 'standard' | 'rich';
  style: 'photoreal' | 'cinematic' | 'documentary';
  excludePeople: 'always' | 'quiet-hours' | 'never';
  mjAspect: '1:1' | '16:9' | '2:3';
  mjStylize: number;
  mjVersion: '5.2' | '6.1' | '7'; // v9.6.0 — NEW
  strictPhysics: boolean;
}

const DEFAULT_PROMPT_PROFILE: PromptProfile = {
  verbosity: 'standard',
  style: 'photoreal',
  excludePeople: 'quiet-hours',
  mjAspect: '16:9',
  mjStylize: 100,
  mjVersion: '7', // v9.6.0 — default to V7 natural language
  strictPhysics: false,
};
```

**Default:** `mjVersion: '7'` — new conversations get V7 natural language format. Existing V5.2 users can set `mjVersion: '5.2'` to retain the `::` weight syntax.

### 11K.4 WeatherPromptResult — fluxPrompt Field

```typescript
interface WeatherPromptResult {
  text: string;
  positive?: string;
  negative?: string;
  fluxPrompt?: string; // v9.6.0 — NEW (Tier 1 only)
  tier: PromptTier;
  trace?: PromptTrace;
}
```

`fluxPrompt` is only populated when `tier === 1`. For all other tiers it is `undefined`.

---

## 12. Vocabulary Index

**File:** `src/data/vocabulary/index.ts` (516 lines)

Central entry point for all Promagen weather vocabulary. Provides type-safe accessor functions for temperature, humidity, wind, time-of-day, conditions, and city-vibes data. Also provides seeded random selection with optional best-fit weighting for synergy-aware phrase picks.

### 12.1 Type Definitions

The vocabulary index defines TypeScript interfaces matching the JSON data shapes:

```typescript
interface CityVenue {
  name: string;
}

interface CityVibes {
  country: string;
  venues: CityVenue[];
}

interface ConditionType {
  emoji: string;
  label: string;
  phrases: string[];
}

interface TemperatureRange {
  min: number;
  max: number;
  label: string;
  phrases: string[];
}

interface HumidityRange {
  min: number;
  max: number;
  label: string;
  phrases: string[];
}

interface WindDescriptor {
  min: number;
  max: number;
  label: string;
  descriptor: string;
}
```

**v6.0 changes:** `CityVenue.activities` field removed. `WindRange.phrases` replaced by `WindDescriptor.descriptor` (single string, no array).

### 12.2 JSON Property Access

The vocabulary JSON files have evolved over time — some no longer contain properties like `contextual` or `periods` that the index originally referenced. All JSON property accesses use safe casts through `Record<string, unknown>` with optional chaining to prevent type errors when properties are absent. Functions that access missing properties return empty strings or null gracefully via existing null guards.

---

## 13. Exchange Catalog

**File:** `src/data/exchanges/exchanges.catalog.json`

All **89 exchanges** with full metadata:

```json
{
  "id": "b3-sao-paulo",
  "city": "São Paulo",
  "exchange": "B3 — Brasil Bolsa Balcão",
  "country": "Brazil",
  "iso2": "BR",
  "tz": "America/Sao_Paulo",
  "latitude": -23.5505,
  "longitude": -46.6333,
  "hoursTemplate": "americas-brazil",
  "hemisphere": "SW",
  "ribbonLabel": "B3 São Paulo",
  "hoverColor": "#...",
  "marketstack": {
    "defaultBenchmark": "ibovespa",
    "defaultIndexName": "IBOVESPA",
    "availableIndices": [...]
  }
}
```

Every exchange has `latitude` and `longitude` (100% coverage), enabling astronomical sunrise/sunset calculation and solar elevation computation for the lighting engine across all 89 entries.

---

## 14. File Manifest

### Gateway (Fly.io)

| File                          | Lines | Purpose                                                                                  |
| ----------------------------- | ----- | ---------------------------------------------------------------------------------------- |
| `server.ts`                   | 721   | Main gateway server                                                                      |
| `openweathermap/adapter.ts`   | 393   | OWM API client + response parsing (includes cloudCover, visibility, pressure, weatherId) |
| `openweathermap/types.ts`     | 386   | Gateway types (`WeatherData`, `BatchId`, `WeatherResponseMeta`)                          |
| `openweathermap/scheduler.ts` | 403   | 4-batch clock-aligned rotation                                                           |
| `openweathermap/budget.ts`    | 379   | Rate limiting + daily budget tracking                                                    |
| `openweathermap/weather.ts`   | 794   | Main handler, batch city management, MERGE accumulator                                   |
| `openweathermap/index.ts`     | 107   | Module exports                                                                           |

### Frontend — Weather Library (18 modules, 7,118 lines total)

| File                                          | Lines | Purpose                                                                                                                                                                            |
| --------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/weather/weather-prompt-generator.ts` | 320   | Orchestrator — dispatches to subsystems, assembles WeatherPromptResult, attaches PromptTrace                                                                                       |
| `src/lib/weather/visual-truth.ts`             | 1,253 | Visual Truth layer — dew point physics, air clarity, contrast, moisture visibility, thermal optics, compound precipitation, climate integration                                    |
| `src/lib/weather/lighting-engine.ts`          | 917   | Procedural lighting — 87 daytime phrase pools (8 solar bands × 4 cloud strata), Kelvin colour temp, night competition model, venue attenuation, coherence validation               |
| `src/lib/weather/tier-generators.ts`          | 644   | 5 tier generators: T1 CLIP, T1F Flux (v9.6), T2 MJ V6/V7 + V5.2 legacy (v9.6), T3 NL, T4 Plain. Cloud type enrichment, solar phase enrichment                                      |
| `src/lib/weather/sun-calculator.ts`           | 562   | NOAA sunrise/sunset + solar elevation + lunar position (Meeus ephemeris)                                                                                                           |
| `src/lib/weather/prompt-types.ts`             | 548   | All interfaces — PromptProfile (7 fields), PromptTrace (19 top-level fields), VisualTruth (10 fields), LightingState, WeatherPromptResult, WeatherPromptInput, TierInfo, TIER_INFO |
| `src/lib/weather/vocabulary-loaders.ts`       | 519   | JSON vocabulary loading, range lookups (temperature, humidity), phrase selection, buildContext(), descriptionToEmoji()                                                             |
| `src/lib/weather/wind-system.ts`              | 476   | Beaufort-calibrated wind — 8 force tiers, venue-aware phrases (7 forces × 9 settings), cardinal direction, gust factor, snow+wind interaction                                      |
| `src/lib/weather/weather-types.ts`            | 336   | ExchangeWeatherFull (19 fields), ExchangeWeatherDisplay (19 fields), type conversions, temperature colour                                                                          |
| `src/lib/weather/camera-lens.ts`              | 283   | Camera body + lens per style × setting, platform-aware quality tags (T1–T4), negative prompts (CLIP anti-tokens, MJ --no, NL avoidance)                                            |
| `src/lib/weather/fetch-weather.ts`            | 275   | Server-side gateway fetch + 5-min cache + demo gap-fill + GatewayWeatherItem (22 fields)                                                                                           |
| `src/lib/weather/cloud-types.ts`              | 223   | OWM weather.id → 10 visual cloud types (cumulus, stratus, cirrus, cumulonimbus, etc.), 40 visual phrases, 3-path classification                                                    |
| `src/lib/weather/time-utils.ts`               | 203   | 12 directional solar phases (dawn-astro → dusk-astro), computeSolarPhase(), getSolarPhaseLabel(), time descriptors                                                                 |
| `src/lib/weather/climate.ts`                  | 195   | 7 latitude-based climate zones (tropical → subarctic), effective humidity/dew-spread normalization, zone-specific thresholds                                                       |
| `src/lib/weather/moon-phase.ts`               | 147   | Synodic cycle → 8 phases, 40 prompt phrases (5 per phase), emoji selection                                                                                                         |
| `src/lib/weather/weather.ts`                  | 113   | Shared weather utilities                                                                                                                                                           |
| `src/lib/weather/prng.ts`                     | 87    | Knuth-hash PRNG, capitalize(), hashString() — deterministic seeded selection across all modules                                                                                    |
| `src/lib/weather/exchange-weather.ts`         | 17    | Barrel re-exports                                                                                                                                                                  |

### Frontend — Vocabulary JSON (7 files)

| File                                           | Lines | Purpose                                                                            |
| ---------------------------------------------- | ----- | ---------------------------------------------------------------------------------- |
| `src/data/vocabulary/weather/city-vibes.json`  | 3,940 | 83 cities, 842 venues, 9 settings, 25 enriched (75 lightCharacter phrases)         |
| `src/data/vocabulary/weather/urban-light.json` | 677   | 83 cities, per-city urban light emission factor (0.0–1.0, NASA/NOAA VIIRS-derived) |
| `src/data/vocabulary/weather/wind.json`        | 471   | 30 ranges (0–150 km/h in 5 km/h bins), 240 phrases (8 per bin)                     |
| `src/data/vocabulary/weather/conditions.json`  | 398   | 14 weather types, 280 phrases (20 per type)                                        |
| `src/data/vocabulary/weather/humidity.json`    | 157   | 20 ranges (0–100% in 5% bins), 60 phrases (3 per bin)                              |
| `src/data/vocabulary/weather/temperature.json` | 133   | 18 ranges (−40°C to +50°C in 5°C bins), 54 phrases (3 per bin)                     |
| `src/data/vocabulary/weather/time-of-day.json` | 41    | 24 hours, 67 phrases (1–5 per hour)                                                |

**Deleted:** `wind-template-descriptors.json` (removed v9.0.0 — 0 imports, replaced by `wind-system.ts` + `wind.json`).

### Frontend — Components

| File                                                          | Lines | Purpose                                                                                            |
| ------------------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------- |
| `src/components/exchanges/exchange-card.tsx`                  | 671   | Main card component (snap-fit, day/night detection, WeatherSection, ExtendedWeatherData interface) |
| `src/components/exchanges/weather/weather-prompt-tooltip.tsx` | 525   | Prompt tooltip (4-tier AI prompts + copy button)                                                   |
| `src/components/exchanges/weather/weather-emoji-tooltip.tsx`  | 508   | Emoji tooltip (conditions + moon position + sun event)                                             |
| `src/components/exchanges/types.ts`                           | 187   | Card types (`ExchangeCardData`, `ExchangeWeatherData` — 20 fields including weatherId)             |
| `src/components/exchanges/adapters.ts`                        | 123   | Data adapters (`toCardData`)                                                                       |
| `src/components/exchanges/weather/exchange-condition.tsx`     | 84    | Condition display sub-component                                                                    |
| `src/components/exchanges/weather/exchange-temp.tsx`          | 35    | Temperature display sub-component                                                                  |
| `src/components/home/mission-control.tsx`                     | 668   | Home page orchestrator (ExchangeWeatherData → ExchangeWeatherDisplay conversion)                   |
| `src/components/ribbon/commodity-prompt-tooltip.tsx`          | 771   | Commodity prompt tooltip (shares tier system)                                                      |
| `src/hooks/use-weather-prompt-tier.ts`                        | 134   | Tier selection hook (Free→Tier 3, Pro→localStorage)                                                |

### Frontend — Data

| File                                        | Lines | Purpose                                                    |
| ------------------------------------------- | ----- | ---------------------------------------------------------- |
| `src/data/exchanges/exchanges.catalog.json` | —     | 89 exchanges with lat/lon, tz, market hours                |
| `src/data/weather/exchange-weather.demo.ts` | 907   | Algorithmic demo weather (seasonal + diurnal + conditions) |

---

## 15. Summary of Key Numbers

| Metric                                  | Value                                                                                                                                                                                                       |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Infrastructure**                      |                                                                                                                                                                                                             |
| Total exchanges                         | 89                                                                                                                                                                                                          |
| Exchanges with coordinates              | 89 (100%)                                                                                                                                                                                                   |
| Unique API coordinates (after dedup)    | 83                                                                                                                                                                                                          |
| Batches                                 | 4 (A/B/C/D)                                                                                                                                                                                                 |
| Refresh cycle per exchange              | Every 4 hours                                                                                                                                                                                               |
| Daily API calls                         | ~498 (within 1,000 free tier)                                                                                                                                                                               |
| **Architecture**                        |                                                                                                                                                                                                             |
| Weather library modules                 | 18 (decomposed from 1 monolith in v9.0)                                                                                                                                                                     |
| Weather library total lines             | 7,118 (was 4,311 single file in v8.0)                                                                                                                                                                       |
| Vocabulary JSON files                   | 7 (was 8 — `wind-template-descriptors.json` deleted v9.0)                                                                                                                                                   |
| Total frontend weather code             | ~7,118 lines (library) + ~2,678 lines (components)                                                                                                                                                          |
| Total gateway weather code              | ~3,200 lines                                                                                                                                                                                                |
| **OWM Pipeline**                        |                                                                                                                                                                                                             |
| OWM pipeline fields                     | 5 (rainMm1h, snowMm1h, windDegrees, windGustKmh — v8.0; weatherId — v9.5)                                                                                                                                   |
| GatewayWeatherItem fields               | 22                                                                                                                                                                                                          |
| ExchangeWeatherData fields              | 20                                                                                                                                                                                                          |
| ExchangeWeatherFull fields              | 19                                                                                                                                                                                                          |
| ExchangeWeatherDisplay fields           | 19                                                                                                                                                                                                          |
| **Prompt Tiers**                        |                                                                                                                                                                                                             |
| Prompt tiers                            | 4 + 1 Flux variant (default: Tier 3 Natural Language)                                                                                                                                                       |
| Tier generators                         | 5 (T1 CLIP, T1F Flux, T2 MJ, T3 NL, T4 Plain)                                                                                                                                                               |
| MJ versions supported                   | 3 (V5.2 legacy `::` weights, V6.1, V7 natural language)                                                                                                                                                     |
| **Moon & Solar**                        |                                                                                                                                                                                                             |
| Moon phases                             | 8                                                                                                                                                                                                           |
| Moon prompt phrases                     | 40 (5 per phase)                                                                                                                                                                                            |
| Moon position descriptors               | 40 (5 altitude bins × 8 azimuth sectors)                                                                                                                                                                    |
| Solar phases (v9.5)                     | 12 (night, dawn-astro/nautical/civil/golden, morning, midday, afternoon, dusk-golden/civil/nautical/astro)                                                                                                  |
| **Lighting**                            |                                                                                                                                                                                                             |
| Daytime phrase pools (v9.1)             | 87 (8 solar bands × 4 cloud strata + overrides)                                                                                                                                                             |
| Kelvin colour temperature range (v9.1)  | 2,500K–12,000K                                                                                                                                                                                              |
| Urban light cities                      | 83 (0.20–0.98 range, 4 tiers)                                                                                                                                                                               |
| Setting night light phrases             | 20 (5 each for beach, park, elevated, monument)                                                                                                                                                             |
| Lighting phrases (total, procedural)    | ~200 (daytime enrichment + night competition + setting pools + venue enrichment)                                                                                                                            |
| Cloud-only descriptions                 | 11 (suppressed when lighting encodes cloud state)                                                                                                                                                           |
| Banned commercial terms (v7.6)          | ~12 per non-urban setting (beach, park, elevated, monument)                                                                                                                                                 |
| API fields used for lighting            | 6 (solar elevation, cloud %, visibility, humidity, pressure, moon phase)                                                                                                                                    |
| Night lighting inputs                   | 11 (solar elevation, cloud %, visibility, pressure, moon phase, lunar position, urban light factor, city name, venue setting, venue lightCharacter, visual truth)                                           |
| **City & Venue**                        |                                                                                                                                                                                                             |
| Cities with venue scenes                | 83                                                                                                                                                                                                          |
| Total venues                            | 842                                                                                                                                                                                                         |
| Venue settings                          | 9 types (waterfront, beach, street, narrow, market, plaza, park, elevated, monument)                                                                                                                        |
| Enriched venues (lightCharacter)        | 25 venues across 19 cities, 75 phrases                                                                                                                                                                      |
| Justified venue overrides (v8.0)        | 15 venues with `overrideJustification` (8 trigger active lint rules)                                                                                                                                        |
| Total activities                        | **0** (removed in v6.0)                                                                                                                                                                                     |
| **Wind**                                |                                                                                                                                                                                                             |
| Wind force tiers                        | 8 (calm, breeze, fresh, strong, nearGale, gale, strongGale, storm) — Beaufort-aligned                                                                                                                       |
| Wind JSON phrases                       | 240 (8 per 5 km/h bin, 30 bins)                                                                                                                                                                             |
| Venue-aware wind phrase pools           | 63 (7 active forces × 9 settings)                                                                                                                                                                           |
| **Precipitation**                       |                                                                                                                                                                                                             |
| Precipitation types (v8.0)              | 12 (none, rain, drizzle, snow, sleet, hail, thunderstorm, mist, fog, haze, smoke, dust)                                                                                                                     |
| Compound precipitation detection (v9.3) | 3-source (OWM keywords, visibility thresholds, dew-point proximity)                                                                                                                                         |
| **Climate (v9.4)**                      |                                                                                                                                                                                                             |
| Climate zones                           | 7 (tropical, subtropical, warm-temperate, cool-temperate, cold, subarctic, polar)                                                                                                                           |
| **Cloud Types (v9.5)**                  |                                                                                                                                                                                                             |
| Cloud types                             | 10 (clear, cirrus, cirrostratus, altocumulus, altostratus, cumulus, stratocumulus, stratus, nimbostratus, cumulonimbus)                                                                                     |
| Cloud visual phrases                    | 40 (4 per type)                                                                                                                                                                                             |
| Cloud classification paths              | 3 (weatherId → description → cloudCover fallback)                                                                                                                                                           |
| **Visual Truth**                        |                                                                                                                                                                                                             |
| VisualTruth fields                      | 10 (dewPoint, dewSpread, airClarity, contrast, moistureVisibility, thermalOptics, precip, climateZone, cloudType, solarPhase)                                                                               |
| Air clarity states                      | 6 (crystal, clear, light-haze, moderate-haze, heavy-haze, opaque)                                                                                                                                           |
| Contrast states                         | 4 (crisp, normal, flat, washed)                                                                                                                                                                             |
| Moisture visibility states              | 6 (bone-dry, invisible, subtle, noticeable, visible, dominant)                                                                                                                                              |
| Thermal optics states                   | 7 (shimmer, warm-shimmer, heavy-tropical, neutral, cold-sharp, frost, deep-cold)                                                                                                                            |
| **Camera & Lens (v9.2)**                |                                                                                                                                                                                                             |
| Camera bodies                           | Per-style (photoreal, cinematic, documentary) × per-setting                                                                                                                                                 |
| Lens selections                         | Per-style × per-setting (focal length + aperture)                                                                                                                                                           |
| Quality tag variants                    | 4 (T1: camera+lens+technical, T2: camera body, T3: woven ending, T4: lens descriptor)                                                                                                                       |
| Negative prompt variants                | 3 (T1: CLIP anti-tokens, T2: MJ --no, T3: NL avoidance framing)                                                                                                                                             |
| **Vocabulary**                          |                                                                                                                                                                                                             |
| Temperature phrases                     | 54 (3 per 5°C bin)                                                                                                                                                                                          |
| Humidity phrases                        | 60 (3 per 5% bin)                                                                                                                                                                                           |
| Time-of-day phrases                     | 67 (1–5 per hour)                                                                                                                                                                                           |
| Time periods (getTimePeriod)            | 13 (deep night → late night)                                                                                                                                                                                |
| Condition phrases                       | 280 (20 per type)                                                                                                                                                                                           |
| Total JSON vocabulary                   | ~701 phrases (54 temp + 60 humidity + 67 time + 280 conditions + 240 wind)                                                                                                                                  |
| Total prompt vocabulary (all sources)   | ~1,000+ items (JSON + 40 moon + ~200 lighting + 40 cloud + venue-aware wind pools)                                                                                                                          |
| **Profile & Trace**                     |                                                                                                                                                                                                             |
| PromptProfile fields (v9.6)             | 7 (verbosity, style, excludePeople, mjAspect, mjStylize, mjVersion, strictPhysics)                                                                                                                          |
| PromptTrace top-level fields            | 19 (profile, precip, windForce, windSpeedKmh, venue, visualTruth, lighting, solarElevation, camera, climate, cloudType, solarPhase, moon, isNight, seed, excludedPeople, localHour, temperatureC, humidity) |
| WeatherPromptResult fields (v9.6)       | 7 (text, positive, negative, fluxPrompt, tier, trace — positive/negative/fluxPrompt/trace optional)                                                                                                         |

---

## 16. Version History

| Version | Date        | Changes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 9.6.0   | 20 Feb 2026 | **FLUX-NATIVE TIER 1 VARIANT** — `generateTier1Flux()` produces T5 text-encoder prompts without CLIP attention weights. `stripClipWeight()` utility removes `(token:N.N)` syntax. New `fluxPrompt` field on `WeatherPromptResult` (generated alongside standard T1 output). **MJ V6/V7 NATURAL LANGUAGE** — Tier 2 generator branches on `PromptProfile.mjVersion`: V5.2 retains legacy `::` multi-prompt syntax; V6.1/V7 use natural language sentences (no `::` weights, no `--no` flags → inline avoidance phrasing). `mjVersion` field added to `PromptProfile` (values: `'5.2'                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | '6.1'                                                                                                                                                                                         | '7'`, default `'7'`). §11.9 night integration updated with 6 tier format variants. **FILE:** `tier-generators.ts` 576→644 lines (+68). |
| 9.5.0   | 20 Feb 2026 | **CLOUD TYPE CLASSIFIER** — `classifyCloudType()` in `cloud-types.ts` (223 lines). 3-path classification: OWM `weatherId` (800–804 range) → OWM description keywords → cloud cover percentage fallback. 10 visual cloud types (cirrus, cirrostratus, cirrocumulus, altostratus, altocumulus, stratocumulus, stratus, nimbostratus, cumulus, cumulonimbus). 40 visual phrases (4 per type). `REPLACEABLE_SKY` set of 11 generic OWM strings replaced with type-specific descriptions. **SOLAR PHASE** — `computeSolarPhase()` in `time-utils.ts` (+120 lines). 12 directional phases (4 dawn, 3 day, 4 dusk, 1 night) with sunrise/sunset direction detection via solar noon comparison. **OWM weatherId PIPELINE** — `weatherId: number                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | null`added to 5 type interfaces (gateway → adapter → frontend → component → weather types). **VisualTruth** gains`cloudType`and`solarPhase` fields (set by orchestrator post-classification). |
| 9.4.0   | 20 Feb 2026 | **CLIMATE-AWARE HUMIDITY** — `computeClimateContext()` in `climate.ts` (195 lines). 7 latitude-based climate zones (tropical, arid, subtropical, warm-temperate, cool-temperate, subarctic, polar). Each zone has baseline humidity + dew-spread offset calibrated from climatological norms. `effectiveHumidity` and `effectiveDewSpread` normalise raw readings so Singapore 85% ≠ London 85%. Precipitation-driven paths and thermal optics bypass normalisation (physics of rain/frost is universal). `deriveVisualTruth()` receives `latitude` parameter. **VisualTruth** gains `climateZone` field.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 9.3.0   | 20 Feb 2026 | **COMPOUND PRECIPITATION** — `classifyPrecip()` extended with 3-source secondary atmospheric layer detection. Priority: (1) explicit OWM keywords ("rain and fog"), (2) OWM visibility during active precip (vis < 1000m → fog layer), (3) dew-point proximity during precip (spread < 1°C + calm wind → fog forming). `PrecipState` gains `secondaryType`, `visibilityMetres`, `compound` fields. Air clarity overrides in `deriveVisualTruth()`: rain+fog → `'foggy'` regardless of intensity.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 9.2.0   | 20 Feb 2026 | **CAMERA & LENS METADATA** — `camera-lens.ts` (283 lines). 3 style pools (photoreal, cinematic, documentary) × 6 lens classes. Venue-driven focal length selection. Platform-aware quality tags: T1 CLIP tokens, T2 MJ `--quality`/`--style`, T3 inline technical, T4 simplified. Negative prompt system: T1 CLIP anti-tokens `(blur:0.3)`, T2 MJ `--no` flags, T3/T4 NL avoidance framing. Wired into all tier generators. **FILE:** `tier-generators.ts` 508→576 lines (+68).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 9.1.0   | 20 Feb 2026 | **DAYTIME LIGHTING ENRICHMENT** — `lighting-engine.ts` gains pool-based phrase selection for daytime/twilight. 8 solar elevation bands × 4 cloud strata (`DaylightPool` interface) = 87 phrase pools replacing 5 static phrases + 1 cloud override. `getDaylightBase()` replaces static if/else chain. **COLOUR TEMPERATURE** — `computeColourTempK()` computes Kelvin from solar elevation + quadratic cloud blend (2,500K golden hour → 12,000K deep twilight, overcast flattens to 6,500K). `LightingState` gains `colourTempK` field. **FILE:** `lighting-engine.ts` 680→917 lines (+237).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 9.0.0   | 20 Feb 2026 | **MONOLITH DECOMPOSITION** — 4,311-line `weather-prompt-generator.ts` split into 18 focused modules (7,118 lines total). Orchestrator reduced to ~320 lines dispatching to 17 subsystems. Zero circular dependencies. **NEW MODULES:** `prng.ts` (Knuth multiplicative hash PRNG replacing `Math.sin`), `prompt-types.ts` (shared types/interfaces/constants), `visual-truth.ts` (atmospheric assessment + phrase pools), `lighting-engine.ts` (solar/urban/moon lighting), `wind-system.ts` (Beaufort wind + venue pools), `vocabulary-loaders.ts` (JSON data + range lookups + city/venue + context builder), `tier-generators.ts` (4 tier format generators), `time-utils.ts` (night/day + quiet hours), `moon-phase.ts` (synodic calculator). **PRNG:** `Math.sin(seed * 9999)` replaced with Knuth multiplicative hash throughout all modules. City-name hashing added to seed computation. **DELETED:** `wind-template-descriptors.json` (0 imports remaining — replaced by `wind-system.ts` + `wind.json`). **PUBLIC API:** Identical to v8.0.0 — no consumer changes required.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 8.0.0   | 19 Feb 2026 | **PRECIPITATION TRUTH (Chat 1):** `classifyPrecip()` replaces `isRainy`/`isStormy` booleans with `PrecipState { type, intensity, active, reducesVisibility }`. 12 precipitation types (rain, drizzle, snow, sleet, hail, thunderstorm, mist, fog, haze, smoke, dust). Prefers numeric `rain.1h`/`snow.1h` from OWM. `deriveVisualTruth()` receives PrecipState — snow-specific air clarity, surface moisture, hail effects, fog/mist/smoke/dust atmospheric classification. **GATEWAY PIPELINE:** 4 new `WeatherData` fields: `rainMm1h`, `snowMm1h`, `windDegrees`, `windGustKmh`. Full pipeline through adapter → frontend fetch → component types → weather types. **BEAUFORT WIND (Chat 2):** `classifyWind()` returns `WindForce` (8 Beaufort-aligned tiers replacing 4 arbitrary `WindTier`). Key: 50 km/h = `nearGale` (NOT destructive). Destructive at `gale` (62+). Human-body phrases purged. Wind direction via `getCardinalDirection()`. Gust factor when > 1.5× sustained. Snow+wind interaction phrases. **VENUE TAXONOMY (Chat 3):** 7 venues reclassified in `city-vibes.json`. 15 `overrideJustification` entries. `SETTING_OVERRIDES` runtime safety net. Standalone linter `scripts/lint-venues.ts` (CI-ready). **TIER 3 SETTING ENDING (Chat 4):** `getSettingEnding()` replaces hardcoded "urban landscape" — venue-aware directives (coastal/landmark/landscape/skyline). **TIER 4 (Chat 4):** Fragment limit `VERBOSITY_T4_LIMIT`, `getTimePeriod()` period nouns. **TIER 1 (Chat 5):** `WeatherPromptResult` structured return with `positive`/`negative`/`tier`. `STYLE_QUALITY_TAGS` (photoreal/cinematic/documentary). Token guard `VERBOSITY_T1_LIMIT`. **TIER 2 (Chat 6):** MJ `::` multi-prompt syntax (seg1::2, seg2::1, seg3::0.5) replaces dash-break. **PROMPT PROFILE (Chat 7):** `PromptProfile` interface (verbosity/style/excludePeople/mjAspect/mjStylize/strictPhysics). `DEFAULT_PROMPT_PROFILE` = zero regression. `shouldExcludePeople()` replaces raw `isQuietHours()`. **PROMPT TRACE (Chat 8):** `PromptTrace` diagnostic interface (16 fields). Activated by `debug: true` or `NODE_ENV=development`. Zero cost in production. **LINT FIX:** Removed unused `PHOTOREAL_QUALITY_TAGS` alias. **LINE COUNT:** 3,386→4,311 (+925 lines). |
| 7.8.0   | 19 Feb 2026 | **PRECIPITATION-AWARE SKY SOURCE** — New `getSkySourceAware()` function replaces the old `!encodesCloudState ? getSkySource() : null` gate in all 4 tier generators (lines 2880, 2953, 3042, 3145). Separates cloud-only descriptions (11 entries in `CLOUD_ONLY_DESCRIPTIONS` — suppressed when lighting encodes cloud state) from precipitation/visibility phenomena (snow, rain, drizzle, sleet, hail, mist, fog, thunderstorm, freezing — always pass through). **CRITICAL FIX:** Before v7.8, `encodesCloudState` was always true at night, causing ALL weather descriptions to be suppressed — including snow, rain, and fog. Toronto at night with snow now correctly includes snow in the prompt. **LINT FIX:** Unused `pres` variable in `deriveVisualTruth()` renamed to `_pres` (line 388). **TYPE FIX:** `urbanLightData` cast uses `as unknown as` two-step cast with optional `meta.defaultFallback?` and `meta.defaultLightCharacter?` fields (lines 1744–1754). **LINE COUNT:** 3,294→3,386 (+92 lines).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 7.7.0   | 19 Feb 2026 | **ICONIC VENUE ENRICHMENT** — 25 venues across 19 cities carry optional `lightCharacter[]` arrays with 3 venue-specific night light phrases each (75 new phrases total). When present, venue lightCharacter takes HIGHEST priority in the 3-tier night light system (above setting pool and city lightCharacter). Examples: Eiffel Tower → `"golden iron lattice glowing against dark sky"`, Coney Island → `"fading fairground rides and boardwalk arcade glow"`, Victoria Peak → `"dense harbour light carpet far below the summit"`. **INTERFACES:** `CityVenueData` and `VenueResult` extended with optional `lightCharacter` field. `getCityVenue()` passes through lightCharacter from JSON data. `computeLighting()` accepts new `venueLightCharacter` param. `validateLightingCoherence()` prefers venue lightCharacter for replacement phrases.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 7.6.0   | 19 Feb 2026 | **COHERENCE VALIDATOR** — New `validateLightingCoherence()` function runs after `computeLighting()` as a post-processing safety net. Scans `lighting.base` for per-setting banned commercial terms (~12 terms each for beach, park, elevated, monument). If a violation is found (e.g. "neon" appearing in a beach venue's lighting), swaps base to venue lightCharacter or setting pool and rebuilds `fullPhrase` from patched components. **SETTING_BANNED_TERMS:** Maps 4 non-urban settings to arrays of forbidden commercial terms. Urban settings (street, narrow, market, plaza, waterfront) have no bans. Catches edge cases: "balanced" competition concatenating city character with moonlight, future data changes, fallback venue settings. Only fires at night (daytime solar-driven lighting is always correct).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 7.5.0   | 19 Feb 2026 | **VENUE-AWARE LIGHTING** — `computeLighting()` receives venue setting type. Night base phrase now uses setting-specific pools for beach/park/elevated/monument. **SETTING_URBAN_ATTENUATION:** Per-setting multiplier on raw urbanFactor before competition. Street/narrow: 1.0, market: 0.95, plaza/waterfront: 0.85, monument: 0.7, park: 0.4, beach: 0.3, elevated: 0.2. Shifts competition toward moonlight at non-commercial venues (Victoria Peak at night is moonlit, not neon-lit). **SETTING_NIGHT_LIGHT:** 5 phrases each for 4 non-urban settings (20 total). Physical emitters only: boardwalk lamps, path lighting, floodlights, observation lamps. **HOISTED VENUE:** Venue selected ONCE in `generateWeatherPrompt()` before `computeLighting()`. Same seed, no duplication. Passed to both lighting engine and all tier generators. **LINE COUNT:** 2,800→3,294 (+494 lines).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 7.0.0   | 19 Feb 2026 | **VISUAL TRUTH LAYER** — New `deriveVisualTruth()` function cross-references ALL weather data (temp, humidity, wind, cloud, visibility, pressure, dew point) to derive unified atmospheric state. Computed ONCE per prompt. 4 derived properties: `airClarity` (6 states), `contrast` (4 states), `moistureVisibility` (6 states), `thermalOptics` (7 states). **DEW POINT PHYSICS:** Magnus formula computes dew point spread. Drives air clarity, moisture, fog/mist. Overrides OWM visibility cap (10000m) when dew spread < 1°C. **HUMIDITY→MOISTURE:** Weather-report humidity descriptions replaced with surface optical effects (damp surfaces, frost). Omitted when moisture invisible (~50% of cases). **TEMPERATURE→THERMAL:** Thermometer readings replaced with light/physics effects (heat shimmer, frost crystals). Omitted when visually neutral (10–30°C). **SHADOW MODIFIER:** Now cross-references cloud + humidity + dew point, not just cloud alone. **ATMOSPHERE MODIFIER:** Now driven by air clarity from Visual Truth. **PHYSICS CONFLICT ELIMINATION:** Impossible combinations like "sharp shadows" + "fully saturated air" can no longer occur. **LINE COUNT:** 1,415→2,800 (+1,385 lines).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 6.1.0   | 18 Feb 2026 | **NIGHT LIGHTING V2 — URBAN VS MOON COMPETITION MODEL** — Night branch completely rewritten. Two competing light sources (urban glow from `urban-light.json` × cloud amplification vs moonlight from phase brightness × altitude attenuation × cloud blocking) with dominance threshold → 12 base phrases replacing 6. **LUNAR POSITION CALCULATOR** — Meeus ephemeris in `sun-calculator.ts` (lines 332–562). Altitude (5 bins) + azimuth (8 sectors) → 40 position descriptors. ~1° accuracy. **MOON POSITION IN EMOJI TOOLTIP** — Always-on (day + night, above + below horizon). Day/night-specific word order in `buildMoonPositionPhrase()`. Copy button added. **MOON POSITION IN PROMPTS** — Gated on altitude > 0° AND cloud ≤ 75% AND visibility ≥ 3000m. Rendered per-tier syntax. **MOON VISIBILITY GATE** — `moonVisible` flag suppresses entire moon layer when below horizon. **URBAN-LIGHT.JSON** — 83 cities with NASA/NOAA VIIRS-derived light emission factors (0.20–0.98). **ATMOSPHERE MODIFIER SIMPLIFIED** — Humidity removed from atmosphere modifier (§11A.5) to prevent duplication with Humidity layer. Now visibility-only (6 bins). **LIGHTING STATE EXTENDED** — `LightingState` gains `moonPositionPhrase`, `nightDominant`, `moonVisible` fields. **LINE COUNT CHANGES** — `sun-calculator.ts` 220→562, `weather-prompt-generator.ts` 1415 lines at v6.1, `weather-emoji-tooltip.tsx` 319→508, `exchange-card.tsx` 639→655, `mission-control.tsx` 566→662.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 6.0.0   | 17 Feb 2026 | **LIGHTING ENGINE** — Deterministic procedural lighting from solar elevation + cloud % + visibility + humidity + pressure. 28 phrases, 4 segments (base + shadow + atmosphere + stability), zero randomness. **ACTIVITIES REMOVED** — Venue-only city scene model. 842 venues across 83 cities, no activities. **WIND TEMPLATE SYSTEM** — Phrase pools replaced with descriptor-per-bin + exact API speed injection. "fresh breeze at 37 km/h" replaces "firm-breeze sustained wind intensity". **QUIET HOURS REVISED** — Window changed from midnight→sunrise to 23:59→sunrise+1hr. **TIER ORDERINGS REBUILT** — Lighting element added to all 4 tiers. Tier 4: lighting before time. Tier 2: lighting+time lead with dash break. Tier 1: lighting as comma-separated weighted tokens. Tier 3: causal lighting sentence. **SKY/LIGHTING DUPLICATION RULE** — Sky conditionally omitted when lighting already encodes cloud state. **VOCABULARY COUNTS UPDATED** — Temperature 180→54, humidity 160→60, time-of-day 120→67, wind 240→30 descriptors. Total vocabulary 8,170→1,401. **NEW API FIELDS** — cloudCover, visibility, pressure piped through gateway→frontend→prompt generator.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 5.2.0   | 14 Feb 2026 | "No people" directive and activity suppression now linked by `quiet` boolean across all 4 tiers. Tier 4 gains people exclusion during quiet hours. Tier 1/2/3 people exclusion now conditional (was hardcoded unconditionally). Type fixes in `vocabulary/index.ts` — CityVibes interface updated to match venue/activity JSON shape, all `.contextual` accesses made safe via optional chaining, `ConditionEntry` gains optional `label` field.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 5.0.0   | 13 Feb 2026 | Default tier 4→3. Tier element ordering rebuilt (time-first for T2/T3, time-last for T1, time-after-subject for T4). Humidity restored to all 4 tiers. Redundant word suffixes removed from templates. city-vibes expanded to 83 cities / 830 venues / 6,320 activities.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 4.4     | 12 Feb 2026 | Quiet hours midnight→sunrise precision. Hour clamping bug fix. City-vibes activity system rebuild.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 3.1.0   | 12 Feb 2026 | Previous authority document version.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
