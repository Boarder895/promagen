// src/lib/commodities/prompt-blueprint-loader.ts
// ============================================================================
// COMMODITY PROMPT BLUEPRINT LOADER
// ============================================================================
// Reads all 4 prompt blueprint JSON files + time-of-day.json at module init.
// Builds a single Map<commodityId, CommodityBlueprint> for O(1) lookups.
//
// USAGE:
//   import { getBlueprint, getTimePeriod } from './prompt-blueprint-loader';
//
//   const bp = getBlueprint('gold');       // → CommodityBlueprint | null
//   const tp = getTimePeriod(14);          // → { id: 'morning', period: ... }
//   const stageNames = getStageNames('gold'); // → ['origin','extraction',...]
//
// PERFORMANCE:
//   - JSON imports are resolved at build time by Next.js bundler
//   - Map is built once at module load (cold start), then O(1) per lookup
//   - Total data: 78 commodities, 336 stages, 1,222 environments
//   - Memory: ~750KB parsed JSON (acceptable for client-side)
//
// Authority: Prompt blueprint JSONs in src/data/commodities/prompts/
// Existing features preserved: Yes (additive module, nothing modified)
// ============================================================================

import type {
  BlueprintFile,
  CommodityBlueprint,
  TimeOfDayFile,
  TimeOfDayPeriod,
  TimeOfDayPeriodId,
} from './prompt-blueprint-types';

// ============================================================================
// JSON IMPORTS (resolved at build time by Next.js)
// ============================================================================

import energyJson from '@/data/commodities/prompts/energy.json';
import agricultureJson from '@/data/commodities/prompts/agriculture.json';
import metalsJson from '@/data/commodities/prompts/metals.json';
import plasticsJson from '@/data/commodities/prompts/plastics.json';
import timeOfDayJson from '@/data/commodities/prompts/time-of-day.json';

// ============================================================================
// BLUEPRINT INDEX (built once at module load)
// ============================================================================

/**
 * Master index: commodityId → CommodityBlueprint.
 * All 78 commodities from all 4 files merged into one Map.
 *
 * If a commodity ID appears in multiple files (shouldn't happen),
 * the later file wins — but the JSONs are non-overlapping by design.
 */
const BLUEPRINT_INDEX = new Map<string, CommodityBlueprint>();

/**
 * Stage labels per commodity ID.
 * Used for display purposes (e.g., "Origin / Raw" for the "origin" stage).
 */
const STAGE_LABELS_INDEX = new Map<string, Record<string, string>>();

// Load all blueprint files into the index
function loadBlueprintFile(file: BlueprintFile): void {
  const stageLabels = file.stageLabels;
  for (const [commodityId, blueprint] of Object.entries(file.commodities)) {
    BLUEPRINT_INDEX.set(commodityId, blueprint as CommodityBlueprint);
    STAGE_LABELS_INDEX.set(commodityId, stageLabels);
  }
}

// Execute at module load
loadBlueprintFile(energyJson as unknown as BlueprintFile);
loadBlueprintFile(agricultureJson as unknown as BlueprintFile);
loadBlueprintFile(metalsJson as unknown as BlueprintFile);
loadBlueprintFile(plasticsJson as unknown as BlueprintFile);

// ============================================================================
// TIME-OF-DAY INDEX
// ============================================================================

const TIME_OF_DAY = (timeOfDayJson as unknown as TimeOfDayFile).periods;

/**
 * Ordered period definitions for hour → period resolution.
 * Night wraps around midnight (20–4), so it's checked specially.
 *
 * Order matters for the linear scan: dawn → morning → golden → night.
 */
const PERIOD_ORDER: TimeOfDayPeriodId[] = ['dawn', 'morning', 'golden', 'night'];

// ============================================================================
// PUBLIC API — BLUEPRINT LOOKUPS
// ============================================================================

/**
 * Get the full blueprint for a commodity.
 *
 * @param commodityId - Commodity ID from catalog (e.g., "gold", "brent")
 * @returns CommodityBlueprint with all stages, or null if not found
 *
 * @example
 * const bp = getBlueprint('gold');
 * // bp.stages.origin.subject → "Open-pit gold mine with stepped terraces..."
 * // bp.stages.origin.environments.ZA → "Witwatersrand Basin near Johannesburg..."
 */
