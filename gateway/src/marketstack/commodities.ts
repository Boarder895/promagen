/**
 * Promagen Gateway - Commodities Feed Handler (Marketstack)
 * ===========================================================
 * Custom FeedHandler for commodities using Marketstack v2 API.
 *
 * CRITICAL DIFFERENCE from Indices/FX/Crypto:
 * - Cannot use createFeedHandler() because commodities API
 *   supports only 1 commodity per call (no batching)
 * - Uses ROLLING refresh (every 2 min) instead of clock-aligned slots
 * - Maintains PER-COMMODITY cache (not per-request)
 * - getData() ASSEMBLES cached quotes from individual entries
 *
 * Architecture:
 * ┌─────────────────────────────────────────────────┐
 * │  commodities.ts (this file)                      │
 * │  Implements FeedHandler interface                │
 * │                                                   │
 * │  ┌─────────┐  ┌──────────┐  ┌────────────────┐  │
 * │  │  SSOT   │  │ Per-item │  │  Rolling        │  │
 * │  │  init   │  │  cache   │  │  scheduler      │  │
 * │  │         │  │  (2h TTL)│  │  (2-min tick)   │  │
 * │  └─────────┘  └──────────┘  └───────┬────────┘  │
 * │                                      │           │
 * │  ┌─────────┐  ┌──────────┐          ▼           │
 * │  │ Circuit │  │ Budget   │  ┌────────────────┐  │
 * │  │ breaker │  │ tracker  │  │  Adapter        │  │
 * │  │         │  │ (sep.)   │  │  (1 per call)   │  │
 * │  └─────────┘  └──────────┘  └────────────────┘  │
 * └─────────────────────────────────────────────────┘
 *
 * Cold-start behaviour:
 * - Uncached commodities return price: null (renders as "—")
 * - NO demo/fallback prices ever
 * - After ~2.6 hours the full catalog is populated
 *
 * Security: 10/10
 * - Input validation at all entry points
 * - Separate budget management
 * - Circuit breaker for failure isolation
 * - No sensitive data in responses
 * - Graceful degradation on failures
 *
 * @module marketstack/commodities
 */

import { GenericCache } from '../lib/cache.js';
import { CircuitBreaker } from '../lib/circuit.js';
import { logInfo, logWarn, logError, logDebug, logFeedInit } from '../lib/logging.js';
import { computeSsotHash, loadSsotSnapshot, saveSsotSnapshot } from '../lib/ssot-snapshot.js';
import type {
  FeedHandler,
  FeedTraceInfo,
  BaseResponseMeta,
  BudgetSnapshot,
  DataMode,
  SsotSource,
  CommodityCatalogItem,
  CommodityQuote,
  CommodityGroup,
} from '../lib/types.js';

import {
  fetchSingleCommodity,
  getMarketstackApiKeyForCommodities,
  type ParsedCommodityData,
} from './commodities-adapter.js';
import { getCommoditiesBudget, commoditiesBudget } from './commodities-budget.js';
import {
  createCommoditiesRollingScheduler,
  type CommoditiesRollingScheduler,
} from './commodities-scheduler.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

const COMMODITIES_CONFIG_URL =
  process.env['COMMODITIES_CONFIG_URL'] ?? 'https://promagen.com/api/commodities/config';

/**
 * Per-commodity cache TTL: 2 hours (7200 seconds).
 * Each commodity refreshes every ~2.6 hours via rolling scheduler,
 * so 2-hour TTL means stale-while-revalidate kicks in naturally.
 */
const COMMODITY_CACHE_TTL_SECONDS = parseInt(
  process.env['COMMODITIES_CACHE_TTL_SECONDS'] ?? '7200',
  10,
);

const FEED_ID = 'commodities' as const;
const PROVIDER_ID = 'marketstack' as const;

// =============================================================================
// HANDLER STATE
// =============================================================================

/** Catalog from SSOT */
let catalog: CommodityCatalogItem[] = [];

/** Default commodity IDs */
let defaults: string[] = [];

/** SSOT provenance */
let ssotSource: SsotSource = 'fallback';
let ssotVersion: number = 0;
let ssotHash: string | undefined;
let ssotFingerprint: string | undefined;
let ssotSnapshotAt: string | undefined;

/** Whether handler is initialized */
let ready = false;

// =============================================================================
// INFRASTRUCTURE
// =============================================================================

/**
 * Per-commodity cache.
 * Key: commodity catalog ID (e.g., "iron_ore")
 * Value: ParsedCommodityData from the last successful API call
 * TTL: 2 hours per entry
 */
