// src/lib/call-3-transforms/semantic-compress.ts
// ============================================================================
// T_SEMANTIC_COMPRESS — Within-phrase semantic compression for CLIP
// ============================================================================
// Architecture: call-3-quality-architecture-v0.2.0.md §5.4
// Build plan:   call-3-quality-build-plan-v1.md §8 (Phase 4)
//
// Compresses verbose phrases to free tokens on CLIP's 77-token budget
// without losing visual meaning.
//
// Two compression strategies (deterministic, conservative):
//   1. Redundant modifier collapse: "ancient old" → "ancient"
//   2. Compound adjective formation: "purple and copper" → "purple-copper"
//
// v1.1.0: Removed claimed-but-unimplemented 'dictionary' strategy
// from the public type. Code and contract now match exactly (ChatGPT
// 93/100 review recommendation).
//
// Architecture Law 2: Preservation outranks enrichment.
// The compression NEVER changes visual meaning — it only removes
// redundancy. If the synonym is not visually equivalent, skip it.
//
// On T5 platforms, density is tracked but compression is NOT enforced
// (the 512-token budget is rarely a constraint).
// ============================================================================

import type { AnchorManifest } from '@/lib/optimise-prompts/preflight';
import modifierData from '@/data/call-3-transforms/modifier-synonyms.json';

// ============================================================================
// TYPES
// ============================================================================

/** Result of the semantic compression transform. */
export interface CompressionResult {
  /** The compressed text */
  readonly text: string;
  /** Human-readable change descriptions */
  readonly changes: readonly string[];
  /** Estimated tokens saved by compression */
  readonly tokensSaved: number;
  /** Semantic density before compression */
  readonly densityBefore: number;
  /** Semantic density after compression */
  readonly densityAfter: number;
  /** Individual compression actions taken */
  readonly compressions: readonly CompressionAction[];
}

/** A single compression action for diagnostics. */
export interface CompressionAction {
  /** What was compressed */
  readonly original: string;
  /** What it became */
  readonly compressed: string;
  /** Which strategy produced this compression */
  readonly strategy: 'redundant_modifier' | 'compound_formation';
  /** Tokens saved by this action */
  readonly tokensSaved: number;
}

// ============================================================================
// DATA LOADING
// ============================================================================

/** Shape of the modifier-synonyms.json file. */
interface ModifierSynonymsData {
  readonly _meta: {
    readonly version: string;
    readonly date: string;
    readonly authority: string;
    readonly description: string;
    readonly rules: readonly string[];
  };
  readonly redundantModifiers: Record<string, string>;
  readonly compoundFormations: Record<string, string>;
}

const typedModifierData = modifierData as unknown as ModifierSynonymsData;

/** Redundant modifier pairs → concise replacement. */
const REDUNDANT_MODIFIERS: ReadonlyMap<string, string> = new Map(
  Object.entries(typedModifierData.redundantModifiers),
);

/** Compound formation patterns → hyphenated or fused form. */
const COMPOUND_FORMATIONS: ReadonlyMap<string, string> = new Map(
  Object.entries(typedModifierData.compoundFormations),
);

// ============================================================================
// VISUAL CONCEPT DETECTION (for density scoring)
// ============================================================================

/**
 * Words that carry unique visual information.
 * Used for density scoring: density = visual_concepts / word_count.
 *
 * Excludes: articles, prepositions, conjunctions, generic adjectives.
 * Includes: nouns, named colours, specific modifiers, textures, materials.
 */
const VISUAL_STOP_WORDS = new Set([
  'a', 'an', 'the', 'of', 'in', 'on', 'at', 'to', 'and', 'or',
  'with', 'from', 'by', 'for', 'is', 'are', 'was', 'were',
  'that', 'this', 'it', 'its', 'very', 'really', 'quite',
  'some', 'many', 'much', 'more', 'most', 'such',
]);

