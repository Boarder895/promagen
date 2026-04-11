# Call 3 Quality Architecture — v0.2.0

**Status:** Architecture draft, round 2. For ChatGPT scoring and freeze decision.  
**Author:** Claude (via Martin)  
**Audience:** ChatGPT (independent assessor), Martin (decision-maker), future implementation chats.  
**Date:** 11 April 2026  
**Target score:** 96+ from ChatGPT. If achieved, freeze and start building.  
**Round 1 score:** 92/100. Four structural concerns identified + five additions proposed. All addressed in this version.

> **Cross-references:**
>
> - `api-3.md` v3.0.0 — Current Call 3 authority doc (preflight engine, regression guard, zone system)
> - `call-2-quality-architecture-v1.0.0.md` — Call 2 harness (built, operational, proven methodology)
> - `harmonizing-claude-openai.md` v4.0.0 — System prompt engineering playbook
> - `builder-quality-intelligence.md` v3.0.0 — BQI regression testing (12 parts deployed)
> - `optimal-prompt-stacking.md` v4.0.0 — Per-platform encoder research and stacking limits
> - `trend-analysis.md` v5.0.0 — Scoring data, NL degradation evidence, playground gap analysis
> - `prompt_engineering_specs_40_platforms.md` — Encoder architectures, token limits, negative support
> - `platform-config.json` + `platform-config.ts` — Platform SSOT (40 platforms)

---

## 0. What changed since v0.1.0

ChatGPT scored v0.1.0 at 92/100 and identified four structural concerns. Claude proposed five additions. v0.2.0 integrates all nine.

**ChatGPT's four fixes (all adopted):**

1. **§3 rewritten** — Encoder science split into three tiers: measured/known constraints, working hypotheses, and Promagen empirical assumptions. No more pseudo-exact percentages presented as fact.
2. **§5 AVIS upgraded** — Formula now includes cohesion penalty and token cost divisor: `score = impact × attention × cohesion ÷ token_cost`. Addresses the fragment/interaction coupling problem ChatGPT identified.
3. **§6 APS upgraded** — Primary quantitative gate plus three vetoes (critical-anchor loss, invented-content injection, semantic distortion). Thresholds shifted per ChatGPT's recommendation. No longer a lone acceptance criterion.
4. **§12 shipping rule upgraded** — Flat +5 replaced with headroom-based rule: "achieve ≥50% of available headroom." Platforms with high baselines get softer targets; platforms with low baselines get harder ones.

**Five additions (all new in v0.2.0):**

5. **§5.4 Semantic Density** — Within-phrase compression metric. "Weathered old lighthouse keeper" (5 tokens) → "grizzled lighthouse keeper" (3 tokens). Density score feeds the AVIS token_cost term.
6. **§7.3 Platform Hallucination Map** — Per-platform, per-scene-type characteristic failure modes feeding the Negative Intelligence Engine. Built incrementally from BQI data.
7. **§4.1 `promptStylePreference` added** — First-class field in DNA profile per ChatGPT's recommendation. Primary: encoderFamily. Secondary: promptStylePreference. Tier is downstream.
8. **§13 failure mode #8 added** — "It will optimise the score proxy instead of the image outcome" (ChatGPT's catch).
9. **§13 failure mode #9 added** — "It will optimise one scene type and regress another" (scene-type coverage risk from Lighthouse Keeper overuse).
10. **§8 retry protocol now platform-gated** — Only fires on platforms with measured retry recovery rate. Not generic.

---

## 1. The problem in one paragraph

Call 3 takes a prompt that Call 2 already scored 95/100 and tries to make it better for a specific platform. This is the hardest optimisation problem in the system: the input is already very good, and the margin for improvement is narrow while the margin for degradation is wide. GPT at temperature 0.4 treats "optimise" as an invitation to demonstrate effort — adding synthetic compositional language that sounds engineered rather than natural. Google Imagen's assembled T3 scored 94; Call 3's optimised version scored 90. The current defensive solution (moving 31 platforms to deterministic-only modes) prevents degradation but also prevents improvement. Call 3 needs to transition from "don't make it worse" to "make it measurably better, platform by platform, using encoder-informed restructuring rather than LLM improvisation."

---

## 2. The five laws

Every decision in this architecture flows from five laws. These are non-negotiable.

1. **The Encoder Is The Audience.** The user never reads the prompt. The platform's text encoder reads it. Optimisation means restructuring for encoder processing characteristics, not human readability. A prompt that reads beautifully but places critical anchors outside the encoder's effective processing window is a failed optimisation.

2. **Preservation Outranks Enrichment.** A prompt that keeps all 9 visual anchors in the right order is better than one that adds a 10th anchor but drops 2 originals. The preservation gate is not a safety net — it is the primary quality gate.

3. **Deterministic Beats Probabilistic.** Every transform that can be expressed as code must be code. GPT is called only when semantic rewriting is the transform — never for structural, syntactic, or positional changes that code can do perfectly every time.

4. **Each Platform Gets Exactly What It Needs.** No generic optimisation. Each platform has a Platform DNA Profile that defines its encoder type, processing characteristics, token budget, and the specific transforms that add measurable value. Transforms not on the list are banned.

5. **Headroom Or Don't Ship.** If a platform's Call 3 output does not achieve at least 50% of its available quality headroom (ceiling minus baseline), that platform's Call 3 should be `pass_through`. The threshold is relative, not absolute — a 2-point gain on a platform with 4 points of headroom is worth shipping; a 4-point gain on a platform with 15 points of headroom is not.

---

## 3. What the encoder actually processes — three tiers of certainty

This section is the foundation everything else builds on. v0.1.0 was rightly criticised for presenting engineering heuristics as established science. v0.2.0 separates what is known, what is hypothesised, and what Promagen assumes empirically.

### 3.1 Measured and known constraints (high confidence)

These are documented in platform APIs, model cards, or confirmed by published research:

| Constraint                                                                         | Source                                             | Confidence      |
| ---------------------------------------------------------------------------------- | -------------------------------------------------- | --------------- |
| CLIP ViT-L/14 has a hard 77-token context window                                   | OpenAI CLIP paper, Stability docs                  | Confirmed       |
| Tokens beyond 77 are silently truncated by CLIP                                    | Architecture constraint, widely documented         | Confirmed       |
| T5-XXL has a 512-token context window                                              | Google T5 paper, Flux documentation                | Confirmed       |
| DALL-E 3 rewrites all prompts via GPT-4 before diffusion                           | OpenAI API documentation, `revised_prompt` field   | Confirmed       |
| Midjourney uses `::` for explicit multi-prompt weighting                           | Midjourney documentation                           | Confirmed       |
| Midjourney word-position influence decays: words 1–5 very influential, 40+ ignored | Community testing, confirmed by Midjourney founder | High confidence |
| SDXL uses dual CLIP encoders (ViT-L/14 + OpenCLIP ViT-bigG)                        | Stability model card                               | Confirmed       |
| NovelAI V4+ uses T5 encoder (512 tokens)                                           | NovelAI documentation                              | Confirmed       |
| Kling uses ChatGLM3-6B (256 tokens / 2,500 chars)                                  | Kling API documentation                            | Confirmed       |

