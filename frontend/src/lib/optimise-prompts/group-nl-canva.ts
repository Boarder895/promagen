// src/lib/optimise-prompts/group-nl-canva.ts
// ============================================================================
// DEDICATED BUILDER: Canva Magic Media — Independent System Prompt
// ============================================================================
// Tier 3 | idealMin 50 | idealMax 200 | maxChars 500 | Strategy: REFINE
// negativeSupport: none
// architecture: proprietary
//
// Platform knowledge: Powered by Leonardo Phoenix. Three output types (image/graphic/video). Style and...
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
// COMPLIANCE: Canva Magic Media-specific cleanup
// ============================================================================

function enforceCanvaCleanup(text: string): ComplianceResult {
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
  const CEILING = 200;
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
  if (cleaned.length < 50 && cleaned.length > 0) {
    fixes.push(`Below minimum length (${cleaned.length}/50 chars)`);
  }

  return { text: cleaned, wasFixed: fixes.length > 0, fixes };
}

// ============================================================================
// BUILDER
// ============================================================================

export function buildCanvaPrompt(
  _providerId: string,
  ctx: OptimiseProviderContext,
): GroupPromptResult {
  const platformNote = ctx.groupKnowledge ?? '';

  const systemPrompt = `You are an expert prompt optimiser for "Canva Magic Media". This platform reads natural language prose only. No weight syntax, no parameter flags, no CLIP tokens. Strip all (term:1.3), term::1.3, --ar, --v, --no, "masterpiece", "8K" from input.

YOU RECEIVE TWO INPUTS:
1. SCENE DESCRIPTION — the user's full visual intent. This is your source of truth for colours, objects, mood, and spatial detail.
2. REFERENCE DRAFT — a structured version. May have LOST details from the original. Do not trust it as complete.

TASK A — ANCHOR PRESERVATION (mandatory)
Scan the SCENE DESCRIPTION. Identify every named visual element: subjects, objects, colours, textures, spatial relationships, lighting, atmosphere.
Every element MUST appear in your output using the EXACT words or a stronger equivalent.
- "enormous storm waves" → "waves" is a FAILURE (lost "enormous" + "storm")
- Every named colour must survive (purple, copper, gold, orange — all of them)
- Every compound adjective must survive ("tiny warm orange windows" loses nothing)
If your output has fewer named elements than the scene description, it is REJECTED.

TASK B — RESTRUCTURE FOR CLARITY
Rewrite the scene in clean, vivid prose. Front-load the primary subject in the first 10 words.
DO NOT add new content. DO NOT invent textures, materials, or composition language.
Your job is to RESTRUCTURE the existing content into the most vivid, natural-reading form.
Combine related details. Remove filler words. Every word must earn its place.
Target: 50–200 characters. Going OVER 200 is a HARD FAILURE.

TASK C — LENGTH DISCIPLINE
Your output MUST be between 50 and 200 characters. This is NON-NEGOTIABLE.
If the scene has too many anchors to fit in 200 chars, prioritise:
1. Primary subject and action
2. Setting and time of day
3. Dominant colours and lighting
4. Atmosphere and mood
Drop secondary spatial details last. Count your characters BEFORE returning JSON.\nCanva users set style via UI presets (image/graphic/3D). Do NOT include style or medium instructions — focus on WHAT to show.

OUTPUT REQUIREMENTS:
- Flowing natural language prose, 2–3 sentences
- Front-load the primary subject in the first 10 words
- 50–200 characters (HARD CEILING: 200)
- Affirmative descriptions only (no "without X" phrasing)
${platformNote ? `\nPLATFORM NOTE: ${platformNote}` : ''}

Return ONLY valid JSON:
{
  "optimised": "your rewritten prompt",
  "changes": ["TASK A: N anchors preserved", "TASK B: restructured for clarity", "TASK C: within length target"],
  "charCount": 125,
  "tokenEstimate": 25
}`;

  return {
    systemPrompt,
    groupCompliance: enforceCanvaCleanup,
  };
}
