// src/app/api/fx/selection/route.ts
// =============================================================================
// FX Selection API Route
// Authority: docs/authority/paid_tier.md §5.5
// =============================================================================
// POST: Update user's FX selection (Pro only)
// GET: Get user's current FX selection
// =============================================================================

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { FX_SELECTION_LIMITS } from '@/types/fx-selection';

// =============================================================================
// Types
// =============================================================================

interface ClerkPublicMetadata {
  tier?: 'free' | 'paid';
  fxSelection?: {
    pairIds: string[];
    updatedAt: string;
  };
}

interface SelectionRequestBody {
  pairIds: unknown;
}

interface FxPairCatalogEntry {
  id: string;
  base?: string;
  quote?: string;
  label?: string;
}

// =============================================================================
// Catalog Validation
// =============================================================================

/**
 * Load valid pair IDs from SSOT - FULL CATALOG
 *
 * FIX: Previously loaded fx.pairs.json (8 default pairs).
 * Now loads pairs.json (3,192 full catalog) per paid_tier.md §5.5:
 * "Catalog access: Full catalog (3,192 pairs)"
 */
async function loadValidPairIds(): Promise<Set<string>> {
  try {
    // fx-pairs.json is the FULL catalog: [{id: "eur-usd", base: "EUR", quote: "USD", ...}, ...]
    // This is the 3,192-pair catalog, not the 8-pair defaults
    const pairsCatalogModule = await import('@/data/fx/fx-pairs.json');

    // Handle both default export and direct import
    const pairsCatalog: FxPairCatalogEntry[] = Array.isArray(pairsCatalogModule.default)
      ? (pairsCatalogModule.default as FxPairCatalogEntry[])
      : Array.isArray(pairsCatalogModule)
      ? (pairsCatalogModule as unknown as FxPairCatalogEntry[])
      : [];

    return new Set(
      pairsCatalog
        .filter((p): p is FxPairCatalogEntry => typeof p?.id === 'string')
        .map((p) => p.id.toLowerCase()),
    );
  } catch (err) {
    console.error('[fx-selection-route] Failed to load FX pairs catalog:', err);
    return new Set();
  }
}

// =============================================================================
// GET Handler
// =============================================================================

export async function GET(): Promise<NextResponse> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const metadata = user.publicMetadata as ClerkPublicMetadata;

    return NextResponse.json({
      pairIds: metadata.fxSelection?.pairIds ?? [],
      updatedAt: metadata.fxSelection?.updatedAt ?? null,
      tier: metadata.tier ?? 'free',
    });
  } catch (error) {
    console.error('[fx-selection-route] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// =============================================================================
// POST Handler
// =============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user and check tier
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const metadata = user.publicMetadata as ClerkPublicMetadata;
    const tier = metadata.tier ?? 'free';

    // Only Pro users can update selection
    if (tier !== 'paid') {
      return NextResponse.json(
        { error: 'Pro Promagen subscription required to customize FX pairs' },
        { status: 403 },
      );
    }

    // Parse request body
    const body = (await request.json()) as SelectionRequestBody;
    const { pairIds } = body;

    // Validate pairIds is an array
    if (!Array.isArray(pairIds)) {
      return NextResponse.json(
        { error: 'pairIds must be an array', validationErrors: ['pairIds must be an array'] },
        { status: 400 },
      );
    }

    // Validate all items are strings
    if (!pairIds.every((id): id is string => typeof id === 'string')) {
      return NextResponse.json(
        {
          error: 'All pair IDs must be strings',
          validationErrors: ['All pair IDs must be strings'],
        },
        { status: 400 },
      );
    }

    // Normalize and dedupe
    const normalizedIds = [...new Set(pairIds.map((id) => id.toLowerCase().trim()))];

    // Validate count limits
    const validationErrors: string[] = [];

    if (normalizedIds.length < FX_SELECTION_LIMITS.MIN_PAIRS) {
      validationErrors.push(
        `Minimum ${FX_SELECTION_LIMITS.MIN_PAIRS} pairs required, got ${normalizedIds.length}`,
      );
    }

    if (normalizedIds.length > FX_SELECTION_LIMITS.MAX_PAIRS) {
      validationErrors.push(
        `Maximum ${FX_SELECTION_LIMITS.MAX_PAIRS} pairs allowed, got ${normalizedIds.length}`,
      );
    }

    // Load FULL catalog and validate pair IDs
    const validPairIds = await loadValidPairIds();
    const invalidIds = normalizedIds.filter((id) => !validPairIds.has(id));

    if (invalidIds.length > 0) {
      validationErrors.push(`Invalid pair IDs: ${invalidIds.join(', ')}`);
    }

    // Return errors if any
    if (validationErrors.length > 0) {
      return NextResponse.json({ error: 'Validation failed', validationErrors }, { status: 400 });
    }

    // Update Clerk publicMetadata
    const updatedAt = new Date().toISOString();
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...metadata,
        fxSelection: {
          pairIds: normalizedIds,
          updatedAt,
        },
      },
    });

    return NextResponse.json({
      success: true,
      pairIds: normalizedIds,
      updatedAt,
    });
  } catch (error) {
    console.error('[fx-selection-route] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
