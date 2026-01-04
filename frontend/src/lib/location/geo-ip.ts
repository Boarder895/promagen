// src/lib/location/geo-ip.ts
// ============================================================================
// IP GEOLOCATION FALLBACK
// ============================================================================
// Free IP geolocation using ipapi.co (1000 requests/day free tier).
// Used as fallback when browser geolocation is denied or unavailable.
//
// Authority: docs/authority/TODO-api-integration.md §3.1
// ============================================================================

import type { UserLocation } from './index';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Response shape from ipapi.co API.
 */
interface IpApiResponse {
  ip?: string;
  city?: string;
  region?: string;
  country_code?: string;
  country_name?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  error?: boolean;
  reason?: string;
}

// ============================================================================
// API
// ============================================================================

/**
 * Get location from IP address using ipapi.co free API.
 *
 * Free tier: 1000 requests/day (no API key required)
 * Rate limit: ~30 requests/minute
 *
 * @returns UserLocation with source='ip', or null on error
 */
export async function getLocationFromIP(): Promise<UserLocation | null> {
  try {
    // Use HTTPS endpoint, request JSON format
    const response = await fetch('https://ipapi.co/json/', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      // Short timeout - this is a fallback, don't block forever
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.warn('[geo-ip] API returned non-OK status:', response.status);
      return null;
    }

    const data: IpApiResponse = await response.json();

    // Check for API error
    if (data.error) {
      console.warn('[geo-ip] API error:', data.reason);
      return null;
    }

    // Validate required fields
    if (typeof data.latitude !== 'number' || typeof data.longitude !== 'number') {
      console.warn('[geo-ip] Missing latitude/longitude in response');
      return null;
    }

    return {
      latitude: data.latitude,
      longitude: data.longitude,
      source: 'ip',
      timestamp: Date.now(),
      city: data.city,
      countryCode: data.country_code,
    };
  } catch (error) {
    // Network error, timeout, or parse error
    console.warn('[geo-ip] Failed to get IP location:', error);
    return null;
  }
}

/**
 * Alternative IP geolocation using ip-api.com (backup).
 * Free tier: 45 requests/minute, no daily limit
 *
 * Use this if ipapi.co is unavailable.
 */
export async function getLocationFromIPBackup(): Promise<UserLocation | null> {
  try {
    // Note: ip-api.com requires HTTP (not HTTPS) for free tier
    // For production, consider using the paid HTTPS endpoint
    const response = await fetch('http://ip-api.com/json/?fields=status,lat,lon,city,countryCode', {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data.status !== 'success') {
      return null;
    }

    if (typeof data.lat !== 'number' || typeof data.lon !== 'number') {
      return null;
    }

    return {
      latitude: data.lat,
      longitude: data.lon,
      source: 'ip',
      timestamp: Date.now(),
      city: data.city,
      countryCode: data.countryCode,
    };
  } catch {
    return null;
  }
}
