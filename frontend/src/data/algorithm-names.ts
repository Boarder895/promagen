// src/data/algorithm-names.ts
// ============================================================================
// DYNAMIC BINARY ALGORITHM ENGINE — Optimisation Cycling Animation
// ============================================================================
// 6 algorithm families × ~18 sub-variants each = 108 core names, plus
// 12 × 15 = 180 category-specific names for context-aware cycling.
//
// Each run randomly selects 3–4 of the 6 families, shuffles sub-variants
// from those families, and interleaves them so no two runs look alike.
// The landing message picks a random family-specific verb + count.
//
// The 6 families:
//   1. Dynamic Binary Algorithms — threshold gates, decision cascades
//   2. Quantum Annealing — tunnelling states, energy minimisation
//   3. Genetic Evolution — mutation, fitness, selection pressure
//   4. Neural Architecture Search (NAS) — layer pruning, depth optimisation
//   5. Markov Chain Monte Carlo (MCMC) — posterior sampling, convergence
//   6. Topological Data Analysis (TDA) — persistent homology, manifold mapping
//
// Human factors:
//   §3 Anticipatory Dopamine — rapidly cycling names create the
//       expectation-acceleration-reward pattern before the result
//       is revealed.
//   §6 Temporal Compression — reading speed keeps attention occupied,
//       making 2–4s API latency feel shorter than clock time.
//   §1 Curiosity Gap — technical names the user half-understands
//       create narrow curiosity gaps that keep them engaged.
//
// Authority: ai-disguise.md §9 (The Algorithm Names)
// Existing features preserved: Yes.
// ============================================================================

// ============================================================================
// THE 6 ALGORITHM FAMILIES
// ============================================================================
// Each family has 18 sub-variant names that sound like genuine
// computational sub-processes. Real terminology, real science —
// just not what's actually happening behind the curtain.

export interface AlgorithmFamily {
  /** Short identifier */
  id: string;
  /** Full display name (never shown alone — always with sub-variant) */
  label: string;
  /** Sub-variant process names */
  variants: readonly string[];
  /** Verb phrase for the landing message (e.g. "gates resolved") */
  landingVerb: string;
}

const FAMILY_DYNAMIC_BINARY: AlgorithmFamily = {
  id: 'dba',
  label: 'Dynamic Binary',
  landingVerb: 'binary gates resolved',
  variants: [
    'Dynamic Binary — Threshold Calibration',
    'Dynamic Binary — Decision Cascade Propagation',
    'Dynamic Binary — Gate Saturation Analysis',
    'Dynamic Binary — Bifurcation Point Detection',
    'Dynamic Binary — Conditional Branch Pruning',
    'Dynamic Binary — State Transition Mapping',
    'Dynamic Binary — Parity Check Optimisation',
    'Dynamic Binary — Entropy Reduction Pass',
    'Dynamic Binary — Boolean Satisfiability Sweep',
    'Dynamic Binary — Adaptive Gate Weighting',
    'Dynamic Binary — Signal-to-Noise Partitioning',
    'Dynamic Binary — Decision Boundary Refinement',
    'Dynamic Binary — Binary Tree Rebalancing',
    'Dynamic Binary — Threshold Drift Compensation',
    'Dynamic Binary — Conditional Probability Mapping',
    'Dynamic Binary — Gate Latency Normalisation',
    'Dynamic Binary — Switching Cost Minimisation',
    'Dynamic Binary — Hysteresis Loop Correction',
  ] as const,
};

