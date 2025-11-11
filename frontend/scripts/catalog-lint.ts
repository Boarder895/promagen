/* Run with:  node --loader ts-node/esm scripts/catalog-lint.ts
   Checks that every iso2 in exchanges.catalog.json maps to a currency code,
   and that codes are ISO-ish (A–Z, length 3). */

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const exPath = path.join(root, 'src', 'data', 'exchanges.catalog.json');
const ccPath = path.join(root, 'src', 'data', 'fx', 'country-currency.map.json');

const exRows = JSON.parse(fs.readFileSync(exPath, 'utf8')) as Array<{ iso2?: string, id: string }>;
const map = JSON.parse(fs.readFileSync(ccPath, 'utf8')) as Record<string,string>;

let ok = true;
const missing: Set<string> = new Set();
const bad: Array<{ id: string; iso2: string; code: string }> = [];

for (const r of exRows) {
  const iso2 = r.iso2;
  if (!iso2) { ok = false; console.error('Row missing iso2:', r.id); continue; }
  const code = map[iso2];
  if (!code) { ok = false; missing.add(iso2); continue; }
  if (!/^[A-Z]{3}$/.test(code)) {
    ok = false; bad.push({ id: r.id, iso2, code });
  }
}

if (missing.size) console.error('Unmapped iso2 -> currency:', Array.from(missing).sort().join(', '));
if (bad.length) {
  console.error('Non-ISO-ish currency codes:');
  for (const b of bad) console.error(' ', b);
}

if (!ok) {
  console.error('❌ Catalog lint failed');
  process.exit(1);
}
console.log('✅ Catalog lint passed');
