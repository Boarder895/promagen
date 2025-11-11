// frontend/src/lib/fx/eligibility.ts

export type ExchangeRec = {
  id: string;
  city?: string;
  tz?: string;
  longitude?: number;
  latitude?: number;
  country?: string;
  iso2?: string;
};

export type PairRec = {
  id: string;       // "gbp-usd"
  base: string;     // "GBP"
  quote: string;    // "USD"
  label: string;    // "GBP / USD"
  precision: number;
};

/** Basic global majors; extend later per exchange ordering. */
const MAJORS = ['GBP', 'EUR', 'USD', 'JPY', 'CHF', 'AUD', 'CAD', 'SGD', 'HKD'] as const;

/** Tests expect a Set — return Set<string>. Exchanges are ignored for now. */
export function eligibleCurrenciesFromExchanges(_exchanges?: ExchangeRec[]): Set<string> {
  return new Set<string>(MAJORS as unknown as string[]);
}

export function generatePairsFromCurrencies(codes: Iterable<string>): PairRec[] {
  const have = new Set(Array.from(codes, (c) => c.toUpperCase()));

  // Explicitly typed 2-tuples so TS never widens to string[].
  const requested: Array<readonly [string, string]> = [
    ['GBP', 'EUR'], ['GBP', 'USD'], ['EUR', 'USD'],
    ['USD', 'JPY'], ['USD', 'CHF'], ['AUD', 'USD'],
    ['USD', 'CAD'], ['USD', 'SGD'], ['USD', 'HKD'],
    ['EUR', 'GBP'], ['EUR', 'CHF'],
  ] as const;

  return requested
    .filter(([a, b]) => have.has(a) && have.has(b))
    .map(([a, b]) => ({
      id: `${a}-${b}`.toLowerCase(),
      base: a,
      quote: b,
      label: `${a} / ${b}`,
      precision: 4,
    }));
}

/** Stable order for now; add east→west weighting later. */
export function orderPairsEastToWestWeighted(pairs: PairRec[], _rails?: ExchangeRec[]): PairRec[] {
  return [...pairs];
}
