# Prompt Optimizer — Authority Documentation

**Version:** 6.0.0
**Authority:** This is the single source of truth for the prompt optimizer subsystem.
**Last updated:** 29 March 2026

---

## 1. Purpose

The Prompt Optimizer is a self-contained subsystem that intelligently shortens assembled prompts to fit within each AI platform's character and token limits — without destroying the visual meaning of the prompt.

It sits between the prompt assembler (which builds the prompt from user selections) and the copy-to-clipboard action. When enabled, it optimises the assembled prompt using a multi-phase pipeline tuned to the specific platform's text encoder architecture.

No competitor provides this. Most generators either hard-truncate or silently drop tokens. Promagen's optimizer understands **why** each term matters and removes the least impactful ones first.

**Cross-references:**

- Prompt builder page architecture → `prompt-builder-page.md`
- Pro tier gating for Transparency Panel → `paid_tier.md` §5.14 (colour-coded anatomy), §5.13 (Prompt Lab parity)
- Intelligence/scoring/semantic tags → `prompt-intelligence.md`
- Prompt Lab optimizer behaviour → `prompt-lab.md` (neutral mode, dynamic label, "Within optimal range")
- AI Disguise system (Call 3 AI optimisation) → `ai-disguise.md` §6
- Colour-coded prompt text in optimizer output → `code-standard.md` § 6.14 (SSOT colours)
- Call 3 independent builder architecture → `harmonizing-claude-openai.md`
- Platform SSOT → `platform-config.json` + `platform-config.ts`
- Harmony pass anti-regression → `harmony-anti-regression.md`

---

## 2. System Overview

### 2.1 File Map

#### Client-Side Optimizer (original subsystem)

| File                                    | Path                                         | Lines | Purpose                                                                                                                                    |
| --------------------------------------- | -------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **prompt-optimizer.ts**                 | `src/lib/`                                   | 1,604 | Core engine: 4 pipelines, 5-phase optimization, 217 redundancy pairs, 59 compression rules, semantic similarity                            |
| **clip-bpe-tokenizer.ts**               | `src/lib/`                                   | 367   | CLIP BPE tokenization: exact token counts when vocab loaded, improved heuristic (~93%) as fallback                                         |
| **use-prompt-optimization.ts**          | `src/hooks/`                                 | 360   | React hook: manages toggle state, real-time length analysis, platform-specific tooltips                                                    |
| **prompt-limits.ts**                    | `src/types/`                                 | 310   | TypeScript types: PromptLimit, LengthStatus, ImpactCategory, ModelArchitecture                                                             |
| **platform-config.json**                | `src/data/providers/`                        | ~80KB | **SSOT** for all 40 platforms: limits, tiers, negativeSupport, idealMin/Max, architecture. Replaced `prompt-limits.json` (deleted 26 Mar). |
| **platform-config.ts**                  | `src/data/providers/`                        | 225   | TypeScript adapter for platform-config.json — typed accessors for all platform fields                                                      |
| **optimization-transparency-panel.tsx** | `src/components/providers/`                  | 610   | Pro-only UI panel showing optimization reasoning grouped by phase                                                                          |
| **text-length-optimizer.tsx**           | `src/components/providers/`                  | 392   | Toggle component: OFF=Core Colours gradient outline, ON=purple gradient fill                                                               |
| **platform-optimization.ts**            | `src/lib/prompt-intelligence/engines/`       | 589   | Platform formatting engine: prompt assembly, smart trim, category ordering                                                                 |
| **platform-optimization.test.ts**       | `src/lib/prompt-intelligence/engines/tests/` | 420   | Jest tests for platform formatting                                                                                                         |

**Client-side total:** 10 files, ~5,247 lines

#### Call 3 Server-Side Optimizer (AI Disguise — added v5.0.0)

| File                                | Path                           | Lines  | Purpose                                                                                                                    |
| ----------------------------------- | ------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------- |
| **route.ts**                        | `src/app/api/optimise-prompt/` | 406    | Call 3 API route: receives assembled prompt + provider context, calls GPT-5.4-mini, returns optimised prompt with metadata |
| **use-ai-optimisation.ts**          | `src/hooks/`                   | 337    | React hook: manages Call 3 lifecycle, algorithm cycling animation, result state, clear cascade                             |
| **platform-groups.ts**              | `src/lib/optimise-prompts/`    | 181    | Maps each provider ID to its builder group                                                                                 |
| **resolve-group-prompt.ts**         | `src/lib/optimise-prompts/`    | 205    | Resolves the system prompt for a given provider — returns group-specific or generic fallback                               |
| **harmony-post-processing.ts**      | `src/lib/optimise-prompts/`    | 439    | Post-processing functions P1–P12 that run on all Call 3 responses before returning to client                               |
| **harmony-compliance.ts**           | `src/lib/`                     | 833    | Compliance gates: `enforceT1Syntax`, `enforceNegativeContradiction` — deterministic fixes applied after GPT                |
| **generic-fallback.ts**             | `src/lib/optimise-prompts/`    | 78     | Fallback system prompt for any platform without a dedicated builder                                                        |
| **types.ts**                        | `src/lib/optimise-prompts/`    | 57     | Shared TypeScript types for the builder system                                                                             |
| **index.ts**                        | `src/lib/optimise-prompts/`    | —      | Barrel exports                                                                                                             |
| **43 builder files** (`group-*.ts`) | `src/lib/optimise-prompts/`    | varies | Independent per-platform/per-group system prompts — no shared imports between builders                                     |
| **compression-utils.ts**            | `src/data/providers/`          | —      | Compression utilities (migrated from deleted `compression/` folder)                                                        |

