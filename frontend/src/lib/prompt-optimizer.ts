// src/lib/prompt-optimizer.ts
// ============================================================================
// PROMPT OPTIMIZER v3.0.0 — Tier-Aware Gold-Standard Pipeline
// ============================================================================
//
// Routes to the correct optimization strategy based on how the assembler
// actually produced the prompt text:
//
//   Tier 4 platforms      → Plain Language pipeline (simplified removal)
//   Keywords + Tier 2     → Midjourney pipeline (protect -- params, steep decay)
//   Keywords (other)      → CLIP Keyword pipeline (token-aware, 5-phase)
//   Natural language      → Clause-Level pipeline (remove whole clauses)
//
// Each pipeline shares core building blocks (redundancy pairs, term removal,
// compression rules) but applies strategy-specific scoring, decay, and surgery.
//
// v3.0.0 changelog (Phase C — Next-Level Features):
// - C1: Semantic similarity engine — auto-detects redundancy from pre-computed
//        CLIP embedding pairs (src/data/semantic-pairs.json). Merges with
//        hand-curated pairs. Falls back gracefully if JSON not yet generated.
//        Run: python tools/generate-semantic-pairs.py
// - C2: Prompt compression/rewriting — new Phase 4 with 50+ compression rules.
//        Rewrites verbose phrases to shorter equivalents without losing visual
//        meaning (e.g., "subject centred vertically" → "centered").
//        Saves 20-70 chars per rule. Runs after Phase 3 if still over target.
// - C3: Real CLIP BPE tokenization — exact token counts for Tier 1 platforms.
//        Replaces ~3.5 chars/token heuristic with actual CLIP BPE algorithm.
//        Load vocab: python tools/generate-clip-vocab.py, then import JSON.
//        Falls back to improved word-level heuristic (~93% vs old ~85%).
//
// v2.1.0 changelog (Phase B — Upgrade Quality):
// - B1: Expanded REDUNDANCY_PAIRS from 29 → 217 pairs across all 11 categories
//        + 25 cross-category pairs (lighting×colour, atmosphere×colour, etc.)
// - B2: Injected-term discovery in parseTerms() — qualityPrefix/qualitySuffix
//        terms (masterpiece, 8K, etc.) are now visible to redundancy + scoring
// - B3: Per-strategy weights already complete (Phase A)
//
// v2.0.0 changelog (Phase A — Tier-Aware Routing):
// - Added tier-aware routing (mirrors assembleTierAware in prompt-builder.ts)
// - Added Midjourney pipeline with -- parameter protection + steep decay
// - Added Natural Language pipeline with clause-level surgery
// - Added Plain Language pipeline (simplified keyword removal)
// - Per-tier category importance weights (MJ: fidelity=0.20, not 0.85)
// - Per-strategy position decay curves
//
// Authority: docs/authority/prompt-builder-page.md
// ============================================================================

import type { PromptCategory, PromptSelections } from '@/types/prompt-builder';
import { getPromptLimit } from '@/lib/prompt-trimmer';
import { getPlatformTierId } from '@/data/platform-tiers';
import { getPlatformFormat } from '@/lib/prompt-builder';
import { clipTokenCount } from '@/lib/clip-bpe-tokenizer';

// ============================================================================
// TYPES
// ============================================================================

export interface OptimizeInput {
  /** The assembled prompt text (including composition pack) */
  promptText: string;
  /** Current category selections (composition pack terms included) */
  selections: PromptSelections;
  /** Platform ID for limit lookup */
  platformId: string;
  /** Target character length (defaults to platform idealMax) */
  targetLength?: number;
}

export interface OptimizeResult {
  /** The optimized prompt text */
  optimized: string;
  /** Whether any optimization occurred */
  wasTrimmed: boolean;
  /** Terms that were removed, with reason */
  removedTerms: RemovedTerm[];
  /** Original character length */
  originalLength: number;
  /** Optimized character length */
  optimizedLength: number;
  /** Categories that had ALL terms removed (for UI display) */
  removedCategories: string[];
  /** Phase that achieved the target (0-4) or -1 if already within */
  achievedAtPhase: number;
}

export interface RemovedTerm {
  term: string;
  category: PromptCategory;
  score: number;
  reason: 'redundant' | 'past-token-limit' | 'lowest-score' | 'compressed';
}

/** Parsed term with metadata for scoring */
interface ScoredTerm {
  /** The raw text of this term as it appears in the prompt */
  text: string;
  /** Which category it belongs to */
  category: PromptCategory;
  /** Approximate CLIP token position (cumulative) */
  tokenPosition: number;
  /** Approximate token count for this term alone */
  tokenCount: number;
  /** Computed priority score (higher = keep longer) */
  score: number;
  /** Whether this term is protected from removal */
  isProtected: boolean;
}

/** A clause in a natural language prompt (Tier 3) */
interface PromptClause {
  /** The full clause text as it appears in the assembled prompt */
  text: string;
  /** Category this clause belongs to */
  category: PromptCategory;
  /** Priority score (higher = keep) */
  score: number;
  /** Whether this clause is protected */
  isProtected: boolean;
}

// ============================================================================
// OPTIMIZER STRATEGY
// ============================================================================
// Mirrors the routing in assembleTierAware() from prompt-builder.ts:
//
//   tierId === 4                          → 'plain'
//   promptStyle === 'keywords' + tierId 2 → 'midjourney'
//   promptStyle === 'keywords'            → 'keywords'  (Tier 1, Flux, etc.)
//   else                                  → 'natural'   (Tier 3 sentence mode)
//
// This ensures the optimizer knows exactly what format the assembler produced.

type OptimizerStrategy = 'keywords' | 'midjourney' | 'natural' | 'plain';

function detectStrategy(platformId: string): OptimizerStrategy {
  const tierId = getPlatformTierId(platformId);
  const format = getPlatformFormat(platformId);

  // Tier 4 always gets plain language — even keyword-style Tier 4 platforms
  // (e.g. artistly) get short simple output (matches assembleTierAware logic)
  if (tierId === 4) return 'plain';

  // Keyword-mode platforms: check if Midjourney family
  if (format.promptStyle === 'keywords') {
    if (tierId === 2) return 'midjourney';
    return 'keywords';
  }

  // Everything else: natural language (Tier 3 sentence platforms)
  return 'natural';
}

// ============================================================================
// CATEGORY IMPORTANCE WEIGHTS — PER-STRATEGY
// ============================================================================
// Higher = more important = removed last.
// These are strategy-specific because platforms value categories differently:
//
// - keywords (CLIP/Tier 1): fidelity boosters like "masterpiece" are crucial
// - midjourney (Tier 2):    fidelity terms are "junk" (David Holz's words)
// - natural (Tier 3):       grammar structure matters, fidelity less relevant
// - plain (Tier 4):         everything is low-priority except subject + style

