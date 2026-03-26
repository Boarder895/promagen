# Promagen Architecture Overview

> **30-Second Guide** | Start here to understand Promagen's full architecture  
> **Location:** `docs/authority/ARCHITECTURE.md`  
> **Last updated:** 25 March 2026 — Added AI Intelligence Engine, Auth (Clerk), Payments (Stripe), Prompt Assembly pipeline

---

## The Big Picture

Promagen has **five architectural layers**: live financial data (four feeds), a **prompt intelligence engine** (AI-powered text→image prompt generation), a **prompt assembly pipeline** (One Brain), **authentication** (Clerk), and **payments** (Stripe). The data feeds are served through a **three-layer calming architecture** with **provider-based gateway modules**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PROMAGEN ARCHITECTURE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   USER BROWSER                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  FX Ribbon    │  Exchange Cards  │  Commodities   │  Weather       │   │
│   │  (8 pairs)    │  (16 exchanges)  │  (7 windows)   │  (48 cities)   │   │
│   │  ✅ LIVE      │  ✅ LIVE         │  ✅ LIVE       │  ✅ LIVE       │   │
│   ├─────────────────────────────────────────────────────────────────────┤   │
│   │  Prompt Lab (/studio/playground)  │  Standard Builder (/providers) │   │
│   │  AI tier generation (Call 2)      │  One Brain assemblePrompt()    │   │
│   │  AI optimisation (Call 3)         │  Client-side optimizer         │   │
│   │  ✅ LIVE (Pro only)              │  ✅ LIVE (all users)           │   │
│   └───────┬───────┬────────┬─────────┬───────┬────────┬────────┬──────┘   │
│           │       │        │         │       │        │        │          │
│   LAYER 1: FRONTEND (Vercel, Next.js 16, TypeScript)                       │
│   ┌───────▼──┬────▼────┬───▼─────┬───▼───┬───▼──────┬─▼──────┬─▼──────┐   │
│   │ /api/fx  │/api/    │/api/    │/api/  │/api/     │/api/   │/api/   │   │
│   │          │indices  │commod.  │weather│generate- │optimise│parse-  │   │
│   │ :00,:30  │:05,:20  │rolling  │:10,:40│tier-     │-prompt │sentence│   │
│   │          │:35,:50  │5-min    │       │prompts   │        │        │   │
│   └────┬─────┴────┬────┴────┬────┴───┬───┴────┬─────┴───┬────┴────────┘   │
│        │          │         │        │        │         │                  │
│   LAYER 2a: GATEWAY (Fly.io) — MARKET DATA        │                       │
│   ┌────▼────┬─────▼─────────┬────▼───┐             │                       │
│   │12data/  │ marketstack/  │ owm/   │             │                       │
│   │FX only  │ IDX + COM     │Weather │             │                       │
│   │800/day  │ 3,333/day     │1K/day  │             │                       │
│   └─────────┴───────────────┴────────┘             │                       │
│                                                     │                       │
│   LAYER 2b: AI ENGINE (OpenAI) — PROMPT GENERATION  │                      │
│   ┌─────────────────────────────────────────────────▼──────────────────┐   │
│   │  GPT-5.4-mini (temp 0.5)          │  Post-Processing Pipeline     │   │
│   │  Call 1: Category assessment      │  P1–P12 (7 active functions)  │   │
│   │  Call 2: 4-tier prompt generation │  harmony-post-processing.ts   │   │
│   │  Call 3: Platform optimisation    │  harmony-compliance.ts        │   │
│   │  30 system prompt rules           │  115-test lockdown suite      │   │
│   └───────────────────────────────────┴───────────────────────────────┘   │
│                                                                             │
│   LAYER 3: AUTH + PAYMENTS + DATABASE                                      │
│   ┌─────────────────┬──────────────────┬──────────────────────────────┐   │
│   │ Clerk (Auth)    │ Stripe (Payments)│ Postgres (Vercel)            │   │
│   │ Sign-in/up      │ Pro subscription │ Learning pipeline, telemetry │   │
│   │ Session mgmt    │ Checkout/portal  │ Scoring, feedback, prompts   │   │
│   │ User identity   │ Webhook events   │ Usage tracking               │   │
│   └─────────────────┴──────────────────┴──────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Current Feed Status (Feb 7, 2026)

