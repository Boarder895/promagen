# Gateway Modular Refactor — Implementation Blueprint

> **Status:** 📋 APPROVED (Phase 1: TwelveData)  
> **Location:** `docs/authority/GATEWAY-REFACTOR.md`  
> **Companion docs:**
>
> - `promagen-api-brain-v2.md` (policy + rules)
> - `api-calming-efficiency.md` (metrics + techniques)
> - `fly-v2.md` (deployment + config)

---

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

### Current State

The gateway `server.ts` is **4,002 lines** containing:

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

**~71% of the file is duplicated patterns** with only variable names changed.

### Why This Is a Problem

1. **Bug risk**: Fix a cache bug in FX → forget to fix in Commodities/Crypto/Indices
2. **Cognitive load**: 4,002 lines to navigate for any change
3. **Testing difficulty**: Tightly coupled, hard to test in isolation
4. **Onboarding friction**: New contributor sees wall of copy-paste
5. **Feature velocity**: Adding 5th feed = copy 800 lines
6. **Debugging difficulty**: Provider logic scattered across monolithic file
7. **Budget confusion**: TwelveData feeds share budget but code is scattered

### Target State

A **Provider-Based Modular Architecture** where:

- Each API provider has its own folder
- Provider-specific logic (adapter, budget, scheduler) is co-located
- Shared infrastructure lives in `lib/`
- `server.ts` is routes + startup only
- Bug fixes apply everywhere automatically
- Adding new provider = one folder

---

## Provider Status (Jan 14, 2026)

### Active Providers

| Provider    | Feeds      | Status    | Daily Budget | Folder         |
| ----------- | ---------- | --------- | ------------ | -------------- |
| TwelveData  | FX, Crypto | ✅ Active | 800 credits  | `twelvedata/`  |
| Marketstack | Indices    | ✅ Active | 250 credits  | `marketstack/` |

### Removed Providers

| Provider   | Feed            | Status     | Reason                       | Folder      |
| ---------- | --------------- | ---------- | ---------------------------- | ----------- |
| TwelveData | ~~Commodities~~ | ⏸️ Removed | Finding alternative provider | `fallback/` |

---

## Target Architecture (Provider-Based)

### File Structure

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
│   │   ├── adapter.ts         # Marketstack API fetch logic
│   │   ├── budget.ts          # Separate 250/day budget (ONE instance)
│   │   ├── scheduler.ts       # Clock-aligned slots (:05/:35)
│   │   └── indices.ts         # Indices feed config
│   │
│   └── fallback/              # ← Feeds with no provider
│       ├── README.md          # Explains why fallback exists
│       └── commodities.ts     # Returns demo prices only
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

## Architectural Guardrails

### Overview: Risks and Mitigations

The provider-based structure solves many problems but introduces new risks. This section documents each risk and the guardrail that prevents it.

| Risk                       | Description                                | Severity | Guardrail               |
| -------------------------- | ------------------------------------------ | -------- | ----------------------- |
| Cross-provider duplication | Same logic copied to each provider folder  | Medium   | Shared code in `lib/`   |
| Hard to find all feeds     | Feeds scattered across 3 folders           | Low      | `server.ts` as index    |
| Import path complexity     | Easy to get `../` wrong                    | Low      | Flat import convention  |
| Scheduler/budget drift     | Providers implement differently over time  | Medium   | Shared interfaces       |
| Onboarding curve           | New dev doesn't know where to look         | Low      | README per folder       |
| Circular dependencies      | Provider imports lib, lib imports provider | Medium   | One-way dependency flow |
| Over-abstraction           | Too many tiny files                        | Low      | File count limits       |

---

### Guardrail 1: Shared Code in `lib/`

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

**Enforcement:** Code review checklist item.

---

### Guardrail 2: `server.ts` as Feed Index

**Risk:** Hard to find all feeds — they're scattered across 3 different folders.

**Rule:** Every provider folder has `index.ts` that exports ALL handlers from that provider. `server.ts` imports from these index files, making it the one place to see all feeds.

```typescript
// server.ts — THE place to see all feeds at a glance
import { fxHandler, cryptoHandler } from './twelvedata/index.js';
import { indicesHandler } from './marketstack/index.js';
import { commoditiesHandler } from './fallback/commodities.js';

// All 4 feeds listed in ONE place ↑
```

**Enforcement:** Convention. If a new feed is added, it MUST appear in `server.ts` imports.

---

### Guardrail 3: Flat Import Convention

**Risk:** Import path complexity — easy to get `../lib/` vs `../../lib/` wrong.

**Rules:**

