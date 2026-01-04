// src/lib/location/index.ts
// ============================================================================
// GEOGRAPHIC LOCATION UTILITIES
// ============================================================================
// Provides location detection, geographic calculations, and exchange ordering
// relative to a user's location or the Greenwich meridian.
//
// Authority: docs/authority/paid_tier.md §3.4, §5.2
// ============================================================================

import type { Exchange } from '@/data/exchanges/types';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Greenwich Observatory coordinates - the universal baseline.
 * Used for: debugging, screenshots, anonymous users, and paid user toggle.
 */
export const GREENWICH: GeoCoordinates = {
  latitude: 51.4769,
  longitude: 0,
};

/**
 * How long to cache location in localStorage (24 hours).
 */
export const LOCATION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * localStorage key for cached location.
 */
export const LOCATION_STORAGE_KEY = 'promagen_user_location';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Geographic coordinates in decimal degrees.
 */
export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

/**
 * User location with metadata about how it was obtained.
 */
export interface UserLocation extends GeoCoordinates {
  /** How the location was obtained */
  source: 'gps' | 'ip' | 'default';
  /** When the location was detected (Unix timestamp) */
  timestamp: number;
  /** City name (if available from IP geolocation) */
  city?: string;
  /** Country code (if available) */
  countryCode?: string;
}

/**
 * Reference frame for exchange ordering.
 * - 'user': Order relative to user's detected location
 * - 'greenwich': Order relative to Greenwich (0° longitude)
 */
export type ReferenceFrame = 'user' | 'greenwich';

/**
 * Exchange with computed relative bearing for sorting.
 */
interface ExchangeWithBearing extends Exchange {
  /** Bearing from reference point (0-360°, 0=North, 90=East) */
  relativeBearing: number;
  /** Signed longitude difference from reference (-180 to +180) */
  longitudeDiff: number;
}

// ============================================================================
// GEOGRAPHIC CALCULATIONS
// ============================================================================

/**
 * Normalize longitude to -180 to +180 range.
 */
function normalizeLongitude(lng: number): number {
  let normalized = lng;
  while (normalized > 180) normalized -= 360;
  while (normalized < -180) normalized += 360;
  return normalized;
}

/**
 * Calculate the signed longitude difference from reference to target.
 * Positive = target is east of reference
 * Negative = target is west of reference
 *
 * Handles the antimeridian (international date line) correctly.
 */
export function calculateLongitudeDiff(
  referenceLng: number,
  targetLng: number
): number {
  const ref = normalizeLongitude(referenceLng);
  const target = normalizeLongitude(targetLng);

  let diff = target - ref;

  // Handle wrap-around at antimeridian
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;

  return diff;
}

/**
 * Calculate the bearing (compass direction) from reference to target.
 * Returns degrees 0-360 where 0=North, 90=East, 180=South, 270=West.
 *
 * Uses the forward azimuth formula for accuracy.
 */
export function calculateBearing(
  reference: GeoCoordinates,
  target: GeoCoordinates
): number {
  const lat1 = (reference.latitude * Math.PI) / 180;
  const lat2 = (target.latitude * Math.PI) / 180;
  const dLon = ((target.longitude - reference.longitude) * Math.PI) / 180;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  const bearing = (Math.atan2(y, x) * 180) / Math.PI;

  // Normalize to 0-360
  return (bearing + 360) % 360;
}

// ============================================================================
// EXCHANGE ORDERING
// ============================================================================

/**
 * Order exchanges from east to west relative to a reference point.
 *
 * Algorithm:
 * 1. Calculate longitude difference from reference to each exchange
 * 2. Positive diff = east of reference (appears first/left)
 * 3. Negative diff = west of reference (appears last/right)
 * 4. Sort by longitude difference descending (most east first)
 *
 * @param exchanges - Array of exchanges to order
 * @param reference - Reference point (user location or Greenwich)
 * @returns Exchanges ordered east→west relative to reference
 */
export function orderExchangesRelative(
  exchanges: ReadonlyArray<Exchange>,
  reference: GeoCoordinates
): Exchange[] {
  // Calculate relative position for each exchange
  const withBearing: ExchangeWithBearing[] = exchanges.map((exchange) => ({
    ...exchange,
    relativeBearing: calculateBearing(reference, {
      latitude: exchange.latitude,
      longitude: exchange.longitude,
    }),
    longitudeDiff: calculateLongitudeDiff(reference.longitude, exchange.longitude),
  }));

  // Sort by longitude difference descending (most east first)
  // Most positive = furthest east = appears first (left rail)
  // Most negative = furthest west = appears last (right rail)
  return withBearing
    .sort((a, b) => {
      // Primary sort: longitude difference (east to west)
      if (a.longitudeDiff !== b.longitudeDiff) {
        return b.longitudeDiff - a.longitudeDiff;
      }
      // Secondary sort: city name (for consistent ordering)
      return (a.city || a.id).localeCompare(b.city || b.id);
    })
    .map(({ relativeBearing: _rb, longitudeDiff: _ld, ...exchange }) => exchange);
}

/**
 * Split ordered exchanges into left and right rails.
 * Left rail = more easterly half (relative to reference)
 * Right rail = more westerly half (reversed for visual symmetry)
 *
 * @param exchanges - Exchanges already ordered east→west
 * @returns Object with left and right exchange arrays
 */
export function splitRails(
  exchanges: ReadonlyArray<Exchange>
): { left: Exchange[]; right: Exchange[] } {
  if (!exchanges.length) {
    return { left: [], right: [] };
  }

  const half = Math.ceil(exchanges.length / 2);
  const left = exchanges.slice(0, half) as Exchange[];
  // Reverse right rail so bottom of left aligns with top of right geographically
  const right = exchanges.slice(half).reverse() as Exchange[];

  return { left, right };
}

/**
 * Order exchanges relative to a reference point and split into rails.
 * Combines orderExchangesRelative + splitRails in one call.
 *
 * @param exchanges - Array of exchanges to order and split
 * @param reference - Reference point (user location or Greenwich)
 * @returns Object with left (eastern) and right (western) exchange arrays
 */
export function getRailsRelative(
  exchanges: ReadonlyArray<Exchange>,
  reference: GeoCoordinates
): { left: Exchange[]; right: Exchange[] } {
  const ordered = orderExchangesRelative(exchanges, reference);
  return splitRails(ordered);
}

// ============================================================================
// LOCATION CACHE
// ============================================================================

/**
 * Save location to localStorage with timestamp.
 */
export function cacheLocation(location: UserLocation): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(location));
  } catch (error) {
    console.warn('[location] Failed to cache location:', error);
  }
}

/**
 * Get cached location from localStorage.
 * Returns null if not cached or expired.
 */
export function getCachedLocation(): UserLocation | null {
  if (typeof window === 'undefined') return null;

  try {
    const cached = localStorage.getItem(LOCATION_STORAGE_KEY);
    if (!cached) return null;

    const location: UserLocation = JSON.parse(cached);

    // Check if expired
    const age = Date.now() - location.timestamp;
    if (age > LOCATION_CACHE_TTL_MS) {
      localStorage.removeItem(LOCATION_STORAGE_KEY);
      return null;
    }

    return location;
  } catch (error) {
    console.warn('[location] Failed to read cached location:', error);
    return null;
  }
}

/**
 * Clear cached location.
 */
export function clearCachedLocation(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(LOCATION_STORAGE_KEY);
  } catch (error) {
    console.warn('[location] Failed to clear cached location:', error);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { ExchangeWithBearing };
