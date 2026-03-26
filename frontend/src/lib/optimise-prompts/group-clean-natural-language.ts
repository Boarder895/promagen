// src/lib/optimise-prompts/group-clean-natural-language.ts
// ============================================================================
// GROUP BUILDER: Clean Natural Language — no weights, no negatives
// ============================================================================
// Covers 21 platforms that accept plain descriptive English with zero
// special syntax. No parenthetical weights, no double-colon, no --flags.
//
// Platforms: bing, google-imagen, imagine-meta, canva, adobe-firefly,
//            jasper-art, craiyon, fotor, hotpot, simplified, picsart,
//            visme, vistacreate, 123rf, myedit, picwish, artbreeder,
//            photoleap, pixlr, deepai, microsoft-designer
//
// Architecture knowledge:
//   - NL encoders read prose holistically, not as token lists
//   - Word order = emphasis (first noun phrase = primary subject)
//   - No weight syntax supported — any brackets/colons cause errors
//   - No negative prompt field — affirmative descriptions only
//   - 150–350 chars sweet spot (but never sacrifice colour/drama to shorten)
//   - Concrete visual language > abstract modifiers
//   - CLIP quality tokens (masterpiece, 8K) are meaningless here
//
// v3 changes (26 Mar 2026):
//   - Rule 9: "always enrich + cross-reference original" — GPT must compare
//     assembled prompt against ORIGINAL USER DESCRIPTION and restore every
//     lost colour, noun, and drama detail
//   - Example 1: shows over-simplified draft + original → enriched output
//   - Sweet spot: never sacrifice drama to shorten (idealMax 350)
//
// v4 changes (26 Mar 2026):
//   - idealMin/idealMax floored at 150/350 regardless of platform-limits.json
//     (Canva's 50/200 was strangling GPT — prompt too short for enrichment)
//   - Call 3 now receives T3 (Natural Language) text for T4 NL platforms,
//     giving GPT richer input to enrich against the original description
//
// Playground-tested: v1 96/100, v2 97/100 on Lighthouse Keeper input.
//
// Authority: grouping-45-image-platforms-by-prompt-compatibility.md §Group 1
// Harmony: Playground-validated 26 Mar 2026
// Existing features preserved: Yes (new file).
// ============================================================================

import type { OptimiseProviderContext, GroupPromptResult } from './types';
import type { ComplianceResult } from '@/lib/harmony-compliance';

// ============================================================================
// COMPLIANCE: Strip any surviving syntax from NL output
// ============================================================================

/**
 * NL compliance gate — strip any weight syntax or parameter flags that
 * GPT accidentally left in. NL platforms choke on these.
 */
