# Phase 7.8 — Temporal Intelligence Build Plan

**Version:** 1.0.0  
**Created:** 2026-02-28  
**Status:** PLAN — Not yet built  
**Authority:** `docs/authority/prompt-builder-evolution-plan-v2.md` § 7.8  
**Depends on:** Phase 6 (Self-Improving Scorer)  
**Estimated effort:** 1 day (4 build parts)

---

## 1. What This Is

Temporal Intelligence adds **time-awareness** to the learning pipeline. Right now, the system treats every event the same regardless of when it happened. A "snow" term used in January and a "snow" term used in July both contribute equally. That's wrong — "snow" in January is expected; "snow" in July is niche. The system should know the difference.

### Three capabilities

| Capability            | What it detects                                                          | Output file            | Consumer                                                                             |
| --------------------- | ------------------------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------ |
| **Seasonal patterns** | "snow" 340% more popular Nov–Feb, "golden hour" peaks in spring/autumn   | `temporal-boosts.json` | Suggestion engine (boost/dampen term scores based on current month)                  |
| **Weekly patterns**   | Weekend prompts 40% more experimental; weekday prompts more professional | `temporal-boosts.json` | Suggestion engine (weekday/weekend preference shift)                                 |
| **Trending terms**    | Terms gaining or losing popularity in the last 7 days vs prior 30 days   | `trending-terms.json`  | Suggestion engine (small boost for trending-up terms) + Admin dashboard (Phase 7.11) |

### What it does NOT do (yet)

Platform update detection (MJ v7 invalidating historical weights) is mentioned in the evolution plan as a planned pattern. This is architecturally distinct — it needs external platform release data and correlation-drop monitoring. I'm flagging it here as **deferred to Phase 7.8b** (a future follow-up) so the core temporal engine ships clean without scope creep.

**Idea (not implementing unless approved):** Platform update detection could watch for sudden correlation drops per-platform in the scorer health report. When a platform's score-outcome correlation drops below a threshold (e.g., 0.40) for 3+ consecutive days, auto-flag it as "learning period" and temporarily increase the curated blend weight for that platform. This would live in scorer-health.ts, not in temporal-intelligence.ts.

---

## 2. Architecture

### Data flow

```
prompt_events table (created_at TIMESTAMPTZ)
        │
        ▼
┌─────────────────────────────┐
│  Nightly Cron (Layer 16)    │
│  temporal-intelligence.ts   │
│                             │
│  1. Seasonal analysis       │
│  2. Weekly analysis         │
│  3. Trending velocity       │
│                             │
│  Writes to learned_weights: │
│  • 'temporal-boosts'        │
│  • 'trending-terms'         │
└─────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│  API Routes (GET)           │
│  /api/learning/temporal-boosts  │
│  /api/learning/trending-terms   │
└─────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│  temporal-lookup.ts         │
│  Client-side lookup fns     │
│  (same pattern as others)   │
└─────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│  Suggestion Engine          │
│  suggestion-engine.ts       │
│  New: temporalBoostLookup   │
│  (optional field on input)  │
└─────────────────────────────┘
```

### Integration pattern

Follows the exact same pattern as Phases 7.1–7.5:

1. **Engine file** (`temporal-intelligence.ts`) — pure functions, no I/O, fully testable
2. **Lookup file** (`temporal-lookup.ts`) — reads the JSON, provides fast lookups
3. **API route** — thin GET endpoint, reads from `learned_weights` table
4. **Cron layer** — new Layer 16 in `aggregate/route.ts`
5. **Constants** — new tuning constants in `constants.ts`
6. **Suggestion engine** — new optional `temporalLookup` field on `BuildContextInput`
7. **Tests** — unit tests for engine + lookup

### What already exists that we reuse

| Existing                                 | Used for                                                    |
| ---------------------------------------- | ----------------------------------------------------------- |
| `prompt_events.created_at` (TIMESTAMPTZ) | All temporal analysis — day-of-week, month, hour extraction |
| `prompt_events.selections` (JSONB)       | Term extraction for seasonal/trending analysis              |
| `prompt_events.tier` (SMALLINT)          | Per-tier temporal patterns                                  |
| `fetchQualifyingEvents()` in database.ts | Event retrieval (already returns created_at)                |
| `timeDecay()` in decay.ts                | Weight recent events for trending velocity                  |
| `learned_weights` table                  | Storage for temporal-boosts and trending-terms              |
| `upsertLearnedWeights()` in database.ts  | Write results                                               |
| Suggestion engine `BuildContextInput`    | Add new optional temporal lookup field                      |

### What does NOT exist yet

