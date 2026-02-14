# Go Big or Go Home — Commodity Prompt Builder

**Last updated:** 12 February 2026 (v3.0 — complete rewrite from implementation audit)  
**Owner:** Promagen  
**Status:** Part A IMPLEMENTED · Part B IMPLEMENTED · Wiring PENDING  
**Authority:** This document defines the architecture, data flow, vocabulary integration, and UI for the Commodity Prompt System and the Intelligent Phrases Dropdown. Supersedes v2 entirely.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Part A — Commodity Prompt Tooltip](#2-part-a--commodity-prompt-tooltip)
3. [Part B — Intelligent Phrases Dropdown](#3-part-b--intelligent-phrases-dropdown)
4. [Vocabulary Inventory (Verified from Source)](#4-vocabulary-inventory-verified-from-source)
5. [Blueprint Prompt System](#5-blueprint-prompt-system)
6. [Country-Commodities Map](#6-country-commodities-map)
7. [Weather Data Pipeline](#7-weather-data-pipeline)
8. [Prompt Assembly — How It Actually Works](#8-prompt-assembly--how-it-actually-works)
9. [Cascading Intelligence Engine](#9-cascading-intelligence-engine)
10. [Technical Architecture](#10-technical-architecture)
11. [Implementation Status](#11-implementation-status)
12. [Wiring Checklist — What Remains](#12-wiring-checklist--what-remains)
13. [Decisions Log](#13-decisions-log)
14. [Non-Regression Rules](#14-non-regression-rules)

---

## 1. Overview

This document covers two connected features that together form Promagen's commodity prompt intelligence layer.

**Part A — Commodity Prompt Tooltip:** When a user hovers over ANY flag in the commodities movers window (base price flag + all 3 conversion flags), a dynamic, intelligent image prompt appears. The prompt is assembled from authored blueprint data covering 78 commodities across 336 production stages and 1,222 environments. A time-of-day lighting layer and weather integration add environmental richness. The visual scene randomly selects a producer country from the commodity's pool via `country-commodities.map.json`, giving massive variety — up to 64 different scenes for a single commodity like Brent Crude.

**Part B — Intelligent Phrases Dropdown:** An adjacent dropdown alongside every existing single-word dropdown in the prompt builder at `/providers/[id]`. This dropdown surfaces rich, multi-word phrases from the commodity vocabulary (7,618 phrases), weather vocabulary (2,212 phrases), and prompt builder vocabulary (3,955 phrases). Phrases only appear when the user types — matching on first letters. The dropdown gets smarter as the user builds their prompt from top to bottom via cascading context filtering.

### System Summary

| System                              | Files                      | Status      | Key Metric                                     |
| ----------------------------------- | -------------------------- | ----------- | ---------------------------------------------- |
| Blueprint prompt JSONs              | 4 data files + time-of-day | ✅ Built    | 78 commodities, 336 stages, 1,222 environments |
| Blueprint loader/resolver/assembler | 3 lib files                | ✅ Built    | ~49,000 unique prompt combinations             |
| Commodity prompt generator          | 1 lib file (v4.0)          | ✅ Built    | 4-tier output, blueprint + legacy fallback     |
| Commodity prompt types              | 1 type file (v3.0)         | ✅ Built    | AllTierPrompts, 3-level sentiment              |
| Country-weather resolver            | 1 lib file                 | ✅ Built    | 69 countries + EU → exchange weather           |
| Commodity prompt tooltip            | 1 component (v2.0)         | ✅ Built    | Pro multi-tier + Free single-tier              |
| Commodity mover card                | 1 component (v3.0)         | ✅ Modified | All 4 flags wrapped with tooltip               |
| Commodity tooltip data hook         | 1 hook                     | ✅ Built    | Scene country selection, season derivation     |
| Phrase category map                 | 1 data file                | ✅ Built    | ~7,500 phrase placements mapped                |
| Cascading filter engine             | 1 lib file                 | ✅ Built    | Context-driven filtering, 476 lines            |
| Intelligent phrases combobox        | 1 component                | ✅ Built    | Type-to-discover, sparkle icon                 |
| Intelligent phrases hook            | 1 hook                     | ✅ Built    | Per-category phrase state, search              |
| Prompt intelligence builder         | 1 component (v1.1.0)       | ✅ Modified | Combobox integrated alongside categories       |
| **Pro/tier wiring**                 | commodity-mover-card.tsx   | ⏳ PENDING  | `isPro` and `tier` props not yet passed        |

### What Changed from v2

| Area                   | v2 (Design Doc)                             | v3 (Implementation Reality)                                                          |
| ---------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------ |
| Prompt source          | Generic vocabulary sampling (21 JSON files) | Authored blueprint system (4 JSON blueprint files)                                   |
| Sentiment levels       | 7 levels (euphoria → despair)               | 3 levels (confident / optimistic / neutral)                                          |
| Prompt assembly        | Layer selection from vocabulary pools       | Blueprint resolver → subject + lens + enhancer + environment + weather + time-of-day |
| Temperature in prompts | Possible via weather phrases                | Explicitly excluded — no °C/°F in any tier                                           |
| Time-of-day            | Not in v2                                   | 4 periods (dawn, morning, golden, night) mapped from commodity timezone              |
| Country backfill       | 69 countries from map                       | 208 additional environments across 25 thin commodities                               |
| Unique combinations    | ~thousands from sampling                    | ~49,000 authored combinations                                                        |
| Tier generation        | Selected tier only                          | All 4 tiers always generated (AllTierPrompts)                                        |
| Pro tooltip            | Not specified                               | Multi-tier display with individual copy buttons per tier                             |
| Vocabulary counts      | 12,345 (estimated)                          | 16,198 (verified from source)                                                        |

---

## 2. Part A — Commodity Prompt Tooltip

### 2.1 Design Spec

**Visually identical** to `WeatherPromptTooltip` in every way:

| Attribute              | Value                                            | Same as City Tooltip? |
| ---------------------- | ------------------------------------------------ | --------------------- |
| Render method          | React Portal at `document.body`                  | ✅ Yes                |
| Close delay            | 400ms hover persistence                          | ✅ Yes                |
| Tooltip width          | 450px                                            | ✅ Yes                |
| Background             | `rgba(15, 23, 42, 0.97)`                         | ✅ Yes                |
| Border radius          | `rounded-xl`                                     | ✅ Yes                |
| Padding                | `px-6 py-4`                                      | ✅ Yes                |
| Header                 | "Image Prompt" + PRO badge                       | ✅ Yes                |
| Tier indicator         | "Tier 4: Plain" (or user's selected tier)        | ✅ Yes                |
| Copy button            | Bottom-right, with ✓ feedback                    | ✅ Yes                |
| Ethereal glow overlays | Top radial + bottom accent                       | ✅ Yes                |
| Positioning            | Left rail → opens right, Right rail → opens left | ✅ Yes                |
| Cursor                 | `cursor-pointer` (NOT `cursor-help`)             | ✅ Yes                |

**What differs — the glow colour (group-based with sentiment modulation):**

| Commodity Group | Glow Colour  | Hex       |
| --------------- | ------------ | --------- |
| Energy          | Amber/orange | `#F59E0B` |
| Agriculture     | Green        | `#10B981` |
| Metals          | Silver/steel | `#94A3B8` |

**Sentiment overlay on glow (3-level system — actual implementation):**

| deltaPct    | Sentiment Label | Glow Modifier                      |
| ----------- | --------------- | ---------------------------------- |
| > +2%       | `confident`     | Glow shifts warmer, more saturated |
| > 0% to +2% | `optimistic`    | Base group colour, slight warmth   |
| ≤ 0%        | `neutral`       | Base group colour, cooler/muted    |

```typescript
// Actual implementation in commodity-prompt-generator.ts v4.0
export type SentimentLevel = 'confident' | 'optimistic' | 'neutral';

export function deriveSentiment(deltaPct: number): SentimentLevel {
  if (deltaPct > 2) return 'confident';
  if (deltaPct > 0) return 'optimistic';
  return 'neutral';
}
```

### 2.2 Which Flags Get Tooltips

**All flags on the commodity mover card** (implemented in commodity-mover-card.tsx v3.0):

| Row   | Element           | Flag                                          | Tooltip? |
| ----- | ----------------- | --------------------------------------------- | -------- |
| Row 2 | Base price        | `baseFlagCode` (e.g., 🇺🇸 for USD commodities) | ✅ Yes   |
| Row 4 | Conversion line 1 | `conversionLine1.countryCode` (e.g., 🇪🇺)      | ✅ Yes   |
| Row 5 | Conversion line 2 | `conversionLine2.countryCode` (e.g., 🇬🇧)      | ✅ Yes   |
| Row 6 | Conversion line 3 | `conversionLine3.countryCode` (if present)    | ✅ Yes   |

**Scene selection logic:** The hovered flag determines the **financial/trading context**. But the **visual scene** randomly selects a producer country from the commodity's pool via `country-commodities.map.json`. Each data refresh changes the seed → different random country → different scene.

### 2.3 Free vs Pro User Experience

**Free users (current default — `isPro={false}`):**

- Single tier 4 (Plain Language) prompt displayed
- Single copy button
- Glow system, portal timing, hover behaviour all active
- Same visual quality as Pro, just one tier

**Pro users (when `isPro={true}` is wired):**

- All 4 tiers displayed via `ProTooltipContent` component
- Active tier (user's selected) is EXPANDED with full prompt text
- Other 3 tiers are COLLAPSED with 90-character truncated preview
- Individual copy button per tier
- PRO badge in header
- "4 platform-optimised prompts" subtitle
- "Blueprint" indicator when authored content used
- Scrollable (max-height: 80vh) for long prompts

**Tier colour system (matches `four-tier-prompt-preview.tsx`):**

| Tier | Colour                     | Label            | Platforms                            |
| ---- | -------------------------- | ---------------- | ------------------------------------ |
| T1   | Blue (`bg-blue-400`)       | CLIP-Based       | Stable Diffusion · Leonardo · Flux   |
| T2   | Purple (`bg-purple-400`)   | Midjourney       | Midjourney · BlueWillow              |
| T3   | Emerald (`bg-emerald-400`) | Natural Language | DALL·E · Imagen · Adobe Firefly      |
| T4   | Orange (`bg-orange-400`)   | Plain Language   | Canva · Craiyon · Microsoft Designer |

### 2.4 Data Inputs to Prompt Generator

```typescript
// Actual interface from commodity-prompt-types.ts v3.0
interface CommodityPromptInput {
  commodityId: string;
  commodity: Commodity;
  hoveredCountryCode: string;
  sceneCountryCode: string;
  sceneCountryName: string;
  deltaPct: number;
  direction: 'winner' | 'loser';
  tier: PromptTier;
  weather?: CommodityWeatherSlice | null;
  localHour?: number;
  season: Season;
}
```

### 2.5 Output Shape

```typescript
// Actual interface from commodity-prompt-types.ts v3.0
interface AllTierPrompts {
  tier1: string; // CLIP-Based (weighted tokens)
  tier2: string; // Midjourney (structured parameters)
  tier3: string; // Natural Language (DALL·E, Imagen)
  tier4: string; // Plain Language (Canva, Craiyon)
}

interface CommodityPromptOutput {
  prompt: string; // Selected tier's prompt
  sentiment: SentimentLevel;
  group: CommodityGroup;
  allPrompts: AllTierPrompts;
  blueprintUsed: boolean;
}
```

### 2.6 Seeded Randomisation

Same principle as weather prompt generator — uses a seed derived from commodity ID + scene country code + current data values:

- Same conditions = same prompt (consistency)
- Data changes = different prompt (dynamism)
- Different flag on same commodity = different prompt (variety)
- Different scene country = different prompt (massive variety)

```typescript
// Actual implementation in commodity-prompt-generator.ts v4.0
export function selectSceneCountry(commodityId: string, deltaPct: number, pool: string[]): string {
  const str = `${commodityId}-${Math.round(deltaPct * 100)}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return pool[Math.abs(hash) % pool.length];
}
```

---

## 3. Part B — Intelligent Phrases Dropdown

### 3.1 Concept

Every category in the prompt builder (Subject, Action, Style, Environment, Composition, Camera, Lighting, Colour, Atmosphere, Materials, Fidelity) gets an **adjacent dropdown** alongside the existing single-word dropdown.

**Left dropdown:** Existing standard dropdown (~300 short options per category). Unchanged.

**Right dropdown:** Intelligent phrases dropdown. Contains rich, multi-word phrases from the commodity vocabulary (7,618 phrases), weather vocabulary (2,212 phrases), and prompt builder vocabulary (3,955 phrases). These phrases only become visible when the user types — matching on the first letters of any word in the phrase.

### 3.2 UI Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ Subject                                                             │
│ ┌──────────────────────────┐  ┌──────────────────────────────────┐  │
│ │ portrait of a woman    ▼ │  │ ✦ Intelligent phrases          ▼ │  │
│ │ (300 standard options)   │  │ (phrases filtered by context)    │  │
│ └──────────────────────────┘  └──────────────────────────────────┘  │
│                                                                     │
│ Lighting                                                            │
│ ┌──────────────────────────┐  ┌──────────────────────────────────┐  │
│ │ golden hour            ▼ │  │ ✦ 12 relevant phrases         ▼ │  │
│ │ (300 standard options)   │  │ (filtered by selections above)   │  │
│ └──────────────────────────┘  └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

The ✦ sparkle icon distinguishes the intelligent phrases dropdown from the standard one.

### 3.3 Component Implementation

**File:** `src/components/ui/intelligent-phrases-combobox.tsx` (442 lines)

Behaviour (implemented):

- Phrases hidden by default (dropdown closed, no results shown)
- User types → first-letter matching on any word in phrase → results appear
- One phrase per category (strict, replaces on new selection)
- Selected phrase shown as chip with ✕ remove button
- ✦ sparkle icon distinguishes from standard dropdowns
- Locked state: disabled input, purple tint, no interaction
- Randomise button does NOT affect this dropdown
- Max 30 results shown for performance
- Scrollable dropdown with fade edges
- Amber accent for sparkle icon and category badge
- Matches existing Combobox dark slate theme

### 3.4 Selection Rules

| Rule                           | Behaviour                                                |
| ------------------------------ | -------------------------------------------------------- |
| Max phrases per category       | 1 (strict)                                               |
| Selection action               | Both dropdowns close                                     |
| Phrase appears as              | Chip/tag (identical styling to standard chips)           |
| Can be removed?                | Yes — click ✕ on chip                                    |
| Can be replaced?               | Yes — new selection replaces existing                    |
| Can stack with standard words? | Yes — phrase sits alongside standard selections          |
| Chip styling                   | Identical to standard word chips — no visual distinction |

### 3.5 Trim Protection

| Trim Priority  | Content Type                                   | Protection Level                    |
| -------------- | ---------------------------------------------- | ----------------------------------- |
| 1 (never trim) | User-typed text in any category                | Sacred                              |
| 2 (never trim) | Subject selections (any source)                | Protected                           |
| 3 (protected)  | **Intelligent phrases (any category)**         | **Protected — trim as last resort** |
| 4 (trim first) | Standard dropdown selections, lowest relevance | Expendable                          |
| 5 (trim first) | Terms that conflict with majority              | Expendable                          |

### 3.6 Interaction with Existing Prompt Builder Features

| Feature                      | Impact                 | Notes                                              |
| ---------------------------- | ---------------------- | -------------------------------------------------- |
| 12-category dropdown system  | ✅ Unchanged           | Standard dropdowns work exactly as before          |
| Platform-aware limits        | ✅ Respected           | Phrase counts as 1 selection toward category limit |
| Auto-close behaviour         | ✅ Same                | Both dropdowns close on selection                  |
| 🎲 Randomise button          | ✅ Standard words only | Randomise does NOT insert phrases                  |
| Clear All button             | ✅ Clears phrases      | Removes all phrase selections                      |
| Lock states                  | ✅ Phrases locked too  | Intelligent dropdown disabled when locked          |
| Copy Prompt                  | ✅ Includes phrases    | Phrases in copied output at category position      |
| Open in Provider             | ✅ Unchanged           | No change                                          |
| Auto-trim on platform switch | ✅ Smart trim          | Phrases trimmed last (after standard words)        |
| Custom entry (free text)     | ✅ Independent         | User can type custom text AND have a phrase        |
| Negative category            | ❌ No phrases          | Positive only — no phrase dropdown for Negative    |
| Pro tier gating              | ❌ No gating           | Available to ALL users (free and paid)             |

### 3.7 Hook Integration

**File:** `src/hooks/use-intelligent-phrases.ts` (230 lines)

The hook runs alongside `use-prompt-intelligence` (no modification to existing hook). It manages:

- `phraseSelections: Record<PromptCategory, IntelligentPhrase | null>` — one phrase per category
- `searchPhrases(category, query)` — filters pre-filtered pool by typed query
- `getAvailablePhrases(category)` — returns cascading-filtered pool for a category
- Context rebuilding on select/remove
- Integration point: imported in `prompt-intelligence-builder.tsx` v1.1.0

---

## 4. Vocabulary Inventory (Verified from Source)

All counts verified by deep recursive parsing of every JSON file in the codebase on 12 February 2026.

### 4.1 Commodity Vocabulary — 21 JSON Files, 7,618 Phrases

| File                                   | Phrases | Description                                         |
| -------------------------------------- | ------- | --------------------------------------------------- |
| `commodity-vibes.json`                 | 2,756   | Primary scene imagery per commodity (deeply nested) |
| `production-countries.json`            | 767     | Regional landscapes, producers, region phrases      |
| `transformation-states.json`           | 624     | Processing, refining, manufacturing states          |
| `cross-population-merge.json`          | 281     | Cross-category bridge phrases                       |
| `end-use-sectors.json`                 | 281     | Industrial, consumer, commercial use                |
| `extraction-methods.json`              | 280     | Mining, drilling, farming methods                   |
| `weather-commodity-links.json`         | 274     | Weather ↔ commodity connections                     |
| `absence-states.json`                  | 240     | Scarcity, drought, shortage imagery                 |
| `shared-vocab-expansion.json`          | 220     | Expansion phrases for cross-population              |
| `geopolitical.json`                    | 208     | Trade wars, sanctions, geopolitics                  |
| `historical-moments.json`              | 208     | Key historical events per commodity                 |
| `night-operations.json`                | 187     | Night shift, 24h operations                         |
| `containers.json`                      | 186     | Barrels, silos, tankers, warehouses                 |
| `rituals.json`                         | 177     | Cultural ceremonies, traditions                     |
| `sensory-visual.json`                  | 150     | Colour, texture, appearance                         |
| `trading-culture.json`                 | 136     | Exchange floors, pit trading, digital               |
| `human-stories-traders-consumers.json` | 138     | Trading floor, market, consumer scenes              |
| `human-stories-workers.json`           | 126     | Miners, farmers, drillers, handlers                 |
| `sensory-touch-sound.json`             | 126     | Tactile, auditory properties                        |
| `sensory-smell-taste.json`             | 125     | Aroma, flavour (food/soft commodities)              |
| `price-states.json`                    | 128     | Bull/bear/sideways market phrases                   |

### 4.2 Weather Vocabulary — 6 JSON Files, 2,212 Phrases

| File               | Phrases | Description                      |
| ------------------ | ------- | -------------------------------- |
| `city-vibes.json`  | 730     | City-specific atmosphere phrases |
| `temperature.json` | 703     | Temperature range phrases        |
| `conditions.json`  | 327     | Weather condition phrases        |
| `time-of-day.json` | 199     | Time-period lighting phrases     |
| `humidity.json`    | 131     | Humidity level phrases           |
| `wind.json`        | 122     | Wind strength/direction phrases  |

### 4.3 Prompt Builder Vocabulary — 12 JSON Files, 3,955 Phrases

| File               | Phrases | Description                |
| ------------------ | ------- | -------------------------- |
| `negative.json`    | 352     | Negative prompt exclusions |
| `atmosphere.json`  | 346     | Mood and feel              |
| `lighting.json`    | 341     | Light sources and quality  |
| `camera.json`      | 339     | Lens and angle options     |
| `colour.json`      | 333     | Palettes and grades        |
| `style.json`       | 332     | Art styles and approaches  |
| `subject.json`     | 332     | People, objects, scenes    |
| `materials.json`   | 325     | Textures and surfaces      |
| `fidelity.json`    | 317     | Quality and resolution     |
| `action.json`      | 314     | Poses and movements        |
| `environment.json` | 313     | Locations and settings     |
| `composition.json` | 311     | Framing and layout         |

### 4.4 Shared Vocabulary — 3 JSON Files, 2,169 Phrases

| File                | Phrases | Description                       |
| ------------------- | ------- | --------------------------------- |
| `adjectives.json`   | 1,136   | Descriptive modifiers             |
| `connectors.json`   | 531     | Phrase connectors and transitions |
| `intensifiers.json` | 502     | Emphasis modifiers                |

### 4.5 Intelligence Vocabulary — 5 JSON Files, 244 Entries

| File                  | Entries | Description                |
| --------------------- | ------- | -------------------------- |
| `conflicts.json`      | 90      | Conflict detection rules   |
| `families.json`       | 47      | Style family definitions   |
| `market-moods.json`   | 41      | Market mood boost configs  |
| `semantic-tags.json`  | 38      | Semantic tag definitions   |
| `platform-hints.json` | 28      | Platform-specific guidance |

### 4.6 Grand Total

| Source                    | Files  | Entries    |
| ------------------------- | ------ | ---------- |
| Commodity vocabulary      | 21     | 7,618      |
| Weather vocabulary        | 6      | 2,212      |
| Prompt builder vocabulary | 12     | 3,955      |
| Shared vocabulary         | 3      | 2,169      |
| Intelligence vocabulary   | 5      | 244        |
| **TOTAL**                 | **47** | **16,198** |

---

## 5. Blueprint Prompt System

### 5.1 Architecture

The blueprint system (new in v3.0) replaces the generic vocabulary-sampling approach from v2. Instead of randomly selecting phrases from 21 commodity vocabulary files and combining them, prompts are **authored per commodity, per stage, per environment** in structured JSON blueprint files.

The pipeline:

```
Input → Blueprint Loader → Blueprint Resolver → 4-Tier Assembler → Output
         (reads JSONs)      (picks stage/env)    (formats per tier)
```

**Files:**

| File                                 | Role                                             | Lines    |
| ------------------------------------ | ------------------------------------------------ | -------- |
| `prompt-blueprint-types.ts`          | TypeScript interfaces for blueprint data         | NEW      |
| `prompt-blueprint-loader.ts`         | Reads 4 JSON files + time-of-day at module init  | NEW      |
| `prompt-blueprint-resolver.ts`       | Picks stage, environment, weather, time-of-day   | NEW      |
| `commodity-prompt-generator.ts` v4.0 | Orchestrates blueprint → prompt, legacy fallback | MODIFIED |
| `commodity-prompt-types.ts` v3.0     | AllTierPrompts, SentimentLevel, output shape     | MODIFIED |

### 5.2 Blueprint JSON Files

| File               | Commodities        | Location                        |
| ------------------ | ------------------ | ------------------------------- |
| `energy.json`      | 13                 | `src/data/commodities/prompts/` |
| `agriculture.json` | 34                 | `src/data/commodities/prompts/` |
| `metals.json`      | 28                 | `src/data/commodities/prompts/` |
| `plastics.json`    | 3                  | `src/data/commodities/prompts/` |
| `time-of-day.json` | — (4 periods)      | `src/data/commodities/prompts/` |
| **TOTAL**          | **78 commodities** |                                 |

### 5.3 Blueprint Structure

Each commodity has multiple **stages** (production/processing steps), and each stage has multiple **environments** (country-specific or default settings):

```
commodity (e.g., "brent_crude")
  └── stage (e.g., "offshore_extraction")
        ├── subject: "offshore oil platform..."
        ├── lens: "wide establishing shot..."
        ├── enhancer: "industrial steel..."
        ├── environments:
        │     ├── _default: "north sea grey waters..."
        │     ├── NO: "norwegian fjord cold dawn..."
        │     ├── SA: "arabian gulf turquoise..."
        │     └── BR: "brazilian pre-salt deep ocean..."
        └── (next stage...)
```

### 5.4 Blueprint Scale

| Metric                              | Count                            |
| ----------------------------------- | -------------------------------- |
| Commodities                         | 78                               |
| Stages                              | 336                              |
| Environments (including `_default`) | 1,222                            |
| Time-of-day periods                 | 4 (dawn, morning, golden, night) |
| **Estimated unique combinations**   | **~49,000**                      |

The ~49,000 figure comes from: each commodity × its stages × its environments × 4 time-of-day periods × weather variations.

### 5.5 Blueprint Resolver Logic

The resolver (`prompt-blueprint-resolver.ts`) takes the raw input and produces a `ResolvedBlueprint`:

1. **Stage selection** — seeded random from commodity's available stages
2. **Environment selection** — match scene country code → specific environment, fall back to `_default`
3. **Weather lighting** — derived from live weather data (if available and commodity is weather-sensitive)
4. **Time-of-day lighting** — mapped from commodity's production timezone → one of 4 periods (dawn, morning, golden, night)

**Critical rule:** No temperature numbers (°C or °F) appear in any tier output. Weather influence is expressed through descriptive language only (e.g., "harsh midday heat" not "38°C heat").

### 5.6 Four-Tier Assembly

The assembler takes a `ResolvedBlueprint` and formats it for each platform tier:

**Tier 1 — CLIP-Based (Stable Diffusion, Leonardo, Flux, ComfyUI):**
Weighted token syntax with parentheses, `--no` suffix.

**Tier 2 — Midjourney:**
Structured natural language with `--ar 16:9 --style raw` parameters.

**Tier 3 — Natural Language (DALL·E, Imagen, Adobe Firefly):**
Full descriptive sentences, no special syntax.

**Tier 4 — Plain Language (Canva, Craiyon, Microsoft Designer):**
Simplified, shorter, accessible language.

**All 4 tiers are always generated** regardless of user's selected tier. The `allPrompts` object contains all four; the `prompt` field contains just the selected tier's output.

### 5.7 Legacy Fallback

If no blueprint exists for a commodity (shouldn't happen for the 78 in catalog, but safety net), the generator falls back to the v3.0 legacy engine that uses the weather-phrase system (`getTempFeel`, `getWindEnergy`, `getTimeMood`) from the city prompt generator.

---

## 6. Country-Commodities Map

### 6.1 Source File

**File:** `src/data/commodities/country-commodities.map.json`  
**Structure:** 69 countries, each with 9 commodities (3 energy, 3 agriculture, 3 metals)

```json
{
  "country": "🇦🇷 Argentina",
  "energy": ["brent_crude", "natural_gas_henry_hub", "ethanol"],
  "agriculture": ["soybeans", "corn", "wheat"],
  "metals": ["lithium", "copper", "gold"]
}
```

### 6.2 Reverse Lookup — Commodity → Country Pool

The generator builds a reverse map at initialisation: `commodityId → string[]` (array of country ISO2 codes).

| Commodity   | Pool Size | Description                     |
| ----------- | --------- | ------------------------------- |
| Brent Crude | 64        | Widest pool — traded everywhere |
| Wheat       | 44        | Major agricultural staple       |
| Gold        | 34        | Precious metal, broad trading   |
| Coffee      | 10        | Producer-concentrated           |
| Cobalt      | 1         | Cameroon only                   |

### 6.3 Country Name Extraction

Country names in the JSON include emoji prefixes. The generator strips the emoji:

```typescript
function extractCountryName(raw: string): string {
  return raw.replace(/^[\u{1F1E0}-\u{1F1FF}]{2}\s*/u, '').trim();
}
```

### 6.4 Random Country Selection for Tooltip

When generating a commodity tooltip prompt:

1. Look up commodity in reverse map → array of country codes
2. Use seeded random (based on commodityId + deltaPct) to pick one country
3. Resolve that country's nearest exchange city for weather data
4. Use the country name and regional context in the prompt
5. If country has a specific blueprint environment → use it; otherwise → `_default`

**Visual variety:** Gold with 34 countries = 34 completely different scenes. Each data refresh (price change) → new seed → potentially new country. User sees a South African mine one moment, an Australian outback dig the next, then a Peruvian mountain extraction.

---

## 7. Weather Data Pipeline

### 7.1 Existing Infrastructure

The gateway already fetches weather for **89 exchanges across 83 unique lat/lon coordinates** (75 unique country codes) using OpenWeatherMap API. Data is cached with 1-hour TTL and rotated across 4 batches (A/B/C/D), refreshing at :10 each hour. No additional API calls needed — commodity prompts read from the existing weather cache.

### 7.2 Country → Nearest Exchange City Mapping

**Implementation:** `src/lib/commodities/country-weather-resolver.ts`

Every flag that can appear on a commodity card must resolve to a weather-data-bearing exchange city.

**Direct coverage — 49 of 69 countries have an exchange in-country.** Examples:

| Country | Exchange City      | Exchange ID                  |
| ------- | ------------------ | ---------------------------- |
| US      | New York / Chicago | nyse-new-york / cboe-chicago |
| GB      | London             | lse-london                   |
| JP      | Tokyo              | tse-tokyo                    |
| AU      | Sydney             | asx-sydney                   |
| DE      | Frankfurt          | xetra-frankfurt              |

**Proxy mapping — 20 countries without a local exchange.** Examples:

| Country         | Proxy Exchange City | Approx Distance |
| --------------- | ------------------- | --------------- |
| BG Bulgaria     | Athens (GR)         | ~600km          |
| EE Estonia      | Helsinki (FI)       | ~80km           |
| CM Cameroon     | Lagos (NG)          | ~900km          |
| PL Poland       | Prague (CZ)         | ~500km          |
| SA Saudi Arabia | Dubai (AE)          | ~1,200km        |

**EU flag special case:** EU → Frankfurt (DE) — `xetra-frankfurt`.

### 7.3 Weather Resolution Rules

```
1. Resolve sceneCountryCode → exchange ID (direct or proxy)
2. Look up weather in existing cache (keyed by exchange ID)
3. If weather data exists (real API data) → use it
4. If weather data is null/missing → skip weather layer entirely
5. NEVER invent, fabricate, or use demo weather data
```

### 7.4 Season Derivation

Season is derived from the **scene country's hemisphere** + current date. Implemented in `country-weather-resolver.ts`.

For countries with exchanges: use the `hemisphere` field from exchange catalog.  
For proxy countries: infer hemisphere from latitude.

| Months  | Northern Hemisphere | Southern Hemisphere |
| ------- | ------------------- | ------------------- |
| Dec-Feb | Winter              | Summer              |
| Mar-May | Spring              | Autumn              |
| Jun-Aug | Summer              | Winter              |
| Sep-Nov | Autumn              | Spring              |

### 7.5 Weather-Sensitive Commodity Rules

Not all commodities are affected by weather equally. The blueprint resolver checks the commodity's group:

| Group                                 | Weather Sensitivity | Blueprint Behaviour             |
| ------------------------------------- | ------------------- | ------------------------------- |
| Agriculture (grains, softs, oilseeds) | ✅ High             | Weather lighting layer included |
| Agriculture (livestock)               | ✅ Medium           | Weather lighting layer included |
| Energy (crude, gas, coal)             | ✅ Medium           | Weather lighting layer included |
| Metals (all)                          | ❌ Low              | Weather lighting layer SKIPPED  |

When weather sensitivity is Low, the blueprint resolver skips the weather lighting phrase entirely to avoid forced connections like "sunny day at the gold vault."

---

## 8. Prompt Assembly — How It Actually Works

### 8.1 Blueprint Path (78 commodities)

The blueprint assembler combines 6 layers into a prompt:

```
[subject] + [lens] + [enhancer] + [environment] + [weather lighting] + [time-of-day lighting]
```

Each layer comes from the resolved blueprint:

| Layer            | Source                             | Example (Brent Crude, Norway, Morning)           |
| ---------------- | ---------------------------------- | ------------------------------------------------ |
| Subject          | Blueprint stage `.subject`         | "offshore oil platform extraction operations"    |
| Lens             | Blueprint stage `.lens`            | "wide establishing shot industrial scale"        |
| Enhancer         | Blueprint stage `.enhancer`        | "steel infrastructure weathered by salt spray"   |
| Environment      | Blueprint stage `.environments.NO` | "norwegian north sea grey waters cold dawn mist" |
| Weather lighting | Live weather → descriptor          | "overcast flat lighting heavy cloud cover"       |
| Time-of-day      | Timezone → period                  | "early morning soft diffused light low angle"    |

### 8.2 Tier Formatting Examples

**Input:** Brent Crude, Norway scene, +3.2% (confident), morning, overcast

**Tier 1 (CLIP-Based):**

```
(offshore oil platform:1.3), norwegian north sea, (industrial extraction:1.2),
steel infrastructure salt spray, grey waters cold dawn mist, overcast flat lighting,
morning diffused light, confident productive atmosphere --no text logos watermark
```

**Tier 2 (Midjourney):**

```
Offshore oil platform extraction in the Norwegian North Sea, industrial steel
infrastructure weathered by salt spray, grey waters under cold dawn mist, overcast
flat lighting, early morning diffused light, confident productive atmosphere
--ar 16:9 --style raw
```

**Tier 3 (Natural Language):**

```
Offshore oil platform extraction operations in the Norwegian North Sea, industrial
steel infrastructure weathered by salt spray, grey waters stretching to horizon under
cold dawn mist, overcast flat lighting with heavy cloud cover, early morning soft
diffused light at low angle, confident productive atmosphere, cinematic documentary style
```

**Tier 4 (Plain Language):**

```
Oil platform in the North Sea near Norway, grey waters and cold morning mist,
steel structures, overcast sky, calm productive atmosphere
```

### 8.3 Same Commodity, Different Scene

**Gold — scene = South Africa, morning:**

```
Deep-level gold mine shaft in the South African Witwatersrand, underground rock
face lit by headlamp beams, warm golden ore veins glistening...
```

**Gold — next refresh → scene = Australia:**

```
Australian outback gold prospecting operation, red dust terrain stretching to
horizon, open-pit excavation under harsh sun...
```

Same commodity, same hovered flag — completely different scene.

### 8.4 Same Commodity, Different Sentiment

**Coffee — Brazil, DOWN -4.8% (neutral):**

```
Rain-soaked coffee plantation in Minas Gerais Brazil, red earth between terraced
rows under heavy overcast sky, muted desaturated tones, contemplative atmosphere...
```

**Coffee — Brazil, UP +3.1% (confident):**

```
Sun-drenched coffee plantation in Minas Gerais Brazil, vibrant red earth between
lush green rows, warm golden morning light, confident productive atmosphere...
```

---

## 9. Cascading Intelligence Engine

### 9.1 Implementation

**File:** `src/lib/prompt-intelligence/phrase-filter.ts` (476 lines)

The 11 prompt builder categories are ordered top-to-bottom. Selections in upper categories filter what appears in the intelligent phrases dropdown of lower categories.

```
Subject    → ALL phrases shown (anchor point, no filter)
  ↓ context propagates
Action     → Filtered by Subject's commodity/city/environment tags
  ↓
Style      → Minimal filtering (artistic choice, mostly unconstrained)
  ↓
Environment → Filtered by Subject + Action context
  ↓
Composition → Minimal filtering (technical)
  ↓
Camera     → Minimal filtering (technical)
  ↓
Lighting   → Filtered by accumulated context (environment, mood, time)
  ↓
Colour     → Filtered by accumulated context (commodity, mood, environment)
  ↓
Atmosphere → Filtered by accumulated context (commodity, sentiment, weather)
  ↓
Materials  → Filtered by accumulated context (commodity, environment)
  ↓
Fidelity   → Minimal filtering (technical)
```

### 9.2 Filter Categories

**Content-driven categories** (filtering applied): Subject, Action, Environment, Lighting, Colour, Atmosphere, Materials

**Technical categories** (show all phrases, no filtering): Style, Composition, Camera, Fidelity

### 9.3 Context Matching

The filter uses a score-based approach with 50% tag overlap threshold:

```typescript
function matchesContext(phrase: IntelligentPhrase, ctx: PromptContext): boolean {
  // If no context accumulated yet, show all
  if (!ctx.commodityId && !ctx.cityId && !ctx.environmentType) return true;

  let score = 0;
  let checks = 0;

  // Check commodityId, commodityGroup, environmentType, mood, lightingCharacter
  // Each matching tag increments score

  if (checks === 0) return true; // No checks applicable, phrase passes
  return score / checks >= 0.5; // Require at least 50% tag overlap
}
```

### 9.4 Re-anchoring on Conflict

If the user picks a commodity phrase in Subject ("gold mine shaft") but then picks "beach" as a standard word in Environment, the system does NOT fight the user:

1. Environment selection is respected (user intent is sacred)
2. Context updates to include BOTH underground + beach
3. Downstream dropdowns show phrases relevant to either context
4. Creative freedom to make unexpected combinations

### 9.5 Phrase Category Map

**File:** `src/data/vocabulary/phrase-category-map.ts` (1,247 lines)

Master registry that maps all ~7,500 vocabulary phrase placements to prompt builder categories with rich tagging metadata. Built once at module load (lazy singleton). Each source JSON has a dedicated mapper function.

---

## 10. Technical Architecture

### 10.1 File Map — All Implemented Files

```
src/lib/commodities/
├── prompt-blueprint-types.ts          # Blueprint TS interfaces              (NEW)
├── prompt-blueprint-loader.ts         # Reads 4 JSON + time-of-day          (NEW)
├── prompt-blueprint-resolver.ts       # Picks stage/env/weather/time         (NEW)
├── commodity-prompt-generator.ts      # v4.0 Blueprint-driven, 4-tier        (MODIFIED)
├── commodity-prompt-types.ts          # v3.0 AllTierPrompts, SentimentLevel  (MODIFIED)
├── country-weather-resolver.ts        # 69 countries + EU → exchange weather (BUILT)
├── catalog.ts                         # Commodity catalog access
├── convert.ts                         # Currency conversion
├── providers.ts                       # Data providers
├── retail-units.ts                    # Retail unit formatting
├── route.ts                           # API route helpers
└── sort-movers.ts                     # Mover sorting logic

src/data/commodities/prompts/
├── energy.json                        # 13 commodities                       (NEW)
├── agriculture.json                   # 34 commodities                       (NEW)
├── metals.json                        # 28 commodities                       (NEW)
├── plastics.json                      # 3 commodities                        (NEW)
└── time-of-day.json                   # 4 periods (dawn/morning/golden/night)(NEW)

src/components/ribbon/
├── commodity-prompt-tooltip.tsx        # v2.0 Pro multi-tier + Free single    (MODIFIED)
└── commodity-mover-card.tsx           # v3.0 All 4 flags wrapped             (MODIFIED)

src/hooks/
├── use-commodity-tooltip-data.ts      # Derives tooltip data from commodity   (NEW)
└── use-intelligent-phrases.ts         # Per-category phrase state + search    (NEW)

src/data/vocabulary/
└── phrase-category-map.ts             # ~7,500 phrase placements mapped       (NEW)

src/lib/prompt-intelligence/
└── phrase-filter.ts                   # Cascading filter engine, 476 lines    (NEW)

src/components/ui/
└── intelligent-phrases-combobox.tsx   # Adjacent dropdown, 442 lines          (NEW)

src/components/prompt-builder/
└── prompt-intelligence-builder.tsx    # v1.1.0 Combobox integrated alongside  (MODIFIED)
```

### 10.2 Data Flow — Commodity Tooltip

```
User hovers flag on CommodityMoverCard (v3.0)
  → CommodityPromptTooltip receives props via buildTooltipProps():
    - commodityId, commodityName, group (from card data)
    - deltaPct (from card data)
    - sceneCountryCode (from flag or use-commodity-tooltip-data hook)
    - season (derived from hemisphere + date)
    - weather (from country-weather-resolver → existing cache)
  → Generator (v4.0) resolves:
    1. Blueprint lookup: commodityId → blueprint JSON
    2. Stage selection: seeded random from commodity's stages
    3. Environment selection: sceneCountryCode → specific env or _default
    4. Weather lighting: weather data → descriptive phrase (no temperatures)
    5. Time-of-day: timezone → dawn/morning/golden/night
  → assembleAllBlueprintTiers() produces AllTierPrompts (all 4 tiers)
  → Returns CommodityPromptOutput with:
    - prompt (selected tier)
    - allPrompts (all 4 tiers)
    - sentiment (confident/optimistic/neutral)
    - group (energy/agriculture/metals)
    - blueprintUsed (true/false)
  → Tooltip renders via Portal with group-based glow colour
    - Free users: FreeTooltipContent (tier 4 only)
    - Pro users: ProTooltipContent (all 4 tiers, expandable)
```

### 10.3 Data Flow — Intelligent Phrases Dropdown

```
User opens prompt builder at /providers/[id]
  → prompt-intelligence-builder.tsx (v1.1.0) renders per category:
    - Standard Combobox (existing, unchanged)
    - IntelligentPhrasesCombobox (adjacent, from useIntelligentPhrases)
  → useIntelligentPhrases hook initialises:
    - Loads phrase-category-map (lazy singleton)
    - Initialises phraseSelections (all null)
  → User types in intelligent dropdown:
    - searchPhrases(category, query) called
    - First-letter matching on any word in phrase
    - Results additionally filtered by cascading context (phrase-filter.ts)
  → User selects phrase:
    - Both dropdowns close
    - Phrase appears as chip (identical to standard chips)
    - Context propagates to downstream categories via cascading engine
  → Prompt assembly:
    - Standard words + intelligent phrases comma-separated per category
    - Intelligent phrase protected from auto-trim
```

### 10.4 Component Props

```typescript
// CommodityPromptTooltip — actual props (commodity-prompt-tooltip.tsx v2.0)
interface CommodityPromptTooltipProps {
  children: React.ReactNode;
  commodityId: string;
  commodityName: string;
  group: CommodityGroup;
  deltaPct: number;
  sceneCountryCode: string;
  season: Season;
  weather?: CommodityWeatherSlice | null;
  disabled?: boolean;
  isPro?: boolean; // ⏳ NOT YET PASSED — defaults to false
  tier?: PromptTier; // ⏳ NOT YET PASSED — defaults to 4
  tooltipPosition?: 'left' | 'right';
  verticalPosition?: 'center' | 'below';
}

// IntelligentPhrasesCombobox — actual props
interface IntelligentPhrasesComboboxProps {
  category: CategoryKey;
  promptContext: PromptContext;
  selectedPhrase: string | null;
  onPhraseChange: (phrase: string | null) => void;
  isLocked?: boolean;
  compact?: boolean;
}
```

---

## 11. Implementation Status

### All 6 Original Build Phases — COMPLETE

| Phase   | Description                  | File(s)                                                               | Status   |
| ------- | ---------------------------- | --------------------------------------------------------------------- | -------- |
| Phase 1 | Country-weather resolver     | `country-weather-resolver.ts`                                         | ✅ Built |
| Phase 2 | Commodity prompt generator   | `commodity-prompt-generator.ts` v4.0 + blueprint files                | ✅ Built |
| Phase 3 | Commodity prompt tooltip     | `commodity-prompt-tooltip.tsx` v2.0 + `commodity-mover-card.tsx` v3.0 | ✅ Built |
| Phase 4 | Phrase category map          | `phrase-category-map.ts`                                              | ✅ Built |
| Phase 5 | Cascading filter engine      | `phrase-filter.ts`                                                    | ✅ Built |
| Phase 6 | Intelligent phrases combobox | `intelligent-phrases-combobox.tsx` + `use-intelligent-phrases.ts`     | ✅ Built |

### Additional Work Completed (Beyond Original Phases)

| Work                                                                           | Files                                      | Status      |
| ------------------------------------------------------------------------------ | ------------------------------------------ | ----------- |
| Blueprint prompt system (types, loader, resolver)                              | 3 new files in `src/lib/commodities/`      | ✅ Built    |
| Blueprint JSON data (78 commodities, 336 stages, 1,222 environments)           | 5 files in `src/data/commodities/prompts/` | ✅ Built    |
| Time-of-day lighting layer (4 periods)                                         | `time-of-day.json`                         | ✅ Built    |
| Country environment backfill (208 new environments across 25 thin commodities) | Integrated into blueprint JSONs            | ✅ Built    |
| AllTierPrompts (all 4 tiers always generated)                                  | `commodity-prompt-types.ts`                | ✅ Built    |
| Pro multi-tier tooltip display                                                 | `commodity-prompt-tooltip.tsx` v2.0        | ✅ Built    |
| Commodity tooltip data hook                                                    | `use-commodity-tooltip-data.ts`            | ✅ Built    |
| Prompt intelligence builder integration                                        | `prompt-intelligence-builder.tsx` v1.1.0   | ✅ Modified |

---

## 12. Wiring Checklist — What Remains

These are the **only remaining tasks** to connect the fully-built components to live user state:

### 12.1 Pro Subscription Wiring

**File to modify:** `src/components/ribbon/commodity-mover-card.tsx`

Currently `buildTooltipProps()` does NOT pass `isPro` or `tier`. Both default safely (`isPro={false}`, `tier=4`).

**To connect:**

```typescript
// In buildTooltipProps() — add these two props:
function buildTooltipProps(flagCountryCode: string) {
  return {
    commodityId: id,
    commodityName: name,
    group: tooltipData.group,
    deltaPct,
    sceneCountryCode: flagCountryCode,
    season: deriveSeason(flagCountryCode) ?? ('summer' as const),
    weather: buildWeatherSlice(flagCountryCode),
    disabled: !tooltipData.available,
    verticalPosition: 'below' as const,
    isPro: isProUser, // ← ADD: from usePromagenAuth or equivalent
    tier: selectedTier, // ← ADD: from useWeatherPromptTier or user pref
  };
}
```

**Depends on:** `usePromagenAuth()` hook providing `userTier === 'paid'` and a tier preference hook.

### 12.2 Verification After Wiring

```powershell
# Run from repo root
npx tsc --noEmit
```

**Expected:**

- Zero TypeScript errors
- Free user: tooltip shows single tier 4 prompt (unchanged from current)
- Pro user: tooltip shows all 4 tiers with expandable rows and individual copy buttons
- Blueprint indicator visible when authored content used
- Glow colour matches commodity group (amber=energy, green=agriculture, silver=metals)

---

## 13. Decisions Log

All decisions confirmed during design and build conversations:

| #   | Question                                  | Decision                                                                                                    | Date        |
| --- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------- |
| 1   | Glow colour                               | Commodity group-based: energy=amber, agriculture=green, metals=silver. Sentiment modulates warmth/coolness. | 10 Feb 2026 |
| 2   | Which flags get tooltips?                 | ALL 4 flags: base price flag + 3 conversion flags                                                           | 10 Feb 2026 |
| 3   | Prompt builder vocabulary merge approach  | Adjacent dropdown with type-to-discover phrases (not dumped into existing dropdowns)                        | 10 Feb 2026 |
| 4   | Weather data source for commodity prompts | Use only real API weather data from nearest exchange city. If null, skip weather entirely. Never fabricate. | 10 Feb 2026 |
| 5   | Season derivation                         | Based on scene country's hemisphere + current date                                                          | 10 Feb 2026 |
| 6   | 🎲 Randomise + phrases                    | Standard words only — phrases are deliberate user choices                                                   | 10 Feb 2026 |
| 7   | Pro tier gating for phrases               | Available to ALL users (free and paid)                                                                      | 10 Feb 2026 |
| 8   | Phrase chip styling                       | Identical to standard chips — no visual distinction                                                         | 10 Feb 2026 |
| 9   | One phrase per category                   | Strict — selecting a new phrase replaces the existing one                                                   | 10 Feb 2026 |
| 10  | Trim protection for phrases               | Protected — trimmed as last resort after standard words                                                     | 10 Feb 2026 |
| 11  | Country-commodities map                   | Integrated — 69 countries, random scene country selection per prompt                                        | 10 Feb 2026 |
| 12  | EU flag weather mapping                   | Frankfurt (DE) — xetra-frankfurt                                                                            | 10 Feb 2026 |
| 13  | Cascading context filtering               | Content-driven categories filtered; technical categories show all                                           | 10 Feb 2026 |
| 14  | Sentiment levels                          | Reduced from 7 (euphoria→despair) to 3 (confident/optimistic/neutral)                                       | 11 Feb 2026 |
| 15  | Temperature in prompts                    | Explicitly excluded — no °C/°F in any tier                                                                  | 11 Feb 2026 |
| 16  | Prompt source architecture                | Blueprint-driven authored prompts replace generic vocabulary sampling                                       | 11 Feb 2026 |
| 17  | Tier generation                           | All 4 tiers always generated (AllTierPrompts) regardless of user selection                                  | 11 Feb 2026 |
| 18  | Pro tooltip display                       | Multi-tier with expandable rows, individual copy buttons, tier colour system                                | 12 Feb 2026 |
| 19  | Time-of-day lighting                      | 4 periods (dawn/morning/golden/night) mapped from commodity timezone                                        | 11 Feb 2026 |
| 20  | Country environment backfill              | 208 new environments across 25 thin commodities                                                             | 11 Feb 2026 |

---

## 14. Non-Regression Rules

When implementing remaining wiring or future modifications:

- Do NOT modify existing standard dropdown behaviour
- Do NOT modify the Combobox component's existing API
- Do NOT modify exchange card weather tooltips
- Do NOT modify prompt assembly order (subject first, then categories in order)
- Do NOT modify platform-aware limits or auto-close behaviour
- Do NOT modify lock states or authentication flows
- Do NOT modify the commodities movers grid layout or sorting
- Do NOT modify the FX ribbon
- Do NOT break existing prompt builder functionality for any user tier
- Do NOT add mobile layouts or breakpoints (desktop-only, dynamic scaling)
- Do NOT use demo or fabricated weather data — only real API data
- Do NOT add temperature numbers (°C/°F) to prompt output
- Do NOT modify the blueprint JSON files without updating all 4 tiers
- Do NOT modify the 3-level sentiment system (confident/optimistic/neutral)
- Preserve all existing prompt building functionality for authenticated users
- Existing features preserved: **Yes** (required for every change)

---

_Document ends. v3.0 — complete rewrite from implementation audit. All file paths, line counts, phrase counts, and implementation status verified against src.zip codebase on 12 February 2026. Previous v2 design doc superseded._
