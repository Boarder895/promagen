# Call 2 Quality Architecture — v0.3.1

**Status:** Frozen architecture. Build-ready.
**Author:** Claude (via Martin)
**Audience:** Implementation. Use this as the source of truth for the build phase.
**Date:** 10 April 2026
**Supersedes:** v0.3 (10 April 2026, scored 98/100, single round-3 amendment patched)

---

## 0. What changed since v0.3

ChatGPT round 3 scored v0.3 at 98/100 and called architecture freeze. v0.3.1 is a surgical patch that adds **one new failure mode** (§17.8 — fixture realism vs production realism) and updates the success criteria. No other content changes. The architecture is otherwise frozen at v0.3.

**Round-3 single addition:**

- **§17.8 — Fixture realism vs production realism** (NEW). The library may be editorially representative without being traffic-shape representative. The harness can become very good at rare-but-interesting failures and silently miss common-but-boring ones. Mitigation: traffic-weighted replay slice on milestone runs. This is the eighth named "lie to you" failure mode and the last gap in the failure-mode taxonomy.
- **§22** — Success criterion 6 added (production-realism win).

The next document after this is the build plan, not v0.4.

---

## 0a. What changed since v0.2

ChatGPT round 2 scored v0.2 at 96/100 and signposted 98+ as achievable with four refinements. v0.3 integrates all four plus the cuts ChatGPT recommended. Specific changes:

**Round-2 amendments adopted:**

- **§11, §14** — **Rescue dependency index** added as a first-class metric. The harness now reports, per rule, the proportion of Stage D passes that required rescue after Stage A failure. A rule with 98% final pass rate but 85% rescue dependency is structurally fragile in a way the v0.2 inventory could not see. This is the most important addition in v0.3.
- **§9.2** — **Metamorphic equivalence oracle** changed from "all three required" to **structural AND (key-element OR judged)**. Structural failure remains a non-negotiable veto; the soft checks become a 2-of-3 gate. Prevents a fussy judge or slight noun drift from vetoing a genuinely stable pair.
- **§10** — **Constraint collision added as cluster 8.** Six versions of Call 2 patches with no measurement is direct evidence the cluster is already firing in production. The cluster taxonomy is now explicitly versioned and extensible — schema is open to extension, not frozen at eight.
- **§8** — **Mutation testing 3-bucket classification** (dead / rescued / product-critical), plus a narrow routing-recommendation field (`remove_candidate` / `cleanup_owned` / `prompt_owned` / `shared_responsibility`). Routing advice, not prose advice.

**Round-2 cuts adopted:**

- **§15** — Exact dollar cost estimates removed. Hard ceiling kept, relative run classes kept.
- **§16** — Noise-floor numerical table removed. Statistical section rewritten as **operational decision thresholds**, not faux-formal confidence claims. ChatGPT caught me bluffing with statistics I could not back up.
- **§8** — "Roughly 10× cheaper" mutation claim removed. Prioritisation logic kept.

**Round-2 additions adopted:**

- **§9.4** — **Spot-audit lane** for metamorphic milestone runs. 10–15 paired samples reviewed blind by Martin with one binary question. Bounded cost, catches the surrogate-vs-human-equivalence trap, generates oracle-tuning evidence over time.

**Schema versioning:**

- **§10.4** — Cluster taxonomy is now explicitly versioned. Current is `cluster-schema-v1` (eight clusters). Future schema versions can split or extend without breaking historic inventories.

---

## 1. The problem in one paragraph

Call 2 in production is **a routed system, not a model call**. The route is `/api/generate-tier-prompts`. It calls `gpt-5.4-mini` (`temperature: 0.5`, `max_completion_tokens: 2000`) with a ~190-line system prompt asking for ~50 rules across four output formats in one inference. The output is then passed through `enforceT1Syntax`, `enforceMjParameters`, and `postProcessTiers` before being returned to the user. Six versions (v4.0 → v4.5) have shipped with no automated regression. There is no way to know which rules are followed, which are violated, which contradict each other, which have become dead text, **at which route stage each rule is being satisfied or rescued, and how dependent each rule's apparent quality is on the cleanup layer underneath it.** The harness this document proposes makes all of that visible.

---

## 2. Design principles

