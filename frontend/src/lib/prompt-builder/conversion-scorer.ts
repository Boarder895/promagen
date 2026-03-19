// src/lib/prompt-builder/conversion-scorer.ts
// Part 4 — Conversion Scorer
// ============================================================================
//
// Scores each conversion candidate on three dimensions, then sorts by score
// descending so the assembler (Part 5) can greedily include the best
// conversions within the available budget.
//
// Dimensions:
//   1. Coherence   (weight 0.4)  — How well does the output term fit with
//      the user's existing selections? Uses Phase 7.5 platform-level data
//      with cold-start affinity fallback (Part 3).
//   2. Cost Efficiency (weight 0.35) — How much budget does this conversion
//      consume relative to what's available? Parametric = always 1.0.
//   3. Impact      (weight 0.25) — How much value does this conversion add?
//      Static base impact overridden by learned term-quality scores.
//
// Gap 5 note: Weights (0.4, 0.35, 0.25) are manually tuned. NOT wired into
// Phase 6's weight recalibration engine yet — needs 30 days of conversion
// telemetry to correlate against. Acknowledged as a known limitation.
//
// Dependencies:
//   Part 1: ConversionEntry, getConversionCost() — candidate data + costs
//   Part 2: ConversionBudget — remaining budget + diminishing returns zone
//   Part 3: getWeightedAverageAffinity(), blendAffinity() — cold-start coherence
//   Phase 7.5: lookupPlatformTermQuality() — learned term quality
//   Phase 7.5: lookupPlatformCoOccurrence() — learned co-occurrence
//
// Authority: budget-aware-conversion-build-plan.md §Part 4
// Created: 2026-03-19
// Existing features preserved: Yes (new file, no modifications)
// ============================================================================

import type { ConversionEntry } from '@/lib/prompt-builder/conversion-costs';
import type { ConversionBudget } from '@/lib/prompt-builder/conversion-budget';
import type { TaggedSelection } from '@/lib/prompt-builder/conversion-affinities';
import {
  getWeightedAverageAffinity,
  blendAffinity,
  getColdStartAffinity,
} from '@/lib/prompt-builder/conversion-affinities';
import type { PlatformTermQualityLookup } from '@/lib/learning/platform-term-quality-lookup';
import { lookupPlatformTermQuality } from '@/lib/learning/platform-term-quality-lookup';
import type { PlatformCoOccurrenceLookup } from '@/lib/learning/platform-co-occurrence-lookup';
import { lookupPlatformCoOccurrence } from '@/lib/learning/platform-co-occurrence-lookup';
import type { PromptCategory } from '@/types/prompt-builder';

// ============================================================================
// Types
// ============================================================================

export interface ScoredConversion {
  /** User's original selection: "8K", "blurry" */
  from: string;
  /** Converted output: "--quality 2", "sharp focus" */
  to: string;
  /** Source category */
  category: 'fidelity' | 'negative';
  /** Final weighted score 0–1 */
  score: number;
  /** Dimension 1: coherence with existing selections (0–1) */
  coherence: number;
  /** Dimension 2: budget cost efficiency (0–1) */
  costEfficiency: number;
  /** Dimension 3: value impact of this conversion (0–1) */
  impact: number;
  /** Word cost of the conversion output */
  cost: number;
  /** Parametric = free, bypasses budget */
  isParametric: boolean;
  /** How reliable the cost measurement is */
  costConfidence: 'exact' | 'estimated';
  /**
   * Whether the conversion pushes into the diminishing returns zone.
   * true = conversion fits within optimal budget.
   * false = conversion exceeds optimal but is below diminishing returns ceiling.
   * null = no diminishing returns data available.
   */
  withinOptimal: boolean | null;
  /**
   * Improvement 2: Human-readable scoring breakdown for the transparency panel.
   * E.g. "Coherence: 0.82 (macro + sharp pair well) · Cost: 0.90 (2w/20 left) · Impact: 0.85"
   */
  scoreExplanation: string;
}

/** Scoring context — all data the scorer needs from the caller */
export interface ScoringContext {
  /** Platform slug (e.g., "midjourney", "flux") */
  platformId: string;
  /** Platform tier (1–4), null if unknown */
  tier: number | null;
  /** User's existing selections tagged with their category */
  taggedSelections: TaggedSelection[];
  /** Flat list of all selection term strings (for co-occurrence lookup) */
  allSelectionTerms: string[];
  /** Budget state from Part 2 */
  budget: ConversionBudget;
  /** Platform's impactPriority categories (for weighted affinity) */
  impactPriority?: PromptCategory[];

