'use client';

// src/components/admin/scoring-health/tier-models-heatmap.tsx
// ============================================================================
// SECTION 3 — PER-TIER SCORING MODELS (HEATMAP) + LIVE CONTROL PANEL
// ============================================================================
//
// Side-by-side weight comparison across all 4 optimizer tiers + global.
// CSS Grid table with heatmap colouring:
//   - Cell background opacity ∝ weight / maxWeight
//   - Emerald spectrum (0 = transparent → max = full emerald)
//   - Hottest / coldest callouts auto-computed
//   - Ring highlight on extreme cells
//
// Live Control Panel Mode:
//   - Click any cell → opens WeightEditorModal to adjust that weight
//   - After edit, auto-refreshes the heatmap
//   - Edit indicator badge in header
//
// No canvas, no SVG — pure CSS Grid cells with computed backgrounds.
//
// Data: GET /api/admin/scoring-health/tier-weights
// Refresh: 5 min auto-poll
//
// Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md § 5
//
// Version: 2.0.0 — Live Control Panel Mode (click-to-edit)
// Created: 2026-03-01
//
// Existing features preserved: Yes.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ScoringHealthApiResponse,
  TierWeightsData,
} from '@/lib/admin/scoring-health-types';
import { REFRESH_INTERVALS } from '@/lib/admin/scoring-health-types';
import { WeightEditorModal } from '@/components/admin/scoring-health/weight-editor-modal';

// ============================================================================
// CONSTANTS
// ============================================================================

const POLL_MS = REFRESH_INTERVALS['tier-models'] ?? 5 * 60 * 1_000;

// ============================================================================
// TYPES
// ============================================================================

interface EditTarget {
  factor: string;
  tier: string;
  tierLabel: string;
  weight: number;
}

// ============================================================================
// SECTION HEADER
// ============================================================================

