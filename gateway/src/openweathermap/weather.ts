/**
 * Promagen Gateway - OpenWeatherMap Weather Handler
 * ===================================================
 * Main entry point for weather data fetching and caching.
 *
 * Security: 10/10
 * - Circuit breaker prevents cascading failures
 * - Budget tracking prevents overspend
 * - Stale-while-revalidate for resilience
 * - No synthetic/demo data
 *
 * Features:
 * - Clock-aligned scheduling (:10, :40)
 * - Batch alternation (A/B hourly)
 * - TTL caching (1 hour)
 * - Last-known-good fallback
 *
 * @module openweathermap/weather
 */

import { GenericCache } from '../lib/cache.js';
import { CircuitBreaker } from '../lib/circuit.js';
import { logInfo, logWarn, logDebug, logError } from '../lib/logging.js';

import { fetchWeatherBatch, validateCities, hasOpenWeatherMapApiKey } from './adapter.js';
import { openWeatherMapBudget, MAX_CITIES_PER_BATCH } from './budget.js';
import {
  weatherScheduler,
  getCurrentBatch,
  recordBatchRefresh,
  getBatchRefreshState,
} from './scheduler.js';
import type { CityInfo, WeatherData, WeatherGatewayResponse, BatchId } from './types.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Cache TTL in milliseconds (1 hour) */
const WEATHER_TTL_MS = 60 * 60 * 1000;

/** Cache key for all weather data */
const CACHE_KEY_ALL = 'weather:all';

// =============================================================================
// STATE
// =============================================================================

/** Weather data cache */
const cache = new GenericCache<WeatherData[]>(WEATHER_TTL_MS);

/** Circuit breaker for OpenWeatherMap */
const circuit = new CircuitBreaker({
  id: 'openweathermap',
  failureThreshold: 3,
  resetTimeoutMs: 30_000,
});

/** All cities (loaded from SSOT) */
let allCities: CityInfo[] = [];

/** Batch A cities (priority) */
let batchACities: CityInfo[] = [];

/** Batch B cities (remaining) */
let batchBCities: CityInfo[] = [];

/** Selected exchange IDs (from SSOT) */
let selectedExchangeIds: string[] = [];

/** Whether handler is initialized */
let isInitialized = false;

/** Background refresh timer */
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

/** Flag to track if we should continue refreshing */
let isRefreshing = false;

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize weather handler with cities from SSOT.
 *
 * @param cities - All exchange cities from catalog
 * @param selectedIds - Selected exchange IDs (priority for Batch A)
 */
export function initWeatherHandler(cities: CityInfo[], selectedIds: string[]): void {
  // Validate cities
  const { valid, invalid } = validateCities(cities);

  if (invalid.length > 0) {
    logWarn('Weather handler: invalid cities excluded', {
      invalidCount: invalid.length,
      totalCount: cities.length,
    });
  }

  allCities = valid;
  selectedExchangeIds = selectedIds;

  // Split into batches
  splitIntoBatches();

  isInitialized = true;

  logInfo('Weather handler initialized', {
    totalCities: allCities.length,
    batchACount: batchACities.length,
    batchBCount: batchBCities.length,
    selectedCount: selectedExchangeIds.length,
  });
}

/**
 * Split cities into Batch A (priority) and Batch B.
 * Batch A includes selected exchanges first, then fills to MAX_CITIES_PER_BATCH.
 * Batch B gets the next MAX_CITIES_PER_BATCH cities.
 * Cities beyond 2 × MAX_CITIES_PER_BATCH are excluded from weather fetching.
 *
 * IMPORTANT: Both batches are hard-capped at MAX_CITIES_PER_BATCH (24) to stay
 * within the OpenWeatherMap minute rate limit (60 calls/min).
 */
