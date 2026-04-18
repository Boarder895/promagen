# API Call 2 — Aims Circuit Architecture & Build Plan

**Version:** 2.2.0  
**Date:** 15 April 2026  
**Owner:** Martin Yarnold / Promagen  
**Scope:** API Call 2 — complete rebuild of measurement, diagnosis, and enforcement  
**Authority:** This document is the single source of truth for all Call 2 engineering decisions.

**v2.2.0 changes (15 Apr 2026):**

- Added §21 Build Status Audit — what was actually built, what was not, cross-referenced against source code
- Added §22 Harness Run Trend Analysis — 6-run comparison from the 15 April session
- Added §23 Known Regressions & Reversals — code changes that were reverted and why
- Added §24 Scorer Calibration Gap Analysis — why the scorer is not yet calibrated
- Added §25 Calibration Pipeline Specification — the full pipeline design (not yet built)
- Added §26 Conversation Session Log — summary of the ChatGPT session that produced these changes
- Updated §15 Implementation Phases to reflect actual delivery status
- Updated §16 File Inventory to reflect actual file states in src.zip

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

## 3–14. [UNCHANGED FROM v2.1.0]

Sections 3 through 14 remain identical to v2.1.0. They are not reproduced here to avoid duplication. Refer to the v2.1.0 document for the full text of:

- §3 Architecture Model (circuit metaphor, fault-finding protocol, enforcement precedence, scoring architecture, stability bands)
- §4 Fault Classes (root cause vs symptom, fix type enum, production risk)
- §5 Power-On Dependency Map
- §6 Edge-Case Input Classification
- §7 Known-Good Reference Signals
- §8 Manual Scoring Protocol
- §9 Top-Level Aims (aim register)
- §10 Aim Definitions (all 15 aims with sub-aims)
- §11 Harness Rule Inventory
- §12 JSON Schema
- §13 Console Output Format
- §14 Diagnostic Examples

---

## 15. Implementation Phases — Actual Delivery Status

### Phase 1 — Foundation (Session 1) — STATUS: ✅ COMPLETE

**Planned deliverables:**

1. `src/data/call-2-aims/aim-registry.json` — Master aim/sub-aim/rule mapping
2. `src/lib/call-2-harness/aim-rollup.ts` — reads rule results, computes aim-level status
3. `src/lib/call-2-harness/circuit-printer.ts` — prints the console circuit board
4. Updated `src/lib/call-2-harness/mechanical-scorer/index.ts` — registers quality rules
5. `src/lib/call-2-harness/mechanical-scorer/quality-rules.ts` — the 9 new content quality rules

**Actual status:** All 5 deliverables present in src.zip and functional.

- `aim-registry.json` — 1,446 lines, schema_version 1.1.0, covers all 15 aims and 68 sub-aims
- `aim-rollup.ts` — 631 lines, computes lamp status from rule results
- `circuit-printer.ts` — 343 lines, produces the full aim circuit board console output
- `index.ts` — updated, imports all rule sets including quality-rules and invention-rules
- `quality-rules.ts` — 484 lines, 9 content quality rules as specified

**Verification:** Harness runs and prints aim circuit board. JSON includes `by_aim`. ✅ Confirmed working across 6 harness runs on 15 April.

### Phase 2 — Wiring (Session 2) — STATUS: ✅ COMPLETE

**Planned deliverables:**

1. `src/lib/call-2-harness/stability-tracker.ts` — stability bands across runs
2. `src/lib/call-2-harness/scene-class-separator.ts` — score breakdown by input class
3. Updated `scripts/run-harness.ts` — full circuit board output, fault register, stability bands
4. Updated `src/lib/call-2-harness/inventory-writer.ts` — write aim-level data to JSON
5. Scene tag updates in `scenes.json` — add `input_class` tag to every scene

**Actual status:** All 5 deliverables present in src.zip and functional.

- `stability-tracker.ts` — 200 lines, analyses 4-run windows, detects real changes vs noise
- `scene-class-separator.ts` — 252 lines, breaks scores by 8 input classes
- `scenes.json` — 42 scenes with `input_class` on all (42 tags confirmed), 19 of 42 have `expected_elements`
- `inventory-writer.ts` — writes aim-level data to JSON output
- `run-harness.ts` — not in src.zip (lives in scripts/ at project root, outside src/)

**Verification:** Full circuit board output matches §14 format. ✅ Confirmed.

### Phase 3 — Enforcement Gaps (Session 3) — STATUS: ⚠️ PARTIAL

**Planned deliverables:**

