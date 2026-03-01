/**
 * FeedbackPulseDashboard — Admin Pipeline Health Widget
 * =====================================================
 * Phase 7.10h — Real-time visibility into feedback health.
 *
 * Fetches /api/learning/feedback-summary and displays:
 *   • Feedback velocity (today / week / all-time)
 *   • Sentiment bar (👍 / 👌 / 👎 proportional)
 *   • Credibility-weighted satisfaction per platform
 *   • Daily volume sparkline (14 days)
 *   • Red flag alerts
 *   • Recent feedback stream (last 20)
 *
 * Same pattern as CompressionDashboard and TemporalFreshnessBadge.
 * Client-side only — renders in admin dashboard.
 *
 * @version 1.0.0
 * @created 2026-03-01
 *
 * Existing features preserved: Yes.
 */

'use client';

import React, { useEffect, useState, useCallback } from 'react';

// ============================================================================
// TYPES (mirrors API response)
// ============================================================================

interface RedFlag {
  type: string;
  message: string;
  severity: 'warning' | 'critical';
  platform?: string;
}

interface FeedbackSummary {
  velocity: { today: number; thisWeek: number; allTime: number };
  sentiment: { positive: number; neutral: number; negative: number; total: number };
  dailySpark: { date: string; positive: number; neutral: number; negative: number }[];
  platformSatisfaction: { platform: string; score: number; eventCount: number }[];
  recentEvents: {
    id: string;
    platform: string;
    rating: string;
    credibilityScore: number;
    userTier: string | null;
    tier: number;
    createdAt: string;
  }[];
  redFlags: RedFlag[];
  generatedAt: string;
}

type FetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty' }
  | { status: 'ok'; data: FeedbackSummary };

// ============================================================================
// HELPERS
// ============================================================================

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return `${Math.round(diff / 86_400_000)}d ago`;
}

function satColor(score: number): string {
  if (score >= 75) return 'rgb(74, 222, 128)';   // green-400
  if (score >= 50) return 'rgb(251, 191, 36)';   // amber-400
  return 'rgb(248, 113, 113)';                     // red-400
}

function ratingEmoji(rating: string): string {
  if (rating === 'positive') return '👍';
  if (rating === 'negative') return '👎';
  return '👌';
}

function ratingColor(rating: string): string {
  if (rating === 'positive') return 'rgba(74, 222, 128, 0.15)';
  if (rating === 'negative') return 'rgba(248, 113, 113, 0.15)';
  return 'rgba(148, 163, 184, 0.10)';
}

// ============================================================================
// MINI SPARKLINE — inline SVG, same pattern as CompressionDashboard
// ============================================================================

function MiniSparkline({ data }: { data: { positive: number; neutral: number; negative: number }[] }) {
  if (data.length < 2) return null;

  const totals = data.map((d) => d.positive + d.neutral + d.negative);
  const max = Math.max(...totals, 1);
  const w = 140;
  const h = 32;
  const step = w / (totals.length - 1);

  const points = totals.map((v, i) => `${i * step},${h - (v / max) * (h - 4)}`).join(' ');

  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline
        points={points}
        fill="none"
        stroke="rgba(139, 92, 246, 0.7)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {totals.length > 0 && (
        <circle
          cx={(totals.length - 1) * step}
          cy={h - (totals[totals.length - 1]! / max) * (h - 4)}
          r="2.5"
          fill="rgb(139, 92, 246)"
        />
      )}
    </svg>
  );
}

// ============================================================================
// SENTIMENT BAR — proportional horizontal bar
// ============================================================================

