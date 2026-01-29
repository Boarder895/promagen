# Mission Control Authority Document

**Last updated:** 28 January 2026  
**Version:** 2.0.0  
**Owner:** Promagen  
**Authority:** This document defines the Mission Control component behaviour, design, and edit locations.

---

## Purpose

Mission Control is the right-side CTA panel on the homepage, Studio page, and provider pages, mirroring Engine Bay on the left for visual symmetry. It provides:

- User location reference with interactive tooltip
- Live weather-driven prompt preview (London default)
- Quick access to authentication, Studio/Home, and Pro Promagen
- Context-aware navigation (Studio↔Home button swap)
- 4-button layout for provider pages (Home | Studio | Pro | Sign in)

---

## Version History

| Version | Date        | Changes                                                                                                                                             |
| ------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.0.0   | 28 Jan 2026 | **CRITICAL FIX:** Text/icon colour inheritance. Added `isStudioSubPage` prop for 4-button layout. Animations now in `<style jsx>` within component. |
| 1.1.0   | 26 Jan 2026 | Added `isStudioPage` prop for context-aware Studio↔Home button swap                                                                                 |
| 1.0.0   | 24 Jan 2026 | Initial implementation with weather tooltips, SVG flags, dynamic prompts                                                                            |

---

## File Locations

| File                                                          | Purpose                  | Lines of Interest     |
| ------------------------------------------------------------- | ------------------------ | --------------------- |
| `src/components/home/mission-control.tsx`                     | Main component           | Full file (697 lines) |
| `src/components/layout/homepage-grid.tsx`                     | Layout integration       | Lines 285-305         |
| `src/components/exchanges/weather/weather-prompt-tooltip.tsx` | Shared tooltip component | Full file             |
| `docs/authority/mission-control.md`                           | This document            | —                     |
| `docs/authority/buttons.md`                                   | Button styling authority | §1 Colour Inheritance |

---

## CRITICAL: Text & Icon Colour Inheritance (v2.0.0)

### The Problem

Promagen's `globals.css` has:

```css
body {
  color: #020617; /* slate-950 — BLACK */
}

a {
  color: inherit;
}
```

This causes `<a>` tag buttons to have **BLACK text/icons** because children inherit from body, not from the parent's Tailwind colour class.

### The Solution — MANDATORY

**All Mission Control buttons using `<a>` tags MUST have explicit `text-purple-100` on child `<svg>` and `<span>` elements:**

```tsx
// ❌ WRONG — Text and icon appear BLACK
<a className="... text-purple-100">
  <svg className="h-5 w-5">...</svg>
  <span>Home</span>
</a>

// ✅ CORRECT — Text and icon appear purple
<a className="... text-purple-100">
  <svg className="h-5 w-5 text-purple-100">...</svg>
  <span className="text-purple-100">Home</span>
</a>
```

### Affected Buttons

| Button                     | Element  | Required Class    |
| -------------------------- | -------- | ----------------- |
| Home                       | `<svg>`  | `text-purple-100` |
| Home                       | `<span>` | `text-purple-100` |
| Studio                     | `<svg>`  | `text-purple-100` |
| Studio                     | `<span>` | `text-purple-100` |
| Pro                        | `<svg>`  | `text-purple-100` |
| Pro                        | `<span>` | `text-purple-100` |
| Sign in (timeout fallback) | `<svg>`  | `text-purple-100` |
| Sign in (timeout fallback) | `<span>` | `text-purple-100` |
| Sign in (ready state)      | `<svg>`  | `text-purple-100` |
| Sign in (ready state)      | `<span>` | `text-purple-100` |

**File:** `src/components/home/mission-control.tsx`  
**Lines:** 453-513 (button render functions)

---

