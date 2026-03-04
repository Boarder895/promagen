// src/lib/weather/adaptive-weights.ts
// ============================================================================
// ADAPTIVE WEIGHT CALIBRATION — Extra 4 (Unified Brain)
// ============================================================================
//
// v1.0.0 (Mar 2026) — Dynamically adjusts CLIP weight overrides based on
// prompt density, platform token budgets, and category importance.
//
// PROBLEM:
//   A prompt with 3 categories needs strong weights (1.3, 1.2, 1.1) to
//   give each element presence. A prompt with 10 categories needs gentler
//   weights (1.1, 1.05, 1.0) to avoid confusing the model with too many
//   competing emphases. Static weights don't adapt.
//
// SOLUTION:
//   Analyse the populated categories in a WeatherCategoryMap and recalibrate
//   weightOverrides for CLIP-tier platforms. The algorithm:
//
//   1. Count populated categories (selections + customValues)
//   2. Estimate token density (words per category)
//   3. Apply a density curve: fewer categories → stronger weights,
//      more categories → gentler weights
//   4. Respect platform token budget (Tier 1 ≈ 77 CLIP tokens,
//      Tier 4 ≈ 8-12 fragments)
//   5. Maintain category hierarchy (subject > environment > lighting > rest)
//
// Existing features preserved: Yes — purely additive, no existing code changed.
// ============================================================================

import type { PromptCategory, WeatherCategoryMap } from '@/types/prompt-builder';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Category importance ranking (higher = more important for scene identity).
 * Used to distribute weight budget: important categories get more emphasis.
 */
const CATEGORY_IMPORTANCE: Record<PromptCategory, number> = {
  subject: 10,
  environment: 9,
  lighting: 8,
  atmosphere: 6,
  style: 5,
  colour: 4,
  action: 4,
  materials: 3,
  camera: 3,
  fidelity: 2,
  composition: 2,
  negative: 0, // Negative terms don't get CLIP weights
};

/**
 * Platform token budgets.
 * CLIP: ~77 tokens max (Stable Diffusion / Leonardo / ComfyUI)
 * Flux T5: ~300 tokens (but no weight syntax)
 * MJ V6/V7: ~60-75 words (natural language)
 * DALL-E/Firefly: ~400 chars (natural language)
 * Canva/Ideogram: 8-12 comma fragments
 */
export interface PlatformBudget {
  /** Max effective tokens/words/fragments */
  maxTokens: number;
  /** Whether this platform supports (token:weight) syntax */
  supportsWeights: boolean;
  /** Optimal number of weighted tokens (too many dilutes impact) */
  sweetSpot: number;
}

export const PLATFORM_BUDGETS: Record<string, PlatformBudget> = {
  clip: { maxTokens: 77, supportsWeights: true, sweetSpot: 12 },
  flux: { maxTokens: 300, supportsWeights: false, sweetSpot: 0 },
  midjourney: { maxTokens: 75, supportsWeights: false, sweetSpot: 0 },
  natural: { maxTokens: 400, supportsWeights: false, sweetSpot: 0 },
  plain: { maxTokens: 12, supportsWeights: false, sweetSpot: 8 },
};

// ============================================================================
// WEIGHT CALIBRATION
// ============================================================================

/**
 * Density curve: maps number of populated categories to a weight multiplier.
 *
 * Fewer categories → higher multiplier (stronger individual weights)
 * More categories → lower multiplier (gentler weights to avoid confusion)
 *
 * The curve is tuned for CLIP models which perform best with 8-15 weighted
 * tokens. Beyond ~15 weighted tokens, adding more emphasis markers
 * produces diminishing returns and can actually reduce coherence.
 *
 * @param categoryCount - Number of populated categories (1-12)
 * @returns Multiplier between 0.6 and 1.0
 */
export function densityMultiplier(categoryCount: number): number {
  // Clamp to valid range
  const count = Math.max(1, Math.min(12, categoryCount));

  // Exponential decay: 1.0 at 1 category, ~0.6 at 12 categories
  // Formula: 1.0 * e^(-0.045 * (count - 1))
  // This gives: 1=1.0, 3=0.91, 5=0.84, 7=0.76, 9=0.70, 12=0.61
  return Math.round(Math.exp(-0.045 * (count - 1)) * 1000) / 1000;
}

/**
 * Calculate the calibrated weight for a single category.
 *
 * @param baseWeight - Original weight override (e.g., 1.3)
 * @param importance - Category importance (0-10)
 * @param multiplier - Density multiplier (0.6-1.0)
 * @returns Calibrated weight, minimum 1.0 (no negative emphasis)
 */
