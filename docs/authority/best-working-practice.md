# Best Working Practice

**Last updated:** 28 December 2025

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

| Data file | Schema file |
|-----------|-------------|
| `data/providers/providers.json` | `data/providers/providers.schema.ts` |
| `data/fx/fx.pairs.json` | `data/fx/fx.schema.ts` |
| `data/exchanges/exchanges.catalog.json` | `data/exchanges/exchanges.schema.ts` |

Routes and loaders import from this canonical schema, never define their own.

### Singular type entry points

For major domain types, create a singular entry-point file that re-exports:

| Entry point | Re-exports from |
|-------------|-----------------|
| `@/types/provider.ts` | `./providers.ts` |
| `@/types/exchange.ts` | `./exchanges.ts` |
| `@/types/fx-pair.ts` | `./fx.ts` |

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

- **28 Dec 2025:** Added Schema and Type Consolidation Rules section. Added `prompt-builder-page.md` to authority docs list. Added "Schema or type definitions" to doc update triggers. Updated memory policy for Claude. Improved formatting consistency.
- **27 Dec 2025:** Added "Git safety gate (anti-panic)" rules (stash-first / rescue-branch / no-guessing / generated artefact handling / no-conflict-marker commits).
