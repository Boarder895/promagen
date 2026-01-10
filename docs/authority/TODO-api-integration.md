# Promagen TODO - API Integration Tasks

## Created: 2025-12-28

## Last Updated: 2026-01-09

This document tracks deferred work for API integration, cleanup tasks, and activation requirements.

---

## 1. Community Voting System Activation (Added Jan 2, 2026)

**Priority: HIGH**

The voting system is fully implemented but requires backend infrastructure to activate:

### 1.1 Login Integration ✅ DONE

**Completed:** 2 January 2026

**What was built:**
- Clerk authentication provider integrated
- `ClerkProvider` wrapping app in `layout.tsx`
- `clerkMiddleware` protecting routes in `middleware.ts`
- Sign-in/sign-up pages with dark theme
- `AuthButton` component in header (purple-pink gradient)
- `usePromagenAuth()` hook for components
- CSP headers configured for Clerk

**Files created:**
- `src/app/sign-in/[[...sign-in]]/page.tsx`
- `src/app/sign-up/[[...sign-up]]/page.tsx`
- `src/components/auth/auth-button.tsx`
- `src/components/auth/index.ts`
- `src/hooks/use-promagen-auth.ts`

**Files modified:**
- `src/app/layout.tsx` — Added `ClerkProvider`
- `src/middleware.ts` — Added `clerkMiddleware`, protected routes, CSP
- `src/components/layout/homepage-grid.tsx` — Added `AuthButton` to header

**Authority document:** `docs/authority/clerk-auth.md`

**Remaining task:** Wire `isAuthenticated` from `usePromagenAuth()` to `ProvidersTable` component.

**Implementation:**
```typescript
// In page component or wrapper:
'use client';
import { usePromagenAuth } from '@/hooks/use-promagen-auth';

function PageWrapper() {
  const { isAuthenticated } = usePromagenAuth();
  return <ProvidersTable isAuthenticated={isAuthenticated} />;
}
```

### 1.2 Vercel KV Configuration

**Task:** Configure KV storage for persistent vote data

**Environment Variables Required:**
```env
KV_REST_API_URL=<vercel-kv-url>
KV_REST_API_TOKEN=<vercel-kv-token>
```

**Current State:**
- `src/lib/kv/adapters/vercel.ts` - Vercel KV adapter ready ✅
- `src/lib/kv/adapters/local.ts` - Local fallback (dev only) ✅
- `src/lib/voting/storage.ts` - Uses KV adapter ✅

**Activation Steps:**
1. Create Vercel KV database in Vercel dashboard
2. Copy connection strings to Vercel environment variables
3. Verify writes work: `curl -X POST /api/providers/vote` (with auth)
4. Verify reads work: `curl /api/providers/vote?providerId=midjourney`

### 1.3 Cron Job Secret

**Task:** Set `CRON_SECRET` for rankings recalculation job

**Environment Variable Required:**
```env
CRON_SECRET=<secure-random-string>
```

**Current State:**
- `src/app/api/cron/rankings/route.ts` - Cron endpoint exists ✅
- `vercel.json` - Needs cron schedule configuration ❌

**Activation Steps:**
1. Generate secure random string (min 32 chars)
2. Add to Vercel environment variables
3. Add cron configuration to `vercel.json`:
   ```json
   {
     "crons": [
       {
         "path": "/api/cron/rankings",
         "schedule": "0 * * * *"
       }
     ]
   }
   ```
4. Verify cron executes: check Vercel cron logs

### 1.4 Verification Checklist

After all items are configured:

- [x] Clerk authentication working (sign-in modal appears)
- [x] AuthButton shows in header on all pages
- [ ] Wire `isAuthenticated` to `ProvidersTable`
- [ ] Vote button changes from disabled to enabled when logged in
- [ ] Vote persists after page refresh (check localStorage)
- [ ] Vote sent to `/api/providers/vote` returns 200
- [ ] Vote data appears in Vercel KV dashboard
- [ ] Cron job runs hourly and updates rankings
- [ ] Rankings endpoint returns calculated scores

---

## 1.5 Gateway TypeScript & Security Fixes ✅ DONE

**Completed:** 8 January 2026

