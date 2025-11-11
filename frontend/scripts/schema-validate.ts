/* eslint-disable no-console */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

const Provider = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  country: z.string().optional(),
  score: z.number().min(0).max(100).optional(),
  trend: z.enum(['up', 'down', 'flat']).optional(),
  tags: z.array(z.string()).optional(),
  url: z.string().url().optional(),
  affiliateUrl: z.string().url().nullable().optional(),
  requiresDisclosure: z.boolean().optional(),
  tagline: z.string().optional(),
  category: z.string().optional(),
  emoji: z.string().optional()
});

const Exchange = z.object({
  id: z.string().min(1),
  exchange: z.string().min(1),
  city: z.string().optional(),
  tz: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  hoursTemplate: z.string().nullable().optional(),
  workdays: z.string().nullable().optional(),
  holidaysRef: z.string().nullable().optional()
});

const Currency = z.object({
  code: z.string().length(3),
  name: z.string().min(1),
  symbol: z.string().optional()
});

const Pair = z.object({
  id: z.string().regex(/^[A-Z]{6}$|^[A-Z]{3}\/[A-Z]{3}$/),
  base: z.string().length(3),
  quote: z.string().length(3),
  label: z.string().min(1),
  precision: z.number().int().min(0).max(10).optional(),
  demo: z.object({ value: z.number(), prevClose: z.number() }).optional()
});

function load<T>(p: string): T {
  return JSON.parse(readFileSync(p, 'utf8')) as T;
}

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

const root = resolve(process.cwd(), 'src', 'data');

try {
  (load<unknown[]>(resolve(root, 'providers.json'))).forEach((p, i) => Provider.parse(p) || fail(`providers[${i}] invalid`));
  (load<unknown[]>(resolve(root, 'exchanges.catalog.json'))).forEach((e, i) => Exchange.parse(e) || fail(`exchanges[${i}] invalid`));
  (load<unknown[]>(resolve(root, 'currencies.catalog.json'))).forEach((c, i) => Currency.parse(c) || fail(`currencies[${i}] invalid`));

  const pairs = load<unknown[]>(resolve(root, 'pairs.json'));
  pairs.forEach((p, i) => Pair.parse(p) || fail(`pairs[${i}] invalid`));

  // no inverse pairs
  const set = new Set<string>();
  for (const p of pairs as any[]) {
    const f = `${p.base}/${p.quote}`;
    const inv = `${p.quote}/${p.base}`;
    if (set.has(inv)) fail(`Inverse FX pair: ${f} vs ${inv}`);
    set.add(f);
  }

  // selected exchanges must exist
  const selected = load<{ ids: string[] }>(resolve(root, 'exchanges.selected.json'));
  const exchanges = load<any[]>(resolve(root, 'exchanges.catalog.json'));
  const ids = new Set(exchanges.map(e => e.id));
  for (const id of selected.ids) if (!ids.has(id)) fail(`Selected exchange not in catalogue: ${id}`);

  console.log('✔ Schema validation passed');
} catch (e: any) {
  fail(`Schema validation failed: ${e?.message ?? String(e)}`);
}
