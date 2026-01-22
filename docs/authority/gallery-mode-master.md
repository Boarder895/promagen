# Promagen Gallery Mode — Master Specification

**Version:** 2.1.0  
**Last Updated:** 18 January 2026  
**Owner:** Promagen  
**Authority:** This is the single source of truth for the Gallery Mode feature.

---

## Executive Summary

Gallery Mode transforms Promagen from a "dashboard that shows market data" into a "living artefact where the markets literally paint." It's a Pro-only screensaver experience that:

1. **Cycles through 79 exchange cities** on a 10-minute cadence (~13h before repeating)
2. **Generates AI images** reflecting city mood, time-of-day, season, and market sentiment
3. **Educates users** by exposing 4 prompt variants (one per AI provider tier) with copy buttons
4. **Stores everything** in an image library with full reproducibility metadata
5. **NEW (v2.1.0):** Allows Pro users to filter displayed providers via selectable dropdown

**This is a saleability multiplier.** It creates a premium visual experience that justifies Pro pricing, demonstrates Promagen's market data integration, and teaches prompt engineering through passive observation.

---

## Changelog

| Version   | Date        | Changes                                                                                                                                       |
| --------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **2.1.0** | 18 Jan 2026 | Added AI Provider Selector feature (§16). Added Weather API live implementation plan (§6). Added Market Mood Engine implementation plan (§7). |
| 2.0.0     | 18 Jan 2026 | Comprehensive master specification created.                                                                                                   |
| 1.0.0     | 8 Jan 2026  | Initial Gallery Mode concept document.                                                                                                        |

---

## 1. What Already Exists (Your Foundation is Strong)

You have already built 90% of the intelligence layer needed. This is not a from-scratch build.

### 1.1 Exchanges SSOT (exchanges_catalog.json)

**79 exchanges** with rich metadata:

| Field                | Example         | Gallery Mode Use                |
| -------------------- | --------------- | ------------------------------- |
| `id`                 | `tse-tokyo`     | Unique identifier for rotation  |
| `city`               | `Tokyo`         | Image subject anchor            |
| `country`            | `Japan`         | Flag, cultural context          |
| `tz`                 | `Asia/Tokyo`    | Calculate local time, day/night |
| `longitude/latitude` | `139.65, 35.68` | Sunrise/sunset calculation      |
| `hemisphere`         | `NE`            | Season derivation (NE/SE/NW/SW) |
| `hoverColor`         | `#FF4500`       | Visual theming consistency      |

**World Tour Math:**

- 79 exchanges × 10 minutes = 790 minutes
- 790 ÷ 60 = **13 hours 10 minutes** before repetition
- With enrichments (time-of-day, season, mood), same city looks different each cycle

### 1.2 Prompt Intelligence System

**Already built:**

| File                  | Size  | Contents                                                                      |
| --------------------- | ----- | ----------------------------------------------------------------------------- |
| `semantic-tags.json`  | 412KB | **2,045 tagged options** with categories, moods, and "suggests" relationships |
| `market-moods.json`   | 5KB   | Market state → emotion/visual translation (exactly what Gallery needs)        |
| `platform-hints.json` | 19KB  | **4-tier prompt conversion** with syntax preferences per platform             |
| `conflicts.json`      | 28KB  | What terms can't be combined (prevents incoherent prompts)                    |
| `families.json`       | 15KB  | Groupings for thematic coherence                                              |

**The market-moods.json is purpose-built for this:**

```json
{
  "gold_rising": {
    "trigger": "Gold price rising >1% in session",
    "boost": {
      "colour": ["golden", "warm", "amber", "honey", "brass", "bronze"],
      "atmosphere": ["opulent", "rich", "prestigious", "luxurious", "warm"],
      "materials": ["gold", "metallic", "gilded", "luxurious", "ornate"],
      "lighting": ["warm", "golden", "glowing", "rich"]
    },
    "boostWeight": 1.25
  }
}
```

**This means:** When gold is up, Tokyo's image gets warmer, more golden, more opulent — without ever mentioning "gold price" in the prompt.

### 1.3 Platform Hints (4-Tier Prompt Variants)

Already defined per platform:

| Tier  | Style                         | Examples                | Syntax                        |
| ----- | ----------------------------- | ----------------------- | ----------------------------- |
| **1** | CLIP-Based (keyword stacking) | Stable Diffusion, Flux  | `::1.5` weights, `(term:1.3)` |
| **2** | Midjourney Family             | Midjourney, Niji        | `--no` negatives, parameters  |
| **3** | Natural Language              | DALL·E, Imagen, Firefly | Conversational sentences      |
| **4** | Plain Language                | Craiyon, Artbreeder     | Simple, focused prompts       |

**This means:** One Scene Brief → 4 deterministic prompt renderings → 4 copy buttons.

### 1.4 Weather API (90% Built)

**Current State:**

| Component              | Status           | Location                                            |
| ---------------------- | ---------------- | --------------------------------------------------- |
| Visual Crossing Client | ✅ Built         | `src/lib/weather/weather-client.ts`                 |
| Weather Route          | ✅ Built         | `src/app/api/weather/route.ts`                      |
| Demo Mode              | ✅ Working       | Default behaviour                                   |
| Live Mode              | ⏳ Needs env var | Set `WEATHER_MODE=live` + `VISUAL_CROSSING_API_KEY` |
| Caching                | ✅ Built         | In-memory with configurable TTL                     |

**What's Missing:**

- Environment variable configuration for production
- Connection to Gallery Mode theme engine

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        GALLERY MODE SYSTEM                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │   ROTATION   │    │    THEME     │    │   PROMPT     │          │
│  │   ENGINE     │───▶│    ENGINE    │───▶│   BUILDER    │          │
│  │              │    │              │    │              │          │
│  │ • Exchange   │    │ • City snap  │    │ • Scene brief│          │
│  │   playlist   │    │ • Local time │    │ • Caps enf.  │          │
│  │ • SSOT order │    │ • Season     │    │ • Conflicts  │          │
│  │ • Pointer    │    │ • Market mood│    │ • 4 variants │          │
│  │              │    │ • Weather    │    │              │          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
│         │                   │                   │                   │
│         │                   │                   ▼                   │
│         │                   │          ┌──────────────┐            │
│         │                   │          │  GENERATOR   │            │
│         │                   │          │              │            │
│         │                   │          │ • API call   │            │
│         │                   │          │ • Rate limit │            │
│         │                   │          │ • Fallback   │            │
│         │                   │          └──────────────┘            │
│         │                   │                   │                   │
│         ▼                   ▼                   ▼                   │
│  ┌─────────────────────────────────────────────────────┐           │
│  │                     STORAGE                          │           │
│  │  • Image file (R2/S3)                               │           │
│  │  • 4 prompts (canonical + 3 variants)               │           │
│  │  • Scene brief JSON                                 │           │
│  │  • Provenance metadata                              │           │
│  └─────────────────────────────────────────────────────┘           │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────┐           │
│  │                     DISPLAY                          │           │
│  │  • Toggle: Providers | Gallery (Pro)                │           │
│  │  • Crossfade slideshow                              │           │
│  │  • Metadata overlay                                 │           │
│  │  • 4 copy buttons                                   │           │
│  │  • Screensaver mode                                 │           │
│  │  • AI Provider Selector (Pro, 1-3 in Gallery)       │  ◀── NEW │
│  └─────────────────────────────────────────────────────┘           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Rotation Engine

### 3.1 Playlist Source (Free vs Pro)

Following the same SSOT pattern as the rest of Promagen:

| Tier     | Playlist Source                        | Behaviour                                        |
| -------- | -------------------------------------- | ------------------------------------------------ |
| **Free** | `exchanges.selected.json` (curated 16) | Fixed rotation through curated set               |
| **Pro**  | User's Clerk metadata selection        | Personal rotation through their chosen exchanges |

**Hard rule:** Gallery never invents cities outside the SSOT catalog.

### 3.2 Rotation Modes

| Mode             | Description                               | When to Use                       |
| ---------------- | ----------------------------------------- | --------------------------------- |
| **SSOT Order**   | Follow catalog order exactly              | MVP — simplest, predictable       |
| **East-to-West** | Sort by timezone offset (UTC+14 → UTC-12) | Follows the trading day naturally |
| **Random**       | Shuffle playlist on each complete cycle   | Prevents predictability fatigue   |

**MVP:** Start with SSOT Order. Add East-to-West in Phase 2.

### 3.3 Pointer State

```typescript
interface RotationState {
  currentIndex: number; // Position in playlist
  lastAdvancedAt: string; // ISO timestamp
  playlistVersion: string; // Hash of playlist (detects changes)
  mode: 'ssot' | 'east-west' | 'random';
}
```

**Persistence:** Vercel KV or Postgres. Single global state (not per-user).

---

## 4. Theme Engine

### 4.1 CitySnapshot

For each exchange, build a snapshot of current conditions:

