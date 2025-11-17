// frontend/src/data/providers/providers.capabilities.d.ts

export type ProviderCapabilityFlags = {
  supportsNegative: boolean;
  supportsPrefill: boolean;
  supportsSeed: boolean;
  supportsSteps: boolean;
};

export type ProviderCapabilityOverrides = Partial<ProviderCapabilityFlags>;

export interface ProviderCapabilitiesFile {
  _defaults: ProviderCapabilityFlags;
  [providerId: string]: ProviderCapabilityOverrides;
}

declare module './providers.capabilities.json' {
  const capabilities: ProviderCapabilitiesFile;
  export default capabilities;
}
