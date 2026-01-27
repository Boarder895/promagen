/**
 * Index Rating Fetch API
 * 
 * Public API for fetching Index Rating data for display.
 * Supports batch fetching for multiple providers.
 * 
 * @see docs/authority/index-rating.md
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  hasDatabaseConfigured,
  getProviderRatings,
  type ProviderRating,
} from '@/lib/index-rating';

// =============================================================================
// TYPES
// =============================================================================

type RatingsRequest = {
  providerIds: string[];
};

type RatingsResponse = {
  ratings: Record<string, ProviderRating>;
  source: 'database' | 'unavailable';
  timestamp: string;
};

// =============================================================================
// VALIDATION
// =============================================================================

const MAX_PROVIDER_IDS = 100;
const MAX_PROVIDER_ID_LENGTH = 50;

function validateProviderIds(ids: unknown): string[] | null {
  if (!Array.isArray(ids)) {
    return null;
  }

  if (ids.length > MAX_PROVIDER_IDS) {
    return null;
  }

  const validIds: string[] = [];
  for (const id of ids) {
    if (typeof id !== 'string') {
      continue;
    }
    
    const trimmed = id.toLowerCase().trim();
    if (trimmed.length > 0 && trimmed.length <= MAX_PROVIDER_ID_LENGTH) {
      // Only allow safe characters
      if (/^[a-z0-9_-]+$/i.test(trimmed)) {
        validIds.push(trimmed);
      }
    }
  }

  return validIds.length > 0 ? validIds : null;
}

// =============================================================================
// HANDLER
// =============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse body
    let body: RatingsRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    // Validate provider IDs
    const providerIds = validateProviderIds(body.providerIds);
    if (!providerIds) {
      return NextResponse.json(
        { error: 'Invalid providerIds' },
        { status: 400 }
      );
    }

    // Check database
    if (!hasDatabaseConfigured()) {
      const response: RatingsResponse = {
        ratings: {},
        source: 'unavailable',
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(response);
    }

    // Fetch ratings
    const ratingsMap = await getProviderRatings(providerIds);

    // Convert to object
    const ratings: Record<string, ProviderRating> = {};
    for (const [id, rating] of ratingsMap.entries()) {
      ratings[id] = rating;
    }

    const response: RatingsResponse = {
      ratings,
      source: 'database',
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[Index Rating API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Also support GET for single provider
export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const providerId = url.searchParams.get('providerId');

  if (!providerId) {
    return NextResponse.json(
      { error: 'Missing providerId parameter' },
      { status: 400 }
    );
  }

  // Delegate to POST handler with array
  const mockRequest = new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify({ providerIds: [providerId] }),
    headers: { 'Content-Type': 'application/json' },
  });

  return POST(mockRequest);
}

// =============================================================================
// RUNTIME
// =============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
