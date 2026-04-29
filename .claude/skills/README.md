# SKILLS — Claude Code skills, MCPs, and autonomy boundaries for Promagen

This file is a peer to `CLAUDE.md`. Where `CLAUDE.md` defines the rules of engagement, this file defines the **tooling and autonomy** Claude Code uses to drive the Promagen vision forward.

Project-specific skills (with frontmatter) live alongside this README in `.claude/skills/<skill-name>/SKILL.md`.

Read this when:

- Setting up a new dev environment
- Considering whether to enable a new skill, MCP, or permission
- Deciding which Claude capability fits a particular task

---

## 0. Project skills in this folder

Skills written specifically for the Promagen codebase. Each is a standalone `SKILL.md` in its own subfolder. Trigger conditions are in each skill's frontmatter `description` field.

| Skill | Folder | What it does |
|-------|--------|--------------|
| `ai-visibility` | [ai-visibility/](./ai-visibility/SKILL.md) | Enforces Sentinel principles on every code change. Public-facing pages must be Findable, Crawlable, Understandable, Citation-ready, and Measurable. Promagen sells Sentinel; Promagen's own code must pass Sentinel. Severity rubric (Blocker/High/Medium/Low), schema.org playbook by page type, named failure patterns. |
| `design-polish` | [design-polish/](./design-polish/SKILL.md) | Codifies the live design system from `globals.css`, `layout.tsx`, the Sentinel components, leaderboard, nav, and footer. Brand gradients, fluid typography (`clamp()` everywhere), layout constants, the three canonical CTA styles, motion vocabulary, and the critical guardrails (AuthButton override, body colour inheritance, viewport `overflow: hidden` lock). |
| `docs-update` | [docs-update/](./docs-update/SKILL.md) | Keeps docs honest: code-as-SSoT, live-vs-archive split, version + date + status pattern, drift-flag discipline, handover format. Default state is "don't write a doc" — the skill governs when to write, when to update, and when to flag drift instead of silently reconciling. |
| `affiliate-integrity` | [affiliate-integrity/](./affiliate-integrity/SKILL.md) | Direct revenue protection. Every external provider link routes through `/go/[providerId]` — no exceptions. FTC `rel="sponsored"` enforcement, surface attribution via `src=`, schema.org `Product.url` rules, footer/page disclosure, grep patterns to catch direct `affiliateUrl` leaks. Created in response to the April 2026 🤝-emoji bypass bug. |
| `sentinel-readiness` | [sentinel-readiness/](./sentinel-readiness/SKILL.md) | First-customer-readiness rubric for the Sentinel commercial surface. Five gates (Discover → Understand → Trust → Buy → Onboard) with pass criteria each. The 25-box pre-launch checklist. Every change to `/sentinel`, the offer stack, the proof case study, or the booking flow runs against this. |

Future skills slated for this folder: `sentinel-audit` (custom slash command, see §3.1), `schema-write` (§3.2), `leaderboard-rank-check` (§3.3), `affiliate-link-check` (§3.4 — narrower automated version of `affiliate-integrity`), `sentinel-intake-validate` (§3.5). Build them as the need is real, not as scaffolding.

---

## 1. Built-in Claude Code skills

These ship with Claude Code. Invoke with `/<skill-name>` or let Claude invoke them. No installation required.

| Skill | What it does | When to use on Promagen |
|-------|--------------|-------------------------|
| `/fewer-permission-prompts` | Scans recent transcripts, adds an allowlist to `.claude/settings.local.json`. Reduces "approve this command?" prompts for read-only and routine commands. | **Run this once.** Materially changes the friction of every future session. Single highest-impact upgrade. |
| `/simplify` | Reviews changed code for reuse, quality, efficiency. Catches dead branches, duplicated logic, premature abstractions. | After any pass that touched 3+ files. |
| `/review` | Reviews a pull request — code quality, edge cases, regression risks. | Before any merge to `main`. Mandatory before merging anything that touches the Sentinel offer surface, the homepage, or `/go/[id]`. |
| `/security-review` | Complete security review of pending changes on the current branch. | Before deploying anything that touches Stripe, Clerk auth, the `/go/` outbound redirect, or the Sentinel cron. |
| `/loop` | Runs a prompt or slash command on a recurring interval. | Use when polling something that's about to change — e.g. watching a Vercel deploy. Not a daily driver. |
| `/schedule` | Creates scheduled remote agents (cron-like). | One concrete use: run a Sentinel-style audit on `promagen.com` every Monday morning and email the result. |
| `/claude-api` | Helps build and migrate Anthropic SDK code, including prompt caching. | Useful when (or if) we add Claude API features to Sentinel itself — e.g. AI-written summary in the Monday report. |
| `/init` | Initialises a `CLAUDE.md` for a new project. | Already done for Promagen. Useful for the next side project. |
| `/ultrareview` | Multi-agent cloud review of the current branch. Bills per use. | Before the Sentinel commercial soft-launch. Worth the spend once. Not a routine command. |

**Recommended priority order:**

1. `/fewer-permission-prompts` — first, immediately
2. `/security-review` — before every Sentinel-related deploy
3. `/review` — before every merge to main
4. `/simplify` — after any large refactor pass