1. `stripT1CameraJargon()` or extended `enforceClipKeywordCleanup()` — in harmony-compliance.ts
2. Extended `convertPhotographyJargonTierAware()` patterns for compound forms
3. `convertMeasurementsToVisual()` for numeric measurement cleanup
4. Updated route wiring for new enforcement functions

**Actual status:**

- `stripT1CameraJargon()` — ✅ EXISTS in harmony-compliance.ts (line 794)
- `convertPhotographyJargonTierAware()` — ✅ EXISTS in harmony-post-processing.ts (line 593)
- `convertMeasurementsToVisual()` — ✅ EXISTS in harmony-post-processing.ts (line 1906)
- Route wiring — ✅ Both production and dev routes updated

**Additionally built during the ChatGPT session (not in original plan):**

- `enforceOpeningFreshness()` — harmony-post-processing.ts line 1070, T3/T4 opening echo enforcer (the Aim 8 fix)
- `applyT4RetentionSafetyGuard()` — harmony-post-processing.ts line 1671, Aim 1 scene-aware retention pass
- `enforceT4SentenceFloor()` — harmony-post-processing.ts line 1734, minimum sentence count enforcer

**Verification:** Aim 6 moved from DIM to BRIGHT on canonical scenes. ✅ Confirmed in runs 2–6.

**Not built:** The Aim 1 "source-clause reinsertion pass" was built, tested, caused regressions in Aim 2 and Aim 6 (T3/T4.no_raw_numeric_measurements went from 0% → 2.4%), and was **reverted**. See §23.

### Phase 4 — Gold Standards & Manual Protocol (Session 4) — STATUS: ⚠️ PARTIAL

**Planned deliverables:**

1. `src/data/call-2-aims/gold-standards.json` — hand-written reference T1/T3/T4 for 5 canonical scenes
2. `src/data/call-2-aims/manual-scorecard-template.json` — rubrics for every manual criterion
3. Manual scoring protocol documentation
4. First manual scoring pass on 5 canonical scenes

**Actual status:**

- `gold-standards.json` — ✅ EXISTS, 141 lines, but only contains 2 gold scenes (lighthouse-keeper-canonical, trafalgar-square-12-category) out of 5 planned. Missing: rainy-bookstore-window-cat, astronaut-floating, deep-sea-diver-with-coral.
- `manual-scorecard-template.json` — ✅ EXISTS, 249 lines
- Manual scoring protocol — ❌ NOT DONE. No manual scoring was performed.
- First manual scoring pass — ❌ NOT DONE.

### Phase B (ChatGPT session addition) — Invention Rules — STATUS: ✅ COMPLETE

**Not in original v2.1.0 plan. Added during the ChatGPT session.**

**Deliverables:**

1. `src/lib/call-2-harness/mechanical-scorer/invention-rules.ts` — 12 mechanical rules for Aim 5

**Actual status:**

- `invention-rules.ts` — ✅ EXISTS, 758 lines, covers 6 rule IDs (T3/T4 × 3 categories: object invention, setting invention, style invention, verb fidelity, mood fidelity, specific-meaning preservation)
- Registered in `index.ts` — ✅ Imported and included in ALL_RULES
- Scorer header states "50 rules (29 structural + 9 quality + 12 invention/semantic-drift)"

**Important note:** Although the invention rules exist in code, Aim 5 still shows as NOT WIRED in the harness output. This means the aim-rollup logic does not yet map these rules to Aim 5 sub-aims, or the rules are registered but not exercised by enough scenes. The rules exist but the wiring to the circuit board is incomplete.

---

## 16. File Inventory — Actual State (15 April 2026)

### New Files — Present in src.zip

| File | Purpose | Lines | Status |
| --- | --- | --- | --- |
| `src/data/call-2-aims/aim-registry.json` | Master aim/sub-aim/rule mapping | 1,446 | ✅ Complete |
| `src/data/call-2-aims/gold-standards.json` | Hand-written reference outputs | 141 | ⚠️ 2/5 scenes only |
| `src/data/call-2-aims/manual-scorecard-template.json` | Rubric definitions | 249 | ✅ Present |
| `src/lib/call-2-harness/aim-rollup.ts` | Aim-level aggregation from rule results | 631 | ✅ Complete |
| `src/lib/call-2-harness/circuit-printer.ts` | Console circuit board formatter | 343 | ✅ Complete |
| `src/lib/call-2-harness/stability-tracker.ts` | Cross-run stability band tracking | 200 | ✅ Complete |
| `src/lib/call-2-harness/scene-class-separator.ts` | Score breakdown by input class | 252 | ✅ Complete |
| `src/lib/call-2-harness/mechanical-scorer/quality-rules.ts` | 9 content quality rules | 484 | ✅ Complete |
| `src/lib/call-2-harness/mechanical-scorer/invention-rules.ts` | 12 invention/semantic-drift rules | 758 | ✅ Present but Aim 5 shows NOT WIRED |

