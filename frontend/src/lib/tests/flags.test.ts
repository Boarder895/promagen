import { flag, flagLabel } from '@/lib/flags';

describe('flags', () => {
  test('GB and UK normalise', () => {
    expect(flag('GB')).toBe('🇬🇧');
    expect(flag('UK')).toBe('🇬🇧');
  });

  test('EU special flag', () => {
    expect(flag('EU')).toBe('🇪🇺');
  });

  test('fallbacks', () => {
    expect(flag('??')).toBe('🌐');
    expect(flag()).toBe('🌐');
    expect(flagLabel('GB')).toContain('🇬🇧');
  });
});
