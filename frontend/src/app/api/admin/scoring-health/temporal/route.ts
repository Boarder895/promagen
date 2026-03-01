// src/app/api/admin/scoring-health/temporal/route.ts
// ============================================================================
// GET /api/admin/scoring-health/temporal
// ============================================================================
//
// Reads trending-terms and temporal-boosts from the learned_weights table
// and transforms into the dashboard display format for Section 8.
//
// Query params:
//   ?tier=global|1|2|3|4  (default: global — aggregates all tiers)
//   ?limit=N              (default: 10, max: 30)
//
// Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md § 8
//
// Version: 1.0.0
// Created: 2026-03-01
//
// Existing features preserved: Yes (new route).
// ============================================================================

import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

import { ensureAllTables, getLearnedWeights } from '@/lib/learning/database';
import { LEARNING_CONSTANTS } from '@/lib/learning/constants';

import type { TrendingTermsData } from '@/lib/learning/temporal-intelligence';
import type { TemporalBoostsData } from '@/lib/learning/temporal-intelligence';
import type {
  ScoringHealthApiResponse,
  TemporalTrendsData,
  TrendingTermDisplay,
  SeasonalInsight,
  WeeklyInsight,
  TemporalFreshness,
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
// HELPERS
// ============================================================================

function ageMinutes(isoTimestamp: string | null): number {
  if (!isoTimestamp) return Infinity;
  return Math.round((Date.now() - new Date(isoTimestamp).getTime()) / 60_000);
}

function freshnessStatus(minutes: number): 'fresh' | 'stale' | 'no-data' {
  if (!isFinite(minutes)) return 'no-data';
  if (minutes <= 120) return 'fresh';    // < 2 hours
  if (minutes <= 1440) return 'stale';   // < 24 hours
  return 'no-data';
}

// ============================================================================
// HANDLER
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse<ScoringHealthApiResponse<TemporalTrendsData>>> {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json(
        { ok: false, data: null, message: 'Unauthorized', generatedAt: new Date().toISOString() },
        { status: 401 },
      );
    }

    const url = new URL(request.url);
    const tier = url.searchParams.get('tier') ?? 'global';
    const limit = Math.min(Number(url.searchParams.get('limit')) || 10, 30);

    await ensureAllTables();

    const [trendingRow, boostsRow] = await Promise.all([
      getLearnedWeights<TrendingTermsData>(LEARNING_CONSTANTS.TRENDING_TERMS_KEY),
      getLearnedWeights<TemporalBoostsData>(LEARNING_CONSTANTS.TEMPORAL_BOOSTS_KEY),
    ]);

    // ── Trending terms ──────────────────────────────────────────────
    const trending: TrendingTermDisplay[] = [];

    if (trendingRow?.data) {
      const td = trendingRow.data;
      const tierKeys = tier === 'global' ? Object.keys(td.trending) : [tier];

      // Aggregate across tiers if global
      const termMap = new Map<string, TrendingTermDisplay>();

      for (const tk of tierKeys) {
        const tierData = td.trending[tk];
        if (!tierData?.terms) continue;

        for (const t of tierData.terms) {
          const existing = termMap.get(t.term);
          if (!existing || Math.abs(t.velocity) > Math.abs(existing.velocity)) {
            termMap.set(t.term, {
              term: t.term,
              category: t.category,
              velocity: t.velocity,
              direction: t.direction,
              recentCount: t.recentCount + (existing?.recentCount ?? 0),
              baselineCount: t.baselineCount + (existing?.baselineCount ?? 0),
            });
          }
        }
      }

      // Sort by absolute velocity descending, take top N
      const sorted = [...termMap.values()].sort(
        (a, b) => Math.abs(b.velocity) - Math.abs(a.velocity),
      );
      trending.push(...sorted.slice(0, limit));
    }

    // ── Seasonal insights (current month) ───────────────────────────
    const seasonalInsights: SeasonalInsight[] = [];
    const currentMonth = new Date().getMonth() + 1; // 1-indexed

    if (boostsRow?.data) {
      const bd = boostsRow.data;
      const tierKeys = tier === 'global' ? Object.keys(bd.seasonal) : [tier];

      const termMap = new Map<string, SeasonalInsight>();

      for (const tk of tierKeys) {
        const tierData = bd.seasonal[tk];
        if (!tierData?.boosts) continue;

        for (const b of tierData.boosts) {
          const boost = b.monthlyBoosts[currentMonth];
          if (boost === undefined) continue;

          const existing = termMap.get(b.term);
          if (!existing || Math.abs(boost - 1) > Math.abs(existing.currentMonthBoost - 1)) {
            termMap.set(b.term, {
              term: b.term,
              category: b.category,
              currentMonthBoost: boost,
              totalEvents: b.totalEvents + (existing?.totalEvents ?? 0),
            });
          }
        }
      }

      // Sort by absolute deviation from 1.0
      const sorted = [...termMap.values()].sort(
        (a, b) => Math.abs(b.currentMonthBoost - 1) - Math.abs(a.currentMonthBoost - 1),
      );
      seasonalInsights.push(...sorted.slice(0, limit));
    }

    // ── Weekly insights (weekend vs weekday) ────────────────────────
    const weeklyInsights: WeeklyInsight[] = [];

    if (boostsRow?.data) {
      const bd = boostsRow.data;
      const tierKeys = tier === 'global' ? Object.keys(bd.weekly) : [tier];

      const termMap = new Map<string, WeeklyInsight>();

      for (const tk of tierKeys) {
        const tierData = bd.weekly[tk];
        if (!tierData?.patterns) continue;

        for (const p of tierData.patterns) {
          // Weekend days: 0 = Sunday, 6 = Saturday
          const satBoost = p.dayBoosts[6] ?? 1;
          const sunBoost = p.dayBoosts[0] ?? 1;
          const weekendAvg = (satBoost + sunBoost) / 2;

          // Only include if significant weekend deviation
          if (Math.abs(weekendAvg - 1) < 0.15) continue;

          const existing = termMap.get(p.term);
          if (!existing || Math.abs(weekendAvg - 1) > Math.abs(existing.weekendBoost - 1)) {
            termMap.set(p.term, {
              term: p.term,
              category: p.category,
              weekendBoost: weekendAvg,
              totalEvents: p.totalEvents + (existing?.totalEvents ?? 0),
            });
          }
        }
      }

      const sorted = [...termMap.values()].sort(
        (a, b) => Math.abs(b.weekendBoost - 1) - Math.abs(a.weekendBoost - 1),
      );
      weeklyInsights.push(...sorted.slice(0, 5));
    }

    // ── Freshness ───────────────────────────────────────────────────
    const seasonalAge = ageMinutes(boostsRow?.data?.generatedAt ?? null);
    const trendingAge = ageMinutes(trendingRow?.data?.generatedAt ?? null);

    const freshness = {
      seasonal: {
        label: 'Seasonal',
        generatedAt: boostsRow?.data?.generatedAt ?? null,
        ageMinutes: isFinite(seasonalAge) ? seasonalAge : -1,
        status: freshnessStatus(seasonalAge),
      } satisfies TemporalFreshness,
      trending: {
        label: 'Trending',
        generatedAt: trendingRow?.data?.generatedAt ?? null,
        ageMinutes: isFinite(trendingAge) ? trendingAge : -1,
        status: freshnessStatus(trendingAge),
      } satisfies TemporalFreshness,
    };

    const now = new Date().toISOString();

    const result: TemporalTrendsData = {
      trending,
      seasonalInsights,
      weeklyInsights,
      freshness,
      tier,
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
