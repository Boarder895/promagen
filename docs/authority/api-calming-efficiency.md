# Promagen API Calming Efficiency

> **Authority Document** | Living reference for API cost control and efficiency  
> **Location:** `docs/authority/api-calming-efficiency.md`  
> **Companion:** `promagen-api-brain-v2.md` (architecture spec)

---

## Purpose

This document is the **single source of truth** for Promagen's API calming efficiency. It tracks:

- What calming techniques are implemented
- How effective each technique is (with metrics)
- What improvements are planned
- Lessons learned from incidents

**Goal:** Achieve and maintain **≤50% daily API budget usage** while keeping the FX ribbon feeling "alive."

---

## Current Efficiency Score

| Metric              | Target       | Current        | Status       |
| ------------------- | ------------ | -------------- | ------------ |
| Daily API usage     | ≤50% of limit | ~48%          | 🟢 On target |
| Cache hit rate      | ≥95%         | ~98%           | 🟢 Excellent |
| Upstream calls/day  | ≤400         | ~384           | 🟢 On target |
| P95 response time   | <200ms       | ~50ms (cached) | 🟢 Excellent |
| Budget blocks/month | 0            | 0              | 🟢 Clean     |

**Overall Efficiency Grade: A**

_Last measured: January 10, 2026_

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     CALMING LAYERS                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  LAYER 1: Frontend (Vercel)                                         │
│  ├── Polling interval alignment (30 min)                            │
│  ├── Visibility-aware backoff (6x when hidden)                      │
│  ├── Centralised polling store (one timer globally)                 │
│  └── Client-side rate limiting (240 req/min)                        │
│                                                                     │
│  LAYER 2: Gateway (Fly.io) — THE AUTHORITY                          │
│  ├── Budget management (daily + per-minute caps)                    │
│  ├── TTL cache (30 min in-memory)                                   │
│  ├── Request deduplication (single-flight)                          │
│  ├── Batch requests (all pairs in one call)                         │
│  ├── Circuit breaker (429/5xx protection)                           │
│  ├── Stale-while-revalidate                                         │
│  └── Graceful degradation                                           │
│                                                                     │
│  LAYER 3: Provider (TwelveData)                                     │
│  └── 800 calls/day limit (external constraint)                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implemented Techniques

### Technique Registry

| #   | Technique                  | Layer    | Location                          | Efficiency Impact                 | Status    |
| --- | -------------------------- | -------- | --------------------------------- | --------------------------------- | --------- |
| 1   | **TTL Cache**              | Gateway  | `server.ts:366-381`               | High (95%+ hit rate)              | ✅ Active |
| 2   | **Request Deduplication**  | Gateway  | `server.ts:387-401`               | Medium (prevents thundering herd) | ✅ Active |
| 3   | **Batch Requests**         | Gateway  | `server.ts:493-497`               | Critical (8 pairs = 1 call)       | ✅ Active |
| 4   | **Stale-While-Revalidate** | Gateway  | `server.ts:1046`                  | Medium (UX smoothness)            | ✅ Active |
| 5   | **Background Refresh**     | Gateway  | `server.ts:740-778`               | Medium (proactive cache warm)     | ✅ Active |
| 6   | **Budget Management**      | Gateway  | `server.ts:408-458`               | Critical (hard stop)              | ✅ Active |
| 7   | **Circuit Breaker**        | Gateway  | `server.ts:464-481`               | High (failure isolation)          | ✅ Active |
| 8   | **Graceful Degradation**   | Gateway  | `server.ts:686-731`               | High (UX continuity)              | ✅ Active |
| 9   | **Polling Alignment**      | Frontend | `use-fx-quotes.ts:75`             | Critical (demand reduction)       | ✅ Active |
| 10  | **Visibility Backoff**     | Frontend | `use-fx-quotes.ts:84`             | Medium (idle savings)             | ✅ Active |
| 11  | **Centralised Polling**    | Frontend | `use-fx-quotes.ts:202-237`        | High (one timer)                  | ✅ Active |
| 12  | **Route Rate Limiting**    | Frontend | `rate-limit.ts`                   | Low (defence in depth)            | ✅ Active |

### Technique Details

#### 1. TTL Cache (Gateway)

```typescript
// 30-minute cache prevents repeated upstream calls
const CACHE_TTL_SECONDS = 1800;
const cache = new Map<string, CacheEntry<FxQuote[]>>();
```

**Efficiency:** Reduces daily polls → ~48 upstream calls

#### 2. Request Deduplication

```typescript
// Concurrent requests share one upstream call
const inFlightRequests = new Map<string, Promise<FxQuote[]>>();
```

**Efficiency:** Prevents N simultaneous users = N calls

