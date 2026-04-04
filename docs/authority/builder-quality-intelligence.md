# Builder Quality Intelligence System

**Version:** 3.0.0  
**Created:** 1 April 2026  
**Updated:** 4 April 2026  
**Owner:** Promagen  
**Status:** Complete. All 12 parts deployed. System operational.  
**Authority:** This document defines the automated quality regression system for Call 3 platform builders. The codebase (`src.zip`) is the single source of truth for implementation details; this document covers architecture, design decisions, schema, and operational rules.

> **Cross-references:**
>
> - `api-3.md` — Call 3 architecture, 43 independent builders
> - `platform-config.json` + `platform-config.ts` — Platform SSOT (40 platforms)
> - `bqi-operations-guide.html` — Interactive operations guide with click-to-copy commands

---

## 1. Purpose

Call 3 has 43 independent platform builder files. Each builder has a system prompt that GPT-5.4-mini executes at runtime. This system automates quality regression testing: it runs curated test scenes through the pipeline, scores the results, stores them in Postgres, and surfaces quality trends per platform. It also samples real user prompts, analyses recurring failures, and suggests targeted builder fixes — with a human approval gate before any change ships.

**What this replaced:** The user-facing "§ The Score" section in the right rail was killed. No score badge, no axis bars, no directives visible to the user. The scoring route (`/api/score-prompt`) was repurposed as an internal quality tool.

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                   BUILDER QUALITY INTELLIGENCE                │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Test Scenes (8 core + 2 holdout)                             │
│       │                                                       │
│       ▼                                                       │
│  Frozen Snapshots (Call 2 → frozen assembled prompts)         │
│       │                                                       │
│       ▼                                                       │
│  Batch Runner (scripts/builder-quality-run.ts v1.3.0)        │
│       │                                                       │
│       ├── Call 3: optimise per platform ─────────────────┐    │
│       │                                                  │    │
│       ├── Score (GPT-5.4-mini) ─────────────────────────┤    │
│       │                                                  │    │
│       ├── Score (Claude Haiku 4.5 — switchable) ────────┤    │
│       │                                                  │    │
│       ▼                                                  ▼    │
│  Postgres: builder_quality_runs + builder_quality_results     │
│       │                                                       │
│       ├── User Sampling (Community Pulse → score)             │
│       │                                                       │
│       ├── Failure Analysis (cluster → fix-class nomination)   │
│       │                                                       │
│       ├── Patch Suggestion (GPT-constrained, one edit)        │
│       │                                                       │
│       ├── Patch Testing (route-faithful, overfitting guard)   │
│       │                                                       │
│       ▼                                                       │
│  Admin Dashboard (/admin/builder-quality)                     │
│       │                                                       │
│       ▼                                                       │
│  Human Review → Approve/Reject → Manual Builder Update        │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Key architectural decisions

1. **Frozen Call 2 inputs.** When testing Call 3 builders, the assembled prompt input is frozen from a prior Call 2 snapshot. This isolates builder quality from Call 2 variance.

2. **3 replicates for decision-grade runs.** A single run is diagnostic only. For "should I ship this builder change" decisions, 3 replicates per scene are required.

3. **Dual-model scoring is switchable.** Three modes: `gpt_only` (default), `dual_on_flagged` (Claude runs when GPT flags issues), `dual_full` (both models on every run).

4. **Raw vs post-processed scoring.** Both the raw Call 3 output and the post-processed output are stored. This distinguishes "the builder dropped an anchor" from "the compliance gate fixed it."

5. **Phase 3 is human-assisted patch suggestion, not autonomous self-improvement.** The system clusters failures, suggests candidate fixes, and auto-tests them. Martin reviews and approves. No automatic deployment.

6. **Anchor audit uses three levels: `exact`, `approximate`, `dropped`.** Defined by a strict matching policy (§3.2).

7. **Anchors have severity weights:** `critical` (×3), `important` (×2), `optional` (×1).

8. **2 hidden holdout scenes** reserved for validation only. Never used during builder tuning. Their purpose is to detect overfitting.

9. **Heartbeat-based stale detection.** `last_progress_at` updated after every result. Stale = no progress for 10 minutes.

