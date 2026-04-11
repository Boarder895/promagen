// src/lib/call-3-transforms/cohesion-pairs.ts
// ============================================================================
// COHESION PAIR DETECTION — Keeps related anchors adjacent during sequencing
// ============================================================================
// Architecture: call-3-quality-architecture-v0.2.0.md §5.3
//
// Detects interaction pairs that must stay adjacent in the reordered
// sequence. Splitting "waves crash against rocks" into separate fragments
// produces worse images than keeping the interaction intact.
//
// Detection strategy:
//   1. Subject + primary action verb (always paired — highest priority)
//   2. Colour + modified object (from same clause in the prompt text)
//   3. Modifier + noun (hyphenated compounds, adjective clusters)
//
// Pairs are treated as atomic units by the AVIS sequencing algorithm.
// The pair's AVIS score is the max of its members (the strongest anchor
// pulls its partner along).
// ============================================================================

import type { AnchorManifest } from '@/lib/optimise-prompts/preflight';

// ============================================================================
// TYPES
// ============================================================================

/** Relationship type between two paired anchors. */
export type CohesionRelationship =
  | 'subject_action'
  | 'colour_object'
  | 'modifier_noun';

/** A detected cohesion pair that must stay adjacent during resequencing. */
export interface CohesionPair {
  /** First anchor text in the pair */
  readonly anchor1: string;
  /** Second anchor text in the pair */
  readonly anchor2: string;
  /** What type of coupling links them */
  readonly relationship: CohesionRelationship;
  /**
   * Confidence in the pairing (0.0–1.0).
   * 1.0 = structural certainty (subject+verb in same clause)
   * 0.5 = heuristic match (same clause proximity)
   */
  readonly confidence: number;
}

// ============================================================================
// CLAUSE EXTRACTION
// ============================================================================

/**
 * Split text into clauses at sentence and phrase boundaries.
 * Pairs are only detected within the same clause — cross-clause
 * "pairs" are usually false positives.
 */
function splitIntoClauses(text: string): string[] {
  return text
    .split(/[.;!?]+/)
    .map((clause) => clause.trim())
    .filter((clause) => clause.length > 0);
}

/**
 * Split a clause into comma-separated fragments for finer-grained
 * colour+object and modifier+noun detection.
 */
function splitIntoFragments(clause: string): string[] {
  return clause
    .split(/,/)
    .map((f) => f.trim())
    .filter((f) => f.length > 0);
}

// ============================================================================
// PREPOSITION / VERB COUPLING DETECTION
// ============================================================================

/**
 * Prepositions and verbs that signal interaction coupling between anchors.
 * Architecture §5.3: "if two anchors share a verb or a preposition
 * ('waves crash against rocks', 'beam cuts through rain'), they are
 * a cohesion pair."
 */
const COUPLING_PREPOSITIONS = new Set([
  'against', 'through', 'across', 'into', 'onto', 'upon', 'over',
  'beneath', 'below', 'above', 'behind', 'beyond', 'around',
]);

const COUPLING_VERBS = new Set([
  'crash', 'crashes', 'crashing',
  'cut', 'cuts', 'cutting',
  'slice', 'slices', 'slicing',
  'pour', 'pours', 'pouring',
  'break', 'breaks', 'breaking',
  'smash', 'smashes', 'smashing',
  'sweep', 'sweeps', 'sweeping',
  'pierce', 'pierces', 'piercing',
  'strike', 'strikes', 'striking',
  'illuminate', 'illuminates', 'illuminating',
  'cast', 'casts', 'casting',
  'reflect', 'reflects', 'reflecting',
  'wrap', 'wraps', 'wrapping',
  'drape', 'drapes', 'draping',
  'scatter', 'scatters', 'scattering',
]);

/**
 * Check whether a clause contains a coupling verb or preposition
 * that links two visual elements. Returns the coupling word if found.
 */
function findCouplingWord(clause: string): string | null {
  const words = clause.toLowerCase().split(/\s+/);

  for (const w of words) {
    if (COUPLING_VERBS.has(w)) return w;
    if (COUPLING_PREPOSITIONS.has(w)) return w;
  }

  return null;
}

// ============================================================================
// COLOUR DETECTION (for colour+object pairing)
// ============================================================================

