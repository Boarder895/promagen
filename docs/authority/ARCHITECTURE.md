# Promagen Architecture Overview

> **30-Second Guide** | Start here to understand Promagen's data architecture  
> **Location:** `docs/authority/ARCHITECTURE.md`  
> **Last updated:** 14 January 2026

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
│   │  FX Ribbon    │  Exchange Cards  │  Commodities   │  Crypto Ribbon │   │
│   │  (8 pairs)    │  (16 exchanges)  │  (fallback)    │  (8 coins)     │   │
│   └───────┬───────┴────────┬─────────┴───────┬────────┴────────┬───────┘   │
│           │                │                 │                 │           │
│   LAYER 1: FRONTEND (Vercel)                                               │
│   ┌───────▼───────┬────────▼─────────┬───────▼────────┬────────▼───────┐   │
│   │  /api/fx      │  /api/indices    │ /api/commodities│  /api/crypto  │   │
│   │  :00, :30     │  :05, :35        │  (fallback)    │  :20, :50     │   │
│   └───────┬───────┴────────┬─────────┴───────┬────────┴────────┬───────┘   │
│           │                │                 │                 │           │
│   LAYER 2: GATEWAY (Fly.io) — PROVIDER-BASED MODULES                       │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │   │
│   │  │  twelvedata/    │  │  marketstack/   │  │  fallback/      │      │   │
│   │  │  ├── budget.ts  │  │  ├── budget.ts  │  │  └── commodities│      │   │
│   │  │  ├── scheduler  │  │  ├── scheduler  │  │                 │      │   │
│   │  │  ├── fx.ts      │  │  └── indices.ts │  │                 │      │   │
│   │  │  └── crypto.ts  │  │                 │  │                 │      │   │
│   │  │  (800/day)      │  │  (250/day)      │  │  (0 calls)      │      │   │
│   │  └─────────────────┘  └─────────────────┘  └─────────────────┘      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│   LAYER 3: PROVIDERS (Completely Separate Budgets)                         │
│   ┌─────────────────────────────┬───────────────────────────────────────┐   │
│   │   TwelveData (800/day)      │   Marketstack (250/day)               │   │
│   │   FX + Crypto               │   Indices only                        │   │
│   │   Clock-aligned: :00/:30 FX │   Clock-aligned: :05/:35              │   │
│   │                 :20/:50 CRY │                                       │   │
│   └─────────────────────────────┴───────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Four Feeds at a Glance

| Feed            | Display               | Provider    | Daily Budget | Cache TTL | Refresh Slots | Gateway Folder |
| --------------- | --------------------- | ----------- | ------------ | --------- | ------------- | -------------- |
| **FX**          | Ribbon (homepage top) | TwelveData  | 800 shared   | 30 min    | :00, :30      | `twelvedata/`  |
| **Indices**     | Exchange Cards        | Marketstack | 250 separate | 2 hours   | :05, :35      | `marketstack/` |
| **Commodities** | Ribbon (homepage)     | None        | 0 (fallback) | 30 min    | N/A           | `fallback/`    |
| **Crypto**      | Ribbon (homepage)     | TwelveData  | 800 shared   | 30 min    | :20, :50      | `twelvedata/`  |

**Key insights:**
- Indices uses a **separate provider and budget** — it doesn't compete with TwelveData feeds
- Commodities returns **fallback/demo data** — no API calls until new provider is integrated
- FX and Crypto **share one TwelveData budget** but never refresh simultaneously

---

## Gateway Architecture (Provider-Based)

The gateway was refactored from a 4,002-line monolithic file to a provider-based modular architecture:

```
gateway/src/
├── server.ts                    # ~250 lines: routes + startup ONLY
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
│   ├── index.ts                 # Exports fxHandler, cryptoHandler
│   ├── adapter.ts               # TwelveData API fetch logic
│   ├── budget.ts                # Shared 800/day budget (ONE instance)
│   ├── scheduler.ts             # Clock-aligned slots (:00/:30 FX, :20/:50 Crypto)
│   ├── fx.ts                    # FX feed config
│   └── crypto.ts                # Crypto feed config
│
├── marketstack/                 # ← Everything Marketstack in ONE place
│   ├── index.ts                 # Exports indicesHandler
│   ├── adapter.ts               # Marketstack API fetch logic
│   ├── budget.ts                # Separate 250/day budget (ONE instance)
│   ├── scheduler.ts             # Clock-aligned slots (:05/:35)
│   └── indices.ts               # Indices feed config
│
└── fallback/                    # ← Feeds with no provider
    └── commodities.ts           # Returns demo prices only
```

**Why provider-based?**
- Debug TwelveData issues → look in **one folder**
- Add new TwelveData feed → add **one config file**
- Budget tracked per provider → **no confusion**
- Scheduler per provider → **no overlap**

