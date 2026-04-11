# Call 2 Quality Architecture — v1.0.0

**Status:** Built and operational. Proof-of-life milestone complete. Producing diagnostic data.  
**Author:** Claude (via Martin)  
**Audience:** Ongoing reference. Use this as the single source of truth for the Call 2 harness and as the foundation for extending to Call 3.  
**Date:** 11 April 2026  
**Supersedes:** `call-2-quality-architecture-v0.3.1_1.md` (frozen architecture, 10 Apr 2026) + `call-2-harness-build-plan-v1.md` (build plan, 10 Apr 2026). Both documents are now retired and replaced by this single authority.

> **Cross-references:**
>
> - `api-3.md` v3.0.0 — Call 3 architecture (40 builders, preflight engine, regression guard)
> - `harmonizing-claude-openai.md` v4.0.0 — System prompt engineering playbook
> - `builder-quality-intelligence.md` v3.0.0 — Call 3 regression testing (BQI)
> - `trend-analysis.md` v5.0.0 — Scoring trends across Call 2 and Call 3
> - `call-2-system-prompt-v4.5.txt` — Frozen system prompt snapshot for harness baseline
> - `code-standard.md`, `best-working-practice.md` — Code standards (apply to harness code)

---

## 0. Document history

This document consolidates two predecessors into one:

1. **`call-2-quality-architecture-v0.3.1_1.md`** — The "what and why." Architecture designed across three ChatGPT review rounds (v0.1→v0.2→v0.3→v0.3.1). Scored 98/100 by ChatGPT round 3 with "freeze and start building" verdict.
2. **`call-2-harness-build-plan-v1.md`** — The "how and in what order." Ten-phase implementation plan (A→J), with Phases A–E as the proof-of-life spine.

Phases A–E are now built and running. Five smoke_alarm runs completed on 10–11 April 2026. Three non-healthy rules discovered and diagnosed. The architecture is no longer theoretical — it produces real diagnostics. The build plan's Phase A–E guidance is consumed. Phase F–J roadmap is folded into §21. Both predecessor documents are retired.

---

## 1. The problem in one paragraph

Call 2 in production is **a routed system, not a model call**. The route is `/api/generate-tier-prompts`. It calls `gpt-5.4-mini` (`temperature: 0.5`, `max_completion_tokens: 2000`) with a ~190-line system prompt asking for ~50 rules across four output formats in one inference. The output is then passed through `enforceT1Syntax`, `enforceMjParameters`, and `postProcessTiers` before being returned to the user. Six versions (v4.0 → v4.5) shipped with no automated regression. The harness makes visible which rules are followed, which are violated, which contradict each other, which have become dead text, at which route stage each rule is satisfied or rescued, and how dependent each rule's apparent quality is on the cleanup layer underneath it.

---

## 2. Design principles

1. **Route output is product truth.** What the user receives is model output plus post-processing plus compliance enforcement. The harness scores all four stages but the canonical "did this work" answer is taken from the final stage.
2. **A passing rule may still be fragile.** If Stage D passes only because cleanup rescued Stage A, the rule is product-live but model-dead. The harness surfaces this via rescue dependency.
3. **Measure failure modes, not scores.** A single quality number is useless. The output is a failure-mode inventory grouped by rule, by route stage, by root-cause cluster, and by rescue dependency.
4. **Hunt failures, don't certify success.** Adversarial inputs and metamorphic perturbations are first-class.
5. **Mechanical first, judged second.** Code-checkable rules get checked by code, instantly and free.
6. **Measure the distribution, not the sample.** Single-shot scoring is measuring noise.
7. **Every rule must be traceable.** Untraced rules are findings — either dead or untested.
8. **Production never pays the cost of testing.** Isolated dev endpoint, env-gated, auth-gated.
9. **The harness is differential.** Built to compare versions of Call 2 against each other.
10. **Speed is a feature.** Sub-12-minute full run or it won't be used.
11. **The harness must not optimise for itself.** Holdout scenes prevent the system from learning its own test library.
12. **Statistical claims must match the design.** Decision thresholds are operational guardrails, not formal confidence intervals.

---

## 3. Architecture overview

Eight layers. Layers 1–4 and 8 are built and operational. Layers 5–7 are planned.

