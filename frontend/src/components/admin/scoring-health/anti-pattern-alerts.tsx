'use client';

// src/components/admin/scoring-health/anti-pattern-alerts.tsx
// ============================================================================
// SECTION 5 — ANTI-PATTERN ALERTS
// ============================================================================
//
// Displays detected collision pairs and anti-patterns with severity scores.
//
// Features:
//   - Grouped by severity (High / Medium / Low)
//   - Each alert: term pair, type badge, severity score, occurrence count, quality impact
//   - Action buttons: Suppress (console-only) and Dismiss (console-only)
//   - Collapsed Low / Dismissed section to focus on actionable items
//   - Tier filter dropdown
//   - Summary stats: active, overrides, auto-detected
//
// Cross-Section Drill-Through (v2.0.0):
//   - Receives platform filter from Feedback Summary (Section 10)
//     → Shows "Drilled from: [platform]" badge + highlights
//   - Alert rows have "→ Inspect" button that drills to Section 4 (Term Inspector)
//
// Data: GET /api/admin/scoring-health/anti-patterns
//
// Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md § 7
//
// Version: 2.0.0 — cross-section drill-through links
// Created: 2026-03-01
//
// Existing features preserved: Yes (all v1.0.0 functionality intact).
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import type {
  AntiPatternAlert,
  AntiPatternData,
  ScoringHealthApiResponse,
} from '@/lib/admin/scoring-health-types';
import { useDrillThrough } from '@/lib/admin/drill-through-context';

// ============================================================================
// CONSTANTS
// ============================================================================

const TIERS = [
  { value: 'global', label: 'All Tiers' },
  { value: '1', label: 'Tier 1' },
  { value: '2', label: 'Tier 2' },
  { value: '3', label: 'Tier 3' },
  { value: '4', label: 'Tier 4' },
] as const;

const TYPE_COLOURS: Record<string, string> = {
  collision:  'bg-red-500/15 text-red-400',
  conflict:   'bg-amber-500/15 text-amber-400',
  redundancy: 'bg-blue-500/15 text-blue-400',
};

const TYPE_LABELS: Record<string, string> = {
  collision:  'Collision',
  conflict:   'Conflict',
  redundancy: 'Redundancy',
};

// ============================================================================
// ALERT ROW — with "→ Inspect" drill-through
// ============================================================================

