'use client';

// src/components/admin/scoring-health/term-inspector.tsx
// ============================================================================
// TERM INSPECTOR — Slide-out detail panel for vocabulary terms
// ============================================================================
//
// Opens when a term in the leaderboard is clicked. Shows:
//   - Quality score with badge
//   - Per-tier score breakdown
//   - Per-platform quality scores (which providers it works best/worst on)
//   - Category classification
//   - Trend direction with magnitude
//   - Action buttons: Demote, Flag for review
//
// Data: GET /api/admin/scoring-health/term-inspect?term=...&tier=...
//
// Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md
//
// Version: 1.0.0
// Created: 2026-03-01
//
// Existing features preserved: Yes (new component).
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ScoringHealthApiResponse, TermInspectData } from '@/lib/admin/scoring-health-types';

// ============================================================================
// PROPS
// ============================================================================

export interface TermInspectorProps {
  /** The term to inspect */
  term: string;
  /** Current tier context */
  tier: string;
  /** Close the inspector */
  onClose: () => void;
}

// ============================================================================
// HELPERS
// ============================================================================

function ScoreBadge({ score, size = 'normal' }: { score: number; size?: 'normal' | 'large' }) {
  const colour =
    score >= 80 ? 'bg-emerald-500/15 text-emerald-400'
    : score >= 50 ? 'bg-amber-500/15 text-amber-400'
    : 'bg-red-500/15 text-red-400';

  const fontSize = size === 'large'
    ? 'clamp(16px, 1.6vw, 22px)'
    : 'clamp(10px, 0.9vw, 12px)';

  return (
    <span
      className={`rounded-full font-mono font-bold ${colour}`}
      style={{
        fontSize,
        padding: size === 'large'
          ? 'clamp(3px, 0.3vw, 5px) clamp(10px, 1vw, 14px)'
          : 'clamp(1px, 0.15vw, 2px) clamp(6px, 0.6vw, 8px)',
      }}
    >
      {score.toFixed(0)}
    </span>
  );
}

function TrendDisplay({ trend }: { trend: number }) {
  if (trend > 0.01) {
    return <span className="text-emerald-400">▲ +{(trend * 100).toFixed(0)}%</span>;
  }
  if (trend < -0.01) {
    return <span className="text-red-400">▼ {(trend * 100).toFixed(0)}%</span>;
  }
  return <span className="text-white/25">─ stable</span>;
}

// ============================================================================
// QUALITY BAR — horizontal progress bar
// ============================================================================

