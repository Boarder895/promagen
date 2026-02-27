# Phase 6 — Self-Improving Scorer Build Plan

**Version:** 1.0.0  
**Created:** 25 February 2026  
**Status:** Planning  
**Authority:** `prompt-builder-evolution-plan-v2.md` § 10  
**Dependencies:** Phase 5 (Collective Intelligence Engine) — **deployed**  
**Estimated effort:** ~6 days across 8 build steps  
**Code standard:** `docs/authority/code-standard.md`  
**Working practice:** `docs/authority/best-working-practice.md`

---

## 1. Goal

The current health scorer in `integration.ts` (line 288) is a hard-coded formula:

```
score = 50 (base) + 20 (subject) + 15 (fill) + 15% of coherence
```

This is an educated guess. Phase 5 already captures outcome signals (copied, saved, return time, reuse) alongside per-factor breakdowns in the `prompt_events` table. Phase 6 closes the loop: **compare what the scorer predicted vs what actually happened, then recalibrate automatically.**

No ML. No external services. Just arithmetic running nightly on the same Vercel Pro cron infrastructure Phase 5 already uses.

---

## 2. What Phase 5 Already Provides (Starting Point Audit)

| Component                                                             | Status       | Evidence                                                                        |
| --------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------- |
| Telemetry endpoint (`POST /api/prompt-telemetry`)                     | ✅ Built     | `src/app/api/prompt-telemetry/route.ts`                                         |
| Outcome signals (copied, saved, returnedWithin60s, reusedFromLibrary) | ✅ In schema | `src/types/prompt-telemetry.ts` — `PromptOutcome` interface                     |
| Score factor breakdown per event                                      | ✅ In schema | `scoreFactors: Record<string, number>` in `PromptTelemetryEvent`                |
| Database table (`prompt_events`)                                      | ✅ Built     | `src/lib/learning/database.ts` — `score_factors JSONB`, `outcome JSONB` columns |
| Nightly cron infrastructure                                           | ✅ Built     | `src/app/api/learning/aggregate/route.ts` — secret-protected, advisory-locked   |
| Learning constants (blend ratios, thresholds)                         | ✅ Built     | `src/lib/learning/constants.ts`                                                 |
| Learned weights hook                                                  | ✅ Built     | `src/hooks/use-learned-weights.ts` — module-level cache, 10-min refetch         |
| `learned_weights` table (key-value JSON store)                        | ✅ Built     | `src/lib/learning/database.ts` — `upsertLearnedWeights()`                       |

**What this means:** Steps 6.1 (telemetry extension) and 6.2 (score factor storage) from the evolution plan are **already done**. The telemetry schema already captures all 4 outcome signals and the full score factor breakdown. We can jump straight to the cron computation layers.

---

## 3. Output Files (What the Cron Produces)

