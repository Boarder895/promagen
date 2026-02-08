# Promagen API Calming Efficiency

> **Authority Document** | Living reference for API cost control and efficiency  
> **Location:** `docs/authority/api-calming-efficiency.md`  
> **Companion:** `promagen-api-brain-v2.md` (architecture spec)  
> **Last updated:** 7 February 2026 — Full audit, all feeds verified against code

---

## Purpose

This document is the **single source of truth** for Promagen's API calming efficiency. It tracks:

- What calming techniques are implemented
- How effective each technique is (with metrics)
- What improvements are planned
- Lessons learned from incidents

**Goal:** Achieve and maintain **≤50% daily API budget usage per provider** while keeping all four data feeds (FX, Indices, Commodities, Weather) feeling "alive."

---

## Current Feed Status (Feb 7, 2026)

| Feed            | Status      | Provider       | Mode     | Data        |
| --------------- | ----------- | -------------- | -------- | ----------- |
| **FX**          | ✅ **LIVE** | TwelveData     | `cached` | Real prices |
| **Indices**     | ✅ **LIVE** | Marketstack    | `live`   | Real prices |
| **Commodities** | ✅ **LIVE** | Marketstack v2 | `live`   | Real prices |
| **Weather**     | ✅ **LIVE** | OpenWeatherMap | `cached` | Real data   |

> **Crypto** was removed entirely (no imports, no endpoint, no handler). Slots :20/:50 are now free.

---

## Current Efficiency Score

| Metric               | Target        | Current        | Status       |
| -------------------- | ------------- | -------------- | ------------ |
| TwelveData usage     | ≤50% of 800   | ~48–96 (6–12%) | 🟢 Excellent |
| Marketstack usage    | ≤50% of 3,333 | ~192 (5.8%)    | 🟢 Excellent |
| OpenWeatherMap usage | ≤50% of 1,000 | ~576 (57.6%)   | 🟡 Moderate  |
| Cache hit rate       | ≥95%          | ~98%           | 🟢 Excellent |
| P95 response time    | <200ms        | ~50ms (cached) | 🟢 Excellent |
| Budget blocks/month  | 0             | 0              | 🟢 Clean     |

**Overall Efficiency Grade: A**

_Last measured: February 7, 2026_

---

## Architecture Overview (Provider-Based)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 CALMING LAYERS (PROVIDER-BASED ARCHITECTURE)                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  LAYER 1: Frontend (Vercel)                                                 │
│  ├── Polling interval alignment (per feed schedule)                         │
│  ├── Visibility-aware backoff (6x when hidden)                              │
│  ├── Centralised polling store (one timer per feed globally)                │
│  ├── Client-side rate limiting (240 req/min)                                │
│  └── API Timing Stagger (prevents simultaneous upstream calls)              │
│      ├── FX:          :00, :30 (base schedule)       → TwelveData ✅        │
│      ├── Indices:     :05, :20, :35, :50 (15-min)   → Marketstack ✅       │
│      ├── Weather:     :10, :40 (30-min)              → OpenWeatherMap ✅    │
│      └── Commodities: rolling 5-min (not clock-aligned) → Marketstack ✅   │
│                                                                             │
│  LAYER 2: Gateway (Fly.io) — PROVIDER-BASED MODULES                         │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  twelvedata/          │  marketstack/            │  openweathermap/   │  │
│  │  ├── budget.ts        │  ├── budget.ts           │  ├── handler.ts    │  │
│  │  │   (800/day)        │  │   (3,333/day shared)  │  │   (1,000/day)  │  │
│  │  ├── scheduler.ts     │  ├── scheduler.ts        │  └── ...           │  │
│  │  │   (clock-aligned)  │  │   (:05/:20/:35/:50)   │                    │  │
│  │  ├── adapter.ts       │  ├── commodities-        │                    │  │
│  │  └── fx.ts ✅ LIVE    │  │   scheduler.ts        │                    │  │
│  │                       │  │   (rolling 5-min)      │                    │  │
│  │                       │  ├── indices.ts ✅ LIVE   │                    │  │
│  │                       │  └── commodities.ts ✅    │                    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  LAYER 3: Providers (Completely Separate Budgets)                           │
│  ┌─────────────────────┬──────────────────────────┬────────────────────┐    │
│  │ TwelveData (800/day)│ Marketstack (3,333/day)  │ OWM (1,000/day)   │    │
│  │ FX only ✅ LIVE     │ Indices + Commodities ✅ │ Weather ✅ LIVE    │    │
│  │ Clock-aligned       │ Indices: clock-aligned   │ Clock-aligned      │    │
│  │                     │ Commodities: rolling     │ :10, :40           │    │
│  └─────────────────────┴──────────────────────────┴────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Four-Feed Architecture (Feb 7, 2026)

