# Index Rating System

**Last updated:** 27 January 2026  
**Owner:** Promagen  
**Status:** Authority Document  
**Existing features preserved:** Yes

---

## Purpose

This document defines Promagen's **Index Rating** system — a dynamic, Elo-style competitive ranking for AI image generation providers. The system replaces the previous static 0–100 score with a live, engagement-driven rating that moves like a stock exchange index.

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

Promagen uses a **stateless frontend + persistent database** architecture. This is critical for the Index Rating system.

```
┌─────────────────────────────────────────────────────────────────┐
│                      DEPLOYMENT MODEL                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Git Repo      │     │     Vercel      │     │  Neon Postgres  │
│                 │────▶│   (Stateless)   │────▶│  (Persistent)   │
│                 │     │                 │     │                 │
│ providers.json  │     │  Next.js App    │     │ Tables:         │
│ (static data)   │     │  API Routes     │     │ - provider_     │
│                 │     │  Cron Jobs      │     │   activity_     │
│ market-power.   │     │                 │     │   events        │
│ json (handicap) │     │                 │     │ - provider_     │
│                 │     │                 │     │   ratings       │
│ index-rating.md │     │                 │     │ - index_rating_ │
│ (docs only)     │     │                 │     │   cron_runs     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │   Deploy pushes      │   Reads/writes        │
        │   new code only      │   to database         │
        └───────────────────────┴───────────────────────┘
                                        │
                              Database survives deploys
```

### What Lives Where

| Data                                                  | Location                        | Reason                                 |
| ----------------------------------------------------- | ------------------------------- | -------------------------------------- |
| Provider static info (name, website, tagline, icon)   | `providers.json` (repo)         | Rarely changes, version controlled     |
| Provider capabilities (API, affiliate, prefill flags) | `providers.json` (repo)         | Rarely changes, version controlled     |
| Provider socials (X, Discord, etc.)                   | `providers.json` (repo)         | Rarely changes, version controlled     |
| **Fallback score/trend**                              | `providers.json` (repo)         | Graceful fallback until DB has ratings |
| **Market Power data**                                 | `market-power.json` (repo)      | Researched data, version controlled    |
| Raw engagement events                                 | `provider_activity_events` (DB) | Accumulates forever, survives deploys  |
| Aggregated ratings                                    | `provider_ratings` (DB)         | Changes daily, survives deploys        |
| Cron run logs                                         | `index_rating_cron_runs` (DB)   | Observability, survives deploys        |

### Transition Strategy (Fallback)

During the transition from static scores to Index Rating:

1. **`score` and `trend` remain in `providers.json`** as fallback values
2. **UI reads Index Rating from database first**
3. **If database unavailable or no rating exists** → fall back to `providers.json` values
4. **Once Index Rating is stable** → `score`/`trend` in JSON become legacy (never removed, just unused)

```typescript
// Pseudocode for rating resolution
function getDisplayRating(provider: Provider, dbRating: IndexRating | null) {
  if (dbRating && !isStale(dbRating.calculatedAt)) {
    return {
      rating: dbRating.currentRating,
      change: dbRating.change,
      changePercent: dbRating.changePercent,
      source: 'database',
    };
  }

  // Fallback to static JSON values
  return {
    rating: provider.score ? provider.score * 20 : null, // Scale 0-100 to ~0-2000
    change: null,
    changePercent: null,
    source: 'fallback',
  };
}
```

### Deploy Safety

**On every Vercel deploy:**

- ✅ New code deployed
- ✅ Database untouched
- ✅ Ratings persist
- ✅ Events persist
- ✅ Nothing lost

### Shared Infrastructure with Promagen Users

The Index Rating system shares the existing database and event tracking infrastructure:

| Component                        | Shared? | Notes                          |
| -------------------------------- | ------- | ------------------------------ |
| Neon Postgres instance           | ✅ Yes  | Same database, new tables      |
| `provider_activity_events` table | ✅ Yes  | Reused — add new event types   |
| `PROMAGEN_CRON_SECRET`           | ✅ Yes  | Same secret protects all crons |
| Vercel Cron                      | ✅ Yes  | Add new cron schedule          |
| `/go/[providerId]` route         | ✅ Yes  | Already logs events            |

**New tables required:**

- `provider_ratings`
- `index_rating_cron_runs`

**New JSON file required:**

- `src/data/providers/market-power.json`

### Auto-Seeding New Providers

When a new provider is added to `providers.json`, the system auto-detects and seeds it.

#### Process

