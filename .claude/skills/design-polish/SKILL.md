---
name: design-polish
description: Apply when adding, changing, or reviewing UI on Promagen. Codifies the live design system observed in `frontend/src/app/globals.css`, `frontend/src/app/layout.tsx`, the Sentinel components, the leaderboard table, top-nav, mobile bottom-nav, and footer. Keeps new UI consistent with Promagen's commercial surface and prevents drift, regressions, and accessibility breakage.
type: workflow
---

# design-polish — Promagen design system

This skill captures Promagen's actual design system as it lives in code. It is **descriptive** (extracted from `globals.css`, `layout.tsx`, the Sentinel components, the leaderboard, the nav, the footer) — not aspirational. When applying this skill, prefer the patterns already in use; only deviate when the task explicitly requires it.

Authority for visual standards lives in `docs/authority/buttons.md` and `docs/authority/code-standard.md`. This skill is the cross-cutting reference Claude reaches for during day-to-day UI work.

---

## 0. When this skill applies

Apply when the change touches:

- Any page in `frontend/src/app/**/page.tsx` (visual layout, hero, sections, CTAs)
- Any layout in `frontend/src/app/**/layout.tsx`
- Any component in `frontend/src/components/sentinel/**`, `frontend/src/components/authority/**`, `frontend/src/components/providers/**`, `frontend/src/components/layout/**`, `frontend/src/components/nav/**`, `frontend/src/components/home/**`
- `frontend/src/app/globals.css`
- `frontend/tailwind.config.ts`
- New buttons, cards, tables, modals, tooltips, dropdowns
- Typography, colour, spacing, motion changes
- Mobile responsive behaviour, breakpoint logic, or viewport-locked scrolling

Do NOT apply to: admin tooling UIs (lower bar), API routes, library code, tests.

---

## 1. The brand system

### 1.1 Primary brand gradient (Sentinel + key CTAs)

```
sky-400  →  emerald-300  →  indigo-400
#38bdf8     #6ee7b7        #818cf8
```

Used in:
- Sentinel headline (`<span className="bg-gradient-to-r from-sky-400 via-emerald-300 to-indigo-400 bg-clip-text text-transparent">`)
- Primary CTA buttons (engine-bay style, see §4.1)
- Mobile bottom-nav active indicator
- Leaderboard glow frame (`.leaderboard-glow-frame`)
- Sentinel hero eyebrow + accents

### 1.2 Secondary gradient (canonical "Browse" CTA)

```
purple-600  →  pink-600
#9333ea       #db2777
```

Used in:
- "Browse 40-platform intelligence" CTA on Sentinel hero
- Any secondary CTA per `buttons.md` §2.1 canonical

### 1.3 Surface palette

**Light mode (default body background):**

```css
linear-gradient(115deg,
  #fef3c7 0%,    /* amber-100 — east */
  #e5e7eb 45%,   /* slate-200 — mid */
  #0f172a 100%   /* slate-900 — west */
);
```

Body text: `#020617` (slate-950). Card background: `rgba(255, 255, 255, 0.9)` with `1rem` border-radius and `1px solid rgba(15, 23, 42, 0.06)` border.

**Dark surfaces (Sentinel, leaderboard, nav):**

- Background: `bg-slate-950` (`#020617`) or `rgba(2, 6, 23, 0.6–0.98)`
- Border: `border-zinc-800/60`, `border-white/[0.06]`, or `rgba(30, 41, 59, 1)`
- Body text on dark: `text-slate-100` / `text-slate-200` / `text-slate-300` / `text-slate-400` (descending hierarchy)
- Mono text on dark (clocks, numerals): `rgba(255, 255, 255, 0.95)`

### 1.4 Status colours

- Success / gain / vote-positive: `emerald-400` (`#34d399`) / `emerald-300`
- Loss / error: `rose-400` (`#f87171`) / `rose-500`
- Neutral / flat / muted: `slate-400` (`#94a3b8`) / `slate-500`
- Active sort / selection accent: `cyan-400` (`#22d3ee`)
- Focus ring: `sky-400` (`#38bdf8`) at 50% opacity, 2px outline + 2px offset

### 1.5 Affiliate / commercial accent

Affiliate-disclosure copy renders in `slate-500/600` underlined `decoration-slate-700 underline-offset-2`. Never bright. Discreet but compliant (FTC).

---

## 2. Typography