### 3.2 Working hypotheses (moderate confidence)

These are engineering-informed beliefs supported by published research patterns but not directly measured in Promagen's stack:

| Hypothesis                                                                                                                                                    | Basis                                                                                                                                                                                  | What would change our mind                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| CLIP's practical attention weight is front-loaded: earlier tokens have stronger influence on the generated image than later tokens within the 77-token window | Research on CLIP's positional embeddings, community A/B testing, Promagen's own stacking research showing diminishing returns past position ~30                                        | Controlled generation tests with anchors at different positions producing identical images would disprove this                                     |
| T5's diffusion cross-attention layer gives disproportionate weight to early clauses, even though T5 itself has near-uniform self-attention                    | Observed in practice: first-sentence anchors dominate generated images on Flux. Architecturally plausible because cross-attention Q vectors are learned by the diffusion model, not T5 | A systematic test placing the same anchor at sentence 1 vs sentence 3 producing identical images would disprove this                               |
| DALL-E's GPT-4 rewriting preserves specific concrete descriptions better than vague ones                                                                      | Consistent with LLM behaviour: specific nouns survive paraphrasing, vague adjectives get expanded                                                                                      | A test showing "dramatic lighting" survives rewriting as faithfully as "pale gold beam cutting through sheets of driving rain" would disprove this |

### 3.3 Promagen empirical assumptions (lower confidence, subject to revision)

These are operational assumptions based on Promagen's own testing. They guide implementation but should be re-evaluated as evidence accumulates:

| Assumption                                                                                                                                    | Basis                                                                                           | Review trigger                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| For CLIP platforms, placing the primary subject in the first 15 tokens produces measurably better images than placing it after token 30       | Promagen harmony testing on Stability/Leonardo (limited sample size)                            | BQI batch scoring with positional A/B variant — if no measurable difference, downgrade to optional                     |
| For NL platforms, GPT restructuring at temperature 0.4 adds synthetic filler more often than genuine value                                    | Google Imagen (assembled T3: 94, optimised: 90), Canva (6 rounds peaked at 89 vs assembled 94)  | A harmony pass that consistently shows GPT output scoring higher than assembled on 3+ NL platforms would disprove this |
| Quality prefix tokens ("masterpiece, best quality") contribute measurable image quality improvement on CLIP platforms but not on T5 platforms | CLIP training data association; T5 processes them as natural language without special treatment | Controlled generation test with/without quality prefix on Stability vs Flux                                            |
| Proprietary encoders (Recraft, Luma, Ideogram, Firefly, Canva) are best profiled empirically because their architectures are undocumented     | No public documentation exists                                                                  | If any platform publishes their encoder architecture, move relevant items to §3.1                                      |

### 3.4 The four encoder families

| Encoder family    | Platforms                                                                              | Token limit             | Processing model                                                                                       | Key engineering insight                                                                                                                         |
| ----------------- | -------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **CLIP ViT-L/14** | 7 T1 platforms (Stability, DreamStudio, Dreamlike, Leonardo, Lexica, Fotor, NovelAI\*) | 77 tokens hard          | Front-loaded practical importance; severe token budget                                                 | Every token is precious. Subject and primary action should lead. Tokens near the limit have diminishing practical influence.                    |
| **T5-XXL**        | Flux, Google Imagen, NovelAI V4+                                                       | 512 tokens              | Near-uniform self-attention; first clause disproportionately influential in practice (§3.2 hypothesis) | Full sentences work. Natural language outperforms keywords. Quality tags unnecessary. First sentence should contain the complete scene premise. |
| **LLM-based**     | DALL-E 3 (GPT-4 rewrite), Kling (ChatGLM3-6B), Midjourney (proprietary)                | Varies (256–6000 chars) | Semantic understanding; narrative relationships processed                                              | Specificity survives rewriting. Vague modifiers get expanded unpredictably. Weight syntax (MJ) gives explicit attention control.                |
| **Proprietary**   | Recraft, Luma Photon, Ideogram, Adobe Firefly, Canva                                   | Platform-specific       | Unknown, empirically profiled (§3.3)                                                                   | Black boxes. Profile through testing: what descriptions produce the best images?                                                                |

\*NovelAI spans both families: V3 uses CLIP, V4+ uses T5. The platform-config determines which path.

---

## 4. The Platform DNA Profile

Every platform gets a research-backed profile. This is the master reference for all Call 3 decisions about that platform.

### 4.1 Profile schema

```typescript
interface PlatformDNA {
  /** Platform identifier — matches platform-config.json */
  id: string;

  /** Primary classification axis: encoder processing architecture */
  encoderFamily: "clip" | "t5" | "llm_rewrite" | "llm_semantic" | "proprietary";

  /** Secondary classification: how the prompt should be written */
  promptStylePreference:
    | "weighted_keywords"
    | "structured_nl"
    | "freeform_nl"
    | "mixed";

  /** Syntax mode for weight/parameter handling */
  syntaxMode: "parenthetical" | "double_colon" | "curly_brace" | "none";

  /** How the platform handles negatives */
  negativeMode:
    | "separate_field"
    | "inline"
    | "converted"
    | "none"
    | "counterproductive";

  /** Hard token limit (77 for CLIP, 512 for T5, null for unconstrained) */
  tokenLimit: number | null;

  /** Character ceiling enforced by Call 3 */
  charCeiling: number;

  /** Processing characteristics — working hypotheses (§3.2) and empirical assumptions (§3.3) */
  processingProfile: {
    /** Engineering estimate of front-load importance (0.0 = uniform, 1.0 = extreme front-bias) */
    frontLoadImportance: number;
    /** Whether the model is known to rewrite prompts before diffusion */
    rewritesPrompt: boolean;
    /** Whether quality tags (masterpiece, etc.) have measurable impact */
    qualityTagsEffective: boolean;
  };

  /** The exact transforms Call 3 is allowed to perform. Everything else is banned. */
  allowedTransforms: Transform[];

  /** Whether GPT is needed for any transform, or all are deterministic */
  requiresGPT: boolean;

  /** Temperature if GPT is used (null = deterministic only) */
  gptTemperature: number | null;

  /** Whether the iterative retry protocol (§8) is enabled for this platform */
  retryEnabled: boolean;

  /** Token budget allocation by category (CLIP platforms only) */
  tokenBudget: Partial<
    Record<PromptCategory, { min: number; max: number; priority: number }>
  > | null;

  /** Known failure modes that the quality gates should watch for */
  knownFailureModes: string[];

  /** Platform-specific hallucination patterns by scene type (§7.3) */
  hallucinationMap: Partial<Record<SceneType, string[]>> | null;

  /** Measured baseline: assembled prompt score (dual-assessor, null = untested) */
  assembledBaseline: number | null;

  /** Measured optimised score (dual-assessor, null = untested) */
  optimisedScore: number | null;

  /** Computed available headroom = theoretical ceiling - assembledBaseline */
  availableHeadroom: number | null;

  /** Harmony pass status */
  harmonyStatus: "verified" | "in_progress" | "untested";
}
```

