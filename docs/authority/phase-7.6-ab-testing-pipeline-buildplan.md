# Phase 7.6 — A/B Testing the Scoring Model

## Build Plan

**Authority:** `docs/authority/prompt-builder-evolution-plan-v2.md` § 7.6
**Effort:** 2 days across 6 parts (7.6a–f)
**Depends on:** Phase 5 (telemetry pipeline, prompt_events), Phase 6 (weight recalibration, outcome scores)
**Feature gate:** `PHASE_7_AB_TESTING_ENABLED` env var (default: false)

---

## § 1. What This Phase Does

Split-test scoring model changes before committing them. Serves 50% of users the current model (control) and 50% a new model (variant). Measures which group produces higher copy/save/reuse rates over 7 days. If the variant wins with p < 0.05, auto-promotes. If it loses, auto-rollbacks.

**What this enables (from evolution plan):**

- Risk-free deployment of scoring weight changes
- Data-driven validation: every weight change earns its place
- "3 tests ran, 2 promoted, 1 rolled back. Net improvement: +2.3% copy rate."
- Admin Command Centre section for live test visibility
- Foundation for future A/B testing of any scoring dimension (not just weights)

**Why this matters:**

Phase 6 proposes weight changes nightly via correlation analysis. Currently, these changes are applied directly — if a recalibration is wrong, every user is affected until the next nightly run. Phase 7.6 wraps this in a test: propose → test for 7 days → promote only if statistically validated. Bad recalibrations are caught and rolled back automatically.

---

## § 2. Architecture

### Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      NIGHTLY CRON (03:00 UTC)               │
│                                                             │
│  Layer 4 (weight-recalibration) produces PROPOSED weights   │
│       ↓                                                     │
│  Layer 15 (AB test manager):                                │
│    1. Compare proposed weights vs current live weights       │
│    2. If delta > CHANGE_THRESHOLD → create new A/B test     │
│    3. Evaluate any running tests that reached 7 days:        │
│       - Compute outcome rates (copy/save) per variant       │
│       - Run Z-test for proportions                          │
│       - If p < 0.05 and variant wins → auto-promote         │
│       - If p < 0.05 and variant loses → auto-rollback       │
│       - If p >= 0.05 → extend test (or rollback if >14d)    │
│    4. Write results to learned_weights (key: 'ab-tests')    │
└─────────────────────────────────────────────────────────────┘
         ↕                                 ↕
┌─────────────────┐             ┌─────────────────────────┐
│  GET /api/       │             │    Frontend (client)     │
│  learning/       │             │                         │
│  ab-assignment   │             │  useLearningData()      │
│                  │◄────────────│  → fetches assignment   │
│  Returns:        │             │  → applies variant      │
│  { testId,       │             │    weights to scoring   │
│    variant,      │             │                         │
│    weights }     │             │  Telemetry events now   │
│                  │             │  include abHash +       │
│                  │             │  activeTestId + variant  │
└─────────────────┘             └─────────────────────────┘
```

### User Identity for Stable Assignment

The telemetry system is privacy-first — no user IDs, no cookies. For A/B consistency across sessions, we introduce an **anonymous browser hash** (`abHash`):

- **Generation:** `crypto.randomUUID()` stored in `localStorage` (persists across sessions and tabs)
- **Fallback:** If localStorage blocked → use `sessionId` (re-randomised per tab, acceptable degradation)
- **Assignment:** Deterministic hash: `fnv1a(abHash + testId) % 100 < 50` → control, else variant
- **GDPR safe:** Opaque random UUID, cannot be linked to a person. Not PII.
- **Telemetry:** New optional fields `abHash`, `activeTestId`, `variant` on `PromptTelemetryEvent`

### Statistical Testing

**Method:** Two-proportion Z-test on the binary "copied" outcome (highest-signal action).

```
p̂_control  = copies_control / events_control
p̂_variant  = copies_variant / events_variant
p̂_pooled   = (copies_control + copies_variant) / (events_control + events_variant)

z = (p̂_variant - p̂_control) / sqrt(p̂_pooled × (1 - p̂_pooled) × (1/n_control + 1/n_variant))

