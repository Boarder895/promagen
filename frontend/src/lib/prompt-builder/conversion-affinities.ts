// src/lib/prompt-builder/conversion-affinities.ts
// Part 3 — Cold-Start Affinity Map
// ============================================================================
//
// Hand-curated affinity scores between conversion output terms and common
// prompt selection terms. Used by the scorer (Part 4) when the learning
// pipeline has no co-occurrence data yet (platform-co-occurrence-lookup
// returns null/zero).
//
// Structure: convertedOutputTerm → { existingSelectionTerm → affinity (0–1) }
//
// Progressive override: when lookupPlatformCoOccurrence() returns data with
// confidence > 0.3, the learned score replaces the cold-start score using
// the same blending pattern as Phase 7.5's platformConfidence ramp:
//
//   finalAffinity = learnedConfidence > 0.3
//     ? learnedScore
//     : coldStartScore × (1 - learnedConfidence) + learnedScore × learnedConfidence
//
// Gap 1 fix: This file solves the cold-start problem. Without it, the
// scorer would have zero signal for coherence on day 1.
//
// ~110 entries covering all 47 non-parametric conversion outputs × 5–10
// common selection terms each. Parametric outputs (--quality 2, --stylize 300)
// are omitted — they always score costEfficiency=1.0 and bypass budget.
//
// Improvement 1: Category-weighted averaging — getWeightedAverageAffinity()
//   weights style/subject terms higher than colour/materials for coherence.
// Improvement 2: Negative affinity inheritance — resolveAffinity() shares
//   curated data between negative and fidelity outputs that produce the
//   same text, reducing maintenance.
//
// Authority: budget-aware-conversion-build-plan.md §Part 3
// Created: 2026-03-19
// Existing features preserved: Yes (new file, no modifications)
// ============================================================================

import type { PromptCategory } from '@/types/prompt-builder';

// ============================================================================
// Types
// ============================================================================

export interface AffinityEntry {
  /** Affinity score 0–1 (1 = perfect pairing, 0 = contradicts) */
  score: number;
  /**
   * Why this score exists. Helps future reviewers understand the curation
   * logic and decide whether to adjust when A/B data arrives.
   */
  reason?: string;
}

/**
 * Cold-start affinity map.
 *
 * Key: converted output term (exact string from conversion-costs.ts)
 * Value: Record of selection terms → AffinityEntry
 *
 * Selection terms are lowercase and match vocabulary values from
 * data/vocabulary/prompt-builder/*.json.
 */
export type ColdStartAffinityMap = Record<string, Record<string, AffinityEntry>>;

/**
 * Improvement 1: Category-tagged selection for weighted averaging.
 * The scorer passes selections with their category so we can weight
 * style/subject higher than colour/materials.
 */
export interface TaggedSelection {
  term: string;
  category: PromptCategory;
}

// ============================================================================
// Confidence Threshold for Progressive Override
// ============================================================================

/** Below this confidence, blend cold-start with learned. Above, use learned. */
export const LEARNED_OVERRIDE_THRESHOLD = 0.3;

/**
 * Blend cold-start affinity with learned co-occurrence data.
 *
 * Same ramp as Phase 7.5's platformConfidence blending:
 * - confidence ≤ 0    → pure cold-start
 * - confidence < 0.3  → weighted blend
 * - confidence ≥ 0.3  → pure learned
 *
 * @param coldStart    - Curated affinity score (0–1)
 * @param learned      - Learned co-occurrence score (0–1)
 * @param confidence   - Confidence of learned data (0–1)
 * @returns Blended affinity score (0–1)
 */
export function blendAffinity(
  coldStart: number,
  learned: number,
  confidence: number,
): number {
  if (confidence >= LEARNED_OVERRIDE_THRESHOLD) return learned;
  if (confidence <= 0) return coldStart;
  // Linear blend below threshold
  return coldStart * (1 - confidence) + learned * confidence;
}

// ============================================================================
// Improvement 1: Category Weights for Coherence Scoring
// ============================================================================
// Style and subject are the most important categories for coherence —
// a conversion output that conflicts with the style is far worse than
// one that slightly mismatches a material.
//
// These weights are used by getWeightedAverageAffinity(). If a platform
// provides impactPriority, those categories get boosted further.
// ============================================================================

