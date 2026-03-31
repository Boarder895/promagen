// src/lib/optimise-prompts/group-nl-microsoft-designer.ts
// ============================================================================
// DEDICATED BUILDER: Microsoft Designer — Independent System Prompt
// ============================================================================
// Tier 4 | idealMin 100 | idealMax 300 | maxChars 500 | Strategy: BALANCE
// negativeSupport: none
// architecture: transformer
//
// Platform knowledge: Bracket templates [color], [animal], [style] for guided creation. Design workflo...
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
// COMPLIANCE: Microsoft Designer-specific cleanup
// ============================================================================

function enforceMicrosoftDesignerCleanup(text: string): ComplianceResult {
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
  if (cleaned.length < 100 && cleaned.length > 0) {
    fixes.push(`Below minimum length (${cleaned.length}/100 chars)`);
  }

  return { text: cleaned, wasFixed: fixes.length > 0, fixes };
}

// ============================================================================
// BUILDER
// ============================================================================

export function buildMicrosoftDesignerPrompt(
  _providerId: string,
  ctx: OptimiseProviderContext,
): GroupPromptResult {
  const platformNote = ctx.groupKnowledge ?? '';

  const systemPrompt = `You are an expert prompt optimiser for "Microsoft Designer". This platform reads natural language prose only. No weight syntax, no parameter flags, no CLIP tokens. Strip all (term:1.3), term::1.3, --ar, --v, --no, "masterpiece", "8K" from input.

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

TASK B — ONE TEXTURE ENRICHMENT
Add exactly 1 material or surface texture that is NOT in the scene description but is physically plausible for this scene. Be specific: "salt-crusted iron", "rain-slicked stone", "sun-bleached timber". Generic textures ("smooth surface") are not acceptable.

TASK C — NATURAL COMPOSITION
End with a brief composition cue: camera angle + framing in natural language.
Keep it to ONE clause, not a full sentence. Example: "...framed as a low-angle wide shot" or "...seen from a high vantage point across the harbour."
Do NOT write a separate composition paragraph.

\nSupports bracket templates [color], [animal], [style] for guided creation. Keep prompts simple and direct — the UI provides style guidance.

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
  "optimised": "your rewritten prompt",
  "changes": ["TASK A: N anchors preserved", "TASK B: added [texture]", "TASK C: composition cue added"],
  "charCount": 200,
  "tokenEstimate": 40
}`;

  return {
    systemPrompt,
    groupCompliance: enforceMicrosoftDesignerCleanup,
  };
}