p_value = 2 × (1 - Φ(|z|))    // two-tailed
```

**Decision rules:**

- `p < 0.05` and variant copy rate higher → **promote** (replace live weights with variant)
- `p < 0.05` and control copy rate higher → **rollback** (discard variant weights)
- `p >= 0.05` and test age < 14 days → **extend** (keep running, need more data)
- `p >= 0.05` and test age ≥ 14 days → **rollback** (inconclusive = not worth the change)

**Minimum sample size:** 200 events per variant before evaluation begins (prevents early noise from triggering decisions).

---

## § 3. Data Model

### `ab_tests` table (new)

| Column            | Type        | Description                                    |
| ----------------- | ----------- | ---------------------------------------------- |
| id                | TEXT PK     | `ab_` + UUID                                   |
| name              | TEXT        | Human label, e.g. "coherence_weight_increase"  |
| status            | TEXT        | `running` / `promoted` / `rolled_back`         |
| control_weights   | JSONB       | SCORE_WEIGHTS snapshot at test creation        |
| variant_weights   | JSONB       | Proposed new weights from recalibration        |
| split_pct         | SMALLINT    | Variant percentage (default 50)                |
| min_events        | INT         | Min events per group before evaluation (200)   |
| max_duration_days | SMALLINT    | Auto-rollback if still running after this (14) |
| started_at        | TIMESTAMPTZ | When the test began                            |
| ended_at          | TIMESTAMPTZ | When promoted/rolled back (null while running) |
| result_summary    | JSONB       | { controlRate, variantRate, zScore, pValue }   |
| created_at        | TIMESTAMPTZ | DEFAULT NOW()                                  |

**Index:** `idx_ab_tests_status` ON (status) WHERE status = 'running'

### `ab_test_assignments` — NOT a table

Assignment is **stateless** and **deterministic**: `fnv1a(abHash + testId) % 100`. No assignment table needed. This avoids millions of rows and simplifies everything — the assignment is computed on-the-fly from the hash.

### Telemetry event additions (backward-compatible optional fields)

| Field         | Type              | Description                         |
| ------------- | ----------------- | ----------------------------------- |
| abHash        | string (opt.)     | Stable anonymous browser UUID       |
| activeTestId  | string (opt.)     | ID of the running A/B test (if any) |
| activeVariant | 'A' \| 'B' (opt.) | Which variant this event belongs to |

These are added to `PromptTelemetryEvent` as optional fields. Events without them are excluded from A/B analysis but still feed the normal learning pipeline.

---

## § 4. Data Flow

```
╔═══════════════╗    optional fields    ╔════════════════╗
║   Frontend    ║───────────────────────║  prompt_events ║
║ abHash,       ║    telemetry POST     ║  (existing)    ║
║ testId,       ║                       ║  + ab_hash     ║
║ variant       ║                       ║  + test_id     ║
╚═══════════════╝                       ║  + variant     ║
                                        ╚════════════════╝
                                               │
              Nightly cron reads events        │
              where test_id IS NOT NULL        ▼
        ╔═══════════════════════════════════════════╗
        ║  Layer 15: A/B Test Evaluation            ║
        ║                                           ║
        ║  1. Group events by (test_id, variant)    ║
        ║  2. Compute copy rate per group           ║
        ║  3. Run Z-test                            ║
        ║  4. Decide: promote / rollback / extend   ║
        ╚═══════════════════════════════════════════╝
                           │
              Update ab_tests status + result_summary
                           │
              If promoted → update learned_weights
              'scoring-weights' with variant weights
