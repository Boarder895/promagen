// src/app/api/saved-prompts/sync/route.ts
// ============================================================================
// SAVED PROMPTS API — Sync (v1.0.0)
// ============================================================================
// POST /api/saved-prompts/sync — One-time localStorage → database migration
//
// Called when a user upgrades to Pro (or signs in for the first time as Pro).
// The client sends all localStorage prompts in a single request.
// The server upserts them into the database, skipping duplicates.
//
// Security:
// - Clerk auth required (401 if not signed in)
// - Pro tier required (403 if free user)
// - Rate limited to 5/hour (this is a one-time operation, not repeated)
// - Max 500 prompts per request (matches the per-user cap)
// - Max 2MB request body (500 prompts × ~2KB each + overhead)
// - Each prompt validated individually — bad data is skipped, not rejected
// - All DB queries scoped by userId — no cross-user access
//
// Idempotent: safe to call multiple times (ON CONFLICT upserts).
// The client should set a flag (e.g. Clerk metadata `promptsSynced: true`)
// after a successful sync to avoid re-syncing on every page load.
//
// Authority: docs/authority/saved-page.md §13.2
// Existing features preserved: Yes (new file, no modifications)
// ============================================================================

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { rateLimit } from '@/lib/rate-limit';
import { env } from '@/lib/env';
import {
  ensureSavedPromptsTable,
  syncFromLocalStorage,
  MAX_PROMPTS_PER_USER,
} from '@/lib/saved-prompts';
import type { SavedPromptInput } from '@/lib/saved-prompts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Sync can be slow for large libraries — allow up to 30s
export const maxDuration = 30;

// ============================================================================
// TABLE INIT GUARD
// ============================================================================

let tableReady = false;

async function ensureTable(): Promise<void> {
  if (tableReady) return;
  await ensureSavedPromptsTable();
  tableReady = true;
}

// ============================================================================
// AUTH + TIER CHECK
// ============================================================================

interface ClerkPublicMetadata {
  tier?: 'free' | 'paid';
  [key: string]: unknown;
}

async function authenticate(): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }
> {
  const { userId } = await auth();

  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 },
      ),
    };
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const meta = (user.publicMetadata ?? {}) as ClerkPublicMetadata;
  const isPaid = meta.tier === 'paid';

  if (!isPaid) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Pro Promagen subscription required for cloud-synced prompt storage',
          code: 'PRO_REQUIRED',
        },
        { status: 403 },
      ),
    };
  }

  return { ok: true, userId };
}

// ============================================================================
// POST — Bulk sync from localStorage
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Strict rate limit — this is a one-time operation
    const rl = rateLimit(request, {
      keyPrefix: 'saved-prompts-sync',
      windowSeconds: 3600,
      max: env.isProd ? 5 : 100,
      keyParts: ['SYNC'],
    });
    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: 'Sync rate limit exceeded. This is a one-time operation — try again later.',
          code: 'RATE_LIMITED',
          retryAfterSeconds: rl.retryAfterSeconds,
        },
        { status: 429 },
      );
    }

    const authResult = await authenticate();
    if (!authResult.ok) return authResult.response;
    const { userId } = authResult;

    await ensureTable();

    // Validate Content-Type
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return NextResponse.json(
        { error: 'Content-Type must be application/json', code: 'INVALID_CONTENT_TYPE' },
        { status: 415 },
      );
    }

    // Parse body with size guard — 2MB max (500 prompts × ~2KB + JSON overhead)
    const bodyText = await request.text();
    if (bodyText.length > 2_000_000) {
      return NextResponse.json(
        { error: 'Request body too large (max 2MB)', code: 'PAYLOAD_TOO_LARGE' },
        { status: 413 },
      );
    }

    let body: unknown;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body', code: 'INVALID_JSON' },
        { status: 400 },
      );
    }

    // Validate shape: { prompts: SavedPromptInput[] }
    if (
      typeof body !== 'object' ||
      body === null ||
      !('prompts' in body) ||
      !Array.isArray((body as Record<string, unknown>).prompts)
    ) {
      return NextResponse.json(
        { error: 'Request body must contain a "prompts" array', code: 'VALIDATION_ERROR' },
        { status: 400 },
      );
    }

    const prompts = (body as { prompts: unknown[] }).prompts;

    // Cap the array at MAX_PROMPTS_PER_USER to prevent abuse
    if (prompts.length > MAX_PROMPTS_PER_USER) {
      return NextResponse.json(
        {
          error: `Too many prompts (${prompts.length}). Maximum ${MAX_PROMPTS_PER_USER} per sync.`,
          code: 'TOO_MANY_PROMPTS',
          count: prompts.length,
          cap: MAX_PROMPTS_PER_USER,
        },
        { status: 400 },
      );
    }

    // Basic array element validation — each must have id + positivePrompt at minimum
    const validPrompts: SavedPromptInput[] = [];
    let preFilterSkipped = 0;

    for (const item of prompts) {
      if (
        typeof item === 'object' &&
        item !== null &&
        'id' in item &&
        typeof (item as Record<string, unknown>).id === 'string' &&
        'positivePrompt' in item &&
        typeof (item as Record<string, unknown>).positivePrompt === 'string'
      ) {
        validPrompts.push(item as SavedPromptInput);
      } else {
        preFilterSkipped++;
      }
    }

    if (validPrompts.length === 0 && preFilterSkipped > 0) {
      return NextResponse.json(
        {
          error: 'No valid prompts found in the request. Each prompt needs at least "id" and "positivePrompt".',
          code: 'NO_VALID_PROMPTS',
          skipped: preFilterSkipped,
        },
        { status: 400 },
      );
    }

    // Perform the sync
    const result = await syncFromLocalStorage(userId, validPrompts);

    return NextResponse.json({
      code: 'SYNC_COMPLETE',
      synced: result.synced,
      skipped: result.skipped + preFilterSkipped,
      errors: result.errors,
      atCap: result.atCap,
      cap: MAX_PROMPTS_PER_USER,
    });
  } catch (error) {
    console.error('[saved-prompts-api] SYNC error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
