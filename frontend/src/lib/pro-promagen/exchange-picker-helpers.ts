// src/lib/pro-promagen/exchange-picker-helpers.ts
// ============================================================================
// EXCHANGE PICKER DATA HELPERS (v3.0.0 — Index-Per-Row)
// ============================================================================
// Each index is its own selectable option. Multi-index exchanges produce
// multiple ExchangeOption entries, each with a compound key:
//   "exchangeId::benchmark"  (e.g. "cse-colombo::cse_all_share")
//
// Single-index exchanges also get compound keys for consistency.
//
// v3.0.0 (16 Mar 2026):
// - ExchangeOption now represents a single index, not an exchange
// - Compound selection keys: "exchangeId::benchmark"
// - Removed IndexPreferences/IndexSelector — selection IS the preference
// - City-vibe entries filtered out
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
// COMPOUND KEY HELPERS
// ============================================================================

const KEY_SEPARATOR = '::';

/**
 * Build a compound selection key from exchange ID and benchmark.
 * @example makeCompoundKey('cse-colombo', 'cse_all_share') → 'cse-colombo::cse_all_share'
 */
export function makeCompoundKey(exchangeId: string, benchmark: string): string {
  return `${exchangeId}${KEY_SEPARATOR}${benchmark}`;
}

/**
 * Parse a compound selection key back to its parts.
 * @example parseCompoundKey('cse-colombo::cse_all_share') → { exchangeId: 'cse-colombo', benchmark: 'cse_all_share' }
 */
export function parseCompoundKey(key: string): { exchangeId: string; benchmark: string } {
  const idx = key.indexOf(KEY_SEPARATOR);
  if (idx === -1) {
    // Legacy simple key — treat entire string as exchangeId with empty benchmark
    return { exchangeId: key, benchmark: '' };
  }
  return {
    exchangeId: key.substring(0, idx),
    benchmark: key.substring(idx + KEY_SEPARATOR.length),
  };
}

/**
 * Convert an array of simple exchange IDs to compound keys using default benchmarks.
 * Used to migrate SSOT defaults and legacy localStorage values.
 * Already-compound keys pass through unchanged.
 */
export function simpleIdsToCompoundKeys(
  ids: string[],
  catalog: ExchangeCatalogEntry[],
): string[] {
  if (!Array.isArray(ids) || !Array.isArray(catalog)) return [];

  return ids.map((id) => {
    // Already compound?
    if (id.includes(KEY_SEPARATOR)) return id;

    const entry = catalog.find((e) => e.id === id);
    if (!entry) return id; // Unknown — pass through, will be filtered later

    const ms = entry.marketstack;
    let benchmark = '';
    if (ms) {
      benchmark = isMultiIndexConfig(ms) ? ms.defaultBenchmark : ms.benchmark;
    }
    return benchmark ? makeCompoundKey(id, benchmark) : id;
  });
}

/**
 * Extract unique exchange IDs from an array of compound keys.
 * Used when the API needs plain exchange IDs (e.g. weather, indices).
 */
