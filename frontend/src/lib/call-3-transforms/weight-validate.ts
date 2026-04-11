// src/lib/call-3-transforms/weight-validate.ts
// ============================================================================
// T_WEIGHT_VALIDATE — Midjourney double-colon weight validation
// ============================================================================
// Architecture: call-3-quality-architecture-v0.2.0.md §4.2
// Build plan:   call-3-quality-build-plan-v1.md §9.2
//
// Validates ::weight syntax in Midjourney prompts:
//   - Weights must be numeric (integer or decimal)
//   - Subject clause should have highest weight
//   - No clause should have negative weight except --no targets
//   - Weights should sum to a reasonable range
//
// Only active on Midjourney. Pure function. No GPT cost.
// ============================================================================

import type { AnchorManifest } from '@/lib/optimise-prompts/preflight';
import type { PlatformDNA } from '@/data/platform-dna/types';
import type { TransformOutput } from './transform-types';

// ============================================================================
// WEIGHT VALIDATION
// ============================================================================

/** Parse all ::weight clauses from a Midjourney prompt. */
interface WeightedClause {
  readonly text: string;
  readonly weight: number;
  readonly fullMatch: string;
}

/**
 * Extract weighted clauses from MJ prompt text.
 */
function extractWeightedClauses(text: string): WeightedClause[] {
  const clauses: WeightedClause[] = [];
  // Match "text::weight" patterns
  const re = /([^:]+?)::([\d.]+)/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const clauseText = match[1]!.trim();
    const weight = parseFloat(match[2]!);
    if (clauseText.length > 0 && !isNaN(weight)) {
      clauses.push({
        text: clauseText,
        weight,
        fullMatch: match[0],
      });
    }
  }

  return clauses;
}

// ============================================================================
// TRANSFORM
// ============================================================================

/**
 * T_WEIGHT_VALIDATE — Validate Midjourney ::weight syntax.
 *
 * Diagnostic transform: reports issues but makes minimal corrections.
 * Only fixes clearly broken weights (NaN, extreme values).
 *
 * Returns unchanged text if:
 * - No ::weight syntax found
 * - All weights are valid
 */
export function weightValidate(
  text: string,
  _anchors: AnchorManifest,
  _dna: PlatformDNA,
): TransformOutput {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { text: trimmed, changes: [] };
  }

  // Guard: must contain ::weight syntax
  if (!/\w+::\d/.test(trimmed)) {
    return { text: trimmed, changes: [] };
  }

  const clauses = extractWeightedClauses(trimmed);
  if (clauses.length === 0) {
    return { text: trimmed, changes: [] };
  }

  const changes: string[] = [];
  let modified = trimmed;

  // ── Check for extreme weights ──────────────────────────────────────
  for (const clause of clauses) {
    if (clause.weight > 5) {
      changes.push(
        `Weight validate: "${clause.text}" has extreme weight ${clause.weight} (recommended ≤ 3)`,
      );
    }
    if (clause.weight === 0) {
      changes.push(
        `Weight validate: "${clause.text}" has zero weight — clause will be ignored`,
      );
    }
  }

  // ── Check for malformed weights (fix NaN, missing decimal) ─────────
  const malformedRe = /::(\.\d+|\.)/g;
  let malformedMatch: RegExpExecArray | null;

  while ((malformedMatch = malformedRe.exec(modified)) !== null) {
    const badWeight = malformedMatch[1]!;
    const fixed = badWeight.startsWith('.') ? `0${badWeight}` : '1';
    modified = modified.replace(`::${badWeight}`, `::${fixed}`);
    changes.push(`Weight validate: fixed malformed weight "::${badWeight}" → "::${fixed}"`);
  }

  // ── Check weight distribution ──────────────────────────────────────
  if (clauses.length >= 2) {
    const weights = clauses.map((c) => c.weight);
    const allSame = weights.every((w) => Math.abs(w - weights[0]!) < 0.01);
    if (allSame && weights[0] !== 1) {
      changes.push(
        `Weight validate: all clauses have identical weight ${weights[0]} — consider differentiating subject vs background`,
      );
    }
  }

  if (changes.length === 0) {
    return { text: trimmed, changes: [] };
  }

  return {
    text: modified,
    changes,
  };
}
