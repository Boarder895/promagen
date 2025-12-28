Promagen Code Standard (API-free edition)

Cleaned and aligned with the API Brain v2 separation
Scope: Frontend code inside the frontend/ workspace only.
Last updated: 2025-12-15

1. Purpose

The Promagen Code Standard defines how all frontend code is written, structured, tested, and maintained.
It ensures the entire project feels like it was built by one engineer, not twenty.

This document does not contain any API rules. Promagen uses a separate API Brain document for all provider/role/gateway logic.
This file governs frontend code only: components, hooks, state, styling, tests, analytics wiring, and static data.
Monetisation authority (SSOT)
Frontend code must never invent or imply “paid vs free” behaviour in isolation.

All paid/free boundaries are defined only in:
`C:\Users\Proma\Projects\promagen\docs\authority\paid_tier.md`

Hard rule: if a capability is not explicitly listed in `paid_tier.md`, it is free.

The frontend is allowed to render placeholders (loading, skeletons, empty states).
The frontend must not invent “demo” market data (fake prices, fake returns, fake movements). If live data is unavailable, we show an honest error/empty state.

Principles

Zero magic

One place for everything, everything in its place

Consistent naming

Strong TypeScript

Clean accessibility

Testable components

Easy to extend without rewrites
Non-regression by default: When adding or extending features, keep all existing features and external behaviour intact; changes must be additive unless explicitly approved and documented as breaking.
Scope-of-change rule (no collateral UI changes)

When a request says “change X”, treat X as the only allowed change.
Everything else is locked unless the request explicitly names it as in-scope — especially:
layout, colours, spacing, typography, animations, behaviour, data contracts, and performance characteristics.

If X cannot be implemented without changing anything else, you must re-scope it as a multi-feature change and document the collateral changes explicitly (ADD / REPLACE / REMOVE) before proceeding.
Operational enforcement (UI scope lock)

- Every feature request must include a one-line Scope Lock sentence:
  “Only change <X>; do not touch layout/colours/spacing/typography.”
  If it is missing, the assistant must add it explicitly to the task scope before making changes.

- For UI work, every Change List must include a UI invariants checklist:
  - Colours unchanged: ✅/❌
  - Layout unchanged: ✅/❌
  - Spacing unchanged: ✅/❌
  - Typography unchanged: ✅/❌
  - Breakpoints unchanged: ✅/❌

If any item is ❌, the change is no longer “change X only” and must be re-scoped as a multi-feature change with collateral changes explicitly listed (ADD / REPLACE / REMOVE) before proceeding.

2. One Truth Rule

Promagen is SSOT-first.

If something can be defined once as data (JSON) and reused everywhere, that is preferred.

Hardcoding data inside components is banned unless it is truly static UI text.

Examples

FX pair lists come from the FX SSOT JSON file.

Tabs come from the tabs JSON.

Provider lists and categories come from SSOT.

If you need to add/remove/reorder entries, you should be able to do it by editing one file.

3. File & Folder Structure (Frontend)

Canonical root for all frontend source code:
frontend/src/

Routing style:
Choose one routing style for the project and keep it consistent.
The app router (app/) is preferred. If the project is already using app/, do not add pages/.

Canonical folders (frontend/src/)

app/
Route segments, page/layout/error/loading files.
components/
UI components and feature components.
components/nav/
Global navigation components and routed tabs.

- Do not invent new `eventType` strings ad-hoc. All analytics-derived metrics must use the authoritative event taxonomy (allowed values + weights) and update the aggregator in the same change.
- Any scheduled aggregation endpoint must be idempotent + backfillable (upsert + protected “run now” trigger).

components/ui/
Reusable UI components (buttons, cards, tabs, chips, etc.).
components/ui/tabs/
In-page tab systems (content swap, same route).
data/
SSOT-driven static configuration and lists (FX pairs, tab lists, metadata).
hooks/
Custom hooks.
lib/
Shared helpers, pure logic, analytics helpers, route helpers, formatters.
lib/analytics/
Centralised analytics helpers and event catalogue.
lib/routes/
Centralised route definitions and helpers.
styles/
Global styles and CSS modules (only when Tailwind is not enough).
tests/ or src/tests/
Tests follow one convention, consistently.
utils/
Small pure helpers (if not already under lib/).