### 2.1 Fluid root font (the "one knob")

```css
html { font-size: clamp(16px, 1.1vw, 18px); }
```

All Tailwind `text-*` utilities scale from this root. Keep this principle: prefer Tailwind's rem-based sizes (`text-sm`, `text-base`) over fixed pixels for body copy, so the global knob still works.

### 2.2 The clamp() pattern

Component-level sizing uses inline `clamp(MIN, PREFERRED, MAX)` for smooth viewport scaling:

```tsx
style={{ fontSize: 'clamp(0.85rem, 1vw, 1rem)' }}
style={{ padding: 'clamp(20px, 3vw, 48px)' }}
style={{ gap: 'clamp(20px, 2vw, 32px)' }}
```

When adding a new component, follow the same pattern. Do not introduce raw `text-[14px]` or fixed `padding: 24px` — they break the fluid system.

Common clamps in use (from globals.css):

- Body text on dark: `clamp(0.85rem, 1vw, 1rem)`
- Large body / sub-headline: `clamp(1rem, 1.4vw, 1.35rem)`
- Hero h1: `clamp(2rem, 5vw, 4rem)`
- Section h2: typically `clamp(1.5rem, 3vw, 2.5rem)`
- Eyebrow / micro-label: `clamp(0.65rem, 0.8vw, 0.78rem)` with `letter-spacing: 0.08em`
- Footer column heading: `clamp(0.65rem, 0.75vw, 0.75rem)`, `font-mono uppercase`, `letter-spacing: 0.1em`
- Footer link: `clamp(0.8rem, 0.9vw, 0.9rem)`
- Footer fine print: `clamp(0.7rem, 0.8vw, 0.8rem)`
- Section padding (vertical / horizontal): `clamp(40px, 6vw, 96px) clamp(20px, 3vw, 48px)`
- Card row gap: `clamp(20px, 2vw, 32px)`

### 2.3 Font families

- Sans (default): `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- Mono (clocks, numerals, indices): `"SF Mono", "Consolas", "Monaco", "Courier New", monospace`
- Tailwind config exposes `font-sans: ["ui-sans-serif", "system-ui", "sans-serif"]`

### 2.4 Tabular numerals

Apply `font-variant-numeric: tabular-nums; font-feature-settings: "tnum";` (or `.tabular-nums` utility) to any numeric column where digits should align: ranks, scores, prices, change percentages, clocks. Already in use in provider rank, score, index rating, vote thumb.

### 2.5 Letter-spacing

- Hero headlines: `letter-spacing: -0.02em` (slightly tightened)
- Provider names: `letter-spacing: -0.01em`
- Eyebrows / uppercase labels: `letter-spacing: 0.08em` to `0.1em`
- Default body: no override

---

## 3. Layout

### 3.1 Page shell rules — the viewport lock

`<html>` and `<body>` both have:

```css
height: 100dvh;
max-height: 100dvh;
overflow: hidden !important;
```

**This is critical.** All scrolling happens inside individual containers (the providers table, exchange rails, the homepage `<main>` block). When adding a new page or section:

- Wrap content in a container that scrolls internally (`overflow-y-auto`) instead of relying on body scroll.
- The Sentinel-led homepage uses `<main className="h-full overflow-y-auto bg-slate-950">` — follow this pattern.
- Mobile bottom nav (`md:hidden`) takes ~60px at the bottom; content above uses `h-full`, not `h-dvh`, so it respects that constraint.

### 3.2 Max widths

- Page content shell: `max-w-6xl` (`72rem` / `1152px`)
- Footer / nav inner: `max-w-7xl` (`80rem` / `1280px`) for nav, `max-w-6xl` for footer
- Mobile bottom-nav inner: `max-width: 480px`

### 3.3 Section padding

```tsx
style={{
  padding: 'clamp(40px, 6vw, 96px) clamp(20px, 3vw, 48px)',
  gap: 'clamp(20px, 2vw, 32px)'
}}
```

Hero blocks use this exact rhythm. Other sections may use slightly tighter vertical padding (`clamp(24px, 4vw, 64px)`) but match horizontal padding for visual alignment.

### 3.4 Breakpoints

- Mobile: `<768px` (Tailwind `<md`)
- Tablet/desktop: `≥768px` (Tailwind `md:`)
- Large screen enhancements: `min-width: 1400px`
- Ultra-wide: `min-width: 1800px`

Mobile-bottom-nav is `md:hidden`. The leaderboard switches from `<table>` to mobile cards at `max-width: 768px`.

---

## 4. Component patterns

### 4.1 Primary CTA — "engine-bay" style (sky/emerald/indigo)

Used for the main commercial action on each page (See Sentinel, Get Started, Book Audit).

```tsx
<Link
  className="group inline-flex items-center gap-2 rounded-2xl
             border border-sky-400/60
             bg-gradient-to-r from-sky-400/40 via-emerald-300/40 to-indigo-400/40
             font-semibold text-white no-underline shadow-sm
             transition-all
             hover:border-sky-300 hover:from-sky-400/55 hover:via-emerald-300/55 hover:to-indigo-400/55
             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/80
             cursor-pointer"
  style={{
    padding: 'clamp(12px, 1.2vw, 16px) clamp(20px, 2vw, 28px)',
    fontSize: 'clamp(0.9rem, 1vw, 1.05rem)',
  }}