| New file                                                   | Lines (est.) | Purpose                                 |
| ---------------------------------------------------------- | ------------ | --------------------------------------- |
| `src/lib/learning/temporal-intelligence.ts`                | ~350         | Core engine: seasonal, weekly, trending |
| `src/lib/learning/temporal-lookup.ts`                      | ~120         | Client-side lookup functions            |
| `src/lib/learning/__tests__/temporal-intelligence.test.ts` | ~300         | Unit tests                              |
| `src/app/api/learning/temporal-boosts/route.ts`            | ~60          | GET endpoint for temporal boosts        |
| `src/app/api/learning/trending-terms/route.ts`             | ~60          | GET endpoint for trending terms         |

### Modified files

| File                                                       | Change                                                                        |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `src/lib/learning/constants.ts`                            | Add Phase 7.8 constants (~25 lines)                                           |
| `src/app/api/learning/aggregate/route.ts`                  | Add Layer 16 temporal intelligence (~40 lines)                                |
| `src/lib/prompt-intelligence/engines/suggestion-engine.ts` | Add `temporalLookup` to `BuildContextInput` + scoring integration (~30 lines) |
| `docs/authority/prompt-builder-evolution-plan-v2.md`       | Update 7.8 status to ✅ COMPLETE                                              |

---

## 3. Data Structures

### 3.1 Seasonal Boost Entry

Each entry tracks a term's popularity by month relative to its annual average.

```typescript
interface SeasonalBoost {
  /** The vocabulary term */
  term: string;
  /** Category the term belongs to */
  category: string;
  /** Month index (1–12) → boost multiplier.
   *  1.0 = average. 2.5 = 250% of average. 0.3 = 30% of average.
   *  Only months with significant deviation from 1.0 are stored. */
  monthlyBoosts: Partial<Record<number, number>>;
  /** Total events this term appeared in (confidence signal) */
  totalEvents: number;
}
```

### 3.2 Weekly Pattern Entry

```typescript
interface WeeklyPattern {
  /** The vocabulary term */
  term: string;
  /** Category */
  category: string;
  /** Day-of-week index (0=Sun, 6=Sat) → relative popularity.
   *  Only days with significant deviation stored. */
  dayBoosts: Partial<Record<number, number>>;
  /** Total events */
  totalEvents: number;
}
```

### 3.3 temporal-boosts.json structure

```typescript
interface TemporalBoostsData {
  /** ISO timestamp of when this was computed */
  computedAt: string;
  /** Events analysed */
  eventsAnalysed: number;
  /** Per-tier seasonal boosts */
  seasonal: Record<string, SeasonalBoost[]>; // key = tier (1-4)
  /** Per-tier weekly patterns */
  weekly: Record<string, WeeklyPattern[]>; // key = tier (1-4)
}
```

### 3.4 Trending Term Entry

```typescript
interface TrendingTerm {
  /** The vocabulary term */
  term: string;
  /** Category */
  category: string;
  /** Events in the recent window (last 7 days) */
  recentCount: number;
  /** Events in the baseline window (8–37 days ago) */
  baselineCount: number;
  /** Velocity: (recentRate - baselineRate) / baselineRate.
   *  Positive = trending up. Negative = trending down. */
  velocity: number;
  /** Direction: 'rising' | 'falling' | 'stable' */
  direction: 'rising' | 'falling' | 'stable';
}
```

### 3.5 trending-terms.json structure

```typescript
interface TrendingTermsData {
  /** ISO timestamp */
  computedAt: string;
  /** Events in recent window */
  recentWindowEvents: number;
  /** Events in baseline window */
  baselineWindowEvents: number;
  /** Per-tier trending terms (sorted by absolute velocity, descending) */
  trending: Record<string, TrendingTerm[]>; // key = tier (1-4)
}
```

---

## 4. Build Parts

### Part 7.8a — Constants + Types + Engine (pure functions)

**Scope:** Constants additions, type definitions, and the core `temporal-intelligence.ts` engine. All pure functions, no I/O, fully testable.

**New constants in `constants.ts`:**

