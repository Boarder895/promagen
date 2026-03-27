# Prompt Engineering Specs for 40 AI Image Platforms — Tier Classification & Routing Logic

**Version:** 2.0.0
**Updated:** 26 March 2026
**Authority:** Single source of truth for platform tier assignments, prompt architecture, and routing logic.
**Supersedes:** `grouping-45-image-platforms-by-prompt-compatibility.md` (deleted)

**Of the original 45 platforms audited, 19 carried incorrect tier assignments — a 43% misclassification rate.** The most dangerous errors: seven platforms believed to be Tier 1 (CLIP/tag-based) actually belong in Tier 3 or 4, meaning users would receive comma-separated keyword prompts for engines that read natural language prose. BlueWillow, believed to be Tier 2 (Midjourney family), is actually Tier 4 — it supports almost none of Midjourney's syntax.

**Post-audit action (26 Mar 2026):** 5 multi-engine aggregators (NightCafe, OpenArt, Tensor.Art, GetImg, Freepik) were **removed** from the platform roster. Their dynamic model-routing requirement made single-tier assignment impossible and they added maintenance burden disproportionate to user value. The active platform count is now **40 platforms across 10 optimisation groups**. `group-multi-engine.ts` was deleted.

---

## 14 tier corrections applied (originally 19 — 5 removed with aggregators)

The following table shows every platform whose user-assumed tier is wrong. Bolded entries represent the highest-risk misclassifications — where the prompt format difference is structurally significant enough to produce poor output.

| platform_id            | Believed tier | Correct tier   | Why                                                                                 |
| ---------------------- | ------------- | -------------- | ----------------------------------------------------------------------------------- |
| **artguru**            | **1**         | **4**          | No exposed CLIP syntax, no weights, style-preset driven                             |
| **artistly**           | **1**         | **4**          | Keyword-to-prompt auto-expander, no syntax, no negatives                            |
| **clipdrop**           | **1**         | **4**          | API: 1000-char plain text only; no weights, no API negatives                        |
| **playground**         | **1**         | **3**          | PGv3 is proprietary LLM-integrated NL model; mapped to clean-natural-language group |
| **bluewillow**         | **2**         | **4**          | No :: weighting, no --param flags beyond --ar/--no/--v; acquired by LimeWillow      |
| **jasper-art**         | **3**         | **4**          | 400-char limit, DALL-E 2 backend, dropdown-driven, no negative prompts              |
| **hotpot**             | **3**         | **4**          | 380-char limit, 180+ style presets do the work, SDXL abstracted away                |
| **microsoft-designer** | **3**         | **4**          | ~480-char limit, enhance-prompt workflow, template-focused                          |
| **canva**              | 4             | **3**          | Leonardo Phoenix (Dream Lab) benefits from detailed NL prose                        |
| **fotor**              | **4**         | **1**          | Exposes full SD (term:1.3) weight syntax and negative prompt field                  |
| **pixlr**              | 4             | **3**          | Three generation modes (Fast/Pro/Ultra), negative prompts, detailed prose rewarded  |
| **simplified**         | 4             | **3**          | 14+ model aggregator, NL prose, negative prompts on some models                     |
| **artbreeder**         | 4             | **3** (hybrid) | Text-to-image modes use NL; Splicer mode is slider-based (non-textual)              |
| **deepai**             | 4             | **3**          | Full REST API with negative_prompt parameter, SD-based, NL prose                    |

---

## Complete platform reference table

The table below provides the production-ready classification for every platform. Multi-engine platforms are marked with ⚡ and require dynamic routing.

