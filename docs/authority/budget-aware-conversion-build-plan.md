# Build Plan — Dynamic Budget-Aware Conversion System

**Version:** 1.0.0
**Date:** 19 March 2026
**Status:** Approved for build
**Scope:** Replace static fidelity/negative limits with dynamic, budget-aware assembly intelligence
**Authority:** This plan supersedes all previous fidelity conversion plans in this session.

---

## Principle

Let the user express their full creative intent. The assembler makes it fit.

Users see fidelity and negative options on every platform. They pick what they want. They don't know about token limits, conversion maps, or prompt budgets. The One Brain assembler takes their full intent and produces the optimal prompt for the specific platform, respecting every constraint invisibly.

---

## What Exists Today That We Wire Into

### From prompt-builder-evolution-plan-v2.md

| Phase   | System                 | File(s)                                                                                  | What it gives us                                                                                                                                                                             |
| ------- | ---------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **7.5** | Platform Term Quality  | `platform-term-quality.ts` (520 lines) + `platform-term-quality-lookup.ts` (266 lines)   | Per-platform term quality scores. Provides the **coherence** dimension of conversion scoring.                                                                                                |
| **7.5** | Platform Co-occurrence | `platform-co-occurrence.ts` (423 lines) + `platform-co-occurrence-lookup.ts` (331 lines) | Per-platform term pair affinity. Scores how well a converted output term fits with the user's other selections.                                                                              |
| **7.9** | Compression Profiles   | `compression-intelligence.ts` (732 lines) + `compression-lookup.ts` (349 lines)          | Per-tier AND per-platform `optimalChars` and `diminishingReturnsAt` values. Provides the **budget ceiling**. Cold-start: static platform limits from `platform-formats.json` (`tokenLimit`). |
| **6**   | Term Quality Scoring   | `term-quality-scoring.ts` (400 lines)                                                    | Per-term per-tier quality scores. Converted output terms need to be scored here too.                                                                                                         |
| **5**   | Co-occurrence Matrix   | `co-occurrence.ts` (260 lines) + `co-occurrence-lookup.ts` (131 lines)                   | Tier-level term pair patterns. Fallback when platform-level data is sparse.                                                                                                                  |
| **6**   | Weight Recalibration   | `weight-recalibration.ts` (472 lines)                                                    | Factor-outcome correlation engine. Future path for learning conversion scorer weights.                                                                                                       |

### From the-like-system.md

| System                              | What it gives us                                                                                                                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Gap 1 — outcomeWithFeedback()**   | Already merges 👍👌👎 into outcome scores for all 5 learning engines. If telemetry includes conversion metadata, the pipeline automatically learns which conversions lead to good outcomes. |
| **Gap 2 — sendShowcaseTelemetry()** | Creates real `prompt_events` rows with full 12-category selections. Converted terms will be visible here.                                                                                   |
| **Credibility scoring**             | Pro user feedback (1.25×) on prompts with conversions trains the system faster.                                                                                                             |
| **Streak detection**                | 3+ 👍 on prompts with specific conversions → hot streak → boost. 3+ 👎 → cold streak → flag.                                                                                                |

### Existing assembler infrastructure (prompt-builder.ts)

| System                                                 | What it gives us                                                                                                |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `NEGATIVE_TO_POSITIVE` (45 entries)                    | Existing conversion map for negatives. Pattern we replicate for fidelity.                                       |
| `FIDELITY_TO_NATIVE` + `FIDELITY_CONVERSION_PLATFORMS` | Already built in a previous delivery. Currently drops/converts blindly. Will be replaced by budget-aware logic. |
| `convertNegativesToPositives()`                        | Existing function handling negative conversion. Will be unified into the new system.                            |
| `trimPromptToLimit()` + `impactPriority`               | Existing trim safety net. Converted terms will get lowest priority.                                             |
| `qualityPrefix` / `qualitySuffix`                      | Per-platform auto-injected terms. Must be included in budget measurement.                                       |
| `estimateClipTokens()`                                 | CLIP token estimation. Used for budget in token-unit platforms.                                                 |
| `AssembledPrompt` type                                 | In `src/types/prompt-builder.ts` (line 174). Needs `conversions` field added.                                   |

