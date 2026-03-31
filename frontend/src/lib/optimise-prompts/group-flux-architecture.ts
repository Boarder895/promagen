// src/lib/optimise-prompts/group-flux-architecture.ts
// ============================================================================
// GROUP BUILDER: Flux Architecture — T5-XXL encoder, prose-only
// ============================================================================
// Covers 1 platform currently: flux (Black Forest Labs, via Replicate/ComfyUI).
//
// Platforms: flux
//
// Architecture knowledge:
//   - Uses T5-XXL text encoder (NOT CLIP) — understands full sentences,
//     grammar, and complex descriptions far better than tag-based encoders
//   - SD-style tags and parenthetical weights are COUNTERPRODUCTIVE —
//     T5 reads them as literal text, not emphasis markers
//   - Word order = emphasis: first noun phrase = primary subject
//   - No negative prompt support on Flux 1 models (Dev, Schnell, Pro)
//   - Flux 2 Klein has limited negative support — but assume none for safety
//   - 512 tokens (Flux 1) / 32K tokens (Flux 2) context window
//   - guidance_scale defaults to 3.5 (vs SD's 7) — model follows prompt
//     more faithfully, so precision matters more than emphasis tricks
//   - Best-in-class photorealism and text rendering in images
//   - Concrete descriptive prose > abstract modifiers
//   - Colour described naturally ("purple-and-copper twilight sky") works
//     better than colour lists
//
// v1 (26 Mar 2026): Initial build.
//
// Authority: grouping-45-image-platforms-by-prompt-compatibility.md §Group 5
// Existing features preserved: Yes (new file).
// ============================================================================

import type { OptimiseProviderContext, GroupPromptResult } from './types';
import type { ComplianceResult } from '@/lib/harmony-compliance';

// ============================================================================
// COMPLIANCE: Strip syntax T5-XXL reads literally + enforce platform limit (v4)
// ============================================================================

const DANGLING_END_WORDS =
  /\b(?:and|or|with|without|behind|before|after|over|under|through|into|onto|from|to|of|in|on|at|as|while|amid|beneath)\b$/i;

function cleanText(text: string): string {
  return text.replace(/\s{2,}/g, ' ').replace(/^[,\s]+|[,\s]+$/g, '').trim();
}

function pruneDangling(text: string): string {
  let out = cleanText(text);
  let guard = 0;
  while (DANGLING_END_WORDS.test(out) && guard < 3) {
    out = out.replace(DANGLING_END_WORDS, '').trim();
    out = cleanText(out);
    guard += 1;
  }
  return out;
}

function hardTrimAtComma(text: string, ceiling: number): string {
  if (text.length <= ceiling) return text;
  const slice = text.slice(0, ceiling + 1);
  const lastComma = slice.lastIndexOf(',');
  const lastSemicolon = slice.lastIndexOf(';');
  const lastPeriod = slice.lastIndexOf('.');
  const best = Math.max(lastComma, lastSemicolon, lastPeriod);
  const floorPos = Math.floor(ceiling * 0.6);
  if (best > floorPos) return pruneDangling(slice.slice(0, best));
  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace > floorPos) return pruneDangling(slice.slice(0, lastSpace));
  return pruneDangling(text.slice(0, ceiling));
}

/**
 * Flux compliance gate factory (v4 pattern).
 * T5-XXL reads weight syntax and flags as literal text — must strip.
 * Negative phrasing: soft warning only (was destructive regex in v3).
 * Enforces maxChars only — does NOT trim to idealMax.
 */
