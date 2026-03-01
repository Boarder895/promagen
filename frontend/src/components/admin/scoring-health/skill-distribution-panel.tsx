'use client';

// src/components/admin/scoring-health/skill-distribution-panel.tsx
// ============================================================================
// SECTION 9 — USER SKILL DISTRIBUTION PANEL
// ============================================================================
//
// Displays:
//   - Distribution bars: beginner / intermediate / expert counts + percentages
//   - Graduation Funnel: users that moved up skill levels in last 30 days
//   - Tier Usage by Skill Level: cross-tabulation heatmap showing which tiers
//     each skill level uses most
//
// Data: GET /api/admin/scoring-health/skill-dist
//
// Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md § 9
//
// Version: 1.0.0
// Created: 2026-03-01
//
// Existing features preserved: Yes (new component).
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import type {
  ScoringHealthApiResponse,
  SkillDistributionData,
  SkillLevelBar,
  GraduationFunnel,
  TierUsageBySkill,
} from '@/lib/admin/scoring-health-types';

// ============================================================================
// CONSTANTS
// ============================================================================

const SKILL_COLOURS: Record<string, { bar: string; text: string; bg: string }> = {
  beginner:     { bar: 'bg-blue-500/40',    text: 'text-blue-400',    bg: 'bg-blue-500/10' },
  intermediate: { bar: 'bg-amber-500/40',   text: 'text-amber-400',   bg: 'bg-amber-500/10' },
  expert:       { bar: 'bg-emerald-500/40', text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
};

const SKILL_LABELS: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  expert: 'Expert',
};

// ============================================================================
// DISTRIBUTION BARS
// ============================================================================

