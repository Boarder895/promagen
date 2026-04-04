"use client";

// src/components/admin/builder-quality/run-history-table.tsx
// ============================================================================
// RUN HISTORY TABLE — All runs sorted by created_at descending
// ============================================================================
//
// Columns: Run ID, Created, Status, Mode, Scope, Scorer, Replicates,
//          Mean Score, Flagged
//
// Click row → updates selected run in parent, Platform Overview re-renders.
// Stale detection: running > 1 hour shows amber warning.
//
// Authority: docs/authority/builder-quality-intelligence.md v2.5.0 §9.4
// Build plan: part-8-build-plan v1.2.0, Sub-Delivery 8a
//
// Version: 1.2.0
// Created: 4 April 2026
// Updated: 4 April 2026 — Part 10: added parentRunId + rerun child indicator chip.
// Updated: 4 April 2026 — v1.2.0: added resumedAt indicator chip, heartbeat-based stale detection.
//
// Existing features preserved: Yes (new file).
// ============================================================================

// =============================================================================
// TYPES
// =============================================================================

interface Run {
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
  parentRunId?: string | null;
  lastProgressAt?: string | null;
  resumedAt?: string | null;
}

interface Props {
  runs: Run[];
  selectedRunId: string | null;
  onSelectRun: (runId: string) => void;
}

// =============================================================================
// HELPERS
// =============================================================================

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  complete: {
    label: "Complete",
    className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  },
  partial: {
    label: "Partial",
    className: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  },
  running: {
    label: "Running",
    className: "bg-sky-500/20 text-sky-300 border-sky-500/40",
  },
  failed: {
    label: "Failed",
    className: "bg-red-500/20 text-red-300 border-red-500/40",
  },
  pending: {
    label: "Pending",
    className: "bg-white/10 text-slate-200 border-white/20",
  },
};

