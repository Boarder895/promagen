# Promagen Code Standard (API-free edition)

**Last updated:** 9 April 2026  
**Version:** 5.0 (No Grey Text · AI Disguise · Co-located Styles · Pipeline X-Ray patterns)  
**Scope:** Frontend code inside the `frontend/` workspace only.

---

## Quick Reference (14 Golden Rules)

Before diving into details, here are the 14 most important rules. If you remember nothing else, remember these:

1. **SSOT-first** — Data lives in JSON, not components. One file to edit, everywhere updates.
2. **One schema per data file** — Every JSON SSOT has exactly ONE Zod schema adjacent to it.
3. **Singular type entry points** — Import `@/types/provider`, not `@/types/providers`.
4. **No scope creep** — "Change X" means change X only. Everything else is locked.
5. **Existing features preserved: Yes** — Every change set must include this statement.
6. **No `.strict()` on subset schemas** — Use `.passthrough()` to allow extra fields.
7. **Docs-first gate** — Read authority docs before writing code; update docs before shipping.
8. **Error boundaries everywhere** — Every `page.tsx` has an `error.tsx` sibling.
9. **Zero-dependency preference** — Use `Intl`, native fetch, built-in APIs first.
10. **Never delete to fix** — Don't remove, stub, or simplify away working code to satisfy tooling.
11. **Universal `clamp()` — every dimension scales** — All text, icons, buttons, gaps, padding, margins, and container dimensions must use CSS `clamp()` for fluid viewport-relative sizing. No fixed `px`, `rem`, or Tailwind size classes for anything that should scale.
12. **Grid is the single source of truth** — One unified CSS grid defines column structure and gaps. Panels sit inside grid cells. Content never escapes its window; only tooltips may overlay.
13. **No grey text — ever** — No `text-slate-400`, `text-slate-500`, `text-slate-600`, `#94A3B8`, `#64748b`, `#475569`, `text-white/30`, `text-white/40`, or any muted grey on any user-facing UI. Use white, brand colours (tier colours, amber, emerald, cyan, pink), or at minimum `text-slate-200` (`#E2E8F0`) / `text-white/70`.
14. **AI Disguise** — No user-facing string references "AI", "GPT", "OpenAI", "LLM", or "model". All API calls are server-side. Users see "algorithms" and "Prompt Intelligence Engine". See `ai-disguise.md`.

---

## 1. Purpose

The Promagen Code Standard defines how all frontend code is written, structured, tested, and maintained. It ensures the entire project feels like it was built by one engineer, not twenty.

This document does not contain any API rules. Promagen uses a separate API Brain document for all provider/role/gateway logic. This file governs frontend code only: components, hooks, state, styling, tests, analytics wiring, and static data.

### Monetisation authority (SSOT)

Frontend code must never invent or imply "paid vs free" behaviour in isolation.

All paid/free boundaries are defined only in:
`C:\Users\Proma\Projects\promagen\docs\authority\paid_tier.md`

**Hard rule:** if a capability is not explicitly listed in `paid_tier.md`, it is free.

The frontend is allowed to render placeholders (loading, skeletons, empty states). The frontend must not invent "demo" market data (fake prices, fake returns, fake movements). If live data is unavailable, we show an honest error/empty state.

### Terminology

| Term                  | Definition                                                                                                                                                                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Pro Promagen**      | The paid subscription tier. Always use "Pro Promagen" in user-facing text, never "paid", "premium", "plus", or other terms. Internal code may use `isPaidUser` or `userTier === 'paid'` for brevity, but UI labels, tooltips, CTAs, and prompts must say "Pro Promagen". |
| **Standard Promagen** | The free tier. If not explicitly listed in `paid_tier.md`, a feature is Standard Promagen (free).                                                                                                                                                                        |

### Principles

- **Zero magic** — No hidden behaviour, no implicit dependencies
- **One place for everything, everything in its place** — SSOT discipline
- **Consistent naming** — Predictable file and variable names
- **Strong TypeScript** — Strict mode, no `any`, typed boundaries
- **Clean accessibility** — Keyboard navigation, ARIA, screen reader support
- **Testable components** — Pure, predictable, mockable
- **Easy to extend without rewrites** — Additive changes are the default
- **Non-regression by default** — Keep all existing features intact unless explicitly changing them

### Scope-of-change rule (no collateral UI changes)

When a request says "change X", treat X as the only allowed change. Everything else is locked unless the request explicitly names it as in-scope — especially: layout, colours, spacing, typography, animations, behaviour, data contracts, and performance characteristics.

If X cannot be implemented without changing anything else, you must re-scope it as a multi-feature change and document the collateral changes explicitly (ADD / REPLACE / REMOVE) before proceeding.

### Operational enforcement (UI scope lock)

Every feature request must include a one-line Scope Lock sentence:

> "Only change <X>; do not touch layout/colours/spacing/typography."

If it is missing, the assistant must add it explicitly to the task scope before making changes.

For UI work, every Change List must include a UI invariants checklist:

- Colours unchanged: ✅/❌
- Layout unchanged: ✅/❌
- Spacing unchanged: ✅/❌
- Typography unchanged: ✅/❌
- Breakpoints unchanged: ✅/❌

If any item is ❌, the change is no longer "change X only" and must be re-scoped as a multi-feature change with collateral changes explicitly listed (ADD / REPLACE / REMOVE) before proceeding.

---

## 2. One Truth Rule

Promagen is SSOT-first.

If something can be defined once as data (JSON) and reused everywhere, that is preferred. Hardcoding data inside components is banned unless it is truly static UI text.

### Examples

- FX pair lists come from the FX SSOT JSON file.
- Tabs come from the tabs JSON.
- Provider lists and categories come from SSOT.

If you need to add/remove/reorder entries, you should be able to do it by editing one file.

### Schema consolidation rule (anti-drift)

**All JSON SSOT must have exactly ONE Zod validation schema.**

- Schema lives adjacent to the data file (e.g., `providers.schema.ts` next to `providers.json`)
- Routes and loaders import from this canonical schema, never define their own
- Local subset schemas (for routes that only need some fields) must use `.passthrough()` mode, not `.strict()`, to allow extra fields without breaking

**Why this matters:** Duplicate schemas drift apart. We had 5 different `ProviderSchema` definitions that caused 500 errors when one used `.strict()` and rejected fields the others allowed.

**Canonical schema locations:**

| Data file                               | Schema file                          |
| --------------------------------------- | ------------------------------------ |
| `data/providers/providers.json`         | `data/providers/providers.schema.ts` |
| `data/fx/fx-pairs.json`                 | `data/fx/fx.schema.ts`               |
| `data/exchanges/exchanges.catalog.json` | `data/exchanges/exchanges.schema.ts` |

---

## 3. File & Folder Structure (Frontend)

Canonical root for all frontend source code: `frontend/src/`

### Routing style

Choose one routing style for the project and keep it consistent. The app router (`app/`) is preferred. If the project is already using `app/`, do not add `pages/`.

### Canonical folders (frontend/src/)

| Folder                | Purpose                                                          |
| --------------------- | ---------------------------------------------------------------- |
| `app/`                | Route segments, page/layout/error/loading files                  |
| `components/`         | UI components and feature components                             |
| `components/nav/`     | Global navigation components and routed tabs                     |
| `components/ui/`      | Reusable UI primitives (buttons, cards, tabs, chips)             |
| `components/ui/tabs/` | In-page tab systems (content swap, same route)                   |
| `components/layout/`  | Layout components (grids, containers, wrappers)                  |
| `data/`               | SSOT-driven static configuration and lists                       |
| `hooks/`              | Custom hooks                                                     |
| `lib/`                | Shared helpers, pure logic, analytics, route helpers, formatters |
| `lib/analytics/`      | Centralised analytics helpers and event catalogue                |
| `lib/routes/`         | Centralised route definitions and helpers                        |
| `styles/`             | Global styles and CSS modules (only when Tailwind is not enough) |
| `types/`              | TypeScript type definitions and entry points                     |
| `utils/`              | Small pure helpers (if not already under `lib/`)                 |

Shared test setup for the frontend: `frontend/src/setupTests.ts`

### Component organisation

- **Feature components:** `components/{feature}/` (e.g., `components/providers/`, `components/exchanges/`)
- **Shared UI primitives:** `components/ui/`
- **Layout components:** `components/layout/`
- **One component per file** (exceptions: tightly coupled sub-components that are not exported)
- **Test files:** `__tests__/` sibling folder or `.test.tsx` suffix

### Rules

- Feature folders sit together; no scattering code across random locations.
- Lowercase filenames (`fx-widget.tsx`, `providers-table.tsx`). Use kebab-case by default.
- Index files only when necessary (no wildcard dumping grounds).
- No hidden side effects (modules do not modify global state on import).
- No handwritten application code lives outside `src/` except tooling (configs, scripts, etc.).

### Generated artefacts

Generated artefacts are allowed, but only under a single, clearly marked folder: `frontend/generated/`

Rules for `frontend/generated/`:

- Contains build outputs consumed by the app (e.g., manifests, derived lookup tables).
- Must be deterministic (same inputs → same outputs).
- Must never be edited by hand.
- May include type-only companion files (`.d.ts`) adjacent to generated JSON.
- `src/` is allowed to import from `frontend/generated/` when the import is read-only and the generated file is tracked/regenerated reliably.

### Environment variable access

Environment variable access is centralised; do not read `process.env` directly inside client components.

---

## 4. TypeScript Standards

Strict mode always enabled.

Never use `any` unless truly unavoidable, and then document why.

Prefer `unknown` over `any` when you need to accept "anything" and then narrow.

Prefer discriminated unions for variants and states.

Use named types and interfaces for all component props.

Prefer:

```typescript
type ProviderMode = "live" | "cached" | "unavailable";
```

over: `string`

Avoid enums unless you truly need them.

Never type React state as `any` or `object`.

All data crossing component boundaries must be typed.

All JSON SSOT must have a TypeScript type.

### Type entry points (canonical imports)

For major domain types, create a singular entry-point file that re-exports:

| Entry point           | Re-exports from  |
| --------------------- | ---------------- |
| `@/types/provider.ts` | `./providers.ts` |
| `@/types/exchange.ts` | `./exchanges.ts` |
| `@/types/fx-pair.ts`  | `./fx.ts`        |

**All UI/route code imports from the singular entry point.** This prevents:

- Import path confusion (singular vs plural)
- Parallel type definitions that drift
- Broken imports when internal files are refactored

**Example:**

```typescript
// ✅ Correct
import type { Provider } from "@/types/provider";

// ❌ Wrong — uses plural, may break
import type { Provider } from "@/types/providers";

// ❌ Wrong — imports from internal file
import type { Provider } from "@/data/providers/providers.schema";
```

### Zod schema rules

All JSON SSOT must have exactly ONE Zod validation schema (see §2).

When a route needs only a subset of fields:

```typescript
// ✅ Correct — allows extra fields
const SubsetSchema = z
  .object({
    id: z.string(),
    name: z.string(),
  })
  .passthrough();

// ❌ Wrong — rejects extra fields, causes 500s
const SubsetSchema = z
  .object({
    id: z.string(),
    name: z.string(),
  })
  .strict();
```

---

## 5. React Component Rules

Components are pure.

Components do not fetch or mutate global state on import.

Client components never read `process.env`.

Server components may read environment only via a centralised server config helper (not inline).

Use functional components.

Always name components.

Avoid unnecessary re-renders:

- Memoise derived values with `useMemo` where it matters.
- Memoise callbacks with `useCallback` where it matters.
- Do not over-memoise trivial values.

Avoid "God components". If a component grows beyond reason, split it.

Keep data transformation out of JSX. Compute values above return.

---

## 6. Styling Rules

Tailwind first.

CSS Modules only when Tailwind cannot express it cleanly.

Keep styling consistent with the existing design system.

**§ 6.0.1 Minimum Text Size Floor (Hard Rule)**

No text in Promagen may render below **10px** at any viewport width. This means:

- Every `clamp()` first value (minimum) for `fontSize` must be ≥ `10px` (≥ `0.625rem`)
- The "Tiny (icon labels)" scale is updated to `clamp(10px, 0.65vw, 11px)` (was 8px floor)
- Em-based font sizes inside snap-fit containers: `0.75em` of the minimum snap-fit base (12px) = 9px — this is the floor
- Any font size that computes below 9px at any viewport width fails review

**Reference:** "6 categories" text in `scene-starters-preview.tsx` line 247 — this is the smallest readable text in Promagen.

**§ 6.0.2 No Grey Text — Anywhere (Hard Rule)**

**No grey text on any user-facing UI surface.** This is the single most enforced visual rule in Promagen.

**Banned (all of these):**

