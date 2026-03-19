// src/lib/prompt-builder/conversion-costs.ts
// Part 1 — Conversion Cost Registry
// Pre-computed cost of every conversion output. Looked up instantly, not
// calculated at runtime.
//
// Authority: budget-aware-conversion-build-plan.md §Part 1
// Replaces the raw FIDELITY_TO_NATURAL + NEGATIVE_TO_POSITIVE maps with
// cost-aware versions. The old maps remain in prompt-builder.ts until Part 5
// wires this registry into the assembler — then the old maps are removed.
// ============================================================================

// ============================================================================
// Types
// ============================================================================

export interface ConversionEntry {
  /** The input term the user selected (lowercase key) */
  from: string;
  /** The converted output text: "--quality 2" or "sharp focus" */
  output: string;
  /** Word count of the output (0 for parametric) */
  cost: number;
  /** true = appended as parameter, doesn't consume prompt budget */
  isParametric: boolean;
  /** Source category of the conversion */
  category: 'fidelity' | 'negative';
  /**
   * How reliable the cost measurement is.
   * - 'exact': word count matches what all tokenizers would produce
   * - 'estimated': hyphenated words or unusual tokens may count differently
   *   on some platform tokenizers (e.g., CLIP BPE vs T5 SentencePiece)
   */
  costConfidence: 'exact' | 'estimated';
}

// ============================================================================
// Fidelity Conversions — keyed by platformFamily → fidelityTerm
// ============================================================================
// Platform families that convert fidelity:
//   'midjourney'  — MJ + BlueWillow: parametric params, cost=0
//   'flux'        — Flux/BFL: natural language clauses, variable cost
//   'recraft'     — Recraft: natural language clauses, variable cost
//   'luma-ai'     — Luma AI: natural language clauses, variable cost
//
// Flux, Recraft, and Luma share the same natural language conversions
// (sourced from FIDELITY_TO_NATURAL). MJ family uses parametric params.
// ============================================================================

/** Helper: count space-separated words in a string */
function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

/** Helper: detect if output contains hyphenated words (tokenizer-dependent cost) */
function hasHyphenatedWords(s: string): boolean {
  return /\w-\w/.test(s);
}

// ---- MJ parametric entries ----
// --quality 2  = max processing time → sharper output
// --stylize 300 = higher aesthetic / stylistic refinement
//
// Multiple fidelity terms can map to the same param. The scorer (Part 4)
// deduplicates identical outputs before budget allocation.

const MJ_PARAM_QUALITY: Omit<ConversionEntry, 'from'> = {
  output: '--quality 2',
  cost: 0,
  isParametric: true,
  category: 'fidelity',
  costConfidence: 'exact',
};

const MJ_PARAM_STYLIZE: Omit<ConversionEntry, 'from'> = {
  output: '--stylize 300',
  cost: 0,
  isParametric: true,
  category: 'fidelity',
  costConfidence: 'exact',
};

/** MJ fidelity term → parametric param mapping */
const MIDJOURNEY_FIDELITY: Record<string, Omit<ConversionEntry, 'from'>> = {
  '8k': MJ_PARAM_QUALITY,
  '4k': MJ_PARAM_QUALITY,
  'best quality': MJ_PARAM_QUALITY,
  'highly detailed': MJ_PARAM_QUALITY,
  'ultra detailed': MJ_PARAM_QUALITY,
  'high resolution': MJ_PARAM_QUALITY,
  'sharp focus': MJ_PARAM_QUALITY,
  'fine details': MJ_PARAM_QUALITY,
  // Aesthetic / style terms → --stylize
  masterpiece: MJ_PARAM_STYLIZE,
  'intricate textures': MJ_PARAM_STYLIZE,
  'intricate details': MJ_PARAM_STYLIZE,
};

// ---- Natural language entries (Flux / Recraft / Luma) ----
// Sourced from existing FIDELITY_TO_NATURAL in prompt-builder.ts

