// src/hooks/use-user-location.ts
// ============================================================================
// USER LOCATION DETECTION HOOK
// ============================================================================
// Provides user location for geographic exchange ordering.
//
// Detection flow:
// 1. Check localStorage cache (valid for 24h)
// 2. Try browser geolocation API (requires permission)
// 3. Fall back to IP geolocation (free API)
// 4. Default to Greenwich if all else fails
//
// Authority: docs/authority/paid_tier.md §3.4
// ============================================================================

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  type UserLocation,
  type GeoCoordinates,
  GREENWICH,
  getCachedLocation,
  cacheLocation,
  clearCachedLocation,
} from '@/lib/location';
import { getLocationFromIP } from '@/lib/location/geo-ip';

// ============================================================================
// TYPES
// ============================================================================

export interface UseUserLocationState {
  /** Current user location (null while loading) */
  location: UserLocation | null;
  /** Effective coordinates (location or Greenwich fallback) */
  coordinates: GeoCoordinates;
  /** Whether location is being detected */
  isLoading: boolean;
  /** Whether user denied location permission */
  isPermissionDenied: boolean;
  /** Error message if detection failed */
  error: string | null;
  /** Whether using fallback (IP or default) */
  isFallback: boolean;
}

export interface UseUserLocationReturn extends UseUserLocationState {
  /** Manually refresh location (re-detect) */
  refreshLocation: () => Promise<void>;
  /** Clear cached location and re-detect */
  resetLocation: () => Promise<void>;
}

// ============================================================================
// BROWSER GEOLOCATION
// ============================================================================

/**
 * Get user's position from browser Geolocation API.
 * Wraps navigator.geolocation.getCurrentPosition in a Promise.
 */
function getBrowserPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false, // Don't need high accuracy, just city-level
      timeout: 10000, // 10 second timeout
      maximumAge: 300000, // Accept cached position up to 5 minutes old
    });
  });
}

/**
 * Attempt to get location from browser Geolocation API.
 * Returns null if permission denied or unavailable.
 */
async function getLocationFromBrowser(): Promise<UserLocation | null> {
  try {
    const position = await getBrowserPosition();

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      source: 'gps',
      timestamp: Date.now(),
    };
  } catch (error) {
    const geoError = error as GeolocationPositionError;

    // Log specific error for debugging (using allowed console.debug)
    switch (geoError?.code) {
      case GeolocationPositionError.PERMISSION_DENIED:
        console.debug('[location] User denied geolocation permission');
        break;
      case GeolocationPositionError.POSITION_UNAVAILABLE:
        console.debug('[location] Position unavailable');
        break;
      case GeolocationPositionError.TIMEOUT:
        console.debug('[location] Geolocation request timed out');
        break;
      default:
        console.debug('[location] Geolocation error:', error);
    }

    return null;
  }
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * useUserLocation - Detect and manage user's geographic location.
 *
 * @param options.enabled - Whether to detect location (default: true)
 * @param options.skipCache - Force fresh detection, ignore cache
 *
 * @returns Location state and control functions
 *
 * @example
 * ```tsx
 * function ExchangeOrdering() {
 *   const { coordinates, isLoading, isFallback } = useUserLocation();
 *
 *   const orderedExchanges = useMemo(
 *     () => orderExchangesRelative(exchanges, coordinates),
 *     [exchanges, coordinates]
 *   );
 *
 *   return <ExchangeList exchanges={orderedExchanges} />;
 * }
 * ```
 */
export function useUserLocation(options?: {
  enabled?: boolean;
  skipCache?: boolean;
}): UseUserLocationReturn {
  const { enabled = true, skipCache = false } = options ?? {};

  const [state, setState] = useState<UseUserLocationState>({
    location: null,
    coordinates: GREENWICH,
    isLoading: enabled,
    isPermissionDenied: false,
    error: null,
    isFallback: true,
  });

  // Track if detection is in progress to prevent duplicate calls
  const isDetecting = useRef(false);

  /**
   * Detect user location with fallback chain.
   */
  const detectLocation = useCallback(async (useCache: boolean = true) => {
    // Prevent duplicate detection
    if (isDetecting.current) return;
    isDetecting.current = true;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // 1. Check cache first (unless skipped)
      if (useCache) {
        const cached = getCachedLocation();
        if (cached) {
          setState({
            location: cached,
            coordinates: { latitude: cached.latitude, longitude: cached.longitude },
            isLoading: false,
            isPermissionDenied: false,
            error: null,
            isFallback: cached.source !== 'gps',
          });
          isDetecting.current = false;
          return;
        }
      }

      // 2. Try browser geolocation
      const browserLocation = await getLocationFromBrowser();
      if (browserLocation) {
        cacheLocation(browserLocation);
        setState({
          location: browserLocation,
          coordinates: { latitude: browserLocation.latitude, longitude: browserLocation.longitude },
          isLoading: false,
          isPermissionDenied: false,
          error: null,
          isFallback: false,
        });
        isDetecting.current = false;
        return;
      }

      // 3. Fallback to IP geolocation
      const ipLocation = await getLocationFromIP();
      if (ipLocation) {
        cacheLocation(ipLocation);
        setState({
          location: ipLocation,
          coordinates: { latitude: ipLocation.latitude, longitude: ipLocation.longitude },
          isLoading: false,
          isPermissionDenied: true, // Browser was denied, using IP
          error: null,
          isFallback: true,
        });
        isDetecting.current = false;
        return;
      }

      // 4. All detection failed - use Greenwich default
      const defaultLocation: UserLocation = {
        ...GREENWICH,
        source: 'default',
        timestamp: Date.now(),
      };

      setState({
        location: defaultLocation,
        coordinates: GREENWICH,
        isLoading: false,
        isPermissionDenied: true,
        error: 'Could not detect location, using default',
        isFallback: true,
      });
    } catch (error) {
      console.error('[useUserLocation] Detection failed:', error);

      setState({
        location: null,
        coordinates: GREENWICH,
        isLoading: false,
        isPermissionDenied: false,
        error: 'Location detection failed',
        isFallback: true,
      });
    } finally {
      isDetecting.current = false;
    }
  }, []);

  /**
   * Refresh location (re-detect using cache).
   */
  const refreshLocation = useCallback(async () => {
    await detectLocation(true);
  }, [detectLocation]);

  /**
   * Reset location - clear cache and re-detect fresh.
   */
  const resetLocation = useCallback(async () => {
    clearCachedLocation();
    await detectLocation(false);
  }, [detectLocation]);

  // Detect location on mount (if enabled)
  useEffect(() => {
    if (!enabled) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isFallback: true,
      }));
      return;
    }

    detectLocation(!skipCache);
  }, [enabled, skipCache, detectLocation]);

  return {
    ...state,
    refreshLocation,
    resetLocation,
  };
}

export default useUserLocation;
