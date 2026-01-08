/**
 * @file src/lib/usage/anonymous-storage.ts
 * @description Secure localStorage-based tracking for anonymous users
 * @version 2.0.0 - Added daily reset at midnight (same as authenticated users)
 *
 * Security measures:
 * - Data validation and type checking
 * - Integrity hash to detect tampering
 * - Bounds checking to prevent abuse
 * - Graceful degradation on corruption
 * - No sensitive data stored
 *
 * Daily Reset:
 * - Anonymous users now get 5 prompts per day (resets at midnight local time)
 * - Previously was 5 lifetime prompts
 * - This matches the authenticated free user experience
 *
 * Authority: docs/authority/paid_tier.md §3.2
 */

import { ANONYMOUS_FREE_LIMIT } from './constants';

// ============================================================================
// TYPES
// ============================================================================

interface AnonymousUsageData {
  /** Prompt copy count (resets daily) */
  count: number;
  /** First use timestamp (ISO) */
  firstUse: string;
  /** Last use timestamp (ISO) */
  lastUse: string;
  /** Date string of last reset (YYYY-MM-DD) for daily reset tracking */
  lastResetDate: string;
  /** Schema version for future migrations */
  version: 2;
  /** Simple integrity check (not cryptographic - just tamper detection) */
  checksum: string;
}

/**
 * Anonymous usage state for UI display.
 * Exported for use in hooks and components.
 */