**Call 3 total:** 49 files in `src/lib/optimise-prompts/` + route + hook + harmony-compliance

#### Deleted Files (v6.0.0)

| File                        | Reason                                                                    |
| --------------------------- | ------------------------------------------------------------------------- |
| `prompt-limits.json`        | Replaced by `platform-config.json` SSOT (26 Mar 2026)                     |
| `prompt-limits.schema.json` | Replaced by `platform-config.ts` typed adapter                            |
| `compression/` folder       | Consolidated to `compression-utils.ts` in `src/data/providers/`           |
| `group-multi-engine.ts`     | 5 aggregator groups removed — all platforms now have independent builders |

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
│  3 sub-assemblers:        │  from user selections + weightOverrides
│    assembleKeywords()     │  Injects qualityPrefix/qualitySuffix
│    assembleNaturalSent()  │  from platform-formats.json
│    assemblePlainLang()    │
│                           │  Weather weight overrides merge here:
│                           │  weather base → platform wins on conflicts
└──────────┬───────────────┘
           │  assembled prompt text
           ▼
┌──────────────────────────┐
│  Prompt Optimizer         │  prompt-optimizer.ts
│  optimizePromptGold()     │  ← CLIENT-SIDE SUBSYSTEM
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

**In the Prompt Lab**, the client-side optimizer is overlaid by Call 3 (AI Disguise). See §14.7 for the parallel architecture.

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
import vocabData from "@/data/clip-bpe-vocab.json";
loadClipVocab(vocabData);

// Returns exact count if vocab loaded, improved heuristic otherwise
const tokens = clipTokenCount("masterpiece, dramatic lighting");

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

**SSOT: `platform-config.json`** — single source of truth for all 40 platforms. Replaced the former `prompt-limits.json` (deleted 26 Mar 2026) and consolidated limits, tier assignments, negative support, and ideal ranges into one file. The TypeScript adapter `platform-config.ts` (225 lines) provides typed accessors.

### 5.1 Fields Per Platform (relevant to optimizer)

| Field             | Type                                                                | Purpose                                           |
| ----------------- | ------------------------------------------------------------------- | ------------------------------------------------- |
| `maxChars`        | number \| null                                                      | Hard character limit (null = unlimited)           |
| `idealMin`        | number                                                              | Sweet spot lower bound                            |
| `idealMax`        | number                                                              | Sweet spot upper bound (optimization target)      |
| `tokenLimit`      | number \| null                                                      | CLIP token limit (77 for Tier 1, null for others) |
| `negativeSupport` | `'inline'` \| `'separate'` \| `'none'`                              | How the platform handles negative prompts         |
| `tier`            | `1` \| `2` \| `3` \| `4`                                            | Platform tier assignment                          |
| `architecture`    | `'clip-based'` \| `'transformer'` \| `'proprietary'` \| `'unknown'` | Text encoder type                                 |

**Note:** `platform-formats.json` still exists and holds `_assemblyDefaults` (quality prefix/suffix, category ordering). Deferred merge into `platform-config.json` once SSOT is confirmed stable.

### 5.2 Distribution

| Architecture | Count  | Impact high | Impact moderate | Impact low |
| ------------ | ------ | ----------- | --------------- | ---------- |
| clip-based   | 13     | 13          | 0               | 0          |
| transformer  | 7      | 0           | 7               | 0          |
| proprietary  | 20     | 0           | 14              | 6          |
| **Total**    | **40** | **13**      | **21**          | **6**      |

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
  compositionMode?: "static" | "dynamic"; // Disabled in static mode
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

`text-length-optimizer.tsx` — 392 lines

**Visual states:**

- **OFF:** Core Colours gradient outline (sky, emerald, indigo), muted text
- **ON:** Purple gradient fill (brand), white text
- **DISABLED:** Core Colours at FULL opacity (not grey, not dimmed)

**Placement:** Right of Static/Dynamic toggle, separated by subtle divider.

