# Engine Bay (Ignition) Authority Document

**Last updated:** 5 March 2026  
**Version:** 5.0.0  
**Owner:** Promagen  
**Authority:** This document defines the Engine Bay component behaviour, design, animations, and edit locations.

---

## Purpose

Engine Bay is the primary CTA (Call-to-Action) for launching the Prompt Builder from the homepage. It provides quick access to top-ranked AI image generation platforms.

On the new homepage, Engine Bay also serves as the **shared provider selector** for Scene Starters (left rail). When a user selects a provider in Engine Bay, that selection flows down to Scene Starters so clicking a scene navigates to the correct provider's prompt builder.

---

## Version History

| Version | Date        | Changes                                                                                           |
| ------- | ----------- | ------------------------------------------------------------------------------------------------- |
| 5.0.0   | 5 Mar 2026  | **Controlled mode:** `selectedProvider` + `onProviderChange` optional props for homepage shared state. Engine Bay selection drives Scene Starters navigation. Provider persisted to localStorage via parent. |
| 4.2.0   | 28 Jan 2026 | **CRITICAL FIX:** Text/icon colour (`text-white`), animations moved to `<style jsx>` in component |
| 4.1.3   | 26 Jan 2026 | Breakpoint changed from md:block to xl:block (≥1280px) to prevent panel overlap                   |
| 4.1.2   | 24 Jan 2026 | Width uses CSS calc formula for precise rail alignment                                            |
| 4.1.1   | 24 Jan 2026 | TypeScript fixes for strict mode compliance                                                       |
| 4.1.0   | 24 Jan 2026 | Width matches exchange rails, responsive icon grid (full icons only), 2-line button               |
| 4.0.0   | 24 Jan 2026 | 10 icons (48×48px), gradient header, fixed dropdown/clear bugs                                    |
| 3.0.0   | 23 Jan 2026 | Initial implementation with icon grid                                                             |

---

## File Locations

| File                                      | Purpose                             | Lines |
| ----------------------------------------- | ----------------------------------- | ----- |
| `src/components/home/engine-bay.tsx`      | Main component + animations         | 499   |
| `src/components/layout/homepage-grid.tsx` | Layout integration + prop piping    | 721   |
| `src/components/home/new-homepage-client.tsx` | Homepage state owner (controlled mode) | 281 |
| `docs/authority/ignition.md`              | This document                       | —     |
| `docs/authority/buttons.md`               | Button styling authority            | §1 Colour Inheritance |

**Note (v4.2.0):** Animations are defined in `<style jsx>` within `engine-bay.tsx` (lines 446–498), NOT in `globals.css`.

---

## v5.0.0: Controlled Mode (Homepage Shared State)

### The Problem

Scene Starters (left rail) needs to know which provider the user selected in Engine Bay so it can navigate to `/providers/{id}` when a scene is clicked. Without this, scene clicks either break (navigate to `/providers/undefined`) or require a duplicate provider selector inside Scene Starters.

### The Solution — Controlled/Uncontrolled Pattern

Engine Bay now accepts two **optional** props:

```typescript
export interface EngineBayProps {
  providers: Provider[];
  /** Controlled mode: selected provider from parent */
  selectedProvider?: Provider | null;
  /** Controlled mode: callback when user selects/deselects */
  onProviderChange?: (provider: Provider | null) => void;
}
```

**Controlled mode (homepage only):** When `selectedProvider` is passed (even as `null`), Engine Bay delegates state to the parent. Clicks call `onProviderChange` instead of internal `setSelected`.

**Uncontrolled mode (all other pages):** When `selectedProvider` is `undefined` (not passed), Engine Bay manages its own internal state with `useState`. This is the default — zero behaviour change on provider pages, studio, pro-promagen, or any other page.

### State Flow (Homepage)

