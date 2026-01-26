# Engine Bay (Ignition) Authority Document

**Last updated:** 26 January 2026  
**Version:** 4.1.3  
**Owner:** Promagen  
**Authority:** This document defines the Engine Bay component behaviour, design, animations, and edit locations.

---

## Purpose

Engine Bay is the primary CTA (Call-to-Action) for launching the Prompt Builder from the homepage. It provides quick access to top-ranked AI image generation platforms.

---

## Version History

| Version | Date        | Changes                                                                             |
| ------- | ----------- | ----------------------------------------------------------------------------------- |
| 4.1.3   | 26 Jan 2026 | Breakpoint changed from md:block to xl:block (≥1280px) to prevent panel overlap     |
| 4.1.2   | 24 Jan 2026 | Width uses CSS calc formula for precise rail alignment                              |
| 4.1.1   | 24 Jan 2026 | TypeScript fixes for strict mode compliance                                         |
| 4.1.0   | 24 Jan 2026 | Width matches exchange rails, responsive icon grid (full icons only), 2-line button |
| 4.0.0   | 24 Jan 2026 | 10 icons (48×48px), gradient header, fixed dropdown/clear bugs                      |
| 3.0.0   | 23 Jan 2026 | Initial implementation with icon grid                                               |

---

## File Locations

| File                                      | Purpose            | Lines of Interest |
| ----------------------------------------- | ------------------ | ----------------- |
| `src/components/home/engine-bay.tsx`      | Main component     | Full file         |
| `src/components/layout/homepage-grid.tsx` | Layout integration | Lines 251-259     |
| `src/app/globals.css`                     | CSS animations     | Lines 1812-1889   |
| `docs/authority/ignition.md`              | This document      | —                 |

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
| `"Platform Builder"`                       | 353     | `<span className="text-sm font-semibold">Platform Builder</span>`                                       |
| `"Select a platform first"`                | 327     | `aria-label={selected ? \`Launch ${selected.name}...\` : 'Select a platform first'}`                    |

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

**To edit:** Modify `engine-bay.tsx` lines 118-126 to change how platform names display under icons.

---

## Animations Reference

### Animation 1: Pulse Glow (`engine-bay-active`)

**File:** `src/app/globals.css`  
**Lines:** 1812-1829

**Purpose:** Breathing glow effect on the active launch button when a platform is selected.

**Timing:** 2 seconds, ease-in-out, infinite loop

**Implementation:**

```css
/* Line 1813-1815 */
.engine-bay-active {
  animation: engine-bay-pulse 2s ease-in-out infinite;
}

/* Line 1817-1829 */
@keyframes engine-bay-pulse {
  0%,
  100% {
    box-shadow:
      0 0 20px rgba(56, 189, 248, 0.3),
      /* sky-400 @ 30% */ 0 0 40px rgba(52, 211, 153, 0.2); /* emerald-400 @ 20% */
  }
  50% {
    box-shadow:
      0 0 30px rgba(56, 189, 248, 0.5),
      /* sky-400 @ 50% */ 0 0 60px rgba(52, 211, 153, 0.4); /* emerald-400 @ 40% */
  }
}
```

**Adjustable Parameters:**
| Parameter | Location | Current Value | Effect |
|-----------|----------|---------------|--------|
| Duration | Line 1814 | `2s` | Speed of breathing cycle |
| Easing | Line 1814 | `ease-in-out` | Smoothness curve |
| Min glow spread | Line 1821 | `20px`, `40px` | Glow size at rest |
| Max glow spread | Line 1826 | `30px`, `60px` | Glow size at peak |
| Min opacity | Lines 1821-1822 | `0.3`, `0.2` | Glow intensity at rest |
| Max opacity | Lines 1826-1827 | `0.5`, `0.4` | Glow intensity at peak |
| Sky color | Lines 1821, 1826 | `rgba(56, 189, 248, ...)` | Primary glow color |
| Emerald color | Lines 1822, 1827 | `rgba(52, 211, 153, ...)` | Secondary glow color |

---

### Animation 2: Shimmer Sweep (`engine-bay-shimmer`)

**File:** `src/app/globals.css`  
**Lines:** 1831-1849

**Purpose:** Light sweep effect across button on hover (only when platform selected).

**Timing:** 1.5 seconds, ease-in-out, infinite loop

**Implementation:**

```css
/* Line 1832-1840 */
.engine-bay-shimmer {
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.3) 50%,
    transparent 100%
  );
  animation: engine-bay-shimmer 1.5s ease-in-out infinite;
}

/* Line 1842-1849 */
@keyframes engine-bay-shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}
```

**Adjustable Parameters:**
| Parameter | Location | Current Value | Effect |
|-----------|----------|---------------|--------|
| Duration | Line 1839 | `1.5s` | Speed of shimmer sweep |
| Easing | Line 1839 | `ease-in-out` | Smoothness curve |
| Direction | Line 1834 | `90deg` | Sweep angle (90° = left-to-right) |
| Shimmer opacity | Line 1836 | `0.3` | Brightness of light sweep |
| Shimmer color | Line 1836 | `rgba(255, 255, 255, ...)` | Color of light sweep |

