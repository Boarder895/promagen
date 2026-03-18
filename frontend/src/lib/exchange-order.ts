// frontend/src/lib/exchange-order.ts
// ============================================================================
// Exchange Ordering + Rail Split Logic
// ============================================================================
// Provides east-to-west ordering of exchanges for the homepage rails.
// Uses the canonical Exchange type from @/data/exchanges.
//
// v2.0.0 (18 Mar 2026):
// - Added sortExchangesForUser(): array rotation for Pro user-anchored ordering.
// - getRailsForHomepage() + getHomepageExchanges() now accept optional
//   userLongitude param. When provided, exchanges rotate so the user's
//   nearest market is first. When omitted, standard Greenwich ordering.
// - Existing test contract preserved: zero-arg calls behave identically.
//
// Authority: docs/authority/exchange-ordering.md
// ============================================================================

import EXCHANGES from '@/data/exchanges';
import type { Exchange } from '@/data/exchanges/types';
import EXCHANGES_SELECTED_RAW from '@/data/exchanges/exchanges.selected.json';

// Re-export the canonical Exchange type for backward compatibility
export type { Exchange } from '@/data/exchanges/types';

/**
 * Left and right rails for the homepage exchange display.
 */
export type Rails = {
  left: Exchange[];
  right: Exchange[];
};

// ============================================================================
// Internal Helpers
// ============================================================================

type SelectedJson = { ids?: unknown };

/**
 * Extract selected exchange IDs from the JSON config.
 */
function getSelectedIds(raw: unknown): string[] {
  if (!raw || typeof raw !== 'object' || !('ids' in (raw as Record<string, unknown>))) {
    return [];
  }

  const ids = (raw as SelectedJson).ids;
  if (!Array.isArray(ids)) return [];

  return ids.map((id) => String(id ?? '').trim()).filter((id) => id.length > 0);
}

/**
 * Build a map of id → Exchange from the catalog.
 */
function buildExchangeIndex(): Map<string, Exchange> {
  const map = new Map<string, Exchange>();

  for (const exchange of EXCHANGES) {
    const id = exchange.id?.trim();
    if (id && !map.has(id)) {
      map.set(id, exchange);
    }
  }

  return map;
}

/**
 * Load the selected exchanges by ID, resolving from the catalog.
 * Missing IDs get a minimal placeholder so the UI doesn't break.
 */
function loadSelectedExchanges(): Exchange[] {
  const selectedIds = getSelectedIds(EXCHANGES_SELECTED_RAW as unknown);
  if (!selectedIds.length) return [];

  const byId = buildExchangeIndex();
  const result: Exchange[] = [];

  for (const id of selectedIds) {
    const exchange = byId.get(id);

    if (exchange) {
      result.push(exchange);
    } else {
      // Fallback placeholder for missing exchanges
      const placeholder: Exchange = {
        id,
        city: '',
        exchange: id,
        country: '',
        iso2: '',
        tz: 'Etc/UTC',
        longitude: 0,
        latitude: 0,
        hoursTemplate: '',
        holidaysRef: '',
        hemisphere: '',
        marketstack: { 
          defaultBenchmark: '', 
          defaultIndexName: '', 
          availableIndices: [] 
        },
        hoverColor: '#6366F1',
      };
      result.push(placeholder);

      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[exchange-order] Selected id "${id}" not found in catalog`);
      }
    }
  }

  return result;
}

/**
 * Sort exchanges from east to west by longitude.
 * Higher positive longitude = further east (sorted first).
 */
function sortEastToWest(exchanges: Exchange[]): Exchange[] {
  return exchanges.slice().sort((a, b) => b.longitude - a.longitude);
}

/**
 * Rotate an east-to-west sorted array so the exchange nearest to (or just
 * west of) `anchorLongitude` sits at index 0. The array wraps around the
 * globe — exchanges east of the anchor come last (they represent "yesterday"
 * relative to the user).
 *
 * This is a simple array rotation — no new sort, no timezone parsing.
 *
 * @param sorted - Exchanges already sorted east → west (longitude desc)
 * @param anchorLongitude - User's longitude (e.g. 139.7 for Tokyo)
 * @returns Rotated array with user's nearest exchange first
 *
 * @example
 * // Standard: NZX(174) → ASX(151) → TSE(139) → HKEX(114) → ... → NYSE(-74)
 * // Tokyo anchor (139.7): TSE(139) → HKEX(114) → ... → NYSE(-74) → NZX(174) → ASX(151)
 */
export function sortExchangesForUser(
  sorted: Exchange[],
  anchorLongitude: number,
): Exchange[] {
  if (sorted.length <= 1) return sorted;

  // Find the first exchange at or west of the user's longitude
  const splitIdx = sorted.findIndex((e) => e.longitude <= anchorLongitude);

  // User is further east than all exchanges — no rotation needed
  if (splitIdx <= 0) return sorted;

  // Rotate: user's nearest exchange first, then wrap
  return [...sorted.slice(splitIdx), ...sorted.slice(0, splitIdx)];
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Returns the left/right rails for the homepage:
 * - Loads the selected exchanges
 * - Orders them east→west using longitude
 * - Optionally rotates to anchor around a user's longitude (Pro feature)
 * - Splits into two rails:
 *   - Left rail: first half
 *   - Right rail: second half (reversed for visual symmetry)
 *
 * @param userLongitude - Optional anchor longitude for Pro user rotation.
 *   When provided, exchanges rotate so the user's nearest market is first.
 *   When omitted or null, standard Greenwich east→west ordering is used.
 *
 * @returns Object with left and right exchange arrays
 *
 * @example
 * ```ts
 * // Standard (Greenwich):
 * const { left, right } = getRailsForHomepage();
 *
 * // Pro (Tokyo user):
 * const { left, right } = getRailsForHomepage(139.7);
 * ```
 */
export function getRailsForHomepage(userLongitude?: number | null): Rails {
  const selected = loadSelectedExchanges();
  if (!selected.length) return { left: [], right: [] };

  let ordered = sortEastToWest(selected);

  // Pro user rotation: anchor around their longitude
  if (userLongitude != null) {
    ordered = sortExchangesForUser(ordered, userLongitude);
  }

  const half = Math.ceil(ordered.length / 2);
  const left = ordered.slice(0, half);
  const right = ordered.slice(half).reverse();

  return { left, right };
}

/**
 * Returns the full ordered list of homepage exchanges.
 * Reconstructed from the rails for convenience.
 *
 * @param userLongitude - Optional anchor longitude for Pro user rotation.
 * @returns Array of exchanges in display order
 */
export function getHomepageExchanges(userLongitude?: number | null): Exchange[] {
  const { left, right } = getRailsForHomepage(userLongitude);
  if (!left.length && !right.length) return [];

  // Undo the reversal applied to the right rail
  return [...left, ...right.slice().reverse()];
}

// ============================================================================
// Legacy Helpers (for tests)
// ============================================================================

export type ExchangeRef = { id: string };
export type ExchangeIds = { ids: string[] } | string[];

/**
 * Split a list of exchange IDs into left/right "rails" by position.
 * Used in tests that don't need full Exchange objects.
 */
export function splitIds(exchanges: ExchangeIds): { left: ExchangeRef[]; right: ExchangeRef[] } {
  const ids = Array.isArray(exchanges) ? exchanges.slice() : (exchanges?.ids ?? []).slice();

  const half = Math.ceil(ids.length / 2);

  return {
    left: ids.slice(0, half).map((id): ExchangeRef => ({ id })),
    right: ids.slice(half).map((id): ExchangeRef => ({ id })),
  };
}
