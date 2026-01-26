# Buttons Authority Document

**Last updated:** 25 January 2026  
**Version:** 1.1.0  
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
- **Critical implementation patterns (especially Clerk authentication)**

**Hard rule:** Before adding, modifying, or debugging any button, consult this document first.

---

## Quick Reference: All Buttons

| Location        | Button         | Destination       | Mechanism             |
| --------------- | -------------- | ----------------- | --------------------- |
| Mission Control | Sign in        | Clerk modal       | `<SignInButton>`      |
| Mission Control | Studio         | `/studio`         | `<a href>`            |
| Mission Control | Pro            | `/pro-promagen`   | `<a href>`            |
| Mission Control | Copy           | Clipboard         | `navigator.clipboard` |
| Engine Bay      | Launch         | `/providers/{id}` | `<a href>`            |
| Engine Bay      | Provider icons | State update      | `onClick`             |
| Fallback Nav    | AuthButton     | Clerk modal       | `<SignInButton>`      |
| Fallback Nav    | Home           | `/`               | `<a href>`            |
| Fallback Nav    | Studio         | `/studio`         | `<a href>`            |
| Fallback Nav    | Pro Promagen   | `/pro-promagen`   | `<a href>`            |

---

## 1. Canonical Button Styling

**Authority:** `code-standard.md` §6.1

All buttons in Promagen use a single, consistent design language. There are TWO canonical styles:

### 1.1 Header Button Style (Horizontal - AuthButton)

Used in navigation headers. Horizontal layout with icon beside text.

```tsx
const signInButtonStyles =
  'inline-flex items-center justify-center gap-2 rounded-full border border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 px-4 py-1.5 text-sm font-medium text-purple-100 shadow-sm transition-all hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400 focus-visible:outline-none focus-visible:ring focus-visible:ring-purple-400/80';
```

**File:** `src/components/auth/auth-button.tsx` (lines 65-66)

### 1.2 Mission Control Button Style (Vertical - Action Buttons)

Used in Mission Control action zone. Vertical layout with icon above text.

```tsx
const actionButtonBase =
  'inline-flex w-full flex-col items-center justify-center gap-0.5 rounded-xl border px-4 py-3 text-center text-sm font-semibold shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/80';

const actionButtonActive =
  'border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-purple-100 hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400 cursor-pointer';

const actionButtonLoading =
  'border-slate-600/50 bg-slate-800/30 text-slate-400 cursor-wait opacity-70';
```

**File:** `src/components/home/mission-control.tsx` (lines 68-76)

### 1.3 Style Comparison

| Property  | Header (AuthButton)         | Mission Control        |
| --------- | --------------------------- | ---------------------- |
| Layout    | `items-center` (horizontal) | `flex-col` (vertical)  |
| Shape     | `rounded-full` (pill)       | `rounded-xl` (rounded) |
| Width     | Auto                        | `w-full` (grid cell)   |
| Gap       | `gap-2`                     | `gap-0.5`              |
| Padding   | `px-4 py-1.5`               | `px-4 py-3`            |
| Icon size | `h-4 w-4`                   | `h-5 w-5`              |

### 1.4 Deviation Rules

Only deviate from canonical styling if:

1. User explicitly requests different styling
2. Context requires it (e.g., Engine Bay launch button has special gradient)
3. Accessibility requires it (e.g., larger hit area for touch targets)

**All deviations must be documented with a comment explaining why.**

### 1.5 Approved Deviations

| Component         | Deviation                   | Reason                        | Lines                    |
| ----------------- | --------------------------- | ----------------------------- | ------------------------ |
| Engine Bay Launch | Sky/emerald/indigo gradient | Visual hierarchy, primary CTA | `engine-bay.tsx:329-333` |

---

## 2. CRITICAL: Clerk SignInButton Implementation

**⚠️ THIS SECTION CONTAINS CRITICAL IMPLEMENTATION DETAILS. FAILURE TO FOLLOW THESE PATTERNS WILL RESULT IN NON-FUNCTIONAL BUTTONS.**

### 2.1 The Problem

`<SignInButton>` from `@clerk/nextjs` will NOT work if rendered before Clerk has finished loading. The button will appear but clicking it does nothing.

**Root cause:** SignInButton attaches click handlers only after Clerk client initializes. If rendered during SSR or before `clerk.loaded === true`, the button is inert.

### 2.2 The Solution: State Machine Pattern

**ALWAYS** use this pattern when implementing SignInButton anywhere in the application:

```tsx
import { SignInButton, useClerk } from '@clerk/nextjs';
import { useState, useEffect, useMemo } from 'react';

const CLERK_LOAD_TIMEOUT_MS = 3000;

function MyComponent() {
  const clerk = useClerk();
  const [mounted, setMounted] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  // 1. Track client-side mount (prevents SSR hydration issues)
  useEffect(() => {
    setMounted(true);
  }, []);

  // 2. Timeout fallback (if Clerk doesn't load in 3s)
  useEffect(() => {
    if (mounted && !clerk.loaded) {
      const timeout = setTimeout(() => {
        if (!clerk.loaded) {
          console.warn('[Component] Clerk did not load within timeout');
          setTimedOut(true);
        }
      }, CLERK_LOAD_TIMEOUT_MS);
      return () => clearTimeout(timeout);
    }
  }, [mounted, clerk.loaded]);

  // 3. Determine auth state
  const authState = useMemo(() => {
    if (!mounted) return 'ssr';
    if (clerk.loaded) return 'ready';
    if (timedOut) return 'timeout';
    return 'loading';
  }, [mounted, clerk.loaded, timedOut]);

  // 4. Render based on state
  switch (authState) {
    case 'ssr':
    case 'loading':
      return <span className="...loading styles...">Loading...</span>;
    case 'timeout':
      return (
        <a href="/sign-in" className="...">
          Sign in
        </a>
      );
    case 'ready':
      return (
        <SignInButton mode="modal">
          <button type="button" className="...">
            Sign in
          </button>
        </SignInButton>
      );
  }
}
```

### 2.3 State Machine States

| State     | Condition                               | Renders                        |
| --------- | --------------------------------------- | ------------------------------ |
| `ssr`     | `!mounted`                              | Loading placeholder            |
| `loading` | `mounted && !clerk.loaded && !timedOut` | Loading placeholder (animated) |
| `timeout` | `timedOut` (after 3s)                   | Fallback `<a href="/sign-in">` |
| `ready`   | `clerk.loaded`                          | `<SignInButton mode="modal">`  |

### 2.4 Why Each State Matters

1. **`ssr`**: Prevents React hydration mismatch errors. Server renders loading state, client picks up same state initially.

2. **`loading`**: Shows user feedback while Clerk JavaScript loads and initializes.

3. **`timeout`**: Fallback if Clerk fails to load (network issues, ad blockers, etc.). Links to `/sign-in` page instead of modal.

4. **`ready`**: Only NOW is it safe to render SignInButton. Clerk will attach click handlers correctly.

### 2.5 Reference Implementations

**AuthButton (Header):**  
File: `src/components/auth/auth-button.tsx`  
Pattern: Full state machine with session polling, OAuth hash cleanup, stuck state detection

**Mission Control (Homepage):**  
File: `src/components/home/mission-control.tsx`  
Pattern: Simplified state machine (mounted → loading → ready/timeout)
Lines: 84-118 (state logic), 198-248 (renderSignInButton function)

### 2.6 Common Mistakes That Break SignInButton

| Mistake                                      | Why It Breaks                       | Fix                                 |
| -------------------------------------------- | ----------------------------------- | ----------------------------------- |
| Rendering SignInButton immediately           | Clerk not loaded, no click handlers | Use state machine pattern           |
| Using `flex-1` on button inside SignInButton | Breaks click event propagation      | Use `w-full` with CSS Grid parent   |
| Wrapping SignInButton in `<Link>`            | Conflicting click handlers          | Never wrap, use SignInButton alone  |
| Using `<div>` or `<a>` as child              | Clerk expects `<button>`            | Always use `<button type="button">` |
| Checking `clerk.loaded` without `mounted`    | SSR hydration mismatch              | Always check `mounted` first        |

### 2.7 CSS Layout Constraints

**NEVER use `flex-1` on a button inside SignInButton.**

SignInButton creates an intermediate wrapper element. When the child button has `flex-1`, click events don't propagate correctly through this wrapper.

**Instead, use CSS Grid for equal-width buttons:**

```tsx
// ❌ BROKEN: flex with flex-1
<div className="flex gap-3">
  <a className="flex-1">Studio</a>
  <SignInButton>
    <button className="flex-1">Sign in</button>  {/* Won't work! */}
  </SignInButton>
</div>

// ✅ WORKING: grid with w-full
<div className="grid grid-cols-3 gap-3">
  <a className="w-full">Studio</a>
  <SignInButton mode="modal">
    <button className="w-full">Sign in</button>  {/* Works! */}
  </SignInButton>
</div>
```

### 2.8 Environment Variables

SignInButton requires Clerk to be properly configured:

**Development (localhost):**

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx
```

**Production (promagen.com):**

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxxxx
CLERK_SECRET_KEY=sk_live_xxxxx
```

