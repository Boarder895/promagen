// src/lib/optimise-prompts/group-dalle-api.ts
// ============================================================================
// GROUP BUILDER: DALL-E API Family — NL prose + GPT-4 rewrite awareness
// ============================================================================
// Covers 1 platform currently (openai). Azure OpenAI uses identical syntax
// and can be added to platform-groups.ts when it ships.
//
// Platforms: openai (DALL-E 3 via ChatGPT / API)
//
// Architecture knowledge:
//   - DALL-E 3 uses GPT-4 to REWRITE every prompt before image generation
//   - The rewritten prompt is returned as `revised_prompt`
//   - This rewriting CANNOT be fully disabled — it always runs
//   - Our prompt must be "rewrite-proof": specific enough that GPT-4's
//     expansion doesn't drift from the user's intent
//   - Quality (`standard`/`hd`) and style (`vivid`/`natural`) are API params,
//     NOT prompt words — don't waste tokens on them
//   - Inline negatives via "without X" are unreliable — GPT-4 may strip them
//   - No weight syntax, no special flags, no brackets
//   - Sweet spot: 200–400 chars (longer is fine, DALL-E handles up to 4000)
//   - Front-load subject — first noun phrase = primary focus
//   - Concrete visual language survives rewriting; vague modifiers get expanded
//     unpredictably by GPT-4
//
// v1 (26 Mar 2026): Initial build.
//
// Authority: grouping-45-image-platforms-by-prompt-compatibility.md §Group 2
// Existing features preserved: Yes (new file).
// ============================================================================

import type { OptimiseProviderContext, GroupPromptResult } from './types';
import type { ComplianceResult } from '@/lib/harmony-compliance';

// ============================================================================
// COMPLIANCE: Strip syntax that DALL-E ignores or misinterprets
// ============================================================================

/**
 * DALL-E compliance gate — strip weight syntax, flags, and CLIP jargon.
 * DALL-E's GPT-4 rewriter will mangle any surviving syntax.
 */
