"use client";

import { useEffect, useRef, useState } from "react";

type UseFetchIntervalOptions = {
  intervalMs?: number;
  immediate?: boolean;
  whenHiddenPause?: boolean;
};

export function useFetchInterval<T = unknown>(
  url: string,
  { intervalMs = 60_000, immediate = true, whenHiddenPause = true }: UseFetchIntervalOptions = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!!immediate);
  const timerRef = useRef<number | null>(null);

  const running = useRef(true);

  async function fetchOnce() {
    try {
      setIsLoading(true);
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {throw new Error(`HTTP ${res.status}`);}
      const json = (await res.json()) as T;
      setData(json);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }

  function clearTimer() {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function start() {
    clearTimer();
    if (!running.current) {return;}
    timerRef.current = window.setInterval(() => {
      if (whenHiddenPause && document.visibilityState === "hidden") {return;}
      void fetchOnce();
    }, intervalMs) as unknown as number;
  }

  function refresh() {
    void fetchOnce();
  }

  useEffect(() => {
    running.current = true;
    if (immediate) {void fetchOnce();}
    start();
    return () => {
      running.current = false;
      clearTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, intervalMs, whenHiddenPause]);

  return { data, error, isLoading, refresh };
}


