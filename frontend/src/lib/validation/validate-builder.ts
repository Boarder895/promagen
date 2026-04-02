// src/lib/validation/validate-builder.ts
// ============================================================================
// PLAYGROUND-FIRST VALIDATION HARNESS
// ============================================================================
// Tests a builder's system prompt against a canonical test scene via the
// OpenAI API, then auto-checks for the 3 documented regression patterns:
//   1. Anchor loss (named elements missing from output)
//   2. Banned content (invented textures, composition scaffolds, camera verbs)
//   3. Character count vs platform maxChars
//
// Usage:
//   npx tsx src/lib/validation/validate-builder.ts <platform-id>
//
// Examples:
//   npx tsx src/lib/validation/validate-builder.ts bing
//   npx tsx src/lib/validation/validate-builder.ts flux
//   npx tsx src/lib/validation/validate-builder.ts luma-ai
//   npx tsx src/lib/validation/validate-builder.ts --all
//
// Requires: OPENAI_API_KEY in environment (same key Promagen already uses)
//
// Authority: api-3.md, trend-analysis batches 1-4
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ============================================================================
// CLI OUTPUT HELPER — uses console.debug (allowed by lint rules)
// ============================================================================

/** CLI print — wraps console.debug which the project lint rules allow */
function print(msg: string): void {
   
  console.debug(msg);
}

// ============================================================================
// TEST SCENES — canonical inputs
// ============================================================================

/** Lighthouse Keeper: the canonical stress test. 9 visual anchors tracked. */
const LIGHTHOUSE_KEEPER_T3 = `From a low vantage, a young woman kneels before a weathered fox shrine deep in a cedar forest, the frame opening through black trunks toward the altar and the narrow stream beyond the steps. Her paper lantern throws a soft amber pool across moss-slick stone while pale mist threads the roots and red prayer ribbons tremble in the night breeze, the darkness behind the shrine held in a watchful stillness.`;

/** The 9 anchors that must survive in any T3 NL output */
const LIGHTHOUSE_ANCHORS = [
  'young woman',
  'weathered fox shrine',
  'cedar forest',
  'paper lantern',
  'amber',
  'moss-slick stone',
  'pale mist',
  'red prayer ribbons',
  'narrow stream',
];

// ============================================================================
// BANNED CONTENT — the exact failure patterns from batches 1-4
// ============================================================================

/** Invented textures — GPT adds these when told to "enrich" */
const BANNED_INVENTED = [
  'salt-crusted iron',
  'rain-slicked stone',
  'lichen-spotted granite',
  'rain-darkened wood',
  'sun-bleached timber',
  'spray-misted glass',
  'barnacle-covered',
  'tarnished brass',
  'sun-bleached driftwood',
];

/** Composition scaffolds — GPT adds these when told to close with framing */
const BANNED_COMPOSITION = [
  'framed as a',
  'seen from a low vantage',
  'low-angle wide shot',
  'medium-wide shot',
  'layered depth from',
  'foreground-to-background',
  'foreground deck through',
];

/** Camera-direction language — GPT adds these on video platforms */
const BANNED_CAMERA = [
  'tracking shot',
  'dolly shot',
  'push-in',
  'pull back',
  'camera pulls',
  'camera eases',
  'camera opening',
  'crane shot',
  'steadicam',
];

/** Generic mood filler — GPT adds trailing atmosphere sentences */
const BANNED_MOOD_FILLER = [
  'cinematic photorealism',
  'rich atmospheric depth',
  'cinematic nocturnal',
  'hushed supernatural atmosphere',
  'the scene feels',
  'quiet, reverent',
  'quiet, sacred',
];

/** Synonym churn — GPT substitutes these unnecessarily */
const BANNED_SYNONYMS: Array<[string, string]> = [
  ['throws', 'casts'],       // the most common unnecessary swap
  ['deep in a', 'in a deep'],  // adjective rearrangement
];

