# providers-meteorological.md

## Provider Weather Meteorological Tooltip — Authority Document

**Created:** 22 February 2026
**Status:** In Place ✅ (all files deployed, verified working)
**Chat transcripts:** 5 sessions spanning `2026-02-22T00:09` → `2026-02-22T02:06`
**Existing features preserved:** Yes

---

## 1. Purpose

The Provider Weather Meteorological Tooltip displays a rich, physics-accurate weather sentence when a user hovers over the weather/moon emoji beneath each AI provider's flag in the 42-provider leaderboard table. This is the provider-specific counterpart to the exchange card weather tooltips, but with **enhanced data** not present in the exchange version — specifically wind compass direction, gust speeds, and visibility with smart unit selection.

### What It Replaces

Previously, hovering the provider weather emoji showed no tooltip. The weather emoji itself (sun, moon, clouds, etc.) was the only meteorological indicator. Now, hovering reveals a complete meteorological sentence with copy-to-clipboard and text-to-speech (British female voice) capabilities.

---

## 2. Example Output

### Daytime Tooltip

> Scattered clouds over Sydney with a temperature of 28°C / 82°F, with a north-westerly wind of 13 km/h. Humidity is 49%, with visibility at 10 km or 6.2 miles. First quarter moon, currently located high in the northern sky at +58°. Sunset at 17:29.

### Nighttime Tooltip

> Clear over San Francisco with a temperature of 14°C / 58°F, with a south-south-westerly wind of 28 km/h with gusts of up to 37 km/h. Humidity is 63%. First quarter moon, currently located in the south-western, high sky at +54°. Sunrise at 06:52.

### Key Sentence Rules

| Section      | Day                                               | Night                                           |
| ------------ | ------------------------------------------------- | ----------------------------------------------- |
| Description  | Raw OWM description                               | Night-normalised ("sunny" → "Clear")            |
| Temperature  | Always shown (°C / °F)                            | Always shown (°C / °F)                          |
| Wind compass | Shown when `windDegrees` ≠ null and wind > 5 km/h | Same                                            |
| Calm winds   | "with calm winds" when wind ≤ 5 km/h              | Same                                            |
| Gusts        | Shown when `windGustKmh > windKmh × 1.1`          | Same                                            |
| Humidity     | Always shown                                      | Always shown                                    |
| Visibility   | Shown (`km/miles` or `m/yards`)                   | **Hidden** (visibility not meaningful at night) |
| Moon phase   | Phase name + sky position + altitude              | Same                                            |
| Sun event    | "Sunset at HH:MM"                                 | "Sunrise at HH:MM"                              |

---

## 3. Data Pipeline — End to End

The weather data traverses **7 layers** from the OWM API to the rendered tooltip. This section documents every layer and confirms the three critical fields (`windDegrees`, `windGustKmh`, `visibility`) are threaded through each one.

### Layer 1: OpenWeatherMap API → Gateway Adapter

**File:** `gateway/src/openweathermap/adapter.ts` (437 lines)
**Function:** `parseWeatherResponse()` (line 217)

```
OWM JSON → parsed fields → WeatherData object
```

| OWM Field    | Parsed As     | Conversion                    | Null Handling                                         |
| ------------ | ------------- | ----------------------------- | ----------------------------------------------------- |
| `wind.deg`   | `windDegrees` | None (degrees 0–360)          | `null` if not a number                                |
| `wind.gust`  | `windGustKmh` | `× 3.6` (m/s → km/h), rounded | `null` if absent (OWM only sends when gusts detected) |
| `visibility` | `visibility`  | None (metres, 0–10000)        | Defaults to `10000` if missing                        |

**Key code (lines 281–286):**

```typescript
const windDegrees = typeof raw.wind.deg === 'number' ? raw.wind.deg : null;
const windGustKmh = typeof raw.wind.gust === 'number' ? Math.round(raw.wind.gust * 3.6) : null;
```

**Confirmed in place:** ✅ Cross-referenced with `adapter.ts` lines 281–309.

### Layer 2: Gateway Cache → HTTP Response

**File:** `gateway/src/openweathermap/weather.ts` (887 lines)

