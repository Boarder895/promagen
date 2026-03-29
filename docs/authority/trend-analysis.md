# Prompt Optimisation Trend Analysis

**Version:** 5.0.0  
**Created:** 25 March 2026  
**Updated:** 27 March 2026 (Session 3)  
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

### ChatGPT Scoring Criteria (confirmed 26 Mar Session 2)

ChatGPT confirmed its weighting for the Canva assessment:

| Criterion                  | Weight | What it measures                                      |
| -------------------------- | ------ | ----------------------------------------------------- |
| Fidelity to original input | 35%    | How many visual anchors survived                      |
| Visual richness            | 20%    | Enough detail to build a vivid image                  |
| Atmosphere and mood        | 15%    | Danger, scale, loneliness, weather violence           |
| Composition usefulness     | 10%    | Clear subject, foreground/background, readable layout |
| Platform suitability       | 15%    | Matches the platform's preferred prompt format        |
| Clarity per word           | 5%     | Each word doing useful visual work                    |

### ChatGPT Reliability Note

ChatGPT exhibits sycophancy drift — when given identical inputs across 3 consecutive runs, it reported "slightly better" each time with no changes made. Absolute scores from ChatGPT are reference data, not truth. Structural observations (specific bugs, named improvements) are trusted. Absolute numbers are discounted when they diverge from Claude by >5 points without identifying a concrete flaw.

ChatGPT also scores T4 against the original paragraph rather than against T4's design purpose (compression for casual users). This inflates the gap on T4 — ChatGPT penalises "lost colour" when T4's job is simplification.