- `text-slate-400` (`#94A3B8`) — previously listed as "dimmest permitted". **Now banned.**
- `text-slate-500` (`#64748b`) — banned since v1.0
- `text-slate-600` (`#475569`) — banned since v1.0
- `text-white/30`, `text-white/40` — too dim on dark backgrounds
- Any hex colour that renders as grey on the dark UI (if you have to ask, it's grey)
- `#6b7280` (gray-500) — used in some index-rating fallback states, should be replaced

**What to use instead:**

- `text-white` / `#FFFFFF` — primary text
- `text-slate-200` (`#E2E8F0`) / `text-white/70` — de-emphasised text (the new floor)
- Brand colours — tier colours (blue `#60a5fa`, purple `#c084fc`, emerald `#34d399`, orange `#fb923c`), cyan (`#22d3ee`), amber (`#FCD34D`), pink
- Category colours from `prompt-colours.ts`

**Why this changed:** The previous rule (v4.0) permitted `text-slate-400` and recommended `text-white/60`. In practice, both are unreadable on Promagen's dark backgrounds. The 6 April 2026 audit found grey text violations in `leaderboard-rail.tsx`, `provider-detail.tsx`, `prompt-builder.tsx`, and `aspect-ratio-selector.tsx` — all traced to the permissive old rule. The standard is now zero-tolerance.

**Compliance check:** `grep -rn "text-slate-4\|text-slate-5\|text-slate-6\|#94A3B8\|#64748b\|#475569\|#6b7280" src/components/ --include="*.tsx"` — result must be empty (comments excepted).

### § 6.0.3 No Opacity Dimming (Hard Rule)

Never dim, fade, or reduce the opacity of UI elements to indicate a disabled or inactive state. On Promagen's dark background, dimmed content becomes invisible.

**Banned patterns:**

- `opacity: 0.4` / `opacity: 0.5` or any sub-1.0 opacity on cards, text, or containers to show "not ready"
- Tailwind `opacity-50`, `opacity-40`, or similar classes for state indication
- Conditional opacity like `hasProvider ? 1 : 0.4` to dim content when a prerequisite is missing

**What to do instead:**

- Change the instruction text to explain what the user needs to do (e.g., "Select a platform above to unlock scenes.")
- Keep all content at full visibility — users need to see what's available before they commit
- Use colour changes (e.g., border colour, dot colour) if you need to show active vs inactive, never opacity

**Exception:** Crossfade transitions between content swaps (e.g., batch rotation `opacity 0 → 1`) are permitted because they are momentary animation, not a resting state.

**Compliance check:** Search for `opacity:` and `opacity-` in component files. Any opacity below 1.0 applied as a resting visual state (not a transition) is a violation.

---

### § 6.0.4 Cursor-Pointer on All Clickable Elements (Hard Rule)

**Added:** 18 March 2026

Every element that responds to user interaction (click, toggle, tab switch, button, link, selectable row) must have `cursor: pointer` explicitly set. An arrow cursor on an interactive element is broken UX — the user cannot tell it's clickable.

**Applies to:** All `<button>` elements, tab bar pills, clickable cards, toggle switches, copy/save/randomise action buttons, intelligence panel tabs (Conflicts, Suggestions, Market Mood), weather suggestion chips, and any `<div>` or `<span>` with an `onClick` handler.

**Implementation:** Use Tailwind `cursor-pointer` class or `style={{ cursor: 'pointer' }}`.

**Compliance check:** Hover every interactive element. Arrow cursor = missing `cursor-pointer`.

---

### § 6.0.5 No Question Mark Icons on Tooltips (Hard Rule)

**Added:** 18 March 2026

Tooltip triggers must never use a `?` icon, question mark emoji, or `HelpCircle` icon. Question marks imply confusion — Promagen's UI should feel confident. If a dedicated trigger is needed, use a small info indicator `(i)` — never `?`.

````
### § 6.0 Universal `clamp()` Sizing (Non-Negotiable)

**Purpose:** Promagen is a desktop application with dynamic fluid scaling. Every visible dimension — text, icons, buttons, gaps, padding, margins, container heights, border radii — must scale smoothly with viewport width using CSS `clamp()`. No fixed pixel values. No fixed rem values. No Tailwind size-class shortcuts for anything that should scale.

**Hard rule:** If a human can see it and it has a size, it uses `clamp()`.

**Why inline `style` over Tailwind classes:** The root `html` font-size is `clamp(16px, 1.1vw, 18px)`, meaning Tailwind's rem-based classes already scale somewhat. But rem scaling is coarse — a `text-sm` that works at 1920px looks wrong at 2560px and worse at 1280px. Inline `clamp()` gives each element precise control over its own minimum, preferred, and maximum size.

**What must use `clamp()`:**

| Property              | Tailwind class to avoid                                     | Inline `clamp()` replacement                                                        |
| --------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Font size             | `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-[10px]` | `style={{ fontSize: 'clamp(0.65rem, 0.8vw, 0.875rem)' }}`                           |
| Icon dimensions       | `h-3 w-3`, `h-4 w-4`, `h-6 w-6`                             | `style={{ width: 'clamp(12px, 0.9vw, 14px)', height: 'clamp(12px, 0.9vw, 14px)' }}` |
| Padding               | `p-4`, `px-3 py-1`, `p-1`                                   | `style={{ padding: 'clamp(10px, 1vw, 16px)' }}`                                     |
| Gaps                  | `gap-2`, `gap-3`, `gap-4`                                   | `style={{ gap: 'clamp(4px, 0.5vw, 8px)' }}`                                         |
| Margins               | `mb-4`, `mt-2`, `ml-auto` (directional)                     | `style={{ marginBottom: 'clamp(8px, 1vw, 16px)' }}`                                 |
| Container height      | `h-[84px]`, `h-12`                                          | `style={{ height: 'clamp(64px, 5.5vw, 84px)' }}`                                    |
| Container width       | `w-[64px]`, `w-12`                                          | `style={{ width: 'clamp(48px, 4.2vw, 64px)' }}`                                     |
| Min height            | `min-h-[44px]`                                              | `style={{ minHeight: 'clamp(36px, 5vh, 44px)' }}`                                   |
| Button padding        | `px-4 py-1.5`                                               | `style={{ padding: 'clamp(0.5rem, 1vh, 0.75rem) clamp(0.75rem, 1.5vw, 1rem)' }}`    |
| Image/flag dimensions | `width={24} height={18}` (Next.js Image)                    | Wrapper div with `style={{ width: 'clamp(18px, 1.5vw, 24px)' }}` + `<Image fill />` |

**Clamp value formula:** `clamp(minimum, preferred, maximum)` where:

- **minimum** = smallest acceptable size (typically 70–80% of the design value)
- **preferred** = viewport-relative value (`vw` for horizontal, `vh` for vertical)
- **maximum** = the original design value (what you'd use at the "ideal" viewport width)

**Standard clamp() recipes (copy-paste reference):**

```tsx
// Text sizes
fontSize: 'clamp(0.65rem, 0.8vw, 0.875rem)'; // Small text (labels, captions)
fontSize: 'clamp(0.7rem, 0.9vw, 1rem)'; // Body text
fontSize: 'clamp(0.75rem, 1.1vw, 1.5rem)'; // Headings
fontSize: 'clamp(8px, 0.6vw, 11px)'; // Tiny text (icon labels)

// Icons
width: 'clamp(10px, 0.8vw, 14px)'; // Small icons (status dots)
width: 'clamp(12px, 0.9vw, 14px)'; // Inline icons
width: 'clamp(18px, 1.5vw, 22px)'; // Button icons
width: 'clamp(36px, 3vw, 48px)'; // Large icons (provider logos)

// Spacing
gap: 'clamp(4px, 0.5vw, 8px)'; // Tight gap
gap: 'clamp(8px, 0.8vw, 12px)'; // Standard gap
padding: 'clamp(10px, 1vw, 16px)'; // Panel padding
marginBottom: 'clamp(8px, 1vw, 16px)'; // Section spacing

// Containers
height: 'clamp(64px, 5.5vw, 84px)'; // Content zone
minHeight: 'clamp(40px, 6vh, 60px)'; // Button min height
````

**Exceptions (where fixed values are acceptable):**

- Tailwind layout utilities that don't represent visible size: `flex-1`, `min-h-0`, `w-full`, `w-1/2`, `overflow-hidden`
- Structural classes: `rounded-full`, `rounded-xl`, `rounded-3xl` (border radius is cosmetic, not content-scaling)
- Ring/focus/outline: `ring-1`, `ring-2`, `focus-visible:ring` (accessibility indicators, deliberately fixed)
- Colour/opacity: `bg-slate-950/70`, `text-purple-100` (not dimensions)
- `ml-auto` (pushes content to edge, not a dimensional value)
- Tooltips: May use fixed Tailwind text classes because they are portalled overlays with their own sizing context
- Transition/animation properties: `transition-all`, `duration-200` (not dimensional)

**Compliance check:** Search a component file for Tailwind size classes (`text-sm`, `h-4`, `w-6`, `gap-3`, `p-4`, `mb-4`, `text-[Npx]`). Every match that represents a visible, scalable dimension must be replaced with an inline `clamp()` style. If a PR introduces new fixed-size Tailwind classes for visible dimensions, it fails review.

**Authority:** Golden Rule #11, `best-working-practice.md` § Universal clamp()

### Responsive font sizing — `clamp()` only, never breakpoints

Adding Tailwind breakpoint text overrides (`sm:text-sm`, `xl:text-base`, `min-[Xpx]:text-Y`) has no visible effect because the underlying rem is already fluid — breakpoints fight the system.

```tsx
// ✅ Correct — scales smoothly from 12px to 16px across viewports
<p style={{ fontSize: 'clamp(0.75rem, 0.9vw, 1rem)' }}>Text</p>

// ❌ Wrong — breakpoints do nothing when root rem already scales
<p className="text-xs sm:text-sm xl:text-base">Text</p>

// ❌ Wrong — fixed Tailwind class, does not scale with viewport
<span className="text-base">READY TO BUILD</span>

// ✅ Correct — fluid scaling for that same text
<span style={{ fontSize: 'clamp(0.7rem, 0.9vw, 1rem)' }}>READY TO BUILD</span>
```

**Authority:** `best-working-practice.md` § Fluid Typography with `clamp()`

### Fixed Proportional Column Layout (multi-column cards)

When a card displays multiple data groups (e.g., exchange info | time | weather), use **fixed proportional columns** to ensure vertical alignment across all cards at any screen size.

**The rule:** Define column widths as fixed fractions of the card width. All cards using the same pattern will have their columns align vertically.

```
┌───────────────────────────────────────────────────────────────────────────┐
│        50% (2fr)              │     25% (1fr)    │    25% (1fr)           │
│     LEFT-ALIGNED              │     CENTERED     │    CENTERED            │
│                               │                  │                        │
│  New Zealand Exchange (NZX)   │                  │                        │
│  Wellington           🇳🇿     │    14:23:45      │      18°C              │
│                      (2x)     │     ● Open       │       ☀️               │
└───────────────────────────────────────────────────────────────────────────┘
```

**Implementation (CSS Grid with fr units):**

```tsx
// 50%/25%/25% split using fractional units
<div className="grid grid-cols-[2fr_1fr_1fr]">
  <div>Exchange Info (left-aligned)</div>
  <div className="flex flex-col items-center">Time (centered)</div>
  <div className="flex flex-col items-center">Weather (centered)</div>
</div>
```

**Column alignment rules:**

- First column (content-heavy): left-aligned text
- Subsequent columns (data): centered within their column
- Long text wraps within its column rather than truncating

**Forbidden patterns:**

- `justify-between` with flexible content (pushes content to edges unpredictably)
- `auto` columns for alignment-critical layouts (widths vary per card)
- Fixed pixel widths (break at different screen sizes)

**Compliance check:** View multiple cards stacked. If the Time columns don't align vertically, the component violates this rule.

### § 6.1 Canonical Button Styling

**Purpose:** All buttons in Promagen use a single, consistent design language. The Sign In button is the canonical reference.

**Default button style (use for ALL buttons unless explicitly told otherwise):**

```tsx
// Tailwind for non-dimensional properties (colour, border style, shape, transitions)
className = 'inline-flex items-center justify-center rounded-full border border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 font-medium text-purple-100 shadow-sm transition-all hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400 focus-visible:outline-none focus-visible:ring focus-visible:ring-purple-400/80'

// Inline clamp() for ALL dimensional properties
style={{
  fontSize: 'clamp(0.75rem, 0.85vw, 0.875rem)',
  padding: 'clamp(0.375rem, 0.5vh, 0.5rem) clamp(0.75rem, 1vw, 1rem)',
  gap: 'clamp(4px, 0.5vw, 8px)',
}}
```

**Breakdown:**

| Property    | Value                                                                   | Implementation                          |
| ----------- | ----------------------------------------------------------------------- | --------------------------------------- |
| Shape       | `rounded-full`                                                          | Tailwind (non-dimensional)              |
| Border      | `border border-purple-500/70`                                           | Tailwind (colour)                       |
| Background  | `bg-gradient-to-r from-purple-600/20 to-pink-600/20`                    | Tailwind (colour)                       |
| Text colour | `text-purple-100`                                                       | Tailwind (colour)                       |
| Text size   | `clamp(0.75rem, 0.85vw, 0.875rem)`                                      | Inline style (dimensional — must scale) |
| Padding     | `clamp(0.375rem, 0.5vh, 0.5rem) clamp(0.75rem, 1vw, 1rem)`              | Inline style (dimensional — must scale) |
| Gap         | `clamp(4px, 0.5vw, 8px)`                                                | Inline style (dimensional — must scale) |
| Hover       | `hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400` | Tailwind (colour)                       |
| Focus       | `focus-visible:ring focus-visible:ring-purple-400/80`                   | Tailwind (accessibility)                |

**Key distinction:** Tailwind for appearance (colours, borders, shape, focus rings). Inline `clamp()` for dimensions (font size, padding, gap, icon size). This is not "avoid inline styles" — it is the correct separation: appearance in classes, dimensions in fluid styles.

**When to deviate:**

Only deviate from this style if the user explicitly requests a different style. Document the deviation with a comment explaining why.

**Reference implementation:** `src/components/auth/auth-button.tsx`

### § 6.2 Animation Placement Standard

**Purpose:** Keep animations self-contained and maintainable. Avoid bloating `globals.css` with single-use animations.

**Gold standard: Animations belong in the component file unless explicitly told otherwise.**

| Approach                                              | When to Use                                                                                                                                        |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Inline in file (Tailwind classes / inline styles)** | Component-specific animations used only in that one component. Keeps everything self-contained, easier to maintain, no hunting through globals.css |
| **globals.css**                                       | Shared animations used across multiple components, or complex keyframes that Tailwind cannot express easily                                        |

**Default rule:** Always put animations in the component file itself unless:

1. The animation is reused in 3+ components
2. The user explicitly requests globals.css placement
3. Tailwind genuinely cannot express the animation (rare)

**Why this matters:** `globals.css` is already large. Adding single-use animations there creates:

- Maintenance burden (hunting through 2000+ lines to find/fix an animation)
- Namespace pollution (risk of class name collisions)
- Harder debugging (animation definition far from usage)

**Implementation patterns:**

**1. `<style dangerouslySetInnerHTML>` (preferred for complex keyframes):**

This is the standard pattern used across all Pipeline X-Ray / Prompt Lab components (`pipeline-xray.tsx`, `xray-decoder.tsx`, `xray-switchboard.tsx`, `xray-alignment.tsx`, `xray-split-flap.tsx`, `xray-teletype.tsx`, `algorithm-cycling.tsx`, `drift-indicator.tsx`, `tier-generation-cycling.tsx`, `leaderboard-rail.tsx`):

```tsx
const COMPONENT_STYLES = `
  @keyframes xray-bar-shimmer {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  .xray-bar-generating {
    background-size: 200% 100%;
    animation: xray-bar-shimmer 1.5s linear infinite;
  }
  @media (prefers-reduced-motion: reduce) {
    .xray-bar-generating {
      animation: none !important;
    }
  }
`;

export function MyComponent() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: COMPONENT_STYLES }} />
      <div className="xray-bar-generating">...</div>
    </>
  );
}
```

**Why `dangerouslySetInnerHTML` over `<style jsx>`:** Next.js App Router with `'use client'` does not support `<style jsx>`. The `dangerouslySetInnerHTML` approach works in all contexts, keeps styles co-located in the same file, and the string is a constant (not user input) so there is no XSS risk.

**2. Tailwind animation utilities (for simple effects):**

```tsx
<button className="animate-pulse hover:animate-none">Launch</button>
```

**3. Inline style with CSS variables:**

```tsx
<div
  style={{
    animation: "pulse 2s ease-in-out infinite",
    boxShadow: "0 0 20px rgba(56, 189, 248, 0.3)",
  }}