10. **SIGINT handler.** Ctrl+C marks run as `partial`, logs last platform/scene, exits cleanly.

11. **Update-in-place resume model.** Resume updates error rows rather than inserting duplicates. DB unique index enforces one row per combination.

12. **Batch and user-sample scores never mixed.** Separate metrics, separate trend lines. The divergence is the signal.

---

## 3. Test Scene Library

8 core scenes + 2 holdout scenes. Stored in `src/data/scoring/`.

| #   | ID                                 | Name                              | Anchors | Stress Target                                     |
| --- | ---------------------------------- | --------------------------------- | ------- | ------------------------------------------------- |
| 1   | `scene-01-minimal`                 | Minimal Input                     | 2       | Can the builder handle near-empty input?          |
| 2   | `scene-02-cyberpunk-courier`       | Dense Multi-Anchor                | 6       | Standard benchmark, multiple named elements       |
| 3   | `scene-03-fox-shrine`              | Sacred Architecture               | 6       | Spatial relationships, atmosphere                 |
| 4   | `scene-04-colour-saturation`       | Colour Saturation                 | 10      | Named colours — do they survive?                  |
| 5   | `scene-05-spatial-relationships`   | Spatial Relationships             | 8       | Prepositions, relative positions                  |
| 6   | `scene-06-negative-trigger`        | Negative Trigger                  | 9       | Explicit negatives in positive prompt             |
| 7   | `scene-07-compression-stress`      | Compression Stress                | 12      | ~1,900 chars — forces anchor triage               |
| 8   | `scene-08-french-new-wave`         | Style/Medium Preservation         | 13      | Camera models, film references, technical terms   |
| 9   | `scene-09-multi-subject-hierarchy` | Multi-Subject Hierarchy (HOLDOUT) | 14      | Temporal + hierarchical — never used for tuning   |
| 10  | `scene-10-typical-real-world`      | Typical Real-World (HOLDOUT)      | 9       | Realistic messy user input — overfitting detector |

### 3.1 Data Structures

```typescript
interface TestScene {
  id: string;
  name: string;
  humanText: string;
  expectedAnchors: {
    term: string;
    severity: "critical" | "important" | "optional";
  }[];
  stressTarget: string;
  categoriesExpected: string[];
  holdout: boolean;
}
```

Files: `src/data/scoring/test-scenes.json` (8 core), `src/data/scoring/holdout-scenes.json` (2 holdout), `src/data/scoring/types.ts` (interfaces).

### 3.2 Approximate Anchor Matching Policy

The `approximate` classification follows strict rules. When in doubt, classify as `dropped`.

**Sub-rules:**

- **(A)** Visually distinctive modifier loss → `dropped` (not approximate). "amber lantern" → "warm lantern" = dropped.
- **(B)** Distinctive-token loss in multi-word anchors → `dropped`. "Kodak Vision3 500T" → "film stock" = dropped.
- **(C)** Negative anchors: implicit absence does not count as approximate. "no smoke" must appear explicitly.
- **(D)** Proper nouns and branded references are exact-or-dropped. No approximate middle ground.

---

## 4. Frozen Input Snapshots

`scripts/generate-snapshots.ts` runs all scenes through Call 2 once per tier, saves assembled prompts as frozen snapshots.

- `src/data/scoring/frozen-snapshots.json` — 8 core scenes × 4 tiers = 32 entries
- `src/data/scoring/holdout-snapshots.json` — 2 holdout scenes × 4 tiers = 8 entries
- Each entry: `sceneId`, `tier`, `call2Version`, `assembledPrompt`, `snapshotHash`, `createdAt`
- Snapshot hashes are deterministic (same content = same hash)

---

## 5. Scoring Route

**Route:** `/api/score-prompt`  
**Auth:** `X-Builder-Quality-Key` header required. Requests without valid key get 401.  
**Model:** GPT-5.4-mini, `temperature: 0.2`, `json_object` response format.  
**Scorer version:** 2.0.0.

### 5.1 System prompt

Diagnostic framing — directives diagnose the builder, not the user. "Call 3 dropped the amber modifier" not "Restore the colour."

### 5.2 Anchor audit

Three-level classification per §3.2: `exact` / `approximate` / `dropped`, each with severity (`critical` / `important` / `optional`).

