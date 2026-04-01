# mobile.md — Promagen Mobile Build Authority Document

**Version:** 1.0.0
**Date:** 1 April 2026
**Author:** Martin Yarnold (design/architecture) + Claude (implementation)
**SSOT:** `src.zip` — all claims in this document verified against extracted source

---

## 1. Strategic Decision

**Decision (1 Apr 2026):** "Option A — Shop Window Mobile." Mobile is a polished read-only showcase that funnels visitors to desktop. Not a full mobile app. The prompt builder requires screen real estate that phones cannot provide. Mobile exists to impress, convert, and redirect.

**Before this build:** Mobile was a dead end. The homepage showed the leaderboard and an amber "go away" message. No navigation. Every non-homepage page was broken — content stacked vertically with no scroll, no header, no way to navigate. The Pro page was completely unusable.

**After this build:** Mobile is a professional shop window. Every page is reachable. The Pro page previews work with auto-scrolling content. Builder pages show a phantom scroll preview behind a frosted CTA. The leaderboard cards expand on tap. Portrait phones get a rotate prompt.

---

## 2. Breakpoint System

| Tier    | Range      | Behaviour                                                       |
| ------- | ---------- | --------------------------------------------------------------- |
| Mobile  | 0–767px    | Single column, page scrolling, mobile bottom nav, portrait lock |
| Tablet  | 768–1279px | Three-column grid, no Engine Bay/Mission Control, fallback nav  |
| Desktop | 1280px+    | Full experience — all rails, all features                       |

**All mobile changes are gated behind `md:hidden` / `@media (max-width: 767px)`.** Zero impact on desktop or tablet rendering. Every file preserves existing features above 768px.

---

## 3. File Inventory — New Files Created

### 3.1 `src/components/layout/mobile-bottom-nav.tsx` (219 lines)

**Purpose:** Persistent 4-item bottom navigation bar visible on all pages below 768px.

**Navigation items:**

- **Home** (`/`) — house icon, filled when active
- **Pro** (`/pro-promagen`) — sparkle icon
- **Lab** (`/studio/playground`) — flask icon + "Desktop" badge (signals this feature requires desktop)
- **Saved** (`/studio/library`) — bookmark icon

**Design details:**

- Glass-dark bar: `rgba(2, 6, 23, 0.95)` + `backdrop-filter: blur(20px)`
- Shadow: `0 -4px 24px rgba(0, 0, 0, 0.5)` — lifts visually above content
- Active state: sky-400 (`#38bdf8`) icon + gradient accent bar (sky → emerald → indigo) above icon
- Inactive state: `rgba(255, 255, 255, 0.65)`
- Horizontal layout: items in a single row with `flex-row`, `gap-1`
- Compact height: `padding: clamp(3px, 0.8vw, 5px) 0`
- Icons: `clamp(14px, 3.5vw, 18px)` square
- Labels: `clamp(0.5rem, 2vw, 0.6rem)`
- Badge text: `clamp(0.4rem, 1.5vw, 0.45rem)` with border ring
- Safe area: `paddingBottom: env(safe-area-inset-bottom, 0px)` — accounts for iPhone home indicator
- Hidden on tablet+: `md:hidden` on the `<nav>` element
- Active detection: exact match for `/`, prefix match for all other routes

**Verified in `src/app/layout.tsx`:** Imported at line 12, rendered at line 106 inside the flex column wrapper, after the content area.

### 3.2 `src/components/layout/portrait-lock-overlay.tsx` (97 lines)

**Purpose:** Full-screen rotate prompt on portrait phones. Pure CSS — zero JavaScript, zero hydration cost.

**Trigger:** `@media (orientation: portrait) and (max-width: 767px)` — only phones in portrait. Desktop, tablet, and landscape phones never see it.

**Design details:**

- Full-screen fixed overlay: `z-index: 9999`
- Background: `rgba(2, 6, 23, 0.97)` + blur(20px) — nearly opaque
- Phone icon: SVG rect + dot, `clamp(48px, 12vw, 64px)` in sky-400
- Animated rotation: `portraitRotateHint` keyframes — 0° → -90° → 0° over 3s
- Heading: gradient text (sky → emerald → indigo), `clamp(1.1rem, 4.5vw, 1.4rem)`
- Body: "Promagen is built for landscape viewing. Turn your phone sideways for the best experience."
- Accessibility: `prefers-reduced-motion: reduce` sets icon to static -90° rotation, no animation
- `aria-live="polite"` on the overlay div