/**
 * Count unique visual concepts in a phrase.
 * A "visual concept" is a word that contributes to the generated image.
 *
 * Architecture §5.4:
 *   "Weathered old lighthouse keeper" has 3 concepts (age, lighthouse, keeper)
 *   in 5 tokens = density 0.6.
 *   "Grizzled lighthouse keeper" has 3 concepts in 3 tokens = density 1.0.
 */
function countVisualConcepts(phrase: string): number {
  const words = phrase.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  let concepts = 0;

  for (const word of words) {
    if (VISUAL_STOP_WORDS.has(word)) continue;
    concepts++;
  }

  return concepts;
}

/**
 * Estimate word count for a phrase (proxy for token count).
 * CLIP BPE averages ~1.3 tokens per word; word count is a reasonable proxy.
 */
function wordCount(phrase: string): number {
  return phrase.trim().split(/\s+/).filter((w) => w.length > 0).length;
}

// ============================================================================
// PUBLIC: DENSITY SCORING
// ============================================================================

/**
 * Compute semantic density for a phrase.
 *
 * Architecture §5.4:
 *   density = unique_visual_concepts / token_count
 *
 * On CLIP platforms, the algorithm flags low-density anchors (density < 0.5)
 * for compression. On T5, density is tracked but not enforced.
 *
 * @param phrase The phrase to score
 * @returns Density score (0.0–1.0+, higher = more efficient)
 */
export function computeDensity(phrase: string): number {
  const wc = wordCount(phrase);
  if (wc === 0) return 1.0;

  const concepts = countVisualConcepts(phrase);
  return concepts / wc;
}

/** Density threshold below which compression is attempted (architecture §5.4). */
const LOW_DENSITY_THRESHOLD = 0.5;

// ============================================================================
// COMPRESSION STRATEGIES
// ============================================================================

/**
 * Strategy 1: Redundant modifier collapse.
 * "weathered old keeper" → "grizzled keeper" (saves 1 word/token).
 *
 * Only applies when two adjacent modifiers are semantically redundant
 * and a concise replacement exists in the lookup table.
 */
function applyRedundantModifiers(text: string): CompressionAction[] {
  const actions: CompressionAction[] = [];
  let current = text;

  for (const [verbose, concise] of REDUNDANT_MODIFIERS) {
    const regex = new RegExp(`\\b${escapeRegex(verbose)}\\b`, 'gi');
    if (regex.test(current)) {
      const before = wordCount(verbose);
      const after = wordCount(concise);
      const saved = Math.max(0, before - after);

      current = current.replace(regex, concise);
      actions.push({
        original: verbose,
        compressed: concise,
        strategy: 'redundant_modifier',
        tokensSaved: saved,
      });
    }
  }

  return actions;
}

/**
 * Strategy 2: Compound adjective formation.
 * "purple and copper sky" → "purple-copper sky" (saves 1 word/token).
 *
 * Only applies to known safe compound patterns. "and" between colours
 * is the most common case.
 */
