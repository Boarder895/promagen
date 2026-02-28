'use client';

/**
 * ABTestDashboard — Admin dashboard widget for the A/B testing pipeline.
 *
 * Fetches data from GET /api/learning/ab-tests and renders:
 * 1. Current test status badge (running / promoted / rolled_back)
 * 2. Variant copy rates as side-by-side bars
 * 3. O'Brien-Fleming boundary visualization (p-value vs adjusted alpha per peek)
 * 4. Estimated days remaining countdown
 * 5. Bayesian probability overlay ("X% chance variant outperforms")
 * 6. Historical test results table
 *
 * Self-contained — fetches its own data, no props required.
 * Polls every 60 seconds when a test is running.
 *
 * @see docs/authority/phase-7_6-ab-testing-pipeline-buildplan.md
 *
 * Version: 1.2.0 — LiftDistribution sparkline (Improvement 1) + adaptive nextPeekAt (Improvement 2)
 * Existing features preserved: Yes (new component, no existing code modified).
 */

import * as React from 'react';
import { computeLiftDistribution } from '@/lib/learning/ab-testing';

// =============================================================================
// TYPES (mirrors API response shape)
// =============================================================================

interface ABTestResult {
  controlEvents: number;
  variantEvents: number;
  controlCopyRate: number;
  variantCopyRate: number;
  controlSaveRate: number;
  variantSaveRate: number;
  zScore: number;
  pValue: number;
  adjustedAlpha: number;
  peekNumber: number;
  decision: 'promote' | 'rollback' | 'extend';
  reason: string;
  bayesianProbVariantWins: number | null;
  controlCredibleInterval: [number, number] | null;
  variantCredibleInterval: [number, number] | null;
  nextPeekAt: string | null;
}

interface ABTestSummary {
  id: string;
  name: string;
  status: 'running' | 'promoted' | 'rolled_back';
  controlWeights: Record<string, number>;
  variantWeights: Record<string, number>;
  splitPct: number;
  minEvents: number;
  maxDurationDays: number;
  startedAt: string;
  endedAt: string | null;
  peekCount: number;
  resultSummary: ABTestResult | null;
  liveCounts?: {
    controlEvents: number;
    variantEvents: number;
    controlCopies: number;
    variantCopies: number;
  };
  liveEvaluation?: ABTestResult;
  estimatedDaysRemaining?: number | null;
  requiredSampleSize?: number | null;
}

interface ABTestsResponse {
  tests: ABTestSummary[];
  runningTestId: string | null;
  totalCount: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const POLL_INTERVAL_MS = 60_000; // 60s when a test is running

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function StatusBadge({ status }: { status: ABTestSummary['status'] }) {
  const config = {
    running: { label: 'Running', bg: 'bg-blue-500/20', text: 'text-blue-300', ring: 'ring-blue-500/40' },
    promoted: { label: 'Promoted', bg: 'bg-green-500/20', text: 'text-green-300', ring: 'ring-green-500/40' },
    rolled_back: { label: 'Rolled Back', bg: 'bg-red-500/20', text: 'text-red-300', ring: 'ring-red-500/40' },
  }[status];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 ring-1 ${config.bg} ${config.text} ${config.ring}`}
      style={{ fontSize: 'clamp(0.65rem, 0.8vw, 0.75rem)' }}
    >
      {status === 'running' && (
        <span className="mr-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
      )}
      {config.label}
    </span>
  );
}

function RateBar({
  label,
  rate,
  credibleInterval,
  color,
}: {
  label: string;
  rate: number;
  credibleInterval: [number, number] | null;
  color: 'blue' | 'emerald';
}) {
  const pct = (rate * 100).toFixed(1);
  const barColor = color === 'blue' ? 'bg-blue-500' : 'bg-emerald-500';
  const ciColor = color === 'blue' ? 'bg-blue-300/30' : 'bg-emerald-300/30';

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <span className="text-white/60" style={{ fontSize: 'clamp(0.65rem, 0.75vw, 0.7rem)' }}>
          {label}
        </span>
        <span className="font-mono font-medium text-white" style={{ fontSize: 'clamp(0.7rem, 0.85vw, 0.8rem)' }}>
          {pct}%
        </span>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-white/5">
        {/* Credible interval background */}
        {credibleInterval && (
          <div
            className={`absolute inset-y-0 rounded-full ${ciColor}`}
            style={{
              left: `${credibleInterval[0] * 100}%`,
              width: `${(credibleInterval[1] - credibleInterval[0]) * 100}%`,
            }}
          />
        )}
        {/* Actual rate bar */}
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${barColor} transition-all duration-500`}
          style={{ width: `${Math.min(rate * 100, 100)}%` }}
        />
      </div>
      {credibleInterval && (
        <div className="text-white/40" style={{ fontSize: 'clamp(0.55rem, 0.65vw, 0.6rem)' }}>
          95% CI: [{(credibleInterval[0] * 100).toFixed(1)}%, {(credibleInterval[1] * 100).toFixed(1)}%]
        </div>
      )}
    </div>
  );
}

