import { Router } from "express";

const router = Router();

/** Basic health probe */
router.get("/", (_req, res) => {
  res.json({
    ok: true,
    name: "Promagen API",
    pid: process.pid,
    uptimeSec: Math.floor(process.uptime()),
    nowIso: new Date().toISOString(),
  });
});

export default router;
