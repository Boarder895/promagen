import { flag, flagLabel } from '@/lib/flags';

// Use explicit Unicode escapes to avoid Windows console/codepage mojibake.
const EU = '\uD83C\uDDEA\uD83C\uDDFA'; // 🇪🇺
const UNKNOWN = '\u2753';             // ❓

describe('flags', () => {
  test('EU special flag', () => {
    expect(flag('EU')).toBe(EU);
  });

  test('fallbacks', () => {
    expect(flag('??')).toBe(UNKNOWN);
    expect(flag()).toBe(UNKNOWN);
    expect(flagLabel('GB')).toMatch(/United Kingdom|Great Britain/i);
  });
});