>
  ...
</div>
```

**Reduced motion:** Every `@keyframes` block in a `<style dangerouslySetInnerHTML>` must include a `@media (prefers-reduced-motion: reduce)` rule that disables the animation. This is verified in all 11 prompt-lab component files.

**Compliance check:** When adding an animation, ask: "Is this used anywhere else?" If no, keep it in the file.

### § 6.3 Content-Driven Sizing (Breathing Room Pattern)

**Purpose:** When UI content doesn't have room to breathe (clipped text, emojis cut off, flags overflowing), use content-driven measurement instead of magic-number thresholds.

**The problem with magic numbers:**
A fixed pixel threshold like `MIN_HEIGHT_PX = 55` breaks when content changes (larger fonts, flags, emoji). The number has no relationship to what the content actually measures.

**The pattern — measure, then decide:**

1. Render actual content in an **offscreen measurer** (no `overflow-hidden`, `display: inline-block`)
2. Read `scrollWidth` / `scrollHeight` — this is the true content size
3. Compare measured size + breathing room against available cell space
4. If it fits → use that layout. If not → gracefully degrade (hide a row, shrink font, etc.)

```typescript
// Pattern: unified content-driven reflow
const BREATHING_ROOM_PX = 8; // 4px top + 4px bottom

for (const fontSize of candidates) {
  measurer.style.setProperty("--font", `${fontSize}px`);
  measurer.offsetHeight; // force reflow

  const contentH = measurer.scrollHeight;
  const contentW = measurer.scrollWidth;

  if (contentW <= cellWidth && contentH + BREATHING_ROOM_PX <= cellHeight) {
    // Content fits with breathing room — use this layout
    return { fontSize, layout: "current" };
  }
}
// Fallback: minimum font, reduced layout
```

**When to use this pattern:**

- Content clipping on smaller screens (emoji, flags, text cut off)
- Responsive grids where row count should adapt to actual content height
- Any component where a fixed height threshold was previously used

**When NOT to use:**

- Fixed-height components where the height is intentional (headers, footers)
- Components that scroll internally (the scroll handles overflow)

**Key principles:**

- Measure real content, not assumed content
- Add `BREATHING_ROOM_PX` — nothing should sit flush against window edges
- Prefer unified passes (decide font + layout together, not in separate steps)
- Use `ResizeObserver` to trigger re-measurement on resize

**Reference implementation:** `src/components/ribbon/commodities-movers-grid.tsx` (v3.0)

**Authority:** `docs/authority/commodities.md` § Panel Sizing

### § 6.4 Text Containment (No Text Escapes Its Window)

**Purpose:** Prevent text from overflowing, wrapping beyond, or visually escaping its containing panel, card, or window. Text that escapes its container looks broken and unprofessional, particularly in fixed-height containers and on smaller viewports.

**Hard rule:** All text within fixed-height containers must be visually contained at every viewport size. No text may overflow or push beyond its parent container boundary.

**The pattern — three properties working together:**

```tsx
// ✅ Correct — text is fully contained
<div className="flex-1 overflow-hidden min-h-0">
  <p className="truncate">Your text here</p>
</div>

// ❌ Wrong — flex-1 without min-h-0, text escapes on smaller viewports
<div className="flex-1">
  <p>Your text here</p>
</div>
```

| Property          | What it does                                             | Why it's needed                                                   |
| ----------------- | -------------------------------------------------------- | ----------------------------------------------------------------- |
| `overflow-hidden` | Clips anything that exceeds the div's boundary           | Final safety net — nothing visually escapes                       |
| `min-h-0`         | Overrides flex default `min-height: auto`                | Without this, flex children refuse to shrink below content height |
| `truncate`        | Forces `white-space: nowrap` + `text-overflow: ellipsis` | Prevents text wrapping to second line and pushing downward        |

**When to use `truncate` vs line clamping:**

- **Single-line labels, status text, instruction text:** Use `truncate` (ellipsis is better than overflow)
- **Multi-line content (prompts, descriptions):** Use `overflow-hidden min-h-0` on wrapper + `line-clamp-N` on text to limit line count
- **Always:** The parent container must have `overflow-hidden` as the final safety net

**Forbidden patterns:**

- Text inside a fixed-height flex child without `min-h-0` (text will push beyond container)
- Relying solely on outer container `overflow-hidden` without `min-h-0` on intermediate flex children (flex ignores parent overflow constraints by default)
- Animated or pulsing text without containment (animation can cause reflow that escapes)

**Compliance check:** Resize browser to smallest supported viewport. If any text is visually outside its card/panel boundary, the component violates this rule.

**Authority:** `docs/authority/best-working-practice.md` § Text containment

---

### § 6.5 Window Boundary Containment (Nothing In, Nothing Out)

**Purpose:** Every panel in the Promagen grid — Engine Bay, Mission Control, Hero Window, exchange cards, FX ribbons, commodity grids — is a self-contained visual unit. Nothing inside any window may overflow or escape its boundary, and nothing from outside may bleed into any window.

**Hard rules:**

1. **Nothing escapes outward** — All content within a window (text, icons, glows, gradients, absolutely positioned children, animations) must stay inside the window boundary. Content that doesn't fit clips or scrolls — it never paints outside.
2. **Nothing enters from outside** — Adjacent components (exchange cards, ribbons, overlays, glow effects) must not visually intrude into any window.
3. **Only tooltips may overlay** — The sole exception to the boundary rule is tooltips. Tooltips are portalled overlays that render above everything. No other element — no glow, no gradient, no absolutely positioned child, no animation — may render on top of another window's content.
4. **Built from the start** — Every new child element added to any window must respect the boundary without requiring a separate containment fix.
5. **Never modify the outer container** — Do not add `overflow: hidden`, `contain: paint`, `contain: layout`, or any `style` prop to the outer window container div. These create new stacking contexts and containing blocks that break grid positioning and cause the windows to overlap exchange cards.
6. **`clamp()` gaps enforce separation** — The gap between windows is controlled exclusively by the unified grid's `GRID_GAP` constant (a single `clamp()` value). Individual windows must not add external margins that compete with the grid gap. If a window needs internal spacing, use `padding` with `clamp()` — never external margin.

**Implementation — containment is internal, not external:**

```tsx
// ✅ Correct — containment on INNER elements, outer container untouched
<div className="relative w-full rounded-3xl bg-slate-950/70 p-4 shadow-sm ring-1 ring-white/10"
     data-testid="engine-bay">
  {/* Header — fixed height, won't grow */}
  <div className="shrink-0">...</div>
  {/* Body — scrolls internally, clips at own boundary */}
  <div className="flex-1 overflow-hidden min-h-0">
    <div className="overflow-y-auto scrollbar-thin ...">
      <p className="truncate">Text that clips properly</p>
    </div>
  </div>
</div>

// ❌ Wrong — containment on OUTER container breaks grid layout
<div className="relative w-full rounded-3xl bg-slate-950/70 p-4 shadow-sm ring-1 ring-white/10"
     style={{ overflow: 'hidden', contain: 'paint' }}
     data-testid="engine-bay">
  ...
</div>
```

**Per-element containment techniques:**

| Content type                   | Technique                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------ |
| Single-line text               | `truncate` on the text element                                                             |
| Multi-line text                | `line-clamp-N` on text + `overflow-hidden min-h-0` on wrapper                              |
| Scrollable lists               | `overflow-y-auto` with `min-h-0` and `flex-1` on the scroll container                      |
| Glow/gradient decorations      | `pointer-events-none` + percentage-based sizing relative to window, not absolute escapes   |
| Absolutely positioned children | Explicit bounds (`top`/`bottom`/`left`/`right` or `inset`) within the window's padding box |

**Forbidden patterns:**

| Pattern                                                  | Why it breaks                                                 |
| -------------------------------------------------------- | ------------------------------------------------------------- |
| `overflow: hidden` on outer window container             | Breaks grid positioning, clips glows and tooltips incorrectly |
| `contain: paint` or `contain: layout` on outer container | Creates new stacking context, shifts window position in grid  |
| `position: fixed` on child elements                      | Escapes all containment, paints relative to viewport          |
| Negative margins pulling content outside window edge     | Content visually exits the window boundary                    |
| Unbounded absolutely positioned elements                 | Float outside window if no explicit top/bottom/left/right set |

**Compliance check:** Inspect both windows at multiple viewport widths. Draw an imaginary rectangle at each window's border-box edge. Verify: (a) nothing from inside is visually outside that rectangle, (b) nothing from adjacent components is visually inside that rectangle.

**Authority:** `docs/authority/best-working-practice.md` § Window boundary containment

---

### § 6.6 Unified Grid Architecture (Grid Is the Single Source of Truth)

**Purpose:** The Promagen homepage uses a single CSS grid that owns all column definitions, row flow, and inter-panel spacing. No panel is "master" or "slave". The grid is the only source of truth for positioning. Height changes to any panel just work because CSS vertical flow handles that natively.

**Hard rules:**

1. **One shared grid** — Engine Bay and Mission Control sit in the top row (left and right columns respectively). Exchange rails sit in the row below. The centre column holds the Hero Window, FX ribbons, and providers table. All panels share the same grid definition and the same `clamp()` gap.

2. **One `GRID_GAP` constant** — A single `clamp()` value controls ALL spacing: column gaps between left/centre/right AND vertical gaps between stacked panels within each column. This is defined once in `homepage-grid.tsx` and never overridden by child components.

```tsx
// ✅ Correct — single source of truth for all grid spacing
const GRID_GAP = "clamp(6px, 0.5vw, 10px)";