const STRATEGY_WEIGHTS: Record<OptimizerStrategy, Record<string, number>> = {
  keywords: {
    subject: 1.0, // NEVER trim — core identity
    style: 0.95, // Almost never — defines aesthetic
    fidelity: 0.85, // HIGH for CLIP — masterpiece/best quality are crucial
    lighting: 0.75, // Important — defines mood and atmosphere
    environment: 0.7, // Semi-core — scene context
    action: 0.65, // Core but trimmable — pose/gesture
    colour: 0.55, // Enhancement — grade/palette
    camera: 0.5, // Can be implied by other terms
    atmosphere: 0.45, // Enhancement — mood overlay
    materials: 0.4, // Enhancement — texture
    composition: 0.3, // Lowest — framing hints, often CLIP-invisible
  },
  midjourney: {
    subject: 1.0, // Core identity
    style: 0.95, // MJ excels at style interpretation
    environment: 0.8, // MJ is great at scene building
    lighting: 0.75, // Mood-defining
    action: 0.7, // MJ handles dynamic poses well
    atmosphere: 0.6, // MJ responds well to mood words
    colour: 0.5, // Enhancement
    camera: 0.45, // Less impactful on MJ
    materials: 0.35, // Enhancement
    fidelity: 0.2, // MJ V6: "avoid junk like 4k, 8k, photorealistic"
    composition: 0.15, // MJ handles framing internally
  },
  natural: {
    subject: 1.0, // Core — the grammatical subject
    action: 0.9, // Part of core sentence nucleus
    style: 0.85, // Defines aesthetic
    environment: 0.8, // Scene context clause
    lighting: 0.7, // Important visual detail
    colour: 0.6, // Descriptive clause
    atmosphere: 0.55, // Mood modifier
    camera: 0.45, // Technical detail
    materials: 0.4, // Descriptive detail
    fidelity: 0.35, // Less relevant — DALL-E/Imagen handle quality internally
    composition: 0.25, // Framing hints less effective in NL
  },
  plain: {
    subject: 1.0, // Core
    style: 0.8, // Helpful
    environment: 0.7, // Scene
    action: 0.65, // Activity
    lighting: 0.5, // Often ignored by Tier 4 platforms
    colour: 0.45, // Enhancement
    atmosphere: 0.4, // Enhancement
    camera: 0.3, // Usually ignored
    materials: 0.25, // Usually ignored
    fidelity: 0.15, // Tier 4 platforms ignore quality tags
    composition: 0.1, // Tier 4 platforms ignore framing hints
  },
};

// ============================================================================
// POSITION DECAY — PER-STRATEGY
// ============================================================================

function getPositionWeight(
  tokenPosition: number,
  tokenLimit: number | null,
  strategy: OptimizerStrategy,
): number {
  // ── Midjourney: very steep decay — words 1–10 dominate ──
  // David Holz: influence drops sharply after 20–40 words.
  if (strategy === 'midjourney') {
    if (tokenPosition <= 10) return 1.0;
    if (tokenPosition <= 20) return 0.6;
    if (tokenPosition <= 40) return 0.3;
    return 0.1;
  }

  // ── Plain language: flat — position matters little for Tier 4 ──
  if (strategy === 'plain') {
    return 1.0;
  }

  // ── Natural language: gentle decay (T5/GPT handle long context well) ──
  if (strategy === 'natural') {
    if (tokenPosition <= 30) return 1.0;
    if (tokenPosition <= 60) return 0.85;
    if (tokenPosition <= 100) return 0.7;
    return 0.5;
  }

  // ── Keywords (CLIP): token-limit-aware decay with hard cliff ──
  if (tokenLimit !== null) {
    if (tokenPosition <= 20) return 1.0; // Full attention zone
    if (tokenPosition <= 50) return 0.7; // Moderate attention
    if (tokenPosition <= tokenLimit) return 0.4; // Diminishing attention
    return 0.0; // Past limit — model literally ignores these tokens
  }

  // Keywords without explicit CLIP limit (Flux T5 at 256 tokens etc.)
  if (tokenPosition <= 30) return 1.0;
  if (tokenPosition <= 60) return 0.85;
  if (tokenPosition <= 100) return 0.7;
  return 0.5;
}

// ============================================================================
// REDUNDANCY PAIRS — UNIDIRECTIONAL
// ============================================================================
// Format: [term to KEEP, term to REMOVE]
// When both are present in the prompt, the second one gets removed.
// All matching is case-insensitive and strips CLIP weight syntax.
//
// IMPORTANT: These are one-way. [A, B] means "if A and B both exist, remove B".
// It does NOT mean "if B and A both exist, remove A".
// To make it bidirectional, add BOTH directions explicitly.

