// Node script to validate Promagen data catalogues before build.
// Run with: `node scripts/validate-data.mjs`
// Exits non-zero if a file fails its schema.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { z } from "zod";

/* --- Schemas (duplicated here so the script is self-contained) --- */
const Iso2 = z.string().regex(/^[A-Z]{2}$/);
const Iso3 = z.string().regex(/^[A-Z]{3}$/);

const ProviderSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  country: Iso2.optional(),
  score: z.number().int().min(0).max(100).optional(),
  trend: z.enum(["up", "down", "flat"]).optional(),
  tags: z.array(z.string()).optional(),
  url: z.string().url().optional(),
});
const ProvidersSchema = z.array(ProviderSchema);

const ExchangeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  country: Iso2.optional(),
  longitude: z.number().gte(-180).lte(180).optional(),
});
const ExchangesSchema = z.array(ExchangeSchema);

const SelectedExchangeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  country: Iso2,
  longitude: z.number().gte(-180).lte(180),
});
const SelectedExchangesSchema = z.array(SelectedExchangeSchema);

const CurrencySchema = z.object({
  code: Iso3,
  name: z.string().min(1),
  symbol: z.string().min(1).optional(),
  decimals: z.number().int().min(0).max(8).optional(),
});
const CurrenciesSchema = z.array(CurrencySchema);

const PairSchema = z.object({
  id: z.string().min(1),
  base: Iso3,
  quote: Iso3,
  label: z.string().min(1),
  precision: z.number().int().min(0).max(10),
  demo: z.object({ value: z.number(), prevClose: z.number() }),
});
const PairsSchema = z.array(PairSchema);

const CountryCurrencyMapSchema = z.record(Iso2, Iso3);
/* ---------------------------------------------------------------- */

function loadJson(relPath) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const abs = path.resolve(here, "..", "frontend", "src", "data", relPath);
  return JSON.parse(readFileSync(abs, "utf8"));
}

function printFail(title, error) {
  console.error(`✗ ${title} failed\n${error}`);
}

function printOk(title) {
  console.log(`✓ ${title} OK`);
}

let failed = 0;

try {
  const data = loadJson("exchanges.catalog.json");
  const res = ExchangesSchema.safeParse(data);
  if (!res.success) {
    failed++; printFail("exchanges.catalog.json", JSON.stringify(res.error.issues, null, 2));
  } else printOk("exchanges.catalog.json");
} catch (e) { failed++; printFail("exchanges.catalog.json", e); }

try {
  const data = loadJson("exchanges.selected.json");
  const res = SelectedExchangesSchema.safeParse(data);
  if (!res.success) {
    failed++; printFail("exchanges.selected.json", JSON.stringify(res.error.issues, null, 2));
  } else printOk("exchanges.selected.json");
} catch (e) { failed++; printFail("exchanges.selected.json", e); }

try {
  const data = loadJson("currencies.catalog.json");
  const res = CurrenciesSchema.safeParse(data);
  if (!res.success) {
    failed++; printFail("currencies.catalog.json", JSON.stringify(res.error.issues, null, 2));
  } else printOk("currencies.catalog.json");
} catch (e) { failed++; printFail("currencies.catalog.json", e); }

try {
  const data = loadJson("pairs.json");
  const res = PairsSchema.safeParse(data);
  if (!res.success) {
    failed++; printFail("pairs.json", JSON.stringify(res.error.issues, null, 2));
  } else printOk("pairs.json");
} catch (e) { failed++; printFail("pairs.json", e); }

try {
  const data = loadJson("country-currency.map.json");
  const res = CountryCurrencyMapSchema.safeParse(data);
  if (!res.success) {
    failed++; printFail("country-currency.map.json", JSON.stringify(res.error.issues, null, 2));
  } else printOk("country-currency.map.json");
} catch (e) { failed++; printFail("country-currency.map.json", e); }

try {
  const data = loadJson("providers.json"); // optional
  const res = ProvidersSchema.safeParse(data);
  if (!res.success) {
    failed++; printFail("providers.json", JSON.stringify(res.error.issues, null, 2));
  } else printOk("providers.json");
} catch {
  // optional; ignore absent file
}

if (failed) {
  console.error(`\n❌ Data validation failed (${failed} file${failed === 1 ? "" : "s"}).`);
  process.exit(1);
} else {
  console.log("\n✅ All catalogues valid.");
}