**Verified in `src/app/layout.tsx`:** Imported at line 13, rendered at line 76 as first child inside PauseProvider.

### 3.3 `src/components/layout/mobile-builder-gate.tsx` (256 lines)

**Purpose:** "Phantom Scroll Preview" gate for builder pages (Prompt Lab, provider prompt builder). On mobile, the real builder UI renders at 55% scale behind a frosted glass overlay. The builder is `pointer-events: none` — purely visual. A CTA sits on top.

**Architecture:**

- **Desktop (≥768px):** Component renders `md:contents` — zero overhead, children render normally in the DOM flow
- **Mobile (<768px):** Two layers:
  1. **Gate card** — heading, description, feature bullets, purple CTA button ("See what Pro unlocks" or provider-specific)
  2. **Phantom preview** — the REAL builder children rendered at `transform: scale(0.55)` with `pointer-events: none`, behind a frosted glass overlay (`backdrop-filter: blur(4px)`) with a shimmer animation

**Shimmer animation:** `phantomShimmer` keyframes — 4s ease-in-out infinite, gradient sweep from left to right. Respects `prefers-reduced-motion`.

**"Preview" label:** Positioned bottom-right of the phantom window, purple gradient badge.

**Props:**

- `heading: string` — gate card title
- `description: string` — short description
- `features: string[]` — 3–4 bullet points
- `children: ReactNode` — desktop content (also used as phantom preview)

**Verified in `src/app/studio/playground/playground-page-client.tsx`:** Imported line 37, wrapping centre content at line 137–151 with Prompt Lab copy + 4 feature highlights.

**Verified in `src/components/providers/provider-page-client.tsx`:** Imported line 29, wrapping centre content at line 131–145 with provider-specific copy (shows provider name).

---

## 4. File Inventory — Modified Files

### 4.1 `src/app/layout.tsx`

**Changes:**

- Line 12–13: Added imports for `MobileBottomNav` and `PortraitLockOverlay`
- Line 76: `PortraitLockOverlay` rendered as first child inside PauseProvider
- Lines 91–106: Content wrapped in `div.flex.h-full.flex-col` with `div.min-h-0.flex-1` for content + `MobileBottomNav` after

**Layout structure (mobile):**

```
body (h-dvh overflow-hidden)
  └── ClerkProvider → PauseProvider
       ├── PortraitLockOverlay (z-9999, portrait only)
       └── div.flex.h-full.flex-col
            ├── div.min-h-0.flex-1 (content area — all pages render here)
            └── MobileBottomNav (md:hidden, shrink-0)
```

The `min-h-0 flex-1` on the content area means it fills all space between the top of the viewport and the bottom nav. The `flex-col` parent distributes: content gets everything except nav height.

### 4.2 `src/components/layout/homepage-grid.tsx`

**Purpose:** Shared layout wrapper used by homepage and all other pages. Controls the three-column grid, rails, and header.

**Mobile changes:**

**Scrolling:**

