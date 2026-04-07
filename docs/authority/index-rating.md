# Index Rating System

**Last updated:** 6 April 2026
**Version:** 2.0.0
**Owner:** Promagen
**Status:** Authority Document — verified against `src.zip` SSoT

---

## Purpose

Promagen's Index Rating is a dynamic, Elo-style competitive ranking for 40 AI image generation providers. Ratings move daily based on user engagement events, handicapped by Market Power Index (MPI) so smaller platforms can outclimb giants through proportionally higher engagement.

**Where it appears:**

- Homepage (`/`) — ProvidersTable "Index Rating" column
- Prompt Lab (`/studio/playground`) — LeaderboardRail left rail (mini leaderboard with demo jitter)
- Provider pages (`/providers/[id]`) — ProvidersTable

---

## Constants (from `src/types/index-rating.ts`)

| Constant                        | Value  | Purpose                                                  |
| ------------------------------- | ------ | -------------------------------------------------------- |
| `INDEX_RATING_BASELINE`         | 1500   | Elo baseline for all providers                           |
| `INDEX_RATING_DECAY_LAMBDA`     | 0.02   | Time decay rate (half-life ≈ 35 days)                    |
| `INDEX_RATING_DAILY_REGRESSION` | 0.002  | Daily pull toward baseline (0.2%/day)                    |
| `INDEX_RATING_MIN_FLOOR`        | 100    | Minimum rating floor                                     |
| `INDEX_RATING_FLAT_THRESHOLD`   | 0.1    | ±0.1% = flat display state                               |
| `INDEX_RATING_ADVISORY_LOCK_ID` | 424243 | Postgres advisory lock for cron                          |
| `INDEX_RATING_STALE_HOURS`      | 48     | Staleness threshold                                      |
| `DISPLAY_INFLATION_OFFSET`      | 200    | Added to all ratings for display only — NOT stored in DB |

---

## 12 Event Types (from `EVENT_CONFIG`)

All defined in `src/types/index-rating.ts`. Tracked via `POST /api/events/track`.

| Event Type            | Base Points | K-Factor | Source                          | Wired                              |
| --------------------- | ----------- | -------- | ------------------------------- | ---------------------------------- |
| `vote`                | 5           | 32       | Image quality vote              | ✅ `image-quality-vote-button.tsx` |
| `prompt_submit`       | 5           | 24       | Copy in prompt builder          | ✅ `copy-open-button.tsx`          |
| `prompt_builder_open` | 3           | 16       | Provider detail page load       | ✅ `provider-page-tracker.tsx`     |
| `open`                | 2           | 16       | Outbound click via `/go/[id]`   | ✅ `/go/[id]/route.ts`             |
| `click`               | 2           | 16       | Legacy alias for `open`         | ✅                                 |
| `social_click`        | 1           | 8        | Social media icon click         | ✅ `support-icons-cell.tsx`        |
| `prompt_lab_select`   | 4           | 20       | Select provider in Prompt Lab   | ✅ `playground-workspace.tsx`      |
| `prompt_lab_generate` | 7           | 28       | Generate prompts in Prompt Lab  | ✅ `playground-workspace.tsx`      |
| `prompt_lab_copy`     | 6           | 24       | Copy tier prompt in Prompt Lab  | Hook exists, wiring TBC            |
| `prompt_lab_optimise` | 8           | 32       | Run Call 3 in Prompt Lab        | Hook exists, wiring TBC            |
| `prompt_save`         | 4           | 20       | Save prompt to library          | ✅ `save-icon.tsx`                 |
| `prompt_reformat`     | 3           | 16       | Reformat for different platform | ✅ `reformat-preview.tsx`          |

### ⚠️ Known Gap — Cron SQL Filter

The Index Rating cron only queries **6 of 12 event types** from the database:

```sql
AND event_type IN ('vote', 'open', 'click', 'prompt_builder_open', 'prompt_submit', 'social_click')
```

The 6 Prompt Lab and Library events are tracked, stored in `provider_activity_events`, have weights in `EVENT_CONFIG`, but are **excluded by hardcoded SQL** in `src/lib/index-rating/database.ts` (two queries). These events do not influence Index Ratings despite being designed to.

---

## Calculation Pipeline

### Per-Event Effective Points

```
EffectivePoints = BasePoints × StaticBonus × TimeDecay × NewcomerBoost
```

### Static Bonuses (multiplicative)

| Factor              | Multiplier | Source                        |
| ------------------- | ---------- | ----------------------------- |
| API available       | ×1.10      | `provider.apiAvailable`       |
| Affiliate programme | ×1.05      | `provider.affiliateProgramme` |
| Supports prefill    | ×1.05      | `provider.supportsPrefill`    |

### Time Decay

```
TimeDecay = e^(-0.02 × daysOld)
```

Half-life ≈ 35 days. Events from 70 days ago have ~25% weight.

### Newcomer Boost

| Age        | Multiplier |
| ---------- | ---------- |
| 0–3 months | ×1.20      |
| 3–6 months | ×1.10      |
| 6+ months  | ×1.00      |

