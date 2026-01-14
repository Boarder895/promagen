/**
 * Promagen Gateway - Library Exports
 * ====================================
 * Barrel export for all shared library modules.
 *
 * @module lib
 */

// Types
export type {
  // Branded types
  FxPairId,
  CommodityId,
  CryptoId,
  ExchangeId,
  BenchmarkKey,

  // State types
  BudgetState,
  CircuitState,
  DataMode,
  TickDirection,
  UserTier,
  SsotSource,
  FeedId,
  ProviderId,

  // Budget
  BudgetSnapshot,
  BudgetResponse,

  // Circuit
  CircuitSnapshot,

  // Cache
  CacheEntry,
  CacheStats,

  // FX
  FxPair,
  FxQuote,
  FxSelectionRequest,
  FxSelectionValidation,

  // Commodities
  CommodityGroup,
  CommodityCatalogItem,
  CommodityQuote,
  CommoditiesSelectionRequest,
  CommoditiesSelectionValidation,

  // Crypto
  CryptoCatalogItem,
  CryptoQuote,

  // Indices
  IndexCatalogItem,
  IndexQuote,
  IndicesSelectionRequest,
  IndicesSelectionValidation,

  // Gateway responses
  BaseResponseMeta,
  FxGatewayResponse,
  CommoditiesGatewayResponse,
  CryptoGatewayResponse,
  IndicesGatewayResponse,
  GatewayResponse,

  // Feed handler
  FeedConfig,
  FeedTraceInfo,
  FeedHandler,

  // HTTP
  RateLimitInfo,
  CorsConfig,
} from './types.js';

// Type guards
export {
  isNonNull,
  isString,
  isNumber,
  isArray,
  isObject,
  SELECTION_LIMITS,
  DEFAULT_TTL,
  DEFAULT_BUDGET,
} from './types.js';

// Logging
export {
  log,
  logDebug,
  logInfo,
  logWarn,
  logError,
  startTimer,
  withTiming,
  logRequest,
  logResponse,
  logStartup,
  logFeedInit,
} from './logging.js';

// Cache
export { GenericCache, createCache, createFeedCaches } from './cache.js';

// Budget
export {
  BudgetManager,
  createTwelveDataBudget,
  createMarketstackBudget,
  createNoBudget,
} from './budget.js';

// Shared budget managers (CRITICAL for correct API usage)
export {
  resetSharedBudgets,
  getSharedBudget,
} from './shared-budgets.js';

// Circuit breaker
export {
  CircuitBreaker,
  createCircuitBreaker,
  createProviderCircuits,
} from './circuit.js';

// Request deduplication
export {
  RequestDeduplicator,
  createDeduplicator,
  ApiDeduplicator,
  createApiDeduplicator,
} from './dedup.js';

// Feed handler factory
export { createFeedHandler } from './feed-handler.js';