function isStale(run: Run): boolean {
  if (run.status !== "running") return false;
  // v1.2.0: Use lastProgressAt heartbeat if available, fall back to createdAt
  const progressTime = run.lastProgressAt
    ? new Date(run.lastProgressAt).getTime()
    : new Date(run.createdAt).getTime();
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  return progressTime < tenMinutesAgo;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// =============================================================================
// COMPONENT
// =============================================================================

export function RunHistoryTable({ runs, selectedRunId, onSelectRun }: Props) {
  if (runs.length === 0) {
    return (
      <div
        className="rounded-lg border border-white/10 bg-white/5 text-slate-300"
        style={{
          padding: "clamp(20px, 2.5vw, 40px)",
          fontSize: "clamp(12px, 1.1vw, 14px)",
          textAlign: "center",
        }}
      >
        No runs found. Run the batch runner to generate data.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-white/10 bg-white/5">
            {[
              "Run ID",
              "Created",
              "Status",
              "Mode",
              "Scope",
              "Scorer",
              "Reps",
              "Mean",
              "Flagged",
            ].map((header) => (
              <th
                key={header}
                className="text-left font-medium text-slate-200"
                style={{
                  fontSize: "clamp(10px, 0.9vw, 12px)",
                  padding: "clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)",
                  letterSpacing: "0.03em",
                  textTransform: "uppercase" as const,
                }}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
            const isSelected = run.runId === selectedRunId;
            const stale = isStale(run);
            const FALLBACK_BADGE = {
              label: "Unknown",
              className: "bg-white/10 text-slate-200 border-white/20",
            };
            const statusInfo = STATUS_BADGE[run.status] ?? FALLBACK_BADGE;

            return (
              <tr
                key={run.runId}
                onClick={() => onSelectRun(run.runId)}
                className={`cursor-pointer border-b border-white/5 transition-colors hover:bg-white/10 ${
                  isSelected
                    ? "bg-purple-500/10 ring-1 ring-inset ring-purple-500/30"
                    : ""
                }`}
              >
                {/* Run ID (truncated) + rerun indicator */}
                <td
                  className="font-mono text-slate-200"
                  style={{
                    fontSize: "clamp(10px, 0.9vw, 12px)",
                    padding: "clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)",
                  }}
                >
                  <span className="flex items-center" style={{ gap: "clamp(4px, 0.4vw, 6px)" }}>
                    {run.runId.slice(0, 16)}
                    {run.parentRunId && (
                      <span
                        className="inline-block rounded-full border bg-purple-500/20 text-purple-300 border-purple-500/40 font-medium"
                        style={{
                          fontSize: "clamp(8px, 0.7vw, 10px)",
                          padding: "clamp(0px, 0.1vh, 2px) clamp(4px, 0.4vw, 6px)",
                        }}
                        title={`Rerun child of ${run.parentRunId}`}
                      >
                        ↩ rerun
                      </span>
                    )}
                  </span>
                </td>

                {/* Created */}
                <td
                  className="text-slate-200"
                  style={{
                    fontSize: "clamp(10px, 0.9vw, 13px)",
                    padding: "clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatDate(run.createdAt)}
                </td>

                {/* Status badge */}
                <td
                  style={{
                    padding: "clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)",
                  }}
                >
                  <span
                    className="flex items-center"
                    style={{ gap: "clamp(4px, 0.4vw, 6px)" }}
                  >
                    <span
                      className={`inline-block rounded-full border font-medium ${statusInfo.className}`}
                      style={{
                        fontSize: "clamp(10px, 0.8vw, 11px)",
                        padding:
                          "clamp(1px, 0.15vh, 3px) clamp(6px, 0.6vw, 10px)",
                      }}
                    >
                      {statusInfo.label}
                    </span>
                    {stale && (
                      <span
                        className="text-amber-400"
                        style={{ fontSize: "clamp(10px, 0.8vw, 11px)" }}
                        title="No progress for over 10 minutes"
                      >
                        Stale
                      </span>
                    )}
                    {run.resumedAt && (
                      <span
                        className="inline-block rounded-full border bg-sky-500/15 text-sky-300 border-sky-500/30 font-medium"
                        style={{
                          fontSize: "clamp(8px, 0.7vw, 10px)",
                          padding: "clamp(0px, 0.1vh, 2px) clamp(4px, 0.4vw, 6px)",
                        }}
                        title={`Resumed: ${formatDate(run.resumedAt)}`}
                      >
                        ↻ resumed
                      </span>
                    )}
                  </span>
                </td>

                {/* Mode */}
                <td
                  className="text-slate-200"
                  style={{
                    fontSize: "clamp(10px, 0.9vw, 13px)",
                    padding: "clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)",
                  }}
                >
                  {run.mode === "user_sample" ? (
                    <span
                      className="inline-block rounded-full border bg-teal-500/20 text-teal-300 border-teal-500/40 font-medium"
                      style={{
                        fontSize: "clamp(9px, 0.75vw, 11px)",
                        padding: "clamp(1px, 0.1vh, 3px) clamp(6px, 0.5vw, 8px)",
                      }}
                    >
                      ⚡ sample
                    </span>
                  ) : (
                    run.mode
                  )}
                </td>

                {/* Scope */}
                <td
                  className="font-mono text-slate-200"
                  style={{
                    fontSize: "clamp(10px, 0.9vw, 12px)",
                    padding: "clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)",
                  }}
                >
                  {run.scope === "all" ? "All (40)" : run.scope}
                </td>

                {/* Scorer */}
                <td
                  className="text-slate-200"
                  style={{
                    fontSize: "clamp(10px, 0.9vw, 12px)",
                    padding: "clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)",
                  }}
                >
                  {run.scorerMode.replace(/_/g, " ")}
                </td>

                {/* Replicates */}
                <td
                  className="font-mono text-slate-200"
                  style={{
                    fontSize: "clamp(10px, 0.9vw, 13px)",
                    padding: "clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)",
                    textAlign: "center",
                  }}
                >
                  {run.replicateCount}
                </td>

                {/* Mean score */}
                <td
                  className={`font-mono font-semibold ${
                    run.meanGptScore !== null
                      ? run.meanGptScore < 70
                        ? "text-red-400"
                        : run.meanGptScore < 80
                          ? "text-amber-400"
                          : run.meanGptScore >= 90
                            ? "text-emerald-400"
                            : "text-white"
                      : "text-slate-300"
                  }`}
                  style={{
                    fontSize: "clamp(11px, 1vw, 14px)",
                    padding: "clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)",
                  }}
                >
                  {run.meanGptScore !== null
                    ? run.meanGptScore.toFixed(1)
                    : "—"}
                </td>

                {/* Flagged count */}
                <td
                  className={`font-mono ${run.flaggedCount > 0 ? "text-red-400 font-semibold" : "text-white"}`}
                  style={{
                    fontSize: "clamp(10px, 0.9vw, 13px)",
                    padding: "clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)",
                    textAlign: "center",
                  }}
                >
                  {run.flaggedCount}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
