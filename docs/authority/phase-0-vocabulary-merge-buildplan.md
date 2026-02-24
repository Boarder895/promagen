# Phase 0 — Vocabulary Merge: Build Plan

**Version:** 1.0.0
**Created:** 2026-02-24
**Parent:** prompt-builder-evolution-plan-v2.md (Section 4)
**Status:** Ready to build
**Estimated effort:** 2–3 days (broken into 6 parts)

---

## What This Phase Does

Takes 13,123 disconnected vocabulary phrases sitting in `weather/`, `commodities/`, and `shared/` folders and curates ~2,500–3,000 of the best ones into 7 new JSON files inside a `vocabulary/merged/` directory. These merged files get wired into the existing vocabulary-loader so every dropdown in the prompt builder gains access to richer, more vivid options — without touching the original 3,955 core phrases.

**Before:** 12 dropdowns × ~300 options each = 3,955 phrases (all from `prompt-builder/` folder only).
**After:** 12 dropdowns × ~500–600 options each = ~6,500–7,000 phrases (core + merged).

No UI changes in this phase. This is pure data work + loader wiring.

---

## Current State (Ground Truth from src.zip)

### Connected (prompt-builder/) — 3,955 phrases

| File             | Phrases | Structure                                    |
| ---------------- | ------- | -------------------------------------------- |
| subject.json     | 332     | `{ meta, options: string[], subcategories }` |
| action.json      | 314     | same                                         |
| style.json       | 332     | same                                         |
| environment.json | 313     | same                                         |
| composition.json | 311     | same                                         |
| camera.json      | 339     | same                                         |
| lighting.json    | 341     | same                                         |
| atmosphere.json  | 346     | same                                         |
| colour.json      | 333     | same                                         |
| materials.json   | 325     | same                                         |
| fidelity.json    | 317     | same                                         |
| negative.json    | 352     | same                                         |

Each file has an `options` array of plain strings and `subcategories` dict grouping those strings. The index at `src/data/vocabulary/prompt-builder/index.ts` exports a `vocabulary` object and `getOptions()` function. The `vocabulary-loader.ts` reads from this index exclusively.

### Disconnected — 13,123 phrases across 3 folders

**Weather (3,336 phrases):**

| File             | Phrases | Structure                                                                              | Useful phrases for merge                                                      |
| ---------------- | ------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| city-vibes.json  | 2,261   | `{ cities: { [city]: { venues: [...] } } }` — 94 cities, ~24 venues each               | Environment: real-world venues ("Tsukiji Fish Market", "Corniche waterfront") |
| conditions.json  | 327     | `{ conditions: { clear_sunny: { phrases: [...] } } }` — 16 weather types × ~20 phrases | Atmosphere: "rain-slicked streets", "fog-shrouded"                            |
| urban-light.json | 254     | Nested by lighting type                                                                | Lighting: "sodium-vapour haze", "neon on wet asphalt"                         |
| wind.json        | 278     | Range-based `{ ranges: { calm: { phrases: [...] } } }`                                 | Atmosphere (subset): "howling gale", "gentle breeze"                          |
| temperature.json | 80      | Range-based                                                                            | Atmosphere (subset): "blistering heat shimmer", "bone-chilling cold"          |
| humidity.json    | 88      | Range-based                                                                            | Atmosphere (subset): "thick tropical humidity", "dry desert air"              |
| time-of-day.json | 48      | `{ hours: { "0": [...], "1": [...] } }` — 24 × 2                                       | Lighting/Atmosphere (subset): "deep night stillness"                          |

**Commodities (7,618 phrases):**