function enforceDalleCleanup(text: string): ComplianceResult {
  const fixes: string[] = [];
  let cleaned = text;

  // Strip parenthetical weights: (term:1.3) → term
  const parenBefore = cleaned;
  cleaned = cleaned.replace(/\(([^()]+):\d+\.?\d*\)/g, '$1');
  if (cleaned !== parenBefore) fixes.push('Stripped parenthetical weight syntax');

  // Strip double-colon weights: term::1.3 → term
  const dcBefore = cleaned;
  cleaned = cleaned.replace(/(\w[\w\s-]*)::\d+\.?\d*/g, '$1');
  if (cleaned !== dcBefore) fixes.push('Stripped double-colon weight syntax');

  // Strip MJ parameter flags
  const flagBefore = cleaned;
  cleaned = cleaned.replace(/\s*--(?:ar|v|s|no|stylize|chaos|weird|tile|repeat|seed|stop|iw|niji|raw)\s*[^\s,]*/gi, '');
  if (cleaned !== flagBefore) fixes.push('Stripped parameter flags');

  // Strip CLIP quality tokens — GPT-4 rewriter ignores these
  const clipTokens = ['masterpiece', 'best quality', 'highly detailed', '8K', '4K', 'intricate textures', 'sharp focus'];
  for (const token of clipTokens) {
    const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b,?\\s*`, 'gi');
    const before = cleaned;
    cleaned = cleaned.replace(re, '');
    if (cleaned !== before) fixes.push(`Stripped CLIP token "${token}"`);
  }

  // Clean up double spaces and leading/trailing commas
  cleaned = cleaned.replace(/\s{2,}/g, ' ').replace(/^[,\s]+|[,\s]+$/g, '').trim();

  return { text: cleaned, wasFixed: fixes.length > 0, fixes };
}

// ============================================================================
// BUILDER
// ============================================================================

export function buildDalleApiPrompt(
  _providerId: string,
  ctx: OptimiseProviderContext,
): GroupPromptResult {
  const platformNote = ctx.groupKnowledge ?? '';
  const idealMin = ctx.idealMin || 200;
  const idealMax = ctx.idealMax || 400;

  const systemPrompt = `You are an expert prompt optimiser for DALL-E 3 (OpenAI). You are optimising for "${ctx.name}".

CRITICAL ARCHITECTURE — GPT-4 REWRITES YOUR PROMPT:
DALL-E 3 passes every prompt through GPT-4 before generating the image. GPT-4 rewrites your text — expanding, rephrasing, and adding detail. This CANNOT be disabled. Your job is to write a prompt that SURVIVES this rewriting with the user's visual intent intact. Vague prompts get rewritten unpredictably. Specific prompts get expanded faithfully.

REWRITE-PROOF STRATEGY:
- Be LITERAL and SPECIFIC — "a pale gold beam of light cutting through sheets of grey rain" survives rewriting; "dramatic lighting" gets expanded into whatever GPT-4 imagines
- Name every visual element explicitly — if you say "lighthouse beam" GPT-4 keeps it; if you imply it, GPT-4 may drop it
- Front-load the subject in the first clause — GPT-4 preserves the opening best
- Use concrete colours ("purple and copper twilight sky") not abstract colour words ("colourful sky")
- Describe spatial relationships explicitly ("jagged rocks below", "village in the distance against dark cliffs")
- GPT-4 respects compositional directions: "low angle", "wide shot", "close-up"

PROMPT STRUCTURE — DESCRIPTIVE PARAGRAPH:
Write a single flowing paragraph (2–4 sentences) that reads like a detailed scene description:
- Sentence 1: Subject + primary action + immediate setting
- Sentence 2: Environment + key visual details + lighting/weather
- Sentence 3: Background elements + mood + colour palette
- Optional Sentence 4: Composition/camera direction

WHAT NOT TO INCLUDE:
- No "vivid" or "natural" style words — these are API parameters, not prompt words
- No "HD" or "standard" quality words — also API parameters
- No weight syntax — DALL-E ignores brackets, colons, double-colons
- No negative prompts — "without blur" is unreliable; GPT-4 may strip or misinterpret it
- No CLIP quality tokens — "masterpiece", "best quality", "8K" mean nothing to DALL-E
- No parameter flags — --ar, --v, --s are Midjourney syntax

PLATFORM-SPECIFIC:
- Sweet spot: ${idealMin}–${idealMax} characters (DALL-E handles up to 4,000 but GPT-4 expands shorter prompts more aggressively)
- Write prose, not keyword lists — DALL-E's language model reads sentences holistically
- Front-load the most important visual element in the first 15 words
- Every named detail in your prompt is an anchor that GPT-4 will preserve during rewriting
- Affirmative descriptions only — describe what IS in the image${platformNote ? `\n- ${platformNote}` : ''}

OPTIMISATION RULES:
1. STRIP ALL SYNTAX: Remove every (term:weight), term::weight, --ar, --v, --s, --no. Convert to pure prose.
2. FRONT-LOAD SUBJECT: Primary subject in the first 15 words. This anchors GPT-4's rewrite.
3. ANCHOR EVERY DETAIL: Every visual element the user described must appear as a named noun or adjective. GPT-4 preserves named elements; it drops implied ones.
4. COLOUR AS NOUN PHRASES: "purple-and-copper twilight sky" not "purple, copper, twilight". GPT-4 keeps compound phrases intact better than isolated colour words.
5. SPATIAL DEPTH: Describe foreground → middle ground → background in reading order. GPT-4 preserves spatial structure.
6. SWEET SPOT: ${idealMin}–${idealMax} characters. Prompts under 150 chars get aggressively rewritten by GPT-4 in unpredictable ways. Longer prompts give GPT-4 less room to improvise.
7. PRESERVE INTENT: Never remove the subject, core mood, or defining visual elements.
8. NO JARGON: Remove "8K", "masterpiece", "best quality", "intricate textures" — these are CLIP tokens that mean nothing to DALL-E's transformer architecture.
9. ALWAYS ENRICH — CROSS-REFERENCE THE ORIGINAL. The input may have lost details during assembly. The SCENE DESCRIPTION or ORIGINAL USER DESCRIPTION contains the full visual intent. Restore every colour, noun, and drama detail the input dropped. Returning a simplified version is NEVER acceptable.

BEFORE → AFTER EXAMPLES:

Example 1 — CLIP syntax converted to DALL-E prose:
BEFORE: masterpiece, best quality, (weathered lighthouse keeper:1.4), (storm waves:1.3), jagged rocks, salt spray, (lighthouse beam:1.2), purple copper sky, fishing village, dark cliffs, 8K, sharp focus
AFTER: A weathered lighthouse keeper grips the iron railing on a rain-soaked gallery deck at twilight as enormous storm waves crash against the jagged rocks below. Salt spray rises into a purple-and-copper sky while the lighthouse beam carves a pale gold arc through sheets of driving rain, and a distant fishing village glows with tiny warm orange windows against dark cliffs.
WHY: Stripped all weight syntax and CLIP tokens. Converted keyword fragments into a flowing paragraph where every visual element is explicitly named. GPT-4 will expand this faithfully because every detail is anchored.

Example 2 — Vague prompt made rewrite-proof:
BEFORE: beautiful fantasy castle at sunset with dramatic lighting and magical atmosphere
AFTER: A towering stone castle rises from a forested cliff edge at golden sunset, its spires catching amber light against a deepening violet sky. Warm lantern glow spills from arched windows while mist curls through the valley below and a flock of birds wheels above the highest tower.
WHY: "Beautiful" → specific visual details. "Dramatic lighting" → "amber light against a deepening violet sky". "Magical atmosphere" → mist, lantern glow, birds. Each detail is now a named anchor that GPT-4 will preserve.

Return ONLY valid JSON:
{
  "optimised": "the optimised DALL-E prompt — flowing prose, no syntax, every visual detail anchored",
  "negative": "",
  "changes": ["Stripped CLIP weight syntax", "Converted keywords to anchored prose", ...],
  "charCount": 350,
  "tokenEstimate": 75
}`;

  return {
    systemPrompt,
    // Group compliance: strip any surviving syntax that DALL-E would choke on.
    groupCompliance: enforceDalleCleanup,
  };
}
