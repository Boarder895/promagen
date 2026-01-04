// src/app/api/user/preferences/route.ts
// ============================================================================
// USER PREFERENCES API - v2.0.0
// ============================================================================
// Save user preferences to Clerk publicMetadata.
// Supports:
// - referenceFrame (for paid users - exchange ordering)
// - compositionMode (for all users - static/dynamic)
// - aspectRatio (for all users - last selected AR)
//
// Security:
// - Authenticated users only (Clerk session required)
// - Paid users only for referenceFrame changes
// - All inputs validated against strict whitelists
// - No user-provided code execution
// - Rate limiting via Clerk
//
// Authority: docs/authority/paid_tier.md, docs/authority/prompt-builder-page.md
// ============================================================================

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import type { ReferenceFrame } from '@/lib/location';
import type { CompositionMode, AspectRatioId } from '@/types/composition';

// ============================================================================
// TYPES
// ============================================================================

interface UpdatePreferencesBody {
  referenceFrame?: ReferenceFrame;
  compositionMode?: CompositionMode;
  aspectRatio?: AspectRatioId | null;
}

interface PreferencesResponse {
  tier: 'free' | 'paid';
  referenceFrame: ReferenceFrame;
  compositionMode: CompositionMode;
  aspectRatio: AspectRatioId | null;
}

// ============================================================================
// VALIDATION WHITELISTS
// ============================================================================

// Valid reference frame values
const VALID_REFERENCE_FRAMES: readonly ReferenceFrame[] = ['user', 'greenwich'] as const;

// Valid composition modes
const VALID_COMPOSITION_MODES: readonly CompositionMode[] = ['static', 'dynamic'] as const;

// Valid aspect ratios
const VALID_ASPECT_RATIOS: readonly AspectRatioId[] = [
  '1:1',
  '4:5',
  '3:4',
  '2:3',
  '3:2',
  '4:3',
  '16:9',
  '9:16',
  '21:9',
] as const;

// ============================================================================
// TYPE GUARDS
// ============================================================================

function isValidReferenceFrame(value: unknown): value is ReferenceFrame {
  return typeof value === 'string' && VALID_REFERENCE_FRAMES.includes(value as ReferenceFrame);
}

function isValidCompositionMode(value: unknown): value is CompositionMode {
  return typeof value === 'string' && VALID_COMPOSITION_MODES.includes(value as CompositionMode);
}

function isValidAspectRatio(value: unknown): value is AspectRatioId {
  return typeof value === 'string' && VALID_ASPECT_RATIOS.includes(value as AspectRatioId);
}

// ============================================================================
// BODY PARSING WITH VALIDATION
// ============================================================================

/**
 * Safely parse and validate request body.
 * Returns null if body is invalid or malformed.
 */
async function parseBody(request: NextRequest): Promise<UpdatePreferencesBody | null> {
  try {
    const contentType = request.headers.get('content-type');
    
    // Reject non-JSON content types
    if (!contentType?.includes('application/json')) {
      return null;
    }

    // Limit body size (prevent DoS)
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 1024) {
      return null; // Body too large
    }

    const body: unknown = await request.json();

    // Validate it's a plain object
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return null;
    }

    return body as UpdatePreferencesBody;
  } catch {
    return null;
  }
}

// ============================================================================
// METADATA EXTRACTORS
// ============================================================================

function extractTier(metadata: Record<string, unknown>): 'free' | 'paid' {
  const tier = metadata?.tier;
  if (tier === 'paid') return 'paid';
  return 'free';
}

function extractReferenceFrame(metadata: Record<string, unknown>): ReferenceFrame {
  const frame = metadata?.referenceFrame;
  if (isValidReferenceFrame(frame)) return frame;
  return 'user'; // Default for all users
}

function extractCompositionMode(metadata: Record<string, unknown>): CompositionMode {
  const mode = metadata?.compositionMode;
  if (isValidCompositionMode(mode)) return mode;
  return 'dynamic'; // Default: dynamic (showcases platform intelligence)
}

function extractAspectRatio(metadata: Record<string, unknown>): AspectRatioId | null {
  const ratio = metadata?.aspectRatio;
  if (ratio === null) return null;
  if (isValidAspectRatio(ratio)) return ratio;
  return null;
}

// ============================================================================
// GET - Read current preferences
// ============================================================================

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const metadata = (user.publicMetadata ?? {}) as Record<string, unknown>;

    const preferences: PreferencesResponse = {
      tier: extractTier(metadata),
      referenceFrame: extractReferenceFrame(metadata),
      compositionMode: extractCompositionMode(metadata),
      aspectRatio: extractAspectRatio(metadata),
    };

    return NextResponse.json({
      success: true,
      preferences,
    });
  } catch (error) {
    console.error('[preferences] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to read preferences' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH - Update preferences
// ============================================================================

export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body with validation
    const body = await parseBody(request);

    if (!body) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // Validate referenceFrame if provided
    if (body.referenceFrame !== undefined) {
      if (!isValidReferenceFrame(body.referenceFrame)) {
        return NextResponse.json(
          { success: false, error: 'Invalid referenceFrame value' },
          { status: 400 }
        );
      }
    }

    // Validate compositionMode if provided
    if (body.compositionMode !== undefined) {
      if (!isValidCompositionMode(body.compositionMode)) {
        return NextResponse.json(
          { success: false, error: 'Invalid compositionMode value' },
          { status: 400 }
        );
      }
    }

    // Validate aspectRatio if provided (can be null)
    if (body.aspectRatio !== undefined && body.aspectRatio !== null) {
      if (!isValidAspectRatio(body.aspectRatio)) {
        return NextResponse.json(
          { success: false, error: 'Invalid aspectRatio value' },
          { status: 400 }
        );
      }
    }

    // Get current user to check tier and existing metadata
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const currentMetadata = (user.publicMetadata ?? {}) as Record<string, unknown>;
    const currentTier = extractTier(currentMetadata);

    // ========================================================================
    // AUTHORIZATION CHECKS
    // ========================================================================

    // referenceFrame: paid users only
    if (body.referenceFrame !== undefined && currentTier !== 'paid') {
      return NextResponse.json(
        { success: false, error: 'Reference frame toggle is a paid feature' },
        { status: 403 }
      );
    }

    // compositionMode: available to all authenticated users
    // aspectRatio: available to all authenticated users

    // ========================================================================
    // BUILD UPDATED METADATA
    // ========================================================================

    const updatedMetadata: Record<string, unknown> = {
      ...currentMetadata,
    };

    // Update only provided fields (preserve others)
    if (body.referenceFrame !== undefined) {
      updatedMetadata.referenceFrame = body.referenceFrame;
    }

    if (body.compositionMode !== undefined) {
      updatedMetadata.compositionMode = body.compositionMode;
    }

    if (body.aspectRatio !== undefined) {
      updatedMetadata.aspectRatio = body.aspectRatio;
    }

    // ========================================================================
    // PERSIST TO CLERK
    // ========================================================================

    await client.users.updateUser(userId, {
      publicMetadata: updatedMetadata,
    });

    // Return updated preferences
    const preferences: PreferencesResponse = {
      tier: extractTier(updatedMetadata),
      referenceFrame: extractReferenceFrame(updatedMetadata),
      compositionMode: extractCompositionMode(updatedMetadata),
      aspectRatio: extractAspectRatio(updatedMetadata),
    };

    return NextResponse.json({
      success: true,
      preferences,
    });
  } catch (error) {
    console.error('[preferences] PATCH error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update preferences' },
      { status: 500 }
    );
  }
}
