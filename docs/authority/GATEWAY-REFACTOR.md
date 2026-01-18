# Gateway Modular Refactor — Implementation Blueprint

> **Status:** ✅ **COMPLETE** (All Phases Deployed Jan 14, 2026)  
> **Location:** `docs/authority/GATEWAY-REFACTOR.md`  
> **Companion docs:**
>
> - `promagen-api-brain-v2.md` (policy + rules)
> - `api-calming-efficiency.md` (metrics + techniques)
> - `fly-v2.md` (deployment + config)

---

## ✅ IMPLEMENTATION COMPLETE

All phases of the gateway refactor have been successfully implemented and deployed:

| Phase | Description | Status | Verified |
|-------|-------------|--------|----------|
| Phase 1 | TwelveData Module (FX + Crypto) | ✅ COMPLETE | Live data flowing |
| Phase 2 | Marketstack Module (Indices) | ✅ COMPLETE | Live data flowing |
| Phase 3 | Fallback Module (Commodities) | ✅ COMPLETE | Returns null (parked) |
| Phase 4 | Cleanup + Production Deploy | ✅ COMPLETE | Deployed to Fly.io |

**Final Verification (Jan 14, 2026 PM):**
```powershell
# All feeds live
(Invoke-RestMethod "https://promagen-api.fly.dev/fx").meta.mode       # "cached" ✅
(Invoke-RestMethod "https://promagen-api.fly.dev/indices").meta.mode  # "live" ✅
(Invoke-RestMethod "https://promagen-api.fly.dev/crypto").meta.mode   # "cached" ✅
(Invoke-RestMethod "https://promagen-api.fly.dev/commodities").meta.mode # "fallback" ✅
```

---

## Critical Fixes Applied During Implementation

### 1. No Demo Prices Ever

**All `getFallback()` functions return `price: null`:**


**Problem:** Any internal fallback lists (e.g. `FALLBACK_*` or "first N active") create a second source of truth.
**Solution:** Defaults come only from frontend SSOT config. Paid selections must be validated against SSOT catalogs.
**Rule:** Snapshot-only fallback is allowed. Hardcoded defaults are forbidden.

```typescript
// gateway/src/twelvedata/fx.ts
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

### 2. Benchmark Mapping Aliases

**Added to `gateway/src/marketstack/adapter.ts`:**

```typescript
export const BENCHMARK_TO_MARKETSTACK: Record<string, string> = {
  // ... existing mappings ...
  djia: 'DJI.INDX',           // Alias: catalog uses 'djia'
  tsx: 'GSPTSE.INDX',         // Alias: catalog uses 'tsx'
  russell_2000: 'RUT.INDX',   // New: Russell 2000
};
```

### 3. Crypto Route Key Fix

**Fixed `frontend/src/app/api/crypto/config/route.ts`:**
```typescript
// Before: { cryptos: [...] }
// After:  { crypto: [...] }
```

### 4. FX Symbol Encoding

**Fixed symbol building to use `encodeURIComponent()`:**
```typescript
const symbols = pairs.map(p => `${p.base}/${p.quote}`);
const encoded = symbols.map(s => encodeURIComponent(s)).join(',');
```

---
## SSOT Contract (Strict)

This gateway is a **strict executor**. It does not define what content exists or what the defaults are.

### 1) Free tier defaults (no user selection)
- Defaults come **only** from the frontend SSOT config endpoints (e.g. `/api/fx/config`, `/api/indices/config`, `/api/crypto/config`, `/api/commodities/config`).
- The gateway must preserve **exact order** from SSOT.
- The gateway must not generate defaults from "first N active" or any internal list.

### 2) Paid tier custom selection (user provides IDs)
- The gateway accepts user selections **only if every ID exists** in the relevant SSOT catalog.
- If any ID is not in the SSOT catalog → **400 reject** (no substitution, no “closest match”, no silent fallback).
- Validation is **route-specific** (each feed validates its own IDs).

### 3) Fallback policy (only one allowed)
- If live upstream data fails → `price: null` (never demo/synthetic).
- If frontend SSOT endpoints are unavailable at runtime → use **last-known-good SSOT snapshot** already loaded.
- If there is no valid snapshot → fail fast (do not invent defaults or catalogs).

### 4) Demo data is forbidden end-to-end
- SSOT may contain “demo” fields for historical reasons, but the gateway must **never** use them in any response path.

## Purpose

This document is the **implementation blueprint** for refactoring the Promagen gateway from a 4,002-line monolithic `server.ts` to a **provider-based modular architecture**.

**What this document covers:**

- Target file structure (provider-based)
- Architectural guardrails (risks + mitigations)
- Migration sequence
- Verification checklist
- Rollback procedures

**What this document does NOT cover:**

- Policy changes (see `promagen-api-brain-v2.md`)
- Efficiency techniques (see `api-calming-efficiency.md`)
- Deployment config (see `fly-v2.md`)

---

## Problem Statement

### Original State (Before Refactor)

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

### Current State (After Refactor)

```
gateway/src/
├── server.ts              # ~250 lines: routes + startup ONLY ✅
│
├── lib/                   # Shared infrastructure ✅
│   ├── types.ts
│   ├── cache.ts
│   ├── circuit.ts
│   ├── dedup.ts
│   ├── feed-handler.ts
│   └── logging.ts
│
├── twelvedata/            # FX + Crypto ✅ LIVE
│   ├── index.ts
│   ├── adapter.ts
│   ├── budget.ts
│   ├── scheduler.ts
│   ├── fx.ts
│   └── crypto.ts
│
├── marketstack/           # Indices ✅ LIVE
│   ├── index.ts
│   ├── adapter.ts
│   ├── budget.ts
│   ├── scheduler.ts
│   └── indices.ts
│
└── fallback/              # Commodities ✅ PARKED
    └── commodities.ts
