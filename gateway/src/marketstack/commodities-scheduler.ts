/**
 * Promagen Gateway - Commodities Rolling Scheduler
 * ===================================================
 * Implements a rolling refresh scheduler for the commodities feed.
 *
 * CRITICAL DIFFERENCE from Indices/FX/Crypto:
 * - Indices uses clock-aligned slots (:05, :20, :35, :50) and batch fetches
 * - Commodities uses a ROLLING timer (one commodity at a time)
 *
 * Why rolling instead of clock-aligned?
 * - Marketstack commodities endpoint: 1 commodity per call (no batching)
 * - Rate limit constraints on the endpoint
 * - 78 commodities to cycle through
 * - Rolling lets us fetch continuously without complex slot math
 *
 * TIMING (UPDATED 2026-02-08):
 * - 1 API call every 5 minutes
 * - 78 commodities × 5 min = 390 min (~6.5 hours) per full cycle
 * - Cycles/day: ~3.7
 * - Calls/day: ~288
 * - Combined with Indices (~96/day): ~384/day total Marketstack
 * - Budget: 3,333/day (Professional tier) → 11.5% usage
 * - Headroom: ~88%
 *
 * RANDOMISATION (UPDATED 2026-02-08):
 * - Queue is FULLY SHUFFLED each cycle using Fisher-Yates algorithm
 * - ALL 78 commodities are randomised — no tiers, no priority ordering
 * - Every commodity has equal chance of being fetched first
 * - With 78! permutations (~1.1 × 10^115) the sequence never repeats
 *
 * Security: 10/10
 * - No external inputs (schedule is fully random each cycle)
 * - Queue is rebuilt from SSOT on each cycle (no stale state)
 * - Timer references are cleaned up on stop
 *
 * Authority: Updated 2026-02-08 (full shuffle, no tiers)
 *
 * @module marketstack/commodities-scheduler
 */

import { logInfo, logDebug, logWarn } from '../lib/logging.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Interval between individual commodity fetches, in milliseconds.
 * Default: 5 minutes (300,000 ms).
 *
 * Budget math:
 * - 78 commodities × 5 min = 390 min (~6.5 hours) per full cycle
 * - Cycles/day: ~3.7
 * - Calls/day: ~288
 * - Combined with Indices (~96/day): ~384/day total Marketstack
 * - Budget: 3,333/day → 11.5% usage, 88% headroom
 */
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Minimum interval guard (prevents accidental thrashing).
 * Even if env var is misconfigured, never go faster than 2 minutes.
 */
const MIN_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes (safety floor)

// =============================================================================
// RANDOMISATION UTILITY
// =============================================================================

/**
 * Fisher-Yates (Knuth) shuffle — O(n) in-place.
 * Mutates the array and returns it.
 *
 * Uses Math.random() which is fine for non-cryptographic queue ordering.
 */
function fisherYatesShuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    // Swap
    const temp = array[i]!;
    array[i] = array[j]!;
    array[j] = temp;
  }
  return array;
}

// =============================================================================
// ROLLING SCHEDULER
// =============================================================================

/**
 * Callback invoked by the scheduler when it's time to fetch the next commodity.
 * Returns the catalog ID of the commodity to fetch.
 *
 * @param catalogId - The next commodity ID to fetch
 * @returns Promise that resolves when the fetch is complete (success or failure)
 */
export type RollingFetchCallback = (catalogId: string) => Promise<void>;

/**
 * Rolling scheduler state and controls.
 */
export interface CommoditiesRollingScheduler {
  /**
   * Start the rolling refresh loop.
   *
   * @param allCatalogIds - Full list of all commodity IDs from catalog
   * @param priorityIds - Accepted for interface compatibility (not used for ordering)
   * @param fetchCallback - Called with the next commodity ID to fetch
   */
  start(allCatalogIds: string[], priorityIds: string[], fetchCallback: RollingFetchCallback): void;

