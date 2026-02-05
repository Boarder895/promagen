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
 * Features (v3.0.0):
 * - Clock-aligned scheduling (:10 only, dropped :40)
 * - 4-batch rotation (A/B/C/D via hour % 4)
 * - Coordinate deduplication (89 exchanges → 83 API calls)
 * - Selected 16 exchanges guaranteed in Batch A
 * - TTL caching (1 hour)
 * - Last-known-good fallback
 * - Results expanded back to all 89 exchange IDs after fetch
 *
 * Existing features preserved: Yes
 *
 * @module openweathermap/weather
 */

import { GenericCache } from '../lib/cache.js';
import { CircuitBreaker } from '../lib/circuit.js';
import { logInfo, logWarn, logDebug, logError } from '../lib/logging.js';

import { fetchWeatherBatch, validateCities, hasOpenWeatherMapApiKey } from './adapter.js';
import { openWeatherMapBudget, MAX_CITIES_PER_BATCH, NUM_BATCHES } from './budget.js';
import {
  weatherScheduler,
  getCurrentBatch,
  recordBatchRefresh,
  getBatchRefreshState,
} from './scheduler.js';
import type {
  CityInfo,
  WeatherData,
  WeatherGatewayResponse,
  BatchId,
  CoordGroup,
} from './types.js';
// ALL_BATCH_IDS removed — only used in scheduler.ts

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

/** All cities from SSOT (89 entries, including coordinate duplicates) */
let allCities: CityInfo[] = [];

/**
 * Coordinate groups: coordKey → CoordGroup.
 * Maps unique lat/lon to a representative city + all exchange IDs at that location.
 * Mumbai (4 IDs → 1 API call), Moscow (2→1), Zurich (2→1), Frankfurt (2→1).
 */
const coordGroups: Map<string, CoordGroup> = new Map();

/**
 * Reverse lookup: exchange ID (lowercase) → coordKey.
 * Used to find which coordinate group an exchange belongs to.
 */
const idToCoordKey: Map<string, string> = new Map();

/**
 * Batch arrays of REPRESENTATIVE cities (the ones we actually call the API for).
 * batchCities['A'] contains ~21 representative CityInfo objects.
 */
let batchCities: Record<BatchId, CityInfo[]> = { A: [], B: [], C: [], D: [] };

/** Selected exchange IDs (from SSOT — the 16 homepage defaults) */
let selectedExchangeIds: string[] = [];

/** Whether handler is initialized */
let isInitialized = false;

/** Background refresh timer */
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

/** Flag to track if we should continue refreshing */
let isRefreshing = false;

// =============================================================================
// COORDINATE DEDUPLICATION (v3.0.0)
// =============================================================================

/**
 * Generate a coordinate key for deduplication.
 * Uses 4 decimal places (~11m precision — more than enough for city-level).
 */
function coordKey(city: CityInfo): string {
  return `${city.lat.toFixed(4)},${city.lon.toFixed(4)}`;
}

/**
 * Build coordinate groups from all cities.
 * Groups exchanges at identical lat/lon, picking the selected exchange
 * (if any) as the representative for API calls.
 */
function buildCoordGroups(): void {
  coordGroups.clear();
  idToCoordKey.clear();

  const selectedSet = new Set(selectedExchangeIds.map((id) => id.toLowerCase()));

  for (const city of allCities) {
    const key = coordKey(city);
    const existing = coordGroups.get(key);

    if (existing) {
      // Add this exchange ID to the existing group
      existing.allIds.push(city.id);

      // Prefer a selected exchange as the representative (for Batch A sorting)
      if (
        selectedSet.has(city.id.toLowerCase()) &&
        !selectedSet.has(existing.representative.id.toLowerCase())
      ) {
        existing.representative = city;
      }
    } else {
      // First city at this coordinate — becomes the representative
      coordGroups.set(key, {
        representative: city,
        allIds: [city.id],
      });
    }

    idToCoordKey.set(city.id.toLowerCase(), key);
  }
}

/**
 * Expand fetched weather data from representative cities to ALL exchange IDs.
 *
 * Example: If we fetch weather for nse-mumbai (representative), this creates
 * copies for bse-mumbai, xbom-mumbai, xnse-mumbai too — same weather data,
 * different exchange IDs.
 *
 * @param fetchedData - Weather data for representative cities only
 * @returns Expanded data with entries for every exchange ID
 */
function expandToAllExchangeIds(fetchedData: readonly WeatherData[]): WeatherData[] {
  const expanded: WeatherData[] = [];

  for (const wd of fetchedData) {
    const key = idToCoordKey.get(wd.id.toLowerCase());
    const group = key ? coordGroups.get(key) : null;

    if (group && group.allIds.length > 1) {
      // Coordinate has multiple exchanges — create a copy for each
      for (const siblingId of group.allIds) {
        expanded.push({
          ...wd,
          id: siblingId,
          // city name is the same for all exchanges at same coordinates
        });
      }
    } else {
      // Unique coordinate — just pass through
      expanded.push({ ...wd });
    }
  }

  return expanded;
}

