// frontend/src/data/exchanges/index.ts

import catalog from './exchanges.catalog.json';
export type { Exchange } from './types';

/**
 * Canonical list of stock exchanges for Promagen.
 * Data source: ./exchanges.catalog.json
 */
const EXCHANGES = catalog;

export default EXCHANGES;
