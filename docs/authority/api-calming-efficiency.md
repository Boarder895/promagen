# Promagen API Calming Efficiency

> **Authority Document** | Living reference for API cost control and efficiency  
> **Location:** `docs/authority/api-calming-efficiency.md`  
> **Companion:** `promagen-api-brain-v2.md` (architecture spec)  
> **Last updated:** 14 January 2026 (PM) — All feeds verified LIVE

---

## Purpose

This document is the **single source of truth** for Promagen's API calming efficiency. It tracks:

- What calming techniques are implemented
- How effective each technique is (with metrics)
- What improvements are planned
- Lessons learned from incidents

**Goal:** Achieve and maintain **≤50% daily API budget usage per provider** while keeping all four data feeds (FX, Indices, Commodities, Crypto) feeling "alive."

---

## Current Feed Status (Jan 14, 2026 PM)

| Feed            | Status      | Provider    | Mode     | Data |
| --------------- | ----------- | ----------- | -------- | ---- |
| **FX**          | ✅ **LIVE** | TwelveData  | `cached` | Real prices |
| **Indices**     | ✅ **LIVE** | Marketstack | `live`   | Real prices |
| **Crypto**      | ✅ **LIVE** | TwelveData  | `cached` | Real prices |
| **Commodities** | ⏸️ PARKED   | None        | `fallback` | null (—) |

---

## Current Efficiency Score

| Metric              | Target       | Current        | Status       |
| ------------------- | ------------ | -------------- | ------------ |
| TwelveData usage    | ≤50% of 800  | ~256 (32%)     | 🟢 Excellent |
| Marketstack usage   | ≤50% of 250  | ~24 (10%)      | 🟢 Excellent |
| Cache hit rate      | ≥95%         | ~98%           | 🟢 Excellent |
| P95 response time   | <200ms       | ~50ms (cached) | 🟢 Excellent |
| Budget blocks/month | 0            | 0              | 🟢 Clean     |

**Overall Efficiency Grade: A**

_Last measured: January 14, 2026_

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
│      ├── Indices:     :05, :35 (5-min offset)        → Marketstack ✅       │
│      ├── Commodities: parked (no calls)              → None ⏸️              │
│      └── Crypto:      :20, :50 (20-min offset)       → TwelveData ✅        │
│                                                                             │
│  LAYER 2: Gateway (Fly.io) — PROVIDER-BASED MODULES                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  twelvedata/                    │  marketstack/    │  fallback/     │    │
│  │  ├── budget.ts (800/day SHARED) │  ├── budget.ts   │  └── commodities│   │
│  │  ├── scheduler.ts (clock-aligned)│  │   (250/day)  │      (null only)│   │
│  │  ├── adapter.ts                 │  ├── scheduler.ts│                │    │
│  │  ├── fx.ts ✅ LIVE              │  └── indices.ts  │                │    │
│  │  └── crypto.ts ✅ LIVE          │      ✅ LIVE     │                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  LAYER 3: Providers (Completely Separate Budgets)                           │
│  ┌─────────────────────────────────┬───────────────────────────────────┐    │
│  │   TwelveData (800/day)          │   Marketstack (250/day)           │    │
│  │   FX + Crypto ✅ LIVE           │   Indices only ✅ LIVE            │    │
│  │   Clock-aligned: never overlap  │   Separate budget, separate slots │    │
│  └─────────────────────────────────┴───────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Four-Feed Architecture (Jan 14, 2026)

All four data feeds share **identical calming architecture** with provider-specific configuration:

| Component               | FX                      | Indices                  | Commodities              | Crypto                   |
| ----------------------- | ----------------------- | ------------------------ | ------------------------ | ------------------------ |
| **Status**              | ✅ LIVE                 | ✅ LIVE                  | ⏸️ PARKED                | ✅ LIVE                  |
| **Gateway endpoint**    | `/fx`                   | `/indices`               | `/commodities`           | `/crypto`                |
| **Frontend API route**  | `/api/fx`               | `/api/indices`           | `/api/commodities`       | `/api/crypto`            |
| **Frontend hook**       | `use-fx-quotes.ts`      | `use-indices-quotes.ts`  | N/A (parked)             | `use-crypto-quotes.ts`   |
| **Display location**    | FX Ribbon               | Exchange Cards           | Commodities Ribbon       | Crypto Ribbon            |
| **Cache key**           | `fx:ribbon:all`         | `indices:default`        | `commodities:ribbon:all` | `crypto:ribbon:all`      |
| **TTL**                 | 1800s (30 min)          | 7200s (2 hr)             | N/A                      | 1800s (30 min)           |
| **Refresh schedule**    | :00, :30                | :05, :35                 | N/A (parked)             | :20, :50                 |
| **Default items**       | 8 pairs                 | 16 exchanges             | 8 commodities            | 8 cryptocurrencies       |
| **Provider**            | TwelveData              | Marketstack              | None (parked)            | TwelveData               |
| **Provider folder**     | `twelvedata/`           | `marketstack/`           | `fallback/`              | `twelvedata/`            |
| **Daily budget**        | shared 800              | 250 (separate)           | 0 (no calls)             | shared 800               |