These are new JSON blobs stored in the `learned_weights` table (same pattern as Phase 5's `co-occurrence` key):

| Storage Key            | Size Est. | Contents                                                   | Consumed By                                |
| ---------------------- | --------- | ---------------------------------------------------------- | ------------------------------------------ |
| `scoring-weights`      | < 1 KB    | Per-tier factor weights (4 tiers × ~7 factors)             | `prompt-optimizer.ts`, `integration.ts`    |
| `term-quality-scores`  | ~30 KB    | Per-term per-tier quality score                            | `suggestion-engine.ts` (dropdown ordering) |
| `scorer-health-report` | ~3 KB     | Correlation trends, drift alerts, threshold recommendation | Admin dashboard (Phase 7.10), dev console  |

---

## 4. Build Steps — Detailed Breakdown

### Part 6.1 — Outcome Score Computation (Data Layer)

**Effort:** 0.5 days  
**Dependencies:** None (Phase 5 data already flowing)

**What:** Create a pure function that converts raw outcome signals into a single numeric "outcome score" (0–1) for correlation analysis. This is the Y-axis for all subsequent correlation work.

**File:** `src/lib/learning/outcome-score.ts` (NEW)

**Logic:**

```
Signal weights (from evolution plan § 10.2):
  copied:              0.10  (weakest — everyone copies)
  copied + no return:  0.25  (moderate — they used it)
  saved to library:    0.35  (strong — they valued it)
  reused from library: 0.50  (highest — they came back for it)

Composite score = weighted sum, capped at 1.0
```

**Details:**

- Pure function, no side effects, no database calls
- Input: `PromptOutcome` from `prompt-telemetry.ts`
- Output: `number` (0–1)
- Include unit tests verifying each signal combination

**Tests:** `src/lib/learning/__tests__/outcome-score.test.ts` (NEW)

- All-false outcome → 0
- Copied only → 0.10
- Copied + no return → 0.35 (cumulative)
- Saved → 0.35
- Reused → highest score
- Combined signals cap at 1.0

---

### Part 6.2 — Weight Recalibration Engine (Mechanism 1)

**Effort:** 1 day  
**Dependencies:** Part 6.1

**What:** Pearson correlation between each scoring factor and the outcome score, computed nightly per tier. Normalise to weights summing to 1.0.

**File:** `src/lib/learning/weight-recalibration.ts` (NEW)

**Algorithm:**

```
For each tier (1–4):
  1. Fetch all qualifying events (score >= 90, 4+ categories)
  2. For each scoring factor (categoryCount, coherence, promptLength, tierFormat, negative, fidelity, density):
     a. Collect paired arrays: [factorValues[], outcomeScores[]]
     b. Compute Pearson r = correlation(factorValues, outcomeScores)
     c. Store absolute value (we want magnitude of correlation)
  3. Normalise: weight_i = |r_i| / sum(|r_j|) for all j
  4. Floor at 0.02 (no factor drops to zero — prevents division collapse)
  5. Re-normalise after flooring so weights still sum to 1.0
```

**Output shape:**

```typescript
interface ScoringWeights {
  version: string; // "1.0.0"
  generatedAt: string; // ISO timestamp
  eventCount: number; // Total events used
  tiers: {
    [tierId: string]: {
      // "1", "2", "3", "4"
      weights: Record<string, number>; // factor → weight (sum = 1.0)
      correlations: Record<string, number>; // factor → raw Pearson r
      eventCount: number; // Events for this tier
      threshold: number; // Current quality threshold (from Part 6.5)
    };
  };
  global: {
    // Fallback when per-tier has too few events
    weights: Record<string, number>;
    correlations: Record<string, number>;
    eventCount: number;
  };
}
```

**Cold start guard:** If a tier has < 100 events, use the global (all-tier) weights for that tier. If global has < 100 events, return the static defaults (current hard-coded weights).

**Static defaults (current weights, preserved as fallback):**

```typescript
const STATIC_DEFAULTS: Record<string, number> = {
  categoryCount: 0.2,
  coherence: 0.2,
  promptLength: 0.15,
  tierFormat: 0.15,
  negative: 0.1,
  fidelity: 0.1,
  density: 0.1,
};
```

**Tests:** `src/lib/learning/__tests__/weight-recalibration.test.ts` (NEW)

- 5 events → returns static defaults (cold start)
- 200 events with known correlations → correct Pearson r values
- Floor of 0.02 applied → verify no weight is 0
- Weights sum to 1.0 ± 0.001
- Per-tier separation works (different data → different weights)

---

### Part 6.3 — Per-Tier Scoring Models (Mechanism 3)

**Effort:** 1 day  
**Dependencies:** Part 6.2

**What:** The weight recalibration already produces per-tier weights. This step integrates them into the actual scorer so the health score calculation reads learned weights instead of static ones.

**Files modified:**

| File                                                 | Change                                                                     |
| ---------------------------------------------------- | -------------------------------------------------------------------------- |
| `src/lib/prompt-intelligence/engines/integration.ts` | `calculateHealthScore()` reads learned weights                             |
| `src/lib/prompt-optimizer.ts`                        | `optimizePromptGoldStandard()` uses learned weights for quality assessment |
| `src/hooks/use-learned-weights.ts`                   | Extend to also fetch `scoring-weights` key                                 |
| `src/lib/learning/constants.ts`                      | Add `SCORING_WEIGHTS_KEY` constant                                         |

**Integration pattern (same as Phase 5 co-occurrence):**

```
1. Cron writes `scoring-weights` JSON to learned_weights table
2. API route GET /api/learning/scoring-weights serves it
3. use-learned-weights hook fetches + caches
4. calculateHealthScore() checks:
   - Has learned weights? → use them
   - No learned weights? → use STATIC_DEFAULTS
   - Never crashes if learning data is missing
```

**New API route:** `src/app/api/learning/scoring-weights/route.ts` (NEW)

- GET handler, reads from `learned_weights` table where key = 'scoring-weights'
- Returns JSON directly, same cache pattern as `/api/learning/co-occurrence`

**Modified `calculateHealthScore()` signature:**

```typescript
// BEFORE (static)
function calculateHealthScore(dna: PromptDNA, hasSubject: boolean): number;

// AFTER (learned-aware)
function calculateHealthScore(
  dna: PromptDNA,
  hasSubject: boolean,
  learnedWeights?: ScoringWeights | null,
  tierId?: PlatformTierId,
): number;
```

The hook passes learned weights down through `analyzePrompt()` → `calculateHealthScore()`. Backward compatible: both new params optional, defaults to static formula.

**Tests:**

- Static weights produce same score as before (regression)
- Learned weights with coherence at 0.5 → coherence dominates score
- Missing learned weights → falls back to static (no crash)
- Per-tier: same prompt gets different scores on Tier 1 vs Tier 4

---

### Part 6.4 — Category Value Discovery (Mechanism 4)

**Effort:** 0.5 days  
**Dependencies:** Part 6.1

**What:** Learn which categories are high-value vs low-value per tier. A prompt with 4 high-value categories should score higher than one with 6 low-value categories.

**File:** `src/lib/learning/category-value-discovery.ts` (NEW)

**Algorithm:**

```
For each tier:
  For each category (subject, action, style, ...):
    1. Split events into two groups:
       - "has category filled" vs "category empty"
    2. Compare mean outcome scores between groups
    3. categoryValue = mean(filled) - mean(empty)
    4. Positive = valuable category, Negative = irrelevant/harmful
```

**Output shape (included in `scoring-weights` JSON):**

```typescript
categoryValues: {
  [tierId: string]: {
    [category: string]: number;  // positive = valuable, negative = irrelevant
  };
};
```

**How it feeds back:**

- `calculateHealthScore()` uses category values instead of flat `filledCount / totalCategories`
- 4 high-value categories (each +0.3) = +1.2 contribution
- 6 low-value categories (each +0.05) = +0.3 contribution
- Categories with negative values are NOT penalised (clamped at 0) — we don't punish users for filling more

**Tests:**

- Category always filled in high-outcome events → high value
- Category irrelevant to outcomes → value near 0
- No negative penalisation verification

---

### Part 6.5 — Term Quality Scores (Mechanism 5)

**Effort:** 1 day  
**Dependencies:** Part 6.1

**What:** Each vocabulary term gets a per-tier quality score based on how often it appears in high-outcome prompts.

**File:** `src/lib/learning/term-quality-scoring.ts` (NEW)

**Algorithm:**

```
For each tier:
  For each term that appears in >= 5 events:
    1. Collect all events containing this term
    2. meanOutcome = mean(outcomeScores for events with this term)
    3. globalMean = mean(all outcome scores for this tier)
    4. termQuality = (meanOutcome - globalMean) / stddev(allOutcomes)
       → Z-score: positive = better than average, negative = worse
    5. Scale to 0–100 for human readability: score = 50 + (z * 15), clamped 0–100
```

**Output shape:**

```typescript
interface TermQualityScores {
  version: string;
  generatedAt: string;
  tiers: {
    [tierId: string]: {
      terms: Record<
        string,
        {
          score: number; // 0–100 (50 = average)
          eventCount: number; // How many events include this term
          trend: number; // Change vs last run (-1 to +1)
        }
      >;
      termCount: number;
      averageScore: number;
    };
  };
}
```

**How it feeds back into the system:**

- `suggestion-engine.ts` `scoreOptions()` adds a `termQuality` component to the score breakdown
- High-quality terms float to top of dropdown ordering
- Low-quality terms sink to bottom (NOT removed — users can still pick them)
- Blending: `finalScore = (curatedScore × curatedWeight) + (termQuality × learnedWeight)`
  - Uses same blend ratios from `constants.ts`

**New API route:** `src/app/api/learning/term-quality/route.ts` (NEW)

- GET handler, same pattern as co-occurrence

**Hook extension:** `use-learned-weights.ts` also fetches `term-quality-scores` key.

**Tests:**

- Term in only high-outcome events → score > 70
- Term in only low-outcome events → score < 30
- Term with < 5 events → excluded (not enough data)
- Verify trend calculation (mock two runs)

---

### Part 6.6 — Threshold Auto-Adjustment (Mechanism 2)

**Effort:** 0.5 days  
**Dependencies:** Part 6.1, Part 6.2

**What:** Find the "knee" in the score-vs-copy-rate curve. The current `TELEMETRY_SCORE_THRESHOLD = 90` is a guess. The real threshold should sit where quality plateaus.

**File:** `src/lib/learning/threshold-discovery.ts` (NEW)

**Algorithm:**

```
1. Bucket events by score: [70-74], [75-79], [80-84], [85-89], [90-94], [95-100]
2. For each bucket: copyRate = count(copied=true) / count(all)
3. Plot buckets: find the "elbow" where copy rate stops increasing significantly
4. Elbow detection:
   - For each bucket i: marginalGain = copyRate[i+1] - copyRate[i]
   - Threshold = first bucket where marginalGain < 0.02 (2% improvement)
5. Safety bounds: threshold must be between 70 and 95 (never too low, never too high)
6. Smoothing: new threshold = 0.7 × previous + 0.3 × discovered (no sudden jumps)
```

**Output:** Single number per tier, stored in the `scoring-weights` JSON as `threshold` field per tier.

**Effect:** The telemetry quality gate uses this instead of the static `90`. Events below the learned threshold don't enter the learning pipeline. This means the system can lower its standards if users are getting value from 85-rated prompts, or raise them if 90 isn't high enough.

**Tests:**

- Linear copy rate → no elbow, threshold stays at minimum (70)
- Clear elbow at 85 → threshold = 85
- Safety bounds: calculated 65 → clamped to 70
- Smoothing: previous 90, discovered 80 → new = 87

---

### Part 6.7 — Scorer Health Report (Mechanism: Meta-Loop)

**Effort:** 0.5 days  
**Dependencies:** Parts 6.2, 6.4, 6.5

**What:** Measure whether the scorer is actually improving. The meta-loop scores the scorer itself.

**File:** `src/lib/learning/scorer-health.ts` (NEW)

**Metrics computed:**

```typescript
interface ScorerHealthReport {
  version: string;
  generatedAt: string;

  /** Score-outcome correlation (Pearson r across all events) */
  overallCorrelation: number;

  /** Per-tier correlations */
  tierCorrelations: Record<string, number>;

  /** Month-over-month correlation change */
  correlationTrend: number; // positive = improving

  /** Weight stability (how much weights shifted this run) */
  weightDrift: number; // 0 = stable, 1 = complete overhaul

  /** Events processed */
  eventCount: number;

  /** Per-tier event counts */
  tierEventCounts: Record<string, number>;

  /** Alert flags */
  alerts: Array<{
    level: 'info' | 'warning' | 'critical';
    message: string;
  }>;

  /** History (last 30 runs) */
  history: Array<{
    date: string;
    correlation: number;
    eventCount: number;
    weightDrift: number;
  }>;
}
```

**Alert triggers:**

- Correlation drops > 0.05 month-over-month → `warning`: "Score-outcome correlation declining"
- Correlation < 0.20 → `critical`: "Scorer has near-zero predictive value"
- Weight drift > 0.5 → `warning`: "Significant weight recalibration detected"
- Any tier with < 50 events → `info`: "Tier {N} has insufficient data for reliable weights"
- Correlation improving steadily → `info`: "Scorer is learning effectively (+{N}% this month)"

**Storage:** `scorer-health-report` key in `learned_weights` table.

**Tests:**

- Improving correlation → positive trend
- Declining correlation → warning alert
- Zero events → critical alert
- History capped at 30 entries

---

### Part 6.8 — Cron Integration (Wire Everything Together)

**Effort:** 1 day  
**Dependencies:** Parts 6.1–6.7

**What:** Extend the existing nightly aggregation cron to run Phase 6 computations after Phase 5's layers.

**File modified:** `src/app/api/learning/aggregate/route.ts`

**New layers added to the cron (after existing Layer 1–3):**

```
Layer 4: Weight Recalibration    → scoring-weights JSON
Layer 5: Category Value Discovery → included in scoring-weights JSON
Layer 6: Term Quality Scores     → term-quality-scores JSON
Layer 7: Threshold Discovery     → included in scoring-weights JSON
Layer 8: Scorer Health Report    → scorer-health-report JSON
```

**Execution order matters:**

1. Layers 4, 5, 6 can run in parallel (all read from `prompt_events`, none depend on each other's output)
2. Layer 7 reads results from Layer 4 (needs previous threshold for smoothing)
3. Layer 8 reads results from Layers 4–7 (computes health metrics)

**Performance budget:** Current cron runs in ~15s of the 55s timeout. Phase 6 adds ~5–10s (mostly DB reads, arithmetic is trivial). Total: ~25s — well within budget.

**Cron response extension:**

```typescript
interface AggregationCronResponse {
  // ... existing fields ...

  // Phase 6 additions
  scoringWeightsGenerated: boolean;
  termQualityGenerated: boolean;
  scorerHealthCorrelation: number;
  phase6DurationMs: number;
}
```

**Rollout safety:**

- Feature flag: `PHASE_6_SCORING_ENABLED` env var (default: false)
- When false: cron skips Layers 4–8 entirely
- When true: runs all layers, stores results
- Frontend reads learned weights only if they exist (fallback to static)
- Zero risk to existing functionality

---

## 5. File Impact Map

### New Files (10)

| File                                                      | Part | Purpose                                          |
| --------------------------------------------------------- | ---- | ------------------------------------------------ |
| `src/lib/learning/outcome-score.ts`                       | 6.1  | Pure function: outcome signals → composite score |
| `src/lib/learning/weight-recalibration.ts`                | 6.2  | Pearson correlation → per-tier factor weights    |
| `src/lib/learning/category-value-discovery.ts`            | 6.4  | Category → outcome value per tier                |
| `src/lib/learning/term-quality-scoring.ts`                | 6.5  | Term → quality score per tier                    |
| `src/lib/learning/threshold-discovery.ts`                 | 6.6  | Score-vs-copy-rate elbow detection               |
| `src/lib/learning/scorer-health.ts`                       | 6.7  | Meta-loop: correlation trend monitoring          |
| `src/app/api/learning/scoring-weights/route.ts`           | 6.3  | GET endpoint for scoring weights JSON            |
| `src/app/api/learning/term-quality/route.ts`              | 6.5  | GET endpoint for term quality JSON               |
| `src/lib/learning/__tests__/outcome-score.test.ts`        | 6.1  | Unit tests                                       |
| `src/lib/learning/__tests__/weight-recalibration.test.ts` | 6.2  | Unit tests                                       |

### Modified Files (6)

| File                                                       | Part | Change                                                  |
| ---------------------------------------------------------- | ---- | ------------------------------------------------------- |
| `src/lib/prompt-intelligence/engines/integration.ts`       | 6.3  | `calculateHealthScore()` accepts + uses learned weights |
| `src/lib/prompt-optimizer.ts`                              | 6.3  | Uses learned weights for quality assessment             |
| `src/hooks/use-learned-weights.ts`                         | 6.3  | Fetch `scoring-weights` + `term-quality-scores` keys    |
| `src/lib/learning/constants.ts`                            | 6.3  | New storage key constants, static default weights       |
| `src/app/api/learning/aggregate/route.ts`                  | 6.8  | Layers 4–8 added                                        |
| `src/lib/prompt-intelligence/engines/suggestion-engine.ts` | 6.5  | Term quality component in `scoreOptions()`              |

### Untouched Files

| File                                           | Reason                                                         |
| ---------------------------------------------- | -------------------------------------------------------------- |
| `src/types/prompt-telemetry.ts`                | Already has outcome signals + scoreFactors — no changes needed |
| `src/lib/learning/database.ts`                 | Already has `upsertLearnedWeights()` — reuse as-is             |
| `src/lib/telemetry/prompt-telemetry-client.ts` | Already sends all required data — no changes needed            |
| `src/lib/learning/co-occurrence.ts`            | Phase 5 layer, untouched                                       |
| `src/data/platform-tiers.ts`                   | Tier definitions unchanged                                     |

---

## 6. Build Order + Day Allocation

| Day       | Part(s)   | What                                                | Deliverables                                                                                   |
| --------- | --------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Day 1** | 6.1       | Outcome score function + tests                      | `outcome-score.ts`, tests passing                                                              |
| **Day 2** | 6.2       | Weight recalibration engine + tests                 | `weight-recalibration.ts`, tests passing                                                       |
| **Day 3** | 6.3       | Per-tier integration (scorer reads learned weights) | Modified `integration.ts`, `use-learned-weights.ts`, new API route. `npx tsc --noEmit` passing |
| **Day 4** | 6.4 + 6.5 | Category value discovery + term quality scores      | Both engines + tests + API route                                                               |
| **Day 5** | 6.6 + 6.7 | Threshold discovery + scorer health report          | Both engines + tests                                                                           |
| **Day 6** | 6.8       | Cron wiring + end-to-end verification               | Aggregate route extended, feature flag, deploy                                                 |

---

## 7. Verification Protocol (per Part)

Every part follows this sequence before moving to the next:

```powershell
# PowerShell, repo root: frontend

# 1. Type check
pnpm run typecheck

# 2. Lint
pnpm run lint

# 3. Unit tests for the part
pnpm vitest run src/lib/learning/__tests__/<test-file>.test.ts

# 4. Full test suite (catch regressions)
pnpm vitest run

# 5. Local dev server (smoke test)
pnpm dev
# → Open http://localhost:3000
# → Build a prompt, verify health score still displays
# → Check console for no errors
```

**What "good" looks like per part:**

- Part 6.1: `outcome-score.test.ts` — all 6+ test cases green
- Part 6.2: `weight-recalibration.test.ts` — Pearson r values match hand-calculated expectations
- Part 6.3: Health score unchanged when no learned weights exist (regression). Different when learned weights injected
- Part 6.4: Category values positive for subject/style, near-zero for rarely-used categories
- Part 6.5: Term quality scores: "cinematic" > 50 (popular term), obscure terms < 50
- Part 6.6: Threshold within 70–95 bounds, smoothing verified
- Part 6.7: Health report includes correlation, trend, alerts
- Part 6.8: Cron response includes Phase 6 fields, feature flag respected

---

## 8. Rollout Strategy

```
Phase A — Build (Days 1–6):
  Feature flag OFF. Code deployed but inert.
  Existing scorer unchanged.

Phase B — Shadow Mode (Days 7–14):
  Feature flag ON. Cron runs Phase 6 layers.
  learned_weights table gets populated.
  Frontend still uses STATIC defaults (flag in hook).

Phase C — Gradual Blend (Day 15+):
  Frontend reads learned weights.
  Blend ratio starts at 90% static / 10% learned.
  Monitor scorer health report.
  Increase learned weight as correlation improves.

Phase D — Full Learned (once correlation > 0.40):
  Blend ratio follows BLEND_RATIOS from constants.ts.
  Static defaults only used as cold-start fallback.
```

---

## 9. Risk Register

| Risk                                      | Likelihood   | Impact | Mitigation                                                                             |
| ----------------------------------------- | ------------ | ------ | -------------------------------------------------------------------------------------- |
| Insufficient data (< 100 events per tier) | High (early) | Low    | Cold start guard: falls back to static defaults. No degradation.                       |
| Correlation near zero (scorer useless)    | Medium       | Medium | `scorer-health-report.json` flags this as critical. Manual review triggered.           |
| Weight oscillation (flips each run)       | Low          | Medium | Smoothing: `newWeight = 0.7 × previous + 0.3 × discovered`. Min floor 0.02.            |
| Cron timeout (too slow)                   | Low          | Medium | Phase 6 is pure arithmetic on ~100KB of data. Budget: 10s max.                         |
| Breaking existing health scores           | Medium       | High   | Feature flag. Static defaults as fallback. Regression tests.                           |
| Gaming (bots inflating telemetry)         | Low          | Medium | Quality gates (score ≥ 90, 4+ categories) already filter junk. Rate limiting in place. |

---

## 10. Success Metrics

| Metric                                   | Baseline (static)          | Target (Phase 6 mature)               |
| ---------------------------------------- | -------------------------- | ------------------------------------- |
| Score-outcome correlation                | Unknown (~0.10 estimated)  | > 0.40                                |
| Month-over-month correlation improvement | 0                          | Positive for first 3 months           |
| Weight stability after Month 3           | N/A                        | Drift < 0.10 per run                  |
| Per-tier divergence                      | 0 (all tiers same weights) | Each tier has distinct weight profile |
| Term quality coverage                    | 0 terms scored             | 80%+ of vocabulary terms scored       |

---

## 11. What This Does NOT Include

These are explicitly Phase 7 or later:

- Admin Command Centre UI (`/admin/scoring-health`) → Phase 7.10
- User feedback widget (👍👌👎) → Phase 7.10
- A/B testing pipeline → Phase 7.6
- Anti-pattern detection → Phase 7.1
- Magic combos → Phase 7.4
- Temporal intelligence → Phase 7.8
- Prompt compression intelligence → Phase 7.9

Phase 6 builds the **engine**. Phase 7 builds the **dashboard** and additional learning dimensions.

---

## 12. Design Constraint for Phase 7.10 (Feedback Widget)

**Hard requirement:** The three-point feedback scale (great / okay / poor) **must** include explanatory text or tooltips so users understand the middle option means "mediocre, not impressive" — not a second positive. If users misread 👌 as approval rather than "meh," the outcome data feeding Phase 6's weight recalibration is corrupted and the scorer learns from noise.

Options to evaluate when building Phase 7.10:

- Tooltip on each button explaining what it means
- Short label text beneath each icon (e.g. "Nailed it" / "Just okay" / "Missed")
- Use words as the primary UI with 👍👌👎 icons secondary

The data schema (`'great' | 'okay' | 'poor'`) is unaffected — this is purely a presentation concern, but it directly impacts data quality for the entire self-improving scorer pipeline.
