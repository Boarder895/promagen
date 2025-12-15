// frontend/scripts/generate-flags-manifest.ts
//
// Generates: frontend/src/data/flags/flags.manifest.json
// From:      frontend/public/flags/*.svg
//
// Purpose:
// - Let flagSrc() be “known-good” so UI never hits a 404 for missing SVG flags.
// - Keeps your “flags everywhere” plan clean and fast.
//
// Run:
// - pnpm run generate:flags-manifest
// - Auto-run on predev/prebuild/pretypecheck (see package.json)

import { readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

type FlagsManifest = {
  count: number;
  codes: string[];
};

function listSvgBasenames(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });

  const basenames = entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((name) => name.toLowerCase().endsWith('.svg'))
    .map((name) => path.basename(name, path.extname(name)))
    .map((base) => base.trim().toLowerCase())
    .filter((base) => base.length > 0);

  return basenames;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function main(): void {
  const cwd = process.cwd();

  const publicFlagsDir = path.resolve(cwd, 'public', 'flags');
  const outDir = path.resolve(cwd, 'src', 'data', 'flags');
  const outFile = path.resolve(outDir, 'flags.manifest.json');

  const codes = uniqueSorted(listSvgBasenames(publicFlagsDir));

  const payload: FlagsManifest = {
    count: codes.length,
    codes,
  };

  const json = `${JSON.stringify(payload, null, 2)}\n`;
  writeFileSync(outFile, json, { encoding: 'utf8' });

   
  console.log(`[flags] wrote ${payload.count} codes -> ${path.relative(cwd, outFile)}`);
}

main();