### 5.3 Shared rubric (SSOT)

`src/lib/builder-quality/scoring-prompt.ts` exports `buildScoringSystemPrompt()` and `buildScoringUserMessage()`. Used by both the GPT scoring route and the Claude scorer. Rubric text exists in one place only.

### 5.4 System prompt override (Part 12)

The route accepts an optional `systemPromptOverride` field in the request body. Only honoured when `X-Builder-Quality-Key` is valid (admin/script context). Substitutes the builder's system prompt while the full routing, compliance gate, and post-processing pipeline runs unchanged. Used by the patch test script.

---

## 6. Database Schema

Two tables in Postgres (Neon). Auto-created via `ensureTables()` / `ensureTablesExist()`. All migrations are idempotent `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ADD COLUMN IF NOT EXISTS`.

### 6.1 `builder_quality_runs` (parent)

| Column               | Type         | Notes                                                                      |
| -------------------- | ------------ | -------------------------------------------------------------------------- |
| `id`                 | SERIAL PK    |                                                                            |
| `run_id`             | TEXT UNIQUE  | e.g. `bqr-abc123`, `bqr-sample-xyz`, `bqr-patch-xyz`                       |
| `created_at`         | TIMESTAMPTZ  |                                                                            |
| `completed_at`       | TIMESTAMPTZ  | NULL while running. Set on completion.                                     |
| `mode`               | TEXT         | `builder` / `pipeline` / `user_sample` / `patch_test`                      |
| `scope`              | TEXT         | `all` / `<platformId>` / `sample` / `patch:<platformId>` / `rerun:<runId>` |
| `scorer_mode`        | TEXT         | `gpt_only` / `dual_on_flagged` / `dual_full`                               |
| `replicate_count`    | SMALLINT     | Default 1. Decision-grade = 3.                                             |
| `include_holdout`    | BOOLEAN      |                                                                            |
| `scorer_version`     | TEXT         | e.g. `2.0.0`                                                               |
| `scorer_prompt_hash` | TEXT         | MD5 of scorer version + prompt tag                                         |
| `gpt_model`          | TEXT         | `gpt-5.4-mini`                                                             |
| `claude_model`       | TEXT         | `claude-haiku-4-5-20251001` (nullable)                                     |
| `call2_version`      | TEXT         |                                                                            |
| `baseline_run_id`    | TEXT         | Comparison lineage                                                         |
| `parent_run_id`      | TEXT         | Recovery lineage (rerun child → parent)                                    |
| `last_progress_at`   | TIMESTAMPTZ  | Heartbeat — updated after every result                                     |
| `resumed_at`         | TIMESTAMPTZ  | Set when --resume prepares run                                             |
| `status`             | TEXT         | `pending` / `running` / `complete` / `partial`                             |
| `total_expected`     | SMALLINT     |                                                                            |
| `total_completed`    | SMALLINT     |                                                                            |
| `error_detail`       | TEXT         |                                                                            |
| `mean_gpt_score`     | NUMERIC(5,2) |                                                                            |
| `mean_claude_score`  | NUMERIC(5,2) |                                                                            |
| `flagged_count`      | SMALLINT     |                                                                            |

**Status semantics:** `complete` = zero error rows. `partial` = one or more errors. Terminality is `completed_at` (non-null = finished).

### 6.2 `builder_quality_results` (child)

