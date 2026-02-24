# Prompt Optimizer — Authority Documentation

**Version:** 3.0.0
**Authority:** This is the single source of truth for the prompt optimizer subsystem.
**Last updated:** 24 Feb 2026

---

## 1. Purpose

The Prompt Optimizer is a self-contained subsystem that intelligently shortens assembled prompts to fit within each AI platform's character and token limits — without destroying the visual meaning of the prompt.

It sits between the prompt assembler (which builds the prompt from user selections) and the copy-to-clipboard action. When enabled, it optimises the assembled prompt using a multi-phase pipeline tuned to the specific platform's text encoder architecture.

No competitor provides this. Most generators either hard-truncate or silently drop tokens. Promagen's optimizer understands **why** each term matters and removes the least impactful ones first.

**Cross-references:**

- Prompt builder page architecture → `prompt-builder-page.md`
- Pro tier gating for Transparency Panel → `paid_tier.md`
- Intelligence/scoring/semantic tags → `prompt-intelligence.md`

---

## 2. System Overview

### 2.1 File Map

| File                                    | Path                                         | Lines | Purpose                                                                                                         |
| --------------------------------------- | -------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------- |
| **prompt-optimizer.ts**                 | `src/lib/`                                   | 1,604 | Core engine: 4 pipelines, 5-phase optimization, 217 redundancy pairs, 59 compression rules, semantic similarity |
| **clip-bpe-tokenizer.ts**               | `src/lib/`                                   | 367   | CLIP BPE tokenization: exact token counts when vocab loaded, improved heuristic (~93%) as fallback              |
| **use-prompt-optimization.ts**          | `src/hooks/`                                 | 356   | React hook: manages toggle state, real-time length analysis, platform-specific tooltips                         |
| **prompt-limits.ts**                    | `src/types/`                                 | 310   | TypeScript types: PromptLimit, LengthStatus, ImpactCategory, ModelArchitecture                                  |
| **prompt-limits.json**                  | `src/data/providers/`                        | 558   | Platform-specific limits for all 42 platforms: maxChars, idealMin/Max, tokenLimit, architecture                 |
| **prompt-limits.schema.json**           | `src/data/providers/`                        | 117   | JSON Schema validation for prompt-limits.json                                                                   |
| **optimization-transparency-panel.tsx** | `src/components/providers/`                  | 419   | Pro-only UI panel showing optimization reasoning grouped by phase                                               |
| **text-length-optimizer.tsx**           | `src/components/providers/`                  | 347   | Toggle component: OFF=Core Colours gradient outline, ON=purple gradient fill                                    |
| **platform-optimization.ts**            | `src/lib/prompt-intelligence/engines/`       | 589   | Platform formatting engine: prompt assembly, smart trim, category ordering                                      |
| **platform-optimization.test.ts**       | `src/lib/prompt-intelligence/engines/tests/` | 420   | Jest tests for platform formatting                                                                              |

**Total:** 10 files, ~5,087 lines

### 2.2 Offline Tools (Python)

| Tool                               | Purpose                                                                                              | Output                                  |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `tools/generate-semantic-pairs.py` | Pre-compute CLIP text embeddings for all ~5,500 vocabulary terms, find cosine similarity >0.85 pairs | `src/data/semantic-pairs.json` (~200KB) |
| `tools/generate-clip-vocab.py`     | Extract CLIP's BPE vocabulary (49,152 merge rules) into JSON                                         | `src/data/clip-bpe-vocab.json`          |

Both tools are optional. The system degrades gracefully if their output files don't exist — hand-curated pairs are used instead of semantic pairs, and the improved heuristic replaces exact BPE tokenization.

### 2.3 Architecture Diagram