```typescript
// ── Phase 7.8: Temporal Intelligence ────────────────────────────────────

/** Storage key for temporal boosts in learned_weights table */
TEMPORAL_BOOSTS_KEY: 'temporal-boosts',

/** Storage key for trending terms in learned_weights table */
TRENDING_TERMS_KEY: 'trending-terms',

/** Minimum events per term per month to include in seasonal analysis */
TEMPORAL_MIN_MONTHLY_EVENTS: 3,

/** Minimum total events for a term to be included in seasonal analysis */
TEMPORAL_MIN_TOTAL_EVENTS: 20,

/** Seasonal boost significance threshold.
 *  Only store month entries where |boost - 1.0| > this value.
 *  0.3 means a term must be 30%+ above or below average to be stored. */
TEMPORAL_SEASONAL_SIGNIFICANCE: 0.3,

/** Weekly pattern significance threshold (same principle as seasonal) */
TEMPORAL_WEEKLY_SIGNIFICANCE: 0.2,

/** Recent window for trending analysis (days) */
TEMPORAL_TRENDING_RECENT_DAYS: 7,

/** Baseline window for trending analysis (days) — starts after recent window */
TEMPORAL_TRENDING_BASELINE_DAYS: 30,

/** Minimum events in recent window for a term to appear in trending */
TEMPORAL_TRENDING_MIN_RECENT: 3,

/** Minimum events in baseline window for velocity calculation */
TEMPORAL_TRENDING_MIN_BASELINE: 5,

/** Velocity threshold to classify as 'rising' (positive) or 'falling' (negative) */
TEMPORAL_TRENDING_VELOCITY_THRESHOLD: 0.25,

/** Max seasonal terms stored per tier */
TEMPORAL_MAX_SEASONAL_PER_TIER: 300,

/** Max weekly pattern terms stored per tier */
TEMPORAL_MAX_WEEKLY_PER_TIER: 200,

/** Max trending terms stored per tier */
TEMPORAL_MAX_TRENDING_PER_TIER: 100,

/** Suggestion engine boost multiplier for seasonal relevance.
 *  Applied as: baseScore * (1 + (seasonalBoost - 1) * TEMPORAL_SEASONAL_WEIGHT).
 *  At 0.15, a term with 2.0× seasonal boost gets +15% score. */
TEMPORAL_SEASONAL_WEIGHT: 0.15,

/** Suggestion engine boost for trending-up terms */
TEMPORAL_TRENDING_WEIGHT: 0.08,
```

**Engine functions in `temporal-intelligence.ts`:**

| Function                    | Input                                    | Output                         | Purpose                                     |
| --------------------------- | ---------------------------------------- | ------------------------------ | ------------------------------------------- |
| `extractTermsByMonth()`     | events[]                                 | Map<term, Map<month, count>>   | Buckets term occurrences by calendar month  |
| `computeSeasonalBoosts()`   | termMonthCounts, minEvents, significance | SeasonalBoost[]                | Computes per-term monthly boost multipliers |
| `extractTermsByDayOfWeek()` | events[]                                 | Map<term, Map<dow, count>>     | Buckets term occurrences by day-of-week     |
| `computeWeeklyPatterns()`   | termDowCounts, minEvents, significance   | WeeklyPattern[]                | Computes per-term day-of-week multipliers   |
| `computeTrendingTerms()`    | events[], recentDays, baselineDays       | TrendingTerm[]                 | Computes 7-day velocity vs 30-day baseline  |
| `runTemporalAnalysis()`     | events[], constants                      | { seasonal, weekly, trending } | Orchestrator — calls all three, per-tier    |

All functions are pure — they accept event arrays and return data structures. No database calls.

**Files created:**

- `src/lib/learning/temporal-intelligence.ts` (~350 lines)

**Files modified:**

- `src/lib/learning/constants.ts` (add ~25 lines of constants)

**Verification:**

```powershell
# Run at repo root: C:\Users\Proma\Projects\promagen
pnpm run typecheck
```

---

### Part 7.8b — Lookup + API Routes + Tests

**Scope:** Temporal lookup functions (client-side), two GET API routes, and comprehensive unit tests.

**Lookup functions in `temporal-lookup.ts`:**

| Function                | Input                                   | Output                  | Purpose                                            |
| ----------------------- | --------------------------------------- | ----------------------- | -------------------------------------------------- |
| `buildTemporalLookup()` | raw JSON data                           | `TemporalLookup` object | Pre-processes JSON into fast lookup structure      |
| `lookupSeasonalBoost()` | lookup, term, category, month, tier     | number (0.0–3.0)        | Returns seasonal multiplier for a term this month  |
| `lookupWeeklyBoost()`   | lookup, term, category, dayOfWeek, tier | number (0.0–2.0)        | Returns day-of-week multiplier                     |
| `lookupTrendingBoost()` | trendingData, term, category, tier      | number (-1.0–1.0)       | Returns trending velocity (positive = trending up) |

**API routes:**

Both follow the exact pattern of existing learning routes (e.g., `/api/learning/anti-patterns/route.ts`):

