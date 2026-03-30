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
// ── Active builders ─────────────────────────────────────────────────
import { buildSdClipDoubleColonPrompt } from './group-sd-clip-double-colon';
import { buildMidjourneyPrompt } from './group-midjourney';
import { buildDalleApiPrompt } from './group-dalle-api';
import { buildFluxArchitecturePrompt } from './group-flux-architecture';
import { buildNovelAiPrompt } from './group-novelai';
import { buildIdeogramPrompt } from './group-ideogram';
import { buildRecraftPrompt } from './group-recraft';
// ── T3 Dedicated NL Builders (v6.1) ──────────────────────────────────
import { buildBingPrompt } from './group-nl-bing';
import { buildGoogleImagenPrompt } from './group-nl-google-imagen';
import { buildImagineMetaPrompt } from './group-nl-imagine-meta';
import { buildCanvaPrompt } from './group-nl-canva';
import { buildAdobeFireflyPrompt } from './group-nl-adobe-firefly';
import { buildSimplifiedPrompt } from './group-nl-simplified';
import { buildVismePrompt } from './group-nl-visme';
import { buildVistacreatePrompt } from './group-nl-vistacreate';
import { build_123rfPrompt } from './group-nl-123rf';
import { buildMyeditPrompt } from './group-nl-myedit';
import { buildArtbreederPrompt } from './group-nl-artbreeder';
import { buildPixlrPrompt } from './group-nl-pixlr';
import { buildDeepaiPrompt } from './group-nl-deepai';
import { buildPlaygroundPrompt } from './group-nl-playground';
// ── T4 Dedicated NL Builders (v6.2) ──────────────────────────────────
import { buildJasperArtPrompt } from './group-nl-jasper-art';
import { buildCraiyonPrompt } from './group-nl-craiyon';
import { buildHotpotPrompt } from './group-nl-hotpot';
import { buildPicsartPrompt } from './group-nl-picsart';
import { buildPicwishPrompt } from './group-nl-picwish';
import { buildPhotoleapPrompt } from './group-nl-photoleap';
import { buildMicrosoftDesignerPrompt } from './group-nl-microsoft-designer';
import { buildArtguruPrompt } from './group-nl-artguru';
import { buildArtistlyPrompt } from './group-nl-artistly';
import { buildClipdropPrompt } from './group-nl-clipdrop';
import { buildBluewillowPrompt } from './group-nl-bluewillow';
// ── SD CLIP Dedicated Builders (v6.3) ────────────────────────────────
import { buildStabilityPrompt } from './group-stability';
import { buildDreamlikePrompt } from './group-dreamlike';
import { buildDreamstudioPrompt } from './group-dreamstudio';
import { buildFotorPrompt } from './group-fotor';
import { buildLexicaPrompt } from './group-lexica';
// ── Video Dedicated Builders (v6.3) ──────────────────────────────────
import { buildRunwayPrompt } from './group-runway';
import { buildLumaAiPrompt } from './group-luma-ai';
import { buildKlingPrompt } from './group-kling';
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
    // ══════════════════════════════════════════════════════════════════
    // SD CLIP DEDICATED (v6.3 — 5 platforms, each independent)
    // ══════════════════════════════════════════════════════════════════
    case 'stability-dedicated':
      return buildStabilityPrompt(providerId, ctx);
    case 'dreamlike-dedicated':
      return buildDreamlikePrompt(providerId, ctx);
    case 'dreamstudio-dedicated':
      return buildDreamstudioPrompt(providerId, ctx);
    case 'fotor-dedicated':
      return buildFotorPrompt(providerId, ctx);
    case 'lexica-dedicated':
      return buildLexicaPrompt(providerId, ctx);

    // ══════════════════════════════════════════════════════════════════
    // ALREADY-INDEPENDENT PLATFORMS (1 platform per file)
    // ══════════════════════════════════════════════════════════════════
    case 'sd-clip-double-colon':
      return buildSdClipDoubleColonPrompt(providerId, ctx);
    case 'midjourney':
      return buildMidjourneyPrompt(providerId, ctx);
    case 'dalle-api':
      return buildDalleApiPrompt(providerId, ctx);
    case 'flux-architecture':
      return buildFluxArchitecturePrompt(providerId, ctx);
    case 'novelai':
      return buildNovelAiPrompt(providerId, ctx);
    case 'ideogram':
      return buildIdeogramPrompt(providerId, ctx);
    case 'recraft':
      return buildRecraftPrompt(providerId, ctx);

    // ══════════════════════════════════════════════════════════════════
    // T3 DEDICATED NL BUILDERS (v6.1 — 14 platforms)
    // ══════════════════════════════════════════════════════════════════
    // Short-form (refine, ≤200 chars)
    case 'nl-canva':
      return buildCanvaPrompt(providerId, ctx);
    case 'nl-visme':
      return buildVismePrompt(providerId, ctx);
    case 'nl-vistacreate':
      return buildVistacreatePrompt(providerId, ctx);
    case 'nl-myedit':
      return buildMyeditPrompt(providerId, ctx);
    case 'nl-artbreeder':
      return buildArtbreederPrompt(providerId, ctx);
    case 'nl-pixlr':
      return buildPixlrPrompt(providerId, ctx);
    case 'nl-deepai':
      return buildDeepaiPrompt(providerId, ctx);
    // Medium-form (balance, ≤300 chars)
    case 'nl-bing':
      return buildBingPrompt(providerId, ctx);
    case 'nl-simplified':
      return buildSimplifiedPrompt(providerId, ctx);
    case 'nl-123rf':
      return build_123rfPrompt(providerId, ctx);
    case 'nl-google-imagen':
      return buildGoogleImagenPrompt(providerId, ctx);
    // Long-form (enrich, ≤500 chars)
    case 'nl-imagine-meta':
      return buildImagineMetaPrompt(providerId, ctx);
    case 'nl-playground':
      return buildPlaygroundPrompt(providerId, ctx);
    // Extra-long (enrich, ≤750 chars)
    case 'nl-adobe-firefly':
      return buildAdobeFireflyPrompt(providerId, ctx);

    // ══════════════════════════════════════════════════════════════════
    // T4 DEDICATED NL BUILDERS (v6.2 — 11 platforms)
    // ══════════════════════════════════════════════════════════════════
    case 'nl-jasper-art':
      return buildJasperArtPrompt(providerId, ctx);
    case 'nl-craiyon':
      return buildCraiyonPrompt(providerId, ctx);
    case 'nl-hotpot':
      return buildHotpotPrompt(providerId, ctx);
    case 'nl-picsart':
      return buildPicsartPrompt(providerId, ctx);
    case 'nl-picwish':
      return buildPicwishPrompt(providerId, ctx);
    case 'nl-photoleap':
      return buildPhotoleapPrompt(providerId, ctx);
    case 'nl-microsoft-designer':
      return buildMicrosoftDesignerPrompt(providerId, ctx);
    case 'nl-artguru':
      return buildArtguruPrompt(providerId, ctx);
    case 'nl-artistly':
      return buildArtistlyPrompt(providerId, ctx);
    case 'nl-clipdrop':
      return buildClipdropPrompt(providerId, ctx);
    case 'nl-bluewillow':
      return buildBluewillowPrompt(providerId, ctx);

    // ══════════════════════════════════════════════════════════════════
    // VIDEO DEDICATED (v6.3 — 3 platforms, each independent)
    // ══════════════════════════════════════════════════════════════════
    case 'runway-dedicated':
      return buildRunwayPrompt(providerId, ctx);
    case 'luma-ai-dedicated':
      return buildLumaAiPrompt(providerId, ctx);
    case 'kling-dedicated':
      return buildKlingPrompt(providerId, ctx);

    // ── Generic fallback for unknown providers ───────────────────────
    default:
      return buildGenericFallbackPrompt(providerId, ctx);
  }
}
