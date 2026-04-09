# Optimal Prompt Stacking Limits — All 40 Platforms

> **Authority document** — Governs per-platform, per-category selection limits for both builders.
> Version 4.0.0 — 9 Apr 2026
> Replaces the flat "+1 on 7 categories" model with research-backed per-platform numbers.

---

## Executive Summary

Every AI image platform has a point where adding more descriptors hurts rather than helps. After synthesising community testing, technical documentation, and architectural analysis across all 40 platforms, the dominant finding is that most categories should be limited to **1–2 selections on free tiers** and **2–3 on pro tiers**, with four categories that should almost universally stay at 1. The research reveals dramatic differences between CLIP-based models (where 75 usable tokens create a hard budget), T5-based models (which handle 512 tokens of natural language), LLM-based encoders (ChatGLM3 on Kling), proprietary transformers (Recraft, Luma Photon), and platforms with automatic prompt rewriting (where stacking is partially overridden).

---

## Four Categories That Should Never Exceed 1

Across all 40 platforms, four prompt categories create contradictions rather than enhancement when stacked above 1:

- **Action** — produces physically impossible hybrid poses.
- **Composition** — terms directly conflict (close-up vs wide shot, centered vs rule-of-thirds).
- **Camera** — lens focal length and shot type conflict (35mm wide-angle vs 85mm portrait).
- **Fidelity** — boosters like "8K, highly detailed, masterpiece" show near-zero impact on modern models (MJ V6+, Flux, SD3+, Recraft, Luma Photon). Exceptions: anime/Danbooru models (NovelAI), Tensor.Art SDXL, and Kling AI (ChatGLM3 understands them semantically).

---

## How Text Encoders Constrain Everything

### CLIP-Based (Tier 1)

**75 usable tokens** per encoder (~40–60 words). Tokens beyond 75 silently truncated. SDXL's dual CLIP encoders handle multi-subject prompts better than SD 1.5.

### T5-Based (Flux, Imagen, NovelAI V4+)

**512-token context** with relative positional encodings. Natural language dramatically outperforms keywords. Quality tags unnecessary.

### ChatGLM3-Based (Kling AI)

**256-token model limit** (2,500 chars via API). Full 6B-parameter bilingual LLM. Uniquely strong semantic comprehension — understands "masterpiece" as a concept, not just an embedding vector. Fidelity terms genuinely effective.

### GPT-4 Rewriting (DALL-E 3)

Automatically expands all prompts before diffusion. User stacking has reduced impact.

### Proprietary Encoders (Recraft V3, Luma Photon)

**Recraft V3** — Proprietary ~20B+ params, 4,000-char limit. 100+ built-in style presets make prompt-side style terms redundant. Fidelity terms wasteful.
**Luma Photon 1** — Proprietary "Universal Transformer" (not diffusion-based), ~5,000-char limit. Requires least prompt engineering of any platform. No negative prompt support — Luma officially states negation is "counterproductive."

---

## Tier 1 — CLIP-Based Platforms (14 platforms)

### Per-Platform Limits (free / pro)