```
┌─────────────────────────────────────────────────────────┐
│  1. SCENE LIBRARY                              ✅ BUILT │
│     40 active scenes + holdout (locked)                 │
│     5 categories, each scene rule-tagged                │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  2. ISOLATED RUNNER                            ✅ BUILT │
│     /api/dev/generate-tier-prompts                      │
│     Env-gated + auth-gated                              │
│     Returns ALL FOUR route stages                       │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  3. ROUTE-STAGE ATTRIBUTION                    ✅ BUILT │
│     Per sample, store and score 4 artefacts:            │
│        a) raw model JSON                                │
│        b) post-processed JSON                           │
│        c) compliance-enforced JSON                      │
│        d) final returned JSON  ← product truth          │
│     Plus: rescue dependency index per rule              │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  4. MECHANICAL SCORER                          ✅ BUILT │
│     27 rules, pass/fail per tier per stage per sample   │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  5. JUDGED SCORER                             🔲 PLANNED│
│     5 sharp questions, batched, blind in differential   │
│     Calibration offset applied by judge × tier          │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  6. METAMORPHIC RUNNER                        🔲 PLANNED│
│     Perturbation → equivalence oracle (2-of-3 gated)   │
│     Plus milestone spot-audit lane                      │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  7. MUTATION TESTING                          🔲 PLANNED│
│     Rule-deletion harness: dead / rescued /             │
│     product-critical / shared classification            │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  8. FAILURE-MODE INVENTORY                     ✅ BUILT │
│     Per-rule × per-tier × per-stage × per-cluster ×     │
│     rescue-dependency × significance                    │
│     Stored per Call 2 version, diffable across versions │
│     8 root-cause clusters (cluster-schema-v1)           │
└─────────────────────────────────────────────────────────┘
```

---

## 4. The scene library

**Status: ✅ BUILT.** 40 active scenes. Holdout scenes not yet populated.

### 4.1 Actual composition (v1.0.0)

| Source                     | Count  | Status                                  |
| -------------------------- | ------ | --------------------------------------- |
| Hand-curated canonical     | 1      | Lighthouse Keeper (confirmed canonical) |
| LLM-generated stress tests | 39     | Active, diverse scene coverage          |
| Holdout (locked)           | 0      | Not yet populated — Martin to provide   |
| **Total active**           | **40** | **All exercised in proof-of-life runs** |

### 4.2 Scene metadata schema

```json
{
  "id": "lighthouse-keeper-canonical",
  "category": "canonical",
  "input": "A weathered lighthouse keeper stands on the rain-soaked gallery deck...",
  "tags": ["weather", "human-subject", "atmosphere", "emotional"],
  "exercises_rules": [
    "T3.verb_fidelity",
    "T3.mood_conversion",
    "T1.scale_modifier_preservation"
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
```

### 4.3 Coverage gaps (observed)

16 of 27 mechanical rules have no scene in the library explicitly exercising them. This is editorial work for the scene library — the rules ARE being checked on every sample, but no scene is tagged as specifically targeting them. Observed consistently across all 5 runs:

`T1.weight_syntax_correct`, `T1.quality_suffix_present`, `T1.comma_separated_format`, `T1.no_trailing_punctuation`, `T2.ar_param_present`, `T2.v_param_present`, `T2.s_param_present`, `T2.no_param_present`, `T2.no_mid_phrase_weights`, `T3.char_count_in_range`, `T3.no_banned_tail_constructions`, `T3.first_8_words_no_echo`, `T4.min_10_words_per_sentence`, `T4.no_banned_openers`, `T4.no_meta_language`, `T4.first_8_words_no_echo`.

---

## 5. The mechanical scorer

**Status: ✅ BUILT.** 27 rules across 4 tiers, running on all 4 route stages per sample.

### 5.1 Rule inventory (confirmed by harness runs)

**T1 CLIP-Based (9 rules):**
`weight_syntax_correct`, `weight_steps_0_1`, `weight_wrap_4_words_max`, `quality_prefix_present`, `quality_suffix_present`, `comma_separated_format`, `no_trailing_punctuation`, `no_isolated_colour_weights`, `subject_highest_weight`

**T2 Midjourney (8 rules):**
`ar_param_present`, `v_param_present`, `s_param_present`, `no_param_present`, `no_exactly_once`, `weight_clauses_min_3`, `no_mid_phrase_weights`, `empty_negative_json_field`

**T3 Natural Language (5 rules):**
`char_count_in_range`, `sentence_count_2_to_3`, `no_banned_phrases`, `no_banned_tail_constructions`, `first_8_words_no_echo`

**T4 Plain Language (5 rules):**
`char_count_under_325`, `min_10_words_per_sentence`, `no_banned_openers`, `no_meta_language`, `first_8_words_no_echo`

Each rule is a pure function returning `{ ruleId, passed, details? }`. Runs in milliseconds. All 27 rules run on every sample across all 4 route stages, producing 108 pass/fail data points per sample.

---

## 6. The judged scorer

**Status: 🔲 PLANNED (Phase F).** Not yet built. Blocked on judge model decision from Martin.

### 6.1 The five sharp questions

1. **Subject preserved.** Did the user's primary subject survive into all four tiers, including modifiers?
2. **Value-add genuine.** Did the output contain at least one element the user did not provide that materially improves the visual?
3. **Tier coherence across T1–T4.** Do all four tiers describe the same scene?
4. **T3 native visual-director feel.** Does T3 read as if written by an experienced visual director?
5. **T4 not mere paraphrase.** Did T4 _convert_ an element, or just paraphrase?

Each question scored 0–3, JSON output, batched five samples per judge call.

