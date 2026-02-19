# Exchange Card Weather System

> **Authority document** for the weather data pipeline, display, tooltips, prompt generation, lighting engine, and astronomical calculations on Promagen exchange cards.
>
> **Version:** 6.1.0 — 18 February 2026
>
> **Scope:** Gateway (Fly.io) → Frontend (Vercel/Next.js) — end-to-end.

---

## 1. System Overview

The exchange card weather system delivers real-time weather data for **89 stock exchanges** worldwide, displayed on interactive exchange cards. The system powers three user-facing features:

1. **Weather display** — Temperature (°C/°F), wind speed + dynamic emoji, humidity percentage.
2. **Weather emoji tooltip** — Hover the weather/moon emoji → conditions sentence, moon phase (night), next sunrise/sunset time.
3. **Image prompt tooltip** — Hover the country flag → AI-ready image prompt generated from live weather + city venue scenes + deterministic lighting engine, across 4 format tiers for 42+ AI image generators.

At night, the weather emoji swaps to a moon phase emoji calculated from pure astronomy (no API).

### Data Sources

| Source          | Provider                       | Purpose                                                                                    | Refresh                            |
| --------------- | ------------------------------ | ------------------------------------------------------------------------------------------ | ---------------------------------- |
| Live weather    | OpenWeatherMap (OWM)           | Temp, conditions, wind, humidity, cloud %, visibility, pressure, sunrise/sunset, day/night | Every 4 hours per exchange         |
| Demo weather    | Algorithmic (built-in)         | Fallback when gateway unavailable or exchange not yet in current batch                     | Recalculated on each page load     |
| Moon phase      | Pure astronomy (synodic cycle) | Moon emoji + prompt phrases at night                                                       | Calculated client-side, no API     |
| Lunar position  | Meeus ephemeris (§8.4)         | Moon altitude + azimuth for tooltip + prompt position phrases + night lighting competition | Calculated client-side, no API     |
| Solar elevation | Pure astronomy (NOAA formula)  | Lighting engine base — sun angle from lat, lon, day-of-year, hour                          | Calculated client-side, no API     |
| Urban light     | `urban-light.json` (§11A.3)    | Per-city artificial light emission factor for night lighting competition model             | Static data, 83 cities             |
| Sunrise/sunset  | OWM timestamps + NOAA fallback | Tooltip sun event times + quiet hours boundary                                             | API: exact. Fallback: ±5 min       |
| City scenes     | `city-vibes.json`              | Venue names for 83 cities                                                                  | Static vocabulary, seeded rotation |

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
│                         pressure                                     │
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
│  weather-prompt-generator.ts v6.1                                    │
│    ├─ LIGHTING ENGINE (deterministic, procedural)                    │
│    │   ├─ Daytime: Solar elevation + cloud % + visibility + pressure │
│    │   └─ Nighttime: Urban vs Moon competition model (v6.1)          │
│    │       ├─ urban-light.json (83 cities, 0.0–1.0 emission factor)  │
│    │       └─ Lunar position (Meeus ephemeris, altitude + azimuth)    │
│    ├─ city-vibes.json (83 cities, 842 venues, venue-only)            │
│    ├─ wind-template-descriptors.json (30 bins, descriptor + API speed)│
│    ├─ temperature.json (18 ranges, 54 phrases)                       │
│    ├─ humidity.json (20 ranges, 60 phrases)                          │
│    ├─ time-of-day.json (24 hours, 67 phrases)                        │
│    ├─ conditions.json (14 types, 280 phrases)                        │
│    └─ Moon phase calculator (8 phases, 40 phrases)                   │
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

