// src/lib/call-3-transforms/attention-sequence.ts
// ============================================================================
// AVIS ATTENTION SEQUENCING — Deterministic anchor reordering for CLIP
// ============================================================================
// Architecture: call-3-quality-architecture-v0.2.0.md §5
// Build plan:   call-3-quality-build-plan-v1.md §7 (Phase 3)
//
// The core deterministic transform that delivers measurable gains on
// 7 CLIP platforms with zero GPT cost.
//
// The AVIS formula (architecture §5.2):
//   AVIS(anchor, position) = visual_impact × attention_weight(position) × cohesion ÷ token_cost
//
// The algorithm:
//   1. Parse prompt into phrase segments
//   2. Classify each segment by visual category
//   3. Detect cohesion pairs (treat as atomic units)
//   4. Score each unit by visual_impact
//   5. Compute optimal AVIS placement
//   6. Enforce CLIP 77-token budget (drop lowest-AVIS if over)
//   7. Reassemble in optimised order
//
// All original content is preserved. No words are invented, removed,
// or rewritten. Only the ORDER changes.
// ============================================================================

import type { AnchorManifest } from '@/lib/optimise-prompts/preflight';
import type { PlatformDNA } from '@/data/platform-dna/types';
import { getAttentionCurve } from './attention-curves';
import { detectCohesionPairs } from './cohesion-pairs';
import type { CohesionPair } from './cohesion-pairs';

// ============================================================================
// TYPES
// ============================================================================

/** Configuration for the AVIS sequencing algorithm. */
export interface AVISConfig {
  /** Attention weight function: position → weight (0.0–1.0) */
  readonly attentionCurve: (position: number, tokenLimit: number) => number;
  /** Whether to enforce token budget (true for CLIP, false for T5) */
  readonly enforceTokenBudget: boolean;
  /** Token limit (77 for CLIP, 512 for T5, null for unconstrained) */
  readonly tokenLimit: number | null;
}

/** The AVIS score for a single sequencing unit (anchor or cohesion pair). */
export interface AVISScore {
  /** The anchor text (or combined pair text) */
  readonly anchor: string;
  /** Visual impact weight for this category */
  readonly visualImpact: number;
  /** Estimated token cost */
  readonly tokenCost: number;
  /** Base AVIS score (before position-dependent attention) */
  readonly baseScore: number;
  /** Visual category classification */
  readonly category: VisualCategory;
  /** Whether this unit is a cohesion pair */
  readonly isPair: boolean;
  /** Final position in the resequenced output */
  readonly finalPosition: number;
  /** Final AVIS score at the assigned position */
  readonly finalAVIS: number;
}

/** Result of the attention sequencing transform. */
export interface SequencedResult {
  /** The resequenced prompt text */
  readonly text: string;
  /** Human-readable change descriptions for UI chips */
  readonly changes: readonly string[];
  /** AVIS scores for each sequenced unit */
  readonly avisScores: readonly AVISScore[];
  /** Estimated tokens used in the output */
  readonly tokensUsed: number;
  /** Anchors dropped due to budget overflow (CLIP only) */
  readonly anchorsDropped: readonly string[];
  /** Whether any reordering occurred */
  readonly wasReordered: boolean;
}

/** Visual category for AVIS scoring — maps to visual_impact weight. */
export type VisualCategory =
  | 'quality_prefix'
  | 'subject'
  | 'action'
  | 'lighting'
  | 'environment'
  | 'colour'
  | 'atmosphere'
  | 'materials'
  | 'style'
  | 'composition'
  | 'camera'
  | 'quality_suffix'
  | 'uncategorised';

// ============================================================================
// VISUAL IMPACT WEIGHTS — Architecture §5.2
// ============================================================================
// "per-category importance weight from the optimal stacking research"

const VISUAL_IMPACT_WEIGHTS: Record<VisualCategory, number> = {
  subject: 1.0,
  action: 0.85,
  lighting: 0.75,
  environment: 0.70,
  colour: 0.55,
  style: 0.50,
  atmosphere: 0.45,
  materials: 0.40,
  composition: 0.30,
  camera: 0.25,
  quality_prefix: 0.20,
  quality_suffix: 0.15,
  uncategorised: 0.35,
} as const;