function SentimentBar({ positive, neutral, negative }: { positive: number; neutral: number; negative: number }) {
  const total = positive + neutral + negative;
  if (total === 0) return <div style={{ fontSize: 'clamp(10px, 0.8vw, 12px)', color: 'rgba(148,163,184,0.5)' }}>No data</div>;

  const pPct = (positive / total) * 100;
  const nPct = (neutral / total) * 100;
  const negPct = (negative / total) * 100;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          height: 'clamp(6px, 0.5vw, 8px)',
          borderRadius: '4px',
          overflow: 'hidden',
          gap: '1px',
        }}
      >
        {pPct > 0 && <div style={{ width: `${pPct}%`, background: 'rgb(74, 222, 128)', borderRadius: '2px' }} />}
        {nPct > 0 && <div style={{ width: `${nPct}%`, background: 'rgb(148, 163, 184)', borderRadius: '2px' }} />}
        {negPct > 0 && <div style={{ width: `${negPct}%`, background: 'rgb(248, 113, 113)', borderRadius: '2px' }} />}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 'clamp(2px, 0.15vw, 4px)',
          fontSize: 'clamp(9px, 0.65vw, 11px)',
          color: 'rgba(148, 163, 184, 0.7)',
        }}
      >
        <span>👍 {positive} ({Math.round(pPct)}%)</span>
        <span>👌 {neutral} ({Math.round(nPct)}%)</span>
        <span>👎 {negative} ({Math.round(negPct)}%)</span>
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function FeedbackPulseDashboard() {
  const [state, setState] = useState<FetchState>({ status: 'idle' });
  const [showStream, setShowStream] = useState(false);

  const fetchData = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const res = await fetch('/api/learning/feedback-summary');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { ok: boolean; data: FeedbackSummary | null };
      if (!json.ok || !json.data) {
        setState({ status: 'empty' });
        return;
      }
      setState({ status: 'ok', data: json.data });
    } catch (err) {
      setState({ status: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // ── Idle / Loading ──
  if (state.status === 'idle' || state.status === 'loading') {
    return (
      <div
        className="rounded-xl ring-1 ring-pink-500/20 bg-pink-500/5"
        style={{ padding: 'clamp(14px, 1.5vw, 20px)' }}
      >
        <div style={{ fontSize: 'clamp(12px, 1vw, 14px)', color: 'rgba(148,163,184,0.5)' }}>
          Loading feedback pulse…
        </div>
      </div>
    );
  }

  // ── Error ──
  if (state.status === 'error') {
    return (
      <div
        className="rounded-xl ring-1 ring-red-500/30 bg-red-500/5"
        style={{ padding: 'clamp(14px, 1.5vw, 20px)' }}
      >
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 'clamp(16px, 1.3vw, 20px)' }}>❌</span>
          <div>
            <div style={{ fontSize: 'clamp(12px, 1vw, 14px)', fontWeight: 600, color: 'rgb(248,113,113)' }}>
              Feedback Pulse Error
            </div>
            <div style={{ fontSize: 'clamp(10px, 0.8vw, 12px)', color: 'rgba(248,113,113,0.6)' }}>
              {state.message}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Empty ──
  if (state.status === 'empty') {
    return (
      <div
        className="rounded-xl ring-1 ring-pink-500/20 bg-pink-500/5"
        style={{ padding: 'clamp(14px, 1.5vw, 20px)' }}
      >
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 'clamp(16px, 1.3vw, 20px)' }}>💬</span>
          <div>
            <div style={{ fontSize: 'clamp(12px, 1vw, 14px)', fontWeight: 600, color: 'rgba(236,72,153,0.9)' }}>
              Feedback Pulse
            </div>
            <div style={{ fontSize: 'clamp(10px, 0.8vw, 12px)', color: 'rgba(148,163,184,0.5)' }}>
              No feedback data yet — users haven&apos;t rated any prompts.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── OK — full dashboard ──
  const { data } = state;

  // Compute overall weighted satisfaction
  const overallSat = data.platformSatisfaction.length > 0
    ? Math.round(
        data.platformSatisfaction.reduce((s, p) => s + p.score * p.eventCount, 0) /
        Math.max(data.platformSatisfaction.reduce((s, p) => s + p.eventCount, 0), 1),
      )
    : 0;

  return (
    <div
      className="rounded-xl ring-1 ring-pink-500/20 bg-pink-500/5"
      style={{ padding: 'clamp(14px, 1.5vw, 20px)' }}
      data-testid="feedback-pulse-dashboard"
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between" style={{ marginBottom: 'clamp(10px, 0.8vw, 14px)' }}>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 'clamp(16px, 1.3vw, 20px)' }}>💬</span>
          <div>
            <div style={{ fontSize: 'clamp(12px, 1vw, 14px)', fontWeight: 600, color: 'rgba(236,72,153,0.9)' }}>
              Feedback Pulse
            </div>
            <div style={{ fontSize: 'clamp(9px, 0.65vw, 11px)', color: 'rgba(148,163,184,0.5)' }}>
              Last updated {timeAgo(data.generatedAt)}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void fetchData()}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(148,163,184,0.5)',
            cursor: 'pointer',
            fontSize: 'clamp(12px, 1vw, 15px)',
          }}
          aria-label="Refresh feedback pulse"
        >
          ↻
        </button>
      </div>

      {/* ── Red Flags ── */}
      {data.redFlags.length > 0 && (
        <div style={{ marginBottom: 'clamp(8px, 0.6vw, 12px)' }}>
          {data.redFlags.map((flag, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'clamp(4px, 0.3vw, 6px)',
                padding: 'clamp(4px, 0.3vw, 6px) clamp(8px, 0.6vw, 10px)',
                borderRadius: 'clamp(4px, 0.3vw, 6px)',
                marginBottom: 'clamp(2px, 0.15vw, 4px)',
                background: flag.severity === 'critical' ? 'rgba(248,113,113,0.1)' : 'rgba(251,191,36,0.08)',
                border: `1px solid ${flag.severity === 'critical' ? 'rgba(248,113,113,0.3)' : 'rgba(251,191,36,0.25)'}`,
                fontSize: 'clamp(9px, 0.7vw, 11px)',
                color: flag.severity === 'critical' ? 'rgb(252,165,165)' : 'rgb(253,230,138)',
              }}
            >
              <span>{flag.severity === 'critical' ? '🔴' : '🟡'}</span>
              <span>{flag.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Velocity + Satisfaction Row ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'clamp(8px, 0.6vw, 12px)',
          marginBottom: 'clamp(8px, 0.6vw, 12px)',
        }}
      >
        {/* Velocity */}
        <div
          style={{
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 'clamp(6px, 0.4vw, 8px)',
            padding: 'clamp(8px, 0.6vw, 12px)',
          }}
        >
          <div style={{ fontSize: 'clamp(9px, 0.65vw, 11px)', color: 'rgba(148,163,184,0.5)', marginBottom: 'clamp(2px, 0.15vw, 4px)', letterSpacing: '0.05em' }}>
            VELOCITY
          </div>
          <div style={{ display: 'flex', gap: 'clamp(10px, 0.8vw, 16px)', alignItems: 'baseline' }}>
            <div>
              <span style={{ fontSize: 'clamp(18px, 1.5vw, 24px)', fontWeight: 700, color: 'rgb(236,72,153)' }}>
                {data.velocity.today}
              </span>
              <span style={{ fontSize: 'clamp(9px, 0.65vw, 11px)', color: 'rgba(148,163,184,0.5)', marginLeft: '3px' }}>today</span>
            </div>
            <div style={{ fontSize: 'clamp(10px, 0.8vw, 12px)', color: 'rgba(148,163,184,0.6)' }}>
              {data.velocity.thisWeek} / wk
            </div>
            <div style={{ fontSize: 'clamp(10px, 0.8vw, 12px)', color: 'rgba(148,163,184,0.4)' }}>
              {data.velocity.allTime} total
            </div>
          </div>
          <div style={{ marginTop: 'clamp(4px, 0.3vw, 6px)' }}>
            <MiniSparkline data={data.dailySpark} />
          </div>
        </div>

        {/* Satisfaction Score */}
        <div
          style={{
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 'clamp(6px, 0.4vw, 8px)',
            padding: 'clamp(8px, 0.6vw, 12px)',
          }}
        >
          <div style={{ fontSize: 'clamp(9px, 0.65vw, 11px)', color: 'rgba(148,163,184,0.5)', marginBottom: 'clamp(2px, 0.15vw, 4px)', letterSpacing: '0.05em' }}>
            SATISFACTION
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'clamp(4px, 0.3vw, 6px)' }}>
            <span
              style={{
                fontSize: 'clamp(24px, 2vw, 32px)',
                fontWeight: 700,
                color: satColor(overallSat),
              }}
            >
              {overallSat}
            </span>
            <span style={{ fontSize: 'clamp(11px, 0.9vw, 14px)', color: 'rgba(148,163,184,0.5)' }}>/100</span>
          </div>
          {/* Per-platform mini scores */}
          <div style={{ marginTop: 'clamp(4px, 0.3vw, 8px)', display: 'flex', flexWrap: 'wrap', gap: 'clamp(4px, 0.3vw, 6px)' }}>
            {data.platformSatisfaction.slice(0, 6).map((p) => (
              <span
                key={p.platform}
                style={{
                  fontSize: 'clamp(8px, 0.6vw, 10px)',
                  padding: 'clamp(1px, 0.1vw, 2px) clamp(4px, 0.3vw, 6px)',
                  borderRadius: '3px',
                  background: 'rgba(255,255,255,0.05)',
                  color: satColor(p.score),
                }}
              >
                {p.platform}: {p.score}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Sentiment Bar ── */}
      <div style={{ marginBottom: 'clamp(8px, 0.6vw, 12px)' }}>
        <SentimentBar
          positive={data.sentiment.positive}
          neutral={data.sentiment.neutral}
          negative={data.sentiment.negative}
        />
      </div>

      {/* ── Recent Stream Toggle ── */}
      <button
        type="button"
        onClick={() => setShowStream(!showStream)}
        style={{
          background: 'none',
          border: 'none',
          color: 'rgba(236,72,153,0.7)',
          cursor: 'pointer',
          fontSize: 'clamp(10px, 0.8vw, 12px)',
          padding: 0,
        }}
      >
        {showStream ? '▾ Hide' : '▸ Show'} recent stream ({data.recentEvents.length})
      </button>

      {/* ── Recent Stream ── */}
      {showStream && data.recentEvents.length > 0 && (
        <div
          style={{
            marginTop: 'clamp(6px, 0.4vw, 8px)',
            maxHeight: 'clamp(150px, 12vw, 250px)',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 'clamp(2px, 0.15vw, 3px)',
          }}
        >
          {data.recentEvents.map((ev) => (
            <div
              key={ev.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'clamp(6px, 0.4vw, 8px)',
                padding: 'clamp(3px, 0.2vw, 5px) clamp(6px, 0.4vw, 8px)',
                borderRadius: 'clamp(3px, 0.2vw, 5px)',
                background: ratingColor(ev.rating),
                fontSize: 'clamp(9px, 0.7vw, 11px)',
              }}
            >
              <span style={{ fontSize: 'clamp(10px, 0.8vw, 13px)' }}>{ratingEmoji(ev.rating)}</span>
              <span style={{ color: 'rgba(255,255,255,0.7)', minWidth: 'clamp(60px, 5vw, 80px)' }}>
                {ev.platform}
              </span>
              <span style={{ color: 'rgba(148,163,184,0.5)' }}>
                T{ev.tier}
              </span>
              <span style={{ color: 'rgba(148,163,184,0.4)' }}>
                cred: {ev.credibilityScore.toFixed(2)}
              </span>
              {ev.userTier && (
                <span
                  style={{
                    color: ev.userTier === 'paid' ? 'rgba(251,191,36,0.7)' : 'rgba(148,163,184,0.4)',
                    fontSize: 'clamp(8px, 0.55vw, 10px)',
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.05em',
                  }}
                >
                  {ev.userTier}
                </span>
              )}
              <span style={{ marginLeft: 'auto', color: 'rgba(148,163,184,0.35)' }}>
                {timeAgo(ev.createdAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default FeedbackPulseDashboard;