### 6.2 Judge calibration

Claude over-scores T3 and T4 relative to the ChatGPT/Grok median. Mitigation: per-judge calibration offsets, cross-judge milestone runs, disagreement threshold surfacing. Judge model options: Claude Sonnet 4.6 (different model family — avoids judge-the-baker bias), ChatGPT gpt-5.4-mini (same family — cheaper-judge-bias risk), or both with consensus on milestone runs only.

### 6.3 Blind differential mode

When comparing v4.5 vs v4.6, the judge sees `output_a` and `output_b` with no version labels. Order randomised per question to avoid position bias.

---

## 7. Coverage tracing

**Status: ✅ BUILT** (basic form — coverage_gaps reported in every inventory).

Every rule has a stable ID. Every scene declares `exercises_rules`. The inventory reports rules with zero scene coverage as `coverage_gaps`. 16 gaps observed in current library — all are editorial work, not code bugs.

---

## 8. Mutation testing

**Status: 🔲 PLANNED (Phase I).** Not yet built. No dependencies blocking.

### 8.1 Procedure

Programmatically delete one rule from the system prompt (the `--system-prompt-file` override on the runner makes this straightforward), re-run the harness, observe whether anything fails. The dev endpoint accepts the system prompt in the request body, so mutation testing needs no redeploy.

### 8.2 Three-bucket result classification

| Bucket                    | Definition                                                          | Routing recommendation  |
| ------------------------- | ------------------------------------------------------------------- | ----------------------- |
| **Dead rule**             | Mutation causes no meaningful change at any stage                   | `remove_candidate`      |
| **Rescued rule**          | Stage A/B changes when rule removed, but Stage D largely unchanged  | `cleanup_owned`         |
| **Product-critical rule** | Stage D meaningfully degrades when rule removed                     | `prompt_owned`          |
| **Shared**                | Both Stage A and Stage D degrade, but cleanup partially compensates | `shared_responsibility` |

### 8.3 Prioritisation

Priority order: (1) rules with <5 scenes covering them, (2) rules introduced in last two versions, (3) rules whose deletion would break the JSON contract, (4) everything else.

---

## 9. Metamorphic testing

**Status: 🔲 PLANNED (Phase H).** Not yet built. No dependencies blocking.

### 9.1 Six perturbation classes

Punctuation jitter, spelling locale swap, synonym substitution, politeness wrapper, clause reorder, whitespace and casing.

### 9.2 The equivalence oracle

Gated 2-of-3 model: `PASS = structural_pass AND (key_element_pass OR judged_pass)`. Structural failure is a non-negotiable veto. The two soft checks compensate for each other.

### 9.3 Spot-audit lane

10–15 paired metamorphic samples per milestone run reviewed blind by Martin with one binary question: "Would I ship both without concern?" Catches the surrogate-vs-human-equivalence trap.

---

## 10. Failure clustering by root cause

**Status: ✅ BUILT.** Eight clusters in `cluster-schema-v1`, reported in every inventory.

### 10.1 The eight clusters

| Cluster                    | What it means                                              |
| -------------------------- | ---------------------------------------------------------- |
| `subject_salience_loss`    | Model lost track of the primary actor                      |
| `interaction_flattening`   | Acting-on relationships split into separate nouns          |
| `paraphrase_echo_collapse` | Output mirrors input rather than restructuring             |
| `syntax_leak`              | Wrong weight syntax for active provider                    |
| `negative_handling_leak`   | Negatives in wrong place or wrong format                   |
| `value_add_filler`         | Output added something but it was filler                   |
| `tier_drift`               | Different tiers describe different scenes                  |
| `constraint_collision`     | Model trying to satisfy mutually incompatible instructions |

Schema is versioned and extensible. Future versions can split or add clusters without breaking historic inventories.

### 10.2 Observed cluster rates (baseline, v4.5)

From 5 smoke_alarm runs (40 scenes × 5 samples each, 764–800 evaluations per run):

| Cluster                    | Fail rate range | Stage D fails | Verdict                                          |
| -------------------------- | --------------- | ------------- | ------------------------------------------------ |
| `tier_drift`               | 0.6%–4.5%       | 6–43          | **Biggest cluster.** Driven by T3/T4 char counts |
| `syntax_leak`              | 0.04%–2.05%     | 1–47          | Variable. T1.weight_wrap is the main driver      |
| `subject_salience_loss`    | 0%–2.0%         | 0–6           | Low and noisy                                    |
| `paraphrase_echo_collapse` | 0.26%–0.76%     | 3–9           | Consistently low                                 |
| `negative_handling_leak`   | 0%              | 0             | Clean                                            |
| `value_add_filler`         | 0%              | 0             | Clean                                            |
| `interaction_flattening`   | 0%              | 0             | Clean                                            |
| `constraint_collision`     | 0%              | 0             | Clean                                            |

---

## 11. Route-stage attribution and rescue dependency

