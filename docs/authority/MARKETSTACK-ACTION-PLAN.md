# Marketstack Basic Plan - Exchange Coverage Action Plan

> **Status:** ✅ IMPLEMENTATION COMPLETE (Jan 13, 2026)  
> **Location:** `docs/authority/MARKETSTACK-ACTION-PLAN.md`

---

## Summary

| Metric | Value | Status |
|--------|-------|--------|
| **Your catalog** | 48 exchanges | ✅ Complete |
| **Marketstack Basic indices** | 86 indices | ✅ Verified |
| **Estimated coverage** | ~40-50 major markets | ✅ Mapped |
| **Plan cost** | $8.99/month (10,000 requests) | ✅ Active |
| **Gateway endpoint** | `/indices` | ✅ Deployed |
| **Frontend integration** | Exchange Card IndexRow | ✅ Live |

---

## Implementation Status

### Phase 1: Subscribe & Discover ✅ Complete

1. ✅ **Signed up for Basic plan** at marketstack.com ($8.99/mo)
2. ✅ **Called `/indexlist`** to get exact benchmark IDs
3. ✅ **Saved API key** as Fly.io secret: `MARKETSTACK_API_KEY`

```powershell
# API key configured
fly secrets set MARKETSTACK_API_KEY="..." -a promagen-api
```

### Phase 2: Map Benchmarks to Catalog ✅ Complete

All 48 exchanges in `exchanges.catalog.json` now have `marketstack` config:

```json
{
  "id": "tse-tokyo",
  "marketstack": {
    "benchmark": "nikkei_225",
    "indexName": "Nikkei 225"
  }
}
```

**File:** `frontend/src/data/exchanges/exchanges.catalog.json`

### Phase 3: Update Selected Exchanges ✅ Complete

Default 16 exchanges configured in `exchanges.selected.json`:

```json
{
  "ids": [
    "nzx-wellington",
    "asx-sydney",
    "tse-tokyo",
    "hkex-hong-kong",
    "set-bangkok",
    "nse-mumbai",
    "dfm-dubai",
    "bist-istanbul",
    "jse-johannesburg",
    "lse-london",
    "b3-sao-paulo",
    "bcba-buenos-aires",
    "sse-santiago",
    "cboe-chicago",
    "tsx-toronto",
    "nasdaq-san-francisco"
  ]
}
```

### Phase 4: Gateway Integration ✅ Complete

Gateway `/indices` endpoint implemented with:

- ✅ Marketstack API integration
- ✅ 2-hour cache TTL (7200 seconds)
- ✅ Budget management (250 credits/day)
- ✅ Circuit breaker protection
- ✅ Request deduplication
- ✅ Batch requests (all benchmarks in one call)
- ✅ Stale-while-revalidate
- ✅ Background refresh

**Endpoint:** `https://promagen-api.fly.dev/indices`

### Phase 5: Frontend Integration ✅ Complete

- ✅ `/api/indices` proxy route
- ✅ `/api/indices/config` SSOT endpoint
- ✅ `useIndicesQuotes` hook (polls at :05, :35)
- ✅ `IndexRow` component in ExchangeCard
- ✅ Index name always visible (from catalog)
- ✅ Price shows skeleton `···` until API data arrives

---

## Current Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     INDICES DATA FLOW                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. SSOT (Catalog)                                                  │
│     └── exchanges.catalog.json                                      │
│         ├── id: "tse-tokyo"                                         │
│         └── marketstack: { benchmark: "nikkei_225", indexName: ... }│
│                                                                     │
│  2. Gateway Init                                                    │
│     └── Fetches /api/indices/config on startup                      │
│         ├── Gets default exchange IDs                               │
│         └── Gets benchmark → exchange mapping                       │
│                                                                     │
│  3. Gateway /indices Endpoint                                       │
│     └── Called by frontend at :05, :35                              │
│         ├── Checks cache (7200s TTL)                                │
│         ├── If miss: calls Marketstack /v2/indexinfo                │
│         └── Returns IndexQuote[] with price, change, percentChange  │
│                                                                     │
│  4. Frontend Hook (useIndicesQuotes)                                │
│     └── Polls /api/indices at :05, :35                              │
│         ├── Builds Map<exchangeId, IndexQuoteData>                  │
│         └── Passes to ExchangeList → ExchangeCard                   │
│                                                                     │
│  5. Exchange Card                                                   │
│     └── IndexRow component                                          │
│         ├── Index name from catalog (always visible)                │
│         ├── Price/change from API (skeleton when loading)           │
│         └── Tick direction: up (▲ green), down (▼ red), flat (•)   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Exchange Card Display

```
┌─────────────────────────────────────────────────────────────────────┐
│  Tokyo Stock Exchange (TSE)       │  14:23   │   18°C              │
│  Tokyo           🇯🇵              │  ● Open  │    ☀️               │
├─────────────────────────────────────────────────────────────────────┤
│  Nikkei 225                           38,945.72  ▲ +312.45 (+0.81%)│
└─────────────────────────────────────────────────────────────────────┘

States:
- Loading: "Nikkei 225                                          ···"
- Live:    "Nikkei 225                 38,945.72  ▲ +312.45 (+0.81%)"
- Error:   "Nikkei 225                                          ···"
```

---

## API Budget Analysis

### Marketstack Basic Plan

