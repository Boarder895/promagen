# Prompt Optimisation Trend Analysis

**Version:** 3.0.0  
**Created:** 25 March 2026  
**Updated:** 26 March 2026  
**Owner:** Promagen  
**Status:** Living document — updated every test round  
**Authority:** This document tracks scoring trends across all harmony rounds for the 4 generic tier outputs (Call 2) and platform-specific optimised outputs (Call 3). It is the single source of truth for deciding when to intervene on the generic tiers.

**Cross-references:**

- `ai-disguise.md` — Call 2 (tier generation) and Call 3 (optimisation) architecture
- `harmonizing-claude-openai.md` — Dual-assessor methodology, scoring criteria
- `grouping-45-image-platforms-by-prompt-compatibility.md` — Platform group definitions
- `harmony-compliance.ts` — Compliance gates (enforceT1Syntax, enforceMjParameters, enforceWeightCap, enforceClipKeywordCleanup)
- `lib/optimise-prompts/` — Group-specific system prompt builders

---

## 1. Scoring Methodology

### Assessors

| Assessor       | Role                        | Bias                                                                      |
| -------------- | --------------------------- | ------------------------------------------------------------------------- |
| **Claude**     | Platform compliance scorer  | Penalises weight bloat, syntax errors, CLIP architectural violations      |
| **ChatGPT**    | Image output quality scorer | Penalises noun-stacking, lack of spatial depth, generic quality tokens    |
| **Harmonised** | Midpoint with reasoning     | Splits the difference, weighted toward whoever identified a concrete flaw |

### ChatGPT Reliability Note

ChatGPT exhibits sycophancy drift — when given identical inputs across 3 consecutive runs, it reported "slightly better" each time with no changes made. Absolute scores from ChatGPT are reference data, not truth. Structural observations (specific bugs, named improvements) are trusted. Absolute numbers are discounted when they diverge from Claude by >5 points without identifying a concrete flaw.

ChatGPT also scores T4 against the original paragraph rather than against T4's design purpose (compression for casual users). This inflates the gap on T4 — ChatGPT penalises "lost colour" when T4's job is simplification.