Shared test setup for the frontend:
frontend/src/setuptests.ts

Rules

Feature folders sit together; no scattering code across random locations.

Lowercase filenames (fx-widget.tsx, providers-table.tsx). Use kebab-case by default.
Do not remove, stub, bypass, or “simplify away” existing logic to make room for a new feature. If something must change, treat it as a deliberate feature change and document the impact.
Index files only when necessary (no wildcard dumping grounds).

No hidden side effects (modules do not modify global state on import).

No handwritten application code lives outside src/ except tooling (configs, scripts, etc.).

Generated artefacts are allowed, but only under a single, clearly marked folder:
frontend/generated/

Rules for frontend/generated/

- Contains build outputs consumed by the app (e.g. manifests, derived lookup tables).
- Must be deterministic (same inputs → same outputs).
- Must never be edited by hand.
- May include type-only companion files (.d.ts) adjacent to generated JSON when it keeps TypeScript strict and clean.
- src/ is allowed to import from frontend/generated/ when the import is read-only and the generated file is tracked/regenerated reliably.

Environment variable access is centralised; do not read process.env directly inside client components.
Vercel Pro production guardrails (Promagen):

- Any route capable of incurring upstream spend (start with `/api/fx`) must have platform guardrails:
  - Spend Management thresholds + monthly cap (cap action: pause production deployments).
  - WAF rules + rate limiting to prevent bot/traffic-spike spend.
- Authority: docs/authority/vercel-pro-promagen-playbook.md
  Pro-strengthening code rules (mandatory for every spend-bearing endpoint file)

Applies to:

- `frontend/src/app/api/*` routes that can incur upstream spend (start with `/api/fx`)
- outbound redirect routes (e.g. `/go/*`)
- any future endpoints that can trigger paid vendor/API calls

Authority (platform posture):

- C:\Users\Proma\Projects\promagen\docs\authority\vercel-pro-promagen-playbook.md

1. Make caching a first-class “cost control” contract

This is the biggest one for Promagen.

Bake in:

Explicit caching headers on /api/fx responses (and any spend-bearing endpoints) that match your Refresh Gate TTL.

Edge-friendly semantics (public, s-maxage, stale-while-revalidate) where safe.

No-cache/No-store for trace/admin endpoints.
Client fetch stance (anti-regression)

- For spend-bearing endpoints like `/api/fx`, client-side fetch must not set `cache: 'no-store'` / `reload`, add `Cache-Control: no-cache`, or append cache-busting query params.
- Use `credentials: 'omit'` unless the endpoint truly needs cookies; cookies can fragment/bypass CDN caching and defeat calming.

Why this strengthens Pro:

Pro gives you more edge headroom; your code decides whether you actually use the edge or accidentally force compute on every request.

2. Single-flight and request de-duplication (stop stampedes)

Bake in:

A “single-flight” lock so 50 concurrent requests to /api/fx don’t trigger 50 upstream calls.

A short in-memory or shared cache (depending on your architecture) so requests within the TTL return instantly.

A hard block on “force refresh” unless you explicitly allow it.

Why this strengthens Pro:

Even with Pro limits, upstream APIs cost money. De-duping protects spend and stabilises latency.

3. Rate limiting in app (defence in depth)

Even if you also use Pro WAF rate limiting, app-level throttling helps.

Bake in:

A lightweight per-IP/per-token rate limiter for spend-bearing endpoints.

A stricter limiter for /go/\* to stop open-redirect probing and bot storms.

Why this strengthens Pro:

Pro WAF is your front line; app rate limiting is your second line when traffic slips through.

4. Observability hooks that match Pro logging/analytics

Bake in:

Structured logs (JSON-ish) with consistent fields: route, request id, cache status, provider used, fallback used, duration, blocked-by-budget, etc.

Correlation IDs (request id passed through calls).

“Important events” logged once per request, not spammy console noise.

Why this strengthens Pro:

Pro gives you better log retention and observability options; structured logs mean you can actually use that retention to debug quickly.

