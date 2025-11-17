// src/app/adapters/index.ts

// Stage-1/2: lightweight registry so pages can compile.
// No network calls; just shape prompts and deep links built from providers.json.

import providersJson from '@/data/providers/providers.json';

type Builder = (raw: string) => string;

type DeepLinkResult = {
  url: string;
  prefilledUrl?: string;
  /** Whether we can prefill the target with the prompt */
  supportsPrefill: boolean;
};

type DeepLink = (prompt: string) => DeepLinkResult;

export type Adapter = {
  id: string;
  buildPrompt: Builder;
  deepLink: DeepLink;
};

type ProviderRow = {
  id: string;
  url?: string | null;
};

const identity: Builder = (value) => value.trim();

/**
 * Basic `?q=` deep link helper.
 * Individual adapters can move to custom logic later if needed.
 */
const openUrl = (baseUrl: string): DeepLink => {
  const safeBase = baseUrl || 'https://example.com';

  return (prompt: string): DeepLinkResult => {
    const trimmedPrompt = prompt.trim();
    const target = new URL(safeBase);

    if (trimmedPrompt.length > 0) {
      target.searchParams.set('q', trimmedPrompt);
    }

    const finalUrl = target.toString();

    return {
      url: finalUrl,
      prefilledUrl: finalUrl,
      supportsPrefill: trimmedPrompt.length > 0,
    };
  };
};

const providerRows = providersJson as readonly ProviderRow[];

/**
 * Build a simple adapter map from providers.json:
 *  - key: provider id
 *  - deepLink: opens provider URL with `?q=` prefill when possible
 */
const _adapters: Record<string, Adapter> = Object.fromEntries(
  providerRows.map((provider) => {
    const id = provider.id.trim();
    const url = String(provider.url ?? 'https://example.com');

    const adapter: Adapter = {
      id,
      buildPrompt: identity,
      deepLink: openUrl(url),
    };

    return [id, adapter];
  }),
);

export const adapterIds = Object.keys(_adapters);

/**
 * Resolve an adapter by id; if we have no concrete adapter yet,
 * fall back to a harmless example.com deep link.
 */
export function getAdapter(id: string): Adapter {
  return (
    _adapters[id] ?? {
      id,
      buildPrompt: identity,
      deepLink: openUrl('https://example.com'),
    }
  );
}

export default _adapters;