```
User selects terms in Prompt Builder
        │
        ▼
┌──────────────────────────┐
│  Prompt Assembler         │  prompt-builder.ts
│  assembleTierAware()      │  Builds platform-specific prompt text
│  4 assembly strategies:   │  from user selections + composition pack
│    assembleKeywords()     │
│    assembleMidjourney()   │  Injects qualityPrefix/qualitySuffix
│    assembleNaturalSent()  │  from platform-formats.json
│    assemblePlainLang()    │
└──────────┬───────────────┘
           │  assembled prompt text
           ▼
┌──────────────────────────┐
│  Prompt Optimizer         │  prompt-optimizer.ts
│  optimizePromptGold()     │  ← THIS SUBSYSTEM
│                           │
│  1. Detect strategy       │  detectStrategy() → keywords|midjourney|natural|plain
│  2. Route to pipeline     │  4 optimizer pipelines (§3)
│  3. Run phases 0→4        │  Each pipeline uses shared building blocks
│  4. Return result         │  OptimizeResult with removedTerms + reasoning
└──────────┬───────────────┘
           │  OptimizeResult
           ▼
┌──────────────────────────┐
│  use-prompt-optimization  │  React hook
│  hook (v3.0.0)            │
│                           │  - Toggle state (starts OFF)
│  - Real-time analysis     │  - Length indicator (285/350 ✓)
│  - getOptimizedPrompt()   │  - Platform tooltip content
└──────────┬───────────────┘
           │
     ┌─────┴──────┐
     ▼            ▼
┌─────────┐  ┌──────────────────────────┐
│ Toggle  │  │ Transparency Panel       │
│ UI      │  │ (Pro only)               │
│         │  │ Shows removed terms      │
│ OFF=    │  │ grouped by phase:        │
│ gradient│  │   Phase 0: redundancy    │
│ outline │  │   Phase 1: token overflow│
│ ON=     │  │   Phase 2/3: scored      │
│ purple  │  │   Phase 4: compressed    │
│ fill    │  │                          │
└─────────┘  └──────────────────────────┘
```

---

## 3. The 4 Optimizer Pipelines

The optimizer mirrors the assembler's tier system exactly. The `detectStrategy()` function reads the platform's tier ID and prompt style to select the correct pipeline:

```
tierId === 4                         → 'plain'      → Pipeline 4
promptStyle === 'keywords' + tierId 2 → 'midjourney' → Pipeline 2
promptStyle === 'keywords'            → 'keywords'   → Pipeline 1
else                                  → 'natural'    → Pipeline 3
```

### 3.1 Pipeline 1: CLIP Keyword Optimizer (Tier 1)

**Platforms:** 13 — artguru, clipdrop, dreamlike, dreamstudio, getimg, jasper-art, leonardo, lexica, nightcafe, novelai, openart, playground, stability

**Input format:** Comma-separated keywords with optional CLIP weight syntax `(term:1.3)`

**Phases:**

| Phase | Name                   | What it does                                                              | Quality cost                             |
| ----- | ---------------------- | ------------------------------------------------------------------------- | ---------------------------------------- |
| 0     | Redundancy removal     | Removes duplicate semantics using 217 hand-curated + auto-generated pairs | None — free quality improvement          |
| 1     | CLIP token overflow    | Removes terms past the 77-token hard limit (model literally ignores them) | None — invisible terms removed           |
| 2     | Position-aware scoring | Scores each term: `category_weight × position_decay × 100`                | Setup for Phase 3                        |
| 3     | Weakest-term removal   | Surgically removes lowest-scored terms one at a time until under target   | Minimal — least important terms go first |
| 4     | Prompt compression     | Rewrites verbose phrases to shorter equivalents (59 rules)                | None — visual meaning preserved          |

**Token counting:** Uses CLIP BPE tokenizer (exact when vocab loaded, ~93% heuristic as fallback). This is critical because Tier 1 platforms have a hard 77-token cutoff — every token matters.

**Category weights (higher = removed last):**