/**
 * Default category importance weights for coherence scoring.
 * Higher = more influence on the average affinity.
 */
const DEFAULT_CATEGORY_WEIGHTS: Partial<Record<PromptCategory, number>> = {
  style: 1.5,
  subject: 1.4,
  lighting: 1.1,
  environment: 1.0,
  atmosphere: 1.0,
  camera: 0.9,
  composition: 0.9,
  colour: 0.8,
  materials: 0.7,
  action: 0.7,
  fidelity: 0.5, // Fidelity terms are what we're converting — lower weight
  negative: 0.3, // Negatives are being replaced — least weight
};

/**
 * Build category weights that incorporate platform impactPriority.
 * Categories in impactPriority get a 1.3× boost on top of their default.
 */
export function buildCategoryWeights(
  impactPriority?: PromptCategory[],
): Partial<Record<PromptCategory, number>> {
  if (!impactPriority?.length) return DEFAULT_CATEGORY_WEIGHTS;

  const boosted = { ...DEFAULT_CATEGORY_WEIGHTS };
  for (const cat of impactPriority) {
    const base = boosted[cat] ?? 1.0;
    boosted[cat] = base * 1.3;
  }
  return boosted;
}

// ============================================================================
// Helper: shorthand constructor
// ============================================================================

/** Shorthand: score only (no reason) */
function s(score: number): AffinityEntry {
  return { score };
}

/** Shorthand: score + reason */
function sr(score: number, reason: string): AffinityEntry {
  return { score, reason };
}

// ============================================================================
// COLD-START AFFINITIES
// ============================================================================
// Organised by source category:
//   1. Fidelity NL outputs (11 entries) — from FIDELITY_TO_NATURAL
//   2. Negative → positive outputs (36 unique entries)
//
// Each output has 5–10 affinity pairs covering the most common selection
// terms it would interact with. Terms are from the vocabulary JSONs.
//
// Scoring guide:
//   0.9–1.0  Perfect pairing — output enhances this selection strongly
//   0.7–0.8  Good pairing — output is complementary
//   0.5–0.6  Neutral — output neither helps nor hurts
//   0.2–0.4  Mild conflict — output may work against this selection
//   0.0–0.1  Strong conflict — output contradicts this selection
// ============================================================================

