// src/lib/prompt-intelligence/types.ts
// ============================================================================
// PROMPT INTELLIGENCE - Type Definitions
// ============================================================================
// Version: 1.2.0 — Phase 7.9c compression lookup type
// Authority: docs/authority/prompt-intelligence.md
// ============================================================================

import type { PromptCategory, PromptBuilderState } from '@/types/prompt-builder';
import type { CoOccurrenceLookup } from '@/lib/learning/co-occurrence-lookup';
import type { AntiPatternLookup } from '@/lib/learning/anti-pattern-lookup';
import type { CollisionLookup } from '@/lib/learning/collision-lookup';
import type { WeakTermLookup } from '@/lib/learning/weak-term-lookup';
import type { RedundancyLookup } from '@/lib/learning/redundancy-lookup';
import type { ComboLookup } from '@/lib/learning/combo-lookup';
import type { PlatformTermQualityLookup } from '@/lib/learning/platform-term-quality-lookup';
import type { PlatformCoOccurrenceLookup } from '@/lib/learning/platform-co-occurrence-lookup';
import type { TemporalLookup, TrendingLookup } from '@/lib/learning/temporal-lookup';
import type { CompressionLookup } from '@/lib/learning/compression-lookup';

// ============================================================================
// § 1. Semantic Tags
// ============================================================================

/**
 * Mood classification for prompt options.
 * Used for coherence scoring and conflict detection.
 */
export type SemanticMood =
  | 'calm'
  | 'intense'
  | 'neutral'
  | 'eerie'
  | 'joyful'
  | 'melancholic'
  | 'dramatic';

/**
 * Era/time period classification.
 * Used for detecting era conflicts (e.g., vintage + futuristic).
 */
export type SemanticEra = 'past' | 'present' | 'future' | 'timeless';

/**
 * Time of day classification for lighting/atmosphere options.
 */
export type TimeOfDay = 'dawn' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'night' | 'any';

/**
 * Semantic tag structure for a single prompt option.
 * Every option in prompt-options.json can have these tags.
 */
export interface SemanticTag {
  /** Which category this option belongs to */
  category: PromptCategory;

  /** Style families this option belongs to (1-5 families) */
  families: string[];

  /** Emotional/tonal mood */
  mood?: SemanticMood;

  /** Historical era/time period */
  era?: SemanticEra;

  /** Time of day (for lighting/atmosphere) */
  timeOfDay?: TimeOfDay;

  /** Options that conflict/clash with this one */
  conflicts?: string[];

  /** Options that work well with this one */
  complements?: string[];

  /** Cross-category suggestions when this option is selected */
  suggests?: Partial<Record<PromptCategory, string[]>>;
}

/**
 * Full semantic tags JSON structure.
 */
export interface SemanticTagsData {
  version: string;
  updated: string;
  coverage: {
    total: number;
    tagged: number;
    categories: string[];
  };
  options: Record<string, SemanticTag>;
}

// ============================================================================
// § 1b. Semantic Clusters (Phase 1)
// ============================================================================

/**
 * A semantic cluster groups terms across multiple categories that
 * naturally belong together (e.g., "cyberpunk" links neon glow, chrome,
 * cyberpunk city, teal and orange, etc.).
 */
export interface SemanticCluster {
  /** Display label */
  label: string;

  /** Brief description */
  description: string;

  /** Terms grouped by category */
  terms: Partial<Record<PromptCategory, string[]>>;
}

/**
 * Full semantic clusters JSON structure.
 */
export interface SemanticClustersData {
  version: string;
  meta: {
    totalClusters: number;
    totalPlacements: number;
    uniqueTerms: number;
  };
  clusters: Record<string, SemanticCluster>;
}

// ============================================================================
// § 1c. Direct Affinities (Phase 1)
// ============================================================================

/**
 * A direct affinity is a fine-grained term-to-term boost/penalise pair
 * that is more specific than cluster membership.
 */
export interface DirectAffinity {
  /** Anchor term */
  term: string;

  /** Terms that score higher when this anchor is selected */
  boosts: string[];

  /** Terms that score lower when this anchor is selected */
  penalises?: string[];
}

/**
 * Full direct affinities JSON structure.
 */
export interface DirectAffinitiesData {
  version: string;
  meta: {
    totalAffinities: number;
    uniqueTerms: number;
  };
  affinities: DirectAffinity[];
}