| File                                 | Phrases | Best phrases for merge                                                      |
| ------------------------------------ | ------- | --------------------------------------------------------------------------- |
| commodity-vibes.json                 | 2,756   | Scattered quality — needs heavy curation                                    |
| production-countries.json            | 767     | Environment: "Brazilian highlands", "Arabian desert", "Norwegian fjords"    |
| transformation-states.json           | 624     | Action: "smelting molten metal", "forging under pressure", "distilling"     |
| extraction-methods.json              | 280     | Action: "deep mining shaft", "offshore drilling platform"                   |
| end-use-sectors.json                 | 281     | Environment (subset): "factory floor", "research laboratory"                |
| cross-population-merge.json          | 281     | Mixed — needs sorting into categories                                       |
| shared-vocab-expansion.json          | 220     | Mixed descriptors                                                           |
| geopolitical.json                    | 208     | DO NOT MERGE — "sanctions regime" not visual                                |
| historical-moments.json              | 208     | DO NOT MERGE — too narrative                                                |
| containers.json                      | 186     | Environment + Materials: "cargo containers stacked", "grain silos towering" |
| night-operations.json                | 187     | Lighting + Atmosphere: "refinery flare glow", "dock crane spotlights"       |
| rituals.json                         | 177     | Action (subset): "morning inspection", "quality testing"                    |
| sensory-visual.json                  | 150     | Materials + Colour: "molten gold streaming", "oxidized copper patina"       |
| trading-culture.json                 | 136     | DO NOT MERGE (mostly) — finance jargon                                      |
| human-stories-traders-consumers.json | 138     | Subject (subset): "floor trader", "commodity broker"                        |
| human-stories-workers.json           | 126     | Subject: "oil rig roughneck", "tea plantation picker"                       |
| price-states.json                    | 128     | Atmosphere (subset): "euphoric ascent", "creeping dread"                    |
| sensory-touch-sound.json             | 126     | Atmosphere: "metallic clanging echo", "rumbling machinery"                  |
| sensory-smell-taste.json             | 125     | Atmosphere (subset): "acrid chemical tang"                                  |
| absence-states.json                  | 240     | DO NOT MERGE — too niche                                                    |
| commodity-vibes.json                 | 2,756   | Cherry-pick — massive file, variable quality                                |
| weather-commodity-links.json         | 274     | DO NOT MERGE — too domain-specific                                          |

**Shared (2,169 phrases):**

| File              | Phrases | Best phrases for merge                                                                                                                                                         |
| ----------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| adjectives.json   | 1,136   | Atmosphere + Colour (curated subset ~200): "ancient", "crystalline", "luminous" — has subcategories: size, age, temperature, texture, shape, colour, mood, light, time, origin |
| connectors.json   | 531     | DO NOT MERGE — assembler glue ("with", "featuring", "bathed in")                                                                                                               |
| intensifiers.json | 502     | DO NOT MERGE — assembler modifiers ("extremely", "subtly")                                                                                                                     |

**Intelligence (4,282 phrases) — NOT for merge (metadata layer):**

Already used by vocabulary-loader.ts for family detection / conflict avoidance. Stays as-is.

---

## Build Parts

### Overview

| Part    | What                                       | Effort | Output                                             |
| ------- | ------------------------------------------ | ------ | -------------------------------------------------- |
| **0.1** | Audit + curate WEATHER phrases             | ~3 hrs | Curated phrase lists with category assignments     |
| **0.2** | Audit + curate COMMODITY phrases           | ~4 hrs | Curated phrase lists with category assignments     |
| **0.3** | Audit + curate SHARED phrases              | ~1 hr  | Curated adjective subset with category assignments |
| **0.4** | Create `merged/` JSON files + manifest     | ~2 hrs | 7 new JSON files + merge-manifest.json             |
| **0.5** | Wire vocabulary-loader to read merged data | ~3 hrs | Updated loader, index, types                       |
| **0.6** | Verification + deduplication tests         | ~1 hr  | Passing tests, confirmed counts                    |

---

## Part 0.1 — Audit + Curate WEATHER Phrases

**Goal:** Extract the best image-prompt-worthy phrases from 7 weather vocab files and assign each to a prompt-builder category.

### Source → Target Mapping

| Source file                | Target category       | Extraction method                                                                                                   | Est. phrases |
| -------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------ |
| urban-light.json           | **Lighting**          | All phrases — these ARE lighting descriptions                                                                       | ~254         |
| city-vibes.json → venues   | **Environment**       | Extract venue names + descriptions from 94 cities. Pick top ~12 per city = ~1,100. Remove duplicates, generic ones. | ~800–1,000   |
| conditions.json → phrases  | **Atmosphere**        | All 16 condition types × ~20 phrases. Remove overly technical ones.                                                 | ~250         |
| wind.json → phrases        | **Atmosphere**        | Extract descriptive phrases only, skip numeric ranges                                                               | ~60          |
| temperature.json → phrases | **Atmosphere**        | Extract feel-phrases only ("blistering heat shimmer"), skip numbers                                                 | ~40          |
| humidity.json → phrases    | **Atmosphere**        | Extract feel-phrases ("thick tropical humidity"), skip numbers                                                      | ~30          |
| time-of-day.json           | **Lighting** (subset) | Extract descriptive phrases ("deep night stillness", "first light breaking")                                        | ~30          |