// ============================================================================
// BUILDER RESOLUTION — dynamically imports the builder to extract system prompt
// ============================================================================

interface BuilderResult {
  systemPrompt: string;
  platformId: string;
  maxChars: number;
}

interface PlatformEntry {
  name?: string;
  tier?: number;
  idealMin?: number;
  idealMax?: number;
  maxChars?: number;
  negativeSupport?: string;
  architecture?: string;
}

interface PlatformConfig {
  platforms: Record<string, PlatformEntry>;
}

function getDirname(): string {
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    // Fallback for CJS environments (tsx handles both)
    return __dirname;
  }
}

async function resolveBuilder(platformId: string): Promise<BuilderResult> {
  const dir = getDirname();
  const configPath = path.resolve(dir, '../../data/providers/platform-config.json');
  const raw = fs.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(raw) as PlatformConfig;
  const platformConfig = config.platforms[platformId];

  if (!platformConfig) {
    throw new Error(`Platform "${platformId}" not found in platform-config.json`);
  }

  const maxChars = platformConfig.maxChars ?? 1000;

  // Build a mock context matching OptimiseProviderContext
  const ctx = {
    name: platformConfig.name ?? platformId,
    providerId: platformId,
    tier: platformConfig.tier,
    idealMin: platformConfig.idealMin ?? 100,
    idealMax: platformConfig.idealMax ?? 400,
    maxChars,
    negativeSupport: platformConfig.negativeSupport ?? 'none',
    architecture: platformConfig.architecture ?? 'natural-language',
    groupKnowledge: '',
  };

  // Map platformId to builder file
  const builderMap: Record<string, { file: string; fn: string }> = {
    'bing':           { file: '../optimise-prompts/group-nl-bing',           fn: 'buildBingPrompt' },
    'google-imagen':  { file: '../optimise-prompts/group-nl-google-imagen',  fn: 'buildGoogleImagenPrompt' },
    'playground':     { file: '../optimise-prompts/group-nl-playground',     fn: 'buildPlaygroundPrompt' },
    'flux':           { file: '../optimise-prompts/group-flux-architecture', fn: 'buildFluxArchitecturePrompt' },
    'luma-ai':        { file: '../optimise-prompts/group-luma-ai',          fn: 'buildLumaAiPrompt' },
    'runway':         { file: '../optimise-prompts/group-runway',           fn: 'buildRunwayPrompt' },
    'kling':          { file: '../optimise-prompts/group-kling',            fn: 'buildKlingPrompt' },
    'recraft':        { file: '../optimise-prompts/group-recraft',          fn: 'buildRecraftPrompt' },
    'ideogram':       { file: '../optimise-prompts/group-ideogram',         fn: 'buildIdeogramPrompt' },
  };

  const mapping = builderMap[platformId];
  if (!mapping) {
    throw new Error(`No builder mapping for "${platformId}". Add it to builderMap in validate-builder.ts`);
  }

  const mod = await import(mapping.file) as Record<string, unknown>;
  const builder = mod[mapping.fn] as ((id: string, c: typeof ctx) => { systemPrompt: string }) | undefined;
  if (!builder) {
    throw new Error(`Builder function "${mapping.fn}" not found in ${mapping.file}`);
  }

  const result = builder(platformId, ctx);
  return {
    systemPrompt: result.systemPrompt,
    platformId,
    maxChars,
  };
}

// ============================================================================
// OPENAI CALL — raw fetch matching the project's existing pattern
// ============================================================================

interface OpenAIChoice {
  message?: { content?: string };
}

interface OpenAIResponse {
  choices?: OpenAIChoice[];
}

async function callOpenAI(systemPrompt: string, testInput: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      temperature: 0.3,
      response_format: { type: 'json_object' },
      max_tokens: 1500,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: testInput },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Unknown error');
    throw new Error(`OpenAI API error ${res.status}: ${errText}`);
  }

  const data = (await res.json()) as OpenAIResponse;
  return data.choices?.[0]?.message?.content ?? '';
}

