'use client';

// src/components/admin/scoring-health/weight-tuning-sandbox.tsx
// ============================================================================
// WEIGHT TUNING SANDBOX — Interactive "what-if" modal
// ============================================================================
//
// Opened from the Weight Drift section header. Full-screen overlay with:
//   - Left panel: Weight sliders per factor, tier selector, reset, diff view
//   - Right panel: Live re-scored preview of 20 recent prompts showing
//     old score → new score, rank movement, aggregate metrics
//   - Footer: Promote (with confirm) or Discard
//
// All simulation is client-side (pure weight-simulator.ts). No server
// round-trip for preview — only for initial data load and promote.
//
// Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md § 11
//
// Version: 1.0.0
// Created: 2026-03-01
//
// Existing features preserved: Yes (new component).
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SimulationEvent, SimulatedEvent, WeightDiff } from '@/lib/admin/weight-simulator';
import {
  normaliseWeights,
  simulateBatch,
  computeWeightDiff,
  estimateCorrelationPreservation,
} from '@/lib/admin/weight-simulator';

// ============================================================================
// CONSTANTS
// ============================================================================

const FACTOR_LABELS: Record<string, string> = {
  categoryCount: 'Category Count',
  coherence: 'Coherence',
  promptLength: 'Prompt Length',
  tierFormat: 'Tier Format',
  negative: 'Negative',
  fidelity: 'Fidelity',
  density: 'Density',
};

const TIER_OPTIONS = [
  { value: 'global', label: 'All Tiers' },
  { value: '1', label: 'Tier 1' },
  { value: '2', label: 'Tier 2' },
  { value: '3', label: 'Tier 3' },
  { value: '4', label: 'Tier 4' },
];

// ============================================================================
// WEIGHT SLIDER
// ============================================================================

function WeightSlider({
  factor,
  label,
  value,
  onChange,
}: {
  factor: string;
  label: string;
  value: number;
  onChange: (factor: string, value: number) => void;
}) {
  return (
    <div className="flex items-center" style={{ gap: 'clamp(6px, 0.6vw, 8px)' }}>
      <span
        className="flex-shrink-0 text-white/50"
        style={{ fontSize: 'clamp(9px, 0.85vw, 11px)', width: 'clamp(80px, 9vw, 100px)' }}
      >
        {label}
      </span>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(factor, parseInt(e.target.value, 10) / 100)}
        className="flex-1"
        style={{
          height: 'clamp(4px, 0.4vw, 6px)',
          accentColor: '#8b5cf6',
        }}
      />
      <span
        className="flex-shrink-0 font-mono text-violet-400/80"
        style={{ fontSize: 'clamp(10px, 0.9vw, 12px)', width: 'clamp(32px, 3.5vw, 44px)', textAlign: 'right' }}
      >
        {value.toFixed(2)}
      </span>
    </div>
  );
}

// ============================================================================
// DIFF VIEW
// ============================================================================