| Feed            | Status      | Provider       | Mode     | Data        |
| --------------- | ----------- | -------------- | -------- | ----------- |
| **FX**          | ✅ **LIVE** | TwelveData     | `cached` | Real prices |
| **Indices**     | ✅ **LIVE** | Marketstack    | `live`   | Real prices |
| **Commodities** | ✅ **LIVE** | Marketstack v2 | `live`   | Real prices |
| **Weather**     | ✅ **LIVE** | OpenWeatherMap | `cached` | Real data   |

> **Crypto** was removed entirely (no imports, no endpoint, no handler). TwelveData now serves FX only.

**Verification Command:**

```powershell
# All feeds returning data?
(Invoke-RestMethod "https://promagen-api.fly.dev/fx").meta.mode          # "cached" or "live"
(Invoke-RestMethod "https://promagen-api.fly.dev/indices").meta.mode     # "live"
(Invoke-RestMethod "https://promagen-api.fly.dev/commodities").meta.mode # "live" or "cached"
(Invoke-RestMethod "https://promagen-api.fly.dev/weather") | Select-Object -First 1  # has data
```

---

## Four Feeds at a Glance

| Feed            | Display               | Provider       | Daily Budget            | Cache TTL        | Refresh Schedule    | Gateway Folder    |
| --------------- | --------------------- | -------------- | ----------------------- | ---------------- | ------------------- | ----------------- |
| **FX**          | Ribbon (homepage top) | TwelveData     | 800 (FX only)           | 30 min           | :00, :30            | `twelvedata/`     |
| **Indices**     | Exchange Cards        | Marketstack    | 3,333 (shared)          | 2 hours          | :05, :20, :35, :50  | `marketstack/`    |
| **Commodities** | Windows (homepage)    | Marketstack v2 | 3,333 (shared) + 1K cap | 2 hours per-item | Rolling every 5 min | `marketstack/`    |
| **Weather**     | Exchange Cards        | OpenWeatherMap | 1,000 (separate)        | 5 min            | :10, :40            | `openweathermap/` |

**Key insights:**

- All four feeds are **LIVE with real data** — no parked or fallback feeds
- Indices and Commodities **share one Marketstack budget** (3,333/day) but Commodities has a separate 1K/day cap
- FX uses TwelveData exclusively — no longer shared with anything
- Weather uses a completely separate provider (OpenWeatherMap)
- Commodities uses a **rolling scheduler** (not clock-aligned) because the API only supports 1 commodity per call

---

## CRITICAL: No Demo Prices Ever

**This is a hard rule documented in memory:**

> "There is no synthetic demo market data on the homepage ribbon."
> "Fallback must return null (renders as '—')."

When live API data is unavailable, the gateway returns:

```typescript
price: null; // NEVER demo prices
```

The frontend renders `null` as `—` (em dash). This is intentional and correct.

**Why no demo prices?**

- Users expect real data from a financial platform
- Demo prices create false impressions
- The "—" clearly communicates "data unavailable"

---

## Gateway Architecture (Provider-Based)

The gateway was refactored from a 4,002-line monolithic file to a provider-based modular architecture:

```
gateway/src/
├── server.ts                    # ~720 lines: routes + startup
│
├── lib/                         # Shared infrastructure (provider-agnostic)
│   ├── types.ts                 # All shared type definitions
│   ├── cache.ts                 # GenericCache<T> class
│   ├── circuit.ts               # CircuitBreaker class
│   ├── dedup.ts                 # RequestDeduplicator<T> class
│   ├── feed-handler.ts          # createFeedHandler() factory
│   └── logging.ts               # Structured logging utilities
│
├── twelvedata/                  # ← Everything TwelveData in ONE place
│   ├── index.ts                 # Exports fxHandler
│   ├── adapter.ts               # TwelveData API fetch logic
│   ├── budget.ts                # 800/day budget (FX only)
│   ├── scheduler.ts             # Clock-aligned slots (:00/:30 FX)
│   └── fx.ts                    # FX feed config ✅ LIVE
│
├── marketstack/                 # ← Everything Marketstack in ONE place
│   ├── index.ts                 # Exports indicesHandler, commoditiesHandler
│   ├── adapter.ts               # Marketstack API fetch logic + benchmark mapping
│   ├── budget.ts                # Shared 3,333/day budget (indices)
│   ├── scheduler.ts             # Clock-aligned slots (:05/:20/:35/:50 indices)
│   ├── indices.ts               # Indices feed config ✅ LIVE
│   ├── commodities.ts           # Commodities feed config ✅ LIVE
│   ├── commodities-scheduler.ts # Rolling 5-min scheduler (Fisher-Yates randomised)
│   └── commodities-budget.ts    # Separate 1,000/day cap for commodities
│
└── openweathermap/              # ← Everything OpenWeatherMap in ONE place
    ├── index.ts                 # Exports weather handler + helpers
    └── handler.ts               # Weather feed with city batching ✅ LIVE
```

**Why provider-based?**

- Debug TwelveData issues → look in **one folder**
- Add new TwelveData feed → add **one config file**
- Budget tracked per provider → **no confusion**
- Scheduler per provider → **no overlap**

---

## API Timing Stagger (Clock-Aligned + Rolling)

Feeds refresh at staggered intervals to avoid per-minute rate limits:

```
Hour timeline (every hour):
┌────┬────┬────┬────┬────┬────┬────┬────┬────┐
│:00 │:05 │:10 │:20 │:30 │:35 │:40 │:50 │:00 │
├────┼────┼────┼────┼────┼────┼────┼────┼────┤
│ FX │IDX │WTH │IDX │ FX │IDX │WTH │IDX │ FX │
└────┴────┴────┴────┴────┴────┴────┴────┴────┘
  ↑    ↑   ↑    ↑    ↑    ↑    ↑    ↑
  TD   MS  OWM  MS   TD   MS  OWM  MS

+ Commodities: rolling every 5 min (Marketstack v2, not clock-aligned)

TD  = TwelveData (800/day budget, FX only)
MS  = Marketstack (3,333/day shared budget, Indices + Commodities)
OWM = OpenWeatherMap (1,000/day budget, Weather)
```

**Why rolling for Commodities?** Marketstack v2 supports only 1 commodity per call. 78 commodities × 5 min = 6.5 hours per cycle. Clock-aligned would cram 78 calls into one slot — rolling spreads the load evenly.

---

## Single Source of Truth (SSOT)

Each feed has ONE authoritative data file:

| Feed        | SSOT File                                                | What it contains                   |
| ----------- | -------------------------------------------------------- | ---------------------------------- |
| FX          | `frontend/src/data/fx/fx-pairs.json`                     | 102 pairs, defaults, precision     |
| Indices     | `frontend/src/data/exchanges/exchanges.catalog.json`     | 48 exchanges, benchmark mappings   |
| Commodities | `frontend/src/data/commodities/commodities-catalog.json` | 78 commodities, groups, units      |
| Weather     | Derived from exchanges catalog                           | City coords for selected exchanges |

**Gateway fetches from frontend on startup** — no hardcoded data in the gateway.

---

## Calming Techniques (All Feeds)

All active feeds share **17 core techniques** (see `api-calming-efficiency.md` for full detail):

1. **TTL Cache** — Gateway caches responses (30 min FX, 2 hr Indices/Commodities, 5 min Weather)
2. **Request Deduplication** — Single-flight pattern prevents thundering herd
3. **Batch Requests** — All symbols in one API call (except Commodities: 1-per-call API)
4. **Budget Management** — Daily + per-minute caps with hard stops (4 separate trackers)
5. **Circuit Breaker** — 429/5xx protection with automatic recovery
6. **Stale-While-Revalidate** — Serve stale data during refresh
7. **Clock-Aligned Scheduler** — Prevents rate limit violations (FX, Indices, Weather)
8. **Visibility Backoff** — 6x slower polling when browser tab hidden
9. **Centralised Polling** — One timer per feed globally (singleton store)
10. **Client Rate Limiting** — 240 req/min frontend cap
11. **SSOT Config** — All feeds fetch config from frontend
12. **Provider Isolation** — Separate folders and budgets per provider
13. **Null Fallback** — Never return demo prices, always `price: null`
14. **Provider-Based Modules** — Clean barrel exports per provider
15. **Rolling Scheduler** — Even load distribution for Commodities
16. **Queue Randomisation** — Fisher-Yates shuffle for fair refresh distribution
17. **Background Refresh** — Proactive cache warming on all feeds

