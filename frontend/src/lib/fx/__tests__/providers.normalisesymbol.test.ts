import { normaliseSymbol } from '@/lib/fx/providers';

describe('normaliseSymbol', () => {
  it('maps eur/usd and EUR/USD to the same canonical key', () => {
    expect(normaliseSymbol('eur/usd')).toBe('EUR/USD');
    expect(normaliseSymbol('EUR/USD')).toBe('EUR/USD');
  });

  it('handles EURUSD by inserting a slash', () => {
    expect(normaliseSymbol('EURUSD')).toBe('EUR/USD');
  });

  it('handles hyphenated symbols', () => {
    expect(normaliseSymbol('gbp-usd')).toBe('GBP/USD');
  });
});