```

---

## § 5. File Map

### New Files

| File                                           | Part | Purpose                               |
| ---------------------------------------------- | ---- | ------------------------------------- |
| `lib/learning/ab-testing.ts`                   | 7.6b | Core engine: create, evaluate, decide |
| `lib/learning/ab-assignment.ts`                | 7.6a | FNV-1a hash, deterministic split      |
| `lib/learning/__tests__/ab-testing.test.ts`    | 7.6b | Engine tests                          |
| `lib/learning/__tests__/ab-assignment.test.ts` | 7.6a | Hash distribution + determinism tests |
| `app/api/learning/ab-assignment/route.ts`      | 7.6d | GET → returns active test + variant   |
| `hooks/use-ab-test.ts`                         | 7.6e | Client hook for variant assignment    |
| `lib/telemetry/ab-hash.ts`                     | 7.6a | localStorage-based stable hash gen    |

### Modified Files

| File                                                   | Part | Change                                 |
| ------------------------------------------------------ | ---- | -------------------------------------- |
| `lib/learning/constants.ts`                            | 7.6a | A/B testing constants                  |
| `lib/learning/database.ts`                             | 7.6c | `ab_tests` table DDL + CRUD functions  |
| `types/prompt-telemetry.ts`                            | 7.6a | Optional abHash/testId/variant fields  |
| `lib/telemetry/prompt-telemetry-client.ts`             | 7.6e | Include abHash + active test in events |
| `app/api/learning/aggregate/route.ts`                  | 7.6d | Layer 15 integration                   |
| `app/api/prompt-telemetry/route.ts`                    | 7.6c | Accept + store new optional fields     |
| `hooks/use-learning-data.ts`                           | 7.6e | Compose use-ab-test into facade        |
| `lib/prompt-intelligence/engines/suggestion-engine.ts` | 7.6f | Apply variant weights when active      |
| `components/providers/prompt-builder.tsx`              | 7.6f | Pass variant weights to scoring        |

---

## § 6. Build Parts

### Part 7.6a — Constants + Assignment Engine + Hash Utility (0.25d)

**Goal:** Foundation types, deterministic assignment, and client-side hash generation.

**New file: `lib/learning/ab-assignment.ts`**

```typescript
/**
 * FNV-1a hash for deterministic A/B assignment.
 * Pure function: same input always gives same bucket.
 * No crypto dependency — FNV-1a is fast, well-distributed, deterministic.
 */
export function fnv1aHash(input: string): number { ... }

/**
 * Determine variant for a user+test combination.
 * @param abHash — Stable anonymous browser UUID
 * @param testId — A/B test identifier
 * @param splitPct — Variant percentage (default 50)
 * @returns 'A' (control) or 'B' (variant)
 */
export function assignVariant(
  abHash: string,
  testId: string,
  splitPct?: number,
): 'A' | 'B' { ... }
```

**New file: `lib/telemetry/ab-hash.ts`**

```typescript
/** localStorage key for persistent anonymous hash */
const AB_HASH_KEY = 'promagen_ab_hash';

/**
 * Get or create a stable anonymous hash for A/B assignment.
 * - Persisted in localStorage (survives sessions)
 * - Falls back to sessionId if localStorage blocked
 * - Returns null on server (SSR guard)
 */
export function getAbHash(): string | null { ... }
```

**Modified: `lib/learning/constants.ts`**

Add to `LEARNING_CONSTANTS`:

```typescript
// ── A/B Testing (Phase 7.6) ─────────────────────────────────────────
/** Minimum weight delta (sum of absolute differences) to trigger a new A/B test.
 *  Below this threshold, weight changes are applied directly (too small to test). */
AB_CHANGE_THRESHOLD: 0.05,

/** Default split: 50% control, 50% variant */
AB_DEFAULT_SPLIT_PCT: 50,

/** Minimum events per variant before evaluation begins */
AB_MIN_EVENTS_PER_VARIANT: 200,

/** Default test duration in days */
AB_DEFAULT_DURATION_DAYS: 7,

/** Maximum test duration — auto-rollback if inconclusive after this */
AB_MAX_DURATION_DAYS: 14,

