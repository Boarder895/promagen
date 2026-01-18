# Promagen Architecture Overview

> **30-Second Guide** | Start here to understand Promagen's data architecture  
> **Location:** `docs/authority/ARCHITECTURE.md`  
> **Last updated:** 14 January 2026 (PM) — All feeds verified LIVE

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
│   │  (8 pairs)    │  (16 exchanges)  │  (parked)      │  (8 coins)     │   │
│   │  ✅ LIVE      │  ✅ LIVE         │  ⏸️ PARKED     │  ✅ LIVE       │   │
│   └───────┬───────┴────────┬─────────┴───────┬────────┴────────┬───────┘   │
│           │                │                 │                 │           │
│   LAYER 1: FRONTEND (Vercel)                                               │
│   ┌───────▼───────┬────────▼─────────┬───────▼────────┬────────▼───────┐   │
│   │  /api/fx      │  /api/indices    │ /api/commodities│  /api/crypto  │   │
│   │  :00, :30     │  :05, :35        │  (parked)      │  :20, :50     │   │
│   └───────┬───────┴────────┬─────────┴───────┬────────┴────────┬───────┘   │
│           │                │                 │                 │           │
│   LAYER 2: GATEWAY (Fly.io) — PROVIDER-BASED MODULES                       │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │   │
│   │  │  twelvedata/    │  │  marketstack/   │  │  fallback/      │      │   │
│   │  │  ├── budget.ts  │  │  ├── budget.ts  │  │  └── commodities│      │   │
│   │  │  ├── scheduler  │  │  ├── scheduler  │  │     (null only) │      │   │
│   │  │  ├── fx.ts ✅   │  │  └── indices.ts │  │                 │      │   │
│   │  │  └── crypto.ts✅│  │      ✅ LIVE    │  │                 │      │   │
│   │  │  (800/day)      │  │  (250/day)      │  │  (0 calls)      │      │   │
│   │  └─────────────────┘  └─────────────────┘  └─────────────────┘      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│   LAYER 3: PROVIDERS (Completely Separate Budgets)                         │
│   ┌─────────────────────────────────┬───────────────────────────────────┐   │
│   │   TwelveData (800/day)          │   Marketstack (250/day)           │   │
│   │   FX + Crypto ✅ LIVE           │   Indices only ✅ LIVE            │   │
│   │   Clock-aligned: :00/:30 FX     │   Clock-aligned: :05/:35          │   │
│   │                 :20/:50 CRY     │                                   │   │
│   └─────────────────────────────────┴───────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Current Feed Status (Jan 14, 2026 PM)

| Feed            | Status      | Provider    | Mode     | Verified |
| --------------- | ----------- | ----------- | -------- | -------- |
| **FX**          | ✅ **LIVE** | TwelveData  | `cached` | Yes      |
| **Indices**     | ✅ **LIVE** | Marketstack | `live`   | Yes      |
| **Crypto**      | ✅ **LIVE** | TwelveData  | `cached` | Yes      |
| **Commodities** | ⏸️ PARKED   | None        | `null`   | Yes      |

**Verification Command:**
```powershell
# All feeds returning data?
(Invoke-RestMethod "https://promagen-api.fly.dev/fx").meta.mode          # "cached" or "live"
(Invoke-RestMethod "https://promagen-api.fly.dev/indices").meta.mode     # "live"
(Invoke-RestMethod "https://promagen-api.fly.dev/crypto").meta.mode      # "cached" or "live"
(Invoke-RestMethod "https://promagen-api.fly.dev/commodities").meta.mode # "fallback"
```

---

## Four Feeds at a Glance

| Feed            | Display               | Provider    | Daily Budget | Cache TTL | Refresh Slots | Gateway Folder |
| --------------- | --------------------- | ----------- | ------------ | --------- | ------------- | -------------- |
| **FX**          | Ribbon (homepage top) | TwelveData  | 800 shared   | 30 min    | :00, :30      | `twelvedata/`  |
| **Indices**     | Exchange Cards        | Marketstack | 250 separate | 2 hours   | :05, :35      | `marketstack/` |
| **Commodities** | Ribbon (homepage)     | None        | 0 (parked)   | N/A       | N/A           | `fallback/`    |
| **Crypto**      | Ribbon (homepage)     | TwelveData  | 800 shared   | 30 min    | :20, :50      | `twelvedata/`  |