1. `GET /api/learning/temporal-boosts` → reads `TEMPORAL_BOOSTS_KEY` from `learned_weights`
2. `GET /api/learning/trending-terms` → reads `TRENDING_TERMS_KEY` from `learned_weights`

**Tests in `temporal-intelligence.test.ts`:**

| Test group                  | What it tests                                                               |
| --------------------------- | --------------------------------------------------------------------------- |
| `extractTermsByMonth()`     | Correct month bucketing, timezone handling, empty input                     |
| `computeSeasonalBoosts()`   | Correct boost calculation, significance filtering, min-events gate          |
| `extractTermsByDayOfWeek()` | Correct day-of-week extraction                                              |
| `computeWeeklyPatterns()`   | Weekend vs weekday patterns                                                 |
| `computeTrendingTerms()`    | Rising/falling/stable classification, velocity calculation, min-events gate |
| `runTemporalAnalysis()`     | Full orchestrator with mock events                                          |
| `lookupSeasonalBoost()`     | Correct lookup, missing term fallback (returns 1.0), missing tier fallback  |
| `lookupTrendingBoost()`     | Correct velocity return, missing term returns 0                             |

**Files created:**

- `src/lib/learning/temporal-lookup.ts` (~120 lines)
- `src/lib/learning/__tests__/temporal-intelligence.test.ts` (~300 lines)
- `src/app/api/learning/temporal-boosts/route.ts` (~60 lines)
- `src/app/api/learning/trending-terms/route.ts` (~60 lines)

**Verification:**

```powershell
# Run at repo root: C:\Users\Proma\Projects\promagen
pnpm run typecheck
pnpm test -- --testPathPattern="temporal-intelligence" --verbose
```

---

### Part 7.8c — Cron Integration (Layer 16)

**Scope:** Wire temporal analysis into the nightly aggregation cron as Layer 16. Gated by `PHASE_7_LEARNING_ENABLED` env var (same gate as Phases 7.1–7.5).

**Changes to `aggregate/route.ts`:**

1. Import `runTemporalAnalysis` from `temporal-intelligence.ts`
2. Add Layer 16 after Layer 15 (A/B testing)
3. Layer 16 calls `runTemporalAnalysis(allEvents, LEARNING_CONSTANTS)`
4. Upserts results to `learned_weights` with keys `'temporal-boosts'` and `'trending-terms'`
5. Non-fatal: if Layer 16 fails, Layers 1–15 results persist

**Execution dependency:**

- Layer 16 reuses the `allEvents` array already fetched for Layers 9–15 (no extra DB query)
- Runs after Layer 15 (no inter-dependency, just ordering)

**Header comment update:**

```
 * - Layer 16: Temporal Intelligence    (Phase 7.8 — temporal-boosts + trending-terms)
```

**Env var gate:**

```
 * Phase 7.8 is gated by the SAME PHASE_7_LEARNING_ENABLED env var.
```

**Files modified:**

- `src/app/api/learning/aggregate/route.ts` (~40 lines added)

**Verification:**

```powershell
# Run at repo root: C:\Users\Proma\Projects\promagen
pnpm run typecheck
pnpm test -- --testPathPattern="temporal-intelligence" --verbose
```

---

### Part 7.8d — Suggestion Engine Integration + Docs Update

**Scope:** Wire temporal boosts into the suggestion engine so seasonal/trending terms get a score adjustment. Update evolution plan.

**Changes to `suggestion-engine.ts`:**

1. Import `TemporalLookup`, `lookupSeasonalBoost`, `lookupWeeklyBoost` from `temporal-lookup.ts`
2. Import `TrendingTermsData`, `lookupTrendingBoost` from `temporal-lookup.ts`
3. Add to `BuildContextInput`:

   ```typescript
   /** Pre-built temporal lookup from Phase 7.8 (null = no data) */
   temporalLookup?: TemporalLookup | null;

   /** Pre-built trending terms lookup from Phase 7.8 (null = no data) */
   trendingLookup?: TrendingTermsData | null;
   ```

4. In the scoring function, apply temporal boost:

   ```
   // Phase 7.8: Temporal boost (seasonal + trending)
   if (temporalLookup) {
     const now = new Date();
     const month = now.getMonth() + 1;  // 1-indexed
     const dow = now.getDay();           // 0=Sun
     const seasonalMult = lookupSeasonalBoost(temporalLookup, term, category, month, tier);
     const weeklyMult = lookupWeeklyBoost(temporalLookup, term, category, dow, tier);
     // Blend: slight seasonal nudge + slight weekly nudge
     temporalFactor = (seasonalMult - 1) * TEMPORAL_SEASONAL_WEIGHT
                    + (weeklyMult - 1) * TEMPORAL_WEEKLY_SIGNIFICANCE;
   }
   if (trendingLookup) {
     const velocity = lookupTrendingBoost(trendingLookup, term, category, tier);
     if (velocity > 0) temporalFactor += velocity * TEMPORAL_TRENDING_WEIGHT;
   }
   // Apply: finalScore *= (1 + temporalFactor)
   ```

   This is additive and nullable — when `temporalLookup` is null (no data yet / cold start), zero impact. Exactly like all other Phase 7 lookups.

