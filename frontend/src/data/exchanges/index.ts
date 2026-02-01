// src/data/exchanges/index.ts
// ============================================================================
// Exchange Data Module - Entry Point
// ============================================================================
// Exports the canonical Exchange type, catalog data, and Zod schemas.
// This is the SSOT for all exchange type definitions in Promagen.
// ============================================================================

import catalog from './exchanges.catalog.json';

// Re-export all types from the canonical types file
export type {
  Exchange,
  ExchangeStatus,
  ExchangeRegion,
  Hemisphere,
  MarketstackConfig,
} from './types';

// Re-export the type guard
export { isExchange } from './types';

// Re-export Zod schemas for runtime validation
export {
  ExchangeSchema,
  ExchangeCatalogSchema,
  ExchangeSelectedSchema,
  MarketstackConfigSchema,
  HemisphereSchema,
  IndexQuoteResponseSchema,
  IndicesResponseSchema,
} from './exchanges.schema';

// Re-export schema-derived types
export type {
  ExchangeFromSchema,
  ExchangeCatalog,
  ExchangeSelected,
  IndexQuoteResponse,
  IndicesResponse,
} from './exchanges.schema';

// Type assertion for the catalog JSON
import type { Exchange } from './types';

/**
 * Canonical list of stock exchanges for Promagen.
 * Data source: ./exchanges.catalog.json
 *
 * This is the SSOT for exchange data. All components and utilities
 * should import exchanges from here rather than loading the JSON directly.
 *
 * Each exchange includes:
 * - Geographic/timezone data for clock display
 * - Market hours template reference
 * - Marketstack config for index data (benchmark key + display name)
 * - Unique hover color for UI highlighting
 */
const EXCHANGES: Exchange[] = catalog as Exchange[];

export default EXCHANGES;

/**
 * Total count of exchanges in the catalog.
 * Useful for analytics and validation.
 */
export const EXCHANGE_COUNT = EXCHANGES.length;

/**
 * Get exchange by ID.
 * @returns Exchange or undefined if not found
 */
export function getExchangeById(id: string): Exchange | undefined {
  return EXCHANGES.find((e) => e.id === id);
}

/**
 * Get all benchmark keys for Marketstack API.
 * Used by gateway to validate benchmark requests.
 * Now collects all available indices (not just defaults) for Pro Promagen.
 */
export function getAllBenchmarks(): string[] {
  return EXCHANGES.flatMap((e) => 
    e.marketstack.availableIndices.map((idx) => idx.benchmark)
  );
}

/**
 * Get unique benchmark keys (some exchanges may share the same index).
 */
export function getUniqueBenchmarks(): string[] {
  return [...new Set(getAllBenchmarks())];
}