<div
  className="grid"
  style={{
    gridTemplateColumns:
      "clamp(180px, 15vw, 260px) 1fr clamp(180px, 15vw, 260px)",
    gap: GRID_GAP,
  }}
>
  {/* Left column: Engine Bay → Exchange Rail (east) */}
  {/* Centre column: Hero Window → FX Ribbons → Providers Table */}
  {/* Right column: Mission Control → Exchange Rail (west) */}
</div>;
```

3. **Panels don't know about each other** — Engine Bay does not set its height to match Mission Control. Mission Control does not set its width to match Engine Bay. Each panel sizes itself internally using `clamp()`, and the grid places them. If Engine Bay grows taller, everything below it flows down naturally — no JS sync, no manual height matching.

4. **Column stacking uses flex with `clamp()` gaps** — Within each column, panels stack vertically in a flex container whose `gap` is the same `GRID_GAP` constant:

```tsx
// Each column is a vertical flex stack
<div className="flex min-h-0 flex-1 flex-col" style={{ gap: GRID_GAP }}>
  <EngineBay /> {/* shrink-0 — takes its natural height */}
  <ExchangeRailEast />{" "}
  {/* flex-1 — fills remaining space, scrolls internally */}
</div>
```

5. **No external margins on panels** — Panels must not apply external margins (`mb-4`, `mt-2`, etc.). All inter-panel spacing comes from the grid gap or the flex gap of the column container. Internal spacing uses `padding` with `clamp()`.

6. **Column widths use `clamp()`** — Side columns use `clamp(180px, 15vw, 260px)` or similar. The centre column uses `1fr` to fill remaining space. This ensures the layout scales fluidly without breakpoints.

**Grid structure (visual reference):**

```
┌─────────────────┬──────────────────────────────────────────┬─────────────────┐
│   LEFT COLUMN   │              CENTRE COLUMN               │  RIGHT COLUMN   │
│                 │                                          │                 │
│   Engine Bay    │   Hero Window (Heading, Listen, Auth)    │ Mission Control │
│   (shrink-0)    │   (shrink-0)                             │  (shrink-0)     │
│                 │                                          │                 │
│─────────────────│──────────────────────────────────────────│─────────────────│
│                 │                                          │                 │
│  Exchange Rail  │   FX Ribbons (shrink-0)                  │  Exchange Rail  │
│  (east)         │                                          │  (west)         │
│  (flex-1,       │   Commodities Movers (shrink-0)          │  (flex-1,       │
│   scrolls)      │                                          │   scrolls)      │
│                 │   Providers Table (flex-1, scrolls)      │                 │
│                 │                                          │                 │
└─────────────────┴──────────────────────────────────────────┴─────────────────┘

All gaps between cells = GRID_GAP = clamp(6px, 0.5vw, 10px)
```

**Forbidden patterns:**

| Pattern                                     | Why it breaks                                                    |
| ------------------------------------------- | ---------------------------------------------------------------- |
| Panel sets external margin (`mb-4`, `mt-2`) | Competes with grid gap, double-spaces or collapses unpredictably |
| Panel reads sibling height via JS           | Coupling — changes to one panel break the other                  |
| Fixed pixel column widths (`250px`)         | Doesn't scale, breaks on non-standard viewports                  |
| Absolute positioning of panels              | Removes from flow, breaks vertical stacking                      |
| `position: sticky` on panels                | Fights grid flow, causes scroll containment issues               |

**Compliance check:** Change any panel's internal content height (add text, remove icons, resize content). Verify: (a) the panel grows/shrinks naturally, (b) everything below it flows down, (c) the gap between all panels remains identical, (d) no content from any panel enters another panel's boundary.

**Reference implementation:** `src/components/layout/homepage-grid.tsx` (v3.2+)

**Authority:** Golden Rule #12, `docs/authority/best-working-practice.md` § Unified Grid Architecture

---

### § 6.7 Commodity Brand Colour Palette (Hard Rule)

**Added:** 9 March 2026 (v3.0)

All commodity card borders, glows, tooltip accents, and visual indicators use an **8-colour bright hex palette**. No slate tones, no opacity-reduced colours on dark backgrounds.

| Name   | Hex       | Tailwind Equivalent |
| ------ | --------- | ------------------- |
| Red    | `#EF4444` | `red-500`           |
| Orange | `#F97316` | `orange-500`        |
| Gold   | `#EAB308` | `yellow-500`        |
| Green  | `#22C55E` | `green-500`         |
| Cyan   | `#06B6D4` | `cyan-500`          |
| Blue   | `#3B82F6` | `blue-500`          |
| Purple | `#A855F7` | `purple-500`        |
| Pink   | `#EC4899` | `pink-500`          |

**Rules:**

- Border: always `border: 2px solid ${brandHex}` — solid hex, never `hexToRgba()` with opacity
- Default fallback: `#38BDF8` (cyan) when commodity has no mapping
- Colour assignment lives in `sort-movers.ts` `COMMODITY_BRAND_COLOURS` map
- Each of the 34 commodities is mapped to exactly one colour

### § 6.8 Conflict Detection Matching Rules (Hard Rule)

**Added:** 9 March 2026 (v2.0 conflict engine)

The prompt intelligence conflict detection engine (`conflict-detection.ts`) uses `termsMatch()` for comparing user selections against conflict rules. The matching rules are:

1. **Exact match** (case-insensitive) — always fires
2. **Comma-segment match** — compound phrases split on commas, each segment tested independently
3. **Start-of-segment match** — shorter term must appear at the **start** of the longer segment, followed by a space or comma. "neon" matches "neon glow" but "detailed" does NOT match "highly detailed"

**Never use raw `includes()` for conflict matching** — it causes false positives where a conflict term embedded inside a longer phrase triggers incorrectly.

**Mood conflict threshold:** requires **2+** terms per mood group to fire. A single calm term + single intense term is normal scene composition, not a conflict.

**Era conflict threshold:** requires **2+** terms per era group to fire. A single past + single future term is often intentional (retro-futurism).

### § 6.9 Scene Starters Data Completeness (Hard Rule)

**Added:** 9 March 2026

All 200 scenes in `scene-starters.json` must have **all 11 prefill categories filled**: subject, style, lighting, colour, atmosphere, environment, action, composition, camera, materials, fidelity.

**New fields (optional but populated for all 200 scenes):**

- `mood`: 'calm' | 'intense' | 'neutral'
- `suggestedColours`: string[] (4 palette colours)
- `examplePrompt`: string (assembled Tier 3 prompt)

**Tier 4 `reducedPrefills`** must include all 11 categories — Tier 4 platforms handle extra terms gracefully.

**Scoring target:** 100% health score on all 40 platforms across all 4 tiers. Verified by:

- No term triggers a family opposition penalty (use untagged synonyms when necessary)
- No term triggers a defined conflict or semantic tag conflict
- No mood conflict (requires 2+ terms per group, so single calm+intense is fine)
- `hasSubject` credits both typed text AND dropdown selections

### § 6.10 Equal-Gap Card Layout (Anti-Stacking Rule)

**Added:** 15 March 2026

When a card must distribute content rows with visually equal spacing above, between, and below:

**Hard rules:**

1. **One system controls vertical spacing — never two.** Use `display: grid` + `grid-template-rows: auto auto` + `align-content: space-evenly` on the inner content div. This produces mathematically equal gaps above row 1, between rows, and below the last row.
2. **Zero vertical padding on the card.** Use `paddingInline` only. If `padding` (all sides) and `space-evenly` both exist, they stack — top gap becomes padding + space-evenly gap, bottom gap appears smaller because content fills downward. One system, not two.
3. **Card height comes from the parent grid, not `minHeight`.** The outer grid assigns cell height via `grid-template-rows: repeat(N, 1fr)`. Cards fill their cell.
4. **Emoji `lineHeight: 1`** — emojis have inconsistent line-height across browsers. Always set `lineHeight: 1` on emoji spans inside grid-tracked cards.
5. **Responsive row hiding** — when the viewport is too short for all rows, hide the least-critical cards: `@media (max-height: Xpx) { .grid > :nth-child(n+N) { display: none; } }` and reduce `grid-template-rows` accordingly.
6. **Flex ratio + `minHeight` for parent containers** — use `flex: 1 1 0%` / `flex: 3 1 0%` for proportional splits. Add `minHeight` on the smaller section to prevent it shrinking below usable size. The ratio is the target, the `minHeight` is the floor.

**Forbidden patterns:**

- Mixing `padding` (block) with `space-evenly` / `justify-between` / `align-content` (causes uneven visual gaps)
- Using `cqh` (container query height) units for text sizing inside grid-tracked cards (creates `container-type: size` side effects that break layout)
- Setting `minHeight` on individual cards when the parent grid already assigns row height

**Reference implementation:** `src/components/pro-promagen/feature-control-panel.tsx` (v2.0.0+)

**Authority:** `best-working-practice.md` § Equal-gap card spacing

### § 6.11 Debounced Intent Pattern (Hover Panel Switching)

**Added:** 18 March 2026 (v4.0)

When multiple hoverable elements (cards, tabs, menu items) trigger panel switches below or beside them, use **temporal debouncing** to filter accidental triggers during diagonal cursor movement.

**Pattern:**

| State                              | Hover behaviour                                               | Why                                                           |
| ---------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------- |
| No panel active                    | First card hover → switch immediately (0ms)                   | Instant feedback for first interaction                        |
| Same card re-hovered               | No action                                                     | Already showing correct panel                                 |
| Different card hovered             | 150ms debounce → switch if cursor stays                       | Filters pass-throughs during diagonal movement toward preview |
| Card leave (no other card entered) | 2-second linger timer → close if cursor doesn't enter preview | Forgiveness for accidental departure                          |
| Cursor enters preview panel        | Cancel all timers                                             | Safe zone — user arrived at destination                       |
| Cursor leaves preview panel        | Close immediately                                             | Clear intent to leave                                         |

**Why 150ms:** Fast enough to feel instant for deliberate hovers. Long enough to filter diagonal cursor movement across a 3×3 card grid where cards are small and closely spaced. Tested against the Pro page Feature Control Panel.

**Why NOT intent triangle:** v4.0 initially shipped an Amazon-style intent triangle (geometric corridor from cursor anchor to preview panel edges). This failed because the single-point triangle apex created a razor-thin corridor that only worked ~5% of the time on small card grids. Temporal debouncing is geometry-independent and works 100% of the time.

**Implementation:**

```typescript
const switchDebounceRef = useRef<ReturnType<typeof setTimeout>>();
const lingerRef = useRef<ReturnType<typeof setTimeout>>();
const inPreviewRef = useRef(false);
// In handleCardHover: if panel active + different card → setTimeout(150ms)
// On card leave: clearTimeout(switchDebounceRef), start lingerRef(2000ms)
// On preview enter: clearTimeout both refs, set inPreviewRef = true
```

**Reference implementation:** `src/app/pro-promagen/pro-promagen-client.tsx` (v5.0.0)

---

### § 6.12 Auto-Scroll Animation Pattern

**Added:** 18 March 2026 (v4.0)

When content overflows a fixed-height container and needs to be showcased without user interaction (e.g., a preview panel showing a miniaturised builder), use CSS `@keyframes` auto-scrolling with `translateY`.

**Timing spec:**

1. Content starts at `translateY(0)` (top visible)
2. 0.3s hold at top (≈1.8% of cycle)
3. Slow scroll down over ~8 seconds (ease-in-out)
4. 0.3s hold at bottom (≈1.8% of cycle)
5. Slow scroll back up over ~8 seconds (ease-in-out)
6. Total cycle: ~17 seconds
7. Repeat infinitely

**Scroll distance:** Computed dynamically via `ResizeObserver` on content height minus container height. Stored as a CSS custom property `--scroll-dist` and referenced in the `@keyframes`:

```css
@keyframes dailyScroll {
  0%,
  1.8% {
    transform: translateY(0);
  }
  47% {
    transform: translateY(var(--scroll-dist, 0px));
  }
  48.8%,
  51.2% {
    transform: translateY(var(--scroll-dist, 0px));
  }
  98.2% {
    transform: translateY(0);
  }
  100% {
    transform: translateY(0);
  }
}
```

**Rules:**

- Animation defined in `<style dangerouslySetInnerHTML>` (co-located, not globals.css)
- `@media (prefers-reduced-motion: reduce)` disables the animation
- Container uses `overflow: hidden` (not `auto` — no scrollbar visible)
- ResizeObserver cleanup in useEffect return

**Reference implementation:** `DailyPromptsPreviewPanel` in `pro-promagen-client.tsx`

