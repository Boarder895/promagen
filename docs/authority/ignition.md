# Engine Bay (Ignition) Authority Document

**Last updated:** 28 January 2026  
**Version:** 4.2.0  
**Owner:** Promagen  
**Authority:** This document defines the Engine Bay component behaviour, design, animations, and edit locations.

---

## Purpose

Engine Bay is the primary CTA (Call-to-Action) for launching the Prompt Builder from the homepage. It provides quick access to top-ranked AI image generation platforms.

---

## Version History

| Version | Date        | Changes                                                                                           |
| ------- | ----------- | ------------------------------------------------------------------------------------------------- |
| 4.2.0   | 28 Jan 2026 | **CRITICAL FIX:** Text/icon colour (`text-white`), animations moved to `<style jsx>` in component |
| 4.1.3   | 26 Jan 2026 | Breakpoint changed from md:block to xl:block (≥1280px) to prevent panel overlap                   |
| 4.1.2   | 24 Jan 2026 | Width uses CSS calc formula for precise rail alignment                                            |
| 4.1.1   | 24 Jan 2026 | TypeScript fixes for strict mode compliance                                                       |
| 4.1.0   | 24 Jan 2026 | Width matches exchange rails, responsive icon grid (full icons only), 2-line button               |
| 4.0.0   | 24 Jan 2026 | 10 icons (48×48px), gradient header, fixed dropdown/clear bugs                                    |
| 3.0.0   | 23 Jan 2026 | Initial implementation with icon grid                                                             |

---

## File Locations

| File                                      | Purpose                     | Lines of Interest     |
| ----------------------------------------- | --------------------------- | --------------------- |
| `src/components/home/engine-bay.tsx`      | Main component + animations | Full file (430 lines) |
| `src/components/layout/homepage-grid.tsx` | Layout integration          | Lines 251-269         |
| `docs/authority/ignition.md`              | This document               | —                     |
| `docs/authority/buttons.md`               | Button styling authority    | §1 Colour Inheritance |

**Note (v4.2.0):** Animations are now defined in `<style jsx>` within `engine-bay.tsx` (lines 375-426), NOT in `globals.css`.

---

## CRITICAL: Text & Icon Colour (v4.2.0)

### The Problem

The Launch Platform Builder button uses an `<a>` tag. Due to CSS specificity:

- `body { color: #020617 }` (black)
- `a { color: inherit }`

Child elements inherit BLACK instead of the parent's `text-white` class.

### The Solution — MANDATORY

**All child elements MUST have explicit `text-white`:**

```tsx
// ❌ WRONG — Text and icon appear BLACK
<a className="... text-white">
  <span>✦ Launch</span>
  <span>Platform Builder</span>
  <svg>...</svg>
</a>

// ✅ CORRECT — Text and icon appear WHITE
<a className="... text-white">
  <span className="text-white">✦ Launch</span>
  <span className="text-white">Platform Builder</span>
  <svg className="text-white">...</svg>
</a>
```

### Affected Elements

**File:** `src/components/home/engine-bay.tsx`  
**Lines:** 348-370

| Element                 | Line | Required Class |
| ----------------------- | ---- | -------------- |
| "✦ Launch" row          | 349  | `text-white`   |
| "Platform Builder" text | 353  | `text-white`   |
| Arrow SVG               | 359  | `text-white`   |

---

## Text Edit Reference

All user-visible text in Engine Bay with exact file locations:

### engine-bay.tsx Text Locations

| Text                                       | Line    | Code                                                                                                    |
| ------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------- |
| `"READY TO BUILD"`                         | 232     | `<span className="font-mono text-base...">READY TO BUILD</span>`                                        |
| `"The Dynamic Intelligent Prompt Builder"` | 236-239 | `<span className="whitespace-nowrap bg-gradient-to-r...">The Dynamic Intelligent Prompt Builder</span>` |
| `"Choose platform..."`                     | 311     | `placeholder="Choose platform..."`                                                                      |
| `"Select AI Platform"`                     | 305     | `label="Select AI Platform"`                                                                            |
| `"✦"` (sparkle icon)                       | 350     | `<span>✦</span>`                                                                                        |
| `"Launch"`                                 | 351     | `<span>Launch</span>`                                                                                   |
| `"Platform Builder"`                       | 353     | `<span className="text-sm font-semibold text-white">Platform Builder</span>`                            |
| `"Select a platform first"`                | 327     | `aria-label={...}`                                                                                      |