```

**Benefits achieved:**
- Debug TwelveData issues → look in **one folder**
- Add new TwelveData feed → add **one config file**
- Budget tracked per provider → **no confusion**
- Scheduler per provider → **no overlap**

---

## Provider Status (Jan 14, 2026)

### Active Providers

| Provider    | Feeds      | Status     | Daily Budget | Folder         |
| ----------- | ---------- | ---------- | ------------ | -------------- |
| TwelveData  | FX, Crypto | ✅ **LIVE** | 800 credits  | `twelvedata/`  |
| Marketstack | Indices    | ✅ **LIVE** | 250 credits  | `marketstack/` |

### Parked Providers

| Provider   | Feed        | Status      | Reason                       | Folder      |
| ---------- | ----------- | ----------- | ---------------------------- | ----------- |
| None       | Commodities | ⏸️ **PARKED** | No provider selected yet     | `fallback/` |

---

## Target Architecture (Provider-Based)

### File Structure (Implemented)

```
gateway/
├── src/
│   ├── server.ts              # ~250 lines: routes + startup ONLY
│   │
│   ├── lib/                   # Shared infrastructure (provider-agnostic)
│   │   ├── types.ts           # All shared type definitions
│   │   ├── cache.ts           # GenericCache<T> class
│   │   ├── circuit.ts         # CircuitBreaker class
│   │   ├── dedup.ts           # RequestDeduplicator<T> class
│   │   ├── feed-handler.ts    # createFeedHandler() factory
│   │   └── logging.ts         # Structured logging utilities
│   │
│   ├── twelvedata/            # ← Everything TwelveData in ONE place
│   │   ├── README.md          # Provider documentation
│   │   ├── index.ts           # Exports fxHandler, cryptoHandler
│   │   ├── adapter.ts         # TwelveData API fetch logic
│   │   ├── budget.ts          # Shared 800/day budget (ONE instance)
│   │   ├── scheduler.ts       # Clock-aligned slots (:00/:30 FX, :20/:50 Crypto)
│   │   ├── fx.ts              # FX feed config
│   │   └── crypto.ts          # Crypto feed config
│   │
│   ├── marketstack/           # ← Everything Marketstack in ONE place
│   │   ├── README.md          # Provider documentation
│   │   ├── index.ts           # Exports indicesHandler
│   │   ├── adapter.ts         # Marketstack API fetch logic + benchmark mapping
│   │   ├── budget.ts          # Separate 250/day budget (ONE instance)
│   │   ├── scheduler.ts       # Clock-aligned slots (:05/:35)
│   │   └── indices.ts         # Indices feed config
│   │
│   └── fallback/              # ← Feeds with no provider
│       ├── README.md          # Explains why fallback exists
│       └── commodities.ts     # Returns NULL prices only (no demo!)
│
├── package.json
├── tsconfig.json
├── Dockerfile
└── fly.toml
```

### Why Provider-Based (Not Feed-Based)

The old structure (`feeds/fx.ts`, `feeds/crypto.ts`, etc.) **scattered provider logic**:

```
❌ OLD (Feed-Based):
feeds/fx.ts          → imports TwelveData adapter, shared budget
feeds/crypto.ts      → imports TwelveData adapter, shared budget
feeds/indices.ts     → imports Marketstack adapter, separate budget
feeds/commodities.ts → imports nothing, returns fallback

