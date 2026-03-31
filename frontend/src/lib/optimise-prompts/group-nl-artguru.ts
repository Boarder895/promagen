// src/lib/optimise-prompts/group-nl-artguru.ts
// ============================================================================
// DEDICATED BUILDER: ArtGuru — Independent System Prompt
// ============================================================================
// Tier 4 | idealMin 200 | idealMax 450 | maxChars 500 | Strategy: ENRICH
// negativeSupport: separate
// architecture: natural-language
//
// Platform knowledge: Style-preset driven platform with 30+ presets. No weight syntax exposed. Accepts...
//
// FULLY INDEPENDENT — no shared imports. Own compliance gate + own system prompt.
// Pattern: matches group-recraft.ts (dedicated builder per platform).
//
// Authority: platform-config.json, Prompt_Engineering_Specs.md
// Existing features preserved: Yes.
// ============================================================================

import type { OptimiseProviderContext, GroupPromptResult } from './types';
import type { ComplianceResult } from '@/lib/harmony-compliance';

// ============================================================================
// COMPLIANCE: ArtGuru-specific cleanup
// ============================================================================

function enforceArtguruCleanup(text: string): ComplianceResult {
  const fixes: string[] = [];
  let cleaned = text;

  // Strip parenthetical weights: (term:1.3) → term
  const parenBefore = cleaned;
  cleaned = cleaned.replace(/\(([^()]+):\d+\.?\d*\)/g, '$1');
  if (cleaned !== parenBefore) fixes.push('Stripped parenthetical weight syntax');

  // Strip double-colon weights: term::1.3 → term
  const dcBefore = cleaned;
  cleaned = cleaned.replace(/(\w[\w\s-]*)::(?:\d+\.?\d*)/g, '$1');
  if (cleaned !== dcBefore) fixes.push('Stripped double-colon weight syntax');

  // Strip MJ parameter flags
  const flagBefore = cleaned;
  cleaned = cleaned.replace(/\s*--(?:ar|v|s|no|stylize|chaos|weird|tile|repeat|seed|stop|iw|niji|raw)\s*[^\s,]*/gi, '');
  if (cleaned !== flagBefore) fixes.push('Stripped parameter flags');

  // Strip CLIP quality tokens
  const clipTokens = ['masterpiece', 'best quality', 'highly detailed', '8K', '4K', 'intricate textures', 'sharp focus'];
  for (const token of clipTokens) {
    const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b,?\\s*`, 'gi');
    const before = cleaned;
    cleaned = cleaned.replace(re, '');
    if (cleaned !== before) fixes.push(`Stripped CLIP token "${token}"`);
  }

  // Clean up double spaces and leading/trailing commas
  cleaned = cleaned.replace(/\s{2,}/g, ' ').replace(/^[,\s]+|[,\s]+$/g, '').trim();

  // Over-length enforcement — truncate at last complete sentence under ceiling
  const CEILING = 500;  // maxChars from platform-config.json
  if (cleaned.length > CEILING) {
    const sentences = cleaned.match(/[^.!?]+[.!?]+/g) || [cleaned];
    let truncated = '';
    for (const sentence of sentences) {
      if ((truncated + sentence).length <= CEILING) {
        truncated += sentence;
      } else {
        break;
      }
    }
    if (truncated.length > 0 && truncated.length < cleaned.length) {
      fixes.push(`Truncated from ${cleaned.length} to ${truncated.trim().length} chars (ceiling: ${CEILING})`);
      cleaned = truncated.trim();
    }
  }

  // Flag under-length
  if (cleaned.length < 200 && cleaned.length > 0) {
    fixes.push(`Below minimum length (${cleaned.length}/200 chars)`);
  }

  return { text: cleaned, wasFixed: fixes.length > 0, fixes };
}

// ============================================================================
// BUILDER
// ============================================================================

export function buildArtguruPrompt(
  _providerId: string,
  ctx: OptimiseProviderContext,
): GroupPromptResult {
  const platformNote = ctx.groupKnowledge ?? '';

  const systemPrompt = `You are an expert prompt optimiser for "ArtGuru". This platform reads natural language prose only. No weight syntax, no parameter flags, no CLIP tokens. Strip all (term:1.3), term::1.3, --ar, --v, --no, "masterpiece", "8K" from input.

YOUR INPUT:
You receive a single assembled prompt — the output of the prompt assembly stage, already tailored for this platform tier. Your job is to restructure and strengthen it for this specific platform.

TASK A — ANCHOR PRESERVATION (mandatory)
Scan the prompt. Identify every named visual element: subjects, objects, colours, textures, spatial relationships, lighting, atmosphere.
Every element MUST appear in your output using the EXACT words or a stronger equivalent.
- "enormous storm waves" → "waves" is a FAILURE (lost "enormous" + "storm")
- Every named colour must survive (purple, copper, gold, orange — all of them)
- Every compound adjective must survive ("tiny warm orange windows" loses nothing)
If your output has fewer named elements than the scene description, it is REJECTED.

TASK B — TEXTURE INJECTION
Add exactly 2 material/surface textures NOT in the scene description. Must be physically plausible for this specific scene. Be specific: "salt-crusted iron railing", "lichen-spotted granite", "spray-misted glass". Generic textures are not acceptable.

TASK C — SENSORY UPGRADE
Find 2 generic modifiers in the scene description and replace with richer sensory details:
"dark cliffs" → "basalt cliffs streaked with rain"
"driving rain" → "horizontal sheets of cold rain"
The replacement must be MORE visual, not just a synonym.

TASK D — COMPOSITION CLOSE
End with a specific composition sentence: camera angle + framing + depth layers.
"Cinematic" or "wide shot" alone is LAZY. Specify: angle + framing + foreground-to-background depth.
Example: "Framed as a low-angle wide shot with layered depth from the foreground deck through spray-filled air to the glowing village."



NEGATIVE PROMPT — DYNAMIC NEGATIVE INTELLIGENCE:
Analyse the positive prompt and generate scene-specific negatives. Do NOT use generic boilerplate as the majority.

FAILURE-MODE CATEGORIES (apply ALL that match this scene):
1. MOOD INVERSION: If stormy/dramatic → "calm, peaceful, sunny, clear sky". If serene → "chaos, fire, destruction".
2. ERA CONTAMINATION: If historical/period → "modern buildings, contemporary clothing, cars". If futuristic → "medieval, rustic".
3. SUBJECT CORRUPTION: If solitary figure → "crowd, extra people, duplicate figures". If group → "empty, deserted".
4. COLOUR DRIFT: If warm palette → "cool blue tones, grey monotone". If cool → "warm orange cast, sepia".
5. ATMOSPHERE COLLAPSE: If dramatic → "flat lighting, overexposed, mundane". If bright → "dark, gloomy".
6. SCALE DISTORTION: If grand/epic → "miniature, claustrophobic". If intimate → "aerial view, wide establishing shot".
7. MEDIUM MISMATCH: If photorealistic → "cartoon, anime, sketch". If artistic → "photographic, stock photo".

NEGATIVE FORMAT: 3 generic quality terms (blurry, watermark, low quality) + minimum 4 scene-specific terms from failure-mode analysis. Total: 8–12 terms. Never duplicate a positive term.\n30+ style presets do creative direction. Focus on scene content, not style instructions.

OUTPUT REQUIREMENTS:
- Flowing natural language prose, 3–4 sentences
- Front-load the primary subject in the first 10 words

LENGTH RULES:
HARD: Do not shorten any prompt that is below ${ctx.maxChars ?? 500} characters.
SOFT: You may lengthen the prompt up to ${ctx.maxChars ?? 500} characters, but only if the added content is a genuine visual anchor — not filler.
Your job is to produce the best possible prompt for this platform. Length is not a goal. Anchor preservation is.
- Affirmative descriptions only (no "without X" phrasing)
${platformNote ? `\nPLATFORM NOTE: ${platformNote}` : ''}

Return ONLY valid JSON:
{
  "optimised": "your rewritten prompt",\n  "negative": "scene-specific negative terms",
  "changes": ["TASK A: N anchors preserved", "TASK B: added [tex1] and [tex2]", "TASK C: upgraded [x] and [y]", "TASK D: composition close"],
  "charCount": 325,
  "tokenEstimate": 65
}`;

  return {
    systemPrompt,
    groupCompliance: enforceArtguruCleanup,
  };
}
