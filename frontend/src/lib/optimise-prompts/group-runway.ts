// src/lib/optimise-prompts/group-runway.ts
// ============================================================================
// DEDICATED BUILDER: Runway — Independent Video System Prompt
// ============================================================================
// Tier 3 | idealMin 200 | idealMax 400
// negativeSupport: none | architecture: proprietary
//
// Platform knowledge: Video-first platform. Supports [00:01] timestamp syntax
//   for timed events. No negative prompt support.
//
// FULLY INDEPENDENT — own compliance gate + own system prompt.
// Pattern: matches group-recraft.ts (dedicated builder per platform).
//
// v1 (26 Mar 2026): Initial build.
// v2 (02 Apr 2026): Phase 3 rewrite — video-NL doctrine.
//   Core change: scene motion replaces camera motion. Removed CAMERA MOVEMENT
//   VOCABULARY list entirely. Removed "Open with camera position and movement".
//   Added explicit bans: no shot verbs, no "camera" as subject, no cinematic
//   mood filler, no synonym churn. Motion optional for still scenes.
//   Evidence: Batch 4 test scored 80/100 (delta -8) due to "slow low-angle
//   push-in follows" and "Quiet, sacred, and eerie" mood filler.
//
// Authority: platform-config.json, api-3.md, trend-analysis batches 1-4
// Existing features preserved: Yes. Compliance function unchanged.
// ============================================================================

import type { OptimiseProviderContext, GroupPromptResult } from './types';
import type { ComplianceResult } from '@/lib/harmony-compliance';

// ============================================================================
// COMPLIANCE: Runway-specific cleanup
// ============================================================================

function enforceRunwayCleanup(text: string): ComplianceResult {
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
    const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b,?\\s*`, 'gi');
    const before = cleaned;
    cleaned = cleaned.replace(re, '');
    if (cleaned !== before) fixes.push(`Stripped image-gen token "${token}"`);
  }

  cleaned = cleaned.replace(/\s{2,}/g, ' ').replace(/^[,\s]+|[,\s]+$/g, '').trim();

  // Over-length enforcement
  const CEILING = 1000;  // maxChars from platform-config.json
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

export function buildRunwayPrompt(
  _providerId: string,
  ctx: OptimiseProviderContext,
): GroupPromptResult {
  const platformNote = ctx.groupKnowledge ?? '';
  const hardCeiling = ctx.maxChars ?? 1000;

  const systemPrompt = `You are an expert prompt optimiser for Runway, a text-to-video platform. The output is a 4–10 second video clip.

YOUR INPUT:
You receive a single assembled prompt — the output of the prompt assembly stage, already tailored for this platform tier. Your job is to adapt it for video generation.

TASK A — ANCHOR PRESERVATION (mandatory, highest priority)
Scan the prompt. Identify every named visual element: subjects, objects, colours, textures, spatial relationships, lighting, atmosphere.
Every element MUST appear in your output using the EXACT original words. Not synonyms — the SAME words.
- "throws" stays "throws" — do NOT change to "casts" or "flickers"
- "deep in a cedar forest" stays exactly as written
- Every named colour, every compound adjective must survive intact
If your output has fewer named elements than the input, it is REJECTED.

TASK B — SCENE MOTION (not camera motion)
Since this is a video platform, you should describe what moves IN the scene — not how the camera moves.

ALLOWED motion — things that naturally move in the scene:
- Weather: rain falling, wind blowing, clouds drifting, mist threading
- Water: waves, streams, reflections rippling
- Light: flickering, sweeping, shifting
- Cloth/hair: trembling, billowing, fluttering
- Smoke/fire: rising, curling, glowing
- Nature: leaves rustling, branches swaying

FORBIDDEN — camera-direction language:
- Never use the word "camera" as a subject
- Never use: tracking shot, dolly shot, push-in, pull back, pan, tilt, crane shot, steadicam, handheld, locked off
- Never open with "A slow tracking shot..." or "Camera pulls back to reveal..."
- Never add "cinematic" as a mood descriptor

MOTION IS OPTIONAL: If the scene is naturally still (a portrait, a still life, a frozen moment), leave it still. Do not force motion onto scenes that don't need it. Only add motion verbs to elements that would naturally be moving.

TASK C — STRUCTURAL CLEANUP
1. Strip any leftover weight syntax, CLIP tokens, or parameter flags
2. Front-load the primary subject in the first 10 words
3. Convert any "without X" phrasing to affirmative descriptions or remove
You must NOT:
- Add any content not present in the original (no invented textures, no mood filler)
- Add a trailing mood sentence like "Quiet, sacred, and eerie, with a hushed supernatural atmosphere"
- Remove any content from the original

PLATFORM-SPECIFIC:
Runway supports [timestamp] syntax for timed events within the clip:
- [00:00] opening state, [00:02] something changes, [00:04] climax
- This is OPTIONAL — only use when the scene has clear distinct temporal phases
- If used, timestamps must be in ascending order

LENGTH RULES:
HARD: Do not shorten any prompt that is below ${hardCeiling} characters.
SOFT: You may lengthen up to ${hardCeiling} characters ONLY if adding natural scene motion to existing elements.
${platformNote ? `\nPLATFORM NOTE: ${platformNote}` : ''}

Return ONLY valid JSON:
{
  "optimised": "your output — same anchors, natural scene motion where appropriate",
  "changes": ["added wind motion to ribbons", "front-loaded subject"],
  "charCount": 300,
  "tokenEstimate": 60
}`;
  return {
    systemPrompt,
    groupCompliance: enforceRunwayCleanup,
  };
}
