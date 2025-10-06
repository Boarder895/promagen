import { useEffect, useMemo, useState } from 'react';
import { API_BASE } from '@/lib/api';

// Local minimal types for the hook
export type Prompt = {
  id: string;
  text: string;
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

export function usePrompts(query: PromptQuery = {}) {
  const [data, setData] = useState<PromptList>({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (query.q) p.set('q', query.q);
    if (typeof query.limit === 'number') p.set('limit', String(query.limit));
    if (typeof query.offset === 'number') p.set('offset', String(query.offset));
    const s = p.toString();
    return s ? `?${s}` : '';
  }, [query.q, query.limit, query.offset]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/v1/prompts${qs}`, { cache: 'no-store' });
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

  return { data, loading, error };
}




