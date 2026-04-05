# Promagen Users — Master System Document v4.0

**Date:** 6 April 2026
**Author:** Claude (for Martin Yarnold)
**Status:** 4 of 5 items signed off by ChatGPT. Item 3 (total range) retuned — awaiting final confirmation.
**Previous versions:** v2.0 (sign-offable with conditions), v3.0 (signed off), v3.1 (revision request)

---

## Part 1: Real User System (Live in Production)

### 1.1 What It Shows

The "Promagen Users" column on the AI Providers leaderboard shows per-provider usage — how many real users from which countries are actively using each provider through Promagen. It displays a total count plus up to 6 country flags with individual counts.

### 1.2 Data Flow

```
USER ACTION (any tracked event)
  └─► /api/events/track  OR  /app/go/[providerId]/route.ts
      └─► INSERT INTO provider_activity_events
          (click_id, provider_id, event_type, country_code, user_id, ...)

CRON RUNS (every 30 minutes, :10 and :40 past the hour)
  └─► /api/promagen-users/cron
      └─► Aggregates last 30 days by (provider_id, country_code)
      └─► UPSERT INTO provider_country_usage_30d
      └─► INSERT INTO promagen_users_cron_runs (observability)

FRONTEND LOADS (any page with the leaderboard)
  └─► getProvidersWithPromagenUsers()
      └─► Queries provider_country_usage_30d
      └─► Returns providers with promagenUsers[] attached

UI RENDERS
  └─► providers-table.tsx → PromagenUsersCell
      └─► Shows total + top 6 flags with counts
```

### 1.3 Event Types

All events write to `provider_activity_events` with country captured from Vercel's `x-vercel-ip-country` header.

| Event Type            | Base Points | Where Fired                    | Component                       |
| --------------------- | ----------- | ------------------------------ | ------------------------------- |
| `open`                | 1           | Click provider link            | `/go/[providerId]/route.ts`     |
| `click`               | 1           | Legacy alias for open          | `/go/[providerId]/route.ts`     |
| `vote`                | 5           | Image quality vote             | `image-quality-vote-button.tsx` |
| `prompt_builder_open` | 2           | Provider detail page load      | `providers/[id]/page.tsx`       |
| `prompt_submit`       | 3           | Copy button in builder         | `copy-open-button.tsx`          |
| `social_click`        | 1           | Support column icon click      | `support-icons-cell.tsx`        |
| `prompt_lab_select`   | 4           | Select provider in Prompt Lab  | `playground-workspace.tsx`      |
| `prompt_lab_generate` | 7           | Generate prompts in Prompt Lab | `playground-workspace.tsx`      |
| `prompt_lab_copy`     | 6           | Copy prompt from Lab results   | `four-tier-prompt-preview.tsx`  |
| `prompt_save`         | 4           | Save a prompt                  | `save-icon.tsx`                 |
| `prompt_reformat`     | 3           | Reformat a prompt              | `reformat-preview.tsx`          |

All 11 event types feed into the same cron aggregation. The cron counts distinct users per provider per country — it does not distinguish event types when producing the Promagen Users column.

### 1.4 Database Schema

**Table: `provider_activity_events`** — Raw events