- Provider → lib = always `../lib/`
- Provider → same provider = always `./`
- NEVER import across providers (no `../marketstack/` from `twelvedata/`)

```typescript
// twelvedata/fx.ts
import { createFeedHandler } from '../lib/feed-handler.js'; // ✅ ../lib/
import { twelveDataBudget } from './budget.js'; // ✅ ./
import { getMsUntilNextSlot } from './scheduler.js'; // ✅ ./

// ❌ NEVER do this:
import { marketstackBudget } from '../marketstack/budget.js'; // Cross-provider!
```

**Enforcement:** ESLint rule + TypeScript path checking.

```json
// .eslintrc.json
{
  "rules": {
    "no-restricted-imports": [
      "error",
      {
        "patterns": ["../twelvedata/*", "../marketstack/*", "../fallback/*"]
      }
    ]
  }
}
```

---

### Guardrail 4: Shared Interfaces for Schedulers and Budgets

**Risk:** Scheduler/budget drift — TwelveData scheduler gets updated, Marketstack scheduler doesn't, they diverge over time.

**Rule:** All schedulers and budgets implement shared interfaces from `lib/types.ts`. TypeScript enforces consistency.

```typescript
// lib/types.ts
export interface FeedScheduler {
  getMsUntilNextSlot(): number;
  getNextSlotTime(): Date;
  isSlotActive(): boolean;
}

export interface BudgetManager {
  canSpend(credits: number): boolean;
  spend(credits: number): void;
  getState(): BudgetState;
  reset(): void;
}
```

```typescript
// twelvedata/scheduler.ts — MUST implement FeedScheduler
import type { FeedScheduler } from '../lib/types.js';

export const fxScheduler: FeedScheduler = {
  getMsUntilNextSlot: () => {
    /* ... */
  },
  getNextSlotTime: () => {
    /* ... */
  },
  isSlotActive: () => {
    /* ... */
  },
};
```

**Enforcement:** TypeScript compiler. If interface changes, ALL implementations must update.

---

### Guardrail 5: README Per Provider Folder

**Risk:** Onboarding curve — new dev asks "where's the FX code?" and doesn't know where to look.

**Rule:** Every provider folder has a `README.md` explaining what it does, what feeds it handles, and what files are inside.

```markdown
# TwelveData Provider

**Handles:** FX, Crypto feeds  
**Budget:** 800 credits/day (shared across both feeds)  
**Scheduler:** Clock-aligned :00/:30 (FX), :20/:50 (Crypto)

## Files

| File           | Purpose                                         |
| -------------- | ----------------------------------------------- |
| `index.ts`     | Exports fxHandler, cryptoHandler                |
| `adapter.ts`   | TwelveData API fetch + response normalization   |
| `budget.ts`    | Single budget instance for all TwelveData feeds |
| `scheduler.ts` | Clock-aligned refresh timing                    |
| `fx.ts`        | FX feed configuration                           |
| `crypto.ts`    | Crypto feed configuration                       |

## Adding a New Feed

1. Create `{feed}.ts` with FeedConfig
2. Import budget and scheduler from this folder
3. Export handler from `index.ts`
4. Add route in `server.ts`
```

**Enforcement:** Checklist item when creating new provider folder.

---

### Guardrail 6: One-Way Dependency Flow

**Risk:** Circular dependencies — `twelvedata/fx.ts` imports from `lib/`, `lib/feed-handler.ts` accidentally imports from `twelvedata/`.

**Rule:** Dependencies flow DOWN only. `lib/` is the foundation — it imports from NOTHING except Node built-ins and npm packages.

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

```json
// .eslintrc.json
{
  "plugins": ["import"],
  "rules": {
    "import/no-cycle": "error"
  }
}
```

---

### Guardrail 7: File Count Limits

**Risk:** Over-abstraction — might create too many tiny files trying to "stay organized".

**Rule:** Each folder has a maximum file count. If exceeded, question whether new files are necessary.

| Folder         | Max Files | Rationale                                               |
| -------------- | --------- | ------------------------------------------------------- |
| `lib/`         | 10        | Core infrastructure only                                |
| `twelvedata/`  | 10        | README, index, adapter, budget, scheduler, + 1 per feed |
| `marketstack/` | 8         | README, index, adapter, budget, scheduler, + 1 per feed |
| `fallback/`    | 5         | README, + 1 per inactive feed                           |

**Enforcement:** Code review. If PR adds files that exceed limit, reviewer asks "is this necessary?"

---

### Guardrail Summary Checklist

Use this checklist during code review:

- [ ] **G1:** Is shared logic in `lib/`, not duplicated in provider folders?
- [ ] **G2:** Does new feed appear in `server.ts` imports?
- [ ] **G3:** Are imports flat (`../lib/` or `./`), no cross-provider imports?
- [ ] **G4:** Do schedulers/budgets implement shared interfaces?
- [ ] **G5:** Is README.md updated if provider folder changes?
- [ ] **G6:** No circular dependencies (run `npx eslint --rule 'import/no-cycle: error'`)?
- [ ] **G7:** File count within limits?

---

## Module Specifications

### 1. lib/types.ts

**Purpose:** All shared type definitions in one place.

**Contains:**

```typescript
// Provider types
export type ProviderState = 'ok' | 'warn' | 'blocked';
export type CircuitState = 'closed' | 'open' | 'half-open';
export type TickDirection = 'up' | 'down' | 'flat';

// Base quote interface (all feeds extend this)
export interface BaseQuote {
  symbol: string;
  price: number;
  change: number;
  percentChange: number;
  tick: TickDirection;
  timestamp: number;
}

// Feed-specific quote types
export interface FxQuote extends BaseQuote {
  /* FX fields */
}
export interface CryptoQuote extends BaseQuote {
  /* Crypto fields */
}
export interface IndexQuote extends BaseQuote {
  exchangeId: string;
  indexName: string;
}
export interface CommodityQuote extends BaseQuote {
  group: string;
}

// Budget state
export interface BudgetState {
  dailyUsed: number;
  dailyLimit: number;
  minuteUsed: number;
  minuteLimit: number;
  state: ProviderState;
  lastReset: string;
}

// Shared interfaces (Guardrail 4)
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

// Feed handler config
export interface FeedConfig<TCatalog, TQuote> {
  id: string;
  provider: string;
  ttlSeconds: number;
  cacheKey: string;
  ssotUrl: string;
  parseCatalog: (data: unknown) => TCatalog[];
  parseQuotes: (data: unknown, catalog: TCatalog[]) => TQuote[];
  fetchQuotes: (symbols: string[], apiKey: string) => Promise<unknown>;
  getFallback: () => TQuote[];
}
```

### 2. lib/cache.ts

**Purpose:** Generic TTL cache with stale-while-revalidate.

**Interface:**

```typescript
export class GenericCache<T> {
  constructor(ttlMs: number, maxSize?: number);

  get(key: string): T | null;
  set(key: string, value: T): void;
  getStale(key: string): T | null; // Returns expired data
  has(key: string): boolean;
  isExpired(key: string): boolean;
  getExpiry(key: string): Date | null;
  clear(): void;
  stats(): { hits: number; misses: number; size: number };
}
```

### 3. lib/circuit.ts

**Purpose:** Circuit breaker for provider failure isolation.

**Interface:**

```typescript
export class CircuitBreaker {
  constructor(config: {
    failureThreshold?: number; // Default 3
    resetTimeoutMs?: number; // Default 30000 (30s)
    id: string;
  });

  isOpen(): boolean;
  recordSuccess(): void;
  recordFailure(): void;
  getState(): CircuitState;
  getTripDuration(): number | null;
}
```

### 4. lib/dedup.ts

**Purpose:** Request deduplication (single-flight pattern).

**Interface:**

```typescript
export class RequestDeduplicator<T> {
  dedupe(key: string, fn: () => Promise<T>): Promise<T>;
  hasPending(key: string): boolean;
  getPendingCount(): number;
}
```

### 5. lib/feed-handler.ts

**Purpose:** Factory function that creates complete feed handlers.

**Interface:**

```typescript
export function createFeedHandler<TCatalog, TQuote extends BaseQuote>(
  config: FeedConfig<TCatalog, TQuote>,
  budget: BudgetManagerInterface, // ← Injected from provider folder
  scheduler: FeedScheduler, // ← Injected from provider folder
): FeedHandler<TCatalog, TQuote>;

export interface FeedHandler<TCatalog, TQuote> {
  // Lifecycle
  init(): Promise<void>;
  startBackgroundRefresh(): void;

  // Data access
  getData(): Promise<FeedResponse<TQuote>>;
  getCatalog(): TCatalog[];

  // Selection (for Pro users)
  handleSelection(selectedIds: string[]): Promise<FeedResponse<TQuote>>;
  validateSelection(ids: string[]): { valid: boolean; errors: string[] };

  // Diagnostics
  getTraceInfo(): FeedTraceInfo;
  getBudgetState(): BudgetState;
  getCacheStats(): CacheStats;
}
```

---

## Provider Modules

### 6. twelvedata/budget.ts

**Purpose:** Single TwelveData budget instance shared by FX and Crypto.

