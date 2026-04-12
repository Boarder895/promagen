// src/lib/call-3-transforms/negative-intelligence.ts
// ============================================================================
// PHASE 9 — Negative Intelligence Engine (Tier A — Deterministic)
// ============================================================================
// Architecture: call-3-quality-architecture-v0.2.0.md §7
// Build plan:   call-3-quality-build-plan-v1.md §13
//
// Generates platform-appropriate negative prompts deterministically.
// Zero GPT cost. Uses encoder family, negative mode, and hallucination
// map from DNA profiles.
//
// Tier A (this file): Deterministic pattern-based negatives.
//   - Standard CLIP negative vocabulary from community research
//   - MJ: max 4 terms via --no flag
//   - T5: generally unnecessary (returns null)
//   - Proprietary: platform-specific based on known patterns
//   - Scene-aware: avoids contradicting positive content
//
// Tier B (future, Phase 11+): GPT-generated contextual negatives.
//   Only fires when testing proves Tier B adds ≥2pt gain over Tier A.
//
// Returns null for platforms where negatives are 'none' or 'counterproductive'.
// ============================================================================

import type { AnchorManifest } from '@/lib/optimise-prompts/preflight';
import type { PlatformDNA, EncoderFamily } from '@/data/platform-dna/types';

// ============================================================================
// TYPES
// ============================================================================

/** Result of negative generation. */
export interface NegativeResult {
  /** The generated negative prompt text (null if negatives not supported) */
  readonly negative: string | null;
  /** How the negative was generated */
  readonly source: 'tier_a_standard' | 'tier_a_hallucination' | 'tier_a_combined' | 'none';
  /** Human-readable change descriptions */
  readonly changes: readonly string[];
  /** Number of terms in the negative prompt */
  readonly termCount: number;
}

// ============================================================================
// TIER A — Standard Negative Vocabularies by Encoder Family
// ============================================================================

/**
 * CLIP standard negatives — community-researched terms that CLIP
 * associates with low-quality training data.
 * Architecture §7.2: "Standard CLIP negative vocabulary from community research"
 */
const CLIP_STANDARD_NEGATIVES: readonly string[] = [
  'blurry',
  'low quality',
  'bad anatomy',
  'watermark',
  'text',
  'signature',
  'cropped',
  'deformed',
  'disfigured',
  'duplicate',
  'error',
  'extra limbs',
  'mutation',
  'ugly',
  'worst quality',
];

/**
 * Midjourney negative terms — max 4 via --no flag.
 * Architecture §7.2: "5+ terms reduce quality (confirmed by MJ founder)"
 */
const MJ_STANDARD_NEGATIVES: readonly string[] = [
  'blurry',
  'watermark',
  'text',
  'deformed',
];

/** MJ hard cap on negative term count. */
const MJ_MAX_NEGATIVE_TERMS = 4;

/**
 * Proprietary NL platforms — minimal, conservative negatives.
 * These platforms process negatives semantically, not as CLIP tokens.
 */
const NL_STANDARD_NEGATIVES: readonly string[] = [
  'blurry',
  'low quality',
  'watermark',
  'text overlay',
  'cropped',
];

/**
 * Curly-brace platforms (NovelAI) — standard anime/illustration negatives.
 */
const CURLY_BRACE_STANDARD_NEGATIVES: readonly string[] = [
  'lowres',
  'bad anatomy',
  'bad hands',
  'text',
  'error',
  'missing fingers',
  'extra digit',
  'fewer digits',
  'cropped',
  'worst quality',
  'low quality',
  'normal quality',
];

// ============================================================================
// SCENE-AWARE FILTERING
// ============================================================================

/**
 * Remove negative terms that contradict positive content.
 *
 * Example: if the positive prompt mentions "watermark" as a desired
 * element (vintage photo effect), don't include "watermark" in negatives.
 *
 * Also avoids contradicting key anchors — if the positive says "text",
 * we don't negate "text".
 */
function filterContradictions(
  negatives: readonly string[],
  positiveText: string,
  anchors: AnchorManifest,
): string[] {
  const positiveLower = positiveText.toLowerCase();

  // Collect all positive terms to check against
  const positiveTerms = new Set<string>();

  // Add anchor terms
  for (const colour of anchors.colours) positiveTerms.add(colour.toLowerCase());
  for (const light of anchors.lightSources) positiveTerms.add(light.toLowerCase());
  for (const env of anchors.environmentNouns) positiveTerms.add(env.toLowerCase());
  for (const verb of anchors.actionVerbs) positiveTerms.add(verb.toLowerCase());
  if (anchors.subjectPhrase) {
    for (const word of anchors.subjectPhrase.toLowerCase().split(/\s+/)) {
      if (word.length > 3) positiveTerms.add(word);
    }
  }

  return negatives.filter((neg) => {
    const negLower = neg.toLowerCase();
    const negWords = negLower.split(/\s+/);

    // Don't negate a term that appears as a desired element in the positive
    for (const word of negWords) {
      if (word.length > 3 && positiveTerms.has(word)) return false;
      if (positiveLower.includes(negLower)) return false;
    }

    return true;
  });
}

// ============================================================================
// HALLUCINATION MAP INTEGRATION
// ============================================================================

/**
 * Extract relevant negative terms from the hallucination map.
 * Only uses entries with severity 'medium' or 'high'.
 */