const REDUNDANCY_PAIRS: ReadonlyArray<readonly [string, string]> = [
  // ──────────────────────────────────────────────────────────────────────────
  // LIGHTING (30 pairs)
  // Curated against: src/data/vocabulary/prompt-builder/lighting.json (633 values)
  // ──────────────────────────────────────────────────────────────────────────
  ['flat lighting', 'even lighting'],
  ['dramatic lighting', 'cinematic lighting'],
  ['soft lighting', 'gentle lighting'],
  ['soft lighting', 'diffused light'],
  ['harsh lighting', 'hard lighting'],
  ['golden hour', 'warm lighting'],
  ['golden hour', 'sunset lighting'],
  ['blue hour', 'cool lighting'],
  ['studio lighting', 'professional lighting'],
  ['rim lighting', 'backlit'],
  ['rim lighting', 'backlight'],
  ['volumetric lighting', 'god rays'],
  ['volumetric lighting', 'light shafts'],
  ['volumetric lighting', 'crepuscular rays'],
  ['volumetric lighting', 'light beams'],
  ['neon lighting', 'neon glow'],
  ['chiaroscuro', 'dramatic lighting'],
  ['low key lighting', 'dark lighting'],
  ['high key lighting', 'bright lighting'],
  ['ambient lighting', 'available light'],
  ['ambient lighting', 'natural lighting'],
  ['bounce light', 'reflected light'],
  ['butterfly lighting', 'paramount lighting'],
  ['split lighting', 'half lighting'],
  ['side lighting', 'cross lighting'],
  ['silhouette lighting', 'contre-jour'],
  ['spotlight', 'pool of light'],
  ['spotlight', 'isolated lighting'],
  ['overcast sky', 'cloudy diffused'],
  ['fill light', 'bounce light'],

  // ──────────────────────────────────────────────────────────────────────────
  // FIDELITY (35 pairs)
  // Curated against: src/data/vocabulary/prompt-builder/fidelity.json (589 values)
  // + qualityPrefix/qualitySuffix from platform-formats.json
  // ──────────────────────────────────────────────────────────────────────────
  ['masterpiece', 'highly detailed'],
  ['masterpiece', 'best quality'],
  ['best quality', 'high quality'],
  ['best quality', 'professional quality'],
  ['best quality', 'studio quality'],
  ['ultra detailed', 'highly detailed'],
  ['ultra detailed', 'extremely detailed'],
  ['ultra detailed', 'intricate details'],
  ['ultra detailed', 'fine details'],
  ['sharp focus', 'in focus'],
  ['sharp focus', 'tack sharp'],
  ['sharp focus', 'razor sharp'],
  ['sharp focus', 'perfectly focused'],
  ['sharp focus', 'crisp details'],
  ['sharp focus', 'crystal clear'],
  ['photorealistic', 'ultra realistic'],
  ['photorealistic', 'hyperrealistic'],
  ['photorealistic', 'lifelike'],
  ['photorealistic', 'true to life'],
  ['8K resolution', '4K resolution'],
  ['8K', '4K'],
  ['8K', '4K resolution'],
  ['8K resolution', '4K'],
  ['16K resolution', '8K resolution'],
  ['16K resolution', '4K resolution'],
  ['ultra high definition', 'high resolution'],
  ['IMAX quality', 'cinema quality'],
  ['cinema quality', 'broadcast quality'],
  ['museum quality', 'archival quality'],
  ['print quality', 'publication quality'],
  ['retina quality', 'high resolution'],
  ['anatomically correct', 'realistic proportions'],
  ['physically accurate', 'anatomically correct'],
  ['micro details', 'fine details'],
  ['intricate details', 'fine details'],

  // ──────────────────────────────────────────────────────────────────────────
  // STYLE (24 pairs)
  // Curated against: src/data/vocabulary/prompt-builder/style.json (617 values)
  // ──────────────────────────────────────────────────────────────────────────
  ['oil painting', 'painted'],
  ['watercolor', 'watercolour'],
  ['watercolor painting', 'watercolour'],
  ['watercolor painting', 'watercolor'],
  ['digital painting', 'digital art'],
  ['concept art', 'digital painting'],
  ['matte painting', 'digital painting'],
  ['charcoal drawing', 'pencil drawing'],
  ['sketch style', 'pencil drawing'],
  ['line art', 'sketch style'],
  ['graffiti art', 'street art'],
  ['pop art', 'comic book style'],
  ['impressionist', 'soft brushstrokes'],
  ['minimalist', 'clean design'],
  ['anime style', 'manga style'],
  ['comic book style', 'graphic novel style'],
  ['pixel art', 'retro game style'],
  ['voxel art', 'pixel art'],
  ['low poly', 'geometric style'],
  ['art nouveau', 'art deco'],
  ['baroque style', 'renaissance style'],
  ['surrealist', 'dreamlike'],
  ['abstract', 'non-representational'],
  ['stencil art', 'street art'],

  // ──────────────────────────────────────────────────────────────────────────
  // ATMOSPHERE (22 pairs)
  // Curated against: src/data/vocabulary/prompt-builder/atmosphere.json (641 values)
  // ──────────────────────────────────────────────────────────────────────────
  ['dense fog', 'thick fog'],
  ['misty', 'foggy'],
  ['foggy atmosphere', 'misty morning'],
  ['misty morning', 'hazy morning'],
  ['hazy afternoon', 'hazy morning'],
  ['smoky ambiance', 'hazy atmosphere'],
  ['dark and brooding', 'moody'],
  ['mysterious', 'enigmatic'],
  ['ethereal', 'otherworldly'],
  ['serene', 'peaceful'],
  ['serene', 'tranquil'],
  ['calm', 'peaceful'],
  ['calm', 'serene'],
  ['ominous', 'foreboding'],
  ['ominous', 'menacing'],
  ['melancholic', 'somber'],
  ['joyful', 'uplifting'],
  ['tense', 'suspenseful'],
  ['eerie', 'haunting'],
  ['magical', 'mystical'],
  ['chaotic', 'frenetic'],
  ['warm and cozy', 'intimate'],

  // ──────────────────────────────────────────────────────────────────────────
  // CAMERA (24 pairs)
  // Curated against: src/data/vocabulary/prompt-builder/camera.json (627 values)
  // ──────────────────────────────────────────────────────────────────────────
  ['wide angle', 'wide-angle'],
  ['close-up', 'closeup'],
  ['close-up shot', 'close-up'],
  ['close-up shot', 'closeup'],
  ['extreme close-up', 'macro lens'],
  ['low angle shot', 'low angle'],
  ['low angle', "worm's eye"],
  ['low angle shot', 'worms eye view'],
  ['high angle shot', 'high angle'],
  ["bird's eye", 'overhead'],
  ['birds eye view', 'overhead shot'],
  ['birds eye view', 'top-down view'],
  ['aerial shot', 'drone photography'],
  ['aerial shot', 'birds eye view'],
  ['full body shot', 'full body'],
  ['wide shot', 'establishing shot'],
  ['extreme wide shot', 'wide shot'],
  ['dutch angle', 'canted angle'],
  ['dutch angle', 'canted frame'],
  ['tracking shot feel', 'dolly zoom effect'],
  ['handheld camera feel', 'shaky cam'],
  ['profile shot', 'side view'],
  ['three-quarter view', 'three quarter angle'],
  ['frontal view', 'front facing'],
  ['over-the-shoulder', 'OTS shot'],

  // ──────────────────────────────────────────────────────────────────────────
  // COLOUR (18 pairs)
  // Curated against: src/data/vocabulary/prompt-builder/colour.json (617 values)
  // ──────────────────────────────────────────────────────────────────────────
  ['vibrant colours', 'saturated'],
  ['muted tones', 'desaturated'],
  ['muted tones', 'subdued palette'],
  ['monochrome', 'black and white'],
  ['warm tones', 'warm palette'],
  ['cool tones', 'cool palette'],
  ['earth tones', 'warm tones'],
  ['cinematic colour', 'colour grading'],
  ['teal and orange', 'cinematic colour'],
  ['sepia toned', 'warm vintage'],
  ['neon colours', 'electric colours'],
  ['pastel palette', 'soft colours'],
  ['jewel tones', 'rich colours'],
  ['high contrast', 'bold contrast'],
  ['iridescent', 'holographic'],
  ['metallic accents', 'metallic sheen'],
  ['duotone', 'split toning'],
  ['colour splash', 'selective colour'],

  // ──────────────────────────────────────────────────────────────────────────
  // MATERIALS (15 pairs)
  // Curated against: src/data/vocabulary/prompt-builder/materials.json (600 values)
  // ──────────────────────────────────────────────────────────────────────────
  ['chrome reflection', 'mirror finish'],
  ['chrome reflection', 'metallic sheen'],
  ['gold leaf', 'gilded surface'],
  ['velvet soft', 'velvet texture'],
  ['silk shimmer', 'satin sheen'],
  ['glass transparency', 'crystal clarity'],
  ['marble texture', 'polished stone'],
  ['concrete texture', 'brutalist concrete'],
  ['linen texture', 'cotton weave'],
  ['lace delicate', 'embroidery detail'],
  ['iron rust', 'oxidized metal'],
  ['copper patina', 'oxidized copper'],
  ['wood grain', 'natural wood'],
  ['steel brushed', 'brushed metal'],
  ['brass polish', 'polished brass'],

  // ──────────────────────────────────────────────────────────────────────────
  // COMPOSITION (18 pairs)
  // Curated against: src/data/vocabulary/prompt-builder/composition.json (580 values)
  // ──────────────────────────────────────────────────────────────────────────
  ['subject dominates frame', 'subject fills frame'],
  ['subject centred vertically', 'centred vertically'],
  ['subject-background separation', 'figure-ground separation'],
  ['subject-background separation', 'figure-ground relationship'],
  ['full-body', 'full body'],
  ['dramatic presence', 'dramatic atmosphere'],
  ['strong depth separation', 'layered vertical depth'],
  ['strong depth separation', 'layered depth'],
  ['subject as focal point', 'figure as focal point'],
  ['golden ratio', 'golden spiral'],
  ['golden ratio', 'fibonacci spiral'],
  ['symmetrical composition', 'bilateral symmetry'],
  ['radial symmetry', 'radial composition'],
  ['centered subject', 'centered composition'],
  ['negative space emphasis', 'minimalist composition'],
  ['leading lines', 'guiding lines'],
  ['foreground interest', 'foreground element'],
  ['atmospheric perspective', 'aerial perspective'],

  // ──────────────────────────────────────────────────────────────────────────
  // ENVIRONMENT (12 pairs)
  // Curated against: src/data/vocabulary/prompt-builder/environment.json (582 values)
  // ──────────────────────────────────────────────────────────────────────────
  ['dark forest', 'dense forest'],
  ['misty woods', 'foggy forest'],
  ['tropical jungle', 'dense jungle'],
  ['ancient temple', 'ruined temple'],
  ['gothic cathedral', 'gothic church'],
  ['mountain peak', 'snowy summit'],
  ['desert canyon', 'arid canyon'],
  ['flower meadow', 'wildflower field'],
  ['rolling hills', 'green hills'],
  ['overgrown ruins', 'abandoned ruins'],
  ['zen garden', 'japanese garden'],
  ['victorian greenhouse', 'glass conservatory'],

  // ──────────────────────────────────────────────────────────────────────────
  // CROSS-CATEGORY (20 pairs)
  // These catch redundancies across different dropdowns that a user might
  // select simultaneously — e.g., golden hour lighting + warm tones colour.
  // ──────────────────────────────────────────────────────────────────────────

  // Lighting × Colour
  ['golden hour', 'warm tones'],
  ['golden hour', 'orange and gold'],
  ['blue hour', 'cool tones'],
  ['neon lighting', 'neon colours'],

  // Lighting × Atmosphere
  ['low key lighting', 'dark and brooding'],
  ['high key lighting', 'light and airy'],
  ['volumetric lighting', 'foggy atmosphere'],
  ['soft lighting', 'dreamy soft'],

  // Atmosphere × Colour
  ['dark and brooding', 'desaturated'],
  ['warm and cozy', 'warm tones'],

  // Camera × Composition
  ['extreme close-up', 'macro composition'],
  ['wide shot', 'wide framing'],

  // Style × Fidelity (cross-category — style dropdown + fidelity dropdown)
  ['photorealistic', 'ultra detailed'],
  ['hyperrealistic', 'ultra detailed'],

  // Fidelity × Fidelity (cross-group — auto-injected qualityPrefix vs dropdown)
  ['masterpiece', 'ultra detailed'],
  ['masterpiece', 'professional quality'],
  ['8K', 'ultra high definition'],
  ['highly detailed', 'intricate details'],
  ['highly detailed', 'fine details'],
  ['extremely detailed', 'intricate details'],
];

