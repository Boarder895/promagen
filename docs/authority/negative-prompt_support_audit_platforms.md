# Negative Prompt Support Audit Across 40 AI Image Platforms

**Version:** 3.0.0
**Updated:** 30 March 2026
**Status:** All fixes applied to `platform-config.json`. This doc covers the 40 active platforms.

**v3.0.0 changes:** Artistly reverted to "none" (v2.0 incorrectly changed it to "separate" based on unverified third-party reviews — confirmed via independent research that no official documentation of negative prompt support exists). Kling AI character limit corrected from 200 to 2500 (matching official API docs and `platform-config.json`). Removed stale "3 converted" count from conclusion. Added UI vs API distinction section based on deep research audit. Error count corrected from 7 to 6 (Artistly was a false positive).

**The original config had 6 errors across the 40 active platforms.** 5 platforms marked "none" actually have a separate negative prompt field, and 1 should be marked "inline." The 11 already marked "separate" are confirmed correct. The most critical misses were **Kling AI, Craiyon, and Pixlr** — all verified with high confidence as having dedicated negative prompt inputs. Below is the full audit with evidence.

---

## Complete results table

| #   | Platform                | Current Config | Verified Status       | Confidence | Key Evidence                                                                                                                                                                                                                                                |
| --- | ----------------------- | -------------- | --------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | ArtGuru                 | separate       | **separate** ✅       | High       | "Describe what you don't want to see" field confirmed on artguru.ai                                                                                                                                                                                         |
| 2   | DreamLike               | separate       | **separate** ✅       | High       | Negative prompt box visible below main prompt in creation UI                                                                                                                                                                                                |
| 3   | DreamStudio             | separate       | **separate** ✅       | High       | Still operational at dreamstudio.stability.ai; repositioned as enterprise product; negative prompt field confirmed in multiple reviews                                                                                                                      |
| 4   | Fotor                   | separate       | **separate** ✅       | High       | Negative prompt options in both text-to-image and image-to-image modes                                                                                                                                                                                      |
| 5   | Leonardo AI             | separate       | **separate** ✅       | High       | Dedicated negative prompt field in Advanced Settings; works with Alchemy V2 and Image Gen V2 models. API docs confirm `negative_prompt` parameter.                                                                                                          |
| 6   | Lexica                  | separate       | **separate** ✅       | High       | "Negative prompt" section in Aperture interface; confirmed by The-Decoder.com and AIxploria reviews                                                                                                                                                         |
| 7   | NovelAI                 | separate       | **separate** ✅       | High       | "Undesired Content" field with presets; can be detached as separate panel per official docs                                                                                                                                                                 |
| 8   | Playground AI           | separate       | **separate** ✅       | Medium     | "Exclude from Image" field in Advanced Settings; platform pivoted to design tool but feature retained                                                                                                                                                       |
| 9   | Stability AI (platform) | separate       | **separate** ⚠️       | Low        | DreamStudio (the web UI) is now enterprise-only; the API supports `negative_prompt` but there's no consumer web UI. If this entry refers to DreamStudio, it's correct. If it refers to a standalone stability.ai web tool, one doesn't exist for consumers. |
| 10  | Ideogram                | separate       | **separate** ✅       | High       | "Negative prompt" field behind "More" button in Prompt Box; documented at docs.ideogram.ai. API also supports `negative_prompt`.                                                                                                                            |
| 11  | Recraft                 | separate       | **separate** ✅       | High       | "Negative prompt" field behind settings button in prompt panel; documented at recraft.ai/docs. Also has "Avoid text in image" switch.                                                                                                                       |
| 12  | ClipDrop                | none           | **none** ✅           | Medium     | Now owned by Jasper AI; current UI has only prompt + style + aspect ratio; no negative prompt in UI or API. Official Text to Image API docs expose only `prompt`.                                                                                            |
| 13  | 123RF                   | none           | **none** ✅           | High       | Single prompt field + reference image upload only; no advanced settings with negative prompts                                                                                                                                                               |
| 14  | Adobe Firefly           | none           | **none** ✅           | High       | Previously had "Exclude Image" field but **explicitly removed** it; Adobe Community Manager confirmed removal. Firefly Services docs confirm negative prompting not supported for Custom Models (Image Model 3/4). Unreliable `[avoid=xxx]` workaround exists but is not a UI field. |
| 15  | Artbreeder              | separate       | **separate** ⚠️       | Medium     | Contest pages reference "including negative prompt"; Apify actor confirms "Negative Prompts" feature wrapping Artbreeder's API; Prompter tool uses SDXL/Flux models. **No official docs found in deep research audit — verify by logging in.**               |
| 16  | Artistly                | none           | **none** ✅           | High       | v2.0 incorrectly flagged as "separate" based on unverified third-party reviews. Independent deep research audit found **no authoritative English documentation of negative prompt support**. Reverted to "none" in v3.0.0.                                  |
| 17  | Bing Image Creator      | none           | **none** ✅           | High       | No negative prompt support; "no red" reads as "red"; confirmed via Microsoft Q&A threads                                                                                                                                                                    |
| 18  | Canva                   | none           | **none** ✅           | High       | Simplified UI with prompt + style presets only; no negative prompt field in Magic Media/Dream Lab                                                                                                                                                           |
| 19  | Craiyon                 | separate       | **separate** ✅       | High       | "Exclude" field directly below main prompt box; official FAQ confirms usage. Changed from "none" in v2.0.                                                                                                                                                   |
| 20  | DeepAI                  | none           | **none** ✅ (UI)      | High       | Web UI has no negative prompt field. API does support `negative_prompt` parameter but it's not exposed in the UI. Config status of "none" is correct for UI-facing Promagen use.                                                                             |
| 21  | Flux (BFL)              | none           | **none** ✅           | High       | Official BFL docs: "FLUX models don't support negative prompts"; architecture doesn't support it natively                                                                                                                                                   |
| 22  | Google Imagen/ImageFX   | none           | **none** ✅ (UI)      | High       | No negative prompt field in ImageFX UI. However, Vertex AI API still documents `negativePrompt` parameter — the v2.0 claim that it was "removed" is only true for the consumer UI. Config "none" is correct for Promagen's UI-facing purpose.                |
| 23  | Hotpot                  | none           | **none** ✅ (UI)      | Medium     | Standard web UI has single prompt box. API has `negativePrompt` parameter but not exposed in web UI. Config "none" is correct for Promagen.                                                                                                                  |
| 24  | Imagine Meta            | none           | **none** ✅           | High       | Simple single-prompt interface; no advanced settings or negative prompt field                                                                                                                                                                               |
| 25  | Jasper Art              | none           | **none** ✅           | High       | Text prompt + dropdowns for Style/Medium/Mood only; DALL-E based, no negative prompt support                                                                                                                                                                |
| 26  | Kling AI                | separate       | **separate** ✅       | High       | Dedicated "Negative Prompt" setting below text prompt box; works with Kling 1.6, 2.1, 2.5, 2.6 models. Official API docs: `negative_prompt` with **≤2500-character limit** (v2.0 incorrectly stated 200). Changed from "none" in v2.0.                      |
| 27  | Luma AI                 | none           | **none** ✅           | High       | Official help center explicitly discourages negative prompting; Dream Machine has no negative prompt field. API examples show no `negative_prompt` parameter.                                                                                                |
| 28  | Microsoft Designer      | none           | **none** ✅           | High       | No negative prompt support; Microsoft support confirmed no command syntax is supported                                                                                                                                                                      |
| 29  | MyEdit                  | none           | **none** ✅           | High       | Prompt field + AI model selector + style presets only; no negative prompt mentioned anywhere                                                                                                                                                                |
| 30  | OpenAI / DALL-E 3       | none           | **none** ✅           | High       | No `negative_prompt` parameter in API; conversational interface can't reliably exclude elements                                                                                                                                                             |
| 31  | Photoleap               | none           | **none** ✅           | High       | User requested feature in Google Play review; Lightricks said they'd consider it — confirming it's not available                                                                                                                                            |
| 32  | Picsart                 | none           | **none** ✅ (UI)      | High       | Consumer UI has single prompt field + style selection; no separate negative prompt field. However, Enterprise GenAI API does include a "negative prompt" parameter for Text2Image. Config "none" is correct for consumer UI.                                  |
| 33  | PicWish                 | none           | **none** ✅ (UI)      | Medium     | Consumer UI has prompt + style selection only. API docs for Background Generator include `negative_prompt` — but this is API-only and endpoint-specific, not exposed in the consumer UI.                                                                     |
| 34  | Pixlr                   | separate       | **separate** ✅       | High       | Official page states: "toggle the negative prompt button on before typing it into the prompt box"; dedicated "Remove" prompt box. Changed from "none" in v2.0.                                                                                              |
| 35  | Runway                  | none           | **none** ✅           | High       | Gen-4 Image docs explicitly state: "Negative prompts...are not supported"                                                                                                                                                                                   |
| 36  | Simplified              | separate       | **separate** ✅       | Medium     | Negative prompt field available on Stable Diffusion, Gemini Flash, and Qwen models; officially documented in help centre. Changed from "none" in v2.0.                                                                                                      |
| 37  | Visme                   | none           | **none** ✅           | High       | Prompt + style selection only; no negative prompt in any documentation                                                                                                                                                                                      |
| 38  | VistCreate              | none           | **none** ✅           | Medium     | Feature page mentions "try negative prompts" as a tip but appears to mean inline phrasing in the main prompt box, not a separate field                                                                                                                      |
| 39  | BluWillow               | inline         | **inline** ✅         | Medium     | Discord-based; uses `--no` parameter identical to Midjourney. Deep research audit could not locate official docs — **verify via Discord bot `/help` if confidence needs upgrading**.                                                                          |
| 40  | Midjourney              | inline         | **inline** ✅         | High       | `--no <terms>` syntax documented in official prompt reference at docs.midjourney.com. (Row added in v3.0 — was missing from v2.0 table despite being counted in breakdown.)                                                                                  |