// ============================================================================
// VALIDATION CHECKS
// ============================================================================

type GateResult = 'PASS' | 'WARN' | 'FAIL';

interface CheckResult {
  name: string;
  gate: GateResult;
  detail: string;
}

function checkAnchors(optimised: string): CheckResult {
  const lower = optimised.toLowerCase();
  const missing: string[] = [];
  for (const anchor of LIGHTHOUSE_ANCHORS) {
    if (!lower.includes(anchor.toLowerCase())) {
      missing.push(anchor);
    }
  }
  if (missing.length === 0) {
    return { name: 'Anchor preservation', gate: 'PASS', detail: `All ${LIGHTHOUSE_ANCHORS.length} anchors present` };
  }
  if (missing.length <= 2) {
    return { name: 'Anchor preservation', gate: 'WARN', detail: `Missing ${missing.length}: ${missing.join(', ')}` };
  }
  return { name: 'Anchor preservation', gate: 'FAIL', detail: `Missing ${missing.length}/${LIGHTHOUSE_ANCHORS.length}: ${missing.join(', ')}` };
}

function checkBannedContent(optimised: string): CheckResult {
  const lower = optimised.toLowerCase();
  const found: string[] = [];

  for (const term of BANNED_INVENTED)     { if (lower.includes(term.toLowerCase())) found.push(`invented: "${term}"`); }
  for (const term of BANNED_COMPOSITION)  { if (lower.includes(term.toLowerCase())) found.push(`scaffold: "${term}"`); }
  for (const term of BANNED_CAMERA)       { if (lower.includes(term.toLowerCase())) found.push(`camera: "${term}"`); }
  for (const term of BANNED_MOOD_FILLER)  { if (lower.includes(term.toLowerCase())) found.push(`filler: "${term}"`); }

  for (const [original, swapped] of BANNED_SYNONYMS) {
    if (lower.includes(swapped.toLowerCase()) && !lower.includes(original.toLowerCase())) {
      found.push(`synonym: "${original}" → "${swapped}"`);
    }
  }

  if (found.length === 0) {
    return { name: 'Banned content', gate: 'PASS', detail: 'No banned patterns detected' };
  }
  if (found.length <= 2) {
    return { name: 'Banned content', gate: 'WARN', detail: found.join('; ') };
  }
  return { name: 'Banned content', gate: 'FAIL', detail: found.join('; ') };
}

function checkCharCount(optimised: string, maxChars: number): CheckResult {
  const len = optimised.length;
  if (len <= maxChars) {
    return { name: 'Character count', gate: 'PASS', detail: `${len}/${maxChars} chars` };
  }
  const over = len - maxChars;
  if (over <= 50) {
    return { name: 'Character count', gate: 'WARN', detail: `${len}/${maxChars} chars (${over} over — compliance gate will trim)` };
  }
  return { name: 'Character count', gate: 'FAIL', detail: `${len}/${maxChars} chars (${over} over ceiling)` };
}

function checkShorterThanInput(optimised: string, input: string): CheckResult {
  const ratio = optimised.length / input.length;
  if (ratio >= 0.85) {
    return { name: 'Length preservation', gate: 'PASS', detail: `${Math.round(ratio * 100)}% of input length` };
  }
  if (ratio >= 0.70) {
    return { name: 'Length preservation', gate: 'WARN', detail: `${Math.round(ratio * 100)}% of input length — may have lost content` };
  }
  return { name: 'Length preservation', gate: 'FAIL', detail: `${Math.round(ratio * 100)}% of input length — significant content loss` };
}

// ============================================================================
// MAIN
// ============================================================================