All four data feeds share **identical calming architecture** with provider-specific configuration:

| Component              | FX                 | Indices                 | Commodities                   | Weather                 |
| ---------------------- | ------------------ | ----------------------- | ----------------------------- | ----------------------- |
| **Status**             | ✅ LIVE            | ✅ LIVE                 | ✅ LIVE                       | ✅ LIVE                 |
| **Gateway endpoint**   | `/fx`              | `/indices`              | `/commodities`                | `/weather`              |
| **Frontend API route** | `/api/fx`          | `/api/indices`          | `/api/commodities`            | `/api/weather`          |
| **Frontend hook**      | `use-fx-quotes.ts` | `use-indices-quotes.ts` | `use-commodities-quotes.ts`   | `use-fetch-interval.ts` |
| **Display location**   | FX Ribbon          | Exchange Cards          | Commodities Windows           | Weather Section         |
| **Cache key**          | `fx:ribbon:all`    | `indices:ribbon`        | per-commodity (e.g. `coffee`) | `weather:all`           |
| **TTL**                | 1800s (30 min)     | 7200s (2 hr)            | 7200s (2 hr) per-commodity    | 300s (5 min)            |
| **Refresh schedule**   | :00, :30           | :05, :20, :35, :50      | Rolling every 5 min           | :10, :40                |
| **Default items**      | 8 pairs            | 16 exchanges            | 7 commodities (2-3-2 groups)  | 48 cities (2 batches)   |
| **Provider**           | TwelveData         | Marketstack             | Marketstack v2                | OpenWeatherMap          |
| **Provider folder**    | `twelvedata/`      | `marketstack/`          | `marketstack/`                | `openweathermap/`       |
| **Daily budget**       | shared 800         | 3,333 (shared pool)     | 3,333 (shared pool) + 1K cap  | 1,000 (separate)        |
| **Calls/day**          | ~48–96             | ~96                     | ~288                          | ~576                    |

### API Timing Stagger (Critical)

To prevent simultaneous upstream calls, each feed refreshes at **staggered intervals**:

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

**Gateway Implementation (marketstack/scheduler.ts):**

```typescript
/**
 * Clock-aligned scheduler for Marketstack Indices.
 * UPDATED: 2026-01-31 — Changed to 15-minute refresh (4×/hour)
 *
 * Indices: :05, :20, :35, :50 — staggered from TwelveData feeds.
 */

const MARKETSTACK_SLOTS = {
  indices: [5, 20, 35, 50] as const, // Every 15 minutes
};
```

**Commodities Rolling Scheduler (marketstack/commodities-scheduler.ts):**

```typescript
/**
 * Rolling scheduler — NOT clock-aligned (by design).
 * Marketstack commodities: 1 commodity per API call (no batching).
 * 78 commodities × 5 min = 390 min (~6.5 hours) per full cycle.
 *
 * Queue order per cycle:
 * 1. Double-word IDs first (22 items, deterministic — URL encoding verification)
 * 2. Priority/default IDs next (deterministic)
 * 3. Remaining IDs SHUFFLED (Fisher-Yates randomisation)
 */

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
```

**Why clock-aligned for FX/Indices/Weather (not 90% TTL)?**

Old approach:

```typescript
// ❌ BAD: 90% of TTL creates drift
setInterval(() => refresh(), config.ttlSeconds * 1000 * 0.9);
// FX starts at :00, refreshes at :27, :54, :21, :48...
// Eventually feeds COLLIDE → rate limit exceeded!
```

New approach:

```typescript
// ✅ GOOD: Clock-aligned slots, never drift
setTimeout(() => {
  refresh();
  setInterval(() => refresh(), 15 * 60 * 1000); // Exactly 15 min for indices
}, getMsUntilNextSlot('indices')); // Wait for :05, :20, :35, or :50
// FX ALWAYS at :00, :30
// Indices ALWAYS at :05, :20, :35, :50
// Weather ALWAYS at :10, :40
// NEVER collide!
```

**Why rolling for Commodities (not clock-aligned)?**

- Marketstack v2 commodities endpoint: **1 commodity per call** (no batching)
- 78 commodities to cycle through
- Clock-aligned slots would mean cramming 78 calls into a single time window
- Rolling every 5 minutes spreads the load evenly
- Queue randomisation per cycle ensures fair distribution over time

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

---

## Implemented Techniques

### Technique Registry (All Four Feeds)

| #   | Technique                  | Layer    | Applied To        | Efficiency Impact                  | Status    |
| --- | -------------------------- | -------- | ----------------- | ---------------------------------- | --------- |
| 1   | **TTL Cache**              | Gateway  | FX, IDX, COM, WTH | High (95%+ hit rate)               | ✅ Active |
| 2   | **Request Deduplication**  | Gateway  | FX, IDX           | Medium (prevents thundering herd)  | ✅ Active |
| 3   | **Batch Requests**         | Gateway  | FX, IDX, WTH      | Critical (N symbols = 1 call)      | ✅ Active |
| 4   | **Stale-While-Revalidate** | Gateway  | FX, IDX, COM, WTH | Medium (UX smoothness)             | ✅ Active |
| 5   | **Background Refresh**     | Gateway  | FX, IDX, COM, WTH | Medium (proactive cache warm)      | ✅ Active |
| 6   | **Budget Management**      | Gateway  | FX, IDX, COM, WTH | Critical (hard stop)               | ✅ Active |
| 7   | **Circuit Breaker**        | Gateway  | FX, IDX, COM      | High (429/5xx protection)          | ✅ Active |
| 8   | **Clock-Aligned Refresh**  | Both     | FX, IDX, WTH      | Critical (no drift collisions)     | ✅ Active |
| 9   | **Visibility Backoff**     | Frontend | FX, IDX, COM      | Medium (6x slower when hidden)     | ✅ Active |
| 10  | **Centralised Polling**    | Frontend | FX, IDX, COM      | High (one timer globally)          | ✅ Active |
| 11  | **Client Rate Limiting**   | Frontend | All               | Low (defence in depth)             | ✅ Active |
| 12  | **SSOT Config**            | Both     | All               | Medium (no stale config)           | ✅ Active |
| 13  | **Provider Isolation**     | Gateway  | All               | High (separate budgets)            | ✅ Active |
| 14  | **Null Fallback**          | Gateway  | All               | N/A (no demo prices)               | ✅ Active |
| 15  | **Provider-Based Modules** | Gateway  | All               | High (clear ownership)             | ✅ Active |
| 16  | **Rolling Scheduler**      | Gateway  | COM               | High (even load distribution)      | ✅ Active |
| 17  | **Queue Randomisation**    | Gateway  | COM               | Medium (fair refresh distribution) | ✅ Active |

**Notes:**

- Technique #2 (Request Dedup): Commodities is implicit 1-at-a-time via rolling scheduler. Weather uses batch dedup.
- Technique #3 (Batch): Commodities cannot batch — Marketstack v2 supports 1 commodity per call. All others batch.
- Technique #8 (Clock-Aligned): Commodities uses ROLLING instead (by design — 78 items, 1-per-call API). All others clock-aligned.
- Techniques #16–17 are new (added Feb 7, 2026) to document commodities-specific calming.