---

## API Timing Stagger (Clock-Aligned)

Feeds refresh at staggered intervals to avoid per-minute rate limits:

```
Hour timeline (repeats every hour):
┌────┬────┬────┬────┬────┬────┬────┬────┬────┐
│:00 │:05 │:10 │:20 │:30 │:35 │:40 │:50 │:00 │
├────┼────┼────┼────┼────┼────┼────┼────┼────┤
│ FX │IDX │    │CRY │ FX │IDX │    │CRY │ FX │
└────┴────┴────┴────┴────┴────┴────┴────┴────┘
  ↑    ↑         ↑    ↑    ↑         ↑
  TD   MS        TD   TD   MS        TD

TD = TwelveData (800/day shared budget)
MS = Marketstack (250/day separate budget)
```

**Per-minute maximum:** 8 TwelveData credits, never more — well under the 8/minute limit!

---

## Single Source of Truth (SSOT)

Each feed has ONE authoritative data file:

| Feed        | SSOT File                                            | What it contains                 |
| ----------- | ---------------------------------------------------- | -------------------------------- |
| FX          | `frontend/src/data/fx/fx-pairs.json`                 | 102 pairs, defaults, precision   |
| Indices     | `frontend/src/data/exchanges/exchanges.catalog.json` | 48 exchanges, benchmark mappings |
| Commodities | `frontend/src/data/commodities/commodities.json`     | Commodity metadata               |
| Crypto      | `frontend/src/data/crypto/crypto.json`               | Cryptocurrency metadata          |

**Gateway fetches from frontend on startup** — no hardcoded data in the gateway.

---

## Calming Techniques (All Feeds)

Every active feed uses the same 7 core techniques:

1. **TTL Cache** — Gateway caches responses (30 min or 2 hr)
2. **Request Deduplication** — Single-flight pattern prevents thundering herd
3. **Batch Requests** — All symbols in one API call
4. **Budget Management** — Daily + per-minute caps with hard stops
5. **Circuit Breaker** — 429/5xx protection with automatic recovery
6. **Stale-While-Revalidate** — Serve stale data during refresh
7. **Clock-Aligned Scheduler** — Prevents rate limit violations

---

## Quick Health Check

```powershell
# Gateway healthy?
(Invoke-RestMethod "https://promagen-api.fly.dev/health").status
# Expected: "ok"

# All four feeds returning data?
(Invoke-RestMethod "https://promagen-api.fly.dev/fx").data.Count          # 8
(Invoke-RestMethod "https://promagen-api.fly.dev/indices").data.Count     # 16
(Invoke-RestMethod "https://promagen-api.fly.dev/commodities").source     # "fallback"
(Invoke-RestMethod "https://promagen-api.fly.dev/crypto").data.Count      # 8

# Budget status (SEPARATE per provider)?
$trace = Invoke-RestMethod "https://promagen-api.fly.dev/trace"
$trace.budget          # TwelveData: dailyUsed < 560 (70%)
$trace.indicesBudget   # Marketstack: dailyUsed < 175 (70%)
```

---

## Deep Dive Documents

| Topic                        | Document                        |
| ---------------------------- | ------------------------------- |
| Gateway refactor blueprint   | `GATEWAY-REFACTOR.md`           |
| Calming techniques & metrics | `api-calming-efficiency.md`     |
| Gateway architecture         | `promagen-api-brain-v2.md`      |
| Fly.io deployment            | `fly-v2.md`                     |
| Exchange cards & ribbons     | `ribbon-homepage.md`            |
| Marketstack integration      | `MARKETSTACK-ACTION-PLAN.md`    |
| Benchmark mappings           | `EXPECTED-INDICES-REFERENCE.md` |
| Free vs paid features        | `paid_tier.md`                  |
| Frontend code standards      | `code-standard.md`              |

---

## Key Contacts

| System            | Dashboard                                |
| ----------------- | ---------------------------------------- |
| Gateway (Fly.io)  | `fly status -a promagen-api`             |
| TwelveData usage  | https://twelvedata.com/account/api-usage |
| Marketstack usage | https://marketstack.com/dashboard        |
| Frontend (Vercel) | https://vercel.com/promagen              |

---

## Changelog

| Date       | Change                                                |
| ---------- | ----------------------------------------------------- |
| 2026-01-14 | Added provider-based gateway architecture             |
|            | Updated diagram to show provider folders              |
|            | Added gateway file structure section                  |
|            | Added clock-aligned scheduler explanation             |
|            | Noted Commodities as fallback-only (no provider)      |
| 2026-01-13 | Initial architecture overview document                |

---

_This document is the entry point. For details, follow the deep dive links above._

_**Key principle:** Always update docs FIRST before writing any code. Docs are the single source of truth._