---

## The 10 Build Parts

### Part 1 — Conversion Cost Registry

**New file:** `src/lib/prompt-builder/conversion-costs.ts`

Pre-computed cost of every conversion output. Not calculated at runtime — looked up instantly.

```typescript
export interface ConversionEntry {
  output: string; // the converted text: "--quality 2" or "sharp focus"
  cost: number; // word count of the output (0 for parametric)
  isParametric: boolean; // true = appended as parameter, doesn't consume prompt budget
}

export const FIDELITY_CONVERSIONS: Record<
  string,
  Record<string, ConversionEntry>
>;
// Keys: platformFamily → fidelityTerm → ConversionEntry
// platformFamily: 'midjourney' | 'flux' | 'recraft' | 'luma-ai'

export const NEGATIVE_CONVERSIONS: Record<string, ConversionEntry>;
// Keys: negativeTerm → ConversionEntry (platform-independent, same as NEGATIVE_TO_POSITIVE but with cost)

export function getConversionCost(
  term: string,
  category: "fidelity" | "negative",
  platformId: string,
): ConversionEntry | null;
```

**MJ examples:** `{ output: '--quality 2', cost: 0, isParametric: true }`, `{ output: '--stylize 300', cost: 0, isParametric: true }`. All MJ fidelity conversions are parametric (cost=0).

**Flux examples:** `{ output: 'captured with extraordinary clarity, shot on Hasselblad X2D', cost: 9, isParametric: false }`. Inline, costs 9 words.

**Negative examples:** `{ output: 'sharp focus', cost: 2, isParametric: false }`, `{ output: 'empty scene', cost: 2, isParametric: false }`.

This file replaces the existing `FIDELITY_TO_NATURAL` map and `NEGATIVE_TO_POSITIVE` map with cost-aware versions. The old maps become imports into this registry.

---

### Part 2 — Budget Calculator

**New file:** `src/lib/prompt-builder/conversion-budget.ts`

Calculates remaining budget after core prompt + qualityPrefix + qualitySuffix.

```typescript
export function getConversionBudget(
  corePromptWordCount: number,
  qualityPrefixWordCount: number,
  qualitySuffixWordCount: number,
  platformId: string,
  platformFormat: PlatformFormat,
): { remaining: number; ceiling: number; unit: "words" };
```

**Data sources (in priority order):**

1. **Learned data** — `compression-lookup.ts` → `lookupPlatformOptimalLength(platformId)` returns `PlatformLengthProfile.optimalChars`. Convert chars to words (÷5 average). Falls back to tier-level `lookupOptimalLength(tier)` if platform has insufficient events.

2. **Static fallback** — `platform-formats.json` → `tokenLimit` field. Convert tokens to words (÷1.3 for CLIP). Per-platform static ceilings from research doc:

| Platform   | Ceiling (words) | Source                            |
| ---------- | --------------- | --------------------------------- |
| Midjourney | 30              | Research: "target 15–30 words"    |
| BlueWillow | 30              | Same engine as MJ                 |
| Flux       | 80              | BFL recommendation: "30–80 words" |
| DALL-E 3   | 160             | 800 chars ÷ 5                     |
| Canva      | 30              | "20–30 words max"                 |
| Tensor.Art | 58              | 75 tokens ÷ 1.3                   |
| Leonardo   | 154             | 200 tokens ÷ 1.3                  |
| Luma AI    | 231             | 300 tokens ÷ 1.3                  |
| Recraft    | 154             | 200 tokens ÷ 1.3                  |

**Gap 2 fix — qualityPrefix/Suffix in budget:**

The budget calculation includes ALL pre-conversion prompt content:

```
remaining = ceiling - corePromptWordCount - qualityPrefixWordCount - qualitySuffixWordCount
```

The dedup step runs before budget calculation (already exists), so if qualitySuffix contains "sharp focus" and the user also selected "sharp focus" as fidelity, the deduped version is measured — not double-counted.

---

### Part 3 — Cold-Start Affinity Map

**New file:** `src/lib/prompt-builder/conversion-affinities.ts`