### 4.2 The Transform catalogue

Every transform Call 3 can perform is a named, testable operation. No unnamed, untracked modifications.

| Transform ID           | Name                    | Type                | What it does                                                                                       | When it helps                                         |
| ---------------------- | ----------------------- | ------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `T_SUBJECT_FRONT`      | Subject Front-Load      | Deterministic       | Move primary subject phrase to token position 0–15                                                 | CLIP (high value), T5 (moderate), all prose (helpful) |
| `T_ATTENTION_SEQUENCE` | Attention Sequencing    | Deterministic       | Reorder anchor phrases by AVIS score (§5)                                                          | CLIP T1 (high value), T5 (moderate)                   |
| `T_WEIGHT_REBALANCE`   | Weight Redistribution   | Deterministic       | Rebalance CLIP weights: subject highest, atmosphere lowest                                         | CLIP T1, MJ T2                                        |
| `T_TOKEN_MERGE`        | Fragment Merge          | Deterministic       | Combine fragmented related tokens: "purple, sky, copper" → "purple-and-copper sky"                 | CLIP T1 (saves tokens, adds coherence)                |
| `T_SEMANTIC_COMPRESS`  | Semantic Compression    | Deterministic       | Within-phrase compression: "weathered old" → "grizzled" where synonymous                           | CLIP T1 (frees tokens without losing visual meaning)  |
| `T_REDUNDANCY_STRIP`   | Redundancy Removal      | Deterministic       | Remove semantically duplicate terms using pre-computed similarity pairs                            | All tiers (cleaner prompt, fewer wasted tokens)       |
| `T_QUALITY_POSITION`   | Quality Tag Placement   | Deterministic       | Place quality prefix/suffix at position 0 (CLIP) or omit entirely (T5/Flux)                        | CLIP T1 only                                          |
| `T_PARAM_VALIDATE`     | Parameter Validation    | Deterministic       | Ensure `--ar`, `--v`, `--s`, `--no` are syntactically correct                                      | MJ T2 only                                            |
| `T_WEIGHT_VALIDATE`    | Weight Syntax Check     | Deterministic       | Validate `::weight` clause structure, no mid-phrase splits                                         | MJ T2 only                                            |
| `T_CLAUSE_FRONT`       | Clause Subject-Lead     | Deterministic       | Within each `::` clause, front-load the subject noun                                               | MJ T2 only                                            |
| `T_SCENE_PREMISE`      | Scene Premise Lead      | Deterministic       | Ensure first sentence contains complete scene premise (who, where, what)                           | T5 platforms (Flux, Imagen)                           |
| `T_PROSE_RESTRUCTURE`  | Prose Restructuring     | GPT                 | Rewrite prose: subject first, strengthen weak verbs, tighten phrasing. Banned from adding content. | NL platforms where GPT adds measured value            |
| `T_NARRATIVE_ARMOUR`   | Rewrite-Proof Narrative | GPT                 | Make descriptions specific enough to survive DALL-E's GPT-4 rewriting                              | DALL-E only                                           |
| `T_NEGATIVE_GENERATE`  | Negative Intelligence   | Deterministic + GPT | Platform-specific negative prompts from hallucination map (§7.3)                                   | Platforms with `separate` negative support            |
| `T_CHAR_ENFORCE`       | Character Enforcement   | Deterministic       | Truncate at sentence boundary if over platform ceiling                                             | All platforms                                         |
| `T_SYNTAX_CLEANUP`     | Syntax Cleanup          | Deterministic       | Strip weight brackets, trailing punctuation, double spaces                                         | All platforms                                         |

### 4.3 Platform DNA assignments (draft — requires harmony pass validation)

**CLIP Family (7 platforms) — Deterministic only, zero GPT cost:**

| Platform    | Transforms                                                                                                                                                            | Rationale                                                          |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| stability   | `T_QUALITY_POSITION`, `T_SUBJECT_FRONT`, `T_ATTENTION_SEQUENCE`, `T_WEIGHT_REBALANCE`, `T_TOKEN_MERGE`, `T_SEMANTIC_COMPRESS`, `T_REDUNDANCY_STRIP`, `T_CHAR_ENFORCE` | Full CLIP attention optimisation. 77-token budget fully exploited. |
| dreamstudio | Same as stability                                                                                                                                                     | Same CLIP encoder, double-colon weights                            |
| dreamlike   | Same minus `T_WEIGHT_REBALANCE` (parenthetical syntax)                                                                                                                | Different weight syntax format                                     |
| leonardo    | Same as stability                                                                                                                                                     | CLIP-based SDXL, double-colon weights                              |
| lexica      | `T_QUALITY_POSITION`, `T_SUBJECT_FRONT`, `T_ATTENTION_SEQUENCE`, `T_SEMANTIC_COMPRESS`, `T_REDUNDANCY_STRIP`, `T_CHAR_ENFORCE`                                        | Weight syntax uncertain — omit weight transforms                   |
| fotor       | Same as stability                                                                                                                                                     | CLIP SD, parenthetical weights                                     |
| novelai     | `T_QUALITY_POSITION`, `T_SUBJECT_FRONT`, `T_ATTENTION_SEQUENCE`, `T_SEMANTIC_COMPRESS`, `T_REDUNDANCY_STRIP`, `T_CHAR_ENFORCE`                                        | Curly brace emphasis, non-standard weight syntax                   |

**Midjourney (1 platform) — Deterministic only:**

| Platform   | Transforms                                                                                        | Rationale                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| midjourney | `T_PARAM_VALIDATE`, `T_WEIGHT_VALIDATE`, `T_CLAUSE_FRONT`, `T_REDUNDANCY_STRIP`, `T_CHAR_ENFORCE` | Explicit :: weight system. User controls attention. Call 3 validates and front-loads within clauses. |

**T5 Family (2–3 platforms) — Hybrid deterministic + targeted GPT:**