**Evolution plan update:**

Change Phase 7.8 row from:

```
| **7.8**  | Temporal Intelligence           | ❌ NOT STARTED | —                                                                                                               |
```

To:

```
| **7.8**  | Temporal Intelligence           | ✅ COMPLETE    | Layer 16 cron, seasonal/weekly/trending analysis, ~350-line engine, 2 API routes, suggestion engine integration  |
```

Update the version line and status line accordingly.

**Files modified:**

- `src/lib/prompt-intelligence/engines/suggestion-engine.ts` (~30 lines added)
- `docs/authority/prompt-builder-evolution-plan-v2.md` (status update)

**Verification:**

```powershell
# Run at repo root: C:\Users\Proma\Projects\promagen
pnpm run typecheck
pnpm test -- --testPathPattern="temporal-intelligence|suggestion-engine" --verbose
```

**What "good" looks like:**

- `pnpm run typecheck` passes with 0 errors
- All temporal intelligence tests pass
- Existing suggestion engine tests still pass (backward compatible)
- When `temporalLookup` is `null`, suggestion scores are identical to before (zero regression)
- When temporal data exists, "snow" gets a boost in December and a dampen in July
- Trending terms get a small positive nudge in suggestions
- Cron Layer 16 completes within the 55-second timeout alongside all other layers

---

## 5. Delivery Format

All output files presented as a zip with folder structure matching the repo:

```powershell
# Run at repo root: C:\Users\Proma\Projects\promagen
pnpm run typecheck
pnpm test -- --testPathPattern="temporal-intelligence" --verbose
```

```
phase-7.8-temporal-intelligence/
├── src/
│   ├── lib/
│   │   └── learning/
│   │       ├── temporal-intelligence.ts      ← NEW
│   │       ├── temporal-lookup.ts            ← NEW
│   │       ├── constants.ts                  ← MODIFIED
│   │       └── __tests__/
│   │           └── temporal-intelligence.test.ts  ← NEW
│   ├── app/
│   │   └── api/
│   │       └── learning/
│   │           ├── temporal-boosts/
│   │           │   └── route.ts              ← NEW
│   │           ├── trending-terms/
│   │           │   └── route.ts              ← NEW
│   │           └── aggregate/
│   │               └── route.ts              ← MODIFIED
│   └── prompt-intelligence/
│       └── engines/
│           └── suggestion-engine.ts          ← MODIFIED
└── CHANGELOG-phase-7.8.md
```

---

## 6. Risk Assessment

| Risk                                                                         | Likelihood   | Impact | Mitigation                                                                                                |
| ---------------------------------------------------------------------------- | ------------ | ------ | --------------------------------------------------------------------------------------------------------- |
| Not enough data for seasonal analysis (need 12+ months)                      | High (early) | Low    | Graceful fallback: empty seasonal boosts = no effect. System improves as data accumulates.                |
| Trending analysis too noisy with low event volume                            | Medium       | Low    | Min-events gates (3 recent, 5 baseline). Below threshold = term not included.                             |
| Cron timeout with Layer 16 added                                             | Low          | Medium | Temporal analysis is O(events × terms) — same complexity as existing layers. 55s budget is generous.      |
| Seasonal bias reinforcement (boosting popular terms makes them more popular) | Medium       | Medium | Boosts are small (15% weight). The system nudges, it doesn't force. Diversity cap still applies upstream. |

---

## 7. Improvement Ideas (NOT implementing — for approval)

1. **Platform-specific temporal patterns** — "golden hour" might be seasonal on Midjourney but evergreen on DALL-E. Cross-reference with Phase 7.5 platform data for platform×time boosts.
2. **Hour-of-day patterns** — Morning users might prefer different moods than evening users. The `created_at` timestamp has this data already.
3. **Holiday awareness** — Christmas, Halloween, etc. could trigger specific term boosts. Would need a holiday calendar data file.
4. **Trend alerts in Admin** — Show a "🔥 Trending" badge on terms in the Admin scoring health dashboard (Phase 7.11 integration).

---

_End of build plan. Version 1.0.0. Created 2026-02-28._
