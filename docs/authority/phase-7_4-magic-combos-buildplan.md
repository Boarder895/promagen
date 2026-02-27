# Phase 7.4 — Higher-Order Combinations ("Magic Combos")

## Build Plan

**Authority:** `docs/authority/prompt-builder-evolution-plan-v2.md` § 7.4
**Effort:** 1.5 days across 5 parts (7.4a–e)
**Depends on:** Phase 5 (co-occurrence data, flattenSelections, decay helpers), Phase 7.1a (outcome-score, confidence multiplier)
**Feature gate:** Reuses `PHASE_7_LEARNING_ENABLED` env var (no new flag)

---

## § 1. What This Phase Does

Co-occurrence matrices capture **pairs**. Some magic only happens with **3+ terms** together. Phase 7.4 discovers these higher-order combinations — trios and quads where the whole is greater than the sum of its parts.

**Example:** "oil painting" + "golden hour" + "impasto texture" → 93% outcome. No pair alone predicts this — it's the specific trio that produces exceptional results.

**What this enables (from evolution plan):**

- "You're two-thirds of the way to something that works really well" — massive boost for the missing term
- Cross-category synergy discovery (lighting × style × materials)
- Auto-suggestions that feel like expert knowledge ("users who pick A + B also love C")
- Data for future "combo presets" or "power combinations" UI section

**Key distinction from co-occurrence (Phase 5):**

| Aspect     | Co-occurrence (Phase 5)      | Magic Combos (7.4)                               |
| ---------- | ---------------------------- | ------------------------------------------------ |
| **Size**   | Pairs (2 terms)              | Trios + Quads (3–4 terms)                        |
| **Scope**  | Any terms that co-appear     | Terms with **emergent synergy**                  |
| **Signal** | "These appear together"      | "Together is better than any subset"             |
| **Metric** | Weighted co-occurrence count | Synergy score = trio outcome − best pair outcome |
| **Weight** | +20 (boost, blended)         | +25 (boost, direct)                              |

---

## § 2. Algorithm

### Synergy Score

The key metric is **synergy** — how much better is the full combo than its best subset?

```
For a trio (A, B, C):
  trioOutcome    = mean(weightedOutcome of events containing A ∩ B ∩ C)
  bestPairOutcome = max(
    mean(outcome of events containing A ∩ B),
    mean(outcome of events containing A ∩ C),
    mean(outcome of events containing B ∩ C),
  )
  synergyScore = trioOutcome − bestPairOutcome  // positive = emergent value

For a quad (A, B, C, D):
  quadOutcome    = mean(weightedOutcome of events containing A ∩ B ∩ C ∩ D)
  bestTrioOutcome = max(mean outcome of all 4 trio subsets)
  synergyScore = quadOutcome − bestTrioOutcome
```

A positive synergy means the full combo produces better results than any smaller subset — the terms have emergent chemistry.

### Mining (level-wise Apriori)

```
Level 1: Frequent terms
  → terms with ≥ MIN_TERM_FREQUENCY events
  → prunes rare terms early (huge performance win)

Level 2: Frequent pairs
  → generate all 2-combos from frequent terms
  → keep pairs with ≥ MIN_PAIR_SUPPORT events
  → compute mean weighted outcome per pair

Level 3: Candidate trios
  → extend each frequent pair (A,B) with each frequent term C
    where (A,C) and (B,C) are also frequent pairs (Apriori property)
  → count events containing all 3 terms
  → keep trios with ≥ MIN_COMBO_SUPPORT events
  → compute synergy score
  → filter: synergyScore ≥ MIN_SYNERGY_SCORE

Level 4: Candidate quads (optional, if Level 3 found results)
  → extend each frequent trio (A,B,C) with each frequent term D
    where all 3 new pairs are frequent
  → count events containing all 4 terms
  → keep quads with ≥ MIN_COMBO_SUPPORT events
  → compute synergy score (quad outcome − best trio subset outcome)
  → filter: synergyScore ≥ MIN_SYNERGY_SCORE
```

### Per-tier + global

Same pattern as all Phase 7: compute independently per tier, then aggregate a global view. Tier-first lookup with global fallback.

