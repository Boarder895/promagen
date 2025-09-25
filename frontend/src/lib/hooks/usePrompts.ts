// src/lib/hooks/usePrompts.ts
"use client";

import { useEffect, useMemo, useState } from "react";
import type { PromptList, PromptQuery } from "@/lib/api";
import { getApiBase } from "@/lib/api";

/** Client hook to fetch a paginated prompt list (no SWR). */
export function usePromptsSWR(params: PromptQuery) {
  const [data, setData] = useState<PromptList | undefined>(undefined);
  const [error, setError] = useState<unknown>(undefined);
  const [isLoading, setLoading] = useState<boolean>(true);

  const url = useMemo(() => {
    const base = getApiBase();
    const usp = new URLSearchParams();
    if (params.q) usp.set("q", params.q);
    if (params.tag) usp.set("tag", params.tag);
    if (params.page) usp.set("page", String(params.page));
    if (params.pageSize) usp.set("pageSize", String(params.pageSize));
    if (params.sort) usp.set("sort", params.sort);
    return `${base}/api/v1/prompts?${usp.toString()}`;
  }, [params.q, params.tag, params.page, params.pageSize, params.sort]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(url, { headers: { "Content-Type": "application/json" } })
      .then((r) => r.json())
      .then((json: PromptList) => {
        if (alive) {
          setData(json);
          setError(undefined);
        }
      })
      .catch((e) => alive && setError(e))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [url]);

  return { data, error, isLoading };
}