| Category    | stability | leonardo | clipdrop | nightcafe | dreamstudio | lexica | novelai | dreamlike | getimg | openart | playground | artguru | jasper-art | tensor-art |
| ----------- | --------- | -------- | -------- | --------- | ----------- | ------ | ------- | --------- | ------ | ------- | ---------- | ------- | ---------- | ---------- |
| subject     | 1/2       | 2/3      | 1/2      | 1/2       | 1/2         | 1/2    | 2/3     | 1/2       | 1/2    | 1/2     | 1/2        | 1/2     | 1/2        | 3/5        |
| action      | 1/1       | 1/1      | 1/1      | 1/1       | 1/1         | 1/1    | 1/1     | 1/1       | 1/1    | 1/1     | 1/1        | 1/1     | 1/1        | 1/2        |
| style       | 1/2       | 2/3      | 1/2      | 1/2       | 1/2         | 1/2    | 1/3     | 1/2       | 1/2    | 1/2     | 1/2        | 1/1     | 1/2        | 2/3        |
| environment | 1/1       | 1/2      | 1/2      | 1/2       | 1/1         | 1/2    | 1/2     | 1/1       | 1/2    | 1/2     | 1/2        | 1/1     | 1/1        | 2/3        |
| composition | 1/1       | 1/1      | 1/1      | 1/1       | 1/1         | 1/1    | 1/2     | 1/1       | 1/1    | 1/1     | 1/1        | 1/1     | 1/1        | 1/2        |
| camera      | 1/1       | 1/2      | 1/1      | 1/1       | 1/1         | 1/1    | 1/1     | 1/1       | 1/1    | 1/1     | 1/1        | 1/1     | 1/1        | 1/2        |
| lighting    | 1/2       | 2/3      | 1/2      | 1/2       | 1/2         | 1/2    | 1/2     | 1/2       | 1/2    | 1/2     | 1/2        | 1/1     | 1/1        | 1/2        |
| atmosphere  | 1/2       | 2/2      | 1/2      | 1/2       | 1/2         | 1/2    | 1/2     | 1/1       | 1/2    | 1/2     | 1/2        | 1/1     | 1/1        | 1/1        |
| colour      | 1/1       | 1/2      | 1/1      | 1/1       | 1/1         | 1/1    | 1/2     | 1/1       | 1/1    | 1/1     | 1/2        | 1/1     | 1/1        | 1/2        |
| materials   | 1/1       | 2/3      | 1/2      | 1/2       | 1/1         | 1/2    | 1/2     | 1/1       | 1/2    | 1/2     | 1/2        | 1/1     | 1/1        | 1/2        |
| fidelity    | 1/2       | 2/3      | 1/2      | 1/2       | 1/2         | 1/2    | 2/4     | 1/2       | 1/2    | 1/2     | 1/2        | 1/1     | 1/1        | 3/4        |
| negative    | 5/10      | 5/8      | 5/8      | 5/8       | 5/10        | 4/6    | 5/10    | 5/8       | 5/8    | 5/8     | 4/6        | 3/5     | 0/0        | 5/8        |

### Platform-Specific Notes

**Leonardo AI** — Highest stacking tolerance in Tier 1. Phoenix model has strongest prompt adherence. Style=2/3 and lighting=2/3 genuinely work. SDXL-based models respond to quality tags; Phoenix does not need them.

**NovelAI** — Curly-brace emphasis: `{text}` = 1.05× per nesting level. V4/V4.5: T5 with 512 tokens. Fidelity 2/4 because quality tags map to training-data quality tiers.

**Tensor.Art** — Community model hub (SD 1.5, SDXL, Flux, Illustrious XL). Dual CLIP encoder, 75-token chunks. Full `(term:1.5)` weighting supported (use sparingly on SDXL, not at all on Flux). Fidelity 3/4: `masterpiece, best quality` for SDXL; `score_9, score_8_up` for Pony; `masterpiece, best quality, amazing quality` for Illustrious. Full separate negative field; 10–20 terms effective, diminishing returns beyond ~30.

**Jasper Art** — **MISCATEGORISED.** Uses DALL-E 2, not CLIP/SD. 400-char limit. Negatives not supported. Should be reclassified to Tier 3.

**Stability/DreamStudio** — Most constrained: raw 75-token CLIP limit.

**ArtGuru** — Consumer-focused UI. Stacking beyond 1 per category counterproductive.

---

## Tier 2 — Midjourney Family (2 platforms)

### Per-Platform Limits (free / pro)

| Category    | midjourney | bluewillow |
| ----------- | ---------- | ---------- |
| subject     | 1/3        | 1/2        |
| action      | 1/1        | 1/1        |
| style       | 1/2        | 1/2        |
| environment | 1/2        | 1/1        |
| composition | 1/1        | 1/1        |
| camera      | 1/1        | 1/1        |
| lighting    | 1/2        | 1/2        |
| atmosphere  | 1/2        | 1/1        |
| colour      | 1/2        | 1/1        |
| materials   | 1/2        | 1/1        |
| fidelity    | 0/0        | 1/1        |
| negative    | 2/4        | 2/3        |

### Platform-Specific Notes

**Midjourney** — Word-position influence decay: words 1–5 very influential, 40+ ignored. Target 15–30 words. Fidelity **0/0** (confirmed by founder). Use `--q`, `--stylize`, `--style raw` instead. `--no` parameter: each term applies -0.5 weight, 5+ terms reduce quality.

**BlueWillow** — Blend of open-source SD models. Lacks MJ advanced features. Same brevity principles.

---

## Tier 3 — Natural Language Platforms (13 platforms)

### Per-Platform Limits (free / pro)

