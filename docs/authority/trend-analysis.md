# Prompt Optimisation Trend Analysis

**Version:** 6.0.0  
**Created:** 25 March 2026  
**Updated:** 26 March 2026 (Session 4 — 40-platform sync)  
**Owner:** Promagen  
**Status:** Living document — updated every test round  
**Authority:** This document tracks scoring trends across all harmony rounds for the 4 generic tier outputs (Call 2) and platform-specific optimised outputs (Call 3). It is the single source of truth for deciding when to intervene on the generic tiers.

**Cross-references:**

- `ai-disguise.md` — Call 2 (tier generation) and Call 3 (optimisation) architecture
- `harmonizing-claude-openai.md` — Dual-assessor methodology, scoring criteria
- `prompt_engineering_specs_40_platforms_tier_classification_routing_logic.md` — Platform tier classification and routing logic (supersedes deleted `grouping-45-image-platforms-by-prompt-compatibility.md`)
- `harmony-compliance.ts` — Compliance gates (enforceT1Syntax, enforceMjParameters, enforceWeightCap, enforceClipKeywordCleanup)
- `lib/optimise-prompts/` — Group-specific system prompt builders (10 groups, `group-multi-engine.ts` deleted)

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

**Floor:** 86 · **Ceiling:** 93 · **Average:** 89 · **Trend:** Gradually improving  
**Status:** ⚠️ Monitoring — not at intervention threshold

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

**Floor:** 79 · **Ceiling:** 94 · **Average:** 86 · **Trend:** Content improving, --no duplication persistent  
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

**Floor:** 92 · **Ceiling:** 96 · **Average:** 94 · **Trend:** Stable to improving  
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

**Floor:** 87 · **Ceiling:** 92 · **Average:** 89 · **Trend:** Improving  
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

**Status:** ✅ Wave 1 complete. Harmonised 92.

### Wave 2: SD CLIP Double-Colon (Leonardo)

**Representative tested:** Leonardo AI  
**Builder:** `group-sd-clip-double-colon.ts`

| Round | Date   | Claude | ChatGPT | Harmonised | Weighted terms | Key observation                                       |
| ----- | ------ | ------ | ------- | ---------- | -------------- | ----------------------------------------------------- |
| R4    | 26 Mar | 96     | 88      | 93         | 7              | First-time hit. Correct :: syntax. Colour merge done. |

**Status:** ✅ Wave 2 complete. Harmonised 93.

### Wave 3: Midjourney Dedicated

**Representative tested:** Midjourney  
**Builder:** `group-midjourney.ts` (v2)

| Round | Date   | Claude | ChatGPT | Harmonised | Source     | Key observation                |
| ----- | ------ | ------ | ------- | ---------- | ---------- | ------------------------------ |
| PG v1 | 26 Mar | 97     | —       | —          | Playground | 4 sections, clean params       |
| PG v2 | 26 Mar | 98     | —       | —          | Playground | Rule 9 added, 10 --no terms    |
| R5    | 26 Mar | 88     | 92      | 90         | Prompt Lab | Near-identical output returned |
| R6b   | 26 Mar | 91     | 93      | 92         | Prompt Lab | "concept art" persists         |

**Status:** ✅ Wave 3 complete. Harmonised 92.

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

**Playground → Prompt Lab gap:** Narrowed from -12 to -8 (97 → 89).

**Root causes identified and fixed (Session 2):**

1. **humanText wiring** (Session 1) — original sentence now reaches Call 3
2. **groupKnowledge "Very short prompts preferred"** — was overriding enrichment rules. Fixed to "Powered by Leonardo Phoenix. Prefers clear descriptive natural language with visual specifics."
3. **idealMin/idealMax floor** — Canva's 50/200 was strangling GPT. Floored at 280/400.
4. **T3 sent as input** — NL T4 providers now get T3 (richer prose) as Call 3 input instead of T4
5. **Flipped framing (Idea 1)** — original sentence sent as "SCENE DESCRIPTION TO OPTIMISE", T3 as "REFERENCE DRAFT". Prevents GPT's "optimise = compress" instinct.
6. **Rule 10 anti-compression** — explicit "NEVER SHORTEN, output < 280 chars = FAILURE"