1. **Add to `providers.json`** — Include all static fields (name, website, etc.)
2. **Add to `market-power.json`** — Include Market Power data (or use defaults)
3. **Deploy to Vercel** — Normal deploy process
4. **Daily cron runs** — Detects missing provider in `provider_ratings`
5. **Auto-seed triggered** — Creates initial rating using seeding formula

#### Auto-Seed Logic (in cron job)

```typescript
// Pseudocode — runs during daily rating calculation
async function ensureAllProviderSeeded(providersFromJson: Provider[]) {
  for (const provider of providersFromJson) {
    const existing = await db.provider_ratings.findById(provider.id);

    if (!existing) {
      // New provider detected — seed it
      const seededRating = calculateSeed(provider);

      await db.provider_ratings.create({
        providerId: provider.id,
        currentRating: seededRating,
        previousRating: seededRating,
        change: 0,
        changePercent: 0,
        currentRank: null, // Set after full ranking pass
        previousRank: null,
        rankChangedAt: null,
        calculatedAt: new Date(),
      });

      console.log(`[Index Rating] Auto-seeded new provider: ${provider.id} at ${seededRating}`);
    }
  }
}
```

### Market Power Data (JSON-Based)

Market Power data is stored in a **JSON file** for easy maintenance and version control. Data is researched and populated by Promagen team.

**Location:** `src/data/providers/market-power.json`

**Structure:**

```json
{
  "$schema": "./market-power.schema.json",
  "lastResearched": "2026-01-27",
  "providers": {
    "midjourney": {
      "foundingYear": 2022,
      "socialReach": {
        "youtube": 0,
        "x": 2500000,
        "instagram": 1200000,
        "facebook": 500000,
        "discord": 19000000
      },
      "estimatedUsers": 15000000,
      "notes": "Discord-first platform, massive community"
    },
    "leonardo": {
      "foundingYear": 2022,
      "socialReach": {
        "youtube": 150000,
        "x": 500000,
        "instagram": 300000,
        "facebook": 200000,
        "discord": 800000
      },
      "estimatedUsers": 2000000,
      "notes": "Strong API offering, rapid growth"
    }
  }
}
```

**Cron reads from JSON:**

```typescript
import marketPowerData from '@/data/providers/market-power.json';

function getMarketPowerIndex(providerId: string): number {
  const data = marketPowerData.providers[providerId];

  if (!data) {
    // Default MPI for unknown providers
    return 3.0;
  }

  return calculateMPI(data);
}
```

**Updating Market Power data:**

1. Edit `market-power.json` in VS Code
2. Commit and deploy
3. Next cron run uses updated values

**If Market Power data is missing for a provider**, the cron uses a **default MPI of 3.0** (mid-range handicap).

### Event Type Expansion

The existing `provider_activity_events.event_type` column supports multiple event types. For Index Rating, the following events are tracked:

| Event Type            | Status     | Trigger Location                     | Component/File                    |
| --------------------- | ---------- | ------------------------------------ | --------------------------------- |
| `open`                | ✅ Tracked | Click provider link → website        | `/go/[providerId]/route.ts`       |
| `click`               | ✅ Tracked | Legacy alias for `open`              | `/go/[providerId]/route.ts`       |
| `vote`                | ✅ Tracked | Image quality vote (thumbs up)       | `/api/providers/vote/route.ts`    |
| `prompt_builder_open` | ✅ Tracked | Page load on `/providers/[id]`       | `src/app/providers/[id]/page.tsx` |
| `prompt_submit`       | ✅ Tracked | Copy button click in prompt builder  | `copy-open-button.tsx`            |
| `social_click`        | ✅ Tracked | Click any icon in Support column     | `support-icons-cell.tsx`          |
| `provider_select`     | 🔶 Future  | Paid user selects provider in filter | Paid feature — skip for now       |

**Event Tracking Implementation:**

All new event tracking calls the `/api/events/track` endpoint or uses the existing event logging pattern:

```typescript
// Example: Track prompt_builder_open on page load
async function trackPromptBuilderOpen(providerId: string, sessionId: string) {
  await fetch('/api/events/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      providerId,
      eventType: 'prompt_builder_open',
      src: 'provider_detail_page',
      sessionId,
    }),
  });
}

// Example: Track social_click
async function trackSocialClick(providerId: string, platform: string, sessionId: string) {
  await fetch('/api/events/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      providerId,
      eventType: 'social_click',
      src: `support_column_${platform}`,
      sessionId,
    }),
  });
}

// Example: Track prompt_submit (copy button)
async function trackPromptSubmit(providerId: string, sessionId: string) {
  await fetch('/api/events/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      providerId,
      eventType: 'prompt_submit',
      src: 'prompt_builder_copy',
      sessionId,
    }),
  });
}
```