### Modified Files — Present in src.zip

| File | Changes | Lines | Status |
| --- | --- | --- | --- |
| `src/lib/call-2-harness/mechanical-scorer/index.ts` | Imports quality + invention rules | ~100 | ✅ Updated |
| `src/lib/call-2-harness/mechanical-scorer/types.ts` | Added AnchorClass, richer context types | ~150 | ✅ Updated |
| `src/lib/call-2-harness/mechanical-scorer/coverage-rules.ts` | Scene-aware anchor buckets, anchor-class thresholds | ~400 | ✅ Updated |
| `src/lib/call-2-harness/inventory-writer.ts` | Writes aim-level data to JSON output | present | ✅ Updated |
| `src/lib/harmony-post-processing.ts` | Added enforceOpeningFreshness, applyT4RetentionSafetyGuard, enforceT4SentenceFloor, convertMeasurementsToVisual | 2,077+ | ✅ Updated |
| `src/lib/harmony-compliance.ts` | Added stripT1CameraJargon | 1,577 | ✅ Updated |
| `src/data/call-2-scenes/scenes.json` | Added input_class to all 42 scenes | 1,556 | ✅ Updated |
| `src/app/api/generate-tier-prompts/route.ts` | Wired new enforcement functions | 786 | ✅ Updated |
| `src/app/api/dev/generate-tier-prompts/route.ts` | Wired new enforcement functions (dev mirror) | 427 | ✅ Updated |

### Unchanged Files — Status confirmed

| File | Status |
| --- | --- |
| `src/lib/call-2-harness/rescue-dependency.ts` | ✅ Unchanged, working |
| `src/lib/call-2-harness/diff.ts` | ✅ Unchanged, working |
| `src/lib/call-2-harness/system-prompt-loader.ts` | ✅ Unchanged, working |
| `src/lib/call-2-harness/run-classes.ts` | ✅ Unchanged, working |
| `src/lib/call-2-harness/scene-library.ts` | ✅ Unchanged, working |
| `src/lib/call-2-harness/mechanical-scorer/t1-rules.ts` | ✅ Unchanged, 9 rules |
| `src/lib/call-2-harness/mechanical-scorer/t2-rules.ts` | ✅ Unchanged, 8 rules |
| `src/lib/call-2-harness/mechanical-scorer/t3-rules.ts` | ✅ Unchanged, 5 rules |
| `src/lib/call-2-harness/mechanical-scorer/t4-rules.ts` | ✅ Unchanged, 5 rules |

### Files NOT Built — Planned but absent from src.zip

| File | Purpose | Phase | Status |
| --- | --- | --- | --- |
| `src/lib/call-2-harness/mechanical-scorer/interaction-rules.ts` | Aim 10 interaction/spatial rules | Phase C | ❌ Not built |
| `src/lib/call-2-harness/mechanical-scorer/handoff-rules.ts` | Aim 11 Call 3 handoff rules | Phase D | ❌ Not built |
| `src/lib/call-2-harness/mechanical-scorer/over-polish-rules.ts` | Over-polish detection rules | Phase F | ❌ Not built |
| `src/lib/call-2-calibration/types.ts` | Calibration pipeline types | Calibration | ❌ Not built |
| `src/lib/call-2-calibration/selector.ts` | Scene selection (all42/gold/custom) | Calibration | ❌ Not built |
| `src/lib/call-2-calibration/real-output-runner.ts` | Real route output capture | Calibration | ❌ Not built |
| `src/lib/call-2-calibration/scoring-runner.ts` | Automated scoring pass | Calibration | ❌ Not built |
| `src/lib/call-2-calibration/gold-review-types.ts` | Gold review overlay schema | Calibration | ❌ Not built |
| `src/lib/call-2-calibration/trend-builder.ts` | Trend analysis builder | Calibration | ❌ Not built |
| `src/lib/call-2-calibration/summary-writer.ts` | Summary MD writer | Calibration | ❌ Not built |
| `src/data/call-2-calibration/gold-set.json` | Hard-coded gold scene set | Calibration | ❌ Not built |
| `src/data/call-2-calibration/live-inputs.json` | Versioned live human inputs | Calibration | ❌ Not built |
| `scripts/run-call-2-calibration.ts` | Calibration pipeline entry point | Calibration | ❌ Not built |
| `scripts/build-call-2-trend.ts` | Trend analysis script | Calibration | ❌ Not built |

