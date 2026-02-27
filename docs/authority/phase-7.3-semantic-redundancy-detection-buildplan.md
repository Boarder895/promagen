# Phase 7.3 — Semantic Redundancy Detection

## Build Plan

**Authority:** `docs/authority/prompt-builder-evolution-plan-v2.md` § 7.3
**Effort:** 1 day across 5 parts (7.3a–e)
**Depends on:** Phase 7.1 (outcome-score, confidence multiplier), Phase 5 (co-occurrence data)
**Feature gate:** Reuses `PHASE_7_LEARNING_ENABLED` env var (no new flag)

---

## § 1. What This Phase Does

Detect terms that users pick **interchangeably** — they live in the same category, are almost never selected together, yet produce similar outcome scores. These are functional synonyms from the AI model's perspective.

**Example:** In the `lighting` category, "cinematic lighting" and "dramatic lighting" are both selected frequently but almost never together. When either appears, the copy rate is ~75%. They're semantically redundant — one is usually enough.

**What this enables (from evolution plan):**

- Redundancy warnings: "These terms overlap. One is usually enough."
- Smart substitution suggestions
- Token efficiency on Tier 4 (plain language uses more tokens for synonyms)
- Dropdown deduplication in Explore Drawer ("similar to your selection" label)

---

## § 2. Algorithm

### Detection (same-category mutual exclusivity + outcome similarity)

For each category, for each pair of terms (A, B):

```
soloA     = events where A is selected WITHOUT B in that category
soloB     = events where B is selected WITHOUT A in that category
together  = events where BOTH A and B are in that category
total     = soloA + soloB + together

mutualExclusivity = 1.0 − (together / total)     // 1.0 = never co-occur
outcomeA          = mean(weightedOutcome of soloA events)
outcomeB          = mean(weightedOutcome of soloB events)
outcomeSimilarity = 1.0 − |outcomeA − outcomeB|  // 1.0 = identical outcomes

redundancyScore   = mutualExclusivity × outcomeSimilarity
```

**Thresholds:**

- `REDUNDANCY_MIN_SOLO_EVENTS = 8` — each term needs ≥8 solo appearances
- `REDUNDANCY_MIN_MUTUAL_EXCLUSIVITY = 0.85` — rarely co-selected (≤15% overlap)
- `REDUNDANCY_MIN_OUTCOME_SIMILARITY = 0.80` — similar outcomes (within 0.20)
- `REDUNDANCY_MIN_SCORE = 0.70` — combined threshold for flagging
- `REDUNDANCY_MAX_GROUPS_PER_TIER = 150` — storage cap

### Grouping (transitive closure)

Redundant pairs form groups via union-find:

- If A≈B and B≈C → group {A, B, C}
- Each group gets a **canonical term** (highest usage count)
- The canonical term stays visible; others get demoted or labelled

### Per-tier + global

Same pattern as Phase 7.1: compute independently per tier, then aggregate a global view. Tier-first lookup with global fallback.

---

## § 3. Data Flow

```
┌──────────────────────────────────────────────────────────────┐
│  Cron (Layer 12)                                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ antiPatternEvents (ALL events, no score floor)          │ │
│  │       ↓ (reuses existing query — no new DB call)        │ │
│  │ computeRedundancyGroups(events)                         │ │
│  │       ↓                                                 │ │
│  │ RedundancyGroupsData → upsert 'redundancy-groups'      │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────────────────┐
│  GET /api/learning/redundancy-groups                         │
│  → Cache 5 min → client                                     │
└──────────────────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────────────────┐
│  useLearnedWeights() hook                                    │
│  → fetch → buildRedundancyLookup() → cached in module var    │
└──────────────────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────────────────┐
│  Suggestion Engine                                           │
│  → lookupRedundancy(option, selectedTerms, tier, lookup)     │
│  → If option is redundant with a selected term:              │
│    penalty = SCORE_WEIGHTS.redundancyPenalty × redundancyScore│
│    (-12 × 0–1 scale)                                        │
│  → breakdown.redundancyPenalty exposed                       │
└──────────────────────────────────────────────────────────────┘
```

---

## § 4. File Map

### New files (4)

| File                                                        | Part | Lines (est) | Purpose                 |
| ----------------------------------------------------------- | ---- | ----------- | ----------------------- |
| `src/lib/learning/redundancy-detection.ts`                  | 7.3b | ~350        | Pure computation engine |
| `src/lib/learning/redundancy-lookup.ts`                     | 7.3c | ~180        | O(1) lookup module      |
| `src/app/api/learning/redundancy-groups/route.ts`           | 7.3d | ~85         | GET API endpoint        |
| `src/lib/learning/__tests__/redundancy-integration.test.ts` | 7.3e | ~350        | Integration tests       |

