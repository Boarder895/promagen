// src/lib/commodities/prompt-blueprint-resolver.ts
// ============================================================================
// COMMODITY PROMPT BLUEPRINT RESOLVER
// ============================================================================
// The "brain" that turns raw inputs into a fully resolved blueprint.
//
// Given a CommodityPromptInput, this module:
//   1. Looks up the commodity's authored blueprint (78 commodities covered)
//   2. Picks a production stage using seeded random (scene changes with price)
//   3. Resolves country-specific environment (or falls back to _default)
//   4. Maps localHour to a time-of-day lighting period
//   5. Passes through weather description (no temperature numbers)
//
// Returns a ResolvedBlueprint with all strings finalised and ready for
// the tier assembler (Chunk 3) to format into CLIP / MJ / NatLang / Plain.
//
// Returns null if no blueprint exists for the commodity ID — the generator
// falls back to the existing weather-phrase system in that case.
//
// DESIGN DECISIONS:
//   - Stage selection uses ROTATION by flagIndex so each flag on the same
//     card always shows a different production stage (v4.1).
//     The base stage index is seeded from (commodityId + deltaPct) only —
//     NOT sceneCountryCode — so all flags share the same anchor.
//     flagIndex (0-3) offsets into the stage array.
//   - Environment lookup is country → _default (never fabricated).
//   - Weather description is pass-through only — no temperature numbers,
//     no humidity, no wind speed values.
//   - Time-of-day uses the authored lighting strings from time-of-day.json,
//     NOT the weather-prompt-generator's getTimeMood().
//
// Authority: go-big-or-go-home-prompt-builder.md §2
// Existing features preserved: Yes (additive module, nothing modified)
// ============================================================================

import type { CommodityPromptInput } from './commodity-prompt-types';
import type {
  ResolvedBlueprint,
  BlueprintStage,
  TimeOfDayPeriodId,
} from './prompt-blueprint-types';
import { getBlueprint, getStageNames, getTimePeriod } from './prompt-blueprint-loader';

// ============================================================================
// SEEDED RANDOM
// ============================================================================
// Same algorithm as commodity-prompt-generator.ts — deterministic, stable.
// Identical inputs always produce the same output.

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

/**
 * Build a deterministic seed from commodity + country + price movement.
 *
 * The seed changes when deltaPct crosses integer boundaries (Math.round * 100),
 * which means small price ticks don't constantly reshuffle the stage, but
 * meaningful moves do rotate the scene.
 */