---

### § 6.13 Shared Hook State Sync (Same-Tab StorageEvent)

**Added:** 18 March 2026 (v4.0)

When multiple instances of the same hook need to stay in sync across the same page (e.g., tier selection on the Pro page propagating to exchange tooltips), use **synthetic StorageEvent dispatch** after writing to localStorage.

**Problem:** Native `StorageEvent` only fires in OTHER browser tabs. When the Pro page's `useGlobalPromptTier('pro-page')` writes to localStorage, the exchange list's `useGlobalPromptTier('exchange-cards')` on the same page doesn't hear it.

**Solution:** After `localStorage.setItem()`, dispatch a synthetic event:

```typescript
localStorage.setItem(STORAGE_KEY, JSON.stringify(newValue));
window.dispatchEvent(
  new StorageEvent("storage", {
    key: STORAGE_KEY,
    newValue: JSON.stringify(newValue),
  }),
);
```

Every hook instance listening via `window.addEventListener('storage', ...)` picks it up — same tab and other tabs.

**Rules:**

- The hook that writes the value owns the dispatch — not the caller
- The hook's `useEffect` cleanup must remove the storage listener
- Never use local `useState` for state that needs cross-component sync — always use the shared hook
- The shared hook is the single source of truth — components never read localStorage directly

**Reference implementation:** `src/hooks/use-global-prompt-tier.ts` (v2.0.0)

**Authority:** `paid_tier.md` §5.16 Bidirectional Tier Sync

---

### § 6.14 SSOT Colour Constants (prompt-colours.ts)

**Added:** 18 March 2026 (v4.0)

All prompt category colours are defined once in `src/lib/prompt-colours.ts` and imported everywhere. No component may define its own `CATEGORY_COLOURS` constant.

**Exports:**

| Export                           | Purpose                                                   |
| -------------------------------- | --------------------------------------------------------- |
| `CATEGORY_COLOURS`               | Record of 13 category → hex colour mappings               |
| `CATEGORY_LABELS`                | Record of category → display label                        |
| `CATEGORY_EMOJIS`                | Record of category → emoji                                |
| `buildTermIndexFromSelections()` | Builds `Map<string, PromptCategory>` from user selections |
| `parsePromptIntoSegments()`      | Splits prompt text into `{ text, category }[]` segments   |

**Consumers (must import, never duplicate):**

- `prompt-builder.tsx` (standard builder)
- `enhanced-educational-preview.tsx` (Prompt Lab)
- `four-tier-prompt-preview.tsx` (4-tier preview cards)
- `prompt-showcase.tsx` (homepage PotM)
- `pro-promagen-client.tsx` (Pro page previews)
- `prompt-intelligence-builder.tsx` (intelligence builder)

**Forbidden:** Defining local `CATEGORY_COLOURS` in any component. If a component needs colours, import from `@/lib/prompt-colours`.

**Exception — static data arrays:** When colour values must be inlined in a static const array (e.g., `IMAGEGEN_SHOWCASE` segment data where each segment needs a colour at definition time), a local alias `IG_C` referencing the same hex values from `CATEGORY_COLOURS` is acceptable. The alias must be defined immediately above the data array, use the exact same hex values, and include a comment noting it mirrors the SSOT. This pattern avoids runtime imports in static data while keeping colours traceable.

### § 6.15 Blur-to-Sharp Image Reveal Animation

**Added:** 19 March 2026 (v4.1)

CSS `filter: blur()` animation for showcasing AI-generated images. Simulates real-time image generation.

**Keyframes:** `imagegenReveal` — 15s cycle. `blur(18px)` → resolves over 10s → `blur(0)` for 3s → resets. Paired with `imagegenProgressBar` — fuchsia gradient bar synced to same 15s cycle.

**Rules:**

- Co-located in `<style dangerouslySetInnerHTML>` (same as § 6.12)
- `@media (prefers-reduced-motion: reduce)` must disable animation AND remove all filters (not just `animation: none` — the blur itself must be cleared)
- Image element: `position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover`
- When used with crossfade rotation (§ 6.16), apply `key={activeIdx}` to force animation reset on swap

**Reference:** `ImageGenPreviewPanel` in `pro-promagen-client.tsx`

### § 6.16 Static Image Asset Convention

**Added:** 19 March 2026 (v4.1)

AI-generated images and other static visual assets for feature previews live in `/public/images/pro/`.

**Naming:** `{feature}-{platformId}.{ext}` — e.g., `imagegen-leonardo.jpg`, `imagegen-flux.jpg`, `imagegen-openai.png`.

**Format:** JPEG for photographic content (smaller file size), PNG when transparency or lossless quality needed. No WebP requirement (browser support is sufficient but JPEG/PNG are simpler to generate from AI platforms).

**Usage:** Referenced via `src="/images/pro/imagegen-{platformId}.{ext}"` in `<img>` tags (Next.js serves `/public/` at root). Always include `loading="lazy"`, empty `alt=""` (decorative), and `onError` handler hiding broken images.

## 7. Accessibility Rules

All interactive elements must be keyboard accessible.

All tab lists must have:

- proper roles
- arrow navigation
- Home/End behaviour
- focus management

All icons must have:

- `aria-hidden` if decorative
- `aria-label` if meaningful

All images must have alt text (or empty alt if decorative).

Animations must respect `prefers-reduced-motion`.

When there is dynamic status (loading, errors, changes), use:

- `aria-live` regions
- SR-only updates where appropriate

---

## 7.1 Tooltip Standards (Uniform UI)

**Purpose:** Ensure consistent, accessible, concise tooltip experience across all Promagen surfaces.

### Component

**Canonical component:** `@/components/ui/tooltip`

```tsx
import Tooltip from "@/components/ui/tooltip";

<Tooltip text="Support: 24/7">
  <span className="flag">🇺🇸</span>
</Tooltip>;
```

**Current implementation:** Uses native HTML `title` attribute (simple, accessible, works everywhere).

**Future:** May upgrade to Radix UI or shadcn tooltip for richer interactions, but API remains identical.

### Tooltip Content Rules

**1. Keep it concise** - Maximum 80 characters, one line strongly preferred

**2. No jargon** - Use plain language accessible to all users

**3. Show data** - Include actual numbers/values when relevant (e.g., "87 - 5 = 82")

**4. Desktop only** - Tooltips are hover-only; mobile has no hover, so design must work without tooltips

**5. Never block interaction** - Tooltip must not interfere with clicking the element

**6. Close delay: 400ms** — All custom tooltips (weather, commodity, colour legend) must have a 400ms close delay on mouse leave. This prevents accidental closure when the cursor briefly exits the tooltip boundary. Matches the standard across weather-prompt-tooltip, commodity-prompt-tooltip, and CategoryColourLegend. Native `title` attribute tooltips are exempt (browser-controlled).

**7. Sign-in prompts inside tooltips: plain `<a href="/sign-in">`** — Never use `SignInButton mode="modal"` inside tooltips. Clerk's modal portal fights with z-index stacking in z-50 tooltips, causing the modal to render behind the tooltip. Use a plain anchor tag instead.

**8. No question mark icons** — See § 6.0.5. Tooltip triggers must never use `?`, `❓`, or `HelpCircle` icons. Use the element itself as the hover target.

### Examples

**Good tooltips:**

```tsx
// Short, clear, data-driven
<Tooltip text="Support: 24/7">🇺🇸</Tooltip>
<Tooltip text="Visit midjourney.com">🏠</Tooltip>
<Tooltip text="Try prompt builder">🎨</Tooltip>
<Tooltip text="Adjusted for Big Tech advantage (87 - 5 = 82)">82* ↓</Tooltip>
<Tooltip text="API available">🔌</Tooltip>
```

**Bad tooltips:**

```tsx
// Too long, too wordy
<Tooltip text="This platform receives an adjustment because it is backed by Big Tech and has distribution advantages">82</Tooltip>

// No information
<Tooltip text="Adjusted">82</Tooltip>

// Jargon-heavy
<Tooltip text="Incumbent distribution advantage adjustment per 2-of-3 heuristic">82</Tooltip>
```

### Accessibility Requirements

**Screen reader support:**

```tsx
<Tooltip text="Visit Midjourney website (opens in new tab)">
  <a
    href="https://midjourney.com"
    target="_blank"
    aria-label="Visit Midjourney website (opens in new tab)"
  >
    <span aria-hidden="true">🏠</span>
  </a>
</Tooltip>
```

**Keyboard navigation:**

- Tooltips must appear on both hover AND focus
- Tooltip content must be accessible via `title` attribute or `aria-describedby`

### When to Use Tooltips

**Use tooltips for:**

- Icon-only buttons/links (explain what clicking does)
- Abbreviated data (expand acronyms or show full values)
- Contextual help (explain adjusted scores, support hours, etc.)
- Flag emojis (show support hours or country name)

**Don't use tooltips for:**

- Critical information (must be visible without hover)
- Long explanations (use proper help text or modal)
- Repetitive content (if every item has same tooltip, make it visible)
- Mobile-primary interactions (no hover on touch devices)

### Implementation Checklist

When adding tooltips:

- [ ] Content is ≤80 characters
- [ ] Uses plain language (no jargon)
- [ ] Includes relevant data/numbers
- [ ] Works with keyboard (focus shows tooltip)
- [ ] Has proper aria-label on interactive elements
- [ ] Design works without tooltip (mobile-friendly)

---

## 8. Tabs Architecture (Global Standard)

Promagen uses a gold standard tabs architecture:

**Routed tabs:**

- `components/nav/`
- Each tab is a route segment
- Active tab is determined by URL
- JSON-driven tab order

**In-page tabs:**

- `components/ui/tabs/`
- Tabs / InpageTab / TabPanel pattern
- Tab data comes from `src/data/tabs/*.json` (single source of truth)
- Accessible defaults built in (ARIA roles, keyboard nav, SR-only live region)
- Reduced motion respected
- Overflow polished

### Rules

All new tab systems must follow this architecture.

Do not build ad-hoc tab UIs in random components.

Do not hardcode tab labels or tab order in components.

When adding paid tier tabs, ordering and visibility rules must be JSON-driven and type-safe.

Any routing changes must update:

- route helpers in `lib/routes`
- analytics wiring in `lib/analytics`
- tests for active route highlighting and keyboard behaviour

---

## 9. Analytics Rules

Analytics is centralised.

No inline `gtag` calls inside components.

All analytics events go through: `frontend/src/lib/analytics/`

Components call small, typed helpers, e.g. `trackTabSelected(...)`, not `window.gtag` directly.

Events must be named consistently.

Avoid leaking PII.

Do not invent new `eventType` strings ad-hoc. All analytics-derived metrics must use the authoritative event taxonomy (allowed values + weights) and update the aggregator in the same change.

Any scheduled aggregation endpoint must be idempotent + backfillable (upsert + protected "run now" trigger).

---

## 10. Data Fetching Rules (Frontend Only)

Frontend fetches only from its own API routes (e.g. `/api/fx`), never directly from external vendors.

Do not call upstream providers from the frontend. That is gateway/API Brain territory.

Use caching and server-side TTL at the API route level, not ad-hoc in components.

Client-side polling must be deliberate:

- Not by default
- Not every render
- Not multiple components doing the same poll

### 10.1 Data Polling Hooks (Centralised Pattern)

Promagen uses centralised polling hooks for all data feeds. Each feed has ONE hook that manages polling globally.

**Canonical hooks:**

| Hook                        | Feed        | Slots    | TTL    | Provider    |
| --------------------------- | ----------- | -------- | ------ | ----------- |
| `use-fx-quotes.ts`          | FX          | :00, :30 | 30 min | TwelveData  |
| `use-indices-quotes.ts`     | Indices     | :05, :35 | 2 hr   | Marketstack |
| `use-commodities-quotes.ts` | Commodities | :10, :40 | 30 min | TwelveData  |
| `use-crypto-quotes.ts`      | Crypto      | :20, :50 | 30 min | TwelveData  |

**Pattern (all hooks follow this structure):**

```typescript
// 1. Calculate time to next slot
function getMsUntilNextSlot(): number {
  const now = new Date();
  const minute = now.getMinutes();
  const targets = [5, 35]; // Feed-specific slots
  // ... return ms until next target
}

// 2. Single useEffect with cleanup
useEffect(
  () => {
    const fetchData = async () => {
      /* ... */
    };

    // Initial fetch
    fetchData();

    // Schedule next fetch at slot time
    const timeToNext = getMsUntilNextSlot();
    const timer = setTimeout(/* ... */);

    return () => clearTimeout(timer);
  },
  [
    /* dependencies */
  ],
);

// 3. Return data + loading state
return { data, isLoading, error };
```

**Rules:**

- ONE hook instance per feed globally (via container component)
- Polling aligns to clock slots (prevents per-minute rate limits)
- Visibility-aware: pause when tab hidden
- Return loading/error state for UI handling

**Location:** `frontend/src/hooks/`

---