### Modified files (5)

| File                                                       | Part | Changes                                          |
| ---------------------------------------------------------- | ---- | ------------------------------------------------ |
| `src/lib/learning/constants.ts`                            | 7.3a | +8 constants                                     |
| `src/lib/prompt-intelligence/types.ts`                     | 7.3e | +2 fields (breakdown + context)                  |
| `src/lib/prompt-intelligence/engines/suggestion-engine.ts` | 7.3e | +import, +weight, +scoring block, +reorder param |
| `src/hooks/use-learned-weights.ts`                         | 7.3e | +fetch, +cache, +state, +return field            |
| `src/components/providers/prompt-builder.tsx`              | 7.3e | +destructure, +pass, +dep                        |
| `src/app/api/learning/aggregate/route.ts`                  | 7.3d | +Layer 12, +import, +response fields             |

---

## § 5. Build Parts

### Part 7.3a — Constants (0.05d)

**File:** `src/lib/learning/constants.ts` (~8 new lines)

Add to `LEARNING_CONSTANTS`:

```typescript
// ── Phase 7.3: Semantic Redundancy Detection ────────────────────────
/** Storage key for redundancy groups in learned_weights table */
REDUNDANCY_GROUPS_KEY: 'redundancy-groups',
/** Min solo events per term to be considered for redundancy */
REDUNDANCY_MIN_SOLO_EVENTS: 8,
/** Min mutual exclusivity rate (0–1). 0.85 = ≤15% co-occurrence */
REDUNDANCY_MIN_MUTUAL_EXCLUSIVITY: 0.85,
/** Min outcome similarity (0–1). 0.80 = within 0.20 of each other */
REDUNDANCY_MIN_OUTCOME_SIMILARITY: 0.80,
/** Min combined redundancy score to flag a pair */
REDUNDANCY_MIN_SCORE: 0.70,
/** Max groups stored per tier (storage cap) */
REDUNDANCY_MAX_GROUPS_PER_TIER: 150,
/** Max members per redundancy group (prevents runaway union-find) */
REDUNDANCY_MAX_GROUP_SIZE: 8,
```

**Backward compatible:** Constants only — no behavior change.

---

### Part 7.3b — Redundancy Detection Engine (0.35d)

**File:** `src/lib/learning/redundancy-detection.ts` (~350 lines, NEW)

Pure computation layer. No I/O.

**Exported function:**

```typescript
export function computeRedundancyGroups(
  events: PromptEventRow[],
  referenceDate?: Date,
): RedundancyGroupsData | null;
```

**Algorithm (single pass per tier):**

1. Compute weighted outcome for each event (reuse `computeOutcomeScore` + `computeConfidenceMultiplier` from Phase 7.1a)
2. Group events by tier
3. For each tier, for each category:
   a. Build term frequency map: `term → { soloCount, soloOutcomeSum, pairCounts: Map<otherTerm, count> }`
   b. For each pair (A, B) within the same category:
   - `soloA` = events with A but not B
   - `soloB` = events with B but not A
   - `together` = events with both A and B
   - Filter: `soloA >= MIN_SOLO_EVENTS` AND `soloB >= MIN_SOLO_EVENTS`
   - Compute `mutualExclusivity`, `outcomeSimilarity`, `redundancyScore`
   - Filter: `mutualExclusivity >= MIN_MUTUAL_EXCLUSIVITY` AND `outcomeSimilarity >= MIN_OUTCOME_SIMILARITY` AND `redundancyScore >= MIN_SCORE`
4. Run union-find to group transitive pairs (cap group size at MAX_GROUP_SIZE)
5. Per group: pick canonical term (highest solo count), compute group-level stats
6. Sort groups by highest member redundancyScore descending, trim to MAX_GROUPS_PER_TIER
7. Also compute global (all-tier) groups

**Output types:**

```typescript
interface RedundancyPair {
  terms: [string, string]; // alphabetically sorted
  category: string; // shared category
  mutualExclusivity: number; // 0–1
  outcomeSimilarity: number; // 0–1
  redundancyScore: number; // 0–1 (combined)
  soloCountA: number;
  soloCountB: number;
  togetherCount: number;
}

interface RedundancyGroup {
  id: string; // e.g. "rg_lighting_001"
  category: string;
  canonical: string; // most-used term (keep this one)
  members: string[]; // all terms in group (including canonical)
  meanRedundancy: number; // average pairwise redundancyScore
  totalUsage: number; // sum of solo counts
  pairs: RedundancyPair[]; // underlying pair data
}

interface TierRedundancyGroups {
  eventCount: number;
  groupCount: number;
  groups: RedundancyGroup[];
}

interface RedundancyGroupsData {
  version: string;
  generatedAt: string;
  eventCount: number;
  totalGroups: number;
  tiers: Record<string, TierRedundancyGroups>;
  global: TierRedundancyGroups;
}
```