---

## 2. MCP servers

Available in this environment but require explicit setup/auth. Listed in priority order for Promagen.

| MCP | Worth it? | Why |
|-----|-----------|-----|
| **Vercel** | **Yes — set up first** | Lets Claude debug deploy failures, fetch runtime logs, ship preview deploys, check domains. When a Sentinel deploy breaks at 11pm, this is what saves you. |
| **Stripe** | Defer until Pro deletion is decided | Useful for managing Sentinel pricing pages and subscription products when Sentinel monitoring is wired to Stripe. Not blocking. |
| **Google Drive + Gmail** | Yes — set up when running Sentinel sales | Drafting outreach emails, managing the Sentinel intake form (sample report templates, audit deliverables as Drive docs). |
| **Google Calendar** | Optional | Useful for booking Sentinel discovery calls. Cal.com is probably a better fit. |
| **PayPal** | Skip | Not relevant unless Sentinel takes PayPal. |

---

## 3. Custom slash commands worth building

These don't ship with Claude Code. They're project-specific commands written into `.claude/commands/` that Claude can invoke.

### 3.1 `/sentinel-audit <domain>` — flagship

**Purpose:** Run a stylised version of the Sentinel Snapshot on a target domain. Outputs a structured PDF/markdown report.

**Inputs:** Domain, top 3 competitors, 8–12 priority queries, brand variants, geographic focus.

**What it does:**
- Parses robots.txt for AI bot allow/disallow
- Crawls priority pages (5–15) and audits HTML for SSR vs CSR, schema presence, meta titles/descriptions, canonicals, internal link graph
- Sends test queries to ChatGPT, Claude, Perplexity, Gemini (manual or via API where available)
- Builds citation share table vs. competitors
- Outputs ranked fix list with effort/impact

**Why build it:** Turns the founder-led audit process into a repeatable, cached operation. Eventually becomes the engine behind a `/sentinel/intake` self-serve form.

**Effort:** ~1 day to wire up. Can stub the citation step manually at first.

### 3.2 `/schema-write <url-or-component>` — direct service deliverable

**Purpose:** Given a page or component, generate valid JSON-LD (`Article`, `FAQPage`, `HowTo`, `Product`, `Organization`, `BreadcrumbList`) ready to paste into the page metadata.

**Why build it:** Schema markup is one of the highest-impact, easiest-to-deliver Sentinel fixes. Auto-generating the markup turns a 30-minute manual task into a 30-second one. Direct service deliverable for the Fix Sprint tier.

**Effort:** Half a day.

### 3.3 `/leaderboard-rank-check` — proof asset maintenance

**Purpose:** Run the 12 Promagen priority queries against the 4 AI engines weekly. Screenshot the results. Post the citation score to a Resend digest or Slack channel.

**Why build it:** This is how the leaderboard's "live proof" status is maintained. If Promagen drops out of the top 5 on ChatGPT for "best AI image generator", you want to know on Monday morning, not when a prospect mentions it on a call.

**Effort:** Half a day to wire (manual citation step until OpenAI/Anthropic publish official APIs for this).

### 3.4 `/affiliate-link-check`

**Purpose:** Automated grep-based scan against the rules in `affiliate-integrity/SKILL.md`. Scans the codebase for any external provider link that bypasses `/go/[id]`. Warns if found.

**Why build it:** The 🤝 emoji direct-link bug happened once; this prevents it from happening again. Cheap to build given the SKILL.md spells out the grep patterns.

**Effort:** 30 minutes.

### 3.5 `/sentinel-intake-validate`

**Purpose:** Given a client intake submission (per the Snapshot intake fields in `commercial-strategy.md` §2.4), validate completeness and flag missing items before scheduling delivery.

**Why build it:** Reduces audit slips caused by missing intake fields. The single biggest cause of slipped audit deadlines is missing client input. Direct counterpart to `sentinel-readiness/SKILL.md` Gate 5 (Onboard).

**Effort:** Half a day.

---

## 4. Autonomy boundaries — what to pre-approve

The cleaner the permission boundaries, the faster Claude can ship without breaking trust.

### 4.1 Pre-approve immediately (zero risk)

Add these to `.claude/settings.local.json` `permissions.allow`:

```
Bash(pnpm run typecheck)
Bash(pnpm run lint)
Bash(pnpm run lint:fix)
Bash(pnpm run format)
Bash(pnpm run format:check)
Bash(pnpm run test:*)
Bash(pnpm run check)
Bash(pnpm run verify)
PowerShell(pnpm run typecheck *)
PowerShell(pnpm run lint *)
PowerShell(pnpm run test* *)
Read(c:\Users\Proma\Projects\promagen\**)
Glob(*)
Grep(*)
```

These are read-only or static-analysis commands. They cannot modify state.

### 4.2 Pre-approve with discretion (low risk)

