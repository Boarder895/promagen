// src/lib/optimise-prompts/group-ideogram.ts
// ============================================================================
// GROUP BUILDER: Ideogram Dedicated — text-in-image specialisation
// ============================================================================
// Covers 1 platform: ideogram
//
// Architecture knowledge:
//   - Industry leader for rendering READABLE TEXT in images
//   - Quotation marks in prompt = text to render: "Hello World"
//   - Natural language prose, not tags
//   - Magic Prompt: Auto/On/Off — rewrites user input (like DALL-E)
//   - Negative prompts available to paid users via separate field
//   - ~150–160 word limit
//   - Design-focused model: understands typography, kerning, margins,
//     composition grids
//   - Style presets available via UI
//   - Inline negatives via "without X" (unreliable)
//
// v1 (26 Mar 2026): Initial build.
// v2 (26 Mar 2026): Dynamic Negative Intelligence. Zero-anchor-loss rule.
//   Negative prompt now generated for paid users' negative field.
//
// Authority: grouping-45-image-platforms-by-prompt-compatibility.md §Dedicated
// Existing features preserved: Yes (new file).
// ============================================================================

import type { OptimiseProviderContext, GroupPromptResult } from './types';
import type { ComplianceResult } from '@/lib/harmony-compliance';

// ============================================================================
// COMPLIANCE: Strip non-Ideogram syntax
// ============================================================================