function createFluxCompliance(
  idealMin: number,
  idealMax: number,
  hardCeiling: number,
): (text: string) => ComplianceResult {
  return function enforceFluxCleanup(text: string): ComplianceResult {
    const fixes: string[] = [];
    let cleaned = text;

    // Strip parenthetical weights: (term:1.3) → term
    const parenBefore = cleaned;
    cleaned = cleaned.replace(/\(([^()]+):\d+\.?\d*\)/g, '$1');
    if (cleaned !== parenBefore) fixes.push('Stripped parenthetical weight syntax (T5 reads as literal text)');

    // Strip double-colon weights: term::1.3 → term
    const dcBefore = cleaned;
    cleaned = cleaned.replace(/(\w[\w\s-]*)::\d+\.?\d*/g, '$1');
    if (cleaned !== dcBefore) fixes.push('Stripped double-colon weight syntax');

    // Strip MJ parameter flags — T5 would render these as text in the image
    const flagBefore = cleaned;
    cleaned = cleaned.replace(/\s*--(?:ar|v|s|no|stylize|chaos|weird|tile|repeat|seed|stop|iw|niji|raw)\s*[^\s,]*/gi, '');
    if (cleaned !== flagBefore) fixes.push('Stripped parameter flags (would appear as text in image)');

    // Strip CLIP quality tokens — T5 doesn't benefit from these
    const clipTokens = ['masterpiece', 'best quality', 'highly detailed', '8K', '4K', 'intricate textures', 'sharp focus'];
    for (const token of clipTokens) {
      const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b,?\\s*`, 'gi');
      const before = cleaned;
      cleaned = cleaned.replace(re, '');
      if (cleaned !== before) fixes.push(`Stripped CLIP token "${token}" (meaningless to T5 encoder)`);
    }

    // Strip SD-style quality boosters that T5 reads literally
    const sdTokens = ['worst quality', 'low quality', 'normal quality', 'bad anatomy', 'bad hands'];
    for (const token of sdTokens) {
      const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b,?\\s*`, 'gi');
      const before = cleaned;
      cleaned = cleaned.replace(re, '');
      if (cleaned !== before) fixes.push(`Stripped SD negative token "${token}"`);
    }

    cleaned = cleanText(cleaned);

    // Soft warning: negative phrasing (negativeSupport: none)
    // v4 change: was destructive regex that mangled prompts.
    // Now detection + warning only. System prompt already instructs
    // GPT to use affirmative language.
    if (/\b(?:without|no|avoid|exclude|not)\s+\w/i.test(cleaned)) {
      fixes.push('Contains negative phrasing — Flux does not support negatives and T5 may render excluded words as text');
    }

    // Enforce maxChars only (v4 pattern)
    if (cleaned.length > hardCeiling) {
      const before = cleaned.length;
      cleaned = hardTrimAtComma(cleaned, hardCeiling);
      fixes.push(`Trimmed to platform limit (${before} -> ${cleaned.length}/${hardCeiling})`);
    } else if (cleaned.length > idealMax) {
      fixes.push(`Above ideal range (${cleaned.length}/${idealMax} chars) — platform limit is ${hardCeiling}`);
    }

    // Diagnostics
    if (cleaned.length > 0 && cleaned.length < idealMin) {
      fixes.push(`Below ideal minimum (${cleaned.length}/${idealMin} chars)`);
    } else if (cleaned.length >= idealMin && cleaned.length <= idealMax) {
      fixes.push(`Good density for Flux (${cleaned.length} chars)`);
    }

    return { text: cleaned, wasFixed: fixes.length > 0, fixes };
  };
}

// ============================================================================
// BUILDER
// ============================================================================