const COLOUR_WORDS = new Set([
  'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'violet', 'pink',
  'cyan', 'magenta', 'crimson', 'scarlet', 'gold', 'golden', 'silver',
  'copper', 'bronze', 'amber', 'teal', 'turquoise', 'emerald', 'cobalt',
  'indigo', 'maroon', 'ivory', 'charcoal', 'slate', 'white', 'black',
]);

const COLOUR_MODIFIERS = new Set([
  'deep', 'pale', 'dark', 'bright', 'vivid', 'muted', 'warm', 'cool',
  'rich', 'faded', 'soft', 'harsh',
]);

/**
 * Check whether a fragment contains a colour term. If so, return it.
 */
function extractFragmentColour(fragment: string): string | null {
  const words = fragment.toLowerCase().split(/\s+/);
  const colourParts: string[] = [];

  for (const w of words) {
    if (COLOUR_MODIFIERS.has(w) || COLOUR_WORDS.has(w)) {
      colourParts.push(w);
    }
  }

  return colourParts.length > 0 ? colourParts.join(' ') : null;
}

/**
 * Extract the non-colour "object" part of a fragment.
 * "deep copper sky" → "sky"
 * "pale gold beam cutting through rain" → "beam cutting through rain"
 */
function extractFragmentObject(fragment: string, colour: string): string {
  const lower = fragment.toLowerCase();
  const colourLower = colour.toLowerCase();

  // Remove the colour portion and trim
  let objectPart = lower;
  for (const word of colourLower.split(/\s+/)) {
    objectPart = objectPart.replace(new RegExp(`\\b${word}\\b`, 'i'), '');
  }

  return objectPart.replace(/\s+/g, ' ').trim();
}

// ============================================================================
// SEMANTIC INTERACTION LOOKUP — Known visual interaction patterns
// ============================================================================
// Architecture §5.3: "secondary: semantic-pairs.json lookup"
// These are known visual interactions where adjacency improves image quality.
// Built from Promagen's harmony testing and community research.

/**
 * Known interaction pairs: [anchor1_pattern, anchor2_pattern, confidence].
 * Patterns match against lowercased anchor text using includes().
 */
const KNOWN_INTERACTIONS: readonly [string, string, number][] = [
  // Light-through-weather (common in dramatic scenes)
  ['beam', 'rain', 0.85],
  ['beam', 'fog', 0.85],
  ['beam', 'mist', 0.85],
  ['light', 'rain', 0.8],
  ['light', 'fog', 0.8],
  ['light', 'mist', 0.8],
  ['glow', 'fog', 0.8],
  ['glow', 'mist', 0.8],
  // Reflection interactions
  ['light', 'water', 0.75],
  ['light', 'puddle', 0.75],
  ['glow', 'water', 0.75],
  // Weather-environment
  ['wave', 'cliff', 0.8],
  ['wave', 'rock', 0.8],
  ['wave', 'shore', 0.75],
  ['storm', 'sea', 0.75],
  ['storm', 'ocean', 0.75],
  // Subject-environment
  ['figure', 'doorway', 0.7],
  ['figure', 'window', 0.7],
  ['shadow', 'wall', 0.7],
] as const;

/**
 * Check known interaction patterns between two unclaimed anchors.
 * Returns confidence if a known interaction is found, null otherwise.
 */
function findKnownInteraction(
  anchor1: string,
  anchor2: string,
): number | null {
  const a1 = anchor1.toLowerCase();
  const a2 = anchor2.toLowerCase();

  for (const [pat1, pat2, confidence] of KNOWN_INTERACTIONS) {
    if ((a1.includes(pat1) && a2.includes(pat2)) ||
        (a1.includes(pat2) && a2.includes(pat1))) {
      return confidence;
    }
  }

  return null;
}

// ============================================================================
// MAIN DETECTION
// ============================================================================

/**
 * Detect cohesion pairs in the assembled prompt text.
 *
 * Returns pairs that should be treated as atomic units during AVIS
 * resequencing. Each anchor can appear in at most one pair.
 *
 * @param text     The assembled prompt text
 * @param anchors  The anchor manifest extracted from the text
 * @returns Array of detected cohesion pairs, sorted by confidence descending
 */
