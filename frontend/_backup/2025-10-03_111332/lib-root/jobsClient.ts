// Named exports only.
// Tiny client for the demo "run across providers" flow.

export type StartJobPayload = {
  providerId: string;
  prompt: string;
};

export type Job = {
  id: string;
  state: "queued" | "running" | "done" | "error";
  progress?: number;
  outputUrl?: string | null;
  error?: string | null;
};

export type JobEvent =
  | { type: "progress"; job: Job }
  | { type: "done"; job: Job }
  | { type: "error"; job: Job };

export async function startGeneration(payload: StartJobPayload): Promise<string> {
  const res = await fetch("/api/v1/jobs/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`startGeneration failed (${res.status}): ${text}`);
  }

  const data: unknown = await res.json();
  // Expect shape { jobId: string }
  if (
    typeof data === "object" &&
    data !== null &&
    "jobId" in data &&
    typeof (data as { jobId: unknown }).jobId === "string"
  ) {
    return (data as { jobId: string }).jobId;
  }
  throw new Error("startGeneration: unexpected response shape");
}

/**
 * Subscribe to Server-Sent Events for a job.
 * Server should emit "progress", "done", "error" with data: {"job":{...}}
 * Returns a stop() function to close the stream.
 */
export function streamJob(jobId: string, onEvent: (e: JobEvent) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const es = new EventSource(`/api/v1/jobs/${encodeURIComponent(jobId)}/stream`);

  es.addEventListener("progress", (evt) => {
    try {
      const parsed = JSON.parse((evt as MessageEvent).data) as { job: Job };
      onEvent({ type: "progress", job: parsed.job });
    } catch {
      /* ignore */
    }
  });

  es.addEventListener("done", (evt) => {
    try {
      const parsed = JSON.parse((evt as MessageEvent).data) as { job: Job };
      onEvent({ type: "done", job: parsed.job });
    } finally {
      es.close();
    }
  });

  es.addEventListener("error", (evt) => {
    try {
      const parsed = JSON.parse((evt as MessageEvent).data) as { job: Job };
      onEvent({ type: "error", job: parsed.job });
    } finally {
      es.close();
    }
  });

  es.onerror = () => es.close();
  return () => es.close();
}