export function buildFluxArchitecturePrompt(
  _providerId: string,
  ctx: OptimiseProviderContext,
): GroupPromptResult {
  const platformNote = ctx.groupKnowledge ?? '';
  const idealMin = ctx.idealMin || 300;
  const idealMax = ctx.idealMax || 500;
  const hardCeiling = ctx.maxChars ?? 2000;

  const systemPrompt = `You are an expert prompt optimiser for Flux (Black Forest Labs). You are optimising for "${ctx.name}".

CRITICAL ARCHITECTURE — T5-XXL ENCODER (NOT CLIP):
Flux uses the T5-XXL text encoder. This is fundamentally different from Stable Diffusion's CLIP encoder. T5-XXL reads your prompt like a language model reads a paragraph — it understands grammar, sentence structure, spatial relationships, and descriptive prose. This means:
- Full sentences produce BETTER results than comma-separated tags
- Parenthetical weights (word:1.3) are read as LITERAL TEXT and may appear in the image
- Parameter flags (--ar, --v) are read as LITERAL TEXT and will corrupt the output
- Word order determines emphasis: the first noun phrase = the primary subject
- T5 understands adjective-noun binding: "enormous storm waves" is one concept, not three separate tags
- Complex spatial descriptions ("a village glows with warm windows beneath dark cliffs") work perfectly

PROMPT PHILOSOPHY — DESCRIPTIVE PROSE, NOT TAGS:
Write as if describing a photograph or painting to someone who will recreate it. Every sentence should contain connected visual information, not isolated keywords. The more naturally the prompt reads as English, the better Flux interprets it.

PROMPT STRUCTURE — RICH VISUAL PARAGRAPH:
Write a single flowing paragraph (3–5 sentences) that builds the scene layer by layer:
- Sentence 1: Subject + primary action + immediate setting (WHO, WHAT, WHERE)
- Sentence 2: Physical environment + weather/atmosphere + key interaction
- Sentence 3: Lighting + colour palette woven into the scene description
- Sentence 4: Background details + depth + secondary points of interest
- Optional Sentence 5: Photographic/artistic style direction

WHAT NOT TO INCLUDE:
- No weight syntax — (word:1.3) appears as literal text in the image
- No parameter flags — --ar, --v, --s will appear as text artifacts
- No negative prompts — Flux 1 models don't support them; describe what IS, not what ISN'T
- No CLIP quality tokens — "masterpiece", "best quality", "8K" are meaningless to T5
- No SD negative tokens — "worst quality", "bad anatomy" are meaningless to T5
- No keyword lists — T5 treats comma-separated tags as a broken sentence

PLATFORM-SPECIFIC:
- Sweet spot: ${idealMin}–${idealMax} characters (Flux handles up to 512 tokens / ~2000 chars, but focused descriptions produce the sharpest results)
- Flux's guidance_scale is 3.5 (vs SD's 7) — the model follows your prompt more faithfully, so PRECISION matters more than emphasis tricks
- Flux excels at photorealism — describe textures, materials, light behaviour specifically
- Flux can render text in images — if text is part of the scene, put it in quotes
- Front-load the primary subject in the first 10 words${platformNote ? `\n- ${platformNote}` : ''}

OPTIMISATION RULES:
1. STRIP ALL SYNTAX: Remove every (term:weight), term::weight, --ar, --v, --s, --no, and any CLIP/SD tokens. Convert to pure flowing prose.
2. FRONT-LOAD SUBJECT: Primary subject in the first 10 words. T5 gives strongest attention to the opening.
3. SENTENCE-LEVEL COMPOSITION: Each sentence should describe a visual layer — foreground, then environment, then lighting, then background. T5 preserves this spatial structure.
4. CONCRETE OVER ABSTRACT: "Pale gold beam of light cutting through sheets of grey rain" not "dramatic lighting effects." Flux's photorealistic engine renders specific descriptions faithfully.
5. COLOUR AS NATURAL DESCRIPTION: Weave colours into the scene naturally — "purple-and-copper twilight sky" not "purple, copper, sky." T5 understands compound adjective phrases.
6. TEXTURE AND MATERIAL: Flux excels at rendering physical materials. Include surface descriptions: "rain-slicked iron railing", "weathered stone", "wet wooden deck."
7. SWEET SPOT: ${idealMin}–${idealMax} characters. Flux benefits from detail — do NOT compress. A 450-character prompt with full visual information always outperforms a 200-character summary.
8. PRESERVE INTENT: Never remove the subject, core mood, or defining visual elements.
9. ALWAYS ENRICH — CROSS-REFERENCE THE ORIGINAL. The input may have lost details during assembly. The SCENE DESCRIPTION or ORIGINAL USER DESCRIPTION contains the full visual intent. Restore every colour, noun, texture, and drama detail the input dropped. Returning a simplified version is NEVER acceptable.
10. TEXTURE MINIMUM: Include at least 3 material/texture descriptions. Flux's photorealistic engine renders physical surfaces better than any other platform. Use specific tactile language: "rain-slicked iron railing", "salt-crusted weathered stone", "wet timber deck planks", "barnacle-covered rocks", "spray-misted glass". Generic surfaces ("the railing", "the rocks") waste Flux's rendering precision.
11. NO NEGATIVE LANGUAGE: Flux does NOT support negative prompts. If the input contains "without X", "no X", or "avoid X", REMOVE the phrase entirely or convert to an affirmative equivalent. "without blur" → "tack-sharp detail". "no watermark" → remove. "avoid modern buildings" → remove. Never write what ISN'T in the scene — T5-XXL may render excluded words as literal text.

BEFORE → AFTER EXAMPLES:

Example 1 — CLIP tags converted to Flux prose:
BEFORE: masterpiece, best quality, (weathered lighthouse keeper:1.4), (storm waves:1.3), jagged rocks, salt spray, (lighthouse beam:1.2), purple copper sky, fishing village, dark cliffs, 8K, sharp focus
AFTER: A weathered lighthouse keeper grips a rain-slicked iron railing on the gallery deck of a coastal lighthouse at twilight, bracing against wind as enormous storm waves explode against jagged rocks far below. Salt spray catches the fading light as it rises into a sky streaked with purple and copper, while the lighthouse beam sweeps a pale gold arc through dense sheets of driving rain. In the distance beyond the dark cliffs, a small fishing village glows with tiny warm orange windows, the only warmth in the storm-darkened landscape. Photorealistic coastal photography with rich atmospheric depth.
WHY: Stripped all weight syntax and CLIP tokens. Converted keyword fragments into connected sentences with texture ("rain-slicked iron railing"), spatial depth (foreground keeper → midground rocks → background village), and natural colour descriptions. T5 reads this as a coherent scene, not a tag list.

Example 2 — Abstract prompt made concrete for Flux:
BEFORE: beautiful fantasy castle at sunset with dramatic lighting and magical atmosphere, trending on artstation
AFTER: A towering grey stone castle rises from the edge of a forested cliff at golden sunset, its weathered spires and buttresses catching warm amber light against a deepening violet sky. Mist drifts through the valley below the cliff face while warm lantern light spills from dozens of arched windows across the castle's facade. A flock of dark birds wheels above the highest tower, and the forest canopy below glows copper and green in the last light. Detailed fantasy illustration with painterly lighting and atmospheric perspective.
WHY: "Beautiful" → specific visual details (grey stone, weathered spires). "Dramatic lighting" → amber light, deepening violet sky, warm lantern glow. "Magical atmosphere" → mist, birds, copper-green canopy. Every abstract modifier replaced with a concrete, renderable description that T5 interprets precisely.

Return ONLY valid JSON:
{
  "optimised": "the optimised Flux prompt — flowing prose, rich texture, no syntax, every visual detail anchored",
  "negative": "",
  "changes": ["Stripped CLIP weight syntax", "Converted tags to flowing prose with texture and depth", ...],
  "charCount": 420,
  "tokenEstimate": 90
}`;
  return {
    systemPrompt,
    // v4 pattern: gate enforces maxChars (2000), NOT idealMax (500).
    // Destructive negative stripping replaced with soft warning.
    groupCompliance: createFluxCompliance(idealMin, idealMax, hardCeiling),
  };
}