5. Health endpoints + safe-mode switches

Bake in:

A /api/health that checks app config sanity (not upstream spend).

A “safe mode” env var (e.g., PROMAGEN_SAFE_MODE=1) that forces demo data or blocks paid calls.

A “kill switch” env var for specific providers.

Why this strengthens Pro:

When spend spikes or a provider breaks, you can flip a variable in Vercel and the app behaves safely immediately.

6. Security headers and hardening

Bake in:

Strict security headers (CSP, HSTS, X-Content-Type-Options, etc.) appropriate for Next.js.

Tight input validation for query params (especially /go/\* and any endpoint that accepts user input).

Disable or restrict trace routes in production by default.

Why this strengthens Pro:

Pro WAF helps, but secure defaults reduce attack surface and support the “platform guardrails”.

The Promagen truth: what matters most

If you bake only three things into code, make them these:

Cache headers that reflect your TTL and are CDN honest

Single-flight + caching to prevent upstream stampedes

Safe mode + kill switches via env vars

### If you want, I can make this concrete in your codebase

To do it properly, I need the actual current file contents for the key routes/middleware so I don’t invent structure (your “no hacks; fix properly” rule).

Paste/upload these files (or point me to them in src.zip if you want me to extract):

- frontend/src/app/api/fx/route.ts
- any /go/ route file (outbound redirect)
- frontend/src/middleware.ts (if you have it)
- your cache/refresh gate helper(s) (where TTL and budget are enforced)

Then I’ll return:

- Exact full-file replacements (no snippets)
- With “Existing features preserved: Yes”
- And the doc integration pointers updated accordingly

4. TypeScript Standards

Strict mode always enabled.

Never use any unless truly unavoidable, and then document why.

Prefer unknown over any when you need to accept “anything” and then narrow.

Prefer discriminated unions for variants and states.

Use named types and interfaces for all component props.

Prefer:

type ProviderMode = "live" | "cached";
type ProviderMode = "live" | "cached" | "unavailable";
over:

string

Avoid enums unless you truly need them.

Never type React state as any or object.

All data crossing component boundaries must be typed.

All JSON SSOT must have a TypeScript type.

5. React Component Rules

Components are pure.

Components do not fetch or mutate global state on import.

Client components never read process.env.

Server components may read environment only via a centralised server config helper (not inline).

Use functional components.

Always name components.

Avoid unnecessary re-renders:

- Memoise derived values with useMemo where it matters.
- Memoise callbacks with useCallback where it matters.
- Do not over-memoise trivial values.

Avoid “God components”.
If a component grows beyond reason, split it.

Keep data transformation out of JSX.
Compute values above return.

6. Styling Rules

Tailwind first.

CSS Modules only when Tailwind cannot express it cleanly.

Avoid inline styles unless dynamic and unavoidable.

Keep styling consistent with the existing design system.

Spacing, typography, and colour use must match existing components.

No hard-coded pixel values unless already used in the system.

7. Accessibility Rules

All interactive elements must be keyboard accessible.

All tab lists must have:

- proper roles
- arrow navigation
- Home/End behaviour
- focus management

All icons must have:

- aria-hidden if decorative
- aria-label if meaningful

All images must have alt text (or empty alt if decorative).

Animations must respect prefers-reduced-motion.

When there is dynamic status (loading, errors, changes), use:

- aria-live regions
- SR-only updates where appropriate

8. Tabs Architecture (Global Standard)

Promagen uses a gold standard tabs architecture:

Routed tabs:

- components/nav/
- Each tab is a route segment
- Active tab is determined by URL
- JSON-driven tab order

In-page tabs:

- components/ui/tabs/
- Tabs / InpageTab / TabPanel pattern
- Tab data comes from src/data/tabs/\*.json (single source of truth)
- Accessible defaults built in (ARIA roles, keyboard nav, SR-only live region)
- Reduced motion respected
- Overflow polished

Rules

All new tab systems must follow this architecture.

Do not build ad-hoc tab UIs in random components.

Do not hardcode tab labels or tab order in components.

When adding paid tier tabs, ordering and visibility rules must be JSON-driven and type-safe.

Any routing changes must update:

- route helpers in lib/routes
- analytics wiring in lib/analytics
- tests for active route highlighting and keyboard behaviour

9. Analytics Rules

Analytics is centralised.

No inline gtag calls inside components.

All analytics events go through:
frontend/src/lib/analytics/

Components call small, typed helpers, e.g. trackTabSelected(...), not window.gtag directly.

Events must be named consistently.

Avoid leaking PII.

10. Data Fetching Rules (Frontend Only)

Frontend fetches only from its own API routes (e.g. /api/fx), never directly from external vendors.

Do not call upstream providers from the frontend.
That is gateway/API Brain territory.

Use caching and server-side TTL at the API route level, not ad-hoc in components.

Client-side polling must be deliberate:

- Not by default
- Not every render
- Not multiple components doing the same poll

11. Error Handling Rules

Fail honestly.

If data is missing, show:

- a clean empty state
- a “data unavailable” message
- retry affordance where sensible

No “fake” values to hide errors.

For analytics-derived metrics: if data fails freshness checks or can’t be trusted, render blank/“—” and log a warning; never show fabricated or stale numbers just to “fill the UI”.

Log errors server-side where appropriate (API routes).

UI should never crash on malformed data:

- validate inputs
- guard optional fields
- default safely

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

12. Testing Rules

Jest config lives at repo root:
jest.config.ts

Frontend test setup lives at:
frontend/src/setuptests.ts

ResizeObserver and scrollIntoView polyfills must live in setupTests.

Rules

Tests must be stable.
No timing hacks.

Avoid brittle snapshots for dynamic UI.

When testing tab UIs:

- Arrow keys move focus correctly
- Home/End works
- Active tab updates properly
- Live region updates when relevant

Contract tests for /api/\* routes must validate:

- expected shape
- caching headers (where relevant)
- error mode behaviour

Data integrity lock-ins (anti-drift)

Any user-visible “meaning glyph” (emoji/icon) that represents a system state must be pinned by a tiny test so refactors cannot silently swap it.

Budget guard emoji lock-in (required):

- ok🛫 / warning🏖️ / blocked🧳
- The test must assert the mapping from SSOT (emoji-bank.json), not from ad-hoc constants in modules.

13. Data Files (Frontend Only)

All human-authored displayed data (static assets, lookup tables, mappings, exchange lists, commodity metadata, emoji banks, etc.) lives inside:

frontend/src/data/

Derived/generated data is allowed, but it must live outside src/ in:

frontend/generated/

This keeps src/data/ as the single source of truth (SSOT) for human-edited files, while still allowing fast, “known-good” generated manifests (like flags.manifest.json + flags.manifest.d.ts).

Rules

Use pure JSON or TypeScript modules.

No side effects (loading a data file must not run logic).

Stable, predictable format with typed definitions.

All shapes validated by tests (schema or type-shape tests).

Budget emojis are SSOT (no module-level constants)

Budget guard emojis must live in the Emoji Bank SSOT:

- File: frontend/src/data/emoji/emoji-bank.json
- Group key: `budget_guard` (must include `ok`, `warning`, `blocked`)

Rules:

- Do not define budget emojis as local constants inside providers/routes/components.
- Import them via the emoji helper layer so the UI and server cannot drift.
- No “unknown/?” fallback budget emoji is allowed; missing mappings must fail tests/builds.

Canonical mapping (non-negotiable):

- ok 🛫
- warning 🏖️
- blocked 🧳

A tiny integrity test must pin this mapping (ok🛫 / warning🏖️ / blocked🧳).

No API provider config lives here – that is handled exclusively by the API Brain.

FX-specific SSOT reminder:
The FX ribbon’s pair list and ordering must come from frontend/src/data/fx/fx.pairs.json (or the equivalent canonical file for the feature).
Do not hard-code pair arrays in components, routes, or tests — tests must read the same file.

14. Naming Rules

kebab-case filenames (lowercase only)

camelCase variables and functions

PascalCase components and classes

SCREAMING_CASE constants

No abbreviations unless universally known (fx, ui, utc).

Avoid suffix noise.
Prefer:
fx-pair-label.tsx
over:
fxPairLabelComponent.tsx