// ============================================================================
// C1: SEMANTIC SIMILARITY ENGINE
// ============================================================================
// Auto-detects redundancy from pre-computed CLIP embedding pairs.
//
// Instead of maintaining a hand-curated list, this system:
// 1. Pre-computes CLIP text embeddings for all ~5,500 vocabulary terms (offline)
// 2. Finds all pairs with cosine similarity > 0.85
// 3. Ships the result as src/data/semantic-pairs.json (~200KB)
// 4. At runtime, merges semantic + hand-curated pairs for redundancy detection
//
// Hand-curated pairs always win on conflicts (they're manually verified).
// Semantic pairs catch the long tail that hand curation misses.
//
// To generate semantic pairs:
//   python tools/generate-semantic-pairs.py
//
// If semantic-pairs.json doesn't exist yet, only hand-curated pairs are used.

/** Format: [termA, termB, similarity, categoryA, categoryB] */
type SemanticPairTuple = readonly [string, string, number, string, string];

interface SemanticPairsData {
  metadata?: {
    threshold?: number;
    totalPairs?: number;
  };
  pairs: SemanticPairTuple[];
}

/** Loaded semantic pairs (empty until loadSemanticPairs is called) */
let semanticPairs: ReadonlyArray<readonly [string, string]> = [];

/**
 * Load pre-computed semantic similarity pairs from JSON.
 *
 * Call once at app startup:
 *   import pairsData from '@/data/semantic-pairs.json';
 *   loadSemanticPairs(pairsData);
 *
 * These pairs augment the hand-curated REDUNDANCY_PAIRS table.
 * Direction: termA is kept, termB is removed (higher similarity terms
 * are more interchangeable, so removal order matters less — we default
 * to keeping whichever appears first in the prompt).
 */
export function loadSemanticPairs(data: SemanticPairsData): void {
  try {
    const pairs: Array<readonly [string, string]> = [];
    const handCuratedSet = new Set(
      REDUNDANCY_PAIRS.map(([a, b]) => `${a.toLowerCase()}|${b.toLowerCase()}`),
    );

    for (const tuple of data.pairs) {
      const [termA, termB] = tuple;
      // Skip if this pair (in either direction) is already hand-curated
      const keyAB = `${termA.toLowerCase()}|${termB.toLowerCase()}`;
      const keyBA = `${termB.toLowerCase()}|${termA.toLowerCase()}`;
      if (handCuratedSet.has(keyAB) || handCuratedSet.has(keyBA)) continue;

      // Add as a unidirectional pair (A kept, B removed)
      pairs.push([termA, termB] as const);
    }

    semanticPairs = pairs;
  } catch {
    semanticPairs = [];
  }
}

/** Check if semantic pairs are loaded */
export function isSemanticPairsLoaded(): boolean {
  return semanticPairs.length > 0;
}

// ============================================================================
// NATURAL LANGUAGE CLAUSE CONNECTORS
// ============================================================================
// Mirrors SENTENCE_CONNECTORS from prompt-builder.ts exactly.
// Used by the natural language optimizer to reconstruct clause boundaries
// and identify which clause belongs to which category.
//
// The assembler builds: "A baby saluting in a skyscraper, in isometric style,
//   with flat lighting, experimental atmosphere"
// The optimizer reconstructs: { environment: "in a skyscraper",
//   style: "in isometric style", lighting: "with flat lighting", ... }

interface ClauseConnector {
  prefix?: string;
  suffix?: string;
  joiner?: string;
}

const CLAUSE_CONNECTORS: Record<string, ClauseConnector> = {
  subject: {},
  action: {},
  environment: { prefix: 'in ' },
  style: { prefix: 'in ', suffix: ' style' },
  lighting: { prefix: 'with ' },
  atmosphere: { suffix: ' atmosphere' },
  colour: {},
  materials: { prefix: 'featuring ' },
  composition: {},
  camera: {},
  fidelity: {},
};

// ============================================================================
// SHARED UTILITIES
// ============================================================================

/**
 * Strip CLIP weight syntax to get the bare term for matching.
 * "(flat lighting:1.1)" → "flat lighting"
 * "dramatic bold" → "dramatic bold"
 */
function normalizeForMatch(term: string): string {
  const trimmed = term.trim();
  const weighted = trimmed.match(/^\((.+?)(?::[\d.]+)?\)$/);
  if (weighted) return weighted[1]!.toLowerCase().trim();
  return trimmed.toLowerCase();
}

/**
 * Find redundant terms using hand-curated pairs + semantic pairs.
 * Returns a Map: normalized-term-to-remove → normalized-term-that-keeps-it
 *
 * v3.0.0 (C1): Merges REDUNDANCY_PAIRS (hand-curated, 218 pairs) with
 * semanticPairs (auto-generated from CLIP embeddings). Hand-curated pairs
 * are checked first. This catches the long tail of redundancies that
 * hand curation misses.
 */
function findRedundantTerms(termTexts: string[]): Map<string, string> {
  const normalizedSet = new Set(termTexts.map(normalizeForMatch));
  const toRemove = new Map<string, string>();

  // Check hand-curated pairs first (these are authoritative)
  for (const [keeper, duplicate] of REDUNDANCY_PAIRS) {
    const keeperNorm = keeper.toLowerCase();
    const dupNorm = duplicate.toLowerCase();

    if (normalizedSet.has(keeperNorm) && normalizedSet.has(dupNorm)) {
      if (!toRemove.has(dupNorm)) {
        toRemove.set(dupNorm, keeperNorm);
      }
    }
  }

  // Then check semantic pairs (auto-generated, catches the long tail)
  if (semanticPairs.length > 0) {
    for (const [keeper, duplicate] of semanticPairs) {
      const keeperNorm = keeper.toLowerCase();
      const dupNorm = duplicate.toLowerCase();

      if (normalizedSet.has(keeperNorm) && normalizedSet.has(dupNorm)) {
        // Don't override hand-curated decisions
        if (!toRemove.has(dupNorm)) {
          toRemove.set(dupNorm, keeperNorm);
        }
      }
    }
  }

  return toRemove;
}

/**
 * CLIP BPE token count for a text fragment.
 *
 * v3.0.0 (C3): Delegates to clip-bpe-tokenizer.ts which provides:
 *   - Exact BPE tokenization when vocab is loaded (zero error)
 *   - Improved word-level heuristic as fallback (~93% accurate)
 *
 * This replaces the old ~3.5 chars/token estimate (~85% accurate).
 * The improvement matters most for Tier 1 (CLIP) platforms where the
 * 77-token hard cutoff makes every token count.
 *
 * To enable exact tokenization:
 *   1. python tools/generate-clip-vocab.py
 *   2. import vocabData from '@/data/clip-bpe-vocab.json'
 *   3. loadClipVocab(vocabData)  // call once at app startup
 */
function estimateTokenCount(text: string): number {
  return clipTokenCount(text);
}