**Estimated weather total: ~1,464–1,664 phrases**

### Curation Rules (Weather)

1. **KEEP** if the phrase paints a visual picture you'd want in an AI image prompt
2. **REMOVE** if it contains numbers, percentages, or technical meteorology terms
3. **REMOVE** duplicates and near-duplicates (keep the more vivid version)
4. **REMOVE** phrases shorter than 2 words (single adjectives go to shared, not here)
5. For city venues: **KEEP** specific named places ("Tsukiji Fish Market"), **REMOVE** generic descriptions ("a busy market")

### Steps

```
Step 1: Run extraction script (Claude builds this)
  - Parse each weather JSON
  - Flatten all phrases into a CSV: [source_file, original_key, phrase, suggested_category]
  - Output: weather-audit.csv

Step 2: Human review (Martin)
  - Open CSV in spreadsheet
  - Mark each row: KEEP / REMOVE / RECATEGORISE
  - Takes ~30–45 min for ~1,600 phrases

Step 3: Generate curated lists
  - Filter to KEEP rows
  - Group by target category
  - Output: curated-weather-lighting.json, curated-weather-atmosphere.json, curated-weather-environment.json
```

### Verification

- [ ] No phrase appears in both weather-merged AND core prompt-builder files
- [ ] Every kept phrase is ≥2 words
- [ ] No numeric values in any phrase
- [ ] Venue names are real places (spot-check 20 random)

---

## Part 0.2 — Audit + Curate COMMODITY Phrases

**Goal:** Extract visually compelling phrases from 21 commodity vocab files. Heavy curation needed — commodity files mix brilliant imagery with finance jargon.

### Source → Target Mapping

| Source file                               | Target category | What to extract                                    | Est. phrases |
| ----------------------------------------- | --------------- | -------------------------------------------------- | ------------ |
| sensory-visual.json → colors              | **Colour**      | "molten gold streaming", "oxidized copper patina"  | ~60          |
| sensory-visual.json → textures            | **Materials**   | "polished ingot surface", "raw ore jagged"         | ~50          |
| sensory-visual.json → appearances         | **Materials**   | "raw unprocessed bulk", "catching warehouse light" | ~30          |
| night-operations.json (lighting subset)   | **Lighting**    | "refinery flare glow", "dock crane spotlights"     | ~50          |
| night-operations.json (atmosphere subset) | **Atmosphere**  | "shift-change quiet", "24/7 industrial hum"        | ~60          |
| transformation-states.json                | **Action**      | "smelting molten metal", "forging under hammer"    | ~150         |
| extraction-methods.json                   | **Action**      | "deep mining shaft descent", "offshore drilling"   | ~80          |
| rituals.json (daily + professional)       | **Action**      | "morning inspection rounds", "quality testing"     | ~60          |
| human-stories-workers.json                | **Subject**     | "oil rig roughneck", "tea plantation picker"       | ~100         |
| human-stories-traders-consumers.json      | **Subject**     | "floor trader gesturing", "commodity broker"       | ~40          |
| containers.json → environment             | **Environment** | "cargo containers stacked dockside", "grain silos" | ~60          |
| containers.json → materials               | **Materials**   | "rusted steel drum", "wooden crate weathered"      | ~40          |
| production-countries.json                 | **Environment** | "Brazilian highlands", "Arabian desert expanse"    | ~150         |
| end-use-sectors.json                      | **Environment** | "factory floor production line", "research lab"    | ~60          |
| price-states.json (mood subset)           | **Atmosphere**  | "euphoric ascent energy", "creeping dread"         | ~40          |
| sensory-touch-sound.json                  | **Atmosphere**  | "metallic clanging echo", "rumbling machinery"     | ~50          |
| commodity-vibes.json (cherry-pick)        | **Various**     | Massive file — scan for gems, expect ~5% keep rate | ~130         |
| cross-population-merge.json               | **Various**     | Sort into appropriate categories                   | ~80          |
| shared-vocab-expansion.json               | **Various**     | Sort into appropriate categories                   | ~80          |

**Estimated commodity total: ~1,370 phrases**

### DO NOT MERGE (skip entirely)

