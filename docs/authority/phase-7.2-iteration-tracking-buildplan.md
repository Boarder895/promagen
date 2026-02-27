# Phase 7.2 — Iteration Tracking Build Plan

**Version:** 1.0.0  
**Created:** 26 February 2026  
**Status:** Planning  
**Authority:** `prompt-builder-evolution-plan-v2.md` § 11 (Phase 7.2)  
**Dependencies:** Phase 7.1 (Negative Pattern Learning) — **deployed**  
**Estimated effort:** ~1.5 days across 5 build steps  
**Code standard:** `docs/authority/code-standard.md`  
**Working practice:** `docs/authority/best-working-practice.md`

---

## 1. Goal

The system already knows what works (Phase 5 co-occurrence), what actively kills prompts (Phase 7.1 anti-patterns), and what competes (Phase 7.1 collisions). It does NOT yet know **how users fix their prompts**.

Phase 7.2 closes this gap by analysing sequential attempts within a session:

**Question:** When someone copies a prompt, comes back, changes something, and copies again — what did they change and did it help?

**What this teaches:**

1. **Category fix order** — which categories users change FIRST when fixing → these are the highest-value categories for prompt quality
2. **Score jumps** — which category additions produce the biggest score improvements → recalibrates what matters
3. **Weak terms** — terms that get REPLACED most often across sessions → candidates for dropdown demotion
4. **Final-attempt boost** — the last attempt in a sequence (user doesn't return) is the highest-confidence quality signal → weight 3× in confidence multiplier
5. **Iteration stats** — average iterations per session, trend over time → system health metric (if decreasing, system is improving)

No ML. Same nightly cron infrastructure. Same `learned_weights` table. Same lookup pattern.

---

## 2. What Already Exists (Starting Point Audit)

| Component                                       | Status   | Evidence                                                             |
| ----------------------------------------------- | -------- | -------------------------------------------------------------------- |
| `session_id` on prompt_events                   | ✅ Built | `database.ts` line 42 — `session_id TEXT NOT NULL`                   |
| `attempt_number` on prompt_events               | ✅ Built | `database.ts` line 43 — `attempt_number SMALLINT NOT NULL DEFAULT 1` |
| Composite index on (session_id, attempt_number) | ✅ Built | `database.ts` line 68                                                |
| Session grouping logic (Phase 5 Layer 2)        | ✅ Built | `sequence-patterns.ts` — groups by session, orders by attempt        |
| Client-side session ID (per-tab UUID)           | ✅ Built | `prompt-telemetry-client.ts` line 92 — `getSessionId()`              |
| Client-side attempt counter                     | ✅ Built | `prompt-telemetry-client.ts` line 111 — `getNextAttemptNumber()`     |
| All-events query (no score floor)               | ✅ Built | `database.ts` line 246 — `fetchAllEventsForAntiPatterns()`           |
| Confidence multiplier (tier, age, depth)        | ✅ Built | `outcome-score.ts` — `computeConfidenceMultiplier()`                 |
| Phase 7 feature flag + cron block               | ✅ Built | `aggregate/route.ts` — `PHASE_7_LEARNING_ENABLED`                    |
| Co-occurrence lookup pattern (O(1) Maps)        | ✅ Built | `co-occurrence-lookup.ts` — pattern to replicate                     |

**What this means:** All infrastructure is in place. We need:

1. New constants for Phase 7.2 thresholds
2. One new computation module (iteration analysis engine)
3. One new lookup module (weak term lookup)
4. Extend confidence multiplier with final-attempt factor
5. Cron Layer 11 + API route
6. Suggestion engine integration (weak-term penalty)

**What we do NOT need:**

- ❌ A separate `iteration_sessions` table (the evolution plan mentions this, but `session_id` + `attempt_number` already exist on `prompt_events` — we derive sequences from existing data, which is cleaner and avoids schema migration)

---

## 3. Output File (What the Cron Produces)

New JSON blob stored in the `learned_weights` table:

| Storage Key          | Size Est. | Contents                                                                       | Consumed By                                                                        |
| -------------------- | --------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `iteration-insights` | ~15 KB    | Per-tier session analysis: fix order, score jumps, weak terms, iteration stats | `suggestion-engine.ts` (demote weak terms), `scorer-health.ts` (iteration metrics) |

---

## 4. Key Concepts

### Session Sequence Reconstruction

```
Session "abc-123":
  Attempt 1: { style: ["cyberpunk"], lighting: [] }         → score 45
  Attempt 2: { style: ["cyberpunk"], lighting: ["neon"] }   → score 72  ← added lighting (+27)
  Attempt 3: { style: ["cyberpunk"], lighting: ["neon"], atmosphere: ["foggy"] } → score 81 ← added atmosphere (+9)
  [user never returns → attempt 3 is "final attempt"]

Insights derived:
  - Fix order: lighting was 1st category changed, atmosphere 2nd
  - Score jump: adding lighting → +27, adding atmosphere → +9
  - Final attempt: attempt 3 → weight this outcome 3× in confidence multiplier
  - No term replacements in this session
```

### Term Replacement Detection

```
Session "def-456":
  Attempt 1: { lighting: ["studio lighting"] }   → score 55
  Attempt 2: { lighting: ["golden hour"] }        → score 78  ← replaced "studio lighting" with "golden hour"

Insights derived:
  - "studio lighting" was replaced (weak term candidate)
  - Replacement improved score by +23 → strong signal
  - "golden hour" is the replacement winner
```

### Weak Term Score

```
For term T in tier X:
  replacedCount   = times T was present in attempt N but absent in attempt N+1
  retainedCount   = times T was present in both attempt N and attempt N+1
  replacementRate = replacedCount / (replacedCount + retainedCount)

  // Only flag if:
  // - replacementRate > 0.30 (replaced >30% of the time)
  // - replacedCount >= 5 (enough evidence)

  weaknessScore = clamp(replacementRate / 0.60, 0, 1)
  // 0.30 rate → 0.50 score, 0.60 rate → 1.0 score (very weak)
```

### Final-Attempt Confidence Factor

Added to the existing 3-factor confidence multiplier as a 4th factor:

```
Existing (Phase 7.1a):
  confidenceMultiplier = tierFactor × ageFactor × depthFactor

Phase 7.2 extension:
  confidenceMultiplier = tierFactor × ageFactor × depthFactor × finalAttemptFactor

  finalAttemptFactor:
    - Event is the last attempt in a multi-attempt session: 1.30×
    - Event is in a single-attempt session (only one attempt): 1.00× (no change)
    - Event is NOT the last attempt: 0.85× (less confident — user continued iterating)

  Updated clamp range: 0.50 – 1.50 (widened from 0.60–1.35 to accommodate the boost)
```

**Why 1.30× and not 3×?** The evolution plan says "weight 3× higher." After applying the clamp and multiplication with other factors, the effective boost is roughly 2–3× for a paid veteran's final attempt vs a free user's mid-session attempt. The raw factor of 1.30× achieves the intended effect within the multiplicative system.

### Category Fix Value

```
For category C in tier X:
  firstFixCount = times C was the FIRST category changed in a multi-attempt session
  totalMultiAttemptSessions = sessions with 2+ attempts in this tier

  firstFixRate = firstFixCount / totalMultiAttemptSessions
  avgScoreJump = mean(score deltas when C was added/changed)

  // Higher firstFixRate → users instinctively fix this first → high value
  // Higher avgScoreJump → changes to this category have biggest impact
  fixValue = (firstFixRate × 0.6) + (normalised avgScoreJump × 0.4)
```

---

## 5. Build Steps — Detailed Breakdown

### Part 7.2a — Constants + Confidence Multiplier Extension

**Effort:** 0.25 days  
**Dependencies:** None

**What:** Add Phase 7.2 constants and extend the confidence multiplier with a 4th factor for final-attempt detection.

**Files modified:**

- `src/lib/learning/constants.ts` — ADD new constants
- `src/lib/learning/outcome-score.ts` — EXTEND `ConfidenceInput`, add `finalAttemptFactor`

**New constants:**

```typescript
// ── Phase 7.2 — Iteration Tracking ──────────────────────────────────
/** Storage key for iteration insights data */
ITERATION_INSIGHTS_KEY: 'iteration-insights',

/** Minimum sessions with 2+ attempts before analysis is meaningful */
ITERATION_MIN_MULTI_SESSIONS: 20,

/** Minimum times a term must be replaced before flagging as weak */
ITERATION_MIN_REPLACED_COUNT: 5,

/** Replacement rate threshold for "weak term" (0.30 = replaced 30%+ of the time) */
ITERATION_WEAK_TERM_THRESHOLD: 0.30,

/** Maximum weak terms stored per tier */
ITERATION_MAX_WEAK_TERMS_PER_TIER: 200,

/** Maximum time gap (minutes) between attempts to consider them same session */
ITERATION_SESSION_GAP_MINUTES: 30,

/** Confidence multiplier for final attempt in multi-attempt session */
ITERATION_FINAL_ATTEMPT_FACTOR: 1.30,

/** Confidence multiplier for non-final attempt (user continued iterating) */
ITERATION_MID_ATTEMPT_FACTOR: 0.85,
```

**Confidence multiplier extension:**

Add to `ConfidenceInput`:

```typescript
/** Whether this event is the last attempt in a multi-attempt session */
isFinalAttempt?: boolean | null;
/** Whether this event is part of a multi-attempt session (not a single-shot) */
isMultiAttemptSession?: boolean | null;
```

Add 4th factor to `computeConfidenceMultiplier()`:

```typescript
// Factor 4: Final-attempt signal (Phase 7.2)
let finalAttemptMult = 1.0;
if (input.isMultiAttemptSession) {
  finalAttemptMult = input.isFinalAttempt
    ? LEARNING_CONSTANTS.ITERATION_FINAL_ATTEMPT_FACTOR // 1.30
    : LEARNING_CONSTANTS.ITERATION_MID_ATTEMPT_FACTOR; // 0.85
}
// Single-attempt sessions → 1.0 (no change)

return clamp(tierMult * ageMult * depthMult * finalAttemptMult, 0.5, 1.5);
```

**Test file:** `src/lib/learning/__tests__/confidence-multiplier.test.ts` — ADD 6 new test cases covering:

- Final attempt in multi-session → 1.30×
- Mid attempt in multi-session → 0.85×
- Single-attempt session → 1.0× (unchanged)
- Null flags → 1.0× (backward compatible)
- Combined with paid veteran → clamp at 1.50
- Combined with free newbie mid-attempt → clamp at 0.50

**What "good" looks like:**

- `typecheck` + `lint` pass
- All existing confidence multiplier tests still green
- 6 new tests green
- `computeConfidenceMultiplier({})` still returns 1.0 (backward compat)

---

### Part 7.2b — Iteration Analysis Engine

**Effort:** 0.5 days  
**Dependencies:** Part 7.2a

**What:** The core computation module. Takes ALL prompt events, groups by session, orders by attempt, computes diffs between sequential attempts.

**New file:** `src/lib/learning/iteration-tracking.ts`

**Output type:**

```typescript
export interface WeakTermEntry {
  /** The term that gets replaced frequently */
  term: string;
  /** Category this term belongs to */
  category: string;
  /** Times this term was replaced (present → absent in next attempt) */
  replacedCount: number;
  /** Times this term was retained (present in both attempts) */
  retainedCount: number;
  /** replacedCount / (replacedCount + retainedCount) */
  replacementRate: number;
  /** Normalised weakness score 0–1 (higher = weaker) */
  weaknessScore: number;
  /** Most common replacement term (what users swap it for) */
  topReplacement: string | null;
}

export interface CategoryFixEntry {
  /** Category name */
  category: string;
  /** How often this category was the FIRST one changed in fix sessions */
  firstFixRate: number;
  /** Average score jump when this category is added/changed */
  avgScoreJump: number;
  /** Combined fix value (firstFixRate × 0.6 + normalised avgScoreJump × 0.4) */
  fixValue: number;
}

export interface ScoreJumpEntry {
  /** Category that was changed */
  category: string;
  /** Average score delta when this category changes */
  avgDelta: number;
  /** Number of observations */
  count: number;
}

export interface TierIterationInsights {
  /** Sessions analysed in this tier */
  sessionCount: number;
  /** Sessions with 2+ attempts */
  multiAttemptCount: number;
  /** Average attempts per multi-attempt session */
  avgIterations: number;
  /** Percentage of sessions that required 2+ attempts */
  multiAttemptPercent: number;
  /** Categories users fix first (sorted by fixValue descending) */
  categoryFixOrder: CategoryFixEntry[];
  /** Score impact of category changes (sorted by avgDelta descending) */
  scoreJumps: ScoreJumpEntry[];
  /** Terms with highest replacement rates (sorted by weaknessScore descending) */
  weakTerms: WeakTermEntry[];
  /** Number of events identified as final attempts */
  finalAttemptCount: number;
}

export interface IterationInsightsData {
  version: string;
  generatedAt: string;
  eventCount: number;
  sessionCount: number;
  totalWeakTerms: number;
  tiers: Record<string, TierIterationInsights>;
  global: TierIterationInsights;
}
```

**Algorithm (single pass, efficient):**

```
1. Group events by session_id
2. Within each session, sort by attempt_number
3. Filter: sessions where max_attempt_number - min_attempt_number > 0
   AND time gap between first and last attempt < SESSION_GAP_MINUTES
4. For each pair of consecutive attempts (N, N+1):
   a. Compute selection diff:
      - ADDED: categories/terms in N+1 but not in N
      - REMOVED: terms in N but not in N+1 (same category)
      - RETAINED: terms in both N and N+1
   b. Track which category was changed FIRST (lowest attempt_number where change occurred)
   c. Track score delta = attempt[N+1].score - attempt[N].score
   d. Track term replacements (removed term → what replaced it in same category)
5. Mark final attempt per session (highest attempt_number)
6. Aggregate per tier + global:
   - Category fix order (sorted by firstFixRate)
   - Score jumps per category change
   - Weak terms (replacement rate > threshold, count >= minimum)
   - Final attempt count
   - Average iterations
7. Trim weak terms to MAX_WEAK_TERMS_PER_TIER, sort by weaknessScore desc
```

**Test file:** `src/lib/learning/__tests__/iteration-tracking.test.ts` (NEW — 16+ test cases)

Test cases:

1. Empty events → empty result
2. All single-attempt sessions → 0 multi-attempt, no weak terms
3. Simple 2-attempt session: added lighting → detected as first fix
4. 3-attempt session: correct fix order tracking
5. Term replacement detected (style changed from A to B)
6. Term retained across attempts → NOT flagged as weak
7. Score jump calculated correctly (attempt 2 score - attempt 1 score)
8. Negative score jump tracked (user made it worse)
9. Weak term threshold: replacement rate 0.25 → NOT flagged (below 0.30)
10. Weak term threshold: replacement rate 0.40 → flagged
11. Below MIN_REPLACED_COUNT → NOT flagged
12. Final attempt identification (last in session)
13. Per-tier independence (Tier 1 has weak term, Tier 2 doesn't)
14. Global aggregation across tiers
15. Session gap filter: attempts >30min apart → treated as separate sessions
16. Multiple terms replaced in same category → each tracked separately

**What "good" looks like:**

- Pure function, no I/O
- Same pattern as `anti-pattern-detection.ts`
- 16+ tests green
- Handles edge cases gracefully (empty data, single attempts, time gaps)

---

### Part 7.2c — Weak Term Lookup

**Effort:** 0.15 days  
**Dependencies:** Part 7.2b

**What:** O(1) Map-based lookup for weak term scores. Same pattern as `anti-pattern-lookup.ts`.

**New file:** `src/lib/learning/weak-term-lookup.ts`

```typescript
export interface WeakTermLookup {
  /** Per-tier maps: tier string → (term → WeakTermInfo) */
  tiers: Record<string, Map<string, WeakTermInfo>>;
  /** Global map: term → WeakTermInfo */
  global: Map<string, WeakTermInfo>;
  /** Total events that produced this data */
  eventCount: number;
}

export interface WeakTermInfo {
  /** Weakness score 0–1 */
  weaknessScore: number;
  /** Replacement rate (for display) */
  replacementRate: number;
  /** Most common replacement */
  topReplacement: string | null;
}

/** Build lookup from IterationInsightsData */
export function buildWeakTermLookup(
  data: IterationInsightsData | null | undefined,
): WeakTermLookup | null;

/** Look up weakness score for a single term */
export function lookupWeakTermScore(
  term: string,
  tier: number | null,
  lookup: WeakTermLookup | null,
): number; // 0 = not weak, 1.0 = extremely weak
```

**Tier-first → global fallback** — same pattern as all other lookups.

**Tests:** Covered by integration test in Part 7.2e.

---

### Part 7.2d — Cron Layer 11 + API Route

**Effort:** 0.25 days  
**Dependencies:** Parts 7.2a–c

**What:** Extend the nightly cron with Layer 11 (iteration analysis). Add a GET endpoint.

**File modified:** `src/app/api/learning/aggregate/route.ts`

**New layer:**

```
Layer 11: Iteration Tracking → iteration-insights JSON (Phase 7.2)
```

**Execution order:**

- Layer 11 runs after Layers 9–10 (reuses the same `antiPatternEvents` set — ALL events including low-scoring)
- Layer 11 needs session context, so it processes the full event set
- Gated by the SAME `PHASE_7_LEARNING_ENABLED` env var (no new flag needed)
- Failures are non-fatal (same pattern as Layers 9–10)

**Why reuse antiPatternEvents?** Both iteration tracking and anti-patterns need ALL events (including low-scoring ones), and both need the same 180-day window. No new DB query needed.

**Cron response extension:**

```typescript
interface AggregationCronResponse {
  // ... existing Phase 7.1 fields ...

  // Phase 7.2 additions
  iterationInsightsGenerated: boolean;
  weakTermCount: number;
  multiAttemptSessions: number;
  // phase7DurationMs already covers all Phase 7 layers
}
```

**New API route:** `src/app/api/learning/iteration-insights/route.ts` (NEW)

- GET endpoint, same pattern as `anti-patterns/route.ts`
- Returns stored data from `learned_weights` table (key: `iteration-insights`)
- Cache: 5 minutes (data only changes at 3 AM UTC)

**What "good" looks like:**

- Cron runs Layer 11 when `PHASE_7_LEARNING_ENABLED=true`
- Layer 11 reuses existing event set (no extra DB query)
- Phase 7 errors don't affect Phase 5 or Phase 6 results
- API route returns stored data or empty default
- `typecheck` passes

---

### Part 7.2e — Integration (Suggestion Engine + Confidence + Health)

**Effort:** 0.35 days  
**Dependencies:** Parts 7.2a–d

**What:** Wire weak-term lookup into the suggestion engine, enable final-attempt identification in the cron pipeline, and add iteration stats to the scorer health report.

**Files modified:**

1. `src/lib/prompt-intelligence/types.ts` — ADD `weakTermLookup` to `PromptContext`
2. `src/lib/prompt-intelligence/engines/suggestion-engine.ts` — ADD weak-term penalty
3. `src/hooks/use-learned-weights.ts` — ADD iteration-insights fetch + weak-term lookup build
4. `src/components/providers/prompt-builder.tsx` — Pass `weakTermLookup` through
5. `src/app/api/learning/aggregate/route.ts` — ADD final-attempt identification pass before Layer 9

**Suggestion engine changes:**

New score weight:

```typescript
/** Weak term penalty (from iteration tracking, Phase 7.2).
 *  Demotes terms users frequently replace. Scaled by weaknessScore 0–1. */
weakTermPenalty: -15,   // Moderate — statistical signal, not definitive
```

Score computation:

```
1. Existing scores — unchanged
2. Existing anti-pattern + collision penalties — unchanged
3. NEW: weakTermPenalty = lookupWeakTermScore(candidate, tier, lookup) × -15
4. Total score = sum of all components
```

**Final-attempt identification in cron:**

Before Layers 9–10 run, add a pre-processing pass:

```typescript
// Pre-compute final attempt IDs for confidence multiplier
const finalAttemptIds = identifyFinalAttempts(antiPatternEvents);
// Enrich events with isFinalAttempt flag
const enrichedEvents = antiPatternEvents.map(evt => ({
  ...evt,
  _isFinalAttempt: finalAttemptIds.has(evt.id),
  _isMultiAttempt: /* session has 2+ attempts */,
}));
```

This enrichment feeds into `computeConfidenceMultiplier()` calls in Layers 9, 10, and 11 — improving the quality of ALL Phase 7 computations, not just iteration tracking.

**`identifyFinalAttempts()` helper** (added to `iteration-tracking.ts`):

```typescript
/**
 * Identify final-attempt event IDs across all sessions.
 * A "final attempt" is the highest attempt_number in a session with 2+ attempts.
 * Returns a Set of event IDs.
 */
export function identifyFinalAttempts(events: PromptEventRow[]): Set<string>;

/**
 * Identify multi-attempt session IDs.
 * Returns a Set of session_ids that have 2+ events.
 */
export function identifyMultiAttemptSessions(events: PromptEventRow[]): Set<string>;
```

**Types extension:**

Add to `ScoredOption.breakdown`:

```typescript
/** Penalty from weak term data (Phase 7.2) */
weakTermPenalty?: number;
```

Add to `PromptContext`:

```typescript
/** Pre-built weak term lookup from Phase 7.2 (null = no data) */
weakTermLookup: WeakTermLookup | null;
```

**Test file:** `src/lib/learning/__tests__/iteration-integration.test.ts` (NEW — 14+ test cases)

1. Weak term lookup returns correct score for known weak term
2. Weak term lookup returns 0 for strong term
3. Weak term lookup returns 0 when no data (null lookup)
4. Suggestion engine demotes weak term
5. Suggestion engine unchanged when no data (backward compat)
6. Final-attempt identification: last attempt in 3-attempt session
7. Final-attempt identification: single-attempt → NOT marked
8. Final-attempt identification: empty events → empty set
9. Multi-attempt session identification
10. Confidence multiplier with final-attempt boost
11. Confidence multiplier without iteration data (backward compat)
12. Full round-trip: events → analysis → lookup → penalty
13. Weak term + anti-pattern penalties stack correctly
14. Category fix order sorted by fixValue descending

**What "good" looks like:**

- All 14+ tests green
- Selecting a frequently-replaced term → it drops in suggestion ranking
- NO changes to existing behaviour when Phase 7.2 data doesn't exist
- Confidence multiplier backward compatible (null flags → 1.0)
- `typecheck` + `lint` pass

---

## 6. File Impact Map

### New Files (6)

| File                                                       | Part | Purpose                                       |
| ---------------------------------------------------------- | ---- | --------------------------------------------- |
| `src/lib/learning/iteration-tracking.ts`                   | 7.2b | Pure computation: events → iteration insights |
| `src/lib/learning/weak-term-lookup.ts`                     | 7.2c | O(1) Map lookup for weak term scores          |
| `src/app/api/learning/iteration-insights/route.ts`         | 7.2d | GET endpoint for iteration insights JSON      |
| `src/lib/learning/__tests__/iteration-tracking.test.ts`    | 7.2b | 16+ test cases for iteration engine           |
| `src/lib/learning/__tests__/iteration-integration.test.ts` | 7.2e | 14+ test cases for end-to-end integration     |

### Modified Files (7)

| File                                                       | Part | Changes                                                      |
| ---------------------------------------------------------- | ---- | ------------------------------------------------------------ |
| `src/lib/learning/constants.ts`                            | 7.2a | ADD 8 new constants                                          |
| `src/lib/learning/outcome-score.ts`                        | 7.2a | EXTEND ConfidenceInput + add 4th factor                      |
| `src/lib/learning/__tests__/confidence-multiplier.test.ts` | 7.2a | ADD 6 test cases                                             |
| `src/app/api/learning/aggregate/route.ts`                  | 7.2d | ADD Layer 11, response fields, final-attempt pre-pass        |
| `src/lib/prompt-intelligence/types.ts`                     | 7.2e | ADD weakTermLookup to PromptContext + ScoredOption breakdown |
| `src/lib/prompt-intelligence/engines/suggestion-engine.ts` | 7.2e | ADD weak-term penalty scoring                                |
| `src/hooks/use-learned-weights.ts`                         | 7.2e | ADD iteration-insights fetch + lookup build                  |
| `src/components/providers/prompt-builder.tsx`              | 7.2e | Pass weakTermLookup through to reorderByRelevance            |

### Untouched Files (everything else)

All Phase 5, Phase 6, and Phase 7.1 files remain unchanged. All existing tests continue to pass.

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
pnpm test -- --testPathPattern="<test-file>"

# 4. Full test suite (catch regressions)
pnpm test

# 5. Local dev server (smoke test)
pnpm dev
# → Open http://localhost:3000
# → Build a prompt, verify health score still displays
# → Check console for no errors
```

**What "good" looks like per part:**

- Part 7.2a: `typecheck` + `lint` pass, confidence multiplier tests green (existing + 6 new)
- Part 7.2b: `iteration-tracking.test.ts` — all 16+ green
- Part 7.2c: Lookup builds from test data, O(1) access verified
- Part 7.2d: Cron response includes iteration fields, feature flag respected
- Part 7.2e: `iteration-integration.test.ts` — all 14+ green, backward compat confirmed

---

## 8. Build Order + Day Allocation

| Time            | Part(s) | What                                                | Deliverables                                                    |
| --------------- | ------- | --------------------------------------------------- | --------------------------------------------------------------- |
| **Day 1 AM**    | 7.2a    | Constants + confidence multiplier extension         | Modified `constants.ts`, `outcome-score.ts`. 6 new tests green. |
| **Day 1 AM–PM** | 7.2b    | Iteration analysis engine + tests                   | `iteration-tracking.ts`, 16+ tests passing                      |
| **Day 1 PM**    | 7.2c    | Weak term lookup                                    | `weak-term-lookup.ts`                                           |
| **Day 2 AM**    | 7.2d    | Cron Layer 11 + API route                           | Aggregate route extended, 1 new API route                       |
| **Day 2 PM**    | 7.2e    | Suggestion engine + confidence + health integration | Integration working, 14+ integration tests, full suite green    |

---

## 9. Rollout Strategy

```
Phase A — Build (Day 1–2):
  PHASE_7_LEARNING_ENABLED already exists.
  New Layer 11 code deploys alongside existing Layers 9–10.
  Existing Phase 7.1 behaviour unchanged.

Phase B — Data Accumulation (automatic):
  Next nightly cron run computes iteration insights automatically.
  learned_weights table gets iteration-insights key.
  Frontend picks up weak-term lookup via existing hook.

Phase C — Live Integration:
  Suggestion engine applies weak-term penalties.
  Confidence multiplier applies final-attempt boost.
  Monitor scorer health report for correlation improvement.
```

No new environment variable needed — `PHASE_7_LEARNING_ENABLED=true` gates all Phase 7 layers (9, 10, and 11).

---

## 10. Risk Register

| Risk                                 | Likelihood   | Impact | Mitigation                                                                    |
| ------------------------------------ | ------------ | ------ | ----------------------------------------------------------------------------- |
| Insufficient multi-attempt sessions  | High (early) | Low    | Returns empty data. No penalties applied. Zero degradation.                   |
| False positive weak terms            | Medium       | Medium | MIN_REPLACED_COUNT (5) + 0.30 threshold filters noise.                        |
| Session gap misidentification        | Medium       | Low    | 30-minute gap filter separates genuine sessions from coincidental re-use.     |
| Confidence multiplier clamp too wide | Low          | Medium | New range 0.50–1.50 is conservative. Monitor via scorer health.               |
| Cron timeout                         | Low          | Low    | Iteration analysis reuses existing event set — no extra DB query.             |
| Breaking existing scoring            | Medium       | High   | Null lookups → no penalty. Null flags → 1.0 multiplier. Full backward compat. |

---

## 11. Success Metrics

| Metric                                 | Baseline (no Phase 7.2) | Target (Phase 7.2 mature)                       |
| -------------------------------------- | ----------------------- | ----------------------------------------------- |
| Detected weak terms per tier           | 0                       | 20–100 (depends on data volume)                 |
| Average iterations tracked per session | Unknown                 | Tracked and trending                            |
| Final-attempt confidence boost applied | 0                       | All multi-attempt sessions                      |
| Score-outcome correlation              | Phase 7.1 baseline      | Improvement ≥ 0.01 from final-attempt weighting |
| Weak term penalty effect               | 0                       | Frequently-replaced terms drop in suggestions   |

---

## 12. What This Does NOT Include

These are explicitly separate phases:

- Admin dashboard for iteration metrics → Phase 7.10
- Semantic redundancy detection → Phase 7.3
- Higher-order combinations (magic trios) → Phase 7.4
- Per-platform learning → Phase 7.5
- A/B testing → Phase 7.6

Phase 7.2 builds the **iteration analysis engine**. The insights feed into existing infrastructure (suggestion engine, confidence multiplier, scorer health).

---

## 13. Documentation Deliverables

| Document                                             | Action                                                                       |
| ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| `docs/authority/prompt-builder-evolution-plan-v2.md` | No change (plan already covers 7.2)                                          |
| `src/lib/learning/CHANGELOG-7.2.md`                  | NEW — Records all changes                                                    |
| `docs/authority/prompt-intelligence.md`              | UPDATE — Add weak-term penalty + iteration insights to scoring pipeline docs |

---

## Changelog

- **26 Feb 2026:** v1.0.0 — Initial plan created. 5 build steps across 1.5 days.
