import { useMemo } from "react";

export type PromptParams = Record<string, unknown>;

/**
 * Memoize results of a compute function based on params.
 * Uses a JSON key to satisfy exhaustive-deps without deep comparisons.
 */
export function usePrompts<T>(params: PromptParams, compute: (p: PromptParams) => T): T {
  const key = useMemo(() => JSON.stringify(params), [params]);
  // depend on compute and the stable key; no direct 'params' dep to avoid lint noise
  return useMemo(() => compute(params), [compute, key]);
}