const perItemCache = new GenericCache<ParsedCommodityData>(
  COMMODITY_CACHE_TTL_SECONDS * 1000,
  200, // Max 200 entries (78 commodities + headroom)
);

/**
 * Circuit breaker (per-feed isolation).
 * Opens after 3 consecutive failures, resets after 30 seconds.
 */
const circuit = new CircuitBreaker({
  id: `${FEED_ID}-${PROVIDER_ID}`,
  failureThreshold: 3,
  resetTimeoutMs: 30_000,
});

/**
 * Budget manager (separate from indices).
 */
const budget = getCommoditiesBudget();

/**
 * Rolling scheduler instance.
 */
const scheduler: CommoditiesRollingScheduler = createCommoditiesRollingScheduler();

// =============================================================================
// INITIALIZATION (SSOT)
// =============================================================================

/**
 * Initialize handler by fetching SSOT catalog from frontend.
 *
 * TRUE SSOT BEHAVIOR (same as all other feeds):
 * 1. ALWAYS try frontend FIRST (synchronous await)
 * 2. Only fall back to snapshot if frontend is unreachable
 * 3. Never serve stale SSOT when frontend is available
 */
async function init(): Promise<void> {
  logInfo(`Initializing feed: ${FEED_ID}`, {
    feedId: FEED_ID,
    ssotUrl: COMMODITIES_CONFIG_URL,
    provider: PROVIDER_ID,
  });

  let frontendSuccess = false;

  try {
    await refreshSsotFromFrontend({ throwOnFailure: true });
    frontendSuccess = true;
    logInfo(`SSOT loaded from frontend: ${FEED_ID}`, {
      feedId: FEED_ID,
      catalogCount: catalog.length,
      defaultCount: defaults.length,
      defaults: defaults.slice(0, 8),
    });
  } catch (error) {
    logWarn(`Frontend SSOT unavailable, trying snapshot: ${FEED_ID}`, {
      feedId: FEED_ID,
      error: error instanceof Error ? error.message : String(error),
    });

    const existingSnapshot = await loadSsotSnapshot<CommodityCatalogItem>(FEED_ID);

    if (existingSnapshot) {
      catalog = [...existingSnapshot.catalog] as CommodityCatalogItem[];
      defaults = [...existingSnapshot.defaults];
      ssotSource = 'snapshot-fallback';
      ssotVersion = existingSnapshot.provenance.ssotVersion;
      ssotHash = existingSnapshot.provenance.ssotHash;
      ssotFingerprint = existingSnapshot.provenance.ssotFingerprint;
      ssotSnapshotAt = existingSnapshot.provenance.snapshotAt;

      logWarn(`Using snapshot fallback (frontend down): ${FEED_ID}`, {
        feedId: FEED_ID,
        snapshotAt: ssotSnapshotAt,
        catalogCount: catalog.length,
        defaultCount: defaults.length,
      });
    } else {
      throw new Error(
        `SSOT unavailable: frontend unreachable and no snapshot exists for ${FEED_ID}`,
      );
    }
  }

  ready = true;
  logFeedInit(FEED_ID, frontendSuccess ? 'frontend' : 'snapshot-fallback', catalog.length);
}

/**
 * Refresh SSOT from frontend.
 */
