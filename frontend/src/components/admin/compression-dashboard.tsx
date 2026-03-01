/**
 * CompressionDashboard — Admin Pipeline Health Widget
 * ====================================================
 * Phase 7.9e — Shows compression intelligence pipeline status.
 * Phase 7.9f — Added history sparkline for optimal length drift tracking.
 *
 * Fetches /api/learning/compression-profiles and displays:
 *   • Data freshness (last generated timestamp)
 *   • Per-tier optimal length profiles with mini sparkline history
 *   • Top expendable terms per tier
 *   • Platform-specific length deltas
 *
 * Client-side only — renders in admin dashboard.
 *
 * @version 1.1.0
 * @created 2026-02-28
 *
 * Existing features preserved: Yes.
 */

'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import type {
  CompressionProfilesData,
  OptimalLengthProfile,
  ExpendableTerm,
  TierPlatformLengthData,
  PlatformLengthProfile,
} from '@/lib/learning/compression-intelligence';

// ============================================================================
// TYPES
// ============================================================================

interface ApiResponse {
  ok: boolean;
  data: CompressionProfilesData | null;
  updatedAt: string | null;
  message?: string;
}

type FetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty'; message: string }
  | { status: 'ok'; data: CompressionProfilesData; updatedAt: string };

// ============================================================================
// SPARKLINE HISTORY (Phase 7.9f)
// ============================================================================
// Stores the last N optimal length values per tier in sessionStorage so
// the admin can see drift across page refreshes during a session.
// Format: { "1": [180, 185, 182, ...], "2": [...], ... }
// ============================================================================

const HISTORY_KEY = 'promagen:compression:history';
const MAX_HISTORY = 12;

interface SparkHistory {
  [tier: string]: number[];
}

function loadHistory(): SparkHistory {
  try {
    const raw = sessionStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as SparkHistory) : {};
  } catch {
    return {};
  }
}

function appendHistory(data: CompressionProfilesData): SparkHistory {
  const history = loadHistory();
  for (const tierKey of Object.keys(data.lengthProfiles)) {
    const profile = data.lengthProfiles[tierKey];
    if (!profile) continue;
    if (!history[tierKey]) history[tierKey] = [];
    const arr = history[tierKey]!;
    // Avoid duplicate consecutive values (same cron run)
    if (arr.length === 0 || arr[arr.length - 1] !== profile.optimalChars) {
      arr.push(profile.optimalChars);
      if (arr.length > MAX_HISTORY) arr.shift();
    }
  }
  try {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // sessionStorage full — ignore
  }
  return history;
}

// ============================================================================
// HELPERS
// ============================================================================

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function freshnessColour(iso: string): string {
  const ageMs = Date.now() - new Date(iso).getTime();
  const hours = ageMs / (1000 * 60 * 60);
  if (hours < 12) return 'text-emerald-400';
  if (hours < 36) return 'text-amber-400';
  return 'text-rose-400';
}

// ============================================================================
// MINI SPARKLINE (SVG)
// ============================================================================

function MiniSparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;

  const w = 60;
  const h = 16;
  const pad = 1;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (w - 2 * pad);
      const y = pad + (1 - (v - min) / range) * (h - 2 * pad);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="inline-block ml-2"
      aria-label={`Sparkline: ${values.join(', ')}`}
    >
      <polyline
        points={points}
        fill="none"
        stroke="rgba(56,189,248,0.6)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Endpoint dot */}
      {(() => {
        const lastX = pad + ((values.length - 1) / (values.length - 1)) * (w - 2 * pad);
        const lastY = pad + (1 - (values[values.length - 1]! - min) / range) * (h - 2 * pad);
        return <circle cx={lastX} cy={lastY} r="2" fill="rgba(56,189,248,0.9)" />;
      })()}
    </svg>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CompressionDashboard() {
  const [state, setState] = useState<FetchState>({ status: 'idle' });
  const historyRef = useRef<SparkHistory>({});

  const fetchData = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const res = await fetch('/api/learning/compression-profiles');
      if (!res.ok) {
        setState({ status: 'error', message: `HTTP ${res.status}` });
        return;
      }
      const json = (await res.json()) as ApiResponse;
      if (!json.ok) {
        setState({ status: 'error', message: json.message ?? 'API returned ok=false' });
        return;
      }
      if (!json.data || !json.updatedAt) {
        setState({ status: 'empty', message: json.message ?? 'No compression data — cron has not run yet.' });
        return;
      }
      // Append to sparkline history
      historyRef.current = appendHistory(json.data);
      setState({ status: 'ok', data: json.data, updatedAt: json.updatedAt });
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Fetch failed',
      });
    }
  }, []);

  useEffect(() => {
    // Load existing history on mount
    historyRef.current = loadHistory();
    fetchData();
  }, [fetchData]);

  // ── Idle / Loading ──────────────────────────────────────────────────
  if (state.status === 'idle' || state.status === 'loading') {
    return (
      <DashboardShell title="Compression Intelligence">
        <p className="text-white/40 animate-pulse" style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}>
          Loading compression profiles…
        </p>
      </DashboardShell>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────
  if (state.status === 'error') {
    return (
      <DashboardShell title="Compression Intelligence">
        <p className="text-rose-400" style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}>
          ⚠ {state.message}
        </p>
        <RefreshButton onClick={fetchData} />
      </DashboardShell>
    );
  }

  // ── Empty (cron hasn't run) ─────────────────────────────────────────
  if (state.status === 'empty') {
    return (
      <DashboardShell title="Compression Intelligence">
        <p className="text-white/40" style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}>
          {state.message}
        </p>
        <RefreshButton onClick={fetchData} />
      </DashboardShell>
    );
  }

  // ── OK — render data ───────────────────────────────────────────────
  const { data, updatedAt } = state;
  const tierKeys = Object.keys(data.lengthProfiles).sort();
  const history = historyRef.current;

  return (
    <DashboardShell title="Compression Intelligence">
      {/* Freshness badge */}
      <div className="flex items-center justify-between mb-3">
        <span
          className={`font-medium ${freshnessColour(updatedAt)}`}
          style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}
        >
          ● Updated {timeAgo(updatedAt)}
        </span>
        <RefreshButton onClick={fetchData} />
      </div>

      {/* Per-tier cards */}
      <div className="space-y-3">
        {tierKeys.map((tierKey) => {
          const lengthProfile: OptimalLengthProfile | undefined = data.lengthProfiles[tierKey];
          const expendable: ExpendableTerm[] = data.expendableTerms[tierKey] ?? [];
          const platformData: TierPlatformLengthData | undefined = data.platformLengthProfiles[tierKey];
          const tierNum = Number(tierKey);
          const sparkValues = history[tierKey] ?? [];

          return (
            <div
              key={tierKey}
              className="rounded-lg border border-white/10 bg-white/[0.02]"
              style={{ padding: 'clamp(8px, 0.8vw, 12px)' }}
            >
              {/* Tier header */}
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="inline-flex items-center justify-center rounded-full bg-white/10 text-white/60 font-bold"
                  style={{
                    width: 'clamp(18px, 1.6vw, 22px)',
                    height: 'clamp(18px, 1.6vw, 22px)',
                    fontSize: 'clamp(9px, 0.8vw, 11px)',
                  }}
                >
                  T{tierNum}
                </span>
                <span className="text-white/80 font-semibold" style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}>
                  Tier {tierNum}
                </span>
                <span className="ml-auto text-white/30" style={{ fontSize: 'clamp(9px, 0.8vw, 11px)' }}>
                  {lengthProfile ? `${lengthProfile.eventCount.toLocaleString()} events` : 'no data'}
                </span>
              </div>

              {/* Optimal length + sparkline */}
              {lengthProfile && (
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-white/40" style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}>
                    Optimal:
                  </span>
                  <span className="text-emerald-400 font-mono font-medium" style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}>
                    {lengthProfile.optimalChars} chars
                  </span>
                  <span className="text-white/20" style={{ fontSize: 'clamp(9px, 0.8vw, 11px)' }}>
                    (diminishing at {lengthProfile.diminishingReturnsAt})
                  </span>
                  {/* Phase 7.9f: Sparkline history */}
                  <MiniSparkline values={sparkValues} />
                </div>
              )}

              {/* Platform profiles */}
              {platformData && platformData.platforms.length > 0 && (
                <div className="mb-1">
                  <span className="text-white/40" style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}>
                    Platforms:
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {platformData.platforms.slice(0, 5).map((p: PlatformLengthProfile) => (
                      <span
                        key={p.platformId}
                        className="inline-flex items-center rounded-full bg-white/5 text-white/50"
                        style={{
                          padding: 'clamp(1px, 0.1vw, 2px) clamp(6px, 0.5vw, 8px)',
                          fontSize: 'clamp(9px, 0.8vw, 11px)',
                        }}
                      >
                        {p.platformId}
                        <span className={`ml-1 font-mono ${p.deltaFromTier > 0 ? 'text-amber-400' : 'text-cyan-400'}`}>
                          {p.deltaFromTier > 0 ? '+' : ''}{p.deltaFromTier}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Expendable terms */}
              {expendable.length > 0 && (
                <div>
                  <span className="text-white/40" style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}>
                    Expendable ({expendable.length}):
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {expendable.slice(0, 8).map((t: ExpendableTerm) => (
                      <span
                        key={t.term}
                        className="inline-flex items-center rounded-full text-white/50"
                        style={{
                          padding: 'clamp(1px, 0.1vw, 2px) clamp(6px, 0.5vw, 8px)',
                          fontSize: 'clamp(9px, 0.8vw, 11px)',
                          background:
                            t.expendability >= 0.7
                              ? 'rgba(244,63,94,0.15)'
                              : t.expendability >= 0.5
                                ? 'rgba(245,158,11,0.15)'
                                : 'rgba(100,116,139,0.15)',
                          borderBottom:
                            t.expendability >= 0.7
                              ? '2px solid rgba(244,63,94,0.5)'
                              : t.expendability >= 0.5
                                ? '2px solid rgba(245,158,11,0.4)'
                                : '2px solid rgba(100,116,139,0.2)',
                        }}
                      >
                        {t.term}
                        <span className="ml-1 font-mono text-white/30">
                          {(t.expendability * 100).toFixed(0)}%
                        </span>
                      </span>
                    ))}
                    {expendable.length > 8 && (
                      <span className="text-white/20" style={{ fontSize: 'clamp(9px, 0.8vw, 11px)' }}>
                        +{expendable.length - 8} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Global stats */}
      <div
        className="mt-3 flex items-center gap-4 text-white/30"
        style={{ fontSize: 'clamp(9px, 0.8vw, 11px)' }}
      >
        <span>v{data.version}</span>
        <span>{data.totalEventsAnalysed.toLocaleString()} total events</span>
        <span>{tierKeys.length} tiers</span>
      </div>
    </DashboardShell>
  );
}

// ============================================================================
// SHELL + BUTTON
// ============================================================================

function DashboardShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl ring-1 ring-cyan-500/30 bg-cyan-500/[0.06]"
      style={{ padding: 'clamp(12px, 1.2vw, 18px)' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span style={{ fontSize: 'clamp(14px, 1.4vw, 20px)' }}>📦</span>
        <h3
          className="font-semibold text-white/80"
          style={{ fontSize: 'clamp(12px, 1.1vw, 14px)' }}
        >
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

function RefreshButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-white/30 hover:text-white/60 transition-colors"
      style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}
      title="Refresh compression data"
    >
      ↻ Refresh
    </button>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default CompressionDashboard;