**Key insights:**
- Indices uses a **separate provider and budget** — it doesn't compete with TwelveData feeds
- Commodities is **PARKED** — returns `null` prices (renders as "—"), NO demo data ever
- FX and Crypto **share one TwelveData budget** but never refresh simultaneously

---

## CRITICAL: No Demo Prices Ever

**This is a hard rule documented in memory:**

> "There is no synthetic demo market data on the homepage ribbon."
> "Fallback must return null (renders as '—')."

When live API data is unavailable, the gateway returns:
```typescript
price: null  // NEVER demo prices
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
│   ├── fx.ts                    # FX feed config ✅ LIVE
│   └── crypto.ts                # Crypto feed config ✅ LIVE
│
├── marketstack/                 # ← Everything Marketstack in ONE place
│   ├── index.ts                 # Exports indicesHandler
│   ├── adapter.ts               # Marketstack API fetch logic + benchmark mapping
│   ├── budget.ts                # Separate 250/day budget (ONE instance)
│   ├── scheduler.ts             # Clock-aligned slots (:05/:35)
│   └── indices.ts               # Indices feed config ✅ LIVE
│
└── fallback/                    # ← Feeds with no provider
    └── commodities.ts           # Returns NULL prices only (parked)
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
| Commodities | `frontend/src/data/commodities/commodities.json`     | Commodity metadata (parked)      |
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
(Invoke-RestMethod "https://promagen-api.fly.dev/indices").data.Count     # 8-16
(Invoke-RestMethod "https://promagen-api.fly.dev/commodities").meta.mode  # "fallback"
(Invoke-RestMethod "https://promagen-api.fly.dev/crypto").data.Count      # 8

# Budget status (SEPARATE per provider)?
$trace = Invoke-RestMethod "https://promagen-api.fly.dev/trace"
$trace.fx | Select-Object mode, ssotSource
$trace.indices | Select-Object mode, ssotSource
$trace.crypto | Select-Object mode, ssotSource
```

---

## Fixes Applied (Jan 14, 2026)

### 1. Demo Prices Removed
All `getFallback()` functions now return `price: null` instead of demo prices.

### 2. Benchmark Mapping Aliases
Added missing aliases in `gateway/src/marketstack/adapter.ts`:

| Catalog Uses | Gateway Mapping | Marketstack Symbol |
|--------------|-----------------|-------------------|
| `djia`       | → `dow_jones`   | `DJI.INDX`        |
| `tsx`        | → `tsx_composite`| `GSPTSE.INDX`    |
| `russell_2000`| (new)          | `RUT.INDX`        |

### 3. Crypto Route Key Fix
Fixed `frontend/src/app/api/crypto/config/route.ts` to export `crypto` key (was `cryptos`).

### 4. FX Symbol Encoding
Fixed `encodeURIComponent()` for FX symbols containing `/`.

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
| 2026-01-14 | **PM: All feeds verified LIVE**                       |
|            | FX: TwelveData → mode: cached ✅                      |
|            | Indices: Marketstack → mode: live ✅                  |
|            | Crypto: TwelveData → mode: cached ✅                  |
|            | Commodities: Parked → returns null (no demo ever)     |
|            | Fixed benchmark aliases (djia, tsx, russell_2000)     |
|            | Fixed crypto route key mismatch                       |
|            | Removed ALL demo prices from gateway                  |
| 2026-01-14 | Added provider-based gateway architecture             |
|            | Updated diagram to show provider folders              |
|            | Added gateway file structure section                  |
|            | Added clock-aligned scheduler explanation             |
| 2026-01-13 | Initial architecture overview document                |

---

_This document is the entry point. For details, follow the deep dive links above._

_**Key principle:** Always update docs FIRST before writing any code. Docs are the single source of truth._

_**Critical rule:** NEVER use demo/synthetic prices. Fallback returns null, renders as "—"._
