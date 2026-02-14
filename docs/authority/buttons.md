# Buttons Authority Document

**Last updated:** 10 February 2026  
**Version:** 3.0.0  
**Owner:** Promagen  
**Authority:** This document defines ALL button behaviour, styling, wiring, and code locations across Promagen.

---

## Purpose

This document is the single source of truth for every interactive button in Promagen. It prevents drift by documenting:

- What each button does
- Where it links to
- How it's implemented (component, mechanism)
- Exact file locations and line numbers
- Canonical styling rules
- **CRITICAL: Text/icon colour inheritance rules**

**Hard rule:** Before adding, modifying, or debugging any button, consult this document first.

---

## Quick Reference: All Buttons

| Location             | Button                  | Destination            | Mechanism          | Text/Icon Colour   |
| -------------------- | ----------------------- | ---------------------- | ------------------ | ------------------ |
| Control Dock         | Sign in (AuthButton)    | Clerk modal            | `<SignInButton>`   | **WHITE**          |
| Control Dock         | Greenwich Meridian      | Toggle reference frame | `<button onClick>` | `text-purple-100`  |
| Mission Control      | Home                    | `/`                    | `<a href>`         | `text-purple-100`  |
| Mission Control      | Studio                  | `/studio`              | `<a href>`         | `text-purple-100`  |
| Mission Control      | Pro                     | `/pro-promagen`        | `<a href>`         | `text-purple-100`  |
| Engine Bay           | Launch Platform Builder | `/providers/{id}`      | `<a href>`         | `text-white`       |
| Engine Bay           | Provider icons          | State update           | `onClick`          | N/A                |
| Prompt Builder       | Randomise               | Fill all categories    | `<button onClick>` | `text-purple-100`  |
| Prompt Builder       | Save                    | Save to library        | `<button onClick>` | `text-emerald-100` |
| Prompt Builder       | Done                    | Close/navigate         | `<button onClick>` | `text-slate-100`   |
| Prompt Builder       | Open in {Platform}      | `/go/{id}?src=...`     | `<a href>`         | `text-sky-100`     |
| Fallback Nav         | AuthButton              | Clerk modal            | `<SignInButton>`   | Inherits           |
| Fallback Nav         | Home                    | `/`                    | `<a href>`         | Inherits           |
| Fallback Nav         | Studio                  | `/studio`              | `<a href>`         | Inherits           |
| Fallback Nav         | Pro Promagen            | `/pro-promagen`        | `<a href>`         | Inherits           |
| Studio Feature Cards | Library                 | `/studio/library`      | `<a href>`         | Inherits           |
| Studio Feature Cards | Explore                 | `/studio/explore`      | `<a href>`         | Inherits           |
| Studio Feature Cards | Learn                   | `/studio/learn`        | `<a href>`         | Inherits           |
| Studio Feature Cards | Playground              | `/studio/playground`   | `<a href>`         | Inherits           |

---

## 1. CRITICAL: Text & Icon Colour Inheritance

### 1.1 The Problem

Promagen's `globals.css` has:

```css
body {
  color: #020617; /* slate-950 — BLACK */
}

a {
  color: inherit;
}
```

This means `<a>` tags inherit BLACK text by default. Tailwind's `text-purple-100` on the parent `<a>` does NOT automatically cascade to child `<span>` and `<svg>` elements due to CSS specificity.

### 1.2 The Solution — MANDATORY

**All buttons using `<a>` tags MUST have explicit text colour on child elements:**

```tsx
// ❌ WRONG — Children inherit black from body
<a className="... text-purple-100">
  <svg className="h-4 w-4">...</svg>
  <span>Button Text</span>
</a>

// ✅ CORRECT — Explicit colour on children
<a className="... text-purple-100">
  <svg className="h-4 w-4 text-purple-100">...</svg>
  <span className="text-purple-100">Button Text</span>
</a>
```

### 1.3 Affected Components

| Component                               | File                         | Status                                            |
| --------------------------------------- | ---------------------------- | ------------------------------------------------- |
| **Control Dock (Sign in — AuthButton)** | `control-dock.tsx`           | ✅ Fixed — `!important` wrapper (see §1.5)        |
| Mission Control (Home, Studio, Pro)     | `mission-control.tsx`        | ✅ Fixed — explicit colour on svg + span children |
| Engine Bay (Launch Platform Builder)    | `engine-bay.tsx`             | ✅ Fixed — lines 349, 353, 359                    |
| Prompt Builder (Open in {Platform})     | `prompt-builder.tsx`         | ✅ Fixed — lines 1554, 1567                       |
| Reference Frame Toggle                  | `reference-frame-toggle.tsx` | ✅ OK — uses `<button>` not `<a>`                 |

