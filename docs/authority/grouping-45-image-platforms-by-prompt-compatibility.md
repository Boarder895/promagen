# Grouping 45 AI image platforms by prompt compatibility

**Seven shared template groups can cover 34 of the 45 platforms, while 11 platforms need dedicated system prompts.** The critical dividing lines are not tier-based but architectural: whether a platform uses pure natural language, Stable Diffusion attention-weight syntax, Midjourney's parameter flags, or structured API payloads. Platforms within each group share enough prompt DNA that a single template with minor per-platform overrides will work. The "unique" platforms diverge so fundamentally — in syntax, purpose, or parameter structure — that shared templates would produce broken or suboptimal prompts.

This analysis covers current 2025–2026 capabilities across all four tiers, based on official documentation and API references.

---

## The seven shared template groups

### Group 1: "Clean natural language, no negative prompts" (9 platforms)

| Platform               | Tier | Max Length    | Style Controls                                     | Key Override                                                    |
| ---------------------- | ---- | ------------- | -------------------------------------------------- | --------------------------------------------------------------- |
| Bing Image Creator     | T1   | ~480 chars    | 5 aspect ratios via UI                             | Model selector (DALL-E 3, GPT-4o, MAI-Image-1)                  |
| Google ImageFX         | T1   | Undocumented  | Expressive Chips only                              | Seed lock toggle                                                |
| Meta AI                | T1   | Undocumented  | None                                               | Square output only, `/imagine` prefix                           |
| Canva AI (Magic Media) | T2   | Undocumented  | 3 style categories                                 | Three output types (image/graphic/video)                        |
| Adobe Firefly          | T2   | Undocumented  | UI presets for content type, lighting, composition | Style auto-detection from prompt text; no artist names          |
| Jasper Art             | T3   | 400 chars     | Mood/medium/style dropdowns                        | DALL-E 2 wrapper; template mode                                 |
| Getty Images AI        | T3   | **100 words** | Photo vs. Illustration toggle                      | Most restrictive length; product placement feature              |
| Shutterstock AI        | T3   | Undocumented  | 98 styles across 5 categories                      | Multi-model selector; 20+ languages                             |
| Craiyon                | T1   | Undocumented  | Raw mode                                           | 9 images per generation; pipe `\|` syntax for concept combining |

**Shared template characteristics:** All accept plain natural language with zero special syntax. None support parentheses weighting, `--` flags, or inline parameters. Negative prompts are either absent or unreliable. The system prompt should instruct the LLM to write vivid, affirmative descriptions — focusing on what to include, never what to exclude. **Prompt strategy is identical: front-load the most important subject, add style/mood descriptors, keep language positive.**