### Platform Short Name Mappings (Lines 118-126)

```typescript
const nameMap: Readonly<Record<string, string>> = {
  'google-imagen': 'Imagen',
  'adobe-firefly': 'Firefly',
  openai: 'DALL·E',
  stability: 'Stable Diff',
  'microsoft-designer': 'Designer',
  'imagine-meta': 'Meta AI',
};
```

---

## Launch Button Implementation (v4.2.0)

**File:** `src/components/home/engine-bay.tsx`  
**Lines:** 319-372

### Button Structure

```tsx
<a
  href={selected ? `/providers/${encodeURIComponent(selected.id)}` : '#'}
  onClick={(e) => {
    if (!selected) e.preventDefault();
  }}
  aria-disabled={!selected}
  aria-label={selected ? `Launch ${selected.name} prompt builder` : 'Select a platform first'}
  className={`group relative inline-flex w-1/2 items-center justify-center gap-2 overflow-hidden rounded-xl border px-4 py-3 text-center text-sm font-medium shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/80 no-underline ${
    selected
      ? 'engine-bay-active border-sky-400/60 bg-gradient-to-r from-sky-400/40 via-emerald-300/40 to-indigo-400/40 text-white cursor-pointer'
      : 'border-slate-600/50 bg-slate-800/50 text-slate-500 cursor-not-allowed'
  }`}
>
  {/* Shimmer overlay */}
  {selected && (
    <div
      className="engine-bay-shimmer pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      aria-hidden="true"
    />
  )}

  {/* Button content - CRITICAL: explicit text-white on all children */}
  <div className="relative z-10 flex flex-col items-center gap-0.5">
    <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
      <span>✦</span>
      <span>Launch</span>
    </span>
    <span className="text-sm font-semibold text-white">Platform Builder</span>
  </div>

  {/* Arrow when selected - CRITICAL: explicit text-white */}
  {selected && (
    <svg
      className="relative z-10 h-4 w-4 shrink-0 text-white"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M14 5l7 7m0 0l-7 7m7-7H3"
      />
    </svg>
  )}
</a>
```

### Button States

| State                      | Classes                                                                                                                              | Visual                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| Active (platform selected) | `engine-bay-active border-sky-400/60 bg-gradient-to-r from-sky-400/40 via-emerald-300/40 to-indigo-400/40 text-white cursor-pointer` | Pulsing glow, shimmer on hover |
| Inactive (no platform)     | `border-slate-600/50 bg-slate-800/50 text-slate-500 cursor-not-allowed`                                                              | Greyed out                     |

---

## Animations (v4.2.0) — Style JSX

**IMPORTANT:** Animations are now defined in `<style jsx>` within the component, NOT in `globals.css`.

**File:** `src/components/home/engine-bay.tsx`  
**Lines:** 375-426

```tsx
{
  /* Animation keyframes - injected via style tag */
}
<style jsx>{`
  @keyframes engine-bay-pulse {
    0%,
    100% {
      box-shadow:
        0 0 20px rgba(56, 189, 248, 0.3),
        0 0 40px rgba(52, 211, 153, 0.2);
    }
    50% {
      box-shadow:
        0 0 30px rgba(56, 189, 248, 0.5),
        0 0 60px rgba(52, 211, 153, 0.4);
    }
  }

  @keyframes engine-bay-shimmer-sweep {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }

  .engine-bay-active {
    animation: engine-bay-pulse 2s ease-in-out infinite;
  }

  .engine-bay-shimmer {
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255, 255, 255, 0.3) 50%,
      transparent 100%
    );
    animation: engine-bay-shimmer-sweep 1.5s ease-in-out infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .engine-bay-active {
      animation: none;
      box-shadow:
        0 0 25px rgba(56, 189, 248, 0.4),
        0 0 50px rgba(52, 211, 153, 0.3);
    }
    .engine-bay-shimmer {
      animation: none;
      opacity: 0 !important;
    }
  }