---

### Animation 3: Status Indicator Pulse (Tailwind)

**File:** `src/components/home/engine-bay.tsx`  
**Line:** 228

**Purpose:** Green dot pulsing to indicate "READY TO BUILD" status.

**Implementation:**

```tsx
<div
  className="h-3 w-3 animate-pulse rounded-full"
  style={{ backgroundColor: '#10B981' }} /* emerald-500 */
  aria-hidden="true"
/>
```

**Adjustable Parameters:**
| Parameter | Location | Current Value | Effect |
|-----------|----------|---------------|--------|
| Size | Line 228 | `h-3 w-3` | Dot diameter (12px) |
| Color | Line 229 | `#10B981` | Emerald-500 green |
| Animation | Line 228 | `animate-pulse` | Tailwind 2s pulse |

---

### Animation 4: Icon Hover Scale

**File:** `src/components/home/engine-bay.tsx`  
**Line:** 264

**Purpose:** Subtle scale-up on platform icon hover.

**Implementation:**

```tsx
className = '... transition-all duration-200 hover:scale-105 ...';
```

**Adjustable Parameters:**
| Parameter | Location | Current Value | Effect |
|-----------|----------|---------------|--------|
| Scale | Line 264 | `hover:scale-105` | 5% size increase |
| Duration | Line 264 | `duration-200` | 200ms transition |

---

### Reduced Motion Support

**File:** `src/app/globals.css`  
**Lines:** 1876-1888

When user has `prefers-reduced-motion: reduce` enabled:

```css
/* Line 1877-1882 */
.engine-bay-active {
  animation: none;
  box-shadow:
    0 0 25px rgba(56, 189, 248, 0.4),
    0 0 50px rgba(52, 211, 153, 0.3);
}

/* Line 1884-1887 */
.engine-bay-shimmer {
  animation: none;
  opacity: 0 !important;
}
```

---

## Width Calculation (v4.1.2)

Engine Bay width matches the exchange rail width using CSS calc:

**File:** `src/components/layout/homepage-grid.tsx`  
**Lines:** 251-259

```tsx
{
  showEngineBay && providers.length > 0 && (
    <div
      className="absolute left-4 top-4 z-20 hidden xl:block"
      style={{
        width: 'calc((100vw - 80px) * 0.225)',
      }}
    >
      <EngineBay providers={providers} />
    </div>
  );
}
```

**Formula Breakdown:**
| Component | Value | Explanation |
|-----------|-------|-------------|
| Viewport | `100vw` | Full viewport width |
| Container padding | `32px` | `px-4` = 16px × 2 sides |
| Grid gaps | `48px` | `gap-6` = 24px × 2 gaps |
| **Subtracted** | `80px` | 32px + 48px |
| Rail fraction | `0.225` | 0.9fr ÷ 4.0fr total |

---

## Container Styling

Engine Bay matches exchange rail styling:

```css
/* Tailwind classes on container div */
.engine-bay-container {
  border-radius: 1.5rem; /* rounded-3xl */
  background: rgba(2, 6, 23, 0.7); /* bg-slate-950/70 */
  padding: 1rem; /* p-4 */
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); /* shadow-sm */
  ring: 1px solid rgba(255, 255, 255, 0.1); /* ring-1 ring-white/10 */
}
```

**File:** `src/components/home/engine-bay.tsx`  
**Line:** 221

---

## Responsive Icon Grid

**File:** `src/components/home/engine-bay.tsx`  
**Lines:** 144-148 (calculation), 169-188 (ResizeObserver)

**Key rule:** Never show partial or clipped icons. Only full icons are displayed.

**Constants (Lines 47-50):**

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

**Responsive behaviour (v4.1.3):**

| Screen Size | Viewport   | Panel Visible | Icons Shown |
| ----------- | ---------- | ------------- | ----------- |
| Desktop XL  | ≥1280px    | ✅ Yes        | Up to 10    |
| Desktop     | 1024-1279px| ❌ Hidden     | N/A         |
| Tablet      | 768-1023px | ❌ Hidden     | N/A         |
| Mobile      | <768px     | ❌ Hidden     | N/A         |

**Note (v4.1.3):** Breakpoint changed from `md:block` (≥768px) to `xl:block` (≥1280px) to prevent panel overlap with the leaderboard at narrower viewport widths.

---

## Launch Button States

**File:** `src/components/home/engine-bay.tsx`  
**Lines:** 319-372

### Inactive State (no platform selected)

```
border-slate-600/50 bg-slate-800/50 text-slate-500 cursor-not-allowed
```

### Active State (platform selected)

```
engine-bay-active border-sky-400/60 bg-gradient-to-r from-sky-400/40 via-emerald-300/40 to-indigo-400/40 text-white cursor-pointer
```

**Button Layout (2-Line - Option B):**

```
┌─────────────────────────────────────┐
│  ✦ Launch                           │
│  Platform Builder                →  │
└─────────────────────────────────────┘
```

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

**To add a new platform color:** Add entry to this object on line 57-100.

---

## Layout Symmetry with Mission Control

