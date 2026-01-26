# Mission Control Authority Document

**Last updated:** 26 January 2026  
**Version:** 1.1.0  
**Owner:** Promagen  
**Authority:** This document defines the Mission Control component behaviour, design, and edit locations.

---

## Purpose

Mission Control is the right-side CTA panel on the homepage, mirroring Engine Bay on the left for visual symmetry. It provides:

- User location reference with interactive flag tooltip
- Live weather-driven prompt preview (London default)
- Quick access to authentication, Studio, and Pro Promagen

---

## Version History

| Version | Date        | Changes                                                                                   |
| ------- | ----------- | ----------------------------------------------------------------------------------------- |
| 1.1.0   | 26 Jan 2026 | Layout symmetry with Engine Bay: header mb-4, content zone h-[84px], FitText label, responsive instruction text, xl:block breakpoint |
| 1.0.0   | 24 Jan 2026 | Initial implementation with weather tooltips, SVG flags, dynamic prompts                  |

---

## File Locations

| File                                                          | Purpose                  | Lines of Interest |
| ------------------------------------------------------------- | ------------------------ | ----------------- |
| `src/components/home/mission-control.tsx`                     | Main component           | Full file         |
| `src/components/layout/homepage-grid.tsx`                     | Layout integration       | Lines 274-294     |
| `src/components/exchanges/weather/weather-prompt-tooltip.tsx` | Shared tooltip component | Full file         |
| `docs/authority/mission-control.md`                           | This document            | —                 |

---

## Visual Layout (v1.1.0)

```
┌─────────────────────────────────────────────────────────────┐
│  ● MISSION CONTROL                                          │  ← Header (mb-4)
│  Smart Dynamic Automated Prompts                            │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │  🇬🇧 London Real Time Text Prompt             [📋]  │    │  ← Content zone
│  │                                                     │    │     h-[84px]
│  │  Hover over a countries flag for a real time        │    │     (matches Engine Bay
│  │  image prompt.                                      │    │      icon grid height)
│  └─────────────────────────────────────────────────────┘    │  ← (mb-4)
├─────────────────────────────────────────────────────────────┤
│  [ Studio ]    [ Pro ]    [ Sign in ]                       │  ← Action buttons (gap-3)
└─────────────────────────────────────────────────────────────┘
```

---

## Layout Symmetry with Engine Bay (v1.1.0)

Mission Control mirrors Engine Bay for perfect visual alignment:

### Vertical Spacing Pattern

| Element | Engine Bay | Mission Control | Class | Status |
|---------|------------|-----------------|-------|--------|
| Container padding | 16px | 16px | `p-4` | ✅ Match |
| Header margin-bottom | 16px | 16px | `mb-4` | ✅ Match |
| Middle section margin-bottom | 16px | 16px | `mb-4` | ✅ Match |
| Middle section height | 84px | 84px | `h-[84px]` | ✅ Match |
| Button row gap | 12px | 12px | `gap-3` | ✅ Match |
| Button padding | 12px 16px | 12px 16px | `px-4 py-3` | ✅ Match |

### Height Calculation (84px)

Engine Bay's icon grid: `ICON_CELL_SIZE` (64px) + label space (20px) = **84px**

Mission Control's content zone uses `h-[84px]` to match exactly.

---

## Component Props

```typescript
export interface MissionControlProps {
  /** All providers (unused but kept for API compatibility) */
  providers?: unknown[];
  /** All exchanges (to find LSE London for preview) */
  exchanges?: readonly Exchange[];
  /** Weather data indexed by exchange ID */
  weatherIndex?: Map<string, ExchangeWeatherData>;
  /** User's detected nearest exchange ID (optional) */
  nearestExchangeId?: string;
  /** Whether user is authenticated (optional) */
  isAuthenticated?: boolean;
}
```

---

## Data Flow

### Exchange Selection Priority

The component selects LSE London for the weather prompt preview:

1. **Primary:** London (LSE) — ID: `lse-london` or city containing "London"
2. **Fallback:** Uses hardcoded "London" / "Europe/London" / "gb" values

**File:** `src/components/home/mission-control.tsx`  
**Lines:** 240-280

```typescript
// Find LSE London exchange
const lseExchange = exchanges.find(
  (e) => e.id === 'lse-london' || e.city?.toLowerCase().includes('london')
);
```

### Prompt Generation

Uses `generateWeatherPrompt()` from weather-prompt-generator with:
- City name: "London" (from LSE exchange)
- Weather data from `weatherIndex.get('lse-london')`
- Local hour derived from exchange timezone
- Default prompt tier (Tier 4)

**File:** `src/components/home/mission-control.tsx`  
**Lines:** 282-320

---

## FitText Component (v1.1.0)

A responsive text component that auto-scales font size to fit container width.

**File:** `src/components/home/mission-control.tsx`  
**Lines:** 60-142

### How It Works

1. Renders text at max font size in a measurement span
2. Uses binary search to find largest font size that fits
3. Re-measures on container resize via ResizeObserver

### Props

```typescript
interface FitTextProps {
  children: React.ReactNode;
  min?: number;  // Minimum font size in pixels (default: 10)
  max?: number;  // Maximum font size in pixels (default: 24)
  className?: string;  // Additional CSS classes
}
```

### Usage in Content Zone Label

```tsx
<FitText min={11} max={16} className="font-semibold text-slate-400">
  {cityName} Real Time Text Prompt
</FitText>
```

---

## Content Zone Structure (v1.1.0)

**File:** `src/components/home/mission-control.tsx`  
**Lines:** 435-530

```tsx
{/* CONTENT ZONE — Height locked to 84px (matches Engine Bay icon grid height) */}
<div className="mb-4 flex h-[84px] flex-col rounded-xl border border-slate-700/50 bg-slate-900/50 p-3">
  
  {/* Row 1: Flag + Label + Copy Button */}
  <div className="mb-2 flex items-center justify-between gap-2">
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {/* Flag with WeatherPromptTooltip */}
      <WeatherPromptTooltip ...>
        <Image src="/flags/gb.svg" ... />
      </WeatherPromptTooltip>
      
      {/* Label: FitText for responsive sizing */}
      <FitText min={11} max={16} className="font-semibold text-slate-400">
        {cityName} Real Time Text Prompt
      </FitText>
    </div>
    
    {/* Copy button */}
    <button onClick={handleCopy} ... />
  </div>
  
  {/* Row 2: Instruction text (responsive Tailwind classes) */}
  <div className="flex-1 overflow-y-auto">
    <p className="text-xs italic text-slate-400 sm:text-sm xl:text-sm">
      Hover over a countries flag for a real time image prompt.
    </p>
  </div>
</div>
```

### Instruction Text Sizing

The instruction text uses responsive Tailwind classes (mobile-first):

| Breakpoint | Class | Size | Viewport |
|------------|-------|------|----------|
| Base | `text-xs` | 12px | 0-639px |
| sm: | `sm:text-sm` | 14px | 640-1279px |
| xl: | `xl:text-sm` | 14px | 1280px+ |

**To adjust:** Edit line 526 in mission-control.tsx:

```tsx
<p className="text-xs italic text-slate-400 sm:text-sm xl:text-sm">
```

| Screen | Smaller | Current | Bigger |
|--------|---------|---------|--------|
| Mobile | `text-[10px]` | `text-xs` | `text-sm` |
| Tablet (sm:) | `sm:text-xs` | `sm:text-sm` | `sm:text-base` |
| Desktop (xl:) | `xl:text-xs` | `xl:text-sm` | `xl:text-base` |

---

## Interactive Elements

### 1. Flag with Weather Tooltip

**Behaviour:**
- SVG flag image (`/flags/gb.svg`) in content zone header
- Hover reveals `WeatherPromptTooltip` with full weather prompt
- Tooltip opens to LEFT and DOWN (`tooltipPosition="right"`, `verticalPosition="below"`)
- Cursor: pointer (no question mark)