| Category    | Weight | Rationale                                                 |
| ----------- | ------ | --------------------------------------------------------- |
| subject     | 1.00   | NEVER trim — core identity                                |
| style       | 0.95   | Defines aesthetic                                         |
| fidelity    | 0.85   | HIGH for CLIP — "masterpiece", "best quality" are crucial |
| lighting    | 0.75   | Defines mood and atmosphere                               |
| environment | 0.70   | Scene context                                             |
| action      | 0.65   | Pose/gesture                                              |
| colour      | 0.55   | Grade/palette                                             |
| camera      | 0.50   | Can be implied                                            |
| atmosphere  | 0.45   | Mood overlay                                              |
| materials   | 0.40   | Texture                                                   |
| composition | 0.30   | Framing hints, often CLIP-invisible                       |

**Position decay (token-limit-aware):**

| Token position | Weight | Notes                            |
| -------------- | ------ | -------------------------------- |
| 0–20           | 1.0    | Full attention zone              |
| 21–50          | 0.7    | Moderate attention               |
| 51–tokenLimit  | 0.4    | Diminishing attention            |
| >tokenLimit    | 0.0    | Past limit — model ignores these |

### 3.2 Pipeline 2: Midjourney Optimizer (Tier 2)

**Platforms:** 2 — bluewillow, midjourney

**Input format:** Natural descriptive text + `--` parameter flags

**Key behaviours:**

- Splits prompt at first ` --` — everything after is sacred (--no, --ar, --v, --s, --style, --chaos, --seed)
- Creative target = total target − params length
- No Phase 1 (MJ has no 77-token hard cutoff, ~6,000 char limit)
- Very steep position decay (David Holz: "influence drops sharply after 20–40 words")

**Category weights — key difference from Tier 1:**

| Category    | Weight | Why different                                                  |
| ----------- | ------ | -------------------------------------------------------------- |
| fidelity    | 0.20   | MJ V6: "Avoid junk like award winning, photorealistic, 4k, 8k" |
| composition | 0.15   | MJ handles framing internally                                  |

**Position decay (steep):**

| Token position | Weight |
| -------------- | ------ |
| 0–10           | 1.0    |
| 11–20          | 0.6    |
| 21–40          | 0.3    |
| 41+            | 0.1    |

### 3.3 Pipeline 3: Natural Language Optimizer (Tier 3)

**Platforms:** 10 — adobe-firefly, bing, flux, google-imagen, hotpot, ideogram, openai, recraft, runway, visme

**Input format:** Grammatical sentences built from clause connectors

**Key behaviours:**

- Works on clauses, not individual tokens
- Reconstructs clause boundaries from selections + `CLAUSE_CONNECTORS` map
- Subject and action form the sentence nucleus — always protected
- Removes entire clauses to preserve grammatical structure
- Gentle position decay (T5/GPT handle long context well)

**Clause connectors (mirrors assembler exactly):**

| Category    | Prefix       | Suffix        | Example                    |
| ----------- | ------------ | ------------- | -------------------------- |
| environment | `in `        | —             | "in a skyscraper"          |
| style       | `in `        | ` style`      | "in isometric style"       |
| lighting    | `with `      | —             | "with flat lighting"       |
| atmosphere  | —            | ` atmosphere` | "experimental atmosphere"  |
| materials   | `featuring ` | —             | "featuring marble texture" |

### 3.4 Pipeline 4: Plain Language Optimizer (Tier 4)

**Platforms:** 17 — artbreeder, artistly, canva, craiyon, deepai, fotor, freepik, microsoft-designer, myedit, photoleap, picwish, picsart, pixlr, remove-bg, simplified, vistacreate, imagine-meta

**Input format:** Short comma-separated keywords (produced by `assemblePlainLanguage()`)

**Key behaviours:**

- Simplest pipeline — no CLIP token awareness, no weight syntax
- Flat position decay (position matters little for Tier 4)
- Style is NOT protected (unlike other tiers) — `protectStyle: false`
- Fidelity and composition are almost worthless (0.15, 0.10) — Tier 4 platforms ignore quality tags

---

## 4. Shared Building Blocks

### 4.1 Redundancy Pairs (Phase 0)