---

## Budget Breakdown (Feb 7, 2026)

### Per-Provider Daily Usage

| Provider              | Feed        | Schedule                    | Calls/Day | Budget/Day     | Usage %   | Headroom |
| --------------------- | ----------- | --------------------------- | --------- | -------------- | --------- | -------- |
| TwelveData            | FX          | :00, :30 (2×/hr)            | ~48–96    | 800            | 6–12%     | ~88%     |
| Marketstack           | Indices     | :05, :20, :35, :50 (4×/hr)  | ~96       | 3,333 (shared) | 2.9%      | —        |
| Marketstack           | Commodities | Rolling 5-min               | ~288      | 3,333 (shared) | 8.6%      | —        |
| **Marketstack total** |             |                             | **~384**  | **3,333**      | **11.5%** | **~88%** |
| OpenWeatherMap        | Weather     | :10, :40 (2×/hr, 2 batches) | ~576      | 1,000          | 57.6%     | ~42%     |

### Marketstack Budget Detail

```
Plan: Professional ($49/month)
Monthly: 100,000 API calls
Daily:   100,000 ÷ 30 = 3,333 calls/day
Minute:  60 calls/min (generous cap)

Indices:     ~96 calls/day  (clock-aligned, batched)
Commodities: ~288 calls/day (rolling 5-min, 1-per-call)
─────────────────────────────────
Total:       ~384 calls/day  = 11.5% of 3,333

Separate budget trackers:
- marketstack/budget.ts        → shared pool 3,333/day (indices)
- marketstack/commodities-budget.ts → 1,000/day cap (commodities only)

The 1,000/day commodities cap prevents runaway usage from starving indices.
Both draw from the same API key (3,333/day total).
```

### TwelveData Budget Detail

```
Plan: Free tier
Daily: 800 API calls/day

FX only: ~48–96 calls/day (clock-aligned :00/:30)
─────────────────────────────────
Total:   ~48–96 calls/day = 6–12% of 800

Note: Crypto was removed. TwelveData now serves FX only.
Previous usage (~256/day with crypto) was ~32%.
Current usage is dramatically lower.
```

### OpenWeatherMap Budget Detail

```
Plan: Free tier
Daily: 1,000 API calls/day

Weather: 48 cities × 2 batches (24 each) × alternating hourly
~576 calls/day = 57.6%
─────────────────────────────────
Highest utilisation of any provider but within target.
```

---

## Commodities Scheduler — Deep Dive

The commodities feed has a unique architecture because Marketstack's v2 commodities endpoint supports **only 1 commodity per API call** (no batching).

### Scheduler Design

```
┌──────────────────────────────────────────────────────────────┐
│  COMMODITIES ROLLING SCHEDULER                               │
│                                                              │
│  Interval: 5 minutes between fetches                         │
│  Queue size: 78 commodities                                  │
│  Full cycle: 78 × 5 min = 390 min (~6.5 hours)              │
│  Cycles/day: ~3.7                                            │
│  Calls/day: ~288                                             │
│                                                              │
│  Queue order per cycle:                                      │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ 1. Double-word IDs (22 items, deterministic)          │    │
│  │    crude_oil, natural_gas, ttf_gas, iron_ore, ...     │    │
│  │    → Verify URL encoding fix works first              │    │
│  ├──────────────────────────────────────────────────────┤    │
│  │ 2. Priority/default IDs (deterministic)               │    │
│  │    User's selected commodities (from SSOT)            │    │
│  │    → Most-viewed commodities refresh early            │    │
│  ├──────────────────────────────────────────────────────┤    │
│  │ 3. Remaining IDs (SHUFFLED via Fisher-Yates)          │    │
│  │    Different random order every cycle                 │    │
│  │    → 78! permutations (~1.1 × 10^115)                │    │
│  │    → Even refresh distribution over time              │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  Calming layers:                                             │
│  ├── Per-commodity cache (7200s TTL, stale-while-revalidate) │
│  ├── Separate budget tracker (1,000/day cap)                 │
│  ├── Circuit breaker (3 failures → open 30s)                 │
│  ├── Min interval guard (2 min floor)                        │
│  └── Env override: COMMODITIES_REFRESH_INTERVAL_MS           │
└──────────────────────────────────────────────────────────────┘
```

