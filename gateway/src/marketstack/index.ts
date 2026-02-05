/**
 * Promagen Gateway - Marketstack Provider Index
 * ===============================================
 * Central export point for all Marketstack feed handlers.
 *
 * GUARDRAIL G2: server.ts imports from here, making this the
 * single place to see all Marketstack feeds at a glance.
 *
 * Feeds:
 * - Indices: Clock-aligned scheduler (:05, :20, :35, :50), batched
 * - Commodities: Rolling scheduler (every 2 min), 1 per call
 *
 * @module marketstack
 */

// =============================================================================
// FEED HANDLERS
// =============================================================================

/**
 * Indices feed handler.
 * - Provider: Marketstack v1 EOD
 * - Schedule: :05, :20, :35, :50 (clock-aligned, every 15 min)
 * - Budget: Shared Marketstack pool via shared-budgets.ts
 */
export { indicesHandler, validateIndicesSelection } from './indices.js';

/**
 * Commodities feed handler.
 * - Provider: Marketstack v2 Commodities
 * - Schedule: Rolling, every 2 minutes (1 commodity per call)
 * - Budget: SEPARATE tracker (commodities-budget.ts)
 * - Cache: Per-commodity, 2-hour TTL
 */
export { commoditiesHandler, validateCommoditiesSelection } from './commodities.js';

// =============================================================================
// INFRASTRUCTURE - INDICES
// =============================================================================

/**
 * Marketstack budget manager (shared pool for indices).
 * SEPARATE from TwelveData and from commodities.
 */
export {
  marketstackBudget,
  getMarketstackBudget,
  resetMarketstackBudget,
} from './budget.js';

/**
 * Clock-aligned scheduler for Indices.
 * :05, :20, :35, :50 — staggered from TwelveData feeds.
 */
export {
  indicesScheduler,
  createMarketstackScheduler,
  getNextRefreshDescription,
  type MarketstackFeed,
} from './scheduler.js';

/**
 * Marketstack API adapter (indices — v1 EOD).
 * Batch fetch and parse for index symbols.
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

// =============================================================================
// INFRASTRUCTURE - COMMODITIES
// =============================================================================

/**
 * Commodities budget manager (separate tracker).
 * Visible independently from indices in /trace.
 */
export {
  commoditiesBudget,
  getCommoditiesBudget,
  resetCommoditiesBudget,
} from './commodities-budget.js';

/**
 * Commodities rolling scheduler factory.
 * Creates a 2-minute rolling refresh with priority queue.
 */
export {
  createCommoditiesRollingScheduler,
  type CommoditiesRollingScheduler,
  type CommoditiesSchedulerTrace,
  type RollingFetchCallback,
} from './commodities-scheduler.js';

/**
 * Commodities API adapter (v2 commodities endpoint).
 * Single-commodity fetch and parse.
 */
export {
  fetchSingleCommodity,
  catalogIdToMarketstackName,
  marketstackNameToCatalogId,
  getMarketstackApiKeyForCommodities,
  hasMarketstackApiKeyForCommodities,
  type ParsedCommodityData,
} from './commodities-adapter.js';
