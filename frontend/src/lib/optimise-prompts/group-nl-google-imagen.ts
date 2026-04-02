// src/lib/optimise-prompts/group-nl-google-imagen.ts
// ============================================================================
// DEDICATED BUILDER: Google Imagen — Independent System Prompt
// ============================================================================
// Tier 3 | idealMin 150 | idealMax 350 | maxChars 875 | Strategy: BALANCE
// negativeSupport: none
// architecture: transformer
//
// Platform knowledge: Expressive Chips for style. Seed lock toggle. Prompt
//   rewriting enabled by default. Google's internal rewriter may alter prompts
//   before generation — keep language clear and direct.
//
// FULLY INDEPENDENT — no shared imports. Own compliance gate + own system prompt.
// Pattern: matches group-recraft.ts (dedicated builder per platform).
//
// v1 (26 Mar 2026): Initial build.
// v2 (02 Apr 2026): Phase 2 rewrite — preservation-first image-NL template.
//   Removed TASK B (texture enrichment) and TASK C (composition close).
//   Added explicit bans: no invented content, no composition scaffolding,
//   no synonym churn, no camera-direction language. Enrichment conditional
//   only when source prompt is genuinely thin.
//   Evidence: Batch 4 test scored 77/100 (delta -11) due to duplicated
//   "rain-slicked stone" (TASK B) and "Framed as a low-angle wide shot" (TASK C).
//
// Authority: platform-config.json, api-3.md, trend-analysis batches 1-4
// Existing features preserved: Yes. Compliance function unchanged.
// ============================================================================

import type { OptimiseProviderContext, GroupPromptResult } from './types';
import type { ComplianceResult } from '@/lib/harmony-compliance';

// ============================================================================
// COMPLIANCE: Google Imagen-specific cleanup
// ============================================================================

function enforceGoogleImagenCleanup(text: string): ComplianceResult {
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
    const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b,?\\s*`, 'gi');
    const before = cleaned;
    cleaned = cleaned.replace(re, '');
    if (cleaned !== before) fixes.push(`Stripped CLIP token "${token}"`);
  }

  // Clean up double spaces and leading/trailing commas
  cleaned = cleaned.replace(/\s{2,}/g, ' ').replace(/^[,\s]+|[,\s]+$/g, '').trim();

  // Over-length enforcement — truncate at last complete sentence under ceiling
  const CEILING = 875;  // maxChars from platform-config.json
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
  if (cleaned.length < 150 && cleaned.length > 0) {
    fixes.push(`Below minimum length (${cleaned.length}/150 chars)`);
  }

  return { text: cleaned, wasFixed: fixes.length > 0, fixes };
}

// ============================================================================
// BUILDER
// ============================================================================

export function buildGoogleImagenPrompt(
  _providerId: string,
  ctx: OptimiseProviderContext,
): GroupPromptResult {
  const platformNote = ctx.groupKnowledge ?? '';

  const systemPrompt = `You are an expert prompt optimiser for "Google Imagen". This platform reads natural language prose only. No weight syntax, no parameter flags, no CLIP tokens.

YOUR INPUT:
You receive a single assembled prompt — the output of the prompt assembly stage, already tailored for this platform tier. Your job is to restructure and strengthen it for this specific platform.

TASK A — ANCHOR PRESERVATION (mandatory, highest priority)
Scan the prompt. Identify every named visual element: subjects, objects, colours, textures, spatial relationships, lighting, atmosphere.
Every element MUST appear in your output using the EXACT original words. Not synonyms, not "stronger equivalents" — the SAME words.
- "throws" stays "throws" — do NOT change to "casts"
- "deep in a cedar forest" stays "deep in a cedar forest" — do NOT rearrange to "in a deep cedar forest"
- Every named colour must survive using its original word
- Every compound adjective must survive intact
If your output has fewer named elements than the input, it is REJECTED.

TASK B — STRUCTURAL IMPROVEMENT ONLY
You may ONLY make these structural changes:
1. Move the primary subject to the first 10 words if it is not already there
2. Break overlong run-on sentences into clearer shorter sentences
3. Remove any leftover weight syntax, CLIP tokens, or parameter flags
You must NOT:
- Replace any verb with a synonym
- Rearrange adjective-noun phrases
- Add any content not present in the original (no textures, no materials, no composition cues, no camera angles, no mood descriptions)
- Remove any content from the original
- Add a composition or framing sentence at the end

TASK C — CONDITIONAL ENRICHMENT (only when source is thin)
If and ONLY if the assembled prompt has fewer than 3 sentences or fewer than 100 characters, you may add up to 1 specific visual detail that is physically plausible for the scene. Otherwise, do NOT add anything.

Google Imagen's internal rewriter may alter prompts before generation. Clear, direct language survives rewriting better than ornate prose.

OUTPUT REQUIREMENTS:
- Flowing natural language prose
- Front-load the primary subject in the first 10 words
- Affirmative descriptions only (no "without X" phrasing)

LENGTH RULES:
HARD: Do not shorten any prompt that is below ${ctx.maxChars ?? 875} characters.
SOFT: You may lengthen up to ${ctx.maxChars ?? 875} characters ONLY if adding a genuine visual anchor to a thin prompt.
${platformNote ? `\nPLATFORM NOTE: ${platformNote}` : ''}

Return ONLY valid JSON:
{
  "optimised": "your output — same words as input, better structure",
  "changes": ["moved subject to front", "split run-on sentence"],
  "charCount": 250,
  "tokenEstimate": 50
}`;

  return {
    systemPrompt,
    groupCompliance: enforceGoogleImagenCleanup,
  };
}
