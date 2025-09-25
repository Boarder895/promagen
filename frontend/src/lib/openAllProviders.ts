"use client";

import PROVIDERS, { type Provider } from "@/lib/providers";
import { getAffiliateUrl } from "@/lib/affiliates";

/** Local query appender so we don’t depend on other modules here. */
function withQuery(
  base: string,
  params: Record<string, string | number | boolean | null | undefined>
): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    usp.set(k, String(v));
  }
  const q = usp.toString();
  return q ? (base.includes("?") ? `${base}&${q}` : `${base}?${q}`) : base;
}

/** Open every provider in a new tab; appends ?q= and ?prompt= (plus any extras). */
export default function openAllProviders(prompt: string, extra?: Record<string, string>) {
  const text = (prompt ?? "").slice(0, 300);
  const params = { q: text, prompt: text, ...(extra || {}) };

  PROVIDERS.forEach((p: Provider) => {
    const base = getAffiliateUrl(p.id) || p.website || "about:blank";
    const url = withQuery(base, params);
    window.open(url, "_blank", "noopener,noreferrer");
  });
}