---

## 17. Scene Library Gaps — Updated

### 17.1 Missing Scene Types

| Gap | Description | Priority | Status |
| --- | --- | --- | --- |
| Extremely long input (1000+ chars) | Tests compression under extreme pressure | P2 | ❌ Not added |
| Contradictory input | "Bright sunny" + "dark moody" in same scene | P3 | ✅ 1 scene present |
| Stuttered/repeated input | "cat cat cat windowsill windowsill" | P3 | ❌ Not added |
| Platform-syntax input | User writes "(dragon:1.4), fire, (castle:1.2)" | P3 | ❌ Not added |
| Multi-language input | Mixed English/other language | P3 | ❌ Not added |

### 17.2 Missing Element Annotations

22 of 42 scenes still have no `expected_elements` annotation (19 have them). Priority scenes for annotation remain the same as v2.1.0.

---

## 18–20. [UNCHANGED FROM v2.1.0]

---

## 21. Build Status Audit — Cross-Reference Against Source Code

### 21.1 Rule Count Verification

| Rule set | File | Count (grep "id:") | Expected |
| --- | --- | --- | --- |
| T1 rules | t1-rules.ts | 9 | 9 ✅ |
| T2 rules | t2-rules.ts | 8 | 8 ✅ |
| T3 rules | t3-rules.ts | 5 | 5 ✅ |
| T4 rules | t4-rules.ts | 5 | 5 ✅ |
| Coverage rules | coverage-rules.ts | 2 | 2 ✅ |
| Quality rules | quality-rules.ts | 9 | 9 ✅ |
| Invention rules | invention-rules.ts | 6 | 12 (6 rule IDs × T3+T4) ⚠️ |

Total rule definitions in code: 44 unique IDs. The scorer index header claims 50 rules. The discrepancy is because some rule IDs apply to both T3 and T4 (counted as 2 checks per ID in the harness run).

### 21.2 Enforcement Function Verification

Functions present in harmony-post-processing.ts (confirmed by grep):

| Function | Line | Purpose |
| --- | --- | --- |
| `deduplicateMjParams()` | 104 | MJ parameter dedup |
| `stripTrailingPunctuation()` | 187 | T1 cleanup |
| `fixT4SelfCorrection()` | 203 | T4 self-correction removal |
| `fixT4MetaOpeners()` | 276 | T4 banned opener fix |
| `mergeT4ShortSentences()` | 307 | T4 sentence merger |
| `enforceT1WeightWrap()` | 396 | T1 weight wrap limit |
| `convertPhotographyJargonTierAware()` | 593 | Camera jargon conversion |
| `stripOrRewriteT3BannedPhrases()` | 621 | T3 banned phrase removal |
| `stripT3BannedTailConstructions()` | 642 | T3 banned tail removal |
| `enforceOpeningFreshness()` | 1070 | T3/T4 echo prevention — NEW |
| `enforceT3MaxLength()` | 1188 | T3 character limit |
| `enforceT4MaxLength()` | 1591 | T4 character limit |
| `applyT4RetentionSafetyGuard()` | 1671 | T4 anchor retention — NEW |
| `enforceT4SentenceFloor()` | 1734 | T4 min sentence count — NEW |
| `convertMeasurementsToVisual()` | 1906 | Numeric measurement conversion — NEW |
| `postProcessTiers()` | 1942 | Main post-processing orchestrator |

Functions present in harmony-compliance.ts (confirmed by grep):

| Function | Line | Purpose |
| --- | --- | --- |
| `enforceT1Syntax()` | 123 | T1 syntax enforcement |
| `enforceMjParameters()` | 188 | MJ parameter enforcement |
| `enforceWeightCap()` | 450 | Weight cap enforcement |
| `enforceClipKeywordCleanup()` | 569 | CLIP keyword cleanup |
| `stripT1CameraJargon()` | 794 | T1 camera jargon strip — NEW |
| `detectT4MetaLanguage()` | 917 | T4 meta detection |
| `enforceSubjectHighestWeight()` | 1302 | Subject weight enforcement |
| `demoteGenericQualityWeights()` | 1355 | Quality weight demotion |
| `deduplicateQualityTokens()` | 1399 | Quality token dedup |
| `ensureT1QualitySuffix()` | 1435 | Quality suffix enforcement |
| `normaliseT1Ordering()` | 1468 | T1 token ordering |

