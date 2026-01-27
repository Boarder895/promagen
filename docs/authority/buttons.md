# Buttons Authority Document

**Last updated:** 26 January 2026  
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

**Hard rule:** Before adding, modifying, or debugging any button, consult this document first.

---

## Quick Reference: All Buttons

| Location              | Button         | Destination         | Mechanism             |
| --------------------- | -------------- | ------------------- | --------------------- |
| Mission Control       | Sign in        | Clerk modal         | `<SignInButton>`      |
| Mission Control       | Studio / Home  | `/studio` or `/`    | `<Link>`              |
| Mission Control       | Pro            | `/pro-promagen`     | `<Link>`              |
| Mission Control       | Copy           | Clipboard           | `navigator.clipboard` |
| Engine Bay            | Launch         | `/providers/{id}`   | `<a href>`            |
| Engine Bay            | Provider icons | State update        | `onClick`             |
| Fallback Nav          | AuthButton     | Clerk modal         | `<SignInButton>`      |
| Fallback Nav          | Home           | `/`                 | `<a href>`            |
| Fallback Nav          | Studio         | `/studio`           | `<a href>`            |
| Fallback Nav          | Pro Promagen   | `/pro-promagen`     | `<a href>`            |
| **Studio Feature Cards** | Library     | `/studio/library`   | `<a href>`            |
| **Studio Feature Cards** | Explore     | `/studio/explore`   | `<a href>`            |
| **Studio Feature Cards** | Learn       | `/studio/learn`     | `<a href>`            |
| **Studio Feature Cards** | Playground  | `/studio/playground`| `<a href>`            |

---

## 1. Canonical Button Styling

**Authority:** `code-standard.md` §6.1

All buttons in Promagen use a single, consistent design language. The Sign In button is the canonical reference.

### 1.1 Default Button Style

```tsx
const buttonStyles =
  'inline-flex items-center justify-center gap-2 rounded-full border border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 px-4 py-1.5 text-sm font-medium text-purple-100 shadow-sm transition-all hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400 focus-visible:outline-none focus-visible:ring focus-visible:ring-purple-400/80';
```

### 1.2 Style Breakdown

| Property   | Value                                                                            | Purpose                             |
| ---------- | -------------------------------------------------------------------------------- | ----------------------------------- |
| Layout     | `inline-flex items-center justify-center gap-2`                                  | Centered content with icon gap      |
| Shape      | `rounded-full`                                                                   | Pill-shaped button                  |
| Border     | `border border-purple-500/70`                                                    | Subtle purple outline (70% opacity) |
| Background | `bg-gradient-to-r from-purple-600/20 to-pink-600/20`                             | Purple→pink gradient at 20% opacity |
| Text       | `text-sm font-medium text-purple-100`                                            | 14px, medium weight, light purple   |
| Padding    | `px-4 py-1.5`                                                                    | 16px horizontal, 6px vertical       |
| Shadow     | `shadow-sm`                                                                      | Subtle drop shadow                  |
| Transition | `transition-all`                                                                 | Smooth state changes                |
| Hover      | `hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400`          | Intensify gradient and border       |
| Focus      | `focus-visible:outline-none focus-visible:ring focus-visible:ring-purple-400/80` | Purple focus ring                   |

### 1.3 Reference Implementation

**File:** `src/components/auth/auth-button.tsx`  
**Line:** 65-66

```tsx
const signInButtonStyles =
  'inline-flex items-center justify-center gap-2 rounded-full border border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 px-4 py-1.5 text-sm font-medium text-purple-100 shadow-sm transition-all hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400 focus-visible:outline-none focus-visible:ring focus-visible:ring-purple-400/80';
```

### 1.4 Deviation Rules

Only deviate from canonical styling if:

1. User explicitly requests different styling
2. Context requires it (e.g., Engine Bay launch button has special gradient)
3. Accessibility requires it (e.g., larger hit area for touch targets)

**All deviations must be documented with a comment explaining why.**

### 1.5 Approved Deviations

| Component                  | Deviation                     | Reason                        | Lines                         |
| -------------------------- | ----------------------------- | ----------------------------- | ----------------------------- |
| Engine Bay Launch          | Sky/emerald/indigo gradient   | Visual hierarchy, primary CTA | `engine-bay.tsx:329-333`      |
| Mission Control (optional) | `py-2 min-h-[40px]`           | Improved touch target         | `mission-control.tsx:410-411` |
| Studio Feature Cards       | Rounded-2xl, slate background | Card-based navigation         | `studio-page-client.tsx`      |

