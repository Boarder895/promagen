# Promagen Fly.io Brain – Deployment & Cost Model (v2)

## Authority scope (read first)

- Primary deploy target for the **frontend** is Vercel.
- Fly.io is **optional** infrastructure for backend/gateway/worker workloads.
- Monetisation boundaries live only in `docs/authority/paid_tier.md`.
- API calming, caching, and budget guards are defined in `docs/authority/promagen-api-brain-v2.md`.
- Vercel Pro operational guardrails are defined in `docs/authority/vercel-pro-promagen-playbook.md`.

## 0. Goal

Promagen needs somewhere for its backend logic to live—if we want to do anything truly "big boy" (API orchestration, caching, provider fallback, auth, payments, job queues), we need a proper server or worker runtime.

Fly.io is ideal because:

- Cheap, always-on
- Deploy from Docker easily
- Full Linux server control
- Can scale from small to monstrous

This document defines:

- What runs on Vercel vs Fly
- How cost scales

1. Fly.io's role in Promagen
   1.1 Home for backend API routes
   Your Next.js project already has backend routes under something like:
   • frontend/src/app/api/\* (Next.js App Router API routes)
   In local development, these behave as server endpoints. In production, they need a real server platform.
   Fly.io provides the container that runs those backend routes so they can:
   • Proxy external APIs (Twelve Data, FMP, OilPriceAPI, etc.).
   • Normalise responses into Promagen's internal shapes.
   • Enforce paid-tier rules and feature flags.
   • Serve your /api/\_ endpoints to the frontend.
   Example routes Promagen might expose via Fly.io:
   • /api/fx – hitting your primary FX provider for fx.ribbon (no cross-provider fallback; cache/ride-cache handled server-side).
   • /api/holidays/check – calling a calendar/market-holidays API.
   • /api/crypto/live – live crypto data for the homepage ribbon.
   • /api/ai/providers – internal AI provider scores and metadata.
   These are your APIs, not external ones. Fly.io runs the container that serves them.
   1.2 Offloading work away from the browser
   The browser cannot safely hold API keys, nor should it fan out directly to rate-limited third-party APIs.
   Fly.io gives Promagen:
   • Environment variables / secret storage for API keys.
   • Choice of regions (e.g. London) for low-latency calls to providers.
   • Autoscaling / machine sizing so you can grow gradually.
   • Long-lived containers that behave like "tiny Linux workstations in the sky".
   Promagen's backend uses this to:
   • Call external APIs securely.
   • Aggregate data server-side.
   • Apply quota and caching rules centrally.
   • Send only the necessary data down to the UI.
   1.3 Scheduler for background jobs
   Promagen has several background tasks that make far more sense on a persistent backend than inside request/response handlers:
   • "Warm cache" jobs for FX rates.
   • Real-time crypto buffers.
   • Daily commodity synchronisation.
   • Hourly exchange metadata updates.
   • Provider score calculations and trend updates.
   Fly.io lets you run these as:
   • Tiny machines with background loops.
   • Cron-style scheduled jobs.
   This allows you to:
   • Aggregate multiple UI needs into a single batch call.
   • Keep responses warm in cache.
   • Avoid hammering paid APIs for every page view.
   1.4 Escape hatch when serverless is too restrictive
   Vercel is excellent for the frontend and short-lived serverless functions.

### Promagen note: Vercel Pro as the "front door" (guardrails + spend control)

- Canonical Vercel Pro playbook: `C:\Users\Proma\Projects\promagen\docs\authority\vercel-pro-promagen-playbook.md`
- Keep Vercel as the edge/CDN/WAF layer even if some compute moves to Fly.
- Treat WAF rules + Spend Management as _platform_ safety rails; code-level safe-mode/kill-switches are the _second_ line of defence.
  However, some Promagen workloads will eventually be too "muscular" for edge/serverless:
  • Long-running tasks.
  • Big JSON transformations.
  • Background queues and fan-out calls.
  • Scripts that exceed typical edge timeouts.
  Fly.io gives you full Linux machines (still small and cost-controlled) without those constraints.
  Promagen will grow naturally into work that needs:
  • Continuous processes.
  • State across invocations.
  • Richer scheduling than "run for a few seconds and die".
  Fly.io is the platform for that class of work.
  1.5 The glue between Promagen and many external APIs
  Fly.io does not provide FX/crypto/commodities data. It:
  • Stores your private API keys.
  • Runs your "rate collector" and normalisation logic.
  • Produces your internal, Promagen-shaped JSON.
  • Protects users from hitting third-party rate limits directly.
  • Protects your wallet from API overuse.
  • Makes it easy to swap providers without UI changes.
  In plain language:
  • External API providers give you the data.
  • Fly.io hosts the logic that collects, normalises, caches, and serves that data to your frontend.

