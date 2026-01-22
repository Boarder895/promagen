/**
 * Promagen Gateway - OpenWeatherMap Module
 * ==========================================
 * Weather data feed for exchange cities.
 *
 * Provider: OpenWeatherMap (api.openweathermap.org)
 * Budget: 1,000 calls/day, 60 calls/minute (free tier)
 * Schedule: :10 and :40 (offset from other feeds)
 * Batching: 24 cities per batch, alternating hourly
 *
 * @module openweathermap
 */

// =============================================================================
// TYPES
// =============================================================================

export type {
  CityInfo,
  WeatherBatches,
  BatchId,
  OWMCurrentWeatherResponse,
  OWMWeatherCondition,
  OWMMainData,
  OWMWindData,
  OWMCloudsData,
  OWMSysData,
  WeatherData,
  WeatherResponseMeta,
  WeatherGatewayResponse,
} from './types.js';

export {
  isValidLatitude,
  isValidLongitude,
  isOWMResponse,
  CONDITION_TO_EMOJI,
  DEFAULT_EMOJI,
  CONDITION_TO_ATMOSPHERE,
} from './types.js';

// =============================================================================
// BUDGET
// =============================================================================

export {
  openWeatherMapBudget,
  getOpenWeatherMapBudget,
  resetOpenWeatherMapBudget,
  getBudgetHeadroom,
  EXPECTED_DAILY_USAGE,
  MAX_CITIES_PER_BATCH,
} from './budget.js';

// =============================================================================
// SCHEDULER
// =============================================================================

export {
  weatherScheduler,
  getCurrentBatch,
  getBatchForTime,
  getNextBatchRefreshTime,
  getNextRefreshDescription,
  isCurrentSlotForBatch,
  getMsUntilBatchRefresh,
  recordBatchRefresh,
  getBatchLastRefresh,
  getBatchRefreshState,
  resetBatchState,
} from './scheduler.js';

// =============================================================================
// ADAPTER
// =============================================================================

export {
  getOpenWeatherMapApiKey,
  hasOpenWeatherMapApiKey,
  fetchWeatherForCity,
  fetchWeatherWithRetry,
  parseWeatherResponse,
  fetchWeatherBatch,
  validateCities,
  OWM_BASE_URL,
  REQUEST_TIMEOUT_MS,
  MAX_RETRIES,
} from './adapter.js';

// =============================================================================
// WEATHER HANDLER
// =============================================================================

export {
  initWeatherHandler,
  updateSelectedExchanges,
  getWeatherData,
  getWeatherForExchanges,
  startBackgroundRefresh,
  stopBackgroundRefresh,
  getWeatherTraceInfo,
  resetWeatherHandler,
} from './weather.js';