Problem: TwelveData budget logic is duplicated/scattered
Problem: Hard to debug "why is TwelveData over budget?"
Problem: Scheduler logic for same provider is in multiple files
```

The new structure **co-locates everything by provider**:

```
✅ NEW (Provider-Based):
twelvedata/
  ├── budget.ts      # ONE budget instance for ALL TwelveData feeds
  ├── scheduler.ts   # ONE scheduler for ALL TwelveData feeds
  ├── adapter.ts     # ONE adapter for ALL TwelveData API calls
  ├── fx.ts          # Just FX-specific config
  └── crypto.ts      # Just Crypto-specific config

Benefit: Debug TwelveData? Look in ONE folder
Benefit: Add TwelveData feed? Add to ONE folder
Benefit: TwelveData rate limit? Fix in ONE scheduler
```

### Line Count Comparison

| Component                | Before     | After      | Reduction |
| ------------------------ | ---------- | ---------- | --------- |
| server.ts                | 4,002      | ~250       | 94%       |
| lib/types.ts             | (inline)   | ~150       | —         |
| lib/cache.ts             | (×4)       | ~60        | —         |
| lib/circuit.ts           | (×2)       | ~50        | —         |
| lib/dedup.ts             | (×4)       | ~40        | —         |
| lib/feed-handler.ts      | (new)      | ~200       | —         |
| lib/logging.ts           | (new)      | ~30        | —         |
| twelvedata/index.ts      | (new)      | ~30        | —         |
| twelvedata/adapter.ts    | (inline)   | ~100       | —         |
| twelvedata/budget.ts     | (shared)   | ~80        | —         |
| twelvedata/scheduler.ts  | (new)      | ~60        | —         |
| twelvedata/fx.ts         | (inline)   | ~80        | —         |
| twelvedata/crypto.ts     | (inline)   | ~80        | —         |
| marketstack/index.ts     | (new)      | ~20        | —         |
| marketstack/adapter.ts   | (inline)   | ~100       | —         |
| marketstack/budget.ts    | (separate) | ~80        | —         |
| marketstack/scheduler.ts | (new)      | ~40        | —         |
| marketstack/indices.ts   | (inline)   | ~100       | —         |
| fallback/commodities.ts  | (inline)   | ~60        | —         |
| **TOTAL**                | **4,002**  | **~1,610** | **60%**   |

---

## Verification Checklist (All Passing)

### Final Verification (Jan 14, 2026)

```powershell
# TypeScript compiles
npx tsc --noEmit  # ✅ 0 errors

# All endpoints respond
(Invoke-RestMethod "https://promagen-api.fly.dev/health").status  # ✅ "ok"

# Data counts match
(Invoke-RestMethod "https://promagen-api.fly.dev/fx").data.Count          # ✅ 8
(Invoke-RestMethod "https://promagen-api.fly.dev/crypto").data.Count      # ✅ 8
(Invoke-RestMethod "https://promagen-api.fly.dev/indices").data.Count     # ✅ 8-16
(Invoke-RestMethod "https://promagen-api.fly.dev/commodities").meta.mode  # ✅ "fallback"

