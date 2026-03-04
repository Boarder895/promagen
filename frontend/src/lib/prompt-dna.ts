// src/lib/prompt-dna.ts
// ============================================================================
// PROMPT DNA FINGERPRINTING ENGINE
// ============================================================================
//
// v1.0.0 (3 March 2026):
// Every prompt that flows through assemblePrompt() can be fingerprinted.
// The fingerprint is a stable hash of the category combination — which
// categories were used and what primary term was selected in each.
//
// This feeds the learning engine: track which COMBINATIONS produce the
// best user engagement (likes, copies, "Try in" clicks). Extends the
// existing term-quality tracking to track category-COMBINATION quality.
//
// Example:
//   Subject=cityscape + Lighting=moonlight + Atmosphere=contemplative
//   → hash: "a3f7c012"
//   → qualityScore: 0.73 (high engagement)
//
// Uses FNV-1a (32-bit) for stable, deterministic hashing — same algorithm
// used by the learning engine's A/B test user assignment.
//
// Existing features preserved: Yes — this is a standalone additive module.
// ============================================================================

import type {
  PromptCategory,
  PromptSelections,
  PromptSource,
  PromptDNAFingerprint,
  PromptDNAScore,
  WeatherCategoryMap,
} from '@/types/prompt-builder';

// ============================================================================
// FNV-1a HASH (32-bit, same as learning engine)
// ============================================================================

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * FNV-1a 32-bit hash.
 * Deterministic, fast, good distribution for short strings.
 * Returns lowercase hex string (8 chars).
 */
function fnv1a32(input: string): string {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  // Convert to unsigned 32-bit then hex
  return (hash >>> 0).toString(16).padStart(8, '0');
}

// ============================================================================
// CATEGORY CANONICALISATION
// ============================================================================

/**
 * Canonical category order for fingerprinting.
 * Must be stable across versions — changing order changes hashes.
 */
const FINGERPRINT_CATEGORY_ORDER: PromptCategory[] = [
  'subject',
  'action',
  'style',
  'environment',
  'composition',
  'camera',
  'lighting',
  'colour',
  'atmosphere',
  'materials',
  'fidelity',
  // negative excluded — it doesn't define the scene identity
];

/**
 * Normalise a term for fingerprinting.
 * Lowercase, trim, collapse whitespace. This ensures:
 *   "Golden Hour" and "golden hour" produce the same fingerprint.
 */
function normaliseTerm(term: string): string {
  return term.toLowerCase().trim().replace(/\s+/g, ' ');
}

// ============================================================================
// FINGERPRINT GENERATION
// ============================================================================

/**
 * Generate a DNA fingerprint from prompt selections.
 *
 * The fingerprint captures WHAT categories were used and the PRIMARY term
 * in each. Multi-select categories use only the first term (the one the
 * user explicitly chose or the one the weather intelligence prioritised).
 *
 * The hash is stable: same selections → same hash, regardless of platform
 * or assembly tier. This lets us track engagement across platforms.
 *
 * @param selections - The prompt selections (same input as assemblePrompt)
 * @param platformId - Which platform the prompt was assembled for
 * @param source - Where the prompt originated (user, weather, scene-starter, randomiser)
 * @returns A PromptDNAFingerprint with stable hash and category breakdown
 */
export function generateFingerprint(
  selections: PromptSelections,
  platformId: string,
  source: PromptSource = 'user',
): PromptDNAFingerprint {
  const categories: Partial<Record<PromptCategory, string>> = {};
  const hashParts: string[] = [];

  for (const category of FINGERPRINT_CATEGORY_ORDER) {
    const values = selections[category];
    if (!values?.length) continue;

    // Use first term as the primary identifier for this category
    const primary = normaliseTerm(values[0] ?? '');
    if (!primary) continue;

    categories[category] = primary;
    // Format: "category=term" — stable ordering from FINGERPRINT_CATEGORY_ORDER
    hashParts.push(`${category}=${primary}`);
  }

  // Build hash input: all category=term pairs joined by pipe
  const hashInput = hashParts.join('|');
  const hash = fnv1a32(hashInput);

  return {
    hash,
    categories,
    source,
    platformId,
    createdAt: new Date().toISOString(),
  };
}

// ============================================================================
// ENGAGEMENT SCORING
// ============================================================================

/** Weights for computing quality score from engagement metrics */
const ENGAGEMENT_WEIGHTS = {
  likes: 1.0,
  copies: 1.5, // Copies signal stronger intent than likes
  tryInClicks: 2.0, // "Try in" is the highest-intent action
} as const;

/**
 * Create a new empty score entry for a fingerprint hash.
 */