| Category    | openai | adobe-firefly | ideogram | runway | ms-designer | bing | flux | google-imagen | imagine-meta | hotpot | recraft | kling |
| ----------- | ------ | ------------- | -------- | ------ | ----------- | ---- | ---- | ------------- | ------------ | ------ | ------- | ----- |
| subject     | 2/3    | 1/2           | 1/2      | 1/2    | 1/2         | 1/2  | 2/3  | 2/3           | 1/1          | 1/2    | 3/4     | 3/5   |
| action      | 1/2    | 1/1           | 1/1      | 1/1    | 1/1         | 1/1  | 1/2  | 1/1           | 1/1          | 1/1    | 1/2     | 1/2   |
| style       | 1/2    | 1/2           | 1/1      | 1/2    | 1/2         | 1/2  | 2/3  | 2/3           | 1/1          | 1/1    | 1/1     | 2/3   |
| environment | 2/3    | 1/2           | 1/2      | 1/1    | 1/1         | 1/1  | 2/3  | 2/3           | 1/1          | 1/1    | 2/3     | 2/3   |
| composition | 1/1    | 1/1           | 1/2      | 1/1    | 1/1         | 1/1  | 1/2  | 1/1           | 1/1          | 1/1    | 1/2     | 1/2   |
| camera      | 1/1    | 1/1           | 1/1      | 1/1    | 1/1         | 1/1  | 1/2  | 1/2           | 1/1          | 1/1    | 1/1     | 1/2   |
| lighting    | 1/2    | 1/1           | 1/2      | 1/2    | 1/1         | 1/1  | 2/3  | 2/3           | 1/1          | 1/2    | 1/2     | 2/3   |
| atmosphere  | 1/2    | 1/2           | 1/2      | 1/1    | 1/1         | 1/1  | 2/3  | 2/2           | 1/1          | 1/1    | 1/1     | 1/2   |
| colour      | 1/2    | 1/1           | 1/1      | 1/2    | 1/1         | 1/1  | 1/2  | 1/2           | 1/1          | 1/1    | 1/2     | 1/2   |
| materials   | 1/2    | 1/2           | 1/2      | 1/1    | 1/1         | 1/1  | 2/3  | 2/3           | 1/1          | 1/1    | 1/2     | 1/1   |
| fidelity    | 1/1    | 1/1           | 1/1      | 1/1    | 1/1         | 1/1  | 0/0  | 1/2           | 1/1          | 1/1    | 0/0     | 2/3   |
| negative    | 0/0    | 0/0           | 3/5      | 0/0    | 0/0         | 0/0  | 3/5  | 0/0           | 0/0          | 3/5    | 3/5     | 3/5   |

### Platform-Specific Notes

**OpenAI (DALL-E 3)** — GPT-4 rewrites everything. Optimal: 400–800 chars. Cannot process negation. API `style` and `quality` params replace fidelity stacking.

**Flux** — **Highest stacking tolerance of all 40 platforms.** T5-XXL, 512 tokens. CLIP weight syntax ignored. Quality tags **0/0**. FLUX.2 uses 24B Mistral encoder.

**Google Imagen** — T5-XXL architecture. Quality modifiers DO work. Negation discouraged.

**Adobe Firefly** — Stacking split between prompt and UI panels. UI overrides conflicting keywords. Negatives **removed entirely**.

**Ideogram** — Stacking degrades text-rendering accuracy. Style mixing: "four styles fighting for custody." Negative field: 3–5 terms.

**Microsoft Designer / Bing** — DALL-E 3 with ~480 char limit. Bing lacks GPT-4 rewriting.

**Meta Imagine** — Most basic Tier 3. Everything 1/1.

**Recraft V3** — Proprietary encoder, 4,000-char limit. Structured NL: `A <style> of <subject>. <description>. <background>.` Style system (100+ presets) makes prompt-side style terms redundant (1/1). Subject handling is core strength — accurate count, colour, position. Fidelity **0/0**. Negative field exists (separate) but inconsistent; simple nouns only, 3–5 max. API accepts hex-code `colors` parameter.

**Kling AI** — ChatGLM3-6B encoder, 256-token / 2,500-char limit. Subject=3/5 (LLM handles multi-entity well). Fidelity **2/3** — uniquely effective because ChatGLM3 understands quality descriptors semantically. Negative prompts technically supported but frequently backfire in practice. **Route all Kling negatives through positive conversion by default.**

---

## Tier 4 — Plain Language Platforms (16 platforms)

### Per-Platform Limits (free / pro)