**Status: ✅ BUILT.** All four stages captured and scored on every sample.

### 11.1 The four stages

```
user input
   │
   ▼
[ Stage A: gpt-5.4-mini raw output ]
   │
   ▼
[ Stage B: postProcessTiers() ]        ← harmony-post-processing.ts
   │
   ▼
[ Stage C: enforceT1Syntax(), enforceMjParameters() ]
   │
   ▼
[ Stage D: final returned JSON ]       ← PRODUCT TRUTH
```

The dev endpoint returns all four artefacts per request. The mechanical scorer runs on each. The failure-mode inventory shows fail rate per rule per stage.

### 11.2 The rescue dependency index

```
rescue_dependency = (samples where Stage A failed AND Stage D passed)
                  / (samples where Stage D passed)
```

A rescue dependency of `0.0` means Stage D passes were earned by the model. A rescue dependency of `0.85` means 85% of the apparent passes were rescued by cleanup.

### 11.3 The three patterns to watch for

1. **Stage A fails, Stage D passes** → cleanup is doing the work. High rescue dependency. Accept or fix the model.
2. **Stage A passes, Stage D fails** → cleanup is _introducing_ the failure. The cleanup layer has a bug. Rare but the harness surfaces it.
3. **All stages fail** → real failure. Fix the model and verify cleanup.

---

## 12. Holdout discipline

1. Scenes tagged `holdout: true`. Mix of canonical, stress, and human-factors.
2. Day-to-day runs SKIP holdout by default. `--include-holdout` flag required.
3. Every holdout invocation logged.
4. Holdout runs valid only as milestone evaluations.
5. A holdout scene whose failure pattern leaks into active library tuning is "burned" and must be replaced.

**Current state:** Holdout library not yet populated. Martin to provide.

---

## 13. The isolated runner

**Status: ✅ BUILT.** Dev endpoint operational. Runner script proven across 5 runs.

### 13.1 Dev endpoint

```
POST /api/dev/generate-tier-prompts

Headers:
  X-Dev-Auth: <secret from env, dev only>

Body:
{
  "systemPrompt": "<full Call 2 system prompt as string>",
  "userMessage": "<scene input>",
  "model": "gpt-5.4-mini",
  "temperature": 0.5,
  "reasoningEffort": "medium",
  "maxCompletionTokens": 2000,
  "providerContext": null
}

Response:
{
  "stage_a_raw_model": { ... },
  "stage_b_post_processed": { ... },
  "stage_c_compliance_enforced": { ... },
  "stage_d_final": { ... },
  "metadata": {
    "model_version": "gpt-5.4-mini-2026-03-17",
    "latency_ms": 4310,
    "tokens_used": { "prompt": 1842, "completion": 612 }
  }
}
```

**Security:** Environment-gated (`production` → 404), auth-gated (`X-Dev-Auth`), returns 404 not 401 (does not announce existence).

### 13.2 Runner script

**File:** `scripts/run-harness.ts`  
**Runs:** `pnpm exec tsx scripts/run-harness.ts --version v4.5 --run-class smoke_alarm`

**Flags:** `--version` (required), `--run-class`, `--previous` (inventory to diff against), `--out-dir`, `--max-calls` (default 250), `--system-prompt-file` (override — enables mutation testing), `--include-holdout`, `--endpoint`, `--concurrency` (default 1, serial), `--dry-run`.

**Safety gates:** Refuses production endpoint. Refuses if calls > `--max-calls`. Refuses without auth env var. Refuses if snapshot loader throws.

### 13.3 System prompt snapshot

**Default path:** `harness-snapshots/call-2-system-prompt-v4.5.txt`

The runner loads the system prompt from a frozen snapshot file (not from the live route code). This ensures the harness tests what was deployed, not what's currently in the codebase. The `--system-prompt-file` flag overrides for mutation testing and version experiments.

Drift warnings: if the snapshot hash doesn't match the production code, the runner warns but does not refuse. Suppressible via `HARNESS_SUPPRESS_SNAPSHOT_WARNINGS=1`.

---

## 14. The failure-mode inventory

**Status: ✅ BUILT.** Schema v1.0.0, producing real JSON output.

### 14.1 Inventory schema (actual production output)

```json
{
  "schema_version": "1.0.0",
  "version": "v4.5",
  "harness_version": "0.3.1",
  "cluster_schema_version": "v1",
  "model_version": "gpt-5.4-mini-2026-03-17",
  "run_timestamp": "2026-04-10T23:05:28.802Z",
  "scene_count": 40,
  "samples_per_scene": 5,
  "wall_clock_seconds": 698,
  "run_class": "smoke_alarm",

  "by_rule": {
    "T1.weight_wrap_4_words_max": {
      "stage_a_fail_rate": 0.15,
      "stage_b_fail_rate": 0.0,
      "stage_c_fail_rate": 0.0,
      "stage_d_fail_rate": 0.0,
      "rescue_dependency": 0.15,
      "health": "HEALTHY",
      "interpretation": "Model produces this rule correctly on its own.",
      "evaluation_count": 800
    }
  },

  "by_cluster": {
    "tier_drift": {
      "fail_rate": 0.035,
      "contributing_rules": [
        "T1.comma_separated_format",
        "T3.char_count_in_range",
        "..."
      ],
      "stage_d_fail_count": 35,
      "rule_count": 5
    }
  },

  "by_judge": null,
  "metamorphic_stability": null,
  "spot_audit": null,
  "coverage_gaps": [
    "T1.weight_syntax_correct: no scene in the library exercises this rule"
  ],
  "diff_vs_previous": null,
  "holdout_run": null
}
```

