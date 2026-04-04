'use client';

// src/components/admin/builder-quality/platform-overview-table.tsx
// ============================================================================
// PLATFORM OVERVIEW TABLE — 40 platforms sorted by score (lowest first)
// ============================================================================
//
// Columns: Platform Name, Tier, Mean Score, Stddev, Preservation %,
//          Critical Drops, Unstable Scenes, Classification
//
// Click row → navigates to /admin/builder-quality/[platformId]?runId=xxx
//
// Authority: docs/authority/builder-quality-intelligence.md v2.5.0 §9.1
// Build plan: part-8-build-plan v1.2.0, Sub-Delivery 8a
//
// Version: 1.0.0
// Created: 4 April 2026
//
// Existing features preserved: Yes (new file).
// ============================================================================

import { useRouter } from 'next/navigation';
import type { PlatformAggregate, Classification } from '@/lib/builder-quality/aggregation';

// =============================================================================
// CONSTANTS
// =============================================================================

const TIER_COLOURS: Record<number, string> = {
  1: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  2: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  3: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  4: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
};

const CLASSIFICATION_BADGE: Record<Classification, { label: string; className: string }> = {
  regression: { label: 'Regression', className: 'bg-red-500/20 text-red-300 border-red-500/40' },
  improvement: { label: 'Improvement', className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  neutral: { label: 'Neutral', className: 'bg-white/10 text-slate-200 border-white/20' },
  neutral_unstable: { label: 'Unstable', className: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
};

// =============================================================================
// HELPERS
// =============================================================================

function getRowTint(platform: PlatformAggregate): string {
  if (platform.classification === 'regression' || platform.meanScore < 70) {
    return 'bg-red-500/5';
  }
  if (platform.classification === 'neutral_unstable') {
    return 'bg-amber-500/5';
  }
  if (platform.meanScore > 90) {
    return 'bg-emerald-500/5';
  }
  return '';
}

function scoreColour(score: number): string {
  if (score < 70) return 'text-red-400';
  if (score < 80) return 'text-amber-400';
  if (score >= 90) return 'text-emerald-400';
  return 'text-white';
}

// =============================================================================
// COMPONENT
// =============================================================================

interface Props {
  platforms: PlatformAggregate[];
  runId: string | null;
}

export function PlatformOverviewTable({ platforms, runId }: Props) {
  const router = useRouter();

  const handleRowClick = (platformId: string) => {
    const params = new URLSearchParams();
    if (runId) params.set('runId', runId);
    router.push(`/admin/builder-quality/${encodeURIComponent(platformId)}?${params.toString()}`);
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-white/10 bg-white/5">
            {['Platform', 'Tier', 'Mean', 'Stddev', 'Preservation', 'Critical', 'Unstable', 'Status'].map(
              (header) => (
                <th
                  key={header}
                  className="text-left font-medium text-slate-200"
                  style={{
                    fontSize: 'clamp(10px, 0.9vw, 12px)',
                    padding: 'clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)',
                    letterSpacing: '0.03em',
                    textTransform: 'uppercase' as const,
                  }}
                >
                  {header}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {platforms.map((p) => {
            const badge = CLASSIFICATION_BADGE[p.classification];
            const tierClass = TIER_COLOURS[p.tier] ?? TIER_COLOURS[3];

            return (
              <tr
                key={p.platformId}
                onClick={() => handleRowClick(p.platformId)}
                className={`cursor-pointer border-b border-white/5 transition-colors hover:bg-white/10 ${getRowTint(p)}`}
              >
                {/* Platform name */}
                <td
                  className="font-medium text-white"
                  style={{
                    fontSize: 'clamp(11px, 1vw, 14px)',
                    padding: 'clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)',
                  }}
                >
                  {p.platformName}
                </td>

                {/* Tier badge */}
                <td style={{ padding: 'clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)' }}>
                  <span
                    className={`inline-block rounded-full border font-medium ${tierClass}`}
                    style={{
                      fontSize: 'clamp(10px, 0.8vw, 11px)',
                      padding: 'clamp(1px, 0.15vh, 3px) clamp(6px, 0.6vw, 10px)',
                    }}
                  >
                    T{p.tier}
                  </span>
                </td>

                {/* Mean score */}
                <td
                  className={`font-mono font-semibold ${scoreColour(p.meanScore)}`}
                  style={{
                    fontSize: 'clamp(11px, 1vw, 14px)',
                    padding: 'clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)',
                  }}
                >
                  {p.meanScore.toFixed(1)}
                </td>

                {/* Stddev */}
                <td
                  className={`font-mono ${p.stddevScore > 8 ? 'text-amber-400' : 'text-slate-200'}`}
                  style={{
                    fontSize: 'clamp(10px, 0.9vw, 13px)',
                    padding: 'clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)',
                  }}
                >
                  {p.stddevScore.toFixed(1)}
                </td>

                {/* Preservation % */}
                <td
                  className={`font-mono ${p.preservationPct < 70 ? 'text-red-400' : p.preservationPct < 85 ? 'text-amber-400' : 'text-emerald-400'}`}
                  style={{
                    fontSize: 'clamp(10px, 0.9vw, 13px)',
                    padding: 'clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)',
                  }}
                >
                  {p.preservationPct.toFixed(0)}%
                </td>

                {/* Critical drops */}
                <td
                  className={`font-mono ${p.criticalDropped > 0 ? 'text-red-400 font-semibold' : 'text-slate-200'}`}
                  style={{
                    fontSize: 'clamp(10px, 0.9vw, 13px)',
                    padding: 'clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)',
                  }}
                >
                  {p.criticalDropped}
                </td>

                {/* Unstable scenes */}
                <td
                  className={`font-mono ${p.unstableSceneCount > 0 ? 'text-amber-400' : 'text-slate-200'}`}
                  style={{
                    fontSize: 'clamp(10px, 0.9vw, 13px)',
                    padding: 'clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)',
                  }}
                >
                  {p.unstableSceneCount}
                </td>

                {/* Classification badge */}
                <td style={{ padding: 'clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)' }}>
                  <span
                    className={`inline-block rounded-full border font-medium ${badge.className}`}
                    style={{
                      fontSize: 'clamp(10px, 0.8vw, 11px)',
                      padding: 'clamp(1px, 0.15vh, 3px) clamp(6px, 0.6vw, 10px)',
                    }}
                  >
                    {badge.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