**Problem:** Gateway had 12 TypeScript errors preventing compilation:
- `Cannot find module 'zod'` - Zod not installed
- `Parameter 'p' implicitly has an 'any' type` - forEach callbacks
- `Property 'length' does not exist on type '{}'` - Type narrowing issues

**Solution:** Two options provided:

**Option A - Install Zod (recommended):**
```powershell
cd C:\Users\Proma\Projects\promagen\gateway
pnpm add zod
```

**Option B - Manual type guards (Zod-free):**
Replaced Zod schemas with equivalent manual type guards in `lib/schemas.ts`.

**Files modified:**
- `gateway/lib/schemas.ts` — Zod schemas OR manual type guards (v2.1.0)
- `gateway/index.ts` — Updated validation calls, explicit types (v2.1.0)
- `gateway/adapters/twelvedata.fx.ts` — Explicit forEach types (v2.1.0)

**Key fix pattern:**
```typescript
// BEFORE (implicit any - TS7006 error):
req.requestedPairs.forEach((p, idx) => { ... });

// AFTER (explicit types):
req.requestedPairs.forEach((p: FxRibbonPair, idx: number) => { ... });
```

**Security score:** 10/10 maintained
- All external data validated at runtime
- No unsafe `as T` type assertions
- Graceful degradation on validation failures

**Verification:**
```powershell
cd C:\Users\Proma\Projects\promagen\gateway
pnpm run typecheck  # Should pass with 0 errors
pnpm run lint       # Should pass
```

---

## 1.6 FX SSOT Gateway Integration ✅ DONE

**Completed:** 9 January 2026

**Problem:** The gateway had a hardcoded FX_PAIRS array duplicating what's in `frontend/src/data/fx/fx-pairs.json`. This violated SSOT — two places to maintain = drift guaranteed.

**Solution:** TRUE SSOT architecture — gateway fetches pairs from frontend on startup.

### Architecture (Option A - Runtime SSOT)

```
frontend/src/data/fx/fx-pairs.json   ← THE ONE AND ONLY SOURCE
              ↓
frontend/api/fx/config               ← NEW: Exposes it as API
              ↓
gateway fetches on startup           ← UPDATED: Gets config from frontend
              ↓
gateway serves FX quotes             ← Uses fetched pairs
```

### Files Created

**Frontend:**
- `src/app/api/fx/config/route.ts` — NEW endpoint exposing fx-pairs.json

**Response format:**
```json
{
  "version": 1,
  "ssot": "frontend/src/data/fx/fx-pairs.json",
  "generatedAt": "2026-01-09T02:00:00.000Z",
  "pairs": [
    { "id": "eur-usd", "base": "EUR", "quote": "USD" },
    { "id": "gbp-usd", "base": "GBP", "quote": "USD" }
  ]
}
```

### Files Modified

**Gateway:**
- `src/server.ts` — Complete rewrite for SSOT fetch

**Key changes:**
```typescript
// NEW: Environment variable for SSOT endpoint
const FX_CONFIG_URL = process.env['FX_CONFIG_URL'] ?? 'https://promagen.com/api/fx/config';

// NEW: Fallback pairs (only used if frontend unreachable)
const FALLBACK_FX_PAIRS: FxPair[] = [...];

// NEW: Runtime state
let activeFxPairs: FxPair[] = [];
let ssotSource: 'frontend' | 'fallback' = 'fallback';

// NEW: Fetch from SSOT on startup
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

// Startup sequence
async function start(): Promise<void> {
  await initFxPairs();  // Fetch SSOT first
  // ... then start server
}
```

### API Responses Include SSOT Metadata

**Health endpoint (`/health`):**
```json
{
  "status": "ok",
  "ssot": {
    "source": "frontend",
    "configUrl": "https://promagen.com/api/fx/config",
    "pairCount": 8,
    "pairs": ["eur-usd", "gbp-usd", ...]
  }
}
```

**FX endpoint (`/fx`) meta field:**
```json
{
  "meta": {
    "mode": "live",
    "ssotSource": "frontend",
    ...
  }
}
```

### Cleanup Required (From Previous Bad Attempt)

**DELETE these files/folders from gateway if they exist:**

```powershell
# Run from: C:\Users\Proma\Projects\promagen\gateway
Remove-Item -Recurse -Force ".\lib\ssot" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force ".\data" -ErrorAction SilentlyContinue
```

