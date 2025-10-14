// Canonical provider model + helpers.
// Exports support both named and default imports so callers can use:
//   import getProviders, { Provider } from '@/lib/providers'
//   import { getProviders, PROVIDERS } from '@/lib/providers'

export type Provider = {
  id: string;
  name: string;
  href?: string;
  apiEnabled?: boolean;
  copyAndOpenEnabled?: true;
};

export const PROVIDERS: Provider[] = [];

/** Return the current provider registry (stub until wired to DB). */
export function getProviders(): Provider[] {
  return PROVIDERS;
}

// Allow default import as a convenience: `import getProviders from '@/lib/providers'`
export default getProviders;