/**
 * Surgically remove a single term/clause from the prompt string.
 * Handles: comma cleanup, leading/trailing commas, double spaces.
 */
function removeTerm(prompt: string, termText: string): string {
  const escaped = termText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Try removal patterns in order of specificity
  const patterns = [
    // ", term, " or ", term$" — term in middle or at end
    new RegExp(`,\\s*${escaped}\\s*(?=,|$)`, 'gi'),
    // "^term, " — term at the very start
    new RegExp(`^${escaped}\\s*,\\s*`, 'gi'),
    // "term" standalone (last resort)
    new RegExp(escaped, 'gi'),
  ];

  let result = prompt;
  for (const pattern of patterns) {
    const before = result;
    result = result.replace(pattern, '');
    if (result !== before) break; // Stop at first successful pattern
  }

  // Cleanup pass
  return result
    .replace(/,\s*,+/g, ', ') // Double commas → single
    .replace(/^\s*,\s*/, '') // Leading comma
    .replace(/\s*,\s*$/, '') // Trailing comma
    .replace(/\s{2,}/g, ' ') // Double spaces
    .replace(/,([^\s])/g, ', $1') // Ensure space after comma
    .trim();
}

// ============================================================================
// C2: PROMPT COMPRESSION / REWRITING
// ============================================================================
// Rewrites verbose phrases to shorter equivalents that preserve visual meaning.
//
// This is Phase 4 — runs AFTER Phase 3 (weakest-term removal) if the prompt
// is still over the target length. Unlike Phase 3 which removes entire terms,
// Phase 4 compresses existing terms to be shorter.
//
// Example savings:
//   "subject centred vertically"     (27 chars) → "centered"           (8 chars)  = -19
//   "full-body or three-quarter"     (26 chars) → "full-body"          (9 chars)  = -17
//   "subject-background separation"  (29 chars) → "figure-ground"      (13 chars) = -16
//   "foreground-midground-background" (31 chars) → "layered depth"     (12 chars) = -19
//
// Rules are applied greedily — longest match first to avoid partial replacements.
// Each rule is [pattern, replacement]. Pattern matching is case-insensitive.

interface CompressionRule {
  /** Pattern to match (case-insensitive, may be regex string or exact match) */
  pattern: string;
  /** Shorter replacement that preserves visual meaning */
  replacement: string;
  /** Characters saved (computed, not stored) */
}

const COMPRESSION_RULES: ReadonlyArray<CompressionRule> = [
  // ── Composition terms (biggest savings — composition pack phrases are verbose) ──
  { pattern: 'subject centred vertically', replacement: 'centered' },
  { pattern: 'subject centered vertically', replacement: 'centered' },
  { pattern: 'full-body or three-quarter', replacement: 'full-body' },
  { pattern: 'subject-background separation', replacement: 'figure-ground' },
  { pattern: 'subject dominates frame', replacement: 'subject-dominant' },
  { pattern: 'subject fills frame', replacement: 'subject-dominant' },
  { pattern: 'figure-ground relationship', replacement: 'figure-ground' },
  { pattern: 'figure-ground separation', replacement: 'figure-ground' },
  { pattern: 'visual weight distribution', replacement: 'balanced weight' },
  { pattern: 'foreground-midground-background', replacement: 'layered depth' },
  { pattern: 'layered vertical depth', replacement: 'layered depth' },
  { pattern: 'strong depth separation', replacement: 'depth separation' },
  { pattern: 'subject as focal point', replacement: 'focal subject' },
  { pattern: 'figure as focal point', replacement: 'focal subject' },
  { pattern: 'single focal point', replacement: 'focal point' },
  { pattern: 'negative space emphasis', replacement: 'negative space' },
  { pattern: 'symmetrical composition', replacement: 'symmetrical' },
  { pattern: 'centered composition', replacement: 'centered' },
  { pattern: 'radial composition', replacement: 'radial' },
  { pattern: 'minimalist composition', replacement: 'minimalist' },
  { pattern: 'head near top third', replacement: 'headroom' },
  { pattern: 'face in upper third', replacement: 'headroom' },
  { pattern: 'classical portrait positioning', replacement: 'portrait position' },
  { pattern: 'poster-style positioning', replacement: 'poster layout' },
  { pattern: 'breathing room above head', replacement: 'headroom' },
  { pattern: 'environmental context', replacement: 'environment' },
  { pattern: 'contextual storytelling', replacement: 'storytelling' },
  { pattern: 'subject-environment relationship', replacement: 'subject-environment' },
  { pattern: 'dramatic vertical emphasis', replacement: 'vertical emphasis' },

  // ── Camera terms ──
  { pattern: 'portrait butterfly lighting angle', replacement: 'butterfly angle' },
  { pattern: 'architectural interior wide', replacement: 'interior wide' },
  { pattern: 'environmental portrait wide', replacement: 'portrait wide' },
  { pattern: 'multi-coating flare control', replacement: 'flare control' },
  { pattern: 'handheld camera feel', replacement: 'handheld' },
  { pattern: 'tracking shot feel', replacement: 'tracking' },
  { pattern: 'dolly zoom effect', replacement: 'dolly zoom' },
  { pattern: 'over-the-shoulder', replacement: 'OTS' },
  { pattern: 'shallow depth of field', replacement: 'shallow DOF' },
  { pattern: 'depth of field', replacement: 'DOF' },

  // ── Lighting terms ──
  { pattern: 'dramatic golden hour lighting', replacement: 'golden hour' },
  { pattern: 'portrait lighting flattering', replacement: 'portrait light' },
  { pattern: 'professional lighting', replacement: 'studio light' },
  { pattern: 'volumetric lighting', replacement: 'volumetric light' },
  { pattern: 'crepuscular rays', replacement: 'god rays' },

  // ── Fidelity terms ──
  { pattern: 'corner to corner sharpness', replacement: 'edge-to-edge sharp' },
  { pattern: 'mirror quality reflections', replacement: 'mirror reflections' },
  { pattern: 'anatomically correct', replacement: 'correct anatomy' },
  { pattern: 'physically accurate', replacement: 'accurate physics' },
  { pattern: 'ultra high definition', replacement: 'UHD' },

  // ── Pattern-based compressions (common verbose structures) ──
  { pattern: 'in the style of', replacement: 'style:' },
  { pattern: 'with a focus on', replacement: 'focused on' },
  { pattern: 'set against a backdrop of', replacement: 'backdrop:' },
  { pattern: 'surrounded by', replacement: 'amid' },
  { pattern: 'in the foreground', replacement: 'foreground' },
  { pattern: 'in the background', replacement: 'background' },
  { pattern: 'from a low angle', replacement: 'low angle' },
  { pattern: 'from a high angle', replacement: 'high angle' },
  { pattern: 'from eye level', replacement: 'eye level' },
  { pattern: 'taken from above', replacement: 'overhead' },
];

// Sort by pattern length descending so longest matches win
const SORTED_COMPRESSION_RULES = [...COMPRESSION_RULES].sort(
  (a, b) => b.pattern.length - a.pattern.length,
);

/**
 * Apply compression rules to shorten the prompt without losing visual meaning.
 *
 * Phase 4 of the optimization pipeline. Runs after Phase 3 (weakest-term removal)
 * if the prompt is still over target. Returns the compressed prompt and an array
 * of applied compressions for the RemovedTerms report.
 */
function compressPrompt(
  prompt: string,
  removedTerms: RemovedTerm[],
): string {
  let result = prompt;

  for (const rule of SORTED_COMPRESSION_RULES) {
    const regex = new RegExp(
      rule.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'gi',
    );

    if (regex.test(result)) {
      const before = result;
      result = result.replace(regex, rule.replacement);

      if (result !== before) {
        const saved = before.length - result.length;
        removedTerms.push({
          term: `${rule.pattern} → ${rule.replacement} (−${saved})`,
          category: 'composition' as PromptCategory, // Most compression targets are composition
          score: 0,
          reason: 'compressed',
        });
      }
    }
  }

  // Cleanup pass (same as removeTerm)
  return result
    .replace(/,\s*,+/g, ', ')
    .replace(/^\s*,\s*/, '')
    .replace(/\s*,\s*$/, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/,([^\s])/g, ', $1')
    .trim();
}

