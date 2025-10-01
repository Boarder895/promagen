"use client";

import { useState } from "react";
import type { JobEvent } from "@/lib/jobsClient";
import { startGeneration, streamJob } from "@/lib/jobsClient";

type Provider = {
  id: string;
  name: string;
};

type JobState = "queued" | "running" | "done" | "error";

type RunState = Record<
  string,
  { state: JobState; progress: number; jobId?: string; outputUrl?: string | null; error?: string | null }
>;

type RunGridProps = {
  providers: Provider[];
  defaultPrompt?: string;
};

export function RunGrid({ providers, defaultPrompt = "" }: RunGridProps) {
  const [prompt, setPrompt] = useState<string>(defaultPrompt);
  const [local, setLocal] = useState<RunState>({});

  async function runOne(p: Provider) {
    setLocal((s) => ({ ...s, [p.id]: { state: "queued", progress: 0 } }));

    const jobId = await startGeneration({ providerId: p.id, prompt });

    setLocal((s) => ({ ...s, [p.id]: { ...s[p.id], state: "running", progress: 0, jobId } }));

    const stop = streamJob(jobId, (ev: JobEvent) => {
      const j = ev.job;
      if (ev.type === "progress") {
        setLocal((s) => ({
          ...s,
          [p.id]: { ...s[p.id], state: j.state, progress: j.progress ?? s[p.id]?.progress ?? 0 },
        }));
      } else if (ev.type === "done") {
        setLocal((s) => ({
          ...s,
          [p.id]: {
            ...s[p.id],
            state: "done",
            progress: 100,
            outputUrl: j.outputUrl ?? null,
          },
        }));
        stop();
      } else if (ev.type === "error") {
        setLocal((s) => ({
          ...s,
          [p.id]: {
            ...s[p.id],
            state: "error",
            progress: 0,
            error: j.error ?? "Unknown error",
          },
        }));
        stop();
      }
    });
  }

  async function runAll() {
    for (const p of providers) {
      // eslint-disable-next-line no-await-in-loop
      await runOne(p);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <label className="flex grow flex-col gap-1">
          <span className="text-sm font-medium">Prompt</span>
          <textarea
            className="min-h-[72px] rounded border px-3 py-2"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the image you want to generate..."
          />
        </label>

        <button
          type="button"
          className="h-10 rounded bg-black px-4 text-white disabled:opacity-50 dark:bg-white dark:text-black"
          onClick={runAll}
          disabled={providers.length === 0 || prompt.trim().length === 0}
        >
          Run across providers
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {providers.map((p) => {
          const st = local[p.id];
          const pct = Math.max(0, Math.min(100, st?.progress ?? 0));
          return (
            <div key={p.id} className="rounded border p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-medium">{p.name}</div>
                <button
                  type="button"
                  className="text-sm underline opacity-80 hover:opacity-100"
                  onClick={() => runOne(p)}
                >
                  Run
                </button>
              </div>

              <div className="text-xs opacity-75">State: {st?.state ?? "idle"}</div>

              <div className="mt-2 h-2 w-full rounded bg-gray-200">
                <div
                  className="h-2 rounded bg-blue-600"
                  style={{ width: `${pct}%` }}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct}
                  role="progressbar"
                />
              </div>

              {st?.outputUrl ? (
                <div className="mt-3">
                  <a
                    href={st.outputUrl}
                    className="text-sm text-blue-600 underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    View output
                  </a>
                </div>
              ) : null}

              {st?.error ? <div className="mt-3 text-sm text-red-600">Error: {st.error}</div> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}