**File:** `src/lib/weather/fetch-weather.ts` (244 lines)

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
  sunriseUtc: item.sunriseUtc ?? null,
  sunsetUtc: item.sunsetUtc ?? null,
  timezoneOffset: item.timezoneOffset ?? null,
  isDayTime: item.isDayTime ?? undefined,
}
```

**`demoToWeatherData(item) → ExchangeWeatherData`**

Demo data has **no** `description`, `sunriseUtc`, `sunsetUtc`, `timezoneOffset`, `isDayTime`, `cloudCover`, `visibility`, or `pressure`. All set to `undefined`. This intentionally triggers fallback paths in the prompt generator, day/night detection, and lighting engine.

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

**File:** `src/components/exchanges/types.ts` (171 lines)

The unified weather shape consumed by exchange cards. All day/night and lighting fields are optional for backward compatibility with demo data.

```typescript
type ExchangeWeatherData = {
  tempC: number | null;
  tempF?: number | null;
  emoji: string | null;
  condition?: string | null;
  humidity?: number | null;
  windKmh?: number | null;
  description?: string | null;
  cloudCover?: number | null; // v6.0 — cloud percentage for lighting engine
  visibility?: number | null; // v6.0 — metres, for atmosphere modifier
  pressure?: number | null; // v6.0 — hPa, for stability modifier
  sunriseUtc?: number | null;
  sunsetUtc?: number | null;
  timezoneOffset?: number | null;
  isDayTime?: boolean | null;
};
```

### 5.2 ExchangeWeatherFull (Prompt Generator Input)

**File:** `src/lib/weather/weather-types.ts` (252 lines)

The full weather type used internally by the prompt generator. All fields required (with null for missing).

```typescript
interface ExchangeWeatherFull {
  temperatureC: number;
  temperatureF: number;
  conditions: string;
  description: string;
  humidity: number;
  windSpeedKmh: number;
  cloudCover: number | null; // v6.0
  visibility: number | null; // v6.0
  pressure: number | null; // v6.0
  emoji: string;
  sunriseUtc: number | null;
  sunsetUtc: number | null;
  timezoneOffset: number | null;
  isDayTime: boolean | null;
}
```

**Conversion functions:**

- `toDisplayWeather(full) → ExchangeWeatherDisplay` — Full → display format.
- `toFullWeather(display) → ExchangeWeatherFull | null` — Display → full format, filling missing values with defaults (`humidity: 50`, `windKmh: 5`, `emoji: '🌤️'`, `cloudCover: null`, `visibility: null`, `pressure: null`).
- `getTemperatureColor(tempC) → hex` — Maps temperature to glow colour (blue → green → amber → red).
- `getWeatherEmoji(condition) → emoji` — Maps condition string to emoji.

### 5.3 ExchangeCardData (Card Component)

**File:** `src/components/exchanges/types.ts`

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

**File:** `src/components/exchanges/exchange-card.tsx` (639 lines)

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

**File:** `src/lib/weather/weather-prompt-generator.ts` (lines 326–465)

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

**File:** `src/components/exchanges/weather/weather-prompt-tooltip.tsx` (517 lines)

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

**File:** `src/lib/weather/weather-prompt-generator.ts` — **v6.1**

### 11.1 Tier Definitions

| Tier | Name             | Format                                | Target Platforms                                  | Default       |
| ---- | ---------------- | ------------------------------------- | ------------------------------------------------- | ------------- |
| 1    | CLIP-Based       | Weighted keywords `(keyword:1.2)`     | Stable Diffusion, Leonardo, Flux, ComfyUI         |               |
| 2    | Midjourney       | Natural language with `--` parameters | Midjourney, BlueWillow, Niji                      |               |
| 3    | Natural Language | Full descriptive sentences            | DALL·E, Imagen, Adobe Firefly, Bing Image Creator | **★ Default** |
| 4    | Plain Language   | Simple, minimal prompts               | Canva, Craiyon, Artistly, Microsoft Designer      |               |

**Default: Tier 3.** Testing showed Tier 4's flat comma-list lost time-of-day context entirely on plain language generators. Tier 3's sentence structure produces accurate time-of-day rendering on DALL·E, Imagen, and Firefly.

### 11.2 Element Ordering (v6.0)

Each tier has a platform-optimal element ordering based on how its target platforms parse prompts. **v6.0 changes:** Activities removed (venue-only). Lighting element added. Wind uses template descriptor + exact API speed. Tier orderings rebuilt for all 4 tiers.

**Tier 1 — CLIP-Based:** Weights override position. CLIP tokenises independently.

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

**Tier 2 — Midjourney:** Left-to-right diminishing attention (~60% weight on first clause).

```
Lighting+Time — City+Venue → Sky (conditional) → Moon → Wind → Humidity → Temp → --ar 16:9 --stylize 100
```

- Lighting + time **must lead** — the first 10-15 words define the render's colour palette, mood, and shadow structure.
- **Dash break** after the first clause prevents MJ over-stylization from long comma chains.
  - Example: `Late night, faint crescent moonlight and amber city glow through light haze — Sydney, Bondi Beach, ...`
- Temperature pushed to near-last — least visual element for MJ. Parameters always trail.

**Tier 3 — Natural Language (DEFAULT):** Parsed like a story. Full NLP understanding.

```
Sentence 1: "A [Time] scene in [City] at [Venue]."
Sentence 2: "[Lighting — causal structure]. [Sky — conditional]."
Sentence 3: "Under a [Moon]." (night only)
Sentence 4: "The air carries [Wind] and [Humidity], with [Temp]."
Sentence 5: "Photorealistic, highly detailed urban landscape."
```

- Lighting gets its own sentence with **causal structure**: source → modifier → result.
  - Example: `"Faint crescent moonlight is diffused by light haze and reflected from broken cloud."`
  - NOT descriptive stacking: ~~`"mixing with scattered amber city glow"`~~
- Wind, humidity, and temperature grouped in one sentence — NLP models understand these are related atmospheric properties.
- Sky conditionally omitted when lighting sentence already encodes cloud state (§11A.7).

**Tier 4 — Plain Language:** Weakest parsers. Keyword-scan, left-to-right, diminishing attention. First 5-7 tokens carry ~70% of image influence.

```
City → Venue → Lighting → Time → Sky (conditional) → Moon (night) → Wind → Humidity → Temp → Directive
```

- **Lighting before Time.** "golden-hour sunlight" is a concrete visual instruction. "two in the afternoon" is an abstract clock reading. Weak parsers grab the concrete token first.
- **Moon moved from last to slot 6.** At night, moon is visually critical — shouldn't be buried where weak parsers truncate.
- **Temperature deliberately last (before directive).** Least visual element. If the model catches it, it adds heat shimmer or tropical foliage. If it ignores it, nothing lost.
- Directive always final — it's a constraint, not a visual.

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

### 11.3 City Scene Model (Venue-Only) — v6.0

**File:** `src/data/vocabulary/weather/city-vibes.json`

**v6.0 change:** Activities removed. The scene model now provides **venue-only** location-specific subjects for 83 cities. Activities were the source of quiet-hours contradictions ("beach volleyball at 3am") and have been eliminated.

| Metric              | Count |
| ------------------- | ----- |
| Cities              | 83    |
| Total venues        | 842   |
| Average venues/city | ~10   |

**`getCityScene(city, seed) → { venue } | null`**

1. Looks up city in `CITY_DATA` (exact match, then partial match fallback).
2. Picks a random venue from the city's venue list using the seeded random.
3. Returns `null` if city has no data (prompt still generates without scene layer).

### 11.4 Vocabulary System (v6.0)

**v6.0 changes:** Wind moved to template descriptor system (§11.6). Temperature reduced from 180→54 phrases. Humidity reduced from 160→60 phrases. Time-of-day reduced from 120→67 phrases. Activities removed entirely.

Six vocabulary/data files in `src/data/vocabulary/weather/`:

| File                             | Ranges | Items | Coverage                                          |
| -------------------------------- | ------ | ----- | ------------------------------------------------- |
| `city-vibes.json`                | —      | 842   | 83 cities, 842 venues (venue-only, no activities) |
| `conditions.json`                | 14     | 280   | 14 weather types (20 phrases each)                |
| `wind-template-descriptors.json` | 30     | 30    | 0–150 km/h in 5 km/h bins (1 descriptor per bin)  |
| `temperature.json`               | 18     | 54    | −40°C to +50°C in 5°C bands (3 phrases per bin)   |
| `humidity.json`                  | 20     | 60    | 0–100% in 5% bands (3 phrases per bin)            |
| `time-of-day.json`               | 24     | 67    | 24 hours (1–5 phrases per hour)                   |

**Total prompt vocabulary: 1,333 items + 40 moon phrases + 28 lighting phrases = 1,401 items.**

### 11.5 Prompt Composition — 10 Layers (v6.0)

The `generateWeatherPrompt()` function builds a prompt by combining 10 elements:

| Layer | Element       | Source                                                                                                                             |
| ----- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1     | **City**      | Exchange card data                                                                                                                 |
| 2     | **Venue**     | `city-vibes.json` → seeded random venue selection                                                                                  |
| 3     | **Lighting**  | **Deterministic procedural assembly** from solar elevation + cloud % + visibility + pressure + urban light + lunar position (§11A) |
| 4     | **Time**      | `time-of-day.json` → 24-hour lookup, phrase rotation                                                                               |
| 5     | **Sky**       | Live: OWM `description` directly. Demo: `conditions.json` phrase. **Conditionally omitted** (§11A.7)                               |
| 6     | **Moon**      | Moon phase calculator → 40 phrases (night only)                                                                                    |
| 7     | **Wind**      | `wind-template-descriptors.json` descriptor + exact API speed (§11.6)                                                              |
| 8     | **Humidity**  | `humidity.json` → range lookup by percentage                                                                                       |
| 9     | **Temp**      | `temperature.json` → range lookup by °C                                                                                            |
| 10    | **Directive** | Quiet hours "no people or text visible" (§11.8)                                                                                    |

### 11.6 Wind Template System (v6.0 — New)

**File:** `src/data/vocabulary/weather/wind-template-descriptors.json`

**v6.0 change:** Wind moved from phrase pools (8 phrases per bin, randomly selected) to a **deterministic descriptor + exact API speed** system.

Each of the 30 wind bins (0–150 km/h in 5 km/h intervals) contains a single `descriptor` — no phrases, no randomness.

```json
{
  "range_35_to_40": {
    "min": 35,
    "max": 40,
    "label": "35–40 km/h",
    "descriptor": "fresh breeze"
  }
}
```

**Runtime assembly:** The prompt engine looks up the descriptor by bin, then injects the exact API wind speed:

```
descriptor = "fresh breeze"     (from bin lookup)
speed = 37                      (from API: raw.wind.speed * 3.6)
output = "fresh breeze at 37 km/h"
```

**Template variants** (in `meta.templates`):

| Template          | When to use                   | Example                       |
| ----------------- | ----------------------------- | ----------------------------- |
| `combined_exact`  | Default — exact API value     | `fresh breeze at 37 km/h`     |
| `combined_approx` | If rounding/smoothing applied | `fresh breeze around 37 km/h` |
| `numeric_exact`   | Speed only, no descriptor     | `wind at 37 km/h`             |

**Default: `combined_exact`.** The API provides an exact measurement. No guessing. No midpoint fabrication.

**Why this replaces phrase pools:** The old system stored 8 phrases per bin like "firm-breeze sustained wind intensity" — compound junk that no image model parses into a visual. The new system gives the model both a visual feel ("fresh breeze") and a physical anchor ("37 km/h"). That's data-driven, not mood-sampled.

### 11.7 Sky Source Logic

**`getSkySource(ctx, seed) → string | null`**

Two-path resolution with wind-only filtering:

1. **Live data path:** If `description` exists from OWM API, use it directly as the sky source. Exception: wind-only descriptions (`"windy"`, `"breezy"`, `"gusty"`, `"blustery"`, `"squall"`) return `null` since they describe wind, not sky.
2. **Demo fallback path:** No description → look up emoji in `CONDITION_BY_EMOJI` map → select a phrase from `conditions.json`.

This ensures live data always gets the real OWM sky description with no duplication from the vocabulary files.

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

### 11.9 Night Integration (v6.1 — Revised)

Moon rendering in prompts is gated by `LightingState.moonVisible`:

- `moonVisible = true` → Moon phase phrase + position phrase (if available) rendered in tier-specific syntax.
- `moonVisible = false` → Entire moon layer suppressed. No phantom crescents below the horizon.
- No lat/lon available → `moonVisible = true` (backward compatibility; shows phase only, no position).

When `moonVisible` is true, the moon phase prompt phrase AND position phrase are injected with tier-specific formatting:

- **Tier 1:** `(moon.promptPhrase moonPositionPhrase:1.2)` — weighted keyword
- **Tier 2:** `moon.promptPhrase moonPositionPhrase` — plain text after dash break
- **Tier 3:** `"A [moon.promptPhrase] hangs [moonPositionPhrase]."` — sentence with position
- **Tier 4:** `moon.promptPhrase moonPositionPhrase` — plain text at position 6

Moon position phrase comes from `LightingState.moonPositionPhrase` — gated on altitude > 0° AND cloud ≤ 75% AND visibility ≥ 3000m. When the position gate fails but moonVisible is true, only the phase phrase renders (e.g. overcast night with moon above horizon — you know it's there but can't point to it).

### 11.10 Quiet Hours & People Exclusion (v6.0 — Revised)

**`isQuietHours(weather, localHour) → boolean`**

**v6.0 change:** Quiet hours window expanded from `midnight (00:00) → sunrise` to `23:59 local → sunrise + 1 hour`.

Two-tier detection:

1. **Live data (precise):** If `sunriseUtc` and `timezoneOffset` are available, calculates whether local time is between 23:59 (local) and the sunrise second + 3600 seconds (1 hour after sunrise). Seconds precision.
2. **Fallback (approximate):** `localHour >= 0 && localHour < 7` (extended by 1 hour from previous `< 6`).

**Rationale:** A city isn't empty at 23:30 in the old system, but it also isn't bustling at 06:01 when sunrise is 06:00. The new window better reflects reality: quiet from just before midnight until one hour after sunrise, when early morning foot traffic picks up.

The `quiet` boolean gates the "no people or text visible" directive in all 4 tiers. Since activities are removed (v6.0), the quiet boolean now only controls the people exclusion directive — there is no activity phrase to suppress.

| Behaviour                 | Quiet hours (23:59 → sunrise + 1hr) | Active hours (sunrise + 1hr → 23:59)  |
| ------------------------- | ----------------------------------- | ------------------------------------- |
| **"No people" directive** | Present — renders empty scene       | Removed — people may naturally appear |

**Per-tier implementation:**

| Tier | Active hours output                                    | Quiet hours output                                                                |
| ---- | ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| 1    | `... --no watermarks logos blurry`                     | `... --no people text watermarks logos blurry`                                    |
| 2    | `... --ar 16:9 --stylize 100`                          | `... --ar 16:9 --stylize 100 --no people text`                                    |
| 3    | `... Photorealistic, highly detailed urban landscape.` | `... Photorealistic, highly detailed urban landscape. No people or text visible.` |
| 4    | `... [temp]`                                           | `... [temp], no people or text visible`                                           |

### 11.11 Design Decisions (v6.1)

1. **Activities removed** (v6.0) — Venue-only model. Activities were the primary source of quiet-hours contradictions and added complexity without proportional visual value. The venue alone anchors the scene; the lighting engine now does the heavy atmospheric lifting.
2. **Wind uses exact API speed** — No midpoint guessing. The descriptor comes from the bin, the number comes from the API. "fresh breeze at 37 km/h" not "wind around 42 km/h".
3. **Lighting is deterministic** — No seed, no rotation, no phrase pools. Same lat/lon + same time + same cloud + same visibility + same pressure + same urban factor + same lunar position = same lighting phrase. Always.
4. **One engine, multiple skins** — The lighting calculation runs once per exchange card, producing one lighting state object. Each tier renders that state into its own syntax. The underlying physics never changes. Only the surface language adapts to the parser. If lighting logic ever forks per tier, determinism is broken.
5. **Humidity IS in prompts but NOT in atmosphere modifier** (v6.1) — All 4 tiers include humidity phrases from `humidity.json`. The atmosphere modifier (§11A.5) uses visibility-only to prevent humidity language appearing twice in the same prompt.
6. **No °C/°F in prompts** — Temperature units stripped from all tiers.
7. **Sky deduplication with lighting** — When a lighting phrase already encodes cloud state, Sky is conditionally omitted (§11A.7).
8. **Wind-only filtering** — OWM descriptions like "windy" and "breezy" are excluded from the sky layer.
9. **Urban vs Moon competition** (v6.1) — Night lighting is no longer a simple moon-brightness × cloud-cover lookup. Two light sources compete with physically modelled interactions: urban glow (static per city, amplified by cloud reflection) vs moonlight (phase brightness × altitude attenuation × cloud blocking). The winner determines the base phrase.
10. **Moon visibility gate** (v6.1) — The moon prompt layer is suppressed when the moon is below the horizon. No phantom crescents that can't be seen. Moon position descriptor is additionally gated on cloud ≤ 75% and visibility ≥ 3000m — you know it's there but can't point to it through thick cloud.

---

## 11A. Lighting Engine (v6.1)

The lighting engine is the most significant addition in v6.0, with the night branch fully rewritten in v6.1. It replaces time-based implied lighting with **deterministic atmospheric optics** — a procedurally assembled lighting phrase derived from measured inputs. No randomness. No phrase pools. No mood sampling. Same inputs = same output. Always.

**v6.1 changes:** Night branch replaced with Urban vs Moon competition model (§11A.3). Atmosphere modifier simplified to visibility-only (§11A.5). Lunar position calculator added (§8.4). urban-light.json added (83 cities). Moon visibility gate added. Moon position phrase rendered in all 4 tiers.

### 11A.1 Architecture — Procedural Assembly

**Daytime:** Same 4-segment concatenation as v6.0:

```
[BASE] + [SHADOW_MODIFIER] + [ATMOSPHERE_MODIFIER] + [STABILITY_MODIFIER]
```

**Nighttime:** Urban vs Moon competition model (v6.1):

```
INPUTS: urbanLightFactor, moonPhase, lunarAltitude, cloud%, visibility, pressure
  → Competition maths → winner (urban | moon | balanced)
  → BASE phrase from winner + conditions
  → + [ATMOSPHERE_MODIFIER] + [STABILITY_MODIFIER]
  → + moonPositionPhrase (gated: alt > 0° AND cloud ≤ 75% AND vis ≥ 3000m)