### API Timing Stagger (Critical)

To prevent simultaneous upstream calls, each feed refreshes at **clock-aligned intervals**:

```
Hour timeline (every hour):
┌────┬────┬────┬────┬────┬────┬────┬────┬────┐
│:00 │:05 │:10 │:20 │:30 │:35 │:40 │:50 │:00 │
├────┼────┼────┼────┼────┼────┼────┼────┼────┤
│ FX │IDX │    │CRY │ FX │IDX │    │CRY │ FX │
└────┴────┴────┴────┴────┴────┴────┴────┴────┘
  ↑    ↑         ↑    ↑    ↑         ↑
  TD   MS        TD   TD   MS        TD

TD = TwelveData (shared 800/day budget)
MS = Marketstack (separate 250/day budget)
```

**Gateway Implementation (twelvedata/scheduler.ts):**

```typescript
/**
 * Clock-aligned scheduler for TwelveData feeds.
 * Guarantees only ONE TwelveData feed refreshes per slot.
 */

export type TwelveDataFeed = 'fx' | 'crypto';

const FEED_SLOTS: Record<TwelveDataFeed, number[]> = {
  fx: [0, 30],      // Minutes 0 and 30
  crypto: [20, 50], // Minutes 20 and 50
};

export function getMsUntilNextSlot(feed: TwelveDataFeed): number {
  const now = new Date();
  const currentMinute = now.getMinutes();
  const slots = FEED_SLOTS[feed];

  let nextSlot = slots.find(s => s > currentMinute);
  if (!nextSlot) {
    nextSlot = slots[0] + 60; // Wrap to next hour
  }

  const minutesUntil = nextSlot - currentMinute;
  return Math.max(1000, minutesUntil * 60_000 - now.getSeconds() * 1000);
}
```

**Why clock-aligned (not 90% TTL)?**

Old approach:
```typescript
// ❌ BAD: 90% of TTL creates drift
setInterval(() => refresh(), config.ttlSeconds * 1000 * 0.9);
// FX starts at :00, refreshes at :27, :54, :21, :48...
// Crypto starts at :15, refreshes at :42, :09, :36...
// Eventually they COLLIDE → rate limit exceeded!
```

New approach:
```typescript
// ✅ GOOD: Clock-aligned slots, never drift
setTimeout(() => {
  refresh();
  setInterval(() => refresh(), 30 * 60 * 1000); // Exactly 30 min
}, getMsUntilNextSlot('fx')); // Wait for :00 or :30
// FX ALWAYS at :00, :30
// Crypto ALWAYS at :20, :50
// NEVER collide!
```

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

---

## Implemented Techniques

### Technique Registry (All Four Feeds)