/**
 * Get ALL exchange IDs that belong to a batch's representative cities.
 * Used by merge logic to know which cached entries to replace.
 *
 * @param batch - Batch ID
 * @returns Set of all exchange IDs (lowercase) covered by this batch
 */
function getBatchAllIds(batch: BatchId): Set<string> {
  const ids = new Set<string>();
  for (const rep of batchCities[batch]) {
    const key = idToCoordKey.get(rep.id.toLowerCase());
    const group = key ? coordGroups.get(key) : null;
    if (group) {
      for (const id of group.allIds) {
        ids.add(id.toLowerCase());
      }
    } else {
      ids.add(rep.id.toLowerCase());
    }
  }
  return ids;
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize weather handler with cities from SSOT.
 *
 * @param cities - All exchange cities from catalog (89 entries)
 * @param selectedIds - Selected exchange IDs (16 homepage defaults for Batch A)
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

  // Build coordinate groups (deduplication)
  buildCoordGroups();

  // Split unique representatives into 4 batches
  splitIntoBatches();

  isInitialized = true;

  const totalBatchCities =
    batchCities.A.length + batchCities.B.length + batchCities.C.length + batchCities.D.length;

  logInfo('Weather handler initialized', {
    totalExchanges: allCities.length,
    uniqueLocations: coordGroups.size,
    deduplicatedSavings: allCities.length - coordGroups.size,
    batchACount: batchCities.A.length,
    batchBCount: batchCities.B.length,
    batchCCount: batchCities.C.length,
    batchDCount: batchCities.D.length,
    totalBatchCities,
    selectedCount: selectedExchangeIds.length,
  });
}

/**
 * Split unique representative cities into 4 batches.
 *
 * Strategy:
 * 1. Collect all unique representative cities from coordGroups (83).
 * 2. Separate into "selected" (their coord group's representative is in
 *    the selected-16 list) and "remaining".
 * 3. Batch A = all selected representatives + fill from remaining to target size.
 * 4. Distribute the rest evenly across B, C, D.
 *
 * Guarantees the 16 selected exchanges' weather is in Batch A.
 */
function splitIntoBatches(): void {
  const selectedSet = new Set(selectedExchangeIds.map((id) => id.toLowerCase()));

  // Collect unique representatives
  const allReps = [...coordGroups.values()].map((g) => g.representative);

  // Separate: is this coord group's representative (or any sibling) selected?
  const selectedReps: CityInfo[] = [];
  const remainingReps: CityInfo[] = [];

  for (const group of coordGroups.values()) {
    const hasSelectedId = group.allIds.some((id) => selectedSet.has(id.toLowerCase()));
    if (hasSelectedId) {
      selectedReps.push(group.representative);
    } else {
      remainingReps.push(group.representative);
    }
  }

  // Target batch size: ceil(uniqueLocations / NUM_BATCHES)
  const targetSize = Math.ceil(allReps.length / NUM_BATCHES);

  // Safety check: selected must fit in one batch
  if (selectedReps.length > MAX_CITIES_PER_BATCH) {
    logWarn('Weather: selected exchanges exceed MAX_CITIES_PER_BATCH', {
      selectedCount: selectedReps.length,
      maxPerBatch: MAX_CITIES_PER_BATCH,
    });
    // Truncate to safety cap (should never happen with 16 selected)
    selectedReps.length = MAX_CITIES_PER_BATCH;
  }

  // Build Batch A: all selected + fill from remaining to target size
  const batchA: CityInfo[] = [...selectedReps];
  const fillCount = Math.min(targetSize - batchA.length, remainingReps.length);

  // Take fill cities from the front of remaining
  const fillCities = remainingReps.splice(0, fillCount);
  batchA.push(...fillCities);

  // Distribute remaining across B, C, D evenly
  const batchB: CityInfo[] = [];
  const batchC: CityInfo[] = [];
  const batchD: CityInfo[] = [];
  const otherBatches = [batchB, batchC, batchD];

  for (let i = 0; i < remainingReps.length; i++) {
    const city = remainingReps[i];
    if (city) {
      otherBatches[i % 3]!.push(city);
    }
  }

  batchCities = {
    A: batchA,
    B: batchB,
    C: batchC,
    D: batchD,
  };

  logDebug('Weather batches configured (v3.0.0 — 4-batch dedup)', {
    batchA: batchA.length,
    batchASelected: selectedReps.length,
    batchAFill: fillCount,
    batchB: batchB.length,
    batchC: batchC.length,
    batchD: batchD.length,
    totalUnique: batchA.length + batchB.length + batchC.length + batchD.length,
  });
}

/**
 * Update selected exchanges and re-split batches.
 * Call when user changes their exchange selection.
 *
 * @param selectedIds - New selected exchange IDs
 */