| Category    | canva | craiyon | deepai | pixlr | picwish | fotor | visme | vistacreate | myedit | simplified | freepik | picsart | photoleap | artbreeder | 123rf | artistly | luma-ai |
| ----------- | ----- | ------- | ------ | ----- | ------- | ----- | ----- | ----------- | ------ | ---------- | ------- | ------- | --------- | ---------- | ----- | -------- | ------- |
| subject     | 1/2   | 1/1     | 1/2    | 1/1   | 1/1     | 1/2   | 1/1   | 1/1         | 1/2    | 1/2        | 1/2     | 1/2     | 1/2       | 1/2        | 1/1   | 1/1      | 3/4     |
| action      | 1/1   | 1/1     | 1/1    | 1/1   | 1/1     | 1/1   | 1/1   | 1/1         | 1/1    | 1/1        | 1/1     | 1/1     | 1/1       | 1/1        | 1/1   | 1/1      | 1/2     |
| style       | 1/1   | 1/1     | 1/1    | 1/1   | 1/1     | 1/2   | 1/1   | 1/1         | 1/1    | 1/2        | 1/1     | 1/1     | 1/1       | 1/1        | 1/1   | 1/1      | 2/3     |
| environment | 1/1   | 1/1     | 1/1    | 1/1   | 1/1     | 1/1   | 1/1   | 1/1         | 1/1    | 1/1        | 1/1     | 1/1     | 1/1       | 1/1        | 1/1   | 1/1      | 2/3     |
| composition | 1/1   | 1/1     | 1/1    | 1/1   | 1/1     | 1/1   | 1/1   | 1/1         | 1/1    | 1/1        | 1/1     | 1/1     | 1/1       | 1/1        | 1/1   | 1/1      | 1/2     |
| camera      | 1/1   | 1/1     | 1/1    | 1/1   | 1/1     | 1/1   | 1/1   | 1/1         | 1/1    | 1/1        | 1/1     | 1/1     | 1/1       | 1/1        | 1/1   | 1/1      | 1/2     |
| lighting    | 1/1   | 1/1     | 1/1    | 1/1   | 1/1     | 1/2   | 1/1   | 1/1         | 1/1    | 1/2        | 1/1     | 1/1     | 1/1       | 1/1        | 1/1   | 1/1      | 2/3     |
| atmosphere  | 1/1   | 1/1     | 1/1    | 1/1   | 1/1     | 1/1   | 1/1   | 1/1         | 1/1    | 1/1        | 1/1     | 1/1     | 1/1       | 1/1        | 1/1   | 1/1      | 1/2     |
| colour      | 1/1   | 1/1     | 1/1    | 1/1   | 1/1     | 1/1   | 1/1   | 1/1         | 1/1    | 1/1        | 1/1     | 1/1     | 1/1       | 1/1        | 1/1   | 1/1      | 1/2     |
| materials   | 1/1   | 1/1     | 1/1    | 1/1   | 1/1     | 1/2   | 1/1   | 1/1         | 1/1    | 1/2        | 1/1     | 1/1     | 1/1       | 1/1        | 1/1   | 1/1      | 1/2     |
| fidelity    | 1/1   | 1/1     | 1/1    | 1/1   | 1/1     | 1/2   | 1/1   | 1/1         | 1/1    | 1/2        | 1/1     | 1/1     | 1/1       | 1/1        | 1/1   | 1/1      | 0/0     |
| negative    | 0/0   | 2/4     | 3/5    | 0/0   | 0/0     | 4/7   | 0/0   | 0/0         | 0/0    | 4/7        | 0/0     | 0/0     | 0/0       | 3/5        | 0/0   | 0/0      | 0/0     |

### Platform-Specific Notes

**Luma AI (Photon 1)** — Proprietary "Universal Transformer" (not diffusion), ~5,000-char limit. Eliminates "AI look" architecturally. Despite Tier 4 classification, handles higher stacking than other T4 platforms: subject=3/4, style=2/3, lighting=2/3. Fidelity **0/0**. Negative prompts **not supported at all** — Luma states: "When you tell the AI to exclude people, it initially adds them and then tries to remove them." All negatives route through `NEGATIVE_TO_POSITIVE`. Luma recommends: "pristine," "serene," "minimalist," "untouched," "empty."

**Fotor** — Full SD controls in "SD mode." In Essential mode, 1/1.

**Simplified** — 14+ models. Elevated numbers reflect SD model capabilities.

**Artbreeder** — Slider-based "genes" replace prompting. Prompter tool uses SDXL.

**Canva** — Auto-rewrites prompts. 20–30 words max.