217 hand-curated unidirectional pairs across 11 categories + cross-category:

| Category       | Pairs   | Curated against                                                                                                |
| -------------- | ------- | -------------------------------------------------------------------------------------------------------------- |
| Lighting       | 30      | `lighting.json` (633 values)                                                                                   |
| Fidelity       | 35      | `fidelity.json` (589 values) + qualityPrefix/qualitySuffix                                                     |
| Style          | 24      | `style.json` (617 values)                                                                                      |
| Atmosphere     | 22      | `atmosphere.json` (641 values)                                                                                 |
| Camera         | 24      | `camera.json` (627 values)                                                                                     |
| Colour         | 18      | `colour.json` (617 values)                                                                                     |
| Materials      | 15      | `materials.json` (600 values)                                                                                  |
| Composition    | 18      | `composition.json` (580 values)                                                                                |
| Environment    | 12      | `environment.json` (582 values)                                                                                |
| Cross-category | 20      | Lighting×Colour, Lighting×Atmosphere, Atmosphere×Colour, Camera×Composition, Style×Fidelity, Fidelity×Fidelity |
| **Total**      | **217** |                                                                                                                |

**Format:** `[term to KEEP, term to REMOVE]` — unidirectional. When both exist in the prompt, the second is removed.

**Examples:**

- `['golden hour', 'warm lighting']` — golden hour is more specific, warm lighting is redundant
- `['masterpiece', 'best quality']` — masterpiece subsumes best quality in CLIP
- `['extreme close-up', 'macro lens']` — extreme close-up is the framing term

### 4.2 Semantic Similarity Engine (C1 — v3.0.0)

Auto-detects redundancy from pre-computed CLIP embedding pairs. Instead of relying solely on hand-curated lists:

1. Pre-computes CLIP text embeddings for all ~5,500 vocabulary terms (offline via Python)
2. Finds all pairs with cosine similarity >0.85
3. Ships result as `src/data/semantic-pairs.json` (~200KB)
4. At runtime, merges semantic + hand-curated pairs for redundancy detection

**Conflict resolution:** Hand-curated pairs always win. Semantic pairs catch the long tail that hand curation misses.

**Graceful degradation:** If `semantic-pairs.json` doesn't exist, only hand-curated pairs are used. Zero runtime errors.

**Data structure:**

```typescript
type SemanticPairTuple = readonly [string, string, number, string, string];
// [termA, termB, similarity, categoryA, categoryB]

interface SemanticPairsData {
  metadata?: { threshold?: number; totalPairs?: number };
  pairs: SemanticPairTuple[];
}
```

**Loading:** Call `loadSemanticPairs(data)` once at app startup. Check status with `isSemanticPairsLoaded()`.

### 4.3 CLIP BPE Tokenizer (C3 — v3.0.0)

Provides exact CLIP token counts for Tier 1 platforms by implementing the BPE (Byte Pair Encoding) algorithm used by OpenAI's CLIP text encoder.

**Two modes:**

| Mode               | Accuracy     | Requirement                                        |
| ------------------ | ------------ | -------------------------------------------------- |
| Real BPE           | 100% (exact) | `clip-bpe-vocab.json` loaded via `loadClipVocab()` |
| Improved heuristic | ~93%         | Automatic fallback — no setup needed               |

**Previous approach:** `~3.5 chars/token` (~85% accurate). The improved heuristic alone is a significant upgrade.

**Heuristic improvements over the old estimate:**

- Word-level analysis (not char-level averaging)
- CLIP-specific splitting patterns (prefixes: photo, hyper, ultra; suffixes: istic, ation, ment)
- Punctuation counted as individual tokens
- Weight syntax `(term:1.3)` overhead calculated precisely (+2 tokens)
- Hyphenated compounds split correctly
- Known single-token word dictionary (67 common prompt terms)

**Public API:**