**Per-platform overrides needed:** Prompt length caps (Getty's 100-word limit is severe; Bing's ~480 chars and Jasper's 400 chars also constrain), available style presets to reference, and output format options. Craiyon and Freepik support pipe `|` syntax for batch variations — a minor template branch. Adobe Firefly's auto-detection of style keywords means the template should avoid redundancy between prompt text and UI preset selections.

---

### Group 2: "DALL-E API family" (2 platforms)

| Platform              | Tier | Max Length  | Quality           | Style               | Negative Prompts         |
| --------------------- | ---- | ----------- | ----------------- | ------------------- | ------------------------ |
| DALL-E API (OpenAI)   | T2   | 4,000 chars | `standard` / `hd` | `vivid` / `natural` | Inline only (unreliable) |
| Azure OpenAI (DALL-E) | T4   | 4,000 chars | `standard` / `hd` | `vivid` / `natural` | Inline only (unreliable) |

**These two platforms have identical prompt syntax.** Both use natural language with parameters passed as separate API fields (`size`, `quality`, `style`). Both feature automatic prompt rewriting by GPT-4 that cannot be fully disabled. The rewritten prompt is returned in `revised_prompt`. Only generates 1 image per call with DALL-E 3. Sizes are fixed: `1024x1024`, `1792x1024`, `1024x1792`.

**Override:** Azure uses deployment-based model references and has stricter content filtering. Azure's successor `gpt-image-1` (post March 2026) adds streaming, transparent backgrounds, and multi-image generation — requiring a template branch for the new model.

---

### Group 3: "Stable Diffusion full-control ecosystem" (4 platforms)

| Platform                 | Tier | Token Limit                       | Weighting                       | Neg Prompts               | LoRA                 | ControlNet            |
| ------------------------ | ---- | --------------------------------- | ------------------------------- | ------------------------- | -------------------- | --------------------- |
| Stable Diffusion (local) | T2   | 77/CLIP (chunked) to 512/T5 (SD3) | `(word:1.5)`, `[word]`          | Separate field            | `<lora:name:weight>` | ✅                    |
| ComfyUI                  | T3   | Same as model used                | `(word:1.5)`                    | Separate node             | Via Load LoRA node   | Via nodes             |
| Leonardo AI              | T2   | ~1,000 chars                      | Front-loading emphasis          | Separate field            | "Elements" (up to 4) | Full multi-ControlNet |
| StarryAI (Argo engine)   | T2   | ~350 chars (SD-based)             | Weighted multi-prompts (Altair) | "Remove from image" field | Via underlying SD    | Initial image         |

**Shared template characteristics:** All support the **`(word:1.5)` attention-weight syntax** (or close variants), **separate negative prompt fields**, comma-separated tag-based prompting, and concepts like CFG scale, sampling methods, and steps. The system prompt should generate tag-heavy prompts with quality boosters (e.g., `masterpiece, best quality, detailed`), explicit attention weights on key elements, and comprehensive negative prompts (`worst quality, low quality, blurry, bad anatomy`).

**Key overrides:** ComfyUI's prompt text is identical in syntax, but LoRAs are loaded via separate nodes rather than inline `<lora:>` tags. Leonardo AI calls LoRAs "Elements" with a max of 4 and a combined weight recommendation ≤1.00. Leonardo's ~1,000-character limit is shorter than SD's effective unlimited chunked input. StarryAI's Altair engine uses VQGAN-CLIP with a different weighting system than SD's parentheses syntax, requiring an engine-specific branch.

---

### Group 4: "Stability API / SD enterprise wrappers" (3 platforms)

| Platform                       | Tier | Prompt Format                        | Negative Prompts           | Exposed Controls                       |
| ------------------------------ | ---- | ------------------------------------ | -------------------------- | -------------------------------------- |
| DreamStudio (Stability API v2) | T1   | `prompt` + `negative_prompt` strings | Dedicated field, 10K chars | Aspect ratio, seed, output format only |
| AWS Bedrock (SD3/Ultra/Core)   | T4   | `prompt` + `negative_prompt` strings | Dedicated field, 10K chars | Aspect ratio, seed, output format only |
| Databricks (SD)                | T4   | Custom pyfunc wrapper                | Wrapper-dependent          | Developer-defined                      |

**Shared template characteristics:** These wrap Stable Diffusion models but **strip away all advanced controls** — no CFG scale, steps, sampler, or parentheses weighting for the newer SD3/Ultra/Core models. Prompts should be natural language (not tag-based), since the API doesn't parse SD attention syntax. Negative prompts are supported via dedicated fields. The SDXL variants on Bedrock/DreamStudio do expose `text_prompts` arrays with per-prompt weighting and style presets — requiring a model-version branch.

**Override:** Databricks is fundamentally different — it's not a managed API but a custom ML deployment. The prompt format is whatever the developer's pyfunc wrapper accepts. The system prompt for Databricks should note this dependency and default to standard diffusers-compatible format.

---

### Group 5: "Flux-architecture platforms" (2 platforms)

| Platform             | Tier | Token Limit                              | Negative Prompts                       | Key Feature                                           |
| -------------------- | ---- | ---------------------------------------- | -------------------------------------- | ----------------------------------------------------- |
| Flux (via Replicate) | T2   | 512 tokens (Flux 1); 32K tokens (Flux 2) | ❌ Not supported (except Flux 2 Klein) | Best photorealism and text rendering                  |
| Playground AI (PGv3) | T1   | 8,000 tokens                             | "Exclude from Image" field             | LLM-integrated encoder (Llama3-8B); hex color support |

**Shared template characteristics:** Both use **natural language prose exclusively** — SD-style tags and parentheses weighting are explicitly counterproductive. Word order matters significantly; front-load the subject. Neither supports traditional negative prompts on their primary models. Both excel at text rendering in images. Prompts should read like descriptive paragraphs, not keyword lists.

**Override:** Flux 2's 32K-token capacity and Playground v3's 8K-token capacity dwarf all other platforms. PGv3 uniquely accepts **RGB hex color codes** directly in prompts for brand color control and supports JSON-structured prompting. Playground also hosts SD models alongside PGv3, meaning the platform needs a model-switching branch. Flux's `guidance_scale` defaults to 3.5 (much lower than SD's typical 7).