### Cron Schedule

| Cron Job       | Schedule       | Purpose                           |
| -------------- | -------------- | --------------------------------- |
| Promagen Users | `*/30 * * * *` | Aggregate country usage           |
| Rankings       | `0 * * * *`    | Recalculate image quality ranks   |
| Index Rating   | `5 0 * * *`    | Calculate ratings, ranks, changes |

**Why 00:05 not 00:00?** Gives 5 minutes buffer after midnight for any timezone edge cases.

**Vercel Cron Config (frontend/vercel.json):**

```json
{
  "crons": [
    {
      "path": "/api/promagen-users/cron",
      "schedule": "*/30 * * * *"
    },
    {
      "path": "/api/cron/rankings",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/index-rating/cron",
      "schedule": "5 0 * * *"
    }
  ]
}
```

### Graceful Degradation

If the database is unavailable or data is stale, the UI degrades gracefully:

| Scenario                     | Behaviour                                        |
| ---------------------------- | ------------------------------------------------ |
| Database unreachable         | Fall back to `providers.json` score, log error   |
| Rating data stale (>48h)     | Fall back to `providers.json` score, log warning |
| Market Power data missing    | Use default MPI of 3.0                           |
| New provider, not yet seeded | Fall back to `providers.json` score              |

**Never show:** Fake/synthetic ratings, error messages to users.

**Fallback indicator:** When showing fallback data, the UI may optionally show a subtle indicator (e.g., no change percentage) to signal data is from static source.

### Environment Variables

| Variable                    | Required | Default | Description                      |
| --------------------------- | -------- | ------- | -------------------------------- |
| `DATABASE_URL`              | Yes\*    | —       | Postgres connection string       |
| `POSTGRES_URL`              | Yes\*    | —       | Neon/Vercel sets this (fallback) |
| `PROMAGEN_CRON_SECRET`      | Yes      | —       | Protects cron endpoints          |
| `INDEX_RATING_BASELINE`     | No       | `1500`  | Elo baseline for regression      |
| `INDEX_RATING_DECAY_LAMBDA` | No       | `0.02`  | Time decay rate                  |
| `INDEX_RATING_STALE_HOURS`  | No       | `48`    | Staleness threshold              |

\*At least one of `DATABASE_URL` or `POSTGRES_URL` must be set.

---

## Display Format

### Column Header

```
Index Rating
```

### Cell Format (Two-Line)

```
1,847
▲ +23 (+1.26%)
```

**Line 1:** Current rating (whole number, comma-separated thousands)  
**Line 2:** Direction indicator + absolute change + percentage change

### Fallback Format (When Using JSON Data)

```
1,900
● — (—)
```

**Line 1:** Scaled score from `providers.json` (score × 20)  
**Line 2:** Flat indicator, no change data available

### Color Scheme

| State    | Symbol | Color | Hex       | Applies To                       |
| -------- | ------ | ----- | --------- | -------------------------------- |
| Gain     | ▲      | Green | `#22c55e` | Symbol, change value, percentage |
| Loss     | ▼      | Red   | `#ef4444` | Symbol, change value, percentage |
| Flat     | ●      | Gray  | `#6b7280` | Symbol, change value, percentage |
| Fallback | ●      | Gray  | `#6b7280` | Symbol only (no change data)     |

**Line 1 (rating number):** Always neutral/white — only Line 2 takes color.

### Flat Threshold

Movement within **±0.1%** displays as flat (●) to prevent noise.

```typescript
// Pseudocode
if (Math.abs(percentChange) < 0.1) {
  state = 'flat';
}
```

### Examples

**Gaining:**

```
1,847
▲ +23 (+1.26%)
```

**Losing:**

```
1,695
▼ -18 (-1.05%)
```

**Flat:**

```
1,720
● 0 (0.00%)
```

**Fallback (no DB data):**

```
1,900
● — (—)
```

---

## Calculation Cycle

| Aspect            | Value                                                      |
| ----------------- | ---------------------------------------------------------- |
| Frequency         | Once daily                                                 |
| Time              | 00:05 UTC                                                  |
| Comparison period | Today vs yesterday's close                                 |
| First day         | All providers show ● 0 (0.00%) — no "yesterday" to compare |

The system mimics a stock market "daily close" — ratings update overnight, users see movement when they wake up.

---

## Engagement Events

User actions on Promagen that contribute to a provider's Index Rating.

### Event Taxonomy

