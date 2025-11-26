// frontend/src/lib/providers.ts
//
// Backwards-compatible wrapper around the canonical providers catalogue
// in src/data/providers/index.ts.
//
// Intent:
//   - Keep src/data/providers/index.ts as the single source of truth.
//   - Allow existing imports from "@/lib/providers" to keep working.
//   - Avoid any hard-coded arrays or duplicate Provider types here.

import PROVIDERS, {
  PROVIDERS_BY_ID,
  DEFAULT_CAPABILITIES,
  getProviderById,
  getProviderCapabilities,
} from '@/data/providers';
import type { Provider } from '@/types/providers';

export type { Provider } from '@/types/providers';

// Re-export the core helpers so callers can choose whichever style they prefer.
export {
  PROVIDERS,
  PROVIDERS_BY_ID,
  DEFAULT_CAPABILITIES,
  getProviderById,
  getProviderCapabilities,
};

/**
 * Historic lower-case export for the full provider list.
 * Useful where code previously used `providers` directly.
 */
export const providers: Provider[] = PROVIDERS;

/**
 * Historic helper name: alias to getProviderById.
 */
export const getProvider = (idOrSlug: string): Provider | undefined => getProviderById(idOrSlug);
