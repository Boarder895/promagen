export async function apiGet<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith("http") ? path : path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(url, { headers: { accept: "application/json" }, ...init });
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return (await res.json()) as T;
}

import { PROVIDERS, buildAffiliateUrl } from "@/lib/providers";

/**
 * Back-compat wrapper used by legacy components:
 *   getAffiliateUrl("openai", "prompt text", { id: "...", title: "..." })
 */
export function getAffiliateUrl(
  providerIdOrName: string,
  prompt?: string,
  meta?: Record<string, unknown>
): string {
  const id = providerIdOrName.toLowerCase();
  const provider =
    PROVIDERS.find((p) => p.key === id) ||
    PROVIDERS.find((p) => p.name.toLowerCase() === id) ||
    // fall back to first (OpenAI) if unknown
    PROVIDERS[0];

  return buildAffiliateUrl(provider, { prompt, meta });
}