| Column                     | Type        | Notes                                         |
| -------------------------- | ----------- | --------------------------------------------- |
| `id`                       | SERIAL PK   |                                               |
| `run_id`                   | TEXT FK     | References `builder_quality_runs(run_id)`     |
| `created_at`               | TIMESTAMPTZ |                                               |
| `platform_id`              | TEXT        |                                               |
| `platform_name`            | TEXT        |                                               |
| `scene_id`                 | TEXT        |                                               |
| `scene_name`               | TEXT        |                                               |
| `tier`                     | SMALLINT    |                                               |
| `call3_mode`               | TEXT        |                                               |
| `builder_version`          | TEXT        | MD5 hash of builder file content              |
| `replicate_index`          | SMALLINT    | Default 1                                     |
| `snapshot_hash`            | TEXT        |                                               |
| `human_text`               | TEXT        |                                               |
| `assembled_prompt`         | TEXT        |                                               |
| `raw_optimised_prompt`     | TEXT        | Before compliance gates                       |
| `optimised_prompt`         | TEXT        | After compliance gates                        |
| `negative_prompt`          | TEXT        |                                               |
| `input_hash`               | TEXT        |                                               |
| `output_hash`              | TEXT        |                                               |
| `assembled_char_count`     | SMALLINT    |                                               |
| `raw_optimised_char_count` | SMALLINT    |                                               |
| `optimised_char_count`     | SMALLINT    |                                               |
| `post_processing_changed`  | BOOLEAN     |                                               |
| `post_processing_delta`    | TEXT        |                                               |
| `gpt_score`                | SMALLINT    |                                               |
| `gpt_axes`                 | JSONB       |                                               |
| `gpt_directives`           | JSONB       |                                               |
| `gpt_summary`              | TEXT        |                                               |
| `claude_score`             | SMALLINT    | Nullable                                      |
| `claude_axes`              | JSONB       |                                               |
| `claude_directives`        | JSONB       |                                               |
| `claude_summary`           | TEXT        |                                               |
| `median_score`             | SMALLINT    |                                               |
| `divergence`               | SMALLINT    |                                               |
| `flagged`                  | BOOLEAN     |                                               |
| `anchor_audit`             | JSONB       |                                               |
| `anchors_expected`         | SMALLINT    |                                               |
| `anchors_preserved`        | SMALLINT    |                                               |
| `anchors_dropped`          | SMALLINT    |                                               |
| `critical_anchors_dropped` | SMALLINT    |                                               |
| `source`                   | TEXT        | `batch` / `user_sample`                       |
| `status`                   | TEXT        | `complete` / `error`                          |
| `error_detail`             | TEXT        |                                               |
| `is_holdout`               | BOOLEAN     |                                               |
| `showcase_entry_id`        | TEXT        | Links to Community Pulse entry (user samples) |
| `showcase_created_at`      | TIMESTAMPTZ | When user generated the prompt                |
| `showcase_tier`            | TEXT        | Tier at generation time                       |
| `scorer_version`           | TEXT        | Denormalised for idempotency index            |

### 6.3 Indexes

| Index                            | Columns                                                            | Notes                                      |
| -------------------------------- | ------------------------------------------------------------------ | ------------------------------------------ |
| `idx_bqr_platform_created`       | `(platform_id, created_at DESC)`                                   | Dashboard queries                          |
| `idx_bqr_run`                    | `(run_id)`                                                         | FK lookups                                 |
| `idx_bqr_flagged`                | `(flagged) WHERE flagged = TRUE`                                   | Partial                                    |
| `idx_bqr_scene`                  | `(scene_id, platform_id)`                                          | Scene analysis                             |
| `idx_bqr_critical_drops`         | `(critical_anchors_dropped) WHERE > 0`                             | Partial                                    |
| `idx_bqr_holdout`                | `(is_holdout) WHERE is_holdout = TRUE`                             | Partial                                    |
| `bqr_results_unique_logical`     | `(run_id, platform_id, scene_id, replicate_index)`                 | **UNIQUE** — one row per combination       |
| `bqr_results_unique_user_sample` | `(showcase_entry_id, scorer_version) WHERE source = 'user_sample'` | **UNIQUE** — idempotency for user sampling |

---

## 7. Batch Runner

**File:** `scripts/builder-quality-run.ts` v1.3.0  
**Execution:** `npx tsx scripts/builder-quality-run.ts <flags>`

### CLI flags

| Flag                       | Effect                                                 |
| -------------------------- | ------------------------------------------------------ |
| `--platform <id>`          | Single platform                                        |
| `--all`                    | All 40 platforms                                       |
| `--mode builder`           | Frozen input (default) — tests Call 3 only             |
| `--mode pipeline`          | Fresh Call 2 — tests entire pipeline                   |
| `--replicates 3`           | Runs per scene (default 1, decision-grade 3)           |
| `--scorer gpt_only`        | GPT only (default)                                     |
| `--scorer dual_on_flagged` | Claude auto-fires on triggers                          |
| `--scorer dual_full`       | Both models always                                     |
| `--holdout`                | Include holdout scenes                                 |
| `--baseline <run_id>`      | Compare against prior run                              |
| `--rerun <run_id>`         | Re-run only error results (creates child run)          |
| `--resume <run_id>`        | Continue a crashed run in-place                        |
| `--force`                  | Required for resuming stale runs (10+ min no progress) |