| platform_id        | Tier | Prompt architecture                                    | Weight syntax                                      | Negative support                                     | Token/char limit                                 | Ideal min | Ideal max |
| ------------------ | ---- | ------------------------------------------------------ | -------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------ | --------- | --------- |
| stability          | 1    | CLIP dual-encoder (SDXL); T5+CLIP (SD3.5)              | API: text_prompts[weight] float; A1111: (term:1.3) | Separate field (SD3.5); negative weight (SDXL)       | SDXL: 77 tok; SD3.5: 512 tok / 10K chars         | 30        | 1500      |
| dreamstudio        | 1    | CLIP-based, same as Stability API                      | term:weight bare-colon (NOT parenthetical)         | Separate field + negative weights                    | 77 tokens (CLIP)                                 | 30        | 500       |
| dreamlike          | 1    | CLIP-based SD 1.5 fine-tunes                           | (term:1.3) full parenthetical                      | Separate field                                       | 77 tokens (web)                                  | 40        | 400       |
| lexica             | 1    | CLIP-based (Aperture v3.5, SD heritage)                | ((emphasis)) likely; (term:1.3) unconfirmed native | Separate field                                       | ~77 tokens                                       | 40        | 400       |
| novelai            | 1★   | CLIP + Danbooru tags                                   | {{{term}}} braces ×1.05 each; V4: num::text ::     | "Undesired Content" field + inline -num::            | ~225 tokens (context bar)                        | 30        | 500       |
| fotor              | 1    | CLIP-based SD                                          | (term:1.3) explicitly documented                   | Separate field                                       | ~77 tokens (SD)                                  | 50        | 500       |
| leonardo           | 1    | CLIP encoder (SDXL family); keyword prompts            | term::weight double-colon (not parenthetical)      | Separate field                                       | ~77 tokens (CLIP); ~1000 chars                   | 250       | 400       |
| midjourney         | 2    | Hybrid NL + :: multi-prompt; V7/V8 prefer prose        | term::weight double-colon; --no = ::-0.5           | Inline --no flag + negative ::weights                | ~6000 chars; ~77 tok/segment; 60-word sweet spot | 40        | 350       |
| openai             | 3    | NL prose; GPT-4 always rewrites prompt                 | None                                               | None                                                 | 4000 chars                                       | 50        | 3000      |
| google-imagen      | 3    | NL prose; Subject+Context+Style                        | None                                               | Legacy/deprecated for Imagen 3+                      | 480 tokens (~1500 chars)                         | 50        | 1200      |
| bing               | 3    | NL prose; DALL-E 3 backend, no rewriting               | None                                               | None                                                 | ~480 chars                                       | 30        | 400       |
| adobe-firefly      | 3    | NL prose; extensive UI style controls                  | None                                               | Removed from web app; not functional                 | ~1000 chars (web)                                | 30        | 800       |
| flux               | 3    | NL prose; T5-XXL primary encoder                       | None natively                                      | None (explicitly unsupported)                        | 512 tokens (T5); 256 for schnell                 | 80        | 600       |
| ideogram           | 3    | NL prose; proprietary model                            | None                                               | Separate field (soft constraints); API: 1-2000 chars | ~200 tokens (~800 chars)                         | 50        | 800       |
| recraft            | 3    | NL prose; design-focused descriptions                  | None                                               | Separate field + "Avoid text" toggle                 | ~1000-1500 chars estimated                       | 50        | 800       |
| imagine-meta       | 3    | NL prose; Meta Emu model                               | None                                               | None                                                 | Not documented; moderate length                  | 30        | 400       |
| runway             | 3    | NL prose; [camera]: [scene]. [details].                | None                                               | None (explicitly causes opposite)                    | 1000 chars                                       | 100       | 800       |
| luma-ai            | 3    | NL prose; conversational style                         | None                                               | None (actively discouraged)                          | 3000-5000 chars (API)                            | 80        | 600       |
| kling              | 3    | NL prose; Subject+Action+Context+Style                 | None confirmed natively                            | Separate field                                       | 2500 chars                                       | 80        | 500       |
| canva              | 3    | NL prose; Leonardo Phoenix (Dream Lab)                 | None                                               | None                                                 | Not documented; min 5 words                      | 30        | 350       |
| pixlr              | 3    | NL prose; Fast/Pro/Ultra modes                         | Unofficial parenthetical in blog examples          | Separate field with toggle                           | Not documented                                   | 30        | 400       |
| simplified         | 3    | NL prose across 14+ models                             | None                                               | Yes (on compatible models)                           | Not strict limit                                 | 30        | 400       |
| visme              | 3    | NL prose; Dreamscape API (SD variant)                  | None                                               | None                                                 | Not documented                                   | 50        | 500       |
| vistacreate        | 3    | NL prose; Bria.ai backend                              | None                                               | None (Bria API has it, UI doesn't)                   | ~3000 chars (Bria backend)                       | 40        | 400       |
| 123rf              | 3    | NL prose; multiple style engines                       | None                                               | None                                                 | Not documented                                   | 50        | 500       |
| myedit             | 3    | NL prose; Nano Banana Pro (Google)                     | None                                               | None                                                 | Not documented                                   | 30        | 350       |
| artbreeder         | 3★   | Hybrid: NL for text-to-image; slider genes for Splicer | None (sliders for Splicer mode)                    | Yes (backend/API)                                    | SDXL: 77 tok; Flux: 256-512                      | 30        | 500       |
| deepai             | 3    | NL prose; SD-based                                     | None                                               | Yes — API negative_prompt parameter                  | Not documented                                   | 30        | 500       |
| playground         | 3    | PGv3: NL/LLM-integrated; v2.5: CLIP-based              | PGv3: none; v2.5: (term:1.3)                       | "Exclude from Image" field                           | PGv3: very long; v2.5: 77 tok                    | 40        | 500       |
| bluewillow         | 4    | Simple NL via Discord /imagine                         | None (officially confirmed)                        | Inline --no only                                     | ~77 tok (SD backend); undocumented               | 20        | 200       |
| artguru            | 4    | Simple NL + 30+ style presets                          | None                                               | Separate field (limited visibility)                  | ~500 chars estimated                             | 20        | 300       |
| artistly           | 4    | Keyword input; Smart Prompt Enhancer auto-expands      | None                                               | None                                                 | ~200 chars estimated                             | 5         | 200       |
| clipdrop           | 4    | Simple plain text; SDXL Turbo backend                  | None                                               | Web UI only (not API)                                | API: 1000 chars                                  | 20        | 500       |
| jasper-art         | 4    | Simple NL; DALL-E 2 backend                            | None                                               | None                                                 | 400 chars hard limit                             | 50        | 400       |
| microsoft-designer | 4    | Simple NL; DALL-E 3/GPT-4o backend                     | None                                               | None                                                 | ~480 chars                                       | 20        | 400       |
| hotpot             | 4    | Simple NL + 180+ style selectors; SDXL backbone        | None (SDXL abstracted)                             | Separate field                                       | 380 chars (Art Generator)                        | 30        | 380       |
| craiyon            | 4    | Plain text; proprietary ex-DALL-E Mini model           | None                                               | Separate field (Expert Mode)                         | Not documented                                   | 10        | 200       |
| picsart            | 4    | Simple NL; 90+ models via AI Playground                | None                                               | None                                                 | Not documented                                   | 15        | 250       |
| picwish            | 4    | Short NL sentences; editor-first platform              | None                                               | None                                                 | Not documented                                   | 20        | 250       |
| photoleap          | 4    | Simple NL; mobile-first SD-based                       | None                                               | None                                                 | Not documented                                   | 15        | 200       |

---

## Removed: Five multi-engine aggregators (historical reference)

NightCafe, OpenArt, Tensor.Art, GetImg, and Freepik were removed from the active platform roster on 26 Mar 2026. Their dynamic model-routing requirement (each platform hosts multiple backend engines spanning Tier 1–3) made single-tier assignment impossible. Supporting them properly would require model-detection logic that doesn't exist in the current architecture. If re-added in future, each would need per-model tier routing — not a single group assignment.

---

## Midjourney's parameter system is uniquely complex

Midjourney stands alone in Tier 2 because no other platform replicates its full syntax. The `::` multi-prompt system separates concepts for independent processing — `hot dog` generates food, while `hot:: dog` generates a warm animal. Each `::` segment gets its own **~77 token budget**, effectively bypassing the single-segment token limit. Weights are relative: `wood::4 teapot::1` equals `wood::8 teapot::2`. The practical ratio range caps at roughly 1:5 before underweighted elements vanish.

**V7 (current default, April 2025) and V8 Alpha (March 2026)** represent a fundamental shift. Keyword-stuffing ("beautiful, stunning, 8k, detailed, masterpiece") actively degrades V7+ output. Words 1-20 carry heavy influence, 21-40 moderate, 40+ diminishing, 60+ functionally ignored. V8 is more literal than V7 — it delivers exactly what's asked rather than adding artistic interpretation.

The complete parameter set includes: `--ar` (any aspect ratio), `--stylize`/`--s` (0-1000), `--chaos` (0-100), `--weird` (0-3000), `--style raw`, `--quality`/`--q` (0.25-4), `--no` (negative), `--seed`, `--tile`, `--v`/`--version`, `--niji` (anime models), `--sref` (style reference), `--sw` (style weight), `--oref` (omni reference, V7+), `--p` (personalization), `--draft` (fast preview, 10× faster), `--hd` (native 2K, V8 only), `--repeat`, `--fast`/`--turbo`/`--relax`, and `--stop`.

BlueWillow, despite its Discord `/imagine` interface mimicking Midjourney, supports only **three parameters**: `--ar` (limited to 1:1, 2:3, 3:2), `--no`, and `--v`. It has no `::` weighting, no `--stylize`, no seeds, no style references. The platform was acquired by LimeWire in September 2023, and its original team departed. It is functionally a Tier 4 plain-text generator behind a Discord interface.

---

## NovelAI's brace syntax demands special handling

NovelAI is the only platform using curly-brace emphasis. Each `{` multiplies weight by **1.05** (not 1.1 like standard SD parentheses). The escalation: `{term}` = 1.05×, `{{term}}` = 1.1025×, `{{{term}}}` ≈ 1.16×, `{{{{term}}}}` ≈ 1.22×, `{{{{{term}}}}}` ≈ 1.28×. Square brackets `[term]` divide by 1.05 per layer. Standard SD `(term:1.3)` parenthetical syntax **does not work** on NovelAI.

NovelAI V4 adds numerical emphasis: `1.5::rain, night ::` strengthens those terms by 1.5×. Negative emphasis `-1::hat ::` removes the hat concept. The `::` also closes open braces, so `{{{{{rain ::` is valid shorthand. The model is trained on Danbooru tags, so anime character names must match Danbooru taxonomy exactly (e.g., "yorha no. 2 type b" works, "2b" does not). Quality tags like "very aesthetic, best quality" significantly improve output. The "Undesired Content" field functions as the negative prompt, with pre-built presets for common unwanted elements.

---

## Prompt rewriting engines change what users actually see

Four platforms automatically rewrite prompts before generation, which means Promagen's optimized prompt may not be what the model receives:

**DALL-E 3 (OpenAI)** always rewrites via GPT-4. This cannot be disabled through the API. The `revised_prompt` field in the response reveals the actual prompt. Short prompts get expanded into detailed descriptions; specific prompts may be altered. Promagen should optimize for the pre-rewrite stage, knowing GPT-4 will elaborate.

**Google Imagen 3** has `enhancePrompt` enabled by default. An LLM rewrites the prompt for better quality. This can be disabled with `enhancePrompt: false`. For Imagen 4.0 Fast, disabling enhancement is sometimes recommended for complex prompts.

**Ideogram** offers Magic Prompt with three modes: Auto (Ideogram decides), On (always enhance), Off (use raw prompt). It also auto-translates non-English prompts. If Magic Prompt is On, Promagen's carefully optimized prompt will be rewritten.

**Canva's Dream Lab** auto-expands short prompts into detailed descriptions using Leonardo Phoenix's internal enhancement. There is no way to disable this.

---

## Video platforms share Tier 3 but differ on negative prompts

Runway, Luma AI, and Kling are all video-first platforms classified as Tier 3, but their negative prompt behavior varies critically.

**Runway** (Gen-3 Alpha, Gen-4, Gen-4.5) explicitly warns that negative prompts cause the opposite effect — describing what shouldn't happen may make it happen. The **1000-character** limit applies to Gen-3 Alpha. Prompts should follow the structure `[camera movement]: [establishing scene]. [additional details].` Gen-4 requires an input image, so prompts shift to describing motion and emotion rather than visual appearance.

**Luma AI** (Dream Machine, Ray3) actively discourages negative prompting in its documentation. It has an "Enhance prompt" checkbox that auto-expands short prompts, camera tags in the UI, and `@style` references for visual consistency. The API supports **3000-5000 characters**. The sweet spot is 3-4 descriptive sentences.

**Kling** (by Kuaishou) is the exception — it **has** a dedicated negative prompt field for both text-to-video and image-to-video. The **2500-character** limit is well-documented. Kling 3.0 supports multi-shot sequences with `[Character A]` naming convention. An aggressive content filter blocks certain words that can reject entire prompts, so Promagen should avoid known trigger words.

---

## Recraft and Adobe Firefly are the design-specific outliers

**Recraft** is the only major platform generating **true native SVG vector graphics** — not raster-to-vector tracing. Its extensive style system includes 20+ base styles with sub-styles (e.g., `vector_illustration/line_circuit`, `digital_illustration/pixel_art`). Color palette control accepts exact **RGB values** as a separate parameter. It held #1 on HuggingFace's Text-to-Image leaderboard with V3 (Red Panda). SVG, PNG, JPG, TIFF, and PDF export are all supported. Promagen should output style IDs and optional color palettes alongside the text prompt.

**Adobe Firefly** is trained exclusively on Adobe Stock, openly licensed, and public domain content — making it the only commercially guaranteed-safe option. Its negative prompt field was **removed** from the web app, and the model does not understand negation words ("no beard" adds a beard). The prompt limit is approximately **1000 characters**. Extensive UI style controls (content type, visual styles, color/tone presets, lighting presets, composition presets) do much of the creative direction, so Promagen should recommend style selections alongside the prompt text.

---

## Production routing logic for Promagen

Based on this audit, Promagen needs four prompt generation pipelines:

**Tier 1 pipeline** (7 platforms): Generate comma-separated keywords with quality boosters. Include (term:1.3) weights for emphasis. Always generate a negative prompt. Exception: NovelAI needs {{{term}}} braces instead of parentheses, Danbooru tags, and quality tags. DreamStudio uses bare `term:weight` without parentheses. Target 40-400 characters within 77-token CLIP limit.

**Tier 2 pipeline** (Midjourney only): Generate natural language prose for V7/V8. Use `::` only for deliberate concept separation. Append relevant `--param` flags. Avoid quality keywords. Front-load important concepts. Target 40-350 characters, under 60 words.

**Tier 3 pipeline** (21 platforms): Generate descriptive natural language prose. No special syntax. Structure as Subject + Context + Style. For FLUX, include camera/lens specifications. For video platforms, include camera movement and temporal descriptions. For Ideogram, place text rendering instructions early in quotes. For Recraft, output style ID and color palette as separate fields. Target 50-800 characters depending on platform limits.

**Tier 4 pipeline** (11 platforms): Generate concise, simple descriptions. Rely on platform style selectors. Respect tight character limits (380-480 chars for Hotpot, Jasper, Bing-powered platforms). For platforms with auto-enhancement (Artistly, Microsoft Designer), keep prompts short and let the platform expand.

## Conclusion

The most critical finding was that nearly half the original tier assignments were wrong. The biggest systemic error was classifying consumer platforms that use Stable Diffusion internally (ArtGuru, Artistly, ClipDrop, Hotpot) as Tier 1 — these platforms completely abstract away SD's CLIP tokenization and weight syntax, making them functionally Tier 4. The second major pattern: Playground evolved away from its SD-based origins and now defaults to a proprietary LLM-integrated model, shifting it from Tier 1 to Tier 3. Fotor is the surprise in the opposite direction — a consumer photo editor that fully exposes SD's (term:1.3) syntax, making it the only Tier 4→Tier 1 reclassification.

Five multi-engine aggregators (NightCafe, OpenArt, Tensor.Art, GetImg, Freepik) were removed entirely — their dynamic model-routing requirement made single-tier assignment impossible and added disproportionate maintenance burden. The active roster is now **40 platforms across 10 optimisation groups**, all mapped in `platform-groups.ts`.
