# Build Plan — Call 2 Efficiency Programme

**Project:** Promagen API Call 2  
**Date:** 13 April 2026  
**Status:** Proposed  
**Scope:** T1, T3 and T4 only. T2 is deferred and excluded from production priority until it becomes a real native generation path.  
**Authority basis:** `api-call-2-v2.1.0.md` and the agreed operating direction for Call 2.  

---

## 1. Purpose

This plan documents the five moves needed to make Call 2 succeed as a stable, efficient translation engine.

Call 2 is not an authoring engine. It should not be made successful by asking one GPT pass to become a writer, syntax checker, deduper, format police, jargon scrubber, and semantic compressor all at once.

The route to success is:

- narrower GPT responsibility
- heavier deterministic code enforcement
- stricter fault triage
- root-cause-led engineering
- optimisation for final Stage D truth rather than raw Stage A beauty

---

## 2. Core operating doctrine

### 2.1 What Call 2 is

Call 2 is a **translation, compression, and formatting engine** for **T1, T3 and T4**.

It must:

- preserve approved user content
- convert that content into tier-native prompt language
- obey hard structural limits
- hand off clean material to Call 3

It must not:

- invent new positive scene content
- silently discard approved content
- rely on prompt wording for deterministic work that code can enforce
- over-polish weak input into fabricated strength

### 2.2 Stage philosophy

The target is not a beautiful Stage A.

The target is a reliable **Stage D**.

Success means the full system reaches correct final output through the right mix of:

- GPT semantic work
- post-processing
- compliance enforcement
- truthful harness diagnosis

### 2.3 Tier scope

This programme applies to:

- **T1**
- **T3**
- **T4**

**T2 is deferred.** It should not distort engineering priorities for the real production lane.

---

## 3. Success definition for this programme

This programme is successful when:

1. GPT only carries work that genuinely requires semantic judgement.
2. Deterministic failure modes are moved into code.
3. Technical conversion becomes a reliable subsystem, not a best-effort side feature.
4. Measurement failures stop being confused with output failures.
5. The harness output drives fast, root-cause-led decisions after every run.
6. Stage D quality improves without broad regressions.

---

## 4. Move 1 — Shrink GPT’s contract

### 4.1 Goal

Reduce the burden on the single GPT pass so it is responsible only for the tasks that are actually semantic and creative.

### 4.2 Principle

GPT should do only what code cannot do safely.

### 4.3 GPT should own

- semantic preservation
- compression choices under budget pressure
- native restructuring into T1, T3 and T4 voice
- mood-to-visual conversion
- interaction preservation
- spatial relationship preservation
- avoidance of invention and semantic drift
- opening freshness and non-echo behaviour where semantic judgement is required

### 4.4 GPT should stop being trusted to own

- syntax purity
- weight syntax policing
- wrapper-length compliance
- ordering normalisation
- suffix/prefix presence
- quality-token deduplication
- camera-hardware stripping
- numeric-measurement cleanup
- banned phrase cleanup
- meta opener cleanup
- minor punctuation sanitation

### 4.5 Engineering action

Refactor the Call 2 system prompt so it is shorter, narrower, and explicitly centred on:

- preserve
- restructure
- compress honestly
- stay native
- do not invent

Everything else should either be removed from the prompt or reframed as code-backed behaviour.

### 4.6 Expected benefit

- less instruction conflict
- fewer trade-offs between format, preservation and cleanup
- lower Stage A variance
- fewer prompt rewrites needed per fix cycle

### 4.7 Risks

- removing too much prompt guidance could flatten quality if code coverage is not ready
- semantic tasks must not be over-moved into code where deterministic logic cannot judge meaning

### 4.8 Verification

Look for:

- lower rescue dependency spikes caused by prompt fragility
- fewer cross-aim regressions after prompt edits
- stable or improved manual scores in preservation, nativeness and drift

---

## 5. Move 2 — Turn Aim 6 into a proper code-owned subsystem

### 5.1 Goal

Make technical-input handling reliable, deterministic, and tier-aware.

### 5.2 Why this matters

Technical scenes are a real production risk. Users deliberately provide camera, lens, focus and measurement language. Those inputs must survive usefully.

Today, this area is still too dependent on mixed GPT behaviour and incomplete code helpers.

### 5.3 Subsystem target

Create a dedicated technical-conversion layer responsible for:

#### T1

- stripping or demoting CLIP-unusable camera hardware strings
- removing raw non-visual literals that waste budget
- preserving usable visual consequences where possible

#### T3

- converting technical terms into visual effects
- converting measurement language into visual descriptions
- keeping output natural and cinematic rather than technical

#### T4

- converting technical terms into short, plain, casual language
- keeping conversions compact enough to respect T4 limits
- preventing jargon leakage completely wherever possible

### 5.4 Functions already identified by the architecture

