'use client';

// src/components/admin/scoring-health/term-quality-leaderboard.tsx
// ============================================================================
// SECTION 4 — TERM QUALITY LEADERBOARD
// ============================================================================
//
// Displays top 20 and bottom 20 terms per category per tier.
//
// Features:
//   - Filter by category (all 11 prompt-builder categories) + tier (1–4, global)
//   - Sort by any column header click (toggle asc/desc)
//   - Debounced text search (200ms)
//   - Top 20: quality badges with trend arrows
//   - Bottom 20: action buttons (Flag / Hide) — console-only for now
//   - Summary bar: total scored, high performers, low performers
//   - Click-to-inspect: clicking any term opens a slide-out inspector panel
//   - Cross-section drill-through: auto-opens inspector when Anti-Patterns
//     section drills to this section with a term filter
//
// Data: GET /api/admin/scoring-health/term-quality
//
// Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md § 6
//
// Version: 3.0.0 — cross-section drill-through: auto-opens inspector when targeted
// Created: 2026-03-01
//
// Existing features preserved: Yes (all v2.0.0 functionality intact).
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ScoringHealthApiResponse,
  TermQualityData,
  TermQualityEntry,
  TermQualitySortField,
} from '@/lib/admin/scoring-health-types';
import { TermInspector } from '@/components/admin/scoring-health/term-inspector';
import { useDrillThrough } from '@/lib/admin/drill-through-context';

// ============================================================================
// CONSTANTS
// ============================================================================

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'subject', label: 'Subject' },
  { value: 'action', label: 'Action' },
  { value: 'style', label: 'Style' },
  { value: 'environment', label: 'Environment' },
  { value: 'composition', label: 'Composition' },
  { value: 'camera', label: 'Camera' },
  { value: 'lighting', label: 'Lighting' },
  { value: 'atmosphere', label: 'Atmosphere' },
  { value: 'colour', label: 'Colour' },
  { value: 'materials', label: 'Materials' },
  { value: 'fidelity', label: 'Fidelity' },
  { value: 'negative', label: 'Negative' },
  { value: 'unknown', label: 'Unknown' },
] as const;

const TIERS = [
  { value: 'global', label: 'All Tiers (Global)' },
  { value: '1', label: 'Tier 1 — Free' },
  { value: '2', label: 'Tier 2 — Basic' },
  { value: '3', label: 'Tier 3 — Pro' },
  { value: '4', label: 'Tier 4 — Enterprise' },
] as const;

const SORT_OPTIONS: { value: TermQualitySortField; label: string }[] = [
  { value: 'score', label: 'Quality' },
  { value: 'usage', label: 'Usage' },
  { value: 'trend', label: 'Trend' },
  { value: 'term', label: 'Term' },
];

// ============================================================================
// TREND ARROW HELPER
// ============================================================================

function TrendArrow({ trend }: { trend: number }) {
  if (trend > 0.01) {
    return (
      <span className="text-emerald-400" style={{ fontSize: 'clamp(9px, 0.85vw, 11px)' }}>
        ▲ +{(trend * 100).toFixed(0)}%
      </span>
    );
  }
  if (trend < -0.01) {
    return (
      <span className="text-red-400" style={{ fontSize: 'clamp(9px, 0.85vw, 11px)' }}>
        ▼ {(trend * 100).toFixed(0)}%
      </span>
    );
  }
  return (
    <span className="text-white/20" style={{ fontSize: 'clamp(9px, 0.85vw, 11px)' }}>
      ─
    </span>
  );
}

// ============================================================================
// QUALITY BADGE
// ============================================================================

function QualityBadge({ score }: { score: number }) {
  const colour =
    score >= 80
      ? 'bg-emerald-500/15 text-emerald-400'
      : score >= 50
        ? 'bg-amber-500/15 text-amber-400'
        : 'bg-red-500/15 text-red-400';

  return (
    <span
      className={`rounded-full font-mono ${colour}`}
      style={{
        fontSize: 'clamp(9px, 0.85vw, 11px)',
        padding: 'clamp(1px, 0.15vw, 2px) clamp(6px, 0.6vw, 8px)',
      }}
    >
      {score.toFixed(0)}
    </span>
  );
}

