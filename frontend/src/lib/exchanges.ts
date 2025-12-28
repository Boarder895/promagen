// frontend/src/lib/exchanges.ts
// ============================================================================
// Exchange Utilities - Re-exports + Helper Functions
// ============================================================================
// This file re-exports the canonical Exchange type from @/data/exchanges
// and provides helper functions for exchange display.
//
// NOTE: The canonical Exchange type lives in src/data/exchanges/types.ts
// This file exists for backward compatibility and helper utilities.
// ============================================================================

// Re-export canonical types from SSOT location
export type { Exchange, ExchangeStatus, ExchangeRegion, Hemisphere } from '@/data/exchanges/types';

// Re-export type guard
export { isExchange } from '@/data/exchanges/types';

// Re-export the exchanges catalog
export { default as EXCHANGES } from '@/data/exchanges';

// ============================================================================
// Helper Functions
// ============================================================================

import type { Exchange } from '@/data/exchanges/types';

/**
 * Creates a compact display label for an exchange.
 * Format: "City · ID" or just "ID" if city is missing.
 *
 * @param exchange - The exchange to create a label for
 * @returns Formatted label string
 *
 * @example
 * ```ts
 * getExchangeShortLabel({ city: 'Tokyo', id: 'TSE', ... }) // "Tokyo · TSE"
 * getExchangeShortLabel({ city: '', id: 'UNKNOWN', ... })  // "UNKNOWN"
 * ```
 */
export function getExchangeShortLabel(exchange: Exchange): string {
  const city = exchange.city?.trim();
  if (city) {
    return `${city} · ${exchange.id}`;
  }
  return exchange.id;
}

/**
 * Gets the display name for an exchange.
 * Prefers the 'exchange' field, falls back to 'name' then 'id'.
 *
 * @param exchange - The exchange to get the name for
 * @returns Display name string
 */
export function getExchangeDisplayName(exchange: Exchange): string {
  return exchange.exchange || exchange.name || exchange.id;
}

/**
 * Gets the country code for an exchange.
 * Prefers 'iso2', falls back to 'countryCode'.
 *
 * @param exchange - The exchange to get the country code for
 * @returns ISO-3166 alpha-2 country code (uppercase)
 */
export function getExchangeCountryCode(exchange: Exchange): string {
  return (exchange.iso2 || exchange.countryCode || '').toUpperCase();
}