The parsed `WeatherData` objects are cached via the 4-batch system (A/B/C/D, 25/24/24/24 cities) and served as-is via the `/weather` endpoint. All fields from the adapter pass through without filtering.

**File:** `gateway/src/server.ts` (754 lines)
**Endpoint:** `GET /weather` (line 591)

Returns the full `WeatherData[]` array from cache. No field stripping occurs.

**Confirmed in place:** ✅ Cross-referenced with `weather.ts` `buildResponse()` and `server.ts` line 591.

### Layer 3: Frontend Proxy (Next.js API Route)

**File:** `src/app/api/weather/route.ts` (184 lines)

Pure pass-through proxy. Fetches from gateway, returns JSON as-is. The `WeatherData` interface (line 31) explicitly declares all three fields:

```typescript
interface WeatherData {
  // ... base fields ...
  windDegrees?: number | null; // line 46
  windGustKmh?: number | null; // line 47
  visibility?: number | null; // line 48
}
```

**Confirmed in place:** ✅ No field filtering in proxy.

### Layer 4: SSR Fetch (Server-Side Rendering)

**File:** `src/lib/weather/fetch-weather.ts` (322 lines)
**Function:** `fetchWeatherData()` (line 122)

Converts gateway `GatewayWeatherItem` to `ExchangeWeatherData` via explicit mapping:

```typescript
windDegrees: item.windDegrees ?? undefined,   // line 145
windGustKmh: item.windGustKmh ?? undefined,   // line 146
visibility: item.visibility ?? undefined,       // line 141
```

**Confirmed in place:** ✅ Cross-referenced with `fetch-weather.ts` lines 141–146.

### Layer 5: Client-Side Hook

**File:** `src/hooks/use-weather.ts` (305 lines)
**Interface:** `WeatherData` (exported)

Declares all three fields:

```typescript
windDegrees?: number | null;   // line 43
windGustKmh?: number | null;   // line 45
visibility?: number | null;    // line 47
```

The hook fetches from `/api/weather` and returns `Record<string, WeatherData>`.

**Confirmed in place:** ✅ Cross-referenced with `use-weather.ts` lines 43–47.

### Layer 6: Homepage Client Merge ⚠️ BUG FIX IN THIS CHAT

**File:** `src/components/home/homepage-client.tsx` (527 lines)
**Function:** `liveWeatherIndex` useMemo (line 170)

This is where the **critical bug** was found and fixed. The `liveWeatherIndex` conversion was mapping `useWeather()` data to `ExchangeWeatherData` objects but **omitting three fields**. When the client-side fetch completed, it would overwrite the SSR data (which had all fields) with data missing `windDegrees`, `windGustKmh`, and `visibility`.

**Bug (original lines 173–185):**

```typescript
map.set(id, {
  tempC: w.temperatureC,
  tempF: w.temperatureF,
  emoji: w.emoji,
  condition: w.conditions,
  humidity: w.humidity,
  windKmh: w.windSpeedKmh,
  description: w.description,
  sunriseUtc: w.sunriseUtc ?? undefined,
  sunsetUtc: w.sunsetUtc ?? undefined,
  timezoneOffset: w.timezoneOffset ?? undefined,
  isDayTime: w.isDayTime ?? undefined,
  // ❌ windDegrees — MISSING
  // ❌ windGustKmh — MISSING
  // ❌ visibility — MISSING
});
```

**Fix (lines 173–188, now in place):**

```typescript
map.set(id, {
  tempC: w.temperatureC,
  tempF: w.temperatureF,
  emoji: w.emoji,
  condition: w.conditions,
  humidity: w.humidity,
  windKmh: w.windSpeedKmh,
  description: w.description,
  sunriseUtc: w.sunriseUtc ?? undefined,
  sunsetUtc: w.sunsetUtc ?? undefined,
  timezoneOffset: w.timezoneOffset ?? undefined,
  isDayTime: w.isDayTime ?? undefined,
  windDegrees: w.windDegrees ?? undefined, // ✅ ADDED
  windGustKmh: w.windGustKmh ?? undefined, // ✅ ADDED
  visibility: w.visibility ?? undefined, // ✅ ADDED
});
```