```

Each segment is either present or absent depending on the data. No forced inclusion. If the modifier doesn't meaningfully change the scene, it is omitted.

### 11A.2 Data Inputs

| Input           | Source                             | Available       | Role                                             |
| --------------- | ---------------------------------- | --------------- | ------------------------------------------------ |
| Solar elevation | NOAA formula (lat, lon, day, hour) | Always (calc)   | Base light descriptor (daytime)                  |
| Cloud cover %   | `clouds.all` from OWM API          | Live data only  | Shadow/diffusion + cloud amplification (night)   |
| Visibility (m)  | `visibility` from OWM API          | Live data only  | Atmosphere modifier (sole input, v6.1)           |
| Pressure (hPa)  | `main.pressure` from OWM API       | Live data only  | Stability modifier                               |
| Moon phase      | Synodic calculation (existing)     | Always (calc)   | Night base phrase input + brightness value       |
| Lunar position  | Meeus ephemeris (§8.4)             | When lat/lon    | Night altitude attenuation + position descriptor |
| Urban light     | `urban-light.json` per city        | Always (static) | Night urban glow factor for competition model    |
| City name       | Exchange card data                 | Always          | Key for urban-light.json lookup                  |

**Demo data fallback:** When cloud cover, visibility, or pressure are unavailable (demo data), the lighting engine falls back to a simplified time-only descriptor. This intentionally produces less-rich prompts from demo data — live data should always be richer.

### 11A.3 Segment 1: BASE — Solar Elevation

Always present. One phrase per bin. No randomness.

**Daytime bins (sun above horizon):**

| Elevation  | Base Phrase                     | Visual Character                                 |
| ---------- | ------------------------------- | ------------------------------------------------ |
| 0° to 6°   | golden-hour sunlight            | Warm orange-gold, long soft shadows, directional |
| 6° to 15°  | low-angle sunlight              | Warm directional light, moderate shadows         |
| 15° to 35° | mid-elevation daylight          | Standard white daylight, clear shadows           |
| 35° to 60° | high-angle sunlight             | Bright overhead, short shadows                   |
| 60°+       | near-vertical overhead sunlight | Harsh vertical light, almost no lateral shadow   |

**Cloud override:** If cloud > 75% AND solar elevation 0°–6°, base shifts from "golden-hour sunlight" to **"low-angle overcast daylight"**. Thick cloud blocks the spectral warm shift that produces golden tones. This prevents physically misleading prompts.

**Twilight bins (sun below horizon but still influencing):**

| Elevation    | Base Phrase                           |
| ------------ | ------------------------------------- |
| −6° to 0°    | civil twilight blue-hour light        |
| −12° to −6°  | nautical twilight deep blue sky light |
| −18° to −12° | astronomical twilight faint sky glow  |

**Night bins (sun below −18°):**

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

**Competition maths:**

```
effectiveUrban = urbanFactor × (1 + cloud/100 × 0.5)
effectiveMoon  = phaseBrightness × altitudeAttenuation × (1 − cloud/100 × 0.7)