These were created in a failed attempt that duplicated fx-pairs.json instead of implementing true SSOT.

### Deployment Order

1. **Deploy frontend first** (so /api/fx/config exists):
   ```powershell
   # Run from: C:\Users\Proma\Projects\promagen\frontend
   git add .
   git commit -m "feat: add /api/fx/config SSOT endpoint"
   git push  # Vercel auto-deploys
   ```

2. **Then deploy gateway:**
   ```powershell
   # Run from: C:\Users\Proma\Projects\promagen\gateway
   fly deploy
   ```

### Verification

```powershell
# 1. Check frontend SSOT endpoint
Invoke-RestMethod -Uri "https://promagen.com/api/fx/config"

# 2. Check gateway loaded from SSOT
Invoke-RestMethod -Uri "https://promagen-api.fly.dev/health"
```

**Expected /health response:**
```json
{
  "ssot": {
    "source": "frontend"    // ← This means TRUE SSOT is working
  }
}
```

If `"source": "fallback"`, the gateway couldn't reach frontend on startup.

### How to Change FX Pairs (TRUE SSOT)

1. Edit **ONE file**: `frontend/src/data/fx/fx-pairs.json`
2. Deploy frontend: `git push`
3. Restart gateway: `fly apps restart promagen-api`

**That's it. One file. Both systems update.**

---

## 1.7 Gateway lib/*.ts TypeScript Import Fixes ✅ DONE

**Completed:** 9 January 2026