function BayesianProbability({ prob }: { prob: number | null }) {
  if (prob === null) return null;

  const pct = (prob * 100).toFixed(0);
  const isHighConfidence = prob > 0.95 || prob < 0.05;
  const variantWinning = prob > 0.5;

  return (
    <div
      className={`rounded-xl p-3 ${isHighConfidence ? (variantWinning ? 'bg-emerald-500/10 ring-1 ring-emerald-500/30' : 'bg-red-500/10 ring-1 ring-red-500/30') : 'bg-white/5'}`}
    >
      <div className="text-white/50" style={{ fontSize: 'clamp(0.6rem, 0.7vw, 0.65rem)' }}>
        Bayesian Probability
      </div>
      <div
        className={`font-mono font-bold ${variantWinning ? 'text-emerald-300' : 'text-red-300'}`}
        style={{ fontSize: 'clamp(1.2rem, 1.8vw, 1.6rem)' }}
      >
        {pct}%
      </div>
      <div className="text-white/40" style={{ fontSize: 'clamp(0.55rem, 0.65vw, 0.6rem)' }}>
        chance variant outperforms
      </div>
    </div>
  );
}

function OBFBoundaryChart({
  peekNumber,
  maxPeeks,
  pValue,
  adjustedAlpha,
}: {
  peekNumber: number;
  maxPeeks: number;
  pValue: number;
  adjustedAlpha: number;
}) {
  // Show a simple visual: the p-value vs the O'Brien-Fleming boundary
  const pValueLog = pValue > 0 ? -Math.log10(pValue) : 10;
  const alphaLog = adjustedAlpha > 0 ? -Math.log10(adjustedAlpha) : 10;
  const maxLog = Math.max(pValueLog, alphaLog, 2); // at least show up to 0.01

  const pBarPct = Math.min((pValueLog / maxLog) * 100, 100);
  const alphaBarPct = Math.min((alphaLog / maxLog) * 100, 100);
  const isBelowThreshold = pValue < adjustedAlpha;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-white/50" style={{ fontSize: 'clamp(0.6rem, 0.7vw, 0.65rem)' }}>
          O&apos;Brien-Fleming Boundary — Peek {peekNumber}/{maxPeeks}
        </span>
        {isBelowThreshold && (
          <span className="text-emerald-400" style={{ fontSize: 'clamp(0.55rem, 0.65vw, 0.6rem)' }}>
            Below threshold
          </span>
        )}
      </div>

      {/* p-value bar */}
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="w-16 text-right text-white/40" style={{ fontSize: 'clamp(0.55rem, 0.65vw, 0.6rem)' }}>
            p-value
          </span>
          <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-white/5">
            <div
              className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${isBelowThreshold ? 'bg-emerald-500' : 'bg-amber-500'}`}
              style={{ width: `${pBarPct}%` }}
            />
          </div>
          <span className="w-20 font-mono text-white/60" style={{ fontSize: 'clamp(0.55rem, 0.65vw, 0.6rem)' }}>
            {pValue < 0.0001 ? pValue.toExponential(1) : pValue.toFixed(4)}
          </span>
        </div>

        {/* Alpha threshold bar */}
        <div className="flex items-center gap-2">
          <span className="w-16 text-right text-white/40" style={{ fontSize: 'clamp(0.55rem, 0.65vw, 0.6rem)' }}>
            α threshold
          </span>
          <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-white/5">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-white/20 transition-all duration-500"
              style={{ width: `${alphaBarPct}%` }}
            />
          </div>
          <span className="w-20 font-mono text-white/60" style={{ fontSize: 'clamp(0.55rem, 0.65vw, 0.6rem)' }}>
            {adjustedAlpha < 0.0001 ? adjustedAlpha.toExponential(1) : adjustedAlpha.toFixed(4)}
          </span>
        </div>
      </div>

      <div className="text-white/30" style={{ fontSize: 'clamp(0.5rem, 0.6vw, 0.55rem)' }}>
        -log₁₀ scale — longer bar = more significant. p must exceed α threshold to declare a winner.
      </div>
    </div>
  );
}

// ── Lift Distribution Sparkline (Improvement 1) ────────────────────────────
// Mini SVG histogram of posterior (variant_rate − control_rate) with a
// vertical red line at the 1% early-stop threshold. Gives admins instant
// visual intuition for how close the test is to Bayesian early-stop.
function LiftDistribution({
  bins,
  thresholdLine,
}: {
  bins: { center: number; density: number }[];
  thresholdLine?: number;
}) {
  if (bins.length === 0) return null;

  const W = 240;
  const H = 48;
  const maxDensity = Math.max(...bins.map((b) => b.density));
  const barW = W / bins.length;

  // Map data range to SVG x-space
  const firstBin = bins[0]!;
  const lastBin = bins[bins.length - 1]!;
  const halfBin = bins.length > 1 ? (bins[1]!.center - firstBin.center) / 2 : 0.01;
  const lo = firstBin.center - halfBin;
  const hi = lastBin.center + halfBin;
  const range = hi - lo || 1;
  const toX = (v: number) => ((v - lo) / range) * W;

  const threshX = thresholdLine != null ? toX(thresholdLine) : null;
  const zeroX = toX(0);

  return (
    <div className="rounded-xl bg-white/5 p-2.5">
      <div className="mb-1 text-white/50" style={{ fontSize: 'clamp(0.5rem, 0.6vw, 0.55rem)' }}>
        Posterior Lift Distribution (Variant − Control)
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="overflow-visible">
        {/* Histogram bars — green for positive lift, red for negative */}
        {bins.map((bin, i) => {
          const barH = maxDensity > 0 ? (bin.density / maxDensity) * H : 0;
          return (
            <rect
              key={i}
              x={i * barW}
              y={H - barH}
              width={Math.max(barW - 0.5, 0.5)}
              height={barH}
              fill={bin.center > 0 ? 'rgba(52, 211, 153, 0.5)' : 'rgba(248, 113, 113, 0.3)'}
            />
          );
        })}
        {/* Zero line (dashed white) */}
        {zeroX >= 0 && zeroX <= W && (
          <line x1={zeroX} y1={0} x2={zeroX} y2={H} stroke="rgba(255,255,255,0.2)" strokeWidth={0.5} strokeDasharray="2,2" />
        )}
        {/* 1% threshold line (solid red) */}
        {threshX != null && threshX >= 0 && threshX <= W && (
          <line x1={threshX} y1={0} x2={threshX} y2={H} stroke="#ef4444" strokeWidth={1} />
        )}
      </svg>
      <div className="mt-0.5 flex justify-between text-white/30" style={{ fontSize: 'clamp(0.45rem, 0.55vw, 0.5rem)' }}>
        <span>{(firstBin.center * 100).toFixed(1)}%</span>
        <span className="text-red-400/60">1% threshold</span>
        <span>{(lastBin.center * 100).toFixed(1)}%</span>
      </div>
    </div>
  );
}

// ── Weight Diff Table (Phase 7.6f, Improvement 2) ──────────────────────────
function WeightDiffTable({
  controlWeights,
  variantWeights,
}: {
  controlWeights: Record<string, number>;
  variantWeights: Record<string, number>;
}) {
  const allKeys = Array.from(
    new Set([...Object.keys(controlWeights), ...Object.keys(variantWeights)]),
  ).sort();

  const diffRows = allKeys
    .map((key) => {
      const ctrl = controlWeights[key] ?? 0;
      const vari = variantWeights[key] ?? 0;
      const delta = vari - ctrl;
      return { key, ctrl, vari, delta };
    })
    .filter((r) => r.delta !== 0);

  if (diffRows.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl bg-white/5">
      <div className="px-3 pt-2.5 pb-1">
        <span className="text-white/50" style={{ fontSize: 'clamp(0.6rem, 0.7vw, 0.65rem)' }}>
          Weight Changes (Control → Variant)
        </span>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/10">
            {['Weight', 'Control (A)', 'Variant (B)', 'Δ'].map((h) => (
              <th
                key={h}
                className="px-3 pb-1.5 text-left font-normal text-white/40"
                style={{ fontSize: 'clamp(0.5rem, 0.6vw, 0.55rem)' }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {diffRows.map(({ key, ctrl, vari, delta }) => {
            const isPositive = delta > 0;
            const deltaColor = isPositive ? 'text-emerald-400' : 'text-red-400';
            const sign = isPositive ? '+' : '';

            return (
              <tr key={key} className="border-b border-white/5 last:border-0">
                <td
                  className="px-3 py-1 text-white/60"
                  style={{ fontSize: 'clamp(0.55rem, 0.65vw, 0.6rem)' }}
                >
                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}
                </td>
                <td
                  className="px-3 py-1 font-mono text-white/50"
                  style={{ fontSize: 'clamp(0.55rem, 0.65vw, 0.6rem)' }}
                >
                  {ctrl}
                </td>
                <td
                  className="px-3 py-1 font-mono text-white/70"
                  style={{ fontSize: 'clamp(0.55rem, 0.65vw, 0.6rem)' }}
                >
                  {vari}
                </td>
                <td
                  className={`px-3 py-1 font-mono font-medium ${deltaColor}`}
                  style={{ fontSize: 'clamp(0.55rem, 0.65vw, 0.6rem)' }}
                >
                  {sign}{delta}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RunningTestCard({ test }: { test: ABTestSummary }) {
  const eval_ = test.liveEvaluation;
  const counts = test.liveCounts;
  if (!eval_ || !counts) return null;

  const ageDays = Math.floor(
    (Date.now() - new Date(test.startedAt).getTime()) / (1000 * 60 * 60 * 24),
  );

  return (
    <div className="space-y-4 rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-white" style={{ fontSize: 'clamp(0.8rem, 1vw, 0.95rem)' }}>
              {test.name.replace(/_/g, ' ')}
            </h3>
            <StatusBadge status={test.status} />
          </div>
          <div className="mt-0.5 text-white/40" style={{ fontSize: 'clamp(0.55rem, 0.65vw, 0.6rem)' }}>
            {test.id} — Day {ageDays}/{test.maxDurationDays}
          </div>
        </div>

        {/* Days remaining */}
        {test.estimatedDaysRemaining != null && (
          <div className="text-right">
            <div className="font-mono font-bold text-amber-300" style={{ fontSize: 'clamp(1rem, 1.5vw, 1.3rem)' }}>
              {test.estimatedDaysRemaining}d
            </div>
            <div className="text-white/40" style={{ fontSize: 'clamp(0.5rem, 0.6vw, 0.55rem)' }}>
              est. remaining
            </div>
          </div>
        )}
      </div>

      {/* Event counts */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white/5 p-2.5">
          <div className="text-white/50" style={{ fontSize: 'clamp(0.55rem, 0.65vw, 0.6rem)' }}>Control (A)</div>
          <div className="font-mono text-white" style={{ fontSize: 'clamp(0.8rem, 1vw, 0.95rem)' }}>
            {counts.controlEvents.toLocaleString()} events
          </div>
          <div className="text-white/40" style={{ fontSize: 'clamp(0.5rem, 0.6vw, 0.55rem)' }}>
            {counts.controlCopies} copies
          </div>
        </div>
        <div className="rounded-xl bg-white/5 p-2.5">
          <div className="text-white/50" style={{ fontSize: 'clamp(0.55rem, 0.65vw, 0.6rem)' }}>Variant (B)</div>
          <div className="font-mono text-white" style={{ fontSize: 'clamp(0.8rem, 1vw, 0.95rem)' }}>
            {counts.variantEvents.toLocaleString()} events
          </div>
          <div className="text-white/40" style={{ fontSize: 'clamp(0.5rem, 0.6vw, 0.55rem)' }}>
            {counts.variantCopies} copies
          </div>
        </div>
      </div>

      {/* Weight diff table (Phase 7.6f, Improvement 2) */}
      <WeightDiffTable
        controlWeights={test.controlWeights}
        variantWeights={test.variantWeights}
      />

      {/* Copy rate bars with credible intervals */}
      <div className="space-y-3">
        <RateBar
          label="Control Copy Rate"
          rate={eval_.controlCopyRate}
          credibleInterval={eval_.controlCredibleInterval}
          color="blue"
        />
        <RateBar
          label="Variant Copy Rate"
          rate={eval_.variantCopyRate}
          credibleInterval={eval_.variantCredibleInterval}
          color="emerald"
        />
      </div>

      {/* Bayesian probability */}
      <BayesianProbability prob={eval_.bayesianProbVariantWins} />

      {/* Lift distribution sparkline (Improvement 1) */}
      {counts.controlEvents >= 20 && counts.variantEvents >= 20 && (
        <LiftDistribution
          bins={computeLiftDistribution(
            counts.controlCopies, counts.controlEvents,
            counts.variantCopies, counts.variantEvents,
          )}
          thresholdLine={0.01}
        />
      )}

      {/* O'Brien-Fleming boundary */}
      <OBFBoundaryChart
        peekNumber={eval_.peekNumber}
        maxPeeks={test.maxDurationDays}
        pValue={eval_.pValue}
        adjustedAlpha={eval_.adjustedAlpha}
      />

      {/* Sample size info */}
      {test.requiredSampleSize && (
        <div className="text-white/30" style={{ fontSize: 'clamp(0.5rem, 0.6vw, 0.55rem)' }}>
          Required sample size: {test.requiredSampleSize.toLocaleString()} per group (80% power, 5% lift)
          — {Math.min(counts.controlEvents, counts.variantEvents).toLocaleString()}/{test.requiredSampleSize.toLocaleString()} collected
        </div>
      )}

      {/* Decision reason */}
      <div className="rounded-xl bg-white/5 p-2.5">
        <div className="text-white/40" style={{ fontSize: 'clamp(0.55rem, 0.65vw, 0.6rem)' }}>
          Current Decision: <span className="font-medium text-white">{eval_.decision}</span>
        </div>
        <div className="mt-0.5 text-white/30" style={{ fontSize: 'clamp(0.5rem, 0.6vw, 0.55rem)' }}>
          {eval_.reason}
        </div>
        {/* Adaptive peek scheduling (Improvement 2) */}
        {eval_.nextPeekAt && (
          <div className="mt-1 text-amber-300/60" style={{ fontSize: 'clamp(0.5rem, 0.6vw, 0.55rem)' }}>
            Next evaluation: {new Date(eval_.nextPeekAt).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryRow({ test }: { test: ABTestSummary }) {
  const result = test.resultSummary;
  const startDate = new Date(test.startedAt).toLocaleDateString();
  const endDate = test.endedAt ? new Date(test.endedAt).toLocaleDateString() : '—';

  return (
    <tr className="border-b border-white/5">
      <td className="py-2 pr-3" style={{ fontSize: 'clamp(0.55rem, 0.65vw, 0.6rem)' }}>
        {test.name.replace(/_/g, ' ')}
      </td>
      <td className="py-2 pr-3">
        <StatusBadge status={test.status} />
      </td>
      <td className="py-2 pr-3 font-mono text-white/60" style={{ fontSize: 'clamp(0.55rem, 0.65vw, 0.6rem)' }}>
        {startDate} → {endDate}
      </td>
      <td className="py-2 pr-3 font-mono text-white/60" style={{ fontSize: 'clamp(0.55rem, 0.65vw, 0.6rem)' }}>
        {result ? `${(result.controlCopyRate * 100).toFixed(1)}%` : '—'}
      </td>
      <td className="py-2 pr-3 font-mono text-white/60" style={{ fontSize: 'clamp(0.55rem, 0.65vw, 0.6rem)' }}>
        {result ? `${(result.variantCopyRate * 100).toFixed(1)}%` : '—'}
      </td>
      <td className="py-2 pr-3 font-mono text-white/60" style={{ fontSize: 'clamp(0.55rem, 0.65vw, 0.6rem)' }}>
        {result ? result.pValue.toFixed(4) : '—'}
      </td>
      <td className="py-2 font-mono text-white/60" style={{ fontSize: 'clamp(0.55rem, 0.65vw, 0.6rem)' }}>
        {result?.bayesianProbVariantWins != null
          ? `${(result.bayesianProbVariantWins * 100).toFixed(0)}%`
          : '—'}
      </td>
    </tr>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function ABTestDashboard() {
  const [data, setData] = React.useState<ABTestsResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    try {
      const res = await fetch('/api/learning/ab-tests');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: ABTestsResponse = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + polling when a test is running
  React.useEffect(() => {
    fetchData();

    const interval = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="animate-pulse rounded-2xl bg-white/[0.03] p-6 ring-1 ring-white/10">
        <div className="h-4 w-48 rounded bg-white/10" />
        <div className="mt-4 h-32 rounded-xl bg-white/5" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-red-500/10 p-4 ring-1 ring-red-500/30">
        <div className="text-red-300" style={{ fontSize: 'clamp(0.7rem, 0.85vw, 0.8rem)' }}>
          A/B Testing Dashboard Error: {error}
        </div>
      </div>
    );
  }

  if (!data || data.tests.length === 0) {
    return (
      <div className="rounded-2xl bg-white/[0.03] p-6 ring-1 ring-white/10">
        <h2 className="font-medium text-white" style={{ fontSize: 'clamp(0.85rem, 1.1vw, 1rem)' }}>
          A/B Testing Pipeline
        </h2>
        <p className="mt-2 text-white/40" style={{ fontSize: 'clamp(0.65rem, 0.75vw, 0.7rem)' }}>
          No A/B tests have been created yet. Enable{' '}
          <code className="rounded bg-white/10 px-1 py-0.5">PHASE_7_AB_TESTING_ENABLED=true</code>{' '}
          to start testing scoring weight changes.
        </p>
      </div>
    );
  }

  const runningTest = data.tests.find((t) => t.id === data.runningTestId);
  const historyTests = data.tests.filter((t) => t.status !== 'running');

  // Stats summary
  const promotedCount = data.tests.filter((t) => t.status === 'promoted').length;
  const rolledBackCount = data.tests.filter((t) => t.status === 'rolled_back').length;

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-white" style={{ fontSize: 'clamp(0.85rem, 1.1vw, 1rem)' }}>
          A/B Testing Pipeline
        </h2>
        <div className="flex items-center gap-3 text-white/40" style={{ fontSize: 'clamp(0.55rem, 0.65vw, 0.6rem)' }}>
          <span>{data.totalCount} tests</span>
          <span className="text-emerald-400">{promotedCount} promoted</span>
          <span className="text-red-400">{rolledBackCount} rolled back</span>
        </div>
      </div>

      {/* Running test card */}
      {runningTest ? (
        <RunningTestCard test={runningTest} />
      ) : (
        <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
          <div className="text-white/40" style={{ fontSize: 'clamp(0.65rem, 0.75vw, 0.7rem)' }}>
            No test currently running. The nightly cron will create one when weight changes exceed
            the threshold.
          </div>
        </div>
      )}

      {/* History table */}
      {historyTests.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-white/[0.03] ring-1 ring-white/10">
          <div className="p-3">
            <h3 className="text-white/60" style={{ fontSize: 'clamp(0.7rem, 0.85vw, 0.8rem)' }}>
              Test History
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  {['Test', 'Result', 'Period', 'Control', 'Variant', 'p-value', 'P(B wins)'].map((h) => (
                    <th
                      key={h}
                      className="pb-2 pl-3 text-left font-normal text-white/40 first:pl-4"
                      style={{ fontSize: 'clamp(0.55rem, 0.65vw, 0.6rem)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historyTests.map((t) => (
                  <HistoryRow key={t.id} test={t} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
