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
// This replaces noisy heuristic detectors (redundant-phrase, invented-content)
// that the trend batches 1-4 documented as "overfiring or misclassifying
// legitimate repeated anchor phrases."
//
// The gate is purely deterministic — no LLM call, no API cost, no false
// positives from pattern-matching. It catches the exact failure family
// documented in all 4 trend batches:
//   - GPT trims "deep in" to "in a" (anchor loss)
//   - GPT drops compound adjectives (anchor loss)
//   - GPT adds filler that inflates length but loses anchors
//   - GPT shortens prompts despite "do not shorten" instructions
//
// Usage in regression-guard.ts:
//   import { anchorDiffGate } from './anchor-diff-gate';
//   const gate = anchorDiffGate(assembledPrompt, optimisedPrompt);
//   if (gate.verdict === 'REJECT') {
//     return { prompt: assembledPrompt, reason: gate.reason };
//   }
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
 * Extracts meaningful noun phrases from a prompt.
 *
 * Strategy: split into words, extract compound adjective-noun clusters
 * (2-4 words) that represent visual anchors. We don't need NLP —
 * prompt language is highly structured and the failure patterns are
 * specific enough that simple tokenisation catches them.
 *
 * Examples of anchors extracted:
 *   "weathered fox shrine" → ["weathered fox shrine"]
 *   "soft amber pool" → ["soft amber pool"]
 *   "moss-slick stone" → ["moss-slick stone"]
 *   "red prayer ribbons" → ["red prayer ribbons"]
 *   "pale mist" → ["pale mist"]
 */
function extractAnchors(text: string): string[] {
  const normalised = text
    .toLowerCase()
    // Strip weight syntax so we compare content only
    .replace(/\([^()]+:\d+\.?\d*\)/g, match => match.replace(/[():]/g, '').replace(/\d+\.?\d*/g, '').trim())
    .replace(/\w[\w\s-]*::\d+\.?\d*/g, match => match.replace(/::\d+\.?\d*/g, ''))
    .replace(/\s*--\w+\s*[^\s,]*/g, '')
    // Normalise punctuation
    .replace(/[,.;:!?"'—–]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = normalised.split(' ').filter(w => w.length > 0);
  const anchors = new Set<string>();

  // Extract 2-word, 3-word, and 4-word phrases
  for (let len = 4; len >= 2; len--) {
    for (let i = 0; i <= words.length - len; i++) {
      const phrase = words.slice(i, i + len).join(' ');
      // Keep phrases that contain at least one adjective-like word + one noun-like word
      // Simple heuristic: phrases with a hyphenated word or a colour/texture word
      if (isVisualPhrase(phrase)) {
        anchors.add(phrase);
      }
    }
  }

  // Also extract individual distinctive words (colours, materials)
  const distinctiveWords = words.filter(w => isDistinctiveWord(w) && w.length > 3);
  for (const w of distinctiveWords) {
    anchors.add(w);
  }

  return [...anchors].sort();
}

/** Words that signal a visual anchor when part of a phrase */
function isVisualPhrase(phrase: string): boolean {
  // Contains a colour
  if (/\b(red|blue|green|gold|amber|silver|copper|purple|orange|black|white|grey|gray|dark|pale|warm|cool|crimson|emerald|violet|indigo|scarlet|teal|ivory|bronze)\b/.test(phrase)) return true;
  // Contains a material/texture
  if (/\b(stone|wood|iron|glass|silk|moss|mist|rain|ice|snow|sand|dust|smoke|fog|brick|steel|leather|timber|cedar|oak|marble|granite|slate|coral|clay)\b/.test(phrase)) return true;
  // Contains a hyphenated compound (e.g., moss-slick, storm-darkened)
  if (phrase.includes('-')) return true;
  // Contains an atmosphere word
  if (/\b(lantern|candle|flame|torch|moonlight|twilight|dawn|dusk|starlight|firelight|shadow|glow|beam|shimmer)\b/.test(phrase)) return true;
  return false;
}

/** Individual words distinctive enough to be anchors on their own */
function isDistinctiveWord(word: string): boolean {
  // Colours
  if (/^(amber|crimson|emerald|violet|indigo|scarlet|teal|ivory|bronze|copper|gold|silver)$/.test(word)) return true;
  // Specific nouns that are scene-defining
  if (/^(shrine|lighthouse|lantern|altar|stream|ribbons)$/.test(word)) return true;
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

  // Find anchors present in assembled but missing from optimised
  const optimisedLower = optimised.toLowerCase();
  const missingAnchors = assembledAnchors.filter(
    anchor => !optimisedLower.includes(anchor)
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
