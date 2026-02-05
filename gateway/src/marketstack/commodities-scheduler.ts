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
 * - 1 call/minute hard rate limit on the endpoint
 * - 78 commodities to cycle through
 * - Rolling lets us fetch continuously without complex slot math
 *
 * COLD-START BURST MODE:
 * - First cycle uses 1-minute intervals (at the API rate limit)
 * - Subsequent cycles use 2-minute intervals (comfortable margin)
 * - This halves the initial cache fill time from 156 min to 78 min
 *
 * Rolling Math:
 * - Cold-start (1-min):  78 × 1 = 78 min (~1.3 hours) for first fill
 * - Normal (2-min):      78 × 2 = 156 min (~2.6 hours) per cycle
 * - Cycles/day (normal): ~9.2
 * - Calls/day: ~720
 *
 * Priority Queue:
 * - All catalog commodities are fetched (no selection filtering)
 * - Priority IDs are placed at the FRONT of each cycle
 * - This ensures frequently-viewed commodities refresh first
 *
 * Security: 10/10
 * - No external inputs (schedule is deterministic)
 * - Queue is rebuilt from SSOT on each cycle (no stale state)
 * - Timer references are cleaned up on stop
 *
 * Authority: Compacted conversation 2026-02-03 (commodities movers grid)
 *
 * @module marketstack/commodities-scheduler
 */

import { logInfo, logDebug, logWarn } from '../lib/logging.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Interval between individual commodity fetches, in milliseconds.
 * Default: 2 minutes (120,000 ms).
 *
 * This sits comfortably within the 1-call/minute endpoint rate limit.
 */
const DEFAULT_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Cold-start burst interval: 1 minute.
 * Used during the FIRST cycle only to fill the cache faster.
 * After first cycle completes, switches back to DEFAULT_INTERVAL_MS.
 *
 * Why 1 minute (not faster)?
 * - Marketstack commodities endpoint has a 1 call/minute hard rate limit
 * - Going faster would result in 429 errors
 *
 * Cold-start math:
 * - First cycle (burst):  78 × 1 min = 78 min (~1.3 hours)
 * - Subsequent cycles:    78 × 2 min = 156 min (~2.6 hours)
 *
 * Authority: Compacted conversation 2026-02-03 (commodities movers grid)
 */
const COLD_START_INTERVAL_MS = 60 * 1000; // 1 minute (at the API limit)

/**
 * Minimum interval guard (prevents accidental thrashing).
 * Even if env var is misconfigured, never go faster than 1 minute.
 */
const MIN_INTERVAL_MS = 60 * 1000; // 1 minute (matches API rate limit)

/**
 * Double-word commodities that require URL encoding fix.
 * These are fetched FIRST to ensure they work and to verify the encoding fix.
 *
 * VERIFIED AGAINST: marketstack-commodities.xlsx (78 commodities)
 * 
 * CRITICAL: These map to Marketstack names with spaces:
 *   crude_oil    → "crude oil"
 *   natural_gas  → "natural gas"
 *   ttf_gas      → "ttf gas" (separate from natural_gas!)
 *   iron_ore     → "iron ore"
 *   etc.
 *   
 * These are placed at the FRONT of the queue to:
 * 1. Verify the URL encoding fix works immediately
 * 2. Ensure the most problematic commodities are fetched first
 */
