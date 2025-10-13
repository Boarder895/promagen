import { Router } from "express";
import type { JobStore } from "../jobs/store";

export function makeJobsAdminRouter(store: JobStore) {
  const r = Router();

  // GET /api/v1/jobs-admin/recent?limit=50
  r.get("/recent", (req, res) => {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const jobs = store.list(limit);
    res.status(200).json({ jobs });
  });

  return r;
}
