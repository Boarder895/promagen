# Phase C — Aim 6 Subsystem Build Plan

**Project:** Promagen API Call 2  
**Date:** 13 April 2026  
**Status:** Ready to build  
**Scope:** T1, T3 and T4 only  
**Target:** Make Aim 6 a real deterministic subsystem rather than a loose collection of helpers  
**Existing features preserved:** Yes

---

## 1. Purpose

Phase C builds the **Aim 6 subsystem**: the deterministic technical-input handling layer for Call 2.

This phase exists because technical scenes are still asking too much of the single GPT pass. The system already has partial conversion logic, but it is not yet strong enough or clearly bounded enough to own technical conversion reliably.

The goal is to move technical handling out of “best effort GPT interpretation” and into a **clear code-owned tier-aware subsystem**.

---

## 2. Current state in the codebase

The current production code already contains partial Phase C foundations.

### 2.1 Already present

The following functions already exist in the extracted source:

- `stripT1CameraJargon()` in `src/lib/harmony-compliance.ts`
- `convertPhotographyJargonTierAware()` in `src/lib/harmony-post-processing.ts`
- `convertMeasurementsToVisual()` in `src/lib/harmony-post-processing.ts`
- `postProcessTiers()` in `src/lib/harmony-post-processing.ts`

The route already imports the relevant functions in:

- `src/app/api/generate-tier-prompts/route.ts`

The harness already has the Aim 6 quality rules in:

- `src/lib/call-2-harness/mechanical-scorer/quality-rules.ts`

Coverage logic also already references technical conversion behaviour in:

- `src/lib/call-2-harness/mechanical-scorer/coverage-rules.ts`

### 2.2 Practical meaning

Phase C is **not** starting from zero.

This is now a **hardening and subsystem build** phase, not a greenfield phase.

That is good news because it means:

- the build can be narrow
- the harness is already waiting to measure it
- the risk is lower than a full rewrite

---

## 3. Problem statement

Even with the current helpers present, the technical lane is still not yet trustworthy enough.

The remaining issues are:

1. **T1 still leaks CLIP-unusable technical strings** in some technical scenes.
2. **T3/T4 numeric and jargon cleanup is only partially complete** and can miss mixed or compound forms.
3. **Technical conversion logic is spread across helpers rather than treated as a subsystem** with clear ownership and behaviour.
4. **Coverage truth can still be distorted** when conversions are valid but not fully recognised by the harness or scene annotations.
5. **The GPT pass is still carrying too much of the technical interpretation burden.**

---

## 4. Build goal

At the end of Phase C, Aim 6 should behave like a proper subsystem with these three lanes:

### T1 lane

- strip or demote CLIP-unusable camera hardware strings
- preserve useful visual scene content
- reduce non-visual literal waste
- avoid damaging normal non-technical T1 output

### T3 lane

- convert technical specs into visible effects
- convert numeric measurements into natural cinematic descriptions
- keep the result readable as visual-director prose

### T4 lane

- convert technical specs into short, plain, user-readable language
- prevent raw camera jargon leakage
- prevent raw numeric measurement leakage where visible-effect phrasing is possible
- stay compact enough to preserve T4 character discipline

---

## 5. Success criteria

Phase C is successful when:

1. T1 technical leakage is measurably lower or eliminated on technical scenes.
2. T3 and T4 no longer leak raw camera jargon or raw numeric measurements except for explicitly accepted edge cases.
3. Technical conversion becomes predictable across compound forms, not just isolated tokens.
4. Stage D improves without causing a broad regression in nativeness or coverage.
5. Manual review of technical scenes agrees with the harness trend.

---

## 6. Files in scope

### Primary build files

- `src/lib/harmony-compliance.ts`
- `src/lib/harmony-post-processing.ts`
- `src/app/api/generate-tier-prompts/route.ts`
- `src/app/api/dev/generate-tier-prompts/route.ts`

### Primary validation files

