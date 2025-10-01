"use client";

import { useEffect, useMemo, useState } from "react";

export type Prompt = {
  id: string;
  title: string;
  text: string;
  tags?: string[];
  href?: string;
  likes?: number;
  uses?: number;
};

export type PromptQuery = {
  q?: string;
  tag?: string;
  sort?: "latest" | "popular";
};

export type UsePromptsOptions = {
  /** initial params from the server or URL */
  params?: PromptQuery | Record<string, unknown>;
  /** raw list from the server (recommended) */
  allPrompts?: Prompt[];
  /** optional client-side filter: return only prompts that satisfy this predicate */
  where?: (p: Prompt) => boolean;
};

type State = {
  loading: boolean;
  error: Error | null;
  filtered: Prompt[];
};

function normalizeQuery(params: UsePromptsOptions["params"]): PromptQuery {
  if (!params) return {};
  const q: PromptQuery = {};
  const src = params as Record<string, unknown>;
  if (typeof src.q === "string") q.q = src.q;
  if (typeof src.tag === "string") q.tag = src.tag;
  if (src.sort === "latest" || src.sort === "popular") q.sort = src.sort;
  return q;
}

function applyQuery(list: Prompt[], q: PromptQuery, where?: (p: Prompt) => boolean): Prompt[] {
  let out = list;

  if (q.q?.trim()) {
    const needle = q.q.toLowerCase();
    out = out.filter(
      p =>
        p.title.toLowerCase().includes(needle) ||
        p.text.toLowerCase().includes(needle) ||
        (p.tags ?? []).some(t => t.toLowerCase().includes(needle)),
    );
  }

  if (q.tag) {
    const tag = q.tag.toLowerCase();
    out = out.filter(p => (p.tags ?? []).some(t => t.toLowerCase() === tag));
  }

  if (where) out = out.filter(where);

  if (q.sort === "popular") {
    out = [...out].sort((a, b) => ((b.likes ?? 0) * 2 + (b.uses ?? 0)) - ((a.likes ?? 0) * 2 + (a.uses ?? 0)));
  } else if (q.sort === "latest") {
    // no-op unless you add a timestamp field; keep stable ordering
    out = [...out];
  }

  return out;
}

export function usePrompts(options: UsePromptsOptions = {}): State {
  const { params, allPrompts = [], where } = options;
  const [state, setState] = useState<State>({ loading: false, error: null, filtered: [] });

  const query = useMemo(() => normalizeQuery(params), [params]);

  useEffect(() => {
    // entirely client-side filtering of a list provided by the server/page
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      const filtered = applyQuery(allPrompts, query, where);
      setState({ loading: false, error: null, filtered });
    } catch (err) {
      setState({ loading: false, error: err as Error, filtered: [] });
    }
  }, [allPrompts, query, where]);

  return state;
}


