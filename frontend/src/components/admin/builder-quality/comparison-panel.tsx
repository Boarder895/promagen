'use client';

// src/components/admin/builder-quality/comparison-panel.tsx
// ============================================================================
// COMPARISON PANEL — Baseline comparison view
// ============================================================================
//
// Shows current vs baseline for a platform with per-scene deltas,
// classification badge, and confidence indicator.
// Only renders when the run has a baseline_run_id.
//
// Authority: docs/authority/builder-quality-intelligence.md v2.5.0 §9
// Build plan: part-8-build-plan v1.2.0, Sub-Delivery 8b
//
// Version: 1.0.0
// Created: 4 April 2026
//
// Existing features preserved: Yes (new file).
// ============================================================================

import type { Classification, ComparisonConfidence } from '@/lib/builder-quality/aggregation';

// =============================================================================
// TYPES
// =============================================================================

interface SceneRegression {
  sceneId: string;
  currentMean: number;
  baselineMean: number;
  delta: number;
  criticalNewlyDropped: number;
}

interface PlatformComparisonData {
  platformId: string;
  currentMean: number;
  baselineMean: number;
  delta: number;
  classification: Classification;
  confidence: ComparisonConfidence;
  criticalNewlyDropped: number;
  importantNewlyDropped: number;
  optionalNewlyDropped: number;
  worstSceneRegression: SceneRegression | null;
  baselineRunId: string;
}

interface Props {
  comparison: PlatformComparisonData;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CLASSIFICATION_BADGE: Record<Classification, { label: string; className: string }> = {
  regression: { label: 'Regression', className: 'bg-red-500/20 text-red-300 border-red-500/40' },
  improvement: { label: 'Improvement', className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  neutral: { label: 'Neutral', className: 'bg-white/10 text-slate-200 border-white/20' },
  neutral_unstable: { label: 'Unstable', className: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
};

const CONFIDENCE_COLOUR: Record<ComparisonConfidence, string> = {
  high: 'text-emerald-400',
  medium: 'text-amber-400',
  low: 'text-red-400',
};

// =============================================================================
// HELPERS
// =============================================================================

function deltaArrow(delta: number): string {
  if (delta > 0) return '↑';
  if (delta < 0) return '↓';
  return '—';
}

function deltaColour(delta: number): string {
  if (delta >= 3) return 'text-emerald-400';
  if (delta <= -5) return 'text-red-400';
  if (delta < 0) return 'text-amber-400';
  return 'text-white';
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ComparisonPanel({ comparison }: Props) {
  const badge = CLASSIFICATION_BADGE[comparison.classification];
  const confidenceColour = CONFIDENCE_COLOUR[comparison.confidence];

  return (
    <div className="rounded-lg border border-white/10">
      {/* Summary row */}
      <div
        className="flex flex-wrap items-center justify-between bg-white/5"
        style={{
          padding: 'clamp(12px, 1.2vw, 18px) clamp(14px, 1.4vw, 20px)',
          gap: 'clamp(10px, 1vw, 16px)',
        }}
      >
        {/* Delta */}
        <div className="flex items-center" style={{ gap: 'clamp(8px, 0.8vw, 12px)' }}>
          <span
            className={`font-mono font-bold ${deltaColour(comparison.delta)}`}
            style={{ fontSize: 'clamp(18px, 2vw, 28px)' }}
          >
            {deltaArrow(comparison.delta)} {comparison.delta > 0 ? '+' : ''}
            {comparison.delta.toFixed(1)}
          </span>
          <div>
            <div className="text-slate-200" style={{ fontSize: 'clamp(10px, 0.9vw, 13px)' }}>
              {comparison.currentMean.toFixed(1)} vs {comparison.baselineMean.toFixed(1)}
            </div>
            <div
              className="font-mono text-slate-300"
              style={{ fontSize: 'clamp(10px, 0.8vw, 11px)' }}
            >
              baseline: {comparison.baselineRunId.slice(0, 16)}
            </div>
          </div>
        </div>

        {/* Classification + confidence */}
        <div className="flex items-center" style={{ gap: 'clamp(8px, 0.8vw, 12px)' }}>
          <span
            className={`inline-block rounded-full border font-medium ${badge.className}`}
            style={{
              fontSize: 'clamp(10px, 0.85vw, 12px)',
              padding: 'clamp(2px, 0.2vh, 4px) clamp(8px, 0.8vw, 12px)',
            }}
          >
            {badge.label}
          </span>
          <span
            className={`font-medium ${confidenceColour}`}
            style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}
          >
            Confidence: {comparison.confidence.charAt(0).toUpperCase() + comparison.confidence.slice(1)}
          </span>
        </div>
      </div>

      {/* Anchor drop summary */}
      {(comparison.criticalNewlyDropped > 0 ||
        comparison.importantNewlyDropped > 0 ||
        comparison.optionalNewlyDropped > 0) && (
        <div
          className="border-t border-white/5 bg-red-500/5"
          style={{
            padding: 'clamp(8px, 0.8vw, 12px) clamp(14px, 1.4vw, 20px)',
          }}
        >
          <span
            className="text-red-300"
            style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}
          >
            Newly dropped anchors:{' '}
            {[
              comparison.criticalNewlyDropped > 0
                ? `${comparison.criticalNewlyDropped} critical`
                : null,
              comparison.importantNewlyDropped > 0
                ? `${comparison.importantNewlyDropped} important`
                : null,
              comparison.optionalNewlyDropped > 0
                ? `${comparison.optionalNewlyDropped} optional`
                : null,
            ]
              .filter(Boolean)
              .join(', ')}
          </span>
        </div>
      )}

      {/* Worst scene regression */}
      {comparison.worstSceneRegression && (
        <div
          className="border-t border-white/5"
          style={{
            padding: 'clamp(10px, 1vw, 14px) clamp(14px, 1.4vw, 20px)',
          }}
        >
          <span
            className="mb-1 block text-slate-300"
            style={{ fontSize: 'clamp(10px, 0.85vw, 12px)' }}
          >
            Worst scene regression
          </span>
          <div className="flex items-center" style={{ gap: 'clamp(8px, 0.8vw, 12px)' }}>
            <span
              className="font-medium text-white"
              style={{ fontSize: 'clamp(11px, 1vw, 14px)' }}
            >
              {comparison.worstSceneRegression.sceneId}
            </span>
            <span
              className={`font-mono font-semibold ${deltaColour(comparison.worstSceneRegression.delta)}`}
              style={{ fontSize: 'clamp(11px, 1vw, 14px)' }}
            >
              {deltaArrow(comparison.worstSceneRegression.delta)}{' '}
              {comparison.worstSceneRegression.delta.toFixed(1)}
            </span>
            <span
              className="text-slate-300"
              style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}
            >
              ({comparison.worstSceneRegression.currentMean.toFixed(1)} vs{' '}
              {comparison.worstSceneRegression.baselineMean.toFixed(1)})
            </span>
            {comparison.worstSceneRegression.criticalNewlyDropped > 0 && (
              <span
                className="text-red-400"
                style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}
              >
                +{comparison.worstSceneRegression.criticalNewlyDropped} critical dropped
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