DOMINANCE_THRESHOLD = 1.5
  effectiveUrban > effectiveMoon × 1.5 → urban dominates
  effectiveMoon > effectiveUrban × 1.5 → moon dominates
  otherwise → balanced
```

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

### 11A.4 Segment 2: SHADOW_MODIFIER — Cloud Cover

**Daytime only** (solar elevation > 0°). At night, shadow behaviour is already encoded in the base phrase.

| Cloud % | Modifier                          | Condition                                                             |
| ------- | --------------------------------- | --------------------------------------------------------------------- |
| 0–20%   | with sharp defined shadows        | Only when solar elevation > 6° (below 6° shadows are soft from angle) |
| 20–50%  | with intermittent soft shadows    | Only when solar elevation > 6°                                        |
| 50–75%  | with diffused even light          | Always appended when in range                                         |
| 75–100% | with flat shadowless illumination | Always appended                                                       |
| —       | _(omitted)_                       | When solar elevation 0°–6° (golden hour shadows inherently soft)      |

The conditional logic prevents contradictions: "sharp shadows" cannot appear during golden hour, because golden hour light is inherently soft and directional regardless of cloud cover.

### 11A.5 Segment 3: ATMOSPHERE_MODIFIER — Visibility Only (v6.1 — Simplified)

**v6.1 change:** Humidity removed from atmosphere modifier to eliminate duplication with the separate Humidity layer (§11.5, Layer 8). Visibility is the measured optical clarity — the only signal needed. Humidity is handled exclusively by the humidity vocabulary phrases.

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

### 11A.9 Tier-Specific Lighting Rendering

The lighting state object is computed once. Each tier renders it differently:

| Tier | Rendering                                                                                                                                                        |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Comma-separated weighted tokens. Primary source gets 1.3, modifiers unweighted. Example: `(golden-hour sunlight:1.3), sharp defined shadows, pristine clear air` |
| 2    | Full phrase in first clause before dash break. Example: `Golden-hour sunlight with sharp defined shadows in pristine clear air — Sydney, Bondi Beach...`         |
| 3    | Causal sentence. Source → modifier → result. Example: `Golden-hour sunlight casts sharp defined shadows through pristine clear air.`                             |
| 4    | Full phrase as-is in comma-separated list. Example: `..., golden-hour sunlight with sharp defined shadows in pristine clear air, ...`                            |

### 11A.10 Lighting Phrase Count

| Segment                   | Phrases | Notes                                            |
| ------------------------- | ------- | ------------------------------------------------ |
| Daytime base              | 5       | + 1 cloud override variant                       |
| Twilight base             | 3       |                                                  |
| Night base (competition)  | 12      | 4 urban + 5 moon + 3 balanced (v6.1 competition) |
| Shadow modifier           | 4       | + 2 omission rules                               |
| Atmosphere modifier       | 6       | Visibility-only (v6.1, humidity removed)         |
| Stability modifier        | 2       | + 1 omission rule                                |
| Moon position descriptors | 40      | 5 altitude bins × 8 azimuth sectors (§8.4)       |
| **Total**                 | **72**  | + conditional omission rules + competition logic |

72 phrases, procedurally assembled. The competition model alone produces hundreds of distinct night outputs from 12 base phrases × cloud modifiers × urban factors × moon altitudes.

### 11A.11 LightingState Type Reference (v6.1)

**File:** `src/lib/weather/weather-prompt-generator.ts` (lines 130–173)

The `LightingState` interface is the output of `computeLighting()` and the input to all 4 tier generators:

```typescript
interface LightingState {
  /** Assembled lighting phrase: base + shadow + atmosphere + stability */
  phrase: string;
  /** Whether the sky element should be omitted to avoid cloud duplication */
  skipSky: boolean;
  /**
   * Moon position descriptor from getLunarPosition() (§8.4).
   * Gated: altitude > 0° AND cloud ≤ 75% AND visibility ≥ 3000m.
   * e.g. "low in the eastern sky", "near overhead"
   */
  moonPositionPhrase: string | null;
  /**
   * Which light source dominates at night. null during daytime.
   * 'urban' | 'moon' | 'balanced'
   */
  nightDominant: 'urban' | 'moon' | 'balanced' | null;
  /**
   * Whether the moon is above the horizon and renderable.
   * When false, the entire moon layer (phase + position) is suppressed.
   */
  moonVisible: boolean;
}
```

---

## 12. Vocabulary Index

**File:** `src/data/vocabulary/index.ts` (481 lines)

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

| File                          | Lines | Purpose                                                                           |
| ----------------------------- | ----- | --------------------------------------------------------------------------------- |
| `server.ts`                   | 721   | Main gateway server                                                               |
| `openweathermap/adapter.ts`   | 393   | OWM API client + response parsing (now includes cloudCover, visibility, pressure) |
| `openweathermap/types.ts`     | 386   | Gateway types (`WeatherData`, `BatchId`, `WeatherResponseMeta`)                   |
| `openweathermap/scheduler.ts` | 403   | 4-batch clock-aligned rotation                                                    |
| `openweathermap/budget.ts`    | 379   | Rate limiting + daily budget tracking                                             |
| `openweathermap/weather.ts`   | 794   | Main handler, batch city management, MERGE accumulator                            |
| `openweathermap/index.ts`     | 107   | Module exports                                                                    |

### Frontend — Weather Library

| File                                          | Lines | Purpose                                                                      |
| --------------------------------------------- | ----- | ---------------------------------------------------------------------------- |
| `src/lib/weather/weather-prompt-generator.ts` | 1415  | 4-tier prompt system v6.1 + lighting engine + competition model + moon phase |
| `src/lib/weather/fetch-weather.ts`            | 244   | Server-side gateway fetch + demo gap-fill                                    |
| `src/lib/weather/weather-types.ts`            | 252   | Type system (`ExchangeWeatherFull`, colour helpers)                          |
| `src/lib/weather/sun-calculator.ts`           | 562   | NOAA sunrise/sunset + solar elevation + lunar position (v6.1)                |
| `src/lib/weather/weather.ts`                  | 113   | Shared weather utilities                                                     |
| `src/lib/weather/exchange-weather.ts`         | 17    | Barrel re-exports                                                            |
| `src/hooks/use-weather-prompt-tier.ts`        | 134   | Tier selection hook (Free→Tier 3, Pro→localStorage)                          |

### Frontend — Vocabulary

| File                           | Lines | Purpose                                              |
| ------------------------------ | ----- | ---------------------------------------------------- |
| `src/data/vocabulary/index.ts` | 481   | Central vocabulary entry point + type-safe accessors |

### Frontend — Components

| File                                                          | Lines | Purpose                                                             |
| ------------------------------------------------------------- | ----- | ------------------------------------------------------------------- |
| `src/components/exchanges/exchange-card.tsx`                  | 655   | Main card component (snap-fit, day/night detection, WeatherSection) |
| `src/components/exchanges/weather/weather-emoji-tooltip.tsx`  | 508   | Emoji tooltip (conditions + moon position + sun event) (v6.1)       |
| `src/components/exchanges/weather/weather-prompt-tooltip.tsx` | 523   | Prompt tooltip (4-tier AI prompts + copy button)                    |
| `src/components/exchanges/types.ts`                           | 171   | Card types (`ExchangeCardData`, `ExchangeWeatherData`)              |
| `src/components/exchanges/adapters.ts`                        | 123   | Data adapters (`toCardData`)                                        |
| `src/components/home/rails/exchange-column.tsx`               | 77    | Exchange column layout (passes promptTier prop)                     |
| `src/components/home/mission-control.tsx`                     | 662   | Home page orchestrator (calls `getDefaultTier()`)                   |
| `src/components/ribbon/commodity-prompt-tooltip.tsx`          | 771   | Commodity prompt tooltip (shares tier system)                       |

### Frontend — Data

| File                                                         | Lines | Purpose                                                    |
| ------------------------------------------------------------ | ----- | ---------------------------------------------------------- |
| `src/data/exchanges/exchanges.catalog.json`                  | —     | 89 exchanges with lat/lon, tz, market hours                |
| `src/data/weather/exchange-weather.demo.ts`                  | 907   | Algorithmic demo weather (seasonal + diurnal + conditions) |
| `src/data/vocabulary/weather/city-vibes.json`                | TBD   | 83 cities, 842 venues (venue-only, no activities)          |
| `src/data/vocabulary/weather/urban-light.json`               | TBD   | 83 cities, per-city urban light emission factor (0.0–1.0)  |
| `src/data/vocabulary/weather/conditions.json`                | 398   | 14 weather types, 280 phrases                              |
| `src/data/vocabulary/weather/wind-template-descriptors.json` | TBD   | 30 bins, 1 descriptor per bin (template + exact API speed) |
| `src/data/vocabulary/weather/temperature.json`               | TBD   | 18 ranges, 54 phrases (−40°C to +50°C)                     |
| `src/data/vocabulary/weather/humidity.json`                  | TBD   | 20 ranges, 60 phrases (0–100%)                             |
| `src/data/vocabulary/weather/time-of-day.json`               | TBD   | 24 hours, 67 phrases                                       |

---

## 15. Summary of Key Numbers

| Metric                               | Value                                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Total exchanges                      | 89                                                                                                            |
| Exchanges with coordinates           | 89 (100%)                                                                                                     |
| Unique API coordinates (after dedup) | 83                                                                                                            |
| Batches                              | 4 (A/B/C/D)                                                                                                   |
| Refresh cycle per exchange           | Every 4 hours                                                                                                 |
| Daily API calls                      | ~498 (within 1,000 free tier)                                                                                 |
| Moon phases                          | 8                                                                                                             |
| Moon prompt phrases                  | 40 (5 per phase)                                                                                              |
| Moon position descriptors            | 40 (5 altitude bins × 8 azimuth sectors) (v6.1)                                                               |
| Urban light cities                   | 83 (0.20–0.98 range, 4 tiers) (v6.1)                                                                          |
| Prompt tiers                         | 4 (default: Tier 3 Natural Language)                                                                          |
| Cities with venue scenes             | 83                                                                                                            |
| Total venues                         | 842                                                                                                           |
| Total activities                     | **0** (removed in v6.0)                                                                                       |
| Wind descriptors                     | 30 (1 per 5 km/h bin, template + exact API speed)                                                             |
| Temperature phrases                  | 54 (3 per 5°C bin)                                                                                            |
| Humidity phrases                     | 60 (3 per 5% bin)                                                                                             |
| Time-of-day phrases                  | 67 (1–5 per hour)                                                                                             |
| Condition phrases                    | 280 (20 per type)                                                                                             |
| Lighting phrases                     | 72 (procedurally assembled, competition model) (v6.1, up from 28)                                             |
| Total prompt vocabulary              | 1,445 items (1,333 JSON + 40 moon + 72 lighting) (v6.1)                                                       |
| Prompt elements per prompt           | 10 layers (v6.0, up from 9)                                                                                   |
| Prompt generator                     | 1,415 lines (v6.1)                                                                                            |
| Sun/Moon calculator                  | 562 lines (v6.1, up from 220)                                                                                 |
| Total weather system code            | ~6,100 lines (frontend) + ~3,200 lines (gateway)                                                              |
| API fields used for lighting         | 6 (solar elevation, cloud %, visibility, humidity, pressure, moon phase)                                      |
| Night lighting inputs                | 8 (solar elevation, cloud %, visibility, pressure, moon phase, lunar position, urban light factor, city name) |

---

## 16. Version History

| Version | Date        | Changes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6.1.0   | 18 Feb 2026 | **NIGHT LIGHTING V2 — URBAN VS MOON COMPETITION MODEL** — Night branch completely rewritten. Two competing light sources (urban glow from `urban-light.json` × cloud amplification vs moonlight from phase brightness × altitude attenuation × cloud blocking) with dominance threshold → 12 base phrases replacing 6. **LUNAR POSITION CALCULATOR** — Meeus ephemeris in `sun-calculator.ts` (lines 332–562). Altitude (5 bins) + azimuth (8 sectors) → 40 position descriptors. ~1° accuracy. **MOON POSITION IN EMOJI TOOLTIP** — Always-on (day + night, above + below horizon). Day/night-specific word order in `buildMoonPositionPhrase()`. Copy button added. **MOON POSITION IN PROMPTS** — Gated on altitude > 0° AND cloud ≤ 75% AND visibility ≥ 3000m. Rendered per-tier syntax. **MOON VISIBILITY GATE** — `moonVisible` flag suppresses entire moon layer when below horizon. **URBAN-LIGHT.JSON** — 83 cities with NASA/NOAA VIIRS-derived light emission factors (0.20–0.98). **ATMOSPHERE MODIFIER SIMPLIFIED** — Humidity removed from atmosphere modifier (§11A.5) to prevent duplication with Humidity layer. Now visibility-only (6 bins). **LIGHTING STATE EXTENDED** — `LightingState` gains `moonPositionPhrase`, `nightDominant`, `moonVisible` fields. **LINE COUNT CHANGES** — `sun-calculator.ts` 220→562, `weather-prompt-generator.ts` TBD→1415, `weather-emoji-tooltip.tsx` 319→508, `exchange-card.tsx` 639→655, `mission-control.tsx` 566→662. |
| 6.0.0   | 17 Feb 2026 | **LIGHTING ENGINE** — Deterministic procedural lighting from solar elevation + cloud % + visibility + humidity + pressure. 28 phrases, 4 segments (base + shadow + atmosphere + stability), zero randomness. **ACTIVITIES REMOVED** — Venue-only city scene model. 842 venues across 83 cities, no activities. **WIND TEMPLATE SYSTEM** — Phrase pools replaced with descriptor-per-bin + exact API speed injection. "fresh breeze at 37 km/h" replaces "firm-breeze sustained wind intensity". **QUIET HOURS REVISED** — Window changed from midnight→sunrise to 23:59→sunrise+1hr. **TIER ORDERINGS REBUILT** — Lighting element added to all 4 tiers. Tier 4: lighting before time. Tier 2: lighting+time lead with dash break. Tier 1: lighting as comma-separated weighted tokens. Tier 3: causal lighting sentence. **SKY/LIGHTING DUPLICATION RULE** — Sky conditionally omitted when lighting already encodes cloud state. **VOCABULARY COUNTS UPDATED** — Temperature 180→54, humidity 160→60, time-of-day 120→67, wind 240→30 descriptors. Total vocabulary 8,170→1,401. **NEW API FIELDS** — cloudCover, visibility, pressure piped through gateway→frontend→prompt generator.                                                                                                                                                                                                                                                                                        |
| 5.2.0   | 14 Feb 2026 | "No people" directive and activity suppression now linked by `quiet` boolean across all 4 tiers. Tier 4 gains people exclusion during quiet hours. Tier 1/2/3 people exclusion now conditional (was hardcoded unconditionally). Type fixes in `vocabulary/index.ts` — CityVibes interface updated to match venue/activity JSON shape, all `.contextual` accesses made safe via optional chaining, `ConditionEntry` gains optional `label` field.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 5.0.0   | 13 Feb 2026 | Default tier 4→3. Tier element ordering rebuilt (time-first for T2/T3, time-last for T1, time-after-subject for T4). Humidity restored to all 4 tiers. Redundant word suffixes removed from templates. city-vibes expanded to 83 cities / 830 venues / 6,320 activities.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 4.4     | 12 Feb 2026 | Quiet hours midnight→sunrise precision. Hour clamping bug fix. City-vibes activity system rebuild.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 3.1.0   | 12 Feb 2026 | Previous authority document version.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
