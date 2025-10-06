"use client";

import { useEffect, useRef, useState } from "react";

/** Promagen-lite job types (local to this file so it compiles even if upstream types move) */
type JobState = "queued" | "running" | "succeeded" | "failed";

export type RunState = {
  id: string;              // stable UI id for the row/card
  state: JobState;         // current state
  progress?: number;       // 0–100
  jobId?: string;          // provider job id (optional)
  outputUrl?: string | null;
  error?: string | null;
};

/** Public props: keep tiny; you can pass a jobId or let it render a demo row */
type Props = {
  jobId?: string;
  onUpdate?: (next: RunState) => void; // optional external tap for state changes
};

/** Named export only (project rule). */
export const RunGrid = ({ jobId, onUpdate }: Props) => {
  const [rows, setRows] = useState<RunState[]>(() => [
    {
      id: jobId ?? "demo-1",
      state: "queued",
      progress: 0,
      jobId,
      outputUrl: null,
      error: null,
    },
  ]);

  // simple fake “progress” so the UI is alive while you reconnect the real stream
  const timer = useRef<number | null>(null);

  useEffect(() => {
    // clear any old timer
    if (timer.current) {
      window.clearInterval(timer.current);
      timer.current = null;
    }

    // drive a gentle progress loop
    timer.current = window.setInterval(() => {
      setRows((prev) => {
        const next = prev.map((r) => {
          if (r.state === "succeeded" || r.state === "failed") return r;

          const nextProgress = Math.min(100, (r.progress ?? 0) + 5);
          const nextState: JobState =
            nextProgress >= 100 ? "succeeded" : (r.state === "queued" ? "running" : r.state);

          const updated: RunState = {
            ...r,
            state: nextState,
            progress: nextProgress,
            outputUrl: nextProgress >= 100 ? (r.outputUrl ?? "#") : r.outputUrl,
          };

          onUpdate?.(updated);
          return updated;
        });
        return next;
      });
    }, 400) as unknown as number;

    return () => {
      if (timer.current) window.clearInterval(timer.current);
      timer.current = null;
    };
  }, [onUpdate]);

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-3">Run Grid</h2>
      <div className="overflow-x-auto rounded-xl border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <Th>ID</Th>
              <Th>State</Th>
              <Th>Progress</Th>
              <Th>Output</Th>
              <Th>Error</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <Td className="font-mono">{r.id}</Td>
                <Td>
                  <StateBadge state={r.state} />
                </Td>
                <Td>
                  <ProgressBar value={r.progress ?? 0} />
                </Td>
                <Td>
                  {r.outputUrl ? (
                    <a href={r.outputUrl} className="underline" target="_blank" rel="noreferrer">
                      open
                    </a>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </Td>
                <Td>
                  {r.error ? <span className="text-red-600">{r.error}</span> : <span className="text-gray-400">—</span>}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Hook to wire your real stream later */}
      <div className="mt-3 text-xs text-gray-500">
        Streaming hook: call <code>setRows(fn)</code> inside your stream handler when <code>ev.type === "update"</code>.
      </div>
    </div>
  );
};

/** Tiny UI helpers (kept local to avoid import churn) */
const Th = (props: { children: React.ReactNode }) => (
  <th className="text-left font-semibold px-3 py-2">{props.children}</th>
);
const Td = (props: { children: React.ReactNode; className?: string }) => (
  <td className={`px-3 py-2 ${props.className ?? ""}`}>{props.children}</td>
);

const ProgressBar = ({ value }: { value: number }) => (
  <div className="w-40 h-2 rounded bg-gray-200">
    <div className="h-2 rounded" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: "currentColor" }} />
    <span className="ml-2 align-middle">{Math.round(value)}%</span>
  </div>
);

const StateBadge = ({ state }: { state: JobState }) => {
  const cls =
    state === "succeeded"
      ? "bg-green-100 text-green-700"
      : state === "failed"
      ? "bg-red-100 text-red-700"
      : state === "running"
      ? "bg-amber-100 text-amber-700"
      : "bg-gray-100 text-gray-700";
  return <span className={`px-2 py-1 rounded ${cls}`}>{state}</span>;
};