**Tests** (in same part): `src/lib/learning/__tests__/redundancy-detection.test.ts` (~300 lines, 18–22 test cases)

Coverage:

- Empty / null / too-few events → null
- Two terms in same category, never co-occur, similar outcomes → detected
- Two terms with different outcomes → NOT detected (similarity threshold)
- Two terms frequently co-occurring → NOT detected (exclusivity threshold)
- Terms in different categories → NOT detected (same-category constraint)
- Union-find transitive grouping (A≈B, B≈C → group {A,B,C})
- Group size cap (MAX_GROUP_SIZE)
- Canonical term selection (highest usage)
- Per-tier independence
- Global aggregation
- Group sorting by meanRedundancy
- Trim to MAX_GROUPS_PER_TIER
- Output metadata shape

---

### Part 7.3c — Redundancy Lookup (0.1d)

**File:** `src/lib/learning/redundancy-lookup.ts` (~180 lines, NEW)

Same pattern as `anti-pattern-lookup.ts` and `weak-term-lookup.ts`.

**Exported functions:**

```typescript
/** Build O(1) lookup from cron output */
export function buildRedundancyLookup(
  data: RedundancyGroupsData | null | undefined,
): RedundancyLookup | null;

/** Quick check: is this option redundant with any selected term?
 *  Returns highest redundancyScore (0–1), or 0 if no redundancy. */
export function lookupRedundancy(
  option: string,
  selectedTerms: string[],
  tier: number | null,
  lookup: RedundancyLookup | null,
): number;

/** Full info: which selected term is it redundant with, what's the canonical? */
export function lookupRedundancyInfo(
  option: string,
  selectedTerms: string[],
  tier: number | null,
  lookup: RedundancyLookup | null,
): RedundancyInfo | null;
```

**Lookup structure:**

```typescript
interface RedundancyInfo {
  redundancyScore: number; // 0–1
  redundantWith: string; // the selected term it overlaps with
  canonical: string; // the preferred term in the group
  groupMembers: string[]; // all terms in the group
}

interface RedundancyLookup {
  /** term → groupId, per tier */
  tiers: Record<string, Map<string, string>>;
  /** term → groupId, global */
  global: Map<string, string>;
  /** groupId → group data */
  groups: Map<string, { canonical: string; members: string[]; meanRedundancy: number }>;
  eventCount: number;
}
```

**Logic:** For each selected term, check if `option` is in the same group. If yes, return the group's `meanRedundancy` as the score. Tier-first → global fallback.