### 1.4 Colour Reference by Button Type

| Button Type                           | Parent Colour     | Child Colour (svg + span)  |
| ------------------------------------- | ----------------- | -------------------------- |
| **Control Dock Sign in (AuthButton)** | `text-purple-100` | **`!text-white`** (forced) |
| Purple gradient (Mission Control)     | `text-purple-100` | `text-purple-100`          |
| Sky gradient (Open in Platform)       | `text-sky-100`    | `text-sky-100`             |
| White (Engine Bay active)             | `text-white`      | `text-white`               |
| Slate (disabled states)               | `text-slate-500`  | Inherits OK (not `<a>`)    |

### 1.5 RECURRING ISSUE: AuthButton in Control Dock — WHITE text/icon

> **⚠️ THIS HAS BROKEN 4+ TIMES. READ THIS BEFORE TOUCHING THE SIGN-IN BUTTON.**

**What:** When AuthButton sits inside the Control Dock (next to Greenwich Meridian), its text and icon MUST be **white** — not purple-100, not slate, not inherited. **WHITE.**

**Why it keeps breaking:**

1. `auth-button.tsx` defines its own `signInButtonStyles` with `text-purple-100`
2. `body { color: #020617 }` in `globals.css` makes children inherit slate-950
3. Normal Tailwind parent selectors like `[&_button]:text-white` LOSE to the button's own `text-purple-100` class due to CSS specificity — same specificity, later class wins
4. Even targeting `button`, `a`, `svg` is not enough — you also need `span` (the "Sign in" text)

**The ONLY fix that works — `!important` on ALL four child types:**

```tsx
{
  /* In control-dock.tsx — wrapping <AuthButton /> */
}
<div className="[&_button]:!text-white [&_a]:!text-white [&_svg]:!text-white [&_span]:!text-white">
  <AuthButton />
</div>;
```

**Why `!important` is required here (and nowhere else):**

- AuthButton is a **shared component** — we cannot modify its internal styles without affecting it everywhere else it's used (Fallback Nav)
- The wrapper's `[&_button]:text-white` generates a CSS rule with the SAME specificity as the button's own `text-purple-100` — last-defined wins, which is unpredictable
- `!important` is the only way to guarantee the wrapper override wins without editing AuthButton itself
- This is NOT a hack — it's the correct pattern for "parent forces colour on shared child component"

**Checklist every time Sign in button is moved or touched:**

- [ ] Text "Sign in" is white (not purple, not slate/black)
- [ ] User icon (SVG) is white (not purple, not slate/black)
- [ ] "Loading..." text is acceptable (uses its own disabled styles)
- [ ] Timeout fallback `<a>` text is white
- [ ] When signed in, Clerk UserButton avatar renders normally (no white override artefacts)

**File:** `src/components/home/control-dock.tsx`

---

## 2. Canonical Button Styling

**Authority:** `code-standard.md` §6.1

All buttons in Promagen use a single, consistent design language.

### 2.1 Default Button Style (Purple Gradient)

```tsx
const buttonStyles =
  'inline-flex items-center justify-center gap-2 rounded-full border border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 px-4 py-2 text-sm font-medium text-purple-100 shadow-sm transition-all hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400 focus-visible:outline-none focus-visible:ring focus-visible:ring-purple-400/80';
```

### 2.2 Style Breakdown

| Property   | Value                                                                            | Purpose                             |
| ---------- | -------------------------------------------------------------------------------- | ----------------------------------- |
| Layout     | `inline-flex items-center justify-center gap-2`                                  | Horizontal, centered content        |
| Shape      | `rounded-full`                                                                   | Pill-shaped button                  |
| Border     | `border border-purple-500/70`                                                    | Subtle purple outline (70% opacity) |
| Background | `bg-gradient-to-r from-purple-600/20 to-pink-600/20`                             | Purple→pink gradient at 20% opacity |
| Text       | `text-sm font-medium text-purple-100`                                            | 14px, medium weight, light purple   |
| Padding    | `px-4 py-2`                                                                      | 16px horizontal, 8px vertical       |
| Shadow     | `shadow-sm`                                                                      | Subtle drop shadow                  |
| Transition | `transition-all`                                                                 | Smooth state changes                |
| Hover      | `hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400`          | Intensify gradient and border       |
| Focus      | `focus-visible:outline-none focus-visible:ring focus-visible:ring-purple-400/80` | Purple focus ring                   |