// ============================================================================
// TERM PARSING (for keyword-based strategies)
// ============================================================================

/**
 * Parse prompt into individual scored terms with position metadata.
 *
 * Walks through selections (which include composition pack terms),
 * finds each term's position in the assembled prompt string,
 * and computes approximate token positions.
 *
 * B2: Also discovers auto-injected quality terms (qualityPrefix/qualitySuffix
 * from platform-formats.json) that exist in the prompt text but aren't in
 * selections. Without this, "masterpiece", "best quality", "8K" etc. are
 * invisible to redundancy detection and scoring — they can't be removed
 * when over budget and can't participate in redundancy pair matching.
 *
 * Example: Stability auto-injects "masterpiece, best quality, highly detailed".
 * If the user also picks "ultra detailed" from fidelity dropdown, the
 * redundancy pair ["ultra detailed", "highly detailed"] now fires because
 * both terms are visible.
 */
function parseTerms(
  promptText: string,
  selections: PromptSelections,
  protectStyle: boolean = true,
  platformId?: string,
): ScoredTerm[] {
  const terms: ScoredTerm[] = [];
  const promptLower = promptText.toLowerCase();

  // Track all known term texts (lowercase) to avoid duplicates
  const knownTermsLower = new Set<string>();

  for (const [category, values] of Object.entries(selections)) {
    if (!values || !Array.isArray(values) || category === 'negative') continue;

    for (const value of values) {
      knownTermsLower.add(value.toLowerCase());
      terms.push({
        text: value,
        category: category as PromptCategory,
        tokenPosition: 0,
        tokenCount: estimateTokenCount(value),
        score: 0,
        isProtected: category === 'subject' || (protectStyle && category === 'style'),
      });
    }
  }

  // ── B2: Discover auto-injected quality terms ──
  // The assembler injects qualityPrefix/qualitySuffix from platform-formats.json
  // directly into the prompt text (e.g., "masterpiece", "best quality", "8K").
  // These are NOT in selections — they're config-driven injections.
  // We surface them as fidelity terms so they participate in:
  //   1. Redundancy detection (pair with user-selected fidelity terms)
  //   2. Scoring + removal (can be trimmed when over budget)
  if (platformId) {
    try {
      const format = getPlatformFormat(platformId);
      const injectedTerms = [...(format.qualityPrefix ?? []), ...(format.qualitySuffix ?? [])];

      for (const injected of injectedTerms) {
        // Strip NovelAI brace syntax: {{{masterpiece}}} → masterpiece
        const bare = injected.replace(/[{}]/g, '');
        if (knownTermsLower.has(bare.toLowerCase())) continue;
        if (!promptLower.includes(bare.toLowerCase())) continue;

        knownTermsLower.add(bare.toLowerCase());
        terms.push({
          text: bare,
          category: 'fidelity' as PromptCategory,
          tokenPosition: 0,
          // Use original string for accurate token count (braces add tokens)
          tokenCount: estimateTokenCount(injected),
          score: 0,
          isProtected: false, // Injected terms are always removable
        });
      }
    } catch {
      // If getPlatformFormat fails for unknown platform, skip discovery
    }
  }

  // Sort by actual position in the prompt string
  terms.sort((a, b) => {
    const posA = promptLower.indexOf(a.text.toLowerCase());
    const posB = promptLower.indexOf(b.text.toLowerCase());
    return (posA >= 0 ? posA : 9999) - (posB >= 0 ? posB : 9999);
  });

  // Compute cumulative token positions
  let runningTokens = 0;
  for (const term of terms) {
    term.tokenPosition = runningTokens;
    runningTokens += term.tokenCount;
  }

  return terms;
}

/** Recompute cumulative token positions after terms have been removed. */
function recomputeTokenPositions(terms: ScoredTerm[]): void {
  let pos = 0;
  for (const term of terms) {
    term.tokenPosition = pos;
    pos += term.tokenCount;
  }
}

/**
 * Score each term: category_importance × position_weight × 100.
 * Protected terms get score 10000 (effectively untouchable).
 */
function scoreAllTerms(
  terms: ScoredTerm[],
  tokenLimit: number | null,
  strategy: OptimizerStrategy,
): void {
  const weights = STRATEGY_WEIGHTS[strategy];
  for (const term of terms) {
    if (term.isProtected) {
      term.score = 10000;
      continue;
    }
    const catWeight = weights[term.category] ?? 0.3;
    const posWeight = getPositionWeight(term.tokenPosition, tokenLimit, strategy);
    term.score = Math.round(catWeight * posWeight * 100);
  }
}

// ============================================================================
// SHARED: Phase 0 — Redundancy Removal
// ============================================================================
// Used by all 4 pipelines. Removes duplicate semantics, keeps the stronger.

function runPhase0Redundancy(
  allTerms: ScoredTerm[],
  workingPrompt: string,
  removedTerms: RemovedTerm[],
): string {
  const redundancyMap = findRedundantTerms(allTerms.map((t) => t.text));

  if (redundancyMap.size > 0) {
    for (let i = allTerms.length - 1; i >= 0; i--) {
      const term = allTerms[i]!;
      if (term.isProtected) continue;

      const normalized = normalizeForMatch(term.text);
      const keptBy = redundancyMap.get(normalized);

      if (keptBy) {
        const newPrompt = removeTerm(workingPrompt, term.text);
        if (newPrompt !== workingPrompt) {
          workingPrompt = newPrompt;
          removedTerms.push({
            term: term.text,
            category: term.category,
            score: 0,
            reason: 'redundant',
          });
          allTerms.splice(i, 1);
        }
      }
    }
  }

  return workingPrompt;
}

// ============================================================================
// PIPELINE 1: KEYWORD OPTIMIZER (Tier 1 CLIP + Flux)
// ============================================================================
// The original 4-phase pipeline. Works on comma-separated keyword prompts.
//
// Phase 0: Redundancy removal (free — no quality loss)
// Phase 1: CLIP token overflow trim (free — invisible terms)
// Phase 2: Position-aware scoring (category × position_decay)
// Phase 3: Weakest-term surgical removal

function optimizeKeywords(
  promptText: string,
  selections: PromptSelections,
  target: number,
  tokenLimit: number | null,
  platformId: string,
): OptimizeResult {
  if (promptText.length <= target) {
    return noTrimResult(promptText);
  }

  const allTerms = parseTerms(promptText, selections, true, platformId);
  const removedTerms: RemovedTerm[] = [];

  // ── Phase 0: Redundancy Removal ──
  let workingPrompt = runPhase0Redundancy(allTerms, promptText, removedTerms);
  if (workingPrompt.length <= target) {
    return buildResult(promptText, workingPrompt, removedTerms, 0, selections);
  }

  // ── Phase 1: CLIP Token Overflow Trim ──
  if (tokenLimit !== null) {
    recomputeTokenPositions(allTerms);
    const overflowTerms = allTerms.filter((t) => t.tokenPosition >= tokenLimit && !t.isProtected);
    for (const term of overflowTerms) {
      const newPrompt = removeTerm(workingPrompt, term.text);
      if (newPrompt !== workingPrompt) {
        workingPrompt = newPrompt;
        removedTerms.push({
          term: term.text,
          category: term.category,
          score: 0,
          reason: 'past-token-limit',
        });
        const idx = allTerms.indexOf(term);
        if (idx >= 0) allTerms.splice(idx, 1);
      }
    }
  }
  if (workingPrompt.length <= target) {
    return buildResult(promptText, workingPrompt, removedTerms, 1, selections);
  }

  // ── Phase 2+3: Score + Remove Weakest ──
  recomputeTokenPositions(allTerms);
  scoreAllTerms(allTerms, tokenLimit, 'keywords');

  const candidates = allTerms.filter((t) => !t.isProtected).sort((a, b) => a.score - b.score);

  for (const candidate of candidates) {
    if (workingPrompt.length <= target) break;
    const newPrompt = removeTerm(workingPrompt, candidate.text);
    if (newPrompt !== workingPrompt) {
      workingPrompt = newPrompt;
      removedTerms.push({
        term: candidate.text,
        category: candidate.category,
        score: candidate.score,
        reason: 'lowest-score',
      });
    }
  }

  if (workingPrompt.length <= target) {
    return buildResult(promptText, workingPrompt, removedTerms, 3, selections);
  }

  // ── Phase 4: Prompt Compression (C2) ──
  // If still over target after removal, try compressing verbose phrases
  workingPrompt = compressPrompt(workingPrompt, removedTerms);

  return buildResult(promptText, workingPrompt, removedTerms, workingPrompt.length <= target ? 4 : 3, selections);
}