```typescript
// Load real vocab for exact counts (optional)
import vocabData from '@/data/clip-bpe-vocab.json';
loadClipVocab(vocabData);

// Returns exact count if vocab loaded, improved heuristic otherwise
const tokens = clipTokenCount('masterpiece, dramatic lighting');

// Check if real vocab is loaded
const isExact = isVocabLoaded();
```

### 4.4 Prompt Compression (C2 — v3.0.0)

Phase 4 of the pipeline. Rewrites verbose phrases to shorter equivalents that preserve visual meaning. Runs AFTER Phase 3 (weakest-term removal) if the prompt is still over target.

**59 compression rules** covering composition, camera, lighting, fidelity, and common verbose structures.

**Example savings:**

| Original                                     | Replacement                | Saved |
| -------------------------------------------- | -------------------------- | ----- |
| `subject centred vertically` (27 chars)      | `centered` (8 chars)       | −19   |
| `foreground-midground-background` (31 chars) | `layered depth` (12 chars) | −19   |
| `full-body or three-quarter` (26 chars)      | `full-body` (9 chars)      | −17   |
| `subject-background separation` (29 chars)   | `figure-ground` (13 chars) | −16   |
| `shallow depth of field` (22 chars)          | `shallow DOF` (11 chars)   | −11   |
| `in the style of` (16 chars)                 | `style:` (6 chars)         | −10   |

**Application order:** Sorted by pattern length descending (longest match first) to avoid partial replacements. Matching is case-insensitive.

### 4.5 Term Parsing (B2 — v2.1.0)

`parseTerms()` builds a scored list of all terms in the prompt:

1. Walks through `selections` — each value becomes a `ScoredTerm` with category, token position, token count
2. **Injected-term discovery (B2):** Finds auto-injected quality terms (`qualityPrefix`/`qualitySuffix` from `platform-formats.json`) that exist in the prompt text but aren't in selections. Without this, "masterpiece", "best quality", "8K" etc. are invisible to redundancy detection and scoring.
3. Sorts by actual position in the prompt string
4. Computes cumulative token positions

**Protected terms:**

- `subject` — always protected (never removed)
- `style` — protected in all pipelines except Plain Language (Tier 4)

### 4.6 Surgical Term Removal

`removeTerm()` removes a single term from the prompt string with cleanup:

1. Try comma patterns: `, term,` | `, term$` | `^term, `
2. Fallback: standalone regex match
3. Cleanup pass: double commas → single, leading/trailing comma removal, double spaces, ensure space after comma

---

## 5. Platform Limits Database

`prompt-limits.json` contains per-platform optimization data for all 42 platforms.

### 5.1 Fields Per Platform

| Field                 | Type                                                                | Purpose                                           |
| --------------------- | ------------------------------------------------------------------- | ------------------------------------------------- |
| `maxChars`            | number \| null                                                      | Hard character limit (null = unlimited)           |
| `idealMin`            | number                                                              | Sweet spot lower bound                            |
| `idealMax`            | number                                                              | Sweet spot upper bound (optimization target)      |
| `idealWords`          | number                                                              | Approximate word count for sweet spot             |
| `tokenLimit`          | number \| null                                                      | CLIP token limit (77 for Tier 1, null for others) |
| `platformNote`        | string                                                              | Human-readable platform description               |
| `optimizationBenefit` | string                                                              | Why optimization helps                            |
| `qualityImpact`       | string                                                              | Estimated improvement (e.g., "15-25%")            |
| `impactCategory`      | `'high'` \| `'moderate'` \| `'low'`                                 | Optimization priority tier                        |
| `architecture`        | `'clip-based'` \| `'transformer'` \| `'proprietary'` \| `'unknown'` | Text encoder type                                 |
| `sources`             | string[]                                                            | Research sources                                  |

### 5.2 Distribution

| Architecture | Count  | Impact high | Impact moderate | Impact low |
| ------------ | ------ | ----------- | --------------- | ---------- |
| clip-based   | 13     | 13          | 0               | 0          |
| transformer  | 7      | 0           | 7               | 0          |
| proprietary  | 22     | 0           | 14              | 8          |
| **Total**    | **42** | **13**      | **21**          | **8**      |