---

## 2. Mission Control Buttons

**File:** `src/components/home/mission-control.tsx`  
**Authority:** `mission-control.md` §5 Action Buttons Row  
**Visibility:** Desktop XL only (`hidden xl:block` — ≥1280px)

### 2.1 Button Grid Layout

```tsx
{
  /* Action Buttons Row */
}
<div className="grid grid-cols-3 gap-2">
  {/* Sign In / Signed In */}
  {/* Studio or Home (context-dependent) */}
  {/* Pro / Pro Badge */}
</div>;
```

**File:** `src/components/home/mission-control.tsx`  
**Lines:** 575-637

### 2.2 Sign In Button

**Purpose:** Open Clerk authentication modal

**States:**

| State           | Visual        | Behaviour            |
| --------------- | ------------- | -------------------- |
| Unauthenticated | `👤 Sign in`  | Opens Clerk modal    |
| Authenticated   | `✓ Signed in` | Disabled, greyed out |

**Implementation (Unauthenticated):**

```tsx
<SignInButton mode="modal">
  <button type="button" className={actionButtonStyles} aria-label="Sign in to your account">
    <UserIcon />
    <span>Sign in</span>
  </button>
</SignInButton>
```

**File:** `src/components/home/mission-control.tsx`  
**Lines:** 588-597

**Implementation (Authenticated):**

```tsx
<div
  className={actionButtonStyles}
  style={{ opacity: 0.6, cursor: 'default' }}
  aria-disabled="true"
>
  <span className="text-emerald-400">✓</span>
  <span>Signed in</span>
</div>
```

**File:** `src/components/home/mission-control.tsx`  
**Lines:** 579-586

**Key points:**

- Uses `<SignInButton mode="modal">` from `@clerk/nextjs`
- Wraps a `<button type="button">` (required by Clerk)
- Does NOT use `<Link>` — Clerk handles the modal
- Authenticated state uses `<div>` not `<button>` (non-interactive)

### 2.3 Studio / Home Button (Context-Dependent)

**Purpose:** Navigate to Prompt Studio OR Homepage (context-dependent)

**Behaviour (v1.1.0):**

| Context         | Button Label | Destination | Prop                 |
| --------------- | ------------ | ----------- | -------------------- |
| Homepage (`/`)  | Studio       | `/studio`   | `isStudioPage=false` |
| Studio (`/studio`) | Home      | `/`         | `isStudioPage=true`  |

**Implementation:**

```tsx
<Link
  href={isStudioPage ? '/' : '/studio'}
  className={actionButtonStyles}
  prefetch={false}
  aria-label={isStudioPage ? 'Return to homepage' : 'Open Prompt Studio'}
>
  {isStudioPage ? <HomeIcon /> : <WandIcon />}
  <span>{isStudioPage ? 'Home' : 'Studio'}</span>
</Link>
```

**File:** `src/components/home/mission-control.tsx`  
**Lines:** 600-609

**Route files:**
- `/studio` → `src/app/studio/page.tsx`
- `/` → `src/app/page.tsx`

**Key points:**

- Uses Next.js `<Link>` component
- `prefetch={false}` prevents unnecessary preloading
- `isStudioPage` prop passed from `HomepageGrid` determines behaviour
- Swaps icon and label based on context

### 2.4 Pro Button

**Purpose:** Navigate to Pro Promagen page (free users) or show badge (paid users)

**Destination:** `/pro-promagen` (free users only)

**States:**

| State     | Visual                   | Behaviour                |
| --------- | ------------------------ | ------------------------ |
| Free user | `⭐ Pro` (purple border) | Links to `/pro-promagen` |
| Paid user | `⭐ Pro` (golden badge)  | Disabled, shows badge    |

**Implementation (Free User):**

```tsx
<Link
  href="/pro-promagen"
  className={actionButtonStyles}
  style={{ borderColor: 'rgba(168, 85, 247, 0.3)' }}
  prefetch={false}
  aria-label="View Pro Promagen features"
>
  <StarIcon />
  <span>Pro</span>
</Link>
```

