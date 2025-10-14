// lib/hooks/usePrompts.ts
// Minimal, compile-safe hook used by Prompt* components

import { prompts as DATA } from '@/data/prompts';

export type Prompt = {
  id: string;
  title: string;
  prompt?: string;        // some code uses p.prompt
  text?: string;          // some code uses p.text
  tags?: string[];
  href?: string;          // some code links to p.href
};

export type UsePromptsResult = {
  filtered: Prompt[];
  loading: boolean;
  error: { message: string } | null; // components read error.message
};

export default function usePrompts({
  params,
  allPrompts,
}: {
  params?: Record<string, string>;
  allPrompts?: Prompt[];
} = {}): UsePromptsResult {
  const list: Prompt[] = (allPrompts ?? (DATA as unknown as Prompt[])) ?? [];

  // very light client-side filter; keep it permissive
  let filtered = list;
  const q = params?.q?.toLowerCase?.().trim();
  if (q) {
    filtered = list.filter((p) =>
      [p.title, p.prompt, p.text, ...(p.tags ?? [])]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q))
    );
  }

  return { filtered, loading: false, error: null };
}