  // ── Learned data (null = cold start) ──
  /** Phase 7.5: platform-level term quality lookup */
  platformTermQualityLookup: PlatformTermQualityLookup | null;
  /** Phase 7.5: platform-level co-occurrence lookup */
  platformCoOccurrenceLookup: PlatformCoOccurrenceLookup | null;
}

// ============================================================================
// Scorer Weights — manually tuned (Gap 5)
// ============================================================================

const WEIGHT_COHERENCE = 0.4;
const WEIGHT_COST_EFFICIENCY = 0.35;
const WEIGHT_IMPACT = 0.25;

/**
 * Cost efficiency penalty applied in the diminishing returns zone.
 * Conversions that exceed optimal but stay below diminishing returns
 * get their costEfficiency multiplied by this factor instead of being
 * hard-blocked. (Part 2 Improvement 1)
 */
const DIMINISHING_RETURNS_PENALTY = 0.5;

// ============================================================================
// Static Impact Map
// ============================================================================
// Base impact per conversion from→to, overridable by learned data.
// Keyed by the output term (lowercase).
// ============================================================================

const STATIC_IMPACT: Record<string, number> = {
  // Negative → positive conversions (universal)
  'sharp focus': 0.9,
  'high quality': 0.85,
  'high resolution': 0.85,
  'smooth details': 0.8,
  'clean and smooth': 0.8,
  'pristine clarity': 0.85,
  'well-rendered': 0.75,
  'balanced exposure': 0.8,
  'well-illuminated': 0.75,
  'balanced colors': 0.75,
  'vibrant rich tones': 0.7,
  'clean image': 0.85,
  unmarked: 0.85,
  unsigned: 0.7,
  'logo-free': 0.7,
  borderless: 0.6,
  'full frame': 0.65,
  'empty scene': 0.7,
  'realistic rendering': 0.75,
  'photographic realism': 0.8,
  photographic: 0.75,
  'detailed rendering': 0.75,
  'natural look': 0.7,
  'complete composition': 0.7,
  'centered subject': 0.65,
  'unique composition': 0.6,
  'well-formed': 0.8,
  'correct proportions': 0.8,
  'natural appearance': 0.8,
  'anatomically correct': 0.85,
  'normal anatomy': 0.8,
  'correct hands': 0.85,
  'well-defined hands': 0.85,
  beautiful: 0.6,
  'pleasant mood': 0.4,
  'intact and whole': 0.6,

  // Fidelity NL conversions (platform-specific)
  'captured with extraordinary clarity': 0.7,
  'high-resolution detail': 0.65,
  'museum-quality composition': 0.6,
  'professional-grade photograph': 0.65,
  'fine-grained detail in every surface': 0.7,
  'hyper-detailed rendering with crystalline clarity': 0.7,
  'crisp high-resolution output': 0.65,
  'tack-sharp focus throughout': 0.7,
  'intricate surface textures visible': 0.65,
  'meticulously rendered fine details': 0.65,
  'delicate fine details preserved': 0.6,

  // MJ parametric conversions — high impact, always free
  '--quality 2': 0.85,
  '--stylize 300': 0.75,
};

/** Default impact for unknown conversion outputs */
const DEFAULT_IMPACT = 0.5;

// ============================================================================
// Main Scorer
// ============================================================================

/**
 * Score all conversion candidates and return sorted by score descending.
 *
 * @param candidates - ConversionEntry[] from Part 1 lookups
 * @param context    - Full scoring context (platform, selections, budget, learned data)
 * @returns ScoredConversion[] sorted by score descending (highest first)
 */
export function scoreConversions(
  candidates: ConversionEntry[],
  context: ScoringContext,
): ScoredConversion[] {
  // Deduplicate candidates by output term — multiple input terms may map
  // to the same output (e.g., "8K" and "4K" both → "--quality 2" on MJ).
  // Keep the first occurrence (preserves user's selection order).
  const deduped = deduplicateCandidates(candidates);

  const scored: ScoredConversion[] = deduped.map((candidate) => {
    const coherence = scoreCoherence(candidate, context);
    const costEfficiency = scoreCostEfficiency(candidate, context);
    const impact = scoreImpact(candidate, context);

    const finalScore =
      coherence * WEIGHT_COHERENCE +
      costEfficiency * WEIGHT_COST_EFFICIENCY +
      impact * WEIGHT_IMPACT;

    // Improvement 2: Build human-readable explanation
    const scoreExplanation = buildScoreExplanation(
      candidate, coherence, costEfficiency, impact, context,
    );

    return {
      from: candidate.from,
      to: candidate.output,
      category: candidate.category,
      score: clamp01(finalScore),
      coherence,
      costEfficiency,
      impact,
      cost: candidate.cost,
      isParametric: candidate.isParametric,
      costConfidence: candidate.costConfidence,
      withinOptimal: resolveWithinOptimal(candidate, context),
      scoreExplanation,
    };
  });

  // Sort by score descending — highest value conversions first
  scored.sort((a, b) => b.score - a.score);

  return scored;
}