// ============================================================================
// § 2. Style Families
// ============================================================================

/**
 * A style family groups related options together.
 * Used for coherent randomisation and intelligent suggestions.
 */
export interface StyleFamily {
  /** Display name for UI */
  displayName: string;

  /** Brief description */
  description: string;

  /** All options that belong to this family */
  members: string[];

  /** Other families that work well with this one */
  related: string[];

  /** Families that conflict with this one */
  opposes: string[];

  /** Default mood for this family */
  mood: SemanticMood;

  /** Suggested colours when this family is dominant */
  suggestedColours?: string[];

  /** Suggested lighting when this family is dominant */
  suggestedLighting?: string[];

  /** Suggested atmosphere when this family is dominant */
  suggestedAtmosphere?: string[];
}

/**
 * Full families JSON structure.
 */
export interface FamiliesData {
  version: string;
  updated: string;
  families: Record<string, StyleFamily>;
}

// ============================================================================
// § 3. Conflicts
// ============================================================================

/**
 * Severity of a conflict between options.
 */
export type ConflictSeverity = 'hard' | 'soft';

/**
 * A detected conflict between two or more options.
 */
export interface ConflictDefinition {
  /** The options that conflict */
  terms: string[];

  /** Explanation of why they conflict */
  reason: string;

  /** Suggested resolution or alternative */
  suggestion?: string;

  /** How severe the conflict is */
  severity: ConflictSeverity;
}

/**
 * Full conflicts JSON structure.
 */
export interface ConflictsData {
  version: string;
  updated: string;
  conflicts: ConflictDefinition[];
}

/**
 * A detected conflict in the user's current selections.
 */
export interface DetectedConflict {
  /** The conflicting terms */
  terms: string[];

  /** Explanation of the conflict */
  reason: string;

  /** Suggested resolution */
  suggestion?: string;

  /** Severity level */
  severity: ConflictSeverity;

  /** Which categories contain the conflicting terms */
  categories: PromptCategory[];
}

// ============================================================================
// § 4. Scoring
// ============================================================================

/**
 * Relevance score for a single option (0-100).
 */
export interface ScoredOption {
  /** The option text */
  option: string;

  /** Relevance score (0-100) */
  score: number;

  /** Breakdown of score components (for debugging/tooltips) */
  breakdown?: {
    familyMatch: number;
    moodMatch: number;
    eraMatch: number;
    conflictPenalty: number;
    complementBonus: number;
    marketBoost: number;
    /** Bonus for matching multiple selected families */
    multiFamilyBonus?: number;
    /** Bonus for matching subject keywords */
    subjectKeywordMatch?: number;
    /** Bonus from shared cluster membership (Phase 1) */
    clusterBoost?: number;
    /** Bonus/penalty from direct affinities (Phase 1) */
    affinityBoost?: number;
    /** Tier multiplier applied (Phase 1) — 1.0 = neutral */
    tierMultiplier?: number;
    /** Boost from learned co-occurrence data (Phase 5) */
    coOccurrenceBoost?: number;
    /** Penalty from anti-pattern data (Phase 7.1) */
    antiPatternPenalty?: number;
    /** Penalty from collision data (Phase 7.1) */
    collisionPenalty?: number;
    /** Penalty from weak term data (Phase 7.2) */
    weakTermPenalty?: number;
    /** Penalty from redundancy data (Phase 7.3) */
    redundancyPenalty?: number;
    /** Boost from magic combo completion (Phase 7.4) */
    comboBoost?: number;
    /** Platform-specific co-occurrence boost override (Phase 7.5) */
    platformCoOccurrenceBoost?: number;
    /** Platform-specific term quality adjustment (Phase 7.5) */
    platformTermQualityBoost?: number;
    /** Temporal boost from seasonal/weekly/trending signals (Phase 7.8) */
    temporalBoost?: number;
    /** Penalty from expendable term detection (Phase 7.9) */
    expendabilityPenalty?: number;
  };
}

/**
 * Context extracted from the user's current selections.
 * Used for scoring remaining options.
 */
export interface PromptContext {
  /** Keywords extracted from user's typed subject */
  subjectKeywords: string[];

  /** The most common family across all selections */
  activeFamily: string | null;

  /** All related families from current selections */
  relatedFamilies: string[];

  /** The dominant mood from current selections */
  dominantMood: SemanticMood | null;

  /** The era from current selections */
  era: SemanticEra | null;

