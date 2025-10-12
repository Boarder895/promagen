import { Router } from "express";
import type { JobStore } from "../jobs/store";
import { findProvider } from "../providers/registry";

type GenBody = {
  provider: string;
  prompt: string;
  size?: "512x512" | "1024x1024";
};

export function makeGenerateRouter(store: JobStore) {
  const r = Router();

  r.post("/", async (req, res) => {
    const { provider, prompt, size = "1024x1024" } = (req.body || {}) as GenBody;
    const def = findProvider(provider);
    if (!def) return res.status(404).json({ error: "unknown provider" });
    if (!prompt) return res.status(400).json({ error: "prompt is required" });

    // Always create a job immediately for SSE
    const job = store.create(def.id);
    res.status(202).json({ id: job.id });

    // Real adapter?
    const envOk = (def.envKeys ?? []).every(k => !!process.env[k]);
    if (def.adapter && envOk) {
      try {
        await def.adapter({ store, jobId: job.id, prompt, size });
      } catch (e: any) {
        store.finishError(job.id, String(e?.message || e));
      }
      return;
    }

    // Fallback: simulate (so the UI works for every provider)
    await store.simulate(job.id, 4000, 0.08);
    store.finishOk(job.id, { imageUrl: `https://placehold.co/1024?text=${encodeURIComponent(def.name)}` });
  });

  return r;
}