`}</style>;
```

### Animation 1: Pulse Glow (`engine-bay-active`)

**Purpose:** Breathing glow effect on the active launch button when a platform is selected.

**Timing:** 2 seconds, ease-in-out, infinite loop

**Adjustable Parameters:**

| Parameter       | Current Value             | Effect                   |
| --------------- | ------------------------- | ------------------------ |
| Duration        | `2s`                      | Speed of breathing cycle |
| Easing          | `ease-in-out`             | Smoothness curve         |
| Min glow spread | `20px`, `40px`            | Glow size at rest        |
| Max glow spread | `30px`, `60px`            | Glow size at peak        |
| Min opacity     | `0.3`, `0.2`              | Glow intensity at rest   |
| Max opacity     | `0.5`, `0.4`              | Glow intensity at peak   |
| Sky color       | `rgba(56, 189, 248, ...)` | Primary glow color       |
| Emerald color   | `rgba(52, 211, 153, ...)` | Secondary glow color     |

### Animation 2: Shimmer Sweep (`engine-bay-shimmer`)

**Purpose:** Light sweep effect across button on hover (only when platform selected).

**Timing:** 1.5 seconds, ease-in-out, infinite loop

**Adjustable Parameters:**

| Parameter       | Current Value              | Effect                            |
| --------------- | -------------------------- | --------------------------------- |
| Duration        | `1.5s`                     | Speed of shimmer sweep            |
| Easing          | `ease-in-out`              | Smoothness curve                  |
| Direction       | `90deg`                    | Sweep angle (90° = left-to-right) |
| Shimmer opacity | `0.3`                      | Brightness of light sweep         |
| Shimmer color   | `rgba(255, 255, 255, ...)` | Color of light sweep              |

### Animation 3: Status Indicator Pulse (Tailwind)

**File:** `src/components/home/engine-bay.tsx`  
**Line:** 228

```tsx
<div
  className="h-3 w-3 animate-pulse rounded-full"
  style={{ backgroundColor: '#10B981' }} /* emerald-500 */
  aria-hidden="true"
/>
```

### Animation 4: Icon Hover Scale

**File:** `src/components/home/engine-bay.tsx`  
**Line:** 264

```tsx
className = '... transition-all duration-200 hover:scale-105 ...';
```

### Reduced Motion Support

When user has `prefers-reduced-motion: reduce` enabled:

- Pulse animation: disabled, static glow shown instead
- Shimmer animation: disabled, hidden

---

## Responsive Icon Grid

**File:** `src/components/home/engine-bay.tsx`  
**Lines:** 144-148 (calculation), 169-188 (ResizeObserver)

**Key rule:** Never show partial or clipped icons. Only full icons are displayed.

**Constants (Lines 47-51):**

```typescript
const TOP_ICONS_COUNT = 10;
const ICON_PATH_PATTERN = '/icons/providers/';
const DEFAULT_BRAND_COLOR = '#3B82F6';
const ICON_CELL_SIZE = 64;
const ICON_GAP = 8;
```

**Calculation (Lines 144-148):**

```typescript
function calculateVisibleIcons(containerWidth: number, maxIcons: number): number {
  if (containerWidth <= 0) return 0;
  const maxFit = Math.floor((containerWidth + ICON_GAP) / (ICON_CELL_SIZE + ICON_GAP));
  return Math.max(0, Math.min(maxFit, maxIcons));
}
```

**Responsive behaviour:**