**Why this caused the symptom:** SSR rendered with all fields present → tooltip text generated correctly on server. Then `useWeather()` client hook fetched fresh data → `liveWeatherIndex` merged on top of SSR → overwrote entries without the 3 fields → tooltip re-rendered using new (incomplete) data → took else branches ("with winds of" instead of "with a south-easterly wind of").

**Confirmed fix in place:** ✅ Cross-referenced with `homepage-client.tsx` lines 185–187.

The same file also builds `providerWeatherMap` (line 210) which correctly maps all three fields from `effectiveWeatherIndex`:

```typescript
windDegrees: w.windDegrees ?? null,    // line 228
windGustKmh: w.windGustKmh ?? null,    // line 229
visibility: w.visibility ?? null,       // line 230
```

**Confirmed in place:** ✅

### Layer 7: Provider Cell → Tooltip Component

**File:** `src/components/providers/provider-cell.tsx`

Receives `weatherMap` prop, extracts weather for the provider's `weatherId`, and passes to the tooltip component. For live data (lines 92–97):

```typescript
visibility: w.visibility ?? null,
windDegrees: w.windDegrees ?? null,
windGustKmh: w.windGustKmh ?? null,
```

For demo data (when provider has no live weather), seeded random values are generated (lines 271–298):

```typescript
const demoWindDeg = (seed * 47) % 360; // 0–359°
const demoGustKmh = Math.round(windKmh * (1.2 + (seed % 19) / 60)); // 1.2–1.5× sustained
const demoVisibility = isGoodVisCondition ? 10000 : Math.round(lerp(5000, 8000));
```

Props passed to `<ProviderWeatherEmojiTooltip>` (lines 535–559):

```tsx
<ProviderWeatherEmojiTooltip
  city={...}
  tz={...}
  description={...}
  isNight={...}
  tempC={...}
  tempF={...}
  windKmh={...}
  windDegrees={weatherDisplay.windDegrees}
  windGustKmh={weatherDisplay.windGustKmh}
  humidity={...}
  visibility={weatherDisplay.visibility}
  sunriseUtc={...}
  sunsetUtc={...}
  latitude={...}
  longitude={...}
  tooltipPosition={...}
>
```

**Confirmed in place:** ✅

---

## 4. The Tooltip Component

**File:** `src/components/providers/provider-weather-emoji-tooltip.tsx` (779 lines)
**Component:** `ProviderWeatherEmojiTooltip` (exported, line 576)

### 4.1 Props Interface

```typescript
export interface ProviderWeatherEmojiTooltipProps {
  children: React.ReactNode; // Trigger element (emoji span)
  city: string; // e.g. "San Francisco"
  tz: string; // IANA timezone, e.g. "America/Los_Angeles"
  description: string | null; // OWM description, e.g. "scattered clouds"
  isNight: boolean;
  tempC: number | null;
  tempF: number | null;
  windKmh: number | null;
  windDegrees: number | null; // 0–360, meteorological
  windGustKmh: number | null; // km/h, from OWM wind.gust × 3.6
  humidity: number | null;
  visibility: number | null; // metres, 0–10000
  sunriseUtc?: number | null;
  sunsetUtc?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  tooltipPosition?: 'left' | 'right';
}
```

### 4.2 Helper Functions

| Function                      | Lines   | Purpose                                        |
| ----------------------------- | ------- | ---------------------------------------------- |
| `capitalise()`                | 95–98   | First letter uppercase                         |
| `hexToRgba()`                 | 101–112 | Temperature colour → RGBA for glow effects     |
| `azimuthToDirection()`        | 118–130 | "northern" → "north" for moon position         |
| `degreesToCompass()`          | 137–152 | Wind degrees → 8-sector compass adjective      |
| `windArticle()`               | 158–159 | "a northerly" vs "an easterly"                 |
| `formatVisibility()`          | 167–176 | Smart units: ≥1 km → km/miles, <1 km → m/yards |
| `normaliseNightDescription()` | 182–190 | "sunny" → "Clear" at night                     |
| `buildMoonPositionPhrase()`   | 199–226 | Day/night word order for lunar sky position    |
| `buildEnhancedTooltipText()`  | 264–374 | Main sentence builder (see §4.3)               |

### 4.3 Compass Direction Sectors

`degreesToCompass()` uses 8 sectors of 45° each:

| Degrees | Direction      |
| ------- | -------------- |
| 0 / 360 | northerly      |
| 45      | north-easterly |
| 90      | easterly       |
| 135     | south-easterly |
| 180     | southerly      |
| 225     | south-westerly |
| 270     | westerly       |
| 315     | north-westerly |

Formula: `sectors[Math.round(deg / 45) % 8]`

### 4.4 Visibility Formatting

`formatVisibility()` selects units based on range:

| Range         | Format                 | Example                   |
| ------------- | ---------------------- | ------------------------- |
| ≥ 10,000 m    | Rounded km + miles     | "10 km or 6.2 miles"      |
| 1,000–9,999 m | One decimal km + miles | "5.6 km or 3.5 miles"     |
| < 1,000 m     | Metres + yards         | "800 metres or 875 yards" |

Visibility is **daytime only** — the condition `!isNight && visibility !== null && visibility > 0` gates this section.

### 4.5 Night Description Normalisation

| Input                  | Output                                          |
| ---------------------- | ----------------------------------------------- |
| "sunny"                | "Clear"                                         |
| "clear sky"            | "Clear"                                         |
| "mostly sunny"         | "Mostly clear"                                  |
| "partly sunny"         | "Partly cloudy"                                 |
| Any other with "sunny" | Case-preserved replacement with "clear"/"Clear" |

### 4.6 Gusts — Data-Dependent, Not Day/Night

Gusts appear when `windGustKmh !== null && windGustKmh > windKmh × 1.1`. This is purely data-driven. OpenWeatherMap's `wind.gust` field is **optional** — it is only present in the API response when gusts are actually detected. Many cities will have `windGustKmh: null` regardless of time of day.

The gateway adapter (`adapter.ts` line 285): `typeof raw.wind.gust === 'number' ? Math.round(raw.wind.gust * 3.6) : null`

### 4.7 Tooltip Visual Design

The tooltip renders via `createPortal` to `document.body` to avoid parent clipping. Visual features:

- **Temperature glow:** Border, box-shadow, and radial gradients use the temperature-derived colour (same `getTemperatureColor()` as exchange cards)
- **Fixed width:** 380px
- **Position:** Vertically centred on trigger, opens left or right based on `tooltipPosition` prop
- **Viewport clamping:** Falls back to opposite side if tooltip would overflow
- **400ms close delay:** Allows cursor movement from trigger to tooltip for copy/speak interaction
- **Header:** "Meteorological Data" with temperature glow text-shadow

### 4.8 Interactive Features

| Feature               | Implementation                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Copy button**       | Copies tooltip sentence to clipboard. Emerald tick feedback for 1.5s                                                      |
| **Speaker button**    | British female TTS via `speakText()` from `src/lib/speech.ts`. Purple glow when speaking. Pause icon with `animate-pulse` |
| **Hover persistence** | Both trigger and tooltip have `onMouseEnter`/`onMouseLeave` handlers sharing a `closeTimeoutRef`                          |

---

## 5. Type Definitions

### ExchangeWeatherData (shared type)

**File:** `src/components/exchanges/types.ts` (lines 28–83)

The three fields added in v8.0.0:

```typescript
/** v8.0.0: Wind direction in degrees (0–360). undefined for demo data. */
windDegrees?: number | null;       // line 78
/** v8.0.0: Wind gust speed in km/h. undefined for demo data. */
windGustKmh?: number | null;       // line 80
/** Visibility in metres (0–10000). From OWM visibility via gateway. */
visibility?: number | null;        // line 70
```

### WeatherData (use-weather hook)

**File:** `src/hooks/use-weather.ts` (lines 20–49)

Mirrors the three fields:

```typescript
windDegrees?: number | null;       // line 43
windGustKmh?: number | null;       // line 45
visibility?: number | null;        // line 47
```

### GatewayWeatherItem (SSR fetch)

**File:** `src/lib/weather/fetch-weather.ts` (lines 55–100)

```typescript
windDegrees?: number | null;       // line 96
windGustKmh?: number | null;       // line 98
visibility?: number | null;        // line 88
```

### Gateway WeatherData (backend)

**File:** `gateway/src/openweathermap/types.ts`

