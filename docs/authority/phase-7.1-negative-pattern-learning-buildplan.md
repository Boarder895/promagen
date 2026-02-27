# Phase 7.1 — Negative Pattern Learning Build Plan

**Version:** 1.0.0  
**Created:** 26 February 2026  
**Status:** Planning  
**Authority:** `prompt-builder-evolution-plan-v2.md` § 11 (Phase 7.1)  
**Dependencies:** Phase 6 (Self-Improving Scorer) — **deployed**  
**Estimated effort:** ~1.5 days across 6 build steps  
**Code standard:** `docs/authority/code-standard.md`  
**Working practice:** `docs/authority/best-working-practice.md`

---

## 1. Goal

The system already knows what works (Phase 5 co-occurrence from high-scoring prompts, Phase 6 term quality scores). It does NOT yet know **what actively kills a prompt**.

Phase 7.1 closes this gap with two mechanisms:

**Anti-pattern detection:** Term pairs that appear frequently in LOW-outcome prompts but rarely in HIGH-outcome ones. Example: "oil painting" + "8k resolution" + "ray tracing" — contradictory aesthetic (traditional medium vs photorealistic tech). When user selects "oil painting", actively DEMOTE "8k resolution" and "ray tracing" with a conflict indicator.

**Term collision maps:** Pairs that occupy the same semantic "space" and compete. "golden hour" + "moonlight" — both are lighting sources, using both confuses the model. Each alone → strong outcome. Together → terrible outcome.

No ML. Same nightly cron infrastructure. Same `learned_weights` table. Same lookup pattern as Phase 5 co-occurrence.

---

## 2. What Phase 5 + 6 Already Provides (Starting Point Audit)

| Component                                                    | Status   | Evidence                                                                           |
| ------------------------------------------------------------ | -------- | ---------------------------------------------------------------------------------- |
| Telemetry with outcome signals                               | ✅ Built | `src/app/api/prompt-telemetry/route.ts`                                            |
| Outcome score computation (0–1)                              | ✅ Built | `src/lib/learning/outcome-score.ts` — `computeOutcomeScore()`                      |
| Term quality scores (per-tier, z-score normalised)           | ✅ Built | `src/lib/learning/term-quality-scoring.ts`                                         |
| Co-occurrence matrix (HIGH-scoring pairs)                    | ✅ Built | `src/lib/learning/co-occurrence.ts`                                                |
| Co-occurrence lookup (O(1) pair scoring)                     | ✅ Built | `src/lib/learning/co-occurrence-lookup.ts` — **pattern to replicate**              |
| Conflict detection engine (hard/soft conflicts)              | ✅ Built | `src/lib/prompt-intelligence/engines/conflict-detection.ts`                        |
| Suggestion engine with conflict penalty scoring              | ✅ Built | `src/lib/prompt-intelligence/engines/suggestion-engine.ts` (line 144: -35 penalty) |
| Nightly cron with Phase 5 + 6 layers                         | ✅ Built | `src/app/api/learning/aggregate/route.ts` — Layers 1–8                             |
| Learning constants (SSOT for all thresholds)                 | ✅ Built | `src/lib/learning/constants.ts`                                                    |
| `learned_weights` key-value store                            | ✅ Built | `src/lib/learning/database.ts` — `upsertLearnedWeights()` / `getLearnedWeights()`  |
| Learned weights hook (client-side fetch + cache)             | ✅ Built | `src/hooks/use-learned-weights.ts`                                                 |
| Decay, diversity cap, normalisation utilities                | ✅ Built | `src/lib/learning/decay.ts`                                                        |
| `prompt_events` DB schema (selections, score, outcome, tier) | ✅ Built | `src/lib/learning/database.ts` — `PromptEventRow` interface                        |

**What this means:** All infrastructure is in place. We need:

1. A new query path that examines LOW-outcome events (the inverse of Phase 5)
2. Two new computation modules (anti-patterns + collisions)
3. Two new lookup modules (same O(1) pattern as co-occurrence-lookup.ts)
4. Cron extension (Layers 9–10)
5. Suggestion engine + conflict detection integration

