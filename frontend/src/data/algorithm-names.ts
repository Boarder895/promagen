// src/data/algorithm-names.ts
// ============================================================================
// ALGORITHM DISPLAY NAMES — Optimisation Cycling Animation
// ============================================================================
// 101 algorithm names + 3 finale names for the Prompt Lab optimisation
// cycling animation. Displayed during Call 3 (AI prompt optimisation)
// to create the impression of deep algorithmic processing.
//
// Human factors:
//   §3 Anticipatory Dopamine — rapidly cycling names create the
//       expectation-acceleration-reward pattern before the optimised
//       prompt is revealed.
//   §6 Temporal Compression — reading speed keeps attention occupied,
//       making 2–4s API latency feel shorter than clock time.
//   §1 Curiosity Gap — technical names the user half-understands
//       create narrow curiosity gaps ("what does CLIP attention
//       weighting actually do?") that keep them engaged.
//
// Authority: ai-disguise.md §9 (The 101 Algorithm Names)
// Existing features preserved: Yes (new file, no modifications).
// ============================================================================

// ============================================================================
// MASTER LIST — 101 cycling names
// ============================================================================
// Grouped by category in source for maintainability.
// Shuffled at runtime so the user never sees them in category order.

/** Master list of algorithm display names for the optimisation cycling animation */
export const ALGORITHM_NAMES: readonly string[] = [
  // ── Token & Weight Analysis (20) ─────────────────────────────────
  'Analysing semantic token density',
  'Calibrating CLIP attention weights',
  'Mapping cross-attention distribution',
  'Evaluating token position decay',
  'Computing attention head alignment',
  'Detecting token overflow boundaries',
  'Scoring positional emphasis curves',
  'Rebalancing weight distribution',
  'Normalising CLIP embedding vectors',
  'Profiling token-to-pixel influence',
  'Estimating diffusion step impact',
  'Quantifying prompt-to-latent mapping',
  'Resolving weight saturation zones',
  'Measuring encoder throughput',
  'Scanning for orphaned token fragments',
  'Verifying weight syntax compliance',
  'Calculating diminishing returns threshold',
  'Indexing attention priority layers',
  'Tracing token influence propagation',
  'Benchmarking encoding efficiency',

  // ── Quality & Fidelity Optimisation (18) ─────────────────────────
  'Amplifying core quality anchors',
  'Strengthening fidelity descriptors',
  'Optimising quality prefix placement',
  'Evaluating resolution signal density',
  'Boosting masterpiece token weight',
  'Assessing aesthetic coherence score',
  'Calibrating sharpness parameters',
  'Validating detail preservation ratio',
  'Enhancing photorealistic signal chain',
  'Scoring output quality prediction',
  'Measuring visual fidelity potential',
  'Adjusting clarity emphasis levels',
  'Profiling HDR dynamic range tokens',
  'Verifying anti-artifact safeguards',
  'Tuning noise reduction signals',
  'Balancing detail vs abstraction',
  'Computing perceived quality index',
  'Optimising render-ready markers',

  // ── Composition & Spatial Intelligence (16) ──────────────────────
  'Analysing compositional flow patterns',
  'Reweighting foreground-background ratio',
  'Evaluating depth-of-field signals',
  'Optimising rule-of-thirds alignment',
  'Detecting perspective coherence',
  'Scoring spatial relationship clarity',
  'Balancing subject-environment weight',
  'Assessing framing intelligence',
  'Computing visual hierarchy score',
  'Mapping leading line emphasis',
  'Calibrating negative space allocation',
  'Evaluating vanishing point signals',
  'Profiling aspect ratio optimality',
  'Resolving compositional conflicts',
  'Normalising focal point distribution',
  'Aligning camera-lens coherence',

  // ── Colour & Lighting Intelligence (16) ──────────────────────────
  'Harmonising colour-light coherence',
  'Evaluating chromatic balance',
  'Calibrating lighting direction signals',
  'Scoring ambient illumination weight',
  'Detecting colour palette conflicts',
  'Optimising warm-cool tone ratio',
  'Rebalancing shadow-highlight tokens',
  'Profiling golden hour signal strength',
  'Assessing volumetric light density',
  'Mapping rim lighting emphasis',
  'Computing colour harmony index',
  'Normalising tonal range distribution',
  'Verifying atmospheric light scatter',
  'Adjusting chiaroscuro balance',
  'Measuring colour saturation curves',
  'Optimising luminance contrast ratio',

  // ── Platform-Specific Tuning (16) ────────────────────────────────
  'Loading platform syntax profile',
  'Applying provider-specific formatting',
  'Calibrating sweet spot length target',
  'Optimising for platform token encoder',
  'Adjusting prompt architecture for model',
  'Mapping category priority to platform',
  'Evaluating platform response patterns',
  'Scoring platform-optimised term order',
  'Configuring negative prompt syntax',
  'Validating parameter flag positions',
  'Tuning weight syntax for target model',
  'Aligning with platform quality gates',
  'Profiling model attention architecture',
  'Computing platform-specific trim map',
  'Adjusting for model context window',
  'Optimising inference step alignment',

  // ── Semantic & Structural Analysis (15) ──────────────────────────
  'Removing semantic redundancy',
  'Detecting duplicate concept clusters',
  'Pruning low-signal modifier chains',
  'Resolving synonym saturation',
  'Compressing verbose descriptors',
  'Eliminating orphaned verb fragments',
  'Stripping grammar debris tokens',
  'Consolidating overlapping attributes',
  'Rewriting compound descriptions',
  'Defragmenting prompt structure',
  'Bridging disconnected scene elements',
  'Tightening descriptor specificity',
  'Collapsing adjacent near-synonyms',
  'Streamlining modifier hierarchy',
  'Merging compatible style references',
] as const;

// ============================================================================
// FINALE SUBSET — always the last 3 items before landing
// ============================================================================

/** Always shown as the final 3 items before the landing message */
export const FINALE_NAMES: readonly string[] = [
  'Finalising prompt structure',
  'Applying quality verification',
  'Validating output integrity',
] as const;

// ============================================================================
// SHUFFLE UTILITY
// ============================================================================

/**
 * Fisher-Yates shuffle — returns a new shuffled array, does not mutate input.
 * Called once per optimisation run so the user never sees the same sequence.
 */
export function shuffleAlgorithms(): string[] {
  const arr = [...ALGORITHM_NAMES];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

// ============================================================================
// ALGORITHM COUNT — randomised landing number
// ============================================================================

/**
 * Generate the "algorithms applied" count for the landing message.
 * Range: 87–102 (always high, always different, always credible).
 *
 * Authority: ai-disguise.md §10
 */
export function getAlgorithmCount(): number {
  const BASE = 87;
  const VARIATION = 16; // 0–15
  return BASE + Math.floor(Math.random() * VARIATION);
}
