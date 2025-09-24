import { Router } from "express";

const router = Router();

/**
 * Admin (stub) — we'll add guards later.
 */
router.get("/ping", (_req, res) => {
  res.json({ ok: true, t: Date.now() });
});

export default router;
