# Promagen To-Do

**Updated:** 6 April 2026
**Owner:** Martin Yarnold
**Rule:** Only uncompleted tasks. No completed items. Cross-referenced against `src.zip` (the SSoT) and last 10 chats.

---

## P1 — Revenue-Critical

| #   | Item                                 | Detail                                                                                                                                                                                                                                                                                                                                                                                                        | Source                          |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 1.1 | **GPT expansion cap problem**        | All 25 NL builders still show `idealMin–idealMax` in system prompts. GPT compresses toward that range even when the platform accepts far more (e.g. Midjourney `maxChars: 6000`). Agreed direction: remove char ranges from GPT visibility, hard rule "don't shorten below `maxChars`", computed expansion ceiling `idealMax × 2.5`. 14 platforms have `maxChars > 2.5× idealMax`. **Unsolved since 31 Mar.** | Chat: Call 3 (31 Mar)           |
| 1.2 | **5 builders missing DNI section**   | `group-nl-bing.ts`, `group-nl-craiyon.ts`, `group-nl-imagine-meta.ts`, `group-nl-pixlr.ts`, `group-nl-simplified.ts` — zero mentions of `"negative"` in all 5 files. Users get no platform-optimised negative prompt on these platforms. Verified in src.zip.                                                                                                                                                 | Chat: Call 3 (2 Apr)            |
| 1.3 | **Negative prompts invisible in UI** | `aiOptimiseResult.negative` is returned by Call 3 and stored in the hook but never rendered in the Prompt Lab. Zero references to `.negative` rendering in `src/components/prompt-lab/`. All Dynamic Negative Intelligence output is invisible to users.                                                                                                                                                      | Chat: Optimizing top 6 (27 Mar) |

---

## P2 — Architecture / Dead Code

