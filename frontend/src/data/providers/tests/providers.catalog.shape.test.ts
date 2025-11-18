// frontend/src/data/providers/tests/providers.catalog.shape.test.ts
// Shape tests for providers.json – guards the canonical 20-provider catalogue.

import providers from '../providers.json';

type ProviderRecord = (typeof providers)[number];

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

describe('providers.catalog.json shape', () => {
  it('has the canonical 20 providers (update intentionally if this changes)', () => {
    expect(Array.isArray(providers)).toBe(true);
    expect(providers.length).toBe(20);
  });

  it('every provider has required fields with correct basic types', () => {
    const allowedTrends = new Set(['up', 'down', 'flat']);

    providers.forEach((provider: ProviderRecord) => {
      // Core identity
      expect(isNonEmptyString(provider.id)).toBe(true);
      expect(isNonEmptyString(provider.name)).toBe(true);

      // Web presence
      expect(isNonEmptyString(provider.website)).toBe(true);

      // Affiliate / disclosure
      expect(Object.prototype.hasOwnProperty.call(provider, 'affiliateUrl')).toBe(true);
      expect(provider.affiliateUrl === null || typeof provider.affiliateUrl === 'string').toBe(
        true,
      );

      expect(typeof provider.requiresDisclosure).toBe('boolean');

      // Copy & messaging
      expect(isNonEmptyString(provider.tagline)).toBe(true);
      expect(isNonEmptyString(provider.tip)).toBe(true);

      // Scoring and trend
      expect(typeof provider.score).toBe('number');
      expect(Number.isNaN(provider.score)).toBe(false);
      expect(provider.score).toBeGreaterThanOrEqual(0);
      expect(provider.score).toBeLessThanOrEqual(100);

      expect(typeof provider.trend).toBe('string');
      expect(allowedTrends.has(provider.trend)).toBe(true);

      // Inline UX flags
      expect(typeof provider.supportsPrefill).toBe('boolean');
    });
  });

  it('provider ids are unique and stable', () => {
    const ids = providers.map((p) => p.id);
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).toBe(ids.length);

    // Stability: ids should look like slugs, not random UUIDs.
    ids.forEach((id) => {
      expect(/^[a-z0-9-]+$/.test(id)).toBe(true);
    });
  });

  it('scores have sensible ordering (no wild outliers)', () => {
    const scores = providers.map((p) => p.score);
    const min = Math.min(...scores);
    const max = Math.max(...scores);

    // Guardrails: you can tighten these later if you wish.
    expect(min).toBeGreaterThanOrEqual(40);
    expect(max).toBeLessThanOrEqual(100);
  });

  it('optional future fields (group/tier) are either absent or strings', () => {
    providers.forEach((provider: ProviderRecord) => {
      if ('group' in provider && provider.group != null) {
        expect(typeof (provider as any).group).toBe('string');
      }

      if ('tier' in provider && provider.tier != null) {
        expect(typeof (provider as any).tier).toBe('string');
      }
    });
  });

  it.skip('enforces allowed values for any future group/tier fields', () => {
    // When you formally introduce group/tier enums (e.g. in src/config/providers.ts),
    // wire them in here and unskip this test.
    //
    // Example:
    //   import { PROVIDER_GROUPS, PROVIDER_TIERS } from '@/config/providers';
    //
    //   providers.forEach((provider) => {
    //     if (provider.group) {
    //       expect(PROVIDER_GROUPS).toContain(provider.group);
    //     }
    //     if (provider.tier) {
    //       expect(PROVIDER_TIERS).toContain(provider.tier);
    //     }
    //   });
  });
});
