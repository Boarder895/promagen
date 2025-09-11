// BACKEND
import { Router } from "express";
const r = Router();

// Stub: secure behind auth when deploying
r.post("/cron/import", async (_req, res) => {
  res.json({ ok: true, message: "Import job stub executed." });
});

export default r;