### Pipeline per platform per scene per replicate

1. Load frozen snapshot (builder mode) or fresh Call 2 (pipeline mode)
2. Call 3: optimise
3. Compute post-processing delta
4. Score (GPT)
5. Score (Claude, if mode requires it)
6. Anchor audit per §3.2
7. Store result. Update heartbeat.

### Rerun mechanics

Creates a new child run linked via `parent_run_id`. Only runs error results from the original. Fresh INSERTs under the new run_id.

### Resume mechanics

Continues the same run in-place. Skips completed combinations. Updates error rows in place (no duplicates). DB unique index enforces one row per combination.

### SIGINT handler

Ctrl+C sets run to `partial`, logs last platform/scene being processed, closes DB, exits cleanly. Second Ctrl+C force-kills. Next `--resume --force` picks up where it left off.

### Heartbeat

`last_progress_at` updated after every result (piggybacks on `total_completed` UPDATE). Stale = no progress for 10 minutes.

### Decision thresholds

- **Regression:** Mean score drops ≥5 AND any critical anchor previously preserved is now dropped, OR mean drops ≥8 regardless.
- **Improvement:** Mean score rises ≥3 AND no previously preserved critical/important anchor is now dropped.

### Cost estimate

- Full batch (gpt_only, 1 rep): ~320 runs, ~$0.50–$1.00
- Decision-grade (3 reps): ~$1.50–$3.00
- With Claude (dual_full): add ~$0.20–$0.50

---

## 8. Dual-Model Scoring

**Claude model:** `claude-haiku-4-5-20251001`  
**Client:** `src/lib/builder-quality/claude-scorer.ts` — direct fetch to Anthropic API, 30s timeout, single retry on 429/5xx.  
**Shared rubric:** `src/lib/builder-quality/scoring-prompt.ts` — SSOT for both GPT and Claude. Rubric text is never duplicated.

### `dual_on_flagged` triggers

Claude auto-fires when: GPT score < 75, OR critical dropped > 0, OR important dropped ≥ 2, OR post-processing changed substantively (~15–25% trigger rate).

### Divergence

| Gap     | Action                             |
| ------- | ---------------------------------- |
| 0–4 pts | Agreement. Median.                 |
| 5–8 pts | Minor. Median. Log.                |
| 9+ pts  | Flagged. Dashboard. Manual review. |

---

## 9. User Sampling

**File:** `scripts/builder-quality-sample.ts` v1.0.0  
**Source:** Community Pulse (`prompt_showcase_entries` table, `source = 'user'`)

**What it does:** Scores real user prompts — the actual optimised prompts users received (Option A: historical output audit). Answers "how good were the prompts we actually delivered?"

**It does NOT re-run the pipeline.** The 60-char description truncation in Community Pulse makes pipeline re-run unreliable. Option B deferred.

### Sampling rules

- Only `source = 'user'` entries (no weather demos)
- `prompt_text` ≥ 20 chars, junk filtered (repeated punctuation, URLs, single-token, placeholders)
- Most recent **unsampled** entry per platform — already-scored entries excluded via `NOT EXISTS`
- Idempotency: DB unique index on `(showcase_entry_id, scorer_version)` prevents duplicate scoring
- Error rows don't block re-sampling — only `status = 'complete'` rows are excluded

### Storage

Results stored with `source = 'user_sample'`, `showcase_entry_id` (required), `showcase_created_at`, `showcase_tier`, denormalised `scorer_version`.

### Dashboard

Platform Overview shows **"User (7d)"** column — rolling 7-day mean with sample count `n=`. Confidence styling: n≥5 white, n=3–4 dimmed, n=1–2 further dimmed, n=0 shows "—". Batch and user-sample scores never mixed in trend lines or averages.

---

## 10. Failure Analysis

**File:** `scripts/builder-quality-analyse.ts` v1.0.0  
**Prerequisites:** 50+ results per platform, 3+ scorer versions.