| #    | Item                                                     | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Source                                |
| ---- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| 2.1  | **Fold `_assemblyDefaults` into `platform-config.json`** | `platform-formats.json` still exists (46KB) holding `_assemblyDefaults`. Once confirmed stable, merge into `platform-config.json` and delete entirely. Verified: still present in `src/data/providers/`.                                                                                                                                                                                                                                                           | Chat: Platform consolidation (27 Mar) |
| 2.2  | **8 stale authority references in builder files**        | 8 files in `src/lib/optimise-prompts/` still cite `grouping-45-image-platforms-by-prompt-compatibility.md` (deleted doc). Files: `group-ideogram.ts`, `group-sd-clip-double-colon.ts`, `group-novelai.ts`, `group-recraft.ts`, `group-flux-architecture.ts`, `group-dalle-api.ts`, `types.ts`, `resolve-group-prompt.ts`. Quick find-and-replace to current spec.                                                                                                  | Chat: Platform consolidation (27 Mar) |
| 2.3  | **Dead hooks cleanup**                                   | Multiple hooks in `src/hooks/` may have zero active imports. Original audit found ~15+ candidates. Some have 1 import which may be from dead pages. Needs re-audit against actual page routes.                                                                                                                                                                                                                                                                     | Chat: Prompt Lab cleanup (25 Mar)     |
| 2.4  | **Orphaned test files**                                  | 52 test files (41 in `__tests__/`, 11 in `__tests__/admin/`) not matched by Jest config patterns. Providing zero CI protection. Cannot verify jest config from `src.zip` (not in zip).                                                                                                                                                                                                                                                                             | Chat: Test audit (25 Mar)             |
| 2.5  | **Delete `use-prompt-score.ts`**                         | Dead code. Call 4 user-facing scoring killed on 3 Apr. Hook is only referenced in comments (not imported). File: `src/hooks/use-prompt-score.ts`.                                                                                                                                                                                                                                                                                                                  | Chat: Call 4 scoring (3 Apr)          |
| 2.6  | **Delete `xray-score.tsx`**                              | Dead code. Score display component killed on 3 Apr. Only referenced in comments in `pipeline-xray.tsx`. File: `src/components/prompt-lab/xray-score.tsx`.                                                                                                                                                                                                                                                                                                          | Chat: Call 4 scoring (3 Apr)          |
| 2.7  | **Delete `platform-match-rail.tsx`**                     | Dead code. Superseded by `leaderboard-rail.tsx`. Only referenced in comments. File: `src/components/prompt-lab/platform-match-rail.tsx`.                                                                                                                                                                                                                                                                                                                           | Chat: Prompt Lab homepage (5 Apr)     |
| 2.8  | **Stale comments in `playground-page-client.tsx`**       | Line 28 header comment says "Left: PlatformMatchRail" but the actual import is `LeaderboardRail` (line 67). Line 46 references `lefthand-rail.md v1.2.0` which is now v2.0.0.                                                                                                                                                                                                                                                                                      | Chat: Leaderboard rail build (5 Apr)  |
| 2.9  | **Cron SQL filter gap — 6 of 12 event types**            | Index Rating cron queries only 6 event types: `vote`, `open`, `click`, `prompt_builder_open`, `prompt_submit`, `social_click`. The 6 Prompt Lab events (`prompt_lab_select`, `prompt_lab_generate`, `prompt_lab_copy`, `prompt_lab_optimise`, `prompt_save`, `prompt_reformat`) are tracked, stored in `provider_activity_events`, have weights in `EVENT_CONFIG`, but are excluded by hardcoded SQL `IN (...)` in `src/lib/index-rating/database.ts` (2 queries). | Chat: Cron auth (6 Apr)               |
| 2.10 | **Grey text violations in `leaderboard-rail.tsx`**       | Line 474: `text-slate-500` (banned). Line 542: `#94A3B8` / slate-400 (banned per Martin's enforced standard). Line 548: `#64748B` / slate-500 (banned).                                                                                                                                                                                                                                                                                                            | Chat: Chat system build (6 Apr)       |
| 2.11 | **Grey text violations in provider components**          | `provider-detail.tsx`: 3× `text-slate-500`. `prompt-builder.tsx`: 3× `text-slate-500`. `aspect-ratio-selector.tsx`: 3× `text-slate-500`. `length-indicator.tsx`: 1× `text-slate-500`. All banned.                                                                                                                                                                                                                                                                  | Chat: Chat system build (6 Apr)       |
| 2.12 | **`code-standard.md` §6.0.2 contradicts enforced rule**  | Doc says `text-slate-400` (#94A3B8) is the "dimmest permitted text colour" and recommends `text-white/60` for de-emphasis. Martin's enforced standard (from 6 Apr chat) bans both. Doc needs updating to match: NO grey text, use white/brand colours only.                                                                                                                                                                                                        | Chat: Chat system build (6 Apr)       |

---

## P3 — Quality / Scoring

| #   | Item                                   | Detail                                                                                                                                                                                                                                                                                                                        | Source                                |
| --- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 3.1 | **Retest tier-changed platforms**      | Platforms that changed tiers during 26 Mar audit need BQI retesting. Run `--all --mode builder --replicates 3` and check dashboard. Candidates: Fotor (→T1), BlueWillow (→T4), artguru/artistly/clipdrop (→T4), Playground (→T3), canva/pixlr/simplified/artbreeder/deepai (→T3), hotpot/jasper-art/microsoft-designer (→T4). | Chat: Platform consolidation (27 Mar) |
| 3.2 | **Update `trend-analysis.md`**         | v5.0.0, needs v6.0.0. Must reflect: T3/T4 builder separation, 25 independent NL builders, per-platform scores, BQI batch results (319/320, mean 81.97, range 51–97). Scene 06 (negative trigger) and Scene 08 (French New Wave) identified as weakest.                                                                        | Multiple chats                        |
| 3.3 | **BQI Part 9: `--scorer` flag wiring** | `claude-scorer.ts` is deployed. `aggregation.ts` references `scorerMode`. But the batch runner CLI flag is hardcoded to `gpt_only`. Needs modification to support `dual_on_flagged` and `dual_full` modes.                                                                                                                    | Chat: Part 9 build (4 Apr)            |
| 3.4 | **Verify cron auth fix in production** | Code now accepts `Authorization: Bearer <secret>` (Vercel Cron default). Fix is in src.zip for all 3 crons. But previous chat identified that crons had **never executed successfully in production** due to the old auth mismatch. Needs production verification that crons now fire correctly.                              | Chat: Chat system build (6 Apr)       |

---

## P4 — UX Polish

| #   | Item                      | Detail                                                                                                                                                                             | Source                             |
| --- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 4.1 | **Drift hint word count** | Show "3 words changed — click Generate" instead of generic text, using existing `driftChangeCount`. Not implemented — no reference to `driftChangeCount` in prompt-lab components. | Chat: Prompt Lab redesign (27 Mar) |

---

## P5 — Pre-Launch

| #   | Item                         | Detail                                     | Source |
| --- | ---------------------------- | ------------------------------------------ | ------ |
| 5.1 | **Security audit**           | Full audit before public launch.           | Memory |
| 5.2 | **Stripe Pro setup**         | Payment integration for Pro Promagen tier. | Memory |
| 5.3 | **YouTube content strategy** | Plan content when product is shelf-ready.  | Memory |

---

## P6 — Stale Authority Docs

14 authority docs identified as stale (6 Apr audit against src.zip + last 10 chats). Ranked by risk of misleading a build session:

| #    | Doc                                       | Last Updated | Key Staleness                                                                                                          |
| ---- | ----------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| 6.1  | ~~`lefthand-rail.md`~~                    | ~~Apr 2~~    | ~~Rewritten to v2.0.0 on 6 Apr.~~ **DONE**                                                                             |
| 6.2  | ~~`cron_jobs.md`~~                        | ~~Jan 27~~   | ~~Rewritten to v2.0.0 on 6 Apr.~~ **DONE**                                                                             |
| 6.3  | **`architecture.md`**                     | Mar 25       | Missing BQI system, Pipeline X-Ray, Promagen Users demo, index-rating crons, LeaderboardRail. Major subsystems absent. |
| 6.4  | **`index-rating.md`**                     | Jan 27       | Missing jitter system (±1-3/45s), +200 display inflation, 12 event types, green/red arrows, rank-climber flash.        |
| 6.5  | **`code-standard.md`**                    | Mar 18       | §6.0.2 grey text rule contradicts enforced standard (see 2.12).                                                        |
| 6.6  | **`righthand-rail.md`**                   | Apr 2        | Missing Switchboard white text + normal weight + balanced gaps, Decoder border removed, orange continuous border.      |
| 6.7  | **`homepage.md`**                         | Mar 9        | Prompt Lab discussed as homepage (5 Apr). Doc may not match current routing.                                           |
| 6.8  | **`test.md`**                             | Mar 25       | Missing BQI validation harness, batch runner tests, 52 orphaned test files.                                            |
| 6.9  | **`mission-control.md`**                  | Jan 29       | Describes dead component. Right rail is now Pipeline X-Ray / Glass Case.                                               |
| 6.10 | **`progress-report.md`**                  | Mar 25       | Frozen at 84/100. Doesn't reflect BQI, Pipeline X-Ray, Promagen Users v4.0.                                            |
| 6.11 | **`trend-analysis.md`**                   | Mar 27       | Needs v6.0.0 (same as 3.2).                                                                                            |
| 6.12 | **`prompt-builder-evolution-plan-v2.md`** | Mar 25       | Completion status wrong. Items marked pending that are done.                                                           |
| 6.13 | **`gallery-mode-master.md`**              | Jan 22       | 2.5 months old. May be superseded by Prompt Lab focus.                                                                 |
| 6.14 | **`prompt-intelligence.md`**              | Mar 23       | Still references internal scoring engine. Doesn't know about Call 1 rewrite direction.                                 |

---

_Cross-referenced against `src.zip` on 6 April 2026. Every item verified by grep/file inspection. No completed items._