**Problem:** 18 TypeScript errors in gateway lib/*.ts files:
- NodeNext module resolution requires `.js` extensions on imports
- `limits` possibly undefined in quota.ts

**Files Fixed:**
| File | Fix |
|------|-----|
| `lib/adapters.ts` | `'./types'` → `'./types.js'` |
| `lib/http.ts` | `'./config'` → `'./config.js'`, `'./logging'` → `'./logging.js'` |
| `lib/quota.ts` | Import fix + extracted `DEFAULT_LIMITS` with explicit type |
| `lib/resilience.ts` | `'./logging'` → `'./logging.js'` |
| `lib/roles.ts` | All 3 imports fixed with `.js` |
| `lib/types.ts` | `'./schemas'` → `'./schemas.js'` |

**Key pattern:**
```typescript
// BEFORE (TS2835 error):
import { logInfo } from './logging';

// AFTER:
import { logInfo } from './logging.js';
```

**Verification:**
```powershell
# Run from: C:\Users\Proma\Projects\promagen\gateway
npx tsc --noEmit  # Should pass with 0 errors
```

---

## 1.8 pnpm Monorepo Lockfile Sync

**Issue:** Vercel deployment failed with `ERR_PNPM_OUTDATED_LOCKFILE`

**Root cause:** pnpm workspace has `frontend/` and `gateway/` packages, but `pnpm-lock.yaml` was out of sync with `gateway/package.json`.

**Solution:**
```powershell
# Run from: C:\Users\Proma\Projects\promagen (monorepo root)
pnpm install
git add pnpm-lock.yaml
git commit -m "chore: update pnpm-lock.yaml"
git push
```

**Monorepo structure:**
```
promagen/
├── pnpm-workspace.yaml    # Defines workspace packages
├── pnpm-lock.yaml         # Shared lockfile for all packages
├── frontend/              # Next.js app (deploys to Vercel)
│   └── package.json
└── gateway/               # Fly.io gateway
    └── package.json
```

**pnpm-workspace.yaml:**
```yaml
packages:
  - frontend
  - gateway
```

---

## 2. Prompt Builder Authentication Lock (Added Jan 2, 2026)

**Priority: CRITICAL**

The prompt builder must be locked behind authentication with usage quotas for free users.

### 2.1 Usage Tracking System

**Task:** Implement daily prompt usage tracking

**Storage:** Vercel KV (consistent with voting system)

**Key Requirements:**
- Track on "Copy prompt" button clicks
- 10 prompts/day for free users, unlimited for paid
- Daily reset at midnight in user's local timezone
- Purple-pink gradient lock styling matching brand buttons

**Environment Variables:** Uses existing Vercel KV setup (§1.2)

**Implementation Steps:**

1. **Create usage tracking API endpoint:**
   - `src/app/api/usage/track/route.ts` - POST endpoint for tracking usage
   - Validate user authentication
   - Increment daily counter in KV storage
   - Return current usage status

2. **Create usage hook:**
   - `src/hooks/use-daily-usage.ts` - Hook for usage state management
   - Fetch current usage on mount
   - Update local state after tracking
   - Handle timezone-aware reset logic

3. **Enhance `usePromagenAuth` hook:**
   ```typescript
   interface PromagenAuthState {
     // ... existing fields
     dailyUsage: {
       count: number;
       limit: number | null; // null for paid users
       resetTime: Date;
     } | null;
   }
   ```

4. **Update prompt builder component:**
   - Check authentication state in `PromptBuilder`
   - Apply lock states based on auth/quota status
   - Track "Copy prompt" clicks for free users
   - Show usage counter for free users under quota

**Storage Schema:**
```typescript
// Key: `usage:${userId}:${date}` (date in user's timezone)
interface DailyUsage {
  userId: string;
  date: string; // YYYY-MM-DD
  promptCount: number;
  timezone: string;
  lastUpdated: string; // ISO timestamp
}
```

### 2.2 Lock State Visual Implementation

**Task:** Implement purple-pink gradient lock styling

**Visual Requirements:**
- Lock icon overlay on prompt builder dropdowns
- Purple-pink gradient matches `AuthButton`
- Semi-transparent backdrop with blur effect
- Clear call-to-action button centered in lock overlay
- Disabled state styling for individual dropdowns (not lock overlay on each)

**CSS tokens (already in globals.css):**
```css
--gradient-purple-pink: linear-gradient(135deg, theme('colors.purple.500'), theme('colors.pink.500'));
```

### 2.3 Verification Checklist

- [ ] Anonymous user sees usage counter (X/5 free prompts today)
- [ ] Anonymous user at limit sees central lock overlay
- [ ] Anonymous user lock resets at midnight (daily reset)
- [ ] Free user sees usage counter (X/10 prompts today)
- [ ] Free user at quota sees central lock overlay
- [ ] Paid user has no usage counter
- [ ] Usage increments on "Copy prompt" click
- [ ] Usage persists after page refresh

---

## 2.4 "Ask Promagen" — LLM-Powered Suggestion Feature (Added Jan 8, 2026)

**Priority: MEDIUM (deferred)**

**Status:** Planned — to be implemented after core features stable

### Overview

"Ask Promagen" is a server-side LLM interpretation feature that complements the planned client-side Prompt Intelligence system. They serve different purposes:

| Layer | What It Does | Cost |
|-------|--------------|------|
| **Ask Promagen** (this feature) | Natural language → structured dropdown selections via LLM | ~$0.001/call |
| **Prompt Intelligence** (planned, see `prompt-intelligence.md`) | Client-side semantic scoring, reordering, conflict detection | Free (client-side) |

Both enhance the same prompt builder UI without changing its layout.

### User Flow

```
User types: "cozy winter scene, nostalgic feeling"
                    │
                    ▼
            ┌───────────────┐
            │  Claude Haiku │  (~$0.001)
            │  or GPT-4o-mini│
            └───────┬───────┘
                    │
                    ▼
         ┌─────────────────────┐
         │ Structured Response │
         │ {                   │
         │   subject: "cabin", │
         │   environment: "snowy forest", │
         │   lighting: "warm firelight", │
         │   atmosphere: "cozy", │
         │   colour: "warm tones", │
         │   style: "nostalgic film" │
         │ }                   │
         └──────────┬──────────┘
                    │
                    ▼
    ┌───────────────────────────────┐
    │ Match to existing dropdown    │
    │ options (fuzzy match against  │
    │ 2,056 curated terms)          │
    └───────────────────────────────┘
                    │
                    ▼
         Auto-populate dropdowns
         + Show "Promagen selected:" chips
```

### UI Position

Between header and dropdowns — prominent but skippable:

```
┌─────────────────────────────────────────────────────────────────┐
│ [▼ Midjourney] · Prompt builder    [Dynamic] [Optimize] [📈]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  💬 Describe what you want...                      [Suggest →]  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ A cozy winter scene that feels nostalgic                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Subject ▼    Action ▼    Style ▼    Environment ▼   ...       │
```

### Educational Output

After suggestions populate, show what was selected and why:

```
┌─────────────────────────────────────────────────────────────────┐
│ ✨ Promagen selected:                                           │
│                                                                 │
│ Subject: "cabin in woods" — Your focal point                    │
│ Environment: "snowy forest" — Sets the winter scene             │
│ Lighting: "warm firelight" — Creates cozy contrast              │
│ Atmosphere: "peaceful" — Nostalgic, calm mood                   │
│ Colour: "warm muted tones" — Vintage film look                  │
│                                                                 │
│ [Accept All]  [Edit Selections]  [Clear]                        │
└─────────────────────────────────────────────────────────────────┘
```

Users learn what each category does by seeing the reasoning.

### Tier Limits

See `paid_tier.md` §5.8 for authoritative limits:

| Tier | Daily Ask Promagen Limit |
|------|--------------------------|
| Anonymous | 5 suggestions/day |
| Standard Promagen | 10 suggestions/day |
| Pro Promagen | Unlimited |

### Proposed File Structure

```
src/
├── components/providers/
│   ├── prompt-builder.tsx          # Add <AskPromagen> slot above dropdowns
│   └── ask-promagen.tsx            # NEW: Input + suggestion chips UI
├── app/api/promagen/
│   └── suggest/route.ts            # NEW: Server route → LLM
├── lib/promagen/
│   └── suggest.ts                  # NEW: Fuzzy match + LLM prompt assembly
└── hooks/
    └── use-ask-promagen.ts         # NEW: State + debounce + tier limits
```

### Technical Decisions (to resolve before implementation)

1. **LLM Provider:** Claude Haiku ($0.25/1M input) or GPT-4o-mini? Single provider or fallback chain?

2. **Caching:** Cache identical queries (Vercel KV) for 24h to reduce costs?

3. **Fuzzy Matching:** Use existing `semantic-tags.json` (when built) or simple string matching for now?

4. **Error Handling:** Toast fallback when LLM fails → "Try selecting manually"?

5. **Rate Limiting:** Per-user daily limits stored in Vercel KV (same as usage tracking)?

### Cost Control

| Aspect | Approach |
|--------|----------|
| Rate limit | 5/day anonymous, 10/day free, unlimited paid |
| Model | Claude Haiku ($0.25/1M input) or GPT-4o-mini |
| Caching | Cache identical queries (Redis/KV) for 24h |
| Debounce | 500ms debounce on input, only call on [Suggest →] click |

### Fallback Chain

```
1. Try Claude Haiku API
   ↓ fails
2. Try GPT-4o-mini API (if configured)
   ↓ fails  
3. Show toast: "Suggestion unavailable — try the dropdowns below"
   (existing rule-based system works fine)
```

### Implementation NOT Started

This feature is documented for future implementation. All files listed above are proposals only.

---

## 3. Geographic Exchange Ordering (Added Jan 2, 2026)

**Priority: MEDIUM**

Location-aware exchange ordering provides a personalised view based on the user's geographic position.

### 3.1 Location Detection

**Task:** Implement browser geolocation with IP fallback

**Current State:**
- No location detection implemented
- All users see same default ordering (16 exchanges)

**Implementation:**
```typescript
// src/hooks/use-user-location.ts
interface UserLocation {
  longitude: number;
  latitude: number;
  source: 'gps' | 'ip' | 'default';
  accuracy: 'high' | 'medium' | 'low';
}
```

**Detection order:**
1. Browser Geolocation API (high accuracy, requires permission)
2. IP Geolocation via free service (medium accuracy, no permission)
3. Default center (0° longitude - Greenwich) if both fail

### 3.2 Relative Ordering

**Task:** Implement east→west ordering relative to user's longitude

**Algorithm:**
1. Get user's longitude
2. Sort all exchanges by longitudinal distance from user
3. Split into left rail (east of user) and right rail (west of user)
4. Display east-to-west within each rail

**File:** `src/lib/rails/order-exchanges.ts` (exists, needs enhancement)

### 3.3 Reference Frame Toggle

**Task:** Add reference frame preference for signed-in users

**UI:**
- Toggle in header or settings
- Options: "My Location" (default) vs "Greenwich (UTC)"
- Preference persists in localStorage/Clerk metadata

**Current State:**
- `src/components/reference-frame-toggle.tsx` - Component exists (stub) ✅
- `src/lib/exchange-order.ts` - Has `splitEastWest()` but fixed reference ✅

### 3.4 Verification Checklist

- [ ] Browser geolocation prompt appears (first visit)
- [ ] IP fallback works when geolocation denied
- [ ] Default ordering works when both fail
- [ ] Exchanges reorder based on user longitude
- [ ] Reference frame toggle visible for signed-in users
- [ ] Reference frame preference persists across sessions
- [ ] Exchange ordering remains east→west relative to chosen reference
- [ ] Performance acceptable (no blocking on location detection)

---

## 4. Market Status (Future API Integration)

**Current State:**

- `src/components/exchanges/time/market-status.tsx` - UI component with client-side logic ✅
- `src/lib/markets/status.ts` - Stub returning "closed" ❌ DELETE
- `src/lib/market-status.ts` - Basic weekend check (legacy) ❌ DELETE

**When API Ready:**

1. Implement real market status logic in `src/lib/markets/status.ts` (recreate with real logic)
2. Have `market-status.tsx` consume the lib function

---

## 5. Weather (Future API Integration)

**Current State:**

- `src/lib/weather/exchange-weather.ts` - Uses demo data ✅ KEEP
- `src/lib/weather/weather.ts` - Core types + helpers ✅ KEEP
- `src/lib/weather/weather-client.ts` - Visual Crossing API client ✅ KEEP
- `src/components/exchanges/weather/exchange-condition.tsx` - Uses SSOT emoji fallback ✅

**When API Ready:**

1. Set `WEATHER_MODE=live` in environment
2. Configure `VISUAL_CROSSING_API_KEY`
3. Weather client already has TTL caching (30 min default)

---

## 6. Exchange Types Consolidation ✅ DONE

**Completed: 2025-12-28**

Consolidated 3 Exchange types into 1 canonical type:

| Before                                       | After                                             |
| -------------------------------------------- | ------------------------------------------------- |
| `src/data/exchanges/types.ts` (raw catalog)  | `src/data/exchanges/types.ts` (canonical SSOT) ✅ |
| `src/lib/exchanges.ts` (UI-focused)          | Re-exports from canonical + helpers               |
| `src/lib/exchange-order.ts` (with longitude) | Uses canonical type directly                      |

**Key Changes:**

- Canonical `Exchange` type now includes ALL fields
- Single adapter function `toCardData()` in `adapters.ts`
- Legacy functions kept for backward compatibility (deprecated)

---

## 7. File Cleanup - READY TO DELETE

### 7.1 `src/lib/weather/` - Delete 2 files

| File          | Reason                                                     |
| ------------- | ---------------------------------------------------------- |
| `provider.ts` | Not imported anywhere, broken import to `../markets/types` |
| `types.ts`    | Not imported anywhere, types unused                        |

**After cleanup:** 3 files remain (`exchange-weather.ts`, `weather.ts`, `weather-client.ts`) + tests

### 7.2 `src/lib/markets/` - Delete 5 files

| File          | Reason                                                                  |
| ------------- | ----------------------------------------------------------------------- |
| `layout.ts`   | Duplicates `splitEastWest()` logic in `lib/exchange-order.ts`           |
| `provider.ts` | `citySeed()` not imported anywhere                                      |
| `status.ts`   | Stub, real logic lives in `components/exchanges/time/market-status.tsx` |
| `types.ts`    | Loose Exchange type, canonical type now in `data/exchanges/types.ts`    |
| `shape.ts`    | Not imported, `cx()` duplicates `cn()` in `lib/utils.ts`                |

**After cleanup:** 2 files remain (`holiday-detector.ts`, `hours.ts`)

### 7.3 `src/lib/` root - Delete 1 file

| File               | Reason                                   |
| ------------------ | ---------------------------------------- |
| `market-status.ts` | Legacy duplicate, logic now in component |

### 7.4 `src/app/api/auth/` - DELETE (Replaced by Clerk)

| File          | Reason                                      |
| ------------- | ------------------------------------------- |
| `login/route.ts`  | Replaced by Clerk authentication        |
| `logout/route.ts` | Replaced by Clerk authentication        |
| `me/route.ts`     | Replaced by Clerk's `useAuth()` hook    |

**Note:** These stub routes are now obsolete. Clerk handles all authentication.

### 7.5 `gateway/lib/ssot/` - DELETE (Bad SSOT attempt)

| File/Folder | Reason |
| ----------- | ------ |
| `lib/ssot/` | Entire folder from failed SSOT implementation. Gateway now fetches from frontend. |
| `data/` | If exists, delete. Gateway has no local data files - fetches from frontend SSOT. |

**Cleanup command:**
```powershell
# Run from: C:\Users\Proma\Projects\promagen\gateway
Remove-Item -Recurse -Force ".\lib\ssot" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force ".\data" -ErrorAction SilentlyContinue
```

---

## 8. Verification Commands

```powershell
# Run from frontend folder
cd C:\Users\Proma\Projects\promagen\frontend

# Verify no imports before deleting (should return empty)
Select-String -Path "src/**/*.ts","src/**/*.tsx" -Pattern "lib/weather/provider" -Recurse
Select-String -Path "src/**/*.ts","src/**/*.tsx" -Pattern "lib/weather/types" -Recurse
Select-String -Path "src/**/*.ts","src/**/*.tsx" -Pattern "lib/markets/shape" -Recurse
Select-String -Path "src/**/*.ts","src/**/*.tsx" -Pattern "lib/markets/layout" -Recurse
Select-String -Path "src/**/*.ts","src/**/*.tsx" -Pattern "lib/markets/provider" -Recurse
Select-String -Path "src/**/*.ts","src/**/*.tsx" -Pattern "lib/markets/status" -Recurse
Select-String -Path "src/**/*.ts","src/**/*.tsx" -Pattern "lib/markets/types" -Recurse
Select-String -Path "src/**/*.ts","src/**/*.tsx" -Pattern "lib/market-status" -Recurse