function applyCompoundFormations(text: string): CompressionAction[] {
  const actions: CompressionAction[] = [];
  let current = text;

  for (const [verbose, compound] of COMPOUND_FORMATIONS) {
    const regex = new RegExp(`\\b${escapeRegex(verbose)}\\b`, 'gi');
    if (regex.test(current)) {
      const before = wordCount(verbose);
      const after = wordCount(compound);
      const saved = Math.max(0, before - after);

      current = current.replace(regex, compound);
      actions.push({
        original: verbose,
        compressed: compound,
        strategy: 'compound_formation',
        tokensSaved: saved,
      });
    }
  }

  return actions;
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================================
// SEGMENT-LEVEL COMPRESSION
// ============================================================================

/**
 * Apply all compression strategies to a single phrase segment.
 * Returns the compressed text and all actions taken.
 *
 * Order: redundant modifiers first (biggest savings), then compounds.
 * Each strategy operates on the result of the previous one.
 */
function compressSegment(segment: string): {
  text: string;
  actions: CompressionAction[];
} {
  let text = segment;
  const allActions: CompressionAction[] = [];

  // Strategy 1: Redundant modifiers
  const modActions = applyRedundantModifiers(text);
  for (const action of modActions) {
    text = text.replace(
      new RegExp(`\\b${escapeRegex(action.original)}\\b`, 'gi'),
      action.compressed,
    );
    allActions.push(action);
  }

  // Strategy 2: Compound formations
  const compActions = applyCompoundFormations(text);
  for (const action of compActions) {
    text = text.replace(
      new RegExp(`\\b${escapeRegex(action.original)}\\b`, 'gi'),
      action.compressed,
    );
    allActions.push(action);
  }

  // Clean up double spaces
  text = text.replace(/\s{2,}/g, ' ').trim();

  return { text, actions: allActions };
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Apply semantic compression to a prompt.
 *
 * Splits the prompt into segments, computes density per segment,
 * and applies compression strategies to low-density segments.
 *
 * Architecture Law 2: Preservation outranks enrichment.
 * Only compresses when the replacement is visually equivalent.
 * If no compression is possible, returns the input unchanged.
 *
 * @param text        The prompt text (typically comma-separated for CLIP)
 * @param _anchors    Anchor manifest (reserved for future anchor-aware compression)
 * @param tokenLimit  Encoder token limit (77 for CLIP, triggers compression)
 * @returns CompressionResult with compressed text, changes, and density scores
 */
export function semanticCompress(
  text: string,
  _anchors: AnchorManifest,
  tokenLimit: number,
): CompressionResult {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return {
      text: trimmed,
      changes: [],
      tokensSaved: 0,
      densityBefore: 1.0,
      densityAfter: 1.0,
      compressions: [],
    };
  }

  // ── Compute overall density before compression ──────────────────
  const densityBefore = computeDensity(trimmed);

  // ── Split into segments ─────────────────────────────────────────
  const segments = trimmed.split(/,/).map((s) => s.trim()).filter((s) => s.length > 0);

  // ── Only compress if token budget is tight (CLIP) ───────────────
  // On T5 (512 tokens), density is tracked but not enforced
  const shouldCompress = tokenLimit <= 128;

  if (!shouldCompress) {
    return {
      text: trimmed,
      changes: [],
      tokensSaved: 0,
      densityBefore,
      densityAfter: densityBefore,
      compressions: [],
    };
  }

  // ── Compress each segment ───────────────────────────────────────
  const allCompressions: CompressionAction[] = [];
  const compressedSegments: string[] = [];

  for (const segment of segments) {
    const segDensity = computeDensity(segment);

    if (segDensity < LOW_DENSITY_THRESHOLD) {
      // Low density — try compression
      const result = compressSegment(segment);
      compressedSegments.push(result.text);
      allCompressions.push(...result.actions);
    } else {
      // Already dense enough — or try compression anyway if it finds matches
      const result = compressSegment(segment);
      compressedSegments.push(result.text);
      if (result.actions.length > 0) {
        allCompressions.push(...result.actions);
      }
    }
  }

  // ── Reassemble ──────────────────────────────────────────────────
  const compressedText = compressedSegments.join(', ');
  const totalSaved = allCompressions.reduce((sum, a) => sum + a.tokensSaved, 0);
  const densityAfter = computeDensity(compressedText);

  // ── Generate change descriptions ────────────────────────────────
  const changes: string[] = [];
  for (const action of allCompressions) {
    changes.push(
      `Semantic compression: "${action.original}" → "${action.compressed}" (saved ~${action.tokensSaved} token${action.tokensSaved !== 1 ? 's' : ''})`,
    );
  }

  if (allCompressions.length === 0) {
    changes.push('Semantic compression: no compressible patterns found');
  }

  return {
    text: compressedText,
    changes,
    tokensSaved: totalSaved,
    densityBefore,
    densityAfter,
    compressions: allCompressions,
  };
}