// ============================================================================
// PIPELINE 2: MIDJOURNEY OPTIMIZER (Tier 2)
// ============================================================================
// Protects -- parameters (--no, --ar, --v, --s, --style, --chaos, --seed).
// Uses steep position decay (words 1–10 dominate).
// Skips Phase 1 — MJ has no 77-token hard cutoff.
//
// Phase 0: Split creative vs -- params → Redundancy on creative only
// Phase 2: Score with MJ-specific steep decay
// Phase 3: Weakest-term removal on creative only → Rejoin with params

function optimizeMidjourney(
  promptText: string,
  selections: PromptSelections,
  target: number,
  platformId: string,
): OptimizeResult {
  if (promptText.length <= target) {
    return noTrimResult(promptText);
  }

  // ── Split: creative text vs -- parameters ──
  // The assembler appends "--no blur, text" at the end for MJ/BlueWillow.
  // Everything after the first " --" is sacred and must never be touched.
  const paramSplitIndex = promptText.indexOf(' --');
  let creativeText: string;
  let paramsSuffix: string;

  if (paramSplitIndex >= 0) {
    creativeText = promptText.slice(0, paramSplitIndex);
    paramsSuffix = promptText.slice(paramSplitIndex); // includes leading space
  } else {
    creativeText = promptText;
    paramsSuffix = '';
  }

  // Target for creative text = total target minus params length
  const creativeTarget = target - paramsSuffix.length;

  if (creativeText.length <= creativeTarget) {
    return noTrimResult(promptText);
  }

  // Parse only the creative portion
  const allTerms = parseTerms(creativeText, selections, true, platformId);
  const removedTerms: RemovedTerm[] = [];

  // ── Phase 0: Redundancy Removal ──
  let workingCreative = runPhase0Redundancy(allTerms, creativeText, removedTerms);
  if (workingCreative.length <= creativeTarget) {
    const final = workingCreative + paramsSuffix;
    return buildResult(promptText, final, removedTerms, 0, selections);
  }

  // ── Phase 2+3: Score with MJ decay + Remove Weakest ──
  // (No Phase 1 — MJ has no 77-token hard cutoff)
  recomputeTokenPositions(allTerms);
  scoreAllTerms(allTerms, null, 'midjourney');

  const candidates = allTerms.filter((t) => !t.isProtected).sort((a, b) => a.score - b.score);

  for (const candidate of candidates) {
    if (workingCreative.length <= creativeTarget) break;
    const newPrompt = removeTerm(workingCreative, candidate.text);
    if (newPrompt !== workingCreative) {
      workingCreative = newPrompt;
      removedTerms.push({
        term: candidate.text,
        category: candidate.category,
        score: candidate.score,
        reason: 'lowest-score',
      });
    }
  }

  // ── Phase 4: Prompt Compression (C2) ──
  if (workingCreative.length > creativeTarget) {
    workingCreative = compressPrompt(workingCreative, removedTerms);
  }

  const final = workingCreative + paramsSuffix;
  return buildResult(promptText, final, removedTerms, workingCreative.length <= creativeTarget ? 4 : 3, selections);
}

// ============================================================================
// PIPELINE 3: NATURAL LANGUAGE OPTIMIZER (Tier 3 sentence-mode)
// ============================================================================
// Works on grammatical clauses instead of comma-separated tokens.
//
// The assembler (assembleNaturalSentences) builds prompts like:
//   "A baby saluting in a skyscraper, in isometric style,
//    with flat lighting, experimental atmosphere"
//
// Each comma-separated segment is a CLAUSE built from a category + connector:
//   environment: "in " + value                → "in a skyscraper"
//   style:       "in " + value + " style"     → "in isometric style"
//   lighting:    "with " + value              → "with flat lighting"
//   atmosphere:  value + " atmosphere"        → "experimental atmosphere"
//
// We reconstruct each clause from selections + CLAUSE_CONNECTORS, score by
// category importance, and remove the lowest-scored CLAUSE (preserving
// grammatical structure).
//
// Phase 0: Redundancy on individual values
// Phase 2: Score each clause by category importance
// Phase 3: Remove weakest clause (whole clause, not individual word)

function optimizeNaturalLanguage(
  promptText: string,
  selections: PromptSelections,
  target: number,
): OptimizeResult {
  if (promptText.length <= target) {
    return noTrimResult(promptText);
  }

  // ── Build clause map: reconstruct what the assembler produced ──
  // For each category with selections, rebuild the clause using the same
  // connector logic as assembleNaturalSentences().
  const clauses: PromptClause[] = [];
  const promptLower = promptText.toLowerCase();

  for (const [category, values] of Object.entries(selections)) {
    if (!values || !Array.isArray(values) || category === 'negative') continue;

    const connector = CLAUSE_CONNECTORS[category] ?? {};
    const joiner = connector.joiner ?? ' and ';
    const prefix = connector.prefix ?? '';
    const suffix = connector.suffix ?? '';
    const clauseText = `${prefix}${values.join(joiner)}${suffix}`;

    // Verify this clause actually exists in the assembled prompt
    if (promptLower.includes(clauseText.toLowerCase())) {
      clauses.push({
        text: clauseText,
        category: category as PromptCategory,
        score: 0,
        // Subject and action form the core sentence nucleus — never remove
        isProtected: category === 'subject' || category === 'action',
      });
    } else {
      // Fallback: try matching individual values for categories where
      // the connector pattern didn't match exactly (e.g., fidelity
      // with no connector, or the assembler transformed the text)
      for (const value of values) {
        if (promptLower.includes(value.toLowerCase())) {
          clauses.push({
            text: value,
            category: category as PromptCategory,
            score: 0,
            isProtected: category === 'subject' || category === 'action',
          });
        }
      }
    }
  }

  let workingPrompt = promptText;
  const removedTerms: RemovedTerm[] = [];

  // ── Phase 0: Redundancy (check individual values within clauses) ──
  const allValues: string[] = [];
  for (const [, values] of Object.entries(selections)) {
    if (values) allValues.push(...values);
  }
  const redundancyMap = findRedundantTerms(allValues);

  if (redundancyMap.size > 0) {
    for (const [category, values] of Object.entries(selections)) {
      if (!values || category === 'negative') continue;
      for (const value of values) {
        if (category === 'subject' || category === 'action') continue;

        const normalized = normalizeForMatch(value);
        if (redundancyMap.has(normalized)) {
          // Try removing as a full clause first (with connector), then bare value
          const connector = CLAUSE_CONNECTORS[category] ?? {};
          const prefix = connector.prefix ?? '';
          const suffix = connector.suffix ?? '';
          const fullClause = `${prefix}${value}${suffix}`;

          let newPrompt = removeTerm(workingPrompt, fullClause);
          if (newPrompt === workingPrompt) {
            newPrompt = removeTerm(workingPrompt, value);
          }
          if (newPrompt !== workingPrompt) {
            workingPrompt = newPrompt;
            removedTerms.push({
              term: value,
              category: category as PromptCategory,
              score: 0,
              reason: 'redundant',
            });
            // Also remove from clauses array
            const clauseIdx = clauses.findIndex(
              (c) => c.text.toLowerCase().includes(value.toLowerCase()) && c.category === category,
            );
            if (clauseIdx >= 0) clauses.splice(clauseIdx, 1);
          }
        }
      }
    }
  }

  if (workingPrompt.length <= target) {
    return buildResult(promptText, workingPrompt, removedTerms, 0, selections);
  }

  // ── Phase 2+3: Score clauses + Remove weakest clause ──
  const weights = STRATEGY_WEIGHTS['natural'];
  for (const clause of clauses) {
    if (clause.isProtected) {
      clause.score = 10000;
    } else {
      clause.score = Math.round((weights[clause.category] ?? 0.3) * 100);
    }
  }

  // Sort by score ascending — lowest = remove first
  const candidates = clauses.filter((c) => !c.isProtected).sort((a, b) => a.score - b.score);

  for (const candidate of candidates) {
    if (workingPrompt.length <= target) break;

    const newPrompt = removeTerm(workingPrompt, candidate.text);
    if (newPrompt !== workingPrompt) {
      workingPrompt = newPrompt;
      removedTerms.push({
        term: candidate.text,
        category: candidate.category,
        score: candidate.score,
        reason: 'lowest-score',
      });
    }
  }

  if (workingPrompt.length <= target) {
    return buildResult(promptText, workingPrompt, removedTerms, 3, selections);
  }

  // ── Phase 4: Prompt Compression (C2) ──
  workingPrompt = compressPrompt(workingPrompt, removedTerms);

  return buildResult(promptText, workingPrompt, removedTerms, workingPrompt.length <= target ? 4 : 3, selections);
}

