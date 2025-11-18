// frontend/src/data/providers/__tests__/providers.helpers.test.ts
// Behaviour tests for the helpers exposed by src/data/providers/index.ts.

import PROVIDERS, {
  PROVIDERS_BY_ID,
  DEFAULT_CAPABILITIES,
  getProviderById,
  getProviderCapabilities,
} from '..';

describe('providers helpers', () => {
  it('getProviderById("midjourney") returns the correct provider object', () => {
    const provider = getProviderById('midjourney');

    expect(provider).toBeDefined();
    expect(provider?.id).toBe('midjourney');
    expect(provider?.name).toBe('Midjourney');

    // Basic sanity on data consistency.
    expect(typeof provider?.score).toBe('number');
    expect(provider?.score).toBeGreaterThan(0);
    expect(['up', 'down', 'flat']).toContain(provider?.trend);
  });

  it('getProviderById returns undefined for unknown ids (no throw)', () => {
    const provider = getProviderById('this-does-not-exist');
    expect(provider).toBeUndefined();
  });

  it('PROVIDERS_BY_ID exposes every provider exactly once', () => {
    // Every catalogue entry is present in the map by id.
    PROVIDERS.forEach((p) => {
      const fromMap = PROVIDERS_BY_ID.get(p.id);
      expect(fromMap).toBeDefined();
      expect(fromMap).toBe(p);
    });

    // No extras.
    expect(PROVIDERS_BY_ID.size).toBe(PROVIDERS.length);
  });

  it('getProviderCapabilities returns resolved capabilities for known providers', () => {
    const sampleId = 'openai';

    const caps = getProviderCapabilities(sampleId);

    expect(typeof caps.supportsNegative).toBe('boolean');
    expect(typeof caps.supportsPrefill).toBe('boolean');
    expect(typeof caps.supportsSeed).toBe('boolean');
    expect(typeof caps.supportsSteps).toBe('boolean');
  });

  it('getProviderCapabilities falls back to DEFAULT_CAPABILITIES for unknown ids', () => {
    const caps = getProviderCapabilities('totally-unknown');

    expect(caps).toEqual(DEFAULT_CAPABILITIES);
  });

  it('DEFAULT_CAPABILITIES is a stable, boolean-only baseline', () => {
    const values = Object.values(DEFAULT_CAPABILITIES);

    expect(values.length).toBeGreaterThan(0);
    values.forEach((value) => {
      expect(typeof value).toBe('boolean');
    });
  });
});