## Visual Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  ● MISSION CONTROL                                              │  ← Header row
│  Smart Dynamic Automated Prompts                                │  ← Gradient title
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  🇬🇧 London Real Time Text Prompt              [▼]  │    │  ← Content zone (84px)
│  │  Select a platform...                              │    │
│  └─────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│  3-button: [🏠 Home/✨ Studio]  [⭐ Pro/🏠 Home]  [👤 Sign in]  │  ← Action buttons
│  4-button: [🏠 Home] [✨ Studio] [⭐ Pro] [👤 Sign in]          │  ← isStudioSubPage
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Props

```typescript
export interface MissionControlProps {
  /** All exchanges (to find nearest for preview) */
  exchanges?: ReadonlyArray<Exchange>;
  /** Weather data indexed by exchange ID */
  weatherIndex?: Map<string, ExchangeWeatherData>;
  /** User's detected nearest exchange ID (optional) */
  nearestExchangeId?: string;
  /** Whether component is rendered on Studio page (swaps Studio↔Home in first slot) */
  isStudioPage?: boolean;
  /** Whether component is rendered on Pro Promagen page (swaps Pro↔Home in second slot) */
  isProPromagenPage?: boolean;
  /** Whether component is on a Studio sub-page (4-button layout: Home|Studio|Pro|Sign in) */
  isStudioSubPage?: boolean;
}
```

### Props Explained

| Prop                | Type      | Default | Effect                                   |
| ------------------- | --------- | ------- | ---------------------------------------- |
| `isStudioPage`      | `boolean` | `false` | First button: Studio → Home              |
| `isProPromagenPage` | `boolean` | `false` | Second button: Pro → Home                |
| `isStudioSubPage`   | `boolean` | `false` | 4-button layout with all buttons visible |

### Button Layout Logic

**3-button layout (default):**

```
[First Button] [Second Button] [Sign in]
```

| Page                           | First Button       | Second Button         |
| ------------------------------ | ------------------ | --------------------- |
| Homepage (`/`)                 | Studio → `/studio` | Pro → `/pro-promagen` |
| Studio (`/studio`)             | Home → `/`         | Pro → `/pro-promagen` |
| Pro Promagen (`/pro-promagen`) | Studio → `/studio` | Home → `/`            |

**4-button layout (`isStudioSubPage=true`):**

```
[Home] [Studio] [Pro] [Sign in]
```

Used on: Provider pages (`/providers/[id]`), Studio sub-pages

---

## Button Styles (v2.0.0)

**File:** `src/components/home/mission-control.tsx`  
**Lines:** 203-210

```tsx
const actionButtonBase =
  'inline-flex w-full flex-col items-center justify-center gap-0.5 rounded-xl border px-4 py-3 text-center text-sm font-semibold shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/80';

const actionButtonActive =
  'border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-purple-100 hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400 cursor-pointer';

const actionButtonLoading =
  'border-slate-600/50 bg-slate-800/30 text-slate-400 cursor-wait opacity-70';
```

### Style Breakdown

| Property   | Value                                                     | Purpose                           |
| ---------- | --------------------------------------------------------- | --------------------------------- |
| Layout     | `inline-flex w-full flex-col items-center justify-center` | Vertical, centered, full width    |
| Shape      | `rounded-xl`                                              | Rounded corners                   |
| Gap        | `gap-0.5`                                                 | Minimal gap between icon and text |
| Padding    | `px-4 py-3`                                               | 16px horizontal, 12px vertical    |
| Font       | `text-sm font-semibold`                                   | 14px, semibold weight             |
| Border     | `border-purple-500/70`                                    | Purple outline (70% opacity)      |
| Background | `bg-gradient-to-r from-purple-600/20 to-pink-600/20`      | Purple→pink gradient              |
| Text       | `text-purple-100`                                         | Light purple (parent only!)       |

---

## Button Implementations (v2.0.0)

### Home Button

**File:** `src/components/home/mission-control.tsx`  
**Lines:** 453-466