- Outer div: `h-dvh` → `h-full` (respects layout's flex parent instead of claiming full viewport)
- Added `overflow-y-auto` + scrollbar classes on mobile, `md:overflow-hidden` on desktop
- Page scrolls naturally on mobile; locked viewport on desktop

**Flex constraints:**

- Main/section/centre/providers: `min-h-0 flex-1` → `md:min-h-0 md:flex-1` — natural height on mobile (content flows), locked on desktop

**Rails hidden on ALL pages on mobile:**

- Left column: `hidden md:flex` (always hidden on mobile, shown on desktop)
- Right column: `hidden md:flex` (same)
- Previously used `isHomepage` conditional — removed. Rails are hidden on ALL pages on mobile.

**Mobile header (single row, all pages):**

- Line 716: `<div className="md:hidden">` — mobile-only header block
- Layout: `flex items-center justify-between` — heading left, sign-in right
- Heading: gradient text (sky → emerald → indigo), `clamp(0.85rem, 3vw, 1.1rem)`
- AuthButton: `shrink-0` with forced white text via descendant selectors
- Desktop header: `hidden md:block` (line 736) — completely separate block for desktop

**Hero padding tightened:**

- `clamp(4px, 1.5vw, 8px) clamp(8px, 2vw, 16px)` — saves vertical space on mobile

**Amber "go away" message:** Removed entirely. Mobile users see the same heading as desktop users.

### 4.3 `src/components/home/new-homepage-client.tsx`

**Changes:**

**Prompt Showcase visible on mobile:**

- Line 231: Removed `hidden md:block` wrapper — `PromptShowcase` now renders on all screen sizes
- Centre rail + leaderboard section: `md:h-full md:min-h-0` (natural height on mobile, locked on desktop)

**Mobile Conversion Bridge (line 245):**

- `md:hidden` — only shows below 768px
- Sits between Prompt Showcase and leaderboard
- Copy: "That prompt was built by the Promagen engine. 40 platforms. 4 quality tiers. Zero guesswork."
- Path A: Purple CTA button → `/pro-promagen` ("See what Pro unlocks")
- Path B: Subtle text — "The full builder is a desktop experience"
- Glass card: `rounded-2xl border border-white/[0.08] bg-slate-950/60`
- Hidden when leaderboard is expanded (`!isTableExpanded` guard)

### 4.4 `src/components/home/prompt-showcase.tsx`

**Clamp fixes for mobile readability:**

- Countdown/city text: `clamp(0.1rem, 0.75vw, 1rem)` → `clamp(0.7rem, 0.9vw, 1rem)` — was invisible on mobile (0.1rem = 1.6px)
- Flag size: `clamp(20px, 1.5vw, 24px)` × `clamp(15px, 1.1vw, 18px)` — bumped from smaller values

### 4.5 `src/components/providers/providers-table.tsx` — Tap-to-Discover

**New state:** `expandedMobileCard` — tracks which provider card is expanded (one at a time)

**Mobile card behaviour:**

- All cards: `role="button"`, `onClick` toggles expansion, `aria-expanded`
- Tapping a card expands Row 3: sky-blue tagline + purple "Build prompts for [provider] →" link
- Smooth animation: `max-height` transition (0px ↔ 120px, 250ms ease-out) + opacity transition
- One card at a time: tapping a new card closes the previous
- `e.stopPropagation()` on the builder link prevents collapsing when tapping the CTA

**Grey colour fix (verified in `src/app/globals.css`):**

- `.providers-mobile-rank`: `#64748b` → `#38bdf8` (sky-400)
- `.providers-mobile-details`: `#94a3b8` → `#e2e8f0` (slate-200)
- No grey text anywhere on mobile cards — all bright colours per code standard

### 4.6 `src/components/pro-promagen/feature-control-panel.tsx`

**Mobile click behaviour (line ~291):**

- `handleClick`: detects mobile via `window.innerWidth < 768`
- On mobile: ALWAYS toggles preview (`setIsHovered(!isHovered)` + `onHoverChange`), never navigates
- On desktop: navigates if card has an action, otherwise toggles preview
- `handleKeyDown`: works for all cards (Enter/Space), not just action cards
- All cards: `role="button"`, `tabIndex={0}`, `cursor-pointer`

**Mobile grid CSS (line ~291):**

```css
@media (max-width: 767px) {
  .feature-grid {
    grid-template-columns: repeat(2, 1fr);
    grid-template-rows: auto;
    height: auto;
    gap: 8px;
  }
  .feature-grid > :nth-child(n + 7) {
    display: flex;
  }
}
```

- 2-column grid with auto height — all 9 feature cards visible
- Overrides the desktop `max-height: 820px` rule that hides cards 7–9
- `promptLimit` hardcoded to 3 for display (matches desktop anonymous view)

### 4.7 `src/app/pro-promagen/pro-promagen-client.tsx` — The Pro Page

This file received the most mobile work. Changes fall into three categories.

#### 4.7.1 Mobile CSS Override Block (in `<style>` tag)

**iOS Safari Visibility Fix (research: WebKit Bug #248145, #250900, r289498):**

**Root cause discovered through deep research:** `display:none` removes elements from the render tree on iOS Safari. After `display:none → display:flex` toggling, iOS Safari defers layout more aggressively than desktop browsers. `scrollHeight` and `clientHeight` return 0. CSS variables in `@keyframes` don't resolve (WebKit Bug #248145). ResizeObserver doesn't fire initial callbacks (WebKit Bug #250900). Result: the `useAutoScroll` hook measures 0 overflow, sets `scrollDist = 0`, and the CSS `proAutoScroll` animation resolves `translateY(0)` — no movement.

**Fix:** On mobile, never use `display:none`. All 10 preview panel divs are always `display:flex`. Inactive panels use `opacity:0 + position:absolute + pointer-events:none`. Active panel uses `opacity:1 + position:relative + pointer-events:auto`. Elements stay in the render tree with valid dimensions. All existing CSS animations (`proAutoScroll`, `dailyScrollDown`, `imagegenReveal`, `imagegenProgressBar`) fire automatically because `useAutoScroll` hooks measure real `scrollHeight` and `clientHeight` values.

```css
@media (max-width: 767px) {
  /* Feature Control Panel: natural height, all cards visible */
  [data-testid="pro-promagen-panel"] .pro-fcp-wrapper {
    flex: none !important;
    overflow: visible !important;
    min-height: auto !important;
  }

  /* Preview wrapper: fixed viewport height, clips content */
  [data-testid="pro-promagen-panel"] .pro-preview-wrapper {
    flex: none !important;
    height: 65svh !important;
    min-height: 200px !important;
    overflow: hidden !important;
    position: relative !important; /* ← for absolute children */
  }

  /* ALL panel divs stay in render tree — NEVER display:none */
  [data-testid="pro-promagen-panel"] .pro-preview-wrapper > [data-panel] {
    display: flex !important; /* ← overrides inline display:none */
    flex-direction: column !important;
    height: 100% !important;
    position: absolute !important; /* ← stacked, no space */
    inset: 0 !important;
    opacity: 0; /* ← invisible */
    pointer-events: none; /* ← non-interactive */
  }

  /* Active panel: visible and in normal flow */
  [data-testid="pro-promagen-panel"]
    .pro-preview-wrapper
    > [data-panel][data-active] {
    opacity: 1;
    pointer-events: auto;
    position: relative !important; /* ← takes space */
  }
}
```

**Desktop compatibility:** The `@media (max-width: 767px)` gate means none of these rules apply above 768px. Desktop continues using the original `display: none/flex` toggling which works fine on desktop browsers.

#### 4.7.2 Panel Div Data Attributes

All 10 inner panel divs received `data-panel` and `data-active` attributes for mobile CSS targeting:

```tsx
<div data-panel="daily"
     data-active={activePanel === 'daily' ? '' : undefined}
     style={{ display: activePanel === 'daily' ? 'flex' : 'none', ... }}>
```

Panels: `daily`, `format`, `scenes`, `saved`, `lab`, `exchanges`, `frame`, `imagegen`, `intelligence`, `cta`.

The `data-active` attribute is present (empty string) when the panel is active, absent when inactive. CSS `[data-active]` selector matches presence of the attribute. The inline `display: none/flex` style is preserved for desktop; the CSS `!important` override forces `display: flex` on mobile.

#### 4.7.3 Mobile Preview Lifecycle (`useEffect` on `activePanel`)

**Guard:** Skipped when `window.innerWidth >= 768` — desktop unaffected.

**Step 1 — Scroll into view (200ms delay):**

```ts
previewPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
```

The Pro page scrolls on mobile (FCP flows naturally, then preview wrapper below). When a feature is tapped, the preview scrolls into view.

**Step 2 — Touch-to-reset (1.5s delay):**

- `touchstart` listener attached after 1500ms — prevents catching the finger lift from the initial tap
- On touch: sets `touchResetCooldownRef.current = true` for 500ms, calls `setActivePanel(null)`, scrolls back to feature grid
- The 500ms cooldown prevents `handleCardHover` from immediately opening a new panel when the touch event propagates to the feature card underneath

**Touch Reset Cooldown (`touchResetCooldownRef`):**

- Declared as `useRef(false)` alongside `touchResetCooldownTimerRef`
- Set to `true` in `handleTouchReset`, reset to `false` after 500ms timeout
- Checked in `handleCardHover`: `if (touchResetCooldownRef.current) return;` — blocks all panel activations during cooldown
- Same pattern as existing `dropdownCooldownRef`

**Auto-scroll:** NOT handled by the lifecycle. The existing `useAutoScroll` hooks + CSS `proAutoScroll` / `dailyScrollDown` / `imagegenReveal` / `imagegenProgressBar` animations work automatically because elements are always in the render tree (opacity-based visibility, not display:none). No WAAPI. No forced reflow. No MutationObserver. The CSS-based auto-scroll system works identically on mobile and desktop because the root cause (display:none) was eliminated.

### 4.8 `src/app/sign-in/[[...sign-in]]/page.tsx`

**Change:** `min-h-full` → `h-full` on the outer div.

**Why:** With `min-h-full`, the div grows beyond the parent's constrained height (the `min-h-0 flex-1` content area). The content never overflows, so `overflow-y-auto` never triggers a scrollbar. With `h-full`, the div fills exactly the parent's height. If the Clerk card is taller, it overflows and the scrollbar appears.

Also: `py-8` → `py-4` (tighter vertical padding on mobile).

### 4.9 `src/app/sign-up/[[...sign-up]]/page.tsx`

**Change:** `min-h-dvh` → `h-full` + `overflow-y-auto` + `py-4` + scrollbar classes.

Same fix as sign-in: `min-h-dvh` ignored parent constraints entirely (claimed full viewport height regardless of nav bar).

### 4.10 `src/app/providers/[id]/prompt-builder/layout.tsx`

**Change:** `h-dvh` → `h-full` on the outer div.

**Why:** `h-dvh` claimed the full viewport height, ignoring the mobile bottom nav. The builder page extended behind the nav. `h-full` respects the parent's flex constraints, stopping above the nav bar.

### 4.11 `src/app/globals.css`

**Mobile-specific colour fixes:**

- `.providers-mobile-rank`: colour changed from slate-500 (`#64748b`) to sky-400 (`#38bdf8`)
- `.providers-mobile-details`: colour changed from slate-400 (`#94a3b8`) to slate-200 (`#e2e8f0`)

Per code standard: NO GREY TEXT anywhere on any user-facing UI.

---

## 5. iOS Safari Deep Research — Reference

A detailed research document was produced during this build:

**Document:** `Why_CSS_translateY_Animations_Break_on_iOS_Safari_After_Display_None.md`

**Summary of findings:**

Three compounding WebKit bugs prevent CSS `@keyframes` animations from starting inside containers toggled from `display:none` to `display:flex`:

1. **WebKit defers layout** after display toggle — `scrollHeight`/`clientHeight` return 0 even after arbitrary timeouts
2. **WebKit Bug #248145** — CSS variables in `@keyframes` don't resolve at animation start time. Commit `5c0b3cb` added `containsCSSVariableReferences()` detection but edge cases persist
3. **WebKit Bug #250900** — ResizeObserver `lastReportedSize` initialized to 0×0 instead of spec-required -1×-1, meaning the initial callback doesn't fire for elements transitioning from display:none

Additional: `svh` units unreliable on iOS (WebKit Bug #261185) — `svh` and `dvh` sometimes equal when Safari tab bar is not visible.

**Solution applied:** Replace `display:none` with `opacity:0` on mobile (CSS `!important` overrides). Elements stay in render tree → valid dimensions → all CSS animations work. This is the research-recommended #1 fix.

**Approaches tried and failed (documented for future reference):**

1. Relying on `useAutoScroll` ResizeObserver + 2s interval → measurements return 0 on iOS Safari
2. Direct DOM manipulation (`el.style.animation` + `el.style.setProperty('--scroll-dist')`) → WebKit Bug #248145 prevents CSS variable resolution
3. Web Animations API (WAAPI) with forced reflow + double-rAF → correct approach but over-engineered; eliminating `display:none` made it unnecessary
4. JS `requestAnimationFrame` scrollTop loop → different scroll mechanism, fought existing CSS system

---

## 6. Page-by-Page Mobile Behaviour

### Homepage (`/`)

- Prompt Showcase visible (countdown, city, flag, prompt text)
- Conversion bridge below showcase: "40 platforms. 4 quality tiers. Zero guesswork." + purple CTA
- Leaderboard cards: tap to expand (tagline + "Build prompts for [provider]" link)
- Rails hidden. Single-column layout. Page scrolls naturally.

### Pro Promagen (`/pro-promagen`)

- Feature Control Panel: 2-column grid, all 9 cards visible, tap to preview
- Preview panel: 65svh fixed height, auto-scrolling content (CSS translateY)
- Tap feature → page scrolls to preview → content auto-scrolls → touch anywhere (after 1.5s) → resets to grid
- Touch cooldown: 500ms block on `handleCardHover` after reset prevents accidental re-open
- All 10 panels stay in render tree (opacity-based visibility) — animations work on iOS Safari

### Prompt Lab (`/studio/playground`)

- Phantom Scroll Preview: real builder UI at 55% scale behind frosted glass
- Gate card: heading, description, 4 feature bullets, purple CTA
- Shimmer animation on frosted overlay (4s cycle)
- "Preview" label bottom-right

### Provider Prompt Builder (`/providers/[id]/prompt-builder`)

- Same Phantom Scroll Preview as Prompt Lab
- Provider-specific copy (shows provider name in heading and CTA)

### Saved Prompts (`/studio/library`)

- Standard mobile layout: single column, page scrolls, bottom nav

### Sign In / Sign Up (`/sign-in`, `/sign-up`)

- `h-full overflow-y-auto` — scrollable within the content area
- Clerk card centred vertically when space allows, scrollable when it doesn't

### All Other Pages

- Rails hidden, single-column centre content, page scrolls, bottom nav visible

---

## 7. Design Standards Applied

| Rule                         | Implementation                                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| No grey text                 | All muted greys replaced with sky-400, slate-200, white, or brand colours                    |
| All clamp() sizing           | Every font-size, icon dimension, padding, gap uses `clamp()`                                 |
| cursor-pointer on clickables | All feature cards, leaderboard cards, CTAs, nav items                                        |
| No mobile layouts            | No mobile breakpoints, no responsive columns — landscape phone only                          |
| Portrait lock                | CSS-only overlay forces landscape on phones                                                  |
| No fixed px/rem              | Every dimension uses `clamp(min, preferred, max)`                                            |
| Safe area insets             | Bottom nav respects `env(safe-area-inset-bottom)` for iPhone home indicator                  |
| prefers-reduced-motion       | Portrait lock animation, phantom shimmer, all auto-scroll animations respect user preference |

---

## 8. Known Limitations & Future Work

1. **`svh` units on iOS:** WebKit Bug #261185 means `65svh` may not be accurate on all iOS versions. A future improvement would compute viewport height via `window.visualViewport.height` in JavaScript and set it as a CSS variable.

2. **Clerk modal sign-in:** The `/sign-in` route scrolls correctly, but Clerk modal overlays (triggered from other pages) may not. Needs testing per-route.

3. **Drawer deferred features (from evolution-plan-v2):** Tier badges and cascade relevance chip ordering were deferred — must ship before evolution plan build ends.

4. **Daily Prompts on mobile:** Uses its own scroll mechanism (`dailyScrollDown` + custom rotation logic with provider cycling). The opacity-based visibility fix ensures it works, but the panel has complex internal state (visible check, provider rotation timers, compression flash) that could benefit from simplification.

5. **Performance consideration:** All 10 preview panels are `display:flex` on mobile (opacity-hidden). This means all panels render and their internal components mount. The original `display:none` approach existed to avoid this cost. In practice, the panels are lightweight (no network requests, no heavy computation), but monitor bundle size and render time if more panels are added.

---

## 9. Verification Checklist

Test on a real iPhone in landscape:

- [ ] **Homepage:** Prompt Showcase visible with readable text and flag. Conversion bridge below. Leaderboard cards expand on tap.
- [ ] **Pro page:** 2-column feature grid shows all 9 cards. Tap any card → page scrolls to preview → content auto-scrolls. Touch screen after 1.5s → resets to grid without opening a new preview.
- [ ] **Prompt Lab:** Phantom preview visible at 55% scale behind frosted glass. CTA button tappable.
- [ ] **Provider page:** Same phantom preview with provider-specific copy.
- [ ] **Sign in/up:** Clerk card scrollable if content exceeds viewport.
- [ ] **Portrait:** Full-screen rotate overlay with animated phone icon.
- [ ] **Navigation:** Bottom nav visible on all pages. Active state shows sky-400 + gradient bar. All 4 items navigate correctly.
- [ ] **Desktop:** Zero visual or behavioural changes at ≥768px.
