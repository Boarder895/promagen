'use client';

// src/components/admin/builder-quality/replicate-variance-table.tsx
// ============================================================================
// REPLICATE VARIANCE TABLE — Per-scene replicate stats (§9.5)
// ============================================================================
//
// Shows min/max/mean/stddev per scene for a single platform.
// Only renders when replicate count > 1.
//
// Authority: docs/authority/builder-quality-intelligence.md v2.5.0 §9.5
// Build plan: part-8-build-plan v1.2.0, Sub-Delivery 8b
//
// Version: 1.0.0
// Created: 4 April 2026
//
// Existing features preserved: Yes (new file).
// ============================================================================

import type { PlatformSceneAggregate } from '@/lib/builder-quality/aggregation';

interface Props {
  sceneAggregates: PlatformSceneAggregate[];
}

export function ReplicateVarianceTable({ sceneAggregates }: Props) {
  // Check if any scene has more than 1 replicate
  const hasReplicates = sceneAggregates.some((s) => s.replicateCount > 1);

  if (!hasReplicates) {
    return (
      <div
        className="rounded-lg border border-white/10 bg-white/5 text-slate-300"
        style={{
          padding: 'clamp(16px, 2vw, 28px)',
          fontSize: 'clamp(12px, 1.1vw, 14px)',
          textAlign: 'center',
        }}
      >
        Single-replicate run — no variance data. Use{' '}
        <span className="font-mono text-white">--replicates 3</span> for decision-grade runs.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-white/10 bg-white/5">
            {['Scene', 'Replicates', 'Min', 'Max', 'Mean', 'Stddev', 'Status'].map(
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
          {sceneAggregates.map((scene) => (
            <tr
              key={scene.sceneId}
              className={`border-b border-white/5 ${scene.unstable ? 'bg-amber-500/5' : ''}`}
            >
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
                className="font-mono text-slate-200"
                style={{
                  fontSize: 'clamp(10px, 0.9vw, 13px)',
                  padding: 'clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)',
                  textAlign: 'center',
                }}
              >
                {scene.replicateCount}
              </td>

              <td
                className="font-mono text-slate-200"
                style={{
                  fontSize: 'clamp(10px, 0.9vw, 13px)',
                  padding: 'clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)',
                }}
              >
                {scene.minScore}
              </td>

              <td
                className="font-mono text-slate-200"
                style={{
                  fontSize: 'clamp(10px, 0.9vw, 13px)',
                  padding: 'clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)',
                }}
              >
                {scene.maxScore}
              </td>

              <td
                className="font-mono font-semibold text-white"
                style={{
                  fontSize: 'clamp(11px, 1vw, 14px)',
                  padding: 'clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)',
                }}
              >
                {scene.meanScore.toFixed(1)}
              </td>

              <td
                className={`font-mono ${scene.stddevScore > 8 ? 'text-amber-400 font-semibold' : 'text-slate-200'}`}
                style={{
                  fontSize: 'clamp(10px, 0.9vw, 13px)',
                  padding: 'clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)',
                }}
              >
                {scene.stddevScore.toFixed(1)}
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
                  <span
                    className="text-emerald-400"
                    style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}
                  >
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
