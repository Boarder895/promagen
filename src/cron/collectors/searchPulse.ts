import prisma from "../../lib/db";
import { subMinutes } from "date-fns";

// Stubbed: use your chosen signal source and normalise to 0–100.
// You can start with a heuristic (e.g., short-window relative to daily median)
// and replace later with a proper API.

async function getProviderSlugs(): Promise<{ id: string; slug: string }[]> {
  // Adjust to your schema
  // @ts-ignore
  return prisma.$queryRawUnsafe<{ id: string; slug: string }[]>(
    `SELECT id::text, slug FROM providers WHERE slug IS NOT NULL;`
  );
}

async function fetchPulseForTerm(_term: string): Promise<number | null> {
  // Replace with a real source later; return 0..100 or null if unknown.
  // For now, return a simple pseudo-random but stable index per minute to prove the pipe works.
  const minute = Math.floor(Date.now() / 60000);
  return (minute % 100);
}

export async function runSearchPulseCollector(): Promise<void> {
  const slugs = await getProviderSlugs();
  const now = new Date();
  const since2 = subMinutes(now, 2);

  for (const { id, slug } of slugs) {
    const pulse = await fetchPulseForTerm(slug);
    if (pulse == null) continue;

    // Update the most recent row for this provider (last 2 min); if none, insert.
    const updated = await prisma.$executeRawUnsafe(
      `
      UPDATE live_raw_metrics
      SET search_pulse_index = $1,
          ext_payload_json = COALESCE(ext_payload_json,'{}'::jsonb) || jsonb_build_object('searchPulseTs', NOW())
      WHERE provider_id = $2 AND ts_utc >= $3
      `,
      pulse,
      id,
      since2
    );

    if ((updated as unknown as number) === 0) {
      await prisma.$executeRawUnsafe(
        `
        INSERT INTO live_raw_metrics (provider_id, ts_utc, search_pulse_index)
        VALUES ($1, NOW(), $2)
        `,
        id,
        pulse
      );
    }
  }
}
