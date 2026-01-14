/**
 * Promagen Gateway - Marketstack Provider Index
 * ===============================================
 * Central export point for all Marketstack feed handlers.
 *
 * GUARDRAIL G2: server.ts imports from here, making this the
 * single place to see all Marketstack feeds at a glance.
 *
 * @module marketstack
 */

// =============================================================================
// FEED HANDLERS
// =============================================================================

/**
 * Indices feed handler.
 * - Provider: Marketstack
 * - Schedule: :05 and :35 (clock-aligned)
 * - Budget: Separate 250/day
 */
export { indicesHandler, validateIndicesSelection } from './indices.js';

// =============================================================================
// INFRASTRUCTURE
// =============================================================================

/**
 * Marketstack budget manager.
 * SEPARATE from TwelveData - only Indices uses this.
 */
export {
  marketstackBudget,
  getMarketstackBudget,
  resetMarketstackBudget,
} from './budget.js';

/**
 * Clock-aligned scheduler for Indices.
 * :05 and :35, staggered from TwelveData feeds.
 */
export {
  indicesScheduler,
  createMarketstackScheduler,
  getNextRefreshDescription,
  type MarketstackFeed,
} from './scheduler.js';

/**
 * Marketstack API adapter.
 * Low-level fetch and parse functions.
 */
export {
  fetchMarketstackIndices,
  parseMarketstackResponse,
  BENCHMARK_TO_MARKETSTACK,
  MARKETSTACK_TO_BENCHMARK,
  getMarketstackApiKey,
  hasMarketstackApiKey,
  hasMarketstackMapping,
  getMarketstackSymbol,
  type ParsedIndexData,
} from './adapter.js';