  /**
   * Stop the rolling refresh loop.
   * Cleans up timer references.
   */
  stop(): void;

  /**
   * Update the catalog IDs (e.g., when SSOT refreshes).
   * Takes effect on the next cycle.
   *
   * @param allCatalogIds - Updated full catalog IDs
   * @param priorityIds - Accepted for interface compatibility (not used for ordering)
   */
  updatePriority(allCatalogIds: string[], priorityIds: string[]): void;

  /**
   * Check if the scheduler is currently running.
   */
  isRunning(): boolean;

  /**
   * Get scheduler state for /trace diagnostics.
   */
  getTraceInfo(): CommoditiesSchedulerTrace;
}

/**
 * Scheduler trace info for /trace endpoint.
 */
export interface CommoditiesSchedulerTrace {
  readonly running: boolean;
  readonly intervalMs: number;
  readonly queueLength: number;
  readonly queuePosition: number;
  readonly currentCommodity: string | null;
  readonly cycleCount: number;
  readonly lastFetchAt: string | null;
  readonly nextFetchAt: string | null;
  readonly queueFirstTen: readonly string[];
  readonly randomised: boolean;
}

// =============================================================================
// FACTORY
// =============================================================================

/**
 * Create a rolling scheduler for commodities.
 *
 * @param intervalMs - Milliseconds between each fetch (default: 300_000 = 5 min)
 * @returns Scheduler controls
 *
 * @example
 * ```typescript
 * const scheduler = createCommoditiesRollingScheduler();
 *
 * scheduler.start(
 *   allCatalogIds,     // ['aluminum', 'barley', ... ]  (78 items)
 *   defaultIds,        // accepted but NOT used for ordering
 *   async (catalogId) => {
 *     await fetchAndCacheCommodity(catalogId);
 *   },
 * );
 * ```
 */
