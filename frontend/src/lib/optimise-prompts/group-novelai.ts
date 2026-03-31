// src/lib/optimise-prompts/group-novelai.ts
// ============================================================================
// GROUP BUILDER: NovelAI Dedicated — anime SD with {{{term}}} weighting
// ============================================================================
// Covers 1 platform: novelai
//
// Architecture knowledge:
//   - Anime-optimised Stable Diffusion (CLIP-based encoder)
//   - Uses UNIQUE triple-brace weighting: {{{term}}} = strongest emphasis,
//     {{term}} = strong, {term} = moderate. NOT parenthetical (word:1.3)
//   - Tag-based prompting — comma-separated keywords, NOT prose
//   - Separate negative prompt field — comprehensive negatives required
//   - Quality prefix: {{{masterpiece}}}, {{best quality}}, {{highly detailed}}
//   - 77 token CLIP limit per chunk (same as SD)
//   - Optimised for anime/illustration styles — photorealism is secondary
//   - Danbooru-style tag vocabulary produces best results
//   - Subject tags first, then scene, then quality, then style
//
// v1 (26 Mar 2026): Initial build.
// v2 (26 Mar 2026): Dynamic Negative Intelligence. Scene-specific failure-mode
//   negatives replace boilerplate. Quality + anatomy floors capped.
//
// Authority: grouping-45-image-platforms-by-prompt-compatibility.md §Dedicated
// Existing features preserved: Yes (new file).
// ============================================================================

import type { OptimiseProviderContext, GroupPromptResult } from './types';
import type { ComplianceResult } from '@/lib/harmony-compliance';

// ============================================================================
// COMPLIANCE: Convert any non-NovelAI syntax to triple-brace
// ============================================================================

function enforceNovelAiSyntax(text: string): ComplianceResult {
  const fixes: string[] = [];
  let cleaned = text;

  // Convert parenthetical weights to triple-brace approximation
  // (term:1.4+) → {{{term}}}, (term:1.2-1.3) → {{term}}, (term:1.0-1.1) → {term}
  const parenBefore = cleaned;
  cleaned = cleaned.replace(/\(([^()]+):(\d+\.?\d*)\)/g, (_match, term, weight) => {
    const w = parseFloat(weight);
    if (w >= 1.4) return `{{{${term.trim()}}}}`;
    if (w >= 1.2) return `{{${term.trim()}}}`;
    if (w >= 1.0) return `{${term.trim()}}`;
    return term.trim();
  });
  if (cleaned !== parenBefore) fixes.push('Converted parenthetical weights to NovelAI triple-brace syntax');

  // Strip double-colon weights: term::1.3 → {{term}}
  const dcBefore = cleaned;
  cleaned = cleaned.replace(/(\w[\w\s-]*)::\d+\.?\d*/g, '{{$1}}');
  if (cleaned !== dcBefore) fixes.push('Converted double-colon weights to NovelAI brace syntax');

  // Strip MJ parameter flags
  const flagBefore = cleaned;
  cleaned = cleaned.replace(/\s*--(?:ar|v|s|no|stylize|chaos|weird|tile|repeat|seed|stop|iw|niji|raw)\s*[^\s,]*/gi, '');
  if (cleaned !== flagBefore) fixes.push('Stripped parameter flags');

  // Clean up double spaces and leading/trailing commas
  cleaned = cleaned.replace(/\s{2,}/g, ' ').replace(/^[,\s]+|[,\s]+$/g, '').trim();

  return { text: cleaned, wasFixed: fixes.length > 0, fixes };
}

// ============================================================================
// BUILDER
// ============================================================================

