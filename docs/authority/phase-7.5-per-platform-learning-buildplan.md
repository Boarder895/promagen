# Phase 7.5 — Per-Platform Learning (42 Individual Models)

## Build Plan

**Authority:** `docs/authority/prompt-builder-evolution-plan-v2.md` § 7.5
**Effort:** 1 day across 5 parts (7.5a–e)
**Depends on:** Phase 6 (term quality scoring, outcome-score, weight recalibration), Phase 5 (co-occurrence, flattenSelections)
**Feature gate:** Reuses `PHASE_7_LEARNING_ENABLED` env var (no new flag)

---

## § 1. What This Phase Does

The system already learns per-TIER (4 tiers). But within Tier 1 alone there are 13 platforms, and "neon glow" might score brilliantly on Leonardo yet struggle on NightCafe. Phase 7.5 adds a per-PLATFORM learning layer for all 42 AI image generation platforms.

**The problem (from evolution plan):**

| What we have (Phase 6)          | What's missing (Phase 7.5)                   |
| ------------------------------- | -------------------------------------------- |
| Per-tier term quality scores    | Per-PLATFORM term quality scores             |
| 4 scoring models (one per tier) | 42 scoring models (one per platform)         |
| "Style X is good on Tier 1"     | "Style X is 92% on Leonardo, 41% on Craiyon" |
| Tier-level co-occurrence        | Platform-level co-occurrence patterns        |

**What this enables:**

- Platform-specific dropdown ordering (Leonardo users see different top terms than NightCafe users)
- "golden hour works brilliantly on Midjourney (94%) but poorly on Craiyon (41%)" — surfaceable insight
- Per-platform co-occurrence: term pairs that work on one platform but not another
- Foundation for future per-platform compression profiles (Phase 7.9) and A/B testing (Phase 7.6)
- Data for Admin Command Centre "Per-Platform Quality" section (Phase 7.11)

**The competitive moat:**

> Nobody can replicate this because nobody else has platform-spanning data across 42 platforms and 4 tiers. — evolution plan § 17

**Key design: confidence blending (cold start)**

Most platforms won't have 500+ events on day one. The system uses tier-level data as the fallback and blends in platform-specific data as confidence grows:

```
finalScore = (platformScore × platformConfidence) + (tierScore × (1 - platformConfidence))

platformConfidence = min(1.0, platformEventCount / CONFIDENCE_THRESHOLD)
```

At 0 events → pure tier data (existing behaviour).
At 250 events → 50/50 blend.
At 500+ events → pure platform data.

This means **zero regression risk** — platforms with no data see exactly the same behaviour as today.

---

## § 2. Algorithm

### Per-Platform Term Quality Scoring

The same z-score algorithm from Phase 6 (`computeTermQualityScores`), applied per platform within each tier:

```
For each tier (1–4):
  For each platform with >= MIN_PLATFORM_EVENTS (50) events in this tier:
    For each term with >= MIN_EVENTS_PER_TERM (5) appearances on this platform:
      1. Collect all events containing this term on this platform
      2. meanOutcome = mean(weightedOutcome for those events)
      3. platformMean = mean(all outcomes for this platform)
      4. platformStdDev = stddev(all outcomes for this platform)
      5. z = (meanOutcome - platformMean) / platformStdDev
      6. score = 50 + (z × 15), clamped [0, 100]
```

The output parallels `TermQualityScores` but with a platform sub-layer.

### Per-Platform Co-occurrence

The existing co-occurrence matrix (Phase 5) is recomputed with an additional platform partition:

```
For each tier:
  For each platform with >= MIN_PLATFORM_EVENTS events:
    Extract events for this (tier, platform) pair
    Compute co-occurrence pairs using existing algorithm
    Normalize weights to 0–100
```

Since the existing `computeCoOccurrenceMatrix` already tracks `platformSet` per pair, the platform partition is a lightweight grouping step — not a full rewrite.

### Confidence Blending (Lookup)

The lookup bridges merge platform-specific and tier-level scores:

```typescript
function blendedTermQuality(
  term: string,
  platformId: string,
  tier: number,
  platformLookup: PlatformTermQualityLookup,
  tierLookup: TermQualityLookup, // existing Phase 6
): number {
  const platformScore = platformLookup.getScore(term, platformId, tier);
  const tierScore = tierLookup.getScore(term, tier);
  const confidence = platformLookup.getConfidence(platformId, tier);

  if (platformScore == null) return tierScore ?? 50; // fallback
  if (tierScore == null) return platformScore;

  return platformScore * confidence + tierScore * (1 - confidence);
}
```

Fallback chain: **platform-specific → tier-level → global → neutral (50)**

---

## § 3. Data Shapes

### PlatformTermQualityData (stored in learned_weights)

```typescript
/** Quality data for a single term on a specific platform */
export interface PlatformTermQuality {
  /** Human-readable score: 0–100 (50 = average) */
  score: number;
  /** How many events include this term on this platform */
  eventCount: number;
  /** Change vs last run: score delta, clamped [-1, +1] */
  trend: number;
}

/** Per-platform slice within a tier */
export interface PlatformTermSlice {
  /** Total events for this platform in this tier */
  eventCount: number;
  /** Confidence 0–1 = min(1.0, eventCount / CONFIDENCE_THRESHOLD) */
  confidence: number;
  /** Platform slug (e.g. "leonardo", "midjourney") */
  platformId: string;
  /** Term → quality data */
  terms: Record<string, PlatformTermQuality>;
  /** How many terms scored */
  termCount: number;
}

/** Per-tier container holding platform slices */
export interface TierPlatformTermQuality {
  /** Total events across all platforms in this tier */
  eventCount: number;
  /** Platform slices keyed by platform ID */
  platforms: Record<string, PlatformTermSlice>;
  /** How many platforms have data */
  platformCount: number;
}

/** Complete output — stored in learned_weights table */
export interface PlatformTermQualityData {
  /** Schema version */
  version: string;
  /** ISO timestamp */
  generatedAt: string;
  /** Total events processed */
  eventCount: number;
  /** Per-tier results (keys: "1", "2", "3", "4") */
  tiers: Record<string, TierPlatformTermQuality>;
  /** Metadata */
  totalPlatforms: number;
  totalTermsScored: number;
}
```

### PlatformCoOccurrenceData (stored in learned_weights)

```typescript
/** Per-platform co-occurrence slice within a tier */
export interface PlatformCoOccurrenceSlice {
  /** Platform ID */
  platformId: string;
  /** Total events for this platform in this tier */
  eventCount: number;
  /** Confidence 0–1 */
  confidence: number;
  /** Co-occurrence pairs (same shape as existing TierCoOccurrence.pairs) */
  pairs: Array<{
    terms: [string, string];
    weight: number;
    count: number;
  }>;
  /** Number of pairs */
  pairCount: number;
}

/** Per-tier container */
export interface TierPlatformCoOccurrence {
  eventCount: number;
  platforms: Record<string, PlatformCoOccurrenceSlice>;
  platformCount: number;
}

/** Complete output */
export interface PlatformCoOccurrenceData {
  version: string;
  generatedAt: string;
  eventCount: number;
  tiers: Record<string, TierPlatformCoOccurrence>;
  totalPlatforms: number;
  totalPairs: number;
}
```

### Lookup Types

```typescript
/** Fast lookup for platform term quality */
export interface PlatformTermQualityLookup {
  /** Per-tier → per-platform → Map<term, score> */
  tiers: Record<string, Record<string, Map<string, number>>>;
  /** Per-tier → per-platform → confidence 0–1 */
  confidences: Record<string, Record<string, number>>;
  /** Total events that produced this data */
  eventCount: number;
}

/** Fast lookup for platform co-occurrence */
export interface PlatformCoOccurrenceLookup {
  /** Per-tier → per-platform → Map<pairKey, weight> */
  tiers: Record<string, Record<string, Map<string, number>>>;
  /** Per-tier → per-platform → confidence 0–1 */
  confidences: Record<string, Record<string, number>>;
  /** Total events */
  eventCount: number;
}
```

