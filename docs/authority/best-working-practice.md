# Best Working Practice

**Last updated:** 29 March 2026

---

## Assistant Memory policy (how we use ChatGPT/Claude memory)

**Purpose:**
Memory is used only for stable working preferences and process rules (e.g., "one full file", "PowerShell only", "ask for missing files", "provide code as downloadable zip files"). It is not a source of truth for Promagen behaviour.

**Authority:**

- Canonical truth is the repo: `docs/authority/**` and the code + tests.
- Assistant memory must never override repo authority docs or failing tests.
- Vercel Pro optimisation playbook (spend caps + WAF rules + observability): `docs/authority/vercel-pro-promagen-playbook.md`
- Monetisation boundary SSOT (what is free vs paid): `docs/authority/paid_tier.md`

**Hard rule:** anything not written in `paid_tier.md` is free (standard Promagen). Any change to paid behaviour requires a docs update to `paid_tier.md` in the same PR.

**Limits:**

- Memory does not store your repo or file contents.
- In a new chat, the assistant may not have access to previous uploads; upload/paste the current file(s) when requesting edits.

---

## Terminology (Paid Tier Naming)

| Term                  | Definition                                                                                                                  |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Pro Promagen**      | The paid subscription tier. Always use "Pro Promagen" in user-facing text, never "paid", "premium", "plus", or other terms. |
| **Standard Promagen** | The free tier. If not explicitly listed in `paid_tier.md`, a feature is Standard Promagen (free).                           |

**UI usage:**

- CTAs: "Upgrade to Pro Promagen"
- Badges: "Pro Promagen" or "Pro"
- Tooltips: "Pro Promagen feature"
- Lock messages: "🔒 Pro Promagen Feature"

**Code usage:**

- Internal variables may use `isPaidUser`, `userTier === 'paid'` for brevity
- User-facing strings must always say "Pro Promagen"

---

## Security-First Development

**Purpose:** All code delivered must be as secure and unhackable as possible.

**Scope:** This applies to files that are **part of the current request**. The assistant should not audit the entire codebase uninvited.

**Hard rules:**

1. **Secure the work you're doing** — When modifying a file as part of a request, ensure that file is as secure as possible (input validation, sanitisation, proper auth checks, no secrets exposed).

2. **Don't audit uninvited** — Do not go through the entire src.zip looking for security issues in files that aren't part of the request. Stay focused on the task at hand.

3. **Flag obvious risks** — If you notice a glaring security issue in a file you're reviewing for context (not modifying), mention it but don't fix it unless asked.

4. **Validation at boundaries** — All user input, API responses, and external data must be validated before use.

5. **No secrets in code** — Never hardcode API keys, passwords, or tokens. Use environment variables.

6. **Auth checks on protected routes** — Every API route that should be protected must verify authentication server-side.

7. **Sanitise output** — Prevent XSS by properly escaping user-generated content.

**In short:** Make the code you're delivering bulletproof. Don't scope-creep into security auditing files outside the request.

---

## Operational rule (anti-drift)

- If the assistant is asked to update a file but the current exact file contents (or required dependencies) are not provided in the chat, the assistant must stop and request the file(s) rather than guessing.
- When returning a "full file replacement", it must be the COMPLETE file content (no omissions or shortening).
- No lines may be deleted or "simplified away" unless the user explicitly approves the change as REMOVE/REPLACE with line ranges.

## Test & Verification Command Format

**Purpose:** All verification instructions must use the project's npm scripts (via `pnpm`), never raw `npx` or global tool calls. This ensures consistent behaviour across machines and CI.

**Hard rules:**

1. **Always use `pnpm run` / `pnpm test`** — never `npx tsc`, `npx jest`, or bare tool names.
2. **Typecheck:** `pnpm run typecheck` (not `npx tsc --noEmit`)
3. **Run tests:** `pnpm test -- --testPathPattern="<pattern>" --verbose` (not `npx jest`)
4. **Lint:** `pnpm run lint` (not `npx eslint`)
5. **Full check:** `pnpm run check` (lint + typecheck)
6. **All output files must be presented as a zip with folder structure matching the repo** — so the user can "Open in Windows Explorer" and drag files into place.

**Correct format (copy-paste into every build part):**

```powershell
# Run at repo root: C:\Users\Proma\Projects\promagen
pnpm run typecheck
pnpm test -- --testPathPattern="<test-name>" --verbose
```

**Wrong format (never use):**

````powershell
# ❌ These bypass project config and may behave differently
npx tsc --noEmit
npx jest --testPathPattern="<test-name>" --verbose

---

## Schema and Type Consolidation Rules

**Authority:** `docs/authority/code-standard.md` §2 and §4

These rules prevent the "5 duplicate schemas" problem that caused 500 errors:

### One schema per data file

Every JSON SSOT file has exactly ONE Zod validation schema adjacent to it:

| Data file                               | Schema file                          |
| --------------------------------------- | ------------------------------------ |
| `data/providers/providers.json`         | `data/providers/providers.schema.ts` |
| `data/fx/fx-pairs.json`                 | `data/fx/fx.schema.ts`               |
| `data/exchanges/exchanges.catalog.json` | `data/exchanges/exchanges.schema.ts` |

Routes and loaders import from this canonical schema, never define their own.

### Singular type entry points

For major domain types, create a singular entry-point file that re-exports:

| Entry point           | Re-exports from  |
| --------------------- | ---------------- |
| `@/types/provider.ts` | `./providers.ts` |
| `@/types/exchange.ts` | `./exchanges.ts` |
| `@/types/fx-pair.ts`  | `./fx.ts`        |

All UI/route code imports from the singular entry point.

### No `.strict()` on subset schemas

When a route needs only a subset of fields, use `.passthrough()` mode:

```typescript
// ✅ Correct
const SubsetSchema = z.object({ id: z.string(), name: z.string() }).passthrough();

// ❌ Wrong — rejects extra fields, causes 500s
const SubsetSchema = z.object({ id: z.string(), name: z.string() }).strict();
````

---

## Git safety gate (anti-panic)

- No branch switching, merging, rebasing, resetting, or deleting until you have a safety point:
  - Either stash everything (tracked + untracked): `git stash push -u -m "SAFETY: before git surgery"`
  - Or create + push a rescue branch at the exact commit SHA: `git branch rescue/<n> <sha>` then `git push -u origin rescue/<n>`
- One move at a time: run `git status` and `git branch -vv` before and after every Git operation (no chaining commands).
- No guessing branch names or SHAs: copy/paste from `git branch -a`, `git log --oneline --decorate -n 20`, or the GitHub UI.
- Generated artefacts are volatile: do not "merge by hand" for these during conflict resolution:
  - `frontend/tsconfig.tsbuildinfo`
  - `frontend/.reports/latest.json`

  Pick one side (normally `main`) or remove them from tracking later.

- Conflict rule: never commit or run linters with conflict markers present. If any file contains `<<<<<<<`, stop and resolve first.

---

## How to use memory

- "Remember: <rule>" to store a stable preference/process.
- "Forget: <rule>" to remove it.
- UI consistency rules (design language invariants: card-only containers, spacing/radius tokens, border/shadow discipline)

---

## UI Consistency (anti-ugly drift): Card-only design language (global)

**Purpose:**
Promagen must feel calm and premium. Random container styles make pages feel "cheap" and users leave.

### Minimum text size and banned colours

**Minimum text size — 10px floor:**
No text in Promagen may render below 10px. Every `clamp()` min value for `fontSize` must be ≥ 10px (≥ 0.625rem). Em-based sizes in snap-fit containers must not compute below 10px at the minimum snap-fit base. The reference is the "6 categories" text in scene cards — that is the smallest acceptable text.

**Note:** Updated from 9px to 10px (18 March 2026). The previous 9px floor was too small for readability at standard viewing distance.

**Banned text colours:**
`text-slate-500` (`#64748b`) and `text-slate-600` (`#475569`) are banned. They are invisible on Promagen's dark backgrounds. Dimmest permitted: `text-slate-400` (`#94A3B8`). For subtler text, use `text-white/60` (opacity on white) instead of darker slate classes.

**Pro Promagen page — NO GREY TEXT (stricter rule):**
On `/pro-promagen` specifically, no grey text of any kind: no `text-slate-400`, no `text-slate-500`, no `text-slate-600`, no `text-white/30`, no `text-white/40`, no muted grey whatsoever. All text must be bright — white, brand colours (amber, emerald, pink, cyan, fuchsia), or category colours from `prompt-colours.ts`. This page sells the product; every word must be visible and vibrant. Added 19 March 2026 after repeated violations.

**Authority:** `code-standard.md` § 6.0.1, § 6.0.2

### Hard rules (non-negotiable)

**1. One box language only**

- Every visible container is a rounded "card" (panel).
- Every row/list item inside a container is a smaller rounded "card".
- No ad-hoc panels, stripes, hard-edged boxes, or one-off wrappers.
- If you think you need a new container style, you actually need a new _card variant_ (defined once, reused everywhere).

**2. Spacing > decoration**

- Premium is created by consistent padding, consistent gaps, and consistent corner radius — not by extra visual tricks.
- Use a single spacing scale (repeat the same p/x/y/gap values across pages).
- Use a single radius scale (e.g., outer cards = "large", inner cards = "medium", pills/chips = "full"). Do not invent new radii.

**3. Fixed Proportional Column Layout (multi-column cards)**