15. Code Quality Rules

No shims.
If something is a shim, it is a smell: fix the import path properly or remove the intermediate module.

No “temporary” code without a removal plan.

Do not remove, stub, bypass, or “simplify away” working logic to make a new feature fit; if behaviour must change, treat it as a deliberate breaking change and document the impact.

No console.log in committed code (use proper logging in server code where appropriate).

No unused imports.
No unused variables.
No eslint-disable unless justified with a comment.

Keep functions small and testable.

Prefer pure functions in lib/ over inline logic in components.

16. Versioning & Release Rules

Lint, typecheck, and tests must pass before release. At minimum:

Docs Gate Checklist: PR must include “Docs Gate: Yes/No + Target doc + insertion point” (details + authority enforcement live in promagen-api-brain-v2.md section 17.2.5–17.2.6).

Docs Gate Checklist: Before producing new code/files and before release, confirm the Docs-first gate was followed (authority lives in: C:\Users\Proma\Desktop\Promagen Files\Best_Working_Practice.md → “Docs-first gate” section).

[frontend/ (PowerShell)]
pnpm run lint
pnpm run typecheck
pnpm run test:ci

or, from repo root:

[Repo root (PowerShell)]
pnpm -C frontend run lint
pnpm -C frontend run typecheck
pnpm -C frontend run test:ci

Breaking UI changes must be documented (what changed and why).

Feature addition discipline (non-regression)

Every feature change set must include a short Change List using ADD / REPLACE / REMOVE bullets and a line stating “Existing features preserved: Yes/No” (Yes is the default expectation).

Any feature addition that touches existing behaviour must include at least one lock-in proof: a focused test, or a before/after behaviour note demonstrating identical external behaviour.

New tabs must follow the global tab architecture.
New pages must follow route organisation and analytics conventions.

Generated files policy

No auto-generated runtime files inside src/.

All generated artefacts must live in a clearly marked location outside the main source tree:
frontend/generated/

This includes generated JSON (manifests, derived maps) and any companion type declarations, e.g.:

- frontend/generated/flags/flags.manifest.json
- frontend/generated/flags/flags.manifest.d.ts

Why this exception exists
Type-only companion files next to generated JSON keep editors and TypeScript strict and clean without polluting src/ with build output.

Requirements

- Deterministic generation (same inputs → same outputs).
- Never edit generated files by hand.
- Generation scripts live under frontend/scripts/ and are run via pnpm scripts.
- CI must either: (a) regenerate and fail on diff, or (b) verify the generated artefacts are up-to-date.

17. What This Code Standard Does Not Cover

This document does not define:

API providers

API roles

API gateway behaviour

How data is fetched from external vendors

How backups/fallback providers work

Any part of the API Brain

All of that lives in:

➡️ promagen-api-brain-v2.md – the authoritative API system document.

The two documents are intentionally separate so each stays clean:
this file governs how we write frontend code; the API Brain governs how we talk to the outside world.

Linting, Typecheck & Test Fix Discipline (Gold Standard — Non-Negotiable)
When addressing ESLint, TypeScript typecheck, or test failures, apply the smallest possible, behaviour-preserving change. The sole goal is to restore a green build without changing or omitting any feature, and without altering user-visible behaviour, API/data contracts, side-effects, performance characteristics, caching/TTL behaviour, logging/telemetry semantics, or runtime control flow. Do not remove, stub, rename, bypass, or “simplify away” functional code purely to satisfy tooling.

Scope control: If compliance cannot be achieved without any behavioural change, the work must be explicitly re-scoped and reviewed as a feature change with a clear rationale and an agreed change list before implementation.

Required documentation for tooling-only fixes: Every lint/typecheck/test-fix change set must include a short Change List using ADD / REPLACE / REMOVE bullets and a line stating “Behaviour change: Yes/No”. “No” is the default expectation.

Required lock-in for logic-touching fixes: If a tooling fix touches runtime logic (not just types, imports, formatting, or lint configuration), you must add at least one lock-in proof: either a focused unit/contract test covering the affected behaviour, or a before/after sample output note demonstrating identical external behaviour.
