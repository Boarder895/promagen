import { Router } from "express";

export const simulate = Router();

/**
 * POST /api/v1/simulate/run
 * Body: { provider: string; delayMs?: number; ok?: boolean }
 * Simulates a provider generation call: waits delayMs (default 2000) then returns { id, provider, ok, tookMs }.
 */
simulate.post("/run", async (req, res) => {
  const { provider, delayMs = 2000, ok = true } = req.body || {};
  if (!provider || typeof provider !== "string") {
    return res.status(400).json({ error: "provider is required" });
  }
  const d = Math.max(200, Math.min(30000, Number(delayMs) || 2000));
  const start = Date.now();
  await new Promise((r) => setTimeout(r, d));
  const tookMs = Date.now() - start;
  const id = `${provider}-${start}`;
  return res.status(200).json({ id, provider, ok: !!ok, tookMs });
});