### 7.2 Optimization Transparency Panel (v1.0.0)

`optimization-transparency-panel.tsx` — 610 lines

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
const paramSplitIndex = promptText.indexOf(" --");
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
- **Client-side processing** — the 4-phase pipeline runs entirely client-side with no external API calls
- **Server-side AI processing** — Call 3 runs server-side via `/api/optimise-prompt` (GPT-5.4-mini). No API keys or model names are exposed to the client. All AI calls are presented to users as "algorithms" (AI Disguise principle).
- **Type-safe throughout** — strict TypeScript with `readonly` arrays
- **No mutation** — `REDUNDANCY_PAIRS`, `COMPRESSION_RULES`, and `STRATEGY_WEIGHTS` are `const`
- **SSOT validation** — `platform-config.json` is the single source of truth for all platform limits. The TypeScript adapter `platform-config.ts` provides type-safe access.
- **Graceful degradation** — missing semantic-pairs.json or clip-bpe-vocab.json causes zero errors
- **Compliance gates** — `harmony-compliance.ts` (833 lines) enforces deterministic fixes (T1 syntax, negative contradiction) after GPT returns its response. These are code-level guarantees, not prompt rules.

---

## 12. Integration Points

### 12.1 Consumed by Optimizer

| Dependency              | Import                | Purpose                                                                                                                                                                                                                                          |
| ----------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `prompt-trimmer.ts`     | `getPromptLimit()`    | Look up platform character/token limits                                                                                                                                                                                                          |
| `platform-tiers.ts`     | `getPlatformTierId()` | Determine tier for routing                                                                                                                                                                                                                       |
| `prompt-builder.ts`     | `getPlatformFormat()` | Get promptStyle + qualityPrefix/qualitySuffix. Note: `weightedCategories` may include weather-derived overrides merged upstream by `assembleTierAware()` (weather base layer, platform wins on conflicts). Optimizer receives the merged output. |
| `clip-bpe-tokenizer.ts` | `clipTokenCount()`    | Exact/heuristic CLIP token counts                                                                                                                                                                                                                |

### 12.2 Consumers of Optimizer

| Consumer                                 | Import                                            | Purpose                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `use-prompt-optimization.ts`             | `optimizePromptGoldStandard()`                    | React hook wraps the engine                                                                                                                                                                                                                                                                                                                                                                              |
| `optimization-transparency-panel.tsx`    | Types from optimizer                              | Displays removedTerms by phase (Pro only)                                                                                                                                                                                                                                                                                                                                                                |
| `prompt-builder.tsx` (standard)          | Via hook                                          | Copy-to-clipboard triggers optimization; separate optimized prompt box when `wasOptimized`                                                                                                                                                                                                                                                                                                               |
| `enhanced-educational-preview.tsx` (Lab) | Via hook (client-side) + `useAiOptimisation` (AI) | Dynamic label switching; neutral mode; "Within optimal range" feedback; colour-coded optimized text. **v5.0.0:** AI result (`effectiveOptimisedText`) overrides client-side in display. Client-side still feeds LengthIndicator. Transparency Panel hidden when AI result available. **v6.0.0:** Negative prompt window added. Race condition fix — Call 3 clears stale when Call 2 returns new content. |

### 12.3 Data Dependencies

```
platform-config.json ────→ platform-config.ts ──→ prompt-trimmer.ts ──→ prompt-optimizer.ts
platform-formats.json ──→ prompt-builder.ts ─────────────────────────→ prompt-optimizer.ts
platform-tiers.ts ───────────────────────────────────────────────────→ prompt-optimizer.ts
semantic-pairs.json (optional) ──────────────────────────────────────→ prompt-optimizer.ts
clip-bpe-vocab.json (optional) ─────────────────────────────────────→ clip-bpe-tokenizer.ts
```

**Deleted dependency:** `prompt-limits.json` → removed 26 Mar 2026. All platform limits now flow through `platform-config.json` → `platform-config.ts`.

---

## 13. Open Items