// ============================================================================
// TOKEN ESTIMATION
// ============================================================================

/**
 * Estimate token count for a text segment.
 *
 * CLIP's BPE tokenizer averages ~1.3 tokens per word. We use word count
 * as a reasonable proxy. Comma-separated segments in CLIP prompts are
 * typically short phrases where word count ≈ token count.
 *
 * A production-grade implementation would use a proper BPE tokenizer,
 * but for sequencing decisions this approximation is sufficient.
 */
export function estimateTokens(text: string): number {
  const words = text.trim().split(/\s+/).filter((w) => w.length > 0);
  // Round up to be conservative with the 77-token budget
  return Math.ceil(words.length * 1.3);
}

/**
 * Compute normalised token cost for the AVIS formula.
 * Architecture §5.2: normalised to [1.0, 3.0].
 *   2-token anchor → 1.0
 *   6-token anchor → 2.5
 * On T5 (512 tokens), token_cost is always 1.0.
 */
function normaliseTokenCost(tokens: number, enforceTokenBudget: boolean): number {
  if (!enforceTokenBudget) return 1.0;
  if (tokens <= 2) return 1.0;
  // Linear interpolation: 2 tokens → 1.0, 8 tokens → 3.0
  return Math.min(3.0, 1.0 + ((tokens - 2) / 6) * 2.0);
}

// ============================================================================
// PHRASE SEGMENT PARSING
// ============================================================================

/** A parsed phrase segment from the prompt. */
interface PhraseSegment {
  /** Original text of the segment (trimmed) */
  text: string;
  /** Visual category classification */
  category: VisualCategory;
  /** Estimated token count */
  tokens: number;
  /** Visual impact weight for this category */
  visualImpact: number;
  /** Whether this is a quality prefix (position 0) */
  isQualityPrefix: boolean;
  /** Whether this is a quality suffix (position last) */
  isQualitySuffix: boolean;
}

// ── Category classification ─────────────────────────────────────────────────

const QUALITY_PREFIX_TERMS = new Set([
  'masterpiece', 'best quality', 'high quality', 'ultra detailed',
  'highly detailed', 'professional', 'sharp focus', 'sharp',
  'intricate detail', 'intricate details', '8k', '4k', 'uhd',
  'high resolution', 'detailed',
]);

const QUALITY_SUFFIX_TERMS = new Set([
  'trending on artstation', 'artstation', 'deviantart',
  'cgsociety', 'unreal engine', 'octane render',
  'ray tracing', 'global illumination',
]);

/**
 * Check if text contains any multi-word phrase from an array.
 * Used for classification terms like "golden hour", "rule of thirds".
 */
function matchesAnyTerm(text: string, phrases: readonly string[]): boolean {
  return phrases.some((phrase) => text.includes(phrase));
}

// ── Multi-word phrase arrays (checked against full segment text) ─────────

const LIGHTING_PHRASES = [
  'golden hour', 'blue hour', 'dramatic lighting', 'soft lighting',
  'harsh lighting', 'studio lighting', 'natural light', 'ambient light',
  'rim light', 'volumetric light', 'volumetric lighting',
] as const;

const ATMOSPHERE_PHRASES = [
  'god rays', 'lens flare',
] as const;

const STYLE_PHRASES = [
  'oil painting', 'digital art', 'concept art', 'art nouveau', 'art deco',
  'sci-fi',
] as const;

const COMPOSITION_PHRASES = [
  'rule of thirds', 'close-up', 'close up', 'wide shot', 'wide angle',
  'full body', 'bird eye view', "bird's eye", 'low angle', 'high angle',
  'dutch angle', 'depth of field', 'shallow depth',
] as const;

const CAMERA_PHRASES = [
  'film grain', 'film photography', 'tilt-shift', 'wide-angle',
] as const;

// ── Single-word sets (checked per word after phrase matching) ────────────

