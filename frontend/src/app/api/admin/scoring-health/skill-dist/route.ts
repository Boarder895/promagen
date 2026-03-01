// src/app/api/admin/scoring-health/skill-dist/route.ts
// ============================================================================
// GET /api/admin/scoring-health/skill-dist
// ============================================================================
//
// Aggregates prompt_events to classify sessions into skill levels
// (beginner / intermediate / expert) based on usage patterns.
//
// Classification criteria (per unique session_id in last 30 days):
//   Beginner:     1–3 events, or avg category_count < 3
//   Intermediate: 4–15 events with avg category_count >= 3
//   Expert:       16+ events, or avg category_count >= 6
//
// Also computes:
//   - Graduation funnel (sessions that moved between levels over time)
//   - Tier usage breakdown per skill level
//
// Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md § 9
//
// Version: 1.0.0
// Created: 2026-03-01
//
// Existing features preserved: Yes (new route).
// ============================================================================

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

import { db } from '@/lib/db';
import { ensureAllTables } from '@/lib/learning/database';

import type {
  ScoringHealthApiResponse,
  SkillDistributionData,
  SkillLevelBar,
  SkillLevel,
  GraduationFunnel,
  TierUsageBySkill,
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
// SKILL CLASSIFICATION (pure function, also used in tests)
// ============================================================================

export function classifySkill(eventCount: number, avgCategoryCount: number): SkillLevel {
  if (eventCount >= 16 || avgCategoryCount >= 6) return 'expert';
  if (eventCount >= 4 && avgCategoryCount >= 3) return 'intermediate';
  return 'beginner';
}

// ============================================================================
// HANDLER
// ============================================================================

export async function GET(): Promise<NextResponse<ScoringHealthApiResponse<SkillDistributionData>>> {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json(
        { ok: false, data: null, message: 'Unauthorized', generatedAt: new Date().toISOString() },
        { status: 401 },
      );
    }

    await ensureAllTables();
    const sql = db();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // ── Per-session aggregation (last 30 days) ──────────────────────
    const sessionRows = await sql<{
      session_id: string;
      event_count: string;
      avg_cat: string;
      tiers_used: string; // JSON array of tier values
    }[]>`
      SELECT
        session_id,
        COUNT(*)::text AS event_count,
        AVG(category_count)::text AS avg_cat,
        json_agg(tier) AS tiers_used
      FROM prompt_events
      WHERE created_at > ${thirtyDaysAgo}
      GROUP BY session_id
    `;

    // ── Classify each session ───────────────────────────────────────
    const levelCounts: Record<SkillLevel, number> = { beginner: 0, intermediate: 0, expert: 0 };
    const tierBySkill: Record<SkillLevel, Record<string, number>> = {
      beginner: { '1': 0, '2': 0, '3': 0, '4': 0 },
      intermediate: { '1': 0, '2': 0, '3': 0, '4': 0 },
      expert: { '1': 0, '2': 0, '3': 0, '4': 0 },
    };

    for (const row of sessionRows) {
      const eventCount = parseInt(row.event_count, 10);
      const avgCat = parseFloat(row.avg_cat);
      const level = classifySkill(eventCount, avgCat);
      levelCounts[level]++;

      // Tier usage aggregation
      let tiers: number[];
      try {
        tiers = typeof row.tiers_used === 'string' ? JSON.parse(row.tiers_used) : row.tiers_used;
      } catch {
        tiers = [];
      }
      for (const t of tiers) {
        const key = String(t);
        if (tierBySkill[level][key] !== undefined) {
          tierBySkill[level][key]!++;
        }
      }
    }

    const totalUsers = sessionRows.length;

    // ── Distribution bars ───────────────────────────────────────────
    const distribution: SkillLevelBar[] = (['beginner', 'intermediate', 'expert'] as const).map((level) => ({
      level,
      count: levelCounts[level],
      percentage: totalUsers > 0 ? Math.round((levelCounts[level] / totalUsers) * 100) : 0,
    }));

    // ── Tier usage by skill (convert counts to percentages) ─────────
    const tierUsageBySkill: TierUsageBySkill[] = (['beginner', 'intermediate', 'expert'] as const).map((level) => {
      const counts = tierBySkill[level];
      const total = Object.values(counts).reduce((s, c) => s + c, 0) || 1;
      const tiers: Record<string, number> = {};
      for (const [t, c] of Object.entries(counts)) {
        tiers[t] = Math.round((c / total) * 100);
      }
      return { level, tiers };
    });

    // ── Graduation funnel (compare 60–30 days ago vs last 30 days) ──
    const graduationFunnel: GraduationFunnel[] = [];
    let avgGraduationDays = 0;

    // Sessions that existed in the older period and the recent period
    const olderSessionRows = await sql<{
      session_id: string;
      event_count: string;
      avg_cat: string;
    }[]>`
      SELECT
        session_id,
        COUNT(*)::text AS event_count,
        AVG(category_count)::text AS avg_cat
      FROM prompt_events
      WHERE created_at > ${sixtyDaysAgo}
        AND created_at <= ${thirtyDaysAgo}
      GROUP BY session_id
    `;

    // Build older-period skill map
    const olderSkillMap = new Map<string, SkillLevel>();
    for (const row of olderSessionRows) {
      const level = classifySkill(parseInt(row.event_count, 10), parseFloat(row.avg_cat));
      olderSkillMap.set(row.session_id, level);
    }

    // Build recent-period skill map
    const recentSkillMap = new Map<string, SkillLevel>();
    for (const row of sessionRows) {
      const level = classifySkill(parseInt(row.event_count, 10), parseFloat(row.avg_cat));
      recentSkillMap.set(row.session_id, level);
    }

    // Count transitions
    const transitions: Record<string, { count: number; totalSessions: number }> = {};
    const levelOrder: SkillLevel[] = ['beginner', 'intermediate', 'expert'];

    for (const [sessionId, olderLevel] of olderSkillMap.entries()) {
      const recentLevel = recentSkillMap.get(sessionId);
      if (!recentLevel) continue;

      const olderIdx = levelOrder.indexOf(olderLevel);
      const recentIdx = levelOrder.indexOf(recentLevel);

      // Only count upward transitions (graduation)
      if (recentIdx > olderIdx) {
        const key = `${olderLevel}->${recentLevel}`;
        if (!transitions[key]) transitions[key] = { count: 0, totalSessions: 0 };
        transitions[key].count++;
        // Use recent event count as proxy for sessions needed
        const recentRow = sessionRows.find((r) => r.session_id === sessionId);
        transitions[key].totalSessions += parseInt(recentRow?.event_count ?? '0', 10);
      }
    }

    for (const [key, data] of Object.entries(transitions)) {
      const [from, to] = key.split('->') as [SkillLevel, SkillLevel];
      graduationFunnel.push({
        from,
        to,
        count: data.count,
        avgSessions: data.count > 0 ? Math.round(data.totalSessions / data.count) : 0,
      });
    }

    // Sort: beginner→intermediate first, then intermediate→expert
    graduationFunnel.sort((a, b) => {
      const orderA = levelOrder.indexOf(a.from) * 10 + levelOrder.indexOf(a.to);
      const orderB = levelOrder.indexOf(b.from) * 10 + levelOrder.indexOf(b.to);
      return orderA - orderB;
    });

    // Average graduation time (proxy: 30 days since we compare 30-day windows)
    const totalGraduated = graduationFunnel.reduce((s, g) => s + g.count, 0);
    avgGraduationDays = totalGraduated > 0 ? 30 : 0; // window-based estimate

    const now = new Date().toISOString();

    const result: SkillDistributionData = {
      distribution,
      totalUsers,
      graduationFunnel,
      avgGraduationDays,
      tierUsageBySkill,
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
