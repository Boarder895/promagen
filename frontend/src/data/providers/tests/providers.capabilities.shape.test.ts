// frontend/src/data/providers/tests/providers.capabilities.shape.test.ts
// Shape tests for providers.capabilities.json – ensures flags stay aligned with providers.json.

import capabilitiesJson from '../providers.capabilities.json';
import providers from '../providers.json';
import { DEFAULT_CAPABILITIES, PROVIDER_CAPABILITIES, getProviderCapabilities } from '../index';

type CapabilitiesFile = typeof capabilitiesJson;

const allowedCapabilityKeys = [
  'supportsNegative',
  'supportsPrefill',
  'supportsSeed',
  'supportsSteps',
] as const;

describe('providers.capabilities.json shape', () => {
  it('has _defaults with all four capability flags as booleans', () => {
    const defaults = capabilitiesJson._defaults;

    expect(defaults).toBeDefined();
    allowedCapabilityKeys.forEach((key) => {
      expect(Object.prototype.hasOwnProperty.call(defaults, key)).toBe(true);
      expect(typeof defaults[key]).toBe('boolean');
    });
  });

  it('only known capability flags are present in overrides and all are booleans', () => {
    const entries = Object.entries(capabilitiesJson).filter(([key]) => key !== '_defaults');

    entries.forEach(([providerId, overrides]) => {
      const overrideKeys = Object.keys(overrides as Record<string, unknown>);

      overrideKeys.forEach((key) => {
        expect(allowedCapabilityKeys).toContain(key as (typeof allowedCapabilityKeys)[number]);

        const value = (overrides as Record<string, unknown>)[key];
        expect(typeof value).toBe('boolean');
      });

      // Sanity: provider ids should look like catalogue ids.
      expect(/^[a-z0-9-]+$/.test(providerId)).toBe(true);
    });
  });

  it('capability entries match the provider catalogue 1:1', () => {
    const providerIds = new Set(providers.map((p) => p.id));
    const capabilityIds = new Set(
      Object.keys(capabilitiesJson).filter((key) => key !== '_defaults'),
    );

    // Every provider has an explicit capabilities entry.
    providerIds.forEach((id) => {
      expect(capabilityIds.has(id)).toBe(true);
    });

    // No stray capability entries for non-existent providers.
    capabilityIds.forEach((id) => {
      expect(providerIds.has(id)).toBe(true);
    });

    expect(capabilityIds.size).toBe(providerIds.size);
  });

  it('DEFAULT_CAPABILITIES matches _defaults from the JSON file', () => {
    expect(DEFAULT_CAPABILITIES).toEqual(capabilitiesJson._defaults);
  });

  it('PROVIDER_CAPABILITIES contains only known provider ids', () => {
    const providerIds = new Set(providers.map((p) => p.id));
    const capabilityIds = Object.keys(PROVIDER_CAPABILITIES);

    capabilityIds.forEach((id) => {
      expect(providerIds.has(id)).toBe(true);
    });
  });

  it('getProviderCapabilities merges defaults for known providers', () => {
    const sampleId = 'midjourney';
    const resolved = getProviderCapabilities(sampleId);

    // Currently there are no explicit overrides; everything should match defaults.
    expect(resolved).toEqual(DEFAULT_CAPABILITIES);

    // And it should be the exact entry from PROVIDER_CAPABILITIES.
    expect(resolved).toEqual(PROVIDER_CAPABILITIES[sampleId]);
  });

  it('getProviderCapabilities falls back to DEFAULT_CAPABILITIES for unknown ids', () => {
    const resolved = getProviderCapabilities('some-unknown-provider-id');
    expect(resolved).toEqual(DEFAULT_CAPABILITIES);
  });

  it.skip('applies non-empty overrides on top of defaults when present', () => {
    // To turn this on:
    // 1) Add a provider in providers.capabilities.json with at least one override, e.g.:
    //    "midjourney": { "supportsNegative": false }
    // 2) Update this test to assert that:
    //
    // const resolved = getProviderCapabilities('midjourney');
    // expect(resolved.supportsNegative).toBe(false);
    // expect(resolved.supportsPrefill).toBe(DEFAULT_CAPABILITIES.supportsPrefill);
    //
    // and then remove the `.skip`.
  });
});