```typescript
readonly windDegrees: number | null;   // line 320
readonly windGustKmh: number | null;   // line 326
readonly visibility: number;           // line 293
```

---

## 6. Provider → Weather Mapping

**File:** `src/data/providers/provider-weather-map.ts`
**Coverage:** 42/42 providers mapped (44 entries including 2 duplicates)

### Weather Source Categories

| Category                 | Count      | Weather Source                        |
| ------------------------ | ---------- | ------------------------------------- |
| Provider-specific cities | 25 entries | 15 dedicated `provider-*` weather IDs |
| Exchange-shared cities   | 19 entries | Existing exchange weather IDs         |

### Provider-Specific Weather Cities

**File:** `src/data/providers/provider-weather-cities.json` (15 cities)

| Weather ID               | City          | Providers Using                                                                              |
| ------------------------ | ------------- | -------------------------------------------------------------------------------------------- |
| `provider-san-francisco` | San Francisco | Midjourney, OpenAI, Playground, Lexica, OpenArt, Picsart, DeepAI, BlueWillow, Simplified (9) |
| `provider-mountain-view` | Mountain View | Google Imagen, Hotpot (2)                                                                    |
| `provider-san-jose`      | San Jose      | Adobe Firefly (1)                                                                            |
| `provider-menlo-park`    | Menlo Park    | Imagine Meta (1)                                                                             |
| `provider-seattle`       | Seattle       | Microsoft Designer, Bing (2) — Redmond venues                                                |
| `provider-houston`       | Houston       | Craiyon (1)                                                                                  |
| `provider-austin`        | Austin        | Jasper Art (1)                                                                               |
| `provider-warsaw`        | Warsaw        | GetImg (1)                                                                                   |
| `provider-malaga`        | Málaga        | Freepik (1)                                                                                  |
| `provider-limassol`      | Limassol      | VistaCreate (1)                                                                              |
| `provider-washington-dc` | Washington DC | Visme (1) — Rockville venues                                                                 |
| `provider-sheridan`      | Sheridan      | NovelAI (1)                                                                                  |
| `provider-cairns`        | Cairns        | NightCafe (1)                                                                                |
| `provider-burlington`    | Burlington    | Artistly (1)                                                                                 |
| `provider-freiburg`      | Freiburg      | Flux (1)                                                                                     |

### Exchange-Shared Weather

Providers within 100 km of an existing exchange city reuse that exchange's weather:

| Exchange Weather ID  | City         | Providers                         |
| -------------------- | ------------ | --------------------------------- |
| `lse-london`         | London       | Stability, DreamStudio, Dreamlike |
| `asx-sydney`         | Sydney       | Leonardo, Canva                   |
| `tsx-toronto`        | Toronto      | Ideogram                          |
| `bursa-kuala-lumpur` | Kuala Lumpur | 123RF, Pixlr                      |
| `hkex-hong-kong`     | Hong Kong    | Fotor, ArtGuru, PicWish           |
| `nyse-new-york`      | New York     | Artbreeder, Runway                |
| `euronext-paris`     | Paris        | Clipdrop                          |
| `wbag-vienna`        | Vienna       | Remove.bg                         |
| `twse-taipei`        | Taipei       | MyEdit                            |
| `ase-amman`          | Amman        | Photoleap (Jerusalem, 69 km)      |

---

## 7. Gateway Weather System

### 4-Batch Architecture

**File:** `gateway/src/openweathermap/weather.ts` (887 lines)

Total: 99 city entries (84 exchange + 15 provider), deduplicated to 97 unique API calls.

| Batch | Cities | Timing                           |
| ----- | ------ | -------------------------------- |
| A     | 25     | Immediate on startup             |
| B     | 24     | Immediate after A                |
| C     | 24     | After 35s minute-budget cooldown |
| D     | 24     | Immediate after C                |

Refresh cycle: Clock-aligned at `:10` and `:40` past the hour. Each refresh fetches one batch (rotating A→B→C→D based on `hour % 4`).

### Budget Management

**File:** `gateway/src/openweathermap/budget.ts` (385 lines)