// ============================================================================
// CATEGORY TAG
// ============================================================================

function CategoryTag({ category }: { category: string }) {
  return (
    <span
      className="rounded bg-white/5 text-white/40"
      style={{
        fontSize: 'clamp(8px, 0.7vw, 10px)',
        padding: 'clamp(1px, 0.1vw, 2px) clamp(4px, 0.4vw, 6px)',
      }}
    >
      {category}
    </span>
  );
}

// ============================================================================
// TABLE — shared between Top and Bottom
// ============================================================================

function TermTable({
  entries,
  showActions,
  startRank,
  onTermClick,
}: {
  entries: TermQualityEntry[];
  showActions: boolean;
  startRank: number;
  onTermClick?: (term: string) => void;
}) {
  const handleFlag = useCallback((term: string) => {
    // eslint-disable-next-line no-console
    console.log(`[TermQuality] FLAG: "${term}" — marked for review`);
  }, []);

  const handleHide = useCallback((term: string) => {
    // eslint-disable-next-line no-console
    console.log(`[TermQuality] HIDE: "${term}" — suppressed from suggestions`);
  }, []);

  if (entries.length === 0) {
    return (
      <p className="text-white/20" style={{ fontSize: 'clamp(10px, 0.9vw, 12px)', padding: 'clamp(8px, 1vw, 12px)' }}>
        No terms found for the current filters.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      {/* Header row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: showActions
            ? 'clamp(24px, 2.5vw, 32px) 1fr clamp(40px, 5vw, 60px) clamp(50px, 5.5vw, 70px) clamp(50px, 5vw, 65px) clamp(60px, 6vw, 80px) clamp(100px, 10vw, 140px)'
            : 'clamp(24px, 2.5vw, 32px) 1fr clamp(40px, 5vw, 60px) clamp(50px, 5.5vw, 70px) clamp(50px, 5vw, 65px) clamp(60px, 6vw, 80px)',
          gap: 'clamp(4px, 0.5vw, 8px)',
          padding: 'clamp(4px, 0.5vw, 6px) clamp(6px, 0.6vw, 10px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <span className="text-white/25" style={{ fontSize: 'clamp(8px, 0.7vw, 10px)' }}>#</span>
        <span className="text-white/25" style={{ fontSize: 'clamp(8px, 0.7vw, 10px)' }}>Term</span>
        <span className="text-right text-white/25" style={{ fontSize: 'clamp(8px, 0.7vw, 10px)' }}>Qual</span>
        <span className="text-right text-white/25" style={{ fontSize: 'clamp(8px, 0.7vw, 10px)' }}>Usage</span>
        <span className="text-right text-white/25" style={{ fontSize: 'clamp(8px, 0.7vw, 10px)' }}>Trend</span>
        <span className="text-white/25" style={{ fontSize: 'clamp(8px, 0.7vw, 10px)' }}>Category</span>
        {showActions && (
          <span className="text-right text-white/25" style={{ fontSize: 'clamp(8px, 0.7vw, 10px)' }}>Action</span>
        )}
      </div>

      {/* Data rows */}
      {entries.map((entry, i) => (
        <div
          key={`${entry.term}-${i}`}
          style={{
            display: 'grid',
            gridTemplateColumns: showActions
              ? 'clamp(24px, 2.5vw, 32px) 1fr clamp(40px, 5vw, 60px) clamp(50px, 5.5vw, 70px) clamp(50px, 5vw, 65px) clamp(60px, 6vw, 80px) clamp(100px, 10vw, 140px)'
              : 'clamp(24px, 2.5vw, 32px) 1fr clamp(40px, 5vw, 60px) clamp(50px, 5.5vw, 70px) clamp(50px, 5vw, 65px) clamp(60px, 6vw, 80px)',
            gap: 'clamp(4px, 0.5vw, 8px)',
            padding: 'clamp(5px, 0.5vw, 7px) clamp(6px, 0.6vw, 10px)',
            borderBottom: '1px solid rgba(255,255,255,0.03)',
            alignItems: 'center',
          }}
          className="transition-colors hover:bg-white/[0.02]"
        >
          <span
            className="font-mono text-white/20"
            style={{ fontSize: 'clamp(9px, 0.8vw, 11px)' }}
          >
            {startRank + i}
          </span>
          <button
            type="button"
            onClick={() => onTermClick?.(entry.term)}
            className="truncate text-left font-medium text-white/70 underline decoration-white/10 underline-offset-2 transition-colors hover:text-violet-400 hover:decoration-violet-400/40"
            style={{ fontSize: 'clamp(10px, 0.95vw, 13px)' }}
            title={`Inspect "${entry.term}"`}
          >
            {entry.term}
          </button>
          <span className="text-right">
            <QualityBadge score={entry.score} />
          </span>
          <span
            className="text-right font-mono text-white/40"
            style={{ fontSize: 'clamp(9px, 0.85vw, 11px)' }}
          >
            {entry.usage.toLocaleString()}
          </span>
          <span className="text-right">
            <TrendArrow trend={entry.trend} />
          </span>
          <CategoryTag category={entry.category} />
          {showActions && (
            <span className="flex justify-end" style={{ gap: 'clamp(3px, 0.3vw, 5px)' }}>
              <button
                type="button"
                onClick={() => handleFlag(entry.term)}
                className="rounded bg-amber-500/10 text-amber-400/60 transition-colors hover:bg-amber-500/20 hover:text-amber-400"
                style={{
                  fontSize: 'clamp(8px, 0.7vw, 10px)',
                  padding: 'clamp(2px, 0.2vw, 3px) clamp(5px, 0.5vw, 7px)',
                }}
                title="Flag for review"
              >
                Flag
              </button>
              <button
                type="button"
                onClick={() => handleHide(entry.term)}
                className="rounded bg-red-500/10 text-red-400/60 transition-colors hover:bg-red-500/20 hover:text-red-400"
                style={{
                  fontSize: 'clamp(8px, 0.7vw, 10px)',
                  padding: 'clamp(2px, 0.2vw, 3px) clamp(5px, 0.5vw, 7px)',
                }}
                title="Suppress from suggestions"
              >
                Hide
              </button>
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// SUMMARY BAR
// ============================================================================

function SummaryBar({ summary }: { summary: TermQualityData['summary'] }) {
  return (
    <div
      className="flex flex-wrap items-center rounded-lg bg-white/[0.03]"
      style={{
        gap: 'clamp(12px, 1.5vw, 20px)',
        padding: 'clamp(8px, 1vw, 12px) clamp(12px, 1.5vw, 18px)',
        fontSize: 'clamp(10px, 0.9vw, 12px)',
      }}
    >
      <span className="text-white/40">
        <strong className="text-white/60">{summary.totalScored.toLocaleString()}</strong> terms scored
      </span>
      <span className="text-emerald-400/60">
        <strong className="text-emerald-400">{summary.highPerformers.toLocaleString()}</strong> above 80
      </span>
      <span className="text-red-400/60">
        <strong className="text-red-400">{summary.lowPerformers.toLocaleString()}</strong> below 20
      </span>
      <span className="text-white/40">
        Avg: <strong className="text-white/60">{summary.averageScore.toFixed(1)}</strong>
      </span>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function TermQualityLeaderboard() {
  // ── Filter state ────────────────────────────────────────────────────
  const [category, setCategory] = useState('');
  const [tier, setTier] = useState('global');
  const [sortBy, setSortBy] = useState<TermQualitySortField>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // ── Data state ──────────────────────────────────────────────────────
  const [data, setData] = useState<TermQualityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Inspector state ─────────────────────────────────────────────────
  const [inspectedTerm, setInspectedTerm] = useState<string | null>(null);

  // ── Drill-through: auto-open inspector when targeted ──────────────
  const { activeDrill, clearDrill } = useDrillThrough();

  useEffect(() => {
    if (
      activeDrill?.sectionId === 'term-quality' &&
      activeDrill.filter.term
    ) {
      setInspectedTerm(activeDrill.filter.term);
      clearDrill();
    }
  }, [activeDrill, clearDrill]);

  // ── Debounce search input (200ms) ───────────────────────────────────
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 200);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [search]);

  // ── Fetch data ──────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        tier,
        sort: sortBy,
        dir: sortDir,
      });
      if (category) params.set('category', category);
      if (debouncedSearch) params.set('search', debouncedSearch);

      const res = await fetch(`/api/admin/scoring-health/term-quality?${params}`);
      const json = (await res.json()) as ScoringHealthApiResponse<TermQualityData>;

      if (!json.ok || !json.data) {
        setError(json.message ?? 'Failed to load term quality data');
        setData(null);
      } else {
        setData(json.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fetch failed');
    } finally {
      setLoading(false);
    }
  }, [tier, category, sortBy, sortDir, debouncedSearch]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // ── Sort handler ────────────────────────────────────────────────────
  const handleSortChange = useCallback(
    (field: TermQualitySortField) => {
      if (sortBy === field) {
        setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
      } else {
        setSortBy(field);
        setSortDir('desc');
      }
    },
    [sortBy],
  );

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div
      className="rounded-xl bg-white/5 ring-1 ring-white/10"
      style={{ padding: 'clamp(16px, 2vw, 24px)' }}
    >
      {/* ── Section Header ─────────────────────────────────────────── */}
      <div
        className="mb-4 flex items-center justify-between"
        style={{ gap: 'clamp(8px, 1vw, 12px)' }}
      >
        <div>
          <h2
            className="font-semibold text-white/80"
            style={{ fontSize: 'clamp(14px, 1.4vw, 18px)' }}
          >
            Term Quality Leaderboard
          </h2>
          <p
            className="text-white/30"
            style={{
              fontSize: 'clamp(10px, 0.85vw, 12px)',
              marginTop: 'clamp(1px, 0.15vw, 2px)',
            }}
          >
            Top and bottom performing vocabulary terms by quality score
          </p>
        </div>
        <button
          type="button"
          onClick={fetchData}
          className="rounded-md bg-white/5 text-white/50 transition-colors hover:bg-white/10 hover:text-white/70"
          style={{
            fontSize: 'clamp(10px, 0.9vw, 12px)',
            padding: 'clamp(4px, 0.4vw, 6px) clamp(10px, 1vw, 14px)',
          }}
        >
          ⟳ Refresh
        </button>
      </div>

      {/* ── Filters Row ────────────────────────────────────────────── */}
      <div
        className="mb-4 flex flex-wrap items-center"
        style={{ gap: 'clamp(6px, 0.7vw, 10px)' }}
      >
        {/* Category dropdown */}
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 text-white/70 outline-none focus:ring-1 focus:ring-violet-500/50"
          style={{
            fontSize: 'clamp(10px, 0.9vw, 12px)',
            padding: 'clamp(4px, 0.4vw, 6px) clamp(8px, 0.8vw, 12px)',
          }}
          aria-label="Filter by category"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>

        {/* Tier dropdown */}
        <select
          value={tier}
          onChange={(e) => setTier(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 text-white/70 outline-none focus:ring-1 focus:ring-violet-500/50"
          style={{
            fontSize: 'clamp(10px, 0.9vw, 12px)',
            padding: 'clamp(4px, 0.4vw, 6px) clamp(8px, 0.8vw, 12px)',
          }}
          aria-label="Filter by tier"
        >
          {TIERS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        {/* Sort dropdown */}
        <div className="flex items-center" style={{ gap: 'clamp(2px, 0.2vw, 4px)' }}>
          <select
            value={sortBy}
            onChange={(e) => handleSortChange(e.target.value as TermQualitySortField)}
            className="rounded-lg border border-white/10 bg-white/5 text-white/70 outline-none focus:ring-1 focus:ring-violet-500/50"
            style={{
              fontSize: 'clamp(10px, 0.9vw, 12px)',
              padding: 'clamp(4px, 0.4vw, 6px) clamp(8px, 0.8vw, 12px)',
            }}
            aria-label="Sort by column"
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                Sort: {s.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
            className="rounded bg-white/5 text-white/40 transition-colors hover:bg-white/10 hover:text-white/60"
            style={{
              fontSize: 'clamp(10px, 0.9vw, 12px)',
              padding: 'clamp(3px, 0.3vw, 5px) clamp(6px, 0.6vw, 8px)',
            }}
            title={`Sort ${sortDir === 'desc' ? 'descending' : 'ascending'}`}
          >
            {sortDir === 'desc' ? '↓' : '↑'}
          </button>
        </div>

        {/* Search input */}
        <div className="relative flex-1" style={{ minWidth: 'clamp(120px, 15vw, 200px)' }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search terms…"
            className="w-full rounded-lg border border-white/10 bg-white/5 text-white/70 outline-none placeholder:text-white/20 focus:ring-1 focus:ring-violet-500/50"
            style={{
              fontSize: 'clamp(10px, 0.9vw, 12px)',
              padding: 'clamp(4px, 0.4vw, 6px) clamp(8px, 0.8vw, 12px)',
            }}
            aria-label="Search terms"
          />
        </div>
      </div>

      {/* ── Loading ────────────────────────────────────────────────── */}
      {loading && !data && (
        <div
          className="flex items-center justify-center"
          style={{ minHeight: 'clamp(100px, 12vw, 150px)' }}
        >
          <span
            className="animate-pulse text-white/30"
            style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}
          >
            Loading term quality data…
          </span>
        </div>
      )}

      {/* ── Error ──────────────────────────────────────────────────── */}
      {error && !data && (
        <div
          className="flex items-center justify-center"
          style={{ minHeight: 'clamp(100px, 12vw, 150px)' }}
        >
          <span
            className="text-red-400/70"
            style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}
          >
            ❌ {error}
          </span>
        </div>
      )}

      {/* ── Data display ───────────────────────────────────────────── */}
      {data && (
        <div className="flex flex-col" style={{ gap: 'clamp(12px, 1.5vw, 20px)' }}>
          {/* Summary bar */}
          <SummaryBar summary={data.summary} />

          {/* TOP 20 */}
          <div>
            <h3
              className="mb-2 font-semibold text-emerald-400/80"
              style={{ fontSize: 'clamp(12px, 1.1vw, 14px)' }}
            >
              🏆 Top 20
            </h3>
            <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/5">
              <TermTable entries={data.top} showActions={false} startRank={1} onTermClick={setInspectedTerm} />
            </div>
          </div>

          {/* BOTTOM 20 */}
          <div>
            <h3
              className="mb-2 font-semibold text-red-400/80"
              style={{ fontSize: 'clamp(12px, 1.1vw, 14px)' }}
            >
              ⚠️ Bottom 20 — Candidates for Demotion
            </h3>
            <div className="rounded-lg bg-white/[0.02] ring-1 ring-red-500/10">
              <TermTable entries={data.bottom} showActions={true} startRank={1} onTermClick={setInspectedTerm} />
            </div>
          </div>
        </div>
      )}

      {/* ── Term Inspector slide-out ──────────────────────────────── */}
      {inspectedTerm && (
        <TermInspector
          term={inspectedTerm}
          tier={tier}
          onClose={() => setInspectedTerm(null)}
        />
      )}
    </div>
  );
}