---

2. Fly.io pricing primitives
   Fly.io uses usage-based billing:
   • You pay for compute (machines), storage, and network egress.
   • There are optional support / service tiers on top.
   Key components:
1. Compute (Fly Machines / VMs)
   o Billed based on vCPU, RAM, and uptime.
   o Auto-scaling and idle-shutdown can reduce cost by stopping machines at low traffic periods.
1. Storage (persistent volumes)
   o Billed roughly per GB per month (e.g. on the order of ~$0.15/GB-month in typical analyses).
1. Bandwidth / egress
   o Outbound data to users and external services is billed per GB (example ballpark: ~$0.02/GB in Europe/North America; exact numbers depend on region).
1. Support / service tiers
   o Optional standard support plans (e.g. around $29/month) for additional guarantees and help.
1. Legacy vs new billing
   o Older accounts may have access to a legacy "free tier" or low flat plans; newer accounts are primarily usage-based.
   Promagen's cost is therefore a function of:
   • How many machines you run, where, and at what size.
   • How much persistent storage you attach.
   • How much data you send out (API responses, dashboards, websockets).
   • Whether you add paid support.

---

3. Promagen-specific cost drivers
   As Promagen grows, these are the levers that affect your Fly.io bill:
1. Compute / VMs
   o Machine size (vCPU/RAM) and uptime for your backend workers and API routes.
   o Multiple regions = multiple sets of machines and cost per region.
1. Storage
   o Persistent volumes for:
   Caching rates.
   User-related data (if stored server-side).
   Logs and historical metrics.
   o Volume size × price/GB/month.
1. Bandwidth / egress
   o Data sent from Fly.io to your users (dashboards, live updates).
   o Data sent to other services.
   o Inter-region transfers if you run multiple regions (e.g. London ↔ Singapore).
1. Support / premium services
   o Optional if you want SLAs or higher support responsiveness for paid users.
1. Regions / redundancy
   o Global footprint (e.g. London + New York + Singapore) gives better latency but multiplies compute cost.
1. Scale / growth
   o More users → more traffic → more compute, storage, and egress.
   o Costs scale fairly linearly, especially if you optimise caching and batch calls.

---

4. Example "ball-park" stack
   A simple, concrete example (not tied yet to a specific user count):
   • One backend VM in London, 2 GB RAM, always on: roughly $20–40/month.
   • Storage: 50 GB persistent cache at ~$0.15/GB-month → around $7.50/month.
   • Bandwidth: 500 GB/month at ~$0.02/GB → around $10/month.
   • Support plan (if used): about $29/month.
   Total rough base: $50–90/month. As you add regions and traffic, costs can move into a $200–500/month range or higher, but only if you actually have the usage to justify it.

---