```typescript
interface CitySnapshot {
  // From SSOT
  exchangeId: string;
  city: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  hemisphere: 'NE' | 'NW' | 'SE' | 'SW';
  hoverColor: string;

  // Computed
  localTime: Date;
  timeOfDay: 'dawn' | 'morning' | 'midday' | 'afternoon' | 'dusk' | 'night';
  season: 'spring' | 'summer' | 'autumn' | 'winter';
  isMarketOpen: boolean;
  minutesToOpen: number | null;
  minutesToClose: number | null;

  // Optional enrichments
  weather?: {
    conditions: string;
    temperatureC: number;
    emoji: string;
  };
  cosmicEvent?: string; // "Full Moon", "Solar Eclipse", etc.

  // Market mood (derived from live data)
  mood: MarketMood;
}
```

### 4.2 Time-of-Day Derivation

```typescript
function getTimeOfDay(localHour: number): TimeOfDay {
  if (localHour >= 5 && localHour < 7) return 'dawn';
  if (localHour >= 7 && localHour < 12) return 'morning';
  if (localHour >= 12 && localHour < 14) return 'midday';
  if (localHour >= 14 && localHour < 17) return 'afternoon';
  if (localHour >= 17 && localHour < 20) return 'dusk';
  return 'night';
}
```

### 4.3 Season Derivation

Based on hemisphere and current month:

| Hemisphere | Dec-Feb | Mar-May | Jun-Aug | Sep-Nov |
| ---------- | ------- | ------- | ------- | ------- |
| NE/NW      | winter  | spring  | summer  | autumn  |
| SE/SW      | summer  | autumn  | winter  | spring  |

---

## 5. Prompt Builder

### 5.1 Scene Brief

The prompt builder creates a structured Scene Brief:

```typescript
interface SceneBrief {
  // Required (always present)
  anchor: string; // City landmark or skyline
  lighting: string; // Single descriptor
  style: string; // Single profile from semantic-tags
  camera: string; // Single angle

  // Optional (caps enforced)
  atmosphere: string[]; // Max 3
  hook?: string; // Max 1 (cosmic event, cultural moment)
  motifs: string[]; // Max 2 (seasonal, cultural)

  // Always included
  constraints: string; // "No text, no logos"
  negativePrompt: string; // Platform-appropriate negatives
}
```

### 5.2 Caps Enforcement

| Category   | Cap | Rationale                            |
| ---------- | --- | ------------------------------------ |
| Anchor     | 1   | Single focal point                   |
| Lighting   | 1   | Prevents contradictory light sources |
| Style      | 1   | Coherent aesthetic                   |
| Camera     | 1   | Single perspective                   |
| Atmosphere | 3   | Allows mood layering                 |
| Hook       | 1   | Single special element               |
| Motifs     | 2   | Cultural/seasonal touches            |

### 5.3 Template Order

Fixed assembly order prevents prompt drift:

1. Anchor (city/landmark)
2. Lighting (single descriptor)
3. Atmosphere (max 3)
4. Hook if present (event/cosmic)
5. Motifs (max 2)
6. Style (single profile)
7. Camera (single angle)
8. Constraints ("No text")

### 5.4 4-Tier Rendering

One Scene Brief renders to 4 deterministic formats:

**Tier 1 — CLIP-Based (Stable Diffusion, Flux):**

```
Tokyo skyline at twilight::1.3, golden hour light, serene, contemplative, peaceful, cherry blossom season, (Mount Fuji background:1.2), cinematic photography style, wide angle lens --no text logos watermarks
```

**Tier 2 — Midjourney Family:**

```
Tokyo skyline at twilight, golden hour light, serene contemplative peaceful atmosphere, cherry blossom season, Mount Fuji in background, cinematic photography, wide angle --ar 16:9 --no text logos watermarks
```

**Tier 3 — Natural Language (DALL·E):**

```
A serene photograph of the Tokyo skyline at twilight during cherry blossom season. The scene is bathed in golden hour light with Mount Fuji visible in the background. The atmosphere is contemplative and peaceful. Shot in a cinematic style with a wide angle lens. No text or logos.
```

**Tier 4 — Plain Language:**

```
Tokyo skyline at sunset with cherry blossoms, golden light, Mount Fuji in background, peaceful mood, wide angle photo
```

### 5.5 Negative Prompt

Always included, platform-appropriate:

```typescript
const NEGATIVE_PROMPTS = {
  universal: 'text, logos, watermarks, words, letters, signatures',
  safety: 'political symbols, gore, explicit content, nudity',
  quality: 'distorted faces, extra limbs, blurry, low quality',
};
```

---

## 6. Weather API Implementation (v2.1.0)

### 6.1 Current State

The weather infrastructure is **90% built**. Here's what exists:

| File                                  | Purpose                                 | Status      |
| ------------------------------------- | --------------------------------------- | ----------- |
| `src/lib/weather/weather-client.ts`   | Visual Crossing API client with caching | ✅ Complete |
| `src/lib/weather/weather.ts`          | Weather type definitions and helpers    | ✅ Complete |
| `src/lib/weather/exchange-weather.ts` | Demo data for testing                   | ✅ Complete |
| `src/app/api/weather/route.ts`        | API endpoint with demo/live modes       | ✅ Complete |

### 6.2 What Needs to Happen

**Step 1: Environment Configuration**

Add to Vercel environment variables:

```
WEATHER_MODE=live
VISUAL_CROSSING_API_KEY=your_api_key_here
```

**Step 2: Verify API Key**

Visual Crossing free tier provides:

- 1,000 requests/day
- Current conditions + 15-day forecast
- All 79 exchange cities covered

At 10-minute Gallery rotation (144 images/day), we need ~144 weather calls/day = well within free tier.

**Step 3: Connect to Theme Engine**

The Theme Engine needs to call the weather API when building CitySnapshot:

```typescript
// In theme-engine.ts
async function buildCitySnapshot(exchange: Exchange): Promise<CitySnapshot> {
  // ... existing code ...

  // Fetch weather (cached, so safe to call frequently)
  const weatherResponse = await fetch('/api/weather');
  const allWeather = await weatherResponse.json();
  const cityWeather = allWeather.find((w) => w.id === exchange.id);

  return {
    // ... existing fields ...
    weather: cityWeather
      ? {
          conditions: cityWeather.conditions,
          temperatureC: cityWeather.temperatureC,
          emoji: cityWeather.emoji,
        }
      : undefined,
  };
}
```

### 6.3 Weather → Prompt Influence

Weather affects atmosphere selection in Scene Brief:

| Weather Condition | Atmosphere Boost                              |
| ----------------- | --------------------------------------------- |
| Rain, Drizzle     | `moody`, `reflective`, `wet`, `glistening`    |
| Storm, Thunder    | `dramatic`, `intense`, `electric`, `dark`     |
| Snow              | `serene`, `quiet`, `pristine`, `cold`         |
| Fog, Mist         | `mysterious`, `ethereal`, `soft`, `diffused`  |
| Clear, Sunny      | `vibrant`, `bright`, `warm`, `clear`          |
| Cloudy            | `overcast`, `muted`, `soft light`, `diffused` |

**Implementation:**

```typescript
function weatherToAtmosphere(conditions: string): string[] {
  const lower = conditions.toLowerCase();

  if (lower.includes('storm') || lower.includes('thunder')) {
    return ['dramatic', 'intense', 'electric'];
  }
  if (lower.includes('rain') || lower.includes('drizzle')) {
    return ['moody', 'reflective', 'glistening'];
  }
  if (lower.includes('snow')) {
    return ['serene', 'pristine', 'cold'];
  }
  if (lower.includes('fog') || lower.includes('mist')) {
    return ['mysterious', 'ethereal', 'diffused'];
  }
  if (lower.includes('cloud')) {
    return ['overcast', 'soft light'];
  }
  // Default: clear/sunny
  return ['vibrant', 'bright', 'warm'];
}
```

### 6.4 Cost Analysis

| Item                      | Cost                                     |
| ------------------------- | ---------------------------------------- |
| Visual Crossing Free Tier | $0/month (1,000 calls/day)               |
| If exceeds free tier      | $0.0001/call (~$4.32/month at max usage) |

**Verdict:** Weather API adds zero cost for Gallery Mode usage.

---

## 7. Market Mood Engine Implementation (v2.1.0)

### 7.1 Current State

**Data Ready, Logic Missing.**

The `market-moods.json` file defines 11 mood types with triggers and boost values:

```json
{
  "moods": {
    "market_opening": { "trigger": "Exchange opening within ±2 minutes", ... },
    "market_closing": { "trigger": "Exchange closing within ±2 minutes", ... },
    "high_volatility": { "trigger": "FX pair volatility exceeds 1.5x daily average", ... },
    "low_volatility": { "trigger": "FX pair volatility below 0.5x daily average", ... },
    "currency_strength_usd": { "trigger": "USD strengthening >0.5% against basket", ... },
    "currency_strength_gbp": { "trigger": "GBP strengthening >0.5% against basket", ... },
    "currency_strength_eur": { "trigger": "EUR strengthening >0.5% against basket", ... },
    "gold_rising": { "trigger": "Gold price rising >1% in session", ... },
    "gold_falling": { "trigger": "Gold price falling >1% in session", ... },
    "crypto_pumping": { "trigger": "BTC/ETH rising >5% in 24h", ... },
    "neutral": { "trigger": "Default state when no significant market events", ... }
  }
}
```