const FAMILY_QUANTUM_ANNEALING: AlgorithmFamily = {
  id: 'qa',
  label: 'Quantum Annealing',
  landingVerb: 'quantum states converged',
  variants: [
    'Quantum Annealing — Tunnelling State Reduction',
    'Quantum Annealing — Energy Landscape Traversal',
    'Quantum Annealing — Superposition Collapse Analysis',
    'Quantum Annealing — Hamiltonian Path Optimisation',
    'Quantum Annealing — Qubit Coherence Validation',
    'Quantum Annealing — Thermal Fluctuation Damping',
    'Quantum Annealing — Ground State Convergence',
    'Quantum Annealing — Adiabatic Schedule Tuning',
    'Quantum Annealing — Spin Glass Configuration',
    'Quantum Annealing — Phase Transition Detection',
    'Quantum Annealing — Coupling Strength Calibration',
    'Quantum Annealing — Barrier Height Estimation',
    'Quantum Annealing — Decoherence Window Analysis',
    'Quantum Annealing — Eigenstate Proximity Scoring',
    'Quantum Annealing — Flux Noise Compensation',
    'Quantum Annealing — Transverse Field Scheduling',
    'Quantum Annealing — Solution Landscape Mapping',
    'Quantum Annealing — Entanglement Entropy Profiling',
  ] as const,
};

const FAMILY_GENETIC_EVOLUTION: AlgorithmFamily = {
  id: 'ge',
  label: 'Genetic Evolution',
  landingVerb: 'evolution cycles complete',
  variants: [
    'Genetic Evolution — Mutation Fitness Sweep',
    'Genetic Evolution — Crossover Recombination Pass',
    'Genetic Evolution — Selection Pressure Calibration',
    'Genetic Evolution — Population Diversity Index',
    'Genetic Evolution — Elitism Threshold Enforcement',
    'Genetic Evolution — Chromosome Encoding Analysis',
    'Genetic Evolution — Phenotype Expression Mapping',
    'Genetic Evolution — Convergence Rate Estimation',
    'Genetic Evolution — Niche Partitioning Scan',
    'Genetic Evolution — Allele Frequency Drift Check',
    'Genetic Evolution — Multi-Objective Pareto Front',
    'Genetic Evolution — Tournament Selection Round',
    'Genetic Evolution — Adaptive Mutation Rate Tuning',
    'Genetic Evolution — Genotype-Phenotype Correlation',
    'Genetic Evolution — Fitness Landscape Gradient',
    'Genetic Evolution — Speciation Boundary Detection',
    'Genetic Evolution — Offspring Viability Scoring',
    'Genetic Evolution — Stagnation Escape Strategy',
  ] as const,
};

const FAMILY_NAS: AlgorithmFamily = {
  id: 'nas',
  label: 'Neural Architecture Search',
  landingVerb: 'architectures evaluated',
  variants: [
    'NAS — Layer Depth Pruning',
    'NAS — Skip Connection Evaluation',
    'NAS — Cell Architecture Sampling',
    'NAS — Activation Function Selection',
    'NAS — Channel Width Optimisation',
    'NAS — Search Space Reduction Pass',
    'NAS — Latency-Accuracy Trade-off',
    'NAS — Parameter Efficiency Scoring',
    'NAS — Block Topology Enumeration',
    'NAS — Weight Sharing Validation',
    'NAS — Supernet Distillation Check',
    'NAS — Operation Set Calibration',
    'NAS — Macro Architecture Ranking',
    'NAS — Hardware-Aware Constraint Fit',
    'NAS — Progressive Search Expansion',
    'NAS — One-Shot Path Sampling',
    'NAS — Architecture Embedding Scoring',
    'NAS — Differentiable Search Gradient',
  ] as const,
};

const FAMILY_MCMC: AlgorithmFamily = {
  id: 'mcmc',
  label: 'Markov Chain Monte Carlo',
  landingVerb: 'convergence chains complete',
  variants: [
    'MCMC — Posterior Convergence Pass',
    'MCMC — Metropolis-Hastings Acceptance',
    'MCMC — Burn-In Period Estimation',
    'MCMC — Chain Mixing Diagnostic',
    'MCMC — Proposal Distribution Tuning',
    'MCMC — Gelman-Rubin Convergence Check',
    'MCMC — Thinning Interval Optimisation',
    'MCMC — Effective Sample Size Scoring',
    'MCMC — Gibbs Sampling Sweep',
    'MCMC — Hamiltonian Trajectory Integration',
    'MCMC — Autocorrelation Lag Analysis',
    'MCMC — Stationary Distribution Validation',
    'MCMC — Jump Variance Calibration',
    'MCMC — Multi-Modal Detection Pass',
    'MCMC — Reversible Jump Assessment',
    'MCMC — Target Density Estimation',
    'MCMC — Ergodicity Verification',
    'MCMC — No-U-Turn Criterion Check',
  ] as const,
};