| #   | Technique                  | Layer    | Applied To            | Efficiency Impact                 | Status    |
| --- | -------------------------- | -------- | --------------------- | --------------------------------- | --------- |
| 1   | **TTL Cache**              | Gateway  | FX, IDX, CRY          | High (95%+ hit rate)              | ✅ Active |
| 2   | **Request Deduplication**  | Gateway  | FX, IDX, CRY          | Medium (prevents thundering herd) | ✅ Active |
| 3   | **Batch Requests**         | Gateway  | FX, IDX, CRY          | Critical (N symbols = 1 call)     | ✅ Active |
| 4   | **Stale-While-Revalidate** | Gateway  | FX, IDX, CRY          | Medium (UX smoothness)            | ✅ Active |
| 5   | **Background Refresh**     | Gateway  | FX, IDX, CRY          | Medium (proactive cache warm)     | ✅ Active |
| 6   | **Budget Management**      | Gateway  | FX, IDX, CRY          | Critical (hard stop)              | ✅ Active |
| 7   | **Circuit Breaker**        | Gateway  | FX, IDX, CRY          | High (429/5xx protection)         | ✅ Active |
| 8   | **Clock-Aligned Refresh**  | Both     | FX, IDX, CRY          | Critical (no drift collisions)    | ✅ Active |
| 9   | **Visibility Backoff**     | Frontend | FX, IDX, CRY          | Medium (6x slower when hidden)    | ✅ Active |
| 10  | **Centralised Polling**    | Frontend | FX, IDX, CRY          | High (one timer globally)         | ✅ Active |
| 11  | **Client Rate Limiting**   | Frontend | All                   | Low (defence in depth)            | ✅ Active |
| 12  | **SSOT Config**            | Both     | All                   | Medium (no stale config)          | ✅ Active |
| 13  | **Provider Isolation**     | Gateway  | All                   | High (separate budgets)           | ✅ Active |
| 14  | **Null Fallback**          | Gateway  | All                   | N/A (no demo prices)              | ✅ Active |
| 15  | **Provider-Based Modules** | Gateway  | All                   | High (clear ownership)            | ✅ Active |

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
(Invoke-RestMethod "https://promagen-api.fly.dev/crypto").meta.mode      # "cached" or "live"
(Invoke-RestMethod "https://promagen-api.fly.dev/commodities").meta.mode # "fallback"

# 3. Data counts?
(Invoke-RestMethod "https://promagen-api.fly.dev/fx").data.Count          # 8
(Invoke-RestMethod "https://promagen-api.fly.dev/indices").data.Count     # 8-16
(Invoke-RestMethod "https://promagen-api.fly.dev/crypto").data.Count      # 8

# 4. Prices flowing?
(Invoke-RestMethod "https://promagen-api.fly.dev/fx").data[0].price       # number
(Invoke-RestMethod "https://promagen-api.fly.dev/crypto").data[0].price   # number
(Invoke-RestMethod "https://promagen-api.fly.dev/indices").data | Select-Object id, price | Format-Table
```

### Emergency Actions

| Situation              | Action                                           |
| ---------------------- | ------------------------------------------------ |
| TwelveData blocked     | Wait for midnight UTC reset                      |
| Marketstack blocked    | Wait for midnight UTC reset                      |
| Gateway down           | `fly status -a promagen-api`                     |
| Circuit open           | Wait for auto-reset (15-60s)                     |
| Rate limited           | Check scheduler.ts — slots should not overlap    |
| Budget overrun         | Check twelvedata/budget.ts — single instance?    |
| Missing prices         | Check benchmark mapping in adapter.ts            |

---

## Changelog

| Date       | Version | Change                                                    |
| ---------- | ------- | --------------------------------------------------------- |
| 2026-01-14 | 5.0.0   | **PM: All feeds verified LIVE**                           |
|            |         | FX: TwelveData → mode: cached ✅                          |
|            |         | Indices: Marketstack → mode: live ✅                      |
|            |         | Crypto: TwelveData → mode: cached ✅                      |
|            |         | Commodities: Parked → mode: fallback (null prices)        |
|            |         | Added INC-005 benchmark mapping incident                  |
|            |         | Updated status tables to show LIVE                        |
| 2026-01-14 | 4.0.0   | **Major update: Provider-based architecture**             |
|            |         | Updated architecture diagram for provider folders         |
|            |         | Changed timing stagger to clock-aligned slots             |
|            |         | Added scheduler.ts specification per provider             |
|            |         | Added INC-004 budget investigation                        |
|            |         | Updated budget calculations                               |
|            |         | Added technique #15: Provider-Based Modules               |
| 2026-01-13 | 3.0.0   | Added Indices feed (Marketstack provider)                 |
| 2026-01-12 | 2.0.0   | Three-feed architecture                                   |
| 2026-01-10 | 1.1.0   | Fixed TTL from 300s to 1800s                              |
| 2026-01-09 | 1.0.0   | Initial document                                          |

---

## Review Schedule

- **Weekly:** Check efficiency metrics against targets
- **Monthly:** Review incident log, update roadmap progress
- **Quarterly:** Assess if new techniques needed

**Next Review:** January 21, 2026

---

_This is a living document. Update it whenever calming techniques change or incidents occur._

_**Critical rule:** NEVER use demo/synthetic prices. Fallback returns null, renders as "—"._