### 5.3 Length Status

The `analyzePromptLength()` function (in `prompt-trimmer.ts`) classifies prompt length:

| Status     | Condition                         | UI colour |
| ---------- | --------------------------------- | --------- |
| `under`    | Below `idealMin`                  | Grey      |
| `optimal`  | Between `idealMin` and `idealMax` | Green     |
| `over`     | Between `idealMax` and `maxChars` | Orange    |
| `critical` | Above `maxChars`                  | Red       |

---

## 6. React Hook — `usePromptOptimization`

### 6.1 Options

```typescript
interface UsePromptOptimizationOptions {
  platformId: string; // Platform identifier
  promptText: string; // Current assembled prompt text
  selections: PromptSelections; // Current category selections
  isMidjourneyFamily?: boolean; // Uses --no syntax
  compositionMode?: 'static' | 'dynamic'; // Disabled in static mode
}
```

### 6.2 Return Value

```typescript
interface UsePromptOptimizationReturn {
  isOptimizerEnabled: boolean; // Toggle state (always starts OFF)
  setOptimizerEnabled: (b) => void; // Toggle callback
  analysis: PromptLengthAnalysis; // Real-time length data
  limits: PromptLimit; // Platform-specific limits
  getOptimizedPrompt: () => OptimizedPrompt; // Run optimizer
  isToggleDisabled: boolean; // true in static mode
  indicatorText: string; // "285/350 ✓"
  indicatorColorClass: string; // CSS class
  statusIcon: string; // ✓ / ⚠ / ✕
  tooltipContent: TooltipContent; // Platform-specific tooltip
}
```

### 6.3 Behaviour

- **Always starts OFF.** No persistence between sessions. No localStorage.
- **Real-time analysis** runs on every `promptText` change (memoized).
- **Optimization only runs** when `getOptimizedPrompt()` is called (on copy).
- **Toggle disabled** in Static composition mode.
- **38 platform display names** mapped in `formatPlatformName()`.

---

## 7. UI Components

### 7.1 Text Length Optimizer Toggle (v1.1.0)

`text-length-optimizer.tsx` — 347 lines

**Visual states:**

- **OFF:** Core Colours gradient outline (sky, emerald, indigo), muted text
- **ON:** Purple gradient fill (brand), white text
- **DISABLED:** Core Colours at FULL opacity (not grey, not dimmed)

**Placement:** Right of Static/Dynamic toggle, separated by subtle divider.

### 7.2 Optimization Transparency Panel (v1.0.0)

`optimization-transparency-panel.tsx` — 419 lines

**Pro-only.** Collapsible panel showing exactly why the optimizer made each decision. Grouped by phase:

| Phase group | Label                               | Colour |
| ----------- | ----------------------------------- | ------ |
| Phase 0     | "Redundancy — Free Quality"         | Green  |
| Phase 1     | "CLIP Overflow — Invisible Terms"   | Blue   |
| Phase 2/3   | "Priority Trim — Scored Removal"    | Orange |
| Phase 4     | "Compression — Shorter Equivalents" | Purple |

**Props:**

```typescript
interface OptimizationTransparencyPanelProps {
  removedTerms: ReadonlyArray<RemovedTermData>;
  achievedAtPhase: number; // 0-4, or -1 if already within
  originalLength: number;
  optimizedLength: number;
  targetLength: number;
  platformName: string;
  isPro: boolean; // Only renders if true
}
```

**Competitive differentiator:** No other AI image generator shows optimization reasoning. This builds trust, teaches prompt engineering, and justifies the Pro tier.

---

## 8. Platform Optimization Engine

`platform-optimization.ts` — 589 lines (separate from the prompt optimizer)

This engine handles prompt **formatting** for platform-specific syntax and preferences. It is a companion to the optimizer but serves a different purpose: the optimizer trims length, the platform engine formats structure.

