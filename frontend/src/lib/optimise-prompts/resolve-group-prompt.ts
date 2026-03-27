// src/lib/optimise-prompts/resolve-group-prompt.ts
// ============================================================================
// GROUP PROMPT ROUTER — Resolves provider → group → system prompt
// ============================================================================
// Single entry point for Call 3 (optimise-prompt/route.ts).
// Looks up the provider's group, calls the right builder, returns the result.
//
// New groups are added by:
//   1. Creating a new builder file (e.g., group-midjourney.ts)
//   2. Adding the group ID to the switch below
//   3. Adding provider mappings in platform-groups.ts
//
// Authority: grouping-45-image-platforms-by-prompt-compatibility.md
// Used by: src/app/api/optimise-prompt/route.ts
// Existing features preserved: Yes (new file).
// ============================================================================

import type { OptimiseProviderContext, GroupPromptResult } from './types';
import { getProviderGroup } from './platform-groups';
import { buildSdClipParentheticalPrompt } from './group-sd-clip-parenthetical';
import { buildSdClipDoubleColonPrompt } from './group-sd-clip-double-colon';
import { buildMidjourneyPrompt } from './group-midjourney';
import { buildCleanNaturalLanguagePrompt } from './group-clean-natural-language';
import { buildDalleApiPrompt } from './group-dalle-api';
import { buildFluxArchitecturePrompt } from './group-flux-architecture';
import { buildVideoCinematicPrompt } from './group-video-cinematic';
import { buildNovelAiPrompt } from './group-novelai';
import { buildIdeogramPrompt } from './group-ideogram';
import { buildRecraftPrompt } from './group-recraft';
import { buildGenericFallbackPrompt } from './generic-fallback';

/**
 * Resolve the optimal system prompt for a provider.
 *
 * Checks the provider's group, calls the group-specific builder if one exists,
 * otherwise falls through to the generic fallback.
 *
 * @param providerId - The provider slug (e.g., 'stability', 'midjourney')
 * @param ctx - Provider context from the client (sweet spot, limits, etc.)
 * @returns System prompt string + optional group-specific compliance gate
 */
export function resolveGroupPrompt(
  providerId: string,
  ctx: OptimiseProviderContext,
): GroupPromptResult {
  const group = getProviderGroup(providerId);

  switch (group) {
    // ── SD CLIP Parenthetical (5 platforms) ────────────────────────────
    case 'sd-clip-parenthetical':
      return buildSdClipParentheticalPrompt(providerId, ctx);

    // ── Wave 2: SD CLIP Double-Colon (Leonardo) ─────────────────────
    case 'sd-clip-double-colon':
      return buildSdClipDoubleColonPrompt(providerId, ctx);

    // ── Wave 3: Midjourney Dedicated ────────────────────────────────
    case 'midjourney':
      return buildMidjourneyPrompt(providerId, ctx);

    // ── Clean Natural Language (25 platforms) ───────────────────────────
    case 'clean-natural-language':
      return buildCleanNaturalLanguagePrompt(providerId, ctx);

    // ── Wave 5: DALL-E API (OpenAI) ─────────────────────────────────
    case 'dalle-api':
      return buildDalleApiPrompt(providerId, ctx);

    // ── Wave 6: Flux Architecture (Black Forest Labs) ────────────────
    case 'flux-architecture':
      return buildFluxArchitecturePrompt(providerId, ctx);

    // ── Wave 7: Video Cinematic (Runway, Luma, Kling) ────────────────
    case 'video-cinematic':
      return buildVideoCinematicPrompt(providerId, ctx);

    // ── Wave 8: Dedicated Platforms ──────────────────────────────────
    case 'novelai':
      return buildNovelAiPrompt(providerId, ctx);

    case 'ideogram':
      return buildIdeogramPrompt(providerId, ctx);

    case 'recraft':
      return buildRecraftPrompt(providerId, ctx);

    // ── Fallback: tier-based generic (the original buildSystemPrompt) ─
    default:
      return buildGenericFallbackPrompt(providerId, ctx);
  }
}