Engine Bay and Mission Control are designed as symmetrical panels with matching spacing:

### Vertical Spacing Pattern

| Element | Engine Bay | Mission Control | Class |
|---------|------------|-----------------|-------|
| Container padding | 16px | 16px | `p-4` |
| Header margin-bottom | 16px | 16px | `mb-4` |
| Middle section margin-bottom | 16px | 16px | `mb-4` |
| Middle section height | 84px | 84px | `h-[84px]` |
| Button row gap | 12px | 12px | `gap-3` |
| Button padding | 12px 16px | 12px 16px | `px-4 py-3` |

### Icon Grid Height (84px)

The icon grid height is calculated as:
- `ICON_CELL_SIZE` (64px) + label space (20px) = **84px**

Mission Control's content zone uses `h-[84px]` to match exactly.

---

## Testing Checklist (v4.1.3)

### Visibility (v4.1.3 — xl breakpoint)

- [ ] Engine Bay hidden below 1280px viewport width
- [ ] Engine Bay visible at ≥1280px viewport width
- [ ] No overlap with leaderboard at any viewport size

### Width Matching

- [ ] Engine Bay width visually aligns with exchange rail width
- [ ] Width scales proportionally on window resize
- [ ] CSS calc formula produces correct width

### Responsive Icon Grid

- [ ] Desktop XL (≥1280px): shows up to 10 icons
- [ ] No partial or clipped icons at any viewport size
- [ ] Icons centered when fewer than max are shown

### Animations

- [ ] Pulse animation runs when platform selected
- [ ] Shimmer appears on hover when platform selected
- [ ] Status dot pulses continuously
- [ ] Icons scale on hover
- [ ] All animations disabled when `prefers-reduced-motion: reduce`

### Interactions

- [ ] Dropdown selection works correctly
- [ ] × clear button deselects platform
- [ ] Icon click selects/deselects platform
- [ ] Platform selection syncs between icons and dropdown
- [ ] Launch button navigates to `/providers/{id}` when clicked

---

## Quick Edit Summary

| What to Change        | File                | Lines        |
| --------------------- | ------------------- | ------------ |
| Header text           | `engine-bay.tsx`    | 232, 236-239 |
| Button text           | `engine-bay.tsx`    | 350-353      |
| Placeholder text      | `engine-bay.tsx`    | 311          |
| Platform short names  | `engine-bay.tsx`    | 118-126      |
| Pulse animation speed | `globals.css`       | 1814         |
| Pulse glow colors     | `globals.css`       | 1821-1827    |
| Shimmer speed         | `globals.css`       | 1839         |
| Shimmer brightness    | `globals.css`       | 1836         |
| Status dot color      | `engine-bay.tsx`    | 229          |
| Icon hover scale      | `engine-bay.tsx`    | 264          |
| Engine Bay width      | `homepage-grid.tsx` | 256          |
| Visibility breakpoint | `homepage-grid.tsx` | 255          |
| Icon cell size        | `engine-bay.tsx`    | 49           |
| Max icons shown       | `engine-bay.tsx`    | 46           |

---

## Related Components

### Mission Control (Right Panel)

Engine Bay has a symmetrical counterpart on the right side of the homepage:

| Component       | Position | Purpose                          | Authority Document       |
| --------------- | -------- | -------------------------------- | ------------------------ |
| Engine Bay      | Left     | Launch Prompt Builder            | `ignition.md` (this doc) |
| Mission Control | Right    | Location, preview, quick actions | `mission-control.md`     |

Both panels:

- Use identical width formula: `calc((100vw - 80px) * 0.225)`
- Match exchange rail styling (rounded-3xl, bg-slate-950/70, ring-1)
- Hidden below xl breakpoint (< 1280px) — **changed v4.1.3**
- Positioned in the hero section above the exchange rails
- Have identical vertical spacing (mb-4 for header, mb-4 for middle section)
- Middle sections are 84px tall for visual symmetry

**File:** `src/components/layout/homepage-grid.tsx`

- Engine Bay: Lines 251-269
- Mission Control: Lines 274-294

---

## Changelog

- **26 Jan 2026 (v4.1.3):** Breakpoint changed from `md:block` to `xl:block` (≥1280px) to prevent panel overlap with leaderboard at narrower viewports. Added layout symmetry documentation with Mission Control.
- **24 Jan 2026 (v4.1.2):** Width uses precise CSS calc formula `calc((100vw - 80px) * 0.225)`. Added comprehensive animation and text edit reference.
- **24 Jan 2026 (v4.1.1):** TypeScript fixes for strict mode (array access, Map.get).
- **24 Jan 2026 (v4.1.0):** Width matches exchange rails, responsive icon grid with ResizeObserver, 2-line button (Option B), container uses exchange rail styling.
- **24 Jan 2026 (v4.0.0):** 10 icons at 48×48px, gradient header, fixed dropdown selection bug, fixed × clear button bug.

---

_This document is the authority for Engine Bay. For Mission Control, see `mission-control.md`._

_**Key principle:** Always update docs FIRST before writing any code. Docs are the single source of truth._
