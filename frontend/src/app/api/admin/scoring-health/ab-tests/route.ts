// src/app/api/admin/scoring-health/ab-tests/route.ts
// ============================================================================
// GET /api/admin/scoring-health/ab-tests
// ============================================================================
//
// Returns A/B test history timeline for the scoring health dashboard Section 6.
// Reads from the learning ab-tests API and transforms into the timeline format.
//
// Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md § 7
//
// Version: 1.0.1 — fix: use getLearnedWeights + auth() pattern
// Created: 2026-03-01
//
// Existing features preserved: Yes.
// ============================================================================

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

import { ensureAllTables, getLearnedWeights } from '@/lib/learning/database';

import type {
  ABTestHistoryEntry,
  ABTestSectionData,
  ScoringHealthApiResponse,
} from '@/lib/admin/scoring-health-types';

// ============================================================================
// AUTH
// ============================================================================

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS ?? '').split(',').filter(Boolean);

async function isAdmin(): Promise<boolean> {
  try {
    const session = await auth();
    if (!session?.userId) return false;
    return ADMIN_USER_IDS.includes(session.userId);
  } catch {
    return false;
  }
}

// ============================================================================
// AB TEST STATE TYPE (mirrors what the pipeline stores)
// ============================================================================

interface ABTestState {
  history?: Array<{
    id: string;
    name: string;
    status: string;
    startedAt: string;
    endedAt: string | null;
    resultSummary?: { lift?: number } | null;
  }>;
  currentTest?: {
    id: string;
    name: string;
    status: string;
    startedAt: string;
  } | null;
}

// ============================================================================
// HANDLER
// ============================================================================

export async function GET(): Promise<NextResponse<ScoringHealthApiResponse<ABTestSectionData>>> {
  try {
    // ── Auth ─────────────────────────────────────────────────────────
    if (!(await isAdmin())) {
      return NextResponse.json(
        { ok: false, data: null, message: 'Unauthorized', generatedAt: new Date().toISOString() },
        { status: 401 },
      );
    }

    // ── Load A/B test data ──────────────────────────────────────────
    await ensureAllTables();
    const row = await getLearnedWeights<ABTestState>('ab-test-state');

    const history: ABTestHistoryEntry[] = [];
    let running = 0;
    let promoted = 0;
    let rolledBack = 0;

    if (row?.data) {
      const state = row.data;

      // Current running test
      if (state.currentTest) {
        running = 1;
        history.push({
          testId: state.currentTest.id,
          name: state.currentTest.name,
          outcome: 'running',
          lift: null,
          concludedAt: null,
          startedAt: state.currentTest.startedAt,
        });
      }

      // Historical tests
      if (state.history) {
        for (const test of state.history) {
          const outcome = test.status === 'promoted' ? 'promoted' as const
            : test.status === 'rolled_back' ? 'rolled_back' as const
            : 'pending' as const;

          if (outcome === 'promoted') promoted++;
          if (outcome === 'rolled_back') rolledBack++;

          history.push({
            testId: test.id,
            name: test.name,
            outcome,
            lift: test.resultSummary?.lift ?? null,
            concludedAt: test.endedAt ?? null,
            startedAt: test.startedAt,
          });
        }
      }
    }

    // Sort: running first, then by concludedAt/startedAt desc
    history.sort((a, b) => {
      if (a.outcome === 'running' && b.outcome !== 'running') return -1;
      if (b.outcome === 'running' && a.outcome !== 'running') return 1;
      const dateA = a.concludedAt ?? a.startedAt;
      const dateB = b.concludedAt ?? b.startedAt;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

    const result: ABTestSectionData = {
      history: history.slice(0, 20),
      summary: {
        running,
        promoted,
        rolledBack,
        totalTests: history.length,
      },
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json({ ok: true, data: result, generatedAt: result.generatedAt });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        data: null,
        message: err instanceof Error ? err.message : 'Internal error',
        generatedAt: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