const FAMILY_TDA: AlgorithmFamily = {
  id: 'tda',
  label: 'Topological Data Analysis',
  landingVerb: 'topological mappings resolved',
  variants: [
    'TDA — Persistent Homology Mapping',
    'TDA — Betti Number Computation',
    'TDA — Simplicial Complex Construction',
    'TDA — Filtration Threshold Scanning',
    'TDA — Persistence Barcode Generation',
    'TDA — Vietoris-Rips Complex Assembly',
    'TDA — Wasserstein Distance Scoring',
    'TDA — Bottleneck Stability Analysis',
    'TDA — Mapper Graph Partitioning',
    'TDA — Connected Component Tracking',
    'TDA — Cycle Detection Pass',
    'TDA — Nerve Theorem Validation',
    'TDA — Cubical Complex Reduction',
    'TDA — Persistence Landscape Profiling',
    'TDA — Feature Scale Decomposition',
    'TDA — Homological Dimension Scoring',
    'TDA — Euler Characteristic Estimation',
    'TDA — Topological Signature Extraction',
  ] as const,
};

/** All 6 algorithm families */
export const ALGORITHM_FAMILIES: readonly AlgorithmFamily[] = [
  FAMILY_DYNAMIC_BINARY,
  FAMILY_QUANTUM_ANNEALING,
  FAMILY_GENETIC_EVOLUTION,
  FAMILY_NAS,
  FAMILY_MCMC,
  FAMILY_TDA,
] as const;

// ============================================================================
// FINALE SUBSET — always the last 3 items before landing
// ============================================================================

/** Always shown as the final 3 items before the landing message */
export const FINALE_NAMES: readonly string[] = [
  'Finalising structural integrity check',
  'Running regression guard validation',
  'Confirming output convergence',
] as const;

// ============================================================================
// FAMILY SELECTION — pick 3–4 per run, never all 6
// ============================================================================

/**
 * Randomly select 3–4 of the 6 families for this run.
 * Ensures no two consecutive runs are likely to feature the same combo.
 * The user sees a different algorithmic flavour each time.
 */
export function selectFamilies(): AlgorithmFamily[] {
  const count = 3 + Math.floor(Math.random() * 2); // 3 or 4
  const shuffled = [...ALGORITHM_FAMILIES];
  // Fisher-Yates shuffle
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled.slice(0, count);
}

// ============================================================================
// SHUFFLE UTILITY — builds the per-run cycling sequence
// ============================================================================

/**
 * Build a shuffled cycling sequence from the selected families.
 * Pulls all sub-variants from the chosen families, then Fisher-Yates
 * shuffles so the user sees an interleaved mix — a TDA name, then a
 * Dynamic Binary name, then a Genetic name. No family clustering.
 *
 * Called once per optimisation run so the user never sees the same
 * sequence twice.
 */
export function shuffleAlgorithms(): string[] {
  const families = selectFamilies();
  const pool: string[] = [];

  for (const family of families) {
    pool.push(...family.variants);
  }

  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }

  return pool;
}

// ============================================================================
// ALGORITHM COUNT — randomised landing number
// ============================================================================

/**
 * Generate the process count for the landing message.
 * Range: 83–147 (always credible, always different).
 *
 * Authority: ai-disguise.md §10
 */
export function getAlgorithmCount(): number {
  const BASE = 83;
  const VARIATION = 65; // 0–64
  return BASE + Math.floor(Math.random() * VARIATION);
}

// ============================================================================
// LANDING MESSAGE GENERATOR — family-specific completion text
// ============================================================================