**However**, ChatGPT was RIGHT about the Canva NL output (78/100 vs Claude's initial 89). Claude was scoring for "platform compliance" (no syntax errors), ChatGPT was scoring for "will this produce the right image?" — and the image would have been generic. When ChatGPT identifies specific lost visual details, trust the structural analysis even if the absolute score differs.

### Action Thresholds

| Tier                | Intervention trigger             | What happens                                         |
| ------------------- | -------------------------------- | ---------------------------------------------------- |
| T1 CLIP             | Below 83 in 2 consecutive rounds | Wire `enforceWeightCap` into Call 2                  |
| T2 Midjourney       | Below 83 in 2 consecutive rounds | Strengthen system prompt MJ section                  |
| T3 Natural Language | Below 90 in 2 consecutive rounds | Investigate — this tier is bulletproof               |
| T4 Plain Language   | Below 85 in 2 consecutive rounds | Add compliance gate for minimum element preservation |

---

## 2. Test Input

All rounds use the same canonical input (the "Lighthouse Keeper" stress test):

> "A weathered lighthouse keeper stands on the rain-soaked gallery deck at twilight, gripping the iron railing as enormous storm waves crash against the jagged rocks below, sending salt spray high into the purple and copper sky, while the lighthouse beam cuts a pale gold arc through sheets of driving rain and the distant fishing village glows with tiny warm orange windows against the dark cliffs"

**Why this input:** 89 words, 498 characters. Tests front-loading (subject buried), cluster merge (4 water/weather tokens), orphan verb stripping (6 verbs), weight distribution (multiple competing visual elements), colour handling (3 named colours), sweet spot compression (over Stability's ~350 target), and negative prompt quality (scene-specific failure modes).

**Key visual anchors that must survive optimisation:**

1. gallery deck (not just "deck")
2. enormous storm waves (not just "waves crash")
3. jagged rocks (not just "rocks")
4. salt spray
5. purple AND copper sky (both colours)
6. pale gold arc (colour + shape)
7. sheets of driving rain
8. tiny warm orange windows (size + colour + object)
9. dark cliffs

If an optimised output loses 3+ of these, the image will be generic. ChatGPT's Canva analysis proved this.

---

## 3. Generic Tier Scores (Call 2)

These are the 4 tier outputs from `/api/generate-tier-prompts` — unaffected by Wave 1–4 changes.

### T1 CLIP-Based

| Round | Date   | Claude | ChatGPT | Harmonised | Weighted terms | Key observation                            |
| ----- | ------ | ------ | ------- | ---------- | -------------- | ------------------------------------------ |
| R1    | 25 Mar | 88     | 95      | 91         | 13             | Weight bloat, sky duplication              |
| R2    | 25 Mar | 93     | 86      | 90         | 7              | Lucky run — fewer weights                  |
| R3    | 25 Mar | 86     | 86      | 86         | 13             | Weight bloat returned                      |
| R4    | 26 Mar | 90     | 87      | 89         | 10             | Better than R3, still over 8               |
| R5    | 26 Mar | 91     | 84      | 88         | 7              | Best structure, iron railing over-weighted |

**Floor:** 86 · **Ceiling:** 93 · **Average:** 89 · **Trend:** Flat with variance (86–93)  
**Root cause:** GPT weight count swings 7–13 per run. No compliance gate on Call 2.  
**Status:** ⚠️ Monitoring — not at intervention threshold

### T2 Midjourney Family

| Round | Date   | Claude | ChatGPT | Harmonised | Bug present                        | Key observation               |
| ----- | ------ | ------ | ------- | ---------- | ---------------------------------- | ----------------------------- |
| R1    | 25 Mar | 79     | 88      | 83         | Duplicate params + "blurry blurry" | Broken parameter block        |
| R2    | 25 Mar | 94     | 85      | 90         | None                               | Clean run — dedup working     |
| R3    | 25 Mar | 82     | 85      | 83         | --no terms duplicated within block | Step 1b fix deployed          |
| R4    | 26 Mar | 80     | 80      | 80         | --no terms duplicated within block | Step 1b + fusion fix deployed |
| R5    | 26 Mar | 83     | 89      | 86         | Two separate --no blocks           | Step 1 handles multi-block    |

**Floor:** 79 · **Ceiling:** 94 · **Average:** 84 · **Trend:** Volatile — --no duplication appears in ~60% of runs  
**Root cause:** GPT produces duplicate --no content in most runs. Three compliance fixes deployed:

- Step 1: Dedup multiple --no blocks (catches R1, R5 pattern)
- Step 1b: Dedup within single --no block (catches R3, R4 pattern)
- Fusion detection: "warped railing blurry" → split and dedup (catches R4 boundary pattern)

**Status:** ⚠️ Monitoring — all three compliance fixes deployed, awaiting post-deploy confirmation

### T3 Natural Language

| Round | Date   | Claude | ChatGPT | Harmonised | Key observation                                         |
| ----- | ------ | ------ | ------- | ---------- | ------------------------------------------------------- |
| R1    | 25 Mar | 95     | 97      | 96         | Production-grade                                        |
| R2    | 25 Mar | 96     | 91      | 93         | "heaving sea" slightly soft                             |
| R3    | 25 Mar | 95     | 91      | 93         | Consistent                                              |
| R4    | 26 Mar | 94     | 88      | 92         | ChatGPT drifted, lost some colour                       |
| R5    | 26 Mar | 96     | 91      | 93         | Best T3 — strong camera direction, "human warmth" close |

**Floor:** 92 · **Ceiling:** 96 · **Average:** 93 · **Trend:** Stable  
**Status:** ✅ Bulletproof

### T4 Plain Language

| Round | Date   | Claude | ChatGPT | Harmonised | Key observation                                                 |
| ----- | ------ | ------ | ------- | ---------- | --------------------------------------------------------------- |
| R1    | 25 Mar | 91     | 94      | 92         | Clean compression                                               |
| R2    | 25 Mar | 92     | 86      | 89         | Dropped purple/copper sky                                       |
| R3    | 25 Mar | 88     | 86      | 87         | Lost lighthouse beam, grammar imprecise                         |
| R4    | 26 Mar | 93     | 82      | 90         | Best T4 — preserved colour, beam, spatial flow ("lead the eye") |
| R5    | 26 Mar | 94     | 86      | 90         | Strong again — ChatGPT scoring against wrong contract           |

**Floor:** 87 · **Ceiling:** 92 · **Average:** 90 · **Trend:** Improving  
**Status:** ✅ Above threshold — ChatGPT's low scores reflect T4 contract misunderstanding

---

## 4. Platform-Specific Optimised Scores (Call 3)

### Wave 1: SD CLIP Parenthetical (12 platforms)

**Representative tested:** Stability AI  
**Builder:** `group-sd-clip-parenthetical.ts`  
**Compliance gates:** `enforceClipKeywordCleanup` → `enforceWeightCap(8)` → `enforceT1Syntax`

| Round | Date   | Claude | ChatGPT | Harmonised | Weighted terms | Key fix applied                                   |
| ----- | ------ | ------ | ------- | ---------- | -------------- | ------------------------------------------------- |
| R1    | 25 Mar | 84     | 94      | 89         | 13             | — (baseline, generic fallback)                    |
| R2    | 25 Mar | 93     | 89      | 91         | 7              | BEFORE→AFTER examples + enforceWeightCap(8)       |
| R3    | 25 Mar | 95     | 89      | 92         | 6              | Example 3 (colour merge) + Rule 9 (spatial depth) |

**Floor:** 89 · **Ceiling:** 92 · **Claude R3:** 95 · **Trend:** Strong upward  
**Status:** ✅ Target hit. Wave 1 complete.

**Fixes that landed:**

| Fix                                                  | Round | Impact                      | Type            |
| ---------------------------------------------------- | ----- | --------------------------- | --------------- |
| 2 BEFORE→AFTER examples                              | R2    | +7 Claude                   | System prompt   |
| `enforceWeightCap(8)`                                | R2    | Safety net for weight bloat | Compliance gate |
| Example 3 (exact lighthouse scenario, colour merge)  | R3    | +2 Claude                   | System prompt   |
| Rule 9 (spatial depth ordering)                      | R3    | +2 Claude                   | System prompt   |
| `enforceClipKeywordCleanup` (orphan verbs, articles) | R3    | Safety net                  | Compliance gate |

### Wave 2: SD CLIP Double-Colon (Leonardo)

**Representative tested:** Leonardo AI  
**Builder:** `group-sd-clip-double-colon.ts`  
**Compliance gates:** `enforceClipKeywordCleanup` → double-colon weight cap(8) → `enforceT1Syntax`

| Round | Date   | Claude | ChatGPT | Harmonised | Weighted terms | Key observation                                       |
| ----- | ------ | ------ | ------- | ---------- | -------------- | ----------------------------------------------------- |
| R4    | 26 Mar | 96     | 88      | 93         | 7              | First-time hit. Correct :: syntax. Colour merge done. |

**Status:** ✅ Wave 2 complete.

### Wave 3: Midjourney Dedicated

**Representative tested:** Midjourney  
**Builder:** `group-midjourney.ts` (v2)  
**Compliance gates:** `enforceMjParameters` (Step 1 + Step 1b + fusion) in route

| Round | Date   | Claude | ChatGPT | Harmonised | Source          | Key observation                                                  |
| ----- | ------ | ------ | ------- | ---------- | --------------- | ---------------------------------------------------------------- |
| PG v1 | 26 Mar | 97     | —       | —          | Playground      | 4 sections, clean params, 7 --no terms                           |
| PG v2 | 26 Mar | 98     | —       | —          | Playground      | Rule 9 added, 10 --no terms, "photoreal storm cinema"            |
| R5    | 26 Mar | 88     | 92      | 90         | Prompt Lab (v1) | Input was "already fine" — near-identical output returned        |
| R6a   | 26 Mar | —      | —       | —          | Prompt Lab (v2) | **Schema validation failure**                                    |
| R6b   | 26 Mar | 91     | 93      | 92         | Prompt Lab (v2) | Second attempt. 4 sections, "concept art" persists, 8 --no terms |

**Playground → Prompt Lab gap:** -7 points (98 → 91). See §5.

**Key fixes:**

| Fix                                              | Version | Impact                                                                                                   |
| ------------------------------------------------ | ------- | -------------------------------------------------------------------------------------------------------- |
| Rule 9 ("always restructure")                    | v2      | Prevents GPT returning near-identical input. Forces subject isolation, style commitment, --no expansion. |
| --no minimum 7, 4+ scene-specific                | v2      | Prevents thin boilerplate-only negative lists                                                            |
| Example 1 (draft-that-looks-fine → restructured) | v2      | Teaches GPT to improve good input, not just bad input                                                    |

**Status:** ✅ Wave 3 complete. Harmonised 92.

### Wave 4: Clean Natural Language (21 platforms)

**Representative tested:** Canva Magic Media  
**Builder:** `group-clean-natural-language.ts` (v3)  
**Compliance gates:** `enforceNaturalLanguageCleanup` (strip syntax, weights, CLIP tokens)

| Round | Date   | Claude | ChatGPT | Harmonised | Source          | Key observation                                            |
| ----- | ------ | ------ | ------- | ---------- | --------------- | ---------------------------------------------------------- |
| PG v1 | 26 Mar | 96     | —       | —          | Playground      | Clean prose, all colours, all details                      |
| PG v2 | 26 Mar | 97     | —       | —          | Playground      | Rule 9 + cross-reference original                          |
| R7a   | 26 Mar | 89     | 78      | 83         | Prompt Lab (v1) | **Identical to T4 generic** — GPT passed through unchanged |
| R7b   | 26 Mar | 84     | 81      | 83         | Prompt Lab (v2) | Slightly better — Rule 9 "enrich" partially worked         |
| R7c   | 26 Mar | 85     | —       | 85         | Prompt Lab (v3) | Salt spray restored. Still missing 5 anchors.              |

**Playground → Prompt Lab gap:** -12 points (97 → 85). Widest gap of all waves.

**Root cause discovered and fixed (26 Mar):** The original human sentence was **never being sent to Call 3**. The `aiOptimise()` function accepted an `originalSentence` 4th argument, but `enhanced-educational-preview.tsx` only passed 3 arguments. GPT received the compressed T4-style text as input and had nothing to cross-reference against.

**Fix deployed:** `humanText` state from `playground-workspace.tsx` → new prop on `EnhancedEducationalPreview` → stored as ref → passed as 4th argument to both `aiOptimise()` calls. The API route already sends `originalSentence` to GPT when provided. This fix benefits **ALL 35 platforms**, not just Canva.

**Key fixes (chronological):**

| Fix                                                     | Version | Impact                                                                                   |
| ------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------- |
| Basic NL builder (strip syntax, affirmative only)       | v1      | Baseline — 96 Playground, 83 Prompt Lab                                                  |
| Rule 9 ("always enrich")                                | v2      | Tells GPT to restore lost details — marginal Prompt Lab improvement                      |
| Rule 9 ("cross-reference original")                     | v3      | Tells GPT to compare assembled vs original — but original wasn't being sent              |
| **humanText wiring fix**                                | v3      | **Root cause fix** — original sentence now reaches Call 3. Salt spray restored as proof. |
| Example 1 (over-simplified draft + original → enriched) | v3      | Shows GPT the exact pattern: here's what was lost, here's how to restore it              |
| Sweet spot "never sacrifice drama"                      | v3      | Prevents GPT from dropping colour to hit a shorter char count                            |

**Status:** ⚠️ Functional (85). humanText wiring fix just deployed — expect improvement from next session. The original sentence now reaches GPT for the first time. Full impact not yet measured.

### Wave 5: DALL-E API (OpenAI)

**Status:** Not started

### Wave 6: Flux Architecture

**Status:** Not started

### Wave 7: Video Cinematic (Runway, Luma, Kling)

**Status:** Not started

### Wave 8: Remaining Dedicated (7 platforms)

**Status:** Not started

### Wave 9: Multi-Engine Aggregators (NightCafe, Tensor.Art, Freepik)

**Status:** Not started

---

## 5. Playground vs Prompt Lab Gap

**Discovered 26 Mar 2026.** Playground scores consistently higher than Prompt Lab for the same system prompt.

| Wave | Platform   | Playground | Prompt Lab | Gap     |
| ---- | ---------- | ---------- | ---------- | ------- |
| 1    | Stability  | Not tested | 95         | —       |
| 2    | Leonardo   | Not tested | 96         | —       |
| 3    | Midjourney | 98         | 91         | **-7**  |
| 4    | Canva (NL) | 97         | 85         | **-12** |

### Root Cause Analysis

| Factor              | Playground               | Prompt Lab                                                       | Impact                                          |
| ------------------- | ------------------------ | ---------------------------------------------------------------- | ----------------------------------------------- |
| System prompt       | Pasted directly          | Built by group builder (identical content)                       | None                                            |
| User message        | Clean: prompt + original | Built by route: prompt + original + providerContext              | **High** — providerContext adds ~300 tokens     |
| Additional context  | None                     | providerContext object (name, tier, sweetSpot, tokenLimit, etc.) | **High** — dilutes GPT attention                |
| Response processing | Raw JSON displayed       | Zod validation + compliance gates + type conversion              | Low — compliance only improves                  |
| Original sentence   | Always present (pasted)  | **Was missing until v3 fix** — now present                       | **Critical** — this was the #1 cause for NL gap |

### Why NL Gap Is Widest (-12)

The NL group has the widest gap because:

1. The assembled prompt input is already "good enough" prose (T4-style), so GPT's threshold for "this needs improvement" is higher
2. NL platforms have no syntax to fix (no weights to correct, no params to dedup), so there's less for GPT to mechanically improve
3. The enrichment task (restoring lost colour, drama, specificity) requires creative cross-referencing, which is more attention-intensive than mechanical syntax fixes
4. **The original sentence wasn't being sent** — fixed in v3, impact not yet measured

### Possible Future Fixes

1. **Strip providerContext from user message** — move platform data into system prompt via `ctx.groupKnowledge`, reduce user message to just prompt + original. Matches Playground's clean input structure.
2. **Raise `max_completion_tokens`** from 1200 to 1500 for groups with longer system prompts (MJ, NL).
3. **Pre-process the input** before sending to Call 3 — for NL platforms, send the original sentence AS the primary input (not the compressed T4), so GPT starts from the richest text.

---

## 6. Schema Validation Failures

**Tracked from 26 Mar 2026.** Intermittent Zod validation failures on Call 3 responses.

| Date   | Round | Platform   | Error                                           | Resolution            |
| ------ | ----- | ---------- | ----------------------------------------------- | --------------------- |
| 26 Mar | R6a   | Midjourney | "Engine response did not match expected format" | Retry succeeded (R6b) |

**Known potential causes:**

1. `max_completion_tokens: 1200` truncates long JSON responses mid-field
2. GPT returns `charCount` as string instead of number
3. A `changes` array entry exceeds the 200-char Zod max
4. GPT wraps JSON in markdown code fences despite `response_format: json_object`

**UX gap:** The error message appears at the bottom of the Prompt Lab page with no visual prominence — no toast, no colour change, no scroll-to-error. Users may not notice the optimizer failed. The optimizer box shows previous content or nothing, giving no indication that a retry is needed. **Confirmed by visual inspection (screenshot 26 Mar).**

**Actions needed:**

1. Add `console.error` logging of raw GPT response when schema validation fails (diagnosis)
2. Surface the error as a toast notification or inline error state (UX)
3. Consider auto-retry once before showing error to user (resilience)
4. Consider raising `max_completion_tokens` from 1200 to 1500 for MJ + NL groups (prevention)

---

## 7. Compliance Gate Effectiveness

| Gate                            | Scope               | Purpose                                              | Hit rate                 | Notes                          |
| ------------------------------- | ------------------- | ---------------------------------------------------- | ------------------------ | ------------------------------ |
| `enforceT1Syntax`               | Call 2 + Call 3     | Correct weight syntax (parenthetical ↔ double-colon) | ~20%                     | Works reliably                 |
| `enforceMjParameters` Step 1    | Call 2 + Call 3     | Dedup multiple --ar/--v/--s/--no blocks              | ~33% of T2 runs          | Catches R1/R5 pattern          |
| `enforceMjParameters` Step 1b   | Call 2 + Call 3     | Dedup within single --no block                       | ~60% of T2 runs          | Catches R3/R4 pattern          |
| `enforceMjParameters` Fusion    | Call 2 + Call 3     | Detect fused terms ("warped railing blurry")         | ~10% of T2 runs          | Catches boundary concatenation |
| `enforceWeightCap(8)`           | Call 3 SD CLIP only | Cap weighted terms at 8                              | ~50% of Stability runs   | Strips lowest-weight terms     |
| `enforceClipKeywordCleanup`     | Call 3 SD CLIP only | Strip orphan verbs + leading articles                | Deployed — awaiting data | 30+ verbs in set               |
| `enforceNaturalLanguageCleanup` | Call 3 NL only      | Strip surviving weights, flags, CLIP tokens          | Deployed — awaiting data | Critical safety net for NL     |
| `postProcessTiers` P1–P12       | Call 2 only         | Full post-processing pipeline                        | Always runs              | 12 processors                  |

---

## 8. Dual-Assessor Divergence Patterns

| Pattern                                             | Frequency    | Who's right         | Resolution                                                                                                                |
| --------------------------------------------------- | ------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Claude higher on CLIP weight compliance             | 4/5 rounds   | Claude              | CLIP weight count is mechanical, not subjective                                                                           |
| ChatGPT higher on "visual richness"                 | 2/5 rounds   | ChatGPT (partially) | Spatial depth rule added R3                                                                                               |
| ChatGPT sycophancy drift (+2 on identical input)    | Confirmed 3x | Claude              | Discount ChatGPT absolutes, trust structural observations                                                                 |
| ChatGPT scores T4 against original, not T4 contract | 3/5 rounds   | Claude              | T4's job is compression; ChatGPT penalises lost detail that T4 is designed to drop                                        |
| Both flag same structural bug                       | 3/5 rounds   | Both                | Strongest signal — act immediately                                                                                        |
| ChatGPT identifies lost visual anchors in NL output | 1/1 (Canva)  | **ChatGPT**         | Claude scored 89 for "platform compliance", ChatGPT scored 78 for "will this produce the right image" — ChatGPT was right |

**Key learning:** ChatGPT's absolute scores are unreliable. But when ChatGPT lists specific visual details that are missing (purple sky, salt spray, pale gold arc, jagged rocks), that structural analysis is trustworthy and actionable. Use ChatGPT for "what's missing" not "what's the score."

---

## 9. Key Architectural Insights

### Call 2 vs Call 3 Quality Gap

Call 2 generates all 4 tiers in ONE system prompt with 30 rules. GPT's attention is split four ways. This causes:

- T1 weight count variance (7–13 per run)
- T2 --no duplication (~60% of runs)
- T4 random element dropping

Call 3 sends a DEDICATED system prompt per platform group. GPT's full attention is on one platform's rules. This produces:

- Stability: 95 (Claude)
- Leonardo: 96 (Claude)
- Midjourney: 98 (Playground), 91 (Prompt Lab)
- Canva: 97 (Playground), 85 (Prompt Lab)

**Conclusion:** The generic 4-tier preview is the hook. The optimised output is the product. Users who care about quality will use the optimizer — that's the upgrade path to Pro.

### Splitting Call 2 — Evaluated and Rejected (26 Mar)

Splitting Call 2 into 4 separate API calls (one per tier) was evaluated and rejected:

- 4x API cost per generation
- Zero-budget launch constraint
- Generic tiers are the hook, not the product
- Better to invest API budget in finishing Waves 5–9

### Original Sentence Bug — Critical Discovery (26 Mar)

**The `originalSentence` was never reaching Call 3.** The `useAiOptimisation` hook accepted it as a 4th argument, the API route sent it to GPT, but `enhanced-educational-preview.tsx` only passed 3 arguments. For all Waves 1–3, GPT never had the original human description to cross-reference.

**Impact:** All platform-specific optimisations were working from the compressed/assembled prompt only. For CLIP groups this matters less (the assembled T1 has all the keywords). For NL groups it matters enormously (the assembled T4 has already lost colours, drama, and specificity).

**Fix:** `humanText` from `playground-workspace.tsx` → new prop → ref → passed as 4th arg to `aiOptimise()`. Deployed 26 Mar. **Benefits all 35 covered platforms.**

### OpenAI Playground as Testing Tool

Playground (`platform.openai.com/playground`) allows direct testing of system prompts against `gpt-5.4-mini` with matching settings. Playground output is "ground truth" — before compliance gates and schema validation.

**Workflow:** Build system prompt → test in Playground → score → iterate → code the builder only when Playground scores 95+. Saves full Prompt Lab round trips during development.

**Settings:** Model: gpt-5.4-mini, Text format: json_object, Reasoning effort: medium, Show logs: ✓

**Playground was used to validate:**

- Wave 3 Midjourney v1 (97) and v2 (98)
- Wave 4 NL v1 (96) and v2 (97)

### The "Always Restructure/Enrich" Pattern

Every group builder now needs Rule 9 — without it, GPT treats well-formatted input as "already done" and returns it near-identical. This was discovered independently in Wave 3 (Midjourney R5) and Wave 4 (Canva R7a).

The rule has two flavours:

- **"Always restructure"** (CLIP/MJ): rebalance weights, split overloaded sections, expand --no
- **"Always enrich + cross-reference"** (NL): restore lost colours, drama, specificity from the original description

Both flavours are mandatory for production-quality output.

---

## 10. Build History — Files Shipped This Session

### Architecture (new system)

| File                                           | Type | Purpose                                          |
| ---------------------------------------------- | ---- | ------------------------------------------------ |
| `lib/optimise-prompts/platform-groups.ts`      | New  | Maps 45 providers → group IDs                    |
| `lib/optimise-prompts/types.ts`                | New  | Shared types (GroupPromptResult, GroupBuilder)   |
| `lib/optimise-prompts/resolve-group-prompt.ts` | New  | Router: provider → group → builder               |
| `lib/optimise-prompts/generic-fallback.ts`     | New  | Original buildSystemPrompt extracted as fallback |
| `lib/optimise-prompts/index.ts`                | New  | Barrel export                                    |

### Group Builders

| File                                   | Type | Platforms      | Playground | Prompt Lab |
| -------------------------------------- | ---- | -------------- | ---------- | ---------- |
| `group-sd-clip-parenthetical.ts`       | New  | 12             | Not tested | 95         |
| `group-sd-clip-double-colon.ts`        | New  | 1 (Leonardo)   | Not tested | 96         |
| `group-midjourney.ts` (v2)             | New  | 1 (Midjourney) | 98         | 91         |
| `group-clean-natural-language.ts` (v3) | New  | 21             | 97         | 85         |

### Compliance Gates Added

| Function                          | File                              | Purpose                                                   |
| --------------------------------- | --------------------------------- | --------------------------------------------------------- |
| `enforceWeightCap(max)`           | `harmony-compliance.ts`           | Cap parenthetical weighted terms                          |
| `enforceClipKeywordCleanup()`     | `harmony-compliance.ts`           | Strip orphan verbs + articles from CLIP prompts           |
| `enforceNaturalLanguageCleanup()` | `group-clean-natural-language.ts` | Strip surviving syntax/weights/CLIP tokens from NL output |
| Step 1b (within-block --no dedup) | `harmony-compliance.ts`           | Dedup terms within single --no block                      |
| Fusion detection                  | `harmony-compliance.ts`           | Detect fused terms ("warped railing blurry")              |

### Plumbing Fixes

| File                                                  | Change                                                                                                                |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `app/api/optimise-prompt/route.ts`                    | Swapped `buildSystemPrompt` → `resolveGroupPrompt`. Added `groupKnowledge` to Zod. Wired group compliance gate chain. |
| `types/prompt-builder.ts`                             | Added `groupKnowledge?: string` to PlatformFormat                                                                     |
| `hooks/use-ai-optimisation.ts`                        | Added `groupKnowledge?: string` to OptimisationProviderContext                                                        |
| `data/providers/platform-formats.json`                | Added `groupKnowledge` for 26 platforms                                                                               |
| `components/prompts/enhanced-educational-preview.tsx` | New `humanText` prop. Passes original sentence to Call 3 via ref.                                                     |
| `components/prompts/playground-workspace.tsx`         | Passes `humanText={humanText}` to EnhancedEducationalPreview                                                          |

### Prompt Lab Fixes (earlier in session)

| File                                                     | Change                                                                                       |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `components/providers/describe-your-image.tsx`           | `defaultExpanded` prop — Prompt Lab opens with textarea expanded                             |
| `components/prompts/enhanced-educational-preview.tsx`    | Typewriter only on API calls, instant on tier tab switch. Optimised prompt typewriter added. |
| `components/prompt-builder/four-tier-prompt-preview.tsx` | `generationId` prop — typewriter only on new API generation                                  |

---

## 11. Open Issues

| #   | Issue                                                                  | Severity | Status                                                              |
| --- | ---------------------------------------------------------------------- | -------- | ------------------------------------------------------------------- |
| 1   | T2 --no duplication in Call 2 (~60% of runs)                           | Medium   | 3 compliance gates deployed, awaiting post-deploy confirmation      |
| 2   | Schema validation failures on Call 3 (intermittent)                    | Medium   | Needs console.error logging of raw GPT response                     |
| 3   | Schema failure UX — error at bottom of page, no toast                  | Low      | UX fix needed (confirmed by screenshot)                             |
| 4   | Playground→Prompt Lab gap: MJ -7, NL -12                               | Medium   | humanText fix deployed — retest needed                              |
| 5   | MJ "concept art" persists despite Rule 9 in Prompt Lab                 | Low      | GPT partially ignores style commitment under token pressure         |
| 6   | `max_completion_tokens: 1200` may truncate long MJ/NL responses        | Medium   | Consider raising to 1500 for these groups                           |
| 7   | NL group still losing 5 visual anchors in Prompt Lab despite Rule 9 v3 | Medium   | humanText fix just deployed — this is the #1 item to retest         |
| 8   | 10 platforms still on generic fallback                                 | Medium   | Waves 5–9 not started (DALL-E, Flux, Video, Dedicated, Aggregators) |

---

## 12. Next Session Priorities

1. **Retest Canva with humanText fix** — the original sentence now reaches GPT for the first time. This should close the NL gap significantly. If it does, all 21 NL platforms benefit.
2. **Retest Stability/Leonardo/Midjourney** — they also now receive the original sentence. Scores may improve.
3. **Wave 5: DALL-E API** (OpenAI) — Playground first, then build.
4. **Wave 6: Flux Architecture** — very different from CLIP, needs T5-XXL awareness.
5. **Investigate providerContext token overhead** — possible fix: strip from user message, rely on groupKnowledge in system prompt instead.

---

## 13. Changelog

| Date        | Version | Changes                                                                                                                                                                                                                                                                                                              |
| ----------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 25 Mar 2026 | 1.0.0   | Initial document. 3 rounds of Lighthouse Keeper data. Wave 1 (Stability) complete at 95.                                                                                                                                                                                                                             |
| 26 Mar 2026 | 2.0.0   | Added R4–R6 data. Wave 2 (Leonardo, 96) and Wave 3 (Midjourney, 91/98 PG) complete. Added §5 Playground gap, §6 schema failures, §9 architectural insights.                                                                                                                                                          |
| 26 Mar 2026 | 3.0.0   | Wave 4 (NL, 21 platforms) complete. Original sentence bug discovered and fixed (humanText wiring). Full R7 Canva data. Added §10 build history, §12 next priorities. Expanded §5 with NL gap analysis. ChatGPT reliability note updated (Canva case where ChatGPT was right). 9 visual anchor checklist added to §2. |
