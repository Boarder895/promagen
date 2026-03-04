# Unified Prompt Brain — Architecture Document

**Status:** Implemented (Phases A–D complete, Upgrades 3–5 shipped, Extras 4–6 shipped, Parity v3.5.1 shipped)
**Version:** 3.0.0
**Date:** 2026-03-04
**Scope:** Single prompt assembly engine for all of Promagen — weather-generated, user-built, scene-starter, and preloaded prompts all flow through `assemblePrompt()`.

### Changelog

| Version | Date       | Change                                                                                                                                                                                                                                                                                                       |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1.0.0   | 2026-03-03 | Initial proposal — Status: Proposed                                                                                                                                                                                                                                                                          |
| 2.0.0   | 2026-03-03 | Full rewrite — Status: Implemented. All 4 build phases shipped. 5 upgrades. 3 extras. Composition blueprint fixes. Quality parity. Cross-referenced against src.zip actual implementation.                                                                                                                   |
| 3.0.0   | 2026-03-04 | Parity v3.3.0–v3.5.1 shipped. 42-platform coverage (was 31). Post-processing engine extracted. NEGATIVE_TO_POSITIVE map (45 entries). SENTENCE_CONNECTORS optimised. 42-platform parity test suite (660 lines). All line counts, function offsets, test paths, and exports cross-referenced against src.zip. |

---

## 1. The Problem — Two Brains

Promagen had two independent systems that both built prompt text. They shared zero vocabulary, zero logic, and zero architecture.

### System A — Weather Prompt Generator

24 files in `src/lib/weather/` (9,463 total lines) computing physics-based weather intelligence: solar elevation, lunar position, wind classification, precipitation, lighting engine (973 lines), visual truth (1,301 lines), camera lens selection (289 lines), composition, surface grounding, moisture phrases, wind phrases, venue intelligence, climate zones, cloud type classification.

**Assembly duplication (the problem):** 5 functions in `tier-generators.ts` each assembled prompt text independently:

- `generateTier1()` — CLIP-weighted text with hardcoded `:1.3`, `:1.2`, `:1.1` weights
- `generateTier1Flux()` — Strips CLIP weights into T5-friendly prose
- `generateTier2()` — Midjourney `::` syntax with `--ar` params
- `generateTier3()` — Natural language sentences with connectors
- `generateTier4()` — Plain comma-separated lists

> **Post v11.0:** These 5 functions were deleted in Phase E (Tier Generator Retirement). `tier-generators.ts` is now a 95-line stub containing only shared enrichment helpers (`buildSkyEnrichment`, `buildTimeOfDayEnrichment`). The stub header documents the deletion.

### System B — Prompt Builder

`prompt-builder.ts` (1,562 lines) — the user-facing assembly engine with `assembleKeywords()`, `assembleNaturalSentences()`, `assemblePlainLanguage()`, routed by `assembleTierAware()`. Platform-format-driven with 42 platforms configured in `platform-formats.json` (v3.5.0, 1,539 lines) for token limits, sweet spots, weight syntax, impact priority, category ordering, and negative handling.

**Vocabulary limitation (the problem):** Generic dropdown terms ("moonlight", "golden hour", "dramatic lighting") with no physics awareness, no camera intelligence, no surface/moisture/thermal phrases.

### The Conflict

Weather generator: `"Cool white moonlight competing with focused accent lighting on monument detail"`
Prompt builder: `"moonlight, city skyline, contemplative, earth tones"`

When a user clicked "Try in" from the homepage PotM, bridging this gap failed repeatedly because the gap was architectural — two separate brains.

---

## 2. The Solution — One Brain

### Core Principle

The weather generator became an **intelligence-only** engine. It computes WHAT the scene looks like. It outputs structured data mapped to prompt builder categories. It never assembles text for the "Try in" pathway.

The prompt builder became the **single assembly engine**. Every prompt in Promagen passes through `assemblePrompt()`. One function. One output path. One brain.

### Data Contract — WeatherCategoryMap

```typescript
interface WeatherCategoryMap {
  /** Dropdown selections — terms that exist in vocabulary JSONs */
  selections: Partial<Record<PromptCategory, string[]>>;

  /** Custom values — rich physics-computed phrases per category */
  customValues: Partial<Record<PromptCategory, string>>;

  /** Negative terms */
  negative: string[];

  /** Per-category weight overrides for CLIP-tier platforms */
  weightOverrides?: Partial<Record<PromptCategory, number>>;

  /** Per-category confidence score (0–1) for UI chip opacity */
  confidence?: Partial<Record<PromptCategory, number>>;

  /** Metadata for "Inspired by" badge + diagnostics */
  meta: WeatherCategoryMeta;
}

interface WeatherCategoryMeta {
  city: string;
  venue: string;
  venueSetting: string;
  mood: string;
  conditions: string;
  emoji: string;
  tempC: number | null;
  localTime: string;
  source: 'weather-intelligence';
}
```

Note: v1.0.0 proposed `WeatherCategoryMap` without `weightOverrides` or `confidence` fields. Both were added during implementation and are now part of the shipped type (`types/prompt-builder.ts` lines 256–293).

### Every Prompt Path Uses the Same Assembler

| Source                           | Path                                                       | Status                     |
| -------------------------------- | ---------------------------------------------------------- | -------------------------- |
| User manually selects dropdowns  | `assemblePrompt()`                                         | Implemented (unchanged)    |
| Scene starter preload            | selections → `assemblePrompt()`                            | Implemented (unchanged)    |
| Weather PotM display on homepage | `generateTier1/2/3/4()` for display text                   | Implemented (display only) |
| "Try in" from homepage           | `WeatherCategoryMap` → sessionStorage → `assemblePrompt()` | **Implemented (new)**      |
| Randomiser button                | `assemblePrompt()`                                         | Implemented (unchanged)    |
| Optimizer                        | `assemblePrompt()` output → optimisation pipeline          | Implemented (unchanged)    |

