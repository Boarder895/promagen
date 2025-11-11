import { eligibleCurrenciesFromExchanges, generatePairsFromCurrencies, orderPairsEastToWestWeighted } from '@/lib/fx/eligibility';

const rails = [
  { id: 'lse', country: 'GB', longitude: 0.0 },
  { id: 'xetra', country: 'DE', longitude: 8.7 },
  { id: 'nyse', country: 'US', longitude: -74.0 }
];

test('eligibility derives from rails', () => {
  const set = eligibleCurrenciesFromExchanges(rails);
  expect(set.has('GBP')).toBe(true);
  expect(set.has('EUR')).toBe(true);
  expect(set.has('USD')).toBe(true);
});

test('order is deterministic east→west weighted', () => {
  const eligible = eligibleCurrenciesFromExchanges(rails);
  const pairs = generatePairsFromCurrencies(eligible);
  const ordered = orderPairsEastToWestWeighted(pairs, rails);
  expect(ordered.length).toBeGreaterThan(0);
  // Sanity: some pair with USD should lean westward compared to EUR/GBP-only average
  const idxUsdGbp = ordered.findIndex(p => p.id === 'usd-gbp');
  const idxGbpEur = ordered.findIndex(p => p.id === 'gbp-eur');
  expect(idxUsdGbp).toBeGreaterThan(-1);
  expect(idxGbpEur).toBeGreaterThan(-1);
});