async function refreshSsotFromFrontend(opts: { throwOnFailure: boolean }): Promise<void> {
  try {
    const response = await fetch(COMMODITIES_CONFIG_URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`SSOT fetch failed: ${response.status}`);
    }

    const data: unknown = await response.json();
    const nextCatalog = parseCatalog(data);
    const nextDefaults = getDefaultsFromPayload(nextCatalog, data);

    // SSOT version
    const versionFromPayload =
      data &&
      typeof data === 'object' &&
      typeof (data as Record<string, unknown>)['version'] === 'number'
        ? ((data as Record<string, unknown>)['version'] as number)
        : 1;

    const { hash, fingerprint } = computeSsotHash({
      catalog: nextCatalog,
      defaults: nextDefaults,
    });

    const ssotChanged = hash !== ssotHash;

    if (ssotChanged) {
      logInfo(`SSOT changed, updating: ${FEED_ID}`, {
        feedId: FEED_ID,
        oldFingerprint: ssotFingerprint,
        newFingerprint: fingerprint,
        oldDefaults: defaults.slice(0, 8),
        newDefaults: nextDefaults.slice(0, 8),
      });
    }

    // Swap in new snapshot
    catalog = nextCatalog;
    defaults = nextDefaults;
    ssotSource = 'frontend';
    ssotVersion = versionFromPayload;
    ssotHash = hash;
    ssotFingerprint = fingerprint;
    ssotSnapshotAt = new Date().toISOString();

    // Update scheduler priority if running
    if (scheduler.isRunning()) {
      scheduler.updatePriority(
        catalog.map((c) => c.id),
        defaults,
      );
    }

    // Persist snapshot for future fallback
    await saveSsotSnapshot<CommodityCatalogItem>({
      schemaVersion: 1,
      feedId: FEED_ID,
      ssotUrl: COMMODITIES_CONFIG_URL,
      ssotSource: 'frontend',
      provenance: {
        ssotVersion,
        ssotHash: ssotHash,
        ssotFingerprint: ssotFingerprint,
        snapshotAt: ssotSnapshotAt,
      },
      catalog,
      defaults,
    });

    if (ssotChanged) {
      logFeedInit(FEED_ID, 'frontend', catalog.length);
    }
  } catch (error) {
    logWarn(`SSOT refresh failed; keeping last-known-good: ${FEED_ID}`, {
      feedId: FEED_ID,
      error: error instanceof Error ? error.message : String(error),
    });

    if (opts.throwOnFailure) {
      throw error;
    }
  }
}

// =============================================================================
// CATALOG PARSING
// =============================================================================

/**
 * Parse SSOT catalog response into CommodityCatalogItem[].
 * Handles the same shapes as the fallback handler for backward compatibility.
 */
function parseCatalog(data: unknown): CommodityCatalogItem[] {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid Commodities SSOT payload');
  }

  const obj = data as Record<string, unknown>;
  let itemsArray: unknown[] = [];

  // Handle various response shapes from frontend
  if (Array.isArray(obj['commodities'])) {
    itemsArray = obj['commodities'];
  } else if (Array.isArray(obj['data'])) {
    itemsArray = obj['data'];
  } else if (Array.isArray(obj['catalog'])) {
    itemsArray = obj['catalog'];
  } else if (Array.isArray(data)) {
    itemsArray = data as unknown[];
  }

  const items: CommodityCatalogItem[] = [];

  for (const raw of itemsArray) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;

    // Sanitize ID: lowercase, trimmed, max 64 chars
    const id = typeof r['id'] === 'string' ? r['id'].toLowerCase().trim().slice(0, 64) : '';
    if (!id) continue;

    const name = typeof r['name'] === 'string' ? r['name'].trim().slice(0, 100) : id;
    const shortName =
      typeof r['shortName'] === 'string' ? r['shortName'].trim().slice(0, 50) : name;
    const symbol =
      typeof r['symbol'] === 'string'
        ? r['symbol'].toUpperCase().trim().slice(0, 20)
        : id.toUpperCase();
    const group =
      typeof r['group'] === 'string'
        ? (r['group'].toLowerCase().trim() as CommodityGroup)
        : 'unknown';

    items.push({
      id,
      name,
      shortName,
      symbol,
      group,
      quoteCurrency: typeof r['quoteCurrency'] === 'string' ? r['quoteCurrency'].trim() : 'USD',
      isDefaultFree: typeof r['isDefaultFree'] === 'boolean' ? r['isDefaultFree'] : undefined,
      isDefaultPaid: typeof r['isDefaultPaid'] === 'boolean' ? r['isDefaultPaid'] : undefined,
      isActive: typeof r['isActive'] === 'boolean' ? r['isActive'] : true,
      isSelectableInRibbon:
        typeof r['isSelectableInRibbon'] === 'boolean' ? r['isSelectableInRibbon'] : true,
      // demoPrice intentionally NOT consumed — no demo prices ever
    });
  }

  if (items.length === 0) {
    throw new Error('Commodities SSOT payload contained no valid items');
  }

  return items;
}

/**
 * Get default commodity IDs from SSOT payload.
 * Preserves order from SSOT.
 */