1. **Route output is product truth.** What the user receives is model output plus post-processing plus compliance enforcement. The harness scores all four stages but the canonical "did this work" answer is taken from the final stage.
2. **A passing rule may still be fragile.** If Stage D passes only because cleanup rescued Stage A, the rule is product-live but model-dead. The harness must surface this difference. (NEW v0.3: ChatGPT round 2.)
3. **Measure failure modes, not scores.** A single quality number is useless. The output is a failure-mode inventory grouped by **rule**, by **route stage**, by **root-cause cluster**, and by **rescue dependency**.
4. **Hunt failures, don't certify success.** Adversarial inputs and metamorphic perturbations are first-class.
5. **Mechanical first, judged second.** Code-checkable rules get checked by code, instantly and free.
6. **Measure the distribution, not the sample.** Single-shot scoring is measuring noise.
7. **Every rule must be traceable.** Untraced rules are findings — either dead or untested.
8. **Production never pays the cost of testing.** Isolated dev endpoint, env-gated, auth-gated.
9. **The harness is differential.** Built to compare versions of Call 2 against each other.
10. **Speed is a feature.** Sub-3-minute full run or it won't be used.
11. **The harness must not optimise for itself.** Holdout scenes prevent the system from learning its own test library.
12. **Statistical claims must match the design.** Decision thresholds are operational guardrails, not formal confidence intervals. Honesty about what the numbers can and cannot support. (NEW v0.3: ChatGPT round 2.)

---

## 3. Architecture overview

Eight layers. Route-stage attribution (§11) now explicitly produces both per-stage scores AND a rescue dependency index per rule.

```
┌─────────────────────────────────────────────────────────┐
│  1. SCENE LIBRARY                                       │
│     ~60 active scenes + 15 holdout (locked)             │
│     5 categories, each scene rule-tagged                │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  2. ISOLATED RUNNER                                     │
│     /api/dev/generate-tier-prompts                      │
│     Env-gated + auth-gated                              │
│     Returns ALL FOUR route stages                       │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  3. ROUTE-STAGE ATTRIBUTION                             │
│     Per sample, store and score 4 artefacts:            │
│        a) raw model JSON                                │
│        b) post-processed JSON                           │
│        c) compliance-enforced JSON                      │
│        d) final returned JSON  ← product truth          │
│     Plus: rescue dependency index per rule (NEW v0.3)   │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  4. MECHANICAL SCORER                                   │
│     Pass/fail per rule per tier per stage per sample    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  5. JUDGED SCORER                                       │
│     5 sharp questions, batched, blind in differential   │
│     Calibration offset applied by judge × tier          │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  6. METAMORPHIC RUNNER                                  │
│     Perturbation → equivalence oracle (2-of-3 gated)    │
│     Plus milestone spot-audit lane (NEW v0.3)           │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  7. FAILURE CLUSTERING (cluster-schema-v1)              │
│     8 named root-cause clusters (constraint_collision   │
│     added in v0.3); schema versioned and extensible     │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  8. FAILURE-MODE INVENTORY                              │
│     Per-rule × per-tier × per-stage × per-cluster ×     │
│     rescue-dependency × significance                    │
│     Stored per Call 2 version, diffable across versions │
└─────────────────────────────────────────────────────────┘
```

---

## 4. The scene library

### 4.1 Composition

| Source                     | Count  | Built by                                     | Purpose                                               |
| -------------------------- | ------ | -------------------------------------------- | ----------------------------------------------------- |
| Hand-curated canonical     | 15     | Martin                                       | Reference scenes. Trusted, stable, tracked over time. |
| LLM-generated stress tests | 30     | LLM generates 3× target, Martin curates down | Coverage of specific failure modes                    |
| Real-world capture         | 15     | Production logs / Sentinel                   | Inputs that actually broke production                 |
| **Holdout (locked)**       | **15** | **Mix of all three sources**                 | **Milestone evaluation only. See §12.**               |

### 4.2 Stress categories

Unchanged from v0.2: stress geometry, trap inputs, provider context matrix, human factors, alien encounters. The human factors layer is the differentiating moat.

### 4.3 Scene metadata schema

```json
{
  "id": "lighthouse-keeper-canonical",
  "category": "canonical",
  "input": "An elderly lighthouse keeper stands on the rain-soaked gallery deck...",
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
```

### 4.4 Auto-generation strategy

LLM generates 3× target against a structured spec, Martin curates down. Rejected candidates go to `archive/`. **No auto-promotion to the active library.**

---

## 5. The mechanical scorer

Every code-checkable rule per tier gets a regex/counter check, pass/fail with details. Runs **four times per sample**, once against each route stage, so the failure-mode inventory can show "rule X failed at the model stage, rescued at the post-processing stage." This is the substrate for the rescue dependency index in §11.

---

## 6. The judged scorer

### 6.1 The five sharp questions

1. **Subject preserved.** Did the user's primary subject survive into all four tiers, including modifiers?
2. **Value-add genuine.** Did the output contain at least one element the user did not provide that materially improves the visual?
3. **Tier coherence across T1–T4.** Do all four tiers describe the same scene?
4. **T3 native visual-director feel.** Does T3 read as if written by an experienced visual director?
5. **T4 not mere paraphrase.** Did T4 _convert_ an element, or just paraphrase?

Each question scored 0–3, JSON output, batched five samples per judge call.

### 6.2 Judge calibration

Memory records that **Claude over-scores T3 and T4 relative to the ChatGPT/Grok median.** Mitigation:

1. Every judge has a `judge_id` recorded with each score.
2. A quarterly calibration scene set (20 scenes) is scored by all available judges.
3. Mean delta per judge per tier is stored as a calibration offset.
4. Inventory shows raw judge scores AND offset-corrected scores.
5. Disagreement above threshold (>1.0 on the 0–3 scale) is surfaced as a finding.

### 6.3 Blind differential mode

When comparing v4.5 vs v4.6, the judge sees `output_a` and `output_b` with no version labels. Order randomised per question to avoid position bias.

---

## 7. Coverage tracing

Every rule has a stable ID. Every scene declares `exercises_rules`. Tracer outputs a rule × scene-count matrix and flags any rule with `count == 0`. `tag_provenance` is recorded so the tracer can weight manual vs mechanically-inferred tags. Untraced rules block milestone releases.

---

## 8. Mutation testing

### 8.1 Procedure

Programmatically delete one rule from the system prompt, re-run the harness, observe whether anything fails. Cadence: milestone-only initially, quarterly once architecture stabilises.

### 8.2 Prioritisation (kept from v0.2)

Priority order, highest first:

1. Rules with <5 scenes covering them (high probability of being uncovered)
2. Rules introduced in the last two versions (high probability of being dead-after-fix)
3. Rules whose deletion would break the JSON contract (sanity check)
4. Everything else

This reduces mutation runtime versus mutating every rule. The cost saving is real but not pre-quantified — actual measurement will come from the first profiled run.

### 8.3 Three-bucket result classification (NEW v0.3)

Route-stage attribution makes mutation results more nuanced than "dead or alive." Every mutation is now classified into one of three buckets, with a routing recommendation:

| Bucket                    | Definition                                                                      | Routing recommendation                                                                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dead rule**             | Mutation causes no meaningful change at any stage                               | `remove_candidate` — the rule does nothing and can be removed from the system prompt                                                                                                |
| **Rescued rule**          | Stage A or B changes when the rule is removed, but Stage D is largely unchanged | `cleanup_owned` — the rule is rescued by post-processing or compliance. Either remove from prompt and document the cleanup ownership, or accept that the model has never learned it |
| **Product-critical rule** | Stage D meaningfully degrades when the rule is removed                          | `prompt_owned` — the rule is doing real work in the prompt and must stay                                                                                                            |
| **Shared**                | Both Stage A and Stage D degrade, but cleanup partially compensates             | `shared_responsibility` — the rule is real but cleanup also helps. Document the joint ownership                                                                                     |

The recommendation is **routing advice only** — it tells you which layer owns the rule. It does not prescribe the fix. Humans decide.

This classification is the diagnostic that turns mutation testing from "did the suite catch it?" into "where in the architecture is this rule actually living?"

---

## 9. Metamorphic testing

### 9.1 The technique

Same as v0.2: six perturbation classes (punctuation jitter, spelling locale swap, synonym substitution, politeness wrapper, clause reorder, whitespace and casing). For each scene with a perturbation seed, generate N perturbed inputs, run them through Call 2, compare to baseline.

### 9.2 The equivalence oracle (CHANGED v0.3)

Round 2 was right that "all three required" was too brittle. v0.3 uses a **gated 2-of-3 model**:

```
PASS = structural_pass AND (key_element_pass OR judged_pass)
FAIL = anything else
```

The three checks:

1. **Structural** — same JSON shape, same tier count, all `positive` and `negative` fields non-empty in the same places. **Non-negotiable veto.** Structural failure is always a real stability break.
2. **Key element preservation** — the same set of key visual nouns (subject, primary action, primary environment) is present in each tier of both outputs. Detected mechanically by named-entity comparison.
3. **Judged equivalence** — LLM judge shown both outputs blind: "Do these describe the same scene with comparable quality?"

**Why the change:** the three checks have different reliability profiles. Structural is hard and reliable. Key-element is middling. Judged is soft and noisy. Requiring all three meant the weakest component could veto a genuinely stable pair. The 2-of-3 gate (with structural always required) keeps the reliable check as a hard veto while letting the two soft checks compensate for each other.

The metamorphic stability rate per scene per perturbation class is the headline metric. Reported separately for each perturbation class because they fail differently.

### 9.3 Why this matters

Real users perturb input constantly without changing intent. If Call 2 is stable to "elderly samurai" but flat to "old samurai," users blame the product, not their synonym. Metamorphic stability is the measurable form of "feels reliable."

### 9.4 Spot-audit lane (NEW v0.3)

Round 2 flagged a real risk: the metamorphic oracle may declare two outputs equivalent because the nouns survive and the judge says "same scene," while a human would still feel one is clearly worse — flatter framing, lower emotional temperature, less distinctive. This is the surrogate-vs-human-equivalence trap.

Mitigation: a small **human spot-audit lane on milestone runs only.**