/** p-value threshold for statistical significance */
AB_SIGNIFICANCE_THRESHOLD: 0.05,
```

**Modified: `types/prompt-telemetry.ts`**

Add optional fields to `PromptTelemetryEvent`:

```typescript
/** Stable anonymous browser hash for A/B test assignment (localStorage UUID) */
abHash?: string;
/** Active A/B test ID (null if no test running) */
activeTestId?: string;
/** Which variant this event belongs to: A=control, B=variant */
activeVariant?: 'A' | 'B';
```

Add optional Zod validators (`.optional()`) for all three.

**Tests: `lib/learning/__tests__/ab-assignment.test.ts`**

1. `fnv1aHash` produces consistent output for same input
2. `fnv1aHash` produces different output for different inputs
3. `assignVariant` returns 'A' or 'B' deterministically
4. `assignVariant` distribution is roughly 50/50 across 10,000 random hashes
5. Same abHash + testId always returns same variant
6. Different testId flips some users (not all stuck in same bucket)

**Verification:**

```powershell
pnpm run typecheck
pnpm test -- --testPathPattern="ab-assignment"
```

---

### Part 7.6b — A/B Test Engine (0.5d)

**Goal:** Core pure-computation engine: test creation, evaluation, and decision-making.

**New file: `lib/learning/ab-testing.ts`**

```typescript
// Types
export interface ABTest {
  id: string;
  name: string;
  status: 'running' | 'promoted' | 'rolled_back';
  controlWeights: Record<string, number>;
  variantWeights: Record<string, number>;
  splitPct: number;
  minEvents: number;
  maxDurationDays: number;
  startedAt: string;
  endedAt: string | null;
  resultSummary: ABTestResult | null;
}

export interface ABTestResult {
  controlEvents: number;
  variantEvents: number;
  controlCopyRate: number;
  variantCopyRate: number;
  controlSaveRate: number;
  variantSaveRate: number;
  zScore: number;
  pValue: number;
  decision: 'promote' | 'rollback' | 'extend';
  reason: string;
}

export interface ABTestEventCounts {
  controlEvents: number;
  variantEvents: number;
  controlCopies: number;
  variantCopies: number;
  controlSaves: number;
  variantSaves: number;
}

/**
 * Decide whether proposed weight changes warrant a new A/B test.
 * Returns null if delta is below threshold.
 */
export function shouldCreateTest(
  currentWeights: Record<string, number>,
  proposedWeights: Record<string, number>,
): { name: string; delta: number } | null { ... }

/**
 * Two-proportion Z-test.
 * Returns z-score and two-tailed p-value.
 */
export function twoProportionZTest(
  successes1: number, n1: number,
  successes2: number, n2: number,
): { zScore: number; pValue: number } { ... }

/**
 * Evaluate a running A/B test given event counts.
 * Returns the decision with reasoning.
 */
export function evaluateTest(
  test: ABTest,
  counts: ABTestEventCounts,
  now?: Date,
): ABTestResult { ... }

/**
 * Create a new A/B test definition.
 * Pure factory — does not write to DB.
 */
export function createABTest(
  name: string,
  controlWeights: Record<string, number>,
  variantWeights: Record<string, number>,
): ABTest { ... }
```

**Key algorithm: `twoProportionZTest`**

Implements the Z-test formula from § 2. Uses the standard normal CDF approximation (Abramowitz & Stegun) — no external stats library needed. ~20 lines of arithmetic.

**Decision logic in `evaluateTest`:**

1. If either group has < `minEvents` → `extend` ("Insufficient data")
2. Compute Z-test on copy rates
3. If `pValue < 0.05`:
   - Variant copy rate > control → `promote`
   - Control copy rate > variant → `rollback`
4. If `pValue >= 0.05`:
   - Test age < `maxDurationDays` → `extend`
   - Test age ≥ `maxDurationDays` → `rollback` ("Inconclusive after max duration")

**Tests: `lib/learning/__tests__/ab-testing.test.ts`**

1. `shouldCreateTest` returns null for small deltas
2. `shouldCreateTest` returns test name for large deltas
3. `twoProportionZTest` returns z ≈ 0 for identical rates
4. `twoProportionZTest` returns significant p for large difference
5. `evaluateTest` extends when insufficient data
6. `evaluateTest` promotes when variant wins significantly
7. `evaluateTest` rolls back when control wins significantly
8. `evaluateTest` extends when inconclusive and under max duration
9. `evaluateTest` rolls back when inconclusive and over max duration
10. `createABTest` produces valid test object with correct defaults

**Verification:**

```powershell
pnpm test -- --testPathPattern="ab-testing"
```

---

### Part 7.6c — Database Layer (0.3d)

**Goal:** DDL for `ab_tests` table + CRUD functions + migration of `prompt_events` to accept A/B fields.

**Modified: `lib/learning/database.ts`**

New functions:

```typescript
/** Create ab_tests table */
export async function ensureABTestsTable(): Promise<void> { ... }

