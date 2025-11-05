// scripts/providers-backfill-affiliate.ts
// Adds placeholder affiliateUrl for any provider missing it.
// Uses website + ?ref=promagen or &ref=promagen. Writes providers.data.json in-place.
// Run: pnpm providers:backfill

import fs from 'node:fs';
import path from 'node:path';

type Trend = 'up' | 'down' | 'flat';
interface Provider {
  id: string;
  name: string;
  website?: string | null;
  affiliateUrl?: string | null;
  requiresDisclosure?: boolean;
  tagline?: string | null;
  score?: number;
  trend?: Trend;
  supportsPrefill?: boolean;
  tip?: string | null;
  url?: string | null; // legacy alias
}

const ROOT = path.resolve(process.cwd());
const dataPath = path.join(ROOT, 'src', 'data', 'providers.data.json');

const raw = fs.readFileSync(dataPath, 'utf8');
const list = JSON.parse(raw) as Provider[];

let changed = 0;
for (const p of list) {
  if (!p.affiliateUrl || !/^https?:\/\//i.test(p.affiliateUrl)) {
    if (typeof p.website === 'string' && /^https?:\/\//i.test(p.website)) {
      const hasQuery = p.website.includes('?');
      p.affiliateUrl = p.website + (hasQuery ? '&' : '?') + 'ref=promagen';
      changed += 1;
    } else {
      // Fallback placeholder if no website
      p.affiliateUrl = `https://promagen.com/visit/${p.id}`;
      changed += 1;
    }
  }
}

if (changed > 0) {
  const pretty = JSON.stringify(list, null, 2) + '\n';
  fs.writeFileSync(dataPath, pretty, { encoding: 'utf8' });
  console.log(`Backfilled affiliateUrl for ${changed} provider(s).`);
} else {
  console.log('No changes. All providers already have affiliateUrl.');
}