```
┌───────────────────────────────────────────────────────────┐
│                                                           │
│                    assemblePrompt()                        │
│                    THE ONE BRAIN                           │
│                                                           │
│  Input:  platformId + PromptSelections + weightOverrides? │
│  Output: tier-formatted text for that specific platform   │
│                                                           │
│  Routes to:                                               │
│    assembleKeywords()         → Tier 1 CLIP, Tier 2 MJ   │
│    assembleNaturalSentences() → Tier 3 NL (DALL·E, etc)  │
│    assemblePlainLanguage()    → Tier 4 (Canva, Craiyon)   │
│                                                           │
│  Post-processed by:                                       │
│    postProcessAssembled()     → Leak, synergy, grammar    │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

---

## 3. What the Assembler Learned

### 3.1 Rich Phrase Handling

The assembler now handles both short dropdown terms (`"moonlight"`) and long physics-computed phrases (`"Cool white moonlight competing with focused accent lighting"`). Each sub-assembler has phrase-length-aware logic:

- **`assembleKeywords()`** (line 553) — short terms get weighted with platform syntax (e.g., `(moonlight:1.3)`). Long phrases (>4 words) are inserted without parenthetical weight wrapping — too much text in one weight group confuses the model.
- **`assembleNaturalSentences()`** (line 757) — short terms use grammatical connectors ("in", "with"). Long phrases become standalone clauses or appended sentences — avoids `"with Cool white moonlight competing with focused accent lighting"`.
- **`assemblePlainLanguage()`** (line 886) — long phrases get intelligent truncation for Tier 4's tight token budget (40–60 words).

Test: `src/lib/__tests__/prompt-builder-rich-phrases.test.ts` (318 lines)

### 3.2 Weight Override Pipeline

The assembler accepts an optional third argument `weightOverrides?: Partial<Record<PromptCategory, number>>`. In `assembleTierAware()`, weather-provided weights merge with platform-defined weights:

```typescript
weightedCategories: {
  ...weightOverrides,                      // weather base layer
  ...platformFormat.weightedCategories,     // platform wins on conflicts
}
```

**Merge order: platform wins.** Weather intelligence provides starting-point weights (subject: 1.3, lighting: 1.3, environment: 1.2, composition: 1.05). If a platform explicitly defines a weight for the same category, the platform value overwrites the weather value. This is intentional — platforms know their own weight syntax limits.

### 3.3 Negative Dedup

Cross-category dedup (Improvement 1 in `assembleTierAware()`) catches duplicate negative terms. The weather generator's negative terms sometimes overlap with terms the assembler injects from platform config `qualityNegative`. Same negative term from weather AND platform config → kept only once.

### 3.4 Quality Prefix Normalisation

SD-family platforms had inconsistent quality prefix terms in `platform-formats.json`. Normalised across Stability, Leonardo, ComfyUI, and other SD-derived platforms. Eliminates subtle output differences between the generator path and the builder path.

### 3.5 Helper Functions

| Function                        | Line | Purpose                                                                       |
| ------------------------------- | ---- | ----------------------------------------------------------------------------- |
| `deduplicateWithinCategories()` | 986  | Drops short terms subsumed by longer terms in same category                   |
| `deduplicateAcrossCategories()` | 1034 | Drops exact dupes across categories, keeps in first per effective order       |
| `getEffectiveOrder()`           | 415  | Computes category output order from `impactPriority` config                   |
| `estimateClipTokens()`          | 510  | Token count estimation for all tiers                                          |
| `getPlatformFormat()`           | 1131 | Platform config lookup (used by weight merge)                                 |
| `selectionsFromMap()`           | 1519 | Convert WeatherCategoryMap → PromptSelections                                 |
| `tierToRefPlatform()`           | 1493 | Reference platform per tier (T1→leonardo, T2→midjourney, T3→openai, T4→canva) |

### 3.6 SENTENCE_CONNECTORS (v3.5.1)

Natural language assembly (Tier 3) uses `SENTENCE_CONNECTORS` (line 674) to join category values into grammatical clauses. Each connector defines optional `prefix`, `suffix`, and `joiner`:

```typescript
const SENTENCE_CONNECTORS: Record<string, SentenceConnector> = {
  subject: {},
  action: {},
  environment: { prefix: 'in ' },
  style: { prefix: 'in ' }, // v3.5.1: removed " style" suffix
  lighting: { prefix: 'with ' },
  atmosphere: { joiner: ', ' }, // v3.5.1: removed " atmosphere" suffix, comma joiner
  colour: {},
  materials: {}, // v3.4.0: removed "featuring" prefix
  composition: {},
  camera: {},
  fidelity: {},
};
```

**v3.5.1 changes (connector optimisation):**

1. **`style`:** Removed `suffix: ' style'` — "photorealistic" is cleaner and more CLIP-efficient than "in photorealistic style". The suffix word dilutes CLIP attention without changing AI image output.
2. **`atmosphere`:** Removed `suffix: ' atmosphere'`, switched `joiner` from `" and "` to `", "` — "mysterious" is more prompt-efficient than "mysterious atmosphere". Comma joiner ("haze, urban glow") is standard prompt syntax vs "haze and urban glow".
3. **`materials`:** (v3.4.0) Removed `prefix: 'featuring '` — materials terms like "rain-slicked asphalt" are self-describing.

These changes closed the flux parity gap from 95.5% → 100% by eliminating semantically empty filler words ("style", "atmosphere", "and") that the natural language path added but the keyword builder path correctly stripped.

### 3.7 NEGATIVE_TO_POSITIVE Conversion Map

For platforms that don't support negative prompts (Tier 3 `negativeSupport: 'none'` and Tier 4), the assembler converts negative terms to positive reinforcement using `NEGATIVE_TO_POSITIVE` (line 171, 45 entries):

| Negative Term          | Positive Conversion    | Category       |
| ---------------------- | ---------------------- | -------------- |
| `blurry`               | `sharp focus`          | Quality        |
| `watermark/watermarks` | `unmarked`             | Unwanted       |
| `people/person/crowd`  | `empty scene`          | People control |
| `cartoon/cartoonish`   | `realistic rendering`  | Style          |
| `anime`                | `photographic realism` | Style          |
| `text`                 | `clean image`          | Unwanted       |
| `oversaturated`        | `balanced colors`      | Exposure       |
| `deformed`             | `well-formed`          | Anatomy        |

This map handles singular/plural variants (e.g., `watermark` and `watermarks` both → `unmarked`). Terms without a mapping are silently dropped on no-neg platforms.

---

## 4. What the Weather Generator Changed

### 4.1 Intelligence Preserved (No Changes)

All physics computation, lighting engine, visual truth, camera lens selection, surface grounding, moisture phrases, wind phrases, venue intelligence, climate zones, and cloud classification remain unchanged. These are the "what" — the brain's intelligence layer.

### 4.2 Assembly Delegation (New)

The generator (486 lines) now calls `buildWeatherCategoryMap()` (weather-category-mapper.ts, 581 lines) after computing all weather intelligence. This maps physics outputs to `PromptCategory` slots:

| PromptCategory | Weather Source                         | Type        |
| -------------- | -------------------------------------- | ----------- |
| subject        | `cityName`                             | customValue |
| environment    | venue setting → vocabulary match       | selected    |
| lighting       | `lighting.fullPhrase`                  | customValue |
| composition    | `compositionBlueprint.compositionText` | customValue |
| camera         | `camera.body` + `camera.lensSpec`      | customValue |
| atmosphere     | `mood` → vocabulary match              | selected    |
| colour         | `colourPhrase` from visual truth       | customValue |
| materials      | `surfacePhrase`                        | customValue |
| action         | `windPhrase`                           | customValue |
| negative       | camera-aware + quiet-hours             | array       |

### 4.3 Composition Blueprint (New — 506 lines)

`composition-blueprint.ts` computes scene composition from venue setting + camera data. Returns structured layers (foreground, midground, background, focal plane) plus a composition phrase. See §10 Extra 5 for bug fixes (dofPhrase guard, vanishing-point framing).

### 4.4 Synergy Rewriter (New — 600 lines)

`synergy-rewriter.ts` resolves physics impossibilities and amplifies reinforcing combinations before assembly. See §10 Extra 6b.

### 4.5 Adaptive Weights (New — 254 lines)

`adaptive-weights.ts` calibrates weight overrides by prompt density. See §10 Extra 4.

---

## 5. Venue Desync Fix — Venue Singularity

### 5.1 The Bug

The homepage PotM route and the weather generator independently selected venues using different algorithms. The route used index-based rotation (`venueIndex % venues.length`) while `getCityVenue()` used seeded pseudo-random (`pickRandom(venues, seed)`). Even when the route passed `venueSeed`, the two algorithms produced different indices — the prompt displayed "Topkapı Palace Gates" while the generator assembled text for "Grand Bazaar".

### 5.2 Evolution (Two Phases)

**Phase 1 — `venueSeed` (v10.3.0, Phase C):**
Added an optional `venueSeed?: number | null` field to `WeatherPromptInput` (prompt-types.ts line 65). The route passed its `venueRotation` value so the generator's `getCityVenue()` call used the same seed. This reduced desync but did not eliminate it because `pickRandom` and `venueIndex %` are fundamentally different selection algorithms.

**Phase 2 — `venueOverride` (v11.1.0, Upgrade 4 — Venue Singularity):**
Added `venueOverride?: { name: string; setting: string } | null` to `WeatherPromptInput` (prompt-types.ts line 80). When provided, the generator skips `getCityVenue()` entirely and uses the override as-is (weather-prompt-generator.ts line 318–321). The route now passes the exact venue object it intends to display:

```typescript
venueOverride: { name: venue.name, setting: venue.setting ?? 'street' }
```

One venue. Zero desync. The `venueSeed` path remains as a fallback for callers that don't have the full venue object.

### 5.3 Route Integration

In `route.ts` (prompt-of-the-moment, 639 lines), the venue is selected once per rotation cycle, then passed to the generator via `venueOverride` (route.ts line 452). The `categoryMap.meta` returned by the generator now carries the true venue name, which the route uses for the "Inspired by" badge display (route.ts line 462).

---

## 6. "Inspired by" Badge Fix — Two-Effect Split

### 6.1 The Bug

The prompt builder's Phase D preload effect read `sessionStorage('promagen:preloaded-payload')` and applied both category selections AND the "Inspired by" badge data in a single `useEffect`. When the user manually edited any dropdown, the effect re-fired (because `categoryState` was in its dependency array), clearing and re-applying selections. This produced a visible "flash" and lost user edits.

### 6.2 The Fix

Split into two independent effects in `prompt-builder.tsx` (2,476 lines):

**Effect 1 — Category preload (runs once on mount):**
Reads `promagen:preloaded-payload` from sessionStorage. If the payload contains a `categoryMap` (WeatherCategoryMap), it applies `selections`, `customValues`, and `weightOverrides` to the builder state. Clears all sessionStorage keys immediately (one-time use). This effect has no dependency on `categoryState`.

**Effect 2 — "Inspired by" badge (runs once on mount):**
Reads `promagen:preloaded-inspiredBy` from sessionStorage. Sets the `inspiredByData` state (city, venue, conditions, mood, emoji, categoryMapHash). This state is display-only — it does not trigger re-application of selections.

### 6.3 Badge Fingerprint Verification

The builder computes a live `WeatherCategoryMap` from current `categoryState` and hashes it against `inspiredByData.categoryMapHash`. The result drives a status indicator:

- **match** → green badge: user has not modified the weather-provided selections
- **modified** → amber badge: user has edited at least one category

This verification runs as a `useMemo` (prompt-builder.tsx line 1123–1151), not as an effect, so it never triggers state updates.

### 6.4 Clear Behaviour

The "Clear all" button explicitly clears `inspiredByData` (prompt-builder.tsx line 1207), removing the badge. Normal dropdown editing preserves the badge since the selections ARE the prompt — the badge shows provenance, not immutability.

---

## 7. Build Phase Changelog

The original doc described 4 build phases (A–D) as future work. All are now implemented.

### Phase A — Weather Category Mapper (Implemented)

**Delivered:** `weather-category-mapper.ts` (581 lines)

Core function `buildWeatherCategoryMap(input)` converts computed weather intelligence into a `WeatherCategoryMap`. Maps physics-computed data to prompt builder categories:

| Category    | Source                                     | Weight Override           |
| ----------- | ------------------------------------------ | ------------------------- |
| subject     | `cityName`                                 | 1.3                       |
| environment | venue setting + vocabulary match           | 1.2 (when scene-dominant) |
| lighting    | `lighting.fullPhrase`                      | 1.3                       |
| composition | `compositionBlueprint.compositionText`     | 1.05                      |
| camera      | `camera.body` + `camera.lensSpec`          | —                         |
| atmosphere  | `mood` vocabulary match                    | —                         |
| colour      | `colourPhrase` from visual truth           | —                         |
| materials   | `surfacePhrase`                            | —                         |
| action      | `windPhrase`                               | —                         |
| negative    | camera-aware negatives + quiet-hours logic | —                         |

Confidence scoring (`computeConfidence()`) rates each category 0–1 based on data quality. Subject always scores 1.0 (city name is certain). Lighting scores 0.95 with visual truth data, 0.6 without. Atmosphere scores 0.5 on generic fallbacks. The UI uses confidence for chip opacity (dim = low confidence → invite editing).

### Phase B — Generator Refactor (Implemented)

**Delivered:** Weather prompt generator now outputs `WeatherCategoryMap` alongside prompt text.

The generator calls `buildWeatherCategoryMap()` after computing all weather intelligence, attaching the categoryMap to `WeatherPromptResult`. The tier generators (`generateTier1()` through `generateTier4()`) still produce display text for the homepage, but the categoryMap is the authoritative data contract for the "Try in" pathway.

Tier generators remain in `tier-generators.ts` as the homepage display path. They are NOT deleted because the homepage needs pre-formatted display text. The single brain architecture means the "Try in" path uses `categoryMap → assemblePrompt()` while the homepage display path uses `generateTierN()` for text shown in the showcase cards.

### Phase C — Assembler Enhancement (Implemented)

**Delivered:** `assemblePrompt()` signature extended to 3 arguments.

```typescript
export function assemblePrompt(
  platformId: string,
  selections: PromptSelections,
  weightOverrides?: Partial<Record<PromptCategory, number>>,
): AssembledPrompt;
```

Internal enhancements to `assembleTierAware()` (line 1074):

1. **Within-category dedup** — `deduplicateWithinCategories()` (line 986): drops short terms that are substrings of longer terms in the same category. Example: `["natural daylight", "Natural daylight, low rolling stratocumulus"]` → keeps only the longer phrase.

2. **Cross-category dedup** — `deduplicateAcrossCategories()` (line 1034): scans all categories in effective output order. Same term in two categories → kept only in the first (higher-priority) category. Example: "photorealistic" in style AND lighting → kept only in style.

3. **Weight merge** — `assembleTierAware()` (line 1074): weather weight overrides provide a base layer; platform-defined `weightedCategories` spread on top. **Platform wins on conflicts.** This is intentional: platforms know their own weight syntax limits, and weather's suggestions are starting points.

   ```typescript
   const mergedFormat = weightOverrides
     ? {
         ...platformFormat,
         weightedCategories: {
           ...(weightOverrides as Record<string, number>), // weather base
           ...platformFormat.weightedCategories, // platform wins
         },
       }
     : platformFormat;
   ```

4. **Token estimation** — `estimateClipTokens()` (line 510): computed for ALL tiers, not just CLIP. Result attached as `assembled.estimatedTokens` with `assembled.tokenLimit` from platform config.

5. **Rich phrase handling** — long phrases (>4 words) from weather customValues are handled by each sub-assembler:
   - `assembleKeywords()`: inserts long phrases without parenthetical weight wrapping
   - `assembleNaturalSentences()`: inserts as standalone clauses, not wrapped with awkward connectors
   - `assemblePlainLanguage()`: intelligent truncation for Tier 4 token budgets

### Phase D — Route + Showcase + Builder Integration (Implemented)

**Delivered:** End-to-end data flow from homepage to prompt builder.

**Data flow:**

```
PotM Route → generates 4-tier prompts + sharedCategoryMap
  ↓