---

## AI Intelligence Engine (Prompt Lab)

**Scope:** Prompt Lab (`/studio/playground`) only. The standard builder uses the client-side One Brain pipeline.

The Prompt Lab uses a **split-brain architecture**: Claude (Anthropic) writes the system prompt rules at development time, GPT-5.4-mini (OpenAI) executes them at runtime. Three server-side API calls power the flow:

| Call   | Route                                    | Purpose                                              | Model        | Temp | Post-processing |
| ------ | ---------------------------------------- | ---------------------------------------------------- | ------------ | ---- | --------------- |
| Call 1 | `/api/parse-sentence` (455 lines)        | Category assessment — what's in the user's text      | GPT-5.4-mini | 0.5  | None            |
| Call 2 | `/api/generate-tier-prompts` (523 lines) | Generate 4 tier prompts (CLIP, MJ, NL, Plain)        | GPT-5.4-mini | 0.5  | P1–P12 pipeline |
| Call 3 | `/api/optimise-prompt` (336 lines)       | Platform-specific optimisation for selected provider | GPT-5.4-mini | 0.2  | None (planned)  |

**Post-processing pipeline** (`src/lib/harmony-post-processing.ts`, 342 lines): 7 functions catch GPT mechanical artefacts server-side before the response reaches the client. Catches duplicate MJ negatives, meta-language openers, CLIP-unfriendly adjectives, self-correction hallucinations, and short sentence checklists. All functions are deterministic string operations — zero latency cost.

**Compliance gate** (`src/lib/harmony-compliance.ts`, 486 lines): Deterministic syntax validation. Enforces provider-specific weight syntax, adds missing MJ parameters, detects banned phrases. Rule ceiling tracked here (30 rules, test-enforced).

**Test lockdown:** 115 tests across `harmony-post-processing.test.ts` (72) + `harmony-compliance.test.ts` (43). Drift detection asserts lookup set sizes.

**AI Disguise principle:** No user-facing string references "AI", "GPT", "OpenAI", or "LLM". All API calls are server-side — browser Network tab shows only Promagen routes. Users see "Prompt Intelligence Engine" and "algorithms."

> **Deep dive:** `ai-disguise.md` v4.0.0, `harmonizing-claude-openai.md` v2.0.0, `prompt-lab-v4-flow.md` v1.3.0

---

## Prompt Assembly Pipeline (Standard Builder)

The standard builder (`/providers/[id]`) uses a client-side prompt assembly pipeline:

| Component    | File                                     | Lines | Purpose                                                                      |
| ------------ | ---------------------------------------- | ----- | ---------------------------------------------------------------------------- |
| One Brain    | `src/lib/prompt-builder.ts`              | 2,196 | Single `assemblePrompt()` function — all prompt assembly routes through this |
| Optimizer    | `src/lib/prompt-optimizer.ts`            | 1,789 | 4-phase client-side optimisation                                             |
| Intelligence | `src/lib/prompt-builder/intelligence.ts` | —     | Scoring, conflict detection, smart suggestions                               |

**One Brain rule:** All prompt assembly routes through `assemblePrompt()`. Never build parallel assembly paths.

> **Deep dive:** `unified-prompt-brain.md` v3.0.0, `prompt-optimizer.md` v5.0.0, `prompt-builder-page.md`

---

## Auth + Payments

| Service      | Provider          | Purpose                                                         | Key files                                                           |
| ------------ | ----------------- | --------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Auth**     | Clerk             | Sign-in/up, session management, user identity                   | `@clerk/nextjs` in layout.tsx, `/api/auth/*` routes                 |
| **Payments** | Stripe            | Pro subscription checkout, portal, webhook events               | `/api/stripe/checkout`, `/api/stripe/portal`, `/api/stripe/webhook` |
| **Database** | Postgres (Vercel) | Learning pipeline, telemetry, scoring, feedback, usage tracking | `src/lib/db.ts`                                                     |

