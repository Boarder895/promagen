# Promagen Architecture Overview

> **30-Second Guide** | Start here to understand Promagen's full architecture
> **Location:** `docs/authority/architecture.md`
> **Version:** 4.0.0
> **Last updated:** 28 April 2026

---

## What Promagen Is

**As of v4.0.0 (commercial repositioning):** Promagen is an **AI Platform Intelligence and AI Visibility Intelligence** business. The headline product is **Sentinel** — a monitoring and audit service that tells operators whether AI systems can find, read, cite and send traffic to their content. Promagen runs Sentinel against itself as the live case study, and underneath sits a deep platform-intelligence layer covering 40 AI image generators.

**Commercial hierarchy (v4.0.0+):**

1. **Sentinel** — the main commercial product (audits, fix sprints, monitoring retainers). Public landing at `/sentinel`. Internal weekly digest dashboard at `/admin/sentinel`.
2. **Platform intelligence** — the 40-platform hub, leaderboard, comparisons, use-case guides, methodology page. Authority assets that serve traffic, build trust, and feed Sentinel.
3. **The Lab (Prompt Lab + Standard Builder)** — supporting layer. Demonstrates depth, captures email, drives engagement. **Demoted from primary commercial position** in v4.0.0; it remains technically intact and accessible at `/prompt-lab`, `/providers/[id]`, and `/studio/library`.

The **Prompt Lab** itself remains a sophisticated piece of engineering (3-call AI engine, 40 builder files, 4-tier prompt generation) and is preserved verbatim — only its commercial framing changes. See `commercial-positioning.md` for the canonical positioning rules.

The platform also maintains a **live AI provider leaderboard** with Elo-style Index Ratings, a **market data layer** (FX, indices, commodities, weather) served via a Fly.io gateway, and a **Builder Quality Intelligence** system for internal regression testing.

**Codebase stats (6 Apr 2026):** 110 API routes, 37 pages, 249 components, 43 hooks, 158 test files, 40 platforms, 40 Call 3 builder files (25 NL + 15 CLIP/format).

---

## Page Map

Every page uses `HomepageGrid` — a three-column layout (left rail, centre, right rail) with Engine Bay and Mission Control CTAs.

| Route                | Purpose                                          | Left Rail                                                  | Centre                                                               | Right Rail                                                 | Finance Ribbon |
| -------------------- | ------------------------------------------------ | ---------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------- | -------------- |
| `/`                  | **Homepage** — Sentinel-led commercial shell wrapping Inspire grid | SceneStartersPreview                                       | Sentinel hero + pillars + proof + intelligence band + PromptShowcase + ProvidersTable + authority band + CTA | CommunityPulse                                             | **No**         |
| `/sentinel`          | **Sentinel product page** — public landing       | —                                                          | Hero + pillars + proof + offer stack + deliverables + CTA            | —                                                          | **No**         |
| `/admin/sentinel`    | Sentinel weekly digest dashboard (internal)      | —                                                          | SentinelDashboard                                                    | —                                                          | **No**         |
| `/prompt-lab`        | **The Lab** — supporting role (was core product) | LeaderboardRail (40 platforms, Index Ratings, demo jitter) | PlaygroundWorkspace (Call 1→2→3 flow)                                | PipelineXRay (Glass Case: Decoder, Switchboard, Alignment) | **No**         |
| `/providers/[id]`    | Provider detail + standard builder               | Exchange rails                                             | PromptBuilder (One Brain)                                            | Exchange rails                                             | **No**         |
| `/world-context`     | Old homepage relocated — financial data          | Exchange rails                                             | ProvidersTable                                                       | Exchange rails                                             | **Yes**        |
| `/pro-promagen`      | Pro tier purchase page                           | —                                                          | Feature comparison, tier showcase                                    | —                                                          | **No**         |
| `/studio/library`    | Saved prompts                                    | —                                                          | SavedPromptsLibrary                                                  | —                                                          | **No**         |
| `/providers/leaderboard` | Full-page AI leaderboard                     | —                                                          | ProvidersTable (expanded)                                            | —                                                          | **No**         |
| `/admin/*`           | Admin pages                                      | —                                                          | Sentinel digest, Builder quality, exchanges, providers, scoring health, vocab, scenes | —                                                          | **No**         |

The finance ribbon (FX pairs) only shows on `/world-context`. All other pages set `showFinanceRibbon={false}`.

---

