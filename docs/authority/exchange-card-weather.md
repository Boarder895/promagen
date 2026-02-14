# Exchange Card Weather System

> **Authority document** for the weather data pipeline, display, tooltips, prompt generation, and astronomical calculations on Promagen exchange cards.
>
> **Version:** 5.2.0 — 14 February 2026
>
> **Scope:** Gateway (Fly.io) → Frontend (Vercel/Next.js) — end-to-end.

---

## 1. System Overview

The exchange card weather system delivers real-time weather data for **89 stock exchanges** worldwide, displayed on interactive exchange cards. The system powers three user-facing features:

1. **Weather display** — Temperature (°C/°F), wind speed + dynamic emoji, humidity percentage.
2. **Weather emoji tooltip** — Hover the weather/moon emoji → conditions sentence, moon phase (night), next sunrise/sunset time.
3. **Image prompt tooltip** — Hover the country flag → AI-ready image prompt generated from live weather + city venue/activity scenes, across 4 format tiers for 42+ AI image generators.

At night, the weather emoji swaps to a moon phase emoji calculated from pure astronomy (no API).

### Data Sources

| Source         | Provider                       | Purpose                                                                | Refresh                            |
| -------------- | ------------------------------ | ---------------------------------------------------------------------- | ---------------------------------- |
| Live weather   | OpenWeatherMap (OWM)           | Temp, conditions, wind, humidity, sunrise/sunset, day/night            | Every 4 hours per exchange         |
| Demo weather   | Algorithmic (built-in)         | Fallback when gateway unavailable or exchange not yet in current batch | Recalculated on each page load     |
| Moon phase     | Pure astronomy (synodic cycle) | Moon emoji + prompt phrases at night                                   | Calculated client-side, no API     |
| Sunrise/sunset | OWM timestamps + NOAA fallback | Tooltip sun event times                                                | API: exact. Fallback: ±5 min       |
| City scenes    | `city-vibes.json`              | Venue names + activities for 83 cities                                 | Static vocabulary, seeded rotation |

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
│                         timezoneOffset                               │
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
│  weather-prompt-generator.ts v5.2                                    │
│    ├─ city-vibes.json (83 cities, 830 venues, 6,320 activities)      │
│    ├─ temperature.json (18 ranges, 180 phrases)                      │
│    ├─ wind.json (30 ranges, 240 phrases)                             │
│    ├─ humidity.json (20 ranges, 160 phrases)                         │
│    ├─ time-of-day.json (24 hours, 120 phrases)                       │
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

Maps gateway fields to the card's weather type. Pipes through all day/night fields:

```typescript
{
  tempC: item.temperatureC,
  tempF: item.temperatureF,
  emoji: item.emoji,
  condition: item.conditions,
  humidity: item.humidity,
  windKmh: item.windSpeedKmh,
  description: item.description,
  sunriseUtc: item.sunriseUtc ?? null,
  sunsetUtc: item.sunsetUtc ?? null,
  timezoneOffset: item.timezoneOffset ?? null,
  isDayTime: item.isDayTime ?? undefined,
}
```

**`demoToWeatherData(item) → ExchangeWeatherData`**

Demo data has **no** `description`, `sunriseUtc`, `sunsetUtc`, `timezoneOffset`, or `isDayTime`. All set to `undefined`. This intentionally triggers fallback paths in the prompt generator and day/night detection.

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

**Key limitation:** Demo data has no `description` field. Only live API data provides real OWM descriptions like "broken clouds" or "light rain". This makes live prompts richer than demo prompts — live data uses the OWM description directly as the sky source, while demo data falls back to emoji-matched condition phrases from `conditions.json`.

---

## 5. Type System

### 5.1 ExchangeWeatherData (Card Input)

**File:** `src/components/exchanges/types.ts` (171 lines)

The unified weather shape consumed by exchange cards. All day/night fields are optional for backward compatibility with demo data.