const NATURAL_LANG_FIDELITY_RAW: Record<string, string> = {
  '8k': 'captured with extraordinary clarity',
  '4k': 'high-resolution detail',
  masterpiece: 'museum-quality composition',
  'best quality': 'professional-grade photograph',
  'highly detailed': 'fine-grained detail in every surface',
  'ultra detailed': 'hyper-detailed rendering with crystalline clarity',
  'high resolution': 'crisp high-resolution output',
  'sharp focus': 'tack-sharp focus throughout',
  'intricate textures': 'intricate surface textures visible',
  'intricate details': 'meticulously rendered fine details',
  'fine details': 'delicate fine details preserved',
};

/** Build cost-aware entries from the raw natural language map */
function buildNaturalLangEntries(
  raw: Record<string, string>,
): Record<string, Omit<ConversionEntry, 'from'>> {
  return Object.fromEntries(
    Object.entries(raw).map(([term, output]) => [
      term,
      {
        output,
        cost: wordCount(output),
        isParametric: false,
        category: 'fidelity' as const,
        costConfidence: hasHyphenatedWords(output)
          ? ('estimated' as const)
          : ('exact' as const),
      },
    ]),
  );
}

// ---- Improvement 1: Per-family NL fidelity maps ----
// Each family starts with the shared base but can diverge independently.
// Recraft's style-preset engine may benefit from different phrasings.
// Luma's Universal Transformer may weight descriptive terms differently.
// When platform-specific A/B data arrives, override individual entries
// without affecting the other families.

/** Shared base — Flux's T5 encoder is the reference NL platform */
const FLUX_FIDELITY = buildNaturalLangEntries(NATURAL_LANG_FIDELITY_RAW);

/** Recraft: same base for now. Override entries here as A/B data arrives. */
const RECRAFT_FIDELITY = buildNaturalLangEntries({
  ...NATURAL_LANG_FIDELITY_RAW,
  // Future: Recraft's proprietary engine may respond better to e.g.:
  // 'masterpiece': 'award-winning artistic composition',
});

/** Luma AI: same base for now. Override entries here as A/B data arrives. */
const LUMA_FIDELITY = buildNaturalLangEntries({
  ...NATURAL_LANG_FIDELITY_RAW,
  // Future: Luma's Universal Transformer may prefer different phrasing
});

// ============================================================================
// FIDELITY_CONVERSIONS — the main lookup
// ============================================================================
// Keys: platformFamily → fidelityTerm (lowercase) → ConversionEntry (minus 'from')
//
// Flux, Recraft, and Luma share identical conversions today. If platform-
// specific tuning is needed later, split them into separate objects.
// ============================================================================

export const FIDELITY_CONVERSIONS: Record<
  string,
  Record<string, Omit<ConversionEntry, 'from'>>
> = {
  midjourney: MIDJOURNEY_FIDELITY,
  flux: FLUX_FIDELITY,
  recraft: RECRAFT_FIDELITY,
  'luma-ai': LUMA_FIDELITY,
};

// ============================================================================
// Negative Conversions — platform-independent
// ============================================================================
// Sourced from existing NEGATIVE_TO_POSITIVE in prompt-builder.ts (44 entries).
// Every entry: { output, cost (word count), isParametric: false, category: 'negative' }
// ============================================================================

const NEGATIVE_RAW: Record<string, string> = {
  // Quality issues → Quality enhancers
  blurry: 'sharp focus',
  'low quality': 'high quality',
  'low resolution': 'high resolution',
  pixelated: 'smooth details',
  grainy: 'clean and smooth',
  noisy: 'pristine clarity',
  'poorly drawn': 'well-rendered',

  // Exposure issues → Proper exposure
  overexposed: 'balanced exposure',
  underexposed: 'well-illuminated',
  oversaturated: 'balanced colors',
  'washed out': 'vibrant rich tones',

  // Unwanted elements → Clean image (singular + plural forms)
  text: 'clean image',
  watermark: 'unmarked',
  watermarks: 'unmarked',
  signature: 'unsigned',
  signatures: 'unsigned',
  logo: 'logo-free',
  logos: 'logo-free',
  border: 'borderless',
  frame: 'full frame',

  // People / crowd control
  people: 'empty scene',
  person: 'empty scene',
  crowd: 'empty scene',
  crowds: 'empty scene',

  // Style / medium exclusions → Positive style affirmation
  cartoon: 'realistic rendering',
  cartoonish: 'realistic rendering',
  anime: 'photographic realism',
  illustration: 'photographic',
  sketch: 'detailed rendering',
  '3d render': 'photographic',
  'cgi look': 'natural look',

  // Composition issues → Good composition
  cropped: 'complete composition',
  'out of frame': 'centered subject',
  duplicate: 'unique composition',

  // Anatomy issues → Correct anatomy
  deformed: 'well-formed',
  distorted: 'correct proportions',
  disfigured: 'natural appearance',
  'bad anatomy': 'anatomically correct',
  'extra limbs': 'normal anatomy',
  'extra fingers': 'correct hands',
  'mutated hands': 'well-defined hands',

  // Aesthetic issues → Positive aesthetics
  ugly: 'beautiful',
  morbid: 'pleasant mood',
  mutilated: 'intact and whole',
};

