# Promagen API Brain v2 — Book 2: Provider-Based Gateway Architecture

> **Status:** 📋 APPROVED  
> **Location:** `docs/authority/promagen-api-brain-v2-book2.md`  
> **Companion:** Book 1 (`promagen-api-brain-v2.md`) — Sections §0–§22  
> **This document:** Book 2 — Sections §23–§26

---

## Book Structure

The API Brain documentation is split into two books for maintainability:

| Book | File | Sections | Content |
|------|------|----------|---------|
| **Book 1** | `promagen-api-brain-v2.md` | §0–§22 | Core policies, roles, SSOT, four-feed architecture |
| **Book 2** | `promagen-api-brain-v2-book2.md` | §23–§26 | Provider-based gateway refactor, guardrails |

**Why split?** Book 1 reached 1,329 lines. Rather than create an unwieldy single file, new major architecture changes live in Book 2. Cross-references link between books.

---

## 23. Provider-Based Gateway Architecture (Added Jan 14, 2026)

### 23.1 Background

The gateway `server.ts` grew to **4,002 lines** — a monolithic file with duplicated patterns across all four feeds. This made debugging difficult, especially for budget-related issues where TwelveData logic was scattered across multiple places.

**Problems with monolithic structure:**
- Fix a cache bug in FX → forget to fix in Crypto
- TwelveData budget shared by 2 feeds, but code scattered
- Scheduler logic for same provider in multiple files
- Adding new feed = copy 800 lines

### 23.2 New Architecture: Organize by Provider

The gateway was refactored from **feed-based** to **provider-based** organization:

```
gateway/src/
├── server.ts                    # ~250 lines: routes + startup ONLY
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
│   ├── index.ts                 # Exports fxHandler, cryptoHandler
│   ├── adapter.ts               # TwelveData API fetch logic
│   ├── budget.ts                # Shared 800/day budget (ONE instance)
│   ├── scheduler.ts             # Clock-aligned slots (:00/:30 FX, :20/:50 Crypto)
│   ├── fx.ts                    # FX feed config
│   └── crypto.ts                # Crypto feed config
│
├── marketstack/                 # ← Everything Marketstack in ONE place
│   ├── README.md                # Provider documentation
│   ├── index.ts                 # Exports indicesHandler
│   ├── adapter.ts               # Marketstack API fetch logic
│   ├── budget.ts                # Separate 250/day budget (ONE instance)
│   ├── scheduler.ts             # Clock-aligned slots (:05/:35)
│   └── indices.ts               # Indices feed config
│
└── fallback/                    # ← Feeds with no provider
    ├── README.md                # Explains why fallback exists
    └── commodities.ts           # Returns demo prices only
```

### 23.3 Key Changes

| Aspect | Before (Monolithic) | After (Provider-Based) |
|--------|---------------------|------------------------|
| **server.ts** | 4,002 lines | ~250 lines |
| **Debug TwelveData** | Search entire file | Look in `twelvedata/` |
| **Budget location** | Scattered | One file per provider |
| **Scheduler location** | Scattered | One file per provider |
| **Add TwelveData feed** | Copy 800 lines | Add one config file |
| **Test in isolation** | Impossible | Import provider module |

### 23.4 Updated Architecture Diagram

**Replaces §21.1 in Book 1:**

