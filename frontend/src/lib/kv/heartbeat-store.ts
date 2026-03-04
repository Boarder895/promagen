// src/lib/kv/heartbeat-store.ts
// ============================================================================
// HEARTBEAT KV STORE — Vercel KV operations for online users
// ============================================================================
// Extends the base KV adapter with:
// - SETEX: set with TTL (auto-expire heartbeats after 120s)
// - KEYS:  scan by prefix (aggregate active heartbeats)
//
// Uses the same Upstash Redis REST API pattern as adapters/vercel.ts.
// Falls back gracefully when VERCEL_KV_HTTP_BASE is not configured —
// all methods return empty/null so the Online Users component stays hidden
// (threshold not met).
//
// Authority: docs/authority/homepage.md §8.4
// Existing features preserved: Yes (additive module, does not modify adapters/)
// ============================================================================

import 'server-only';

// ============================================================================
// CONFIG
// ============================================================================

const BASE = process.env['VERCEL_KV_HTTP_BASE'] ?? '';
const TOKEN = process.env['VERCEL_KV_TOKEN'];

/** Namespace prefix for all heartbeat keys. */
const HB_PREFIX = 'hb';

/** Heartbeat TTL in seconds (2 minutes — stale after this). */
const HB_TTL_SECONDS = 120;

// ============================================================================
// HTTP HELPER (same pattern as adapters/vercel.ts)
// ============================================================================

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'content-type': 'application/json' };
  if (TOKEN) h['Authorization'] = `Bearer ${TOKEN}`;
  return h;
}

interface UpstashResponse<T = unknown> {
  result: T;
}

async function cmd<T = unknown>(...args: (string | number)[]): Promise<T | null> {
  if (!BASE) return null;

  try {
    const res = await fetch(`${BASE}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(args),
      cache: 'no-store',
    });

    if (!res.ok) {
      console.warn(`[heartbeat-store] KV HTTP ${res.status}`);
      return null;
    }

    const data = (await res.json()) as UpstashResponse<T>;
    return data.result ?? null;
  } catch (error) {
    console.warn('[heartbeat-store] KV error:', error);
    return null;
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Check whether Vercel KV is configured.
 * If false, all operations are no-ops and Online Users stays hidden.
 */
export function hasKvConfigured(): boolean {
  return Boolean(BASE && BASE.trim().length > 0);
}

/**
 * Record a heartbeat for a session.
 * Key: `hb:{sessionId}` → value: `{countryCode}` with 120s TTL.
 */
export async function setHeartbeat(sessionId: string, countryCode: string): Promise<void> {
  if (!hasKvConfigured()) return;
  const key = `${HB_PREFIX}:${sessionId}`;
  await cmd('SET', key, countryCode, 'EX', HB_TTL_SECONDS);
}

/**
 * Get all active heartbeat keys and their country codes.
 * Returns a Map<sessionId, countryCode> for all non-expired heartbeats.
 *
 * Uses Redis KEYS command (fine for < 10K keys; heartbeats are bounded
 * by TTL so the max is ~concurrent_users which is far below this).
 */
export async function getAllHeartbeats(): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (!hasKvConfigured()) return result;

  // Step 1: Get all heartbeat keys
  const keys = await cmd<string[]>('KEYS', `${HB_PREFIX}:*`);
  if (!keys || keys.length === 0) return result;

  // Step 2: MGET all values in one round-trip
  const values = await cmd<(string | null)[]>('MGET', ...keys);
  if (!values) return result;

  // Step 3: Zip keys + values
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]!;
    const cc = values[i];
    if (cc) {
      // Strip prefix: "hb:abc123" → "abc123"
      const sessionId = key.slice(HB_PREFIX.length + 1);
      result.set(sessionId, cc);
    }
  }

  return result;
}

/**
 * Aggregate active heartbeats into per-country counts.
 * Returns { total, countries: [{ countryCode, count }] } sorted by count desc.
 */
export async function aggregateOnlineUsers(): Promise<{
  total: number;
  countries: { countryCode: string; count: number }[];
}> {
  const heartbeats = await getAllHeartbeats();

  if (heartbeats.size === 0) {
    return { total: 0, countries: [] };
  }

  // Count per country
  const counts = new Map<string, number>();
  for (const cc of heartbeats.values()) {
    counts.set(cc, (counts.get(cc) ?? 0) + 1);
  }

  // Sort by count descending
  const countries = [...counts.entries()]
    .map(([countryCode, count]) => ({ countryCode, count }))
    .sort((a, b) => b.count - a.count);

  return { total: heartbeats.size, countries };
}
