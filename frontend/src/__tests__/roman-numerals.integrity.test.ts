import { toRomanNumeral } from '@/lib/format/number';

describe('Roman numerals (meaning glyph integrity)', () => {
  it('renders canonical forms for 1–12', () => {
    const cases: Array<[number, string]> = [
      [1, 'I'],
      [2, 'II'],
      [3, 'III'],
      [4, 'IV'],
      [5, 'V'],
      [6, 'VI'],
      [9, 'IX'],
      [10, 'X'],
      [11, 'XI'],
      [12, 'XII'],
    ];

    for (const [n, roman] of cases) {
      expect(toRomanNumeral(n)).toBe(roman);
    }
  });

  it('returns empty string for 0 or negative values (non-strict)', () => {
    expect(toRomanNumeral(0)).toBe('');
    expect(toRomanNumeral(-1)).toBe('');
  });

  it('falls back to Arabic for values > 3999', () => {
    expect(toRomanNumeral(4000)).toBe('4000');
  });
});