---

## § 4. File Map

### New files (7)

| File                                                               | Part | Lines (est) | Purpose                                           |
| ------------------------------------------------------------------ | ---- | ----------- | ------------------------------------------------- |
| `src/lib/learning/platform-term-quality.ts`                        | 7.5b | ~350        | Per-platform term quality mining engine           |
| `src/lib/learning/platform-term-quality-lookup.ts`                 | 7.5c | ~250        | Blending lookup bridge (platform → tier → global) |
| `src/lib/learning/platform-co-occurrence.ts`                       | 7.5b | ~300        | Per-platform co-occurrence mining engine          |
| `src/lib/learning/platform-co-occurrence-lookup.ts`                | 7.5c | ~220        | Blending co-occurrence lookup bridge              |
| `src/app/api/learning/platform-term-quality/route.ts`              | 7.5d | ~85         | GET API endpoint                                  |
| `src/app/api/learning/platform-co-occurrence/route.ts`             | 7.5d | ~85         | GET API endpoint                                  |
| `src/lib/learning/__tests__/platform-learning-integration.test.ts` | 7.5e | ~400        | End-to-end integration tests                      |

### Modified files (6)

| File                                                       | Part | Changes                                                                                         |
| ---------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------- |
| `src/lib/learning/constants.ts`                            | 7.5a | +6 constants, version bump 5.0.0 → 6.0.0                                                        |
| `src/app/api/learning/aggregate/route.ts`                  | 7.5d | +Layer 14 (two sub-layers), +imports, +response fields, version 6→7                             |
| `src/lib/prompt-intelligence/types.ts`                     | 7.5e | +2 fields (PromptContext: platformId, platformTermQualityLookup, platformCoOccurrenceLookup)    |
| `src/lib/prompt-intelligence/engines/suggestion-engine.ts` | 7.5e | +imports, +blending logic in scoreOption, +BuildContextInput fields, +reorderByRelevance params |
| `src/hooks/use-learned-weights.ts`                         | 7.5e | +2 fetches, +2 caches, +2 state vars, +2 return fields, version 6→7                             |
| `src/components/providers/prompt-builder.tsx`              | 7.5e | +destructure, +pass platformId + lookups to reorderByRelevance, +deps                           |

### Untouched files

| File                                       | Reason                                                       |
| ------------------------------------------ | ------------------------------------------------------------ |
| `src/lib/learning/term-quality-scoring.ts` | Phase 6 per-tier scoring — untouched, used as fallback       |
| `src/lib/learning/co-occurrence.ts`        | Phase 5 per-tier co-occurrence — untouched, used as fallback |
| `src/lib/learning/co-occurrence-lookup.ts` | Phase 5 per-tier lookup — untouched, called for fallback     |
| `src/lib/learning/outcome-score.ts`        | Reused as-is (computeOutcomeScore)                           |
| `src/lib/learning/decay.ts`                | Reused as-is (decay weighting)                               |
| `src/lib/learning/database.ts`             | Already has upsertLearnedWeights — reuse as-is               |
| `src/data/platform-tiers.ts`               | Read-only reference for tier membership                      |
| `src/data/providers/providers.json`        | Read-only reference for platform list                        |

---

## § 5. Build Parts

### Part 7.5a — Constants (0.05d)

**File:** `src/lib/learning/constants.ts` (~6 new lines)

Add to `LEARNING_CONSTANTS`:

```typescript
// ── Phase 7.5: Per-Platform Learning ─────────────────────────────
/** Storage key for per-platform term quality in learned_weights */
PLATFORM_TERM_QUALITY_KEY: 'platform-term-quality',
/** Storage key for per-platform co-occurrence in learned_weights */
PLATFORM_CO_OCCURRENCE_KEY: 'platform-co-occurrence',
/** Min events a platform needs within a tier before scoring begins */
PLATFORM_MIN_EVENTS: 50,
/** Events needed for full platform confidence (0→1 scale) */
PLATFORM_CONFIDENCE_THRESHOLD: 500,
/** Max terms stored per platform per tier (payload cap) */
PLATFORM_MAX_TERMS: 500,
/** Max co-occurrence pairs stored per platform per tier */
PLATFORM_MAX_PAIRS: 300,
```