**Gap 1 fix.** Hand-curated affinity scores between converted output terms and common prompt categories. Used when `platform-co-occurrence-lookup.ts` returns null/zero (no learned data yet).

```typescript
export const COLD_START_AFFINITIES: Record<string, Record<string, number>>;
```

Structure: `convertedOutputTerm → { existingSelectionTerm → affinityScore (0–1) }`.

**Examples:**

```
'sharp focus': {
  'macro photography': 0.95,
  'portrait photography': 0.9,
  'intricate textures': 0.85,
  'dreamy watercolour': 0.15,  // contradicts
  'soft ethereal glow': 0.2,   // contradicts
  'photorealistic': 0.9,
},
'empty scene': {
  'abandoned': 0.9,
  'desolate': 0.85,
  'crowded market': 0.05,       // contradicts
  'landscape': 0.8,
  'architecture': 0.75,
},
'--quality 2': {
  // Parametric — always included, affinity irrelevant
},
'captured with extraordinary clarity, shot on Hasselblad X2D': {
  'photorealistic': 0.95,
  'cinematic': 0.85,
  'commercial photography': 0.9,
  'abstract art': 0.3,
  'watercolour': 0.15,
}
```

**~80–120 entries** covering all conversion outputs × top 5–10 common selection terms each. This is a one-time curated effort.

**Progressive override:** When `lookupPlatformCoOccurrence()` returns data with confidence > 0.3, the learned score replaces the cold-start score:

```
finalAffinity = learnedConfidence > 0.3
  ? learnedScore
  : coldStartScore × (1 - learnedConfidence) + learnedScore × learnedConfidence
```

Same blending pattern as Phase 7.5's existing `platformConfidence` ramp.

---

### Part 4 — Conversion Scorer

**New file:** `src/lib/prompt-builder/conversion-scorer.ts`

Scores each conversion candidate on three dimensions.

```typescript
export interface ScoredConversion {
  from: string; // user's selection: "8K", "blurry"
  to: string; // converted output: "--quality 2", "sharp focus"
  category: "fidelity" | "negative";
  score: number; // final score 0–1
  coherence: number; // dimension 1
  costEfficiency: number; // dimension 2
  impact: number; // dimension 3
  cost: number; // word cost
  isParametric: boolean; // bypasses budget
}

export function scoreConversions(
  candidates: ConversionEntry[],
  coreSelections: PromptSelections,
  platformId: string,
  remainingBudget: number,
): ScoredConversion[];
```

**Dimension 1 — Coherence (weight: 0.4)**

Calls `lookupPlatformTermQuality(platformId, outputTerm)` from Phase 7.5. If null, falls back to `lookupTermQuality(tier, outputTerm)` from Phase 6. If still null, falls back to `COLD_START_AFFINITIES[outputTerm]` from Part 3.

Also calls `lookupPlatformCoOccurrence(platformId, outputTerm, existingTerm)` for each of the user's existing selections. Averages the affinity scores. If no learned data, uses cold-start affinities.

Coherence score = `(termQuality × 0.5 + avgAffinity × 0.5)`, clamped 0–1.

**Dimension 2 — Cost Efficiency (weight: 0.35)**

```
costEfficiency = isParametric ? 1.0 : max(0, 1 - (cost / max(remainingBudget, 1)))
```

A 2-word conversion with 20 words budget = 0.9. A 9-word conversion with 10 words budget = 0.1. Parametric = always 1.0.

**Dimension 3 — Impact (weight: 0.25)**

Static base impact per conversion, overridable by learned `term-quality-scores.json` when available:

| Conversion             | Base Impact | Condition                                  |
| ---------------------- | ----------- | ------------------------------------------ |
| blurry → sharp focus   | 0.9         | Universal                                  |
| watermark → unmarked   | 0.85        | Universal                                  |
| text → clean image     | 0.85        | Universal                                  |
| deformed → well-formed | 0.8         | Universal                                  |
| 8K → (platform native) | 0.7         | Higher if style is photorealistic          |
| masterpiece → (native) | 0.6         | Higher if style is artistic                |
| morbid → pleasant mood | 0.4         | Only relevant if atmosphere has dark terms |
| cartoon → realistic    | 0.5         | Only relevant if style isn't cartoon       |

