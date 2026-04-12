#!/usr/bin/env npx tsx
// scripts/regenerate-call2-snapshot.ts
// ============================================================================
// Regenerates harness-snapshots/call-2-system-prompt-<version>.txt
// by extracting and evaluating buildSystemPrompt(null) from route.ts.
//
// Usage (from frontend/):
//   pnpm exec tsx scripts/regenerate-call2-snapshot.ts
//   pnpm exec tsx scripts/regenerate-call2-snapshot.ts --version v6.0
//
// This reads the production route.ts, extracts the template literal,
// substitutes the default (null-provider) variables, and writes the
// snapshot file. No dev server required.
//
// WHY THIS EXISTS: The harness reads the system prompt from a snapshot
// file, not from the running app. If you change buildSystemPrompt() in
// route.ts but forget to regenerate the snapshot, the harness tests a
// stale prompt and you waste an entire run (~9 min, ~$0.50 in API calls).
// ============================================================================

import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

// ── Parse args ──────────────────────────────────────────────────────────────

let version = 'v6.0';
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--version' && process.argv[i + 1]) {
    version = process.argv[i + 1];
    i++;
  }
}

// ── Paths ───────────────────────────────────────────────────────────────────

const routePath = resolve('src/app/api/generate-tier-prompts/route.ts');
const snapshotDir = resolve('harness-snapshots');
const snapshotPath = resolve(snapshotDir, `call-2-system-prompt-${version}.txt`);

// ── Read route.ts ───────────────────────────────────────────────────────────

let routeSource: string;
try {
  routeSource = readFileSync(routePath, 'utf8');
} catch (e) {
  console.error(`[ERROR] Cannot read ${routePath}: ${e}`);
  process.exit(1);
}

// ── Extract the template literal ────────────────────────────────────────────
//
// Strategy: find the return statement inside buildSystemPrompt() that starts
// with `return \`You are an expert` and ends with the matching backtick + ;
// Then substitute the two interpolated variables.

const TEMPLATE_START = 'return `You are an expert';
const startIdx = routeSource.indexOf(TEMPLATE_START);
if (startIdx === -1) {
  console.error('[ERROR] Cannot find template start marker in route.ts');
  process.exit(1);
}

// Find the closing backtick+semicolon (the template ends with `\`;\n}`)
// We need to find the MATCHING backtick, not just any backtick.
// The template uses ${} interpolations which contain backticks of their own,
// but those are inside ${} so we can track nesting.
let depth = 0;
let inTemplate = false;
let templateEnd = -1;

for (let i = startIdx + 8; i < routeSource.length; i++) {
  const ch = routeSource[i];
  if (!inTemplate && ch === '`') {
    inTemplate = true;
    continue;
  }
  if (inTemplate) {
    if (ch === '$' && routeSource[i + 1] === '{') {
      depth++;
      i++; // skip {
      continue;
    }
    if (depth > 0) {
      if (ch === '{') depth++;
      if (ch === '}') {
        depth--;
        if (depth === 0) continue; // back to template level
      }
      // Inside template inner backtick strings (nested template literals)
      if (ch === '`') {
        // Scan to matching backtick (inner template literal)
        i++;
        let innerDepth = 0;
        while (i < routeSource.length) {
          const ic = routeSource[i];
          if (ic === '$' && routeSource[i + 1] === '{') {
            innerDepth++;
            i++;
          } else if (innerDepth > 0 && ic === '}') {
            innerDepth--;
          } else if (innerDepth === 0 && ic === '`') {
            break; // end of inner template
          }
          i++;
        }
        continue;
      }
      continue;
    }
    if (ch === '`') {
      templateEnd = i;
      break;
    }
  }
}

if (templateEnd === -1) {
  console.error('[ERROR] Cannot find matching backtick for template end');
  process.exit(1);
}

// Extract raw template (without the backticks)
const backtickStart = routeSource.indexOf('`', startIdx + 7);
const rawTemplate = routeSource.slice(backtickStart + 1, templateEnd);

// ── Substitute variables for null provider context ──────────────────────────

// With providerContext = null:
//   providerBlock = "" (empty string)
//   t1SyntaxInstruction = the default parenthetical block (lines 213-215 of route.ts)

const defaultT1Syntax = `- Weighted keyword syntax: you MUST use parenthetical syntax: (term:1.3). Example: (elderly samurai:1.4), (stone bridge:1.2), (golden hour:1.2). Do NOT use double-colon :: syntax.
- Use weight steps in 0.1 increments only: 1.1, 1.2, 1.3, 1.4. Do NOT use 1.15, 1.25, or other fractional steps.
- WEIGHT WRAPPING LIMIT: Do NOT weight-wrap phrases longer than 4 words. Break them into shorter terms. WRONG: (small girl in a yellow raincoat:1.3). RIGHT: (small girl:1.3), yellow raincoat. WRONG: (frost-encrusted orange survival suit:1.3). RIGHT: (survival suit:1.3), frost-encrusted, orange.`;

let prompt = rawTemplate;
prompt = prompt.replace('${providerBlock}', '');
prompt = prompt.replace('${t1SyntaxInstruction}', defaultT1Syntax);

// Verify no remaining interpolations
const remaining = prompt.match(/\$\{[^}]+\}/g);
if (remaining) {
  console.error(`[ERROR] Unresolved interpolations in template: ${remaining.join(', ')}`);
  process.exit(1);
}

// ── Write snapshot ──────────────────────────────────────────────────────────

writeFileSync(snapshotPath, prompt, 'utf8');

const routeStat = statSync(routePath);
const snapshotStat = statSync(snapshotPath);

console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('  Call 2 System Prompt Snapshot — Regenerated');
console.log('═══════════════════════════════════════════════════════════');
console.log(`  version          : ${version}`);
console.log(`  snapshot path    : ${snapshotPath}`);
console.log(`  snapshot length  : ${prompt.length} chars`);
console.log(`  snapshot mtime   : ${snapshotStat.mtime.toISOString()}`);
console.log(`  route.ts mtime   : ${routeStat.mtime.toISOString()}`);
console.log(`  provider context : null (generic prompt)`);
console.log('');
console.log('  Snapshot is FRESH — ready for harness run.');
console.log('');
console.log('  Next:');
console.log('    $env:CALL2_HARNESS_DEV_AUTH = "r3nv7KP8py4ExGO9zeDIYXakfhNVcgTd"');
console.log(`    pnpm exec tsx scripts/run-harness.ts --version ${version} --run-class smoke_alarm --previous "generated\\call-2-harness\\runs\\v4.5-smoke_alarm-2026-04-11T09-58-30-375Z.json"`);
console.log('');