function DiffView({ diffs }: { diffs: WeightDiff[] }) {
  if (diffs.length === 0) {
    return (
      <p className="text-white/15" style={{ fontSize: 'clamp(9px, 0.8vw, 10px)' }}>
        No changes yet — move a slider.
      </p>
    );
  }

  return (
    <div className="flex flex-col" style={{ gap: 'clamp(2px, 0.2vw, 3px)' }}>
      {diffs.map((d) => (
        <div
          key={d.factor}
          className="flex items-center font-mono"
          style={{ fontSize: 'clamp(9px, 0.8vw, 10px)', gap: 'clamp(4px, 0.4vw, 6px)' }}
        >
          <span className="text-white/30" style={{ width: 'clamp(75px, 8vw, 95px)' }}>
            {FACTOR_LABELS[d.factor] ?? d.factor}
          </span>
          <span className="text-white/20">{d.oldWeight.toFixed(2)}</span>
          <span className="text-white/15">→</span>
          <span className="text-violet-400/70">{d.newWeight.toFixed(2)}</span>
          <span
            className={d.changePercent > 0 ? 'text-emerald-400/60' : 'text-red-400/60'}
          >
            ({d.changePercent > 0 ? '+' : ''}{d.changePercent}%)
          </span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// PREVIEW TABLE
// ============================================================================

function PreviewTable({ events }: { events: SimulatedEvent[] }) {
  return (
    <div className="overflow-y-auto" style={{ maxHeight: 'clamp(280px, 40vh, 500px)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur"
        style={{
          display: 'grid',
          gridTemplateColumns: 'clamp(20px, 2.5vw, 30px) 1fr clamp(55px, 6vw, 70px) clamp(55px, 6vw, 70px) clamp(45px, 5vw, 60px)',
          gap: '1px',
          padding: 'clamp(4px, 0.4vw, 6px) 0',
          fontSize: 'clamp(8px, 0.75vw, 10px)',
        }}
      >
        <span className="text-white/25">#</span>
        <span className="text-white/25">Prompt</span>
        <span className="text-center text-white/25">Old</span>
        <span className="text-center text-white/25">New</span>
        <span className="text-center text-white/25">Δ Rank</span>
      </div>

      {/* Rows */}
      {events.map((e, i) => {
        const scoreUp = e.scoreDelta > 0.001;
        const scoreDown = e.scoreDelta < -0.001;
        const rankUp = e.rankDelta < 0; // negative rank delta = moved up
        const rankDown = e.rankDelta > 0;

        return (
          <div
            key={e.id}
            className={`border-b border-white/[0.03] ${i % 2 === 0 ? 'bg-white/[0.01]' : ''}`}
            style={{
              display: 'grid',
              gridTemplateColumns: 'clamp(20px, 2.5vw, 30px) 1fr clamp(55px, 6vw, 70px) clamp(55px, 6vw, 70px) clamp(45px, 5vw, 60px)',
              gap: '1px',
              padding: 'clamp(3px, 0.3vw, 5px) 0',
              fontSize: 'clamp(9px, 0.85vw, 11px)',
            }}
          >
            <span className="font-mono text-white/15">{i + 1}</span>
            <span className="truncate text-white/50" title={e.promptPreview}>
              {e.promptPreview}
            </span>
            <span className="text-center font-mono text-white/30">
              {e.originalScore.toFixed(2)}
            </span>
            <span className={`text-center font-mono ${scoreUp ? 'text-emerald-400/70' : scoreDown ? 'text-red-400/70' : 'text-white/30'}`}>
              {e.newScore.toFixed(2)}
            </span>
            <span className={`text-center font-mono ${rankUp ? 'text-emerald-400/60' : rankDown ? 'text-red-400/60' : 'text-white/15'}`}>
              {e.rankDelta === 0 ? '—' : `${e.rankDelta > 0 ? '+' : ''}${e.rankDelta}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface WeightTuningSandboxProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WeightTuningSandbox({ isOpen, onClose }: WeightTuningSandboxProps) {
  // ── State ─────────────────────────────────────────────────────────
  const [tier, setTier] = useState('global');
  const [events, setEvents] = useState<SimulationEvent[]>([]);
  const [currentWeights, setCurrentWeights] = useState<Record<string, number>>({});
  const [proposedWeights, setProposedWeights] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [promoting, setPromoting] = useState(false);
  const [confirmPromote, setConfirmPromote] = useState(false);
  const [promoted, setPromoted] = useState(false);

  // ── Fetch sample data ─────────────────────────────────────────────
  const fetchSampleData = useCallback(async (selectedTier: string) => {
    setLoading(true);
    setError(null);
    setPromoted(false);
    setConfirmPromote(false);
    try {
      const res = await fetch(`/api/admin/scoring-health/simulate-weights?tier=${selectedTier}`);
      const json = await res.json();
      if (json.ok && json.data) {
        setEvents(json.data.events);
        setCurrentWeights(json.data.currentWeights);
        setProposedWeights({ ...json.data.currentWeights });
      } else {
        setError(json.message ?? 'Failed to load sandbox data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fetch failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) void fetchSampleData(tier);
  }, [isOpen, tier, fetchSampleData]);

  // ── Weight change handler ─────────────────────────────────────────
  const handleWeightChange = useCallback((factor: string, value: number) => {
    setProposedWeights((prev) => ({ ...prev, [factor]: value }));
    setConfirmPromote(false);
    setPromoted(false);
  }, []);

  // ── Reset ─────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setProposedWeights({ ...currentWeights });
    setConfirmPromote(false);
    setPromoted(false);
  }, [currentWeights]);

  // ── Simulate ──────────────────────────────────────────────────────
  const normProposed = useMemo(
    () => normaliseWeights(proposedWeights),
    [proposedWeights],
  );

  const impact = useMemo(
    () => simulateBatch(events, currentWeights, normProposed),
    [events, currentWeights, normProposed],
  );

  const diffs = useMemo(
    () => computeWeightDiff(currentWeights, normProposed),
    [currentWeights, normProposed],
  );

  const correlationPreservation = useMemo(
    () => estimateCorrelationPreservation(events, normProposed),
    [events, normProposed],
  );

  // ── Promote ───────────────────────────────────────────────────────
  const handlePromote = useCallback(async () => {
    if (!confirmPromote) {
      setConfirmPromote(true);
      return;
    }

    setPromoting(true);
    try {
      const res = await fetch('/api/admin/scoring-health/simulate-weights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, weights: normProposed }),
      });
      const json = await res.json();
      if (json.ok) {
        setPromoted(true);
        setCurrentWeights({ ...normProposed });
        setConfirmPromote(false);
      } else {
        setError(json.message ?? 'Promote failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Promote failed');
    } finally {
      setPromoting(false);
    }
  }, [confirmPromote, tier, normProposed]);

  // ── Tier change ───────────────────────────────────────────────────
  const handleTierChange = useCallback((newTier: string) => {
    setTier(newTier);
  }, []);

  if (!isOpen) return null;

  const factors = Object.keys(currentWeights);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        className="flex max-h-[90vh] flex-col rounded-2xl bg-zinc-900 ring-1 ring-white/10"
        style={{
          width: 'clamp(700px, 75vw, 1100px)',
          maxWidth: '95vw',
        }}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between border-b border-white/5"
          style={{ padding: 'clamp(12px, 1.2vw, 18px) clamp(16px, 1.6vw, 24px)' }}
        >
          <div className="flex items-center" style={{ gap: 'clamp(8px, 0.8vw, 12px)' }}>
            <span style={{ fontSize: 'clamp(16px, 1.5vw, 20px)' }}>🧪</span>
            <h2
              className="font-bold text-white/90"
              style={{ fontSize: 'clamp(14px, 1.4vw, 18px)' }}
            >
              Weight Tuning Sandbox
            </h2>
            {promoted && (
              <span
                className="rounded-full bg-emerald-500/20 font-medium text-emerald-400"
                style={{ fontSize: 'clamp(9px, 0.85vw, 11px)', padding: '0 clamp(8px, 0.8vw, 10px)' }}
              >
                ✅ Promoted
              </span>
            )}
          </div>
          <div className="flex items-center" style={{ gap: 'clamp(6px, 0.6vw, 8px)' }}>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-white/5 text-white/50 transition-colors hover:bg-white/10 hover:text-white/70"
              style={{ fontSize: 'clamp(10px, 0.9vw, 12px)', padding: 'clamp(4px, 0.4vw, 6px) clamp(12px, 1.2vw, 16px)' }}
            >
              Discard & Close
            </button>
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────────── */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <span className="animate-pulse text-white/30" style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}>
                Loading sandbox data…
              </span>
            </div>
          ) : error ? (
            <div className="flex flex-1 items-center justify-center">
              <span className="text-red-400/70" style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}>
                ❌ {error}
              </span>
            </div>
          ) : (
            <>
              {/* ── Left Panel: Sliders ──────────────────────────── */}
              <div
                className="flex flex-col border-r border-white/5 overflow-y-auto"
                style={{
                  width: 'clamp(260px, 30vw, 380px)',
                  padding: 'clamp(12px, 1.2vw, 18px)',
                  gap: 'clamp(10px, 1vw, 14px)',
                }}
              >
                {/* Tier selector */}
                <div>
                  <label
                    htmlFor="sandbox-tier-select"
                    className="mb-1 block text-white/30"
                    style={{ fontSize: 'clamp(9px, 0.8vw, 10px)' }}
                  >
                    Tier
                  </label>
                  <select
                    id="sandbox-tier-select"
                    value={tier}
                    onChange={(e) => handleTierChange(e.target.value)}
                    className="w-full rounded-md bg-white/5 text-white/60 ring-1 ring-white/10"
                    style={{ fontSize: 'clamp(10px, 0.9vw, 12px)', padding: 'clamp(4px, 0.4vw, 6px) clamp(8px, 0.8vw, 10px)' }}
                  >
                    {TIER_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                {/* Weight sliders */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span
                      className="text-white/40 font-semibold"
                      style={{ fontSize: 'clamp(10px, 0.95vw, 12px)' }}
                    >
                      Weight Adjusters
                    </span>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="text-white/25 transition-colors hover:text-white/40"
                      style={{ fontSize: 'clamp(8px, 0.75vw, 10px)' }}
                    >
                      Reset to Current
                    </button>
                  </div>
                  <div className="flex flex-col" style={{ gap: 'clamp(6px, 0.6vw, 8px)' }}>
                    {factors.map((factor) => (
                      <WeightSlider
                        key={factor}
                        factor={factor}
                        label={FACTOR_LABELS[factor] ?? factor}
                        value={proposedWeights[factor] ?? 0}
                        onChange={handleWeightChange}
                      />
                    ))}
                  </div>
                </div>

                {/* Normalised sum check */}
                <div
                  className="rounded-md bg-white/[0.03]"
                  style={{ padding: 'clamp(6px, 0.6vw, 8px)', fontSize: 'clamp(9px, 0.8vw, 10px)' }}
                >
                  <span className="text-white/25">
                    Raw sum: {Object.values(proposedWeights).reduce((s, v) => s + v, 0).toFixed(2)} →
                    auto-normalised to 1.00
                  </span>
                </div>

                {/* Diff view */}
                <div>
                  <span
                    className="mb-1 block font-semibold text-white/40"
                    style={{ fontSize: 'clamp(10px, 0.95vw, 12px)' }}
                  >
                    ⚡ Diff View
                  </span>
                  <DiffView diffs={diffs} />
                </div>
              </div>

              {/* ── Right Panel: Preview ─────────────────────────── */}
              <div
                className="flex flex-1 flex-col overflow-hidden"
                style={{ padding: 'clamp(12px, 1.2vw, 18px)' }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <span
                    className="font-semibold text-white/50"
                    style={{ fontSize: 'clamp(11px, 1.1vw, 14px)' }}
                  >
                    Simulated Impact ({events.length} recent prompts)
                  </span>
                </div>

                {/* Metrics strip */}
                <div
                  className="mb-3 flex flex-wrap"
                  style={{ gap: 'clamp(6px, 0.6vw, 8px)' }}
                >
                  <span
                    className={`rounded-full font-mono ${impact.avgScoreDelta >= 0 ? 'bg-emerald-500/10 text-emerald-400/70' : 'bg-red-500/10 text-red-400/70'}`}
                    style={{ fontSize: 'clamp(9px, 0.85vw, 11px)', padding: 'clamp(2px, 0.2vw, 3px) clamp(8px, 0.8vw, 10px)' }}
                  >
                    Avg Δ score: {impact.avgScoreDelta >= 0 ? '+' : ''}{impact.avgScoreDelta.toFixed(3)}
                  </span>
                  <span
                    className="rounded-full bg-white/5 font-mono text-white/40"
                    style={{ fontSize: 'clamp(9px, 0.85vw, 11px)', padding: 'clamp(2px, 0.2vw, 3px) clamp(8px, 0.8vw, 10px)' }}
                  >
                    Rank changes: {impact.rankChanges} of {impact.totalEvents}
                  </span>
                  <span
                    className={`rounded-full font-mono ${correlationPreservation >= 0.9 ? 'bg-emerald-500/10 text-emerald-400/70' : correlationPreservation >= 0.7 ? 'bg-amber-500/10 text-amber-400/70' : 'bg-red-500/10 text-red-400/70'}`}
                    style={{ fontSize: 'clamp(9px, 0.85vw, 11px)', padding: 'clamp(2px, 0.2vw, 3px) clamp(8px, 0.8vw, 10px)' }}
                  >
                    Score correlation: {correlationPreservation.toFixed(3)}
                  </span>
                </div>

                {/* Preview table */}
                <PreviewTable events={impact.events} />
              </div>
            </>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between border-t border-white/5"
          style={{ padding: 'clamp(10px, 1vw, 14px) clamp(16px, 1.6vw, 24px)' }}
        >
          <p className="text-white/20" style={{ fontSize: 'clamp(9px, 0.8vw, 10px)' }}>
            ⚠️ Promoting writes to production weights and triggers recalibration.
            Reversible via weight history.
          </p>
          <div className="flex items-center" style={{ gap: 'clamp(6px, 0.6vw, 8px)' }}>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-white/5 text-white/50 transition-colors hover:bg-white/10"
              style={{ fontSize: 'clamp(10px, 0.9vw, 12px)', padding: 'clamp(5px, 0.5vw, 7px) clamp(14px, 1.4vw, 20px)' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePromote}
              disabled={diffs.length === 0 || promoting || promoted}
              className={`rounded-md font-semibold transition-colors ${
                confirmPromote
                  ? 'bg-red-600/80 text-white hover:bg-red-600'
                  : 'bg-violet-600/80 text-white hover:bg-violet-600'
              } disabled:opacity-30 disabled:cursor-not-allowed`}
              style={{ fontSize: 'clamp(10px, 0.9vw, 12px)', padding: 'clamp(5px, 0.5vw, 7px) clamp(14px, 1.4vw, 20px)' }}
            >
              {promoting
                ? 'Promoting…'
                : promoted
                  ? '✅ Promoted'
                  : confirmPromote
                    ? '⚠️ Confirm Promote'
                    : '✅ Promote Now'
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