### Market Power Index (MPI)

```
MPI = 1 + SocialFactor + YearsFactor + UsersFactor
```

Where:

- `SocialFactor = log₁₀(1 + avgSocialFollowers / 1000)` — average across available platforms (YouTube, X, Instagram, Facebook, Discord, LinkedIn, TikTok, Reddit, Pinterest)
- `YearsFactor = yearsActive × 0.1`
- `UsersFactor = log₁₀(1 + estimatedUsers / 100000)`

Clamped to range 1.0–10.0. Default 3.0 when no market power data exists.

Higher MPI = bigger provider = fewer points per engagement (handicap). 37 of 40 providers have market power data in `src/data/providers/market-power.json` (last researched 27 Jan 2026).

### Elo Gain per Event

```
EloGain = (EffectivePoints / MPI) × K-Factor × (1 - 0.5)
```

Simplified Elo with Actual=1 (engagement received), Expected=0.5 (neutral baseline).

### Daily Rating Update (Cron)

1. Sum Elo gains from all events in 180-day lookback window
2. Apply daily regression: `NewRating = Rating × 0.998 + Baseline × 0.002`
3. Apply floor (minimum 100)
4. Calculate ranks (sort by rating descending)
5. Detect rank climbers (rank improved = `rankChangedAt` set to now)
6. Upsert to `provider_ratings`

---

## Seeding Formula (New Providers)

```
Seed = 1000 + (currentScore × 8) + bonuses - penalties
```

| Factor                       | Value         |
| ---------------------------- | ------------- |
| Base                         | 1000          |
| Score scaling                | 0–100 → 0–800 |
| API bonus                    | +50           |
| Affiliate bonus              | +25           |
| Incumbent penalty (MPI >5.0) | -30           |
| Floor                        | 100           |

---

## Display Layer

### IndexRatingCell (`src/components/providers/index-rating-cell.tsx`)

Two-line display in the leaderboard table:

```
Line 1: 1,847         (white, animated ticker — 600ms ease-out cubic)
Line 2: ▲ +23 (+1.26%)  (green for gain, red for loss, grey for flat)
```

**Rating ticker:** `useRatingTicker()` hook animates the number from old value to new over 600ms using `requestAnimationFrame`. Respects `prefers-reduced-motion`.

**Colours** (CSS classes with `!important` to override table rules):

- `.index-rating-gain`: `#22c55e` (green)
- `.index-rating-loss`: `#ef4444` (red)
- `.index-rating-flat`: `#6b7280` (grey)

**Mobile (<640px):** Percentage hidden via `.index-rating-percent { display: none }`.

### +200 Display Inflation

`DISPLAY_INFLATION_OFFSET = 200` is added to all raw Elo scores in the frontend. A raw rating of 1500 displays as 1700. This is cosmetic — the database stores the raw value. Applied in `leaderboard-rail.tsx` line 131 and `providers-table.tsx`.

### Rank Change Indicator

Green ⬆ arrow with pulsing glow animation when `rankChangedAt` is within 24 hours. CSS class `rank-up-arrow` with `@keyframes rank-up-glow` animation (2s, infinite). Row also gets `rank-climber-row` class for flash effect.

**No down arrow.** Design philosophy: celebrate climbers, don't shame fallers.

### Badges (Calculated, Not Rendered)

`isUnderdog` (MPI <3.0) and `isNewcomer` (founded <12 months ago) are computed and available in `DisplayRating` but the `UnderdogBadge` and `NewcomerBadge` components are not rendered in the current table layout. Components exist in `index-rating-cell.tsx`.

---

## Demo Jitter System

Controlled by `NEXT_PUBLIC_DEMO_JITTER` environment variable (`'true'` = on).

| Setting        | Value                                                    |
| -------------- | -------------------------------------------------------- |
| Interval       | 45 seconds                                               |
| Range          | ±1 to ±3 points (random per provider per tick)           |
| Application    | After sort — cosmetic only, never causes row reorder     |
| Change arrows  | Jittered values produce green/red arrows                 |
| Reduced motion | Timer does not start if `prefers-reduced-motion: reduce` |
| Hydration      | `jitterTick` starts at 0 (no jitter on first render)     |

Same env var also controls Promagen Users demo and main homepage jitter. Turning it off kills all three.

Implemented in `leaderboard-rail.tsx` (Prompt Lab left rail) and `providers-table.tsx` (main leaderboard).

---

## LeaderboardRail (Prompt Lab Left Rail)

`src/components/prompt-lab/leaderboard-rail.tsx` — mini leaderboard in the Prompt Lab.

- Top 10 default, "Show all 40" expand
- Columns: Provider (rank + icon + name), Support (hidden <1800px), Index Rating
- Sort by Index Rating (toggle asc/desc)
- Ranks computed from fixed descending sort (never flip with display sort)
- Server-prefetched `initialRatings` eliminates client waterfall
- Clicking provider name selects for optimisation in centre workspace
- Clicking provider icon → homepage in new tab (`stopPropagation`)

