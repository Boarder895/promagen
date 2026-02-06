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
 * TIMING:
 * - 1 API call every 3 minutes (uniform, including startup)
 * - 78 commodities × 3 min = 234 min (~3.9 hours) per full cycle
 * - Cycles/day: ~6.2
 * - Calls/day: ~480
 *
 * This conservative pacing ensures we stay well within Marketstack rate limits
 * and avoid 429 errors that were caused by the previous aggressive scheduling.
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
 * Authority: Updated 2026-02-05 (rate limit fix - 3 min interval)
 *
 * @module marketstack/commodities-scheduler
 */

import { logInfo, logDebug, logWarn } from '../lib/logging.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Interval between individual commodity fetches, in milliseconds.
 * Default: 3 minutes (180,000 ms).
 *
 * Balanced pacing to avoid Marketstack 429 rate limit errors
 * while keeping data reasonably fresh.
 * Previous values (1-2 min) were too aggressive for the plan's rate limits.
 */
const DEFAULT_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes

/**
 * Minimum interval guard (prevents accidental thrashing).
 * Even if env var is misconfigured, never go faster than 1 minute.
 */
const MIN_INTERVAL_MS = 60 * 1000; // 1 minute (safety floor)

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
 * @param intervalMs - Milliseconds between each fetch (default: 180_000 = 3 min)
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
  let priorityIds: string[] = [];
  let running = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let fetchCallback: RollingFetchCallback | null = null;
  let cycleCount = 0;
  let lastFetchAt: number | null = null;
  let nextFetchAt: number | null = null;

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

      logDebug('Commodities scheduler: new cycle', {
        cycleCount,
        intervalMs: effectiveInterval,
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

      // Count double-word commodities in queue
      const doubleWordInQueue = queue.filter((id) => DOUBLE_WORD_COMMODITY_IDS.includes(id)).length;

      logInfo('Commodities rolling scheduler started', {
        intervalMs: effectiveInterval,
        intervalMinutes: Math.round(effectiveInterval / 60_000),
        totalCommodities: allIds.length,
        doubleWordFirst: doubleWordInQueue,
        priorityCount: priorityIds.length,
        firstEight: queue.slice(0, 8),
        fullCycleMinutes: Math.round((allIds.length * effectiveInterval) / 60_000),
        callsPerDay: Math.round((24 * 60) / (effectiveInterval / 60_000)),
      });

      // Start first tick immediately (that's the first "1 call"), then 10 min gap
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
        priorityIds: [...priorityIds],
        doubleWordIds: [...DOUBLE_WORD_COMMODITY_IDS],
        queueFirstTen: queue.slice(0, 10),
      };
    },
  };
}
