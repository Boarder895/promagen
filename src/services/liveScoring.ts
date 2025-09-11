import prisma from "../lib/db";
import { startOfHour } from "date-fns";

const W = {
  promagen_usage: 0.40,
  search_pulse:   0.25,
  reddit_mentions:0.20,
  community:      0.10, // placeholder (0 unless you add Discord presence later)
  health:         0.05,
};

// normalise helpers — replace with more robust baselines as you collect history
function normUsage(users: number, gensPerMin: number): number {
  // crude curve: users dominate, gens/min shapes within users
  const u = Math.min(users / 50, 1);       // 50 users → cap
  const g = Math.min(gensPerMin / 20, 1);  // 20 gens/min → cap
  return Math.round((0.7 * u + 0.3 * g) * 100);
}

function normPulse(v?: number | null): number {
  if (v == null) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function normMentions(perMin?: number | null): number {
  if (perMin == null) return 0;
  // 0.5/min is already busy for niche tools
  const capped = Math.min(perMin / 0.5, 1);
  return Math.round(capped * 100);
}

function normHealth(statusOk: boolean, ttfbMs: number): number {
  if (!statusOk) return 0;
  // 0ms best, 2000ms worst
  const x = Math.max(0, Math.min(1, 1 - ttfbMs / 2000));
  return Math.round(x * 100);
}

function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }
function clamp0_100(x: number) { return Math.max(0, Math.min(100, Math.round(x))); }

async function getOverrides(providerId: string) {
  // @ts-ignore
  const rows = await prisma.$queryRawUnsafe<{ manual_adjustment: number | null; hard_override: number | null }[]>(
    `SELECT manual_adjustment, hard_override FROM live_overrides WHERE provider_id = $1`,
    providerId
  );
  return rows[0] ?? { manual_adjustment: null, hard_override: null };
}

export async function computeLiveScores(): Promise<void> {
  // take the latest row per provider from the last 5 minutes
  // @ts-ignore
  const latest = await prisma.$queryRawUnsafe<Array<{
    provider_id: string,
    promagen_active_users: number | null,
    promagen_gens_per_min: number | null,
    search_pulse_index: number | null,
    reddit_mentions_per_min: number | null,
    status_ok: boolean | null,
    status_ttfb_ms: number | null
  }>>(
    `
    SELECT DISTINCT ON (provider_id)
      provider_id,
      promagen_active_users,
      promagen_gens_per_min,
      search_pulse_index,
      reddit_mentions_per_min,
      status_ok,
      status_ttfb_ms
    FROM live_raw_metrics
    WHERE ts_utc >= NOW() - INTERVAL '5 minutes'
    ORDER BY provider_id, ts_utc DESC
    `
  );

  for (const row of latest) {
    const u = normUsage(row.promagen_active_users ?? 0, row.promagen_gens_per_min ?? 0);
    const p = normPulse(row.search_pulse_index);
    const r = normMentions(row.reddit_mentions_per_min);
    const c = 0; // until you add Discord/community presence
    const h = normHealth(!!row.status_ok, row.status_ttfb_ms ?? 0);

    const weighted =
      W.promagen_usage * (u/100) +
      W.search_pulse   * (p/100) +
      W.reddit_mentions* (r/100) +
      W.community      * (c/100) +
      W.health         * (h/100);

    let score = clamp0_100(100 * weighted);

    const { manual_adjustment, hard_override } = await getOverrides(row.provider_id);
    if (hard_override != null) {
      score = clamp0_100(hard_override);
    } else if (manual_adjustment != null) {
      score = clamp0_100(score + manual_adjustment);
    }

    await prisma.$executeRawUnsafe(
      `
      INSERT INTO live_scores
      (provider_id, ts_utc, score_0_100, c_promagen_usage, c_search_pulse, c_reddit_mentions, c_community, c_health, details_json)
      VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7,
        jsonb_build_object(
          'u', $3, 'p', $4, 'r', $5, 'c', $6, 'h', $7
        ))
      `,
      row.provider_id, score, u * W.promagen_usage, p * W.search_pulse, r * W.reddit_mentions, c * W.community, h * W.health
    );

    // Hourly snapshot (idempotent per hour)
    const hour = startOfHour(new Date());
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO live_snapshots (provider_id, hour_utc, score_0_100, meta_json)
      VALUES ($1, $2, $3, '{}'::jsonb)
      ON CONFLICT (provider_id, hour_utc) DO UPDATE SET score_0_100 = EXCLUDED.score_0_100
      `,
      row.provider_id, hour, score
    );
  }
}
