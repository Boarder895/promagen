// BACKEND · EXPRESS
// File: C:\Users\Martin Yarnold\Projects\promagen\api\src\routes\providers.ts

import { Router } from "express";
import { PROVIDERS } from "../providers/registry";
import { runAllChecksCached, scoreFromStatus } from "../services/health";
import { cache } from "../services/cache";
import { prisma } from "../db/prisma";

export const providersRouter = Router({ mergeParams: true });

/**
 * GET /api/v1/providers/health
 * - Runs (cached) health checks for all providers
 * - Applies DB overrides (if any)
 * - Computes deltas vs latest snapshot batch (if exists)
 */
providersRouter.get("/providers/health", async (_req, res) => {
  const results = await runAllChecksCached();

  // load overrides from DB
  const dbOverrides = await prisma.providerOverride.findMany();
  const overrideMap = new Map(dbOverrides.map(o => [o.providerId, o.adjustment]));

  // latest batch
  const latestBatch = await prisma.providerSnapshotBatch.findFirst({
    orderBy: { createdAt: "desc" },
    include: { snapshots: true },
  });
  const lastMap = new Map(
    (latestBatch?.snapshots || []).map(s => [s.providerId, s.score])
  );

  const withScores = results
    .map(r => {
      const auto = scoreFromStatus(r.status, r.latencyMs);
      const adj = overrideMap.get(r.id) ?? 0;
      const score = Math.max(0, Math.min(100, auto + adj));
      return { ...r, autoScore: auto, adjustment: adj, score };
    })
    .sort((a, b) => b.score - a.score);

  const deltas: Record<string, number> = {};
  for (const row of withScores) {
    const prev = lastMap.get(row.id);
    if (typeof prev === "number") {
      deltas[row.id] = Number((row.score - prev).toFixed(1));
    }
  }

  res.status(200).json({
    providers: withScores,
    deltas,
    snapshotAt: latestBatch?.createdAt ?? null,
  });
});

/**
 * POST /api/v1/leaderboard/snapshot
 * - Creates a batch + per-provider rows with AUTO score (no overrides baked in)
 * - Purges the cache so next health read reflects a fresh run (optional)
 */
providersRouter.post("/leaderboard/snapshot", async (_req, res) => {
  const results = await runAllChecksCached();

  const providers = results.map(r => ({
    providerId: r.id,
    status: r.status,
    latencyMs: r.latencyMs ?? null,
    score: Math.max(0, Math.min(100, scoreFromStatus(r.status, r.latencyMs))),
    note: r.note || null,
  }));

  const batch = await prisma.providerSnapshotBatch.create({
    data: {
      snapshots: { createMany: { data: providers } },
    },
    include: { snapshots: true },
  });

  // optional: invalidate cache key for immediate freshness
  cache.clear("providers:health");

  res.status(200).json({
    ok: true,
    batchId: batch.id,
    count: batch.snapshots.length,
    createdAt: batch.createdAt,
  });
});

/**
 * POST /api/v1/admin/overrides
 * Body: { id: string, adjustment: number }
 * - Upserts override in DB
 */
providersRouter.post("/admin/overrides", async (req, res) => {
  const { id, adjustment } = req.body || {};
  if (!id || typeof adjustment !== "number") {
    return res.status(400).json({ error: "id (string) and adjustment (number) required" });
  }

  // sanity clamp server-side (UI already keeps it polite)
  const clamped = Math.max(-100, Math.min(100, Math.trunc(adjustment)));

  const row = await prisma.providerOverride.upsert({
    where: { providerId: id },
    update: { adjustment: clamped },
    create: { providerId: id, adjustment: clamped },
  });

  // optional: refresh cache so health reflects the new override
  cache.clear("providers:health");

  return res.status(200).json({ ok: true, override: row });
});

/**
 * POST /api/v1/admin/cache/purge
 */
providersRouter.post("/admin/cache/purge", (_req, res) => {
  cache.clear("providers:health");
  res.status(200).json({ ok: true });
});

/**
 * GET /api/v1/leaderboard/current
 * - Public, read-only leaderboard (auto score only; no overrides/deltas)
 */
providersRouter.get("/leaderboard/current", async (_req, res) => {
  const results = await runAllChecksCached();
  const providers = results
    .map(r => {
      const auto = scoreFromStatus(r.status, r.latencyMs);
      const score = Math.max(0, Math.min(100, auto));
      return { id: r.id, name: r.name, status: r.status, latencyMs: r.latencyMs, score };
    })
    .sort((a, b) => b.score - a.score);

  res.status(200).json({ providers, generatedAt: new Date().toISOString() });
});
