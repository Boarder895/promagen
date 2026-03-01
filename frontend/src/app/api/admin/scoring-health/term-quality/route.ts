/**
 * GET /api/admin/scoring-health/term-quality
 *
 * Returns term quality leaderboard data — top 20 and bottom 20 terms
 * with quality scores, usage counts, trends, and summary statistics.
 *
 * Query params:
 *   - tier:     "1" | "2" | "3" | "4" | "global" (default: "global")
 *   - category: vocabulary category filter (default: all)
 *   - sort:     "score" | "usage" | "trend" | "term" (default: "score")
 *   - dir:      "asc" | "desc" (default: "desc")
 *   - search:   text search filter
 *   - limit:    top/bottom N (default: 20, max: 50)
 *
 * Data source: learned_weights table, key "term-quality-scores"
 *
 * Auth: Requires admin role via Clerk.
 *
 * Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md § 6
 *
 * Version: 1.0.0
 * Created: 2026-03-01
 *
 * Existing features preserved: Yes (new file).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

import { ensureAllTables, getLearnedWeights } from '@/lib/learning/database';
import { LEARNING_CONSTANTS } from '@/lib/learning/constants';

import type { TermQualityScores } from '@/lib/learning/term-quality-scoring';
import type {
  ScoringHealthApiResponse,
  TermQualityData,
  TermQualityEntry,
  TermQualitySortField,
} from '@/lib/admin/scoring-health-types';

// =============================================================================
// ADMIN AUTH
// =============================================================================

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

// =============================================================================
// TERM → CATEGORY LOOKUP (built lazily from vocabulary data)
// =============================================================================

let _termCategoryMap: Map<string, string> | null = null;

async function getTermCategoryMap(): Promise<Map<string, string>> {
  if (_termCategoryMap) return _termCategoryMap;
  _termCategoryMap = new Map();

  try {
    const { getPlainPhrases } = await import('@/data/vocabulary/phrase-category-map');
    const categories = [
      'subject', 'action', 'style', 'environment', 'composition',
      'camera', 'lighting', 'colour', 'atmosphere', 'materials', 'fidelity',
    ] as const;
    for (const cat of categories) {
      const phrases = getPlainPhrases(cat);
      for (const phrase of phrases) {
        // First-wins: if a phrase is in multiple categories, keep the first
        if (!_termCategoryMap.has(phrase.toLowerCase())) {
          _termCategoryMap.set(phrase.toLowerCase(), cat);
        }
      }
    }
  } catch {
    // phrase-category-map may not exist — that's fine, all terms get "unknown"
  }

  return _termCategoryMap;
}

// =============================================================================
// VALID PARAMS
// =============================================================================

const VALID_TIERS = new Set(['1', '2', '3', '4', 'global']);
const VALID_SORTS = new Set<TermQualitySortField>(['score', 'usage', 'trend', 'term']);

// =============================================================================
// HANDLER
// =============================================================================

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { ok: false, data: null, message: 'Unauthorized', generatedAt: new Date().toISOString() } satisfies ScoringHealthApiResponse<null>,
      { status: 401 },
    );
  }

  try {
    const url = new URL(req.url);
    const tierParam = url.searchParams.get('tier') ?? 'global';
    const categoryParam = (url.searchParams.get('category') ?? '').toLowerCase();
    const sortParam = (url.searchParams.get('sort') ?? 'score') as TermQualitySortField;
    const dirParam = url.searchParams.get('dir') === 'asc' ? 'asc' as const : 'desc' as const;
    const searchParam = (url.searchParams.get('search') ?? '').toLowerCase().trim();
    const limitParam = Math.min(Math.max(parseInt(url.searchParams.get('limit') ?? '20', 10) || 20, 1), 50);

    const tier = VALID_TIERS.has(tierParam) ? tierParam : 'global';
    const sortBy = VALID_SORTS.has(sortParam) ? sortParam : 'score';

    await ensureAllTables();

    // ── Fetch term quality scores from DB ──────────────────────────────
    const row = await getLearnedWeights<TermQualityScores>(LEARNING_CONSTANTS.TERM_QUALITY_KEY);
    const now = new Date().toISOString();

    const emptyResponse: ScoringHealthApiResponse<TermQualityData> = {
      ok: true,
      data: {
        top: [],
        bottom: [],
        summary: { totalScored: 0, highPerformers: 0, lowPerformers: 0, averageScore: 0 },
        tier,
        generatedAt: now,
      },
      generatedAt: now,
    };

    if (!row?.data) {
      return NextResponse.json(emptyResponse);
    }

    const qualityScores = row.data;

    // ── Get the requested tier's data ──────────────────────────────────
    const tierData = tier === 'global'
      ? qualityScores.global
      : qualityScores.tiers[tier];

    if (!tierData?.terms) {
      return NextResponse.json(emptyResponse);
    }

    // ── Build term → category map ──────────────────────────────────────
    const catMap = await getTermCategoryMap();

    // ── Build filtered entry list ──────────────────────────────────────
    const allEntries: TermQualityEntry[] = [];
    for (const [term, quality] of Object.entries(tierData.terms)) {
      const category = catMap.get(term.toLowerCase()) ?? 'unknown';

      // Apply filters
      if (categoryParam && category !== categoryParam) continue;
      if (searchParam && !term.toLowerCase().includes(searchParam)) continue;

      allEntries.push({
        term,
        score: quality.score,
        usage: quality.eventCount,
        trend: quality.trend,
        category,
      });
    }

    // ── Sort (for the filtered view) ───────────────────────────────────
    allEntries.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'score': cmp = a.score - b.score; break;
        case 'usage': cmp = a.usage - b.usage; break;
        case 'trend': cmp = a.trend - b.trend; break;
        case 'term':  cmp = a.term.localeCompare(b.term); break;
      }
      return dirParam === 'desc' ? -cmp : cmp;
    });

    // ── Top N (always by score desc) ───────────────────────────────────
    const topSorted = [...allEntries].sort((a, b) => b.score - a.score);
    const top = topSorted.slice(0, limitParam);

    // ── Bottom N (always by score asc) ─────────────────────────────────
    const bottomSorted = [...allEntries].sort((a, b) => a.score - b.score);
    const bottom = bottomSorted.slice(0, limitParam);

    // ── Summary (over ALL terms in this tier, not just filtered) ───────
    const allTerms = Object.values(tierData.terms);
    const totalScored = allTerms.length;
    const highPerformers = allTerms.filter((t) => t.score >= 80).length;
    const lowPerformers = allTerms.filter((t) => t.score <= 20).length;
    const averageScore = totalScored > 0
      ? Math.round((allTerms.reduce((sum, t) => sum + t.score, 0) / totalScored) * 100) / 100
      : 0;

    return NextResponse.json({
      ok: true,
      data: {
        top,
        bottom,
        summary: { totalScored, highPerformers, lowPerformers, averageScore },
        tier,
        generatedAt: now,
      },
      generatedAt: now,
    } satisfies ScoringHealthApiResponse<TermQualityData>);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { ok: false, data: null, message, generatedAt: new Date().toISOString() } satisfies ScoringHealthApiResponse<null>,
      { status: 500 },
    );
  }
}

// =============================================================================
// RUNTIME
// =============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