Homepage showcase cards → display pre-formatted tier text
  ↓
User clicks "Try in [Provider]"
  ↓
sessionStorage: {
  'promagen:preloaded-payload': { promptText, categoryMap },
  'promagen:preloaded-inspiredBy': { city, venue, mood, conditions, emoji, categoryMapHash }
}
  ↓
Navigate to /providers/[provider]/prompt-builder
  ↓
prompt-builder.tsx mounts → Effect 1 reads payload
  ↓
If payload.categoryMap exists (Phase D path):
  → Apply selections to categoryState
  → Apply customValues to categoryState
  → Apply weightOverrides to weatherWeightOverrides state
  ↓
assemblePrompt(platformId, selections, weatherWeightOverrides)
  ↓
postProcessAssembled(assembled, tier, atmosphereModifier)
  ↓
Single Brain output — identical assembly logic for all sources
```

**Fallback:** If payload has `promptText` but no `categoryMap`, the builder falls back to displaying the pre-formatted text in a read-only preview (legacy path).

---

## 8. Quality Parity — Assembler vs Generator Output

### 8.1 Goal

The prompt text produced by `assemblePrompt(platformId, selectionsFromMap(categoryMap), categoryMap.weightOverrides)` must be visually indistinguishable from the old `generateTier1/2/3/4()` output for the same weather data. Users clicking "Try in" should see the same prompt quality in the builder as on the homepage.

### 8.2 Parity Fixes Shipped (v3.0.0–v3.5.1)

**Quality prefix normalisation (v3.0.0, platform-formats.json):**
SD-family platforms had inconsistent quality prefix terms. Normalised across Stability, Leonardo, ComfyUI, and other SD-derived platforms to use the same prefix set. This eliminates subtle differences where the builder output had "masterpiece, best quality" while the generator had "masterpiece, highly detailed".

**impactPriority alignment (v3.0.0, platform-formats.json):**
Each platform's `impactPriority` array defines which categories appear in early token positions. These were aligned with the generator's implicit priority order to produce matching output order.

**Negative dedup verification (v3.0.0):**
The generator's negative terms sometimes duplicated terms the assembler also injects from platform config `qualityNegative`. Cross-category dedup (Improvement 1) now catches these — same negative term from weather AND platform config → kept only once.

**NEGATIVE_TO_POSITIVE map expansion (v3.4.0):**
Added singular/plural variants (watermark/watermarks → unmarked, people/person/crowd → empty scene), style conversions (cartoon → realistic rendering, anime → photographic realism), and anatomy corrections. 45 entries total covering quality, exposure, unwanted elements, people control, style exclusions, composition issues, and anatomy.

**Materials connector removal (v3.4.0):**
Removed `prefix: 'featuring '` from materials SENTENCE_CONNECTOR — "featuring rain-slicked asphalt" is unnatural; materials terms are self-describing.

**Platform config fixes (v3.5.0, 42-platform expansion):**
Expanded from 31 to 42 platforms. Fixed 5 misconfigured platforms:

- `clipdrop`: was NL style → fixed to keywords with separate neg, 10 categories (was 54% parity)
- `getimg`: added materials + composition categories (was 78% parity)
- `stability`: sweetSpot raised from 50 → 70+ (was truncating composition)
- `bluewillow`: added camera + materials categories (was 92% parity)
- `novelai`: added "highly detailed" to qualityPrefix (was 96% parity)

Added 11 new Tier 4 platforms with proper configs: artbreeder, freepik, myedit, photoleap, picwish, pixlr, remove-bg, simplified, visme, vistacreate, 123rf.

**SENTENCE_CONNECTORS optimisation (v3.5.1):**
Removed " style" suffix and " atmosphere" suffix from connectors. These words were semantically empty — no AI platform uses them as signal words. Closed the final flux parity gap from 95.5% → 100%. See §3.6 for details.

### 8.3 Parity Achievement

**v3.5.1 result:** 42/42 platforms at 100% Jaccard parity across 4 city fixtures (Amsterdam, Istanbul, Tokyo, Sydney). Zero gen-only words, zero bld-only words. Both paths produce identical semantic content for every supported platform.

The tier generators produce hand-crafted sentence connectors ("A scene of...", "Shot on...") that the assembler's `assembleNaturalSentences()` approximates but doesn't replicate word-for-word. This is acceptable: the assembly is structurally equivalent and produces the same visual output from AI image generators. The exact prose framing differs but has zero impact on generated image quality. With v3.5.1, even this minor prose framing difference has been eliminated for keyword and comma-list platforms.

---

## 8A. Prompt Post-Processing Engine

### 8A.1 Overview

`prompt-post-process.ts` (216 lines) provides 6 exported text-polishing functions that apply after assembly. Extracted from `weather-prompt-generator.ts` so both the homepage path and the builder/"Try in" path share identical post-processing.

### 8A.2 Exported Functions

| Function                         | Purpose                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------- |
| `neutraliseLeakPhrases(text)`    | Replaces culturally-specific nouns ("prayer flags" → "entrance flags")          |
| `fixCommonGrammar(text)`         | Fixes double commas, trailing conjunctions, spacing                             |
| `postProcessTier1Positive(...)`  | Tier 1 CLIP-specific: leak phrases + redundant phenomenon removal               |
| `removeRedundantPhenomenon(...)` | Strips atmosphere terms already covered by atmosphere modifier (haze, fog, etc) |
| `trimMjPhenomenonDuplicates(…)`  | Tier 2 MJ-specific phenomenon dedup                                             |
| `postProcessAssembled(...)`      | Convenience wrapper — applies correct pipeline per tier                         |

### 8A.3 Pipeline per Tier

```
postProcessAssembled(assembled, tier, atmosphereModifier):
  Tier 1 (CLIP):   neutraliseLeakPhrases → removeRedundantPhenomenon → fixCommonGrammar
  Tier 2 (MJ):     neutraliseLeakPhrases → trimMjPhenomenonDuplicates → fixCommonGrammar
  Tier 3 (NL):     neutraliseLeakPhrases → removeRedundantPhenomenon → fixCommonGrammar
  Tier 4 (Plain):  neutraliseLeakPhrases → removeRedundantPhenomenon → fixCommonGrammar
