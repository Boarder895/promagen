# Index Rating System

**Last updated:** 9 April 2026  
**Owner:** Promagen  
**Status:** Authority Document  
**Version:** 2.0.0

---

## Purpose

This document defines Promagen's **Index Rating** system — a dynamic, Elo-style competitive ranking for 40 AI image generation providers. The system replaces the previous static 0–100 score with a live, engagement-driven rating that moves like a stock exchange index.

The Index Rating ensures fair competition between established giants and newcomers through a handicapping system that normalises engagement by provider market power.

---

## Design Philosophy

1. **Fair competition** — Smaller platforms climb faster; giants work harder for each point
2. **No coasting** — Past engagement decays; providers must stay relevant
3. **Positive reinforcement** — Celebrate climbers, don't shame fallers
4. **Stock exchange aesthetic** — Numbers, arrows, percentages match the market ribbon
5. **Transparency** — Users understand smaller tools can outrank giants through engagement

---

## Architecture

### Deployment Model

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Git Repo      │     │     Vercel      │     │  Neon Postgres  │
│                 │────▶│   (Stateless)   │────▶│  (Persistent)   │
│ providers.json  │     │  Next.js App    │     │ Tables:         │
│ (40 providers)  │     │  API Routes     │     │ - provider_     │
│ market-power.   │     │  Cron Jobs      │     │   activity_     │
│ json (handicap) │     │                 │     │   events        │
│                 │     │                 │     │ - provider_     │
│                 │     │                 │     │   ratings       │
│                 │     │                 │     │ - index_rating_ │
│                 │     │                 │     │   cron_runs     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### What Lives Where

| Data | Location | Reason |
|------|----------|--------|
| Provider static info (name, website, tagline, icon) | `providers.json` (repo) | Rarely changes, version controlled |
| Provider capabilities (API, affiliate, prefill flags) | `providers.json` (repo) | Rarely changes, version controlled |
| Market Power data | `market-power.json` (repo) | Researched data, version controlled |
| Raw engagement events | `provider_activity_events` (DB) | Accumulates, survives deploys |
| Aggregated ratings | `provider_ratings` (DB) | Changes daily, survives deploys |
| Cron run logs | `index_rating_cron_runs` (DB) | Observability, survives deploys |

### Deploy Safety

On every Vercel deploy: new code deployed, database untouched, ratings persist, events persist, nothing lost.

### Shared Infrastructure

| Component | Shared? | Notes |
|-----------|---------|-------|
| Neon Postgres instance | ✅ Yes | Same database, separate tables |
| `provider_activity_events` table | ✅ Yes | Shared with Promagen Users cron |
| `PROMAGEN_CRON_SECRET` | ✅ Yes | Same secret protects all crons |
| Vercel Cron | ✅ Yes | 4 crons total |

---

## Event Types (12 Total)

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

### ⚠️ SQL Filter Gap

The Index Rating cron only queries **6 of 12** event types:

```sql
AND event_type IN ('vote', 'open', 'click', 'prompt_builder_open', 'prompt_submit', 'social_click')
```

The 6 Prompt Lab events are tracked and stored but **not consumed by the cron**. Files affected: `src/lib/index-rating/database.ts` — two SQL queries with hardcoded `IN (...)` clauses. The Promagen Users cron counts ALL events (no filter).

---

## Elo Calculation

### Effective Points

`effectivePoints = basePoints × staticBonus × timeDecay × newcomerBoost`

### Static Bonuses (from `src/types/index-rating.ts`)

| Factor | Multiplier |
|---|---|
| API available | ×1.10 |
| Affiliate programme | ×1.05 |
| Supports prefill | ×1.05 |

### Newcomer Boost

Providers founded <3 months ago get ×1.20, tapering to ×1.0 over 6 months.

### Elo Gain

`gain = handicappedPoints × kFactor × (actual - expected)`

MPI (Market Power Index) handicaps high-power providers so newcomers gain more from the same engagement.

### Daily Regression

0.2% regression toward baseline (1500) per day. Providers with zero engagement slowly drift toward baseline.

### Rating Floor

Minimum rating of 100. Log anomaly if a provider approaches this.

---

## Display Layer

### Display Inflation

The raw Elo rating is NOT shown directly to users. A `DISPLAY_INFLATION_OFFSET` of **+200** is added in the frontend (`src/types/index-rating.ts`). A raw rating of 1500 displays as **1700**.

### Demo Jitter

When `NEXT_PUBLIC_DEMO_JITTER=true`, cosmetic ±1–3 point jitter is applied client-side every 45 seconds. This is purely visual — no database changes. Sort-stable: jitter is applied after sorting so row order doesn't change.

### Visual Format

```
1,847        ← Inflated rating (raw 1647)
▲ +23        ← Change from yesterday
(+1.26%)     ← Change percentage
```

| Element | Colour |
|---------|--------|
| Gain (positive change) | Green `#22c55e` |
| Loss (negative change) | Red `#ef4444` |
| Flat (< ±0.1%) | No arrow shown |
| Rank climber | Green ▲ with glow animation |

### UI Surfaces

| Surface | File | Data Source |
|---------|------|-------------|
| AI Providers Leaderboard | `src/components/providers/providers-table.tsx` | `getProvidersWithPromagenUsers()` |
| Prompt Lab left rail | `src/components/prompt-lab/leaderboard-rail.tsx` | Props from parent page |