- 10–15 paired metamorphic samples per milestone run
- Reviewed blind by Martin (no version labels, no oracle verdict shown)
- Single binary question: **"Would I ship both without concern?"**
- Audit takes ~30 minutes per milestone — bounded cost
- Each audit pair becomes oracle-tuning evidence over time
- When the oracle says "equivalent" and Martin says "no," the pair is added to a calibration set used to refine the judge rubric

The spot audit is **not** a routine scoring layer. It exists specifically to catch the cases where the mechanical oracle is being polite about real degradation. Over time the audit produces a calibration corpus that makes the oracle better.

---

## 10. Failure clustering by root cause

### 10.1 The eight clusters (`cluster-schema-v1`)

| Cluster                               | What it means                                              | Example rule failures                                                                                                                    |
| ------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **subject_salience_loss**             | Model lost track of the primary actor                      | T1 subject highest weight; T3 first sentence drops subject; T4 subject not explicit                                                      |
| **interaction_flattening**            | Acting-on relationships split into separate nouns          | T1 interaction merging; T3 verb fidelity on action verbs                                                                                 |
| **paraphrase_echo_collapse**          | Output mirrors input rather than restructuring             | T3/T4 first 8 words echo; T3 banned tail constructions                                                                                   |
| **syntax_leak**                       | Wrong weight syntax for active provider                    | T1 parenthetical-vs-double-colon mismatch; T1 fractional weight steps                                                                    |
| **negative_handling_leak**            | Negatives in wrong place or wrong format                   | T2 --no missing or duplicated; T3 negatives stated as failures                                                                           |
| **value_add_filler**                  | Output added something but it was filler                   | Judge q2 fail; T4 conversion vs paraphrase fail                                                                                          |
| **tier_drift**                        | Different tiers describe different scenes                  | Judge q3 fail; cross-tier subject mismatch                                                                                               |
| **constraint_collision** _(NEW v0.3)_ | Model trying to satisfy mutually incompatible instructions | Brevity vs value-add; verb fidelity vs natural prose; provider syntax vs expressive richness; T4 simplicity vs non-paraphrase conversion |

### 10.2 Why constraint_collision is its own cluster

Round 2 was right that without this cluster, constraint-collision failures would scatter across `value_add_filler`, `paraphrase_echo_collapse`, and `tier_drift`. The deeper cause — the system prompt asks GPT to do two things that fight each other — would never get diagnosed. Six versions of Call 2 patches with no measurement is direct evidence the cluster is already firing in production.

When `constraint_collision` shows a high fail rate, the fix is **never** "add another rule." The fix is restructuring or removing one of the colliding rules. The cluster's diagnostic value is that it points at architecture, not patches.

### 10.3 The mapping function

Same as v0.2: deterministic rule-to-cluster table. Each rule ID has a primary cluster. When a sample fails multiple rules, every cluster gets credited but the failure is **primarily attributed** to the cluster with the highest count of failures in that sample. Stored as `rule-cluster-map.json`, versioned with the schema.

### 10.4 Schema versioning (NEW v0.3)

The cluster taxonomy is **explicitly versioned and extensible.** Current is `cluster-schema-v1` with eight clusters. Future versions can:

- **Split** an existing cluster (e.g. `interaction_flattening` → `relation_loss` + `action_softening` is a likely v2 split)
- **Add** new clusters when patterns emerge that don't fit existing ones
- **Never silently retire** a cluster — retired clusters get marked deprecated, not deleted, so historic inventories remain interpretable

Every failure-mode inventory records `cluster_schema_version` so cross-version comparisons can detect when the taxonomy changed. Schema changes are milestone events.

### 10.5 Output

Inventory reports failures **two ways**:

1. By rule ID (for fixers — "go fix rule X")
2. By cluster (for architects — "the model is colliding constraints, this is upstream of 6 rule failures")

---

## 11. Route-stage attribution and rescue dependency

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

The dev endpoint returns all four artefacts per request. Mechanical and judged scorers run on each. The failure-mode inventory shows fail rate per rule per stage.

### 11.2 The rescue dependency index (NEW v0.3)

Round 2 named the trap: stage-aware reporting can lull you into thinking a rule is healthy when it's actually only product-live because cleanup is doing all the work. A rule with 98% Stage D pass rate but 85% Stage A fail rate is not the same as a rule with 98% Stage D pass rate and 5% Stage A fail rate. The first is one cleanup change away from a large latent failure pool. The second is genuinely healthy.

The **rescue dependency index** per rule is defined as:

```
rescue_dependency = (samples where Stage A failed AND Stage D passed)
                  / (samples where Stage D passed)
```

A rescue dependency of `0.0` means Stage D passes were earned by the model. A rescue dependency of `0.85` means 85% of the apparent passes were rescued by cleanup — the model is brittle on this rule and the cleanup layer is carrying load.

This metric goes alongside Stage D pass rate in the inventory. The two together are the diagnostic; either alone is misleading.