function enforceIdeogramCleanup(text: string): ComplianceResult {
  const fixes: string[] = [];
  let cleaned = text;

  // Strip parenthetical weights: (term:1.3) → term
  const parenBefore = cleaned;
  cleaned = cleaned.replace(/\(([^()]+):\d+\.?\d*\)/g, '$1');
  if (cleaned !== parenBefore) fixes.push('Stripped parenthetical weight syntax');

  // Strip double-colon weights
  const dcBefore = cleaned;
  cleaned = cleaned.replace(/(\w[\w\s-]*)::\d+\.?\d*/g, '$1');
  if (cleaned !== dcBefore) fixes.push('Stripped double-colon weight syntax');

  // Strip MJ parameter flags
  const flagBefore = cleaned;
  cleaned = cleaned.replace(/\s*--(?:ar|v|s|no|stylize|chaos|weird|tile|repeat|seed|stop|iw|niji|raw)\s*[^\s,]*/gi, '');
  if (cleaned !== flagBefore) fixes.push('Stripped parameter flags');

  // Strip CLIP quality tokens — Ideogram doesn't benefit from these
  const clipTokens = ['masterpiece', 'best quality', 'highly detailed', '8K', '4K', 'intricate textures', 'sharp focus'];
  for (const token of clipTokens) {
    const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b,?\\s*`, 'gi');
    const before = cleaned;
    cleaned = cleaned.replace(re, '');
    if (cleaned !== before) fixes.push(`Stripped CLIP token "${token}"`);
  }

  // Clean up
  cleaned = cleaned.replace(/\s{2,}/g, ' ').replace(/^[,\s]+|[,\s]+$/g, '').trim();

  return { text: cleaned, wasFixed: fixes.length > 0, fixes };
}

// ============================================================================
// BUILDER
// ============================================================================

export function buildIdeogramPrompt(
  _providerId: string,
  ctx: OptimiseProviderContext,
): GroupPromptResult {
  const platformNote = ctx.groupKnowledge ?? '';
  const idealMin = ctx.idealMin || 200;
  const idealMax = ctx.idealMax || 400;

  const systemPrompt = `You are an expert prompt optimiser for Ideogram. You are optimising for "${ctx.name}".

CRITICAL ARCHITECTURE — TEXT-IN-IMAGE SPECIALIST:
Ideogram is the industry leader for generating readable text in images. Its model understands typography, layout, kerning, and composition grids. The prompt encoder reads natural language holistically but has special handling for quoted text.

TEXT RENDERING SYNTAX:
If the scene includes any text that should appear IN the image, wrap it in quotation marks:
- "LIGHTHOUSE" on a sign → Ideogram renders the word LIGHTHOUSE
- A poster that reads "STORM WARNING" → Ideogram renders STORM WARNING
- Do NOT use quotes for non-text scene descriptions
- If no text is needed in the image, do NOT add any quoted text

MAGIC PROMPT AWARENESS:
Ideogram has "Magic Prompt" that rewrites your input (similar to DALL-E's GPT-4 rewrite). Your prompt must be specific enough to survive this rewriting. Named visual anchors survive; vague modifiers get reinterpreted.

PROMPT STRUCTURE — DESIGN-AWARE PARAGRAPH:
Write a single flowing paragraph (2–4 sentences):
- Sentence 1: Subject + setting + primary visual focus
- Sentence 2: Environment + atmosphere + lighting + colour palette
- Sentence 3: Background details + mood + composition direction
- If text-in-image is needed: specify what text, where, and what style

WHAT NOT TO INCLUDE:
- No weight syntax — Ideogram ignores brackets and colons
- No CLIP quality tokens — "masterpiece", "8K" are meaningless
- No parameter flags — --ar, --v, --s are Midjourney syntax
- No SD-style tag lists — Ideogram reads prose, not tags

PLATFORM-SPECIFIC:
- Sweet spot: ${idealMin}–${idealMax} characters
- ~150–160 word limit — be concise but visually complete
- Front-load the subject in the first 10 words
- Ideogram excels at design, typography, and clean compositions
- Use concrete visual language — "golden hour sidelight" not "nice lighting"
- Affirmative descriptions preferred — "without X" is unreliable${platformNote ? `\n- ${platformNote}` : ''}

OPTIMISATION RULES:
1. STRIP ALL SYNTAX: Remove every (term:weight), term::weight, --ar, --v, --s, --no. Convert to natural prose.
2. FRONT-LOAD SUBJECT: Primary subject in the first 10 words.
3. ANCHOR EVERY DETAIL: Named visual elements survive Magic Prompt rewriting; vague modifiers don't. If the original says "gallery deck", write "gallery deck", not just "deck". If it says "jagged rocks", keep "jagged rocks". Every named anchor must survive.
4. COLOUR AS DESCRIPTION: "purple-and-copper twilight sky" not "colourful sky".
5. SPATIAL DEPTH: Foreground → middle ground → background in reading order.
6. DESIGN AWARENESS: If the scene suits a specific composition (centered, rule of thirds, symmetrical), mention it. Ideogram's model understands layout.
7. SWEET SPOT: ${idealMin}–${idealMax} characters. Concise but complete.
8. PRESERVE INTENT — ZERO ANCHOR LOSS: Every named visual element from the original MUST appear in the optimised output. Losing visual anchors makes the image generic. Count your anchors before and after: if ANY are missing, add them back.
9. ALWAYS ENRICH: Cross-reference the original scene description. Restore any colours, nouns, adjectives, or spatial details the input lost. The optimised prompt should have MORE visual information than the input, never less.
10. NEGATIVE PROMPT — DYNAMIC NEGATIVE INTELLIGENCE: Ideogram supports a negative prompt field for paid users. Generate scene-specific negatives using the failure-mode analysis below.

DYNAMIC NEGATIVE INTELLIGENCE:
Do NOT use boilerplate negatives. ANALYSE the positive prompt and generate negatives targeting the specific failure modes for THIS scene.

FAILURE-MODE ANALYSIS (apply ALL that match):
1. MOOD INVERSION: If stormy/dramatic → "calm, peaceful, sunny, clear sky". If serene → "chaos, destruction, fire".
2. ERA CONTAMINATION: If historical/period → "modern buildings, contemporary clothing, cars, power lines". If futuristic → "medieval, rustic, old-fashioned".
3. SUBJECT CORRUPTION: If solitary figure → "crowd, extra people, group, duplicate figure". If group → "empty, deserted, lonely".
4. COLOUR DRIFT: If palette is warm (copper/gold/orange) → "cool blue tones, green cast, grey monotone". If cool palette → "warm orange cast, sepia".
5. ATMOSPHERE COLLAPSE: If dramatic/moody → "flat lighting, mundane, overexposed, boring composition". If bright → "dark, gloomy, ominous".
6. MEDIUM MISMATCH: If photorealistic → "cartoon, anime, sketch, illustration". If artistic → "photographic, stock photo".

QUALITY FLOOR (maximum 3 generic terms): blurry, low quality, watermark
The rest MUST be scene-specific. Minimum 4 scene-specific terms.
Total negative: 7–10 terms.

BEFORE → AFTER EXAMPLES:

Example 1 — CLIP syntax converted to Ideogram prose:
BEFORE: masterpiece, best quality, (weathered lighthouse keeper:1.4), (storm waves:1.3), jagged rocks, salt spray, (lighthouse beam:1.2), purple copper sky, fishing village, dark cliffs, 8K
AFTER: A weathered lighthouse keeper grips the iron railing on a rain-soaked gallery deck at twilight as enormous storm waves crash against jagged rocks below. Salt spray rises into a purple-and-copper sky while the lighthouse beam cuts a pale gold arc through sheets of driving rain, and a distant fishing village glows with tiny warm orange windows against dark cliffs. Cinematic wide-angle composition with rich atmospheric depth.
WHY: Stripped all weight syntax and CLIP tokens. Every visual element named explicitly to survive Magic Prompt rewriting. Flowing prose with spatial depth. All 9 anchors preserved.
NEGATIVE: blurry, low quality, watermark, calm sea, daytime, clear sky, modern buildings, extra people, flat lighting, sunny weather
WHY THESE NEGATIVES: Quality floor (3). Mood inversion: "calm sea, daytime, clear sky, sunny weather" — scene is stormy twilight. Era contamination: "modern buildings". Subject corruption: "extra people" — keeper is solitary. Atmosphere collapse: "flat lighting".

Return ONLY valid JSON:
{
  "optimised": "the optimised Ideogram prompt — flowing prose, no syntax, every detail anchored",
  "negative": "scene-specific negative prompt for Ideogram's negative field",
  "changes": ["Stripped CLIP weight syntax", "Converted to Ideogram-optimised prose", ...],
  "charCount": 350,
  "tokenEstimate": 70
}`;
  return {
    systemPrompt,
    groupCompliance: enforceIdeogramCleanup,
  };
}
