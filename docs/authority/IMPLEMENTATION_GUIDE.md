# Exchange Clock Implementation Guide

## 📦 Files Overview

### Clock Components (Time Display)

| Component | Location | Purpose |
|-----------|----------|---------|
| `LedClock` | `components/exchanges/time/led-clock.tsx` | 7-segment LED display clock (primary) |
| `ExchangeClock` | `components/exchanges/time/exchange-clock.tsx` | Text-based clock (fallback) |
| `HybridClock` | `components/exchanges/time/hybrid-clock.tsx` | Analog + digital combo |
| `AnalogClock` | `components/exchanges/time/analog-clock.tsx` | SVG analog clock face |
| `MarketStatusIndicator` | `components/exchanges/time/market-status.tsx` | Open/Closed status badge |

### Supporting Files

| File | Purpose |
|------|---------|
| `lib/clock.ts` | Timezone utilities (`formatClockInTZ`, `nowInTZ`) |
| `lib/__tests__/clock.test.ts` | Unit tests for clock utilities |
| `components/exchanges/__tests__/exchange-clock.test.tsx` | Component tests |

---

## 🎯 Primary Component: LedClock

The `LedClock` component is a retro 7-segment LED display clock used in exchange cards.

### Features

- **7-segment display** – Classic LCD/LED aesthetic with green (emerald-400) digits
- **Dim segments** – "Off" segments are visible at 10% opacity for authentic LED look
- **Blinking colon** – Blinks every second (on even seconds, off on odd)
- **Optional seconds** – `showSeconds={true}` for HH:MM:SS, default is HH:MM
- **Timezone-aware** – Uses native `Intl.DateTimeFormat` (zero dependencies)
- **Memoized** – `React.memo` prevents unnecessary re-renders

### Props

```typescript
type LedClockProps = {
  tz: string;           // IANA timezone (e.g. "Asia/Tokyo")
  showSeconds?: boolean; // Show seconds (default: false)
  className?: string;    // CSS class for wrapper
  ariaLabel?: string;    // Accessibility label (default: "Local time")
};
```

### Example Usage

```tsx
import { LedClock } from '@/components/exchanges/time/led-clock';

// Basic (HH:MM format)
<LedClock tz="Asia/Tokyo" />

// With seconds (HH:MM:SS format)
<LedClock tz="Europe/London" showSeconds />

// With custom aria-label
<LedClock 
  tz="America/New_York" 
  ariaLabel="New York local time" 
/>
```

### Fallback Behavior

When timezone is empty or invalid:
- `showSeconds={false}` → displays `--:--`
- `showSeconds={true}` → displays `--:--:--`

---

## 🏗️ Integration with ExchangeCard

The `ExchangeCard` component uses `LedClock` for time display:

```tsx
// From exchange-card.tsx (lines 77-87)
{tz ? (
  <LedClock
    tz={tz}
    showSeconds={false}
    ariaLabel={`Local time in ${city || name}`}
  />
) : (
  <div className="...">
    <span className="font-mono text-sm text-slate-500">--:--</span>
  </div>
)}
```

**Key integration points:**
- Default format: HH:MM (no seconds) for cleaner exchange card layout
- Fallback placeholder matches clock format (`--:--` without seconds)
- ARIA label includes city/exchange name for accessibility

---

## 📁 File Locations

```
frontend/src/
├── lib/
│   ├── clock.ts                           ← Timezone utilities
│   └── __tests__/
│       └── clock.test.ts                  ← Unit tests
│
└── components/
    └── exchanges/
        ├── exchange-card.tsx              ← Uses LedClock
        ├── time/
        │   ├── led-clock.tsx              ← 7-segment LED display ★
        │   ├── exchange-clock.tsx         ← Text-based clock
        │   ├── hybrid-clock.tsx           ← Analog + digital
        │   ├── analog-clock.tsx           ← SVG analog
        │   └── market-status.tsx          ← Open/Closed badge
        └── __tests__/
            ├── exchange-card.test.tsx     ← Card tests
            └── exchange-clock.test.tsx    ← Clock tests
```

---

## ✅ Verification Steps

### Step 1: Lint & Type Check (PowerShell – Frontend folder)

```powershell
cd C:\Users\Proma\Projects\promagen\frontend

# TypeScript check
pnpm run typecheck
# Expected: No errors

# ESLint
pnpm run lint
# Expected: No errors
```

### Step 2: Run Tests (PowerShell – Frontend folder)

```powershell
# Run all tests
pnpm run test:ci

# Run only exchange-related tests
pnpm test -- --testPathPattern="exchange"

# Expected: All tests pass
```

### Step 3: Manual Testing (Browser)

1. Start dev server: `pnpm dev`
2. Navigate to exchange rails or macro page
3. Verify:
   - ✅ LED clocks display in HH:MM format (green digits)
   - ✅ Colons blink every second
   - ✅ Different timezones show different times
   - ✅ Dim segments visible when "off"
   - ✅ No console errors

### Step 4: Production Build

```powershell
pnpm run build
# Expected: Build succeeds with no errors
```

---

## 🎯 What "Good" Looks Like

### ✅ Successful Integration Checklist

- [ ] TypeScript compilation succeeds with no errors
- [ ] ESLint passes with no warnings  
- [ ] All tests pass (including exchange-card.test.tsx)
- [ ] Production build succeeds
- [ ] LED clocks display correctly with green 7-segment digits
- [ ] Colons blink every second
- [ ] Invalid/missing timezones show placeholder (`--:--`)
- [ ] No console errors or warnings

### ✅ Performance Checklist

- [ ] CPU usage stays low (<1% per clock on modern desktop)
- [ ] No visible jank or stutter in updates
- [ ] Component is memoized (uses React.memo)
- [ ] Interval cleanup happens on unmount

---

## 🔧 Troubleshooting

### Issue: TypeScript error "segments[i] is possibly undefined"

**Solution:** The fix uses nullish coalescing:
```typescript
<Segment key={i} on={segments[i] ?? false} d={d} />
```

### Issue: Test expects `--:--:--` but component shows `--:--`

**Cause:** Test expectation doesn't match component behavior when `showSeconds={false}`.

**Solution:** Update test to expect `--:--` (the correct placeholder format).

### Issue: Clock shows wrong time

**Solution:** Verify timezone string is valid IANA format:
- ✅ Correct: `"Asia/Tokyo"`, `"Europe/London"`
- ❌ Wrong: `"Tokyo"`, `"GMT"`, `"EST"`

---

## 📊 Implementation Summary

### LedClock Component

- **Type:** Client component (`'use client'`)
- **Props:** `tz`, `showSeconds`, `className`, `ariaLabel`
- **Performance:** Memoized with `React.memo`
- **Accessibility:** ARIA-compliant, screen reader friendly
- **Cleanup:** Properly cleans up `setInterval` on unmount
- **Dependencies:** Zero (uses native `Intl.DateTimeFormat`)

### Design Decisions

1. **7-segment display** – Professional financial app aesthetic
2. **Green digits** – Classic LED look (emerald-400)
3. **Dim "off" segments** – Authentic LCD feel at 10% opacity
4. **HH:MM default** – Cleaner layout, seconds optional
5. **SVG-based** – Crisp at any scale, small bundle size

---

## 📝 Notes

- **Existing features preserved:** Yes
- **Breaking changes:** None
- **Dependencies added:** None (uses native browser APIs)
- **Bundle size impact:** ~3KB (SVG paths + component logic)

---

**Documentation updated:** December 2024