---

### Group 6: "Video-primary cinematic platforms" (3 platforms)

| Platform  | Tier | Prompt Style                        | Negative Prompts  | Special Syntax                                              |
| --------- | ---- | ----------------------------------- | ----------------- | ----------------------------------------------------------- |
| Runway ML | T3   | Visual/directorial natural language | ❌ Not supported  | `[00:01]` timestamp syntax for sequential events            |
| Luma AI   | T3   | Conversational natural language     | ❌ Discouraged    | `@style` keyword, `loop` keyword                            |
| Kling AI  | T3   | Cinematic natural language          | ✅ Separate field | `Shot 1:`, `Shot 2:` multi-shot; `[Speaker: Name]` dialogue |

**Shared template characteristics:** All three are **video-first platforms** that generate motion, not stills. Prompts should use cinematic language: camera movements ("tracking shot," "dolly-in," "pan-to-reveal"), scene direction, and temporal progression. For image-to-video mode, prompts should describe **motion only** — never re-describe the input image. All favor concise, directive prompts over elaborate descriptions.

**Override:** Kling AI's multi-shot storyboard syntax (`Shot 1:... Shot 2:...`) and dialogue attribution (`[Character A: Name, tone]: "Line"`) are unique. Runway's timestamp brackets (`[00:01]`) enable precise temporal control. Luma AI's `@style` for style references and `loop` keyword are platform-specific. Kling supports negative prompts while Runway and Luma explicitly don't.

---

### Group 7: "Multi-engine aggregator platforms" (3 platforms)

| Platform   | Tier | Models Available                                                                                 | Prompt Adaptation                                    |
| ---------- | ---- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| NightCafe  | T1   | Flux, SD/SDXL, DALL-E 3, Ideogram, Seedream, HiDream, VQGAN+CLIP                                 | Syntax changes per selected engine                   |
| Tensor.Art | T1   | SD 1.5, SDXL, Pony XL, Flux, HunyuanDiT, SD3 + thousands of community checkpoints                | SD-tags for SD models, natural language for Flux/SD3 |
| Freepik AI | T3   | Flux (all variants), Imagen, Nano Banana, Mystic (own), Ideogram, Recraft, Seedream, Runway, GPT | Model-dependent; pipe `\|` for batch variations      |

**Shared template characteristics:** These platforms **don't have a single prompt syntax** — the format depends on which underlying model the user selects. The system prompt needs a model-routing layer: if SD-based model is selected, use Group 3 tag-based syntax; if Flux, use Group 5 prose syntax; if DALL-E, use Group 1 natural language. All three share this "chameleon" behavior.

**Override:** Tensor.Art offers the deepest SD parameter exposure (samplers, VAEs, schedulers, clip skip, LoRAs, ControlNet). NightCafe has the most unique legacy engine (VQGAN+CLIP with `keyword:-1` weight syntax). Freepik has its own proprietary Mystic model family and pipe `|` syntax for batch variations.

---

## The 11 platforms requiring dedicated system prompts

### Midjourney — completely unique parameter ecosystem

Midjourney's prompt system is unlike anything else. **The `::` multi-prompt weighting, `--` parameter flags, permutation braces `{}`, and reference systems (`--sref`, `--cref`, `--oref`) constitute an entire domain-specific language.** No other platform shares this syntax. Key unique elements include `--stylize` (0–1000), `--chaos` (0–100), `--weird` (0–3000), `--raw`, `--tile`, `--stop`, `--mode draft`, personalization profiles (`--p`), style codes (`--sref 211110605`), and permutation prompts (`a {red, green, yellow} bird`). Negative prompts use `--no` (equivalent to `::-0.5` weight). Maximum ~6,000 characters but effective influence drops after ~40 words. **V7 and V8 Alpha have different parameter support than V6** — the template must version-branch. This platform absolutely needs its own dedicated system prompt.