| Screen Size | Viewport    | Panel Visible | Icons Shown |
| ----------- | ----------- | ------------- | ----------- |
| Desktop XL  | ≥1280px     | ✅ Yes        | Up to 10    |
| Desktop     | 1024-1279px | ❌ Hidden     | N/A         |
| Tablet      | 768-1023px  | ❌ Hidden     | N/A         |
| Mobile      | <768px      | ❌ Hidden     | N/A         |

---

## Platform Brand Colors

**File:** `src/components/home/engine-bay.tsx`  
**Lines:** 57-100

```typescript
const PLATFORM_COLORS: Readonly<Record<string, string>> = {
  midjourney: '#7C3AED', // violet-600
  flux: '#F97316', // orange-500
  'google-imagen': '#4285F4', // Google Blue
  openai: '#10B981', // emerald-500
  leonardo: '#EC4899', // pink-500
  'adobe-firefly': '#FF6B35', // Adobe Orange
  stability: '#8B5CF6', // violet-500
  ideogram: '#06B6D4', // cyan-500
  // ... (full list in file)
};
```

---

## Container Styling

**File:** `src/components/home/engine-bay.tsx`  
**Line:** 221

```tsx
className = 'flex flex-col rounded-3xl bg-slate-950/70 p-4 shadow-sm ring-1 ring-white/10';
```

Equivalent CSS:

```css
.engine-bay-container {
  border-radius: 1.5rem; /* rounded-3xl */
  background: rgba(2, 6, 23, 0.7); /* bg-slate-950/70 */
  padding: 1rem; /* p-4 */
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); /* shadow-sm */
  ring: 1px solid rgba(255, 255, 255, 0.1); /* ring-1 ring-white/10 */
}
```

---

## Width Calculation

Uses same CSS calc formula as Mission Control:

```tsx
style={{
  width: 'calc((100vw - 80px) * 0.225)',
}}
```

**Formula Breakdown:**

| Component         | Value   | Explanation             |
| ----------------- | ------- | ----------------------- |
| Viewport          | `100vw` | Full viewport width     |
| Container padding | `32px`  | `px-4` = 16px × 2 sides |
| Grid gaps         | `48px`  | `gap-6` = 24px × 2 gaps |
| **Subtracted**    | `80px`  | 32px + 48px             |
| Rail fraction     | `0.225` | 0.9fr ÷ 4.0fr total     |

---

## Layout Symmetry with Mission Control

Engine Bay and Mission Control are designed as symmetrical panels:

### Vertical Spacing Pattern

| Element                      | Engine Bay | Mission Control | Class       |
| ---------------------------- | ---------- | --------------- | ----------- |
| Container padding            | 16px       | 16px            | `p-4`       |
| Header margin-bottom         | 16px       | 16px            | `mb-4`      |
| Middle section margin-bottom | 16px       | 16px            | `mb-4`      |
| Middle section height        | 84px       | 84px            | `h-[84px]`  |
| Button row gap               | 12px       | 12px            | `gap-3`     |
| Button padding               | 12px 16px  | 12px 16px       | `px-4 py-3` |

### Icon Grid Height (84px)

The icon grid height is calculated as:

- `ICON_CELL_SIZE` (64px) + label space (20px) = **84px**

Mission Control's content zone uses `h-[84px]` to match exactly.

---

## Common Mistakes to Avoid

### 1. Black Text/Icons on Launch Button

**Symptom:** Launch button text and arrow appear black instead of white when platform selected.

**Cause:** Child elements inherit colour from body (`#020617`) instead of parent's `text-white`.

**Fix:** Add explicit `text-white` to all child `<span>` and `<svg>` elements.

### 2. Animation Not Playing

**Symptom:** No pulse glow or shimmer on hover.

**Cause:** Animation CSS missing from component.

**Fix:** Ensure `<style jsx>` block is present at end of component (lines 375-426).

### 3. Animation Was in globals.css

**Symptom:** Animation worked before, now doesn't.

**Cause:** Animations were moved from `globals.css` to `<style jsx>` in component.

**Fix:** Animations are now self-contained in `engine-bay.tsx`. Do NOT add to `globals.css`.

---

## Testing Checklist (v4.2.0)