/** Insert a new A/B test */
export async function insertABTest(test: ABTest): Promise<void> { ... }

/** Get the currently running A/B test (at most one) */
export async function getRunningABTest(): Promise<ABTest | null> { ... }

/** Get all A/B tests (for admin) ordered by created_at desc */
export async function getAllABTests(limit?: number): Promise<ABTest[]> { ... }

/** Update test status, endedAt, and resultSummary */
export async function updateABTestResult(
  testId: string,
  status: 'promoted' | 'rolled_back',
  resultSummary: ABTestResult,
): Promise<void> { ... }

/** Count events per variant for a running test */
export async function countABTestEvents(
  testId: string,
): Promise<ABTestEventCounts> { ... }
```

**prompt_events migration:** Add three nullable columns:

```sql
ALTER TABLE prompt_events ADD COLUMN IF NOT EXISTS ab_hash TEXT;
ALTER TABLE prompt_events ADD COLUMN IF NOT EXISTS test_id TEXT;
ALTER TABLE prompt_events ADD COLUMN IF NOT EXISTS variant TEXT;

CREATE INDEX IF NOT EXISTS idx_prompt_events_ab_test
ON prompt_events (test_id, variant) WHERE test_id IS NOT NULL;
```

Run in `ensureAllTables()` alongside existing table creation.

**Modified: `app/api/prompt-telemetry/route.ts`**

Accept and store the three new optional fields. Backward compatible — old events without these fields still insert fine (columns default to NULL).

**Design constraint:** At most ONE test can be `status = 'running'` at a time. Enforced in application logic (check before insert), not as a DB constraint, to allow concurrent reads.

**Verification:**

```powershell
pnpm run typecheck
```

---

### Part 7.6d — Cron Layer 15 + GET Route (0.35d)

**Goal:** Wire A/B test evaluation into the nightly cron and expose assignment via GET API.

**Modified: `app/api/learning/aggregate/route.ts`**

Add Layer 15 after Layer 14b:

```
Layer 15: A/B Test Management (Phase 7.6)
  15a. Get running test (if any)
  15b. If running test exists:
       - Count events per variant (countABTestEvents)
       - Evaluate test (evaluateTest)
       - If promote → update live weights + update test status
       - If rollback → update test status (live weights unchanged)
       - If extend → no-op (test continues)
  15c. If no running test:
       - Compare Layer 4 proposed weights vs current live weights
       - If delta > threshold → create new A/B test
       - Store variant weights in the test, keep live weights as control
  15d. Write test summary to phase76 in cron result
```

**Execution gating:** `PHASE_7_AB_TESTING_ENABLED` env var. When disabled, Layer 4 weights are applied directly (current behaviour). When enabled, weight changes go through the A/B pipeline.

**Key safety:** If A/B testing is enabled but a test is already running, the cron does NOT create a new test — it evaluates the existing one. Only one test at a time.

**New route: `app/api/learning/ab-assignment/route.ts`**

```typescript
// GET /api/learning/ab-assignment?abHash=<hash>
//
// Returns:
// - If a test is running: { testId, variant: 'A'|'B', weights: {...} }
// - If no test running: { testId: null, variant: null, weights: null }
//
// The client uses this to know which scoring weights to apply.
// Cached in learned_weights (key: 'ab-active-test') for fast reads.
```

**Caching:** The running test definition is cached in `learned_weights` table (key: `ab-active-test`) as JSON. The GET route reads this cached value — no complex query needed. Updated by the cron when a test starts/ends.

**Verification:**

```powershell
pnpm run typecheck
```

---

### Part 7.6e — Client Integration: Hook + Telemetry (0.35d)

**Goal:** Client-side hook for fetching variant assignment and injecting A/B data into telemetry events.

**New file: `hooks/use-ab-test.ts`**

```typescript
export interface UseABTestReturn {
  /** Active A/B test ID (null if none running) */
  activeTestId: string | null;
  /** Assigned variant: 'A' (control) or 'B' (variant), null if no test */
  variant: 'A' | 'B' | null;
  /** Variant-specific weight overrides (null = use default weights) */
  variantWeights: Record<string, number> | null;
  /** Whether the assignment fetch is loading */
  isLoading: boolean;
}