## Architecture Layers

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         PROMAGEN ARCHITECTURE                            │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  LAYER 1: FRONTEND (Vercel, Next.js, TypeScript)                        │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ /studio/playground ── PROMPT LAB (core product)                   │  │
│  │   Left:   LeaderboardRail (40 providers, Index Ratings)           │  │
│  │   Centre: PlaygroundWorkspace + EEP (Call 1→2→3)                  │  │
│  │   Right:  PipelineXRay Glass Case (Decoder→Switchboard→Alignment) │  │
│  ├────────────────────────────────────────────────────────────────────┤  │
│  │ / ── HOMEPAGE (prompt-focused)                                     │  │
│  │   Left:   SceneStartersPreview (200 scenes)                       │  │
│  │   Centre: PromptShowcase + ProvidersTable (leaderboard)            │  │
│  │   Right:  CommunityPulse (live feed)                               │  │
│  ├────────────────────────────────────────────────────────────────────┤  │
│  │ /world-context ── MARKET DATA (old homepage, finance ribbon)       │  │
│  │ /providers/[id] ── PROVIDER DETAIL + STANDARD BUILDER              │  │
│  │ /pro-promagen ── PRO TIER PURCHASE                                 │  │
│  │ /admin/* ── INTERNAL ADMIN (7 pages)                               │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  LAYER 2: AI ENGINE (OpenAI GPT-5.4-mini)                               │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ Call 1: /api/parse-sentence (455 lines, temp 0.15)                │  │
│  │   → Category assessment: what's in the user's text                │  │
│  │ Call 2: /api/generate-tier-prompts (650 lines, temp 0.5)          │  │
│  │   → 4-tier prompt generation (T1 CLIP, T2 MJ, T3 NL, T4 Plain)  │  │
│  │   → Post-processing: P1–P12 pipeline (harmony-post-processing)   │  │
│  │ Call 3: /api/optimise-prompt (651 lines, temp 0.4/0.2)            │  │
│  │   → Platform-specific optimisation via 40 builder files           │  │
│  │   → Prose groups: 0.4 temp. CLIP groups: 0.2 temp.               │  │
│  │ Score: /api/score-prompt (BQI internal only, not user-facing)     │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  LAYER 3: MARKET DATA GATEWAY (Fly.io)                                   │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ FX: TwelveData (800/day, cached 30min, :00/:30)                   │  │
│  │ Indices: Marketstack (3333/day shared, 2hr cache, :05/:20/:35/:50)│  │
│  │ Commodities: Marketstack v2 (1K/day cap, rolling 5-min)           │  │
│  │ Weather: OpenWeatherMap (1K/day, 5min cache, :10/:40)             │  │
│  │ All feeds LIVE. Fallback returns null (renders "—"). No demo.     │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  LAYER 4: CRON JOBS (Vercel Cron, 3 scheduled tasks)                     │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ Promagen Users: /api/promagen-users/cron (every 30 min)           │  │
│  │   → Aggregates country usage per provider from activity events    │  │
│  │ Index Rating: /api/index-rating/cron (daily 00:05 UTC)            │  │
│  │   → Elo-style rating calculation, MPI handicapping, rank changes  │  │
│  │ Rankings: /api/cron/rankings (every hour)                          │  │
│  │   → Bayesian vote-based rankings → KV storage                     │  │
│  │ Auth: Authorization: Bearer + custom headers + query param        │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  LAYER 5: EVENT TRACKING                                                  │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ POST /api/events/track — 12 event types                           │  │
│  │ Outbound clicks: /go/[providerId] → provider_activity_events      │  │
│  │ Country detection: x-vercel-ip-country header                     │  │
│  │ Feeds: Promagen Users cron + Index Rating cron                    │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  LAYER 6: AUTH + PAYMENTS                                                 │
│  ┌────────────────┬─────────────────┬────────────────────────────────┐  │
│  │ Clerk (Auth)   │ Stripe (Pay)    │ Tier structure:                │  │
│  │ Sign-in/up     │ Pro subscription│ Anonymous: 3 prompts/day       │  │
│  │ Session mgmt   │ Checkout/portal │ Signed-in free: 5 prompts/day  │  │
│  │ User identity  │ Webhook events  │ Pro: unlimited                 │  │
│  └────────────────┴─────────────────┴────────────────────────────────┘  │
│                                                                          │
│  LAYER 7: DATABASE                                                        │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ Postgres (Neon): 13 tables                                        │  │
│  │   provider_activity_events, provider_country_usage_30d,           │  │
│  │   promagen_users_cron_runs, provider_ratings,                     │  │
│  │   index_rating_cron_runs, builder_quality_runs,                   │  │
│  │   builder_quality_results, prompt_events, learned_weights,        │  │
│  │   learning_cron_runs, ab_tests, feedback_events,                  │  │
│  │   prompt_showcase_entries                                          │  │
│  │ Vercel KV: Vote rankings (Bayesian), heartbeat/online data        │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  LAYER 8: BUILDER QUALITY INTELLIGENCE (Internal)                        │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ 8 core + 2 holdout test scenes, frozen Call 2 snapshots           │  │
│  │ Batch runner: scripts/builder-quality-run.ts (CLI)                │  │
│  │ GPT scorer + Claude scorer (dual-model, Anthropic API)            │  │
│  │ 4-gate validation harness: src/lib/validation/validate-builder.ts │  │
│  │ 3-layer aggregation: platform / scene / platform-scene            │  │
│  │ Admin dashboard: /admin/builder-quality                           │  │
│  │ First full batch: 319/320, mean 81.97, range 51–97                │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## AI Prompt Engine (Call 1 → 2 → 3)

The Prompt Lab uses a **split-brain architecture**: Claude writes system prompt rules at development time, GPT-5.4-mini executes them at runtime. Three server-side API calls power the flow:

| Call   | Route                        | Lines | Purpose                                                   | Temp                 |
| ------ | ---------------------------- | ----- | --------------------------------------------------------- | -------------------- |
| Call 1 | `/api/parse-sentence`        | 455   | Category assessment — 12 categories detected in user text | 0.15                 |
| Call 2 | `/api/generate-tier-prompts` | 650   | Generate 4 tier prompts (T1 CLIP, T2 MJ, T3 NL, T4 Plain) | 0.5                  |
| Call 3 | `/api/optimise-prompt`       | 651   | Platform-specific optimisation via 40 builder files       | 0.4 prose / 0.2 CLIP |
| Score  | `/api/score-prompt`          | —     | **BQI internal only** — killed as user-facing on 3 Apr    | 0.2                  |

**40 builder files** in `src/lib/optimise-prompts/`: 25 NL dedicated builders (`group-nl-*.ts`) + 15 CLIP/format/special builders. Each builder has a platform-specific system prompt. Call 3 routes to the correct builder via `resolveGroupPrompt()`.

**Post-processing pipeline** (Call 2 output only):

- `src/lib/harmony-post-processing.ts` (272 lines) — catches GPT mechanical artefacts
- `src/lib/optimise-prompts/harmony-post-processing.ts` (439 lines) — Call 3 specific
- `src/lib/harmony-compliance.ts` (833 lines) — deterministic syntax validation, provider-specific rules

**Platform SSOT:** `src/data/providers/platform-config.json` (40 platforms) + `src/data/providers/platform-config.ts` (adapter). Single truth for tier, maxChars, idealMin/idealMax, negative prompt mode, compression strategy, and all platform metadata.

**AI Disguise:** No user-facing string references "AI", "GPT", "OpenAI", or "LLM". All API calls are server-side. Users see "algorithms" and "Prompt Intelligence Engine."

---

## Prompt Lab UI Architecture

The Prompt Lab (`/studio/playground`) is a three-column layout:

**Left rail — LeaderboardRail** (`src/components/prompt-lab/leaderboard-rail.tsx`):
Mini leaderboard table showing all 40 platforms ranked by Index Rating. 3 columns (Provider, Support, Index Rating). Top 10 default, expandable. Demo jitter ±1–3 every 45s. Clicking a provider selects it for optimisation in the centre.

**Centre — PlaygroundWorkspace** (`src/components/prompts/playground-workspace.tsx`):
The main prompt building interface. Text input, category assessment display, tier generation, platform-specific optimisation. Enhanced Educational Preview (EEP) shows the assembled and optimised prompts.

**Right rail — PipelineXRay** (`src/components/prompt-lab/pipeline-xray.tsx`):
"The Glass Case" — WWII Bletchley Park aesthetic. Three animated sections visualising the pipeline:

- **The Decoder:** 12 category rotors showing Call 1 assessment results
- **The Switchboard:** 4 tier bars with split-flap word counts from Call 2
- **The Alignment:** Platform-specific optimisation gauge from Call 3

Orange continuous border around the entire unit. Co-located animations. prefers-reduced-motion respected.

---

## Prompt Assembly Pipeline (Standard Builder)

The standard builder (`/providers/[id]`) uses a client-side prompt assembly pipeline:

| Component    | File                                     | Purpose                                                               |
| ------------ | ---------------------------------------- | --------------------------------------------------------------------- |
| One Brain    | `src/lib/prompt-builder.ts`              | Single `assemblePrompt()` function — all assembly routes through this |
| Optimizer    | `src/lib/prompt-optimizer.ts`            | 4-phase client-side optimisation                                      |
| Intelligence | `src/lib/prompt-builder/intelligence.ts` | Scoring, conflict detection, smart suggestions                        |

**One Brain rule:** All prompt assembly routes through `assemblePrompt()`. Never build parallel assembly paths.

---

## Market Data Gateway (Fly.io)

The gateway serves four live data feeds to `/world-context` and Engine Bay/Mission Control. Provider-based modular architecture.

| Feed        | Provider       | Daily Budget   | Cache TTL | Schedule           | Status  |
| ----------- | -------------- | -------------- | --------- | ------------------ | ------- |
| FX          | TwelveData     | 800            | 30 min    | :00, :30           | ✅ LIVE |
| Indices     | Marketstack    | 3,333 (shared) | 2 hours   | :05, :20, :35, :50 | ✅ LIVE |
| Commodities | Marketstack v2 | 1,000 cap      | 2 hours   | Rolling 5-min      | ✅ LIVE |
| Weather     | OpenWeatherMap | 1,000          | 5 min     | :10, :40           | ✅ LIVE |

**No demo prices.** Fallback returns `price: null`, frontend renders "—".

Weather data also feeds the Prompt Lab's weather/atmosphere system and the homepage Prompt of the Moment (POTM) via SSR.

> **Deep dive:** `fly-v2.md`, `gateway-refactor.md`, `api-calming-efficiency.md`, `commodities.md`

---

## Cron Jobs (Vercel Cron)

3 scheduled jobs, all authenticated via `Authorization: Bearer <PROMAGEN_CRON_SECRET>`:

| Job            | Path                       | Schedule        | Storage  | Purpose                               |
| -------------- | -------------------------- | --------------- | -------- | ------------------------------------- |
| Promagen Users | `/api/promagen-users/cron` | Every 30 min    | Postgres | Aggregate country usage per provider  |
| Index Rating   | `/api/index-rating/cron`   | Daily 00:05 UTC | Postgres | Elo rating calculation + rank changes |
| Rankings       | `/api/cron/rankings`       | Every hour      | KV       | Bayesian vote-based rankings          |

12 event types tracked via `POST /api/events/track`, stored in `provider_activity_events`.

> **Deep dive:** `cron_jobs.md` v2.0.0

---

## Builder Quality Intelligence (Internal)

Regression testing system for the Call 3 prompt optimisation pipeline. Not user-facing.

**Test library:** 8 core + 2 holdout scenes in `src/data/scoring/`. Holdout scenes never shared with ChatGPT or used during builder tuning.

**Pipeline:** Frozen Call 2 snapshots → Call 3 builder → GPT/Claude scoring → 4-gate validation (anchor preservation, banned content, char count, length preservation) → 3-layer aggregation (platform/scene/platform-scene).

**Admin dashboard:** `/admin/builder-quality` — platform overview table, per-platform detail with scene-level results.

**First full batch:** Run ID `bqr-mnjhzihx-z5rilk`, 319/320 complete, mean 81.97, range 51–97. Scene 06 (negative trigger) and Scene 08 (French New Wave) weakest.

> **Deep dive:** `builder-quality-intelligence.md` v3.0.0, `builder-quality-build-plan.md`

---

## Auth + Payments

| Service  | Provider | Purpose                                           |
| -------- | -------- | ------------------------------------------------- |
| Auth     | Clerk    | Sign-in/up, session management, user identity     |
| Payments | Stripe   | Pro subscription checkout, portal, webhook events |

**Tier structure:** Anonymous (3 prompts/day, optimizer locked), signed-in free (5 prompts/day, optimizer unlocked), Pro (unlimited).

> **Deep dive:** `clerk-auth.md`, `stripe.md`, `paid_tier.md` v8.0.0

---

## Database

**Postgres (Neon)** — 13 tables:

| Table                        | Purpose                                                  | Written By                            |
| ---------------------------- | -------------------------------------------------------- | ------------------------------------- |
| `provider_activity_events`   | Raw engagement events (clicks, votes, Prompt Lab events) | `/go/[id]` route, `/api/events/track` |
| `provider_country_usage_30d` | Per-provider country aggregation                         | Promagen Users cron                   |
| `promagen_users_cron_runs`   | Cron run log                                             | Promagen Users cron                   |
| `provider_ratings`           | Elo Index Ratings per provider                           | Index Rating cron                     |
| `index_rating_cron_runs`     | Cron run log                                             | Index Rating cron                     |
| `builder_quality_runs`       | BQI batch run metadata                                   | Batch runner CLI                      |
| `builder_quality_results`    | BQI per-platform-per-scene results                       | Batch runner CLI                      |
| `prompt_events`              | Learning pipeline events                                 | Prompt builder                        |
| `learned_weights`            | Learned category weights                                 | Learning system                       |
| `learning_cron_runs`         | Learning cron run log                                    | Learning system                       |
| `ab_tests`                   | A/B test configuration                                   | Admin                                 |
| `feedback_events`            | User feedback                                            | Feedback system                       |
| `prompt_showcase_entries`    | POTM showcase entries                                    | Showcase system                       |

**Vercel KV:** Vote rankings (Bayesian scores), heartbeat/online user data, rate limiting.

---

## Key Dashboards

| System             | Dashboard                                |
| ------------------ | ---------------------------------------- |
| Frontend (Vercel)  | https://vercel.com/promagen              |
| Gateway (Fly.io)   | `fly status -a promagen-api`             |
| OpenAI (GPT)       | https://platform.openai.com/usage        |
| Anthropic (Claude) | https://console.anthropic.com            |
| Clerk (Auth)       | https://dashboard.clerk.com              |
| Stripe (Payments)  | https://dashboard.stripe.com             |
| TwelveData usage   | https://twelvedata.com/account/api-usage |
| Marketstack usage  | https://marketstack.com/dashboard        |
| OpenWeatherMap     | https://home.openweathermap.org/api_keys |

---

## Deep Dive Documents

| Topic                           | Document                                 |
| ------------------------------- | ---------------------------------------- |
| AI Intelligence Engine          | `ai-disguise.md`                         |
| Harmony Engineering             | `harmonizing-claude-openai.md`           |
| Prompt Lab v4 Flow              | `prompt-lab-v4-flow.md`                  |
| Prompt Lab (routes, components) | `prompt-lab.md`                          |
| Call 3 architecture             | `api-3.md`, `prompt-optimizer.md`        |
| Left rail (LeaderboardRail)     | `lefthand-rail.md` v2.0.0                |
| Right rail (Pipeline X-Ray)     | `righthand-rail.md`                      |
| Builder Quality Intelligence    | `builder-quality-intelligence.md` v3.0.0 |
| Cron Jobs                       | `cron_jobs.md` v2.0.0                    |
| One Brain assembly              | `unified-prompt-brain.md`                |
| Gateway architecture            | `fly-v2.md`, `gateway-refactor.md`       |
| Calming techniques              | `api-calming-efficiency.md`              |
| Homepage                        | `homepage.md`                            |
| Free vs paid                    | `paid_tier.md` v8.0.0                    |
| Auth (Clerk)                    | `clerk-auth.md`                          |
| Payments (Stripe)               | `stripe.md`                              |
| Code standards                  | `code-standard.md`                       |
| Promagen Users demo             | `promagen-users-master.md` v4.0          |
| Index Rating system             | `index-rating.md`                        |

---

## Changelog

| Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-06 | **v3.0.0 — Complete rewrite from src.zip SSoT.** Homepage is prompt-focused (SceneStarters + PromptShowcase + CommunityPulse), not finance-focused. Financial data relocated to /world-context. Added: Prompt Lab UI architecture (LeaderboardRail, PipelineXRay Glass Case), BQI system (8 layers), cron jobs (3 scheduled tasks), event tracking (12 types), full database schema (13 Postgres tables + KV). Updated: AI Engine stats (Call 1 temp 0.15, Call 2 650 lines, Call 3 651 lines + 40 builders), codebase stats (110 routes, 37 pages, 249 components). Removed: stale "Current Feed Status" section (feeds still live but not the product focus). Added Anthropic dashboard to key contacts. |
| 2026-03-25 | v2.0.0 — Added AI Intelligence Engine, Auth (Clerk), Payments (Stripe), Prompt Assembly pipeline.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-02-07 | v1.1.0 — Full audit: Crypto removed, Commodities live, Weather added, timing stagger corrected.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-01-13 | v1.0.0 — Initial architecture overview.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

---

_This document is the entry point. For details, follow the deep dive links above. `src.zip` is the Single Source of Truth — this document describes what exists in code._

_**Key principles:**_

- _The product is AI image prompt optimisation. Financial data is a secondary feature._
- _NEVER use demo/synthetic prices. Fallback returns null, renders as "—"._
- _All prompt assembly routes through `assemblePrompt()` (One Brain). No parallel paths._
- _AI Disguise: no user-facing string references "AI", "GPT", "OpenAI", or "LLM"._
- _40 platforms, 40 builders, single truth in `platform-config.json`._