**GPT compression problem (Session 2 learning):** At temperature 0.2, GPT treats "optimise" as "simplify" for NL prose. No amount of prompt engineering fully overcomes this. Five separate fixes were attempted; the combination of all five brought Canva from 82 to 89. An NL bypass (returning original sentence directly) was attempted but failed due to React useEffect double-fire timing — the first Call 3 returned correctly (395 chars) but a second debounced re-fire overwrote it with a shorter result.

**Status:** ✅ Wave 4 complete. ChatGPT 89 (Canva). Flipped framing is the production path.

### Wave 5: DALL-E API (OpenAI)

**Representative tested:** DALL·E 3  
**Builder:** `group-dalle-api.ts` (v1)  
**Compliance gates:** `enforceDalleCleanup` (strip syntax, weights, CLIP tokens)

| Round | Date   | Claude | ChatGPT | Harmonised | Source     | Anchors | Key observation                       |
| ----- | ------ | ------ | ------- | ---------- | ---------- | ------- | ------------------------------------- |
| PG v1 | 26 Mar | 96     | —       | —          | Playground | 9/9     | All anchors, 385 chars, rewrite-proof |
| R9    | 26 Mar | 95     | 95      | 95         | Prompt Lab | 9/9     | First-time ship. 389 chars.           |

**Key architecture insight:** DALL-E 3 rewrites every prompt via GPT-4. The builder teaches GPT to write "rewrite-proof" prompts — every visual element is a named anchor that GPT-4 preserves during expansion. Vague modifiers get reinterpreted; specific nouns survive.

**Status:** ✅ Wave 5 complete. ChatGPT 95. First-time ship, no Playground iteration needed.

### Wave 6: Flux Architecture (Black Forest Labs)

**Representative tested:** Flux  
**Builder:** `group-flux-architecture.ts` (v1, improved to v2)  
**Compliance gates:** `enforceFluxCleanup` (strip syntax, weights, CLIP tokens, negative phrases)

| Round | Date   | Claude | ChatGPT | Harmonised | Source     | Anchors | Key observation             |
| ----- | ------ | ------ | ------- | ---------- | ---------- | ------- | --------------------------- |
| R10   | 26 Mar | 95     | 95      | 95         | Prompt Lab | 9/9     | First-time ship. 456 chars. |

**Key architecture insight:** Flux uses T5-XXL (NOT CLIP). Full sentences produce better results than tags. Parenthetical weights appear as literal text in images. guidance_scale 3.5 means model follows prompt faithfully — precision matters more than emphasis tricks. Best-in-class photorealism.

**v2 improvements (built, not yet retested):**

- Rule 10: Texture minimum — at least 3 material/texture descriptions per output
- Rule 11: Negative-as-positive converter — strips "without X" phrases that T5-XXL would render as literal text
- Compliance gate: strips surviving negative phrases from output

**Status:** ✅ Wave 6 complete. ChatGPT 95. First-time ship.

### Wave 7: Video Cinematic (Runway, Luma, Kling)

**Representative tested:** Runway ML  
**Builder:** `group-video-cinematic.ts` (v1)  
**Compliance gates:** `enforceVideoCinematicCleanup` (strip syntax, weights, CLIP/SD tokens)

| Round | Date   | Claude | ChatGPT | Harmonised | Source     | Anchors | Key observation                                           |
| ----- | ------ | ------ | ------- | ---------- | ---------- | ------- | --------------------------------------------------------- |
| R11   | 26 Mar | 95     | —       | —          | Prompt Lab | 9/9     | First-time ship. 390 chars. Camera movement opens prompt. |

