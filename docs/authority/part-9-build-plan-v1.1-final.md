# Builder Quality Intelligence — Part 9: Dual-Model Scoring Build Plan

**Version:** 1.1.0  
**Date:** 4 April 2026  
**Authority:** `docs/authority/builder-quality-intelligence.md` v2.5.0 §8  
**Code standard:** `code-standard.md` (all §6 rules apply)  
**Working practices:** `best-working-practice.md` (verification format, zip delivery)  
**Depends on:** Parts 1–8 (all complete, dashboard live at `/admin/builder-quality`)  
**Estimated effort:** 2–3 hours  
**Review history:** v1.0.0 → ChatGPT 92/100 (5 changes). All 5 addressed below.  
**Evidence base:** Triangulated scoring data from `harmonizing-claude-openai.md` v3.0.0 confirms Claude scores T3 ~5pts high and T4 ~3-5pts high vs ChatGPT/Grok median. Claude is the second pair of eyes, not a replacement.

---

## Context

The scoring pipeline currently runs `gpt_only` — GPT-5.4-mini scores every platform's output using the diagnostic rubric (Parts 3–4). The database schema already has all Claude columns in place (`claude_score`, `claude_axes`, `claude_directives`, `claude_summary` in `builder_quality_results`; `claude_model`, `mean_claude_score` in `builder_quality_runs`). The batch runner currently hardcodes `scorer: 'gpt_only'` and ignores the `--scorer` flag.

Part 9 wires Claude as a second scorer, makes the `--scorer` flag functional, and replaces the Flagged Divergences placeholder in the dashboard with a real table.

---

## Why dual-model scoring exists

GPT is the primary scorer — the rubric was calibrated against its behaviour across multiple Playground rounds. Claude is a _disagreement detector_. If both models say 85, trust 85. If GPT says 91 and Claude says 74, something interesting is happening and it's worth a manual look.

The value is not redundancy — it's catching blind spots. GPT has known ceilings (verb softening, compositional flattening). Claude has a known leniency bias on approximate anchors. When they disagree by >9pts, the divergence is a signal, not noise.

---

## What's NOT in scope

- Claude is not a failover for user-facing API calls (Calls 1–3). That's a separate, much larger piece of work.
- Claude does not replace GPT as primary scorer. GPT remains the calibrated baseline.
- No autonomous model switching. The `--scorer` flag is a manual choice per batch run.
- No new database columns — the schema was designed for this from Part 3.

---

## Three scorer modes (from authority doc §8)

| Mode              | When Claude fires                                                                                                      | Use case                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `gpt_only`        | Never                                                                                                                  | Default. Diagnostic and tuning runs. Current state.                              |
| `dual_on_flagged` | When GPT result meets any trigger: score < 75, critical dropped > 0, important dropped ≥ 2, or post-processing changed | Normal batch runs after Part 9. ~15-25% of results trigger Claude.               |
| `dual_full`       | Every result scored by both models                                                                                     | Release candidate runs only. Full comparison data for decision-grade confidence. |

---

## Divergence thresholds (from authority doc §8)

| GPT vs Claude gap | Action                                                                               |
| ----------------- | ------------------------------------------------------------------------------------ |
| 0–4 pts           | Agreement. Use median as canonical score.                                            |
| 5–8 pts           | Minor divergence. Use median. Log for analysis.                                      |
| 9+ pts            | Flagged. Marked `flagged: true` in DB. Appears on dashboard. Manual review required. |

---

## Sub-Delivery 9a — Shared Rubric + Claude Scoring Client + Batch Runner Wiring (~1.5 hrs)

### What's built