### 14.2 Health classifications

| Health         | Threshold                     | Meaning                                                           |
| -------------- | ----------------------------- | ----------------------------------------------------------------- |
| `HEALTHY`      | Stage D fail < 5%             | Model produces this rule correctly on its own                     |
| `BORDERLINE`   | Stage D fail 5%–10%           | Wobbling — run a decision-support pass before acting              |
| `FRAGILE`      | Stage D pass ok, rescue > 50% | Cleanup carrying the model — one cleanup change away from failure |
| `REAL_FAILURE` | Stage D fail ≥ 10%            | No layer fixes this — users see this bug today                    |

### 14.3 Diff format

The `diff_vs_previous` block is populated when `--previous` is passed to the runner. Uses `classifySignificance()` with run-class capping: a delta on a smoke_alarm run that would be meaningful on a decision_support run is capped to `below_noise`. This prevents acting on smoke-alarm runs as if they were decision-support runs.

### 14.4 Output location

`generated/call-2-harness/runs/<version>-<run_class>-<timestamp>.json` (gitignored).

---

## 15. Speed and cost

### 15.1 Actual run performance (observed)

| Metric             | Value        | Notes                                      |
| ------------------ | ------------ | ------------------------------------------ |
| Smoke_alarm calls  | 200          | 40 scenes × 5 samples                      |
| Wall clock         | 662–746s     | ~11–12 minutes, serial concurrency         |
| Schema errors      | 4.5% (9/200) | GPT flat-string instead of nested JSON     |
| Evaluations scored | 764–800      | 200 - schema errors, × 4 stages per sample |
| Estimated cost     | ~£1.00       | With prompt caching                        |

### 15.2 Run classes

| Run class              | Samples/scene | Cost estimate | Purpose                               |
| ---------------------- | ------------- | ------------- | ------------------------------------- |
| **Smoke alarm**        | 5             | ~£1           | Triage — catches large failures       |
| **Decision support**   | 30            | ~£6.50        | Fix-or-don't-fix calls on most rules  |
| **Dispute resolution** | 50            | ~£10.80       | Resolves close calls between versions |
| **Milestone**          | 30 + holdout  | ~£8           | Full evaluation with spot audit       |
| **Mutation**           | Varies        | Per-rule      | Requires `--allow-expensive` flag     |

---

## 16. Statistical discipline

### 16.1 Three run classes, three purposes

A 5-sample smoke-alarm run is a **smoke alarm**, not a measurement. It tells you something is on fire. It does not tell you how big the fire is or whether yesterday's was smaller. Use it for triage, not inference.

Mechanical regressions can be acted on at smoke-alarm scale if large and consistent. Judged regressions almost always need decision-support runs before action.

### 16.2 Paired analysis

Paired analysis is the preferred mode for version comparisons. Comparing on the same scene/sample family reduces noise substantially because most variance comes from scene-to-scene difficulty.

### 16.3 Significance classification with run-class capping

`classifySignificance(delta, runClass)` returns `smoke_alarm | decision_support | dispute_resolution | below_noise`. The classifier caps significance to what the run class can credibly claim — a 0.15 delta on a smoke_alarm run becomes `below_noise`, not `decision_support`. This was the key fix identified during the proof-of-life build.

### 16.4 Sweep priorities

Temperature sweep: 0.5 → 0.4 → 0.3 → 0.2 (0.2 may flatten T3/T4 value-add into compliance dullness). Reasoning effort: start with `medium`, test `low` for speed, test `high` only if a specific failure cluster looks reasoning-bound.

---

## 17. How the harness will lie to you

Eight named failure modes. Anyone running the harness must internalise these.

1. **It will overfit to the rule inventory.** Mitigation: judged scorer asks quality questions, not rule-compliance. Holdout set catches overfit.
2. **It will inherit judge taste.** Mitigation: judge calibration offsets, cross-judge milestone runs.
3. **It will confuse route quality with prompt quality.** Mitigation: route-stage attribution. Stage D is canonical.
4. **It will under-measure correlated failure.** Mitigation: failure clustering by root cause.
5. **It will drift into library gaming.** Mitigation: holdout discipline, metamorphic testing.
6. **It will confuse surrogate equivalence with user equivalence.** Mitigation: spot-audit lane on milestone runs.
7. **It will mistake deterministic rescue for architectural health.** Mitigation: rescue dependency index.
8. **It will confuse fixture realism with production realism.** Mitigation: traffic-weighted replay slice (deferred until Sentinel ships).

