// src/hooks/use-exchange-order.ts
// ============================================================================
// USE EXCHANGE ORDER — Client-side exchange reordering hook
// ============================================================================
// Combines auth state + browser timezone → reordered exchange array.
//
// Anonymous / Free: standard east-to-west Greenwich ordering (passthrough).
// Pro (user frame):  rotated so the user's nearest exchange is first.
// Pro (greenwich):   standard east-to-west (user toggled back to Greenwich).
//
// The server sends exchanges in standard east-to-west order. This hook
// rotates the array on the client for Pro users — zero server changes.
//
// Authority: docs/authority/exchange-ordering.md
// Existing features preserved: Yes — zero-arg behaviour identical to before.
// ============================================================================

'use client';

import { useMemo } from 'react';
import type { Exchange } from '@/data/exchanges/types';
import { sortExchangesForUser } from '@/lib/exchange-order';
import { getUserLongitude, getUserCityFromTimezone } from '@/lib/geo/tz-longitudes';
import { usePromagenAuth } from '@/hooks/use-promagen-auth';

export interface ExchangeOrderResult {
  /** Exchanges in display order (rotated for Pro, passthrough for free) */
  ordered: Exchange[];
  /** Left rail (first half of ordered) */
  left: Exchange[];
  /** Right rail (second half of ordered, reversed for visual symmetry) */
  right: Exchange[];
  /** Human-readable label for the current reference point */
  referenceLabel: string;
  /** Whether the user has Pro-level ordering active */
  isUserAnchored: boolean;
}

/**
 * Client-side exchange ordering hook.
 *
 * Takes the server-provided east-to-west exchange array and optionally
 * rotates it for Pro users based on their browser timezone.
 *
 * @param serverExchanges - Exchanges from server (standard east-to-west order)
 * @returns Ordered exchanges + rail split + reference label
 *
 * @example
 * ```tsx
 * const { left, right, referenceLabel } = useExchangeOrder(exchanges);
 * // Free user: left=[NZX,ASX,TSE,...], referenceLabel="Greenwich"
 * // Pro in Tokyo: left=[TSE,HKEX,BSE,...], referenceLabel="Tokyo"
 * ```
 */
export function useExchangeOrder(
  serverExchanges: ReadonlyArray<Exchange>,
): ExchangeOrderResult {
  const { locationInfo } = usePromagenAuth();

  const result = useMemo(() => {
    const exchanges = serverExchanges as Exchange[];
    if (exchanges.length === 0) {
      return {
        ordered: [],
        left: [],
        right: [],
        referenceLabel: 'Greenwich',
        isUserAnchored: false,
      };
    }

    // Only rotate for Pro users in 'user' reference frame
    const shouldRotate = locationInfo.referenceFrame === 'user' && !locationInfo.isFallback;

    let ordered: Exchange[];
    let referenceLabel: string;
    let isUserAnchored = false;

    if (shouldRotate) {
      const userLong = getUserLongitude();

      if (userLong !== null) {
        // sortExchangesForUser expects a pre-sorted east→west array.
        // Server already sends in east→west order, so we can rotate directly.
        ordered = sortExchangesForUser(exchanges, userLong);
        referenceLabel = getUserCityFromTimezone();
        isUserAnchored = true;
      } else {
        // Unknown timezone — fall back to standard Greenwich ordering
        ordered = exchanges;
        referenceLabel = 'Greenwich';
      }
    } else {
      // Anonymous, free, or Pro user who toggled to Greenwich
      ordered = exchanges;
      referenceLabel = 'Greenwich';
    }

    // Rail split — same logic as getRailsForHomepage()
    const half = Math.ceil(ordered.length / 2);
    const left = ordered.slice(0, half);
    const right = ordered.slice(half).reverse();

    return { ordered, left, right, referenceLabel, isUserAnchored };
  }, [serverExchanges, locationInfo.referenceFrame, locationInfo.isFallback]);

  return result;
}

export default useExchangeOrder;