export const COLD_START_AFFINITIES: ColdStartAffinityMap = {
  // ══════════════════════════════════════════════════════════════════════════
  // FIDELITY NL OUTPUTS (from 8K, 4K, masterpiece, etc.)
  // ══════════════════════════════════════════════════════════════════════════

  'captured with extraordinary clarity': {
    photorealistic: sr(0.95, 'Clarity is the core promise of photorealism'),
    hyperrealistic: s(0.9),
    'macro photography': sr(0.95, 'Macro demands extreme clarity'),
    'portrait photography': s(0.85),
    'landscape photography': s(0.85),
    'commercial photography': s(0.9),
    cinematic: s(0.85),
    'watercolor painting': sr(0.15, 'Watercolour is soft by nature'),
    'abstract art': sr(0.3, 'Abstract doesn\'t need literal clarity'),
    'pixel art': sr(0.1, 'Pixel art is intentionally low-res'),
  },

  'high-resolution detail': {
    photorealistic: s(0.9),
    'digital painting': s(0.75),
    'concept art': s(0.7),
    'intricate textures': sr(0.9, 'Detail + texture reinforce each other'),
    'marble texture': s(0.85),
    'crystal clarity': s(0.9),
    'watercolor painting': sr(0.2, 'Watercolour favours softness'),
    'sketch style': sr(0.2, 'Sketches are intentionally loose'),
    'low poly': sr(0.1, 'Low poly = minimal detail by design'),
  },

  'museum-quality composition': {
    'oil painting': sr(0.95, 'Museum + oil painting = classic pairing'),
    'concept art': s(0.8),
    'fine art': s(0.95),
    photorealistic: s(0.7),
    'matte painting': s(0.75),
    'portrait of a woman': s(0.8),
    'portrait of a man': s(0.8),
    'landscape photography': s(0.8),
    'cartoon style': sr(0.25, 'Museum quality contradicts casual cartoon'),
    'pixel art': sr(0.15, 'Museum quality and pixel art rarely align'),
  },

  'professional-grade photograph': {
    photorealistic: sr(0.95, 'Professional photograph = photorealism'),
    'portrait photography': s(0.95),
    'commercial photography': s(0.95),
    'landscape photography': s(0.9),
    'product photography': s(0.9),
    'golden hour': sr(0.85, 'Professional photographers love golden hour'),
    'studio lighting': s(0.9),
    'anime style': sr(0.1, 'Photograph contradicts anime'),
    'watercolor painting': sr(0.1, 'Photograph contradicts painting'),
    'oil painting': sr(0.1, 'Photograph contradicts painting'),
  },

  'fine-grained detail in every surface': {
    'marble texture': sr(0.95, 'Surface detail highlights texture'),
    'wood grain': s(0.95),
    'metal surface': s(0.9),
    'fabric texture': s(0.9),
    'leather texture': s(0.9),
    photorealistic: s(0.85),
    'macro photography': s(0.9),
    'abstract art': sr(0.35, 'Abstract may not want literal surface detail'),
    'watercolor painting': sr(0.2, 'Watercolour bleeds, not fine-grained'),
    'low poly': sr(0.05, 'Low poly has no surface detail'),
  },

  'hyper-detailed rendering with crystalline clarity': {
    photorealistic: s(0.95),
    hyperrealistic: s(0.95),
    'crystal clarity': sr(0.95, 'Crystalline + crystal = perfect match'),
    'glass transparency': s(0.9),
    'gemstone facets': s(0.9),
    'macro photography': s(0.9),
    'chrome reflection': s(0.85),
    'watercolor painting': sr(0.1, 'Crystalline clarity opposes watercolour'),
    'sketch style': sr(0.15, 'Hyper-detail opposes loose sketch'),
    impressionism: sr(0.2, 'Impressionism is about mood, not detail'),
  },

  'crisp high-resolution output': {
    photorealistic: s(0.9),
    'digital painting': s(0.8),
    'landscape photography': s(0.85),
    'architecture photography': s(0.85),
    'product photography': s(0.85),
    'sharp focus': s(0.9),
    'soft focus': sr(0.15, 'Crisp and soft focus conflict'),
    'watercolor painting': sr(0.2, 'Watercolour is soft'),
    bokeh: sr(0.3, 'Bokeh = intentional blur areas'),
  },

  'tack-sharp focus throughout': {
    'macro photography': sr(0.95, 'Macro needs tack-sharp focus'),
    photorealistic: s(0.9),
    'portrait photography': s(0.8),
    'product photography': s(0.9),
    'architecture photography': s(0.9),
    'studio lighting': s(0.85),
    bokeh: sr(0.2, 'Tack-sharp throughout vs intentional bokeh'),
    'soft focus': sr(0.1, 'Direct contradiction'),
    dreamy: sr(0.15, 'Dreamy = soft, not sharp'),
    'motion blur': sr(0.15, 'Blur opposes sharp'),
  },

  'intricate surface textures visible': {
    'marble texture': sr(0.95, 'Texture visibility = this output\'s purpose'),
    'wood grain': s(0.95),
    'leather texture': s(0.95),
    'stone surface': s(0.9),
    'fabric texture': s(0.9),
    'concrete texture': s(0.85),
    'metal surface': s(0.85),
    'macro photography': s(0.9),
    'watercolor painting': sr(0.2, 'Watercolour obscures texture'),
    minimal: sr(0.2, 'Minimalism avoids busy textures'),
  },

  'meticulously rendered fine details': {
    'concept art': s(0.85),
    'digital painting': s(0.8),
    photorealistic: s(0.85),
    ornate: s(0.9),
    baroque: sr(0.9, 'Baroque art is all about fine detail'),
    'art nouveau': s(0.85),
    'architecture photography': s(0.85),
    'low poly': sr(0.05, 'Low poly = no fine details'),
    minimal: sr(0.2, 'Minimalism rejects detail complexity'),
    'abstract art': sr(0.3, 'Abstract may not need literal detail'),
  },

  'delicate fine details preserved': {
    'portrait photography': s(0.85),
    'macro photography': s(0.9),
    botanical: s(0.9),
    jewelry: s(0.95),
    embroidery: s(0.9),
    photorealistic: s(0.85),
    'soft lighting': s(0.75),
    'pixel art': sr(0.1, 'Pixel art = blocky, not delicate'),
    grunge: sr(0.2, 'Grunge is rough, not delicate'),
    'glitch art': sr(0.15, 'Glitch = distortion, not preservation'),
  },

  // ══════════════════════════════════════════════════════════════════════════
  // NEGATIVE → POSITIVE OUTPUTS
  // ══════════════════════════════════════════════════════════════════════════

  // ── Quality Enhancement Group ──

  'sharp focus': {
    'macro photography': sr(0.95, 'Macro demands sharp focus'),
    'portrait photography': s(0.9),
    photorealistic: s(0.9),
    'product photography': s(0.9),
    'intricate textures': s(0.85),
    dreamy: sr(0.15, 'Sharp contradicts dreamy aesthetic'),
    'soft ethereal glow': sr(0.2, 'Ethereal implies softness'),
    bokeh: sr(0.3, 'Bokeh = selective blur'),
    'motion blur': sr(0.1, 'Direct contradiction'),
  },

  'high quality': {
    photorealistic: s(0.85),
    'portrait photography': s(0.8),
    'commercial photography': s(0.85),
    'concept art': s(0.75),
    'digital painting': s(0.75),
    grunge: sr(0.4, 'Grunge aesthetic intentionally degrades quality'),
    'lo-fi': sr(0.3, 'Lo-fi = low fidelity by design'),
    'glitch art': sr(0.25, 'Glitch art embraces artefacts'),
  },

  'high resolution': {
    photorealistic: s(0.9),
    'landscape photography': s(0.85),
    'architecture photography': s(0.85),
    'macro photography': s(0.9),
    'pixel art': sr(0.1, 'Pixel art is low-res by design'),
    'low poly': sr(0.15, 'Low poly = simplified geometry'),
    retro: sr(0.3, 'Retro may imply lower res aesthetic'),
  },

  'smooth details': {
    photorealistic: s(0.85),
    'portrait photography': s(0.8),
    'skin texture': s(0.85),
    'soft lighting': s(0.8),
    'pixel art': sr(0.05, 'Smooth opposes pixelated style'),
    grunge: sr(0.3, 'Grunge = rough textures'),
    '8-bit': sr(0.1, '8-bit = intentionally pixelated'),
  },

  'clean and smooth': {
    'studio lighting': s(0.85),
    'product photography': s(0.9),
    'commercial photography': s(0.85),
    photorealistic: s(0.8),
    'film grain': sr(0.1, 'Clean and smooth directly contradicts film grain'),
    vintage: sr(0.25, 'Vintage often implies grain'),
    noir: sr(0.3, 'Noir uses grain for atmosphere'),
  },

  'pristine clarity': {
    photorealistic: s(0.9),
    'macro photography': s(0.9),
    'crystal clarity': s(0.95),
    'glass transparency': s(0.85),
    'product photography': s(0.85),
    'film grain': sr(0.15, 'Pristine vs grain conflict'),
    grunge: sr(0.2, 'Grunge = dirty, not pristine'),
  },

  'well-rendered': {
    'digital painting': s(0.85),
    'concept art': s(0.85),
    illustration: s(0.8),
    'character design': s(0.85),
    photorealistic: s(0.8),
    'sketch style': sr(0.4, 'Well-rendered may conflict with loose sketches'),
    'abstract art': sr(0.5, 'Neutral — abstract has its own rendering logic'),
  },

  // ── Exposure Group ──

  'balanced exposure': {
    'landscape photography': s(0.85),
    'portrait photography': s(0.85),
    'studio lighting': s(0.8),
    'golden hour': s(0.8),
    photorealistic: s(0.8),
    'high key': sr(0.3, 'High key is intentionally bright/overexposed'),
    'lens flare': sr(0.4, 'Lens flare adds bright artefacts'),
  },

  'well-illuminated': {
    'studio lighting': s(0.9),
    bright: s(0.85),
    'portrait photography': s(0.8),
    photorealistic: s(0.8),
    'product photography': s(0.85),
    noir: sr(0.15, 'Noir relies on dark, underexposed areas'),
    moody: sr(0.3, 'Moody lighting often means dark areas'),
    silhouette: sr(0.1, 'Silhouettes need underexposure'),
  },

  'balanced colors': {
    natural: s(0.85),
    photorealistic: s(0.85),
    'muted tones': s(0.75),
    'earth tones': s(0.8),
    'portrait photography': s(0.8),
    'neon colours': sr(0.2, 'Neon is intentionally saturated'),
    psychedelic: sr(0.1, 'Psychedelic = extreme saturation'),
    'vibrant colours': sr(0.35, 'Vibrant implies some saturation push'),
  },

  'vibrant rich tones': {
    'golden hour': s(0.85),
    'warm tones': s(0.85),
    'jewel tones': s(0.9),
    autumn: s(0.85),
    sunset: s(0.85),
    photorealistic: s(0.75),
    'pastel palette': sr(0.25, 'Pastels are muted, not vibrant'),
    monochrome: sr(0.15, 'Monochrome has no rich tones'),
    minimal: sr(0.35, 'Minimalism often uses restrained colour'),
  },

  // ── Unwanted Elements Group ──

  'clean image': {
    photorealistic: s(0.85),
    'landscape photography': s(0.85),
    'portrait photography': s(0.8),
    'product photography': s(0.85),
    typographic: sr(0.1, 'Typographic art needs text'),
    'poster design': sr(0.2, 'Posters usually include text'),
    'comic book style': sr(0.3, 'Comics have speech bubbles/text'),
  },

  unmarked: {
    photorealistic: s(0.8),
    'commercial photography': s(0.85),
    'fine art': s(0.8),
    'landscape photography': s(0.8),
    'stock photography': s(0.9),
  },

  unsigned: {
    photorealistic: s(0.8),
    'landscape photography': s(0.8),
    'portrait photography': s(0.8),
    'digital painting': s(0.7),
    'fine art': sr(0.6, 'Fine art sometimes has artist signatures'),
  },

  'logo-free': {
    'landscape photography': s(0.85),
    'fine art': s(0.8),
    'portrait photography': s(0.8),
    photorealistic: s(0.8),
    branding: sr(0.1, 'Branding needs logos'),
  },

  borderless: {
    'landscape photography': s(0.8),
    photorealistic: s(0.8),
    panoramic: s(0.85),
    'full bleed': s(0.9),
    polaroid: sr(0.1, 'Polaroid has a signature border'),
    vintage: sr(0.4, 'Vintage photos often have borders'),
  },

  'full frame': {
    'landscape photography': s(0.85),
    'architecture photography': s(0.85),
    photorealistic: s(0.8),
    'wide angle': s(0.85),
    vignette: sr(0.4, 'Vignette adds frame-like darkening'),
  },

  // ── People/Crowd Control Group ──

  'empty scene': {
    abandoned: sr(0.9, 'Abandoned = empty by definition'),
    desolate: s(0.85),
    'landscape photography': s(0.8),
    'architecture photography': s(0.75),
    'urban exploration': s(0.85),
    'still life': s(0.8),
    'crowded market': sr(0.05, 'Crowded and empty directly conflict'),
    'portrait of a woman': sr(0.05, 'Portraits need people'),
    'portrait of a man': sr(0.05, 'Portraits need people'),
    'group of friends': sr(0.05, 'Group requires people'),
    'street photography': sr(0.3, 'Street photography usually has people'),
  },

  // ── Style/Medium Exclusion Group ──

  'realistic rendering': {
    photorealistic: sr(0.95, 'Realistic rendering = photorealism'),
    hyperrealistic: s(0.95),
    'portrait photography': s(0.85),
    'landscape photography': s(0.85),
    'product photography': s(0.85),
    'anime style': sr(0.1, 'Realistic contradicts anime'),
    'cartoon style': sr(0.05, 'Realistic contradicts cartoon'),
    'manga style': sr(0.1, 'Realistic contradicts manga'),
    'comic book style': sr(0.15, 'Realistic contradicts comics'),
  },

  'photographic realism': {
    photorealistic: sr(0.95, 'Same concept, reinforcing'),
    hyperrealistic: s(0.95),
    'portrait photography': s(0.9),
    'commercial photography': s(0.9),
    'studio lighting': s(0.85),
    'anime style': sr(0.05, 'Direct contradiction'),
    'manga style': sr(0.1, 'Photographic realism opposes manga'),
    'watercolor painting': sr(0.15, 'Photograph opposes painting'),
  },

  photographic: {
    photorealistic: sr(0.95, 'Same domain'),
    'portrait photography': s(0.9),
    'landscape photography': s(0.9),
    'commercial photography': s(0.9),
    '3d render': sr(0.1, 'Photographic opposes 3D render'),
    illustration: sr(0.1, 'Photographic opposes illustration'),
    'digital painting': sr(0.2, 'Photographic opposes painting'),
  },

  'detailed rendering': {
    'digital painting': s(0.85),
    'concept art': s(0.85),
    illustration: s(0.8),
    photorealistic: s(0.8),
    'character design': s(0.85),
    'sketch style': sr(0.15, 'Detailed rendering opposes loose sketch'),
    'line art': sr(0.3, 'Line art is minimal rendering'),
    minimal: sr(0.25, 'Detailed opposes minimal'),
  },

  'natural look': {
    photorealistic: s(0.9),
    'portrait photography': s(0.85),
    'landscape photography': s(0.85),
    'natural lighting': s(0.9),
    organic: s(0.85),
    '3d render': sr(0.15, 'Natural look opposes CGI'),
    neon: sr(0.3, 'Neon is artificial, not natural'),
    cyberpunk: sr(0.35, 'Cyberpunk leans into synthetic aesthetic'),
  },

  // ── Composition Group ──

  'complete composition': {
    'landscape photography': s(0.85),
    'architecture photography': s(0.85),
    'wide angle': s(0.85),
    panoramic: s(0.9),
    'product photography': s(0.8),
    'close-up': sr(0.3, 'Close-up intentionally crops to a detail'),
    'macro photography': sr(0.35, 'Macro = extreme close-up crop'),
  },

  'centered subject': {
    'portrait photography': s(0.9),
    'product photography': s(0.9),
    'studio lighting': s(0.8),
    symmetrical: s(0.9),
    'rule of thirds': sr(0.3, 'Centered vs off-center rule of thirds'),
    'dynamic angle': sr(0.4, 'Dynamic angles de-centre subjects'),
  },

  'unique composition': {
    'concept art': s(0.8),
    'fine art': s(0.85),
    creative: s(0.85),
    surrealism: s(0.8),
    'abstract art': s(0.8),
    photorealistic: s(0.7),
    pattern: sr(0.3, 'Patterns are repetitive by nature'),
    tessellation: sr(0.2, 'Tessellation = repetition'),
  },

  // ── Anatomy Group ──

  'well-formed': {
    'portrait photography': s(0.9),
    'portrait of a woman': s(0.9),
    'portrait of a man': s(0.9),
    'character design': s(0.85),
    photorealistic: s(0.85),
    'abstract art': sr(0.3, 'Abstract may intentionally deform'),
    surrealism: sr(0.35, 'Surrealism distorts forms deliberately'),
  },

  'correct proportions': {
    'portrait photography': s(0.9),
    'character design': s(0.85),
    'fashion photography': s(0.9),
    'anatomy study': s(0.95),
    photorealistic: s(0.85),
    surrealism: sr(0.2, 'Surrealism plays with proportions'),
    'fish eye': sr(0.2, 'Fish-eye intentionally distorts'),
    caricature: sr(0.1, 'Caricature = exaggerated proportions'),
  },

  'natural appearance': {
    'portrait photography': s(0.9),
    'portrait of a woman': s(0.9),
    'portrait of a man': s(0.9),
    photorealistic: s(0.85),
    'beauty photography': s(0.9),
    horror: sr(0.2, 'Horror may want unnatural appearance'),
    zombie: sr(0.1, 'Zombie = disfigured by definition'),
  },

  'anatomically correct': {
    'portrait photography': s(0.9),
    'figure drawing': s(0.95),
    'character design': s(0.9),
    photorealistic: s(0.85),
    'fashion photography': s(0.85),
    'abstract art': sr(0.2, 'Abstract ignores anatomy'),
    cubism: sr(0.1, 'Cubism fragments anatomy deliberately'),
  },

  'normal anatomy': {
    'portrait photography': s(0.9),
    'character design': s(0.85),
    photorealistic: s(0.85),
    'portrait of a woman': s(0.9),
    'portrait of a man': s(0.9),
    surrealism: sr(0.3, 'Surrealism may add extra elements'),
    lovecraftian: sr(0.15, 'Cosmic horror = abnormal anatomy'),
    'fantasy creature': sr(0.4, 'Fantasy creatures may have extra limbs'),
  },

  'correct hands': {
    'portrait photography': s(0.9),
    'character design': s(0.9),
    'fashion photography': s(0.85),
    photorealistic: s(0.85),
    'close-up': s(0.85),
    'abstract art': sr(0.3, 'Abstract doesn\'t need correct hands'),
  },

  'well-defined hands': {
    'portrait photography': s(0.9),
    'character design': s(0.9),
    photorealistic: s(0.85),
    'fashion photography': s(0.85),
    gesture: s(0.9),
    'abstract art': sr(0.3, 'Abstract doesn\'t need defined hands'),
    horror: sr(0.4, 'Horror may use distorted hands'),
  },

  // ── Aesthetic Group ──

  beautiful: {
    'portrait photography': s(0.9),
    'beauty photography': s(0.95),
    'landscape photography': s(0.85),
    'fine art': s(0.85),
    'golden hour': s(0.85),
    'fashion photography': s(0.9),
    horror: sr(0.2, 'Horror aims for unsettling, not beautiful'),
    grunge: sr(0.3, 'Grunge aesthetic rejects beauty norms'),
    brutalism: sr(0.3, 'Brutalism prioritises rawness'),
  },

  'pleasant mood': {
    'golden hour': s(0.85),
    'soft lighting': s(0.8),
    'pastel palette': s(0.8),
    'warm tones': s(0.8),
    'landscape photography': s(0.8),
    spring: s(0.85),
    horror: sr(0.05, 'Pleasant mood directly contradicts horror'),
    noir: sr(0.2, 'Noir = dark mood'),
    gothic: sr(0.15, 'Gothic = dark atmosphere'),
    'dark fantasy': sr(0.1, 'Dark fantasy is morbid by design'),
  },

  'intact and whole': {
    'portrait photography': s(0.85),
    'still life': s(0.8),
    'product photography': s(0.85),
    photorealistic: s(0.8),
    'beauty photography': s(0.85),
    horror: sr(0.15, 'Horror may show destruction'),
    'post-apocalyptic': sr(0.2, 'Post-apocalyptic = decay and ruin'),
    ruins: sr(0.2, 'Ruins are the opposite of intact'),
  },
};