| #   | Item                                                                                          | Status                                                                                                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Python tools (`generate-semantic-pairs.py`, `generate-clip-vocab.py`) not yet present in repo | Planned — system degrades gracefully without them                                                                                                                                                            |
| 2   | `semantic-pairs.json` not yet generated                                                       | Planned — only hand-curated pairs used until then                                                                                                                                                            |
| 3   | `clip-bpe-vocab.json` not yet generated                                                       | Planned — improved heuristic (~93%) used as fallback                                                                                                                                                         |
| 4   | ~~Pro/tier wiring for Transparency Panel~~                                                    | **RESOLVED (v4.0.0)** — `isPro` now correctly passed in both standard builder and Prompt Lab                                                                                                                 |
| 5   | ~~`aiOptimiseResult.negative` never rendered in Prompt Lab UI~~                               | **RESOLVED (v6.0.0)** — Negative prompt window now rendered for `negativeSupport: 'separate'` platforms. Call 3 negative takes priority, Call 2 tier negative as fallback. Amber styling. See §14.8.         |
| 6   | ~~proseGroups bug — 28/40 platforms receiving wrong input framing and wrong temperature~~     | **RESOLVED (v6.0.0)** — `proseGroups` in route.ts now includes legacy group names + all `nl-*` dedicated builders + `*-dedicated` video builders. SD CLIP dedicated builders explicitly excluded. See §14.9. |
| 7   | ~~charCount bug — GPT self-reported counts were unreliable~~                                  | **RESOLVED (v6.0.0)** — `result.charCount = result.optimised.length` measured server-side after all compliance gates.                                                                                        |
| 8   | ~~Race condition — stale Call 3 persisted when Call 2 returned new content~~                  | **RESOLVED (v6.0.0)** — EEP now calls `clearAiOptimise()` when `aiTierPrompts` changes.                                                                                                                      |
| 9   | ~~Display bug — enriched prompts hidden when `effectiveOptimisedLength < originalLength`~~    | **RESOLVED (v6.0.0)** — `effectiveWasOptimized` now compares text content (`aiOptimiseResult.optimised !== activeTierPromptText`) not length.                                                                |
| 10  | Google Imagen Call 3 actively degrades output (assembled T3 scores 94, optimised scores 90)   | **HIGH PRIORITY** — open. Needs decision: bypass Call 3 for this platform or fix builder.                                                                                                                    |
| 11  | Harmony pass incomplete — Artbreeder was in progress when session ended                       | **Medium** — Adobe Firefly (93/100) and 123RF (91/100) complete. Remaining platforms need ChatGPT-verified system prompts.                                                                                   |
| 12  | CLIP platforms — Call 3 averages only ~2pt gain (85→87) vs NL ~6-8pt gain (88→94)             | **Pending decision** — test each CLIP platform individually, retain Call 3 where it adds value, bypass where it doesn't.                                                                                     |
| 13  | `platform-formats.json` still holds `_assemblyDefaults`                                       | **Deferred** — fold into `platform-config.json` once SSOT is confirmed stable, then delete `platform-formats.json` entirely.                                                                                 |

---

## 14. Optimizer in the Prompt Lab (v4.0.0 — 18 March 2026)

The Prompt Lab (`/studio/playground`) uses the same optimizer engine but with different UI behaviour than the standard builder. These differences are documented here as optimizer-specific concerns.

### 14.1 Neutral Mode (Optimizer Disabled Until Provider Selected)

When no provider is selected in the Prompt Lab, the optimizer toggle is force-disabled:

```typescript
const finalOptimizerDisabled = isOptimizerDisabled || !selectedProviderId;
```

**Tooltip in neutral mode:** "Select an AI provider above to enable optimisation."
**Tooltip when provider selected:** Real platform-specific tooltip (same as standard builder).

**Rationale:** Without a platform, there's no `promptLimit` to optimise against. The standard builder never hits this state because the provider is always pre-selected from the URL.

### 14.2 Dynamic Label Switching (Assembled → Optimized)

In the Prompt Lab, the assembled prompt box **changes identity** when the optimizer is enabled:

| Condition                                      | Label                                   | Border                                    | Text colour        | Copy tooltip            |
| ---------------------------------------------- | --------------------------------------- | ----------------------------------------- | ------------------ | ----------------------- |
| `!isOptimizerEnabled \|\| !selectedProviderId` | "Assembled prompt"                      | `border-slate-600 bg-slate-950/80`        | `text-slate-100`   | "Copy assembled prompt" |
| `isOptimizerEnabled && selectedProviderId`     | "Optimized prompt in [Provider] [icon]" | `border-emerald-600/50 bg-emerald-950/20` | `text-emerald-100` | "Copy optimized prompt" |

**Critical design decision:** The condition is `isOptimizerEnabled && selectedProviderId` — it does **NOT** include `wasOptimized`. The label switches the moment the optimizer is enabled with a provider, regardless of whether trimming occurred. This was a deliberate correction (18 March 2026) after an incorrect implementation that only switched when `wasOptimized` was true.

**Why no `wasOptimized` check:** The prompt has gone through the optimization pipeline either way. The `StageBadge` already shows "✓ Optimal" when no trimming was needed — having the label say "Assembled prompt" while the badge says "Optimal" is contradictory.

**Provider icon:** 20×20px icon from `selectedProvider.localIcon || /icons/providers/${selectedProvider.id}.png`. `onError` hides the icon.

### 14.3 "Within Optimal Range" Feedback

When the optimizer is ON, a provider is selected, and the prompt didn't need trimming:

```
✓ Within optimal range — 342 chars / No trimming needed
```