/**
 * Hook for A/B test variant assignment.
 *
 * 1. Reads/creates abHash from localStorage
 * 2. Fetches /api/learning/ab-assignment?abHash=<hash>
 * 3. Returns variant assignment + weight overrides
 * 4. Caches assignment in module-level variable (same pattern as other hooks)
 * 5. Refetches every 10 minutes (test could end mid-session)
 */
export function useABTest(): UseABTestReturn { ... }
```

**Modified: `hooks/use-learning-data.ts`**

Compose `useABTest()` into the facade:

```typescript
// New fields in UseLearningDataReturn:
activeTestId: string | null;
abVariant: 'A' | 'B' | null;
abVariantWeights: Record<string, number> | null;
```

**Modified: `lib/telemetry/prompt-telemetry-client.ts`**

In `buildTelemetryEvent()`, include `abHash`, `activeTestId`, `activeVariant` from the hook state. Since the telemetry client is a plain function (not a hook), these are passed as parameters from `prompt-builder.tsx`.

**Verification:**

```powershell
pnpm run typecheck
pnpm test -- --testPathPattern="use-ab-test"
```

---

### Part 7.6f — Suggestion Engine Integration + Admin Section (0.25d)

**Goal:** Apply variant weights in the scoring engine and surface A/B data in admin.

**Modified: `lib/prompt-intelligence/engines/suggestion-engine.ts`**

The `SCORE_WEIGHTS` constant is currently static. When an A/B test is active, the suggestion engine needs to use variant weights for variant-B users. Approach:

```typescript
// New in BuildContextInput:
abVariantWeights?: Record<string, number> | null;

// In scoreOption(), before using SCORE_WEIGHTS:
const weights = context.abVariantWeights
  ? { ...SCORE_WEIGHTS, ...context.abVariantWeights }
  : SCORE_WEIGHTS;