**Key architecture insight:** Video platforms generate motion, not stills. Every prompt must imply movement — camera direction opens the prompt ("Low-angle tracking shot follows"), all verbs are active ("crash", "rises", "sweeps", "flickers"), temporal flow is implied. Concise and directive, not long descriptive paragraphs.

**Platform-specific groupKnowledge:**

- Runway: `[00:01]` timestamp syntax, no negatives
- Luma: `@style` keyword, `loop` keyword, no negatives
- Kling: `Shot 1:/Shot 2:` multi-shot, supports negative prompts

**Status:** ✅ Wave 7 complete. Claude 95 (Runway). First-time ship.

### Wave 8: Remaining Dedicated (3 platforms)

**Builders built:** `group-novelai.ts` (v2), `group-ideogram.ts` (v2), `group-recraft.ts` (v3)  
**Router wired.** groupKnowledge added for all 3. **Tested in Prompt Lab Session 3.**

**NovelAI** (`group-novelai.ts` v2):

- Anime-optimised SD with CLIP encoder
- Triple-brace weighting: `{{{term}}}` = strongest, `{{term}}` = strong, `{term}` = moderate
- Tag-based (not prose), Danbooru-style vocabulary
- Quality prefix: `{{{masterpiece}}}`, `{{best quality}}`, `{{highly detailed}}`
- Compliance gate converts parenthetical weights to triple-brace
- v2: Dynamic Negative Intelligence added, anatomy floor capped

| Round | Date   | Score | Weighted terms | Key observation                                                                     |
| ----- | ------ | ----- | -------------- | ----------------------------------------------------------------------------------- |
| R1    | 26 Mar | 86    | 8              | Correct triple-brace. All anchors present (minor softening). No negative generated. |

**Ideogram** (`group-ideogram.ts` v2):

- Industry leader for text-in-image rendering
- Quoted text in prompt = text to render: `"Hello World"`
- Magic Prompt rewrites input (like DALL-E)
- Design-focused: understands typography, kerning, composition grids
- ~150–160 word limit
- v2: Dynamic Negative Intelligence added, negative field now populated for paid users

| Round | Date   | Score | Chars | Key observation                                        |
| ----- | ------ | ----- | ----- | ------------------------------------------------------ |
| R1    | 26 Mar | 90    | 491   | All 9 anchors. Strong composition. Clean NL prose.     |
| R2    | 26 Mar | 86    | 398   | GPT over-compressed by ~90 chars. Variance, not a bug. |

**Recraft** (`group-recraft.ts` v3):

- Design-first platform with SVG vector output
- Hierarchical style/substyle taxonomy (25+ options)
- Prompts structured as design briefs: output type + subject + visual details + composition
- "Artistic level" slider inverts usual paradigm (lower = more prompt adherence)
- Supports scene-specific negative prompts
- v2: Dynamic Neg Intelligence, idealMin 150→200, zero-anchor-loss rule, spatial depth
- v3: Restructured — RULE ZERO (anchor preservation) front-loaded, PRE-FLIGHT CHECK added, rules reduced from 9 to 4

| Round | Date   | Score | Chars | Key observation                                                                                                            |
| ----- | ------ | ----- | ----- | -------------------------------------------------------------------------------------------------------------------------- |
| R1    | 26 Mar | 72    | 242   | v1: 4–5 lost anchors. GPT over-compressed.                                                                                 |
| R2    | 26 Mar | 70    | 259   | v1 retest: same compression. Confirmed input-side problem.                                                                 |
| R3    | 26 Mar | 68    | 245   | v2: zero-anchor-loss rule added but GPT ignored (Rule 7).                                                                  |
| R4    | 26 Mar | 62    | 239   | v3: RULE ZERO front-loaded. Still compressed. Root cause: assembled T1 input already stripped anchors before GPT saw them. |
| R5    | 26 Mar | 74    | 260   | Prose flip deployed (original sentence as primary input). +12 points. "pale gold" returned. Still 5/9 anchors.             |