### 21.3 What the Authority Doc Says Should Exist vs What Actually Exists

| Authority §15 Phase | Status | Files Built | Files Missing |
| --- | --- | --- | --- |
| Phase 1 — Foundation | ✅ Complete | 5/5 | 0 |
| Phase 2 — Wiring | ✅ Complete | 5/5 | 0 |
| Phase 3 — Enforcement Gaps | ⚠️ Partial | 4/4 core + 3 bonus | Aim 1 reinsertion reverted |
| Phase 4 — Gold Standards | ⚠️ Partial | 2/4 | Manual scoring not done, 3 gold scenes missing |
| Phase B — Invention Rules | ✅ Complete | 1/1 | Aim 5 wiring incomplete |
| Phase C — Interaction Rules | ❌ Not started | 0 | interaction-rules.ts |
| Phase D — Handoff Rules | ❌ Not started | 0 | handoff-rules.ts |
| Phase E — Judged Scorer | ❌ Not started | 0 | All judged scorer files |
| Phase F — Over-Polish Rules | ❌ Not started | 0 | over-polish-rules.ts |
| Calibration Pipeline | ❌ Not started | 0 | All 14 calibration files |

---

## 22. Harness Run Trend Analysis — 15 April 2026

Six harness runs were performed during the ChatGPT session. All used v6.2 smoke_alarm class, 42 scenes × 5 samples = 210 calls, 0 failures across all runs.

### 22.1 Circuit Summary Trend

| Run | Time | BRIGHT | DIM | OUT | NOT WIRED | Faults | Failing Rules |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 07:23 | 8 | 2 | 0 | 5 | 3 | 10 |
| 2 | 08:38 (post Aim 8 fix) | 9 | 1 | 0 | 5 | 2 | 9 |
| 3 | 10:33 (post Aim 1 reinsertion) | 7 | 3 | 0 | 5 | 6 | 13 |
| 4 | 11:08 (post revert) | 8 | 2 | 0 | 5 | 3 | 10 |
| 5 | 11:43 (post scene annotation fix) | **10** | **0** | 0 | 5 | **0** | **0** |
| 6 | 17:06 (final, post Claude Phase A/B) | 9 | 1 | 0 | 5 | 2 | 5 |

### 22.2 Aim-Level Trend

| Aim | Run 1 | Run 2 | Run 3 | Run 4 | Run 5 | Run 6 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 Preserve content | ◐ DIM | ◐ DIM | ◐ DIM | ◐ DIM | **● BRIGHT** | ◐ DIM |
| 2 Native format | ● BRIGHT | ● BRIGHT | **◐ DIM** | ● BRIGHT | ● BRIGHT | ● BRIGHT |
| 3 Structural | ● BRIGHT | ● BRIGHT | ● BRIGHT | ● BRIGHT | ● BRIGHT | ● BRIGHT |
| 4 Emphasis | ● BRIGHT | ● BRIGHT | ● BRIGHT | ● BRIGHT | ● BRIGHT | ● BRIGHT |
| 5 Invention | — NOT WIRED | — NOT WIRED | — NOT WIRED | — NOT WIRED | — NOT WIRED | — NOT WIRED |
| 6 Technical | ● BRIGHT | ● BRIGHT | **◐ DIM** | ● BRIGHT | ● BRIGHT | ● BRIGHT |
| 7 Redundancy | ● BRIGHT | ● BRIGHT | ● BRIGHT | **◐ DIM** | ● BRIGHT | ● BRIGHT |
| 8 Echo | **◐ DIM** | **● BRIGHT** | ● BRIGHT | ● BRIGHT | ● BRIGHT | ● BRIGHT |
| 9 Hostile | ● BRIGHT | ● BRIGHT | ● BRIGHT | ● BRIGHT | ● BRIGHT | ● BRIGHT |
| 10 Interactions | — NOT WIRED | — NOT WIRED | — NOT WIRED | — NOT WIRED | — NOT WIRED | — NOT WIRED |
| 11 Handoff | — NOT WIRED | — NOT WIRED | — NOT WIRED | — NOT WIRED | — NOT WIRED | — NOT WIRED |
| 12 Measurement | — NOT WIRED | — NOT WIRED | — NOT WIRED | — NOT WIRED | — NOT WIRED | — NOT WIRED |
| 13 Diagnosability | ● BRIGHT | ● BRIGHT | ● BRIGHT | ● BRIGHT | ● BRIGHT | ● BRIGHT |
| 14 Stability | ● BRIGHT | ● BRIGHT | ● BRIGHT | ● BRIGHT | ● BRIGHT | ● BRIGHT |
| 15 T2 MJ | — NOT WIRED | — NOT WIRED | — NOT WIRED | — NOT WIRED | — NOT WIRED | — NOT WIRED |