5. Three-stage Promagen cost model (GBP)
   To make this more actionable, we model three realistic stages for Promagen, in British pounds.
   5.1 Stage 1 – Lean Launch (0–500 users/day)
   A small but professional deployment for early beta.
   Assumptions
   • One region (London).
   • One small machine hosting your backend API routes.
   • Light traffic: ~200–500 visitors per day.
   • Light outbound bandwidth.
   • APIs called via your backend.
   • Minimal persistent storage.
   Likely Fly.io costs (per month)
   • Compute (small VM 24/7): ~£12–£25.
   • Storage (5–10 GB): ~£1–£2.
   • Bandwidth (100–200 GB): ~£2–£4.
   • Optional support tier: ~£20.
   • Misc overhead: £3–£5.
   Ballpark total (pricing varies — verify against Fly.io pricing): £20–£55/month. Promagen is cheap to run here – ideal for your first public version.
   5.2 Stage 2 – Mid-Scale Growth (2,000–5,000 users/day)
   Traffic increases; you have paying users; more people refresh FX, crypto, commodities frequently.
   Assumptions
   • Two regions (e.g. London + New York) for lower latency.
   • Medium-sized machines with autoscaling.
   • 2,000–5,000 visitors per day.
   • Higher outbound bandwidth (market data + UI updates).
   • Around 50 GB storage for caches and logs.
   • Hourly background jobs.
   Likely Fly.io costs (per month)
   • Compute (2 mid-size machines with autoscaling): £60–£120.
   • Storage (50 GB): £7–£8.
   • Bandwidth (500–1,000 GB): £10–£20.
   • Internal routing / overhead: £5–£10.
   • Optional support: ~£20.
   Ballpark total (pricing varies — verify against Fly.io pricing): £100–£180/month. This is when Promagen feels "alive" and responsive for a global-ish audience.
   5.3 Stage 3 – Fully Scaled Global
   Promagen is popular, with users across Asia, Europe, and the Americas. High-frequency FX, commodities, and crypto traffic, plus richer analytics and heavier caching.
   Assumptions
   • 3–5 regions (e.g. London, New York, Frankfurt, Singapore, São Paulo).
   • Several machines per region with autoscaling.
   • Heavy bandwidth: 4–10 TB/month.
   • Around 150 GB of persistent storage for historical data, caches, logs.
   • Background tasks running every few minutes.
   • High resilience and internal load balancing.
   Likely Fly.io costs (per month)
   • Compute (multiple machines): £200–£700.
   • Storage (150 GB): ~£20.
   • Bandwidth (4–10 TB): £80–£200.
   • Global load balancing / internal network: £10–£30.
   • Support tier: £20–£40.
   • Occasional scaling spikes: £50–£120.
   Ballpark total (pricing varies — verify against Fly.io pricing): £350–£1,100/month – still modest for a global-ish platform and usually cheaper than an equivalent AWS setup.

---

6. Cost optimisation and guardrails
   To avoid surprises:
   • Monitor egress volumes carefully – especially if your dashboards ever include video or heavy real-time charts.
   • Use auto-scaling / idle shutdown so machines don't run at full cost during quiet periods.
   • Keep region count sensible – every region adds its own machines and costs.
   • Lean on caching and rate-limiting so the backend doesn't spam external APIs or dump unnecessary data to clients.
   • Build cost monitoring and alerting early so you don't discover a nasty bill after the fact.
   The nicest property of Fly.io for Promagen is:
   • You start tiny.
   • You only scale cost when real traffic forces you to.
   • Nothing pushes you into the £300+ range until you actually have the users to justify it.

---

7. How this ties back to the API Brain (v2)
   Fly.io is where the API Brain becomes a running organism:
   src/data/api/providers.registry.json tells your Fly workers which upstream providers exist, how to authenticate (via environment variables), and which adapter should normalise each provider's payload.
   src/data/api/roles.policies.json tells them which provider powers each role (feature) and what cache TTL applies (for example, the FX ribbon role uses Twelve Data with a 30-minute cache).
   Budget guardrails (FX ribbon)

The FX ribbon enforces a soft "budget" model to avoid accidental overuse of paid market-data APIs.

Configure these via environment variables (so limits match your provider plan without code changes):

FX_RIBBON_BUDGET_DAILY_ALLOWANCE — daily credit allowance for the ribbon (set this to your plan, e.g. 800).

FX_RIBBON_BUDGET_MINUTE_ALLOWANCE — per-minute allowance (optional; use if you want a hard minute cap).

FX_RIBBON_BUDGET_MINUTE_WINDOW_SECONDS — window size for the minute allowance.

Note: Twelve Data credit usage is per symbol.

SSOT for what the UI shows (including FX pair metadata and ribbon defaults) lives in `frontend/src/data/fx/fx-pairs.json` and `docs/authority/ribbon-homepage.md`.

Fly.io hosts:
the gateway runtime that loads the Brain JSON files and resolves a role to its provider list,
the worker logic that performs the HTTP call(s) and hands payloads to the adapter layer for normalisation,
the cache layer that keeps data warm for your ribbons (and returns mode: "cached" when serving within TTL).
In the current operating model there is one live provider (Twelve Data) and no synthetic/demo mode. The only active modes are live and cached; fallback is reserved for the future when backup providers are reintroduced.
Promagen on Fly.io becomes:
"Promagen: powered by many APIs under one unified logic layer, running on an infrastructure platform that you control."

