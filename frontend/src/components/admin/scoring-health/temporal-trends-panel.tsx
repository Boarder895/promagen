'use client';

// src/components/admin/scoring-health/temporal-trends-panel.tsx
// ============================================================================
// SECTION 8 — TEMPORAL TRENDS PANEL
// ============================================================================
//
// Displays:
//   - 📈 Trending Now (top 10): term, velocity %, direction, recent/baseline counts
//   - 🌊 Seasonal Patterns: current-month boosted/dampened terms
//   - 📅 Weekend/Weekday: terms with significant weekend deviation
//   - ⏰ Data Freshness: staleness badges for seasonal + trending pipelines
//
// Data: GET /api/admin/scoring-health/temporal?tier=...&limit=...
//
// Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md § 8
//
// Version: 1.0.0
// Created: 2026-03-01
//
// Existing features preserved: Yes (new component).
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import type {
  ScoringHealthApiResponse,
  TemporalTrendsData,
  TrendingTermDisplay,
  SeasonalInsight,
  WeeklyInsight,
  TemporalFreshness,
} from '@/lib/admin/scoring-health-types';

// ============================================================================
// CONSTANTS
// ============================================================================

const TIERS = [
  { value: 'global', label: 'All Tiers' },
  { value: '1', label: 'Tier 1' },
  { value: '2', label: 'Tier 2' },
  { value: '3', label: 'Tier 3' },
  { value: '4', label: 'Tier 4' },
] as const;

const MONTH_NAMES = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

// ============================================================================
// VELOCITY DISPLAY
// ============================================================================

function VelocityBadge({ velocity, direction }: { velocity: number; direction: string }) {
  const absVel = Math.abs(velocity * 100);
  const arrows = absVel > 200 ? '▲▲▲' : absVel > 80 ? '▲▲' : '▲';

  if (direction === 'falling') {
    const downArrows = absVel > 200 ? '▼▼▼' : absVel > 80 ? '▼▼' : '▼';
    return (
      <span className="text-red-400" style={{ fontSize: 'clamp(9px, 0.85vw, 11px)' }}>
        {downArrows} {absVel.toFixed(0)}%
      </span>
    );
  }

  if (direction === 'rising') {
    return (
      <span className="text-emerald-400" style={{ fontSize: 'clamp(9px, 0.85vw, 11px)' }}>
        {arrows} {absVel.toFixed(0)}%
      </span>
    );
  }

  return (
    <span className="text-white/20" style={{ fontSize: 'clamp(9px, 0.85vw, 11px)' }}>
      ─ stable
    </span>
  );
}

// ============================================================================
// FRESHNESS BADGE
// ============================================================================

function FreshnessBadge({ channel }: { channel: TemporalFreshness }) {
  const colours: Record<string, string> = {
    fresh: 'bg-emerald-500/15 text-emerald-400',
    stale: 'bg-amber-500/15 text-amber-400',
    'no-data': 'bg-white/5 text-white/25',
  };

  const icons: Record<string, string> = {
    fresh: '🟢',
    stale: '🟡',
    'no-data': '⚪',
  };

  const ageLabel = channel.ageMinutes >= 0
    ? channel.ageMinutes < 60
      ? `${channel.ageMinutes}m ago`
      : `${Math.round(channel.ageMinutes / 60)}h ago`
    : '—';

  return (
    <span
      className={`rounded-full ${colours[channel.status] ?? colours['no-data']}`}
      style={{
        fontSize: 'clamp(9px, 0.8vw, 10px)',
        padding: 'clamp(2px, 0.2vw, 3px) clamp(6px, 0.6vw, 8px)',
      }}
    >
      {icons[channel.status] ?? '⚪'} {channel.label}: {ageLabel}
    </span>
  );
}

// ============================================================================
// TRENDING TABLE
// ============================================================================