function AlertRow({
  alert,
  onInspectTerm,
}: {
  alert: AntiPatternAlert;
  onInspectTerm?: (term: string) => void;
}) {
  const handleSuppress = useCallback(() => {
    // eslint-disable-next-line no-console
    console.log(`[AntiPattern] SUPPRESS: "${alert.termA}" + "${alert.termB}" — prevented from co-appearing`);
  }, [alert.termA, alert.termB]);

  const handleDismiss = useCallback(() => {
    // eslint-disable-next-line no-console
    console.log(`[AntiPattern] DISMISS: "${alert.termA}" + "${alert.termB}" — marked as acceptable`);
  }, [alert.termA, alert.termB]);

  const typeColour = TYPE_COLOURS[alert.patternType] ?? 'bg-white/10 text-white/40';
  const typeLabel = TYPE_LABELS[alert.patternType] ?? alert.patternType;

  return (
    <div
      className="flex items-center justify-between rounded-lg bg-white/[0.02] transition-colors hover:bg-white/[0.04]"
      style={{
        padding: 'clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)',
        gap: 'clamp(8px, 0.8vw, 12px)',
      }}
    >
      {/* Left: term pair + type badge */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center" style={{ gap: 'clamp(6px, 0.6vw, 8px)' }}>
          <button
            type="button"
            onClick={() => onInspectTerm?.(alert.termA)}
            className="font-medium text-white/70 underline decoration-white/10 underline-offset-2 transition-colors hover:text-violet-400 hover:decoration-violet-400/30"
            style={{ fontSize: 'clamp(10px, 0.95vw, 13px)' }}
            title={`Inspect "${alert.termA}" in Term Quality`}
          >
            &ldquo;{alert.termA}&rdquo;
          </button>
          <span
            className="text-white/20"
            style={{ fontSize: 'clamp(9px, 0.85vw, 11px)' }}
          >
            +
          </span>
          <button
            type="button"
            onClick={() => onInspectTerm?.(alert.termB)}
            className="font-medium text-white/70 underline decoration-white/10 underline-offset-2 transition-colors hover:text-violet-400 hover:decoration-violet-400/30"
            style={{ fontSize: 'clamp(10px, 0.95vw, 13px)' }}
            title={`Inspect "${alert.termB}" in Term Quality`}
          >
            &ldquo;{alert.termB}&rdquo;
          </button>
          <span
            className={`rounded-full ${typeColour}`}
            style={{
              fontSize: 'clamp(8px, 0.7vw, 9px)',
              padding: 'clamp(1px, 0.1vw, 2px) clamp(5px, 0.5vw, 7px)',
            }}
          >
            {typeLabel}
          </span>
        </div>
        <div
          className="mt-1 flex items-center text-white/30"
          style={{ gap: 'clamp(8px, 0.8vw, 12px)', fontSize: 'clamp(9px, 0.8vw, 10px)' }}
        >
          <span>Seen {alert.occurrenceCount.toLocaleString()} times</span>
          <span>│</span>
          <span>
            Avg quality: <strong className={alert.qualityImpact < 0 ? 'text-red-400/70' : 'text-white/50'}>
              {alert.qualityImpact > 0 ? '+' : ''}{alert.qualityImpact.toFixed(0)}%
            </strong>
          </span>
        </div>
      </div>

      {/* Center: severity score */}
      <div className="flex-shrink-0 text-right">
        <span
          className="font-mono font-bold"
          style={{
            fontSize: 'clamp(11px, 1vw, 14px)',
            color: alert.severity >= 0.7 ? 'rgb(248,113,113)' : alert.severity >= 0.4 ? 'rgb(251,191,36)' : 'rgb(163,163,163)',
          }}
        >
          {alert.severity.toFixed(2)}
        </span>
      </div>

      {/* Right: action buttons */}
      <div className="flex flex-shrink-0" style={{ gap: 'clamp(3px, 0.3vw, 5px)' }}>
        <button
          type="button"
          onClick={handleSuppress}
          className="rounded bg-violet-500/10 text-violet-400/60 transition-colors hover:bg-violet-500/20 hover:text-violet-400"
          style={{
            fontSize: 'clamp(8px, 0.75vw, 10px)',
            padding: 'clamp(3px, 0.3vw, 4px) clamp(6px, 0.6vw, 8px)',
          }}
        >
          Suppress
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded bg-white/5 text-white/30 transition-colors hover:bg-white/10 hover:text-white/50"
          style={{
            fontSize: 'clamp(8px, 0.75vw, 10px)',
            padding: 'clamp(3px, 0.3vw, 4px) clamp(6px, 0.6vw, 8px)',
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// SEVERITY GROUP
// ============================================================================

function SeverityGroup({
  label,
  icon,
  alerts,
  collapsible,
  onInspectTerm,
}: {
  label: string;
  icon: string;
  alerts: AntiPatternAlert[];
  collapsible?: boolean;
  onInspectTerm?: (term: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(collapsible ?? false);

  if (alerts.length === 0) return null;

  return (
    <div>
      <div className="mb-2 flex items-center" style={{ gap: 'clamp(4px, 0.4vw, 6px)' }}>
        {collapsible ? (
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center text-white/50 hover:text-white/70"
            style={{ gap: 'clamp(4px, 0.4vw, 6px)', fontSize: 'clamp(11px, 1vw, 13px)' }}
          >
            <span>{icon}</span>
            <span className="font-semibold">
              {label} ({alerts.length})
            </span>
            <span style={{ fontSize: 'clamp(9px, 0.8vw, 10px)' }}>
              {collapsed ? '[Show ▾]' : '[Hide ▴]'}
            </span>
          </button>
        ) : (
          <div
            className="flex items-center text-white/60"
            style={{ gap: 'clamp(4px, 0.4vw, 6px)', fontSize: 'clamp(11px, 1vw, 13px)' }}
          >
            <span>{icon}</span>
            <span className="font-semibold">
              {label} ({alerts.length})
            </span>
          </div>
        )}
      </div>

      {!collapsed && (
        <div
          className="flex flex-col rounded-lg ring-1 ring-white/5"
          style={{ gap: 'clamp(1px, 0.1vw, 2px)' }}
        >
          {alerts.map((alert) => (
            <AlertRow key={alert.id} alert={alert} onInspectTerm={onInspectTerm} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AntiPatternAlerts() {
  const [tier, setTier] = useState('global');
  const [data, setData] = useState<AntiPatternData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { activeDrill, clearDrill, drillTo } = useDrillThrough();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/scoring-health/anti-patterns?tier=${tier}`);
      const json = (await res.json()) as ScoringHealthApiResponse<AntiPatternData>;
      if (!json.ok || !json.data) {
        setError(json.message ?? 'Failed to load anti-pattern data');
        setData(null);
      } else {
        setData(json.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fetch failed');
    } finally {
      setLoading(false);
    }
  }, [tier]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  // Check for incoming drill-through filter
  const incomingPlatform =
    activeDrill?.sectionId === 'anti-patterns'
      ? activeDrill.filter.platform ?? null
      : null;

  const totalAlerts = data ? data.high.length + data.medium.length + data.low.length : 0;

  /** Drill to Term Quality inspector for a term */
  const handleInspectTerm = useCallback((term: string) => {
    drillTo('term-quality', { term });
  }, [drillTo]);

  return (
    <div
      className="rounded-xl bg-white/5 ring-1 ring-white/10"
      style={{ padding: 'clamp(16px, 2vw, 24px)' }}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2
            className="font-semibold text-white/80"
            style={{ fontSize: 'clamp(14px, 1.4vw, 18px)' }}
          >
            Anti-Pattern Alerts
            {data && (
              <span className="ml-2 text-white/30" style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}>
                ({totalAlerts} active)
              </span>
            )}
          </h2>
          <p
            className="text-white/30"
            style={{ fontSize: 'clamp(10px, 0.85vw, 12px)', marginTop: 'clamp(1px, 0.15vw, 2px)' }}
          >
            Detected collision pairs, conflicts, and redundancies
          </p>
        </div>
        <div className="flex items-center" style={{ gap: 'clamp(6px, 0.6vw, 8px)' }}>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 text-white/70 outline-none focus:ring-1 focus:ring-violet-500/50"
            style={{ fontSize: 'clamp(10px, 0.9vw, 12px)', padding: 'clamp(4px, 0.4vw, 6px) clamp(8px, 0.8vw, 12px)' }}
            aria-label="Filter by tier"
          >
            {TIERS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={fetchData}
            className="rounded-md bg-white/5 text-white/50 transition-colors hover:bg-white/10 hover:text-white/70"
            style={{ fontSize: 'clamp(10px, 0.9vw, 12px)', padding: 'clamp(4px, 0.4vw, 6px) clamp(10px, 1vw, 14px)' }}
          >
            ⟳
          </button>
        </div>
      </div>

      {/* Incoming drill-through badge */}
      {incomingPlatform && (
        <div
          className="mb-3 flex items-center justify-between rounded-lg bg-violet-500/10 ring-1 ring-violet-500/20"
          style={{ padding: 'clamp(6px, 0.6vw, 8px) clamp(10px, 1vw, 14px)' }}
        >
          <span style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}>
            <span className="text-violet-400">🔗 Drilled from Feedback:</span>{' '}
            <strong className="text-white/70">{incomingPlatform}</strong>
            <span className="ml-2 text-white/30">
              — showing all anti-patterns (filter by platform coming soon)
            </span>
          </span>
          <button
            type="button"
            onClick={clearDrill}
            className="text-white/30 transition-colors hover:text-white/50"
            style={{ fontSize: 'clamp(9px, 0.8vw, 10px)' }}
          >
            ✕ Clear
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && !data && (
        <div className="flex items-center justify-center" style={{ minHeight: 'clamp(80px, 10vw, 120px)' }}>
          <span className="animate-pulse text-white/30" style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}>
            Loading anti-pattern data…
          </span>
        </div>
      )}

      {/* Error */}
      {error && !data && (
        <div className="flex items-center justify-center" style={{ minHeight: 'clamp(80px, 10vw, 120px)' }}>
          <span className="text-red-400/70" style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}>
            ❌ {error}
          </span>
        </div>
      )}

      {/* Data */}
      {data && (
        <div className="flex flex-col" style={{ gap: 'clamp(12px, 1.5vw, 18px)' }}>
          <SeverityGroup label="HIGH SEVERITY" icon="🔴" alerts={data.high} onInspectTerm={handleInspectTerm} />
          <SeverityGroup label="MEDIUM SEVERITY" icon="🟡" alerts={data.medium} onInspectTerm={handleInspectTerm} />
          <SeverityGroup label="LOW / DISMISSED" icon="🟢" alerts={data.low} collapsible onInspectTerm={handleInspectTerm} />

          {totalAlerts === 0 && (
            <p className="text-center text-white/20" style={{ fontSize: 'clamp(11px, 1vw, 13px)', padding: 'clamp(16px, 2vw, 24px)' }}>
              No anti-patterns detected for this tier.
            </p>
          )}

          {/* Summary footer */}
          <div
            className="flex flex-wrap items-center rounded-lg bg-white/[0.03]"
            style={{
              gap: 'clamp(12px, 1.5vw, 20px)',
              padding: 'clamp(8px, 1vw, 12px) clamp(12px, 1.5vw, 18px)',
              fontSize: 'clamp(10px, 0.9vw, 12px)',
            }}
          >
            <span className="text-white/40">
              Overrides applied: <strong className="text-white/60">{data.summary.overridesApplied}</strong>
            </span>
            <span className="text-white/40">
              Auto-detected this month: <strong className="text-white/60">{data.summary.autoDetectedThisMonth}</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
