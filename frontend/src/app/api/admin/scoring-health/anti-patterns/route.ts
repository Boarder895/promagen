// src/app/api/admin/scoring-health/anti-patterns/route.ts
// ============================================================================
// GET /api/admin/scoring-health/anti-patterns
// ============================================================================
//
// Reads anti-pattern, collision-matrix, and redundancy-groups data from the
// learned_weights table. Merges all three sources into a unified alert list
// grouped by severity (high / medium / low).
//
// Query params:
//   ?tier=global|1|2|3|4  (default: global)
//
// Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md § 7
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

import type { AntiPatternData as RawAntiPatternData, AntiPattern } from '@/lib/learning/anti-pattern-detection';
import type { CollisionMatrixData, TermCollision } from '@/lib/learning/collision-matrix';
import type { RedundancyGroupsData, RedundancyGroup } from '@/lib/learning/redundancy-detection';
import type {
  AntiPatternAlert,
  AntiPatternData,
  AntiPatternSeverity,
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
// HELPERS
// ============================================================================

function severityBucket(score: number): AntiPatternSeverity {
  if (score >= 0.7) return 'high';
  if (score >= 0.4) return 'medium';
  return 'low';
}

function antiPatternToAlert(p: AntiPattern, idx: number): AntiPatternAlert {
  return {
    id: `ap_${idx}_${p.terms[0]}_${p.terms[1]}`,
    termA: p.terms[0],
    termB: p.terms[1],
    patternType: 'conflict',
    severity: p.severity,
    severityLevel: severityBucket(p.severity),
    occurrenceCount: p.lowCount + p.highCount,
    qualityImpact: -(p.enrichment > 1 ? Math.min(50, (p.enrichment - 1) * 10) : 0),
    suppressed: false,
    dismissed: false,
  };
}

function collisionToAlert(c: TermCollision, idx: number): AntiPatternAlert {
  return {
    id: `col_${idx}_${c.terms[0]}_${c.terms[1]}`,
    termA: c.terms[0],
    termB: c.terms[1],
    patternType: 'collision',
    severity: c.competitionScore,
    severityLevel: severityBucket(c.competitionScore),
    occurrenceCount: c.togetherCount,
    qualityImpact: -(c.qualityDelta * 100),
    suppressed: false,
    dismissed: false,
  };
}

function redundancyToAlert(g: RedundancyGroup, idx: number): AntiPatternAlert {
  const members = g.members.slice(0, 2);
  return {
    id: `red_${idx}_${g.id}`,
    termA: members[0] ?? g.canonical,
    termB: members[1] ?? g.canonical,
    patternType: 'redundancy',
    severity: g.meanRedundancy,
    severityLevel: severityBucket(g.meanRedundancy),
    occurrenceCount: g.totalUsage,
    qualityImpact: -(g.meanRedundancy * 15),
    suppressed: false,
    dismissed: false,
  };
}

// ============================================================================
// HANDLER
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse<ScoringHealthApiResponse<AntiPatternData>>> {
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
    const tier = url.searchParams.get('tier') ?? 'global';

    // ── Load all three data sources in parallel ─────────────────────
    await ensureAllTables();

    const [apRow, colRow, redRow] = await Promise.all([
      getLearnedWeights<RawAntiPatternData>(LEARNING_CONSTANTS.ANTI_PATTERNS_KEY),
      getLearnedWeights<CollisionMatrixData>(LEARNING_CONSTANTS.COLLISION_MATRIX_KEY),
      getLearnedWeights<RedundancyGroupsData>(LEARNING_CONSTANTS.REDUNDANCY_GROUPS_KEY),
    ]);

    const alerts: AntiPatternAlert[] = [];

    // ── Anti-patterns ───────────────────────────────────────────────
    if (apRow?.data) {
      const apData = apRow.data;
      const tierData = tier === 'global' ? apData.global : apData.tiers[tier];
      if (tierData?.patterns) {
        for (let i = 0; i < tierData.patterns.length; i++) {
          alerts.push(antiPatternToAlert(tierData.patterns[i]!, i));
        }
      }
    }

    // ── Collisions ──────────────────────────────────────────────────
    if (colRow?.data) {
      const colData = colRow.data;
      const tierData = tier === 'global' ? colData.global : colData.tiers[tier];
      if (tierData?.collisions) {
        for (let i = 0; i < tierData.collisions.length; i++) {
          alerts.push(collisionToAlert(tierData.collisions[i]!, i));
        }
      }
    }

    // ── Redundancy groups ───────────────────────────────────────────
    if (redRow?.data) {
      const redData = redRow.data;
      const tierData = tier === 'global' ? redData.global : redData.tiers[tier];
      if (tierData?.groups) {
        for (let i = 0; i < tierData.groups.length; i++) {
          alerts.push(redundancyToAlert(tierData.groups[i]!, i));
        }
      }
    }

    // ── Deduplicate by term pair ────────────────────────────────────
    const seen = new Set<string>();
    const deduped: AntiPatternAlert[] = [];
    for (const alert of alerts) {
      const key = [alert.termA, alert.termB].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(alert);
    }

    // ── Sort by severity desc then group ────────────────────────────
    deduped.sort((a, b) => b.severity - a.severity);

    const high = deduped.filter((a) => a.severityLevel === 'high');
    const medium = deduped.filter((a) => a.severityLevel === 'medium');
    const low = deduped.filter((a) => a.severityLevel === 'low');

    const totalActive = deduped.filter((a) => !a.suppressed && !a.dismissed).length;

    const result: AntiPatternData = {
      high: high.slice(0, 20),
      medium: medium.slice(0, 20),
      low: low.slice(0, 20),
      summary: {
        totalActive,
        overridesApplied: 0,
        autoDetectedThisMonth: deduped.length,
      },
      tier,
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
