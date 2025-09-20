// Simple fetch helpers for the public API
import type { Prompt } from "@/data/prompts";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") || "";

export interface PromptsResponse {
  items: Prompt[];
  total: number;
  limit: number;
  offset: number;
}

export async function fetchPrompts(opts: {
  q?: string;
  tag?: string;          // single tag for server-side filtering (we'll AND the rest client-side)
  sort?: "trending" | "likes" | "uses" | "createdAt";
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}): Promise<PromptsResponse> {
  if (!API_BASE) throw new Error("API base URL is not set");

  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  if (opts.tag) params.set("tag", opts.tag);
  if (opts.sort) params.set("sort", opts.sort);
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.offset) params.set("offset", String(opts.offset));

  const url = `${API_BASE}/prompts?${params.toString()}`;
  const res = await fetch(url, { signal: opts.signal, cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as PromptsResponse;
}