function buildSeed(commodityId: string, sceneCountryCode: string, deltaPct: number): number {
  let hash = 0;
  const str = `${commodityId}:${sceneCountryCode}:${Math.round(deltaPct * 100)}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// ============================================================================
// STAGE SELECTION
// ============================================================================

/**
 * Pick a production stage for this commodity using stage rotation.
 *
 * STAGE ROTATION (v4.1):
 * Each commodity card has up to 4 flags, and each commodity has ~4 stages.
 * Instead of relying on seed collision avoidance (which fails — 3 of 4 flags
 * often land on the same stage), we use a deterministic rotation:
 *
 *   baseStageIndex = seededRandom(commodityId + deltaPct)  // anchor per card
 *   flagStage = (baseStageIndex + flagIndex) % numStages   // each flag rotates
 *
 * This GUARANTEES every flag on the same card shows a different production
 * stage: origin → extraction → processing → finished.
 *
 * @param stageNames - Ordered array of stage keys (e.g., ['origin','extraction',...])
 * @param seed - Deterministic seed number (from commodityId + deltaPct only)
 * @param flagIndex - Position of this flag on the card (0-3)
 * @returns Selected stage name
 */
function pickStage(stageNames: string[], seed: number, flagIndex: number): string {
  if (stageNames.length === 0) return 'origin'; // Safety fallback
  if (stageNames.length === 1) return stageNames[0]!;
  const baseIdx = Math.floor(seededRandom(seed) * stageNames.length);
  const rotatedIdx = (baseIdx + flagIndex) % stageNames.length;
  return stageNames[rotatedIdx]!;
}

// ============================================================================
// ENVIRONMENT RESOLUTION
// ============================================================================

/**
 * Resolve the environment string for a given stage and country.
 *
 * Resolution order:
 *   1. Exact country match (e.g., "ZA" for South Africa)
 *   2. "_default" fallback (always present in authored data)
 *   3. Empty string (should never happen — all stages have _default)
 *
 * @param stage - The selected blueprint stage
 * @param countryCode - ISO 3166-1 alpha-2 code (e.g., "ZA", "AU", "EU")
 * @returns Environment description string
 */
function resolveEnvironment(stage: BlueprintStage, countryCode: string): string {
  const upperCode = countryCode.toUpperCase();

  // Try exact country match first
  if (stage.environments[upperCode]) {
    return stage.environments[upperCode];
  }

  // Fall back to _default
  if (stage.environments['_default']) {
    return stage.environments['_default'];
  }

  // Should never reach here — all authored stages have _default
  return '';
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Resolve a full blueprint for the given commodity prompt input.
 *
 * This is the core function that bridges raw inputs to authored content.
 * It picks a stage, resolves the environment, maps time-of-day lighting,
 * and passes through the weather description (no numbers).
 *
 * @param input - The standard CommodityPromptInput (same as generator receives)
 * @returns ResolvedBlueprint with all strings finalised, or null if no blueprint
 *
 * @example
 * const resolved = resolveBlueprint({
 *   commodityId: 'gold',
 *   commodityName: 'Gold',
 *   group: 'metals',
 *   deltaPct: 2.4,
 *   tier: 4,
 *   sceneCountryCode: 'ZA',
 *   season: 'winter',
 *   weather: { temperatureC: 12, description: 'clear sky' },
 *   localHour: 18,
 * });
 *
 * // resolved.subject → "Open-pit gold mine with stepped terraces carved into red earth..."
 * // resolved.environment → "Witwatersrand Basin near Johannesburg..."
 * // resolved.lens → "24mm f/8, wide establishing shot..."
 * // resolved.enhancer → "Red laterite earth contrasting with grey rock faces..."
 * // resolved.timeLighting → "warm golden-hour light with long dramatic shadows..."
 * // resolved.timeModifier → "deep amber side-lighting sculpting three-dimensional form..."
 * // resolved.weatherDescription → "clear sky"
 * // resolved.stageName → "origin"
 * // resolved.countryCode → "ZA"
 * // resolved.timePeriod → "golden"
 */
export function resolveBlueprint(input: CommodityPromptInput): ResolvedBlueprint | null {
  // 1. Look up the commodity blueprint
  const blueprint = getBlueprint(input.commodityId);
  if (!blueprint) return null;

  // 2. Get available stage names for this commodity
  const stageNames = getStageNames(input.commodityId);
  if (stageNames.length === 0) return null;

  // 3. Pick a stage using rotation — seed from commodity + deltaPct ONLY
  //    (NOT sceneCountryCode) so all flags on the same card share the same
  //    base index. flagIndex then offsets each to a different stage.
  const seed = buildSeed(input.commodityId, '_CARD_', input.deltaPct);
  const flagIndex = input.flagIndex ?? 0;
  const stageName = pickStage(stageNames, seed, flagIndex);

  // 4. Get the stage data
  const stage = blueprint.stages[stageName];
  if (!stage) return null; // Safety — shouldn't happen

  // 5. Resolve country-specific environment
  const environment = resolveEnvironment(stage, input.sceneCountryCode);

  // 6. Resolve time-of-day lighting
  const timePeriodResult = getTimePeriod(input.localHour);
  const timeLighting = timePeriodResult.period.lighting;
  const timeModifier = timePeriodResult.period.modifier;
  const timePeriod: TimeOfDayPeriodId = timePeriodResult.id;

  // 7. Pass through weather description only (no temperature numbers)
  const weatherDescription = input.weather?.description ?? null;

  return {
    subject: stage.subject,
    environment,
    lens: stage.lens,
    enhancer: stage.enhancer,
    timeLighting,
    timeModifier,
    weatherDescription,
    stageName,
    countryCode: input.sceneCountryCode,
    timePeriod,
  };
}

/**
 * Check whether a commodity has an authored blueprint.
 * Convenience re-export so consumers don't need to import the loader directly.
 *
 * @param commodityId - Commodity ID from catalog
 * @returns true if blueprint exists
 */
export { hasBlueprint } from './prompt-blueprint-loader';
