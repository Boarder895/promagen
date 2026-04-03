#!/usr/bin/env npx tsx
// scripts/generate-snapshots.ts
// ============================================================================
// BUILDER QUALITY INTELLIGENCE — Frozen Snapshot Generator
// ============================================================================
// Runs all test scenes through Call 2 (generate-tier-prompts) once,
// captures the assembled prompts per tier, and saves them as frozen
// snapshots for Call 3 regression testing.
//
// Usage (from frontend/, dev server must be running):
//   npx tsx scripts/generate-snapshots.ts
//   npx tsx scripts/generate-snapshots.ts --holdout   # include holdout scenes
//
// Output:
//   src/data/scoring/frozen-snapshots.json     (8 core scenes × 4 tiers = 32)
//   src/data/scoring/holdout-snapshots.json    (2 holdout scenes × 4 tiers = 8)
//
// v1.1.0 (3 Apr 2026): Fixed Call 2 response parsing (tiers wrapper).
//   Handle scenes >1000 chars by truncating to last complete sentence.
// v1.0.0 (3 Apr 2026): Initial implementation.
// Authority: docs/authority/builder-quality-intelligence.md v2.5.0 §4
// ============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

// ============================================================================
// CONFIG
// ============================================================================

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const CALL2_ENDPOINT = `${BASE_URL}/api/generate-tier-prompts`;
const CALL2_VERSION = 'v4.5'; // Update when Call 2 system prompt changes
const TIERS = [1, 2, 3, 4] as const;
const MAX_INPUT_CHARS = 1000;

// ============================================================================
// TYPES
// ============================================================================

interface TestScene {
  id: string;
  name: string;
  humanText: string;
  holdout: boolean;
}

interface FrozenSnapshot {
  sceneId: string;
  tier: number;
  call2Version: string;
  assembledPrompt: string;
  snapshotHash: string;
  createdAt: string;
}

interface TierOutput {
  positive: string;
  negative: string;
}