```
new-homepage-client.tsx
  │  useState<Provider | null>(null)
  │  handleProviderChange: saves to state + localStorage
  │  handleNudgeProvider: focuses Engine Bay dropdown input
  │
  ├──► HomepageGrid (pipes selectedProvider + onProviderChange)
  │      └──► EngineBay (controlled mode: reads/writes via parent)
  │
  └──► SceneStartersPreview (reads selectedProvider for navigation)
         └──► click scene → if no provider, calls onNudgeProvider
              → if provider selected, navigates to /providers/{id}
```

### Provider Persistence

The **parent** (`new-homepage-client.tsx`) handles localStorage — not Engine Bay:

- **Key:** `promagen:homepage-provider`
- **Write:** `handleProviderChange` saves `provider.id` to localStorage
- **Read:** `useEffect` on mount restores saved provider from localStorage
- **Clear:** deselecting a provider removes the key

Engine Bay itself never reads or writes localStorage. It only calls `onProviderChange`.

### Backward Compatibility

All other pages pass nothing for the new props → `selectedProvider` is `undefined` → `isControlled` is `false` → Engine Bay falls back to internal state. Zero behaviour change outside the homepage.

**File:** `src/components/home/engine-bay.tsx`, lines 159–173:

```typescript
const isControlled = controlledSelected !== undefined;
const selected = isControlled ? controlledSelected : internalSelected;
const setSelected = useCallback((provider: Provider | null) => {
  if (isControlled && onProviderChange) {
    onProviderChange(provider);
  } else {
    setInternalSelected(provider);
  }
}, [isControlled, onProviderChange]);
```

### Nudge Callback (Auto-Open Dropdown)

When a user clicks a scene with no provider selected, Scene Starters calls `onNudgeProvider` which:

1. Finds the Engine Bay dropdown input by its DOM `id` (`engine-bay-provider-select`)
2. Scrolls it into view
3. Focuses it (which opens the Combobox dropdown via `handleInputFocus`)

**File:** `src/components/home/new-homepage-client.tsx`, lines 171–178.

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
**Lines:** 400–420

| Element                 | Line | Required Class |
| ----------------------- | ---- | -------------- |
| "✦ Launch" row          | 407  | `text-white`   |
| "Platform Builder" text | 418  | `text-white`   |
| Arrow SVG               | 424  | `text-white`   |

---

## Text Edit Reference

All user-visible text in Engine Bay with exact file locations:

### engine-bay.tsx Text Locations

| Text                                       | Line    | Code                                                 |
| ------------------------------------------ | ------- | ---------------------------------------------------- |
| `"READY TO BUILD"`                         | 259     | `<span>READY TO BUILD</span>`                        |
| `"The Dynamic Intelligent Prompt Builder"` | 265-269 | Gradient heading                                     |
| `"Choose platform..."`                     | 358     | `placeholder="Choose platform..."`                   |
| `"Select AI Platform"`                     | 352     | `label="Select AI Platform"`                         |
| `"✦"` (sparkle icon)                       | 411     | `<span>✦</span>`                                     |
| `"Launch"`                                 | 412     | `<span>Launch</span>`                                |
| `"Platform Builder"`                       | 418     | `<span>Platform Builder</span>`                      |
| `"Select a platform first"`                | 374     | `aria-label={...}`                                   |

### Platform Short Name Mappings (Lines 119–127)

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

## Launch Button Implementation

**File:** `src/components/home/engine-bay.tsx`  
**Lines:** 366–442

### Button Structure

```tsx
<a
  href={selected ? `/providers/${encodeURIComponent(selected.id)}` : '#'}
  onClick={(e) => {
    if (!selected) e.preventDefault();
  }}
  aria-disabled={!selected}
  aria-label={selected ? `Launch ${selected.name} prompt builder` : 'Select a platform first'}
  className={`... ${
    selected
      ? 'engine-bay-active border-sky-400/60 ...'
      : 'border-slate-600/50 bg-slate-800/50 text-slate-500 cursor-not-allowed'
  }`}
>
```

