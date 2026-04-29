---
name: docs-update
description: Apply when adding, editing, deleting, archiving, or updating any document in `docs/`, `CLAUDE.md`, `README.md`, the `.claude/skills/**/SKILL.md` files, or end-of-session handovers. Enforces Promagen's "code is the source of truth" rule, the live-vs-archive split, the version + date + status pattern, the drift-flag discipline, and the handover format. Prevents the repository from accumulating stale authority docs that mislead future sessions.
type: workflow
---

# docs-update — keep docs honest, current, and structured

Promagen's documentation is a hazard if it isn't actively maintained. The user has stated explicitly: *"Stop reading the docs, they are stale, the code is the SSoT."* That stands until revoked.

This skill applies whenever a session edits, creates, deletes, or archives docs — including authority docs, handovers, the project root `CLAUDE.md` and `README.md`, and skill files in `.claude/skills/`.

The default state is: **don't write a doc**. Documentation is overhead, not output. Only write or update when one of the triggers below applies.

---

## 0. When this skill applies

**Apply when the change touches any of:**

- `CLAUDE.md` (project root)
- `README.md` (project root)
- `docs/authority/**` (authoritative product, strategy, technical docs)
- `docs/handover/**` (end-of-session handovers)
- `docs/archive/**` (retired material — rarely touched)
- `.claude/skills/**/SKILL.md`
- `.claude/skills/README.md`
- Any `*.md` newly created at the repo root or under `docs/`

**Do NOT apply to:**

- Inline source code comments (governed by CLAUDE.md "default to no comments" rule)
- Auto-generated files (`pnpm-lock.yaml`, type declaration files)
- Test fixtures
- Archive material the user has explicitly retired (touch only with explicit instruction)

---

## 1. The first rule: don't write docs

Before adding any doc, ask:

1. **Is this knowledge already recoverable from `git log` or current code?** If yes — no doc.
2. **Is this an ephemeral task state?** If yes — use TODO list or memory, not a doc.
3. **Is this a decision the user expects to look up in 6 months?** If yes — possibly an authority doc.
4. **Is this a strategic anchor that future Claude sessions need to honour?** If yes — `CLAUDE.md` or an authority doc.
5. **Is this an end-of-session snapshot?** If yes — handover.

CLAUDE.md says: *"NEVER create documentation files (*.md) or README files unless explicitly requested by the User."* This skill respects that. The exceptions are:

- The user explicitly asked.
- An end-of-session handover is requested or natural (see §6).
- A skill is being added (the SKILL.md is the artefact).
- An authority doc has gone stale and needs an update (see §4.4 — flag drift; ask before rewriting).

---

## 2. Authority order

When sources conflict, follow CLAUDE.md's authority order (already documented in CLAUDE.md and `ai-visibility/SKILL.md`):

1. Direct user instruction in the current chat
2. Current source code in `frontend/src/`
3. `CLAUDE.md`
4. `docs/authority/commercial-strategy.md`
5. `docs/authority/sentinel.md`
6. Other `docs/authority/*.md` files — assume drift unless verified against code
7. Archive docs — historical reference only

This skill defers to that order. When updating a doc, **never silently reconcile a doc with broken or wrong code** — flag the drift; let the user decide whether to fix the code or change the doc.

---

## 3. The doc taxonomy in this repo

| Location | Purpose | Volatility | Authority |
|----------|---------|------------|-----------|
| `CLAUDE.md` (root) | Session rules, hard guardrails, output format | Low — change only when a rule changes | Highest after live source |
| `README.md` (root) | Public-facing project overview | Low | Public-facing |
| `docs/authority/*.md` (live subset) | Strategy, architecture, sentinel internals, code standards, button standards, human factors | Medium | Trusted only if listed as live (see §3.1) |
| `docs/authority/*.md` (other) | Older or candidate-stale docs | High | **Assume drift** |
| `docs/handover/YYYY-MM-DD-handover.md` | End-of-session snapshots | Frozen at write time | Snapshot — not live |
| `docs/archive/*` | Retired material | Frozen | Historical reference only |
| `.claude/skills/<name>/SKILL.md` | Project-specific Claude skills | Medium — update as patterns evolve | Trusted as session guidance |
| `.claude/skills/README.md` | Index of skills + Claude Code meta | Medium | Self-documenting |

### 3.1 Live authority docs (trusted as of latest handover)

Per `docs/handover/2026-04-29-handover.md`:

- `docs/authority/commercial-strategy.md` v2.0.0
- `docs/authority/sentinel.md`
- `docs/authority/architecture.md` v4.0.0 (formerly `ARCHITECTURE.md`)
- `docs/authority/buttons.md`
- `docs/authority/code-standard.md`
- `docs/authority/promagen-ai-authority-pages-FINAL-v2_0_0.md`
- `docs/authority/Turning_Promagen_From_Prompt_Engine_To_Sentinel_Master.md`
- (any GA / Stripe / Clerk / cron infra doc that the handover lists)