### ComfyUI — node-based workflow requires structural awareness

While ComfyUI's prompt _text_ uses SD-compatible `(word:1.5)` syntax, its **node-based architecture** means prompts exist within a JSON workflow graph, not a single text field. Positive and negative prompts are separate CLIP Text Encode nodes wired to a KSampler. LoRAs are loaded via dedicated nodes, not inline syntax. The system prompt must understand workflow structure, not just prompt text — it needs to know which node types exist, how they connect, and that the "prompt" in API calls is the entire workflow JSON. ComfyUI also supports unique features like prompt comments (`//`, `/* */`), random selection syntax `{option1|option2}`, and per-encoder prompting for SDXL (separate `clip_l` and `clip_g` fields). **Grouped with SD for prompt text, but needs its own template for workflow context.**

### Recraft — design-first with SVG output and text positioning

Recraft's **native SVG vector output** is unique among all 45 platforms. Its style parameter system (`realistic_image/b_and_w`, `vector_illustration/line_art`, etc.) uses a hierarchical style/substyle taxonomy with 25+ options. The **text positioning control** allows specifying exact positions and sizes of text elements via drag-and-drop frames — no other platform offers spatial text layout control. Its "Artistic level" slider inverts the usual paradigm (lower = more prompt adherence). The system prompt must understand design-specific concepts like vector vs. raster output and typographic layout.

### Magnific AI — enhancement-only, not generative

Magnific is fundamentally **not a text-to-image generator** — it's an AI upscaler/enhancer. Prompts are optional guidance for what details the AI should hallucinate during upscaling, not scene descriptions. Its unique **Fractality parameter** amplifies prompt influence at progressively smaller scales. The **Creativity slider** (-10 to 10) controls hallucination intensity. The system prompt must generate enhancement-direction prompts ("enhance fine strokes and painterly textures") rather than scene-generation prompts. This requires a completely different prompt philosophy.

### Topaz Photo AI — not a generative platform at all

Topaz Photo AI is an **AI-powered photo enhancement tool** (denoise, sharpen, upscale, face recovery) that does not accept text prompts for image generation. Its related product **Topaz Bloom** does accept optional prompts for creative upscaling guidance, but this is a separate product. The system prompt must either exclude Topaz entirely or target Bloom's enhancement-guidance format specifically.

### Ideogram — text-in-image specialization with unique syntax

While Ideogram uses natural language, its **quotation mark syntax for text-in-image** (`"Hello World"` embedded in prompts) and its design-focused model understanding (typography, kerning, margins, composition grids) make it distinct enough to warrant its own template. It's the **industry leader for generating readable text in images** — the prompt strategy should emphasize text placement, font style, and casing specifications. Negative prompts are available only to paid users via a separate field. Magic Prompt has three modes (Auto/On/Off) that affect how the model interprets raw input. Maximum ~150–160 words.

### Amazon Titan Image Generator — unique task-type architecture

Titan uses a **task-type JSON structure** (`TEXT_IMAGE`, `INPAINTING`, `OUTPAINTING`, `COLOR_GUIDED_GENERATION`) that's architecturally different from every other platform. Its **512-character prompt limit** is the most restrictive of all 45 platforms. The **text-based mask prompts** (describe what to mask in natural language instead of binary masks) and **color-guided generation** (specify hex color palettes) are unique features. The V2 model's **color palette conditioning** (1–10 hex codes) enables brand-consistent generation that no other platform offers in this way.

### Google Vertex AI (Imagen) — enterprise API with unique features

Vertex AI exposes Imagen 3/4 through a structured API with unique parameters: **LLM-based prompt rewriting** (enabled by default, controllable via `enablePromptRewriting`), **configurable safety filter levels** (4 tiers), **SynthID watermark verification**, and **reference image notation** (`[1]`, `[2]` in prompts to reference uploaded images). Supports 5 aspect ratios and up to 4 images per request. **Imagen 4 offers native 2K resolution.** The prompt rewriting behavior means the system prompt must account for automatic enhancement — similar to DALL-E's rewriting but with different characteristics.

### Nvidia Picasso/Edify — enterprise foundry, not a consumer tool

