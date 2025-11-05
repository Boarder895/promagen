// src/lib/routes.ts
// Centralized, typed route helpers (gold standard)

export type ProviderSub = "" | "trends" | "compare" | null | undefined;

/**
 * Build the canonical URL for a provider page.
 *   urlForProviderPage("openai") -> "/providers/openai"
 *   urlForProviderPage("openai", { sub: "trends" }) -> "/providers/openai/trends"
 */
export function urlForProviderPage(
  id: string,
  opts?: { sub?: ProviderSub }
): string {
  let path = `/providers/${encodeURIComponent(id)}`;
  const sub = opts?.sub;

  // Explicit narrowing—append only non-empty strings.
  if (typeof sub === "string" && sub.length > 0) {
    path += `/${sub}`;
  }
  return path;
}

// Back-compat named export used in a few files.
export const urlForProvider = urlForProviderPage;

