"use client";

import type { Provider } from "@/lib/providers";
import { withQuery } from "@/lib/providers";
import { getAffiliateUrl } from "@/lib/affiliates";

/** Build the best URL for a provider (affiliate first, then website). */
export function urlForProvider(p: Provider, params?: Record<string, string>): string {
  const base = getAffiliateUrl(p.id) || p.website || "about:blank";
  return params ? withQuery(base, params) : base;
}

/** Open one provider in a new tab. */
export function openProvider(p: Provider, params?: Record<string, string>) {
  const url = urlForProvider(p, params);
  window.open(url, "_blank", "noopener,noreferrer");
}