// ============================================================================
// Improvement 2: Negative Affinity Inheritance
// ============================================================================
// When a negative conversion and a fidelity conversion produce the same
// output text (e.g., "sharp focus" appears as both a negative→positive
// output AND could be a fidelity concept), they should share affinity data.
//
// This map links output terms that are semantically identical across
// categories. resolveAffinity() checks the primary entry first, then
// falls back to the inherited entry. This means curating one set of
// affinities automatically applies to both conversion categories.
// ============================================================================

/**
 * Map of output term → fallback output term for affinity inheritance.
 * Key: output that might lack its own curated affinities
 * Value: output whose affinities should be inherited
 *
 * Currently covers the overlap between fidelity "sharp focus" conversion
 * ('tack-sharp focus throughout') and negative "blurry→sharp focus".
 * Add more pairs here as new conversions are added.
 */
const AFFINITY_INHERITANCE: Record<string, string> = {
  // Fidelity "sharp focus" → NL "tack-sharp focus throughout" is close to
  // negative "blurry" → "sharp focus". Share affinities in both directions.
  'tack-sharp focus throughout': 'sharp focus',
  // Fidelity "high resolution" → NL "crisp high-resolution output" is close to
  // negative "low resolution" → "high resolution".
  'crisp high-resolution output': 'high resolution',
  // Fidelity "highly detailed" → NL clause is close to negative "pixelated" → "smooth details"
  // (not identical but related concept)
};