export function buildNovelAiPrompt(
  _providerId: string,
  ctx: OptimiseProviderContext,
): GroupPromptResult {
  const platformNote = ctx.groupKnowledge ?? '';
  const hardCeiling = ctx.maxChars ?? 1000;

  const systemPrompt = `You are an expert prompt optimiser for NovelAI Image Generation. You are optimising for "${ctx.name}".

CRITICAL ARCHITECTURE — ANIME-OPTIMISED STABLE DIFFUSION:
NovelAI uses a custom anime-optimised Stable Diffusion model with a CLIP-based encoder. It uses a UNIQUE weighting system that is different from standard SD:
- {{{term}}} = strongest emphasis (≈ weight 1.4+)
- {{term}} = strong emphasis (≈ weight 1.2–1.3)
- {term} = moderate emphasis (≈ weight 1.1)
- No braces = normal weight
Do NOT use parenthetical weights (word:1.3) — NovelAI ignores them.
Do NOT use double-colon weights (word::1.3) — wrong platform.

PROMPT FORMAT — TAG-BASED, NOT PROSE:
NovelAI works best with comma-separated tags in a specific order, similar to Danbooru-style tagging:
1. Quality prefix: {{{masterpiece}}}, {{best quality}}, {{highly detailed}}
2. Subject tags: character description, clothing, pose, expression
3. Scene tags: environment, weather, time of day
4. Style tags: art style, medium, rendering approach
5. Composition tags: camera angle, framing, depth of field

WEIGHTING STRATEGY:
- Use {{{triple braces}}} for the 2–3 most important visual elements (subject, key action)
- Use {{double braces}} for 3–5 important supporting elements
- Use {single braces} sparingly for moderate emphasis
- Leave quality/composition tags unweighted
- Maximum 8 weighted terms total — more dilutes the emphasis

NEGATIVE PROMPT — DYNAMIC NEGATIVE INTELLIGENCE:
NovelAI supports a separate negative prompt field. Do NOT use boilerplate negatives. Instead, ANALYSE the positive prompt and generate negatives targeting the specific failure modes for THIS scene.

FAILURE-MODE ANALYSIS (apply ALL that match):
1. MOOD INVERSION: If stormy/dramatic → "calm, peaceful, sunny, clear sky". If serene → "chaos, destruction, fire".
2. ERA CONTAMINATION: If historical/period → "modern buildings, contemporary clothing, cars, power lines". If futuristic → "medieval, rustic, old-fashioned".
3. SUBJECT CORRUPTION: If solitary figure → "crowd, extra people, group, duplicate figure". If group → "empty, deserted, lonely".
4. COLOUR DRIFT: If palette is warm (copper/gold/orange) → "cool blue tones, green cast, grey monotone". If cool palette → "warm orange cast, sepia".
5. ATMOSPHERE COLLAPSE: If dramatic/moody → "flat lighting, mundane, overexposed, boring composition". If bright/cheerful → "dark, gloomy, ominous".
6. SCALE DISTORTION: If grand/epic → "miniature, tiny, close-up, claustrophobic". If intimate → "wide establishing shot, distant, aerial".
7. MEDIUM MISMATCH: If anime/illustration → "photographic, 3d render, stock photo". If photorealistic → "cartoon, anime, sketch".

QUALITY FLOOR (maximum 5 generic): worst quality, low quality, normal quality, lowres, jpeg artifacts
ANATOMY FLOOR (maximum 4 generic): bad anatomy, bad hands, missing fingers, extra digit
The rest MUST be scene-specific from the failure-mode analysis above. Minimum 4 scene-specific terms.
Total negative: 12–18 terms.

PLATFORM-SPECIFIC:

LENGTH RULES:
HARD: Do not shorten any prompt that is below ${hardCeiling} characters.
SOFT: You may lengthen the prompt up to ${hardCeiling} characters, but only if the added content is a genuine visual anchor — not filler.
Your job is to produce the best possible prompt for this platform. Length is not a goal. Anchor preservation is.
- 77 token CLIP limit per chunk — keep weighted terms concise
- Anime/illustration style is the strength — lean into it
- Danbooru tag vocabulary produces the best results
- Front-load quality prefix, then subject, then scene${platformNote ? `\n- ${platformNote}` : ''}

OPTIMISATION RULES:
1. QUALITY PREFIX: Always start with {{{masterpiece}}}, {{best quality}}, {{highly detailed}}.
2. TAG FORMAT: Comma-separated tags, NOT flowing sentences. "stormy twilight sky" not "The sky is stormy at twilight."
3. TRIPLE-BRACE WEIGHTING: Use {{{ }}} for the subject and 1–2 key elements. Use {{ }} for 3–5 supporting elements. Maximum 8 weighted terms.
4. CONCRETE TAGS: "weathered lighthouse keeper" not "old man". "jagged coastal rocks" not "rocks". Specific tags → better CLIP matching.
5. COLOUR AS TAGS: "purple sky, copper highlights" as separate tags, not compound phrases.
6. DYNAMIC NEGATIVE: Generate a negative prompt using the DYNAMIC NEGATIVE INTELLIGENCE section above. Quality floor + anatomy floor + scene-specific failure-mode terms. No boilerplate.
7. PRESERVE INTENT: Keep every visual element from the original. Convert prose to tags but never drop details.
8. ALWAYS ENRICH: Cross-reference the original scene description. Restore any colours, nouns, or details the input lost.

BEFORE → AFTER EXAMPLES:

Example 1 — Prose converted to NovelAI tags:
BEFORE: A weathered lighthouse keeper stands on a rain-soaked gallery deck at twilight, gripping the iron railing as enormous storm waves crash against jagged rocks below, salt spray rising into a purple and copper sky.
AFTER positive: {{{masterpiece}}}, {{best quality}}, {{highly detailed}}, {{{weathered lighthouse keeper}}}, {{iron railing}}, rain-soaked gallery deck, twilight, {{enormous storm waves}}, {{jagged rocks}}, salt spray, {{lighthouse beam}}, pale gold light, purple sky, copper sky, driving rain, distant fishing village, warm orange windows, dark cliffs, dramatic atmosphere, low angle, cinematic composition
AFTER negative: worst quality, low quality, normal quality, lowres, bad anatomy, bad hands, missing fingers, extra digit, calm sea, daytime, clear sky, sunny weather, modern buildings, contemporary clothing, extra people, flat lighting, overexposed, dry ground
WHY: Converted flowing prose to tag format. Applied triple-brace to subject (lighthouse keeper). Double-brace on key visual elements (railing, waves, rocks, beam). Quality prefix first.
WHY THESE NEGATIVES: Quality floor (4) + anatomy floor (4). Mood inversion: "calm sea, daytime, clear sky, sunny weather" — scene is stormy twilight. Era contamination: "modern buildings, contemporary clothing" — scene is traditional coastal. Subject corruption: "extra people" — keeper is solitary. Atmosphere collapse: "flat lighting, overexposed" — scene is dramatic low-light.

Return ONLY valid JSON:
{
  "optimised": "the optimised NovelAI positive prompt — tag format with brace weighting",
  "negative": "scene-specific negative prompt using Dynamic Negative Intelligence",
  "changes": ["Converted prose to tag format", "Applied NovelAI brace weighting", ...],
  "charCount": 350,
  "tokenEstimate": 70
}`;
  return {
    systemPrompt,
    groupCompliance: enforceNovelAiSyntax,
  };
}