const LIGHTING_WORDS = new Set([
  'lighting', 'sunlight', 'moonlight', 'backlight', 'backlit',
  'volumetric', 'rays', 'beam', 'glow', 'glowing', 'illuminated',
  'shadow', 'shadows', 'candlelight', 'firelight', 'neon', 'lantern',
]);

const ATMOSPHERE_WORDS = new Set([
  'fog', 'mist', 'haze', 'rain', 'storm', 'snow', 'dust',
  'smoke', 'clouds', 'overcast', 'moody', 'ethereal', 'dreamy',
  'mysterious', 'eerie', 'serene', 'dramatic', 'atmospheric',
  'cinematic', 'epic',
]);

const COMPOSITION_WORDS = new Set([
  'composition', 'centered', 'symmetrical', 'asymmetrical',
  'panoramic', 'portrait', 'landscape', 'bokeh',
]);

const CAMERA_WORDS = new Set([
  'camera', 'lens', 'focal', 'telephoto', 'fisheye',
  'dslr', 'mirrorless', 'macro',
]);

const MATERIAL_WORDS = new Set([
  'stone', 'wood', 'wooden', 'iron', 'glass', 'silk', 'moss',
  'ice', 'sand', 'brick', 'steel', 'leather', 'timber',
  'cedar', 'oak', 'marble', 'granite', 'slate', 'coral',
  'clay', 'crystal', 'metal', 'fabric', 'velvet', 'linen',
  'concrete', 'rust', 'rusted', 'weathered', 'worn', 'aged',
]);

const COLOUR_WORDS = new Set([
  'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'violet',
  'pink', 'cyan', 'magenta', 'crimson', 'scarlet', 'gold', 'golden',
  'silver', 'copper', 'bronze', 'amber', 'teal', 'turquoise',
  'emerald', 'cobalt', 'indigo', 'maroon', 'ivory', 'charcoal',
]);

const STYLE_WORDS = new Set([
  'watercolor', 'illustration', 'anime', 'manga', 'photorealistic',
  'hyperrealistic', 'surreal', 'abstract', 'impressionist',
  'gothic', 'cyberpunk', 'steampunk', 'fantasy',
  'minimalist', 'vintage', 'retro',
]);

/**
 * Classify a phrase segment into a visual category.
 * Uses keyword matching against the anchor manifest and term dictionaries.
 */
/**
 * Classify a text segment into a visual category.
 *
 * Exported for cross-transform use (weight-rebalance, quality-position).
 * Anchor-aware: uses the manifest to identify subject, colours, light
 * sources, and environment nouns before falling back to dictionary.
 */
export function classifyVisualCategory(
  segment: string,
  anchors?: AnchorManifest,
): VisualCategory {
  return _classifySegmentImpl(segment, anchors ?? EMPTY_ANCHORS);
}

/** Empty anchors for when no manifest is available. */
const EMPTY_ANCHORS: AnchorManifest = {
  subjectPhrase: null,
  subjectPosition: 0,
  subjectIsLeading: true,
  colours: [],
  lightSources: [],
  environmentNouns: [],
  actionVerbs: [],
  anchorCount: 0,
};