export function detectCohesionPairs(
  text: string,
  anchors: AnchorManifest,
): CohesionPair[] {
  const pairs: CohesionPair[] = [];
  const claimed = new Set<string>();

  // ── 1. Subject + primary action verb (highest priority) ─────────
  if (anchors.subjectPhrase && anchors.actionVerbs.length > 0) {
    const primaryVerb = anchors.actionVerbs[0]!;
    pairs.push({
      anchor1: anchors.subjectPhrase,
      anchor2: primaryVerb,
      relationship: 'subject_action',
      confidence: 1.0,
    });
    claimed.add(anchors.subjectPhrase.toLowerCase());
    claimed.add(primaryVerb.toLowerCase());
  }

  // ── 2. Verb/preposition-coupled anchors within same clause ──────
  const clauses = splitIntoClauses(text);

  for (const clause of clauses) {
    const coupling = findCouplingWord(clause);
    if (!coupling) continue;

    // Find which environment nouns or subject phrases appear in this clause
    const clauseLower = clause.toLowerCase();
    const presentEnvironment = anchors.environmentNouns.filter(
      (n) => clauseLower.includes(n.toLowerCase()) && !claimed.has(n.toLowerCase()),
    );

    // If we have 2+ environment nouns in a clause with a coupling verb,
    // pair them (e.g., "waves crash against rocks")
    if (presentEnvironment.length >= 2) {
      const a1 = presentEnvironment[0]!;
      const a2 = presentEnvironment[1]!;
      pairs.push({
        anchor1: a1,
        anchor2: a2,
        relationship: 'modifier_noun', // Verb-coupled environment interaction
        confidence: 0.8,
      });
      claimed.add(a1.toLowerCase());
      claimed.add(a2.toLowerCase());
    }
  }

  // ── 3. Colour + object within same fragment ─────────────────────
  for (const clause of clauses) {
    const fragments = splitIntoFragments(clause);

    for (const fragment of fragments) {
      const colour = extractFragmentColour(fragment);
      if (!colour || claimed.has(colour)) continue;

      // Check if this colour is from the anchor manifest
      const matchedAnchorColour = anchors.colours.find(
        (c) => colour.includes(c.toLowerCase()),
      );
      if (!matchedAnchorColour) continue;

      const object = extractFragmentObject(fragment, colour);
      if (object.length < 2) continue;

      // Find if the object matches an environment noun or light source
      const matchedEnv = anchors.environmentNouns.find(
        (n) => object.includes(n.toLowerCase()) && !claimed.has(n.toLowerCase()),
      );
      const matchedLight = anchors.lightSources.find(
        (l) => object.includes(l.toLowerCase()) && !claimed.has(l.toLowerCase()),
      );

      const pairedAnchor = matchedEnv ?? matchedLight;
      if (pairedAnchor) {
        pairs.push({
          anchor1: matchedAnchorColour,
          anchor2: pairedAnchor,
          relationship: 'colour_object',
          confidence: 0.7,
        });
        claimed.add(matchedAnchorColour.toLowerCase());
        claimed.add(pairedAnchor.toLowerCase());
      }
    }
  }

  // ── 4. Semantic interaction lookup (known visual patterns) ──────
  // Check light sources against environment nouns/colours for known
  // interactions like beam+rain, glow+fog, wave+cliff.
  const allAnchors = [
    ...anchors.lightSources,
    ...anchors.environmentNouns,
    ...anchors.colours,
  ];

  for (let i = 0; i < allAnchors.length; i++) {
    const a1 = allAnchors[i]!;
    if (claimed.has(a1.toLowerCase())) continue;

    for (let j = i + 1; j < allAnchors.length; j++) {
      const a2 = allAnchors[j]!;
      if (claimed.has(a2.toLowerCase())) continue;

      const confidence = findKnownInteraction(a1, a2);
      if (confidence !== null) {
        pairs.push({
          anchor1: a1,
          anchor2: a2,
          relationship: 'modifier_noun', // Semantic interaction coupling
          confidence,
        });
        claimed.add(a1.toLowerCase());
        claimed.add(a2.toLowerCase());
        break; // Each anchor only pairs once
      }
    }
  }

  // Sort by confidence descending — highest confidence pairs are most reliable
  return pairs.sort((a, b) => b.confidence - a.confidence);
}
