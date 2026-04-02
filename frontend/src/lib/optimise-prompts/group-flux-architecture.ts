// src/lib/optimise-prompts/group-flux-architecture.ts
// ============================================================================
// GROUP BUILDER: Flux Architecture — T5-XXL encoder, prose-only
// ============================================================================
// Covers 1 platform currently: flux (Black Forest Labs, via Replicate/ComfyUI).
//
// Platforms: flux
//
// Architecture knowledge:
//   - Uses T5-XXL text encoder (NOT CLIP) — understands full sentences,
//     grammar, and complex descriptions far better than tag-based encoders
//   - SD-style tags and parenthetical weights are COUNTERPRODUCTIVE —
//     T5 reads them as literal text, not emphasis markers
//   - Word order = emphasis: first noun phrase = primary subject
//   - No negative prompt support on Flux 1 models (Dev, Schnell, Pro)
//   - Flux 2 Klein has limited negative support — but assume none for safety
//   - 512 tokens (Flux 1) / 32K tokens (Flux 2) context window
//   - guidance_scale defaults to 3.5 (vs SD's 7) — model follows prompt
//     more faithfully, so precision matters more than emphasis tricks
//   - Best-in-class photorealism and text rendering in images
//   - Concrete descriptive prose > abstract modifiers
//   - Colour described naturally ("purple-and-copper twilight sky") works
//     better than colour lists
//
// v1 (26 Mar 2026): Initial build.
// v2 (02 Apr 2026): Phase 2 rewrite — preservation-first image-NL template.
//   Removed "TEXTURE MINIMUM: Include at least 3 material/texture descriptions"
//   and all material invention examples. Removed before/after examples that
//   demonstrated and encouraged adding invented content. Preserved all T5-XXL
//   architecture knowledge. Added explicit bans: no invented textures, no
//   composition scaffolding, no synonym churn. Enrichment conditional only
//   when source prompt is genuinely thin.
//   Evidence: Batch 2 test scored 76/100 (delta -13) due to "Cinematic
//   photorealism with rich atmospheric depth and natural textures" filler
//   and over-enriched editorial prose driven by texture minimum rule.
//
// Authority: grouping-45-image-platforms-by-prompt-compatibility.md §Group 5
// Existing features preserved: Yes. Compliance function unchanged.
// ============================================================================

import type { OptimiseProviderContext, GroupPromptResult } from './types';
import type { ComplianceResult } from '@/lib/harmony-compliance';

// ============================================================================
// COMPLIANCE: Strip syntax T5-XXL reads literally + enforce platform limit (v4)
// ============================================================================

const DANGLING_END_WORDS =
  /\b(?:and|or|with|without|behind|before|after|over|under|through|into|onto|from|to|of|in|on|at|as|while|amid|beneath)\b$/i;

function cleanText(text: string): string {
  return text.replace(/\s{2,}/g, ' ').replace(/^[,\s]+|[,\s]+$/g, '').trim();
}

function pruneDangling(text: string): string {
  let out = cleanText(text);
  let guard = 0;
  while (DANGLING_END_WORDS.test(out) && guard < 3) {
    out = out.replace(DANGLING_END_WORDS, '').trim();
    out = cleanText(out);
    guard += 1;
  }
  return out;
}

function hardTrimAtComma(text: string, ceiling: number): string {
  if (text.length <= ceiling) return text;
  const slice = text.slice(0, ceiling + 1);
  const lastComma = slice.lastIndexOf(',');
  const lastSemicolon = slice.lastIndexOf(';');
  const lastPeriod = slice.lastIndexOf('.');
  const best = Math.max(lastComma, lastSemicolon, lastPeriod);
  const floorPos = Math.floor(ceiling * 0.6);
  if (best > floorPos) return pruneDangling(slice.slice(0, best));
  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace > floorPos) return pruneDangling(slice.slice(0, lastSpace));
  return pruneDangling(text.slice(0, ceiling));
}