Rendered as an emerald bar below the optimized prompt box. This replaces the empty space that would otherwise appear when the `OptimizationTransparencyPanel` has nothing to show (no removed terms).

### 14.4 Colour-Coded Optimized Text (Pro Only)

Both the assembled and optimized prompt preview boxes render **colour-coded text** for Pro users via `parsePromptIntoSegments()` from `src/lib/prompt-colours.ts`. Each term is coloured according to its source category (Subject = gold, Style = purple, etc.). Free users see plain monochrome text.

This applies to the optimizer's output text as well — when the optimizer removes or compresses terms, the remaining terms retain their colour coding. The colour is determined by the term index built from user selections, not from the optimizer output.

### 14.5 `isPro` Wiring Fix

The `OptimizationTransparencyPanel` in the Prompt Lab was previously hardcoded to `isPro={false}`, meaning Pro users never saw the transparency panel in the Lab. This was fixed (18 March 2026) to correctly pass `isPro={isPro}` from the `usePromagenAuth` hook.

### 14.6 Standard Builder vs Lab Optimizer Behaviour

| Aspect                     | Standard Builder (`prompt-builder.tsx`)                    | Prompt Lab (`enhanced-educational-preview.tsx`)                                                                       |
| -------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Optimizer always available | Yes (provider always known from URL)                       | No — disabled until provider selected (neutral mode)                                                                  |
| Optimized prompt display   | Separate box below assembled (visible when `wasOptimized`) | Same box — label dynamically switches (uses `effectiveWasOptimized`)                                                  |
| Label switch condition     | N/A (separate boxes)                                       | `isOptimizerEnabled && selectedProviderId` (uses `effectiveWasOptimized` from AI result priority)                     |
| Primary optimizer          | Client-side 4-phase pipeline only                          | **AI (Call 3)** with client-side as fallback                                                                          |
| "Within optimal range"     | Not shown                                                  | Emerald bar when no trimming needed + not actively AI optimising                                                      |
| Transparency Panel         | `isPro` from hook                                          | `isPro` from hook. **Hidden when AI result available** (AI changes shown as emerald chips instead)                    |
| Colour-coded output        | Pro only                                                   | Pro only                                                                                                              |
| Copy handler               | `handleCopyOptimized` (separate button)                    | Same button — copies `effectiveOptimisedText` (AI result priority)                                                    |
| Re-fire behaviour          | N/A (manual only)                                          | Debounced 800ms re-fire when `activeTierPromptText` changes while ON                                                  |
| Visual during processing   | None                                                       | Algorithm cycling animation (101 names, amber→emerald, 1.8s min)                                                      |
| Negative prompt window     | N/A                                                        | Amber window for `negativeSupport: 'separate'` platforms — Call 3 negative priority, Call 2 fallback (v6.0.0)         |
| "Optimised but unchanged"  | N/A                                                        | `isOptimisedButUnchanged` — assembled box relabels to emerald "Optimised prompt" even when text is identical (v6.0.0) |

### 14.7 AI Disguise Overlay (v5.0.0 — 23 March 2026, updated v6.0.0)

The Prompt Lab now uses a dedicated AI-powered optimisation path (Call 3) that overlays the client-side optimizer. The client-side 4-phase pipeline continues to run independently — it feeds the length indicator bar and provides the fallback if the AI call fails or times out.

**Architecture:**

```
User toggles "Optimise" ON (with provider selected)
    │
    ├─ Client-side optimizer runs instantly → feeds LengthIndicator bar
    │
    └─ Call 3 fires → /api/optimise-prompt (GPT-5.4-mini)
       │
       ├─ Algorithm cycling animation plays during API call (1.8s min)
       │
       └─ AI response arrives → effective values override client-side:
          effectiveOptimisedText = aiOptimiseResult?.optimised ?? ''
          effectiveOptimisedLength = aiOptimiseResult?.charCount ?? 0
          effectiveWasOptimized = aiOptimiseResult
            ? aiOptimiseResult.optimised !== activeTierPromptText
            : false
```

**v6.0.0 change:** `effectiveWasOptimized` now compares **text content** (`optimised !== activeTierPromptText`), not length. This fixes a display bug where enriched prompts (longer than the original) were hidden because the old length comparison returned false.

**Key implementation details:**

1. **Separate hook:** `useAiOptimisation` (337 lines, `src/hooks/use-ai-optimisation.ts`) — NOT a modification of `use-prompt-optimization.ts`. Clean separation — no modal `isLabMode` logic.

2. **Effective values override:** Three computed values in `enhanced-educational-preview.tsx` replace direct use of `optimizedResult.*` throughout the component:
   - `effectiveOptimisedText` — AI result takes priority
   - `effectiveOptimisedLength` — AI char count takes priority
   - `effectiveWasOptimized` — AI text comparison takes priority

