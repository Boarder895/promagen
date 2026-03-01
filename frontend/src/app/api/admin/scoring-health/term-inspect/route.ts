// src/app/api/admin/scoring-health/term-inspect/route.ts
// ============================================================================
// GET /api/admin/scoring-health/term-inspect
// ============================================================================
//
// Returns detailed inspection data for a single vocabulary term:
//   - Per-tier quality scores (1–4 + global)
//   - Per-platform quality breakdown
//   - Category classification
//   - Global aggregates
//
// Query params:
//   ?term=<string>   (required)
//   ?tier=global|1|2|3|4  (for platform breakdown context, default: global)
//
// Data sources:
//   - term-quality-scores (per-tier term quality)
//   - platform-term-quality (per-platform breakdown)
//   - phrase-category-map (category lookup)
//
// Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md
//
// Version: 1.0.1 — fix: use getLearnedWeights + auth() pattern
// Created: 2026-03-01
//
// Existing features preserved: Yes.
// ============================================================================

import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

import { ensureAllTables, getLearnedWeights } from '@/lib/learning/database';
import { LEARNING_CONSTANTS } from '@/lib/learning/constants';

import type { TermQualityScores } from '@/lib/learning/term-quality-scoring';
import type { PlatformTermQualityData } from '@/lib/learning/platform-term-quality';
import type {
  ScoringHealthApiResponse,
  TermInspectData,
  TermPlatformBreakdown,
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
// CATEGORY CACHE
// ============================================================================

let categoryCache: Map<string, string> | null = null;

async function getCategoryMap(): Promise<Map<string, string>> {
  if (categoryCache) return categoryCache;

  const row = await getLearnedWeights<Record<string, string>>('phrase-category-map');

  const map = new Map<string, string>();
  if (row?.data && typeof row.data === 'object') {
    for (const [term, cat] of Object.entries(row.data)) {
      map.set(term.toLowerCase(), cat);
    }
  }

  categoryCache = map;
  return map;
}

// ============================================================================
// HANDLER
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse<ScoringHealthApiResponse<TermInspectData>>> {
  try {
    // ── Auth ─────────────────────────────────────────────────────────
    if (!(await isAdmin())) {
      return NextResponse.json(
        { ok: false, data: null, message: 'Unauthorized', generatedAt: new Date().toISOString() },
        { status: 401 },
      );
    }

    // ── Params ──────────────────────────────────────────────────────
    const url = new URL(request.url);
    const term = url.searchParams.get('term');
    const tier = url.searchParams.get('tier') ?? 'global';

    if (!term) {
      return NextResponse.json(
        { ok: false, data: null, message: 'Missing required param: term', generatedAt: new Date().toISOString() },
        { status: 400 },
      );
    }

    // ── Load data sources in parallel ───────────────────────────────
    await ensureAllTables();

    const [tqRow, ptqRow] = await Promise.all([
      getLearnedWeights<TermQualityScores>(LEARNING_CONSTANTS.TERM_QUALITY_KEY),
      getLearnedWeights<PlatformTermQualityData>(LEARNING_CONSTANTS.PLATFORM_TERM_QUALITY_KEY),
    ]);

    const categoryMap = await getCategoryMap();

    // ── Per-tier quality scores ─────────────────────────────────────
    const tierScores: Record<string, { score: number; eventCount: number; trend: number }> = {};
    let globalScore = 0;
    let globalUsage = 0;
    let globalTrend = 0;

    if (tqRow?.data) {
      const tqData = tqRow.data;
      const termLower = term.toLowerCase();

      // Check each tier
      for (const tierKey of ['1', '2', '3', '4']) {
        const tierTerms = tqData.tiers?.[tierKey]?.terms;
        if (tierTerms) {
          const termData = tierTerms[term] ?? tierTerms[termLower];
          if (termData) {
            tierScores[tierKey] = {
              score: termData.score,
              eventCount: termData.eventCount,
              trend: termData.trend,
            };
          }
        }
      }

      // Global
      const globalTerms = tqData.global?.terms;
      if (globalTerms) {
        const termData = globalTerms[term] ?? globalTerms[termLower];
        if (termData) {
          tierScores['global'] = {
            score: termData.score,
            eventCount: termData.eventCount,
            trend: termData.trend,
          };
          globalScore = termData.score;
          globalUsage = termData.eventCount;
          globalTrend = termData.trend;
        }
      }
    }

    // If no global score, compute from tier averages
    if (globalScore === 0 && Object.keys(tierScores).length > 0) {
      const entries = Object.values(tierScores);
      globalScore = entries.reduce((s, e) => s + e.score, 0) / entries.length;
      globalUsage = entries.reduce((s, e) => s + e.eventCount, 0);
      globalTrend = entries.reduce((s, e) => s + e.trend, 0) / entries.length;
    }

    // ── Per-platform breakdown ──────────────────────────────────────
    const platforms: TermPlatformBreakdown[] = [];

    if (ptqRow?.data) {
      const ptqData = ptqRow.data;
      const tierData = tier === 'global' ? null : ptqData.tiers?.[tier];

      // If a specific tier is selected, show platforms for that tier
      // Otherwise aggregate across all tiers
      const platformSources = tierData
        ? [tierData]
        : Object.values(ptqData.tiers ?? {});

      const platformAgg: Record<string, { totalScore: number; totalEvents: number; trendSum: number; count: number }> = {};

      for (const source of platformSources) {
        if (!source?.platforms) continue;
        for (const [platformId, slice] of Object.entries(source.platforms)) {
          const termData = slice.terms?.[term] ?? slice.terms?.[term.toLowerCase()];
          if (!termData) continue;

          if (!platformAgg[platformId]) {
            platformAgg[platformId] = { totalScore: 0, totalEvents: 0, trendSum: 0, count: 0 };
          }
          platformAgg[platformId].totalScore += termData.score * termData.eventCount;
          platformAgg[platformId].totalEvents += termData.eventCount;
          platformAgg[platformId].trendSum += termData.trend;
          platformAgg[platformId].count++;
        }
      }

      for (const [platformId, agg] of Object.entries(platformAgg)) {
        if (agg.totalEvents === 0) continue;
        platforms.push({
          platformId,
          score: agg.totalScore / agg.totalEvents,
          eventCount: agg.totalEvents,
          trend: agg.trendSum / agg.count,
        });
      }
    }

    // ── Category lookup ─────────────────────────────────────────────
    const category = categoryMap.get(term.toLowerCase()) ?? 'unknown';

    // ── Build response ──────────────────────────────────────────────
    const result: TermInspectData = {
      term,
      tierScores,
      platforms: platforms.sort((a, b) => b.score - a.score),
      category,
      globalScore,
      globalUsage,
      globalTrend,
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