**Key exports:**

| Function                                   | Purpose                                                 |
| ------------------------------------------ | ------------------------------------------------------- |
| `formatPromptForPlatform(input)`           | Formats selections into platform-specific prompt string |
| `smartTrimPrompt(prompt, platformId)`      | Trim prompt to platform limits                          |
| `getCategoryOrder(platformId)`             | Platform-specific category ordering                     |
| `getTrimPriority(platformId)`              | Category trim priority for the platform                 |
| `getPlatformCharLimit(platformId)`         | Character limit lookup                                  |
| `platformSupportsWeights(platformId)`      | Whether `(term:1.3)` syntax works                       |
| `platformUsesSeparateNegative(platformId)` | Whether platform has separate negative field            |
| `formatWithWeight(term, weight)`           | Apply CLIP weight syntax                                |
| `getPlatformRecommendations(platformId)`   | Platform-specific tips                                  |
| `estimateTokenCount(text)`                 | Token estimation                                        |
| `formatCompletePrompt(input)`              | Full prompt with negatives                              |

**Test coverage:** 420-line Jest test file covering all exports.

---

## 9. Version History

### v3.0.0 — Phase C: Next-Level Features

| ID  | Feature                      | What it does                                                                                                                                                 |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C1  | Semantic similarity engine   | Auto-detects redundancy from pre-computed CLIP embedding pairs. Merges with hand-curated pairs. Falls back gracefully if JSON not generated.                 |
| C2  | Prompt compression/rewriting | New Phase 4 with 59 compression rules. Rewrites verbose phrases to shorter equivalents. Saves 10–19 chars per rule.                                          |
| C3  | Real CLIP BPE tokenization   | Exact token counts for Tier 1 platforms. Replaces ~3.5 chars/token heuristic with actual CLIP BPE algorithm. Improved heuristic fallback (~93% vs old ~85%). |

### v2.1.0 — Phase B: Upgrade Quality

| ID  | Feature                   | What it does                                                                                  |
| --- | ------------------------- | --------------------------------------------------------------------------------------------- |
| B1  | Expanded redundancy pairs | From 29 → 217 pairs across all 11 categories + 25 cross-category pairs                        |
| B2  | Injected-term discovery   | qualityPrefix/qualitySuffix terms (masterpiece, 8K, etc.) now visible to redundancy + scoring |
| B3  | Per-strategy weights      | Completed in Phase A                                                                          |

### v2.0.0 — Phase A: Tier-Aware Routing

| ID  | Feature                         | What it does                                                                              |
| --- | ------------------------------- | ----------------------------------------------------------------------------------------- |
| A1  | Tier-aware routing              | Mirrors assembleTierAware() — detects platform's tier and prompt style                    |
| A2  | 4 optimizer pipelines           | Keywords, Midjourney, Natural Language, Plain Language                                    |
| A3  | Per-strategy weights            | Category importance tuned per pipeline (e.g., MJ fidelity = 0.20 vs CLIP fidelity = 0.85) |
| A4  | Per-strategy decay              | Position decay curves tuned to model attention patterns                                   |
| A5  | Midjourney `--` protection      | Splits creative text from parameters, optimises only creative portion                     |
| A6  | Natural language clause surgery | Removes whole clauses to preserve grammar                                                 |

### v1.0.0 — Original

Single-pipeline optimizer with basic redundancy detection (29 pairs) and character-based trimming.

---

## 10. Key Algorithms

### 10.1 Scoring Formula

```
score = category_weight × position_weight × 100
```

- Protected terms get score `10000` (effectively untouchable)
- Lowest-scored terms are removed first
- After each removal, positions are recomputed (`recomputeTokenPositions`)

### 10.2 Redundancy Detection