- `src/lib/call-2-harness/mechanical-scorer/quality-rules.ts`
- `src/lib/call-2-harness/mechanical-scorer/coverage-rules.ts`
- `src/lib/call-2-harness/mechanical-scorer/t1-rules.ts`
- `src/lib/call-2-harness/mechanical-scorer/t3-rules.ts`
- `src/lib/call-2-harness/mechanical-scorer/t4-rules.ts`
- `src/data/call-2-scenes/scenes.json`
- `src/hooks/use-tier-generation.ts`

### Supporting comparison inputs

- harness snapshots from prior runs
- technical scenes, especially Trafalgar Square and other camera-spec inputs

---

## 7. Build approach

Phase C should be built as **three narrow code improvements plus one validation pass**, not as a broad rewrite.

### 7.1 Workstream A — Harden T1 stripping

**Target file:** `src/lib/harmony-compliance.ts`

**Current state:** `stripT1CameraJargon()` already exists.

**Objective:** turn it from a good start into a reliable T1 lane cleaner.

#### Build tasks

1. Audit exactly what `stripT1CameraJargon()` currently removes, rewrites, or misses.
2. Expand detection for:
   - camera bodies
   - branded model names
   - focal lengths
   - aperture forms
   - compound forms such as `35mm Leica`, `35mm f/1.4`, `shot on Leica SL2-S`, `85mm portrait lens`
3. Decide the treatment mode per pattern:
   - strip entirely
   - demote to unweighted residue
   - rewrite to a visual consequence if safe
4. Ensure the function does **not** over-strip legitimate visual content around the technical token.
5. Ensure T1 remains compact, weighted, and CLIP-native after cleanup.

#### Success measure

Primary rules:

- `T1.no_clip_unusable_jargon`
- `T1.no_non_visual_literals`

Secondary checks:

- no new regressions in T1 nativeness
- no breakage to subject hierarchy or T1 ordering

---

### 7.2 Workstream B — Expand photography jargon conversion

**Target file:** `src/lib/harmony-post-processing.ts`

**Current state:** `convertPhotographyJargonTierAware()` already exists.

**Objective:** make it robust across compound and mixed technical phrases.

#### Build tasks

1. Audit current pattern coverage.
2. Add compound-pattern support for:
   - body + lens combinations
   - focal length + aperture combinations
   - brand + hardware forms
   - phrases that mix spec and visual outcome
3. Make tier outputs explicitly different:
   - T3: vivid visible-effect prose
   - T4: short plain-language phrasing
4. Preserve scene meaning rather than just scrubbing the token.
5. Keep outputs compact enough not to create avoidable T4 length pressure.

#### Success measure

Primary rules:

- `T3.no_raw_camera_jargon`
- `T4.no_raw_camera_jargon`

Secondary checks:

- manual conversion quality on technical scenes
- no flattening of T3 voice
- no over-explaining in T4

---

### 7.3 Workstream C — Strengthen measurement conversion

**Target file:** `src/lib/harmony-post-processing.ts`

**Current state:** `convertMeasurementsToVisual()` already exists.

**Objective:** make numeric cleanup preserve visible meaning, not merely remove digits.

#### Build tasks

1. Audit current measurement classes being handled.
2. Split measurement types into categories:
   - wind speed
   - directional language
   - visibility distances
   - focal length references
   - aperture references
   - exposure-style phrases if present
3. Define visible-effect mappings by tier:
   - T3: cinematic, visual, natural
   - T4: plain, short, understandable
4. Remove or rewrite raw forms like:
   - `15 km/h`
   - `south-westerly`
   - `f/1.4`
   - `35mm`
   when they are not appropriate raw output for the tier
5. Ensure conversion preserves scene value rather than creating generic mush.

#### Success measure

Primary rules:

- `T3.no_raw_numeric_measurements`
- `T4.no_raw_numeric_measurements`

Secondary checks:

- no unnecessary loss of scene detail
- no emptying of technical scenes into vague placeholders

---

### 7.4 Workstream D — Route wiring and order verification

**Target files:**

- `src/app/api/generate-tier-prompts/route.ts`
- `src/app/api/dev/generate-tier-prompts/route.ts`

**Objective:** confirm the Aim 6 subsystem runs in the right place and in the right order.

#### Build tasks

1. Verify where T1 stripping, jargon conversion and measurement conversion currently occur.
2. Confirm order relative to:
   - raw GPT output
   - post-processing
   - compliance enforcement
   - final Stage D return