Version bump: 5.0.0 → 6.0.0

**Backward compatible:** Constants only — no behaviour change.

---

### Part 7.5b — Mining Engines (0.25d)

**Two new files — pure computation, no I/O.**

#### File 1: `src/lib/learning/platform-term-quality.ts` (~350 lines, NEW)

**Exported function:**

```typescript
export function computePlatformTermQuality(
  events: PromptEventRow[],
  previousData?: PlatformTermQualityData | null,
): PlatformTermQualityData | null;
```

**Algorithm:**

1. Group events by `(tier, platform)` using two-level Map
2. For each (tier, platform) pair with >= `PLATFORM_MIN_EVENTS` events:
   a. Compute weighted outcome per event (reuse `computeOutcomeScore` × confidence from Phase 7.1a)
   b. Compute global mean + stddev for this platform-tier slice
   c. For each term with >= `MIN_EVENTS_PER_TERM` (5) appearances:
   - meanOutcome = mean of weighted outcomes for events containing this term
   - z = (meanOutcome − platformMean) / platformStdDev
   - score = 50 + (z × 15), clamped [0, 100]
   - trend = delta vs previous score, clamped [-1, +1]
     d. Sort by score descending, trim to `PLATFORM_MAX_TERMS`
     e. Compute `confidence = min(1.0, eventCount / CONFIDENCE_THRESHOLD)`
3. Assemble `PlatformTermQualityData` with per-tier-per-platform slices

**Guard rails:**

- If total events < 50, return null (not enough data for any platform)
- Platforms with < `PLATFORM_MIN_EVENTS` events are excluded entirely (not enough data to judge)
- `MAX_TERMS` cap per platform prevents 42 × 2000 = 84K terms (capped at 42 × 500 = 21K worst case)

**Test file:** `src/lib/learning/__tests__/platform-term-quality.test.ts` (~300 lines, 15 tests)

Tests:

- Null/empty/insufficient events → null
- Single platform, single tier → correct z-score scores
- Multi-platform → independent scoring per platform
- Confidence calculation: 50 events → 0.1, 250 → 0.5, 500+ → 1.0
- Term frequency filter: terms with <5 events excluded
- MAX_TERMS cap: only top N terms kept
- Trend calculation vs previous data
- Event count tracking per platform per tier
- Metadata: version, generatedAt, totalPlatforms, totalTermsScored

#### File 2: `src/lib/learning/platform-co-occurrence.ts` (~300 lines, NEW)

**Exported function:**

```typescript
export function computePlatformCoOccurrence(
  events: PromptEventRow[],
): PlatformCoOccurrenceData | null;
```

**Algorithm:**

1. Group events by `(tier, platform)` (reuse same grouping as term quality)
2. For each (tier, platform) pair with >= `PLATFORM_MIN_EVENTS` events:
   a. Flatten selections per event via `flattenSelections()`
   b. Generate all term pairs per event
   c. Accumulate pair counts + mean weighted outcome
   d. Normalise weights to 0–100
   e. Trim to `PLATFORM_MAX_PAIRS` per platform
   f. Compute confidence
3. Assemble `PlatformCoOccurrenceData`

This is a lighter version of `computeCoOccurrenceMatrix` (Phase 5) — same core loop but partitioned by platform and without decay weighting (the existing tier-level matrix handles decay). Platform co-occurrence captures the platform-SPECIFIC pair preferences above what the tier already knows.

**Test file:** `src/lib/learning/__tests__/platform-co-occurrence.test.ts` (~250 lines, 12 tests)

Tests:

- Null/empty/insufficient → null
- Single platform → correct pair weights
- Multi-platform → independent matrices
- Confidence matches event count
- MAX_PAIRS cap
- Pair weight normalisation 0–100
- Term alphabetical ordering in pair keys
- Cross-tier isolation (same platform, different tiers = separate)