/** Internal implementation shared by classifyVisualCategory and parseIntoSegments. */
function _classifySegmentImpl(
  segment: string,
  anchors: AnchorManifest,
): VisualCategory {
  const lower = segment.toLowerCase();
  const words = new Set(lower.split(/[\s,]+/).filter((w) => w.length > 1));

  // ── Quality prefix/suffix (check first — these are position-fixed) ──
  for (const term of QUALITY_PREFIX_TERMS) {
    if (lower.includes(term)) return 'quality_prefix';
  }
  for (const term of QUALITY_SUFFIX_TERMS) {
    if (lower.includes(term)) return 'quality_suffix';
  }

  // ── Subject (check if segment contains the subject phrase) ──────────
  if (anchors.subjectPhrase) {
    const subjectWords = anchors.subjectPhrase.toLowerCase().split(/\s+/);
    const significantWords = subjectWords.filter((w) => w.length > 2);
    const matchCount = significantWords.filter((w) => lower.includes(w)).length;
    if (significantWords.length > 0 && matchCount >= Math.ceil(significantWords.length * 0.6)) {
      return 'subject';
    }
  }

  // ── Action verb ─────────────────────────────────────────────────────
  for (const verb of anchors.actionVerbs) {
    if (lower.includes(verb.toLowerCase())) return 'action';
  }

  // ── Colour (from manifest) ──────────────────────────────────────────
  for (const colour of anchors.colours) {
    if (lower.includes(colour.toLowerCase())) return 'colour';
  }

  // ── Light source (from manifest) ────────────────────────────────────
  for (const light of anchors.lightSources) {
    if (lower.includes(light.toLowerCase())) return 'lighting';
  }

  // ── Environment (from manifest) ─────────────────────────────────────
  for (const noun of anchors.environmentNouns) {
    if (lower.includes(noun.toLowerCase())) return 'environment';
  }

  // ── Dictionary-based fallback ───────────────────────────────────────
  // Check multi-word phrases against the FULL segment text first,
  // then fall back to single-word checks. This fixes the classification
  // of "golden hour", "rule of thirds", "wide angle", etc.
  if (matchesAnyTerm(lower, LIGHTING_PHRASES)) return 'lighting';
  if (matchesAnyTerm(lower, ATMOSPHERE_PHRASES)) return 'atmosphere';
  if (matchesAnyTerm(lower, STYLE_PHRASES)) return 'style';
  if (matchesAnyTerm(lower, COMPOSITION_PHRASES)) return 'composition';
  if (matchesAnyTerm(lower, CAMERA_PHRASES)) return 'camera';

  // Single-word fallback
  for (const w of words) {
    if (LIGHTING_WORDS.has(w)) return 'lighting';
  }
  for (const w of words) {
    if (ATMOSPHERE_WORDS.has(w)) return 'atmosphere';
  }
  for (const w of words) {
    if (STYLE_WORDS.has(w)) return 'style';
  }
  for (const w of words) {
    if (COMPOSITION_WORDS.has(w)) return 'composition';
  }
  for (const w of words) {
    if (CAMERA_WORDS.has(w)) return 'camera';
  }
  for (const w of words) {
    if (MATERIAL_WORDS.has(w)) return 'materials';
  }
  for (const w of words) {
    if (COLOUR_WORDS.has(w)) return 'colour';
  }

  return 'uncategorised';
}

/**
 * Parse a prompt into classified phrase segments.
 *
 * Primary split: commas (standard for CLIP keyword-style prompts).
 * Fallback: if comma split produces 2 or fewer segments, try
 * sentence boundaries (periods, semicolons) for prose-style prompts.
 *
 * Each segment becomes a PhraseSegment with category and token estimate.
 */