| File                         | Why                                                 |
| ---------------------------- | --------------------------------------------------- |
| geopolitical.json            | "Sanctions regime", "trade embargo" — not visual    |
| historical-moments.json      | "Tulip mania", "oil shock of 1973" — too narrative  |
| trading-culture.json         | "Open outcry", "margin call" — finance jargon       |
| weather-commodity-links.json | Cross-reference data, not visual phrases            |
| absence-states.json          | "Supply vacuum", "depleted reserves" — too abstract |
| sensory-smell-taste.json     | "Acrid chemical tang" — smell/taste aren't visual   |

### Curation Rules (Commodities)

1. **KEEP** if it creates a visual scene you'd want an AI to render
2. **REMOVE** finance/economics jargon ("margin call", "futures contract", "supply chain disruption")
3. **REMOVE** abstract concepts that don't translate to images ("market anxiety", "trade dynamics")
4. **KEEP** industrial/worker imagery — this is Promagen's unique visual angle nobody else has
5. **KEEP** raw material descriptions — textures, colours, states of matter are gold for prompt building
6. For commodity-vibes.json (2,756 phrases): scan the FIRST 5 entries of each commodity. If mostly visual, scan deeper. If mostly abstract, skip that commodity section.

### Steps

```
Step 1: Run extraction script (Claude builds this)
  - Parse each commodity JSON (varied structures — needs per-file handling)
  - Flatten all candidate phrases: [source_file, original_key, phrase, suggested_category]
  - Auto-flag finance jargon (word list: margin, futures, contract, equity, hedge, short, long, derivative, yield, bond, portfolio)
  - Output: commodity-audit.csv

Step 2: Human review (Martin)
  - Open CSV
  - Mark: KEEP / REMOVE / RECATEGORISE
  - Skip pre-flagged finance jargon (just confirm removal)
  - Takes ~45–60 min for ~2,500 candidate phrases

Step 3: Generate curated lists
  - Group by target category
  - Output: curated-commodity-lighting.json, curated-commodity-atmosphere.json, etc.
```

### Verification

- [ ] No finance jargon in any kept phrase (grep for flagged terms)
- [ ] No phrase duplicates core prompt-builder files
- [ ] Every phrase is ≥2 words
- [ ] Worker/trader subjects are respectful and non-stereotyping

---

## Part 0.3 — Audit + Curate SHARED Phrases

**Goal:** Select ~200 of the best universal adjectives from the shared vocabulary that enhance image prompts. Much smaller scope — focused curation.

### Source → Target Mapping

| Source file                                | Target category | What to extract                                      | Est. phrases |
| ------------------------------------------ | --------------- | ---------------------------------------------------- | ------------ |
| adjectives.json → mood subcategory         | **Atmosphere**  | "ethereal", "haunting", "serene", "chaotic"          | ~40          |
| adjectives.json → light subcategory        | **Lighting**    | "luminous", "shadowy", "radiant", "dim"              | ~30          |
| adjectives.json → colour subcategory       | **Colour**      | "crimson", "azure", "emerald", "golden"              | ~40          |
| adjectives.json → texture subcategory      | **Materials**   | "crystalline", "weathered", "polished", "rough-hewn" | ~30          |
| adjectives.json → size/shape subcategories | **Composition** | "towering", "sprawling", "intricate", "geometric"    | ~30          |
| adjectives.json → age/time subcategories   | **Atmosphere**  | "ancient", "futuristic", "timeworn", "pristine"      | ~30          |

**DO NOT MERGE:**

| File                            | Why                                                                              |
| ------------------------------- | -------------------------------------------------------------------------------- |
| connectors.json (531 phrases)   | Assembler glue words ("with", "featuring") — used internally by prompt generator |
| intensifiers.json (502 phrases) | Modifier words ("extremely", "subtly") — used internally by prompt generator     |

**Estimated shared total: ~200 phrases**

### Curation Rules (Shared)

1. **KEEP** single adjectives that are vivid and visually evocative
2. **REMOVE** generic adjectives that don't add visual value ("nice", "good", "interesting")
3. **REMOVE** adjectives that duplicate what's already in core files (check before adding)
4. **KEEP** adjectives that pair well with nouns in other categories (test: "a [adjective] landscape" — does it create a picture?)

### Steps

```
Step 1: Extract adjectives by subcategory from adjectives.json
Step 2: Cross-reference against existing core prompt-builder options (remove dupes)
Step 3: Assign each to target category
Step 4: Output: curated-shared-atmosphere.json, curated-shared-colour.json, etc.
```