---

## 8. FX Pairs SSOT Architecture (Added Jan 9, 2026)

### 8.1 The Problem: Duplication = Drift

Before this architecture, the gateway had **hardcoded FX pairs** in `src/server.ts`. This duplicated what's in `frontend/src/data/fx/fx-pairs.json`, violating SSOT:

```
❌ BAD: Two places to maintain
frontend/src/data/fx/fx-pairs.json  ← File 1
gateway/src/server.ts (hardcoded)   ← File 2
```

If you added a pair to the frontend JSON, the gateway wouldn't know about it. If you changed the gateway, the frontend wouldn't match. **Drift guaranteed.**

### 8.2 The Solution: Runtime SSOT Fetch

The gateway now **fetches pairs from the frontend** on startup:

```
✅ GOOD: One source of truth
frontend/src/data/fx/fx-pairs.json   ← THE ONE AND ONLY SOURCE
              ↓
frontend/api/fx/config               ← NEW: Exposes it as API
              ↓
gateway fetches on startup           ← Reads from frontend
              ↓
gateway serves FX quotes             ← Uses fetched pairs
```

### 8.3 Implementation Details

**Frontend endpoint:** `src/app/api/fx/config/route.ts`

```typescript
// Reads unified fx-pairs.json (single source of truth)
// Returns only isDefaultFree=true pairs
// Response:
{
  "version": 1,
  "ssot": "frontend/src/data/fx/fx-pairs.json",
  "generatedAt": "2026-01-09T02:00:00.000Z",
  "pairs": [
    { "id": "eur-usd", "base": "EUR", "quote": "USD" },
    { "id": "gbp-usd", "base": "GBP", "quote": "USD" },
    // ... all isDefaultFree pairs
  ]
}
```

**Gateway startup:** `src/server.ts`

```typescript
// Environment variable for SSOT endpoint
const FX_CONFIG_URL = process.env['FX_CONFIG_URL'] ?? 'https://promagen.com/api/fx/config';

// Fallback pairs (only if frontend unreachable)
const FALLBACK_FX_PAIRS: FxPair[] = [...];

// Runtime state
let activeFxPairs: FxPair[] = [];
let ssotSource: 'frontend' | 'fallback' = 'fallback';

// Fetch from SSOT on startup
async function initFxPairs(): Promise<void> {
  const ssotPairs = await fetchSsotConfig();
  if (ssotPairs && ssotPairs.length > 0) {
    activeFxPairs = ssotPairs;
    ssotSource = 'frontend';
  } else {
    activeFxPairs = FALLBACK_FX_PAIRS;
    ssotSource = 'fallback';
  }
}

// Start sequence
async function start(): Promise<void> {
  await initFxPairs();  // SSOT fetch FIRST
  // ... then start HTTP server
}
```

### 8.4 Gateway Environment Variables (TwelveData)

| Variable                            | Default                              | Description                      |
| ----------------------------------- | ------------------------------------ | -------------------------------- |
| `FX_CONFIG_URL`                     | `https://promagen.com/api/fx/config` | Frontend FX SSOT endpoint        |
| `TWELVEDATA_API_KEY`                | (required)                           | TwelveData API key               |
| `FX_RIBBON_BUDGET_DAILY_ALLOWANCE`  | `800`                                | TwelveData daily credit budget   |
| `FX_RIBBON_BUDGET_MINUTE_ALLOWANCE` | `8`                                  | TwelveData per-minute credit cap |
| `FX_RIBBON_TTL_SECONDS`             | `1800`                               | FX cache TTL (30 minutes)        |

### 8.5 Verifying SSOT Is Working

**Check /health endpoint:**

```powershell
Invoke-RestMethod -Uri "https://promagen-api.fly.dev/health"
```

**Expected response:**

```json
{
  "status": "ok",
  "ssot": {
    "source": "frontend",           // ← This means SSOT is working
    "configUrl": "https://promagen.com/api/fx/config",
    "pairCount": 8,
    "pairs": ["eur-usd", "gbp-usd", "usd-jpy", ...]
  }
}
```

If `"source": "fallback"`, the gateway couldn't reach the frontend on startup.

