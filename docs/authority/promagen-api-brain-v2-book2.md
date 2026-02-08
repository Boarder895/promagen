# Promagen API Brain v2 — Book 2: Provider-Based Gateway Architecture

> **Status:** 📋 APPROVED  
> **Location:** `docs/authority/promagen-api-brain-v2-book2.md`  
> **Companion:** Book 1 (`promagen-api-brain-v2.md`) — Sections §0–§22  
> **This document:** Book 2 — Sections §23–§26

---

## Book Structure

The API Brain documentation is split into two books for maintainability:

| Book       | File                             | Sections | Content                                            |
| ---------- | -------------------------------- | -------- | -------------------------------------------------- |
| **Book 1** | `promagen-api-brain-v2.md`       | §0–§22   | Core policies, roles, SSOT, four-feed architecture |
| **Book 2** | `promagen-api-brain-v2-book2.md` | §23–§26  | Provider-based gateway refactor, guardrails        |

**Why split?** Book 1 reached 1,329 lines. Rather than create an unwieldy single file, new major architecture changes live in Book 2. Cross-references link between books.

---

## 23. Provider-Based Gateway Architecture (Added Jan 14, 2026)

### 23.1 Background

The gateway `server.ts` grew to **4,002 lines** — a monolithic file with duplicated patterns across all four feeds. This made debugging difficult, especially for budget-related issues where TwelveData logic was scattered across multiple places.

**Problems with monolithic structure:**

- Fix a cache bug in FX → forget to fix in other feeds
- TwelveData budget logic scattered across multiple places
- Scheduler logic for same provider in multiple files
- Adding new feed = copy 800 lines

### 23.2 New Architecture: Organize by Provider

The gateway was refactored from **feed-based** to **provider-based** organization:

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
│   ├── README.md                # Provider documentation
│   ├── index.ts                 # Exports fxHandler
│   ├── adapter.ts               # TwelveData API fetch logic
│   ├── budget.ts                # 800/day budget (FX only)
│   ├── scheduler.ts             # Clock-aligned slots (:00/:30 FX)
│   └── fx.ts                    # FX feed config ✅ LIVE
│
├── marketstack/                 # ← Everything Marketstack in ONE place
│   ├── README.md                # Provider documentation
│   ├── index.ts                 # Exports indicesHandler, commoditiesHandler
│   ├── adapter.ts               # Marketstack API fetch logic + benchmark mapping
│   ├── budget.ts                # Shared 3,333/day budget (Professional tier)
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

### 23.3 Key Changes

| Aspect                  | Before (Monolithic) | After (Provider-Based) |
| ----------------------- | ------------------- | ---------------------- |
| **server.ts**           | 4,002 lines         | ~250 lines             |
| **Debug TwelveData**    | Search entire file  | Look in `twelvedata/`  |
| **Budget location**     | Scattered           | One file per provider  |
| **Scheduler location**  | Scattered           | One file per provider  |
| **Add TwelveData feed** | Copy 800 lines      | Add one config file    |
| **Test in isolation**   | Impossible          | Import provider module |

### 23.4 Updated Architecture Diagram

**Replaces §21.1 in Book 1:**