### 11.3 The three patterns to watch for

1. **Stage A fails, Stage D passes** → cleanup is doing the work. **Rescue dependency high.** Either accept it or fix the model. Either choice is informed.
2. **Stage A passes, Stage D fails** → cleanup is _introducing_ the failure. The cleanup layer has a bug. Rare but the harness will surface it.
3. **All stages fail** → real failure. Fix the model and verify cleanup.

### 11.4 Healthy vs fragile rules

Two example rules with identical Stage D pass rates but very different health:

```json
"T2.no_appears_once": {
  "stage_d_pass_rate": 0.98,
  "rescue_dependency": 0.85,
  "health": "FRAGILE — cleanup carrying 85% of passes"
}

"T1.weight_steps_valid": {
  "stage_d_pass_rate": 0.98,
  "rescue_dependency": 0.05,
  "health": "HEALTHY — model owns the rule"
}
```

The fragile rule is a P1 finding. The healthy rule is fine. Stage D pass rate alone could not tell them apart.

---

## 12. Holdout discipline

Unchanged from v0.2:

1. 15 scenes tagged `holdout: true`. Mix of canonical, stress, and human-factors.
2. Day-to-day runs SKIP holdout by default. `--include-holdout` flag required.
3. Every holdout invocation logged in `holdout_audit.log` with timestamp and reason.
4. Holdout runs are valid only as milestone evaluations.
5. A holdout scene whose failure pattern leaks into active library tuning is "burned" and must be replaced.
6. Replacement requires written justification in the audit log.

---

## 13. The isolated runner

```
POST /api/dev/generate-tier-prompts

Headers:
  X-Dev-Auth: <secret from env, dev only>

Body:
{
  "systemPrompt": "...full Call 2 system prompt...",
  "userMessage": "...the scene input...",
  "model": "gpt-5.4-mini",
  "temperature": 0.5,
  "reasoningEffort": "medium",
  "maxCompletionTokens": 2000,
  "returnAllStages": true
}

Response:
{
  "stage_a_raw_model": { ... },
  "stage_b_post_processed": { ... },
  "stage_c_compliance_enforced": { ... },
  "stage_d_final": { ... },
  "metadata": {
    "model_version": "gpt-5.4-mini-2026-02-15",
    "latency_ms": 4310,
    "tokens_used": { "prompt": 1842, "completion": 612 }
  }
}
```

**Security:**

- Environment-gated: `if (env.NODE_ENV === "production") return 404`
- Auth-gated: `X-Dev-Auth` header must match env secret
- 404 not 401 — does not announce its existence
- Rate-limited per dev secret

**Reproducibility:** runs are **distribution-reproducible**, not sample-reproducible. Same scene + same settings + N samples gives a statistically similar failure-rate distribution, not identical strings. Model version pinned in metadata. Model version change is treated as a milestone event.

---

## 14. The failure-mode inventory

Schema (UPDATED v0.3 — adds rescue dependency, constraint_collision, schema versioning):

```json
{
  "version": "v4.5",
  "harness_version": "0.3",
  "cluster_schema_version": "v1",
  "model_version": "gpt-5.4-mini-2026-02-15",
  "run_timestamp": "2026-04-10T14:32:11Z",
  "scene_count": 60,
  "samples_per_scene": 5,
  "wall_clock_seconds": 167,
  "run_class": "smoke_alarm",

  "by_rule": {
    "T2.no_appears_once": {
      "stage_a_fail_rate": 0.45,
      "stage_d_fail_rate": 0.02,
      "rescue_dependency": 0.85,
      "health": "FRAGILE",
      "interpretation": "Cleanup layer rescues 85% of model failures. One cleanup change away from a latent failure pool."
    },
    "T3.verb_fidelity": {
      "stage_a_fail_rate": 0.2,
      "stage_d_fail_rate": 0.2,
      "rescue_dependency": 0.0,
      "health": "REAL_FAILURE",
      "common_pattern": "verbs 'explode', 'lash', 'flicker' substituted",
      "interpretation": "No layer fixes this — fix at the model level"
    }
  },

  "by_cluster": {
    "subject_salience_loss": {
      "fail_rate": 0.18,
      "contributing_rules": ["..."],
      "scene_pattern": "fails most on dense inputs with multiple actors"
    },
    "constraint_collision": {
      "fail_rate": 0.12,
      "contributing_rules": ["T4.value_add_genuine", "T4.brevity_ceiling"],
      "scene_pattern": "T4 cannot satisfy brevity AND non-paraphrase conversion simultaneously",
      "fix_class": "architectural — restructure colliding rules, do not add another"
    }
  },

  "by_judge": {
    "q1_subject_preserved": { "raw_mean": 2.7, "calibrated_mean": 2.5 },
    "q2_value_add_genuine": { "raw_mean": 1.9, "calibrated_mean": 1.7 }
  },

  "metamorphic_stability": {
    "synonym_substitution": 0.85,
    "polite_prefix": 0.96,
    "punctuation_jitter": 0.99,
    "clause_reorder": 0.72,
    "spelling_locale": 0.94,
    "whitespace_casing": 0.99
  },

  "spot_audit": null,

  "coverage_gaps": ["T3.gender_neutrality: 0 scenes"],

  "diff_vs_previous": {
    "previous_version": "v4.4",
    "rules_improved": [
      {
        "rule": "T2.no_appears_once",
        "stage_d_delta": -0.38,
        "rescue_dependency_delta": +0.15,
        "decision_class": "decision_support",
        "note": "Stage D pass rate improved but rescue dependency rose — cleanup is now doing more work"
      }
    ],
    "rules_regressed": [],
    "clusters_improved": ["negative_handling_leak"],
    "clusters_regressed": []
  },

  "holdout_run": null
}
```