```tsx
const renderHomeButton = () => (
  <a href="/" className={`${actionButtonBase} ${actionButtonActive}`} aria-label="Go to Homepage">
    <svg
      className="h-5 w-5 text-purple-100" // ← CRITICAL: explicit colour
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={homeIconPath} />
    </svg>
    <span className="text-purple-100">Home</span> {/* ← CRITICAL: explicit colour */}
  </a>
);
```

### Studio Button

**File:** `src/components/home/mission-control.tsx`  
**Lines:** 471-491

```tsx
const renderStudioButton = () => (
  <a
    href="/studio"
    className={`${actionButtonBase} ${actionButtonActive}`}
    aria-label="Open Prompt Studio"
  >
    <svg
      className="h-5 w-5 text-purple-100" // ← CRITICAL: explicit colour
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={studioIconPath} />
    </svg>
    <span className="text-purple-100">Studio</span> {/* ← CRITICAL: explicit colour */}
  </a>
);
```

### Pro Button

**File:** `src/components/home/mission-control.tsx`  
**Lines:** 496-513

```tsx
const renderProButton = () => (
  <a
    href="/pro-promagen"
    className={`${actionButtonBase} ${actionButtonActive}`}
    aria-label="View Pro Promagen features"
  >
    <svg
      className="h-5 w-5 text-purple-100" // ← CRITICAL: explicit colour
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={proIconPath} />
    </svg>
    <span className="text-purple-100">Pro</span> {/* ← CRITICAL: explicit colour */}
  </a>
);
```

### Sign In Button

**File:** `src/components/home/mission-control.tsx`  
**Lines:** 365-448

Has three states:

1. **Loading:** Shows "Loading..." with loading styles
2. **Timeout (fallback):** Uses `<a href="/sign-in">` with explicit colours
3. **Ready:** Uses `<SignInButton>` wrapper with `<button>` inside

```tsx
// Ready state (Clerk loaded)
<SignInButton mode="modal">
  <button
    type="button"
    className={`${actionButtonBase} ${actionButtonActive}`}
    aria-label="Sign in to your account"
  >
    <svg
      className="h-5 w-5 text-purple-100" // ← CRITICAL: explicit colour
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={userIconPath} />
    </svg>
    <span className="text-purple-100">Sign in</span> {/* ← CRITICAL: explicit colour */}
  </button>
</SignInButton>
```

---

## Icon Paths

**File:** `src/components/home/mission-control.tsx`  
**Lines:** 213-226

```tsx
const userIconPath =
  'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z';

const homeIconPath =
  'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25';

const studioIconPath =
  'M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59';

const proIconPath =
  'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z';
```

---

## Grid Layout

**File:** `src/components/home/mission-control.tsx`  
**Lines:** 544, 670-693

```tsx
// Determine grid columns based on context
const gridCols = isStudioSubPage ? 'grid-cols-4' : 'grid-cols-3';

// Render grid
<div className={`grid ${gridCols} gap-3`}>
  {isStudioSubPage ? (
    // 4-button layout: Home | Studio | Pro | Sign in
    <>
      {renderHomeButton()}
      {renderStudioButton()}
      {renderProButton()}
      {renderSignInButton()}
    </>
  ) : (
    // 3-button layout: First | Second | Sign in
    <>
      {renderFirstButton()}
      {renderSecondButton()}
      {renderSignInButton()}
    </>
  )}
</div>;
```

---

## Content Zone

**File:** `src/components/home/mission-control.tsx`  
**Lines:** 573-668

Height locked to `84px` to match Engine Bay icon grid height.

```tsx
<div
  ref={contentZoneRef}
  className="mb-4 flex h-[84px] flex-col rounded-xl border border-slate-700/50 bg-slate-900/50 p-3"
>
  {/* Flag with WeatherPromptTooltip */}
  {/* Platform selector dropdown */}
  {/* Description text */}
</div>
```

---

## Responsive Behaviour