function TrendingTable({ terms }: { terms: TrendingTermDisplay[] }) {
  if (terms.length === 0) {
    return (
      <p className="text-center text-white/20" style={{ fontSize: 'clamp(10px, 0.9vw, 12px)', padding: 'clamp(8px, 1vw, 12px)' }}>
        No trending terms detected yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      {/* Header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'clamp(20px, 2vw, 28px) 1fr clamp(60px, 7vw, 90px) clamp(55px, 6vw, 75px) clamp(55px, 6vw, 75px)',
          gap: 'clamp(4px, 0.5vw, 8px)',
          padding: 'clamp(4px, 0.5vw, 6px) clamp(6px, 0.6vw, 10px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <span className="text-white/25" style={{ fontSize: 'clamp(8px, 0.7vw, 10px)' }}>#</span>
        <span className="text-white/25" style={{ fontSize: 'clamp(8px, 0.7vw, 10px)' }}>Term</span>
        <span className="text-right text-white/25" style={{ fontSize: 'clamp(8px, 0.7vw, 10px)' }}>Velocity</span>
        <span className="text-right text-white/25" style={{ fontSize: 'clamp(8px, 0.7vw, 10px)' }}>Recent</span>
        <span className="text-right text-white/25" style={{ fontSize: 'clamp(8px, 0.7vw, 10px)' }}>Baseline</span>
      </div>

      {/* Rows */}
      {terms.map((t, i) => (
        <div
          key={t.term}
          style={{
            display: 'grid',
            gridTemplateColumns: 'clamp(20px, 2vw, 28px) 1fr clamp(60px, 7vw, 90px) clamp(55px, 6vw, 75px) clamp(55px, 6vw, 75px)',
            gap: 'clamp(4px, 0.5vw, 8px)',
            padding: 'clamp(4px, 0.4vw, 6px) clamp(6px, 0.6vw, 10px)',
            borderBottom: '1px solid rgba(255,255,255,0.03)',
            alignItems: 'center',
          }}
          className="transition-colors hover:bg-white/[0.02]"
        >
          <span className="font-mono text-white/20" style={{ fontSize: 'clamp(9px, 0.8vw, 11px)' }}>
            {i + 1}
          </span>
          <div className="min-w-0">
            <span className="truncate font-medium text-white/70" style={{ fontSize: 'clamp(10px, 0.95vw, 13px)' }}>
              {t.term}
            </span>
            <span
              className="ml-2 rounded bg-white/5 text-white/30"
              style={{ fontSize: 'clamp(8px, 0.7vw, 9px)', padding: '0 clamp(4px, 0.4vw, 5px)' }}
            >
              {t.category}
            </span>
          </div>
          <span className="text-right">
            <VelocityBadge velocity={t.velocity} direction={t.direction} />
          </span>
          <span className="text-right font-mono text-white/40" style={{ fontSize: 'clamp(9px, 0.85vw, 11px)' }}>
            {t.recentCount.toLocaleString()}
          </span>
          <span className="text-right font-mono text-white/25" style={{ fontSize: 'clamp(9px, 0.85vw, 11px)' }}>
            {t.baselineCount.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// SEASONAL INSIGHTS
// ============================================================================

function SeasonalInsights({ insights }: { insights: SeasonalInsight[] }) {
  const month = new Date().getMonth() + 1;
  const monthName = MONTH_NAMES[month] ?? 'Unknown';

  const boosted = insights.filter((s) => s.currentMonthBoost > 1.15);
  const dampened = insights.filter((s) => s.currentMonthBoost < 0.85);

  if (boosted.length === 0 && dampened.length === 0) {
    return (
      <p className="text-white/20" style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}>
        No significant seasonal patterns for {monthName}.
      </p>
    );
  }

  return (
    <div className="flex flex-col" style={{ gap: 'clamp(4px, 0.4vw, 6px)' }}>
      {boosted.length > 0 && (
        <div
          className="rounded-lg bg-emerald-500/5"
          style={{ padding: 'clamp(6px, 0.6vw, 8px) clamp(8px, 0.8vw, 12px)', fontSize: 'clamp(10px, 0.9vw, 12px)' }}
        >
          <span className="text-emerald-400/70">
            {monthName} boost:
          </span>{' '}
          <span className="text-white/50">
            {boosted.slice(0, 5).map((s) => (
              <span key={s.term}>
                &ldquo;{s.term}&rdquo; <strong className="text-emerald-400">+{((s.currentMonthBoost - 1) * 100).toFixed(0)}%</strong>
                {boosted.indexOf(s) < Math.min(boosted.length, 5) - 1 ? ', ' : ''}
              </span>
            ))}
          </span>
        </div>
      )}
      {dampened.length > 0 && (
        <div
          className="rounded-lg bg-red-500/5"
          style={{ padding: 'clamp(6px, 0.6vw, 8px) clamp(8px, 0.8vw, 12px)', fontSize: 'clamp(10px, 0.9vw, 12px)' }}
        >
          <span className="text-red-400/70">
            {monthName} dampen:
          </span>{' '}
          <span className="text-white/50">
            {dampened.slice(0, 5).map((s) => (
              <span key={s.term}>
                &ldquo;{s.term}&rdquo; <strong className="text-red-400">{((s.currentMonthBoost - 1) * 100).toFixed(0)}%</strong>
                {dampened.indexOf(s) < Math.min(dampened.length, 5) - 1 ? ', ' : ''}
              </span>
            ))}
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// WEEKLY INSIGHTS
// ============================================================================

function WeeklyInsights({ insights }: { insights: WeeklyInsight[] }) {
  if (insights.length === 0) return null;

  return (
    <div
      className="rounded-lg bg-blue-500/5"
      style={{ padding: 'clamp(6px, 0.6vw, 8px) clamp(8px, 0.8vw, 12px)', fontSize: 'clamp(10px, 0.9vw, 12px)' }}
    >
      <span className="text-blue-400/70">Weekend patterns:</span>{' '}
      <span className="text-white/50">
        {insights.slice(0, 3).map((w, i) => {
          const pct = ((w.weekendBoost - 1) * 100).toFixed(0);
          const sign = w.weekendBoost > 1 ? '+' : '';
          return (
            <span key={w.term}>
              &ldquo;{w.term}&rdquo; <strong className={w.weekendBoost > 1 ? 'text-blue-400' : 'text-amber-400'}>{sign}{pct}%</strong> on weekends
              {i < Math.min(insights.length, 3) - 1 ? ', ' : ''}
            </span>
          );
        })}
      </span>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function TemporalTrendsPanel() {
  const [tier, setTier] = useState('global');
  const [data, setData] = useState<TemporalTrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/scoring-health/temporal?tier=${tier}&limit=10`);
      const json = (await res.json()) as ScoringHealthApiResponse<TemporalTrendsData>;
      if (!json.ok || !json.data) {
        setError(json.message ?? 'Failed to load temporal data');
        setData(null);
      } else {
        setData(json.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fetch failed');
    } finally {
      setLoading(false);
    }
  }, [tier]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => { void fetchData(); }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div
      className="rounded-xl bg-white/5 ring-1 ring-white/10"
      style={{ padding: 'clamp(16px, 2vw, 24px)' }}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2
            className="font-semibold text-white/80"
            style={{ fontSize: 'clamp(14px, 1.4vw, 18px)' }}
          >
            Temporal Trends
          </h2>
          <p
            className="text-white/30"
            style={{ fontSize: 'clamp(10px, 0.85vw, 12px)', marginTop: 'clamp(1px, 0.15vw, 2px)' }}
          >
            Trending terms, seasonal patterns, and data freshness
          </p>
        </div>
        <div className="flex items-center" style={{ gap: 'clamp(6px, 0.6vw, 8px)' }}>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 text-white/70 outline-none focus:ring-1 focus:ring-violet-500/50"
            style={{ fontSize: 'clamp(10px, 0.9vw, 12px)', padding: 'clamp(4px, 0.4vw, 6px) clamp(8px, 0.8vw, 12px)' }}
            aria-label="Filter by tier"
          >
            {TIERS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={fetchData}
            className="rounded-md bg-white/5 text-white/50 transition-colors hover:bg-white/10 hover:text-white/70"
            style={{ fontSize: 'clamp(10px, 0.9vw, 12px)', padding: 'clamp(4px, 0.4vw, 6px) clamp(10px, 1vw, 14px)' }}
          >
            ⟳
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && !data && (
        <div className="flex items-center justify-center" style={{ minHeight: 'clamp(80px, 10vw, 120px)' }}>
          <span className="animate-pulse text-white/30" style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}>
            Loading temporal data…
          </span>
        </div>
      )}

      {/* Error */}
      {error && !data && (
        <div className="flex items-center justify-center" style={{ minHeight: 'clamp(80px, 10vw, 120px)' }}>
          <span className="text-red-400/70" style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}>
            ❌ {error}
          </span>
        </div>
      )}

      {/* Data */}
      {data && (
        <div className="flex flex-col" style={{ gap: 'clamp(14px, 1.5vw, 20px)' }}>
          {/* 📈 Trending Now */}
          <div>
            <h3
              className="mb-2 font-semibold text-emerald-400/80"
              style={{ fontSize: 'clamp(12px, 1.1vw, 14px)' }}
            >
              📈 Trending Now ({data.trending.length})
            </h3>
            <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/5">
              <TrendingTable terms={data.trending} />
            </div>
          </div>

          {/* 🌊 Seasonal Patterns */}
          <div>
            <h3
              className="mb-2 font-semibold text-blue-400/80"
              style={{ fontSize: 'clamp(12px, 1.1vw, 14px)' }}
            >
              🌊 Seasonal Patterns
            </h3>
            <SeasonalInsights insights={data.seasonalInsights} />
          </div>

          {/* 📅 Weekend / Weekday */}
          {data.weeklyInsights.length > 0 && (
            <div>
              <h3
                className="mb-2 font-semibold text-amber-400/80"
                style={{ fontSize: 'clamp(12px, 1.1vw, 14px)' }}
              >
                📅 Weekend vs Weekday
              </h3>
              <WeeklyInsights insights={data.weeklyInsights} />
            </div>
          )}

          {/* ⏰ Data Freshness */}
          <div
            className="flex flex-wrap items-center rounded-lg bg-white/[0.03]"
            style={{
              gap: 'clamp(8px, 1vw, 14px)',
              padding: 'clamp(8px, 1vw, 12px) clamp(12px, 1.5vw, 18px)',
            }}
          >
            <span className="text-white/30" style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}>
              ⏰ Data Freshness:
            </span>
            <FreshnessBadge channel={data.freshness.seasonal} />
            <FreshnessBadge channel={data.freshness.trending} />
          </div>
        </div>
      )}
    </div>
  );
}