/**
 * Flux compliance gate factory (v4 pattern).
 * T5-XXL reads weight syntax and flags as literal text — must strip.
 * Negative phrasing: soft warning only (was destructive regex in v3).
 * Enforces maxChars only — does NOT trim to idealMax.
 */
function createFluxCompliance(
  idealMin: number,
  idealMax: number,
  hardCeiling: number,
): (text: string) => ComplianceResult {
  return function enforceFluxCleanup(text: string): ComplianceResult {
    const fixes: string[] = [];
    let cleaned = text;

    // Strip parenthetical weights: (term:1.3) → term
    const parenBefore = cleaned;
    cleaned = cleaned.replace(/\(([^()]+):\d+\.?\d*\)/g, '$1');
    if (cleaned !== parenBefore) fixes.push('Stripped parenthetical weight syntax (T5 reads as literal text)');

    // Strip double-colon weights: term::1.3 → term
    const dcBefore = cleaned;
    cleaned = cleaned.replace(/(\w[\w\s-]*)::\d+\.?\d*/g, '$1');
    if (cleaned !== dcBefore) fixes.push('Stripped double-colon weight syntax');

    // Strip MJ parameter flags — T5 would render these as text in the image
    const flagBefore = cleaned;
    cleaned = cleaned.replace(/\s*--(?:ar|v|s|no|stylize|chaos|weird|tile|repeat|seed|stop|iw|niji|raw)\s*[^\s,]*/gi, '');
    if (cleaned !== flagBefore) fixes.push('Stripped parameter flags (would appear as text in image)');

    // Strip CLIP quality tokens — T5 doesn't benefit from these
    const clipTokens = ['masterpiece', 'best quality', 'highly detailed', '8K', '4K', 'intricate textures', 'sharp focus'];
    for (const token of clipTokens) {
      const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b,?\\s*`, 'gi');
      const before = cleaned;
      cleaned = cleaned.replace(re, '');
      if (cleaned !== before) fixes.push(`Stripped CLIP token "${token}" (meaningless to T5 encoder)`);
    }

    // Strip SD-style quality boosters that T5 reads literally
    const sdTokens = ['worst quality', 'low quality', 'normal quality', 'bad anatomy', 'bad hands'];
    for (const token of sdTokens) {
      const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b,?\\s*`, 'gi');
      const before = cleaned;
      cleaned = cleaned.replace(re, '');
      if (cleaned !== before) fixes.push(`Stripped SD negative token "${token}"`);
    }

    cleaned = cleanText(cleaned);

    // Soft warning: negative phrasing (negativeSupport: none)
    // v4 change: was destructive regex that mangled prompts.
    // Now detection + warning only. System prompt already instructs
    // GPT to use affirmative language.
    if (/\b(?:without|no|avoid|exclude|not)\s+\w/i.test(cleaned)) {
      fixes.push('Contains negative phrasing — Flux does not support negatives and T5 may render excluded words as text');
    }

    // Enforce maxChars only (v4 pattern)
    if (cleaned.length > hardCeiling) {
      const before = cleaned.length;
      cleaned = hardTrimAtComma(cleaned, hardCeiling);
      fixes.push(`Trimmed to platform limit (${before} -> ${cleaned.length}/${hardCeiling})`);
    } else if (cleaned.length > idealMax) {
      fixes.push(`Above ideal range (${cleaned.length}/${idealMax} chars) — platform limit is ${hardCeiling}`);
    }

    // Diagnostics
    if (cleaned.length > 0 && cleaned.length < idealMin) {
      fixes.push(`Below ideal minimum (${cleaned.length}/${idealMin} chars)`);
    } else if (cleaned.length >= idealMin && cleaned.length <= idealMax) {
      fixes.push(`Good density for Flux (${cleaned.length} chars)`);
    }

    return { text: cleaned, wasFixed: fixes.length > 0, fixes };
  };
}

// ============================================================================
// BUILDER
// ============================================================================