- When a card has multiple data groups (e.g., info | time | weather), use **fixed proportional columns** (e.g., 50%/25%/25%).
- All cards using the same pattern will have their columns align vertically at any screen size.
- First column (content-heavy): left-aligned. Subsequent columns (data): centered.
- Long text wraps within its column rather than truncating.
- Implementation: `grid-cols-[2fr_1fr_1fr]` for 50%/25%/25% split.
- Authority for implementation details: `docs/authority/code-standard.md` §6 (Fixed Proportional Column Layout).

**4. Universal `clamp()` Sizing (every visible dimension scales)**

Promagen is a desktop application with dynamic fluid scaling — no breakpoints, no mobile layouts. Every visible dimension must scale smoothly with viewport width using CSS `clamp()`. This applies to **all** of the following, not just text:

- **Text** — font sizes on every element
- **Icons** — width and height of SVG icons, status dots, image icons
- **Buttons** — padding, gap, min-height, font size
- **Gaps** — `gap` on flex and grid containers
- **Padding** — `padding` on panels, cards, sections, headers
- **Margins** — `margin-bottom`, `margin-top` for section spacing
- **Container dimensions** — fixed `height`, `width`, `min-height` on content zones
- **Image/flag wrappers** — wrapper div dimensions for `<Image fill />` elements

**Hard rule:** If a human can see it and it has a size, it uses `clamp()`. No fixed `px`. No fixed `rem`. No Tailwind size-class shortcuts (`h-4`, `w-6`, `gap-3`, `p-4`, `mb-4`, `text-sm`, `text-[10px]`) for anything that should scale with the viewport.

**The pattern:**

```css
property: clamp(MINIMUM, PREFERRED, MAXIMUM);
```

| Parameter   | Purpose                                    | Example |
| ----------- | ------------------------------------------ | ------- |
| `MINIMUM`   | Floor — never smaller than this (readable) | `12px`  |
| `PREFERRED` | Scales with viewport width                 | `0.9vw` |
| `MAXIMUM`   | Ceiling — never larger than this           | `16px`  |

**Standard scales — text (use these):**

| Element            | clamp value                         | Notes       |
| ------------------ | ----------------------------------- | ----------- |
| Body text          | `clamp(0.875rem, 1vw, 1rem)`        | 14px → 16px |
| Table text         | `clamp(0.8125rem, 1vw, 1rem)`       | 13px → 16px |
| Small/secondary    | `clamp(0.6875rem, 0.9vw, 0.875rem)` | 11px → 14px |
| Headings           | `clamp(1.25rem, 2vw, 1.75rem)`      | 20px → 28px |
| Data/monospace     | `clamp(0.75rem, 1vw, 0.875rem)`     | 12px → 14px |
| Tiny (icon labels) | `clamp(8px, 0.6vw, 11px)`           | 8px → 11px  |

**Standard scales — icons:**

| Element     | clamp value                | Notes            |
| ----------- | -------------------------- | ---------------- |
| Status dot  | `clamp(10px, 0.8vw, 14px)` | Green pulse dots |
| Inline icon | `clamp(12px, 0.9vw, 14px)` | Copy, clipboard  |
| Button icon | `clamp(18px, 1.5vw, 22px)` | Nav button icons |
| Large icon  | `clamp(36px, 3vw, 48px)`   | Provider logos   |

**Standard scales — spacing:**

| Element        | clamp value               | Notes                    |
| -------------- | ------------------------- | ------------------------ |
| Tight gap      | `clamp(4px, 0.5vw, 8px)`  | Between label+icon       |
| Standard gap   | `clamp(8px, 0.8vw, 12px)` | Between sections         |
| Panel padding  | `clamp(10px, 1vw, 16px)`  | Window inner pad         |
| Section margin | `clamp(8px, 1vw, 16px)`   | Between stacked elements |

**Standard scales — containers:**

| Element           | clamp value                                                 | Notes              |
| ----------------- | ----------------------------------------------------------- | ------------------ |
| Content zone      | `clamp(64px, 5.5vw, 84px)`                                  | MC instruction box |
| Icon button       | `clamp(48px, 4.2vw, 64px)` / `clamp(64px, 5.5vw, 84px)`     | EB icon grid       |
| Button min-height | `clamp(40px, 6vh, 60px)`                                    | Launch button etc  |
| Flag wrapper      | `clamp(18px, 1.5vw, 24px)` w / `clamp(14px, 1.1vw, 18px)` h | Country flags      |

**Implementation — Tailwind for appearance, inline `clamp()` for dimensions:**

```tsx
// ✅ Correct — Tailwind handles colour/shape/state, clamp() handles dimensions
<button
  className="inline-flex items-center justify-center rounded-full border
             border-purple-500/70 bg-gradient-to-r from-purple-600/20
             to-pink-600/20 font-medium text-purple-100"
  style={{
    fontSize: 'clamp(0.75rem, 0.85vw, 0.875rem)',
    padding: 'clamp(0.375rem, 0.5vh, 0.5rem) clamp(0.75rem, 1vw, 1rem)',
    gap: 'clamp(4px, 0.5vw, 8px)',
  }}
>
  Launch
</button>

// ❌ Wrong — Tailwind size classes for dimensions
<button className="text-sm px-4 py-1.5 gap-2">Launch</button>
```

```tsx
// ✅ Correct — icon with clamp() dimensions
<svg
  viewBox="0 0 24 24"
  style={{ width: 'clamp(18px, 1.5vw, 22px)', height: 'clamp(18px, 1.5vw, 22px)' }}
>...</svg>

// ❌ Wrong — fixed Tailwind icon classes
<svg className="h-5 w-5" viewBox="0 0 24 24">...</svg>
```

```tsx
// ✅ Correct — panel with clamp() padding and gap
<div
  className="relative rounded-3xl bg-slate-950/70 ring-1 ring-white/10"
  style={{ padding: 'clamp(10px, 1vw, 16px)' }}
>
  <div style={{ marginBottom: 'clamp(8px, 1vw, 16px)', gap: 'clamp(4px, 0.5vw, 8px)' }}>
    ...
  </div>
</div>

// ❌ Wrong — fixed Tailwind spacing
<div className="p-4">
  <div className="mb-4 gap-2">...</div>
</div>
```

```tsx
// ✅ Correct — flag image with clamp() wrapper
<div className="relative" style={{ width: 'clamp(18px, 1.5vw, 24px)', height: 'clamp(14px, 1.1vw, 18px)' }}>
  <Image src={flagSrc} alt={country} fill className="object-cover" />
</div>

// ❌ Wrong — fixed dimensions on Image
<Image src={flagSrc} alt={country} width={24} height={18} />
```

**Exceptions (where fixed values are acceptable):**

- Tailwind layout utilities that don't represent visible size: `flex-1`, `min-h-0`, `w-full`, `overflow-hidden`
- Structural classes: `rounded-full`, `rounded-3xl` (cosmetic border radius)
- Ring/focus/outline: `ring-1`, `focus-visible:ring` (accessibility indicators)
- Colour/opacity: `bg-slate-950/70`, `text-purple-100`
- `ml-auto` (layout push, not a dimensional value)
- Tooltips: may use fixed Tailwind text classes because they are portalled overlays
- Transition/animation properties: `transition-all`, `duration-200`

**Breakpoint text classes are banned:**

Never use Tailwind breakpoint text classes (`text-xs`, `sm:text-sm`, `xl:text-base`, `2xl:text-lg`, `min-[Xpx]:text-Y`) for responsive sizing. The root `html` font-size already scales with `clamp(16px, 1.1vw, 18px)`, so all rem-based Tailwind classes already scale proportionally with viewport width. Adding breakpoint overrides fights the system and produces no visible change. Use inline `style={{ fontSize: 'clamp(...)' }}` instead.

**Compliance check:** Search a component file for Tailwind size classes (`text-sm`, `h-4`, `w-6`, `gap-3`, `p-4`, `mb-4`, `text-[Npx]`). Every match that represents a visible, scalable dimension must be replaced with an inline `clamp()` style. If a PR introduces new fixed-size Tailwind classes for visible dimensions, it fails review.

**Existing example (exchange cards):**

```css
/* globals.css line 409 */
.providers-table {
  font-size: clamp(0.8125rem, 1vw, 1rem); /* 13px → 16px */
}
```

**Authority:** `docs/authority/code-standard.md` § 6.0 (Universal clamp() Sizing), Golden Rule #11

### Card shell discipline (what every card should look like)

- Shape: rounded rectangle (no sharp corners).
- Fill: muted charcoal/navy (dark dashboard base).
- Border: 1px hairline, low-contrast (faint outline only; never loud).
- Depth: subtle separation only (light shadow OR gentle inner glow — never heavy, never multiple competing effects).
- Padding: consistent per card type (outer vs inner), never "whatever looks right this time".

### Forbidden patterns (fast way to spot drift)

- Mixing square and rounded containers on the same page.
- Thick borders, bright outlines, or high-contrast dividers.
- Random padding/margins between similar components.
- More than 2–3 visual "depth levels" (page → card → inner card; keep it simple).
- Any "special case" wrapper that isn't a card.
- Multi-column cards where columns do not align vertically across all cards (use fixed proportional columns).

### Review gate (30-second check before shipping UI)