```
┌─────────────────────────────────────────────────────────────────────┐
│              FOUR-FEED ARCHITECTURE (PROVIDER-BASED)                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  GATEWAY STRUCTURE:                                                 │
│  ┌──────────────────┬─────────────────────────┬──────────────────┐  │
│  │  twelvedata/     │  marketstack/           │  openweathermap/ │  │
│  │  ├── budget.ts   │  ├── budget.ts          │  ├── handler.ts  │  │
│  │  ├── scheduler   │  ├── scheduler          │  └── (1,000/day) │  │
│  │  └── fx.ts       │  ├── indices.ts         │      ✅ LIVE     │  │
│  │  (800/day)       │  ├── commodities.ts     │                  │  │
│  │  FX only         │  ├── commodities-sched  │                  │  │
│  │                  │  └── (3,333/day shared)  │                  │  │
│  └──────────────────┴─────────────────────────┴──────────────────┘  │
│                                                                     │
│  Feed: FX           Feed: Indices       Feed: Commodities           │
│  ├── /api/fx        ├── /api/indices    ├── /api/commodities        │
│  ├── use-fx-quotes  ├── use-indices     ├── commodity-windows       │
│  ├── fx-ribbon      ├── exchange-card   ├── 7 content windows       │
│  ├── TTL: 1800s     ├── TTL: 7200s (2h) ├── TTL: 7200s per-item   │
│  ├── Slots: :00,:30 ├── :05,:20,:35,:50 ├── Rolling 5-min          │
│  └── TwelveData     └── Marketstack     └── Marketstack v2         │
│                                                                     │
│  Feed: Weather                                                      │
│  ├── /api/weather                                                   │
│  ├── City batching (48 cities, 2 batches of 24)                     │
│  ├── TTL: 5 min                                                     │
│  ├── Slots: :10, :40                                                │
│  └── OpenWeatherMap                                                 │
│                                                                     │
│  ALL FOUR USE:                                                      │
│  ├── Same 17 calming techniques (TTL, dedup, batch, etc.)           │
│  ├── Budget management per provider:                                │
│  │   TwelveData 800/day, Marketstack 3,333/day, OWM 1,000/day      │
│  ├── Clock-aligned scheduler (FX, Indices, Weather)                 │
│  ├── Rolling scheduler (Commodities — 1-per-call API)               │
│  ├── Same circuit breaker pattern                                   │
│  └── Same graceful degradation                                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

> **Note (Feb 7, 2026):** Crypto feed removed entirely. TwelveData now serves FX only. Commodities moved from `fallback/` to `marketstack/` (now LIVE on Marketstack v2).

### 23.5 Updated API Timing Stagger

**Updates §21.2 in Book 1 — now 4 feeds across 3 providers:**

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

FX:          Minutes 0 and 30 (base schedule)             → TwelveData
Indices:     Minutes 5, 20, 35, 50 (15-minute intervals)  → Marketstack
Weather:     Minutes 10 and 40                             → OpenWeatherMap
Commodities: Rolling every 5 min (1 commodity per call)    → Marketstack v2
```

**Why stagger?**

- TwelveData has a **per-minute rate limit** (8 credits/minute) — now serves FX only
- Marketstack has **separate budget** (3,333/day Professional, shared between Indices + Commodities)
- OpenWeatherMap has **separate budget** (1,000/day)
- Commodities uses **rolling scheduler** because the API supports only 1 commodity per call
- Without stagger: multiple providers hit at same minute → needless contention
- With stagger: each provider fires in its own slot → **safe**

---

## 24. Clock-Aligned Scheduler

### 24.1 The Problem: 90% TTL Drift

The old approach used 90% of TTL as the refresh interval:

```typescript
// ❌ BAD: Creates drift over time
setInterval(() => refresh(), config.ttlSeconds * 1000 * 0.9);

// Example with 30-minute TTL (1800s):
// 1800 * 0.9 = 1620 seconds = 27 minutes

// FX starts at :00 → :27 → :54 → :21 → :48 → :15...
// Indices start at :05 → :32 → :59 → :26 → :53...
// Eventually they COLLIDE and both fire in the same minute!
```

### 24.2 The Solution: Clock-Aligned Slots

The new approach uses fixed clock times:

```typescript
// ✅ GOOD: Fixed slots, never drift
// twelvedata/scheduler.ts

export type TwelveDataFeed = 'fx';

const FEED_SLOTS: Record<TwelveDataFeed, number[]> = {
  fx: [0, 30], // Minutes 0 and 30
};

// marketstack/scheduler.ts — Indices (separate provider)
const INDICES_SLOTS = [5, 20, 35, 50]; // 4× per hour

// openweathermap/handler.ts — Weather (separate provider)
const WEATHER_SLOTS = [10, 40]; // 2× per hour

// marketstack/commodities-scheduler.ts — Rolling (not clock-aligned)
// Every 5 min, 1 commodity at a time, Fisher-Yates randomised queue

export function getMsUntilNextSlot(feed: TwelveDataFeed): number {
  const now = new Date();
  const currentMinute = now.getMinutes();
  const currentSecond = now.getSeconds();
  const slots = FEED_SLOTS[feed];

  // Find next slot
  let nextSlot = slots.find((s) => s > currentMinute);
  if (!nextSlot) {
    nextSlot = slots[0] + 60; // Wrap to next hour
  }

  const minutesUntil = nextSlot - currentMinute;
  const msUntil = (minutesUntil * 60 - currentSecond) * 1000;

  return Math.max(1000, msUntil); // Minimum 1 second
}

// Usage in background refresh:
function startBackgroundRefresh(feed: TwelveDataFeed): void {
  setTimeout(() => {
    refresh();
    setInterval(() => refresh(), 30 * 60 * 1000); // Exactly 30 min
  }, getMsUntilNextSlot(feed)); // Wait for next slot
}

// FX ALWAYS at :00, :30
// Indices ALWAYS at :05, :20, :35, :50
// Weather ALWAYS at :10, :40
// Commodities rolling every 5 min
// NEVER collide!
```

### 24.3 Scheduler Interface

All schedulers implement a shared interface (enforced by TypeScript):

```typescript
// lib/types.ts
export interface FeedScheduler {
  getMsUntilNextSlot(): number;
  getNextSlotTime(): Date;
  isSlotActive(): boolean;
}
```

This ensures TwelveData and Marketstack schedulers stay consistent.

---

## 25. Budget Tracking (Per Provider)

### 25.1 One Instance Per Provider

Each provider has exactly ONE budget instance:

```typescript
// twelvedata/budget.ts — ONE instance for ALL TwelveData feeds
import { BudgetManager } from '../lib/budget.js';

export const twelveDataBudget = new BudgetManager({
  id: 'twelvedata',
  dailyLimit: parseInt(process.env.TWELVEDATA_BUDGET_DAILY || '800'),
  minuteLimit: parseInt(process.env.TWELVEDATA_BUDGET_MINUTE || '8'),
  warnThreshold: 0.7,
});

// Export for diagnostics
export function getTwelveDataBudgetState(): BudgetState {
  return twelveDataBudget.getState();
}
```

```typescript
// marketstack/budget.ts — SEPARATE instance for Marketstack
export const marketstackBudget = new BudgetManager({
  id: 'marketstack',
  dailyLimit: parseInt(process.env.MARKETSTACK_BUDGET_DAILY || '3333'),
  minuteLimit: parseInt(process.env.MARKETSTACK_BUDGET_MINUTE || '60'),
  warnThreshold: 0.7,
});
```

### 25.2 Shared vs Separate Budgets

| Provider       | Feeds                 | Budget                              | File                                |
| -------------- | --------------------- | ----------------------------------- | ----------------------------------- |
| TwelveData     | FX                    | 800/day (FX only)                   | `twelvedata/budget.ts`              |
| Marketstack    | Indices + Commodities | 3,333/day **SHARED** (Professional) | `marketstack/budget.ts`             |
| Marketstack    | Commodities (cap)     | 1,000/day **SUBSET**                | `marketstack/commodities-budget.ts` |
| OpenWeatherMap | Weather               | 1,000/day **SEPARATE**              | `openweathermap/`                   |

**Key insight:** Indices and Commodities both share the Marketstack budget pool (3,333/day), but Commodities has a separate 1,000/day cap to prevent it from crowding out Indices. Combined Marketstack usage: ~384 calls/day (11.5% of pool).

### 25.3 Commodities Status

Commodities is now **LIVE on Marketstack v2** (moved from fallback, Feb 2026):

```typescript
// marketstack/commodities-scheduler.ts
// Rolling scheduler: 1 commodity every 5 minutes
// 78 commodities × 5 min = 6.5 hours per full cycle (~3.7 cycles/day)
// Queue: ALL 78 fully shuffled via Fisher-Yates each cycle (no tiers, no priority)
// ~288 calls/day, capped at 1,000/day
```

The `/commodities` endpoint returns `source: 'marketstack'` with real prices.

---

## 26. Architectural Guardrails