---

## 3. Output Files (What the Cron Produces)

New JSON blobs stored in the `learned_weights` table:

| Storage Key        | Size Est. | Contents                                                                | Consumed By                                                     |
| ------------------ | --------- | ----------------------------------------------------------------------- | --------------------------------------------------------------- |
| `anti-patterns`    | ~10 KB    | Per-tier term pairs with negative outcome correlation + severity scores | `suggestion-engine.ts` (demote), `conflict-detection.ts` (warn) |
| `collision-matrix` | ~5 KB     | Per-tier term pairs that compete for same space + competition score     | `suggestion-engine.ts` (demote), `conflict-detection.ts` (warn) |

---

## 4. Key Concepts

### Anti-pattern vs Collision — What's the Difference?

| Dimension        | Anti-pattern                                               | Collision                                                     |
| ---------------- | ---------------------------------------------------------- | ------------------------------------------------------------- |
| **Definition**   | Term pair that HURTS prompt quality when used together     | Term pair that COMPETES for same role (redundant/overlapping) |
| **Signal**       | Low outcome score when both present                        | High outcome solo, low outcome together                       |
| **Example**      | "oil painting" + "8k resolution" (aesthetic contradiction) | "golden hour" + "moonlight" (both lighting sources)           |
| **Detection**    | High frequency in low-outcome events, low in high-outcome  | High individual quality, low pair outcome (quality delta)     |
| **UX treatment** | ⚠️ Conflict warning + demote in suggestions                | 🔄 "Choose one" indicator + demote the weaker term            |
| **Severity**     | Scored 0–1 (higher = more toxic)                           | Scored 0–1 (higher = more redundant)                          |

### Outcome Score Thresholds

- **Low-outcome event:** outcome score < 0.15 (copied but returned, or no positive signals)
- **High-outcome event:** outcome score ≥ 0.50 (saved or reused)
- These thresholds are configurable via `constants.ts`

### Anti-pattern Strength Formula

```
For each term pair (A, B) in tier T:
  lowCount  = count(events where A+B present AND outcome < LOW_THRESHOLD)
  highCount = count(events where A+B present AND outcome >= HIGH_THRESHOLD)
  totalLow  = count(all low-outcome events in tier T)
  totalHigh = count(all high-outcome events in tier T)

  // Fisher's enrichment ratio (how over-represented is the pair in bad prompts?)
  lowRate  = lowCount  / max(totalLow, 1)
  highRate = highCount / max(totalHigh, 1)
  enrichment = lowRate / max(highRate, 0.001)

  // Only flag if enrichment > 2.0 (appears 2× more in bad than good)
  // Severity scales with enrichment: min(enrichment / 10, 1.0)
  severity = clamp(enrichment / 10, 0, 1)
```

### Collision Strength Formula

```
For each term pair (A, B) in tier T:
  soloA   = mean outcome when A present WITHOUT B
  soloB   = mean outcome when B present WITHOUT A
  together = mean outcome when A AND B both present

  // Quality delta: how much does combining them hurt?
  bestSolo = max(soloA, soloB)
  delta = bestSolo - together

  // Only flag if delta > 0.10 (10% outcome drop when combined)
  // Competition score scales with delta: min(delta / 0.50, 1.0)
  competitionScore = clamp(delta / 0.50, 0, 1)
```

---

## 5. Build Steps — Detailed Breakdown

### Part 7.1a — Constants + Database Extensions (Foundation)

**Effort:** 0.25 days  
**Dependencies:** None

**What:** Add Phase 7.1 constants and storage keys to the existing `constants.ts`. Add a new DB query for fetching ALL events (not just qualifying ones) since anti-patterns care about low-scoring prompts too.

**Files modified:**

- `src/lib/learning/constants.ts` — ADD new constants
- `src/lib/learning/database.ts` — ADD new query function

**New constants:**