**New file: `src/lib/builder-quality/scoring-prompt.ts` (ChatGPT fix #1 — shared rubric builder)**

A single function that builds the scoring system prompt and calibration examples. Both the GPT scoring route (`/api/score-prompt/route.ts`) and the new Claude scorer import from this file. The rubric text lives in exactly one place — no duplication, no drift.

Exports:

- `buildScoringSystemPrompt(expectedAnchors)` → returns the full system prompt string
- `buildScoringUserMessage(input)` → returns the structured user message
- `SCORING_CALIBRATION_EXAMPLES` → the calibration examples array

The GPT scoring route is modified to import from this shared builder instead of containing its own inline prompt text. The Claude scorer imports the same functions. This is the only modification to the GPT route in Part 9.

**New file: `src/lib/builder-quality/claude-scorer.ts`**

A standalone scoring client that calls the Anthropic API directly via `fetch`. Uses the shared rubric from `scoring-prompt.ts`. Returns the same response shape as the GPT scoring route so the batch runner can treat them interchangeably.

**Client responsibilities:**

- Accepts the same input as the GPT scoring route (optimised prompt, assembled prompt, human text, platform info, expected anchors)
- Calls `buildScoringSystemPrompt()` and `buildScoringUserMessage()` from the shared rubric builder
- Calls Anthropic API: `claude-haiku-4-5-20251001`, `max_tokens: 1200`, temperature `0.2`
- Parses the JSON response into the same shape: `score`, `axes`, `directives`, `summary`, `anchorAudit`
- Handles errors gracefully: returns `null` on failure (batch runner logs and continues with GPT-only data)
- Single retry on transient 429/5xx before returning null
- Timeout: 30 seconds per call
- All logging uses `console.debug('[builder-quality]')` prefix

**Environment:**

- `ANTHROPIC_API_KEY` in `.env.local` (new env var, manual addition)
- No changes to `src/lib/env.ts` — the Claude scorer reads `process.env.ANTHROPIC_API_KEY` directly since it's only used server-side in the batch runner

**Modified file: `scripts/builder-quality-run.ts`**

The batch runner gains real `--scorer` flag support:

| Change                          | Detail                                                                                                                                                                                                                                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--scorer` flag parsed properly | Accepts `gpt_only`, `dual_on_flagged`, `dual_full` (currently hardcoded to `gpt_only`)                                                                                                                                                                                                           |
| After GPT scoring               | Check scorer mode. If `dual_full`: always call Claude. If `dual_on_flagged`: call Claude when trigger conditions met (see below)                                                                                                                                                                 |
| Claude results stored           | `claude_score`, `claude_axes`, `claude_directives`, `claude_summary` columns populated (currently always null)                                                                                                                                                                                   |
| Consensus score computed        | `median_score` column populated with `Math.round((gptScore + claudeScore) / 2)` — this is the midpoint average of two scorers, stored in the existing `median_score` column. When only GPT scored (Claude failed or not triggered), `median_score` stays null. See §Median Score Semantics below |
| Divergence computed             | `divergence = Math.abs(gptScore - claudeScore)`                                                                                                                                                                                                                                                  |
| Flagging logic                  | If `divergence >= 9`: set `flagged = true`. Increment run's `flagged_count`                                                                                                                                                                                                                      |
| Claude coverage tracking        | Console output at end of batch: `Claude coverage: 27/32 successful (84%)`. Run-level `mean_claude_score` computed from successful Claude rows only, not total rows                                                                                                                               |
| Run summary                     | `mean_claude_score` computed from rows where `claude_score IS NOT NULL` only. If zero Claude rows succeeded, `mean_claude_score` stays null                                                                                                                                                      |
| Claude model tracked            | `claude_model` column populated with the model string used                                                                                                                                                                                                                                       |
| Missing API key guard           | If `--scorer` is `dual_*` and `ANTHROPIC_API_KEY` is not set: log error and exit immediately before starting any work                                                                                                                                                                            |

**`dual_on_flagged` trigger conditions (ChatGPT fix #2 — widened from <70):**

Claude fires in `dual_on_flagged` mode when **any** of these conditions are true on the GPT result:

| Trigger                          | Rationale                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------ |
| GPT score < 75                   | Catches mid-70s flattening that <70 would miss                                 |
| Critical anchors dropped > 0     | Original trigger — kept                                                        |
| Important anchors dropped ≥ 2    | Multiple important losses is structurally interesting even if score is decent  |
| `post_processing_changed = true` | Compliance gates intervened — worth a second opinion on the raw output quality |

This fires on roughly 15-25% of results (up from ~5-10% with the old <70 trigger), which keeps costs well below `dual_full` while catching materially more interesting cases.

### New files

| File                                        | Purpose                                                                           |
| ------------------------------------------- | --------------------------------------------------------------------------------- |
| `src/lib/builder-quality/scoring-prompt.ts` | Shared rubric builder — single source of truth for GPT and Claude scoring prompts |
| `src/lib/builder-quality/claude-scorer.ts`  | Anthropic API scoring client — uses shared rubric, returns same shape as GPT      |

### Modified files

| File                                | Change                                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `scripts/builder-quality-run.ts`    | `--scorer` flag functional, Claude scoring wired, divergence/flagging logic, coverage reporting                    |
| `src/app/api/score-prompt/route.ts` | Import system prompt from shared `scoring-prompt.ts` instead of inline text. No other changes to GPT scoring logic |

### Does NOT modify

- Any dashboard components (8a/8b) — those are updated in 9b
- Any user-facing code
- Database schema (columns already exist)

### Verification

```powershell
# Run at repo root: C:\Users\Proma\Projects\promagen\frontend
pnpm run typecheck

# Test gpt_only (should behave identically to before Part 9)
npx tsx scripts/builder-quality-run.ts --platform artguru --scorer gpt_only

# Test dual_full on a single platform
npx tsx scripts/builder-quality-run.ts --platform artguru --scorer dual_full

# Test dual_on_flagged (may or may not trigger Claude depending on GPT score)
npx tsx scripts/builder-quality-run.ts --platform artguru --scorer dual_on_flagged

# Test missing API key guard
# (temporarily rename ANTHROPIC_API_KEY in .env.local)
npx tsx scripts/builder-quality-run.ts --platform artguru --scorer dual_full
# Expected: error message and exit, no batch work started
```

**What "good" looks like:**

1. `gpt_only` run produces identical results to pre-Part 9 (regression check)
2. `dual_full` run shows both `gpt_score` and `claude_score` populated in DB
3. `median_score` and `divergence` columns populated
4. If divergence ≥ 9: `flagged = true` on the result, `flagged_count` incremented on the run
5. Console output shows: `[artguru/scene-01] GPT: 84, Claude: 79, Divergence: 5, Flagged: false`
6. `claude_model` on the run record shows `claude-haiku-4-5-20251001`
7. End-of-batch console shows: `Claude coverage: 8/8 successful (100%)`

### Done when

- [ ] `scoring-prompt.ts` exports shared rubric builder, imported by both GPT route and Claude scorer
- [ ] GPT scoring route (`/api/score-prompt`) uses shared rubric — no inline prompt text remaining
- [ ] `claude-scorer.ts` compiles, uses shared rubric, handles API errors gracefully (returns null)
- [ ] Claude scorer retries once on transient 429/5xx before returning null
- [ ] `--scorer gpt_only` produces identical results to pre-Part 9 (no regression)
- [ ] `--scorer dual_full` populates all Claude columns in results table
- [ ] `--scorer dual_on_flagged` fires Claude on: score < 75, critical dropped > 0, important dropped ≥ 2, or post-processing changed
- [ ] `median_score` computed as midpoint average of GPT and Claude — null when Claude did not score
- [ ] `divergence` computed correctly as absolute difference
- [ ] `flagged = true` set when divergence ≥ 9
- [ ] Run-level `flagged_count` and `mean_claude_score` updated (mean from successful Claude rows only)
- [ ] Claude coverage reported in console at end of batch (e.g. `Claude coverage: 27/32 successful (84%)`)
- [ ] Missing `ANTHROPIC_API_KEY` exits immediately with clear error
- [ ] Console output shows per-result GPT/Claude/divergence/flagged summary

---

## Sub-Delivery 9b — Dashboard: Flagged Divergences Table (~1 hr)

### What's built

Replace the placeholder component from Part 8a with a real Flagged Divergences table.

**Section behaviour (ChatGPT fix #4 — three explicit data states):**

The section must distinguish three states cleanly, using metadata from the API, not by inferring from empty arrays:

| State                               | How detected                                             | What the user sees                                                                                                                    |
| ----------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| No dual-model runs exist            | API returns `hasDualRuns: false`                         | "No divergence data available — dual-model scoring not enabled. This section activates in Part 9 when dual-model scoring is enabled." |
| Dual-model runs exist, none flagged | API returns `hasDualRuns: true`, `flaggedResults: []`    | "No flagged divergences found — all GPT vs Claude gaps are under 9 points."                                                           |
| Flagged results exist               | API returns `hasDualRuns: true`, `flaggedResults: [...]` | Table sorted by divergence descending (worst disagreements first)                                                                     |

**Scoping:** The table shows flagged results from the **selected run** in the 8a overview by default (same run selection state). If no run is selected, shows latest run. This prevents the table becoming a junk drawer of accumulated flagged rows across all runs.

**Table columns:**
Platform Name, Scene, GPT Score, Claude Score, Divergence, Run ID (truncated), Created

**Row behaviour:**

- Click row → navigates to platform detail page for that platform/run (same pattern as Platform Overview clicks)
- All rows are clickable with `cursor-pointer`

**Data source:**
New API route queries `builder_quality_results` for rows where `flagged = true`, joined with run metadata. No aggregation needed — raw flagged rows are the data.

### New files

| File                                                                 | Purpose                                      |
| -------------------------------------------------------------------- | -------------------------------------------- |
| `src/components/admin/builder-quality/flagged-divergences-table.tsx` | Real divergence table (replaces placeholder) |

### New API routes

| Route                                            | Method | Purpose                                      |
| ------------------------------------------------ | ------ | -------------------------------------------- |
| `/api/admin/builder-quality/flagged-divergences` | GET    | Returns flagged results with divergence data |

### Modified files

| File                                                       | Change                                                                                                                                                |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/admin/builder-quality/builder-quality-client.tsx` | Import `FlaggedDivergencesTable` instead of `FlaggedDivergencesPlaceholder`. Pass runs data so the component can detect whether dual-model runs exist |

### Deleted files

| File                                                                       | Reason                               |
| -------------------------------------------------------------------------- | ------------------------------------ |
| `src/components/admin/builder-quality/flagged-divergences-placeholder.tsx` | Replaced by the real table component |

### Verification

```powershell
# Run at repo root
pnpm run typecheck
pnpm run dev
```

**Visual checks:**

1. Navigate to `/admin/builder-quality`
2. If no dual-model runs exist: Flagged Divergences section still shows placeholder text (identical to current)
3. After running a `dual_full` batch: section shows either "No flagged divergences" or a table of flagged results
4. Click a flagged row → navigates to platform detail
5. All clickable rows show pointer cursor
6. All text scales with viewport

### Done when

- [ ] Placeholder text shown when no dual-model runs exist
- [ ] "No flagged divergences" shown when dual runs exist but none flagged
- [ ] Table renders flagged results sorted by divergence (highest first)
- [ ] Click row navigates to platform detail with correct runId
- [ ] Placeholder file deleted
- [ ] All styling follows code standard (clamp, cursor-pointer, no grey text)

---

## File Summary (Part 9 total)

### New files (3):

| File                                                                 | Sub-delivery |
| -------------------------------------------------------------------- | ------------ |
| `src/lib/builder-quality/scoring-prompt.ts`                          | 9a           |
| `src/lib/builder-quality/claude-scorer.ts`                           | 9a           |
| `src/components/admin/builder-quality/flagged-divergences-table.tsx` | 9b           |

### New API routes (1):

| Route                                            | Sub-delivery |
| ------------------------------------------------ | ------------ |
| `/api/admin/builder-quality/flagged-divergences` | 9b           |

### Modified files (3):

| File                                                       | Sub-delivery | Change                                                                |
| ---------------------------------------------------------- | ------------ | --------------------------------------------------------------------- |
| `src/app/api/score-prompt/route.ts`                        | 9a           | Import rubric from shared `scoring-prompt.ts` instead of inline text  |
| `scripts/builder-quality-run.ts`                           | 9a           | --scorer flag, Claude wiring, divergence/flagging, coverage reporting |
| `src/app/admin/builder-quality/builder-quality-client.tsx` | 9b           | Swap placeholder for real table component, pass selected run context  |

### Deleted files (1):

| File                                                                       | Reason                 |
| -------------------------------------------------------------------------- | ---------------------- |
| `src/components/admin/builder-quality/flagged-divergences-placeholder.tsx` | Replaced by real table |

### Existing features preserved: Yes

---

## Environment Setup (manual, not in zip)

```powershell
# Add to .env.local:
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx
```

No changes to `src/lib/env.ts`. The Claude scorer reads `process.env.ANTHROPIC_API_KEY` directly since it's server-side only (batch runner script, not a Next.js route).

---

## Cost Impact

| Mode                                | GPT cost per full batch (320 results) | Claude additional | Total        |
| ----------------------------------- | ------------------------------------- | ----------------- | ------------ |
| `gpt_only`                          | ~$0.50–$1.00                          | $0.00             | ~$0.50–$1.00 |
| `dual_on_flagged` (~15-25% trigger) | ~$0.50–$1.00                          | ~$0.10–$0.25      | ~$0.60–$1.25 |
| `dual_full`                         | ~$0.50–$1.00                          | ~$0.20–$0.50      | ~$0.70–$1.50 |

Claude Haiku is significantly cheaper per token than GPT-5.4-mini. The cost is marginal even in `dual_full` mode. The widened `dual_on_flagged` triggers (~15-25% vs old ~5-10%) add roughly $0.05–$0.10 per batch — negligible.

---

## Median Score Semantics (ChatGPT fix #5)

The database column is `median_score`. With two scorers, this is computed as `Math.round((gptScore + claudeScore) / 2)` — the midpoint average, which for two values is mathematically equivalent to the median.

**Hard rules:**

- `median_score` is only populated when both GPT and Claude scored successfully. If Claude failed or was not triggered (e.g. `gpt_only` mode, or `dual_on_flagged` where triggers were not met), `median_score` stays `null`.
- `mean_claude_score` on the run record is computed from successful Claude rows only, not total rows. If 27/32 results have Claude scores, the mean is computed from those 27.
- Code comments explicitly document: `// median_score = midpoint average of GPT + Claude. Null when Claude did not score.`

---

## Non-Regression Rules (Part 9 specific)

1. `gpt_only` mode must produce identical results to pre-Part 9 — zero behavioural change
2. Claude failure does not fail the batch — GPT result is stored, Claude columns stay null, batch continues
3. The GPT scoring route (`/api/score-prompt`) is modified only to import the rubric from `scoring-prompt.ts` — no changes to GPT scoring logic, validation, or response shape
4. No user-facing changes — Claude scoring is batch-runner only
5. `flagged` is set per-result, not per-platform — the same platform can have flagged and unflagged results across different scenes
6. `median_score` is only populated when both scores exist — if Claude fails or was not triggered, median stays null
7. Divergence thresholds (0–4/5–8/9+) match authority doc §8 exactly
8. Both GPT and Claude scoring use the shared rubric builder (`scoring-prompt.ts`) — rubric text must never be duplicated in separate files
9. Admin auth enforced on the new flagged-divergences route (same pattern as other admin routes)
10. Console logging uses `console.debug('[builder-quality]')` prefix

---

## Design Decisions

**Why Claude Haiku, not Sonnet or Opus?**

Haiku is the cheapest model that can follow a structured scoring rubric reliably. The scoring task is mechanical (classify anchors, score against a rubric, output JSON) — it doesn't need creative reasoning. Haiku at $0.25/M input tokens vs Sonnet at $3/M means ~12× cheaper per run. If Haiku proves unreliable on anchor classification, upgrade to Sonnet — but start cheap.

**Why the same system prompt for both models?**

The rubric must be identical for divergence to be meaningful. If GPT scores against rubric A and Claude scores against rubric B, a 14-point gap tells you nothing — it could be rubric difference, not genuine quality disagreement. Same rubric means divergence = genuine disagreement about the prompt.

**Why not use the Anthropic SDK?**

The batch runner is a standalone `tsx` script, not a Next.js route. Adding `@anthropic-ai/sdk` as a dependency is fine but adds a package. A direct `fetch` call to `https://api.anthropic.com/v1/messages` with the correct headers is simpler, has zero dependencies, and works identically. The plan uses direct fetch — if the builder prefers the SDK, that's a fine alternative.

**Why `dual_on_flagged` as the recommended default?**

Full dual-model on every result is wasteful when 90% of platforms score >80 and have no critical drops. `dual_on_flagged` fires Claude on the ~15-25% of results where GPT found something structurally interesting (score < 75, critical drops, multiple important drops, or post-processing intervention). For release candidates (builder changes you're about to ship), use `dual_full`.

---

## ChatGPT v1.0.0 Feedback — All 5 Changes Addressed

| #   | ChatGPT feedback                                           | What changed in v1.1.0                                                                                                                                                       |
| --- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Shared rubric builder not explicitly factored — drift risk | Added `scoring-prompt.ts` as single source of truth. GPT route modified to import from it. Claude scorer imports the same functions. Rubric text lives in exactly one place  |
| 2   | `dual_on_flagged` trigger too narrow (<70)                 | Widened to: score < 75 OR critical dropped > 0 OR important dropped ≥ 2 OR post-processing changed. Fires ~15-25% of results                                                 |
| 3   | Claude coverage not surfaced in run summaries              | Console reports `Claude coverage: N/M successful (X%)` at end of batch. `mean_claude_score` computed from successful rows only. Explicit null semantics for partial coverage |
| 4   | Flagged divergences table state logic needs clarity        | Three explicit states defined with API metadata (`hasDualRuns` flag). Table scoped to selected run by default to prevent junk drawer accumulation                            |
| 5   | `median_score` naming sloppy for what's computed           | New "Median Score Semantics" section added. Code comments explicitly document it's the midpoint average, null when Claude didn't score                                       |
