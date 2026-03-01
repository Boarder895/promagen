'use client';

// src/components/admin/scoring-health/anomaly-alert-banner.tsx
// ============================================================================
// ANOMALY ALERT BANNER — Persistent top-of-page health indicator
// ============================================================================
//
// Displays:
//   - 🟢 "All Systems Healthy" if no anomalies
//   - 🔴/🟡/🔵 Anomaly count + expandable detail cards
//   - Each card: title, detail, severity icon, "Jump to ↓" drill-through,
//     "Acknowledge" to dismiss (session-only, reappears on reload)
//
// Auto-refreshes every 60 seconds (more frequent than section panels).
//
// Drill-Through: "Jump to" smooth-scrolls to the target section and adds
// a temporary ring-pulse CSS animation to visually highlight it.
//
// Data: GET /api/admin/scoring-health/anomalies
//
// Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md § 10
//
// Version: 1.0.0
// Created: 2026-03-01
//
// Existing features preserved: Yes (new component).
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import type { Anomaly, AnomalySeverity } from '@/lib/admin/anomaly-thresholds';

// ============================================================================
// CONSTANTS
// ============================================================================

const REFRESH_INTERVAL_MS = 60_000; // 60 seconds

const SEVERITY_CONFIG: Record<AnomalySeverity, {
  icon: string;
  ringColour: string;
  bgColour: string;
  textColour: string;
  badgeBg: string;
}> = {
  critical: {
    icon: '🔴',
    ringColour: 'ring-red-500/30',
    bgColour: 'bg-red-500/5',
    textColour: 'text-red-400',
    badgeBg: 'bg-red-500/20',
  },
  warning: {
    icon: '🟡',
    ringColour: 'ring-amber-500/30',
    bgColour: 'bg-amber-500/5',
    textColour: 'text-amber-400',
    badgeBg: 'bg-amber-500/20',
  },
  info: {
    icon: '🔵',
    ringColour: 'ring-blue-500/30',
    bgColour: 'bg-blue-500/5',
    textColour: 'text-blue-400',
    badgeBg: 'bg-blue-500/20',
  },
};

// ============================================================================
// DRILL-THROUGH: Smooth scroll + pulse highlight
// ============================================================================

function drillToSection(sectionId: string): void {
  const el = document.getElementById(sectionId);
  if (!el) return;

  el.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Add a temporary pulse ring highlight
  el.classList.add('ring-2', 'ring-violet-500/50', 'rounded-xl', 'transition-all');
  setTimeout(() => {
    el.classList.remove('ring-2', 'ring-violet-500/50', 'rounded-xl', 'transition-all');
  }, 2500);
}

// ============================================================================
// ANOMALY CARD
// ============================================================================

function AnomalyCard({
  anomaly,
  onAcknowledge,
}: {
  anomaly: Anomaly;
  onAcknowledge: (id: string) => void;
}) {
  const config = SEVERITY_CONFIG[anomaly.severity];
  const [expanded, setExpanded] = useState(anomaly.severity === 'critical');

  return (
    <div
      className={`rounded-lg ring-1 ${config.ringColour} ${config.bgColour}`}
      style={{ padding: 'clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)' }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between" style={{ gap: 'clamp(6px, 0.6vw, 8px)' }}>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex min-w-0 flex-1 items-start text-left"
          style={{ gap: 'clamp(6px, 0.6vw, 8px)' }}
        >
          <span style={{ fontSize: 'clamp(12px, 1.1vw, 15px)', lineHeight: 1 }}>
            {config.icon}
          </span>
          <div className="min-w-0 flex-1">
            <span
              className={`font-semibold ${config.textColour}`}
              style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}
            >
              {anomaly.severity.toUpperCase()}:
            </span>{' '}
            <span
              className="text-white/70"
              style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}
            >
              {anomaly.title}
            </span>
          </div>
          <span
            className="flex-shrink-0 text-white/20"
            style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}
          >
            {expanded ? '▾' : '▸'}
          </span>
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div
          className="mt-2 border-t border-white/5"
          style={{ paddingTop: 'clamp(6px, 0.6vw, 8px)', marginLeft: 'clamp(18px, 1.8vw, 24px)' }}
        >
          <p
            className="text-white/40"
            style={{ fontSize: 'clamp(10px, 0.9vw, 12px)', marginBottom: 'clamp(6px, 0.6vw, 8px)' }}
          >
            {anomaly.detail}
          </p>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center" style={{ gap: 'clamp(6px, 0.6vw, 8px)' }}>
            <button
              type="button"
              onClick={() => drillToSection(anomaly.jumpTo)}
              className="rounded-md bg-white/5 text-white/60 transition-colors hover:bg-white/10 hover:text-white/80"
              style={{
                fontSize: 'clamp(9px, 0.85vw, 11px)',
                padding: 'clamp(3px, 0.3vw, 4px) clamp(8px, 0.8vw, 12px)',
              }}
            >
              Jump to {anomaly.jumpLabel} ↓
            </button>
            <button
              type="button"
              onClick={() => onAcknowledge(anomaly.id)}
              className="rounded-md bg-white/[0.03] text-white/30 transition-colors hover:bg-white/5 hover:text-white/50"
              style={{
                fontSize: 'clamp(9px, 0.85vw, 11px)',
                padding: 'clamp(3px, 0.3vw, 4px) clamp(8px, 0.8vw, 12px)',
              }}
            >
              Acknowledge
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// API RESPONSE TYPE
// ============================================================================