### 7.2 What Needs Building

**Market Mood Detection Engine** (`src/lib/gallery/market-mood-engine.ts`)

This engine evaluates live market data and returns the active mood(s):

```typescript
interface MarketMoodResult {
  primary: MoodType; // Single dominant mood
  secondary: MoodType | null; // Optional secondary mood
  boostWeight: number; // From market-moods.json
  boosts: MoodBoosts; // colour, atmosphere, lighting, etc.
}

interface MarketContext {
  exchange: Exchange;
  localTime: Date;
  fxData?: FXQuote[]; // From /api/fx
  cryptoData?: CryptoQuote[]; // From /api/crypto
  commodityData?: CommodityQuote[]; // From /api/commodities
}

function detectMarketMood(context: MarketContext): MarketMoodResult {
  // Priority order (highest specificity first):
  // 1. Market opening/closing (time-based, exchange-specific)
  // 2. Gold rising/falling (commodity signal)
  // 3. Crypto pumping (crypto signal)
  // 4. Currency strength (FX signal)
  // 5. Volatility (calculated from FX data)
  // 6. Neutral (fallback)
  // ... implementation ...
}
```

### 7.3 Data Sources for Mood Detection

| Mood Type                        | Data Source                   | API Endpoint                           |
| -------------------------------- | ----------------------------- | -------------------------------------- |
| market_opening / market_closing  | Exchange hours + current time | `exchanges_catalog.json` + server time |
| high_volatility / low_volatility | FX pair price changes         | `/api/fx` (already exists)             |
| currency*strength*\*             | FX pairs vs basket            | `/api/fx`                              |
| gold_rising / gold_falling       | Gold commodity price          | `/api/commodities` (already exists)    |
| crypto_pumping                   | BTC/ETH 24h change            | `/api/crypto` (already exists)         |

**All data sources already exist.** The engine just needs to:

1. Fetch relevant endpoints
2. Evaluate trigger conditions
3. Return matching mood(s)

### 7.4 Mood → Prompt Integration

The detected mood influences Scene Brief construction:

```typescript
function buildSceneBrief(snapshot: CitySnapshot, mood: MarketMoodResult): SceneBrief {
  const baseAtmosphere = getTimeBasedAtmosphere(snapshot.timeOfDay);
  const weatherAtmosphere = weatherToAtmosphere(snapshot.weather?.conditions);

  // Mood boosts override/enhance atmosphere
  const moodAtmosphere = mood.boosts.atmosphere || [];

  // Combine with caps enforcement
  const atmosphere = dedupeAndCap(
    [...baseAtmosphere, ...weatherAtmosphere, ...moodAtmosphere],
    3, // Max 3 atmosphere terms
  );

  // Similar for lighting, colour, style...
  const lighting = mood.boosts.lighting?.[0] || getTimeBasedLighting(snapshot.timeOfDay);

  return {
    anchor: getCityAnchor(snapshot.city),
    lighting,
    atmosphere,
    // ...
  };
}
```

### 7.5 Mood Priority Matrix

When multiple moods could apply, use this priority:

| Priority | Mood Type                       | Rationale                                |
| -------- | ------------------------------- | ---------------------------------------- |
| 1        | market_opening / market_closing | Time-specific, most visually distinctive |
| 2        | crypto_pumping                  | Rare, dramatic, memorable                |
| 3        | gold_rising / gold_falling      | Clear visual translation                 |
| 4        | high_volatility                 | Creates dramatic visuals                 |
| 5        | currency*strength*\*            | Subtle but meaningful                    |
| 6        | low_volatility                  | Peaceful scenes                          |
| 7        | neutral                         | Fallback                                 |

---

## 8. Image Generation

### 8.1 Provider

**MVP:** DALL·E 3 via OpenAI API

| Aspect        | Choice           | Rationale                       |
| ------------- | ---------------- | ------------------------------- |
| Provider      | DALL·E 3         | Reliable, consistent, safe      |
| Size          | 1792×1024 (16:9) | Widescreen, good for slideshows |
| Quality       | Standard         | $0.04/image, sufficient quality |
| Safety filter | Enabled          | Mandatory for public display    |

### 8.2 API Call

```typescript
async function generateGalleryImage(
  sceneBrief: SceneBrief,
  tier3Prompt: string,
): Promise<GenerationResult> {
  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt: tier3Prompt, // Natural language works best for DALL·E
    n: 1,
    size: '1792x1024',
    quality: 'standard',
    style: 'vivid', // or 'natural' based on mood
  });

  return {
    imageUrl: response.data[0].url,
    revisedPrompt: response.data[0].revised_prompt,
  };
}
```

### 8.3 Failure Handling

```typescript
async function generateWithRetry(
  sceneBrief: SceneBrief,
  maxRetries: number = 1,
): Promise<GenerationResult | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await generateGalleryImage(sceneBrief);
    } catch (error) {
      if (attempt === maxRetries) {
        console.error('Generation failed after retries', error);
        return null; // Will use last-known-good image
      }
      await sleep(1000 * (attempt + 1)); // Backoff
    }
  }
  return null;
}
```

---

## 9. Storage

### 9.1 Split Storage Model

| Data Type      | Storage   | Rationale                  |
| -------------- | --------- | -------------------------- |
| Image files    | R2/S3     | CDN-cached, low latency    |
| Metadata       | Postgres  | Queryable, relational      |
| Rotation state | Vercel KV | Fast reads, atomic updates |

### 9.2 Database Schema

```sql
CREATE TABLE gallery_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Image reference
  image_url TEXT NOT NULL,
  image_key TEXT NOT NULL,  -- R2/S3 key

  -- Exchange/city
  exchange_id TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  country_code TEXT NOT NULL,

  -- Context at generation time
  local_time TIMESTAMPTZ NOT NULL,
  season TEXT NOT NULL,
  time_phase TEXT NOT NULL,  -- dawn/morning/midday/etc.

  -- Mood
  mood_primary TEXT NOT NULL,
  mood_secondary TEXT,
  mood_source TEXT,  -- What triggered this mood

  -- Prompts (all 4 variants)
  prompts JSONB NOT NULL,
  -- { tier1: "...", tier2: "...", tier3: "...", tier4: "..." }

  -- Scene brief (for reproducibility)
  scene_brief JSONB NOT NULL,

  -- Provenance
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generator_model TEXT NOT NULL DEFAULT 'dall-e-3',
  revised_prompt TEXT,  -- DALL·E's actual prompt

  -- Full snapshot for debugging
  snapshot JSONB NOT NULL,

  -- SSOT version (detects catalog changes)
  ssot_version TEXT NOT NULL,

  -- De-duplication
  fingerprint TEXT NOT NULL  -- Hash of scene brief
);

-- Indexes
CREATE INDEX idx_gallery_city ON gallery_images(city);
CREATE INDEX idx_gallery_season ON gallery_images(season);
CREATE INDEX idx_gallery_mood ON gallery_images(mood_primary);
CREATE INDEX idx_gallery_generated ON gallery_images(generated_at DESC);
CREATE UNIQUE INDEX idx_gallery_fingerprint_24h ON gallery_images(fingerprint, generated_at)
  WHERE generated_at > NOW() - INTERVAL '24 hours';
```

### 9.3 Image Naming

```
/gallery/{year}/{month}/{day}/{exchange-id}-{timestamp}.webp

Example:
/gallery/2026/01/18/tse-tokyo-1737225600.webp
```

**Format:** WebP, 1792×1024, ~100-200KB after optimization.

---

## 10. Cost Analysis

### 10.1 DALL·E 3 Costs

At 10-minute cadence (144 images/day):

| Item             | Calculation       | Monthly Cost |
| ---------------- | ----------------- | ------------ |
| Images generated | 144/day × 30 days | 4,320 images |
| Cost per image   | $0.04 (standard)  | —            |
| **DALL·E total** | 4,320 × $0.04     | **$172.80**  |

### 10.2 Storage Costs

| Item           | Calculation     | Monthly Cost |
| -------------- | --------------- | ------------ |
| Images/month   | 4,320           | —            |
| Size per image | ~150KB average  | —            |
| Total storage  | 648MB/month     | —            |
| R2 storage     | First 10GB free | **$0**       |
| R2 egress      | First 10GB free | **$0**       |

### 10.3 Weather API Costs

| Item            | Calculation          | Monthly Cost |
| --------------- | -------------------- | ------------ |
| Visual Crossing | Free tier (1000/day) | **$0**       |

### 10.4 Total Monthly Cost

| Component   | Cost      |
| ----------- | --------- |
| DALL·E 3    | $172.80   |
| R2 Storage  | $0        |
| Weather API | $0        |
| **Total**   | **~$175** |

### 10.5 Break-Even Analysis

At $9/month Pro pricing:

- Break-even: 20 Pro subscribers
- With 50 Pro: $450 revenue vs $175 cost = $275 profit/month

---

## 11. Frontend Implementation

### 11.1 Toggle Component