3. **Transparency Panel conditional:** When `aiOptimiseResult` is available, the `OptimizationTransparencyPanel` (showing client-side phase/removal data) is hidden. Instead, emerald "✓ change description" chips from `aiOptimiseResult.changes` are shown.

4. **Debounced re-fire:** When optimizer is already ON and `activeTierPromptText` changes (aspect ratio change, dropdown selection change, AI tiers arrive from Call 2), Call 3 re-fires after 800ms debounce via `reFireTimerRef`. This keeps the AI-optimised prompt in sync with the assembled prompt.

5. **Clear cascade:** When the user clicks Clear, `clearAiOptimise()` is called alongside `setOptimizerEnabled(false)`. This prevents stale AI results persisting into the next generation cycle.

6. **Race condition fix (v6.0.0):** When Call 2 returns fresh tiers, `clearAiOptimise()` is called to discard the previous Call 3 result. Additionally, provider changes and the Clear button both trigger `clearAiOptimise()`. Three separate useEffect hooks guard against stale results.

7. **Provider-specific syntax:** Call 3 system prompt enforces the exact provider weight syntax (Leonardo `::`, SD `()`, etc.) with MANDATORY/CRITICAL instructions. Also enforces the 4-word weight wrapping rule and quality suffix for Tier 1. See `ai-disguise.md` §6 for full system prompt.

**What the client-side optimizer still does in the Lab:**

- Feeds the `LengthIndicator` bar (always runs regardless of AI)
- Provides instant feedback on prompt length before AI responds
- Acts as complete fallback if Call 3 fails, times out (12s), or returns invalid data

### 14.8 Negative Prompt Window (v6.0.0 — 29 March 2026)

The Prompt Lab now renders a dedicated negative prompt window for platforms with `negativeSupport: 'separate'`. This resolves the high-priority open issue where `aiOptimiseResult.negative` (Dynamic Negative Intelligence) was returned by the API and stored in the hook but never displayed to the user.

**Implementation:**

```typescript
const hasSeparateNegative = aiOptimiseContext?.negativeSupport === "separate";
const effectiveNegativeText = useMemo(() => {
  if (!hasSeparateNegative) return "";
  // Call 3 negative takes priority (platform-specific, optimised)
  if (aiOptimiseResult?.negative) return aiOptimiseResult.negative;
  // Fallback: Call 2 negative for the active tier
  if (generatedPrompts) {
    const tierKey = `tier${activeTier}` as keyof GeneratedPrompts["negative"];
    return generatedPrompts.negative[tierKey] || "";
  }
  return "";
}, [hasSeparateNegative, aiOptimiseResult, generatedPrompts, activeTier]);
```

**UI details:**

- Gated on `hasSeparateNegative && effectiveNegativeText` — only renders when there's content for a platform that supports separate negatives
- Amber styling: `border-amber-600/50 bg-amber-950/20`, `text-amber-300` label
- Shows provider name and icon in header
- Character count displayed (`effectiveNegativeText.length` chars)
- Inline copy button for the negative prompt
- Included in the save handler alongside the positive prompt

### 14.9 Call 3 Independent Builder Architecture (v6.0.0)

Call 3 routes each platform to an independent builder file containing the full GPT system prompt. No builder imports from another builder — complete isolation prevents cross-platform regressions.

**Builder inventory: 43 files** in `src/lib/optimise-prompts/`:

- 5 SD CLIP builders: `group-stability.ts`, `group-dreamlike.ts`, `group-dreamstudio.ts`, `group-fotor.ts`, `group-lexica.ts`
- 1 Midjourney builder: `group-midjourney.ts`
- 25 NL builders (14 T3, 11 T4): `group-nl-*.ts` (e.g., `group-nl-adobe-firefly.ts`, `group-nl-google-imagen.ts`)
- 6 legacy group builders: `group-clean-natural-language.ts`, `group-dalle-api.ts`, `group-flux-architecture.ts`, `group-sd-clip-parenthetical.ts`, `group-sd-clip-double-colon.ts`, `group-video-cinematic.ts`
- 3 dedicated builders: `group-recraft.ts`, `group-ideogram.ts`, `group-novelai.ts`
- 3 video builders: `group-kling.ts`, `group-luma-ai.ts`, `group-runway.ts`

**Routing:** `platform-groups.ts` (181 lines) maps each provider ID to a group. `resolve-group-prompt.ts` (205 lines) resolves the system prompt from the matching builder, falling back to `generic-fallback.ts` (78 lines) if no dedicated builder exists.

**Post-processing:** `harmony-post-processing.ts` (439 lines) runs mandatory P1–P12 functions on every Call 3 response. Compliance gates in `harmony-compliance.ts` (833 lines) enforce deterministic syntax rules (`enforceT1Syntax`, `enforceNegativeContradiction`) that cannot be reliably handled by prompt instructions alone.

