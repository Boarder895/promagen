// src/app/api/debug/ab-hash-check/route.ts
// ============================================================================
// DEBUG — A/B Hash Check Endpoint
// ============================================================================
//
// Diagnostic endpoint for manual QA. Given a browser's abHash (UUID),
// returns the bucket assignment for all running tests without needing
// to open DevTools.
//
// Usage: GET /api/debug/ab-hash-check?hash=<uuid>
//
// Returns:
// - The hash echoed back
// - The FNV-1a raw bucket (0–99)
// - Assignment for each running test (if any)
//
// Security: No PII, no mutations, read-only. Development/QA tool.
// Only available when NODE_ENV !== 'production' or when
// PHASE_7_AB_DEBUG_ENABLED=true.
//
// Authority: docs/authority/phase-7_6-ab-testing-pipeline-buildplan.md (7.6b extra)
//
// Version: 1.0.0
// Created: 2026-02-27
//
// Existing features preserved: Yes.
// ============================================================================

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';

import { fnv1aHash, assignVariant } from '@/lib/learning/ab-assignment';

// ============================================================================
// TYPES
// ============================================================================

interface TestAssignment {
  testId: string;
  rawBucket: number;
  variant: 'A' | 'B';
  splitPct: number;
}

// ============================================================================
// GATE — Only available in dev or when explicitly enabled
// ============================================================================

function isDebugAllowed(): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  return process.env.PHASE_7_AB_DEBUG_ENABLED === 'true';
}

// ============================================================================
// UUID validation (loose — accepts v4 and similar)
// ============================================================================

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ============================================================================
// HANDLER
// ============================================================================

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── Gate check ──
  if (!isDebugAllowed()) {
    return NextResponse.json(
      { ok: false, error: 'Debug endpoint disabled in production' },
      { status: 403 },
    );
  }

  // ── Parse & validate hash param ──
  const hash = req.nextUrl.searchParams.get('hash')?.trim() ?? '';

  if (!hash || !UUID_RE.test(hash)) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Missing or invalid hash parameter. Expected a UUID, e.g. ?hash=550e8400-e29b-41d4-a716-446655440000',
      },
      { status: 400 },
    );
  }

  // ── Compute raw bucket (independent of any test) ──
  const rawBucket = fnv1aHash(hash) % 100;

  // ── Fetch running tests (lazy import to avoid circular deps) ──
  // In Part 7.6c the database layer will expose getRunningABTest().
  // Until then, we provide static demo assignments for any test IDs
  // passed via the optional `testIds` query param.
  const testIdsParam = req.nextUrl.searchParams.get('testIds')?.trim() ?? '';
  const testIds = testIdsParam
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // Build assignments for each requested test
  const assignments: TestAssignment[] = testIds.map((testId) => ({
    testId,
    rawBucket: fnv1aHash(hash + testId) % 100,
    variant: assignVariant(hash, testId),
    splitPct: 50, // default until DB layer provides actual split
  }));

  return NextResponse.json(
    {
      ok: true,
      hash,
      rawBucketFromHashAlone: rawBucket,
      testAssignments: assignments,
      note: assignments.length === 0
        ? 'No testIds provided. Pass ?hash=<uuid>&testIds=ab_xxx,ab_yyy to see assignments.'
        : undefined,
    },
    {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