**Root cause identified:** The assembled T1 CLIP prompt sent to GPT had already lost anchors during assembly. GPT was "optimising" text that was already degraded. Fix: prose-primary flip (same pattern as Clean NL group) deployed for all prose-based groups. Recraft still under-performs vs other prose groups — GPT's compression instinct persists despite system prompt rules.

**Status:** ✅ Wave 8 complete. Tested. Ideogram 90 (ship). NovelAI 86 (ship). Recraft 74 (functional, GPT compression is the ceiling — architectural, not builder).

### Wave 9: Multi-Engine Aggregators — REMOVED (26 Mar 2026)

**Builder:** `group-multi-engine.ts` — **deleted**  
**Platforms removed:** NightCafe, OpenArt, Tensor.Art, GetImg, Freepik (5 platforms)

The multi-engine aggregators were removed from the active roster because their dynamic model-routing requirement made single-tier assignment impossible. Freepik was the only platform tested (scored 73). The builder file and route case have been deleted.

| Round | Date   | Score | Chars | Key observation (historical)                                                            |
| ----- | ------ | ----- | ----- | --------------------------------------------------------------------------------------- |
| R1    | 26 Mar | 73    | 260   | 5/9 anchors. Same GPT compression pattern as Recraft. Builder was architecturally sound. |

**Status:** ❌ Removed. Platform count reduced 45→40. BlueWillow moved to Clean NL group.

---

## 5. Playground vs Prompt Lab Gap

**Discovered 26 Mar Session 1. Updated 26 Mar Session 2.**

| Wave | Platform   | Playground | Prompt Lab | Gap    | Notes                         |
| ---- | ---------- | ---------- | ---------- | ------ | ----------------------------- |
| 1    | Stability  | Not tested | 95         | —      |                               |
| 2    | Leonardo   | Not tested | 96         | —      |                               |
| 3    | Midjourney | 98         | 92         | **-6** |                               |
| 4    | Canva (NL) | 97         | 89         | **-8** | Narrowed from -12 via 6 fixes |
| 5    | DALL-E     | 96         | 95         | **-1** | Effectively closed            |
| 6    | Flux       | Not tested | 95         | —      | First-time ship               |
| 7    | Runway     | Not tested | 95         | —      | First-time ship               |

### Root Cause: GPT Compression Instinct (confirmed Session 2)

For CLIP, MJ, and DALL-E groups, the gap is minimal (0–6 points) because GPT has mechanical syntax work to do — rebalance weights, dedup parameters, strip brackets. There's clear "optimisation" work.

For NL group, the gap is widest (-8) because the input is already "good enough" prose. GPT's instinct at temperature 0.2 is to "simplify" when the input looks clean. Rule 9 ("always enrich"), Rule 10 ("never shorten"), flipped framing, and idealMin floor all helped but couldn't fully overcome this instinct.

**Conclusion:** The NL gap is a fundamental limitation of using GPT for NL-to-NL optimisation. 89 is the practical ceiling without switching models or temperature. For CLIP/MJ/DALL-E/Flux/Video, the gap is effectively closed.

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
| Ideogram   | 90           | Claude  |
| NovelAI    | 86           | Claude  |
| Recraft    | 74           | Claude  |
| Freepik    | 73           | Claude  |

**Conclusion:** The generic 4-tier preview is the hook. The optimised output is the product.

### GPT Compression Instinct — Critical Discovery (Session 2, expanded Session 3)

GPT-5.4-mini at temperature 0.2 treats "optimise" as "simplify" for NL prose input. When it receives text that already reads as clean prose, it compresses rather than enriches. This was the root cause of the Canva gap (97 Playground → 82 initial Prompt Lab).