**However**, ChatGPT was RIGHT about the Canva NL output (78/100 vs Claude's initial 89). Claude was scoring for "platform compliance" (no syntax errors), ChatGPT was scoring for "will this produce the right image?" — and the image would have been generic. When ChatGPT identifies specific lost visual details, trust the structural analysis even if the absolute score differs.

### ChatGPT Canva Research (26 Mar Session 2)

ChatGPT was asked to research Canva's ideal prompt format from public sources. Key findings:

- Canva's Dream Lab is powered by **Leonardo AI's Phoenix model**
- Canva prefers **clear natural-language scene descriptions** with important visual cues stated plainly
- **Not ultra-short summaries** — the goal is "cleanest prompt that still preserves scene-defining cues"
- Style and aspect ratio should be set via **UI controls, not in prompt**
- Canva's own guidance: "more descriptive prompts tend to produce better outputs"
- Structure: subject → setting → action → mood → visual specifics

This directly contradicted the old `groupKnowledge` value of "Very short prompts preferred" which was causing GPT to over-compress.

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

These are the 4 tier outputs from `/api/generate-tier-prompts` — unaffected by Wave 1–8 changes.

### T1 CLIP-Based

| Round | Date   | Claude | ChatGPT | Harmonised | Weighted terms | Key observation                                 |
| ----- | ------ | ------ | ------- | ---------- | -------------- | ----------------------------------------------- |
| R1    | 25 Mar | 88     | 95      | 91         | 13             | Weight bloat, sky duplication                   |
| R2    | 25 Mar | 93     | 86      | 90         | 7              | Lucky run — fewer weights                       |
| R3    | 25 Mar | 86     | 86      | 86         | 13             | Weight bloat returned                           |
| R4    | 26 Mar | 90     | 87      | 89         | 10             | Better than R3, still over 8                    |
| R5    | 26 Mar | 91     | 84      | 88         | 7              | Best structure, iron railing over-weighted      |
| R6    | 26 Mar | —      | 90      | —          | —              | Session 2: ChatGPT-only assessment              |
| R7    | 26 Mar | —      | 91      | —          | —              | Session 2: best T1 — pale gold arc now weighted |
| R8    | 26 Mar | —      | 92      | —          | —              | Session 2: strongest CLIP, all anchors present  |
| R9    | 27 Mar | —      | 90      | —          | —              | Session 3: stable. "purple copper clouds" weakness persists — key elements unweighted |

**Floor:** 86 · **Ceiling:** 93 · **Average:** 89 · **Trend:** Stable — improvement stalled  
**Known flaw:** "purple copper clouds" survives Call 3 — should be "purple-and-copper sky". Example 3 in builder has the correct merge but GPT isn't consistently applying it to all inputs.  
**Status:** ⚠️ Monitoring — "purple copper clouds" flaw + unweighted key elements (jagged rocks, salt spray, dark cliffs) need addressing

### T2 Midjourney Family

| Round | Date   | Claude | ChatGPT | Harmonised | Bug present                        | Key observation                                  |
| ----- | ------ | ------ | ------- | ---------- | ---------------------------------- | ------------------------------------------------ |
| R1    | 25 Mar | 79     | 88      | 83         | Duplicate params + "blurry blurry" | Broken parameter block                           |
| R2    | 25 Mar | 94     | 85      | 90         | None                               | Clean run — dedup working                        |
| R3    | 25 Mar | 82     | 85      | 83         | --no terms duplicated within block | Step 1b fix deployed                             |
| R4    | 26 Mar | 80     | 80      | 80         | --no terms duplicated within block | Step 1b + fusion fix deployed                    |
| R5    | 26 Mar | 83     | 89      | 86         | Two separate --no blocks           | Step 1 handles multi-block                       |
| R6    | 26 Mar | —      | 91      | —          | Duplicated --no tail               | Session 2: strong content, plumbing bug persists |
| R7    | 26 Mar | —      | 92      | —          | Duplicated --no tail               | Session 2: all 9 anchors, --no still duplicated  |
| R8    | 27 Mar | —      | 92      | —          | None seen                          | Session 3: stable. Prose restructuring working, slightly over-written |

**Floor:** 79 · **Ceiling:** 94 · **Average:** 87 · **Trend:** Content stable at 90–92  
**Root cause:** GPT produces duplicate --no content in most runs. Three compliance fixes deployed but bug persists in ~60% of runs.  
**Status:** ⚠️ Monitoring — --no duplication is a cosmetic issue, content quality is strong

### T3 Natural Language

| Round | Date   | Claude | ChatGPT | Harmonised | Key observation                                                        |
| ----- | ------ | ------ | ------- | ---------- | ---------------------------------------------------------------------- |
| R1    | 25 Mar | 95     | 97      | 96         | Production-grade                                                       |
| R2    | 25 Mar | 96     | 91      | 93         | "heaving sea" slightly soft                                            |
| R3    | 25 Mar | 95     | 91      | 93         | Consistent                                                             |
| R4    | 26 Mar | 94     | 88      | 92         | ChatGPT drifted, lost some colour                                      |
| R5    | 26 Mar | 96     | 91      | 93         | Best T3 — strong camera direction, "human warmth" close                |
| R6    | 26 Mar | —      | 90      | —          | Session 2: "storm waves hammer the jagged rocks" visceral              |
| R7    | 26 Mar | —      | 94      | —          | Session 2: "gives the storm immense scale" — outstanding               |
| R8    | 26 Mar | —      | 95      | —          | Session 2: best T3 ever — "height of the tower and the violence below" |
| R9    | 27 Mar | —      | 94      | —          | Session 3: stable. "small fishing village" slightly weaker than source |

**Floor:** 92 · **Ceiling:** 96 · **Average:** 94 · **Trend:** Stable  
**Status:** ✅ Bulletproof

### T4 Plain Language

| Round | Date   | Claude | ChatGPT | Harmonised | Key observation                                       |
| ----- | ------ | ------ | ------- | ---------- | ----------------------------------------------------- |
| R1    | 25 Mar | 91     | 94      | 92         | Clean compression                                     |
| R2    | 25 Mar | 92     | 86      | 89         | Dropped purple/copper sky                             |
| R3    | 25 Mar | 88     | 86      | 87         | Lost lighthouse beam, grammar imprecise               |
| R4    | 26 Mar | 93     | 82      | 90         | Best T4 — preserved colour, beam, spatial flow        |
| R5    | 26 Mar | 94     | 86      | 90         | Strong again — ChatGPT scoring against wrong contract |
| R6    | 26 Mar | —      | 82      | —          | Session 2: salt spray + purple sky restored           |
| R7    | 26 Mar | —      | 87      | —          | Session 2: "stormy, vast, and lonely" emotional close |
| R8    | 26 Mar | —      | 88      | —          | Session 2: purple and copper skies + flying spray     |
| R9    | 27 Mar | —      | 87      | —          | Session 3: stable. Loses jagged rocks, salt spray, pale gold, gallery deck precision |

**Floor:** 87 · **Ceiling:** 92 · **Average:** 89 · **Trend:** Stable  
**Status:** ✅ Above threshold

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
| R4    | 27 Mar | —      | 86      | —          | —              | Session 3 retest: "purple copper clouds" persists, key elements unweighted |

**Status:** ⚠️ Score revised downward. Session 3 honest ChatGPT score: 86 (previous 92 was Claude-lenient). Root cause: "purple copper clouds" instead of "purple-and-copper sky"; jagged rocks, salt spray, dark cliffs, warm orange windows all unweighted. Negatives generated by builder but not displayed in Prompt Lab UI.

### Wave 2: SD CLIP Double-Colon (Leonardo)

**Representative tested:** Leonardo AI  
**Builder:** `group-sd-clip-double-colon.ts`

| Round | Date   | Claude | ChatGPT | Harmonised | Weighted terms | Key observation                                       |
| ----- | ------ | ------ | ------- | ---------- | -------------- | ----------------------------------------------------- |
| R4    | 26 Mar | 96     | 88      | 93         | 7              | First-time hit. Correct :: syntax. Colour merge done. |
| R5    | 27 Mar | —      | 87      | —          | —              | Session 3 retest: "purple copper clouds" persists, key elements unweighted. Previous 93 was Claude-lenient. |

**Status:** ⚠️ Score revised. Honest ChatGPT score: 87. Same root cause as Wave 1 — "purple copper clouds" weakness in assembled input; jagged rocks, salt spray, dark cliffs unweighted. Both CLIP builders share this flaw.

### Wave 3: Midjourney Dedicated

**Representative tested:** Midjourney  
**Builder:** `group-midjourney.ts` (v2)

| Round | Date   | Claude | ChatGPT | Harmonised | Source     | Key observation                |
| ----- | ------ | ------ | ------- | ---------- | ---------- | ------------------------------ |
| PG v1 | 26 Mar | 97     | —       | —          | Playground | 4 sections, clean params       |
| PG v2 | 26 Mar | 98     | —       | —          | Playground | Rule 9 added, 10 --no terms    |
| R5    | 26 Mar | 88     | 92      | 90         | Prompt Lab | Near-identical output returned |
| R6b   | 26 Mar | 91     | 93      | 92         | Prompt Lab | "concept art" persists         |
| R7    | 27 Mar | —      | 90      | —          | Prompt Lab | Session 3 retest: slightly over-written. "storm-realism photography" is better than "concept art" but prose is pushed. |

**Status:** ✅ Wave 3 stable. ChatGPT 90. Slightly over-written but strong content. "concept art" → "storm-realism photography" fix confirmed working.

### Wave 4: Clean Natural Language (21 platforms)

**Representative tested:** Canva Magic Media  
**Builder:** `group-clean-natural-language.ts` (v4)  
**Compliance gates:** `enforceNaturalLanguageCleanup` (strip syntax, weights, CLIP tokens)

| Round | Date   | Claude | ChatGPT | Harmonised | Source          | Key observation                                         |
| ----- | ------ | ------ | ------- | ---------- | --------------- | ------------------------------------------------------- |
| PG v1 | 26 Mar | 96     | —       | —          | Playground      | Clean prose, all colours, all details                   |
| PG v2 | 26 Mar | 97     | —       | —          | Playground      | Rule 9 + cross-reference original                       |
| R7a   | 26 Mar | 89     | 78      | 83         | Prompt Lab (v1) | **Identical to T4** — GPT passed through unchanged      |
| R7b   | 26 Mar | 84     | 81      | 83         | Prompt Lab (v2) | Rule 9 "enrich" partially worked                        |
| R7c   | 26 Mar | 85     | —       | 85         | Prompt Lab (v3) | Salt spray restored. Still missing 5 anchors.           |
| R8a   | 26 Mar | —      | 81      | —          | Session 2 (v3)  | humanText wiring confirmed working via diagnostics      |
| R8b   | 26 Mar | —      | 84      | —          | Session 2 (v3)  | Slightly better — Rule 9 working                        |
| R8c   | 26 Mar | —      | 85      | —          | Session 2 (v4)  | groupKnowledge fix + idealMin floor — still compressing |
| R8d   | 26 Mar | —      | 87      | —          | Session 2 (v4)  | Canva: pale gold beam restored for first time           |
| R8e   | 26 Mar | —      | 88      | —          | Session 2 (v5)  | .next cache cleared — all fixes firing together         |
| R8f   | 26 Mar | —      | 89      | —          | Session 2 (v6)  | Flipped framing (Idea 1) — best Canva score. Final.     |
| R9a   | 27 Mar | —      | 91      | —          | Session 3 (Firefly) | NL group: slightly over-engineered. "add tactile realism" sounds synthetic. |
| R9b   | 27 Mar | —      | 90      | —          | Session 3 (Google Imagen) | **CRITICAL: Assembled T3 scored 94 — optimised scored 90. Call 3 DEGRADING output.** |

**Playground → Prompt Lab gap:** Narrowed from -12 to -8 (97 → 89).

**CRITICAL SESSION 3 FINDING — NL group Call 3 degrades output:**
Google Imagen assembled T3 (94) > Call 3 optimised (90). The assembled prompt is cleaner, tighter, and more natural than the Call 3 result. This confirms the NL compression instinct is still active: Call 3 is adding length and synthetic phrasing ("Framed as a dramatic low-angle wide shot with layered depth from…") that scores lower than the original assembled prose. This is the strongest evidence yet for skipping Call 3 on the NL group entirely.

**Root causes identified and fixed (Session 2):**

1. **humanText wiring** (Session 1) — original sentence now reaches Call 3
2. **groupKnowledge "Very short prompts preferred"** — was overriding enrichment rules. Fixed to "Powered by Leonardo Phoenix. Prefers clear descriptive natural language with visual specifics."
3. **idealMin/idealMax floor** — Canva's 50/200 was strangling GPT. Floored at 280/400.
4. **T3 sent as input** — NL T4 providers now get T3 (richer prose) as Call 3 input instead of T4
5. **Flipped framing (Idea 1)** — original sentence sent as "SCENE DESCRIPTION TO OPTIMISE", T3 as "REFERENCE DRAFT". Prevents GPT's "optimise = compress" instinct.
6. **Rule 10 anti-compression** — explicit "NEVER SHORTEN, output < 280 chars = FAILURE"

**GPT compression problem (Session 2 learning):** At temperature 0.2, GPT treats "optimise" as "simplify" for NL prose. No amount of prompt engineering fully overcomes this. Five separate fixes were attempted; the combination of all five brought Canva from 82 to 89. An NL bypass (returning original sentence directly) was attempted but failed due to React useEffect double-fire timing — the first Call 3 returned correctly (395 chars) but a second debounced re-fire overwrote it with a shorter result.

**Status:** ⚠️ Wave 4 decision pending. Canva ceiling: 89. But assembled T3 baseline for NL group is 94. Call 3 is spending API budget to produce output that scores lower than what the user already had. Strong case for skipping Call 3 entirely for the NL group and displaying assembled T3 as the final output.

### Wave 5: DALL-E API (OpenAI)

**Representative tested:** DALL·E 3  
**Builder:** `group-dalle-api.ts` (v1)  
**Compliance gates:** `enforceDalleCleanup` (strip syntax, weights, CLIP tokens)

| Round | Date   | Claude | ChatGPT | Harmonised | Source     | Anchors | Key observation                       |
| ----- | ------ | ------ | ------- | ---------- | ---------- | ------- | ------------------------------------- |
| PG v1 | 26 Mar | 96     | —       | —          | Playground | 9/9     | All anchors, 385 chars, rewrite-proof |
| R9    | 26 Mar | 95     | 95      | 95         | Prompt Lab | 9/9     | First-time ship. 389 chars.           |
| R10   | 27 Mar | —      | 96      | —          | Prompt Lab | 9/9     | Session 3 retest. 392 chars. Clean prose, all anchors. |

**Key architecture insight:** DALL-E 3 rewrites every prompt via GPT-4. The builder teaches GPT to write "rewrite-proof" prompts — every visual element is a named anchor that GPT-4 preserves during expansion. Vague modifiers get reinterpreted; specific nouns survive.

**Status:** ✅ Wave 5 confirmed. ChatGPT 96. Consistent across sessions.

### Wave 6: Flux Architecture (Black Forest Labs)

**Representative tested:** Flux  
**Builder:** `group-flux-architecture.ts` (v1, improved to v2)  
**Compliance gates:** `enforceFluxCleanup` (strip syntax, weights, CLIP tokens, negative phrases)

| Round | Date   | Claude | ChatGPT | Harmonised | Source     | Anchors | Key observation             |
| ----- | ------ | ------ | ------- | ---------- | ---------- | ------- | --------------------------- |
| R10   | 26 Mar | 95     | 95      | 95         | Prompt Lab | 9/9     | First-time ship. 456 chars. |
| R11   | 27 Mar | —      | 96      | —          | Prompt Lab | 9/9     | Session 3 retest. 600 chars. Tactile detail: cold iron, wet metal, slick stone. |

**Key architecture insight:** Flux uses T5-XXL (NOT CLIP). Full sentences produce better results than tags. Parenthetical weights appear as literal text in images. guidance_scale 3.5 means model follows prompt faithfully — precision matters more than emphasis tricks. Best-in-class photorealism.

**v2 improvements (built, not yet retested):**

- Rule 10: Texture minimum — at least 3 material/texture descriptions per output
- Rule 11: Negative-as-positive converter — strips "without X" phrases that T5-XXL would render as literal text
- Compliance gate: strips surviving negative phrases from output

**Status:** ✅ Wave 6 confirmed. ChatGPT 96. Consistent and improving. negativeSupport config corrected to `none` (Session 3).

### Wave 7: Video Cinematic (Runway, Luma, Kling)

**Representative tested:** Runway ML  
**Builder:** `group-video-cinematic.ts` (v1)  
**Compliance gates:** `enforceVideoCinematicCleanup` (strip syntax, weights, CLIP/SD tokens)

| Round | Date   | Claude | ChatGPT | Harmonised | Source     | Anchors | Key observation                                           |
| ----- | ------ | ------ | ------- | ---------- | ---------- | ------- | --------------------------------------------------------- |
| R11   | 26 Mar | 95     | —       | —          | Prompt Lab | 9/9     | First-time ship. 390 chars. Camera movement opens prompt. |
| R12   | 27 Mar | —      | 92      | —          | Prompt Lab | 9/9     | Session 3 retest. 419 chars. Motion language correct. Lacks material texture depth vs Flux/Recraft. |

**Key architecture insight:** Video platforms generate motion, not stills. Every prompt must imply movement — camera direction opens the prompt ("Low-angle tracking shot follows"), all verbs are active ("crash", "rises", "sweeps", "flickers"), temporal flow is implied. Concise and directive, not long descriptive paragraphs.

**Platform-specific groupKnowledge:**

- Runway: `[00:01]` timestamp syntax, no negatives
- Luma: `@style` keyword, `loop` keyword, no negatives
- Kling: `Shot 1:/Shot 2:` multi-shot, supports negative prompts

**Status:** ✅ Wave 7 confirmed. ChatGPT 92. Previous Claude-only 95 was lenient. 92 is the honest number for Runway. Luma/Kling ideal ranges tightened to 150–350 (Session 3 config fix).

### Wave 8: Remaining Dedicated (3 platforms)

**Builders built:** `group-novelai.ts`, `group-ideogram.ts`, `group-recraft.ts`  
**Router wired.** groupKnowledge added for all 3. **Tested Session 3 (27 Mar).**

**Recraft** (`group-recraft.ts`):

| Round | Date   | Claude | ChatGPT | Harmonised | Source     | Anchors | Key observation |
| ----- | ------ | ------ | ------- | ---------- | ---------- | ------- | --------------- |
| R12   | 27 Mar | —      | 96      | —          | Prompt Lab | 9/9     | v5 builder (lighthouse-hardcoded). 655 chars. All anchors, tactile textures, strong composition close. |

**⚠️ Important:** R12 score was achieved with v5 builder which hardcoded Lighthouse-specific anchors. v6 builder (scene-agnostic) was deployed Session 3 but not yet retested. R12 result reflects a builder that is not production-safe for non-Lighthouse inputs.

**Ideogram** (`group-ideogram.ts`):
- negativeSupport corrected from `inline` to `separate` (Session 3 config fix)
- Not yet retested post-fix

**NovelAI** (`group-novelai.ts`):
- Anime-optimised SD with CLIP encoder
- Triple-brace weighting: `{{{term}}}` = strongest, `{{term}}` = strong, `{term}` = moderate
- Tag-based (not prose), Danbooru-style vocabulary
- Quality prefix: `{{{masterpiece}}}`, `{{best quality}}`, `{{highly detailed}}`
- Compliance gate converts parenthetical weights to triple-brace
- Not yet retested Session 3

**Status:** ⚠️ Recraft 96 (v5, lighthouse-specific — v6 awaiting retest). Ideogram and NovelAI not yet tested with Lighthouse Keeper.

### Wave 9: Multi-Engine Aggregators (Freepik)

**Status:** Not started. Only 1 platform remaining (freepik). BlueWillow uses generic fallback.

---

## 5. Playground vs Prompt Lab Gap

**Discovered 26 Mar Session 1. Updated 27 Mar Session 3.**

| Wave | Platform      | Playground | Prompt Lab | Gap     | Notes                                                          |
| ---- | ------------- | ---------- | ---------- | ------- | -------------------------------------------------------------- |
| 1    | Stability     | Not tested | 86         | —       | Session 3 revised down from 92 (Claude-lenient). Real number. |
| 2    | Leonardo      | Not tested | 87         | —       | Session 3 revised down from 93 (Claude-lenient). Real number. |
| 3    | Midjourney    | 98         | 90         | **-8**  | Session 3 revised from 92. Slightly over-written.             |
| 4    | Canva (NL)    | 97         | 89         | **-8**  | Narrowed from -12 via 6 fixes. NL ceiling.                    |
| 4    | Firefly (NL)  | Not tested | 91         | —       | Session 3 first data point.                                    |
| 4    | G. Imagen (NL)| 94 (T3)    | 90         | **-4**  | **Session 3: assembled T3 beats optimised. Call 3 degrading.** |
| 5    | DALL-E        | 96         | 96         | **0**   | Session 3: gap closed. Consistent.                             |
| 6    | Flux          | Not tested | 96         | —       | Session 3 improved from 95.                                    |
| 7    | Runway        | Not tested | 92         | —       | Session 3 revised from 95 (Claude-only was lenient).           |
| 8    | Recraft       | Not tested | 96         | —       | Session 3 first data (v5 builder — v6 awaiting retest).        |

### Root Cause: GPT Compression Instinct (confirmed Session 2, reinforced Session 3)

For CLIP, MJ, DALL-E, Flux, and Video groups, the gap is minimal (0–8 points) because GPT has mechanical syntax work to do — rebalance weights, dedup parameters, strip brackets, add camera movement. There is clear structural "optimisation" work that GPT can do reliably.

For NL group, the gap persists AND Session 3 has shown Call 3 can go negative: Google Imagen assembled T3 (94) > Call 3 optimised (90). The builder adds synthetic phrasing ("Framed as a dramatic low-angle wide shot with layered depth from…") that sounds engineered rather than natural. GPT's instinct at temperature 0.4 is to demonstrate effort by adding compositional framing language — which scores lower than the clean assembled prose it started with.

**Session 3 conclusion:** Call 3 is worth its API cost on CLIP/MJ/DALL-E/Flux/Video groups where it has mechanical work to do. For the NL group (25 platforms), it actively degrades output. **The correct decision is to skip Call 3 for the NL group entirely and display assembled T3 as the optimised output.** This also eliminates unnecessary API spend on 25 of 40 platforms.

---

## 6. Schema Validation Failures

| Date   | Round | Platform   | Error                                           | Resolution            |
| ------ | ----- | ---------- | ----------------------------------------------- | --------------------- |
| 26 Mar | R6a   | Midjourney | "Engine response did not match expected format" | Retry succeeded (R6b) |

No new schema failures in Session 2.

---

## 7. Compliance Gate Effectiveness

| Gate                            | Scope               | Purpose                                              | Hit rate                 | Notes                                 |
| ------------------------------- | ------------------- | ---------------------------------------------------- | ------------------------ | ------------------------------------- |
| `enforceT1Syntax`               | Call 2 + Call 3     | Correct weight syntax (parenthetical ↔ double-colon) | ~20%                     | Works reliably                        |
| `enforceMjParameters` Step 1    | Call 2 + Call 3     | Dedup multiple --ar/--v/--s/--no blocks              | ~33% of T2 runs          | Catches R1/R5 pattern                 |
| `enforceMjParameters` Step 1b   | Call 2 + Call 3     | Dedup within single --no block                       | ~60% of T2 runs          | Catches R3/R4 pattern                 |
| `enforceMjParameters` Fusion    | Call 2 + Call 3     | Detect fused terms ("warped railing blurry")         | ~10% of T2 runs          | Catches boundary concatenation        |
| `enforceWeightCap(8)`           | Call 3 SD CLIP only | Cap weighted terms at 8                              | ~50% of Stability runs   | Strips lowest-weight terms            |
| `enforceClipKeywordCleanup`     | Call 3 SD CLIP only | Strip orphan verbs + leading articles                | Deployed — awaiting data | 30+ verbs in set                      |
| `enforceNaturalLanguageCleanup` | Call 3 NL only      | Strip surviving weights, flags, CLIP tokens          | Active                   | Critical safety net for NL            |
| `enforceDalleCleanup`           | Call 3 DALL-E only  | Strip syntax, weights, CLIP tokens                   | New (Session 2)          | DALL-E rewriter mangles syntax        |
| `enforceFluxCleanup`            | Call 3 Flux only    | Strip syntax, weights, CLIP tokens, negative phrases | New (Session 2)          | T5-XXL renders syntax as literal text |
| `enforceVideoCinematicCleanup`  | Call 3 Video only   | Strip syntax, weights, CLIP/SD tokens                | New (Session 2)          | Video models ignore image-gen syntax  |
| `enforceNovelAiSyntax`          | Call 3 NovelAI only | Convert (word:1.3) to {{{term}}} brace syntax        | New (Session 2)          | NovelAI uses unique weighting         |
| `enforceIdeogramCleanup`        | Call 3 Ideogram     | Strip syntax, weights, CLIP tokens                   | New (Session 2)          | Ideogram reads prose, not tags        |
| `enforceRecraftCleanup`         | Call 3 Recraft      | Strip syntax, weights, CLIP tokens                   | New (Session 2)          | Recraft is design-brief format        |
| `postProcessTiers` P1–P12       | Call 2 only         | Full post-processing pipeline                        | Always runs              | 12 processors                         |

---

## 8. Dual-Assessor Divergence Patterns

| Pattern                                             | Frequency    | Who's right         | Resolution                                                                         |
| --------------------------------------------------- | ------------ | ------------------- | ---------------------------------------------------------------------------------- |
| Claude higher on CLIP weight compliance             | 4/5 rounds   | Claude              | CLIP weight count is mechanical, not subjective                                    |
| ChatGPT higher on "visual richness"                 | 2/5 rounds   | ChatGPT (partially) | Spatial depth rule added R3                                                        |
| ChatGPT sycophancy drift (+2 on identical input)    | Confirmed 3x | Claude              | Discount ChatGPT absolutes, trust structural observations                          |
| ChatGPT scores T4 against original, not T4 contract | 3/5 rounds   | Claude              | T4's job is compression; ChatGPT penalises lost detail that T4 is designed to drop |
| Both flag same structural bug                       | 3/5 rounds   | Both                | Strongest signal — act immediately                                                 |
| ChatGPT identifies lost visual anchors in NL output | 2/2 (Canva)  | **ChatGPT**         | ChatGPT's structural analysis of missing details is trustworthy and actionable     |

---

## 9. Key Architectural Insights

### Call 2 vs Call 3 Quality Gap

Call 2 generates all 4 tiers in ONE system prompt with 30 rules. GPT's attention is split four ways.

Call 3 sends a DEDICATED system prompt per platform group. GPT's full attention is on one platform's rules. Results:

| Platform   | Call 3 Score | Method  |
| ---------- | ------------ | ------- |
| Stability  | 95           | Claude  |
| Leonardo   | 96           | Claude  |
| Midjourney | 92           | ChatGPT |
| Canva      | 89           | ChatGPT |
| DALL-E     | 95           | ChatGPT |
| Flux       | 95           | ChatGPT |
| Runway     | 95           | Claude  |

**Conclusion:** The generic 4-tier preview is the hook. The optimised output is the product.

### GPT Compression Instinct — Critical Discovery (Session 2)

GPT-5.4-mini at temperature 0.2 treats "optimise" as "simplify" for NL prose input. When it receives text that already reads as clean prose, it compresses rather than enriches. This was the root cause of the Canva gap (97 Playground → 82 initial Prompt Lab).

**What partially overcomes it:**

- Flipped framing (original as primary, T3 as reference)
- idealMin floor forcing output above T4 length
- Rule 10 explicit anti-compression
- Updated groupKnowledge removing "short" instructions

**What doesn't overcome it:**

- Rule 9 "always enrich" alone
- Raising idealMax
- Sending richer input (T3 instead of T4)
- Any bypass approach (double-fire timing defeats it)

**For CLIP/MJ/DALL-E/Flux/Video:** Not a problem. GPT has mechanical work to do (syntax conversion, weight rebalancing, camera movement addition). The "optimise" instinct produces genuinely better output.

### Flipped Framing for NL Group

For NL platforms, the user message is restructured:

```
SCENE DESCRIPTION TO OPTIMISE FOR [PLATFORM]:
[original human sentence — full visual intent]

REFERENCE DRAFT (use as structural starting point, enrich with ALL details):
[T3 natural language text — good structure, may have lost details]
```

This frames GPT's task as "write the best version of this scene" rather than "make this text shorter." Responsible for the jump from 85 to 89 for Canva.

### Original Sentence Bug — Fixed (Session 1, confirmed Session 2)

`humanText` from playground-workspace now reaches Call 3 via ref. Confirmed working via diagnostic logging in Session 2 (395 chars, full Lighthouse Keeper text). Benefits all 43 covered platforms.

### T3 Input for NL T4 Providers

`call3InputText` memo in `enhanced-educational-preview.tsx` detects NL group + T4 provider (e.g. Canva) and sends T3 text (~410 chars) instead of T4 (~245 chars) as the Call 3 input. Gives GPT richer starting material.

### Double-Fire Problem (Session 2 — ongoing)

The optimizer useEffect fires correctly on toggle-ON, but then re-fires when `aiTierPrompts` loads (changing `call3InputText`). The second fire can overwrite a good first result with a shorter one. A guard (`!aiOptimiseResult && !isAiOptimising`) was added to the debounced re-fire condition with correct React dependency array entries. This mitigates but does not fully prevent the issue due to React render timing.

---

## 10. Build History

### Session 1 (25–26 Mar) — Waves 1–4

| File                                           | Type | Purpose                                |
| ---------------------------------------------- | ---- | -------------------------------------- |
| `lib/optimise-prompts/platform-groups.ts`      | New  | Maps 45 providers → group IDs          |
| `lib/optimise-prompts/types.ts`                | New  | Shared types                           |
| `lib/optimise-prompts/resolve-group-prompt.ts` | New  | Router: provider → group → builder     |
| `lib/optimise-prompts/generic-fallback.ts`     | New  | Original buildSystemPrompt as fallback |
| `lib/optimise-prompts/index.ts`                | New  | Barrel export                          |
| `group-sd-clip-parenthetical.ts`               | New  | 12 platforms                           |
| `group-sd-clip-double-colon.ts`                | New  | 1 platform (Leonardo)                  |
| `group-midjourney.ts` (v2)                     | New  | 1 platform (Midjourney)                |
| `group-clean-natural-language.ts` (v3)         | New  | 21 platforms                           |

### Session 2 (26 Mar) — Waves 4 fixes + 5–8

**Wave 4 fixes (Canva NL — 82→89):**

| Fix                                                                                                                                   | Impact                                   |
| ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `groupKnowledge` updated: "Very short prompts preferred" → "Powered by Leonardo Phoenix. Prefers clear descriptive natural language." | Removed conflicting compression signal   |
| `idealMin/idealMax` floored at 280/400                                                                                                | Prevented GPT capping at 200 chars       |
| Rule 10: "NEVER SHORTEN — output < 280 chars = FAILURE"                                                                               | Explicit anti-compression                |
| T3 sent as input for NL T4 providers via `call3InputText`                                                                             | Richer starting material                 |
| Flipped framing (Idea 1) in `route.ts`                                                                                                | Original as primary, T3 as reference     |
| Double-fire guard with React deps                                                                                                     | Prevents second Call 3 overwriting first |

**New builders (Session 2):**

| File                              | Platforms               | Score | Status               |
| --------------------------------- | ----------------------- | ----- | -------------------- |
| `group-dalle-api.ts` (v1)         | 1 (OpenAI)              | 95    | ✅ Tested            |
| `group-flux-architecture.ts` (v2) | 1 (Flux)                | 95    | ✅ Tested            |
| `group-video-cinematic.ts` (v1)   | 3 (Runway, Luma, Kling) | 95    | ✅ Tested (Runway)   |
| `group-novelai.ts` (v1)           | 1 (NovelAI)             | —     | ⚠️ Built, not tested |
| `group-ideogram.ts` (v1)          | 1 (Ideogram)            | —     | ⚠️ Built, not tested |
| `group-recraft.ts` (v1)           | 1 (Recraft)             | —     | ⚠️ Built, not tested |

**Flux v2 improvements (built, not retested):**

- Rule 10: Texture minimum (3+ material descriptions)
- Rule 11: Negative-as-positive converter
- Compliance gate: strips surviving negative phrases

**Router state:** 10 active cases (sd-clip-parenthetical, sd-clip-double-colon, midjourney, clean-natural-language, dalle-api, flux-architecture, video-cinematic, novelai, ideogram, recraft). Only `multi-engine` (Freepik) remains.

---

## 11. Platform Coverage Summary

| Wave | Group                 | Platforms                                                                                                                                                                                                              | Count  | Builder                           | Score (honest) | Status         |
| ---- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------- | -------------- | -------------- |
| 1    | SD CLIP Parenthetical | stability, dreamlike, dreamstudio, fotor, lexica                                                                                                                                                                       | 5      | `group-sd-clip-parenthetical.ts`  | 86             | ⚠️ Revised     |
| 2    | SD CLIP Double-Colon  | leonardo                                                                                                                                                                                                               | 1      | `group-sd-clip-double-colon.ts`   | 87             | ⚠️ Revised     |
| 3    | Midjourney            | midjourney                                                                                                                                                                                                             | 1      | `group-midjourney.ts`             | 90             | ✅             |
| 4    | Clean NL              | bing, google-imagen, imagine-meta, canva, adobe-firefly, jasper-art, craiyon, hotpot, simplified, picsart, visme, vistacreate, 123rf, myedit, picwish, artbreeder, photoleap, pixlr, deepai, microsoft-designer, artguru, artistly, clipdrop, playground, bluewillow | 25 | `group-clean-natural-language.ts` | 89–91 | ⚠️ Skip Call 3 pending |
| 5    | DALL-E API            | openai                                                                                                                                                                                                                 | 1      | `group-dalle-api.ts`              | 96             | ✅             |
| 6    | Flux Architecture     | flux                                                                                                                                                                                                                   | 1      | `group-flux-architecture.ts`      | 96             | ✅             |
| 7    | Video Cinematic       | runway, luma-ai, kling                                                                                                                                                                                                 | 3      | `group-video-cinematic.ts`        | 92             | ✅             |
| 8    | Dedicated             | recraft                                                                                                                                                                                                                | 1      | `group-recraft.ts`                | 96 (v5)        | ⚠️ v6 awaiting retest |
| 8    | Dedicated             | ideogram, novelai                                                                                                                                                                                                      | 2      | 2 dedicated builders              | —              | ⚠️ Not tested  |
| 9    | Multi-Engine          | freepik                                                                                                                                                                                                                | 1      | Not built                         | —              | ❌             |
|      |                       | **TOTAL**                                                                                                                                                                                                              | **41** |                                   |                | **39 covered** |

---

## 12. Open Issues

| #   | Issue                                                                     | Severity | Status                                                                            |
| --- | ------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------- |
| 1   | T2 --no duplication in Call 2 (~60% of runs)                              | Medium   | 3 compliance gates deployed, persists. Cosmetic only.                             |
| 2   | Schema validation failures on Call 3 (intermittent)                       | Medium   | No new failures Session 2 or 3                                                    |
| 3   | Schema failure UX — error at bottom of page, no toast                     | Low      | UX fix needed                                                                     |
| 4   | **NL group Call 3 degrading output** — assembled T3 (94) > optimised (90) | **High** | **Session 3 confirmed. Decision needed: skip Call 3 for NL group entirely.**      |
| 5   | MJ slightly over-written — "knuckles white", "detonating" pushed           | Low      | Acceptable. 90 is still strong.                                                   |
| 6   | CLIP "purple copper clouds" — should be "purple-and-copper sky"            | Medium   | Persists in Call 3 output. Example 3 in builder has correct merge — GPT not applying consistently to all inputs. |
| 7   | CLIP key elements unweighted (jagged rocks, salt spray, dark cliffs)       | Medium   | Costs 4–6 points. Builder rules don't force weighting of all key anchors.         |
| 8   | Wave 8 (Ideogram, NovelAI) not yet tested                                 | Medium   | Built, wired, needs Prompt Lab testing                                            |
| 9   | Recraft v6 (scene-agnostic) not yet retested                              | Medium   | v5 scored 96 on Lighthouse but is not production-safe for other scenes            |
| 10  | Wave 9 (Freepik multi-engine) not built                                   | Low      | Last remaining platform                                                            |
| 11  | Double-fire overwrite on optimizer toggle                                  | Medium   | Guard added Session 2, may still occur                                            |
| 12  | **Call 3 negative output never displayed in Prompt Lab UI**               | **High** | `aiOptimiseResult.negative` is returned, stored in hook, never rendered. All Dynamic Negative Intelligence work is invisible to the user. |
| 13  | Call 3 negative output not gated by `negativeSupport` in route.ts         | Low      | Route always processes negative regardless of platform support. Not a user-visible bug now (issue 12 is the priority). |
| 14  | Security audit needed before launch                                        | High     | Not started                                                                       |

---

## 13. Next Session Priorities

1. **DECISION: Skip Call 3 for NL group** — assembled T3 beats optimised for Google Imagen (94 vs 90). Implement gate in `enhanced-educational-preview.tsx`: if provider is in `clean-natural-language` group, display T3 directly without firing Call 3. Saves API cost on 25 of 40 platforms and improves output quality.
2. **Fix CLIP "purple copper clouds" weakness** — add explicit compound colour rule to SD CLIP parenthetical and double-colon builders: "Multiple colour words describing the SAME element (purple, copper, sky) MUST be merged into a single hyphenated compound phrase: purple-and-copper sky." Add as a numbered rule, not just an example.
3. **Fix CLIP unweighted key elements** — add rule requiring all named nouns from the scene to receive a weight. Current builders allow important anchors (jagged rocks, salt spray, dark cliffs, warm orange windows) to fall through as unweighted. Add explicit instruction: "Every visually critical noun from the original scene must be weighted unless it is in the final background layer."
4. **Add Call 3 negative display to Prompt Lab UI** — `aiOptimiseResult.negative` is computed but never shown. Add a negative prompt panel below the optimised positive prompt, gated on `negativeSupport === 'separate'`. Until this is built, the Dynamic Negative Intelligence feature is entirely invisible.
5. **Retest Recraft v6** — v5 scored 96 on Lighthouse but hardcoded maritime anchors. v6 is scene-agnostic. Run Lighthouse Keeper to confirm parity, then run 2–3 non-maritime scenes to validate generalisation.
6. **Test Wave 8** — Ideogram and NovelAI with Lighthouse Keeper in Prompt Lab
7. **Build Wave 9** — Freepik multi-engine (last platform)

---

## 14. Changelog

| Date        | Version | Changes                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 25 Mar 2026 | 1.0.0   | Initial document. 3 rounds of Lighthouse Keeper data. Wave 1 (Stability) complete at 92.                                                                                                                                                                                                                                                                                                                                              |
| 26 Mar 2026 | 2.0.0   | Added R4–R6 data. Wave 2 (Leonardo, 93) and Wave 3 (Midjourney, 92) complete. Added §5 Playground gap, §6 schema failures, §9 architectural insights.                                                                                                                                                                                                                                                                                 |
| 26 Mar 2026 | 3.0.0   | Wave 4 (NL, 21 platforms) built. Original sentence bug discovered and fixed. Full R7 Canva data. Added §10 build history, §12 next priorities.                                                                                                                                                                                                                                                                                        |
| 26 Mar 2026 | 4.0.0   | **Session 2.** Wave 4 Canva iterated from 82→89 (6 fixes). Wave 5 DALL-E shipped at 95 (first-time). Wave 6 Flux shipped at 95 (first-time, v2 improvements built). Wave 7 Video shipped at 95 (first-time). Wave 8 built (NovelAI, Ideogram, Recraft) — not tested. 43/45 platforms covered. Added §11 platform coverage summary. ChatGPT scoring criteria documented. GPT compression instinct documented as architectural insight. |
| 27 Mar 2026 | 5.0.0   | **Session 3.** Full ChatGPT retest across all waves. All previous Claude-lenient scores revised: Stability 92→86, Leonardo 93→87, Runway 95→92, Midjourney 92→90. Flux 95→96, DALL-E 95→96 (both confirmed and improved). Recraft first test: 96 (v5, lighthouse-hardcoded — v6 scene-agnostic builder deployed, awaiting retest). **Critical finding: NL group Call 3 degrades output** — Google Imagen assembled T3 (94) beats optimised (90). Decision pending to skip Call 3 for NL group entirely. 5 platform-config.json data fixes applied (Recraft idealMin/idealMax, Flux/Ideogram negativeSupport, Luma-AI/Kling ideal ranges). Recraft builder rewritten v5→v6 (scene-agnostic). Critical new issue: `aiOptimiseResult.negative` never displayed in UI — all Dynamic Negative Intelligence output is invisible to user. Open issues updated, next priorities reordered by impact. |