**Navigation URL:** `/providers/${encodeURIComponent(selected.id)}` — the provider detail page which includes the prompt builder. **Never** `/providers/{id}/prompt-builder` (that route is a deprecated redirect).

### Button States

| State                      | Classes                                                                                                                              | Visual                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| Active (platform selected) | `engine-bay-active border-sky-400/60 bg-gradient-to-r from-sky-400/40 via-emerald-300/40 to-indigo-400/40 text-white cursor-pointer` | Pulsing glow, shimmer on hover |
| Inactive (no platform)     | `border-slate-600/50 bg-slate-800/50 text-slate-500 cursor-not-allowed`                                                              | Greyed out                     |

---

## Animations (v4.2.0) — Style JSX

**IMPORTANT:** Animations are defined in `<style jsx>` within the component, NOT in `globals.css`.

**File:** `src/components/home/engine-bay.tsx`  
**Lines:** 446–498

Three animations:

| Animation                 | Class                | Trigger                      |
| ------------------------- | -------------------- | ---------------------------- |
| Pulse glow                | `engine-bay-active`  | Platform selected (auto)     |
| Shimmer sweep             | `engine-bay-shimmer` | Hover when platform selected |
| Status dot pulse          | `animate-pulse`      | Always (Tailwind built-in)   |

All animations respect `prefers-reduced-motion: reduce`.

---

## Platform Brand Colors

**File:** `src/components/home/engine-bay.tsx`  
**Lines:** 57–100

```typescript
const PLATFORM_COLORS: Readonly<Record<string, string>> = {
  midjourney: '#7C3AED',
  flux: '#F97316',
  'google-imagen': '#4285F4',
  openai: '#10B981',
  leonardo: '#EC4899',
  'adobe-firefly': '#FF6B35',
  stability: '#8B5CF6',
  ideogram: '#06B6D4',
  // ... (42 total entries in file)
};
```

---

## Container Styling

**File:** `src/components/home/engine-bay.tsx`  
**Line:** 234

```tsx
className="relative w-full rounded-3xl bg-slate-950/70 shadow-sm ring-1 ring-white/10"
style={{ padding: 'clamp(10px, 1vw, 16px)' }}
```

---

## Width Calculation

Engine Bay sits inside the grid's left column (`0.9fr` of the three-column grid). Width is determined by the grid — no explicit `width` or `calc()` on the component. The grid's column definition in `homepage-grid.tsx`:

```
md:grid-cols-[minmax(0,0.9fr)_minmax(0,2.2fr)_minmax(0,0.9fr)]
```

---

## Layout Symmetry with Mission Control

Engine Bay and Mission Control are symmetrical panels. Both use `clamp()` padding and the grid controls their width.

---

## Common Mistakes to Avoid

### 1. Black Text/Icons on Launch Button

**Fix:** Add explicit `text-white` to all child `<span>` and `<svg>` elements.

### 2. Navigating to /providers/{id}/prompt-builder

**Fix:** Always navigate to `/providers/${id}`. The `/prompt-builder` sub-route is deprecated and causes redirect failures.

### 3. Default Provider Hardcoded

**Fix:** Engine Bay starts with `null`. The homepage parent may restore from localStorage on mount, but Engine Bay itself never sets a default.

### 4. Animation Not Playing

**Fix:** Ensure `<style jsx>` block is present at end of component (lines 446–498).

### 5. Controlled Mode Breaks Other Pages

**Fix:** Only pass `selectedProvider` + `onProviderChange` on the homepage. All other pages leave them `undefined` → Engine Bay falls back to internal state.

---

## Testing Checklist (v5.0.0)

### Text/Icon Colours (CRITICAL)

- [ ] Launch button text ("✦ Launch", "Platform Builder") is WHITE when active
- [ ] Arrow icon is WHITE when active
- [ ] Text is GREY (`text-slate-500`) when inactive