function QualityBar({ score, label }: { score: number; label: string }) {
  const width = Math.max(2, Math.min(100, score));
  const colour =
    score >= 80 ? 'bg-emerald-500/60'
    : score >= 50 ? 'bg-amber-500/60'
    : 'bg-red-500/60';

  return (
    <div
      className="flex items-center"
      style={{ gap: 'clamp(6px, 0.6vw, 10px)', fontSize: 'clamp(9px, 0.85vw, 11px)' }}
    >
      <span className="w-20 flex-shrink-0 truncate text-white/40">{label}</span>
      <div className="relative flex-1 h-2 rounded-full bg-white/5">
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${colour}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="w-8 flex-shrink-0 text-right font-mono text-white/50">
        {score.toFixed(0)}
      </span>
    </div>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function TermInspector({ term, tier, onClose }: TermInspectorProps) {
  const [data, setData] = useState<TermInspectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // ── Escape key to close ────────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // ── Fetch data ──────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ term, tier });
      const res = await fetch(`/api/admin/scoring-health/term-inspect?${params}`);
      const json = (await res.json()) as ScoringHealthApiResponse<TermInspectData>;
      if (!json.ok || !json.data) {
        setError(json.message ?? 'Failed to load term data');
      } else {
        setData(json.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fetch failed');
    } finally {
      setLoading(false);
    }
  }, [term, tier]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  // ── Action handlers (console-only for now) ──────────────────────────
  const handleDemote = useCallback(() => {
    // eslint-disable-next-line no-console
    console.log(`[TermInspector] DEMOTE: "${term}" — suggest removing from higher tiers`);
  }, [term]);

  const handleFlag = useCallback(() => {
    // eslint-disable-next-line no-console
    console.log(`[TermInspector] FLAG: "${term}" — marked for manual review`);
  }, [term]);

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close term inspector"
        tabIndex={-1}
      />

      {/* Slide-out panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Inspector for term: ${term}`}
        className="relative z-10 h-full overflow-y-auto bg-[#0a0a0a] ring-1 ring-white/10"
        style={{
          width: 'clamp(320px, 30vw, 450px)',
          padding: 'clamp(16px, 2vw, 24px)',
        }}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3
              className="font-bold text-white/90"
              style={{ fontSize: 'clamp(15px, 1.5vw, 20px)' }}
            >
              {term}
            </h3>
            <p
              className="text-white/30"
              style={{ fontSize: 'clamp(9px, 0.85vw, 11px)', marginTop: 'clamp(1px, 0.1vw, 2px)' }}
            >
              Term Inspector
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-white/5 text-white/40 hover:bg-white/10"
            style={{ padding: 'clamp(3px, 0.3vw, 5px) clamp(8px, 0.8vw, 10px)', fontSize: 'clamp(10px, 0.9vw, 12px)' }}
          >
            ✕
          </button>
        </div>

        {/* ── Loading ─────────────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center justify-center" style={{ minHeight: 'clamp(100px, 15vw, 200px)' }}>
            <span className="animate-pulse text-white/30" style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}>
              Loading…
            </span>
          </div>
        )}

        {/* ── Error ──────────────────────────────────────────────── */}
        {error && (
          <div
            className="rounded-lg bg-red-500/10 text-red-400"
            style={{ padding: 'clamp(8px, 1vw, 12px)', fontSize: 'clamp(10px, 0.9vw, 12px)' }}
          >
            ❌ {error}
          </div>
        )}

        {/* ── Data ───────────────────────────────────────────────── */}
        {data && (
          <div className="flex flex-col" style={{ gap: 'clamp(14px, 1.5vw, 20px)' }}>
            {/* Overall stats */}
            <div
              className="flex items-center justify-between rounded-lg bg-white/[0.03] ring-1 ring-white/5"
              style={{ padding: 'clamp(10px, 1.2vw, 16px)' }}
            >
              <div>
                <ScoreBadge score={data.globalScore} size="large" />
                <div
                  className="mt-1 text-white/30"
                  style={{ fontSize: 'clamp(9px, 0.8vw, 11px)' }}
                >
                  {data.globalUsage.toLocaleString()} uses
                </div>
              </div>
              <div className="text-right">
                <div style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}>
                  <TrendDisplay trend={data.globalTrend} />
                </div>
                <div
                  className="mt-1 rounded bg-white/5 text-white/40"
                  style={{
                    fontSize: 'clamp(8px, 0.7vw, 10px)',
                    padding: 'clamp(1px, 0.1vw, 2px) clamp(4px, 0.4vw, 6px)',
                    display: 'inline-block',
                  }}
                >
                  {data.category}
                </div>
              </div>
            </div>

            {/* Per-tier scores */}
            <div>
              <h4
                className="mb-2 font-semibold text-white/50"
                style={{ fontSize: 'clamp(10px, 0.95vw, 12px)' }}
              >
                Per-Tier Quality
              </h4>
              <div
                className="flex flex-col rounded-lg bg-white/[0.02] ring-1 ring-white/5"
                style={{ padding: 'clamp(8px, 1vw, 12px)', gap: 'clamp(4px, 0.4vw, 6px)' }}
              >
                {Object.entries(data.tierScores).map(([t, info]) => (
                  <QualityBar
                    key={t}
                    label={t === 'global' ? 'Global' : `Tier ${t}`}
                    score={info.score}
                  />
                ))}
              </div>
            </div>

            {/* Per-platform breakdown */}
            {data.platforms.length > 0 && (
              <div>
                <h4
                  className="mb-2 font-semibold text-white/50"
                  style={{ fontSize: 'clamp(10px, 0.95vw, 12px)' }}
                >
                  Platform Breakdown
                </h4>
                <div
                  className="flex flex-col rounded-lg bg-white/[0.02] ring-1 ring-white/5"
                  style={{ padding: 'clamp(8px, 1vw, 12px)', gap: 'clamp(4px, 0.4vw, 6px)' }}
                >
                  {data.platforms
                    .sort((a, b) => b.score - a.score)
                    .map((p) => (
                      <div
                        key={p.platformId}
                        className="flex items-center justify-between"
                        style={{ fontSize: 'clamp(9px, 0.85vw, 11px)' }}
                      >
                        <span className="text-white/50">{p.platformId}</span>
                        <div className="flex items-center" style={{ gap: 'clamp(8px, 0.8vw, 12px)' }}>
                          <ScoreBadge score={p.score} />
                          <span className="font-mono text-white/25">
                            {p.eventCount.toLocaleString()}
                          </span>
                          <span style={{ fontSize: 'clamp(8px, 0.75vw, 10px)' }}>
                            <TrendDisplay trend={p.trend} />
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex" style={{ gap: 'clamp(6px, 0.6vw, 10px)' }}>
              <button
                type="button"
                onClick={handleFlag}
                className="flex-1 rounded-lg bg-amber-500/10 text-amber-400/70 transition-colors hover:bg-amber-500/20 hover:text-amber-400"
                style={{
                  fontSize: 'clamp(10px, 0.9vw, 12px)',
                  padding: 'clamp(6px, 0.6vw, 8px)',
                }}
              >
                🚩 Flag for Review
              </button>
              <button
                type="button"
                onClick={handleDemote}
                className="flex-1 rounded-lg bg-red-500/10 text-red-400/70 transition-colors hover:bg-red-500/20 hover:text-red-400"
                style={{
                  fontSize: 'clamp(10px, 0.9vw, 12px)',
                  padding: 'clamp(6px, 0.6vw, 8px)',
                }}
              >
                ⬇️ Demote
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
