// src/data/vocabulary/phrase-category-types.ts
// ============================================================================
// PHRASE CATEGORY MAP — TYPE DEFINITIONS
// ============================================================================
// Types for the intelligent phrase registry that maps every vocabulary phrase
// to a prompt builder category with rich tagging metadata for cascading
// filtering (Phase 5).
//
// Authority: go-big-or-go-home-prompt-builder.md v2 §Phase 4
// Existing features preserved: Yes
// ============================================================================

import type { PromptCategory } from '@/types/prompt-builder';

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Commodity group — matches CommodityGroup from commodity-prompt-types.
 * Duplicated here to avoid circular dependency.
 */
export type PhraseGroup = 'energy' | 'agriculture' | 'metals';

/**
 * Mood tag derived from phrase source context.
 * - bullish: phrases from bull market, euphoria, confidence states
 * - bearish: phrases from bear market, despair, fear, absence states
 * - neutral: no sentiment bias (most phrases)
 */
export type PhraseMood = 'bullish' | 'bearish' | 'neutral';

/**
 * Source JSON that the phrase originated from.
 * Used for debugging and provenance tracking.
 */
export type PhraseSource =
  | 'commodity-vibes'
  | 'transformation-states'
  | 'production-countries'
  | 'extraction-methods'
  | 'end-use-sectors'
  | 'trading-culture'
  | 'price-states'
  | 'sensory-visual'
  | 'sensory-smell-taste'
  | 'sensory-touch-sound'
  | 'human-stories-workers'
  | 'human-stories-traders-consumers'
  | 'weather-commodity-links'
  | 'absence-states'
  | 'historical-moments'
  | 'geopolitical'
  | 'containers'
  | 'rituals'
  | 'night-operations'
  | 'shared-vocab-expansion'
  | 'cross-population-merge';

// ============================================================================
// INTELLIGENT PHRASE
// ============================================================================

/**
 * A vocabulary phrase enriched with category assignment and tagging metadata.
 *
 * The tags enable Phase 5's cascading filter to narrow phrases based on
 * the user's current context (selected commodity, group, weather, mood).
 *
 * @example
 * {
 *   text: "Fort Knox secure chamber golden glow",
 *   category: "subject",
 *   source: "commodity-vibes",
 *   commodityId: "gold",
 *   commodityGroup: "metals",
 *   mood: "neutral",
 * }
 */
export interface IntelligentPhrase {
  /** The phrase text (exactly as it appears in the JSON) */
  text: string;

  /** Which prompt builder category this phrase belongs to */
  category: PromptCategory;

  /** Source JSON file the phrase came from */
  source: PhraseSource;

  // ============================
  // CASCADING FILTER TAGS
  // ============================

  /** Commodity ID this phrase is tied to (undefined = universal) */
  commodityId?: string;

  /** Commodity group this phrase is associated with */
  commodityGroup?: PhraseGroup;

  /** Mood / sentiment bias of the phrase */
  mood?: PhraseMood;

  /** Weather event type (drought, flood, frost, heat, storm, monsoon) */
  weatherEvent?: string;

  /** Country codes this phrase is relevant to */
  countryCodes?: string[];

  /** Extraction method type (drilling, mining, refining, etc.) */
  extractionMethod?: string;

  /** Sub-section within the source JSON (for provenance) */
  subSection?: string;
}

// ============================================================================
// REGISTRY TYPES
// ============================================================================

/**
 * The complete phrase registry, indexed by category.
 */
export type PhraseCategoryRegistry = Record<PromptCategory, IntelligentPhrase[]>;

/**
 * Summary statistics for the registry.
 */
export interface PhraseCategoryStats {
  /** Total unique phrase texts */
  uniquePhrases: number;
  /** Total placements (a phrase can appear in multiple categories) */
  totalPlacements: number;
  /** Count per category */
  byCategory: Record<PromptCategory, number>;
  /** Count per source */
  bySource: Record<PhraseSource, number>;
  /** Count per commodity group */
  byGroup: Record<PhraseGroup | 'universal', number>;
}