---

### Part 7.5c — Lookup Bridges (0.2d)

**Two new files — O(1) lookup with confidence blending.**

#### File 1: `src/lib/learning/platform-term-quality-lookup.ts` (~250 lines, NEW)

**Exported functions:**

```typescript
/** Build fast lookup from cron data */
export function buildPlatformTermQualityLookup(
  data: PlatformTermQualityData | null | undefined,
): PlatformTermQualityLookup | null;

/** Blended term quality score: platform → tier → global fallback */
export function lookupPlatformTermQuality(
  term: string,
  platformId: string | null,
  tier: number | null,
  platformLookup: PlatformTermQualityLookup | null,
  tierFallbackScore: number | null, // from existing Phase 6 lookup
): number;
```

**Blending logic:**

```typescript
function lookupPlatformTermQuality(term, platformId, tier, lookup, tierFallback) {
  if (!lookup || !platformId || tier == null) return tierFallback ?? 50;

  const tierData = lookup.tiers[String(tier)];
  if (!tierData) return tierFallback ?? 50;

  const platformMap = tierData[platformId];
  if (!platformMap) return tierFallback ?? 50;

  const platformScore = platformMap.get(term);
  if (platformScore == null) return tierFallback ?? 50;

  const confidence = lookup.confidences[String(tier)]?.[platformId] ?? 0;
  const fallback = tierFallback ?? 50;

  return platformScore * confidence + fallback * (1 - confidence);
}
```

**Test file:** `src/lib/learning/__tests__/platform-term-quality-lookup.test.ts` (~200 lines, 15 tests)

Tests:

- Null lookup → returns tier fallback
- Null platformId → returns tier fallback
- Full confidence (1.0) → pure platform score
- Zero confidence (0.0) → pure tier fallback
- Partial confidence (0.5) → exact 50/50 blend
- Unknown platform → tier fallback
- Unknown term → tier fallback (50)
- buildPlatformTermQualityLookup: null → null, valid data → indexed maps

#### File 2: `src/lib/learning/platform-co-occurrence-lookup.ts` (~220 lines, NEW)

Same pattern as term quality but for co-occurrence pairs:

```typescript
export function buildPlatformCoOccurrenceLookup(
  data: PlatformCoOccurrenceData | null | undefined,
): PlatformCoOccurrenceLookup | null;

export function lookupPlatformCoOccurrence(
  candidate: string,
  selectedTerms: string[],
  platformId: string | null,
  tier: number | null,
  platformLookup: PlatformCoOccurrenceLookup | null,
  tierFallbackScore: number, // from existing Phase 5 lookup
): number;
```

Blending identical to term quality: `platformWeight × confidence + tierWeight × (1 - confidence)`.

**Test file:** `src/lib/learning/__tests__/platform-co-occurrence-lookup.test.ts` (~200 lines, 12 tests)

---

### Part 7.5d — Cron Layer 14 + GET Routes (0.15d)

**Modified:** `src/app/api/learning/aggregate/route.ts`

Add Layer 14 after Layer 13 (magic combos), gated by `isPhase7Enabled()`.

Layer 14 has two sub-layers that run in parallel (no inter-dependencies):

```typescript
// ── Layer 14a: Per-Platform Term Quality (Phase 7.5) ─────────
// ── Layer 14b: Per-Platform Co-occurrence (Phase 7.5) ────────

if (!isTimedOut()) {
  const [platformTermQualityData, platformCoOccurrenceData] = await Promise.all([
    Promise.resolve(computePlatformTermQuality(antiPatternEvents, previousPlatformTermQuality)),
    Promise.resolve(computePlatformCoOccurrence(antiPatternEvents)),
  ]);

  // Upsert results...
}
```

Both sub-layers reuse `antiPatternEvents` (the ALL-events set, no new DB query).

**Response fields added:**

