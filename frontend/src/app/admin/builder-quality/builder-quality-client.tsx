'use client';

// src/app/admin/builder-quality/builder-quality-client.tsx
// ============================================================================
// BUILDER QUALITY CLIENT — Dashboard Shell
// ============================================================================
//
// Manages:
//   - Selected run state (latest by default, switchable via Run History)
//   - Quick filters (mode, holdout)
//   - Banner showing which run is being viewed
//   - Three sections: Platform Overview, Run History, Flagged Divergences
//
// Authority: docs/authority/builder-quality-intelligence.md v2.5.0 §9
// Build plan: part-8-build-plan v1.2.0, Sub-Delivery 8a
//
// Version: 1.0.0
// Created: 4 April 2026
//
// Existing features preserved: Yes (new file).
// ============================================================================

import { useEffect, useState, useCallback, useMemo } from 'react';

import { PlatformOverviewTable } from '@/components/admin/builder-quality/platform-overview-table';
import { RunHistoryTable } from '@/components/admin/builder-quality/run-history-table';
import { FlaggedDivergencesTable } from '@/components/admin/builder-quality/flagged-divergences-table';

import type { PlatformAggregate } from '@/lib/builder-quality/aggregation';

// =============================================================================
// TYPES
// =============================================================================

interface RunSummary {
  runId: string;
  createdAt: string;
  status: string;
  mode: string;
  scope: string;
  scorerMode: string;
  replicateCount: number;
  totalExpected: number | null;
  totalCompleted: number;
  meanGptScore: number | null;
  flaggedCount: number;
  baselineRunId: string | null;
}

interface RunListItem {
  runId: string;
  createdAt: string;
  completedAt: string | null;
  status: string;
  mode: string;
  scope: string;
  scorerMode: string;
  replicateCount: number;
  totalExpected: number | null;
  totalCompleted: number;
  meanGptScore: number | null;
  flaggedCount: number;
  baselineRunId: string | null;
}

type ModeFilter = 'all' | 'builder' | 'pipeline';

// Part 11: User sample stats for the "User (7d)" column
interface UserSampleStat {
  platformId: string;
  meanScore: number;
  sampleCount: number;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function BuilderQualityClient() {
  // ── State ────────────────────────────────────────────────────────
  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [platforms, setPlatforms] = useState<PlatformAggregate[]>([]);
  const [selectedRun, setSelectedRun] = useState<RunSummary | null>(null);
  const [isLatest, setIsLatest] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userSampleStats, setUserSampleStats] = useState<UserSampleStat[]>([]);

  // Filters
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all');