```typescript
function findRedundantTerms(termTexts: string[]): Map<string, string> {
  // 1. Check hand-curated REDUNDANCY_PAIRS (authoritative)
  // 2. Check semanticPairs (auto-generated, catches long tail)
  // 3. Hand-curated wins on conflicts
  // Returns: Map<term-to-remove → term-that-keeps-it>
}
```

**Normalisation:** Strips CLIP weight syntax `(flat lighting:1.1)` → `flat lighting` before matching. Case-insensitive.

### 10.3 Midjourney Parameter Protection

```typescript
const paramSplitIndex = promptText.indexOf(' --');
let creativeText = promptText.slice(0, paramSplitIndex);
let paramsSuffix = promptText.slice(paramSplitIndex);
// Optimise only creativeText, then rejoin: optimised + paramsSuffix
```

### 10.4 Natural Language Clause Reconstruction

The optimizer reconstructs clause boundaries by replaying the assembler's connector logic:

```typescript
// environment: "in " + value                → "in a skyscraper"
// style:       "in " + value + " style"     → "in isometric style"
// lighting:    "with " + value              → "with flat lighting"
// atmosphere:  value + " atmosphere"        → "experimental atmosphere"
```

Fallback: if the reconstructed clause doesn't match the prompt string exactly, individual values are matched instead.

---

## 11. Security & Safety

- **No localStorage** — optimizer state always resets between sessions
- **All processing client-side** — no external API calls
- **Type-safe throughout** — strict TypeScript with `readonly` arrays
- **No mutation** — `REDUNDANCY_PAIRS`, `COMPRESSION_RULES`, and `STRATEGY_WEIGHTS` are `const`
- **JSON schema validation** — `prompt-limits.json` validated against `prompt-limits.schema.json` at build time
- **Graceful degradation** — missing semantic-pairs.json or clip-bpe-vocab.json causes zero errors

---

## 12. Integration Points

### 12.1 Consumed by Optimizer

| Dependency              | Import                | Purpose                                       |
| ----------------------- | --------------------- | --------------------------------------------- |
| `prompt-trimmer.ts`     | `getPromptLimit()`    | Look up platform character/token limits       |
| `platform-tiers.ts`     | `getPlatformTierId()` | Determine tier for routing                    |
| `prompt-builder.ts`     | `getPlatformFormat()` | Get promptStyle + qualityPrefix/qualitySuffix |
| `clip-bpe-tokenizer.ts` | `clipTokenCount()`    | Exact/heuristic CLIP token counts             |

### 12.2 Consumers of Optimizer

| Consumer                              | Import                         | Purpose                                 |
| ------------------------------------- | ------------------------------ | --------------------------------------- |
| `use-prompt-optimization.ts`          | `optimizePromptGoldStandard()` | React hook wraps the engine             |
| `optimization-transparency-panel.tsx` | Types from optimizer           | Displays removedTerms by phase          |
| Prompt builder page                   | Via hook                       | Copy-to-clipboard triggers optimization |

### 12.3 Data Dependencies

```
prompt-limits.json ──────→ prompt-trimmer.ts ──────→ prompt-optimizer.ts
platform-formats.json ──→ prompt-builder.ts ──────→ prompt-optimizer.ts
platform-tiers.ts ────────────────────────────────→ prompt-optimizer.ts
semantic-pairs.json (optional) ───────────────────→ prompt-optimizer.ts
clip-bpe-vocab.json (optional) ──────────────────→ clip-bpe-tokenizer.ts
```

---

## 13. Open Items

| #   | Item                                                                                          | Status                                                              |
| --- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | Python tools (`generate-semantic-pairs.py`, `generate-clip-vocab.py`) not yet present in repo | Planned — system degrades gracefully without them                   |
| 2   | `semantic-pairs.json` not yet generated                                                       | Planned — only hand-curated pairs used until then                   |
| 3   | `clip-bpe-vocab.json` not yet generated                                                       | Planned — improved heuristic (~93%) used as fallback                |
| 4   | Pro/tier wiring for Transparency Panel                                                        | `isPro` and `tier` props not yet passed through from page component |