When `term-quality-scores.json` has a quality score for the output term on this tier, that learned score replaces the static impact: `impact = learnedQuality > 0 ? learnedQuality : staticImpact`.

**Final score:**

```
finalScore = (coherence × 0.4) + (costEfficiency × 0.35) + (impact × 0.25)
```

**Gap 5 note:** These weights (0.4, 0.35, 0.25) are manually tuned for now. They are NOT wired into Phase 6's weight recalibration engine yet. That's a future enhancement after we have 30 days of conversion telemetry to correlate against. Acknowledged as a known limitation, not a broken promise.

---

### Part 5 — Budget-Aware Assembly Integration

**Modify:** `src/lib/prompt-builder.ts` — `assembleTierAware()` function

Replace the current `convertFidelityForPlatform()` and the scattered negative conversion paths with a unified budget-aware pipeline step.

**New pipeline (inside `assembleTierAware()`):**

```
1. Deduplicate within categories (existing)
2. Deduplicate across categories (existing)
3. Assemble core prompt (subject → materials, 10 categories) via existing assembleKeywords/assembleNaturalSentences/assemblePlainLanguage
   — BUT: pass fidelity and negative selections separately, NOT into the core assembly
4. Measure core prompt word count (including qualityPrefix + qualitySuffix after dedup)
5. Calculate remaining budget via getConversionBudget()
6. Collect conversion candidates:
   a. ALL fidelity selections on FIDELITY_CONVERSION_PLATFORMS → look up in FIDELITY_CONVERSIONS
   b. Negatives ONLY where negativeSupport === 'none' → look up in NEGATIVE_CONVERSIONS
   c. Negatives where negativeSupport === 'inline' → look up in NEGATIVE_CONVERSIONS (cost = inline syntax overhead)
   d. Negatives where negativeSupport === 'separate' → DO NOT enter pool (Gap 3 fix — they go in the separate field for free)
   e. Fidelity on NON-conversion platforms → pass through unchanged (Tensor.Art, Leonardo, etc. use fidelity verbatim)
7. Score all candidates via scoreConversions()
8. Sort by score descending
9. Include all parametric conversions (cost=0, always fit)
10. Greedily include inline conversions while remaining >= cost
11. Append included conversions to the appropriate prompt section
12. Run existing trimPromptToLimit() as safety net — converted terms get LOWEST impactPriority so user selections always survive
13. Build AssembledPrompt with conversions metadata
```

**Gap 3 fix — explicit negative routing:**

```typescript
const negativePool =
  platformFormat.negativeSupport === "none"
    ? allNegatives // all enter conversion pool
    : platformFormat.negativeSupport === "inline"
      ? allNegatives // all enter conversion pool (inline syntax)
      : []; // 'separate' → skip pool, handle in separate field as today
```

Platforms with `negativeSupport: 'separate'` (Leonardo, Stability, Tensor.Art, Flux, Recraft, etc.) continue to put negatives in their own field with no budget impact. Only 'none' (DALL-E, Firefly, Bing, Designer, Meta, Canva, Luma AI, Kling, Jasper Art) and 'inline' (MJ, BlueWillow) negatives enter the conversion budget pool.

**Trim priority update:**

Currently `impactPriority` is per-platform in `platform-formats.json`. Converted terms are appended AFTER the impactPriority ordering, meaning they're trimmed first if the prompt exceeds the hard limit. User selections always survive.

---

### Part 6 — AssembledPrompt Metadata

**Modify:** `src/types/prompt-builder.ts` — extend `AssembledPrompt` interface

```typescript
export interface ConversionResult {
  /** User's original selection: "8K", "blurry" */
  from: string;
  /** Converted output: "--quality 2", "sharp focus" */
  to: string;
  /** Source category */
  category: "fidelity" | "negative";
  /** Made it into the prompt? */
  included: boolean;
  /** If excluded, why */
  reason?: "budget" | "low-coherence";
  /** Conversion score (0–1) */
  score: number;
  /** Word cost of the conversion */
  cost: number;
  /** Parametric = free (doesn't consume prompt budget) */
  isParametric: boolean;
}

export interface AssembledPrompt {
  // ... existing fields ...
  /** Budget-aware conversion results (fidelity + negative) */
  conversions?: ConversionResult[];
  /** Budget state at assembly time */
  conversionBudget?: {
    ceiling: number;
    coreLength: number;
    remaining: number;
    unit: "words";
  };
}
```