```typescript
// ── Phase 7 — Anti-pattern Detection ─────────────────────────────
/** Storage key for anti-pattern data */
ANTI_PATTERNS_KEY: 'anti-patterns',

/** Storage key for collision matrix data */
COLLISION_MATRIX_KEY: 'collision-matrix',

/** Outcome score below which an event is "low-outcome" */
ANTI_PATTERN_LOW_THRESHOLD: 0.15,

/** Outcome score above which an event is "high-outcome" */
ANTI_PATTERN_HIGH_THRESHOLD: 0.50,

/** Minimum events containing a pair before it's evaluated */
ANTI_PATTERN_MIN_PAIR_EVENTS: 5,

/** Minimum enrichment ratio to flag an anti-pattern (2× = twice as common in bad) */
ANTI_PATTERN_MIN_ENRICHMENT: 2.0,

/** Maximum anti-pattern pairs stored per tier */
ANTI_PATTERN_MAX_PAIRS_PER_TIER: 500,

/** Minimum quality delta (solo vs together) to flag a collision */
COLLISION_MIN_DELTA: 0.10,

/** Maximum collision pairs stored per tier */
COLLISION_MAX_PAIRS_PER_TIER: 300,

/** Minimum events per term for solo quality measurement in collisions */
COLLISION_MIN_SOLO_EVENTS: 5,
```

**New database function:**

```typescript
/**
 * Fetch ALL events (including low-scoring ones) for anti-pattern analysis.
 * Unlike fetchQualifyingEvents, this has NO score floor — we want the bad ones.
 * Still respects time window and category_count minimum.
 */
export async function fetchAllEventsForAntiPatterns(
  windowDays: number = 180,
  limit: number = LEARNING_CONSTANTS.AGGREGATION_BATCH_SIZE,
): Promise<PromptEventRow[]>;
```

**Tests:** None for this step (tested through Parts 7.1b and 7.1c).

**What "good" looks like:**

- `pnpm run typecheck` passes
- `pnpm run lint` passes
- Constants accessible from other modules

---

### Part 7.1b — Anti-pattern Detection Engine (Core Algorithm)

**Effort:** 0.5 days  
**Dependencies:** Part 7.1a

**What:** Create the computation module that analyses events and produces the `anti-patterns.json` output. Pure function — no I/O, no database access.

**File:** `src/lib/learning/anti-pattern-detection.ts` (NEW)

**Output type:**

```typescript
/** A single detected anti-pattern */
export interface AntiPattern {
  /** Alphabetically sorted pair of terms */
  terms: [string, string];
  /** Severity score: 0–1 (higher = more toxic) */
  severity: number;
  /** How many times this pair appeared in low-outcome events */
  lowCount: number;
  /** How many times this pair appeared in high-outcome events */
  highCount: number;
  /** Enrichment ratio (lowRate / highRate) */
  enrichment: number;
  /** Categories these terms typically belong to */
  categories: string[];
}

/** Per-tier anti-pattern data */
export interface TierAntiPatterns {
  /** Total events analysed in this tier */
  eventCount: number;
  /** Low-outcome event count in this tier */
  lowEventCount: number;
  /** High-outcome event count in this tier */
  highEventCount: number;
  /** Detected anti-patterns sorted by severity descending */
  patterns: AntiPattern[];
}

/** Complete output — stored in learned_weights table */
export interface AntiPatternData {
  /** Schema version */
  version: string;
  /** ISO timestamp of generation */
  generatedAt: string;
  /** Total events processed */
  eventCount: number;
  /** Total anti-patterns detected across all tiers */
  totalPatterns: number;
  /** Per-tier results (keys: "1", "2", "3", "4") */
  tiers: Record<string, TierAntiPatterns>;
  /** Global (all-tier) results */
  global: TierAntiPatterns;
}
```

**Main function:**

```typescript
/**
 * Detect anti-patterns from prompt event data.
 *
 * Algorithm:
 * 1. Split events into low-outcome and high-outcome buckets
 * 2. For each bucket, build term pair → count maps
 * 3. Compute enrichment ratio for each pair
 * 4. Filter: enrichment > MIN_ENRICHMENT && lowCount >= MIN_PAIR_EVENTS
 * 5. Compute severity = clamp(enrichment / 10, 0, 1)
 * 6. Sort by severity descending, keep top MAX_PAIRS_PER_TIER
 *
 * @param events — ALL prompt events (including low-scoring ones)
 * @returns AntiPatternData ready for upsert
 */
export function computeAntiPatterns(events: PromptEventRow[]): AntiPatternData;
```

