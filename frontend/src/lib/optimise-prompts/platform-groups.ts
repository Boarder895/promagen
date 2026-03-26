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
// Authority: grouping-45-image-platforms-by-prompt-compatibility.md
// Used by: lib/optimise-prompts/resolve-group-prompt.ts
// Existing features preserved: Yes (new file, no modifications).
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
 * 'multi-engine'           — Aggregator platforms (route to underlying engine)
 * 'novelai'                — NovelAI dedicated ({{{term}}} triple-brace syntax)
 * 'ideogram'               — Ideogram dedicated (text-in-image, quote syntax)
 * 'recraft'                — Recraft dedicated (SVG, style taxonomy)
 * 'generic'                — Fallback: uses existing tier-based generic prompt
 */
export type PlatformGroupId =
  | 'sd-clip-parenthetical'
  | 'sd-clip-double-colon'
  | 'midjourney'
  | 'clean-natural-language'
  | 'dalle-api'
  | 'flux-architecture'
  | 'video-cinematic'
  | 'multi-engine'
  | 'novelai'
  | 'ideogram'
  | 'recraft'
  | 'generic';

/**
 * Maps every provider ID to its optimisation group.
 * Providers not listed here fall through to 'generic'.
 */
export const PLATFORM_GROUP_MAP: Record<string, PlatformGroupId> = {
  // ── SD CLIP Parenthetical: (term:weight) syntax, separate negatives ──
  'stability':     'sd-clip-parenthetical',
  'artguru':       'sd-clip-parenthetical',
  'artistly':      'sd-clip-parenthetical',
  'clipdrop':      'sd-clip-parenthetical',
  'dreamlike':     'sd-clip-parenthetical',
  'dreamstudio':   'sd-clip-parenthetical',
  'getimg':        'sd-clip-parenthetical',
  'lexica':        'sd-clip-parenthetical',
  'nightcafe':     'sd-clip-parenthetical',
  'openart':       'sd-clip-parenthetical',
  'playground':    'sd-clip-parenthetical',
  'tensor-art':    'sd-clip-parenthetical',

  // ── SD CLIP Double-Colon: term::weight syntax, separate negatives ────
  'leonardo':      'sd-clip-double-colon',

  // ── Midjourney: dedicated (:: prose + --param flags) ─────────────────
  'midjourney':    'midjourney',

  // ── Clean Natural Language: no weights, no negatives ─────────────────
  'bing':              'clean-natural-language',
  'google-imagen':     'clean-natural-language',
  'imagine-meta':      'clean-natural-language',
  'canva':             'clean-natural-language',
  'adobe-firefly':     'clean-natural-language',
  'jasper-art':        'clean-natural-language',
  'craiyon':           'clean-natural-language',
  'fotor':             'clean-natural-language',
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

  // ── DALL-E API: NL + structured params (quality, style) ──────────────
  'openai':            'dalle-api',

  // ── Flux Architecture: T5-XXL encoder, prose-only ────────────────────
  'flux':              'flux-architecture',

  // ── Video Cinematic: motion-first, temporal syntax ───────────────────
  'runway':            'video-cinematic',
  'luma-ai':           'video-cinematic',
  'kling':             'video-cinematic',

  // ── Multi-Engine Aggregators: route to underlying engine ─────────────
  'freepik':           'multi-engine',

  // ── Dedicated Templates ──────────────────────────────────────────────
  'novelai':           'novelai',
  'ideogram':          'ideogram',
  'recraft':           'recraft',

  // ── BluewWillow: CLIP keywords but no weight syntax, inline negatives
  'bluewillow':        'generic',
};

/**
 * Resolve the optimisation group for a provider.
 * Returns 'generic' for unknown providers — never throws.
 */
export function getProviderGroup(providerId: string): PlatformGroupId {
  return PLATFORM_GROUP_MAP[providerId] ?? 'generic';
}
