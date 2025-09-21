// src/routes/health.ts
import { Router } from "express";

const r = Router();

r.get("/health", (_req, res) => {
  res.json({ ok: true, service: "promagen-api" });
});

export default r;