```typescript
import { BudgetManager } from '../lib/budget.js';
import type { BudgetManagerInterface, BudgetState } from '../lib/types.js';

// ONE instance for ALL TwelveData feeds
export const twelveDataBudget: BudgetManagerInterface = new BudgetManager({
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

**Key point:** This is the ONLY budget instance for TwelveData. Both FX and Crypto import from here.

### 7. twelvedata/scheduler.ts

**Purpose:** Clock-aligned refresh slots for TwelveData feeds.

```typescript
import type { FeedScheduler } from '../lib/types.js';

/**
 * Clock-aligned scheduler for TwelveData feeds.
 * Prevents rate limit violations by ensuring feeds never refresh simultaneously.
 *
 * Schedule:
 *   FX:     :00, :30 (even half-hours)
 *   Crypto: :20, :50 (20-minute offset)
 *
 * This guarantees only ONE TwelveData feed refreshes per slot,
 * keeping us under the 8 credits/minute limit.
 */

export type TwelveDataFeed = 'fx' | 'crypto';

const FEED_SLOTS: Record<TwelveDataFeed, number[]> = {
  fx: [0, 30], // Minutes 0 and 30
  crypto: [20, 50], // Minutes 20 and 50
};

export function createScheduler(feed: TwelveDataFeed): FeedScheduler {
  const slots = FEED_SLOTS[feed];

  return {
    getMsUntilNextSlot(): number {
      const now = new Date();
      const currentMinute = now.getMinutes();
      const currentSecond = now.getSeconds();

      let nextSlot = slots.find((s) => s > currentMinute);
      if (!nextSlot) {
        nextSlot = slots[0] + 60; // Wrap to next hour
      }

      const minutesUntil = nextSlot - currentMinute;
      const msUntil = (minutesUntil * 60 - currentSecond) * 1000;

      return Math.max(1000, msUntil); // Minimum 1 second
    },

    getNextSlotTime(): Date {
      const ms = this.getMsUntilNextSlot();
      return new Date(Date.now() + ms);
    },

    isSlotActive(): boolean {
      const minute = new Date().getMinutes();
      return slots.includes(minute);
    },
  };
}

// Pre-built schedulers for each feed
export const fxScheduler = createScheduler('fx');
export const cryptoScheduler = createScheduler('crypto');
```

### 8. twelvedata/adapter.ts

**Purpose:** TwelveData API fetch logic.

```typescript
import { logInfo, logError } from '../lib/logging.js';
import { twelveDataBudget } from './budget.js';

const TWELVEDATA_BASE_URL = 'https://api.twelvedata.com';

export interface TwelveDataPriceResponse {
  symbol: string;
  price: string;
  timestamp: number;
}

export async function fetchTwelveDataPrices(
  symbols: string[],
  apiKey: string,
): Promise<TwelveDataPriceResponse[]> {
  // Check budget BEFORE calling
  if (!twelveDataBudget.canSpend(symbols.length)) {
    throw new Error('TwelveData budget exhausted');
  }

  const symbolList = symbols.join(',');
  const url = `${TWELVEDATA_BASE_URL}/price?symbol=${symbolList}&apikey=${apiKey}`;

  logInfo('TwelveData fetch', { symbols: symbols.length });

  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('TwelveData rate limited');
    }
    throw new Error(`TwelveData error: ${response.status}`);
  }

  const data = await response.json();

  // Spend budget AFTER successful call
  twelveDataBudget.spend(symbols.length);

  return normalizeResponse(data, symbols);
}

function normalizeResponse(data: unknown, symbols: string[]): TwelveDataPriceResponse[] {
  // Handle single vs batch response format
  // ... normalization logic
}
```

### 9. twelvedata/fx.ts

**Purpose:** FX-specific configuration.

```typescript
import { createFeedHandler } from '../lib/feed-handler.js';
import { twelveDataBudget } from './budget.js';
import { fxScheduler } from './scheduler.js';
import { fetchTwelveDataPrices } from './adapter.js';
import type { FxPair, FxQuote, FeedConfig } from '../lib/types.js';

const FX_CONFIG: FeedConfig<FxPair, FxQuote> = {
  id: 'fx',
  provider: 'twelvedata',
  ttlSeconds: parseInt(process.env.FX_RIBBON_TTL_SECONDS || '1800'),
  ssotUrl: process.env.FX_CONFIG_URL || 'https://promagen.com/api/fx/config',
  cacheKey: 'fx:ribbon:all',

  parseCatalog: (data) => {
    /* Parse FX pairs from SSOT */
  },
  parseQuotes: (data, catalog) => {
    /* Map response to FxQuote[] */
  },
  fetchQuotes: fetchTwelveDataPrices,
  getFallback: () => {
    /* Return demo prices */
  },
};