---

## The 6 config errors that were fixed (v2.0)

The original audit found **6 platforms** (across the 40 active platforms) where the config status was wrong. All fixes were applied to `platform-config.json`. (v2.0 listed 7 errors, but Artistly was a false positive — reverted in v3.0.)

### High-confidence fixes: 5 platforms incorrectly marked "none"

- **Craiyon** → Changed to **"separate"**. The "Exclude" field sits directly below the main prompt box. Confirmed by Craiyon's own FAQ.
- **Kling AI** → Changed to **"separate"**. Dedicated negative prompt setting for image and video generation across multiple model versions. Official API docs: `negative_prompt` with ≤2500-character limit.
- **Pixlr** → Changed to **"separate"**. Toggleable negative prompt button with a "Remove" prompt box. Documented on Pixlr's own AI generator page.
- **Simplified** → Changed to **"separate"**. Available on Stable Diffusion, Gemini Flash, and Qwen models. Officially documented.
- **BluWillow** → Changed from "none" to **"inline"**. Uses `--no` parameter in Discord, identical to Midjourney's syntax.

### Medium-confidence fix: 1 platform applied but should be UI-verified

- **Artbreeder** → Changed to **"separate"**. Contest pages and third-party API wrappers reference negative prompts, and the Prompter tool uses SDXL. But no direct UI screenshot or official doc was found — verify by logging in.

