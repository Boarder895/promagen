# Marketstack Provider

> **Location:** `gateway/src/marketstack/`  
> **Authority:** `docs/authority/GATEWAY-REFACTOR.md`, `docs/authority/commodities.md`  
> **Last updated:** 8 March 2026

---

## Overview

This folder contains everything related to the **Marketstack API provider**, which serves **two feeds**: Indices and Commodities.

| Aspect | Indices | Commodities |
|--------|---------|-------------|
| **Feed type** | Stock exchange index prices | Everyday commodity prices |
| **Items** | Per exchange catalog | 34 commodities |
| **Scheduler** | Clock-aligned :05/:20/:35/:50 | Rolling 2.5-min timer |
| **API endpoint** | v1 EOD (`/v1/eod/latest`) | v2 Commodities (`/v2/commodities`) |
| **Batching** | Multiple symbols per call | 1 commodity per call |
| **Cache TTL** | 2 hours | 2 hours (per commodity) |
| **Budget tracker** | `budget.ts` (3,333/day shared pool) | `commodities-budget.ts` (1,000/day cap) |

Both feeds draw from the same Marketstack API key (Professional tier: 100K/month).

---

## Budget Math

| Metric | Indices | Commodities | Combined |
|--------|---------|-------------|----------|
| Calls per day | ~96 | ~576 | ~672 |
| Budget cap | 3,333/day (shared) | 1,000/day (separate tracker) | — |
| Usage | ~2.9% | ~17.3% | ~20% |
| Headroom | — | — | **~80%** |

The Professional tier provides 3,333 calls/day. At 20% usage there is substantial headroom for spikes, retries, and future feeds.

---

## Files

| File | Purpose |
|------|---------|
| `index.ts` | Central exports: `indicesHandler`, `commoditiesHandler`, budgets, schedulers, adapters |
| **Indices** | |
| `indices.ts` | Indices feed: init, data access, background refresh |
| `adapter.ts` | Marketstack v1 EOD fetch logic, symbol mapping |
| `budget.ts` | Indices budget tracker (3,333/day shared pool) |
| `scheduler.ts` | Clock-aligned scheduler (:05, :20, :35, :50) |
| **Commodities** | |
| `commodities.ts` | Commodities feed: init, data access, cache, background refresh |
| `commodities-adapter.ts` | Marketstack v2 commodities fetch logic, 34-item ID→name mapping, cents-to-dollars |
| `commodities-budget.ts` | Commodities budget tracker (1,000/day cap, separate from indices) |
| `commodities-scheduler.ts` | Rolling 2.5-min Fisher-Yates shuffle scheduler |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Marketstack                            │
│                (1 API key, 3,333/day)                       │
├──────────────────────────┬──────────────────────────────────┤
│                          │                                  │
│   ┌──────────────────┐   │   ┌──────────────────────────┐   │
│   │   Indices Feed   │   │   │   Commodities Feed       │   │
│   │  :05 :20 :35 :50 │   │   │   Rolling 2.5-min        │   │
│   │  (clock-aligned) │   │   │   (Fisher-Yates shuffle)  │   │
│   └────────┬─────────┘   │   └────────────┬─────────────┘   │
│            │             │                │                 │
│    ┌───────▼───────┐     │    ┌───────────▼───────────┐     │
│    │ Budget (shared)│    │    │ Budget (1,000/day cap) │     │
│    │  3,333/day     │    │    │ Separate tracker       │     │
│    └───────────────┘     │    └───────────────────────┘     │
│                          │                                  │
│    v1 EOD endpoint       │    v2 Commodities endpoint       │
│    Batch: multiple       │    Batch: 1 per call             │
│    ~96 calls/day         │    ~576 calls/day                │
│                          │                                  │
└──────────────────────────┴──────────────────────────────────┘
```

---

## Indices: Clock-Aligned Scheduler

Indices refresh at :05, :20, :35, :50 each hour, staggered from TwelveData feeds:

```
Hour timeline:
┌────┬────┬────┬────┬────┬────┬────┬────┬────┐
│:00 │:05 │:10 │:20 │:30 │:35 │:40 │:50 │:00 │
├────┼────┼────┼────┼────┼────┼────┼────┼────┤
│ FX │IDX │    │IDX │ FX │IDX │    │IDX │ FX │
└────┴────┴────┴────┴────┴────┴────┴────┴────┘
  ↑    ↑         ↑    ↑    ↑         ↑
  TD   MS        MS   TD   MS        MS
