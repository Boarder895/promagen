import { Prompt } from "@/hooks/usePrompts";
import { PROVIDERS, ProviderKey, buildAffiliateUrl } from "@/lib/providers";

function pickPromptText(p: Prompt): string {
  return (p.body && p.body.trim()) || p.summary || p.title || p.id;
}

/**
 * Open provider tabs with affiliate links.
 * - If `only` is omitted, opens ALL providers in the registry.
 * - We also copy the prompt to clipboard for convenience.
 */
export async function runAcrossProviders(p: Prompt, only?: ProviderKey[]) {
  const promptText = pickPromptText(p).slice(0, 2000);
  const meta = { id: p.id, title: p.title };

  try {
    await navigator.clipboard.writeText(promptText);
  } catch {
    // clipboard can fail silently (permissions); no biggie
  }

  const providers = only
    ? PROVIDERS.filter((x) => only.includes(x.key))
    : PROVIDERS;

  // Open synchronously in the click gesture to avoid popup blockers
  for (const provider of providers) {
    const href = buildAffiliateUrl(provider, { prompt: promptText, meta });
    window.open(href, "_blank", "noopener,noreferrer");
  }
}
