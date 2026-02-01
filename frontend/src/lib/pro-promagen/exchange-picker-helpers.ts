// src/lib/pro-promagen/exchange-picker-helpers.ts
// ============================================================================
// EXCHANGE PICKER DATA HELPERS
// ============================================================================
// Transforms exchange catalog data into the format needed by ExchangePicker.
//
// UPDATED v2.0.0 (30 Jan 2026):
// - Multi-index support: ExchangeOption now includes availableIndices
// - New IndexSelection type for tracking user's chosen index per exchange
// - Backward compatible with existing picker usage
//
// Authority: docs/authority/paid_tier.md §5.3
// ============================================================================

import { getContinent, type Continent } from '@/lib/geo/continents';
import {
  PRO_SELECTION_LIMITS,
  type ExchangeCatalogEntry,
  isMultiIndexConfig,
} from '@/lib/pro-promagen/types';

// Re-export for consumers
export { PRO_SELECTION_LIMITS };

// ============================================================================
// TYPES
// ============================================================================

/**
 * Single index option within an exchange.
 */
export interface IndexOption {
  /** Marketstack benchmark key */
  benchmark: string;
  /** Human-readable index name */
  indexName: string;
}

/**
 * Exchange option for the picker component.
 * Includes multi-index support for Pro Promagen.
 */
export interface ExchangeOption {
  /** Unique exchange ID */
  id: string;
  /** Display label (e.g., "NYSE New York") */
  label: string;
  /** City name */
  city: string;
  /** Country name */
  country: string;
  /** ISO 2-letter country code for flag */
  iso2: string;
  /** Continent grouping */
  continent: Continent;
  /** Default benchmark code */
  defaultBenchmark: string;
  /** Default index name for display */
  defaultIndexName: string;
  /** All available indices for this exchange */
  availableIndices: IndexOption[];
  /** Whether this exchange has multiple index options */
  hasMultipleIndices: boolean;
}

/**
 * User's selection for a single exchange.
 * Includes optional index preference for multi-index exchanges.
 */
export interface ExchangeSelection {
  /** Exchange ID */
  exchangeId: string;
  /** User's chosen benchmark (optional, defaults to exchange's default) */
  benchmark?: string;
}

/**
 * Map of exchange ID to selected benchmark.
 * Used for tracking user's index preferences.
 */
export type IndexPreferences = Map<string, string>;

// ============================================================================
// TRANSFORM FUNCTIONS
// ============================================================================

/**
 * Transform a single exchange catalog entry into an ExchangeOption for the picker.
 * Now includes multi-index data. Handles both legacy and new marketstack formats.
 */
export function toExchangeOption(entry: ExchangeCatalogEntry): ExchangeOption {
  const abbrevMatch = entry.exchange.match(/\(([^)]+)\)/);
  const abbrev = abbrevMatch ? abbrevMatch[1] : null;
  // Construct label from abbreviation + city, or fall back to exchange name
  const label = abbrev ? `${abbrev} ${entry.city}` : entry.exchange;

  // Handle both legacy (benchmark/indexName) and new (defaultBenchmark/availableIndices) formats
  const ms = entry.marketstack;
  
  let defaultBenchmark: string;
  let defaultIndexName: string;
  let availableIndices: IndexOption[];
  
  if (!ms) {
    // No marketstack data - use empty defaults
    defaultBenchmark = '';
    defaultIndexName = '';
    availableIndices = [];
  } else if (isMultiIndexConfig(ms)) {
    // New multi-index format
    defaultBenchmark = ms.defaultBenchmark;
    defaultIndexName = ms.defaultIndexName;
    availableIndices = ms.availableIndices;
  } else {
    // Legacy single-index format
    defaultBenchmark = ms.benchmark;
    defaultIndexName = ms.indexName;
    availableIndices = [{ benchmark: ms.benchmark, indexName: ms.indexName }];
  }

  return {
    id: entry.id,
    label,
    city: entry.city,
    country: entry.country,
    iso2: entry.iso2,
    continent: getContinent(entry.iso2),
    defaultBenchmark,
    defaultIndexName,
    availableIndices,
    hasMultipleIndices: availableIndices.length > 1,
  };
}

/**
 * Transform the full exchange catalog into picker options.
 */
export function catalogToPickerOptions(catalog: ExchangeCatalogEntry[]): ExchangeOption[] {
  return catalog
    .map(toExchangeOption)
    .sort((a, b) => a.label.localeCompare(b.label));
}

// ============================================================================
// INDEX SELECTION HELPERS
// ============================================================================