| Platform      | Transforms                                                                                                                           | Rationale                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| flux          | `T_SCENE_PREMISE`, `T_SUBJECT_FRONT`, `T_REDUNDANCY_STRIP`, `T_PROSE_RESTRUCTURE` (GPT, temp 0.3), `T_CHAR_ENFORCE`. Retry: enabled. | T5-XXL rewards natural language. First sentence is the scene premise. GPT restructures for flow, doesn't add content. |
| google-imagen | `T_SCENE_PREMISE`, `T_SUBJECT_FRONT`, `T_REDUNDANCY_STRIP`, `T_CHAR_ENFORCE`                                                         | Deterministic only until harmony pass proves GPT helps. Assembled T3 scored 94; Call 3 degraded to 90.                |

**LLM-Rewrite Family (2 platforms) — Surgical GPT:**

| Platform        | Transforms                                                                                  | Rationale                                                                 |
| --------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| openai (DALL-E) | `T_NARRATIVE_ARMOUR`, `T_NEGATIVE_GENERATE`, `T_CHAR_ENFORCE`. Retry: enabled.              | GPT-4 rewrites everything. Specificity is the defence.                    |
| kling           | `T_PROSE_RESTRUCTURE` (GPT, temp 0.3), `T_SUBJECT_FRONT`, `T_CHAR_ENFORCE`. Retry: enabled. | ChatGLM3-6B understands semantics. Structured NL with clear subject lead. |

**Proprietary Encoder Family (6 platforms) — Evidence-gated:**

| Platform      | Transforms                                                                                                                            | Rationale                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| recraft       | `T_SCENE_PREMISE`, `T_SUBJECT_FRONT`, `T_PROSE_RESTRUCTURE` (GPT, temp 0.3), `T_NEGATIVE_GENERATE`, `T_CHAR_ENFORCE`. Retry: enabled. | Structured NL works well. Scored 96 in Playground.                              |
| ideogram      | `T_SUBJECT_FRONT`, `T_PROSE_RESTRUCTURE` (GPT, temp 0.3), `T_NEGATIVE_GENERATE`, `T_CHAR_ENFORCE`                                     | Text rendering degrades with stacking. Minimal transforms.                      |
| runway        | `T_SCENE_PREMISE`, `T_PROSE_RESTRUCTURE` (GPT, temp 0.3), `T_CHAR_ENFORCE`                                                            | Video: [camera]: [scene]. [details]. Structured format.                         |
| adobe-firefly | `T_SUBJECT_FRONT`, `T_REDUNDANCY_STRIP`, `T_CHAR_ENFORCE`                                                                             | UI panels override keywords. Minimal prompt-side value. Harmony pass scored 93. |
| luma-ai       | `T_SCENE_PREMISE`, `T_SUBJECT_FRONT`, `T_CHAR_ENFORCE`                                                                                | Requires least engineering. No negatives.                                       |
| canva         | `T_SUBJECT_FRONT`, `T_REDUNDANCY_STRIP`, `T_CHAR_ENFORCE`                                                                             | NL degradation proven (89 < assembled T3 94). Deterministic only.               |

**Remaining NL platforms (21 platforms) — Deterministic only:**

All T3/T4 NL platforms not listed above: `T_SUBJECT_FRONT`, `T_REDUNDANCY_STRIP`, `T_CHAR_ENFORCE`. GPT promoted only after individual harmony pass + headroom-based evidence of sufficient gain.

---

## 5. The Attention Sequencing Algorithm

### 5.1 The problem

Current Call 3 front-loads the subject — a single action. It doesn't account for where the other visual anchors should go. The lighthouse keeper has 9 anchors. After the subject, should "enormous storm waves" come second (high visual drama) or "purple and copper sky" (high colour value)? The answer depends on the encoder's processing characteristics.

### 5.2 The AVIS formula (v2 — upgraded per ChatGPT review)

For each platform, compute an **Attention-Weighted Visual Impact Score (AVIS)** for every anchor in the prompt:

```
AVIS(anchor, position) = visual_impact × attention_weight(position) × cohesion ÷ token_cost
```

Where:

- **`visual_impact`** = per-category importance weight from the optimal stacking research: subject=1.0, action=0.85, lighting=0.75, environment=0.70, colour=0.55, atmosphere=0.45, etc.

- **`attention_weight(position)`** = the platform's estimated processing importance at that token position. For CLIP: exponential decay from 1.0 at position 0. For T5: mild linear decay from 1.0. For LLM: near-uniform (0.95 everywhere). These are working hypotheses per §3.2, not exact measurements.

- **`cohesion`** = penalty if the anchor is separated from its related modifiers or action partners. An anchor like "enormous storm waves" that is placed at position 5 while its paired action "crash against jagged rocks" is placed at position 50 gets a cohesion penalty of 0.6. If they're adjacent, cohesion is 1.0. This addresses the interaction-flattening problem identified in CLIP testing — splitting "waves crash against rocks" into separate fragments produces worse images than keeping the interaction intact.

- **`token_cost`** = the number of tokens the anchor consumes, normalised to [1.0, 3.0]. A 2-token anchor ("storm waves") has token_cost 1.0. A 6-token anchor ("frost-encrusted orange survival suit") has token_cost 2.5. This prevents long expensive anchors from dominating the sequence on tight-budget encoders. On T5 (512 tokens), token_cost is always 1.0 (budget is not a constraint).

### 5.3 Cohesion pairs

The algorithm detects interaction pairs: subject + action verb, colour + object, modifier + noun. These pairs must stay adjacent in the reordered sequence. The algorithm sequences by AVIS score but treats pairs as atomic units.

Detection uses the existing `extractAnchors()` manifest plus a coupling heuristic: if two anchors share a verb or a preposition ("waves crash against rocks", "beam cuts through rain"), they are a cohesion pair.

### 5.4 Semantic Density scoring

Within each anchor phrase, measure the ratio of unique visual information to token count:

```
density = unique_visual_concepts / token_count
```

"Weathered old lighthouse keeper" has 3 concepts (age, lighthouse, keeper) in 5 tokens = density 0.6. "Grizzled lighthouse keeper" has 3 concepts in 3 tokens = density 1.0.

On CLIP platforms where the 77-token budget is critical, the algorithm flags low-density anchors (density < 0.5) for compression. `T_SEMANTIC_COMPRESS` then applies rule-based compression: synonym lookup for redundant modifiers ("weathered old" → "grizzled"), compound-adjective formation ("purple and copper" → "purple-copper"), and verbose-to-concise rewrites from the existing 59-rule compression table.

On T5 platforms, density is tracked but not enforced — the 512-token budget is rarely a constraint.

### 5.5 The sequencing algorithm (full)