### Five analysis categories

1. **Anchor Drop Frequency** — severity-weighted (critical ×3, important ×2, optional ×1)
2. **Scene Weakness Map** — per-scene mean/min/max/stddev
3. **Recurring Directives** — canonicalised (lowercase, strip action verbs, Jaccard dedup at 80% overlap), classified by type (anchor-loss / style / compliance)
4. **Score Trend** — rolling 5-run average
5. **Post-Processing Reliance** — % of runs where compliance gate changed output

### Fix-Class Nomination (deterministic)

The analysis deterministically nominates one fix class based on the highest-weighted failure pattern:

| Fix Class               | Trigger                                            | Target Section     |
| ----------------------- | -------------------------------------------------- | ------------------ |
| `modifier_preservation` | Critical/important multi-word anchors dropped ≥40% | Preservation rules |
| `colour_preservation`   | Colour anchors dropped ≥50%                        | Preservation rules |
| `spatial_preservation`  | Spatial anchors dropped ≥40%                       | Composition rules  |
| `anti_invention`        | "Invented content" directives ≥30%                 | Ban list           |
| `length_floor`          | Compression scene <65 mean                         | Length rules       |
| `anti_synonym`          | Synonym churn directives ≥30%                      | Fidelity rules     |
| `compliance_dependency` | Post-processing reliance >60%                      | Core rules         |

Output: `reports/failure-report-<platformId>.json`

---

## 11. Patch Suggestion

**File:** `scripts/builder-quality-suggest.ts` v1.0.0

GPT writes ONE targeted edit for the nominated fix class and target section. GPT does NOT diagnose — the analysis script does that deterministically. GPT's role is narrowly: "write one rule for this section that addresses this failure."

### GPT constraints

- One edit per suggestion. Never multiple.
- Must target the nominated section only.
- Must include WRONG/RIGHT example (matches builder convention).
- Must reference specific failure data (anchor name, drop rate, scene).
- Bans vague suggestions ("add more detail", "be more creative", "ensure quality").
- Pattern library from Phase 2/3 proven fixes included in the prompt.

### Validation

Response validated: fix class must match nomination, WRONG/RIGHT must be present, evidence must be cited.

Output: `reports/patch-suggestion-<platformId>.json`

---

## 12. Patch Testing

**File:** `scripts/builder-quality-test-patch.ts` v1.0.0

### Route-faithful testing

Patches are tested through the actual `/api/optimise-prompt` route via `systemPromptOverride` body field (admin-only, gated behind `X-Builder-Quality-Key`). The full compliance gate, post-processing, and routing pipeline run. No deployed files are modified during testing.

### Pipeline

- 8 core scenes + 2 holdout scenes × 3 replicates = 30 results
- Scored via `/api/score-prompt`
- Compared against baseline (latest complete batch run or explicit `--baseline`)

### Overfitting guard

| Condition                                                                    | Verdict                                      |
| ---------------------------------------------------------------------------- | -------------------------------------------- |
| Core improves, holdout improves/neutral, no single holdout scene drops >4pts | **SAFE** — safe to review and manually apply |
| Core improves, one holdout scene drops >4pts                                 | **CAUTION** — review specific regression     |
| Core improves, holdout regresses ≤2pts aggregate                             | **CAUTION** — marginal                       |
| Core improves, holdout regresses >2pts aggregate                             | **REJECT** — overfitting                     |
| Core neutral or worse                                                        | **REJECT** — patch didn't help               |

**SAFE means "safe to review and manually apply."** Final confidence requires a normal batch rerun after the manual file change.

Output: `reports/patch-test-<platformId>-<runId>.json` + run in DB with `mode = 'patch_test'`

---

## 13. Validation Harness

**File:** `src/lib/validation/validate-builder.ts`  
**Execution:** `pnpm exec tsx src/lib/validation/validate-builder.ts --all`

Quick sanity check for the 7 GPT-powered NL builders. Tests the fox shrine scene through each builder's system prompt via raw OpenAI API call, then runs 4 gates:

1. **Anchor preservation** — all 9 named anchors present?
2. **Banned content** — no invented textures, composition scaffolding, synonym churn, camera-direction language?
3. **Character count** — within platform's `maxChars`?
4. **Length preservation** — GPT hasn't compressed the prompt?