---

## 18. Implementation file map

### 18.1 Harness infrastructure (all in `src/lib/call-2-harness/`)

| File                            | Purpose                                                   | Status     |
| ------------------------------- | --------------------------------------------------------- | ---------- |
| `scene-library.ts`              | Scene loader, holdout gating, dev-only scene detection    | ✅ Built   |
| `mechanical-scorer/index.ts`    | Coordinator — runs all tier rules across all stages       | ✅ Built   |
| `mechanical-scorer/t1-rules.ts` | 9 T1 CLIP rules                                           | ✅ Built   |
| `mechanical-scorer/t2-rules.ts` | 8 T2 Midjourney rules                                     | ✅ Built   |
| `mechanical-scorer/t3-rules.ts` | 5 T3 Natural Language rules                               | ✅ Built   |
| `mechanical-scorer/t4-rules.ts` | 5 T4 Plain Language rules                                 | ✅ Built   |
| `rescue-dependency.ts`          | Rescue dependency calculation per rule                    | ✅ Built   |
| `inventory-writer.ts`           | Build inventory, write to disk, load from disk            | ✅ Built   |
| `diff.ts`                       | Version diffing, significance classification with capping | ✅ Built   |
| `run-classes.ts`                | Run class taxonomy and config                             | ✅ Built   |
| `system-prompt-loader.ts`       | Snapshot loader with drift warnings                       | ✅ Built   |
| `judged-scorer.ts`              | LLM judge with calibration                                | 🔲 Planned |
| `metamorphic/perturbations.ts`  | 6 perturbation functions                                  | 🔲 Planned |
| `metamorphic/oracle.ts`         | 2-of-3 equivalence oracle                                 | 🔲 Planned |
| `metamorphic/spot-audit.ts`     | Paired sample collector for milestone review              | 🔲 Planned |
| `mutation/rule-deleter.ts`      | Programmatic rule removal from system prompt              | 🔲 Planned |
| `mutation/runner.ts`            | Mutation test runner                                      | 🔲 Planned |
| `mutation/classifier.ts`        | Dead/rescued/product-critical/shared bucket logic         | 🔲 Planned |

### 18.2 Data files

| File                                              | Purpose                | Status   |
| ------------------------------------------------- | ---------------------- | -------- |
| `src/data/call-2-scenes/scenes.json`              | 40 active scenes       | ✅ Built |
| `src/data/call-2-scenes/holdout.json`             | Holdout scenes (empty) | ✅ Stub  |
| `src/data/call-2-scenes/rule-cluster-map.json`    | Rule → cluster mapping | ✅ Built |
| `harness-snapshots/call-2-system-prompt-v4.5.txt` | Frozen system prompt   | ✅ Built |

### 18.3 Routes and scripts

| File                                             | Purpose                 | Status   |
| ------------------------------------------------ | ----------------------- | -------- |
| `src/app/api/dev/generate-tier-prompts/route.ts` | Dev endpoint (4 stages) | ✅ Built |
| `scripts/run-harness.ts`                         | CLI runner (A→E wired)  | ✅ Built |

### 18.4 Test files

| File                                                   | Purpose                           |
| ------------------------------------------------------ | --------------------------------- |
| `__tests__/call-2-harness/dev-endpoint.test.ts`        | Dev endpoint auth + stage capture |
| `__tests__/call-2-harness/scene-library.test.ts`       | Scene loader + holdout gating     |
| `__tests__/call-2-harness/mechanical-scorer/*.test.ts` | Per-tier rule fixtures            |
| `src/lib/__tests__/call-2-harness-diff.test.ts`        | Diffing + significance capping    |

### 18.5 Existing files NOT modified

The production Call 2 route at `src/app/api/generate-tier-prompts/route.ts` is never touched. The harmony-post-processing and harmony-compliance modules are imported by the dev endpoint, not rewritten. No existing tests are touched. The harness is purely additive.

---

## 19. Baseline findings (v4.5, proof-of-life runs)

Five smoke_alarm runs completed 10–11 April 2026. Consistent results across runs.

### 19.1 Rule health summary

| Health       | Count | Rules                                                       |
| ------------ | ----- | ----------------------------------------------------------- |
| HEALTHY      | 24    | All T2 rules, most T1 rules, most T3/T4 rules               |
| BORDERLINE   | 0–1   | T4.char_count_under_325 (5%, varies by run)                 |
| FRAGILE      | 0     | **No hidden rescue-dependency bombs — genuinely good news** |
| REAL_FAILURE | 2     | T1.weight_wrap_4_words_max, T3.char_count_in_range          |

### 19.2 The three non-healthy rules

**1. T1.weight_wrap_4_words_max — REAL_FAILURE**