## 11. Error Handling Rules

Fail honestly.

If data is missing, show:

- a clean empty state
- a "data unavailable" message
- retry affordance where sensible

No "fake" values to hide errors.

For analytics-derived metrics: if data fails freshness checks or can't be trusted, render blank/"—" and log a warning; never show fabricated or stale numbers just to "fill the UI".

Log errors server-side where appropriate (API routes).

UI should never crash on malformed data:

- validate inputs
- guard optional fields
- default safely

### Error boundary placement

- Every route segment (`page.tsx`) should have an `error.tsx` sibling
- Feature components that fetch data should wrap in an ErrorBoundary
- Error states must be styled (not browser default or blank white screen)
- Error boundaries should offer retry affordance where sensible

**File structure example:**

```
app/
  providers/
    page.tsx
    error.tsx      ← Required
    loading.tsx    ← Recommended
    [id]/
      page.tsx
      error.tsx    ← Required
```

### 11.1 Time & Clock Components

#### Clock component rules

- All time display components must use `Intl.DateTimeFormat` for timezone conversion (zero dependencies)
- Clock components must clean up `setInterval` on unmount (use `useEffect` return function)
- Default update frequency: Every second (1000ms)
- Clock format: 24-hour (HH:MM:SS) unless explicitly configured otherwise
- All clocks must handle invalid timezones gracefully (fallback to `--:--:--`)

#### Timezone handling

- Timezone identifiers must be IANA format (e.g. `America/New_York`, `Asia/Tokyo`)
- Read timezone data from SSOT (e.g. `exchanges.catalog.json`)
- Never hardcode timezone strings in components
- Use `lib/clock.ts` utilities for timezone conversions

#### Performance considerations

- Use `React.memo` for clock components to prevent unnecessary parent re-renders
- Consider `requestAnimationFrame` for high-frequency updates if battery becomes an issue
- Document any `setInterval` usage in component comments

#### Example structure

```typescript
'use client';
import { useState, useEffect } from 'react';
import { formatClockInTZ } from '@/lib/clock';

export function ExchangeClock({ tz }: { tz: string }) {
  const [time, setTime] = useState<string>('--:--:--');

  useEffect(() => {
    const update = () => setTime(formatClockInTZ(tz));
    update(); // Initial
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval); // Cleanup
  }, [tz]);

  return <span aria-live="off">{time}</span>;
}
```

**Key principles:**

- No external timezone libraries (`date-fns-tz`, `luxon`) unless absolutely necessary
- Prefer platform APIs (`Intl.DateTimeFormat`) for longevity and zero bundle size
- Always clean up intervals to prevent memory leaks

---

## 12. Testing Rules

Jest config lives at repo root: `jest.config.ts`

Frontend test setup lives at: `frontend/src/setupTests.ts`

ResizeObserver and scrollIntoView polyfills must live in setupTests.

### Rules

Tests must be stable. No timing hacks.

Avoid brittle snapshots for dynamic UI.

When testing tab UIs:

- Arrow keys move focus correctly
- Home/End works
- Active tab updates properly
- Live region updates when relevant

Contract tests for `/api/*` routes must validate:

- expected shape
- caching headers (where relevant)
- error mode behaviour

### Data integrity lock-ins (anti-drift)

Any user-visible "meaning glyph" (emoji/icon) that represents a system state must be pinned by a tiny test so refactors cannot silently swap it.

Budget guard emoji lock-in (required):

- ok🛫 / warning🏖️ / blocked🧳
- The test must assert the mapping from SSOT (`emoji-bank.json`), not from ad-hoc constants in modules.

---

## 13. Data Files (Frontend Only)

All human-authored displayed data (static assets, lookup tables, mappings, exchange lists, commodity metadata, emoji banks, etc.) lives inside: `frontend/src/data/`

Derived/generated data is allowed, but it must live outside `src/` in: `frontend/generated/`

This keeps `src/data/` as the single source of truth (SSOT) for human-edited files, while still allowing fast, "known-good" generated manifests.

### Rules

Use pure JSON or TypeScript modules.

No side effects (loading a data file must not run logic).

Stable, predictable format with typed definitions.

All shapes validated by tests (schema or type-shape tests).

### Budget emojis are SSOT (no module-level constants)

Budget guard emojis must live in the Emoji Bank SSOT:

- File: `frontend/src/data/emoji/emoji-bank.json`
- Group key: `budget_guard` (must include `ok`, `warning`, `blocked`)

Rules:

- Do not define budget emojis as local constants inside providers/routes/components.
- Import them via the emoji helper layer so the UI and server cannot drift.
- No "unknown/?" fallback budget emoji is allowed; missing mappings must fail tests/builds.

Canonical mapping (non-negotiable):

- ok 🛫
- warning 🏖️
- blocked 🧳

A tiny integrity test must pin this mapping.

No API provider config lives here – that is handled exclusively by the API Brain.

### FX-specific SSOT reminder

The FX ribbon's pair list and ordering must come from `frontend/src/data/fx/fx-pairs.json` (or the equivalent canonical file for the feature). Do not hard-code pair arrays in components, routes, or tests — tests must read the same file.

---

## 14. Naming Rules

- **kebab-case** filenames (lowercase only)
- **camelCase** variables and functions
- **PascalCase** components and classes
- **SCREAMING_CASE** constants

No abbreviations unless universally known (fx, ui, utc).

Avoid suffix noise. Prefer:

```
fx-pair-label.tsx
```

over:

```
fxPairLabelComponent.tsx
```

---

## 15. Code Quality Rules

No shims. If something is a shim, it is a smell: fix the import path properly or remove the intermediate module.

No "temporary" code without a removal plan.

**Anti-deletion rule:** Do not remove, stub, bypass, or "simplify away" working logic to make a new feature fit; if behaviour must change, treat it as a deliberate breaking change and document the impact.

### Console Logging Standards

**ESLint rule:** `no-console` is configured to block `console.log` but allow `console.debug`, `console.warn`, and `console.error`.

| Method          | Use For                                   | Example                                                              |
| --------------- | ----------------------------------------- | -------------------------------------------------------------------- |
| `console.error` | Actual errors, exceptions, failures       | `console.error('[fx-sync] Clerk sync failed:', error);`              |
| `console.warn`  | Deprecations, fallbacks, potential issues | `console.warn('[fx-sync] Using fallback pairs - SSOT unavailable');` |
| `console.debug` | Development debugging, internal state     | `console.debug('[fx-sync] Selection saved:', pairIds);`              |

**Banned:** `console.log` — blocked by ESLint, pollutes production logs, not filterable.

**Why `console.debug` over `console.log`:**

1. **Filterable** — hidden by default in browser DevTools (under "Verbose" level)
2. **Strippable** — build tools can remove `console.debug` from production bundles
3. **Semantic** — clearly indicates "developer-only" information

**Prefix convention:** Always prefix with `[module-name]` for easy filtering:

```typescript
console.debug("[fx-selection] Pairs loaded:", pairs.length);
console.warn("[clerk-sync] Resolution conflict, clerk wins");
console.error("[gateway] API request failed:", error.message);
```

**Server-side (API routes, gateway):** Use structured logging where appropriate (see §19.4 Observability hooks).

No unused imports.

No unused variables.

No `eslint-disable` unless justified with a comment.

Keep functions small and testable.

Prefer pure functions in `lib/` over inline logic in components.

---

## 16. API Route Naming Convention

### Route patterns

| Pattern                      | Example                           | Purpose             |
| ---------------------------- | --------------------------------- | ------------------- |
| `/api/{resource}`            | `/api/providers`                  | Resource collection |
| `/api/{resource}/{id}`       | `/api/providers/midjourney`       | Single resource     |
| `/api/{resource}/{action}`   | `/api/providers/resolve`          | Resource action     |
| `/api/{resource}/{id}/{sub}` | `/api/providers/midjourney/stats` | Nested resource     |
| `/api/admin/{resource}`      | `/api/admin/catalog`              | Admin-only routes   |

### Internal/cron routes

- Protected by secret (check `CRON_SECRET` header)
- Documented in route file header comment
- Never exposed in client-side code

### Outbound redirect routes

All outbound links go through `/go/{id}?src=...` — never link directly to external URLs.

---

## 17. Dependency Discipline

Before adding a new dependency:

1. **Check if the functionality exists in platform APIs** — prefer native (`Intl`, `fetch`, `URL`, `crypto`)
2. **Check if an existing dependency covers the use case** — avoid duplicate libraries
3. **Evaluate bundle size impact** — use `pnpm why <pkg>` and check bundlephobia.com
4. **Document why the dependency is needed** — in the PR description

**Zero-dependency preference:** Use `Intl.DateTimeFormat` over `date-fns-tz`. Use native `fetch` over `axios`. Use built-in Node APIs where possible.

**Forbidden without explicit approval:**

- Moment.js (use `Intl` or `date-fns`)
- Lodash for single utilities (write the 3-line function)
- jQuery (obviously)

---

## 18. Versioning & Release Rules

Lint, typecheck, and tests must pass before release. At minimum:

```powershell
# [frontend/ (PowerShell)]
pnpm run lint
pnpm run typecheck
pnpm run test:ci
```

or, from repo root:

```powershell
# [Repo root (PowerShell)]
pnpm -C frontend run lint
pnpm -C frontend run typecheck
pnpm -C frontend run test:ci
```

Breaking UI changes must be documented (what changed and why).

### Docs-first gate (hard rule)

Before any new code or files: read authority docs, decide if they need updating, and provide the doc update first.

**Authority:** `docs/authority/best-working-practice.md` § "Docs-first gate"

Required "Doc Delta" preface (must appear before any code/files are produced):

- Docs read: Yes (list the authority docs read)
- Doc updates required: Yes/No
- If Yes: Target doc, Reason, Exact insertion point, Paste-ready text

### Feature addition discipline (non-regression)

Every feature change set must include a short Change List using ADD / REPLACE / REMOVE bullets and a line stating **"Existing features preserved: Yes/No"** (Yes is the default expectation).

Any feature addition that touches existing behaviour must include at least one lock-in proof: a focused test, or a before/after behaviour note demonstrating identical external behaviour.

New tabs must follow the global tab architecture.

New pages must follow route organisation and analytics conventions.

### Generated files policy

No auto-generated runtime files inside `src/`.

All generated artefacts must live in: `frontend/generated/`

Requirements:

- Deterministic generation (same inputs → same outputs).
- Never edit generated files by hand.
- Generation scripts live under `frontend/scripts/` and are run via pnpm scripts.
- CI must either: (a) regenerate and fail on diff, or (b) verify the generated artefacts are up-to-date.

---

## 19. Vercel Pro Production Guardrails

Any route capable of incurring upstream spend (starting with `/api/fx`) must have platform guardrails:

- Spend Management thresholds + monthly cap (cap action: pause production deployments).
- WAF rules + rate limiting to prevent bot/traffic-spike spend.

**Authority:** `docs/authority/vercel-pro-promagen-playbook.md`

### Pro-strengthening code rules (mandatory for every spend-bearing endpoint file)

Applies to:

- `frontend/src/app/api/*` routes that can incur upstream spend
- outbound redirect routes (e.g. `/go/*`)
- any future endpoints that can trigger paid vendor/API calls

### 19.1 Make caching a first-class "cost control" contract

Bake in:

- Explicit caching headers on `/api/fx` responses (and any spend-bearing endpoints) that match your Refresh Gate TTL.
- Edge-friendly semantics (`public`, `s-maxage`, `stale-while-revalidate`) where safe.
- `No-cache`/`No-store` for trace/admin endpoints.

Client fetch stance (anti-regression):

- For spend-bearing endpoints like `/api/fx`, client-side fetch must not set `cache: 'no-store'` / `reload`, add `Cache-Control: no-cache`, or append cache-busting query params.
- Use `credentials: 'omit'` unless the endpoint truly needs cookies.

### 19.2 Single-flight and request de-duplication (stop stampedes)

Bake in:

- A "single-flight" lock so 50 concurrent requests to `/api/fx` don't trigger 50 upstream calls.
- A short in-memory or shared cache so requests within the TTL return instantly.
- A hard block on "force refresh" unless explicitly allowed.

### 19.3 Rate limiting in app (defence in depth)

Bake in:

- A lightweight per-IP/per-token rate limiter for spend-bearing endpoints.
- A stricter limiter for `/go/*` to stop open-redirect probing and bot storms.

### 19.4 Observability hooks that match Pro logging/analytics

Bake in:

- Structured logs (JSON-ish) with consistent fields: route, request id, cache status, provider used, fallback used, duration, blocked-by-budget, etc.
- Correlation IDs (request id passed through calls).
- "Important events" logged once per request, not spammy console noise.

### 19.5 Health endpoints + safe-mode switches

Bake in:

- A `/api/health` that checks app config sanity (not upstream spend).
- A "safe mode" env var (`PROMAGEN_SAFE_MODE=1`) that forces demo data or blocks paid calls.
- A "kill switch" env var for specific providers.

