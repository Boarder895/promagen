// Stage-1/2: lightweight registry so pages can compile.
// No network calls; just shape prompts and links.

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

const identity: Builder = (s) => s.trim();
const openUrl = (url: string): DeepLink => (prompt) => {
  const prefilled = `${url}${url.includes("?") ? "&" : "?"}q=${encodeURIComponent(prompt)}`;
  return {
    url,
    prefilledUrl: prefilled,
    supportsPrefill: true,
  };
};

import providers from "@/data/providers.json";

const _adapters: Record<string, Adapter> = Object.fromEntries(
  (providers as any[]).map((p) => {
    const url = String(p.url ?? p.website ?? "https://example.com");
    const id = String(p.id);
    const adapter: Adapter = {
      id,
      buildPrompt: identity,
      deepLink: openUrl(url),
    };
    return [id, adapter];
  })
);

export const adapterIds = Object.keys(_adapters);
export function getAdapter(id: string): Adapter {
  return _adapters[id] ?? {
    id,
    buildPrompt: identity,
    deepLink: openUrl("https://example.com"),
  };
}
export default _adapters;