### Controlled Mode (Homepage)

- [ ] Select provider in Engine Bay → icon appears in Scene Starters header
- [ ] Click scene with provider selected → navigates to `/providers/{id}`
- [ ] Click scene with no provider → Engine Bay dropdown auto-opens
- [ ] Navigate away and back → provider restored from localStorage
- [ ] Deselect provider → Scene Starters header icon disappears
- [ ] Other pages (studio, provider detail, pro) → Engine Bay works independently (no controlled mode)

### Animations

- [ ] Pulse glow animation runs when platform selected
- [ ] Shimmer appears on hover when platform selected
- [ ] Status dot pulses continuously
- [ ] Icons scale on hover (5% increase)
- [ ] All animations disabled when `prefers-reduced-motion: reduce` enabled

### Visibility

- [ ] Engine Bay hidden below 1280px viewport width
- [ ] Engine Bay visible at ≥1280px viewport width

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

| What to Change         | File                     | Lines               |
| ---------------------- | ------------------------ | ------------------- |
| Header text            | `engine-bay.tsx`         | 259, 265–269        |
| Button text            | `engine-bay.tsx`         | 407–418             |
| Placeholder text       | `engine-bay.tsx`         | 358                 |
| Platform short names   | `engine-bay.tsx`         | 119–127             |
| Pulse animation        | `engine-bay.tsx`         | 446–460 (style jsx) |
| Shimmer animation      | `engine-bay.tsx`         | 462–480 (style jsx) |
| Status dot color       | `engine-bay.tsx`         | 249                 |
| Icon hover scale       | `engine-bay.tsx`         | 293                 |
| Controlled mode logic  | `engine-bay.tsx`         | 159–173             |
| Provider state owner   | `new-homepage-client.tsx`| 145–178             |
| Grid prop piping       | `homepage-grid.tsx`      | 217–219, 331–332, 501–502 |

---

## Related Documents

| Topic                         | Document                 |
| ----------------------------- | ------------------------ |
| Mission Control (right)       | `mission-control.md`     |
| Homepage layout               | `homepage.md`            |
| Button styling                | `buttons.md` (CRITICAL)  |
| Prompt Builder                | `prompt-builder-page.md` |
| Scene Starters (left rail)    | `homepage.md` §5         |
| Scene Starters data/UI        | `scene-starters.md`      |

---

## Changelog

- **5 March 2026 (v5.0.0):** **CONTROLLED MODE FOR HOMEPAGE**
  - Added `selectedProvider` + `onProviderChange` optional props (controlled/uncontrolled pattern)
  - Engine Bay selection now drives Scene Starters navigation on homepage
  - Provider persistence handled by parent (`new-homepage-client.tsx`) via `localStorage('promagen:homepage-provider')`
  - Nudge callback: Scene Starters can auto-open Engine Bay dropdown when no provider selected
  - `homepage-grid.tsx` pipes new props through to Engine Bay
  - Updated file locations (499 lines, was 430)
  - Updated line numbers for all text edit references
  - Added Common Mistake #2 (deprecated `/prompt-builder` route)
  - Added Common Mistake #3 (hardcoded default provider)
  - Added Common Mistake #5 (controlled mode on wrong pages)
  - Added Controlled Mode testing checklist (6 new checks)
  - Navigation URL documented: always `/providers/{id}`, never `/providers/{id}/prompt-builder`

- **28 Jan 2026 (v4.2.0):** **CRITICAL FIXES**
  - Added Section: Text & Icon Colour
  - All button children now have explicit `text-white`
  - Animations moved from `globals.css` to `<style jsx>` in component
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

_**Critical rule:** All `<a>` tag buttons MUST have explicit text colour on child elements. Animations are in `<style jsx>`, NOT globals.css. Navigation URL is `/providers/{id}`, never `/providers/{id}/prompt-builder`._