`spot_audit` is `null` for non-milestone runs and populated when human review takes place. `holdout_run` is `null` unless invoked with `--include-holdout`.

The **rescue dependency delta** in the diff section is the new diagnostic. A rule whose Stage D rate improved but whose rescue dependency _also_ rose is not actually getting better — the cleanup layer is just doing more work. This is exactly the kind of fragility v0.2 could not detect.

---

## 15. Speed and cost budget

### 15.1 Speed

Target: under 3 minutes wall clock for a full active-library run.

| Phase                                      | Time       | How                        |
| ------------------------------------------ | ---------- | -------------------------- |
| 300 GPT calls (60 × 5)                     | ~90s       | 30 concurrent              |
| Storage of 4 stage artefacts               | <2s        | In-memory then batch write |
| Mechanical scoring × 4 stages              | <2s        | Pure functions, parallel   |
| Judge calls (60 batched, 5 each)           | ~60s       | 30 concurrent              |
| Metamorphic runs in parallel               | ~80s       | Runs alongside main        |
| Failure clustering                         | <1s        | Lookup table               |
| Diff vs previous version                   | <1s        | JSON compare               |
| **Total (active library, no metamorphic)** | **~3 min** |                            |
| **Total (with metamorphic)**               | **~4 min** |                            |

### 15.2 Cost (REVISED v0.3)

Round 2 was right that exact dollar figures will go stale and create false confidence. v0.3 keeps only:

- **Hard ceiling per run.** A defined token budget per run, expressed in tokens not dollars. Anything exceeding the ceiling requires `--allow-expensive` and is logged.
- **Relative run classes.** Five run classes by relative cost:
  - **Smoke-alarm run** (5 samples, no metamorphic, no holdout) — cheapest
  - **Decision-support run** (30 samples, metamorphic, no holdout)
  - **Dispute-resolution run** (50 samples, metamorphic, no holdout)
  - **Milestone run** (30 samples, metamorphic, holdout, spot audit)
  - **Mutation testing pass** (most expensive, requires explicit flag)

Dollar estimates are calculated per run from current API rates and stored in metadata, but no estimate is hardcoded into the doc.

---

## 16. Statistical discipline (REWRITTEN v0.3)

Round 2 caught a real problem here: v0.2's noise-floor table sounded more authoritative than the analysis warranted. Specifically, it presented "95% confidence" thresholds without specifying the estimator, the interval method, the variance assumptions, or whether the analysis was per-sample or per-scene. v0.3 reframes the entire section as **operational decision thresholds** rather than statistical claims I can't fully back up.

### 16.1 Three run classes, three purposes

| Run class              | Samples per scene | What it can tell you                                                               | What it cannot tell you                                                     |
| ---------------------- | ----------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Smoke alarm**        | 5                 | Large failures, obvious regressions, qualitative direction                         | Anything close-call. Anything within the noise of the model's own variance. |
| **Decision support**   | 30                | Sufficient evidence to make a fix-or-don't-fix call on most rules                  | Sub-percent differences. Rare-event failures.                               |
| **Dispute resolution** | 50                | Resolves close calls between adjacent versions when decision-support runs disagree | Anything that would need formal hypothesis testing                          |

A 5-sample run is a **smoke alarm**, not a measurement. It tells you something is on fire. It does not tell you how big the fire is or whether yesterday's was smaller. Use it for triage, not inference.

### 16.2 Mechanical vs judged thresholds

Mechanical and judged checks have different variance profiles and should not share one threshold policy:

- **Mechanical checks** are deterministic given an output. Variance comes from sampling, not measurement. Larger samples are essentially free (no judge cost), so mechanical thresholds can be more aggressive.
- **Judged checks** carry extra variance from rubric interpretation, judge anchoring, and calibration drift. Judged thresholds should be more conservative — a 10-point change at the smoke-alarm tier should not trigger action without a decision-support follow-up.

In practice: mechanical regressions can be acted on at smoke-alarm scale if they're large and consistent. Judged regressions almost always need decision-support runs before action.