  // ── Data fetching ────────────────────────────────────────────────
  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/builder-quality/runs');
      const json = await res.json();
      if (json.ok && json.data) {
        setRuns(json.data);
      }
    } catch (err) {
      console.debug('[builder-quality] Error fetching runs:', err);
    }
  }, []);

  const fetchRunResults = useCallback(async (runId?: string) => {
    try {
      setLoading(true);
      const url = runId
        ? `/api/admin/builder-quality/run-results?runId=${encodeURIComponent(runId)}`
        : '/api/admin/builder-quality/run-results';
      const res = await fetch(url);
      const json = await res.json();

      if (json.ok && json.data) {
        setPlatforms(json.data.platforms ?? []);
        setSelectedRun(json.data.run ?? null);
        setWarning(json.data.warning ?? null);

        if (json.data.warning && !runId) {
          // No complete runs
          setIsLatest(true);
        }
      } else {
        setError(json.message ?? 'Failed to load results');
      }
    } catch (err) {
      console.debug('[builder-quality] Error fetching run results:', err);
      setError('Failed to load results');
    } finally {
      setLoading(false);
    }
  }, []);

  // Part 11: Fetch user sample stats for the "User (7d)" column
  const fetchUserSampleStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/builder-quality/user-sample-stats');
      const json = await res.json();
      if (json.ok && json.data) {
        setUserSampleStats(json.data);
      }
    } catch (err) {
      console.debug('[builder-quality] Error fetching user sample stats:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchRuns();
    fetchRunResults();
    fetchUserSampleStats();
  }, [fetchRuns, fetchRunResults, fetchUserSampleStats]);

  // ── Run selection ────────────────────────────────────────────────
  const handleSelectRun = useCallback(
    (runId: string) => {
      setIsLatest(false);
      fetchRunResults(runId);
    },
    [fetchRunResults],
  );

  const handleReturnToLatest = useCallback(() => {
    setIsLatest(true);
    setWarning(null);
    fetchRunResults();
  }, [fetchRunResults]);

  // ── Filtered platforms (client-side filter) ──────────────────────
  // Mode filter is informational — the overview shows all platforms by default.
  // Pipeline mode isn't implemented yet, so currently all results are builder mode.
  // Filter is here for when pipeline mode lands.
  const filteredPlatforms = useMemo(() => {
    // For now, all platforms pass — mode filtering will apply once
    // pipeline-mode runs exist and the run metadata carries mode per result.
    return platforms;
  }, [platforms]);

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Page heading ─────────────────────────────────────────── */}
      <h1
        className="font-bold text-white"
        style={{ fontSize: 'clamp(20px, 2.5vw, 32px)', marginBottom: 'clamp(4px, 0.5vw, 8px)' }}
      >
        Builder Quality Intelligence
      </h1>
      <p
        className="text-slate-300"
        style={{ fontSize: 'clamp(12px, 1.1vw, 15px)', marginBottom: 'clamp(16px, 2vw, 24px)' }}
      >
        Platform scores, anchor audits, and regression tracking across 40 platforms.
      </p>

      {/* ── Selected run banner ──────────────────────────────────── */}
      <div
        className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5"
        style={{ padding: 'clamp(10px, 1vw, 16px)', marginBottom: 'clamp(12px, 1.5vw, 20px)' }}
      >
        <div className="flex items-center" style={{ gap: 'clamp(8px, 0.8vw, 12px)' }}>
          <span
            className="font-medium text-white"
            style={{ fontSize: 'clamp(11px, 1vw, 14px)' }}
          >
            Viewing:
          </span>
          {selectedRun ? (
            <span
              className="font-mono text-slate-200"
              style={{ fontSize: 'clamp(10px, 0.9vw, 13px)' }}
            >
              {isLatest ? 'Latest Run — ' : 'Run '}
              <span className="text-white">{selectedRun.runId.slice(0, 16)}</span>
              <span className="text-slate-300">
                {' '}({new Date(selectedRun.createdAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })})
              </span>
            </span>
          ) : (
            <span
              className="text-slate-300"
              style={{ fontSize: 'clamp(10px, 0.9vw, 13px)' }}
            >
              No run selected
            </span>
          )}
        </div>

        {!isLatest && (
          <button
            onClick={handleReturnToLatest}
            className="cursor-pointer rounded-full border border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 font-medium text-purple-100 transition-all hover:border-purple-400 hover:from-purple-600/30 hover:to-pink-600/30"
            style={{
              fontSize: 'clamp(10px, 0.85vw, 13px)',
              padding: 'clamp(4px, 0.4vh, 6px) clamp(10px, 1vw, 14px)',
            }}
          >
            ← Return to latest run
          </button>
        )}
      </div>

      {/* ── Warning banner ───────────────────────────────────────── */}
      {warning && (
        <div
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300"
          style={{
            padding: 'clamp(8px, 0.8vw, 12px) clamp(12px, 1vw, 16px)',
            marginBottom: 'clamp(12px, 1.5vw, 20px)',
            fontSize: 'clamp(11px, 1vw, 13px)',
          }}
        >
          {warning}
        </div>
      )}

      {/* ── Quick filters ────────────────────────────────────────── */}
      <div
        className="flex items-center"
        style={{
          gap: 'clamp(8px, 0.8vw, 12px)',
          marginBottom: 'clamp(16px, 2vw, 24px)',
        }}
      >
        <span
          className="text-slate-300"
          style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}
        >
          Mode:
        </span>
        {(['all', 'builder', 'pipeline'] as ModeFilter[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setModeFilter(mode)}
            className={`cursor-pointer rounded-full border font-medium transition-all ${
              modeFilter === mode
                ? 'border-white/30 bg-white/15 text-white'
                : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
            style={{
              fontSize: 'clamp(10px, 0.85vw, 12px)',
              padding: 'clamp(3px, 0.3vh, 5px) clamp(10px, 0.9vw, 14px)',
            }}
          >
            {mode === 'all' ? 'All' : mode.charAt(0).toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Error state ──────────────────────────────────────────── */}
      {error && (
        <div
          className="rounded-lg border border-red-500/30 bg-red-500/10 text-red-300"
          style={{
            padding: 'clamp(12px, 1.2vw, 20px)',
            marginBottom: 'clamp(16px, 2vw, 24px)',
            fontSize: 'clamp(12px, 1.1vw, 14px)',
          }}
        >
          {error}
        </div>
      )}

      {/* ── Section 1: Platform Overview ─────────────────────────── */}
      <SectionHeading>Platform Overview</SectionHeading>
      {loading ? (
        <LoadingPlaceholder text="Loading platform data..." />
      ) : filteredPlatforms.length === 0 ? (
        <EmptyState text="No complete runs found. Run the batch runner to generate data." />
      ) : (
        <PlatformOverviewTable
          platforms={filteredPlatforms}
          runId={selectedRun?.runId ?? null}
          userSampleStats={userSampleStats}
        />
      )}

      {/* ── Section 2: Run History ───────────────────────────────── */}
      <SectionHeading>Run History</SectionHeading>
      <RunHistoryTable
        runs={runs}
        selectedRunId={selectedRun?.runId ?? null}
        onSelectRun={handleSelectRun}
      />

      {/* ── Section 3: Flagged Divergences ───────────────────────── */}
      <SectionHeading>Flagged Divergences (GPT vs Claude)</SectionHeading>
      <FlaggedDivergencesTable selectedRunId={selectedRun?.runId ?? null} />
    </div>
  );
}

// =============================================================================
// SHARED SUB-COMPONENTS
// =============================================================================

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="font-semibold text-white"
      style={{
        fontSize: 'clamp(14px, 1.4vw, 20px)',
        marginTop: 'clamp(24px, 3vw, 40px)',
        marginBottom: 'clamp(10px, 1.2vw, 16px)',
      }}
    >
      {children}
    </h2>
  );
}

function LoadingPlaceholder({ text }: { text: string }) {
  return (
    <div
      className="rounded-lg border border-white/10 bg-white/5 text-slate-300"
      style={{
        padding: 'clamp(20px, 2.5vw, 40px)',
        fontSize: 'clamp(12px, 1.1vw, 14px)',
        textAlign: 'center',
      }}
    >
      {text}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div
      className="rounded-lg border border-white/10 bg-white/5 text-slate-300"
      style={{
        padding: 'clamp(20px, 2.5vw, 40px)',
        fontSize: 'clamp(12px, 1.1vw, 14px)',
        textAlign: 'center',
      }}
    >
      {text}
    </div>
  );
}