function getDefaultsFromPayload(cat: CommodityCatalogItem[], ssotPayload: unknown): string[] {
  const payload =
    ssotPayload && typeof ssotPayload === 'object'
      ? (ssotPayload as Record<string, unknown>)
      : null;

  // Prefer explicit ordered defaults
  const candidates = ['defaultCommodityIds', 'defaultIds', 'commodityIds', 'selectedCommodityIds'];
  for (const key of candidates) {
    const v = payload ? payload[key] : undefined;
    if (Array.isArray(v)) {
      const ids = v
        .filter((x): x is string => typeof x === 'string')
        .map((s) => s.toLowerCase().trim());
      const set = new Set(cat.map((c) => c.id));
      const filtered = ids.filter((id) => set.has(id));
      if (filtered.length > 0) return filtered;
    }
  }

  // Otherwise use flags
  const flagged = cat.filter((c) => c.isDefaultFree === true).map((c) => c.id);
  if (flagged.length > 0) return flagged;

  throw new Error(
    'Commodities defaults not defined in SSOT (no default IDs and no isDefaultFree flags)',
  );
}

// =============================================================================
// DATA FETCHING (Single Commodity)
// =============================================================================

/**
 * Fetch and cache a single commodity.
 * Called by the rolling scheduler on each tick.
 *
 * Flow:
 * 1. Check circuit breaker → skip if open
 * 2. Check budget → skip if exhausted
 * 3. Fetch from Marketstack → 1 API call
 * 4. Cache result per-commodity
 * 5. Record success/failure in circuit breaker
 */