```
┌─────────────────────────────────────────────────────────────────────┐
│              FOUR-FEED ARCHITECTURE (PROVIDER-BASED)                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  GATEWAY STRUCTURE:                                                 │
│  ┌───────────────────┬──────────────────┬─────────────────┐         │
│  │   twelvedata/     │   marketstack/   │   fallback/     │         │
│  │   ├── budget.ts   │   ├── budget.ts  │   └── commodities│        │
│  │   ├── scheduler   │   ├── scheduler  │       (demo only)│        │
│  │   ├── fx.ts       │   └── indices.ts │                  │        │
│  │   └── crypto.ts   │                  │                  │        │
│  │   (800/day)       │   (250/day)      │   (0 calls)      │        │
│  └───────────────────┴──────────────────┴─────────────────┘         │
│                                                                     │
│  Feed: FX           Feed: Indices       Feed: Commodities           │
│  ├── /api/fx        ├── /api/indices    ├── /api/commodities        │
│  ├── use-fx-quotes  ├── use-indices     ├── (fallback only)         │
│  ├── fx-ribbon      ├── exchange-card   ├── commodities-ribbon      │
│  ├── TTL: 1800s     ├── TTL: 7200s (2h) ├── TTL: 1800s              │
│  ├── Slots: :00,:30 ├── Slots: :05,:35  ├── Slots: N/A              │
│  └── TwelveData     └── Marketstack     └── None (fallback)         │
│                                                                     │
│  Feed: Crypto                                                       │
│  ├── /api/crypto                                                    │
│  ├── use-crypto-quotes.ts                                           │
│  ├── crypto-ribbon.container                                        │
│  ├── TTL: 1800s (30 min)                                            │
│  ├── Slots: :20, :50                                                │
│  └── TwelveData                                                     │
│                                                                     │
│  ALL ACTIVE FEEDS USE:                                              │
│  ├── Same 7 calming techniques (TTL, dedup, batch, etc.)            │
│  ├── Budget management (TwelveData 800/day, Marketstack 250/day)    │
│  ├── Clock-aligned scheduler (prevents rate limit violations)       │
│  ├── Same circuit breaker pattern                                   │
│  └── Same graceful degradation                                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 23.5 Updated API Timing Stagger

**Updates §21.2 in Book 1 — Commodities removed from schedule:**

```
Hour timeline (repeats every hour):
┌────┬────┬────┬────┬────┬────┬────┬────┬────┐
│:00 │:05 │:10 │:20 │:30 │:35 │:40 │:50 │:00 │
├────┼────┼────┼────┼────┼────┼────┼────┼────┤
│ FX │IDX │    │CRY │ FX │IDX │    │CRY │ FX │
└────┴────┴────┴────┴────┴────┴────┴────┴────┘
  ↑    ↑         ↑    ↑    ↑         ↑
  TD   MS        TD   TD   MS        TD

TD = TwelveData (800/day shared budget)
MS = Marketstack (250/day separate budget)

FX:          Minutes 0 and 30 (base schedule)      → TwelveData
Indices:     Minutes 5 and 35 (5-minute offset)    → Marketstack
Commodities: N/A (fallback only, no API calls)     → No provider
Crypto:      Minutes 20 and 50 (20-minute offset)  → TwelveData
```

**Why stagger?**
- TwelveData has a **per-minute rate limit** (8 credits/minute)
- Marketstack has **separate budget** (250/day, doesn't affect TwelveData)
- Without stagger: FX + Crypto at same time = 16 credits at :00 → **rate limited**
- With stagger: 8 credits at :00 (FX), 8 credits at :20 (Crypto) → **safe**
- Indices at :05/:35 uses Marketstack (different provider, no conflict)
- Commodities has no provider — returns fallback data only

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
// Crypto starts at :15 → :42 → :09 → :36 → :03...
// Eventually they COLLIDE and both fire in the same minute!
// → 16 credits in one minute → rate limited
```

### 24.2 The Solution: Clock-Aligned Slots

The new approach uses fixed clock times:

```typescript
// ✅ GOOD: Fixed slots, never drift
// twelvedata/scheduler.ts

export type TwelveDataFeed = 'fx' | 'crypto';

const FEED_SLOTS: Record<TwelveDataFeed, number[]> = {
  fx: [0, 30],      // Minutes 0 and 30
  crypto: [20, 50], // Minutes 20 and 50
};

export function getMsUntilNextSlot(feed: TwelveDataFeed): number {
  const now = new Date();
  const currentMinute = now.getMinutes();
  const currentSecond = now.getSeconds();
  const slots = FEED_SLOTS[feed];

  // Find next slot
  let nextSlot = slots.find(s => s > currentMinute);
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
// Crypto ALWAYS at :20, :50
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
  dailyLimit: parseInt(process.env.MARKETSTACK_BUDGET_DAILY || '250'),
  minuteLimit: parseInt(process.env.MARKETSTACK_BUDGET_MINUTE || '3'),
  warnThreshold: 0.7,
});
```

### 25.2 Shared vs Separate Budgets

| Provider | Feeds | Budget | File |
|----------|-------|--------|------|
| TwelveData | FX, Crypto | 800/day **SHARED** | `twelvedata/budget.ts` |
| Marketstack | Indices | 250/day **SEPARATE** | `marketstack/budget.ts` |
| None | Commodities | 0 (fallback) | N/A |

**Key insight:** FX and Crypto both import from `twelvedata/budget.ts`. They share ONE budget instance. This is enforced by the folder structure — there's only one `budget.ts` in the TwelveData folder.