const DOUBLE_WORD_COMMODITY_IDS: readonly string[] = [
  // Energy (double-word)
  'crude_oil',
  'natural_gas',
  'ttf_gas',
  'ttf_natural_gas',
  'uk_gas',
  'heating_oil',
  
  // Agriculture (double-word)
  'orange_juice',
  'palm_oil',
  'sunflower_oil',
  'lean_hogs',
  'live_cattle',
  'feeder_cattle',
  'eggs_ch',
  'eggs_us',
  'di_ammonium',
  
  // Metals/Industrial (double-word)
  'iron_ore',
  'iron_ore_cny',
  'hrc_steel',
  'soda_ash',
  'kraft_pulp',
  
  // Legacy aliases (map to same Marketstack names)
  'brent_crude',
  'wti_crude',
] as const;

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
   * @param priorityIds - IDs to fetch first each cycle (selected/defaults)
   * @param fetchCallback - Called with the next commodity ID to fetch
   */
  start(allCatalogIds: string[], priorityIds: string[], fetchCallback: RollingFetchCallback): void;

  /**
   * Stop the rolling refresh loop.
   * Cleans up timer references.
   */
  stop(): void;

  /**
   * Update the priority queue (e.g., when defaults change via SSOT refresh).
   * Takes effect on the next cycle.
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
  readonly coldStartMode: boolean;
  readonly queueLength: number;
  readonly queuePosition: number;
  readonly currentCommodity: string | null;
  readonly cycleCount: number;
  readonly lastFetchAt: string | null;
  readonly nextFetchAt: string | null;
  readonly priorityIds: readonly string[];
  readonly doubleWordIds: readonly string[];
  readonly queueFirstTen: readonly string[];
}

// =============================================================================
// FACTORY
// =============================================================================

/**
 * Create a rolling scheduler for commodities.
 *
 * @param intervalMs - Milliseconds between each fetch (default: 120_000 = 2 min)
 * @returns Scheduler controls
 *
 * @example
 * ```typescript
 * const scheduler = createCommoditiesRollingScheduler();
 *
 * scheduler.start(
 *   allCatalogIds,     // ['aluminum', 'barley', ... ]  (78 items)
 *   defaultIds,        // ['coffee', 'sugar', ... ]     (8 items - fetched first)
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
  let normalInterval = intervalMs ?? DEFAULT_INTERVAL_MS;

  if (envInterval) {
    const parsed = parseInt(envInterval, 10);
    if (Number.isFinite(parsed) && parsed >= MIN_INTERVAL_MS) {
      normalInterval = parsed;
    } else {
      logWarn('Invalid COMMODITIES_REFRESH_INTERVAL_MS, using default', {
        envValue: envInterval,
        defaultMs: DEFAULT_INTERVAL_MS,
      });
    }
  }

  // Enforce minimum
  normalInterval = Math.max(normalInterval, MIN_INTERVAL_MS);

  // ── State ─────────────────────────────────────────────────────────────────
  let queue: string[] = [];
  let queuePosition = 0;
  let allIds: string[] = [];
  let priorityIds: string[] = [];
  let running = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let fetchCallback: RollingFetchCallback | null = null;
  let cycleCount = 0;
  let lastFetchAt: number | null = null;
  let nextFetchAt: number | null = null;

  /**
   * Cold-start mode: true during the first cycle (cycleCount === 0).
   * Uses COLD_START_INTERVAL_MS (1 min) instead of normalInterval (2 min).
   * Switches to normal interval after first cycle completes.
   */
  let coldStartMode = true;

  /**
   * Get the current effective interval based on cold-start mode.
   */
  function getCurrentInterval(): number {
    return coldStartMode ? COLD_START_INTERVAL_MS : normalInterval;
  }

  // ── Queue builder ─────────────────────────────────────────────────────────

  /**
   * Build the fetch queue with priority ordering.
   * 
   * ORDER:
   * 1. Double-word commodities FIRST (verify URL encoding fix works)
   * 2. Priority IDs (defaults/selected) that aren't already in double-word
   * 3. Remaining IDs in catalog order
   * 
   * Duplicates are removed at each stage.
   */
  function buildQueue(): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    // 1. Double-word commodities first (only if they exist in allIds)
    const allIdSet = new Set(allIds);
    for (const id of DOUBLE_WORD_COMMODITY_IDS) {
      if (allIdSet.has(id) && !seen.has(id)) {
        result.push(id);
        seen.add(id);
      }
    }

    // 2. Priority IDs (defaults) that aren't already added
    for (const id of priorityIds) {
      if (allIdSet.has(id) && !seen.has(id)) {
        result.push(id);
        seen.add(id);
      }
    }

    // 3. Remaining IDs in catalog order
    for (const id of allIds) {
      if (!seen.has(id)) {
        result.push(id);
        seen.add(id);
      }
    }

    return result;
  }

  // ── Tick ───────────────────────────────────────────────────────────────────

  /**
   * Execute one tick: fetch the next commodity in the queue.
   */
  async function tick(): Promise<void> {
    if (!running || !fetchCallback) return;

    // Rebuild queue at start of each cycle
    if (queuePosition >= queue.length) {
      queue = buildQueue();
      queuePosition = 0;
      cycleCount++;

      // Exit cold-start mode after first cycle completes
      if (coldStartMode && cycleCount > 1) {
        coldStartMode = false;
        logInfo('Commodities scheduler: cold-start complete, switching to normal interval', {
          cycleCount,
          coldStartIntervalMs: COLD_START_INTERVAL_MS,
          normalIntervalMs: normalInterval,
          queueLength: queue.length,
        });
      }

      logDebug('Commodities scheduler: new cycle', {
        cycleCount,
        coldStartMode,
        intervalMs: getCurrentInterval(),
        queueLength: queue.length,
        firstThree: queue.slice(0, 3),
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
      coldStartMode,
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
   * Uses getCurrentInterval() to respect cold-start vs normal mode.
   */
  function scheduleNext(): void {
    if (!running) return;

    const interval = getCurrentInterval();
    nextFetchAt = Date.now() + interval;

    timer = setTimeout(() => {
      tick().catch(() => {
        // Final safety net: if tick itself throws unexpectedly,
        // keep the scheduler alive by scheduling the next tick.
        if (running) {
          scheduleNext();
        }
      });
    }, interval);
  }

  // ── Public interface ──────────────────────────────────────────────────────

  return {
    start(catalogIds: string[], defaultIds: string[], callback: RollingFetchCallback): void {
      if (running) {
        logWarn('Commodities scheduler: already running, ignoring start()');
        return;
      }

      allIds = [...catalogIds];
      priorityIds = [...defaultIds];
      fetchCallback = callback;
      queue = buildQueue();
      queuePosition = 0;
      cycleCount = 0;
      running = true;
      coldStartMode = true; // Reset to cold-start mode on each start

      // Count double-word commodities in queue
      const doubleWordInQueue = queue.filter((id) => 
        DOUBLE_WORD_COMMODITY_IDS.includes(id)
      ).length;

      logInfo('Commodities rolling scheduler started (COLD-START MODE)', {
        coldStartIntervalMs: COLD_START_INTERVAL_MS,
        normalIntervalMs: normalInterval,
        totalCommodities: allIds.length,
        doubleWordFirst: doubleWordInQueue,
        priorityCount: priorityIds.length,
        firstEight: queue.slice(0, 8), // Show first 8 (should be double-word)
        coldStartCycleMinutes: Math.round((allIds.length * COLD_START_INTERVAL_MS) / 60_000),
        normalCycleMinutes: Math.round((allIds.length * normalInterval) / 60_000),
      });

      // Start first tick immediately (don't wait)
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
        coldStartMode,
      });
    },

    updatePriority(catalogIds: string[], newPriorityIds: string[]): void {
      allIds = [...catalogIds];
      priorityIds = [...newPriorityIds];

      // Queue is rebuilt at the start of each cycle, so no
      // need to modify the current queue mid-cycle.
      logDebug('Commodities scheduler: priority updated', {
        totalCommodities: allIds.length,
        priorityCount: priorityIds.length,
        priorityIds: priorityIds.slice(0, 8),
      });
    },

    isRunning(): boolean {
      return running;
    },

    getTraceInfo(): CommoditiesSchedulerTrace {
      return {
        running,
        intervalMs: getCurrentInterval(),
        coldStartMode,
        queueLength: queue.length,
        queuePosition,
        currentCommodity:
          queuePosition > 0 && queuePosition <= queue.length
            ? (queue[queuePosition - 1] ?? null)
            : null,
        cycleCount,
        lastFetchAt: lastFetchAt ? new Date(lastFetchAt).toISOString() : null,
        nextFetchAt: nextFetchAt ? new Date(nextFetchAt).toISOString() : null,
        priorityIds: [...priorityIds],
        doubleWordIds: [...DOUBLE_WORD_COMMODITY_IDS],
        queueFirstTen: queue.slice(0, 10),
      };
    },
  };
}
