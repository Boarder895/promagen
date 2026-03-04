# Unified Prompt Brain — Architecture Document

**Status:** Implemented (Phases A–D complete, Upgrades 3–5 shipped, Extras 4–6 shipped)
**Version:** 2.0.0
**Date:** 2026-03-03
**Scope:** Single prompt assembly engine for all of Promagen — weather-generated, user-built, scene-starter, and preloaded prompts all flow through `assemblePrompt()`.

### Changelog

| Version | Date       | Change                                                                                                                                                                                     |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1.0.0   | 2026-03-03 | Initial proposal — Status: Proposed                                                                                                                                                        |
| 2.0.0   | 2026-03-03 | Full rewrite — Status: Implemented. All 4 build phases shipped. 5 upgrades. 3 extras. Composition blueprint fixes. Quality parity. Cross-referenced against src.zip actual implementation. |

---

## 1. The Problem — Two Brains

Promagen had two independent systems that both built prompt text. They shared zero vocabulary, zero logic, and zero architecture.

### System A — Weather Prompt Generator

19 files in `src/lib/weather/` computing physics-based weather intelligence: solar elevation, lunar position, wind classification, precipitation, lighting engine (973 lines), visual truth (1,301 lines), camera lens selection (289 lines), composition, surface grounding, moisture phrases, wind phrases, venue intelligence, climate zones, cloud type classification.

**Assembly duplication (the problem):** 5 functions in `tier-generators.ts` each assembled prompt text independently:

- `generateTier1()` — CLIP-weighted text with hardcoded `:1.3`, `:1.2`, `:1.1` weights
- `generateTier1Flux()` — Strips CLIP weights into T5-friendly prose
- `generateTier2()` — Midjourney `::` syntax with `--ar` params
- `generateTier3()` — Natural language sentences with connectors
- `generateTier4()` — Plain comma-separated lists

### System B — Prompt Builder

`prompt-builder.ts` — the user-facing assembly engine with `assembleKeywords()`, `assembleNaturalSentences()`, `assemblePlainLanguage()`, routed by `assembleTierAware()`. Platform-format-driven with 42+ platforms configured for token limits, sweet spots, weight syntax, impact priority, category ordering, and negative handling.

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

Note: v1.0.0 proposed `WeatherCategoryMap` without `weightOverrides` or `confidence` fields. Both were added during implementation and are now part of the shipped type (`types/prompt-builder.ts` lines 256–288).

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
┌───────────────────────────────────────────────────────────────┐
│                                                               │
│                    assemblePrompt()                            │
│                    THE ONE BRAIN                               │
│                                                               │
│  Input:  platformId + PromptSelections + weightOverrides?     │
│  Output: tier-formatted text for that specific platform       │
│                                                               │
│  Routes to:                                                   │
│    assembleKeywords()         → Tier 1 CLIP, Tier 2 MJ       │
│    assembleNaturalSentences() → Tier 3 NL (DALL·E, Firefly)  │
│    assemblePlainLanguage()    → Tier 4 (Canva, Craiyon)       │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## 3. What the Assembler Learned

### 3.1 Rich Phrase Handling

The assembler now handles both short dropdown terms (`"moonlight"`) and long physics-computed phrases (`"Cool white moonlight competing with focused accent lighting"`). Each sub-assembler has phrase-length-aware logic:

- **`assembleKeywords()`** — short terms get weighted with platform syntax (e.g., `(moonlight:1.3)`). Long phrases (>4 words) are inserted without parenthetical weight wrapping — too much text in one weight group confuses the model.
- **`assembleNaturalSentences()`** — short terms use grammatical connectors ("in", "with"). Long phrases become standalone clauses or appended sentences — avoids `"with Cool white moonlight competing with focused accent lighting"`.
- **`assemblePlainLanguage()`** — long phrases get intelligent truncation for Tier 4's tight token budget (40–60 words).

Test: `prompt-builder-rich-phrases.test.ts` (318 lines)

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

