// src/routes/platforms.ts
import { Router } from "express";
import { PROVIDERS, PROVIDER_LABELS } from "../lib/providers";

const r = Router();

/**
 * GET /api/platforms
 * Returns all supported providers with id + human-readable label.
 */
r.get("/platforms", (_req, res) => {
  const list = PROVIDERS.map(p => ({
    id: p,
    name: PROVIDER_LABELS[p]
  }));

  res.json({ ok: true, providers: list });
});

export default r;
