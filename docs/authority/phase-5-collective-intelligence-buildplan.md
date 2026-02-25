# Phase 5 — Collective Intelligence Engine: Build Plan

**Created:** 25 February 2026  
**Authority:** `docs/authority/prompt-builder-evolution-plan-v2.md` § 9  
**Dependencies:** Phase 4 (Polish & Integration) — completed  
**Total effort:** 4–6 days (14 sub-tasks across 7 steps)  
**Version:** 1.0.0

---

## What Phase 5 Does (One Paragraph)

Phase 5 turns Promagen from a static tool into a learning system. Every time a user builds a high-quality prompt (score ≥ 90%, 4+ categories filled), the system anonymously records which terms were selected together, in what order, on which platform. A nightly cron job crunches this raw data into lightweight JSON weight files (~100KB total). The vocabulary loader then blends these learned weights with the hand-curated clusters from Phase 1 — so dropdowns gradually reorder themselves based on what actually works. After enough data accumulates, the system also proposes new Scene Starters automatically from recurring high-quality patterns.

---

## What Already Exists (Ground Truth from src.zip 25 Feb 2026)

| Component                | File                                                                        | Status                                                |
| ------------------------ | --------------------------------------------------------------------------- | ----------------------------------------------------- |
| Neon Postgres singleton  | `src/lib/db.ts`                                                             | ✅ Working — `db()`, `withTx()`, `canReachDatabase()` |
| Cron auth pattern        | `src/app/api/cron/rankings/route.ts`                                        | ✅ Working — `PROMAGEN_CRON_SECRET` header check      |
| Vercel cron config       | `vercel.json`                                                               | ✅ Has 3 cron jobs already                            |
| Local telemetry          | `src/lib/telemetry.ts`                                                      | ✅ localStorage only — Stage 2, needs server upgrade  |
| Vocabulary loader        | `src/lib/vocabulary/vocabulary-loader.ts` (457 lines)                       | ✅ Context-aware — needs learned weight blending      |
| Suggestion engine        | `src/lib/prompt-intelligence/engines/suggestion-engine.ts` (941 lines)      | ✅ Cascade scoring — needs co-occurrence boost input  |
| Prompt optimizer         | `src/lib/prompt-optimizer.ts` (1604 lines)                                  | ✅ 4-tier pipeline — produces score for quality gate  |
| Scene starters           | `src/data/scenes/scene-starters.json`                                       | ✅ Phase 2 complete — auto-scene will append here     |
| Prompt builder component | `src/components/prompt-builder/prompt-intelligence-builder.tsx` (699 lines) | ✅ Has `onPromptCopy` hook — needs telemetry call     |
| Database schema helpers  | `src/lib/db.d.ts`                                                           | ✅ Global types for postgres singleton                |

**What does NOT exist yet (Phase 5 scope):**

- `prompt_events` database table
- `POST /api/prompt-telemetry` endpoint
- Nightly aggregation cron
- `co-occurrence-matrix.json` output file
- Learned weight blending in vocabulary-loader
- Auto-scene candidate pipeline
- Decay + diversity algorithms

---

## Architecture (From evolution-plan-v2 § 3)

```
LAYER 3 — RAW TELEMETRY (Neon Postgres)
┌─────────────────────────────────────────────────┐
│  prompt_events table                            │
│    id, session_id, attempt_number,              │
│    selections (JSONB), platform, tier,          │
│    score, score_factors (JSONB),                │
│    scene_used, outcome (JSONB),                 │
│    created_at                                   │
│  ~500 bytes per event. 80K events ≈ 40MB raw.   │
└─────────────────────────────────────────────────┘
            ↓ nightly cron crunches to

LAYER 2 — WEIGHT FILES (~100KB total, served from CDN/public)
┌─────────────────────────────────────────────────┐
│  co-occurrence-matrix.json  (~50-100KB)         │
│  scene-candidates.json      (~15KB)             │
│  sequence-patterns.json     (~10KB)             │
└─────────────────────────────────────────────────┘
            ↑ read by

LAYER 1 — CODE (never changes)
┌─────────────────────────────────────────────────┐
│  vocabulary-loader.ts → blend learned weights   │
│  suggestion-engine.ts → boost co-occurring terms│
│  prompt-intelligence-builder.tsx → log telemetry│
└─────────────────────────────────────────────────┘
```

