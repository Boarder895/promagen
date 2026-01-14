/**
 * Promagen Gateway - TwelveData Provider Index
 * ==============================================
 * Central export point for all TwelveData feed handlers.
 *
 * GUARDRAIL G2: server.ts imports from here, making this the
 * single place to see all TwelveData feeds at a glance.
 *
 * @module twelvedata
 */

// =============================================================================
// FEED HANDLERS
// =============================================================================

/**
 * FX feed handler.
 * - Provider: TwelveData
 * - Schedule: :00 and :30 (clock-aligned)
 * - Budget: Shared 800/day
 */
export { fxHandler, validateFxSelection } from './fx.js';

/**
 * Crypto feed handler.
 * - Provider: TwelveData
 * - Schedule: :20 and :50 (clock-aligned)
 * - Budget: Shared 800/day
 */
export { cryptoHandler } from './crypto.js';

// =============================================================================
// SHARED INFRASTRUCTURE
// =============================================================================

/**
 * Shared TwelveData budget manager.
 * Used by both FX and Crypto handlers.
 */
export {
  twelveDataBudget,
  getTwelveDataBudget,
  resetTwelveDataBudget,
} from './budget.js';

/**
 * Clock-aligned schedulers.
 * Ensure FX and Crypto never refresh simultaneously.
 */
export {
  fxScheduler,
  cryptoScheduler,
  createTwelveDataScheduler,
  getNextRefreshDescription,
  type TwelveDataFeed,
} from './scheduler.js';

/**
 * TwelveData API adapter.
 * Low-level fetch and parse functions.
 */
export {
  fetchTwelveDataPrices,
  parseFxPriceResponse,
  parseCryptoPriceResponse,
  buildFxSymbol,
  buildCryptoSymbol,
  getTwelveDataApiKey,
  hasTwelveDataApiKey,
} from './adapter.js';