**⚠️ Production keys (`pk_live_`) only work on the registered domain. Using production keys on localhost will cause Clerk to fail silently.**

Console error to watch for:

```
Clerk: Production keys are only allowed for domain 'promagen.com'
```

---

## 3. Mission Control Buttons

**File:** `src/components/home/mission-control.tsx`  
**Authority:** `mission-control.md` §5 Action Buttons Row  
**Version:** v3.2.11

### 3.1 Button Grid Layout

```tsx
<div className="grid grid-cols-3 gap-3">
  {/* Studio */}
  {/* Pro */}
  {/* Sign In (rendered via state machine) */}
</div>
```

**Lines:** 310-350

**Key points:**

- Uses CSS Grid (`grid-cols-3`) NOT Flexbox
- All buttons use `w-full` NOT `flex-1`
- Gap of `gap-3` (12px)

### 3.2 Sign In Button

**Purpose:** Open Clerk authentication modal

**States:**

| State   | Visual                    | Behaviour             |
| ------- | ------------------------- | --------------------- |
| Loading | Grey, "Loading...", pulse | Disabled, cursor-wait |
| Timeout | Purple, "Sign in"         | Links to `/sign-in`   |
| Ready   | Purple, "Sign in"         | Opens Clerk modal     |

**Implementation:**

```tsx
const renderSignInButton = () => {
  switch (authState) {
    case 'ssr':
    case 'loading':
      return (
        <span className={`${actionButtonBase} ${actionButtonLoading}`}>
          <svg className="h-5 w-5 animate-pulse">...</svg>
          <span>Loading...</span>
        </span>
      );
    case 'timeout':
      return (
        <a href="/sign-in" className={`${actionButtonBase} ${actionButtonActive}`}>
          <svg className="h-5 w-5">...</svg>
          <span>Sign in</span>
        </a>
      );
    case 'ready':
      return (
        <SignInButton mode="modal">
          <button type="button" className={`${actionButtonBase} ${actionButtonActive}`}>
            <svg className="h-5 w-5">...</svg>
            <span>Sign in</span>
          </button>
        </SignInButton>
      );
  }
};
```

**Lines:** 198-248

### 3.3 Studio Button

**Purpose:** Navigate to Prompt Studio  
**Destination:** `/studio`

**Implementation:**

```tsx
<a
  href="/studio"
  className={`${actionButtonBase} ${actionButtonActive}`}
  aria-label="Open Prompt Studio"
>
  <svg className="h-5 w-5">/* Wand icon */</svg>
  <span>Studio</span>
</a>
```

**Lines:** 312-323

### 3.4 Pro Button

**Purpose:** Navigate to Pro Promagen page  
**Destination:** `/pro-promagen`

**Implementation:**

```tsx
<a
  href="/pro-promagen"
  className={`${actionButtonBase} ${actionButtonActive}`}
  aria-label="View Pro Promagen features"
>
  <svg className="h-5 w-5">/* Sparkles icon */</svg>
  <span>Pro</span>
</a>
```

**Lines:** 326-337

### 3.5 Copy Button

**Purpose:** Copy weather prompt to clipboard  
**Location:** Content zone header (right side)

**Implementation:**

```tsx
<button
  type="button"
  onClick={handleCopy}
  className={`inline-flex h-6 w-6 ... ${copied ? 'bg-emerald-500/20' : 'bg-white/5'}`}
>
  {copied ? <CheckIcon /> : <CopyIcon />}
</button>
```

**Lines:** 275-295

---

## 4. AuthButton (Fallback Navigation)

**File:** `src/components/auth/auth-button.tsx`  
**Purpose:** Authentication button for site header/fallback nav

### 4.1 Full State Machine

AuthButton implements the complete Clerk state machine with additional features:

- Session polling after OAuth redirect
- OAuth hash fragment cleanup (`#_=_`)
- Stuck state detection with auto-reload
- Clerk event listener for session changes

### 4.2 States

| State      | Visual            | Behaviour              |
| ---------- | ----------------- | ---------------------- |
| Loading    | "Loading..." grey | Disabled               |
| Timeout    | "Sign in" purple  | Links to `/sign-in`    |
| Signed Out | "Sign in" purple  | Opens Clerk modal      |
| Signed In  | User avatar       | Opens Clerk UserButton |

### 4.3 Key Implementation Details

```tsx
// Session state polling (handles OAuth redirect)
const checkSessionState = useCallback(() => {
  if (!clerk.loaded) return 'loading';
  if (clerk.user || clerk.session) return 'signed-in';
  return 'signed-out';
}, [clerk]);

// Clerk event listener
useEffect(() => {
  if (!clerk.loaded) return;
  const unsubscribe = clerk.addListener(() => {
    const state = checkSessionState();
    setSessionState(state);
  });
  return () => unsubscribe();
}, [clerk, checkSessionState]);
```