| Function                        | Line | Purpose                                                                 |
| ------------------------------- | ---- | ----------------------------------------------------------------------- |
| `deduplicateWithinCategories()` | 937  | Drops short terms subsumed by longer terms in same category             |
| `deduplicateAcrossCategories()` | 987  | Drops exact dupes across categories, keeps in first per effective order |
| `getEffectiveOrder()`           | 397  | Computes category output order from `impactPriority` config             |
| `estimateClipTokens()`          | 494  | Token count estimation for all tiers                                    |
| `getPlatformFormat()`           | 1084 | Platform config lookup                                                  |
| `selectionsFromMap()`           | 1472 | Convert WeatherCategoryMap → PromptSelections                           |

---

## 4. What the Weather Generator Changed

### 4.1 Intelligence Preserved (No Changes)

All physics computation, lighting engine, visual truth, camera lens selection, surface grounding, moisture phrases, wind phrases, venue intelligence, climate zones, and cloud classification remain unchanged. These are the "what" — the brain's intelligence layer.

### 4.2 Assembly Delegation (New)

The generator now calls `buildWeatherCategoryMap()` (weather-category-mapper.ts, 521 lines) after computing all weather intelligence. This maps physics outputs to `PromptCategory` slots:

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

In `route.ts` (prompt-of-the-moment), the venue is selected once per rotation cycle, then passed to the generator via `venueOverride` (route.ts line 452). The `categoryMap.meta` returned by the generator now carries the true venue name, which the route uses for the "Inspired by" badge display (route.ts line 462).

---

## 6. "Inspired by" Badge Fix — Two-Effect Split

### 6.1 The Bug

The prompt builder's Phase D preload effect read `sessionStorage('promagen:preloaded-payload')` and applied both category selections AND the "Inspired by" badge data in a single `useEffect`. When the user manually edited any dropdown, the effect re-fired (because `categoryState` was in its dependency array), clearing and re-applying selections. This produced a visible "flash" and lost user edits.

### 6.2 The Fix

Split into two independent effects in `prompt-builder.tsx`:

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

**Delivered:** `weather-category-mapper.ts` (521 lines)

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

Internal enhancements to `assembleTierAware()`:

1. **Within-category dedup** — `deduplicateWithinCategories()` (line 937): drops short terms that are substrings of longer terms in the same category. Example: `["natural daylight", "Natural daylight, low rolling stratocumulus"]` → keeps only the longer phrase.

2. **Cross-category dedup** — `deduplicateAcrossCategories()` (line 987): scans all categories in effective output order. Same term in two categories → kept only in the first (higher-priority) category. Example: "photorealistic" in style AND lighting → kept only in style.

3. **Weight merge** — `assembleTierAware()` (line 1047): weather weight overrides provide a base layer; platform-defined `weightedCategories` spread on top. **Platform wins on conflicts.** This is intentional: platforms know their own weight syntax limits, and weather's suggestions are starting points.

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

