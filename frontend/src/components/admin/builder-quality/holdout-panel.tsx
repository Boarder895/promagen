'use client';

// src/components/admin/builder-quality/holdout-panel.tsx
// ============================================================================
// HOLDOUT PANEL — §9.7 Holdout Results (separate from core trends)
// ============================================================================
//
// Displays holdout scene results (scenes 9–10) in a separate table.
// Never mixed with core scene data.
//
// Authority: docs/authority/builder-quality-intelligence.md v2.5.0 §9.7
// Build plan: part-8-build-plan v1.2.0, Sub-Delivery 8b
//
// Version: 1.0.0
// Created: 4 April 2026
//
// Existing features preserved: Yes (new file).
// ============================================================================

import type { PlatformSceneAggregate } from '@/lib/builder-quality/aggregation';

interface Props {
  holdoutAggregates: PlatformSceneAggregate[];
}

function scoreColour(score: number): string {
  if (score < 70) return 'text-red-400';
  if (score < 80) return 'text-amber-400';
  if (score >= 90) return 'text-emerald-400';
  return 'text-white';
}

export function HoldoutPanel({ holdoutAggregates }: Props) {
  if (holdoutAggregates.length === 0) {
    return (
      <div
        className="rounded-lg border border-white/10 bg-white/5 text-slate-300"
        style={{
          padding: 'clamp(16px, 2vw, 28px)',
          fontSize: 'clamp(12px, 1.1vw, 14px)',
          textAlign: 'center',
        }}
      >
        No holdout data for this run. Use{' '}
        <span className="font-mono text-white">--holdout</span> flag to include holdout scenes.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-white/10 bg-white/5">
            {['Holdout Scene', 'Score', 'Preservation', 'Critical', 'Replicates', 'Stability'].map(
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
          {holdoutAggregates.map((scene) => (
            <tr key={scene.sceneId} className="border-b border-white/5">
              <td
                className="font-medium text-white"
                style={{
                  fontSize: 'clamp(11px, 1vw, 14px)',
                  padding: 'clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)',
                }}
              >
                {scene.sceneId}
              </td>

              <td
                className={`font-mono font-semibold ${scoreColour(scene.meanScore)}`}
                style={{
                  fontSize: 'clamp(11px, 1vw, 14px)',
                  padding: 'clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)',
                }}
              >
                {scene.meanScore.toFixed(1)}
              </td>

              <td
                className={`font-mono ${
                  scene.preservationPct < 70 ? 'text-red-400' : scene.preservationPct < 85 ? 'text-amber-400' : 'text-emerald-400'
                }`}
                style={{
                  fontSize: 'clamp(10px, 0.9vw, 13px)',
                  padding: 'clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)',
                }}
              >
                {scene.preservationPct.toFixed(0)}%
              </td>

              <td
                className={`font-mono ${scene.criticalDropped > 0 ? 'text-red-400 font-semibold' : 'text-slate-200'}`}
                style={{
                  fontSize: 'clamp(10px, 0.9vw, 13px)',
                  padding: 'clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)',
                }}
              >
                {scene.criticalDropped}
              </td>

              <td
                className="font-mono text-slate-200"
                style={{
                  fontSize: 'clamp(10px, 0.9vw, 13px)',
                  padding: 'clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)',
                  textAlign: 'center',
                }}
              >
                {scene.replicateCount}
              </td>

              <td style={{ padding: 'clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)' }}>
                {scene.unstable ? (
                  <span
                    className="inline-block rounded-full border border-red-500/40 bg-red-500/20 font-medium text-red-300"
                    style={{
                      fontSize: 'clamp(10px, 0.75vw, 11px)',
                      padding: 'clamp(1px, 0.1vh, 2px) clamp(5px, 0.5vw, 8px)',
                    }}
                  >
                    UNSTABLE
                  </span>
                ) : (
                  <span className="text-emerald-400" style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}>
                    Stable
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