/**
 * Generate the landing message for the completion badge.
 * Picks a random family and uses its landing verb + the randomised count.
 *
 * Examples:
 *   "✓ 97 binary gates resolved"
 *   "✓ 114 evolution cycles complete"
 *   "✓ 83 quantum states converged"
 *   "✓ 131 topological mappings resolved"
 *
 * Each run gets a different family, different count, different verb.
 * No pattern for the user to latch onto.
 */
export function getLandingMessage(): { text: string; count: number } {
  const count = getAlgorithmCount();
  const familyIdx = Math.floor(Math.random() * ALGORITHM_FAMILIES.length);
  const family = ALGORITHM_FAMILIES[familyIdx] ?? ALGORITHM_FAMILIES[0]!;
  return {
    text: `\u2713 ${count} ${family.landingVerb}`,
    count,
  };
}

// ============================================================================
// CATEGORY-SPECIFIC ALGORITHM NAMES — for category-aware cycling
// ============================================================================
// Each prompt category maps to 15 contextual sub-process names drawn
// from the 6 algorithm families. During tier generation (Call 2), names
// from active categories are interspersed every ~3rd tick.
// This makes the cycling feel responsive to the user's specific prompt.
//
// Authority: ai-disguise.md §8 — "analogue" processing feel

/** Category-specific process names keyed by PromptCategory */
export const CATEGORY_ALGORITHM_NAMES: Readonly<
  Record<string, readonly string[]>