### 2.3 Reference Implementations

**Randomise Button** (Canonical Reference)  
**File:** `src/components/providers/prompt-builder.tsx`  
**Lines:** 1467-1480

```tsx
<button
  type="button"
  onClick={handleRandomise}
  disabled={isLocked}
  className={`inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-sm transition-all focus-visible:outline-none focus-visible:ring focus-visible:ring-purple-400/80 ${
    isLocked
      ? 'cursor-not-allowed border-slate-700 bg-slate-800/50 text-slate-500'
      : 'border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-purple-100 hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400'
  }`}
>
  <span className="text-base">🎲</span>
  Randomise
</button>
```

**Greenwich Meridian Toggle** (Canonical Reference)  
**File:** `src/components/reference-frame-toggle.tsx`  
**Lines:** 165-171

```tsx
const buttonClasses = `
  inline-flex items-center justify-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium shadow-sm transition-all
  focus-visible:outline-none focus-visible:ring focus-visible:ring-purple-400/80
  border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-purple-100
  hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400
  ${getCursorClass()}
`;
```

---

## 3. Button Variants

### 3.1 Purple Gradient (Default)

Used for: Mission Control buttons, Randomise, Greenwich Meridian toggle

```tsx
'border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-purple-100 hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400';
```

### 3.2 Emerald Gradient (Save/Success)

Used for: Save to Library button

```tsx
'border-emerald-500/70 bg-gradient-to-r from-emerald-600/20 to-teal-600/20 text-emerald-100 hover:from-emerald-600/30 hover:to-teal-600/30 hover:border-emerald-400';
```

**File:** `src/components/providers/prompt-builder.tsx`  
**Lines:** 1482-1520

### 3.3 Sky Gradient (External Links)

Used for: Open in {Platform} button

```tsx
'border-sky-500/70 bg-sky-600/10 text-sky-100 hover:bg-sky-500/20';
```

**File:** `src/components/providers/prompt-builder.tsx`  
**Lines:** 1545-1569

**CRITICAL:** Children need explicit `text-sky-100`:

```tsx
<svg className="h-4 w-4 text-sky-100">...</svg>
<span className="text-sky-100">Open in {provider.name}</span>
```

### 3.4 Slate (Neutral/Done)

Used for: Done button

```tsx
'border-slate-600 bg-slate-800 text-slate-100 hover:border-slate-400 hover:bg-slate-700';
```

**File:** `src/components/providers/prompt-builder.tsx`  
**Lines:** 1522-1543

### 3.5 Sky/Emerald/Indigo Gradient (Primary CTA)

Used for: Engine Bay Launch button (active state)

```tsx
'engine-bay-active border-sky-400/60 bg-gradient-to-r from-sky-400/40 via-emerald-300/40 to-indigo-400/40 text-white';
```

**File:** `src/components/home/engine-bay.tsx`  
**Lines:** 329-333

**CRITICAL:** Children need explicit `text-white`:

```tsx
<span className="text-white">✦</span>
<span className="text-white">Launch</span>
<span className="text-white">Platform Builder</span>
<svg className="text-white">...</svg>
```

### 3.6 Disabled State

Used for: All buttons when disabled/locked

```tsx
'cursor-not-allowed border-slate-700 bg-slate-800/50 text-slate-500';
```

---

## 4. Mission Control Buttons

**File:** `src/components/home/mission-control.tsx`  
**Visibility:** Desktop XL only (`hidden xl:block` — ≥1280px)

### 4.1 Button Style Constants

**Lines:** 195-205

```tsx
const actionButtonBase =
  'inline-flex w-full flex-col items-center justify-center gap-0.5 rounded-xl border px-4 py-3 text-center text-sm font-semibold shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/80';

const actionButtonActive =
  'border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-purple-100 hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400 cursor-pointer';

const actionButtonLoading =
  'border-slate-600/50 bg-slate-800/30 text-slate-400 cursor-wait opacity-70';
```

### 4.2 Grid Layout

**v3.0.0:** Sign-in button removed from Mission Control grid (moved to Control Dock).

```tsx
// 3-button layout (isStudioSubPage=true): Home | Studio | Pro
// 2-button layout (default): varies by page context
const gridCols = isStudioSubPage ? 'grid-cols-3' : 'grid-cols-2';

<div className={`grid ${gridCols} gap-3`}>{/* buttons */}</div>;
```

