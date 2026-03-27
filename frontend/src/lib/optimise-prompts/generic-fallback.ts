// src/lib/optimise-prompts/generic-fallback.ts
// ============================================================================
// GENERIC FALLBACK — Tier-based system prompt (the original buildSystemPrompt)
// ============================================================================
// Used for platforms that haven't been assigned a group-specific template yet.
// This is the EXACT same logic that was in optimise-prompt/route.ts before the
// group system was introduced. It works — just not as well as group-specific
// templates for platforms with unique architecture.
//
// As each wave is built, fewer platforms fall through to this.
// When all 18 templates are built, this only fires for truly unknown providers.
//
// Authority: ai-disguise.md §6 (original Call 3)
// Existing features preserved: Yes (moved, not modified).
// ============================================================================

import type { OptimiseProviderContext, GroupPromptResult } from './types';

const TIER_DISPLAY: Record<number, string> = {
  1: 'CLIP-Based (weighted keywords)',
  2: 'Midjourney Family (prose + parameters)',
  3: 'Natural Language (grammatical sentences)',
  4: 'Plain Language (simple, short)',
};

export function buildGenericFallbackPrompt(
  _providerId: string,
  ctx: OptimiseProviderContext,
): GroupPromptResult {
  const tierName = TIER_DISPLAY[ctx.tier] ?? 'Unknown';
  const categoryOrderStr = ctx.categoryOrder?.join(' → ') ?? 'subject → style → environment → lighting → atmosphere → fidelity';
  const weightNote = ctx.supportsWeighting
    ? `WEIGHT SYNTAX (MANDATORY): Use EXACTLY this syntax: ${ctx.weightingSyntax ?? '(term:weight)'}. Do NOT substitute parentheses for double-colon or vice versa. Distribute weights: subject highest (1.3–1.4), supporting 1.0–1.2, filler unweighted. Rich phrases longer than 4 words must NOT be weight-wrapped — break them into shorter weighted terms instead.`
    : 'This platform does NOT support weight syntax — remove all weight markers.';

  const qualitySuffix = ctx.tier === 1 ? '\n- Quality suffix (append at end): sharp focus, 8K, intricate textures' : '';

  const systemPrompt = `You are an expert prompt optimiser for the AI image generation platform "${ctx.name}".

Your job is to take an assembled prompt and optimise it specifically for ${ctx.name}, which is a Tier ${ctx.tier} platform: ${tierName}.

PLATFORM SPECIFICATIONS:
- Prompt style: ${ctx.promptStyle}
- Sweet spot: ${ctx.idealMin}–${ctx.idealMax} characters
- Token limit: ${ctx.tokenLimit}
${ctx.maxChars ? `- Hard character limit: ${ctx.maxChars}` : '- No hard character limit'}
- ${weightNote}
${ctx.qualityPrefix?.length ? `- Quality prefix: ${ctx.qualityPrefix.join(', ')}` : '- No quality prefix defined'}${qualitySuffix}
- Category impact priority: ${categoryOrderStr}
- Negative handling: ${ctx.negativeSupport}

OPTIMISATION RULES:
0. SYNTAX VALIDATION FIRST: Check whether every weighted term uses the CORRECT weight syntax for ${ctx.name}. The correct syntax is: ${ctx.weightingSyntax ?? '(term:weight)'}. Wrong syntax = broken prompt.
1. Reorder terms by platform-specific impact priority: ${categoryOrderStr}. Front-load high-impact categories.
2. Remove redundant or duplicate semantic content.
3. Remove orphaned verb fragments — sentence debris in keyword prompts.
4. Remove filler tokens that dilute model attention.
5. Strengthen quality anchors appropriate to this platform.
6. Ensure the final prompt is within the sweet spot (${ctx.idealMin}–${ctx.idealMax} characters).
7. For CLIP/keyword platforms (Tier 1): output must be clean comma-separated weighted keywords.
8. For Midjourney (Tier 2): ensure --ar, --v, --s, --no parameters are correctly formatted.
9. For natural language platforms (Tier 3): ensure grammatical coherence.
10. For plain platforms (Tier 4): keep it short, simple, and impactful. Maximum 2–3 sentences.
11. PRESERVE the user's core creative intent.
12. List every change made in the "changes" array.
13. CRITICAL: The output weight syntax MUST match exactly: ${ctx.weightingSyntax ?? '(term:weight)'}.
14. YOU MUST ALWAYS MAKE AT LEAST ONE CHANGE.

Return ONLY valid JSON:
{
  "optimised": "the optimised prompt text",
  "negative": "the optimised negative prompt (if applicable, empty string if not)",
  "changes": ["change 1", "change 2", ...],
  "charCount": 285,
  "tokenEstimate": 72
}`;
  return { systemPrompt };
}