**Tier structure:** Anonymous (3 prompts/day, optimizer locked), signed-in free (5 prompts/day, optimizer unlocked), Pro (unlimited).

> **Deep dive:** `clerk-auth.md`, `stripe.md`, `paid_tier.md` v8.0.0, `vercel-pro-promagen-playbook.md`

---

## Quick Health Check

```powershell
# Gateway healthy?
(Invoke-RestMethod "https://promagen-api.fly.dev/health").status
# Expected: "ok"

# All four feeds returning data?
(Invoke-RestMethod "https://promagen-api.fly.dev/fx").data.Count          # 8
(Invoke-RestMethod "https://promagen-api.fly.dev/indices").data.Count     # 8-16
(Invoke-RestMethod "https://promagen-api.fly.dev/commodities").data.Count # 7
(Invoke-RestMethod "https://promagen-api.fly.dev/weather") | Select-Object -First 1  # has data

# Budget status (SEPARATE per provider)?
$trace = Invoke-RestMethod "https://promagen-api.fly.dev/trace"
$trace.fx | Select-Object mode, ssotSource
$trace.indices | Select-Object mode, ssotSource
$trace.commodities | Select-Object mode, ssotSource
$trace.weather
```

---

## Fixes Applied (Jan 14, 2026)

### 1. Demo Prices Removed

All `getFallback()` functions now return `price: null` instead of demo prices.

### 2. Benchmark Mapping Aliases

Added missing aliases in `gateway/src/marketstack/adapter.ts`:

| Catalog Uses   | Gateway Mapping   | Marketstack Symbol |
| -------------- | ----------------- | ------------------ |
| `djia`         | → `dow_jones`     | `DJI.INDX`         |
| `tsx`          | → `tsx_composite` | `GSPTSE.INDX`      |
| `russell_2000` | (new)             | `RUT.INDX`         |

### 3. FX Symbol Encoding

Fixed `encodeURIComponent()` for FX symbols containing `/`.

---

## Deep Dive Documents

| Topic                            | Document                                         |
| -------------------------------- | ------------------------------------------------ |
| **AI Intelligence Engine**       | `ai-disguise.md` v4.0.0                          |
| **Harmony Engineering Playbook** | `harmonizing-claude-openai.md` v2.0.0            |
| **Prompt Lab v4 Flow**           | `prompt-lab-v4-flow.md` v1.3.0                   |
| **Post-processing pipeline**     | `harmony-post-processing.ts` (code is authority) |
| **One Brain assembly**           | `unified-prompt-brain.md`                        |
| **Prompt optimizer**             | `prompt-optimizer.md`                            |
| Gateway refactor blueprint       | `gateway-refactor.md`                            |
| Calming techniques & metrics     | `api-calming-efficiency.md`                      |
| Gateway architecture             | `promagen-api-brain-v2.md`                       |
| Fly.io deployment                | `fly-v2.md`                                      |
| Exchange cards & ribbons         | `ribbon-homepage.md`                             |
| **Engine Bay (left CTA)**        | `ignition.md`                                    |
| **Mission Control (right CTA)**  | `mission-control.md`                             |
| Commodities system               | `commodities.md`                                 |
| Benchmark mappings               | `EXPECTED-INDICES-REFERENCE.md`                  |
| **Free vs paid features**        | `paid_tier.md` v8.0.0                            |
| **Auth (Clerk)**                 | `clerk-auth.md`                                  |
| **Payments (Stripe)**            | `stripe.md`                                      |
| Frontend code standards          | `code-standard.md`                               |

---

## Key Contacts

| System            | Dashboard                                |
| ----------------- | ---------------------------------------- |
| Gateway (Fly.io)  | `fly status -a promagen-api`             |
| TwelveData usage  | https://twelvedata.com/account/api-usage |
| Marketstack usage | https://marketstack.com/dashboard        |
| OpenWeatherMap    | https://home.openweathermap.org/api_keys |
| OpenAI (GPT)      | https://platform.openai.com/usage        |
| Clerk (Auth)      | https://dashboard.clerk.com              |
| Stripe (Payments) | https://dashboard.stripe.com             |
| Frontend (Vercel) | https://vercel.com/promagen              |