export function updateSelectedExchanges(selectedIds: string[]): void {
  selectedExchangeIds = selectedIds;

  // Rebuild coord groups (representative preference may change)
  buildCoordGroups();
  splitIntoBatches();

  logInfo('Weather handler: selections updated', {
    selectedCount: selectedIds.length,
    batchACount: batchCities.A.length,
    batchBCount: batchCities.B.length,
    batchCCount: batchCities.C.length,
    batchDCount: batchCities.D.length,
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
  const currentBatchCities = batchCities[currentBatch];
  const creditsNeeded = currentBatchCities.length;

  // Guard: misconfiguration can leave us with 0 cities. Never treat that as "live".
  if (currentBatchCities.length === 0) {
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

  // 5. Fetch current batch (representative cities only)
  try {
    openWeatherMapBudget.spend(creditsNeeded);

    const batchData = await fetchWeatherBatch(currentBatchCities, currentBatch);

    // Record success
    circuit.recordSuccess();
    recordBatchRefresh(currentBatch);

    // Expand fetched data from representatives to all exchange IDs
    const expandedBatchData = expandToAllExchangeIds(batchData);

    // Merge with existing data for other batches
    const existingData = cache.getStale(CACHE_KEY_ALL) ?? [];
    const mergedData = mergeWeatherData(existingData, expandedBatchData, currentBatch);

    // Cache merged data
    cache.set(CACHE_KEY_ALL, mergedData);
    const entry = cache.getEntry(CACHE_KEY_ALL);

    logInfo('Weather data refreshed', {
      batch: currentBatch,
      apiCalls: batchData.length,
      expandedCount: expandedBatchData.length,
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
 * - Replace ALL entries for exchange IDs covered by the fetched batch
 *   (including coordinate-deduplicated siblings)
 * - Keep entries from other batches unchanged
 *
 * @param existing - Existing weather data (all 89 entries from previous merges)
 * @param newExpandedData - New batch data (already expanded to all sibling IDs)
 * @param batch - Which batch was fetched
 * @returns Merged weather data
 */
function mergeWeatherData(
  existing: readonly WeatherData[],
  newExpandedData: readonly WeatherData[],
  batch: BatchId,
): WeatherData[] {
  // Get ALL exchange IDs covered by this batch (including dedup siblings)
  const batchIds = getBatchAllIds(batch);

  // Build merged result: new data first, then existing non-overlapping data
  const merged: WeatherData[] = [...newExpandedData];
  const seenIds = new Set(newExpandedData.map((w) => w.id.toLowerCase()));

  for (const w of existing) {
    const lowerId = w.id.toLowerCase();
    if (!seenIds.has(lowerId) && !batchIds.has(lowerId)) {
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
      batchCRefreshedAt: batchState.batchCRefreshedAt,
      batchDRefreshedAt: batchState.batchDRefreshedAt,
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
    batchRotation: 'A→B→C→D (hour % 4)',
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
    nextBatch: getCurrentBatch(),
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
  const currentBatchCities = batchCities[currentBatch];

  // Skip if this batch has no cities (should not happen once initialised).
  if (currentBatchCities.length === 0) {
    logDebug('Weather refresh skipped (no cities for batch)', {
      batch: currentBatch,
    });
    return;
  }

  // Skip if budget exhausted
  if (!openWeatherMapBudget.canSpend(currentBatchCities.length)) {
    logDebug('Weather refresh skipped (budget)', {
      batch: currentBatch,
      needed: currentBatchCities.length,
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
    openWeatherMapBudget.spend(currentBatchCities.length);

    const batchData = await fetchWeatherBatch(currentBatchCities, currentBatch);

    circuit.recordSuccess();
    recordBatchRefresh(currentBatch);

    // Expand to all sibling exchange IDs
    const expandedBatchData = expandToAllExchangeIds(batchData);

    // Merge with existing
    const existingData = cache.getStale(CACHE_KEY_ALL) ?? [];
    const mergedData = mergeWeatherData(existingData, expandedBatchData, currentBatch);

    cache.set(CACHE_KEY_ALL, mergedData);

    logInfo('Weather background refresh complete', {
      batch: currentBatch,
      apiCalls: batchData.length,
      expandedCount: expandedBatchData.length,
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
  totalExchanges: number;
  uniqueLocations: number;
  deduplicatedSavings: number;
  batchACount: number;
  batchBCount: number;
  batchCCount: number;
  batchDCount: number;
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
    totalExchanges: allCities.length,
    uniqueLocations: coordGroups.size,
    deduplicatedSavings: allCities.length - coordGroups.size,
    batchACount: batchCities.A.length,
    batchBCount: batchCities.B.length,
    batchCCount: batchCities.C.length,
    batchDCount: batchCities.D.length,
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
  coordGroups.clear();
  idToCoordKey.clear();
  batchCities = { A: [], B: [], C: [], D: [] };
  selectedExchangeIds = [];
  isInitialized = false;
}
