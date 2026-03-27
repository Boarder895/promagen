// src/lib/optimise-prompts/platform-groups.ts
// ============================================================================
// PLATFORM GROUP MAPPING — Maps every provider ID to its optimisation group
// ============================================================================
// Pure data. No logic. One source of truth for which system prompt template
// handles which provider in Call 3 (optimise-prompt).
//
// Groups are based on prompt architecture, not tier:
//   - How the encoder processes text (CLIP vs T5 vs proprietary)
//   - Whether weighting syntax is supported (and which flavour)
//   - Whether negative prompts are supported (and how)
//   - Platform-specific features (timestamps, LoRA, SVG output)
//
// v2.0.0 (26 Mar 2026): Deep research audit. 19 tier corrections applied.
//   5 multi-engine aggregators removed (nightcafe, openart, tensor-art, getimg,
//   freepik). 45→40 platforms. multi-engine group deleted. BlueWillow moved
//   from generic to clean-natural-language. Fotor moved from NL to SD CLIP.
//   artguru, artistly, clipdrop moved from SD CLIP to NL. playground moved
//   from SD CLIP to NL.
//
// Authority: Prompt_Engineering_Specs_for_44_AI_Image_Platforms.md
// Used by: lib/optimise-prompts/resolve-group-prompt.ts
// ============================================================================

/**
 * Group identifiers for prompt optimisation templates.
 *
 * 'sd-clip-parenthetical'  — Stable Diffusion CLIP with (term:weight) syntax
 * 'sd-clip-double-colon'   — SD CLIP with term::weight syntax (Leonardo family)
 * 'midjourney'             — Midjourney dedicated (:: prose + -- parameters)
 * 'clean-natural-language'  — Plain NL, no weights, no negatives
 * 'dalle-api'              — DALL-E API family (NL + structured API params)
 * 'flux-architecture'      — T5-XXL encoder, prose-only, no weights
 * 'video-cinematic'        — Video-first platforms (Runway, Luma, Kling)
 * 'novelai'                — NovelAI dedicated ({{{term}}} triple-brace syntax)
 * 'ideogram'               — Ideogram dedicated (text-in-image, quote syntax)
 * 'recraft'                — Recraft dedicated (SVG, style taxonomy)
 */
export type PlatformGroupId =
  | 'sd-clip-parenthetical'
  | 'sd-clip-double-colon'
  | 'midjourney'
  | 'clean-natural-language'
  | 'dalle-api'
  | 'flux-architecture'
  | 'video-cinematic'
  | 'novelai'
  | 'ideogram'
  | 'recraft';

/**
 * Maps every provider ID to its optimisation group.
 * Providers not listed here fall through to generic fallback in the router.
 *
 * 40 platforms across 10 groups.
 */
export const PLATFORM_GROUP_MAP: Record<string, PlatformGroupId> = {
  // ── SD CLIP Parenthetical: (term:weight) syntax, separate negatives ──
  // 5 platforms
  'stability':     'sd-clip-parenthetical',
  'dreamlike':     'sd-clip-parenthetical',
  'dreamstudio':   'sd-clip-parenthetical',
  'fotor':         'sd-clip-parenthetical',        // Exposes full SD weight syntax
  'lexica':        'sd-clip-parenthetical',

  // ── SD CLIP Double-Colon: term::weight syntax, separate negatives ────
  // 1 platform
  'leonardo':      'sd-clip-double-colon',

  // ── Midjourney: dedicated (:: prose + --param flags) ─────────────────
  // 1 platform
  'midjourney':    'midjourney',

  // ── Clean Natural Language: no weights, prose-based ──────────────────
  // 25 platforms (tier 3 + tier 4 — all use NL prose, differ in length)
  'bing':              'clean-natural-language',
  'google-imagen':     'clean-natural-language',
  'imagine-meta':      'clean-natural-language',
  'canva':             'clean-natural-language',
  'adobe-firefly':     'clean-natural-language',
  'jasper-art':        'clean-natural-language',
  'craiyon':           'clean-natural-language',
  'hotpot':            'clean-natural-language',
  'simplified':        'clean-natural-language',
  'picsart':           'clean-natural-language',
  'visme':             'clean-natural-language',
  'vistacreate':       'clean-natural-language',
  '123rf':             'clean-natural-language',
  'myedit':            'clean-natural-language',
  'picwish':           'clean-natural-language',
  'artbreeder':        'clean-natural-language',
  'photoleap':         'clean-natural-language',
  'pixlr':             'clean-natural-language',
  'deepai':            'clean-natural-language',
  'microsoft-designer': 'clean-natural-language',
  'artguru':           'clean-natural-language',     // No exposed CLIP syntax
  'artistly':          'clean-natural-language',     // Keyword auto-expander
  'clipdrop':          'clean-natural-language',     // Plain text only
  'playground':        'clean-natural-language',     // PGv3 is NL/LLM-integrated
  'bluewillow':        'clean-natural-language',     // No MJ syntax support

  // ── DALL-E API: NL + structured params (quality, style) ──────────────
  // 1 platform
  'openai':            'dalle-api',

  // ── Flux Architecture: T5-XXL encoder, prose-only ────────────────────
  // 1 platform
  'flux':              'flux-architecture',

  // ── Video Cinematic: motion-first, temporal syntax ───────────────────
  // 3 platforms
  'runway':            'video-cinematic',
  'luma-ai':           'video-cinematic',
  'kling':             'video-cinematic',

  // ── Dedicated Templates ──────────────────────────────────────────────
  // 3 platforms
  'novelai':           'novelai',
  'ideogram':          'ideogram',
  'recraft':           'recraft',
};

/**
 * Resolve the optimisation group for a provider.
 * Returns undefined for unknown providers — the router falls through to generic.
 */
export function getProviderGroup(providerId: string): PlatformGroupId | undefined {
  return PLATFORM_GROUP_MAP[providerId];
}
