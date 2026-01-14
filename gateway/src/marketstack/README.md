# Marketstack Provider

> **Location:** `gateway/src/marketstack/`  
> **Authority:** `docs/authority/GATEWAY-REFACTOR.md`

---

## Overview

This folder contains everything related to the **Marketstack API provider**.

| Aspect | Value |
|--------|-------|
| **Feeds** | Indices |
| **Daily budget** | 250 credits (SEPARATE from TwelveData) |
| **Minute limit** | 3 credits/minute |
| **Scheduler** | Clock-aligned :05/:35 |
| **API Endpoint** | v1 EOD (http://api.marketstack.com/v1/eod/latest) |

---

## Files

| File | Purpose |
|------|---------|
| `index.ts` | Exports `indicesHandler` |
| `budget.ts` | Separate budget instance (250/day) |
| `scheduler.ts` | Clock-aligned timing for Indices (:05/:35) |
| `adapter.ts` | Marketstack API fetch logic |
| `indices.ts` | Indices feed configuration |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Marketstack                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│            ┌─────────────────┐                      │
│            │  Indices Feed   │                      │
│            │   :05, :35      │                      │
│            └────────┬────────┘                      │
│                     │                               │
│              ┌──────▼──────┐                        │
│              │  Separate   │                        │
│              │   Budget    │                        │
│              │  (250/day)  │                        │
│              └─────────────┘                        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Clock-Aligned Scheduler

Indices refresh at :05 and :35 each hour, staggered from TwelveData feeds:

```
Hour timeline:
┌────┬────┬────┬────┬────┬────┬────┬────┬────┐
│:00 │:05 │:10 │:20 │:30 │:35 │:40 │:50 │:00 │
├────┼────┼────┼────┼────┼────┼────┼────┼────┤
│ FX │IDX │    │CRY │ FX │IDX │    │CRY │ FX │
└────┴────┴────┴────┴────┴────┴────┴────┴────┘
  ↑    ↑         ↑    ↑    ↑         ↑
  TD   MS        TD   TD   MS        TD
```

**Why 2-hour TTL for Indices?**

Stock market indices update less frequently than FX. Most markets are open 6-8 hours/day. A 2-hour TTL provides:
- Reasonable freshness during market hours
- Minimal API usage (fewer calls = more budget headroom)
- Smooth experience even during market closures

---

## Separate Budget

**Critical:** Marketstack has its own 250/day pool, completely independent of TwelveData.

- Indices call at :05 → spends from Marketstack budget
- FX call at :00 → spends from TwelveData budget (different pool)
- Budget exhaustion affects only this provider

This is why there's ONE `budget.ts` file in this folder, separate from TwelveData's.

---

## Symbol Mapping

Marketstack uses different symbol formats than other providers. Our adapter maps benchmark keys to Marketstack symbols:

| Benchmark Key | Marketstack Symbol |
|---------------|-------------------|
| sp500 | GSPC.INDX |
| nikkei_225 | N225.INDX |
| ftse_100 | FTSE.INDX |
| dax | GDAXI.INDX |

The full mapping is in `adapter.ts`.

---

## Security

| Layer | Protection |
|-------|------------|
| Input validation | All catalog data validated |
| API key handling | Dynamic from env, never logged |
| Rate limiting | Budget + circuit breaker |
| Error handling | Graceful degradation to fallback |
| HTTP | Uses HTTP (not HTTPS) per Marketstack free tier |

---

## Usage

```typescript
import { indicesHandler } from './marketstack/index.js';

// Initialize
await indicesHandler.init();

// Start clock-aligned refresh
indicesHandler.startBackgroundRefresh();

// Get data
const indicesData = await indicesHandler.getData();
```

---

## Cross-References

| Document | Section |
|----------|---------|
| `GATEWAY-REFACTOR.md` | Target Architecture |
| `promagen-api-brain-v2-book2.md` | §23 Provider-Based Architecture |
| `api-calming-efficiency.md` | Four-Feed Architecture |

---

_Last updated: January 14, 2026_