// ============================================================================
// PIPELINE 4: PLAIN LANGUAGE OPTIMIZER (Tier 4)
// ============================================================================
// Simplified keyword removal for Canva, Craiyon, PicsArt, etc.
//
// assemblePlainLanguage() produces short comma-separated keywords.
// No CLIP token awareness needed. No weight syntax. Flat position decay.
//
// Phase 0: Redundancy removal
// Phase 2: Score with plain-language weights (flat decay)
// Phase 3: Weakest-term removal

function optimizePlainLanguage(
  promptText: string,
  selections: PromptSelections,
  target: number,
  platformId: string,
): OptimizeResult {
  if (promptText.length <= target) {
    return noTrimResult(promptText);
  }

  // Plain language: style is less sacred — allow trimming if needed
  const allTerms = parseTerms(promptText, selections, false, platformId);
  const removedTerms: RemovedTerm[] = [];

  // ── Phase 0: Redundancy Removal ──
  let workingPrompt = runPhase0Redundancy(allTerms, promptText, removedTerms);
  if (workingPrompt.length <= target) {
    return buildResult(promptText, workingPrompt, removedTerms, 0, selections);
  }

  // ── Phase 2+3: Score + Remove Weakest ──
  // No Phase 1 (no token limit). Flat position decay.
  scoreAllTerms(allTerms, null, 'plain');

  const candidates = allTerms.filter((t) => !t.isProtected).sort((a, b) => a.score - b.score);

  for (const candidate of candidates) {
    if (workingPrompt.length <= target) break;
    const newPrompt = removeTerm(workingPrompt, candidate.text);
    if (newPrompt !== workingPrompt) {
      workingPrompt = newPrompt;
      removedTerms.push({
        term: candidate.text,
        category: candidate.category,
        score: candidate.score,
        reason: 'lowest-score',
      });
    }
  }

  if (workingPrompt.length <= target) {
    return buildResult(promptText, workingPrompt, removedTerms, 3, selections);
  }

  // ── Phase 4: Prompt Compression (C2) ──
  workingPrompt = compressPrompt(workingPrompt, removedTerms);

  return buildResult(promptText, workingPrompt, removedTerms, workingPrompt.length <= target ? 4 : 3, selections);
}

// ============================================================================
// MAIN ENTRY POINT — TIER-AWARE ROUTER
// ============================================================================

/**
 * Gold-standard tier-aware prompt optimizer.
 *
 * Detects the platform's tier and prompt style, then routes to the
 * correct optimization pipeline:
 *
 *   Tier 4              → Plain Language (simplified removal)
 *   Keywords + Tier 2   → Midjourney (protect --, steep decay)
 *   Keywords (other)    → CLIP Keyword (token-aware, 4-phase)
 *   Natural language    → Clause-Level (remove whole clauses)
 *
 * @example
 * ```ts
 * // Tier 1 CLIP platform
 * const r1 = optimizePromptGoldStandard({
 *   promptText: assembled,
 *   selections,
 *   platformId: 'stability',   // → keywords pipeline
 * });
 *
 * // Tier 2 Midjourney
 * const r2 = optimizePromptGoldStandard({
 *   promptText: assembled,
 *   selections,
 *   platformId: 'midjourney',  // → midjourney pipeline (protects --)
 * });
 *
 * // Tier 3 Natural Language (DALL-E)
 * const r3 = optimizePromptGoldStandard({
 *   promptText: assembled,
 *   selections,
 *   platformId: 'openai',      // → clause-level pipeline
 * });
 *
 * // Tier 3 Keyword-mode (Flux)
 * const r4 = optimizePromptGoldStandard({
 *   promptText: assembled,
 *   selections,
 *   platformId: 'flux',        // → keywords pipeline (NOT natural)
 * });
 * ```
 */
export function optimizePromptGoldStandard(input: OptimizeInput): OptimizeResult {
  const { promptText, selections, platformId, targetLength } = input;

  const limits = getPromptLimit(platformId);
  const target = targetLength ?? limits.idealMax;
  const tokenLimit = limits.tokenLimit;
  const strategy = detectStrategy(platformId);

  switch (strategy) {
    case 'midjourney':
      return optimizeMidjourney(promptText, selections, target, platformId);

    case 'natural':
      return optimizeNaturalLanguage(promptText, selections, target);

    case 'plain':
      return optimizePlainLanguage(promptText, selections, target, platformId);

    case 'keywords':
    default:
      return optimizeKeywords(promptText, selections, target, tokenLimit, platformId);
  }
}

// ============================================================================
// SHARED RESULT BUILDERS
// ============================================================================

/** Build a no-trim result for prompts already within target. */
function noTrimResult(promptText: string): OptimizeResult {
  return {
    optimized: promptText,
    wasTrimmed: false,
    removedTerms: [],
    originalLength: promptText.length,
    optimizedLength: promptText.length,
    removedCategories: [],
    achievedAtPhase: -1,
  };
}

/** Build the final OptimizeResult with removed-category detection. */
function buildResult(
  original: string,
  optimized: string,
  removedTerms: RemovedTerm[],
  phase: number,
  selections: PromptSelections,
): OptimizeResult {
  // Determine which categories were fully emptied
  const removedCategories: string[] = [];
  for (const [category, values] of Object.entries(selections)) {
    if (!values || values.length === 0 || category === 'negative') continue;
    const allRemoved = values.every((v) => removedTerms.some((r) => r.term === v));
    if (allRemoved) {
      removedCategories.push(category);
    }
  }

  return {
    optimized,
    wasTrimmed: removedTerms.length > 0,
    removedTerms,
    originalLength: original.length,
    optimizedLength: optimized.length,
    removedCategories,
    achievedAtPhase: phase,
  };
}