**Session 3 expansion:** The compression instinct is not limited to NL platforms. Recraft (74) and Freepik (73) both hit the same wall. Even with RULE ZERO front-loaded, PRE-FLIGHT CHECK at the end, rules reduced from 9 to 4, and the prose-primary flip deployed — GPT still compresses to ~240–260 chars when the sweet spot is 250–400. System prompt restructuring (v2→v3) had zero measurable effect. The prose-primary flip helped (+12pts for Recraft) but did not eliminate the behaviour. This is a GPT behavioural limit at temperature 0.2, not a fixable builder bug.

**What partially overcomes it:**

- Flipped framing (original as primary, assembled as reference) — +4pts Canva, +12pts Recraft
- idealMin floor forcing output above T4 length
- Rule 10 explicit anti-compression
- Updated groupKnowledge removing "short" instructions

**What doesn't overcome it:**

- Rule 9 "always enrich" alone
- Raising idealMax
- Sending richer input (T3 instead of T4)
- Any bypass approach (double-fire timing defeats it)
- Front-loading anchor preservation rules (RULE ZERO — v3 showed no improvement)
- PRE-FLIGHT CHECK before JSON return
- Reducing rule count (9→4 made no difference)

**For CLIP/MJ/DALL-E/Flux/Video:** Not a problem. GPT has mechanical work to do (syntax conversion, weight rebalancing, camera movement addition). The "optimise" instinct produces genuinely better output.

### Flipped Framing for Prose-Based Groups

For all prose-based platforms (7 groups, 28 platforms), the user message is restructured:

```
SCENE DESCRIPTION TO OPTIMISE FOR [PLATFORM]:
[original human sentence — full visual intent]

REFERENCE DRAFT (use as structural starting point, enrich with ALL details):
[assembled text — good structure, may have lost details]
```

This frames GPT's task as "write the best version of this scene" rather than "make this text shorter."

**Groups using prose-primary flip:** clean-natural-language, recraft, ideogram, dalle-api, flux-architecture, video-cinematic.

**Groups NOT flipped (CLIP/syntax-primary):** sd-clip-parenthetical, sd-clip-double-colon, midjourney, novelai. These need the assembled prompt as primary because it contains correct syntax/weights that GPT must preserve.

Originally deployed for NL group only (Session 2, +4pts for Canva). Expanded to all 7 prose groups in Session 3 after Recraft root cause analysis proved T1 assembly was stripping anchors before GPT saw them.

### Original Sentence Bug — Fixed (Session 1, confirmed Session 2)

`humanText` from playground-workspace now reaches Call 3 via ref. Confirmed working via diagnostic logging in Session 2 (395 chars, full Lighthouse Keeper text). Benefits all 40 covered platforms.

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

| File                              | Platforms               | Score | Status                |
| --------------------------------- | ----------------------- | ----- | --------------------- |
| `group-dalle-api.ts` (v1)         | 1 (OpenAI)              | 95    | ✅ Tested             |
| `group-flux-architecture.ts` (v2) | 1 (Flux)                | 95    | ✅ Tested             |
| `group-video-cinematic.ts` (v1)   | 3 (Runway, Luma, Kling) | 95    | ✅ Tested (Runway)    |
| `group-novelai.ts` (v1)           | 1 (NovelAI)             | 86    | ✅ Tested (Session 3) |
| `group-ideogram.ts` (v1)          | 1 (Ideogram)            | 90    | ✅ Tested (Session 3) |
| `group-recraft.ts` (v1)           | 1 (Recraft)             | 74    | ✅ Tested (Session 3) |

**Flux v2 improvements (built, not retested):**

- Rule 10: Texture minimum (3+ material descriptions)
- Rule 11: Negative-as-positive converter
- Compliance gate: strips surviving negative phrases

**Router state:** 10 active cases (sd-clip-parenthetical, sd-clip-double-colon, midjourney, clean-natural-language, dalle-api, flux-architecture, video-cinematic, novelai, ideogram, recraft). All groups covered. BlueWillow moved to clean-natural-language.

