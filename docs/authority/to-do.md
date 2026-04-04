# Promagen To-Do

**Updated:** 4 April 2026  
**Owner:** Martin Yarnold  
**Rule:** Only uncompleted tasks. No completed items. Cross-referenced against `src.zip` (the SSoT).

---

## P1 — Revenue-Critical

| #   | Item                                 | Detail                                                                                                                                                                                                                                                                                                                                                                                                                          | Source                                    |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 1.1 | **GPT expansion cap problem**        | GPT sees `idealMin–idealMax` in builder system prompts and compresses toward that range — even when the user's prompt is rich and the platform accepts far more (e.g. Midjourney `maxChars: 6000`). Agreed direction: remove char ranges from GPT visibility, hard rule "don't shorten below `maxChars`", computed expansion ceiling `idealMax × 2.5`. 14 platforms have `maxChars > 2.5× idealMax`. **Unsolved since 31 Mar.** | Chat: Call 3 architecture (31 Mar)        |
| 1.2 | **5 builders missing DNI section**   | `group-nl-bing.ts`, `group-nl-craiyon.ts`, `group-nl-imagine-meta.ts`, `group-nl-pixlr.ts`, `group-nl-simplified.ts` — no `"negative"` field in their JSON response template. Users get no platform-optimised negative prompt on these platforms. Verified: zero mentions of `"negative"` in all 5 files.                                                                                                                       | Chat: Call 3 architecture (2 Apr)         |
| 1.3 | **Negative prompts invisible in UI** | `aiOptimiseResult.negative` is returned by Call 3 and stored in the hook but never rendered anywhere in the Prompt Lab. All Dynamic Negative Intelligence output is invisible to the user. Verified: zero references to `.negative` rendering in `src/components/prompt-lab/`.                                                                                                                                                  | Chat: Optimizing top 6 providers (27 Mar) |

---

## P2 — Architecture / Cleanup

| #   | Item                                                     | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                           | Source                                |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| 2.1 | **Fold `_assemblyDefaults` into `platform-config.json`** | `platform-formats.json` still exists (46KB) and holds `_assemblyDefaults`. Once confirmed stable, merge `_assemblyDefaults` into `platform-config.json` and delete `platform-formats.json` entirely. Verified: `platform-formats.json` still present in `src/data/providers/`.                                                                                                                                                                   | Chat: Platform consolidation (27 Mar) |
| 2.2 | **8 stale authority references in builder files**        | 8 optimise-prompt group files still cite `grouping-45-image-platforms-by-prompt-compatibility.md` (deleted). Should reference the current spec. Quick find-and-replace.                                                                                                                                                                                                                                                                          | Chat: Platform consolidation (27 Mar) |
| 2.3 | **Dead hooks cleanup**                                   | ~15+ hooks in `src/hooks/` have zero imports outside their own folder: `use-ab-test`, `use-ai-optimisation`, `use-category-assessment`, `use-commodities-quotes`, `use-commodity-tooltip-data`, `use-community-pulse`, `use-composition-mode`, `use-daily-usage`, `use-drift-detection`, `use-exchange-order`, `use-exchange-selection`, `use-feedback-memory`, `use-fx-quotes`, `use-fx-selection`, `use-fx-trace`, and more. Verified by grep. | Chat: Prompt lab cleanup (25 Mar)     |
| 2.4 | **Orphaned test files**                                  | ~25 test files in `__tests__/` and `__tests__/admin/` not matched by Jest config patterns. ~290 test cases providing zero CI protection. Cannot verify fix from `src.zip` (jest config not in zip).                                                                                                                                                                                                                                              | Chat: Test audit (25 Mar)             |

---

## P3 — Quality / Scoring

| #   | Item                                   | Detail                                                                                                                                                                                                                                                                                                                                              | Source                                |
| --- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 3.1 | **Retest tier-changed platforms**      | Platforms that changed tiers during 26 Mar audit need retesting: Fotor (→T1), BlueWillow (→T4), artguru/artistly/clipdrop (→T4), playground (→T3), canva/pixlr/simplified/artbreeder/deepai (→T3), hotpot/jasper-art/microsoft-designer (→T4). **BQI batch runner can now do this.** Run `--all --mode builder --replicates 3` and check dashboard. | Chat: Platform consolidation (27 Mar) |
| 3.2 | **Update `trend-analysis.md`**         | Needs rewrite to reflect: T3/T4 builder separation, 43 independent builders, per-platform scores, BQI system results. Not currently in `src/docs/`.                                                                                                                                                                                                 | Multiple chats                        |
| 3.3 | **BQI Part 9: `--scorer` flag wiring** | The `--scorer` CLI flag exists in the batch runner but is hardcoded to `gpt_only` on line 3. Claude scorer `src/` plumbing is deployed. The runner needs modification to actually use `dual_on_flagged` and `dual_full` modes.                                                                                                                      | Chat: Part 9 build (4 Apr)            |

---

## P4 — UX Polish

| #   | Item                      | Detail                                                                                                                                                                                                     | Source                             |
| --- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 4.1 | **Drift hint word count** | Show "3 words changed — click Generate" instead of generic text, using existing `driftChangeCount`. More Zeigarnik tension. Not implemented — no reference to `driftChangeCount` in prompt-lab components. | Chat: Prompt Lab redesign (27 Mar) |

---

## P5 — Pre-Launch

| #   | Item                         | Detail                                     | Source |
| --- | ---------------------------- | ------------------------------------------ | ------ |
| 5.1 | **Security audit**           | Full audit before public launch.           | Memory |
| 5.2 | **Stripe Pro setup**         | Payment integration for Pro Promagen tier. | Memory |
| 5.3 | **YouTube content strategy** | Plan content when product is shelf-ready.  | Memory |

---

## Removed (verified complete in `src.zip`)

These were in the previous to-do and are now verified done:

- ~~1.3 Dead v4 files~~ — `assessment-box.tsx`, `category-decision.tsx`, `side-note-pills.tsx` deleted.
- ~~1.4 `limitsTokenLimit` ignored~~ — adapter's `derivePromptLimit()` now uses `limitsTokenLimit ?? tokenLimit`. 10 CLIP platforms correctly hard-capped at 77.
- ~~1.5 Derived exports include `_removed`~~ — filter on lines 135/170 of `platform-config.ts`.
- ~~1.6 `categoryOrder` falls back to `[]`~~ — now falls back to `raw._assemblyDefaults.categoryOrder`.
- ~~2.1 Hardcode top 5 T3 builders~~ — 25 NL dedicated builders deployed.
- ~~2.2 Build T4 dedicated builders~~ — artguru, artistly, bluewillow, clipdrop, craiyon etc. all have dedicated files.
- ~~2.3 Scoring engine~~ — Killed by design. BQI replaced user-facing scoring entirely.
- ~~4.1 Explore Drawer badges + cascade~~ — `getTierBadge()` for all 4 tiers + `cascadeScores` sorting deployed.
- ~~4.2 Assembled prompt duplication~~ — Martin: "keep for now." Not a to-do.
- ~~4.3 Optimise button pulse~~ — `xray-tape-pulse` animation exists.
- ~~6.1 Builder unit tests~~ — BQI validation harness (`validate-builder.ts`) covers 4-gate checks.
- ~~6.2 Harmony scoring per builder~~ — BQI batch runner replaces this entirely.
- ~~BQI Parts 1–12~~ — All deployed and verified.