| Limit                  | Value                |
| ---------------------- | -------------------- |
| Daily API calls        | 1,000                |
| Per-minute calls       | 60                   |
| Warmup calls           | 97 (all cities)      |
| Refresh calls per hour | ~24 (one batch)      |
| Daily refresh calls    | ~576 (24 × 24 hours) |

### Gateway Initialisation Retry

**File:** `gateway/src/server.ts` (line 271)

The gateway fetches weather city config from the frontend's `/api/weather/config` SSOT endpoint at startup. A retry mechanism (3 attempts, 2-second delay) was added in this chat to handle cases where the frontend isn't ready yet during local development.

**Confirmed in place:** ✅ Cross-referenced with `server.ts` `initWeatherFromConfig()`.

---

## 8. Difference from Exchange Card Tooltips

| Feature             | Exchange `WeatherEmojiTooltip`                            | Provider `ProviderWeatherEmojiTooltip`                     |
| ------------------- | --------------------------------------------------------- | ---------------------------------------------------------- |
| File                | `exchanges/weather/weather-emoji-tooltip.tsx` (543 lines) | `providers/provider-weather-emoji-tooltip.tsx` (779 lines) |
| Wind compass        | ❌ Not shown                                              | ✅ 8-sector compass direction                              |
| Wind gusts          | ❌ Not shown                                              | ✅ When OWM reports gusts                                  |
| Visibility          | ❌ Not shown                                              | ✅ Smart km/miles or m/yards (daytime only)                |
| Temperature         | ❌ Not in text                                            | ✅ °C / °F in sentence                                     |
| Wind speed          | ❌ Not in text                                            | ✅ km/h in sentence                                        |
| Humidity            | ❌ Not in text                                            | ✅ Percentage in sentence                                  |
| Moon phase          | ✅ Phase + position                                       | ✅ Phase + position (same logic)                           |
| Sun event           | ✅ Sunrise/Sunset                                         | ✅ Sunrise/Sunset (same logic)                             |
| Night normalisation | ✅                                                        | ✅ (same rules)                                            |
| Copy button         | ✅                                                        | ✅                                                         |
| Speaker (TTS)       | ❌                                                        | ✅ British female voice                                    |
| Portal rendering    | ✅                                                        | ✅ (same pattern)                                          |
| Temperature glow    | ✅                                                        | ✅ (same colour function)                                  |

---

## 9. Files Modified in This Chat

### New Files Created

| File                                                          | Lines | Purpose                                                          |
| ------------------------------------------------------------- | ----- | ---------------------------------------------------------------- |
| `src/components/providers/provider-weather-emoji-tooltip.tsx` | 779   | Main tooltip component with enhanced meteorological data and TTS |

### Files Modified

