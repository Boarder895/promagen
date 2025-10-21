import { useMemo } from 'react';

export type Prompt = { id: string; title: string; text: string; tags?: string[]; description?: string; prompt?: string; };

export default function usePrompts(opts?: { params?: Record<string, string>; allPrompts?: Prompt[] }) {
  const q = (opts?.params?.q ?? '').toLowerCase();

  const filtered = useMemo(() => {
    const all = opts?.allPrompts ?? [];
    return q
      ? all.filter(p => p.title.toLowerCase().includes(q) || p.text.toLowerCase().includes(q))
      : all;
  }, [opts?.allPrompts, q]);

  return { filtered, loading: false, error: undefined as Error | undefined };
}