**File:** `src/components/home/mission-control.tsx`  
**Lines:** 626-635

**Implementation (Paid User):**

```tsx
<div
  className={actionButtonStyles}
  style={{
    borderColor: 'rgba(234, 179, 8, 0.3)',
    background: 'rgba(234, 179, 8, 0.1)',
    cursor: 'default',
  }}
  aria-label="Pro user badge"
>
  <span className="text-amber-400">⭐</span>
  <span className="text-amber-400">Pro</span>
</div>
```

**File:** `src/components/home/mission-control.tsx`  
**Lines:** 613-624

**Route file:** `src/app/pro-promagen/page.tsx`

**Key points:**

- Free users: `<Link>` to `/pro-promagen`
- Paid users: Static `<div>` with golden styling (amber-400)
- `isPaidUser` prop determines which renders

### 2.5 Copy Button

**Purpose:** Copy weather prompt to clipboard

**Implementation:**

```tsx
const handleCopy = useCallback(async () => {
  if (!promptPreview?.prompt) return;
  try {
    await navigator.clipboard.writeText(promptPreview.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  } catch (err) {
    console.error('Failed to copy prompt:', err);
  }
}, [promptPreview?.prompt]);
```

**File:** `src/components/home/mission-control.tsx`  
**Lines:** 398-406 (handler), 530-566 (button UI)

**Visual states:**

- Default: Clipboard icon
- Copied: Checkmark icon (1.5s timeout)

### 2.6 Action Button Styles Variable

**File:** `src/components/home/mission-control.tsx`  
**Lines:** 408-411

```tsx
const actionButtonStyles =
  'inline-flex items-center justify-center gap-2 rounded-full border border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 px-4 py-2 min-h-[40px] text-sm font-medium text-purple-100 shadow-sm transition-all cursor-pointer hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/80 active:scale-95';
```

**Deviations from canonical §6.1:**

- `py-1.5` → `py-2` (larger vertical padding)
- Added `min-h-[40px]` (minimum height for touch targets)
- Added `cursor-pointer` (explicit cursor)
- Added `active:scale-95` (click feedback)
- `focus-visible:ring` → `focus-visible:ring-2` (thicker ring)

---

## 3. Engine Bay Buttons

**File:** `src/components/home/engine-bay.tsx`  
**Authority:** `ignition.md`  
**Visibility:** Desktop XL only (`hidden xl:block` — ≥1280px)

### 3.1 Launch Platform Builder Button

**Purpose:** Navigate to provider's prompt builder page

**Destination:** `/providers/{selected.id}`

**States:**

| State             | Visual                   | Behaviour              |
| ----------------- | ------------------------ | ---------------------- |
| No selection      | Greyed out, disabled     | No navigation          |
| Platform selected | Glowing gradient, active | Links to provider page |

**Implementation:**

```tsx
<a
  href={selected ? `/providers/${encodeURIComponent(selected.id)}` : '#'}
  onClick={(e) => {
    if (!selected) e.preventDefault();
  }}
  aria-disabled={!selected}
  aria-label={
    selected ? `Launch ${selected.name} prompt builder` : 'Select a platform first'
  }
  className={`group relative inline-flex w-1/2 items-center justify-center gap-2 overflow-hidden rounded-xl border px-4 py-3 text-center text-sm font-medium shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/80 no-underline ${
    selected
      ? 'engine-bay-active border-sky-400/60 bg-gradient-to-r from-sky-400/40 via-emerald-300/40 to-indigo-400/40 text-white cursor-pointer'
      : 'border-slate-600/50 bg-slate-800/50 text-slate-500 cursor-not-allowed'
  }`}
>
```

**File:** `src/components/home/engine-bay.tsx`  
**Lines:** 320-333

**Route file:** `src/app/providers/[id]/page.tsx`

**Key points:**

- Uses `<a href>` not `<Link>` (simpler for conditional href)
- `onClick` prevents navigation when no selection
- `encodeURIComponent()` sanitizes provider ID
- Special gradient styling (sky/emerald/indigo) — NOT canonical purple
- Has shimmer animation on hover when active

**Active state CSS class:**

```css
.engine-bay-active {
  animation: engine-bay-pulse 2s ease-in-out infinite;
}
```

**File:** `src/app/globals.css`  
**Lines:** 1813-1829