export interface AnonymousUsageState {
  /** Current usage count */
  count: number;
  /** Maximum allowed for anonymous */
  limit: number;
  /** Remaining prompts */
  remaining: number;
  /** Whether limit is reached */
  isAtLimit: boolean;
  /** When the count resets (midnight local time) */
  resetTime: string | null;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY = 'promagen:anonymous:usage';
const CURRENT_VERSION = 2;
const MAX_REASONABLE_COUNT = 10000; // Sanity check upper bound

// ============================================================================
// DATE HELPERS
// ============================================================================

/**
 * Get today's date as YYYY-MM-DD string in local timezone.
 */
function getTodayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Get midnight tonight in ISO format for reset time display.
 */
function getMidnightTonight(): string {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
  return midnight.toISOString();
}

// ============================================================================
// INTEGRITY HELPERS
// ============================================================================

/**
 * Generate a simple checksum for tamper detection.
 * This is NOT cryptographic security - localStorage can always be modified.
 * It's just to detect casual tampering and reset to safe state.
 */
function generateChecksum(count: number, firstUse: string, lastResetDate: string): string {
  // Simple hash: combine values with a salt
  const input = `promagen_${count}_${firstUse}_${lastResetDate}_v2`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Validate checksum matches stored data.
 */
function validateChecksum(data: AnonymousUsageData): boolean {
  const expected = generateChecksum(data.count, data.firstUse, data.lastResetDate);
  return data.checksum === expected;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate that parsed data matches expected schema.
 * Returns null if invalid, allowing graceful reset.
 * Handles migration from v1 to v2.
 */
function validateUsageData(data: unknown): AnonymousUsageData | null {
  // Must be an object
  if (typeof data !== 'object' || data === null) {
    return null;
  }

  const obj = data as Record<string, unknown>;

  // Check required fields exist with correct types
  if (typeof obj.count !== 'number') return null;
  if (typeof obj.firstUse !== 'string') return null;
  if (typeof obj.lastUse !== 'string') return null;
  if (typeof obj.version !== 'number') return null;
  if (typeof obj.checksum !== 'string') return null;

  // Validate count is reasonable (non-negative, bounded)
  if (obj.count < 0 || obj.count > MAX_REASONABLE_COUNT || !Number.isInteger(obj.count)) {
    return null;
  }

  // Handle version migration
  if (obj.version === 1) {
    // Migrate v1 to v2: add lastResetDate as today (gives fresh start)
    console.debug('[AnonymousStorage] Migrating from v1 to v2 - resetting for daily limit');
    return null; // Return null to trigger fresh start with new schema
  }

  if (obj.version !== CURRENT_VERSION) {
    return null;
  }

  // v2 requires lastResetDate
  if (typeof obj.lastResetDate !== 'string') {
    return null;
  }

  // Validate date strings are valid ISO dates
  const firstUseDate = new Date(obj.firstUse);
  const lastUseDate = new Date(obj.lastUse);
  if (isNaN(firstUseDate.getTime()) || isNaN(lastUseDate.getTime())) {
    return null;
  }

  // Validate lastResetDate format (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(obj.lastResetDate)) {
    return null;
  }

  // Don't allow future dates (clock manipulation attempt)
  const now = new Date();
  const tolerance = 60 * 60 * 1000; // 1 hour tolerance for clock skew
  if (firstUseDate.getTime() > now.getTime() + tolerance) {
    return null;
  }

  const validated: AnonymousUsageData = {
    count: obj.count,
    firstUse: obj.firstUse,
    lastUse: obj.lastUse,
    lastResetDate: obj.lastResetDate,
    version: obj.version as 2,
    checksum: obj.checksum,
  };

  // Verify checksum
  if (!validateChecksum(validated)) {
    console.warn('[AnonymousStorage] Checksum mismatch - data may have been tampered with');
    return null;
  }

  return validated;
}

// ============================================================================
// STORAGE OPERATIONS
// ============================================================================

/**
 * Check if localStorage is available.
 * Handles private browsing and disabled storage.
 */
function isStorageAvailable(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const testKey = '__promagen_storage_test__';
    window.localStorage.setItem(testKey, 'test');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get raw usage data from storage.
 * Returns null if not found, corrupted, or invalid.
 */
function getRawUsageData(): AnonymousUsageData | null {
  if (!isStorageAvailable()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    // Parse JSON safely
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn('[AnonymousStorage] Invalid JSON in storage, resetting');
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    // Validate structure
    const validated = validateUsageData(parsed);
    if (!validated) {
      console.warn('[AnonymousStorage] Invalid data structure, resetting');
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return validated;
  } catch (error) {
    console.error('[AnonymousStorage] Failed to read storage:', error);
    return null;
  }
}

/**
 * Save usage data to storage.
 */
function saveUsageData(data: Omit<AnonymousUsageData, 'checksum'>): boolean {
  if (!isStorageAvailable()) {
    return false;
  }

  try {
    const withChecksum: AnonymousUsageData = {
      ...data,
      checksum: generateChecksum(data.count, data.firstUse, data.lastResetDate),
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(withChecksum));
    return true;
  } catch (error) {
    console.error('[AnonymousStorage] Failed to save storage:', error);
    return false;
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get current anonymous usage count.
 * Returns 0 if no data, in SSR context, or if it's a new day (reset).
 *
 * DAILY RESET: If lastResetDate is not today, count is treated as 0.
 */
export function getAnonymousCount(): number {
  const data = getRawUsageData();
  if (!data) return 0;

  // Check for daily reset
  const today = getTodayDateString();
  if (data.lastResetDate !== today) {
    // It's a new day! Reset count to 0 (will be saved on next increment)
    console.debug('[AnonymousStorage] New day detected - resetting count');
    return 0;
  }

  return data.count;
}

/**
 * Get full anonymous usage state.
 */
export function getAnonymousUsageState(): AnonymousUsageState {
  const count = getAnonymousCount();
  const limit = ANONYMOUS_FREE_LIMIT;
  const remaining = Math.max(0, limit - count);

  return {
    count,
    limit,
    remaining,
    isAtLimit: count >= limit,
    resetTime: getMidnightTonight(),
  };
}

/**
 * Check if anonymous user has reached their limit.
 */
export function isAnonymousAtLimit(): boolean {
  return getAnonymousCount() >= ANONYMOUS_FREE_LIMIT;
}

/**
 * Increment anonymous usage count.
 * Returns the new state after increment.
 *
 * DAILY RESET: If it's a new day, resets count to 1 (this is the first use today).
 *
 * Security: Validates current data before increment.
 * If data is corrupted, resets to 1 (first use).
 */
export function incrementAnonymousCount(): AnonymousUsageState {
  const now = new Date().toISOString();
  const today = getTodayDateString();
  const existing = getRawUsageData();

  let newCount: number;
  let firstUse: string;
  let lastResetDate: string;

  if (existing) {
    // Check if it's a new day
    if (existing.lastResetDate !== today) {
      // Daily reset - start fresh
      newCount = 1;
      firstUse = existing.firstUse; // Keep original first use
      lastResetDate = today;
      console.debug('[AnonymousStorage] Daily reset - count reset to 1');
    } else {
      // Same day - increment
      newCount = existing.count + 1;
      firstUse = existing.firstUse;
      lastResetDate = existing.lastResetDate;
    }
  } else {
    // First use ever
    newCount = 1;
    firstUse = now;
    lastResetDate = today;
  }

  // Cap at reasonable maximum (defensive)
  newCount = Math.min(newCount, MAX_REASONABLE_COUNT);

  const saved = saveUsageData({
    count: newCount,
    firstUse,
    lastUse: now,
    lastResetDate,
    version: CURRENT_VERSION,
  });

  if (!saved) {
    // Storage failed - return current state without increment
    // This allows the user to continue (fail open)
    console.warn('[AnonymousStorage] Failed to save increment');
  }

  const limit = ANONYMOUS_FREE_LIMIT;
  return {
    count: newCount,
    limit,
    remaining: Math.max(0, limit - newCount),
    isAtLimit: newCount >= limit,
    resetTime: getMidnightTonight(),
  };
}

/**
 * Check if user can use a prompt (not at limit).
 * Does NOT increment - use incrementAnonymousCount after successful action.
 */
export function canAnonymousUsePrompt(): boolean {
  return !isAnonymousAtLimit();
}

/**
 * Reset anonymous usage (for testing or user request).
 * In production, this is acceptable - users can always clear localStorage.
 */
export function resetAnonymousUsage(): void {
  if (!isStorageAvailable()) {
    return;
  }

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('[AnonymousStorage] Failed to reset storage:', error);
  }
}

/**
 * Get anonymous usage info for display.
 * Returns null in SSR context.
 */
export function getAnonymousUsageDisplay(): {
  count: number;
  limit: number;
  remaining: number;
  message: string;
  resetTime: string | null;
} | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const state = getAnonymousUsageState();

  let message: string;
  if (state.isAtLimit) {
    message = 'Daily limit reached. Sign in for 10 prompts/day, or wait until midnight.';
  } else if (state.remaining === 1) {
    message = '1 free prompt remaining today';
  } else {
    message = `${state.remaining} of ${state.limit} free prompts remaining today`;
  }

  return {
    count: state.count,
    limit: state.limit,
    remaining: state.remaining,
    message,
    resetTime: state.resetTime,
  };
}