// ============================================================================
// Dimension 1: Coherence (weight: 0.4)
// ============================================================================
// How well does the converted output term pair with the user's selections?
//
// Data sources (priority order):
//   1. Phase 7.5: lookupPlatformCoOccurrence() — learned platform pairs
//   2. Phase 7.5: lookupPlatformTermQuality() — learned term quality
//   3. Part 3: getWeightedAverageAffinity() — cold-start curated affinities
//
// Coherence = (termQuality × 0.5 + avgAffinity × 0.5), clamped 0–1
// ============================================================================

function scoreCoherence(
  candidate: ConversionEntry,
  context: ScoringContext,
): number {
  // Parametric conversions bypass coherence — they don't affect prompt meaning
  if (candidate.isParametric) return 0.8; // High but not perfect

  const outputTerm = candidate.output;

  // ── Term quality dimension ──
  // Phase 7.5 platform-level, with tier fallback (returns 0–100 scale)
  const rawTermQuality = lookupPlatformTermQuality(
    outputTerm,
    context.platformId,
    context.tier,
    context.platformTermQualityLookup,
    50, // Tier fallback score (neutral)
  );
  const termQuality = rawTermQuality / 100; // Normalise to 0–1

  // ── Affinity dimension ──
  // Try learned co-occurrence first, blend with cold-start
  const learnedCoOccurrence = lookupPlatformCoOccurrence(
    outputTerm,
    context.allSelectionTerms,
    context.platformId,
    context.tier,
    context.platformCoOccurrenceLookup,
    50, // Tier fallback weight (neutral)
  );
  const learnedAffinity = learnedCoOccurrence / 100; // Normalise to 0–1

  // Cold-start affinity (Part 3, category-weighted, Improvement 1)
  const coldStartAffinity = getWeightedAverageAffinity(
    outputTerm,
    context.taggedSelections,
    context.impactPriority,
  );

  // Blend cold-start with learned using confidence ramp
  // If learned data has any signal (> neutral 0.5), treat as having some confidence
  const learnedConfidence = Math.abs(learnedAffinity - 0.5) > 0.05 ? 0.5 : 0;
  const avgAffinity = blendAffinity(coldStartAffinity, learnedAffinity, learnedConfidence);

  // Coherence = equal blend of term quality and affinity
  return clamp01(termQuality * 0.5 + avgAffinity * 0.5);
}

// ============================================================================
// Dimension 2: Cost Efficiency (weight: 0.35)
// ============================================================================
// How much budget does this conversion consume?
//
// Parametric: always 1.0 (free)
// Inline: 1 - (cost / remaining), with diminishing returns zone support
// Zero budget: 0.0 for all non-parametric
// ============================================================================

function scoreCostEfficiency(
  candidate: ConversionEntry,
  context: ScoringContext,
): number {
  // Parametric = free, always perfect efficiency
  if (candidate.isParametric) return 1.0;

  const { remaining, diminishingReturnsAt, consumed } = context.budget;

  // Zero remaining budget → non-parametric can't fit
  if (remaining <= 0) return 0.0;

  // Standard efficiency: how much of the remaining budget does this cost?
  const baseEfficiency = Math.max(0, 1 - candidate.cost / Math.max(remaining, 1));

  // Part 2 Improvement 1: Diminishing returns soft zone
  // If the conversion fits within remaining (optimal), full efficiency.
  // If it exceeds remaining but total stays below diminishingReturnsAt,
  // apply a penalty instead of hard-blocking.
  if (candidate.cost > remaining && diminishingReturnsAt !== null) {
    const totalAfterConversion = consumed + candidate.cost;
    if (totalAfterConversion <= diminishingReturnsAt) {
      // In the soft zone — penalised but not blocked
      return baseEfficiency * DIMINISHING_RETURNS_PENALTY;
    }
    // Beyond diminishing returns — very low score
    return Math.max(0, baseEfficiency * 0.1);
  }

  // Part 2 Improvement 2: CLIP token double-check for Tier 1
  if (context.budget.clipTokenBudget) {
    const clipRemaining = context.budget.clipTokenBudget.remaining;
    // Rough CLIP token estimate: words × 1.3 (inverse of the ÷1.3 used for ceilings)
    const estimatedClipCost = Math.ceil(candidate.cost * 1.3);
    if (estimatedClipCost > clipRemaining) {
      // Would exceed CLIP token limit — penalise heavily
      return Math.max(0, baseEfficiency * 0.2);
    }
  }

  return clamp01(baseEfficiency);
}

