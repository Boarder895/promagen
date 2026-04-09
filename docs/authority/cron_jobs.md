# Cron Jobs

This document is the **Single Source of Truth (SSOT)** for all scheduled background jobs in Promagen.

**Last updated:** 9 April 2026
**Version:** 3.0.0

---

## Table of Contents

1. [Overview](#overview)
2. [Cron Security](#cron-security)
3. [Event Tracking Endpoint](#event-tracking-endpoint)
4. [Promagen Users Aggregation](#1-promagen-users-aggregation)
5. [Index Rating Cron](#2-index-rating-cron)
6. [Rankings Cron](#3-rankings-cron)
7. [Learning Aggregation Cron](#4-learning-aggregation-cron)
8. [Dead Code & Known Issues](#dead-code--known-issues)

---

## Overview

Promagen runs **4** scheduled cron jobs via Vercel Cron, configured in `frontend/vercel.json`:

| Job | Path | Schedule | Purpose |
|---|---|---|---|
| **Promagen Users** | `/api/promagen-users/cron` | Every 30 min (`:10`, `:40`) | Aggregate per-provider country usage from activity events |
| **Index Rating** | `/api/index-rating/cron` | `00:05 UTC daily` | Calculate Elo-style competitive ratings for all providers |
| **Rankings** | `/api/cron/rankings` | Every hour (`:00`) | Recalculate Bayesian vote-based rankings, store in KV |
| **Learning** | `/api/learning/aggregate` | `03:00 UTC daily` | Collective intelligence engine — 14+ computation layers |

All crons return structured JSON responses for observability and log to Postgres run tables (Index Rating, Promagen Users, Learning) or KV (Rankings).

---

## Cron Security

### Authentication Pattern (All 4 Crons)

All cron endpoints accept authentication via any of these methods:

| Method | Header / Param | Used By |
|---|---|---|
| `Authorization: Bearer <secret>` | Header | **Vercel Cron default** — this is what Vercel sends in production |
| `x-promagen-cron: <secret>` | Header | Legacy / manual testing |
| `x-cron-secret: <secret>` | Header | Legacy / manual testing |
| `x-promagen-cron-secret: <secret>` | Header | Legacy / manual testing |
| `?secret=<secret>` | Query param | Manual testing via curl |

All crons use **timing-safe comparison** (`crypto.timingSafeEqual`) to prevent timing attacks on secret validation.

Unauthenticated requests return `404 Not Found` (Index Rating, Promagen Users, Learning) or `401 Unauthorized` (Rankings) — hiding endpoint existence from attackers.

### Environment Variables

| Variable | Required | Min Length | Description |
|---|---|---|---|
| `PROMAGEN_CRON_SECRET` | Yes | 16 chars | Shared secret for all cron endpoints |

**Note:** Vercel Cron also looks for `CRON_SECRET`. Ensure `PROMAGEN_CRON_SECRET` is set. The cron routes read `PROMAGEN_CRON_SECRET` from the environment. The `?secret=$PROMAGEN_CRON_SECRET` query params in `vercel.json` pass the secret to routes that check the query string.

### Vercel Cron Configuration

In `frontend/vercel.json` (the file in the frontend directory, NOT the repo root):

```json
{
  "crons": [
    {
      "path": "/api/promagen-users/cron?secret=$PROMAGEN_CRON_SECRET",
      "schedule": "10,40 * * * *"
    },
    {
      "path": "/api/cron/rankings?secret=$PROMAGEN_CRON_SECRET",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/index-rating/cron?secret=$PROMAGEN_CRON_SECRET",
      "schedule": "5 0 * * *"
    },
    {
      "path": "/api/learning/aggregate?secret=$PROMAGEN_CRON_SECRET",
      "schedule": "0 3 * * *"
    }
  ]
}
```

**Critical:** The `?secret=$PROMAGEN_CRON_SECRET` query params are required. Without them, every cron fires with no credentials and silently fails auth → 404. This was broken from launch until 7 Apr 2026 when the frontend `vercel.json` was fixed. The root `vercel.json` had the correct paths but Vercel ignores it because the project deploys from the `frontend/` directory.

**Verify after deploy:** Vercel Dashboard → Settings → Cron Jobs — should show 4 registered crons with next scheduled run times.

---

## Event Tracking Endpoint

All engagement events that feed the crons are captured by a single endpoint:

**Path:** `POST /api/events/track`
**File:** `src/app/api/events/track/route.ts`

### 12 Event Types

Event configuration lives in `src/types/index-rating.ts` as `EVENT_CONFIG`:

| Event Type | Base Points | K-Factor | Source |
|---|---|---|---|
| `vote` | 5 | 32 | Image quality vote |
| `prompt_submit` | 5 | 24 | Copy in prompt builder |
| `prompt_builder_open` | 3 | 16 | Open provider detail page |
| `open` | 2 | 16 | Provider page / outbound click |
| `click` | 2 | 16 | Legacy alias for `open` |
| `social_click` | 1 | 8 | Social media icon click |
| `prompt_lab_select` | 4 | 20 | Select provider in Prompt Lab |
| `prompt_lab_generate` | 7 | 28 | Generate prompts in Prompt Lab |
| `prompt_lab_copy` | 6 | 24 | Copy tier prompt in Prompt Lab |
| `prompt_lab_optimise` | 8 | 32 | Run Call 3 in Prompt Lab |
| `prompt_save` | 4 | 20 | Save prompt to library |
| `prompt_reformat` | 3 | 16 | Reformat for different platform |

Events are stored in `provider_activity_events` with country code derived from `x-vercel-ip-country` header.

Rate limit: 30 events per session per minute (in-memory, resets on deploy).

### ⚠️ Known Gap — Index Rating SQL Filter

The Index Rating cron's database query only processes **6 of 12** event types:

```sql
AND event_type IN ('vote', 'open', 'click', 'prompt_builder_open', 'prompt_submit', 'social_click')
```

The 6 Prompt Lab events (`prompt_lab_select`, `prompt_lab_generate`, `prompt_lab_copy`, `prompt_lab_optimise`, `prompt_save`, `prompt_reformat`) are tracked and stored in the database but **not consumed by the Index Rating cron**. The EVENT_CONFIG defines weights for them, but the two SQL queries in `src/lib/index-rating/database.ts` filter them out with hardcoded `IN (...)` clauses.

The **Promagen Users cron** counts ALL event types (no filter) — this is correct.

---

## 1. Promagen Users Aggregation

### 1.1 Purpose

Shows per-provider country usage statistics in the leaderboard. Displays the top 6 countries by Promagen usage for each provider.

**UI Location:** AI Providers Leaderboard → "Promagen Users" column (6 surfaces total: Homepage, `/providers`, `/providers/leaderboard`, `/world-context`, `/inspire`, Prompt Lab left rail)
**Visual format:** Total count + flag grid (max 6 flags per provider)

### 1.2 Data Flow

```
1. USER EVENT (open, click, vote, prompt_lab_*, etc.)
   └─► /api/events/track (POST)
       └─► INSERT INTO provider_activity_events
           (click_id, provider_id, country_code, event_type, ...)

2. CRON RUNS (every 30 minutes)
   └─► /api/promagen-users/cron
       └─► Aggregates last 30 days by (provider_id, country_code)
       └─► UPSERT INTO provider_country_usage_30d
       └─► INSERT INTO promagen_users_cron_runs (observability)

3. FRONTEND LOADS
   └─► getProvidersWithPromagenUsers() (server function)
       └─► Reads from provider_country_usage_30d
       └─► Returns providers with promagenUsers[] attached

4. UI RENDERS
   └─► providers-table.tsx → PromagenUsersCell
   └─► leaderboard-rail.tsx (Prompt Lab left rail)
```

### 1.3 Route

**Path:** `/api/promagen-users/cron`
**Method:** GET
**Schedule:** Every 30 minutes (`:10` and `:40`)
**File:** `src/app/api/promagen-users/cron/route.ts`

**Query params:**

| Param | Default | Description |
|---|---|---|
| `secret` | — | `PROMAGEN_CRON_SECRET` (for manual testing) |
| `dryRun` | `0` | If `1`, count only, no writes |
| `windowDays` | `30` | Aggregation window in days |

**Auth:** `Authorization: Bearer` + all legacy header/query param methods (see §Cron Security).

**Advisory lock:** `pg_try_advisory_lock(42_4242)` prevents concurrent runs.

### 1.4 Database Schema

**Table: `provider_activity_events`** — Raw click/engagement events.

```sql
CREATE TABLE IF NOT EXISTS provider_activity_events (
  click_id      TEXT        NOT NULL PRIMARY KEY,
  provider_id   TEXT        NOT NULL,
  country_code  TEXT,
  event_type    TEXT        NOT NULL DEFAULT 'click',
  session_id    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Table: `provider_country_usage_30d`** — Aggregated per-provider per-country counts.

```sql
CREATE TABLE IF NOT EXISTS provider_country_usage_30d (
  provider_id   TEXT NOT NULL,
  country_code  TEXT NOT NULL,
  users_count   INTEGER NOT NULL DEFAULT 0,
  last_updated  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (provider_id, country_code)
);
```

### 1.5 Demo Data

When `NEXT_PUBLIC_DEMO_JITTER=true` and a provider has no real user data, the frontend generates demo counts: 12 countries weighted by AI tool demographics, counts scale by local time-of-day (peaks 19:00–20:00, drops 01:00–05:00), per-provider hash seeding for deterministic variety. Real users seamlessly replace demo data.

### 1.6 Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes* | — | Postgres connection string |
| `POSTGRES_URL` | Yes* | — | Neon/Vercel fallback |
| `PROMAGEN_CRON_SECRET` | Yes | — | Min 16 chars |
| `PROMAGEN_USERS_WINDOW_DAYS` | No | `30` | Aggregation window |
| `PROMAGEN_USERS_STALE_AFTER_HOURS` | No | `48` | Staleness threshold |

*At least one of `DATABASE_URL` or `POSTGRES_URL` must be set.

### 1.7 Observability

**Debug endpoint:** `GET /api/promagen-users/debug?secret=YOUR_SECRET` — returns DB connectivity, aggregation stats, last cron run, sample data.

---

## 2. Index Rating Cron

### 2.1 Purpose

Calculates daily Elo-style competitive rankings for all 40 AI providers. Processes engagement events, applies Market Power Index (MPI) handicapping, daily regression toward baseline, and updates the `provider_ratings` table.

**UI Location:** AI Providers Leaderboard → "Index Rating" column, Prompt Lab left rail (LeaderboardRail)
**Visual format:** Rating number + change arrow (green ▲ gain, red ▼ loss) + rank-up flash on climbers

### 2.2 Route

**Path:** `/api/index-rating/cron`
**Method:** GET
**Schedule:** `00:05 UTC daily`
**File:** `src/app/api/index-rating/cron/route.ts`
**Runtime:** `nodejs`, `force-dynamic`, `maxDuration: 60`

**Auth:** `Authorization: Bearer` + all legacy header/query param methods (see §Cron Security).

**Advisory lock:** `acquireAdvisoryLock()` / `releaseAdvisoryLock()` in `src/lib/index-rating/database.ts`.

### 2.3 Processing Steps

1. Load providers from `providers.json`, market power from `market-power.json`, current ratings from `provider_ratings`, events from `provider_activity_events` (180-day lookback).
2. For each provider: if no existing rating → auto-seed (incumbents with MPI >5.0 get higher seed). If existing → calculate Elo change from events, apply daily regression toward baseline, apply rating floor.
3. Calculate ranks: sort all providers by new rating descending, assign rank 1–N.
4. Detect rank climbers: if rank improved (lower number = better), set `rankChangedAt` to now.
5. Persist: upsert to `provider_ratings`, log to `index_rating_cron_runs`.

### 2.4 Elo Calculation

**Effective points** per event = `basePoints × staticBonus × timeDecay × newcomerBoost`

**Static bonuses** (from `src/types/index-rating.ts`):

| Factor | Multiplier |
|---|---|
| API available | ×1.10 |
| Affiliate programme | ×1.05 |
| Supports prefill | ×1.05 |

**Newcomer boost:** Providers founded <3 months ago get ×1.20, tapering to ×1.0 over 6 months.

**Elo gain** = `handicappedPoints × kFactor × (actual - expected)` where MPI handicaps high-power providers.

### 2.5 Database Schema

**Table: `provider_ratings`**

```sql
CREATE TABLE IF NOT EXISTS provider_ratings (
  id SERIAL PRIMARY KEY,
  provider_id TEXT NOT NULL UNIQUE,
  current_rating NUMERIC(10,4) NOT NULL DEFAULT 1500,
  previous_rating NUMERIC(10,4),
  change NUMERIC(10,4) DEFAULT 0,
  change_percent NUMERIC(10,4) DEFAULT 0,
  current_rank INTEGER,
  previous_rank INTEGER,
  rank_changed_at TIMESTAMPTZ,
  total_events INTEGER DEFAULT 0,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Table: `index_rating_cron_runs`**

```sql
CREATE TABLE IF NOT EXISTS index_rating_cron_runs (
  id SERIAL PRIMARY KEY,
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  providers_updated INTEGER NOT NULL DEFAULT 0,
  providers_seeded INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  success BOOLEAN NOT NULL DEFAULT TRUE,
  error_message TEXT
);
```

### 2.6 Display Layer

The raw Elo rating is not shown directly to users. A `DISPLAY_INFLATION_OFFSET` of **+200** is added in the frontend (`src/types/index-rating.ts`). A raw rating of 1500 displays as 1700.

Demo jitter (±1–3 points every 45s) is applied client-side, cosmetic only, gated by `NEXT_PUBLIC_DEMO_JITTER` env var.

### 2.7 Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes* | — | Postgres connection string |
| `PROMAGEN_CRON_SECRET` | Yes | — | Protects cron endpoint |
| `INDEX_RATING_BASELINE` | No | `1500` | Elo baseline |
| `INDEX_RATING_DECAY_LAMBDA` | No | `0.02` | Daily regression rate |
| `INDEX_RATING_STALE_HOURS` | No | `48` | Staleness threshold |

### 2.8 Debug & Testing

```powershell
# Manual trigger (dev server running)
curl "http://localhost:3000/api/index-rating/cron?secret=YOUR_SECRET"

# Dry run
curl "http://localhost:3000/api/index-rating/cron?secret=YOUR_SECRET&dryRun=1"

# Debug endpoint
curl "http://localhost:3000/api/index-rating/debug?secret=YOUR_SECRET"
```

Verify: response shows `providersUpdated: 40`, `provider_ratings` table has 40 rows, `index_rating_cron_runs` has new entry.

---

## 3. Rankings Cron

### 3.1 Purpose

Recalculates Bayesian vote-based rankings for all providers hourly. Uses the voting/Like system data stored in Vercel KV, not Postgres.

**File:** `src/app/api/cron/rankings/route.ts`
**Schedule:** Every hour at `:00`

### 3.2 Processing Steps

1. Fetch all provider vote statistics from KV.
2. Apply time decay to older votes.
3. Calculate Bayesian scores.
4. Blend community scores with seed scores.
5. Generate new rankings.
6. Store results in KV cache.

### 3.3 Rate Limiting

Minimum 60 seconds between calculations (`MIN_CALCULATION_INTERVAL_MS`). Expired data cleanup runs roughly every 6th run (~6 hours).

### 3.4 Auth

Uses `validateCronAuth()` from `src/lib/voting/security.ts` — same Bearer + custom header pattern as other crons. Returns `401` (not `404`) on auth failure.

### 3.5 Key Files

| File | Purpose |
|---|---|
| `src/app/api/cron/rankings/route.ts` | Cron handler |
| `src/lib/voting/security.ts` | `validateCronAuth()` with timing-safe comparison |
| `src/lib/voting/index.ts` | Exports all voting/ranking functions |

---

## 4. Learning Aggregation Cron

### 4.1 Purpose

Nightly computation for the Collective Intelligence Engine. Runs 14+ layers of analysis over accumulated user interaction data to improve prompt quality scoring, discover term patterns, and mine combination insights.

**File:** `src/app/api/learning/aggregate/route.ts`
**Schedule:** `03:00 UTC daily`

### 4.2 Computation Layers

| Layer | Phase | Description |
|---|---|---|
| 1 | 5 — 5.3b | Co-occurrence matrix |
| 2 | 5 — 5.3c | Sequence patterns |
| 3 | 5 — 5.3d | Scene candidates |
| 4 | 6 | Weight Recalibration (scoring-weights) |
| 5 | 6 | Category Value Discovery (category-values) |
| 6 | 6 | Term Quality Scores (term-quality-scores) |
| 7 | 6 | Threshold Discovery (threshold-discovery) |
| 8 | 6 | Scorer Health Report (scorer-health-report) |
| 9 | 7.1 | Anti-pattern Detection (anti-patterns) |
| 10 | 7.1 | Collision Matrix (collision-matrix) |
| 11 | 7.2 | Iteration Tracking (iteration-insights) |
| 12 | 7.3 | Redundancy Detection (redundancy-groups) |
| 13 | 7.4 | Magic Combos (magic-combos) |
| 14a | 7.5 | Platform Term Quality (platform-term-quality) |

Additional layers for Temporal Intelligence (Phase 7.8) and Compression Intelligence (Phase 7.9) may also be present.

### 4.3 Auth & Safety

Same cron secret pattern (Bearer + custom headers + query param). Advisory lock prevents concurrent runs. Returns `404` on auth failure.

### 4.4 Key Files

| File | Purpose |
|---|---|
| `src/app/api/learning/aggregate/route.ts` | Cron handler (orchestrates all layers) |
| `src/lib/learning/` | Individual layer implementations |
| `src/data/learned/` | Output data files (co-occurrence, scores, patterns) |

---

## Dead Code & Known Issues

### Known Issues

1. **Index Rating SQL filter gap:** The Index Rating cron only queries 6 of 12 event types from `provider_activity_events`. The 6 Prompt Lab events are tracked and stored but not consumed by Index Rating. See §Event Tracking Endpoint for details. **Files:** `src/lib/index-rating/database.ts` — two SQL queries with hardcoded `IN (...)` clauses.

2. **LIVE_COLLECTION_CRON env var:** Orphaned. Zero references in the codebase. Created January 2025. Safe to delete from Vercel dashboard.

### Legacy Files

| File | Purpose | Status |
|---|---|---|
| `src/app/jobs/collect-metrics.ts` | Old metrics collection job | **Dead code — verify and delete** |
| `src/app/jobs/update-scores.ts` | Old score update job | **Dead code — verify and delete** |

---

## Changelog

- **9 Apr 2026 (v3.0.0):** Added Learning Aggregation as 4th cron (§4, 14+ layers). Fixed `vercel.json` example to show `?secret=$PROMAGEN_CRON_SECRET` on all paths (was missing, caused silent auth failure from launch until 7 Apr fix). Updated overview table to 4 crons. Added LIVE_COLLECTION_CRON to dead code section. Noted that Promagen Users cron counts ALL event types (no filter). Updated provider count to 40. Added demo data section (§1.5).
- **6 Apr 2026 (v2.0.0):** Complete rewrite. Auth pattern, Rankings cron, 12 event types, SQL gap flagged.
- **27 Jan 2026 (v1.0.0):** Index Rating cron.
- **22 Jan 2026 (v0.9.0):** Initial Promagen Users cron.

---

_This document is the authority for all Promagen cron jobs. `src.zip` is the Single Source of Truth — this document describes what exists in code, not what is planned._