### 3.2 Provider Icon Buttons

**Purpose:** Select/deselect AI platform

**Implementation:**

```tsx
<button
  type="button"
  onClick={() => handleIconClick(provider)}
  className={`flex flex-col items-center gap-1 rounded-lg p-1 transition-all duration-200 hover:scale-105 ${
    isSelected ? 'ring-2 ring-offset-1 ring-offset-slate-950' : ''
  }`}
  style={isSelected ? { '--tw-ring-color': color } as React.CSSProperties : undefined}
  aria-pressed={isSelected}
  aria-label={`Select ${provider.name}`}
  title={provider.name}
>
```

**File:** `src/components/home/engine-bay.tsx`  
**Lines:** 262-277

**Handler:**

```tsx
const handleIconClick = useCallback((provider: Provider) => {
  setSelected((prev) => (prev?.id === provider.id ? null : provider));
}, []);
```

**File:** `src/components/home/engine-bay.tsx`  
**Lines:** 178-180

**Key points:**

- Uses `<button>` not `<a>` (state change, not navigation)
- Toggle behaviour (click again to deselect)
- Dynamic ring colour based on provider brand
- Hover scale effect

---

## 4. Fallback Navigation Buttons

**File:** `src/components/layout/homepage-grid.tsx`  
**Visibility:** Shows when Mission Control/Engine Bay are hidden (below xl breakpoint)

### 4.1 Overview

Fallback nav buttons appear in the mobile/tablet navigation bar when the desktop panels are hidden:

```
┌─────────────────────────────────────────────────────────────────┐
│  [AuthButton]   [Home]   [Studio]   [Pro Promagen]              │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 AuthButton

**Component:** `src/components/auth/auth-button.tsx`

Handles sign-in via Clerk modal when unauthenticated, shows user avatar when authenticated.

### 4.3 Home Button (Conditional)

**Purpose:** Navigate to homepage  
**Visibility:** Only shows on non-homepage routes

**Implementation:**

```tsx
<a
  href="/"
  className="inline-flex items-center justify-center gap-2 rounded-full border border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 px-4 py-1.5 text-sm font-medium text-purple-100 shadow-sm transition-all hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400"
  aria-label="Go to homepage"
>
  <HomeIcon />
  <span>Home</span>
</a>
```

**File:** `src/components/layout/homepage-grid.tsx`  
**Lines:** 310-318

### 4.4 Studio Button

**Purpose:** Navigate to Prompt Studio

**Implementation:**

```tsx
<a
  href="/studio"
  className="inline-flex items-center justify-center gap-2 rounded-full border border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 px-4 py-1.5 text-sm font-medium text-purple-100 shadow-sm transition-all hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400"
  aria-label="Open Prompt Studio"
>
  <WandIcon />
  <span>Studio</span>
</a>
```

**File:** `src/components/layout/homepage-grid.tsx`  
**Lines:** 320-328

### 4.5 Pro Promagen Button

**Purpose:** Navigate to Pro features page

**Implementation:**

```tsx
<a
  href="/pro-promagen"
  className="inline-flex items-center justify-center gap-2 rounded-full border border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 px-4 py-1.5 text-sm font-medium text-purple-100 shadow-sm transition-all hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400"
  aria-label="View Pro Promagen features"
>
  <StarIcon />
  <span>Pro Promagen</span>
</a>
```

**File:** `src/components/layout/homepage-grid.tsx`  
**Lines:** 330-338

**Key points for all fallback buttons:**

- Uses `<a href>` not `<Link>` — simpler, more reliable
- Same canonical styling as Mission Control buttons
- Always visible below xl breakpoint

---

## 5. Studio Page Feature Cards (NEW - 26 Jan 2026)

**File:** `src/app/studio/studio-page-client.tsx`  
**Authority:** `prompt-intelligence.md` §9 New Pages  
**Visibility:** All viewports (responsive 2-column grid on sm+)

### 5.1 Overview

The Studio hub page (`/studio`) displays 4 feature cards that navigate to sub-sections:

```
┌─────────────────────────────────────────────────────────────────┐
│  ┌───────────────────────┐  ┌───────────────────────┐          │
│  │ 📚 Library            │  │ 🔍 Explore            │          │
│  │ Your saved prompts    │  │ Style families        │          │
│  │ Explore →             │  │ Explore →             │          │
│  └───────────────────────┘  └───────────────────────┘          │
│  ┌───────────────────────┐  ┌───────────────────────┐          │
│  │ 🎓 Learn              │  │ 🎮 Playground         │          │
│  │ Prompt engineering    │  │ Experiment freely     │          │
│  │ Explore →             │  │ Explore →             │          │
│  └───────────────────────┘  └───────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Card Definitions