export const fxHandler = createFeedHandler(FX_CONFIG, twelveDataBudget, fxScheduler);
```

### 10. twelvedata/crypto.ts

**Purpose:** Crypto-specific configuration.

```typescript
import { createFeedHandler } from '../lib/feed-handler.js';
import { twelveDataBudget } from './budget.js';
import { cryptoScheduler } from './scheduler.js';
import { fetchTwelveDataPrices } from './adapter.js';
import type { CryptoItem, CryptoQuote, FeedConfig } from '../lib/types.js';

const CRYPTO_CONFIG: FeedConfig<CryptoItem, CryptoQuote> = {
  id: 'crypto',
  provider: 'twelvedata',
  ttlSeconds: parseInt(process.env.CRYPTO_RIBBON_TTL_SECONDS || '1800'),
  ssotUrl: process.env.CRYPTO_CONFIG_URL || 'https://promagen.com/api/crypto/config',
  cacheKey: 'crypto:ribbon:all',

  parseCatalog: (data) => {
    /* Parse crypto from SSOT */
  },
  parseQuotes: (data, catalog) => {
    /* Map response to CryptoQuote[] */
  },
  fetchQuotes: fetchTwelveDataPrices,
  getFallback: () => {
    /* Return demo prices */
  },
};

export const cryptoHandler = createFeedHandler(CRYPTO_CONFIG, twelveDataBudget, cryptoScheduler);
```

### 11. twelvedata/index.ts

**Purpose:** Clean exports for server.ts.

```typescript
// TwelveData provider module
// Handles: FX, Crypto feeds
// Budget: 800 credits/day (shared)
// Scheduler: Clock-aligned slots (:00/:30 FX, :20/:50 Crypto)

export { fxHandler } from './fx.js';
export { cryptoHandler } from './crypto.js';
export { getTwelveDataBudgetState } from './budget.js';
```

### 12. marketstack/budget.ts

**Purpose:** Separate Marketstack budget (250/day).

```typescript
import { BudgetManager } from '../lib/budget.js';
import type { BudgetManagerInterface, BudgetState } from '../lib/types.js';

// Separate budget for Marketstack (does NOT share with TwelveData)
export const marketstackBudget: BudgetManagerInterface = new BudgetManager({
  id: 'marketstack',
  dailyLimit: parseInt(process.env.MARKETSTACK_BUDGET_DAILY || '250'),
  minuteLimit: parseInt(process.env.MARKETSTACK_BUDGET_MINUTE || '3'),
  warnThreshold: 0.7,
});

export function getMarketstackBudgetState(): BudgetState {
  return marketstackBudget.getState();
}
```

### 13. marketstack/scheduler.ts

**Purpose:** Clock-aligned refresh slots for Marketstack.

```typescript
import type { FeedScheduler } from '../lib/types.js';

/**
 * Clock-aligned scheduler for Marketstack feeds.
 *
 * Schedule:
 *   Indices: :05, :35 (5-minute offset from FX)
 *
 * This keeps Marketstack calls separate from TwelveData slots.
 */

const INDICES_SLOTS = [5, 35]; // Minutes 5 and 35

export const indicesScheduler: FeedScheduler = {
  getMsUntilNextSlot(): number {
    const now = new Date();
    const currentMinute = now.getMinutes();
    const currentSecond = now.getSeconds();

    let nextSlot = INDICES_SLOTS.find((s) => s > currentMinute);
    if (!nextSlot) {
      nextSlot = INDICES_SLOTS[0] + 60;
    }

    const minutesUntil = nextSlot - currentMinute;
    const msUntil = (minutesUntil * 60 - currentSecond) * 1000;

    return Math.max(1000, msUntil);
  },

  getNextSlotTime(): Date {
    const ms = this.getMsUntilNextSlot();
    return new Date(Date.now() + ms);
  },

  isSlotActive(): boolean {
    const minute = new Date().getMinutes();
    return INDICES_SLOTS.includes(minute);
  },
};
```

### 14. marketstack/indices.ts

**Purpose:** Indices-specific configuration.

```typescript
import { createFeedHandler } from '../lib/feed-handler.js';
import { marketstackBudget } from './budget.js';
import { indicesScheduler } from './scheduler.js';
import { fetchMarketstackIndices } from './adapter.js';
import type { ExchangeEntry, IndexQuote, FeedConfig } from '../lib/types.js';