>
  <span className="text-white" aria-hidden="true">✦</span>
  <span className="text-white">Label</span>
</Link>
```

Note the `text-white` on each child `<span>` — required because of body inheritance (see §6.1).

### 4.2 Secondary CTA — purple/pink canonical

Used for "Browse" or "Explore" actions (less weight than primary).

```tsx
<Link
  className="inline-flex items-center gap-2 rounded-full
             border border-purple-500/70
             bg-gradient-to-r from-purple-600/20 to-pink-600/20
             font-medium no-underline shadow-sm
             transition-all
             hover:border-purple-400 hover:from-purple-600/30 hover:to-pink-600/30
             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70
             cursor-pointer"
  style={{
    padding: 'clamp(10px, 1vw, 14px) clamp(16px, 1.6vw, 24px)',
    fontSize: 'clamp(0.85rem, 0.95vw, 1rem)',
  }}
>
  <span className="text-purple-100">Label</span>
</Link>
```

`rounded-full` (not `rounded-2xl`) distinguishes it visually from the primary.

### 4.3 Tertiary / nav button — bordered zinc

Used for About, Contact, secondary nav items.

```tsx
<Link
  className="inline-flex items-center rounded-xl
             border border-zinc-700 px-3 py-1.5 no-underline
             transition-colors hover:border-zinc-600 hover:bg-zinc-800
             cursor-pointer"
>
  <span className="text-zinc-200">Label</span>
</Link>
```

### 4.4 Card

Use the `.card` utility from globals.css when on light surfaces:

```tsx
<div className="card" style={{ padding: 'clamp(16px, 1.5vw, 24px)' }}>
  ...
</div>
```

Or, on dark surfaces, replicate manually:

```tsx
<div className="rounded-2xl border border-white/[0.08] bg-slate-900/60 backdrop-blur-sm"
     style={{ padding: 'clamp(16px, 1.5vw, 24px)' }}>
  ...
</div>
```

### 4.5 Eyebrow label

```tsx
<span
  className="inline-flex items-center gap-2 rounded-full
             border border-sky-400/40 bg-sky-400/10
             font-medium uppercase tracking-wide text-sky-200"
  style={{
    padding: 'clamp(4px, 0.6vw, 8px) clamp(10px, 1.2vw, 16px)',
    fontSize: 'clamp(0.65rem, 0.8vw, 0.78rem)',
    letterSpacing: '0.08em',
  }}
>
  <span aria-hidden="true">●</span>
  Label
</span>
```

### 4.6 Hero block

Pattern (from `sentinel-hero.tsx`):

```
<section> with radial-gradient bg + linear gradient base
  <div max-w-6xl, padding clamp, gap clamp>
    <eyebrow>
    <h1 with brand-gradient span on second line>
    <p sub-headline (slate-300)>
    <p supporting line (slate-400)>
    <CTA row (primary + secondary)>
    <bullet strip (3 items with emerald checkmarks)>
  </div>