async function fetchAndCacheSingle(catalogId: string): Promise<void> {
  // ── Circuit breaker check ─────────────────────────────────────────────────
  if (circuit.isOpen()) {
    logDebug(`Commodities fetch skipped (circuit open): ${catalogId}`, {
      feedId: FEED_ID,
      catalogId,
    });
    return;
  }

  // ── Budget check ──────────────────────────────────────────────────────────
  if (!budget.canSpend(1)) {
    logDebug(`Commodities fetch skipped (budget): ${catalogId}`, {
      feedId: FEED_ID,
      catalogId,
      budgetState: budget.getState(),
    });
    return;
  }

  // ── API key check ─────────────────────────────────────────────────────────
  const apiKey = getMarketstackApiKeyForCommodities();
  if (!apiKey) {
    logWarn(`No API key for commodities, skipping: ${catalogId}`, {
      feedId: FEED_ID,
      catalogId,
    });
    return;
  }

  // ── Spend budget ──────────────────────────────────────────────────────────
  budget.spend(1);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  try {
    const result = await fetchSingleCommodity(catalogId, apiKey);

    if (result) {
      // Cache the result keyed by catalog ID
      perItemCache.set(catalogId, result);
      circuit.recordSuccess();

      logDebug(`Commodities cached: ${catalogId}`, {
        feedId: FEED_ID,
        catalogId,
        price: result.price,
        currency: result.currency,
      });
    } else {
      // API returned no data (commodity not found) — not a failure
      logDebug(`Commodities: no data returned for ${catalogId}`, {
        feedId: FEED_ID,
        catalogId,
      });
    }
  } catch (error) {
    circuit.recordFailure();
    logError(`Commodities fetch failed: ${catalogId}`, {
      feedId: FEED_ID,
      catalogId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// =============================================================================
// DATA ASSEMBLY
// =============================================================================

/**
 * Assemble all cached commodity data into a single response.
 * This is called by getData() and getDataForIds().
 *
 * For each requested commodity:
 * - If cached (fresh): use cached price
 * - If cached (stale): use stale price (stale-while-revalidate)
 * - If not cached: return price: null (renders as "—")
 */
function assembleCommodityQuotes(ids: string[]): {
  quotes: CommodityQuote[];
  mode: DataMode;
} {
  const quotes: CommodityQuote[] = [];
  let hasLive = false;
  let hasStale = false;
  let hasMissing = false;

  for (const id of ids) {
    const catalogItem = catalog.find((c) => c.id === id);
    if (!catalogItem) continue;

    // Try fresh cache first
    let cached = perItemCache.get(id);
    let _isStale = false;

    if (!cached) {
      // Try stale cache (stale-while-revalidate)
      const staleData = perItemCache.getStale(id);
      if (staleData) {
        cached = staleData;
        _isStale = true;
        hasStale = true;
      } else {
        hasMissing = true;
      }
    } else {
      hasLive = true;
    }

    if (cached) {
      quotes.push({
        id: catalogItem.id,
        symbol: catalogItem.symbol,
        name: catalogItem.name,
        shortName: catalogItem.shortName,
        group: catalogItem.group,
        price: cached.price,
        change: cached.change ?? null,
        percentChange: cached.percentChange ?? null,
        quoteCurrency: cached.currency || catalogItem.quoteCurrency,
      });
    } else {
      // Not cached at all — cold start or unknown commodity
      quotes.push({
        id: catalogItem.id,
        symbol: catalogItem.symbol,
        name: catalogItem.name,
        shortName: catalogItem.shortName,
        group: catalogItem.group,
        price: null, // NEVER return demo prices — renders as "—"
        change: null,
        percentChange: null,
        quoteCurrency: catalogItem.quoteCurrency,
      });
    }
  }

  // Determine overall data mode
  let mode: DataMode;
  if (hasLive && !hasStale && !hasMissing) {
    mode = 'live';
  } else if (hasLive || hasStale) {
    mode = hasStale ? 'stale' : 'cached';
  } else {
    mode = 'fallback';
  }

  return { quotes, mode };
}

// =============================================================================
// RESPONSE BUILDER
// =============================================================================

/**
 * Build response metadata.
 */
function buildMeta(mode: DataMode): BaseResponseMeta {
  return {
    mode,
    cachedAt: undefined, // Per-commodity caching doesn't have a single cachedAt
    expiresAt: undefined,
    provider: PROVIDER_ID,
    ssotSource,
    ssotVersion,
    ssotHash,
    ssotFingerprint,
    ssotSnapshotAt,
    budget: commoditiesBudget.getResponse(),
  };
}

// =============================================================================
// FEED HANDLER INTERFACE IMPLEMENTATION
// =============================================================================

/**
 * Get data for default commodities.
 */
async function getData(): Promise<{
  meta: BaseResponseMeta;
  data: CommodityQuote[];
}> {
  const { quotes, mode } = assembleCommodityQuotes(defaults);
  return {
    meta: buildMeta(mode),
    data: quotes,
  };
}

/**
 * Get data for specific commodity IDs (Pro users).
 */
async function getDataForIds(ids: string[]): Promise<{
  meta: BaseResponseMeta;
  data: CommodityQuote[];
}> {
  const { quotes, mode } = assembleCommodityQuotes(ids);
  return {
    meta: buildMeta(mode),
    data: quotes,
  };
}

/**
 * Start background rolling refresh.
 */
function startBackgroundRefresh(): void {
  if (scheduler.isRunning()) return;

  const allIds = catalog.map((c) => c.id);

  scheduler.start(allIds, defaults, fetchAndCacheSingle);

  logInfo('Commodities background refresh started (rolling)', {
    feedId: FEED_ID,
    totalCommodities: allIds.length,
    priorityCount: defaults.length,
  });
}

/**
 * Stop background refresh.
 */
function stopBackgroundRefresh(): void {
  scheduler.stop();
  logInfo('Commodities background refresh stopped', { feedId: FEED_ID });
}

/**
 * Get trace info for /trace endpoint.
 */
function getTraceInfo(): FeedTraceInfo {
  const schedulerTrace = scheduler.getTraceInfo();

  // Count cached items
  let cachedCount = 0;
  let staleCount = 0;
  for (const item of catalog) {
    if (perItemCache.get(item.id)) {
      cachedCount++;
    } else if (perItemCache.getStale(item.id)) {
      staleCount++;
    }
  }

  return {
    feedId: FEED_ID,
    ssotSource,
    ssotUrl: COMMODITIES_CONFIG_URL,
    ssotVersion,
    ssotHash,
    ssotFingerprint,
    ssotSnapshotAt,
    catalogCount: catalog.length,
    defaultCount: defaults.length,
    defaults: [...defaults],
    budget: budget.getState(),
    circuit: circuit.getState(),
    cache: {
      hasData: cachedCount > 0,
      expiresAt: null, // Per-commodity caching — no single expiry
    },
    inFlightCount: 0, // Rolling scheduler handles dedup implicitly (1 at a time)
    // Extended trace fields for commodities
    ...({
      cachedCommodities: cachedCount,
      staleCommodities: staleCount,
      uncachedCommodities: catalog.length - cachedCount - staleCount,
      scheduler: schedulerTrace,
    } as Record<string, unknown>),
  };
}

/**
 * Get budget state snapshot.
 */
function getBudgetState(): BudgetSnapshot {
  return budget.getState();
}

// =============================================================================
// HANDLER EXPORT
// =============================================================================

/**
 * Commodities feed handler instance.
 *
 * Uses Marketstack v2 commodities API with:
 * - Rolling 2-minute refresh (1 commodity per call)
 * - Separate budget tracker (visible in /trace independently)
 * - Per-commodity cache (2-hour TTL)
 * - Priority queue (defaults fetched first each cycle)
 * - Circuit breaker for failure isolation
 * - No demo prices ever — cold start returns null/—
 *
 * Ready to use after calling init().
 */
export const commoditiesHandler: FeedHandler<CommodityCatalogItem, CommodityQuote> = {
  init,
  startBackgroundRefresh,
  stopBackgroundRefresh,
  getData,
  getDataForIds,
  getCatalog: () => [...catalog] as readonly CommodityCatalogItem[],
  getDefaults: () => [...defaults] as readonly string[],
  getTraceInfo,
  getBudgetState,
  isReady: () => ready,
};

// =============================================================================
// SELECTION VALIDATION (Pro users)
// =============================================================================

const COMMODITIES_SELECTION_LIMITS = {
  REQUIRED_COUNT: 7,
  ENERGY_COUNT: 2,
  AGRICULTURE_COUNT: 3,
  METALS_COUNT: 2,
} as const;

/**
 * Validate commodities selection (must be exactly 7 with 2-3-2 split).
 *
 * Security: Enterprise-grade validation
 * - Enforces exact count (7 commodities)
 * - Validates group distribution (2-3-2)
 * - Checks against catalog (no unknown IDs)
 * - Input sanitization (lowercase, trim, dedupe)
 *
 * @param commodityIds - Array of commodity IDs to validate
 * @param tier - User tier ('free' or 'paid')
 * @param catalogMap - Map of valid commodities from catalog
 * @returns Validation result with allowed IDs or errors
 */
export function validateCommoditiesSelection(
  commodityIds: string[],
  tier: 'free' | 'paid',
  catalogMap: Map<string, CommodityCatalogItem>,
): {
  valid: boolean;
  errors: string[];
  allowedCommodityIds: string[];
} {
  const errors: string[] = [];

  if (tier !== 'paid') {
    return {
      valid: false,
      errors: ['Commodities selection requires Pro tier'],
      allowedCommodityIds: [],
    };
  }

  if (!Array.isArray(commodityIds)) {
    return {
      valid: false,
      errors: ['commodityIds must be an array'],
      allowedCommodityIds: [],
    };
  }

  // Security: Limit input array size
  if (commodityIds.length > 50) {
    return {
      valid: false,
      errors: ['Too many commodityIds provided (max 50)'],
      allowedCommodityIds: [],
    };
  }

  // Normalize and dedupe
  const normalizedIds = [
    ...new Set(
      commodityIds
        .filter((id): id is string => typeof id === 'string')
        .map((id) => id.toLowerCase().trim())
        .filter((id) => id.length > 0 && id.length <= 64),
    ),
  ];

  // Must be exactly 7
  if (normalizedIds.length !== COMMODITIES_SELECTION_LIMITS.REQUIRED_COUNT) {
    errors.push(
      `Exactly ${COMMODITIES_SELECTION_LIMITS.REQUIRED_COUNT} commodities required, got ${normalizedIds.length}`,
    );
  }

  // Validate against catalog
  const allowed: string[] = [];
  const missing: string[] = [];

  for (const id of normalizedIds) {
    if (catalogMap.has(id)) {
      allowed.push(id);
    } else {
      missing.push(id);
    }
  }

  if (missing.length > 0) {
    errors.push(
      `Unknown commodity IDs: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '...' : ''}`,
    );
  }

  // Enforce 2-3-2 group split
  const counts = { energy: 0, agriculture: 0, metals: 0 };

  for (const id of allowed) {
    const item = catalogMap.get(id);
    const group = item?.group?.toLowerCase();
    if (group === 'energy') counts.energy++;
    else if (group === 'agriculture') counts.agriculture++;
    else if (group === 'metals') counts.metals++;
  }

  const expectedEnergy = COMMODITIES_SELECTION_LIMITS.ENERGY_COUNT;
  const expectedAgriculture = COMMODITIES_SELECTION_LIMITS.AGRICULTURE_COUNT;
  const expectedMetals = COMMODITIES_SELECTION_LIMITS.METALS_COUNT;

  if (
    counts.energy !== expectedEnergy ||
    counts.agriculture !== expectedAgriculture ||
    counts.metals !== expectedMetals
  ) {
    errors.push(
      `Selection must match ${expectedEnergy}-${expectedAgriculture}-${expectedMetals} split (energy/agriculture/metals). ` +
        `Got energy=${counts.energy}, agriculture=${counts.agriculture}, metals=${counts.metals}`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    allowedCommodityIds: allowed,
  };
}