### Cold-Start Behaviour

- Uncached commodities return `price: null` (renders as "—")
- NO demo/fallback prices ever
- After ~6.5 hours the full catalog is populated
- Priority/default commodities populate within first ~35 minutes

---

## Incident Log

### INC-005: Benchmark Mapping Mismatch (Jan 14, 2026)

**Severity:** Medium  
**Duration:** ~2 hours  
**Impact:** 3 exchanges showing "···" instead of prices

**Root cause:** Frontend catalog used `djia`, `tsx`, `russell_2000` as benchmark keys. Gateway only mapped `dow_jones`, `tsx_composite`, and didn't have `russell_2000` at all.

**Resolution:** Added aliases to `gateway/src/marketstack/adapter.ts`:

```typescript
djia: 'DJI.INDX',           // Alias for dow_jones
tsx: 'GSPTSE.INDX',         // Alias for tsx_composite
russell_2000: 'RUT.INDX',   // New mapping
```

**Prevention:**

- Document all benchmark mappings in `EXPECTED-INDICES-REFERENCE.md`
- Test all selected exchanges against gateway mappings before deploy
- Add validation that checks catalog keys exist in gateway

### INC-004: Budget Overrun Investigation (Jan 14, 2026)

**Severity:** Medium  
**Duration:** Resolved  
**Impact:** 454/800 TwelveData credits by 7:15 AM UTC (57%)

**Root cause:** Background refresh using 90% TTL intervals instead of clock-aligned slots, causing FX and Crypto to eventually refresh simultaneously.

**Resolution:** Implemented clock-aligned scheduler in `twelvedata/scheduler.ts`.

**Prevention:**

- Provider-based folder structure isolates concerns
- Single scheduler.ts per provider enforces timing
- Clock-aligned slots prevent drift

### INC-003: Indices Endpoint Missing (Jan 13, 2026)

**Severity:** Medium  
**Duration:** ~2 hours  
**Impact:** Exchange cards showed no index data

**Root cause:** Gateway deployed without `/indices` endpoint.

**Resolution:** Merged indices code into server.ts.

### INC-002: TTL Misconfiguration (Jan 10, 2026)

**Severity:** High  
**Duration:** ~4 hours  
**Impact:** 3x expected API usage

**Root cause:** FX_RIBBON_TTL_SECONDS was 300 instead of 1800.

### INC-001: API Usage Explosion (Jan 9, 2026)

**Severity:** Critical  
**Duration:** ~12 hours  
**Impact:** 400% budget overage

**Root cause:** Multiple calming bypasses.

---

## Quick Reference

### "Is it working?" Checklist

```powershell
# 1. Gateway healthy?
(Invoke-RestMethod "https://promagen-api.fly.dev/health").status
# Expected: "ok"

# 2. All feeds returning data?
(Invoke-RestMethod "https://promagen-api.fly.dev/fx").meta.mode          # "cached" or "live"
(Invoke-RestMethod "https://promagen-api.fly.dev/indices").meta.mode     # "live"
(Invoke-RestMethod "https://promagen-api.fly.dev/commodities").meta.mode # "live" or "cached"
(Invoke-RestMethod "https://promagen-api.fly.dev/weather") | Select-Object -First 1  # has data

# 3. Data counts?
(Invoke-RestMethod "https://promagen-api.fly.dev/fx").data.Count          # 8
(Invoke-RestMethod "https://promagen-api.fly.dev/indices").data.Count     # 8-16
(Invoke-RestMethod "https://promagen-api.fly.dev/commodities").data.Count # 7

# 4. Prices flowing?
(Invoke-RestMethod "https://promagen-api.fly.dev/fx").data[0].price       # number
(Invoke-RestMethod "https://promagen-api.fly.dev/indices").data | Select-Object id, price | Format-Table
(Invoke-RestMethod "https://promagen-api.fly.dev/commodities").data | Select-Object id, price | Format-Table

# 5. Commodities scheduler running?
(Invoke-RestMethod "https://promagen-api.fly.dev/trace").commodities.scheduler
# Expected: running: true, intervalMs: 300000, randomised: true
```