### Session 3 (26 Mar) — Wave 8 testing + Wave 9 build + Dynamic Negative Intelligence

**Wave 8 tested (NovelAI, Ideogram, Recraft):**

| Platform | Score | Key finding                                                       |
| -------- | ----- | ----------------------------------------------------------------- |
| Ideogram | 90    | All 9 anchors survived. Clean prose. Production quality.          |
| NovelAI  | 86    | Correct triple-brace syntax. Minor softening of 2 anchors.        |
| Recraft  | 74    | 5/9 anchors after prose-flip fix. GPT compression is the ceiling. |

**Recraft iteration log (v1→v3):**

| Version | Change                                                              | Score | Outcome                                                                               |
| ------- | ------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------- |
| v1      | Initial builder                                                     | 72    | 4–5 lost anchors. GPT over-compressed to 242 chars.                                   |
| v2      | Dynamic Neg Intelligence, idealMin 150→200, zero-anchor-loss Rule 7 | 62    | Regression. Rule 7 buried at position 7, GPT ignored it.                              |
| v3      | RULE ZERO front-loaded, PRE-FLIGHT CHECK, rules reduced 9→4         | 62    | No improvement. Root cause was upstream: T1 assembled input already stripped anchors. |
| v3+flip | Prose-primary flip: original sentence as primary input              | 74    | +12 points. "pale gold" and "jagged rocks" returned. GPT compression remains.         |

**Root cause analysis:** System prompt restructuring (v2, v3) had no effect because the problem was upstream. The T1 assembled CLIP prompt sent to GPT had already lost anchors during assembly. GPT was "optimising" text that was already degraded. Fix: prose-primary flip (same pattern as Clean NL group) deployed for all 6 prose-based groups (clean-natural-language, recraft, ideogram, dalle-api, flux-architecture, video-cinematic).

**Dynamic Negative Intelligence (Extra 2) — shipped:**

Applied to 6 builders with negative prompt support:

- `group-sd-clip-parenthetical.ts` — 7-point failure-mode analysis
- `group-sd-clip-double-colon.ts` — 7-point failure-mode analysis
- `group-midjourney.ts` — --no section replaced with structured framework
- `group-novelai.ts` — 7 modes + anime medium mismatch, anatomy floor capped
- `group-ideogram.ts` — negative field now populated for paid users
- `group-recraft.ts` — 5 failure modes (trimmed from 7)

Failure-mode analysis framework: mood inversion, era contamination, subject corruption, colour drift, atmosphere collapse, scale distortion, medium mismatch. Quality floor capped at 3–5 generic terms. Rest must be scene-specific.

**Negative-Positive Contradiction Guard (Extra B) — shipped:**

`enforceNegativeContradiction()` added to `harmony-compliance.ts`. Tokenises positive + negative prompts, strips terms appearing in both (50%+ word overlap threshold). Wired as Step 1.5 in the route compliance chain.

**Wave 9 built then removed (Freepik multi-engine):**

| File                         | Platforms   | Score | Status              |
| ---------------------------- | ----------- | ----- | ------------------- |
| `group-multi-engine.ts` (v1) | 1 (Freepik) | 73    | ❌ Removed (26 Mar) |

**Prose-primary flip expanded:**

`route.ts` updated: `proseGroups` set now includes clean-natural-language, recraft, ideogram, dalle-api, flux-architecture, video-cinematic. All prose-based groups receive the original human sentence as primary input, assembled T1 as reference.

**40/40 platforms covered. All active waves complete. Wave 9 (multi-engine) removed.**

---

## 11. Platform Coverage Summary