**Key distinction from collisions:** Collisions detect terms that _hurt each other_ when combined (quality drops). Redundancy detects terms that are _functionally identical_ (quality stays the same — they're just wasted tokens/slots).

---

### Part 7.3d — Cron Layer 12 + GET API Route (0.15d)

**Two files:**

#### 1. `src/app/api/learning/aggregate/route.ts` (MODIFY)

Same pattern as Layer 11 (iteration tracking):

- Add `import { computeRedundancyGroups } from '@/lib/learning/redundancy-detection'`
- Add `import type { RedundancyGroupsData } from '@/lib/learning/redundancy-detection'`
- Add tracking variables: `redundancyGroupsGenerated`, `redundancyGroupCount`
- Add response type fields
- Add Layer 12 block after Layer 11, inside the Phase 7 try/catch:
  ```typescript
  // ── Layer 12: Semantic Redundancy Detection (Phase 7.3) ───────
  // Reuses antiPatternEvents (same ALL-events set).
  if (!isTimedOut()) {
    const redundancyData = computeRedundancyGroups(antiPatternEvents);
    if (redundancyData) {
      if (!dryRun) {
        await upsertLearnedWeights(LEARNING_CONSTANTS.REDUNDANCY_GROUPS_KEY, redundancyData);
      }
      redundancyGroupsGenerated = true;
      redundancyGroupCount = redundancyData.totalGroups;
    }
  }
  ```
- Update all 4 response objects (success, error, lock-conflict, zero-events)
- Update header comments (Layer 12, version 5.0.0)

#### 2. `src/app/api/learning/redundancy-groups/route.ts` (NEW, ~85 lines)

Exact same pattern as `anti-patterns/route.ts`:

```typescript
GET → ensureAllTables() → getLearnedWeights<RedundancyGroupsData>('redundancy-groups')
→ null? short cache → data? 5-min cache
```

---

### Part 7.3e — Suggestion Engine Integration + Tests (0.35d)

**Five files modified, one new:**

#### 1. `src/lib/prompt-intelligence/types.ts`

- Add `import type { RedundancyLookup } from '@/lib/learning/redundancy-lookup'`
- Add `redundancyPenalty?: number` to `ScoredOption.breakdown`
- Add `redundancyLookup: RedundancyLookup | null` to `PromptContext`

#### 2. `src/lib/prompt-intelligence/engines/suggestion-engine.ts`

- Add import: `lookupRedundancy` + `RedundancyLookup`
- Add to `BuildContextInput`: `redundancyLookup?: RedundancyLookup | null`
- Add to `SCORE_WEIGHTS`: `redundancyPenalty: -12` (lighter than collisions — not harmful, just wasteful)
- Add scoring block after weak term block:
  ```typescript
  // === REDUNDANCY SCORING (Phase 7.3) ===
  let redundancyPenaltyValue = 0;
  if (context.redundancyLookup) {
    const redundancy = lookupRedundancy(
      option,
      context.selectedTerms,
      context.tier,
      context.redundancyLookup,
    );
    if (redundancy > 0) {
      redundancyPenaltyValue = Math.round(SCORE_WEIGHTS.redundancyPenalty * redundancy);
      breakdown.redundancyPenalty = redundancyPenaltyValue;
      score += redundancyPenaltyValue;
    }
  }
  ```
- Add `redundancyPenaltyValue` to returned breakdown
- Add `redundancyLookup` to `buildContext` destructuring + return
- Add `redundancyLookup` param to `reorderByRelevance`

#### 3. `src/hooks/use-learned-weights.ts`

- Add imports: `RedundancyGroupsData`, `buildRedundancyLookup`, `RedundancyLookup`
- Add `cachedRedundancyLookup` module variable
- Add `redundancyLookup` to return type, state, cache shortcut, parallel fetch, processing block, return value

#### 4. `src/components/providers/prompt-builder.tsx`

- Destructure `redundancyLookup` from `useLearnedWeights()`
- Pass to `reorderByRelevance()` call
- Add to `useMemo` dependency array

#### 5. `src/lib/learning/__tests__/redundancy-integration.test.ts` (NEW, ~350 lines, ~16 tests)

End-to-end integration tests:

- Events → redundancy groups → lookup → non-zero score
- Two synonyms with same outcomes → detected, penalty applied
- Two different terms → not detected, zero penalty
- Terms in different categories → not detected
- Null lookup → zero penalty (backward compat)
- Canonical term identification
- lookupRedundancyInfo returns group data + which selected term caused it
- Tier-first → global fallback

---

## § 6. Penalty Weight Rationale

| Phase                | Weight  | Rationale                                    |
| -------------------- | ------- | -------------------------------------------- |
| Anti-pattern (7.1)   | **-30** | Actively hurts quality — toxic pair          |
| Collision (7.1)      | **-20** | Competing roles — quality drops              |
| Weak term (7.2)      | **-15** | Users keep replacing it — statistical signal |
| **Redundancy (7.3)** | **-12** | Not harmful, just wasteful — gentle nudge    |

Redundancy gets the lightest penalty because both terms produce good results. The penalty is a nudge toward efficiency, not a quality warning.

---

## § 7. Distinction from Collision Matrix

| Aspect           | Collision (7.1)                 | Redundancy (7.3)                            |
| ---------------- | ------------------------------- | ------------------------------------------- |
| **Detection**    | solo quality > together quality | solo quality ≈ solo quality, never co-occur |
| **Meaning**      | "Using both hurts your prompt"  | "Using both wastes a slot"                  |
| **Category**     | Any two categories              | **Same category only**                      |
| **Key metric**   | Quality delta (solo − together) | Mutual exclusivity × outcome similarity     |
| **Penalty**      | -20 (moderate)                  | -12 (gentle)                                |
| **User message** | "These conflict"                | "These overlap — one is enough"             |

---

## § 8. Verification

After all 5 parts:

```powershell
# PowerShell, repo root: frontend
pnpm run typecheck
pnpm run lint
pnpm test -- --testPathPattern="redundancy"
```

**Good looks like:**

- Zero TypeScript errors
- Zero lint warnings
- All redundancy tests green
- All existing tests still pass (backward compat)
- When `PHASE_7_LEARNING_ENABLED=false` or no cron data: zero redundancy penalty everywhere
- Suggestion engine score calculation unchanged when lookup is null

---

## § 9. Phase 7.2 → 7.3 Checklist

Before starting 7.3, confirm Phase 7.2 is fully merged:

- [x] 7.2a: Constants + confidence multiplier (final-attempt factor)
- [x] 7.2b: Iteration analysis engine
- [x] 7.2c: Weak term lookup
- [x] 7.2d: Cron Layer 11 + GET API route
- [x] 7.2e: Suggestion engine integration + tests

Phase 7.3 builds on top of these. The aggregate route will be at version 5.0.0 (from 4.0.0 after 7.2d).
