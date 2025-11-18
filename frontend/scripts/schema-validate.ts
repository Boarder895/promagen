import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

/**
 * Load JSON from a given root + relative path, stripping a UTF-8 BOM if present.
 */
function loadJsonAtPath<T>(root: string, relativePath: string): T {
  const fullPath = resolve(root, relativePath);
  const raw = readFileSync(fullPath, 'utf8');
  const clean = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  return JSON.parse(clean) as T;
}

/**
 * Try multiple relative paths in order and return the first that exists.
 * This makes the script tolerant to small layout changes like:
 *   src/data/providers.json
 * vs
 *   src/data/providers/providers.json
 */
function loadJsonFromCandidates<T>(root: string, label: string, candidates: string[]): T {
  for (const rel of candidates) {
    const fullPath = resolve(root, rel);
    if (existsSync(fullPath)) {
      return loadJsonAtPath<T>(root, rel);
    }
  }

  throw new Error(`Could not find JSON for "${label}". Tried: ${candidates.join(', ')}`);
}

/**
 * Provider catalogue (providers.json)
 */
const Provider = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    url: z.string().url(),
    affiliateUrl: z.string().url().nullable().optional(),
    requiresDisclosure: z.boolean(),
    tagline: z.string().min(1),
    score: z.number().int().min(0).max(100),
    trend: z.enum(['up', 'down', 'flat']),
  })
  .strict();

const Providers = z.array(Provider);

/**
 * Exchange catalogue (exchanges.catalog.json)
 */
const Exchange = z
  .object({
    id: z.string().min(1),
    city: z.string().min(1),
    exchange: z.string().min(1),
    country: z.string().min(1),
    iso2: z.string().regex(/^[A-Z]{2}$/, 'ISO-2 country code (AA–ZZ)'),
    tz: z.string().min(3),
    longitude: z.number().gte(-180).lte(180),
    latitude: z.number().gte(-90).lte(90),
    hoursTemplate: z.string().min(1),
    holidaysRef: z.string().min(1),
    hemisphere: z.enum(['NE', 'NW', 'SE', 'SW']),
  })
  .strict();

const Exchanges = z.array(Exchange);

/**
 * Selected exchanges (exchanges.selected.json)
 */
const SelectedExchanges = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

/**
 * Currency catalogue (currencies.catalog.json)
 */
const Currency = z
  .object({
    code: z.string().regex(/^[A-Z]{3}$/, 'ISO-3 currency code (AAA)'),
    symbol: z.string().min(1),
    name: z.string().min(1),
  })
  .strict();

const Currencies = z.array(Currency);

/**
 * FX pairs (fx.pairs.json or pairs.json)
 */
const Pair = z
  .object({
    id: z.string().min(1),
    base: z.string().regex(/^[A-Z]{3}$/),
    quote: z.string().regex(/^[A-Z]{3}$/),
    label: z.string().min(1),
    precision: z.number().int().min(0).max(10),
    demo: z.object({
      value: z.number(),
      prevClose: z.number(),
    }),
  })
  .strict();

const Pairs = z.array(Pair);

/**
 * Country → currency map (country-currency.map.json)
 */
const CountryCurrencyMap = z.record(z.string().regex(/^[A-Z]{2}$/), z.string().regex(/^[A-Z]{3}$/));

/**
 * Pretty-print Zod errors.
 */
function formatZodError(err: unknown): string {
  if (!(err && typeof err === 'object')) return String(err);
  const anyErr = err as any;
  if (!Array.isArray(anyErr.issues)) return String(err);
  return anyErr.issues
    .map((issue: any) => {
      const path = Array.isArray(issue.path) ? issue.path.join('.') : '';
      const where = path === '' ? '(root)' : path;
      return `• ${where}: ${issue.message}`;
    })
    .join('\n');
}

function fail(message: string, err?: unknown): never {
  console.error('Schema validation failed:');
  console.error(message);
  if (err) {
    console.error(formatZodError(err));
  }
  process.exit(1);
}

