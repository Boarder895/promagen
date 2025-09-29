"use client";

import { useState } from "react";
import { startJob, streamJob, JobEvent } from "@/lib/jobs";
import { useProgress } from "@/components/ProgressProvider";
import ProgressBar from "@/components/ProgressBar";

type Provider = { id: string; name: string };
type UiState = "idle" | "queued" | "running" | "ok" | "error";

export default function SSEGrid({ providers }: { providers: Provider[] }) {
  const { enqueue, update } = useProgress();
  const [local, setLocal] = useState<Record<string, { state: UiState; progress: number }>>({});

  async function runOne(p: Provider) {
    // optimistic local → queued (first SSE event is queued)
    setLocal((s) => ({ ...s, [p.id]: { state: "queued", progress: 0 } }));

    const startedAt = Date.now();
    const tmpId = `${p.id}-${startedAt}`;
    enqueue({ id: tmpId, provider: p.id, label: p.name, state: "running", startedAt, progress: 0 });

    // start job on backend
    const jobId = await startJob(p.id, { durationMs: 4000, failureRate: 0.08 });

    // subscribe to SSE updates
    const stop = streamJob(jobId, (ev: JobEvent) => {
      const j = ev.job;
      const state: UiState =
        j.state === "queued" || j.state === "running" || j.state === "ok" || j.state === "error"
          ? j.state
          : "running";

      setLocal((s) => ({ ...s, [p.id]: { state, progress: Number(j.progress ?? 0) } }));

      update(tmpId, {
        id: j.id,
        state,
        progress: Number(j.progress ?? 0),
        tookMs: j.tookMs,
        endedAt: j.endedAt,
        error: j.error,
      });

      if (state === "ok" || state === "error") stop();
    });
  }

  function runAll() {
    for (const p of providers) runOne(p);
  }

  return (
    <div className="space-y-4">
      <div>
        <button onClick={runAll} className="rounded-xl border px-4 py-2 hover:bg-gray-50">
          Run All (20)
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {providers.map((p) => {
          const st: UiState = local[p.id]?.state ?? "idle";
          const pr = local[p.id]?.progress ?? 0;

          return (
            <div key={p.id} className="rounded-2xl border p-4">
              <div className="flex items-center justify-between">
                <div className="font-medium">{p.name}</div>
                <StatusChip state={st} />
              </div>

              <button
                onClick={() => runOne(p)}
                className="mt-3 w-full rounded-xl border px-3 py-2 hover:bg-gray-50 disabled:opacity-60"
                disabled={st === "queued" || st === "running"}
              >
                {st === "running" || st === "queued" ? "Generating…" : "Run"}
              </button>

              {st !== "idle" && (
                <div className="mt-3">
                  <ProgressBar value={pr} />
                  <div className="mt-1 text-xs opacity-70">{Math.round(pr)}%</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusChip({ state }: { state: UiState }) {
  const map: Record<
    UiState,
    { t: string; c: string; dot: string }
  > = {
    idle:   { t: "Idle",    c: "border-gray-300 bg-gray-50",  dot: "#6b7280" },
    queued: { t: "Queued",  c: "border-gray-300 bg-gray-50",  dot: "#6b7280" },
    running:{ t: "Running", c: "border-blue-300 bg-blue-50", dot: "#2563eb" },
    ok:     { t: "Success", c: "border-green-300 bg-green-50", dot: "#16a34a" },
    error:  { t: "Error",   c: "border-red-300 bg-red-50",   dot: "#dc2626" },
  };

  // Defensive fallback so we never crash if an unknown state slips through
  const m = map[state] ?? map.idle;

  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-0.5 text-xs border ${m.c}`}>
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.dot }} />
      {m.t}
    </span>
  );
}