/**
 * Get the active benchmark for an exchange given user preferences.
 */
export function getActiveBenchmark(
  exchange: ExchangeOption,
  preferences: IndexPreferences,
): string {
  const userPref = preferences.get(exchange.id);
  if (userPref) {
    // Validate preference exists in available indices
    const isValid = exchange.availableIndices.some(
      (idx) => idx.benchmark === userPref,
    );
    if (isValid) return userPref;
  }
  return exchange.defaultBenchmark;
}

/**
 * Get the active index name for display.
 */
export function getActiveIndexName(
  exchange: ExchangeOption,
  preferences: IndexPreferences,
): string {
  const activeBenchmark = getActiveBenchmark(exchange, preferences);
  const index = exchange.availableIndices.find(
    (idx) => idx.benchmark === activeBenchmark,
  );
  return index?.indexName ?? exchange.defaultIndexName;
}

/**
 * Convert array of ExchangeSelection to IndexPreferences map.
 */
export function selectionsToPreferences(
  selections: ExchangeSelection[],
): IndexPreferences {
  const map = new Map<string, string>();
  for (const sel of selections) {
    if (sel.benchmark) {
      map.set(sel.exchangeId, sel.benchmark);
    }
  }
  return map;
}

/**
 * Convert IndexPreferences map back to ExchangeSelection array.
 */
export function preferencesToSelections(
  selectedIds: string[],
  preferences: IndexPreferences,
): ExchangeSelection[] {
  return selectedIds.map((exchangeId) => ({
    exchangeId,
    benchmark: preferences.get(exchangeId),
  }));
}

// ============================================================================
// FILTER & GROUP FUNCTIONS
// ============================================================================

/**
 * Filter picker options by continent.
 */
export function filterByContinent(
  options: ExchangeOption[],
  continent: Continent
): ExchangeOption[] {
  return options.filter((opt) => opt.continent === continent);
}

/**
 * Get exchange options grouped by continent.
 */
export function groupByContinent(
  options: ExchangeOption[]
): Map<Continent, ExchangeOption[]> {
  const groups = new Map<Continent, ExchangeOption[]>();

  const continents: Continent[] = [
    'ASIA',
    'OCEANIA',
    'EUROPE',
    'MIDDLE_EAST',
    'AFRICA',
    'NORTH_AMERICA',
    'SOUTH_AMERICA',
  ];

  for (const continent of continents) {
    groups.set(continent, []);
  }

  for (const option of options) {
    const list = groups.get(option.continent);
    if (list) {
      list.push(option);
    }
  }

  for (const [, list] of groups) {
    list.sort((a, b) => a.label.localeCompare(b.label));
  }

  return groups;
}

/**
 * Search exchanges by query.
 * Now also searches by index names.
 */
export function searchExchanges(
  options: ExchangeOption[],
  query: string
): ExchangeOption[] {
  if (!query.trim()) return options;

  const q = query.toLowerCase().trim();
  
  return options.filter(
    (opt) =>
      opt.label.toLowerCase().includes(q) ||
      opt.city.toLowerCase().includes(q) ||
      opt.country.toLowerCase().includes(q) ||
      opt.availableIndices.some((idx) => idx.indexName.toLowerCase().includes(q))
  );
}

// ============================================================================
// SELECTION HELPERS
// ============================================================================

/**
 * Get exchange objects by their IDs.
 */
export function getExchangesByIds(
  allExchanges: ExchangeOption[],
  selectedIds: string[]
): ExchangeOption[] {
  // Preserve order of selectedIds
  const result: ExchangeOption[] = [];
  for (const id of selectedIds) {
    const exchange = allExchanges.find((ex) => ex.id === id);
    if (exchange) {
      result.push(exchange);
    }
  }
  return result;
}

/**
 * Validate exchange selection against limits.
 */
export function validateSelection(
  selected: string[],
  min: number,
  max: number
): { valid: boolean; message?: string } {
  if (selected.length < min) {
    return {
      valid: false,
      message: `Select at least ${min} exchange${min === 1 ? '' : 's'}`,
    };
  }

  if (selected.length > max) {
    return {
      valid: false,
      message: `Maximum ${max} exchanges allowed`,
    };
  }

  return { valid: true };
}

/**
 * Count exchanges with multiple indices in selection.
 */
export function countMultiIndexExchanges(
  allExchanges: ExchangeOption[],
  selectedIds: string[]
): number {
  return selectedIds.filter((id) => {
    const ex = allExchanges.find((e) => e.id === id);
    return ex?.hasMultipleIndices ?? false;
  }).length;
}
