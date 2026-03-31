// src/data/algorithm-names.ts
// ============================================================================
// ALGORITHM DISPLAY NAMES — Optimisation Cycling Animation
// ============================================================================
// 165 algorithm names + 3 finale names for the Prompt Lab cycling
// animations. Displayed during Call 2 (tier generation) and Call 3
// (AI prompt optimisation) to create the impression of deep
// algorithmic processing — like watching the gears of a Swiss
// chronograph, not the flat screen of a smartwatch.
//
// Human factors:
//   §3 Anticipatory Dopamine — rapidly cycling names create the
//       expectation-acceleration-reward pattern before the result
//       is revealed.
//   §6 Temporal Compression — reading speed keeps attention occupied,
//       making 2–4s API latency feel shorter than clock time.
//   §1 Curiosity Gap — technical names the user half-understands
//       create narrow curiosity gaps ("what does cross-attention
//       redistribution actually do?") that keep them engaged.
//
// Authority: ai-disguise.md §9 (The Algorithm Names)
// Existing features preserved: Yes.
// ============================================================================

// ============================================================================
// MASTER LIST — 165 cycling names
// ============================================================================
// Grouped by category in source for maintainability.
// Shuffled at runtime so the user never sees them in category order.

/** Master list of algorithm display names for the cycling animation */
export const ALGORITHM_NAMES: readonly string[] = [
  // ── Token & Weight Analysis (25) ─────────────────────────────────
  "Analysing semantic token density",
  "Calibrating CLIP attention weights",
  "Mapping cross-attention distribution",
  "Evaluating token position decay",
  "Computing attention head alignment",
  "Detecting token overflow boundaries",
  "Scoring positional emphasis curves",
  "Rebalancing weight distribution",
  "Normalising CLIP embedding vectors",
  "Profiling token-to-pixel influence",
  "Estimating diffusion step impact",
  "Quantifying prompt-to-latent mapping",
  "Resolving weight saturation zones",
  "Measuring encoder throughput",
  "Scanning for orphaned token fragments",
  "Verifying weight syntax compliance",
  "Calculating diminishing returns threshold",
  "Indexing attention priority layers",
  "Tracing token influence propagation",
  "Benchmarking encoding efficiency",
  "Unwinding nested attention residuals",
  "Profiling per-head activation variance",
  "Correlating token proximity to latent drift",
  "Measuring cross-layer gradient bleed",
  "Flagging sub-threshold weight artifacts",

  // ── Quality & Fidelity Optimisation (23) ─────────────────────────
  "Amplifying core quality anchors",
  "Strengthening fidelity descriptors",
  "Optimising quality prefix placement",
  "Evaluating resolution signal density",
  "Boosting masterpiece token weight",
  "Assessing aesthetic coherence score",
  "Calibrating sharpness parameters",
  "Validating detail preservation ratio",
  "Enhancing photorealistic signal chain",
  "Scoring output quality prediction",
  "Measuring visual fidelity potential",
  "Adjusting clarity emphasis levels",
  "Profiling HDR dynamic range tokens",
  "Verifying anti-artifact safeguards",
  "Tuning noise reduction signals",
  "Balancing detail vs abstraction",
  "Computing perceived quality index",
  "Optimising render-ready markers",
  "Sampling perceptual sharpness envelope",
  "Injecting high-frequency detail priors",
  "Stress-testing artifact suppression gates",
  "Deriving texture-fidelity transfer curve",
  "Validating sub-pixel coherence floor",

  // ── Composition & Spatial Intelligence (21) ──────────────────────
  "Analysing compositional flow patterns",
  "Reweighting foreground-background ratio",
  "Evaluating depth-of-field signals",
  "Optimising rule-of-thirds alignment",
  "Detecting perspective coherence",
  "Scoring spatial relationship clarity",
  "Balancing subject-environment weight",
  "Assessing framing intelligence",
  "Computing visual hierarchy score",
  "Mapping leading line emphasis",
  "Calibrating negative space allocation",
  "Evaluating vanishing point signals",
  "Profiling aspect ratio optimality",
  "Resolving compositional conflicts",
  "Normalising focal point distribution",
  "Aligning camera-lens coherence",
  "Tracing gaze-path prediction model",
  "Measuring golden spiral conformance",
  "Simulating eye-flow heat distribution",
  "Recalculating z-depth priority stack",
  "Scoring foreground occlusion balance",

  // ── Colour & Lighting Intelligence (21) ──────────────────────────
  "Harmonising colour-light coherence",
  "Evaluating chromatic balance",
  "Calibrating lighting direction signals",
  "Scoring ambient illumination weight",
  "Detecting colour palette conflicts",
  "Optimising warm-cool tone ratio",
  "Rebalancing shadow-highlight tokens",
  "Profiling golden hour signal strength",
  "Assessing volumetric light density",
  "Mapping rim lighting emphasis",
  "Computing colour harmony index",
  "Normalising tonal range distribution",
  "Verifying atmospheric light scatter",
  "Adjusting chiaroscuro balance",
  "Measuring colour saturation curves",
  "Optimising luminance contrast ratio",
  "Decomposing specular-diffuse reflectance",
  "Tracing caustic light path geometry",
  "Sampling colour gamut boundary limits",
  "Correlating kelvin temperature to mood",
  "Profiling subsurface scatter influence",

  // ── Platform-Specific Tuning (21) ────────────────────────────────
  "Loading platform syntax profile",
  "Applying provider-specific formatting",
  "Calibrating sweet spot length target",
  "Optimising for platform token encoder",
  "Adjusting prompt architecture for model",
  "Mapping category priority to platform",
  "Evaluating platform response patterns",
  "Scoring platform-optimised term order",
  "Configuring negative prompt syntax",
  "Validating parameter flag positions",
  "Tuning weight syntax for target model",
  "Aligning with platform quality gates",
  "Profiling model attention architecture",
  "Computing platform-specific trim map",
  "Adjusting for model context window",
  "Optimising inference step alignment",
  "Resolving cross-platform syntax deltas",
  "Benchmarking encoder tokenisation drift",
  "Mapping latent space geometry per model",
  "Calibrating denoising schedule affinity",
  "Verifying CFG scale response linearity",

  // ── Semantic & Structural Analysis (20) ──────────────────────────
  "Removing semantic redundancy",
  "Detecting duplicate concept clusters",
  "Pruning low-signal modifier chains",
  "Resolving synonym saturation",
  "Compressing verbose descriptors",
  "Eliminating orphaned verb fragments",
  "Stripping grammar debris tokens",
  "Consolidating overlapping attributes",
  "Rewriting compound descriptions",
  "Defragmenting prompt structure",
  "Bridging disconnected scene elements",
  "Tightening descriptor specificity",
  "Collapsing adjacent near-synonyms",
  "Streamlining modifier hierarchy",
  "Merging compatible style references",
  "Untangling co-referent descriptor chains",
  "Resolving implicit-explicit term overlap",
  "Flattening nested modifier dependency",
  "Detecting semantic dead-weight tokens",
  "Rebuilding term adjacency graph",

  // ── Preflight Decision Engine (18) ──────────────────────────────
  "Running preflight structural audit",
  "Classifying optimisation pathway",
  "Evaluating deterministic transform eligibility",
  "Computing anchor density threshold",
  "Scanning subject position compliance",
  "Assessing platform routing priority",
  "Resolving call mode from config matrix",
  "Verifying syntax transform confidence",
  "Profiling input structural integrity",
  "Testing reorder confidence boundary",
  "Mapping clause weight topology",
  "Validating parameter block completeness",
  "Checking weighted clause hierarchy",
  "Scoring deterministic vs generative path",
  "Analysing prompt-to-platform fit",
  "Computing format conversion eligibility",
  "Evaluating pass-through conditions",
  "Resolving tier-specific routing logic",

  // ── Anchor Preservation & Regression Guard (16) ─────────────────
  "Extracting visual anchor manifest",
  "Cataloguing named colour tokens",
  "Mapping light source references",
  "Indexing environment anchor nouns",
  "Building action verb fingerprint",
  "Comparing input-output anchor diff",
  "Scanning for invented content injection",
  "Validating verb substitution integrity",
  "Checking sentence structure preservation",
  "Detecting style label hallucination",
  "Verifying framing cue legitimacy",
  "Running no-worse-than-input gate",
  "Computing anchor retention score",
  "Enforcing tier-specific regression threshold",
  "Validating structural improvement delta",
  "Confirming output passes regression guard",
] as const;