| Event Type            | Base Points | K-Factor | Description                                           | Status     |
| --------------------- | ----------- | -------- | ----------------------------------------------------- | ---------- |
| `vote`                | 5           | 32       | User votes for image quality (thumbs up)              | ✅ Tracked |
| `prompt_submit`       | 5           | 24       | User clicks Copy in prompt builder                    | ✅ Tracked |
| `prompt_builder_open` | 3           | 16       | User opens provider's detail page                     | ✅ Tracked |
| `open`                | 2           | 16       | User clicks provider name/icon → website (via `/go/`) | ✅ Tracked |
| `social_click`        | 1           | 8        | User clicks provider's social media icon              | ✅ Tracked |
| `provider_select`     | 2           | 12       | Paid user selects provider in filter/comparison       | 🔶 Future  |
| `api_generation`      | 10          | 40       | User generates image via Promagen API integration     | ❌ Future  |
| `image_upload`        | 4           | 20       | User uploads image tagged to provider (Gallery)       | ❌ Future  |
| `image_like`          | 2           | 12       | User likes an image from provider (Gallery)           | ❌ Future  |

**K-Factor** determines how much the event moves the Elo rating. Higher K = bigger impact.

### Event Weighting Rationale

- **Votes matter most** — Direct quality signal from user judgment
- **Submissions beat browsing** — Actually using the prompt builder > just opening it
- **API generation is king** — Real integration, highest intent (future feature)
- **Social clicks are light** — Curiosity signal, not commitment

---

## Static Bonuses

Provider attributes that multiply engagement scores. These reward platforms that invest in ecosystem integration.

| Attribute           | Multiplier   | JSON Field                 | Rationale                          |
| ------------------- | ------------ | -------------------------- | ---------------------------------- |
| API Available       | ×1.10 (+10%) | `apiAvailable: true`       | Enables automation and integration |
| Affiliate Programme | ×1.05 (+5%)  | `affiliateProgramme: true` | Supports Promagen ecosystem        |
| Prefill Supported   | ×1.05 (+5%)  | `supportsPrefill: true`    | Deep Promagen integration          |

### Bonus Stacking

Bonuses multiply together:

```
TotalBonus = 1.0
if (apiAvailable) TotalBonus *= 1.10
if (affiliateProgramme) TotalBonus *= 1.05
if (supportsPrefill) TotalBonus *= 1.05
```

**Example — Leonardo AI (all three):**

```
1.0 × 1.10 × 1.05 × 1.05 = 1.213 (21.3% bonus)
```

---

## Market Power Index (Handicap)

The core fairness mechanism. Larger, established providers have a higher Market Power Index (MPI), which **divides** their effective points — making each engagement worth less.

### Formula

```
MarketPowerIndex = 1 + SocialFactor + YearsFactor + UsersFactor
```

Where:

```
SocialFactor = log₁₀(1 + avgSocialFollowers / 1000)
YearsFactor = yearsActive × 0.1
UsersFactor = log₁₀(1 + estimatedUsers / 100000)
```

### Social Reach Calculation

Average of available social platform followers:

```
avgSocialFollowers = average(
  youtube_subscribers,
  x_followers,
  instagram_followers,
  facebook_followers
)
```

Only include platforms where data exists. Discord members count toward social reach.

### Years Active

```
yearsActive = currentYear - foundingYear
```

### Example Calculations

| Provider    | Avg Social | Years | Est. Users | MPI                              |
| ----------- | ---------- | ----- | ---------- | -------------------------------- |
| Midjourney  | 15,000,000 | 4     | 15,000,000 | 1 + 4.18 + 0.4 + 2.18 = **7.76** |
| Leonardo AI | 800,000    | 2     | 2,000,000  | 1 + 2.90 + 0.2 + 1.30 = **5.40** |
| Artisly     | 50,000     | 1     | 10,000     | 1 + 1.70 + 0.1 + 0.04 = **2.84** |

### Effect on Scoring

Points are divided by MPI:

```
EffectivePoints = RawPoints / MarketPowerIndex
```

**Same engagement, different value:**

| Provider    | Vote (5 pts) | MPI  | Effective Points |
| ----------- | ------------ | ---- | ---------------- |
| Midjourney  | 5            | 7.76 | 0.64             |
| Leonardo AI | 5            | 5.40 | 0.93             |
| Artisly     | 5            | 2.84 | 1.76             |

A vote for Artisly is worth **2.75×** a vote for Midjourney.

---

## Newcomer Boost

Providers less than 6 months old receive a temporary K-Factor multiplier that tapers over time.

| Provider Age | K-Factor Multiplier |
| ------------ | ------------------- |
| 0–3 months   | 1.20× (full boost)  |
| 3–6 months   | 1.10× (tapering)    |
| 6+ months    | 1.00× (normal)      |

### Calculation