1. Extract all anchors from the assembled prompt using `extractAnchors()`
2. Detect cohesion pairs (subject+action, colour+object, modifier+noun)
3. Score each anchor (or pair) by `visual_impact` from category weights
4. For CLIP platforms: compute semantic density per anchor, flag low-density for compression
5. For each anchor/pair in priority order, compute AVIS at each remaining available position
6. Place each anchor/pair at the position that maximises its AVIS, respecting cohesion (pairs stay adjacent)
7. For CLIP: verify total tokens ≤ 77. If over, drop anchors from the lowest-AVIS positions first
8. Assemble the resequenced prompt with appropriate syntax for the platform

### 5.6 CLIP-specific token budget enforcement

```
Token budget allocation (working guideline, not hard partitioning):
  Position  0–4:   Quality prefix ("masterpiece, best quality")     ~4 tokens
  Position  5–18:  Subject + primary action (cohesion pair)          ~14 tokens
  Position 19–35:  Environment + lighting (highest visual impact)    ~17 tokens
  Position 36–55:  Colour + atmosphere + materials                   ~20 tokens
  Position 56–72:  Secondary details (camera, composition)           ~17 tokens
  Position 73–77:  Quality suffix or final anchor                    ~5 tokens
```

This is a guideline, not a hard partition. The AVIS algorithm naturally produces a similar distribution because visual_impact × attention_weight × cohesion ÷ token_cost ranks subject+action highest and composition/camera lowest. The budget table is a sanity check, not a constraint.

### 5.7 Why this works — and its limitations

**Why it works:** The algorithm exploits a gap between how humans write prompts and how encoders process them. Humans write narratively — the visual climax comes at the end. The algorithm moves high-impact anchors to high-attention positions while preserving interaction coherence.

**Limitations (honest):**

- The attention_weight function is a working hypothesis (§3.2), not a measurement. If CLIP's attention is actually more uniform than hypothesised, the resequencing adds less value.
- Cohesion pair detection is heuristic. False positives (treating unrelated phrases as pairs) waste tokens on unnecessary adjacency.
- Semantic compression is conservative — only applies rule-based rewrites, not creative paraphrasing. This limits token savings but also limits risk.
- The algorithm has not been validated with controlled image generation tests. Until it has, the expected gains are estimates, not measurements.

---

## 6. The Anchor Preservation Score (APS) — primary gate plus vetoes

### 6.1 Definition

The APS is the primary quantitative gate for accepting or rejecting Call 3 output:

```
APS = Σ(surviving_anchors × severity_weight) / Σ(all_input_anchors × severity_weight)
```

Where `severity_weight` is:

- Critical anchors (subject, primary action, named colours): weight 3
- Important anchors (environment, lighting, atmosphere): weight 2
- Optional anchors (materials, composition hints, camera): weight 1

An APS of 1.0 means every anchor survived. An APS of 0.7 means 30% of weighted anchor value was lost.

### 6.2 Thresholds (shifted per ChatGPT recommendation)

| APS range | Verdict                      | Action                                                                                             |
| --------- | ---------------------------- | -------------------------------------------------------------------------------------------------- |
| ≥ 0.95    | Clean accept                 | Ship                                                                                               |
| 0.88–0.94 | Accept with secondary checks | Run vetoes (§6.3). If vetoes pass, ship with warning logged.                                       |
| 0.78–0.87 | Retry band                   | If retry enabled for this platform (§8), try once more with tighter constraints. Otherwise reject. |
| < 0.78    | Hard reject                  | Fallback to assembled prompt. Log as regression incident.                                          |

### 6.3 Three vetoes (APS alone is not sufficient)

APS measures preservation. It does not measure whether the output became awkward, over-engineered, or semantically distorted. Three vetoes complement APS:

**Veto 1 — Critical Anchor Loss:**
If ANY anchor with severity_weight 3 (subject, primary action, or named colour) is missing from the output, reject regardless of APS score. A prompt missing its subject is broken even if it preserved 8 of 9 other anchors (APS might still be 0.89).

**Veto 2 — Invented Content Injection:**
If the output contains named visual elements (objects, colours, textures, locations) that were not present in the input and were not part of a platform-appropriate quality prefix, reject. GPT inventing content is the most common degradation mode. Uses the existing regression guard's invented-content detector.

**Veto 3 — Prose Quality Floor:**
If the output contains composition scaffold language ("foreground," "midground," "background" in the same sentence), textbook phrasing ("creates a sense of depth"), or redundant 3+ word phrase repetition, reject. These are the specific mechanical artefacts that made NL platform Call 3 score lower than the assembled prompt. Uses the existing prose quality detectors from `regression-guard.ts`.

### 6.4 Relationship to the existing regression guard

The current 8-check regression guard (`regression-guard.ts`, 694 lines) remains as a secondary safety net. The APS + vetoes is the primary gate and handles most rejections. The regression guard catches edge cases the APS misses — verb substitution, sentence count drift, weight loss on T1/T2 — and logs diagnostics even when the primary gate already accepted.

Order of execution:

```
GPT output → APS check → Vetoes → [if all pass] → Regression guard (secondary) → Ship
                                  [if any fail] → Retry (if enabled) or fallback
```

---

## 7. The Negative Intelligence Engine

### 7.1 The opportunity

19 of 40 platforms support separate negative prompts. Currently, Call 3 generates generic negatives or none at all.

### 7.2 Two-tier architecture

**Tier A — Deterministic (code, zero GPT cost):**
Platform-specific negative templates based on encoder family:

| Encoder family | Default negatives                                                                 | Rationale                                                                  |
| -------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| CLIP           | `blurry, low quality, bad anatomy, watermark, text, signature, cropped, deformed` | Standard CLIP negative vocabulary from community research                  |
| T5             | Negatives generally unnecessary                                                   | T5 handles positive-only well; negatives can confuse the encoder           |
| MJ             | Max 4 terms via `--no` flag                                                       | 5+ terms reduce quality (confirmed by MJ founder)                          |
| DALL-E         | Not applicable                                                                    | No negative support                                                        |
| Proprietary    | Platform-specific based on known patterns                                         | Recraft: simple nouns only, 3–5 max. Luma: officially "counterproductive." |

**Tier B — Scene-Aware (GPT, targeted):**
For platforms where negatives add measurable value, GPT generates 3–5 scene-specific negative terms. Only fires when testing proves Tier B adds ≥2pt gain over Tier A alone.

### 7.3 Platform Hallucination Map

Each platform has characteristic failure modes by scene type. This map is built incrementally from BQI results and harmony testing.

**Schema:**

```typescript
type SceneType =
  | "outdoor_drama"
  | "indoor_character"
  | "abstract_stylised"
  | "urban"
  | "nature"
  | "portrait";

interface HallucinationEntry {
  sceneType: SceneType;
  commonHallucinations: string[]; // What the model tends to add
  effectiveNegatives: string[]; // What stops it
  confidence: "measured" | "assumed";
}
```