### 26.1 Overview

The provider-based structure solves many problems but introduces new risks. This section documents each risk and the guardrail that prevents it.

| #   | Risk                       | Severity | Guardrail               |
| --- | -------------------------- | -------- | ----------------------- |
| G1  | Cross-provider duplication | Medium   | Shared code in `lib/`   |
| G2  | Hard to find all feeds     | Low      | `server.ts` as index    |
| G3  | Import path complexity     | Low      | Flat import convention  |
| G4  | Scheduler/budget drift     | Medium   | Shared interfaces       |
| G5  | Onboarding curve           | Low      | README per folder       |
| G6  | Circular dependencies      | Medium   | One-way dependency flow |
| G7  | Over-abstraction           | Low      | File count limits       |

### 26.2 G1: Shared Code in `lib/`

**Risk:** Cross-provider logic duplication — same cache/circuit/budget logic copied to each provider folder.

**Rule:** If logic is used by 2+ providers, it MUST be in `lib/`.

```
✅ GOOD: Shared logic in lib/
lib/cache.ts         ← GenericCache used by ALL providers
lib/circuit.ts       ← CircuitBreaker used by ALL providers
lib/feed-handler.ts  ← createFeedHandler() factory

❌ BAD: Duplicated in each provider
twelvedata/cache.ts  ← Don't do this
marketstack/cache.ts ← Don't do this
```

### 26.3 G2: `server.ts` as Feed Index

**Risk:** Hard to find all feeds — they're scattered across 3 different folders.

**Rule:** `server.ts` imports from provider `index.ts` files, making it the one place to see all feeds.

```typescript
// server.ts — THE place to see all feeds at a glance
import { fxHandler } from './twelvedata/index.js';
import { indicesHandler, commoditiesHandler } from './marketstack/index.js';
import { weatherHandler } from './openweathermap/index.js';
```

### 26.4 G3: Flat Import Convention

**Risk:** Import path complexity — easy to get `../lib/` vs `../../lib/` wrong.

**Rules:**

- Provider → lib = always `../lib/`
- Provider → same provider = always `./`
- NEVER import across providers

```typescript
// twelvedata/fx.ts
import { createFeedHandler } from '../lib/feed-handler.js'; // ✅ ../lib/
import { twelveDataBudget } from './budget.js'; // ✅ ./

// ❌ NEVER do this:
import { marketstackBudget } from '../marketstack/budget.js'; // Cross-provider!
```

### 26.5 G4: Shared Interfaces

**Risk:** Scheduler/budget drift — TwelveData scheduler gets updated, Marketstack scheduler doesn't.

**Rule:** All schedulers and budgets implement shared interfaces from `lib/types.ts`.

```typescript
// lib/types.ts
export interface FeedScheduler {
  getMsUntilNextSlot(): number;
  getNextSlotTime(): Date;
  isSlotActive(): boolean;
}

export interface BudgetManagerInterface {
  canSpend(credits: number): boolean;
  spend(credits: number): void;
  getState(): BudgetState;
  reset(): void;
}
```

**Enforcement:** TypeScript compiler. If interface changes, ALL implementations must update.

### 26.6 G5: README Per Provider Folder

**Risk:** Onboarding curve — new dev doesn't know where to look.

**Rule:** Every provider folder has a `README.md` explaining what it does.

```markdown
# TwelveData Provider

**Handles:** FX feed  
**Budget:** 800 credits/day (FX only)  
**Scheduler:** Clock-aligned :00/:30 (FX)

## Files

| File           | Purpose                |
| -------------- | ---------------------- |
| `index.ts`     | Exports fxHandler      |
| `budget.ts`    | Single budget instance |
| `scheduler.ts` | Clock-aligned timing   |
| `fx.ts`        | FX feed configuration  |
```

### 26.7 G6: One-Way Dependency Flow

**Risk:** Circular dependencies — provider imports lib, lib imports provider.

**Rule:** Dependencies flow DOWN only.