| Card       | Icon       | Title       | Description                    | Destination           |
| ---------- | ---------- | ----------- | ------------------------------ | --------------------- |
| Library    | 📚 (Book)  | Library     | Your saved prompts             | `/studio/library`     |
| Explore    | 🔍 (Search)| Explore     | Browse style families          | `/studio/explore`     |
| Learn      | 🎓 (Grad)  | Learn       | Master prompt engineering      | `/studio/learn`       |
| Playground | 🎮 (Game)  | Playground  | Experiment freely              | `/studio/playground`  |

### 5.3 Navigation Implementation

**CRITICAL:** Cards use native `<a>` tags, NOT Next.js `<Link>` components.

**Why native `<a>` tags:**
- Next.js `<Link>` components were failing to navigate (click events not firing)
- Root cause: Complex z-index stacking contexts with glow effects
- Native `<a>` tags are the most reliable form of navigation
- Full page reload is acceptable for this navigation pattern

**Implementation:**

```tsx
{studioSections.map((section) => {
  const CardContent = (
    <div className="group relative overflow-hidden rounded-2xl p-5 transition-all duration-500 cursor-pointer hover:ring-1 hover:ring-white/20">
      {/* Glow effect */}
      <div className="absolute inset-0 ... pointer-events-none" />
      
      {/* Content wrapper - z-10 ensures content is above glow */}
      <div className="relative z-10">
        {/* Icon */}
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br ...">
          {section.icon}
        </div>
        
        {/* Title */}
        <h3 className="text-base font-semibold text-white ...">
          {section.title}
        </h3>
        
        {/* Description */}
        <p className="text-sm text-white/50 ...">
          {section.description}
        </p>
        
        {/* Arrow CTA */}
        <div className="mt-3 text-white/30 ...">
          <span className="text-sm">Explore →</span>
        </div>
      </div>
    </div>
  );

  return section.available ? (
    <a key={section.href} href={section.href}>
      {CardContent}
    </a>
  ) : (
    <div key={section.href} className="opacity-60 cursor-not-allowed">
      {CardContent}
    </div>
  );
})}
```

**File:** `src/app/studio/studio-page-client.tsx`  
**Lines:** 380-450 (approx)

### 5.4 Route Files

All destination routes must exist:

| Route               | File                                  | Component            |
| ------------------- | ------------------------------------- | -------------------- |
| `/studio/library`   | `src/app/studio/library/page.tsx`     | `LibraryClient`      |
| `/studio/explore`   | `src/app/studio/explore/page.tsx`     | `ExploreClient`      |
| `/studio/learn`     | `src/app/studio/learn/page.tsx`       | `LearnClient`        |
| `/studio/playground`| `src/app/studio/playground/page.tsx`  | `PlaygroundWorkspace`|

### 5.5 Styling

**Card container:**

```tsx
className="group relative overflow-hidden rounded-2xl p-5 transition-all duration-500 cursor-pointer hover:ring-1 hover:ring-white/20"
style={{
  background: 'rgba(15, 23, 42, 0.7)',
  border: '1px solid rgba(255,255,255,0.1)',
}}
```

**Glow effect:**

```tsx
<div 
  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
  style={{
    background: `radial-gradient(circle at 50% 50%, ${section.glow}, transparent 70%)`,
  }}
/>
```

**Content wrapper (CRITICAL):**

```tsx
<div className="relative z-10">
  {/* All card content here - z-10 ensures it's clickable above glow */}
</div>
```

### 5.6 Test IDs

Each card has a test ID for automated testing:

```tsx
data-testid={`studio-card-${section.href.split('/').pop()}`}
```

Results in:
- `studio-card-library`
- `studio-card-explore`
- `studio-card-learn`
- `studio-card-playground`

### 5.7 Debugging Navigation Issues

If cards stop navigating:

1. **Check DevTools Console** — Look for JavaScript errors
2. **Check Network tab** — Click card, see if request fires
3. **Inspect element** — Verify `<a href="/studio/library">` exists
4. **Check z-index** — Content must have `z-10`, glow must have `pointer-events-none`
5. **Check for overlays** — No elements should be blocking clicks

**Key principle:** Native `<a>` tags cannot fail unless something is intercepting them or the element isn't rendering.

---

## 6. AuthButton Component (Canonical Sign In)

**File:** `src/components/auth/auth-button.tsx`  
**Authority:** `code-standard.md` §6.1

### 6.1 States

| State             | Visual                    | Implementation |
| ----------------- | ------------------------- | -------------- |
| SSR / Not mounted | `Loading...` (disabled)   | Lines 217-224  |
| Clerk loading     | `Loading...` (disabled)   | Lines 237-244  |
| Timed out         | `Sign in` (link fallback) | Lines 227-234  |
| Signed out        | `Sign in` (Clerk modal)   | Lines 266-273  |
| Signed in         | User avatar               | Lines 247-263  |

### 6.2 Clerk Integration

```tsx
import { SignInButton, UserButton, useClerk } from '@clerk/nextjs';
```

**SignInButton usage:**

```tsx
<SignInButton mode="modal">
  <button type="button" className={signInButtonStyles}>
    <UserIcon />
    Sign in
  </button>
</SignInButton>
```

**UserButton usage (signed in):**

```tsx
<UserButton
  appearance={{
    elements: {
      avatarBox: 'h-8 w-8 ring-2 ring-purple-500/50 hover:ring-purple-400',
      // ... styling
    },
  }}
  afterSignOutUrl="/"
/>
```

### 6.3 Timeout Fallback

If Clerk doesn't load within 3 seconds, shows a direct link:

```tsx
<a href="/sign-in" className={signInButtonStyles}>
  <UserIcon />
  Sign in
</a>
```

**File:** `src/components/auth/auth-button.tsx`  
**Lines:** 227-234

---

## 7. Route Reference

All button destinations must have corresponding route files.

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

## 8. Icon Components

Buttons use inline SVG icons for consistency. Each icon component returns a `<svg>` element.

### 8.1 Icon Reference

| Icon       | Component       | Used In                          | File                              |
| ---------- | --------------- | -------------------------------- | --------------------------------- |
| User       | `<UserIcon />`  | Sign in button                   | `auth-button.tsx`, inline         |
| Wand       | `<WandIcon />`  | Studio button                    | `mission-control.tsx`, inline     |
| Star       | `<StarIcon />`  | Pro button                       | `mission-control.tsx`, inline     |
| Clipboard  | `<ClipboardIcon />` | Copy button                  | `mission-control.tsx`, inline     |
| Check      | `<CheckIcon />` | Copy success                     | `mission-control.tsx`, inline     |
| Home       | `<HomeIcon />`  | Home button (fallback/context)   | `homepage-grid.tsx`, inline       |
| Book       | `<BookIcon />`  | Library card                     | `studio-page-client.tsx`, inline  |
| Search     | `<SearchIcon />` | Explore card                    | `studio-page-client.tsx`, inline  |
| GraduationCap | `<GraduationCapIcon />` | Learn card         | `studio-page-client.tsx`, inline  |
| Gamepad    | `<GamepadIcon />`| Playground card                 | `studio-page-client.tsx`, inline  |

### 8.2 Icon Standards

- Size: 16×16px default (`h-4 w-4`), 20×20px for cards (`h-5 w-5`)
- Stroke: `currentColor` (inherits text colour)
- Stroke width: 1.5 or 2
- No fill (outline icons only)

---

## 9. Debugging Guide

### 9.1 Button Not Clicking

**Check:**

1. `onClick` handler exists and isn't `undefined`
2. No overlay covering button (`pointer-events-none` on overlays)
3. Button isn't disabled (`aria-disabled`, `disabled` attribute)
4. Z-index stacking context (content should be `z-10` above decorative elements)

### 9.2 Navigation Not Working

**Check:**

1. Route exists (`src/app/{route}/page.tsx`)
2. Using correct mechanism:
   - `<Link>` for internal routes (client-side navigation)
   - `<a href>` for reliable navigation (full page reload)