- Stage D fail: 0%–24% (varies significantly between runs due to post-processing rescue)
- Stage A fail: 15%–25% consistently
- Rescue dependency: 0.7%–17% (cleanup catches it sometimes)
- **Root cause:** GPT wraps phrases >4 words in weight syntax. Example: `(frost-encrusted orange survival suit:1.3)` instead of `(survival suit:1.3), frost-encrusted, orange`.
- **Fix class:** Deterministic post-processing (regex split of weight-wrapped phrases >4 words)

**2. T3.char_count_in_range — REAL_FAILURE**

- Stage D fail: 15%–17% consistently
- Rescue dependency: 0%–5%
- **Root cause:** T3 (280–420 chars) exceeds the upper limit. GPT doesn't count characters reliably.
- **Fix class:** Deterministic post-processing (truncate at last sentence boundary under 420)

**3. T4.char_count_under_325 — BORDERLINE (intermittent)**

- Stage D fail: 0%–5% (varies by run)
- Rescue dependency: 0%–7%
- **Root cause:** Same as T3 — GPT length estimation weakness.
- **Fix class:** Deterministic post-processing (truncate at last sentence boundary under 325)

### 19.3 Fix approach (decided)

All three share one root cause: GPT ignores length/structural constraints. The principle from code-standard.md applies: "Fixes expressible as deterministic code must be code, not prompt rules."

**Option B (deterministic post-processing) selected** — confirmed by both Claude and ChatGPT analysis. The prompt instructions stay as guidance (they help GPT get closer on average), but the code is the safety net. After building fixes, re-run the harness to confirm fail rates drop to near zero. The rescue dependency should rise (cleanup now catches more) and Stage D fail rate should approach zero.

### 19.4 Schema errors

4.5% of samples (9/200) returned `SCHEMA_ERROR` — GPT gave flat strings instead of `{positive, negative}` nested objects. Production's Zod validation gate catches these, so users never see them. Not a prompt fix — GPT JSON compliance noise. The harness correctly counts these as unscored rather than failures.

---

## 20. What this gives you that BQI doesn't

| BQI (Call 3)                 | This (Call 2)                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| Per-platform builder testing | Per-tier × per-route-stage testing with rescue dependency                                               |
| Patch-file isolation         | Parameterised dev endpoint (auth-gated, system prompt in body)                                          |
| Single-shot scoring          | Multi-sample with explicit run-class discipline                                                         |
| Score per platform × scene   | Failure-mode inventory by rule × stage × cluster × rescue × significance                                |
| Hand-curated test scenes     | Hand + LLM-generated + holdout (production-captured deferred)                                           |
| Mechanical + judged          | Mechanical (built) + judged + mutation + metamorphic + spot audit (planned)                             |
| Confirms what works          | Hunts what's broken, attributes to a route stage, clusters by root cause, measures structural fragility |

---

## 21. Remaining roadmap (Phases F–J)

| Phase | Goal                                                            | Blocked on          | Priority |
| ----- | --------------------------------------------------------------- | ------------------- | -------- |
| **F** | Judged scorer (5 sharp questions, batched, calibrated)          | Martin: judge model | Medium   |
| **G** | _(Absorbed)_ — failure clustering built during proof-of-life    | —                   | Done     |
| **H** | Metamorphic runner (6 perturbations, 2-of-3 oracle, spot audit) | Nothing             | Medium   |
| **I** | Mutation testing (3-bucket classification, prioritised)         | Nothing             | Medium   |
| **J** | Production-realism replay slice                                 | Sentinel ship       | Deferred |

**Phases G was built ahead of plan** — the `by_cluster` block is populated in every inventory with all 8 clusters and contributing rules.

**Phase F files to create:** `judged-scorer.ts`, `judge-prompts/` directory, `judge-calibration.ts`, `calibration-set.json`. The judge module should be structured so the model decision (Claude vs ChatGPT vs both) can be changed via config flag.

**Phase H files to create:** `metamorphic/perturbations.ts` (6 pure functions), `metamorphic/oracle.ts` (2-of-3 gate), `metamorphic/spot-audit.ts` (pairs collector).

**Phase I files to create:** `mutation/rule-deleter.ts`, `mutation/runner.ts`, `mutation/classifier.ts`.

**Phase J trigger:** Start when Sentinel has been live ≥1 month with ≥500 distinct anonymised inputs. Until then, §17.8 is a known unmitigated risk.

---

## 22. What is explicitly NOT in scope

No production deployment of the harness. No CI integration. No live dashboards. No cross-call (Call 2 → Call 3) end-to-end testing. No multi-developer concurrency. No automatic fix-suggestion. The harness diagnoses, humans fix.

---

## 23. Phase plan (Call 2 architecture evolution)