### Text/Icon Colours (CRITICAL)

- [ ] Launch button text ("✦ Launch", "Platform Builder") is WHITE when active
- [ ] Arrow icon is WHITE when active
- [ ] Text is GREY (`text-slate-500`) when inactive

### Animations

- [ ] Pulse glow animation runs when platform selected
- [ ] Shimmer appears on hover when platform selected
- [ ] Status dot pulses continuously (green dot next to "READY TO BUILD")
- [ ] Icons scale on hover (5% increase)
- [ ] All animations disabled when `prefers-reduced-motion: reduce` enabled

### Visibility

- [ ] Engine Bay hidden below 1280px viewport width
- [ ] Engine Bay visible at ≥1280px viewport width
- [ ] No overlap with leaderboard at any viewport size

### Width Matching

- [ ] Engine Bay width visually aligns with exchange rail width
- [ ] Width scales proportionally on window resize

### Responsive Icon Grid

- [ ] Desktop XL (≥1280px): shows up to 10 icons
- [ ] No partial or clipped icons at any viewport size
- [ ] Icons centered when fewer than max are shown

### Interactions

- [ ] Dropdown selection works correctly
- [ ] × clear button deselects platform
- [ ] Icon click selects/deselects platform
- [ ] Platform selection syncs between icons and dropdown
- [ ] Launch button navigates to `/providers/{id}` when clicked

---

## Quick Edit Summary

| What to Change        | File                | Lines               |
| --------------------- | ------------------- | ------------------- |
| Header text           | `engine-bay.tsx`    | 232, 236-239        |
| Button text           | `engine-bay.tsx`    | 349-353             |
| Placeholder text      | `engine-bay.tsx`    | 311                 |
| Platform short names  | `engine-bay.tsx`    | 118-126             |
| Pulse animation       | `engine-bay.tsx`    | 377-389 (style jsx) |
| Shimmer animation     | `engine-bay.tsx`    | 391-412 (style jsx) |
| Status dot color      | `engine-bay.tsx`    | 229                 |
| Icon hover scale      | `engine-bay.tsx`    | 264                 |
| Engine Bay width      | `homepage-grid.tsx` | 256                 |
| Visibility breakpoint | `homepage-grid.tsx` | 255                 |
| Icon cell size        | `engine-bay.tsx`    | 50                  |
| Max icons shown       | `engine-bay.tsx`    | 47                  |

---

## Related Documents

| Topic                   | Document                 |
| ----------------------- | ------------------------ |
| Mission Control (right) | `mission-control.md`     |
| Homepage layout         | `ribbon-homepage.md`     |
| Button styling          | `buttons.md` (CRITICAL)  |
| Prompt Builder          | `prompt-builder-page.md` |

---

## Changelog

- **28 Jan 2026 (v4.2.0):** **CRITICAL FIXES**
  - Added Section: Text & Icon Colour
  - All button children now have explicit `text-white` (lines 349, 353, 359)
  - Animations moved from `globals.css` to `<style jsx>` in component (lines 375-426)
  - Updated line numbers to match current codebase (430 lines)
  - Added Common Mistakes to Avoid section
  - Added colour/animation testing checklist

- **26 Jan 2026 (v4.1.3):** Breakpoint changed from `md:block` to `xl:block` (≥1280px)

- **24 Jan 2026 (v4.1.2):** Width uses precise CSS calc formula

- **24 Jan 2026 (v4.1.1):** TypeScript fixes for strict mode

- **24 Jan 2026 (v4.1.0):** Width matches exchange rails, responsive icon grid, 2-line button

- **24 Jan 2026 (v4.0.0):** 10 icons at 48×48px, gradient header, fixed bugs

---

_This document is the authority for Engine Bay. For Mission Control, see `mission-control.md`._

_**Key principle:** Always update docs FIRST before writing any code. Docs are the single source of truth._

_**Critical rule:** All `<a>` tag buttons MUST have explicit text colour on child elements. Animations are in `<style jsx>`, NOT globals.css._