---

### Part 7 — Update PLATFORM_SPECIFIC_LIMITS

**Modify:** `src/lib/usage/constants.ts`

Set real fidelity/negative UI limits for conversion platforms. These are the dropdown maximums — the assembler decides how many actually make it into the output.

| Platform            | Fidelity (free/pro) | Negative (free/pro)     | Rationale                                   |
| ------------------- | ------------------- | ----------------------- | ------------------------------------------- |
| midjourney          | 2/3                 | 2/4 (unchanged)         | Parametric — all fit regardless of budget   |
| bluewillow          | 1/2                 | 2/3 (unchanged)         | Same engine, less sophisticated             |
| flux                | 2/3                 | 3/5 (unchanged)         | T5 absorbs NL clauses well, budget-gated    |
| recraft             | 1/2                 | 3/5 (unchanged)         | Style presets do most quality work          |
| luma-ai             | 1/2                 | 2/3                     | Negatives now convert (was 0/0)             |
| openai              | 1/1 (unchanged)     | 2/3                     | Negatives now convert (was 0/0)             |
| adobe-firefly       | 1/1 (unchanged)     | 2/3                     | Negatives now convert (was 0/0)             |
| bing                | 1/1 (unchanged)     | 1/2                     | Short budget, fewer conversions fit         |
| microsoft-designer  | 1/1 (unchanged)     | 1/2                     | Short budget                                |
| imagine-meta        | 1/1 (unchanged)     | 1/2                     | Most basic platform                         |
| kling               | 2/3 (unchanged)     | 2/3                     | Negatives forced through conversion         |
| jasper-art          | 1/1 (unchanged)     | 1/2                     | DALL-E 2, negatives convert                 |
| canva               | 1/1 (unchanged)     | 1/2                     | Short budget                                |
| All other 'none' T4 | unchanged           | 1/2 where currently 0/0 | Give conversion pool something to work with |

---

### Part 8 — Telemetry Integration

**Modify:** `src/types/prompt-telemetry.ts` — extend Zod schema
**Modify:** `src/lib/telemetry/prompt-telemetry-client.ts` — send conversion data
**Modify:** `src/lib/learning/database.ts` — store + retrieve conversion data

**Gap 4 fix — full data pipeline:**

**Step 1 — Zod schema** (prompt-telemetry.ts):

```typescript
// Add to PromptTelemetryEventSchema
conversionMeta: z.object({
  fidelityConverted: z.number().int().min(0).max(20),
  fidelityDeferred: z.number().int().min(0).max(20),
  negativesConverted: z.number().int().min(0).max(20),
  negativesDeferred: z.number().int().min(0).max(20),
  budgetCeiling: z.number().int().min(0).max(2000),
  budgetRemaining: z.number().int().min(-500).max(2000),
  parametricCount: z.number().int().min(0).max(20),
}).optional(),
```

**Step 2 — Telemetry client** (prompt-telemetry-client.ts):

After assembly, extract conversion metadata from `AssembledPrompt.conversions` and include in the telemetry payload.

**Step 3 — Database** (database.ts):

Add column to `prompt_events`:

```sql
ALTER TABLE prompt_events ADD COLUMN IF NOT EXISTS conversion_meta JSONB;
```

Add to both SELECT queries (same pattern as Gap 1 feedback columns):

```sql
SELECT ..., conversion_meta, feedback_rating, feedback_credibility, created_at
```

Add to `PromptEventRow`:

```typescript
conversion_meta?: {
  fidelityConverted: number;
  fidelityDeferred: number;
  negativesConverted: number;
  negativesDeferred: number;
  budgetCeiling: number;
  budgetRemaining: number;
  parametricCount: number;
} | null;
```

