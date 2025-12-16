// frontend/src/lib/fx/providers.test.ts
import { normaliseSymbol } from '@/lib/fx/providers';

describe('normaliseSymbol()', () => {
  it('maps eur/usd and EUR/USD to the same key', () => {
    expect(normaliseSymbol('eur/usd')).toBe('EUR/USD');
    expect(normaliseSymbol('EUR/USD')).toBe('EUR/USD');
    expect(normaliseSymbol(' eur / usd ')).toBe('EUR/USD');
  });

  it('handles common delimiter variants', () => {
    expect(normaliseSymbol('eur-usd')).toBe('EUR/USD');
    expect(normaliseSymbol('eur_usd')).toBe('EUR/USD');
  });

  it('handles 6-letter concatenated pairs', () => {
    expect(normaliseSymbol('eurusd')).toBe('EUR/USD');
    expect(normaliseSymbol('EURUSD')).toBe('EUR/USD');
  });
});