export function createCommoditiesRollingScheduler(
  intervalMs?: number,
): CommoditiesRollingScheduler {
  // ── Validate interval ─────────────────────────────────────────────────────
  const envInterval = process.env['COMMODITIES_REFRESH_INTERVAL_MS'];
  let effectiveInterval = intervalMs ?? DEFAULT_INTERVAL_MS;

  if (envInterval) {
    const parsed = parseInt(envInterval, 10);
    if (Number.isFinite(parsed) && parsed >= MIN_INTERVAL_MS) {
      effectiveInterval = parsed;
    } else {
      logWarn('Invalid COMMODITIES_REFRESH_INTERVAL_MS, using default', {
        envValue: envInterval,
        defaultMs: DEFAULT_INTERVAL_MS,
      });
    }
  }

  // Enforce minimum
  effectiveInterval = Math.max(effectiveInterval, MIN_INTERVAL_MS);

  // ── State ─────────────────────────────────────────────────────────────────
  let queue: string[] = [];
  let queuePosition = 0;
  let allIds: string[] = [];
  let running = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let fetchCallback: RollingFetchCallback | null = null;
  let cycleCount = 0;
  let lastFetchAt: number | null = null;
  let nextFetchAt: number | null = null;

  // ── Queue builder ─────────────────────────────────────────────────────────

  /**
   * Build the fetch queue — FULL Fisher-Yates shuffle of ALL commodities.
   *
   * No tiers, no priority ordering, no double-word preference.
   * Every commodity has an equal chance of being fetched at any position.
   *
   * With 78! permutations (~1.1 × 10^115), the order is unique each cycle.
   */
  function buildQueue(): string[] {
    const shuffled = [...allIds];
    fisherYatesShuffle(shuffled);
    return shuffled;
  }

  // ── Tick ───────────────────────────────────────────────────────────────────

  /**
   * Execute one tick: fetch the next commodity in the queue.
   */
  async function tick(): Promise<void> {
    if (!running || !fetchCallback) return;

    // Rebuild queue at start of each cycle (with fresh random order)
    if (queuePosition >= queue.length) {
      queue = buildQueue();
      queuePosition = 0;
      cycleCount++;

      logDebug('Commodities scheduler: new cycle (fully randomised)', {
        cycleCount,
        intervalMs: effectiveInterval,
        queueLength: queue.length,
        firstFive: queue.slice(0, 5),
        lastFive: queue.slice(-5),
      });
    }

    // Safety: empty queue
    if (queue.length === 0) {
      logWarn('Commodities scheduler: empty queue, skipping tick');
      scheduleNext();
      return;
    }

    // Get next commodity (safe: queue.length > 0 && queuePosition < queue.length)
    const catalogId = queue[queuePosition]!;
    queuePosition++;
    lastFetchAt = Date.now();

    logDebug('Commodities scheduler: fetching', {
      catalogId,
      position: queuePosition,
      total: queue.length,
      cycle: cycleCount,
    });

    // Execute fetch (errors are handled by the callback)
    try {
      await fetchCallback(catalogId);
    } catch {
      // Swallow — callback is responsible for its own error handling.
      // We never let a single commodity failure stop the queue.
    }

    // Schedule next tick
    scheduleNext();
  }

  /**
   * Schedule the next tick.
   * Always uses the same interval (no cold-start burst mode).
   */
  function scheduleNext(): void {
    if (!running) return;

    nextFetchAt = Date.now() + effectiveInterval;

    timer = setTimeout(() => {
      tick().catch(() => {
        // Final safety net: if tick itself throws unexpectedly,
        // keep the scheduler alive by scheduling the next tick.
        if (running) {
          scheduleNext();
        }
      });
    }, effectiveInterval);
  }

  // ── Public interface ──────────────────────────────────────────────────────

  return {
    start(catalogIds: string[], _defaultIds: string[], callback: RollingFetchCallback): void {
      if (running) {
        logWarn('Commodities scheduler: already running, ignoring start()');
        return;
      }

      allIds = [...catalogIds];
      fetchCallback = callback;
      queue = buildQueue();
      queuePosition = 0;
      cycleCount = 0;
      running = true;

      logInfo('Commodities rolling scheduler started (5-min, fully randomised)', {
        intervalMs: effectiveInterval,
        intervalMinutes: Math.round(effectiveInterval / 60_000),
        totalCommodities: allIds.length,
        firstEight: queue.slice(0, 8),
        fullCycleMinutes: Math.round((allIds.length * effectiveInterval) / 60_000),
        callsPerDay: Math.round((24 * 60) / (effectiveInterval / 60_000)),
        randomised: true,
      });

      // Start first tick immediately (that's the first "1 call"), then 5 min gap
      tick().catch(() => {
        if (running) scheduleNext();
      });
    },

    stop(): void {
      running = false;
      fetchCallback = null;

      if (timer) {
        clearTimeout(timer);
        timer = null;
      }

      logInfo('Commodities rolling scheduler stopped', {
        cycleCount,
        queuePosition,
      });
    },

    updatePriority(catalogIds: string[], _newPriorityIds: string[]): void {
      allIds = [...catalogIds];

      // Queue is rebuilt at the start of each cycle, so no
      // need to modify the current queue mid-cycle.
      logDebug('Commodities scheduler: catalog updated', {
        totalCommodities: allIds.length,
      });
    },

    isRunning(): boolean {
      return running;
    },

    getTraceInfo(): CommoditiesSchedulerTrace {
      return {
        running,
        intervalMs: effectiveInterval,
        queueLength: queue.length,
        queuePosition,
        currentCommodity:
          queuePosition > 0 && queuePosition <= queue.length
            ? (queue[queuePosition - 1] ?? null)
            : null,
        cycleCount,
        lastFetchAt: lastFetchAt ? new Date(lastFetchAt).toISOString() : null,
        nextFetchAt: nextFetchAt ? new Date(nextFetchAt).toISOString() : null,
        queueFirstTen: queue.slice(0, 10),
        randomised: true,
      };
    },
  };
}