**Lines:** 547, 674

### 4.3 Button Implementations

**Home Button** (Lines 453-466):

```tsx
const renderHomeButton = () => (
  <a href="/" className={`${actionButtonBase} ${actionButtonActive}`} aria-label="Go to Homepage">
    <svg
      className="h-5 w-5 text-purple-100"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={homeIconPath} />
    </svg>
    <span className="text-purple-100">Home</span>
  </a>
);
```

**Studio Button** (Lines 471-491):

```tsx
const renderStudioButton = () => (
  <a
    href="/studio"
    className={`${actionButtonBase} ${actionButtonActive}`}
    aria-label="Open Prompt Studio"
  >
    <svg
      className="h-5 w-5 text-purple-100"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={studioIconPath} />
    </svg>
    <span className="text-purple-100">Studio</span>
  </a>
);
```

**Pro Button** (Lines 496-513):

```tsx
const renderProButton = () => (
  <a
    href="/pro-promagen"
    className={`${actionButtonBase} ${actionButtonActive}`}
    aria-label="View Pro Promagen features"
  >
    <svg
      className="h-5 w-5 text-purple-100"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={proIconPath} />
    </svg>
    <span className="text-purple-100">Pro</span>
  </a>
);
```

### 4.4 Icon Paths

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

## 5. Engine Bay Launch Button

**File:** `src/components/home/engine-bay.tsx`  
**Lines:** 319-372

### 5.1 Button States

| State                      | Classes                                                                                                                              | Visual                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| Active (platform selected) | `engine-bay-active border-sky-400/60 bg-gradient-to-r from-sky-400/40 via-emerald-300/40 to-indigo-400/40 text-white cursor-pointer` | Pulsing glow, shimmer on hover |
| Inactive (no platform)     | `border-slate-600/50 bg-slate-800/50 text-slate-500 cursor-not-allowed`                                                              | Greyed out                     |

### 5.2 Button Content (2-Line Layout)

```tsx
<div className="relative z-10 flex flex-col items-center gap-0.5">
  <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
    <span>✦</span>
    <span>Launch</span>
  </span>
  <span className="text-sm font-semibold text-white">Platform Builder</span>
</div>;

{
  /* Arrow when selected */
}
{
  selected && (
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
  );
}
```

### 5.3 Animations (Style JSX)

**Lines:** 375-426

```tsx
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
`}</style>
```

---

## 6. Prompt Builder Buttons

**File:** `src/components/providers/prompt-builder.tsx`

### 6.1 Randomise Button

**Lines:** 1467-1480

- Icon: 🎲 emoji
- Colour: Purple gradient
- Disabled: When `isLocked=true`

### 6.2 Save to Library Button

**Lines:** 1482-1520

- Icon: Bookmark SVG (changes to checkmark on success)
- Colour: Emerald gradient
- States: Normal, Saved (confirmation), Disabled
- Disabled: When no content or `isLocked=true`

### 6.3 Done Button

**Lines:** 1522-1543

- Icon: Checkmark SVG
- Colour: Slate (neutral)
- Action: Closes prompt builder / navigates

### 6.4 Open in {Platform} Button

**Lines:** 1545-1569

- Icon: External link SVG
- Colour: Sky gradient
- Destination: `/go/{provider.id}?src=prompt_builder`
- Opens: New tab (`target="_blank"`)

**CRITICAL:** Uses `<a>` tag — children need explicit `text-sky-100`:

```tsx
<svg className="h-4 w-4 text-sky-100">...</svg>
<span className="text-sky-100">Open in {provider.name}</span>
```

---

## 7. Control Dock / Reference Frame Toggle

**File:** `src/components/reference-frame-toggle.tsx`

### 7.1 Button Styling

**Lines:** 165-171

Uses canonical purple gradient styling. No colour inheritance issues (uses `<button>` not `<a>`).

### 7.2 States

| User State       | Cursor               | Behaviour                      |
| ---------------- | -------------------- | ------------------------------ |
| Anonymous        | `cursor-default`     | Click opens SignInButton modal |
| Free signed-in   | `cursor-default`     | Click shows upgrade prompt     |
| Pro Promagen     | `cursor-pointer`     | Click toggles reference frame  |
| Disabled/Loading | `cursor-not-allowed` | No action                      |

---

## 8. Icon Standards

### 8.1 Size Reference

| Context         | Size    | Class     |
| --------------- | ------- | --------- |
| Default buttons | 16×16px | `h-4 w-4` |
| Mission Control | 20×20px | `h-5 w-5` |
| Feature cards   | 20×20px | `h-5 w-5` |

### 8.2 SVG Structure

```tsx
<svg
  className="h-4 w-4 text-purple-100" // ALWAYS include colour class
  fill="none"
  viewBox="0 0 24 24"
  stroke="currentColor"
  aria-hidden="true"
