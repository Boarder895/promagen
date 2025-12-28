# Promagen TODO - API Integration Tasks

## Created: 2025-12-28

## Last Updated: 2025-12-28

This document tracks deferred work for API integration and cleanup tasks.

---

## 1. Market Status (Future API Integration)

**Current State:**

- `src/components/exchanges/time/market-status.tsx` - UI component with client-side logic ✅
- `src/lib/markets/status.ts` - Stub returning "closed" ❌ DELETE
- `src/lib/market-status.ts` - Basic weekend check (legacy) ❌ DELETE

**When API Ready:**

1. Implement real market status logic in `src/lib/markets/status.ts` (recreate with real logic)
2. Have `market-status.tsx` consume the lib function

---

## 2. Weather (Future API Integration)

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

## 3. Exchange Types Consolidation ✅ DONE

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

## 4. File Cleanup - READY TO DELETE

### 4.1 `src/lib/weather/` - Delete 2 files

| File          | Reason                                                     |
| ------------- | ---------------------------------------------------------- |
| `provider.ts` | Not imported anywhere, broken import to `../markets/types` |
| `types.ts`    | Not imported anywhere, types unused                        |

**After cleanup:** 3 files remain (`exchange-weather.ts`, `weather.ts`, `weather-client.ts`) + tests

### 4.2 `src/lib/markets/` - Delete 5 files

| File          | Reason                                                                  |
| ------------- | ----------------------------------------------------------------------- |
| `layout.ts`   | Duplicates `splitEastWest()` logic in `lib/exchange-order.ts`           |
| `provider.ts` | `citySeed()` not imported anywhere                                      |
| `status.ts`   | Stub, real logic lives in `components/exchanges/time/market-status.tsx` |
| `types.ts`    | Loose Exchange type, canonical type now in `data/exchanges/types.ts`    |
| `shape.ts`    | Not imported, `cx()` duplicates `cn()` in `lib/utils.ts`                |

**After cleanup:** 2 files remain (`holiday-detector.ts`, `hours.ts`)

### 4.3 `src/lib/` root - Delete 1 file

| File               | Reason                                   |
| ------------------ | ---------------------------------------- |
| `market-status.ts` | Legacy duplicate, logic now in component |

---

## 5. Verification Commands

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

# TypeScript check after deletion
npx tsc --noEmit

# Lint
npm run lint

# Tests (should still pass)
npm test -- --testPathPattern="exchange|weather|holiday"

# Build
npm run build
```

---

## 6. Future Consideration: Move to `src/lib/markets/`

The user mentioned potentially moving exchange files to `src/lib/markets/` for organization.

**If decided:**

1. Move `src/data/exchanges/types.ts` → `src/lib/markets/exchange.types.ts`
2. Update all imports
3. Keep `src/data/exchanges/` for JSON data files only

---

## 7. UI Fixes ✅ DONE

### 7.1 Exchange Card Consistent Spacing (2025-12-28)

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

---

## Summary: Files to Delete (8 total)

```
src/lib/weather/provider.ts
src/lib/weather/types.ts
src/lib/markets/layout.ts
src/lib/markets/provider.ts
src/lib/markets/status.ts
src/lib/markets/types.ts
src/lib/markets/shape.ts
src/lib/market-status.ts
```