```
┌─────────────────────────────────────────────────────────────────┐
│  [Providers] [Gallery 🎨]        ◀── Toggle (Pro badge on Gallery)
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                                                           │ │
│  │              [Current View Content]                       │ │
│  │                                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 11.2 Gallery States

| User Tier | Toggle State | Display                        |
| --------- | ------------ | ------------------------------ |
| Free      | Providers    | Leaderboard (normal)           |
| Free      | Gallery      | Upsell panel (blurred preview) |
| Pro       | Providers    | Leaderboard (normal)           |
| Pro       | Gallery      | Live slideshow                 |

### 11.3 Slideshow Overlay

Non-intrusive metadata overlay:

```
┌─────────────────────────────────────────────────────────────────┐
│                                              [CLIP] [MJ] [DE] [Simple]
│                                                                 │
│                                                                 │
│                     [AI Generated Image]                        │
│                                                                 │
│                                                                 │
│  Tokyo • TSE • 14:32 JST • Serene                              │
└─────────────────────────────────────────────────────────────────┘
```

**Elements:**

| Position     | Element                | Behaviour                   |
| ------------ | ---------------------- | --------------------------- |
| Top right    | Copy buttons (4)       | Copies tier-specific prompt |
| Bottom left  | City • Exchange • Time | Fades in/out with image     |
| Bottom right | Mood tag               | Shows primary mood          |

### 11.4 Crossfade Animation

```css
.gallery-image {
  transition: opacity 1.5s ease-in-out;
}

.gallery-image.entering {
  opacity: 0;
}

.gallery-image.visible {
  opacity: 1;
}

.gallery-image.exiting {
  opacity: 0;
}
```

---

## 12. API Endpoints

### 12.1 Current Gallery Image

```typescript
// GET /api/gallery/current
// Returns the current global image + all 4 prompts

interface GalleryCurrentResponse {
  image: {
    url: string;
    city: string;
    country: string;
    countryCode: string;
    localTime: string;
    season: string;
    mood: string;
  };
  prompts: {
    tier1: string; // CLIP-based
    tier2: string; // Midjourney
    tier3: string; // Natural language
    tier4: string; // Plain language
  };
  meta: {
    generatedAt: string;
    nextRotationAt: string;
    exchangeId: string;
  };
}
```

### 12.2 Gallery Library

```typescript
// GET /api/gallery/library?city=Tokyo&mood=serene&limit=20
// Returns paginated library of past images

interface GalleryLibraryResponse {
  images: Array<{
    id: string;
    thumbnailUrl: string;
    fullUrl: string;
    city: string;
    season: string;
    mood: string;
    generatedAt: string;
  }>;
  pagination: {
    total: number;
    page: number;
    hasMore: boolean;
  };
}
```

### 12.3 Rotation Status

```typescript
// GET /api/gallery/status
// Returns current rotation state (for debugging/admin)

interface RotationStatus {
  currentExchange: string;
  currentIndex: number;
  totalExchanges: number;
  lastGeneratedAt: string;
  nextGenerationAt: string;
  isGenerating: boolean;
}
```

---

## 13. Saleability Impact

### 13.1 Why This Matters

| Benefit                     | Impact                                              |
| --------------------------- | --------------------------------------------------- |
| **Visual differentiation**  | No competitor has "markets that paint"              |
| **Pro value justification** | Screensaver + prompt education is premium           |
| **Engagement**              | Passive viewing increases time-on-site              |
| **Education flywheel**      | Users learn prompting → use prompt builder → return |
| **Content marketing**       | Generated images can be shared on social            |

### 13.2 Upsell Opportunities

```
┌─────────────────────────────────────────────────────────────────┐
│                     🎨 Gallery Mode                              │
│                                                                 │
│     Watch the markets paint the world.                          │
│                                                                 │
│     ✓ Live AI-generated city scenes                            │
│     ✓ 4 copyable prompt variants                               │
│     ✓ Learn prompt engineering passively                       │
│     ✓ Full image library access                                │
│                                                                 │
│              [Upgrade to Pro — $9/month]                        │
│                                                                 │
│     [Preview: blurred image with watermark]                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 14. Acceptance Criteria (Definition of Done)

### 14.1 Functional

- [ ] Toggle works: Providers ↔ Gallery
- [ ] Pro gating correct: free sees upsell, Pro sees gallery
- [ ] World tour uses SSOT exchange list
- [ ] Rotation advances every 10 minutes
- [ ] New image generated each cycle
- [ ] 4 prompt variants available via copy buttons
- [ ] Weather data integrated (live mode enabled)
- [ ] Market mood detection working
- [ ] AI Provider Selector works (Pro only, 1-3 limit in Gallery)

### 14.2 Prompt Correctness

- [ ] Prompts contain **no financial terms**
- [ ] Mood mapping correctly applied
- [ ] Weather influences atmosphere selection
- [ ] Caps enforced (1 anchor, 1 style, 1 camera, ≤3 atmosphere, ≤1 hook, ≤2 motifs)
- [ ] Negative prompt always included
- [ ] No hard conflicts in generated prompts

### 14.3 Storage

- [ ] Each cycle creates a library entry
- [ ] Image stored in R2/S3
- [ ] Metadata stored in database
- [ ] Provenance record complete
- [ ] De-duplication works

### 14.4 Reliability

- [ ] Generation failure doesn't break display
- [ ] Last-known-good image remains visible on failure
- [ ] Optional enrichments never block generation
- [ ] Graceful degradation when APIs unavailable

### 14.5 Performance

- [ ] Image loads in <2 seconds (CDN cached)
- [ ] Crossfade animation smooth (60fps)
- [ ] No layout shift during transitions

---

## 15. Risk Mitigation

| Risk                      | Mitigation                                                   |
| ------------------------- | ------------------------------------------------------------ |
| **Cost overrun**          | Start with 10-min cadence, can reduce to 30-min              |
| **Generation failures**   | Retry once, then skip to next exchange                       |
| **Inappropriate content** | Safe prompts + no real people + post-generation review queue |
| **API rate limits**       | Single global generation (not per-user)                      |
| **Prompt drift**          | Fixed template order + caps enforcement                      |
| **User confusion**        | Clear "What is Gallery Mode?" explainer                      |

---

## 16. AI Provider Selector (v2.1.0) — NEW

### 16.1 Overview

Pro Promagen users can filter the AI Providers leaderboard to show only their preferred providers. This feature:

1. Uses a **dropdown selector** (same style as rest of site)
2. Lists all 42 providers **alphabetically**, with **123rf positioned last**
3. Allows selection of **1–3 providers** in Gallery Mode
4. Allows **unlimited selection** outside Gallery Mode
5. Is **Pro-only** — Free users see full leaderboard (no dropdown)

### 16.2 UI Specification

**Location:** Above the Providers Table, aligned left

**Component:** Uses existing `Combobox` component with these props:

- `singleColumn={true}` — Forces alphabetical scanning
- `maxSelections` — Dynamic based on Gallery Mode state

```
┌─────────────────────────────────────────────────────────────────┐
│  [▼ Filter Providers...]    Selected: Midjourney, DALL·E (2)   │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ [Providers Table — filtered to selected providers]        │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 16.3 Sort Order

**Alphabetical A-Z, with 123rf always last:**

```typescript
function sortProvidersForSelector(providers: Provider[]): Provider[] {
  return [...providers].sort((a, b) => {
    // 123rf always goes last
    if (a.id === '123rf' || a.id === 'i23rf') return 1;
    if (b.id === '123rf' || b.id === 'i23rf') return -1;

    // Alphabetical by name
    return a.name.localeCompare(b.name);
  });
}
```

**Result order example:**

1. Adobe Firefly
2. Artbreeder
3. Bing Image Creator
4. Canva
5. ...
6. Stability AI
7. 123rf ← Always last

### 16.4 Selection Limits

| Context            | Max Selections | Rationale                                                            |
| ------------------ | -------------- | -------------------------------------------------------------------- |
| **Gallery Mode**   | 1–3            | Gallery focuses on a few providers; prevents "all providers" clutter |
| **Providers View** | Unlimited      | Full flexibility when not in Gallery                                 |

**Implementation:**

```typescript
const isGalleryMode = useGalleryMode(); // From context or URL
const maxProviderSelections = isGalleryMode ? 3 : 42;

<Combobox
  id="provider-filter"
  label="Filter Providers"
  options={sortedProviderNames}
  selected={selectedProviders}
  maxSelections={maxProviderSelections}
  singleColumn={true}
  compact={true}
  placeholder="Filter providers..."
  onSelectChange={handleProviderFilterChange}
