// src/lib/call-2-harness/mechanical-scorer/coverage-rules.ts
// ============================================================================
// Call 2 Quality Harness — Input Element Coverage Rules (v1.0)
// ============================================================================
// Tests whether user-provided visual elements survive in tier outputs.
// Cluster: content_fidelity_loss
//
// v1.0: Basic substring + stem matching. Scenes must have `expected_elements`
// annotated in scenes.json — scenes without annotations skip these rules.
//
// Thresholds (per ChatGPT analysis, 12 Apr 2026):
//   T3: fail below 80% coverage
//   T4: fail below 75% coverage
//   T1: fail below 65% coverage (deferred — T1 has known P14 fragmentation)
//
// Authority: chatgpt-p14-and-coverage-brief.md §6
// ============================================================================

import type { RuleDefinition } from './types';

// ── Fuzzy matching (v1: stem + substring) ──────────────────────────────────

/**
 * Normalise a word for matching: lowercase, strip trailing s/es/ed/ing.
 * Deliberately naive — just enough to catch plurals and simple verb forms.
 */
function stem(word: string): string {
  let w = word.toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (w.endsWith('ing') && w.length > 5) w = w.slice(0, -3);
  if (w.endsWith('es') && w.length > 4) w = w.slice(0, -2);
  else if (w.endsWith('ed') && w.length > 4) w = w.slice(0, -2);
  else if (w.endsWith('s') && w.length > 3) w = w.slice(0, -1);
  return w;
}

/**
 * Check if an expected element survives in the output text.
 *
 * Three-layer match (v1):
 *   1. Exact substring (case-insensitive)
 *   2. All content words from the element appear in the output (stem-matched)
 *   3. Hyphen/whitespace normalisation ("purple-and-copper" matches "purple and copper")
 */
function elementSurvives(element: string, output: string): boolean {
  const lowerOutput = output.toLowerCase();
  const lowerElement = element.toLowerCase();

  // Layer 1: exact substring
  if (lowerOutput.includes(lowerElement)) return true;

  // Layer 1b: hyphen/whitespace normalisation
  const dehyphenated = lowerElement.replace(/-/g, ' ');
  if (lowerOutput.includes(dehyphenated)) return true;
  const rehyphenated = lowerElement.replace(/\s+/g, '-');
  if (lowerOutput.includes(rehyphenated)) return true;

  // Layer 2: all content words from element appear (stem-matched)
  const elementWords = lowerElement
    .split(/[\s-]+/)
    .filter((w) => w.length > 2) // skip "a", "of", "in" etc
    .map(stem);

  if (elementWords.length === 0) return false;

  const outputStems = lowerOutput
    .split(/[\s,.:;!?()"']+/)
    .filter(Boolean)
    .map(stem);

  const allWordsFound = elementWords.every((ew) =>
    outputStems.some((os) => os === ew || os.includes(ew) || ew.includes(os)),
  );

  return allWordsFound;
}

/**
 * Calculate element coverage for a tier output.
 * Returns { covered, total, missing[], coverageRate }.
 */
function checkCoverage(
  expectedElements: readonly string[],
  tierOutput: string,
): {
  covered: number;
  total: number;
  missing: string[];
  coverageRate: number;
} {
  const missing: string[] = [];

  for (const el of expectedElements) {
    if (!elementSurvives(el, tierOutput)) {
      missing.push(el);
    }
  }

  const covered = expectedElements.length - missing.length;
  const coverageRate = expectedElements.length > 0
    ? covered / expectedElements.length
    : 1;

  return { covered, total: expectedElements.length, missing, coverageRate };
}

// ── Rule definitions ───────────────────────────────────────────────────────

export const COVERAGE_RULES: readonly RuleDefinition[] = Object.freeze([
  {
    id: 'T3.input_element_coverage',
    tier: 3,
    cluster: 'content_fidelity_loss',
    description:
      'T3 must preserve ≥80% of user-provided visual elements. ' +
      'Skips scenes without expected_elements annotation.',
    check(bundle, ctx) {
      if (!ctx.expectedElements || ctx.expectedElements.length === 0) {
        return { passed: true }; // skip unannotated scenes
      }

      const result = checkCoverage(ctx.expectedElements, bundle.tier3.positive);

      if (result.coverageRate < 0.8) {
        return {
          passed: false,
          details:
            `T3 element coverage ${Math.round(result.coverageRate * 100)}% ` +
            `(${result.covered}/${result.total}). ` +
            `Missing: ${result.missing.join(', ')}`,
        };
      }

      return {
        passed: true,
        details:
          result.missing.length > 0
            ? `T3 coverage ${Math.round(result.coverageRate * 100)}% — ` +
              `missing: ${result.missing.join(', ')}`
            : undefined,
      };
    },
  },

  {
    id: 'T4.input_element_coverage',
    tier: 4,
    cluster: 'content_fidelity_loss',
    description:
      'T4 must preserve ≥75% of user-provided visual elements. ' +
      'Skips scenes without expected_elements annotation.',
    check(bundle, ctx) {
      if (!ctx.expectedElements || ctx.expectedElements.length === 0) {
        return { passed: true };
      }

      const result = checkCoverage(ctx.expectedElements, bundle.tier4.positive);

      if (result.coverageRate < 0.75) {
        return {
          passed: false,
          details:
            `T4 element coverage ${Math.round(result.coverageRate * 100)}% ` +
            `(${result.covered}/${result.total}). ` +
            `Missing: ${result.missing.join(', ')}`,
        };
      }

      return {
        passed: true,
        details:
          result.missing.length > 0
            ? `T4 coverage ${Math.round(result.coverageRate * 100)}% — ` +
              `missing: ${result.missing.join(', ')}`
            : undefined,
      };
    },
  },
]);