function splitIntoBatches(): void {
  const selectedSet = new Set(selectedExchangeIds.map((id) => id.toLowerCase()));
  const priority: CityInfo[] = [];
  const remaining: CityInfo[] = [];

  // Separate selected (priority) from remaining
  for (const city of allCities) {
    if (selectedSet.has(city.id.toLowerCase())) {
      priority.push(city);
    } else {
      remaining.push(city);
    }
  }

  // Build ordered list: priority cities first, then remaining
  const ordered = [...priority, ...remaining];

  // Cap each batch at MAX_CITIES_PER_BATCH (24)
  batchACities = ordered.slice(0, MAX_CITIES_PER_BATCH);
  batchBCities = ordered.slice(MAX_CITIES_PER_BATCH, MAX_CITIES_PER_BATCH * 2);

  const excluded = ordered.length - (batchACities.length + batchBCities.length);

  logDebug('Weather batches configured', {
    batchACount: batchACities.length,
    batchBCount: batchBCities.length,
    priorityCities: priority.length,
    totalCities: ordered.length,
    excluded,
  });

  if (excluded > 0) {
    logWarn('Weather: cities excluded (exceed 2 × MAX_CITIES_PER_BATCH)', {
      excluded,
      maxPerBatch: MAX_CITIES_PER_BATCH,
      maxTotal: MAX_CITIES_PER_BATCH * 2,
    });
  }
}

/**
 * Update selected exchanges and re-split batches.
 * Call when user changes their exchange selection.
 *
 * @param selectedIds - New selected exchange IDs
 */
export function updateSelectedExchanges(selectedIds: string[]): void {
  selectedExchangeIds = selectedIds;
  splitIntoBatches();

  logInfo('Weather handler: selections updated', {
    selectedCount: selectedIds.length,
    batchACount: batchACities.length,
    batchBCount: batchBCities.length,
  });
}

// =============================================================================
// DATA FETCHING
// =============================================================================

/**
 * Get weather data for all cities.
 *
 * Implements stale-while-revalidate:
 * 1. Return cached if fresh
 * 2. Return stale if circuit open or budget blocked
 * 3. Fetch fresh data
 * 4. Return stale on fetch failure
 * 5. Return empty if no data ever cached
 *
 * @returns Weather gateway response
 */
export async function getWeatherData(): Promise<WeatherGatewayResponse> {
  if (!isInitialized) {
    logWarn('Weather handler not initialized');
    return buildResponse('fallback', []);
  }

  // 1. Check fresh cache
  const cached = cache.get(CACHE_KEY_ALL);
  if (cached) {
    const entry = cache.getEntry(CACHE_KEY_ALL);
    return buildResponse('cached', cached, entry?.fetchedAt, entry?.expiresAt);
  }

  // 2. Check circuit breaker
  if (circuit.isOpen()) {
    logDebug('Weather: circuit open, returning stale');
    const stale = cache.getStale(CACHE_KEY_ALL);
    if (stale) {
      const entry = cache.getEntry(CACHE_KEY_ALL);
      return buildResponse('stale', stale, entry?.fetchedAt, entry?.expiresAt);
    }
    return buildResponse('fallback', []);
  }

  // 3. Check API key
  if (!hasOpenWeatherMapApiKey()) {
    logWarn('Weather: API key not configured');
    const stale = cache.getStale(CACHE_KEY_ALL);
    if (stale) {
      return buildResponse('stale', stale);
    }
    return buildResponse('fallback', []);
  }

  // 4. Check budget for current batch
  const currentBatch = getCurrentBatch();
  const batchCities = currentBatch === 'A' ? batchACities : batchBCities;
  const creditsNeeded = batchCities.length;

  // Guard: misconfiguration can leave us with 0 cities. Never treat that as "live".
  if (batchCities.length === 0) {
    logWarn('Weather: no cities configured for current batch', {
      batch: currentBatch,
    });
    const stale = cache.getStale(CACHE_KEY_ALL);
    if (stale) {
      return buildResponse('stale', stale);
    }
    return buildResponse('fallback', []);
  }

  if (!openWeatherMapBudget.canSpend(creditsNeeded)) {
    logDebug('Weather: budget blocked', {
      creditsNeeded,
      budget: openWeatherMapBudget.getState(),
    });
    const stale = cache.getStale(CACHE_KEY_ALL);
    if (stale) {
      return buildResponse('stale', stale);
    }
    return buildResponse('fallback', []);
  }

  // 5. Fetch current batch
  try {
    openWeatherMapBudget.spend(creditsNeeded);

    const batchData = await fetchWeatherBatch(batchCities, currentBatch);

    // Record success
    circuit.recordSuccess();
    recordBatchRefresh(currentBatch);

    // Merge with existing data for other batch
    const existingData = cache.getStale(CACHE_KEY_ALL) ?? [];
    const mergedData = mergeWeatherData(existingData, batchData, currentBatch);

    // Cache merged data
    cache.set(CACHE_KEY_ALL, mergedData);
    const entry = cache.getEntry(CACHE_KEY_ALL);

    logInfo('Weather data refreshed', {
      batch: currentBatch,
      fetchedCount: batchData.length,
      totalCount: mergedData.length,
    });

    return buildResponse('live', mergedData, entry?.fetchedAt, entry?.expiresAt);
  } catch (error) {
    // Record failure
    circuit.recordFailure();

    logError('Weather fetch failed', {
      batch: currentBatch,
      error: error instanceof Error ? error.message : String(error),
    });

    // Try stale data
    const stale = cache.getStale(CACHE_KEY_ALL);
    if (stale) {
      return buildResponse('stale', stale);
    }

    return buildResponse('fallback', []);
  }
}