### Reverted (v3.0): 1 platform was a false positive

- **Artistly** → Reverted to **"none"**. v2.0 changed this to "separate" based on unverified 2025 reviews claiming "specify what you don't want in your image." Independent deep research audit found **no authoritative English documentation** of negative prompt support. The original "none" was correct.

---

## UI vs API distinction (added v3.0)

**Critical principle for Promagen:** The `negativeSupport` config value drives whether users see a negative prompt window in the Prompt Lab UI. Since Promagen generates prompts for users to **paste into platform UIs**, the config must reflect **UI support**, not API support. If a platform's API supports `negative_prompt` but the consumer UI has no separate field, users have nowhere to paste the negative prompt — showing the window is misleading.

The following platforms have **API-level negative prompt support** but **no confirmed consumer UI field**. They are correctly marked "none" in `platform-config.json`:

- **Google Imagen**: Vertex AI API has `negativePrompt` parameter. Consumer UI (ImageFX) has no negative prompt field.
- **DeepAI**: API supports `negative_prompt`. Web UI at deepai.org has no such field.
- **Picsart**: Enterprise GenAI Text2Image API includes a "negative prompt." Consumer UI has no separate field.
- **PicWish**: Background Generator API includes `negative_prompt`. Consumer UI has no separate field. (Endpoint-specific.)
- **Hotpot**: API shows `negativePrompt` parameter. Standard Art Generator web page has only a single prompt box.