| File                                         | Lines | Change                                                                                                                                                                                             |
| -------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/home/homepage-client.tsx`    | 527   | **BUG FIX:** Added `windDegrees`, `windGustKmh`, `visibility` to `liveWeatherIndex` conversion (lines 185–187). Also added `providerWeatherMap` construction with all three fields (lines 228–230) |
| `src/components/providers/provider-cell.tsx` | —     | Added import of `ProviderWeatherEmojiTooltip`, threading of `windDegrees`/`windGustKmh`/`visibility` from weather map, demo data generation for those fields, JSX wrapping emoji in tooltip. Updated tooltip `city` prop to use `mapping.tooltipCity ?? mapping.vibesCity`. Column 1 now shows `hqCity (tooltipCity)` parenthetical |
| `src/data/providers/provider-weather-map.ts` | —     | Added optional `tooltipCity` field to `ProviderWeatherMapping` interface. Set `tooltipCity: 'Seattle'` for microsoft-designer/bing, `tooltipCity: 'Washington DC'` for visme |
| `src/data/providers/providers.json`          | —     | Fixed Freepik `hqCity` from `MÃ¡laga` (double-encoded UTF-8) to `Málaga` |
| `src/lib/weather/fetch-weather.ts`           | 322   | Added `windDegrees`, `windGustKmh`, `visibility` to SSR conversion mapping                                                                                                                         |
| `src/app/api/weather/route.ts`               | 184   | Added fields to `WeatherData` interface                                                                                                                                                            |
| `src/hooks/use-weather.ts`                   | 305   | Added fields to `WeatherData` interface                                                                                                                                                            |
| `src/components/exchanges/types.ts`          | 187   | Fields already present (added in v8.0.0, predates this chat)                                                                                                                                       |
| `gateway/src/server.ts`                      | 754   | Added retry logic to `initWeatherFromConfig()` for local dev reliability                                                                                                                           |

### Files NOT Modified (already correct)

| File                                              | Lines | Status                                                                   |
| ------------------------------------------------- | ----- | ------------------------------------------------------------------------ |
| `gateway/src/openweathermap/adapter.ts`           | 437   | Already extracts `windDegrees`, `windGustKmh`, `visibility` since v8.0.0 |
| `gateway/src/openweathermap/types.ts`             | 461   | Already declares all three fields                                        |
| `gateway/src/openweathermap/weather.ts`           | 887   | Already passes data through from adapter                                 |
| `src/data/providers/provider-weather-map.ts`      | —     | Already maps 42 providers to weather sources                             |
| `src/data/providers/provider-weather-cities.json` | —     | Already lists 15 provider-specific cities                                |

---

## 10. Diagnostic Code — Cleanup Needed

The following diagnostic `console.debug` statements were added during debugging and should be removed before production deploy:

| File                                 | Tag                                              | Lines   | Count     |
| ------------------------------------ | ------------------------------------------------ | ------- | --------- |
| `provider-weather-emoji-tooltip.tsx` | `[TOOLTIP-BUILD-DIAG]`                           | 281–295 | 1 block   |
| `homepage-client.tsx`                | `[WEATHER-DIAG]`, `[WEATHER-FIELD-DIAG]`         | Various | ~16 lines |
| `provider-cell.tsx`                  | `[PROVIDER-CELL-DIAG]`                           | Various | ~3 lines  |
| `fetch-weather.ts`                   | `[WEATHER-SSR-DIAG]`, `[WEATHER-SSR-FIELD-DIAG]` | Various | ~10 lines |
| `api/weather/route.ts`               | `[WEATHER-API-DIAG]`                             | 119–125 | ~4 lines  |

**Recommended cleanup:** Search for `DIAG` across the codebase and remove all tagged diagnostic blocks. These are clearly delimited with `// ── DIAGNOSTIC` / `// ── END DIAGNOSTIC` comment pairs.

---

## 11. Key Bug: The `liveWeatherIndex` Overwrite

### Symptom

Provider weather tooltips showed basic text ("with winds of 18 km/h. Humidity is 58%.") missing compass direction, gusts, and visibility — despite the gateway sending all data correctly.

### Why It Was Hard to Find

1. **SSR diagnostics showed correct data** — the server-side render had all fields.
2. **Client-side diagnostics inside `buildEnhancedTooltipText()` showed correct data** — because they logged the props received, which were correct on first render (SSR).
3. **The overwrite happened silently** — when `useWeather()` completed its client-side fetch, `liveWeatherIndex` merged on top of SSR data, wiping the three fields. The tooltip re-rendered with the new (incomplete) data, but no diagnostic logged this second render.

### Root Cause

`homepage-client.tsx` line 170: the `liveWeatherIndex` useMemo converted `useWeather()` results to `ExchangeWeatherData` objects but omitted `windDegrees`, `windGustKmh`, and `visibility` from the mapping. These fields existed in the type definition but were simply never assigned.

### Fix

Three lines added to the conversion (lines 185–187):

```typescript
windDegrees: w.windDegrees ?? undefined,
windGustKmh: w.windGustKmh ?? undefined,
visibility: w.visibility ?? undefined,
```

### Verification

After fix: hovering any provider emoji with live weather data shows compass direction ("with a south-south-westerly wind") and visibility ("with visibility at 10 km or 6.2 miles"). Gusts appear when OWM reports them (data-dependent, not day/night-dependent).

---

## 12. Shared Dependencies