**Freepik** — 3–7 words ideal. Multi-model auto-selection.

---

## Fidelity Conversion Rules — Budget-Aware (v3.0.0)

> **Supersedes Option B static conversion.** The assembler's budget-aware conversion pipeline (Parts 1–5 in `conversion-costs.ts`, `conversion-budget.ts`, `conversion-scorer.ts`, `conversion-affinities.ts`) now dynamically decides which conversions fit within the prompt budget. Fidelity and negative selections represent UI slots — the assembler decides how many make it into the output.

### How it works

1. User selects fidelity/negative terms in the UI dropdown (limits in `PLATFORM_SPECIFIC_LIMITS`)
2. The assembler strips pooled terms before sub-assembly (core prompt doesn't see them)
3. Each term is looked up in the Conversion Cost Registry → `ConversionEntry` with word cost
4. Budget calculator measures `remaining = ceiling - core - prefix - suffix`
5. Scorer scores each candidate on coherence (0.4) + cost efficiency (0.35) + impact (0.25)
6. Greedy inclusion: parametric first (free), then inline by score descending within budget
7. Deferred terms get `reason: 'budget' | 'low-coherence'` in metadata

### Platforms requiring conversion

| Platform       | Fidelity (free/pro) | Negative (free/pro) | Strategy                                                                    |
| -------------- | ------------------- | ------------------- | --------------------------------------------------------------------------- |
| Midjourney V6+ | 2/3                 | 2/4                 | Parametric: `--quality 2`, `--stylize 300`. Always included (cost=0).       |
| BlueWillow     | 1/2                 | 2/3                 | Same MJ engine, fewer slots.                                                |
| Flux           | 2/3                 | 3/5                 | NL clauses: "captured with extraordinary clarity". Budget-gated.            |
| Recraft V3     | 1/2                 | 3/5                 | NL clauses. Style presets do most quality work.                             |
| Luma Photon    | 1/2                 | 2/3                 | NL clauses + negatives now convert (was 0/0).                               |
| DALL-E 3       | 1/1                 | 2/3                 | Negatives convert to positives (negativeSupport: none). Fidelity unchanged. |
| Adobe Firefly  | 1/1                 | 2/3                 | Same as DALL-E 3.                                                           |
| Bling/Designer | 1/1                 | 1/2                 | Short budget, fewer conversions fit.                                        |
| Kling AI       | 2/3                 | 2/3                 | Negatives forced through conversion despite model-level support.            |
| Jasper Art     | 1/1                 | 1/2                 | DALL-E 2 backend, negatives convert.                                        |
| All 'none' T4  | unchanged           | 1/2                 | Gives conversion pool input on platforms that had 0/0 before.               |

### Conversion routing by negativeSupport

| negativeSupport | Behaviour                                                    | Platforms                                                         |
| --------------- | ------------------------------------------------------------ | ----------------------------------------------------------------- |
| `'separate'`    | Negatives go to separate field. **Do NOT enter pool.** Gap 3 | Leonardo, Stability, Tensor.Art, Flux, Recraft, etc.              |
| `'none'`        | All negatives enter conversion pool → positive reinforcement | DALL-E, Firefly, Bing, Designer, Meta, Canva, Luma, Kling, Jasper |
| `'inline'`      | Known negatives convert, unknown → `--no X` / `without X`    | Midjourney, BlueWillow                                            |

### Platforms where fidelity IS effective (pass-through, no conversion)

All Tier 1 CLIP platforms (Stability, Leonardo, NightCafe, etc.), Tensor.Art, Kling AI (fidelity only), Google Imagen.

---

## Key Findings vs Current Implementation

### What was changed (v3.0.0, 19 Mar 2026)

1. ✅ **Jasper Art** — Reclassified from Tier 1 to Tier 3. Uses DALL-E 2, not SD. Negative=1/2.
2. ✅ **Flux fidelity** — Now **2/3** (was 0/0). Budget-aware NL conversion via `conversion-costs.ts`.
3. ✅ **Midjourney fidelity** — Now **2/3** (was 0/0). Parametric conversion (`--quality 2`, `--stylize 300`).
4. ✅ **Recraft V3 fidelity** — Now **1/2** (was 0/0). NL conversion, style presets complement.
5. ✅ **Luma Photon negatives** — Now **2/3** (was 0/0). Route through conversion pool.
6. ✅ **Kling AI negatives** — Now **2/3** (was 3/5). Forced through positive conversion.
7. ✅ **Per-platform limits replace tier-generic limits.** `PLATFORM_SPECIFIC_LIMITS` in `constants.ts`.
8. ✅ **Negative limits platform-specific.** 23 platforms updated from 0/0 to conversion-aware values.

### What the current implementation gets right

- Four tiers is correct (with Jasper Art reclassification)
- `PAID_BONUS_CATEGORIES` concept is sound — bonus should be variable, not flat +1
- `getCategoryLimitsForPlatformTier()` supports per-platform overrides
- `NEGATIVE_TO_POSITIVE` conversion is a genuine differentiator across 40 platforms
- Assembler routing (`negativeSupport: 'separate' | 'inline' | 'none'`) handles all patterns

---

## Consolidated Quick-Reference (all 40)

Format: `category=free/pro`

### Tier 1 — CLIP-Based (14)

- **stability**: subject=1/2, action=1/1, style=1/2, environment=1/1, composition=1/1, camera=1/1, lighting=1/2, atmosphere=1/2, colour=1/1, materials=1/1, fidelity=1/2, negative=5/10
- **leonardo**: subject=2/3, action=1/1, style=2/3, environment=1/2, composition=1/1, camera=1/2, lighting=2/3, atmosphere=2/2, colour=1/2, materials=2/3, fidelity=2/3, negative=5/8
- **clipdrop**: subject=1/2, action=1/1, style=1/2, environment=1/2, composition=1/1, camera=1/1, lighting=1/2, atmosphere=1/2, colour=1/1, materials=1/2, fidelity=1/2, negative=5/8
- **nightcafe**: subject=1/2, action=1/1, style=1/2, environment=1/2, composition=1/1, camera=1/1, lighting=1/2, atmosphere=1/2, colour=1/1, materials=1/2, fidelity=1/2, negative=5/8
- **dreamstudio**: subject=1/2, action=1/1, style=1/2, environment=1/1, composition=1/1, camera=1/1, lighting=1/2, atmosphere=1/2, colour=1/1, materials=1/1, fidelity=1/2, negative=5/10
- **lexica**: subject=1/2, action=1/1, style=1/2, environment=1/2, composition=1/1, camera=1/1, lighting=1/2, atmosphere=1/2, colour=1/1, materials=1/2, fidelity=1/2, negative=4/6
- **novelai**: subject=2/3, action=1/1, style=1/3, environment=1/2, composition=1/2, camera=1/1, lighting=1/2, atmosphere=1/2, colour=1/2, materials=1/2, fidelity=2/4, negative=5/10
- **dreamlike**: subject=1/2, action=1/1, style=1/2, environment=1/1, composition=1/1, camera=1/1, lighting=1/2, atmosphere=1/1, colour=1/1, materials=1/1, fidelity=1/2, negative=5/8
- **getimg**: subject=1/2, action=1/1, style=1/2, environment=1/2, composition=1/1, camera=1/1, lighting=1/2, atmosphere=1/2, colour=1/1, materials=1/2, fidelity=1/2, negative=5/8
- **openart**: subject=1/2, action=1/1, style=1/2, environment=1/2, composition=1/1, camera=1/1, lighting=1/2, atmosphere=1/2, colour=1/1, materials=1/2, fidelity=1/2, negative=5/8
- **playground**: subject=1/2, action=1/1, style=1/2, environment=1/2, composition=1/1, camera=1/1, lighting=1/2, atmosphere=1/2, colour=1/2, materials=1/2, fidelity=1/2, negative=4/6
- **artguru**: subject=1/2, action=1/1, style=1/1, environment=1/1, composition=1/1, camera=1/1, lighting=1/1, atmosphere=1/1, colour=1/1, materials=1/1, fidelity=1/1, negative=3/5
- **jasper-art**: subject=1/2, action=1/1, style=1/2, environment=1/1, composition=1/1, camera=1/1, lighting=1/1, atmosphere=1/1, colour=1/1, materials=1/1, fidelity=1/1, negative=1/2
- **tensor-art**: subject=3/5, action=1/2, style=2/3, environment=2/3, composition=1/2, camera=1/2, lighting=1/2, atmosphere=1/1, colour=1/2, materials=1/2, fidelity=3/4, negative=5/8

### Tier 2 — Midjourney Family (2)

- **midjourney**: subject=1/3, action=1/1, style=1/2, environment=1/2, composition=1/1, camera=1/1, lighting=1/2, atmosphere=1/2, colour=1/2, materials=1/2, fidelity=2/3, negative=2/4
- **bluewillow**: subject=1/2, action=1/1, style=1/2, environment=1/1, composition=1/1, camera=1/1, lighting=1/2, atmosphere=1/1, colour=1/1, materials=1/1, fidelity=1/2, negative=2/3

### Tier 3 — Natural Language (13)

- **openai**: subject=2/3, action=1/2, style=1/2, environment=2/3, composition=1/1, camera=1/1, lighting=1/2, atmosphere=1/2, colour=1/2, materials=1/2, fidelity=1/1, negative=2/3
- **adobe-firefly**: subject=1/2, action=1/1, style=1/2, environment=1/2, composition=1/1, camera=1/1, lighting=1/1, atmosphere=1/2, colour=1/1, materials=1/2, fidelity=1/1, negative=2/3
- **ideogram**: subject=1/2, action=1/1, style=1/1, environment=1/2, composition=1/2, camera=1/1, lighting=1/2, atmosphere=1/2, colour=1/1, materials=1/2, fidelity=1/1, negative=3/5
- **runway**: subject=1/2, action=1/1, style=1/2, environment=1/1, composition=1/1, camera=1/1, lighting=1/2, atmosphere=1/1, colour=1/2, materials=1/1, fidelity=1/1, negative=0/0
- **microsoft-designer**: subject=1/2, action=1/1, style=1/2, environment=1/1, composition=1/1, camera=1/1, lighting=1/1, atmosphere=1/1, colour=1/1, materials=1/1, fidelity=1/1, negative=1/2
- **bing**: subject=1/2, action=1/1, style=1/2, environment=1/1, composition=1/1, camera=1/1, lighting=1/1, atmosphere=1/1, colour=1/1, materials=1/1, fidelity=1/1, negative=1/2
- **flux**: subject=2/3, action=1/2, style=2/3, environment=2/3, composition=1/2, camera=1/2, lighting=2/3, atmosphere=2/3, colour=1/2, materials=2/3, fidelity=2/3, negative=3/5
- **google-imagen**: subject=2/3, action=1/1, style=2/3, environment=2/3, composition=1/1, camera=1/2, lighting=2/3, atmosphere=2/2, colour=1/2, materials=2/3, fidelity=1/2, negative=0/0
- **imagine-meta**: subject=1/1, action=1/1, style=1/1, environment=1/1, composition=1/1, camera=1/1, lighting=1/1, atmosphere=1/1, colour=1/1, materials=1/1, fidelity=1/1, negative=1/2
- **hotpot**: subject=1/2, action=1/1, style=1/1, environment=1/1, composition=1/1, camera=1/1, lighting=1/2, atmosphere=1/1, colour=1/1, materials=1/1, fidelity=1/1, negative=3/5
- **recraft**: subject=3/4, action=1/2, style=1/1, environment=2/3, composition=1/2, camera=1/1, lighting=1/2, atmosphere=1/1, colour=1/2, materials=1/2, fidelity=1/2, negative=3/5
- **kling**: subject=3/5, action=1/2, style=2/3, environment=2/3, composition=1/2, camera=1/2, lighting=2/3, atmosphere=1/2, colour=1/2, materials=1/1, fidelity=2/3, negative=2/3

### Tier 4 — Plain Language (16)

- **canva**: subject=1/2, action=1/1, style=1/1, environment=1/1, composition=1/1, camera=1/1, lighting=1/1, atmosphere=1/1, colour=1/1, materials=1/1, fidelity=1/1, negative=1/2
- **craiyon**: subject=1/1, action=1/1, style=1/1, environment=1/1, composition=1/1, camera=1/1, lighting=1/1, atmosphere=1/1, colour=1/1, materials=1/1, fidelity=1/1, negative=2/4
- **deepai**: subject=1/2, action=1/1, style=1/1, environment=1/1, composition=1/1, camera=1/1, lighting=1/1, atmosphere=1/1, colour=1/1, materials=1/1, fidelity=1/1, negative=3/5
- **pixlr**: subject=1/1, action=1/1, style=1/1, environment=1/1, composition=1/1, camera=1/1, lighting=1/1, atmosphere=1/1, colour=1/1, materials=1/1, fidelity=1/1, negative=1/2
- **picwish**: subject=1/1, action=1/1, style=1/1, environment=1/1, composition=1/1, camera=1/1, lighting=1/1, atmosphere=1/1, colour=1/1, materials=1/1, fidelity=1/1, negative=1/2
- **fotor**: subject=1/2, action=1/1, style=1/2, environment=1/1, composition=1/1, camera=1/1, lighting=1/2, atmosphere=1/1, colour=1/1, materials=1/2, fidelity=1/2, negative=4/7
- **visme**: subject=1/1, action=1/1, style=1/1, environment=1/1, composition=1/1, camera=1/1, lighting=1/1, atmosphere=1/1, colour=1/1, materials=1/1, fidelity=1/1, negative=1/2
- **vistacreate**: subject=1/1, action=1/1, style=1/1, environment=1/1, composition=1/1, camera=1/1, lighting=1/1, atmosphere=1/1, colour=1/1, materials=1/1, fidelity=1/1, negative=1/2
- **myedit**: subject=1/2, action=1/1, style=1/1, environment=1/1, composition=1/1, camera=1/1, lighting=1/1, atmosphere=1/1, colour=1/1, materials=1/1, fidelity=1/1, negative=1/2
- **simplified**: subject=1/2, action=1/1, style=1/2, environment=1/1, composition=1/1, camera=1/1, lighting=1/2, atmosphere=1/1, colour=1/1, materials=1/2, fidelity=1/2, negative=4/7
- **freepik**: subject=1/2, action=1/1, style=1/1, environment=1/1, composition=1/1, camera=1/1, lighting=1/1, atmosphere=1/1, colour=1/1, materials=1/1, fidelity=1/1, negative=1/2
- **picsart**: subject=1/2, action=1/1, style=1/1, environment=1/1, composition=1/1, camera=1/1, lighting=1/1, atmosphere=1/1, colour=1/1, materials=1/1, fidelity=1/1, negative=1/2
- **photoleap**: subject=1/2, action=1/1, style=1/1, environment=1/1, composition=1/1, camera=1/1, lighting=1/1, atmosphere=1/1, colour=1/1, materials=1/1, fidelity=1/1, negative=1/2
- **artbreeder**: subject=1/2, action=1/1, style=1/1, environment=1/1, composition=1/1, camera=1/1, lighting=1/1, atmosphere=1/1, colour=1/1, materials=1/1, fidelity=1/1, negative=3/5
- **123rf**: subject=1/1, action=1/1, style=1/1, environment=1/1, composition=1/1, camera=1/1, lighting=1/1, atmosphere=1/1, colour=1/1, materials=1/1, fidelity=1/1, negative=1/2
- **artistly**: subject=1/1, action=1/1, style=1/1, environment=1/1, composition=1/1, camera=1/1, lighting=1/1, atmosphere=1/1, colour=1/1, materials=1/1, fidelity=1/1, negative=1/2
- **luma-ai**: subject=3/4, action=1/2, style=2/3, environment=2/3, composition=1/2, camera=1/2, lighting=2/3, atmosphere=1/2, colour=1/2, materials=1/2, fidelity=1/2, negative=2/3

---

## The Fundamental Insight

Prompts navigate a learned latent space, not instruct a generator. Stacking compatible terms productively narrows to a coherent region. Stacking conflicting terms forces averaging and produces the generic "AI look." The most effective strategy across all 40 platforms: **maximise coherence, not term count.**

---

## Changelog

| Date        | Version | Change                                                                                                                                                                                                                                                                                                                                       |
| ----------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 20 Mar 2026 | 3.0.0   | Quick-reference tables updated to match code (PLATFORM_SPECIFIC_LIMITS). 46 values changed: fidelity enabled on 5 conversion platforms (MJ, Flux, Recraft, BlueWillow, Luma), negatives enabled on 18 'none' platforms via conversion pool, Kling negatives reduced to 2/3. Doc now matches code exactly — 0 mismatches across 1,080 values. |
| 19 Mar 2026 | 2.0.0   | Updated to 40 platforms. Added Recraft V3, Kling AI, Luma AI, Tensor.Art. Removed remove-bg. Added ChatGLM3 + proprietary encoder sections. Added Fidelity Conversion Rules (Option B). Updated all tier counts and quick-reference.                                                                                                         |
| 19 Mar 2026 | 1.0.0   | Initial document. Full 42-platform research with per-platform, per-category limits.                                                                                                                                                                                                                                                          |

| 9 Apr 2026  | 4.0.0   | Platform count 45→40. 5 multi-engine aggregators removed (NightCafe, OpenArt, Tensor.Art, GetImg, Freepik). All "45" references updated to "40". |
