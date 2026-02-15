# Best Working Practice

**Last updated:** 15 February 2026

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
```

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

**4. Fluid Typography with `clamp()` (responsive text)**

- All UI text must scale smoothly across screen sizes using CSS `clamp()`.
- Never use fixed `px` font sizes alone — they don't adapt to viewport.
- Never use `vw` alone — text becomes unreadable on small screens or massive on ultrawides.

**The pattern:**

```css
font-size: clamp(MIN, PREFERRED, MAX);
```

| Parameter   | Purpose                                    | Example |
| ----------- | ------------------------------------------ | ------- |
| `MIN`       | Floor — never smaller than this (readable) | `12px`  |
| `PREFERRED` | Scales with viewport width                 | `1vw`   |
| `MAX`       | Ceiling — never larger than this           | `16px`  |

**Standard scales (use these):**

| Element         | clamp value                         | Notes       |
| --------------- | ----------------------------------- | ----------- |
| Body text       | `clamp(0.875rem, 1vw, 1rem)`        | 14px → 16px |
| Table text      | `clamp(0.8125rem, 1vw, 1rem)`       | 13px → 16px |
| Small/secondary | `clamp(0.6875rem, 0.9vw, 0.875rem)` | 11px → 14px |
| Headings        | `clamp(1.25rem, 2vw, 1.75rem)`      | 20px → 28px |
| Data/monospace  | `clamp(0.75rem, 1vw, 0.875rem)`     | 12px → 14px |

**Hard rules:**

1. New text styles must use `clamp()` — no exceptions.
2. Existing fixed sizes should be migrated to `clamp()` when touched.
3. Minimum font size for body text: `12px` (accessibility floor).
4. Minimum font size for secondary text: `10px` (absolute floor).
5. **Never use Tailwind breakpoint text classes** (`text-xs`, `sm:text-sm`, `xl:text-base`, `2xl:text-lg`, `min-[Xpx]:text-Y`) for responsive font sizing. The root `html` font-size already scales with `clamp(16px, 1.1vw, 18px)`, so all rem-based Tailwind classes (`text-sm`, `text-base`, etc.) already scale proportionally with viewport width. Adding breakpoint overrides fights the system and produces no visible change. Use inline `style={{ fontSize: 'clamp(...)' }}` instead.
6. **Tooltips are exempt** — tooltip text may use fixed Tailwind classes (`text-sm`, `text-xs`) because tooltips are portalled overlays with their own sizing context, not affected by container scaling.

**Existing example (exchange cards):**

```css
/* globals.css line 409 */
.providers-table {
  font-size: clamp(0.8125rem, 1vw, 1rem); /* 13px → 16px */
}
```

**Authority:** `docs/authority/code-standard.md` §6 (Styling Rules)

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

**Purpose:** The Ignition window (Engine Bay) and Mission Control window are self-contained panels. Nothing inside them may overflow or escape their boundary, and nothing from outside may bleed into them. This is an architectural rule built into every component from the start, not patched on after the fact.

**Hard rules (non-negotiable):**

1. **Nothing escapes outward** — All content within a window (text, icons, glows, gradients, absolutely positioned children, animations) must stay inside the window boundary. If it doesn't fit, it clips or scrolls — it never paints outside.
2. **Nothing enters from outside** — Adjacent components (exchange cards, ribbons, overlays, glow effects) must not visually bleed into either window. Each window is a hard visual boundary.
3. **Built from the start** — These containment rules apply at component creation time, not as a retrofit. Every new child element added to either window must respect the boundary without requiring a separate containment fix.
4. **No `contain: paint` or `contain: layout`** — These CSS containment properties create new stacking contexts and containing blocks that break grid positioning. Do not use them on window containers. Use targeted `overflow-hidden` on inner elements instead.
5. **Containment is internal, not external** — The outer container div of each window must NOT have `overflow: hidden` or `style` props added to enforce containment. Containment is achieved by ensuring every child element inside the window is properly sized, clipped, and constrained within its own bounds.

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

- `docs/authority/code-standard.md` ← Frontend code rules (9.5/10 version)
- `docs/authority/best-working-practice.md` ← This file
- `docs/authority/promagen-api-brain-v2.md` ← API system document
- `docs/authority/paid_tier.md` ← Monetisation boundary SSOT
- `docs/authority/ribbon-homepage.md` ← Finance ribbon architecture
- `docs/authority/ai providers.md` ← AI providers catalogue and leaderboard
- `docs/authority/ai providers affiliate & links.md` ← Affiliate and referral rules
- `docs/authority/prompt-builder-page.md` ← Prompt builder page architecture
- `docs/authority/ga4-gtm-nextjs-vercel.md` ← Analytics integration
- `docs/authority/vercel-pro-promagen-playbook.md` ← Vercel Pro guardrails
- `docs/authority/fly-v2.md` ← Fly.io deployment
- `docs/authority/api-documentation-twelvedata.md` ← Vendor reference snapshot (read-only)
- `docs/authority/TODO-api-integration.md` ← Deferred work and activation tasks

**Frontend companion docs:**

- `frontend/docs/env.md`
- `frontend/docs/promagen-global-standard.md`

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
- Prompt builder category options or platform format rules changed
- Voting system mechanics or activation requirements changed

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
import { ChunkErrorBoundary } from '@/components/chunk-error-boundary';

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

- **15 Feb 2026:** Added "Window boundary containment (nothing in, nothing out)" subsection under UI Consistency. Architectural rule: Ignition and Mission Control windows are hard visual boundaries — no content escapes outward, no external content bleeds inward. Containment achieved via internal element constraints, never by adding overflow/contain to the outer window container (which breaks grid positioning). Cross-ref code-standard.md § 6.5.
- **14 Feb 2026:** Added anti-breakpoint rule (#5, #6) to Fluid Typography hard rules — never use Tailwind breakpoint text classes for responsive sizing, always use inline `clamp()`. Tooltips exempt. Added "Text containment (no text escapes its window)" subsection under UI Consistency — three-property pattern (`overflow-hidden`, `min-h-0`, `truncate`) for all text in fixed-height containers. Cross-ref code-standard.md § 6.4.
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