### Performance guard

- Level 1 pruning eliminates most terms (only those with ≥10 appearances survive)
- Level 2 Apriori constraint prevents combinatorial explosion
- Worst case with 200 frequent terms: C(200,2) = 19,900 pairs — manageable
- Level 3 only extends pairs where all sub-pairs are frequent — typically reduces to hundreds of candidates
- Total: O(events × frequent_terms²) — well within 16ms frame budget for mining, and mining only runs in nightly cron

---

## § 3. Data Flow

```
┌──────────────────────────────────────────────────────────────┐
│  Cron (Layer 13)                                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ antiPatternEvents (ALL events, no score floor)          │ │
│  │       ↓ (reuses existing query — no new DB call)        │ │
│  │ computeMagicCombos(events)                              │ │
│  │       ↓                                                 │ │
│  │ MagicCombosData → upsert 'magic-combos'                │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────────────────┐
│  GET /api/learning/magic-combos                              │
│  → Cache 5 min → client                                     │
└──────────────────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────────────────┐
│  useLearnedWeights() hook                                    │
│  → fetch → buildMagicComboLookup() → cached in module var    │
└──────────────────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────────────────┐
│  Suggestion Engine                                           │
│  → lookupMagicComboBoost(option, selectedTerms, tier, lookup)│
│  → If option completes a magic combo:                        │
│    boost = SCORE_WEIGHTS.magicComboBoost × synergyScore      │
│    (+25 × 0–1 scale)                                        │
│  → breakdown.magicComboBoost exposed                        │
└──────────────────────────────────────────────────────────────┘
```

---

## § 4. File Map

### New files (4)

| File                                                         | Part | Lines (est) | Purpose                |
| ------------------------------------------------------------ | ---- | ----------- | ---------------------- |
| `src/lib/learning/magic-combo-mining.ts`                     | 7.4b | ~450        | Apriori mining engine  |
| `src/lib/learning/magic-combo-lookup.ts`                     | 7.4c | ~200        | O(1) completion lookup |
| `src/app/api/learning/magic-combos/route.ts`                 | 7.4d | ~85         | GET API endpoint       |
| `src/lib/learning/__tests__/magic-combo-integration.test.ts` | 7.4e | ~400        | Integration tests      |

### Modified files (5)

| File                                                       | Part | Changes                                                           |
| ---------------------------------------------------------- | ---- | ----------------------------------------------------------------- |
| `src/lib/learning/constants.ts`                            | 7.4a | +8 constants, version bump 4.0.0 → 5.0.0                          |
| `src/app/api/learning/aggregate/route.ts`                  | 7.4d | +Layer 13, +import, +response fields, version bump 5.0.0 → 6.0.0  |
| `src/lib/prompt-intelligence/types.ts`                     | 7.4e | +2 fields (breakdown + context)                                   |
| `src/lib/prompt-intelligence/engines/suggestion-engine.ts` | 7.4e | +import, +weight, +scoring block, +reorder param                  |
| `src/hooks/use-learned-weights.ts`                         | 7.4e | +fetch, +cache, +state, +return field, version bump 5.0.0 → 6.0.0 |
| `src/components/providers/prompt-builder.tsx`              | 7.4e | +destructure, +pass, +dep                                         |

---

## § 5. Build Parts

### Part 7.4a — Constants (0.05d)

**File:** `src/lib/learning/constants.ts` (~8 new lines)

Add to `LEARNING_CONSTANTS`:

```typescript
// ── Phase 7.4: Higher-Order Combinations (Magic Combos) ─────────
/** Storage key for magic combos in learned_weights table */
MAGIC_COMBOS_KEY: 'magic-combos',
/** Min events a single term must appear in to be considered (Level 1 pruning) */
MAGIC_COMBO_MIN_TERM_FREQUENCY: 10,
/** Min events a pair must appear in to be considered (Level 2 pruning) */
MAGIC_COMBO_MIN_PAIR_SUPPORT: 8,
/** Min events the full combo (trio/quad) must appear in */
MAGIC_COMBO_MIN_SUPPORT: 5,
/** Min synergy score (trioOutcome − bestPairOutcome) to flag as magic */
MAGIC_COMBO_MIN_SYNERGY: 0.05,
/** Max combo size (3 = trios only, 4 = trios + quads) */
MAGIC_COMBO_MAX_SIZE: 4,
/** Max combos stored per tier (storage cap) */
MAGIC_COMBO_MAX_PER_TIER: 500,
```