> **Full specification:** `lefthand-rail.md` v2.0.0

---

## Client Hook (`src/hooks/use-index-rating-events.ts`)

Provides 10 tracking functions, all fire-and-forget:

```typescript
(trackPromptBuilderOpen,
  trackPromptSubmit,
  trackSocialClick,
  trackVote,
  trackLabSelect,
  trackLabGenerate,
  trackLabCopy,
  trackLabOptimise,
  trackPromptSave,
  trackPromptReformat);
```

Session ID stored in `sessionStorage` (persists across page loads, not across browser sessions). `sendTrackEvent()` exported separately for lightweight components that don't mount the full hook (used by `save-icon.tsx` and `reformat-preview.tsx`).

---

## API Endpoints

| Endpoint                    | Method | Purpose                         | Auth                            |
| --------------------------- | ------ | ------------------------------- | ------------------------------- |
| `/api/events/track`         | POST   | Track engagement events         | None (rate limited per session) |
| `/api/index-rating/ratings` | POST   | Batch fetch ratings for display | None (public, max 100 IDs)      |
| `/api/index-rating/cron`    | GET    | Daily rating calculation        | `PROMAGEN_CRON_SECRET`          |
| `/api/index-rating/debug`   | GET    | System health check             | `PROMAGEN_CRON_SECRET`          |

---

## Database Schema

### Table: `provider_ratings`

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

### Table: `index_rating_cron_runs`

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

### Table: `provider_activity_events` (shared with Promagen Users)

```sql
CREATE TABLE IF NOT EXISTS provider_activity_events (
  click_id      TEXT        NOT NULL PRIMARY KEY,
  provider_id   TEXT        NOT NULL,
  event_type    TEXT        NOT NULL DEFAULT 'open',
  src           TEXT,
  user_id       TEXT,
  country_code  TEXT,
  ip            TEXT,
  user_agent    TEXT,
  is_affiliate  BOOLEAN     DEFAULT FALSE,
  destination   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Environment Variables

| Variable                        | Required  | Default   | Description                                   |
| ------------------------------- | --------- | --------- | --------------------------------------------- |
| `DATABASE_URL` / `POSTGRES_URL` | Yes (one) | —         | Postgres connection string                    |
| `PROMAGEN_CRON_SECRET`          | Yes       | —         | Min 16 chars, protects cron + debug endpoints |
| `NEXT_PUBLIC_DEMO_JITTER`       | No        | `'false'` | `'true'` enables demo jitter in leaderboard   |
| `INDEX_RATING_BASELINE`         | No        | 1500      | Elo baseline (override via env)               |
| `INDEX_RATING_DECAY_LAMBDA`     | No        | 0.02      | Time decay rate                               |
| `INDEX_RATING_STALE_HOURS`      | No        | 48        | Staleness threshold                           |

---

## File Map

| File                                             | Purpose                                              |
| ------------------------------------------------ | ---------------------------------------------------- |
| `src/types/index-rating.ts`                      | Constants, EVENT_CONFIG, all TypeScript types        |
| `src/lib/index-rating/calculations.ts`           | MPI, Elo, decay, seeding, bonus calculations         |
| `src/lib/index-rating/database.ts`               | Postgres queries (ratings, events, cron logs)        |
| `src/lib/index-rating/index.ts`                  | Barrel exports                                       |
| `src/app/api/index-rating/cron/route.ts`         | Daily cron handler                                   |
| `src/app/api/index-rating/ratings/route.ts`      | Public batch ratings fetch                           |
| `src/app/api/index-rating/debug/route.ts`        | Protected health check                               |
| `src/app/api/events/track/route.ts`              | Event tracking endpoint (12 types)                   |
| `src/hooks/use-index-rating-events.ts`           | Client hook (10 tracking functions + sendTrackEvent) |
| `src/components/providers/index-rating-cell.tsx` | Display cell + ticker animation + badges             |
| `src/components/prompt-lab/leaderboard-rail.tsx` | Prompt Lab left rail with demo jitter                |
| `src/styles/index-rating.css`                    | Rank-up glow animation, colour classes, mobile       |
| `src/data/providers/market-power.json`           | MPI data for 37 providers                            |

---

## Changelog

- **6 Apr 2026 (v2.0.0):** Complete rewrite from src.zip SSoT. Added: 12 event types (was 5), EVENT_CONFIG with basePoints/kFactor from actual code, all constants from `types/index-rating.ts`, +200 display inflation, demo jitter system (±1-3/45s, NEXT_PUBLIC_DEMO_JITTER), LeaderboardRail integration, rating ticker animation (600ms), rank-climber flash, server-prefetched initialRatings, hydration safety patterns. Documented: cron SQL filter gap (6/12 events consumed). Updated: MPI formula from actual `calculations.ts`, seeding formula, all database schemas, API endpoints, file map. Removed: speculative sections not matching deployed code.
- **27 Jan 2026 (v1.0.0):** Initial specification.

---

_This document is the authority for the Index Rating system. `src.zip` is the Single Source of Truth — every constant, formula, and file path verified by code inspection._