>
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="..." />
</svg>
```

### 8.3 Icon Reference

| Icon          | Path Variable    | Used In                         |
| ------------- | ---------------- | ------------------------------- |
| User          | `userIconPath`   | Sign in button                  |
| Home          | `homeIconPath`   | Home button                     |
| Wand          | `studioIconPath` | Studio button                   |
| Star          | `proIconPath`    | Pro button                      |
| Bookmark      | inline           | Save button                     |
| Check         | inline           | Done, Save success              |
| External Link | inline           | Open in Platform                |
| Arrow Right   | inline           | Engine Bay Launch               |
| Globe         | inline           | Reference Frame Toggle          |
| Lock          | inline           | Reference Frame Toggle (locked) |

---

## 9. Debugging Guide

### 9.1 Text/Icon Appearing Black

**Cause:** Parent `<a>` tag has colour class but children don't inherit it.

**Solution:** Add explicit colour class to `<svg>` and `<span>` children:

```tsx
<svg className="h-4 w-4 text-purple-100">
<span className="text-purple-100">
```

### 9.2 AuthButton Text/Icon Appearing Slate or Purple (Not White)

**Cause:** AuthButton is a shared component with its own `text-purple-100`. Parent wrapper selectors lose the CSS specificity battle.

**Solution:** Use `!important` on ALL four child types in the wrapper div:

```tsx
<div className="[&_button]:!text-white [&_a]:!text-white [&_svg]:!text-white [&_span]:!text-white">
  <AuthButton />
</div>
```

**Common mistakes that DO NOT work:**

```tsx
// ❌ Missing span — icon goes white but text stays slate
[&_button]:text-white [&_a]:text-white [&_svg]:text-white

// ❌ Missing !important — button's own text-purple-100 wins
[&_button]:text-white [&_a]:text-white [&_svg]:text-white [&_span]:text-white

