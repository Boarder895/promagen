// Named-exports only (Promagen rule).
// Lightweight client for demo job runs. Uses your versioned API: /api/v1/*

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
  // Narrow: expect { jobId: string }
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
 * Stream job events via SSE. Server should send lines like:
 *  event: progress
 *  data: {"job":{"id":"...","state":"running","progress":42}}
 *
 * Returns a stop() function that closes the stream.
 */
export function streamJob(jobId: string, onEvent: (e: JobEvent) => void): () => void {
  // Ensure client-side usage
  if (typeof window === "undefined") {
    return () => {};
  }

  const url = `/api/v1/jobs/${encodeURIComponent(jobId)}/stream`;
  const es = new EventSource(url);

  es.addEventListener("progress", (evt) => {
    try {
      const parsed = JSON.parse((evt as MessageEvent).data) as { job: Job };
      onEvent({ type: "progress", job: parsed.job });
    } catch {
      // ignore parse errors
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

  es.onerror = () => {
    // network/server error — close to avoid zombie connection
    es.close();
  };

  return () => es.close();
}