// ============================================================================
// Dimension 3: Impact (weight: 0.25)
// ============================================================================
// How much value does this conversion add to the prompt?
//
// Base: static impact map (hand-tuned per conversion).
// Override: learned term-quality score when available (from Phase 6 nightly).
// ============================================================================

// ============================================================================
// Improvement 1: Context-Aware Impact Boosting
// ============================================================================
// When the user's style is "photorealistic" or similar realism styles,
// anatomy-fix conversions (correct hands, well-formed, etc.) are more
// valuable because realism is where AI anatomy issues are most visible.
//
// Map: style term → set of output terms that get a 1.2× impact boost.
// ============================================================================

const REALISM_STYLES = new Set([
  'photorealistic', 'hyperrealistic', 'portrait photography',
  'commercial photography', 'product photography', 'macro photography',
  'landscape photography', 'fashion photography', 'beauty photography',
  'architecture photography', 'street photography',
]);

/** Output terms that benefit from realism context */
const ANATOMY_FIX_OUTPUTS = new Set([
  'well-formed', 'correct proportions', 'natural appearance',
  'anatomically correct', 'normal anatomy', 'correct hands',
  'well-defined hands', 'sharp focus', 'tack-sharp focus throughout',
]);

/** Impact boost multiplier when realism style + anatomy fix */
const REALISM_ANATOMY_BOOST = 1.2;

/**
 * Check if the user's selections include a realism-oriented style.
 */
function hasRealismStyle(taggedSelections: TaggedSelection[]): boolean {
  return taggedSelections.some(
    (s) => s.category === 'style' && REALISM_STYLES.has(s.term.toLowerCase()),
  );
}