```typescript
if (monthsOld < 3) {
  newcomerMultiplier = 1.2;
} else if (monthsOld < 6) {
  newcomerMultiplier = 1.1;
} else {
  newcomerMultiplier = 1.0;
}
```

### Stacking

Newcomer Boost stacks with Market Power handicap:

```
A new, small provider gets:
- Low MPI (points worth more)
- Newcomer Boost (K-Factor higher)
= Maximum climbing potential
```

---

## Time Decay

Engagement events decay exponentially. Recent activity matters more than historical engagement.

### Decay Formula

```
decayMultiplier = e^(-λ × daysOld)
```

Where **λ = 0.02** (half-life ≈ 35 days)

### Decay Table

| Event Age      | Decay Multiplier | Effective Value |
| -------------- | ---------------- | --------------- |
| 0 days (today) | 1.00             | 100%            |
| 7 days         | 0.87             | 87%             |
| 14 days        | 0.76             | 76%             |
| 30 days        | 0.55             | 55%             |
| 60 days        | 0.30             | 30%             |
| 90 days        | 0.17             | 17%             |
| 120 days       | 0.09             | 9%              |
| 180 days       | 0.03             | 3%              |

### Anti-Coasting Principle

Providers cannot rely on a viral moment from months ago. Sustained engagement is required to maintain rating.

---

## Full Scoring Formula

### Per-Event Elo Gain

```
EffectivePoints = BasePoints × StaticBonuses × TimeDecay × NewcomerBoost

EloGain = (EffectivePoints / MarketPowerIndex) × K-Factor × (Actual - Expected)
```

Where:

- **Actual** = 1 (engagement received)
- **Expected** = 1 / (1 + 10^((AvgRating - CurrentRating) / 400))

### Daily Rating Update

```
NewRating = OldRating + Σ(EloGain for all events in 24h)
```

### Daily Decay (Regression to Mean)

To prevent stagnation and ensure inactive providers slowly fall:

```
NewRating = (NewRating × 0.998) + (Baseline × 0.002)
```

Where **Baseline = 1500**

This pulls all ratings 0.2% per day toward baseline. Active providers easily overcome this; inactive providers slowly drift down.

---

## Initial Seeding

When transitioning from static scores to Index Rating, providers are seeded based on existing data.

### Seeding Formula

```
EloSeed = 1000
        + (currentScore × 8)
        + (apiAvailable ? 50 : 0)
        + (affiliateProgramme ? 25 : 0)
        - (incumbentAdjustment ? 30 : 0)
```

### Seeding Examples

| Provider      | Score | API | Affiliate | Incumbent | Seeded Elo |
| ------------- | ----- | --- | --------- | --------- | ---------- |
| Midjourney    | 95    | ❌  | ❌        | ❌        | 1,760      |
| OpenAI DALL·E | 92    | ✅  | ❌        | ❌        | 1,786      |
| Leonardo AI   | 88    | ✅  | ✅        | ❌        | 1,779      |
| Flux          | 90    | ✅  | ❌        | ❌        | 1,770      |
| Google Imagen | 87    | ✅  | ❌        | ✅        | 1,716      |
| Artisly       | 68    | ✅  | ✅        | ❌        | 1,619      |

### Transition Approach

- **Quiet transition** — No announcement, seeded values preserve approximate hierarchy
- **Let real scores speak** — Within 2–4 weeks, engagement will reshape the leaderboard
- **Day 1 display** — All providers show ● 0 (0.00%) as there's no previous day to compare

---

## Rank Change Indicator

When a provider climbs in rank position, a glowing green arrow appears in the Provider column.

### Trigger

Provider's **rank position** improves (e.g., #7 → #5).

Note: This is position change, not rating change. A provider can gain rating points but stay at the same rank.

### Display Location

Provider column, Line 1, immediately after API/Affiliate emojis:

```
2. Leonardo AI [icon] 🔌 🤝 ⬆
   🇦🇺 Sydney
   14:32 🎨 Prompt builder
```

### Visual Specification

| Property  | Value                                             |
| --------- | ------------------------------------------------- |
| Symbol    | ⬆ (U+2B06)                                        |
| Color     | Bright green `#22c55e`                            |
| Glow      | `0 0 8px #22c55e, 0 0 16px #22c55e`               |
| Animation | Subtle pulse (opacity 0.85 → 1.0), 2-second cycle |
| Duration  | 24 hours from moment of rank change               |

### CSS Animation