Version bump: 4.0.0 → 5.0.0

**Backward compatible:** Constants only — no behaviour change.

---

### Part 7.4b — Magic Combo Mining Engine (0.45d)

**File:** `src/lib/learning/magic-combo-mining.ts` (~450 lines, NEW)

Pure computation layer. No I/O.

**Exported function:**

```typescript
export function computeMagicCombos(
  events: PromptEventRow[],
  referenceDate?: Date,
): MagicCombosData | null;
```

**Algorithm (per-tier, level-wise Apriori):**

1. Compute weighted outcome for each event (reuse `computeOutcomeScore` × `computeConfidenceMultiplier` from Phase 7.1a)
2. Group events by tier
3. Per tier:
   a. Flatten each event's selections via `flattenSelections()`
   b. **Level 1 — Frequent terms:** Count term frequencies across all events. Prune terms below `MIN_TERM_FREQUENCY`.
   c. **Level 2 — Frequent pairs:** For each event, generate 2-combinations from its frequent terms. Count pair frequencies. Prune pairs below `MIN_PAIR_SUPPORT`. Compute mean weighted outcome per pair.
   d. **Level 3 — Candidate trios:** For each frequent pair (A,B), find all frequent terms C where (A,C) and (B,C) are both frequent pairs (Apriori join). Count trio frequencies. Filter by `MIN_SUPPORT`. Compute trio mean outcome and synergy = trioOutcome − max(pairAB, pairAC, pairBC). Filter by `MIN_SYNERGY`.
   e. **Level 4 — Candidate quads (optional):** For each frequent trio (A,B,C), find all frequent terms D where all 3 new pairs are frequent AND all 3 new trios are frequent. Count quad frequencies. Filter by `MIN_SUPPORT`. Compute synergy = quadOutcome − max(trio subsets). Filter by `MIN_SYNERGY`.
4. Sort combos by `synergyScore` descending, trim to `MAX_PER_TIER`
5. Also compute global (all-tier) combos

**Output types:**

```typescript
/** A single magic combo (trio or quad) */
export interface MagicCombo {
  /** Sorted term array (3 or 4 terms) */
  terms: string[];
  /** Combo size: 3 (trio) or 4 (quad) */
  size: number;
  /** Mean weighted outcome when all terms present */
  meanOutcome: number;
  /** Best subset outcome (best pair for trios, best trio for quads) */
  bestSubsetOutcome: number;
  /** Synergy = meanOutcome − bestSubsetOutcome */
  synergyScore: number;
  /** How many events contained the full combo */
  support: number;
  /** Categories represented in the combo */
  categories: string[];
}

/** Per-tier slice of magic combos */
export interface TierMagicCombos {
  eventCount: number;
  comboCount: number;
  trioCount: number;
  quadCount: number;
  combos: MagicCombo[];
}

/** Full magic combos output */
export interface MagicCombosData {
  version: string;
  generatedAt: string;
  eventCount: number;
  totalCombos: number;
  tiers: Record<string, TierMagicCombos>;
  global: TierMagicCombos;
}
```

**Internal helpers:**

```typescript
/** Generate sorted 2-combinations from an array */
function combinations2(items: string[]): [string, string][];

/** Generate sorted 3-combinations from an array using frequent pairs (Apriori join) */
function candidateTrios(
  frequentPairs: Set<string>,
  frequentTerms: string[],
): [string, string, string][];

/** Generate sorted 4-combinations from frequent trios (Apriori join) */
function candidateQuads(
  frequentTrios: Set<string>,
  frequentPairs: Set<string>,
  frequentTerms: string[],
): [string, string, string, string][];

/** Canonical key for a sorted combo: "term1|term2|term3" */
function comboKey(terms: string[]): string;
```

