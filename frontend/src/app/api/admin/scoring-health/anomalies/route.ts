// src/app/api/admin/scoring-health/anomalies/route.ts
// ============================================================================
// GET /api/admin/scoring-health/anomalies
// ============================================================================
//
// Aggregates data from existing section APIs (overview, temporal, anti-patterns,
// feedback, weight-drift) and evaluates against anomaly thresholds to produce
// a unified list of anomalies sorted by severity.
//
// This is a server-side fan-out — each sub-fetch is to an internal API route
// using absolute URLs. All fetches are parallel and individually resilient
// (one failing source does not block others).
//
// Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md § 10
//
// Version: 1.0.0
// Created: 2026-03-01
//
// Existing features preserved: Yes (new route, reads from existing APIs).
// ============================================================================

import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

import {
  evaluateAllAnomalies,
  type Anomaly,
  type AnomalySourceData,
} from '@/lib/admin/anomaly-thresholds';

import type { ScoringHealthApiResponse } from '@/lib/admin/scoring-health-types';

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
// INTERNAL FETCH HELPERS
// ============================================================================

/**
 * Fetch a scoring-health sub-endpoint.
 * Returns null on any failure (resilient — one broken source won't block others).
 */
async function fetchSection<T>(
  request: NextRequest,
  path: string,
): Promise<T | null> {
  try {
    const url = new URL(path, request.url);
    const cookie = request.headers.get('cookie') ?? '';
    const res = await fetch(url.toString(), {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.ok ? (json.data as T) : null;
  } catch {
    return null;
  }
}

// ============================================================================
// RESPONSE SHAPE
// ============================================================================

export interface AnomalyResponse {
  anomalies: Anomaly[];
  sourcesChecked: number;
  sourcesFailed: number;
  generatedAt: string;
}

// ============================================================================
// HANDLER
// ============================================================================

export async function GET(
  request: NextRequest,
): Promise<NextResponse<ScoringHealthApiResponse<AnomalyResponse>>> {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json(
        { ok: false, data: null, message: 'Unauthorized', generatedAt: new Date().toISOString() },
        { status: 401 },
      );
    }

    // ── Parallel fan-out to existing section APIs ──────────────────
    const [overview, temporal, antiPatterns, feedback, weightDrift] = await Promise.all([
      fetchSection<{
        correlation: number;
        correlationTrend: number;
        lastCron: { timestamp: string | null; success: boolean };
        abTests: { running: number; concluded: number };
      }>(request, '/api/admin/scoring-health/overview'),

      fetchSection<{
        freshness: {
          seasonal: { label: string; ageMinutes: number; status: string };
          trending: { label: string; ageMinutes: number; status: string };
        };
      }>(request, '/api/admin/scoring-health/temporal'),

      fetchSection<{
        high: { termA: string; termB: string; occurrenceCount: number; qualityImpact: number }[];
      }>(request, '/api/admin/scoring-health/anti-patterns'),

      fetchSection<{
        redFlags: { type: string; message: string; severity: string; platform?: string }[];
        platformSatisfaction: { platform: string; score: number; eventCount: number }[];
      }>(request, '/api/admin/scoring-health/feedback'),

      fetchSection<{
        factors: { factor: string; changePercent: number }[];
      }>(request, '/api/admin/scoring-health/weight-drift'),
    ]);

    // ── Count sources ──────────────────────────────────────────────
    const sources = [overview, temporal, antiPatterns, feedback, weightDrift];
    const sourcesChecked = sources.length;
    const sourcesFailed = sources.filter((s) => s === null).length;

    // ── Transform to AnomalySourceData ─────────────────────────────
    const sourceData: AnomalySourceData = {
      overview: overview
        ? {
            correlation: overview.correlation,
            correlationTrend: overview.correlationTrend,
            lastCronSuccess: overview.lastCron.success,
            lastCronTimestamp: overview.lastCron.timestamp,
            abTestsConcluded: overview.abTests.concluded,
            abTestsRunning: overview.abTests.running,
          }
        : null,

      temporal: temporal
        ? {
            channels: [
              temporal.freshness.seasonal,
              temporal.freshness.trending,
            ],
          }
        : null,

      antiPatterns: antiPatterns
        ? {
            highCount: antiPatterns.high.length,
            topPair: antiPatterns.high[0] ?? undefined,
          }
        : null,

      feedback: feedback
        ? {
            redFlags: feedback.redFlags,
            platformSatisfaction: feedback.platformSatisfaction,
          }
        : null,

      weightDrift: weightDrift
        ? { factors: weightDrift.factors }
        : null,
    };

    // ── Evaluate ───────────────────────────────────────────────────
    const anomalies = evaluateAllAnomalies(sourceData);
    const now = new Date().toISOString();

    const result: AnomalyResponse = {
      anomalies,
      sourcesChecked,
      sourcesFailed,
      generatedAt: now,
    };

    return NextResponse.json({ ok: true, data: result, generatedAt: now });
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