---

## Build Steps — Granular Breakdown

### Step 5.1 — Telemetry Endpoint (0.5 days)

**What:** `POST /api/prompt-telemetry` — receives prompt events from the frontend, validates, and inserts into Postgres.

#### 5.1a — Types & Validation Schema (1 hour)

**New file:** `src/types/prompt-telemetry.ts`

Define the telemetry event shape matching evolution-plan-v2 § 14.3:

```typescript
interface PromptTelemetryEvent {
  sessionId: string; // anonymous session hash
  attemptNumber: number; // iteration within session
  selections: Record<string, string[]>; // category → selected terms
  categoryCount: number; // non-empty categories
  charLength: number; // assembled prompt length
  score: number; // optimizer score (0–100)
  scoreFactors: Record<string, number>; // breakdown
  platform: string; // e.g. 'midjourney'
  tier: 1 | 2 | 3 | 4;
  sceneUsed: string | null; // scene-starter ID or null
  outcome: {
    copied: boolean;
    saved: boolean;
    returnedWithin60s: boolean;
    reusedFromLibrary: boolean;
  };
}
```

**Zod schema** adjacent in the same file for server-side validation.

**Quality gates baked in:** Reject events where `score < 90` or `categoryCount < 4` at the type level (document why — only high-quality prompts feed the learning loop).

**Verification:** `pnpm run typecheck` — zero errors.

---

#### 5.1b — API Route Handler (2 hours)

**New file:** `src/app/api/prompt-telemetry/route.ts`

Follow existing cron route patterns (see `src/app/api/promagen-users/cron/route.ts`):

- `POST` handler only
- Validate body with Zod schema from 5.1a
- Rate-limit: max 10 events per IP per minute (in-memory counter, not a new dependency)
- GDPR safe: no user IDs, no IPs stored in DB (IP only used for rate limiting, discarded after)
- Insert into `prompt_events` table via `db()` singleton
- Return `{ ok: true, id: string }` or `{ ok: false, error: string }`
- Graceful degradation: if DB is unavailable, return 503 and log — frontend silently swallows

**Security (per best-working-practice § Security-First):**

- Input validation at boundary (Zod)
- No secrets in code
- Server-side only (`import 'server-only'` not needed for route handlers but ensure no client import)

