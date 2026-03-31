// src/lib/optimise-prompts/group-recraft.ts
// ============================================================================
// GROUP BUILDER: Recraft Dedicated — design-first, SVG + style taxonomy
// ============================================================================
// Covers 1 platform: recraft
//
// Architecture knowledge:
//   - Unique SVG vector output capability (no other platform does this)
//   - Hierarchical style/substyle taxonomy: realistic_image/b_and_w,
//     vector_illustration/line_art, etc. — 25+ options
//   - Text positioning control: exact positions and sizes via drag-and-drop
//   - "Artistic level" slider INVERTS usual paradigm: LOWER = more prompt
//     adherence, HIGHER = more artistic freedom
//   - Design-focused: understands composition grids, typography, branding
//   - Separate negative prompt field supported
//   - Natural language prose, not tags
//   - Excels at: vector art, icons, logos, illustrations, design assets
//
// v1 (26 Mar 2026): Initial build.
// v2 (26 Mar 2026): Dynamic Negative Intelligence. Zero-anchor-loss rule.
//   idealMin raised 150→200 to prevent over-compression. Spatial depth rule added.
// v3 (26 Mar 2026): Restructured system prompt — front-loaded RULE ZERO (anchor
//   preservation) above all other rules. Added PRE-FLIGHT CHECK before JSON return.
//   Reduced from 9 numbered rules to 4 clear rules + negative section. Trimmed
//   style taxonomy (GPT was ignoring it). 3-sentence depth structure made explicit.
// v5 (26 Mar 2026): SHARP & SHORT. Stripped to 3 tasks (A: anchor rewrite with
//   EXACT words listed, B: 2 textures, C: composition close). No decorative
//   formatting, no explanations. Running on gpt-5.4 full model. Hypothesis:
//   shorter prompt + bigger model = better instruction following.
// v6 (27 Mar 2026): Scene-agnostic rewrite. v5 hardcoded Lighthouse-specific
//   anchors and textures — scored 95 on test input but fails any other scene.
//   TASK A now instructs GPT to extract anchors from the actual scene description
//   dynamically rather than checking a hardcoded list. TASK B texture pool removed —
//   GPT invents 2 plausible material descriptions per scene. Negative prompt now
//   uses full Dynamic Negative Intelligence (7 failure-mode categories) instead of
//   hardcoded Lighthouse negatives. Forced opener removed. idealMax fallback
//   updated 350→400 to match platform-config.json fix.
//
// Authority: grouping-45-image-platforms-by-prompt-compatibility.md §Dedicated
// Existing features preserved: Yes.
// ============================================================================

import type { OptimiseProviderContext, GroupPromptResult } from './types';
import type { ComplianceResult } from '@/lib/harmony-compliance';

// ============================================================================
// COMPLIANCE: Strip non-Recraft syntax + enforce platform limit (v4 pattern)
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

function createRecraftCompliance(
  idealMin: number,
  idealMax: number,
  hardCeiling: number,
): (text: string) => ComplianceResult {
  return function enforceRecraftCleanup(text: string): ComplianceResult {
    const fixes: string[] = [];
    let cleaned = text;

    // Strip parenthetical weights
    const parenBefore = cleaned;
    cleaned = cleaned.replace(/\(([^()]+):\d+\.?\d*\)/g, '$1');
    if (cleaned !== parenBefore) fixes.push('Stripped parenthetical weight syntax');

    // Strip double-colon weights
    const dcBefore = cleaned;
    cleaned = cleaned.replace(/(\w[\w\s-]*)::\d+\.?\d*/g, '$1');
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

    cleaned = cleanText(cleaned);

    // Enforce maxChars only (v4 pattern — gate does NOT trim to idealMax)
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
      fixes.push(`Good density for Recraft (${cleaned.length} chars)`);
    }

    return { text: cleaned, wasFixed: fixes.length > 0, fixes };
  };
}

// ============================================================================
// BUILDER
// ============================================================================