---

## Market Power Data

**Location:** `src/data/providers/market-power.json`

Researched social reach, estimated users, and founding year for each provider. Used to calculate MPI handicapping.

```json
{
  "$schema": "./market-power.schema.json",
  "lastResearched": "2026-01-27",
  "providers": {
    "midjourney": {
      "foundingYear": 2022,
      "socialReach": { "youtube": 0, "x": 2500000, "instagram": 1200000, "facebook": 500000, "discord": 19000000 },
      "estimatedUsers": 15000000,
      "notes": "Discord-first platform, massive community"
    }
  }
}
```

---

## Auto-Seeding New Providers

When a new provider is added to `providers.json`:

1. Add to `providers.json` (static fields)
2. Add to `market-power.json` (or use defaults)
3. Deploy to Vercel
4. Daily cron detects missing provider in `provider_ratings`
5. Auto-seed creates initial rating (incumbents with MPI >5.0 get higher seed)

---

## Cron Details

The Index Rating cron runs daily at 00:05 UTC. Full documentation in `docs/authority/cron_jobs.md` §2.

---

## Database Schema

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

**Table: `index_rating_cron_runs`** — See `cron_jobs.md` §2.5.

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Provider with zero engagement | Receives only daily decay; slowly drifts toward baseline |
| Brand new provider (day 1) | Seeded rating, shows ● 0 (0.00%), no rank arrow |
| Provider removed from catalogue | Rating preserved in DB but not displayed |
| Negative rating | Floor at 100; log anomaly |
| Rating exceeds 3000 | Allowed; no ceiling |
| Stale Market Power data (> 90 days) | Log warning; use last known values |
| Missing social data | Default SocialFactor to 1.0 |
| Database unavailable | Fall back to `providers.json` score × 20 |

---

## Testing

### Unit Tests

- [x] Elo calculation produces expected output for known inputs
- [x] MPI calculation handles missing social data
- [x] Time decay formula correct at 0, 30, 90 days
- [x] Static bonuses multiply correctly
- [x] Newcomer boost applies based on provider age
- [x] Flat threshold triggers at ±0.1%
- [x] Rank change detection works for climbs
- [x] Rank change detection ignores falls (only shows ▲, never ▼)
- [x] Fallback to JSON score works when DB unavailable

### Integration Tests

- [x] Daily cron updates all provider ratings (40 providers seeded)
- [x] Seeding formula produces expected initial ratings
- [x] UI displays correct colors for gain/loss/flat
- [x] Event tracking: `prompt_builder_open` (ProviderPageTracker)
- [x] Event tracking: `prompt_submit` (copy-open-button.tsx)
- [x] Event tracking: `social_click` (support-icons-cell.tsx)
- [x] Event tracking: Prompt Lab events (prompt_lab_select, prompt_lab_generate, prompt_lab_copy)
- [x] Display inflation +200 applied correctly
- [ ] Cron is idempotent (same result on re-run)
- [ ] Events older than 180 days contribute negligibly

---

## UI Tooltip Content

### Index Rating Header Tooltip

> "Rankings use fair competition scoring. Engagement with smaller platforms counts more, giving newcomers a fighting chance against established giants. See raw popularity in the Promagen Users column."

### 🌱 Badge Tooltip

> "Rising platform — scores adjusted for fair competition"

### ⬆ Arrow Tooltip

> "Climbed in rankings in the last 24 hours"

---

## Sorting Behaviour

**Default Sort:** Index Rating DESC (highest first)  
**Tiebreaker:** `providerId` alphabetically  
**User Sorting:** Click column header to toggle DESC → ASC → default

---

## Glossary

| Term | Definition |
|------|-----------|
| **Index Rating** | Dynamic Elo-style score for providers |
| **MPI** | Market Power Index — handicap based on size/age |
| **K-Factor** | Elo volatility constant; how much a single event moves rating |
| **Time Decay** | Exponential reduction of event value over time |
| **Newcomer Boost** | Temporary K-Factor multiplier for providers < 6 months old |
| **Baseline** | 1500 — the neutral Elo starting point |
| **Display Inflation** | +200 offset applied in frontend (raw 1500 shows as 1700) |
| **Demo Jitter** | ±1–3 cosmetic points every 45s (client-side, `NEXT_PUBLIC_DEMO_JITTER`) |

---

## Related Documents

| Document | Scope |
|----------|-------|
| `cron_jobs.md` | Cron job details, schedule, auth, SQL gap |
| `ai_providers_affiliate.md` | Provider catalogue, event tracking, `/go/` routing |
| `ribbon-homepage.md` | Leaderboard table structure |
| `paid_tier.md` | Paid feature boundaries |

---

## Changelog

| Date | Change |
|------|--------|
| 9 Apr 2026 | v2.0.0: Updated provider count to 40. Added 12 event types (was 6). Documented SQL filter gap. Added display inflation (+200). Added demo jitter. Removed mobile section (desktop-only). Updated testing checkboxes. Consolidated cron details to reference `cron_jobs.md`. |
| 27 Jan 2026 | v1.0.0: Initial document. Transition strategy, Market Power JSON, auto-seeding, event tracking. |

---

_This document is the authority for the Index Rating system. `src.zip` is the Single Source of Truth — if code and doc conflict, code wins._