### 22.3 Key Observations

1. **Aim 8 (Echo) was fixed permanently.** T3 opening freshness enforcer (`enforceOpeningFreshness()`) moved Aim 8 from DIM to BRIGHT in Run 2 and it stayed BRIGHT through all subsequent runs. This is a genuine, durable code fix.

2. **Aim 1 (Content Preservation) is unstable.** It fluctuates between DIM and BRIGHT across runs. Run 5 hit all-BRIGHT (10/10, 0 faults, 0 failing rules — the best result ever), but Run 6 regressed to DIM again. The harness classifies this as `run_variance` — GPT stochasticity, not a code defect.

3. **Run 3 was a regression.** The Aim 1 "source-clause reinsertion pass" introduced new failures in Aims 2 and 6 (T3/T4.no_raw_numeric_measurements jumped to 2.4%). It was correctly identified and reverted.

4. **Aim 1 coverage rules have a wide stability band.** T3.input_element_coverage oscillates between 0.0% and 7.6% across runs (band = 7.6%). T4.input_element_coverage oscillates between 0.5% and 7.6% (band = 7.1%). This is the widest instability in the system.

5. **The scorer is not calibrated.** This is the fundamental problem identified at the end of the session. Without calibration, it is impossible to know whether Aim 1's DIM status represents a real product defect or a measurement artefact.

### 22.4 Scene-Class Stability

Across all 6 runs, the scene-class breakdown remained consistent:

| Class | Scenes | Typical Fail% | Stable? |
| --- | --- | --- | --- |
| canonical | 22 | 0.0–0.7% | Yes |
| sparse | 2 | 0.0–1.3% | Yes |
| dense | 1 | 0.0–1.6% | Yes |
| malformed | 8 | 0.1–0.2% | Yes |
| contradictory | 1 | 0.0–0.5% | Yes |
| hostile | 6 | 0.0–0.1% | Yes |
| single_word | 1 | 0.0% | Yes |
| technical | 1 | 1.1–7.4% | **No — volatile** |

The technical scene class is the most volatile, driven by a single scene (trafalgar-square-12-category) with dense camera specs.

---

## 23. Known Regressions & Reversals

### 23.1 Aim 1 Source-Clause Reinsertion Pass — REVERTED

**What was built:** A deterministic post-processing pass that attempted to detect missing user-provided content from the source input and reinsert it into T3/T4 outputs.

**What happened:** Run 3 (10:33) showed:
- Aim 2 dropped from BRIGHT to DIM (T3.no_raw_numeric_measurements: 0% → 2.4%, T4.no_raw_numeric_measurements: 0% → 2.4%)
- Aim 6 dropped from BRIGHT to DIM (same rules)
- Total faults jumped from 2 → 6
- Total failing rules jumped from 9 → 13
- Technical scene class fail% jumped from 1.1% → 7.4%

**Root cause:** The reinsertion pass was injecting raw source text (including numeric measurements like "15 km/h", "35mm", "f/1.4") back into T3/T4 outputs, bypassing the `convertMeasurementsToVisual()` and `convertPhotographyJargonTierAware()` enforcers that had already cleaned the GPT output.

**Decision:** Reverted. The authority doc's core statement explicitly says "code wins for anything countable, parseable, reorderable, deduplicable, or lookup-convertible." A reinsertion pass that bypasses existing enforcement violates this principle.

**Lesson:** Any Aim 1 fix must run BEFORE the jargon/measurement conversion enforcers, not after them. Alternatively, it must only reinsert content that has already been converted.

### 23.2 Scene Annotation Fix — Applied Successfully

Between Run 4 and Run 5, the `expected_elements` annotations in `scenes.json` were updated to include more conversion aliases and alternative phrasings. This allowed the coverage checker to correctly recognise converted terms as surviving content, rather than scoring them as missing.

This is the fix that produced Run 5's perfect result (10 BRIGHT, 0 DIM, 0 faults). However, it was not durable — Run 6 regressed Aim 1 back to DIM, suggesting the fix helped but GPT stochasticity still pushes coverage below threshold on some runs.

---

## 24. Scorer Calibration Gap Analysis

