// src/hooks/usePrompts.ts
"use client";

import { useEffect, useMemo, useState } from "react";
import { getApiBase, type PromptList, type PromptQuery } from "@/lib/api";

function buildUrl(params: PromptQuery) {
  const base = getApiBase();
  const q = new URLSearchParams();
  if (params.q) q.set("q", params.q);
  if (params.tag) q.set("tag", params.tag);
  if (params.page) q.set("page", String(params.page));
  if (params.pageSize) q.set("pageSize", String(params.pageSize));
  if (params.sort) q.set("sort", params.sort);
  return `${base}/api/v1/prompts?${q.toString()}`;
}

/** Minimal client hook to fetch prompts (no SWR). */
export function usePrompts(params: PromptQuery = { page: 1, pageSize: 20 }) {
  const [data, setData] = useState<PromptList | undefined>(undefined);
  const [error, setError] = useState<unknown>(undefined);
  const [isLoading, setLoading] = useState<boolean>(true);

  const url = useMemo(() => buildUrl(params), [params.q, params.tag, params.page, params.pageSize, params.sort]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(url, { headers: { "Content-Type": "application/json" } })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as PromptList;
      })
      .then((json) => alive && setData(json))
      .catch((e) => alive && setError(e))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [url]);

  return { data, error, isLoading };
}

// Back-compat alias if code imports the old name
export function usePromptsSWR(params: PromptQuery) {
  return usePrompts(params);
}

export default usePrompts;

