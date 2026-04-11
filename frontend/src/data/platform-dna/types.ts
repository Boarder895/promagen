// src/data/platform-dna/types.ts
// ============================================================================
// PLATFORM DNA PROFILE — Type definitions
// ============================================================================
// Authority: call-3-quality-architecture-v0.2.0.md §4.1
// Used by: call-3-transforms, call-3-harness, aps-gate, preflight
//
// v1.1.0: Expanded PromptCategory for negative/fidelity/scene_premise coverage.
//         Added HallucinationEntry for richer per-entry structure.
//         Added optional encoderNotes for dual-family edge cases.
//         Added ProfilesMeta type for _meta validation in the loader.
// ============================================================================

/**
 * Primary classification axis: encoder processing architecture.
 *
 * - clip:          CLIP ViT-L/14 — 77-token hard limit, front-loaded attention
 * - t5:            T5-XXL — 512-token window, near-uniform self-attention
 * - llm_rewrite:   LLM that rewrites prompts before diffusion (DALL-E 3)
 * - llm_semantic:  LLM with semantic understanding (ChatGLM3, Midjourney)
 * - proprietary:   Unknown/undocumented encoder — empirically profiled
 */
export type EncoderFamily =
  | 'clip'
  | 't5'
  | 'llm_rewrite'
  | 'llm_semantic'
  | 'proprietary';

/**
 * Secondary classification: how the prompt should be written.
 *
 * - weighted_keywords: CLIP-style comma-separated terms with weight syntax
 * - structured_nl:     Natural language with specific structural expectations
 * - freeform_nl:       Natural language, no structural constraints
 * - mixed:             Combination (e.g. Midjourney prose + :: weights + --params)
 */
export type PromptStylePreference =
  | 'weighted_keywords'
  | 'structured_nl'
  | 'freeform_nl'
  | 'mixed';

/**
 * Weight/parameter syntax flavour.
 *
 * - parenthetical: (term:1.3) — Stability, DreamLike, Fotor
 * - double_colon:  term::1.3 — Leonardo, Midjourney
 * - curly_brace:   {{{term}}} — NovelAI
 * - none:          No weight syntax supported
 */
export type SyntaxMode = 'parenthetical' | 'double_colon' | 'curly_brace' | 'none';

/**
 * How the platform handles negative prompts.
 *
 * - separate_field:    Dedicated negative prompt input
 * - inline:            Negatives appended inline (--no syntax)
 * - converted:         Platform internally converts negatives (rare)
 * - none:              No negative prompt support
 * - counterproductive: Using negatives actively degrades output
 */
export type NegativeMode =
  | 'separate_field'
  | 'inline'
  | 'converted'
  | 'none'
  | 'counterproductive';

/**
 * Named, testable transforms that Call 3 can perform.
 * Every transform is in the catalogue (architecture §4.2).
 * Transforms not on a platform's allowedTransforms list are banned.
 */
export type TransformId =
  | 'T_SUBJECT_FRONT'
  | 'T_ATTENTION_SEQUENCE'
  | 'T_WEIGHT_REBALANCE'
  | 'T_TOKEN_MERGE'
  | 'T_SEMANTIC_COMPRESS'
  | 'T_REDUNDANCY_STRIP'
  | 'T_QUALITY_POSITION'
  | 'T_PARAM_VALIDATE'
  | 'T_WEIGHT_VALIDATE'
  | 'T_CLAUSE_FRONT'
  | 'T_SCENE_PREMISE'
  | 'T_PROSE_RESTRUCTURE'
  | 'T_NARRATIVE_ARMOUR'
  | 'T_NEGATIVE_GENERATE'
  | 'T_CHAR_ENFORCE'
  | 'T_SYNTAX_CLEANUP';

/**
 * Prompt categories for token budget allocation and transform targeting.
 *
 * Core visual categories (CLIP budget, AVIS scoring):
 *   quality_prefix, subject, action, environment, lighting, colour,
 *   atmosphere, materials, composition, camera, style, quality_suffix
 *
 * Extended categories (negative intelligence, budget-aware conversion):
 *   negative      — separate/inline negative prompt content
 *   fidelity      — quality boosters (8K, masterpiece) subject to conversion
 *   scene_premise — T5 first-sentence scene anchor (T_SCENE_PREMISE target)
 */
export type PromptCategory =
  | 'quality_prefix'
  | 'subject'
  | 'action'
  | 'environment'
  | 'lighting'
  | 'colour'
  | 'atmosphere'
  | 'materials'
  | 'composition'
  | 'camera'
  | 'style'
  | 'quality_suffix'
  | 'negative'
  | 'fidelity'
  | 'scene_premise';

/**
 * Token budget allocation for a single prompt category.
 * Used by CLIP platforms to enforce the 77-token ceiling.
 */
export interface TokenBudgetEntry {
  /** Minimum tokens to allocate (hard floor, >= 0) */
  readonly min: number;
  /** Maximum tokens to allocate (soft ceiling, >= min) */
  readonly max: number;
  /** Priority weight for AVIS scoring (0.0–1.0, 1.0 = highest) */
  readonly priority: number;
}

/**
 * Scene type categories for hallucination map and scene diversity.
 * Architecture §9.3: minimum 3 categories per harmony pass.
 */
export type SceneType =
  | 'outdoor_dramatic'
  | 'indoor_character'
  | 'abstract_stylised'
  | 'portrait'
  | 'architectural'
  | 'nature'
  | 'urban';