**New file:** `src/app/api/prompt-telemetry/error.tsx` (error boundary sibling per code-standard Golden Rule #8)

**Verification:**

```powershell
# From frontend folder
pnpm run typecheck
curl -X POST http://localhost:3000/api/prompt-telemetry -H "Content-Type: application/json" -d '{"test": true}'
# Expect: 400 validation error (good — schema works)
```

---

### Step 5.2 — Database Schema (0.5 days)

#### 5.2a — SQL Migration Script (1 hour)

**New file:** `src/lib/learning/migrations/001-prompt-events.sql`

```sql
CREATE TABLE IF NOT EXISTS prompt_events (
  id              TEXT        NOT NULL PRIMARY KEY,  -- 'evt_' + nanoid
  session_id      TEXT        NOT NULL,
  attempt_number  SMALLINT    NOT NULL DEFAULT 1,
  selections      JSONB       NOT NULL,              -- { "subject": [...], "lighting": [...] }
  category_count  SMALLINT    NOT NULL,
  char_length     SMALLINT    NOT NULL,
  score           SMALLINT    NOT NULL,
  score_factors   JSONB       NOT NULL,
  platform        TEXT        NOT NULL,
  tier            SMALLINT    NOT NULL,
  scene_used      TEXT,                               -- nullable
  outcome         JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for nightly aggregation: group by tier, score filter
CREATE INDEX IF NOT EXISTS idx_prompt_events_aggregation
  ON prompt_events (tier, score, created_at);

-- Index for sequence pattern analysis
CREATE INDEX IF NOT EXISTS idx_prompt_events_session
  ON prompt_events (session_id, attempt_number);

-- Index for platform-specific learning
CREATE INDEX IF NOT EXISTS idx_prompt_events_platform
  ON prompt_events (platform, created_at);
```

**Size estimate:** ~500 bytes per row. 80,000 rows ≈ 40MB. Well within Neon free/pro tier limits.

#### 5.2b — Migration Runner Helper (1 hour)

**New file:** `src/lib/learning/run-migration.ts`

Server-only utility that reads SQL files and executes them via `db()`. Follow the pattern from existing `src/lib/index-rating/database.ts`. Idempotent — uses `IF NOT EXISTS`.

**New file:** `src/app/api/admin/learning/migrate/route.ts`

Admin-only endpoint (protected by `PROMAGEN_CRON_SECRET`) to run migrations manually. Returns table existence check result.

**Verification:**

```powershell
curl -X POST http://localhost:3000/api/admin/learning/migrate -H "x-promagen-cron: $env:PROMAGEN_CRON_SECRET"
# Expect: { "ok": true, "tables": ["prompt_events"] }
```

---

### Step 5.3 — Nightly Aggregation Cron (2 days — largest step, split into 4 sub-tasks)

This is the brain of Phase 5. It reads raw `prompt_events`, computes three outputs, and writes them as JSON files.

#### 5.3a — Cron Route Scaffold + Auth (2 hours)

**New file:** `src/app/api/learning/aggregate/route.ts`

Scaffold following existing cron pattern:

- `GET` handler (Vercel cron sends GET)
- Auth via `PROMAGEN_CRON_SECRET` (reuse `validateCronAuth` helper)
- Timeout protection (Vercel Pro: 60s max, Hobby: 10s — design for 60s)
- Observability: log start/end/error to console, return structured JSON result
- Wire into `vercel.json`:
  ```json
  {
    "path": "/api/learning/aggregate?secret=$PROMAGEN_CRON_SECRET",
    "schedule": "0 3 * * *"
  }
  ```
  (3 AM UTC daily — low traffic window)

**Verification:** `pnpm run typecheck` + manual curl returns `{ "ok": true, "dryRun": true }`.

---

#### 5.3b — Co-occurrence Matrix Computation (Layer 1 — 4 hours)

**New file:** `src/lib/learning/co-occurrence.ts`

The core algorithm. For every pair of terms that appeared together in a 90%+ prompt, increment a counter. Group by tier.

```
Input:  SELECT selections, tier, score, created_at FROM prompt_events
        WHERE score >= 90 AND category_count >= 4
Output: co-occurrence-matrix.json
```

**Algorithm:**

1. Query all qualifying events (batch: last 6 months with decay)
2. For each event, extract all selected terms (flatten selections JSONB)
3. For each pair of terms (sorted alphabetically to avoid A→B and B→A duplicates):
   - Increment `matrix[tier][termA + '|' + termB]`
4. Apply time decay: events from 6 months ago × 0.1, last week × 1.0 (exponential decay)
5. Apply diversity filter: if a pair appears in >30% of all events for that tier, cap its weight (prevents "masterpiece + 8K" from dominating)
6. Normalise: scale all values to 0–100 range per tier
7. Output top 2,000 pairs per tier (keeps file size under 100KB)

**Data shape output:**

```typescript
interface CoOccurrenceMatrix {
  version: string;
  generatedAt: string;
  eventCount: number;
  tiers: {
    [tier: string]: {
      pairs: Array<{
        terms: [string, string];
        weight: number; // 0–100 normalised
        count: number; // raw co-occurrence count
        platforms: string[]; // which platforms this pair appeared on
      }>;
    };
  };
}
```

**Write to:** `public/data/learned/co-occurrence-matrix.json`

**Verification:** Unit test with mock events → check pair counts are correct, decay is applied, diversity cap works.

---

#### 5.3c — Sequence Pattern Computation (Layer 2 — 3 hours)

**New file:** `src/lib/learning/sequence-patterns.ts`

Track which categories users fill first when building a prompt. This informs the "next empty dropdown highlights" feature.

```
Input:  SELECT session_id, attempt_number, selections, tier
        FROM prompt_events
        ORDER BY session_id, attempt_number
Output: sequence-patterns.json
```

**Algorithm:**

1. Group events by `session_id`, order by `attempt_number`
2. For each session, compute the "fill order" — which categories went from empty to non-empty between attempts
3. Aggregate across all sessions per tier:
   - `categoryOrder[tier][position] = { category: string, frequency: number }`
   - e.g., Tier 1: position 1 = "subject" (82%), position 2 = "style" (45%), etc.
4. Output the top 3 fill-order sequences per tier

**Data shape output:**

```typescript
interface SequencePatterns {
  version: string;
  generatedAt: string;
  sessionCount: number;
  tiers: {
    [tier: string]: {
      topSequences: Array<{
        order: string[]; // ["subject", "style", "lighting", ...]
        frequency: number; // 0–1 normalised
        avgScore: number; // average final score for this sequence
      }>;
      categoryPriority: Array<{
        category: string;
        fillFrequency: number; // how often this is filled first
        avgPositionalScore: number;
      }>;
    };
  };
}
```

**Write to:** `public/data/learned/sequence-patterns.json`

**Verification:** Unit test with mock session data → validate sequence extraction logic.

---

#### 5.3d — Scene Candidate Generation (Layer 3 — 3 hours)

**New file:** `src/lib/learning/scene-candidates.ts`

When enough prompts share similar selections and all score 90%+, propose a new Scene Starter.

```
Input:  SELECT selections, score, platform, tier, scene_used
        FROM prompt_events
        WHERE score >= 90 AND category_count >= 5 AND scene_used IS NULL
        -- Only non-scene prompts (scenes already exist)
Output: scene-candidates.json
```

**Algorithm:**

1. Cluster similar selection sets using Jaccard similarity (threshold ≥ 0.6)
2. For each cluster with ≥ 237 events (threshold from evolution-plan-v2 § 9.2):
   - Extract the most common term per category (the "consensus" selections)
   - Compute average score, dominant tier, dominant platforms
   - Generate a candidate scene name from the top subject + style terms
3. Check against existing `scene-starters.json` — skip if >70% overlap with existing scene
4. Output as review queue (not auto-added — goes to admin review)

**Data shape output:**

```typescript
interface SceneCandidates {
  version: string;
  generatedAt: string;
  candidates: Array<{
    id: string; // 'candidate_' + hash
    suggestedName: string; // auto-generated
    consensusSelections: Record<string, string[]>;
    eventCount: number;
    avgScore: number;
    dominantTier: 1 | 2 | 3 | 4;
    dominantPlatforms: string[];
    overlapWithExisting: number; // 0–1 Jaccard
    status: 'pending' | 'approved' | 'rejected';
    createdAt: string;
  }>;
}
```

**Write to:** `public/data/learned/scene-candidates.json`

**Verification:** Unit test with mock clustered events → validate Jaccard similarity and threshold logic.

---

### Step 5.4 — Co-occurrence Weights JSON Output (0.5 days)

#### 5.4a — File Writer Utility (2 hours)

**New file:** `src/lib/learning/write-learned-data.ts`

Server-only utility that writes the three JSON outputs from 5.3b/c/d to `public/data/learned/`.

In a Vercel environment, `public/` is read-only after build. Two strategies:

**Strategy A (recommended for now):** Write to Vercel Blob Storage or a Neon `learned_data` table (JSON column), and serve via an API route `GET /api/learning/weights`.

**Strategy B (simpler cold-start):** Commit initial empty JSON files to `public/data/learned/`. The cron writes to Neon as JSONB. A `GET /api/learning/co-occurrence` route serves the latest data. Frontend fetches on load.

**Decision: Strategy B** — simpler, no new dependencies, follows existing pattern (index-rating uses DB + API route).

**New files:**

- `src/app/api/learning/co-occurrence/route.ts` — serves co-occurrence-matrix from DB
- `src/app/api/learning/sequences/route.ts` — serves sequence-patterns from DB
- `src/app/api/learning/scene-candidates/route.ts` — serves scene-candidates from DB

**New DB table** (add to migration 001):

```sql
CREATE TABLE IF NOT EXISTS learned_weights (
  key         TEXT        NOT NULL PRIMARY KEY,  -- 'co-occurrence' | 'sequences' | 'scene-candidates'
  data        JSONB       NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

The cron UPSERTs into this table. The API routes read from it. Frontend caches with `stale-while-revalidate`.

**Verification:**

```powershell
curl http://localhost:3000/api/learning/co-occurrence
# Expect: { "version": "...", "tiers": {} } (empty initially — cold start)
```

---

### Step 5.5 — Vocabulary Loader Integration (1 day)

#### 5.5a — Fetch + Cache Learned Weights on Client (3 hours)

**New file:** `src/hooks/use-learned-weights.ts`

React hook that fetches co-occurrence weights from `GET /api/learning/co-occurrence`.

- Fetches once on mount, caches in React state
- `stale-while-revalidate` pattern: serve cached, refetch in background
- Returns `{ coOccurrence: CoOccurrenceMatrix | null, isLoading: boolean }`
- Graceful degradation: if fetch fails, returns null — vocabulary-loader falls back to curated-only

**Verification:** `pnpm run typecheck` + hook returns null in dev (no data yet).

---

#### 5.5b — Blend Learned Weights into Vocabulary Loader (4 hours)

**Modified file:** `src/lib/vocabulary/vocabulary-loader.ts`

This is the key integration. The vocabulary loader currently sorts dropdown options by curated cluster scores. Now it also factors in co-occurrence weights.

**Blending formula (from evolution-plan-v2 § 9.2):**

```
finalScore = (curatedWeight × clusterScore) + (learnedWeight × coOccurrenceScore)
```

**Ratio progression:**

- Cold start (0 events): 100/0 curated/learned
- Early (< 1,000 events): 70/30 curated/learned
- Growing (1,000–10,000): 50/50
- Mature (10,000–80,000): 30/70
- Established (80,000+): 20/80

The ratio is computed from `eventCount` in the co-occurrence matrix header — no config needed, it self-adjusts.

**Changes to `vocabulary-loader.ts`:**

- Add optional `learnedWeights?: CoOccurrenceMatrix` parameter to `getVocabularyForCategory()`
- In the scoring/sorting section, look up the current term against all currently-selected terms in the co-occurrence matrix
- Add the co-occurrence score (weighted by ratio) to the existing cluster score
- Resort dropdown options by the blended score

**Scope lock:** Only change the scoring/sorting logic. Do not touch: category list, merged vocab loading, context interface shape (extend only), suggestion pool logic.

**Verification:**

```powershell
pnpm run typecheck
pnpm vitest run src/lib/vocabulary/__tests__/vocabulary-loader.test.ts
```

---

#### 5.5c — Wire Hook into Prompt Builder (1 hour)

**Modified file:** `src/components/prompt-builder/prompt-intelligence-builder.tsx`

- Import `useLearnedWeights` hook
- Pass `coOccurrence` data down to vocabulary loader calls
- No UI changes — the reordering is invisible to the user (dropdowns just become smarter)

**Verification:** Open prompt builder in dev → dropdowns render (no data yet, so order unchanged). Console shows "Learned weights: cold start (0 events)" in dev mode.

---

### Step 5.6 — Auto-Scene Candidate Pipeline + Review Queue (1 day)

#### 5.6a — Admin Review Page Scaffold (4 hours)

**New file:** `src/app/admin/scene-candidates/page.tsx`

Simple admin page (protected by auth) that:

- Fetches `GET /api/learning/scene-candidates`
- Displays each candidate with: name, consensus selections, event count, avg score, overlap %
- Two buttons per candidate: "Approve" and "Reject"
- Approve → POST to a new endpoint that converts candidate to scene-starter format and appends to `scene-candidates.json` with status `approved`

**Note:** Auto-approved scenes do NOT auto-deploy to `scene-starters.json` in Phase 5. That's manual — you review, approve, then copy to the scene starters data file. Phase 7 may automate this.

**UI:** Minimal — this is an admin tool, not user-facing. No clamp() required. Basic Tailwind.

---

#### 5.6b — Approval Endpoint (2 hours)

**New file:** `src/app/api/learning/scene-candidates/approve/route.ts`

- `POST` with `{ candidateId: string, action: 'approve' | 'reject' }`
- Protected by `PROMAGEN_CRON_SECRET` (admin only)
- Updates status in `learned_weights` table
- Returns updated candidate list

---

### Step 5.7 — Decay + Diversity Tuning (0.5 days)

#### 5.7a — Decay Function (2 hours)

**New file:** `src/lib/learning/decay.ts`

Pure function, no side effects. Used by co-occurrence computation (5.3b).

```typescript
/**
 * Exponential decay: recent events matter more.
 * halfLifeDays = 90 → event from 90 days ago has 50% weight.
 */
export function timeDecay(eventAge: number, halfLifeDays = 90): number {
  return Math.pow(0.5, eventAge / halfLifeDays);
}
```

Also includes diversity cap function:

```typescript
/**
 * Prevents popular-but-obvious pairs from dominating.
 * If a pair appears in >30% of events, cap its effective count.
 */
export function diversityCap(pairCount: number, totalEvents: number, threshold = 0.3): number {
  const share = pairCount / totalEvents;
  if (share <= threshold) return pairCount;
  return Math.floor(totalEvents * threshold);
}
```

**Verification:** Unit tests with known inputs → known outputs.

---

#### 5.7b — Tuning Constants File (1 hour)

**New file:** `src/lib/learning/constants.ts`

All magic numbers in one place (SSOT):

```typescript
export const LEARNING_CONSTANTS = {
  /** Minimum score for event to enter learning pipeline */
  SCORE_THRESHOLD: 90,
  /** Minimum non-empty categories for event to qualify */
  MIN_CATEGORIES: 4,
  /** Half-life for time decay (days) */
  DECAY_HALF_LIFE_DAYS: 90,
  /** Diversity cap: max share of total events for any single pair */
  DIVERSITY_CAP_THRESHOLD: 0.3,
  /** Max co-occurrence pairs stored per tier */
  MAX_PAIRS_PER_TIER: 2000,
  /** Minimum events in a cluster to propose a scene candidate */
  SCENE_CANDIDATE_THRESHOLD: 237,
  /** Jaccard similarity threshold for scene clustering */
  SCENE_JACCARD_THRESHOLD: 0.6,
  /** Max overlap with existing scenes before skipping */
  SCENE_OVERLAP_MAX: 0.7,
  /** Blending ratios: [eventCount threshold, curatedWeight, learnedWeight] */
  BLEND_RATIOS: [
    [0, 1.0, 0.0], // Cold start
    [1000, 0.7, 0.3], // Early
    [10000, 0.5, 0.5], // Growing
    [80000, 0.2, 0.8], // Established
  ] as const,
  /** Rate limit: max telemetry events per IP per minute */
  RATE_LIMIT_PER_MINUTE: 10,
  /** Cron schedule (for documentation — actual schedule in vercel.json) */
  CRON_SCHEDULE: '0 3 * * *',
} as const;
```

**Verification:** `pnpm run typecheck`.

---

### Step 5.8 — Frontend Telemetry Integration (NEW — not in original 5.1–5.7, but required)

This step wires the frontend to actually SEND telemetry events to the new endpoint.

#### 5.8a — Telemetry Client (2 hours)

**New file:** `src/lib/learning/telemetry-client.ts`

Client-side module that:

- Builds a `PromptTelemetryEvent` from current prompt builder state
- Sends `POST /api/prompt-telemetry` via `fetch` with `keepalive: true` (survives page navigation)
- Fires on "copy prompt" action (the primary positive signal)
- Only sends if quality gates pass (score ≥ 90, 4+ categories)
- Silent failure — never blocks or errors for the user
- Generates anonymous `sessionId` via `crypto.randomUUID()` stored in sessionStorage (per-tab, dies on close)

#### 5.8b — Wire into Prompt Builder Copy Action (1 hour)

**Modified file:** `src/components/prompt-builder/prompt-intelligence-builder.tsx`

In the existing `onPromptCopy` handler (line ~547), add:

```typescript
// After successful copy
logPromptTelemetry({
  selections: currentSelections,
  score: currentScore,
  platform: selectedPlatform,
  tier: currentTier,
  sceneUsed: activeScene?.id ?? null,
  // ... other fields computed from current state
});
```

**Scope lock:** Only add the telemetry call. Do not change copy behaviour, UI, or any other logic.

---

## File Impact Map

### New Files (14 files)

| File                                                | Step | Purpose                     |
| --------------------------------------------------- | ---- | --------------------------- |
| `src/types/prompt-telemetry.ts`                     | 5.1a | Types + Zod schema          |
| `src/app/api/prompt-telemetry/route.ts`             | 5.1b | Telemetry ingest endpoint   |
| `src/lib/learning/migrations/001-prompt-events.sql` | 5.2a | DB schema                   |
| `src/lib/learning/run-migration.ts`                 | 5.2b | Migration runner            |
| `src/app/api/learning/aggregate/route.ts`           | 5.3a | Nightly cron                |
| `src/lib/learning/co-occurrence.ts`                 | 5.3b | Co-occurrence algorithm     |
| `src/lib/learning/sequence-patterns.ts`             | 5.3c | Sequence algorithm          |
| `src/lib/learning/scene-candidates.ts`              | 5.3d | Scene generation algorithm  |
| `src/app/api/learning/co-occurrence/route.ts`       | 5.4a | Serve weights               |
| `src/hooks/use-learned-weights.ts`                  | 5.5a | Client-side fetch hook      |
| `src/app/admin/scene-candidates/page.tsx`           | 5.6a | Admin review UI             |
| `src/lib/learning/decay.ts`                         | 5.7a | Decay + diversity functions |
| `src/lib/learning/constants.ts`                     | 5.7b | All tuning constants        |
| `src/lib/learning/telemetry-client.ts`              | 5.8a | Frontend telemetry sender   |

### Modified Files (3 files)

| File                                                            | Step        | Changes                                       |
| --------------------------------------------------------------- | ----------- | --------------------------------------------- |
| `src/lib/vocabulary/vocabulary-loader.ts`                       | 5.5b        | Add learned weight blending to scoring        |
| `src/components/prompt-builder/prompt-intelligence-builder.tsx` | 5.5c + 5.8b | Pass learned weights + fire telemetry on copy |
| `vercel.json`                                                   | 5.3a        | Add nightly cron schedule                     |

### Untouched Files

| File                                                       | Reason                                                              |
| ---------------------------------------------------------- | ------------------------------------------------------------------- |
| `src/lib/prompt-optimizer.ts`                              | Produces score — consumed by telemetry, not modified                |
| `src/lib/prompt-intelligence/engines/suggestion-engine.ts` | Phase 5 doesn't change cascade logic (Phase 6 does)                 |
| `src/data/scenes/scene-starters.json`                      | Auto-scenes go to review queue, not auto-deployed                   |
| `src/lib/telemetry.ts`                                     | Local telemetry stays for live nudges; server telemetry is additive |
| All vocabulary JSON files                                  | Core vocab stays pure                                               |

---

## Build Order & Dependencies

```
5.1a (types) ──────┐
                    ├── 5.1b (API route) ── 5.8a (client) ── 5.8b (wire to UI)
5.2a (SQL) ────────┤
5.2b (migration) ──┘
                    │
5.7a (decay) ──────┤
5.7b (constants) ──┤
                    │
                    ├── 5.3a (cron scaffold)
                    │     ├── 5.3b (co-occurrence)
                    │     ├── 5.3c (sequences)
                    │     └── 5.3d (scene candidates)
                    │
                    ├── 5.4a (serve weights from DB)
                    │     └── 5.5a (client hook)
                    │           └── 5.5b (blend into vocab loader)
                    │                 └── 5.5c (wire to prompt builder)
                    │
                    └── 5.6a (admin review page)
                          └── 5.6b (approval endpoint)
```

**Parallelisable:**

- 5.1 + 5.2 can be built simultaneously
- 5.7 (decay/constants) can be built any time before 5.3
- 5.6 (admin review) can be built in parallel with 5.5 (vocab integration)
- 5.8 (frontend telemetry) can start as soon as 5.1 is done

---

## Quality Gates per Step

Every step must pass before moving to the next:

| Step | Gate                                                                                                                                       |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 5.1  | `pnpm run typecheck` + curl returns 400 on bad input, 201 on valid input                                                                   |
| 5.2  | Migration runs idempotently, table exists in Neon, `SELECT 1 FROM prompt_events` succeeds                                                  |
| 5.3  | Unit tests pass for each algorithm. Cron returns structured JSON. Manual trigger with test data produces valid output                      |
| 5.4  | API routes return valid JSON (empty is fine for cold start)                                                                                |
| 5.5  | Typecheck passes. Vocabulary loader sorts identically when no learned data (backward compatible). Sorts differently with mock learned data |
| 5.6  | Admin page renders candidates. Approve/reject updates status                                                                               |
| 5.7  | Unit tests: `timeDecay(0) === 1.0`, `timeDecay(90) ≈ 0.5`, `diversityCap` caps correctly                                                   |
| 5.8  | Copy a prompt in dev → network tab shows POST to `/api/prompt-telemetry` → DB row appears                                                  |

---

## GDPR & Privacy Checklist

| Requirement            | Implementation                                                                    |
| ---------------------- | --------------------------------------------------------------------------------- |
| No user IDs stored     | `prompt_events` has no `user_id` column                                           |
| No IP addresses stored | IP used only for rate limiting (in-memory), never written to DB                   |
| Anonymous session ID   | `crypto.randomUUID()` in sessionStorage — dies on tab close, not linkable         |
| No cookies set         | Telemetry uses `fetch` with no credentials                                        |
| Data retention         | 6-month decay built into aggregation; raw events can be purged after 12 months    |
| Consent                | Telemetry only fires on explicit user action (copy prompt) — not passive tracking |

---

## Cold Start Behaviour

When Phase 5 first deploys, there is zero learned data. The system must work identically to today:

- `use-learned-weights.ts` returns `null` → vocabulary-loader uses 100% curated scores
- Co-occurrence API returns empty matrix → blending weight = 0
- Scene candidates API returns empty list → admin page shows "No candidates yet"
- Telemetry starts collecting immediately — the cron accumulates data overnight

After ~1,000 prompts (est. 2–4 weeks), learned data begins subtly influencing dropdown order. After ~10,000 prompts, the effect becomes noticeable.

---

## Test Plan (8 tests)

| #   | Test                    | File                                  | What it checks                                                         |
| --- | ----------------------- | ------------------------------------- | ---------------------------------------------------------------------- |
| T1  | Telemetry validation    | `__tests__/prompt-telemetry.test.ts`  | Zod rejects bad input, accepts valid                                   |
| T2  | Rate limiting           | `__tests__/prompt-telemetry.test.ts`  | 11th request in 1 minute returns 429                                   |
| T3  | Co-occurrence algorithm | `__tests__/co-occurrence.test.ts`     | Pair counting, decay, diversity cap                                    |
| T4  | Sequence extraction     | `__tests__/sequence-patterns.test.ts` | Session grouping, fill order detection                                 |
| T5  | Scene clustering        | `__tests__/scene-candidates.test.ts`  | Jaccard similarity, threshold, overlap check                           |
| T6  | Decay function          | `__tests__/decay.test.ts`             | Mathematical accuracy                                                  |
| T7  | Blending ratio          | `__tests__/vocabulary-loader.test.ts` | Cold start = curated only, mature = mostly learned                     |
| T8  | End-to-end              | `__tests__/learning-pipeline.test.ts` | Insert event → run aggregation → fetch weights → blended score differs |

---

## Environment Variables (New)

| Variable               | Required | Default | Description                       |
| ---------------------- | -------- | ------- | --------------------------------- |
| `DATABASE_URL`         | Yes\*    | —       | Already exists for promagen-users |
| `PROMAGEN_CRON_SECRET` | Yes      | —       | Already exists for other crons    |

_No new env vars needed — Phase 5 reuses existing database and cron infrastructure._

---

## Risk Register (Phase 5 Specific)

| Risk                                         | Likelihood | Impact | Mitigation                                                                          |
| -------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------------------------- |
| Vercel function timeout on large aggregation | Medium     | High   | Batch processing: process 10,000 events per batch. Short-circuit if approaching 55s |
| Garbage data pollutes co-occurrence          | Medium     | High   | 90% score gate + 4-category gate + diversity cap. First month: manual review        |
| Bundle size from learned weights fetch       | Low        | Medium | Lazy fetch on prompt builder mount only. ~100KB gzipped ≈ ~30KB                     |
| Neon cold start latency on cron              | Low        | Low    | Cron runs at 3 AM — no user impact. Retry once on timeout                           |
| Popular pairs dominate                       | Medium     | Medium | Diversity cap at 30%. Decay ensures freshness. Per-tier separation                  |

---

## Changelog

- **v1.0.0 (25 Feb 2026):** Initial build plan. 14 sub-tasks across 7+1 steps. Estimated 4–6 days.