**Step 4 — API route** (prompt-telemetry/route.ts):

The Zod schema already validates inbound data. Just ensure the INSERT includes the new column:

```sql
INSERT INTO prompt_events (..., conversion_meta) VALUES (..., ${JSON.stringify(conversionMeta)})
```

---

### Part 9 — Learning Pipeline Feedback Loop

**Modify:** `src/lib/learning/term-quality-scoring.ts`
**Modify:** `src/lib/learning/platform-co-occurrence.ts`

When processing a `prompt_event` that has `conversion_meta`:

**In term-quality-scoring.ts:**

For each included conversion in the event, apply the outcome score (via `outcomeWithFeedback()`) to BOTH:

1. The user's original term (e.g., "8K" in fidelity category)
2. The converted output term (e.g., "captured with extraordinary clarity" as a Flux-specific term)

This means the system learns: "When users select '8K' on Flux and the prompt gets 👍, the conversion output 'captured with extraordinary clarity' is a good term on Flux." Over time, the platform term quality scores for conversion outputs grow, and the cold-start affinities from Part 3 get progressively replaced by real data.

**In platform-co-occurrence.ts:**

Record co-occurrence between the converted output term and all other terms in the user's selections. If user had `subject: ['mountain landscape']` and `lighting: ['golden hour']`, and fidelity "8K" converted to "captured with extraordinary clarity" on Flux, then three co-occurrence pairs are recorded:

- (captured with extraordinary clarity, mountain landscape) on Flux
- (captured with extraordinary clarity, golden hour) on Flux

This feeds back into Part 4's coherence scoring — next time someone builds a "mountain landscape + golden hour" prompt on Flux, the conversion scorer knows "captured with extraordinary clarity" pairs well with those terms.

**Streak integration (automatic):**

`feedback-streaks.ts` already detects hot/cold/oscillating patterns on prompt_events. When 3+ consecutive 👍 happen on prompts that all had conversions included, the hot streak is visible in the admin dashboard. When 3+ 👎 happen, the cold streak flags those conversion patterns for review. No code change needed — the streak system reads from the same `prompt_events` table.

---

### Part 10 — Transparency Panel + Docs + Tests

**10a — Transparency Panel**

**Modify:** `src/components/providers/optimization-transparency-panel.tsx`

**Gap 6 fix.** Add a "Conversions" section to the existing panel. Data flows from `AssembledPrompt.conversions` → panel props → rendered UI.

Display:

```
Conversions (3 selected → 2 included)
  ✅ "8K" → "--quality 2" (parametric — free)
  ✅ "blurry" → "sharp focus" (2 words, score: 0.87)
  ⏸ "morbid" → "pleasant mood" (deferred — budget)
```

Included conversions show ✅ with the converted output. Deferred show ⏸ with the reason. Parametric conversions are labelled "(parametric — free)" so Pro page visitors understand why MJ fidelity conversions always work.

**10b — Authority Doc Updates**

**Gap 7 fix.** Three documents need updating:

1. **`optimal-prompt-stacking.md`** — Update fidelity limits for MJ (0/0 → 2/3), Flux (0/0 → 2/3), Recraft (0/0 → 1/2), Luma AI (0/0 → 1/2). Add note: "Fidelity limits represent UI selection slots. The assembler's budget-aware conversion system determines how many make it into the output." Update negative limits for DALL-E/Firefly/Bing/Designer/Meta/Canva/Luma/Kling/Jasper (0/0 → per table in Part 7). Add "Fidelity Conversion Rules" section update explaining budget-aware approach replaces static Option B.

2. **`paid_tier.md` §5.6** — Replace "Stackable categories get +1 selection for Pro Promagen users via `generatePaidLimits()`" with: "Per-platform limits from `PLATFORM_SPECIFIC_LIMITS` in `constants.ts`. Pro Promagen users get platform-specific bonuses based on encoder architecture research. Fidelity and negative conversions are budget-aware — the assembler converts user selections into platform-native equivalents and fits as many as the prompt budget allows." Update the Category Limits table with new per-platform numbers. Update Tier Platform Lists (45 platforms, Jasper Art in Tier 3, Tensor.Art in Tier 1, new platforms added).