Nvidia's platform is an **AI Foundry for building custom visual AI applications**, not a prompt-in/image-out service. The primary differentiator is **custom model training on proprietary licensed data** (partnerships with Getty, Shutterstock, Adobe). Access is through NIM microservices hosting various models (Flux, SD, Edify). The system prompt must accommodate the fact that the available models and their parameters are deployment-specific. Multi-modal output (images, video, 3D, 360° HDRi) adds complexity. **75+ language support** for prompts is the broadest of any platform.

### Kaiber — SD-style weighting in a video context

While Kaiber could partially share the SD template, its **SD-style weighting syntax applied to video generation** creates a unique combination. It uses `(word:1.5)` and `(word:0.5)` weighting (range 0.1–2.0) but in the context of animation modes (Flipbook, Motion, Transform). The **Evolution/Wildness slider** controls temporal visual transformation — a video-specific concept with no image-gen equivalent. Music-driven beat synchronization further distinguishes it. It needs its own template that merges SD prompt strategy with video/animation direction.

### Microsoft Designer — design workflow with bracket templates

While Designer uses DALL-E's natural language format, its **bracket-based prompt templates** (`[color]`, `[animal]`, `[style]`) for guided creation, shareable template links, and deep integration with the Microsoft 365 design workflow create a distinct use case. The system prompt should understand template field insertion, design context (social media posts, presentations, marketing materials), and the full design-then-edit workflow.

---

## How negative prompt support shapes grouping

| Support Level                   | Platforms                                                                                                                                                                                        | Template Implication                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| **Dedicated separate field**    | SD local, ComfyUI, Leonardo AI, DreamStudio, AWS Bedrock (all SD), Kling AI, Ideogram (paid), Recraft, StarryAI, Pixlr AI, Craiyon, Amazon Titan (`negativeText`), Vertex AI (`negative_prompt`) | System prompt should generate paired positive + negative prompts                |
| **Inline `--no` flag**          | Midjourney only                                                                                                                                                                                  | Negative concepts appended as `--no item1, item2`                               |
| **Via weight reduction**        | SD family (`[word]` or `(word:0.1)`), Kaiber (`(word:0.1)`)                                                                                                                                      | Alternative to dedicated field for fine-grained control                         |
| **Not supported / discouraged** | DALL-E family, Bing, Google ImageFX, Meta AI, Canva, Firefly, Getty, Shutterstock, Jasper, Flux, Playground v3, Runway, Luma AI, Magnific                                                        | System prompt must use **positive-only phrasing** ("sharp focus" not "no blur") |

This is one of the strongest grouping signals. **Platforms that don't support negative prompts share a fundamental prompt philosophy** — they require affirmative description only. Platforms with dedicated negative prompt fields can share a "dual-prompt" template pattern.

---

## Final grouping recommendation and template count

**Shared group templates: 7** (covering 34 platforms)

- Group 1 "Natural language, no negatives": 9 platforms with per-platform length/style overrides
- Group 2 "DALL-E API": 2 platforms, nearly identical
- Group 3 "SD full control": 4 platforms with LoRA/ControlNet overrides
- Group 4 "SD enterprise wrappers": 3 platforms with model-version branching
- Group 5 "Flux architecture": 2 platforms with token-limit overrides
- Group 6 "Video cinematic": 3 platforms with temporal-syntax overrides
- Group 7 "Multi-engine aggregators": 3 platforms (meta-template that routes to other groups)

**Dedicated templates: 11** (Midjourney, ComfyUI, Recraft, Magnific AI, Topaz Photo AI, Ideogram, Amazon Titan, Google Vertex AI Imagen, Nvidia Picasso, Kaiber, Microsoft Designer)

**Total system prompt templates needed: 18** (7 group + 11 dedicated), down from 45 individual prompts — a **60% reduction** in template maintenance burden. The multi-engine aggregator template (Group 7) further reduces effective complexity by referencing other group templates rather than duplicating logic.

The highest-priority dedicated templates to build first are **Midjourney** (most complex parameter system, most users), **Stable Diffusion** (the Group 3 template serves as foundation for Groups 4 and 7), and **Flux** (rapidly growing adoption, architecturally distinct). The lowest priority are Topaz Photo AI (arguably should be excluded entirely) and Nvidia Picasso (narrow enterprise audience with custom deployments).
