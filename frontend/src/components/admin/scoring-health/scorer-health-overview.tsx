'use client';

// src/components/admin/scoring-health/scorer-health-overview.tsx
// ============================================================================
// SCORER HEALTH OVERVIEW — Section 1 of the Scoring Health Dashboard
// ============================================================================
//
// The "at-a-glance" hero panel. Displays:
//   - Score-outcome correlation (current value + trend + sparkline)
//   - Total prompts logged (counter + weekly delta)
//   - Active A/B tests (running / pending / concluded)
//   - Last cron run (timestamp + duration + success/fail)
//   - Pipeline uptime (30-day percentage)
//   - Quick Pulse (traffic-light dots)
//
// Self-contained data fetcher — polls /api/admin/scoring-health/overview
// every 5 minutes. No props required.
//
// All sizing via clamp(). No charting libraries. CSS-only sparkline.
//
// Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md § 4
//
// Version: 1.0.0
// Created: 2026-03-01
//
// Existing features preserved: Yes (new component, no existing code changed).
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  ScorerHealthOverviewData,
  ScoringHealthApiResponse,
  PulseStatus,
} from '@/lib/admin/scoring-health-types';
import { formatTrend, formatRelativeTime, REFRESH_INTERVALS } from '@/lib/admin/scoring-health-types';
import { CssSparkline } from './css-sparkline';

// ============================================================================
// STATE MACHINE
// ============================================================================

type LoadState = 'loading' | 'ready' | 'error' | 'empty';

// ============================================================================
// CONSTANTS
// ============================================================================

const POLL_MS = REFRESH_INTERVALS.overview ?? 5 * 60 * 1_000; // 5 minutes

