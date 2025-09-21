import { Router } from "express";
import prisma from "../lib/db";

const r = Router();

r.get("/score", async (req, res) => {
  const providerId = String(req.query.providerId || "");
  if (!providerId) return res.status(400).json({ ok: false, error: "providerId required" });

  // @ts-ignore
  const [row] = await prisma.$queryRawUnsafe<Array<{
    ts_utc: Date, score_0_100: number,
    c_promagen_usage: number, c_search_pulse: number, c_reddit_mentions: number, c_community: number, c_health: number
  }>>(
    `
    SELECT ts_utc, score_0_100,
           c_promagen_usage, c_search_pulse, c_reddit_mentions, c_community, c_health
    FROM live_scores
    WHERE provider_id = $1
    ORDER BY ts_utc DESC
    LIMIT 1
    `,
    providerId
  );

  if (!row) return res.json({ ok: true, providerId, score: null });

  return res.json({
    ok: true,
    providerId,
    updatedAt: row.ts_utc,
    score: Math.round(row.score_0_100),
    components: {
      promagen_usage: Math.round(row.c_promagen_usage),
      search_pulse:   Math.round(row.c_search_pulse),
      reddit:         Math.round(row.c_reddit_mentions),
      community:      Math.round(row.c_community),
      health:         Math.round(row.c_health),
    }
  });
});

r.get("/board", async (_req, res) => {
  // latest score per provider + live users badge (from latest raw metric)
  // @ts-ignore
  const rows = await prisma.$queryRawUnsafe<Array<{
    provider_id: string, name: string, slug: string | null,
    score_0_100: number, ts_utc: Date,
    promagen_active_users: number | null
  }>>(
    `
    WITH latest_score AS (
      SELECT DISTINCT ON (provider_id) provider_id, score_0_100, ts_utc
      FROM live_scores
      ORDER BY provider_id, ts_utc DESC
    ),
    latest_raw AS (
      SELECT DISTINCT ON (provider_id) provider_id, promagen_active_users
      FROM live_raw_metrics
      ORDER BY provider_id, ts_utc DESC
    )
    SELECT p.id as provider_id, p.name, p.slug,
           ls.score_0_100, ls.ts_utc,
           lr.promagen_active_users
    FROM providers p
    LEFT JOIN latest_score ls ON p.id = ls.provider_id
    LEFT JOIN latest_raw   lr ON p.id = lr.provider_id
    ORDER BY ls.score_0_100 DESC NULLS LAST, p.name ASC
    `
  );

  const data = rows.map(r => ({
    providerId: r.provider_id,
    name: r.name,
    slug: r.slug,
    score: r.score_0_100 != null ? Math.round(r.score_0_100) : null,
    updatedAt: r.ts_utc ?? null,
    promagenActiveUsers: r.promagen_active_users ?? 0
  }));

  res.json({ ok: true, data });
});

export default r;


