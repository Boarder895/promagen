'use client';

// src/components/admin/scoring-health/code-evolution-radar.tsx
// ============================================================================
// CODE EVOLUTION RADAR — Dashboard Section 12
// ============================================================================
//
// The crown jewel.  Every other section answers "is the data healthy?"
// This one answers "is the CODE still appropriate for the data?"
//
// Layout:
//   ┌ Header — overall confidence badge + summary stats
//   ├ Confidence Thermometers — per-file bars with decay breakdown + review btn
//   ├ Active Findings — detector cards + predictions + proposals + act btn
//   ├ Drift Predictions — time-to-stale forecasts
//   ├ Assumption Registry — pass/fail matrix
//   └ Evolution History — timeline of actions + confidence deltas
//
// Data: GET  /api/admin/scoring-health/code-radar
//       POST /api/admin/scoring-health/code-radar  (act/review/dismiss)
//
// Version: 2.0.0 — Git-Aware Confidence + Act-on-Proposal workflow
// Created: 2026-03-01
//
// Existing features preserved: Yes (additive only).
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import type {
  RadarReport,
  FileConfidence,
  DetectorResult,
  Assumption,
  DriftPrediction,
  EvolutionProposal,
  EvolutionHistoryEntry,
  EvolutionActionRequest,
} from '@/lib/admin/code-evolution-radar';
import { useDrillThrough } from '@/lib/admin/drill-through-context';

// ============================================================================
// HELPERS
// ============================================================================

function confColour(c: number): string {
  if (c >= 90) return 'text-emerald-400';
  if (c >= 70) return 'text-amber-400';
  return 'text-red-400';
}

function confBg(c: number): string {
  if (c >= 90) return 'bg-emerald-500';
  if (c >= 70) return 'bg-amber-500';
  return 'bg-red-500';
}

function sevIcon(s: string): string {
  if (s === 'critical') return '🔴';
  if (s === 'warning') return '🟡';
  if (s === 'info') return '🔵';
  return '✅';
}

function actionIcon(t: string): string {
  if (t === 'acted') return '🔧';
  if (t === 'reviewed') return '👁️';
  if (t === 'dismissed') return '🚫';
  return '✅';
}

const btnBase = 'rounded-md transition-colors';
const btnSm = 'text-white/40 hover:bg-white/10 hover:text-white/60';

// ============================================================================
// CONFIRM DIALOG — reusable for all actions
// ============================================================================