### 16.3 Paired analysis is the preferred mode for version comparisons

When comparing v4.5 vs v4.6 on the same scenes, same settings, same sample plan, the most informative question is **not** "what's the overall fail rate of each?" but "on the same scene/sample family, which version did better?"

Paired analysis reduces noise substantially because most of the variance comes from scene-to-scene difficulty, which is held constant in a paired comparison. v0.3 defaults to paired analysis whenever both versions have been run on the same scene set.

### 16.4 Temperature sweep order

Sweep order: **0.5 → 0.4 → 0.3 → 0.2**, not 0.2 first. 0.2 may reduce rule failures by flattening T3/T4 value-add into compliance dullness. Each sweep step is a decision-support run (30 samples).

### 16.5 Reasoning effort sweep

Start with `medium` (matches Call 3 Playground). Test `low` for speed. Test `high` only if a specific failure cluster looks reasoning-bound.

### 16.6 What this section honestly can and cannot do

It can: tell you which run class to use for which decision; give you a defensible vocabulary for reporting changes; prevent you from chasing noise; prevent you from acting on smoke-alarm runs as if they were decision-support runs.

It cannot: replace actual statistical analysis if you ever need formal claims; give you exact confidence intervals; guarantee that a 30-sample decision-support run will catch every meaningful regression. It is operational discipline, not statistics.

This honest framing is the section's main improvement over v0.2.

---

## 17. How the harness will lie to you

Eight failure modes of the harness itself. Five from round 1, two added in round 2, one added in round 3. The people running the harness need to internalise these.

### 17.1 It will overfit to the rule inventory

**Risk:** rewarding outputs that look test-compliant rather than visually strong.
**Mitigation:** judged scorer asks five quality questions, not rule-compliance questions. Holdout set catches overfit. Failure clustering surfaces rules that always pass while cluster scores stay flat.

### 17.2 It will inherit judge taste

**Risk:** Claude over-scoring T3/T4, ChatGPT under-scoring, harness reflects judge preference instead of quality.
**Mitigation:** judge calibration offsets (§6.2). Cross-judge runs at milestones. Disagreement above threshold surfaced.

### 17.3 It will confuse route quality with prompt quality

**Risk:** scoring raw model output and calling it product quality when production is the routed output.
**Mitigation:** route-stage attribution (§11). Stage D is canonical.

### 17.4 It will under-measure correlated failure

**Risk:** counting four symptoms of one cause as four bugs.
**Mitigation:** failure clustering by root cause (§10).

### 17.5 It will drift into library gaming

**Risk:** the active library becomes the only thing the system optimises for.
**Mitigation:** holdout discipline (§12). Metamorphic testing on perturbed inputs (§9).

### 17.6 It will confuse surrogate equivalence with user equivalence (NEW v0.3)

**Risk:** the metamorphic oracle declares two outputs equivalent because nouns survive and the judge says "same scene," while a human user would still feel one is clearly worse — flatter framing, lower emotional temperature, less distinctive.
**Mitigation:** spot-audit lane on milestone runs (§9.4). 10–15 paired samples reviewed blind by Martin. When the oracle says "equivalent" and the human says "no," the pair becomes oracle-tuning evidence.

### 17.7 It will mistake deterministic rescue for architectural health (NEW v0.3)

**Risk:** route-stage attribution shows Stage D passing and the harness reports "fine," but the rule is only product-live because cleanup is rescuing 85% of model failures. One future cleanup change releases a large latent failure pool.
**Mitigation:** rescue dependency index (§11.2). Reported alongside Stage D pass rate. A high pass rate with high rescue dependency is a fragility finding, not a health finding.

### 17.8 It will confuse fixture realism with production realism (NEW v0.3.1)

**Risk:** the active library and holdout library may be composed of scenes that are _editorially_ representative — real English, real prompts, real stressors — but not _traffic-shape_ representative. The library may underrepresent the actual frequency distribution of what users do in production. The harness can become very good at rare-but-interesting failures and silently miss common-but-boring ones.

This is **distinct from library gaming** (§17.5). Library gaming is overfitting to _known tests_. Fixture realism is a deeper problem: the library itself does not reflect the production traffic mix, regardless of whether the system is overfit to it.

**Mitigation:** add a **traffic-weighted replay slice** to milestone runs once Sentinel or production logs are mature enough to support it.

- 20–30 recent anonymised real inputs
- Sampled by observed frequency bands (so common inputs are present in proportion to their real frequency, not editorial choice)
- Refreshed periodically (monthly or per milestone)
- Kept **separate** from canonical stress scenes — the replay slice and the stress library serve different purposes and should not be mixed
- Scored with the same harness pipeline but reported as a separate slice in the inventory

The replay slice gives you both editorially-chosen stress cases (stress library) and production-shaped cases (replay slice). Without it, the harness is excellent at the first and blind to the second.

