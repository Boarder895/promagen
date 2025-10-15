import { useMemo } from 'react';

export type Prompt = { id: string; title: string; text: string; tags?: string[] };

export default function usePrompts(opts?: { params?: Record<string, string>; allPrompts?: Prompt[] }) {
  const all = opts?.allPrompts ?? [];
  const q = (opts?.params?.q ?? '').toLowerCase();

  const filtered = useMemo(
    () => (q ? all.filter(p => p.title.toLowerCase().includes(q) || p.text.toLowerCase().includes(q)) : all),
    [all, q]
  );

  return { filtered, loading: false, error: undefined as Error | undefined };
}