**Tests:** `src/lib/learning/__tests__/anti-pattern-detection.test.ts` (NEW)

Test cases (minimum 10):

1. Empty events → empty result (no crash)
2. All high-outcome events → zero anti-patterns detected
3. Single toxic pair in low-outcome events → detected with correct severity
4. Pair appears equally in low and high → enrichment ~1.0 → NOT flagged
5. Pair appears 5× more in low than high → enrichment 5.0 → flagged, severity = 0.5
6. Below MIN_PAIR_EVENTS threshold → not flagged (insufficient data)
7. Multiple tiers → each tier has independent results
8. Global aggregation → combines all tiers
9. MAX_PAIRS_PER_TIER cap → only top N retained
10. Terms sorted alphabetically in pair key (consistency with co-occurrence)
11. Categories correctly inferred from selections
12. Version and timestamp present in output

**What "good" looks like:**

- All 12+ test cases green
- `pnpm run typecheck` passes
- Toxic pair "oil painting" + "8k resolution" detected in test data
- Enrichment calculation matches hand-verified numbers

---

### Part 7.1c — Collision Matrix Engine (Core Algorithm)

**Effort:** 0.5 days  
**Dependencies:** Part 7.1a

**What:** Create the computation module that detects term collisions — pairs where each term works well alone but they compete when combined. Pure function.

**File:** `src/lib/learning/collision-matrix.ts` (NEW)

**Output type:**

```typescript
/** A single detected collision */
export interface TermCollision {
  /** Alphabetically sorted pair of terms */
  terms: [string, string];
  /** Competition score: 0–1 (higher = more redundant) */
  competitionScore: number;
  /** Mean outcome when term A appears WITHOUT term B */
  soloOutcomeA: number;
  /** Mean outcome when term B appears WITHOUT term A */
  soloOutcomeB: number;
  /** Mean outcome when BOTH appear together */
  togetherOutcome: number;
  /** Quality delta: bestSolo - together */
  qualityDelta: number;
  /** How many events contain both terms */
  togetherCount: number;
  /** The "weaker" term (lower solo outcome) — suggest removing this one */
  weakerTerm: string;
}

/** Per-tier collision data */
export interface TierCollisions {
  /** Total events analysed */
  eventCount: number;
  /** Detected collisions sorted by competitionScore descending */
  collisions: TermCollision[];
}

/** Complete output — stored in learned_weights table */
export interface CollisionMatrixData {
  /** Schema version */
  version: string;
  /** ISO timestamp */
  generatedAt: string;
  /** Total events processed */
  eventCount: number;
  /** Total collisions detected across all tiers */
  totalCollisions: number;
  /** Per-tier results (keys: "1", "2", "3", "4") */
  tiers: Record<string, TierCollisions>;
  /** Global (all-tier) results */
  global: TierCollisions;
}
```

**Main function:**

```typescript
/**
 * Detect term collisions from prompt event data.
 *
 * Algorithm:
 * 1. For each term, compute solo outcome (events with term but NOT paired term)
 * 2. For each pair, compute together outcome
 * 3. qualityDelta = max(soloA, soloB) - together
 * 4. Filter: delta > MIN_DELTA && both solo counts >= MIN_SOLO_EVENTS
 *    && together count >= MIN_PAIR_EVENTS
 * 5. competitionScore = clamp(delta / 0.50, 0, 1)
 * 6. Sort by competitionScore descending, keep top MAX_PAIRS_PER_TIER
 *
 * @param events — ALL prompt events (including low-scoring ones)
 * @returns CollisionMatrixData ready for upsert
 */
export function computeCollisionMatrix(events: PromptEventRow[]): CollisionMatrixData;
```

