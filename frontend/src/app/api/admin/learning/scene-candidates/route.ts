// src/app/api/admin/learning/scene-candidates/route.ts
// ============================================================================
// ADMIN — Scene Candidate Review API
// ============================================================================
//
// GET  /api/admin/learning/scene-candidates — Fetch all candidates + stats
// POST /api/admin/learning/scene-candidates — Update candidate status
//
// Protected by PROMAGEN_CRON_SECRET (same as other admin endpoints).
// Returns 404 on auth failure (hides endpoint existence).
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 9.2
//
// Version: 1.0.0
// Created: 2026-02-25
//
// Existing features preserved: Yes.
// ============================================================================

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { env, requireCronSecret } from '@/lib/env';
import {
  ensureAllTables,
  getLearnedWeights,
  upsertLearnedWeights,
} from '@/lib/learning/database';

import type {
  SceneCandidates,
  SceneCandidate,
} from '@/lib/learning/scene-candidates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============================================================================
// HELPERS
// ============================================================================

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

function requireAuth(req: NextRequest): void {
  const expected = requireCronSecret();

  const provided =
    req.headers.get('x-promagen-cron') ??
    req.headers.get('x-cron-secret') ??
    new URL(req.url).searchParams.get('secret') ??
    '';

  if (!provided || !constantTimeEquals(provided, expected)) {
    throw new Error('Unauthorized');
  }
}

const NO_STORE_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Promagen-Safe-Mode': env.safeMode.enabled ? '1' : '0',
};

const VALID_STATUSES = ['approved', 'rejected', 'pending'] as const;
type CandidateStatus = (typeof VALID_STATUSES)[number];

// ============================================================================
// GET — Fetch All Candidates
// ============================================================================

/**
 * GET /api/admin/learning/scene-candidates?secret=...
 *
 * Returns all scene candidates with summary stats.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    requireAuth(req);
  } catch {
    return NextResponse.json(
      { error: 'Not Found' },
      { status: 404, headers: NO_STORE_HEADERS },
    );
  }

  try {
    await ensureAllTables();

    const result = await getLearnedWeights<SceneCandidates>('scene-candidates');

    if (!result) {
      return NextResponse.json(
        {
          ok: true,
          data: null,
          stats: { total: 0, pending: 0, approved: 0, rejected: 0 },
          message: 'No scene candidates yet — cron has not run',
          updatedAt: null,
        },
        { headers: NO_STORE_HEADERS },
      );
    }

    const candidates = result.data.candidates;
    const stats = {
      total: candidates.length,
      pending: candidates.filter((c) => c.status === 'pending').length,
      approved: candidates.filter((c) => c.status === 'approved').length,
      rejected: candidates.filter((c) => c.status === 'rejected').length,
    };

    return NextResponse.json(
      {
        ok: true,
        data: result.data,
        stats,
        updatedAt: result.updatedAt,
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error('[Admin Scene Candidates] GET error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch candidates' },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

// ============================================================================
// POST — Update Candidate Status
// ============================================================================

interface UpdateStatusBody {
  candidateId: string;
  status: CandidateStatus;
}

/**
 * POST /api/admin/learning/scene-candidates?secret=...
 *
 * Body: { candidateId: string, status: 'approved' | 'rejected' | 'pending' }
 *
 * Reads the current scene-candidates blob, finds the candidate by ID,
 * updates its status, and persists back to the database.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    requireAuth(req);
  } catch {
    return NextResponse.json(
      { error: 'Not Found' },
      { status: 404, headers: NO_STORE_HEADERS },
    );
  }

  try {
    // --- Parse body ---
    let body: UpdateStatusBody;
    try {
      body = (await req.json()) as UpdateStatusBody;
    } catch {
      return NextResponse.json(
        { ok: false, error: 'Invalid JSON body' },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    if (!body.candidateId || typeof body.candidateId !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Missing or invalid candidateId' },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    if (!VALID_STATUSES.includes(body.status as CandidateStatus)) {
      return NextResponse.json(
        { ok: false, error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    // --- Read current data ---
    await ensureAllTables();

    const result = await getLearnedWeights<SceneCandidates>('scene-candidates');
    if (!result) {
      return NextResponse.json(
        { ok: false, error: 'No scene candidates data found — cron has not run' },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    }

    // --- Find & update the candidate ---
    const candidates = result.data.candidates;
    const target = candidates.find((c) => c.id === body.candidateId);

    if (!target) {
      return NextResponse.json(
        { ok: false, error: `Candidate not found: ${body.candidateId}` },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    }

    const previousStatus = target.status;
    (target as SceneCandidate).status = body.status;

    // --- Persist ---
    await upsertLearnedWeights('scene-candidates', result.data);

    console.debug('[Admin Scene Candidates] Status updated', {
      candidateId: body.candidateId,
      from: previousStatus,
      to: body.status,
    });

    return NextResponse.json(
      {
        ok: true,
        message: `Candidate "${target.suggestedName}" updated: ${previousStatus} → ${body.status}`,
        candidate: target,
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error('[Admin Scene Candidates] POST error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to update candidate' },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