| Import                                           | Source                                   | Used For                                         |
| ------------------------------------------------ | ---------------------------------------- | ------------------------------------------------ |
| `getTemperatureColor`                            | `@/lib/weather/weather-types`            | Tooltip glow colour                              |
| `getNextSunEvent`                                | `@/lib/weather/sun-calculator`           | "Sunrise at / Sunset at"                         |
| `getLunarPosition`                               | `@/lib/weather/sun-calculator`           | Moon altitude + azimuth bin                      |
| `getMoonPhase`                                   | `@/lib/weather/weather-prompt-generator` | Moon phase name                                  |
| `speakText`, `stopSpeaking`, `isSpeechSupported` | `@/lib/speech`                           | British female TTS                               |
| `createPortal`                                   | `react-dom`                              | Tooltip renders at `document.body` (no clipping) |

---

## 13. Tooltip City Override (`tooltipCity`)

Three providers have their HQ in a different city from their weather data source. Previously, the tooltip displayed the HQ city name (e.g. "Broken clouds over Rockville") even though the weather data came from a nearby larger city. The `tooltipCity` field resolves this.

### Interface Addition

```typescript
export interface ProviderWeatherMapping {
  readonly weatherId: string;
  readonly vibesCity: string;
  readonly tooltipCity?: string;   // ← NEW: display city for tooltips
  readonly lat: number;
  readonly lon: number;
}
```

### Affected Providers

| Provider | HQ (`hqCity`) | Vibes/Venues (`vibesCity`) | Weather Source (`weatherId`) | Tooltip Shows (`tooltipCity`) | Column 1 Display |
|----------|---------------|---------------------------|------------------------------|-------------------------------|-----------------|
| Microsoft Designer | Redmond | Redmond | `provider-seattle` | Seattle | Redmond (Seattle) |
| Bing Image Creator | Redmond | Redmond | `provider-seattle` | Seattle | Redmond (Seattle) |
| Visme AI | Rockville | Rockville | `provider-washington-dc` | Washington DC | Rockville (Washington DC) |

### Field Hierarchy

- **Tooltip `city` prop** → `mapping.tooltipCity ?? mapping.vibesCity`
- **Column 1 city label** → `provider.hqCity` + parenthetical `(mapping.tooltipCity)` when tooltipCity differs from hqCity
- **Venue vocabulary** → `mapping.vibesCity` (unchanged — Redmond and Rockville venue words stay)

### Málaga Encoding Fix

`providers.json` had `"hqCity": "MÃ¡laga"` (UTF-8 double-encoding of `á`). Fixed to `"hqCity": "Málaga"`. Affects the Freepik provider's column 1 city display.

---

## 14. Testing Checklist

| Test                                              | Expected Result                                      |
| ------------------------------------------------- | ---------------------------------------------------- |
| Hover provider emoji (daytime city)               | Tooltip with compass wind + visibility + humidity    |
| Hover provider emoji (nighttime city)             | Tooltip with compass wind + humidity (no visibility) |
| Hover provider emoji (calm wind ≤ 5 km/h)         | "with calm winds" (no compass)                       |
| Hover provider emoji (no wind degrees from OWM)   | "with winds of X km/h" (no compass)                  |
| Hover provider emoji (gusts reported by OWM)      | "with gusts of up to X km/h"                         |
| Hover provider emoji (no gusts from OWM)          | No gust text                                         |
| Hover provider emoji (visibility < 1 km, daytime) | Shows metres and yards                               |
| Click copy button                                 | Copies full sentence to clipboard, emerald tick      |
| Click speaker button                              | British female TTS reads sentence                    |
| Move cursor from emoji to tooltip                 | Tooltip stays open (400ms delay)                     |
| Move cursor away from tooltip                     | Tooltip closes after 400ms                           |
| Demo provider (no live weather)                   | Seeded random wind direction, gusts, visibility      |
| Hover Microsoft Designer emoji                    | Tooltip says "...over Seattle..." not Redmond        |
| Hover Bing Image Creator emoji                    | Tooltip says "...over Seattle..." not Redmond        |
| Hover Visme AI emoji                              | Tooltip says "...over Washington DC..." not Rockville|
| Column 1: Microsoft Designer                      | Shows "Redmond (Seattle)"                            |
| Column 1: Bing Image Creator                      | Shows "Redmond (Seattle)"                            |
| Column 1: Visme AI                                | Shows "Rockville (Washington DC)"                    |
| Column 1: Freepik                                 | Shows "Málaga" not "MÃ¡laga"                         |
| Hover Midjourney emoji                            | Still "...over San Francisco..." (unchanged)         |