```sql
CREATE TABLE provider_activity_events (
  click_id      TEXT PRIMARY KEY,
  provider_id   TEXT NOT NULL,
  event_type    TEXT NOT NULL DEFAULT 'open',
  country_code  TEXT,           -- ISO 3166-1 alpha-2 from x-vercel-ip-country
  user_id       TEXT,           -- Clerk user ID if logged in
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

**Table: `provider_country_usage_30d`** — Aggregated (cron output)

```sql
CREATE TABLE provider_country_usage_30d (
  provider_id   TEXT NOT NULL,
  country_code  TEXT NOT NULL,
  users_count   BIGINT DEFAULT 0,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (provider_id, country_code)
);
```

### 1.5 How Real Data Reaches the UI

1. `getProvidersWithPromagenUsers()` queries `provider_country_usage_30d`
2. Returns `PromagenUsersCountryUsage[]` per provider: `{ countryCode: string, count: number }`
3. Passed as `promagenUsers` prop on each Provider object
4. `PromagenUsersCell` renders: total (sum of all countries) + top 6 flags with counts

### 1.6 Rules for Real Data Display

- Maximum 6 flags visible per provider (UI constraint — cell layout)
- Total = sum of ALL countries, not just visible 6
- If zero users, cell shows "—"
- If data is stale (>48 hours since cron), cell shows "—"
- Standard numbers (not Roman numerals)

---

## Part 2: Demo Layer (Pre-Traffic Social Proof)

### 2.1 Purpose

Before Promagen has significant real traffic, the Promagen Users column would show "—" on every provider. Empty leaderboards signal abandonment. The demo layer provides a believable social proof floor until real users replace it.

### 2.2 Sanctioned Demo Exception

Promagen's frontend standard requires honest failure states and prohibits fake values. The demo layer is a **declared product-sanctioned exception** subject to:

1. Gated behind kill switch (`NEXT_PUBLIC_DEMO_JITTER` env var)
2. Defined cutover path (flip to `false` when real traffic is sufficient)
3. Real users blend additively — never hidden or replaced
4. Demo taper auto-reduces as real usage grows (§3.1)
5. No user action gated or priced on demo data — display-only social proof

### 2.3 Human Factors Statement

| Factor                         | Application                                       |
| ------------------------------ | ------------------------------------------------- |
| **Primary: Social Proof**      | Populated column signals "other people use this." |
| **Secondary: Variable Reward** | Counts shifting through the day create curiosity. |
| **Anti-pattern**               | Repetitive, obviously synthetic rows.             |

### 2.4 Architecture

#### 2.4.1 Country Pool

70 countries across 6 regions:

- **AM** (Americas, 13): US, CA, MX, BR, AR, CO, CL, PE, CR, DO, UY, EC, TT
- **WE** (Western Europe, 11): GB, DE, FR, NL, ES, IT, BE, CH, AT, IE, PT
- **NE** (Northern/Eastern Europe, 17): SE, NO, DK, FI, PL, CZ, RO, UA, HU, HR, BG, SK, LT, LV, EE, IS, GR
- **MA** (Middle East + Africa, 13): TR, AE, SA, IL, QA, JO, EG, MA, NG, KE, ZA, GH, TN
- **EA** (East Asia, 5): JP, KR, TW, HK, CN
- **AO** (S/SE Asia + Oceania, 11): IN, AU, NZ, SG, MY, TH, PH, ID, VN, BD, LK

Each country has a base weight (US highest at 0.180, Tier 3 countries at 0.002) and a UTC offset for time-of-day calculation.

#### 2.4.2 Regional Affinity System

Each provider hashes into one of 7 affinity profiles. This determines which region's flags dominate that provider's row.

| Hash Range | Primary Region | primaryMult | otherMult | Effect                                  |
| ---------- | -------------- | ----------- | --------- | --------------------------------------- |
| 0-19       | AM             | 4.0         | 0.2       | Americas flags dominate                 |
| 20-37      | WE+NE          | 3.5         | 0.25      | European flags dominate                 |
| 38-51      | EA+AO          | 4.0         | 0.2       | Asian flags dominate                    |
| 52-64      | Global         | 1.0         | 1.0       | All regions equal                       |
| 65-77      | MA             | 5.0         | 0.15      | African + Middle Eastern flags dominate |
| 78-87      | WE             | 3.5         | 0.2       | Western European flags dominate         |
| 88-99      | AM+EA+AO       | 3.0         | 0.2       | Latam-Asia bridge                       |

**ChatGPT sign-off (Item 1, approved):** The MA-only profile (range 65-77) was split from the original MA+WE grouping because African countries (NG weight 0.005) were drowned by European countries (GB weight 0.090) in the same primary region. The split is the correct structural fix. primaryMult 5.0 and otherMult 0.15 are approved as tuning knobs — adjust only if live testing shows African flags becoming too dominant.

#### 2.4.3 Country Personality Layer

Within each provider's primary region, the top 3 countries by `hash(providerId + countryCode)` become **anchor countries** with ×3.0 boost. Bottom 3 become weak countries at ×0.5. This ensures two providers with the same regional affinity show different flags — one Americas-heavy provider might anchor on US+BR+AR, another on CA+MX+CO.

#### 2.4.4 Home Country Boost

Each provider's country of origin (from `providers.json` `countryCode` field) gets a presence guarantee:

- If already in entries: boost to `max(count, 2) + 1`
- If not in entries: add with count = 2

Examples: Photoleap → IL, Leonardo → AU, Kling → CN, Clipdrop → FR, MyEdit → TW, Pixlr → MY.

This ensures it does not look odd that zero users from a provider's home country are online.

#### 2.4.5 Time-of-Day Activity Engine

Each country has an activity curve based on local time. Peak at 19:00-20:00 local (after work), low at 01:00-05:00 local (sleeping).

```
Local hour → activity multiplier:
00:0.05  01:0.03  02:0.02  03:0.02  04:0.03  05:0.05
06:0.10  07:0.20  08:0.35  09:0.50  10:0.60  11:0.65
12:0.70  13:0.65  14:0.55  15:0.50  16:0.55  17:0.65
18:0.80  19:0.90  20:0.95  21:0.85  22:0.60  23:0.30
```

**Minimum activity floor:** `MIN_ACTIVITY = 0.10`. Sleeping countries produce tiny counts (1-2) instead of zero, keeping their flags alive at all hours.

**Per-provider phase offsets:** Each provider gets a deterministic offset of 0-59 seconds from `hash(providerId + '_phase') % 60`. Prevents rows ticking in lockstep.

#### 2.4.6 Rank-Based Total Clamping

The demo generator's rank-based engagement naturally produces higher totals for higher-ranked providers. Bracket limits enforce hard bounds on the total per provider:

| Rank  | Min Total | Max Total |
| ----- | --------- | --------- |
| 1-4   | 8         | 45        |
| 5-10  | 5         | 30        |
| 11-20 | 3         | 18        |
| 21-30 | 1         | 10        |
| 31-40 | 1         | 5         |

These brackets control the **total count** only. They do not control how many flags are shown (see §4.1).

If raw total exceeds max, all entries scale down proportionally (minimum 1 per entry). If total still exceeds max after scaling (because many entries got floored to 1), weakest entries are trimmed until the total fits.

#### 2.4.7 Anchor Guarantee

Each provider's 3 primary-region anchor countries always produce at least count=1, even when those countries are sleeping. This ensures EMEA providers always show at least one African flag, EA providers always show an Asian flag, etc.

### 2.5 Tuning Constants

All named for post-build adjustment:

| Constant                      | Value                                  | Purpose                                            |
| ----------------------------- | -------------------------------------- | -------------------------------------------------- |
| `ACTIVITY_SCALE`              | 0.85                                   | Global multiplier for all demo counts              |
| `MIN_ACTIVITY`                | 0.10                                   | Floor for sleeping countries                       |
| `MAX_VISIBLE_FLAGS`           | 6                                      | UI display limit — same for all providers          |
| `DIVERSITY_MAX_APPEARANCES`   | US:16, GB:12, DE:12, JP:12, default:10 | Max times a flag appears across all providers      |
| `DIVERSITY_SWAP_PROXIMITY`    | 0.30                                   | Challenger must be within 30% of incumbent to swap |
| `LAST_SLOT_HYSTERESIS_MARGIN` | 0.15                                   | 15% margin to displace last-slot flag              |

### 2.6 Target Daily Cycle

**ACTIVITY_SCALE = 0.85** produces the following 24-hour cycle (simulated across 40 providers):

| UTC   | Total | Visible Flags | All Flags |
| ----- | ----- | ------------- | --------- |
| 00:30 | 367   | 46            | 52        |
| 03:30 | 311   | 49            | 56        |
| 06:30 | 292   | 48            | 54        |
| 09:30 | 378   | 40            | 57        |
| 12:30 | 417   | 43            | 56        |
| 15:30 | 426   | 41            | 55        |
| 18:30 | 456   | 40            | 54        |
| 21:30 | 396   | 42            | 54        |

**Range: 292–456.**

- Trough at 292 (below 300 — quieter dawn) ✅
- Peak at 456 (EU evening — busiest period) ✅
- 56% swing between trough and peak — clear day/night contrast ✅
- Visible flags: 40–49 range ✅

**ChatGPT sign-off (Item 2, approved):** Visible flag target changed from "≥45 at all times" to "typical operating range 35–49, with ~45 as the healthy midpoint and 24-hour coverage across the full set." Forcing 45+ at all hours would push into visibly artificial behaviour.

**ChatGPT sign-off (Item 3, pending confirmation):** Previous range of 321–581 was too high and too flat. Reduced ACTIVITY_SCALE from 1.3 to 0.85 to produce 292–456. Trough now below 300 as requested. Awaiting confirmation that this range is acceptable.

---

## Part 3: How Demo and Real Data Merge

### 3.1 Damped Additive Merge

Real user data always stacks on top of demo data. The demo layer fades as real usage grows:

```
realUserTotal = sum of all real users for this provider