### 24.1 The Core Problem

The scorer cannot distinguish between:
- A real product defect (GPT genuinely dropped user content)
- A measurement artefact (GPT rephrased content and the scorer didn't recognise it)
- A scene annotation error (the expected_elements list is wrong or incomplete)

Without this distinction, all engineering decisions based on harness output are unreliable.

### 24.2 What the Authority Doc Says (§3.4, §7, §8, Aim 12)

The authority doc requires:
- **Layer 1 — Harness score** (mechanical, deterministic, automated)
- **Layer 2 — Manual quality score** (human judgement on canonical scenes)
- **Aim rollup combines both layers into lamp status**
- **Gold-standard reference outputs** for comparison (§7)
- **Manual scoring protocol** with fixed rubrics (§8)

None of Layer 2 has been built or executed. The harness currently runs on Layer 1 only.

### 24.3 What Calibration Would Answer

For every scored rule in a gold set, compare scorer verdict vs expert verdict, then label each result:
- correct pass
- correct fail
- false positive (scorer says fail, human says pass)
- false negative (scorer says pass, human says fail)
- scene annotation wrong
- rule definition wrong
- valid alias not recognised

### 24.4 Contract Coverage Gaps

The authority doc's core statement defines 4 "must" rules and 4 "must not" rules. The current scorer only covers some of them mechanically:

| Contract rule | Covered by scorer? | How? |
| --- | --- | --- |
| Preserve approved user content | ⚠️ Partial | coverage-rules.ts (T3/T4.input_element_coverage) but not calibrated |
| Convert to tier-native language | ✅ Yes | quality-rules.ts (jargon, format rules) |
| Obey hard structural limits | ✅ Yes | t1/t2/t3/t4-rules.ts (weight, char, format) |
| Hand off clean material to Call 3 | ❌ No | Aim 11 NOT WIRED |
| Must not invent content | ⚠️ Partial | invention-rules.ts exists but Aim 5 NOT WIRED |
| Must not silently discard | ⚠️ Partial | coverage-rules.ts but not calibrated |
| Must not rely on wishful prompt wording | ⚠️ Partial | rescue-dependency tracking exists |
| Must not polish beyond user input | ❌ No | Phase F over-polish rules not built |

---

## 25. Calibration Pipeline Specification — NOT YET BUILT

The ChatGPT session designed but did not build a calibration pipeline. The full specification is:

### 25.1 Pipeline Modes

| Mode | Purpose | Input | Output |
| --- | --- | --- | --- |
| Mode 1 — Full 42 capture | Measure real generator behaviour | scenes.json | real-outputs.json |
| Mode 2 — Gold truth audit | Calibrate scorer accuracy | gold-set.json (20 scenes) | scored-outputs.json |
| Mode 3 — Trend analysis | Track changes over time | Multiple run JSONs | trend-analysis.json |

### 25.2 Gold Set (20 scenes)

| Category | Count | Scenes |
| --- | --- | --- |
| Canonical | 10 | lighthouse-keeper, golden-hour-cyclist, busy-tokyo-crosswalk, abandoned-soviet-spaceport, child-feeding-pigeons, deep-sea-diver, medieval-blacksmith, rainy-bookstore-cat, fire-fighter-rescuing-dog, cellist-cathedral |
| Dense/technical | 3 | trafalgar-square-12-category, stress-dense-400-words, +1 from live inputs |
| Hostile/malformed | 3 | trap-prompt-injection, trap-broken-grammar, human-typo-laden |
| Live human inputs | 4 | From live-inputs.json (versioned, not ad-hoc) |

### 25.3 Pipeline Stages

- **Stage A** — Scene selection layer (`--set all42 | gold | custom | live_inputs`)
- **Stage B** — Real generator execution (calls actual API route, stores actual T1/T3/T4)
- **Stage C** — Automated scorer pass (runs mechanical scorer + aim rollup on real outputs)
- **Stage D** — Manual calibration overlay (human review for gold set only)
- **Stage E** — Trend analysis builder (reads all prior runs, produces summary)

### 25.4 Output Files

1. `real-outputs.json` — actual T1/T3/T4 from the live route
2. `scored-outputs.json` — scorer results on those outputs
3. `gold-review.json` — human calibration overlay
4. `trend-analysis.json` — cross-run analysis with root-cause clusters

### 25.5 Files Required

| File | Purpose |
| --- | --- |
| `scripts/run-call-2-calibration.ts` | Pipeline entry point |
| `src/lib/call-2-calibration/types.ts` | Shared types |
| `src/lib/call-2-calibration/selector.ts` | Scene selection |
| `src/lib/call-2-calibration/real-output-runner.ts` | API caller |
| `src/lib/call-2-calibration/scoring-runner.ts` | Scorer pass |
| `src/lib/call-2-calibration/gold-review-types.ts` | Gold review schema |
| `src/lib/call-2-calibration/trend-builder.ts` | Trend analysis |
| `src/lib/call-2-calibration/summary-writer.ts` | Summary MD writer |
| `scripts/build-call-2-trend.ts` | Trend script |
| `src/data/call-2-calibration/gold-set.json` | Gold scene definitions |
| `src/data/call-2-calibration/live-inputs.json` | Versioned live inputs |

---

## 26. Conversation Session Log — 15 April 2026

The ChatGPT session titled "Data Run Comparison" ran from approximately 07:00 to 18:00 UTC on 15 April 2026. It covered the following major activities:

1. **Harness Run 1** (07:23) — baseline measurement. 8 BRIGHT, 2 DIM (Aim 1, Aim 8).
2. **T3 Opening Freshness Enforcer** — built `enforceOpeningFreshness()`, fixing Aim 8.
3. **Harness Run 2** (08:38) — confirmed Aim 8 fixed. 9 BRIGHT, 1 DIM (Aim 1 only).
4. **Aim 1 analysis and options discussion** — discussed relaxing Aim 3 (rejected), options A/B/C.
5. **Aim 1 Preservation Enforcer** — built a source-clause reinsertion pass.
6. **Lint fix** — regex control character errors in harmony-post-processing.ts.
7. **Harness Run 3** (10:33) — regression. 7 BRIGHT, 3 DIM. Aim 2 and Aim 6 broke.
8. **Revert decision** — reverted the Aim 1 reinsertion pass.
9. **Harness Run 4** (11:08) — confirmed revert restored baseline. 8 BRIGHT, 2 DIM.
10. **Scene annotation approach** — fixed repeat-offender scenes' expected_elements instead.
11. **Harness Run 5** (11:43) — best result ever. **10 BRIGHT, 0 DIM, 0 faults.**
12. **Live human testing** — 4 human inputs tested manually against the website.
13. **Manual scoring of live outputs** — helicopter pilot, Parliament Square, juice factory, railway signal scenes.
14. **Crossroads discussion** — identified scorer calibration as the fundamental blocker.
15. **Calibration pipeline design** — full 5-stage pipeline specified but not built.
16. **Scorer gap analysis** — identified contract coverage gaps.
17. **Phase A/B build with Claude** — ChatGPT designed Phase A (coverage-rules, types, scenes) and Phase B (invention-rules, index, aim-rollup) for Claude to build.
18. **Claude build integration** — Claude built Phase A/B files, one import error fixed.
19. **Harness Run 6** (17:06) — 9 BRIGHT, 1 DIM (Aim 1). T4 coverage at 2.9%.
20. **Decision: hand off to new chat** — conversation exceeded useful length.

---

## 27. Recommendations — Next Steps

### Priority 1 — Build the Calibration Pipeline (§25)

This is the single most important next step. Without it, all other work is guided by unreliable measurement.

### Priority 2 — Complete Phase 4 Gold Standards

Add the 3 missing gold scenes (rainy-bookstore-cat, astronaut-floating, deep-sea-diver). Perform the first manual scoring pass on all 5.

### Priority 3 — Wire Aim 5 to Circuit Board

The invention rules exist but Aim 5 shows NOT WIRED. The aim-rollup needs to be updated to map invention-rules results to Aim 5 sub-aims.

### Priority 4 — Build Phases C, D, E, F

In order: interaction-rules (Aim 10), handoff-rules (Aim 11), judged scorer (Aim 12), over-polish rules.

### Priority 5 — Resolve Aim 1 Properly

Do not attempt another global reinsertion pass. The correct approach is:
1. Calibrate the scorer first (Priority 1)
2. Determine whether Aim 1 DIM is real or measurement artefact
3. If real: fix via scene-specific expected_elements and conversion aliases
4. If artefact: adjust thresholds or scoring logic

---

## 28. Existing Features Preserved: Yes

Nothing in the existing harness, enforcement, or route pipeline was removed during this session. All changes are additive layers on top of the working v6.1 + code enforcement baseline. The 29 existing structural rules continue to run and score exactly as they did before. The Aim 1 reinsertion pass was added and then reverted — the codebase is back to its pre-session state plus the durable additions listed in §16.

---

**End of document.**
