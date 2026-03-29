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
 * 'clean-natural-language'  — Plain NL, no weights, no negatives (T4 ONLY — T3 moved to dedicated builders)
 * 'dalle-api'              — DALL-E API family (NL + structured API params)
 * 'flux-architecture'      — T5-XXL encoder, prose-only, no weights
 * 'video-cinematic'        — Video-first platforms (Runway, Luma, Kling)
 * 'novelai'                — NovelAI dedicated ({{{term}}} triple-brace syntax)
 * 'ideogram'               — Ideogram dedicated (text-in-image, quote syntax)
 * 'recraft'                — Recraft dedicated (SVG, style taxonomy)
 * 'nl-bing'                — Bing Image Creator (DALL-E 3, GPT rewrite)
 * 'nl-google-imagen'       — Google Imagen (Expressive Chips)
 * 'nl-imagine-meta'        — Meta Imagine (Emu model)
 * 'nl-canva'               — Canva (Leonardo Phoenix)
 * 'nl-adobe-firefly'       — Adobe Firefly (design-first, UI controls)
 * 'nl-simplified'          — Simplified (14+ model aggregator)
 * 'nl-visme'               — Visme (Dreamscape API)
 * 'nl-vistacreate'         — VistaCreate (Bria.ai)
 * 'nl-123rf'               — 123RF (stock photography)
 * 'nl-myedit'              — MyEdit (Nano Banana Pro)
 * 'nl-artbreeder'          — Artbreeder (hybrid)
 * 'nl-pixlr'               — Pixlr (3 generation modes)
 * 'nl-deepai'              — DeepAI (REST API, SD-based)
 * 'nl-playground'          — Playground (PGv3 LLM encoder)
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
  | 'recraft'
  // ── T3 dedicated NL builders (v6.1) ────────────────────────────────
  | 'nl-bing'
  | 'nl-google-imagen'
  | 'nl-imagine-meta'
  | 'nl-canva'
  | 'nl-adobe-firefly'
  | 'nl-simplified'
  | 'nl-visme'
  | 'nl-vistacreate'
  | 'nl-123rf'
  | 'nl-myedit'
  | 'nl-artbreeder'
  | 'nl-pixlr'
  | 'nl-deepai'
  | 'nl-playground'
  // ── T4 dedicated NL builders (v6.2) ────────────────────────────────
  | 'nl-jasper-art'
  | 'nl-craiyon'
  | 'nl-hotpot'
  | 'nl-picsart'
  | 'nl-picwish'
  | 'nl-photoleap'
  | 'nl-microsoft-designer'
  | 'nl-artguru'
  | 'nl-artistly'
  | 'nl-clipdrop'
  | 'nl-bluewillow'
  // ── SD CLIP dedicated builders (v6.3) ──────────────────────────────
  | 'stability-dedicated'
  | 'dreamlike-dedicated'
  | 'dreamstudio-dedicated'
  | 'fotor-dedicated'
  | 'lexica-dedicated'
  // ── Video dedicated builders (v6.3) ────────────────────────────────
  | 'runway-dedicated'
  | 'luma-ai-dedicated'
  | 'kling-dedicated';

/**
 * Maps every provider ID to its optimisation group.
 * Providers not listed here fall through to generic fallback in the router.
 *
 * 40 platforms across 10 groups.
 */
export const PLATFORM_GROUP_MAP: Record<string, PlatformGroupId> = {
  // ── SD CLIP Dedicated Builders (v6.3 — per-platform) ──────────────
  'stability':     'stability-dedicated',
  'dreamlike':     'dreamlike-dedicated',
  'dreamstudio':   'dreamstudio-dedicated',
  'fotor':         'fotor-dedicated',
  'lexica':        'lexica-dedicated',

  // ── SD CLIP Double-Colon: term::weight syntax, separate negatives ────
  // 1 platform
  'leonardo':      'sd-clip-double-colon',

  // ── Midjourney: dedicated (:: prose + --param flags) ─────────────────
  // 1 platform
  'midjourney':    'midjourney',

  // ── T3 Dedicated NL Builders (per-platform system prompts) ────────────
  // v6.1: Each T3 NL platform gets its own builder with platform-aware
  // length targets and strategy (refine/balance/enrich).
  'bing':              'nl-bing',
  'google-imagen':     'nl-google-imagen',
  'imagine-meta':      'nl-imagine-meta',
  'canva':             'nl-canva',
  'adobe-firefly':     'nl-adobe-firefly',
  'simplified':        'nl-simplified',
  'visme':             'nl-visme',
  'vistacreate':       'nl-vistacreate',
  '123rf':             'nl-123rf',
  'myedit':            'nl-myedit',
  'artbreeder':        'nl-artbreeder',
  'pixlr':             'nl-pixlr',
  'deepai':            'nl-deepai',
  'playground':        'nl-playground',

  // ── T4 Dedicated NL Builders (v6.2) ───────────────────────────────
  'jasper-art':        'nl-jasper-art',
  'craiyon':           'nl-craiyon',
  'hotpot':            'nl-hotpot',
  'picsart':           'nl-picsart',
  'picwish':           'nl-picwish',
  'photoleap':         'nl-photoleap',
  'microsoft-designer': 'nl-microsoft-designer',
  'artguru':           'nl-artguru',
  'artistly':          'nl-artistly',
  'clipdrop':          'nl-clipdrop',
  'bluewillow':        'nl-bluewillow',

  // ── DALL-E API: NL + structured params (quality, style) ──────────────
  // 1 platform
  'openai':            'dalle-api',

  // ── Flux Architecture: T5-XXL encoder, prose-only ────────────────────
  // 1 platform
  'flux':              'flux-architecture',

  // ── Video Dedicated Builders (v6.3 — per-platform) ────────────────
  'runway':            'runway-dedicated',
  'luma-ai':           'luma-ai-dedicated',
  'kling':             'kling-dedicated',

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