export function createEmptyScore(hash: string): PromptDNAScore {
  return {
    hash,
    impressions: 0,
    likes: 0,
    copies: 0,
    tryInClicks: 0,
    qualityScore: 0,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Recompute qualityScore from raw engagement counts.
 *
 * Formula: weighted(likes + copies + tryIn) / impressions
 * Clamped to [0, 1]. Returns 0 if no impressions.
 *
 * The weights reflect action intent hierarchy:
 *   - Like (1.0×): low-effort positive signal
 *   - Copy (1.5×): user wants to use this prompt
 *   - Try In (2.0×): user wants to edit and experiment
 */
export function computeQualityScore(score: PromptDNAScore): number {
  if (score.impressions === 0) return 0;

  const weightedEngagement =
    score.likes * ENGAGEMENT_WEIGHTS.likes +
    score.copies * ENGAGEMENT_WEIGHTS.copies +
    score.tryInClicks * ENGAGEMENT_WEIGHTS.tryInClicks;

  // Normalise by impressions and max possible weight
  const maxWeight = Math.max(
    ENGAGEMENT_WEIGHTS.likes,
    ENGAGEMENT_WEIGHTS.copies,
    ENGAGEMENT_WEIGHTS.tryInClicks,
  );
  const raw = weightedEngagement / (score.impressions * maxWeight);

  return Math.min(1, Math.max(0, raw));
}

/**
 * Record an engagement event and recompute quality score.
 *
 * @param score - The current score entry (mutated in place)
 * @param event - The type of engagement event
 * @returns The updated score with recomputed qualityScore
 */
export function recordEngagement(
  score: PromptDNAScore,
  event: 'impression' | 'like' | 'unlike' | 'copy' | 'tryIn',
): PromptDNAScore {
  switch (event) {
    case 'impression':
      score.impressions += 1;
      break;
    case 'like':
      score.likes += 1;
      break;
    case 'unlike':
      score.likes = Math.max(0, score.likes - 1);
      break;
    case 'copy':
      score.copies += 1;
      break;
    case 'tryIn':
      score.tryInClicks += 1;
      break;
  }

  score.qualityScore = computeQualityScore(score);
  score.updatedAt = new Date().toISOString();
  return score;
}

// ============================================================================
// FINGERPRINT COMPARISON UTILITIES
// ============================================================================

/**
 * Check if two fingerprints share the same category combination
 * (ignoring the specific terms, just the category set).
 *
 * Useful for finding structurally similar prompts:
 *   "Subject + Lighting + Atmosphere" matches any prompt with those 3 categories,
 *   regardless of whether Lighting was "moonlight" or "golden hour".
 */
export function hasSameCategoryShape(
  a: PromptDNAFingerprint,
  b: PromptDNAFingerprint,
): boolean {
  const aCats = new Set(Object.keys(a.categories));
  const bCats = new Set(Object.keys(b.categories));
  if (aCats.size !== bCats.size) return false;
  for (const cat of aCats) {
    if (!bCats.has(cat)) return false;
  }
  return true;
}

/**
 * Count how many categories overlap between two fingerprints.
 * Useful for "similar prompt" discovery.
 */
export function categoryOverlap(
  a: PromptDNAFingerprint,
  b: PromptDNAFingerprint,
): number {
  const aCats = new Set(Object.keys(a.categories));
  let overlap = 0;
  for (const cat of Object.keys(b.categories)) {
    if (aCats.has(cat)) overlap++;
  }
  return overlap;
}

/**
 * Count how many category+term pairs are identical between two fingerprints.
 * A term-level match is stronger than a category-level match.
 */
export function termOverlap(
  a: PromptDNAFingerprint,
  b: PromptDNAFingerprint,
): number {
  let overlap = 0;
  for (const [cat, term] of Object.entries(a.categories)) {
    if (b.categories[cat as PromptCategory] === term) {
      overlap++;
    }
  }
  return overlap;
}

// ============================================================================
// UPGRADE 5 — Category Map Hashing (Prompt Fingerprint Verification)
// ============================================================================
//
// v11.1.0: Compute a stable hash of the categoryMap content so the builder
// can verify its assembled output matches the generator's original.
//
// The hash covers selections + customValues (normalised, sorted by category).
// It deliberately EXCLUDES:
//   - weightOverrides (platform-specific, not content)
//   - negative terms (same across all tiers)
//   - meta fields (city/venue/mood — informational, not assembly input)
//   - confidence scores (diagnostic, not assembly input)
//
// This means the hash is PLATFORM-INDEPENDENT: same categoryMap → same hash
// regardless of whether it's assembled for Tier 1 CLIP or Tier 3 NatLang.
// ============================================================================

/**
 * Compute a stable FNV-1a hash of a WeatherCategoryMap's content.
 *
 * Used for Prompt Fingerprint Verification:
 *   - Generator computes hash → stores in `WeatherPromptResult.categoryMapHash`
 *   - Builder loads categoryMap → calls this same function
 *   - Match → "Matches original" badge
 *   - Diverges → "Modified from original" badge
 *
 * @param map - The category map to hash
 * @returns 8-char hex string (FNV-1a 32-bit)
 */
export function hashCategoryMap(map: WeatherCategoryMap): string {
  const parts: string[] = [];

  // Sort categories alphabetically for stable ordering
  const allCategories = new Set([
    ...Object.keys(map.selections ?? {}),
    ...Object.keys(map.customValues ?? {}),
  ]);
  const sortedCategories = [...allCategories].sort();

  for (const category of sortedCategories) {
    const selections = map.selections?.[category as PromptCategory] ?? [];
    const customValue = map.customValues?.[category as PromptCategory] ?? '';

    // Normalise: lowercase, trim, collapse whitespace
    const normSelections = selections
      .map((s) => normaliseTerm(s))
      .filter(Boolean)
      .sort()
      .join('+');

    const normCustom = normaliseTerm(customValue);

    if (normSelections || normCustom) {
      parts.push(`${category}:s=${normSelections}|c=${normCustom}`);
    }
  }

  return fnv1a32(parts.join('||'));
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  fnv1a32,
  normaliseTerm,
  FINGERPRINT_CATEGORY_ORDER,
  ENGAGEMENT_WEIGHTS,
};
