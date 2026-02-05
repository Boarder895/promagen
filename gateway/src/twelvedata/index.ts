/**
 * Promagen Gateway - TwelveData Provider Index
 * ==============================================
 * Central export point for the TwelveData FX feed handler.
 *
 * GUARDRAIL G2: server.ts imports from here, making this the
 * single place to see all TwelveData feeds at a glance.
 *
 * v3.1: Both Rows Always Populated
 * - Startup: Top row fetches immediately, bottom row after 1 minute
 * - After startup: Rows alternate hourly
 * - Both rows ALWAYS have data (fixes previous bug)
 *
 * ROW ALTERNATION SCHEDULE:
 * - T+0: Top row (EUR/USD, GBP/USD, GBP/ZAR, USD/CAD, USD/CNY)
 * - T+1min: Bottom row (USD/INR, USD/BRL, USD/AUD, USD/NOK, USD/MYR)
 * - T+1hr: Top row refreshes
 * - T+2hr: Bottom row refreshes
 * - Continues alternating hourly...
 *
 * @module twelvedata
 */

// =============================================================================
// FEED HANDLERS
// =============================================================================

/**
 * FX feed handler.
 * - Provider: TwelveData
 * - Schedule: Startup + hourly alternation
 * - Budget: 800/day (~120 used by FX)
 * - Top row: EUR/USD, GBP/USD, GBP/ZAR, USD/CAD, USD/CNY
 * - Bottom row: USD/INR, USD/BRL, USD/AUD, USD/NOK, USD/MYR
 */
export {
  fxHandler,
  validateFxSelection,
  getFxTraceInfoWithRows,
  // Row cache access
  getAllCachedQuotes,
  getCachedRowQuotes,
  areBothRowsPopulated,
  getRowCacheStatus,
  updateRowCache,
  // Startup helpers
  shouldFetchSecondRow,
  getMsUntilSecondRow,
} from './fx.js';

// =============================================================================
// SHARED INFRASTRUCTURE
// =============================================================================

/**
 * Shared TwelveData budget manager.
 */
export {
  twelveDataBudget,
  getTwelveDataBudget,
  resetTwelveDataBudget,
} from './budget.js';

/**
 * Clock-aligned scheduler for FX.
 */
export {
  fxScheduler,
  createTwelveDataScheduler,
  getNextRefreshDescription,
  // Row alternation exports
  getCurrentFxRow,
  getNextFxRow,
  getFxRowIndices,
  getFxRowState,
  recordFxRowRefresh,
  resetFxRowState,
  // Startup exports
  isStartupComplete,
  getMsUntilSecondRowFetch,
  type TwelveDataFeed,
  type FxRow,
} from './scheduler.js';

/**
 * TwelveData API adapter.
 * Low-level fetch and parse functions.
 */
export {
  fetchTwelveDataPrices,
  parseFxPriceResponse,
  buildFxSymbol,
  getTwelveDataApiKey,
  hasTwelveDataApiKey,
} from './adapter.js';
