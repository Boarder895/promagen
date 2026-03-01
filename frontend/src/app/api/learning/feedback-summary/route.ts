/**
 * Feedback Summary API — Admin Feedback Pulse Dashboard
 *
 * GET /api/learning/feedback-summary
 *
 * Aggregates feedback_events for the admin dashboard:
 *   • Velocity: today / week / all-time counts
 *   • Sentiment distribution
 *   • Daily sparkline (14 days)
 *   • Credibility-weighted satisfaction per platform
 *   • Recent feedback stream (last 20)
 *   • Red flag detection
 *
 * Cache: 5 minutes.
 *
 * @see docs/authority/prompt-builder-evolution-plan-v2.md § 7.10h
 *
 * Version: 1.0.0
 * Created: 2026-03-01
 * Existing features preserved: Yes.
 */

import { NextResponse } from 'next/server';

import {
  ensureAllTables,
  countFeedbackByRating,
  fetchRecentFeedbackEvents,
  fetchDailyFeedbackCounts,
  fetchPlatformSatisfaction,
} from '@/lib/learning/database';

// ============================================================================
// TYPES
// ============================================================================

interface RedFlag {
  type: 'low_satisfaction' | 'velocity_drop';
  message: string;
  severity: 'warning' | 'critical';
  platform?: string;
}

export interface FeedbackSummary {
  velocity: {
    today: number;
    thisWeek: number;
    allTime: number;
  };
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
    total: number;
  };
  dailySpark: { date: string; positive: number; neutral: number; negative: number }[];
  platformSatisfaction: { platform: string; score: number; eventCount: number }[];
  recentEvents: {
    id: string;
    platform: string;
    rating: string;
    credibilityScore: number;
    userTier: string | null;
    tier: number;
    createdAt: string;
  }[];
  redFlags: RedFlag[];
  generatedAt: string;
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

function detectRedFlags(
  platformSat: { platform: string; score: number; eventCount: number }[],
  dailySpark: { date: string; positive: number; neutral: number; negative: number }[],
): RedFlag[] {
  const flags: RedFlag[] = [];

  // 1. Any platform with satisfaction < 50 (need 3+ events for signal)
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

  // 2. Velocity drop: recent half vs older half of sparkline
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

export async function GET(): Promise<NextResponse> {
  try {
    await ensureAllTables();

    const [
      sentimentToday,
      sentimentWeek,
      sentimentAll,
      dailySpark,
      platformSat,
      recentRaw,
    ] = await Promise.all([
      countFeedbackByRating(startOfToday()),
      countFeedbackByRating(startOfWeek()),
      countFeedbackByRating(new Date('2020-01-01')),
      fetchDailyFeedbackCounts(14),
      fetchPlatformSatisfaction(startOfWeek()),
      fetchRecentFeedbackEvents(new Date('2020-01-01'), 20),
    ]);

    const redFlags = detectRedFlags(platformSat, dailySpark);

    const summary: FeedbackSummary = {
      velocity: {
        today: sentimentToday.total,
        thisWeek: sentimentWeek.total,
        allTime: sentimentAll.total,
      },
      sentiment: sentimentAll,
      dailySpark,
      platformSatisfaction: platformSat,
      recentEvents: recentRaw.map((e) => ({
        id: e.id,
        platform: e.platform,
        rating: e.rating,
        credibilityScore: e.credibility_score,
        userTier: e.user_tier,
        tier: e.tier,
        createdAt: typeof e.created_at === 'string' ? e.created_at : e.created_at.toISOString(),
      })),
      redFlags,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(
      { ok: true, data: summary },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      },
    );
  } catch (error) {
    console.error('[FeedbackSummary] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to generate feedback summary' },
      { status: 500 },
    );
  }
}
