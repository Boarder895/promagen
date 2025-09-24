import { Router } from "express";

const router = Router();

router.get("/", async (_req, res) => {
  let db: { ok: boolean; message: string } = { ok: false, message: "disabled" };
  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("../db/prisma.js");
      await prisma.$queryRaw`SELECT 1`;
      db = { ok: true, message: "connected" };
    } catch (err: any) {
      db = { ok: false, message: err?.message || "failed" };
    }
  }

  res.json({
    name: "Promagen API",
    version: "v1",
    uptimeSec: Math.round(process.uptime()),
    nowIso: new Date().toISOString(),
    db
  });
});

export default router;

