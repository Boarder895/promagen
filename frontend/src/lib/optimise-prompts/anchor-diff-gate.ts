// src/lib/optimise-prompts/anchor-diff-gate.ts
// ============================================================================
// ANCHOR-DIFF GATE — Deterministic assembled-vs-optimised comparison
// ============================================================================
// Compares the assembled prompt against the GPT-optimised prompt by extracting
// meaningful noun phrases and diffing them. If the optimised version:
//   1. Loses more than N named anchors (default: 2), or
//   2. Shrinks by more than P% (default: 15%)
// → the gate returns REJECT, and the caller should fall back to assembled.
//
// v1 (02 Apr 2026): Initial build.
// v2 (02 Apr 2026): Fixed overfiring bug — n-gram extraction was creating
//   phantom anchors that spanned clause boundaries (commas, periods, semicolons).
//   "above cold blue" extracted from "window above. Cold blue shafts" would
//   never match in raw text because the period breaks includes(). Fix: split
//   into clauses BEFORE extracting n-grams. Comparison now uses the same
//   normalised text as extraction.
//
// Authority: api-3.md, trend-analysis batches 1-4
// ============================================================================

export interface AnchorDiffResult {
  verdict: 'ACCEPT' | 'REJECT';
  reason: string;
  assembledAnchors: string[];
  optimisedAnchors: string[];
  missingAnchors: string[];
  lengthRatio: number;
}

// ============================================================================
// ANCHOR EXTRACTION
// ============================================================================

/**
 * Normalises text for anchor comparison — strips weight syntax, lowercases,
 * collapses whitespace. Does NOT strip clause-boundary punctuation (that's
 * handled by splitting into clauses first).
 */
function normaliseForComparison(text: string): string {
  return text
    .toLowerCase()
    // Strip weight syntax
    .replace(/\([^()]+:\d+\.?\d*\)/g, match =>
      match.replace(/[():]/g, '').replace(/\d+\.?\d*/g, '').trim()
    )
    .replace(/\w[\w\s-]*::\d+\.?\d*/g, match => match.replace(/::\d+\.?\d*/g, ''))
    .replace(/\s*--\w+\s*[^\s,]*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Splits text into clauses at sentence and phrase boundaries.
 * N-grams are extracted per-clause so they never span a comma or period.
 */
function splitIntoClauses(text: string): string[] {
  return text
    .split(/[,.;:!?—–]+/)
    .map(clause => clause.replace(/["']/g, '').trim())
    .filter(clause => clause.length > 0);
}

/**
 * Extracts meaningful noun phrases from a prompt.
 *
 * Strategy: split into clauses at punctuation boundaries, then extract
 * 2-3 word n-grams within each clause that contain visual keywords.
 * This ensures anchors like "weathered fox shrine" are real compound
 * concepts, not accidental fragments like "above cold blue" that span
 * a period.
 */
function extractAnchors(text: string): string[] {
  const normalised = normaliseForComparison(text);
  const clauses = splitIntoClauses(normalised);
  const anchors = new Set<string>();

  for (const clause of clauses) {
    const words = clause.split(' ').filter(w => w.length > 0);

    // Extract 2-word and 3-word phrases within this clause only
    for (let len = 3; len >= 2; len--) {
      for (let i = 0; i <= words.length - len; i++) {
        const phrase = words.slice(i, i + len).join(' ');
        if (isVisualPhrase(phrase)) {
          anchors.add(phrase);
        }
      }
    }
  }

  // Also extract individual distinctive words
  const allWords = normalised.split(/\s+/).filter(w => w.length > 0);
  for (const w of allWords) {
    if (isDistinctiveWord(w)) {
      anchors.add(w);
    }
  }

  return [...anchors].sort();
}

/** Words that signal a visual anchor when part of a phrase */
function isVisualPhrase(phrase: string): boolean {
  // Contains a colour
  if (/\b(red|blue|green|gold|amber|silver|copper|purple|orange|black|white|grey|gray|dark|pale|warm|cool|crimson|emerald|violet|indigo|scarlet|teal|ivory|bronze)\b/.test(phrase)) return true;
  // Contains a material/texture
  if (/\b(stone|wood|iron|glass|silk|moss|mist|rain|ice|snow|sand|dust|smoke|fog|brick|steel|leather|timber|cedar|oak|marble|granite|slate|coral|clay|silt)\b/.test(phrase)) return true;
  // Contains a hyphenated compound (e.g., moss-slick, weed-wrapped)
  if (phrase.includes('-')) return true;
  // Contains an atmosphere word
  if (/\b(lantern|candle|flame|torch|moonlight|twilight|dawn|dusk|starlight|firelight|shadow|glow|beam|shimmer)\b/.test(phrase)) return true;
  return false;
}

/** Individual words distinctive enough to be anchors on their own */
function isDistinctiveWord(word: string): boolean {
  if (/^(amber|crimson|emerald|violet|indigo|scarlet|teal|ivory|bronze|copper|gold|silver)$/.test(word)) return true;
  if (/^(shrine|lighthouse|lantern|altar|stream|ribbons|reliquary|cathedral)$/.test(word)) return true;
  return false;
}

// ============================================================================
// GATE
// ============================================================================

/**
 * Compares assembled prompt against optimised prompt.
 * Returns REJECT if too many anchors were lost or prompt was shortened too much.
 *
 * @param assembled  The assembled prompt (Call 2 output)
 * @param optimised  The GPT-optimised prompt (Call 3 output)
 * @param maxAnchorLoss  Maximum number of anchors that can be missing (default: 2)
 * @param minLengthRatio  Minimum length ratio optimised/assembled (default: 0.85)
 */
export function anchorDiffGate(
  assembled: string,
  optimised: string,
  maxAnchorLoss = 2,
  minLengthRatio = 0.85,
): AnchorDiffResult {
  const assembledAnchors = extractAnchors(assembled);
  const optimisedAnchors = extractAnchors(optimised);

  // Compare using the SAME normalisation as extraction — not raw text.
  // This prevents false misses from punctuation differences.
  const optimisedNormalised = normaliseForComparison(optimised);
  const missingAnchors = assembledAnchors.filter(
    anchor => !optimisedNormalised.includes(anchor)
  );

  // Length ratio
  const lengthRatio = assembled.length > 0
    ? optimised.length / assembled.length
    : 1;

  // Decision
  const anchorLossTooHigh = missingAnchors.length > maxAnchorLoss;
  const tooShort = lengthRatio < minLengthRatio;

  if (anchorLossTooHigh || tooShort) {
    const reasons: string[] = [];
    if (anchorLossTooHigh) {
      reasons.push(`Lost ${missingAnchors.length} anchors (max ${maxAnchorLoss}): ${missingAnchors.slice(0, 5).join(', ')}`);
    }
    if (tooShort) {
      reasons.push(`Prompt shortened to ${Math.round(lengthRatio * 100)}% (min ${Math.round(minLengthRatio * 100)}%)`);
    }

    return {
      verdict: 'REJECT',
      reason: reasons.join('; '),
      assembledAnchors,
      optimisedAnchors,
      missingAnchors,
      lengthRatio,
    };
  }

  return {
    verdict: 'ACCEPT',
    reason: `${missingAnchors.length} anchors lost (within tolerance), ${Math.round(lengthRatio * 100)}% length ratio`,
    assembledAnchors,
    optimisedAnchors,
    missingAnchors,
    lengthRatio,
  };
}
