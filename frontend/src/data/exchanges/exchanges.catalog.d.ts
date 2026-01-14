// src/data/exchanges/exchanges.catalog.d.ts
// ============================================================================
// TYPE DECLARATION FOR EXCHANGES CATALOG JSON
// ============================================================================
// Auto-generated type declaration for exchanges.catalog.json.
// Provides TypeScript intellisense for catalog imports.
// ============================================================================

import type { Exchange } from './types';

/**
 * Typed array of all exchanges in the catalog.
 * Import directly for full type safety:
 *
 * @example
 * ```ts
 * import catalog from './exchanges.catalog.json';
 * const tokyo = catalog.find(e => e.id === 'tse-tokyo');
 * console.log(tokyo?.marketstack.indexName); // "Nikkei 225"
 * ```
 */
declare const catalog: Exchange[];
export default catalog;