const INDICES_CONFIG: FeedConfig<ExchangeEntry, IndexQuote> = {
  id: 'indices',
  provider: 'marketstack',
  ttlSeconds: parseInt(process.env.INDICES_RIBBON_TTL_SECONDS || '7200'),
  ssotUrl: process.env.INDICES_CONFIG_URL || 'https://promagen.com/api/indices/config',
  cacheKey: 'indices:default',

  parseCatalog: (data) => {
    /* Parse exchanges from SSOT */
  },
  parseQuotes: (data, catalog) => {
    /* Map response to IndexQuote[] */
  },
  fetchQuotes: fetchMarketstackIndices,
  getFallback: () => {
    /* Return demo prices */
  },
};

export const indicesHandler = createFeedHandler(
  INDICES_CONFIG,
  marketstackBudget,
  indicesScheduler,
);
```

### 15. fallback/commodities.ts

**Purpose:** Commodities placeholder (no provider).

```typescript
import { createFeedHandler } from '../lib/feed-handler.js';
import type {
  CommodityItem,
  CommodityQuote,
  FeedConfig,
  BudgetManagerInterface,
  FeedScheduler,
  BudgetState,
} from '../lib/types.js';

// Null budget manager - no API calls
const nullBudget: BudgetManagerInterface = {
  canSpend: () => false,
  spend: () => {},
  getState: (): BudgetState => ({
    dailyUsed: 0,
    dailyLimit: 0,
    minuteUsed: 0,
    minuteLimit: 0,
    state: 'ok',
    lastReset: new Date().toISOString(),
  }),
  reset: () => {},
};

// Null scheduler - never actually refreshes
const nullScheduler: FeedScheduler = {
  getMsUntilNextSlot: () => 30 * 60 * 1000,
  getNextSlotTime: () => new Date(Date.now() + 30 * 60 * 1000),
  isSlotActive: () => false,
};

const COMMODITIES_CONFIG: FeedConfig<CommodityItem, CommodityQuote> = {
  id: 'commodities',
  provider: 'none',
  ttlSeconds: 1800,
  ssotUrl: process.env.COMMODITIES_CONFIG_URL || 'https://promagen.com/api/commodities/config',
  cacheKey: 'commodities:ribbon:all',

  parseCatalog: (data) => {
    /* Parse from SSOT */
  },
  parseQuotes: () => {
    throw new Error('No provider configured');
  },
  fetchQuotes: async () => {
    throw new Error('No provider configured');
  },
  getFallback: () => {
    /* Return demo prices */
  },
};

export const commoditiesHandler = createFeedHandler(COMMODITIES_CONFIG, nullBudget, nullScheduler);
```

---

## Server.ts After Refactor

The new `server.ts` will be **~250 lines** containing only:

```typescript
import express from 'express';
import cors from 'cors';

// Import from provider modules (Guardrail 2: server.ts as index)
import { fxHandler, cryptoHandler, getTwelveDataBudgetState } from './twelvedata/index.js';
import { indicesHandler, getMarketstackBudgetState } from './marketstack/index.js';
import { commoditiesHandler } from './fallback/commodities.js';

const app = express();
app.use(cors());
app.use(express.json());

// ═══════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    feeds: {
      fx: fxHandler.getTraceInfo().status,
      crypto: cryptoHandler.getTraceInfo().status,
      indices: indicesHandler.getTraceInfo().status,
      commodities: commoditiesHandler.getTraceInfo().status,
    },
  });
});

app.get('/trace', (req, res) => {
  res.json({
    fx: fxHandler.getTraceInfo(),
    crypto: cryptoHandler.getTraceInfo(),
    indices: indicesHandler.getTraceInfo(),
    commodities: commoditiesHandler.getTraceInfo(),
    budget: getTwelveDataBudgetState(), // TwelveData (shared)
    indicesBudget: getMarketstackBudgetState(), // Marketstack (separate)
  });
});

app.get('/fx', async (req, res) => {
  const result = await fxHandler.getData();
  res.json(result);
});

app.get('/crypto', async (req, res) => {
  const result = await cryptoHandler.getData();
  res.json(result);
});

app.get('/indices', async (req, res) => {
  const result = await indicesHandler.getData();
  res.json(result);
});

app.get('/commodities', async (req, res) => {
  const result = await commoditiesHandler.getData();
  res.json(result);
});

// ═══════════════════════════════════════════
// STARTUP
// ═══════════════════════════════════════════

const PORT = parseInt(process.env.PORT || '3001');

