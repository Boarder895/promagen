// frontend/src/data/providers/index.ts
// Canonical AI provider catalogue and capability map for Promagen.

import providersJson from './providers.json';
import capabilitiesJson from './providers.capabilities.json';
import promptOptionsJson from './prompt-options.json';
import platformFormatsJson from './platform-formats.json';
import type { Provider } from '@/types/providers';
import type { PromptOptions, PlatformFormats } from '@/types/prompt-builder';

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

// ============================================================================
// Prompt Builder Exports
// ============================================================================

/**
 * Prompt options: 30 curated options per category (uniform across all platforms)
 */
export const PROMPT_OPTIONS = promptOptionsJson as PromptOptions;

/**
 * Platform formats: assembly rules per platform
 */
export const PLATFORM_FORMATS = platformFormatsJson as PlatformFormats;

/**
 * Get all available prompt categories
 */
export const getPromptCategories = () => Object.keys(PROMPT_OPTIONS.categories);

/**
 * Get options for a specific category
 */
export const getPromptCategoryOptions = (category: string) =>
  PROMPT_OPTIONS.categories[category as keyof typeof PROMPT_OPTIONS.categories]?.options ?? [];

/**
 * Get platform format configuration
 */
export const getPlatformFormatConfig = (platformId: string) =>
  PLATFORM_FORMATS.platforms[platformId] ?? PLATFORM_FORMATS._defaults;

export default PROVIDERS;
