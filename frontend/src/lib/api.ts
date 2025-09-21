// src/lib/api.ts
"use client";

import useSWR from "swr";

type ListParams = {
  q?: string;
  tag?: string;
  sort?: "trending" | "createdAt";
  limit?: number;
};

type Prompt = {
  id: string;
  title: string;
  summary: string;
  body: string;
  tags: string[];
  author: string;
  curated?: boolean;
  provider: string;
};

const fetcher = (url: string) =>
  fetch(url, { cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

/** SWR hook for the /api/prompts endpoint (works with App Router) */
export function usePromptsSWR(params: ListParams) {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.tag) qs.set("tag", params.tag);
  if (params.sort) qs.set("sort", params.sort);
  if (params.limit) qs.set("limit", String(params.limit));

  const key = `/api/prompts${qs.size ? "?" + qs.toString() : ""}`;
  return useSWR<{ items: Prompt[] }>(key, fetcher);
}

/** Central place to generate outbound/affiliate links per provider */
export function getAffiliateUrl(provider: string | undefined | null) {
  if (!provider) return null;

  // Example mapping (extend as needed; safe default is provider homepage)
  switch (provider.toLowerCase()) {
    case "openai":
      return "https://openai.com/";
    case "anthropic":
      return "https://www.anthropic.com/";
    case "google":
    case "gemini":
      return "https://ai.google/";
    default:
      // Fallback – avoid 404s; keep it neutral/safe
      return `https://www.google.com/search?q=${encodeURIComponent(provider)}`;
  }
}