All other `docs/authority/*.md` files — assume drift unless re-verified against current code.

---

## 4. Doc structure conventions

### 4.1 Authority doc frontmatter / opener

Every authority doc opens with:

```markdown
# <name>.md — <one-line title>

**Last updated:** <DD MMM YYYY>
**Version:** <semver>
**Status:** AUTHORITATIVE / DRAFT / SUPERSEDED BY: <doc>
**Owner:** <Promagen Ltd / individual>
**Authority:** <one-paragraph statement of what this doc governs and how it interacts with code as SSoT>
```

When updating, bump the date. When materially changing content, bump the version (semver: major for direction reversal, minor for added content, patch for clarification).

### 4.2 Authority doc structure

Authority docs follow a consistent shape (visible in `commercial-strategy.md`):

1. The position in one paragraph (or `## 1. <core thesis>`)
2. Numbered sections by topic (each section is one decision area)
3. `## N. Risks and mitigations` table where useful
4. `## N. Non-regression rules` enumerating what must not break
5. `## N. Changelog` at the bottom — newest entry first, with version + date + summary

Preserve this shape when editing — don't restructure unless asked.

### 4.3 Changelog entries

Format:

```markdown
- **DD MMM YYYY (vX.Y.Z):** Brief description of what changed and why. Reference superseded version if applicable.
```

Add a new entry above existing entries (newest first). Do not edit historical entries; add new ones.

### 4.4 Drift flag — when code disagrees with the doc

When you discover that an authority doc references a route, file, helper, or behaviour that no longer exists in the code:

1. **Do not silently update the doc to match.** That hides intentional drift.
2. **Flag it explicitly** in the diff or response: *"Doc X references Y, but code now uses Z. Drift detected — does the doc need updating, or did the code regress?"*
3. **If the user says "update the doc"** — update with a brief changelog entry naming what was reconciled and what code state the doc now matches.
4. **If the user says "the code regressed"** — fix the code, leave the doc unchanged.
5. **If the user is silent** — leave both, but log the drift in your handover for next session.

CLAUDE.md authority order is unambiguous: code is the SSoT. The doc adapts to code, not the other way round.

---

## 5. Skill doc conventions

`.claude/skills/<name>/SKILL.md` files have their own conventions:

### 5.1 Frontmatter

```markdown
---
name: <skill-name>
description: <one-paragraph description of when to use, what triggers it, what concerns it covers — used by the model to decide relevance>
type: workflow / reference / playbook
---
```

The `description` is the most important part — it's what the model uses to decide whether to invoke the skill. Be specific. List trigger conditions, file globs, and concerns.

### 5.2 Body structure

Skills should follow a predictable shape:

1. `# <name> — <one-line summary>`
2. Opening paragraph: what the skill does, why it exists.
3. `## 0. When this skill applies` — explicit triggers + non-triggers (file globs, scenarios).
4. Concrete rules / playbook / checklist.
5. `## N. Anti-patterns` — what to flag.
6. `## N. Verification` — what to run.
7. `## N. Output format` — how to report findings during code review or implementation.

Keep skills tight. Aim for 200–500 lines. If a skill grows past 600, consider splitting.

### 5.3 Skill index

`.claude/skills/README.md` §0 lists every project skill in the folder. **When you add a skill, update the README index.** Format:

```markdown
| `<name>` | [<folder>/](./folder/SKILL.md) | <one-line purpose> |
```

### 5.4 Skill removal

If a skill becomes obsolete:

1. Move its folder to `.claude/skills/_archive/<name>/SKILL.md`.
2. Remove the entry from the README §0 index.
3. Add a one-line entry in the README §8 changelog: *"DD MMM YYYY: archived <name>/ — reason."*

Don't silently delete. Archive preserves history.

---

## 6. Handover documents

Handovers are the most valuable doc in this repo. They survive across sessions and are the single source the next-session agent uses to pick up work.

### 6.1 When to write a handover

Write a handover when:

- A session has shipped a meaningful change (≥10 files touched, or a feature/pivot).
- The session ends with open decisions or pending work.
- The user asks ("write up a handover", "end-of-session notes").
- A multi-day effort is being paused.

### 6.2 Handover filename

`docs/handover/YYYY-MM-DD-handover.md` (ISO-8601 date prefix, single canonical handover per day).

If a second handover is needed on the same day (rare): `YYYY-MM-DD-handover-evening.md` or similar suffix.

### 6.3 Handover structure

Follow the shape established by `docs/handover/2026-04-29-handover.md`:

1. **Status + branch state** at the top.
2. **Where Promagen is right now** — strategic position, current product hierarchy, live authority docs.
3. **Hard rules to carry into the next session** — the guardrails that have caused regressions.
4. **What shipped this session** — chronological by pass / commit.
5. **Open decisions** — what needs the user's input before more work.
6. **Outstanding work — priority order** — recommended next steps.
7. **Repository navigation** — key paths and their purpose.
8. **Suggested opener for next session** — paste-ready prompt.
9. **Quick stats** — table of session totals (files touched, deletions, etc.).
10. **Things the next session should NOT do without approval.**

### 6.4 Handover never updates

A handover is a frozen snapshot. **Never edit a previous handover.** If state has changed since, write a new handover with the current date.

### 6.5 Handover references should be self-validating

When a handover names a file path, function, or flag, that's a *claim that it existed when written*. Future sessions must verify before relying on it (per CLAUDE.md memory discipline). Don't write speculative or aspirational content into a handover — only what's true at session-end.

---

## 7. CLAUDE.md self-improvement

CLAUDE.md ends with:

> When Martin corrects you, propose a one-line update to this file so the same mistake does not repeat next session.

When applying that:

1. Identify the specific section (e.g. "## Forbidden", "## Promagen-specific guardrails").
2. Propose the exact one-line addition or edit.
3. Wait for user approval before editing CLAUDE.md.
4. After approval, edit. Do not include a changelog entry in CLAUDE.md unless the file already has one (it currently doesn't).

CLAUDE.md is the highest-volatility live doc but should grow slowly. Bias toward consolidating with existing rules over adding new ones.

---

## 8. Memory vs docs split

Per CLAUDE.md:

- **Memory** (`.claude/projects/<project>/memory/`) — facts that should survive across sessions: validated approaches, project decisions, references to external systems, user preferences.
- **Docs** — strategic anchors, technical references, handovers, public-facing material, skill instructions.

Don't write the same fact in both places. If it belongs in CLAUDE.md or a SKILL.md, it doesn't also need to be in memory. If it's user-specific or session-flow-specific (not project-specific), memory is the right home.

When in doubt, prefer docs for "anyone working on Promagen needs this" and memory for "this user, this project context".

---

## 9. Anti-patterns — flag in review

| Anti-pattern | Why |
|--------------|-----|
| Creating a new `*.md` without explicit user request | CLAUDE.md hard rule |
| Updating an authority doc to match broken code | Hides drift; misleads future sessions |
| Editing a previous handover | Handovers are snapshots — write a new one instead |
| Adding a doc summarising what `git log` already shows | Pure overhead |
| Adding a "TODO list" doc when the TODO tool exists | Wrong tool |
| Writing aspirational future-state into an authority doc as if live | Drift trap |
| Creating a SKILL.md without updating `.claude/skills/README.md` index | Index goes stale |
| Adding emojis to docs without explicit user request | CLAUDE.md output style |
| Writing a "decisions log" alongside the handover | Decisions belong in the handover |
| Authority doc with no `Last updated` / `Version` / `Status` line | Loses the live-vs-stale signal |
| Editing a doc without bumping `Last updated` | Loses the freshness signal |
| Material rewrite without a changelog entry | Loses the why |
| Two docs claiming authority on the same topic without a "supersedes" pointer | Source-of-truth ambiguity |

---

## 10. Verification

Doc changes have lighter verification than code, but still:

1. **Re-read the doc after editing** — markdown render, frontmatter intact, links valid.
2. **Grep for cross-references** — if you renamed a doc, find every place that references it (`grep -r "old-name.md"` in repo).
3. **Update `.claude/skills/README.md` §0** if you added or removed a skill.
4. **Update CLAUDE.md** if you changed a rule that CLAUDE.md references.
5. **`Last updated` and `Version` bumped** if material change.
6. **Changelog entry added** for material change.
7. **No code changed** — if a doc edit accidentally touched code, that's a separate diff.

---

## 11. Output format — doc change

Append to the diff summary:

```text
Doc Change Summary
  Files touched:        <list>
  Doc type:             authority / handover / skill / CLAUDE.md / README.md
  Material change:      yes / no
  Version bumped:       yes / no — <old → new>
  Last updated bumped:  yes / no
  Changelog entry:      added / not needed
  Drift detected:       yes / no — <if yes, what & where>
  Cross-references:     updated / none needed
  Skill index updated:  yes / no / n/a

Existing features preserved: Yes/No
Behaviour change: No (docs only) / Yes — <if doc edit reflects a real product change>
```

For doc-only changes, `pnpm run typecheck` and `pnpm run lint` are not required (per CLAUDE.md, gates apply to `frontend/src/` changes).

---

## 12. The honest test

Before merging a doc change, ask:

> "If a future Claude session reads this doc and trusts it, will they be misled in any way?"

If yes — fix or flag before merge. The doc system fails silently. A misleading doc costs hours of confusion in a future session.

If no — ship it.
