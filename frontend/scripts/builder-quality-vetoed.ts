#!/usr/bin/env npx tsx
// scripts/builder-quality-vetoed.ts
// Quick diagnostic: shows T3 cells where APS gate rejected GPT output
// and fell back to assembled prompt (output === input).
//
// Usage: npx tsx scripts/builder-quality-vetoed.ts --run bqr-mnv1z0fi-s2nnh6

import { resolve } from "node:path";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: resolve(".env.local") });
config({ path: resolve(".env") });

const runId = process.argv.find((_, i, a) => a[i - 1] === "--run") || "";
if (!runId) {
  console.error(
    "Usage: npx tsx scripts/builder-quality-vetoed.ts --run <run_id>",
  );
  process.exit(1);
}

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
if (!DATABASE_URL) {
  console.error("DATABASE_URL not found in .env.local");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { ssl: "require" });

async function main(): Promise<void> {
  const rows = await sql`
    SELECT platform_id, scene_id, tier,
           LENGTH(assembled_prompt) as assembled_len,
           LENGTH(raw_optimised_prompt) as raw_opt_len,
           LENGTH(optimised_prompt) as final_opt_len,
           gpt_score,
           CASE WHEN optimised_prompt = assembled_prompt THEN 'IDENTICAL' ELSE 'CHANGED' END as outcome,
           LEFT(assembled_prompt, 300) as assembled_preview,
           LEFT(raw_optimised_prompt, 300) as raw_gpt_preview
    FROM builder_quality_results
    WHERE run_id = ${runId}
      AND status = 'complete'
      AND optimised_prompt = assembled_prompt
      AND tier = 3
    ORDER BY gpt_score ASC
    LIMIT 5
  `;

  if (rows.length === 0) {
    console.log("No vetoed T3 cells found for this run.");
    await sql.end();
    return;
  }

  console.log(`Found ${rows.length} vetoed T3 cells (worst scores first):\n`);

  for (const r of rows) {
    console.log("════════════════════════════════════════════════════════════");
    console.log(
      `Platform: ${r.platform_id}  |  Scene: ${r.scene_id}  |  Score: ${r.gpt_score}`,
    );
    console.log(
      `Assembled: ${r.assembled_len} chars  |  Raw GPT: ${r.raw_opt_len} chars  |  Final: ${r.final_opt_len} chars`,
    );
    console.log(`Outcome: ${r.outcome}`);
    console.log("");
    console.log("ASSEMBLED (first 300 chars):");
    console.log(r.assembled_preview);
    console.log("");
    console.log("RAW GPT OUTPUT (first 300 chars):");
    console.log(r.raw_gpt_preview);
    console.log("");
  }

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
