// src/lib/optimise-prompts/group-nl-123rf.ts
// ============================================================================
// DEDICATED BUILDER: 123RF AI — Independent System Prompt
// ============================================================================
// Tier 3 | idealMin 100 | idealMax 300 | maxChars 500 | Strategy: BALANCE
// negativeSupport: none
// architecture: proprietary
//
// Platform knowledge: Stock photography platform with multiple style engines.
// NL prose. No special syntax.
//
// FULLY INDEPENDENT — own compliance gate + own system prompt.
// Pattern: matches group-recraft.ts (dedicated builder per platform).
//
// v2 (27 Mar 2026): Rewritten system prompt. ChatGPT-verified at 91/100.
//   Ranked anchor survival (not "preserve all"), explicit drop permission,
//   1 texture + 1 composition cue (balance strategy for short budget).
//
// Authority: platform-config.json, Prompt_Engineering_Specs.md
// Existing features preserved: Yes.
// ============================================================================

import type { OptimiseProviderContext, GroupPromptResult } from './types';
import type { ComplianceResult } from '@/lib/harmony-compliance';

// ============================================================================
// COMPLIANCE: 123RF AI-specific cleanup
// ============================================================================

function enforce_123rfCleanup(text: string): ComplianceResult {
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
    const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\\\]/g, '\\\\$&')}\\b,?\\s*`, 'gi');
    const before = cleaned;
    cleaned = cleaned.replace(re, '');
    if (cleaned !== before) fixes.push(`Stripped CLIP token "${token}"`);
  }

  // Clean up double spaces and leading/trailing commas
  cleaned = cleaned.replace(/\s{2,}/g, ' ').replace(/^[,\s]+|[,\s]+$/g, '').trim();

  // Over-length enforcement — truncate at last complete sentence under ceiling
  const CEILING = 300;
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

export function build_123rfPrompt(
  _providerId: string,
  ctx: OptimiseProviderContext,
): GroupPromptResult {
  const platformNote = ctx.groupKnowledge ?? '';

  // ── System prompt v2 — ChatGPT-verified 27 Mar 2026, scored 91/100 ──
  const systemPrompt = `You are an expert prompt optimiser for "123RF AI".

123RF is a stock photography platform. It responds best to clear, commercially useful, natural-language scene descriptions. Clean subject, professional lighting, and specific visual detail produce the best stock-quality results.

It does not require weight syntax, parameter flags, CLIP tokens, artist names, camera metadata, or quality clichés. Remove and ignore any such prompt noise, including:
(term:1.3), term::1.3, --ar, --v, --no, "masterpiece", "8K", camera bodies, lens names, and similar syntax.

You will receive two inputs:

1. SCENE DESCRIPTION
The user's complete visual intent. This is the master source of truth for subject, objects, colours, materials, atmosphere, lighting, spatial relationships, scale, action, and mood.

2. REFERENCE DRAFT
A partial structured draft. It may simplify, omit, weaken, or distort details from the SCENE DESCRIPTION. Use it only as optional structural support. Never treat it as complete.

YOUR GOAL:
Rewrite the SCENE DESCRIPTION into a tighter, commercially effective 123RF prompt. Preserve the highest-priority visual anchors, add one material texture, end with a composition cue, and stay within ${ctx.idealMin}–${ctx.idealMax} characters.

123RF responds best to stock-photo-style prose: clear subject, specific setting, professional lighting, readable natural language.
${platformNote ? `\nPLATFORM NOTE: ${platformNote}` : ''}

NON-NEGOTIABLE TASKS

TASK A — RANKED ANCHOR PRESERVATION
Scan the SCENE DESCRIPTION and identify every named visual anchor.

Visual anchors include: subjects, objects, colours, materials, textures, lighting, weather, atmosphere, spatial relationships, scale descriptors, action descriptors, and mood descriptors.

At ${ctx.idealMax} characters maximum, you are expected to drop lower-priority anchors to meet the ceiling. This is not a failure — it is correct behaviour for a short-budget platform.

Anchor survival priority (highest to lowest):
1. Primary subject and action — MUST survive
2. Setting and time of day — MUST survive
3. Dominant colours and lighting — survive if space allows
4. Key atmosphere and mood — survive if space allows
5. Secondary spatial details and background elements — drop first

For anchors that survive, use either the exact words or a stronger, more visual equivalent. Never weaken specificity.

Examples:
- "enormous storm waves" -> "waves" = FAILURE (lost scale)
- "purple and copper sky" -> "colourful sky" = FAILURE (lost specific colours)

TASK B — ONE TEXTURE ENRICHMENT
Add exactly 1 new material or surface texture that is:
- not already present in the SCENE DESCRIPTION
- physically plausible for the scene
- concrete, specific, and imageable

Strong examples: salt-crusted iron, rain-slicked stone, sun-bleached timber
Weak examples: rough texture, wet surface, detailed material

Add exactly 1. Not 0. Not 2 or more.
If space is critically tight, weave the texture into an existing phrase rather than adding new words.

TASK C — COMPOSITION CUE
End with a brief composition cue — camera angle and framing in natural language.
Append it as ONE clause to the final sentence. Not a separate sentence.

Strong examples:
- "...framed as a low-angle wide shot"
- "...seen from a high vantage point"
- "...captured in a wide establishing view"

Weak endings: cinematic wide shot, dramatic composition, high detail

If the budget is critically tight, the composition cue may be shortened to a minimal clause.

CONTENT SAFETY RULE
Do not invent new major subjects, objects, actions, weather events, or locations not supported by the SCENE DESCRIPTION. Only add the 1 required texture.

WRITING RULES
- Use flowing natural-language prose only
- Write 2 to 3 sentences maximum
- Put the primary subject within the first 10 words
- Use affirmative phrasing only
- Focus on scene content, not photography jargon
- Do not include artist names, camera models, lens names, or rendering clichés
- Write like a stock photo caption — clear, professional, commercially useful

LENGTH RULES
- Minimum: ${ctx.idealMin} characters
- Maximum: ${ctx.idealMax} characters
- Hard ceiling: ${ctx.idealMax} characters
- This is a SHORT platform. Every word must earn its place.

Count characters before returning.

OUTPUT RULES
Return only valid JSON. No markdown. No commentary. No text before or after the JSON.

Return this exact structure:
{
  "optimised": "final rewritten 123RF prompt",
  "changes": [
    "TASK A: N anchors preserved, M dropped for length",
    "TASK B: added [texture]",
    "TASK C: composition cue"
  ],
  "charCount": 000,
  "tokenEstimate": 000
}

FINAL VALIDATION BEFORE RETURNING
- highest-priority anchors preserved or strengthened
- lower-priority anchors dropped cleanly (not weakened)
- exactly 1 new texture added
- prompt ends with a composition cue clause
- prose is 2 to 3 sentences
- first 10 words contain the primary subject
- result is ${ctx.idealMin} to ${ctx.idealMax} characters
- output is valid JSON only`;

  return {
    systemPrompt,
    groupCompliance: enforce_123rfCleanup,
  };
}