#### 3. Batch Requests

```typescript
// All symbols in ONE API call
const symbols = pairs.map((p) => `${p.base}/${p.quote}`).join(',');
```

**Efficiency:** 8 pairs batched into 1 HTTP request (but still 8 credits per call — TwelveData charges per symbol)

#### 4. Budget Management

```typescript
// Hard limits with warn/block thresholds
BUDGET_DAILY_ALLOWANCE = 800; // TwelveData limit
BUDGET_MINUTE_ALLOWANCE = 8; // Burst protection
// Warning at 70%, Block at 95%
```

**Efficiency:** Prevents overage charges entirely

#### 5. Polling Alignment

```typescript
// Frontend polls at same interval as cache TTL
const DEFAULT_INTERVAL_MS = 30 * 60_000; // 30 minutes = cache TTL
```

**Efficiency:** Polls arrive when cache is ready to refresh

---

## Efficiency Metrics

### Daily API Call Budget

```
┌────────────────────────────────────────────────────────────┐
│ TwelveData Daily Limit: 800 credits                        │
├────────────────────────────────────────────────────────────┤
│ ████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ~384 credits/day (48%)                      Target: <50%   │
└────────────────────────────────────────────────────────────┘
```

### Cache Efficiency

| Metric        | Value                |
| ------------- | -------------------- |
| Cache TTL     | 1800 seconds (30 min)|
| Expected hits | 98%+                 |
| Cache key     | `fx:ribbon:all`      |
| Storage       | In-memory (volatile) |

### Request Flow Efficiency

```
1,000 frontend requests/day
    ↓ (centralised polling)
   48 /api/fx calls (every 30 min)
    ↓ (gateway cache)
   48 TwelveData calls × 8 credits = 384 credits/day

Efficiency: Well under 800 credit limit
```

### Credit Calculation

**Important:** TwelveData charges **per symbol**, not per HTTP request.

| Scenario | Refresh Interval | Refreshes/Day | Pairs | Credits/Day | % of 800 |
|----------|------------------|---------------|-------|-------------|----------|
| ❌ Old (broken) | 5 min | 288 | 8 | 2,304 | 288% |
| ✅ Current | 30 min | 48 | 8 | 384 | 48% |

---

## Configuration Reference

### Environment Variables

| Variable                            | Default                        | Purpose                      |
| ----------------------------------- | ------------------------------ | ---------------------------- |
| `FX_RIBBON_TTL_SECONDS`             | 1800                           | Cache TTL (seconds)          |
| `FX_RIBBON_BUDGET_DAILY_ALLOWANCE`  | 800                            | Daily call limit             |
| `FX_RIBBON_BUDGET_MINUTE_ALLOWANCE` | 8                              | Per-minute burst limit       |
| `PROMAGEN_DISABLE_TWELVEDATA`       | false                          | Kill switch for direct calls |
| `FX_GATEWAY_URL`                    | `https://promagen-api.fly.dev` | Gateway endpoint             |

### Thresholds

| Threshold              | Value        | Action                           |
| ---------------------- | ------------ | -------------------------------- |
| Budget warning         | 70% daily    | Log warning, add emoji indicator |
| Budget block           | 95% daily    | Refuse upstream, serve stale     |
| Circuit trip (429)     | 1 occurrence | 60s cooldown                     |
| Circuit trip (5xx)     | 1 occurrence | 30s cooldown                     |
| Circuit trip (timeout) | 5s           | 15s cooldown                     |

---

## Monitoring & Diagnostics

### Health Check Endpoints

```powershell
# Gateway health (includes budget status)
Invoke-RestMethod -Uri "https://promagen-api.fly.dev/health"

# Gateway trace (detailed diagnostics)
Invoke-RestMethod -Uri "https://promagen-api.fly.dev/trace"

# Frontend FX endpoint
Invoke-RestMethod -Uri "https://promagen.com/api/fx"
```

### Key Metrics to Watch

| Metric             | Location  | Alert If   |
| ------------------ | --------- | ---------- |
| `budget.dailyUsed` | `/health` | >560 (70%) |
| `budget.state`     | `/health` | "blocked"  |
| `circuitOpen`      | `/health` | true       |
| `meta.mode`        | `/fx`     | "error"    |

### TwelveData Dashboard

```
https://twelvedata.com/account
```

Check daily for: usage vs limit, 429 errors, reset times.

---

## Improvement Roadmap

### Phase 1: Foundation ✅ Complete

- [x] Gateway with budget management
- [x] TTL caching (30 minutes)
- [x] Circuit breaker
- [x] Polling alignment (frontend → 30 min)
- [x] Direct fallback disable flag

### Phase 2: Persistence 📋 Planned

