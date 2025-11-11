// src/lib/providers/deeplinks.ts
import type { DeepLinkParams } from "./schema";

/**
 * Build a deep-link URL to open/run at the provider.
 * If we don't have a special mapping for an id, fall back to baseUrl.
 */

type Builder = (baseUrl: string, params: DeepLinkParams) => string;

const passthrough: Builder = (base, _params) => base;

const builders: Record<string, Builder> = {
  // Example specialized mapping:
  // "openai": (base, p) => `${base}?size=${p.size ?? "1024x1024"}&prompt=${encodeURIComponent(String(p.prompt ?? ""))}`
};

export function buildDeepLink(providerId: string, baseUrl: string, params: DeepLinkParams = {}): string {
  const b = builders[providerId] ?? passthrough;
  return b(baseUrl, params);
}