**Example entries (to be populated through testing):**

| Platform   | Scene type    | Common hallucinations                         | Effective negatives                       |
| ---------- | ------------- | --------------------------------------------- | ----------------------------------------- |
| stability  | outdoor_drama | Extra limbs on human subjects, oversaturation | `bad anatomy, extra limbs, oversaturated` |
| openai     | outdoor_drama | Text overlays, extra figures                  | `text, writing, multiple people`          |
| midjourney | outdoor_drama | Over-beautification of gritty scenes          | `--no beautiful, clean, pristine`         |

The map starts empty and is populated as each platform completes its harmony pass. BQI batch results provide the failure data; the hallucination map is the structured interpretation.

---

## 8. The Iterative Retry Protocol (platform-gated)

### 8.1 The problem with binary fallback

Currently: GPT produces output → regression guard checks → pass (ship) or fail (fallback to assembled prompt). Binary. No middle ground. GPT's good ideas are lost when execution is flawed.

### 8.2 The protocol

```
Attempt 1: GPT with platform system prompt, temp T
    ├── APS ≥ 0.95 → ACCEPT
    ├── APS 0.88–0.94 + vetoes pass → ACCEPT with warning
    ├── APS 0.78–0.87 + retry enabled → RETRY
    └── APS < 0.78 or veto triggered → REJECT, fallback

Attempt 2 (retry): GPT with tighter prompt appended:
    "CRITICAL: Preserve ALL of the following anchors exactly: [list].
     Do NOT add any visual elements not in the input.
     Do NOT use composition scaffolding (foreground/midground/background).
     Your ONLY task is restructuring the existing content for [platform]."
    ├── APS ≥ 0.88 + vetoes pass → ACCEPT
    └── Anything else → REJECT, fallback to assembled prompt
```

### 8.3 Platform gating (per ChatGPT recommendation)

Retry is NOT enabled for all GPT platforms. It is enabled only where evidence shows the retry recovers meaningful quality:

| Platform        | Retry enabled | Rationale                                                          |
| --------------- | ------------- | ------------------------------------------------------------------ |
| recraft         | ✅ Yes        | High-quality builder, occasional anchor drops recoverable          |
| openai (DALL-E) | ✅ Yes        | Narrative armouring benefits from refinement                       |
| flux            | ✅ Yes        | T5 restructuring is close to target on first attempt               |
| kling           | ✅ Yes        | ChatGLM3 responds well to explicit anchor lists                    |
| ideogram        | ❌ No         | Chronic rescue dependency; retry doesn't help                      |
| runway          | ❌ No         | Video format too structured; first attempt either works or doesn't |
| google-imagen   | ❌ No         | Not on GPT path (deterministic only)                               |

Platforms with >50% first-attempt rejection rate should be moved to deterministic-only rather than retried. The Call 3 harness (§11) measures first-attempt acceptance rate per platform.

### 8.4 Cost discipline

Retry doubles API cost for ~15–25% of calls (estimated). On a platform where retry fires but never recovers (acceptance rate on retry < 30%), retry should be disabled for that platform. The harness measures retry recovery rate.

---

## 9. Harmony Pass 2.0

### 9.1 What was wrong with Harmony Pass 1.0

Manual, slow, unscalable. Two platforms completed in 6+ hours. At that rate, 40 platforms would take 120 hours.

### 9.2 Harmony Pass 2.0 — systematic, measurable, scalable

**Phase 1 — Baseline sweep (automated, 1 hour):**
Run BQI batch across all 40 platforms with 3 test scenes from 3 different scene categories (§9.3). This produces baseline scores. Already partially done — first batch scored mean 81.97.

**Phase 2 — Triage by evidence (30 minutes):**
Sort platforms by gap between assembled prompt score and optimised score. Three buckets:

- **Green (headroom-adjusted gain ≥ 50%):** Call 3 is helping. Keep GPT. Refine builder.
- **Amber (headroom-adjusted gain 20%–49%):** Marginal. Test deterministic alternative.
- **Red (headroom-adjusted gain < 20% or negative):** Call 3 is degrading or negligible. Switch to deterministic immediately.

**Phase 3 — Platform-specific tuning (per platform, 45 mins each):**
For Green: refine builder in OpenAI Playground (gpt-5.4-mini, json_object, reasoning effort medium) targeting 95+. Apply surgical transform approach — the prompt tells GPT exactly which transforms to perform and bans everything else.

For Amber/Red: implement deterministic transform catalogue. Test. Score. If deterministic achieves sufficient headroom gain, ship. If not, `pass_through`.

**Phase 4 — Lock and regression-test (per platform, 15 mins):**
After builder approved, add to BQI batch. Run 3-replicate decision-grade batch. If no regression, lock.

### 9.3 Scene diversity mandate (addresses failure mode #9)

Every harmony pass MUST use at least 3 scenes from 3 different categories:

1. **Outdoor drama** — the Lighthouse Keeper (canonical)
2. **Indoor/character** — a portrait or interior scene with human subjects and specific textures/materials
3. **Abstract/stylised** — a non-photorealistic scene (concept art, illustration, surreal composition)

A builder that scores well on Lighthouse Keeper but poorly on indoor/character is not harmony-verified. All three must pass.

### 9.4 Effort estimate

| Phase                    | Per platform                | Total (40 platforms) |
| ------------------------ | --------------------------- | -------------------- |
| Phase 1 (baseline sweep) | Automated                   | 1 hour               |
| Phase 2 (triage)         | —                           | 30 minutes           |
| Phase 3 (tuning)         | 45 mins × ~10 GPT platforms | ~7.5 hours           |
| Phase 3 (deterministic)  | 20 mins × ~30 platforms     | ~10 hours            |
| Phase 4 (lock)           | 15 mins × 40                | ~10 hours            |
| **Total**                |                             | **~29 hours**        |

---

## 10. Route-stage attribution for Call 3

Call 2's harness captures 4 stages (raw model → post-processed → compliance → final). Call 3 needs the same principle, adapted to its different pipeline:

```
assembled prompt (from Call 2)
   │
   ▼
[ Stage P: Preflight decision ]         ← Which path? GPT or deterministic?
   │
   ├── Deterministic path:
   │   [ Stage D: Deterministic transform(s) ]  ← reorder / format / MJ parse / AVIS sequence
   │   [ Stage G: Group compliance gate ]        ← syntax cleanup, char enforcement
   │   [ Stage F: Final output ]                 ← PRODUCT TRUTH
   │
   └── GPT path:
       [ Stage R: Raw GPT output ]              ← What GPT returned
       [ Stage G: Group compliance gate ]        ← syntax cleanup, char enforcement
       [ Stage A: APS gate + vetoes ]            ← Anchor Preservation Score + 3 vetoes
       [ Stage X: Regression guard ]             ← 8-check heuristic safety net (secondary)
       [ Stage F: Final output ]                 ← PRODUCT TRUTH (GPT output or fallback)
```