3. Ensure all Aim 6 work is executed in both:
   - production route
   - dev route used by the harness
4. Eliminate any order where one cleaner reintroduces or masks another issue.

#### Success measure

- Stage A → Stage D movement should make sense
- no mismatch between production and harness routes
- no “works in prod but not in harness” or the reverse

---

## 8. Subsystem design rules

The Aim 6 subsystem must follow these rules:

### Rule 1 — Tier-aware by default

No generic one-size-fits-all technical cleanup.

T1, T3 and T4 have different goals and must not share the same raw output strategy.

### Rule 2 — Preserve visible meaning

Do not merely scrub. Convert where the technical input contains real visual value.

### Rule 3 — Strip only where CLIP cannot benefit

T1 should not carry dead mechanical tokens, but stripping must not destroy adjacent scene content.

### Rule 4 — Prefer compactness in T4

T4 must stay readable and plain. Avoid explanatory bloat.

### Rule 5 — Keep T3 cinematic

T3 must read like visual-director prose, not like a technical paraphrase.

### Rule 6 — Do not let cleanup hide measurement truth

If the harness still flags valid conversions as failures, that is a measurement or scene-definition issue, not an excuse to overfit the converter.

---

## 9. Regression risks to watch

### Risk A — Over-stripping in T1

Removing hardware terms too aggressively may delete useful visual anchors or collapse the T1 scene.

### Risk B — Over-generic conversion in T3/T4

Replacing specific technical inputs with vague generic language may improve rule pass rates while reducing actual scene value.

### Risk C — T4 length pressure

More detailed conversions may worsen T4 compression behaviour.

### Risk D — Harness mismatch

Valid converted outputs may still be scored poorly if coverage aliases or scene annotations are incomplete.

### Risk E — Route-order side effects

One cleanup step may interfere with a later enforcement step if the ordering is wrong.

---

## 10. Validation plan

### 10.1 Harness-first checks

Focus on these rules first:

- `T1.no_clip_unusable_jargon`
- `T1.no_non_visual_literals`
- `T3.no_raw_camera_jargon`
- `T3.no_raw_numeric_measurements`
- `T4.no_raw_camera_jargon`
- `T4.no_raw_numeric_measurements`

### 10.2 Scene focus

Use technical scenes first, especially those already known to expose leakage.

Priority scenes:

- Trafalgar Square technical scene
- other lens/camera/focal-length-heavy scenes
- any scene with mixed measurement language and visual content

### 10.3 Manual review

After harness review, manually inspect:

- whether visible meaning was preserved
- whether T3 still reads naturally
- whether T4 is still plain and compact
- whether T1 remains CLIP-native rather than simply shortened

### 10.4 Stability check

Do not overreact to one run.

Use the stability-band discipline and compare against prior snapshots to separate real improvement from noise.

---

## 11. Recommended build order

### Step 1

Audit current behaviour in the three existing functions.

### Step 2

Harden `stripT1CameraJargon()` first.

### Step 3

Expand `convertPhotographyJargonTierAware()` for compound forms.

### Step 4

Strengthen `convertMeasurementsToVisual()` with tier-aware mappings.

### Step 5

Verify route order in both prod and dev routes.

### Step 6

Run harness against technical scenes and compare to prior snapshots.

### Step 7

Only after Phase C is stable, narrow the GPT prompt in Phase B.

---

## 12. Out-of-scope for this phase

Phase C does **not** include:

- broad prompt rewrites
- T2 native generation
- full measurement-truth rework
- large scene-library refactoring
- UI work
- Call 3 changes

Those remain separate phases.

---

## 13. Final recommendation

Phase C should be treated as the **first real engineering sprint** of the new Call 2 doctrine.

It is the highest-leverage build phase because it removes predictable technical burden from GPT and gives deterministic ownership to code where the architecture already says that ownership belongs.

The correct sequence from here is:

- Phase A locked
- **Phase C built next**
- Phase B prompt narrowing only after Aim 6 coverage is strong enough

That is the safest and most efficient path to getting the system greener without creating an ownership gap.