async function validatePlatform(platformId: string): Promise<boolean> {
  print(`\n${'='.repeat(60)}`);
  print(`VALIDATING: ${platformId}`);
  print('='.repeat(60));

  // 1. Resolve builder
  print('\n[1] Loading builder...');
  const { systemPrompt, maxChars } = await resolveBuilder(platformId);
  print(`    System prompt: ${systemPrompt.length} chars`);
  print(`    Max chars: ${maxChars}`);

  // 2. Call OpenAI
  print('\n[2] Calling engine (gpt-4.1-mini, temp 0.3)...');
  const rawResponse = await callOpenAI(systemPrompt, LIGHTHOUSE_KEEPER_T3);

  // 3. Parse response
  let parsed: { optimised?: string; negative?: string; changes?: string[] };
  try {
    parsed = JSON.parse(rawResponse) as typeof parsed;
  } catch {
    print('    FAIL: Could not parse JSON response');
    print(`    Raw: ${rawResponse.slice(0, 200)}...`);
    return false;
  }

  const optimised = parsed.optimised ?? '';
  print(`    Optimised: ${optimised.length} chars`);
  if (parsed.negative) print(`    Negative: ${parsed.negative.slice(0, 80)}...`);
  if (parsed.changes) print(`    Changes: ${parsed.changes.join(', ')}`);

  // 4. Run checks
  print('\n[3] Running validation checks...\n');
  const checks: CheckResult[] = [
    checkAnchors(optimised),
    checkBannedContent(optimised),
    checkCharCount(optimised, maxChars),
    checkShorterThanInput(optimised, LIGHTHOUSE_KEEPER_T3),
  ];

  let hasFailure = false;
  for (const check of checks) {
    const icon = check.gate === 'PASS' ? 'GREEN' : check.gate === 'WARN' ? 'AMBER' : 'RED';
    const prefix = check.gate === 'PASS' ? '  PASS' : check.gate === 'WARN' ? '  WARN' : '  FAIL';
    print(`    [${icon}] ${prefix}: ${check.name}`);
    print(`           ${check.detail}`);
    if (check.gate === 'FAIL') hasFailure = true;
  }

  // 5. Overall verdict
  const anyFail = checks.some(c => c.gate === 'FAIL');
  const anyWarn = checks.some(c => c.gate === 'WARN');
  const verdict = anyFail ? 'FAIL' : anyWarn ? 'WARN' : 'PASS';

  print(`\n    VERDICT: ${verdict}`);
  print(`    ${verdict === 'PASS' ? 'Safe to deploy' : verdict === 'WARN' ? 'Review before deploying' : 'DO NOT deploy — fix the system prompt first'}`);

  // 6. Print the actual optimised prompt for manual review
  print('\n[4] Full optimised prompt for manual review:');
  print('    ---');
  print(`    ${optimised}`);
  print('    ---');

  return !hasFailure;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    print('Usage: npx tsx src/lib/validation/validate-builder.ts <platform-id>');
    print('       npx tsx src/lib/validation/validate-builder.ts --all');
    print('');
    print('Available platforms: bing, google-imagen, playground, flux, luma-ai, runway, kling');
    process.exit(1);
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('ERROR: OPENAI_API_KEY not set. Set it in your environment or .env.local');
    process.exit(1);
  }

  const allPlatforms = ['bing', 'google-imagen', 'playground', 'flux', 'luma-ai', 'runway', 'kling'];
  const targets = args[0] === '--all' ? allPlatforms : args;

  let allPassed = true;
  for (const platformId of targets) {
    try {
      const passed = await validatePlatform(platformId);
      if (!passed) allPassed = false;
    } catch (err) {
      console.error(`\n  ERROR validating ${platformId}:`, err);
      allPassed = false;
    }
  }

  print(`\n${'='.repeat(60)}`);
  print(`OVERALL: ${allPassed ? 'ALL PASSED' : 'SOME FAILED — review above'}`);
  print('='.repeat(60));

  process.exit(allPassed ? 0 : 1);
}

main();