/**
 * Get weather data for specific exchange IDs.
 *
 * @param exchangeIds - Exchange IDs to filter
 * @returns Filtered weather data
 */
export async function getWeatherForExchanges(
  exchangeIds: string[],
): Promise<WeatherGatewayResponse> {
  const response = await getWeatherData();

  // Filter to requested exchanges
  const idSet = new Set(exchangeIds.map((id) => id.toLowerCase()));
  const filteredData = response.data.filter((w) => idSet.has(w.id.toLowerCase()));

  return {
    ...response,
    data: filteredData,
  };
}

// =============================================================================
// DATA MERGING
// =============================================================================

/**
 * Merge new batch data with existing cached data.
 *
 * Strategy:
 * - Replace entries for cities in the new batch
 * - Keep entries for cities in the other batch
 *
 * @param existing - Existing weather data
 * @param newData - New batch data
 * @param batch - Which batch was fetched
 * @returns Merged weather data
 */
function mergeWeatherData(
  existing: readonly WeatherData[],
  newData: readonly WeatherData[],
  batch: BatchId,
): WeatherData[] {
  // Get IDs of cities in the fetched batch
  const batchCityIds = new Set(
    (batch === 'A' ? batchACities : batchBCities).map((c) => c.id.toLowerCase()),
  );

  // Create map of new data by ID
  const newDataMap = new Map<string, WeatherData>();
  for (const w of newData) {
    newDataMap.set(w.id.toLowerCase(), w);
  }

  // Build merged result
  const merged: WeatherData[] = [];
  const seenIds = new Set<string>();

  // Add all new data first
  for (const w of newData) {
    merged.push(w);
    seenIds.add(w.id.toLowerCase());
  }

  // Add existing data for cities NOT in the fetched batch
  for (const w of existing) {
    const lowerId = w.id.toLowerCase();
    if (!seenIds.has(lowerId) && !batchCityIds.has(lowerId)) {
      merged.push(w);
      seenIds.add(lowerId);
    }
  }

  return merged;
}

// =============================================================================
// RESPONSE BUILDING
// =============================================================================

/**
 * Build weather gateway response.
 */
function buildResponse(
  mode: 'live' | 'cached' | 'stale' | 'fallback',
  data: readonly WeatherData[],
  fetchedAt?: number,
  expiresAt?: number,
): WeatherGatewayResponse {
  const batchState = getBatchRefreshState();

  return {
    meta: {
      mode,
      cachedAt: fetchedAt ? new Date(fetchedAt).toISOString() : undefined,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      provider: 'openweathermap',
      currentBatch: getCurrentBatch(),
      batchARefreshedAt: batchState.batchARefreshedAt,
      batchBRefreshedAt: batchState.batchBRefreshedAt,
      budget: openWeatherMapBudget.getResponse(),
    },
    data: [...data],
  };
}

// =============================================================================
// BACKGROUND REFRESH
// =============================================================================

/**
 * Start background refresh loop (clock-aligned).
 */
export function startBackgroundRefresh(): void {
  if (isRefreshing) {
    logWarn('Weather background refresh already running');
    return;
  }

  isRefreshing = true;

  logInfo('Weather background refresh started', {
    slotMinutes: [...weatherScheduler.getSlotMinutes()],
    nextRefreshAt: weatherScheduler.getNextSlotTime().toISOString(),
  });

  // Schedule next refresh
  scheduleNextRefresh();
}

/**
 * Schedule the next background refresh.
 */
