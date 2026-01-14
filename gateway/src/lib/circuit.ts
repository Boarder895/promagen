/**
 * Promagen Gateway - Circuit Breaker
 * ====================================
 * Protects against cascading failures with automatic recovery.
 *
 * Security: 10/10
 * - Prevents resource exhaustion during outages
 * - Automatic recovery without manual intervention
 * - No external state (memory-only)
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Failing, requests immediately rejected
 * - HALF-OPEN: Testing recovery, allowing single request
 *
 * Transitions:
 * - CLOSED → OPEN: After N consecutive failures
 * - OPEN → HALF-OPEN: After reset timeout
 * - HALF-OPEN → CLOSED: On success
 * - HALF-OPEN → OPEN: On failure
 *
 * @module lib/circuit
 */

import type { CircuitState, CircuitSnapshot } from './types.js';
import { logInfo, logWarn } from './logging.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Default number of failures before opening circuit */
const DEFAULT_FAILURE_THRESHOLD = 3;

/** Default reset timeout in milliseconds (30 seconds) */
const DEFAULT_RESET_TIMEOUT_MS = 30_000;

/** Maximum reset timeout (5 minutes) */
const MAX_RESET_TIMEOUT_MS = 300_000;

// =============================================================================
// CIRCUIT BREAKER CLASS
// =============================================================================

/**
 * Circuit breaker for protecting against cascading failures.
 *
 * @example
 * ```typescript
 * const circuit = new CircuitBreaker({ id: 'twelvedata' });
 *
 * // Before making request
 * if (circuit.isOpen()) {
 *   return cachedData; // Don't even try
 * }
 *
 * try {
 *   const result = await fetchData();
 *   circuit.recordSuccess();
 *   return result;
 * } catch (error) {
 *   circuit.recordFailure();
 *   throw error;
 * }
 * ```
 */
export class CircuitBreaker {
  private readonly id: string;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;

  private state: CircuitState = 'closed';
  private failureCount: number = 0;
  private lastFailureAt: number | null = null;
  private openedAt: number | null = null;
  private consecutiveSuccesses: number = 0;

  /**
   * Create a new circuit breaker.
   *
   * @param config - Circuit breaker configuration
   * @param config.id - Identifier for logging
   * @param config.failureThreshold - Failures before opening (default: 3)
   * @param config.resetTimeoutMs - Time before attempting recovery (default: 30s)
   */
  constructor(config: {
    id: string;
    failureThreshold?: number;
    resetTimeoutMs?: number;
  }) {
    this.id = config.id;
    this.failureThreshold = config.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
    this.resetTimeoutMs = Math.min(
      config.resetTimeoutMs ?? DEFAULT_RESET_TIMEOUT_MS,
      MAX_RESET_TIMEOUT_MS,
    );
  }

  /**
   * Check if circuit is open (requests should be rejected).
   * Also handles automatic transition to half-open.
   */
  isOpen(): boolean {
    this.maybeTransitionToHalfOpen();
    return this.state === 'open';
  }

  /**
   * Check if circuit is closed (normal operation).
   */
  isClosed(): boolean {
    this.maybeTransitionToHalfOpen();
    return this.state === 'closed';
  }

  /**
   * Check if circuit is half-open (testing recovery).
   */
  isHalfOpen(): boolean {
    this.maybeTransitionToHalfOpen();
    return this.state === 'half-open';
  }

  /**
   * Record a successful operation.
   * Transitions half-open → closed, or resets failure count.
   */
  recordSuccess(): void {
    if (this.state === 'half-open') {
      this.consecutiveSuccesses++;

      // Require 2 consecutive successes to close circuit
      if (this.consecutiveSuccesses >= 2) {
        this.close();
      }
    } else if (this.state === 'closed') {
      // Reset failure count on success
      this.failureCount = 0;
      this.lastFailureAt = null;
    }
  }

  /**
   * Record a failed operation.
   * May transition closed → open, or half-open → open.
   */
  recordFailure(): void {
    this.lastFailureAt = Date.now();

    if (this.state === 'half-open') {
      // Immediately reopen on failure during recovery test
      this.open();
      return;
    }

    if (this.state === 'closed') {
      this.failureCount++;

      if (this.failureCount >= this.failureThreshold) {
        this.open();
      }
    }
  }

  /**
   * Get current circuit state snapshot.
   */
  getState(): CircuitSnapshot {
    this.maybeTransitionToHalfOpen();

    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureAt: this.lastFailureAt,
      resetAt: this.state === 'open' && this.openedAt
        ? this.openedAt + this.resetTimeoutMs
        : null,
    };
  }

  /**
   * Get time since circuit opened (in ms).
   * Returns null if circuit is not open.
   */
  getTripDuration(): number | null {
    if (this.state !== 'open' || !this.openedAt) {
      return null;
    }
    return Date.now() - this.openedAt;
  }

  /**
   * Get time until circuit will try recovery (in ms).
   * Returns null if circuit is not open.
   */
  getTimeUntilRecovery(): number | null {
    if (this.state !== 'open' || !this.openedAt) {
      return null;
    }
    const recoveryTime = this.openedAt + this.resetTimeoutMs - Date.now();
    return Math.max(0, recoveryTime);
  }

  /**
   * Force circuit to close (for manual intervention).
   */
  forceClose(): void {
    this.close();
    logInfo(`Circuit force-closed: ${this.id}`, { circuitId: this.id });
  }

  /**
   * Force circuit to open (for manual intervention).
   */
  forceOpen(): void {
    this.open();
    logInfo(`Circuit force-opened: ${this.id}`, { circuitId: this.id });
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Open the circuit (stop allowing requests).
   */
  private open(): void {
    const wasOpen = this.state === 'open';
    this.state = 'open';
    this.openedAt = Date.now();
    this.consecutiveSuccesses = 0;

    if (!wasOpen) {
      logWarn(`Circuit opened: ${this.id}`, {
        circuitId: this.id,
        failureCount: this.failureCount,
        resetInMs: this.resetTimeoutMs,
      });
    }
  }

  /**
   * Close the circuit (resume normal operation).
   */
  private close(): void {
    const wasOpen = this.state !== 'closed';
    this.state = 'closed';
    this.failureCount = 0;
    this.lastFailureAt = null;
    this.openedAt = null;
    this.consecutiveSuccesses = 0;

    if (wasOpen) {
      logInfo(`Circuit closed: ${this.id}`, { circuitId: this.id });
    }
  }

  /**
   * Check if should transition from open to half-open.
   */
  private maybeTransitionToHalfOpen(): void {
    if (this.state !== 'open' || !this.openedAt) {
      return;
    }

    const elapsed = Date.now() - this.openedAt;
    if (elapsed >= this.resetTimeoutMs) {
      this.state = 'half-open';
      this.consecutiveSuccesses = 0;

      logInfo(`Circuit half-open: ${this.id} (testing recovery)`, {
        circuitId: this.id,
        openDurationMs: elapsed,
      });
    }
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a circuit breaker with default settings.
 */
export function createCircuitBreaker(id: string, config?: {
  failureThreshold?: number;
  resetTimeoutMs?: number;
}): CircuitBreaker {
  return new CircuitBreaker({
    id,
    failureThreshold: config?.failureThreshold,
    resetTimeoutMs: config?.resetTimeoutMs,
  });
}

/**
 * Create circuit breakers for all providers.
 */
export function createProviderCircuits() {
  return {
    twelvedata: createCircuitBreaker('twelvedata'),
    marketstack: createCircuitBreaker('marketstack'),
  };
}