Run after editing any builder system prompt. Takes seconds.

---

## 14. Admin Dashboard

**Route:** `/admin/builder-quality`  
**Access:** Admin-only via Clerk.

### 14.1 Platform Overview

40 platforms sorted by score (lowest first). Columns: platform, tier, mean, **User (7d)** (with n= count and confidence styling), stddev, preservation %, critical drops, unstable scenes, status.

### 14.2 Run History

All runs with badges: status (complete/partial/running), **↩ rerun** (purple, when `parent_run_id` non-null), **↻ resumed** (sky, when `resumed_at` non-null), **⚡ sample** (teal, when `mode = 'user_sample'`). Stale detection via `last_progress_at` (10 min threshold).

### 14.3 Flagged Divergences

GPT vs Claude > 9pts. Three-state logic depending on whether dual-model runs exist.

### 14.4 Platform Detail (`/admin/builder-quality/[platformId]`)

Scene results (expandable anchor audit), replicate variance, post-processing reliance, holdout results, baseline comparison, **failure patterns** (anchor drop heatmap, recurring directives, patch test history with verdict badges).

### Hard rules

- Builder-mode and pipeline-mode results never mixed in the same trend line.
- Batch and user-sample scores never mixed in means or rankings.
- Holdout results shown separately, never in core trend lines.

---

## 15. Storage Authority

| What                                             | Where                                                   |
| ------------------------------------------------ | ------------------------------------------------------- |
| Scoring results, run metadata, aggregates        | Postgres (DB) — authoritative                           |
| Failure analysis reports                         | `reports/failure-report-*.json` (file) — intermediate   |
| Patch suggestions (text, rationale, WRONG/RIGHT) | `reports/patch-suggestion-*.json` (file) — human review |
| Patch test deltas                                | `reports/patch-test-*.json` (file) + DB (run/results)   |
| Martin's approve/reject decision                 | Not stored in v1 — manual workflow                      |

---

## 16. File Inventory

### Scripts (6)

| File                                    | Purpose                                                        |
| --------------------------------------- | -------------------------------------------------------------- |
| `scripts/builder-quality-run.ts`        | Batch runner v1.3.0 (normal, rerun, resume, SIGINT, heartbeat) |
| `scripts/builder-quality-sample.ts`     | User sampling from Community Pulse                             |
| `scripts/builder-quality-analyse.ts`    | Failure analysis + fix-class nomination                        |
| `scripts/builder-quality-suggest.ts`    | GPT-constrained patch suggestion                               |
| `scripts/builder-quality-test-patch.ts` | Route-faithful patch testing + overfitting guard               |
| `scripts/generate-snapshots.ts`         | Frozen snapshot generator                                      |

### Library (7)

| File                                        | Purpose                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------- |
| `src/lib/builder-quality/database.ts`       | Table creation, query helpers, health check                                     |
| `src/lib/builder-quality/scoring-prompt.ts` | Shared rubric builder (SSOT for GPT + Claude)                                   |
| `src/lib/builder-quality/claude-scorer.ts`  | Anthropic API scoring client                                                    |
| `src/lib/builder-quality/aggregation.ts`    | Three-layer aggregation (platform, scene, platform×scene) + baseline comparison |
| `src/lib/builder-quality/anchor-audit.ts`   | Client-side anchor matching per §3.2                                            |
| `src/lib/builder-quality/runner.ts`         | Core runner logic (separated from CLI)                                          |
| `src/lib/builder-quality/hash.ts`           | MD5 helpers                                                                     |

### Admin pages (2)

| File                                                                                 | Purpose             |
| ------------------------------------------------------------------------------------ | ------------------- |
| `src/app/admin/builder-quality/page.tsx` + `builder-quality-client.tsx`              | Dashboard overview  |
| `src/app/admin/builder-quality/[platformId]/page.tsx` + `platform-detail-client.tsx` | Platform drill-down |

### Admin API routes (6)

