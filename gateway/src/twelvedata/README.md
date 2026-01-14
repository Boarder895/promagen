# TwelveData Provider

> **Location:** `gateway/src/twelvedata/`  
> **Authority:** `docs/authority/GATEWAY-REFACTOR.md`

---

## Overview

This folder contains everything related to the **TwelveData API provider**.

| Aspect | Value |
|--------|-------|
| **Feeds** | FX, Crypto |
| **Daily budget** | 800 credits (SHARED across both feeds) |
| **Minute limit** | 8 credits/minute |
| **Scheduler** | Clock-aligned :00/:30 (FX), :20/:50 (Crypto) |

---

## Files

| File | Purpose |
|------|---------|
| `index.ts` | Exports `fxHandler`, `cryptoHandler` |
| `budget.ts` | Single shared budget instance (800/day) |
| `scheduler.ts` | Clock-aligned timing for FX and Crypto |
| `adapter.ts` | TwelveData API fetch logic |
| `fx.ts` | FX feed configuration |
| `crypto.ts` | Crypto feed configuration |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    TwelveData                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────┐         ┌─────────────┐           │
│  │   FX Feed   │         │ Crypto Feed │           │
│  │  :00, :30   │         │  :20, :50   │           │
│  └──────┬──────┘         └──────┬──────┘           │
│         │                       │                   │
│         └───────────┬───────────┘                   │
│                     │                               │
│              ┌──────▼──────┐                        │
│              │   Shared    │                        │
│              │   Budget    │                        │
│              │  (800/day)  │                        │
│              └─────────────┘                        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Clock-Aligned Scheduler

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

## Shared Budget

**Critical:** Both FX and Crypto share the same 800/day TwelveData pool.

- FX call at :00 → spends from shared budget
- Crypto call at :20 → spends from SAME shared budget
- If FX exhausts budget → Crypto also blocked

This is why there's ONE `budget.ts` file, not one per feed.

---

## Security

| Layer | Protection |
|-------|------------|
| Input validation | All catalog data validated |
| API key handling | Dynamic from env, never logged |
| Rate limiting | Budget + circuit breaker |
| Error handling | Graceful degradation to fallback |

---

## Usage

```typescript
import { fxHandler, cryptoHandler } from './twelvedata/index.js';

// Initialize
await fxHandler.init();
await cryptoHandler.init();

// Start clock-aligned refresh
fxHandler.startBackgroundRefresh();
cryptoHandler.startBackgroundRefresh();

// Get data
const fxData = await fxHandler.getData();
const cryptoData = await cryptoHandler.getData();
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
