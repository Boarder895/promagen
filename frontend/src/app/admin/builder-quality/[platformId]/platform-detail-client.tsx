'use client';

// src/app/admin/builder-quality/[platformId]/platform-detail-client.tsx
// ============================================================================
// PLATFORM DETAIL CLIENT — Full drill-down for a single platform
// ============================================================================
//
// Sections:
//   1. Platform Header (name, tier, call3Mode, run summary)
//   2. Scene Results Table (8 core scenes, expandable anchor audit)
//   3. Anchor Audit (inline expansion via SceneResultsTable)
//   4. Replicate Variance (§9.5 — min/max/stddev per scene)
//   5. Post-Processing Reliance (§9.6 — % changed, before/after)
//   6. Holdout Results (§9.7 — separate from core)
//   7. Comparison View (if baseline run linked)
//
// Authority: docs/authority/builder-quality-intelligence.md v2.5.0 §9.2
// Build plan: part-8-build-plan v1.2.0, Sub-Delivery 8b
//
// Version: 1.0.0
// Created: 4 April 2026
//
// Existing features preserved: Yes (new file).
// ============================================================================

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { SceneResultsTable } from '@/components/admin/builder-quality/scene-results-table';
import { ReplicateVarianceTable } from '@/components/admin/builder-quality/replicate-variance-table';
import { PostProcessingPanel } from '@/components/admin/builder-quality/post-processing-panel';
import { HoldoutPanel } from '@/components/admin/builder-quality/holdout-panel';
import { ComparisonPanel } from '@/components/admin/builder-quality/comparison-panel';

import type { PlatformSceneAggregate, Classification, ComparisonConfidence } from '@/lib/builder-quality/aggregation';

// =============================================================================
// TYPES
// =============================================================================

interface PlatformSummary {
  platformId: string;
  platformName: string;
  tier: number;
  call3Mode: string;
}

interface RunInfo {
  runId: string;
  createdAt: string;
  status: string;
  mode: string;
  replicateCount: number;
  baselineRunId: string | null;
}

interface DetailResult {
  sceneId: string;
  sceneName: string;
  replicateIndex: number;
  gptScore: number;
  gptSummary: string;
  gptDirectives: string[];
  anchorAudit: AnchorAuditEntry[] | null;
  anchorsExpected: number;
  anchorsPreserved: number;
  anchorsDropped: number;
  criticalAnchorsDropped: number;
  rawOptimisedPrompt: string;
  optimisedPrompt: string;
  postProcessingChanged: boolean;
  postProcessingDelta: string | null;
  call3Mode: string;
  status: string;
  isHoldout: boolean;
}

interface AnchorAuditEntry {
  anchor: string;
  severity: 'critical' | 'important' | 'optional';
  status: 'exact' | 'approximate' | 'dropped';
  note?: string;
}

interface PostProcessingStats {
  totalScenes: number;
  changedCount: number;
  percentage: number;
}

interface ComparisonData {
  platformId: string;
  currentMean: number;
  baselineMean: number;
  delta: number;
  classification: Classification;
  confidence: ComparisonConfidence;
  criticalNewlyDropped: number;
  importantNewlyDropped: number;
  optionalNewlyDropped: number;
  worstSceneRegression: {
    sceneId: string;
    currentMean: number;
    baselineMean: number;
    delta: number;
    criticalNewlyDropped: number;
  } | null;
  baselineRunId: string;
}

interface PageData {
  platform: PlatformSummary;
  run: RunInfo;
  sceneAggregates: PlatformSceneAggregate[];
  holdoutSceneAggregates: PlatformSceneAggregate[];
  coreDetails: DetailResult[];
  holdoutDetails: DetailResult[];
  postProcessing: PostProcessingStats;
  comparison: ComparisonData | null;
}

const TIER_COLOURS: Record<number, string> = {
  1: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  2: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  3: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  4: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
};

// =============================================================================
// COMPONENT
// =============================================================================

interface Props {
  platformId: string;
}