  /** All currently selected terms (for conflict detection) */
  selectedTerms: string[];

  /** Whether Market Mood feature is enabled */
  marketMoodEnabled: boolean;

  /** Current market state (if Market Mood enabled) */
  marketState: MarketState | null;

  /** Active cluster IDs — clusters where ≥1 selected term is a member (Phase 1) */
  activeClusters: Set<string>;

  /** Platform tier (1-4) for tier-aware scoring multipliers (Phase 1) */
  tier: number | null;

  /** Pre-built co-occurrence lookup from learned weights (Phase 5, null = no data) */
  coOccurrenceWeights: CoOccurrenceLookup | null;

  /** Blend ratio [curated, learned] based on total event count (Phase 5) */
  blendRatio: [curated: number, learned: number];

  /** Pre-built anti-pattern lookup from learned weights (Phase 7.1, null = no data) */
  antiPatternLookup: AntiPatternLookup | null;

  /** Pre-built collision lookup from learned weights (Phase 7.1, null = no data) */
  collisionLookup: CollisionLookup | null;

  /** Pre-built weak term lookup from learned weights (Phase 7.2, null = no data) */
  weakTermLookup: WeakTermLookup | null;

  /** Pre-built redundancy lookup from learned weights (Phase 7.3, null = no data) */
  redundancyLookup: RedundancyLookup | null;

  /** Pre-built combo lookup from learned weights (Phase 7.4, null = no data) */
  comboLookup: ComboLookup | null;

  /** Pre-built platform term quality lookup (Phase 7.5, null = no data) */
  platformTermQualityLookup: PlatformTermQualityLookup | null;

  /** Pre-built platform co-occurrence lookup (Phase 7.5, null = no data) */
  platformCoOccurrenceLookup: PlatformCoOccurrenceLookup | null;

  /** Active platform identifier e.g. "leonardo", "midjourney" (Phase 7.5) */
  platformId: string | null;

  /** A/B variant weight overrides (Phase 7.6f). When non-null, applied as
   *  `{ ...SCORE_WEIGHTS, ...abVariantWeights }` in the scoring engine.
   *  null = use default weights (control group or no test running). */
  abVariantWeights: Record<string, number> | null;

  /** Pre-built temporal lookup for seasonal/weekly boosts (Phase 7.8, null = no data) */
  temporalLookup: TemporalLookup | null;

  /** Pre-built trending lookup for velocity signals (Phase 7.8, null = no data) */
  trendingLookup: TrendingLookup | null;

  /** Pre-built compression lookup for expendability penalties (Phase 7.9, null = no data) */
  compressionLookup: CompressionLookup | null;
}

// ============================================================================
// § 5. Market Mood
// ============================================================================

/**
 * Possible market states that influence suggestions.
 */
export type MarketStateType =
  | 'market_opening'
  | 'market_closing'
  | 'high_volatility'
  | 'low_volatility'
  | 'currency_strength_usd'
  | 'currency_strength_gbp'
  | 'currency_strength_eur'
  | 'gold_rising'
  | 'gold_falling'
  | 'crypto_pumping'
  | 'neutral';

/**
 * Current market state for mood influence.
 */
export interface MarketState {
  /** Primary market state */
  type: MarketStateType;

  /** Intensity of the state (0-1) */
  intensity: number;

  /** Which exchange triggered this (if applicable) */
  exchangeId?: string;

  /** Whether the market is currently open somewhere */
  isMarketOpen: boolean;
}

/**
 * Market mood boost configuration for a specific state.
 */
export interface MarketMoodBoost {
  /** What triggers this mood */
  trigger: string;

  /** Options to boost, by category */
  boost: Partial<Record<PromptCategory, string[]>>;

  /** Multiplier for boosted options (e.g., 1.3 = +30% score) */
  boostWeight: number;
}

/**
 * Full market moods JSON structure.
 */
export interface MarketMoodsData {
  version: string;
  updated: string;
  moods: Record<MarketStateType, MarketMoodBoost>;
}

// ============================================================================
// § 6. Platform Hints
// ============================================================================

/**
 * Platform-specific intelligence adjustments.
 */
export interface PlatformHint {
  /** Platform tier (1-4) */
  tier: number;

  /** Whether platform weights earlier tokens more heavily */
  prefersEarlierTokens?: boolean;