const PULSE_ICONS: Record<PulseStatus, { icon: string; colour: string }> = {
  healthy:  { icon: '●', colour: 'text-emerald-400' },
  warning:  { icon: '●', colour: 'text-amber-400' },
  critical: { icon: '●', colour: 'text-red-400' },
  unknown:  { icon: '●', colour: 'text-white/20' },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function ScorerHealthOverview() {
  const [state, setState] = useState<LoadState>('loading');
  const [data, setData] = useState<ScorerHealthOverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch data ──────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/scoring-health/overview', {
        cache: 'no-store',
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const json: ScoringHealthApiResponse<ScorerHealthOverviewData> = await res.json();

      if (!json.ok || !json.data) {
        setState('empty');
        setData(null);
        setError(json.message ?? 'No data available');
        return;
      }

      setData(json.data);
      setState('ready');
      setError(null);
      setLastRefresh(new Date().toISOString());
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    }
  }, []);

  // ── Initial fetch + polling ─────────────────────────────────────────
  useEffect(() => {
    fetchData();

    if (POLL_MS > 0) {
      timerRef.current = setInterval(fetchData, POLL_MS);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchData]);

  // ── Loading state ───────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <div className="rounded-xl bg-white/5 ring-1 ring-white/10" style={{ padding: 'clamp(16px, 2vw, 24px)' }}>
        <SectionHeader />
        <div className="flex items-center justify-center" style={{ minHeight: 'clamp(120px, 15vw, 200px)' }}>
          <span className="animate-pulse text-white/30" style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}>
            Loading scorer health data…
          </span>
        </div>
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <div className="rounded-xl bg-red-500/5 ring-1 ring-red-500/20" style={{ padding: 'clamp(16px, 2vw, 24px)' }}>
        <SectionHeader />
        <div
          className="flex flex-col items-center justify-center"
          style={{ minHeight: 'clamp(120px, 15vw, 200px)', gap: 'clamp(8px, 1vw, 12px)' }}
        >
          <span className="text-red-400" style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}>
            ❌ {error}
          </span>
          <button
            onClick={fetchData}
            className="rounded-md bg-white/5 text-white/50 transition-colors hover:bg-white/10 hover:text-white/70"
            style={{
              fontSize: 'clamp(10px, 0.9vw, 12px)',
              padding: 'clamp(4px, 0.4vw, 6px) clamp(10px, 1vw, 14px)',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Empty state (no data yet) ───────────────────────────────────────
  if (state === 'empty' || !data) {
    return (
      <div className="rounded-xl bg-white/5 ring-1 ring-white/10" style={{ padding: 'clamp(16px, 2vw, 24px)' }}>
        <SectionHeader />
        <div className="flex items-center justify-center" style={{ minHeight: 'clamp(120px, 15vw, 200px)' }}>
          <span className="text-white/30" style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}>
            ⚪ {error ?? 'No scoring data yet — cron has not run.'}
          </span>
        </div>
      </div>
    );
  }

  // ── Ready state — render dashboard ──────────────────────────────────
  const trend = formatTrend(data.correlationTrend);
  const cronAge = formatRelativeTime(data.lastCron.timestamp);

  return (
    <div className="rounded-xl bg-white/5 ring-1 ring-white/10" style={{ padding: 'clamp(16px, 2vw, 24px)' }}>
      <SectionHeader lastRefresh={lastRefresh} onRefresh={fetchData} />

      {/* ── Metric Cards Grid ──────────────────────────────────────── */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(clamp(140px, 14vw, 200px), 1fr))',
          gap: 'clamp(10px, 1.2vw, 16px)',
          marginTop: 'clamp(12px, 1.5vw, 20px)',
        }}
      >
        {/* ── Score-Outcome Correlation ─────────────────────────────── */}
        <MetricCard
          label="Score-Outcome Correlation"
          value={data.correlation.toFixed(3)}
          subValue={
            <span
              className={
                trend.direction === 'up'
                  ? 'text-emerald-400'
                  : trend.direction === 'down'
                    ? 'text-red-400'
                    : 'text-white/30'
              }
            >
              {trend.text}
            </span>
          }
          footer={
            <CssSparkline
              points={data.correlationHistory}
              height="clamp(20px, 2.5vw, 32px)"
              label="Correlation history"
            />
          }
        />

        {/* ── Total Prompts ────────────────────────────────────────── */}
        <MetricCard
          label="Total Prompts Logged"
          value={data.totalPrompts.toLocaleString()}
          subValue={
            <span className={data.weeklyDelta > 0 ? 'text-emerald-400/70' : 'text-white/30'}>
              {data.weeklyDelta > 0 ? `+${data.weeklyDelta.toLocaleString()}` : data.weeklyDelta.toLocaleString()} this week
            </span>
          }
        />

        {/* ── Active A/B Tests ─────────────────────────────────────── */}
        <MetricCard
          label="A/B Tests"
          value={String(data.abTests.running + data.abTests.pending + data.abTests.concluded)}
          subValue={
            <div className="flex flex-wrap" style={{ gap: 'clamp(4px, 0.4vw, 6px)' }}>
              <StatusBadge count={data.abTests.running} label="running" colour="bg-emerald-500/20 text-emerald-400" />
              <StatusBadge count={data.abTests.pending} label="pending" colour="bg-amber-500/20 text-amber-400" />
              <StatusBadge count={data.abTests.concluded} label="concluded" colour="bg-white/10 text-white/40" />
            </div>
          }
        />

        {/* ── Last Cron Run ────────────────────────────────────────── */}
        <MetricCard
          label="Last Cron Run"
          value={cronAge}
          subValue={
            <div className="flex items-center" style={{ gap: 'clamp(4px, 0.4vw, 6px)' }}>
              {data.lastCron.durationSeconds !== null && (
                <span className="text-white/30" style={{ fontSize: 'clamp(9px, 0.8vw, 11px)' }}>
                  {data.lastCron.durationSeconds.toFixed(1)}s
                </span>
              )}
              <span
                className={data.lastCron.success ? 'text-emerald-400' : 'text-red-400'}
                style={{ fontSize: 'clamp(9px, 0.8vw, 11px)' }}
              >
                {data.lastCron.success ? '✅ Success' : '❌ Failed'}
              </span>
            </div>
          }
        />

        {/* ── Pipeline Uptime ──────────────────────────────────────── */}
        <MetricCard
          label="Pipeline Uptime"
          value={`${data.pipelineUptime.toFixed(1)}%`}
          subValue={
            <span className="text-white/30" style={{ fontSize: 'clamp(9px, 0.8vw, 11px)' }}>
              Last 30 days
            </span>
          }
          footer={
            <div
              className="w-full overflow-hidden rounded-full bg-white/5"
              style={{ height: 'clamp(4px, 0.4vw, 6px)' }}
            >
              <div
                className={`h-full rounded-full transition-all ${
                  data.pipelineUptime >= 99 ? 'bg-emerald-500' : data.pipelineUptime >= 95 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(data.pipelineUptime, 100)}%` }}
              />
            </div>
          }
        />
      </div>

      {/* ── Quick Pulse ────────────────────────────────────────────── */}
      {data.pulse.length > 0 && (
        <div
          className="flex flex-wrap items-center border-t border-white/5"
          style={{
            marginTop: 'clamp(12px, 1.5vw, 20px)',
            paddingTop: 'clamp(10px, 1.2vw, 16px)',
            gap: 'clamp(10px, 1.2vw, 16px)',
          }}
        >
          <span
            className="text-white/30"
            style={{ fontSize: 'clamp(9px, 0.8vw, 11px)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
          >
            Quick Pulse
          </span>
          {data.pulse.map((p) => {
            const icon = PULSE_ICONS[p.status];
            return (
              <span
                key={p.label}
                className="flex items-center"
                style={{ gap: 'clamp(3px, 0.3vw, 5px)' }}
                title={p.detail ?? `${p.label}: ${p.status}`}
              >
                <span className={icon.colour} style={{ fontSize: 'clamp(8px, 0.7vw, 10px)' }}>
                  {icon.icon}
                </span>
                <span className="text-white/50" style={{ fontSize: 'clamp(9px, 0.8vw, 11px)' }}>
                  {p.label}
                </span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/** Section header with title and refresh indicator */
function SectionHeader({
  lastRefresh,
  onRefresh,
}: {
  lastRefresh?: string | null;
  onRefresh?: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <h3
        className="font-semibold uppercase tracking-wider text-white/60"
        style={{ fontSize: 'clamp(11px, 1vw, 13px)', letterSpacing: '0.05em' }}
      >
        Scorer Health Overview
      </h3>
      <div className="flex items-center" style={{ gap: 'clamp(6px, 0.6vw, 10px)' }}>
        {lastRefresh && (
          <span className="text-white/20" style={{ fontSize: 'clamp(8px, 0.7vw, 10px)' }}>
            {formatRelativeTime(lastRefresh)}
          </span>
        )}
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="text-white/20 transition-colors hover:text-white/50"
            style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}
            title="Refresh now"
          >
            ⟳
          </button>
        )}
        <span className="text-white/15" style={{ fontSize: 'clamp(8px, 0.7vw, 10px)' }}>
          5m auto
        </span>
      </div>
    </div>
  );
}

/** Single metric card within the overview grid */
function MetricCard({
  label,
  value,
  subValue,
  footer,
}: {
  label: string;
  value: string;
  subValue?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col rounded-lg bg-white/[0.03] ring-1 ring-white/[0.06]"
      style={{ padding: 'clamp(10px, 1.2vw, 16px)', gap: 'clamp(4px, 0.4vw, 6px)' }}
    >
      <span
        className="text-white/30"
        style={{ fontSize: 'clamp(9px, 0.8vw, 11px)', textTransform: 'uppercase', letterSpacing: '0.03em' }}
      >
        {label}
      </span>
      <span
        className="font-semibold text-white/90"
        style={{ fontSize: 'clamp(18px, 2vw, 28px)' }}
      >
        {value}
      </span>
      {subValue && (
        <div style={{ fontSize: 'clamp(9px, 0.85vw, 11px)' }}>
          {subValue}
        </div>
      )}
      {footer && (
        <div style={{ marginTop: 'clamp(4px, 0.4vw, 6px)' }}>
          {footer}
        </div>
      )}
    </div>
  );
}

/** Small status badge (e.g., "3 running") */
function StatusBadge({
  count,
  label,
  colour,
}: {
  count: number;
  label: string;
  colour: string;
}) {
  if (count === 0) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full ${colour}`}
      style={{
        fontSize: 'clamp(8px, 0.7vw, 10px)',
        padding: 'clamp(1px, 0.1vw, 2px) clamp(5px, 0.5vw, 8px)',
      }}
    >
      {count} {label}
    </span>
  );
}