export const NEGATIVE_CONVERSIONS: Record<
  string,
  Omit<ConversionEntry, 'from'>
> = Object.fromEntries(
  Object.entries(NEGATIVE_RAW).map(([term, output]) => [
    term,
    {
      output,
      cost: wordCount(output),
      isParametric: false,
      category: 'negative' as const,
      costConfidence: hasHyphenatedWords(output)
        ? ('estimated' as const)
        : ('exact' as const),
    },
  ]),
);

// ============================================================================
// Platform family → platformId mapping
// ============================================================================
// Maps platformIds to their fidelity conversion family key.
// Only platforms in FIDELITY_CONVERSION_PLATFORMS need entries here.
// ============================================================================

const PLATFORM_TO_FIDELITY_FAMILY: Record<string, string> = {
  midjourney: 'midjourney',
  bluewillow: 'midjourney', // Same engine as MJ
  flux: 'flux',
  recraft: 'recraft',
  'luma-ai': 'luma-ai',
};

// ============================================================================
// Lookup function
// ============================================================================

/**
 * Look up the conversion cost for a term on a specific platform.
 *
 * @param term       - The user-selected term (e.g., "8K", "blurry")
 * @param category   - 'fidelity' or 'negative'
 * @param platformId - The platform ID (e.g., "midjourney", "flux")
 * @returns ConversionEntry with full cost data, or null if no conversion exists
 */
export function getConversionCost(
  term: string,
  category: 'fidelity' | 'negative',
  platformId: string,
): ConversionEntry | null {
  const normalised = term.toLowerCase().trim();

  if (category === 'negative') {
    const entry = NEGATIVE_CONVERSIONS[normalised];
    if (!entry) return null;
    return { from: normalised, ...entry };
  }

  // Fidelity: look up by platform family
  const family = PLATFORM_TO_FIDELITY_FAMILY[platformId];
  if (!family) return null; // Platform doesn't do fidelity conversion

  const familyMap = FIDELITY_CONVERSIONS[family];
  if (!familyMap) return null;

  const entry = familyMap[normalised];
  if (!entry) return null;

  return { from: normalised, ...entry };
}

/**
 * Get ALL fidelity conversion entries for a platform family.
 * Used by the scorer (Part 4) to batch-lookup candidates.
 *
 * @param platformId - The platform ID
 * @returns All fidelity ConversionEntries for the platform, or empty array
 */
export function getAllFidelityConversions(
  platformId: string,
): ConversionEntry[] {
  const family = PLATFORM_TO_FIDELITY_FAMILY[platformId];
  if (!family) return [];

  const familyMap = FIDELITY_CONVERSIONS[family];
  if (!familyMap) return [];

  return Object.entries(familyMap).map(([term, entry]) => ({
    from: term,
    ...entry,
  }));
}

/**
 * Check whether a platform converts fidelity terms at all.
 *
 * @param platformId - The platform ID
 * @returns true if this platform has fidelity conversion entries
 */
export function isFidelityConversionPlatform(platformId: string): boolean {
  return platformId in PLATFORM_TO_FIDELITY_FAMILY;
}

/**
 * Get the platform family key for fidelity conversions.
 * Exposed for testing and the scorer's dedup logic.
 *
 * @param platformId - The platform ID
 * @returns Family key ('midjourney' | 'flux' | 'recraft' | 'luma-ai') or null
 */
export function getFidelityFamily(platformId: string): string | null {
  return PLATFORM_TO_FIDELITY_FAMILY[platformId] ?? null;
}