**Lines:** 100-175

---

## 5. Engine Bay Launch Button

**File:** `src/components/home/engine-bay.tsx`

### 5.1 States

| State    | Visual                        | Behaviour              |
| -------- | ----------------------------- | ---------------------- |
| Disabled | Grey, no animation            | Cursor not-allowed     |
| Active   | Sky/emerald gradient, pulsing | Links to provider page |

### 5.2 Implementation

```tsx
{
  selectedProvider ? (
    <a
      href={`/providers/${selectedProvider.id}`}
      className="... bg-gradient-to-r from-sky-400 via-emerald-300 to-indigo-400 ..."
    >
      <span>Launch Platform</span>
    </a>
  ) : (
    <span className="... bg-slate-700/50 text-slate-500 cursor-not-allowed ...">
      <span>Select Platform</span>
    </span>
  );
}
```

**Lines:** 320-365

---

## 6. Route Verification Table

| Route                | File                                      | Purpose                 |
| -------------------- | ----------------------------------------- | ----------------------- |
| `/`                  | `src/app/page.tsx`                        | Homepage                |
| `/studio`            | `src/app/studio/page.tsx`                 | Prompt Studio hub       |
| `/studio/library`    | `src/app/studio/library/page.tsx`         | Saved prompts           |
| `/studio/explore`    | `src/app/studio/explore/page.tsx`         | Style families          |
| `/studio/learn`      | `src/app/studio/learn/page.tsx`           | Guides & tutorials      |
| `/studio/playground` | `src/app/studio/playground/page.tsx`      | Prompt playground       |
| `/pro-promagen`      | `src/app/pro-promagen/page.tsx`           | Pro features & config   |
| `/providers/[id]`    | `src/app/providers/[id]/page.tsx`         | Provider prompt builder |
| `/sign-in`           | `src/app/sign-in/[[...sign-in]]/page.tsx` | Clerk sign-in page      |
| `/sign-up`           | `src/app/sign-up/[[...sign-up]]/page.tsx` | Clerk sign-up page      |

---

## 7. Icon Components

### 7.1 Mission Control Icons

**File:** `src/components/home/mission-control.tsx`

Icons are inline SVG paths, not separate components. All use `h-5 w-5` size.

| Icon     | SVG Path Variable | Purpose        |
| -------- | ----------------- | -------------- |
| User     | `userIconPath`    | Sign in button |
| Wand     | Inline            | Studio button  |
| Sparkles | Inline            | Pro button     |

**User icon path (line 79):**

```tsx
const userIconPath =
  'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z';
```

### 7.2 Auth Button Icons

**File:** `src/components/auth/auth-button.tsx`

| Icon          | Lines | Purpose        |
| ------------- | ----- | -------------- |
| `UserIcon`    | 26-43 | Sign in button |
| `LoadingIcon` | 45-62 | Loading state  |

**Icon styling standard:**

```tsx
<svg
  className="h-5 w-5"  // Mission Control
  // or
  className="h-4 w-4"  // AuthButton header
  fill="none"
  stroke="currentColor"
  viewBox="0 0 24 24"
  aria-hidden="true"
>
```

---

## 8. Accessibility Requirements

### 8.1 Keyboard Navigation

- All buttons focusable via Tab
- Enter/Space activates button
- Focus ring visible on `:focus-visible`

### 8.2 ARIA Attributes

| Attribute            | Usage                                                  |
| -------------------- | ------------------------------------------------------ |
| `aria-label`         | Describe button action when text alone is insufficient |
| `aria-disabled`      | Indicate disabled state (not just visual)              |
| `aria-hidden="true"` | Decorative icons                                       |

### 8.3 Focus Styling

```css
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/80
```

---

## 9. Common Issues & Debugging

### 9.1 SignInButton Not Working (Most Common)

**Symptoms:** Button appears but clicking does nothing. No Clerk modal opens.

**Causes & Fixes:**

| Cause                        | How to Identify                                    | Fix                                 |
| ---------------------------- | -------------------------------------------------- | ----------------------------------- |
| Clerk not loaded             | No state machine pattern                           | Implement full state machine (§2.2) |
| Production keys on localhost | Console: "Production keys only allowed for domain" | Use `pk_test_` keys in `.env.local` |
| `flex-1` on button           | Button inside SignInButton has `flex-1` class      | Use CSS Grid + `w-full` instead     |
| Missing `mounted` check      | Hydration errors in console                        | Add `mounted` state (§2.2)          |
| Wrong child element          | Using `<div>` or `<a>` as SignInButton child       | Use `<button type="button">`        |