3. `prefetch` issues — Try `prefetch={false}`
4. `href` value — Console.log the href

**If `<Link>` fails, use `<a href>` instead** — native anchors are more reliable.

### 9.3 Clerk Modal Not Opening

**Check:**

1. `<SignInButton>` wraps a `<button>`, not `<a>` or `<div>`
2. Clerk provider is in `layout.tsx`
3. Environment variables set (`NEXT_PUBLIC_CLERK_*`)

### 9.4 Styling Not Applying

**Check:**

1. Tailwind classes spelled correctly
2. Not conflicting with parent styles
3. CSS specificity (use browser dev tools)

---

## 10. Testing Checklist

### 10.1 Mission Control Buttons

- [ ] Sign in opens Clerk modal (unauthenticated)
- [ ] Sign in shows "✓ Signed in" disabled (authenticated)
- [ ] Studio navigates to `/studio` (from homepage)
- [ ] Home navigates to `/` (from Studio page)
- [ ] Pro navigates to `/pro-promagen` (free user)
- [ ] Pro shows golden badge (paid user)
- [ ] Copy button copies prompt to clipboard
- [ ] Copy shows checkmark feedback

### 10.2 Engine Bay Button

- [ ] Launch disabled when no platform selected
- [ ] Launch enabled when platform selected
- [ ] Launch navigates to `/providers/{id}`
- [ ] Pulse animation runs when active
- [ ] Shimmer appears on hover when active

### 10.3 Fallback Navigation

- [ ] AuthButton shows Sign in / Avatar correctly
- [ ] Home button appears on non-homepage pages
- [ ] Studio navigates to `/studio`
- [ ] Pro Promagen navigates to `/pro-promagen`

### 10.4 Studio Feature Cards (NEW)

- [ ] Library card navigates to `/studio/library`
- [ ] Explore card navigates to `/studio/explore`
- [ ] Learn card navigates to `/studio/learn`
- [ ] Playground card navigates to `/studio/playground`
- [ ] Hover glow effect visible on all cards
- [ ] Cards use native `<a>` tags (not `<Link>`)

### 10.5 Accessibility

- [ ] All buttons keyboard focusable
- [ ] Focus ring visible on focus
- [ ] Screen reader announces button labels
- [ ] Disabled buttons have `aria-disabled`

---

## 11. File Location Summary

| Component                  | File                                      | Key Lines            |
| -------------------------- | ----------------------------------------- | -------------------- |
| Mission Control buttons    | `src/components/home/mission-control.tsx` | 575-637              |
| Mission Control styles     | `src/components/home/mission-control.tsx` | 408-411              |
| Mission Control icons      | `src/components/home/mission-control.tsx` | 236-291              |
| Engine Bay launch          | `src/components/home/engine-bay.tsx`      | 320-365              |
| Engine Bay icons           | `src/components/home/engine-bay.tsx`      | 262-296              |
| Engine Bay animations      | `src/app/globals.css`                     | 1812-1889            |
| AuthButton                 | `src/components/auth/auth-button.tsx`     | Full file            |
| Fallback nav               | `src/components/layout/homepage-grid.tsx` | 307-333              |
| **Studio feature cards**   | `src/app/studio/studio-page-client.tsx`   | 380-450              |
| Canonical button style     | `code-standard.md`                        | §6.1 (lines 349-377) |

---

## 12. Related Documents

| Topic           | Document                     |
| --------------- | ---------------------------- |
| Mission Control | `mission-control.md`         |
| Engine Bay      | `ignition.md`                |
| Homepage layout | `ribbon-homepage.md`         |
| Code standards  | `code-standard.md` §6.1      |
| Authentication  | `clerk-auth.md`              |
| Paid tier logic | `paid_tier.md`               |
| Studio routes   | `prompt-intelligence.md` §9  |

---

## Changelog

- **26 Jan 2026 (v1.1.0):** **STUDIO FEATURE CARDS** — Added Section 5 documenting the 4 Studio hub navigation cards (Library, Explore, Learn, Playground). Cards use native `<a>` tags instead of Next.js `<Link>` components due to navigation failures caused by z-index stacking contexts with glow effects. Added `isStudioPage` prop to Mission Control that swaps Studio↔Home button based on context. Updated Quick Reference table with new buttons. Added testing checklist for Studio cards.

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