**File:** `src/components/home/mission-control.tsx`  
**Lines:** 442-468

```tsx
<WeatherPromptTooltip
  city={cityName}
  tz={timezone}
  weather={weatherData}
  tooltipPosition="right"    // Opens to LEFT of trigger
  verticalPosition="below"   // Opens BELOW trigger
>
  <Image
    src={`/flags/${countryCode.toLowerCase()}.svg`}
    className="shrink-0 cursor-pointer rounded-sm"
    ...
  />
</WeatherPromptTooltip>
```

---

### 2. Copy Button

**Behaviour:**
- Copies full prompt text to clipboard (actual prompt, not instruction text)
- Shows checkmark animation for 1.5 seconds after copy

**File:** `src/components/home/mission-control.tsx`  
**Lines:** 479-517

---

### 3. Action Buttons Row

Three buttons in a 3-column grid (`grid grid-cols-3 gap-3`):

| Button    | Link             | Icon                |
| --------- | ---------------- | ------------------- |
| Studio    | `/studio`        | Cursor/wand         |
| Pro       | `/pro-promagen`  | Sparkles            |
| Sign in   | Clerk modal      | User silhouette     |

**File:** `src/components/home/mission-control.tsx`  
**Lines:** 532-582

### Sign In Button States

Uses AuthButton-style state machine with 3 states:

| State | Condition | Behaviour |
|-------|-----------|-----------|
| `loading` | `!mounted \|\| (!clerk.loaded && !timedOut)` | Shows "Loading..." with disabled styling |
| `fallback` | `timedOut && !clerk.loaded` | Falls back to `/sign-in` link |
| `ready` | `clerk.loaded` | Renders Clerk SignInButton modal |

**Timeout:** 3 seconds (matches AuthButton pattern)

---

## Styling

### Container

Matches exchange rail styling for visual symmetry with Engine Bay:

```css
/* Tailwind classes */
rounded-3xl bg-slate-950/70 p-4 shadow-sm ring-1 ring-white/10
```

**File:** `src/components/home/mission-control.tsx`  
**Line:** 413

### Width Calculation

Uses same CSS calc formula as Engine Bay:

```tsx
style={{
  width: 'calc((100vw - 80px) * 0.225)',
}}
```

**File:** `src/components/layout/homepage-grid.tsx`  
**Lines:** 278-280

**Formula Breakdown:**
| Component | Value | Explanation |
|-----------|-------|-------------|
| Viewport | `100vw` | Full viewport width |
| Container padding | `32px` | `px-4` = 16px × 2 sides |
| Grid gaps | `48px` | `gap-6` = 24px × 2 gaps |
| **Subtracted** | `80px` | 32px + 48px |
| Rail fraction | `0.225` | 0.9fr ÷ 4.0fr total |

### Action Button Style

From `code-standard.md` §6.1:

```typescript
const actionButtonBase =
  'inline-flex w-full flex-col items-center justify-center gap-0.5 rounded-xl border px-4 py-3 text-center text-sm font-semibold shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/80';

const actionButtonActive =
  'border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-purple-100 hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400 cursor-pointer';
```

**File:** `src/components/home/mission-control.tsx`  
**Lines:** 178-182

---

## Responsive Behaviour (v1.1.0)

| Screen Size | Viewport   | Visibility | Notes                              |
| ----------- | ---------- | ---------- | ---------------------------------- |
| Desktop XL  | ≥1280px    | Visible    | Full panel in right header area    |
| Desktop     | 1024-1279px| Hidden     | Panel hidden to prevent overlap    |
| Tablet      | 768-1023px | Hidden     | Panel hidden                       |
| Mobile      | <768px     | Hidden     | Fallback nav shown instead         |

**File:** `src/components/layout/homepage-grid.tsx`  
**Line:** 278

**Note (v1.1.0):** Breakpoint changed from `md:block` (≥768px) to `xl:block` (≥1280px) to prevent panel overlap with the leaderboard at narrower viewport widths.