function parseIntoSegments(
  text: string,
  anchors: AnchorManifest,
): PhraseSegment[] {
  // Primary: comma split (CLIP keyword format)
  let rawSegments = text
    .split(/,/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // Fallback: if too few comma segments, try sentence/semicolon boundaries
  if (rawSegments.length <= 2) {
    const sentenceSegments = text
      .split(/[.;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (sentenceSegments.length > rawSegments.length) {
      rawSegments = sentenceSegments;
    }
  }

  return rawSegments.map((segment) => {
    const category = _classifySegmentImpl(segment, anchors);
    const tokens = estimateTokens(segment);

    return {
      text: segment,
      category,
      tokens,
      visualImpact: VISUAL_IMPACT_WEIGHTS[category],
      isQualityPrefix: category === 'quality_prefix',
      isQualitySuffix: category === 'quality_suffix',
    };
  });
}

// ============================================================================
// SEQUENCING UNIT — Segment or cohesion pair treated as atomic
// ============================================================================

interface SequencingUnit {
  /** All segments in this unit (1 for single, 2 for pair) */
  segments: PhraseSegment[];
  /** Combined text */
  text: string;
  /** Maximum visual impact across segments */
  visualImpact: number;
  /** Total tokens */
  tokens: number;
  /** Normalised token cost for AVIS formula */
  tokenCost: number;
  /** Whether this is a cohesion pair */
  isPair: boolean;
  /** Category of the highest-impact segment */
  category: VisualCategory;
  /** Base AVIS score (visual_impact ÷ token_cost, before position weighting) */
  baseScore: number;
  /** Is quality prefix (always position 0) */
  isQualityPrefix: boolean;
  /** Is quality suffix (always position last) */
  isQualitySuffix: boolean;
}

/**
 * Merge segments into sequencing units, combining cohesion pairs.
 *
 * Unpaired segments become single-segment units.
 * Paired segments merge into two-segment units with the higher visual
 * impact as the unit's score (the strongest anchor pulls its partner).
 */
function buildSequencingUnits(
  segments: PhraseSegment[],
  pairs: CohesionPair[],
  enforceTokenBudget: boolean,
): SequencingUnit[] {
  const paired = new Set<number>();
  const units: SequencingUnit[] = [];

  // ── Process pairs first ─────────────────────────────────────────
  for (const pair of pairs) {
    const a1Lower = pair.anchor1.toLowerCase();
    const a2Lower = pair.anchor2.toLowerCase();

    let idx1 = -1;
    let idx2 = -1;

    for (let i = 0; i < segments.length; i++) {
      if (paired.has(i)) continue;
      const segLower = segments[i]!.text.toLowerCase();
      if (idx1 < 0 && segLower.includes(a1Lower)) idx1 = i;
      else if (idx2 < 0 && segLower.includes(a2Lower)) idx2 = i;
    }

    if (idx1 >= 0 && idx2 >= 0) {
      const seg1 = segments[idx1]!;
      const seg2 = segments[idx2]!;
      paired.add(idx1);
      paired.add(idx2);

      const totalTokens = seg1.tokens + seg2.tokens;
      const maxImpact = Math.max(seg1.visualImpact, seg2.visualImpact);
      const category = seg1.visualImpact >= seg2.visualImpact ? seg1.category : seg2.category;
      const tokenCost = normaliseTokenCost(totalTokens, enforceTokenBudget);

      // Paired units get a 10% cohesion bonus in baseScore,
      // reflecting architecture §5.2: interaction coherence adds value
      const cohesionBonus = 1.1;

      units.push({
        segments: [seg1, seg2],
        text: `${seg1.text}, ${seg2.text}`,
        visualImpact: maxImpact,
        tokens: totalTokens,
        tokenCost,
        isPair: true,
        category,
        baseScore: (maxImpact / tokenCost) * cohesionBonus,
        isQualityPrefix: false,
        isQualitySuffix: false,
      });
    }
  }

  // ── Unpaired segments become individual units ───────────────────
  for (let i = 0; i < segments.length; i++) {
    if (paired.has(i)) continue;
    const seg = segments[i]!;
    const tokenCost = normaliseTokenCost(seg.tokens, enforceTokenBudget);

    units.push({
      segments: [seg],
      text: seg.text,
      visualImpact: seg.visualImpact,
      tokens: seg.tokens,
      tokenCost,
      isPair: false,
      category: seg.category,
      baseScore: seg.visualImpact / tokenCost,
      isQualityPrefix: seg.isQualityPrefix,
      isQualitySuffix: seg.isQualitySuffix,
    });
  }

  return units;
}

// ============================================================================
// AVIS-OPTIMAL PLACEMENT
// ============================================================================

/**
 * Sort sequencing units into AVIS-optimal order.
 *
 * Quality prefix is always first. Quality suffix is always last.
 * Everything else is sorted by baseScore descending — highest visual
 * impact per token cost gets the earliest (highest attention) position.
 *
 * The attention_weight(position) factor from the AVIS formula naturally
 * rewards earlier positions, so placing high-baseScore units first
 * maximises the overall AVIS sum.
 */
function sortByAVIS(units: SequencingUnit[]): SequencingUnit[] {
  const prefix = units.filter((u) => u.isQualityPrefix);
  const suffix = units.filter((u) => u.isQualitySuffix);
  const body = units.filter((u) => !u.isQualityPrefix && !u.isQualitySuffix);

  // Sort body by baseScore descending (highest impact first)
  body.sort((a, b) => b.baseScore - a.baseScore);

  return [...prefix, ...body, ...suffix];
}

/**
 * Enforce CLIP token budget by dropping lowest-AVIS units.
 * Architecture §5.5 step 7: "drop anchors from the lowest-AVIS positions first"
 *
 * Returns the trimmed units and the list of dropped anchor texts.
 */
function enforceTokenBudget(
  sortedUnits: SequencingUnit[],
  tokenLimit: number,
): { kept: SequencingUnit[]; dropped: string[] } {
  let totalTokens = 0;
  const kept: SequencingUnit[] = [];
  const dropped: string[] = [];

  for (const unit of sortedUnits) {
    if (totalTokens + unit.tokens <= tokenLimit) {
      kept.push(unit);
      totalTokens += unit.tokens;
    } else {
      // Try to fit: if it's a quality prefix, always keep
      if (unit.isQualityPrefix && totalTokens + unit.tokens <= tokenLimit + 2) {
        kept.push(unit);
        totalTokens += unit.tokens;
      } else {
        dropped.push(unit.text);
      }
    }
  }

  return { kept, dropped };
}

// ============================================================================
// AVIS SCORE COMPUTATION (for diagnostics)
// ============================================================================

/**
 * Compute final AVIS scores for each unit at its assigned position.
 *
 * Cohesion is 1.0 for paired units (adjacency guaranteed by merging)
 * and 1.0 for all unpaired units (no separation penalty applies to singles).
 *
 * Paired units also receive a 10% cohesion bonus to their AVIS score,
 * reflecting the architecture's observation that keeping interactions
 * intact produces better images than fragmenting them.
 */
function computeAVISScores(
  units: SequencingUnit[],
  attentionCurve: (position: number, tokenLimit: number) => number,
  tokenLimit: number,
): AVISScore[] {
  let currentPosition = 0;

  return units.map((unit) => {
    const attentionWeight = attentionCurve(currentPosition, tokenLimit);
    // Pairs get a 10% cohesion bonus — keeping interactions intact adds value
    const cohesion = unit.isPair ? 1.1 : 1.0;
    const finalAVIS = unit.visualImpact * attentionWeight * cohesion / unit.tokenCost;

    const score: AVISScore = {
      anchor: unit.text,
      visualImpact: unit.visualImpact,
      tokenCost: unit.tokenCost,
      baseScore: unit.baseScore,
      category: unit.category,
      isPair: unit.isPair,
      finalPosition: currentPosition,
      finalAVIS,
    };

    currentPosition += unit.tokens;
    return score;
  });
}

// ============================================================================
// CHANGE DESCRIPTION GENERATION
// ============================================================================

/**
 * Generate human-readable change descriptions for UI chips.
 * Describes what the algorithm did in plain English.
 */
function describeChanges(
  originalSegments: PhraseSegment[],
  finalUnits: SequencingUnit[],
  dropped: string[],
): string[] {
  const changes: string[] = [];

  // Check if subject was moved
  const originalSubjectIdx = originalSegments.findIndex((s) => s.category === 'subject');
  const finalSubjectIdx = finalUnits.findIndex((u) => u.category === 'subject');

  if (originalSubjectIdx >= 0 && finalSubjectIdx >= 0 && finalSubjectIdx < originalSubjectIdx) {
    const subjectText = finalUnits[finalSubjectIdx]!.text;
    changes.push(`Attention sequencing: moved "${subjectText}" to position ${finalSubjectIdx}`);
  }

  // Report cohesion pairs
  const pairedUnits = finalUnits.filter((u) => u.isPair);
  for (const pair of pairedUnits) {
    changes.push(`Cohesion pair: kept "${pair.segments.map((s) => s.text).join('" + "')}" adjacent`);
  }

  // Report dropped anchors
  for (const d of dropped) {
    changes.push(`Token budget: dropped "${d}" (lowest AVIS score)`);
  }

  if (changes.length === 0) {
    changes.push('Attention sequencing: prompt already in optimal order');
  }

  return changes;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Build an AVISConfig from a PlatformDNA profile.
 * Convenience function so callers don't need to wire up the curve manually.
 */
export function configFromDNA(dna: PlatformDNA): AVISConfig {
  const attentionCurve = getAttentionCurve(dna.encoderFamily);
  const enforceToken = dna.encoderFamily === 'clip';
  return {
    attentionCurve,
    enforceTokenBudget: enforceToken,
    tokenLimit: dna.tokenLimit,
  };
}

/**
 * Reorder prompt phrases by AVIS score for optimal encoder processing.
 *
 * This is the core deterministic transform for CLIP T1 platforms.
 * It moves high visual-impact anchors to high-attention positions while
 * preserving interaction coherence through cohesion pairs.
 *
 * All original content is preserved. No words are invented, removed (unless
 * token budget exceeded on CLIP), or rewritten. Only the ORDER changes.
 *
 * @param assembledPrompt  The assembled prompt (Call 2 output)
 * @param anchors          Pre-computed anchor manifest
 * @param config           AVIS configuration (attention curve, budget settings)
 * @param dna              Platform DNA profile
 * @returns SequencedResult with reordered text, changes, and diagnostics
 */
export function sequenceByAVIS(
  assembledPrompt: string,
  anchors: AnchorManifest,
  config: AVISConfig,
  _dna: PlatformDNA,
): SequencedResult {
  // ── Guard: very short or empty input → return unchanged ─────────
  const trimmed = assembledPrompt.trim();
  if (trimmed.length === 0 || estimateTokens(trimmed) <= 5) {
    return {
      text: trimmed,
      changes: ['Attention sequencing: prompt too short to reorder'],
      avisScores: [],
      tokensUsed: estimateTokens(trimmed),
      anchorsDropped: [],
      wasReordered: false,
    };
  }

  // ── Step 1: Parse into phrase segments ──────────────────────────
  const segments = parseIntoSegments(trimmed, anchors);

  // Guard: if 2 or fewer segments, reordering is trivial/harmful
  if (segments.length <= 2) {
    return {
      text: trimmed,
      changes: ['Attention sequencing: too few segments to reorder'],
      avisScores: [],
      tokensUsed: estimateTokens(trimmed),
      anchorsDropped: [],
      wasReordered: false,
    };
  }

  // ── Step 2: Detect cohesion pairs ──────────────────────────────
  const pairs = detectCohesionPairs(trimmed, anchors);

  // ── Step 3: Build sequencing units (merge pairs) ───────────────
  const units = buildSequencingUnits(segments, pairs, config.enforceTokenBudget);

  // ── Step 4: Sort by AVIS score ─────────────────────────────────
  const sorted = sortByAVIS(units);

  // ── Step 5: Enforce token budget (CLIP only) ───────────────────
  let finalUnits = sorted;
  let dropped: string[] = [];

  if (config.enforceTokenBudget && config.tokenLimit !== null) {
    const budgetResult = enforceTokenBudget(sorted, config.tokenLimit);
    finalUnits = budgetResult.kept;
    dropped = budgetResult.dropped;
  }

  // ── Step 6: Compute AVIS scores for diagnostics ────────────────
  const effectiveLimit = config.tokenLimit ?? 512;
  const avisScores = computeAVISScores(finalUnits, config.attentionCurve, effectiveLimit);

  // ── Step 7: Reassemble ─────────────────────────────────────────
  const resequencedText = finalUnits.map((u) => u.text).join(', ');
  const tokensUsed = finalUnits.reduce((sum, u) => sum + u.tokens, 0);

  // ── Step 8: Detect whether reordering actually happened ────────
  const originalOrder = segments.map((s) => s.text).join(', ');
  const wasReordered = resequencedText !== originalOrder;

  // ── Step 9: Generate change descriptions ───────────────────────
  const changes = describeChanges(segments, finalUnits, dropped);

  return {
    text: resequencedText,
    changes,
    avisScores,
    tokensUsed,
    anchorsDropped: dropped,
    wasReordered,
  };
}