**Server-side charCount:** GPT self-reported character counts were found to be unreliable. Route.ts now measures `result.charCount = result.optimised.length` after all compliance gates have run. This is the authoritative count returned to the client.

**proseGroups detection (v6.0.0 fix):** Route.ts determines whether a platform is prose-based to flip the primary input (original sentence becomes primary, assembled prompt becomes secondary). The detection logic:

```typescript
// Legacy group names (kept for safety)
const legacyProseGroups = new Set([
  "clean-natural-language",
  "recraft",
  "ideogram",
  "dalle-api",
  "flux-architecture",
  "video-cinematic",
]);
// SD CLIP dedicated builders are NOT prose
const sdClipDedicated = new Set([
  "stability-dedicated",
  "dreamlike-dedicated",
  "dreamstudio-dedicated",
  "fotor-dedicated",
  "lexica-dedicated",
]);
const isProseGroup =
  legacyProseGroups.has(providerGroup) ||
  providerGroup?.startsWith("nl-") ||
  (providerGroup?.endsWith("-dedicated") &&
    !sdClipDedicated.has(providerGroup));
```

**Config:** GPT-5.4-mini, temperature 0.4 for prose groups, 0.2 for CLIP groups.

**Performance findings (from dual-assessor scoring):**

- CLIP platforms: Call 3 averages ~2pt gain (85→87) — marginal, may not justify API cost per platform
- NL platforms: Call 3 averages ~6-8pt gain (88→94) — worth the API cost
- Harmony pass status: Adobe Firefly 93/100, 123RF 91/100 (ChatGPT-verified system prompts). Artbreeder in progress.

---

## 15. Non-Regression Rules

When modifying the optimizer subsystem:

- Do NOT change the 4-pipeline architecture (Keywords, Midjourney, Natural, Plain)
- Do NOT change scoring formula or category weights without full test suite run
- Do NOT add `wasOptimized` to the Lab's dynamic label condition — uses `effectiveWasOptimized` (AI result priority)
- Do NOT re-hardcode `isPro={false}` on `OptimizationTransparencyPanel` in the Lab
- Do NOT allow enabling the optimizer in the Lab without a selected provider
- Do NOT remove the "Within optimal range" emerald bar from the Lab
- Preserve all 5 optimization phases (0–4) in each pipeline
- Preserve Midjourney `--` parameter protection
- Preserve natural language clause reconstruction
- Preserve colour-coded output for Pro users
- **Do NOT modify `use-prompt-optimization.ts` for AI Disguise — AI optimisation uses separate `useAiOptimisation` hook**
- **`effectiveOptimisedText` must take priority over `optimizedResult.optimized` in ALL Lab display locations — copy handlers, char counts, prompt text rendering, colour-coded segments**
- **Client-side optimizer MUST continue running in Lab** — it feeds the `LengthIndicator` bar and acts as fallback. Do NOT skip it when AI is available.
- **Transparency Panel is hidden when `aiOptimiseResult` is available** — AI changes shown as emerald chips instead. Do NOT show both simultaneously.
- **Clear cascade must call `clearAiOptimise()` AND `setOptimizerEnabled(false)`** — prevents stale AI results and re-fire on cleared text
- **`effectiveWasOptimized` must compare text content** (`optimised !== activeTierPromptText`), NOT length — length comparison hides enriched prompts (v6.0.0)
- **Server-side `charCount` measurement is mandatory** — never trust GPT self-reported character counts. `result.charCount = result.optimised.length` must run after all compliance gates.
- **No builder may import from another builder** — complete isolation prevents cross-platform regressions
- **Post-processing (P1–P12) is mandatory on all Call 3 responses** — do not bypass or remove any function from `harmony-post-processing.ts`

**Existing features preserved:** Yes (required for every change)

---

## Changelog