---

## Text Edit Reference

| Text                                        | Line  | Code                                                    |
| ------------------------------------------- | ----- | ------------------------------------------------------- |
| `"MISSION CONTROL"`                         | 424-425 | `<span>MISSION CONTROL</span>`                        |
| `"Smart Dynamic Automated Prompts"`         | 429   | Gradient text span                                      |
| `"{cityName} Real Time Text Prompt"`        | 474-476 | FitText component                                     |
| Instruction text                            | 526-528 | `<p className="text-xs...">Hover over a countries...` |
| `"Studio"`                                  | 554   | `<span>Studio</span>`                                   |
| `"Pro"`                                     | 577   | `<span>Pro</span>`                                      |
| `"Sign in"` / `"Loading..."`                | 371, 357 | Sign-in button states                                 |

---

## Testing Checklist (v1.1.0)

### Layout Symmetry

- [ ] Mission Control aligns vertically with Engine Bay
- [ ] Header sections align (both use mb-4)
- [ ] Content zones are same height (84px)
- [ ] Button rows align (both use gap-3, px-4 py-3)

### Visibility (v1.1.0 — xl breakpoint)

- [ ] Mission Control hidden below 1280px viewport width
- [ ] Mission Control visible at ≥1280px viewport width
- [ ] No overlap with leaderboard at any viewport size

### Visual

- [ ] Width matches exchange rail width exactly
- [ ] Green status dot pulses continuously
- [ ] SVG flag renders correctly (not emoji)

### Weather Tooltip

- [ ] Flag hover shows full weather tooltip
- [ ] Tooltip opens LEFT and DOWN (not overlapping panel)
- [ ] Tooltip shows same data as LSE London exchange card

### FitText Label

- [ ] Label text scales down on narrow containers
- [ ] Label text scales up on wide containers
- [ ] Font size stays within 11px-16px range

### Instruction Text

- [ ] Text is readable at all breakpoints
- [ ] Responsive sizing works (xs → sm → sm)

### Copy Button

- [ ] Copy button copies actual prompt (not instruction text)
- [ ] Checkmark animation shows after copy

### Action Buttons

- [ ] Studio links to `/studio`
- [ ] Pro links to `/pro-promagen`
- [ ] Sign in shows loading state, then Clerk modal
- [ ] Sign in falls back to `/sign-in` link after 3s timeout

---

## Related Documents

| Topic                      | Document                          |
| -------------------------- | --------------------------------- |
| Engine Bay (left panel)    | `ignition.md`                     |
| Homepage layout            | `ribbon-homepage.md`              |
| Weather prompt system      | `worldprompt-creative-engine.md`  |
| Prompt tiers               | `ai_providers.md` §4              |
| Button styling             | `code-standard.md` §6.1           |
| Auth patterns              | `clerk-auth.md`                   |

---

## Changelog

- **26 Jan 2026 (v1.1.0):** Layout symmetry with Engine Bay
  - Header margin changed from `mb-3` to `mb-4` (matches Engine Bay)
  - Content zone height locked to `h-[84px]` (matches Engine Bay icon grid)
  - Added FitText component for responsive label sizing (11px-16px)
  - Instruction text uses responsive Tailwind classes (`text-xs sm:text-sm xl:text-sm`)
  - Breakpoint changed from `md:block` to `xl:block` (≥1280px) to prevent overlap
  - Updated visual layout diagram
  
- **24 Jan 2026 (v1.0.0):** Initial implementation
  - Mirrors Engine Bay on right side for symmetry
  - Dynamic weather prompt preview (London default)
  - Interactive SVG flags with WeatherPromptTooltip
  - Action buttons: Sign in, Studio, Pro Promagen
  - Added `verticalPosition` prop to WeatherPromptTooltip for correct positioning

---

_This document is the authority for Mission Control. For Engine Bay, see `ignition.md`._

_**Key principle:** Always update docs FIRST before writing any code. Docs are the single source of truth._