### Verification

- [ ] No phrase duplicates any core prompt-builder option
- [ ] Each adjective tested mentally: "a [word] scene" — does it evoke a visual?

---

## Part 0.4 — Create `merged/` JSON Files + Manifest

**Goal:** Combine the curated outputs from Parts 0.1–0.3 into 7 final JSON files in a new `vocabulary/merged/` directory, plus a manifest file that tracks everything.

### New Directory Structure

```
src/data/vocabulary/merged/
  lighting.json          ← weather/urban-light + weather/time-of-day + commodity/night-ops + shared/light adjectives
  atmosphere.json        ← weather/conditions + wind + temp + humidity + commodity/price-states + sensory-sound + shared/mood + shared/age
  environment.json       ← weather/city-vibes venues + commodity/production-countries + containers + end-use-sectors
  subject.json           ← commodity/human-stories-workers + human-stories-traders
  action.json            ← commodity/transformation-states + extraction-methods + rituals
  materials.json         ← commodity/sensory-visual textures + containers materials + shared/texture adjectives
  colour.json            ← commodity/sensory-visual colours + shared/colour adjectives
  merge-manifest.json    ← tracks source, count, version for every merged file
```

### JSON Format (matches core prompt-builder structure)

Each merged file follows the EXACT same structure as core files so the loader can read them identically:

```json
{
  "$schema": "vocabulary-merged",
  "version": "1.0.0",
  "meta": {
    "domain": "merged",
    "category": "lighting",
    "label": "Lighting (Merged)",
    "description": "Urban light, industrial glow, time-of-day phrases from weather and commodity vocabularies",
    "tooltipGuidance": "Merged from weather and commodity data",
    "totalOptions": 334,
    "sources": [
      { "file": "weather/urban-light.json", "count": 254 },
      { "file": "weather/time-of-day.json", "count": 30 },
      { "file": "commodities/night-operations.json", "count": 50 }
    ],
    "updated": "2026-02-25"
  },
  "options": [
    "sodium-vapour haze",
    "neon on wet asphalt",
    "refinery flare glow",
    ...
  ]
}
```

### merge-manifest.json Format

```json
{
  "version": "1.0.0",
  "generated": "2026-02-25",
  "summary": {
    "totalMergedPhrases": 3034,
    "filesGenerated": 7,
    "sourceFolders": ["weather", "commodities", "shared"]
  },
  "files": {
    "lighting.json": {
      "targetCategory": "lighting",
      "phraseCount": 334,
      "sources": [
        { "file": "weather/urban-light.json", "phrasesUsed": 254, "phrasesAvailable": 254 },
        { "file": "weather/time-of-day.json", "phrasesUsed": 30, "phrasesAvailable": 48 },
        { "file": "commodities/night-operations.json", "phrasesUsed": 50, "phrasesAvailable": 187 }
      ]
    },
    "atmosphere.json": { ... },
    "environment.json": { ... },
    "subject.json": { ... },
    "action.json": { ... },
    "materials.json": { ... },
    "colour.json": { ... }
  },
  "excluded": {
    "files": [
      "commodities/geopolitical.json",
      "commodities/historical-moments.json",
      "commodities/trading-culture.json",
      "commodities/weather-commodity-links.json",
      "commodities/absence-states.json",
      "shared/connectors.json",
      "shared/intensifiers.json"
    ],
    "reason": "Domain-specific, non-visual, or internal assembler use only"
  }
}
```

### Steps

```
Step 1: Create directory src/data/vocabulary/merged/
Step 2: Combine curated outputs from Parts 0.1–0.3 into 7 JSON files
Step 3: Deduplicate within each file (case-insensitive, trim whitespace)
Step 4: Deduplicate against core prompt-builder options (no phrase in BOTH core AND merged)
Step 5: Generate merge-manifest.json with exact counts
Step 6: Sort options alphabetically within each file (consistent ordering)
```

### Verification

- [ ] Every merged JSON file passes JSON.parse without error
- [ ] Every merged file has same top-level structure as core files ($schema, version, meta, options)
- [ ] merge-manifest.json counts match actual option array lengths
- [ ] Zero duplicates between merged/ and prompt-builder/ files (automated check)
- [ ] Zero duplicates within any single merged file

---

## Part 0.5 — Wire Vocabulary-Loader to Read Merged Data