export function getBlueprint(commodityId: string): CommodityBlueprint | null {
  return BLUEPRINT_INDEX.get(commodityId) ?? null;
}

/**
 * Get all stage names for a commodity in their natural order.
 *
 * @param commodityId - Commodity ID
 * @returns Array of stage name strings, or empty array if not found
 *
 * @example
 * getStageNames('gold')       → ['origin', 'extraction', 'processing', 'finished']
 * getStageNames('polyethylene') → ['feedstock', 'extraction', 'refining', ...]
 * getStageNames('unknown')    → []
 */
export function getStageNames(commodityId: string): string[] {
  const bp = BLUEPRINT_INDEX.get(commodityId);
  if (!bp) return [];
  return Object.keys(bp.stages);
}

/**
 * Get the human-readable label for a stage.
 *
 * @param commodityId - Commodity ID
 * @param stageName - Stage key (e.g., "origin", "extraction")
 * @returns Label string (e.g., "Origin / Raw") or the stageName itself as fallback
 *
 * @example
 * getStageLabel('gold', 'origin') → "Origin / Ore Body"
 * getStageLabel('gold', 'unknown') → "unknown"
 */
export function getStageLabel(commodityId: string, stageName: string): string {
  const labels = STAGE_LABELS_INDEX.get(commodityId);
  if (!labels) return stageName;
  return labels[stageName] ?? stageName;
}

/**
 * Check whether a commodity has a blueprint.
 *
 * @param commodityId - Commodity ID
 * @returns true if blueprint exists in the index
 */
export function hasBlueprint(commodityId: string): boolean {
  return BLUEPRINT_INDEX.has(commodityId);
}

/**
 * Get the total number of loaded blueprints.
 * Useful for validation / test assertions.
 *
 * @returns Number of commodities in the index (expected: 78)
 */
export function getBlueprintCount(): number {
  return BLUEPRINT_INDEX.size;
}

// ============================================================================
// PUBLIC API — TIME-OF-DAY LOOKUPS
// ============================================================================

/**
 * Resolve a local hour (0–23) to a time-of-day lighting period.
 *
 * Hour ranges (from time-of-day.json):
 *   dawn:    5–7
 *   morning: 8–16
 *   golden:  17–19
 *   night:   20–4  (wraps around midnight)
 *
 * @param localHour - Hour in 24h format (0–23)
 * @returns Object with period ID and full period data
 *
 * @example
 * getTimePeriod(6)   → { id: 'dawn',    period: { label: "Dawn / Blue Hour", ... } }
 * getTimePeriod(14)  → { id: 'morning', period: { label: "Morning / Midday", ... } }
 * getTimePeriod(18)  → { id: 'golden',  period: { label: "Golden Hour / Sunset", ... } }
 * getTimePeriod(23)  → { id: 'night',   period: { label: "Night / Artificial Light", ... } }
 * getTimePeriod(2)   → { id: 'night',   period: { label: "Night / Artificial Light", ... } }
 */
export function getTimePeriod(
  localHour: number,
): { id: TimeOfDayPeriodId; period: TimeOfDayPeriod } {
  // Clamp to valid range
  const hour = Math.max(0, Math.min(23, Math.floor(localHour)));

  // Check non-wrapping periods first (dawn, morning, golden)
  for (const periodId of PERIOD_ORDER) {
    if (periodId === 'night') continue; // Handle night separately (wraps)
    const period = TIME_OF_DAY[periodId];
    const [start, end] = period.hourRange;
    if (hour >= start && hour <= end) {
      return { id: periodId, period };
    }
  }

  // Everything else is night (20–4, wrapping around midnight)
  return { id: 'night', period: TIME_OF_DAY.night };
}

/**
 * Get all four time-of-day periods.
 * Useful for display/debug purposes.
 *
 * @returns Record of all period IDs to their data
 */
export function getAllTimePeriods(): Record<TimeOfDayPeriodId, TimeOfDayPeriod> {
  return TIME_OF_DAY;
}