### 8.6 Changing FX Pairs (The SSOT Way)

**Before (bad):** Edit two files, hope they stay in sync.

**Now (correct):**

1. Edit **ONE file**: `frontend/src/data/fx/fx-pairs.json`
2. Deploy frontend: `git push` (Vercel auto-deploys)
3. Restart gateway: `fly apps restart promagen-api`

**That's it.** One file. Both systems update. No drift.

### 8.7 Pair Count Is Variable

**Hard rule from `ribbon-homepage.md`:**

> The ribbon does not hard-code "5" or "8" anywhere.
> The number of FX chips shown on the homepage is simply the number of entries you designate for the homepage in that JSON.

The current default is 8 pairs (as set in fx-pairs.json with `isDefaultFree: true`), but this can be any number. The gateway respects whatever the SSOT says.

### 8.8 Deployment Order

**Always deploy frontend first:**

```powershell
# Step 1: Deploy frontend (so /api/fx/config exists)
cd C:\Users\Proma\Projects\promagen\frontend
git add .
git commit -m "feat: add /api/fx/config SSOT endpoint"
git push

# Step 2: Wait for Vercel to finish deploying

# Step 3: Deploy gateway
cd C:\Users\Proma\Projects\promagen\gateway
fly deploy
```

If you deploy gateway first, it will fall back to hardcoded pairs (because /api/fx/config doesn't exist yet).

### 8.9 Files to Delete (Cleanup)

A previous attempt created duplicate files in the gateway. **Delete these:**

```powershell
# Run from: C:\Users\Proma\Projects\promagen\gateway
Remove-Item -Recurse -Force ".\lib\ssot" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force ".\data" -ErrorAction SilentlyContinue
```

The gateway should have NO local fx-pairs.json or data files — it fetches everything from the frontend SSOT.

---

## 9. Gateway TypeScript Configuration

### 9.1 Module Resolution

The gateway uses `NodeNext` module resolution, which requires `.js` extensions on all relative imports:

```typescript
// ❌ WRONG (TS2835 error):
import { logInfo } from './logging';

// ✅ CORRECT:
import { logInfo } from './logging.js';
```

**Files that require .js extensions:**

- `lib/adapters.ts`
- `lib/http.ts`
- `lib/quota.ts`
- `lib/resilience.ts`
- `lib/roles.ts`
- `lib/types.ts`

### 9.2 Verification

```powershell
# Run from: C:\Users\Proma\Projects\promagen\gateway
npx tsc --noEmit  # Should pass with 0 errors
```

---

## 10. Monorepo Structure

Promagen uses a pnpm workspace monorepo:

```
promagen/
├── pnpm-workspace.yaml    # Defines workspace packages
├── pnpm-lock.yaml         # Shared lockfile for all packages
├── frontend/              # Next.js app → deploys to Vercel
│   └── package.json
└── gateway/               # Fly.io gateway → deploys to Fly
    └── package.json
```

**pnpm-workspace.yaml:**

```yaml
packages:
  - frontend
  - gateway
```

**Important:** When you modify `gateway/package.json`, you must regenerate the lockfile from the monorepo root:

```powershell
# Run from: C:\Users\Proma\Projects\promagen (root)
pnpm install
git add pnpm-lock.yaml
git commit -m "chore: update pnpm-lock.yaml"
git push
```

Otherwise Vercel will fail with `ERR_PNPM_OUTDATED_LOCKFILE`.

---

## 11. Indices SSOT Architecture (Added Jan 13, 2026)

The gateway `/indices` endpoint provides stock exchange index data (e.g., Nikkei 225, S&P 500) for Exchange Cards.

### 11.1 Provider: Marketstack (Separate from TwelveData)

| Provider        | Feeds                     | Daily Limit                      | TTL         |
| --------------- | ------------------------- | -------------------------------- | ----------- |
| TwelveData      | FX                        | 800 credits                      | 30 min      |
| **Marketstack** | **Indices + Commodities** | **3,333 credits (Professional)** | **2 hours** |
| OpenWeatherMap  | Weather                   | 1,000 credits                    | 5 min       |

Indices uses a **separate provider and budget** — it doesn't compete with TwelveData. Commodities shares the Marketstack budget but has a separate 1,000/day cap.

### 11.2 SSOT: Exchange Catalog

The frontend catalog is the single source of truth for index benchmarks:

```
frontend/src/data/exchanges/exchanges.catalog.json  ← THE ONE AND ONLY SOURCE
              ↓
frontend/api/indices/config                         ← Exposes as API
              ↓
gateway fetches on startup                          ← Reads from frontend
              ↓
gateway serves /indices                             ← Uses fetched benchmarks
```

**Catalog entry example:**

```json
{
  "id": "tse-tokyo",
  "city": "Tokyo",
  "exchange": "Tokyo Stock Exchange (TSE)",
  "marketstack": {
    "benchmark": "nikkei_225",
    "indexName": "Nikkei 225"
  }
}
```

### 11.3 Gateway Environment Variables (Marketstack)

| Variable                                 | Default                                   | Description                                         |
| ---------------------------------------- | ----------------------------------------- | --------------------------------------------------- |
| `INDICES_CONFIG_URL`                     | `https://promagen.com/api/indices/config` | Frontend Indices SSOT endpoint                      |
| `MARKETSTACK_API_KEY`                    | (required)                                | Marketstack API key (Fly.io secret)                 |
| `INDICES_RIBBON_BUDGET_DAILY_ALLOWANCE`  | `3333`                                    | Marketstack daily credit budget (Professional tier) |
| `INDICES_RIBBON_BUDGET_MINUTE_ALLOWANCE` | `3`                                       | Marketstack per-minute credit cap                   |
| `INDICES_RIBBON_TTL_SECONDS`             | `7200`                                    | Indices cache TTL (2 hours)                         |

### 11.4 API Timing Stagger

Indices refresh at :05, :20, :35, and :50 each hour (15-minute intervals, staggered from FX):

```
┌────┬────┬────┬────┬────┬────┬────┬────┬────┐
│:00 │:05 │:10 │:20 │:30 │:35 │:40 │:50 │:00 │
├────┼────┼────┼────┼────┼────┼────┼────┼────┤
│ FX │IDX │WTH │IDX │ FX │IDX │WTH │IDX │ FX │
└────┴────┴────┴────┴────┴────┴────┴────┴────┘
  ↑    ↑   ↑    ↑    ↑    ↑    ↑    ↑
  TD   MS  OWM  MS   TD   MS  OWM  MS

+ Commodities: rolling every 5 min (Marketstack v2, not clock-aligned)

TD  = TwelveData (800/day, FX only)
MS  = Marketstack (3,333/day shared, Indices + Commodities)
OWM = OpenWeatherMap (1,000/day, Weather)
```

### 11.5 Verifying Indices Is Working

```powershell
# Check /indices endpoint
Invoke-RestMethod -Uri "https://promagen-api.fly.dev/indices"

# Check /trace for Marketstack budget
(Invoke-RestMethod "https://promagen-api.fly.dev/trace").indices
# Expected: mode, ssotSource, scheduler info
```

### 11.6 Files (Frontend)

| File                                         | Purpose                                 |
| -------------------------------------------- | --------------------------------------- |
| `src/data/exchanges/exchanges.catalog.json`  | Benchmark mappings (48 exchanges)       |
| `src/data/exchanges/exchanges.selected.json` | Default 16 exchange IDs                 |
| `src/app/api/indices/config/route.ts`        | SSOT endpoint for gateway               |
| `src/app/api/indices/route.ts`               | Proxy to gateway `/indices`             |
| `src/hooks/use-indices-quotes.ts`            | Polling hook (:05/:20/:35/:50 schedule) |
| `src/components/exchanges/exchange-card.tsx` | IndexRow component                      |

### 11.7 Changing Default Exchanges (The SSOT Way)

1. Edit **ONE file**: `frontend/src/data/exchanges/exchanges.selected.json`
2. Deploy frontend: `git push` (Vercel auto-deploys)
3. Restart gateway: `fly apps restart promagen-api`

**Cross-reference:** See `MARKETSTACK-ACTION-PLAN.md` for full implementation details.

---

## 12. Provider-Based Gateway Architecture (Added Jan 14, 2026)

### 12.1 Why Provider-Based?

The gateway was refactored from a **4,002-line monolithic server.ts** to a **provider-based modular architecture**.

**Problem with old structure:**

- TwelveData budget logic scattered across multiple files
- Scheduler logic for same provider in multiple files
- Hard to debug "why is TwelveData over budget?"
- Adding a new feed = copy 800 lines

**Solution: Organize by provider, not by feed:**

- Each provider gets its own folder
- Budget, scheduler, adapter co-located
- Adding new feed to existing provider = one config file

### 12.2 File Structure

```
gateway/src/
├── server.ts                    # ~720 lines: routes + startup
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
│   ├── index.ts                 # Exports fxHandler
│   ├── adapter.ts               # TwelveData API fetch logic
│   ├── budget.ts                # 800/day budget (FX only)
│   ├── scheduler.ts             # Clock-aligned slots (:00/:30 FX)
│   └── fx.ts                    # FX feed config ✅ LIVE
│
├── marketstack/                 # ← Everything Marketstack in ONE place
│   ├── index.ts                 # Exports indicesHandler, commoditiesHandler
│   ├── adapter.ts               # Marketstack API fetch logic + benchmark mapping
│   ├── budget.ts                # Shared 3,333/day budget (indices)
│   ├── scheduler.ts             # Clock-aligned slots (:05/:20/:35/:50 indices)
│   ├── indices.ts               # Indices feed config ✅ LIVE
│   ├── commodities.ts           # Commodities feed config ✅ LIVE
│   ├── commodities-scheduler.ts # Rolling 5-min scheduler (Fisher-Yates randomised)
│   └── commodities-budget.ts    # Separate 1,000/day cap for commodities
│
└── openweathermap/              # ← Everything OpenWeatherMap in ONE place
    ├── index.ts                 # Exports weather handler + helpers
    └── handler.ts               # Weather feed with city batching ✅ LIVE
```

### 12.3 Key Benefits

| Aspect                  | Before (Monolithic) | After (Provider-Based) |
| ----------------------- | ------------------- | ---------------------- |
| **server.ts**           | 4,002 lines         | ~250 lines             |
| **Debug TwelveData**    | Search entire file  | Look in `twelvedata/`  |
| **Budget location**     | Scattered           | One file per provider  |
| **Scheduler location**  | Scattered           | One file per provider  |
| **Add TwelveData feed** | Copy 800 lines      | Add one config file    |
| **Test in isolation**   | Impossible          | Import provider module |

### 12.4 Provider Module Structure

Each provider folder follows the same pattern:

```
{provider}/
├── index.ts      # Clean exports for server.ts
├── adapter.ts    # API fetch + response normalization
├── budget.ts     # Budget manager instance (ONE per provider)
├── scheduler.ts  # Clock-aligned refresh slots
└── {feed}.ts     # Feed-specific config (one per feed)
```

### 12.5 Clock-Aligned + Rolling Schedulers

**Why clock-aligned (not 90% TTL)?**

```typescript
// ❌ BAD: 90% of TTL creates drift
setInterval(() => refresh(), config.ttlSeconds * 1000 * 0.9);
// FX at :00 → :27 → :54 → :21...
// Indices at :05 → :32 → :59...
// Eventually they COLLIDE!

// ✅ GOOD: Clock-aligned slots, never drift
setTimeout(() => {
  refresh();
  setInterval(() => refresh(), 15 * 60 * 1000); // 15 min for indices
}, getMsUntilNextSlot('indices'));
// FX ALWAYS at :00, :30
// Indices ALWAYS at :05, :20, :35, :50
// Weather ALWAYS at :10, :40
// NEVER collide!
```

**Why rolling for Commodities?** Marketstack v2 supports only 1 commodity per call. 78 commodities × 5 min = 6.5 hours per cycle. Clock-aligned would cram 78 calls into one slot — rolling spreads the load evenly.

**Schedule:**

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

TD  = TwelveData (800/day, FX only)
MS  = Marketstack (3,333/day shared, Indices + Commodities)
OWM = OpenWeatherMap (1,000/day, Weather)
```

### 12.6 Environment Variables (All Providers)

| Variable                          | Provider       | Default    | Description                                   |
| --------------------------------- | -------------- | ---------- | --------------------------------------------- |
| `TWELVEDATA_API_KEY`              | TwelveData     | (required) | API key                                       |
| `TWELVEDATA_BUDGET_DAILY`         | TwelveData     | `800`      | Daily credit limit                            |
| `TWELVEDATA_BUDGET_MINUTE`        | TwelveData     | `8`        | Per-minute limit                              |
| `FX_RIBBON_TTL_SECONDS`           | TwelveData     | `1800`     | FX cache TTL                                  |
| `MARKETSTACK_API_KEY`             | Marketstack    | (required) | API key                                       |
| `MARKETSTACK_BUDGET_DAILY`        | Marketstack    | `3333`     | Daily credit limit (Professional tier)        |
| `MARKETSTACK_BUDGET_MINUTE`       | Marketstack    | `60`       | Per-minute limit                              |
| `INDICES_RIBBON_TTL_SECONDS`      | Marketstack    | `7200`     | Indices cache TTL                             |
| `COMMODITIES_REFRESH_INTERVAL_MS` | Marketstack    | `300000`   | Commodities rolling interval (5 min)          |
| `COMMODITIES_BUDGET_DAILY`        | Marketstack    | `1000`     | Commodities daily cap (subset of shared pool) |
| `OPENWEATHERMAP_API_KEY`          | OpenWeatherMap | (required) | API key                                       |
| `OPENWEATHERMAP_BUDGET_DAILY`     | OpenWeatherMap | `1000`     | Daily credit limit                            |
| `OPENWEATHERMAP_BUDGET_MINUTE`    | OpenWeatherMap | `60`       | Per-minute limit                              |

### 12.7 Migration from Old Structure

**Old files to delete:**

```powershell
# Run from: C:\Users\Proma\Projects\promagen\gateway
Remove-Item -Recurse -Force ".\src\feeds" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force ".\src\lib\shared-budgets.ts" -ErrorAction SilentlyContinue
```

**Verification after migration:**

```powershell
# TypeScript compiles
npx tsc --noEmit  # 0 errors

# All endpoints work
(Invoke-RestMethod "https://promagen-api.fly.dev/health").status  # "ok"
(Invoke-RestMethod "https://promagen-api.fly.dev/fx").data.Count  # 8
(Invoke-RestMethod "https://promagen-api.fly.dev/indices").data.Count  # 8-16
(Invoke-RestMethod "https://promagen-api.fly.dev/commodities").data.Count  # 7
(Invoke-RestMethod "https://promagen-api.fly.dev/weather") | Select-Object -First 1  # has data

# Trace shows all feeds
$trace = Invoke-RestMethod "https://promagen-api.fly.dev/trace"
$trace.fx | Select-Object mode, ssotSource
$trace.indices | Select-Object mode, ssotSource
$trace.commodities | Select-Object mode, ssotSource
$trace.weather
```

**Cross-reference:** See `GATEWAY-REFACTOR.md` for full migration blueprint.

---

**Last updated:** 7 February 2026

**Changelog:**

- **7 Feb 2026:** Full audit — §11 + §12 corrected to match reality
  - §11.1: Marketstack budget 250→3,333 (Professional), removed Crypto from TwelveData, added Commodities + Weather
  - §11.3: Budget env var default 250→3333
  - §11.4: Timing stagger rebuilt (4 feeds, 3 providers, no crypto)
  - §11.5: Trace verification updated
  - §11.6: Hook schedule :05/:35→:05/:20/:35/:50
  - §12.2: File structure — removed crypto.ts, fallback/; added marketstack/commodities\*, openweathermap/
  - §12.5: Scheduler section rebuilt (clock-aligned + rolling), timing diagram updated
  - §12.6: Env vars — removed CRYPTO\_\*, fixed MARKETSTACK budget, added OWM + Commodities vars
  - §12.7: Verification — removed /crypto, added /commodities + /weather
- **14 Jan 2026:** Added §12 Provider-Based Gateway Architecture (provider folders, clock-aligned scheduler, migration from monolithic)
- **13 Jan 2026:** Added §11 Indices SSOT Architecture (Marketstack provider, 2-hour TTL, :05/:35 stagger)
- **10 Jan 2026:** FX SSOT Consolidated — Updated §8 to reflect unified `fx-pairs.json` file
- **9 Jan 2026:** Added §8 FX Pairs SSOT Architecture, §9 Gateway TypeScript Configuration, §10 Monorepo Structure