Damping taper:
  0-25 real users   → demoDamping = 1.0   (demo fully active)
  26-100 real users  → demoDamping = 0.75  (demo gently reduced)
  101-300 real users → demoDamping = 0.4   (demo materially reduced)
  301-500 real users → demoDamping = 0.15  (demo mostly gone)
  500+ real users    → demoDamping = 0.0   (demo off for this provider)

For each country:
  finalCount = round(demoCount × demoDamping) + realCount
```

### 3.2 What This Means in Practice

- **0 real users (launch day):** Demo runs at 100%. Page looks alive.
- **30 real users from 5 countries:** Demo at 75%. Real countries blend in naturally. If a real user from Nigeria uses Midjourney, Nigeria appears on Midjourney's flags within 30 minutes (next cron run).
- **200 real users:** Demo at 40%. Real data shapes the visible set. Demo fills geographic gaps.
- **500+ real users:** Demo off for that provider. Pure real data.

### 3.3 Kill Switch

`NEXT_PUBLIC_DEMO_JITTER=false` → all demo data off for every provider immediately. Only real data remains. This single env var controls both:

- Promagen Users demo (flags and counts)
- Index Rating jitter (±1-3 rating movement and coloured arrows)

One switch, both off.

### 3.4 The Merge Sequence in Code

```
1. Server loads real data via getProvidersWithPromagenUsers()
   → DB query fetches promagenUsers[] per provider