</section>
```

### 4.7 Table — Bloomberg-style sortable (leaderboard)

Already styled in globals.css under `.providers-table`, `.providers-table-header`, `.sortable-header`. Key rules:

- Sticky header with `backdrop-filter: blur(8px)` and `box-shadow: 0 2px 8px rgba(0,0,0,0.3)`.
- Sort arrows always visible, dim by default, glow cyan when active.
- Active sort: `drop-shadow(0 0 4px rgba(34, 211, 238, 0.5))`, gradient underline at 80%.
- Row scrolling via `.providers-table-scroll-wrapper` (custom slim scrollbar).
- Mobile (≤768px) switches to `.providers-mobile-card` layout — use the existing classes; do not invent a parallel mobile system.

### 4.8 Footer

Three-column grid, max-w-6xl, on `bg-slate-950` with `border-t border-white/[0.06]`. Brand column + Resources + About. Below: copyright + affiliate disclosure on a `border-t` divider. See `footer.tsx` — do not introduce a parallel footer pattern; extend this one.

### 4.9 Top-nav

Three items only: Sentinel | About | Contact. Sticky, `backdrop-blur-md`, `bg-zinc-950/80`. Sentinel uses primary gradient style; About/Contact use bordered zinc. See `top-nav.tsx`.

### 4.10 Mobile bottom-nav

Four items: Home | Sentinel | Audit | Contact. `md:hidden`. Inline SVG icons with `clamp(14px, 3.5vw, 18px)` sizing. Active state: sky-400 colour + 2px gradient bar pinned to top. Safe-area inset-bottom respected. See `mobile-bottom-nav.tsx`.

---

## 5. Motion and animation

### 5.1 Reduced motion is respected

Always wrap new animations in:

```css
@media (prefers-reduced-motion: reduce) {
  .my-animation {
    animation: none;
    transform: none;
  }
}
```

The codebase enforces this in globals.css for all motion utilities.

### 5.2 Existing motion vocabulary

Don't invent new motion when these already exist:

- `.fx-neutral-breathe` — slow pulse (8s ease-in-out, opacity 0.9 → 1)
- `.fx-tick-up` / `.fx-tick-down` — 1px nudge, 180ms ease-out
- `.fx-whisper-up::after` / `.fx-whisper-down::after` — soft halo fade, 260ms
- `.tick-arrow` — pulse (1.5s ease-in-out)
- `.leaderboard-glow-frame` — 3s and 5s overlapping pulses, brand gradient
- `.market-pulse-active` — 3s glow with synced indicator dot
- `.rank-up-arrow` — 2s glow pulse (emerald)
- `.vote-thumb--animating` — 400ms bounce on vote success
- `expandArrowPulse` — opacity pulse for expand/collapse arrows

GPU-friendly: prefer `opacity` and `transform` (compositor-layer) over `box-shadow` and `width`/`height` keyframes. The codebase comments call this out (see `.fx-whisper-up::after` PERF note).

### 5.3 Transition defaults

Standard transitions in the codebase:

- Colour: `transition-colors duration-200`
- Transform / scale: `transition-all` with `200ms ease-out` (or `300ms ease`)
- Hover scale: `hover:scale-1.15` (icons), `hover:translate-x-1` (arrow on CTA)

---

## 6. Critical guardrails — do not break these

### 6.1 AuthButton white-text override

`<AuthButton />` is wrapped in `[&_button]:!text-white` in `homepage-grid.tsx` (historically) or wherever AuthButton lives. The `!important` is required because `body { color: #020617 }` cascades into the button's children. Removing this has broken sign-in visibility 4+ times. **Do not touch.**

### 6.2 Body colour inheritance — explicit child colours required

Because `body { color: #020617 }` (slate-950), every `<a>` and `<Link>` on a dark surface needs `text-{colour}` on each child `<svg>` and `<span>`. Tailwind classes on the parent are not enough.

```tsx
// WRONG — child <span> inherits body slate-950, invisible on dark bg
<Link className="text-slate-200" href="...">Label</Link>

// RIGHT
<Link className="..." href="...">
  <span className="text-slate-200">Label</span>
</Link>
```

This is enforced across every nav item, footer link, and CTA in the codebase. New code must follow.

### 6.3 Body / html `overflow: hidden`

Don't introduce body-level scroll. New full-page content must scroll inside a container (`overflow-y-auto`). Mobile bottom-nav assumes the body is locked — breaking the lock breaks the mobile layout.

### 6.4 Mobile responsive — `h-full` not `h-dvh` inside the nav wrapper

`layout.tsx` has:

```tsx
<div className="flex h-full flex-col">
  <div className="min-h-0 flex-1">{children}</div>
  <MobileBottomNav />
</div>
```

Children use `h-full`. If you use `h-dvh` here, you push the bottom nav off-screen on mobile. (This is documented in CLAUDE.md.)

### 6.5 Focus-visible outline

The default focus outline (`:where(a, button, input, textarea, select):focus-visible`) is `2px solid #38bdf8` with `2px offset`. Do not strip focus styles in custom CTAs without replacing them — every CTA in the codebase has `focus-visible:ring-2 focus-visible:ring-{colour}/{opacity}`.

### 6.6 Reduced motion

Every motion utility has a `@media (prefers-reduced-motion: reduce)` fallback. New animations must too.

---

## 7. Anti-patterns — flag in review

| Anti-pattern | Why |
|--------------|-----|
| `text-[14px]` or fixed-px font sizes for body copy | Breaks fluid root scaling |
| `padding: 24px` (literal) where surrounding code uses `clamp()` | Inconsistent rhythm |
| New colour outside the palette (e.g. `bg-blue-500` instead of `bg-sky-400`) | Drifts from brand |
| New hover scale (`hover:scale-110`) on a row that already has motion | Stacking motion noise |
| `<a>` or `<Link>` without explicit `text-{colour}` on children | Inherits slate-950, invisible on dark |
| New `<table>` without semantic `<th>` / `<thead>` / `<tbody>` | Hurts accessibility AND citation (see `ai-visibility`) |
| Page that introduces body scroll (no internal scroll container) | Breaks viewport lock |
| Removing the AuthButton `!important` wrapper | Breaks sign-in visibility |
| Animation without `prefers-reduced-motion` fallback | Accessibility violation |
| Fixed pixel sizes that ignore the clamp system on a public page | Drifts from fluid scaling |
| Custom focus outline that is invisible (or removed entirely) | Keyboard-trap UX |
| New CTA that doesn't use one of the 3 canonical button styles | Visual fragmentation |
| Mobile breakpoint other than 768px | Diverges from the established split |
| New gradient with arbitrary colours (e.g. `from-blue-500 to-green-500`) | Use brand gradient (sky/emerald/indigo) or canonical (purple/pink) |

---

## 8. Edge cases — required before shipping (per CLAUDE.md)

For every UI change, mentally walk through:

- **Empty state** — no data, fresh user, signed out
- **Loading state** — skeleton matches final layout, no jank
- **Error state** — network failure, API failure, rate limit
- **Mobile** (≤768px) — does the layout collapse cleanly? Are tap targets ≥44px?
- **Desktop XL** (≥1280px) — fluid scaling holds; nothing pinned awkwardly
- **Signed-out / signed-in** — AuthButton still visible (see §6.1)
- **Cold cache vs warm cache** — first SSR vs ISR vs revalidating
- **Keyboard navigation** — focus rings visible, tab order logical
- **Reduced motion** — animation respects user preference
- **Body lock** — does the new section scroll inside a container, or break the lock?
- **Collision with sticky top-nav and mobile bottom-nav** — content not hidden under either

---

## 9. Verification

After UI changes:

1. **`pnpm run build`** — catches CSS/HTML errors that lint misses.
2. **`pnpm run typecheck`** — pre-approved.
3. **`pnpm run lint`** — pre-approved.
4. **`pnpm run dev`** and visit the page in a browser. Test:
   - Mobile viewport (DevTools `<768px`)
   - Desktop viewport (`≥1280px`)
   - Keyboard tab through interactive elements
   - Toggle `prefers-reduced-motion` in DevTools rendering panel
5. **Spot-check** against `globals.css` — does the new code reuse existing classes, or did it invent parallels?
6. **Cross-check** with `ai-visibility/SKILL.md` — design changes that hide critical content from server HTML are also a visibility regression.

---

## 10. Output format — UI review

Append to the diff summary:

```text
Design Review
  Brand consistency:   pass / concern / fail — <reason>
  Fluid typography:    pass / concern / fail — <reason>
  Layout (clamp):      pass / concern / fail — <reason>
  Motion / a11y:       pass / concern / fail — <reason>
  Body-lock preserved: yes / no
  AuthButton intact:   yes / no
  Edge cases covered:  empty / loading / error / mobile / desktop-xl / signed-in/out

Findings:
  1. [Severity: Blocker/High/Medium/Low]
     File:
     Issue:
     Why it matters:
     Safest fix:

Existing features preserved: Yes/No
Behaviour change: Yes/No
```

Blocker = breaks AuthButton, breaks body lock, drops focus-visible, removes child text colours on dark surface, regresses critical guardrails (§6).
