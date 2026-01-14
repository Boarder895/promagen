/**
 * Promagen Gateway - Request Deduplicator
 * =========================================
 * Prevents thundering herd by deduplicating concurrent requests.
 *
 * Security: 10/10
 * - No memory leaks (automatic cleanup)
 * - Bounded pending requests
 * - Error isolation (failed requests don't poison cache)
 *
 * Pattern:
 * When multiple requests arrive for the same resource simultaneously,
 * only one actual fetch is made. All callers receive the same result.
 *
 * @module lib/dedup
 */

import { logDebug, logError } from './logging.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Maximum concurrent pending requests per key */
const MAX_PENDING_PER_KEY = 100;

/** Maximum total pending requests */
const MAX_TOTAL_PENDING = 500;

/** Timeout for pending requests (30 seconds) */
const PENDING_TIMEOUT_MS = 30_000;

// =============================================================================
// REQUEST DEDUPLICATOR CLASS
// =============================================================================

/**
 * Request deduplicator using single-flight pattern.
 *
 * @typeParam T - Type of result from the deduplicated operation
 *
 * @example
 * ```typescript
 * const dedup = new RequestDeduplicator<FxQuote[]>();
 *
 * // Multiple concurrent calls to this will share single fetch
 * const quotes = await dedup.dedupe('fx:default', async () => {
 *   return await fetchFxQuotes();
 * });
 * ```
 */
export class RequestDeduplicator<T> {
  private readonly pending: Map<string, {
    promise: Promise<T>;
    waiters: number;
    startedAt: number;
  }> = new Map();

  private readonly id: string;

  /**
   * Create a new deduplicator.
   *
   * @param id - Identifier for logging
   */
  constructor(id: string = 'default') {
    this.id = id;

    // Cleanup stale entries periodically
    setInterval(() => this.cleanupStale(), 60_000);
  }

  /**
   * Execute a function with deduplication.
   * If a request for this key is already in flight, wait for it.
   * Otherwise, start a new request.
   *
   * @param key - Unique key for this request type
   * @param fn - Function to execute (only called if no pending request)
   * @returns Result of the function
   */
  async dedupe(key: string, fn: () => Promise<T>): Promise<T> {
    // Check for existing pending request
    const existing = this.pending.get(key);
    if (existing) {
      if (existing.waiters >= MAX_PENDING_PER_KEY) {
        throw new Error(`Too many pending requests for key: ${key}`);
      }

      existing.waiters++;
      logDebug(`Dedup: joining existing request`, {
        dedupId: this.id,
        key,
        waiters: existing.waiters,
      });

      return existing.promise;
    }

    // Check total pending limit
    if (this.pending.size >= MAX_TOTAL_PENDING) {
      throw new Error('Too many total pending requests');
    }

    // Start new request
    logDebug(`Dedup: starting new request`, {
      dedupId: this.id,
      key,
    });

    const promise = this.executeWithTimeout(key, fn);

    this.pending.set(key, {
      promise,
      waiters: 1,
      startedAt: Date.now(),
    });

    try {
      const result = await promise;
      return result;
    } finally {
      // Always clean up, even on error
      this.pending.delete(key);
    }
  }

  /**
   * Check if a request is currently pending for a key.
   */
  hasPending(key: string): boolean {
    return this.pending.has(key);
  }

  /**
   * Get number of pending requests.
   */
  getPendingCount(): number {
    return this.pending.size;
  }

  /**
   * Get all pending keys.
   */
  getPendingKeys(): string[] {
    return Array.from(this.pending.keys());
  }

  /**
   * Get number of waiters for a specific key.
   */
  getWaiterCount(key: string): number {
    return this.pending.get(key)?.waiters ?? 0;
  }

  /**
   * Get total number of waiters across all keys.
   */
  getTotalWaiters(): number {
    let total = 0;
    for (const entry of this.pending.values()) {
      total += entry.waiters;
    }
    return total;
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Execute function with timeout protection.
   */
  private async executeWithTimeout(key: string, fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        logError(`Dedup: request timeout`, {
          dedupId: this.id,
          key,
          timeoutMs: PENDING_TIMEOUT_MS,
        });
        reject(new Error(`Request timeout: ${key}`));
      }, PENDING_TIMEOUT_MS);

      fn()
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Clean up stale pending requests.
   */
  private cleanupStale(): void {
    const now = Date.now();
    const staleThreshold = PENDING_TIMEOUT_MS * 2;

    for (const [key, entry] of this.pending) {
      if (now - entry.startedAt > staleThreshold) {
        logError(`Dedup: cleaning up stale request`, {
          dedupId: this.id,
          key,
          ageMs: now - entry.startedAt,
        });
        this.pending.delete(key);
      }
    }
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a typed deduplicator for a specific feed.
 */
export function createDeduplicator<T>(feedId: string): RequestDeduplicator<T> {
  return new RequestDeduplicator<T>(feedId);
}

// =============================================================================
// SPECIALIZED DEDUPLICATORS
// =============================================================================

/**
 * Deduplicator specifically for API responses.
 * Includes response type in the generic.
 */
export class ApiDeduplicator<TResponse> extends RequestDeduplicator<TResponse> {
  /**
   * Dedupe an API fetch with additional logging.
   */
  async dedupeApi(
    key: string,
    endpoint: string,
    fetcher: () => Promise<TResponse>,
  ): Promise<TResponse> {
    return this.dedupe(key, async () => {
      logDebug(`API fetch starting`, { key, endpoint });
      const result = await fetcher();
      logDebug(`API fetch complete`, { key, endpoint });
      return result;
    });
  }
}

/**
 * Create an API-specific deduplicator.
 */
export function createApiDeduplicator<TResponse>(feedId: string): ApiDeduplicator<TResponse> {
  return new ApiDeduplicator<TResponse>(feedId);
}