// ============================================================================
// FINALE SUBSET — always the last 3 items before landing
// ============================================================================

/** Always shown as the final 3 items before the landing message */
export const FINALE_NAMES: readonly string[] = [
  "Finalising prompt structure",
  "Running regression guard validation",
  "Confirming output integrity",
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
 * Range: 131–165 (always high, always different, always credible).
 *
 * Authority: ai-disguise.md §10
 */
export function getAlgorithmCount(): number {
  const BASE = 131;
  const VARIATION = 35; // 0–34
  return BASE + Math.floor(Math.random() * VARIATION);
}

// ============================================================================
// CATEGORY-SPECIFIC ALGORITHM NAMES — for category-aware cycling
// ============================================================================
// Each prompt category maps to 15 contextual algorithm names.
// During tier generation (Call 2), names from active categories are
// interspersed with the generic 165 names every ~3rd tick.
// This makes the cycling feel responsive to the user's specific prompt
// — the gears turning in response to what they actually wrote.
//
// Authority: ai-disguise.md §8 — "analogue" processing feel

/** Category-specific algorithm names keyed by PromptCategory */
export const CATEGORY_ALGORITHM_NAMES: Readonly<
  Record<string, readonly string[]>
> = {
  subject: [
    "Isolating primary subject anchor",
    "Weighting subject-to-scene dominance",
    "Scoring subject saliency map",
    "Locking subject focal priority",
    "Validating subject token placement",
    "Tracing subject boundary contour",
    "Measuring subject-to-background contrast",
    "Computing subject attention mass",
    "Resolving multi-subject hierarchy",
    "Profiling subject semantic centroid",
    "Extracting subject pose estimation",
    "Mapping subject occlusion depth layer",
    "Scoring subject-to-negative separation",
    "Calibrating subject scale-to-frame ratio",
    "Verifying subject token lead position",
  ],
  action: [
    "Analysing motion vector coherence",
    "Encoding action-verb directionality",
    "Mapping kinetic energy distribution",
    "Scoring temporal motion signals",
    "Calibrating implied movement weight",
    "Decomposing gesture-to-pose skeleton",
    "Tracing implied velocity gradient",
    "Resolving static-dynamic tension ratio",
    "Sampling frame-of-action midpoint",
    "Measuring anticipatory motion blur",
    "Computing force-direction implication",
    "Profiling action continuation vector",
    "Resolving transitive-intransitive verb bias",
    "Mapping cloth-hair secondary dynamics",
    "Scoring frozen-moment temporal anchor",
  ],
  style: [
    "Loading artistic style embeddings",
    "Cross-referencing style vocabulary",
    "Scoring style-medium compatibility",
    "Mapping aesthetic fingerprint",
    "Calibrating rendering engine hints",
    "Resolving style-epoch classification",
    "Profiling brushstroke texture signature",
    "Matching style to training distribution",
    "Computing stylistic coherence quotient",
    "Validating medium-to-output fidelity",
    "Decomposing style into base primitives",
    "Tracing influence lineage across movements",
    "Scoring style purity vs fusion ratio",
    "Profiling digital-to-traditional transfer",
    "Mapping style token attention dominance",
  ],
  environment: [
    "Reconstructing spatial environment",
    "Mapping scene depth boundaries",
    "Scoring environment-subject balance",
    "Evaluating setting specificity index",
    "Calibrating world-space coordinates",
    "Profiling biome-atmosphere correlation",
    "Sampling ground-plane perspective grid",
    "Resolving indoor-outdoor ambiguity",
    "Tracing horizon line placement",
    "Computing environment density gradient",
    "Decomposing scene into depth planes",
    "Profiling time-of-day light implication",
    "Scoring location specificity confidence",
    "Resolving natural-vs-constructed setting",
    "Mapping environment scale-to-subject ratio",
  ],
  composition: [
    "Evaluating rule-of-thirds compliance",
    "Scoring compositional balance map",
    "Mapping focal point distribution",
    "Calibrating negative space ratio",
    "Optimising visual hierarchy depth",
    "Simulating viewer gaze-path entry",
    "Resolving edge-tension distribution",
    "Profiling frame-weight asymmetry",
    "Computing dynamic symmetry score",
    "Measuring visual centre-of-mass offset",
    "Tracing Fibonacci spiral conformance",
    "Scoring foreground-mid-background layering",
    "Resolving visual anchor point conflict",
    "Mapping implied line convergence",
    "Profiling rabatment diagonal alignment",
  ],
  camera: [
    "Loading lens profile parameters",
    "Simulating focal length distortion",
    "Calibrating depth-of-field curve",
    "Mapping aperture-bokeh relationship",
    "Scoring camera angle effectiveness",
    "Profiling chromatic aberration model",
    "Computing perspective foreshortening",
    "Resolving sensor-crop factor ratio",
    "Simulating barrel distortion envelope",
    "Tracing optical vignette falloff curve",
    "Estimating circle-of-confusion diameter",
    "Mapping tilt-shift plane intersection",
    "Profiling lens flare propagation model",
    "Scoring Dutch angle disorientation weight",
    "Computing hyperfocal distance boundary",
  ],
  lighting: [
    "Profiling light source directionality",
    "Evaluating golden hour signal weight",
    "Mapping shadow-highlight distribution",
    "Calibrating volumetric light density",
    "Scoring ambient-to-key light ratio",
    "Decomposing multi-source light rig",
    "Tracing bounce light ray propagation",
    "Measuring shadow softness gradient",
    "Resolving specular-to-diffuse split",
    "Profiling inverse-square falloff curve",
    "Computing Rembrandt triangle geometry",
    "Simulating gobo pattern projection",
    "Mapping fill-to-key ratio balance",
    "Scoring rim-light separation intensity",
    "Tracing global illumination bounce depth",
  ],
  colour: [
    "Analysing chromatic palette coherence",
    "Scoring colour temperature balance",
    "Mapping warm-cool tone distribution",
    "Calibrating saturation emphasis curve",
    "Detecting complementary colour pairs",
    "Resolving simultaneous contrast bias",
    "Profiling hue-shift across light zones",
    "Computing colour harmony wheel angle",
    "Sampling perceptual colour distance",
    "Validating gamut boundary compliance",
    "Decomposing split-complementary triad",
    "Measuring colour weight distribution",
    "Tracing chroma gradient across depth",
    "Profiling teal-orange cinema correction",
    "Scoring palette emotional valence map",
  ],
  atmosphere: [
    "Encoding atmospheric density signals",
    "Scoring mood-to-visual translation",
    "Mapping atmospheric perspective depth",
    "Calibrating haze-fog scatter tokens",
    "Evaluating emotional resonance weight",
    "Profiling aerial perspective falloff",
    "Resolving weather-to-particle density",
    "Tracing mist dispersion gradient",
    "Computing ambient occlusion mood map",
    "Measuring tonal melancholy index",
    "Simulating dust-mote volumetric scatter",
    "Profiling humidity-to-haze correlation",
    "Scoring tension-serenity polarity axis",
    "Mapping god-ray penetration angle",
    "Resolving emotional temperature gradient",
  ],
  materials: [
    "Profiling surface texture vocabulary",
    "Mapping material reflectance tokens",
    "Scoring tactile detail specificity",
    "Calibrating roughness-smoothness balance",
    "Encoding physical property signals",
    "Decomposing BRDF surface model",
    "Sampling micro-surface normal variance",
    "Resolving metallic-dielectric boundary",
    "Profiling translucency scatter depth",
    "Computing anisotropic reflection map",
    "Tracing Fresnel reflectance angle curve",
    "Measuring fabric drape simulation weight",
    "Scoring wet-dry surface state transition",
    "Profiling wood-grain directionality map",
    "Resolving glass-to-crystal refraction index",
  ],
  fidelity: [
    "Amplifying resolution anchor tokens",
    "Scoring detail preservation ratio",
    "Calibrating sharpness signal chain",
    "Boosting anti-artifact safeguards",
    "Optimising render quality ceiling",
    "Sampling Nyquist frequency boundary",
    "Profiling aliasing suppression curve",
    "Validating sub-pixel edge coherence",
    "Computing perceptual detail threshold",
    "Stress-testing micro-detail retention",
    "Measuring texture-frequency bandwidth",
    "Tracing moire pattern suppression gate",
    "Scoring denoising strength preservation",
    "Profiling upscale artifact resistance",
    "Resolving detail-noise separation floor",
  ],
  negative: [
    "Mapping exclusion boundary tokens",
    "Validating negative prompt syntax",
    "Scoring exclusion-to-positive balance",
    "Calibrating artifact suppression",
    "Verifying quality gate coverage",
    "Resolving negative-positive interference",
    "Profiling exclusion specificity index",
    "Computing unconditional guidance offset",
    "Sampling negative attention mask",
    "Validating classifier-free guidance split",
    "Tracing negative bleed into latent space",
    "Measuring exclusion term isolation depth",
    "Scoring anti-concept embedding distance",
    "Profiling negative weight saturation cap",
    "Resolving cross-attention negative leakage",
  ],
} as const;

/**
 * Build a category-aware shuffled sequence.
 * Every 3rd name comes from one of the active categories' specific pool.
 * The rest are from the generic 131 names.
 * Result: the cycling feels responsive to what the user actually wrote.
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
  // Shuffle category pool
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