/**
 * A single hallucination pattern entry for the platform hallucination map.
 *
 * Richer than bare strings: captures the failure pattern, how confident
 * we are in the observation, and how severe the impact is. Built
 * incrementally from BQI results (Phase 9).
 *
 * Architecture deferred item: "Hallucination map starts hybrid with
 * confidence: 'assumed' | 'measured'"
 */
export interface HallucinationEntry {
  /** Human-readable description of the hallucination pattern */
  readonly pattern: string;
  /** How the pattern was identified */
  readonly confidence: 'assumed' | 'measured';
  /** Impact on image quality when this pattern fires */
  readonly severity: 'low' | 'medium' | 'high';
}

/**
 * Processing characteristics derived from encoder research.
 * Values are working hypotheses (§3.2) and empirical assumptions (§3.3).
 */
export interface ProcessingProfile {
  /**
   * Engineering estimate of front-load importance.
   * 0.0 = perfectly uniform attention across all positions.
   * 1.0 = extreme front-bias (only first few tokens matter).
   *
   * CLIP: ~0.8 (strong front-loading, §3.2 hypothesis)
   * T5:   ~0.4 (mild front-loading via cross-attention, §3.2)
   * MJ:   ~0.9 (words 1-5 very influential, 40+ ignored, §3.1)
   * LLM:  ~0.2 (near-uniform semantic processing)
   */
  readonly frontLoadImportance: number;

  /**
   * Whether the platform rewrites prompts before diffusion.
   * true for DALL-E 3 (GPT-4 rewrite confirmed in §3.1).
   */
  readonly rewritesPrompt: boolean;

  /**
   * Whether quality tags ("masterpiece", "best quality") have measurable impact.
   * true for CLIP (training data association, §3.3).
   * false for T5 (processed as natural language, no special treatment, §3.3).
   * true for Kling (ChatGLM3 understands them semantically — unique exception).
   */
  readonly qualityTagsEffective: boolean;
}

/** Harmony pass verification status. */
export type HarmonyStatus = 'verified' | 'in_progress' | 'untested';

/**
 * The Platform DNA Profile.
 *
 * Every platform gets a research-backed profile that governs all Call 3
 * decisions. This is the master reference — transforms not on the
 * allowedTransforms list are banned for that platform.
 *
 * Architecture: call-3-quality-architecture-v0.2.0.md §4
 */
export interface PlatformDNA {
  /** Platform identifier — matches platform-config.json key */
  readonly id: string;

  /** Primary classification: encoder processing architecture */
  readonly encoderFamily: EncoderFamily;

  /** Secondary classification: how the prompt should be written */
  readonly promptStylePreference: PromptStylePreference;

  /** Syntax mode for weight/parameter handling */
  readonly syntaxMode: SyntaxMode;

  /** How the platform handles negatives */
  readonly negativeMode: NegativeMode;

  /**
   * Hard encoder token limit.
   * 77 for CLIP, 512 for T5, 256 for ChatGLM3, null for unconstrained.
   * This is the ENCODER limit, not the platform's character ceiling.
   */
  readonly tokenLimit: number | null;

  /** Character ceiling enforced by Call 3 (from platform-config.json maxChars) */
  readonly charCeiling: number;

  /** Processing characteristics — hypotheses and empirical assumptions */
  readonly processingProfile: ProcessingProfile;

  /** The exact transforms Call 3 is allowed to perform. Everything else is banned. */
  readonly allowedTransforms: readonly TransformId[];

  /** Whether GPT is needed for any transform, or all are deterministic */
  readonly requiresGPT: boolean;

  /** GPT temperature if GPT is used (null = deterministic only) */
  readonly gptTemperature: number | null;

  /** Whether the iterative retry protocol (§8) is enabled */
  readonly retryEnabled: boolean;

  /** Token budget allocation by category (CLIP platforms only, null otherwise) */
  readonly tokenBudget: Partial<Record<PromptCategory, TokenBudgetEntry>> | null;

  /** Known failure modes for quality gates to watch — must be non-empty */
  readonly knownFailureModes: readonly string[];

  /**
   * Platform-specific hallucination patterns by scene type (§7.3).
   * null until populated from BQI data in Phase 9.
   */
  readonly hallucinationMap: Partial<Record<SceneType, readonly HallucinationEntry[]>> | null;

  /** Measured baseline: assembled prompt score (null = untested) */
  readonly assembledBaseline: number | null;

  /** Measured optimised score (null = untested) */
  readonly optimisedScore: number | null;

  /** Computed available headroom = ceiling - assembledBaseline (null = untested) */
  readonly availableHeadroom: number | null;

  /** Harmony pass status */
  readonly harmonyStatus: HarmonyStatus;

  /**
   * Optional notes for platforms with classification edge cases.
   *
   * Used when a platform spans multiple encoder families (NovelAI V3/V4),
   * has an uncertain classification (ClipDrop post-acquisition), or has a
   * known backend that doesn't fully match its family assignment
   * (Bing using DALL-E 3 without confirmed GPT-4 rewriting).
   *
   * Implementation enrichment — not in the frozen architecture schema.
   */
  readonly encoderNotes?: string;
}

/**
 * The complete DNA profiles collection.
 * Keys are platform IDs matching platform-config.json.
 */
export type PlatformDNACollection = Record<string, PlatformDNA>;

/**
 * The _meta block in profiles.json.
 * Validated at load time to catch drift between metadata and actual data.
 */
export interface ProfilesMeta {
  readonly version: string;
  readonly date: string;
  readonly authority: string;
  readonly platformCount: number;
  readonly encoderFamilyCounts: Record<string, number>;
  readonly notes: readonly string[];
}
