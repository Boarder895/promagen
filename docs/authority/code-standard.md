# Promagen Code Standard (API-free edition)

**Last updated:** 9 January 2026  
**Version:** 2.3 (Console logging standards)  
**Scope:** Frontend code inside the `frontend/` workspace only.

---

## Quick Reference (10 Golden Rules)

Before diving into details, here are the 10 most important rules. If you remember nothing else, remember these:

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
type ProviderMode = 'live' | 'cached' | 'unavailable';
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
import type { Provider } from '@/types/provider';

// ❌ Wrong — uses plural, may break
import type { Provider } from '@/types/providers';

// ❌ Wrong — imports from internal file
import type { Provider } from '@/data/providers/providers.schema';
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

Avoid inline styles unless dynamic and unavoidable.

Keep styling consistent with the existing design system.

Spacing, typography, and colour use must match existing components.

No hard-coded pixel values unless already used in the system.

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
className =
  'inline-flex items-center justify-center gap-2 rounded-full border border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 px-4 py-1.5 text-sm font-medium text-purple-100 shadow-sm transition-all hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400 focus-visible:outline-none focus-visible:ring focus-visible:ring-purple-400/80';
```

**Breakdown:**

| Property   | Value                                                                   | Purpose                             |
| ---------- | ----------------------------------------------------------------------- | ----------------------------------- |
| Shape      | `rounded-full`                                                          | Pill-shaped button                  |
| Border     | `border border-purple-500/70`                                           | Subtle purple outline               |
| Background | `bg-gradient-to-r from-purple-600/20 to-pink-600/20`                    | Purple-pink gradient at 20% opacity |
| Text       | `text-sm font-medium text-purple-100`                                   | Small, medium-weight, light purple  |
| Padding    | `px-4 py-1.5`                                                           | Horizontal 16px, vertical 6px       |
| Hover      | `hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400` | Intensify gradient and border       |
| Focus      | `focus-visible:ring focus-visible:ring-purple-400/80`                   | Purple focus ring                   |

**When to deviate:**

Only deviate from this style if the user explicitly requests a different style. Document the deviation with a comment explaining why.

**Reference implementation:** `src/components/auth/auth-button.tsx`

---

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
import Tooltip from '@/components/ui/tooltip';

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
console.debug('[fx-selection] Pairs loaded:', pairs.length);
console.warn('[clerk-sync] Resolution conflict, clerk wins');
console.error('[gateway] API request failed:', error.message);
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

## Changelog

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
'use client';

import { useRef, useCallback } from 'react';

export function SyncedScrollContainers() {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const isSyncing = useRef(false);

  const syncScroll = useCallback((source: HTMLDivElement, target: HTMLDivElement) => {
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
  }, []);

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
      <div ref={leftRef} onScroll={handleLeftScroll} className="overflow-y-auto">
        {/* Left content */}
      </div>
      <div ref={rightRef} onScroll={handleRightScroll} className="overflow-y-auto">
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

The prompt builder uses a 9-category dropdown system with platform-specific optimization for 42 AI image generation providers.

#### Category Dropdown System

**Data Location:**

- Options: `src/data/providers/prompt-options.json`
- Platform formats: `src/data/providers/platform-formats.json`
- Types: `src/types/prompt-builder.ts`
- Logic: `src/lib/prompt-builder.ts` (763 lines)

**Category Schema:**

```typescript
type PromptCategory =
  | 'subject'
  | 'medium'
  | 'style'
  | 'lighting'
  | 'colour'
  | 'composition'
  | 'mood'
  | 'camera'
  | 'negative';

interface CategoryConfig {
  label: string;
  description: string;
  options: string[]; // Exactly 30 options per category
}
```

**9 Categories × 30 Options:**

| Category        | Description         | Max Selections |
| --------------- | ------------------- | -------------- |
| Subject         | Main focus of image | 5              |
| Medium          | Artistic technique  | 5              |
| Style / Genre   | Visual style        | 5              |
| Lighting        | Light conditions    | 5              |
| Colour Scheme   | Palette/tones       | 5              |
| Composition     | Framing/angle       | 5              |
| Mood            | Emotional tone      | 5              |
| Camera Details  | Lens effects        | 5              |
| Negative Prompt | What to exclude     | 10             |

#### Platform-Specific Assembly

Different AI platforms require different prompt syntax. The assembler routes to platform-specific functions:

```typescript
function assemblePrompt(platformId: string, selections: PromptSelections): AssembledPrompt {
  const family = getPlatformFamily(platformId);
  switch (family) {
    case 'midjourney':
      return assembleMidjourney(selections);
    case 'stable-diffusion':
      return assembleStableDiffusion(selections);
    case 'leonardo':
      return assembleLeonardo(selections);
    case 'flux':
      return assembleFlux(selections);
    case 'novelai':
      return assembleNovelAI(selections);
    case 'ideogram':
      return assembleIdeogram(selections);
    default:
      return assembleNatural(selections, platformId);
  }
}
```

**7 Platform Families:**

| Family           | Platforms                                 | Syntax Style                             |
| ---------------- | ----------------------------------------- | ---------------------------------------- |
| Midjourney       | midjourney, bluewillow                    | `subject, style --no negative`           |
| Stable Diffusion | stability, dreamstudio, lexica, etc. (10) | `masterpiece, (term:1.1)` + separate neg |
| Leonardo         | leonardo                                  | `term::1.1` weighting syntax             |
| Flux             | flux                                      | Keywords + quality suffix                |
| NovelAI          | novelai                                   | `{{{emphasis}}}` braces                  |
| Ideogram         | ideogram                                  | `without X` inline negatives             |
| Natural          | openai, dall-e, canva, etc. (26)          | Flowing sentences                        |

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
  'overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30';
```

**Never use:**

- Browser default scrollbars
- Different scrollbar widths
- Different track/thumb colours

This ensures visual consistency across exchange rails, providers table, and prompt builder.