```typescript
type ExchangeWeatherData = {
  tempC: number | null;
  tempF?: number | null;
  emoji: string | null;
  condition?: string | null;
  humidity?: number | null;
  windKmh?: number | null;
  description?: string | null;
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
  emoji: string;
  sunriseUtc: number | null;
  sunsetUtc: number | null;
  timezoneOffset: number | null;
  isDayTime: boolean | null;
}
```

**Conversion functions:**

- `toDisplayWeather(full) → ExchangeWeatherDisplay` — Full → display format.
- `toFullWeather(display) → ExchangeWeatherFull | null` — Display → full format, filling missing values with defaults (`humidity: 50`, `windKmh: 5`, `emoji: '🌤️'`).
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
  latitude?: number; // For astronomical sunrise/sunset fallback
  longitude?: number; // For astronomical sunrise/sunset fallback
};
```

### 5.4 Data Adapter

**File:** `src/components/exchanges/adapters.ts` (123 lines)

`toCardData(exchange, weather?, indexQuote?) → ExchangeCardData`

Converts a canonical `Exchange` (from `exchanges.catalog.json`) to the card's data shape. Pipes through `latitude` and `longitude` from the catalog for the astronomical sunrise/sunset fallback in the emoji tooltip.

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

**File:** `src/components/exchanges/weather/weather-emoji-tooltip.tsx` (319 lines)

### 7.1 Purpose

Informational tooltip on hover over the weather/moon emoji. Displays a single coherent sentence with conditions, moon phase (night), and next sun event.

**Examples:**

- Daytime: _"Broken clouds over Taipei. Sunset at 5:47 PM."_
- Nighttime: _"Light rain over Wellington. Waxing crescent moon. Sunrise at 6:23 AM."_

### 7.2 Visual Specs

| Property         | Value                                      |
| ---------------- | ------------------------------------------ |
| Width            | 320px                                      |
| Background       | `rgba(15, 23, 42, 0.97)` (dark glass)      |
| Border           | Temperature-coloured glow at 50% opacity   |
| Box shadow       | Triple-layer glow (40px, 80px, inset 25px) |
| Radial gradients | Top ellipse + bottom accent                |
| Close delay      | 400ms (matches prompt tooltip)             |
| Rendering        | React Portal to `document.body`            |
| Copy button      | None (informational only)                  |

### 7.3 Content Construction

**Function:** `buildTooltipText(city, description, isNight, sunEvent) → string`

1. **Weather over city** — Capitalises the OWM description: `"Broken clouds over Taipei."`. Falls back to `"Weather over Taipei."` when description is null (demo data).
2. **Moon phase** (night only) — Calls `getMoonPhase()` for phase name. Handles names that already contain "moon" (e.g. "New Moon", "Full Moon") to avoid "New Moon moon." duplication.
3. **Sun event** — `"Sunset at 5:47 PM."` or `"Sunrise at 6:23 AM."` via the 2-tier sun event cascade.

### 7.4 Sun Event Cascade

**Function:** `getNextSunEvent(isNight, tz, sunriseUtc?, sunsetUtc?, latitude?, longitude?) → { label, time } | null`

**File:** `src/lib/weather/sun-calculator.ts` (220 lines)

| Tier | Source                                                | Accuracy   | When Used                           |
| ---- | ----------------------------------------------------- | ---------- | ----------------------------------- |
| 1    | OWM API timestamps (`sunriseUtc` / `sunsetUtc`)       | Exact      | Live data with valid timestamps     |
| 2    | NOAA astronomical calculation (`calculateSunTimes()`) | ±5 minutes | Demo data or missing API timestamps |

Logic: At night → show next sunrise. During day → show next sunset.

All 89 exchanges have `latitude` and `longitude` in the catalog, so Tier 2 is always available as fallback. None of the 89 exchanges are in polar regions, so `calculateSunTimes()` never returns null in practice.

---

## 8. NOAA Solar Calculator

**File:** `src/lib/weather/sun-calculator.ts` (220 lines)

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

### 8.2 Output

```typescript
interface SunTimes {
  sunriseUTC: Date;
  sunsetUTC: Date;
  sunriseLocal: string; // "6:23 AM" (formatted via Intl.DateTimeFormat)
  sunsetLocal: string; // "5:47 PM"
}
```

Returns `null` for polar regions where the sun doesn't rise or set (not applicable to any of the 89 exchanges).

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

**File:** `src/lib/weather/weather-prompt-generator.ts` (970 lines) — **v5.2**

### 11.1 Tier Definitions

| Tier | Name             | Format                                | Target Platforms                                  | Default       |
| ---- | ---------------- | ------------------------------------- | ------------------------------------------------- | ------------- |
| 1    | CLIP-Based       | Weighted keywords `(keyword:1.2)`     | Stable Diffusion, Leonardo, Flux, ComfyUI         |               |
| 2    | Midjourney       | Natural language with `--` parameters | Midjourney, BlueWillow, Niji                      |               |
| 3    | Natural Language | Full descriptive sentences            | DALL·E, Imagen, Adobe Firefly, Bing Image Creator | **★ Default** |
| 4    | Plain Language   | Simple, minimal prompts               | Canva, Craiyon, Artistly, Microsoft Designer      |               |

**Default changed from Tier 4 → Tier 3 in v5.0.** Testing showed Tier 4's flat comma-list lost time-of-day context entirely on plain language generators (e.g. Artistly produced daytime scenes for nighttime prompts). Tier 3's sentence structure ("A nine in the evening scene in Dubai at Kite Beach...") produces accurate time-of-day rendering on DALL·E, Imagen, and Firefly.

### 11.2 Element Ordering (v5.0+)

Each tier has a platform-optimal element ordering based on how its target platforms parse prompts:

**Tier 1 — CLIP-Based:** Weights override position.

```
City::1.3 → (Venue:1.2) → (Activity:1.1) → (Moon:1.2) → (Sky:1.2) → Temp → Wind → Humidity → Time → quality tags → --no
```

Time at position 9 — CLIP tokenises independently, weight values control importance. Time carries no weight marker so sits late. Quality tags (`masterpiece, best quality, 8k`) and negative prompt always trail.

**Tier 2 — Midjourney:** Left-to-right diminishing attention (~60% weight on first clause).

```
Time+City+Venue → Activity → Moon → Sky → Temp → Wind → Humidity → --ar 16:9 --stylize 100
```

Time leads so lighting context frames everything after it. Parameters always go last.

**Tier 3 — Natural Language (DEFAULT):** Parsed like a story.

```
Sentence 1: "A [Time] scene in [City] at [Venue], [Activity]."
Sentence 2: "The sky shows [Sky], creating a [Temp] atmosphere. Under a [Moon]."
Sentence 3: "Ambient conditions include [Wind] and [Humidity]."
Sentence 4: "Photorealistic, highly detailed urban landscape."
```

Time frames the entire image from the first word. Sky + Moon dress the scene. Temperature, wind, humidity close as atmospheric modifiers.

**Tier 4 — Plain Language:** Weakest parsers, keyword-match only.

```
City → Venue → Activity → Time → Sky → Temp → Wind → Humidity → Moon
```

Subject (city + venue + activity) must lead so the model knows WHAT to draw. Time at position 4 — right after the visual subject — gives the best chance of being noticed. Moon last — plain language generators rarely render lunar phases.

**Ordering Matrix:**

| Element  | Tier 1 (CLIP) | Tier 2 (MJ) | Tier 3 (NatLang) | Tier 4 (Plain) |
| -------- | :-----------: | :---------: | :--------------: | :------------: |
| Time     |      9th      |   **1st**   |     **1st**      |    **4th**     |
| City     |      1st      |     1st     |       2nd        |      1st       |
| Venue    |      2nd      |     1st     |       3rd        |      2nd       |
| Activity |      3rd      |     2nd     |       4th        |      3rd       |
| Moon     |      4th      |     3rd     |       6th        | **9th (last)** |
| Sky      |      5th      |     4th     |       5th        |      5th       |
| Temp     |      6th      |     5th     |       7th        |      6th       |
| Wind     |      7th      |     6th     |       8th        |      7th       |
| Humidity |      8th      |     7th     |       9th        |      8th       |

### 11.3 City Scene Model (Venue + Activity)

**File:** `src/data/vocabulary/weather/city-vibes.json` (10,909 lines)

The scene model provides location-specific visual subjects for 83 cities worldwide:

| Metric                   | Count |
| ------------------------ | ----- |
| Cities                   | 83    |
| Total venues             | 830   |
| Total activities         | 6,320 |
| Average venues/city      | 10    |
| Average activities/venue | ~7.6  |

**`getCityScene(city, seed) → { venue, activity } | null`**

1. Looks up city in `CITY_DATA` (exact match, then partial match fallback).
2. Picks a random venue from the city's venue list using the seeded random.
3. Picks a random activity from that venue's activity list.
4. Returns `null` if city has no data (prompt still generates without scene layer).

### 11.4 Vocabulary System

Six JSON vocabulary files in `src/data/vocabulary/weather/`:

| File               | Lines  | Ranges | Phrases | Coverage                                |
| ------------------ | ------ | ------ | ------- | --------------------------------------- |
| `city-vibes.json`  | 10,909 | —      | 7,150   | 83 cities, 830 venues, 6,320 activities |
| `conditions.json`  | 398    | 14     | 280     | 14 weather types (20 phrases each)      |
| `wind.json`        | 471    | 30     | 240     | 0–150+ km/h in 5 km/h bands             |
| `temperature.json` | 327    | 18     | 180     | −40°C to +50°C in 5°C bands             |
| `humidity.json`    | 320    | 20     | 160     | 0–100% in 5% bands                      |
| `time-of-day.json` | 185    | 24     | 120     | 24 hours (5 phrases each)               |

**Total prompt vocabulary: 8,130 phrases + 40 moon phrases = 8,170 items.**

### 11.5 Prompt Composition — 9 Layers

The `generateWeatherPrompt()` function builds a prompt by combining 9 elements:

| Layer | Element      | Source                                                                           |
| ----- | ------------ | -------------------------------------------------------------------------------- |
| 1     | **City**     | Exchange card data                                                               |
| 2     | **Venue**    | `city-vibes.json` → seeded random venue selection                                |
| 3     | **Activity** | That venue's activity list → seeded random (suppressed during quiet hours)       |
| 4     | **Time**     | `time-of-day.json` → 24-hour lookup, 5 phrase rotation                           |
| 5     | **Sky**      | Live: OWM `description` directly. Demo: `conditions.json` phrase via emoji match |
| 6     | **Moon**     | Moon phase calculator → 40 phrases (night only)                                  |
| 7     | **Temp**     | `temperature.json` → range lookup by °C                                          |
| 8     | **Wind**     | `wind.json` → range lookup by km/h                                               |
| 9     | **Humidity** | `humidity.json` → range lookup by percentage                                     |

### 11.6 Sky Source Logic

**`getSkySource(ctx, seed) → string | null`**

Two-path resolution with wind-only filtering:

1. **Live data path:** If `description` exists from OWM API, use it directly as the sky source. Exception: wind-only descriptions (`"windy"`, `"breezy"`, `"gusty"`, `"blustery"`, `"squall"`) return `null` since they describe wind, not sky.
2. **Demo fallback path:** No description → look up emoji in `CONDITION_BY_EMOJI` map → select a phrase from `conditions.json`.

This ensures live data always gets the real OWM sky description with no duplication from the vocabulary files.

### 11.7 Seed & Rotation

```typescript
const twoHourWindow = Math.floor(Date.now() / 7_200_000);
const seed = ctx.tempC * 100 + ctx.humidity * 10 + ctx.windKmh + hour + twoHourWindow;
```

The seeded random (`Math.sin(seed * 9999)`) produces:

- **Deterministic within a 2-hour window** — same conditions + same time → same prompt.
- **Rotation every 2 hours** — `twoHourWindow` changes, re-rolling venue/activity/phrase selection even if weather is unchanged.
- **Weather-sensitive** — any change in temperature, humidity, or wind speed shifts the seed, producing new phrase selections immediately.

### 11.8 Night Integration

When `isNight` is true, the moon phase prompt phrase is injected with tier-specific formatting:

- **Tier 1:** `(moon.promptPhrase:1.2)` — weighted keyword at position 4
- **Tier 2:** `moon.promptPhrase` — plain text at position 3
- **Tier 3:** `"Under a [moon.promptPhrase]."` — sentence clause after sky
- **Tier 4:** `moon.promptPhrase` — plain text at position 9 (last)

### 11.9 Quiet Hours & People Exclusion (v5.2)

**`isQuietHours(weather, localHour) → boolean`**

Two-tier detection:

1. **Live data (precise):** If `sunriseUtc` and `timezoneOffset` are available, calculates whether local time is between midnight (second 0) and the exact sunrise second. No hour truncation — seconds precision.
2. **Fallback (approximate):** `localHour >= 0 && localHour < 6`.

The `quiet` boolean gates two linked behaviours in all 4 tiers:

| Behaviour                 | Quiet hours (midnight → sunrise)                | Active hours (sunrise → midnight)                     |
| ------------------------- | ----------------------------------------------- | ----------------------------------------------------- |
| **Layer 3 activity**      | Suppressed — venue only, no human action        | Present — full venue + activity                       |
| **"No people" directive** | Present — tells generator to render empty scene | Removed — activity describes people, no contradiction |

These two must stay paired. During quiet hours the activity phrase is removed (no "beach volleyball courts packed with players" at 3am), and the "no people" directive reinforces the empty scene so the AI generator doesn't hallucinate figures into the venue. During active hours the activity phrase describes human-scale action, so the "no people" directive is removed to avoid contradicting the activity.

**Per-tier implementation:**

| Tier | Active hours output                                    | Quiet hours output                                                                |
| ---- | ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| 1    | `... --no watermarks logos blurry`                     | `... --no people text watermarks logos blurry`                                    |
| 2    | `... --ar 16:9 --stylize 100`                          | `... --ar 16:9 --stylize 100 --no people text`                                    |
| 3    | `... Photorealistic, highly detailed urban landscape.` | `... Photorealistic, highly detailed urban landscape. No people or text visible.` |
| 4    | `... [moon]`                                           | `... [moon], no people or text visible`                                           |

### 11.10 Context Flags

The prompt builder derives boolean context flags from weather data:

`isStormy`, `isRainy`, `isCold`, `isHot`, `isDry`, `isHumid`, `isWindy`

These are available for synergy-aware phrase selection — e.g. stormy conditions won't pair with calm atmosphere phrases.

### 11.11 Design Decisions

1. **Humidity IS in prompts** — All 4 tiers include humidity phrases. The `humidity.json` vocabulary provides atmosphere descriptors like "near-saturated atmospheric moisture" that add depth without creating physical impossibilities.
2. **No °C/°F in prompts** — Temperature units stripped from all tiers. Prompt generators don't understand temperature notation.
3. **Sky deduplication** — When a live API description exists, it's the sole sky source. Demo fallback uses emoji-based condition phrases instead. Never both.
4. **Wind-only filtering** — OWM descriptions like "windy" and "breezy" are excluded from the sky layer since they describe wind, not visual sky conditions.
5. **Self-contained vocabulary phrases** — Wind phrases end with "air movement", temp phrases end with "ambient temperature" / "air feel" / "thermal intensity". Templates use them as-is without appending extra words.
6. **Activity and "no people" are linked** — Both gated by the same `quiet` boolean. Removing the activity (human action description) while keeping "no people" reinforces the empty scene. Keeping the activity while removing "no people" avoids contradicting the human-scale imagery. They are never mismatched.

---

## 12. Vocabulary Index

**File:** `src/data/vocabulary/index.ts` (481 lines)

Central entry point for all Promagen weather vocabulary. Provides type-safe accessor functions for temperature, humidity, wind, time-of-day, conditions, and city-vibes data. Also provides seeded random selection with optional best-fit weighting for synergy-aware phrase picks.

### 12.1 Type Definitions

The vocabulary index defines TypeScript interfaces matching the JSON data shapes:

```typescript
interface CityVenue {
  name: string;
  activities: string[];
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

interface WindRange {
  min: number;
  max: number;
  label: string;
  phrases: string[];
}
```

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

Every exchange has `latitude` and `longitude` (100% coverage), enabling astronomical sunrise/sunset calculation as fallback for all 89 entries.

---

## 14. File Manifest

### Gateway (Fly.io)

| File                          | Lines | Purpose                                                         |
| ----------------------------- | ----- | --------------------------------------------------------------- |
| `server.ts`                   | 721   | Main gateway server                                             |
| `openweathermap/adapter.ts`   | 393   | OWM API client + response parsing                               |
| `openweathermap/types.ts`     | 386   | Gateway types (`WeatherData`, `BatchId`, `WeatherResponseMeta`) |
| `openweathermap/scheduler.ts` | 403   | 4-batch clock-aligned rotation                                  |
| `openweathermap/budget.ts`    | 379   | Rate limiting + daily budget tracking                           |
| `openweathermap/weather.ts`   | 794   | Main handler, batch city management, MERGE accumulator          |
| `openweathermap/index.ts`     | 107   | Module exports                                                  |

### Frontend — Weather Library

| File                                          | Lines | Purpose                                             |
| --------------------------------------------- | ----- | --------------------------------------------------- |
| `src/lib/weather/weather-prompt-generator.ts` | 970   | 4-tier prompt system v5.2 + moon phase calculator   |
| `src/lib/weather/fetch-weather.ts`            | 244   | Server-side gateway fetch + demo gap-fill           |
| `src/lib/weather/weather-types.ts`            | 252   | Type system (`ExchangeWeatherFull`, colour helpers) |
| `src/lib/weather/sun-calculator.ts`           | 220   | NOAA astronomical sunrise/sunset                    |
| `src/lib/weather/weather.ts`                  | 113   | Shared weather utilities                            |
| `src/lib/weather/exchange-weather.ts`         | 17    | Barrel re-exports                                   |
| `src/hooks/use-weather-prompt-tier.ts`        | 134   | Tier selection hook (Free→Tier 3, Pro→localStorage) |

### Frontend — Vocabulary

| File                           | Lines | Purpose                                              |
| ------------------------------ | ----- | ---------------------------------------------------- |
| `src/data/vocabulary/index.ts` | 481   | Central vocabulary entry point + type-safe accessors |

### Frontend — Components

| File                                                          | Lines | Purpose                                                             |
| ------------------------------------------------------------- | ----- | ------------------------------------------------------------------- |
| `src/components/exchanges/exchange-card.tsx`                  | 639   | Main card component (snap-fit, day/night detection, WeatherSection) |
| `src/components/exchanges/weather/weather-emoji-tooltip.tsx`  | 319   | Emoji tooltip (conditions + moon + sun event)                       |
| `src/components/exchanges/weather/weather-prompt-tooltip.tsx` | 517   | Prompt tooltip (4-tier AI prompts + copy button)                    |
| `src/components/exchanges/types.ts`                           | 171   | Card types (`ExchangeCardData`, `ExchangeWeatherData`)              |
| `src/components/exchanges/adapters.ts`                        | 123   | Data adapters (`toCardData`)                                        |
| `src/components/home/rails/exchange-column.tsx`               | 77    | Exchange column layout (passes promptTier prop)                     |
| `src/components/home/mission-control.tsx`                     | 566   | Home page orchestrator (calls `getDefaultTier()`)                   |
| `src/components/ribbon/commodity-prompt-tooltip.tsx`          | 771   | Commodity prompt tooltip (shares tier system)                       |

### Frontend — Data

| File                                           | Lines  | Purpose                                                    |
| ---------------------------------------------- | ------ | ---------------------------------------------------------- |
| `src/data/exchanges/exchanges.catalog.json`    | —      | 89 exchanges with lat/lon, tz, market hours                |
| `src/data/weather/exchange-weather.demo.ts`    | 907    | Algorithmic demo weather (seasonal + diurnal + conditions) |
| `src/data/vocabulary/weather/city-vibes.json`  | 10,909 | 83 cities, 830 venues, 6,320 activities                    |
| `src/data/vocabulary/weather/conditions.json`  | 398    | 14 weather types, 280 phrases                              |
| `src/data/vocabulary/weather/wind.json`        | 471    | 30 ranges, 240 phrases (0–150+ km/h)                       |
| `src/data/vocabulary/weather/temperature.json` | 327    | 18 ranges, 180 phrases (−40°C to +50°C)                    |
| `src/data/vocabulary/weather/humidity.json`    | 320    | 20 ranges, 160 phrases (0–100%)                            |
| `src/data/vocabulary/weather/time-of-day.json` | 185    | 24 hours, 120 phrases                                      |

### Frontend — API Route

| File                           | Lines | Purpose                          |
| ------------------------------ | ----- | -------------------------------- |
| `src/app/api/weather/route.ts` | 171   | Gateway proxy with cache headers |

---

## 15. Summary of Key Numbers

| Metric                               | Value                                            |
| ------------------------------------ | ------------------------------------------------ |
| Total exchanges                      | 89                                               |
| Exchanges with coordinates           | 89 (100%)                                        |
| Unique API coordinates (after dedup) | 83                                               |
| Batches                              | 4 (A/B/C/D)                                      |
| Refresh cycle per exchange           | Every 4 hours                                    |
| Daily API calls                      | ~498 (within 1,000 free tier)                    |
| Moon phases                          | 8                                                |
| Moon prompt phrases                  | 40 (5 per phase)                                 |
| Prompt tiers                         | 4 (default: Tier 3 Natural Language)             |
| Cities with venue/activity scenes    | 83                                               |
| Total venues                         | 830                                              |
| Total activities                     | 6,320                                            |
| Total prompt vocabulary              | 8,170 items (8,130 JSON + 40 moon)               |
| Vocabulary files                     | 6 (12,610 lines total)                           |
| Prompt generator                     | 970 lines (v5.2)                                 |
| Total weather system code            | ~5,250 lines (frontend) + ~3,200 lines (gateway) |

---

## 16. Version History

| Version | Date        | Changes                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 5.2.0   | 14 Feb 2026 | "No people" directive and activity suppression now linked by `quiet` boolean across all 4 tiers. Tier 4 gains people exclusion during quiet hours. Tier 1/2/3 people exclusion now conditional (was hardcoded unconditionally). Type fixes in `vocabulary/index.ts` — CityVibes interface updated to match venue/activity JSON shape, all `.contextual` accesses made safe via optional chaining, `ConditionEntry` gains optional `label` field. |
| 5.0.0   | 13 Feb 2026 | Default tier 4→3. Tier element ordering rebuilt (time-first for T2/T3, time-last for T1, time-after-subject for T4). Humidity restored to all 4 tiers. Redundant word suffixes removed from templates. city-vibes expanded to 83 cities / 830 venues / 6,320 activities.                                                                                                                                                                         |
| 4.4     | 12 Feb 2026 | Quiet hours midnight→sunrise precision. Hour clamping bug fix. City-vibes activity system rebuild.                                                                                                                                                                                                                                                                                                                                               |
| 3.1.0   | 12 Feb 2026 | Previous authority document version.                                                                                                                                                                                                                                                                                                                                                                                                             |