**Unit test file:** `src/lib/learning/__tests__/magic-combo-mining.test.ts` (~500 lines, ~20 tests)

Tests:

1. Null/empty events → null
2. Events below min term frequency → no combos
3. Perfect trio detected (3 terms always together, high outcome)
4. No synergy (trio outcome ≈ best pair outcome) → filtered out
5. Terms that only appear in pairs → no trios
6. Level 1 pruning: rare terms excluded
7. Level 2 pruning: infrequent pairs excluded
8. Level 3 Apriori property: trio only generated when all 3 sub-pairs are frequent
9. Quad detection (4 terms with synergy)
10. Quad requires all sub-trios to be frequent
11. Per-tier independence
12. Global aggregation
13. Sort by synergy descending
14. MAX_PER_TIER cap
15. Categories correctly identified from semantic tags
16. Combo key alphabetical ordering
17. Synergy calculation correctness (exact values)
18. Events with many terms — performance guard (no combinatorial explosion)
19. Weighted outcome uses confidence multiplier correctly
20. Output metadata (version, generatedAt, counts)

---

### Part 7.4c — Magic Combo Lookup (0.2d)

**File:** `src/lib/learning/magic-combo-lookup.ts` (~200 lines, NEW)

Pure functions. Single type-only import from `magic-combo-mining.ts`.

**Three exported functions:**

#### 1. `buildMagicComboLookup(data) → MagicComboLookup | null`

Converts `MagicCombosData` → fast indexed structure:

```typescript
export interface MagicComboEntry {
  terms: string[];
  synergyScore: number;
  support: number;
}

export interface MagicComboLookup {
  /** Per-tier: term → list of combos containing that term */
  tiers: Record<string, Map<string, MagicComboEntry[]>>;
  /** Global: term → list of combos */
  global: Map<string, MagicComboEntry[]>;
  /** Total events that produced this data */
  eventCount: number;
}
```

Index structure: `term → MagicComboEntry[]` — for each term, all combos it participates in.

#### 2. `lookupMagicComboBoost(option, selectedTerms, tier, lookup) → number (0–1)`

Quick score: highest synergy of any combo where:

- `option` is one of the combo terms
- **All other** combo terms are in `selectedTerms`

This means the boost fires when the user is **one term away** from completing a magic combo.

Returns 0 if no combo completion found or no data.

**Algorithm:**

1. Look up all combos containing `option` (tier-first, then global fallback)
2. For each combo, check if all other terms are in `selectedTerms` (Set lookup)
3. Return max synergy among matching combos (capped at 1.0)

#### 3. `lookupMagicComboInfo(option, selectedTerms, tier, lookup) → MagicComboInfo | null`

Full info for UI tooltips:

```typescript
export interface MagicComboInfo {
  /** The synergy score driving the boost */
  synergyScore: number;
  /** All terms in the combo */
  comboTerms: string[];
  /** Which selected terms are part of this combo */
  matchedTerms: string[];
  /** How many events back this combo */
  support: number;
}
```

Returns null if no combo completion found.

**Lookup pattern:** tier-first → global fallback (matches collision-lookup, weak-term-lookup, redundancy-lookup).

---

### Part 7.4d — Cron Layer 13 + GET Route (0.2d)

**Two files:**

#### 1. `src/app/api/learning/aggregate/route.ts` (MODIFY)

- Update header: add Layer 13, Phase 7.3 → 7.4
- Add import: `computeMagicCombos`, `MagicCombosData`
- Add to `AggregationCronResponse`:
  ```typescript
  // Phase 7.4 additions
  magicCombosGenerated: boolean;
  magicComboCount: number;
  ```
- Add tracking variables: `magicCombosGenerated = false`, `magicComboCount = 0`
- Add Layer 13 block after Layer 12 (Redundancy Detection):

  ```typescript
  // ── Layer 13: Magic Combos (Phase 7.4) ───────────────────────
  // Reuses antiPatternEvents (same ALL-events set — no new DB query).
  // Discovers trios/quads with emergent synergy.
  if (!isTimedOut()) {
    const magicCombosData: MagicCombosData | null = computeMagicCombos(antiPatternEvents);

    if (magicCombosData) {
      magicComboCount = magicCombosData.totalCombos;
      if (!dryRun) {
        await upsertLearnedWeights(LEARNING_CONSTANTS.MAGIC_COMBOS_KEY, magicCombosData);
      }
      magicCombosGenerated = true;
    }
  }
  ```