| Screen Size | Viewport    | Visibility | Notes                           |
| ----------- | ----------- | ---------- | ------------------------------- |
| Desktop XL  | ≥1280px     | Visible    | Full panel in right header area |
| Desktop     | 1024-1279px | Hidden     | Panel hidden to prevent overlap |
| Tablet      | 768-1023px  | Hidden     | Panel hidden                    |
| Mobile      | <768px      | Hidden     | Fallback nav shown instead      |

**Breakpoint:** `xl:block` (≥1280px)

---

## Common Mistakes to Avoid

### 1. Black Text/Icons on Buttons

**Symptom:** Button text and icons appear black instead of purple.

**Cause:** Child elements (`<svg>`, `<span>`) inherit colour from body (`#020617`) instead of parent's `text-purple-100`.

**Fix:** Add explicit `text-purple-100` to all child `<svg>` and `<span>` elements inside `<a>` tags.

### 2. Missing Colours on Timeout Fallback

**Symptom:** Sign in button looks correct initially, but after 3-second timeout shows black text.

**Cause:** Timeout fallback uses `<a href="/sign-in">` which has same inheritance issue.

**Fix:** Ensure timeout fallback also has explicit colours on children.

### 3. Button Layout Wrong

**Symptom:** 4 buttons appear when 3 expected, or vice versa.

**Cause:** Wrong prop passed to component.

**Fix:** Check `isStudioSubPage` prop is correct for the page context.

---

## Testing Checklist (v2.0.0)

### Text/Icon Colours (CRITICAL)

- [ ] Home button: text and icon are purple-100 (NOT black)
- [ ] Studio button: text and icon are purple-100 (NOT black)
- [ ] Pro button: text and icon are purple-100 (NOT black)
- [ ] Sign in button: text and icon are purple-100 (NOT black)
- [ ] Sign in timeout fallback: text and icon are purple-100 (NOT black)

### Button Layout

- [ ] Homepage (`/`): 3 buttons — Studio | Pro | Sign in
- [ ] Studio page (`/studio`): 3 buttons — Home | Pro | Sign in
- [ ] Pro Promagen (`/pro-promagen`): 3 buttons — Studio | Home | Sign in
- [ ] Provider pages (`/providers/[id]`): 4 buttons — Home | Studio | Pro | Sign in

### Navigation

- [ ] Home button navigates to `/`
- [ ] Studio button navigates to `/studio`
- [ ] Pro button navigates to `/pro-promagen`
- [ ] Sign in opens Clerk modal

### Responsive

- [ ] Hidden below xl breakpoint (< 1280px)
- [ ] Visible at ≥1280px

---

## Related Documents

| Topic                   | Document                         |
| ----------------------- | -------------------------------- |
| Engine Bay (left panel) | `ignition.md`                    |
| Homepage layout         | `ribbon-homepage.md`             |
| Weather prompt system   | `worldprompt-creative-engine.md` |
| Button styling          | `buttons.md` (CRITICAL)          |
| Auth patterns           | `clerk-auth.md`                  |

---

## Changelog

- **28 Jan 2026 (v2.0.0):** **CRITICAL COLOUR FIX**
  - Added Section: Text & Icon Colour Inheritance
  - All button children (`<svg>`, `<span>`) now have explicit `text-purple-100`
  - Documented the root cause (body colour + `a { color: inherit }`)
  - Added `isStudioSubPage` prop for 4-button layout on provider pages
  - Updated line numbers to match current codebase (697 lines)
  - Added Common Mistakes to Avoid section
  - Added colour testing checklist

- **26 Jan 2026 (v1.1.0):** Context-aware navigation
  - Added `isStudioPage` prop to swap Studio↔Home button

- **24 Jan 2026 (v1.0.0):** Initial implementation

---

_This document is the authority for Mission Control. For Engine Bay, see `ignition.md`._

_**Key principle:** Always update docs FIRST before writing any code. Docs are the single source of truth._

_**Critical rule:** All `<a>` tag buttons MUST have explicit text colour on child `<svg>` and `<span>` elements._