interface Call2Response {
  tiers: {
    tier1: TierOutput;
    tier2: TierOutput;
    tier3: TierOutput;
    tier4: TierOutput;
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function md5(content: string): string {
  return createHash('md5').update(content, 'utf8').digest('hex');
}

function log(msg: string): void {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

function logError(msg: string): void {
  const ts = new Date().toISOString().slice(11, 19);
  console.error(`[${ts}] ✗ ${msg}`);
}

/**
 * Truncate text to the last complete sentence within maxChars.
 * Call 2 has a 1000 char input limit — scenes like the compression
 * stress test (~1800 chars) need truncating for snapshot generation.
 * The full text is still used as humanText in the batch runner.
 */
function truncateToLimit(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;

  const truncated = text.slice(0, maxChars);
  // Find the last sentence boundary (., !, ?)
  const lastSentence = Math.max(
    truncated.lastIndexOf('. '),
    truncated.lastIndexOf('! '),
    truncated.lastIndexOf('? '),
    truncated.lastIndexOf('.\n'),
    truncated.lastIndexOf('.'),
  );

  if (lastSentence > maxChars * 0.5) {
    return truncated.slice(0, lastSentence + 1).trim();
  }

  // Fallback: find last comma
  const lastComma = truncated.lastIndexOf(', ');
  if (lastComma > maxChars * 0.5) {
    return truncated.slice(0, lastComma).trim();
  }

  // Hard truncate as last resort
  return truncated.trim();
}

// ============================================================================
// CALL 2 — Generate tier prompts for a scene
// ============================================================================

async function generateTierPrompts(humanText: string): Promise<Call2Response> {
  const res = await fetch(CALL2_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sentence: humanText,
      providerId: null,
      providerContext: null,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'unknown');
    throw new Error(`Call 2 failed (${res.status}): ${errText}`);
  }

  const data = await res.json() as Call2Response;

  // Validate response shape
  if (!data.tiers || !data.tiers.tier1) {
    throw new Error(`Unexpected Call 2 response shape: ${JSON.stringify(data).slice(0, 200)}`);
  }

  return data;
}

// ============================================================================
// SNAPSHOT GENERATION FOR A SET OF SCENES
// ============================================================================

async function generateSnapshotsForScenes(
  scenes: TestScene[],
): Promise<FrozenSnapshot[]> {
  const snapshots: FrozenSnapshot[] = [];

  for (const scene of scenes) {
    const displayText = scene.humanText.length > 60
      ? scene.humanText.slice(0, 60) + '...'
      : scene.humanText;
    log(`Scene: ${scene.id} — "${displayText}"`);

    // Truncate if needed (compression stress test is ~1800 chars)
    let inputText = scene.humanText;
    if (inputText.length > MAX_INPUT_CHARS) {
      inputText = truncateToLimit(inputText, MAX_INPUT_CHARS);
      log(`  ⚠ Truncated from ${scene.humanText.length} to ${inputText.length} chars for Call 2 input limit`);
    }

    try {
      const tierData = await generateTierPrompts(inputText);
      const now = new Date().toISOString();

      for (const tier of TIERS) {
        const tierKey = `tier${tier}` as keyof Call2Response['tiers'];
        const assembled = tierData.tiers[tierKey].positive;

        if (!assembled || assembled.trim().length === 0) {
          logError(`  T${tier}: empty assembled prompt — skipping`);
          continue;
        }

        const snapshot: FrozenSnapshot = {
          sceneId: scene.id,
          tier,
          call2Version: CALL2_VERSION,
          assembledPrompt: assembled,
          snapshotHash: md5(assembled),
          createdAt: now,
        };

        snapshots.push(snapshot);
        log(`  T${tier}: ${assembled.length} chars — hash ${snapshot.snapshotHash.slice(0, 8)}...`);
      }
    } catch (e) {
      logError(`  FAILED: ${e}`);
    }

    // Brief pause to avoid rate limiting
    await new Promise((r) => setTimeout(r, 500));
  }

  return snapshots;
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  const includeHoldout = process.argv.includes('--holdout');

  // ── Load test scenes ─────────────────────────────────────────────
  const scenesPath = resolve('src/data/scoring/test-scenes.json');
  const holdoutPath = resolve('src/data/scoring/holdout-scenes.json');

  let coreScenes: TestScene[];
  try {
    coreScenes = JSON.parse(readFileSync(scenesPath, 'utf8')) as TestScene[];
  } catch (e) {
    logError(`Failed to read ${scenesPath}: ${e}`);
    process.exit(1);
  }

  let holdoutScenes: TestScene[] = [];
  if (includeHoldout) {
    try {
      holdoutScenes = JSON.parse(readFileSync(holdoutPath, 'utf8')) as TestScene[];
    } catch (e) {
      logError(`Failed to read ${holdoutPath}: ${e}`);
      process.exit(1);
    }
  }

  log(`Loaded ${coreScenes.length} core scenes${includeHoldout ? ` + ${holdoutScenes.length} holdout scenes` : ''}`);
  log(`Call 2 endpoint: ${CALL2_ENDPOINT}`);
  log(`Call 2 version: ${CALL2_VERSION}`);
  log('');

  // ── Generate + save core snapshots ───────────────────────────────
  const coreSnapshots = await generateSnapshotsForScenes(coreScenes);

  const coreOutputPath = resolve('src/data/scoring/frozen-snapshots.json');
  writeFileSync(coreOutputPath, JSON.stringify(coreSnapshots, null, 2), 'utf8');
  log('');
  log(`✓ Wrote ${coreSnapshots.length} core snapshots to ${coreOutputPath}`);
  log(`  Expected: ${coreScenes.length * 4} (${coreScenes.length} scenes × 4 tiers)`);

  // ── Generate + save holdout snapshots ────────────────────────────
  if (includeHoldout && holdoutScenes.length > 0) {
    log('');
    log('── Holdout scenes ──');

    const holdoutSnapshots = await generateSnapshotsForScenes(holdoutScenes);

    const holdoutOutputPath = resolve('src/data/scoring/holdout-snapshots.json');
    writeFileSync(holdoutOutputPath, JSON.stringify(holdoutSnapshots, null, 2), 'utf8');
    log('');
    log(`✓ Wrote ${holdoutSnapshots.length} holdout snapshots to ${holdoutOutputPath}`);
    log(`  Expected: ${holdoutScenes.length * 4} (${holdoutScenes.length} scenes × 4 tiers)`);
  }

  // ── Summary ──────────────────────────────────────────────────────
  log('');
  log('═══ SNAPSHOT GENERATION COMPLETE ═══');
  log(`Core: ${coreSnapshots.length}/${coreScenes.length * 4} snapshots`);
  if (includeHoldout) {
    log(`Holdout: generated separately`);
  }
  log(`Call 2 version: ${CALL2_VERSION}`);
  log('');
  log('Next steps:');
  log('  1. Eyeball the assembled prompts — do they look right?');
  log('  2. Commit the JSON files to the repo');
  log('  3. Run the batch runner: npx tsx scripts/builder-quality-run.ts --all --mode builder');
}

main().catch((e) => {
  logError(`Fatal error: ${e}`);
  process.exit(1);
});