```css
@keyframes rank-up-glow {
  0%,
  100% {
    opacity: 0.85;
    filter: drop-shadow(0 0 6px #22c55e);
  }
  50% {
    opacity: 1;
    filter: drop-shadow(0 0 12px #22c55e);
  }
}

.rank-up-arrow {
  color: #22c55e;
  animation: rank-up-glow 2s ease-in-out infinite;
}
```

### Behaviour Rules

| Scenario                   | Behaviour                                           |
| -------------------------- | --------------------------------------------------- |
| Jumps multiple positions   | Single ⬆, not multiple arrows                       |
| Climbs twice within 24h    | Timer resets, glow continues                        |
| Climbs then falls same day | Glow remains until 24h from last climb              |
| Falls in rank              | No indicator (no down arrows)                       |
| New provider added         | No arrow (no previous rank to compare)              |
| Tied rank                  | Use secondary sort by rating; position still counts |

### Why No Down Arrow

- **Positive reinforcement** — Celebrate climbers, don't shame fallers
- **No pile-on effect** — Struggling providers aren't visually punished
- **Cleaner UI** — One indicator type, simpler to scan
- **Matches philosophy** — Users see "who's hot", not "who's failing"

### Implementation Status

| Component              | File                               | Status                            |
| ---------------------- | ---------------------------------- | --------------------------------- |
| RankUpArrow            | `index-rating-cell.tsx` line 104   | ✅ Implemented                    |
| hasRankUp calculation  | `providers-table.tsx` line 112-114 | ✅ Implemented                    |
| RankUpArrow rendering  | `provider-cell.tsx` line 158       | ✅ Implemented                    |
| rank-up-arrow CSS      | `globals.css` line 2007+           | ✅ Implemented                    |
| isUnderdog calculation | `providers-table.tsx` line 79-91   | ✅ Implemented                    |
| isNewcomer calculation | `providers-table.tsx` line 96-108  | ✅ Implemented                    |
| UnderdogBadge          | `index-rating-cell.tsx` line 111   | ✅ Component exists, not rendered |
| NewcomerBadge          | `index-rating-cell.tsx` line 118   | ✅ Component exists, not rendered |

## **Note:** Underdog/Newcomer badges exist as components but are not yet rendered in the UI. The `isUnderdog` and `isNewcomer` values are calculated and available in `DisplayRating`.

## Underdog/Newcomer Badges

Visual indicators showing which providers benefit from handicapping.

### 🌱 Underdog Badge

**Criteria:** MarketPowerIndex < 3.0 OR provider age < 12 months

**Display:** In Provider column after name, before emojis

```
4. Artisly [icon] 🌱 🤝 ⬆
```

**Tooltip:** "Rising platform — scores adjusted for fair competition"

### 🆕 Newcomer Badge (Optional)

**Criteria:** Provider age < 6 months

**Display:** Stacks with 🌱

```
4. Artisly [icon] 🆕 🌱 🤝
```

**Behaviour:** 🆕 disappears after 6 months; 🌱 remains if MPI still < 3.0

---

## Data Schema

### Market Power JSON File

**Location:** `src/data/providers/market-power.json`

```json
{
  "$schema": "./market-power.schema.json",
  "lastResearched": "2026-01-27",
  "providers": {
    "midjourney": {
      "foundingYear": 2022,
      "socialReach": {
        "youtube": 0,
        "x": 2500000,
        "instagram": 1200000,
        "facebook": 500000,
        "discord": 19000000
      },
      "estimatedUsers": 15000000,
      "notes": "Discord-first platform, massive community"
    }
  }
}
```

**TypeScript Types:**

```typescript
// src/types/market-power.ts

export type SocialReach = {
  youtube?: number;
  x?: number;
  instagram?: number;
  facebook?: number;
  discord?: number;
  linkedin?: number;
  tiktok?: number;
  reddit?: number;
};

export type ProviderMarketPower = {
  foundingYear: number;
  socialReach: SocialReach;
  estimatedUsers: number;
  notes?: string;
};

export type MarketPowerData = {
  $schema?: string;
  lastResearched: string;
  providers: Record<string, ProviderMarketPower>;
};
```

**Schema validation:** TypeScript types ensure data integrity at build time.

### Database Table: `provider_ratings`

| Column            | Type        | Description             |
| ----------------- | ----------- | ----------------------- |
| `provider_id`     | TEXT        | Primary key             |
| `current_rating`  | NUMERIC     | Current Elo rating      |
| `previous_rating` | NUMERIC     | Yesterday's rating      |
| `change`          | NUMERIC     | Absolute change         |
| `change_percent`  | NUMERIC     | Percentage change       |
| `current_rank`    | INTEGER     | Position in leaderboard |
| `previous_rank`   | INTEGER     | Yesterday's position    |
| `rank_changed_at` | TIMESTAMPTZ | When rank last improved |
| `calculated_at`   | TIMESTAMPTZ | Last calculation time   |

