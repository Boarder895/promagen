# Phase 7.11 — Admin Command Centre: Scoring Health Dashboard

**Version:** 1.0.0  
**Created:** 2026-03-01  
**Status:** Planning — No code yet  
**Authority:** `docs/authority/prompt-builder-evolution-plan-v2.md` § 12  
**Route:** `/admin/scoring-health` (new page within existing `/admin` layout)  
**Estimated total effort:** 7–9 days (9 sections + 3 next-level features)

---

## Table of Contents

1. [Current State](#1-current-state)
2. [Architecture Decision](#2-architecture-decision)
3. [Build Parts Overview](#3-build-parts-overview)
4. [Part 7.11a — Foundation & Scorer Health Overview](#4-part-711a--foundation--scorer-health-overview)
5. [Part 7.11b — Weight Drift Visualisation & Per-Tier Models](#5-part-711b--weight-drift-visualisation--per-tier-models)
6. [Part 7.11c — Term Quality Leaderboard](#6-part-711c--term-quality-leaderboard)
7. [Part 7.11d — Anti-Pattern Alerts & A/B Test Results](#7-part-711d--anti-pattern-alerts--ab-test-results)
8. [Part 7.11e — Temporal Trends & Feedback Summary](#8-part-711e--temporal-trends--feedback-summary)
9. [Part 7.11f — User Skill Distribution](#9-part-711f--user-skill-distribution)
10. [Part 7.11g — 🆕 Anomaly Alert System](#10-part-711g--anomaly-alert-system)
11. [Part 7.11h — 🆕 Weight Tuning Sandbox](#11-part-711h--weight-tuning-sandbox)
12. [Part 7.11i — 🆕 Pipeline Dependency Graph](#12-part-711i--pipeline-dependency-graph)
13. [File Impact Map](#13-file-impact-map)
14. [API Routes Required](#14-api-routes-required)
15. [Testing Strategy](#15-testing-strategy)
16. [Verification Checklist](#16-verification-checklist)

---

## 1. Current State

### ✅ What's Built (Admin Infrastructure)

| Component                | File                                                | Lines | Status |
| ------------------------ | --------------------------------------------------- | ----- | ------ |
| Admin layout             | `src/app/admin/layout.tsx`                          | 55    | ✅     |
| Admin navigation         | `src/app/admin/admin-nav.tsx`                       | 52    | ✅     |
| Admin dashboard          | `src/app/admin/page.tsx`                            | ~100  | ✅     |
| Vocab submissions review | `src/app/admin/vocab-submissions/page.tsx`          | 1,632 | ✅     |
| Scene candidates review  | `src/app/admin/scene-candidates/page.tsx`           | 526   | ✅     |
| Exchange editor          | `src/app/admin/exchanges/page.tsx`                  | —     | ✅     |
| Provider browser         | `src/app/admin/providers/page.tsx`                  | —     | ✅     |
| Temporal Freshness Badge | `src/components/admin/temporal-freshness-badge.tsx` | 313   | ✅     |
| Compression Dashboard    | `src/components/admin/compression-dashboard.tsx`    | 445   | ✅     |
| Feedback Pulse Dashboard | `src/components/admin/feedback-pulse-dashboard.tsx` | 496   | ✅     |
| A/B Test Dashboard       | `src/components/admin/ab-test-dashboard.tsx`        | 711   | ✅     |

### ❌ What's NOT Built (Scoring Health Dashboard)

| Section | Description                                                                 | Status |
| ------- | --------------------------------------------------------------------------- | ------ |
| 1       | Scorer Health Overview (correlation metrics, trend arrows, sparklines)      | ❌     |
| 2       | Weight Drift Visualisation (line chart showing factor weight changes)       | ❌     |
| 3       | Per-Tier Scoring Models (side-by-side weight comparison, heatmap)           | ❌     |
| 4       | Term Quality Leaderboard (top/bottom 20 per category per tier)              | ❌     |
| 5       | Anti-Pattern Alerts (collision pairs, severity scores, manual overrides)    | ❌     |
| 6       | A/B Test Results (control vs variant, significance, promote/rollback)       | ❌     |
| 8       | Temporal Trends (trending terms, seasonal patterns, platform update alerts) | ❌     |
| 9       | User Skill Distribution (pie chart, graduation funnel)                      | ❌     |
| 10      | Feedback Summary (👍👌👎 distribution, per-platform satisfaction)           | ❌     |

> **Note:** Section 7 (Scene Candidate Review) already exists at `/admin/scene-candidates` — no work needed.

### 🆕 Three Next-Level Features (New)

| Feature                       | Description                                                                             | Section |
| ----------------------------- | --------------------------------------------------------------------------------------- | ------- |
| **Anomaly Alert System**      | Real-time alert banner auto-surfacing critical issues across all pipelines              | 7.11g   |
| **Weight Tuning Sandbox**     | Interactive "what-if" mode — adjust weights, see simulated impact, promote or discard   | 7.11h   |
| **Pipeline Dependency Graph** | Visual DAG showing all 10 learning dimensions, their health, connections, and data flow | 7.11i   |

---

## 2. Architecture Decision

### Page Structure

**Decision:** Single page at `/admin/scoring-health` with section-based scrolling and a sticky sidebar nav.

**Rationale:**

- Admin wants a single-URL view of the entire scoring system health
- Sticky sidebar nav allows jumping between sections without losing context
- Each section is a self-contained component — lazy-loaded for performance
- The page sits within the existing `/admin` layout (inherits header, nav, dark theme)

### Data Flow

```
┌──────────────────────────────────────────────────────────┐
│  /admin/scoring-health (page.tsx — server component)     │
│  ├── Fetches initial data server-side (SSR)              │
│  └── Renders ScoringHealthClient (client component)      │
│       ├── ScoringHealthNav (sticky sidebar)              │
│       ├── Section 1: ScorerHealthOverview                │
│       ├── Section 2: WeightDriftChart                    │
│       ├── Section 3: TierModelsHeatmap                   │
│       ├── Section 4: TermQualityLeaderboard              │
│       ├── Section 5: AntiPatternAlerts                   │
│       ├── Section 6: ABTestResults                       │
│       ├── Section 8: TemporalTrendsPanel                 │
│       ├── Section 9: SkillDistributionPanel              │
│       ├── Section 10: FeedbackSummaryPanel               │
│       ├── 🆕 AnomalyAlertBanner (sticky top)            │
│       ├── 🆕 WeightTuningSandbox (modal overlay)         │
│       └── 🆕 PipelineDependencyGraph (expandable)        │
└──────────────────────────────────────────────────────────┘
```

### API Pattern

Each section fetches its own data via dedicated API routes under `/api/admin/scoring-health/`. This avoids a monolithic endpoint and allows independent refresh intervals:

| Section            | API Route                                    | Refresh          |
| ------------------ | -------------------------------------------- | ---------------- |
| Scorer Health      | `/api/admin/scoring-health/overview`         | 5 min auto       |
| Weight Drift       | `/api/admin/scoring-health/weight-history`   | On-demand        |
| Tier Models        | `/api/admin/scoring-health/tier-weights`     | 5 min auto       |
| Term Quality       | `/api/admin/scoring-health/term-quality`     | On-demand        |
| Anti-Patterns      | `/api/admin/scoring-health/anti-patterns`    | 5 min auto       |
| A/B Tests          | `/api/admin/scoring-health/ab-tests`         | 5 min auto       |
| Temporal           | `/api/admin/scoring-health/temporal`         | 5 min auto       |
| Skill Distribution | `/api/admin/scoring-health/skill-dist`       | On-demand        |
| Feedback Summary   | `/api/admin/scoring-health/feedback`         | 5 min auto       |
| 🆕 Anomaly Alerts  | `/api/admin/scoring-health/anomalies`        | 60s auto         |
| 🆕 Weight Sandbox  | `/api/admin/scoring-health/simulate-weights` | On-demand (POST) |
| 🆕 Pipeline Graph  | `/api/admin/scoring-health/pipeline-status`  | 5 min auto       |

### Component Sizing Rules

All components follow `code-standard.md`:

- All text: `clamp()` inline styles (no fixed px, no Tailwind text classes)
- All spacing/padding: `clamp()` inline styles
- All charts/visualisations: CSS-only (no external charting library) — using CSS Grid + CSS custom properties for bar charts, heatmaps, sparklines
- No mobile breakpoints — fluid scaling only (desktop app)

---

## 3. Build Parts Overview

| Part      | Contents                                                                           | Effort  | Dependencies                 |
| --------- | ---------------------------------------------------------------------------------- | ------- | ---------------------------- |
| **7.11a** | Foundation: page shell, sidebar nav, Section 1 (Scorer Health Overview), API route | 1 day   | Existing admin layout        |
| **7.11b** | Section 2 (Weight Drift Vis) + Section 3 (Per-Tier Models Heatmap)                 | 1 day   | 7.11a                        |
| **7.11c** | Section 4 (Term Quality Leaderboard)                                               | 1 day   | 7.11a                        |
| **7.11d** | Section 5 (Anti-Pattern Alerts) + Section 6 (A/B Test Results)                     | 1 day   | 7.11a                        |
| **7.11e** | Section 8 (Temporal Trends) + Section 10 (Feedback Summary)                        | 1 day   | 7.11a                        |
| **7.11f** | Section 9 (User Skill Distribution)                                                | 0.5 day | 7.11a                        |
| **7.11g** | 🆕 Anomaly Alert System (banner + API + threshold engine)                          | 1 day   | 7.11a–f (reads all sections) |
| **7.11h** | 🆕 Weight Tuning Sandbox (modal + simulator + promote action)                      | 1 day   | 7.11b (needs weight data)    |
| **7.11i** | 🆕 Pipeline Dependency Graph (visual DAG + node health)                            | 1 day   | 7.11a–f (reads all sections) |

**Total: 8.5 days**

---

## 4. Part 7.11a — Foundation & Scorer Health Overview

### What Gets Built

1. **Page shell** — `/admin/scoring-health/page.tsx` (server) + `scoring-health-client.tsx` (client)
2. **Sticky sidebar nav** — Section jump links with active section detection via IntersectionObserver
3. **Section 1: Scorer Health Overview** — The "at-a-glance" hero panel
4. **API route** — `/api/admin/scoring-health/overview/route.ts`
5. **Admin nav update** — Add "Scoring Health" link to admin-nav.tsx
6. **Types** — `src/lib/admin/scoring-health-types.ts`

### Section 1 Design — Scorer Health Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│  SCORER HEALTH OVERVIEW                                          ⟳ 5m  │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Score-Outcome Correlation          Total Prompts Logged                 │
│  ┌──────────────────────┐           ┌──────────────────────┐            │
│  │  0.68  ▲ +0.05       │           │  12,847              │            │
│  │  ▁▂▃▄▅▆▇█ (30d)     │           │  +1,204 this week    │            │
│  └──────────────────────┘           └──────────────────────┘            │
│                                                                          │
│  Active A/B Tests          Last Cron Run              Pipeline Uptime   │
│  ┌──────────────┐          ┌─────────────────┐        ┌──────────────┐  │
│  │  3 running   │          │  2h 14m ago      │        │  99.7%       │  │
│  │  1 pending   │          │  Duration: 4.2s  │        │  (30 days)   │  │
│  │  2 concluded │          │  ✅ Success      │        │              │  │
│  └──────────────┘          └─────────────────┘        └──────────────┘  │
│                                                                          │
│  Quick Pulse: ● Correlation ✅  ● Freshness ✅  ● Anti-Patterns ⚠️     │
└──────────────────────────────────────────────────────────────────────────┘
```

**Key metrics:**

| Metric                              | Source                                        | Display                                               |
| ----------------------------------- | --------------------------------------------- | ----------------------------------------------------- |
| Score-outcome correlation (current) | `scoring-weights.json` generatedAt + computed | Large number + trend arrow + 30-day CSS sparkline     |
| Correlation change vs last month    | Computed from history                         | +/- percentage, green (improving) or red (declining)  |
| Total prompts logged                | `prompt_events` table count                   | Counter + weekly delta                                |
| Active A/B tests                    | `ab-tests.json` filtered by status            | Count + status badges (running / pending / concluded) |
| Last cron run                       | `learning-meta.json` lastRunAt                | Timestamp + duration + success/fail badge             |
| Pipeline uptime                     | Computed from cron history                    | Percentage over 30 days                               |
| Quick Pulse                         | Aggregated health from all sections           | Traffic-light dots (✅ / ⚠️ / ❌)                     |

**Sparkline implementation:** Pure CSS using `background: linear-gradient()` segments. No charting library. Each data point is a CSS custom property (`--d1`, `--d2`, ... `--d30`), rendered as a series of gradient stops. Lightweight, no dependencies, perfectly fluid.

### Files Created

| File                                                             | Purpose                                         | Est. Lines |
| ---------------------------------------------------------------- | ----------------------------------------------- | ---------- |
| `src/app/admin/scoring-health/page.tsx`                          | Server component — fetches initial data         | ~40        |
| `src/app/admin/scoring-health/scoring-health-client.tsx`         | Client shell — sidebar nav + section containers | ~200       |
| `src/components/admin/scoring-health/scorer-health-overview.tsx` | Section 1 component                             | ~350       |
| `src/components/admin/scoring-health/scoring-health-nav.tsx`     | Sticky sidebar navigation                       | ~80        |
| `src/components/admin/scoring-health/css-sparkline.tsx`          | Reusable CSS-only sparkline component           | ~100       |
| `src/lib/admin/scoring-health-types.ts`                          | Shared TypeScript types for all sections        | ~150       |
| `src/app/api/admin/scoring-health/overview/route.ts`             | API: overview metrics                           | ~120       |
| `src/__tests__/admin/scoring-health-overview.test.ts`            | Unit tests for overview logic                   | ~80        |

### Admin Nav Update

```diff
 const NAV_LINKS = [
+  { href: '/admin/scoring-health',  label: 'Scoring Health' },
   { href: '/admin/vocab-submissions', label: 'Vocab Queue' },
   { href: '/admin/scene-candidates',  label: 'Scene Candidates' },
   { href: '/admin/providers',         label: 'Providers' },
   { href: '/admin/exchanges',         label: 'Exchanges' },
 ] as const;
```

### Verification

```powershell
# Run at repo root: C:\Users\Proma\Projects\promagen
pnpm run typecheck
pnpm test -- --testPathPattern="scoring-health" --verbose
```

**What "good" looks like:**

- Navigate to `/admin/scoring-health` — page loads within existing admin layout
- Sidebar shows all section links, first section auto-highlighted
- Scorer Health Overview shows metric cards with sparkline
- Auto-refresh fires every 5 minutes (visible in Network tab)
- All text uses `clamp()` — resize browser window, text scales smoothly
- Zero console errors

---

## 5. Part 7.11b — Weight Drift Visualisation & Per-Tier Models

### Section 2: Weight Drift Visualisation

Shows how each scoring factor's weight has evolved over time. This is the "are we getting smarter?" view.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  WEIGHT DRIFT (90 DAYS)                                    ⟳ On-demand │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  coherence      0.05 ──────────────────────────────────▶ 0.35  (+600%) │
│                 ▁▁▂▂▃▃▄▅▅▆▆▇▇██                                        │
│                                                                          │
│  categoryCount  0.25 ──────────────────────────────────▶ 0.08  (-68%)  │
│                 ██▇▇▆▅▅▄▃▃▂▂▁▁                                         │
│                                                                          │
│  tierFormat     0.15 ──────────────────────────────────▶ 0.17  (+13%)  │
│                 ████████████████                                         │
│                                                                          │
│  promptLength   0.20 ──────────────────────────────────▶ 0.18  (-10%)  │
│                 ████████████████                                         │
│                                                                          │
│  ⚡ Biggest mover: coherence (+600% in 90 days)                         │
│  📉 Biggest decline: categoryCount (-68%)                               │
└──────────────────────────────────────────────────────────────────────────┘
```

**Implementation:** CSS Grid with animated bars. Each factor gets a row. The bar width is a percentage of max weight observed. Colour intensity maps to change magnitude (brighter = bigger drift). Start value → end value shown as bookends. CSS sparkline underneath shows the trajectory.

### Section 3: Per-Tier Scoring Models (Heatmap)

Side-by-side weight comparison across all 4 optimizer tiers. Heatmap colouring shows which factors matter most per tier.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  PER-TIER SCORING MODELS                                   ⟳ 5 min     │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Factor           │ Tier 1 (CLIP) │ Tier 2 (MJ) │ Tier 3 (NL) │ Tier 4│
│  ─────────────────┼───────────────┼─────────────┼─────────────┼───────│
│  coherence        │   ██ 0.35     │  ███ 0.42   │ ████ 0.55   │ █ 0.18│
│  categoryCount    │   █ 0.08      │  █ 0.10     │  · 0.03     │ █ 0.12│
│  tierFormat       │   ██ 0.22     │  ██ 0.25    │  █ 0.15     │ █ 0.10│
│  promptLength     │   █ 0.15      │  █ 0.12     │  █ 0.18     │██ 0.40│
│  fidelityTerms    │   ██ 0.20     │  █ 0.11     │  · 0.05     │ · 0.02│
│  negativePresent  │   · 0.00      │  · 0.00     │  · 0.04     │██ 0.18│
│                                                                          │
│  🔥 Hottest: coherence on Tier 3 (NL) — 0.55                           │
│  ❄️ Coldest: negativePresent on Tier 1 & 2 — 0.00                      │
└──────────────────────────────────────────────────────────────────────────┘
```

**Heatmap implementation:** CSS `background-color` with dynamic opacity based on weight value. `opacity: weight / maxWeight`. Green spectrum (0.0 = transparent, 1.0 = full emerald). No canvas, no SVG — pure CSS Grid cells with computed background colours.

### Files Created

| File                                                          | Purpose                           | Est. Lines |
| ------------------------------------------------------------- | --------------------------------- | ---------- |
| `src/components/admin/scoring-health/weight-drift-chart.tsx`  | Section 2 — weight evolution bars | ~280       |
| `src/components/admin/scoring-health/tier-models-heatmap.tsx` | Section 3 — heatmap grid          | ~250       |
| `src/app/api/admin/scoring-health/weight-history/route.ts`    | API: weight snapshots over time   | ~100       |
| `src/app/api/admin/scoring-health/tier-weights/route.ts`      | API: current per-tier weights     | ~80        |
| `src/__tests__/admin/weight-drift-chart.test.ts`              | Tests for drift computation       | ~60        |

### Verification

```powershell
# Run at repo root: C:\Users\Proma\Projects\promagen
pnpm run typecheck
pnpm test -- --testPathPattern="weight-drift\|tier-models" --verbose
```

**What "good" looks like:**

- Weight Drift shows animated bars with start → end values
- Bars colour-code by direction (green = grew, amber = shrunk)
- Heatmap cells are colour-coded by weight intensity
- "Hottest" and "Coldest" callouts auto-computed
- Responsive — columns don't break on resize

---

## 6. Part 7.11c — Term Quality Leaderboard

### Section 4: Term Quality Leaderboard

Top 20 and bottom 20 terms per category per tier. This is where the admin sees which individual vocabulary terms are performing and which are dragging scores down.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  TERM QUALITY LEADERBOARD                                  ⟳ On-demand │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Filter: [Category ▾]  [Tier ▾]  [Sort: Quality ▾]  [🔍 Search]       │
│                                                                          │
│  🏆 TOP 20                                                              │
│  ┌────┬───────────────────┬──────┬───────┬────────┬────────────────┐    │
│  │ #  │ Term              │ Qual │ Usage │ Trend  │ Category       │    │
│  ├────┼───────────────────┼──────┼───────┼────────┼────────────────┤    │
│  │ 1  │ cinematic         │ 0.94 │ 3,412 │ ▲ +2%  │ Style          │    │
│  │ 2  │ neon glow         │ 0.91 │ 2,108 │ ▲ +5%  │ Lighting       │    │
│  │ 3  │ golden hour       │ 0.89 │ 4,201 │ ─      │ Lighting       │    │
│  │ ...│                   │      │       │        │                │    │
│  └────┴───────────────────┴──────┴───────┴────────┴────────────────┘    │
│                                                                          │
│  ⚠️ BOTTOM 20 (Candidates for Demotion)                                │
│  ┌────┬───────────────────┬──────┬───────┬────────┬─────────────────┐   │
│  │ #  │ Term              │ Qual │ Usage │ Trend  │ Action          │   │
│  ├────┼───────────────────┼──────┼───────┼────────┼─────────────────┤   │
│  │ 1  │ very detailed     │ 0.12 │ 87    │ ▼ -8%  │ [Flag] [Hide]  │   │
│  │ 2  │ super realistic   │ 0.15 │ 45    │ ▼ -12% │ [Flag] [Hide]  │   │
│  └────┴───────────────────┴──────┴───────┴────────┴─────────────────┘   │
│                                                                          │
│  Summary: 4,218 terms scored │ 312 above 0.80 │ 47 below 0.20          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Features:**

- Filter by category (all 11 prompt builder categories) + tier (1–4) + sort column
- Search box for finding specific terms
- Top 20 shows quality badges with trend arrows
- Bottom 20 shows action buttons: Flag (mark for review) and Hide (suppress from suggestions)
- Summary bar shows total scored, high performers, low performers

### Files Created

| File                                                               | Purpose                                    | Est. Lines |
| ------------------------------------------------------------------ | ------------------------------------------ | ---------- |
| `src/components/admin/scoring-health/term-quality-leaderboard.tsx` | Section 4 — sortable/filterable term table | ~400       |
| `src/app/api/admin/scoring-health/term-quality/route.ts`           | API: term quality scores with filters      | ~120       |
| `src/__tests__/admin/term-quality-leaderboard.test.ts`             | Tests for sorting/filtering logic          | ~80        |

### Verification

```powershell
# Run at repo root: C:\Users\Proma\Projects\promagen
pnpm run typecheck
pnpm test -- --testPathPattern="term-quality" --verbose
```

**What "good" looks like:**

- Dropdown filters for category and tier work, table re-renders immediately
- Sort by any column header click (ascending/descending toggle)
- Search filters in real-time (debounced 200ms)
- Bottom 20 action buttons show hover state but log to console only (no DB write yet)
- Scrollable table if more than viewport height

---

## 7. Part 7.11d — Anti-Pattern Alerts & A/B Test Results

### Section 5: Anti-Pattern Alerts

Shows detected collision pairs and anti-patterns with severity scores and manual override controls.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ANTI-PATTERN ALERTS (12 active)                           ⟳ 5 min     │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  🔴 HIGH SEVERITY (3)                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ "oil painting" + "digital art"      │ Collision │ Score: 0.92      │ │
│  │ Seen 847 times │ Avg quality: -23%  │ [Suppress] [Dismiss]         │ │
│  ├─────────────────────────────────────────────────────────────────────┤ │
│  │ "hyperrealistic" + "cartoon style"  │ Collision │ Score: 0.88      │ │
│  │ Seen 412 times │ Avg quality: -31%  │ [Suppress] [Dismiss]         │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  🟡 MEDIUM SEVERITY (5)                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ "golden hour" + "night scene"       │ Conflict  │ Score: 0.64      │ │
│  │ Seen 203 times │ Avg quality: -11%  │ [Suppress] [Dismiss]         │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  🟢 LOW / DISMISSED (4)  [Show ▾]                                       │
│                                                                          │
│  Overrides applied: 2 │ Auto-detected this month: 7                     │
└──────────────────────────────────────────────────────────────────────────┘
```

**Features:**

- Grouped by severity (High / Medium / Low)
- Each alert shows: term pair, type (collision/conflict/redundancy), severity score, occurrence count, average quality impact
- Action buttons: Suppress (prevent these terms co-appearing in suggestions) and Dismiss (mark as acceptable)
- Collapsed "Low / Dismissed" section to keep focus on actionable items
- Override count and auto-detection stats

### Section 6: A/B Test Results

Wires the existing `ab-test-dashboard.tsx` component (711 lines, already built) into the scoring health page with additional context.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  A/B TEST RESULTS                                          ⟳ 5 min     │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  [Existing ABTestDashboard component renders here]                       │
│  - Shows running / concluded tests                                       │
│  - Control vs variant metrics                                            │
│  - Statistical significance indicators                                   │
│  - Lift distribution sparklines                                          │
│  - Promote / Rollback actions                                            │
│                                                                          │
│  NEW: Test History Timeline                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ Feb 28: "coherence-boost-v2" → Promoted (lift: +4.2%)              │ │
│  │ Feb 21: "tier4-simplify-v1"  → Rolled back (lift: -1.1%)          │ │
│  │ Feb 14: "category-weight-v3" → Promoted (lift: +2.8%)              │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

**Key decision:** Section 6 reuses the existing `ABTestDashboard` component rather than rebuilding. Wraps it in a section container and adds a "Test History Timeline" below showing past test outcomes.

### Files Created

| File                                                          | Purpose                                              | Est. Lines |
| ------------------------------------------------------------- | ---------------------------------------------------- | ---------- |
| `src/components/admin/scoring-health/anti-pattern-alerts.tsx` | Section 5 — collision/conflict display               | ~350       |
| `src/components/admin/scoring-health/ab-test-section.tsx`     | Section 6 — wraps existing ABTestDashboard + history | ~150       |
| `src/app/api/admin/scoring-health/anti-patterns/route.ts`     | API: detected anti-patterns                          | ~100       |
| `src/app/api/admin/scoring-health/ab-tests/route.ts`          | API: test results + history                          | ~80        |
| `src/__tests__/admin/anti-pattern-alerts.test.ts`             | Tests for severity grouping and actions              | ~70        |

### Verification

```powershell
# Run at repo root: C:\Users\Proma\Projects\promagen
pnpm run typecheck
pnpm test -- --testPathPattern="anti-pattern\|ab-test-section" --verbose
```

**What "good" looks like:**

- Anti-patterns grouped by severity with correct colour coding
- Suppress/Dismiss buttons show confirmation tooltip before action
- A/B section shows existing dashboard + new history timeline
- History entries sorted reverse-chronological

---

## 8. Part 7.11e — Temporal Trends & Feedback Summary

### Section 8: Temporal Trends Panel

Extends the existing Temporal Freshness Badge into a full panel showing trending terms, seasonal patterns, and platform update detection.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  TEMPORAL TRENDS                                           ⟳ 5 min     │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  📈 TRENDING NOW (Top 10)                                               │
│  ┌──────────────┬──────────┬────────────┬───────────────┐               │
│  │ Term         │ Velocity │ Since      │ Platforms     │               │
│  │ ghibli style │ ▲▲▲ 340% │ 3 days ago │ MJ, DALL·E   │               │
│  │ clay render  │ ▲▲ 180%  │ 1 week ago │ MJ            │               │
│  │ pixel art    │ ▲ 45%    │ 2 weeks    │ All           │               │
│  └──────────────┴──────────┴────────────┴───────────────┘               │
│                                                                          │
│  🌊 SEASONAL PATTERNS                                                   │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ Current month boost: "spring" terms +22%, "winter" terms -15%   │    │
│  │ Weekend vs weekday: Fantasy +34% on weekends                    │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ⏰ DATA FRESHNESS  [Existing TemporalFreshnessBadge expanded]          │
│  Seasonal: 🟢 Fresh (2h ago, 97%)  │  Trending: 🟢 Fresh (45m, 99%)   │
└──────────────────────────────────────────────────────────────────────────┘
```

### Section 10: Feedback Summary

Shows distribution of direct user feedback (👍👌👎) with per-platform breakdown.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  FEEDBACK SUMMARY                                          ⟳ 5 min     │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Overall Distribution (last 30 days, 2,847 responses)                   │
│  ┌────────────────────────────────────────────────────────────────┐      │
│  │ 👍 Great   ████████████████████████████████████  68%  (1,936) │      │
│  │ 👌 Okay    ████████████                          24%  (683)   │      │
│  │ 👎 Not good ████                                  8%  (228)   │      │
│  └────────────────────────────────────────────────────────────────┘      │
│                                                                          │
│  Per-Platform Satisfaction (Top 5 + Bottom 5)                           │
│  ┌──────────────────┬──────────┬────────────────┐                       │
│  │ Platform         │ 👍 Rate  │ Trend          │                       │
│  │ Midjourney       │ 82%      │ ▲ +3% (month)  │                       │
│  │ DALL·E           │ 78%      │ ─ stable       │                       │
│  │ Leonardo         │ 74%      │ ▲ +1%          │                       │
│  │ ...              │          │                │                       │
│  │ Craiyon          │ 41%      │ ▼ -5%          │                       │
│  │ Artistly         │ 38%      │ ▼ -2%          │                       │
│  └──────────────────┴──────────┴────────────────┘                       │
│                                                                          │
│  Response Rate: 22% │ Avg credibility: 0.74 │ Paid user rate: 31%       │
└──────────────────────────────────────────────────────────────────────────┘
```

### Files Created

| File                                                             | Purpose                                           | Est. Lines |
| ---------------------------------------------------------------- | ------------------------------------------------- | ---------- |
| `src/components/admin/scoring-health/temporal-trends-panel.tsx`  | Section 8 — trending + seasonal + freshness       | ~350       |
| `src/components/admin/scoring-health/feedback-summary-panel.tsx` | Section 10 — feedback distribution + per-platform | ~300       |
| `src/app/api/admin/scoring-health/temporal/route.ts`             | API: trending + seasonal data                     | ~100       |
| `src/app/api/admin/scoring-health/feedback/route.ts`             | API: feedback aggregations                        | ~100       |
| `src/__tests__/admin/feedback-summary.test.ts`                   | Tests for distribution computation                | ~60        |

### Verification

```powershell
# Run at repo root: C:\Users\Proma\Projects\promagen
pnpm run typecheck
pnpm test -- --testPathPattern="temporal-trends\|feedback-summary" --verbose
```

---

## 9. Part 7.11f — User Skill Distribution

### Section 9: Skill Distribution Panel

Shows the breakdown of users across skill levels (beginner / intermediate / expert) with a graduation funnel.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  USER SKILL DISTRIBUTION                                   ⟳ On-demand │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Distribution (1,847 active users)                                       │
│  ┌───────────────────────────────────────────────────────────────┐       │
│  │ Beginner    ████████████████████████████████████████  62%     │       │
│  │ Intermediate████████████████████                      28%     │       │
│  │ Expert      ██████                                    10%     │       │
│  └───────────────────────────────────────────────────────────────┘       │
│                                                                          │
│  Graduation Funnel (last 30 days)                                       │
│  ┌───────────────────────────────────────────────────────────────┐       │
│  │ Beginner → Intermediate:  47 users (avg 8 sessions)           │       │
│  │ Intermediate → Expert:    12 users (avg 22 sessions)          │       │
│  │ Avg graduation time: 14 days                                  │       │
│  └───────────────────────────────────────────────────────────────┘       │
│                                                                          │
│  Tier Usage by Skill Level                                               │
│  ┌───────────┬───────────┬──────────┬──────────┬──────────┐             │
│  │           │ Tier 1    │ Tier 2   │ Tier 3   │ Tier 4   │             │
│  │ Beginner  │ 8%        │ 12%      │ 25%      │ 55%      │             │
│  │ Intermed. │ 22%       │ 35%      │ 30%      │ 13%      │             │
│  │ Expert    │ 45%       │ 30%      │ 20%      │ 5%       │             │
│  └───────────┴───────────┴──────────┴──────────┴──────────┘             │
└──────────────────────────────────────────────────────────────────────────┘
```

### Files Created

| File                                                               | Purpose                                      | Est. Lines |
| ------------------------------------------------------------------ | -------------------------------------------- | ---------- |
| `src/components/admin/scoring-health/skill-distribution-panel.tsx` | Section 9 — skill bars + funnel + tier usage | ~280       |
| `src/app/api/admin/scoring-health/skill-dist/route.ts`             | API: skill distribution data                 | ~80        |
| `src/__tests__/admin/skill-distribution.test.ts`                   | Tests for percentage computation             | ~50        |

### Verification

```powershell
# Run at repo root: C:\Users\Proma\Projects\promagen
pnpm run typecheck
pnpm test -- --testPathPattern="skill-distribution" --verbose
```

---

## 10. Part 7.11g — 🆕 Anomaly Alert System

### What It Is

A persistent, auto-refreshing alert banner pinned to the top of the scoring health page. It continuously monitors all pipeline dimensions and surfaces critical issues the admin needs to act on — so they don't have to manually check each section.

**The admin experience:** Open `/admin/scoring-health`, and the first thing you see is either "All systems healthy" (green) or "3 issues need attention" (amber/red) with expandable detail cards.

### Design

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ⚠️ 3 ANOMALIES DETECTED                            Last check: 45s ago │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│ 🔴 CRITICAL: Correlation dropped 12% in 48 hours (0.68 → 0.60)         │
│    └─ Likely cause: Weight recalibration on Feb 28 shifted coherence    │
│    └─ Recommendation: Review weight drift section, consider rollback    │
│    └─ [Jump to Weight Drift ↓]  [Acknowledge]                          │
│                                                                          │
│ 🟡 WARNING: Trending data stale (52h since last cron)                   │
│    └─ Expected: Every 24h │ Last success: Feb 27 03:14 UTC              │
│    └─ [Jump to Temporal ↓]  [Acknowledge]                               │
│                                                                          │
│ 🟡 WARNING: 3 new high-severity anti-patterns detected                  │
│    └─ "oil painting" + "digital art" (847 occurrences, -23% quality)    │
│    └─ [Jump to Anti-Patterns ↓]  [Acknowledge]                          │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Anomaly Thresholds

| Anomaly                       | Severity                                                                | Threshold                  |
| ----------------------------- | ----------------------------------------------------------------------- | -------------------------- |
| Correlation drop (48h window) | 🔴 CRITICAL if > 10%, 🟡 WARNING if > 5%                                | Computed from overview API |
| Stale pipeline data           | 🔴 CRITICAL if any channel > 72h, 🟡 WARNING if > 36h                   | From temporal freshness    |
| Anti-pattern spike            | 🟡 WARNING if new high-severity detected since last check               | From anti-patterns API     |
| A/B test at significance      | 🟢 INFO — a test has reached statistical significance and awaits action | From A/B tests API         |
| Feedback satisfaction drop    | 🟡 WARNING if platform 👍 rate drops > 10% in 7 days                    | From feedback API          |
| Cron failure                  | 🔴 CRITICAL if last cron failed                                         | From overview API          |
| Weight divergence             | 🟡 WARNING if any tier's weights diverge > 50% from global baseline     | From tier weights API      |

### Files Created

| File                                                           | Purpose                                           | Est. Lines |
| -------------------------------------------------------------- | ------------------------------------------------- | ---------- |
| `src/components/admin/scoring-health/anomaly-alert-banner.tsx` | Sticky alert banner with expand/acknowledge       | ~400       |
| `src/lib/admin/anomaly-thresholds.ts`                          | Threshold constants + evaluation functions (pure) | ~150       |
| `src/app/api/admin/scoring-health/anomalies/route.ts`          | API: aggregates all sources, evaluates thresholds | ~180       |
| `src/__tests__/admin/anomaly-thresholds.test.ts`               | Tests for threshold evaluation logic              | ~120       |

### Why This Is Next-Level

Without this, the admin has to manually scroll through 10 sections every time they check the dashboard. With this, the dashboard **tells the admin what's wrong** the moment they open it. It's the difference between a dashboard you read and a dashboard that talks to you.

### Verification

```powershell
# Run at repo root: C:\Users\Proma\Projects\promagen
pnpm run typecheck
pnpm test -- --testPathPattern="anomaly" --verbose
```

**What "good" looks like:**

- Banner appears at top of scoring health page
- If no anomalies: green "All Systems Healthy" bar
- If anomalies: amber/red bar with expandable cards
- "Jump to" links scroll to the relevant section (smooth scroll)
- "Acknowledge" removes the alert from the banner (session-only, reappears on reload if issue persists)
- Auto-refreshes every 60 seconds (more frequent than sections)

---

## 11. Part 7.11h — 🆕 Weight Tuning Sandbox

### What It Is

An interactive "what-if" mode where the admin can adjust scoring weights manually, see the simulated impact on a sample of recent prompts in real-time, then either promote the new weights to production or discard the changes.

**The admin experience:** Click "Open Sandbox" in the Weight Drift section → A modal overlay appears with weight sliders on the left and a live preview of prompt re-scoring on the right. Adjust a slider → the preview table instantly re-computes scores showing how the top 20 recent prompts would be re-ranked.

### Design

```
┌──────────────────────────────────────────────────────────────────────────┐
│  🧪 WEIGHT TUNING SANDBOX                          [Discard] [Promote] │
├─────────────────────────────────┬────────────────────────────────────────┤
│                                 │                                        │
│  WEIGHT ADJUSTERS               │  SIMULATED IMPACT (20 recent prompts) │
│                                 │                                        │
│  coherence      [===●=====] 0.35│  # │ Prompt (truncated)  │ Old  │ New │
│  categoryCount  [●=========] 0.08│  1 │ "cyberpunk hacker…" │ 0.82 │ 0.91│
│  tierFormat     [==●=======] 0.17│  2 │ "oil painting of…"  │ 0.78 │ 0.65│
│  promptLength   [==●=======] 0.18│  3 │ "golden hour…"      │ 0.75 │ 0.88│
│  fidelityTerms  [===●=====] 0.22│  ...                                  │
│                                 │                                        │
│  Tier: [All ▾]                  │  Avg score change: +0.04              │
│  [Reset to Current]             │  Rank changes: 8 of 20 moved          │
│                                 │  Predicted correlation: 0.71 (+0.03)  │
│                                 │                                        │
│  ⚡ DIFF VIEW:                   │                                       │
│  coherence:  0.35 → 0.40 (+14%) │                                       │
│  categoryC:  0.08 → 0.05 (-38%) │                                       │
│                                 │                                        │
├─────────────────────────────────┴────────────────────────────────────────┤
│  ⚠️ Promoting will update scoring-weights.json and trigger recalibration │
│  This action is logged and reversible via weight history.                │
│                                               [Cancel] [✅ Promote Now] │
└──────────────────────────────────────────────────────────────────────────┘
```

### Implementation Details

- **Sliders:** Range inputs with `clamp()` sizing. Each slider maps to a weight factor (0.00–1.00, step 0.01). Total weights normalised to 1.0 automatically.
- **Simulation:** Client-side re-scoring using the same scoring formula from `src/lib/learning/scoring-engine.ts`. No server round-trip for preview — the formula is pure, so it runs in the browser.
- **Promote action:** POST to `/api/admin/scoring-health/simulate-weights` with the new weight vector. Server validates, writes to `scoring-weights.json`, logs the change, and triggers recalibration cron.
- **Diff view:** Side-by-side showing old → new for each changed weight.
- **Per-tier mode:** Dropdown to scope adjustments to a specific tier (Tier 1/2/3/4 or All).

### Files Created

| File                                                            | Purpose                                               | Est. Lines |
| --------------------------------------------------------------- | ----------------------------------------------------- | ---------- |
| `src/components/admin/scoring-health/weight-tuning-sandbox.tsx` | Modal with sliders + live preview                     | ~500       |
| `src/lib/admin/weight-simulator.ts`                             | Client-side re-scoring logic (mirrors scoring-engine) | ~150       |
| `src/app/api/admin/scoring-health/simulate-weights/route.ts`    | API: POST to promote weights                          | ~120       |
| `src/__tests__/admin/weight-simulator.test.ts`                  | Tests for simulation accuracy                         | ~100       |

### Why This Is Next-Level

Currently, weight changes only happen via the automated recalibration cron. The admin has zero ability to intervene manually. This gives the admin a "steering wheel" — they can see the effect of a change before committing it, and they can course-correct when the automation gets it wrong. It's the difference between autopilot-only and autopilot-with-override.

### Verification

```powershell
# Run at repo root: C:\Users\Proma\Projects\promagen
pnpm run typecheck
pnpm test -- --testPathPattern="weight-simulator\|weight-tuning" --verbose
```

**What "good" looks like:**

- Open Sandbox → modal appears over the scoring health page
- Move a slider → preview table re-computes instantly (< 16ms)
- Total weights always normalise to 1.0
- Diff view shows only changed weights
- "Promote Now" requires confirmation dialog
- "Discard" closes modal with no side effects

---

## 12. Part 7.11i — 🆕 Pipeline Dependency Graph

### What It Is

A visual directed acyclic graph (DAG) showing how all 10 learning dimensions connect, their current health status, and the data flow between them. Click any node to see its health, data freshness, data volume, and downstream impact.

**The admin experience:** A visual map of the entire scoring intelligence system. At a glance, see which dimensions are healthy (green nodes), which are stale (amber), and which are down (red). Understand how a problem in one dimension cascades to others.

### Design

```
┌──────────────────────────────────────────────────────────────────────────┐
│  PIPELINE DEPENDENCY GRAPH                                 ⟳ 5 min     │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐     ┌──────────────┐     ┌────────────────┐           │
│  │ 🟢 Telemetry │────▶│ 🟢 Co-occur  │────▶│ 🟢 Weight      │           │
│  │ (12,847 evts)│     │ (matrix)     │     │ Recalibration  │           │
│  └──────┬──────┘     └──────┬───────┘     └───────┬────────┘           │
│         │                   │                      │                     │
│         ▼                   ▼                      ▼                     │
│  ┌──────────────┐   ┌──────────────┐     ┌────────────────┐            │
│  │ 🟢 Iteration  │   │ 🟡 Negative   │     │ 🟢 A/B Testing  │           │
│  │ Tracking      │   │ Patterns      │     │ (3 active)     │           │
│  └──────────────┘   │ (stale: 52h)  │     └────────────────┘           │
│                      └──────────────┘                                    │
│         │                                          │                     │
│         ▼                                          ▼                     │
│  ┌──────────────┐   ┌──────────────┐     ┌────────────────┐            │
│  │ 🟢 Skill Seg  │   │ 🟢 Temporal   │     │ 🟢 Compression  │           │
│  │ (1,847 users) │   │ (fresh)      │     │ (4 profiles)   │           │
│  └──────────────┘   └──────────────┘     └────────────────┘            │
│                                                                          │
│  ┌──────────────┐   ┌──────────────┐     ┌────────────────┐            │
│  │ 🟢 Feedback   │   │ 🟢 Platform   │     │ 🟢 Redundancy   │           │
│  │ (2,847 resp) │   │ Learning      │     │ Detection      │           │
│  └──────────────┘   └──────────────┘     └────────────────┘            │
│                                                                          │
│  Legend: 🟢 Healthy  🟡 Stale/Warning  🔴 Down/Critical               │
│                                                                          │
│  [Click any node for details]                                            │
├──────────────────────────────────────────────────────────────────────────┤
│  SELECTED: Negative Patterns (7.1)                                       │
│  Status: 🟡 Stale — last updated 52h ago (threshold: 36h)               │
│  Data volume: 12 collision pairs, 847 occurrences tracked                │
│  Downstream: Feeds → Weight Recalibration, A/B Testing                   │
│  Impact if down: Collision pairs stop updating, weights miss anti-data   │
│  [Jump to Anti-Pattern Alerts ↓]                                         │
└──────────────────────────────────────────────────────────────────────────┘
```

### Implementation

- **Layout:** CSS Grid for node positioning. Nodes are positioned in a 3×4 grid with connection lines drawn using CSS borders/pseudo-elements. No canvas, no SVG library — pure CSS.
- **Connections:** Each node knows its upstream/downstream dependencies (defined in a static dependency map). Lines are CSS `::after` pseudo-elements with `border` styling.
- **Node colours:** Driven by the same health data that feeds the Anomaly Alert System. Green (healthy), amber (stale/warning), red (critical/down).
- **Click interaction:** Clicking a node opens a detail panel below the graph showing status, data volume, downstream dependencies, and impact assessment.
- **Dependency map** (static, defined in types file):

```typescript
const PIPELINE_DEPENDENCIES: Record<string, { upstream: string[]; downstream: string[] }> = {
  telemetry: { upstream: [], downstream: ['co-occurrence', 'iteration', 'skill-seg', 'feedback'] },
  'co-occurrence': { upstream: ['telemetry'], downstream: ['weight-recal', 'negative-patterns'] },
  'negative-patterns': { upstream: ['co-occurrence'], downstream: ['weight-recal', 'ab-testing'] },
  iteration: { upstream: ['telemetry'], downstream: ['skill-seg'] },
  'weight-recal': {
    upstream: ['co-occurrence', 'negative-patterns'],
    downstream: ['ab-testing', 'compression'],
  },
  'ab-testing': { upstream: ['weight-recal', 'negative-patterns'], downstream: [] },
  'skill-seg': { upstream: ['telemetry', 'iteration'], downstream: [] },
  temporal: { upstream: [], downstream: ['compression'] },
  compression: { upstream: ['weight-recal', 'temporal'], downstream: [] },
  platform: { upstream: ['telemetry'], downstream: [] },
  redundancy: { upstream: [], downstream: [] },
  feedback: { upstream: ['telemetry'], downstream: [] },
};
```

### Files Created

| File                                                                | Purpose                                    | Est. Lines |
| ------------------------------------------------------------------- | ------------------------------------------ | ---------- |
| `src/components/admin/scoring-health/pipeline-dependency-graph.tsx` | Visual DAG with clickable nodes            | ~450       |
| `src/lib/admin/pipeline-dependencies.ts`                            | Static dependency map + health evaluation  | ~100       |
| `src/app/api/admin/scoring-health/pipeline-status/route.ts`         | API: aggregates health from all sources    | ~140       |
| `src/__tests__/admin/pipeline-dependencies.test.ts`                 | Tests for dependency resolution and health | ~80        |

### Why This Is Next-Level

The scoring system has 10 learning dimensions that feed into each other. Without this graph, the admin has to hold the entire dependency chain in their head. With it, they can see the system as a living organism — which parts are healthy, which are struggling, and how problems propagate. When something goes wrong, the graph shows you not just where the problem is, but what else it will break.

### Verification

```powershell
# Run at repo root: C:\Users\Proma\Projects\promagen
pnpm run typecheck
pnpm test -- --testPathPattern="pipeline-depend" --verbose
```

**What "good" looks like:**

- Graph renders with all 10+ nodes positioned in a readable layout
- Connection lines visible between dependent nodes
- Node colours match actual health status
- Clicking a node reveals detail panel below
- "Jump to" links navigate to the relevant dashboard section
- Graph is responsive — nodes and lines scale with viewport

---

## 13. File Impact Map

### New Files (29 total)

```
src/
├── app/
│   └── admin/
│       └── scoring-health/
│           ├── page.tsx                              (server component)
│           └── scoring-health-client.tsx              (client shell)
├── components/
│   └── admin/
│       └── scoring-health/
│           ├── scorer-health-overview.tsx             (Section 1)
│           ├── scoring-health-nav.tsx                 (sidebar nav)
│           ├── css-sparkline.tsx                      (reusable sparkline)
│           ├── weight-drift-chart.tsx                 (Section 2)
│           ├── tier-models-heatmap.tsx                (Section 3)
│           ├── term-quality-leaderboard.tsx           (Section 4)
│           ├── anti-pattern-alerts.tsx                (Section 5)
│           ├── ab-test-section.tsx                    (Section 6 wrapper)
│           ├── temporal-trends-panel.tsx              (Section 8)
│           ├── skill-distribution-panel.tsx           (Section 9)
│           ├── feedback-summary-panel.tsx             (Section 10)
│           ├── anomaly-alert-banner.tsx               (🆕 7.11g)
│           ├── weight-tuning-sandbox.tsx              (🆕 7.11h)
│           └── pipeline-dependency-graph.tsx          (🆕 7.11i)
├── lib/
│   └── admin/
│       ├── scoring-health-types.ts                   (shared types)
│       ├── anomaly-thresholds.ts                     (🆕 threshold constants)
│       ├── weight-simulator.ts                       (🆕 client-side scorer)
│       └── pipeline-dependencies.ts                  (🆕 static DAG map)
├── app/
│   └── api/
│       └── admin/
│           └── scoring-health/
│               ├── overview/route.ts
│               ├── weight-history/route.ts
│               ├── tier-weights/route.ts
│               ├── term-quality/route.ts
│               ├── anti-patterns/route.ts
│               ├── ab-tests/route.ts
│               ├── temporal/route.ts
│               ├── skill-dist/route.ts
│               ├── feedback/route.ts
│               ├── anomalies/route.ts                (🆕 7.11g)
│               ├── simulate-weights/route.ts         (🆕 7.11h)
│               └── pipeline-status/route.ts          (🆕 7.11i)
└── __tests__/
    └── admin/
        ├── scoring-health-overview.test.ts
        ├── weight-drift-chart.test.ts
        ├── term-quality-leaderboard.test.ts
        ├── anti-pattern-alerts.test.ts
        ├── feedback-summary.test.ts
        ├── skill-distribution.test.ts
        ├── anomaly-thresholds.test.ts                (🆕 7.11g)
        ├── weight-simulator.test.ts                  (🆕 7.11h)
        └── pipeline-dependencies.test.ts             (🆕 7.11i)
```

### Modified Files (2 total)

| File                          | Change                                   |
| ----------------------------- | ---------------------------------------- |
| `src/app/admin/admin-nav.tsx` | Add "Scoring Health" to NAV_LINKS array  |
| `src/app/admin/page.tsx`      | Add "Scoring Health" card to TOOLS array |

---

## 14. API Routes Required

All API routes:

- Live under `/api/admin/scoring-health/`
- Require admin auth check (Clerk `auth()` + admin role verification)
- Return JSON with consistent shape: `{ data: T, generatedAt: string, error?: string }`
- Use GET for read-only data, POST only for mutations (simulate-weights promote action)
- Include proper `Cache-Control` headers (no caching for admin data)

| Route               | Method | Returns                                                     |
| ------------------- | ------ | ----------------------------------------------------------- |
| `/overview`         | GET    | Correlation, total prompts, active tests, last cron, uptime |
| `/weight-history`   | GET    | Array of weight snapshots with timestamps (90 days)         |
| `/tier-weights`     | GET    | Current weights per tier (4 objects)                        |
| `/term-quality`     | GET    | Paginated term quality scores with category/tier filters    |
| `/anti-patterns`    | GET    | Detected anti-patterns grouped by severity                  |
| `/ab-tests`         | GET    | Current + historical test results                           |
| `/temporal`         | GET    | Trending terms + seasonal patterns + freshness              |
| `/skill-dist`       | GET    | User skill distribution + graduation funnel                 |
| `/feedback`         | GET    | Feedback distribution + per-platform satisfaction           |
| `/anomalies`        | GET    | Evaluated anomalies against thresholds                      |
| `/simulate-weights` | POST   | Validate and promote new weight vector                      |
| `/pipeline-status`  | GET    | Health status for all pipeline nodes                        |

---

## 15. Testing Strategy

### Unit Tests (Pure Logic)

| Test File                          | What It Tests                                              | Est. Cases |
| ---------------------------------- | ---------------------------------------------------------- | ---------- |
| `scoring-health-overview.test.ts`  | Sparkline data normalisation, trend computation            | 8          |
| `weight-drift-chart.test.ts`       | Drift percentage calculation, biggest mover detection      | 6          |
| `term-quality-leaderboard.test.ts` | Sorting, filtering, search matching                        | 10         |
| `anti-pattern-alerts.test.ts`      | Severity grouping, suppress/dismiss state                  | 8          |
| `feedback-summary.test.ts`         | Distribution percentages, per-platform ranking             | 6          |
| `skill-distribution.test.ts`       | Percentage computation, funnel metrics                     | 5          |
| `anomaly-thresholds.test.ts`       | All 7 threshold evaluations (boundary cases)               | 14         |
| `weight-simulator.test.ts`         | Re-scoring accuracy, normalisation, diff computation       | 12         |
| `pipeline-dependencies.test.ts`    | Dependency resolution, cycle detection, health propagation | 10         |

**Total: ~79 test cases**

### Manual QA Checklist

Each build part includes a checklist:

- [ ] All text uses `clamp()` — resize window from 1024px to 2560px, verify scaling
- [ ] No console errors or warnings
- [ ] API routes return 401 for unauthenticated requests
- [ ] Data refreshes at specified intervals
- [ ] Section nav highlights correct section on scroll
- [ ] Dark theme consistent with existing admin pages
- [ ] Performance: page interactive within 2 seconds on 3G throttle

---

## 16. Verification Checklist

### Per-Part Verification (copy-paste into every build)

```powershell
# Run at repo root: C:\Users\Proma\Projects\promagen
pnpm run typecheck
pnpm test -- --testPathPattern="scoring-health\|anomaly\|weight-simulator\|pipeline-depend" --verbose
```

### Full Phase 7.11 Verification (run after all parts complete)

```powershell
# Run at repo root: C:\Users\Proma\Projects\promagen
pnpm run check
pnpm test -- --testPathPattern="admin" --verbose
```

### What "Good" Looks Like (Phase Complete)

1. `/admin/scoring-health` loads within the existing admin layout
2. Sticky sidebar nav lists all 10+ sections with active highlighting
3. All 9 dashboard sections render with real or gracefully-degraded data
4. 🆕 Anomaly Alert Banner shows at top — green if healthy, amber/red if issues
5. 🆕 Weight Tuning Sandbox opens as modal, sliders re-score in < 16ms
6. 🆕 Pipeline Dependency Graph shows all nodes with correct health colours
7. All text and spacing uses `clamp()` — fluid from 1024px to 4K
8. Zero TypeScript errors, zero console noise
9. ~79 new test cases all passing
10. Admin nav shows "Scoring Health" link with active state when on page

---

## Improvement Ideas (Not Implemented — For Future Consideration)

1. **Export to PDF** — One-click export of the entire scoring health dashboard as a printable PDF report. Useful for stakeholder reviews or archiving weekly snapshots.

2. **Webhooks / Slack Integration** — Send anomaly alerts to a Slack channel or webhook URL. Admin doesn't even need to open the dashboard — critical issues come to them.

3. **Time-Travel Mode** — Replay the dashboard state at any historical point. "What did our scoring system look like 30 days ago?" Useful for post-mortem analysis when something goes wrong.

---

_End of document. Version 1.0.0. Created 2026-03-01._