| Phase       | Architecture                                                  | Trigger to advance                                                                                    |
| ----------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Phase 1** | Single call, four tiers in one inference (current production) | Build harness, baseline, sweep temperature. **Status: baseline complete.**                            |
| **Phase 2** | 2-way split: T1+T2 (keyword), T3+T4 (prose)                   | Only if Phase 1 measurement shows persistent rule collisions between keyword and prose tiers          |
| **Phase 3** | 4-way split or hybrid                                         | Only if Phase 2 measurably wins on failure rate per unit cost AND operational complexity is justified |

Each phase advance requires evidence in the harness output. No hunches.

---

## 24. Success criteria

Six months from now, the harness has:

1. Caught at least 5 regressions before they shipped.
2. Surfaced at least 2 dead rules in the Call 2 system prompt.
3. Identified at least 1 contradiction between rules.
4. Identified at least 1 case where post-processing was rescuing a model failure (route-stage attribution win). **✅ ACHIEVED — T1.weight_wrap rescue dependency observed in run 1.**
5. Identified at least 1 case where a rule had high rescue dependency and was structurally fragile (rescue index win). **✅ ACHIEVED — T1.weight_wrap 17% rescue dependency.**
6. Identified at least 1 case where a perturbation broke output stability (metamorphic win — requires Phase H).
7. Identified at least 1 case where the production-traffic replay slice failed differently to the stress library (production realism win — requires Phase J).
8. Made at least 1 architectural change with measurable judged improvement.
9. Become the artefact a competitor would need to replicate to match Promagen quality.

If after six months it has done none of these, it was a waste and should be killed.

**Progress:** 2 of 9 criteria already met from the first proof-of-life run.

---

## 25. Foundation for Call 3 harness

The Call 2 harness methodology is directly extensible to Call 3. The architecture, the mechanical scorer framework, and the inventory/diff pipeline are reusable. The differences are in surface area, not in architecture.

### 25.1 What transfers directly

The scene library, inventory schema, diff engine, run-class discipline, and significance classification all work unchanged. The runner's `--system-prompt-file` override already supports testing arbitrary system prompts.

### 25.2 What changes for Call 3

| Dimension             | Call 2 harness               | Call 3 harness                                                     |
| --------------------- | ---------------------------- | ------------------------------------------------------------------ |
| System prompts tested | 1 universal                  | Up to 40 (10 groups minimum)                                       |
| Mechanical rules      | 27 universal                 | Per-platform rule sets                                             |
| API calls per run     | scenes × samples             | scenes × samples × platforms                                       |
| What you're diffing   | v4.5 vs v4.6 of one prompt   | v1 vs v2 of one platform's builder                                 |
| Route stages          | A → B → C → D                | Preflight → GPT (or deterministic) → compliance → regression guard |
| Rescue analogy        | Post-processing rescuing GPT | Regression guard rescuing GPT                                      |

### 25.3 When to build it

The harmony pass methodology (ChatGPT verifies system prompt → lighthouse keeper test → score → build into builder file) IS the Call 3 quality process right now. The Call 3 harness becomes worth building when regression-testing across builder updates becomes the bottleneck — "I changed the Midjourney builder, did it break anything?" That's a later problem. The BQI system already provides batch regression testing at the platform level. The Call 3 harness would add route-stage attribution and rescue dependency that BQI lacks.

---

## 26. Verification commands

After any harness code change (PowerShell from frontend folder):

```powershell
pnpm run test:util
pnpm run lint
pnpm run typecheck
pnpm run build
```

All four must pass. Build cache cleared on deploy: `Remove-Item -Recurse -Force .next`.

To run the harness:

```powershell
# Terminal 1: start dev server
pnpm dev

# Terminal 2: run harness
$env:CALL2_HARNESS_DEV_AUTH = "<secret from .env.local>"
pnpm exec tsx scripts/run-harness.ts --version v4.5 --run-class smoke_alarm

# With diff against previous run:
pnpm exec tsx scripts/run-harness.ts --version v4.5 --run-class smoke_alarm --previous "generated\call-2-harness\runs\v4.5-smoke_alarm-2026-04-10T23-05-28-802Z.json"
```

---

## Changelog

| Date        | Version  | Changes                                                                                                                                                                                                                                                                                                                                              |
| ----------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10 Apr 2026 | v0.3.1   | Architecture frozen. ChatGPT 98/100. Build plan written.                                                                                                                                                                                                                                                                                             |
| 10 Apr 2026 | v0.3.1.1 | Build plan companion document created.                                                                                                                                                                                                                                                                                                               |
| 10–11 Apr   | —        | Phases A–E built. 5 proof-of-life runs completed. 3 findings diagnosed.                                                                                                                                                                                                                                                                              |
| 11 Apr 2026 | v1.0.0   | **This version.** Consolidated architecture + build plan into single authority doc. Updated status to "built and operational." Added baseline findings (§19), implementation file map (§18), remaining roadmap (§21), Call 3 foundation (§25). Removed review cycle history (§0, §0a), answered open questions (§20), retired predecessor documents. |

End of v1.0.0.