```typescript
// Phase 7.5 additions
platformTermQualityGenerated: boolean;
platformTermQualityPlatformCount: number;
platformCoOccurrenceGenerated: boolean;
platformCoOccurrencePlatformCount: number;
```

Version bump: 6.0.0 → 7.0.0 (in file header comment only).

**New routes (2):**

| Route                                      | File                                                   | Pattern matches   |
| ------------------------------------------ | ------------------------------------------------------ | ----------------- |
| `GET /api/learning/platform-term-quality`  | `src/app/api/learning/platform-term-quality/route.ts`  | redundancy-groups |
| `GET /api/learning/platform-co-occurrence` | `src/app/api/learning/platform-co-occurrence/route.ts` | redundancy-groups |

Both follow the identical pattern:

- `ensureAllTables()` → `getLearnedWeights<T>(KEY)` → JSON response
- Cache: `s-maxage=300, stale-while-revalidate=600`
- Short cache when no data: `s-maxage=60, stale-while-revalidate=120`
- Runtime: `nodejs`, dynamic: `force-dynamic`

---

### Part 7.5e — Suggestion Engine Integration + Tests (0.35d)

**Modified:** `src/lib/prompt-intelligence/types.ts`

Add to `PromptContext`:

```typescript
/** Platform ID for platform-specific scoring (Phase 7.5, null = no platform) */
platformId: string | null;

/** Pre-built platform term quality lookup (Phase 7.5, null = no data) */
platformTermQualityLookup: PlatformTermQualityLookup | null;

/** Pre-built platform co-occurrence lookup (Phase 7.5, null = no data) */
platformCoOccurrenceLookup: PlatformCoOccurrenceLookup | null;
```

No new breakdown fields — platform learning doesn't add a new score component. It **refines** the existing term quality and co-occurrence scores by blending in platform-specific data.

**Modified:** `src/lib/prompt-intelligence/engines/suggestion-engine.ts`

Changes to `scoreOption()`:

1. **Term quality blending** — if `context.platformTermQualityLookup` is present, the existing term quality component (from Phase 6) is blended with platform-specific data using confidence weighting. The term quality score is currently not a separate scoring component in the suggestion engine (it's part of the Phase 6 scorer health), so this integration point is the co-occurrence boost and any future term-quality component.

2. **Co-occurrence blending** — the existing co-occurrence boost (`SCORE_WEIGHTS.coOccurrenceMax: 20`) is enhanced:

```typescript
// EXISTING (Phase 5 — tier only)
let coOccurrenceBoostValue = 0;
if (context.coOccurrenceWeights) {
  const tierWeight = lookupCoOccurrence(
    option,
    context.selectedTerms,
    context.tier,
    context.coOccurrenceWeights,
  );
  coOccurrenceBoostValue = Math.round((SCORE_WEIGHTS.coOccurrenceMax * tierWeight) / 100);
}

// NEW (Phase 7.5 — blended platform + tier)
let coOccurrenceBoostValue = 0;
if (context.coOccurrenceWeights) {
  const tierWeight = lookupCoOccurrence(
    option,
    context.selectedTerms,
    context.tier,
    context.coOccurrenceWeights,
  );

  // Blend with platform-specific co-occurrence if available
  const blendedWeight = lookupPlatformCoOccurrence(
    option,
    context.selectedTerms,
    context.platformId,
    context.tier,
    context.platformCoOccurrenceLookup,
    tierWeight, // tier fallback
  );

  coOccurrenceBoostValue = Math.round((SCORE_WEIGHTS.coOccurrenceMax * blendedWeight) / 100);
}
```

The blending is transparent — when no platform data exists, `lookupPlatformCoOccurrence` returns the tier fallback exactly, producing identical scores to today.

Changes to `BuildContextInput`:

```typescript
/** Platform ID for platform-specific scoring (Phase 7.5) */
platformId?: string | null;

/** Pre-built platform term quality lookup from Phase 7.5 (null = no data) */
platformTermQualityLookup?: PlatformTermQualityLookup | null;

/** Pre-built platform co-occurrence lookup from Phase 7.5 (null = no data) */
platformCoOccurrenceLookup?: PlatformCoOccurrenceLookup | null;
```

Changes to `reorderByRelevance()`:

```typescript
export function reorderByRelevance(
  options: string[],
  category: PromptCategory,
  selections: Partial<Record<PromptCategory, string[]>>,
  marketMoodEnabled = false,
  marketState: MarketState | null = null,
  tier: number | null = null,
  coOccurrenceWeights: CoOccurrenceLookup | null = null,
  blendRatio: [number, number] = [1.0, 0.0],
  antiPatternLookup: AntiPatternLookup | null = null,
  collisionLookup: CollisionLookup | null = null,
  weakTermLookup: WeakTermLookup | null = null,
  redundancyLookup: RedundancyLookup | null = null,
  comboLookup: ComboLookup | null = null,
  // Phase 7.5 additions:
  platformId: string | null = null,
  platformTermQualityLookup: PlatformTermQualityLookup | null = null,
  platformCoOccurrenceLookup: PlatformCoOccurrenceLookup | null = null,
): ScoredOption[];
```

**Modified:** `src/hooks/use-learned-weights.ts`

Add:

- 2 new imports (`buildPlatformTermQualityLookup`, `buildPlatformCoOccurrenceLookup`)
- 2 new module-level cache vars
- 2 new `useState` calls
- 2 new parallel `fetch()` calls in `fetchWeights`
- 2 new processing blocks
- 2 new return fields

The hook now fetches 8 endpoints in parallel (was 7 after Phase 7.4):

```typescript
const [
  coOccResponse,
  scoringResponse,
  antiPatternResponse,
  collisionResponse,
  iterationResponse,
  redundancyResponse,
  comboResponse,
  platformTermQualityResponse,
  platformCoOccurrenceResponse,
] = await Promise.allSettled([
  // ... existing 7 ...
  fetch('/api/learning/platform-term-quality'),
  fetch('/api/learning/platform-co-occurrence'),
]);
```

Version bump: 6.0.0 → 7.0.0

**Modified:** `src/components/providers/prompt-builder.tsx`

```typescript
const {
  coOccurrenceLookup,
  blendRatio: learnedBlendRatio,
  antiPatternLookup,
  collisionLookup,
  weakTermLookup,
  redundancyLookup,
  comboLookup,
  platformTermQualityLookup, // NEW
  platformCoOccurrenceLookup, // NEW
} = useLearnedWeights();

// In reorderByRelevance call:
const scoredOptions = reorderByRelevance(
  config.options,
  category,
  selections,
  isMarketMoodEnabled,
  marketState,
  platformTier,
  coOccurrenceLookup,
  learnedBlendRatio,
  antiPatternLookup,
  collisionLookup,
  weakTermLookup,
  redundancyLookup,
  comboLookup,
  platformId, // NEW — already in scope
  platformTermQualityLookup, // NEW
  platformCoOccurrenceLookup, // NEW
);
```

**New test file:** `src/lib/learning/__tests__/platform-learning-integration.test.ts` (~400 lines)

End-to-end tests covering:

1. Events with single platform → produces platform-specific scores
2. Events with multiple platforms → independent per-platform scoring
3. Confidence blending: 0 events = tier only, 500 events = platform only
4. Null lookup → backward compatible (tier scores unchanged)
5. Unknown platform → tier fallback
6. Cross-tier isolation
7. Platform co-occurrence: platform-specific pairs blend with tier pairs
8. Full pipeline: events → mining → lookup → blended score
9. Term ordering changes between platforms (Leonardo vs NightCafe reorder differently)

---

## § 6. Scoring Impact

### Before Phase 7.5 (current)

All users on the same tier see identical dropdown ordering. "neon glow" ranks the same whether you're using Leonardo or NightCafe.

### After Phase 7.5

Users on Leonardo see "neon glow" ranked higher than NightCafe users, because the platform-specific data shows Leonardo handles it better.

| Signal                        | Weight             | Source        |
| ----------------------------- | ------------------ | ------------- |
| Co-occurrence boost (tier)    | +20 max (existing) | Phase 5       |
| Co-occurrence boost (blended) | +20 max (refined)  | **Phase 7.5** |
| Anti-pattern penalty          | -30 max            | Phase 7.1     |
| Collision penalty             | -20 max            | Phase 7.1     |
| Weak term penalty             | -15 max            | Phase 7.2     |
| Redundancy penalty            | -12 max            | Phase 7.3     |
| Magic combo boost             | +25 max            | Phase 7.4     |

Phase 7.5 does NOT add a new scoring dimension. It **refines** the existing co-occurrence boost by blending in platform-specific co-occurrence data. The per-platform term quality data is stored and served, ready for the health scorer integration (Phase 6 already reads `TermQualityScores` — a future mini-step can read `PlatformTermQualityData` too).

---

## § 7. Payload Budget

Worst-case calculation (all 42 platforms active on all 4 tiers):

| Data type     | Per platform per tier | × 42 platforms × 4 tiers | Total   |
| ------------- | --------------------- | ------------------------ | ------- |
| Term quality  | 500 terms × ~40 bytes | 500 × 40 × 42 × 4        | ~3.4 MB |
| Co-occurrence | 300 pairs × ~50 bytes | 300 × 50 × 42 × 4        | ~2.5 MB |

Reality: most platforms will have <50 events and be excluded. Expected: 8–12 platforms with data (the popular ones). Realistic payload: ~200–400 KB for term quality, ~150–300 KB for co-occurrence.

**s-maxage=300** (5-min CDN cache) keeps payload serving fast. The hook fetches once, then caches module-level.

---

## § 8. Testing Strategy

| Test file                               | Part | Tests (est) | Coverage                                        |
| --------------------------------------- | ---- | ----------- | ----------------------------------------------- |
| `platform-term-quality.test.ts`         | 7.5b | 15          | Mining engine: z-scores, grouping, caps, trends |
| `platform-co-occurrence.test.ts`        | 7.5b | 12          | Mining engine: pairs, grouping, normalisation   |
| `platform-term-quality-lookup.test.ts`  | 7.5c | 15          | Blending: confidence scaling, fallback chain    |
| `platform-co-occurrence-lookup.test.ts` | 7.5c | 12          | Blending: pair lookup, confidence, fallback     |
| `platform-learning-integration.test.ts` | 7.5e | 12          | Full pipeline: events → mining → lookup → score |
| **TOTAL**                               |      | **~66**     |                                                 |

All tests are pure computation — no mocking, no I/O. Same pattern as Phase 7.1–7.4.

---

## § 9. Environment Variables

No new env vars. Layer 14 is gated by the existing `PHASE_7_LEARNING_ENABLED=true`.

---

## § 10. Backward Compatibility

| When                                      | Behaviour                                                                   |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| `PHASE_7_LEARNING_ENABLED=false`          | Layer 14 skipped, no platform data computed                                 |
| Cron hasn't run yet                       | Both lookups null → blending returns tier fallback → identical to Phase 7.4 |
| Platform has < 50 events                  | Excluded from mining → no platform data → tier fallback                     |
| Platform confidence = 0                   | Blend formula: `0 × platform + 1 × tier` = pure tier                        |
| platformId is null (no provider selected) | Lookup returns tier fallback → identical to Phase 7.4                       |

**Zero regression risk.** Every new code path produces identical output to the existing system when platform data is absent.

---

## § 11. Future Considerations (NOT in scope)

These are mentioned in the evolution plan but are separate phases:

- **Per-platform scoring weights** (weight recalibration per platform) — Phase 7.5 is term quality + co-occurrence only
- **Platform update detection** — Phase 7.8 (Temporal Intelligence)
- **Per-platform compression profiles** — Phase 7.9
- **Admin visualisation of per-platform data** — Phase 7.11
- **Cross-platform pollination** ("Leonardo users also like X on NightCafe") — future extension

---

_End of document. Version 1.0.0. 2026-02-26._
