#!/usr/bin/env npx tsx
// scripts/builder-quality-vetoed.ts
// ============================================================================
// BUILDER QUALITY INTELLIGENCE — Vetoed Cell Inspector
// ============================================================================
// Shows cells where the APS gate or regression guard rejected GPT's output
// and fell back to the assembled prompt. Displays both the assembled prompt
// and the raw GPT output so you can see what GPT tried before the gate
// killed it.
//
// Usage:
//   npx tsx scripts/builder-quality-vetoed.ts --run bqr-mnvnophj-dnx7s7
//   npx tsx scripts/builder-quality-vetoed.ts --run bqr-mnvnophj-dnx7s7 --limit 10
//   npx tsx scripts/builder-quality-vetoed.ts --run bqr-mnvnophj-dnx7s7 --platform midjourney
//   npx tsx scripts/builder-quality-vetoed.ts --run bqr-mnvnophj-dnx7s7 --full
//
// v2.0.0 (13 Apr 2026): Removed tier=3 hardcode, added --platform filter,
//   --limit, --full flag, true veto detection (raw != assembled),
//   distinguishes "true veto" from "no-op pass-through".
// v1.0.0 (12 Apr 2026): Initial.
// ============================================================================

import { resolve } from 'node:path';
import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: resolve('.env.local') });
config({ path: resolve('.env') });

const args = process.argv.slice(2);
let runId = '';
let platformFilter = '';
let limit = 5;
let full = false;

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--run': runId = args[++i] || ''; break;
    case '--platform': platformFilter = args[++i] || ''; break;
    case '--limit': limit = parseInt(args[++i] || '5', 10) || 5; break;
    case '--full': full = true; break;
  }
}

if (!runId) {
  console.error('Usage: npx tsx scripts/builder-quality-vetoed.ts --run <run_id> [--platform <id>] [--limit N] [--full]');
  process.exit(1);
}

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
if (!DATABASE_URL) { console.error('DATABASE_URL not found'); process.exit(1); }

const sql = postgres(DATABASE_URL, { ssl: 'require' });

async function main(): Promise<void> {
  const previewLen = full ? 5000 : 300;

  const rows = await sql`
    SELECT platform_id, scene_id, tier, call3_mode, gpt_score,
           LENGTH(assembled_prompt) as assembled_len,
           LENGTH(raw_optimised_prompt) as raw_opt_len,
           LENGTH(optimised_prompt) as final_opt_len,
           optimised_prompt = assembled_prompt as final_is_assembled,
           raw_optimised_prompt = assembled_prompt as raw_is_assembled,
           raw_optimised_prompt != optimised_prompt as raw_differs_from_final,
           LEFT(assembled_prompt, ${previewLen}) as assembled_preview,
           LEFT(raw_optimised_prompt, ${previewLen}) as raw_gpt_preview
    FROM builder_quality_results
    WHERE run_id = ${runId}
      AND status = 'complete'
      AND optimised_prompt = assembled_prompt
      ${platformFilter ? sql`AND platform_id = ${platformFilter}` : sql``}
    ORDER BY gpt_score ASC
    LIMIT ${limit}
  `;

  if (rows.length === 0) {
    console.log(`No vetoed/unchanged cells found for run ${runId}${platformFilter ? ` (platform: ${platformFilter})` : ''}.`);
    await sql.end();
    return;
  }

  let trueVetoes = 0;
  let noOps = 0;
  let preFix = 0;

  console.log(`Found ${rows.length} cells where final output = assembled prompt:\n`);

  for (const r of rows) {
    const rawIsAssembled = r.raw_is_assembled as boolean;
    const rawDiffersFromFinal = r.raw_differs_from_final as boolean;
    const mode = r.call3_mode as string;

    let classification: string;
    if (!rawIsAssembled && rawDiffersFromFinal) {
      classification = '🔴 TRUE VETO — GPT tried something, gate rejected it';
      trueVetoes++;
    } else if (rawIsAssembled) {
      if (mode === 'gpt_rewrite' || mode === 'compress_only') {
        classification = '🟡 PRE-FIX — GPT path but raw not captured (pre-observability)';
        preFix++;
      } else {
        classification = '⚪ NO-OP — deterministic path, no transforms modified prompt';
        noOps++;
      }
    } else {
      classification = '🟡 UNCLEAR';
      preFix++;
    }

    console.log('════════════════════════════════════════════════════════════');
    console.log(`Platform: ${r.platform_id}  |  Scene: ${r.scene_id}  |  T${r.tier}  |  Mode: ${mode}  |  Score: ${r.gpt_score}`);
    console.log(`Assembled: ${r.assembled_len} chars  |  Raw GPT: ${r.raw_opt_len} chars  |  Final: ${r.final_opt_len} chars`);
    console.log(`Classification: ${classification}`);
    console.log('');
    console.log('ASSEMBLED:');
    console.log(r.assembled_preview);
    console.log('');

    if (!rawIsAssembled) {
      console.log('RAW GPT OUTPUT (before gate):');
      console.log(r.raw_gpt_preview);
    } else {
      console.log('RAW GPT OUTPUT: same as assembled (not captured or deterministic)');
    }
    console.log('');
  }

  console.log('════════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log(`  True vetoes:   ${trueVetoes}`);
  console.log(`  Pre-fix:       ${preFix}`);
  console.log(`  No-op:         ${noOps}`);
  console.log(`  Total shown:   ${rows.length}`);

  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
