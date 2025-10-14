// Provider registry + types used by the leaderboard and UI.

// --- Core provider record shown in grids/selectors ---
export type Provider = {
  id: string;
  name: string;
  href?: string;
  apiEnabled?: boolean;
  copyAndOpenEnabled?: true;
};

// --- Leaderboard metadata (scores are 0–100; all optional in the stub) ---
export type ProviderMeta = {
  id: string;           // matches Provider.id
  name?: string;        // optional display override
  score?: number;       // overall score (computed elsewhere)

  criteria?: {
    adoption?: number;
    quality?: number;
    speed?: number;
    cost?: number;
    trust?: number;
    automation?: number;
    ethics?: number;
  };
};

// Public registry (fill in later)
export const PROVIDERS: Provider[] = [];

// Optional metadata map; pages can read from this or ignore it.
export const PROVIDER_META: Record<string, ProviderMeta> = {};

// Convenience getters
export function getProviders(): Provider[] {
  return PROVIDERS;
}

export function getProviderMeta(id: string): ProviderMeta | undefined {
  return PROVIDER_META[id];
}

// Allow default import of the getter.
export default getProviders;