- Update all 4 response objects (success, error, lock-conflict, zero-events) with new fields
- Update phase7Suffix log message
- Bump version: 5.0.0 → 6.0.0

#### 2. `src/app/api/learning/magic-combos/route.ts` (NEW, ~85 lines)

GET endpoint. Same pattern as `anti-patterns/route.ts`:

```typescript
const result = await getLearnedWeights<MagicCombosData>(LEARNING_CONSTANTS.MAGIC_COMBOS_KEY);
```

Cache: 5-min (`s-maxage=300`) when data exists, 60s when null.

---

### Part 7.4e — Suggestion Engine Integration + Tests (0.4d)

**Five files modified, one new:**

#### 1. `src/lib/prompt-intelligence/types.ts`

- Add `import type { MagicComboLookup } from '@/lib/learning/magic-combo-lookup'`
- Add `magicComboBoost?: number` to `ScoredOption.breakdown`
- Add `magicComboLookup: MagicComboLookup | null` to `PromptContext`

#### 2. `src/lib/prompt-intelligence/engines/suggestion-engine.ts`

- Add import: `lookupMagicComboBoost` + `MagicComboLookup`
- Add to `BuildContextInput`: `magicComboLookup?: MagicComboLookup | null`
- Add to `SCORE_WEIGHTS`: `magicComboBoost: 25` (**positive** — this is a boost, not a penalty)
- Add scoring block after redundancy block:
  ```typescript
  // === MAGIC COMBO SCORING (Phase 7.4) ===
  // Boost terms that complete a known high-synergy combination.
  // "You're one term away from a magic combo."
  // synergyScore 0–1 scales the boost: 1.0 → full +25 boost.
  // When lookup is null (no data), boost is 0 → backward compatible.
  let magicComboBoostValue = 0;
  if (context.magicComboLookup) {
    const synergy = lookupMagicComboBoost(
      option,
      context.selectedTerms,
      context.tier,
      context.magicComboLookup,
    );
    if (synergy > 0) {
      magicComboBoostValue = Math.round(SCORE_WEIGHTS.magicComboBoost * synergy);
      breakdown.magicComboBoost = magicComboBoostValue;
      score += magicComboBoostValue;
    }
  }
  ```
- Add `magicComboBoostValue` to returned breakdown
- Add `magicComboLookup` to `buildContext` destructuring + return
- Add `magicComboLookup` param to `reorderByRelevance`

#### 3. `src/hooks/use-learned-weights.ts`

- Add imports: `MagicCombosData`, `buildMagicComboLookup`, `MagicComboLookup`
- Add `cachedMagicComboLookup` module variable
- Add `magicComboLookup` to return type, state, cache shortcut, parallel fetch, processing block, return value
- Version bump: 5.0.0 → 6.0.0

#### 4. `src/components/providers/prompt-builder.tsx`

- Destructure `magicComboLookup` from `useLearnedWeights()`
- Pass to `reorderByRelevance()` call
- Add to `useMemo` dependency array

#### 5. `src/lib/learning/__tests__/magic-combo-integration.test.ts` (NEW, ~400 lines, ~16 tests)

End-to-end integration tests:

1. Events → magic combos → lookup → non-zero boost
2. Two of three terms selected → third gets boosted
3. One of three terms selected → no boost (need N-1 of N)
4. Non-combo terms → zero boost
5. Null lookup → zero boost (backward compat)
6. Empty selectedTerms → zero boost
7. lookupMagicComboInfo returns combo data + matched terms
8. Trio vs quad detection
9. Synergy score correctness (trio outcome − best pair)
10. Tier-first → global fallback
11. Null tier → global only
12. buildMagicComboLookup(null) → null
13. Lookup preserves eventCount
14. Self-reference edge case (option already in selectedTerms)
15. Multiple combos match → highest synergy wins
16. Low synergy combos filtered out (below MIN_SYNERGY)