function SectionHeader({
  lastRefresh,
  onRefresh,
}: {
  lastRefresh: Date | null;
  onRefresh: () => void;
}) {
  return (
    <div
      className="mb-4 flex items-center justify-between"
      style={{ gap: 'clamp(8px, 1vw, 12px)' }}
    >
      <div>
        <div className="flex items-center" style={{ gap: 'clamp(6px, 0.6vw, 10px)' }}>
          <h2
            className="font-semibold text-white/80"
            style={{ fontSize: 'clamp(14px, 1.4vw, 18px)' }}
          >
            Per-Tier Scoring Models
          </h2>
          <span
            className="rounded-full bg-emerald-500/15 text-emerald-400/80"
            style={{
              fontSize: 'clamp(8px, 0.7vw, 10px)',
              padding: 'clamp(1px, 0.15vw, 2px) clamp(6px, 0.6vw, 8px)',
            }}
          >
            Click to edit
          </span>
        </div>
        <p
          className="text-white/30"
          style={{
            fontSize: 'clamp(10px, 0.85vw, 12px)',
            marginTop: 'clamp(1px, 0.15vw, 2px)',
          }}
        >
          Weight heatmap — click any cell to adjust its weight live
        </p>
      </div>

      <div className="flex items-center" style={{ gap: 'clamp(6px, 0.6vw, 10px)' }}>
        {lastRefresh && (
          <span className="text-white/20" style={{ fontSize: 'clamp(9px, 0.75vw, 11px)' }}>
            {lastRefresh.toLocaleTimeString()}
          </span>
        )}
        <button
          onClick={onRefresh}
          className="rounded-md bg-white/5 text-white/50 transition-colors hover:bg-white/10 hover:text-white/70"
          style={{
            fontSize: 'clamp(10px, 0.9vw, 12px)',
            padding: 'clamp(4px, 0.4vw, 6px) clamp(10px, 1vw, 14px)',
          }}
          title="Refresh tier weights"
        >
          ⟳ Refresh
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// HEATMAP CELL (now clickable)
// ============================================================================

function HeatCell({
  weight,
  maxWeight,
  isHottest,
  isColdest,
  onClick,
}: {
  weight: number;
  maxWeight: number;
  isHottest: boolean;
  isColdest: boolean;
  onClick: () => void;
}) {
  const intensity = maxWeight > 0 ? weight / maxWeight : 0;

  // Emerald spectrum: higher weight → more opaque
  const bgColour =
    weight === 0
      ? 'rgba(255, 255, 255, 0.02)'
      : `rgba(52, 211, 153, ${(intensity * 0.5 + 0.05).toFixed(2)})`;

  // Ring highlight for extremes
  const ringClass = isHottest
    ? 'ring-1 ring-emerald-400/60'
    : isColdest
      ? 'ring-1 ring-sky-400/40'
      : '';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex cursor-pointer items-center justify-center rounded-sm transition-all hover:scale-110 hover:ring-1 hover:ring-white/30 ${ringClass}`}
      style={{
        backgroundColor: bgColour,
        padding: 'clamp(4px, 0.4vw, 8px) clamp(6px, 0.6vw, 10px)',
        minHeight: 'clamp(28px, 3vw, 40px)',
        border: 'none',
      }}
      title={`${weight.toFixed(4)} — click to edit${isHottest ? ' (Hottest)' : ''}${isColdest ? ' (Coldest)' : ''}`}
    >
      {weight === 0 ? (
        <span className="text-white/15" style={{ fontSize: 'clamp(9px, 0.8vw, 11px)' }}>
          ·
        </span>
      ) : (
        <span className="font-mono text-white/80" style={{ fontSize: 'clamp(9px, 0.8vw, 11px)' }}>
          {weight.toFixed(2)}
        </span>
      )}
    </button>
  );
}

// ============================================================================
// CALLOUTS
// ============================================================================

function HeatmapCallouts({
  hottest,
  coldest,
}: {
  hottest: TierWeightsData['hottest'];
  coldest: TierWeightsData['coldest'];
}) {
  if (!hottest && !coldest) return null;

  return (
    <div
      className="flex flex-wrap"
      style={{
        gap: 'clamp(8px, 1vw, 14px)',
        marginTop: 'clamp(10px, 1.2vw, 16px)',
        paddingTop: 'clamp(10px, 1.2vw, 16px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      {hottest && (
        <span className="text-emerald-400/70" style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}>
          🔥 Hottest:{' '}
          <strong className="text-emerald-400">{hottest.factor}</strong> on {hottest.tier} —{' '}
          {hottest.weight.toFixed(2)}
        </span>
      )}
      {coldest && (
        <span className="text-sky-400/70" style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}>
          ❄️ Coldest:{' '}
          <strong className="text-sky-400">{coldest.factor}</strong> on {coldest.tier} —{' '}
          {coldest.weight.toFixed(2)}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function TierModelsHeatmap() {
  const [data, setData] = useState<TierWeightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/scoring-health/tier-weights');
      const json = (await res.json()) as ScoringHealthApiResponse<TierWeightsData>;
      if (!json.ok || !json.data) {
        setError(json.message ?? 'Failed to load tier weights');
        setData(null);
      } else {
        setData(json.data);
        setLastRefresh(new Date());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fetch failed');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
    if (POLL_MS > 0) {
      timerRef.current = setInterval(() => void fetchData(), POLL_MS);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchData]);

  // ── Loading ───────────────────────────────────────────────────────
  if (loading && !data) {
    return (
      <div
        className="rounded-xl bg-white/5 ring-1 ring-white/10"
        style={{ padding: 'clamp(16px, 2vw, 24px)' }}
      >
        <SectionHeader lastRefresh={null} onRefresh={fetchData} />
        <div
          className="flex items-center justify-center"
          style={{ minHeight: 'clamp(120px, 15vw, 200px)' }}
        >
          <span
            className="animate-pulse text-white/30"
            style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}
          >
            Loading tier models…
          </span>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────
  if (error && !data) {
    return (
      <div
        className="rounded-xl bg-red-500/5 ring-1 ring-red-500/20"
        style={{ padding: 'clamp(16px, 2vw, 24px)' }}
      >
        <SectionHeader lastRefresh={lastRefresh} onRefresh={fetchData} />
        <div
          className="flex items-center justify-center"
          style={{ minHeight: 'clamp(80px, 10vw, 120px)' }}
        >
          <span className="text-red-400/70" style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}>
            ❌ {error}
          </span>
        </div>
      </div>
    );
  }

  // ── No data ───────────────────────────────────────────────────────
  if (!data || data.factors.length === 0) {
    return (
      <div
        className="rounded-xl bg-white/5 ring-1 ring-white/10"
        style={{ padding: 'clamp(16px, 2vw, 24px)' }}
      >
        <SectionHeader lastRefresh={lastRefresh} onRefresh={fetchData} />
        <div
          className="flex items-center justify-center"
          style={{ minHeight: 'clamp(80px, 10vw, 120px)' }}
        >
          <span className="text-white/30" style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}>
            ⚪ No tier weights yet — cron has not run.
          </span>
        </div>
      </div>
    );
  }

  // ── Grid columns: factor label + one per tier ─────────────────────
  const tierCount = data.tiers.length;
  const gridCols = `clamp(90px, 10vw, 140px) repeat(${tierCount}, 1fr)`;

  return (
    <>
      <div
        className="rounded-xl bg-white/5 ring-1 ring-white/10"
        style={{ padding: 'clamp(16px, 2vw, 24px)' }}
      >
        <SectionHeader lastRefresh={lastRefresh} onRefresh={fetchData} />

        {/* Heatmap grid */}
        <div className="overflow-x-auto" style={{ marginTop: 'clamp(4px, 0.5vw, 8px)' }}>
          {/* Header row: tier labels */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: gridCols,
              gap: 'clamp(2px, 0.25vw, 4px)',
              marginBottom: 'clamp(2px, 0.25vw, 4px)',
            }}
          >
            {/* Empty corner cell */}
            <span />
            {data.tiers.map((tier) => (
              <div
                key={tier.tier}
                className="text-center text-white/40"
                style={{ fontSize: 'clamp(8px, 0.75vw, 10px)' }}
                title={`${tier.label} — ${tier.eventCount.toLocaleString()} events`}
              >
                <div className="font-semibold">{tier.label}</div>
                <div className="text-white/15" style={{ fontSize: 'clamp(7px, 0.6vw, 9px)' }}>
                  {tier.eventCount.toLocaleString()} events
                </div>
              </div>
            ))}
          </div>

          {/* Data rows: one per factor */}
          {data.factors.map((factor) => (
            <div
              key={factor}
              style={{
                display: 'grid',
                gridTemplateColumns: gridCols,
                gap: 'clamp(2px, 0.25vw, 4px)',
                marginBottom: 'clamp(2px, 0.25vw, 4px)',
              }}
            >
              {/* Factor label */}
              <span
                className="flex items-center truncate font-mono text-white/50"
                style={{ fontSize: 'clamp(9px, 0.85vw, 12px)' }}
                title={factor}
              >
                {factor}
              </span>

              {/* Heat cells per tier — now clickable */}
              {data.tiers.map((tier) => {
                const weight = tier.weights[factor] ?? 0;
                const isHottest =
                  data.hottest?.factor === factor && data.hottest?.tier === tier.label;
                const isColdest =
                  data.coldest?.factor === factor && data.coldest?.tier === tier.label;

                return (
                  <HeatCell
                    key={tier.tier}
                    weight={weight}
                    maxWeight={data.maxWeight}
                    isHottest={isHottest}
                    isColdest={isColdest}
                    onClick={() =>
                      setEditTarget({
                        factor,
                        tier: tier.tier,
                        tierLabel: tier.label,
                        weight,
                      })
                    }
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* Callouts */}
        <HeatmapCallouts hottest={data.hottest} coldest={data.coldest} />
      </div>

      {/* Weight Editor Modal */}
      {editTarget && (
        <WeightEditorModal
          factor={editTarget.factor}
          tier={editTarget.tier}
          tierLabel={editTarget.tierLabel}
          currentWeight={editTarget.weight}
          onSaved={() => void fetchData()}
          onClose={() => setEditTarget(null)}
        />
      )}
    </>
  );
}