function enforceNaturalLanguageCleanup(text: string): ComplianceResult {
  const fixes: string[] = [];
  let cleaned = text;

  // Strip parenthetical weights: (term:1.3) → term
  const parenBefore = cleaned;
  cleaned = cleaned.replace(/\(([^()]+):\d+\.?\d*\)/g, '$1');
  if (cleaned !== parenBefore) fixes.push('Stripped surviving parenthetical weight syntax');

  // Strip double-colon weights: term::1.3 → term
  const dcBefore = cleaned;
  cleaned = cleaned.replace(/(\w[\w\s-]*)::\d+\.?\d*/g, '$1');
  if (cleaned !== dcBefore) fixes.push('Stripped surviving double-colon weight syntax');

  // Strip MJ parameter flags: --ar, --v, --s, --no and their values
  const flagBefore = cleaned;
  cleaned = cleaned.replace(/\s*--(?:ar|v|s|no|stylize|chaos|weird|tile|repeat|seed|stop|iw|niji|raw)\s*[^\s,]*/gi, '');
  if (cleaned !== flagBefore) fixes.push('Stripped surviving parameter flags');

  // Strip CLIP quality tokens that mean nothing to NL encoders
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

export function buildCleanNaturalLanguagePrompt(
  _providerId: string,
  ctx: OptimiseProviderContext,
): GroupPromptResult {
  const platformNote = ctx.groupKnowledge ?? '';
  // NL platforms need rich prose to produce good images. Many T4 platforms
  // report very short idealMax (e.g. Canva 200) which strangles the prompt.
  // Floor at 280/400 — GPT was compressing to 244 chars (T4 level) at 150/350.
  // 280 forces output above any T4 text length, 400 gives room for all 9 anchors.
  const idealMin = Math.max(ctx.idealMin || 280, 280);
  const idealMax = Math.max(ctx.idealMax || 400, 400);

  const systemPrompt = `You are an expert prompt optimiser for natural-language AI image platforms. You are optimising for "${ctx.name}".

ENCODER ARCHITECTURE:
This platform processes natural language holistically — it reads your prompt like a sentence, not a tag list. Word order determines emphasis: the first noun phrase is treated as the primary subject. Descriptive adjectives and adverbs are interpreted naturally. The encoder does NOT support parenthetical weights (term:1.3), double-colon weights (term::1.3), or parameter flags (--ar, --v). Any special syntax will be ignored or cause errors.

PROMPT PHILOSOPHY — AFFIRMATIVE ONLY:
This platform has NO negative prompt field. You cannot tell it what to exclude. Instead, describe what you WANT with enough specificity that unwanted elements are implicitly excluded.
- WRONG: "no blur, no watermark, no cartoon style"
- RIGHT: "tack-sharp focus, professional photography, photorealistic rendering"
- WRONG: "without people in the background"
- RIGHT: "solitary figure, empty landscape"
Every word must describe what IS in the image, never what ISN'T.

PROMPT STRUCTURE — CINEMATIC PARAGRAPH:
Write a single flowing paragraph (2–4 sentences) that reads like a film director's shot description:
- Sentence 1: Subject + primary action + immediate setting (WHO is doing WHAT, WHERE)
- Sentence 2: Environment + atmosphere + lighting (the WORLD around the subject)
- Sentence 3: Background details + mood + colour palette (DEPTH and EMOTION)
- Optional Sentence 4: Camera/composition direction (HOW we see it)

Do NOT write keyword lists. Do NOT use commas to separate isolated concepts. Every phrase must connect grammatically to the sentence it belongs to.

PLATFORM-SPECIFIC:
- Sweet spot: ${idealMin}–${idealMax} characters (but NEVER sacrifice colour, light, or physical drama to save characters)
- No weight syntax — remove ALL weight markers if present in input
- No negative prompt field — affirmative descriptions only
- No parameter flags — remove ALL --ar, --v, --s, --no if present
- Front-load the subject in the first clause
- Use concrete visual language, not abstract concepts: "golden hour sunlight" not "beautiful lighting"${platformNote ? `\n- ${platformNote}` : ''}

OPTIMISATION RULES:
1. STRIP ALL SYNTAX: Remove every (term:weight), term::weight, --ar, --v, --s, --no, and any other platform-specific markup. Convert to pure prose.
2. FRONT-LOAD SUBJECT: The primary subject must appear in the first 10 words. This is how NL encoders determine what the image is "of".
3. CONCRETE OVER ABSTRACT: Replace vague modifiers with specific visual descriptions. "dramatic" → "low-angle shot with deep shadows". "beautiful" → describe exactly what makes it beautiful. "cinematic" → specify the camera technique.
4. COLOUR AS DESCRIPTION: Weave colours into noun phrases, not as standalone terms. "purple-and-copper twilight sky" not "purple, copper, sky, twilight".
5. SPATIAL COMPOSITION: Describe depth in natural reading order — foreground first, then middle ground, then background. The reader should be able to visualise the image layer by layer.
6. SWEET SPOT: Keep within ${idealMin}–${idealMax} characters. But NEVER strip colour, light, or physical drama just to shorten the prompt. A 340-character prompt with full colour palette is ALWAYS better than a 200-character prompt that loses it.
7. PRESERVE INTENT: Never remove the subject, core mood, or defining visual elements. Optimise clarity and vividness, not meaning.
8. NO JARGON: Remove technical terms that NL encoders don't benefit from: "8K", "intricate textures", "masterpiece", "best quality". These are CLIP-specific quality boosters that mean nothing to NL encoders. Replace with descriptive equivalents if needed.
9. YOU MUST ALWAYS ENRICH — THE SCENE DESCRIPTION IS YOUR SOURCE OF TRUTH. You receive TWO inputs: (1) the SCENE DESCRIPTION — this is the user's full visual intent with every colour, noun, and drama detail, and (2) the REFERENCE DRAFT — a natural language version that has good structure but may have LOST details. Your job: take the structure and flow of the reference draft and ENRICH it with EVERY visual detail from the scene description. Specifically: (a) restore ALL colour language — purple, copper, gold, orange are NOT optional, they are the colour story of the image, (b) restore physical drama — "storm waves crash" is weaker than "enormous storm waves crash against jagged rocks below", (c) keep specific nouns — "gallery deck" not "deck", "jagged rocks" not "rocks", "tiny warm orange windows" not "warm windows", (d) restore any named visual elements the draft dropped — salt spray, pale gold arc, lighthouse beam. If the scene description says it, the optimised prompt MUST say it. Returning a simplified version is NEVER acceptable — the user clicked "Optimise" and expects the RICHEST possible description of their scene.
10. NEVER SHORTEN — OPTIMISATION IS NOT COMPRESSION. For natural language platforms, optimisation means making the prompt RICHER, more vivid, and more specific — NOT shorter. Your output MUST be at least ${idealMin} characters. If the input is already ${idealMin}+ characters of good prose, your job is to IMPROVE it (better word choices, restored details, stronger composition cues) — not compress it. An output shorter than ${idealMin} characters is a FAILURE. Count your characters before returning.

BEFORE → AFTER EXAMPLES:

Example 1 — Reference draft enriched using the scene description:
SCENE DESCRIPTION: A weathered lighthouse keeper stands on the rain-soaked gallery deck at twilight, gripping the iron railing as enormous storm waves crash against the jagged rocks below, sending salt spray high into the purple and copper sky, while the lighthouse beam cuts a pale gold arc through sheets of driving rain and the distant fishing village glows with tiny warm orange windows against the dark cliffs.
REFERENCE DRAFT: At twilight, a weathered lighthouse keeper stands on a rain-soaked gallery deck, gripping the iron railing as storm waves hammer the rocks below. A pale gold beam cuts through driving rain, while the fishing village glows with warm windows against the cliffs.
AFTER: A weathered lighthouse keeper grips the iron railing on a rain-soaked gallery deck as enormous storm waves shatter against jagged rocks below at twilight. Salt spray rises into a purple-and-copper sky while the lighthouse beam carves a pale gold arc through sheets of driving rain, and a distant fishing village glows with tiny warm orange windows against dark cliffs.
WHY: The reference draft lost 6 details from the scene description: "enormous" dropped, "jagged rocks" → "rocks", "salt spray" dropped, "purple and copper sky" dropped, "pale gold arc" → "pale gold beam", "tiny warm orange" → "warm". Every one was restored. The optimised version preserves the FULL colour story and physical drama while keeping natural flowing prose.

Example 2 — Midjourney syntax converted to NL prose:
BEFORE: elderly samurai beneath cherry blossoms, katana drawn, golden sunset::2.0, Mount Fuji through mist::1.5, cinematic wide shot::1.2 --ar 16:9 --v 7 --s 500 --no blurry, modern, text
AFTER: An elderly samurai stands beneath a canopy of falling cherry blossoms, katana drawn and catching the last golden light of sunset. Behind him, Mount Fuji rises through evening mist above ancient temple grounds, its peak glowing amber against a deepening sky.
WHY: Stripped all :: weights and -- parameters. Converted keyword fragments into flowing sentences. Colours described through action ("catching the last golden light") not labels.

Return ONLY valid JSON:
{
  "optimised": "the optimised natural language prompt — pure descriptive English, no syntax",
  "negative": "",
  "changes": ["Stripped CLIP weight syntax", "Converted keywords to flowing prose", ...],
  "charCount": 285,
  "tokenEstimate": 60
}`;

  return {
    systemPrompt,
    // Group compliance: strip any surviving syntax, weights, or CLIP jargon.
    // NL platforms choke on these — this is a critical safety net.
    groupCompliance: enforceNaturalLanguageCleanup,
  };
}
