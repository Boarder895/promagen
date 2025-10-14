// Canonical provider types + helpers. Looser on purpose so old pages compile.

export type Provider = {
  id: string;
  name: string;
  href?: string;
  // flags older pages read:
  apiEnabled?: boolean;
  hasApi?: boolean;
  supportsAutomation?: boolean;
  hasAffiliate?: boolean;
  website?: string;
};

export type ProviderMeta = {
  // demo weights / scores (optional in stub)
  criteria1?: number;
  criteria2?: number;
  score?: number;
};

// Public registry (stub – fill in later)
export const PROVIDERS: Provider[] = [];

// Optional metadata map; pages can read this or ignore it.
export const PROVIDER_META: Record<string, ProviderMeta> = {};

// Convenience getters
export function getProviders(): Provider[] {
  return PROVIDERS;
}

export function getProviderMeta(id: string): ProviderMeta | undefined {
  return PROVIDER_META[id];
}

// Expose ids + simple filter helpers some code expects
export type ProviderId = string;
export const PROVIDER_IDS: ProviderId[] = PROVIDERS.map(p => p.id);
export const providersWithApi = PROVIDERS.filter(p => p.apiEnabled || p.hasApi);

// Allow default import of the getter.
export default getProviders;