### 9.2 Button Appears Empty / Wrong Size

**Cause:** CSS Grid/Flex conflict or missing `w-full`.

**Fix:** Ensure parent is `grid grid-cols-3` and button has `w-full`.

### 9.3 Hydration Mismatch Errors

**Cause:** Server renders different state than client initial render.

**Fix:** Use `mounted` state pattern. Only render interactive content after `mounted === true`.

### 9.4 Clerk Modal Opens on Wrong Page But Not Homepage

**Cause:** AuthButton uses full state machine, your component doesn't.

**Fix:** Copy the state machine pattern from AuthButton or Mission Control (§2.2).

---

## 10. Testing Checklist

### 10.1 Mission Control Buttons

- [ ] Sign in shows "Loading..." initially
- [ ] Sign in transitions to clickable button
- [ ] Sign in opens Clerk modal (not page navigation)
- [ ] Studio navigates to `/studio`
- [ ] Pro navigates to `/pro-promagen`
- [ ] Copy button copies prompt to clipboard
- [ ] Copy shows checkmark feedback

### 10.2 Sign In Button States

- [ ] `ssr` → Shows loading (grey, disabled)
- [ ] `loading` → Shows "Loading..." with pulse animation
- [ ] `timeout` → Shows "Sign in" linking to `/sign-in` (after 3s if Clerk fails)
- [ ] `ready` → Shows "Sign in" opening Clerk modal

### 10.3 Engine Bay Button

- [ ] Launch disabled when no platform selected
- [ ] Launch enabled when platform selected
- [ ] Launch navigates to `/providers/{id}`

### 10.4 Fallback Navigation (AuthButton)

- [ ] Shows "Loading..." during Clerk init
- [ ] Shows "Sign in" when signed out
- [ ] Shows user avatar when signed in
- [ ] Sign out works correctly

### 10.5 Environment Testing

- [ ] Works on localhost with `pk_test_` keys
- [ ] Works on promagen.com with `pk_live_` keys
- [ ] No console errors about "Production keys only allowed for domain"

---

## 11. File Location Summary

| Component               | File                                      | Key Lines |
| ----------------------- | ----------------------------------------- | --------- |
| Mission Control buttons | `src/components/home/mission-control.tsx` | 310-350   |
| Mission Control styles  | `src/components/home/mission-control.tsx` | 68-76     |
| Mission Control state   | `src/components/home/mission-control.tsx` | 84-118    |
| Mission Control render  | `src/components/home/mission-control.tsx` | 198-248   |
| Engine Bay launch       | `src/components/home/engine-bay.tsx`      | 320-365   |
| AuthButton              | `src/components/auth/auth-button.tsx`     | Full file |
| Fallback nav            | `src/components/layout/homepage-grid.tsx` | 307-333   |

---

## 12. Related Documents

| Topic           | Document             |
| --------------- | -------------------- |
| Mission Control | `mission-control.md` |
| Engine Bay      | `ignition.md`        |
| Homepage layout | `ribbon-homepage.md` |
| Code standards  | `code-standard.md`   |
| Authentication  | `clerk-auth.md`      |
| Paid tier logic | `paid_tier.md`       |

---

## Changelog

- **25 Jan 2026 (v1.1.0):** Major update - Clerk SignInButton implementation
  - Added §2 "CRITICAL: Clerk SignInButton Implementation" with full state machine pattern
  - Documented root cause of non-functional SignInButton (Clerk not loaded)
  - Added CSS layout constraints (flex-1 breaks SignInButton, use Grid)
  - Added environment variable requirements (pk*test* vs pk*live*)
  - Updated Mission Control to v3.2.11 implementation details
  - Updated Quick Reference table (Mission Control uses `<a href>` not `<Link>`)
  - Added common debugging scenarios specific to Clerk issues
  - Added environment testing checklist

- **25 Jan 2026 (v1.0.0):** Initial document
  - Comprehensive button inventory across all components
  - Canonical styling specification from §6.1
  - Approved deviations documented
  - Icon component reference
  - Route verification table
  - Accessibility requirements
  - Debugging guide
  - Testing checklist

---

_This document is the authority for ALL buttons in Promagen. Update this document FIRST before modifying any button behaviour._

_**Key principle:** Always update docs FIRST before writing any code. Docs are the single source of truth._

_**Critical reminder:** SignInButton MUST use the state machine pattern (§2.2). Rendering it without checking `clerk.loaded` will result in a non-functional button._