```

**Why 2-hour TTL?** Stock indices update less frequently than FX. Most markets are open 6–8 hours/day. A 2-hour TTL provides reasonable freshness with minimal API usage.

---

## Commodities: Rolling Scheduler

The commodities scheduler cycles through all 34 items using a Fisher-Yates shuffle, fetching one commodity every 2.5 minutes.

| Metric | Value |
|--------|-------|
| Items in queue | 34 |
| Fetch interval | 2.5 minutes |
| Full cycle time | ~85 min (~1.4 hours) |
| Cycles per day | ~17 |
| Calls per day | ~576 |
| Randomisation | Full Fisher-Yates shuffle each cycle |
| Safety floor | 2 minutes (enforced minimum) |

**Why rolling instead of clock-aligned?** The Marketstack commodities endpoint only supports 1 commodity per call (no batching). A rolling timer fetches continuously without complex slot math.

**The 34 commodities** are everyday store-shelf items across three groups:

| Group | Count | Examples |
|-------|-------|---------|
| Agriculture | 28 | Coffee, wheat, beef, eggs, salmon, sugar, cocoa |
| Metals | 4 | Gold, silver, platinum, lumber |
| Energy | 1 | Gasoline |

---

## Separate Budgets

**Critical:** Indices and commodities have **separate budget trackers** even though they share one API key.

- `budget.ts` — Indices tracker (3,333/day pool, shared with API key total)
- `commodities-budget.ts` — Commodities tracker (1,000/day cap)

Both trackers report independently in `/trace` for clean per-feed visibility. The 1,000/day commodity cap prevents runaway usage from starving indices.

---

## Symbol Mapping

### Indices

Marketstack uses `.INDX` suffix symbols. The adapter maps benchmark keys:

| Benchmark Key | Marketstack Symbol |
|---------------|-------------------|
| sp500 | GSPC.INDX |
| nikkei_225 | N225.INDX |
| ftse_100 | FTSE.INDX |
| dax | GDAXI.INDX |

Full mapping in `adapter.ts`.

### Commodities

Catalog IDs map to Marketstack `commodity_name` parameter values:

| Catalog ID | Marketstack Name |
|------------|-----------------|
| orange_juice | orange juice |
| lean_hogs | lean hogs |
| eggs_ch | eggs ch |
| palm_oil | palm oil |

Most single-word IDs map directly (gold → gold, coffee → coffee). Full mapping in `commodities-adapter.ts`.

**Cents-to-dollars:** 11 US-exchange commodities are quoted in cents (coffee, sugar, cotton, orange_juice, corn, wheat, soybeans, oat, live_cattle, lean_hogs, feeder_cattle). The adapter divides by 100 automatically.

---

## Security

| Layer | Protection |
|-------|------------|
| Input validation | All catalog data Zod-validated |
| API key handling | Dynamic from env at call time, never cached or logged |
| Rate limiting | Per-feed budget trackers + circuit breaker |
| Error handling | Graceful degradation to cached/fallback data |
| HTTPS | Professional tier (HTTPS enabled) |

---

## Usage

```typescript
import {
  indicesHandler,
  commoditiesHandler,
} from './marketstack/index.js';

// Initialize both feeds
await indicesHandler.init();
await commoditiesHandler.init();

// Start background refresh
indicesHandler.startBackgroundRefresh();
commoditiesHandler.startBackgroundRefresh();

// Get data
const indicesData = await indicesHandler.getData();
const commoditiesData = await commoditiesHandler.getData();
```

---

## Cross-References

| Document | Section |
|----------|---------|
| `GATEWAY-REFACTOR.md` | Target Architecture |
| `commodities.md` | Commodities System Architecture |
| `promagen-api-brain-v2-book2.md` | §23 Provider-Based Architecture |
| `api-calming-efficiency.md` | Four-Feed Architecture |
| `paid_tier.md` | Monetisation boundaries (same feed for free and paid) |
