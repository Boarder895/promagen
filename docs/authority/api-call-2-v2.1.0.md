# API Call 2 — Aims Circuit Architecture & Build Plan

**Version:** 2.1.0  
**Date:** 13 April 2026  
**Owner:** Martin Yarnold / Promagen  
**Scope:** API Call 2 — complete rebuild of measurement, diagnosis, and enforcement  
**Authority:** This document is the single source of truth for all Call 2 engineering decisions.

**v2.1.0 changes (13 Apr 2026):**

- Added root cause vs symptom split to fault register (§4.1)
- Added fix type strict enum to all faults (§4.2)
- Added production risk rating to all top-level aims (§4.3)
- Updated JSON schema, console output format, and aim register table to carry these fields

---

## 1. What This Document Is

This is the engineering specification for rebuilding Call 2's quality measurement system from the ground up.

It replaces the ad-hoc rule-by-rule harness with an aims-based fault-finding architecture modelled on electrical circuit diagnosis. Every weakness in the system must be traceable to a specific wire in a specific circuit, with a named owner, a fault class, a confidence level, and a fix path.

The old system measured 29 structural rules and called 28/29 HEALTHY. Then a manual test scored the same output 61/68/70. The measurement was correct. The measurement was also useless. Structural compliance without content quality is a passing MOT on a car with no engine.

This document fixes that.

---

## 2. Core Statement

Call 2 is a **translation, compression, and formatting engine**.

It takes approved user content and expresses it natively for each tier family.

It is **not** an authoring engine.

It must:

- Preserve approved user content
- Convert that content into tier-native prompt language
- Obey hard structural limits
- Hand off clean material to Call 3

It must not:

- Invent new positive scene content
- Silently discard approved content
- Allow deterministic compliance to rely on wishful prompt wording when code can enforce it
- Polish content beyond what the user provided (if the input is weak, the output should be honest, not fabricated)

---

## 3. Architecture Model

### 3.1 The Electrical Circuit Metaphor

Each top-level aim behaves like a circuit with a status lamp.

| Lamp     | Status     | Meaning                                          |
| -------- | ---------- | ------------------------------------------------ |
| ● BRIGHT | HEALTHY    | Circuit working correctly                        |
| ◐ DIM    | BORDERLINE | Resistance on the circuit — working but degraded |
| ○ OUT    | FAILING    | Open circuit — broken path                       |
| —        | NOT WIRED  | Circuit not yet built                            |

Every circuit has:

- A purpose (what it achieves)
- Anti-aims (what it must never do)
- Sub-circuits (fault-findable components)
- Upstream dependencies (which circuits must be green first)
- Enforcement wiring (prompt rules, code functions, harness rules)
- Diagnostics (stage pipeline, fault class, owner, confidence)
- A measurable output (harness score + manual score)

### 3.2 The Fault-Finding Protocol

When a lamp is dim or out, the diagnosis must answer:

1. **Where is the fault?** — which sub-aim, which wire
2. **What type of fault?** — prompt failure, code failure, measurement failure, accepted constraint, run variance, dependency regression, or scene-definition error
3. **At which pipeline stage?** — Stage A (GPT raw), Stage B (post-processed), Stage C (compliance-enforced), Stage D (final output)
4. **Who owns it?** — prompt, code, harness, or accepted physics
5. **What is the confidence?** — high, medium, low
6. **What is the fix path?** — specific action, not vague intention

The diagnostic protocol mirrors electrical fault-finding: you don't test all the wiring. You check at a convenient point (the stage pipeline) and move forward or backward to isolate the break.

- Stage A fail → Stage D pass = code rescued GPT (fault is in prompt, code is compensating)
- Stage A pass → Stage D fail = code damaged it (fault is in code)
- Stage D fail → manual pass = harness is wrong (fault is in measurement)
- Stage D pass → manual fail = harness doesn't measure this (missing sensor)

### 3.3 Enforcement Precedence

| Layer                | Handles                                                                                                               | Examples                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Prompt               | Creative composition, semantic preservation, restructuring, tone, mood, interaction preservation, compression choices | "Restructure the opening", "Convert mood to visual equivalents", "Preserve user verbs"               |
| Code                 | Countable constraints, syntax, deduplication, ordering, suffix/prefix presence, threshold fixes, lookup conversions   | `enforceSubjectHighestWeight()`, `deduplicateQualityTokens()`, `convertPhotographyJargonTierAware()` |
| Prompt + code backup | Cases where GPT should try first for quality, but deterministic rescue is safe                                        | Weight wrapping, char limits, banned phrases                                                         |

**Precedence statement:**

- Code wins for anything countable, parseable, reorderable, deduplicable, or lookup-convertible
- Prompt wins for anything creative, semantic, structural, or tonal
- Harness measures both
- Final post-processed output (Stage D) is product truth

### 3.4 Scoring Architecture

Every aim has two score layers:

**Layer 1 — Harness score (mechanical, deterministic, automated)**

- Rule pass/fail rates at each stage
- Rescue dependency per rule
- Trend vs previous run
- Stability band (±2% across 3 runs = stable; outside band = real change)

**Layer 2 — Manual quality score (human judgement on canonical scenes)**

- Fixed protocol with rubrics (what a 9, 5, and 2 look like)
- Gold-standard reference outputs for comparison
- Scene-class separation (canonical vs stress vs hostile)

**Aim rollup combines both layers into the lamp status.**

### 3.5 Stability Bands

GPT is stochastic. A rule at 4.8% one run and 3.8% the next hasn't changed — that's noise.

Every sub-aim carries a stability band:

- If the score stays within ±2% across 3 consecutive runs, it is **stable**
- Movement outside the band is flagged as a **real change**
- Movement inside the band is tagged **run_variance** — do not investigate

This prevents wasting sessions chasing dice rolls.

---

## 4. Fault Classes

Every weak sub-aim must be tagged with one or more:

| Fault Class                | Meaning                                       | Fix Owner           |
| -------------------------- | --------------------------------------------- | ------------------- |
| `prompt_failure`           | GPT did not produce the intended behaviour    | Prompt              |
| `code_enforcement_failure` | Deterministic cleanup failed or caused damage | Code                |
| `code_enforcement_gap`     | No enforcement exists for this case           | Code                |
| `measurement_failure`      | Harness scored correct behaviour as wrong     | Harness             |
| `measurement_gap`          | No harness rule exists to measure this        | Harness             |
| `scene_definition_failure` | Test scene annotation is incomplete or wrong  | Scene library       |
| `accepted_constraint_loss` | Platform limit forced acceptable loss         | Nobody (physics)    |
| `run_variance`             | Movement within stability band                | Nobody (noise)      |
| `dependency_regression`    | One fix damaged another circuit               | Root-cause circuit  |
| `input_quality_limit`      | Input too weak/hostile for meaningful output  | Nobody (garbage in) |

### 4.1 Root Cause vs Symptom

A single root cause can make multiple lamps go dim. The fault register must distinguish:

- **`root_cause`** — the actual source of the failure
- **`symptom_location`** — where it shows up in the circuit board

Example: the coverage checker can't recognise converted camera terms.

| Field            | Value                                                               |
| ---------------- | ------------------------------------------------------------------- |
| root_cause       | `measurement_failure` — coverage checker missing conversion aliases |
| symptom_location | Aim 1.5 Technical-term survival — T4.input_element_coverage         |

The same root cause also dims Aim 12.1 (conversion-aware coverage). If you fix the root cause (add aliases), both lamps go bright. Without this split, you'd investigate both separately and waste a session.

**Rule: always fix root causes, not symptoms. When two lamps share a root cause, the fault register shows one entry with multiple symptom locations.**

### 4.2 Fix Type

Every fault carries a strict fix type. No free text — one of these six:

| Fix Type             | Meaning                                           |
| -------------------- | ------------------------------------------------- |
| `prompt_edit`        | Change the system prompt                          |
| `code_enforcer`      | Build or modify a TypeScript enforcement function |
| `harness_rule`       | Add, modify, or fix a harness measurement rule    |
| `scene_annotation`   | Add or correct scene expected_elements or tags    |
| `manual_rubric`      | Add or refine a manual scoring criterion          |
| `accepted_no_action` | Known limitation, no fix planned                  |

This enables filtering: "show me all code fixes" or "show me all harness fixes" — instead of reading every fault description.

### 4.3 Production Risk

Every top-level aim carries a production risk rating:

| Risk     | Meaning                                       |
| -------- | --------------------------------------------- |
| `none`   | No user-facing impact                         |
| `low`    | Edge-case impact only — stress/hostile scenes |
| `medium` | Occasional impact on real user content        |
| `high`   | Consistent impact on normal production output |

This separates "Aim 9 borderline on hostile inputs" (low risk — those aren't real users) from "Aim 6 dim on technical scenes" (high risk — real users provide camera specs).

---

## 5. Power-On Dependency Map

Not all aims can be scored independently. Upstream failures contaminate downstream results.

```
LEVEL 0 — FOUNDATIONS (must be green before anything else)
  Aim 3: Obey hard structural constraints
  Aim 12: Maintain measurement truth

LEVEL 1 — FORMAT (requires Level 0)
  Aim 2: Match native platform family format
  Aim 4: Preserve emphasis hierarchy

LEVEL 2 — CONTENT (requires Level 1)
  Aim 1: Preserve approved content
  Aim 5: Prevent invention and semantic drift
  Aim 6: Convert technical inputs correctly

LEVEL 3 — QUALITY (requires Level 2)
  Aim 7: Avoid redundancy and wasted budget
  Aim 8: Restructure without echo
  Aim 10: Preserve interactions and spatial relationships

LEVEL 4 — RESILIENCE (requires Level 2)
  Aim 9: Handle sparse and hostile inputs gracefully

LEVEL 5 — SYSTEM (requires all above)
  Aim 11: Produce clean Call 3 handoff
  Aim 13: Maintain diagnosability and traceability
  Aim 14: Control rescue dependency and systemic stability

DEFERRED
  Aim 15: T2 Midjourney native generation (circuit not yet wired)
```

**Rule: Do not investigate a downstream aim while its upstream dependency is failing.** Fix upstream first.

---

## 6. Edge-Case Input Classification

Not all inputs deserve the same quality expectations. The system must classify inputs and adjust fault diagnosis accordingly.

### 6.1 Input Classes

| Class             | Description                                        | Quality expectation                           | Fault treatment                                                     |
| ----------------- | -------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------- |
| `canonical`       | Well-formed creative scene, 30-200 words           | Full quality expected                         | All failures are real faults                                        |
| `technical`       | Contains camera/lens/focus specs                   | Conversion expected, not raw passthrough      | Conversion failures are code faults                                 |
| `dense`           | 200+ words, 10+ elements                           | Compression expected, some loss accepted      | Secondary detail loss is `accepted_constraint_loss`                 |
| `sparse`          | Under 25 words, minimal content                    | Enrichment expected, lower coverage threshold | Under-length T3 is `accepted_constraint_loss`                       |
| `single_word`     | One word ("sunset")                                | Best-effort generation, no coverage check     | Almost all failures are `input_quality_limit`                       |
| `hostile`         | Prompt injection, rule override, meta-instructions | Format survival expected, content secondary   | Most failures are `accepted_constraint_loss`                        |
| `malformed`       | Broken grammar, typos, ESL, mixed languages        | Graceful handling expected                    | Failures tagged `input_quality_limit` unless structural rules break |
| `contradictory`   | Conflicting visual direction in same input         | GPT must resolve or blend, no measurement yet | Failures tagged `input_quality_limit`                               |
| `stuttered`       | Repeated/duplicated content                        | GPT should deduplicate                        | Not yet measured                                                    |
| `platform_syntax` | User writes in CLIP syntax                         | System should reformat for other tiers        | Not yet measured                                                    |
| `extremely_long`  | Over 500 words                                     | Heavy compression required                    | Secondary/tertiary detail loss is `accepted_constraint_loss`        |

### 6.2 Scene-Class Separation in Scoring

The harness output must separate scores by input class. A dim lamp on hostile inputs is not the same as a dim lamp on canonical scenes.

The circuit summary must show:

```
Aim 9 — Handle sparse and hostile inputs     [◐ DIM]
  Canonical scenes: HEALTHY
  Stress scenes: BORDERLINE (accepted)
  Hostile scenes: DIM (accepted)
  Production risk: LOW
```

This prevents edge-case noise from distorting production quality judgement.

### 6.3 Garbage-In Honesty

If the user provides "asdfjkl; purple loud quiet cat dog", the system should:

- Still produce valid structural output
- Not invent content to compensate
- Not be scored as a failure on content quality aims

The fault class `input_quality_limit` exists specifically for this. The system is not a turd polisher. Weak input produces weak output. That's honest, not broken.

---

## 7. Known-Good Reference Signals

### 7.1 Gold-Standard Scenes

5 canonical scenes will have hand-written "perfect" T1, T3, and T4 outputs that have been verified against actual image generation:

1. **Lighthouse keeper** — weather, character, atmosphere, emotional
2. **Trafalgar Square** — technical camera specs, urban night, dense input
3. **Rainy bookstore cat** — interior, cosy, simple but rich
4. **Astronaut floating** — iconic, scale, isolation
5. **Deep-sea diver** — underwater, colour, depth

Each gold-standard output will include:

- The "perfect" T1/T3/T4 text
- Why each phrasing was chosen
- What a generated image from this prompt should look like
- Known platform test results (Leonardo for T1, DALL-E for T3, Canva for T4)

### 7.2 How References Are Used

When a sub-aim is borderline, compare the harness output against the gold standard:

- If the harness output matches the reference → harness is scoring too harshly (measurement_failure)
- If the harness output deviates clearly → real quality fault
- Deviation type tells you what to fix

---

## 8. Manual Scoring Protocol

### 8.1 Structure

For each canonical scene, score against fixed rubrics. Each criterion has a 3-line rubric defining what a 9, 5, and 2 look like.

### 8.2 Rubric Template

Every manual score uses this format:

```
CRITERION: [name] /10
  9 = [concrete description of excellent]
  5 = [concrete description of mediocre]
  2 = [concrete description of failing]
```

### 8.3 Aim 1 — Content Preservation Rubrics

**Critical anchor survival /10**

- 9 = Every named subject, action, and primary setting element appears in recognisable form. Nothing important is missing.
- 5 = Subject and primary setting survive, but 1-2 secondary elements are missing or vaguely summarised.
- 2 = Subject is present but multiple scene-defining elements are gone or replaced with generic language.

**Compression quality /10**

- 9 = Compressed elements retain their specific meaning. "Purple-and-copper sky" becomes "warm-toned evening sky", not "colourful sky."
- 5 = Some compressions are specific, others are vague umbrella phrases that lose the original detail.
- 2 = Compression turned specific content into generic mush. Multiple elements lost their identity.

**Technical-term survival /10**

- 9 = Every camera/lens/focus spec survives as either the raw term (T1) or a valid visual conversion (T3/T4). No specs are simply dropped.
- 5 = Most specs survive but 1-2 were dropped entirely or survived as awkward raw jargon in the wrong tier.
- 2 = Multiple specs dropped or leaked as raw jargon where they don't belong.

### 8.4 Aim 2 — Native Format Rubrics

**T1 nativeness /10**

- 9 = Reads like a professional CLIP prompt. Clean weighted keywords, no prose, no orphans, no wasted tokens.
- 5 = Structure is right but contains some orphaned words, redundant quality terms, or non-visual literals.
- 2 = Contains prose fragments, sentence-like structures, or significant wasted budget.

**T3 nativeness /10**

- 9 = Reads like a visual director describing a shot. Natural flow, sensory language, no technical jargon, no meta-commentary.
- 5 = Generally reads well but contains some awkward phrasing, raw measurements, or minor jargon leaks.
- 2 = Reads like a rewritten version of the input, not like a visual director. Contains meta-language, raw specs, or flat prose.

**T4 nativeness /10**

- 9 = A casual user with zero prompt experience would understand every word and picture the scene immediately.
- 5 = Mostly accessible but contains 1-2 terms a casual user wouldn't understand (camera jargon, technical language).
- 2 = Contains multiple technical terms, awkward phrasing, or reads like a cut-down version of T3 instead of its own voice.

**Tier separation /10**

- 9 = Each tier is clearly different in structure and voice. You could not confuse T1, T3, and T4 if they were unlabelled.
- 5 = Tiers are somewhat different but T3 and T4 are too similar in phrasing or T1 contains prose-like elements.
- 2 = Two or more tiers are near-identical or one tier has adopted the wrong format entirely.

### 8.5 Aim 6 — Technical Conversion Rubrics

**T3 conversion quality /10**

- 9 = Every camera/lens spec has been converted to a vivid visual effect. "f/1.4" became "soft background separation", not just dropped.
- 5 = Some conversions are good, but 1-2 specs were dropped entirely or survived as raw strings.
- 2 = Multiple raw specs present, or conversions are awkward/incorrect.

**T4 conversion quality /10**

- 9 = Every technical term has been converted to plain language a casual user would understand. Short, natural phrasing.
- 5 = Most conversions work but 1-2 terms survived as jargon or were converted to overly long explanations.
- 2 = Raw camera jargon visible to user. "35mm Leica" or "f/1.4" appears in T4 output.

**No jargon leakage /10**

- 9 = Zero raw camera/lens/measurement terms in T3 or T4. All converted or appropriately handled.
- 5 = 1 minor raw term survives (e.g. a compass direction).
- 2 = Multiple raw technical strings visible.

---

## 9. Top-Level Aims

### 9.1 Aim Count

This framework defines **15 top-level aims** and **52 sub-aims**.

15 aims is correct because:

- 10-12 is too coarse for precise fault-finding
- 20+ becomes administrative overhead
- 15 with 3-4 sub-aims each gives ~52 diagnostic points — granular enough to isolate faults, coarse enough to manage in a dashboard

### 9.2 Aim Register

| Aim | Name                                            | Level    | Sub-aims | Priority | Prod Risk |
| --- | ----------------------------------------------- | -------- | -------- | -------- | --------- |
| 1   | Preserve approved content                       | 2        | 6        | P0       | high      |
| 2   | Match native platform family format             | 1        | 5        | P0       | high      |
| 3   | Obey hard structural constraints                | 0        | 6        | P0       | high      |
| 4   | Preserve emphasis hierarchy                     | 1        | 4        | P1       | medium    |
| 5   | Prevent invention and semantic drift            | 2        | 6        | P1       | medium    |
| 6   | Convert technical inputs correctly              | 2        | 4        | P0       | high      |
| 7   | Avoid redundancy and wasted budget              | 3        | 4        | P1       | medium    |
| 8   | Restructure without echo                        | 3        | 3        | P1       | medium    |
| 9   | Handle sparse and hostile inputs                | 4        | 5        | P2       | low       |
| 10  | Preserve interactions and spatial relationships | 3        | 4        | P1       | medium    |
| 11  | Produce clean Call 3 handoff                    | 5        | 4        | P1       | high      |
| 12  | Maintain measurement truth                      | 0        | 5        | P0       | none      |
| 13  | Maintain diagnosability and traceability        | 5        | 4        | P1       | none      |
| 14  | Control rescue dependency and stability         | 5        | 4        | P1       | low       |
| 15  | T2 Midjourney native generation                 | DEFERRED | 4        | P3       | medium    |

---

## 10. Aim Definitions

### Aim 1 — Preserve approved content

**Purpose:** If the user explicitly provided an element, Call 2 must preserve it in some recognisable form.
**Why it matters:** If the system drops user decisions, trust is broken.
**Dependency level:** 2 (requires Aim 3 and Aim 2 green)

**Anti-aims:**

- Do not silently discard major user-provided content
- Do not collapse multiple concrete elements into vague umbrella wording
- Do not invent new positive content to "fill gaps"

**Done definition:**

- Main subject survives in every tier
- Critical scene anchors survive in every tier
- Secondary elements survive unless hard limits force compression
- Compression preserves specific meaning, not mush
- Technical terms survive literally or as valid conversions

**Sub-aims:**

| Sub-aim                       | Description                                              | Harness rules                                 | Code enforcement                      | Prompt rules                             |
| ----------------------------- | -------------------------------------------------------- | --------------------------------------------- | ------------------------------------- | ---------------------------------------- |
| 1.1 Subject survival          | Primary subject present in all tiers                     | T3/T4.input_element_coverage (subject subset) | coverage checker                      | "Preserve approved content"              |
| 1.2 Critical anchor survival  | Key scene elements survive                               | T3/T4.input_element_coverage                  | coverage checker + conversion aliases | "No silent discard"                      |
| 1.3 Secondary detail survival | Non-critical elements survive when budget allows         | T4.input_element_coverage                     | enforceT4MaxLength (can cause loss)   | "Compress don't drop"                    |
| 1.4 Compression integrity     | Compressed content retains specific meaning              | Manual only                                   | None (semantic)                       | "Compression preserves specific meaning" |
| 1.5 Technical-term survival   | Camera/lens/focus specs survive in tier-appropriate form | Coverage rules with conversion aliases        | convertPhotographyJargonTierAware()   | "Convert technical inputs"               |
| 1.6 No silent discard         | System does not unexplainably drop content               | T3/T4.input_element_coverage                  | coverage checker                      | "P3 no-silent-discard"                   |

**Harness pass line:** Both coverage rules HEALTHY
**Manual pass line:** Average 24/30 or better
**Hard fail:** Primary subject missing from any tier

---

### Aim 2 — Match native platform family format

**Purpose:** Each tier must sound like it belongs to its platform family.
**Why it matters:** Correct content in the wrong form is still weak.
**Dependency level:** 1 (requires Aim 3 green)

**Anti-aims:**

- Do not let T1 drift into prose
- Do not let T3 and T4 collapse into near-identical outputs
- Do not leak syntax or style from one family into another

**Done definition:**

- T1 reads like weighted CLIP keywords
- T3 reads like visual-director prose
- T4 reads like plain-language scene description
- Each tier is clearly distinct in structure and voice

**Sub-aims:**

| Sub-aim                  | Description                                                   | Harness rules                                                                                                                            | Code enforcement                                                                                               | Prompt rules                                        |
| ------------------------ | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 2.1 T1 nativeness        | T1 is comma-separated weighted keywords, not prose            | T1.comma_separated_format, T1.no_trailing_punctuation, T1.no_orphaned_adjectives, T1.no_clip_unusable_jargon, T1.no_non_visual_literals  | stripTrailingPunctuation(), enforceT1WeightWrap()                                                              | "Comma-separated weighted keywords, NOT sentences"  |
| 2.2 T3 nativeness        | T3 reads like a visual director                               | T3.sentence_count_2_to_3, T3.no_banned_phrases, T3.no_banned_tail_constructions, T3.no_raw_camera_jargon, T3.no_raw_numeric_measurements | stripOrRewriteT3BannedPhrases(), stripT3BannedTailConstructions(), convertPhotographyJargonTierAware('tier3')  | "Write like a visual director", banned phrases list |
| 2.3 T4 nativeness        | T4 is plain language a casual user understands                | T4.no_banned_openers, T4.no_meta_language, T4.min_10_words_per_sentence, T4.no_raw_camera_jargon, T4.no_raw_numeric_measurements         | fixT4MetaOpeners(), mergeT4ShortSentences(), fixT4SelfCorrection(), convertPhotographyJargonTierAware('tier4') | "Plain does NOT mean flat", "No meta-language"      |
| 2.4 Tier separation      | T1, T3, T4 are clearly distinct outputs                       | Manual only — future automated check                                                                                                     | None                                                                                                           | Tier examples in prompt                             |
| 2.5 Syntax-family purity | No weight syntax leaking into T3/T4, no prose leaking into T1 | T1.weight_syntax_correct                                                                                                                 | enforceT1Syntax()                                                                                              | Provider-aware syntax instructions                  |

**Harness pass line:** All format rules HEALTHY
**Manual pass line:** Average 32/40 or better

---

### Aim 3 — Obey hard structural constraints

**Purpose:** Hard rules must hold every time regardless of scene content.
**Why it matters:** If structure breaks, everything downstream is unreliable.
**Dependency level:** 0 (foundation — must be green first)

**Anti-aims:**

- Do not rely on GPT "usually" doing the right thing for mechanical rules
- Do not allow preventable schema or syntax breakage into final output

**Done definition:**

- Valid JSON every time
- Correct weight syntax for the selected provider
- Weight steps in 0.1 increments only
- No phrase wraps over 4 words
- Character ceilings respected
- Quality prefix and suffix blocks present

**Sub-aims:**

| Sub-aim                        | Description                       | Harness rules                                        | Code enforcement                           | Prompt rules                      |
| ------------------------------ | --------------------------------- | ---------------------------------------------------- | ------------------------------------------ | --------------------------------- |
| 3.1 JSON/schema integrity      | Valid 3-tier JSON object returned | Implicit (API failure count)                         | Zod validation, empty tier2 injection      | "Return ONLY valid JSON"          |
| 3.2 Weight syntax correctness  | Matches provider format           | T1.weight_syntax_correct                             | enforceT1Syntax()                          | Provider-aware syntax instruction |
| 3.3 Weight-step correctness    | 0.1 increments only               | T1.weight_steps_0_1                                  | enforceT1Syntax() normalises               | "0.1 increments only"             |
| 3.4 Wrapper-length correctness | No >4 word wraps                  | T1.weight_wrap_4_words_max                           | enforceT1WeightWrap()                      | "4-word wrap limit"               |
| 3.5 Character-limit compliance | T3 280-420, T4 ≤325               | T3.char_count_in_range, T4.char_count_under_325      | enforceT3MaxLength(), enforceT4MaxLength() | Length targets                    |
| 3.6 Required block presence    | Quality prefix/suffix present     | T1.quality_prefix_present, T1.quality_suffix_present | ensureT1QualitySuffix()                    | "Quality prefix: masterpiece..."  |

**Harness pass line:** All P0 structure rules HEALTHY
**Hard fail:** Any final-output schema failure

---

### Aim 4 — Preserve emphasis hierarchy

**Purpose:** Subject first, then distinctive scene content, then supporting details, then boilerplate.
**Why it matters:** A prompt can preserve content yet feel wrong if emphasis is badly distributed.
**Dependency level:** 1 (requires Aim 3 green)

**Anti-aims:**

- Do not let generic quality tokens outrank scene content
- Do not let scene actions overpower the subject
- Do not flatten all content to equal importance

**Sub-aims:**

| Sub-aim                         | Description                              | Harness rules                      | Code enforcement              |
| ------------------------------- | ---------------------------------------- | ---------------------------------- | ----------------------------- |
| 4.1 Subject dominance           | Subject carries highest weight           | T1.subject_highest_weight          | enforceSubjectHighestWeight() |
| 4.2 Scene-action prominence     | Scene actions outrank boilerplate        | T1.generic_quality_not_above_scene | demoteGenericQualityWeights() |
| 4.3 Quality-token demotion      | Generic quality tokens not over-weighted | T1.generic_quality_not_above_scene | demoteGenericQualityWeights() |
| 4.4 Supporting-detail restraint | Low-priority tokens don't steal focus    | Manual only                        | normaliseT1Ordering()         |

**Harness pass line:** Subject and quality rules HEALTHY
**Manual pass line:** Average 24/30 or better

---

### Aim 5 — Prevent invention and semantic drift

**Purpose:** Call 2 must not add new positive content or mutate the user's meaning.
**Why it matters:** A translation engine that invents is not trustworthy.
**Dependency level:** 2

**Anti-aims:**

- Do not add objects, settings, actions, or style cues the user did not provide
- Do not replace exact user actions with weaker or different meanings
- Do not change the user's emotional intent

**Sub-aims:**

| Sub-aim                           | Description                                                 | Measurement                          |
| --------------------------------- | ----------------------------------------------------------- | ------------------------------------ |
| 5.1 No new object invention       | No objects appear that weren't in input                     | Manual review                        |
| 5.2 No new setting invention      | No settings appear that weren't in input                    | Manual review                        |
| 5.3 No style invention            | No composition/lighting/style cues invented                 | Manual review                        |
| 5.4 Verb fidelity                 | User's specific verbs preserved                             | Manual review (future harness check) |
| 5.5 Mood fidelity                 | Emotional intent preserved as visual equivalents            | Manual review                        |
| 5.6 Specific-meaning preservation | "Purple-and-copper sky" stays specific, not "colourful sky" | Manual review + coverage checker     |

**Harness pass line:** No clear invention detected in coverage checks
**Manual pass line:** Average 32/40 or better

---

### Aim 6 — Convert technical inputs correctly

**Purpose:** Camera, lens, focus inputs must survive in tier-appropriate form.
**Why it matters:** Users deliberately supply technical photography information. It should survive usefully.
**Dependency level:** 2

**Anti-aims:**

- Do not drop technical inputs entirely
- Do not leak operator jargon into T4
- Do not over-expand tiny terms in tight budgets
- Do not weight camera hardware strings in T1 (CLIP cannot use them)

**Sub-aims:**

| Sub-aim                                  | Description                                       | Harness rules                                           | Code enforcement                                                     |
| ---------------------------------------- | ------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------- |
| 6.1 T1 technical-token handling          | Camera jargon stripped or demoted from T1 weights | T1.no_clip_unusable_jargon                              | NEW: stripT1CameraJargon() or extend enforceClipKeywordCleanup()     |
| 6.2 T3 visible-effect conversion         | Raw specs converted to visual descriptions in T3  | T3.no_raw_camera_jargon, T3.no_raw_numeric_measurements | convertPhotographyJargonTierAware('tier3') — needs extended patterns |
| 6.3 T4 compact plain-language conversion | Raw specs converted to short plain language in T4 | T4.no_raw_camera_jargon, T4.no_raw_numeric_measurements | convertPhotographyJargonTierAware('tier4') — needs compound patterns |
| 6.4 Conversion-budget discipline         | Conversions don't cause T4 to exceed char limit   | T4.char_count_under_325 (existing)                      | enforceT4MaxLength()                                                 |

**Harness pass line:** No raw camera jargon in T3/T4 final output; no CLIP-unusable jargon in T1 weighted tokens
**Manual pass line:** Average 24/30 or better

---

### Aim 7 — Avoid redundancy and wasted budget

**Purpose:** Every token should earn its place.
**Why it matters:** Budget wasted on fluff is budget stolen from the scene.
**Dependency level:** 3

**Anti-aims:**

- Do not duplicate quality cues within the same family
- Do not produce orphan tokens with no visual context
- Do not repeat the same concept in multiple weak forms

**Sub-aims:**

| Sub-aim                       | Description                                    | Harness rules                    | Code enforcement           |
| ----------------------------- | ---------------------------------------------- | -------------------------------- | -------------------------- |
| 7.1 Quality deduplication     | No duplicate quality family tokens             | T1.no_duplicate_quality_families | deduplicateQualityTokens() |
| 7.2 No orphan tokens          | No bare adjectives as standalone T1 tokens     | T1.no_orphaned_adjectives        | None yet (prompt-level)    |
| 7.3 Token economy             | T1 ratio of meaningful tokens to total budget  | Future rule                      | normaliseT1Ordering()      |
| 7.4 No repeated near-synonyms | No semantic duplicates beyond quality families | Future rule (needs NLP)          | None                       |

**Harness pass line:** Dedup and orphan rules HEALTHY
**Manual pass line:** Average 24/30 or better

---

### Aim 8 — Restructure without echo

**Purpose:** T3 and T4 must not lazily mirror the user's opening.
**Why it matters:** A paraphrased copy is not intelligent translation.
**Dependency level:** 3

**Anti-aims:**

- Do not preserve original opening order unless genuinely no better option
- Do not echo the user's first clause with minor edits

**Sub-aims:**

| Sub-aim                   | Description                                   | Harness rules            | Code enforcement                 |
| ------------------------- | --------------------------------------------- | ------------------------ | -------------------------------- |
| 8.1 T3 opening freshness  | T3 first 8 words differ from input            | T3.first_8_words_no_echo | Detection only — no auto-rewrite |
| 8.2 T4 opening freshness  | T4 first 8 words differ from input            | T4.first_8_words_no_echo | Detection only — no auto-rewrite |
| 8.3 Subject repositioning | Subject not in same opening position as input | Manual only              | None (too semantic)              |

**Harness pass line:** Both echo rules HEALTHY
**Manual pass line:** Average 16/20 or better

---

### Aim 9 — Handle sparse and hostile inputs gracefully

**Purpose:** Call 2 should not collapse on weak, malformed, or adversarial inputs.
**Why it matters:** Production systems must survive ugly inputs.
**Dependency level:** 4

**Anti-aims:**

- Do not obey hostile meta-instructions over system constraints
- Do not let prompt injection collapse output
- Do not overfit hostile cases at the expense of canonical scenes
- Do not pretend weak input produces good output (garbage in, garbage out is honest)

**Sub-aims:**

| Sub-aim                            | Description                                          | Harness rules                                                   | Scene types                                                 |
| ---------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------- |
| 9.1 Hostile instruction resistance | Format rules hold under injection                    | T3.char_count_in_range, T4.char_count_under_325 on trap scenes  | trap-prompt-injection, trap-rule-override-attempt           |
| 9.2 Sparse-input adequacy          | Sparse inputs still produce usable output            | T3.char_count_in_range on sparse scenes                         | stress-sparse-20-words, human-single-noun                   |
| 9.3 Malformed-input resilience     | Typos, ESL, broken grammar don't crash tiers         | All structural rules on malformed scenes                        | human-typo-laden, human-esl-non-native, trap-broken-grammar |
| 9.4 Edge-case containment          | Abstract/unusual inputs degrade gracefully           | All structural rules on alien scenes                            | alien-abstract-concept, alien-synesthesia                   |
| 9.5 Dense-input compression        | Very long inputs compress without structural failure | T3.char_count_in_range, T4.char_count_under_325, coverage rules | stress-dense-400-words, trafalgar-square-12-category        |

**Harness pass line:** No REAL_FAILURE on hostile/sparse; structural rules hold
**Manual pass line:** Average 16/20 or better on selected stress scenes

---

### Aim 10 — Preserve interactions and spatial relationships

**Purpose:** When one element acts on another, the interaction must survive.
**Why it matters:** Flattened interactions weaken image guidance badly.
**Dependency level:** 3

**Anti-aims:**

- Do not split one visual interaction into dead fragments
- Do not drop spatial depth under compression

**Sub-aims:**

| Sub-aim                                | Description                                                                     | Measurement                          |
| -------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------ |
| 10.1 Interaction token integrity       | "Gas lamps glowing through haze" stays as one concept, not "gas lamps" + "haze" | Manual review + future harness check |
| 10.2 Reflection/light preservation     | Light-on-surface interactions survive                                           | Manual review                        |
| 10.3 Motion-through-space preservation | Movement interactions survive                                                   | Manual review                        |
| 10.4 Spatial depth preservation        | Foreground/background relationships maintained                                  | Manual review                        |

**Harness pass line:** Partial — element coverage captures some interaction loss
**Manual pass line:** Average 24/30 or better

---

### Aim 11 — Produce clean Call 3 handoff

**Purpose:** Call 2 should hand off material downstream builders can optimise, not repair.
**Why it matters:** Weak Call 2 output taxes every Call 3 builder.
**Dependency level:** 5

**Anti-aims:**

- Do not push clutter, redundancy, or awkward jargon downstream
- Do not force Call 3 builders to clean up Call 2 mistakes

**Sub-aims:**

| Sub-aim                            | Description                                  | Measurement                    |
| ---------------------------------- | -------------------------------------------- | ------------------------------ |
| 11.1 T1 handoff cleanliness        | T1 is compact, weighted, non-fragmented      | Composite of T1 rules + manual |
| 11.2 T3 handoff cleanliness        | T3 is natural, complete, not jargon-heavy    | Composite of T3 rules + manual |
| 11.3 T4 handoff cleanliness        | T4 is simple, vivid, not technically awkward | Composite of T4 rules + manual |
| 11.4 Builder-readiness consistency | Quality consistent across scenes             | Manual trend review            |

**Harness pass line:** All upstream aims HEALTHY or BORDERLINE
**Manual pass line:** Average 32/40 or better

---

### Aim 12 — Maintain measurement truth

**Purpose:** The harness must score real behaviour accurately.
**Why it matters:** Bad measurement sends engineering in the wrong direction.
**Dependency level:** 0 (foundation)

**Anti-aims:**

- Do not treat valid converted equivalents as missing content
- Do not let adversarial scenes distort canonical-scene judgement
- Do not celebrate a harness number that contradicts manual quality

**Sub-aims:**

| Sub-aim                        | Description                                             | Measurement                                                    |
| ------------------------------ | ------------------------------------------------------- | -------------------------------------------------------------- |
| 12.1 Conversion-aware coverage | Coverage checker recognises converted camera/lens terms | Check for false-negative coverage failures on technical scenes |
| 12.2 Scene-rule applicability  | Rules only fire on scenes where they're meaningful      | Coverage gaps report + scene tag analysis                      |
| 12.3 False-positive control    | Harness doesn't flag correct behaviour                  | Manual audit of failed samples                                 |
| 12.4 False-negative control    | Harness doesn't miss real failures                      | Manual audit of passed samples                                 |
| 12.5 Scene-class separation    | Edge-case scores don't distort production judgement     | Separate reporting by scene class                              |

**Pass line:** No known false-negative cluster unresolved; manual audit 16/20+

---

### Aim 13 — Maintain diagnosability and traceability

**Purpose:** Every failure must be easy to localise.
**Why it matters:** If faults are hard to find, fixes become random.
**Dependency level:** 5

**Anti-aims:**

- Do not allow failures without ownership or location
- Do not allow rules to exist without mapping to an aim

**Sub-aims:**

| Sub-aim                          | Description                                              |
| -------------------------------- | -------------------------------------------------------- |
| 13.1 Rule-to-aim traceability    | Every harness rule maps to at least one aim              |
| 13.2 Aim-to-sub-aim traceability | Every aim breaks down into scorable sub-aims             |
| 13.3 Fault ownership clarity     | Every dim/out lamp has a named owner                     |
| 13.4 Root-cause confidence       | Every fault diagnosis carries high/medium/low confidence |

**Pass line:** Every failure can be classified and assigned within one diagnostic pass

---

### Aim 14 — Control rescue dependency and systemic stability

**Purpose:** Code rescue should protect the product but not quietly become the entire system.
**Why it matters:** If GPT relies too heavily on rescue, the system is one code change from collapse.
**Dependency level:** 5

**Anti-aims:**

- Do not let rescue dependency drift upward without explanation
- Do not fix one circuit by destabilising another
- Do not celebrate stability if it's only because nothing changed

**Sub-aims:**

| Sub-aim                      | Description                              | Measurement                  |
| ---------------------------- | ---------------------------------------- | ---------------------------- |
| 14.1 Rescue visibility       | Every rescued rule shows its rescue rate | rescue_dependency per rule   |
| 14.2 Rescue drift control    | Rescue rates stay within stability band  | Trend comparison across runs |
| 14.3 Stable full-run rollups | Previously healthy rules stay healthy    | diff_vs_previous             |
| 14.4 Regression containment  | New fixes don't break existing circuits  | Full-run delta analysis      |

**Pass line:** No unexplained rescue spikes; no regressions in core rules across 3 consecutive runs

---

### Aim 15 — T2 Midjourney native generation (DEFERRED)

**Purpose:** Generate Midjourney-native prompts with :: weights and --params.
**Why it matters:** T2 currently copies T3 — users see identical text in two boxes.
**Dependency level:** DEFERRED (not blocking other aims)

**Current state:** `use-tier-generation.ts` line 115 sets `tier2: api.tier3.positive`. No T2 generation exists. No T2 conversion exists. Users see duplicate content.

**Anti-aims:**

- Do not display T3 content as T2 and pretend it's different
- Do not build T2 until T1/T3/T4 quality is solid

**Sub-aims:**

| Sub-aim                      | Description                           | Status         |
| ---------------------------- | ------------------------------------- | -------------- |
| 15.1 T2 native generation    | Generate MJ-syntax prompts            | Not started    |
| 15.2 T2 parameter injection  | Add --ar, --v, --s, --no params       | Not started    |
| 15.3 T2 :: weight conversion | Convert content into :: weight blocks | Not started    |
| 15.4 T2 UI honesty           | Either show real T2 or hide the tab   | Needs decision |

**Decision required:** Hide T2 from UI until Phase C is built, OR label it as "Midjourney preview — coming soon."

---

## 11. Complete Rule-to-Aim Mapping

### 11.1 Existing Harness Rules (29)

| Rule ID                         | Aim(s) | Sub-aim(s)    |
| ------------------------------- | ------ | ------------- |
| T1.weight_syntax_correct        | 3, 2   | 3.2, 2.5      |
| T1.weight_steps_0_1             | 3      | 3.3           |
| T1.weight_wrap_4_words_max      | 3      | 3.4           |
| T1.quality_prefix_present       | 3      | 3.6           |
| T1.quality_suffix_present       | 3      | 3.6           |
| T1.comma_separated_format       | 2      | 2.1           |
| T1.no_trailing_punctuation      | 2      | 2.1           |
| T1.no_isolated_colour_weights   | 7      | 7.2           |
| T1.subject_highest_weight       | 4      | 4.1           |
| T2.ar_param_present             | 15     | 15.2          |
| T2.v_param_present              | 15     | 15.2          |
| T2.s_param_present              | 15     | 15.2          |
| T2.no_param_present             | 15     | 15.2          |
| T2.no_exactly_once              | 15     | 15.2          |
| T2.weight_clauses_min_3         | 15     | 15.3          |
| T2.no_mid_phrase_weights        | 15     | 15.3          |
| T2.empty_negative_json_field    | 15     | 15.1          |
| T3.char_count_in_range          | 3, 9   | 3.5, 9.2      |
| T3.sentence_count_2_to_3        | 2      | 2.2           |
| T3.no_banned_phrases            | 2      | 2.2           |
| T3.no_banned_tail_constructions | 2      | 2.2           |
| T3.first_8_words_no_echo        | 8      | 8.1           |
| T3.input_element_coverage       | 1      | 1.1, 1.2, 1.5 |
| T4.char_count_under_325         | 3, 9   | 3.5, 9.5      |
| T4.min_10_words_per_sentence    | 2      | 2.3           |
| T4.no_banned_openers            | 2      | 2.3           |
| T4.no_meta_language             | 2      | 2.3           |
| T4.first_8_words_no_echo        | 8      | 8.2           |
| T4.input_element_coverage       | 1      | 1.1, 1.2, 1.3 |

### 11.2 New Quality Rules (9) — Built, Not Yet Deployed

| Rule ID                            | Aim(s) | Sub-aim(s) |
| ---------------------------------- | ------ | ---------- |
| T1.no_orphaned_adjectives          | 7, 2   | 7.2, 2.1   |
| T1.no_clip_unusable_jargon         | 6, 2   | 6.1, 2.1   |
| T1.no_non_visual_literals          | 6, 2   | 6.1, 2.1   |
| T1.no_duplicate_quality_families   | 7      | 7.1        |
| T1.generic_quality_not_above_scene | 4      | 4.2, 4.3   |
| T3.no_raw_camera_jargon            | 6, 2   | 6.2, 2.2   |
| T3.no_raw_numeric_measurements     | 6, 2   | 6.2, 2.2   |
| T4.no_raw_camera_jargon            | 6, 2   | 6.3, 2.3   |
| T4.no_raw_numeric_measurements     | 6, 2   | 6.3, 2.3   |

### 11.3 Unmapped Sub-Aims (Require Future Rules or Manual Only)

| Sub-aim                   | Current status | Next action                                      |
| ------------------------- | -------------- | ------------------------------------------------ |
| 1.4 Compression integrity | Manual only    | Keep manual — too semantic for harness           |
| 2.4 Tier separation       | Manual only    | Future: automated T3/T4 similarity check         |
| 5.1-5.6 Invention/drift   | Manual only    | Future: input-vs-output NLP comparison           |
| 7.3 Token economy         | No rule        | Future: T1 meaningful-token ratio                |
| 7.4 Near-synonyms         | No rule        | Future: requires NLP — low priority              |
| 10.1-10.4 Interactions    | Manual only    | Future: interaction-pair detection               |
| 13.1-13.4 Diagnosability  | System-level   | Delivered by this build                          |
| 14.1-14.4 Stability       | System-level   | Existing rescue-dependency + new stability bands |

---

## 12. Code Enforcement Register

### 12.1 Existing Functions — Active in Production

| Function                              | File                       | Stage | Aims served  |
| ------------------------------------- | -------------------------- | ----- | ------------ |
| `enforceT1Syntax()`                   | harmony-compliance.ts      | C     | 3.2          |
| `enforceWeightCap()`                  | harmony-compliance.ts      | B     | 3.3          |
| `enforceClipKeywordCleanup()`         | harmony-compliance.ts      | B     | 7.2          |
| `enforceSubjectHighestWeight()`       | harmony-compliance.ts      | C     | 4.1          |
| `demoteGenericQualityWeights()`       | harmony-compliance.ts      | C     | 4.2, 4.3     |
| `deduplicateQualityTokens()`          | harmony-compliance.ts      | C     | 7.1          |
| `ensureT1QualitySuffix()`             | harmony-compliance.ts      | C     | 3.6          |
| `normaliseT1Ordering()`               | harmony-compliance.ts      | C     | 4.4, 7.3     |
| `enforceNegativeContradiction()`      | harmony-compliance.ts      | C     | 3            |
| `enforceT1WeightWrap()`               | harmony-post-processing.ts | B     | 3.4          |
| `stripTrailingPunctuation()`          | harmony-post-processing.ts | B     | 2.1          |
| `fixT4SelfCorrection()`               | harmony-post-processing.ts | B     | 2.3          |
| `fixT4MetaOpeners()`                  | harmony-post-processing.ts | B     | 2.3          |
| `mergeT4ShortSentences()`             | harmony-post-processing.ts | B     | 2.3          |
| `convertPhotographyJargonTierAware()` | harmony-post-processing.ts | B     | 6.2, 6.3     |
| `stripOrRewriteT3BannedPhrases()`     | harmony-post-processing.ts | B     | 2.2          |
| `stripT3BannedTailConstructions()`    | harmony-post-processing.ts | B     | 2.2          |
| `enforceT3MaxLength()`                | harmony-post-processing.ts | B     | 3.5          |
| `enforceT4MaxLength()`                | harmony-post-processing.ts | B     | 3.5          |
| `postProcessTiers()`                  | harmony-post-processing.ts | B     | Orchestrator |

### 12.2 Missing Functions — Need Building

| Function                                       | File                       | Aims     | Description                                                              |
| ---------------------------------------------- | -------------------------- | -------- | ------------------------------------------------------------------------ |
| `stripT1CameraJargon()`                        | harmony-compliance.ts      | 6.1      | Strip or demote camera body/lens/f-stop from T1 weighted tokens          |
| `convertMeasurementsToVisual()`                | harmony-post-processing.ts | 6.2, 6.3 | Convert "15 km/h" → "light breeze", "south-westerly" → remove or convert |
| Extended `convertPhotographyJargonTierAware()` | harmony-post-processing.ts | 6.2, 6.3 | Add compound patterns: "35mm Leica", "35mm f/1.4", variant forms         |

---

## 13. Harness Output Specification

### 13.1 Console Output Format

After every run, the harness prints the full circuit board. See Section 14 for the exact format.

### 13.2 JSON Output Format

The harness JSON must include:

```typescript
interface HarnessInventory {
  // Existing
  schema_version: string;
  version: string;
  harness_version: string;
  run_timestamp: string;
  scene_count: number;
  samples_per_scene: number;
  wall_clock_seconds: number;
  run_class: string;
  by_rule: Record<string, RuleResult>;
  by_cluster: Record<string, ClusterResult>;
  coverage_gaps: string[];
  diff_vs_previous: DiffReport | null;

  // NEW — Aim Circuit Board
  by_aim: Record<string, AimResult>;
  by_sub_aim: Record<string, SubAimResult>;
  fault_register: FaultEntry[];
  stability_bands: Record<string, StabilityBand>;
  scene_class_breakdown: Record<string, SceneClassResult>;
  dependency_map: DependencyNode[];
  priority_fix_order: string[];
}

interface AimResult {
  aim_id: string;
  aim_name: string;
  level: number;
  status: "BRIGHT" | "DIM" | "OUT" | "NOT_WIRED";
  production_risk: "none" | "low" | "medium" | "high";
  sub_aims: Record<string, SubAimStatus>;
  harness_score: number; // 0-100 composite
  manual_score: number | null; // null if not yet scored
  pass_line_met: boolean;
  dependency_satisfied: boolean;
  trend: "improving" | "stable" | "regressing" | "new";
  diagnosis: string;
}

interface SubAimResult {
  sub_aim_id: string;
  status: "BRIGHT" | "DIM" | "OUT" | "NOT_WIRED";
  harness_rules: RuleWireStatus[];
  code_enforcement: CodeWireStatus[];
  prompt_rules: PromptWireStatus[];
  stage_pipeline: {
    a_fail_rate: number;
    b_fail_rate: number;
    c_fail_rate: number;
    d_fail_rate: number;
  };
  rescue_dependency: number;
  fault_class: string | null;
  fault_location: string | null;
  root_cause: string | null;
  fix_type:
    | "prompt_edit"
    | "code_enforcer"
    | "harness_rule"
    | "scene_annotation"
    | "manual_rubric"
    | "accepted_no_action"
    | null;
  confidence: "high" | "medium" | "low";
  owner: string | null;
  fix: string | null;
  trend: string;
  scene_detail: Record<string, SceneFailDetail> | null;
}

interface RuleWireStatus {
  rule_id: string;
  status: "BRIGHT" | "DIM" | "OUT" | "NOT_WIRED";
  fail_rate: number;
  rescue: number;
  detail: string | null;
}

interface CodeWireStatus {
  function_name: string;
  status: "ACTIVE" | "GAP" | "PARTIAL" | "N_A";
  detail: string | null;
}

interface PromptWireStatus {
  instruction: string;
  status: "BRIGHT" | "DIM" | "OUT";
  evidence: string | null;
}

interface FaultEntry {
  fault: string;
  class: string;
  root_cause: string; // the actual source of the failure
  symptom_locations: string[]; // sub-aims where it shows up (may be multiple)
  fix_type:
    | "prompt_edit"
    | "code_enforcer"
    | "harness_rule"
    | "scene_annotation"
    | "manual_rubric"
    | "accepted_no_action";
  owner: string;
  confidence: "high" | "medium" | "low";
  sub_aim: string;
  fix: string;
}

interface StabilityBand {
  rule_id: string;
  last_3_runs: number[];
  band_width: number;
  stable: boolean;
  real_change: boolean;
}
```

---

## 14. Console Circuit Board Format

This is the exact format printed after every harness run. Every aim, every sub-aim, every wire.

```
══════════════════════════════════════════════════════════════════════════════
AIM CIRCUIT BOARD — [version] [run_class] — [timestamp]
══════════════════════════════════════════════════════════════════════════════

[For each aim, in dependency order:]

══════════════════════════════════════════════════════════════════════════════
AIM [N] — [Name]                                        [● BRIGHT / ◐ DIM / ○ OUT]
══════════════════════════════════════════════════════════════════════════════
PURPOSE: [one line]
PRODUCTION RISK: [none / low / medium / high]
ANTI-AIMS:
  ✗ [each anti-aim]
DONE DEFINITION: [one line]
PASS LINE: [harness + manual thresholds]
──────────────────────────────────────────────────────────────────────────────

  SUB-AIMS
  ────────────────────────────────────────────────────────────────────────────

  [N.M] [Sub-aim name]                                   [lamp status]

      HARNESS RULES
        [rule_id]                      [lamp]  [fail%]  rescue=[%]
        [rule_id]                      [lamp]  [fail%]  rescue=[%]

      PROMPT RULES
        "[instruction summary]"        [lamp]
          Evidence: [what the output shows]

      CODE ENFORCEMENT
        [function_name]()              [lamp]
          Status: [ACTIVE / GAP / PARTIAL]
          [detail if not bright]

      STAGE PIPELINE
        A=[%] → B=[%] → C=[%] → D=[%]  rescue=[%]

      FAULT PATH (if not bright)
        Fault class:    [class]
        Root cause:     [the actual source — not where it appeared]
        Symptom at:     [sub-aim(s) where it shows up]
        Fault location: [specific location]
        Fix type:       [prompt_edit / code_enforcer / harness_rule /
                         scene_annotation / manual_rubric / accepted_no_action]
        Confidence:     [high/medium/low]
        Owner:          [prompt/code/harness/accepted]
        Fix:            [specific action]
        Trend:          [improving/stable/regressing/new]

  ────────────────────────────────────────────────────────────────────────────

[After all aims:]

══════════════════════════════════════════════════════════════════════════════
CIRCUIT SUMMARY
══════════════════════════════════════════════════════════════════════════════
[Table of all aims with lamp, prod risk, sub-aim count, issue count]

══════════════════════════════════════════════════════════════════════════════
POWER-ON DEPENDENCY ORDER
══════════════════════════════════════════════════════════════════════════════
[ASCII dependency graph]

══════════════════════════════════════════════════════════════════════════════
SCENE-CLASS BREAKDOWN
══════════════════════════════════════════════════════════════════════════════
Canonical scenes:  [overall lamp]  [detail]
Technical scenes:  [overall lamp]  [detail]
Dense scenes:      [overall lamp]  [detail]
Sparse scenes:     [overall lamp]  [detail]
Hostile scenes:    [overall lamp]  [detail]
Malformed scenes:  [overall lamp]  [detail]

══════════════════════════════════════════════════════════════════════════════
FAULT REGISTER
══════════════════════════════════════════════════════════════════════════════
[Table: fault, class, root_cause, symptom_locations, fix_type, owner, confidence, fix]

══════════════════════════════════════════════════════════════════════════════
STABILITY BANDS
══════════════════════════════════════════════════════════════════════════════
[Rules with real changes flagged; stable rules listed as stable]

══════════════════════════════════════════════════════════════════════════════
PRIORITY FIX ORDER
══════════════════════════════════════════════════════════════════════════════
[Numbered list of highest-impact fixes]
```

---

## 15. Build Phases

### Phase 1 — Foundation (Session 1)

**Deliverables:**

1. `src/data/call-2-aims/aim-registry.json` — the master aim/sub-aim/rule mapping
2. `src/lib/call-2-harness/aim-rollup.ts` — reads rule results, computes aim-level status
3. `src/lib/call-2-harness/circuit-printer.ts` — prints the console circuit board
4. Updated `src/lib/call-2-harness/mechanical-scorer/index.ts` — registers quality rules
5. Deploy `quality-rules.ts` — the 9 new content quality rules

**Verification:** Harness runs and prints aim circuit board. JSON includes `by_aim`.

### Phase 2 — Wiring (Session 2)

**Deliverables:**

1. `src/lib/call-2-harness/stability-tracker.ts` — stability bands across runs
2. `src/lib/call-2-harness/scene-class-separator.ts` — score breakdown by input class
3. Updated `scripts/run-harness.ts` — full circuit board output, fault register, stability bands
4. Updated `src/lib/call-2-harness/inventory-writer.ts` — write aim-level data to JSON
5. Scene tag updates in `scenes.json` — add `input_class` tag to every scene

**Verification:** Full circuit board output matches the format in Section 14.

### Phase 3 — Enforcement Gaps (Session 3)

**Deliverables:**

1. `stripT1CameraJargon()` or extended `enforceClipKeywordCleanup()` in harmony-compliance.ts
2. Extended `convertPhotographyJargonTierAware()` patterns for compound forms
3. `convertMeasurementsToVisual()` for numeric measurement cleanup
4. Updated route wiring for new enforcement functions

**Verification:** Run harness, confirm Aim 6 moves from DIM to BRIGHT on canonical scenes.

### Phase 4 — Gold Standards & Manual Protocol (Session 4)

**Deliverables:**

1. `src/data/call-2-aims/gold-standards.json` — hand-written reference T1/T3/T4 for 5 canonical scenes
2. `src/data/call-2-aims/manual-scorecard-template.json` — rubrics for every manual criterion
3. Manual scoring protocol documentation
4. First manual scoring pass on 5 canonical scenes

**Verification:** Manual scores recorded, compared against harness scores, discrepancies identified.

---

## 16. File Inventory — What Changes

### New Files

| File                                                        | Purpose                                 |
| ----------------------------------------------------------- | --------------------------------------- |
| `src/data/call-2-aims/aim-registry.json`                    | Master aim/sub-aim/rule mapping         |
| `src/data/call-2-aims/gold-standards.json`                  | Hand-written reference outputs          |
| `src/data/call-2-aims/manual-scorecard-template.json`       | Rubric definitions                      |
| `src/lib/call-2-harness/aim-rollup.ts`                      | Aim-level aggregation from rule results |
| `src/lib/call-2-harness/circuit-printer.ts`                 | Console circuit board formatter         |
| `src/lib/call-2-harness/stability-tracker.ts`               | Cross-run stability band tracking       |
| `src/lib/call-2-harness/scene-class-separator.ts`           | Score breakdown by input class          |
| `src/lib/call-2-harness/mechanical-scorer/quality-rules.ts` | 9 new content quality rules             |

### Modified Files

| File                                                | Changes                                                   |
| --------------------------------------------------- | --------------------------------------------------------- |
| `src/lib/call-2-harness/mechanical-scorer/index.ts` | Import and register quality rules                         |
| `src/lib/call-2-harness/inventory-writer.ts`        | Write aim-level data to JSON output                       |
| `scripts/run-harness.ts`                            | Call aim rollup, print circuit board, write expanded JSON |
| `src/data/call-2-scenes/scenes.json`                | Add `input_class` tag to every scene                      |
| `src/lib/harmony-compliance.ts`                     | Add `stripT1CameraJargon()`                               |
| `src/lib/harmony-post-processing.ts`                | Extend jargon patterns, add measurement conversion        |
| `src/app/api/generate-tier-prompts/route.ts`        | Wire new enforcement functions                            |

### Unchanged Files

| File                                                         | Why                                                       |
| ------------------------------------------------------------ | --------------------------------------------------------- |
| `src/lib/call-2-harness/rescue-dependency.ts`                | Working correctly, no changes needed                      |
| `src/lib/call-2-harness/diff.ts`                             | Working correctly, may extend later for aim-level diffing |
| `src/lib/call-2-harness/system-prompt-loader.ts`             | Working correctly                                         |
| `src/lib/call-2-harness/run-classes.ts`                      | Working correctly                                         |
| `src/lib/call-2-harness/scene-library.ts`                    | Working correctly                                         |
| `src/lib/call-2-harness/mechanical-scorer/t1-rules.ts`       | Existing rules preserved                                  |
| `src/lib/call-2-harness/mechanical-scorer/t2-rules.ts`       | Existing rules preserved                                  |
| `src/lib/call-2-harness/mechanical-scorer/t3-rules.ts`       | Existing rules preserved                                  |
| `src/lib/call-2-harness/mechanical-scorer/t4-rules.ts`       | Existing rules preserved                                  |
| `src/lib/call-2-harness/mechanical-scorer/types.ts`          | May need minor extension for aim types                    |
| `src/lib/call-2-harness/mechanical-scorer/coverage-rules.ts` | Already patched with conversion equivalents               |

---

## 17. Scene Library Gaps

### 17.1 Missing Scene Types

| Gap                                | Description                                    | Priority |
| ---------------------------------- | ---------------------------------------------- | -------- |
| Extremely long input (1000+ chars) | Tests compression under extreme pressure       | P2       |
| Contradictory input                | "Bright sunny" + "dark moody" in same scene    | P3       |
| Stuttered/repeated input           | "cat cat cat windowsill windowsill"            | P3       |
| Platform-syntax input              | User writes "(dragon:1.4), fire, (castle:1.2)" | P3       |
| Multi-language input               | Mixed English/other language                   | P3       |

### 17.2 Missing Element Annotations

22 of 42 scenes have no `expected_elements` annotation. These scenes skip coverage rules entirely. Priority scenes for annotation:

| Scene                          | Why                                       | Priority |
| ------------------------------ | ----------------------------------------- | -------- |
| cellist-abandoned-cathedral    | Interaction-dense, 10 rules exercised     | P1       |
| medieval-blacksmith-forge      | Fire, motion, character interactions      | P2       |
| violinist-on-paris-bridge-dusk | Human, music, urban, romantic             | P2       |
| single-tear-on-cheek           | Intimate, minimal — tests sparse handling | P2       |
| child-feeding-pigeons          | Action, interaction                       | P2       |

---

## 18. What This Document Does NOT Cover

- Call 1 (human text → category assessment)
- Call 3 (tier prompt → platform-specific prompt)
- UI/UX changes
- Stripe/Pro tier logic
- GA4/analytics
- SEO/authority pages

These are all separate engineering concerns. This document is Call 2 only.

---

## 19. Success Criteria

The rebuild is complete when:

1. All 15 aims have lamp status in the harness output
2. All 52 sub-aims are scored (wired or explicitly marked NOT_WIRED with reason)
3. Every harness rule maps to at least one aim
4. Every dim/out lamp has a fault class, owner, and fix path
5. 5 gold-standard scenes have reference outputs and manual scores
6. Stability bands are tracked across 3+ consecutive runs
7. Scene-class separation prevents edge-case noise from distorting production judgement
8. The circuit board output is the first thing you read after every run
9. Any engineer can look at the output and know exactly where the system is weak, why, and what to do about it

---

## 20. Existing Features Preserved: Yes

Nothing in the existing harness, enforcement, or route pipeline is removed. All changes are additive layers on top of the working v6.1 + code enforcement baseline. The 29 existing rules continue to run and score exactly as they do today. The aim rollup aggregates their results into a higher-level view — it does not replace them.

---

**End of document.**