```

Both the homepage generator path and the builder/"Try in" path call `postProcessAssembled()` after `assemblePrompt()`, ensuring identical polish regardless of entry point.

---

## 8B. 42-Platform Parity Testing Infrastructure

### 8B.1 Architecture

Two parity test files validate that the homepage generator path and the builder "Try in" path produce identical output:

**`parity-homepage-builder.test.ts` (638 lines):**
Original 4-tier × 4-city test suite. Tests the reference platform per tier (leonardo, midjourney, openai, canva). Threshold: ≥95% Jaccard (raised from 80% in v3.5.1).

**`parity-all-42-platforms.test.ts` (660 lines):**
Comprehensive audit covering every platform in every tier. Created in v3.5.1. Contains 8 test sections:

1. **Platform config completeness** — all 42 tier platforms have explicit configs in `platformFormats.platforms` (no fallback to `_defaults`), minimum 5 categories each, all categories exist in tier reference superset.
2. **Full 42-platform parity** — ≥95% Jaccard across all 42 platforms × 4 cities = 168 test cases.
3. **Containment metric** — ≥95% of gen content words survive in bld positive OR negative output.
4. **Token limit enforcement** — builder output never exceeds platform `tokenLimit` (+10% margin).
5. **Negative handling** — mode-specific correctness: separate (neg field populated), inline (--no syntax), none (positive reinforcement via NEGATIVE_TO_POSITIVE).
6. **Post-processing integrity** — leak prevention ("prayer flags" neutralised), synergy conflict resolution (golden hour + midnight), weight syntax preservation (CLIP weights, MJ no-leak, NL/Plain clean).
7. **Regression guards** — 16 specific assertions for every previously-fixed bug: clipdrop style, getimg categories, stability sweetSpot, bluewillow categories, novelai qualityPrefix, hotpot categories, flux qualitySuffix, N2P conversions (watermarks→unmarked, people→empty scene, cartoon→realistic, anime→photographic realism), 11 T4 explicit configs, materials "featuring" removal, style suffix removal, atmosphere suffix removal.
8. **Summary table** — visual parity matrix with per-city scores and pass/fail counts.

### 8B.2 Metrics

- **Jaccard similarity:** `|A ∩ B| / |A ∪ B|` on tokenised word sets (CLIP weight syntax stripped). ≥95% required.
- **Containment score:** Fraction of gen-path words found in bld-path positive OR negative output. ≥95% required.
- **Token estimation:** `text.split(/\s+/).length` vs platform `tokenLimit` × 1.1 margin.

### 8B.3 City Fixtures

Four representative cities with full `WeatherCategoryMap` fixtures:

| City      | Selections | Custom Values | Negatives | Weight Overrides | Special Conditions   |
| --------- | ---------- | ------------- | --------- | ---------------- | -------------------- |
| Amsterdam | 6          | 5             | 4         | 4                | Plaza, Partly Cloudy |
| Istanbul  | 5          | 6             | 6         | 4                | Monument, Night      |
| Tokyo     | 6          | 5             | 6         | 4                | Street, Haze         |
| Sydney    | 6          | 4             | 3         | 4                | Waterfront, Clear    |

### 8B.4 Platform Coverage

| Tier      | Style          | Ref Platform | Platform Count | Platforms                                                                                                                                                  |
| --------- | -------------- | ------------ | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1         | CLIP Keywords  | leonardo     | 13             | artguru, clipdrop, dreamlike, dreamstudio, getimg, jasper-art, leonardo, lexica, nightcafe, novelai, openart, playground, stability                        |
| 2         | Midjourney     | midjourney   | 2              | bluewillow, midjourney                                                                                                                                     |
| 3         | Natural Lang   | openai       | 10             | adobe-firefly, bing, flux, google-imagen, hotpot, ideogram, imagine-meta, microsoft-designer, openai, runway                                               |
| 4         | Plain/Consumer | canva        | 17             | artbreeder, artistly, canva, craiyon, deepai, fotor, freepik, myedit, photoleap, picsart, picwish, pixlr, remove-bg, simplified, visme, vistacreate, 123rf |
| **Total** |                |              | **42**         |                                                                                                                                                            |

---

## 9. Post-Integration Upgrades (v11.1.x)

After the core 4-phase build, a series of targeted upgrades improved assembler quality and fixed edge cases discovered during integration testing.

### Upgrade 3 — Canonical Assembly Dedup

**File:** `prompt-builder.ts` lines 986–1068
**Test:** `upgrade-3-canonical-assembly.test.ts` (160 lines)

Placed dedup inside `assembleTierAware()` so that BOTH the generator path and the builder UI path produce identical deduplication. Before this, the generator path could produce duplicate terms because it bypassed the builder's UI-level dedup.

Within-category: drops short terms subsumed by longer terms in the same category.
Cross-category: drops exact duplicate terms, keeping only in the first category per `impactPriority` order.

### Upgrade 4 — Venue Singularity

**File:** `prompt-types.ts` line 80, `weather-prompt-generator.ts` line 318
**Details:** See §5 above.

### Upgrade 5 — Prompt DNA Fingerprinting

**File:** `types/prompt-builder.ts` lines 317–349
**Test:** `upgrade-5-prompt-fingerprint.test.ts` (255 lines)

Implemented `PromptDNAFingerprint` type with FNV-1a hash of category combinations. Tracks which category combos (e.g., "Subject=cityscape + Lighting=moonlight + Atmosphere=contemplative") produce the best user engagement. The `PromptDNAScore` interface accumulates impressions, likes, copies, and "Try in" clicks per fingerprint hash.

The fingerprint is computed from the WeatherCategoryMap at generation time and attached to the PotM response. The builder verifies the hash against current state to detect user modifications (see §6.3 badge fingerprint verification).

---

## 10. Extra Implementations (v11.1.x Extras)

### Extra 4 — Adaptive Weight Calibration

**File:** `adaptive-weights.ts` (254 lines)
**Test:** `src/lib/__tests__/adaptive-weights.test.ts` (311 lines)

Dynamically adjusts CLIP weight overrides based on prompt density. A prompt with 3 populated categories gets stronger weights (1.3, 1.2, 1.1); a prompt with 10 categories gets gentler weights (1.1, 1.05, 1.0). The algorithm:

1. Counts populated categories (selections + customValues)
2. Estimates token density (words per category)
3. Applies a density curve: fewer categories → stronger weights
4. Respects platform token budget (Tier 1 ≈ 77 CLIP tokens)
5. Maintains category hierarchy: subject (10) > environment (9) > lighting (8) > atmosphere (6) > style (5) > colour (4) > action (4) > materials (3) > camera (3) > fidelity (2) > composition (1) > negative (0)

### Extra 5 — Composition Blueprint

**File:** `composition-blueprint.ts` (506 lines)
**Test:** `extra-5-6-composition-synergy.test.ts` (394 lines, shared with Extra 6)

Computes a complete scene composition from venue setting + camera data. Returns structured layers (foreground, midground, background, focal plane) plus a composition phrase for the prompt.

**Bug fixes shipped:**

1. **dofPhrase guard (line 410–416):** When `focalPlane === 'background'` and `dof === 'deep'`, the old code produced "deep focus from background through background" — nonsensical. Now outputs "deep focus from foreground through background". This affects all waterfront/beach/elevated venues with wide lenses.

2. **Vanishing-point framing (line 379–384):** The `narrow` venue case previously output "converging geometry". The framing text elsewhere says "converging perspective lines" — word overlap ("converging") between composition and framing fragments. Changed to "vanishing-point framing" which describes the same photographic effect with zero word overlap.

### Extra 6 — Category Synergy Matrix

**File:** `category-synergy.ts` (409 lines)
**Test:** `src/lib/__tests__/category-synergy.test.ts` (239 lines)

Defines synergy scores between category term pairs. Scores range from -1.0 (physics impossibility) to +1.0 (strong reinforcement). Used by the synergy rewriter to detect and resolve conflicts before assembly.

Examples:

- "golden hour" (lighting) + "midnight" (atmosphere) → score -0.8 (time-of-day contradiction)
- "moonlight" (lighting) + "contemplative" (atmosphere) → score +0.7 (reinforcing)
- "shallow depth of field" (camera) + "landscape" (composition) → score -0.4 (conflicting intent)

### Extra 6b — Synergy-Aware Prompt Rewriter

**File:** `synergy-rewriter.ts` (600 lines)

Runs as a pre-process step before `assemblePrompt()`. Takes `PromptSelections` and returns modified selections with:

- **Conflict resolution (synergy < -0.3):** Replaces the conflicting term with a compatible alternative. "golden hour" + "midnight" → replaces "golden hour" with "amber artificial light" (preserves warm colour intent, resolves time contradiction).
- **Reinforcement bridging (synergy > 0.5):** Injects a bridging phrase connecting the reinforcing categories. "moonlight" + "contemplative" → injects "cool moonlight casting a contemplative stillness across the scene".

The rewriter is opt-in: callers invoke `rewriteWithSynergy()` before passing selections to `assemblePrompt()`. The assembler API is unchanged. Existing features preserved.

---

## 11. File Impact Summary — Actuals

| File                                                 | Action                                                                                                                                    | Actual Lines |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `src/lib/prompt-builder.ts`                          | **ENHANCED** — 3-arg assemblePrompt, dedup, weight merge, token estimation, NEGATIVE_TO_POSITIVE (45 entries), SENTENCE_CONNECTORS v3.5.1 | 1,562 lines  |
| `src/lib/prompt-post-process.ts`                     | **NEW** — Post-processing engine extracted from weather-prompt-generator. 6 exported functions (leak, grammar, phenomenon, synergy)       | 216 lines    |
| `src/lib/weather/weather-category-mapper.ts`         | **NEW** — category mapping from weather intelligence                                                                                      | 581 lines    |
| `src/lib/weather/composition-blueprint.ts`           | **NEW** — scene composition + dofPhrase + framing                                                                                         | 506 lines    |
| `src/lib/weather/synergy-rewriter.ts`                | **NEW** — conflict resolution + reinforcement bridging                                                                                    | 600 lines    |
| `src/lib/weather/category-synergy.ts`                | **NEW** — synergy score matrix                                                                                                            | 409 lines    |
| `src/lib/weather/adaptive-weights.ts`                | **NEW** — density-aware weight calibration                                                                                                | 254 lines    |
| `src/lib/weather/weather-prompt-generator.ts`        | **REFACTORED** — outputs WeatherCategoryMap, venueOverride, post-processing extracted                                                     | 486 lines    |
| `src/lib/weather/tier-generators.ts`                 | **RETIRED** — Phase E deleted 5 generator functions; stub with shared enrichment helpers remains                                          | 95 lines     |
| `src/lib/weather/prompt-types.ts`                    | **UPDATED** — venueSeed, venueOverride fields                                                                                             | 613 lines    |
| `src/types/prompt-builder.ts`                        | **UPDATED** — WeatherCategoryMap, WeatherCategoryMeta, PromptDNAFingerprint, PromptDNAScore, 12 PromptCategories                          | 349 lines    |
| `src/data/providers/platform-formats.json`           | **UPDATED** — v3.5.0, 42 platforms, quality prefix normalisation, impactPriority, connector fixes                                         | 1,539 lines  |
| `src/data/platform-tiers.ts`                         | **UPDATED** — Tier definitions with 42 platforms (13 + 2 + 10 + 17)                                                                       | 199 lines    |
| `src/app/api/homepage/prompt-of-the-moment/route.ts` | **UPDATED** — venueOverride, sharedCategoryMap, inspiredBy with hash                                                                      | 639 lines    |
| `src/components/home/prompt-showcase.tsx`            | **UPDATED** — stores categoryMap, forwards inspiredBy + hash                                                                              | 857 lines    |
| `src/components/providers/prompt-builder.tsx`        | **UPDATED** — Phase D preload, badge split, weatherWeightOverrides                                                                        | 2,476 lines  |

### Test Coverage

| Test File                                               | Lines     | Covers                                   |
| ------------------------------------------------------- | --------- | ---------------------------------------- |
| `src/__tests__/parity-homepage-builder.test.ts`         | 638       | 4-tier × 4-city Jaccard parity (≥95%)    |
| `src/__tests__/parity-all-42-platforms.test.ts`         | 660       | 42-platform × 4-city parity + regression |
| `src/__tests__/upgrade-2-clip-sanitiser.test.ts`        | 134       | CLIP weight sanitisation                 |
| `src/__tests__/upgrade-3-canonical-assembly.test.ts`    | 160       | Within/cross-category dedup              |
| `src/__tests__/upgrade-4-venue-singularity.test.ts`     | 199       | Venue override + seed fallback           |
| `src/__tests__/upgrade-5-prompt-fingerprint.test.ts`    | 255       | DNA fingerprint hash + verification      |
| `src/__tests__/extra-5-6-composition-synergy.test.ts`   | 394       | Composition blueprint + synergy matrix   |
| `src/__tests__/quality-95-fixes.test.ts`                | 265       | Quality parity edge cases                |
| `src/__tests__/improvements-1-5.test.ts`                | 254       | Assembly improvements 1–5                |
| `src/lib/__tests__/weather-category-mapper.test.ts`     | 736       | Category mapping from weather data       |
| `src/lib/__tests__/adaptive-weights.test.ts`            | 311       | Weight calibration across densities      |
| `src/lib/__tests__/prompt-builder-rich-phrases.test.ts` | 318       | Long phrase handling in all 3 assemblers |
| `src/lib/__tests__/category-synergy.test.ts`            | 239       | Synergy scoring edge cases               |
| `src/lib/__tests__/prompt-dna.test.ts`                  | 330       | DNA fingerprint utilities                |
| **Total brain-related test lines**                      | **4,893** |                                          |

---

## 12. Prompt DNA Fingerprinting

### 12.1 Type Definition

```typescript
interface PromptDNAFingerprint {
  /** Stable hash of category combination (FNV-1a, 32-bit hex) */
  hash: string;
  /** Human-readable category breakdown */
  categories: Partial<Record<PromptCategory, string>>;
  /** Where the prompt originated */
  source: PromptSource; // 'user' | 'weather' | 'scene-starter' | 'randomiser'
  /** Platform the prompt was assembled for */
  platformId: string;
  /** Timestamp of creation (ISO 8601) */
  createdAt: string;
}

