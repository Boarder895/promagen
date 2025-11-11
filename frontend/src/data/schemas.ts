// Zod schemas for Promagen data catalogues.
// These are intentionally pragmatic: strict where your UI relies on fields,
// permissive where older entries may still be migrating.

import { z } from "zod";

/** Helpers */
export const Iso2 = z.string().regex(/^[A-Z]{2}$/, "ISO-2 country code (AA–ZZ)");
export const Iso3 = z.string().regex(/^[A-Z]{3}$/, "ISO-3 currency code (AAA)");

/** Providers */
export const ProviderSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  country: Iso2.optional(),
  score: z.number().int().min(0).max(100).optional(),
  trend: z.enum(["up", "down", "flat"]).optional(),
  tags: z.array(z.string()).optional(),
  url: z.string().url().optional(),
});
export const ProvidersSchema = z.array(ProviderSchema);

/** Exchanges – full catalogue entry (some fields still migrating can be optional) */
export const ExchangeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  country: Iso2.optional(),
  longitude: z.number().gte(-180).lte(180).optional(),
});
export const ExchangesSchema = z.array(ExchangeSchema);

/** Exchanges – selected (homepage rails) must be fully specified */
export const SelectedExchangeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  country: Iso2,
  longitude: z.number().gte(-180).lte(180),
});
export const SelectedExchangesSchema = z.array(SelectedExchangeSchema);

/** Currencies */
export const CurrencySchema = z.object({
  code: Iso3,              // e.g. GBP, USD
  name: z.string().min(1), // e.g. "Pound sterling"
  symbol: z.string().min(1).optional(),
  decimals: z.number().int().min(0).max(8).optional(),
});
export const CurrenciesSchema = z.array(CurrencySchema);

/** FX pairs (used by ribbon demo/live shaping) */
export const PairSchema = z.object({
  id: z.string().min(1),        // e.g. "EURUSD"
  base: Iso3,                   // "EUR"
  quote: Iso3,                  // "USD"
  label: z.string().min(1),     // "EUR/USD"
  precision: z.number().int().min(0).max(10),
  demo: z.object({
    value: z.number(),
    prevClose: z.number(),
  }),
});
export const PairsSchema = z.array(PairSchema);

/** Country → Currency map (ISO2 → ISO3) */
export const CountryCurrencyMapSchema = z.record(Iso2, Iso3);

/** Utility to pretty-print Zod errors in tests/scripts */
export function formatZodError(err: unknown): string {
  if (!(err && typeof err === "object")) return String(err);
  const e = err as any;
  if (!e.issues) return String(err);
  return e.issues
    .map((i: any) => {
      const path = Array.isArray(i.path) ? i.path.join(".") : String(i.path ?? "");
      return `• ${path}: ${i.message}`;
    })
    .join("\n");
}