// ❌ Only targeting button — a (timeout fallback) stays slate
[&_button]:!text-white [&_svg]:!text-white [&_span]:!text-white
```

### 9.3 Button Not Clicking

**Check:**

1. `onClick` handler exists and isn't `undefined`
2. No overlay covering button (`pointer-events-none` on overlays)
3. Button isn't disabled (`aria-disabled`, `disabled` attribute)
4. Z-index stacking context (content should be `z-10` above decorative elements)

### 9.4 Navigation Not Working

**Check:**

1. Route exists (`src/app/{route}/page.tsx`)
2. Using correct mechanism:
   - `<a href>` for reliable navigation (recommended)
   - `<Link>` for client-side navigation (can fail with z-index issues)
3. `href` value — Console.log the href

**If `<Link>` fails, use `<a href>` instead** — native anchors are more reliable.

### 9.5 Animation Not Playing

**Check:**

1. CSS class is applied (`engine-bay-active`, `engine-bay-shimmer`)
2. `<style jsx>` tag is present in component
3. `prefers-reduced-motion` isn't enabled
4. Animation keyframes are defined

---

## 10. Testing Checklist

### 10.1 Colour Inheritance (CRITICAL)

- [ ] **Control Dock: Sign in button text is WHITE (not purple, not slate/black)**
- [ ] **Control Dock: Sign in button icon is WHITE (not purple, not slate/black)**
- [ ] Mission Control: Home button text/icon is purple-100 (not black)
- [ ] Mission Control: Studio button text/icon is purple-100 (not black)
- [ ] Mission Control: Pro button text/icon is purple-100 (not black)
- [ ] Engine Bay: Launch text/icon is white (not black) when active
- [ ] Prompt Builder: Open in {Platform} text/icon is sky-100 (not black)

### 10.2 Control Dock Buttons

- [ ] Sign in opens Clerk modal (unauthenticated)
- [ ] Sign in text and icon are WHITE
- [ ] When signed in, shows Clerk UserButton avatar
- [ ] Greenwich Meridian toggle works for Pro users

### 10.3 Mission Control Buttons

- [ ] Home navigates to `/`
- [ ] Studio navigates to `/studio`
- [ ] Pro navigates to `/pro-promagen`
- [ ] 2-button layout on homepage (Studio | Pro)
- [ ] 2-button layout on studio page (Home | Pro)
- [ ] 2-button layout on pro-promagen page (Studio | Home)
- [ ] 3-button layout on provider pages (Home | Studio | Pro)

### 10.4 Engine Bay Button

- [ ] Launch disabled when no platform selected
- [ ] Launch enabled when platform selected
- [ ] Launch navigates to `/providers/{id}`
- [ ] Pulse animation runs when active
- [ ] Shimmer appears on hover when active
- [ ] Text and icon are white when active

### 10.5 Prompt Builder Buttons

- [ ] Randomise fills all categories
- [ ] Save shows confirmation then resets
- [ ] Done closes/navigates correctly
- [ ] Open in {Platform} opens new tab
- [ ] All disabled states work correctly

### 10.6 Accessibility

- [ ] All buttons keyboard focusable
- [ ] Focus ring visible on focus
- [ ] Screen reader announces button labels
- [ ] Disabled buttons have `aria-disabled`
- [ ] Animations respect `prefers-reduced-motion`

---

## 11. File Location Summary

| Component                              | File                                          | Key Lines |
| -------------------------------------- | --------------------------------------------- | --------- |
| **Control Dock (Sign in + Greenwich)** | `src/components/home/control-dock.tsx`        | Full file |
| AuthButton (shared)                    | `src/components/auth/auth-button.tsx`         | Full file |
| Mission Control buttons                | `src/components/home/mission-control.tsx`     | 300-380   |
| Mission Control styles                 | `src/components/home/mission-control.tsx`     | 195-205   |
| Engine Bay launch                      | `src/components/home/engine-bay.tsx`          | 319-372   |
| Engine Bay animations                  | `src/components/home/engine-bay.tsx`          | 375-426   |
| Prompt Builder buttons                 | `src/components/providers/prompt-builder.tsx` | 1467-1569 |
| Reference Frame Toggle                 | `src/components/reference-frame-toggle.tsx`   | 165-241   |

---

## 12. Related Documents

| Topic           | Document                |
| --------------- | ----------------------- |
| Mission Control | `mission-control.md`    |
| Engine Bay      | `ignition.md`           |
| Homepage layout | `ribbon-homepage.md`    |
| Code standards  | `code-standard.md` §6.1 |
| Authentication  | `clerk-auth.md`         |
| Paid tier logic | `paid_tier.md`          |

---

## Changelog

- **10 Feb 2026 (v3.0.0):** **AUTHBUTTON WHITE COLOUR FIX** — Sign-in button moved from Mission Control grid to Control Dock (next to Greenwich Meridian). Added §1.5 documenting the recurring white text/icon issue: AuthButton's own `text-purple-100` fights parent overrides, requires `!important` wrapper on all four child types (`button`, `a`, `svg`, `span`). Added §9.2 debugging guide for AuthButton colour issues with common mistakes. Updated Quick Reference table with Text/Icon Colour column. Updated §1.3 Affected Components and §1.4 Colour Reference. Mission Control grid reduced from 3→2 / 4→3 columns (sign-in no longer in grid). Updated testing checklist §10.1-10.3.

- **28 Jan 2026 (v2.0.0):** **CRITICAL COLOUR FIX** — Added Section 1 documenting text/icon colour inheritance issue. When using `<a>` tags, children must have explicit `text-{colour}` classes because body has `color: #020617` (black) and `a { color: inherit }`. Updated all button implementations to show correct colour classes on svg and span elements. Added Engine Bay animations section with `<style jsx>` code. Added Prompt Builder buttons section (Randomise, Save, Done, Open in Platform). Updated line numbers to match current codebase.

- **26 Jan 2026 (v1.1.0):** **STUDIO FEATURE CARDS** — Added Section 5 documenting the 4 Studio hub navigation cards. Added `isStudioPage` prop to Mission Control.

- **25 Jan 2026 (v1.0.0):** Initial document

---

_This document is the authority for ALL buttons in Promagen. Update this document FIRST before modifying any button behaviour._

_**Key principle:** Always update docs FIRST before writing any code. Docs are the single source of truth._

_**Critical rule #1:** All `<a>` tag buttons MUST have explicit text colour on child `<svg>` and `<span>` elements._

_**Critical rule #2:** AuthButton in Control Dock MUST have `!important` white override on `button`, `a`, `svg`, AND `span` children. It has broken 4+ times — do not remove the `!important` wrapper._