async function start() {
  await Promise.all([
    fxHandler.init(),
    cryptoHandler.init(),
    indicesHandler.init(),
    commoditiesHandler.init(),
  ]);

  // Start background refresh (clock-aligned)
  fxHandler.startBackgroundRefresh();
  cryptoHandler.startBackgroundRefresh();
  indicesHandler.startBackgroundRefresh();
  // commoditiesHandler - no refresh (no provider)

  app.listen(PORT, () => {
    console.log(`Gateway listening on port ${PORT}`);
  });
}

start().catch(console.error);
```

---

## Migration Sequence

### Phase 1: TwelveData Module (Day 1-2)

**Scope:** FX + Crypto only. Don't touch Marketstack/Indices.

**Order:**

1. Create `lib/` modules (types, cache, circuit, dedup, logging, feed-handler)
2. Create `twelvedata/README.md` — provider documentation
3. Create `twelvedata/budget.ts` — ONE budget instance
4. Create `twelvedata/scheduler.ts` — clock-aligned slots
5. Create `twelvedata/adapter.ts` — API fetch logic
6. Create `twelvedata/fx.ts` — FX config
7. Create `twelvedata/crypto.ts` — Crypto config
8. Create `twelvedata/index.ts` — exports
9. Update `server.ts` to import from `twelvedata/`
10. Run guardrail checklist
11. Verify FX + Crypto work identically
12. Deploy

**Verification after Phase 1:**

```powershell
# Run from: C:\Users\Proma\Projects\promagen\gateway
npx tsc --noEmit  # 0 errors

# ESLint circular dependency check
npx eslint src/ --rule 'import/no-cycle: error'

# FX works?
(Invoke-RestMethod "https://promagen-api.fly.dev/fx").data.Count  # 8

# Crypto works?
(Invoke-RestMethod "https://promagen-api.fly.dev/crypto").data.Count  # 8

# Budget shows shared?
(Invoke-RestMethod "https://promagen-api.fly.dev/trace").budget
```

### Phase 2: Marketstack Module (Day 2-3)

**Scope:** Indices only.

1. Create `marketstack/README.md` — provider documentation
2. Create `marketstack/budget.ts` — SEPARATE budget instance
3. Create `marketstack/scheduler.ts` — :05/:35 slots
4. Create `marketstack/adapter.ts` — Marketstack API fetch
5. Create `marketstack/indices.ts` — Indices config
6. Create `marketstack/index.ts` — exports
7. Update `server.ts` to import from `marketstack/`
8. Run guardrail checklist
9. Verify Indices works identically
10. Deploy

### Phase 3: Fallback Module (Day 3)

**Scope:** Commodities placeholder.

1. Create `fallback/README.md` — explains why fallback exists
2. Create `fallback/commodities.ts` — returns fallback only
3. Update `server.ts` to import from `fallback/`
4. Run guardrail checklist
5. Verify `/commodities` returns fallback data
6. Deploy

### Phase 4: Cleanup (Day 3)

1. Remove old `feeds/` folder
2. Remove old `lib/shared-budgets.ts`
3. Final `npx tsc --noEmit` verification
4. Final guardrail checklist
5. Deploy to production

---

## Verification Checklist

### Before Refactor (Baseline)

```powershell
# Run from: C:\Users\Proma\Projects\promagen\gateway

# Save current responses
$fxBefore = Invoke-RestMethod "https://promagen-api.fly.dev/fx"
$cryptoBefore = Invoke-RestMethod "https://promagen-api.fly.dev/crypto"
$indicesBefore = Invoke-RestMethod "https://promagen-api.fly.dev/indices"
$traceBefore = Invoke-RestMethod "https://promagen-api.fly.dev/trace"

# Save to files
$fxBefore | ConvertTo-Json -Depth 10 | Out-File "baseline-fx.json"
$cryptoBefore | ConvertTo-Json -Depth 10 | Out-File "baseline-crypto.json"
$indicesBefore | ConvertTo-Json -Depth 10 | Out-File "baseline-indices.json"
$traceBefore | ConvertTo-Json -Depth 10 | Out-File "baseline-trace.json"
```

### After Refactor (Verification)

```powershell
# TypeScript compiles
npx tsc --noEmit  # Expected: 0 errors

# No circular dependencies (Guardrail 6)
npx eslint src/ --rule 'import/no-cycle: error'

# All endpoints respond
(Invoke-RestMethod "https://promagen-api.fly.dev/health").status  # "ok"

# Data counts match
(Invoke-RestMethod "https://promagen-api.fly.dev/fx").data.Count          # 8
(Invoke-RestMethod "https://promagen-api.fly.dev/crypto").data.Count      # 8
(Invoke-RestMethod "https://promagen-api.fly.dev/indices").data.Count     # 16
(Invoke-RestMethod "https://promagen-api.fly.dev/commodities").source     # "fallback"

