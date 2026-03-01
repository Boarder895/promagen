'use client';

// src/components/admin/scoring-health/weight-drift-chart.tsx
// ============================================================================
// SECTION 2 — WEIGHT DRIFT VISUALISATION
// ============================================================================
//
// Shows how each scoring factor's weight has evolved from the uniform
// baseline (1/N) to its current learned value. Each factor is a row with:
//   - Factor name
//   - Start weight → End weight
//   - Animated CSS bar (width = current / max)
//   - Percentage change badge (emerald = grew, amber = shrunk)
//   - Mini sparkline overlay (weight-drift trajectory)
//
// Bottom callout: Biggest mover + Biggest decline
//
// Data: GET /api/admin/scoring-health/weight-history
// Refresh: On-demand (manual button)
//
// Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md § 5
//
// Version: 2.0.0 — Added Weight Tuning Sandbox integration (7.11h)
// Created: 2026-03-01
//
// Existing features preserved: Yes (new component).
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { WeightTuningSandbox } from '@/components/admin/scoring-health/weight-tuning-sandbox';
import { CssSparkline } from '@/components/admin/scoring-health/css-sparkline';
import type {
  ScoringHealthApiResponse,
  WeightDriftData,
  FactorDrift,
} from '@/lib/admin/scoring-health-types';

// ============================================================================
// SECTION HEADER
// ============================================================================

