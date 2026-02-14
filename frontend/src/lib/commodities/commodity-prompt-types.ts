// src/lib/commodities/commodity-prompt-types.ts
// ============================================================================
// COMMODITY PROMPT SYSTEM — SHARED TYPES (v3.0 Blueprint-Ready)
// ============================================================================
// Types used by the commodity prompt generator and tooltip.
//
// v3.0: Added allPrompts (all 4 tiers always generated).
//       Fixed SentimentLevel to match deriveSentiment() return values.
//       Aligned getGlowConfig() to use correct sentiment checks.
//
// v2.0: Simplified from 7-level sentiment to 3 positive-only levels.
//       Removed WeatherSensitivity (all commodities use weather equally).
//       Only happy, positive imagery — no anxiety/fear/despair.
//
// Authority: go-big-or-go-home-prompt-builder.md §2
// Existing features preserved: Yes (all existing fields kept, new field additive)
// ============================================================================

import type { PromptTier } from '@/lib/weather/weather-prompt-generator';
import type { Season } from '@/lib/commodities/country-weather-resolver';

// ============================================================================
// COMMODITY GROUPS
// ============================================================================

/**
 * High-level commodity group for glow color.
 * Maps from the vibes category system to the 3-group system used for glow.
 */
export type CommodityGroup = 'energy' | 'agriculture' | 'metals';

// ============================================================================
// SENTIMENT SCALE — POSITIVE ONLY
// ============================================================================

/**
 * 3-level positive-only sentiment derived from deltaPct.
 * Controls glow intensity on the tooltip, NOT the prompt content.
 * The prompt is always positive/happy regardless of market direction.
 *
 * - confident: deltaPct > +2% (bright glow)
 * - optimistic: deltaPct > 0% (warm glow)
 * - neutral:    deltaPct <= 0% (soft glow)
 */
export type SentimentLevel = 'confident' | 'optimistic' | 'neutral';

// ============================================================================
// PROMPT INPUT
// ============================================================================

export interface CommodityPromptInput {
  /** Commodity ID from catalog (e.g., "gold", "brent_crude") */
  commodityId: string;
  /** Display name (e.g., "Gold", "Brent Crude") */
  commodityName: string;
  /** High-level group for glow colour */
  group: CommodityGroup;
  /** Percentage change from previous close */
  deltaPct: number;
  /** Prompt output tier (1=CLIP, 2=Midjourney, 3=Natural, 4=Plain) */
  tier: PromptTier;
  /** Scene country code — base flag uses producer country, conversion flags use EU/GB/US */
  sceneCountryCode: string;
  /** Season at the scene country */
  season: Season;
  /** Weather data from scene country's nearest exchange (null = use fallback) */
  weather: CommodityWeatherSlice | null;
  /** Current hour at the scene country (0-23), for lighting derivation */
  localHour: number;
  /**
   * Flag position index on the commodity mover card (0-3).
   * Used for stage rotation — each flag position shows a different
   * production stage to guarantee no duplicate prompts on the same card.
   *   0 = base price flag (random producer country)
   *   1 = conversion flag 1 (e.g., EUR)
   *   2 = conversion flag 2 (e.g., GBP)
   *   3 = conversion flag 3 (e.g., USD)
   * Default: 0 (backward compatible)
   */
  flagIndex?: number;
}

/**
 * Minimal weather slice needed by the generator.
 * Only description is used in blueprint mode (no temperature numbers in output).
 * temperatureC and windSpeedKmh retained for legacy fallback only.
 */
export interface CommodityWeatherSlice {
  temperatureC: number;
  description: string;
  conditions?: string;
  humidity?: number;
  windSpeedKmh?: number;
}

// ============================================================================
// ALL-TIER PROMPT BUNDLE
// ============================================================================

/**
 * All four tier prompt variants, always generated together.
 * Tooltip shows one tier (tier 4 for free, selected for Pro),
 * but all 4 are available for Pro users to copy.
 */
export interface AllTierPrompts {
  /** Tier 1: CLIP-based (Stable Diffusion, Leonardo, Flux, ComfyUI) */
  tier1: string;
  /** Tier 2: Midjourney / BlueWillow */
  tier2: string;
  /** Tier 3: Natural Language (DALL·E, Imagen, Adobe Firefly) */
  tier3: string;
  /** Tier 4: Plain Language (Canva, Craiyon, Microsoft Designer) */
  tier4: string;
}

// ============================================================================
// PROMPT OUTPUT
// ============================================================================

export interface CommodityPromptOutput {
  /** The assembled prompt text for the DISPLAYED tier */
  prompt: string;
  /**
   * All 4 tier variants, always generated.
   * Pro users can copy any tier; free users see tier 4 only.
   */
  allPrompts: AllTierPrompts;
  /** Which tier is displayed */
  tier: PromptTier;
  /** Commodity group (for glow color) */
  group: CommodityGroup;
  /** Sentiment level (for glow intensity) */
  sentiment: SentimentLevel;
  /** Scene country used */
  sceneCountryCode: string;
  /** Season at scene */
  season: Season;
  /** Whether weather data was included */
  weatherUsed: boolean;
  /** Seed used for deterministic reproduction */
  seed: number;
  /** Whether blueprint data was used (true) or legacy fallback (false) */
  blueprintUsed: boolean;
}

// ============================================================================
// GLOW CONFIGURATION
// ============================================================================

/**
 * Glow color config for the tooltip border/shadow.
 * Group determines base hue, sentiment modulates intensity.
 */
export interface GlowConfig {
  /** Tailwind border class (e.g., "border-amber-500/60") */
  borderClass: string;
  /** Tailwind shadow class (e.g., "shadow-amber-500/30") */
  shadowClass: string;
  /** CSS glow color for custom effects */
  glowColor: string;
}