```sql
CREATE TABLE IF NOT EXISTS provider_ratings (
  provider_id      TEXT        NOT NULL PRIMARY KEY,
  current_rating   NUMERIC     NOT NULL DEFAULT 1500,
  previous_rating  NUMERIC     NOT NULL DEFAULT 1500,
  change           NUMERIC     NOT NULL DEFAULT 0,
  change_percent   NUMERIC     NOT NULL DEFAULT 0,
  current_rank     INTEGER,
  previous_rank    INTEGER,
  rank_changed_at  TIMESTAMPTZ,
  calculated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provider_ratings_rank
ON provider_ratings (current_rank);
```

### Database Table: `index_rating_cron_runs`

| Column              | Type        | Description             |
| ------------------- | ----------- | ----------------------- |
| `id`                | TEXT        | Primary key (requestId) |
| `ran_at`            | TIMESTAMPTZ | When cron ran           |
| `ok`                | BOOLEAN     | Success/failure         |
| `message`           | TEXT        | Status message          |
| `providers_updated` | BIGINT      | Count of providers      |
| `duration_ms`       | BIGINT      | Execution time          |

```sql
CREATE TABLE IF NOT EXISTS index_rating_cron_runs (
  id                 TEXT        NOT NULL PRIMARY KEY,
  ran_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ok                 BOOLEAN     NOT NULL,
  message            TEXT,
  providers_updated  BIGINT      NOT NULL DEFAULT 0,
  duration_ms        BIGINT      NOT NULL DEFAULT 0
);
```

---

## Cron Job Specification

### Daily Rating Calculation

**Schedule:** 00:05 UTC daily  
**Path:** `/api/index-rating/cron`

**Process:**

1. Acquire advisory lock (`pg_try_advisory_lock(42_4243)`)
2. Read all providers from `providers.json`
3. Read Market Power data from `market-power.json`
4. Snapshot current ratings as "previous"
5. For each provider:
   a. Fetch all events from past 24 hours
   b. Apply time decay to all historical events
   c. Calculate effective points per event
   d. Apply Elo formula
   e. Apply daily regression (0.2% toward baseline)
   f. Store new rating
6. Calculate ranks by rating DESC
7. Compare ranks to previous, set `rank_changed_at` for climbers
8. Calculate change and change_percent
9. Upsert `provider_ratings` table
10. Log completion to `index_rating_cron_runs`
11. Release advisory lock

### Idempotency

Cron must be idempotent — running twice produces same result. Use upsert logic, not insert.

### Backfill Support

Ability to recalculate historical ratings if formula changes. Store raw events permanently; derived ratings can be rebuilt.

---

## UI Tooltip Content

### Index Rating Header Tooltip

Triggered by ⓘ icon next to "Index Rating" column header.

**Text:**

> "Rankings use fair competition scoring. Engagement with smaller platforms counts more, giving newcomers a fighting chance against established giants. See raw popularity in the Promagen Users column."

### 🌱 Badge Tooltip

**Text:**

> "Rising platform — scores adjusted for fair competition"

### ⬆ Arrow Tooltip

**Text:**

> "Climbed in rankings in the last 24 hours"

---

## Sorting Behaviour

### Default Sort

Index Rating DESC (highest first)

### Secondary Sort (Tiebreaker)

If two providers have identical rating: sort by `providerId` alphabetically for consistency.

### User Sorting

Column header is clickable:

- Click once: DESC (highest first) — default
- Click twice: ASC (lowest first)
- Click third: Return to default

---

## Mobile Considerations

### Compact Format (< 640px)

If space constrained, percentage can be hidden:

```
1,847
▲ +23
```

Full format with percentage preferred on tablet and desktop.

### Column Priority

On very narrow screens, if columns must be hidden:

1. Keep: Provider, Index Rating
2. Hide first: Promagen Users, Support
3. Never hide: Provider, Index Rating

---

## Edge Cases

| Scenario                                   | Handling                                                 |
| ------------------------------------------ | -------------------------------------------------------- |
| Provider with zero engagement              | Receives only daily decay; slowly drifts toward baseline |
| Brand new provider (day 1)                 | Seeded rating, shows ● 0 (0.00%), no rank arrow          |
| Provider removed from catalogue            | Rating preserved in DB but not displayed                 |
| Negative rating (theoretically impossible) | Floor at 100; log anomaly                                |
| Rating exceeds 3000                        | Allowed; no ceiling (indicates runaway success)          |
| Stale Market Power data (> 90 days)        | Log warning; use last known values from JSON             |
| Missing social data                        | Calculate MPI with available data only                   |
| All social data missing                    | Default SocialFactor to 1.0                              |
| Database unavailable                       | Fall back to `providers.json` score × 20                 |