### 25.3 Commodities Status

Commodities has **no active provider** (removed from TwelveData Jan 2026):

```typescript
// fallback/commodities.ts
const nullBudget: BudgetManagerInterface = {
  canSpend: () => false,
  spend: () => {},
  getState: () => ({
    dailyUsed: 0,
    dailyLimit: 0,
    minuteUsed: 0,
    minuteLimit: 0,
    state: 'ok',
    lastReset: new Date().toISOString(),
  }),
  reset: () => {},
};
```

The `/commodities` endpoint returns `source: 'fallback'` until a new provider is integrated.

---

## 26. Architectural Guardrails

### 26.1 Overview

The provider-based structure solves many problems but introduces new risks. This section documents each risk and the guardrail that prevents it.

| # | Risk | Severity | Guardrail |
|---|------|----------|-----------|
| G1 | Cross-provider duplication | Medium | Shared code in `lib/` |
| G2 | Hard to find all feeds | Low | `server.ts` as index |
| G3 | Import path complexity | Low | Flat import convention |
| G4 | Scheduler/budget drift | Medium | Shared interfaces |
| G5 | Onboarding curve | Low | README per folder |
| G6 | Circular dependencies | Medium | One-way dependency flow |
| G7 | Over-abstraction | Low | File count limits |

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
import { fxHandler, cryptoHandler } from './twelvedata/index.js';
import { indicesHandler } from './marketstack/index.js';
import { commoditiesHandler } from './fallback/commodities.js';
```

### 26.4 G3: Flat Import Convention

**Risk:** Import path complexity — easy to get `../lib/` vs `../../lib/` wrong.

**Rules:**
- Provider → lib = always `../lib/`
- Provider → same provider = always `./`
- NEVER import across providers

```typescript
// twelvedata/fx.ts
import { createFeedHandler } from '../lib/feed-handler.js';  // ✅ ../lib/
import { twelveDataBudget } from './budget.js';              // ✅ ./

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

**Handles:** FX, Crypto feeds  
**Budget:** 800 credits/day (shared across both feeds)  
**Scheduler:** Clock-aligned :00/:30 (FX), :20/:50 (Crypto)

## Files
| File | Purpose |
|------|---------|
| `index.ts` | Exports fxHandler, cryptoHandler |
| `budget.ts` | Single budget instance |
| `scheduler.ts` | Clock-aligned timing |
| `fx.ts` | FX feed configuration |
| `crypto.ts` | Crypto feed configuration |
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
│  Provider folders (twelvedata, marketstack) │  ← Import from lib/
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

| Folder | Max Files | Rationale |
|--------|-----------|-----------|
| `lib/` | 10 | Core infrastructure only |
| `twelvedata/` | 10 | README, index, adapter, budget, scheduler, + feeds |
| `marketstack/` | 8 | README, index, adapter, budget, scheduler, + feeds |
| `fallback/` | 5 | README, + inactive feeds |

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

| Document | Relevance |
|----------|-----------|
| **Book 1** (`promagen-api-brain-v2.md`) | §0–§22: Core policies, roles, SSOT |
| `GATEWAY-REFACTOR.md` | Full implementation blueprint |
| `api-calming-efficiency.md` | Calming techniques, metrics |
| `fly-v2.md` | §12: Provider-based deployment |
| `ARCHITECTURE.md` | Gateway architecture overview |

---

## Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-01-14 | v2.6.0 | **Book 2 created** |
| | | Added §23 Provider-Based Gateway Architecture |
| | | Added §24 Clock-Aligned Scheduler |
| | | Added §25 Budget Tracking (Per Provider) |
| | | Added §26 Architectural Guardrails (7 guardrails) |
| | | Updated architecture diagram for provider folders |
| | | Updated timing stagger — Commodities now fallback only |
| | | Gateway refactored: 4,002-line monolith → provider-based modules |

---

## Summary

**Book 2 documents the Jan 14, 2026 gateway refactor:**

1. **Provider-based folders** — `twelvedata/`, `marketstack/`, `fallback/`
2. **Clock-aligned scheduler** — Replaces 90% TTL drift with fixed slots
3. **One budget per provider** — TwelveData shared, Marketstack separate
4. **7 guardrails** — Prevent drift, duplication, and circular dependencies

**Key principle:** Always update docs FIRST before writing any code. Docs are the single source of truth.

---

_This is Book 2 of the API Brain. For core policies and roles (§0–§22), see Book 1._