- Squint test: if you can see more than one box style, you broke the rule.
- Consistency test: same border weight, same radius family, same spacing rhythm across the page.
- Nesting test: sections are cards; rows are cards; nothing free-roams.
- Alignment test: stack multiple cards; if data columns (time, weather) do not align vertically, fix before shipping.

---

### Animation placement (component-first rule)

**Purpose:** Keep `globals.css` lean. Animations are almost always component-specific.

**Gold standard: Animations belong in the component file unless explicitly told otherwise.**

| Approach                                              | When to Use                                                                                                                                        |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Inline in file (Tailwind classes / inline styles)** | Component-specific animations used only in that one component. Keeps everything self-contained, easier to maintain, no hunting through globals.css |
| **globals.css**                                       | Shared animations used across multiple components, or complex keyframes that Tailwind cannot express easily                                        |

**Default rule:** Always put animations in the component file itself unless the user explicitly says otherwise. `globals.css` is already too big.

**Quick decision:**

- "Is this animation used in 3+ places?" → globals.css
- "Is this animation unique to this component?" → keep it in the file

**Authority:** `docs/authority/code-standard.md` § 6.2 (Animation Placement Standard)

**Phase 4 pattern — co-located `<style>` tags:**

When a component needs CSS `@keyframes` that Tailwind cannot express (e.g., multi-step transforms), use a `<style dangerouslySetInnerHTML>` block inside the component with a constant string. This keeps animations in the file without globals.css. See `explore-drawer.tsx` and `scene-selector.tsx` for reference implementations.