export function buildRecraftPrompt(
  _providerId: string,
  ctx: OptimiseProviderContext,
): GroupPromptResult {
  const platformNote = ctx.groupKnowledge ?? '';
  const idealMin = ctx.idealMin || 200;
  const idealMax = ctx.idealMax || 400;
  const hardCeiling = ctx.maxChars ?? 1500;

  const systemPrompt = `You optimise image prompts for Recraft. Strip all weight syntax and CLIP tokens. Output clean photorealistic prose.

You receive a SCENE DESCRIPTION (source of truth) and a REFERENCE DRAFT (starting point that may have lost details).

Do these 3 tasks. All are mandatory.

TASK A — ZERO ANCHOR LOSS
Before writing anything, scan the SCENE DESCRIPTION and identify every named visual element: subjects, objects, colours, textures, spatial relationships, lighting qualities, and atmospheric details.
Every one of those elements MUST appear in your output using the EXACT words or a stronger, more specific version. You may NEVER:
- Replace a specific noun with a vaguer one ("enormous storm waves" → "waves" is a FAILURE)
- Drop a named colour — every named colour in the scene must appear in your output
- Remove a descriptive compound — every adjective in a noun phrase must survive ("tiny warm orange windows" loses nothing)
- Summarise multiple anchors into one vague phrase
If your output contains fewer named elements than the scene description, it is rejected.

TASK B — ADD 2 MATERIAL TEXTURES
Add exactly 2 material/surface descriptions that are NOT already in the scene description. Invent plausible textures that belong in this specific scene — they must fit the subject matter, era, and environment. Generic textures ("smooth surface", "rough texture") are not acceptable. Be specific: "salt-crusted iron railing", "lichen-spotted granite", "rain-slicked cobblestones", "sun-bleached driftwood", "tarnished brass fittings" — the level of specificity depends entirely on the scene.

TASK C — COMPOSITION CLOSE
Your final sentence must specify: camera angle + framing + spatial depth layers. Create a clear sense of how the viewer is positioned relative to the scene — foreground, middle ground, background in that order.

NEGATIVE PROMPT — DYNAMIC NEGATIVE INTELLIGENCE:
Analyse the positive prompt and generate scene-specific negatives. Do NOT use generic boilerplate as the majority.

FAILURE-MODE CATEGORIES (apply ALL that match this scene):
1. MOOD INVERSION: If stormy/dramatic → "calm, peaceful, sunny, clear sky". If serene → "chaos, fire, destruction".
2. ERA CONTAMINATION: If historical/period → "modern buildings, contemporary clothing, cars, power lines". If futuristic → "medieval, rustic, old-fashioned".
3. SUBJECT CORRUPTION: If solitary figure → "crowd, extra people, duplicate figures". If group → "empty, deserted".
4. COLOUR DRIFT: If warm palette (copper/gold/amber/orange) → "cool blue tones, grey monotone, green cast". If cool → "warm orange cast, sepia".
5. ATMOSPHERE COLLAPSE: If dramatic/moody → "flat lighting, overexposed, mundane composition". If bright/cheerful → "dark, gloomy, ominous".
6. SCALE DISTORTION: If grand/epic → "miniature, claustrophobic, tight crop". If intimate → "aerial view, wide establishing shot".
7. MEDIUM MISMATCH: If photorealistic → "cartoon, anime, sketch, illustration". If artistic → "photographic, stock photo".

NEGATIVE FORMAT: 3 generic quality terms (blurry, watermark, low quality) + minimum 4 scene-specific terms from the failure-mode analysis above.
Total: 8–12 terms. Never duplicate a term from the positive prompt.

OUTPUT REQUIREMENTS:
- 3–4 sentences of flowing photorealistic prose
- Minimum ${idealMin} characters, sweet spot ${idealMin}–${idealMax}
- No weight syntax, no CLIP tokens, no parameter flags${platformNote ? `\n- ${platformNote}` : ''}

Return ONLY valid JSON:
{
  "optimised": "your rewritten prompt — all scene anchors present, 2 new textures, composition close at the end",
  "negative": "scene-specific negative prompt",
  "changes": ["TASK A: all anchors preserved", "TASK B: added [texture 1] and [texture 2]", "TASK C: composition close added", ...],
  "charCount": 350,
  "tokenEstimate": 75
}`;
  return {
    systemPrompt,
    groupCompliance: createRecraftCompliance(idealMin, idealMax, hardCeiling),
  };
}