function ConfirmDialog({
  title,
  detail,
  actionLabel,
  onConfirm,
  onCancel,
  submitting,
}: {
  title: string;
  detail: string;
  actionLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  return (
    <div
      className="mt-2 rounded-lg bg-white/[0.04] ring-1 ring-white/10"
      style={{ padding: 'clamp(10px, 1vw, 14px)' }}
    >
      <p className="font-semibold text-white/60" style={{ fontSize: 'clamp(10px, 1vw, 12px)' }}>
        {title}
      </p>
      <p
        className="mt-1 text-white/30"
        style={{ fontSize: 'clamp(8px, 0.8vw, 10px)', lineHeight: '1.4' }}
      >
        {detail}
      </p>
      <div className="mt-2 flex items-center" style={{ gap: 'clamp(6px, 0.6vw, 8px)' }}>
        <button
          type="button"
          onClick={onConfirm}
          disabled={submitting}
          className={`${btnBase} bg-emerald-600/20 text-emerald-400/80 hover:bg-emerald-600/30 disabled:opacity-40`}
          style={{
            fontSize: 'clamp(9px, 0.85vw, 11px)',
            padding: 'clamp(3px, 0.3vw, 5px) clamp(10px, 1vw, 14px)',
          }}
        >
          {submitting ? 'Saving…' : actionLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className={`${btnBase} bg-white/5 text-white/30 hover:bg-white/10`}
          style={{
            fontSize: 'clamp(9px, 0.85vw, 11px)',
            padding: 'clamp(3px, 0.3vw, 5px) clamp(10px, 1vw, 14px)',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// THERMOMETER BAR — per-file confidence + expandable decay + review btn
// ============================================================================

function ThermometerBar({
  file,
  lastReviewed,
  onAction,
}: {
  file: FileConfidence;
  lastReviewed: string | null;
  onAction: (req: EvolutionActionRequest) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const d = file.decayFactors;

  const handleReview = async () => {
    setSubmitting(true);
    await onAction({
      actionType: 'reviewed',
      file: file.file,
      confidenceBefore: file.confidence,
    });
    setSubmitting(false);
    setConfirming(false);
  };

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center text-left transition-colors hover:bg-white/[0.02]"
        style={{ gap: 'clamp(8px, 0.8vw, 12px)', padding: 'clamp(4px, 0.4vw, 6px) 0' }}
      >
        <div
          className="relative flex-1 overflow-hidden rounded-full bg-white/[0.06]"
          style={{ height: 'clamp(10px, 1vw, 14px)' }}
        >
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all ${confBg(file.confidence)}`}
            style={{ width: `${file.confidence}%`, opacity: 0.5 }}
          />
        </div>
        <span
          className="flex-shrink-0 truncate text-white/50"
          style={{ fontSize: 'clamp(9px, 0.85vw, 11px)', width: 'clamp(140px, 16vw, 200px)' }}
        >
          {file.file}
        </span>
        <span
          className={`flex-shrink-0 font-mono font-semibold ${confColour(file.confidence)}`}
          style={{
            fontSize: 'clamp(11px, 1.1vw, 14px)',
            width: 'clamp(36px, 4vw, 48px)',
            textAlign: 'right',
          }}
        >
          {file.confidence}%
        </span>
      </button>

      {open && (
        <div
          className="ml-4 mt-1 rounded-md bg-white/[0.02]"
          style={{ padding: 'clamp(6px, 0.6vw, 8px)', fontSize: 'clamp(8px, 0.75vw, 10px)' }}
        >
          <div className="flex flex-wrap" style={{ gap: 'clamp(8px, 1vw, 14px)' }}>
            <span className="text-white/30">
              Age:{' '}
              <span className={d.ageDecay > 0 ? 'text-red-400/50' : 'text-white/15'}>
                {d.ageDays}d (−{d.ageDecay}/{30})
              </span>
            </span>
            <span className="text-white/30">
              Volume:{' '}
              <span className={d.volumeDecay > 0 ? 'text-red-400/50' : 'text-white/15'}>
                {d.volumeGrowthFactor.toFixed(1)}× (−{d.volumeDecay}/{25})
              </span>
            </span>
            <span className="text-white/30">
              Assumptions:{' '}
              <span className={d.assumptionDecay > 0 ? 'text-red-400/50' : 'text-white/15'}>
                {d.brokenAssumptions} broken (−{d.assumptionDecay}/{25})
              </span>
            </span>
            <span className="text-white/30">
              Upstream:{' '}
              <span className={d.upstreamDecay > 0 ? 'text-red-400/50' : 'text-white/15'}>
                {d.upstreamChanges} changed (−{d.upstreamDecay}/{20})
              </span>
            </span>
          </div>

          {file.detectorFindings.length > 0 && (
            <div className="mt-2 text-white/25">
              {file.detectorFindings.length} finding{file.detectorFindings.length !== 1 ? 's' : ''}:{' '}
              {file.detectorFindings.map((f) => f.detectorName).join(', ')}
            </div>
          )}

          {/* Last reviewed + Mark as Reviewed */}
          <div className="mt-2 flex items-center" style={{ gap: 'clamp(8px, 0.8vw, 12px)' }}>
            {lastReviewed ? (
              <span className="text-white/15" style={{ fontSize: 'clamp(8px, 0.75vw, 10px)' }}>
                Last reviewed: {lastReviewed}
              </span>
            ) : (
              <span className="text-white/10" style={{ fontSize: 'clamp(8px, 0.75vw, 10px)' }}>
                Never reviewed
              </span>
            )}
            {!confirming && (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className={`${btnBase} bg-white/5 ${btnSm}`}
                style={{
                  fontSize: 'clamp(8px, 0.75vw, 10px)',
                  padding: 'clamp(2px, 0.2vw, 3px) clamp(6px, 0.6vw, 8px)',
                }}
              >
                👁️ Mark as Reviewed
              </button>
            )}
          </div>

          {confirming && (
            <ConfirmDialog
              title={`Review: ${file.file}`}
              detail={`Confirms this file's logic is still appropriate for current data. Resets age decay, confidence boosts by +15 points (${file.confidence}% → ${Math.min(100, file.confidence + 15)}%).`}
              actionLabel="Confirm Review"
              onConfirm={handleReview}
              onCancel={() => setConfirming(false)}
              submitting={submitting}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// DETECTOR CARD — finding + prediction + proposal + action buttons
// ============================================================================

function DetectorCard({
  finding,
  prediction,
  proposal,
  fileConfidence,
  onJump,
  onAction,
}: {
  finding: DetectorResult;
  prediction: DriftPrediction | null;
  proposal: EvolutionProposal | null;
  fileConfidence: number;
  onJump: (sectionId: string) => void;
  onAction: (req: EvolutionActionRequest) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'acted' | 'dismissed' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleAction = async (actionType: 'acted' | 'dismissed') => {
    setSubmitting(true);
    await onAction({
      actionType,
      file: finding.file,
      proposalTitle: proposal?.title,
      detectorId: finding.detectorId,
      confidenceBefore: fileConfidence,
    });
    setSubmitting(false);
    setConfirmAction(null);
    // Show the confidence change will appear on next refresh
  };

  const actedBoostPreview = Math.min(100, fileConfidence + 25);
  const dismissBoostPreview = Math.min(100, fileConfidence + 5);

  return (
    <div
      className="rounded-lg bg-white/[0.03] ring-1 ring-white/5"
      style={{ padding: 'clamp(10px, 1vw, 14px)' }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between text-left"
      >
        <div className="flex items-start" style={{ gap: 'clamp(6px, 0.6vw, 8px)' }}>
          <span style={{ fontSize: 'clamp(11px, 1vw, 13px)', lineHeight: '1.3' }}>
            {sevIcon(finding.severity)}
          </span>
          <div>
            <span
              className="font-semibold text-white/70"
              style={{ fontSize: 'clamp(10px, 1vw, 13px)' }}
            >
              {finding.file}
            </span>
            <p className="text-white/35" style={{ fontSize: 'clamp(9px, 0.85vw, 11px)' }}>
              {finding.summary}
            </p>
          </div>
        </div>
        <span
          className="flex-shrink-0 font-mono text-white/15"
          style={{ fontSize: 'clamp(9px, 0.8vw, 10px)' }}
        >
          {finding.confidence}%
        </span>
      </button>

      {open && (
        <div className="mt-3" style={{ paddingLeft: 'clamp(20px, 2vw, 28px)' }}>
          <p
            className="text-white/30"
            style={{ fontSize: 'clamp(9px, 0.85vw, 11px)', lineHeight: '1.5' }}
          >
            {finding.detail}
          </p>

          {prediction && (
            <div
              className="mt-2 flex items-center rounded-md bg-violet-500/5 ring-1 ring-violet-500/10"
              style={{
                padding: 'clamp(4px, 0.4vw, 6px) clamp(8px, 0.8vw, 10px)',
                gap: 'clamp(4px, 0.4vw, 6px)',
              }}
            >
              <span style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}>🔮</span>
              <span className="text-violet-400/60" style={{ fontSize: 'clamp(9px, 0.85vw, 11px)' }}>
                {prediction.summary}
              </span>
            </div>
          )}

          {proposal && (
            <div
              className="mt-2 rounded-md bg-amber-500/5 ring-1 ring-amber-500/10"
              style={{ padding: 'clamp(6px, 0.6vw, 8px) clamp(8px, 0.8vw, 10px)' }}
            >
              <div
                className="flex items-center"
                style={{ gap: 'clamp(4px, 0.4vw, 6px)', marginBottom: 'clamp(2px, 0.2vw, 3px)' }}
              >
                <span style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}>💡</span>
                <span
                  className="font-semibold text-amber-400/70"
                  style={{ fontSize: 'clamp(9px, 0.9vw, 11px)' }}
                >
                  {proposal.title}
                </span>
              </div>
              <p
                className="whitespace-pre-line text-white/30"
                style={{ fontSize: 'clamp(8px, 0.75vw, 10px)', lineHeight: '1.5' }}
              >
                {proposal.description}
              </p>
              <div
                className="mt-1 flex flex-wrap items-center"
                style={{ gap: 'clamp(8px, 0.8vw, 12px)', fontSize: 'clamp(8px, 0.7vw, 9px)' }}
              >
                <span className="text-white/15">Basis: {proposal.dataBasis}</span>
                <span className="text-white/15">Impact: {proposal.expectedImpact}</span>
              </div>
            </div>
          )}

          {/* ── Action buttons ─────────────────────────────────────── */}
          {!confirmAction && (
            <div
              className="mt-3 flex flex-wrap items-center"
              style={{ gap: 'clamp(6px, 0.6vw, 8px)' }}
            >
              <button
                type="button"
                onClick={() => onJump(finding.drillSection)}
                className={`${btnBase} bg-white/5 ${btnSm}`}
                style={{
                  fontSize: 'clamp(9px, 0.85vw, 11px)',
                  padding: 'clamp(3px, 0.3vw, 4px) clamp(8px, 0.8vw, 12px)',
                }}
              >
                View {finding.drillSection.replace(/-/g, ' ')} ↓
              </button>
              {proposal && (
                <button
                  type="button"
                  onClick={() => setConfirmAction('acted')}
                  className={`${btnBase} bg-emerald-600/10 text-emerald-400/60 hover:bg-emerald-600/20 hover:text-emerald-400/80`}
                  style={{
                    fontSize: 'clamp(9px, 0.85vw, 11px)',
                    padding: 'clamp(3px, 0.3vw, 4px) clamp(8px, 0.8vw, 12px)',
                  }}
                >
                  🔧 Act on Proposal
                </button>
              )}
              <button
                type="button"
                onClick={() => setConfirmAction('dismissed')}
                className={`${btnBase} bg-white/5 text-white/25 hover:bg-white/10 hover:text-white/40`}
                style={{
                  fontSize: 'clamp(9px, 0.85vw, 11px)',
                  padding: 'clamp(3px, 0.3vw, 4px) clamp(8px, 0.8vw, 12px)',
                }}
              >
                🚫 Dismiss
              </button>
            </div>
          )}

          {/* ── Confirm: Act on Proposal ───────────────────────────── */}
          {confirmAction === 'acted' && proposal && (
            <ConfirmDialog
              title={`Act on: ${proposal.title}`}
              detail={`Records that you implemented this proposal. Confidence boosts by +25 (${fileConfidence}% → ${actedBoostPreview}%). This creates an entry in the Evolution History so you can track the impact over time.`}
              actionLabel="Confirm — I've Acted"
              onConfirm={() => handleAction('acted')}
              onCancel={() => setConfirmAction(null)}
              submitting={submitting}
            />
          )}

          {/* ── Confirm: Dismiss ───────────────────────────────────── */}
          {confirmAction === 'dismissed' && (
            <ConfirmDialog
              title={`Dismiss finding: ${finding.file}`}
              detail={`Acknowledges this finding without action. Minor confidence boost +5 (${fileConfidence}% → ${dismissBoostPreview}%). You can revisit later.`}
              actionLabel="Confirm Dismiss"
              onConfirm={() => handleAction('dismissed')}
              onCancel={() => setConfirmAction(null)}
              submitting={submitting}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PREDICTIONS STRIP
// ============================================================================

function PredictionsStrip({ predictions }: { predictions: DriftPrediction[] }) {
  if (predictions.length === 0) return null;

  return (
    <div>
      <h3
        className="mb-2 font-semibold text-white/40"
        style={{ fontSize: 'clamp(10px, 0.95vw, 12px)' }}
      >
        🔮 Drift Predictions
      </h3>
      <div className="flex flex-col" style={{ gap: 'clamp(4px, 0.4vw, 6px)' }}>
        {predictions.map((p, i) => {
          const urgencyClass =
            (p.weeksUntilStale ?? 99) < 4
              ? 'text-red-400/60'
              : (p.weeksUntilStale ?? 99) < 8
                ? 'text-amber-400/60'
                : 'text-violet-400/60';
          return (
            <div
              key={`pred-${i}`}
              className="flex items-center rounded-md bg-violet-500/[0.03] ring-1 ring-violet-500/10"
              style={{
                padding: 'clamp(6px, 0.6vw, 8px) clamp(10px, 1vw, 14px)',
                gap: 'clamp(6px, 0.6vw, 8px)',
              }}
            >
              <div className="flex-1">
                <span
                  className={`font-medium ${urgencyClass}`}
                  style={{ fontSize: 'clamp(9px, 0.9vw, 11px)' }}
                >
                  {p.summary}
                </span>
                <p className="text-white/20" style={{ fontSize: 'clamp(8px, 0.7vw, 9px)' }}>
                  {p.file} · {p.metric}: {p.currentValue}/{p.threshold} · +{p.velocityPerWeek}/week
                </p>
              </div>
              {p.weeksUntilStale !== null && (
                <span
                  className={`flex-shrink-0 rounded-full font-mono font-semibold ${urgencyClass}`}
                  style={{
                    fontSize: 'clamp(10px, 1vw, 13px)',
                    background: 'rgba(139, 92, 246, 0.08)',
                    padding: 'clamp(2px, 0.2vw, 3px) clamp(8px, 0.8vw, 12px)',
                  }}
                >
                  ~{p.weeksUntilStale}w
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// ASSUMPTION REGISTRY TABLE
// ============================================================================

function AssumptionsTable({ assumptions }: { assumptions: Assumption[] }) {
  if (assumptions.length === 0) return null;

  const broken = assumptions.filter((a) => !a.valid);
  const valid = assumptions.filter((a) => a.valid);

  return (
    <div>
      <h3
        className="mb-2 font-semibold text-white/40"
        style={{ fontSize: 'clamp(10px, 0.95vw, 12px)' }}
      >
        📋 Assumption Registry ({broken.length} broken, {valid.length} valid)
      </h3>
      <div className="flex flex-col" style={{ gap: 'clamp(2px, 0.2vw, 3px)' }}>
        {assumptions.map((a, i) => (
          <div
            key={`assum-${i}`}
            className={`flex items-start rounded-md ${
              a.valid ? 'bg-white/[0.01]' : 'bg-red-500/[0.03] ring-1 ring-red-500/10'
            }`}
            style={{
              padding: 'clamp(4px, 0.4vw, 6px) clamp(8px, 0.8vw, 10px)',
              gap: 'clamp(6px, 0.6vw, 8px)',
            }}
          >
            <span style={{ fontSize: 'clamp(10px, 0.9vw, 12px)', lineHeight: '1.2' }}>
              {a.valid ? '✅' : '❌'}
            </span>
            <div className="min-w-0 flex-1">
              <span className="text-white/40" style={{ fontSize: 'clamp(9px, 0.85vw, 11px)' }}>
                {a.text}
              </span>
              {!a.valid && (
                <p className="text-red-400/50" style={{ fontSize: 'clamp(8px, 0.75vw, 10px)' }}>
                  Expected: {a.expected} · Observed: {a.observed}
                </p>
              )}
            </div>
            <span
              className="flex-shrink-0 text-white/15"
              style={{ fontSize: 'clamp(7px, 0.65vw, 9px)' }}
            >
              {a.file}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// EVOLUTION HISTORY — with action type icons + confidence delta
// ============================================================================

function HistoryTimeline({ history }: { history: EvolutionHistoryEntry[] }) {
  if (history.length === 0) {
    return (
      <div>
        <h3
          className="mb-2 font-semibold text-white/40"
          style={{ fontSize: 'clamp(10px, 0.95vw, 12px)' }}
        >
          📜 Evolution History
        </h3>
        <p className="text-white/15" style={{ fontSize: 'clamp(9px, 0.85vw, 11px)' }}>
          No evolution actions recorded yet. Act on a proposal or mark a file as reviewed to start
          building history.
        </p>
      </div>
    );
  }

  // Show most recent first
  const sorted = [...history].reverse();

  return (
    <div>
      <h3
        className="mb-2 font-semibold text-white/40"
        style={{ fontSize: 'clamp(10px, 0.95vw, 12px)' }}
      >
        📜 Evolution History ({history.length} action{history.length !== 1 ? 's' : ''})
      </h3>
      <div className="flex flex-col" style={{ gap: 'clamp(4px, 0.4vw, 6px)' }}>
        {sorted.map((h, i) => {
          const delta = h.confidenceAfter - h.confidenceBefore;
          const deltaColour =
            delta > 0 ? 'text-emerald-400/60' : delta < 0 ? 'text-red-400/60' : 'text-white/20';
          return (
            <div
              key={`hist-${i}`}
              className="flex items-center rounded-md bg-white/[0.01]"
              style={{
                gap: 'clamp(6px, 0.6vw, 10px)',
                fontSize: 'clamp(9px, 0.85vw, 11px)',
                padding: 'clamp(3px, 0.3vw, 4px) clamp(6px, 0.6vw, 8px)',
              }}
            >
              <span
                className="flex-shrink-0 font-mono text-white/15"
                style={{ width: 'clamp(46px, 5.5vw, 62px)' }}
              >
                {h.date.slice(5, 10)}
              </span>
              <span style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}>
                {actionIcon(h.actionType ?? 'acted')}
              </span>
              <span className="min-w-0 flex-1 truncate text-white/35">{h.action}</span>
              <span className={`flex-shrink-0 font-mono ${deltaColour}`}>
                {delta >= 0 ? '+' : ''}
                {delta}%
              </span>
              <span className="flex-shrink-0 font-mono text-white/15">{h.confidenceAfter}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function CodeEvolutionRadar() {
  const [report, setReport] = useState<RadarReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const { drillTo } = useDrillThrough();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/scoring-health/code-radar');
      const json = await res.json();
      if (json.ok && json.data) {
        setReport(json.data as RadarReport);
        setLastRefresh(new Date());
      } else {
        setError(json.message ?? 'Failed to load radar data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fetch failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleJump = useCallback(
    (sectionId: string) => {
      drillTo(sectionId);
    },
    [drillTo],
  );

  // ── POST an evolution action ──────────────────────────────────────
  const handleAction = useCallback(
    async (req: EvolutionActionRequest) => {
      try {
        const res = await fetch('/api/admin/scoring-health/code-radar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(req),
        });
        const json = await res.json();
        if (json.ok) {
          const entry = json.entry;
          const label =
            req.actionType === 'acted'
              ? 'Acted on proposal'
              : req.actionType === 'reviewed'
                ? 'Marked as reviewed'
                : 'Dismissed finding';
          setActionFeedback(
            `${label}: ${req.file} — confidence ${entry?.confidenceBefore ?? '?'}% → ${entry?.confidenceAfter ?? '?'}%`,
          );
          // Auto-refresh radar after action
          void fetchData();
          // Clear feedback after 5s
          setTimeout(() => setActionFeedback(null), 5_000);
        } else {
          setActionFeedback(`Action failed: ${json.message ?? 'Unknown error'}`);
        }
      } catch (err) {
        setActionFeedback(`Action failed: ${err instanceof Error ? err.message : 'Network error'}`);
      }
    },
    [fetchData],
  );

  // ── Loading ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        className="rounded-xl bg-white/5 ring-1 ring-white/10"
        style={{ padding: 'clamp(16px, 2vw, 24px)' }}
      >
        <div className="animate-pulse text-white/20" style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}>
          Running 9-system code evolution scan…
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────
  if (error || !report) {
    return (
      <div
        className="rounded-xl bg-white/5 ring-1 ring-white/10"
        style={{ padding: 'clamp(16px, 2vw, 24px)' }}
      >
        <div className="flex items-center justify-between">
          <span className="text-red-400/70" style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}>
            ❌ {error ?? 'No data'}
          </span>
          <button
            type="button"
            onClick={fetchData}
            className="rounded-md bg-white/5 text-white/50 transition-colors hover:bg-white/10"
            style={{
              fontSize: 'clamp(10px, 0.9vw, 12px)',
              padding: 'clamp(4px, 0.4vw, 6px) clamp(10px, 1vw, 14px)',
            }}
          >
            ⟳ Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Map findings to their predictions/proposals/confidence ────────
  const predByFile = new Map<string, DriftPrediction>();
  for (const p of report.predictions) {
    if (!predByFile.has(p.file)) predByFile.set(p.file, p);
  }
  const propByFile = new Map<string, EvolutionProposal>();
  for (const p of report.proposals) {
    if (!propByFile.has(p.file)) propByFile.set(p.file, p);
  }
  const confByFile = new Map<string, number>();
  for (const f of report.files) {
    confByFile.set(f.file, f.confidence);
  }

  const s = report.summary;

  return (
    <div
      className="rounded-xl bg-white/5 ring-1 ring-white/10"
      style={{ padding: 'clamp(16px, 2vw, 24px)' }}
    >
      {/* ── Action feedback toast ─────────────────────────────────── */}
      {actionFeedback && (
        <div
          className="mb-3 rounded-md bg-emerald-600/10 ring-1 ring-emerald-500/20"
          style={{
            padding: 'clamp(6px, 0.6vw, 8px) clamp(10px, 1vw, 14px)',
            fontSize: 'clamp(9px, 0.85vw, 11px)',
          }}
        >
          <span className="text-emerald-400/70">{actionFeedback}</span>
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2
            className="font-semibold text-white/80"
            style={{ fontSize: 'clamp(14px, 1.4vw, 18px)' }}
          >
            📡 Code Evolution Radar
          </h2>
          <div
            className="flex flex-wrap items-center"
            style={{
              gap: 'clamp(8px, 0.8vw, 12px)',
              marginTop: 'clamp(2px, 0.2vw, 3px)',
              fontSize: 'clamp(9px, 0.85vw, 11px)',
            }}
          >
            <span className="text-white/30">{s.filesMonitored} files monitored</span>
            <span className="text-white/10">│</span>
            {s.filesFlagged > 0 ? (
              <span className="text-amber-400/70">{s.filesFlagged} flagged</span>
            ) : (
              <span className="text-emerald-400/70">All healthy</span>
            )}
            {s.critical > 0 && <span className="text-red-400/70">{s.critical} critical</span>}
            {s.warning > 0 && <span className="text-amber-400/60">{s.warning} warning</span>}
            {s.earliestPrediction && (
              <>
                <span className="text-white/10">│</span>
                <span className="text-violet-400/60">Next prediction: {s.earliestPrediction}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center" style={{ gap: 'clamp(8px, 0.8vw, 12px)' }}>
          <div className="flex flex-col items-center">
            <span
              className={`font-mono font-bold ${confColour(report.overallConfidence)}`}
              style={{ fontSize: 'clamp(18px, 2vw, 26px)', lineHeight: 1 }}
            >
              {report.overallConfidence}
            </span>
            <span className="text-white/20" style={{ fontSize: 'clamp(7px, 0.65vw, 9px)' }}>
              overall
            </span>
          </div>
          {lastRefresh && (
            <span className="text-white/15" style={{ fontSize: 'clamp(9px, 0.75vw, 11px)' }}>
              {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            type="button"
            onClick={fetchData}
            className="rounded-md bg-white/5 text-white/50 transition-colors hover:bg-white/10 hover:text-white/70"
            style={{
              fontSize: 'clamp(10px, 0.9vw, 12px)',
              padding: 'clamp(4px, 0.4vw, 6px) clamp(10px, 1vw, 14px)',
            }}
          >
            ⟳ Scan
          </button>
        </div>
      </div>

      {/* ── Confidence Thermometers ──────────────────────────────── */}
      <div className="mb-5">
        <h3
          className="mb-2 font-semibold text-white/40"
          style={{ fontSize: 'clamp(10px, 0.95vw, 12px)' }}
        >
          🌡️ File Confidence
        </h3>
        {report.files.map((f) => (
          <ThermometerBar
            key={f.file}
            file={f}
            lastReviewed={report.reviews[f.file] ?? null}
            onAction={handleAction}
          />
        ))}
      </div>

      {/* ── Active Findings ──────────────────────────────────────── */}
      {report.detectorFindings.length > 0 && (
        <div className="mb-5">
          <h3
            className="mb-2 font-semibold text-white/40"
            style={{ fontSize: 'clamp(10px, 0.95vw, 12px)' }}
          >
            🔍 Active Findings
          </h3>
          <div className="flex flex-col" style={{ gap: 'clamp(6px, 0.6vw, 8px)' }}>
            {report.detectorFindings.map((finding, i) => (
              <DetectorCard
                key={`finding-${i}`}
                finding={finding}
                prediction={predByFile.get(finding.file) ?? null}
                proposal={propByFile.get(finding.file) ?? null}
                fileConfidence={confByFile.get(finding.file) ?? 50}
                onJump={handleJump}
                onAction={handleAction}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Drift Predictions ────────────────────────────────────── */}
      {report.predictions.length > 0 && (
        <div className="mb-5">
          <PredictionsStrip predictions={report.predictions} />
        </div>
      )}

      {/* ── Assumption Registry ──────────────────────────────────── */}
      <div className="mb-5">
        <AssumptionsTable assumptions={report.allAssumptions} />
      </div>

      {/* ── Evolution History ────────────────────────────────────── */}
      <HistoryTimeline history={report.history} />
    </div>
  );
}