> = {
  subject: [
    'Dynamic Binary \u2014 Subject Anchor Gate',
    'Genetic Evolution \u2014 Subject Saliency Fitness',
    'TDA \u2014 Subject Boundary Homology',
    'MCMC \u2014 Subject Prominence Posterior',
    'NAS \u2014 Subject Focal Architecture',
    'Quantum Annealing \u2014 Subject-Scene Energy Balance',
    'Dynamic Binary \u2014 Multi-Subject Hierarchy Gate',
    'Genetic Evolution \u2014 Subject-Background Contrast Fitness',
    'TDA \u2014 Subject Contour Persistence',
    'MCMC \u2014 Subject Token Placement Sampling',
    'NAS \u2014 Subject Attention Mass Architecture',
    'Quantum Annealing \u2014 Subject Occlusion State',
    'Dynamic Binary \u2014 Subject Scale-to-Frame Threshold',
    'Genetic Evolution \u2014 Subject Pose Estimation Sweep',
    'TDA \u2014 Subject Semantic Centroid Mapping',
  ],
  action: [
    'Genetic Evolution \u2014 Motion Vector Fitness',
    'MCMC \u2014 Kinetic Energy Distribution Sampling',
    'Dynamic Binary \u2014 Static-Dynamic Tension Gate',
    'TDA \u2014 Gesture-to-Pose Topology',
    'NAS \u2014 Action Continuation Architecture',
    'Quantum Annealing \u2014 Velocity Gradient State',
    'Genetic Evolution \u2014 Force-Direction Mutation',
    'MCMC \u2014 Motion Blur Posterior Estimation',
    'Dynamic Binary \u2014 Transitive Verb Bias Gate',
    'TDA \u2014 Secondary Dynamics Persistence',
    'NAS \u2014 Temporal Motion Architecture',
    'Quantum Annealing \u2014 Frozen-Moment Tunnelling',
    'Genetic Evolution \u2014 Cloth-Hair Physics Fitness',
    'MCMC \u2014 Frame-of-Action Midpoint Sampling',
    'Dynamic Binary \u2014 Action Directionality Threshold',
  ],
  style: [
    'NAS \u2014 Artistic Style Embedding Search',
    'TDA \u2014 Style Fingerprint Topology',
    'MCMC \u2014 Style-Medium Compatibility Sampling',
    'Genetic Evolution \u2014 Aesthetic Fitness Landscape',
    'Dynamic Binary \u2014 Rendering Engine Selection Gate',
    'Quantum Annealing \u2014 Style-Epoch Energy State',
    'NAS \u2014 Brushstroke Texture Architecture',
    'TDA \u2014 Style Influence Lineage Mapping',
    'MCMC \u2014 Stylistic Coherence Posterior',
    'Genetic Evolution \u2014 Style Purity-Fusion Ratio',
    'Dynamic Binary \u2014 Digital-Traditional Transfer Gate',
    'Quantum Annealing \u2014 Style Token Dominance State',
    'NAS \u2014 Medium-to-Output Fidelity Search',
    'TDA \u2014 Style Primitive Decomposition',
    'MCMC \u2014 Style Vocabulary Cross-Reference Sampling',
  ],
  environment: [
    'TDA \u2014 Scene Depth Boundary Persistence',
    'MCMC \u2014 Environment Density Gradient Sampling',
    'Dynamic Binary \u2014 Indoor-Outdoor Ambiguity Gate',
    'Genetic Evolution \u2014 Biome-Atmosphere Fitness',
    'NAS \u2014 Ground-Plane Perspective Architecture',
    'Quantum Annealing \u2014 Horizon Line Energy State',
    'TDA \u2014 Depth Plane Decomposition',
    'MCMC \u2014 Location Specificity Posterior',
    'Dynamic Binary \u2014 Natural-Constructed Setting Gate',
    'Genetic Evolution \u2014 Scale-to-Subject Ratio Fitness',
    'NAS \u2014 Time-of-Day Light Architecture',
    'Quantum Annealing \u2014 Spatial Environment State',
    'TDA \u2014 Environment Subject Balance Mapping',
    'MCMC \u2014 Setting Specificity Confidence Sampling',
    'Dynamic Binary \u2014 World-Space Coordinate Threshold',
  ],
  composition: [
    'TDA \u2014 Rule-of-Thirds Topological Compliance',
    'Genetic Evolution \u2014 Compositional Balance Fitness',
    'MCMC \u2014 Focal Point Distribution Sampling',
    'Dynamic Binary \u2014 Negative Space Ratio Gate',
    'NAS \u2014 Visual Hierarchy Depth Search',
    'Quantum Annealing \u2014 Gaze-Path Entry State',
    'TDA \u2014 Edge-Tension Distribution Persistence',
    'Genetic Evolution \u2014 Frame-Weight Asymmetry Fitness',
    'MCMC \u2014 Dynamic Symmetry Posterior',
    'Dynamic Binary \u2014 Centre-of-Mass Offset Threshold',
    'NAS \u2014 Fibonacci Spiral Conformance Search',
    'Quantum Annealing \u2014 Foreground Layer Energy',
    'TDA \u2014 Visual Anchor Conflict Mapping',
    'MCMC \u2014 Implied Line Convergence Sampling',
    'Genetic Evolution \u2014 Rabatment Diagonal Fitness',
  ],
  camera: [
    'NAS \u2014 Lens Profile Parameter Search',
    'Quantum Annealing \u2014 Focal Length Distortion State',
    'MCMC \u2014 Depth-of-Field Curve Sampling',
    'Dynamic Binary \u2014 Aperture-Bokeh Relationship Gate',
    'Genetic Evolution \u2014 Camera Angle Fitness',
    'TDA \u2014 Chromatic Aberration Topology',
    'NAS \u2014 Perspective Foreshortening Architecture',
    'Quantum Annealing \u2014 Sensor-Crop Factor State',
    'MCMC \u2014 Barrel Distortion Envelope Sampling',
    'Dynamic Binary \u2014 Vignette Falloff Threshold',
    'Genetic Evolution \u2014 Circle-of-Confusion Fitness',
    'TDA \u2014 Tilt-Shift Plane Intersection Mapping',
    'NAS \u2014 Lens Flare Propagation Search',
    'Quantum Annealing \u2014 Dutch Angle Energy State',
    'MCMC \u2014 Hyperfocal Distance Posterior',
  ],
  lighting: [
    'Quantum Annealing \u2014 Light Source Directionality State',
    'MCMC \u2014 Golden Hour Signal Posterior',
    'Dynamic Binary \u2014 Shadow-Highlight Distribution Gate',
    'Genetic Evolution \u2014 Volumetric Light Fitness',
    'TDA \u2014 Multi-Source Light Rig Topology',
    'NAS \u2014 Bounce Light Propagation Architecture',
    'Quantum Annealing \u2014 Shadow Softness Gradient State',
    'MCMC \u2014 Specular-Diffuse Split Sampling',
    'Dynamic Binary \u2014 Inverse-Square Falloff Gate',
    'Genetic Evolution \u2014 Rembrandt Triangle Fitness',
    'TDA \u2014 Gobo Pattern Projection Mapping',
    'NAS \u2014 Fill-to-Key Ratio Architecture',
    'Quantum Annealing \u2014 Rim-Light Separation State',
    'MCMC \u2014 Global Illumination Bounce Sampling',
    'Dynamic Binary \u2014 Ambient-Key Light Ratio Gate',
  ],
  colour: [
    'TDA \u2014 Chromatic Palette Coherence Topology',
    'MCMC \u2014 Colour Temperature Balance Sampling',
    'Genetic Evolution \u2014 Warm-Cool Tone Fitness',
    'Dynamic Binary \u2014 Saturation Emphasis Gate',
    'NAS \u2014 Complementary Pair Detection Search',
    'Quantum Annealing \u2014 Simultaneous Contrast State',
    'TDA \u2014 Hue-Shift Zone Persistence',
    'MCMC \u2014 Colour Harmony Wheel Posterior',
    'Genetic Evolution \u2014 Perceptual Distance Fitness',
    'Dynamic Binary \u2014 Gamut Boundary Compliance Gate',
    'NAS \u2014 Split-Complementary Triad Architecture',
    'Quantum Annealing \u2014 Colour Weight Energy State',
    'TDA \u2014 Chroma Gradient Depth Mapping',
    'MCMC \u2014 Cinema Correction Posterior',
    'Genetic Evolution \u2014 Palette Emotional Valence Fitness',
  ],
  atmosphere: [
    'MCMC \u2014 Atmospheric Density Posterior',
    'TDA \u2014 Mood-to-Visual Translation Topology',
    'Dynamic Binary \u2014 Atmospheric Perspective Gate',
    'Genetic Evolution \u2014 Haze-Fog Scatter Fitness',
    'Quantum Annealing \u2014 Emotional Resonance State',
    'NAS \u2014 Aerial Perspective Falloff Architecture',
    'MCMC \u2014 Weather Particle Density Sampling',
    'TDA \u2014 Mist Dispersion Gradient Persistence',
    'Dynamic Binary \u2014 Ambient Occlusion Mood Gate',
    'Genetic Evolution \u2014 Tonal Melancholy Fitness',
    'Quantum Annealing \u2014 Dust-Mote Volumetric State',
    'NAS \u2014 Humidity-Haze Correlation Search',
    'MCMC \u2014 Tension-Serenity Polarity Sampling',
    'TDA \u2014 God-Ray Penetration Mapping',
    'Dynamic Binary \u2014 Emotional Temperature Threshold',
  ],
  materials: [
    'TDA \u2014 Surface Texture Topology',
    'Genetic Evolution \u2014 Material Reflectance Fitness',
    'MCMC \u2014 Tactile Detail Specificity Sampling',
    'Dynamic Binary \u2014 Roughness-Smoothness Balance Gate',
    'Quantum Annealing \u2014 BRDF Surface Model State',
    'NAS \u2014 Micro-Surface Normal Architecture',
    'TDA \u2014 Metallic-Dielectric Boundary Persistence',
    'Genetic Evolution \u2014 Translucency Scatter Fitness',
    'MCMC \u2014 Anisotropic Reflection Posterior',
    'Dynamic Binary \u2014 Fresnel Angle Reflectance Gate',
    'Quantum Annealing \u2014 Fabric Drape Energy State',
    'NAS \u2014 Wet-Dry Surface Transition Search',
    'TDA \u2014 Wood-Grain Directionality Mapping',
    'MCMC \u2014 Glass-Crystal Refraction Sampling',
    'Genetic Evolution \u2014 Physical Property Signal Fitness',
  ],
  fidelity: [
    'NAS \u2014 Resolution Anchor Architecture',
    'MCMC \u2014 Detail Preservation Ratio Posterior',
    'Dynamic Binary \u2014 Sharpness Signal Chain Gate',
    'Genetic Evolution \u2014 Anti-Artifact Safeguard Fitness',
    'Quantum Annealing \u2014 Render Quality Ceiling State',
    'TDA \u2014 Nyquist Boundary Persistence',
    'NAS \u2014 Aliasing Suppression Curve Search',
    'MCMC \u2014 Sub-Pixel Edge Coherence Sampling',
    'Dynamic Binary \u2014 Perceptual Detail Threshold Gate',
    'Genetic Evolution \u2014 Micro-Detail Retention Fitness',
    'Quantum Annealing \u2014 Texture-Frequency Bandwidth State',
    'TDA \u2014 Moir\u00e9 Pattern Suppression Mapping',
    'NAS \u2014 Denoising Strength Architecture',
    'MCMC \u2014 Upscale Artifact Resistance Posterior',
    'Dynamic Binary \u2014 Detail-Noise Separation Gate',
  ],
  negative: [
    'Dynamic Binary \u2014 Exclusion Boundary Gate',
    'MCMC \u2014 Negative Prompt Syntax Posterior',
    'Genetic Evolution \u2014 Exclusion-Positive Balance Fitness',
    'TDA \u2014 Artifact Suppression Topology',
    'Quantum Annealing \u2014 Quality Gate Coverage State',
    'NAS \u2014 Negative-Positive Interference Search',
    'Dynamic Binary \u2014 Exclusion Specificity Threshold',
    'MCMC \u2014 Unconditional Guidance Offset Sampling',
    'Genetic Evolution \u2014 Negative Attention Mask Fitness',
    'TDA \u2014 Classifier-Free Guidance Split Mapping',
    'Quantum Annealing \u2014 Negative Bleed Tunnelling State',
    'NAS \u2014 Exclusion Term Isolation Architecture',
    'MCMC \u2014 Anti-Concept Embedding Posterior',
    'Dynamic Binary \u2014 Negative Weight Saturation Gate',
    'Genetic Evolution \u2014 Cross-Attention Leakage Fitness',
  ],
} as const;