export function buildFluxArchitecturePrompt(
  _providerId: string,
  ctx: OptimiseProviderContext,
): GroupPromptResult {
  const platformNote = ctx.groupKnowledge ?? '';
  const idealMin = ctx.idealMin || 300;
  const idealMax = ctx.idealMax || 500;
  const hardCeiling = ctx.maxChars ?? 1250;

  const systemPrompt = `You are an expert prompt optimiser for Flux (Black Forest Labs). You are optimising for "${ctx.name}".

CRITICAL ARCHITECTURE — T5-XXL ENCODER (NOT CLIP):
Flux uses the T5-XXL text encoder. This is fundamentally different from Stable Diffusion's CLIP encoder. T5-XXL reads your prompt like a language model reads a paragraph — it understands grammar, sentence structure, spatial relationships, and descriptive prose. This means:
- Full sentences produce BETTER results than comma-separated tags
- Parenthetical weights (word:1.3) are read as LITERAL TEXT and may appear in the image
- Parameter flags (--ar, --v) are read as LITERAL TEXT and will corrupt the output
- Word order determines emphasis: the first noun phrase = the primary subject
- T5 understands adjective-noun binding: "enormous storm waves" is one concept, not three separate tags
- Complex spatial descriptions work perfectly
- guidance_scale is 3.5 (vs SD's 7) — the model follows your prompt more faithfully, so PRECISION matters more than emphasis tricks

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
1. Move the primary subject to the first 10 words if it is not already there (T5 gives strongest attention to the opening)
2. Break overlong run-on sentences into clearer shorter sentences that each describe a visual layer (foreground, environment, lighting, background) — T5 preserves this spatial structure
3. Remove any leftover weight syntax, CLIP tokens, SD tokens, or parameter flags (T5 reads these as literal text)
4. Convert any negative phrasing ("without X", "no X", "avoid X") to affirmative descriptions or remove entirely — Flux does not support negatives and T5 may render excluded words as literal text in the image
You must NOT:
- Replace any verb with a synonym
- Rearrange adjective-noun phrases
- Add any content not present in the original (no textures, no materials, no composition cues, no camera angles, no mood filler, no style tags like "cinematic photorealism")
- Remove any content from the original
- Add a composition or framing sentence at the end

TASK C — CONDITIONAL ENRICHMENT (only when source is thin)
If and ONLY if the assembled prompt has fewer than 3 sentences or fewer than 150 characters, you may add up to 2 specific visual details that are physically plausible for the scene. Flux excels at photorealism, so concrete surface descriptions ("weathered stone", "wet wooden deck") are most effective. Otherwise, do NOT add anything — a well-written assembled prompt is already strong for T5-XXL.

WHAT NOT TO INCLUDE:
- No weight syntax — (word:1.3) appears as literal text in the image
- No parameter flags — --ar, --v, --s will appear as text artifacts
- No negative prompts — describe what IS, not what ISN'T
- No CLIP quality tokens — "masterpiece", "best quality", "8K" are meaningless to T5
- No keyword lists — T5 treats comma-separated tags as a broken sentence
- No style-direction sentences like "Cinematic photorealism with rich atmospheric depth"
- No "Photorealistic coastal photography" or similar trailing style tags

OUTPUT REQUIREMENTS:
- Flowing natural language prose (T5 reads this best)
- Front-load the primary subject in the first 10 words
- Affirmative descriptions only
${platformNote ? `\nPLATFORM NOTE: ${platformNote}` : ''}

LENGTH RULES:
HARD: Do not shorten any prompt that is below ${hardCeiling} characters.
SOFT: You may lengthen up to ${hardCeiling} characters ONLY if adding a genuine visual anchor to a thin prompt.

Return ONLY valid JSON:
{
  "optimised": "your output — same words as input, better structure for T5-XXL",
  "negative": "",
  "changes": ["moved subject to front", "stripped CLIP tokens", "converted tags to prose"],
  "charCount": 420,
  "tokenEstimate": 90
}`;
  return {
    systemPrompt,
    // v4 pattern: gate enforces maxChars (2000), NOT idealMax (500).
    // Destructive negative stripping replaced with soft warning.
    groupCompliance: createFluxCompliance(idealMin, idealMax, hardCeiling),
  };
}