**Dependency:** this mitigation is blocked until Sentinel ships and production logging captures inputs at sufficient volume. Until then, §17.8 is a known unmitigated risk and the harness should be operated with that awareness. The build plan flags this as a deferred phase.

---

## 18. Phase plan

| Phase       | Architecture                                                  | Trigger to advance                                                                                                                                                                        |
| ----------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phase 1** | Single call, four tiers in one inference (current production) | Build harness, baseline, sweep temperature, sweep reasoning effort. Stay here until measurement is stable.                                                                                |
| **Phase 2** | 2-way split: T1+T2 (keyword), T3+T4 (prose)                   | Only if Phase 1 measurement shows persistent rule collisions between keyword and prose tiers, AND at least one judged failure cluster is dominated by tier_drift or constraint_collision. |
| **Phase 3** | 4-way split or hybrid                                         | Only if Phase 2 measurably wins on failure rate per unit cost AND operational complexity is justified by the delta.                                                                       |

Each phase advance requires evidence in the harness output. No hunches.

---

## 19. What this gives you that BQI doesn't

| BQI (Call 3)                 | This (Call 2) v0.3                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| Per-platform builder testing | Per-tier × per-route-stage testing with rescue dependency                                               |
| Patch-file isolation         | Parameterised dev endpoint (auth-gated)                                                                 |
| Single-shot scoring          | Multi-sample with explicit run-class discipline                                                         |
| Score per platform × scene   | Failure-mode inventory by rule × stage × cluster × rescue × significance                                |
| Hand-curated test scenes     | Hand + LLM-generated + production-captured + holdout                                                    |
| Mechanical + judged          | Mechanical + judged + mutation + coverage + metamorphic + spot audit                                    |
| Confirms what works          | Hunts what's broken, attributes to a route stage, clusters by root cause, measures structural fragility |

---

## 20. Open questions for ChatGPT round 3

The architecture is approaching freeze. Round 3 is checking the integration of round-2 amendments and pivoting toward implementation order, not more architecture polish.

1. **Did v0.3 actually integrate the four round-2 amendments cleanly, or has any of them been bolted on?** Specifically: rescue dependency, oracle change, constraint_collision, mutation 3-bucket classification.
2. **The honesty rewrite of §16 (statistical discipline).** Is the reframing as "operational decision thresholds, not statistical claims" actually defensible, or have I just renamed the bluff?
3. **Implementation order.** When the build starts, what's the smallest viable subset that proves the harness concept end-to-end? My instinct: dev endpoint + 5 hand-curated scenes + mechanical scorer for one tier + route-stage attribution for one rule. Real but minimal. Is that the right minimum, or is there a smaller proof-of-life?
4. **Anything in v0.3 you would build later rather than first?** Mutation testing and spot-audit lane are obvious deferred candidates. Anything else?
5. **What's the failure mode of the harness itself that I still haven't named?** v0.2 → v0.3 added two (#17.6, #17.7). Is there a #17.8 hiding?
6. **Architecture freeze readiness.** Is v0.3 ready to freeze and start building, or is there a remaining structural concern that should be settled in v0.4 first?

Six questions. Tighter than v0.2's seven, more focused on implementation readiness.

---

## 21. What is explicitly NOT in scope

Unchanged: no production deployment, no continuous integration in v0.3, no live dashboards, no cross-call (Call 2 → Call 3) end-to-end testing, no multi-developer concurrency, no automatic fix-suggestion. The harness diagnoses, humans fix.

---

## 22. Success criteria

Six months from now, the harness has:

1. Caught at least 5 regressions before they shipped.
2. Surfaced at least 2 dead rules in the Call 2 system prompt.
3. Identified at least 1 contradiction between rules.
4. Identified at least 1 case where post-processing was rescuing a model failure (route-stage attribution win).
5. Identified at least 1 case where a rule had high rescue dependency and was structurally fragile (rescue index win).
6. Identified at least 1 case where a perturbation broke output stability (metamorphic win).
7. Identified at least 1 case where the production-traffic replay slice failed differently to the stress library (production realism win — once Sentinel ships).
8. Made at least 1 architectural change with measurable judged improvement.
9. Become the artefact a competitor would need to replicate to match Promagen quality.

If after six months it has done none of these, it was a waste and should be killed.

---

## 23. Status: frozen architecture

v0.3 was scored 98/100 by ChatGPT round 3 with explicit "freeze and start building" verdict. v0.3.1 patches in the one round-3 amendment (§17.8 fixture realism) and otherwise preserves v0.3 verbatim.

**This document is the frozen architecture.** No further architecture revisions are planned. Future changes to the harness design should be tracked as v1.x edition updates after implementation, not as v0.x review cycles.

The next document is the **Call 2 Quality Harness Build Plan**, which translates this architecture into a phased implementation grounded in actual file paths in `src.zip`.

End of v0.3.1.