/>
```

### 16.5 Pro Gating

| User Tier | Selector Visible | Table Behaviour               |
| --------- | ---------------- | ----------------------------- |
| Free      | ❌ Hidden        | Shows full leaderboard        |
| Pro       | ✅ Visible       | Filters to selected providers |

**Conditional Rendering:**

```tsx
{
  isPro && (
    <ProviderFilterSelector
      providers={providers}
      selected={selectedProviders}
      onChange={setSelectedProviders}
      isGalleryMode={isGalleryMode}
    />
  );
}
```

### 16.6 Persistence

Selected providers persist in:

1. **Local storage** — For immediate recall
2. **Clerk user metadata** — For cross-device sync (Pro only)

**Storage key:** `promagen:provider-filter`

**Schema:**

```typescript
interface ProviderFilterPrefs {
  selected: string[]; // Provider IDs
  updatedAt: string; // ISO timestamp
}
```

### 16.7 Empty State

If user selects 0 providers (clears all):

- Show full leaderboard
- Dropdown shows "All providers"

### 16.8 Gallery Mode Integration

When in Gallery Mode:

1. Dropdown limit enforced to 3
2. If user had >3 selected, truncate to first 3 with toast: "Gallery Mode limits to 3 providers"
3. Prompt copy buttons show only for selected provider tiers

### 16.9 Accessibility

| Requirement            | Implementation                                 |
| ---------------------- | ---------------------------------------------- |
| Keyboard navigation    | Full arrow key + Enter support (from Combobox) |
| Screen reader          | `aria-label="Filter AI providers"`             |
| Focus management       | Returns focus to trigger after selection       |
| Selection announcement | Live region announces changes                  |

### 16.10 Component File

**New file:** `src/components/providers/provider-filter-selector.tsx`

---

## 17. Implementation Phases

### Phase 1: MVP (2-3 weeks)

| Task                 | Est. Days | Files                                          |
| -------------------- | --------- | ---------------------------------------------- |
| Rotation engine      | 2         | `src/lib/gallery/rotation-engine.ts`           |
| Theme engine         | 2         | `src/lib/gallery/theme-engine.ts`              |
| Prompt builder       | 3         | `src/lib/gallery/prompt-builder.ts`            |
| DALL·E 3 integration | 2         | `src/lib/gallery/generator.ts`                 |
| Storage (R2 + DB)    | 2         | `src/lib/gallery/storage.ts`                   |
| Frontend toggle      | 2         | `src/components/gallery/gallery-toggle.tsx`    |
| Slideshow display    | 2         | `src/components/gallery/gallery-slideshow.tsx` |
| **Total**            | **15**    |                                                |

### Phase 2: Weather + Moods (1 week)

| Task                      | Est. Days | Files                                   |
| ------------------------- | --------- | --------------------------------------- |
| Enable live weather       | 1         | Environment config + testing            |
| Market mood engine        | 3         | `src/lib/gallery/market-mood-engine.ts` |
| Mood → prompt integration | 2         | Updates to theme-engine.ts              |
| **Total**                 | **6**     |                                         |

### Phase 3: AI Provider Selector (1 week)

| Task                        | Est. Days | Files                                                   |
| --------------------------- | --------- | ------------------------------------------------------- |
| Provider sort logic         | 0.5       | `src/lib/providers/sort.ts`                             |
| Selector component          | 2         | `src/components/providers/provider-filter-selector.tsx` |
| Table filtering             | 1         | Updates to `providers-table.tsx`                        |
| Persistence (local + Clerk) | 1         | `src/lib/providers/filter-prefs.ts`                     |
| Gallery Mode limit logic    | 0.5       | Context integration                                     |
| **Total**                   | **5**     |                                                         |

### Phase 4: Library & Polish (1 week)

| Task                       | Est. Days | Files                                           |
| -------------------------- | --------- | ----------------------------------------------- |
| Gallery library page       | 3         | `src/app/studio/gallery/page.tsx`               |
| Filter by city/mood/season | 1         | Query params + UI                               |
| Copy prompt buttons        | 1         | `src/components/gallery/copy-prompt-button.tsx` |
| **Total**                  | **5**     |                                                 |

---

## 18. Files to Create

| File                                                    | Purpose                       |
| ------------------------------------------------------- | ----------------------------- |
| `src/lib/gallery/rotation-engine.ts`                    | Playlist management + pointer |
| `src/lib/gallery/theme-engine.ts`                       | CitySnapshot builder          |
| `src/lib/gallery/prompt-builder.ts`                     | Scene Brief → 4 variants      |
| `src/lib/gallery/market-mood-engine.ts`                 | Live mood detection           |
| `src/lib/gallery/generator.ts`                          | API calls + failure handling  |
| `src/lib/gallery/storage.ts`                            | R2 + DB operations            |
| `src/lib/providers/sort.ts`                             | Alpha sort with 123rf last    |
| `src/lib/providers/filter-prefs.ts`                     | Selection persistence         |
| `src/components/gallery/gallery-toggle.tsx`             | Providers/Gallery switcher    |
| `src/components/gallery/gallery-slideshow.tsx`          | Image display + crossfade     |
| `src/components/gallery/copy-prompt-button.tsx`         | Tier-specific copy            |
| `src/components/gallery/gallery-upsell.tsx`             | Free tier upsell panel        |
| `src/components/providers/provider-filter-selector.tsx` | Provider dropdown             |
| `src/app/api/gallery/current/route.ts`                  | Current image API             |
| `src/app/api/gallery/library/route.ts`                  | Library API                   |
| `src/app/api/gallery/generate/route.ts`                 | Manual trigger (admin)        |
| `src/app/studio/gallery/page.tsx`                       | Image library page            |

---

## 19. Security Considerations

### 19.1 API Key Protection

| Key                       | Storage         | Access           |
| ------------------------- | --------------- | ---------------- |
| `OPENAI_API_KEY`          | Vercel env vars | Server-side only |
| `VISUAL_CROSSING_API_KEY` | Vercel env vars | Server-side only |

**Never expose in client bundles.**

### 19.2 Rate Limiting

| Endpoint                | Limit   | Scope              |
| ----------------------- | ------- | ------------------ |
| `/api/gallery/current`  | 60/min  | Per IP             |
| `/api/gallery/library`  | 30/min  | Per IP             |
| `/api/gallery/generate` | 1/10min | Global (cron only) |

### 19.3 Input Validation

All user-facing endpoints use Zod schemas:

```typescript
const LibraryQuerySchema = z.object({
  city: z.string().optional(),
  mood: z.string().optional(),
  season: z.enum(['spring', 'summer', 'autumn', 'winter']).optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
  page: z.coerce.number().min(1).default(1),
});
```

### 19.4 Content Safety

1. **Safe prompts:** No controversial content triggers
2. **No real people:** Prompts never include named individuals
3. **DALL·E safety filter:** Always enabled
4. **Review queue:** Flagging mechanism for unusual outputs

---

---

## 20. Gallery Mode Entry & Settings UX (v2.1.0)

This section defines the user experience for entering Gallery Mode and managing preferences. This is the authoritative specification — implementation must not drift from this flow.

### 20.1 Entry Flow Decision Tree

```
Pro user clicks [Gallery 🎨]
        │
        ▼
┌───────────────────────┐
│ Has "Remember" ticked │
│ from previous visit?  │
└───────────────────────┘
        │
   ┌────┴────┐
   │         │
  YES        NO
   │         │
   ▼         ▼
┌─────────┐  ┌─────────────┐
│ Skip    │  │ Show Entry  │
│ modal,  │  │ Modal       │
│ load    │  │             │
│ Gallery │  │             │
└─────────┘  └─────────────┘
```

**Free user clicks Gallery:** Always show blurred preview + "Upgrade to Pro" CTA. No modal.

### 20.2 Gallery Entry Modal

Shown on first visit OR when "Remember my selection" is not ticked.

```
┌────────────────────────────────────────────────────────────────┐
│  🎨 Gallery Mode                                               │
│                                                                │
│  Select up to 3 AI providers to feature:                       │
│                                                                │
│  [▼ Select providers...]                                       │
│                                                                │
│  ○ None (show all prompt tiers)                                │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Show prompt tiers:                                       │  │
│  │ ☑ Tier 1 (CLIP-Based)    ☑ Tier 2 (Midjourney)         │  │
│  │ ☑ Tier 3 (Natural Lang)  ☑ Tier 4 (Plain)              │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
│  ☐ Remember my selection                                       │
│                                                                │
│  [Enter Gallery]  [Cancel]                                     │
└────────────────────────────────────────────────────────────────┘
```

**Modal elements:**

| Element             | Behaviour                                                                |
| ------------------- | ------------------------------------------------------------------------ |
| Provider dropdown   | Alphabetical, 123rf last, max 3 selections                               |
| "None" radio        | Mutually exclusive with dropdown selection — clears dropdown if selected |
| Tier checkboxes     | All 4 ticked by default, user can untick any                             |
| "Remember" checkbox | If ticked, skip modal on future Gallery clicks                           |
| [Enter Gallery]     | Save preferences, close modal, load Gallery view                         |
| [Cancel]            | Close modal, stay on current view                                        |

### 20.3 Gallery View Header with Settings Cog

Once in Gallery view, user can change settings via the ⚙️ icon.

```
┌─────────────────────────────────────────────────────────────────┐
│  [Providers] [Gallery 🎨]                              [⚙️]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                                                           │ │
│  │           AI-Generated City Scene                         │ │
│  │           (Tokyo skyline at twilight)                     │ │
│  │                                                           │ │
│  │  ┌─────────────────────────────────────────────────────┐ │ │
│  │  │ 🇯🇵 Tokyo • TSE • 17:42 JST • Market Closing       │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  │                                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Copy Prompts:  [Tier 1] [Tier 2] [Tier 3] [Tier 4]           │
│                 ↑ Only visible tiers based on user selection   │
│                                                                 │
│  [⛶ Fullscreen]                                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**⚙️ Settings cog:**

