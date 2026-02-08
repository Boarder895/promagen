# Gateway Modular Refactor — Implementation Blueprint

> **Status:** ✅ **COMPLETE** (All Phases Deployed)  
> **Last Updated:** 2026-02-07  
> **Location:** `docs/authority/GATEWAY-REFACTOR.md`  
> **Companion docs:**
>
> - `promagen-api-brain-v2.md` (policy + rules)
> - `api-calming-efficiency.md` (metrics + techniques)
> - `fly-v2.md` (deployment + config)
> - `dev-prod-environment-setup.md` (DEV/PROD env configuration)

---

## Table of Contents

1. [Purpose & Scope](#purpose--scope)
2. [SSOT Contract (Strict)](#ssot-contract-strict)
3. [Architecture Overview](#architecture-overview)
4. [Provider Modules](#provider-modules)
5. [Critical Fixes Applied](#critical-fixes-applied)
6. [Verification & Success Criteria](#verification--success-criteria)
7. [Lessons Learned](#lessons-learned)
8. [Cross-References](#cross-references)
9. [Changelog](#changelog)

---

## Purpose & Scope

This document is the **implementation blueprint** for the Promagen gateway's **provider-based modular architecture**.

**What this document covers:**

- Target file structure (provider-based)
- SSOT contract and behavioral rules
- Provider module specifications
- Critical fixes and their implementations
- Verification checklists

**What this document does NOT cover:**

- Policy changes (see `promagen-api-brain-v2.md`)
- Efficiency techniques (see `api-calming-efficiency.md`)
- Deployment config (see `fly-v2.md`)

---

## SSOT Contract (Strict)

This gateway is a **strict executor**. It does not define what content exists or what the defaults are.

### 1) Free tier defaults (no user selection)

- Defaults come **only** from the frontend SSOT config endpoints (e.g. `/api/fx/config`, `/api/indices/config`, `/api/commodities/config`, `/api/weather/config`).
- The gateway must preserve **exact order** from SSOT.
- The gateway must not generate defaults from "first N active" or any internal list.

### 2) Paid tier custom selection (user provides IDs)

- The gateway accepts user selections **only if every ID exists** in the relevant SSOT catalog.
- If any ID is not in the SSOT catalog → **400 reject** (no substitution, no "closest match", no silent fallback).
- Validation is **route-specific** (each feed validates its own IDs).

### 3) Fallback policy (only one allowed)

- If live upstream data fails → `price: null` (never demo/synthetic).
- If frontend SSOT endpoints are unavailable at runtime → use **last-known-good SSOT snapshot** already loaded.
- If there is no valid snapshot → fail fast (do not invent defaults or catalogs).

### 4) Demo data is forbidden end-to-end

- SSOT may contain "demo" fields for historical reasons, but the gateway must **never** use them in any response path.

### 5) TRUE SSOT Initialization (Added Jan 23, 2026)

- On startup, gateway **ALWAYS tries frontend FIRST** (synchronous await).
- Snapshot is used **ONLY** when frontend is unreachable.
- When SSOT changes, cache is **immediately cleared** to prevent serving stale data.
- `ssotSource` field indicates: `'frontend'` (normal), `'snapshot-fallback'` (degraded).

**Rule:** Frontend is ALWAYS the single source of truth. Snapshots exist ONLY for resilience when frontend is unreachable, not as a performance optimization that can serve stale data.

---

## Architecture Overview

### Problem: Monolithic server.ts

The gateway `server.ts` was **4,002 lines** containing:

| Component               | Lines (approx) | Count       |
| ----------------------- | -------------- | ----------- |
| Type definitions        | ~200           | 4 sets      |
| Validation logic        | ~120           | 4 sets      |
| Budget management       | ~200           | 2 providers |
| Circuit breaker         | ~100           | 2 providers |
| Cache management        | ~160           | 4 caches    |
| Request deduplication   | ~80            | 4 feeds     |
| API fetch logic         | ~400           | 3 providers |
| Route handlers          | ~600           | 8 routes    |
| Background refresh      | ~200           | 4 feeds     |
| **Duplicated patterns** | **~2,840**     | —           |

**~71% of the file was duplicated patterns** with only variable names changed.

### Solution: Provider-Based Architecture

```
gateway/src/
├── server.ts              # ~720 lines: routes + startup + schedulers
│
├── lib/                   # Shared infrastructure (provider-agnostic)
│   ├── types.ts           # All shared type definitions
│   ├── cache.ts           # GenericCache<T> class
│   ├── circuit.ts         # CircuitBreaker class
│   ├── dedup.ts           # RequestDeduplicator<T> class
│   ├── feed-handler.ts    # createFeedHandler() factory
│   ├── ssot-snapshot.ts   # SSOT snapshot persistence
│   ├── shared-budgets.ts  # Per-provider budget managers
│   └── logging.ts         # Structured logging utilities
│
├── twelvedata/            # FX only
│   ├── README.md          # Provider documentation
│   ├── index.ts           # Exports fxHandler
│   ├── adapter.ts         # TwelveData API fetch logic
│   ├── budget.ts          # 800/day budget (FX only)
│   ├── scheduler.ts       # Clock-aligned slots (:00/:30 FX)
│   └── fx.ts              # FX feed config
│
├── marketstack/           # Indices + Commodities
│   ├── README.md          # Provider documentation
│   ├── index.ts           # Exports indicesHandler, commoditiesHandler
│   ├── adapter.ts         # Marketstack API fetch logic + benchmark mapping
│   ├── budget.ts          # Shared 3,333/day budget (Professional tier)
│   ├── scheduler.ts       # Clock-aligned slots (:05/:20/:35/:50 indices)
│   ├── indices.ts         # Indices feed config
│   ├── commodities.ts     # Commodities feed config ✅ LIVE
│   ├── commodities-scheduler.ts  # Rolling 5-min scheduler (Fisher-Yates)
│   └── commodities-budget.ts     # Separate 1,000/day cap for commodities
│
└── openweathermap/        # Weather
    ├── index.ts           # Exports weather handler + helpers
    └── handler.ts         # Weather feed with city batching ✅ LIVE
```

### Why Provider-Based (Not Feed-Based)

The old structure (`feeds/fx.ts`, `feeds/indices.ts`, etc.) **scattered provider logic**:

```
❌ OLD (Feed-Based):
feeds/fx.ts          → imports TwelveData adapter, shared budget
feeds/indices.ts     → imports Marketstack adapter, separate budget
feeds/commodities.ts → imports Marketstack adapter, separate budget

Problem: Marketstack budget logic is duplicated/scattered
Problem: Hard to debug "why is Marketstack over budget?"
Problem: Scheduler logic for same provider is in multiple files
```

The new structure **co-locates everything by provider**:

```
✅ NEW (Provider-Based):
twelvedata/
  ├── budget.ts      # ONE budget instance for TwelveData (FX only)
  ├── scheduler.ts   # ONE scheduler for TwelveData
  ├── adapter.ts     # ONE adapter for TwelveData API calls
  └── fx.ts          # FX-specific config

marketstack/
  ├── budget.ts      # ONE shared budget (Indices + Commodities)
  ├── scheduler.ts   # Clock-aligned indices scheduler
  ├── commodities-scheduler.ts  # Rolling 5-min commodities scheduler
  ├── indices.ts     # Indices config
  └── commodities.ts # Commodities config

Benefit: Debug Marketstack? Look in ONE folder
Benefit: Add Marketstack feed? Add to ONE folder
Benefit: Marketstack rate limit? Fix in ONE scheduler
```

### Line Count Comparison

| Component           | Before      | After      | Reduction |
| ------------------- | ----------- | ---------- | --------- |
| server.ts           | 4,002       | ~720       | 82%       |
| lib/types.ts        | (inline)    | ~150       | —         |
| lib/cache.ts        | (×4)        | ~60        | —         |
| lib/circuit.ts      | (×2)        | ~50        | —         |
| lib/dedup.ts        | (×4)        | ~40        | —         |
| lib/feed-handler.ts | (new)       | ~200       | —         |
| lib/logging.ts      | (new)       | ~30        | —         |
| twelvedata/         | (scattered) | ~280       | —         |
| marketstack/        | (scattered) | ~550       | —         |
| openweathermap/     | (new)       | ~200       | —         |
| **TOTAL**           | **4,002**   | **~2,280** | **43%**   |

---

## Provider Modules

### Provider Status Summary

| Provider       | Feeds                | Status      | Daily Budget  | Schedule                     | Folder            |
| -------------- | -------------------- | ----------- | ------------- | ---------------------------- | ----------------- |
| TwelveData     | FX                   | ✅ **LIVE** | 800 credits   | :00/:30                      | `twelvedata/`     |
| Marketstack    | Indices, Commodities | ✅ **LIVE** | 3,333 credits | :05/:20/:35/:50 + rolling 5m | `marketstack/`    |
| OpenWeatherMap | Weather              | ✅ **LIVE** | 1,000/day     | :10/:40                      | `openweathermap/` |

---

### TwelveData Module (FX Only)

| Property    | Value                      |
| ----------- | -------------------------- |
| Provider    | TwelveData                 |
| Endpoint    | `api.twelvedata.com`       |
| Budget      | 800 calls/day (FX only)    |
| Rate Limit  | 8 calls/minute             |
| FX Schedule | :00 and :30 past each hour |

> **Note (Feb 7, 2026):** Crypto feed removed entirely from codebase. TwelveData now serves FX only.

**Key files:**

- `adapter.ts` — TwelveData API fetch logic
- `budget.ts` — 800/day budget (FX only)
- `fx.ts` — FX feed config, symbol building (`EUR/USD` format)

---

### Marketstack Module (Indices + Commodities)

| Property             | Value                                            |
| -------------------- | ------------------------------------------------ |
| Provider             | Marketstack                                      |
| Endpoint             | `api.marketstack.com/v2/intraday`                |
| Budget               | 3,333 calls/day (Professional tier, shared pool) |
| Rate Limit           | 60 calls/minute                                  |
| Indices Schedule     | :05, :20, :35, :50 past each hour (4×/hr)        |
| Commodities Schedule | Rolling every 5 min (1 commodity per call)       |

**Key files:**

- `adapter.ts` — Marketstack API fetch logic + benchmark mapping
- `budget.ts` — Shared 3,333/day budget (Professional tier)
- `scheduler.ts` — Clock-aligned indices scheduler (:05/:20/:35/:50)
- `indices.ts` — Indices feed config
- `commodities.ts` — Commodities feed config ✅ LIVE
- `commodities-scheduler.ts` — Rolling 5-min scheduler (Fisher-Yates randomised queue)
- `commodities-budget.ts` — Separate 1,000/day cap for commodities (subset of shared pool)

**Benchmark Mapping (adapter.ts):**

```typescript
export const BENCHMARK_TO_MARKETSTACK: Record<string, string> = {
  sp500: 'SPX.INDX',
  nasdaq: 'NDX.INDX',
  djia: 'DJI.INDX', // Alias: catalog uses 'djia'
  dow_jones: 'DJI.INDX',
  ftse_100: 'UKX.INDX',
  dax: 'DAX.INDX',
  nikkei_225: 'NKY.INDX',
  hang_seng: 'HSI.INDX',
  asx200: 'AS51.INDX',
  tsx: 'GSPTSE.INDX', // Alias: catalog uses 'tsx'
  tsx_composite: 'GSPTSE.INDX',
  russell_2000: 'RUT.INDX',
  taiex: 'TWSE.INDX', // Taiwan Stock Exchange
  // ... full list in adapter.ts
};
```

---

### OpenWeatherMap Module (Weather)

| Property   | Value                                                       |
| ---------- | ----------------------------------------------------------- |
| Provider   | OpenWeatherMap                                              |
| Endpoint   | `api.openweathermap.org/data/2.5/weather`                   |
| Budget     | 1,000 calls/day (free tier)                                 |
| Rate Limit | 60 calls/minute                                             |
| Data       | Temperature, conditions, humidity, wind for exchange cities |
| Schedule   | :10 and :40 past each hour                                  |

**Key differences from other providers:**

| Aspect           | TwelveData/Marketstack                 | OpenWeatherMap                             |
| ---------------- | -------------------------------------- | ------------------------------------------ |
| Init source      | SSOT from frontend `/api/*/config`     | SSOT from frontend `/api/weather/config`   |
| Data granularity | Per-symbol (FX pair, index, commodity) | Per-city (exchange location)               |
| Batching         | All symbols in one request             | 24 cities per batch (A/B alternation)      |
| Handler pattern  | `FeedHandler` class                    | Standalone functions (different lifecycle) |

**Batch System:**

Weather uses A/B batch alternation to stay within budget:

```
Hour N:
  :10 → Batch A (24 priority cities)
  :40 → Batch B (remaining 24 cities)

Hour N+1:
  :10 → Batch A
  :40 → Batch B
```

**Priority cities (Batch A):** All cities matching `selectedExchangeIds` from SSOT, plus extras to reach 24.

**SSOT Config Endpoint:** `/api/weather/config`

```typescript
{
  version: 1,
  generatedAt: "2026-01-20T12:00:00.000Z",
  ssot: "frontend/src/data/exchanges/exchanges.catalog.json",
  cities: [
    { id: "lse-london", city: "London", lat: 51.5074, lon: -0.1276 },
    { id: "nyse-new-york", city: "New York", lat: 40.7128, lon: -74.006 },
    // ... 46 more cities
  ],
  selectedExchangeIds: ["lse-london", "nyse-new-york", ...] // 16 selected
}
```

**Response Schema:** `GET /weather`

```typescript
{
  meta: {
    mode: 'live' | 'cached' | 'stale' | 'fallback',
    cachedAt: "2026-01-20T12:10:00.000Z",
    expiresAt: "2026-01-20T13:10:00.000Z",
    provider: "openweathermap",
    currentBatch: "A" | "B",
    batchARefreshedAt: "2026-01-20T12:10:00.000Z",
    batchBRefreshedAt: "2026-01-20T11:40:00.000Z",
    budget: { state: "ok", dailyUsed: 48, dailyLimit: 1000 }
  },
  data: [
    {
      id: "lse-london",
      city: "London",
      temperatureC: 12,
      temperatureF: 53.6,
      conditions: "Clouds",
      description: "overcast clouds",
      humidity: 78,
      windSpeedKmh: 15,
      emoji: "☁️",
      asOf: "2026-01-20T12:10:00.000Z"
    },
    // ... more cities
  ]
}
```

**Fallback Behavior:**

| Scenario                    | Behavior                                               |
| --------------------------- | ------------------------------------------------------ |
| API key missing             | Returns `data: []`, logs warning                       |
| Frontend config unreachable | Returns `data: []`, handler stays uninitialized        |
| API call fails              | Circuit breaker opens, returns stale data if available |
| Budget exhausted            | Returns stale data if available, else `data: []`       |
| No stale data available     | Returns `data: []` with `mode: 'fallback'`             |

**Never returns synthetic/demo weather data.**

---

### Commodities on Marketstack v2

| Property | Value                                                         |
| -------- | ------------------------------------------------------------- |
| Provider | Marketstack v2 (1-per-call API)                               |
| Status   | ✅ **LIVE**                                                   |
| Schedule | Rolling every 5 min (not clock-aligned)                       |
| Items    | 78 commodities                                                |
| Queue    | Full Fisher-Yates shuffle (all 78, no tiers)                  |
| Budget   | ~288 calls/day (capped at 1,000/day, shared Marketstack pool) |

> **Note (Feb 7, 2026):** Commodities moved from `fallback/` (demo-only) to `marketstack/` (LIVE data). The Marketstack v2 API supports only 1 commodity per call, hence the rolling scheduler instead of clock-aligned batch.

**Rolling Scheduler:**

```typescript
// marketstack/commodities-scheduler.ts
// Every 5 minutes, fetch 1 commodity from fully randomised queue
// 78 items × 5 min = ~6.5 hours per full cycle (~3.7 cycles/day)
// Queue: ALL 78 shuffled via Fisher-Yates each cycle (no tiers, no priority)
// ~288 calls/day, capped at 1,000/day
```

**Response Schema:** `GET /commodities`

```typescript
{
  meta: {
    mode: 'live' | 'cached' | 'stale',
    provider: 'marketstack',
    budget: { state: 'ok', dailyUsed: 100, dailyLimit: 1000 }
  },
  data: [
    {
      id: "gold",
      name: "Gold",
      price: 2045.30,
      asOf: "2026-02-07T12:00:00.000Z"
    },
    // ... 77 more commodities
  ]
}
```

---

## Critical Fixes Applied

### Fix 1: No Demo Prices Ever

**Problem:** Initial implementation returned demo prices when API unavailable.

**Solution:** All `getFallback()` functions return `price: null`:

```typescript
getFallback(catalog: FxPair[]): FxQuote[] {
  return catalog.map((pair) => ({
    id: pair.id,
    base: pair.base,
    quote: pair.quote,
    symbol: buildFxSymbol(pair.base, pair.quote),
    price: null, // NEVER return demo prices - docs mandate "—" display
  }));
}
```

**Rule:** This is locked in memory and documentation.

---

### Fix 2: Benchmark Mapping Aliases

**Problem:** Frontend catalog used `djia`, gateway mapped `dow_jones`.

**Solution:** Added aliases in `gateway/src/marketstack/adapter.ts`:

```typescript
export const BENCHMARK_TO_MARKETSTACK: Record<string, string> = {
  // ... existing mappings ...
  djia: 'DJI.INDX', // Alias: catalog uses 'djia'
  tsx: 'GSPTSE.INDX', // Alias: catalog uses 'tsx'
  russell_2000: 'RUT.INDX', // New: Russell 2000
  taiex: 'TWSE.INDX', // Taiwan Stock Exchange (added Jan 23)
};
```

**Rule:** Always check selected exchanges against gateway mappings before deploy.

---

### Fix 3: Crypto Route Key _(Historical — crypto removed Feb 2026)_

**Problem:** Crypto config route returned `cryptos`, gateway expected `crypto`.

**Solution:** Fixed `frontend/src/app/api/crypto/config/route.ts`:

```typescript
// Before: { cryptos: [...] }
// After:  { crypto: [...] }
```

> **Note (Feb 7, 2026):** Crypto feed removed entirely. This fix is historical context only.

**Rule:** Audit all config routes for key consistency before deploy.

---

### Fix 4: FX Symbol Encoding

**Problem:** FX symbols contain `/` which breaks URLs.

**Solution:** Fixed symbol building to use `encodeURIComponent()`:

```typescript
const symbols = pairs.map((p) => `${p.base}/${p.quote}`);
const encoded = symbols.map((s) => encodeURIComponent(s)).join(',');
```

---

### Fix 5: TRUE SSOT Initialization (Jan 23, 2026)

**Problem:** The `init()` function in `feed-handler.ts` was snapshot-first:

```typescript
// ❌ OLD (BROKEN) - Snapshot-first logic
async function init(): Promise<void> {
  // 1) Load snapshot FIRST (no live dependency)
  const existingSnapshot = await loadSsotSnapshot<TCatalog>(config.id);
  if (existingSnapshot) {
    catalog = [...existingSnapshot.catalog];
    defaults = [...existingSnapshot.defaults];
    // Uses snapshot immediately...
  }

  // 2) Only fetch frontend if NO snapshot exists
  if (!existingSnapshot) {
    await refreshSsotFromFrontend({ throwOnFailure: true });
  }

  ready = true;

  // 3) Background refresh (fire-and-forget) - TOO LATE!
  void refreshSsotFromFrontend({ throwOnFailure: false });
}
```

**Why this was wrong:**

- Gateway started serving requests using OLD snapshot before frontend refresh completed
- Changing `exchanges.selected.json` required deleting `.ssot/indices.snapshot.json` AND restarting
- Violated the core SSOT principle: Frontend should be the SINGLE source of truth

**Symptom:** User updated `exchanges.selected.json` to use Taiwan (twse-taipei), but gateway kept serving old Shanghai (sse-shanghai) data from a 6-day-old snapshot.

**Solution:** Frontend-first, snapshot-fallback:

```typescript
// ✅ NEW (CORRECT) - Frontend-first logic
async function init(): Promise<void> {
  // TRUE SSOT: Always try frontend FIRST
  let frontendSuccess = false;

  try {
    await refreshSsotFromFrontend({ throwOnFailure: true });
    frontendSuccess = true;
  } catch (error) {
    // Frontend unavailable - try snapshot as fallback ONLY
    const existingSnapshot = await loadSsotSnapshot<TCatalog>(config.id);

    if (existingSnapshot) {
      catalog = [...existingSnapshot.catalog];
      defaults = [...existingSnapshot.defaults];
      ssotSource = 'snapshot-fallback'; // Clearly marked
    } else {
      // No snapshot and no frontend - fatal error
      throw new Error(
        `SSOT unavailable: frontend unreachable and no snapshot exists for ${config.id}`,
      );
    }
  }

  ready = true;
}
```

**Cache invalidation on SSOT change:**

```typescript
// In refreshSsotFromFrontend()
const ssotChanged = hash !== ssotHash;

if (ssotChanged) {
  // CRITICAL: Clear cache when SSOT changes to prevent serving stale data
  cache.clear();
}
```

**Types update:** `gateway/src/lib/types.ts`

```typescript
// OLD
export type SsotSource = 'frontend' | 'fallback';

// NEW
export type SsotSource = 'frontend' | 'fallback' | 'snapshot-fallback';
```

**Files changed:**

- `gateway/src/lib/feed-handler.ts` — Frontend-first init logic, cache clear on SSOT change
- `gateway/src/lib/types.ts` — Added `'snapshot-fallback'` to SsotSource type

**Behavioral contract:**

| Scenario                                   | Old Behavior                                     | New Behavior                                                 |
| ------------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------ |
| Gateway starts, frontend available         | Load snapshot → serve stale → background refresh | Fetch frontend → serve fresh                                 |
| Gateway starts, frontend down              | Load snapshot → serve stale                      | Load snapshot → serve with `ssotSource: 'snapshot-fallback'` |
| Gateway starts, no snapshot, frontend down | Crash                                            | Crash (correct — no valid SSOT)                              |
| SSOT config changes                        | Requires snapshot delete + restart               | Automatic on next refresh cycle                              |
| Cache invalidation on SSOT change          | Not implemented                                  | Cache cleared immediately                                    |

---

## Verification & Success Criteria

### Quick Health Check

```powershell
# Run from: C:\Users\Proma\Projects\promagen\gateway

# Gateway healthy?
(Invoke-RestMethod "https://promagen-api.fly.dev/health").status  # "ok"

# All feeds returning data?
(Invoke-RestMethod "https://promagen-api.fly.dev/fx").data.Count          # 8
(Invoke-RestMethod "https://promagen-api.fly.dev/indices").data.Count     # 8-16
(Invoke-RestMethod "https://promagen-api.fly.dev/commodities").data.Count # 78
(Invoke-RestMethod "https://promagen-api.fly.dev/weather").data.Count     # 24+

# SSOT source verification
$trace = Invoke-RestMethod "https://promagen-api.fly.dev/trace"
$trace.fx.ssotSource       # "frontend"
$trace.indices.ssotSource  # "frontend"
```

### Success Criteria

| Criterion                     | Target         | Status |
| ----------------------------- | -------------- | ------ |
| TypeScript compiles           | 0 errors       | ✅     |
| No circular dependencies      | 0 errors       | ✅     |
| All endpoints respond         | 200 OK         | ✅     |
| FX data matches baseline      | Same structure | ✅     |
| Indices data matches baseline | Same structure | ✅     |
| Commodities data LIVE         | 78 items       | ✅     |
| Weather data available        | 24+ cities     | ✅     |
| TwelveData budget tracked     | State = 'ok'   | ✅     |
| Marketstack budget tracked    | State = 'ok'   | ✅     |
| OpenWeatherMap budget tracked | State = 'ok'   | ✅     |
| SSOT source = frontend        | All feeds      | ✅     |
| server.ts < 800 lines         | ~720 lines     | ✅     |
| All guardrails pass           | 7/7            | ✅     |

---

## Lessons Learned

### 1. Demo Prices Are Never Acceptable

**Problem:** Initial implementation returned demo prices when API unavailable.
**Solution:** Always return `null` for unavailable data. Frontend renders as "—".
**Rule:** This is now locked in memory and documentation.

### 2. Catalog Keys Must Match Gateway Keys

**Problem:** Frontend catalog used `djia`, gateway mapped `dow_jones`.
**Solution:** Add aliases in gateway adapter, don't change catalog.
**Rule:** Always check selected exchanges against gateway mappings before deploy.

### 3. Restart ≠ Deploy

**Problem:** `flyctl apps restart` runs old code.
**Solution:** Always use `flyctl deploy` for code changes.
**Rule:** Secrets changes need restart; code changes need deploy.

### 4. Route Key Consistency _(Historical — crypto removed)_

**Problem:** Crypto config route returned `cryptos`, gateway expected `crypto`.
**Solution:** Audit all config routes for key consistency.
**Rule:** Applies to all remaining feeds — always verify route key matches gateway expectation.

### 5. Snapshot-First Violates TRUE SSOT

**Problem:** Gateway used stale snapshot even when frontend was available.
**Solution:** Always fetch frontend first; snapshot is fallback only.
**Rule:** Frontend is ALWAYS the single source of truth. Snapshots exist ONLY for resilience.

---

## Cross-References

| Document                        | What to Update                                    | Status |
| ------------------------------- | ------------------------------------------------- | ------ |
| `promagen-api-brain-v2.md`      | §20.4 Gateway Startup Sequence (TRUE SSOT)        | ✅     |
| `api-calming-efficiency.md`     | Update architecture diagram with provider folders | ✅     |
| `fly-v2.md`                     | Add §12 with new provider-based file structure    | ✅     |
| `ARCHITECTURE.md`               | Update gateway section with provider folders      | ✅     |
| `dev-prod-environment-setup.md` | DEV and PROD env configuration for all services   | ✅     |

---

## Changelog

| Date       | Change                                                                   |
| ---------- | ------------------------------------------------------------------------ |
| 2026-02-07 | **Full audit — corrected to match reality**                              |
|            | REMOVED: All crypto references (feed, module, routes, health check)      |
|            | UPDATED: TwelveData → FX only (was FX + Crypto)                          |
|            | UPDATED: Marketstack 250→3,333/day Professional, :05/:35→:05/:20/:35/:50 |
|            | ADDED: Commodities LIVE on Marketstack v2 (rolling 5-min scheduler)      |
|            | REMOVED: `fallback/` folder — commodities now in `marketstack/`          |
|            | UPDATED: File structure, line counts, provider summary, success criteria |
|            | UPDATED: server.ts ~250→~720 lines                                       |
| 2026-01-23 | **TRUE SSOT Init Fix**                                                   |
|            | Fixed `init()` to be frontend-first, snapshot-fallback                   |
|            | Added cache invalidation on SSOT change                                  |
|            | Added `'snapshot-fallback'` to `SsotSource` type                         |
|            | Added Taiwan (taiex) to benchmark mappings                               |
|            | Root cause: Stale snapshot from Jan 17 serving old exchange selections   |
| 2026-01-20 | **OpenWeatherMap Module**                                                |
|            | Added weather provider (1000/day budget, :10/:40 schedule)               |
|            | Added A/B batch alternation for 48 cities                                |
|            | Added `/api/weather/config` SSOT endpoint                                |
|            | Added cross-reference to dev-prod-environment-setup.md                   |
| 2026-01-14 | **PM: ALL PHASES COMPLETE** ✅                                           |
|            | FX: Live via TwelveData                                                  |
|            | Crypto: Live via TwelveData                                              |
|            | Indices: Live via Marketstack                                            |
|            | Commodities: Parked (returns null, no demo)                              |
|            | Fixed: Demo prices removed from all feeds                                |
|            | Fixed: Benchmark aliases (djia, tsx, russell_2000)                       |
|            | Fixed: Crypto route key mismatch                                         |
|            | Fixed: FX symbol encoding                                                |
| 2026-01-14 | Added Architectural Guardrails section (7 guardrails)                    |
|            | Added README.md requirement for each provider folder                     |
|            | Added ESLint no-cycle rule for circular dependency check                 |
|            | Added shared interfaces (FeedScheduler, BudgetManagerInterface)          |
| 2026-01-14 | **Major rewrite:** Changed from feed-based to provider-based             |
|            | Added `twelvedata/`, `marketstack/`, `fallback/` folders                 |
|            | Added scheduler.ts for clock-aligned slots                               |
|            | Added budget.ts per provider (shared vs separate)                        |
| 2026-01-13 | Document created with feed-based blueprint                               |
|            | Noted Commodities removed from TwelveData (provider TBD)                 |

---

_This implementation blueprint is actively maintained. The gateway uses provider-based modular architecture._

_**Key principles:**_

1. _Code and docs must stay aligned. Any behaviour described here must be enforced in code (and vice versa)._
2. _No demo/synthetic prices ever (`price: null` on failure)._
3. _Defaults and allowlists come only from frontend SSOT._
4. _Frontend-first initialization; snapshot-only fallback when frontend is unreachable._