3. **`prompt-builder-evolution-plan-v2.md`** — Add §7.12 or appendix: "Budget-Aware Conversion System" documenting the 5-step assembly pipeline, conversion scorer dimensions, cold-start strategy, and telemetry integration. Reference `conversion-budget.ts`, `conversion-costs.ts`, `conversion-scorer.ts`, `conversion-affinities.ts`. Update §13 Cross-Feature Matrix Compression row to note: "Conversions budget-aware on all tiers."

**10c — Tests**

**Gap 8 fix.** Test plan covering every part:

| Test File                                           | Tests | What It Validates                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `__tests__/conversion-costs.test.ts`                | ~15   | Every FIDELITY_CONVERSIONS entry has valid output + cost. Every NEGATIVE_CONVERSIONS entry has valid output + cost. MJ entries are all parametric. Flux entries have non-zero cost. `getConversionCost()` returns null for unknown terms.                                                                                                                                                                                                                                                                                |
| `__tests__/conversion-budget.test.ts`               | ~20   | Budget = ceiling - core - prefix - suffix (Gap 2). Remaining never negative (floors at 0). Learned data from compression-lookup used when available. Static fallback matches research doc values per platform. Budget measured in words for all platforms.                                                                                                                                                                                                                                                               |
| `__tests__/conversion-affinities.test.ts`           | ~15   | Cold-start map covers all conversion output terms. Affinity scores 0–1 range. High-affinity pairs are sensible (sharp focus + macro). Low-affinity pairs are sensible (sharp focus + dreamy). Progressive override blends correctly at confidence thresholds.                                                                                                                                                                                                                                                            |
| `__tests__/conversion-scorer.test.ts`               | ~25   | Parametric always scores costEfficiency=1.0. Coherence uses cold-start when no learned data. Impact uses static map, overridden by learned data when present. Final score = weighted sum. Candidates sorted by score descending. Zero-budget returns only parametric candidates.                                                                                                                                                                                                                                         |
| `__tests__/conversion-assembly-integration.test.ts` | ~30   | MJ fidelity converts to params, all included regardless of budget. Flux fidelity budget-gated — short prompt includes all, long prompt defers some. DALL-E negatives convert to positives in prompt body. Leonardo negatives go to separate field (NOT in pool — Gap 3). Kling negatives forced through conversion. Converted terms trimmed before user selections (lowest priority). `AssembledPrompt.conversions` metadata matches actual prompt content. QualityPrefix/Suffix included in budget measurement (Gap 2). |
| `__tests__/conversion-telemetry.test.ts`            | ~10   | Zod schema accepts conversionMeta. Zod schema rejects invalid conversionMeta. Telemetry payload includes conversion counts. API route stores conversion_meta in DB.                                                                                                                                                                                                                                                                                                                                                      |
| `__tests__/conversion-learning.test.ts`             | ~10   | term-quality-scoring processes both original and converted terms. platform-co-occurrence records conversion output pairs. outcomeWithFeedback correctly weights conversion events.                                                                                                                                                                                                                                                                                                                                       |

**Total: ~125 new tests across 7 files.**

Existing tests to update:

- `parity-all-42-platforms.test.ts` — Update to 45 platforms, verify new fidelity/negative limits
- `parity-homepage-builder.test.ts` — Same
- `upgrade-3-canonical-assembly.test.ts` — Add conversion cases
- `improvements-1-5.test.ts` — Verify converted terms don't break dedup

---

## Build Order

```
Part 1 (costs)     → Part 2 (budget)    → Part 3 (affinities)  → Part 4 (scorer)
    ↓                                                                  ↓
Part 5 (assembly integration) → Part 6 (types) → Part 7 (limits) → Part 8 (telemetry)
    ↓
Part 9 (learning loop) → Part 10 (transparency + docs + tests)
```

Parts 1–4: New files, zero risk to existing code.
Part 5: Core assembler modification — highest risk, most careful.
Part 6: Type extension — low risk.
Part 7: Limits update — low risk.
Part 8: Telemetry pipeline — medium risk (DB migration).
Part 9: Learning enrichment — low risk (additive changes).
Part 10: UI + docs + tests — zero risk to core.

