# Cron Jobs

This document is the **Single Source of Truth (SSOT)** for all scheduled background jobs in Promagen.

**Last updated:** January 22, 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Promagen Users Aggregation](#1-promagen-users-aggregation)
   - [Purpose](#11-purpose)
   - [Data Flow](#12-data-flow)
   - [Database Schema](#13-database-schema)
   - [Cron Route](#14-cron-route)
   - [Library Helpers](#15-library-helpers)
   - [Frontend Integration](#16-frontend-integration)
   - [Environment Variables](#17-environment-variables)
   - [Observability](#18-observability)
   - [Testing](#19-testing)

---

## Overview

Promagen uses Vercel Cron to run scheduled background jobs. All cron endpoints are protected by `PROMAGEN_CRON_SECRET` and return structured JSON responses for observability.

### Cron Security

All cron endpoints require authentication via one of:

- Header: `x-promagen-cron: <secret>`
- Header: `x-cron-secret: <secret>`
- Query param: `?secret=<secret>`

Unauthenticated requests return `404 Not Found` (security: don't reveal endpoint exists).

### Vercel Cron Configuration

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/promagen-users/cron?secret=$PROMAGEN_CRON_SECRET",
      "schedule": "10,40 * * * *"
    }
  ]
}
```

---

## 1. Promagen Users Aggregation

### 1.1 Purpose

The **Promagen Users** feature shows usage statistics per AI provider in the leaderboard. It displays the top 6 countries by Promagen usage **for each provider** (not a global total).

**UI Location:** AI Providers Leaderboard → "Promagen Users" column

**Visual format:**

- 2×2×2 grid layout (6 countries max)
- Flag + Roman numeral count per country
- Example: 🇺🇸 XLII 🇬🇧 XVII

**Truth rules:**

- Show only analytics-derived data (no synthetic/demo)
- Empty cell if zero users
- Empty cell if data is stale (>48 hours)
- If provider has <6 countries, show only those (no empty slots)

### 1.2 Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         DATA FLOW                               │
└─────────────────────────────────────────────────────────────────┘

1. USER CLICKS PROVIDER
   └─► /app/go/[providerId]/route.ts
       └─► INSERT INTO provider_activity_events
           (click_id, provider_id, country_code, user_id, ...)

2. CRON RUNS (every 30 minutes)
   └─► /api/promagen-users/cron
       └─► Aggregates last 30 days by (provider_id, country_code)
       └─► UPSERT INTO provider_country_usage_30d
       └─► INSERT INTO promagen_users_cron_runs (observability)

3. FRONTEND LOADS
   └─► /api/providers (GET)
       └─► Calls getPromagenUsersForProviders(providerIds)
       └─► Returns providers with promagenUsers[] attached

4. UI RENDERS
   └─► providers-table.tsx
       └─► PromagenUsersCell renders flags + counts
```

### 1.3 Database Schema

**Location:** Neon Postgres (Vercel integration)

#### Table: `provider_activity_events`

Raw click events captured when users click provider links.

```sql
CREATE TABLE IF NOT EXISTS provider_activity_events (
  click_id      TEXT        NOT NULL PRIMARY KEY,
  provider_id   TEXT        NOT NULL,
  event_type    TEXT        NOT NULL DEFAULT 'open',
  src           TEXT,                              -- e.g., 'leaderboard_homepage'
  user_id       TEXT,                              -- Clerk user ID if logged in
  country_code  TEXT,                              -- ISO 3166-1 alpha-2
  ip            TEXT,
  user_agent    TEXT,
  is_affiliate  BOOLEAN     DEFAULT FALSE,
  destination   TEXT,                              -- Provider URL
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provider_activity_events_aggregation
ON provider_activity_events (provider_id, country_code, created_at);
```

**Event taxonomy:**

| eventType | Weight | Description               |
| --------- | ------ | ------------------------- |
| `open`    | 1      | Click to provider website |

#### Table: `provider_country_usage_30d`

Aggregated usage data per provider per country.

```sql
CREATE TABLE IF NOT EXISTS provider_country_usage_30d (
  provider_id   TEXT        NOT NULL,
  country_code  TEXT        NOT NULL,
  users_count   BIGINT      NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (provider_id, country_code)
);

CREATE INDEX IF NOT EXISTS idx_provider_country_usage_30d_provider
ON provider_country_usage_30d (provider_id);
```

**Key insight:** Primary key is `(provider_id, country_code)` so we get **per-provider breakdown** (required by spec).

#### Table: `promagen_users_cron_runs`

Cron run log for observability.

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

### 1.4 Cron Route

**Path:** `/api/promagen-users/cron`  
**Method:** GET  
**Schedule:** Every 30 minutes (`:10` and `:40` past the hour)

**File:** `src/app/api/promagen-users/cron/route.ts`

#### Request

```
GET /api/promagen-users/cron?secret=YOUR_SECRET
GET /api/promagen-users/cron?secret=YOUR_SECRET&dryRun=1
GET /api/promagen-users/cron?secret=YOUR_SECRET&windowDays=7
```

| Param        | Default  | Description                   |
| ------------ | -------- | ----------------------------- |
| `secret`     | required | PROMAGEN_CRON_SECRET          |
| `dryRun`     | `0`      | If `1`, count only, no writes |
| `windowDays` | `30`     | Aggregation window in days    |

#### Response

```json
{
  "ok": true,
  "message": "Aggregated + upserted (per-provider)",
  "totalRows": 1234,
  "windowDays": 30,
  "dryRun": false,
  "skipped": false,
  "affected": 87,
  "providersAffected": 24,
  "totalAggRows": 156,
  "totalProviders": 24,
  "cadenceMinutes": 30,
  "requestId": "abc123",
  "ranAt": "2026-01-22T17:10:00.000Z",
  "durationMs": 234
}
```

#### Aggregation Query

```sql
WITH agg AS (
  SELECT
    lower(trim(provider_id)) AS provider_id,
    coalesce(nullif(upper(trim(country_code)), ''), 'ZZ') AS country_code,
    count(DISTINCT coalesce(user_id, click_id))::bigint AS users_count
  FROM provider_activity_events
  WHERE created_at >= now() - (30 || ' days')::interval
    AND provider_id IS NOT NULL
    AND trim(provider_id) <> ''
  GROUP BY 1, 2
)
INSERT INTO provider_country_usage_30d (provider_id, country_code, users_count, updated_at)
SELECT provider_id, country_code, users_count, now()
FROM agg
ON CONFLICT (provider_id, country_code)
DO UPDATE SET users_count = excluded.users_count, updated_at = excluded.updated_at
RETURNING provider_id
```

#### Advisory Lock

The cron uses a Postgres advisory lock (`pg_try_advisory_lock(42_4242)`) to prevent overlapping executions.

### 1.5 Library Helpers

**File:** `src/lib/promagen-users/index.ts`

#### Constants

```typescript
export const MAX_COUNTRIES_PER_PROVIDER = 6; // Top 6 countries per provider
export const STALE_THRESHOLD_HOURS = 48; // Data older than this is stale
```

#### `isStale(updatedAt: Date | null | undefined): boolean`

Returns `true` if the timestamp is null or older than `STALE_THRESHOLD_HOURS`.

#### `normalizeCountryCode(code: string | null | undefined): string | null`

Validates and normalizes country codes:

- Trims whitespace
- Converts to uppercase
- Returns `null` for invalid codes (length ≠ 2, non-alpha, `XX`, `ZZ`)

#### `getPromagenUsersForProvider(providerId: string): Promise<PromagenUsersCountryUsage[]>`

Fetches usage data for a single provider. Returns empty array if:

- Database not configured
- No data exists
- Data is stale

#### `getPromagenUsersForProviders(providerIds: string[]): Promise<Map<string, PromagenUsersCountryUsage[]>>`

Bulk fetch for multiple providers (single query, more efficient).

#### `getLastCronRun(): Promise<CronRunInfo | null>`

Returns info about the most recent cron run for observability.

#### `checkAggregationHealth(): Promise<AggregationHealth>`

Returns table stats for debugging:

- `tableExists`: boolean
- `rowCount`: number
- `providerCount`: number
- `oldestUpdate`: Date | null
- `newestUpdate`: Date | null

### 1.6 Frontend Integration

#### Types

**File:** `src/types/promagen-users.ts`

```typescript
export type PromagenUsersCountryUsage = {
  countryCode: string; // ISO 3166-1 alpha-2
  count: number; // Distinct users in window
};
```

**File:** `src/types/providers.ts`

```typescript
export type Provider = {
  // ... other fields ...
  promagenUsers?: ReadonlyArray<PromagenUsersCountryUsage>;
};
```

#### Providers API

**File:** `src/app/api/providers/route.ts`

The providers API enriches each provider with `promagenUsers` data:

```typescript
import { getPromagenUsersForProviders } from '@/lib/promagen-users';

async function enrichWithPromagenUsers(providers: Provider[]): Promise<Provider[]> {
  if (!hasDatabaseConfigured()) return providers;

  const providerIds = providers.map((p) => p.id);
  const usageMap = await getPromagenUsersForProviders(providerIds);

  return providers.map((provider) => {
    const usage = usageMap.get(provider.id.toLowerCase());
    if (usage && usage.length > 0) {
      return { ...provider, promagenUsers: usage };
    }
    return provider;
  });
}
```

#### UI Component

**File:** `src/components/providers/promagen-users-cell.tsx`

Renders the 2×2×2 grid with flags and Roman numeral counts.

### 1.7 Environment Variables

| Variable                           | Required | Default | Description                           |
| ---------------------------------- | -------- | ------- | ------------------------------------- |
| `DATABASE_URL`                     | Yes\*    | —       | Postgres connection string            |
| `POSTGRES_URL`                     | Yes\*    | —       | Neon/Vercel sets this (fallback)      |
| `PROMAGEN_CRON_SECRET`             | Yes      | —       | Min 16 chars, protects cron endpoints |
| `PROMAGEN_USERS_WINDOW_DAYS`       | No       | `30`    | Aggregation window                    |
| `PROMAGEN_USERS_STALE_AFTER_HOURS` | No       | `48`    | Staleness threshold                   |

\*At least one of `DATABASE_URL` or `POSTGRES_URL` must be set.

### 1.8 Observability

#### Debug Endpoint

**Path:** `/api/promagen-users/debug?secret=YOUR_SECRET`

Returns comprehensive health check:

- Database connectivity
- Aggregation table stats
- Last cron run info
- Raw event stats
- Sample provider data (top 5)

#### Logs

All operations use structured JSON logging:

```json
{
  "level": "info",
  "route": "/api/promagen-users/cron",
  "requestId": "abc123",
  "event": "run",
  "ok": true,
  "affected": 87,
  "providersAffected": 24,
  "durationMs": 234
}
```

#### Error Handling

- **Table doesn't exist:** Silently returns empty (expected during initial setup)
- **Database unreachable:** Graceful degradation, returns empty arrays
- **Stale data:** Returns empty array, logs warning
- **Invalid country codes:** Filtered out (XX, ZZ rejected)

### 1.9 Testing

**File:** `src/__tests__/promagen-users.aggregation.test.ts`

Unit tests for:

- `isStale()` function
- `normalizeCountryCode()` function
- Data shape validation
- Edge cases (zero count, large counts, invalid codes)

---

## 2. Index Rating Cron

### 2.1 Purpose

The **Index Rating** cron job calculates daily Elo-style competitive rankings for all AI providers. It processes engagement events, applies Market Power Index handicapping, and updates the `provider_ratings` table.

**UI Location:** AI Providers Leaderboard → "Index Rating" column

**Visual format:**

- Two-line display: Rating value + change indicator
- Colors: Green (▲ gain), Red (▼ loss), Gray (● flat/fallback)
- Example: `1,847` / `▲ +23 (+1.26%)`

### 2.2 Schedule

| Cron Job     | Schedule    | Time (UTC)  | Purpose                           |
| ------------ | ----------- | ----------- | --------------------------------- |
| Index Rating | `5 0 * * *` | 00:05 daily | Calculate ratings, ranks, changes |

**Why 00:05 not 00:00?** Gives 5 minutes buffer after midnight for timezone edge cases.

### 2.3 Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                      INDEX RATING CRON                               │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  providers.json │     │ market-power.   │     │provider_activity│
│  (42 providers) │     │    json         │     │    _events      │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────┬───────┴───────────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │   Cron Route        │
              │ /api/index-rating/  │
              │     cron            │
              └──────────┬──────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
   ┌───────────┐   ┌───────────┐   ┌───────────┐
   │ Calculate │   │ Calculate │   │  Update   │
   │   MPI     │   │    Elo    │   │   Ranks   │
   └─────┬─────┘   └─────┬─────┘   └─────┬─────┘
         │               │               │
         └───────────────┼───────────────┘
                         ▼
              ┌─────────────────────┐
              │  provider_ratings   │
              │      (DB)           │
              └─────────────────────┘
```

### 2.4 Database Schema

```sql
-- Provider ratings (updated daily by cron)
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

-- Cron run logs
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

### 2.5 Cron Route

**File:** `src/app/api/index-rating/cron/route.ts`

```typescript
// Key imports
import providers from '@/data/providers/providers.json';
import marketPowerData from '@/data/providers/market-power.json';
import { calculateMPI, calculateTotalEloChange } from '@/lib/index-rating/calculations';

// Authentication check
const secret =
  request.headers.get('x-promagen-cron') ||
  request.headers.get('x-cron-secret') ||
  searchParams.get('secret');

if (secret !== env.PROMAGEN_CRON_SECRET) {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

// Advisory lock prevents concurrent runs
await db.query('SELECT pg_try_advisory_lock(12345)');
```

### 2.6 Event Types Processed

| Event Type            | Base Points | K-Factor | Status     |
| --------------------- | ----------- | -------- | ---------- |
| `vote`                | 5           | 32       | ✅ Tracked |
| `prompt_submit`       | 5           | 24       | ✅ Tracked |
| `prompt_builder_open` | 3           | 16       | ✅ Tracked |
| `open` / `click`      | 2           | 16       | ✅ Tracked |
| `social_click`        | 1           | 8        | ✅ Tracked |

### 2.7 Environment Variables

| Variable                    | Required | Default | Description                |
| --------------------------- | -------- | ------- | -------------------------- |
| `DATABASE_URL`              | Yes\*    | —       | Postgres connection string |
| `PROMAGEN_CRON_SECRET`      | Yes      | —       | Protects cron endpoint     |
| `INDEX_RATING_BASELINE`     | No       | `1500`  | Elo baseline               |
| `INDEX_RATING_DECAY_LAMBDA` | No       | `0.02`  | Time decay rate            |
| `INDEX_RATING_STALE_HOURS`  | No       | `48`    | Staleness threshold        |

### 2.8 Response Format

**Success:**

```json
{
  "ok": true,
  "message": "Index rating calculation completed",
  "providersUpdated": 42,
  "providersSeeded": 0,
  "durationMs": 1234
}
```

**Error (auth):**

```json
{ "error": "Not found" }
```

Status: 404

### 2.9 Testing

**Manual test command:**

```powershell
# Run from: Any directory

# Local (dev server running)
curl "http://localhost:3000/api/index-rating/cron?secret=S9W5q-BIVVJO_ZL95K6pvqQTqDo3NwOt5JUxdQHReEQ"

# Production
curl "https://promagen.vercel.app/api/index-rating/cron?secret=$PROMAGEN_CRON_SECRET"
```

**Verification:**

- Response should show `providersUpdated: 42`
- Check `provider_ratings` table has 42 rows
- Check `index_rating_cron_runs` has new entry

````

## Changelog

- **22 Jan 2026:** Initial Promagen Users cron implementation
  - Created cron route with per-provider aggregation
  - Created library helpers with graceful error handling
  - Created debug endpoint for observability
  - Integrated with providers API
  - Added comprehensive tests
```markdown
- **27 Jan 2026:** Added Index Rating cron documentation
  - Full section 2 with data flow, schema, route, testing
  - Documented all event types and their tracking status
  - Added environment variables reference

curl "http://localhost:3000/api/index-rating/cron?secret=S9W5q-BIVVJO_ZL95K6pvqQTqDo3NwOt5JUxdQHReEQ"

curl "http://localhost:3000/api/promagen-users/cron?secret=S9W5q-BIVVJO_ZL95K6pvqQTqDo3NwOt5JUxdQHReEQ"
````
