// src/lib/swrcache.ts
// Minimal SWR-ish cache helper.
// Exports:
//   - useSwrCache(opts)  // canonical
//   - useSWRCache(key, fetcher, opts) // SWR-style wrapper
//   - Aliases: useSWCache, useSwCache (legacy)

import { useCallback, useEffect, useRef, useState } from 'react';

type RefreshFn<T> = () => Promise<T> | T;

export type UseSwrCacheOptions<T> = {
  key: string;
  initial?: T;
  refresh?: RefreshFn<T>;
  refreshOnMount?: boolean; // default true if refresh provided
};

export type UseSwrCacheResult<T> = {
  data: T | undefined;
  setData: (next: T | ((prev: T | undefined) => T)) => void;
  error: unknown;
  isLoading: boolean;
  refresh: () => Promise<void>;
};

// ---- Canonical hook --------------------------------------------------------

export const useSwrCache = <T,>(opts: UseSwrCacheOptions<T>): UseSwrCacheResult<T> => {
  const { key, initial, refresh: doRefresh, refreshOnMount } = opts;

  const [data, setData] = useState<T | undefined>(() => initial);
  const [error, setError] = useState<unknown>(undefined);
  const [isLoading, setLoading] = useState<boolean>(false);

  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const refresh = useCallback(async () => {
    if (!doRefresh) return;
    setLoading(true);
    try {
      const next = await doRefresh();
      if (alive.current) setData(next);
      if (alive.current) setError(undefined);
    } catch (e) {
      if (alive.current) setError(e);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [doRefresh]);

  useEffect(() => {
    if (doRefresh && (refreshOnMount ?? true)) {
      refresh();
    }
  }, [key, doRefresh, refreshOnMount, refresh]);

  return { data, setData, error, isLoading, refresh };
};

// ---- SWR-style wrapper (matches component usage) ---------------------------

export type UseSWRCacheOptions<T> = {
  initial?: T;
  refreshMs?: number;
  revalidateOnFocus?: boolean;
};

export const useSWRCache = <T,>(
  key: string,
  fetcher: RefreshFn<T>,
  opts: UseSWRCacheOptions<T> = {}
): UseSwrCacheResult<T> => {
  const base = useSwrCache<T>({
    key,
    initial: opts.initial,
    refresh: fetcher,
    refreshOnMount: true,
  });

  const { refresh } = base;

  // polling
  useEffect(() => {
    if (!opts.refreshMs) return;
    const t = setInterval(refresh, opts.refreshMs);
    return () => clearInterval(t);
  }, [opts.refreshMs, refresh]);

  // revalidate on focus
  useEffect(() => {
    if (!opts.revalidateOnFocus) return;
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [opts.revalidateOnFocus, refresh]);

  return base;
};

// ---- Legacy aliases so old imports compile --------------------------------
export { useSwrCache as useSWCache, useSwrCache as useSwCache };
export type UseSWCacheOptions<T> = UseSwrCacheOptions<T>;
export type UseSWCacheResult<T>  = UseSwrCacheResult<T>;