### 10.1 Rescue dependency for Call 3

```
rescue_dependency = (samples where Stage R failed APS AND Stage F is the assembled fallback)
                  / (total samples on GPT path)
```

A platform where GPT's raw output consistently fails APS and the system "rescues" by returning the assembled prompt has high rescue dependency. That platform should be moved to deterministic-only — GPT is doing no useful work.

### 10.2 What rescue dependency tells you for Call 3

| Rescue dependency | Interpretation                      | Action                                                                 |
| ----------------- | ----------------------------------- | ---------------------------------------------------------------------- |
| 0%–10%            | GPT is earning its keep             | Keep on GPT path                                                       |
| 10%–30%           | GPT is marginal                     | Tighten builder, consider deterministic alternative                    |
| 30%–50%           | GPT is a coin flip                  | Run headroom analysis — if the 50% that pass are +8pts, maybe worth it |
| > 50%             | GPT is failing more than succeeding | Move to deterministic. Disable retry.                                  |

---

## 11. The Call 3 harness

### 11.1 Architecture reuse from Call 2

The Call 2 harness infrastructure transfers: scene library, inventory schema, diff engine, run-class discipline, significance classification. What changes:

| Component        | Call 2                                | Call 3                                          |
| ---------------- | ------------------------------------- | ----------------------------------------------- |
| Dev endpoint     | `/api/dev/generate-tier-prompts`      | `/api/dev/optimise-prompt` (new)                |
| System prompt    | 1 universal                           | 1 per platform (up to 40 builders)              |
| Mechanical rules | 27 universal (4 tiers)                | Per-platform rule sets from Transform catalogue |
| Test input       | User's natural sentence               | Assembled prompt (from frozen Call 2 snapshots) |
| Primary gate     | Stage D pass rate + rescue dependency | APS + vetoes + rescue dependency                |
| Scope per run    | All tiers from one GPT call           | One platform per GPT call                       |

### 11.2 Per-platform mechanical rule sets

Each platform's rule set is derived from its allowed transforms. If `T_SUBJECT_FRONT` is in the transform list, the rule "subject in first 15 tokens" is in the rule set. If `T_PARAM_VALIDATE` is listed, MJ-specific parameter rules are included.

**CLIP rule set (example):** subject in first 15 tokens, quality prefix at position 0, total tokens ≤ 77, no redundant semantic pairs, weight sum ≤ 3.0, weight steps in 0.1 increments, no isolated colour weights, all critical anchors present.

**NL rule set (example):** no weight syntax, no CLIP formatting, no composition scaffold language, no textbook phrases, subject in first 8 words, all critical anchors present.

### 11.3 Running the harness

```powershell
# Single platform
pnpm exec tsx scripts/run-call3-harness.ts --platform midjourney --version v1.0 --run-class smoke_alarm

# All platforms in a tier
pnpm exec tsx scripts/run-call3-harness.ts --tier 1 --version v1.0 --run-class smoke_alarm

# With diff
pnpm exec tsx scripts/run-call3-harness.ts --platform recraft --version v1.1 --previous <path>
```

---

## 12. Measuring success — the headroom-based shipping rule

### 12.1 Why flat +5 doesn't work (ChatGPT's catch, v0.1.0 §R1-Q4)

CLIP platforms may only deliver ~2–3 point gains but their assembled baseline is 86 with a ceiling of ~93 — 7 points of headroom. A 3-point gain is 43% of headroom. Meaningful.

NL platforms can deliver ~6–8 point gains but their assembled baseline is 94 with a ceiling of ~98 — 4 points of headroom. A 4-point gain is 100% of headroom. Excellent.

A flat +5 rule would reject the CLIP platform's useful 3-point gain and accept the NL platform's 4-point gain equally. The headroom-based rule captures the reality that different platforms have different improvement ceilings.

### 12.2 The headroom-based shipping rule

```
headroom = estimated_ceiling - assembled_baseline
gain = optimised_score - assembled_baseline
headroom_fraction = gain / headroom

Ship if: headroom_fraction ≥ 0.50 (50% of available headroom captured)
```

**Estimated ceiling:** Per-platform, set during harmony pass based on the best score achieved across all test scenes. Initially defaulted to min(assembled_baseline + 10, 100).

### 12.3 The measurement protocol

For each platform, 3 test scenes from 3 scene categories (§9.3), 5 samples each:

1. Score the **assembled prompt** (Call 2 output, no Call 3) with dual assessment
2. Score the **optimised prompt** (Call 3 output) with dual assessment
3. Compute headroom fraction
4. If headroom_fraction ≥ 0.50: ship
5. If headroom_fraction < 0.50: the platform needs either better transforms or `pass_through`

### 12.4 The scoring rubric (from ChatGPT, confirmed 26 Mar)

| Criterion                  | Weight | What it measures                               |
| -------------------------- | ------ | ---------------------------------------------- |
| Fidelity to original input | 35%    | How many visual anchors survived               |
| Visual richness            | 20%    | Enough detail to build a vivid image           |
| Atmosphere and mood        | 15%    | Danger, scale, loneliness, weather violence    |
| Composition usefulness     | 10%    | Clear subject, foreground/background           |
| Platform suitability       | 15%    | Matches the platform's preferred prompt format |
| Clarity per word           | 5%     | Each word doing useful visual work             |

---

## 13. How the system will lie to you

Nine named failure modes. Five inherited from Call 2's pattern, four new to Call 3.

1. **It will overfit to the test scenes.** The Lighthouse Keeper is maritime. A system tuned for maritime scenes may underperform on urban, abstract, or character-focused inputs. **Mitigation:** Scene diversity mandate (§9.3) — minimum 3 scene categories per harmony pass.

2. **It will inherit judge taste.** Claude over-scores, ChatGPT under-scores. **Mitigation:** Judge calibration offsets, cross-judge milestone runs.

3. **It will confuse route quality with prompt quality.** Scoring raw GPT output vs the final gated output tells different stories. **Mitigation:** Route-stage attribution (§10). Stage F is canonical.

4. **It will mistake deterministic reliability with quality.** A deterministic transform that always runs produces consistent output — but consistently mediocre is worse than occasionally brilliant. **Mitigation:** Headroom-based shipping rule (§12). If a deterministic path doesn't capture ≥50% headroom, it's not shipping.

