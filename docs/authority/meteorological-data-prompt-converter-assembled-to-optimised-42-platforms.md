# Meteorological Data → Prompt Converter: Assembled to Optimised (42 Platforms)

**Last updated:** 7 March 2026
**Version:** 1.0.0
**Owner:** Promagen
**Status:** Verified — zero bugs found in end-to-end audit
**Authority:** This document traces the complete pipeline from raw meteorological data through to optimised prompts for all 42 AI image generation platforms. Cross-referenced against `src.zip` (7 March 2026).

---

## Table of Contents

1. [Pipeline Overview](#1-pipeline-overview)
2. [Stage 1 — Meteorological Data Ingestion](#2-stage-1--meteorological-data-ingestion)
3. [Stage 2 — Physics Computation (17 Algorithms)](#3-stage-2--physics-computation-17-algorithms)
4. [Stage 3 — Weather Category Mapping](#4-stage-3--weather-category-mapping)
5. [Stage 4 — Selections Flattening](#5-stage-4--selections-flattening)
6. [Stage 5 — Synergy Rewriting](#6-stage-5--synergy-rewriting)
7. [Stage 6 — Tier-Aware Assembly](#7-stage-6--tier-aware-assembly)
8. [Stage 7 — Post-Processing](#8-stage-7--post-processing)
9. [Stage 8 — Per-Platform Optimisation](#9-stage-8--per-platform-optimisation)
10. [Platform-Tier Matrix (42 Platforms × 4 Tiers)](#10-platform-tier-matrix-42-platforms--4-tiers)
11. [Data Integrity Verification](#11-data-integrity-verification)
12. [Observations (Non-Bugs)](#12-observations-non-bugs)
13. [File Reference](#13-file-reference)

---

## 1. Pipeline Overview

Raw weather API data enters the system and exits as an optimised prompt formatted for a specific platform. The pipeline has 8 stages, each with a single responsibility. No stage knows about the stages after it — data flows forward only.

```
┌─────────────────────────────────────────────────────────────────────┐
│                     THE COMPLETE PIPELINE                            │
│                                                                     │
│  METEOROLOGICAL DATA (OpenWeatherMap API)                           │
│        │                                                            │
│        ▼                                                            │
│  Stage 1: Data Ingestion                                            │
│        │  temperature, humidity, wind, clouds, pressure,            │
│        │  visibility, sunrise/sunset, lat/lon                       │
│        ▼                                                            │
│  Stage 2: Physics Computation (17 algorithms)                       │
│        │  solar elevation, lighting engine, visual truth,           │
│        │  camera lens, wind system, cloud types, moon phase,        │
│        │  composition blueprint, climate context                    │
│        ▼                                                            │
│  Stage 3: Weather Category Mapping                                  │
│        │  buildWeatherCategoryMap() → WeatherCategoryMap            │
│        │  12 categories: selections + customValues + weights        │
│        ▼                                                            │
│  Stage 4: Selections Flattening                                     │
│        │  selectionsFromMap() → PromptSelections                    │
│        │  Deduplicates selection ⊂ customValue redundancy           │
│        ▼                                                            │
│  Stage 5: Synergy Rewriting                                         │
│        │  rewriteWithSynergy() → conflict resolution               │
│        │  "golden hour" + "midnight" → resolve contradiction        │
│        ▼                                                            │
│  Stage 6: Tier-Aware Assembly                                       │
│        │  assemblePrompt(refPlatform, selections, weightOverrides)  │
│        │  Routes to: assembleKeywords() | assembleNaturalSentences()│
│        │             assemblePlainLanguage()                        │
│        ▼                                                            │
│  Stage 7: Post-Processing                                           │
│        │  neutraliseLeakPhrases(), fixCommonGrammar(),              │
│        │  postProcessTier1Positive(), removeRedundantPhenomenon()   │
│        ▼                                                            │
│  Stage 8: Per-Platform Optimisation                                 │
│        │  optimizePromptGoldStandard()                              │
│        │  4 strategy pipelines: keywords | midjourney | natural |   │
│        │  plain — semantic similarity, compression, BPE tokens      │
│        ▼                                                            │
│  OPTIMISED PROMPT (formatted for specific platform)                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Key design principle:** The weather generator is intelligence-only — it computes WHAT the scene looks like. The prompt builder is the single assembly engine — it formats HOW the prompt reads. One brain. One output path. Every prompt in Promagen passes through `assemblePrompt()`.

---

## 2. Stage 1 — Meteorological Data Ingestion

**Source:** OpenWeatherMap API via gateway server (`src/lib/weather/fetch-weather.ts`).

**Raw data fields consumed:**

| Field                      | Type   | Example         | Purpose                                           |
| -------------------------- | ------ | --------------- | ------------------------------------------------- |
| `temperatureC`             | number | 14              | Thermal phrases, atmosphere, colour temperature   |
| `humidity`                 | number | 82              | Moisture visibility, surface grounding, dew point |
| `windSpeedKmh`             | number | 15              | Beaufort classification, action phrases           |
| `windDegrees`              | number | 225             | Directional wind phrases                          |
| `cloudCover`               | number | 75              | Lighting engine cloud floor, sky descriptions     |
| `visibility`               | number | 8000            | Air clarity, atmospheric haze                     |
| `pressure`                 | number | 1013            | Atmospheric density effects                       |
| `conditions`               | string | "broken clouds" | Atmosphere vocabulary mapping                     |
| `sunriseUtc` / `sunsetUtc` | string | ISO timestamp   | Day/night resolution, golden/blue hour            |
| `latitude` / `longitude`   | number | 35.68 / 139.69  | Solar elevation, climate zone                     |

**Additional inputs (not from API):**

| Input      | Source                                        | Purpose                    |
| ---------- | --------------------------------------------- | -------------------------- |
| City name  | `city-vibes.json` SSOT (102 cities)           | Subject term, venue lookup |
| Venue      | `getCityVenue(city, seed)` or `venueOverride` | Environment category       |
| Local hour | Computed from UTC + timezone offset           | Time-of-day mood, lighting |
| Tier (1-4) | Caller specifies                              | Assembly format routing    |

---

## 3. Stage 2 — Physics Computation (17 Algorithms)

**File:** `src/lib/weather/weather-prompt-generator.ts` (487 lines) — orchestrator.

These 17 systems run in sequence, each producing structured data that feeds into the category mapper. They are deterministic — same inputs always produce same outputs.

| #   | Algorithm                       | File                                   | Input                                            | Output                                               |
| --- | ------------------------------- | -------------------------------------- | ------------------------------------------------ | ---------------------------------------------------- |
| 1   | Solar elevation calculator      | `sun-calculator.ts`                    | lat, lon, UTC time                               | Degrees above/below horizon                          |
| 2   | Lunar position calculator       | `sun-calculator.ts`                    | lat, lon, UTC time                               | Azimuth, altitude, phase                             |
| 3   | Precipitation classifier        | `visual-truth.ts`                      | conditions, visibility                           | type, intensity, active flag                         |
| 4   | Cloud type classifier           | `cloud-types.ts`                       | conditions, cloud cover                          | nimbostratus, cirrus, etc.                           |
| 5   | Solar phase resolver            | `time-utils.ts`                        | solar elevation                                  | golden hour, blue hour, etc.                         |
| 6   | Day/night resolver              | `day-night.ts`                         | sunrise, sunset, timezone                        | boolean + 3-tier cascade                             |
| 7   | Visual truth engine             | `visual-truth.ts` (1,301 lines)        | temperature, humidity, wind, precip              | air clarity, contrast, moisture, thermal optics      |
| 8   | Climate context                 | `climate.ts`                           | latitude, temperature, humidity                  | climate zone, effective humidity                     |
| 9   | Lighting engine                 | `lighting-engine.ts` (973 lines)       | solar elevation, clouds, visibility, moon, venue | base phrase, CCT, shadows, atmosphere modifier       |
| 10  | Wind system                     | `wind-system.ts`                       | wind speed, direction, venue                     | Beaufort class, directional phrase                   |
| 11  | Moon phase calculator           | `moon-phase.ts`                        | date                                             | phase name, emoji, day in cycle                      |
| 12  | Camera lens system              | `camera-lens.ts` (289 lines)           | style, venue setting, seed                       | focal length, aperture, DoF                          |
| 13  | Composition blueprint           | `composition-blueprint.ts` (506 lines) | camera, venue, categories                        | foreground/midground/background layers               |
| 14  | Vocabulary loaders              | `vocabulary-loaders.ts`                | weather context, seed                            | temperature phrase, humidity phrase, time descriptor |
| 15  | Sky source enrichment           | `tier-generators.ts` (stub)            | sky source, visual truth, seed                   | Cloud type + solar phase enrichment                  |
| 16  | Lighting coherence validator    | `lighting-engine.ts`                   | lighting, venue, city, moon                      | Safety net — catches contradictions                  |
| 17  | Precipitation-aware cloud floor | `weather-prompt-generator.ts`          | precip state, cloud cover                        | Forces minimum cloud cover during rain               |

**Precipitation cloud floor (algorithm 17):** OWM sometimes reports low cloudiness during active rain. Algorithm 17 forces minimum cloud cover: rain/drizzle → 60% floor (heavy rain → 90%), snow → 40% floor. This prevents contradictory prompts like "bright sun during heavy rain."

---

## 4. Stage 3 — Weather Category Mapping

**File:** `src/lib/weather/weather-category-mapper.ts` (581 lines)
**Function:** `buildWeatherCategoryMap()`

This is the bridge between physics and assembly. It converts 17 algorithm outputs into the 12 prompt builder categories. Each category gets three data layers:

| Layer             | Purpose                                       | Example                                                                 |
| ----------------- | --------------------------------------------- | ----------------------------------------------------------------------- |
| `selections`      | Vocabulary-matched term (dropdown-compatible) | `["golden hour"]`                                                       |
| `customValues`    | Rich physics-computed phrase (freetext)       | `"Warm golden-hour glow casting long shadows across wet cobblestones."` |
| `weightOverrides` | CLIP weight adjustment for Tier 1             | `1.3` (subject), `1.2` (environment)                                    |

**Category mapping (12 categories):**

| Category    | Source Algorithm                            | Selection Example                  | CustomValue Example                                                       |
| ----------- | ------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------- |
| Subject     | City name (SSOT)                            | `["Tokyo"]`                        | —                                                                         |
| Environment | Venue system                                | `["Shibuya Crossing"]`             | —                                                                         |
| Lighting    | Lighting engine → `matchLightingVocab()`    | `["golden hour"]`                  | `"Warm golden-hour glow. Broken cumulus overhead."`                       |
| Atmosphere  | Weather context → `matchAtmosphereVocab()`  | `["gentle drizzle curtain"]`       | `"Early evening, moisture-heavy air, 14°C thermal haze"`                  |
| Style       | Profile → `mapStyleVocab()`                 | `["photorealistic"]`               | —                                                                         |
| Colour      | CCT → `mapColourFromCCT()`                  | `["warm tones"]`                   | —                                                                         |
| Fidelity    | Camera system → `getQualityTagsT1()`        | `["8K", "sharp focus"]`            | —                                                                         |
| Materials   | Visual truth → `composeSurfaceSentence()`   | —                                  | `"Rain-slicked pavement reflecting neon, dew-heavy surfaces"`             |
| Action      | Wind system → `getWindPhrase()`             | —                                  | `"Southerly 15 km/h wind stirring loose paper and awnings"`               |
| Camera      | Camera lens → `matchCameraVocab()`          | `["35mm lens"]`                    | `"Shot on Sony A7III with 35mm f/1.4"`                                    |
| Composition | Blueprint → `computeCompositionBlueprint()` | `["leading lines"]`                | `"Foreground rain puddles, midground neon signs, background city towers"` |
| Negative    | Quiet-hours logic                           | `["blurry", "watermarks", "text"]` | —                                                                         |

**Confidence scoring:** Each category gets a 0–1 confidence score. Subject = 1.0 (always certain). Lighting = 0.95 with visual truth, 0.6 without. Atmosphere = 0.5 on generic fallbacks. The UI uses confidence for chip opacity in the builder.

---

## 5. Stage 4 — Selections Flattening

**File:** `src/lib/prompt-builder.ts` (line 1695)
**Function:** `selectionsFromMap()`

Converts `WeatherCategoryMap` into flat `PromptSelections` (the format `assemblePrompt()` consumes).

**Key logic — redundancy elimination (Upgrade 1, v11.1.0):**

When a `customValue` contains a `selection` term as a substring, the selection is dropped. The customValue is always the richer phrase.

Example:

- Selection: `["moonlight"]`
- CustomValue: `"Cool white moonlight competing with focused accent lighting"`
- Result: `["Cool white moonlight competing with focused accent lighting"]` (selection "moonlight" dropped — it's inside the customValue)

When a selection is NOT contained in the customValue, it's kept as an independent term:

- Selection: `["contemplative"]`
- CustomValue: `"fog rolling through urban canyon"`
- Result: `["contemplative", "fog rolling through urban canyon"]` (both kept)

Negatives are mapped to the `negative` category key.

---

## 6. Stage 5 — Synergy Rewriting

**File:** `src/lib/weather/synergy-rewriter.ts` (600 lines)
**Function:** `rewriteWithSynergy()`

Resolves physics contradictions and reinforces complementary pairs:

**Conflict resolution:** "golden hour" (lighting) + "midnight" (atmosphere) → replaces "golden hour" with "amber artificial light" (because golden hour can't exist at midnight).

**Reinforcement bridging:** "moonlight" (lighting) + "contemplative" (atmosphere) → injects connecting phrase that bridges the two for stronger prompt coherence.

The rewriter runs between flattening and assembly. It modifies selections in-place — the assembler receives already-resolved data.

---

## 7. Stage 6 — Tier-Aware Assembly

**File:** `src/lib/prompt-builder.ts` (line 1388)
**Function:** `assemblePrompt()` → `assembleTierAware()`

This is the **single brain**. Every prompt in Promagen — weather-generated, user-built, scene-starter, randomiser — passes through this function.

**Routing logic in `assembleTierAware()` (line 1146):**

```
if tierId === 4           → assemblePlainLanguage()
else if promptStyle === 'keywords' → assembleKeywords()
else                      → assembleNaturalSentences()
```

**Pre-assembly processing:**

1. **Within-category dedup** — drops short terms that are substrings of longer terms in the same category
2. **Cross-category dedup** — same term in two categories → kept only in the first (higher-priority) category
3. **Weight merge** — weather `weightOverrides` provide a base layer; platform `weightedCategories` spread on top. Platform wins on conflicts.

### 7.1 Tier 1 — CLIP-Based Assembly (`assembleKeywords`)

**Reference platform:** `leonardo` (weight syntax: `{term}::{weight}`)
**13 platforms:** artguru, clipdrop, dreamlike, dreamstudio, getimg, jasper-art, leonardo, lexica, nightcafe, novelai, openart, playground, stability

**Assembly flow:**

1. Quality prefix: `["masterpiece", "best quality", "highly detailed"]`
2. Selections in impact-priority order, with CLIP weight wrapping on short terms
3. Quality suffix: `["sharp focus", "8K", "intricate textures"]`
4. Trim to sweetSpot
5. CLIP syntax sanitiser: periods → commas, strip trailing periods
6. Negative handling: separate field with `qualityNegative` prepended

**Weight wrapping guard:** `if (weight && syntax)` — weight wrapping ONLY occurs when both a weight value exists AND the platform has `weightingSyntax` defined. Rich phrases (>4 words) skip weight wrapping entirely.

**Example output (Leonardo):**

```
masterpiece, best quality, highly detailed, Tokyo::1.2, Shibuya Crossing::1.05,
golden hour glow::1.1, photorealistic::1.15, warm tones, gentle drizzle curtain,
leading lines, shot on Sony A7III, sharp focus, 8K, intricate textures
```

**Negative field:**

```
worst quality, low quality, normal quality, blurry, watermarks, text, oversaturated
```

**Flux special handling:** The weather generator produces Flux prompts via `assemblePrompt('flux', selections)` — no `weightOverrides` passed. Flux has `promptStyle: keywords` but NO `weightingSyntax`, so `assembleKeywords()` produces clean comma-separated keywords without any weight wrapping. Correct for Flux's T5 encoder.

### 7.2 Tier 2 — Midjourney Assembly (`assembleKeywords`)

**Reference platform:** `midjourney`
**2 platforms:** midjourney, bluewillow

**Assembly flow:**

1. Quality suffix: `["high quality", "detailed"]`
2. Selections in impact-priority order (no weight wrapping — MJ has no `weightingSyntax`)
3. Trim to sweetSpot (40 words — MJ is brief)
4. Inline negatives with `--no {negative}` syntax

**Example output:**

```
Tokyo, Shibuya Crossing, golden hour, cinematic, gentle rain, neon reflections,
high quality, detailed --no blurry, watermarks, text, oversaturated
```

### 7.3 Tier 3 — Natural Language Assembly (`assembleNaturalSentences`)

**Reference platform:** `openai`
**10 platforms:** adobe-firefly, bing, flux, google-imagen, hotpot, ideogram, imagine-meta, microsoft-designer, openai, runway

**Assembly flow:**

1. Build sentence nucleus: Subject + Action + early Environment (with "in" prefix)
2. Append trailing clauses in effective order: style, lighting, atmosphere, etc.
3. Negatives converted to positive equivalents ("blurry" → "sharp focus") + "without" clauses
4. Trim to sweetSpot (250 chars for openai)

**Example output (DALL-E/OpenAI):**

```
Tokyo street in Shibuya Crossing, photorealistic, warm golden-hour glow casting
long shadows across wet cobblestones, gentle drizzle curtain, moisture-heavy air,
warm tones, leading lines composition, sharp focus, without blurry or watermarks
```

### 7.4 Tier 4 — Plain Language Assembly (`assemblePlainLanguage`)

**Reference platform:** `canva`
**17 platforms:** artbreeder, artistly, canva, craiyon, deepai, fotor, freepik, myedit, photoleap, picsart, picwish, pixlr, remove-bg, simplified, visme, vistacreate, 123rf

**Assembly flow:**

1. Collect all selections in impact-priority order
2. Rich phrases (>4 words) simplified to first 3 content words
3. Trim aggressively to sweetSpot (40 chars for canva)
4. No weight syntax, no quality prefix, no negative field

**Example output (Canva):**

```
Tokyo, Shibuya Crossing, golden hour, photorealistic, rain
```

---

## 8. Stage 7 — Post-Processing

**File:** `src/lib/prompt-post-process.ts`

Applied per-tier after assembly:

| Function                       | Applies To    | Purpose                                                                             |
| ------------------------------ | ------------- | ----------------------------------------------------------------------------------- |
| `neutraliseLeakPhrases()`      | All tiers     | Removes vocabulary terms that leaked from the weather engine's internal naming      |
| `fixCommonGrammar()`           | All tiers     | Fixes double spaces, stray punctuation, capitalisation errors                       |
| `postProcessTier1Positive()`   | Tier 1 only   | CLIP-specific cleanup: atmosphere modifier injection, redundant fidelity dedup      |
| `removeRedundantPhenomenon()`  | Tiers 2, 3, 4 | Removes atmospheric phenomenon mentions when already encoded by the lighting engine |
| `trimMjPhenomenonDuplicates()` | Tier 2 only   | MJ-specific: removes "haze" etc. when atmosphere already encodes haze               |

---

## 9. Stage 8 — Per-Platform Optimisation

**File:** `src/lib/prompt-optimizer.ts` (1,605 lines)
**Function:** `optimizePromptGoldStandard()`

The optimiser takes assembled prompt text and compresses it to fit the platform's `idealMax` character budget while preserving the highest-value terms.

**Strategy routing (mirrors assembler exactly):**

```
if tierId === 4                          → 'plain' strategy
if promptStyle === 'keywords' + tierId 2 → 'midjourney' strategy
if promptStyle === 'keywords'            → 'keywords' (CLIP) strategy
else                                     → 'natural' strategy
```

**4 optimisation pipelines:**

| Strategy     | Platforms             | Key Technique                                                                                              |
| ------------ | --------------------- | ---------------------------------------------------------------------------------------------------------- |
| `keywords`   | 13 Tier 1 + Flux      | 5-phase: redundancy pairs → semantic similarity → term scoring → compression rules → BPE token enforcement |
| `midjourney` | 2 Tier 2              | Protect `--` params, steep position decay, tight 40-word budget                                            |
| `natural`    | 9 Tier 3 (excl. Flux) | Clause-level surgery — remove whole sentences, not words                                                   |
| `plain`      | 17 Tier 4             | Simplified keyword removal, aggressive length target                                                       |

**Shared building blocks across all 4 strategies:**

- 217 redundancy pairs (hand-curated) + semantic similarity pairs (auto-computed from CLIP embeddings)
- 50+ compression rules (e.g., "subject centred vertically" → "centered")
- Real CLIP BPE tokenisation for Tier 1 (falls back to word-level heuristic)
- Per-strategy category importance weights (MJ: fidelity=0.20, not 0.85)
- Per-strategy position decay curves

---

## 10. Platform-Tier Matrix (42 Platforms × 4 Tiers)

### Tier 1 — CLIP-Based (13 platforms)

| Platform    | Weight Syntax       | Sweet Spot | Token Limit | Negative Mode |
| ----------- | ------------------- | ---------- | ----------- | ------------- |
| artguru     | `({term}:{weight})` | 100        | 200         | separate      |
| clipdrop    | `({term}:{weight})` | 100        | 200         | separate      |
| dreamlike   | `({term}:{weight})` | 100        | 200         | separate      |
| dreamstudio | `({term}:{weight})` | 100        | 200         | separate      |
| getimg      | `({term}:{weight})` | 100        | 200         | separate      |
| jasper-art  | `({term}:{weight})` | 100        | 200         | separate      |
| leonardo    | `{term}::{weight}`  | 100        | 200         | separate      |
| lexica      | `({term}:{weight})` | 100        | 200         | separate      |
| nightcafe   | `({term}:{weight})` | 100        | 200         | separate      |
| novelai     | `{{{term}}}`        | 100        | 200         | separate      |
| openart     | `({term}:{weight})` | 100        | 200         | separate      |
| playground  | `({term}:{weight})` | 100        | 200         | separate      |
| stability   | `({term}:{weight})` | 100        | 200         | separate      |

### Tier 2 — Midjourney Family (2 platforms)

| Platform   | Weight Syntax | Sweet Spot | Token Limit | Negative Mode   |
| ---------- | ------------- | ---------- | ----------- | --------------- |
| midjourney | none          | 40         | 60          | inline (`--no`) |
| bluewillow | none          | 40         | 60          | inline (`--no`) |

### Tier 3 — Natural Language (10 platforms)

| Platform           | Prompt Style | Sweet Spot | Token Limit | Negative Mode    |
| ------------------ | ------------ | ---------- | ----------- | ---------------- |
| adobe-firefly      | natural      | 150        | 400         | none (converted) |
| bing               | natural      | 200        | 400         | none (converted) |
| flux               | keywords     | 120        | 256         | separate         |
| google-imagen      | natural      | 200        | 400         | none (converted) |
| hotpot             | natural      | 100        | 200         | none (converted) |
| ideogram           | natural      | 250        | 400         | none (converted) |
| imagine-meta       | natural      | 200        | 320         | none (converted) |
| microsoft-designer | natural      | 200        | 400         | none (converted) |
| openai             | natural      | 250        | 400         | none (converted) |
| runway             | natural      | 200        | 320         | separate         |

### Tier 4 — Plain Language (17 platforms)

| Platform    | Sweet Spot | Token Limit | Negative Mode |
| ----------- | ---------- | ----------- | ------------- |
| artbreeder  | 40         | 100         | none          |
| artistly    | 80         | 150         | separate      |
| canva       | 40         | 150         | none          |
| craiyon     | 60         | 150         | none          |
| deepai      | 60         | 150         | none          |
| fotor       | 40         | 150         | none          |
| freepik     | 60         | 150         | none          |
| myedit      | 40         | 100         | none          |
| photoleap   | 60         | 150         | none          |
| picsart     | 60         | 150         | none          |
| picwish     | 30         | 100         | none          |
| pixlr       | 60         | 150         | none          |
| remove-bg   | 30         | 100         | none          |
| simplified  | 40         | 100         | none          |
| visme       | 60         | 150         | none          |
| vistacreate | 60         | 150         | none          |
| 123rf       | 60         | 150         | none          |

---

## 11. Data Integrity Verification

**Cross-reference audit (7 March 2026):**

| Check                                              | Result  | Details                                                 |
| -------------------------------------------------- | ------- | ------------------------------------------------------- |
| All 42 platforms in `providers.json`               | ✅ Pass | 42/42                                                   |
| All 42 platforms in `platform-formats.json`        | ✅ Pass | 42/42                                                   |
| All 42 platforms in `platform-tiers.ts`            | ✅ Pass | 13 + 2 + 10 + 17 = 42                                   |
| No platform in formats missing from tiers          | ✅ Pass | 0 orphans                                               |
| No platform in tiers missing from formats          | ✅ Pass | 0 orphans                                               |
| No platform in providers missing from formats      | ✅ Pass | 0 orphans                                               |
| Assembler routing matches tier assignment          | ✅ Pass | All 42 route correctly                                  |
| Optimiser routing mirrors assembler routing        | ✅ Pass | `detectStrategy()` matches `assembleTierAware()`        |
| No sweetSpot > tokenLimit violations               | ✅ Pass | All 42 clean                                            |
| All inline-negative platforms have negativeSyntax  | ✅ Pass | MJ + BW both have `--no {negative}`                     |
| Weight wrapping guarded by `if (weight && syntax)` | ✅ Pass | No unwanted wrapping on non-CLIP platforms              |
| `selectionsFromMap()` dedup logic correct          | ✅ Pass | Selection ⊂ customValue → selection dropped             |
| Post-processing per-tier routing correct           | ✅ Pass | T1-specific, T2-specific, and shared paths all verified |
| Flux special handling correct                      | ✅ Pass | No weights, keyword assembly, T5-compatible output      |
| Tier 4 override catches all 17 platforms           | ✅ Pass | `tierId === 4` check before promptStyle check           |

---

## 12. Observations (Non-Bugs)

These are design decisions that are architecturally sound but worth documenting:

**1. Leonardo weight syntax diverges from SD family:**
Leonardo uses `{term}::{weight}` (producing `subject::1.2`) while all other Tier 1 SD-family platforms use `({term}:{weight})` (producing `(subject:1.2)`). Since Leonardo is the Tier 1 reference platform, the PotM showcase displays `::` syntax for the CLIP tier. When a user clicks "Try in Stability AI", `assemblePrompt('stability', ...)` correctly uses `(term:1.2)`. The showcase display ≠ per-platform output. This is by design.

**2. Flux is Tier 3 with `promptStyle: keywords`:**
Flux uses a T5 encoder (natural language aware) but performs best with descriptive comma-separated keywords, not flowing sentences. The `promptStyle: keywords` config routes Flux through `assembleKeywords()` which produces clean keyword output. The Tier 3 assignment is the correct user-facing classification (Flux doesn't support CLIP weight syntax). The config pairing is intentional.

**3. Artistly has dead weight config in Tier 4:**
Artistly's `platform-formats.json` entry includes `weightingSyntax: "({term}:{weight})"` and `weightedCategories`, but Artistly is Tier 4. The `tierId === 4` override routes it to `assemblePlainLanguage()`, which ignores weight config entirely. The dead config has no functional impact but is technically unreachable code in JSON form.

---

## 13. File Reference

| Stage             | Primary File                                  | Lines  | Purpose                                             |
| ----------------- | --------------------------------------------- | ------ | --------------------------------------------------- |
| Orchestrator      | `src/lib/weather/weather-prompt-generator.ts` | 487    | Pipeline entry point, coordinates all stages        |
| Physics           | `src/lib/weather/` (24 files)                 | ~9,538 | 17 algorithms for meteorological computation        |
| Category mapping  | `src/lib/weather/weather-category-mapper.ts`  | 581    | Bridges physics → 12 prompt categories              |
| Synergy rewriting | `src/lib/weather/synergy-rewriter.ts`         | 600    | Conflict resolution + reinforcement                 |
| Assembly          | `src/lib/prompt-builder.ts`                   | 1,739  | Single brain: `assemblePrompt()` + 3 sub-assemblers |
| Post-processing   | `src/lib/prompt-post-process.ts`              | ~200   | Per-tier cleanup and grammar                        |
| Optimisation      | `src/lib/prompt-optimizer.ts`                 | 1,605  | 4-strategy compression pipeline                     |
| Platform config   | `src/data/providers/platform-formats.json`    | 1,539  | 42 platform configs (sweetSpot, weights, syntax)    |
| Tier mapping      | `src/data/platform-tiers.ts`                  | 200    | 42 platforms → 4 tiers                              |
| Types             | `src/types/prompt-builder.ts`                 | ~350   | `WeatherCategoryMap`, `PromptCategory`, etc.        |

**Total pipeline code:** ~16,839 lines across ~32 files.

---

## Related Documents

| Document                               | Relevance                                            |
| -------------------------------------- | ---------------------------------------------------- |
| `unified-prompt-brain.md`              | Architecture of the single-brain assembly system     |
| `weather-prompt-generator-analysis.md` | Quality scoring (82→93/100) and improvement roadmap  |
| `prompt-optimizer.md`                  | Optimiser architecture and compression strategies    |
| `prompt-builder-page.md`               | Builder UI and `assemblePrompt()` integration        |
| `prompt-builder-evolution-plan-v2.md`  | Historical evolution from dual-brain to single-brain |
| `code-standard.md`                     | `assemblePrompt()` signature, `PromptCategory` type  |
| `homepage.md`                          | PotM route, showcase component, "Try in" mechanic    |
