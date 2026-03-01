// src/app/api/admin/scoring-health/code-radar/route.ts
// ============================================================================
// GET  /api/admin/scoring-health/code-radar  — Run 9-system radar scan
// POST /api/admin/scoring-health/code-radar  — Act on proposal / review / dismiss
// ============================================================================
//
// GET:  Aggregates data from existing section APIs + pipeline constants,
//       reads git-aware dates from code-dates.generated.ts, loads stored
//       history, runs the 9-system evaluator, returns the full RadarReport.
//
// POST: Records an evolution action (acted/reviewed/dismissed), computes
//       the confidence boost, persists to learned_weights under key
//       'radar-history', returns updated history.
//
// Version: 2.0.0 — Git-Aware Confidence + Act-on-Proposal workflow
// Created: 2026-03-01
//
// Existing features preserved: Yes (GET behaviour unchanged, POST is new).
// ============================================================================

import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

import {
  evaluateRadar,
  computeReviewBoost,
  buildHistoryEntry,
  type RadarSourceData,
  type RadarReport,
  type EvolutionActionRequest,
  type StoredRadarHistory,
} from '@/lib/admin/code-evolution-radar';
import { OUTCOME_SIGNAL_WEIGHTS } from '@/lib/learning/outcome-score';
import { STATIC_DEFAULTS, WEIGHT_FLOOR } from '@/lib/learning/weight-recalibration';
import { LEARNING_CONSTANTS } from '@/lib/learning/constants';
import { ensureAllTables, getLearnedWeights, upsertLearnedWeights } from '@/lib/learning/database';
import { CODE_DATES, DATA_VOLUME_AT_WRITE } from '@/lib/admin/code-dates.generated';
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
// HISTORY PERSISTENCE — stored in learned_weights under 'radar-history'
// ============================================================================

const RADAR_HISTORY_KEY = 'radar-history';
const MAX_HISTORY_ENTRIES = 100;

async function loadHistory(): Promise<StoredRadarHistory> {
  try {
    await ensureAllTables();
    const row = await getLearnedWeights<StoredRadarHistory>(RADAR_HISTORY_KEY);
    if (row?.data && Array.isArray(row.data.entries)) {
      return row.data;
    }
  } catch {
    // Table may not exist yet — return empty
  }
  return { entries: [], reviews: {} };
}