// ============================================================================
// Lookup Functions
// ============================================================================

/**
 * Get the cold-start affinity between a conversion output and a selection term.
 * Includes Improvement 2: falls back to inherited affinities if primary lookup
 * returns null.
 *
 * @param outputTerm    - The converted output (e.g., "sharp focus")
 * @param selectionTerm - A user selection (e.g., "macro photography")
 * @returns Affinity score 0–1, or null if no curated affinity exists
 */
export function getColdStartAffinity(
  outputTerm: string,
  selectionTerm: string,
): number | null {
  const normalised = selectionTerm.toLowerCase().trim();

  // Primary lookup
  const primary = COLD_START_AFFINITIES[outputTerm]?.[normalised];
  if (primary) return primary.score;

  // Improvement 2: Inheritance fallback
  const inheritFrom = AFFINITY_INHERITANCE[outputTerm];
  if (inheritFrom) {
    const inherited = COLD_START_AFFINITIES[inheritFrom]?.[normalised];
    if (inherited) return inherited.score;
  }

  return null;
}

/**
 * Improvement 2: Resolve affinity with full inheritance chain.
 * Returns the AffinityEntry (with reason) for transparency panel display.
 */
export function resolveAffinity(
  outputTerm: string,
  selectionTerm: string,
): AffinityEntry | null {
  const normalised = selectionTerm.toLowerCase().trim();

  const primary = COLD_START_AFFINITIES[outputTerm]?.[normalised];
  if (primary) return primary;

  const inheritFrom = AFFINITY_INHERITANCE[outputTerm];
  if (inheritFrom) {
    const inherited = COLD_START_AFFINITIES[inheritFrom]?.[normalised];
    if (inherited) return { ...inherited, reason: `Inherited from "${inheritFrom}": ${inherited.reason ?? ''}`.trim() };
  }

  return null;
}