export function PlatformDetailClient({ platformId }: Props) {
  const searchParams = useSearchParams();
  const runId = searchParams.get('runId');

  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<'platform' | 'run' | null>(null);

  // Part 12: Failure patterns state
  const [failurePatterns, setFailurePatterns] = useState<{
    anchorDrops: { anchor: string; severity: string; dropRate: number; scenes: string[] }[];
    recurringDirectives: { canonical: string; occurrenceRate: number }[];
    sceneWeakness: { sceneId: string; meanScore: number; minScore: number; maxScore: number }[];
    postProcessingReliance: number;
    patchTests: { runId: string; createdAt: string; status: string; meanScore: number | null }[];
  } | null>(null);

  // ── Data fetching ────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!runId) {
      setError('No run ID specified. Return to the overview and select a run.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setNotFound(null);

      const url = `/api/admin/builder-quality/platform-detail?platformId=${encodeURIComponent(platformId)}&runId=${encodeURIComponent(runId)}`;
      const res = await fetch(url);
      const json = await res.json();

      if (!json.ok) {
        setError(json.message ?? 'Failed to load platform detail');
        return;
      }

      // Handle not-found responses
      if (json.data?.notFound === 'run') {
        setNotFound('run');
        return;
      }
      if (json.data?.notFound === 'platform') {
        setNotFound('platform');
        return;
      }

      setData(json.data);
    } catch (err) {
      console.debug('[builder-quality] Error fetching platform detail:', err);
      setError('Failed to load platform detail');
    } finally {
      setLoading(false);
    }
  }, [platformId, runId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Part 12: Fetch failure patterns (independent of selected run)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/admin/builder-quality/failure-patterns?platformId=${encodeURIComponent(platformId)}`);
        const json = await res.json();
        if (json.ok && json.data) {
          setFailurePatterns(json.data);
        }
      } catch (err) {
        console.debug('[builder-quality] Error fetching failure patterns:', err);
      }
    })();
  }, [platformId]);

  // ── Back link ────────────────────────────────────────────────────
  const backHref = runId
    ? `/admin/builder-quality`
    : '/admin/builder-quality';

  // ── Loading state ────────────────────────────────────────────────
  if (loading) {
    return (
      <div>
        <BackLink href={backHref} />
        <LoadingState />
      </div>
    );
  }

  // ── Not found: platform ──────────────────────────────────────────
  if (notFound === 'platform') {
    return (
      <div>
        <BackLink href={backHref} />
        <ErrorBox>
          Platform not found: <span className="font-mono text-white">{platformId}</span>
        </ErrorBox>
      </div>
    );
  }

  // ── Not found: run ───────────────────────────────────────────────
  if (notFound === 'run') {
    return (
      <div>
        <BackLink href={backHref} />
        <ErrorBox>
          Run not found: <span className="font-mono text-white">{runId}</span>. Return to the
          overview and select a valid run.
        </ErrorBox>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div>
        <BackLink href={backHref} />
        <ErrorBox>{error ?? 'No data available.'}</ErrorBox>
      </div>
    );
  }

  // ── Derived data ─────────────────────────────────────────────────
  const changedResults = data.coreDetails.filter(
    (r) => r.postProcessingChanged && r.status === 'complete',
  );

  // Deduplicate changed results by scene (use first replicate)
  const seenScenes = new Set<string>();
  const uniqueChangedResults = changedResults.filter((r) => {
    if (seenScenes.has(r.sceneId)) return false;
    seenScenes.add(r.sceneId);
    return true;
  });

  const tierClass = TIER_COLOURS[data.platform.tier] ?? TIER_COLOURS[3];

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Back link ──────────────────────────────────────────────── */}
      <BackLink href={backHref} />

      {/* ── Section 1: Platform Header ─────────────────────────────── */}
      <div
        className="rounded-lg border border-white/10 bg-white/5"
        style={{
          padding: 'clamp(14px, 1.4vw, 22px) clamp(16px, 1.6vw, 24px)',
          marginBottom: 'clamp(20px, 2.5vw, 32px)',
        }}
      >
        <div className="flex flex-wrap items-center" style={{ gap: 'clamp(10px, 1vw, 16px)' }}>
          <h1
            className="font-bold text-white"
            style={{ fontSize: 'clamp(18px, 2.2vw, 28px)' }}
          >
            {data.platform.platformName}
          </h1>

          <span
            className={`inline-block rounded-full border font-medium ${tierClass}`}
            style={{
              fontSize: 'clamp(10px, 0.85vw, 12px)',
              padding: 'clamp(2px, 0.2vh, 4px) clamp(8px, 0.8vw, 12px)',
            }}
          >
            T{data.platform.tier}
          </span>

          <span
            className="font-mono text-slate-300"
            style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}
          >
            {data.platform.call3Mode}
          </span>
        </div>

        <div
          className="flex flex-wrap items-center text-slate-300"
          style={{
            gap: 'clamp(12px, 1.2vw, 18px)',
            marginTop: 'clamp(6px, 0.6vw, 10px)',
            fontSize: 'clamp(10px, 0.9vw, 13px)',
          }}
        >
          <span>
            Run:{' '}
            <span className="font-mono text-white">{data.run.runId.slice(0, 16)}</span>
          </span>
          <span>
            {new Date(data.run.createdAt).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          <span>
            Mode: <span className="text-white">{data.run.mode}</span>
          </span>
          <span>
            Replicates: <span className="text-white">{data.run.replicateCount}</span>
          </span>
        </div>
      </div>

      {/* ── Section 2 & 3: Scene Results + Anchor Audit ────────────── */}
      <SectionHeading>Scene Results</SectionHeading>
      <SceneResultsTable
        sceneAggregates={data.sceneAggregates}
        detailResults={data.coreDetails}
      />

      {/* ── Section 4: Replicate Variance (§9.5) ───────────────────── */}
      <SectionHeading>Replicate Variance</SectionHeading>
      <ReplicateVarianceTable sceneAggregates={data.sceneAggregates} />

      {/* ── Section 5: Post-Processing Reliance (§9.6) ─────────────── */}
      <SectionHeading>Post-Processing Reliance</SectionHeading>
      <PostProcessingPanel
        stats={data.postProcessing}
        changedResults={uniqueChangedResults}
      />

      {/* ── Section 6: Holdout Results (§9.7) ──────────────────────── */}
      <SectionHeading>Holdout Results</SectionHeading>
      <HoldoutPanel holdoutAggregates={data.holdoutSceneAggregates} />

      {/* ── Section 7: Comparison View ─────────────────────────────── */}
      <SectionHeading>Baseline Comparison</SectionHeading>
      {data.comparison ? (
        <ComparisonPanel comparison={data.comparison} />
      ) : (
        <EmptyState>
          No baseline run linked. Use{' '}
          <span className="font-mono text-white">--baseline {'<run_id>'}</span> to compare against
          a prior run.
        </EmptyState>
      )}

      {/* ── Section 8: Failure Patterns (Part 12, §11) ─────────────── */}
      <SectionHeading>Failure Patterns</SectionHeading>
      {failurePatterns ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(12px, 1.5vw, 20px)' }}>
          {/* Anchor Drop Frequency */}
          {failurePatterns.anchorDrops.length > 0 && (
            <div className="rounded-lg border border-white/10 bg-white/5" style={{ padding: 'clamp(12px, 1.2vw, 20px)' }}>
              <h3 className="font-semibold text-white" style={{ fontSize: 'clamp(12px, 1.1vw, 15px)', marginBottom: 'clamp(8px, 0.8vw, 12px)' }}>
                Anchor Drop Frequency
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ fontSize: 'clamp(10px, 0.9vw, 13px)' }}>
                  <thead>
                    <tr className="border-b border-white/10">
                      {['Anchor', 'Severity', 'Drop Rate', 'Scenes'].map((h) => (
                        <th key={h} className="text-left font-medium text-slate-200" style={{ padding: 'clamp(4px, 0.4vw, 8px) clamp(8px, 0.8vw, 12px)', textTransform: 'uppercase' as const, fontSize: 'clamp(9px, 0.8vw, 11px)', letterSpacing: '0.03em' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {failurePatterns.anchorDrops.slice(0, 10).map((a) => (
                      <tr key={a.anchor} className="border-b border-white/5">
                        <td className="font-mono text-white" style={{ padding: 'clamp(4px, 0.4vw, 6px) clamp(8px, 0.8vw, 12px)' }}>{a.anchor}</td>
                        <td style={{ padding: 'clamp(4px, 0.4vw, 6px) clamp(8px, 0.8vw, 12px)' }}>
                          <span className={`inline-block rounded-full border font-medium ${a.severity === 'critical' ? 'bg-red-500/20 text-red-300 border-red-500/40' : a.severity === 'important' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-white/10 text-slate-200 border-white/20'}`} style={{ fontSize: 'clamp(9px, 0.75vw, 10px)', padding: '1px clamp(5px, 0.5vw, 8px)' }}>
                            {a.severity}
                          </span>
                        </td>
                        <td className={`font-mono font-semibold ${a.dropRate > 50 ? 'text-red-400' : a.dropRate > 20 ? 'text-amber-400' : 'text-emerald-400'}`} style={{ padding: 'clamp(4px, 0.4vw, 6px) clamp(8px, 0.8vw, 12px)' }}>
                          {a.dropRate}%
                        </td>
                        <td className="font-mono text-slate-200" style={{ padding: 'clamp(4px, 0.4vw, 6px) clamp(8px, 0.8vw, 12px)', fontSize: 'clamp(9px, 0.8vw, 11px)' }}>
                          {a.scenes.slice(0, 3).join(', ')}{a.scenes.length > 3 ? ` +${a.scenes.length - 3}` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recurring Directives */}
          {failurePatterns.recurringDirectives.length > 0 && (
            <div className="rounded-lg border border-white/10 bg-white/5" style={{ padding: 'clamp(12px, 1.2vw, 20px)' }}>
              <h3 className="font-semibold text-white" style={{ fontSize: 'clamp(12px, 1.1vw, 15px)', marginBottom: 'clamp(8px, 0.8vw, 12px)' }}>
                Recurring Directives
              </h3>
              {failurePatterns.recurringDirectives.slice(0, 5).map((d) => (
                <div key={d.canonical} className="border-b border-white/5" style={{ padding: 'clamp(6px, 0.6vw, 10px) 0' }}>
                  <span className="text-white" style={{ fontSize: 'clamp(10px, 0.9vw, 13px)' }}>
                    &ldquo;{d.canonical}&rdquo;
                  </span>
                  <span className="text-amber-400 font-mono" style={{ fontSize: 'clamp(10px, 0.85vw, 12px)', marginLeft: 'clamp(6px, 0.6vw, 10px)' }}>
                    {d.occurrenceRate}%
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Patch Test History */}
          {failurePatterns.patchTests.length > 0 && (
            <div className="rounded-lg border border-white/10 bg-white/5" style={{ padding: 'clamp(12px, 1.2vw, 20px)' }}>
              <h3 className="font-semibold text-white" style={{ fontSize: 'clamp(12px, 1.1vw, 15px)', marginBottom: 'clamp(8px, 0.8vw, 12px)' }}>
                Patch Test History
              </h3>
              {failurePatterns.patchTests.map((pt) => (
                <div key={pt.runId} className="flex items-center border-b border-white/5" style={{ padding: 'clamp(6px, 0.6vw, 10px) 0', gap: 'clamp(8px, 0.8vw, 12px)' }}>
                  <span className="font-mono text-slate-200" style={{ fontSize: 'clamp(10px, 0.85vw, 12px)' }}>{pt.runId.slice(0, 16)}</span>
                  <span className={`inline-block rounded-full border font-medium ${pt.status === 'complete' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border-amber-500/40'}`} style={{ fontSize: 'clamp(9px, 0.75vw, 10px)', padding: '1px clamp(5px, 0.5vw, 8px)' }}>
                    {pt.status}
                  </span>
                  {pt.meanScore !== null && (
                    <span className="font-mono text-white" style={{ fontSize: 'clamp(10px, 0.9vw, 13px)' }}>
                      {pt.meanScore.toFixed(1)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {failurePatterns.anchorDrops.length === 0 && failurePatterns.recurringDirectives.length === 0 && (
            <EmptyState>No failure patterns detected yet. Run more batches to build up data.</EmptyState>
          )}
        </div>
      ) : (
        <EmptyState>Loading failure patterns...</EmptyState>
      )}
    </div>
  );
}

// =============================================================================
// SHARED SUB-COMPONENTS
// =============================================================================

function BackLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-block cursor-pointer text-purple-300 transition-colors hover:text-purple-100"
      style={{
        fontSize: 'clamp(11px, 1vw, 14px)',
        marginBottom: 'clamp(12px, 1.5vw, 20px)',
      }}
    >
      ← Platform Overview
    </Link>
  );
}

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

function LoadingState() {
  return (
    <div
      className="rounded-lg border border-white/10 bg-white/5 text-slate-300"
      style={{
        padding: 'clamp(20px, 2.5vw, 40px)',
        fontSize: 'clamp(12px, 1.1vw, 14px)',
        textAlign: 'center',
      }}
    >
      Loading platform detail...
    </div>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-lg border border-red-500/30 bg-red-500/10 text-red-300"
      style={{
        padding: 'clamp(16px, 2vw, 28px)',
        fontSize: 'clamp(12px, 1.1vw, 14px)',
      }}
    >
      {children}
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-lg border border-white/10 bg-white/5 text-slate-300"
      style={{
        padding: 'clamp(16px, 2vw, 28px)',
        fontSize: 'clamp(12px, 1.1vw, 14px)',
        textAlign: 'center',
      }}
    >
      {children}
    </div>
  );
}