### Emergency Actions

| Situation           | Action                                        |
| ------------------- | --------------------------------------------- |
| TwelveData blocked  | Wait for midnight UTC reset                   |
| Marketstack blocked | Wait for midnight UTC reset                   |
| OWM blocked         | Wait for midnight UTC reset                   |
| Gateway down        | `fly status -a promagen-api`                  |
| Circuit open        | Wait for auto-reset (30s for commodities)     |
| Rate limited        | Check scheduler.ts — slots should not overlap |
| Budget overrun      | Check budget.ts / commodities-budget.ts       |
| Missing prices      | Check benchmark mapping in adapter.ts         |
| Commodities stale   | Check /trace → commodities.scheduler.running  |

---

## Changelog

| Date       | Version | Change                                                           |
| ---------- | ------- | ---------------------------------------------------------------- |
| 2026-02-07 | 6.0.0   | **Full audit: doc corrected to match reality**                   |
|            |         | REMOVED: Crypto feed (no longer exists)                          |
|            |         | ADDED: Commodities LIVE (Marketstack v2, rolling)                |
|            |         | ADDED: Weather LIVE (OpenWeatherMap, :10/:40)                    |
|            |         | FIXED: Indices schedule :05/:20/:35/:50 (4×/hr)                  |
|            |         | FIXED: Marketstack budget 3,333/day (Professional)               |
|            |         | FIXED: TwelveData usage 6–12% (FX only)                          |
|            |         | FIXED: Timing stagger diagram (4 feeds, 3 providers)             |
|            |         | ADDED: Techniques #16 Rolling Scheduler, #17 Queue Randomisation |
|            |         | ADDED: Commodities scheduler deep-dive section                   |
|            |         | ADDED: Per-provider budget breakdown tables                      |
|            |         | Updated all status tables, architecture diagram                  |
|            |         | Updated quick reference checklist for 4 feeds                    |
| 2026-01-14 | 5.0.0   | PM: All feeds verified LIVE                                      |
|            |         | FX: TwelveData → mode: cached ✅                                 |
|            |         | Indices: Marketstack → mode: live ✅                             |
|            |         | Crypto: TwelveData → mode: cached ✅                             |
|            |         | Commodities: Parked → mode: fallback (null prices)               |
|            |         | Added INC-005 benchmark mapping incident                         |
|            |         | Updated status tables to show LIVE                               |
| 2026-01-14 | 4.0.0   | Major update: Provider-based architecture                        |
|            |         | Updated architecture diagram for provider folders                |
|            |         | Changed timing stagger to clock-aligned slots                    |
|            |         | Added scheduler.ts specification per provider                    |
|            |         | Added INC-004 budget investigation                               |
|            |         | Updated budget calculations                                      |
|            |         | Added technique #15: Provider-Based Modules                      |
| 2026-01-13 | 3.0.0   | Added Indices feed (Marketstack provider)                        |
| 2026-01-12 | 2.0.0   | Three-feed architecture                                          |
| 2026-01-10 | 1.1.0   | Fixed TTL from 300s to 1800s                                     |
| 2026-01-09 | 1.0.0   | Initial document                                                 |

---

## Review Schedule

- **Weekly:** Check efficiency metrics against targets
- **Monthly:** Review incident log, update roadmap progress
- **Quarterly:** Assess if new techniques needed

**Next Review:** February 14, 2026

---

_This is a living document. Update it whenever calming techniques change or incidents occur._

_**Critical rule:** NEVER use demo/synthetic prices. When API fails, return last-known-good (stale) data. Only return null (renders as "—") when no data has ever been cached._
