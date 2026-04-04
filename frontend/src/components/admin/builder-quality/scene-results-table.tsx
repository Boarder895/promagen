'use client';

// src/components/admin/builder-quality/scene-results-table.tsx
// ============================================================================
// SCENE RESULTS TABLE — Per-scene breakdown for a single platform
// ============================================================================
//
// 8 rows (core scenes), one per scene. Click row → expands anchor audit.
// Columns: Scene Name, Score, Preservation %, Critical Drops, Anchor Summary,
//          Instability flag.
//
// Authority: docs/authority/builder-quality-intelligence.md v2.5.0 §9.2
// Build plan: part-8-build-plan v1.2.0, Sub-Delivery 8b
//
// Version: 1.0.0
// Created: 4 April 2026
//
// Existing features preserved: Yes (new file).
// ============================================================================

import { useState, Fragment } from 'react';
import { AnchorAuditPanel, type AnchorAuditEntry } from './anchor-audit-panel';
import type { PlatformSceneAggregate } from '@/lib/builder-quality/aggregation';

// =============================================================================
// TYPES
// =============================================================================

interface DetailResult {
  sceneId: string;
  sceneName: string;
  replicateIndex: number;
  gptScore: number;
  gptSummary: string;
  anchorAudit: AnchorAuditEntry[] | null;
  anchorsExpected: number;
  anchorsPreserved: number;
  anchorsDropped: number;
  criticalAnchorsDropped: number;
  status: string;
  isHoldout: boolean;
}

interface Props {
  sceneAggregates: PlatformSceneAggregate[];
  detailResults: DetailResult[];
}

// =============================================================================
// HELPERS
// =============================================================================

function scoreColour(score: number): string {
  if (score < 70) return 'text-red-400';
  if (score < 80) return 'text-amber-400';
  if (score >= 90) return 'text-emerald-400';
  return 'text-white';
}

function anchorSummary(expected: number, preserved: number, dropped: number): string {
  const approx = expected - preserved - dropped;
  const parts: string[] = [];
  if (preserved > 0) parts.push(`${preserved} exact`);
  if (approx > 0) parts.push(`${approx} approx`);
  if (dropped > 0) parts.push(`${dropped} dropped`);
  return parts.length > 0 ? parts.join(', ') : '—';
}

// =============================================================================
// COMPONENT
// =============================================================================

export function SceneResultsTable({ sceneAggregates, detailResults }: Props) {
  const [expandedScene, setExpandedScene] = useState<string | null>(null);

  const handleRowClick = (sceneId: string, hasAnchorData: boolean) => {
    if (!hasAnchorData) return;
    setExpandedScene(expandedScene === sceneId ? null : sceneId);
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-white/10 bg-white/5">
            {['Scene', 'Score', 'Preservation', 'Critical', 'Anchors', 'Stability'].map(
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
          {sceneAggregates.map((scene) => {
            const isExpanded = expandedScene === scene.sceneId;

            // Get anchor audit data from the detail results for this scene
            const sceneDetails = detailResults.filter(
              (r) => r.sceneId === scene.sceneId && r.status === 'complete',
            );
            // Use the first replicate's anchor audit for display
            const firstDetail = sceneDetails[0];
            const anchors = firstDetail?.anchorAudit ?? null;
            const hasAnchorData = anchors !== null && anchors.length > 0;

            const rowTint =
              scene.criticalDropped > 0 || scene.meanScore < 70
                ? 'bg-red-500/5'
                : scene.unstable
                  ? 'bg-amber-500/5'
                  : '';

            return (
              <Fragment key={scene.sceneId}>
                <tr
                  onClick={() => handleRowClick(scene.sceneId, hasAnchorData)}
                  className={`border-b border-white/5 transition-colors hover:bg-white/10 ${rowTint} ${
                    hasAnchorData ? 'cursor-pointer' : ''
                  }`}
                >
                  {/* Scene name */}
                  <td
                    className="font-medium text-white"
                    style={{
                      fontSize: 'clamp(11px, 1vw, 14px)',
                      padding: 'clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)',
                    }}
                  >
                    <span className="flex items-center" style={{ gap: 'clamp(4px, 0.4vw, 6px)' }}>
                      {hasAnchorData && (
                        <span
                          className="text-slate-300"
                          style={{
                            fontSize: 'clamp(10px, 0.8vw, 12px)',
                            transition: 'transform 0.15s',
                            display: 'inline-block',
                            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                          }}
                        >
                          ▶
                        </span>
                      )}
                      {scene.sceneId}
                    </span>
                  </td>

                  {/* Score */}
                  <td
                    className={`font-mono font-semibold ${scoreColour(scene.meanScore)}`}
                    style={{
                      fontSize: 'clamp(11px, 1vw, 14px)',
                      padding: 'clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)',
                    }}
                  >
                    {scene.meanScore.toFixed(1)}
                  </td>

                  {/* Preservation % */}
                  <td
                    className={`font-mono ${
                      scene.preservationPct < 70
                        ? 'text-red-400'
                        : scene.preservationPct < 85
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                    }`}
                    style={{
                      fontSize: 'clamp(10px, 0.9vw, 13px)',
                      padding: 'clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)',
                    }}
                  >
                    {scene.preservationPct.toFixed(0)}%
                  </td>

                  {/* Critical drops */}
                  <td
                    className={`font-mono ${
                      scene.criticalDropped > 0 ? 'text-red-400 font-semibold' : 'text-slate-200'
                    }`}
                    style={{
                      fontSize: 'clamp(10px, 0.9vw, 13px)',
                      padding: 'clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)',
                    }}
                  >
                    {scene.criticalDropped}
                  </td>

                  {/* Anchor summary */}
                  <td
                    className="text-slate-200"
                    style={{
                      fontSize: 'clamp(10px, 0.9vw, 12px)',
                      padding: 'clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)',
                    }}
                  >
                    {firstDetail
                      ? anchorSummary(
                          firstDetail.anchorsExpected,
                          firstDetail.anchorsPreserved,
                          firstDetail.anchorsDropped,
                        )
                      : 'No anchor data'}
                  </td>

                  {/* Stability */}
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

                {/* Expanded anchor audit */}
                {isExpanded && anchors && (
                  <tr className="border-b border-white/5">
                    <td colSpan={6}>
                      <AnchorAuditPanel anchors={anchors} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