function scoreImpact(
  candidate: ConversionEntry,
  context: ScoringContext,
): number {
  const outputTerm = candidate.output;
  let baseImpact: number;

  // Try learned term quality as impact proxy
  // Phase 7.5 returns 0–100 scale; > 60 means better than average
  if (context.platformTermQualityLookup) {
    const learnedScore = lookupPlatformTermQuality(
      outputTerm,
      context.platformId,
      context.tier,
      context.platformTermQualityLookup,
      -1, // Sentinel: -1 means "no tier fallback, return -1 if no data"
    );

    if (learnedScore >= 0) {
      // Learned data exists — use it (normalised to 0–1)
      baseImpact = clamp01(learnedScore / 100);
    } else {
      baseImpact = STATIC_IMPACT[outputTerm] ?? DEFAULT_IMPACT;
    }
  } else {
    // Static fallback
    baseImpact = STATIC_IMPACT[outputTerm] ?? DEFAULT_IMPACT;
  }

  // Improvement 1: Context-aware boost for anatomy fixes in realism styles
  if (ANATOMY_FIX_OUTPUTS.has(outputTerm) && hasRealismStyle(context.taggedSelections)) {
    baseImpact = clamp01(baseImpact * REALISM_ANATOMY_BOOST);
  }

  return baseImpact;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Deduplicate candidates by output term.
 * Multiple inputs may map to the same output (e.g., "8K" + "4K" → "--quality 2").
 * Keep the first occurrence to preserve user's selection order.
 */
function deduplicateCandidates(candidates: ConversionEntry[]): ConversionEntry[] {
  const seen = new Set<string>();
  const deduped: ConversionEntry[] = [];

  for (const c of candidates) {
    if (!seen.has(c.output)) {
      seen.add(c.output);
      deduped.push(c);
    }
  }

  return deduped;
}

/**
 * Determine whether a conversion stays within the optimal budget zone
 * or pushes into diminishing returns.
 */
function resolveWithinOptimal(
  candidate: ConversionEntry,
  context: ScoringContext,
): boolean | null {
  if (candidate.isParametric) return true; // Free = always optimal
  if (context.budget.diminishingReturnsAt === null) return null; // No data

  const totalAfterConversion = context.budget.consumed + candidate.cost;
  return totalAfterConversion <= context.budget.ceiling;
}

/** Clamp a value between 0 and 1 */
function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

// ============================================================================
// Improvement 2: Score Explanation Builder
// ============================================================================

/**
 * Build a human-readable scoring breakdown for the transparency panel.
 *
 * Examples:
 *   "Parametric (free) · Impact: 0.85 · Always included"
 *   "Coherence: 0.82 (pairs well with macro) · Cost: 0.90 (2w / 20 left) · Impact: 0.85"
 *   "Coherence: 0.45 (conflicts with watercolour) · Cost: 0.70 · Impact: 0.60"
 */
function buildScoreExplanation(
  candidate: ConversionEntry,
  coherence: number,
  costEfficiency: number,
  impact: number,
  context: ScoringContext,
): string {
  const parts: string[] = [];

  if (candidate.isParametric) {
    parts.push('Parametric (free)');
    parts.push(`Impact: ${impact.toFixed(2)}`);
    parts.push('Always included');
    return parts.join(' · ');
  }

  // Coherence with best-matching selection term hint
  const coherenceHint = findBestAffinityHint(candidate.output, context);
  if (coherenceHint) {
    parts.push(`Coherence: ${coherence.toFixed(2)} (${coherenceHint})`);
  } else {
    parts.push(`Coherence: ${coherence.toFixed(2)}`);
  }

  // Cost with budget context
  const { remaining } = context.budget;
  parts.push(`Cost: ${costEfficiency.toFixed(2)} (${candidate.cost}w / ${remaining} left)`);

  // Impact
  parts.push(`Impact: ${impact.toFixed(2)}`);

  return parts.join(' · ');
}

/**
 * Find the most relevant affinity hint for the explanation string.
 * Returns a short description like "pairs well with macro" or "conflicts with watercolour".
 */
function findBestAffinityHint(
  outputTerm: string,
  context: ScoringContext,
): string | null {
  if (!context.taggedSelections.length) return null;

  let bestScore = 0.5;
  let bestTerm = '';
  let isConflict = false;

  for (const { term } of context.taggedSelections) {
    const affinity = getColdStartAffinity(outputTerm, term);
    if (affinity === null) continue;

    // Track the most extreme affinity (highest or lowest)
    if (Math.abs(affinity - 0.5) > Math.abs(bestScore - 0.5)) {
      bestScore = affinity;
      bestTerm = term;
      isConflict = affinity < 0.35;
    }
  }

  if (!bestTerm) return null;

  // Simplify long term names for the explanation
  const shortTerm = bestTerm.length > 20 ? bestTerm.slice(0, 18) + '…' : bestTerm;

  if (isConflict) {
    return `conflicts with ${shortTerm}`;
  }
  if (bestScore >= 0.8) {
    return `pairs well with ${shortTerm}`;
  }
  return null; // Neutral — no hint needed
}

// ============================================================================
// Utility: Build ScoringContext from assembler state
// ============================================================================

/**
 * Build TaggedSelection[] from PromptSelections.
 * Flattens all categories into a tagged array for the scorer.
 *
 * @param selections - User's selections by category
 * @returns TaggedSelection[] for coherence scoring
 */
export function buildTaggedSelections(
  selections: Partial<Record<PromptCategory, string[]>>,
): TaggedSelection[] {
  const tagged: TaggedSelection[] = [];

  for (const [category, terms] of Object.entries(selections)) {
    if (!terms?.length) continue;
    // Skip fidelity and negative — those are what we're converting
    if (category === 'fidelity' || category === 'negative') continue;

    for (const term of terms) {
      tagged.push({
        term,
        category: category as PromptCategory,
      });
    }
  }

  return tagged;
}

/**
 * Extract all selection terms as a flat string array.
 * Used for co-occurrence lookup which doesn't need category tags.
 *
 * @param selections - User's selections by category
 * @returns string[] of all selected terms (excluding fidelity + negative)
 */
export function flattenSelections(
  selections: Partial<Record<PromptCategory, string[]>>,
): string[] {
  const flat: string[] = [];

  for (const [category, terms] of Object.entries(selections)) {
    if (!terms?.length) continue;
    if (category === 'fidelity' || category === 'negative') continue;
    flat.push(...terms);
  }

  return flat;
}

// ============================================================================
// Exports for testing
// ============================================================================

export {
  WEIGHT_COHERENCE,
  WEIGHT_COST_EFFICIENCY,
  WEIGHT_IMPACT,
  DIMINISHING_RETURNS_PENALTY,
  STATIC_IMPACT,
  DEFAULT_IMPACT,
};

export { deduplicateCandidates as _deduplicateCandidates };