- `stripT1CameraJargon()`
- `convertMeasurementsToVisual()`
- extended `convertPhotographyJargonTierAware()`

These should stop being treated as small patch functions and become part of a clear subsystem with defined input classes and expected outputs.

### 5.5 Engineering action

Build a dedicated conversion module or conversion zone that:

- detects camera bodies, lenses, focal lengths, apertures, shot descriptors, measurement strings and directional phrases
- maps them to tier-appropriate outcomes
- handles compound patterns, not just simple tokens
- prefers visible effect over raw technical survival in T3/T4
- distinguishes between discard, rewrite, compress and preserve decisions

### 5.6 Expected benefit

This move should improve multiple aims at once:

- Aim 2 — native format
- Aim 6 — technical conversion
- Aim 11 — Call 3 handoff cleanliness
- parts of Aim 1 — technical-term survival

### 5.7 Risks

- over-aggressive stripping could destroy legitimate scene value
- over-verbose conversion could hurt T4 length compliance
- brittle pattern matching could miss mixed forms and variants

### 5.8 Verification

Primary checks:

- T1.no_clip_unusable_jargon
- T1.no_non_visual_literals
- T3.no_raw_camera_jargon
- T3.no_raw_numeric_measurements
- T4.no_raw_camera_jargon
- T4.no_raw_numeric_measurements

Secondary checks:

- technical-scene manual scorecards
- handoff cleanliness in T1/T3/T4
- no fresh coverage regressions on technical scenes

---

## 6. Move 3 — Separate semantic failures from measurement failures more aggressively

### 6.1 Goal

Stop wasting engineering effort on the wrong layer.

### 6.2 Why this matters

A system like this can fail in at least five different ways:

- GPT made a poor semantic decision
- code enforcement is missing
- code enforcement caused damage
- the harness measured correctly behaving output as wrong
- the scene definition itself is weak or incomplete

If these are mixed together, engineering effort becomes noisy and inefficient.

### 6.3 Required triage discipline

Every weak lamp should be forced through this sequence:

1. Is the final Stage D output actually bad?
2. If yes, is the fault semantic or deterministic?
3. If no, is the harness wrong or incomplete?
4. If the harness is right in principle, is the scene annotation too weak?
5. Is the loss acceptable due to platform limits or compression pressure?

### 6.4 Engineering action

Strengthen the root-cause process around:

- `prompt_failure`
- `code_enforcement_gap`
- `code_enforcement_failure`
- `measurement_failure`
- `measurement_gap`
- `scene_definition_failure`
- `accepted_constraint_loss`
- `input_quality_limit`

Do not allow any fix proposal to proceed without declaring which of the above classes it belongs to.

### 6.5 Practical effect

This prevents teams from:

- editing prompts when the real problem is a coverage alias gap
- editing code when the scene annotation is incomplete
- chasing hostile-input noise as if it were production drift
- reading symptoms as root causes

### 6.6 Expected benefit

- faster diagnosis
- less churn
- fewer misdirected fixes
- more trust in the board

### 6.7 Risks

- triage can become administrative if too much ceremony is added
- some failures genuinely span layers and need honest multi-owner classification

### 6.8 Verification

Look for:

- fewer repeated fixes on the same symptom
- cleaner fault register entries
- clearer distinction between real output defects and harness truth issues
- reduced time from run output to next correct action

---

## 7. Move 4 — Reframe the target from “all aims green” to “all aims green at the right layer”

### 7.1 Goal

Prevent over-engineering and avoid chasing false perfection.

### 7.2 Principle

Not every aim should be made green in the same way.

Some aims should be green because GPT is strong.
Some should be green because code is strong.
Some should be green because measurement became truthful.
Some edge-case areas may remain dim without representing a production emergency.

### 7.3 Operational interpretation

#### Must be rock solid

- Aim 3 — hard structure
- Aim 12 — measurement truth

#### Must be strongly code-supported

- Aim 2 — native format enforcement support
- Aim 6 — technical conversion

#### Must remain primarily semantic / GPT-led

- Aim 1 — preserve approved content
- Aim 5 — prevent invention and drift
- Aim 8 — restructure without echo
- Aim 10 — preserve interactions and spatial relationships

#### Must be judged by production risk, not by raw ugliness

- Aim 9 — sparse, hostile, malformed, abstract inputs

#### Must not distract the production lane yet

- Aim 15 — T2 deferred

### 7.4 Engineering action

Update run review culture so that after every harness run the first questions are:

- Which aims are weak?
- At what layer should each of those aims become green?
- Is the weakness in GPT, code, harness, scene setup, or accepted physics?

### 7.5 Expected benefit

- less overfitting of the prompt
- fewer unstable “fix everything in the model” attempts
- cleaner investment into code where it belongs
- better prioritisation of production-impacting faults

### 7.6 Risks

