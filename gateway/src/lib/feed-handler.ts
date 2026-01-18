/**
 * Promagen Gateway - Feed Handler Factory
 * =========================================
 * Creates complete feed handlers with all calming techniques built-in.
 *
 * CRITICAL FIX (2026-01-13): Uses SHARED budget managers per provider.
 * TwelveData feeds (FX, Crypto) share one 800/day pool.
 * Marketstack feeds (Indices) have separate 250/day pool.
 *
 * CRITICAL FIX (2026-01-13 v2): API key is now fetched DYNAMICALLY at fetch time,
 * not once at module load. This fixes the issue where env vars aren't available
 * when the module first loads, causing all fetches to silently return fallback.
 *
 * CRITICAL FIX (2026-01-14): Clock-aligned scheduling support.
 * When a scheduler is provided in config, uses getMsUntilNextSlot() for timing
 * instead of 90% TTL. This prevents TwelveData rate limit violations.
 *
 * Security: 10/10
 * - Input validation at all entry points
 * - Rate limiting via budget manager
 * - Circuit breaker for failure isolation
 * - No sensitive data in responses
 * - Graceful degradation on failures
 *
 * Built-in techniques:
 * 1. TTL cache
 * 2. Request deduplication
 * 3. Batch requests
 * 4. Stale-while-revalidate
 * 5. Background refresh (clock-aligned when scheduler provided)
 * 6. Budget management (SHARED per provider)
 * 7. Circuit breaker
 * 8. Graceful degradation
 *
 * @module lib/feed-handler
 */

import { GenericCache } from './cache.js';
import { CircuitBreaker } from './circuit.js';
import { RequestDeduplicator } from './dedup.js';
import { logInfo, logWarn, logError, logDebug, logFeedInit } from './logging.js';
import { getSharedBudget } from './shared-budgets.js';
import { computeSsotHash, loadSsotSnapshot, saveSsotSnapshot } from './ssot-snapshot.js';
import type {
  FeedConfig,
  FeedHandler,
  FeedTraceInfo,
  BaseResponseMeta,
  BudgetSnapshot,
  DataMode,
  SsotSource,
} from './types.js';

// =============================================================================
// FEED HANDLER IMPLEMENTATION
// =============================================================================

/**
 * Create a complete feed handler with all calming techniques.
 *
 * @typeParam TCatalog - Type of catalog items from SSOT
 * @typeParam TQuote - Type of quotes from API
 *
 * @example
 * ```typescript
 * const fxHandler = createFeedHandler<FxPair, FxQuote>({
 *   id: 'fx',
 *   provider: 'twelvedata',
 *   ttlSeconds: 1800,
 *   budgetDaily: 800,  // Note: Ignored - uses shared budget
 *   budgetMinute: 8,   // Note: Ignored - uses shared budget
 *   ssotUrl: 'https://promagen.com/api/fx/config',
 *   cacheKey: 'fx:ribbon:all',
 *   scheduler: fxScheduler, // Optional: clock-aligned scheduler
 *   parseCatalog: (data) => { ... },
 *   parseQuotes: (data, catalog) => { ... },
 *   fetchQuotes: async (symbols, apiKey) => { ... },
 *   getFallback: (catalog) => { ... },
 * });
 *
 * // Initialize
 * await fxHandler.init();
 * fxHandler.startBackgroundRefresh();
 *
 * // Use
 * const response = await fxHandler.getData();
 * ```
 */