interface PromptDNAScore {
  /** The fingerprint hash (FK to PromptDNAFingerprint) */
  hash: string;
  /** Total impressions, likes, copies, tryInClicks */
  impressions: number;
  likes: number;
  copies: number;
  tryInClicks: number;
  /** Computed quality score (0–1) */
  qualityScore: number;
}
```

### 12.2 Usage

The fingerprint hash is computed when a PotM is generated and attached to the API response as `categoryMapHash`. The prompt builder uses this hash for badge verification (§6.3): the builder reconstructs a `WeatherCategoryMap` from current `categoryState` and compares its hash against the stored `categoryMapHash`. Match = green badge (unmodified), mismatch = amber badge (user edited).

The learning engine can accumulate `PromptDNAScore` metrics per hash to discover which category COMBINATIONS produce the best engagement. This feeds back into vocabulary ranking: if "Subject=cityscape + Lighting=moonlight + Atmosphere=contemplative" consistently gets high engagement, those terms get boosted in suggestion scoring.

---

## 13. Risk Assessment — Updated

| Risk                                                   | Original Severity | Status         | Resolution                                                                                                                                                                                                                             |
| ------------------------------------------------------ | ----------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Assembler output quality drops below generators        | HIGH              | **Resolved**   | 42/42 platforms at 100% Jaccard parity (v3.5.1). Comprehensive test suite with 168 parity cases, regression guards, and post-processing integrity checks.                                                                              |
| Long phrases break token budgets (MJ: 40 words)        | MEDIUM            | **Mitigated**  | `assemblePlainLanguage()` has intelligent truncation. `assembleKeywords()` skips weight-wrapping on long phrases. Token estimation (`estimateClipTokens`) warns users. Token limit enforcement tested for all 42 platforms × 4 cities. |
| CLIP weight wrapping produces garbage for long phrases | MEDIUM            | **Mitigated**  | Rich phrases (>4 words) are inserted without parenthetical weight wrapping. Adaptive weights (Extra 4) calibrate weights by density. Tested against Stability/Leonardo.                                                                |
| Breaking existing manual prompt builder behaviour      | HIGH              | **Mitigated**  | All existing tests pass. Rich phrase handling is additive — short-term code paths unchanged. Within-category dedup preserves original terms when no redundancy exists.                                                                 |
| Venue desync                                           | LOW               | **Resolved**   | Venue Singularity (Upgrade 4) eliminates desync entirely. `venueOverride` bypasses `getCityVenue()`.                                                                                                                                   |
| Performance: assembler called 4× per PotM request      | LOW               | **Acceptable** | assemblePrompt() is <1ms per call. PotM cached 10 minutes. No measurable impact.                                                                                                                                                       |
| Synergy rewriter produces unexpected replacements      | NEW               | **Monitored**  | Rewriter is opt-in (`rewriteWithSynergy()` before assembly). Callers control whether to use it. Resolution rules are explicit and testable (394 test lines).                                                                           |
| Adaptive weights over-dampen emphasis on dense prompts | NEW               | **Tested**     | Weight calibration maintains category hierarchy. 311 test lines verify density curves across 3–10 category fills.                                                                                                                      |
| Platform config regression on new platforms            | NEW               | **Guarded**    | 42-platform test suite catches regressions across all platforms. 16 regression guards for specific previously-fixed bugs. Test threshold raised to 95%.                                                                                |
| NEGATIVE_TO_POSITIVE map missing conversions           | NEW               | **Tested**     | 45 entries cover quality, exposure, unwanted, people, style, composition, and anatomy categories. Singular/plural variants handled. Parity tests verify conversion consistency between gen and bld paths.                              |

---

## 14. PromptCategory — Canonical List (12 Categories)

The `PromptCategory` union type in `types/prompt-builder.ts` defines 12 categories:

| Category      | Purpose                            | Weight Override?              |
| ------------- | ---------------------------------- | ----------------------------- |
| `subject`     | Identity + key attributes          | Yes (1.3 default)             |
| `action`      | Action / Pose                      | —                             |
| `style`       | Style / Rendering / References     | —                             |
| `environment` | Location + time + background       | Yes (1.2 when scene-dominant) |
| `composition` | Framing (from blueprint)           | Yes (1.05)                    |
| `camera`      | Angle + lens + DoF                 | —                             |
| `lighting`    | Type + direction + intensity       | Yes (1.3 default)             |
| `colour`      | Colour grade                       | —                             |
| `atmosphere`  | Fog, haze, rain, particles, mood   | —                             |
| `materials`   | Surface texture                    | —                             |
| `fidelity`    | Quality boosters (8K, masterpiece) | —                             |
| `negative`    | Constraints / Negative prompt      | N/A                           |

Canonical order is defined in `CATEGORY_ORDER` constant. Effective output order per platform is determined by `getEffectiveOrder()` (line 415) which reads `impactPriority` from platform config and appends remaining categories.

---

## 15. Cross-References

| Document                               | Relationship                                                                                                                                                                                                                                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `exchange-card-weather.md`             | Authority doc for weather system. Composition blueprint (§11H) dofPhrase guard and vanishing-point framing are documented here. Camera/lens improvements (§11G) apply. Tier generators (§11K) now have a cross-reference noting assemblePrompt() handles the "Try in" builder path.                                |
| `prompt-builder-page.md`               | Authority doc for builder component. `assemblePrompt()` signature updated to 3-arg. `weatherWeightOverrides` state variable documented. Phase D data flow sessionStorage → builder pathway works end-to-end with weights.                                                                                          |
| `code-standard.md`                     | `assemblePrompt()` signature updated. `PromptCategory` type shows 12 categories. `platform-formats.json` quality prefix and impactPriority changes noted.                                                                                                                                                          |
| `prompt-optimizer.md`                  | §2.3 architecture diagram upstream of optimizer. Optimizer consumes output of assembler. Weight merge means weighted terms may carry weather-derived weights (e.g., `(LED lighting:1.3)` instead of platform-default 1.1). §12.1 references `getPlatformFormat()` — format now includes merged weightedCategories. |
| `ai_providers.md`                      | Prompt builder data sources section. Exports now include `getPlatformFormat()` and `platformFormats`. Line count: prompt-builder.ts is 1,562 lines. platform-formats.json is 1,539 lines (42 platforms, v3.5.0).                                                                                                   |
| `weather-prompt-generator-analysis.md` | Scored system 82/100. Several recommendations now implemented: camera metadata improvements (Upgrade 4, Extra 5), composition fixes (dofPhrase guard, vanishing-point), platform negatives (cross-category dedup). Post-analysis note estimates 90–93/100 after unified brain.                                     |
| `prompt-builder-evolution-plan-v2.md`  | Evolution plan marked "ALL PHASES COMPLETE." The unified brain is a new initiative built on top of the evolution plan. Cross-reference to this document as the next phase.                                                                                                                                         |

---

## 16. Exports — prompt-builder.ts

All public exports from the single brain assembly engine (1,562 lines):

| Export                                                     | Purpose                                                                       |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `assemblePrompt(platformId, selections, weightOverrides?)` | The One Brain — routes to correct sub-assembler by tier + config              |
| `formatPromptForCopy(assembled)`                           | Returns positive prompt text for clipboard                                    |
| `getPromptPreview(platformId, selections)`                 | Quick preview (calls assemblePrompt internally)                               |
| `getPlatformFormat(platformId)`                            | Platform config lookup (used by weight merge)                                 |
| `getCategoryOptions(category, context?)`                   | Vocabulary-driven dropdown options (top 100)                                  |
| `getAllCategoryOptions(category)`                          | Full vocabulary for a category                                                |
| `getCategoryConfig(category)`                              | Category metadata (label, maxSelections, etc.)                                |
| `getEnhancedCategoryConfig(...)`                           | Config with vocabulary context                                                |
| `getCategorySuggestions(...)`                              | Intelligent term suggestions                                                  |
| `getCategoryChips(...)`                                    | Pre-selected chip terms                                                       |
| `searchCategoryOptions(...)`                               | Fuzzy search within vocabulary                                                |
| `detectStyleFamily(selectedTerms)`                         | Style family detection from terms                                             |
| `getAllCategories()`                                       | Returns `CATEGORY_ORDER` array                                                |
| `getOrderedCategories(platformId)`                         | Platform-specific effective order                                             |
| `supportsNegativePrompts(platformId)`                      | Platform family check                                                         |
| `supportsNativeNegative(platformId)`                       | Native negative support check                                                 |
| `getPlatformTips(platformId)`                              | Platform usage tips                                                           |
| `getPlatformExample(platformId)`                           | Example prompt for platform                                                   |
| `getPlatformFamilyName(platformId)`                        | Human-readable family name                                                    |
| `buildPrompt(providerId, input, website?)`                 | Legacy builder (backward compat)                                              |
| `tierToRefPlatform(tier)`                                  | Reference platform per tier (T1→leonardo, T2→midjourney, T3→openai, T4→canva) |
| `selectionsFromMap(categoryMap)`                           | Convert WeatherCategoryMap → PromptSelections                                 |
| `estimateClipTokens(text)`                                 | Token count estimation                                                        |
| `platformFormats`                                          | Raw platform formats data (used by parity tests for key-existence checks)     |
| `promptOptions`                                            | Prompt vocabulary options data                                                |

---

## 17. Two Improvement Ideas (Not Implemented)

1. **Synergy-Driven Vocabulary Scoring:** The synergy matrix (Extra 6) defines which term pairs reinforce or conflict. Feed these scores back into the vocabulary suggestion engine so that when a user selects "moonlight" in lighting, the atmosphere dropdown boosts "contemplative" (synergy +0.7) and demotes "harsh midday" (synergy -0.6). The synergy data exists — it just needs to flow into `getCategorySuggestions()`.

2. **Adaptive Assembly Strategy Selection:** Currently the assembler routes by platform tier (CLIP → keywords, NL → sentences, Plain → comma lists). With the density analysis from adaptive weights, the assembler could dynamically choose a HYBRID strategy for mid-density prompts: keyword structure with natural language connectors. This would produce better output for platforms like Ideogram and Flux that accept both styles. The adaptive-weights density curve already classifies prompts into density bands — extend this to strategy selection.