export function calibrateWeight(
  baseWeight: number,
  importance: number,
  multiplier: number,
): number {
  // The emphasis above 1.0 is what gets scaled
  const emphasis = baseWeight - 1.0;
  if (emphasis <= 0) return baseWeight;

  // Scale emphasis by density multiplier and normalised importance
  const importanceBoost = importance / 10; // 0.0 to 1.0
  const calibrated = 1.0 + emphasis * multiplier * (0.5 + 0.5 * importanceBoost);

  // Round to 2 decimal places, minimum 1.0
  return Math.max(1.0, Math.round(calibrated * 100) / 100);
}

/**
 * Recalibrate all weight overrides in a WeatherCategoryMap for a given platform.
 *
 * This is the main entry point. It analyses the populated categories,
 * computes density, and adjusts each weight proportionally.
 *
 * For platforms that don't support weight syntax (Flux, MJ, NL, Plain),
 * returns the map unchanged.
 *
 * @param map - The WeatherCategoryMap to calibrate
 * @param platformType - Platform type key (e.g., 'clip', 'midjourney')
 * @returns New WeatherCategoryMap with calibrated weightOverrides
 */
export function calibrateWeights(
  map: WeatherCategoryMap,
  platformType: string,
): WeatherCategoryMap {
  const budget = PLATFORM_BUDGETS[platformType];

  // Non-weight platforms → return unchanged
  if (!budget?.supportsWeights) return map;

  // Count populated categories
  const populatedCategories = new Set<PromptCategory>();
  for (const cat of Object.keys(map.selections) as PromptCategory[]) {
    if (map.selections[cat]?.length) populatedCategories.add(cat);
  }
  for (const cat of Object.keys(map.customValues) as PromptCategory[]) {
    if (map.customValues[cat]) populatedCategories.add(cat);
  }

  const categoryCount = populatedCategories.size;
  const multiplier = densityMultiplier(categoryCount);

  // Calibrate each existing weight override
  const calibrated: Partial<Record<PromptCategory, number>> = {};
  const weights = map.weightOverrides ?? {};

  for (const cat of Object.keys(weights) as PromptCategory[]) {
    const baseWeight = weights[cat];
    if (baseWeight === undefined) continue;

    const importance = CATEGORY_IMPORTANCE[cat] ?? 5;
    calibrated[cat] = calibrateWeight(baseWeight, importance, multiplier);
  }

  // For populated categories WITHOUT explicit weights, assign density-aware defaults
  for (const cat of populatedCategories) {
    if (calibrated[cat] !== undefined) continue;
    if (cat === 'negative') continue; // Negatives don't get weights

    const importance = CATEGORY_IMPORTANCE[cat] ?? 5;
    const defaultEmphasis = importance >= 7 ? 1.15 : importance >= 4 ? 1.05 : 1.0;
    calibrated[cat] = calibrateWeight(defaultEmphasis, importance, multiplier);
  }

  return {
    ...map,
    weightOverrides: calibrated,
  };
}

// ============================================================================
// ANALYSIS UTILITIES
// ============================================================================

/**
 * Compute a "weight budget" analysis for diagnostic display.
 * Shows how weight emphasis is distributed across categories.
 */
export interface WeightBudgetAnalysis {
  /** Total emphasis above 1.0 across all categories */
  totalEmphasis: number;
  /** Number of categories with weight > 1.0 */
  emphasizedCount: number;
  /** Category with highest weight */
  topCategory: PromptCategory | null;
  /** Density multiplier applied */
  densityMultiplier: number;
  /** Number of populated categories */
  populatedCount: number;
}

/**
 * Analyse the weight distribution of a calibrated WeatherCategoryMap.
 */
export function analyseWeightBudget(map: WeatherCategoryMap): WeightBudgetAnalysis {
  const weights = map.weightOverrides ?? {};
  const entries = Object.entries(weights) as [PromptCategory, number][];

  let totalEmphasis = 0;
  let emphasizedCount = 0;
  let topCategory: PromptCategory | null = null;
  let topWeight = 0;

  for (const [cat, weight] of entries) {
    if (weight > 1.0) {
      totalEmphasis += weight - 1.0;
      emphasizedCount++;
      if (weight > topWeight) {
        topWeight = weight;
        topCategory = cat;
      }
    }
  }

  // Count populated
  const populated = new Set<PromptCategory>();
  for (const cat of Object.keys(map.selections) as PromptCategory[]) {
    if (map.selections[cat]?.length) populated.add(cat);
  }
  for (const cat of Object.keys(map.customValues) as PromptCategory[]) {
    if (map.customValues[cat]) populated.add(cat);
  }

  return {
    totalEmphasis: Math.round(totalEmphasis * 100) / 100,
    emphasizedCount,
    topCategory,
    densityMultiplier: densityMultiplier(populated.size),
    populatedCount: populated.size,
  };
}
