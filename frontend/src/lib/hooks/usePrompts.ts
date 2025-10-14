// Lightweight hook + types to satisfy prompt pages/components.
// If you have real data at src/data/prompts, this will use it.
export type Prompt = {
  id: string;
  title: string;
  tags: string[];
  prompt?: string;
  href?: string;
  [k: string]: unknown;
};

let ALL: Prompt[] = [];
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('@/data/prompts');
  const raw = (mod?.default ?? mod?.prompts ?? mod) as any;
  if (Array.isArray(raw)) ALL = raw;
} catch {
  // fine: stay empty
}

export default function usePrompts(_opts?: {
  params?: Record<string, string>;
  allPrompts?: Prompt[];
}) {
  const data = _opts?.allPrompts ?? ALL;
  return { filtered: data, loading: false, error: null as null | string };
}