**Tests:** `src/lib/learning/__tests__/collision-matrix.test.ts` (NEW)

Test cases (minimum 10):

1. Empty events → empty result
2. No term appears in multiple events → zero collisions
3. Two lighting terms that work well alone but poorly together → detected
4. Two terms that work well together → NOT flagged (delta < MIN_DELTA)
5. Below MIN_SOLO_EVENTS for one term → not flagged
6. Below MIN_PAIR_EVENTS for pair → not flagged
7. Correct weaker term identification (lower solo outcome)
8. Multiple tiers → independent results
9. Global aggregation
10. MAX_PAIRS_PER_TIER cap
11. Competition score clamped to [0, 1]
12. Pair where delta is exactly at threshold → edge case

**What "good" looks like:**

- All 12+ test cases green
- "golden hour" + "moonlight" collision detected in test data
- `weakerTerm` correctly identifies the worse-performing option
- Solo outcomes hand-verifiable from test data

---

### Part 7.1d — Lookup Modules (Real-time Integration Bridge)

**Effort:** 0.25 days  
**Dependencies:** Parts 7.1b, 7.1c

**What:** Create fast lookup structures (same O(1) Map pattern as `co-occurrence-lookup.ts`) that bridge the nightly cron output to the real-time suggestion engine.

**Files:**

- `src/lib/learning/anti-pattern-lookup.ts` (NEW)
- `src/lib/learning/collision-lookup.ts` (NEW)

**Anti-pattern lookup:**

```typescript
export interface AntiPatternLookup {
  /** Per-tier maps: tier string → (pairKey → severity 0–1) */
  tiers: Record<string, Map<string, number>>;
  /** Total events that produced this data */
  eventCount: number;
}

/** Build Map from AntiPatternData for O(1) lookups */
export function buildAntiPatternLookup(
  data: AntiPatternData | null | undefined,
): AntiPatternLookup | null;

/**
 * Check if a candidate term has any anti-pattern relationships
 * with the currently selected terms.
 *
 * Returns the WORST severity found (0 = clean, 1 = extremely toxic).
 */
export function lookupAntiPattern(
  candidate: string,
  selectedTerms: string[],
  tier: number | null,
  lookup: AntiPatternLookup | null,
): number;
```

**Collision lookup:**

```typescript
export interface CollisionLookup {
  /** Per-tier maps: tier string → (pairKey → { competitionScore, weakerTerm }) */
  tiers: Record<string, Map<string, { competitionScore: number; weakerTerm: string }>>;
  /** Total events */
  eventCount: number;
}

/** Build Map from CollisionMatrixData */
export function buildCollisionLookup(
  data: CollisionMatrixData | null | undefined,
): CollisionLookup | null;

/**
 * Check if a candidate term collides with any selected terms.
 *
 * Returns the WORST collision found as { score, isWeaker }.
 * isWeaker = true means the candidate is the expendable one.
 */
export function lookupCollision(
  candidate: string,
  selectedTerms: string[],
  tier: number | null,
  lookup: CollisionLookup | null,
): { score: number; isWeaker: boolean } | null;
```

**Tests:** Covered by integration test in Part 7.1f.

**What "good" looks like:**

- Same API shape as `co-occurrence-lookup.ts` (familiar pattern)
- O(1) pair lookups via Map
- Null-safe (no data → returns 0 / null, no crash)

---

### Part 7.1e — Cron Integration (Layers 9–10)

**Effort:** 0.25 days  
**Dependencies:** Parts 7.1a–d

**What:** Extend the nightly aggregation cron to run anti-pattern detection and collision matrix computation as Layers 9 and 10.

**File modified:** `src/app/api/learning/aggregate/route.ts`

**New layers:**

```
Layer  9: Anti-pattern Detection   → anti-patterns JSON     (Phase 7.1)
Layer 10: Collision Matrix         → collision-matrix JSON   (Phase 7.1)
```

**Execution order:**

- Layers 9 and 10 can run in parallel (no inter-dependencies)
- They require the FULL event set (not just qualifying events), so a new DB query is needed
- Feature flag: `PHASE_7_LEARNING_ENABLED` env var (default: false)
- Phase 7 failures are non-fatal (same pattern as Phase 6)

