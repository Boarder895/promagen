#!/usr/bin/env node
/**
 * Cross-platform prebuild:
 * - Local Windows dev: run the PowerShell import-guard script.
 * - CI / non-Windows (e.g. Vercel Linux): no-op.
 */
const { spawnSync } = require('node:child_process');

const isWindows = process.platform === 'win32';
const isCI = !!process.env.CI;

if (isWindows && !isCI) {
  const r = spawnSync(
    'pwsh',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/enforce-imports.ps1'],
    { stdio: 'inherit' }
  );
  process.exit(r.status ?? 0);
} else {
  console.log(`prebuild: skipping on ${process.platform} (CI=${isCI})`);
}
