# Cron Jobs

This document is the **Single Source of Truth (SSOT)** for all scheduled background jobs in Promagen.

**Last updated:** 6 April 2026
**Version:** 2.0.0

---

## Table of Contents

1. [Overview](#overview)
2. [Cron Security](#cron-security)
3. [Event Tracking Endpoint](#event-tracking-endpoint)
4. [Promagen Users Aggregation](#1-promagen-users-aggregation)
5. [Index Rating Cron](#2-index-rating-cron)
6. [Rankings Cron](#3-rankings-cron)
7. [Dead Code & Known Issues](#dead-code--known-issues)

---

## Overview

Promagen runs 3 scheduled cron jobs via Vercel Cron, configured in `vercel.json`:

| Job                | Path                       | Schedule                    | Purpose                                                   |
| ------------------ | -------------------------- | --------------------------- | --------------------------------------------------------- |
| **Promagen Users** | `/api/promagen-users/cron` | Every 30 min (`:10`, `:40`) | Aggregate per-provider country usage from activity events |
| **Index Rating**   | `/api/index-rating/cron`   | `00:05 UTC daily`           | Calculate Elo-style competitive ratings for all providers |
| **Rankings**       | `/api/cron/rankings`       | Every hour (`:00`)          | Recalculate Bayesian vote-based rankings, store in KV     |

All crons return structured JSON responses for observability and log to Postgres run tables (Index Rating, Promagen Users) or KV (Rankings).

---

## Cron Security

### Authentication Pattern (All 3 Crons)

All cron endpoints accept authentication via any of these methods:

| Method                             | Header / Param | Used By                                                           |
| ---------------------------------- | -------------- | ----------------------------------------------------------------- |
| `Authorization: Bearer <secret>`   | Header         | **Vercel Cron default** — this is what Vercel sends in production |
| `x-promagen-cron: <secret>`        | Header         | Legacy / manual testing                                           |
| `x-cron-secret: <secret>`          | Header         | Legacy / manual testing                                           |
| `x-promagen-cron-secret: <secret>` | Header         | Legacy / manual testing                                           |
| `?secret=<secret>`                 | Query param    | Manual testing via curl                                           |

All three crons use **timing-safe comparison** (`crypto.timingSafeEqual`) to prevent timing attacks on secret validation.

Unauthenticated requests return `404 Not Found` (Index Rating, Promagen Users) or `401 Unauthorized` (Rankings) — hiding endpoint existence from attackers.

### Environment Variable

| Variable               | Required | Min Length | Description                          |
| ---------------------- | -------- | ---------- | ------------------------------------ |
| `PROMAGEN_CRON_SECRET` | Yes      | 16 chars   | Shared secret for all cron endpoints |

### Vercel Cron Configuration

In `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/promagen-users/cron",
      "schedule": "10,40 * * * *"
    },
    {
      "path": "/api/index-rating/cron",
      "schedule": "5 0 * * *"
    },
    {
      "path": "/api/cron/rankings",
      "schedule": "0 * * * *"
    }
  ]
}
```

Vercel Cron sends the `CRON_SECRET` environment variable as `Authorization: Bearer <CRON_SECRET>`. Promagen maps this via `PROMAGEN_CRON_SECRET` in the Vercel dashboard.

---

## Event Tracking Endpoint

All engagement events that feed the crons are captured by a single endpoint:

**Path:** `POST /api/events/track`
**File:** `src/app/api/events/track/route.ts`

### 12 Event Types

Event configuration lives in `src/types/index-rating.ts` as `EVENT_CONFIG`:

| Event Type            | Base Points | K-Factor | Source                          |
| --------------------- | ----------- | -------- | ------------------------------- |
| `vote`                | 5           | 32       | Image quality vote              |
| `prompt_submit`       | 5           | 24       | Copy in prompt builder          |
| `prompt_builder_open` | 3           | 16       | Open provider detail page       |
| `open`                | 2           | 16       | Provider page / outbound click  |
| `click`               | 2           | 16       | Legacy alias for `open`         |
| `social_click`        | 1           | 8        | Social media icon click         |
| `prompt_lab_select`   | 4           | 20       | Select provider in Prompt Lab   |
| `prompt_lab_generate` | 7           | 28       | Generate prompts in Prompt Lab  |
| `prompt_lab_copy`     | 6           | 24       | Copy tier prompt in Prompt Lab  |
| `prompt_lab_optimise` | 8           | 32       | Run Call 3 in Prompt Lab        |
| `prompt_save`         | 4           | 20       | Save prompt to library          |
| `prompt_reformat`     | 3           | 16       | Reformat for different platform |

Events are stored in `provider_activity_events` with country code derived from `x-vercel-ip-country` header.

Rate limit: 30 events per session per minute (in-memory, resets on deploy).

### ⚠️ Known Gap — Cron SQL Filter

The Index Rating cron's database query only processes 6 of 12 event types:

```sql
AND event_type IN ('vote', 'open', 'click', 'prompt_builder_open', 'prompt_submit', 'social_click')
```

The 6 Prompt Lab events (`prompt_lab_select`, `prompt_lab_generate`, `prompt_lab_copy`, `prompt_lab_optimise`, `prompt_save`, `prompt_reformat`) are tracked and stored in the database but **not consumed by the cron**. The events exist in `provider_activity_events` but do not influence Index Ratings. The EVENT_CONFIG defines weights for them, but the database query filters them out.

**Files affected:** `src/lib/index-rating/database.ts` — two SQL queries with hardcoded `IN (...)` clauses.

---

## 1. Promagen Users Aggregation

### 1.1 Purpose

Shows per-provider country usage statistics in the leaderboard. Displays the top 6 countries by Promagen usage for each provider.

**UI Location:** AI Providers Leaderboard → "Promagen Users" column
**Visual format:** Flag grid with Roman numeral counts (max 6 flags per provider)

### 1.2 Data Flow

```
1. USER EVENT (open, click, vote, etc.)
   └─► /api/events/track (POST)
       └─► INSERT INTO provider_activity_events
           (click_id, provider_id, country_code, event_type, ...)

2. CRON RUNS (every 30 minutes)
   └─► /api/promagen-users/cron
       └─► Aggregates last 30 days by (provider_id, country_code)
       └─► UPSERT INTO provider_country_usage_30d
       └─► INSERT INTO promagen_users_cron_runs (observability)

3. FRONTEND LOADS
   └─► /api/providers (GET)
       └─► getPromagenUsersForProviders(providerIds)
       └─► Returns providers with promagenUsers[] attached

4. UI RENDERS
   └─► providers-table.tsx → PromagenUsersCell
   └─► leaderboard-rail.tsx (left rail — does not display users directly)
```

### 1.3 Route

**Path:** `/api/promagen-users/cron`
**Method:** GET
**Schedule:** Every 30 minutes (`:10` and `:40`)
**File:** `src/app/api/promagen-users/cron/route.ts`

**Query params:**

| Param        | Default | Description                                 |
| ------------ | ------- | ------------------------------------------- |
| `secret`     | —       | `PROMAGEN_CRON_SECRET` (for manual testing) |
| `dryRun`     | `0`     | If `1`, count only, no writes               |
| `windowDays` | `30`    | Aggregation window in days                  |

**Auth:** `Authorization: Bearer` + all legacy header/query param methods (see §Cron Security).

**Advisory lock:** `pg_try_advisory_lock(42_4242)` prevents concurrent runs.

### 1.4 Database Schema

**Table: `provider_activity_events`** — Raw click/engagement events.

```sql
CREATE TABLE IF NOT EXISTS provider_activity_events (
  click_id      TEXT        NOT NULL PRIMARY KEY,
  provider_id   TEXT        NOT NULL,
  event_type    TEXT        NOT NULL DEFAULT 'open',
  src           TEXT,
  user_id       TEXT,
  country_code  TEXT,       -- ISO 3166-1 alpha-2
  ip            TEXT,
  user_agent    TEXT,
  is_affiliate  BOOLEAN     DEFAULT FALSE,
  destination   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Table: `provider_country_usage_30d`** — Aggregated per-provider per-country usage.

```sql
CREATE TABLE IF NOT EXISTS provider_country_usage_30d (
  provider_id   TEXT        NOT NULL,
  country_code  TEXT        NOT NULL,
  users_count   BIGINT      NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (provider_id, country_code)
);
```

**Table: `promagen_users_cron_runs`** — Run log for observability.

```sql
CREATE TABLE IF NOT EXISTS promagen_users_cron_runs (
  id                  TEXT        NOT NULL PRIMARY KEY,
  ran_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ok                  BOOLEAN     NOT NULL,
  message             TEXT,
  rows_affected       BIGINT      NOT NULL DEFAULT 0,
  providers_affected  BIGINT      NOT NULL DEFAULT 0
);
```

### 1.5 Library Helpers

**File:** `src/lib/promagen-users/index.ts`

| Export                              | Purpose                                          |
| ----------------------------------- | ------------------------------------------------ |
| `MAX_COUNTRIES_PER_PROVIDER = 6`    | Top 6 countries per provider                     |
| `STALE_THRESHOLD_HOURS = 48`        | Data older than this returns empty               |
| `isStale(updatedAt)`                | Returns true if null or >48h old                 |
| `normalizeCountryCode(code)`        | Validates/normalizes to uppercase, rejects XX/ZZ |
| `getPromagenUsersForProvider(id)`   | Returns top 6 countries for one provider         |
| `getPromagenUsersForProviders(ids)` | Batch version returning map                      |

### 1.6 Environment Variables

| Variable                           | Required | Default | Description                |
| ---------------------------------- | -------- | ------- | -------------------------- |
| `DATABASE_URL`                     | Yes\*    | —       | Postgres connection string |
| `POSTGRES_URL`                     | Yes\*    | —       | Neon/Vercel fallback       |
| `PROMAGEN_CRON_SECRET`             | Yes      | —       | Min 16 chars               |
| `PROMAGEN_USERS_WINDOW_DAYS`       | No       | `30`    | Aggregation window         |
| `PROMAGEN_USERS_STALE_AFTER_HOURS` | No       | `48`    | Staleness threshold        |

\*At least one of `DATABASE_URL` or `POSTGRES_URL` must be set.

### 1.7 Observability

**Debug endpoint:** `GET /api/promagen-users/debug?secret=YOUR_SECRET` — returns DB connectivity, aggregation stats, last cron run, sample data.

---

## 2. Index Rating Cron

### 2.1 Purpose

Calculates daily Elo-style competitive rankings for all AI providers. Processes engagement events, applies Market Power Index (MPI) handicapping, daily regression toward baseline, and updates the `provider_ratings` table.

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

1. **Load data:** providers from `providers.json`, market power from `market-power.json`, current ratings from `provider_ratings`, events from `provider_activity_events` (180-day lookback).
2. **For each provider:**
   - If no existing rating → auto-seed (incumbents with MPI >5.0 get higher seed).
   - If existing → calculate Elo change from events, apply daily regression toward baseline, apply rating floor.
3. **Calculate ranks:** Sort all providers by new rating descending, assign rank 1–N.
4. **Detect rank climbers:** If rank improved (lower number = better), set `rankChangedAt` to now.
5. **Persist:** Upsert to `provider_ratings`, log to `index_rating_cron_runs`.

### 2.4 Elo Calculation

**Effective points** per event = `basePoints × staticBonus × timeDecay × newcomerBoost`

**Static bonuses** (from `src/types/index-rating.ts`):

| Factor              | Multiplier |
| ------------------- | ---------- |
| API available       | ×1.10      |
| Affiliate programme | ×1.05      |
| Supports prefill    | ×1.05      |

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

Demo jitter (±1–3 points every 45s) is applied client-side, cosmetic only, gated by `NEXT_PUBLIC_DEMO_JITTER` env var. See `lefthand-rail.md` §6.

### 2.7 Environment Variables

| Variable                    | Required | Default | Description                |
| --------------------------- | -------- | ------- | -------------------------- |
| `DATABASE_URL`              | Yes\*    | —       | Postgres connection string |
| `PROMAGEN_CRON_SECRET`      | Yes      | —       | Protects cron endpoint     |
| `INDEX_RATING_BASELINE`     | No       | `1500`  | Elo baseline               |
| `INDEX_RATING_DECAY_LAMBDA` | No       | `0.02`  | Daily regression rate      |
| `INDEX_RATING_STALE_HOURS`  | No       | `48`    | Staleness threshold        |

### 2.8 Testing

```powershell
# Local (dev server running)
curl "http://localhost:3000/api/index-rating/cron?secret=YOUR_SECRET"

# With dry run
curl "http://localhost:3000/api/index-rating/cron?secret=YOUR_SECRET&dryRun=1"
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

| File                                 | Purpose                                          |
| ------------------------------------ | ------------------------------------------------ |
| `src/app/api/cron/rankings/route.ts` | Cron handler                                     |
| `src/lib/voting/security.ts`         | `validateCronAuth()` with timing-safe comparison |
| `src/lib/voting/index.ts`            | Exports all voting/ranking functions             |

---

## Dead Code & Known Issues

### Known Issues

1. **Cron SQL filter gap:** The Index Rating cron only queries 6 of 12 event types from `provider_activity_events`. The 6 Prompt Lab events are tracked and stored but not consumed. See §Event Tracking Endpoint for details.

### Files

| File                              | Purpose                    | Status                   |
| --------------------------------- | -------------------------- | ------------------------ |
| `src/app/jobs/collect-metrics.ts` | Old metrics collection job | **Verify if still used** |
| `src/app/jobs/update-scores.ts`   | Old score update job       | **Verify if still used** |

---

## Changelog

- **6 Apr 2026 (v2.0.0):** Complete rewrite from src.zip SSoT. Auth pattern updated: all 3 crons now accept `Authorization: Bearer <secret>` (Vercel Cron default) in addition to legacy custom headers and query params. Rankings cron (§3) added — was previously undocumented. Event tracking endpoint documented with all 12 event types and weights. Known gap flagged: cron SQL only processes 6 of 12 event types. Display inflation (+200) documented. Dead code section added.
- **27 Jan 2026 (v1.0.0):** Added Index Rating cron documentation.
- **22 Jan 2026 (v0.9.0):** Initial Promagen Users cron implementation.

---

_This document is the authority for all Promagen cron jobs. `src.zip` is the Single Source of Truth — this document describes what exists in code, not what is planned._
