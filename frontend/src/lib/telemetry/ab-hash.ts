// src/lib/telemetry/ab-hash.ts
// ============================================================================
// A/B TESTING — Stable Anonymous Browser Hash
// ============================================================================
//
// Generates and persists an anonymous UUID in localStorage for stable
// A/B test assignment across sessions. This is the "identity" that
// determines which variant a user sees.
//
// Privacy posture:
// - Opaque random UUID — cannot be linked to a person
// - No PII, no cookies, no credentials
// - GDPR safe: equivalent to a random dice roll stored locally
// - If localStorage is blocked → falls back to sessionId (per-tab)
// - Server-side (SSR) → returns null (no localStorage available)
//
// Authority: docs/authority/phase-7_6-ab-testing-pipeline-buildplan.md § 2
//
// Version: 1.0.0
// Created: 2026-02-27
//
// Existing features preserved: Yes.
// ============================================================================

/** localStorage key for the persistent anonymous A/B hash */
const AB_HASH_KEY = 'promagen_ab_hash';

/**
 * Module-level cache to avoid repeated localStorage reads within a session.
 * Reset to null on module reload (page navigation / hot reload).
 */
let cachedHash: string | null = null;

/**
 * Get or create a stable anonymous hash for A/B test assignment.
 *
 * Behaviour:
 * 1. Server-side (SSR): returns null (no window/localStorage)
 * 2. localStorage available: reads or creates a UUID, persists it
 * 3. localStorage blocked: falls back to session-scoped UUID
 *    (re-randomised per tab — acceptable degradation, user just
 *    won't have stable assignment across sessions)
 *
 * @returns Stable anonymous UUID string, or null if running on server
 */
export function getAbHash(): string | null {
  // SSR guard — no window on the server
  if (typeof window === 'undefined') {
    return null;
  }

  // Return cached value if available (avoids repeated localStorage reads)
  if (cachedHash) {
    return cachedHash;
  }

  try {
    // Try reading existing hash from localStorage
    const stored = window.localStorage.getItem(AB_HASH_KEY);
    if (stored && stored.length > 0) {
      cachedHash = stored;
      return cachedHash;
    }

    // Generate new UUID and persist
    const newHash = crypto.randomUUID();
    window.localStorage.setItem(AB_HASH_KEY, newHash);
    cachedHash = newHash;
    return cachedHash;
  } catch {
    // localStorage blocked (incognito, storage quota, security policy)
    // Fall back to session-scoped UUID — less stable but functional
    const fallback = crypto.randomUUID();
    cachedHash = fallback;
    return cachedHash;
  }
}

/**
 * Clear the cached hash (useful for testing).
 * Does NOT remove the localStorage entry — only clears the in-memory cache.
 */
export function _resetAbHashCache(): void {
  cachedHash = null;
}