---

## Changelog

| Date       | Change                                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-03-25 | **Architecture expansion: AI Engine + Auth + Payments**                                                                                                 |
|            | ADDED: AI Intelligence Engine section (Prompt Lab, 3 API calls, post-processing pipeline, compliance gate, 115-test lockdown)                           |
|            | ADDED: Prompt Assembly Pipeline section (One Brain, optimizer, intelligence)                                                                            |
|            | ADDED: Auth + Payments section (Clerk, Stripe, Postgres, tier structure)                                                                                |
|            | UPDATED: Big Picture diagram — added Prompt Lab, AI Engine (Layer 2b), Auth/Payments/DB (Layer 3)                                                       |
|            | UPDATED: Deep Dive table — added 8 new entries (ai-disguise, harmonizing, prompt-lab-v4, post-processing, unified-brain, optimizer, clerk-auth, stripe) |
|            | UPDATED: Key Contacts — added OpenAI, Clerk, Stripe dashboards                                                                                          |
|            | Platform stats: 104 API routes, 35 pages, 161 test files                                                                                                |
| 2026-02-07 | **Full audit: doc corrected to match reality**                                                                                                          |
|            | REMOVED: Crypto feed (entirely removed from codebase)                                                                                                   |
|            | UPDATED: Commodities → ✅ LIVE on Marketstack v2                                                                                                        |
|            | ADDED: Weather feed (OpenWeatherMap, :10/:40)                                                                                                           |
|            | ADDED: openweathermap/ provider folder to architecture                                                                                                  |
|            | FIXED: Indices schedule → :05/:20/:35/:50 (4×/hr)                                                                                                       |
|            | FIXED: Marketstack budget → 3,333/day (Professional tier)                                                                                               |
|            | FIXED: Commodities moved from fallback/ → marketstack/                                                                                                  |
|            | FIXED: TwelveData serves FX only (was FX + Crypto)                                                                                                      |
|            | UPDATED: Timing stagger diagram (4 feeds, 3 providers)                                                                                                  |
|            | UPDATED: Calming techniques 7 → 17                                                                                                                      |
|            | UPDATED: Gateway file structure to reflect current state                                                                                                |
|            | UPDATED: SSOT table (commodities catalog, weather derived)                                                                                              |
|            | UPDATED: Deep Dive table (replaced stale MARKETSTACK ref)                                                                                               |
|            | ADDED: OpenWeatherMap to Key Contacts                                                                                                                   |
| 2026-01-14 | **PM: All feeds verified LIVE**                                                                                                                         |
|            | FX: TwelveData → mode: cached ✅                                                                                                                        |
|            | Indices: Marketstack → mode: live ✅                                                                                                                    |
|            | Crypto: TwelveData → mode: cached ✅                                                                                                                    |
|            | Commodities: Parked → returns null (no demo ever)                                                                                                       |
|            | Fixed benchmark aliases (djia, tsx, russell_2000)                                                                                                       |
|            | Fixed crypto route key mismatch                                                                                                                         |
|            | Removed ALL demo prices from gateway                                                                                                                    |
| 2026-01-14 | Added provider-based gateway architecture                                                                                                               |
|            | Updated diagram to show provider folders                                                                                                                |
|            | Added gateway file structure section                                                                                                                    |
|            | Added clock-aligned scheduler explanation                                                                                                               |
| 2026-01-13 | Initial architecture overview document                                                                                                                  |

---

_This document is the entry point. For details, follow the deep dive links above._

_**Key principles:**_

- _Always update docs FIRST before writing any code. Docs are the single source of truth._
- _NEVER use demo/synthetic prices. Fallback returns null, renders as "—"._
- _All prompt assembly routes through `assemblePrompt()` (One Brain). Never build parallel assembly paths._
- _AI Disguise: no user-facing string references "AI", "GPT", "OpenAI", or "LLM"._
- _115-test harmony lockdown suite must pass before shipping post-processing changes._
