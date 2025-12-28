// frontend/src/lib/exchange-order.ts
// ============================================================================
// Exchange Ordering + Rail Split Logic
// ============================================================================
// Provides east-to-west ordering of exchanges for the homepage rails.
// Uses the canonical Exchange type from @/data/exchanges.
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

// ============================================================================
// Public API
// ============================================================================

/**
 * Returns the left/right rails for the homepage:
 * - Loads the selected exchanges
 * - Orders them east→west using longitude
 * - Splits into two rails:
 *   - Left rail: more easterly half (ceil)
 *   - Right rail: more westerly half (reversed for visual symmetry)
 *
 * @returns Object with left and right exchange arrays
 *
 * @example
 * ```ts
 * const { left, right } = getRailsForHomepage();
 * // left = [Tokyo, Sydney, ...] (eastern)
 * // right = [New York, Chicago, ...] (western, reversed)
 * ```
 */
export function getRailsForHomepage(): Rails {
  const selected = loadSelectedExchanges();
  if (!selected.length) return { left: [], right: [] };

  const ordered = sortEastToWest(selected);

  const half = Math.ceil(ordered.length / 2);
  const left = ordered.slice(0, half);
  const right = ordered.slice(half).reverse();

  return { left, right };
}

/**
 * Returns the full east→west list of homepage exchanges.
 * Reconstructed from the rails for convenience.
 *
 * @returns Array of exchanges sorted east to west
 */
export function getHomepageExchanges(): Exchange[] {
  const { left, right } = getRailsForHomepage();
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