async function saveHistory(history: StoredRadarHistory): Promise<void> {
  try {
    await ensureAllTables();
    // Trim to max entries (keep newest)
    if (history.entries.length > MAX_HISTORY_ENTRIES) {
      history.entries = history.entries.slice(-MAX_HISTORY_ENTRIES);
    }
    await upsertLearnedWeights(RADAR_HISTORY_KEY, history);
  } catch {
    // Fire-and-forget — never block the response
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
// SOURCE TYPES
// ============================================================================

interface OverviewData {
  correlation: number;
  correlationTrend: number;
  correlationHistory: { date: string; correlation: number }[];
  totalPrompts: number;
  weeklyDelta: number;
  lastCron: { timestamp: string | null; success: boolean };
}

interface AntiPatternData {
  high: unknown[];
  medium: unknown[];
  low: unknown[];
  summary: { totalActive: number };
}

interface FeedbackData {
  velocity: { allTime: number; thisWeek: number };
}

interface WeightHistoryData {
  factors: { factor: string; baseline: number; current: number }[];
}

// ============================================================================
// GET HANDLER — Run radar scan
// ============================================================================

export async function GET(
  request: NextRequest,
): Promise<NextResponse<ScoringHealthApiResponse<RadarReport>>> {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json(
        { ok: false, data: null, message: 'Unauthorized', generatedAt: new Date().toISOString() },
        { status: 401 },
      );
    }

    // ── Parallel fan-out ─────────────────────────────────────────────
    const [overview, antiPatterns, feedback, weightHistory, storedHistory] = await Promise.all([
      fetchSection<OverviewData>(request, '/api/admin/scoring-health/overview'),
      fetchSection<AntiPatternData>(request, '/api/admin/scoring-health/anti-patterns'),
      fetchSection<FeedbackData>(request, '/api/admin/scoring-health/feedback'),
      fetchSection<WeightHistoryData>(request, '/api/admin/scoring-health/weight-history'),
      loadHistory(),
    ]);

    // ── Build current weights + floor streak proxy ───────────────────
    let currentWeights: Record<string, number> | null = null;
    const factorFloorStreak: Record<string, number> = {};

    if (weightHistory?.factors) {
      currentWeights = {};
      for (const f of weightHistory.factors) {
        currentWeights[f.factor] = f.current;
        factorFloorStreak[f.factor] = f.current <= WEIGHT_FLOOR + 0.005 ? 25 : 0;
      }
    }

    // ── Build observed signal distribution proxy ─────────────────────
    const observedSignalDistribution: Record<string, number> = {};
    const totalEvents = overview?.totalPrompts ?? 0;

    if (feedback && totalEvents > 0) {
      const feedbackRatio = Math.min(0.4, feedback.velocity.allTime / Math.max(1, totalEvents));
      observedSignalDistribution['copied'] = 0.08;
      observedSignalDistribution['copiedNoReturn'] = 0.12;
      observedSignalDistribution['saved'] = 0.28;
      observedSignalDistribution['reusedFromLibrary'] = 0.17;
      observedSignalDistribution['returnedPenalty'] = 0.15;
      observedSignalDistribution['feedbackPositive'] = Math.min(0.30, feedbackRatio + 0.08);
      observedSignalDistribution['feedbackNeutral'] = 0.02;
      observedSignalDistribution['feedbackNegative'] = Math.min(0.15, feedbackRatio * 0.3 + 0.04);
    }

    // ── Estimate scan time from pattern count ────────────────────────
    const patternCount = antiPatterns?.summary?.totalActive ?? 0;
    const estimatedScanMs = Math.round(Math.pow(patternCount / 50, 2) * 200);

    // ── Git-aware dates (from code-dates.generated.ts) ───────────────
    const codeLastUpdated: Record<string, string> = {};
    const dataVolumeAtCodeWrite: Record<string, number> = {};

    for (const [file, entry] of Object.entries(CODE_DATES)) {
      codeLastUpdated[file] = entry.lastModified;
    }
    for (const [file, volume] of Object.entries(DATA_VOLUME_AT_WRITE)) {
      dataVolumeAtCodeWrite[file] = volume;
    }

    // If a file was recently reviewed, use the review date as last-updated
    // (this resets the age decay component of confidence)
    for (const [file, reviewDate] of Object.entries(storedHistory.reviews)) {
      const codeDateStr = codeLastUpdated[file];
      if (codeDateStr && reviewDate > codeDateStr) {
        codeLastUpdated[file] = reviewDate;
      }
    }

    // ── Assemble source data ─────────────────────────────────────────
    const sourceData: RadarSourceData = {
      correlation: overview?.correlation ?? 0,
      correlationTrend: overview?.correlationTrend ?? 0,
      correlationHistory: overview?.correlationHistory ?? [],
      totalPrompts: totalEvents,
      weeklyDelta: overview?.weeklyDelta ?? 0,
      lastCronSuccess: overview?.lastCron?.success ?? false,
      lastCronTimestamp: overview?.lastCron?.timestamp ?? null,

      currentWeights,
      staticDefaults: { ...STATIC_DEFAULTS },
      weightFloor: WEIGHT_FLOOR,
      factorFloorStreak,

      codedSignalWeights: { ...OUTCOME_SIGNAL_WEIGHTS },
      observedSignalDistribution,

      activePatternCount: patternCount,
      patternGrowthPerWeek: 3,
      maxPatternsBeforeSaturation: LEARNING_CONSTANTS.ANTI_PATTERN_MAX_PAIRS_PER_TIER,
      scanTimeMs: estimatedScanMs,
      scanBudgetMs: 200,

      vocabularyCategoryCount: 11,
      uncategorisedTermCount: 0,
      uncategorisedGrowthPerWeek: 0,
      emergingClusterTerms: [],

      feedbackTotal: feedback?.velocity?.allTime ?? 0,
      feedbackThisWeek: feedback?.velocity?.thisWeek ?? 0,

      codeLastUpdated,
      dataVolumeAtCodeWrite,
    };

    // ── Run the 9-system evaluator ───────────────────────────────────
    const report = evaluateRadar(sourceData);

    // ── Merge stored history + reviews into report ───────────────────
    report.history = storedHistory.entries.slice().reverse(); // newest first
    report.reviews = storedHistory.reviews;

    return NextResponse.json({
      ok: true,
      data: report,
      generatedAt: report.generatedAt,
    });
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

// ============================================================================
// POST HANDLER — Act on proposal / review / dismiss
// ============================================================================

interface PostResponse {
  ok: boolean;
  entry: ReturnType<typeof buildHistoryEntry> | null;
  message: string;
  generatedAt: string;
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<PostResponse>> {
  const now = new Date().toISOString();
  try {
    if (!(await isAdmin())) {
      return NextResponse.json(
        { ok: false, entry: null, message: 'Unauthorized', generatedAt: now },
        { status: 401 },
      );
    }

    const body = (await request.json()) as EvolutionActionRequest;

    // Validate
    if (!body.file || !body.actionType) {
      return NextResponse.json(
        { ok: false, entry: null, message: 'Missing file or actionType', generatedAt: now },
        { status: 400 },
      );
    }
    if (!['acted', 'reviewed', 'dismissed'].includes(body.actionType)) {
      return NextResponse.json(
        { ok: false, entry: null, message: 'Invalid actionType', generatedAt: now },
        { status: 400 },
      );
    }

    // Compute boost + build entry
    const boost = computeReviewBoost(body.actionType);
    const confidenceAfter = Math.min(100, (body.confidenceBefore ?? 50) + boost);
    const entry = buildHistoryEntry(body, confidenceAfter);

    // Load, append, save
    const history = await loadHistory();
    history.entries.push(entry);
    history.reviews[body.file] = new Date().toISOString().slice(0, 10);
    await saveHistory(history);

    return NextResponse.json({
      ok: true,
      entry,
      message: `Recorded ${body.actionType} for ${body.file}. Confidence: ${body.confidenceBefore}% → ${confidenceAfter}%`,
      generatedAt: now,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        entry: null,
        message: err instanceof Error ? err.message : 'Internal error',
        generatedAt: now,
      },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
