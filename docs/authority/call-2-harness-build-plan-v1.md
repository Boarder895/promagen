# Call 2 Quality Harness — Build Plan

**Status:** Build plan, paired with `call-2-quality-architecture-v0.3.1.md`
**Author:** Claude (via Martin)
**Audience:** Implementation. Read in a fresh chat alongside v0.3.1 and `src.zip`.
**Date:** 10 April 2026
**Architecture freeze:** v0.3.1 (this document does not modify the architecture)

---

## 0. How to use this document

This is the implementation companion to `call-2-quality-architecture-v0.3.1.md`. The architecture document is the **what** and the **why**. This document is the **how** and the **in what order**.

**Read order for a fresh Claude chat:**

1. `call-2-quality-architecture-v0.3.1.md` (architecture, frozen)
2. This document (build plan)
3. `src.zip` (extract; ground truth for all existing code)
4. Verify §2 of this document (Martin's pre-flight items) before touching code
5. Start Phase A

**What this plan is not:**

- Not an architecture revision. Architecture is frozen at v0.3.1.
- Not a rewrite of existing Call 2. The current `/api/generate-tier-prompts` route is untouched throughout the build. Everything is additive.
- Not a one-shot build. Phases are independently shippable. After Phase E the harness has real diagnostic value even if Phases F–J never ship.

---

## 1. Honest answer to "can you build this without my input?"

**No, not entirely.** Specifically four things genuinely block on Martin and cannot be bluffed:

| #   | What I need                              | Why I can't fake it                                                                                                                                                                                                                                           | When it blocks                                                                                 |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1   | **The 15 hand-curated canonical scenes** | These need Martin's taste and REME standards. The lighthouse keeper is canonical because Martin made it canonical. I can stub with the lighthouse keeper alone (memory has it) and write the other 14 as placeholders, but the real 14 must come from Martin. | Phase B can start with one scene. Real diagnostic value from Phase D onward needs the full 15. |
| 2   | **X-Dev-Auth secret value**              | Secret material. I write the env-reading code; Martin creates the secret and adds it to `.env.local` and Vercel env.                                                                                                                                          | Blocks Phase A end-to-end test (the dev endpoint won't accept requests without it).            |
| 3   | **Judge model decision**                 | Claude (which model?) or ChatGPT or both. Affects code paths and cost. Martin's call because it touches existing workflows and budgets.                                                                                                                       | Blocks Phase F (judged scorer). Phases A–E do not need a judge.                                |
| 4   | **Cluster mapping sign-off**             | I can draft `rule-cluster-map.json` from inspecting the system prompt, but the assignment is opinionated and shapes diagnostic interpretation. Martin should review before it ships.                                                                          | Blocks Phase G (failure clustering). Phases A–F do not need it.                                |

**Everything else I can do:** all code in Phases A–E, the LLM-generated stress test candidate pool (3× the target for Martin to curate), the draft cluster mapping, all mechanical scorer rules (extracted from the existing system prompt), all metamorphic perturbation functions, all test fixtures, and all documentation.

**Recommended workflow:** Martin provides items 1–2 before Phase A starts. Items 3–4 can come in parallel during Phases A–E and unblock F and G. Phase J (production realism) is blocked indefinitely on Sentinel and is acknowledged as deferred.

---

## 2. Pre-flight checklist for Martin

Tick before Phase A starts.

- [ ] **Secret added.** Add `CALL2_HARNESS_DEV_AUTH=<random 32-char string>` to `.env.local` and Vercel env (Preview environment only — never Production). Generate with `openssl rand -hex 16` or similar.
- [ ] **Path approval.** Confirm these new directories are acceptable:
  - `src/app/api/dev/generate-tier-prompts/route.ts` (dev endpoint)
  - `src/lib/call-2-harness/` (harness library code)
  - `src/data/call-2-scenes/` (scene library)
  - `__tests__/call-2-harness/` (tests, mirrors existing pattern)
  - `harness-runs/` at repo root, gitignored (run output storage)
- [ ] **First canonical scene.** Confirm the lighthouse keeper input string is the canonical reference scene to seed Phase B. (Memory has it as: dramatic coastal lighthouse keeper in storm — Martin to confirm exact wording or paste a fresh copy.)
- [ ] **Judge decision deferred.** Mark whether judge model decision (item 3 above) will come before Phase F or be made then.

If any item is unticked, the new chat should ask Martin before proceeding past Phase A.

---

## 3. Architecture-to-code mapping

Quick reference for the new chat. Maps architecture sections to file locations.

| Architecture section         | Code location                                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| §11 Route-stage attribution  | `src/lib/call-2-harness/route-stage-runner.ts` (new)                                                       |
| §3 Stage A (raw model)       | New code wrapping the existing OpenAI call                                                                 |
| §3 Stage B (post-processing) | Existing: `src/lib/harmony-post-processing.ts` (do not modify)                                             |
| §3 Stage C (compliance)      | Existing: `src/lib/harmony-compliance.ts` (do not modify)                                                  |
| §3 Stage D (final JSON)      | New code applying B then C in sequence                                                                     |
| §5 Mechanical scorer         | `src/lib/call-2-harness/mechanical-scorer/` (new directory, one file per tier)                             |
| §6 Judged scorer             | `src/lib/call-2-harness/judged-scorer.ts` (new)                                                            |
| §9 Metamorphic runner        | `src/lib/call-2-harness/metamorphic-runner.ts` (new)                                                       |
| §10 Failure clustering       | `src/lib/call-2-harness/failure-clustering.ts` + `src/data/call-2-scenes/rule-cluster-map.json` (both new) |
| §13 Isolated runner          | `src/app/api/dev/generate-tier-prompts/route.ts` (new)                                                     |
| §14 Failure-mode inventory   | `src/lib/call-2-harness/inventory-writer.ts` (new)                                                         |
| §16 Run classes              | `src/lib/call-2-harness/run-classes.ts` (new)                                                              |
| Scene library                | `src/data/call-2-scenes/scenes.json` + `src/data/call-2-scenes/holdout.json` (new)                         |

The existing Call 2 route at `src/app/api/generate-tier-prompts/route.ts` is **never modified**. The dev endpoint imports from the same harmony libraries to guarantee identical behaviour.

---

## 4. Phased build

Ten phases, A → J. The first five (A–E) are the proof-of-life spine. Phases F–I are the "next-level" layers from the architecture. Phase J is deferred.

| Phase | Goal                                                                 | Blocked on Martin?    | Estimated relative effort |
| ----- | -------------------------------------------------------------------- | --------------------- | ------------------------- |
| **A** | Dev endpoint returning all four route stages                         | Items 1, 2            | Small                     |
| **B** | Scene library loader + first 5 scenes                                | Item 1 (full library) | Small                     |
| **C** | Mechanical scorer for all known rules across all four tiers          | No                    | Medium                    |
| **D** | Failure-mode inventory writer (single-run JSON output)               | No                    | Small                     |
| **E** | Version diffing (paired analysis preference)                         | No                    | Small                     |
| ☆     | **Proof-of-life complete. Harness has real diagnostic value.**       |                       |                           |
| **F** | Judged scorer (5 sharp questions, batched, calibrated)               | Item 3                | Medium                    |
| **G** | Failure clustering (8 clusters, deterministic mapping)               | Item 4                | Small                     |
| **H** | Metamorphic runner (6 perturbations, 2-of-3 oracle, spot-audit lane) | No                    | Medium                    |
| **I** | Mutation testing (3-bucket classification, prioritised)              | No                    | Small                     |
| **J** | Production-realism replay slice                                      | Sentinel ship         | Deferred                  |

**Effort note:** "small" ≈ one to two focused sessions. "Medium" ≈ three to five. These are rough — actual numbers will reveal themselves.

---

## 5. Phase A — Dev endpoint and stage capture

### 5.1 Goal

Build a dev-only endpoint that takes the same shape of input as the production Call 2 route, but **returns all four route stages** as separate fields. No scoring, no judging. Just the four artefacts plus metadata.

This is the foundation. Everything downstream depends on it.

### 5.2 Files to create

**`src/app/api/dev/generate-tier-prompts/route.ts`** — the dev endpoint. Mirrors the production route at `src/app/api/generate-tier-prompts/route.ts` but with these differences:

1. **404 in production.** First line of the handler: `if (env.NODE_ENV === "production") return new Response(null, { status: 404 });`
2. **Auth header check.** `const auth = req.headers.get("X-Dev-Auth"); if (auth !== env.call2HarnessDevAuth) return new Response(null, { status: 404 });` (404 not 401 — does not announce its existence.)
3. **Accepts system prompt in body.** Unlike production, the system prompt is parameterised via the request body. Means the harness can test any version of the prompt without redeploy.
4. **Returns all four stages.** Calls OpenAI for Stage A, calls `postProcessTiers()` for Stage B, calls `enforceT1Syntax()` and `enforceMjParameters()` for Stage C, then assembles Stage D.
5. **Does not rate-limit per IP.** Rate-limits per dev secret instead (so a runaway harness loop doesn't lock out a real dev).

**Request shape:**

```json
{
  "systemPrompt": "<full Call 2 system prompt as a string>",
  "userMessage": "<scene input>",
  "model": "gpt-5.4-mini",
  "temperature": 0.5,
  "reasoningEffort": "medium",
  "maxCompletionTokens": 2000,
  "providerContext": null
}
```

**Response shape:**

```json
{
  "stage_a_raw_model": { "tier1": {...}, "tier2": {...}, "tier3": {...}, "tier4": {...} },
  "stage_b_post_processed": { ... },
  "stage_c_compliance_enforced": { ... },
  "stage_d_final": { ... },
  "metadata": {
    "model_version": "gpt-5.4-mini-2026-02-15",
    "latency_ms": 4310,
    "tokens_used": { "prompt": 1842, "completion": 612 },
    "stages_applied": ["a", "b", "c", "d"]
  }
}
```

**`src/lib/env.ts`** — modify to add `CALL2_HARNESS_DEV_AUTH` to the schema (string, optional). Mirror existing env-validation pattern.

**`__tests__/call-2-harness/dev-endpoint.test.ts`** — test that:

- POST without auth header returns 404
- POST with wrong auth returns 404
- POST with correct auth returns 200 with all four stages populated
- Production env var simulation returns 404 even with correct auth
- Stage D differs from Stage A on at least one known-fixable case (e.g. T2 `--no` duplication)

### 5.3 Verification

After this phase: PowerShell from frontend folder

```powershell
pnpm run test:util __tests__/call-2-harness/dev-endpoint.test.ts
```

Expected: all tests pass. Manual smoke: POST a single lighthouse keeper request to `http://localhost:3000/api/dev/generate-tier-prompts` with the auth header set, get back four populated stage objects.

### 5.4 What good looks like

A working dev endpoint that the harness can call from a script. Stage D matches what production would return for the same input. Stage A is captured but unmodified by post-processing. The diff between Stage A and Stage D for a deliberately broken input (e.g. `--no` duplication) is visible.

### 5.5 Existing features preserved

**Yes.** The production route at `src/app/api/generate-tier-prompts/route.ts` is not touched. The dev route imports `postProcessTiers`, `enforceT1Syntax`, and `enforceMjParameters` from the same source files used by production.

---

## 6. Phase B — Scene library loader and first scenes

### 6.1 Goal

A typed scene library with the schema from architecture §4.3, a loader that reads scenes from JSON files, and the first five scenes (one canonical + four placeholders).

### 6.2 Files to create

**`src/data/call-2-scenes/scenes.json`** — array of scene objects matching the schema:

```json
[
  {
    "id": "lighthouse-keeper-canonical",
    "category": "canonical",
    "input": "<Martin to confirm exact wording>",
    "tags": ["weather", "human-subject", "atmosphere", "emotional"],
    "exercises_rules": [
      "T3.verb_fidelity",
      "T3.mood_conversion",
      "T1.scale_modifier_preservation",
      "T4.anchor_triage"
    ],
    "perturbation_seeds": [
      "punctuation",
      "synonym",
      "polite_prefix",
      "clause_reorder"
    ],
    "holdout": false,
    "tag_provenance": "manual"
  }
]
```

**`src/data/call-2-scenes/holdout.json`** — empty array initially, populated after Martin provides 15 holdouts.

**`src/lib/call-2-harness/scene-library.ts`** — typed loader:

```typescript
export interface Scene {
  id: string;
  category:
    | "canonical"
    | "stress"
    | "trap"
    | "human_factors"
    | "alien"
    | "real_world";
  input: string;
  tags: string[];
  exercises_rules: string[];
  perturbation_seeds: string[];
  holdout: boolean;
  tag_provenance: "manual" | "generator_declared" | "mechanical_inferred";
}

export function loadScenes(opts: { includeHoldout: boolean }): Scene[];
export function loadSceneById(id: string): Scene | null;
```

**`__tests__/call-2-harness/scene-library.test.ts`** — verifies loader, schema validation, holdout exclusion by default.

### 6.3 Dependencies

Item 1 from §2 (canonical scene confirmation) for the lighthouse keeper. The other four scenes in this phase are placeholder stubs that Martin replaces during Phase C or D — they exist only to make the loader testable.

### 6.4 Verification

```powershell
pnpm run test:util __tests__/call-2-harness/scene-library.test.ts
```

### 6.5 What good looks like

`loadScenes({ includeHoldout: false })` returns 5 scenes; `{ includeHoldout: true }` returns 5 (none in holdout yet); `loadSceneById("lighthouse-keeper-canonical")` returns the lighthouse keeper.

---

## 7. Phase C — Mechanical scorer

### 7.1 Goal

Implement the per-tier mechanical scorer covering every rule from architecture §5 that can be checked deterministically. Scorer runs against any of the four route stages.

### 7.2 Files to create

**`src/lib/call-2-harness/mechanical-scorer/`** — directory with one file per tier plus a coordinator:

- `t1-rules.ts` — weight syntax (parenthetical vs double-colon), 0.1 step enforcement, ≤4-word weight wraps, subject highest weight, quality prefix/suffix presence, comma-separated check, no isolated colour weights
- `t2-rules.ts` — `--ar`/`--v`/`--s`/`--no` presence, `--no` exactly once, ≥3 `::` clauses, no mid-phrase weights, empty `negative` JSON field
- `t3-rules.ts` — char count [280, 420], sentence count [2, 3], banned phrase list, banned tail constructions, first-8-word echo detection, gender pronoun matching
- `t4-rules.ts` — char count ≤325, ≥10 words per sentence, banned openers, first-8-word echo
- `index.ts` — exports `runMechanicalScorer(stage: TierOutput, stageId: "a"|"b"|"c"|"d", providerContext: ...): MechanicalResult`

Each rule is a small pure function returning `{ ruleId: string, passed: boolean, details?: string }`. The coordinator runs every relevant rule against every tier and returns a flat array of results tagged with stage ID.

**`__tests__/call-2-harness/mechanical-scorer/`** — one test file per tier, with deliberately constructed pass and fail fixtures for each rule.

### 7.3 Rule extraction strategy (no Martin input needed)

I extract the rule list directly from the existing Call 2 system prompt at `src/app/api/generate-tier-prompts/route.ts` (the `buildSystemPrompt` function, ~190 lines starting around line 141). Every rule that can be regex-checked or counter-checked goes in. Subjective rules go to the judged scorer in Phase F.

### 7.4 Verification

```powershell
pnpm run test:util __tests__/call-2-harness/mechanical-scorer
```

All rule tests pass against constructed fixtures. Run the scorer against a real Call 2 output (lighthouse keeper, all four stages) and confirm Stage A often fails T2 `--no exactly once` while Stage D usually passes — that's the rescue dependency signature.

### 7.5 What good looks like

Mechanical scorer detects ~30 distinct rule conditions per sample, runs in milliseconds, returns structured results that can be diffed across stages. Detects the `--no` rescue case end-to-end.

---

## 8. Phase D — Failure-mode inventory writer

### 8.1 Goal

Take the output of N harness runs (scenes × samples × stages) and produce the JSON inventory format from architecture §14. Including the `rescue_dependency` index per rule.

### 8.2 Files to create

**`src/lib/call-2-harness/inventory-writer.ts`** — core schema implementation. Functions:

- `buildInventory(runs: HarnessRun[]): FailureModeInventory`
- `writeInventoryToDisk(inventory: FailureModeInventory, path: string): void`
- `loadInventory(path: string): FailureModeInventory`

**`src/lib/call-2-harness/run-classes.ts`** — defines the run-class taxonomy from architecture §16.1:

```typescript
export type RunClass =
  | "smoke_alarm"
  | "decision_support"
  | "dispute_resolution"
  | "milestone"
  | "mutation";
export const RUN_CLASS_CONFIG: Record<
  RunClass,
  {
    samplesPerScene: number;
    metamorphic: boolean;
    holdout: boolean;
    spotAudit: boolean;
  }
>;
```

**`src/lib/call-2-harness/rescue-dependency.ts`** — implements the formula from architecture §11.2:

```typescript
export function calculateRescueDependency(
  samples: SampleResult[],
  ruleId: string,
): number {
  const stageDPasses = samples.filter((s) =>
    s.results.find((r) => r.ruleId === ruleId && r.stage === "d" && r.passed),
  );
  const stageARescues = stageDPasses.filter((s) =>
    s.results.find((r) => r.ruleId === ruleId && r.stage === "a" && !r.passed),
  );
  return stageDPasses.length === 0
    ? 0
    : stageARescues.length / stageDPasses.length;
}
```

**`harness-runs/`** — gitignored output directory. Each run produces `harness-runs/<version>-<run_class>-<timestamp>.json`.

### 8.3 Verification

Run a synthetic harness run against the lighthouse keeper (5 samples), produce an inventory, manually verify the rescue dependency calculation by hand on the `T2.no_appears_once` rule.

### 8.4 What good looks like

A harness run produces a JSON inventory matching the schema in architecture §14. The `rescue_dependency` field correctly distinguishes a rule that the model owns from a rule that cleanup is rescuing. The inventory is human-readable in any text editor.

---

## 9. Phase E — Version diffing

### 9.1 Goal

Compare two stored inventories (e.g. v4.5 vs v4.6) and produce the `diff_vs_previous` block from architecture §14. Default to **paired analysis** per architecture §16.3.

### 9.2 Files to create

**`src/lib/call-2-harness/diff.ts`** — functions:

- `diffInventories(previous: FailureModeInventory, current: FailureModeInventory): DiffReport`
- `pairedRuleAnalysis(previous, current, ruleId): PairedDelta` — operates on the same scene/sample family across both runs
- `classifySignificance(delta, runClass): "smoke_alarm" | "decision_support" | "dispute_resolution" | "below_noise"`

The significance classifier uses run-class operational thresholds, not statistical confidence. From architecture §16: smoke-alarm runs catch only large changes; decision-support runs catch most fix-or-don't-fix calls; dispute-resolution runs resolve close calls.

### 9.3 Verification

Create two synthetic inventories with known deltas. Verify the diff correctly identifies improvements, regressions, and below-noise changes. Verify rescue dependency deltas surface correctly (architecture §14 example: a rule whose Stage D rate improved but rescue dependency rose).

### 9.4 What good looks like

`diffInventories(v4_5, v4_6)` produces a report showing rules that improved, rules that regressed, clusters that moved, and an explicit warning when a rule's Stage D pass rate improved but its rescue dependency also rose.

---

## ☆ Proof-of-life milestone

After Phase E the harness has:

- A working dev endpoint that captures four route stages
- A scene library with at least one real canonical scene
- A mechanical scorer covering ~30 rules across all four tiers
- Per-stage failure detection with rescue dependency calculation
- Inventory output and version diffing

This is enough to **start running Call 2 v4.5 against itself** and produce real diagnostic findings. The first run will almost certainly surface known issues from memory (the v4.4→v4.5 negative duplication patch can be verified, T3 verb fidelity pressure can be measured, T4 echo failures can be quantified). It will also surface findings nobody anticipated.

**This is the right place to pause, run the harness for real, and see what the baseline looks like before building Phases F–I.** The architecture is correct only if the proof-of-life run produces actionable diagnostics. If it doesn't, something needs fixing before adding more layers.

---

## 10. Phase F — Judged scorer

### 10.1 Goal

Implement the LLM judge for the five sharp questions from architecture §6.1, with batching, calibration offsets, and blind differential mode.

### 10.2 Files to create

- `src/lib/call-2-harness/judged-scorer.ts` — judge call coordinator
- `src/lib/call-2-harness/judge-prompts/` — directory of versioned prompt templates, one per question
- `src/lib/call-2-harness/judge-calibration.ts` — offset storage and application
- `src/data/call-2-scenes/calibration-set.json` — 20 scenes for the quarterly calibration run

### 10.3 Dependencies

**Item 3 from §2:** Martin must decide which judge model. Options:

- **Claude (Sonnet 4.6 via API)** — different model family from Call 2's GPT, avoids judge-the-baker bias, but Martin's memory records Claude over-scores T3/T4 vs ChatGPT/Grok median (calibration offset must compensate)
- **ChatGPT (gpt-5.4 or gpt-5.4-mini via API)** — same model family as Call 2, faster, but cheaper-judge-bias risk
- **Both, with consensus on milestone runs only** — most defensible, doubles cost

The judge module is structured so this decision can be made (and changed) via a config flag, but the first implementation needs a default.

### 10.4 What good looks like

For a batch of 5 outputs, one judge call returns JSON with five 0–3 scores per output and a one-sentence justification per question. Calibration offsets are applied transparently. Blind differential mode randomises position and strips version labels.

---

## 11. Phase G — Failure clustering

### 11.1 Goal

Implement the eight-cluster taxonomy from architecture §10.1 with the deterministic rule-to-cluster mapping.

### 11.2 Files to create

- `src/data/call-2-scenes/rule-cluster-map.json` — the mapping table
- `src/lib/call-2-harness/failure-clustering.ts` — applies the mapping, produces cluster rollups
- The inventory writer (Phase D) is updated to include the `by_cluster` block

### 11.3 Dependencies

**Item 4 from §2:** I draft `rule-cluster-map.json` from inspection of the existing Call 2 system prompt and the architecture §10.1 cluster definitions. Martin reviews and approves before this phase ships. The JSON file is versioned (`cluster_schema_version: "v1"`) per architecture §10.4.

### 11.4 What good looks like

Inventory `by_cluster` block correctly rolls up rule failures into clusters. `constraint_collision` shows up when T4 brevity and T4 non-paraphrase rules fail together. The cluster view tells the architect what to look at; the rule view tells the fixer what to change.

---

## 12. Phase H — Metamorphic runner

### 12.1 Goal

Implement the six perturbation classes from architecture §9.1, the 2-of-3 equivalence oracle from §9.2, and the spot-audit lane from §9.4.

### 12.2 Files to create

- `src/lib/call-2-harness/metamorphic/perturbations.ts` — six pure functions, one per perturbation class
- `src/lib/call-2-harness/metamorphic/oracle.ts` — implements `structural AND (key_element OR judged)`
- `src/lib/call-2-harness/metamorphic/spot-audit.ts` — pairs collection and CLI prompt for milestone runs
- `harness-runs/spot-audits/` — gitignored, one file per milestone

### 12.3 Verification

Each perturbation function is a deterministic pure function with unit tests against fixed inputs. Oracle correctly fails when structural breaks (always); passes on key-element-only or judged-only success. Spot audit produces 10–15 paired samples per milestone for Martin to review blind.

### 12.4 What good looks like

`perturbation_seeds` declared on a scene cause the harness to run that scene through each named perturbation. Stability rate per perturbation class is reported in the inventory `metamorphic_stability` block. Spot audit results feed back into oracle calibration over time.

---

## 13. Phase I — Mutation testing

### 13.1 Goal

Implement the rule-deletion harness with the three-bucket classification from architecture §8.3.

### 13.2 Files to create

- `src/lib/call-2-harness/mutation/rule-deleter.ts` — programmatically removes a named rule from the system prompt string
- `src/lib/call-2-harness/mutation/runner.ts` — for each prioritised rule, runs the harness against the mutated prompt and classifies the result
- `src/lib/call-2-harness/mutation/classifier.ts` — the dead/rescued/product-critical/shared bucket logic with routing recommendations

### 13.3 Dependencies

None. The system prompt is parameterised in the dev endpoint (Phase A), so mutation testing just sends modified versions through the existing pipeline.

### 13.4 What good looks like

A mutation run against the eight to ten highest-priority rules produces a classification for each: dead, rescued, product-critical, or shared. The routing recommendation is `remove_candidate`, `cleanup_owned`, `prompt_owned`, or `shared_responsibility`. No prose advice.

---

## 14. Phase J — Production realism replay slice (DEFERRED)

### 14.1 Status

**Blocked on Sentinel.** Sentinel infrastructure is built but not deployed (per `to-do.md` items 7.1–7.3). Until Sentinel ships and production logging captures inputs at sufficient volume, there is no source of traffic-shaped real-world inputs.

### 14.2 What gets stubbed

The inventory schema reserves a `production_replay_slice` field (currently `null`). The architecture §17.8 risk is acknowledged in every harness report as a known unmitigated gap until Phase J ships.

### 14.3 Trigger

Start Phase J when Sentinel has been live for at least one month and the input log contains at least 500 distinct anonymised inputs.

---

## 15. Cross-phase notes

### 15.1 Existing features preserved

**Yes, throughout.** The harness is **purely additive**. The production Call 2 route at `src/app/api/generate-tier-prompts/route.ts` is never modified. The harmony-post-processing and harmony-compliance modules are imported, not rewritten. No existing tests are touched.

### 15.2 Verification commands (PowerShell from frontend folder)

After every phase:

```powershell
pnpm run test:util
pnpm run lint
pnpm run typecheck
pnpm run build
```

All four must pass. Build cache should be cleared on deploy: `Remove-Item -Recurse -Force .next` (per Martin's standing rule).

### 15.3 Cost discipline

Per architecture §15.2: a hard ceiling per run, expressed in tokens not dollars. The dev endpoint logs token usage in the metadata block. The harness runner enforces the ceiling and refuses runs that would exceed it without `--allow-expensive`. Mutation runs always require the flag.

### 15.4 What does not get built

Per architecture §21:

- No production deployment of the harness
- No CI integration
- No live dashboards
- No cross-call (Call 2 → Call 3) end-to-end testing
- No multi-developer concurrency
- No automatic fix-suggestion (the harness diagnoses, humans fix)

---

## 16. Quick-start for the new chat

When the new chat opens:

1. Read `call-2-quality-architecture-v0.3.1.md` end to end. Architecture is frozen.
2. Read this build plan end to end.
3. Extract `src.zip` and verify the file paths in §3 (architecture-to-code mapping) exist as expected.
4. Confirm Martin's pre-flight items from §2 are complete. If not, ask before touching code.
5. Start Phase A (dev endpoint and stage capture).
6. Pause after each phase. Run verification. Confirm with Martin before advancing.
7. Stop after Phase E (proof-of-life milestone) and run the harness for real before building Phases F–I.

**Default behaviour for the new chat:** be the same Claude that wrote v0.3.1. Same voice, same standards, same instinct to flag architectural concerns immediately. Read `code-standard.md` and `best-working-practice.md` from the project knowledge before writing any code. The harness must obey the same desktop-only, no-grey-text, clamp() sizing rules as the rest of Promagen even though most of it is non-UI code.

---

## 17. What Martin should expect

The first three phases (A, B, C) are mostly mechanical. Phase D and E start producing real diagnostic output. The proof-of-life milestone (after E) is the moment to actually look at what Call 2 v4.5 has been doing and decide what to fix first. Don't be surprised if the first run surfaces 5–10 things nobody knew about. Don't be surprised if at least one of them is a rule that mutation testing later proves is dead.

The honest expectation: the harness will tell you Call 2 is in worse shape than the to-do.md suggests, and in different ways than the to-do.md suggests. That's the point. Better to know.

End of build plan.