# Budgets tracked correctly (SEPARATE!)
$trace = Invoke-RestMethod "https://promagen-api.fly.dev/trace"
$trace.budget.state          # "ok" (TwelveData)
$trace.indicesBudget.state   # "ok" (Marketstack)
```

---

## Rollback Procedure

### Immediate Rollback (< 5 minutes)

```powershell
# Run from: C:\Users\Proma\Projects\promagen\gateway
Copy-Item "src/server.ts.backup" "src/server.ts"
fly deploy
```

### Git Rollback

```powershell
git log --oneline -10
git reset --hard <commit-hash>
fly deploy
```

---

## Success Criteria

| Criterion                     | Target               | Verification          |
| ----------------------------- | -------------------- | --------------------- |
| TypeScript compiles           | 0 errors             | `npx tsc --noEmit`    |
| No circular dependencies      | 0 errors             | `npx eslint` no-cycle |
| All endpoints respond         | 200 OK               | Health check passes   |
| FX data matches baseline      | Same structure       | Compare JSON          |
| Crypto data matches baseline  | Same structure       | Compare JSON          |
| Indices data matches baseline | Same structure       | Compare JSON          |
| Commodities returns fallback  | `source: 'fallback'` | Check response        |
| TwelveData budget tracked     | State = 'ok'         | Check `/trace`        |
| Marketstack budget tracked    | State = 'ok'         | Check `/trace`        |
| server.ts < 300 lines         | ~250 lines           | `wc -l src/server.ts` |
| Total gateway < 2,000 lines   | ~1,610 lines         | Count all files       |
| All guardrails pass           | 7/7                  | Checklist             |

---

## File Delivery Checklist

### Batch 1: Shared Infrastructure

- [ ] `gateway/src/lib/types.ts`
- [ ] `gateway/src/lib/logging.ts`
- [ ] `gateway/src/lib/cache.ts`
- [ ] `gateway/src/lib/budget.ts`
- [ ] `gateway/src/lib/circuit.ts`
- [ ] `gateway/src/lib/dedup.ts`
- [ ] `gateway/src/lib/feed-handler.ts`

### Batch 2: TwelveData Module (Phase 1)

- [ ] `gateway/src/twelvedata/README.md`
- [ ] `gateway/src/twelvedata/budget.ts`
- [ ] `gateway/src/twelvedata/scheduler.ts`
- [ ] `gateway/src/twelvedata/adapter.ts`
- [ ] `gateway/src/twelvedata/fx.ts`
- [ ] `gateway/src/twelvedata/crypto.ts`
- [ ] `gateway/src/twelvedata/index.ts`

### Batch 3: Marketstack Module (Phase 2)

- [ ] `gateway/src/marketstack/README.md`
- [ ] `gateway/src/marketstack/budget.ts`
- [ ] `gateway/src/marketstack/scheduler.ts`
- [ ] `gateway/src/marketstack/adapter.ts`
- [ ] `gateway/src/marketstack/indices.ts`
- [ ] `gateway/src/marketstack/index.ts`

### Batch 4: Fallback Module (Phase 3)

- [ ] `gateway/src/fallback/README.md`
- [ ] `gateway/src/fallback/commodities.ts`

### Batch 5: Integration

- [ ] `gateway/src/server.ts` (rewritten)

### Batch 6: Config Updates

- [ ] `gateway/.eslintrc.json` (add guardrail rules)

---

## Cross-References

| Document                    | What to Update                                    |
| --------------------------- | ------------------------------------------------- |
| `promagen-api-brain-v2.md`  | Add §23 noting provider-based refactor complete   |
| `api-calming-efficiency.md` | Update architecture diagram with provider folders |
| `fly-v2.md`                 | Add §12 with new provider-based file structure    |
| `ARCHITECTURE.md`           | Update gateway section with provider folders      |

---

## Changelog

| Date       | Change                                                          |
| ---------- | --------------------------------------------------------------- |
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

## Next Steps

1. ✅ Create this blueprint document
2. ✅ Review and approve provider-based structure
3. ✅ Add architectural guardrails
4. 📋 Create baseline captures (verification commands above)
5. 📋 Implement Phase 1: TwelveData module (FX + Crypto)
6. 📋 Implement Phase 2: Marketstack module (Indices)
7. 📋 Implement Phase 3: Fallback module (Commodities)
8. 📋 Implement Phase 4: Cleanup + production deploy
9. 📋 Update cross-reference documents

---

_This is the implementation blueprint. No code should be written until this document is approved._

_**Key principle:** Always update docs FIRST before writing any code. Docs are the single source of truth._
