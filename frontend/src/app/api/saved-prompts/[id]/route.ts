// src/app/api/saved-prompts/[id]/route.ts
// ============================================================================
// SAVED PROMPTS API — Update & Delete (v1.0.0)
// ============================================================================
// PATCH  /api/saved-prompts/[id] — Update fields on a saved prompt
// DELETE /api/saved-prompts/[id] — Delete a saved prompt
//
// Security:
// - Clerk auth required (401 if not signed in)
// - Pro tier required (403 if free user)
// - Tier read from session claims (zero extra Clerk API calls)
// - Rate limiting on both PATCH and DELETE (60/min per IP)
// - prompt_id validated (non-empty, max 100 chars)
// - All DB queries scoped by userId — no cross-user access
//
// Authority: docs/authority/saved-page.md §13.2
// Existing features preserved: Yes (new file, no modifications)
// ============================================================================

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { getSessionFromCookie } from '@/lib/stripe/clerk-session';
import { rateLimit } from '@/lib/rate-limit';
import { env } from '@/lib/env';
import {
  ensureSavedPromptsTable,
  updatePrompt,
  deletePrompt,
} from '@/lib/saved-prompts';
import type { SavedPromptInput } from '@/lib/saved-prompts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

async function authenticate(request: NextRequest): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }
> {
  const session = getSessionFromCookie(request);
  const userId = session?.userId ?? null;

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
// PARAM EXTRACTION
// ============================================================================

/**
 * Extract and validate the prompt ID from the route params.
 * Next.js 15: params is a Promise.
 */
async function extractPromptId(
  context: { params: Promise<{ id: string }> },
): Promise<
  | { ok: true; promptId: string }
  | { ok: false; response: NextResponse }
> {
  const { id: rawId } = await context.params;
  const promptId = (rawId ?? '').trim();

  if (!promptId || promptId.length > 100) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Invalid prompt ID', code: 'INVALID_ID' },
        { status: 400 },
      ),
    };
  }

  return { ok: true, promptId };
}

// ============================================================================
// PATCH — Update specific fields on a saved prompt
// ============================================================================

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    // Rate limit
    const rl = rateLimit(request, {
      keyPrefix: 'saved-prompts-write',
      windowSeconds: 60,
      max: env.isProd ? 60 : 1000,
      keyParts: ['PATCH'],
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests', code: 'RATE_LIMITED', retryAfterSeconds: rl.retryAfterSeconds },
        { status: 429 },
      );
    }

    const authResult = await authenticate(request);
    if (!authResult.ok) return authResult.response;
    const { userId } = authResult;

    const paramResult = await extractPromptId(context);
    if (!paramResult.ok) return paramResult.response;
    const { promptId } = paramResult;

    await ensureTable();

    // Validate Content-Type
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return NextResponse.json(
        { error: 'Content-Type must be application/json', code: 'INVALID_CONTENT_TYPE' },
        { status: 415 },
      );
    }

    // Parse body with size guard
    const bodyText = await request.text();
    if (bodyText.length > 50_000) {
      return NextResponse.json(
        { error: 'Request body too large (max 50KB)', code: 'PAYLOAD_TOO_LARGE' },
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

    if (typeof body !== 'object' || body === null) {
      return NextResponse.json(
        { error: 'Request body must be a JSON object', code: 'VALIDATION_ERROR' },
        { status: 400 },
      );
    }

    // Allowlist of updatable fields — reject anything else
    type UpdatableFields = Partial<Pick<
      SavedPromptInput,
      'name' | 'folder' | 'notes' | 'tags' | 'mood' | 'isOptimised' | 'optimisedPrompt'
    >>;

    const raw = body as Record<string, unknown>;
    const updates: UpdatableFields = {};
    let fieldCount = 0;

    if ('name' in raw)             { updates.name = raw.name as string | undefined; fieldCount++; }
    if ('folder' in raw)           { updates.folder = raw.folder as string | undefined; fieldCount++; }
    if ('notes' in raw)            { updates.notes = raw.notes as string | undefined; fieldCount++; }
    if ('tags' in raw)             { updates.tags = raw.tags as string[] | undefined; fieldCount++; }
    if ('mood' in raw)             { updates.mood = raw.mood as string | undefined; fieldCount++; }
    if ('isOptimised' in raw)      { updates.isOptimised = raw.isOptimised as boolean | undefined; fieldCount++; }
    if ('optimisedPrompt' in raw)  { updates.optimisedPrompt = raw.optimisedPrompt as string | undefined; fieldCount++; }

    if (fieldCount === 0) {
      return NextResponse.json(
        { error: 'No valid updatable fields provided', code: 'NO_UPDATES' },
        { status: 400 },
      );
    }

    const result = await updatePrompt(userId, promptId, updates);

    if (!result) {
      return NextResponse.json(
        { error: 'Prompt not found or update failed', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }

    return NextResponse.json({ prompt: result, code: 'UPDATED' });
  } catch (error) {
    console.error('[saved-prompts-api] PATCH error:', error);

    if (error instanceof Error && error.message.includes('cannot be empty')) {
      return NextResponse.json(
        { error: error.message, code: 'VALIDATION_ERROR' },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}

// ============================================================================
// DELETE — Delete a saved prompt
// ============================================================================

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    // Rate limit
    const rl = rateLimit(request, {
      keyPrefix: 'saved-prompts-write',
      windowSeconds: 60,
      max: env.isProd ? 60 : 1000,
      keyParts: ['DELETE'],
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests', code: 'RATE_LIMITED', retryAfterSeconds: rl.retryAfterSeconds },
        { status: 429 },
      );
    }

    const authResult = await authenticate(request);
    if (!authResult.ok) return authResult.response;
    const { userId } = authResult;

    const paramResult = await extractPromptId(context);
    if (!paramResult.ok) return paramResult.response;
    const { promptId } = paramResult;

    await ensureTable();

    const deleted = await deletePrompt(userId, promptId);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Prompt not found', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }

    return NextResponse.json({ deleted: true, code: 'DELETED' });
  } catch (error) {
    console.error('[saved-prompts-api] DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