interface AnomalyApiResponse {
  anomalies: Anomaly[];
  sourcesChecked: number;
  sourcesFailed: number;
  generatedAt: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AnomalyAlertBanner() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState<string | null>(null);
  const [sourcesFailed, setSourcesFailed] = useState(0);
  const [expanded, setExpanded] = useState(true);

  const fetchAnomalies = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/scoring-health/anomalies');
      const json = (await res.json()) as { ok: boolean; data: AnomalyApiResponse | null };
      if (json.ok && json.data) {
        setAnomalies(json.data.anomalies);
        setLastCheck(json.data.generatedAt);
        setSourcesFailed(json.data.sourcesFailed);
      }
    } catch {
      // Silently fail — banner stays with last data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchAnomalies(); }, [fetchAnomalies]);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(() => { void fetchAnomalies(); }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchAnomalies]);

  const handleAcknowledge = useCallback((id: string) => {
    setAcknowledged((prev) => new Set(prev).add(id));
  }, []);

  // Filter out acknowledged anomalies
  const visible = anomalies.filter((a) => !acknowledged.has(a.id));
  const hasCritical = visible.some((a) => a.severity === 'critical');
  const hasWarning = visible.some((a) => a.severity === 'warning');

  // Determine banner colour
  const bannerColour = hasCritical
    ? 'ring-red-500/30 bg-red-500/5'
    : hasWarning
      ? 'ring-amber-500/30 bg-amber-500/5'
      : visible.length > 0
        ? 'ring-blue-500/20 bg-blue-500/5'
        : 'ring-emerald-500/20 bg-emerald-500/5';

  const lastCheckLabel = lastCheck
    ? (() => {
        const sec = Math.round((Date.now() - new Date(lastCheck).getTime()) / 1000);
        if (sec < 60) return `${sec}s ago`;
        return `${Math.round(sec / 60)}m ago`;
      })()
    : '…';

  // Don't render anything while loading initial data
  if (loading) {
    return (
      <div
        className="animate-pulse rounded-xl bg-white/[0.03] ring-1 ring-white/5"
        style={{ padding: 'clamp(10px, 1vw, 14px) clamp(14px, 1.4vw, 20px)' }}
      >
        <span className="text-white/20" style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}>
          Checking pipeline health…
        </span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl ring-1 ${bannerColour}`}
      style={{ padding: 'clamp(10px, 1vw, 14px) clamp(14px, 1.4vw, 20px)' }}
    >
      {/* ── Banner Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center text-left"
          style={{ gap: 'clamp(6px, 0.6vw, 8px)' }}
        >
          {visible.length === 0 ? (
            <>
              <span style={{ fontSize: 'clamp(13px, 1.2vw, 16px)' }}>✅</span>
              <span
                className="font-semibold text-emerald-400/80"
                style={{ fontSize: 'clamp(12px, 1.1vw, 15px)' }}
              >
                All Systems Healthy
              </span>
            </>
          ) : (
            <>
              <span style={{ fontSize: 'clamp(13px, 1.2vw, 16px)' }}>
                {hasCritical ? '🚨' : hasWarning ? '⚠️' : 'ℹ️'}
              </span>
              <span
                className={`font-semibold ${hasCritical ? 'text-red-400' : hasWarning ? 'text-amber-400' : 'text-blue-400'}`}
                style={{ fontSize: 'clamp(12px, 1.1vw, 15px)' }}
              >
                {visible.length} {visible.length === 1 ? 'ANOMALY' : 'ANOMALIES'} DETECTED
              </span>
              {/* Severity breakdown chips */}
              <div className="flex items-center" style={{ gap: 'clamp(3px, 0.3vw, 5px)', marginLeft: 'clamp(4px, 0.4vw, 6px)' }}>
                {hasCritical && (
                  <span
                    className="rounded-full bg-red-500/20 font-mono text-red-400"
                    style={{ fontSize: 'clamp(8px, 0.75vw, 10px)', padding: '0 clamp(5px, 0.5vw, 7px)' }}
                  >
                    {visible.filter((a) => a.severity === 'critical').length}🔴
                  </span>
                )}
                {hasWarning && (
                  <span
                    className="rounded-full bg-amber-500/20 font-mono text-amber-400"
                    style={{ fontSize: 'clamp(8px, 0.75vw, 10px)', padding: '0 clamp(5px, 0.5vw, 7px)' }}
                  >
                    {visible.filter((a) => a.severity === 'warning').length}🟡
                  </span>
                )}
                {visible.some((a) => a.severity === 'info') && (
                  <span
                    className="rounded-full bg-blue-500/20 font-mono text-blue-400"
                    style={{ fontSize: 'clamp(8px, 0.75vw, 10px)', padding: '0 clamp(5px, 0.5vw, 7px)' }}
                  >
                    {visible.filter((a) => a.severity === 'info').length}🔵
                  </span>
                )}
              </div>
              <span
                className="text-white/15"
                style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}
              >
                {expanded ? '▾' : '▸'}
              </span>
            </>
          )}
        </button>

        <div className="flex items-center" style={{ gap: 'clamp(6px, 0.6vw, 8px)' }}>
          {sourcesFailed > 0 && (
            <span
              className="text-amber-400/50"
              style={{ fontSize: 'clamp(9px, 0.8vw, 10px)' }}
              title={`${sourcesFailed} data source(s) unreachable`}
            >
              {sourcesFailed} source{sourcesFailed > 1 ? 's' : ''} down
            </span>
          )}
          <span
            className="text-white/20"
            style={{ fontSize: 'clamp(9px, 0.8vw, 10px)' }}
          >
            Last check: {lastCheckLabel}
          </span>
          <button
            type="button"
            onClick={fetchAnomalies}
            className="rounded-md bg-white/5 text-white/40 transition-colors hover:bg-white/10 hover:text-white/60"
            style={{
              fontSize: 'clamp(9px, 0.85vw, 11px)',
              padding: 'clamp(2px, 0.2vw, 3px) clamp(8px, 0.8vw, 10px)',
            }}
          >
            ⟳
          </button>
        </div>
      </div>

      {/* ── Expanded Anomaly Cards ─────────────────────────────────── */}
      {expanded && visible.length > 0 && (
        <div
          className="mt-3 flex flex-col"
          style={{ gap: 'clamp(6px, 0.6vw, 8px)' }}
        >
          {visible.map((anomaly) => (
            <AnomalyCard
              key={anomaly.id}
              anomaly={anomaly}
              onAcknowledge={handleAcknowledge}
            />
          ))}

          {/* Acknowledged count */}
          {acknowledged.size > 0 && (
            <div className="text-right">
              <button
                type="button"
                onClick={() => setAcknowledged(new Set())}
                className="text-white/15 transition-colors hover:text-white/30"
                style={{ fontSize: 'clamp(9px, 0.8vw, 10px)' }}
              >
                {acknowledged.size} acknowledged — show all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