- poor discipline could let teams excuse real failures as “wrong layer” issues
- production-risk language must not become a shield for ignoring important degradation

### 7.7 Verification

A successful review culture will show:

- explicit layer ownership in every major fix plan
- fewer broad prompt rewrites
- more stable cross-run behaviour
- better alignment between harness findings and manual judgement

---

## 8. Move 5 — Optimise by failure cluster, not by aim count

### 8.1 Goal

Turn the architecture into an efficient engineering workflow.

### 8.2 Why this matters

The 15 aims are the correct diagnostic board.
They are not necessarily the best work queue.

Engineering is more efficient when related failures are solved as one root-cause cluster instead of as scattered aim-by-aim errands.

### 8.3 Proposed working clusters

#### Cluster A — Technical conversion

- T1 jargon leakage
- T3/T4 raw technical leakage
- numeric measurement cleanup
- technical-term survival
- conversion-aware coverage mismatches

#### Cluster B — Content survival

- input element coverage
- silent discard
- secondary detail loss
- compression integrity pressure

#### Cluster C — T1 shaping

- subject hierarchy
- non-visual literals
- orphan adjectives
- duplicate quality families
- token economy and ordering

#### Cluster D — T3/T4 voice

- banned phrases
- meta language
- echo
- plain-language accessibility
- sentence shape and flow

#### Cluster E — Measurement truth

- coverage aliases
n- false positives
- false negatives
- scene annotations
- scene-class separation
- stability interpretation

### 8.4 Engineering action

Run improvement cycles by cluster:

1. pick one cluster
2. identify root cause(s)
3. decide prompt vs code vs harness ownership
4. implement narrowly
5. rerun harness
6. compare Stage A to Stage D movement
7. record any cross-cluster regressions

### 8.5 Expected benefit

- fewer scattered edits
- easier reasoning about regressions
- better leverage from each fix batch
- faster progress on meaningful groups of symptoms

### 8.6 Risks

- some failures will overlap clusters and need deliberate handling
- clustering must not blur aim accountability in the fault register

### 8.7 Verification

A healthy workflow will show:

- tighter, more coherent fix batches
- clearer before/after assessment
- fewer “we changed six unrelated things” deployments
- better regression containment

---

## 9. Recommended implementation order

### Phase A — Doctrine and scope lock

1. Confirm T1, T3 and T4 as the active production scope.
2. Keep T2 outside the main production priority lane.
3. Publish the operating doctrine inside the Call 2 docs.
4. Make Stage D truth the review standard.

### Phase B — Prompt narrowing

1. Audit current system prompt responsibilities.
2. Remove or demote deterministic policing instructions.
3. Keep only semantic/translation responsibilities in the GPT contract.
4. Re-run harness and compare Stage A and Stage D behaviour.

### Phase C — Aim 6 subsystem build

1. Build `stripT1CameraJargon()` properly.
2. Build `convertMeasurementsToVisual()` properly.
3. Extend `convertPhotographyJargonTierAware()` for compound forms and variant patterns.
4. Add tests and technical-scene validation.

### Phase D — Triage hardening

1. Tighten root-cause vs symptom recording.
2. Require every weak lamp to declare fault class, owner and fix type.
3. Audit recurring failures for measurement or scene-definition mistakes.
4. Reduce false-fault engineering churn.

### Phase E — Cluster-driven improvement cycles

1. Work cluster by cluster rather than aim by aim.
2. Prioritise Cluster A and Cluster E first.
3. Then address content survival and T1 shaping.
4. Leave broader voice refinements until structural and technical layers are calmer.

---

## 10. What should happen after every run

The review sequence should be:

1. Read the circuit board first.
2. Check Stage D weak lamps, not just Stage A noise.
3. Separate semantic faults from measurement faults.
4. Group failures by cluster.
5. Pick the smallest high-leverage batch.
6. Avoid touching unrelated circuits.
7. Record expected regression risks before implementation.

---

## 11. What not to do

Do not:

- chase a perfect raw GPT output
- keep bloating the system prompt with mechanical rules
- prioritise T2 while it is still deferred
- treat every dim lamp as equally urgent
- confuse hostile-input ugliness with production failure
- mix scene annotation issues into GPT blame
- ship wide, multi-cause fix batches without root-cause clarity

---

## 12. Final recommendation

The route to making Call 2 succeed is not more ambition from one GPT pass.

It is a **smarter division of labour**:

- GPT handles semantic translation
- code handles deterministic enforcement
- harness tells the truth about what failed and why
- fix plans follow root cause, not symptom noise

That is how the system becomes both **more efficient** and **more likely to satisfy all real production aims successfully**.

---

## 13. Existing features preserved: Yes

This programme is an efficiency and reliability restructuring plan. It does not remove the existing harness, route stages, or current enforcement baseline. It narrows GPT responsibility and strengthens deterministic layers on top of the existing system.