---

## § 6. Boost Weight Rationale

| Phase                 | Weight  | Type            | Rationale                                  |
| --------------------- | ------- | --------------- | ------------------------------------------ |
| Co-occurrence (5)     | **+20** | Boost (blended) | Terms that appear together — common signal |
| Anti-pattern (7.1)    | **-30** | Penalty         | Actively hurts quality — toxic pair        |
| Collision (7.1)       | **-20** | Penalty         | Competing roles — quality drops            |
| Weak term (7.2)       | **-15** | Penalty         | Users keep replacing it                    |
| Redundancy (7.3)      | **-12** | Penalty         | Functional synonyms — wasteful             |
| **Magic combo (7.4)** | **+25** | **Boost**       | **Emergent synergy — whole > parts**       |

Magic combos get a strong boost because:

- The signal is rare and high-quality (requires 5+ events, measurable synergy)
- Co-occurrence captures pair frequency; magic combos capture **emergent quality**
- The user is one term away from a proven excellent combination
- This is the first **positive** learned signal beyond co-occurrence
- +25 matches `clusterMax` (curated intelligence cap) — learned signal on par with curated

---

## § 7. Distinction from Co-occurrence (Phase 5)

| Aspect           | Co-occurrence (Phase 5)                            | Magic Combos (7.4)                                       |
| ---------------- | -------------------------------------------------- | -------------------------------------------------------- |
| **Detection**    | Terms that appear together frequently              | Terms where the group outperforms subsets                |
| **Meaning**      | "These are popular together"                       | "These have emergent chemistry"                          |
| **Size**         | Pairs (2 terms)                                    | Trios + Quads (3–4 terms)                                |
| **Category**     | Cross-category                                     | Cross-category                                           |
| **Key metric**   | Weighted co-occurrence count                       | Synergy = combo outcome − best subset outcome            |
| **Activation**   | Any selected term boosts its co-occurring partners | Must have N-1 of N terms selected (completing the combo) |
| **Weight**       | +20 (blended with curated via blend ratio)         | +25 (direct, scaled by synergy)                          |
| **User message** | "Popular pairing"                                  | "One term completes a winning combination"               |

---

## § 8. Verification

After all 5 parts:

```powershell
# PowerShell, repo root: frontend
pnpm run typecheck
pnpm run lint
pnpm test -- --testPathPattern="magic-combo"
```

**Good looks like:**

- Zero TypeScript errors
- Zero lint warnings
- All magic-combo tests green (mining + integration)
- All existing tests still pass (backward compat)
- When `PHASE_7_LEARNING_ENABLED=false` or no cron data: zero magic combo boost everywhere
- Suggestion engine score calculation unchanged when lookup is null
- Co-occurrence boost still works independently (no interference)

---

## § 9. Phase 7.3 → 7.4 Checklist

Before starting 7.4, confirm Phase 7.3 is fully merged:

- [ ] 7.3a: Constants (REDUNDANCY_GROUPS_KEY + 6 thresholds)
- [ ] 7.3b: Redundancy detection engine
- [ ] 7.3c: Redundancy lookup module
- [ ] 7.3d: Cron Layer 12 + GET API route
- [ ] 7.3e: Suggestion engine integration + tests

Phase 7.4 builds on top of these. The aggregate route will be at version 6.0.0 (from 5.0.0 after 7.3d). The constants file will be at version 5.0.0 (from 4.0.0 after 7.3a).

---

## § 10. Estimated Output Size

Based on Month 4 projections (~30,000 events):

| Component                | Estimate                                |
| ------------------------ | --------------------------------------- |
| Frequent terms (Level 1) | ~200–500 per tier                       |
| Frequent pairs (Level 2) | ~2,000–5,000 per tier                   |
| Magic trios (Level 3)    | ~30–100 per tier                        |
| Magic quads (Level 4)    | ~5–20 per tier                          |
| JSON size                | ~20KB (matches evolution plan estimate) |

The Apriori pruning is aggressive — most terms don't form frequent pairs, and most pairs don't form synergistic trios. The final output is compact.