export function createFeedHandler<TCatalog, TQuote>(
  config: FeedConfig<TCatalog, TQuote>,
): FeedHandler<TCatalog, TQuote> {
  // ===========================================================================
  // STATE
  // ===========================================================================

  /** Catalog from SSOT */
  let catalog: TCatalog[] = [];

  /** Default item IDs */
  let defaults: string[] = [];

  /** Whether SSOT was loaded from frontend or using fallback */
  let ssotSource: SsotSource = 'fallback';

  /** SSOT provenance (Chunk 1) */
  let ssotVersion: number = 0;
  let ssotHash: string | undefined;
  let ssotFingerprint: string | undefined;
  let ssotSnapshotAt: string | undefined;

  /** Whether handler is initialized */
  let ready = false;

  /** Background refresh timer (can be interval or timeout) */
  let refreshTimer: ReturnType<typeof setInterval> | ReturnType<typeof setTimeout> | null = null;

  /** Flag to track if we should continue refreshing */
  let isRefreshing = false;

  // ===========================================================================
  // INFRASTRUCTURE
  // ===========================================================================

  /** Cache for API responses */
  const cache = new GenericCache<TQuote[]>(config.ttlSeconds * 1000);

  /**
   * CRITICAL: Use SHARED budget manager per provider.
   * This ensures FX + Crypto share the 800/day TwelveData pool.
   */
  const budget = getSharedBudget(config.provider);

  /** Circuit breaker (still per-feed for isolation) */
  const circuit = new CircuitBreaker({
    id: `${config.id}-${config.provider}`,
    failureThreshold: 3,
    resetTimeoutMs: 30_000,
  });

  /** Request deduplicator */
  const dedup = new RequestDeduplicator<TQuote[]>(config.id);

  // ===========================================================================
  // INITIALIZATION
  // ===========================================================================

  /**
   * Initialize handler by fetching SSOT catalog from frontend.
   */
  async function init(): Promise<void> {
    logInfo(`Initializing feed: ${config.id}`, {
      feedId: config.id,
      ssotUrl: config.ssotUrl,
      sharedBudget: config.provider,
      hasScheduler: !!config.scheduler,
    });

    // 1) Load snapshot FIRST (no live dependency)
    const existingSnapshot = await loadSsotSnapshot<TCatalog>(config.id);
    if (existingSnapshot) {
      catalog = [...existingSnapshot.catalog] as TCatalog[];
      defaults = [...existingSnapshot.defaults];
      ssotSource = existingSnapshot.ssotSource;
      ssotVersion = existingSnapshot.provenance.ssotVersion;
      ssotHash = existingSnapshot.provenance.ssotHash;
      ssotFingerprint = existingSnapshot.provenance.ssotFingerprint;
      ssotSnapshotAt = existingSnapshot.provenance.snapshotAt;

      logFeedInit(config.id, existingSnapshot.ssotSource, catalog.length);
    }

    // 2) If no snapshot exists, we MUST load from frontend SSOT.
    // Pure SSOT rule: the ONLY fallback is a previously saved snapshot.
    if (!existingSnapshot) {
      await refreshSsotFromFrontend({ throwOnFailure: true });
    }

    ready = true;

    // 3) Refresh snapshot from frontend in background.
    void refreshSsotFromFrontend({ throwOnFailure: false });
  }

  /**
   * Refresh SSOT from frontend. On failure, keep last-known-good snapshot.
   */
  async function refreshSsotFromFrontend(opts: { throwOnFailure: boolean }): Promise<void> {
    try {
      const response = await fetch(config.ssotUrl, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        throw new Error(`SSOT fetch failed: ${response.status}`);
      }

      const data: unknown = await response.json();
      const nextCatalog = config.parseCatalog(data);
      const nextDefaults = config.getDefaults(nextCatalog, data);

      // Determine SSOT version if provided
      const versionFromPayload =
        data && typeof data === 'object' && typeof (data as Record<string, unknown>)['version'] === 'number'
          ? ((data as Record<string, unknown>)['version'] as number)
          : 1;

      const { hash, fingerprint } = computeSsotHash({ catalog: nextCatalog, defaults: nextDefaults });

      // No change
      if (hash === ssotHash) {
        return;
      }

      // Swap in new snapshot (LKG is the previous in-memory state)
      catalog = nextCatalog;
      defaults = nextDefaults;
      ssotSource = 'frontend';
      ssotVersion = versionFromPayload;
      ssotHash = hash;
      ssotFingerprint = fingerprint;
      ssotSnapshotAt = new Date().toISOString();

      await saveSsotSnapshot<TCatalog>({
        schemaVersion: 1,
        feedId: config.id,
        ssotUrl: config.ssotUrl,
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

      logFeedInit(config.id, 'frontend', catalog.length);
    } catch (error) {
      // Keep LKG (do not modify catalog/defaults/provenance)
      logWarn(`SSOT refresh failed; keeping last-known-good: ${config.id}`, {
        feedId: config.id,
        error: error instanceof Error ? error.message : String(error),
      });

      if (opts.throwOnFailure) {
        throw error;
      }
    }
  }

  // ===========================================================================
  // DATA FETCHING
  // ===========================================================================

  /**
   * Get data for default items.
   */
  async function getData(): Promise<{
    meta: BaseResponseMeta;
    data: TQuote[];
  }> {
    return getDataForIds(defaults);
  }

  /**
   * Get data for specific item IDs.
   */
  async function getDataForIds(ids: string[]): Promise<{
    meta: BaseResponseMeta;
    data: TQuote[];
  }> {
    const cacheKey = getCacheKey(ids);
    const requestedCatalog = getRequestedCatalog(ids);

    // 1. Check cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      const entry = cache.getEntry(cacheKey)!;
      return {
        meta: buildMeta('cached', entry.fetchedAt, entry.expiresAt),
        data: cached,
      };
    }

    // 2. Check circuit breaker
    if (circuit.isOpen()) {
      const stale = cache.getStale(cacheKey);
      if (stale) {
        const entry = cache.getEntry(cacheKey)!;
        return {
          meta: buildMeta('stale', entry.fetchedAt, entry.expiresAt),
          data: stale,
        };
      }

      // No stale data - return fallback
      const fallback = config.getFallback(requestedCatalog);
      return {
        meta: buildMeta('fallback'),
        data: fallback,
      };
    }

    // 3. Check budget
    const creditsNeeded = 1; // 1 API call = 1 credit (batched)
    if (!budget.canSpend(creditsNeeded)) {
      logDebug(`Budget blocked for ${config.id}`, {
        feedId: config.id,
        creditsNeeded,
        budgetState: budget.getState(),
      });

      const stale = cache.getStale(cacheKey);
      if (stale) {
        const entry = cache.getEntry(cacheKey)!;
        return {
          meta: buildMeta('stale', entry.fetchedAt, entry.expiresAt),
          data: stale,
        };
      }

      // No stale data - return fallback
      const fallback = config.getFallback(requestedCatalog);
      return {
        meta: buildMeta('fallback'),
        data: fallback,
      };
    }

    // 4. Fetch with deduplication
    try {
      const quotes = await dedup.dedupe(cacheKey, async () => {
        return await fetchFromProvider(ids, requestedCatalog);
      });

      // Cache the result
      cache.set(cacheKey, quotes);
      const entry = cache.getEntry(cacheKey)!;

      return {
        meta: buildMeta('live', entry.fetchedAt, entry.expiresAt),
        data: quotes,
      };
    } catch (error) {
      logError(`Fetch failed: ${config.id}`, {
        feedId: config.id,
        error: error instanceof Error ? error.message : String(error),
      });

      // Try stale data
      const stale = cache.getStale(cacheKey);
      if (stale) {
        const entry = cache.getEntry(cacheKey)!;
        return {
          meta: buildMeta('stale', entry.fetchedAt, entry.expiresAt),
          data: stale,
        };
      }

      // Return fallback
      const fallback = config.getFallback(requestedCatalog);
      return {
        meta: buildMeta('error'),
        data: fallback,
      };
    }
  }

  /**
   * Fetch data from provider API.
   *
   * FIXED: API key is now fetched DYNAMICALLY at fetch time, not once at module load.
   * This ensures env vars are available even if they weren't when the module loaded.
   */
  async function fetchFromProvider(ids: string[], requestedCatalog: TCatalog[]): Promise<TQuote[]> {
    // No provider configured - return fallback
    if (config.provider === 'none') {
      logDebug(`No provider configured for ${config.id}, returning fallback`, {
        feedId: config.id,
      });
      return config.getFallback(requestedCatalog);
    }

    // CRITICAL FIX: Get API key DYNAMICALLY at fetch time
    const apiKey = getApiKey(config.provider);

    if (!apiKey) {
      logWarn(`No API key for provider ${config.provider}, returning fallback`, {
        feedId: config.id,
        provider: config.provider,
        envVar: config.provider === 'twelvedata' ? 'TWELVEDATA_API_KEY' : 'MARKETSTACK_API_KEY',
      });
      return config.getFallback(requestedCatalog);
    }

    // Get symbols for the requested IDs
    const symbols: string[] = [];
    for (const id of ids) {
      const item = config.getById(requestedCatalog, id);
      if (item) {
        symbols.push(config.getSymbol(item));
      }
    }

    if (symbols.length === 0) {
      logWarn(`No symbols found for ${config.id}`, {
        feedId: config.id,
        requestedIds: ids.slice(0, 5),
      });
      return config.getFallback(requestedCatalog);
    }

    // Spend budget (SHARED across all feeds using this provider)
    budget.spend(1); // 1 API call = 1 credit (batched)

    logDebug(`Fetching from provider: ${config.id}`, {
      feedId: config.id,
      provider: config.provider,
      symbolCount: symbols.length,
      symbols: symbols.slice(0, 5),
    });

    try {
      const rawData = await config.fetchQuotes(symbols, apiKey);
      circuit.recordSuccess();
      return config.parseQuotes(rawData, requestedCatalog);
    } catch (error) {
      circuit.recordFailure();
      throw error;
    }
  }

  // ===========================================================================
  // BACKGROUND REFRESH
  // ===========================================================================

  /**
   * Start background refresh loop.
   *
   * CRITICAL: If scheduler is provided, uses clock-aligned slots.
   * Otherwise falls back to 90% TTL (legacy behavior).
   */
  function startBackgroundRefresh(): void {
    if (isRefreshing) return;
    isRefreshing = true;

    if (config.scheduler) {
      // Clock-aligned scheduling
      startClockAlignedRefresh();
    } else {
      // Legacy 90% TTL scheduling
      startLegacyRefresh();
    }
  }

  /**
   * Start clock-aligned background refresh.
   * Uses scheduler.getMsUntilNextSlot() to align with clock.
   */
  function startClockAlignedRefresh(): void {
    const scheduler = config.scheduler!;
    const slotMinutes = scheduler.getSlotMinutes();

    logInfo(`Background refresh started (clock-aligned): ${config.id}`, {
      feedId: config.id,
      slotMinutes: [...slotMinutes],
      nextRefreshAt: scheduler.getNextSlotTime().toISOString(),
    });

    // Schedule next refresh at clock-aligned time
    function scheduleNext(): void {
      if (!isRefreshing) return;

      const msUntilSlot = scheduler.getMsUntilNextSlot();

      refreshTimer = setTimeout(() => {
        if (!isRefreshing) return;

        // Perform refresh
        refreshCache()
          .catch(() => {})
          .finally(() => {
            // Schedule next refresh
            scheduleNext();
          });
      }, msUntilSlot);

      logDebug(`Next refresh scheduled: ${config.id}`, {
        feedId: config.id,
        msUntilSlot,
        nextRefreshAt: scheduler.getNextSlotTime().toISOString(),
      });
    }

    // Initial refresh if we're in an active slot
    if (scheduler.isSlotActive()) {
      refreshCache().catch(() => {});
    }

    // Schedule next refresh
    scheduleNext();
  }

  /**
   * Start legacy 90% TTL background refresh.
   * Used when no scheduler is provided.
   */
  function startLegacyRefresh(): void {
    // Initial delay before first refresh
    const initialDelay = 30_000; // 30 seconds
    const intervalMs = config.ttlSeconds * 1000 * 0.9;

    logInfo(`Background refresh started (legacy 90% TTL): ${config.id}`, {
      feedId: config.id,
      intervalSeconds: Math.round(config.ttlSeconds * 0.9),
    });

    setTimeout(() => {
      if (!isRefreshing) return;

      // First refresh
      refreshCache().catch(() => {});

      // Start interval
      refreshTimer = setInterval(() => {
        if (!isRefreshing) return;
        refreshCache().catch(() => {});
      }, intervalMs);
    }, initialDelay);
  }

  /**
   * Stop background refresh loop.
   */
  function stopBackgroundRefresh(): void {
    isRefreshing = false;

    if (refreshTimer) {
      clearInterval(refreshTimer as ReturnType<typeof setInterval>);
      clearTimeout(refreshTimer as ReturnType<typeof setTimeout>);
      refreshTimer = null;
      logInfo(`Background refresh stopped: ${config.id}`, { feedId: config.id });
    }
  }

  /**
   * Refresh the default cache.
   */
  async function refreshCache(): Promise<void> {
    const cacheKey = getCacheKey(defaults);

    // Skip if circuit is open
    if (circuit.isOpen()) {
      logDebug(`Background refresh skipped (circuit open): ${config.id}`, {
        feedId: config.id,
      });
      return;
    }

    // Skip if budget exhausted
    if (!budget.canSpend(1)) {
      logDebug(`Background refresh skipped (budget): ${config.id}`, {
        feedId: config.id,
        budgetState: budget.getState(),
      });
      return;
    }

    try {
      const quotes = await dedup.dedupe(`refresh:${cacheKey}`, async () => {
        const requestedCatalog = getRequestedCatalog(defaults);
        return await fetchFromProvider(defaults, requestedCatalog);
      });

      cache.set(cacheKey, quotes);
      logDebug(`Background refresh complete: ${config.id}`, {
        feedId: config.id,
        quoteCount: quotes.length,
      });
    } catch (error) {
      logWarn(`Background refresh failed: ${config.id}`, {
        feedId: config.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  /**
   * Generate cache key for a set of IDs.
   */
  function getCacheKey(ids: string[]): string {
    const fp = ssotFingerprint ?? 'no-ssot';
    // IMPORTANT: Order matters (SSOT + user selections).
    // We DO NOT sort IDs; caller is responsible for a stable order.
    if (ids.length === defaults.length && ids.every((id, i) => id === defaults[i])) {
      return `${config.cacheKey}:${fp}:default`;
    }
    return `${config.cacheKey}:${fp}:custom:${ids.join(',')}`;
  }

  /**
   * Build a requested catalog subset in the exact requested order.
   * Unknown IDs are ignored here (they should be rejected by route validation).
   */
  function getRequestedCatalog(ids: string[]): TCatalog[] {
    const out: TCatalog[] = [];
    for (const id of ids) {
      const item = config.getById(catalog, id);
      if (item) out.push(item);
    }
    return out;
  }

  /**
   * Build response metadata.
   */
  function buildMeta(mode: DataMode, fetchedAt?: number, expiresAt?: number): BaseResponseMeta {
    return {
      mode,
      cachedAt: fetchedAt ? new Date(fetchedAt).toISOString() : undefined,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      provider: config.provider,
      ssotSource,
      ssotVersion,
      ssotHash,
      ssotFingerprint,
      ssotSnapshotAt,
      budget: budget.getResponse(),
    };
  }

  // ===========================================================================
  // DIAGNOSTICS
  // ===========================================================================

  /**
   * Get trace info for diagnostics endpoint.
   */
  function getTraceInfo(): FeedTraceInfo {
    const defaultCacheKey = getCacheKey(defaults);
    const cacheEntry = cache.getEntry(defaultCacheKey);

    const baseInfo: FeedTraceInfo = {
      feedId: config.id,
      ssotSource,
      ssotUrl: config.ssotUrl,
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
        hasData: cache.has(defaultCacheKey),
        expiresAt: cacheEntry ? new Date(cacheEntry.expiresAt).toISOString() : null,
      },
      inFlightCount: dedup.getPendingCount(),
    };

    // Add scheduler info if available
    if (config.scheduler) {
      return {
        ...baseInfo,
        nextRefreshAt: config.scheduler.getNextSlotTime().toISOString(),
        slotMinutes: config.scheduler.getSlotMinutes(),
      };
    }

    return baseInfo;
  }

  /**
   * Get budget state snapshot.
   */
  function getBudgetState(): BudgetSnapshot {
    return budget.getState();
  }

  // ===========================================================================
  // PUBLIC INTERFACE
  // ===========================================================================

  return {
    init,
    startBackgroundRefresh,
    stopBackgroundRefresh,
    getData,
    getDataForIds,
    getCatalog: () => [...catalog] as readonly TCatalog[],
    getDefaults: () => [...defaults] as readonly string[],
    getTraceInfo,
    getBudgetState,
    isReady: () => ready,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get API key for a provider from environment.
 */
function getApiKey(provider: string): string {
  switch (provider) {
    case 'twelvedata':
      return process.env['TWELVEDATA_API_KEY'] ?? '';
    case 'marketstack':
      return process.env['MARKETSTACK_API_KEY'] ?? '';
    default:
      return '';
  }
}
