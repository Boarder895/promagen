// src/lib/affiliates.ts
// Full coverage for all 20 platforms.
// - Put your real affiliate URLs into AFFILIATE_LINKS below.
// - getAffiliateUrl() accepts either a provider id string or a Prompt-like object.
// - If no affiliate URL is set for a provider, it falls back to the provider's website.

import type { Prompt } from "@/lib/api";
import {
  PROVIDER_IDS,
  PROVIDER_MAP,
  type ProviderKey,
} from "@/lib/providers";

/** Fill these with your actual affiliate links (leave "" to fall back to website). */
export const AFFILIATE_LINKS: Record<ProviderKey, string> = {
  openai:        "",
  stability:     "",
  leonardo:      "",
  i23rf:         "", // 123RF
  artistly:      "",
  "adobe-firefly": "",
  midjourney:    "",
  canva:         "",
  bing:          "", // Bing Image Creator
  ideogram:      "",
  picsart:       "",
  fotor:         "",
  nightcafe:     "",
  playground:    "", // Playground AI
  pixlr:         "",
  deepai:        "",
  novelai:       "",
  lexica:        "",
  openart:       "",
  "flux-schnell": "",
} as const;

/** Loose matching aliases → canonical provider id */
const SYNONYMS: Array<{ id: ProviderKey; needles: string[] }> = [
  { id: "openai",        needles: ["openai", "gpt", "dalle"] },
  { id: "stability",     needles: ["stability", "stable diffusion", "stable", "sd", "sdxl"] },
  { id: "leonardo",      needles: ["leonardo", "leo"] },
  { id: "i23rf",         needles: ["123rf", "i23rf", "stock"] },
  { id: "artistly",      needles: ["artistly"] },
  { id: "adobe-firefly", needles: ["adobe", "firefly", "adobe firefly"] },
  { id: "midjourney",    needles: ["midjourney", "mj"] },
  { id: "canva",         needles: ["canva"] },
  { id: "bing",          needles: ["bing", "microsoft designer", "image creator"] },
  { id: "ideogram",      needles: ["ideogram"] },
  { id: "picsart",       needles: ["picsart"] },
  { id: "fotor",         needles: ["fotor"] },
  { id: "nightcafe",     needles: ["nightcafe", "night cafe"] },
  { id: "playground",    needles: ["playground", "playground ai"] },
  { id: "pixlr",         needles: ["pixlr"] },
  { id: "deepai",        needles: ["deepai", "deep ai"] },
  { id: "novelai",       needles: ["novelai", "novel ai"] },
  { id: "lexica",        needles: ["lexica"] },
  { id: "openart",       needles: ["openart", "open art"] },
  { id: "flux-schnell",  needles: ["flux", "schnell", "black forest labs", "bfl"] },
];

/** Try to normalize an arbitrary string to a ProviderKey. */
function normalizeId(raw: string | undefined | null): ProviderKey | undefined {
  const q = (raw ?? "").toLowerCase().trim();
  if (!q) return undefined;

  // exact match to known ids
  if ((PROVIDER_IDS as readonly string[]).includes(q)) return q as ProviderKey;

  // alias match
  for (const row of SYNONYMS) {
    if (row.needles.some((n) => q.includes(n))) return row.id;
  }
  return undefined;
}

/**
 * Get affiliate URL for a provider:
 * - If an affiliate link is configured, return it.
 * - Otherwise, return the provider's official website.
 * - If unknown, return "".
 */
export function getAffiliateUrl(
  input: Pick<Prompt, "provider"> | string | undefined | null
): string {
  const id = typeof input === "string" ? normalizeId(input) : normalizeId(input?.provider);
  if (!id) return "";

  const affiliate = AFFILIATE_LINKS[id];
  if (affiliate) return affiliate;

  return PROVIDER_MAP[id]?.website ?? "";
}

