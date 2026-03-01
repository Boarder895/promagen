// src/app/api/admin/scoring-health/feedback/route.ts
// ============================================================================
// GET /api/admin/scoring-health/feedback
// ============================================================================
//
// Aggregates feedback_events for the scoring health dashboard Section 10.
// Uses the same DB functions as /api/learning/feedback-summary but wraps
// output in the ScoringHealthApiResponse shape.
//
// Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md § 8
//
// Version: 1.0.0
// Created: 2026-03-01
//
// Existing features preserved: Yes (new route, reuses existing DB functions).
// ============================================================================

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

import {
  ensureAllTables,
  countFeedbackByRating,
  fetchDailyFeedbackCounts,
  fetchPlatformSatisfaction,
} from '@/lib/learning/database';

import type {
  ScoringHealthApiResponse,
  FeedbackSummaryData,
  FeedbackRedFlag,
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

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  d.setHours(0, 0, 0, 0);
  return d;
}

function detectRedFlags(
  platformSat: { platform: string; score: number; eventCount: number }[],
  dailySpark: { date: string; positive: number; neutral: number; negative: number }[],
): FeedbackRedFlag[] {
  const flags: FeedbackRedFlag[] = [];

  // Any platform with satisfaction < 50% (need 3+ events for signal)
  for (const p of platformSat) {
    if (p.eventCount >= 3 && p.score < 50) {
      flags.push({
        type: 'low_satisfaction',
        message: `${p.platform} satisfaction at ${p.score}% (${p.eventCount} events)`,
        severity: p.score < 25 ? 'critical' : 'warning',
        platform: p.platform,
      });
    }
  }

  // Velocity drop: recent half vs older half of sparkline
  if (dailySpark.length >= 10) {
    const mid = Math.floor(dailySpark.length / 2);
    const recentTotal = dailySpark.slice(mid).reduce((s, d) => s + d.positive + d.neutral + d.negative, 0);
    const olderTotal = dailySpark.slice(0, mid).reduce((s, d) => s + d.positive + d.neutral + d.negative, 0);
    if (olderTotal > 0 && recentTotal < olderTotal * 0.5) {
      flags.push({
        type: 'velocity_drop',
        message: `Feedback volume dropped ${Math.round((1 - recentTotal / olderTotal) * 100)}% vs previous period`,
        severity: 'warning',
      });
    }
  }

  return flags;
}

// ============================================================================
// HANDLER
// ============================================================================

export async function GET(): Promise<NextResponse<ScoringHealthApiResponse<FeedbackSummaryData>>> {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json(
        { ok: false, data: null, message: 'Unauthorized', generatedAt: new Date().toISOString() },
        { status: 401 },
      );
    }

    await ensureAllTables();

    const [sentimentToday, sentimentWeek, sentimentAll, dailySpark, platformSat] =
      await Promise.all([
        countFeedbackByRating(startOfToday()),
        countFeedbackByRating(startOfWeek()),
        countFeedbackByRating(new Date('2020-01-01')),
        fetchDailyFeedbackCounts(30),
        fetchPlatformSatisfaction(startOfMonth()),
      ]);

    const redFlags = detectRedFlags(platformSat, dailySpark);

    // Sort platforms: top 5 by score + bottom 5 by score
    const sortedPlatforms = [...platformSat].sort((a, b) => b.score - a.score);
    const top5 = sortedPlatforms.slice(0, 5);
    const bottom5 = sortedPlatforms.length > 10
      ? sortedPlatforms.slice(-5)
      : sortedPlatforms.slice(5);
    const displayPlatforms = [...top5, ...bottom5.filter((p) => !top5.includes(p))];

    const now = new Date().toISOString();

    const result: FeedbackSummaryData = {
      velocity: {
        today: sentimentToday.total,
        thisWeek: sentimentWeek.total,
        allTime: sentimentAll.total,
      },
      sentiment: sentimentAll,
      dailySpark,
      platformSatisfaction: displayPlatforms,
      redFlags,
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