**v6.0.0 (26 Mar 2026):** Synced to 40-platform reality. 5 multi-engine aggregators removed (nightcafe, openart, tensor-art, getimg, freepik). `group-multi-engine.ts` deleted. 19 tier corrections applied — artguru/artistly/clipdrop moved from SD CLIP to Clean NL, fotor moved from NL to SD CLIP, playground moved from SD CLIP to Clean NL, bluewillow moved from generic fallback to Clean NL.

| Wave | Group                 | Platforms                                                                                                                                                                                                                                              | Count  | Builder                           | Score | Status           |
| ---- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | --------------------------------- | ----- | ---------------- |
| 1    | SD CLIP Parenthetical | stability, dreamlike, dreamstudio, fotor, lexica                                                                                                                                                                                                       | 5      | `group-sd-clip-parenthetical.ts`  | 92    | ✅               |
| 2    | SD CLIP Double-Colon  | leonardo                                                                                                                                                                                                                                               | 1      | `group-sd-clip-double-colon.ts`   | 93    | ✅               |
| 3    | Midjourney            | midjourney                                                                                                                                                                                                                                             | 1      | `group-midjourney.ts`             | 92    | ✅               |
| 4    | Clean NL              | bing, google-imagen, imagine-meta, canva, adobe-firefly, jasper-art, craiyon, hotpot, simplified, picsart, visme, vistacreate, 123rf, myedit, picwish, artbreeder, photoleap, pixlr, deepai, microsoft-designer, artguru, artistly, clipdrop, playground, bluewillow | 25     | `group-clean-natural-language.ts` | 89    | ✅               |
| 5    | DALL-E API            | openai                                                                                                                                                                                                                                                 | 1      | `group-dalle-api.ts`              | 95    | ✅               |
| 6    | Flux Architecture     | flux                                                                                                                                                                                                                                                   | 1      | `group-flux-architecture.ts`      | 95    | ✅               |
| 7    | Video Cinematic       | runway, luma-ai, kling                                                                                                                                                                                                                                 | 3      | `group-video-cinematic.ts`        | 95    | ✅               |
| 8    | NovelAI Dedicated     | novelai                                                                                                                                                                                                                                                | 1      | `group-novelai.ts`                | 86    | ✅               |
| 8    | Ideogram Dedicated    | ideogram                                                                                                                                                                                                                                               | 1      | `group-ideogram.ts`               | 90    | ✅               |
| 8    | Recraft Dedicated     | recraft                                                                                                                                                                                                                                                | 1      | `group-recraft.ts`                | 74    | ✅ (GPT ceiling) |
|      |                       | **TOTAL**                                                                                                                                                                                                                                              | **40** |                                   |       | **40 covered**   |

---

## 12. Open Issues

| #   | Issue                                                 | Severity | Status                                                                                                                                                                                             |
| --- | ----------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | T2 --no duplication in Call 2 (~60% of runs)          | Medium   | 3 compliance gates deployed, persists                                                                                                                                                              |
| 2   | Schema validation failures on Call 3 (intermittent)   | Medium   | No new failures in Sessions 2–3                                                                                                                                                                    |
| 3   | Schema failure UX — error at bottom of page, no toast | Low      | UX fix needed                                                                                                                                                                                      |
| 4   | NL group compression: GPT ceiling at 89 for Canva     | Medium   | Accepted — flipped framing is production path                                                                                                                                                      |
| 5   | MJ "concept art" persists despite Rule 9              | Low      | GPT partially ignores style commitment                                                                                                                                                             |
| 6   | MJ --no duplication in Call 3 output                  | Low      | Content strong, cosmetic issue                                                                                                                                                                     |
| 7   | Recraft anchor loss: GPT compresses despite rules     | Medium   | Root cause: GPT compression instinct. Prose flip helped (+12 pts) but ceiling at 74. System prompt restructuring (v2→v3) did not fix — this is a GPT behavioural limit, not a builder bug.         |
| 8   | GPT compression on all prose-group platforms          | Medium   | Freepik (73), Recraft (74) share the same pattern. Prose-primary flip deployed for all 6 prose groups. Further improvement requires either stronger anti-compression framing or a different model. |
| 9   | Double-fire overwrite on optimizer toggle             | Medium   | Guard added, may still occur                                                                                                                                                                       |
| 10  | Security audit needed before launch                   | High     | Not started                                                                                                                                                                                        |