function main(): void {
  const root = resolve(process.cwd(), 'src', 'data');

  // 1. Load raw JSON with resilient paths
  const providersJson = loadJsonFromCandidates<unknown[]>(root, 'providers', [
    'providers/providers.json', // current layout (folder)
    'providers.json', // fallback if ever moved to data root
  ]);

  const exchangesJson = loadJsonFromCandidates<unknown[]>(root, 'exchanges.catalog', [
    'exchanges/exchanges.catalog.json', // current layout
    'exchanges.catalog.json', // fallback
  ]);

  const selectedJson = loadJsonFromCandidates<unknown>(root, 'exchanges.selected', [
    'exchanges/exchanges.selected.json', // current layout
    'exchanges.selected.json', // fallback
  ]);

  const currenciesJson = loadJsonFromCandidates<unknown[]>(root, 'currencies.catalog', [
    'currencies.catalog.json', // current layout
    'markets/currencies.catalog.json', // future-proof if moved
  ]);

  const pairsJson = loadJsonFromCandidates<unknown[]>(root, 'FX pairs', [
    'fx/fx.pairs.json', // if you ever move under fx/
    'pairs.json', // current layout
  ]);

  const mapJson = loadJsonFromCandidates<Record<string, string>>(root, 'country-currency.map', [
    'country-currency.map.json', // current layout
    'country-currency/country-currency.map.json', // future-proof
  ]);

  // 2. Schema validation
  const providers = Providers.parse(providersJson);
  const exchanges = Exchanges.parse(exchangesJson);
  const selected = SelectedExchanges.parse(selectedJson);
  const currencies = Currencies.parse(currenciesJson);
  const pairs = Pairs.parse(pairsJson);
  const countryCurrencyMap = CountryCurrencyMap.parse(mapJson);

  // 3. Cross-file integrity checks

  // 3a. Provider ids unique
  {
    const seen = new Set<string>();
    for (const p of providers) {
      if (seen.has(p.id)) {
        fail(`Duplicate provider id: ${p.id}`);
      }
      seen.add(p.id);
    }
  }

  // 3b. Exchange ids unique
  {
    const seen = new Set<string>();
    for (const ex of exchanges) {
      if (seen.has(ex.id)) {
        fail(`Duplicate exchange id: ${ex.id}`);
      }
      seen.add(ex.id);
    }
  }

  // 3c. Selected exchanges exist in catalogue
  {
    const ids = new Set(exchanges.map((ex) => ex.id));
    for (const id of selected.ids) {
      if (!ids.has(id)) {
        fail(`Selected exchange not in catalogue: ${id}`);
      }
    }
  }

  // 3d. No inverse FX pairs (e.g. GBP/EUR and EUR/GBP)
  {
    const seen = new Set<string>();
    for (const pair of pairs) {
      const fwd = `${pair.base}/${pair.quote}`;
      const inv = `${pair.quote}/${pair.base}`;
      if (seen.has(inv)) {
        fail(`Inverse FX pair detected: ${fwd} vs ${inv}`);
      }
      seen.add(fwd);
    }
  }

  // 3e. All FX codes exist in currencies catalogue
  {
    const codes = new Set(currencies.map((c) => c.code));
    for (const pair of pairs) {
      if (!codes.has(pair.base)) {
        fail(`FX base currency not in currencies.catalog.json: ${pair.base}`);
      }
      if (!codes.has(pair.quote)) {
        fail(`FX quote currency not in currencies.catalog.json: ${pair.quote}`);
      }
    }
  }

  // 3f. Country-currency map matches currencies catalogue
  {
    const codes = new Set(currencies.map((c) => c.code));
    for (const [iso2, iso3] of Object.entries(countryCurrencyMap)) {
      if (!codes.has(iso3)) {
        fail(
          `country-currency.map.json uses currency code not in currencies.catalog.json: ${iso2} → ${iso3}`,
        );
      }
    }
  }

  console.log(
    '✔ Schema validation passed for providers, exchanges, currencies, FX pairs, and country-currency map.',
  );
}

try {
  main();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  fail(message, err);
}