# Budgets tracked correctly (SEPARATE!)
$trace = Invoke-RestMethod "https://promagen-api.fly.dev/trace"
$trace.fx.mode           # ✅ "live" or "cached"
$trace.indices.mode      # ✅ "live"
$trace.crypto.mode       # ✅ "live" or "cached"
$trace.commodities.mode  # ✅ "fallback"
```

---

## Success Criteria (All Met)

| Criterion                     | Target               | Result        | Status |
| ----------------------------- | -------------------- | ------------- | ------ |
| TypeScript compiles           | 0 errors             | 0 errors      | ✅     |
| No circular dependencies      | 0 errors             | 0 errors      | ✅     |
| All endpoints respond         | 200 OK               | 200 OK        | ✅     |
| FX data matches baseline      | Same structure       | Yes           | ✅     |
| Crypto data matches baseline  | Same structure       | Yes           | ✅     |
| Indices data matches baseline | Same structure       | Yes           | ✅     |
| Commodities returns fallback  | `mode: 'fallback'`   | Yes           | ✅     |
| TwelveData budget tracked     | State = 'ok'         | Yes           | ✅     |
| Marketstack budget tracked    | State = 'ok'         | Yes           | ✅     |
| server.ts < 300 lines         | ~250 lines           | ~250 lines    | ✅     |
| Total gateway < 2,000 lines   | ~1,610 lines         | ~1,600 lines  | ✅     |
| All guardrails pass           | 7/7                  | 7/7           | ✅     |

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

### 4. Route Key Consistency

**Problem:** Crypto config route returned `cryptos`, gateway expected `crypto`.
**Solution:** Audit all config routes for key consistency.
**Rule:** Add route key tests to prevent regression.

---

## Cross-References

| Document                    | What to Update                                    | Status |
| --------------------------- | ------------------------------------------------- | ------ |
| `promagen-api-brain-v2.md`  | Add §23 noting provider-based refactor complete   | ✅     |
| `api-calming-efficiency.md` | Update architecture diagram with provider folders | ✅     |
| `fly-v2.md`                 | Add §12 with new provider-based file structure    | ✅     |
| `ARCHITECTURE.md`           | Update gateway section with provider folders      | ✅     |

---

## Changelog

| Date       | Change                                                          |
| ---------- | --------------------------------------------------------------- |
| 2026-01-14 | **PM: ALL PHASES COMPLETE** ✅                                  |
|            | FX: Live via TwelveData                                         |
|            | Crypto: Live via TwelveData                                     |
|            | Indices: Live via Marketstack                                   |
|            | Commodities: Parked (returns null, no demo)                     |
|            | Fixed: Demo prices removed from all feeds                       |
|            | Fixed: Benchmark aliases (djia, tsx, russell_2000)              |
|            | Fixed: Crypto route key mismatch                                |
|            | Fixed: FX symbol encoding                                       |
| 2026-01-14 | Added Architectural Guardrails section (7 guardrails)           |
|            | Added README.md requirement for each provider folder            |
|            | Added ESLint no-cycle rule for circular dependency check        |
|            | Added shared interfaces (FeedScheduler, BudgetManagerInterface) |
|            | Added file count limits per folder                              |
|            | Added guardrail checklist for code reviews                      |
| 2026-01-14 | **Major rewrite:** Changed from feed-based to provider-based    |
|            | Added `twelvedata/`, `marketstack/`, `fallback/` folders        |
|            | Added scheduler.ts for clock-aligned slots                      |
|            | Added budget.ts per provider (shared vs separate)               |
|            | Updated migration phases: Phase 1 = TwelveData only             |
|            | Updated line count estimates for new structure                  |
| 2026-01-13 | Document created with feed-based blueprint                      |
| 2026-01-13 | Noted Commodities removed from TwelveData (provider TBD)        |

---

_This implementation blueprint is now COMPLETE. The gateway has been successfully refactored._

_**Key principle:** Code and docs must stay aligned. Any behaviour described here must be enforced in code (and vice versa)._
_**Critical rules:** (1) No demo/synthetic prices ever (`price: null` on failure). (2) Defaults and allowlists come only from frontend SSOT. (3) Snapshot-only fallback; no hardcoded defaults._