```
┌─────────────┐
│  server.ts  │  ← Imports from provider folders
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────┐
│  Provider folders (twelvedata, marketstack, openweathermap) │  ← Import from lib/
└──────┬──────────────────────────────────────┘
       │
       ▼
┌─────────────┐
│    lib/     │  ← NEVER imports from provider folders
└─────────────┘
```

**Enforcement:** ESLint `import/no-cycle` rule.

### 26.8 G7: File Count Limits

**Risk:** Over-abstraction — too many tiny files.

**Rule:** Each folder has a maximum file count.

| Folder            | Max Files | Rationale                                                                            |
| ----------------- | --------- | ------------------------------------------------------------------------------------ |
| `lib/`            | 10        | Core infrastructure only                                                             |
| `twelvedata/`     | 8         | README, index, adapter, budget, scheduler, + feeds                                   |
| `marketstack/`    | 12        | README, index, adapter, budget, scheduler, indices, commodities + scheduler + budget |
| `openweathermap/` | 5         | index, handler, + future expansion                                                   |

### 26.9 Guardrail Checklist (For Code Reviews)

```
- [ ] G1: Is shared logic in `lib/`, not duplicated in provider folders?
- [ ] G2: Does new feed appear in `server.ts` imports?
- [ ] G3: Are imports flat (`../lib/` or `./`), no cross-provider imports?
- [ ] G4: Do schedulers/budgets implement shared interfaces?
- [ ] G5: Is README.md updated if provider folder changes?
- [ ] G6: No circular dependencies?
- [ ] G7: File count within limits?
```

---

## Cross-References

| Document                                | Relevance                          |
| --------------------------------------- | ---------------------------------- |
| **Book 1** (`promagen-api-brain-v2.md`) | §0–§22: Core policies, roles, SSOT |
| `GATEWAY-REFACTOR.md`                   | Full implementation blueprint      |
| `api-calming-efficiency.md`             | Calming techniques, metrics        |
| `fly-v2.md`                             | §12: Provider-based deployment     |
| `ARCHITECTURE.md`                       | Gateway architecture overview      |

---

## Changelog

| Date       | Version | Change                                                                                 |
| ---------- | ------- | -------------------------------------------------------------------------------------- |
| 2026-02-07 | v2.7.0  | **Full audit — corrected to match reality**                                            |
|            |         | §23.2: Removed crypto.ts + fallback/; added marketstack/commodities\*, openweathermap/ |
|            |         | §23.4: Architecture diagram rebuilt (3 providers, no crypto, weather added)            |
|            |         | §23.5: Timing stagger rebuilt (4 feeds, 3 providers)                                   |
|            |         | §24: Scheduler code updated (TwelveData FX only)                                       |
|            |         | §25: Budget tracking — Marketstack 250→3,333, commodities LIVE, OWM added              |
|            |         | §26: Guardrails updated (imports, README, file limits, dependency flow)                |
| 2026-01-14 | v2.6.0  | **Book 2 created**                                                                     |
|            |         | Added §23 Provider-Based Gateway Architecture                                          |
|            |         | Added §24 Clock-Aligned Scheduler                                                      |
|            |         | Added §25 Budget Tracking (Per Provider)                                               |
|            |         | Added §26 Architectural Guardrails (7 guardrails)                                      |
|            |         | Updated architecture diagram for provider folders                                      |
|            |         | Updated timing stagger — Commodities now fallback only                                 |
|            |         | Gateway refactored: 4,002-line monolith → provider-based modules                       |

---

## Summary

**Book 2 documents the gateway architecture (originally Jan 14, updated Feb 7 2026):**

1. **Provider-based folders** — `twelvedata/`, `marketstack/`, `openweathermap/`
2. **Clock-aligned + rolling schedulers** — Fixed slots for FX/Indices/Weather, rolling for Commodities
3. **One budget per provider** — TwelveData 800/day (FX), Marketstack 3,333/day (Indices + Commodities), OWM 1,000/day (Weather)
4. **7 guardrails** — Prevent drift, duplication, and circular dependencies

**Key principle:** Always update docs FIRST before writing any code. Docs are the single source of truth.

---

_This is Book 2 of the API Brain. For core policies and roles (§0–§22), see Book 1._
