import prisma from '../../lib/db';
import { subMinutes } from 'date-fns';

// You likely have a table where each image/job request is recorded.
// Adjust these queries to your schema. Below is a conservative pattern that
// will still work if you only have a minimal "jobs" table.

type ProviderRow = { id: string; slug: string; name: string };

async function getProviders(): Promise<ProviderRow[]> {
  // Prefer your existing providers table. Fall back to a static list if needed.
  // @ts-ignore - raw query in case Prisma model isn't mapped
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id::text, slug, name FROM providers ORDER BY name;`,
  );
  return rows;
}

async function collectPromagenUsage(providerId: string) {
  const now = new Date();
  const since5 = subMinutes(now, 5);
  const since1 = subMinutes(now, 1);

  // Example queries: adjust table/column names to yours.
  // jobs table minimally: id, provider_id, created_at, duration_ms, ok(boolean)
  // sessions table optionally: session_id, provider_id, last_seen

  const [{ active_users }] = await prisma
    .$queryRawUnsafe(
      `
    SELECT COUNT(DISTINCT session_id)::int AS active_users
    FROM proxy_sessions
    WHERE provider_id = $1 AND last_seen >= $2
    `,
      providerId,
      since5,
    )
    .catch(() => [{ active_users: 0 }]);

  const [{ gens_min }] = await prisma
    .$queryRawUnsafe(
      `
    SELECT COALESCE(COUNT(*)::float,0) AS gens_min
    FROM jobs
    WHERE provider_id = $1 AND created_at >= $2
    `,
      providerId,
      since1,
    )
    .catch(() => [{ gens_min: 0 }]);

  const [{ p50_ms, p95_ms, success_rate }] = await prisma
    .$queryRawUnsafe(
      `
      WITH w AS (
        SELECT duration_ms, ok
        FROM jobs
        WHERE provider_id = $1 AND created_at >= $2
      )
      SELECT
        COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_ms),0)::int AS p50_ms,
        COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms),0)::int AS p95_ms,
        CASE WHEN COUNT(*)=0 THEN 100.0
             ELSE ROUND(100.0 * SUM(CASE WHEN ok THEN 1 ELSE 0 END)::numeric / COUNT(*),2)
        END AS success_rate
      FROM w
      `,
      providerId,
      since5,
    )
    .catch(() => [{ p50_ms: 0, p95_ms: 0, success_rate: 100 }]);

  return {
    promagen_active_users: active_users,
    promagen_gens_per_min: gens_min,
    promagen_latency_p50_ms: p50_ms,
    promagen_latency_p95_ms: p95_ms,
    promagen_success_rate_pct: success_rate,
  };
}

export async function runLiveUsageCollector(): Promise<void> {
  const providers = await getProviders();
  const now = new Date();

  for (const p of providers) {
    const usage = await collectPromagenUsage(p.id);
    // You may also run a tiny HEAD/GET to the provider to set status/ttfb
    const status_ok = true;
    const status_ttfb_ms = usage.promagen_latency_p50_ms; // reuse if no synthetic check yet

    await prisma.$executeRawUnsafe(
      `
      INSERT INTO live_raw_metrics (
        provider_id, ts_utc,
        promagen_active_users, promagen_gens_per_min,
        promagen_latency_p50_ms, promagen_latency_p95_ms,
        promagen_success_rate_pct,
        status_ok, status_ttfb_ms
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `,
      p.id,
      now,
      usage.promagen_active_users,
      usage.promagen_gens_per_min,
      usage.promagen_latency_p50_ms,
      usage.promagen_latency_p95_ms,
      usage.promagen_success_rate_pct,
      status_ok,
      status_ttfb_ms,
    );
  }
}