# TypeScript check after implementation
npx tsc --noEmit

# Lint
npm run lint

# Tests (should pass with new auth tests)
npm test -- --testPathPattern="exchange|weather|holiday|auth|prompt|usage"

# Build
npm run build
```

---

## 9. UI Fixes ✅ DONE

### 9.1 Exchange Card Consistent Spacing (2025-12-28)

**Problem:** Gap between time/weather columns varied based on content width and screen size.

**Solution:** Changed from `auto` to fixed-width columns:

```tsx
// Before (variable spacing)
grid-cols-[1fr_auto_auto]

// After (consistent spacing)
grid-cols-[1fr_5rem_3rem]
```

| Column               | Width               | Content             |
| -------------------- | ------------------- | ------------------- |
| Left (Exchange Info) | `1fr` (flexible)    | Flag + name + city  |
| Center (Time/Status) | `5rem` (80px fixed) | Clock + open/closed |
| Right (Weather)      | `3rem` (48px fixed) | Temp + emoji        |

**File:** `src/components/exchanges/exchange-card.tsx`

### 9.2 Vote Button Brightness (2026-01-02)

**Problem:** Thumbs-up icon was too dim, hard to see against dark background.

**Solution:** Increased opacity values in globals.css:

| State | Before | After |
|-------|--------|-------|
| Base (idle) | `rgba(148, 163, 184, 0.7)` | `rgba(203, 213, 225, 1)` |
| Disabled | `rgba(100, 116, 139, 0.4)` | `rgba(148, 163, 184, 0.8)` |
| Loading | `rgba(100, 116, 139, 0.3)` | `rgba(148, 163, 184, 0.6)` |

**File:** `src/app/globals.css` (vote-thumb section)

### 9.3 Auth Button Header Layout (2026-01-02)

**Problem:** PROMAGEN label and Sign In button needed proper alignment.

**Solution:** 
- PROMAGEN stays centred horizontally
- Sign In button positioned top-right (absolute)
- Both on same baseline
- Reduced gap between hero text and content area by ⅓

**File:** `src/components/layout/homepage-grid.tsx`

---

## 10. Future Consideration: Move to `src/lib/markets/`

The user mentioned potentially moving exchange files to `src/lib/markets/` for organization.

**If decided:**

1. Move `src/data/exchanges/types.ts` → `src/lib/markets/exchange.types.ts`
2. Update all imports
3. Keep `src/data/exchanges/` for JSON data files only

---

## Summary: Files to Delete (14 total)

```
# Frontend
src/lib/weather/provider.ts
src/lib/weather/types.ts
src/lib/markets/layout.ts
src/lib/markets/provider.ts
src/lib/markets/status.ts
src/lib/markets/types.ts
src/lib/markets/shape.ts
src/lib/market-status.ts
src/app/api/auth/login/route.ts
src/app/api/auth/logout/route.ts
src/app/api/auth/me/route.ts

