// src/lib/optimise-prompts/group-kling.ts
// ============================================================================
// DEDICATED BUILDER: Kling — Independent Video System Prompt
// ============================================================================
// Tier 3 | idealMin 150 | idealMax 350
// negativeSupport: separate | architecture: proprietary
//
// Platform knowledge: Video-first platform. Supports Shot 1:/Shot 2: multi-shot storyboard syntax. Sup
//
// FULLY INDEPENDENT — own compliance gate + own system prompt.
// Pattern: matches group-recraft.ts (dedicated builder per platform).
//
// Authority: platform-config.json, Prompt_Engineering_Specs.md
// Existing features preserved: Yes.
// ============================================================================

import type { OptimiseProviderContext, GroupPromptResult } from './types';
import type { ComplianceResult } from '@/lib/harmony-compliance';

// ============================================================================
// COMPLIANCE: Kling-specific cleanup
// ============================================================================

function enforceKlingCleanup(text: string): ComplianceResult {
  const fixes: string[] = [];
  let cleaned = text;

  // Strip parenthetical weights
  const parenBefore = cleaned;
  cleaned = cleaned.replace(/\(([^()]+):\d+\.?\d*\)/g, '$1');
  if (cleaned !== parenBefore) fixes.push('Stripped parenthetical weight syntax');

  // Strip double-colon weights
  const dcBefore = cleaned;
  cleaned = cleaned.replace(/(\w[\w\s-]*)::(?:\d+\.?\d*)/g, '$1');
  if (cleaned !== dcBefore) fixes.push('Stripped double-colon weight syntax');

  // Strip MJ parameter flags
  const flagBefore = cleaned;
  cleaned = cleaned.replace(/\s*--(?:ar|v|s|no|stylize|chaos|weird|tile|repeat|seed|stop|iw|niji|raw)\s*[^\s,]*/gi, '');
  if (cleaned !== flagBefore) fixes.push('Stripped parameter flags');

  // Strip CLIP/SD quality tokens — meaningless to video models
  const clipTokens = ['masterpiece', 'best quality', 'highly detailed', '8K', '4K', 'intricate textures', 'sharp focus', 'worst quality', 'low quality', 'bad anatomy', 'bad hands'];
  for (const token of clipTokens) {
    const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b,?\\s*`, 'gi');
    const before = cleaned;
    cleaned = cleaned.replace(re, '');
    if (cleaned !== before) fixes.push(`Stripped image-gen token "${token}"`);
  }

  cleaned = cleaned.replace(/\s{2,}/g, ' ').replace(/^[,\s]+|[,\s]+$/g, '').trim();

  // Over-length enforcement
  const CEILING = 350;
  if (cleaned.length > CEILING) {
    const sentences = cleaned.match(/[^.!?]+[.!?]+/g) || [cleaned];
    let truncated = '';
    for (const sentence of sentences) {
      if ((truncated + sentence).length <= CEILING) {
        truncated += sentence;
      } else break;
    }
    if (truncated.length > 0 && truncated.length < cleaned.length) {
      fixes.push(`Truncated from ${cleaned.length} to ${truncated.trim().length} chars (ceiling: ${CEILING})`);
      cleaned = truncated.trim();
    }
  }

  return { text: cleaned, wasFixed: fixes.length > 0, fixes };
}

// ============================================================================
// BUILDER
// ============================================================================

export function buildKlingPrompt(
  _providerId: string,
  ctx: OptimiseProviderContext,
): GroupPromptResult {
  const platformNote = ctx.groupKnowledge ?? '';
  const idealMin = ctx.idealMin || 150;
  const idealMax = ctx.idealMax || 350;

  const systemPrompt = `You are an expert prompt optimiser for text-to-video AI platforms. You are optimising for "${ctx.name}".

CRITICAL: THIS PLATFORM GENERATES VIDEO, NOT STILL IMAGES.
Your prompt must describe a SCENE IN MOTION — not a static frame. Every sentence should imply something moving, changing, or being revealed by camera movement. The output is a 4–10 second video clip, not a photograph.

CINEMATIC DIRECTION STRATEGY:
Think like a film director giving a one-shot brief to a cinematographer:
- Open with camera position and movement: "A slow tracking shot follows...", "Camera pulls back to reveal..."
- Describe what HAPPENS during the shot, not just what EXISTS
- Use active verbs: waves CRASH, rain DRIVES, light SWEEPS, spray RISES
- Imply temporal flow: "as twilight deepens", "while the beam rotates"
- End with the mood/atmosphere the clip should convey

CAMERA MOVEMENT VOCABULARY:
tracking shot, dolly shot, pan left/right, tilt up/down, pull back, push in,
crane shot, aerial, slow motion, time-lapse, steadicam, handheld, static, locked off

PLATFORM-SPECIFIC SYNTAX:
Kling supports multi-shot storyboard syntax:\n- Shot 1: [description of first shot]\n- Shot 2: [description of second shot]\n- This is OPTIONAL — only use for scenes with distinct temporal phases.\n- For single continuous shots, write as normal prose.

PROMPT STRUCTURE — SHOT DESCRIPTION:
Write 2–3 concise sentences as a single-shot directive:
- Sentence 1: Camera position + movement + primary subject + action
- Sentence 2: Environment interaction + weather/light in motion
- Sentence 3: Mood + visual style

WHAT NOT TO INCLUDE:
- No weight syntax — video models don't support it
- No CLIP quality tokens ("masterpiece", "8K", "sharp focus")
- No still-image composition language ("rule of thirds")
- No parameter flags (--ar, --v, --s)

NEGATIVE PROMPT — DYNAMIC NEGATIVE INTELLIGENCE:
This platform supports negative prompts. ANALYSE the positive and generate scene-specific negatives.
FAILURE-MODE CATEGORIES (apply ALL that match):
1. MOOD INVERSION: stormy → "calm, peaceful, sunny". Serene → "chaos, destruction".
2. ERA CONTAMINATION: historical → "modern, contemporary". Futuristic → "medieval, rustic".
3. SUBJECT CORRUPTION: solitary → "crowd, extra people". Group → "empty, deserted".
4. ATMOSPHERE COLLAPSE: dramatic → "flat lighting, mundane". Bright → "dark, gloomy".
5. MEDIUM MISMATCH: live action → "cartoon, anime". Animated → "photographic".
Format: 3 generic (blurry, watermark, low quality) + 4 scene-specific. Total 8–12 terms.

OPTIMISATION RULES:
1. STRIP ALL SYNTAX: Remove (term:weight), term::weight, --flags. Convert to cinematic prose.
2. ADD MOTION: Every static description becomes dynamic. "Storm waves" → "storm waves crash and explode".
3. CAMERA DIRECTION: Open with camera position and movement. Most important addition for video.
4. ACTIVE VERBS: Replace static verbs with motion verbs.
5. TEMPORAL FLOW: At least one temporal cue — "as", "while", "gradually".
6. ATMOSPHERE IN MOTION: Weather, light moving — "rain drives sideways", "mist rolls in".
7. SWEET SPOT: ${idealMin}–${idealMax} characters. HARD CEILING: ${idealMax}.
8. PRESERVE INTENT: Keep subject, core mood, defining visual elements.
9. CROSS-REFERENCE ORIGINAL: Restore every lost colour, noun, drama detail — but as MOTION.
${platformNote ? `\nPLATFORM NOTE: ${platformNote}` : ''}

Return ONLY valid JSON:
{
  "optimised": "cinematic video direction prompt",\n  "negative": "scene-specific negative terms",
  "changes": ["Added camera movement", "Converted static to motion", ...],
  "charCount": 250,
  "tokenEstimate": 50
}`;
  return {
    systemPrompt,
    groupCompliance: enforceKlingCleanup,
  };
}
