// src/lib/commodities/prompt-blueprint-types.ts
// ============================================================================
// COMMODITY PROMPT BLUEPRINT — SHARED TYPES
// ============================================================================
// TypeScript interfaces that mirror the JSON structure of the authored prompt
// blueprint files (energy.json, agriculture.json, metals.json, plastics.json)
// and the time-of-day lighting layer (time-of-day.json).
//
// These types are consumed by the blueprint loader and resolver.
// They do NOT replace the existing CommodityPromptInput/Output types —
// those remain the public API used by the tooltip and generator.
//
// JSON FILE STRUCTURE:
//   energy.json        → 13 commodities, 4 stages each
//   agriculture.json   → 34 commodities, 4 stages each
//   metals.json        → 28 commodities, 4 stages each
//   plastics.json      →  3 commodities, 12 stages each
//   time-of-day.json   →  4 lighting periods (dawn/morning/golden/night)
//
// TOTALS: 78 commodities, 336 stages, 1,222 environments, 4 time periods
//
// Authority: Commodity prompt blueprint JSONs in src/data/commodities/prompts/
// Existing features preserved: Yes (additive types only, nothing modified)
// ============================================================================

// ============================================================================
// STAGE (one visual scene for a commodity)
// ============================================================================

/**
 * A single production stage for a commodity.
 *
 * Every commodity has 4–12 stages representing different points in its
 * supply chain (origin → extraction → processing → finished).
 * Each stage is a complete, self-contained visual scene.
 *
 * @example (gold / origin)
 * {
 *   subject: "Open-pit gold mine with stepped terraces carved into red earth...",
 *   lens: "24mm f/8, wide establishing shot showing full mine geometry...",
 *   enhancer: "Red laterite earth contrasting with grey rock faces, tiny trucks...",
 *   environments: {
 *     _default: "Large open-pit mine in semi-arid landscape...",
 *     ZA: "Witwatersrand Basin near Johannesburg...",
 *     AU: "Super Pit at Kalgoorlie, Western Australia..."
 *   }
 * }
 */
export interface BlueprintStage {
  /** Rich scene description — the visual subject of the image */
  subject: string;
  /** Camera / focal length / perspective description */
  lens: string;
  /** Textures, colours, sensory details that enhance the scene */
  enhancer: string;
  /**
   * Country-specific environment overrides.
   * Key is ISO 3166-1 alpha-2 code (e.g., "ZA", "AU") or "_default".
   * Value is a location-specific description string.
   *
   * Resolution order:
   *   1. Exact country match (e.g., "NO" for Norway)
   *   2. "_default" fallback (always present)
   */
  environments: Record<string, string>;
}

// ============================================================================
// COMMODITY BLUEPRINT (one commodity across all stages)
// ============================================================================

/**
 * Full blueprint for a single commodity.
 * Contains all stages indexed by stage name.
 *
 * Stage names vary by category:
 *   energy/agriculture/metals: origin, extraction, processing, finished
 *   plastics: feedstock, extraction, refining, monomer, polymerisation,
 *             pelletising, compounding, forming, product, distribution,
 *             waste, recycling
 */
export interface CommodityBlueprint {
  /** All stages for this commodity, keyed by stage name */
  stages: Record<string, BlueprintStage>;
}

// ============================================================================
// BLUEPRINT FILE (one JSON file — energy.json, metals.json, etc.)
// ============================================================================

/**
 * Top-level structure of each blueprint JSON file.
 * Matches the actual JSON shape exactly.
 */
export interface BlueprintFile {
  /** Category identifier (e.g., "energy", "agriculture", "metals") */
  category: string;
  /** Human-readable category label (e.g., "Metals") */
  categoryLabel: string;
  /** Number of commodities in this file */
  commodityCount: number;
  /** Human-readable labels for each stage name in this category */
  stageLabels: Record<string, string>;
  /** All commodities in this file, keyed by commodity ID */
  commodities: Record<string, CommodityBlueprint>;
}

// ============================================================================
// TIME-OF-DAY LIGHTING PERIOD
// ============================================================================

/**
 * One of four time-of-day lighting periods.
 * Maps local hour ranges to authored lighting descriptions.
 *
 * The lighting string is appended to the prompt enhancer.
 * Combined with weather conditions, this produces 40 distinct
 * atmosphere combinations per environment (10 weather × 4 time periods).
 */
export interface TimeOfDayPeriod {
  /** Human-readable label (e.g., "Dawn / Blue Hour") */
  label: string;
  /** Inclusive hour range [start, end] in 24h format */
  hourRange: [number, number];
  /** Primary lighting description — appended to prompt */
  lighting: string;
  /** Extended modifier — additional atmospheric detail */
  modifier: string;
}

/**
 * Period identifier. Matches the keys in time-of-day.json.
 */
export type TimeOfDayPeriodId = 'dawn' | 'morning' | 'golden' | 'night';

/**
 * Top-level structure of time-of-day.json.
 * Only the `periods` field is used at runtime.
 */
export interface TimeOfDayFile {
  /** Documentation string (ignored at runtime) */
  _doc: string;
  /** The four lighting periods */
  periods: Record<TimeOfDayPeriodId, TimeOfDayPeriod>;
}

// ============================================================================
// RESOLVED BLUEPRINT (output of the resolver — input to the assembler)
// ============================================================================

/**
 * Fully resolved blueprint data for one prompt generation.
 * Produced by the resolver (Chunk 2), consumed by the assembler (Chunk 3).
 *
 * All strings are final — no further lookups needed.
 * Temperature numbers are intentionally excluded.
 */
export interface ResolvedBlueprint {
  /** The authored scene subject (e.g., "Open-pit gold mine with stepped terraces...") */
  subject: string;
  /** The resolved environment string (country-specific or _default) */
  environment: string;
  /** Camera / lens description */
  lens: string;
  /** Textures, colours, sensory enhancer */
  enhancer: string;
  /** Time-of-day lighting string (e.g., "warm golden-hour light with long dramatic shadows...") */
  timeLighting: string;
  /** Time-of-day modifier string (extended atmospheric detail) */
  timeModifier: string;
  /** Weather description pass-through (e.g., "overcast clouds") or null */
  weatherDescription: string | null;
  /** Which stage was selected (e.g., "origin", "extraction") */
  stageName: string;
  /** Which country code was used for environment resolution */
  countryCode: string;
  /** Which time period was resolved (e.g., "golden") */
  timePeriod: TimeOfDayPeriodId;
}
