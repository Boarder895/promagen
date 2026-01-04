/**
 * @file src/lib/usage/storage.ts
 * @description Vercel KV storage layer for prompt builder usage tracking
 *
 * Storage structure:
 * - promagen:usage:daily:{userId}:{date} - Daily usage counter
 *
 * Authority: docs/authority/paid_tier.md §3.3
 */

import kv, { type Json } from '@/lib/kv';
import { USAGE_NAMESPACE, USAGE_KV_KEYS, FREE_DAILY_LIMIT } from './constants';

// ============================================================================
// TYPES
// ============================================================================

export interface DailyUsage {
  userId: string;
  date: string;         // YYYY-MM-DD in user's timezone
  promptCount: number;
  timezone: string;
  lastUpdated: string;  // ISO timestamp
}

export interface UsageStatus {
  count: number;
  limit: number | null;   // null for paid users (unlimited)
  remaining: number | null;
  isAtLimit: boolean;
  resetTime: string;      // ISO timestamp of next reset
}

// ============================================================================
// TYPE HELPERS
// ============================================================================

/**
 * Convert DailyUsage to Json-compatible object for KV storage.
 * TypeScript requires explicit cast for index signature compatibility.
 */
function toJsonCompatible(usage: DailyUsage): Json {
  return {
    userId: usage.userId,
    date: usage.date,
    promptCount: usage.promptCount,
    timezone: usage.timezone,
    lastUpdated: usage.lastUpdated,
  } as Json;
}

// ============================================================================
// DAILY USAGE TRACKING
// ============================================================================

/**
 * Get user's daily usage for a specific date.
 */
export async function getDailyUsage(userId: string, date: string): Promise<DailyUsage | null> {
  const key = USAGE_KV_KEYS.dailyUsage(userId, date);
  return kv.get<DailyUsage>(USAGE_NAMESPACE, key);
}

/**
 * Increment user's daily usage count.
 * Returns updated usage data.
 */
export async function incrementDailyUsage(
  userId: string,
  date: string,
  timezone: string
): Promise<DailyUsage> {
  const existing = await getDailyUsage(userId, date);
  
  const usage: DailyUsage = {
    userId,
    date,
    promptCount: (existing?.promptCount ?? 0) + 1,
    timezone,
    lastUpdated: new Date().toISOString(),
  };
  
  const key = USAGE_KV_KEYS.dailyUsage(userId, date);
  await kv.set(USAGE_NAMESPACE, key, toJsonCompatible(usage));
  
  return usage;
}

/**
 * Check if user has reached their daily limit.
 */
export async function hasReachedDailyLimit(
  userId: string,
  date: string,
  limit: number
): Promise<boolean> {
  const usage = await getDailyUsage(userId, date);
  return (usage?.promptCount ?? 0) >= limit;
}

/**
 * Get user's usage status (count, limit, remaining).
 */
export async function getUsageStatus(
  userId: string,
  date: string,
  isPaidUser: boolean
): Promise<UsageStatus> {
  const usage = await getDailyUsage(userId, date);
  const count = usage?.promptCount ?? 0;
  const limit = isPaidUser ? null : FREE_DAILY_LIMIT;
  
  // Calculate next midnight in user's timezone
  // For simplicity, we'll return tomorrow at midnight UTC
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  
  return {
    count,
    limit,
    remaining: limit === null ? null : Math.max(0, limit - count),
    isAtLimit: limit !== null && count >= limit,
    resetTime: tomorrow.toISOString(),
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get today's date in user's timezone.
 * Uses browser timezone if available.
 */
export function getTodayInTimezone(timezone?: string): string {
  const now = new Date();
  
  if (timezone) {
    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      return formatter.format(now);
    } catch {
      // Fall back to UTC if timezone is invalid
    }
  }
  
  // Default: UTC date (guaranteed to have date part)
  const isoString = now.toISOString();
  const datePart = isoString.split('T')[0];
  // Safety: ISO string always has 'T', but TypeScript doesn't know that
  return datePart ?? isoString.slice(0, 10);
}

/**
 * Detect user's timezone from browser.
 * Returns 'UTC' as fallback.
 */
export function detectTimezone(): string {
  if (typeof window === 'undefined') {
    return 'UTC';
  }
  
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}