```

This means variant weights are a **partial override** — they only replace the specific keys that differ. All other weights remain at their curated defaults.

**Modified: `components/providers/prompt-builder.tsx`**

Pass `abVariantWeights` from `useLearningData()` into `reorderByRelevance()`.

**Admin section:** Deferred to Admin Command Centre build. Phase 7.6 stores all data needed for the "A/B Test Results" section described in evolution plan § Admin Section 6. The GET routes provide the data; the UI is a separate deliverable.

**Verification:**

```powershell
pnpm run typecheck
pnpm run lint -- --fix
pnpm test -- --testPathPattern="ab-"
pnpm test -- --testPathPattern="use-learning-data"
```

---

## § 7. Weight Override Mechanics

When no A/B test is running, the scoring engine uses `SCORE_WEIGHTS` (static curated values). When a test IS running:

| User assignment | Weights applied                            |
| --------------- | ------------------------------------------ |
| Control (A)     | Current live weights (= `SCORE_WEIGHTS`)   |
| Variant (B)     | `{ ...SCORE_WEIGHTS, ...variantWeights }`  |
| No abHash       | Default to control (no test participation) |

**Variant weights are partial overlays.** If Phase 6 recalibration proposes changing `coOccurrenceMax` from 20 to 25 and `antiPatternPenalty` from -30 to -35, the variant weights are:

```json
{ "coOccurrenceMax": 25, "antiPatternPenalty": -35 }
```

All other 15+ weight keys remain at their curated `SCORE_WEIGHTS` values.

---

## § 8. Safety Guardrails

1. **One test at a time.** No concurrent tests — prevents interaction effects and simplifies analysis.

2. **Minimum sample size.** 200 events per variant before evaluation. Prevents early noise from triggering false positives.

3. **Maximum duration.** 14-day hard cap. Inconclusive after 14 days → rollback. Prevents tests from running forever.

4. **Change threshold.** Weight delta < 0.05 (sum of absolute differences) → apply directly, don't test. Tiny changes aren't worth the pipeline overhead.

5. **Feature gate.** `PHASE_7_AB_TESTING_ENABLED=false` by default. When disabled, Layer 4 weights apply directly (pre-7.6 behaviour preserved).

6. **Graceful degradation.** If abHash unavailable (localStorage blocked) → user excluded from test (gets control weights). No errors, no broken scoring.

7. **Non-fatal cron layer.** Layer 15 failures don't block Layers 1–14b. A/B testing is observational, not critical path.

---

## § 9. Statistical Notes

### Why Z-test (not t-test or chi-squared)?

The Z-test for two proportions is the standard method for comparing binary outcomes (copied: yes/no) between two groups. With n > 200 per group, the normal approximation is excellent. No external library needed — the CDF can be approximated with 6 lines of code (Abramowitz & Stegun formula 26.2.17).

### Power Analysis

At a 50/50 split with α = 0.05 and 80% power:

- To detect a 5% absolute lift (e.g., 40% → 45% copy rate): ~780 events per group
- To detect a 3% absolute lift: ~2,170 events per group
- To detect a 1% absolute lift: ~19,500 events per group

With Promagen's current traffic, a 7-day test at typical volume should detect a 3–5% lift comfortably. Smaller effects need longer tests (up to the 14-day cap).

### Multiple testing concern

Since only one test runs at a time, and each test evaluates one hypothesis, there's no multiple testing correction needed. If we later support concurrent tests, Bonferroni or Holm-Bonferroni correction would be necessary.

---

## § 10. Verification Checklist

```powershell
# After all parts complete:
pnpm run typecheck                                    # Zero errors
pnpm run lint -- --fix                                # Clean
pnpm test -- --testPathPattern="ab-assignment"        # Hash + assignment tests
pnpm test -- --testPathPattern="ab-testing"           # Engine tests
pnpm test -- --testPathPattern="use-ab-test"          # Hook tests
pnpm test -- --testPathPattern="use-learning-data"    # Facade still works
pnpm test -- --testPathPattern="use-platform-learning" # Existing tests pass
```

**Manual QA:**

1. Set `PHASE_7_AB_TESTING_ENABLED=true` in .env
2. Trigger cron manually → verify test creation (Layer 15 log)
3. Open prompt builder → verify /api/learning/ab-assignment returns valid response
4. Generate prompt events → verify `ab_hash`, `test_id`, `variant` stored in DB
5. After 7+ days with sufficient events → verify auto-promote or rollback in cron log
6. Set `PHASE_7_AB_TESTING_ENABLED=false` → verify Layer 4 weights apply directly

---

## § 11. Phase 7.5 → 7.6 Checklist

- [ ] Phase 7.5 complete (platform learning wired into suggestion engine)
- [ ] Phase 6 complete (weight recalibration producing proposed weights)
- [ ] `PHASE_7_LEARNING_ENABLED=true` working in production
- [ ] Sufficient telemetry volume (1,000+ events in prompt_events)
- [ ] All Phase 7.5 tests passing
- [ ] Build plan reviewed and approved

---

## § 12. Estimated Output Size

| Artefact               | Size                                                     |
| ---------------------- | -------------------------------------------------------- |
| `ab_tests` table       | ~1KB per test (JSON weights are small)                   |
| Per-event overhead     | +3 columns (~60 bytes: ab_hash UUID + test_id + variant) |
| `ab-active-test` cache | ~2KB (one JSON object in learned_weights)                |
| GET response payload   | ~1KB per request                                         |

**Total new storage:** Negligible. ~10 tests/month × 1KB = 10KB/month in ab_tests. Event overhead is ~60 bytes × events (already stored).
