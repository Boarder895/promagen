import { Router } from "express";
import type { JobStore, Job } from "../jobs/store";

export function makeJobsRouter(store: JobStore) {
  const r = Router();

  // POST /api/v1/jobs  ->  { id }
  // body: { provider: string; durationMs?: number; failureRate?: number }
  r.post("/", (req, res) => {
    const { provider, durationMs, failureRate } = req.body || {};
    if (!provider || typeof provider !== "string") {
      return res.status(400).json({ error: "provider is required" });
    }
    const dur = Math.max(500, Math.min(60000, Number(durationMs) || 4000));
    const fail = Math.max(0, Math.min(0.9, Number(failureRate) || 0.08));
    const job = store.createAndRun(provider, dur, fail);
    return res.status(202).json({ id: job.id });
  });

  // GET /api/v1/jobs/:id  ->  job JSON
  r.get("/:id", (req, res) => {
    const job = store.get(req.params.id);
    if (!job) return res.status(404).json({ error: "not found" });
    return res.status(200).json(job);
  });

  // GET /api/v1/jobs/:id/stream  ->  SSE stream of updates
  r.get("/:id/stream", (req, res) => {
    const id = req.params.id;
    const job = store.get(id);
    if (!job) return res.status(404).end();

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    const send = (type: string, payload: any) => {
      res.write(`event: ${type}\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    // initial snapshot
    send("update", { job });

    const onMsg = (ev: any) => {
      if (ev?.job?.id !== id) return;
      send("update", { job: ev.job as Job });
      if (ev.job.state === "ok" || ev.job.state === "error") {
        // gentle delay so client can process final event
        setTimeout(() => res.end(), 150);
      }
    };

    store.on(id, onMsg);

    // keep-alive ping every 15s
    const ping = setInterval(() => send("ping", { t: Date.now() }), 15000);

    req.on("close", () => {
      clearInterval(ping);
      store.off(id, onMsg);
    });
  });

  return r;
}