---

## 13. Next Session Priorities

1. **Retest Flux** with v2 improvements (texture minimum, negative-as-positive)
2. **Retest Recraft** with prose-flip + v3 builder — verify if the +12pt improvement holds across multiple runs
3. **Extra 1: Platform-native example injection** — add second BEFORE→AFTER example per builder showing platform's unique strength (anime for NovelAI, typography for Ideogram, vector for Recraft, etc.)
4. **Investigate GPT compression ceiling** — Recraft (74) and Freepik (73) both hit the same wall. Options: stronger anti-compression framing in user message, temperature adjustment, or accept as GPT behavioural limit
5. **YouTube/social media content strategy** when product is shelf-ready
6. **Full security audit** before launch
7. **Pro subscription payment system** — Stripe setup

---

## 14. Changelog

| Date        | Version | Changes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 25 Mar 2026 | 1.0.0   | Initial document. 3 rounds of Lighthouse Keeper data. Wave 1 (Stability) complete at 92.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 26 Mar 2026 | 2.0.0   | Added R4–R6 data. Wave 2 (Leonardo, 93) and Wave 3 (Midjourney, 92) complete. Added §5 Playground gap, §6 schema failures, §9 architectural insights.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 26 Mar 2026 | 3.0.0   | Wave 4 (NL, 21 platforms) built. Original sentence bug discovered and fixed. Full R7 Canva data. Added §10 build history, §12 next priorities.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 26 Mar 2026 | 4.0.0   | **Session 2.** Wave 4 Canva iterated from 82→89 (6 fixes). Wave 5 DALL-E shipped at 95 (first-time). Wave 6 Flux shipped at 95 (first-time, v2 improvements built). Wave 7 Video shipped at 95 (first-time). Wave 8 built (NovelAI, Ideogram, Recraft) — not tested. 43/45 platforms covered. Added §11 platform coverage summary. ChatGPT scoring criteria documented. GPT compression instinct documented as architectural insight.                                                                                                                                                                                                                                                                                    |
| 26 Mar 2026 | 5.0.0   | **Session 3.** Wave 8 tested: Ideogram 90, NovelAI 86, Recraft 74 (GPT compression ceiling). Recraft iterated v1→v3 + prose-flip — root cause identified as upstream T1 assembly stripping anchors, not system prompt ordering. Wave 9 Freepik multi-engine built and tested at 73 — **45/45 platforms covered, all waves complete.** Dynamic Negative Intelligence shipped across 6 builders (7-point failure-mode analysis framework). Negative-Positive Contradiction Guard shipped in harmony-compliance.ts. Prose-primary flip expanded from 1 group to 7 prose-based groups. §11 updated to show all 45 platforms. §12 open issues updated (Wave 7/8 resolved, GPT compression documented as architectural limit). |
| 26 Mar 2026 | 6.0.0   | **40-platform sync.** Deep research audit: 19 tier corrections applied. 5 multi-engine aggregators removed (NightCafe, OpenArt, Tensor.Art, GetImg, Freepik). `group-multi-engine.ts` deleted. Platform count 45→40. §11 rewritten: Wave 1 SD CLIP 12→5, Wave 4 Clean NL 21→25, Wave 9 removed, generic fallback removed (BlueWillow→Clean NL). Cross-references updated: `grouping-45-image-platforms-by-prompt-compatibility.md` deleted, superseded by `prompt_engineering_specs_40_platforms_tier_classification_routing_logic.md`. Router state 11→10 cases. proseGroups 7→6 (multi-engine removed). All "45" references updated to "40" except historical changelog entries. |
