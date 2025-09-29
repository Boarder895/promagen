"use client";

import { useEffect, useMemo, useState } from "react";
import { getProviders, type ProviderStatus } from "@/lib/providers";
import { startGeneration } from "@/lib/generate";
import { streamJob, type JobEvent } from "@/lib/jobs";

type Local = {
  state: "idle" | "queued" | "running" | "ok" | "error";
  progress: number;
  url?: string;
  error?: string;
};

export default function PromptPlayground() {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [prompt, setPrompt] = useState(
    "a luminous mushroom town at sunset, cinematic, ultra detailed"
  );
  const [local, setLocal] = useState<Local>({ state: "idle", progress: 0 });

  useEffect(() => {
    getProviders().then((arr) => {
      setProviders(arr);
      // default to first API-enabled provider, else first in list
      const firstReal = arr.find((p) => p.mode === "real") ?? arr[0];
      if (firstReal) setSelected(firstReal.id);
    });
  }, []);

  const canRun = useMemo(() => {
    const p = providers.find((x) => x.id === selected);
    return !!p && p.mode !== "disabled" && local.state !== "running" && prompt.trim().length > 0;
  }, [providers, selected, local.state, prompt]);

  async function run() {
    const p = providers.find((x) => x.id === selected);
    if (!p) return;

    setLocal({ state: "queued", progress: 0, url: undefined, error: undefined });

    // use your existing simulator
    const jobId = await startGeneration(p.id as any, prompt);

    const stop = streamJob(jobId, (ev: JobEvent) => {
      const j = ev.job;
      setLocal({
        state: j.state,
        progress: j.progress ?? 0,
        url: j.result?.imageUrl,
        error: j.error,
      });
      if (j.state === "ok" || j.state === "error") stop();
    });
  }

  return (
    <section className="rounded-2xl border p-4 space-y-4">
      <div className="grid gap-3 md:grid-cols-[1fr_240px]">
        <textarea
          className="w-full rounded-xl border p-3 min-h-[120px]"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the image you want…"
        />

        <div className="space-y-3">
          <label className="block text-sm font-medium">Provider</label>
          <select
            className="w-full rounded-xl border p-2"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.mode === "copy" ? "· Copy/Open" : p.mode === "real" ? "· API" : "· Disabled"}
              </option>
            ))}
          </select>

          <button
            className="w-full rounded-xl border px-3 py-2 hover:bg-gray-50 disabled:opacity-60"
            onClick={run}
            disabled={!canRun}
            title={canRun ? "Run generation" : "Unavailable"}
          >
            {local.state === "running" || local.state === "queued" ? "Generating…" : "Run"}
          </button>
        </div>
      </div>

      {local.state !== "idle" && (
        <>
          <div className="h-2 w-full rounded bg-gray-200 overflow-hidden">
            <div className="h-2 bg-black/70" style={{ width: `${Math.round(local.progress)}%` }} />
          </div>
          <div className="text-xs opacity-70">{Math.round(local.progress)}%</div>
        </>
      )}

      {local.state === "ok" && local.url && (
        <a className="block text-sm underline break-all" href={local.url} target="_blank" rel="noreferrer">
          Open result
        </a>
      )}

      {local.state === "error" && local.error && (
        <div className="text-sm text-red-600 break-all">{local.error}</div>
      )}
    </section>
  );
}