2. Client-side enrichment (providers-table.tsx useMemo):
   a. Generate demo data: generateDemoUsers(providerId, rank, total, homeCountry)
      → returns all countries with time-aware counts
   b. Calculate damping: getDemoDamping(sum of real counts)
   c. Merge per country: demoCount × damping + realCount
   d. Sort merged results (see §4.2)
   e. Determine visible flags: min(6, countries with count > 0)

3. Page-level diversity pass (demo only):
   → swap over-represented last-slot flags

4. Last-slot hysteresis:
   → 15% margin prevents flickering

5. Render PromagenUsersCell:
   → total (sum of ALL countries) + visible flags with counts
```

---

## Part 4: Display Rules (Both Demo and Real)

### 4.1 Flag Count

**ChatGPT sign-off (Item 4, approved):** MAX_VISIBLE_FLAGS = 6 for all providers.

This is a UI display constraint, not a rank constraint. The number of visible flags = `min(6, countries with count ≥ 1)`.

- If a provider has 3 countries with data, show 3.
- If a provider has 25 countries with data, show 6 (top 6 by count).
- If a provider has total 5 across 5 countries, show all 5 — visible sum equals total, no unexplained gap.

The rank controls flag count naturally through the demo generator — lower-ranked providers have lower base engagement, producing fewer countries with non-zero counts. No artificial cap needed.

When real users arrive, a rank-35 provider with users from 8 countries shows 6 flags (UI max). Real data is never hidden by a rank bracket.

### 4.2 Tie-Break Sort Rule

**ChatGPT sign-off (Item 5, approved):** Alphabetical tie-break by rank parity.

When two countries have the same count:

- **Even rank** (2, 4, 6, 8...): tied countries sorted **A→Z** — Argentina before Vietnam
- **Odd rank** (1, 3, 5, 7...): tied countries sorted **Z→A** — Vietnam before Argentina

**Rank change = flag change:** If a provider moves from rank 1 to rank 2, every tie in its visible set flips direction. Adjacent providers with identical counts show different flags from opposite ends of the alphabet.

**ChatGPT note:** This is a deterministic presentation rule for equal counts, not a behavioural signal. Rank changes can alter equal-count display order — this is acceptable because ties are already arbitrary unless a rule defines them.

Applies identically to demo and real data.

### 4.3 Total Display

Total = sum of ALL countries (visible + invisible). Displayed as a number above the flags.

- Provider with total 45 and 6 visible flags summing to 30 → gap implies "15 more users worldwide"
- Provider with total 3 and 3 visible flags summing to 3 → total matches exactly, no unexplained gap

### 4.4 Page-Level Diversity Pass

After generating all provider rows independently, a deterministic pass penalises over-represented flags:

1. Count how many times each flag appears across all visible sets
2. For any flag exceeding its cap (US: 16, GB/DE/JP: 12, others: 10):
   - Find providers where this flag is in the last visible slot
   - If a non-visible challenger is within 30% of the last-slot count, swap them
   - Stop after the flag count drops to the cap

This pass runs only when demo is active. With pure real data, the diversity pass is not applied — real distribution is shown as-is.

### 4.5 Last-Slot Hysteresis

The last visible flag slot holds position until a challenger exceeds it by >15%. Prevents minute-to-minute flickering where two near-equal countries swap every tick.

Hysteresis resets when the visible count changes (e.g., count drops from 5 to 3 during trough — hysteresis applies only to the new last slot at position 3).

Tracked via `useRef` per provider. First tick after mount has no previous data — all flags render fresh, hysteresis applies from second tick onward.

### 4.6 Refresh Rate

Demo data recalculates every 60 seconds (client-side `setInterval`). Real data refreshes on page load (server-side fetch from DB). Combined effect: demo counts shift ±1-2 per country per tick, real data updates within 30 minutes of user activity (next cron run).

---

## Part 5: ChatGPT Sign-Off Status

### Fully Approved (4 of 5)

| #   | Item                                    | Status      |
| --- | --------------------------------------- | ----------- |
| 1   | MA-only affinity split, primaryMult 5.0 | ✅ Approved |
| 2   | Visible flags 35-49 (not forcing 45+)   | ✅ Approved |
| 4   | MAX_VISIBLE_FLAGS = 6 for all providers | ✅ Approved |
| 5   | Alphabetical tie-break by rank parity   | ✅ Approved |

### Awaiting Confirmation (1 of 5)

| #   | Item                                                  | Status     |
| --- | ----------------------------------------------------- | ---------- |
| 3   | Total range — ACTIVITY_SCALE reduced from 1.3 to 0.85 | ⏳ Pending |

Previous range was 321–581 (too high, too flat). You asked for trough below 300 and target range 220–520 or 240–540.

New range with `ACTIVITY_SCALE = 0.85`: **292–456**.

- Trough 292 — below 300 as requested ✅
- Peak 456 — below the 520 upper target but comfortably "alive"
- 56% swing between trough and peak — clear day/night contrast
- Page never feels dead, never feels overcrowded

Pushing ACTIVITY_SCALE lower (to 0.7) would drop the trough to ~240 but compresses the peak to ~370, which risks feeling too quiet at peak hours.

**Question:** Is 292–456 acceptable as the final calibration, or do you want the range adjusted further?

---

## Part 6: Pages Using This System

All four leaderboard pages load real user data via `getProvidersWithPromagenUsers()`:

- `/` (homepage)
- `/studio/playground` (Prompt Lab)
- `/world-context` (World Context)
- `/providers` (full provider list)

The demo layer is computed client-side in `providers-table.tsx` and merged with the server-loaded real data. The kill switch and all demo logic live entirely in one component file.

---

## Part 7: Implementation File Map

| File                                           | Role                                                                    |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| `src/components/providers/providers-table.tsx` | Demo generator, merge logic, diversity pass, hysteresis, cell rendering |
| `src/types/promagen-users.ts`                  | `PromagenUsersCountryUsage` type                                        |
| `src/lib/promagen-users/index.ts`              | DB queries, staleness checks, normalisation                             |
| `src/app/api/promagen-users/cron/route.ts`     | 30-minute aggregation cron                                              |
| `src/app/api/events/track/route.ts`            | Event ingestion (all 11 types)                                          |
| `src/hooks/use-index-rating-events.ts`         | Client-side event tracking hooks                                        |
| `src/data/providers/providers.json`            | Provider metadata including `countryCode`                               |
| `src/lib/providers/api.ts`                     | `getProvidersWithPromagenUsers()`                                       |

---

## Part 8: Risk Assessment

| Risk                                                | Likelihood | Mitigation                                                                        |
| --------------------------------------------------- | ---------- | --------------------------------------------------------------------------------- |
| Hash collisions creating repeated row personalities | Low        | Country personality layer adds second differentiation axis                        |
| Lockstep ticking across rows                        | Eliminated | Per-provider phase offsets                                                        |
| Real users distorting visible set too early         | Low        | Damped merge taper (§3.1)                                                         |
| Over-represented flags dominating the page          | Low        | Page-level diversity pass (§4.4)                                                  |
| Last-slot flag flickering                           | Low        | 15% hysteresis margin (§4.5)                                                      |
| Demo layer persisting too long after real growth    | Low        | Per-provider taper auto-reduces at 26+ real users                                 |
| CLS / hydration mismatch                            | Low        | demoUserTick=0 gate; hysteresis ref initialises empty                             |
| Honest-failure rule conflict                        | Addressed  | Explicit demo exception documented (§2.2)                                         |
| Total vs visible gap looking wrong at small numbers | Eliminated | MAX_VISIBLE_FLAGS = 6 + no rank ceiling means small providers show all their data |
