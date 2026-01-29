// src/lib/pro-promagen/exchange-picker-helpers.ts
// ============================================================================
// EXCHANGE PICKER DATA HELPERS
// ============================================================================
// Transforms exchange catalog data into the format needed by ExchangePicker.
//
// FIXED: Removed duplicate ExchangeCatalogEntry (now imported from types.ts)
// FIXED: Removed unused idSet variable in getExchangesByIds
// FIXED: ExchangeOption type defined here to avoid circular import
//
// Authority: docs/authority/paid_tier.md §5.3
// ============================================================================

import { getContinent, type Continent } from '@/lib/geo/continents';
import {
  PRO_SELECTION_LIMITS,
  type ExchangeCatalogEntry,
} from '@/lib/pro-promagen/types';

// Re-export for consumers
export { PRO_SELECTION_LIMITS };

// ============================================================================
// TYPES
// ============================================================================

/**
 * Exchange option for the picker component.
 * Defined here to avoid circular import with exchange-picker.tsx
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
}

// ============================================================================
// FIX NOTE: ExchangeCatalogEntry REMOVED from here
// ============================================================================
// The ExchangeCatalogEntry interface was duplicated here AND in types.ts.
// This caused TS2300: "Module has already exported a member named 'ExchangeCatalogEntry'"
// when index.ts did `export * from './types'` and `export * from './exchange-picker-helpers'`
//
// SOLUTION: Import ExchangeCatalogEntry from types.ts (see import above)
// ============================================================================

// ============================================================================
// TRANSFORM FUNCTIONS
// ============================================================================

/**
 * Transform a single exchange catalog entry into an ExchangeOption for the picker.
 */
export function toExchangeOption(entry: ExchangeCatalogEntry): ExchangeOption {
  const abbrevMatch = entry.exchange.match(/\(([^)]+)\)/);
  const abbrev = abbrevMatch ? abbrevMatch[1] : null;
  // Construct label from abbreviation + city, or fall back to exchange name
  const label = abbrev ? `${abbrev} ${entry.city}` : entry.exchange;

  return {
    id: entry.id,
    label,
    city: entry.city,
    country: entry.country,
    iso2: entry.iso2,
    continent: getContinent(entry.iso2),
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
      opt.country.toLowerCase().includes(q)
  );
}

// ============================================================================
// SELECTION HELPERS
// ============================================================================

/**
 * Get exchange objects by their IDs.
 * 
 * FIX NOTE: Removed unused `idSet` variable that was causing ESLint error:
 * "'idSet' is assigned a value but never used"
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
