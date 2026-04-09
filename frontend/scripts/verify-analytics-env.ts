// scripts/verify-analytics-env.ts
// ============================================================================
// ANALYTICS ENV VAR VERIFICATION (v1.1.0)
// ============================================================================
// Run: pnpm run verify:analytics
// (Add to package.json scripts: "verify:analytics": "tsx scripts/verify-analytics-env.ts")
//
// Checks .env.local first, falls back to process.env for CI/Docker.
// Validates format and range for all analytics env vars.
//
// Authority: analytics-build-plan-v1.3-FINAL.md §5 Part 6
// ============================================================================

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

interface EnvCheck {
  key: string;
  required: boolean;
  expectedValue?: string;
  validate?: (value: string) => string | null; // returns error message or null
  description: string;
}

const CHECKS: EnvCheck[] = [
  {
    key: 'NEXT_PUBLIC_GA_MEASUREMENT_ID',
    required: true,
    expectedValue: 'G-QHJ7L4OPCM',
    description: 'GA4 Measurement ID — without this, the entire GA4 component returns null',
  },
  {
    key: 'NEXT_PUBLIC_SITE_URL',
    required: true,
    expectedValue: 'https://promagen.com',
    validate: (v) => v.startsWith('https://') ? null : 'Must start with https://',
    description: 'Blocks preview deploys from contaminating production data',
  },
  {
    key: 'NEXT_PUBLIC_ANALYTICS_ENABLED',
    required: false,
    validate: (v) => ['true', 'false', 'on', 'off'].includes(v.toLowerCase()) ? null : 'Must be true/false/on/off',
    description: 'Master kill switch — defaults to "on" if unset. Set to "false" to disable',
  },
  {
    key: 'NEXT_PUBLIC_GA_SAMPLE_RATE',
    required: false,
    validate: (v) => {
      const n = parseFloat(v);
      if (isNaN(n)) return 'Must be a number';
      if (n <= 0 || n > 1) return `Must be > 0 and <= 1 (got ${n})`;
      return null;
    },
    description: 'Defaults to 1 (100% of sessions). Set to 0.5 for 50% sampling',
  },
  {
    key: 'NEXT_PUBLIC_ANALYTICS_DEBUG',
    required: false,
    validate: (v) => ['true', 'false'].includes(v.toLowerCase()) ? null : 'Must be true or false',
    description: 'Set to "true" for [analytics:event] console logging in dev',
  },
];

// ============================================================================
// ENV LOADING — .env.local first, process.env fallback
// ============================================================================

function loadEnvMap(): Map<string, string> {
  const envMap = new Map<string, string>();

  // Try .env.local first
  const envPath = resolve(process.cwd(), '.env.local');
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      // Strip surrounding quotes from value
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      envMap.set(key, val);
    }
  }

  // Fallback: process.env (for CI/Docker)
  for (const check of CHECKS) {
    if (!envMap.has(check.key) && process.env[check.key]) {
      envMap.set(check.key, process.env[check.key]!);
    }
  }

  return envMap;
}

// ============================================================================
// CHECK
// ============================================================================

function runChecks(): { pass: number; fail: number; warn: number } {
  const envMap = loadEnvMap();
  let pass = 0;
  let fail = 0;
  let warn = 0;

  const envPath = resolve(process.cwd(), '.env.local');
  const source = existsSync(envPath) ? '.env.local' : 'process.env (no .env.local found)';
  console.log(`\n━━━ SOURCE: ${source} ━━━\n`);

  for (const check of CHECKS) {
    const value = envMap.get(check.key);

    if (!value && check.required) {
      console.log(`  ❌ ${check.key} — MISSING (required)`);
      console.log(`     ${check.description}`);
      if (check.expectedValue) console.log(`     Expected: ${check.expectedValue}`);
      fail++;
    } else if (!value) {
      console.log(`  ⚪ ${check.key} — not set (optional, using default)`);
      warn++;
    } else {
      // Value exists — check expected and validate
      const issues: string[] = [];

      if (check.expectedValue && value !== check.expectedValue) {
        issues.push(`Expected "${check.expectedValue}", got "${value}"`);
      }

      if (check.validate) {
        const validationError = check.validate(value);
        if (validationError) issues.push(validationError);
      }

      if (issues.length > 0) {
        console.log(`  ⚠️  ${check.key} = "${value}"`);
        for (const issue of issues) console.log(`     ${issue}`);
        warn++;
      } else {
        console.log(`  ✅ ${check.key} = "${value}"`);
        pass++;
      }
    }
  }

  return { pass, fail, warn };
}

// ============================================================================
// VERCEL CHECKLIST
// ============================================================================

function printVercelChecklist(): void {
  console.log('\n━━━ VERCEL ENVIRONMENT VARIABLES ━━━\n');
  console.log('Check manually: Vercel Dashboard → Project Settings → Environment Variables\n');

  for (const check of CHECKS) {
    if (check.required) {
      console.log(`  🔑 ${check.key}`);
      if (check.expectedValue) console.log(`     Value: ${check.expectedValue}`);
      console.log(`     ${check.description}\n`);
    }
  }

  console.log('After setting/verifying, redeploy for changes to take effect.');
  console.log('Verification: visit site → GA4 Realtime report should show active user within 30s.\n');
}

// ============================================================================
// RUN
// ============================================================================

console.log('╔══════════════════════════════════════════════════╗');
console.log('║  Promagen Analytics — Env Var Verification       ║');
console.log('║  analytics-build-plan-v1.3-FINAL.md §5 Part 6   ║');
console.log('╚══════════════════════════════════════════════════╝');

const result = runChecks();
printVercelChecklist();

console.log('━━━ SUMMARY ━━━\n');
console.log(`  ✅ Pass: ${result.pass}`);
console.log(`  ❌ Fail: ${result.fail}`);
console.log(`  ⚠️  Warn: ${result.warn}`);

if (result.fail > 0) {
  console.log('\n🚨 Fix the failed checks before deploying.\n');
  process.exit(1);
} else {
  console.log('\n✅ Local env looks good. Verify Vercel vars manually.\n');
}