**Cron response extension:**

```typescript
interface AggregationCronResponse {
  // ... existing fields ...

  // Phase 7.1 additions
  phase7Enabled: boolean;
  antiPatternsGenerated: boolean;
  antiPatternCount: number;
  collisionMatrixGenerated: boolean;
  collisionCount: number;
  phase7DurationMs: number;
}
```

**New API routes:**

- `src/app/api/learning/anti-patterns/route.ts` (NEW) — GET endpoint, same auth pattern
- `src/app/api/learning/collisions/route.ts` (NEW) — GET endpoint, same auth pattern

**What "good" looks like:**

- Cron runs Layers 9–10 when `PHASE_7_LEARNING_ENABLED=true`
- Cron skips Layers 9–10 when env var is false/missing
- Phase 7 errors don't affect Phase 5 or Phase 6 results
- API routes return stored data or empty defaults
- `pnpm run typecheck` passes

---

### Part 7.1f — Suggestion Engine + Conflict Detection Integration (Live Scoring)

**Effort:** 0.25 days  
**Dependencies:** Part 7.1d

**What:** Wire anti-pattern and collision lookups into the existing suggestion engine scoring pipeline and conflict detection engine.

**Files modified:**

- `src/lib/prompt-intelligence/engines/suggestion-engine.ts` — ADD anti-pattern penalty + collision penalty
- `src/lib/prompt-intelligence/engines/conflict-detection.ts` — ADD learned conflict source
- `src/hooks/use-learned-weights.ts` — ADD anti-pattern + collision data fetching (or confirm existing hook handles new keys)

**Suggestion engine changes:**

Add to `BuildContextInput`:

```typescript
/** Pre-built anti-pattern lookup from Phase 7.1 (null = no data) */
antiPatternLookup?: AntiPatternLookup | null;

/** Pre-built collision lookup from Phase 7.1 (null = no data) */
collisionLookup?: CollisionLookup | null;
```

Add to score weights:

```typescript
/** Anti-pattern penalty (from learned data, Phase 7.1) */
antiPatternPenalty: -30,   // Severe — these actively hurt prompts

/** Collision penalty (from learned data, Phase 7.1) */
collisionPenalty: -20,     // Moderate — redundancy, not toxicity
```

Score computation for each candidate option:

```
1. Existing scores (base, mood, family, era, cluster, affinity, co-occurrence) — unchanged
2. NEW: antiPatternScore = lookupAntiPattern(candidate, selectedTerms, tier, lookup) × -30
3. NEW: collisionScore = lookupCollision(candidate, selectedTerms, tier, lookup) × -20
4. Total score = sum of all components
```

**Conflict detection changes:**

Add a new conflict source: `checkLearnedConflicts()`:

```typescript
/**
 * Check for conflicts learned from telemetry data.
 * Sources: anti-patterns.json (severity-based) and collision-matrix.json.
 */
function checkLearnedConflicts(
  termToCategory: Map<string, PromptCategory>,
  antiPatternLookup: AntiPatternLookup | null,
  collisionLookup: CollisionLookup | null,
  tier: number | null,
): DetectedConflict[];
```