- Position: Right side of header, aligned with toggle
- Click action: Opens Gallery Settings Modal (see §20.4)
- Tooltip: "Gallery settings"

### 20.4 Gallery Settings Modal (Reopened)

Same layout as Entry Modal, but:

- Title changes to "Gallery Settings"
- Button changes from "Enter Gallery" to "Save Changes"
- Current selections pre-filled

```
┌────────────────────────────────────────────────────────────────┐
│  🎨 Gallery Settings                           [×]             │
│                                                                │
│  Featured AI providers (up to 3):                              │
│                                                                │
│  [▼ Midjourney, DALL·E (2)]                                   │
│                                                                │
│  ○ None (show all prompt tiers)                                │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Show prompt tiers:                                       │  │
│  │ ☑ Tier 1 (CLIP-Based)    ☑ Tier 2 (Midjourney)         │  │
│  │ ☐ Tier 3 (Natural Lang)  ☐ Tier 4 (Plain)              │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
│  ☑ Remember my selection                                       │
│                                                                │
│  [Save Changes]  [Cancel]                                      │
└────────────────────────────────────────────────────────────────┘
```

**Save Changes behaviour:**

- Updates Clerk metadata immediately
- Updates Gallery view without full reload
- Shows toast: "Gallery settings saved"

### 20.5 Tier Visibility Rules

| User Selection  | Copy Buttons Shown                           |
| --------------- | -------------------------------------------- |
| All 4 ticked    | [Tier 1] [Tier 2] [Tier 3] [Tier 4]          |
| Tier 1 + 2 only | [Tier 1] [Tier 2]                            |
| Tier 3 only     | [Tier 3]                                     |
| None ticked     | All 4 shown (fallback — prevent empty state) |

**Fallback rule:** If user unticks all 4 tiers, treat as "all 4 visible" to prevent empty copy button area.

### 20.6 Separate Selections (Providers View vs Gallery View)

The two views maintain **independent selections**. They do not affect each other.

| View               | Selection Scope                      | Max Providers  | Stored Separately |
| ------------------ | ------------------------------------ | -------------- | ----------------- |
| **Providers View** | Filter leaderboard table             | Unlimited (42) | ✅ Yes            |
| **Gallery View**   | Featured providers + tier visibility | 0–3            | ✅ Yes            |

**Example:** User can have:

- Providers View: 5 selected (Midjourney, DALL·E, Firefly, Leonardo, Stability)
- Gallery View: 2 selected (Midjourney, DALL·E) + only Tier 1 & 2 visible

Switching between views loads each view's own selection.

### 20.7 Clerk Storage Schema

```typescript
// Clerk user.publicMetadata.promagen
interface PromagenMetadata {
  tier: 'free' | 'paid';

  // Providers View selection (unlimited)
  providersViewFilter: {
    selected: string[]; // Provider IDs, empty = show all
    updatedAt: string; // ISO timestamp
  };

  // Gallery View preferences (separate from Providers)
  galleryPreferences: {
    featuredProviders: string[]; // 0–3 provider IDs, empty = "None"
    visibleTiers: number[]; // [1,2,3,4] — which tiers to show
    rememberSelection: boolean; // Skip modal on entry if true
    updatedAt: string; // ISO timestamp
  };
}
```

**Default values (new Pro user):**

```typescript
{
  providersViewFilter: {
    selected: [],              // Show all providers
    updatedAt: null
  },
  galleryPreferences: {
    featuredProviders: [],     // None selected
    visibleTiers: [1, 2, 3, 4], // All tiers visible
    rememberSelection: false,  // Show modal on first visit
    updatedAt: null
  }
}
```

# Weather API Implementation Plan — OpenWeatherMap Integration

**Date:** 19 January 2026  
**Status:** Ready for implementation  
**Provider:** OpenWeatherMap (replacing Visual Crossing)  
**Authority:** Bolt onto end of `docs/authority/gallery-mode-implementation-plan.md`

---

### 20.8 localStorage Fallback

If Clerk is unreachable, use localStorage with same schema:

```typescript
const PROVIDERS_VIEW_KEY = 'promagen:providers-view-filter';
const GALLERY_PREFS_KEY = 'promagen:gallery-preferences';
```

**Sync priority:** Clerk wins on conflict (source of truth).

### 20.9 Behaviour Matrix