4. **Token estimation** — `estimateClipTokens()` (line 494): computed for ALL tiers, not just CLIP. Result attached as `assembled.estimatedTokens` with `assembled.tokenLimit` from platform config.

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
Single Brain output — identical assembly logic for all sources
```

**Fallback:** If payload has `promptText` but no `categoryMap`, the builder falls back to displaying the pre-formatted text in a read-only preview (legacy path).

---

## 8. Quality Parity — Assembler vs Generator Output

### 8.1 Goal

The prompt text produced by `assemblePrompt(platformId, selectionsFromMap(categoryMap), categoryMap.weightOverrides)` must be visually indistinguishable from the old `generateTier1/2/3/4()` output for the same weather data. Users clicking "Try in" should see the same prompt quality in the builder as on the homepage.

### 8.2 Parity Fixes Shipped

**Quality prefix normalisation (platform-formats.json):**
SD-family platforms had inconsistent quality prefix terms. Normalised across Stability, Leonardo, ComfyUI, and other SD-derived platforms to use the same prefix set. This eliminates subtle differences where the builder output had "masterpiece, best quality" while the generator had "masterpiece, highly detailed".

**impactPriority alignment (platform-formats.json):**
Each platform's `impactPriority` array defines which categories appear in early token positions. These were aligned with the generator's implicit priority order to produce matching output order.

**Negative dedup verification:**
The generator's negative terms sometimes duplicated terms the assembler also injects from platform config `qualityNegative`. Cross-category dedup (Improvement 1) now catches these — same negative term from weather AND platform config → kept only once.

### 8.3 Remaining Difference

The tier generators produce hand-crafted sentence connectors ("A scene of...", "Shot on...") that the assembler's `assembleNaturalSentences()` approximates but doesn't replicate word-for-word. This is acceptable: the assembly is structurally equivalent and produces the same visual output from AI image generators. The exact prose framing differs but has zero impact on generated image quality.

---

## 9. Post-Integration Upgrades (v11.1.x)

After the core 4-phase build, a series of targeted upgrades improved assembler quality and fixed edge cases discovered during integration testing.

### Upgrade 3 — Canonical Assembly Dedup

**File:** `prompt-builder.ts` lines 937–1025
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
**Test:** `adaptive-weights.test.ts` (311 lines)

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
**Test:** `category-synergy.test.ts` (239 lines)

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

| File                                                 | Action                                                                                                           | Actual Lines      |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------- |
| `src/lib/prompt-builder.ts`                          | **ENHANCED** — 3-arg assemblePrompt, dedup, weight merge, token estimation                                       | 1,519 lines total |
| `src/lib/weather/weather-category-mapper.ts`         | **NEW** — category mapping from weather intelligence                                                             | 521 lines         |
| `src/lib/weather/composition-blueprint.ts`           | **NEW** — scene composition + dofPhrase + framing                                                                | 506 lines         |
| `src/lib/weather/synergy-rewriter.ts`                | **NEW** — conflict resolution + reinforcement bridging                                                           | 600 lines         |
| `src/lib/weather/category-synergy.ts`                | **NEW** — synergy score matrix                                                                                   | 409 lines         |
| `src/lib/weather/adaptive-weights.ts`                | **NEW** — density-aware weight calibration                                                                       | 254 lines         |
| `src/lib/weather/weather-prompt-generator.ts`        | **REFACTORED** — outputs WeatherCategoryMap, venueOverride                                                       | 561 lines         |
| `src/lib/weather/prompt-types.ts`                    | **UPDATED** — venueSeed, venueOverride fields                                                                    | ~614 lines        |
| `src/types/prompt-builder.ts`                        | **UPDATED** — WeatherCategoryMap, WeatherCategoryMeta, PromptDNAFingerprint, PromptDNAScore, 12 PromptCategories | 350 lines         |
| `src/data/providers/platform-formats.json`           | **UPDATED** — quality prefix normalisation, impactPriority alignment, weight syntax                              | 1,193 lines       |
| `src/app/api/homepage/prompt-of-the-moment/route.ts` | **UPDATED** — venueOverride, sharedCategoryMap, inspiredBy with hash                                             | 563 lines         |
| `src/components/home/prompt-showcase.tsx`            | **UPDATED** — stores categoryMap, forwards inspiredBy + hash                                                     | updated           |
| `src/components/providers/prompt-builder.tsx`        | **UPDATED** — Phase D preload, badge split, weatherWeightOverrides                                               | 2,431 lines total |

### Test Coverage

| Test File                               | Lines       | Covers                                   |
| --------------------------------------- | ----------- | ---------------------------------------- |
| `upgrade-3-canonical-assembly.test.ts`  | 160         | Within/cross-category dedup              |
| `upgrade-5-prompt-fingerprint.test.ts`  | 255         | DNA fingerprint hash + verification      |
| `extra-5-6-composition-synergy.test.ts` | 394         | Composition blueprint + synergy matrix   |
| `category-synergy.test.ts`              | 239         | Synergy scoring edge cases               |
| `adaptive-weights.test.ts`              | 311         | Weight calibration across densities      |
| `prompt-builder-rich-phrases.test.ts`   | 318         | Long phrase handling in all 3 assemblers |
| `prompt-dna.test.ts`                    | 330         | DNA fingerprint utilities                |
| `weather-category-mapper.test.ts`       | exists      | Category mapping from weather data       |
| **Total new test lines**                | **~2,007+** |                                          |

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

| Risk                                                   | Original Severity | Status         | Resolution                                                                                                                                                              |
| ------------------------------------------------------ | ----------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Assembler output quality drops below generators        | HIGH              | **Mitigated**  | Quality parity fixes shipped (§8). Rich phrase handling tested (318 test lines). Minor prose framing differences are acceptable — zero impact on AI image output.       |
| Long phrases break token budgets (MJ: 40 words)        | MEDIUM            | **Mitigated**  | `assemblePlainLanguage()` has intelligent truncation. `assembleKeywords()` skips weight-wrapping on long phrases. Token estimation (`estimateClipTokens`) warns users.  |
| CLIP weight wrapping produces garbage for long phrases | MEDIUM            | **Mitigated**  | Rich phrases (>4 words) are inserted without parenthetical weight wrapping. Adaptive weights (Extra 4) calibrate weights by density. Tested against Stability/Leonardo. |
| Breaking existing manual prompt builder behaviour      | HIGH              | **Mitigated**  | All existing tests pass. Rich phrase handling is additive — short-term code paths unchanged. Within-category dedup preserves original terms when no redundancy exists.  |
| Venue desync                                           | LOW               | **Resolved**   | Venue Singularity (Upgrade 4) eliminates desync entirely. `venueOverride` bypasses `getCityVenue()`.                                                                    |
| Performance: assembler called 4× per PotM request      | LOW               | **Acceptable** | assemblePrompt() is <1ms per call. PotM cached 10 minutes. No measurable impact.                                                                                        |
| Synergy rewriter produces unexpected replacements      | NEW               | **Monitored**  | Rewriter is opt-in (`rewriteWithSynergy()` before assembly). Callers control whether to use it. Resolution rules are explicit and testable (394 test lines).            |
| Adaptive weights over-dampen emphasis on dense prompts | NEW               | **Tested**     | Weight calibration maintains category hierarchy. 311 test lines verify density curves across 3–10 category fills.                                                       |

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

Canonical order is defined in `CATEGORY_ORDER` constant. Effective output order per platform is determined by `getEffectiveOrder()` which reads `impactPriority` from platform config and appends remaining categories.

---

## 15. Cross-References

| Document                               | Relationship                                                                                                                                                                                                                                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `exchange-card-weather.md`             | Authority doc for weather system. Composition blueprint (§11H) dofPhrase guard and vanishing-point framing are documented here. Camera/lens improvements (§11G) apply. Tier generators (§11K) now have a cross-reference noting assemblePrompt() handles the "Try in" builder path.                                |
| `prompt-builder-page.md`               | Authority doc for builder component. `assemblePrompt()` signature updated to 3-arg. `weatherWeightOverrides` state variable documented. Phase D data flow sessionStorage → builder pathway works end-to-end with weights.                                                                                          |
| `code-standard.md`                     | `assemblePrompt()` signature updated. `PromptCategory` type shows 12 categories. `platform-formats.json` quality prefix and impactPriority changes noted.                                                                                                                                                          |
| `prompt-optimizer.md`                  | §2.3 architecture diagram upstream of optimizer. Optimizer consumes output of assembler. Weight merge means weighted terms may carry weather-derived weights (e.g., `(LED lighting:1.3)` instead of platform-default 1.1). §12.1 references `getPlatformFormat()` — format now includes merged weightedCategories. |
| `ai_providers.md`                      | Prompt builder data sources section. Exports now include `getPlatformFormat()`. Line count stale — prompt-builder.ts is 1,519 lines (was documented as 763). platform-formats.json changes (quality prefix, impactPriority, weight syntax) noted.                                                                  |
| `weather-prompt-generator-analysis.md` | Scored system 82/100. Several recommendations now implemented: camera metadata improvements (Upgrade 4, Extra 5), composition fixes (dofPhrase guard, vanishing-point), platform negatives (cross-category dedup). "Path from 82 to 95+" section can get a status note.                                            |
| `prompt-builder-evolution-plan-v2.md`  | Evolution plan marked "ALL PHASES COMPLETE." The unified brain is a new initiative built on top of the evolution plan. Cross-reference to this document as the next phase.                                                                                                                                         |

---

## 16. Exports — prompt-builder.ts

All public exports from the single brain assembly engine (1,519 lines):

| Export                                                     | Purpose                                                          |
| ---------------------------------------------------------- | ---------------------------------------------------------------- |
| `assemblePrompt(platformId, selections, weightOverrides?)` | The One Brain — routes to correct sub-assembler by tier + config |
| `formatPromptForCopy(assembled)`                           | Returns positive prompt text for clipboard                       |
| `getPromptPreview(platformId, selections)`                 | Quick preview (calls assemblePrompt internally)                  |
| `getPlatformFormat(platformId)`                            | Platform config lookup (used by weight merge)                    |
| `getCategoryOptions(category, context?)`                   | Vocabulary-driven dropdown options (top 100)                     |
| `getAllCategoryOptions(category)`                          | Full vocabulary for a category                                   |
| `getCategoryConfig(category)`                              | Category metadata (label, maxSelections, etc.)                   |
| `getEnhancedCategoryConfig(...)`                           | Config with vocabulary context                                   |
| `getCategorySuggestions(...)`                              | Intelligent term suggestions                                     |
| `getCategoryChips(...)`                                    | Pre-selected chip terms                                          |
| `searchCategoryOptions(...)`                               | Fuzzy search within vocabulary                                   |
| `detectStyleFamily(selectedTerms)`                         | Style family detection from terms                                |
| `getAllCategories()`                                       | Returns `CATEGORY_ORDER` array                                   |
| `getOrderedCategories(platformId)`                         | Platform-specific effective order                                |
| `supportsNegativePrompts(platformId)`                      | Platform family check                                            |
| `supportsNativeNegative(platformId)`                       | Native negative support check                                    |
| `getPlatformTips(platformId)`                              | Platform usage tips                                              |
| `getPlatformExample(platformId)`                           | Example prompt for platform                                      |
| `getPlatformFamilyName(platformId)`                        | Human-readable family name                                       |
| `buildPrompt(providerId, input, website?)`                 | Legacy builder (backward compat)                                 |
| `tierToRefPlatform(tier)`                                  | Reference platform per tier                                      |
| `selectionsFromMap(categoryMap)`                           | Convert WeatherCategoryMap → PromptSelections                    |
| `estimateClipTokens`                                       | Token count estimation                                           |

---

## 17. Two Improvement Ideas (Not Implemented)

1. **Synergy-Driven Vocabulary Scoring:** The synergy matrix (Extra 6) defines which term pairs reinforce or conflict. Feed these scores back into the vocabulary suggestion engine so that when a user selects "moonlight" in lighting, the atmosphere dropdown boosts "contemplative" (synergy +0.7) and demotes "harsh midday" (synergy -0.6). The synergy data exists — it just needs to flow into `getCategorySuggestions()`.

2. **Adaptive Assembly Strategy Selection:** Currently the assembler routes by platform tier (CLIP → keywords, NL → sentences, Plain → comma lists). With the density analysis from adaptive weights, the assembler could dynamically choose a HYBRID strategy for mid-density prompts: keyword structure with natural language connectors. This would produce better output for platforms like Ideogram and Flux that accept both styles. The adaptive-weights density curve already classifies prompts into density bands — extend this to strategy selection.
