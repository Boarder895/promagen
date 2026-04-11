// src/lib/call-3-transforms/weight-rebalance.ts
// ============================================================================
// T_WEIGHT_REBALANCE — CLIP weight redistribution by visual category
// ============================================================================
// Architecture: call-3-quality-architecture-v0.2.0.md §4.2
// Build plan:   call-3-quality-build-plan-v1.md §9.2
//
// Rebalances CLIP weights so the subject gets highest emphasis,
// environment/lighting moderate, and atmosphere/style/quality lowest.
// This respects CLIP's attention distribution — front tokens with
// high weights dominate the conditioning vector.
//
// Supports two syntax modes:
//   parenthetical: (term:1.3) — Stability, DreamLike, Fotor
//   double_colon:  term::1.3  — Leonardo
//
// Only active on CLIP platforms with weight syntax support.
// Pure function. No content invented. Only WEIGHTS change.
// ============================================================================

import type { AnchorManifest } from '@/lib/optimise-prompts/preflight';
import type { PlatformDNA } from '@/data/platform-dna/types';
import type { TransformOutput } from './transform-types';
import { classifyVisualCategory } from './attention-sequence';

// ============================================================================
// WEIGHT TARGETS BY VISUAL CATEGORY
// ============================================================================

/**
 * Target weight ranges by visual category.
 * Subject and action get the highest weights — they define what
 * CLIP conditions on most strongly.
 *
 * Values are working hypotheses (architecture §3.2) calibrated
 * from manual testing on Stability and Leonardo.
 */
const WEIGHT_TARGETS: Record<string, { min: number; max: number; ideal: number }> = {
  subject:        { min: 1.2, max: 1.5, ideal: 1.3 },
  action:         { min: 1.1, max: 1.4, ideal: 1.2 },
  environment:    { min: 1.0, max: 1.3, ideal: 1.1 },
  lighting:       { min: 0.9, max: 1.2, ideal: 1.0 },
  colour:         { min: 0.9, max: 1.2, ideal: 1.0 },
  materials:      { min: 0.9, max: 1.1, ideal: 1.0 },
  composition:    { min: 0.8, max: 1.1, ideal: 0.9 },
  camera:         { min: 0.8, max: 1.1, ideal: 0.9 },
  atmosphere:     { min: 0.8, max: 1.0, ideal: 0.8 },
  style:          { min: 0.8, max: 1.0, ideal: 0.9 },
  quality_prefix: { min: 1.0, max: 1.2, ideal: 1.1 },
  quality_suffix: { min: 0.8, max: 1.0, ideal: 0.9 },
};

const DEFAULT_TARGET = { min: 0.9, max: 1.1, ideal: 1.0 };

// ============================================================================
// WEIGHT PARSING
// ============================================================================

interface WeightedSegment {
  /** The text content (without weight syntax) */
  readonly content: string;
  /** Original weight value (1.0 if unweighted) */
  readonly originalWeight: number;
  /** Visual category classification */
  readonly category: string;
  /** The full original text (with weight syntax) */
  readonly raw: string;
}

/** Parse parenthetical weights: (term:1.3) */
const PAREN_WEIGHT_RE = /^\((.+?):([\d.]+)\)$/;

/** Parse double-colon weights: term::1.3 */
const DCOLON_WEIGHT_RE = /^(.+?)::([\d.]+)$/;

/**
 * Parse a comma-separated prompt into weighted segments.
 */
function parseWeightedSegments(
  text: string,
  syntaxMode: 'parenthetical' | 'double_colon',
  anchors: AnchorManifest,
): WeightedSegment[] {
  const segments = text.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  const re = syntaxMode === 'parenthetical' ? PAREN_WEIGHT_RE : DCOLON_WEIGHT_RE;

  return segments.map((raw) => {
    const match = raw.match(re);
    if (match) {
      const content = match[1]!.trim();
      const weight = parseFloat(match[2]!);
      return {
        content,
        originalWeight: isNaN(weight) ? 1.0 : weight,
        category: classifyVisualCategory(content, anchors),
        raw,
      };
    }
    return {
      content: raw,
      originalWeight: 1.0,
      category: classifyVisualCategory(raw, anchors),
      raw,
    };
  });
}