export function compoundKeysToExchangeIds(keys: string[]): string[] {
  if (!Array.isArray(keys)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const key of keys) {
    const { exchangeId } = parseCompoundKey(key);
    if (!seen.has(exchangeId)) {
      seen.add(exchangeId);
      result.push(exchangeId);
    }
  }
  return result;
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * A single selectable option in the picker.
 * Each option represents ONE index of ONE exchange.
 * Multi-index exchanges produce multiple ExchangeOption entries.
 */
export interface ExchangeOption {
  /** Compound selection key: "exchangeId::benchmark" */
  id: string;
  /** Base exchange ID from catalog (e.g. "cse-colombo") */
  exchangeId: string;
  /** Short display label for the exchange (e.g., "CSE") */
  label: string;
  /** Full exchange name for search (e.g., "Colombo Stock Exchange (CSE)") */
  fullName: string;
  /** The specific benchmark for this option */
  benchmark: string;
  /** Human-readable index name (e.g., "CSE All Share") */
  indexName: string;
  /** City name */
  city: string;
  /** Country name */
  country: string;
  /** ISO 2-letter country code for flag */
  iso2: string;
  /** Continent grouping */
  continent: Continent;
}

/**
 * Legacy re-export for backward compatibility.
 * @deprecated Use compound keys instead of ExchangeSelection
 */
export interface ExchangeSelection {
  exchangeId: string;
  benchmark?: string;
}

/**
 * @deprecated Use compound keys — IndexPreferences map is no longer needed
 */
export type IndexPreferences = Map<string, string>;

// ============================================================================
// TRANSFORM FUNCTIONS
// ============================================================================

/**
 * Transform a single exchange catalog entry into ExchangeOption(s).
 * Returns one option per available index. Single-index exchanges produce one option.
 */
export function toExchangeOptions(entry: ExchangeCatalogEntry): ExchangeOption[] {
  const label = entry.name || entry.exchange;
  const fullName = entry.exchange;

  const ms = entry.marketstack;

  interface IndexInfo {
    benchmark: string;
    indexName: string;
  }

  let indices: IndexInfo[];

  if (!ms) {
    indices = [{ benchmark: '', indexName: '' }];
  } else if (isMultiIndexConfig(ms)) {
    indices = ms.availableIndices;
  } else {
    indices = [{ benchmark: ms.benchmark, indexName: ms.indexName }];
  }

  const continent = getContinent(entry.iso2);

  return indices.map((idx) => ({
    id: idx.benchmark ? makeCompoundKey(entry.id, idx.benchmark) : entry.id,
    exchangeId: entry.id,
    label,
    fullName,
    benchmark: idx.benchmark,
    indexName: idx.indexName,
    city: entry.city,
    country: entry.country,
    iso2: entry.iso2,
    continent,
  }));
}

/**
 * Transform the full exchange catalog into picker options.
 * Each index of each exchange becomes its own option.
 * City-vibe entries are excluded.
 */
export function catalogToPickerOptions(catalog: ExchangeCatalogEntry[]): ExchangeOption[] {
  if (!Array.isArray(catalog)) return [];

  return catalog
    .filter((entry) => !entry.id.startsWith('city-vibe-'))
    .flatMap(toExchangeOptions)
    .sort((a, b) => {
      // Primary: exchange label
      const labelCmp = a.label.localeCompare(b.label);
      if (labelCmp !== 0) return labelCmp;
      // Secondary: index name (keeps same-exchange indices together)
      return a.indexName.localeCompare(b.indexName);
    });
}

// ============================================================================
// FILTER & GROUP FUNCTIONS
// ============================================================================

/**
 * Get exchange options grouped by continent.
 */
export function groupByContinent(
  options: ExchangeOption[],
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

  if (!Array.isArray(options)) return groups;

  for (const option of options) {
    if (!option) continue;
    const list = groups.get(option.continent);
    if (list) {
      list.push(option);
    }
  }

  for (const [, list] of groups) {
    list.sort((a, b) => {
      const labelCmp = a.label.localeCompare(b.label);
      if (labelCmp !== 0) return labelCmp;
      return a.indexName.localeCompare(b.indexName);
    });
  }

  return groups;
}

/**
 * Search options by query.
 * Searches label, fullName, indexName, city, country.
 */
export function searchExchanges(
  options: ExchangeOption[],
  query: string,
): ExchangeOption[] {
  if (!Array.isArray(options)) return [];
  if (!query.trim()) return options;

  const q = query.toLowerCase().trim();

  return options.filter(
    (opt) =>
      opt.label.toLowerCase().includes(q) ||
      opt.fullName.toLowerCase().includes(q) ||
      opt.indexName.toLowerCase().includes(q) ||
      opt.city.toLowerCase().includes(q) ||
      opt.country.toLowerCase().includes(q),
  );
}

// ============================================================================
// SELECTION HELPERS
// ============================================================================

/**
 * Get exchange option objects by their compound IDs.
 */
export function getExchangesByIds(
  allExchanges: ExchangeOption[],
  selectedIds: string[],
): ExchangeOption[] {
  if (!Array.isArray(allExchanges) || !Array.isArray(selectedIds)) return [];
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
 * Validate selection against limits.
 */
export function validateSelection(
  selected: string[],
  min: number,
  max: number,
): { valid: boolean; message?: string } {
  if (!Array.isArray(selected)) {
    return {
      valid: min <= 0,
      message: min > 0 ? `Select at least ${min} index${min === 1 ? '' : ' views'}` : undefined,
    };
  }
  if (selected.length < min) {
    return {
      valid: false,
      message: `Select at least ${min} index${min === 1 ? '' : ' views'}`,
    };
  }

  if (selected.length > max) {
    return {
      valid: false,
      message: `Maximum ${max} index views allowed`,
    };
  }

  return { valid: true };
}