/**
 * Get the average cold-start affinity between a conversion output and
 * multiple selection terms. Used by the scorer for the coherence dimension.
 *
 * @param outputTerm     - The converted output
 * @param selectionTerms - Array of user selections across all categories
 * @returns Average affinity (0–1), or 0.5 (neutral) if no data
 */
export function getAverageAffinity(
  outputTerm: string,
  selectionTerms: string[],
): number {
  if (!selectionTerms.length) return 0.5;

  let total = 0;
  let count = 0;

  for (const term of selectionTerms) {
    const score = getColdStartAffinity(outputTerm, term);
    if (score !== null) {
      total += score;
      count++;
    }
  }

  if (count === 0) return 0.5;
  return total / count;
}

/**
 * Improvement 1: Category-weighted average affinity.
 *
 * Style and subject terms influence coherence more than colour or materials.
 * Uses platform impactPriority to boost relevant categories further.
 *
 * @param outputTerm     - The converted output
 * @param taggedTerms    - Array of selections tagged with their category
 * @param impactPriority - Platform's impactPriority categories (optional)
 * @returns Weighted average affinity (0–1), or 0.5 (neutral) if no data
 */
export function getWeightedAverageAffinity(
  outputTerm: string,
  taggedTerms: TaggedSelection[],
  impactPriority?: PromptCategory[],
): number {
  if (!taggedTerms.length) return 0.5;

  const weights = buildCategoryWeights(impactPriority);
  let weightedTotal = 0;
  let weightSum = 0;

  for (const { term, category } of taggedTerms) {
    const score = getColdStartAffinity(outputTerm, term);
    if (score !== null) {
      const w = weights[category] ?? 1.0;
      weightedTotal += score * w;
      weightSum += w;
    }
  }

  if (weightSum === 0) return 0.5;
  return weightedTotal / weightSum;
}

/**
 * Check whether a conversion output has any curated affinities
 * (either direct or inherited).
 */
export function hasAffinityData(outputTerm: string): boolean {
  if (outputTerm in COLD_START_AFFINITIES) return true;
  const inheritFrom = AFFINITY_INHERITANCE[outputTerm];
  return inheritFrom ? inheritFrom in COLD_START_AFFINITIES : false;
}