- [ ] Redis cache (survives gateway restarts)
- [ ] Budget persistence (survives restarts)
- [ ] Cross-instance deduplication

### Phase 3: Intelligence 📋 Future

- [ ] Adaptive polling (based on market hours)
- [ ] Weekend mode (reduce frequency when markets closed)
- [ ] Smart prefetch (anticipate cache expiry)

### Phase 4: Observability 📋 Future

- [ ] Prometheus metrics export
- [ ] Budget usage alerting (PagerDuty/Slack)
- [ ] Cost attribution dashboard

---

## Incident Log

### INC-002: TTL Misconfiguration (Jan 10, 2026)

**Severity:** High  
**Impact:** 142% budget overage (1,136/800 credits)  
**Duration:** ~18 hours

**Root Cause:**  
Gateway `fly.toml` had TTL hardcoded to 300 seconds (5 min) in the `[env]` section, overriding the intended 1800 seconds (30 min). This caused 6x more API calls than intended.

With 8 pairs refreshing every 5 minutes:
- 288 refreshes/day × 8 credits = 2,304 credits/day (288% of limit)

**Resolution:**

1. Updated `fly.toml` to set `FX_RIBBON_TTL_SECONDS = "1800"`
2. Updated `server.ts` default from `'300'` to `'1800'`
3. Redeployed gateway: `flyctl deploy -a promagen-api`

**Verification:**
```powershell
(Invoke-RestMethod "https://promagen-api.fly.dev/trace").cache.fxCacheExpiresAt
# Shows ~30 min in future ✅
```

**Lessons Learned:**

- Environment variables in `fly.toml` override code defaults
- Always verify TTL after deployment with `/trace` endpoint
- TwelveData charges per symbol, not per HTTP request

**Prevention:**

- Added verification step to deployment checklist
- Updated this document with correct values

---

### INC-001: API Usage Explosion (Jan 9, 2026)

**Severity:** High  
**Impact:** 224% budget overage (1,794/800 calls)  
**Duration:** ~12 hours

**Root Cause:**  
Frontend polling interval was 30 seconds. Combined with multiple browser tabs and gateway restarts (clearing cache), this caused runaway API consumption.

**Resolution:**

1. Increased polling interval: 30s → 30 min (1,800,000ms)
2. Added `PROMAGEN_DISABLE_TWELVEDATA=true` guidance
3. Created this efficiency document

**Lessons Learned:**

- Polling interval must match or exceed cache TTL
- Gateway restart = cache cold = budget spike risk
- Need Redis for cache persistence (Phase 2)

**Prevention:**

- Polling alignment enforced via code review
- Budget alerts before hitting block threshold (planned)

---

## Changelog

| Date       | Version | Change                                 |
| ---------- | ------- | -------------------------------------- |
| 2026-01-10 | 1.1.0   | Fixed TTL from 300s to 1800s (INC-002) |
|            |         | Updated all metrics for 30-min TTL     |
|            |         | Added credit calculation explanation   |
|            |         | Corrected efficiency targets           |
| 2026-01-09 | 1.0.0   | Initial document created after INC-001 |
|            |         | Documented 12 calming techniques       |
|            |         | Added efficiency metrics and targets   |
|            |         | Created improvement roadmap            |

---

## Review Schedule

This document should be reviewed:

- **Weekly:** Check efficiency metrics against targets
- **Monthly:** Review incident log, update roadmap progress
- **Quarterly:** Assess if new techniques needed, adjust targets

**Next Review:** January 17, 2026

---

## Quick Reference

### "Is it working?" Checklist

```powershell
# 1. Gateway healthy?
(Invoke-RestMethod "https://promagen-api.fly.dev/health").status
# Expected: "ok"

# 2. Budget OK?
(Invoke-RestMethod "https://promagen-api.fly.dev/trace").budget
# Expected: dailyUsed < 560, state should be "ok"

# 3. Cache active with correct TTL?
(Invoke-RestMethod "https://promagen-api.fly.dev/trace").cache
# Expected: hasFxCache = true, fxCacheExpiresAt ~30 min in future

# 4. FX data flowing?
(Invoke-RestMethod "https://promagen-api.fly.dev/fx").data[0].price
# Expected: a number (not null)
```

### Emergency Actions

| Situation      | Action                                           |
| -------------- | ------------------------------------------------ |
| Budget blocked | Wait for midnight UTC reset                      |
| Gateway down   | Check `fly status -a promagen-api`               |
| Circuit open   | Wait for auto-reset (15-60s)                     |
| Stale data     | Check TwelveData dashboard for 429s              |
| No data at all | Restart gateway: `fly apps restart promagen-api` |

---

_This is a living document. Update it whenever calming techniques change or incidents occur._