| Metric | Value |
|--------|-------|
| Monthly limit | 10,000 requests |
| Daily budget | ~333 requests |
| Our TTL | 7200s (2 hours) |
| Refreshes/day | 12 |
| Benchmarks batched | 16 (1 request) |
| **Daily usage** | **~24 requests (7%)** |

### Credit Calculation

```
Daily usage = (24 hours × 60 min / 120 min TTL) × 1 batched request
            = 12 refreshes × 1 request
            = 12 requests/day

With ~2 credits per batched call = ~24 credits/day
Monthly = 24 × 30 = 720 credits (7% of 10,000)
```

**Verdict:** Well within Basic plan limits. No upgrade needed.

---

## Files Modified

### Frontend

| File | Purpose |
|------|---------|
| `src/data/exchanges/exchanges.catalog.json` | Added `marketstack` config to all 48 exchanges |
| `src/data/exchanges/exchanges.selected.json` | Default 16 exchange IDs |
| `src/data/exchanges/types.ts` | Added `MarketstackConfig` type |
| `src/data/exchanges/exchanges.schema.ts` | Added Zod schema for marketstack |
| `src/app/api/indices/route.ts` | Proxy to gateway `/indices` |
| `src/app/api/indices/config/route.ts` | SSOT endpoint for gateway |
| `src/hooks/use-indices-quotes.ts` | Polling hook (:05, :35 schedule) |
| `src/components/exchanges/types.ts` | Added `IndexQuoteData`, `indexName` |
| `src/components/exchanges/adapters.ts` | Pass `indexName` from catalog |
| `src/components/exchanges/exchange-card.tsx` | `IndexRow` + `IndexRowSkeleton` |
| `src/components/homepage/homepage-client.tsx` | Calls hook, passes to ExchangeList |
| `src/components/homepage/exchange-list.tsx` | Passes `indexByExchange` to cards |

### Gateway

| File | Purpose |
|------|---------|
| `gateway/src/server.ts` | `/indices` endpoint with full calming |

---

## Verification Commands

```powershell
# 1. Gateway /indices endpoint
Invoke-RestMethod -Uri "https://promagen-api.fly.dev/indices"
# Expected: JSON with data[] containing IndexQuote objects

# 2. Frontend /api/indices route
Invoke-RestMethod -Uri "https://promagen.com/api/indices"
# Expected: Same as above (proxied)

# 3. SSOT config endpoint
Invoke-RestMethod -Uri "https://promagen.com/api/indices/config"
# Expected: { defaultExchangeIds: [...], exchanges: [...] }

# 4. Budget status
(Invoke-RestMethod "https://promagen-api.fly.dev/trace").indicesBudget
# Expected: { dailyUsed: <number>, dailyLimit: 250, state: "ok" }
```

---

## Pro User Dropdown Behaviour (Future)

In the Promagen Pro tier dropdown:

**ACTIVE exchanges:**
- Selectable checkbox
- Shows live index data (price, change, %)

**COMING SOON exchanges:**
- Greyed out checkbox
- Badge: "Coming Soon"
- Tooltip: "Index data coming in future update"
- Still shows: Time, weather, open/closed status

**Implementation status:** 📋 Planned for Pro tier feature

---

## Indexinfo Response Format

```json
{
  "benchmark": "nikkei_225",
  "region": "japan",
  "country": "japan",
  "price": "38945.72",
  "price_change_day": "312.45",
  "percentage_day": "0.81%",
  "percentage_week": "2.06%",
  "percentage_month": "1.13%",
  "percentage_year": "18.54%",
  "date": "2026-01-13"
}
```

**Mapping to IndexQuote:**

| Marketstack Field | IndexQuote Field | Notes |
|-------------------|------------------|-------|
| `benchmark` | (lookup) | Maps to exchange ID |
| `price` | `price` | Parsed as number |
| `price_change_day` | `change` | Parsed as number |
| `percentage_day` | `percentChange` | Parsed, strip `%` |
| (derived) | `tick` | `up` if change > 0, `down` if < 0, else `flat` |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-13 | ✅ Phase 5 complete: Frontend integration live |
| 2026-01-13 | ✅ Phase 4 complete: Gateway `/indices` endpoint deployed |
| 2026-01-13 | ✅ Phase 3 complete: `exchanges.selected.json` configured |
| 2026-01-13 | ✅ Phase 2 complete: All 48 exchanges have `marketstack` config |
| 2026-01-13 | ✅ Phase 1 complete: API key configured in Fly.io |
| 2026-01-12 | Document created with implementation plan |

---

## Next Steps

1. ✅ ~~Sign up for Marketstack Basic ($8.99)~~
2. ✅ ~~Run `/indexlist` and save response~~
3. ✅ ~~Update `exchanges.catalog.json` with exact mappings~~
4. ✅ ~~Update `exchanges.selected.json` for free tier defaults~~
5. ✅ ~~Implement Gateway `/indices` endpoint~~
6. ✅ ~~Implement Exchange Card IndexRow component~~
7. ✅ ~~Add caching layer (2-hour TTL)~~
8. 📋 Implement Pro user dropdown with "Coming Soon" badges
9. 📋 Add index selection for Pro users (6-16 exchanges)

---

_This document tracks the Marketstack integration. See `api-calming-efficiency.md` for efficiency metrics._
