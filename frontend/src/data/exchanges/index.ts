// frontend/src/data/exchanges/index.ts
// ============================================================================
// Exchange Data Module - Entry Point
// ============================================================================
// Exports the canonical Exchange type and catalog data.
// This is the SSOT for all exchange type definitions in Promagen.
// ============================================================================

import catalog from './exchanges.catalog.json';

// Re-export all types from the canonical types file
export type {
  Exchange,
  ExchangeStatus,
  ExchangeRegion,
  Hemisphere,
} from './types';

// Re-export the type guard
export { isExchange } from './types';

// Type assertion for the catalog JSON
import type { Exchange } from './types';

/**
 * Canonical list of stock exchanges for Promagen.
 * Data source: ./exchanges.catalog.json
 *
 * This is the SSOT for exchange data. All components and utilities
 * should import exchanges from here rather than loading the JSON directly.
 */
const EXCHANGES: Exchange[] = catalog as Exchange[];

export default EXCHANGES;
