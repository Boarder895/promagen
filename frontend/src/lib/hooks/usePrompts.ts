import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "@/lib/api";

export type Prompt = {
  id: string;
  text?: string;
  title?: string;
  providerId?: string;
  createdAt?: string;
};

export type PromptList = {
  items: Prompt[];
  total: number;
};

export type PromptQuery = {
  q?: string;
  limit?: number;
  offset?: number;
};

export type UsePromptsOptions = PromptQuery & {
  /** Optional client-side filter: return only prompts that satisfy this predicate. */
  filter?: (p: Prompt) => boolean;
};

export function usePrompts(options: UsePromptsOptions = {}) {
  const { q, limit, offset, filter } = options;

  const [data, setData] = useState<PromptList>({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (typeof limit === "number") p.set("limit", String(limit));
    if (typeof offset === "number") p.set("offset", String(offset));
    const s = p.toString();
    return s ? `?${s}` : "";
  }, [q, limit, offset]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/v1/prompts${qs}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as PromptList;
        if (!cancelled) setData(json);
      } catch (e: any) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [qs]);

  const all = data?.items ?? [];
  const filtered = typeof filter === "function" ? all.filter(filter) : all;

  // Back-compat shape that callers expect:
  return { data, loading, error, filtered };
}