// ============================================================================
// CATEGORY-AWARE SHUFFLE
// ============================================================================

/**
 * Build a category-aware shuffled sequence.
 * Every 3rd name comes from one of the active categories' specific pool.
 * The rest are from the core family pool (3–4 randomly selected families).
 * Result: the cycling feels responsive to what the user actually wrote,
 * with different algorithm families featured each run.
 */
export function shuffleCategoryAware(activeCategories: string[]): string[] {
  const generic = shuffleAlgorithms();
  if (activeCategories.length === 0) return generic;

  // Collect all category-specific names for active categories, shuffle them
  const categoryPool: string[] = [];
  for (const cat of activeCategories) {
    const names = CATEGORY_ALGORITHM_NAMES[cat];
    if (names) categoryPool.push(...names);
  }
  // Fisher-Yates shuffle category pool
  for (let i = categoryPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [categoryPool[i], categoryPool[j]] = [categoryPool[j]!, categoryPool[i]!];
  }

  // Interleave: every 3rd slot is a category-specific name
  const result: string[] = [];
  let gIdx = 0;
  let cIdx = 0;
  const totalLength = generic.length + categoryPool.length;

  for (let i = 0; i < totalLength; i++) {
    if ((i + 1) % 3 === 0 && cIdx < categoryPool.length) {
      result.push(categoryPool[cIdx]!);
      cIdx++;
    } else if (gIdx < generic.length) {
      result.push(generic[gIdx]!);
      gIdx++;
    } else if (cIdx < categoryPool.length) {
      result.push(categoryPool[cIdx]!);
      cIdx++;
    }
  }

  return result;
}
