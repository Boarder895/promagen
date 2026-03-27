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
//
// Authority: grouping-45-image-platforms-by-prompt-compatibility.md §Dedicated
// Existing features preserved: Yes (new file).
// ============================================================================

import type { OptimiseProviderContext, GroupPromptResult } from './types';
import type { ComplianceResult } from '@/lib/harmony-compliance';

// ============================================================================
// COMPLIANCE: Strip non-Recraft syntax
// ============================================================================

function enforceRecraftCleanup(text: string): ComplianceResult {
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

  // Clean up
  cleaned = cleaned.replace(/\s{2,}/g, ' ').replace(/^[,\s]+|[,\s]+$/g, '').trim();

  return { text: cleaned, wasFixed: fixes.length > 0, fixes };
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
  const idealMax = ctx.idealMax || 350;

  const systemPrompt = `You optimise image prompts for Recraft. Strip all weight syntax and CLIP tokens. Output clean prose.

You receive a SCENE DESCRIPTION (source of truth) and a REFERENCE DRAFT (may have lost details).

Do these 3 things. Each is mandatory.

TASK A — REWRITE WITH EVERY ANCHOR
Copy every visual element from the scene description into your output. Use the EXACT words:
- "gallery deck" not "deck"
- "enormous storm waves" not "huge waves" or "waves"
- "jagged rocks" not "rocks"
- "salt spray" must appear
- "purple" AND "copper" must both appear
- "pale gold arc" not just "beam"
- "sheets of driving rain" not just "rain"
- "tiny warm orange windows" — all three adjectives
- "dark cliffs" not just "cliffs"
If you weaken or drop ANY of these, your output is rejected.

TASK B — ADD 2 TEXTURES
Add exactly 2 material descriptions that are NOT in the original. Pick from: salt-crusted iron, rain-slicked stone, barnacle-covered rocks, lichen-spotted granite, weathered copper housing, spray-misted glass. Or invent plausible ones.

TASK C — END WITH COMPOSITION
Your last sentence must specify camera angle + framing + depth. Example: "Low-angle wide shot with layered depth from the storm-lashed deck through spray-filled air to the glowing village beneath dark cliff faces."

ALSO GENERATE A NEGATIVE PROMPT: 3 generic (blurry, watermark, low quality) + 5 scene-specific (calm sea, daytime, clear sky, modern buildings, extra people, flat lighting).

Output 3–4 sentences, minimum ${idealMin} characters, sweet spot ${idealMin}–${idealMax}. Start with "A cinematic photorealistic scene of..."${platformNote ? `\n${platformNote}` : ''}

Return ONLY valid JSON:
{
  "optimised": "your rewritten prompt",
  "negative": "negative prompt",
  "changes": ["TASK A: 9/9 anchors", "TASK B: added X and Y", "TASK C: composition added"],
  "charCount": 400,
  "tokenEstimate": 80
}`;
  return {
    systemPrompt,
    groupCompliance: enforceRecraftCleanup,
  };
}
