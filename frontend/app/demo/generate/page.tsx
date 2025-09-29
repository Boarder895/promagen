"use client";

import { useEffect, useState } from "react";
import { getProviders, ProviderStatus } from "@/lib/providers";
import { startGeneration } from "@/lib/generate";
import { streamJob, JobEvent } from "@/lib/jobs";
import { useProgress } from "@/components/ProgressProvider";
import ModeChip from "@/components/ModeChip";
import ProgressBar from "@/components/ProgressBar";

export default function Page() {
  const [prompt, setPrompt] = useState(
    "a luminous mushroom town at sunset, cinematic, ultra detailed"
  );
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [local, setLocal] = useState<
    Record<string, { state: string; progress: number; url?: string }>
  >({});
  const { enqueue, update } = useProgress();

  useEffect(() => {
    getProviders().then(setProviders).catch(() => setProviders([]));
  }, []);

  async function runOne(p: ProviderStatus) {
    const startedAt = Date.now();
    const tmpId = `${p.id}-${startedAt}`;
    enqueue({
      id: tmpId,
      provider: p.id,
      label: p.name,
      state: "running",
      startedAt,
      progress: 0,
    });
    setLocal((s) => ({ ...s, [p.id]: { state: "queued", progress: 0 } }));

    const jobId = await startGeneration(p.id, prompt);
    const stop = streamJob(jobId, (ev: JobEvent) => {
      const j = ev.job as any;
      const url: string | undefined = j?.result?.imageUrl;
      setLocal((s) => ({
        ...s,
        [p.id]: { state: j.state, progress: j.progress, url },
      }));
      update(tmpId, {
        id: j.id,
        state: j.state,
        progress: j.progress,
        tookMs: j.tookMs,
        endedAt: j.endedAt,
        error: j.error,
      });
      if (j.state === "ok" || j.state === "error") stop();
    });
  }

  function runAll(filter: "all" | "real") {
    providers.filter(p => (filter === "all" ? true : p.mode === "real")).forEach(runOne);
  }

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">Demo · Generate across all providers</h1>

      <div className="rounded-2xl border p-4 space-y-3">
        <label className="block text-sm font-medium">Prompt</label>
        <textarea
          className="w-full rounded-xl border p-3"
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <div className="flex gap-3">
          <button
            onClick={() => runAll("all")}
            className="rounded-xl border px-4 py-2 hover:bg-gray-50"
          >
            Run All
          </button>
          <button
            onClick={() => runAll("real")}
            className="rounded-xl border px-4 py-2 hover:bg-gray-50"
          >
            Run API-enabled only
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {providers.map((p) => {
          const st = local[p.id]?.state ?? "idle";
          const pr = local[p.id]?.progress ?? 0;
          const url = local[p.id]?.url;

          return (
            <div key={p.id} className="rounded-2xl border p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium">{p.name}</div>
                {/* Map 'copy' => 'simulated' so ModeChip’s union type is satisfied */}
                <ModeChip mode={p.mode === "copy" ? "simulated" : p.mode} />
              </div>

              <button
                className="w-full rounded-xl border px-3 py-2 hover:bg-gray-50 disabled:opacity-60"
                disabled={st === "queued" || st === "running" || p.mode === "disabled"}
                onClick={() => runOne(p)}
              >
                {st === "queued" || st === "running"
                  ? "Generating…"
                  : p.mode === "disabled"
                  ? "Unavailable"
                  : "Run"}
              </button>

              {st !== "idle" && (
                <>
                  <ProgressBar value={pr} />
                  <div className="text-xs opacity-70">{Math.round(pr)}%</div>
                </>
              )}

              {st === "ok" && url && (
                <a
                  className="block text-sm underline break-all"
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open result
                </a>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