---

## Testing Requirements

### Unit Tests

- [ ] Elo calculation produces expected output for known inputs
- [ ] MPI calculation handles missing social data
- [ ] Time decay formula correct at 0, 30, 90 days
- [ ] Static bonuses multiply correctly
- [ ] Newcomer boost applies based on provider age
- [ ] Flat threshold triggers at ±0.1%
- [x] Rank change detection works for climbs (hasRankUp in providers-table.tsx)
- [x] Rank change detection ignores falls (only shows ⬆, never ⬇)
- [x] Fallback to JSON score works when DB unavailable

### Integration Tests

- [x] Daily cron updates all provider ratings (verified 42 providers seeded)
- [ ] Cron is idempotent (same result on re-run)
- [ ] Events older than 180 days contribute negligibly
- [x] Seeding formula produces expected initial ratings (range: 1464-1770)
- [x] UI displays correct colors for gain/loss/flat (CSS !important fix)
- [x] Event tracking: `prompt_builder_open` (ProviderPageTracker)
- [x] Event tracking: `prompt_submit` (copy-open-button.tsx)
- [x] Event tracking: `social_click` (support-icons-cell.tsx)

### Visual Tests

- [x] Glow animation renders on rank-up arrow (@keyframes rank-up-glow)
- [x] Colors match specification (#22c55e, #ef4444, #6b7280)
- [x] Two-line format displays correctly
- [ ] Mobile compact format hides percentage
- [x] Fallback format shows correctly when no DB data

## Metrics & Monitoring

### Health Checks

- Cron completion time (should be < 60 seconds)
- Event ingestion rate (events/minute)
- Rating distribution (detect anomalies)
- Providers with zero events (7-day window)

### Alerts

- Cron fails to run by 00:30 UTC
- Any provider rating goes negative
- MPI calculation returns NaN
- > 10% of providers have zero change (possible data issue)

---

## Glossary

| Term               | Definition                                                      |
| ------------------ | --------------------------------------------------------------- |
| **Index Rating**   | Dynamic Elo-style score for providers                           |
| **MPI**            | Market Power Index — handicap based on size/age                 |
| **K-Factor**       | Elo volatility constant; how much a single event moves rating   |
| **Time Decay**     | Exponential reduction of event value over time                  |
| **Newcomer Boost** | Temporary K-Factor multiplier for providers < 6 months old      |
| **Baseline**       | 1500 — the neutral Elo starting point                           |
| **Seeding**        | Initial rating assignment when transitioning from static scores |
| **Fallback**       | Using `providers.json` data when database is unavailable        |

---

## Changelog

| Date       | Change                                                                               |
| ---------- | ------------------------------------------------------------------------------------ |
| 2026-01-27 | Added transition strategy with JSON fallback                                         |
| 2026-01-27 | Changed Market Power to JSON file (not manual DB entry)                              |
| 2026-01-27 | Confirmed all event tracking: `prompt_builder_open`, `prompt_submit`, `social_click` |
| 2026-01-27 | Skipped `provider_select` (paid feature, future)                                     |
| 2026-01-27 | Updated cron schedule documentation                                                  |
| 2026-01-27 | Added fallback display format specification                                          |
| 2026-01-27 | Added TypeScript types for Market Power                                              |
| 2026-01-26 | Initial document created                                                             |
| 2026-01-27 | Implemented RankUpArrow in provider-cell.tsx with CSS glow animation                 |
| 2026-01-27 | Implemented social_click tracking in support-icons-cell.tsx                          |
| 2026-01-27 | Implemented prompt_submit tracking in copy-open-button.tsx                           |
| 2026-01-27 | Implemented prompt_builder_open tracking via ProviderPageTracker                     |
| 2026-01-27 | Added isUnderdog/isNewcomer calculation from market-power.json                       |
| 2026-01-27 | Fixed providers-table.tsx to pass hasRankUp to ProviderCell                          |
| 2026-01-27 | Added responsive typography with clamp() to Index Rating cell                        |

---

## Related Documents

- `docs/authority/ai_providers.md` — Provider catalogue and type definitions
- `docs/authority/ai providers affiliate & links.md` — Event tracking and `/go/` routing
- `docs/authority/ribbon-homepage.md` — Leaderboard table structure
- `docs/authority/cron_jobs.md` — Cron job patterns
- `docs/authority/paid_tier.md` — Paid feature boundaries