  /** Whether platform prefers natural language over keywords */
  prefersNaturalLanguage?: boolean;

  /** Whether platform prefers keyword lists */
  prefersKeywords?: boolean;

  /** Weight syntax (e.g., "::1.5" for Midjourney) */
  weightSyntax?: string;

  /** Negative prompt syntax (e.g., "--no" for Midjourney) */
  negativeSyntax?: string;

  /** Whether negative is in separate field */
  separateNegative?: boolean;

  /** User-facing hints for this platform */
  hints: string[];

  /** Categories that perform well on this platform */
  strongCategories?: PromptCategory[];

  /** Categories to trim first when over limit */
  trimPriority?: PromptCategory[];
}

/**
 * Full platform hints JSON structure.
 */
export interface PlatformHintsData {
  version: string;
  updated: string;
  platforms: Record<string, PlatformHint>;
}

// ============================================================================
// § 7. Prompt DNA (Coherence Visualisation)
// ============================================================================

/**
 * Fill status for a single category in the DNA bar.
 */
export type CategoryFillStatus = 'filled' | 'empty';

/**
 * Coherence status for a single category.
 */
export type CategoryCoherenceStatus = 'coherent' | 'neutral' | 'conflict';

/**
 * DNA representation of a prompt.
 */
export interface PromptDNA {
  /** Overall coherence score (0-100) */
  coherenceScore: number;

  /** Per-category fill status */
  categoryFill: Record<PromptCategory, CategoryFillStatus>;

  /** Per-category coherence status */
  categoryCoherence: Record<PromptCategory, CategoryCoherenceStatus>;

  /** Detected conflicts */
  conflicts: DetectedConflict[];

  /** Dominant style family */
  dominantFamily: string | null;

  /** Dominant mood */
  dominantMood: SemanticMood | null;

  /** Number of categories filled */
  filledCount: number;

  /** Total number of categories (excluding negative) */
  totalCategories: number;
}

// ============================================================================
// § 8. Suggestions
// ============================================================================

/**
 * A suggested option chip for the UI.
 */
export interface SuggestedOption {
  /** The option text */
  option: string;

  /** Which category it belongs to */
  category: PromptCategory;

  /** Why it's suggested (for tooltip) */
  reason: string;

  /** Relevance score */
  score: number;

  /** Whether this came from Market Mood boost */
  isMarketBoosted?: boolean;
}

// ============================================================================
// § 9. API Functions (module interface)
// ============================================================================

/**
 * Options for the reorder function.
 */
export interface ReorderOptions {
  /** Current prompt builder state */
  state: PromptBuilderState;

  /** Category to reorder options for */
  category: PromptCategory;

  /** Original options list */
  options: string[];

  /** Whether Market Mood is enabled */
  marketMoodEnabled?: boolean;

  /** Current market state */
  marketState?: MarketState | null;
}

/**
 * Result of the reorder function.
 */
export interface ReorderResult {
  /** Options sorted by relevance score */
  options: ScoredOption[];

  /** The context used for scoring */
  context: PromptContext;
}

/**
 * Options for the smart trim function.
 */
export interface SmartTrimOptions {
  /** Current selections by category */
  selections: Partial<Record<PromptCategory, string[]>>;

  /** Custom values by category (protected from trim) */
  customValues: Partial<Record<PromptCategory, string>>;

  /** Maximum character limit */
  maxChars: number;

  /** Platform ID for platform-specific trim priority */
  platformId?: string;
}

/**
 * Result of the smart trim function.
 */
export interface SmartTrimResult {
  /** Trimmed selections by category */
  selections: Partial<Record<PromptCategory, string[]>>;

  /** Whether any trimming occurred */
  wasTrimmed: boolean;

  /** What was removed (for user feedback) */
  removed: Array<{ term: string; category: PromptCategory; reason: string }>;
}

/**
 * Options for coherent randomise.
 */
export interface RandomiseOptions {
  /** Current state (to preserve user's subject if typed) */
  currentState: PromptBuilderState;

  /** Platform ID for limit awareness */
  platformId: string;

  /** Target style family (optional - will pick random if not provided) */
  targetFamily?: string;
}

/**
 * Result of coherent randomise.
 */
export interface RandomiseResult {
  /** New state with randomised selections */
  state: PromptBuilderState;

  /** The style family that was used */
  family: string;

  /** Whether user's subject was preserved */
  subjectPreserved: boolean;
}