function DistributionBars({ bars }: { bars: SkillLevelBar[] }) {
  if (bars.length === 0) {
    return (
      <p className="text-center text-white/20" style={{ fontSize: 'clamp(10px, 0.9vw, 12px)', padding: 'clamp(8px, 1vw, 12px)' }}>
        No session data yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col" style={{ gap: 'clamp(6px, 0.6vw, 8px)' }}>
      {bars.map((bar) => {
        const colours = SKILL_COLOURS[bar.level] ?? SKILL_COLOURS.beginner!;
        return (
          <div
            key={bar.level}
            className="flex items-center"
            style={{ gap: 'clamp(6px, 0.6vw, 8px)' }}
          >
            <span
              className="flex-shrink-0 text-white/50"
              style={{ fontSize: 'clamp(10px, 0.9vw, 12px)', width: 'clamp(80px, 9vw, 110px)' }}
            >
              {SKILL_LABELS[bar.level] ?? bar.level}
            </span>
            <div className="relative flex-1" style={{ height: 'clamp(16px, 1.6vw, 22px)' }}>
              <div className="absolute inset-0 rounded-full bg-white/5" />
              <div
                className={`absolute inset-y-0 left-0 rounded-full ${colours.bar}`}
                style={{ width: `${Math.max(bar.percentage, 2)}%`, transition: 'width 0.5s ease-out' }}
              />
            </div>
            <span
              className={`flex-shrink-0 font-mono ${colours.text}`}
              style={{ fontSize: 'clamp(10px, 0.9vw, 12px)', width: 'clamp(35px, 4vw, 50px)', textAlign: 'right' }}
            >
              {bar.percentage}%
            </span>
            <span
              className="flex-shrink-0 text-white/25"
              style={{ fontSize: 'clamp(9px, 0.8vw, 10px)', width: 'clamp(50px, 5.5vw, 70px)', textAlign: 'right' }}
            >
              ({bar.count.toLocaleString()})
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// GRADUATION FUNNEL
// ============================================================================

function GraduationFunnelDisplay({ entries, avgDays }: { entries: GraduationFunnel[]; avgDays: number }) {
  if (entries.length === 0) {
    return (
      <p className="text-white/20" style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}>
        No graduations detected in the last 30 days.
      </p>
    );
  }

  return (
    <div className="flex flex-col" style={{ gap: 'clamp(4px, 0.4vw, 6px)' }}>
      {entries.map((entry) => {
        const toColours = SKILL_COLOURS[entry.to] ?? SKILL_COLOURS.intermediate!;
        return (
          <div
            key={`${entry.from}-${entry.to}`}
            className={`rounded-lg ${toColours.bg}`}
            style={{
              padding: 'clamp(6px, 0.6vw, 8px) clamp(10px, 1vw, 14px)',
              fontSize: 'clamp(10px, 0.9vw, 12px)',
            }}
          >
            <span className="text-white/40">
              {SKILL_LABELS[entry.from]} → {SKILL_LABELS[entry.to]}:
            </span>{' '}
            <strong className={toColours.text}>
              {entry.count} {entry.count === 1 ? 'user' : 'users'}
            </strong>
            <span className="text-white/25">
              {' '}(avg {entry.avgSessions} sessions)
            </span>
          </div>
        );
      })}
      {avgDays > 0 && (
        <div
          className="mt-1 text-white/30"
          style={{ fontSize: 'clamp(9px, 0.85vw, 11px)' }}
        >
          Avg graduation window: ~{avgDays} days
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TIER USAGE HEATMAP
// ============================================================================

function TierUsageTable({ rows }: { rows: TierUsageBySkill[] }) {
  if (rows.length === 0) return null;

  const tierLabels = ['1', '2', '3', '4'];

  function cellColour(pct: number): string {
    if (pct >= 40) return 'bg-violet-500/30 text-violet-300';
    if (pct >= 25) return 'bg-violet-500/15 text-violet-400/70';
    if (pct >= 10) return 'bg-white/5 text-white/40';
    return 'bg-white/[0.02] text-white/20';
  }

  return (
    <div className="overflow-x-auto">
      {/* Header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'clamp(80px, 9vw, 110px) repeat(4, 1fr)',
          gap: '1px',
        }}
      >
        <span
          className="text-white/25"
          style={{ fontSize: 'clamp(8px, 0.75vw, 10px)', padding: 'clamp(4px, 0.4vw, 6px)' }}
        />
        {tierLabels.map((t) => (
          <span
            key={t}
            className="text-center text-white/30"
            style={{ fontSize: 'clamp(9px, 0.8vw, 10px)', padding: 'clamp(4px, 0.4vw, 6px)' }}
          >
            Tier {t}
          </span>
        ))}
      </div>

      {/* Rows */}
      {rows.map((row) => (
        <div
          key={row.level}
          style={{
            display: 'grid',
            gridTemplateColumns: 'clamp(80px, 9vw, 110px) repeat(4, 1fr)',
            gap: '1px',
          }}
        >
          <span
            className={`${SKILL_COLOURS[row.level]?.text ?? 'text-white/50'}`}
            style={{ fontSize: 'clamp(10px, 0.9vw, 12px)', padding: 'clamp(4px, 0.4vw, 6px)' }}
          >
            {SKILL_LABELS[row.level] ?? row.level}
          </span>
          {tierLabels.map((t) => {
            const pct = row.tiers[t] ?? 0;
            return (
              <span
                key={t}
                className={`rounded text-center font-mono ${cellColour(pct)}`}
                style={{
                  fontSize: 'clamp(10px, 0.9vw, 12px)',
                  padding: 'clamp(4px, 0.4vw, 6px)',
                }}
              >
                {pct}%
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function SkillDistributionPanel() {
  const [data, setData] = useState<SkillDistributionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/scoring-health/skill-dist');
      const json = (await res.json()) as ScoringHealthApiResponse<SkillDistributionData>;
      if (!json.ok || !json.data) {
        setError(json.message ?? 'Failed to load skill data');
        setData(null);
      } else {
        setData(json.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fetch failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

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
            User Skill Distribution
          </h2>
          <p
            className="text-white/30"
            style={{ fontSize: 'clamp(10px, 0.85vw, 12px)', marginTop: 'clamp(1px, 0.15vw, 2px)' }}
          >
            Session classification by usage patterns (last 30 days)
          </p>
        </div>
        <div className="flex items-center" style={{ gap: 'clamp(6px, 0.6vw, 8px)' }}>
          {data && (
            <span className="text-white/25" style={{ fontSize: 'clamp(9px, 0.85vw, 11px)' }}>
              {data.totalUsers.toLocaleString()} active sessions
            </span>
          )}
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
            Loading skill data…
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
          {/* Distribution */}
          <div>
            <h3
              className="mb-2 font-semibold text-white/50"
              style={{ fontSize: 'clamp(11px, 1.1vw, 14px)' }}
            >
              Distribution ({data.totalUsers.toLocaleString()} active sessions)
            </h3>
            <DistributionBars bars={data.distribution} />
          </div>

          {/* Graduation Funnel */}
          <div>
            <h3
              className="mb-2 font-semibold text-white/50"
              style={{ fontSize: 'clamp(11px, 1.1vw, 14px)' }}
            >
              🎓 Graduation Funnel (last 30 days)
            </h3>
            <GraduationFunnelDisplay
              entries={data.graduationFunnel}
              avgDays={data.avgGraduationDays}
            />
          </div>

          {/* Tier Usage by Skill Level */}
          <div>
            <h3
              className="mb-2 font-semibold text-white/50"
              style={{ fontSize: 'clamp(11px, 1.1vw, 14px)' }}
            >
              Tier Usage by Skill Level
            </h3>
            <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/5" style={{ padding: 'clamp(6px, 0.6vw, 8px)' }}>
              <TierUsageTable rows={data.tierUsageBySkill} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