Learned conflicts produce **soft** severity by default (they're statistical, not rule-based). Anti-patterns with severity > 0.7 produce **hard** severity.

**Tests:** `src/lib/learning/__tests__/negative-pattern-integration.test.ts` (NEW)

Test cases (minimum 14):

1. Anti-pattern lookup returns correct severity for known toxic pair
2. Anti-pattern lookup returns 0 for clean pair
3. Anti-pattern lookup returns 0 when no data loaded (null lookup)
4. Collision lookup returns correct score + weaker term
5. Collision lookup returns null for non-colliding pair
6. Collision lookup returns null when no data loaded
7. Suggestion engine demotes option with anti-pattern relationship
8. Suggestion engine demotes option with collision relationship
9. Suggestion engine unchanged when no learned data exists (backward compat)
10. Conflict detection surfaces anti-pattern as soft conflict
11. Conflict detection surfaces high-severity anti-pattern as hard conflict
12. Conflict detection surfaces collision with "choose one" suggestion
13. Conflict detection unchanged when no learned data (backward compat)
14. Full round-trip: build data → build lookup → score option → correct demotion

**What "good" looks like:**

- All 14+ test cases green
- Selecting "oil painting" in a prompt → "8k resolution" drops in suggestion ranking
- Selecting "golden hour" → "moonlight" gets a collision indicator
- NO changes to existing behaviour when Phase 7 data doesn't exist
- `pnpm run typecheck` passes
- `pnpm run lint` passes

---

## 6. File Impact Map

### New Files (8)

| File                                                              | Part | Purpose                                      |
| ----------------------------------------------------------------- | ---- | -------------------------------------------- |
| `src/lib/learning/anti-pattern-detection.ts`                      | 7.1b | Pure computation: events → anti-patterns     |
| `src/lib/learning/collision-matrix.ts`                            | 7.1c | Pure computation: events → collision matrix  |
| `src/lib/learning/anti-pattern-lookup.ts`                         | 7.1d | O(1) Map lookup bridge for suggestion engine |
| `src/lib/learning/collision-lookup.ts`                            | 7.1d | O(1) Map lookup bridge for suggestion engine |
| `src/app/api/learning/anti-patterns/route.ts`                     | 7.1e | GET endpoint for anti-patterns JSON          |
| `src/app/api/learning/collisions/route.ts`                        | 7.1e | GET endpoint for collision matrix JSON       |
| `src/lib/learning/__tests__/anti-pattern-detection.test.ts`       | 7.1b | 12+ test cases for anti-pattern engine       |
| `src/lib/learning/__tests__/collision-matrix.test.ts`             | 7.1c | 12+ test cases for collision engine          |
| `src/lib/learning/__tests__/negative-pattern-integration.test.ts` | 7.1f | 14+ test cases for end-to-end integration    |

### Modified Files (5)

| File                                                        | Part | Changes                                                       |
| ----------------------------------------------------------- | ---- | ------------------------------------------------------------- |
| `src/lib/learning/constants.ts`                             | 7.1a | ADD 11 new constants for Phase 7.1                            |
| `src/lib/learning/database.ts`                              | 7.1a | ADD `fetchAllEventsForAntiPatterns()` query                   |
| `src/app/api/learning/aggregate/route.ts`                   | 7.1e | ADD Layers 9–10, feature flag, response fields                |
| `src/lib/prompt-intelligence/engines/suggestion-engine.ts`  | 7.1f | ADD anti-pattern + collision scoring inputs + penalty weights |
| `src/lib/prompt-intelligence/engines/conflict-detection.ts` | 7.1f | ADD `checkLearnedConflicts()` source                          |

### Untouched Files (everything else)

All Phase 5 and Phase 6 files remain unchanged. All existing tests continue to pass.

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

- Part 7.1a: `typecheck` + `lint` pass, new constants importable
- Part 7.1b: `anti-pattern-detection.test.ts` — all 12+ green, toxic pairs detected
- Part 7.1c: `collision-matrix.test.ts` — all 12+ green, competing terms detected
- Part 7.1d: Lookups build from test data, O(1) access verified
- Part 7.1e: Cron response includes Phase 7 fields, feature flag respected
- Part 7.1f: `negative-pattern-integration.test.ts` — all 14+ green, backward compat confirmed

---

## 8. Build Order + Day Allocation

| Time         | Part(s) | What                                          | Deliverables                                                 |
| ------------ | ------- | --------------------------------------------- | ------------------------------------------------------------ |
| **Day 1 AM** | 7.1a    | Constants + DB query extension                | Modified `constants.ts`, `database.ts`. Types clean.         |
| **Day 1 AM** | 7.1b    | Anti-pattern detection engine + tests         | `anti-pattern-detection.ts`, 12+ tests passing               |
| **Day 1 PM** | 7.1c    | Collision matrix engine + tests               | `collision-matrix.ts`, 12+ tests passing                     |
| **Day 1 PM** | 7.1d    | Lookup modules                                | `anti-pattern-lookup.ts`, `collision-lookup.ts`              |
| **Day 2 AM** | 7.1e    | Cron wiring (Layers 9–10) + API routes        | Aggregate route extended, 2 new API routes                   |
| **Day 2 PM** | 7.1f    | Suggestion engine + conflict detection wiring | Integration working, 14+ integration tests, full suite green |

---

## 9. Rollout Strategy

```
Phase A — Build (Day 1–2):
  Feature flag OFF (PHASE_7_LEARNING_ENABLED = false).
  Code deployed but inert.
  Existing scorer, suggestions, and conflicts unchanged.

Phase B — Shadow Mode (Day 3–7):
  Feature flag ON. Cron runs Layers 9–10.
  learned_weights table gets anti-patterns + collision-matrix keys.
  Frontend still ignores them (lookup = null in suggestion engine).

Phase C — Live Integration (Day 8+):
  Frontend reads anti-pattern + collision lookups.
  Suggestion engine applies penalties.
  Conflict detection surfaces learned conflicts.
  Monitor scorer health report for correlation improvement.
```

---

## 10. Risk Register

| Risk                                     | Likelihood   | Impact | Mitigation                                                                      |
| ---------------------------------------- | ------------ | ------ | ------------------------------------------------------------------------------- |
| Insufficient low-outcome events          | High (early) | Low    | Returns empty data. No penalties applied. Zero degradation.                     |
| False positive anti-patterns             | Medium       | Medium | MIN_PAIR_EVENTS (5) + MIN_ENRICHMENT (2.0) thresholds filter noise.             |
| False positive collisions                | Medium       | Medium | MIN_DELTA (0.10) + MIN_SOLO_EVENTS (5) prevent flagging marginal differences.   |
| Cron timeout (too many pairs to process) | Low          | Medium | Lightweight arithmetic on same data. Budget: ~3s. Well within remaining margin. |
| Breaking existing suggestion scoring     | Medium       | High   | Feature flag. Null lookups → no penalty. Full backward compat test suite.       |
| Breaking existing conflict detection     | Medium       | High   | Learned conflicts are additive only. Existing sources unchanged.                |

---

## 11. Success Metrics

| Metric                              | Baseline (no Phase 7.1) | Target (Phase 7.1 mature)                            |
| ----------------------------------- | ----------------------- | ---------------------------------------------------- |
| Detected anti-patterns per tier     | 0                       | 10–50 (depends on data volume)                       |
| Detected collisions per tier        | 0                       | 5–20                                                 |
| Conflict warnings from learned data | 0                       | Users see warnings for known-bad combos              |
| Score-outcome correlation           | Phase 6 baseline        | Improvement ≥ 0.02 from penalty calibration          |
| False positive rate                 | N/A                     | < 10% (manual review in admin dashboard, Phase 7.10) |

---

## 12. What This Does NOT Include

These are explicitly separate phases:

- Admin Command Centre UI (view/override anti-patterns) → Phase 7.10
- User feedback widget (validate anti-pattern warnings) → Phase 7.10
- Magic combos (3+ term combinations) → Phase 7.4
- Semantic redundancy detection → Phase 7.3
- Iteration tracking → Phase 7.2
- Per-platform learning → Phase 7.5
- A/B testing → Phase 7.6

Phase 7.1 builds the **detection engine**. Phase 7.10 builds the **admin oversight dashboard** with manual override capability.

---

## 13. Documentation Deliverables

| Document                                             | Action                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------ |
| `docs/authority/prompt-builder-evolution-plan-v2.md` | No change (plan already covers 7.1)                                      |
| `src/lib/learning/CHANGELOG-7.1.md`                  | NEW — Records all changes                                                |
| `docs/authority/prompt-intelligence.md`              | UPDATE — Add anti-pattern + collision detection to scoring pipeline docs |

---

## Changelog

- **26 Feb 2026:** v1.0.0 — Initial plan created. 6 build steps across 1.5 days.