---

## Files Touched

| File                                                           | Change                          | Risk     | Part |
| -------------------------------------------------------------- | ------------------------------- | -------- | ---- |
| `src/lib/prompt-builder/conversion-costs.ts`                   | NEW                             | Zero     | 1    |
| `src/lib/prompt-builder/conversion-budget.ts`                  | NEW                             | Zero     | 2    |
| `src/lib/prompt-builder/conversion-affinities.ts`              | NEW                             | Zero     | 3    |
| `src/lib/prompt-builder/conversion-scorer.ts`                  | NEW                             | Zero     | 4    |
| `src/lib/prompt-builder.ts`                                    | Modify assembleTierAware        | **High** | 5    |
| `src/types/prompt-builder.ts`                                  | Extend AssembledPrompt          | Low      | 6    |
| `src/lib/usage/constants.ts`                                   | Update fidelity/negative limits | Low      | 7    |
| `src/types/prompt-telemetry.ts`                                | Extend Zod schema               | Low      | 8    |
| `src/lib/telemetry/prompt-telemetry-client.ts`                 | Send conversion data            | Low      | 8    |
| `src/lib/learning/database.ts`                                 | Add column + SELECT             | Medium   | 8    |
| `src/app/api/prompt-telemetry/route.ts`                        | Include new column in INSERT    | Low      | 8    |
| `src/lib/learning/term-quality-scoring.ts`                     | Score conversion terms          | Low      | 9    |
| `src/lib/learning/platform-co-occurrence.ts`                   | Record conversion pairs         | Low      | 9    |
| `src/components/providers/optimization-transparency-panel.tsx` | Add conversions section         | Low      | 10   |
| `docs/authority/optimal-prompt-stacking.md`                    | Update fidelity/negative limits | —        | 10   |
| `docs/authority/paid_tier.md`                                  | Update §5.6                     | —        | 10   |
| `docs/authority/prompt-builder-evolution-plan-v2.md`           | Add §7.12                       | —        | 10   |
| 7 new test files                                               | ~125 tests                      | Zero     | 10   |
| 4 existing test files                                          | Update assertions               | Low      | 10   |

**Total: 11 modified files, 4 new source files, 7 new test files, 3 doc updates.**

---

## What "Good" Looks Like After Build

1. User selects "8K" + "masterpiece" + "highly detailed" as fidelity on Midjourney → ALL THREE convert to `--quality 2 --stylize 300` params → all included regardless of prompt length → `conversions` metadata shows 3 included, 0 deferred, all parametric.

2. User selects "8K" + "masterpiece" on Flux with a 70-word core prompt → Budget ceiling 80 words, remaining 10 → "8K" converts to 9-word clause, scores highest on coherence → included → "masterpiece" converts to 6-word clause → exceeds remaining → deferred with reason "budget" → `conversions` shows 1 included, 1 deferred.

3. User selects "blurry" + "watermark" + "text" as negatives on DALL-E with a short prompt → All three convert to positive terms ("sharp focus", "unmarked", "clean image") → total cost 6 words → budget has room → all included in positive prompt body → no negative field (DALL-E doesn't support it).

4. User selects "blurry" as negative on Leonardo → Goes in SEPARATE negative field → does NOT enter conversion pool → no budget impact → `conversions` metadata is empty for this term.

5. Transparency panel shows: "Conversions (3 selected → 2 included)" with ✅/⏸ per term.

6. Telemetry event includes `conversionMeta` → nightly cron aggregates → over 30 days, platform-co-occurrence learns which conversions pair well with which selections → cold-start affinities progressively replaced → conversion quality improves automatically.

7. User gives 👍 on a prompt with fidelity conversion → `outcomeWithFeedback()` boosts both the original term ("8K") and the converted output ("captured with extraordinary clarity") in term-quality-scoring → next time someone selects "8K" on Flux, the conversion scores higher.

---

## Verification

```powershell
# frontend folder
pnpm run typecheck
pnpm run lint
pnpm run test -- --testPathPattern="conversion"
pnpm run test -- --testPathPattern="parity"
```