### 19.6 Security headers and hardening

Bake in:

- Strict security headers (CSP, HSTS, X-Content-Type-Options, etc.) appropriate for Next.js.
- Tight input validation for query params (especially `/go/*` and any endpoint that accepts user input).
- Disable or restrict trace routes in production by default.

### The Promagen truth: what matters most

If you bake only three things into code, make them these:

1. Cache headers that reflect your TTL and are CDN honest
2. Single-flight + caching to prevent upstream stampedes
3. Safe mode + kill switches via env vars

---

## 20. What This Code Standard Does Not Cover

This document does not define:

- API providers
- API roles
- API gateway behaviour
- How data is fetched from external vendors
- How backups/fallback providers work
- Any part of the API Brain

All of that lives in: **➡️ promagen-api-brain-v2.md** – the authoritative API system document.

The two documents are intentionally separate so each stays clean: this file governs how we write frontend code; the API Brain governs how we talk to the outside world.

---

## 21. Linting, Typecheck & Test Fix Discipline (Gold Standard — Non-Negotiable)

When addressing ESLint, TypeScript typecheck, or test failures, apply the smallest possible, behaviour-preserving change. The sole goal is to restore a green build without changing or omitting any feature, and without altering user-visible behaviour, API/data contracts, side-effects, performance characteristics, caching/TTL behaviour, logging/telemetry semantics, or runtime control flow.

**Anti-deletion rule:** Do not remove, stub, rename, bypass, or "simplify away" functional code purely to satisfy tooling.

**Scope control:** If compliance cannot be achieved without any behavioural change, the work must be explicitly re-scoped and reviewed as a feature change with a clear rationale and an agreed change list before implementation.

**Required documentation for tooling-only fixes:** Every lint/typecheck/test-fix change set must include a short Change List using ADD / REPLACE / REMOVE bullets and a line stating **"Behaviour change: Yes/No"**. "No" is the default expectation.

**Required lock-in for logic-touching fixes:** If a tooling fix touches runtime logic (not just types, imports, formatting, or lint configuration), you must add at least one lock-in proof: either a focused unit/contract test covering the affected behaviour, or a before/after sample output note demonstrating identical external behaviour.

---

## 22. CLS Prevention Rules (Added 9 Feb 2026)

**Purpose:** Cumulative Layout Shift (CLS) is a Core Web Vital that measures visible element movement after initial paint. Google considers CLS ≤ 0.10 "good". Promagen targets ≤ 0.05. These rules prevent the patterns that caused CLS to reach 0.40 and the multi-day fix cycle that followed.

### The SSR hydration gap (why useLayoutEffect doesn't help)

Next.js SSR renders HTML on the server. The browser paints this HTML **before** React hydrates. By the time any React effect runs (including `useLayoutEffect`), the first paint has already happened. Any measurement → setState → re-render cycle after hydration creates a visible shift.

**Timeline:**

1. Server HTML arrives → browser paints (user sees initial layout)
2. React hydrates → `useLayoutEffect` fires → measures → `setState`
3. Re-render → browser paints corrected layout
4. **CLS recorded between step 1 and step 3**

`useLayoutEffect` only prevents paint between steps 2–3. It cannot prevent the SSR → hydration gap shift (steps 1–2).

### Rule 1: CSS-deterministic heights for measured components

Any component that measures itself to determine layout (snap-fit font, auto-rows, dynamic sizing) **must** have a fixed CSS height on its outer container:

```tsx
// ✅ Correct — outer height is locked regardless of inner measurement
<section className="h-[42px] overflow-hidden">
  <SnapFitContent /> {/* measures and adjusts font size */}
</section>

// ❌ Wrong — height depends on content, which changes after measurement
<section className="min-h-[38px]">
  <SnapFitContent />
</section>
```

**Why:** `min-h` allows the container to grow when content changes. `h-[Xpx]` locks it. The value should be the **maximum possible height** (largest font + padding + internal spacing). `overflow-hidden` clips any excess.

### Rule 2: Opacity gating for measurement-driven components

Components that use `requestAnimationFrame`, `ResizeObserver`, or any measure → setState pattern **must** start at `opacity: 0` and fade in after settling. Per CLS specification, elements at `opacity: 0` are excluded from shift scoring even if they change position.

```tsx
const [settled, setSettled] = useState(false);

// In measurement callback (after final setState):
setSettled(true);

// In render:
<div
  style={{
    opacity: settled ? 1 : 0,
    transition: "opacity 150ms ease-in",
  }}
>
  {/* content that measures/reflowsitself */}
</div>;
```

**Requirements:**

- `setSettled(true)` must be called at **every exit path** of the measurement function (success, fallback, error)
- Add a safety timeout (2s) to ensure content always becomes visible even if measurement fails
- Loading skeletons/empty states should also use `opacity: 0` if they will be replaced by differently-sized content

### Rule 3: No `transition-all` on layout containers

`transition-all` animates **every** CSS property change, including position, width, height, and transform. When a measurement-driven reflow moves or resizes elements, `transition-all` causes the browser to animate the shift — and CLS counts animated shifts.

```tsx
// ✅ Correct — only animate visual properties
className = "transition-colors";

// ❌ Wrong — animates layout shifts
className = "transition-all";
```

**Allowed transition targets:** `transition-colors`, `transition-opacity`, `transition-shadow`. Never use `transition-all` on any element that might change position or size.

### Rule 4: Client-side data fetches that re-sort visible content

Any `useEffect` that fetches data and then re-sorts or re-orders already-visible rows (e.g., fetching ratings then sorting a table) creates CLS. The rows visibly jump to new positions.

**Fix:** Opacity-gate the container until the fetch completes:

```tsx
const [dataLoaded, setDataLoaded] = useState(false);

useEffect(() => {
  const timeout = setTimeout(() => setDataLoaded(true), 2000); // safety fallback
  fetchData()
    .then((data) => {
      setData(data);
      setDataLoaded(true);
    })
    .catch(() => setDataLoaded(true)) // always become visible
    .finally(() => clearTimeout(timeout));
}, []);

<div
  style={{ opacity: dataLoaded ? 1 : 0, transition: "opacity 150ms ease-in" }}
>
  <SortableTable data={data} />
</div>;
```

### Rule 5: Flex layout isolation

When multiple components share a flex container, one component's height change pushes all siblings down (cascade shift). Use `flex-1 min-h-0` on wrappers to give each section a **CSS-deterministic share** of available space:

```tsx
// ✅ Correct — each wrapper gets 50%, internal changes can't push siblings
<div className="flex min-h-0 flex-1 flex-col gap-3">
  <div className="flex min-h-0 flex-1 flex-col">{/* Finance ribbons */}</div>
  <div className="min-h-0 flex-1">{/* Providers table */}</div>
</div>

// ❌ Wrong — finance wrapper is natural height, pushes providers down when content loads
<div className="flex flex-col gap-3">
  <div>{/* Finance ribbons */}</div>
  <div className="flex-1">{/* Providers table */}</div>
</div>
```

### CLS checklist (required for any component that measures or fetches)

Before shipping any component that uses `ResizeObserver`, `requestAnimationFrame`, `getBoundingClientRect`, or `useEffect` with data fetching + state updates:

- [ ] Outer container has a fixed CSS height (`h-[Xpx]`) or flex-isolated (`flex-1 min-h-0`)
- [ ] Content starts at `opacity: 0` with a `settled` / `dataLoaded` gate
- [ ] `setSettled(true)` called at every exit path (success + fallback + error)
- [ ] Safety timeout (2s) ensures visibility even on failure
- [ ] No `transition-all` — only `transition-colors` or `transition-opacity`
- [ ] Empty/loading states also use `opacity: 0` if replaced by differently-sized content
- [ ] Verified with Chrome DevTools → Performance panel → Layout Shifts section

---

## Changelog

- **6 April 2026 (v5.0):** Major update — 3 critical changes. (1) **§6.0.2 rewritten: No Grey Text — Anywhere.** `text-slate-400` (`#94A3B8`) is now BANNED (was previously "dimmest permitted"). `text-white/60` recommendation removed. New floor: `text-slate-200` (`#E2E8F0`) / `text-white/70`. All grey variants banned including `text-white/30`, `text-white/40`, `#6b7280`. Compliance check grep command added. Triggered by 6 Apr audit finding grey text in `leaderboard-rail.tsx`, `provider-detail.tsx`, `prompt-builder.tsx`, `aspect-ratio-selector.tsx`. (2) **Golden Rules expanded from 12 to 14:** #13 No Grey Text (zero tolerance), #14 AI Disguise (no user-facing AI/GPT/OpenAI references). (3) **§6.2 Animation Placement rewritten:** `<style dangerouslySetInnerHTML>` is now the documented preferred pattern (used in all 11 prompt-lab component files). `<style jsx>` removed (not supported in Next.js App Router `'use client'`). Reduced-motion requirement explicit: every `@keyframes` block must include `@media (prefers-reduced-motion: reduce)`.
- **19 March 2026 (v4.1):** Added § 6.15 Blur-to-Sharp Image Reveal Animation (`imagegenReveal` + `imagegenProgressBar` keyframes, 15s cycle, `prefers-reduced-motion` must clear filters). Added § 6.16 Static Image Asset Convention (`/public/images/pro/`, naming pattern `{feature}-{platformId}.{ext}`, lazy loading, onError handlers). Updated § 6.14: added exception for `IG_C` local alias pattern in static data arrays (acceptable when hex values match SSOT exactly). Cross-references: `paid_tier.md` §5.10 v6.0.0, `best-working-practice.md` blur-to-sharp + crossfade rotation patterns.
- **18 March 2026 (v4.0):** Major update — 6 new hard rules and 4 new patterns. Added § 6.0.4 cursor-pointer on ALL clickable elements (arrow cursor = broken UX). Added § 6.0.5 no question mark icons on tooltips. Added § 6.11 Debounced Intent Pattern (150ms hover panel switching, replaces failed intent triangle). Added § 6.12 Auto-Scroll Animation Pattern (17s cycle with ResizeObserver-computed distance, co-located `@keyframes`). Added § 6.13 Shared Hook State Sync (synthetic StorageEvent for same-tab cross-hook sync). Added § 6.14 SSOT Colour Constants (`prompt-colours.ts` is the sole source of truth for all 13 category colours — no local duplicates). Updated § 7.1 Tooltip Standards: added rules 6–8 (400ms close delay, sign-in as plain `<a>` not `SignInButton mode="modal"`, no question marks cross-ref to § 6.0.5). Updated § 8.4 prompt builder data locations (added `prompt-colours.ts` 210 lines, `lifetime-counter.ts` 33 lines, updated `prompt-builder.ts` 1,738 lines). Cross-references: `paid_tier.md` §5.14 (colour anatomy), §5.15 (gem badge), §5.16 (tier sync).
- **15 March 2026**: Added § 6.10 Equal-Gap Card Layout (anti-stacking rule). One vertical spacing system per card, `paddingInline` only, `align-content: space-evenly`, responsive row hiding via `max-height` media query. Cross-ref best-working-practice.md.
- **9 March 2026**: Added § 6.7 Commodity Brand Colour Palette (8 bright hex colours, no slate, solid border rule). Added § 6.8 Conflict Detection Matching Rules (word-boundary termsMatch, mood/era 2+ threshold). Added § 6.9 Scene Starters Data Completeness (all 11 categories, 100% score target).
- **16 Feb 2026 (v3.0):** Major architecture update — three new mandates baked into the code standard:
  - **§ 6.0 Universal `clamp()` Sizing:** Every visible dimension (text, icons, buttons, gaps, padding, margins, container dimensions) must use CSS `clamp()` for fluid scaling. No fixed `px`/`rem`/Tailwind size classes for scalable dimensions. Full property-by-property table, standard recipes, and exceptions list. Golden Rule #11.
  - **§ 6.6 Unified Grid Architecture:** One CSS grid is the single source of truth for all panel positioning. One `GRID_GAP` constant (a `clamp()` value) controls all inter-panel spacing. Panels don't know about each other — the grid handles positioning and flow. Visual reference diagram. Golden Rule #12.
  - **§ 6.5 Window Boundary Containment (strengthened):** Added Rule 3 "Only tooltips may overlay" — no glow, gradient, absolutely positioned child, or animation may render on top of another window. Added Rule 6 "`clamp()` gaps enforce separation" — inter-window spacing comes exclusively from the grid gap, never from panel margins.
  - **§ 6.1 Canonical Button Styling (updated):** Button pattern now separates Tailwind (appearance: colours, borders, shape) from inline `clamp()` (dimensions: font size, padding, gap). Updated reference table.
  - **Golden Rules expanded from 10 to 12:** #11 Universal `clamp()`, #12 Grid is single source of truth.