5. **It will assume platform behaviour is stable.** Platforms update their models. Midjourney V7 behaves differently from V6. Flux Pro from Flux Dev. **Mitigation:** DNA profiles have a `harmonyStatus` field. Major platform updates trigger re-verification.

6. **It will ignore the user's creative intent.** Attention sequencing optimises for encoder processing, not artistic vision. If the user deliberately placed an element at the end for narrative build-up, the algorithm moves it forward. **Mitigation:** This is correct for image generation (the encoder doesn't read narratively) but might feel wrong to the user. Document in UX.

7. **It will undercount the value of doing nothing.** For platforms where Call 3 adds < headroom threshold, `pass_through` is correct. The temptation to keep "trying harder" on degrading platforms is a trap. **Mitigation:** The headroom rule is mechanical. Below threshold = pass_through. No exceptions.

8. **It will optimise the score proxy instead of the image outcome.** (NEW — ChatGPT's catch.) Builders become over-tuned to harmony scoring, APS, and mechanical rule sets rather than actual generated-image quality. A prompt that scores 96 on every metric but produces a generic-looking image is a failure. **Mitigation:** Periodic image generation spot-checks on milestone platforms. Score-only optimisation without image validation is a known risk that should be revisited once traffic supports it.

9. **It will optimise one scene type and regress another.** (NEW.) Every harmony pass so far used Lighthouse Keeper as the primary test. A builder tuned for dramatic outdoor maritime scenes may underperform on portraits, interiors, or abstract compositions. **Mitigation:** The 3-category scene mandate (§9.3) is the primary defence. BQI scene weakness maps (§10 of `builder-quality-intelligence.md`) surface per-scene regression after deployment.

---

## 14. What is explicitly NOT in scope

- No cross-call (Call 2 → Call 3) end-to-end optimisation in v0.2. Call 2 and Call 3 are independent quality systems.
- No automatic builder file generation. GPT does not write its own system prompts. Claude writes them, ChatGPT verifies them, Martin approves them.
- No user-facing quality scores. BQI is internal.
- No A/B testing of Call 3 variants in production. Testing happens offline.
- No changes to the AI Disguise principle.
- No image generation validation in the automated pipeline. Score-based validation only. Image spot-checks are manual milestones.

---

## 15. Implementation phases

| Phase  | Goal                                                                       | Effort       | Dependencies    |
| ------ | -------------------------------------------------------------------------- | ------------ | --------------- |
| **1**  | Platform DNA profiles for all 40 platforms (data, no code)                 | 1 session    | Nothing         |
| **2**  | APS gate + 3 vetoes (replaces regression guard as primary)                 | 1 session    | Nothing         |
| **3**  | Attention Sequencing Algorithm for CLIP T1                                 | 1 session    | Phase 1         |
| **4**  | Semantic Compression (`T_SEMANTIC_COMPRESS`)                               | 1 session    | Phase 3         |
| **5**  | Deterministic transform catalogue — all `T_*` transforms as pure functions | 2 sessions   | Phases 1–4      |
| **6**  | Harmony Pass 2.0 — baseline sweep + triage + scene diversity               | 1 session    | BQI operational |
| **7**  | Builder refinement for Green platforms (GPT paths)                         | 2–3 sessions | Phase 6         |
| **8**  | Iterative retry protocol (platform-gated)                                  | 1 session    | Phases 2, 7     |
| **9**  | Negative Intelligence Engine (Tier A deterministic + hallucination map)    | 1 session    | Phase 1         |
| **10** | Call 3 harness (dev endpoint + per-platform mechanical scorer)             | 2 sessions   | Phases 2–5      |
| **11** | Full harmony pass — all 40 platforms verified across 3 scene categories    | 4–6 sessions | Phase 10        |

**Total: 16–22 sessions.** Phase 2 (APS gate) improves the safety net for all GPT platforms immediately. Phase 3 (CLIP attention sequencing) delivers measurable gains on 7 platforms with zero GPT cost.

---

## 16. Success criteria

Six months from now:

1. All 40 platforms have verified Platform DNA profiles with measured Call 3 headroom fraction or explicit `pass_through` justification.
2. Average Call 3 headroom fraction across GPT platforms is ≥50%.
3. Zero platforms where Call 3 degrades output (the Google Imagen problem is solved).
4. CLIP platforms achieve ≥3pt gain through deterministic attention sequencing alone (no GPT cost).
5. The Call 3 harness catches at least 3 builder regressions before they reach users.
6. API cost per Call 3 decreases (more platforms on deterministic paths, fewer GPT calls, targeted retry).
7. BQI mean score rises from 81.97 to ≥88.
8. Every harmony pass uses ≥3 scene categories.
9. The system becomes the competitive moat — a competitor would need to replicate per-platform encoder profiling, the surgical transform catalogue, AVIS sequencing, and the APS gate to match quality.

If after six months none of these are met, the approach was wrong and should be reconsidered.

---

## 17. Open questions for ChatGPT (round 2)

1. **Did v0.2 actually fix the four structural concerns?** Specifically: is §3's three-tier certainty model defensible? Is the AVIS cohesion/token_cost upgrade sufficient? Is APS + vetoes strong enough as a composite gate? Is the headroom-based shipping rule practical?

2. **The cohesion pair detection heuristic (§5.3)** — is verb/preposition sharing a reliable signal, or will it produce too many false positives? Should it use the CLIP semantic similarity pairs from the existing `semantic-pairs.json` instead?

3. **The semantic density score (§5.4)** — is "unique_visual_concepts / token_count" the right formula, or should it weight concept novelty (a new colour is worth more than a repeated modifier)?

4. **Failure mode #8 (score proxy vs image outcome)** — what's the minimum viable mitigation? Periodic manual image generation on 5 platforms? Or is there a lighter-weight proxy test?

5. **The hallucination map (§7.3)** — should this be pre-populated with assumed entries based on community knowledge, or should it start empty and be populated purely from Promagen's own BQI data?

6. **Architecture freeze readiness.** Is v0.2 ready to freeze and start building, or is there a remaining structural concern?

---

## Changelog

| Date        | Version | Changes                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11 Apr 2026 | v0.1.0  | Initial architecture draft. 17 sections. ChatGPT scored 92/100.                                                                                                                                                                                                                                                                                                                                                                                           |
| 11 Apr 2026 | v0.2.0  | **This version.** Four ChatGPT fixes + five additions. §3 rewritten with three-tier certainty. AVIS upgraded with cohesion/token_cost. APS upgraded with vetoes and shifted thresholds. Headroom-based shipping rule replaces flat +5. Semantic Density added. Platform Hallucination Map added. promptStylePreference added to DNA schema. Two new failure modes (#8, #9). Retry protocol platform-gated. Scene diversity mandate added to harmony pass. |

End of v0.2.0.
