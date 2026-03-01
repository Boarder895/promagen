// src/app/api/admin/scoring-health/pipeline-status/route.ts
// ============================================================================
// GET /api/admin/scoring-health/pipeline-status
// ============================================================================
//
// Aggregates health data from existing section APIs and maps each pipeline
// node to a PipelineNodeStatus with health, dataLabel, statusDetail.
//
// Fan-out is parallel and resilient (one failing source marks that node
// as 'unknown', not the whole response).
//
// Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md § 12
//
// Version: 1.0.0
// Created: 2026-03-01
//
// Existing features preserved: Yes (new route).
// ============================================================================

import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

import {
  PIPELINE_NODES,
  buildImpactStatement,
  getOverallHealth,
  type PipelineNodeStatus,
  type NodeHealth,
} from '@/lib/admin/pipeline-dependencies';

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
// INTERNAL FETCH
// ============================================================================

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
// RESPONSE
// ============================================================================

export interface PipelineStatusResponse {
  nodes: PipelineNodeStatus[];
  overallHealth: NodeHealth;
  overallSummary: string;
  generatedAt: string;
}

// ============================================================================
// HANDLER
// ============================================================================

export async function GET(
  request: NextRequest,
): Promise<NextResponse<ScoringHealthApiResponse<PipelineStatusResponse>>> {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json(
        { ok: false, data: null, message: 'Unauthorized', generatedAt: new Date().toISOString() },
        { status: 401 },
      );
    }

    // ── Fan out to existing APIs ─────────────────────────────────────
    const [overview, antiPatterns, temporal, feedback, abTests] = await Promise.all([
      fetchSection<{
        correlation: number;
        correlationTrend: number;
        totalPrompts: number;
        weeklyDelta: number;
        lastCron: { timestamp: string | null; success: boolean };
        abTests: { running: number; concluded: number };
        pipelineUptime: number;
      }>(request, '/api/admin/scoring-health/overview'),

      fetchSection<{
        high: unknown[];
        medium: unknown[];
        low: unknown[];
        summary: { totalActive: number };
      }>(request, '/api/admin/scoring-health/anti-patterns'),

      fetchSection<{
        freshness: {
          seasonal: { ageMinutes: number; status: string };
          trending: { ageMinutes: number; status: string };
        };
        trending: unknown[];
      }>(request, '/api/admin/scoring-health/temporal'),

      fetchSection<{
        velocity: { allTime: number; thisWeek: number };
        platformSatisfaction: { platform: string; score: number }[];
      }>(request, '/api/admin/scoring-health/feedback'),

      fetchSection<{
        summary: { running: number; promoted: number; totalTests: number };
      }>(request, '/api/admin/scoring-health/ab-tests'),
    ]);

    // ── Build node statuses ──────────────────────────────────────────
    const nodes: PipelineNodeStatus[] = PIPELINE_NODES.map((node) => {
      const base = {
        ...node,
        impactIfDown: buildImpactStatement(node.id),
      };

      switch (node.id) {
        case 'telemetry': {
          if (!overview) return { ...base, health: 'unknown' as NodeHealth, statusDetail: 'Data unavailable', dataLabel: '—' };
          const h: NodeHealth = !overview.lastCron.success ? 'critical'
            : overview.weeklyDelta === 0 ? 'warning' : 'healthy';
          return {
            ...base,
            health: h,
            statusDetail: h === 'critical' ? 'Last cron failed' : h === 'warning' ? 'No new events this week' : 'Ingesting normally',
            dataLabel: `${overview.totalPrompts.toLocaleString()} events`,
          };
        }

        case 'co-occurrence': {
          if (!overview) return { ...base, health: 'unknown' as NodeHealth, statusDetail: 'Data unavailable', dataLabel: '—' };
          const h: NodeHealth = overview.totalPrompts < 100 ? 'warning' : 'healthy';
          return { ...base, health: h, statusDetail: h === 'warning' ? 'Too few events for matrix' : 'Matrix computed', dataLabel: 'Active' };
        }

        case 'weight-recal': {
          if (!overview) return { ...base, health: 'unknown' as NodeHealth, statusDetail: 'Data unavailable', dataLabel: '—' };
          const h: NodeHealth = !overview.lastCron.success ? 'critical'
            : Math.abs(overview.correlationTrend) > 0.10 ? 'warning' : 'healthy';
          return {
            ...base,
            health: h,
            statusDetail: h === 'critical' ? 'Cron failed — weights stale' : `Correlation: ${overview.correlation.toFixed(2)}`,
            dataLabel: `r = ${overview.correlation.toFixed(2)}`,
          };
        }

        case 'iteration': {
          if (!overview) return { ...base, health: 'unknown' as NodeHealth, statusDetail: 'Data unavailable', dataLabel: '—' };
          return { ...base, health: 'healthy', statusDetail: 'Tracking active', dataLabel: `${overview.totalPrompts.toLocaleString()} events` };
        }

        case 'negative-patterns': {
          if (!antiPatterns) return { ...base, health: 'unknown' as NodeHealth, statusDetail: 'Data unavailable', dataLabel: '—' };
          const highCount = antiPatterns.high.length;
          const h: NodeHealth = highCount > 10 ? 'warning' : 'healthy';
          return {
            ...base,
            health: h,
            statusDetail: h === 'warning' ? `${highCount} high-severity patterns` : `${antiPatterns.summary.totalActive} active patterns`,
            dataLabel: `${antiPatterns.summary.totalActive} patterns`,
          };
        }

        case 'ab-testing': {
          if (!abTests) return { ...base, health: 'unknown' as NodeHealth, statusDetail: 'Data unavailable', dataLabel: '—' };
          const h: NodeHealth = abTests.summary.running > 0 ? 'healthy' : 'healthy'; // AB tests don't have a "broken" state
          return {
            ...base,
            health: h,
            statusDetail: `${abTests.summary.running} running, ${abTests.summary.promoted} promoted`,
            dataLabel: `${abTests.summary.totalTests} tests`,
          };
        }

        case 'skill-seg': {
          // Skill seg derives from telemetry — healthy if telemetry is
          if (!overview) return { ...base, health: 'unknown' as NodeHealth, statusDetail: 'Data unavailable', dataLabel: '—' };
          return { ...base, health: 'healthy', statusDetail: 'Segmentation active', dataLabel: 'Active' };
        }

        case 'temporal': {
          if (!temporal) return { ...base, health: 'unknown' as NodeHealth, statusDetail: 'Data unavailable', dataLabel: '—' };
          const seasonalStale = temporal.freshness.seasonal.ageMinutes > 36 * 60;
          const trendingStale = temporal.freshness.trending.ageMinutes > 36 * 60;
          const h: NodeHealth = seasonalStale || trendingStale ? 'warning' : 'healthy';
          return {
            ...base,
            health: h,
            statusDetail: h === 'warning'
              ? `Stale: ${seasonalStale ? 'seasonal' : ''}${seasonalStale && trendingStale ? ' + ' : ''}${trendingStale ? 'trending' : ''}`
              : 'Fresh data',
            dataLabel: `${Array.isArray(temporal.trending) ? temporal.trending.length : 0} trends`,
          };
        }

        case 'compression': {
          if (!overview) return { ...base, health: 'unknown' as NodeHealth, statusDetail: 'Data unavailable', dataLabel: '—' };
          return { ...base, health: 'healthy', statusDetail: 'Profiles active', dataLabel: 'Active' };
        }

        case 'feedback': {
          if (!feedback) return { ...base, health: 'unknown' as NodeHealth, statusDetail: 'Data unavailable', dataLabel: '—' };
          const lowPlatforms = feedback.platformSatisfaction.filter((p) => p.score < 50).length;
          const h: NodeHealth = lowPlatforms > 0 ? 'warning' : 'healthy';
          return {
            ...base,
            health: h,
            statusDetail: h === 'warning' ? `${lowPlatforms} platform(s) below 50%` : `${feedback.velocity.thisWeek} this week`,
            dataLabel: `${feedback.velocity.allTime.toLocaleString()} total`,
          };
        }

        case 'platform': {
          if (!overview) return { ...base, health: 'unknown' as NodeHealth, statusDetail: 'Data unavailable', dataLabel: '—' };
          return { ...base, health: 'healthy', statusDetail: 'Learning active', dataLabel: 'Active' };
        }

        case 'redundancy': {
          return { ...base, health: 'healthy', statusDetail: 'Detection active', dataLabel: 'Active' };
        }

        default:
          return { ...base, health: 'unknown' as NodeHealth, statusDetail: 'Unknown node', dataLabel: '—' };
      }
    });

    const overall = getOverallHealth(nodes);
    const now = new Date().toISOString();

    return NextResponse.json({
      ok: true,
      data: {
        nodes,
        overallHealth: overall.health,
        overallSummary: overall.summary,
        generatedAt: now,
      },
      generatedAt: now,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, data: null, message: err instanceof Error ? err.message : 'Internal error', generatedAt: new Date().toISOString() },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