```
Bash(pnpm run dev)        # background dev server, reversible
Bash(pnpm run build)      # build, no side effects
Bash(git status)
Bash(git diff *)
Bash(git log *)
Bash(git branch)
Bash(gh pr list *)
Bash(gh pr view *)
Edit(c:\Users\Proma\Projects\promagen\frontend\src\**)
Edit(c:\Users\Proma\Projects\promagen\docs\**)
Write(c:\Users\Proma\Projects\promagen\frontend\src\**)
Write(c:\Users\Proma\Projects\promagen\docs\**)
```

Edits to source and docs are reversible via Git. Trust Claude to use them.

### 4.3 Always require approval (these stay manual)

- `Bash(git push *)`, `Bash(git push --force *)`, `Bash(git reset --hard *)`, `Bash(git branch -D *)`, `Bash(git checkout -- *)`, `Bash(git clean -f *)`
- `Bash(pnpm install *)` — adding new deps changes lockfile
- Any command touching `package.json`, `next.config.*`, `tsconfig.json`, `eslint.config.*`, `vercel.json`, `.env*`
- Any command that hits Stripe, Clerk role logic, production secrets
- Any `gh pr create`, `gh pr merge`, `gh pr close` — outbound communication
- Any database migration, `psql`, schema-changing command
- Any deploy to production
- Any `mailto:`, Slack post, GitHub issue/PR creation

### 4.4 The `permissions.deny` list

```
Bash(git push --force *)
Bash(git push -f *)
Bash(rm -rf *)
PowerShell(Remove-Item -Recurse -Force *)
```

These should never run regardless of context.

---

## 5. Workflow patterns

Patterns that work well on Promagen, in rough order of leverage.

### 5.1 Parallel tool calls

When work is independent, call multiple tools in a single response. Reads, greps, writes to unrelated files — all in parallel. Cuts wall-clock time materially on multi-file passes.

Example (from this project): when stripping the homepage, the `Edit` to `top-nav.tsx`, `Edit` to `mobile-bottom-nav.tsx`, and `Write` to `footer.tsx` are independent and ran in parallel.

### 5.2 Background processes

Use `run_in_background: true` on `pnpm run dev` so the dev server boots while you keep working. Output streams when ready; you don't have to babysit the terminal.

### 5.3 Subagent delegation

For broad codebase exploration (>3 queries), spawn an `Explore` agent with `subagent_type: 'Explore'`. The agent runs in isolated context — its searches don't bloat your conversation. Used twice on this project to map the codebase and the authority docs.

For architectural planning, spawn a `Plan` agent.

For complex multi-step tasks, spawn a `general-purpose` agent.

### 5.4 Worktree isolation

`Agent` calls can run in a temporary git worktree. Useful for "try this risky refactor and tell me if it works" without touching committed files.

### 5.5 Memory

Persistent memory at `.claude/projects/<project>/memory/`. Use it for facts that should survive across sessions: validated approaches, project decisions, references to external systems.

Don't save: ephemeral task state, anything in `CLAUDE.md`, anything trivially recoverable from `git log` or current code.

---

## 6. Recommended setup checklist

In rough order. Tick as you go.

```
[ ] Run /fewer-permission-prompts to populate .claude/settings.local.json
[ ] Add the §4.1 pre-approve list to .claude/settings.local.json
[ ] Connect Vercel MCP (auth in Vercel dashboard)
[ ] Build .claude/commands/sentinel-audit.md (custom slash command)
[ ] Build .claude/commands/schema-write.md
[ ] Build .claude/commands/affiliate-link-check.md
[ ] Run /security-review before next merge to main
[ ] Schedule weekly /leaderboard-rank-check via /schedule (after building it)
[ ] Connect Google Drive + Gmail MCPs when running first Sentinel sales outreach
```

---

## 7. What to avoid

- **Building a self-serve Sentinel SaaS dashboard before selling 10 audits manually.** Service-led sales first; productisation second. The custom slash commands are productivity tools for the founder-led service, not consumer-facing infrastructure.
- **Connecting MCPs you don't use.** Each connected MCP increases the attack surface and the cognitive load. Only connect Vercel + Drive + Gmail. Stripe later. Skip the rest.
- **Running `/ultrareview` casually.** It bills per use. One pre-launch run is worth it; weekly runs aren't.
- **Pre-approving destructive commands.** No `rm -rf`, no `git push --force`, no `git reset --hard`. Trust requires reversibility.
- **Adding a SKILL.md without updating §0 above.** The index is the discovery mechanism — a stale index buries skills.

---

## 8. Changelog

- **29 Apr 2026 (v1.2.0):** Added four project skills: `design-polish/`, `docs-update/`, `affiliate-integrity/`, `sentinel-readiness/`. Updated `ai-visibility/` to merge ChatGPT-contributed content (severity rubric, named failure patterns, Sentinel-specific 3-area split, redirect/deletion decision tree, change-plan template). Now five project skills total in §0.
- **29 Apr 2026 (v1.1.0):** Moved from project root to `.claude/skills/README.md`. Added §0 listing project-specific skills. First entry: `ai-visibility/`.
- **28 Apr 2026 (v1.0.0):** Initial. Documents the skills, MCPs, custom commands, and autonomy boundaries that drive the Promagen Sentinel pivot. Authored alongside `CLAUDE.md` v1.0.0 and `commercial-strategy.md` v2.0.0.
