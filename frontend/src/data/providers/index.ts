// frontend/src/data/providers/index.ts
// Canonical AI provider catalogue and capability map for Promagen.

import providersJson from './providers.json';
import capabilitiesJson from './providers.capabilities.json';
import type { Provider } from '@/types/providers';

export type { Provider } from '@/types/providers';

export type ProviderCapabilityFlags = {
  supportsNegative: boolean;
  supportsPrefill: boolean;
  supportsSeed: boolean;
  supportsSteps: boolean;
};

export type ProviderCapabilityOverrides = Partial<ProviderCapabilityFlags>;

/**
 * Single source of truth: providers.json
 * We assert the JSON matches the Provider type we control.
 */
const PROVIDERS_DATA = providersJson as Provider[];

export const PROVIDERS: Provider[] = PROVIDERS_DATA;

/**
 * Map of provider id -> provider.
 */
export const PROVIDERS_BY_ID: ReadonlyMap<string, Provider> = new Map(
  PROVIDERS.map((p) => [p.id, p]),
);

/**
 * Lookup helper – returns undefined if the provider id is unknown.
 */
export const getProviderById = (id: string): Provider | undefined => PROVIDERS_BY_ID.get(id);

/**
 * Default capability flags that apply unless overridden.
 */
export const DEFAULT_CAPABILITIES: ProviderCapabilityFlags = capabilitiesJson._defaults;

const capabilityEntries = Object.entries(capabilitiesJson).filter(
  ([key]) => key !== '_defaults',
) as Array<[string, ProviderCapabilityOverrides]>;

/**
 * Map of provider id -> fully-resolved capabilities
 * (defaults merged with any provider-specific overrides).
 */
export const PROVIDER_CAPABILITIES: Record<string, ProviderCapabilityFlags> = Object.fromEntries(
  capabilityEntries.map(([id, overrides]) => {
    const o = overrides ?? {};
    return [
      id,
      {
        supportsNegative: o.supportsNegative ?? DEFAULT_CAPABILITIES.supportsNegative,
        supportsPrefill: o.supportsPrefill ?? DEFAULT_CAPABILITIES.supportsPrefill,
        supportsSeed: o.supportsSeed ?? DEFAULT_CAPABILITIES.supportsSeed,
        supportsSteps: o.supportsSteps ?? DEFAULT_CAPABILITIES.supportsSteps,
      },
    ];
  }),
);

/**
 * Helper: get resolved capability flags for a provider.
 * Falls back to DEFAULT_CAPABILITIES if the id has no explicit entry.
 */
export const getProviderCapabilities = (id: string): ProviderCapabilityFlags =>
  PROVIDER_CAPABILITIES[id] ?? DEFAULT_CAPABILITIES;

export default PROVIDERS;