**Goal:** Update the vocabulary loading pipeline so dropdowns show core + merged options. No UI changes — just the data layer.

### Files to Change

| File                                          | Change                                                    | Why                                                |
| --------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------- |
| `src/data/vocabulary/merged/index.ts`         | **NEW** — exports merged vocabulary data                  | Mirror of prompt-builder/index.ts for merged files |
| `src/lib/vocabulary/vocabulary-loader.ts`     | **EDIT** — `loadCategoryVocabulary()` reads core + merged | Combines both pools                                |
| `src/data/vocabulary/prompt-builder/index.ts` | **NO CHANGE**                                             | Core stays untouched                               |

### New File: `src/data/vocabulary/merged/index.ts`

```typescript
// Imports all 7 merged JSON files
// Exports a mergedVocabulary object and getMergedOptions() function
// Structure mirrors prompt-builder/index.ts exactly
```

### Edit: `vocabulary-loader.ts`

Current `loadCategoryVocabulary()` does:

```
const allOptions = getOptions(category);  // reads prompt-builder/ only
```

Updated to:

```
const coreOptions = getOptions(category);           // 3,955 core phrases
const mergedOptions = getMergedOptions(category);    // ~3,000 merged phrases
const allOptions = [...coreOptions, ...mergedOptions]; // Combined ~6,500+
```

**Critical detail:** Core options come FIRST. Merged options append. This means:

- Dropdowns show familiar options at the top (core)
- Merged enrichment appears when user scrolls or searches
- Existing behaviour is 100% preserved for current users

### Steps

```
Step 1: Create src/data/vocabulary/merged/index.ts
  - Import all 7 merged JSON files
  - Export mergedVocabulary object (keyed by CategoryKey)
  - Export getMergedOptions(category) function
  - Handle categories with no merged file gracefully (return [])

Step 2: Update vocabulary-loader.ts
  - Import getMergedOptions from merged/index
  - In loadCategoryVocabulary(): combine core + merged options
  - In loadAllVocabulary(): same combination
  - In getChipDisplayOptions(): include merged
  - In searchCategoryVocabulary(): include merged

Step 3: Update meta.totalAvailable counts
  - CategoryVocabulary.meta.totalAvailable should reflect core + merged count
  - Add meta.coreCount and meta.mergedCount for transparency

Step 4: Verify TypeScript compiles
  - npm run typecheck (zero new errors)

Step 5: Verify existing tests pass
  - npm run test (zero regressions)
```

### What Does NOT Change

- `prompt-builder/index.ts` — untouched
- `vocabulary-integration.ts` — untouched (it has its own hardcoded data)
- `weather/vocabulary-loaders.ts` — untouched (weather prompt generator still reads weather files directly)
- `commodity-prompt-generator.ts` — untouched (still reads commodity files directly)
- Any UI component — untouched
- The `prompt-builder.tsx` component — untouched (it reads from vocabulary-loader, which now returns more options)

**Existing features preserved: Yes** — core options array is unchanged and stays in first position.

---

## Part 0.6 — Verification + Deduplication Tests

**Goal:** Automated checks that the merge is correct, complete, and has no regressions.

### Tests to Write

```typescript
// src/__tests__/vocabulary-merge.test.ts

describe('Vocabulary Merge', () => {
  test('merge-manifest counts match actual JSON file lengths', () => {
    // For each file in manifest.files:
    //   Load the JSON, count options, compare to manifest.phraseCount
  });

  test('no duplicates between core and merged within same category', () => {
    // For each category:
    //   Get core options (case-insensitive)
    //   Get merged options (case-insensitive)
    //   Intersection should be empty
  });

  test('no duplicates within any single merged file', () => {
    // For each merged file:
    //   options.length === new Set(options.map(o => o.toLowerCase())).size
  });

  test('no empty strings in any merged file', () => {
    // For each merged file:
    //   Every option is non-empty after trim
  });

  test('every merged phrase is at least 2 characters', () => {
    // Filter out single-character strings
  });

  test('no finance jargon leaked into merged files', () => {
    // Grep all merged options for: margin, futures, contract, equity,
    // hedge, derivative, yield, bond, portfolio, sanctions, embargo
    // Should find zero matches
  });

  test('total merged phrase count matches manifest summary', () => {
    // Sum all file counts, compare to manifest.summary.totalMergedPhrases
  });

  test('vocabulary-loader returns more options after merge', () => {
    // For categories that have merged data:
    //   loadCategoryVocabulary(category).allOptions.length > core count
  });

  test('core options appear before merged options in allOptions', () => {
    // First N options should match core exactly
    // Remaining should match merged exactly
  });

  test('categories without merged data return core-only', () => {
    // composition, camera, fidelity, negative, style have no merged file
    // Their allOptions.length should equal core count
  });
});
```

