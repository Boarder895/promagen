# Promagen TODO - API Integration Tasks

## Created: 2025-12-28

## Last Updated: 2026-01-02

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

## 2. Prompt Builder Authentication Lock (Added Jan 2, 2026)

**Priority: CRITICAL**

The prompt builder must be locked behind authentication with usage quotas for free users.

### 2.1 Usage Tracking System

**Task:** Implement daily prompt usage tracking

**Storage:** Vercel KV (consistent with voting system)

**Key Requirements:**
- Track on "Copy prompt" button clicks
- 30 prompts/day for free users, unlimited for paid
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
- Same gradient as Randomise and Sign In buttons
- Consistent across all 12 category dropdowns
- Overlay messages: "Sign in to unlock" / "Go Pro for unlimited"
- Disable all interactions when locked

**Files to modify:**
- `src/components/providers/prompt-builder.tsx` - Main component logic
- `src/components/ui/combobox.tsx` - Add lock state props and styling
- `src/app/globals.css` - Add lock state gradient classes

**CSS Implementation:**
```css
/* Purple-pink gradient lock state */
.prompt-lock-gradient {
  background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%);
  pointer-events: none;
  position: relative;
}

.prompt-lock-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  font-weight: 600;
  border-radius: inherit;
  z-index: 10;
}
```

### 2.3 Enhanced User Tier Integration

**Task:** Extend paid user benefits to prompt builder

**Enhanced limits for paid users:**
- Style category: 2 selections (was 1)
- Lighting category: 2 selections (was 1)  
- Fidelity category: 2 selections (was 1)
- No daily usage limits

**Implementation:**
```typescript
const getSelectionLimits = (userTier: 'free' | 'paid') => ({
  subject: 1,
  action: 1,
  style: userTier === 'paid' ? 2 : 1,
  environment: 1,
  composition: 1,
  camera: 1,
  lighting: userTier === 'paid' ? 2 : 1,
  colour: 1,
  atmosphere: 1,
  materials: 1,
  fidelity: userTier === 'paid' ? 2 : 1,
  negative: 5
});
```

### 2.4 Verification Checklist

After implementation:

- [ ] Prompt builder locked for unauthenticated users
- [ ] Purple-pink gradient applied to locked dropdowns
- [ ] "Sign in to unlock" message displays correctly
- [ ] Free users see usage counter (X/30 prompts today)
- [ ] Copy prompt button tracks usage for free users
- [ ] Quota enforcement at 30 prompts/day for free users
- [ ] "Go Pro for unlimited" message when quota exceeded
- [ ] Paid users never see usage limits or lock states
- [ ] Enhanced selection limits active for paid users
- [ ] Daily reset at midnight in user's timezone
- [ ] Usage data persists in Vercel KV

---

## 3. Geographic Exchange Ordering (Added Jan 2, 2026)

**Priority: MEDIUM**

Implement user location-based exchange ordering for authenticated users.

### 3.1 Location Detection System

**Task:** Implement user location detection

**Approach:** Browser geolocation API (free) with IP geolocation fallback

**Implementation:**

1. **Create location hook:**
   - `src/hooks/use-user-location.ts` - Location detection and management
   - Browser geolocation API with permission handling
   - IP geolocation fallback using free tier API (ipapi.co or ipgeolocation.io)
   - Store location in localStorage for session persistence

2. **Location detection flow:**
   ```typescript
   interface UserLocation {
     latitude: number;
     longitude: number;
     source: 'gps' | 'ip' | 'default';
     timestamp: number;
   }
   
   const detectLocation = async (): Promise<UserLocation> => {
     try {
       // Try browser geolocation first
       const position = await getCurrentPosition();
       return {
         latitude: position.coords.latitude,
         longitude: position.coords.longitude,
         source: 'gps',
         timestamp: Date.now()
       };
     } catch {
       // Fallback to IP geolocation
       const ipLocation = await getIPLocation();
       return ipLocation;
     }
   };
   ```

**Cost analysis:**
- Browser geolocation API: **Free**
- IP geolocation fallback: **Free tier** (1000 requests/day)
- No additional API costs

### 3.2 Relative Exchange Ordering

**Task:** Update exchange ordering logic for location-relative sorting

**Current:** Absolute longitude-based ordering (east → west)
**New:** Relative ordering based on user's location or Greenwich reference

**Files to modify:**
- `src/lib/exchange-order.ts` - Core ordering logic
- `src/components/layout/homepage-grid.tsx` - Apply ordering to rails
- `src/hooks/use-promagen-auth.ts` - Add reference frame state

**Algorithm:**
```typescript
const orderExchangesRelative = (
  exchanges: Exchange[],
  referencePoint: { lat: number; lng: number },
  referenceFrame: 'user' | 'greenwich'
) => {
  const reference = referenceFrame === 'greenwich' 
    ? { lat: 51.4769, lng: 0 } // Greenwich
    : referencePoint;
    
  return exchanges
    .map(exchange => ({
      ...exchange,
      relativeBearing: calculateBearing(reference, exchange)
    }))
    .sort((a, b) => a.relativeBearing - b.relativeBearing);
};
```

### 3.3 Reference Frame Toggle (Paid Users)

**Task:** Add reference frame toggle for paid users

**Toggle options:**
- "My Location" - relative to detected user location
- "Greenwich" - relative to Greenwich meridian (0°)

**UI Implementation:**
- Settings toggle in user menu (paid users only)
- Persist preference in Clerk user metadata
- Immediate re-ordering when changed

**Implementation:**
```typescript
// Store in Clerk publicMetadata
{
  "tier": "paid",
  "referenceFrame": "user" | "greenwich"
}

// Default for all users: user location (free users have no choice)
// Paid users can toggle between "user" and "greenwich"
```

### 3.4 Verification Checklist

After implementation:

- [ ] Location permission prompt on first visit (authenticated users)
- [ ] IP geolocation fallback works without GPS permission  
- [ ] Exchange rails re-order based on user's location
- [ ] Free users see location-relative ordering (no choice)
- [ ] Paid users can toggle between "My Location" and "Greenwich"
- [ ] Greenwich reference works as universal baseline
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

## Summary: Files to Delete (11 total)

```
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
```

---

## Summary: New Files to Create

### Prompt Builder Authentication:
```
src/app/api/usage/track/route.ts          # Usage tracking endpoint
src/hooks/use-daily-usage.ts              # Daily usage management hook  
src/hooks/use-user-location.ts            # Location detection hook
src/lib/usage-tracking.ts                 # Usage tracking utilities
src/lib/location-utils.ts                 # Geographic calculation utilities
```

### Enhanced Components:
```
src/components/ui/combobox.tsx             # Enhanced with lock states
src/components/providers/prompt-builder.tsx # Enhanced with auth
src/hooks/use-promagen-auth.ts            # Enhanced with usage data
```

---

## Changelog

- **2 Jan 2026:** **MAJOR UPDATE** — Added §2 Prompt Builder Authentication Lock (usage tracking, lock states, visual treatment). Added §3 Geographic Exchange Ordering (location detection, relative ordering, reference frame toggle). Updated verification checklists and implementation requirements. Added new file creation list.
- **2 Jan 2026:** Marked §1.1 Login Integration as DONE. Added Clerk integration details. Added §7.4 auth routes to delete list. Added §9.3 Auth Button Header Layout fix. Updated verification checklist.
- **2 Jan 2026:** Added §1 Community Voting System Activation (login integration, Vercel KV, cron secret). Added §9.2 Vote Button Brightness fix.
- **28 Dec 2025:** Initial version with market status, weather, exchange types, and file cleanup tasks.
