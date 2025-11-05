// scripts/validate-providers.ts
// Validates Promagen providers for required fields and sensible values.
// Run via: pnpm catalog:providers:validate

import { allProviders } from '../src/data/providers';

type Trend = 'up' | 'down' | 'flat';

const REQUIRED_STRING_FIELDS: (keyof ReturnType<typeof allProviders>[number])[] = [
  'id',
  'name',
  'affiliateUrl',
];

const VALID_TRENDS: Trend[] = ['up', 'down', 'flat'];

const errs: string[] = [];
const seenIds = new Set<string>();

const items = allProviders();

items.forEach((p, i) => {
  // Required strings
  for (const k of REQUIRED_STRING_FIELDS) {
    const v = (p as any)[k];
    if (typeof v !== 'string' || v.trim().length === 0) {
      errs.push(`[#${i} id=${p.id ?? '?'}] missing/empty string field: ${String(k)}`);
    }
  }

  // id format (lowercase, kebab)
  if (typeof p.id === 'string' && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.id)) {
    errs.push(`[#${i} id=${p.id}] id should be kebab-case [a-z0-9-]`);
  }

  // Duplicate ids
  if (typeof p.id === 'string') {
    if (seenIds.has(p.id)) errs.push(`Duplicate id: ${p.id}`);
    seenIds.add(p.id);
  }

  // score 0..100 if present
  if (p.score != null) {
    if (typeof p.score !== 'number' || !Number.isFinite(p.score) || p.score < 0 || p.score > 100) {
      errs.push(`[#${i} id=${p.id}] score must be number in [0,100] (got ${String(p.score)})`);
    }
  }

  // trend one of valid values if present
  if (p.trend != null && !VALID_TRENDS.includes(p.trend as Trend)) {
    errs.push(`[#${i} id=${p.id}] trend must be one of ${VALID_TRENDS.join(', ')} (got ${String(p.trend)})`);
  }

  // website optional but if present must look like URL-ish
  if (p.website != null && typeof p.website === 'string' && !/^https?:\/\//i.test(p.website)) {
    errs.push(`[#${i} id=${p.id}] website must start with http(s)://`);
  }

  // affiliateUrl required → must look like URL-ish
  if (typeof p.affiliateUrl === 'string' && !/^https?:\/\//i.test(p.affiliateUrl)) {
    errs.push(`[#${i} id=${p.id}] affiliateUrl must start with http(s)://`);
  }
});

if (errs.length) {
  console.error(`Provider validation failed (${errs.length} error${errs.length === 1 ? '' : 's'}):`);
  for (const e of errs) console.error(' -', e);
  process.exit(1);
}

console.log(`Provider validation passed (${items.length} items).`);