function scheduleNextRefresh(): void {
  if (!isRefreshing) return;

  const msUntilSlot = weatherScheduler.getMsUntilNextSlot();

  refreshTimer = setTimeout(() => {
    if (!isRefreshing) return;

    // Perform refresh
    refreshWeatherCache()
      .catch(() => {})
      .finally(() => {
        // Schedule next
        scheduleNextRefresh();
      });
  }, msUntilSlot);

  logDebug('Weather: next refresh scheduled', {
    msUntilSlot,
    nextRefreshAt: weatherScheduler.getNextSlotTime().toISOString(),
  });
}

/**
 * Refresh weather cache.
 */
async function refreshWeatherCache(): Promise<void> {
  // Skip until we have SSOT cities loaded.
  if (!isInitialized || allCities.length === 0) {
    logDebug('Weather refresh skipped (not initialised)');
    return;
  }

  // Skip if circuit is open
  if (circuit.isOpen()) {
    logDebug('Weather refresh skipped (circuit open)');
    return;
  }

  // Get current batch
  const currentBatch = getCurrentBatch();
  const batchCities = currentBatch === 'A' ? batchACities : batchBCities;

  // Skip if this batch has no cities (should not happen once initialised).
  if (batchCities.length === 0) {
    logDebug('Weather refresh skipped (no cities for batch)', {
      batch: currentBatch,
    });
    return;
  }

  // Skip if budget exhausted
  if (!openWeatherMapBudget.canSpend(batchCities.length)) {
    logDebug('Weather refresh skipped (budget)', {
      batch: currentBatch,
      needed: batchCities.length,
      budget: openWeatherMapBudget.getState(),
    });
    return;
  }

  // Skip if no API key
  if (!hasOpenWeatherMapApiKey()) {
    logDebug('Weather refresh skipped (no API key)');
    return;
  }

  try {
    openWeatherMapBudget.spend(batchCities.length);

    const batchData = await fetchWeatherBatch(batchCities, currentBatch);

    circuit.recordSuccess();
    recordBatchRefresh(currentBatch);

    // Merge with existing
    const existingData = cache.getStale(CACHE_KEY_ALL) ?? [];
    const mergedData = mergeWeatherData(existingData, batchData, currentBatch);

    cache.set(CACHE_KEY_ALL, mergedData);

    logInfo('Weather background refresh complete', {
      batch: currentBatch,
      fetchedCount: batchData.length,
      totalCount: mergedData.length,
    });
  } catch (error) {
    circuit.recordFailure();

    logWarn('Weather background refresh failed', {
      batch: currentBatch,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Stop background refresh loop.
 */
export function stopBackgroundRefresh(): void {
  isRefreshing = false;

  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
    logInfo('Weather background refresh stopped');
  }
}

// =============================================================================
// DIAGNOSTICS
// =============================================================================

/**
 * Get weather handler trace info for diagnostics.
 */
export function getWeatherTraceInfo(): {
  initialized: boolean;
  totalCities: number;
  batchACount: number;
  batchBCount: number;
  selectedCount: number;
  currentBatch: BatchId;
  cache: {
    hasData: boolean;
    dataCount: number;
    expiresAt: string | null;
  };
  circuit: ReturnType<CircuitBreaker['getState']>;
  budget: ReturnType<typeof openWeatherMapBudget.getState>;
  nextRefreshAt: string;
  batchRefreshState: ReturnType<typeof getBatchRefreshState>;
} {
  const cacheEntry = cache.getEntry(CACHE_KEY_ALL);
  const cachedData = cache.getStale(CACHE_KEY_ALL);

  return {
    initialized: isInitialized,
    totalCities: allCities.length,
    batchACount: batchACities.length,
    batchBCount: batchBCities.length,
    selectedCount: selectedExchangeIds.length,
    currentBatch: getCurrentBatch(),
    cache: {
      hasData: cachedData !== null,
      dataCount: cachedData?.length ?? 0,
      expiresAt: cacheEntry ? new Date(cacheEntry.expiresAt).toISOString() : null,
    },
    circuit: circuit.getState(),
    budget: openWeatherMapBudget.getState(),
    nextRefreshAt: weatherScheduler.getNextSlotTime().toISOString(),
    batchRefreshState: getBatchRefreshState(),
  };
}

/**
 * Reset weather handler (for testing only).
 */
export function resetWeatherHandler(): void {
  stopBackgroundRefresh();
  cache.clear();
  allCities = [];
  batchACities = [];
  batchBCities = [];
  selectedExchangeIds = [];
  isInitialized = false;
}