| Route                                            | Purpose                                               |
| ------------------------------------------------ | ----------------------------------------------------- |
| `/api/admin/builder-quality/runs`                | Recent runs list                                      |
| `/api/admin/builder-quality/run-results`         | Results for a selected run                            |
| `/api/admin/builder-quality/platform-detail`     | Full drill-down data for one platform                 |
| `/api/admin/builder-quality/flagged-divergences` | GPT vs Claude divergence table                        |
| `/api/admin/builder-quality/user-sample-stats`   | 7-day rolling average per platform (user samples)     |
| `/api/admin/builder-quality/failure-patterns`    | Anchor drops, directives, scene weakness, patch tests |

### Dashboard components (10)

| Component                             | Purpose                                        |
| ------------------------------------- | ---------------------------------------------- |
| `platform-overview-table.tsx`         | 40-platform sorted table with User (7d) column |
| `run-history-table.tsx`               | Run list with rerun/resumed/sample badges      |
| `scene-results-table.tsx`             | Per-scene results with expandable anchor audit |
| `anchor-audit-panel.tsx`              | Anchor audit detail view                       |
| `replicate-variance-table.tsx`        | Min/max/stddev per scene                       |
| `post-processing-panel.tsx`           | Post-processing reliance stats                 |
| `holdout-panel.tsx`                   | Holdout scene results                          |
| `comparison-panel.tsx`                | Baseline comparison view                       |
| `flagged-divergences-table.tsx`       | GPT vs Claude divergence flags                 |
| `flagged-divergences-placeholder.tsx` | Placeholder (should be deleted)                |

### Data files (4)

| File                                      | Purpose                  |
| ----------------------------------------- | ------------------------ |
| `src/data/scoring/test-scenes.json`       | 8 core scenes            |
| `src/data/scoring/holdout-scenes.json`    | 2 holdout scenes         |
| `src/data/scoring/frozen-snapshots.json`  | 32 frozen Call 2 outputs |
| `src/data/scoring/holdout-snapshots.json` | 8 frozen holdout outputs |

### Validation (1)

| File                                     | Purpose                                   |
| ---------------------------------------- | ----------------------------------------- |
| `src/lib/validation/validate-builder.ts` | Quick 4-gate sanity check for NL builders |

### Modified routes (2)

| File                                   | Change                                                                           |
| -------------------------------------- | -------------------------------------------------------------------------------- |
| `src/app/api/score-prompt/route.ts`    | Auth hardening, diagnostic rubric, shared scoring-prompt.ts import, anchor audit |
| `src/app/api/optimise-prompt/route.ts` | `systemPromptOverride` body field for patch testing (admin-only)                 |

---

## 17. Non-Regression Rules

1. `/api/score-prompt` stays deployed — batch runner, sampling, and patch testing all use it
2. Batch runner runs offline, never during user sessions
3. Admin dashboard behind admin auth
4. No user-facing string references scoring or quality grades
5. Frozen snapshots committed to repo
6. Raw output stored alongside post-processed — never overwritten
7. Holdout scenes never used for tuning
8. `builder_version` is file hash, never free text
9. Builder-mode and pipeline-mode never mixed in trend lines
10. `approximate` classification follows §3.2 strictly — when in doubt, `dropped`
11. Batch and user-sample scores never mixed in means, rankings, or trend lines
12. One row per `(run_id, platform_id, scene_id, replicate_index)` — DB-enforced
13. No builder files are ever modified automatically by the system

---

## 18. Changelog

- **4 Apr 2026 (v3.0.0):** Complete rewrite reflecting all 12 deployed parts. Added: rerun/resume mechanics (Part 10), SIGINT handler, heartbeat, user sampling (Part 11), failure analysis + fix-class nomination (Part 12), GPT-constrained patch suggestion (Part 12), route-faithful patch testing with overfitting guard (Part 12), `systemPromptOverride` on optimise route, `showcase_entry_id`/`showcase_created_at`/`showcase_tier`/`scorer_version` on results, two unique indexes, storage authority section, full file inventory, validation harness reference.
- **3 Apr 2026 (v2.5.0):** Final pre-build revision. All 10 scenes complete. Three ChatGPT reviews (97/100). BUILD APPROVED.
- **3 Apr 2026 (v2.0.0):** Pivot to internal system. User-facing score killed.
- **1 Apr 2026 (v1.0.0):** Initial implementation.
