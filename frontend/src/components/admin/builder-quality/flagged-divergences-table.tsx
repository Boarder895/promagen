'use client';

// src/components/admin/builder-quality/flagged-divergences-table.tsx
// ============================================================================
// FLAGGED DIVERGENCES TABLE — §9.3 GPT vs Claude disagreements
// ============================================================================
//
// Replaces the placeholder from Part 8a. Three explicit states:
//   1. No dual-model runs exist → placeholder text
//   2. Dual runs exist, none flagged → "no divergences" message
//   3. Flagged results exist → table sorted by divergence descending
//
// Authority: docs/authority/builder-quality-intelligence.md v2.5.0 §9.3
// Build plan: part-9-build-plan v1.1.0, Sub-Delivery 9b
//
// Version: 1.0.0
// Created: 4 April 2026
//
// Existing features preserved: Yes (replaces placeholder).
// ============================================================================

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// =============================================================================
// TYPES
// =============================================================================

interface FlaggedResult {
  platformId: string;
  platformName: string;
  sceneId: string;
  sceneName: string;
  gptScore: number;
  claudeScore: number | null;
  divergence: number | null;
  runId: string;
  createdAt: string | null;
}

interface Props {
  selectedRunId: string | null;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function FlaggedDivergencesTable({ selectedRunId }: Props) {
  const router = useRouter();
  const [hasDualRuns, setHasDualRuns] = useState<boolean | null>(null);
  const [flaggedResults, setFlaggedResults] = useState<FlaggedResult[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedRunId) params.set('runId', selectedRunId);
      const res = await fetch(`/api/admin/builder-quality/flagged-divergences?${params.toString()}`);
      const json = await res.json();

      if (json.ok && json.data) {
        setHasDualRuns(json.data.hasDualRuns);
        setFlaggedResults(json.data.flaggedResults ?? []);
      }
    } catch (err) {
      console.debug('[builder-quality] Error fetching flagged divergences:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedRunId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRowClick = (platformId: string, runId: string) => {
    router.push(`/admin/builder-quality/${encodeURIComponent(platformId)}?runId=${encodeURIComponent(runId)}`);
  };

  // ── Loading ────────────────────────────────────────────────────
  if (loading) {
    return (
      <InfoBox>Loading divergence data...</InfoBox>
    );
  }

  // ── State 1: No dual-model runs exist ──────────────────────────
  if (hasDualRuns === false) {
    return (
      <InfoBox>
        No divergence data available — dual-model scoring not enabled. This
        section activates in Part 9 when dual-model scoring is enabled.
      </InfoBox>
    );
  }

  // ── State 2: Dual runs exist, none flagged ─────────────────────
  if (flaggedResults.length === 0) {
    return (
      <InfoBox>
        No flagged divergences found — all GPT vs Claude gaps are under 9 points.
      </InfoBox>
    );
  }

  // ── State 3: Flagged results exist ─────────────────────────────
  return (
    <div className="overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-white/10 bg-white/5">
            {['Platform', 'Scene', 'GPT', 'Claude', 'Gap', 'Run', 'Date'].map(
              (header) => (
                <th
                  key={header}
                  className="text-left font-medium text-slate-200"
                  style={{
                    fontSize: 'clamp(10px, 0.9vw, 12px)',
                    padding: 'clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)',
                    letterSpacing: '0.03em',
                    textTransform: 'uppercase' as const,
                  }}
                >
                  {header}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {flaggedResults.map((r, idx) => (
            <tr
              key={`${r.platformId}-${r.sceneId}-${idx}`}
              onClick={() => handleRowClick(r.platformId, r.runId)}
              className="cursor-pointer border-b border-white/5 bg-red-500/5 transition-colors hover:bg-white/10"
            >
              {/* Platform */}
              <td
                className="font-medium text-white"
                style={{
                  fontSize: 'clamp(11px, 1vw, 14px)',
                  padding: 'clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)',
                }}
              >
                {r.platformName}
              </td>

              {/* Scene */}
              <td
                className="text-slate-200"
                style={{
                  fontSize: 'clamp(10px, 0.9vw, 13px)',
                  padding: 'clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)',
                }}
              >
                {r.sceneId}
              </td>

              {/* GPT Score */}
              <td
                className="font-mono font-semibold text-white"
                style={{
                  fontSize: 'clamp(11px, 1vw, 14px)',
                  padding: 'clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)',
                }}
              >
                {r.gptScore}
              </td>

              {/* Claude Score */}
              <td
                className="font-mono font-semibold text-white"
                style={{
                  fontSize: 'clamp(11px, 1vw, 14px)',
                  padding: 'clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)',
                }}
              >
                {r.claudeScore ?? '—'}
              </td>

              {/* Divergence */}
              <td
                className="font-mono font-bold text-red-400"
                style={{
                  fontSize: 'clamp(11px, 1vw, 14px)',
                  padding: 'clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)',
                }}
              >
                {r.divergence ?? '—'}
              </td>

              {/* Run ID */}
              <td
                className="font-mono text-slate-300"
                style={{
                  fontSize: 'clamp(10px, 0.85vw, 12px)',
                  padding: 'clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)',
                }}
              >
                {r.runId.slice(0, 12)}
              </td>

              {/* Date */}
              <td
                className="text-slate-300"
                style={{
                  fontSize: 'clamp(10px, 0.9vw, 12px)',
                  padding: 'clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)',
                  whiteSpace: 'nowrap',
                }}
              >
                {r.createdAt
                  ? new Date(r.createdAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// =============================================================================
// SHARED SUB-COMPONENT
// =============================================================================

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-lg border border-white/10 bg-white/5 text-slate-300"
      style={{
        padding: 'clamp(20px, 2.5vw, 40px)',
        fontSize: 'clamp(12px, 1.1vw, 14px)',
        textAlign: 'center',
      }}
    >
      {children}
    </div>
  );
}