# Gateway (cleanup from bad SSOT attempt)
gateway/lib/ssot/                    # Entire folder
gateway/data/                        # Entire folder (if exists)
```

---

## Summary: New Files Created (Jan 9, 2026)

### FX SSOT Integration:
```
frontend/src/app/api/fx/config/route.ts   # NEW: SSOT API endpoint
gateway/src/server.ts                      # UPDATED: Fetches from frontend SSOT
```

### Prompt Builder Authentication:
```
src/app/api/usage/track/route.ts          # Usage tracking endpoint
src/hooks/use-daily-usage.ts              # Daily usage management hook  
src/hooks/use-user-location.ts            # Location detection hook
src/lib/usage-tracking.ts                 # Usage tracking utilities
src/lib/location-utils.ts                 # Geographic calculation utilities
```

### Ask Promagen (when implemented):
```
src/components/providers/ask-promagen.tsx # NEW: Input + suggestion chips UI
src/app/api/promagen/suggest/route.ts     # NEW: Server route → LLM
src/lib/promagen/suggest.ts               # NEW: Fuzzy match + LLM prompt assembly
src/hooks/use-ask-promagen.ts             # NEW: State + debounce + tier limits
```

### Enhanced Components:
```
src/components/ui/combobox.tsx             # Enhanced with lock states
src/components/providers/prompt-builder.tsx # Enhanced with auth + Ask Promagen slot
src/hooks/use-promagen-auth.ts            # Enhanced with usage data
```

---

## Changelog

- **9 Jan 2026:** Added §1.6 FX SSOT Gateway Integration (DONE). True SSOT architecture: frontend exposes `/api/fx/config`, gateway fetches on startup. Removes hardcoded FX_PAIRS duplication. Added §1.7 Gateway lib/*.ts TypeScript Import Fixes. Added §1.8 pnpm Monorepo Lockfile Sync. Added §7.5 gateway cleanup for bad SSOT attempt files.

- **8 Jan 2026:** Updated §2.1 and §2.3 — Changed Standard Promagen daily prompt limit from 30/day to **10/day**. Clean tier progression: Anonymous 5/day → Free 10/day → Paid unlimited.

- **8 Jan 2026:** Added §2.4 "Ask Promagen" — LLM-Powered Suggestion Feature. Documents server-side LLM interpretation feature complementing client-side Prompt Intelligence. Includes tier limits (Anonymous: 5, Standard: 10, Pro: Unlimited), UI mockups, technical decisions to resolve, file structure proposal. Status: planned/deferred.
- **8 Jan 2026:** Added §1.5 Gateway TypeScript & Security Fixes (DONE). Fixed 12 TypeScript errors: installed Zod dependency, added explicit types to forEach callbacks, fixed type narrowing issues. Gateway v2.1.0 with 10/10 security score.
- **2 Jan 2026:** **MAJOR UPDATE** — Added §2 Prompt Builder Authentication Lock (usage tracking, lock states, visual treatment). Added §3 Geographic Exchange Ordering (location detection, relative ordering, reference frame toggle). Updated verification checklists and implementation requirements. Added new file creation list.
- **2 Jan 2026:** Marked §1.1 Login Integration as DONE. Added Clerk integration details. Added §7.4 auth routes to delete list. Added §9.3 Auth Button Header Layout fix. Updated verification checklist.
- **2 Jan 2026:** Added §1 Community Voting System Activation (login integration, Vercel KV, cron secret). Added §9.2 Vote Button Brightness fix.
- **28 Dec 2025:** Initial version with market status, weather, exchange types, and file cleanup tasks.