```tsx
const COMPONENT_STYLES = `
  @keyframes my-fade-in {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .my-class { animation: my-fade-in 0.2s ease-out; }
`;
// Then in JSX:
<style dangerouslySetInnerHTML={{ __html: COMPONENT_STYLES }} />;
```

### Accessibility patterns (interactive element rules)

**Purpose:** Prevent ESLint a11y violations and ensure screen reader compatibility.

**Hard rules:**

1. **Only `<button>`, `<a>`, `<input>`, `<select>` get `onClick`/`onKeyDown` handlers.** Never put interactive handlers on `<div>`, `<span>`, `<li>`, or other non-interactive elements. If you need a clickable area, use `<button type="button">`.

2. **Confirmation/upgrade dialogs** use `role="dialog"` and `aria-modal="true"`. Backdrop dismissal uses a `<button>` element (not a `<div onClick>`).

3. **Document-level keyboard listeners** go in `useEffect` with cleanup. Never use `onKeyDown` on `<div role="region">` or other non-interactive containers.

4. **Accordion patterns:** Parent manages state (which is expanded). Trigger is a `<button>` with `aria-expanded`. Content uses `role="region"` with `aria-label`.

**Reference implementations:**

- Confirmation dialog pattern: `scene-selector.tsx` (lines 766–812)
- Escape key handling: `explore-drawer.tsx` (lines 272–280)
- Accordion: `prompt-builder.tsx` + `explore-drawer.tsx`

### Content-driven sizing (when content doesn't breathe)

**Purpose:** Establish a standard approach for when UI content clips, overflows, or doesn't have room to breathe on smaller screens.

**Hard rule:** Never use magic-number pixel thresholds to decide layout changes (e.g., `MIN_HEIGHT = 55px` to hide a row). These break when content changes. Instead, **measure real content** and let the measurements drive the decision.

**The approach:**

1. Render actual content in an offscreen measurer (`display: inline-block`, no overflow hidden)
2. Read `scrollWidth` / `scrollHeight` — the true content size at the current font
3. Compare against available space + breathing room (`BREATHING_ROOM_PX`)
4. If it fits → keep the layout. If not → gracefully degrade (hide a row, shrink font)

**Key principles:**

- Always add breathing room — content should never sit flush against edges
- Decide font size and layout together in a single pass (avoids oscillation)
- Use `ResizeObserver` to trigger re-measurement, not window resize events
- Prefer graceful degradation over clipping (hide content rather than crop it)

**Reference implementation:** `commodities-movers-grid.tsx` v3.0
**Authority:** `code-standard.md` § 6.3, `commodities.md` § Panel Sizing

### Text containment (no text escapes its window)

**Purpose:** Prevent text from overflowing, wrapping beyond, or visually escaping its containing panel/card/window. This is especially critical for fixed-height containers where text that escapes looks broken and unprofessional.

**Hard rule:** All text within fixed-height containers must be visually contained. No text may overflow, push beyond, or escape its parent container boundary under any viewport size.

**The pattern (three properties working together):**

```tsx
{
  /* Wrapper div — clips content AND allows flex shrinking */
}
<div className="flex-1 overflow-hidden min-h-0">
  {/* Text element — single line, ellipsis if too wide */}
  <p className="truncate">Your text here</p>
</div>;
```

| Property          | What it does                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------- |
| `overflow-hidden` | Clips anything that exceeds the div's boundary                                                                |
| `min-h-0`         | Overrides flex default `min-height: auto`. Without this, flex children refuse to shrink below content height. |
| `truncate`        | Forces `white-space: nowrap` + `text-overflow: ellipsis` — prevents text wrapping to a second line            |

**When to use `truncate` vs wrapping:**

- **Single-line labels/status text:** Use `truncate` (ellipsis is better than overflow)
- **Multi-line content (prompts, descriptions):** Use `overflow-hidden min-h-0` on wrapper + `line-clamp-N` on text if line count must be limited
- **Always:** The parent container must have `overflow-hidden` to act as the final safety net

**Forbidden patterns:**

- Text inside a fixed-height flex child without `min-h-0` (text will push beyond container)
- Relying solely on outer `overflow-hidden` without `min-h-0` on intermediate flex children (flex ignores parent overflow constraints by default)
- Animated/pulsing text without containment (animation can cause reflow that escapes)

**Authority:** `code-standard.md` § 6.4

### Window boundary containment (nothing in, nothing out)

**Purpose:** Every panel in the Promagen grid — Engine Bay, Mission Control, Hero Window, exchange cards, FX ribbons, commodity grids — is a self-contained visual unit. Nothing inside any window may overflow or escape its boundary, and nothing from outside may bleed into any window. This is an architectural rule built into every component from the start, not patched on after the fact.

**Hard rules (non-negotiable):**

1. **Nothing escapes outward** — All content within a window (text, icons, glows, gradients, absolutely positioned children, animations) must stay inside the window boundary. If it doesn't fit, it clips or scrolls — it never paints outside.
2. **Nothing enters from outside** — Adjacent components (exchange cards, ribbons, overlays, glow effects) must not visually bleed into any window. Each window is a hard visual boundary.
3. **Only tooltips may overlay** — The sole exception to the boundary rule is tooltips. Tooltips are portalled overlays that render above everything via high `z-index`. No other element — no glow, no gradient, no absolutely positioned child, no animation — may render on top of another window's content.
4. **Built from the start** — These containment rules apply at component creation time, not as a retrofit. Every new child element added to any window must respect the boundary without requiring a separate containment fix.
5. **No `contain: paint` or `contain: layout`** — These CSS containment properties create new stacking contexts and containing blocks that break grid positioning. Do not use them on window containers. Use targeted `overflow-hidden` on inner elements instead.
6. **Containment is internal, not external** — The outer container div of each window must NOT have `overflow: hidden` or `style` props added to enforce containment. Containment is achieved by ensuring every child element inside the window is properly sized, clipped, and constrained within its own bounds.
7. **`clamp()` gaps enforce separation** — The gap between windows is controlled exclusively by the unified grid's `GRID_GAP` constant (a single `clamp()` value defined once in `homepage-grid.tsx`). Individual windows must not add external margins (`mb-4`, `mt-2`, etc.) that compete with the grid gap. If a window needs internal spacing, use `padding` with `clamp()` — never external margin.

**How to achieve containment without breaking layout:**

- Inner scrollable areas: `overflow-y-auto` with `min-h-0` and `flex-1`
- Single-line text: `truncate` (ellipsis) on the text element
- Multi-line text: `line-clamp-N` on the text element, `overflow-hidden min-h-0` on its wrapper
- Glow/gradient decorations: use `pointer-events-none` and constrain with percentage-based sizing relative to the window, not absolute positioning that escapes
- Absolutely positioned children: must have explicit bounds (`top`/`bottom`/`left`/`right` or `inset`) that keep them within the window's padding box

**Forbidden patterns:**

- Adding `overflow: hidden`, `contain: paint`, or `contain: layout` to the outer window container div (breaks grid positioning and stacking)
- Absolutely positioned elements without bounded constraints (they escape)
- Box shadows or glows that extend beyond the window boundary without clipping
- Child components that use `position: fixed` (escapes all containment)
- Negative margins that pull content outside the window edge

**Compliance check:** Inspect both windows at multiple viewport sizes. Draw an imaginary box around each window's border. Nothing should be visually outside that box, and nothing from adjacent components should be visually inside it.

**Authority:** `code-standard.md` § 6.5

### Unified Grid Architecture (grid is the single source of truth)

### Equal-gap card spacing (one system, never two)

**Purpose:** When cards live inside a flex/grid container that controls their height, the internal vertical spacing (gap above first line, between lines, below last line) must be controlled by exactly one CSS mechanism.

**The problem:** Mixing `padding` (all four sides) with `align-content: space-evenly` causes double-stacking — the top gap becomes padding + space-evenly gap, while the bottom gap appears smaller because content fills downward into it. This is invisible in code review and only shows on screen.

**The rule — pick one, never both:**

| Approach                | Card padding                         | Inner layout                                    | Parent sizing        | When to use                                    |
| ----------------------- | ------------------------------------ | ----------------------------------------------- | -------------------- | ---------------------------------------------- |
| **Content-sized**       | `padding` all sides                  | `flex-col` with `gap`                           | `shrink-0`           | Cards dictate own height, simple, always works |
| **Viewport-controlled** | `paddingInline` only (zero vertical) | `display: grid` + `align-content: space-evenly` | `flex: N 1 0%` ratio | Cards fill assigned space with equal gaps      |

**Never mix approaches** — that's what causes "gap above is huge, bottom line touches the edge."

**Container query units (`cqh`) are not the answer** for card spacing. They scale text with container height but don't solve spacing distribution. `container-type: size` changes the containing block and creates unexpected layout side effects.

**When building layout without a browser preview:** Ship one layout change per build. Screenshot, diagnose, then change one thing. Multiple layout changes compound errors invisibly.

**Reference implementation:** `src/components/pro-promagen/feature-control-panel.tsx` (v2.0.0+)

**Authority:** `code-standard.md` § 6.10

**Purpose:** The Promagen homepage uses a single CSS grid that owns all column definitions, row flow, and inter-panel spacing. No panel is "master" or "slave" — the grid is the only source of truth for positioning. Height changes to any panel just work because CSS vertical flow handles that natively.

**Hard rules (non-negotiable):**

1. **One shared grid** — Define one grid. Engine Bay and Mission Control sit in the top row (left and right columns). Exchanges sit in the row below. The centre column holds the Hero Window, FX ribbons, and providers table. Same column definitions, same `clamp()` gaps. Neither panel is master or slave.

2. **One `GRID_GAP` constant** — A single `clamp()` value controls ALL spacing between cells (column gaps between left/centre/right AND vertical gaps between stacked panels within each column). Defined once in `homepage-grid.tsx`, never overridden by child components.

```tsx
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

4. **Column stacking uses flex with `clamp()` gaps** — Within each column, panels stack vertically in a flex container. The flex gap is the same `GRID_GAP` constant:

```tsx
<div className="flex min-h-0 flex-1 flex-col" style={{ gap: GRID_GAP }}>
  <EngineBay /> {/* shrink-0 — takes its natural height */}
  <ExchangeRailEast />{" "}
  {/* flex-1 — fills remaining space, scrolls internally */}
</div>
```

5. **No external margins on panels** — Panels must not apply external margins (`mb-4`, `mt-2`, etc.). All inter-panel spacing comes from the grid gap or the flex gap of the column container. Internal spacing uses `padding` with `clamp()`.

6. **Column widths use `clamp()`** — Side columns use `clamp(180px, 15vw, 260px)` or similar. The centre column uses `1fr` to fill remaining space. This ensures the layout scales fluidly without breakpoints.

**Visual reference:**

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

**Why this matters — what went wrong before:**

- Panels set their own margins → double spacing in some gaps, collapsed spacing in others
- Panel A read Panel B's height to sync → changes to one broke the other
- Fixed pixel column widths → looked wrong on ultrawides and small monitors
- Grid gap and panel margins both contributed spacing → impossible to predict total gap

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

**Authority:** `code-standard.md` § 6.6, Golden Rule #12

---

## Docs-first gate (no code until docs are read + doc-delta captured)

**Purpose:**
Stop drift. If the docs are the authority, then code must never be produced "in front of" the docs.

**Hard rule:**
Before any new code or new files can be written, the assistant must read the current authority docs set, decide whether any doc needs updating, and (if needed) provide a paste-ready doc update plan first.

### Line-specific edit map (REQUIRED when updating an existing document)

- **ADD:** "Insert after line X" (or "Insert between lines X and Y")
- **REPLACE:** "Replace lines X–Y with:" + paste the full replacement block
- **REMOVE:** "Delete lines X–Y" (and state why, in one sentence)

When you ask "does anything need updating in the docs?" or "tell me which lines need deleting or amending": the assistant must answer with the exact line range(s) to REMOVE/REPLACE (not just the heading name).

### Authority docs list (keep filenames exactly as written — GitHub is case-sensitive)

**Core authority docs:**

- `docs/authority/code-standard.md` ← Frontend code rules (v4.0 — Universal clamp(), Unified Grid, Window Containment, No Grey Text)
- `docs/authority/best-working-practice.md` ← This file
- `docs/authority/architecture.md` ← Full architecture overview (data feeds + AI engine + auth/payments)
- `docs/authority/paid_tier.md` v8.0.0 ← Monetisation boundary SSOT
- `docs/authority/test.md` ← Master test document (replaces test-in-place, test-strategy-plan, test-groups, test-gap-analysis)

**AI Intelligence Engine docs:**

- `docs/authority/ai-disguise.md` v5.0.0 ← Prompt Lab AI engine, v4.5 system prompt, post-processing pipelines, negative prompt rendering, harmony scoring
- `docs/authority/harmonizing-claude-openai.md` v3.0.0 ← Three-assessor harmony engineering playbook, 7 proven patterns, Call 2 v4.5 fix programme, Call 3 builder architecture
- `docs/authority/prompt-lab-v4-flow.md` v2.0.0 ← Check→Assess→Decide→Generate four-phase flow, Call 2 v4.5 status
- `docs/authority/prompt-lab.md` v4.0.0 ← Studio section routes, Prompt Lab architecture, negative prompt window, race condition guards
- `docs/authority/unified-prompt-brain.md` ← One Brain assembly architecture
- `docs/authority/prompt-optimizer.md` v6.0.0 ← Client-side 4-phase optimizer + Call 3 server-side (43 independent builders, compliance gates, server-side charCount)
- `docs/authority/prompt-intelligence.md` ← Intelligence layer, 12 categories, DNA scoring
- `docs/authority/human-sentence-conversion.md` ← Call 1 spec
- `docs/authority/trend-analysis.md` v6.0.0 ← Platform scoring data, dual-assessor trend tracking
- `docs/authority/harmony-anti-regression.md` ← Call 3 harmony pass anti-regression rules

**Data feed and gateway docs:**

- `docs/authority/promagen-api-brain-v2.md` ← API system document
- `docs/authority/ribbon-homepage.md` ← Finance ribbon architecture
- `docs/authority/fly-v2.md` ← Fly.io deployment
- `docs/authority/api-calming-efficiency.md` ← 17 calming techniques
- `docs/authority/commodities.md` ← Commodities system
- `docs/authority/api-documentation-twelvedata.md` ← Vendor reference snapshot (read-only)

**Platform and provider docs:**

- `docs/authority/prompt-builder-page.md` ← Prompt builder page architecture
- `docs/authority/ai_providers_affiliate.md` v2.0.0 ← AI providers affiliate and referral rules, negative support audit
- `src/data/providers/platform-config.json` + `platform-config.ts` ← **Platform SSOT** (40 platforms — limits, tiers, negativeSupport, idealMin/Max, architecture)
- `docs/authority/Prompt_Engineering_Specs_for_44_AI_Image_Platforms.md` ← Platform tier classification and routing logic

**Infrastructure docs:**

- `docs/authority/clerk-auth.md` ← Auth (Clerk) integration
- `docs/authority/stripe.md` ← Payments (Stripe) integration
- `docs/authority/vercel-pro-promagen-playbook.md` ← Vercel Pro guardrails
- `docs/authority/ga4-gtm-nextjs-vercel.md` ← Analytics integration
- `docs/authority/human-factors.md` ← 18 human factor principles

### No-duplication rule (prevents doc bloat)

- Not all docs need updating for every change.
- The assistant must update only the single "best-fit" document for the topic to avoid duplication.
- If another doc needs awareness, add a single-line pointer ("Authority for this rule lives in: <doc>"), not a second full copy.

### Required "Doc Delta" preface (must appear before any code/files are produced)

- Docs read: Yes (list the authority docs read)
- Doc updates required: Yes/No
- If Yes:
  - Target doc: <full path>
  - Reason: <what changed / what is drifting>
  - Exact insertion point: <heading name or line range>
  - Paste-ready text: <full block to insert>
- Only after the Doc Delta is captured may code or new files be produced.

### Definition of "needs a doc update" (detailed, not vague)

A doc update is required whenever a change affects any of:

- Behavioural contracts (API shapes, modes, flags, caching, budgets, trace)
- SSOT sources/paths, ordering rules, formatting rules (e.g., AUD / GBP label constraints)
- Schema or type definitions (new schema location, type entry point changes)
- Analytics/tracking behaviour (events, GTM/GA4 wiring, consent/PII rules)
- Analytics-derived UI metrics (e.g., Promagen Users flags, Online Now presence)
- Deployment/runtime policy (Vercel/Fly env vars, secrets, headers, cache behaviour)
- Provider integrations (rate limits, symbol formats, call limits, quotas, budget guard logic)
- Testing invariants (new lock-in tests, renamed exports, type shape expectations)
- **Harmony post-processing** (any change to Call 2 post-processing functions in `src/lib/harmony-post-processing.ts`, Call 3 post-processing in `src/lib/optimise-prompts/harmony-post-processing.ts`, compliance functions in `harmony-compliance.ts`, lookup set sizes, rule ceiling, or system prompt rules requires updating `ai-disguise.md` §7 and running the harmony test suite)
- Prompt builder category options or platform format rules changed
- Voting system mechanics or activation requirements changed

---

## Harmony Engineering Workflow (AI Tier Generation)

**Purpose:** The Prompt Lab's AI tier generation system (Call 2) and platform-specific optimisation (Call 3) use GPT-5.4-mini at runtime, with system prompts written by Claude at development time. This creates a unique engineering challenge that requires specific workflows.

**Authority:** `ai-disguise.md` v5.0.0 (§7 post-processing, §8 harmony engineering), `harmonizing-claude-openai.md` v3.0.0 (full methodology, three-assessor calibration, Call 2 v4.5 fix programme, Call 3 builder architecture)

### Read before modifying

Before touching any post-processing code, read these files first:

| File                                                  | Lines   | What it contains                                                                           |
| ----------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------ |
| `src/lib/harmony-post-processing.ts`                  | **272** | Call 2 post-processing (5 active functions). Imported by `generate-tier-prompts/route.ts`. |
| `src/lib/optimise-prompts/harmony-post-processing.ts` | **439** | Call 3 post-processing (7 active functions). Imported via `resolve-group-prompt.ts`.       |
| `src/lib/harmony-compliance.ts`                       | **833** | Compliance gate + rule ceiling tracking (`RULE_CEILING = 30`, `CURRENT_RULE_COUNT = 30`).  |
| `src/app/api/generate-tier-prompts/route.ts`          | **650** | Call 2 route. v4.5 system prompt. Temperature 0.5, max_completion 2000.                    |
| `src/app/api/optimise-prompt/route.ts`                | **406** | Call 3 route. 43 independent builders. Temperature 0.4 prose / 0.2 CLIP.                   |

**Note:** Harmony test files (`harmony-post-processing.test.ts`, `harmony-compliance.test.ts`) were documented at 601+453 lines — not present in current src.zip (may be excluded or relocated).

### Harmony test suite

All harmony tests must pass before shipping any changes to the post-processing pipeline or system prompt rules. Run:

```powershell
# From: C:\Users\Proma\Projects\promagen\frontend
pnpm test -- --testPathPattern="harmony" --verbose
```

Any red test = post-processing drift. **Fix the code, not the test.** The only exception is adding new lookup set entries (requires updating both code and drift detection count).

### Extraction pattern

**Call 2:** 5 active functions in `src/lib/harmony-post-processing.ts` (272 lines): `deduplicateMjParams`, `stripTrailingPunctuation`, `fixT4SelfCorrection`, `fixT4MetaOpeners`, `mergeT4ShortSentences`. T1 also gets `enforceWeightCap` from compliance. P11 and P12 were removed from Call 2 on 28 Mar 2026 and now exist only in Call 3.

**Call 3:** 7 active functions in `src/lib/optimise-prompts/harmony-post-processing.ts` (439 lines): all 5 from Call 2 plus `fixT3MetaOpeners` (P11) and `stripClipQualitativeAdjectives` (P12).

**Never move functions back into route files** — the extraction enables testability. **No Call 3 builder may import from another builder** — complete isolation prevents cross-platform regressions.

### Rule ceiling

The system prompt has 30 rules. The ceiling is enforced by `RULE_CEILING` in `harmony-compliance.ts` with a test assertion (`RULE_CEILING = 30`, `CURRENT_RULE_COUNT = 30`). Adding a new rule requires either:

- Replacing an existing rule
- Building a post-processing code fix instead (preferred for mechanical artefacts)
- Explicit Martin approval to raise the ceiling

### Three-assessor methodology (v3.0.0)

For system-wide calibration (e.g., Call 2 v4.0→v4.5 fix programme), use three independent assessors: **Claude, ChatGPT, and Grok**. The triangulated median is the standard. This revealed a critical calibration finding: **Claude scores T3 approximately 5–6 points too high and T4 approximately 3–5 points too high** compared to the ChatGPT/Grok median. Claude under-penalises verb substitutions and anchor drops.

For individual Call 3 builder harmony passes, **dual assessment (Claude + ChatGPT) is sufficient** — the harmony pass methodology is: send platform facts + blank canvas to ChatGPT → receive system prompt → test against Lighthouse Keeper → score → write builder.

Single-assessor testing is an anti-pattern. See `harmonizing-claude-openai.md` v3.0.0 §2 for the full cycle.

### Playground-first workflow (v3.0.0)

System prompts must be validated in **OpenAI Playground** (GPT-5.4-mini, `json_object` response format, reasoning effort: medium) targeting **95+** before being coded into builder files. Skipping this step (as happened with Wave 4/Canva) caused long debugging cycles; following it (Waves 5–7) produced first-time 95/100 results. The Playground acts as an isolated test bed — no providerContext token overhead, no API route plumbing, just the system prompt and test input.

### Verify before modifying (v3.0.0)

All code changes must be traced to actual file contents. **Never assume from memory or prior session context.** When `src.zip` is uploaded, it is the ground truth — always extract and use those files, not cached copies. This principle was established after a session where assumed file state led to incorrect patches.

### Deterministic fixes belong in code, not prompts (v3.0.0)

If a bug can be expressed as deterministic logic, it **must** be a compliance gate or post-processing function — not a prompt rule. Examples: T1 syntax enforcement (`enforceT1Syntax`), negative contradiction detection (`enforceNegativeContradiction`), weight cap (`enforceWeightCap`). This is the highest-reliability approach and does not consume GPT attention budget.

### Config entries cause silent misrouting (v3.0.0)

Missing or incorrect config entries in `platform-config.json` cause high-impact, non-obvious failures. The Recraft bug (score 72→95 after adding one JSON entry) and the proseGroups set bug (28/40 platforms receiving wrong input framing and wrong temperature) both demonstrate this. When adding platforms or changing tiers, audit all config paths.

### Claude must flag architectural problems proactively (v3.0.0)

If Claude notices an architectural problem, inefficiency, or consolidation opportunity, it must flag it immediately — no code, just the observation. Don't wait to be asked. The three-file config structure (`platform-formats.json` + `prompt-limits.json` + `compression/platform-support.json`) was a consolidation candidate that should have been flagged proactively before it caused data bugs.

---

## Git safety protocol (no-lost-work rule)

When Git says **"your local changes would be overwritten"**, do **not** try random merges, deletes, or "reset hard". Do this every time, in this order:

**1. Make a safety snapshot (pick one)**

- Option A (stash, includes untracked): `git stash push -u -m "SAFETY: before merge/pull"`
- Option B (rescue branch): `git checkout -b rescue/<short-name>` then `git commit -am "WIP: safety snapshot"`

**2. Update `main` safely**

- `git checkout main`
- `git pull --ff-only origin main`

**3. Bring your work back**

- If you had a branch: `git checkout <your-branch>` then `git merge origin/main`
- If you only have a commit hash: `git checkout -b recover/<n> <hash>` then `git push -u origin recover/<n>`

**4. Resolve conflicts properly**

- Remove **all** conflict markers: `<<<<<<<`, `=======`, `>>>>>>>` (never commit them)
- Prefer **incoming** when `main` has a rename/refactor you must align to
- Prefer **current** when it's your intentional behaviour change you want to keep
- Use **both** only when changes are additive and non-overlapping

**5. Verify before pushing**

```powershell
# From repo root
pnpm -C frontend lint
pnpm -C frontend typecheck
pnpm -C frontend test:ci
```

**6. Never run these when you're stressed**

- `git reset --hard`
- `git clean -fd`
- deleting remote branches

Rule of thumb: _if you can't explain what a command does to HEAD + working tree, don't run it._

---

## Deployment Resilience (zero-downtime for active users)

**Purpose:**
Ensure users browsing Promagen during a Vercel deployment don't experience errors or broken UI due to stale JS bundles.

**Problem:**
When Vercel deploys a new version, active users still have old JS bundles cached in their browser. If they navigate (client-side) and Next.js tries to lazy-load a chunk that was renamed or removed in the new deployment, they get a `ChunkLoadError` (404 for the missing chunk).

### Two-layer protection (belt and suspenders)

| Layer                         | Mechanism            | What it does                                                      |
| ----------------------------- | -------------------- | ----------------------------------------------------------------- |
| **1. Vercel Skew Protection** | `vercel.json` config | Keeps old deployment assets available for 7 days after new deploy |
| **2. ChunkErrorBoundary**     | React error boundary | Catches chunk load failures and auto-reloads the page             |

Both layers should be active. Skew Protection prevents most issues; the error boundary catches edge cases and provides graceful recovery.

### Skew Protection configuration

**File:** `frontend/vercel.json`

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "skewProtection": "7d"
}
```

**How it works:**

- Vercel keeps previous deployment assets available for the specified duration
- Users with old bundles can still load chunks from the previous deployment
- No code changes required — purely platform-level protection

**Requirement:** Vercel Pro plan (Promagen has this)

### ChunkErrorBoundary component

**File:** `frontend/src/components/chunk-error-boundary.tsx`

**Usage:** Wrap in root layout or around lazy-loaded sections:

```tsx
// frontend/src/app/layout.tsx
import { ChunkErrorBoundary } from "@/components/chunk-error-boundary";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ChunkErrorBoundary>{children}</ChunkErrorBoundary>
      </body>
    </html>
  );
}
```

**Behaviour:**

- Detects `ChunkLoadError`, "Loading chunk failed", and similar errors
- Logs warning to console for observability
- Auto-reloads the page after 100ms delay
- Users see a brief flash, then the new deployment loads correctly

### What "good" looks like

- No `ChunkLoadError` in production error logs
- Users browsing during deployment see no errors
- At worst, users see a brief page reload (transparent recovery)

### Testing deployment resilience

1. Open Promagen in browser, navigate to any page
2. Deploy a new version to Vercel
3. Without refreshing, click around using client-side navigation
4. Expected: either seamless navigation (Skew Protection) or brief auto-reload (ChunkErrorBoundary)
5. Never: broken UI, 404 errors, or stuck states

---

### Tooltip standards (cross-component consistency)

**Added:** 18 March 2026

All custom tooltips (weather-prompt-tooltip, commodity-prompt-tooltip, CategoryColourLegend, and any future tooltips) must follow these rules:

**1. Close delay: 400ms** — Every custom tooltip has a 400ms delay on mouse leave before closing. This prevents accidental closure when cursor briefly exits the tooltip boundary. Native HTML `title` tooltips are exempt (browser-controlled).

**2. Background: solid `rgba(15, 23, 42, 0.97)`** — No opacity-based backgrounds. The solid dark glass ensures readability. No transparency, no blur filters.

**3. Sign-in prompts: plain `<a href="/sign-in">`** — Never use `SignInButton mode="modal"` inside tooltips. Clerk's modal portal fights with z-index stacking in z-50 tooltips, causing the modal to render behind the tooltip. Use a plain anchor tag instead.

**4. No question mark icons** — Tooltip triggers must never use `?`, `❓`, or `HelpCircle` icons. The element itself is the hover target. If a dedicated trigger is needed, use `(i)` — never `?`. Question marks imply confusion; Promagen's UI should feel confident.

**5. Minimum font: 10px** — All tooltip text uses `clamp()` with a minimum of 10px (see updated font floor above).

**Authority:** `code-standard.md` § 7.1, § 6.0.4, § 6.0.5

---

### Cursor-pointer on all interactive elements

**Added:** 18 March 2026

Every element that responds to user click must show `cursor: pointer`. An arrow cursor on a clickable element is broken UX — the user cannot tell it's interactive.

This applies to: buttons, tab pills, clickable cards, toggles, copy/save icons, intelligence panel tabs (Conflicts, Suggestions, Market Mood), weather suggestion chips, and any `<div>` or `<span>` with an `onClick` handler.

**Review gate:** Hover every interactive element before shipping. If the cursor stays as an arrow, add `cursor-pointer` (Tailwind class) or `style={{ cursor: 'pointer' }}`.

**Authority:** `code-standard.md` § 6.0.4

---

### SSOT colour constants (prompt-colours.ts)

**Added:** 18 March 2026

All 13 prompt category colours (Subject=gold, Action=lime, Style=purple, etc.) are defined **once** in `src/lib/prompt-colours.ts` and imported everywhere. No component may define its own `CATEGORY_COLOURS` constant.

**Why this matters:** Before the SSOT, there were 3 separate `CATEGORY_COLOURS` definitions (prompt-showcase, pro-promagen-client, admin vocab page) that drifted apart. One had structural=slate, another had structural=fuchsia. The SSOT eliminates this class of bug.

**Exports:** `CATEGORY_COLOURS`, `CATEGORY_LABELS`, `CATEGORY_EMOJIS`, `buildTermIndexFromSelections()`, `parsePromptIntoSegments()`.

**Consumers (6 files):** `prompt-builder.tsx`, `enhanced-educational-preview.tsx`, `four-tier-prompt-preview.tsx`, `prompt-showcase.tsx`, `pro-promagen-client.tsx`, `prompt-intelligence-builder.tsx`.

**Authority:** `code-standard.md` § 6.14

---

### Debounced intent pattern (hover panel switching)

**Added:** 18 March 2026

When hoverable cards trigger preview panels below them (e.g., Pro page Feature Control Panel), use **temporal debouncing** to filter accidental triggers during diagonal cursor movement.

**The problem:** Cards sit above the preview panel. Moving the cursor from a card down to its preview crosses other cards, triggering unwanted panel switches.

**Failed approach (intent triangle, v4.0):** An Amazon-style geometric corridor from cursor anchor to preview panel edges. This failed because the single-point triangle apex created a razor-thin corridor that only worked ~5% of the time on small card grids. **Do not re-implement.**

**Correct approach (debounced intent, v5.0):**

| State                                     | Behaviour                                                     |
| ----------------------------------------- | ------------------------------------------------------------- |
| No panel active                           | First card hover → switch immediately (0ms)                   |
| Same card re-hovered                      | No action                                                     |
| Different card hovered while panel active | 150ms debounce → switch if cursor stays                       |
| Card leave (no other card entered)        | 2-second linger timer → close if cursor doesn't enter preview |
| Cursor enters preview panel               | Cancel all timers (safe zone)                                 |
| Cursor leaves preview panel               | Close immediately                                             |

**Why 150ms:** Fast enough to feel instant for deliberate hovers. Long enough to filter diagonal movement across a 3×3 card grid where cards are small and closely spaced.

**Reference implementation:** `src/app/pro-promagen/pro-promagen-client.tsx` (v5.0.0)

**Authority:** `code-standard.md` § 6.11

---

### Auto-scroll animation pattern (preview showcases)

**Added:** 18 March 2026

When content overflows a fixed-height container and needs to be showcased without user interaction (e.g., Daily Prompts preview panel showing a miniaturised builder), use CSS `@keyframes` auto-scrolling with `translateY`.

**Timing spec:**

1. Content starts at `translateY(0)` (top visible)
2. 0.3s hold at top
3. Slow scroll down over ~8 seconds (ease-in-out)
4. 0.3s hold at bottom
5. Slow scroll back up over ~8 seconds
6. Total cycle: ~17 seconds, repeat infinitely

**Scroll distance:** Computed dynamically via `ResizeObserver` on content height minus container height. Stored as CSS custom property `--scroll-dist`.

**Rules:**

- Animation defined in `<style dangerouslySetInnerHTML>` (co-located, not globals.css)
- `@media (prefers-reduced-motion: reduce)` disables the animation
- Container uses `overflow: hidden` (no visible scrollbar)
- ResizeObserver cleanup in useEffect return

**Reference implementation:** `DailyPromptsPreviewPanel` in `pro-promagen-client.tsx`

**Authority:** `code-standard.md` § 6.12

---

### Shared hook state sync (same-tab StorageEvent)

**Added:** 18 March 2026

When multiple instances of the same React hook need to stay in sync on the same page (e.g., `useGlobalPromptTier` on the Pro page and exchange tooltips), use **synthetic StorageEvent dispatch** after writing to localStorage.

**The problem:** Native `StorageEvent` only fires in OTHER browser tabs. When one hook instance writes to localStorage, other instances on the same page don't hear it.

**The solution:** After `localStorage.setItem()`, dispatch:

```typescript
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
- Never use local `useState` for state that needs cross-component sync — always use the shared hook
- The shared hook is the single source of truth — components never read localStorage directly

**Reference implementation:** `src/hooks/use-global-prompt-tier.ts` (v2.0.0)

**Authority:** `code-standard.md` § 6.13, `paid_tier.md` § 5.16

---

### "Show the tool, not the output" principle

**Added:** 18 March 2026

When designing preview panels or feature showcases, prefer showing **what the tool looks like to use** over showing **what it produces**.

**Example:** The Daily Prompts preview on the Pro page. Three other previews already show prompt output (Prompt Format shows 4-tier text, Prompt Lab shows category data + tier prompts, Saved shows saved prompt text). Adding another output view would be repetition. Instead, the Daily Prompts preview shows a miniaturised version of the standard builder — 12 colour-coded category rows with selected chips, assembled prompt box, optimized prompt box. Users see the cockpit, not the product.

**When to apply:** Any time you're designing a feature showcase, onboarding element, or marketing preview. Ask: "Has the user already seen what this tool _produces_ elsewhere?" If yes, show what it _looks like to use_ instead.

**Human factor:** Curiosity Gap — showing the tool creates "I want to try this" more effectively than showing the output, because the output is static but the tool is interactive.

---

### Blur-to-sharp image reveal animation

**Added:** 19 March 2026

When showcasing AI-generated images (or simulating image generation), use a CSS `filter: blur()` animation that resolves over 10 seconds. This mimics the experience of watching an AI image generator work in real time.

**Timing spec (15s total cycle):**

1. Start at `blur(18px)`, `brightness(0.3)`, `saturate(0.1)` — looks like generation just started
2. Gradually resolve over ~10 seconds — blur lifts, brightness rises, saturation returns
3. Crystal clear (`blur(0)`, `brightness(1)`, `saturate(1)`) for ~3 seconds — the payoff
4. Fade back to blurred state — cycle restarts

**CSS keyframes:**

```css
@keyframes imagegenReveal {
  0% {
    filter: blur(18px) brightness(0.3) saturate(0.1);
  }
  10% {
    filter: blur(12px) brightness(0.4) saturate(0.3);
  }
  30% {
    filter: blur(6px) brightness(0.6) saturate(0.6);
  }
  55% {
    filter: blur(1px) brightness(0.9) saturate(0.95);
  }
  65%,
  85% {
    filter: blur(0) brightness(1) saturate(1);
  }
  100% {
    filter: blur(18px) brightness(0.3) saturate(0.1);
  }
}
```

**Rules:**

- Animation defined in `<style dangerouslySetInnerHTML>` (co-located, not globals.css)
- `@media (prefers-reduced-motion: reduce)` disables the animation AND removes all filters
- Pair with a fuchsia progress bar synced to the same cycle for visual feedback
- Image uses `object-fit: cover` with `position: absolute; inset: 0`
- When combined with crossfade rotation (see next pattern), use `key={activeIdx}` to reset the animation on card swap

**Human factor:** Anticipatory Dopamine — the 10-second resolve creates the same suspense as waiting for a real image generation. The hold-at-sharp moment is the payoff. Research shows the moment _before_ the reveal is more engaging than the reveal itself.

**Reference implementation:** `ImageGenPreviewPanel` in `pro-promagen-client.tsx` (v6.0.0)

---

### Single-card crossfade rotation

**Added:** 19 March 2026

When a showcase has multiple items that should each get full visual space (e.g., prompt + image pairs), show one at a time and rotate with a crossfade. This replaces auto-scrolling when cards need the full panel height.

**When to use instead of auto-scroll:** When each card contains a large visual element (image, chart, map) that benefits from maximum display area. Auto-scroll works for text-heavy content that overflows. Crossfade rotation works for visual content that needs to fill the space.

**Timing spec:**

- Each card visible for N seconds (synced to any internal animation — e.g., 15s matches blur-to-sharp cycle)
- 300ms fade-out (opacity 1 → 0)
- Swap content (React state update)
- 300ms fade-in (opacity 0 → 1)
- Total transition: 600ms

**Implementation pattern:**

```typescript
const [activeIdx, setActiveIdx] = useState(0);
const [fadeState, setFadeState] = useState<
  "visible" | "fading-out" | "fading-in"
>("visible");

useEffect(() => {
  const id = setInterval(() => {
    setFadeState("fading-out");
    setTimeout(() => {
      setActiveIdx((prev) => (prev + 1) % items.length);
      setFadeState("fading-in");
      setTimeout(() => setFadeState("visible"), 300);
    }, 300);
  }, ROTATION_MS);
  return () => clearInterval(id);
}, []);
```

**CSS:** `opacity: fadeState === 'fading-out' ? 0 : 1` with `transition: opacity 300ms ease-in-out`.

**Key trick:** Use `key={activeIdx}` on any child elements with CSS animations (images, progress bars). This forces React to unmount/remount, resetting the animation from frame 0 without JavaScript intervention.

**Navigation dots:** Show small dots (fuchsia or accent colour) at the bottom to indicate position. Active dot filled, others 20% white opacity.

**Reference implementation:** `ImageGenPreviewPanel` in `pro-promagen-client.tsx` (v6.0.0). Also used by `ScenesPreviewPanel` for world rotation (different visual, same state pattern).

---

## Performance Guardrails (CLS Prevention)

**Purpose:**
Cumulative Layout Shift (CLS) is invisible during development but tanks Google rankings and makes users feel the site is "janky". Promagen hit CLS 0.40 (catastrophic) from patterns that looked harmless in dev. These process rules prevent repeating that.

**Authority:** Technical implementation rules are in `code-standard.md` § 22. This section covers the _process_ — when to check, what to watch for, and how to think about it.

### Pre-ship CLS check (required for homepage-visible components)

Any PR that touches components visible on initial page load (FX ribbons, commodities grid, providers table, exchange cards, header) must include a CLS measurement:

1. Open Chrome DevTools → Performance panel
2. Check "Screenshots" and "Web Vitals"
3. Click Record → Reload page → Stop after full load
4. Check "Layout Shifts" section in the timeline
5. **Pass criteria:** total CLS ≤ 0.10 (target ≤ 0.05)

If CLS exceeds 0.10, the PR must fix it before merging.

### Three patterns that always cause CLS

These are the root causes we've hit. Treat them as red flags during code review:

| Pattern                                                                       | Why it shifts                                    | Fix                                                  |
| ----------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------- |
| `useEffect` → fetch → `setState` → re-sort visible rows                       | Rows jump to new positions after paint           | Opacity-gate container until data loads              |
| `requestAnimationFrame` / `ResizeObserver` → `setState` on measured component | Content reflowed after first paint               | `opacity: 0` until measurement settles               |
| `transition-all` on containers that resize                                    | Browser animates the layout shift, CLS counts it | Use `transition-colors` or `transition-opacity` only |

### SSR hydration gap (mental model)

The browser paints server-rendered HTML **before** React hydrates. No React effect (`useEffect`, `useLayoutEffect`) can prevent this first paint. If your component looks different after hydration (different font size, different sort order, different row count), the user sees the shift.

**Rule of thumb:** if a component will look different after its first `useEffect` fires, it must start invisible (`opacity: 0`) and fade in after settling.

### What "good" looks like

- CLS ≤ 0.05 (green in Lighthouse/DevTools)
- Components that measure themselves start invisible and fade in within 150ms
- No visible "jump" or "flash" on page load
- Safety timeouts ensure content always becomes visible, even if APIs are slow

---

## Human Factors Gate (no user-facing build without psychological justification)

**Purpose:** Every user-facing visual feature must be designed for the human brain, not just the browser. Features that are technically correct but psychologically invisible are wasted engineering. This gate ensures that every visible element has a reason to exist beyond "it shows data."

**Authority:** `docs/authority/human-factors.md` is the reference document containing 18 principles with research sources, practical application tables, and anti-patterns. Read it once thoroughly; reference it before every user-facing build.

**Hard rule:** Before building any user-facing visual feature, state:

1. **The feature** — one sentence
2. **The primary human factor** — name it from `human-factors.md`
3. **Why it applies** — one sentence connecting the factor to the feature
4. **The anti-pattern** — what would kill the effect

This takes 30 seconds. It prevents hours of building features that look good to a developer but do nothing to a user's brain.

**Scope:** This gate applies to anything the user sees, waits for, listens to, or decides on. It does NOT apply to backend architecture, database schemas, API contracts, cron pipelines, or test infrastructure.

**Examples of gate passes:**

| Feature                          | Factor                         | Justification                                                                        |
| -------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------ |
| Show next city name in countdown | Curiosity Gap (Loewenstein)    | User imagines the city before the prompt arrives — gap pulls them in                 |
| 3-minute rotation (was 10 min)   | Dwell Time + Variable Reward   | 95% of users never saw a rotation at 10 min; at 3 min, 40% do                        |
| Countdown text shortens at 30s   | Temporal Compression           | State change creates perceived acceleration — final seconds feel faster              |
| Cascading glow on scene cards    | Variable Reward + Von Restorff | Unpredictable highlight draws the eye; one card stands out from the rest             |
| Prompt anatomy colours           | Cognitive Load + Curiosity Gap | Colour reduces extraneous load; unexplained colours invite exploration               |
| British female voice for speaker | Voice Psychology               | Female RP voice produces higher recall and longer listening duration across cultures |

**Quick reference — the 5 most commonly applicable factors:**

| Factor                | When to use it                                | Core insight                                                   |
| --------------------- | --------------------------------------------- | -------------------------------------------------------------- |
| Curiosity Gap         | Content reveals, feature discovery, tooltips  | Tell them something exists. Don't tell them what it is.        |
| Variable Reward       | Rotation, feeds, randomisation                | Predictable = boring. Uncertain outcomes = engagement.         |
| Anticipatory Dopamine | Countdowns, loading states, transitions       | The moment before the reveal is more exciting than the reveal. |
| Loss Aversion         | Freemium gating, trial expiry, feature limits | Losing something hurts 2× more than gaining it feels good.     |
| Cognitive Load        | Adding ANY element to ANY page                | You get 4 working memory slots. Every element costs one.       |

---

## Prompt Optimiser

**Prompt analysis (what makes answers go wrong):**

- Prompts fail when they contain goals ("calm UI, no extra cost") without an authority model ("who is allowed to say no, where is enforced, what are the invariants").
- Prompts also fail when they ask for an "update" but don't explicitly forbid deletion/re-ordering, or don't require a word-count floor + changelog.

**Reworded "best version" prompt (copy/paste template you can reuse):**

```
TASK: Answer my request, then optimise my prompt for next time.

RULES:
1. Do the task first.
2. Then give exactly TWO improvements/extensions.
3. Then include a section titled "Prompt Optimiser" where you:
   - State the implied assumptions you detected
   - List missing inputs you would normally need (but do NOT ask questions unless truly blocking)
   - Rewrite my prompt into the most precise version possible, preserving my intent and constraints

CONSTRAINTS (always apply unless I override):
- British English
- No summarising unless I explicitly ask
- No re-ordering or deleting content unless I explicitly mark REMOVE/REPLACE
- If documents are involved: word count must be >= current doc word count and include a changelog
- If code is involved: full files only, ready to cut-and-paste
- Code deliverables: provide as downloadable zip files with proper folder structure viewable in VS Code

MY PROMPT:
<PASTE MY PROMPT HERE>

INPUTS (if relevant):
- Current doc / file(s): <paste>
- Allowed changes (REMOVE/REPLACE/ADD): <paste>
- Truth anchors (must not contradict): <paste>

OUTPUT FORMAT:
- Main answer
- Two improvements
- Prompt Optimiser: Analysis, Rewritten prompt (final)
```

---

## Changelog

- **29 Mar 2026:** **HARMONY v3 + FIVE NEW PRINCIPLES + AUTHORITY DOC VERSION BUMPS.** Updated authority docs list: ai-disguise v4.0.0→v5.0.0, harmonizing v2.0.0→v3.0.0, prompt-lab-v4-flow v1.3.0→v2.0.0, prompt-lab v3.1.0→v4.0.0, prompt-optimizer added v6.0.0 (now covers Call 3 architecture). Added trend-analysis v6.0.0, harmony-anti-regression, platform-config SSOT, ai_providers_affiliate v2.0.0, Prompt Engineering Specs to authority list. Rewrote Harmony Engineering Workflow section: file table updated (Call 2 342→272 lines with 5 functions, Call 3 439 lines with 7 functions added, harmony-compliance 486→833 lines, generate-tier-prompts 523→650, optimise-prompt 406 lines added), extraction pattern split into Call 2 and Call 3, dual-assessor→three-assessor methodology with calibration finding (Claude +5-6pts T3, +3-5pts T4 vs median). Added 5 new subsections: Playground-first workflow (validate in OpenAI Playground targeting 95+ before coding), Verify before modifying (trace all changes to actual file contents, src.zip is ground truth), Deterministic fixes in code not prompts (compliance gates over prompt rules), Config entries cause silent misrouting (Recraft bug, proseGroups bug), Claude must flag architectural problems proactively (three-file config lesson). Updated doc-update trigger for harmony post-processing to reference both Call 2 and Call 3 files. Cross-ref: ai-disguise.md v5.0.0, harmonizing-claude-openai.md v3.0.0, prompt-optimizer.md v6.0.0, prompt-lab.md v4.0.0, prompt-lab-v4-flow.md v2.0.0.
- **25 Mar 2026:** Added "Harmony Engineering Workflow" section: read-before-modifying file table, 115-test lockdown suite command, extraction pattern rule, rule ceiling (30) enforcement, dual-assessor mandate. Updated authority docs list: restructured into 5 categories (Core, AI Intelligence Engine, Data feed/gateway, Platform/provider, Infrastructure), added 13 new docs (ai-disguise v4.0.0, harmonizing v2.0.0, prompt-lab-v4-flow v1.3.0, architecture, test.md, prompt-lab, unified-prompt-brain, prompt-optimizer, prompt-intelligence, human-sentence-conversion, api-calming-efficiency, clerk-auth, stripe). Removed stale entries (TODO-api-integration, frontend companion docs). Updated code-standard ref from v3.0 to v4.0. Updated "definition of needs a doc update" to include harmony post-processing changes as trigger. Cross-ref: ai-disguise.md v4.0.0, harmonizing-claude-openai.md v2.0.0, test.md v1.0.0.
- **19 Mar 2026:** Added 3 new subsections under UI Consistency + UX Patterns. (1) Blur-to-sharp image reveal animation: 15s CSS filter cycle (blur(18px)→blur(0) over 10s, hold 3s, reset), paired with fuchsia progress bar, `prefers-reduced-motion` disables filter entirely. Reference: ImageGenPreviewPanel. (2) Single-card crossfade rotation: 300ms fade-out/fade-in, `key={activeIdx}` for animation reset, navigation dots. Replaces auto-scroll when cards need full panel height for visual content. Reference: ImageGenPreviewPanel + ScenesPreviewPanel. (3) Pro page no-grey-text rule: stricter than site-wide banned colours — `/pro-promagen` prohibits ALL grey text including `text-slate-400` and `text-white/30`. All text must be bright (white, brand colours, category colours). Cross-refs: paid_tier.md §5.10 v6.0.0.
- **18 Mar 2026:** Major update — 7 new subsections under UI Consistency + UX Patterns. (1) Tooltip standards: 400ms close delay, solid `rgba(15,23,42,0.97)` bg, sign-in as plain `<a>` not `SignInButton mode="modal"`, no question mark icons. (2) Cursor-pointer on all interactive elements. (3) SSOT colour constants: `prompt-colours.ts` as sole source of truth for 13 category colours, 6 consumers listed. (4) Debounced intent pattern: 150ms hover panel switching replacing failed intent triangle, full state table. (5) Auto-scroll animation pattern: 17s cycle spec, ResizeObserver distance, CSS custom property. (6) Shared hook state sync: synthetic StorageEvent for same-tab cross-hook sync. (7) "Show the tool, not the output" principle for feature showcases. Updated minimum text size from 9px to 10px floor. Cross-refs: code-standard.md §6.0.4/6.0.5/6.11-6.14, paid_tier.md §5.14/5.16.
- **15 Mar 2026:** Added "Equal-gap card spacing" subsection under UI Consistency. One vertical spacing system per card — never mix `padding` with `space-evenly`. Viewport-controlled cards use `paddingInline` only + `align-content: space-evenly`. Content-sized cards use `padding` + `flex-col`. Cross-ref code-standard.md § 6.10.
- **16 Feb 2026:** Major v3.0 alignment with code-standard.md. Three updates:
  - **Universal `clamp()` Sizing** — Expanded "Fluid Typography" (text-only) into full universal mandate covering ALL visible dimensions: text, icons, buttons, gaps, padding, margins, container heights, image wrappers. Added standard scale tables for icons, spacing, and containers alongside existing text scales. Added code examples for buttons, icons, panels, and flag images. Added exceptions list and compliance check. Cross-ref code-standard.md § 6.0, Golden Rule #11.
  - **Unified Grid Architecture (NEW)** — One CSS grid is the single source of truth for all panel positioning. One `GRID_GAP` constant (a `clamp()` value) controls all inter-panel spacing. Panels don't know about each other. Visual reference diagram, forbidden patterns, and compliance check. Cross-ref code-standard.md § 6.6, Golden Rule #12.
  - **Window Boundary Containment (strengthened)** — Added Rule 3 "Only tooltips may overlay" — no glow, gradient, or absolutely positioned child may render on top of another window. Added Rule 7 "`clamp()` gaps enforce separation" — inter-window spacing from grid gap only, never panel margins. Scope expanded from Engine Bay + Mission Control to ALL grid panels.
- **15 Feb 2026:** Added "Window boundary containment (nothing in, nothing out)" subsection under UI Consistency. Architectural rule: Ignition and Mission Control windows are hard visual boundaries — no content escapes outward, no external content bleeds inward. Containment achieved via internal element constraints, never by adding overflow/contain to the outer window container (which breaks grid positioning). Cross-ref code-standard.md § 6.5.
- **14 Feb 2026:** Added anti-breakpoint rule (#5, #6) to Fluid Typography hard rules — never use Tailwind breakpoint text classes for responsive sizing, always use inline `clamp()`. Tooltips exempt. Added "Text containment (no text escapes its window)" subsection under UI Consistency — three-property pattern (`overflow-hidden`, `min-h-0`, `truncate`) for all text in fixed-height containers. Cross-ref code-standard.md § 6.4.
- **7 Mar 2026:** Added "Human Factors Gate" section. Every user-facing visual feature must name its primary human factor before implementation. Authority: `docs/authority/human-factors.md` (18 principles — curiosity, reward, anticipation, memory, stimulation, time perception, spatial framing, loss aversion, social proof, peak-end, cognitive load, isolation effect, motor control, aesthetics, dwell time, voice, colour, animation). Backend and data-layer work exempt.
- **9 Feb 2026:** Added "Performance Guardrails (CLS Prevention)" section. Pre-ship CLS check requirement, three red-flag patterns, SSR hydration gap mental model. Cross-ref code-standard.md § 22 for implementation rules.
- **7 Feb 2026:** Added "Content-driven sizing" subsection under UI Consistency. Standard approach when content doesn't have room to breathe: measure real content, not magic numbers. Cross-ref code-standard.md § 6.3.
- **10 Jan 2026:** Updated FX SSOT file reference from `fx.pairs.json` to unified `fx-pairs.json` (schema table).
- **9 Jan 2026:** Added "Deployment Resilience" section (Vercel Skew Protection + ChunkErrorBoundary). Zero-downtime deployment strategy for active users.
- **3 Jan 2026:** Added "Pro Promagen" terminology section (paid tier naming convention). Added "Security-First Development" section (secure code for files in current request only).
- **2 Jan 2026:** Added TODO-api-integration.md to authority docs list. Added "Voting system mechanics" to doc update triggers. Community voting system fully implemented with activation requirements documented.
- **1 Jan 2026:** Prompt builder expanded to 11 categories with selection limits (1/2/5). Added 🎲 Randomise button. Implemented negative-to-positive conversion for natural language platforms (30 mappings). Fixed Artistly platform family. Added dropdown auto-close and 50-char custom entry limit. Updated `prompt-builder-page.md` authority doc.
- **31 Dec 2025:** Added prompt builder data sources to documentation. Cross-reference to `prompt-builder-page.md` for 9-category dropdown system and platform-specific optimization. Viewport-locked layout and scrollbar utilities documented in code-standard.md § 8.1-8.4.
- **30 Dec 2025:** No content changes (tooltip standards added to code-standard.md § 7.1 instead of here to avoid duplication).
- **28 Dec 2025:** Added Schema and Type Consolidation Rules section. Added `prompt-builder-page.md` to authority docs list. Added "Schema or type definitions" to doc update triggers. Updated memory policy for Claude. Improved formatting consistency.
- **27 Dec 2025:** Added "Git safety gate (anti-panic)" rules (stash-first / rescue-branch / no-guessing / generated artefact handling / no-conflict-marker commits).