function extractHallucinationNegatives(
  hallucinationMap: PlatformDNA['hallucinationMap'],
): string[] {
  if (!hallucinationMap) return [];

  const terms: string[] = [];

  for (const entries of Object.values(hallucinationMap)) {
    if (!entries) continue;
    for (const entry of entries) {
      if (entry.severity === 'medium' || entry.severity === 'high') {
        // Extract a usable negative term from the pattern description
        // Only use short patterns that work as negative terms
        if (entry.pattern.length <= 30) {
          terms.push(entry.pattern);
        }
      }
    }
  }

  return terms;
}

// ============================================================================
// STANDARD NEGATIVE SELECTION BY ENCODER FAMILY
// ============================================================================

/**
 * Get the standard negative vocabulary for an encoder family.
 */
function getStandardNegatives(
  encoderFamily: EncoderFamily,
  syntaxMode: PlatformDNA['syntaxMode'],
): readonly string[] {
  switch (encoderFamily) {
    case 'clip':
      return syntaxMode === 'curly_brace'
        ? CURLY_BRACE_STANDARD_NEGATIVES
        : CLIP_STANDARD_NEGATIVES;

    case 'llm_semantic':
      return MJ_STANDARD_NEGATIVES; // Midjourney / Kling

    case 't5':
      return []; // T5 handles positive-only well (architecture §7.2)

    case 'llm_rewrite':
      return []; // DALL-E: no negative support

    case 'proprietary':
      return NL_STANDARD_NEGATIVES;

    default:
      return NL_STANDARD_NEGATIVES;
  }
}

// ============================================================================
// NEGATIVE FORMAT — Platform syntax
// ============================================================================

/**
 * Format negatives for the platform's syntax mode.
 *
 * - separate: comma-separated list (most platforms)
 * - inline: --no term1, term2 (Midjourney, BluWillow)
 * - converted: platform-specific (rare)
 */
function formatNegative(
  terms: readonly string[],
  dna: PlatformDNA,
): string {
  if (terms.length === 0) return '';

  switch (dna.negativeMode) {
    case 'inline':
      // MJ-style: --no term1, term2 (max 4 terms)
      return `--no ${terms.slice(0, MJ_MAX_NEGATIVE_TERMS).join(', ')}`;

    case 'separate_field':
    case 'converted':
      return terms.join(', ');

    default:
      return terms.join(', ');
  }
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

/**
 * Generate a platform-appropriate negative prompt (Tier A — deterministic).
 *
 * Algorithm:
 *   1. Check if platform supports negatives (mode != 'none' / 'counterproductive')
 *   2. Get standard negatives for encoder family
 *   3. Add hallucination map terms (if available)
 *   4. Filter contradictions against positive content
 *   5. Apply platform-specific limits (MJ: max 4 terms)
 *   6. Format for platform syntax
 *
 * @param positiveText  The positive prompt text (assembled or optimised)
 * @param dna           Platform DNA profile
 * @param anchors       Anchor manifest from the positive prompt
 * @returns             NegativeResult with generated negative or null
 */
export function generateNegative(
  positiveText: string,
  dna: PlatformDNA,
  anchors: AnchorManifest,
): NegativeResult {
  // ── Guard: platform doesn't support negatives ──────────────────────
  if (dna.negativeMode === 'none' || dna.negativeMode === 'counterproductive') {
    return {
      negative: null,
      source: 'none',
      changes: [
        dna.negativeMode === 'counterproductive'
          ? `Negative intelligence: skipped — negatives are counterproductive for ${dna.id}`
          : `Negative intelligence: skipped — ${dna.id} does not support negatives`,
      ],
      termCount: 0,
    };
  }

  // ── Step 1: Standard negatives for encoder family ──────────────────
  const standard = getStandardNegatives(dna.encoderFamily, dna.syntaxMode);

  // ── Step 2: Hallucination map terms ────────────────────────────────
  const hallucinationTerms = extractHallucinationNegatives(dna.hallucinationMap);

  // ── Step 3: Combine (standard first, then hallucination extras) ────
  const combined = [...standard];
  for (const term of hallucinationTerms) {
    if (!combined.includes(term)) {
      combined.push(term);
    }
  }

  // ── Step 4: Filter contradictions ──────────────────────────────────
  const filtered = filterContradictions(combined, positiveText, anchors);

  // ── Step 5: Platform-specific limits ───────────────────────────────
  let finalTerms = filtered;
  if (dna.negativeMode === 'inline') {
    // MJ-style: max 4 terms
    finalTerms = filtered.slice(0, MJ_MAX_NEGATIVE_TERMS);
  }

  if (finalTerms.length === 0) {
    return {
      negative: null,
      source: 'none',
      changes: ['Negative intelligence: all standard terms filtered (contradicted positive content)'],
      termCount: 0,
    };
  }

  // ── Step 6: Format ─────────────────────────────────────────────────
  const negative = formatNegative(finalTerms, dna);

  const source = hallucinationTerms.length > 0 && standard.length > 0
    ? 'tier_a_combined'
    : hallucinationTerms.length > 0
      ? 'tier_a_hallucination'
      : 'tier_a_standard';

  return {
    negative,
    source,
    changes: [
      `Negative intelligence (Tier A): generated ${finalTerms.length} terms for ${dna.id} (${dna.encoderFamily}/${dna.negativeMode})`,
    ],
    termCount: finalTerms.length,
  };
}
