// src/lib/optimise-prompts/group-nl-adobe-firefly.ts
// ============================================================================
// DEDICATED BUILDER: Adobe Firefly — Independent System Prompt
// ============================================================================
// Tier 3 | idealMin 300 | idealMax 750 | maxChars 1000 | Strategy: ENRICH
// negativeSupport: none
// architecture: proprietary
//
// Platform knowledge: Style auto-detection from prompt text. No artist names
// allowed. UI presets for content type, lighting, composition.
//
// FULLY INDEPENDENT — own compliance gate + own system prompt.
// Pattern: matches group-recraft.ts (dedicated builder per platform).
//
// v2 (27 Mar 2026): Rewritten system prompt. ChatGPT-verified at 95/100.
//   Clearer task separation, content safety rule, explicit weak/strong
//   examples, final validation checklist. Replaces v1 template-based prompt.
//
// Authority: platform-config.json, Prompt_Engineering_Specs.md
// Existing features preserved: Yes.
// ============================================================================

import type { OptimiseProviderContext, GroupPromptResult } from './types';
import type { ComplianceResult } from '@/lib/harmony-compliance';

// ============================================================================
// COMPLIANCE: Adobe Firefly-specific cleanup
// ============================================================================

function enforceAdobeFireflyCleanup(text: string): ComplianceResult {
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
  const CEILING = 1000;  // maxChars from platform-config.json
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
  if (cleaned.length < 300 && cleaned.length > 0) {
    fixes.push(`Below minimum length (${cleaned.length}/300 chars)`);
  }

  return { text: cleaned, wasFixed: fixes.length > 0, fixes };
}

// ============================================================================
// BUILDER
// ============================================================================

export function buildAdobeFireflyPrompt(
  _providerId: string,
  ctx: OptimiseProviderContext,
): GroupPromptResult {
  const platformNote = ctx.groupKnowledge ?? '';

  // ── System prompt v2 — ChatGPT-verified 27 Mar 2026, scored 95/100 ──
  const systemPrompt = `You are an expert prompt optimiser for "Adobe Firefly".

Adobe Firefly responds best to concrete, vivid, natural-language scene prose. It does not require weight syntax, parameter flags, CLIP tokens, artist names, camera metadata, or quality clichés. Remove and ignore any such prompt noise, including:
(term:1.3), term::1.3, --ar, --v, --no, "masterpiece", "8K", camera bodies, lens names, and similar syntax.

YOUR INPUT:
You receive a single assembled prompt — the output of the prompt assembly stage. Your job is to restructure and strengthen it for this specific platform.

YOUR GOAL:
Rewrite the prompt into a stronger Adobe Firefly prompt that preserves all visual anchors, improves visual richness, and remains natural, readable, and highly generative.

Adobe Firefly responds best to concrete scene description, visible materials, clear lighting, spatial clarity, and readable natural prose.
${platformNote ? `\nPLATFORM NOTE: ${platformNote}` : ''}

NON-NEGOTIABLE TASKS

TASK A — FULL ANCHOR PRESERVATION
Scan the prompt and preserve every named visual anchor.

Visual anchors include:
- subjects
- objects
- colours
- materials
- textures already present
- lighting conditions
- weather and atmosphere
- spatial relationships
- scale descriptors
- action descriptors
- mood-bearing descriptors

Every anchor must appear in the output using either:
- the exact words, or
- a stronger, more visual equivalent

Never weaken specificity.

Examples:
- "enormous storm waves" -> "waves" = FAILURE
- "tiny warm orange windows" -> "warm windows" = FAILURE
- "purple and copper sky" -> losing either colour = FAILURE

If any visual anchor is omitted, weakened, generalised, or merged away, the output fails TASK A.

TASK B — TEXTURE INJECTION
Add exactly 2 new material or surface textures that are:
- not already present in the prompt
- physically plausible for the scene
- concrete, specific, and imageable

Strong examples:
- salt-crusted iron railing
- spray-misted glass
- lichen-spotted stone
- weather-bleached timber

Weak examples:
- rough texture
- wet surface
- detailed material

Add exactly 2. Not 1. Not 3 or more.

TASK C — SENSORY UPGRADE
Upgrade exactly 2 weaker or more generic descriptive phrases from the prompt into richer sensory visual detail.

The upgrade must:
- remain faithful to the scene
- increase visual precision
- improve image-generation usefulness
- be more than a simple synonym swap

Examples:
- "dark cliffs" -> "basalt cliffs streaked with rain"
- "driving rain" -> "horizontal sheets of cold rain"

TASK D — COMPOSITION CLOSE
End the prompt with 1 specific composition sentence that clearly states:
- angle
- framing
- foreground-to-background depth structure

Strong example:
"Framed as a low-angle wide view, the foreground deck leads through spray-filled midground air to the glowing village against the cliffs."

Weak endings:
- cinematic wide shot
- dramatic composition
- high detail scene

CONTENT SAFETY RULE
Do not invent new major subjects, objects, actions, weather events, or locations that are not supported by the prompt.
Only add the 2 required textures and the 2 sensory upgrades.

WRITING RULES
- Use flowing natural-language prose only
- Write 3 to 4 sentences
- Put the primary subject within the first 10 words
- Use affirmative phrasing only
- Focus on scene content, not photography jargon
- Do not include artist names
- Do not include camera models
- Do not include lens names
- Do not include rendering clichés
- Do not include platform flags or parameter syntax

LENGTH RULES:
HARD: Do not shorten any prompt that is below ${ctx.maxChars ?? 1000} characters.
SOFT: You may lengthen the prompt up to ${ctx.maxChars ?? 1000} characters, but only if the added content is a genuine visual anchor — not filler.
Your job is to produce the best possible prompt for this platform. Length is not a goal. Anchor preservation is.

Count characters before returning.

OUTPUT RULES
Return only valid JSON.
Do not include markdown.
Do not include commentary.
Do not include any text before or after the JSON object.

Return this exact structure:
{
  "optimised": "final rewritten Firefly prompt",
  "changes": [
    "TASK A: N anchors preserved",
    "TASK B: added [texture 1] and [texture 2]",
    "TASK C: upgraded [phrase 1] and [phrase 2]",
    "TASK D: composition close"
  ],
  "charCount": 000,
  "tokenEstimate": 000
}

FINAL VALIDATION BEFORE RETURNING
Check all of the following before output:
- every anchor from the prompt is preserved or strengthened
- exactly 2 new textures were added
- exactly 2 sensory upgrades were made
- the prompt ends with a composition sentence
- the prose is 3 to 4 sentences
- the first 10 words contain the primary subject
- the result does not exceed ${ctx.maxChars ?? 1000} characters
- the output is valid JSON only`;

  return {
    systemPrompt,
    groupCompliance: enforceAdobeFireflyCleanup,
  };
}