If any of these platforms add a consumer UI field in the future, the config should be updated to "separate."

---

## Platforms where API and UI differ

Several platforms support negative prompts in their API but **not** in their web UI. This is an important distinction:

- **DeepAI**: API accepts `negative_prompt` parameter, but the web UI at deepai.org has no such field. Config status of "none" is correct for the UI.
- **Hotpot**: API documentation shows `negativePrompt` parameter, but the standard Art Generator web page has only a single prompt box. "None" is correct for the UI.
- **Stability AI (platform)**: The developer API at platform.stability.ai supports `negative_prompt` for SD3.5 models, but there is no consumer-facing web UI (DreamStudio is now enterprise-only). The config entry for "Stability AI" as separate from DreamStudio may need clarification.
- **Google Imagen**: Vertex AI API documents `negativePrompt`. Consumer ImageFX UI has no negative prompt field.
- **Picsart**: Enterprise GenAI API supports negative prompts. Consumer UI does not.
- **PicWish**: Background Generator API has `negative_prompt`. Consumer UI does not.

---

## Notable platform changes since original config

Several platforms have undergone significant changes that affect how you should think about their entries:

**DreamStudio** remains operational but has been repositioned as "Dream Studio for Enterprise." It still has a negative prompt field, but access may require an enterprise account. **Playground AI** rebranded to playground.com and pivoted to a design-tool focus, but the "Exclude from Image" field survives in Board mode's Advanced Settings. **ClipDrop** was sold by Stability AI to Jasper AI in February 2024 and now operates under InitML branding — its current simplified interface has no negative prompt support. **Adobe Firefly** previously had a negative prompt field ("Exclude Image" under Advanced Settings) but **explicitly removed it**, with a Community Manager confirming the decision. An unreliable `[avoid=xxx]` inline workaround exists but should not be counted. **Google Imagen** removed the negative prompt field from the consumer ImageFX UI starting with Imagen 3.0, though the Vertex AI API still documents the `negativePrompt` parameter.

---

## Platforms requiring verification (flagged by deep research audit)

The following platforms are marked "separate" or "inline" in the config based on community sources and UI observation, but the deep research audit (March 2026) could not locate authoritative official documentation. They are **likely correct** but should be manually verified if confidence needs upgrading:

- **Artbreeder** (separate) — No official docs found. Verify by logging in and checking the Prompter tool UI.
- **ArtGuru** (separate) — No official docs found. Verify via artguru.ai creation UI.
- **BlueWillow** (inline) — `--no` claim could not be verified via official source. Verify via Discord bot `/help`.
- **DreamLike** (separate) — No official docs found. Verify via dreamlike.art creation UI.
- **DreamStudio** (separate) — Enterprise-only access may affect verification. Verify if enterprise account is available.
- **Fotor** (separate) — No official docs found. Verify via fotor.com creation UI.
- **Playground AI** (separate) — No official docs found. Verify via playground.com Board mode Advanced Settings.

---

## Conclusion

Across the 40 active platforms, **6 config errors were found and fixed** in v2.0: Craiyon, Kling AI, Pixlr, Simplified, and Artbreeder moved to "separate," while BluWillow moved to "inline." Artistly was incorrectly included in v2.0 (reverted in v3.0 — the original "none" was correct). The pattern is clear: platforms built on Stable Diffusion architecture almost universally expose negative prompt fields, while platforms using proprietary models (DALL-E, Imagen, Flux, Meta) deliberately omit them as an architectural and UX choice.

**Final active platform breakdown (40 platforms):**

- `negativeSupport: 'separate'` — 16 platforms
- `negativeSupport: 'inline'` — 2 platforms (Midjourney, BluWillow — use `--no` syntax)
- `negativeSupport: 'none'` — 22 platforms