function SectionHeader({
  lastRefresh,
  onRefresh,
  onOpenSandbox,
}: {
  lastRefresh: Date | null;
  onRefresh: () => void;
  onOpenSandbox: () => void;
}) {
  return (
    <div
      className="mb-4 flex items-center justify-between"
      style={{ gap: 'clamp(8px, 1vw, 12px)' }}
    >
      <div>
        <h2
          className="font-semibold text-white/80"
          style={{ fontSize: 'clamp(14px, 1.4vw, 18px)' }}
        >
          Weight Drift
        </h2>
        <p
          className="text-white/30"
          style={{
            fontSize: 'clamp(10px, 0.85vw, 12px)',
            marginTop: 'clamp(1px, 0.15vw, 2px)',
          }}
        >
          Learned vs baseline — how each scoring factor has evolved
        </p>
      </div>

      <div className="flex items-center" style={{ gap: 'clamp(6px, 0.6vw, 10px)' }}>
        {lastRefresh && (
          <span className="text-white/20" style={{ fontSize: 'clamp(9px, 0.75vw, 11px)' }}>
            {lastRefresh.toLocaleTimeString()}
          </span>
        )}
        <button
          onClick={onOpenSandbox}
          className="rounded-md bg-violet-600/20 text-violet-400/80 transition-colors hover:bg-violet-600/30 hover:text-violet-300"
          style={{
            fontSize: 'clamp(10px, 0.9vw, 12px)',
            padding: 'clamp(4px, 0.4vw, 6px) clamp(10px, 1vw, 14px)',
          }}
          title="Open Weight Tuning Sandbox"
        >
          🧪 Sandbox
        </button>
        <button
          onClick={onRefresh}
          className="rounded-md bg-white/5 text-white/50 transition-colors hover:bg-white/10 hover:text-white/70"
          style={{
            fontSize: 'clamp(10px, 0.9vw, 12px)',
            padding: 'clamp(4px, 0.4vw, 6px) clamp(10px, 1vw, 14px)',
          }}
          title="Refresh weight drift data"
        >
          ⟳ Refresh
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// FACTOR ROW — One row per scoring factor
// ============================================================================

function FactorRow({ drift, maxWeight }: { drift: FactorDrift; maxWeight: number }) {
  const barPercent = maxWeight > 0 ? (drift.endWeight / maxWeight) * 100 : 0;

  // Colour: up = emerald, down = amber, flat = white/dim
  const barColour =
    drift.direction === 'up'
      ? 'rgba(52, 211, 153, 0.6)'
      : drift.direction === 'down'
        ? 'rgba(251, 191, 36, 0.6)'
        : 'rgba(255, 255, 255, 0.3)';

  const badgeColour =
    drift.direction === 'up'
      ? 'text-emerald-400'
      : drift.direction === 'down'
        ? 'text-amber-400'
        : 'text-white/40';

  const changeText = isFinite(drift.changePercent)
    ? `${drift.changePercent > 0 ? '+' : ''}${drift.changePercent.toFixed(0)}%`
    : '∞';

  return (
    <div
      className="group"
      style={{
        display: 'grid',
        gridTemplateColumns:
          'clamp(90px, 10vw, 140px) clamp(40px, 4vw, 60px) 1fr clamp(40px, 4vw, 60px) clamp(50px, 5vw, 70px)',
        alignItems: 'center',
        gap: 'clamp(6px, 0.6vw, 10px)',
        padding: 'clamp(6px, 0.6vw, 10px) 0',
        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
      }}
    >
      {/* Factor name */}
      <span
        className="truncate font-mono text-white/60"
        style={{ fontSize: 'clamp(10px, 0.9vw, 13px)' }}
        title={drift.factor}
      >
        {drift.factor}
      </span>

      {/* Start weight */}
      <span
        className="text-right font-mono text-white/25"
        style={{ fontSize: 'clamp(9px, 0.8vw, 11px)' }}
      >
        {drift.startWeight.toFixed(2)}
      </span>

      {/* Animated bar */}
      <div
        className="relative overflow-hidden rounded-sm"
        style={{
          height: 'clamp(14px, 1.5vw, 20px)',
          backgroundColor: 'rgba(255, 255, 255, 0.04)',
        }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-sm transition-all duration-700 ease-out"
          style={{
            width: `${Math.max(barPercent, 2)}%`,
            backgroundColor: barColour,
          }}
        />
        {/* Mini sparkline overlay (visible on hover) */}
        {drift.sparkline.length > 2 && (
          <div className="absolute inset-0 opacity-30 transition-opacity group-hover:opacity-60">
            <CssSparkline
              points={drift.sparkline}
              height="100%"
              width="100%"
              colour="rgba(255, 255, 255, 0.1)"
              lineColour="rgba(255, 255, 255, 0.4)"
              label={`${drift.factor} trajectory`}
            />
          </div>
        )}
      </div>

      {/* End weight */}
      <span
        className="font-mono text-white/70"
        style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}
      >
        {drift.endWeight.toFixed(2)}
      </span>

      {/* Change badge */}
      <span
        className={`text-right font-mono font-semibold ${badgeColour}`}
        style={{ fontSize: 'clamp(9px, 0.85vw, 11px)' }}
      >
        {changeText}
      </span>
    </div>
  );
}

// ============================================================================
// CALLOUT ROW — Biggest mover / biggest decline
// ============================================================================

function Callouts({
  biggestMover,
  biggestDecline,
}: {
  biggestMover: WeightDriftData['biggestMover'];
  biggestDecline: WeightDriftData['biggestDecline'];
}) {
  if (!biggestMover && !biggestDecline) return null;

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
      {biggestMover && isFinite(biggestMover.changePercent) && (
        <span className="text-emerald-400/70" style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}>
          ⚡ Biggest mover:{' '}
          <strong className="text-emerald-400">{biggestMover.factor}</strong> (+
          {biggestMover.changePercent.toFixed(0)}%)
        </span>
      )}
      {biggestDecline && isFinite(biggestDecline.changePercent) && (
        <span className="text-amber-400/70" style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}>
          📉 Biggest decline:{' '}
          <strong className="text-amber-400">{biggestDecline.factor}</strong> (
          {biggestDecline.changePercent.toFixed(0)}%)
        </span>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function WeightDriftChart() {
  const [data, setData] = useState<WeightDriftData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [sandboxOpen, setSandboxOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/scoring-health/weight-history');
      const json = (await res.json()) as ScoringHealthApiResponse<WeightDriftData>;
      if (!json.ok || !json.data) {
        setError(json.message ?? 'Failed to load weight drift data');
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
  }, [fetchData]);

  // ── Loading ───────────────────────────────────────────────────────
  if (loading && !data) {
    return (
      <div
        className="rounded-xl bg-white/5 ring-1 ring-white/10"
        style={{ padding: 'clamp(16px, 2vw, 24px)' }}
      >
        <SectionHeader lastRefresh={null} onRefresh={fetchData} onOpenSandbox={() => setSandboxOpen(true)} />
        <div
          className="flex items-center justify-center"
          style={{ minHeight: 'clamp(120px, 15vw, 200px)' }}
        >
          <span
            className="animate-pulse text-white/30"
            style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}
          >
            Loading weight drift data…
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
        <SectionHeader lastRefresh={lastRefresh} onRefresh={fetchData} onOpenSandbox={() => setSandboxOpen(true)} />
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

  // ── No data (cold start) ──────────────────────────────────────────
  if (!data || data.factors.length === 0) {
    return (
      <div
        className="rounded-xl bg-white/5 ring-1 ring-white/10"
        style={{ padding: 'clamp(16px, 2vw, 24px)' }}
      >
        <SectionHeader lastRefresh={lastRefresh} onRefresh={fetchData} onOpenSandbox={() => setSandboxOpen(true)} />
        <div
          className="flex items-center justify-center"
          style={{ minHeight: 'clamp(80px, 10vw, 120px)' }}
        >
          <span className="text-white/30" style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}>
            ⚪ No scoring weights yet — cron has not run.
          </span>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────
  const maxWeight = Math.max(...data.factors.map((f) => f.endWeight), 0.01);

  return (
    <div
      className="rounded-xl bg-white/5 ring-1 ring-white/10"
      style={{ padding: 'clamp(16px, 2vw, 24px)' }}
    >
      <SectionHeader lastRefresh={lastRefresh} onRefresh={fetchData} onOpenSandbox={() => setSandboxOpen(true)} />

      {/* Overall drift badge */}
      <div className="mb-3 flex items-center" style={{ gap: 'clamp(6px, 0.6vw, 10px)' }}>
        <span className="text-white/30" style={{ fontSize: 'clamp(9px, 0.8vw, 11px)' }}>
          Overall drift:
        </span>
        <span
          className={`font-mono font-semibold ${
            data.overallDrift > 0.5
              ? 'text-red-400'
              : data.overallDrift > 0.2
                ? 'text-amber-400'
                : 'text-emerald-400'
          }`}
          style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}
        >
          {data.overallDrift.toFixed(3)}
        </span>
        <span className="text-white/15" style={{ fontSize: 'clamp(8px, 0.7vw, 10px)' }}>
          (0 = stable, 1 = overhaul)
        </span>
        {data.snapshotCount > 0 && (
          <span className="text-white/15" style={{ fontSize: 'clamp(8px, 0.7vw, 10px)' }}>
            · {data.snapshotCount} snapshots
          </span>
        )}
      </div>

      {/* Column headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'clamp(90px, 10vw, 140px) clamp(40px, 4vw, 60px) 1fr clamp(40px, 4vw, 60px) clamp(50px, 5vw, 70px)',
          gap: 'clamp(6px, 0.6vw, 10px)',
          padding: 'clamp(4px, 0.4vw, 6px) 0',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <span className="text-white/20" style={{ fontSize: 'clamp(8px, 0.7vw, 10px)' }}>
          Factor
        </span>
        <span
          className="text-right text-white/20"
          style={{ fontSize: 'clamp(8px, 0.7vw, 10px)' }}
        >
          Base
        </span>
        <span className="text-white/20" style={{ fontSize: 'clamp(8px, 0.7vw, 10px)' }}>
          Weight
        </span>
        <span className="text-white/20" style={{ fontSize: 'clamp(8px, 0.7vw, 10px)' }}>
          Current
        </span>
        <span
          className="text-right text-white/20"
          style={{ fontSize: 'clamp(8px, 0.7vw, 10px)' }}
        >
          Δ%
        </span>
      </div>

      {/* Factor rows */}
      {data.factors.map((drift) => (
        <FactorRow key={drift.factor} drift={drift} maxWeight={maxWeight} />
      ))}

      {/* Callouts */}
      <Callouts biggestMover={data.biggestMover} biggestDecline={data.biggestDecline} />

      {/* Weight Tuning Sandbox modal */}
      <WeightTuningSandbox
        isOpen={sandboxOpen}
        onClose={() => setSandboxOpen(false)}
      />
    </div>
  );
}