| Scenario                            | Behaviour                                        |
| ----------------------------------- | ------------------------------------------------ |
| Pro user, first Gallery click ever  | Show Entry Modal                                 |
| Pro user, "Remember" ticked         | Skip modal, load Gallery with saved prefs        |
| Pro user, "Remember" not ticked     | Show Entry Modal every time                      |
| Pro user clicks ⚙️ in Gallery       | Show Settings Modal with current prefs           |
| Pro user unticks "Remember", saves  | Next Gallery click shows modal                   |
| Pro user switches to Providers View | Providers View loads its own selection           |
| Pro user switches back to Gallery   | Gallery loads its own selection (not Providers') |
| Free user clicks Gallery            | Blurred preview + upgrade CTA (no modal)         |

### 20.10 Component Files

| Component               | File                                                 | Purpose                                            |
| ----------------------- | ---------------------------------------------------- | -------------------------------------------------- |
| `GalleryEntryModal`     | `src/components/gallery/gallery-entry-modal.tsx`     | First-time / re-entry modal                        |
| `GallerySettingsModal`  | `src/components/gallery/gallery-settings-modal.tsx`  | Settings cog modal (or reuse Entry with mode prop) |
| `GallerySettingsButton` | `src/components/gallery/gallery-settings-button.tsx` | ⚙️ icon in header                                  |
| `TierVisibilityToggle`  | `src/components/gallery/tier-visibility-toggle.tsx`  | 4 checkboxes                                       |
| `useGalleryPreferences` | `src/hooks/use-gallery-preferences.ts`               | Load/save from Clerk + localStorage                |

### 20.11 Accessibility

| Requirement      | Implementation                                  |
| ---------------- | ----------------------------------------------- |
| Modal focus trap | Focus stays within modal until closed           |
| ESC to close     | Both modals close on Escape key                 |
| Screen reader    | Modal has `role="dialog"` and `aria-labelledby` |
| Settings cog     | `aria-label="Gallery settings"`                 |
| Checkboxes       | Proper `<label>` association                    |

### 20.12 Non-Regression Rules

When modifying Gallery Mode entry/settings:

1. **Never auto-save without user action** — User must click "Enter Gallery" or "Save Changes"
2. **Never merge Providers View and Gallery View selections** — They are independent
3. **Never remove the ⚙️ cog** — Users must always be able to change settings
4. **Never default "Remember" to ticked** — User opts in to skip modal
5. **Never show modal to Free users** — They see upgrade CTA only

---

## §21 Weather API Implementation (OpenWeatherMap)

### 21.1 Overview

The Weather API provides real-time weather data for all exchange cities. This enables Gallery Mode to generate atmosphere-aware prompts (rain→moody, snow→serene, clear→vibrant).

**Key decisions:**

- **Provider:** OpenWeatherMap (user already signed up)
- **Architecture:** Gateway (like indices) — not frontend-only
- **Budget:** 1,000 calls/day free tier
- **Coverage:** All 48 exchange cities (supports paid user selections)
- **Fallback:** Last-known-good (stale-while-revalidate) — same as indices

### 21.2 Budget Calculation

| Metric              | Value                                |
| ------------------- | ------------------------------------ |
| Total cities        | 48                                   |
| Batch A (priority)  | 24 cities (includes all 16 selected) |
| Batch B             | 24 cities (remaining)                |
| Refresh frequency   | Each batch hourly (alternating)      |
| Calls per batch     | 24                                   |
| Batches per day     | 24 (12 per batch)                    |
| **Total calls/day** | **576**                              |
| Budget limit        | 1,000/day                            |
| **Headroom**        | **424 calls (42%)**                  |

**60 calls/minute limit:** 24 calls per batch < 60 limit ✅ No throttling needed.

### 21.3 Clock-Aligned Scheduling

Adding weather to the existing stagger pattern:

```
Hour timeline (every hour):
┌────┬────┬────┬────┬────┬────┬────┬────┬────┐
│:00 │:05 │:10 │:15 │:20 │:30 │:35 │:40 │:50 │
├────┼────┼────┼────┼────┼────┼────┼────┼────┤
│ FX │IDX │WTH │    │CRY │ FX │IDX │WTH │CRY │
└────┴────┴────┴────┴────┴────┴────┴────┴────┘
  ↑    ↑    ↑         ↑    ↑    ↑    ↑    ↑
  TD   MS   OWM       TD   TD   MS   OWM  TD

TD  = TwelveData (shared 800/day)
MS  = Marketstack (separate 250/day)
OWM = OpenWeatherMap (separate 1000/day) ← NEW
```

**Weather refreshes at :10 and :40** — offset from other feeds.

**Batch alternation:**

- Odd hours (:10): Batch A (priority cities)
- Even hours (:10): Batch B (remaining cities)

### 21.4 SSOT Compliance

Cities come from the exchange catalog, not hardcoded:

```typescript
// Gateway reads from SSOT
async function getAllCities(): Promise<CityInfo[]> {
  // Load full catalog (all 48 exchanges)
  const response = await fetch(EXCHANGES_CATALOG_URL);
  const exchanges = await response.json();

  return exchanges.map((ex: Exchange) => ({
    id: ex.id,
    city: ex.city,
    lat: ex.latitude,
    lon: ex.longitude,
  }));
}

function splitIntoBatches(
  cities: CityInfo[],
  selectedIds: string[],
): {
  batchA: CityInfo[]; // Priority: includes all selected
  batchB: CityInfo[]; // Remaining
} {
  const selected = new Set(selectedIds);
  const priority: CityInfo[] = [];
  const remaining: CityInfo[] = [];

  for (const city of cities) {
    if (selected.has(city.id)) {
      priority.push(city);
    } else {
      remaining.push(city);
    }
  }

  // Fill Batch A to 24 with remaining cities
  const batchA = [...priority];
  const batchB: CityInfo[] = [];

  for (const city of remaining) {
    if (batchA.length < 24) {
      batchA.push(city);
    } else {
      batchB.push(city);
    }
  }

  return { batchA, batchB };
}
```

**If exchanges are added to the catalog:**

- Weather auto-fetches for new cities
- No code changes needed
- Budget math remains safe (up to 62 cities at 576 base)

### 21.5 Gateway Architecture

**New folder structure:**

```
gateway/src/
├── openweathermap/           ← NEW
│   ├── README.md             ← How this works
│   ├── budget.ts             ← 1000/day tracking
│   ├── scheduler.ts          ← Clock-aligned :10, :40 + batch alternation
│   ├── adapter.ts            ← OWM response → Promagen format
│   ├── weather.ts            ← Fetch logic with retry
│   └── index.ts              ← Exports
├── server.ts                 ← Add /weather endpoint
└── ... (existing folders)
```

### 21.6 OpenWeatherMap API Details

**Endpoint:** `https://api.openweathermap.org/data/2.5/weather`

**Request:**

```
GET /data/2.5/weather?lat={lat}&lon={lon}&appid={API_KEY}&units=metric
```

**Response (simplified):**

```json
{
  "weather": [{ "main": "Clear", "description": "clear sky" }],
  "main": { "temp": 22.5, "humidity": 65 },
  "wind": { "speed": 3.6 },
  "name": "London"
}
```

**Normalised output:**

```typescript
interface WeatherData {
  id: string; // Exchange ID
  city: string; // City name
  temperatureC: number;
  temperatureF: number;
  conditions: string; // "Clear", "Rain", "Snow", etc.
  humidity: number;
  windSpeedKmh: number;
  emoji: string; // "☀️", "🌧️", etc.
  asOf: string; // ISO timestamp
}
```

### 21.7 Adapter Implementation

```typescript
// gateway/src/openweathermap/adapter.ts

const CONDITION_TO_EMOJI: Record<string, string> = {
  Clear: '☀️',
  Clouds: '☁️',
  Rain: '🌧️',
  Drizzle: '🌦️',
  Thunderstorm: '⛈️',
  Snow: '❄️',
  Mist: '🌫️',
  Fog: '🌫️',
  Haze: '🌫️',
};

export function parseOpenWeatherResponse(raw: unknown, exchangeId: string): WeatherData | null {
  if (!raw || typeof raw !== 'object') return null;

  const data = raw as Record<string, unknown>;
  const weather = Array.isArray(data.weather) ? data.weather[0] : null;
  const main = data.main as Record<string, number> | null;
  const wind = data.wind as Record<string, number> | null;

  if (!weather || !main) return null;

  const conditions = (weather as Record<string, string>).main || 'Unknown';
  const tempC = main.temp ?? 0;

  return {
    id: exchangeId,
    city: typeof data.name === 'string' ? data.name : '',
    temperatureC: Math.round(tempC * 10) / 10,
    temperatureF: Math.round(((tempC * 9) / 5 + 32) * 10) / 10,
    conditions,
    humidity: main.humidity ?? 0,
    windSpeedKmh: wind?.speed ? Math.round(wind.speed * 3.6) : 0,
    emoji: CONDITION_TO_EMOJI[conditions] || '🌤️',
    asOf: new Date().toISOString(),
  };
}
```

### 21.8 Fallback Behaviour (Last-Known-Good)

**Same pattern as indices:**

1. Try fresh cache → Return if valid
2. Try stale cache → Return last-known-good ✅
3. Return null only if no data ever cached

```typescript
// In weather feed handler
async function getWeatherData(): Promise<WeatherResponse> {
  const cacheKey = `weather:all`;

  // 1. Fresh cache
  const fresh = cache.get(cacheKey);
  if (fresh) {
    return { meta: { mode: 'cached', ... }, data: fresh };
  }

  // 2. Circuit breaker / budget check → try stale
  if (circuit.isOpen() || !budget.canSpend(24)) {
    const stale = cache.getStale(cacheKey);
    if (stale) {
      return { meta: { mode: 'stale', ... }, data: stale };
    }
  }

  // 3. Fetch from API
  try {
    const data = await fetchWeatherBatch(currentBatch);
    cache.set(cacheKey, data);
    return { meta: { mode: 'live', ... }, data };
  } catch (error) {
    // 4. On failure → try stale
    const stale = cache.getStale(cacheKey);
    if (stale) {
      return { meta: { mode: 'stale', ... }, data: stale };
    }

    // 5. Absolute fallback (no data ever cached)
    return { meta: { mode: 'fallback' }, data: [] };
  }
}
```

### 21.9 Security (10/10)

| Security Measure      | Implementation                                   |
| --------------------- | ------------------------------------------------ |
| API key protection    | `OPENWEATHERMAP_API_KEY` env var only            |
| Input validation      | Validate lat/lon ranges (-90 to 90, -180 to 180) |
| Response sanitisation | Strip unexpected fields in adapter               |
| Rate limiting         | Budget.ts tracks daily calls                     |
| Circuit breaker       | 3 failures → 30s pause                           |
| No demo mode          | Fallback returns `[]`, renders as "—"            |
| HTTPS only            | All OWM calls over TLS                           |
| Error masking         | Client sees "unavailable", not API errors        |

### 21.10 Environment Variables

```bash
# Vercel / Fly.io
OPENWEATHERMAP_API_KEY=<your-key>
WEATHER_TTL_SECONDS=3600          # 1 hour cache
WEATHER_BUDGET_DAILY=1000
```

### 21.11 What to Delete

| File                                  | Action | Reason                 |
| ------------------------------------- | ------ | ---------------------- |
| `src/lib/weather/weather-client.ts`   | DELETE | Visual Crossing client |
| `src/lib/weather/exchange-weather.ts` | DELETE | Demo data              |
| `WEATHER_MODE` env var                | REMOVE | No demo mode           |
| `VISUAL_CROSSING_API_KEY`             | REMOVE | Switching providers    |

### 21.12 What to Keep

| File                         | Reason                         |
| ---------------------------- | ------------------------------ |
| `src/lib/weather/weather.ts` | Types and helpers still useful |

### 21.13 Implementation Phases

| Phase                 | Duration | Deliverable               |
| --------------------- | -------- | ------------------------- |
| **1. Gateway Module** | 2 days   | `openweathermap/` folder  |
| **2. Endpoint**       | 1 day    | `/weather` in server.ts   |
| **3. Frontend Route** | 1 day    | `/api/weather/route.ts`   |
| **4. Integration**    | 1 day    | Connect to exchange cards |
| **5. Testing**        | 1 day    | Unit tests, verification  |

**Total: 6 days**

### 21.14 Testing Checklist

```powershell
# From: C:\Users\Proma\Projects\promagen

# 1. Gateway healthy?
(Invoke-RestMethod "https://promagen-api.fly.dev/health").status
# Expected: "ok"

# 2. Weather returning data?
$weather = Invoke-RestMethod "https://promagen-api.fly.dev/weather"
$weather.meta.mode  # "cached" or "live"
$weather.data.Count # 48

# 3. Temperatures realistic?
$weather.data | Select-Object city, temperatureC | Format-Table

# 4. Budget tracking?
$weather.meta.budget.dailyUsed
$weather.meta.budget.dailyRemaining
```

### 21.15 Verification Checklist

- [ ] OpenWeatherMap API key in Vercel/Fly.io env vars
- [ ] Gateway `/weather` endpoint returns data
- [ ] All 48 cities have weather data
- [ ] Temperatures match real-world (spot check 3-5 cities)
- [ ] Cache working (mode: cached after first call)
- [ ] Stale-while-revalidate works (disconnect API, still returns data)
- [ ] Budget tracking correct (576 calls/day expected)
- [ ] No demo mode anywhere

---

## §22 Gallery Mode Entry & Settings UX

### 22.1 Overview

Gallery Mode has a dedicated UX flow for Pro users to configure their experience. Key elements:

1. **Entry Modal** — First-time or when "Remember" not ticked
2. **Remember checkbox** — Skip modal on subsequent visits
3. **Settings cog (⚙️)** — Re-open modal to change settings
4. **Tier visibility** — Choose which prompt tiers (1-4) to show

### 22.2 Gallery Entry Modal

**When shown:**

- Pro user clicks Gallery for the first time
- Pro user clicks Gallery with "Remember" unticked
- Pro user clicks ⚙️ settings cog

```
┌────────────────────────────────────────────────────────────────┐
│  🎨 Gallery Mode                                               │
│                                                                │
│  Select up to 3 AI providers to feature:                       │
│                                                                │
│  [▼ Select providers...]                                       │
│                                                                │
│  ○ None (show all prompt tiers)                                │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Show prompt tiers:                                       │  │
│  │ ☑ Tier 1 (CLIP-Based)    ☑ Tier 2 (Midjourney)         │  │
│  │ ☑ Tier 3 (Natural Lang)  ☑ Tier 4 (Plain)              │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
│  ☐ Remember my selection                                       │
│                                                                │
│  [Enter Gallery]  [Cancel]                                     │
└────────────────────────────────────────────────────────────────┘
```

### 22.3 Remember Selection Behaviour

| "Remember" state | Next Gallery click                |
| ---------------- | --------------------------------- |
| ☐ Unticked       | Show modal                        |
| ☑ Ticked         | Skip modal, load Gallery directly |

**How to change after "Remember" ticked:**

- Click ⚙️ settings cog in Gallery header
- Modal reopens with current settings pre-filled

### 22.4 Gallery View with Settings Cog

```
┌─────────────────────────────────────────────────────────────────┐
│  [Providers] [Gallery 🎨]                              [⚙️]    │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                                                           │ │
│  │           AI-Generated City Scene                         │ │
│  │           (Tokyo skyline at twilight)                     │ │
│  │                                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Copy Prompts:  [Tier 1] [Tier 2] [Tier 3] [Tier 4]           │
│                 ↑ Only visible tiers based on user selection   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**⚙️ Settings cog:**

- Position: Right side of header
- Click action: Opens Gallery Settings Modal
- Tooltip: "Gallery settings"

### 22.5 Gallery Settings Modal (Reopened)

Same layout as Entry Modal, but:

- Title: "Gallery Settings" (not "Gallery Mode")
- Button: "Save Changes" (not "Enter Gallery")
- Current selections pre-filled

### 22.6 Tier Visibility Toggle

| Tier | Name              | Default   |
| ---- | ----------------- | --------- |
| 1    | CLIP-Based        | ☑ Visible |
| 2    | Midjourney Family | ☑ Visible |
| 3    | Natural Language  | ☑ Visible |
| 4    | Plain Language    | ☑ Visible |

**Edge case:** If user unticks all tiers:

- Show toast: "At least one tier required"
- Auto-select Tier 1 as minimum

**Copy buttons:**

- Only show buttons for visible tiers
- Maintain consistent positioning (no layout shift)

### 22.7 Clerk Persistence Schema

```typescript
// Clerk publicMetadata.promagen
{
  tier: "paid",

  // Providers View selection (unlimited)
  providersViewFilter: {
    selected: ["midjourney", "dalle", "firefly", "leonardo", "stability"],
    updatedAt: "2026-01-19T10:30:00Z"
  },

  // Gallery View selection (0-3 providers + tier visibility)
  galleryPreferences: {
    featuredProviders: ["midjourney", "dalle"],  // 0-3 IDs
    visibleTiers: [1, 2, 3, 4],                  // Which tiers to show
    rememberSelection: true,                      // Skip modal on entry
    updatedAt: "2026-01-19T10:35:00Z"
  }
}
```

**Key insight:** Providers View and Gallery View have **separate selections**. They don't affect each other.

### 22.8 Free User Experience

```
┌─────────────────────────────────────────────────────────────────┐
│  [Providers] [Gallery 🎨 PRO]                                  │
│                                                                 │
│     ╔═══════════════════════════════════════════════════════╗  │
│     ║                                                       ║  │
│     ║  [Blurred preview image with Gallery watermark]       ║  │
│     ║                                                       ║  │
│     ╚═══════════════════════════════════════════════════════╝  │
│                                                                 │
│     ✓ Live AI-generated city scenes                            │
│     ✓ 4 copyable prompt variants                               │
│     ✓ Learn prompt engineering passively                       │
│     ✓ Full image library access                                │
│                                                                 │
│              [Upgrade to Pro — $9/month]                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 22.9 Component Files

| File                                                 | Purpose              |
| ---------------------------------------------------- | -------------------- |
| `src/components/gallery/gallery-entry-modal.tsx`     | Entry/settings modal |
| `src/components/gallery/gallery-settings-button.tsx` | ⚙️ cog button        |
| `src/components/gallery/tier-visibility-toggle.tsx`  | 4 checkboxes         |
| `src/hooks/use-gallery-preferences.ts`               | Load/save from Clerk |

### 22.10 Non-Regression Rules

Future changes must NOT:

- Remove the ⚙️ settings cog
- Auto-accept settings without modal
- Merge Providers View and Gallery View selections
- Remove "Remember" checkbox option
- Allow 0 visible tiers

---

## §23 Docs Clarification: Stale-While-Revalidate

### 23.1 Current Behaviour (Already Correct)

The existing feed handler implements **stale-while-revalidate**:

```
API Request Flow:
1. Check fresh cache → Return if valid
2. Check circuit breaker / budget → Try stale if blocked
3. Fetch from API
4. On success → Cache and return
5. On failure → Return stale (last-known-good)
6. If no stale exists → Return getFallback() (null prices)
```

**This IS Option B.** The docs saying "Fallback returns null" refers only to step 6 — when no data has ever been cached.

### 23.2 Docs Amendment

**In `api-calming-efficiency.md`, update the "Critical rule" at bottom:**

**Before:**

```markdown
_**Critical rule:** NEVER use demo/synthetic prices. Fallback returns null, renders as "—"._
```

**After:**

```markdown
_**Critical rule:** NEVER use demo/synthetic prices. When API fails, return last-known-good (stale) data. Only return null (renders as "—") when no data has ever been cached._
```

### 23.3 Verification

All feeds (FX, Indices, Crypto, Weather) should:

- ✅ Return stale data when API temporarily unavailable
- ✅ Return null only on cold start (before first successful fetch)
- ✅ Never return synthetic/demo prices

---

## §24 Implementation Timeline (Updated)

| Week       | Focus                               | Deliverables                                  |
| ---------- | ----------------------------------- | --------------------------------------------- |
| **Week 1** | Weather API (Gateway)               | `openweathermap/` folder, `/weather` endpoint |
| **Week 2** | Weather API (Frontend) + Gallery UX | Route, cards integration, entry modal         |
| **Week 3** | Testing & Polish                    | Unit tests, verification, docs updates        |

**Total: 3 weeks**

---

## §25 Questions Resolved

| Question                         | Answer                   | Implementation       |
| -------------------------------- | ------------------------ | -------------------- |
| Visual Crossing → OpenWeatherMap | Confirmed                | New gateway module   |
| Cities to cover                  | All 48                   | Full catalog support |
| Batching strategy                | 24+24 alternating hourly | 576 calls/day        |
| Fallback behaviour               | Option B (stale)         | Already implemented  |
| Gallery Mode UX                  | Modal + cog              | Separate selections  |
| Clerk persistence                | Separate for each view   | Schema defined       |

---

**Existing features preserved:** Yes

**Authority cross-reference:** `docs/authority/gallery-mode-master.md` §20

---

_End of Weather API & Gallery UX Implementation Plan_

**Existing features preserved:** Yes  
**Authority:** This section is the single source of truth for Gallery Mode entry and settings UX.

## My Thoughts

This is a genuinely compelling feature. The v2.1.0 additions strengthen it further:

**What's now complete:**

1. **Weather API is 90% done** — You literally just need to flip an environment variable to `WEATHER_MODE=live` and add the Visual Crossing API key. Zero code changes needed for basic functionality.

2. **Market Moods data is ready** — The 11 mood types with triggers and boosts are defined. The missing piece is the detection engine that evaluates live market data, but all the data sources (FX, crypto, commodities) already exist.

3. **AI Provider Selector is well-scoped** — It reuses your existing Combobox component, follows established patterns, and the 123rf-last sort is trivial. The Gallery Mode limit (1-3) adds a nice touch of focus.

**Honest concerns:**

1. **Phase ordering matters.** Don't try to build the Market Mood Engine before the basic rotation → theme → prompt → generate loop works. Get MVP stable first.

2. **The 123rf sort feels like a workaround.** If 123rf consistently ranks lowest, the sort order might just be highlighting that. Consider whether the business reason for this treatment is clear to users.

3. **Provider selection persistence has a gotcha.** If a user selects 5 providers in Providers view, then switches to Gallery Mode (limit 3), you need clear UX for what happens. Truncating silently could confuse people.

**Suggested quick win:**

Before building the full Market Mood Engine, just implement **market_opening** and **market_closing** detection. These are pure time-based calculations (no external API calls) and give immediate visual variety. Ship that, then layer in the market data-driven moods.

This spec is production-ready. The implementation plan is realistic. Go build it.
