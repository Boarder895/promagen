/**
 * Promagen Frontend - Weather Route
 * ===================================
 * Proxy to the Fly.io gateway /weather endpoint.
 * 
 * Path: /api/weather
 * Method: GET
 * 
 * Weather data is public (same for all users), so no auth/tier checking needed.
 * Simply proxies to the gateway and returns the response.
 *
 * @module app/api/weather/route
 */

import { NextResponse } from 'next/server';

// =============================================================================
// CONFIGURATION
// =============================================================================

const GATEWAY_URL = process.env['GATEWAY_URL'] ?? 'https://promagen-api.fly.dev';

// =============================================================================
// TYPES
// =============================================================================

interface WeatherData {
  id: string;
  city: string;
  temperatureC: number;
  temperatureF: number;
  conditions: string;
  description: string;
  humidity: number;
  windSpeedKmh: number;
  emoji: string;
  asOf: string;
}

interface WeatherMeta {
  mode: 'live' | 'cached' | 'stale' | 'fallback';
  cachedAt?: string;
  expiresAt?: string;
  provider: string;
  currentBatch: 'A' | 'B';
  batchARefreshedAt?: string;
  batchBRefreshedAt?: string;
  budget: {
    state: string;
    dailyUsed: number;
    dailyLimit: number;
    minuteUsed: number;
    minuteLimit: number;
  };
}

interface WeatherGatewayResponse {
  meta: WeatherMeta;
  data: WeatherData[];
}

interface ErrorResponse {
  error: string;
  meta?: { mode: string };
  data?: never[];
}

// =============================================================================
// HANDLER
// =============================================================================

export async function GET(): Promise<NextResponse<WeatherGatewayResponse | ErrorResponse>> {
  try {
    const response = await fetch(`${GATEWAY_URL}/weather`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Promagen-Frontend/1.0',
      },
      // Short timeout - don't block the UI
      signal: AbortSignal.timeout(10_000),
      // Allow caching at CDN level
      next: { revalidate: 300 }, // 5 minutes
    });

    if (!response.ok) {
      console.error(`[Weather] Gateway returned ${response.status}`);
      
      return NextResponse.json(
        {
          error: 'Weather data unavailable',
          meta: { mode: 'error' },
          data: [],
        },
        {
          status: 502,
          headers: {
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    const data = (await response.json()) as WeatherGatewayResponse;

    // Set cache headers based on data mode
    let cacheControl = 'public, max-age=60';
    
    if (data.meta.mode === 'live' || data.meta.mode === 'cached') {
      cacheControl = 'public, max-age=300, stale-while-revalidate=600';
    }

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': cacheControl,
      },
    });
  } catch (error) {
    console.error('[Weather] Proxy error:', error instanceof Error ? error.message : error);

    // Handle timeout
    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json(
        {
          error: 'Weather request timeout',
          meta: { mode: 'error' },
          data: [],
        },
        {
          status: 504,
          headers: {
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    return NextResponse.json(
      {
        error: 'Weather data unavailable',
        meta: { mode: 'error' },
        data: [],
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}