- **15 Feb 2026 (v2.9):** Added § 6.5 Window Boundary Containment — architectural rule for Ignition (Engine Bay) and Mission Control windows. Nothing inside escapes outward, nothing from outside bleeds inward. Containment achieved via internal element constraints (truncate, overflow-hidden on inner wrappers, bounded absolute positioning). Outer window container div must never have overflow/contain style props added — these break grid positioning. Cross-ref best-working-practice.md.
- **14 Feb 2026 (v2.8):** Added anti-breakpoint responsive font rule to § 6 intro — never use Tailwind breakpoint text classes (`sm:text-sm`, `xl:text-base`, `min-[Xpx]:text-Y`) because root `html` already uses `clamp()` and rem-based classes already scale. Tooltips exempt. Added § 6.4 Text Containment — three-property pattern (`overflow-hidden`, `min-h-0`, `truncate`) required for all text in fixed-height containers. Cross-ref best-working-practice.md.
- **9 Feb 2026 (v2.7):** Added § 22 CLS Prevention Rules. Documents five rules and a checklist for preventing Cumulative Layout Shift: CSS-deterministic heights, opacity gating, no transition-all on layout containers, client-side fetch re-sort gating, and flex layout isolation. Based on CLS 0.40 → 0.02 fix cycle.
- **7 Feb 2026 (v2.6):** Added § 6.3 Content-Driven Sizing (Breathing Room Pattern). Documents the approach for when content doesn't have room to breathe: measure real content in offscreen measurer, compare against available space with breathing room, gracefully degrade layout. Reference implementation: commodities-movers-grid.tsx v3.0.
- **13 Jan 2026 (v2.5):** Added §10.1 Data Polling Hooks (centralised pattern). Documents all four polling hooks (FX, Indices, Commodities, Crypto) with slot schedules, TTLs, and providers. Standard pattern for visibility-aware, slot-aligned polling.
- **10 Jan 2026 (v2.4):** Updated FX SSOT file references from `fx.pairs.json` to unified `fx-pairs.json` in §3 and §13 SSOT sections.
- **9 Jan 2026 (v2.3):** Added Console Logging Standards section in §15 Code Quality Rules. Specifies `console.debug` over `console.log`, prefix convention `[module-name]`, and method hierarchy (error/warn/debug).
- **30 Dec 2025:** Added § 7.1 Tooltip Standards (uniform UI guidelines for consistent, accessible tooltips across all surfaces).
- **28 Dec 2025 (v2.0):** Major upgrade to 9.5/10. Added Quick Reference, schema consolidation rule, type entry points, error boundary placement, component organisation, API route naming, dependency discipline, docs-first gate cross-reference. Renumbered sections for consistency.
- **15 Dec 2025 (v1.0):** Initial version with core rules, Vercel Pro guardrails, clock components.
- **31 Dec 2025:** Added § 8.1 Scrollbar Utilities, § 8.2 Synchronized Scroll Pattern, § 8.3 Viewport-Locked Layout, § 8.4 Prompt Builder Patterns (category dropdown system, platform-specific assembly, full-height layout).

---

## 8. Layout Patterns (Added Dec 31, 2025)

### § 8.1 Scrollbar Utilities

Promagen uses thin, subtle scrollbars for internal scroll containers on dark UI surfaces.

**Utility Classes (globals.css)**

```css
/* Webkit (Chrome, Safari, Edge) */
.scrollbar-thin::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.scrollbar-track-transparent::-webkit-scrollbar-track {
  background: transparent;
}

.scrollbar-thumb-white\/20::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.hover\:scrollbar-thumb-white\/30:hover::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
}

/* Firefox fallback */
.scrollbar-thin {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
}
```

**Usage Pattern**

```tsx
<div className="overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30">
  {/* Scrollable content */}
</div>
```

**Rules**

1. Always use `overflow-y: auto` (not `scroll`) — scrollbar only appears when needed
2. Apply all four scrollbar classes together for consistent styling
3. Never use browser-default scrollbars in dark UI areas

---

### § 8.2 Synchronized Scroll Pattern

When two containers must scroll in sync (e.g., exchange rails on homepage):

**Implementation**

```tsx
"use client";

import { useRef, useCallback } from "react";

export function SyncedScrollContainers() {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const isSyncing = useRef(false);

  const syncScroll = useCallback(
    (source: HTMLDivElement, target: HTMLDivElement) => {
      if (isSyncing.current) return;
      isSyncing.current = true;

      // Calculate scroll percentage (handles different content heights)
      const maxScroll = source.scrollHeight - source.clientHeight;
      const scrollPercent = maxScroll > 0 ? source.scrollTop / maxScroll : 0;

      // Apply to target
      const targetMaxScroll = target.scrollHeight - target.clientHeight;
      target.scrollTop = scrollPercent * targetMaxScroll;

      requestAnimationFrame(() => {
        isSyncing.current = false;
      });
    },
    [],
  );

  const handleLeftScroll = useCallback(() => {
    if (leftRef.current && rightRef.current) {
      syncScroll(leftRef.current, rightRef.current);
    }
  }, [syncScroll]);

  const handleRightScroll = useCallback(() => {
    if (rightRef.current && leftRef.current) {
      syncScroll(rightRef.current, leftRef.current);
    }
  }, [syncScroll]);

  return (
    <>
      <div
        ref={leftRef}
        onScroll={handleLeftScroll}
        className="overflow-y-auto"
      >
        {/* Left content */}
      </div>
      <div
        ref={rightRef}
        onScroll={handleRightScroll}
        className="overflow-y-auto"
      >
        {/* Right content */}
      </div>
    </>
  );
}
```

**Key Points**

1. **Percentage-based sync** — handles containers with different content heights
2. **`isSyncing` guard** — prevents infinite scroll loops
3. **`requestAnimationFrame`** — ensures smooth updates without jank
4. **Client component required** — uses refs and event handlers

---

### § 8.3 Viewport-Locked Layout

The homepage uses a viewport-locked layout where the page fills exactly 100dvh with no page-level scroll.

**CSS Requirements (globals.css)**

```css
html,
body {
  height: 100dvh;
  max-height: 100dvh;
  overflow: hidden !important;
  margin: 0;
  padding: 0;
}
```

**Layout Structure**

```tsx
// Root layout — constrained to viewport
<body className="h-dvh overflow-hidden">
  {children}
</body>

// Homepage grid — fills viewport, internal scroll only
<div className="flex h-dvh flex-col overflow-hidden">
  <main className="flex min-h-0 flex-1 flex-col">
    {/* Hero section: shrink-0 (fixed height) */}
    {/* Three-column grid: flex-1 min-h-0 (fills remaining space) */}
  </main>
  <footer className="shrink-0">
    {/* Footer: fixed height at bottom */}
  </footer>
</div>
```

**Critical Classes**

| Class             | Purpose                                          |
| ----------------- | ------------------------------------------------ |
| `h-dvh`           | Exactly 100dvh (dynamic viewport height)         |
| `overflow-hidden` | NO page scroll                                   |
| `flex-1`          | Fill available space                             |
| `min-h-0`         | Allow flex children to shrink below content size |
| `shrink-0`        | Prevent shrinking (fixed-height sections)        |

**Common Mistakes**

❌ `min-h-dvh` — allows content to exceed viewport
❌ `overflow-auto` on body — creates page scrollbar
❌ Missing `min-h-0` — flex children won't scroll properly
❌ Footer outside main flex container — breaks viewport lock

---

### § 8.4 Prompt Builder Patterns (Added Dec 31, 2025)

The prompt builder uses a 9-category dropdown system with platform-specific optimization for 40 AI image generation providers.

#### Category Dropdown System

**Data Location:**

- Options: `src/data/providers/prompt-options.json`
- Platform formats: `src/data/providers/platform-formats.json`
- Types: `src/types/prompt-builder.ts`
- Logic: `src/lib/prompt-builder.ts` (1,738 lines)
- Colours: `src/lib/prompt-colours.ts` (210 lines) — SSOT for all 13 category colours
- Lifetime: `src/lib/lifetime-counter.ts` (33 lines) — prompt copy counter

**Category Schema:**

```typescript
type PromptCategory =
  | "subject" // Subject (identity + key attributes) - limit 1
  | "action" // Action / Pose - limit 1
  | "style" // Style / Rendering / References - limit 1
  | "environment" // Environment (location + time + background) - limit 1
  | "composition" // Composition / Framing - limit 1
  | "camera" // Camera (angle + lens + DoF) - limit 1
  | "lighting" // Lighting (type + direction + intensity) - limit 1
  | "colour" // Colour / Grade - limit 1
  | "atmosphere" // Atmosphere (fog, haze, rain, particles) - limit 1
  | "materials" // Materials / Texture - limit 1
  | "fidelity" // Quality boosters (8K, masterpiece, sharp focus) - limit 1
  | "negative"; // Constraints / Negative prompt - limit 5
```

> CategoryConfig interface removed — category metadata is now accessed via `getCategoryConfig(category)` which reads from prompt-options.json.

**12 Categories × ~100 Options (platform-aware limits):**

| Category    | Description                        | Options |
| ----------- | ---------------------------------- | ------- |
| Subject     | Identity + key attributes          | ~103    |
| Action      | Action / Pose                      | ~99     |
| Style       | Style / Rendering / References     | ~99     |
| Environment | Location + time + background       | ~100    |
| Composition | Framing                            | ~99     |
| Camera      | Angle + lens + DoF                 | ~99     |
| Lighting    | Type + direction + intensity       | ~99     |
| Colour      | Colour grade                       | ~99     |
| Atmosphere  | Fog, haze, rain, particles, mood   | ~99     |
| Materials   | Surface texture                    | ~100    |
| Fidelity    | Quality boosters (8K, masterpiece) | ~100    |
| Negative    | Constraints / Negative prompt      | ~961    |

Selection limits are **platform-aware** — different per tier. See `prompt-builder-page.md` for the full limits matrix.

#### Tier-Aware Assembly

The assembler uses a single entry point with tier-aware routing:

```typescript
function assemblePrompt(
  platformId: string,
  selections: PromptSelections,
  weightOverrides?: Partial<Record<PromptCategory, number>>,
): AssembledPrompt;
```

Routing logic inside `assembleTierAware()`:

| Condition                    | Sub-assembler                | Tiers          |
| ---------------------------- | ---------------------------- | -------------- |
| `tierId === 4`               | `assemblePlainLanguage()`    | Tier 4 (Plain) |
| `promptStyle === 'keywords'` | `assembleKeywords()`         | Tier 1 + 2     |
| Everything else              | `assembleNaturalSentences()` | Tier 3         |

**4 Platform Tiers (40 platforms):**

| Tier | Name             | Platforms | Prompt Style                                  |
| ---- | ---------------- | --------- | --------------------------------------------- |
| 1    | CLIP-Based       | 7         | Weighted keywords `(term:1.2)` + separate neg |
| 2    | Midjourney       | 1         | Keywords + `--no` params                      |
| 3    | Natural Language | 17        | Conversational sentences                      |
| 4    | Plain Language   | 15        | Short, focused prompts                        |

Platform config lives in `platform-formats.json` (31 entries + defaults). Tier assignments in `platform-tiers.ts` (199 lines). See `prompt-builder-page.md` for full platform lists.

#### Combobox Component Pattern

Multi-select dropdowns with custom entry follow this pattern:

```tsx
<Combobox
  id="category-subject"
  label="Subject"
  description="The main focus of the image"
  options={categoryOptions}
  selected={selectedValues}
  customValue={customInput}
  onSelectChange={(selected) => handleSelect(selected)}
  onCustomChange={(value) => handleCustom(value)}
  placeholder="Select subject..."
  maxSelections={5}
/>
```

**Accessibility Requirements:**

- `role="combobox"` on input
- `aria-expanded` indicates dropdown state
- `aria-controls` links to listbox
- Chip remove buttons have `aria-label`
- Full keyboard navigation (Tab, Enter, Escape, Arrow keys)

#### Full-Height Layout

The prompt builder fills the entire centre column height, aligning with exchange rails:

```tsx
// ProviderWorkspace
<div className="flex h-full min-h-0 flex-col">
  <PromptBuilder provider={provider} />
</div>

// PromptBuilder structure
<section className="flex h-full min-h-0 flex-col rounded-3xl bg-slate-950/70 ring-1 ring-white/10">
  <header className="shrink-0">...</header>
  <section className="min-h-0 flex-1 overflow-y-auto scrollbar-thin ...">...</section>
  <footer className="shrink-0">...</footer>
</section>
```

**Critical Classes:**

- `h-full min-h-0` — fills parent, allows shrinking
- `flex-col` — vertical layout
- `shrink-0` — fixed-height header/footer
- `flex-1 overflow-y-auto` — scrollable content area

#### Uniform Scrollbar Rule

All prompt builder scroll areas MUST use identical scrollbar styling to exchange rails:

```tsx
className =
  "overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30";
```

**Never use:**

- Browser default scrollbars
- Different scrollbar widths
- Different track/thumb colours

This ensures visual consistency across exchange rails, providers table, and prompt builder.