/**
 * Reassemble a segment with the specified weight.
 */
function formatWeighted(
  content: string,
  weight: number,
  syntaxMode: 'parenthetical' | 'double_colon',
): string {
  // Don't apply weight syntax if weight is default (1.0)
  if (Math.abs(weight - 1.0) < 0.05) {
    return content;
  }
  const w = weight.toFixed(1);
  return syntaxMode === 'parenthetical'
    ? `(${content}:${w})`
    : `${content}::${w}`;
}

// ============================================================================
// TRANSFORM
// ============================================================================

/**
 * T_WEIGHT_REBALANCE — Redistribute CLIP weights by visual category.
 *
 * Algorithm:
 *   1. Skip if platform syntax mode doesn't support weights
 *   2. Parse prompt into weighted segments
 *   3. Classify each segment's visual category
 *   4. If a segment's weight is outside the target range for its category,
 *      nudge it toward the ideal
 *   5. Reassemble with adjusted weights
 *
 * Conservative: only adjusts weights that are clearly wrong (outside
 * the target range). Does not touch weights already in the sweet spot.
 *
 * Returns unchanged text if:
 * - Platform doesn't support weights
 * - No weights are outside their target range
 * - Prompt has no weight syntax
 */
export function weightRebalance(
  text: string,
  anchors: AnchorManifest,
  dna: PlatformDNA,
): TransformOutput {
  // Guard: only for platforms with weight syntax
  if (dna.syntaxMode !== 'parenthetical' && dna.syntaxMode !== 'double_colon') {
    return { text, changes: [] };
  }

  // TypeScript narrowing: after the guard, syntaxMode is 'parenthetical' | 'double_colon'
  const syntaxMode: 'parenthetical' | 'double_colon' = dna.syntaxMode;

  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { text: trimmed, changes: [] };
  }

  // Guard: prompt must contain weight syntax
  const hasWeights = syntaxMode === 'parenthetical'
    ? /\([^()]+:\d+\.?\d*\)/.test(trimmed)
    : /\w+::\d+\.?\d*/.test(trimmed);

  if (!hasWeights) {
    return { text: trimmed, changes: [] };
  }

  // ── Parse and classify ─────────────────────────────────────────────
  const segments = parseWeightedSegments(trimmed, syntaxMode, anchors);

  // ── Rebalance ──────────────────────────────────────────────────────
  const changes: string[] = [];
  let anyChanged = false;

  const rebalanced = segments.map((seg) => {
    const target = WEIGHT_TARGETS[seg.category] ?? DEFAULT_TARGET;

    // Only adjust if current weight is outside the target range
    if (seg.originalWeight >= target.min && seg.originalWeight <= target.max) {
      return seg.raw; // Already in sweet spot
    }

    // Nudge toward ideal (don't force exact ideal — preserve user intent)
    let newWeight: number;
    if (seg.originalWeight < target.min) {
      newWeight = target.min;
    } else {
      newWeight = target.max;
    }

    // Round to 1 decimal place
    newWeight = Math.round(newWeight * 10) / 10;

    // Don't change if the adjustment is trivial
    if (Math.abs(newWeight - seg.originalWeight) < 0.1) {
      return seg.raw;
    }

    anyChanged = true;
    changes.push(
      `Weight rebalance: "${seg.content}" (${seg.category}) ${seg.originalWeight.toFixed(1)} → ${newWeight.toFixed(1)}`,
    );
    return formatWeighted(seg.content, newWeight, syntaxMode);
  });

  if (!anyChanged) {
    return { text: trimmed, changes: [] };
  }

  return {
    text: rebalanced.join(', '),
    changes,
  };
}
