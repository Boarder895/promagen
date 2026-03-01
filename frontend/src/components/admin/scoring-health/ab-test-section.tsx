'use client';

// src/components/admin/scoring-health/ab-test-section.tsx
// ============================================================================
// SECTION 6 — A/B TEST RESULTS
// ============================================================================
//
// Wraps the existing ABTestDashboard (711 lines) into the scoring health page
// and adds a Test History Timeline below it.
//
// Key decision: ABTestDashboard is self-contained (fetches its own data).
//   This wrapper adds only the history timeline + summary counts.
//
// Data: GET /api/admin/scoring-health/ab-tests (for timeline only)
//
// Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md § 7
//
// Version: 1.0.0
// Created: 2026-03-01
//
// Existing features preserved: Yes (wraps existing component, new file).
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { formatRelativeTime } from '@/lib/admin/scoring-health-types';
import type {
  ABTestHistoryEntry,
  ABTestSectionData,
  ScoringHealthApiResponse,
} from '@/lib/admin/scoring-health-types';

// Lazy-load the existing dashboard to avoid bundle-size overhead when collapsed
const ABTestDashboard = dynamic(
  () => import('@/components/admin/ab-test-dashboard'),
  {
    loading: () => (
      <div className="flex items-center justify-center" style={{ minHeight: 'clamp(80px, 10vw, 120px)' }}>
        <span className="animate-pulse text-white/30" style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}>
          Loading A/B test dashboard…
        </span>
      </div>
    ),
  },
);

// ============================================================================
// OUTCOME BADGE
// ============================================================================

function OutcomeBadge({ outcome }: { outcome: ABTestHistoryEntry['outcome'] }) {
  const styles: Record<string, { bg: string; text: string; label: string }> = {
    promoted:    { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: '✓ Promoted' },
    rolled_back: { bg: 'bg-red-500/15',     text: 'text-red-400',     label: '✗ Rolled Back' },
    running:     { bg: 'bg-blue-500/15',    text: 'text-blue-400',    label: '● Running' },
    pending:     { bg: 'bg-white/5',        text: 'text-white/30',    label: '○ Pending' },
  };

  const s = styles[outcome] ?? styles.pending!;

  return (
    <span
      className={`rounded-full ${s.bg} ${s.text}`}
      style={{
        fontSize: 'clamp(8px, 0.75vw, 10px)',
        padding: 'clamp(1px, 0.1vw, 2px) clamp(6px, 0.6vw, 8px)',
      }}
    >
      {s.label}
    </span>
  );
}

// ============================================================================
// HISTORY TIMELINE
// ============================================================================

function HistoryTimeline({ entries }: { entries: ABTestHistoryEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-center text-white/20" style={{ fontSize: 'clamp(10px, 0.9vw, 12px)', padding: 'clamp(8px, 1vw, 12px)' }}>
        No test history available yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col" style={{ gap: 'clamp(1px, 0.1vw, 2px)' }}>
      {entries.map((entry) => {
        const dateStr = entry.concludedAt
          ? formatRelativeTime(entry.concludedAt)
          : formatRelativeTime(entry.startedAt);

        return (
          <div
            key={entry.testId}
            className="flex items-center justify-between rounded-lg bg-white/[0.02] transition-colors hover:bg-white/[0.04]"
            style={{
              padding: 'clamp(6px, 0.6vw, 8px) clamp(10px, 1vw, 14px)',
              gap: 'clamp(8px, 0.8vw, 12px)',
            }}
          >
            {/* Left: date + name */}
            <div className="min-w-0 flex-1">
              <span
                className="font-mono text-white/25"
                style={{ fontSize: 'clamp(9px, 0.8vw, 10px)', marginRight: 'clamp(6px, 0.6vw, 8px)' }}
              >
                {dateStr}
              </span>
              <span
                className="font-medium text-white/60"
                style={{ fontSize: 'clamp(10px, 0.95vw, 12px)' }}
              >
                {entry.name}
              </span>
            </div>

            {/* Right: outcome + lift */}
            <div className="flex items-center flex-shrink-0" style={{ gap: 'clamp(6px, 0.6vw, 10px)' }}>
              <OutcomeBadge outcome={entry.outcome} />
              {entry.lift !== null && (
                <span
                  className={`font-mono ${entry.lift >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}
                  style={{ fontSize: 'clamp(9px, 0.85vw, 11px)' }}
                >
                  {entry.lift > 0 ? '+' : ''}{entry.lift.toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ABTestSection() {
  const [data, setData] = useState<ABTestSectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/scoring-health/ab-tests');
      const json = (await res.json()) as ScoringHealthApiResponse<ABTestSectionData>;
      if (!json.ok || !json.data) {
        setError(json.message ?? 'Failed to load A/B test data');
        setData(null);
      } else {
        setData(json.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fetch failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

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
            A/B Test Results
          </h2>
          <p
            className="text-white/30"
            style={{ fontSize: 'clamp(10px, 0.85vw, 12px)', marginTop: 'clamp(1px, 0.15vw, 2px)' }}
          >
            Running and historical A/B tests with statistical analysis
          </p>
        </div>
        {data && (
          <div className="flex items-center" style={{ gap: 'clamp(8px, 0.8vw, 12px)', fontSize: 'clamp(9px, 0.85vw, 11px)' }}>
            {data.summary.running > 0 && (
              <span className="rounded-full bg-blue-500/15 text-blue-400" style={{ padding: 'clamp(1px, 0.1vw, 2px) clamp(6px, 0.6vw, 8px)' }}>
                {data.summary.running} running
              </span>
            )}
            <span className="text-white/25">{data.summary.totalTests} total</span>
          </div>
        )}
      </div>

      {/* Existing ABTestDashboard */}
      <ABTestDashboard />

      {/* History Timeline */}
      <div style={{ marginTop: 'clamp(16px, 2vw, 24px)' }}>
        <h3
          className="mb-2 font-semibold text-white/50"
          style={{ fontSize: 'clamp(11px, 1.1vw, 14px)' }}
        >
          Test History Timeline
        </h3>

        {loading && !data && (
          <span className="animate-pulse text-white/30" style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}>
            Loading history…
          </span>
        )}

        {error && !data && (
          <span className="text-red-400/70" style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}>
            ❌ {error}
          </span>
        )}

        {data && (
          <div className="rounded-lg ring-1 ring-white/5">
            <HistoryTimeline entries={data.history} />
          </div>
        )}
      </div>
    </div>
  );
}
