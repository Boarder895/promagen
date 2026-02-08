# Promagen Architecture Overview

> **30-Second Guide** | Start here to understand Promagen's data architecture  
> **Location:** `docs/authority/ARCHITECTURE.md`  
> **Last updated:** 7 February 2026 — Full audit, all feeds verified against code

---

## The Big Picture

Promagen displays live financial data across **four feeds**, served through a **three-layer calming architecture** with **provider-based gateway modules**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PROMAGEN DATA ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   USER BROWSER                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  FX Ribbon    │  Exchange Cards  │  Commodities   │  Weather       │   │
│   │  (8 pairs)    │  (16 exchanges)  │  (7 windows)   │  (48 cities)   │   │
│   │  ✅ LIVE      │  ✅ LIVE         │  ✅ LIVE       │  ✅ LIVE       │   │
│   └───────┬───────┴────────┬─────────┴───────┬────────┴────────┬───────┘   │
│           │                │                 │                 │           │
│   LAYER 1: FRONTEND (Vercel)                                               │
│   ┌───────▼───────┬────────▼─────────┬───────▼────────┬────────▼───────┐   │
│   │  /api/fx      │  /api/indices    │/api/commodities│  /api/weather  │   │
│   │  :00, :30     │ :05,:20,:35,:50  │  rolling 5-min │  :10, :40     │   │
│   └───────┬───────┴────────┬─────────┴───────┬────────┴────────┬───────┘   │
│           │                │                 │                 │           │
│   LAYER 2: GATEWAY (Fly.io) — PROVIDER-BASED MODULES                       │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  ┌──────────────┐  ┌──────────────────────┐  ┌──────────────────┐  │   │
│   │  │ twelvedata/  │  │ marketstack/         │  │ openweathermap/  │  │   │
│   │  │ ├── budget   │  │ ├── budget.ts        │  │ ├── handler.ts   │  │   │
│   │  │ ├── scheduler│  │ ├── scheduler.ts     │  │ └── (1,000/day)  │  │   │
│   │  │ └── fx.ts ✅ │  │ ├── commodities-     │  │     ✅ LIVE      │  │   │
│   │  │  (800/day)   │  │ │   scheduler.ts     │  │                  │  │   │
│   │  │  FX only     │  │ ├── indices.ts ✅    │  └──────────────────┘  │   │
│   │  └──────────────┘  │ └── commodities.ts ✅│                        │   │
│   │                    │  (3,333/day shared)   │                        │   │
│   │                    └──────────────────────┘                        │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│   LAYER 3: PROVIDERS (Completely Separate Budgets)                         │
│   ┌─────────────────┬──────────────────────────┬───────────────────────┐   │
│   │ TwelveData      │ Marketstack              │ OpenWeatherMap        │   │
│   │ (800/day)       │ (3,333/day shared)       │ (1,000/day)           │   │
│   │ FX only ✅ LIVE │ Indices + Commodities ✅ │ Weather ✅ LIVE       │   │
│   │ :00, :30        │ IDX: :05/:20/:35/:50     │ :10, :40              │   │
│   │                 │ COM: rolling 5-min       │                       │   │
│   └─────────────────┴──────────────────────────┴───────────────────────┘   │
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

| Topic                           | Document                        |
| ------------------------------- | ------------------------------- |
| Gateway refactor blueprint      | `GATEWAY-REFACTOR.md`           |
| Calming techniques & metrics    | `api-calming-efficiency.md`     |
| Gateway architecture            | `promagen-api-brain-v2.md`      |
| Fly.io deployment               | `fly-v2.md`                     |
| Exchange cards & ribbons        | `ribbon-homepage.md`            |
| **Engine Bay (left CTA)**       | `ignition.md`                   |
| **Mission Control (right CTA)** | `mission-control.md`            |
| Commodities system              | `commodities.md`                |
| Benchmark mappings              | `EXPECTED-INDICES-REFERENCE.md` |
| Free vs paid features           | `paid_tier.md`                  |
| Frontend code standards         | `code-standard.md`              |

---

## Key Contacts

| System            | Dashboard                                |
| ----------------- | ---------------------------------------- |
| Gateway (Fly.io)  | `fly status -a promagen-api`             |
| TwelveData usage  | https://twelvedata.com/account/api-usage |
| Marketstack usage | https://marketstack.com/dashboard        |
| OpenWeatherMap    | https://home.openweathermap.org/api_keys |
| Frontend (Vercel) | https://vercel.com/promagen              |

---

## Changelog

| Date       | Change                                                     |
| ---------- | ---------------------------------------------------------- |
| 2026-02-07 | **Full audit: doc corrected to match reality**             |
|            | REMOVED: Crypto feed (entirely removed from codebase)      |
|            | UPDATED: Commodities → ✅ LIVE on Marketstack v2           |
|            | ADDED: Weather feed (OpenWeatherMap, :10/:40)              |
|            | ADDED: openweathermap/ provider folder to architecture     |
|            | FIXED: Indices schedule → :05/:20/:35/:50 (4×/hr)          |
|            | FIXED: Marketstack budget → 3,333/day (Professional tier)  |
|            | FIXED: Commodities moved from fallback/ → marketstack/     |
|            | FIXED: TwelveData serves FX only (was FX + Crypto)         |
|            | UPDATED: Timing stagger diagram (4 feeds, 3 providers)     |
|            | UPDATED: Calming techniques 7 → 17                         |
|            | UPDATED: Gateway file structure to reflect current state   |
|            | UPDATED: SSOT table (commodities catalog, weather derived) |
|            | UPDATED: Deep Dive table (replaced stale MARKETSTACK ref)  |
|            | ADDED: OpenWeatherMap to Key Contacts                      |
| 2026-01-14 | **PM: All feeds verified LIVE**                            |
|            | FX: TwelveData → mode: cached ✅                           |
|            | Indices: Marketstack → mode: live ✅                       |
|            | Crypto: TwelveData → mode: cached ✅                       |
|            | Commodities: Parked → returns null (no demo ever)          |
|            | Fixed benchmark aliases (djia, tsx, russell_2000)          |
|            | Fixed crypto route key mismatch                            |
|            | Removed ALL demo prices from gateway                       |
| 2026-01-14 | Added provider-based gateway architecture                  |
|            | Updated diagram to show provider folders                   |
|            | Added gateway file structure section                       |
|            | Added clock-aligned scheduler explanation                  |
| 2026-01-13 | Initial architecture overview document                     |

---

_This document is the entry point. For details, follow the deep dive links above._

_**Key principle:** Always update docs FIRST before writing any code. Docs are the single source of truth._

_**Critical rule:** NEVER use demo/synthetic prices. Fallback returns null, renders as "—"._
