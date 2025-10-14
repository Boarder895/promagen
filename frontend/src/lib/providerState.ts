// Minimal in-memory view over providers + metadata.
// Keep this tolerant; other pages import it during the great refactor.

import {
  PROVIDERS,
  PROVIDER_META,
  type Provider,
  type ProviderMeta,
} from '@/lib/providers';

// Read list (stable entry point)
export function getProviders(): Provider[] {
  return PROVIDERS;
}

// Convenience meta getter some pages call.
export function getProviderMeta(id: string): ProviderMeta | undefined {
  // PROVIDER_META may be sparse in the stub; be permissive.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (PROVIDER_META as any)?.[id];
}

// “Has API” — for demo/leaderboard usage. Treat presence of any meta as API-capable for now.
export function providersWithApi(): Provider[] {
  return PROVIDERS.filter((p) => {
    // `Provider` has an id in your stubs; cast defensively.
    const pid = (p as unknown as { id: string }).id;
    return Boolean(getProviderMeta(pid));
  });
}

// Called by the admin sync route. No-op stub that keeps the UI happy.
export async function refreshProviders(): Promise<{ updated: number; message: string }> {
  return { updated: 0, message: 'registry refreshed (stub)' };
}