- **29 Mar 2026 (v6.0.0):** **INDEPENDENT BUILDER ARCHITECTURE + BUG FIXES + NEGATIVE RENDERING** — §2.1: File map split into Client-Side and Call 3 Server-Side sections. Added 43 builder files, `harmony-post-processing.ts` (439 lines), `harmony-compliance.ts` (833 lines), `platform-config.json` + `platform-config.ts` (SSOT replacing deleted `prompt-limits.json`). Removed deleted files: `prompt-limits.json`, `prompt-limits.schema.json`, `compression/` folder, `group-multi-engine.ts`. Updated line counts: `optimization-transparency-panel.tsx` 419→610, `use-ai-optimisation.ts` 335→337, `use-prompt-optimization.ts` 356→360, route.ts now documented at 406 lines. §5: Rewrote Platform Limits Database to reference `platform-config.json` SSOT. Platform count corrected from 42 to 40. §11: Updated Security section — no longer claims "all processing client-side" (Call 3 is server-side GPT). Removed reference to deleted schema validation files. Added compliance gates and AI Disguise principle. §12.3: Updated data dependency diagram — `platform-config.json` replaces `prompt-limits.json`. §13: Resolved 5 open items (#5 negative rendering, #6 proseGroups bug, #7 charCount bug, #8 race condition, #9 display bug). Added 4 new open items (#10 Google Imagen degradation, #11 harmony pass incomplete, #12 CLIP Call 3 cost/benefit, #13 platform-formats.json deferred merge). §14.6: Added 2 rows to comparison table (negative prompt window, optimised-but-unchanged state). §14.7: Updated `effectiveWasOptimized` logic from length comparison to text comparison. Updated hook line count 335→337. Added race condition fix documentation. §14.8: New section — Negative prompt window implementation with Call 3 priority, Call 2 fallback, amber UI, negativeSupport gating. §14.9: New section — Call 3 independent builder architecture. 43 builders, routing via platform-groups.ts + resolve-group-prompt.ts, post-processing P1–P12, compliance gates, server-side charCount measurement, proseGroups detection logic, GPT-5.4-mini config (temp 0.4 prose / 0.2 CLIP), performance findings (CLIP ~2pt vs NL ~6-8pt), harmony pass status. §15: Added 4 new non-regression rules (text comparison for effectiveWasOptimized, server-side charCount mandatory, no builder cross-imports, post-processing mandatory). Cross-references: Added `harmonizing-claude-openai.md`, `platform-config.json`, `harmony-anti-regression.md`.
- **23 Mar 2026 (v5.0.0):** **AI DISGUISE OVERLAY — CALL 3 AI OPTIMISATION IN PROMPT LAB** — §14.6: Updated comparison table (10 aspects, up from 7). Added: primary optimizer (AI vs client-side), re-fire behaviour, visual during processing, effective values in label/copy. Updated: label condition now uses `effectiveWasOptimized`, Transparency Panel hidden when AI result available, copy handler uses `effectiveOptimisedText`. §14.7: New section documenting AI Disguise overlay architecture — Call 3 (`/api/optimise-prompt`, GPT-5.4-mini) as primary optimizer in Lab, client-side 4-phase pipeline as fallback + LengthIndicator feed. Documented: separate `useAiOptimisation` hook (335 lines), effective value override pattern, Transparency Panel conditional, debounced 800ms re-fire via `reFireTimerRef`, clear cascade (`clearAiOptimise` + `setOptimizerEnabled(false)`), provider-specific weight syntax enforcement, 4-word rule, quality suffix. §15: Added 5 new non-regression rules (separate hook, effective value priority, client-side must keep running, Transparency Panel conditional, clear cascade). Updated `wasOptimized` rule to reference `effectiveWasOptimized`. Added cross-reference to `ai-disguise.md` §6.
- **18 Mar 2026 (v4.0.0):** **LAB OPTIMIZER PARITY + NEUTRAL MODE + DYNAMIC LABEL** — Added §14 documenting all Prompt Lab–specific optimizer behaviours. §14.1: Neutral mode — optimizer force-disabled when no provider selected via `finalOptimizerDisabled`, tooltip "Select an AI provider above to enable optimisation." §14.2: Dynamic label switching — assembled prompt box label/border/text transitions from slate to emerald when `isOptimizerEnabled && selectedProviderId`. Documented the deliberate exclusion of `wasOptimized` from the condition. §14.3: "Within optimal range" emerald bar when no trimming needed. §14.4: Colour-coded optimized text (Pro only) via `parsePromptIntoSegments()`. §14.5: `isPro` wiring fix — `OptimizationTransparencyPanel` in Lab corrected from hardcoded `false` to hook value. §14.6: Standard Builder vs Lab comparison table (7 aspects). Updated §12.2 consumers table (added Lab with specific behaviours). Updated open items: #4 resolved (isPro now wired). Updated file line count: text-length-optimizer.tsx 347→392. Added §15 Non-Regression Rules (10 rules). Added cross-references to `prompt-lab.md` and `code-standard.md` § 6.14.
- **24 Feb 2026 (v3.0.0):** Phase C — Semantic similarity engine, prompt compression/rewriting (59 rules), real CLIP BPE tokenization. See §9 for full feature table.
- **Feb 2026 (v2.1.0):** Phase B — Expanded redundancy pairs (29→217), injected-term discovery, per-strategy weights.
- **Feb 2026 (v2.0.0):** Phase A — Tier-aware routing, 4 optimizer pipelines, per-strategy weights + decay, Midjourney protection, natural language clause surgery.
- **Jan 2026 (v1.0.0):** Original — single pipeline, basic redundancy (29 pairs), character-based trimming.