### Manual Verification Checklist

- [ ] `npm run typecheck` — zero errors
- [ ] `npm run lint` — zero new warnings
- [ ] `npm run test` — all existing tests pass + new merge tests pass
- [ ] `npm run build` — builds successfully
- [ ] Open prompt builder at localhost:3000/providers/[any-id]
- [ ] Click any dropdown that has merged data (Lighting, Atmosphere, Environment, Subject, Action, Materials, Colour)
- [ ] Confirm: you see MORE options than before
- [ ] Confirm: familiar options still appear at the top
- [ ] Confirm: no blank entries, no gibberish, no finance jargon
- [ ] Type a search term from a merged phrase — confirm it appears in results
- [ ] Dropdowns without merged data (Composition, Camera, Fidelity, Negative, Style) — confirm unchanged count

---

## Summary: Expected Outcome

| Category        | Core (before) | Merged (new) | Total (after) |
| --------------- | ------------- | ------------ | ------------- |
| **Lighting**    | 341           | ~334         | ~675          |
| **Atmosphere**  | 346           | ~530         | ~876          |
| **Environment** | 313           | ~1,070       | ~1,383        |
| **Subject**     | 332           | ~140         | ~472          |
| **Action**      | 314           | ~290         | ~604          |
| **Materials**   | 325           | ~150         | ~475          |
| **Colour**      | 333           | ~130         | ~463          |
| Composition     | 311           | 0            | 311           |
| Camera          | 339           | 0            | 339           |
| Fidelity        | 317           | 0            | 317           |
| Negative        | 352           | 0            | 352           |
| Style           | 332           | 0            | 332           |
| **TOTAL**       | **3,955**     | **~2,644**   | **~6,599**    |

Vocabulary utilisation goes from 23.2% to approximately **38.7%** (6,599 of 17,078 reachable via dropdowns). The remaining ~10,500 phrases stay available for Scene Starters (Phase 2), Explore Drawer (Phase 3), and future learning systems (Phases 5–7) to surface contextually.

---

## Build Order

```
Part 0.1  →  Part 0.2  →  Part 0.3  →  Part 0.4  →  Part 0.5  →  Part 0.6
  (weather)   (commodity)   (shared)    (JSON files)  (loader)     (tests)
  ~3 hrs       ~4 hrs       ~1 hr       ~2 hrs        ~3 hrs       ~1 hr
```

Parts 0.1, 0.2, 0.3 can run in parallel if you want — they don't depend on each other.
Part 0.4 needs all three curation outputs.
Part 0.5 needs the final JSON files from Part 0.4.
Part 0.6 needs everything.

**Total: ~14 hours of work across 2–3 days.**

---

## Files Created / Modified

| File                                             | Action | Part |
| ------------------------------------------------ | ------ | ---- |
| `src/data/vocabulary/merged/lighting.json`       | NEW    | 0.4  |
| `src/data/vocabulary/merged/atmosphere.json`     | NEW    | 0.4  |
| `src/data/vocabulary/merged/environment.json`    | NEW    | 0.4  |
| `src/data/vocabulary/merged/subject.json`        | NEW    | 0.4  |
| `src/data/vocabulary/merged/action.json`         | NEW    | 0.4  |
| `src/data/vocabulary/merged/materials.json`      | NEW    | 0.4  |
| `src/data/vocabulary/merged/colour.json`         | NEW    | 0.4  |
| `src/data/vocabulary/merged/merge-manifest.json` | NEW    | 0.4  |
| `src/data/vocabulary/merged/index.ts`            | NEW    | 0.5  |
| `src/lib/vocabulary/vocabulary-loader.ts`        | EDIT   | 0.5  |
| `src/__tests__/vocabulary-merge.test.ts`         | NEW    | 0.6  |

**Files NOT changed:** Every file in `prompt-builder/`, `weather/`, `commodities/`, `shared/`, `intelligence/`. All original vocab files stay untouched.

---

_End of Phase 0 Build Plan. Ready to execute Part 0.1._
