// src/hooks/useAutoRefresh.ts
import { useEffect, useRef } from "react";

function jitter(baseMs: number, pct: number) {
  const delta = baseMs * pct;
  return baseMs + (Math.random() * 2 - 1) * delta;
}

export function useAutoRefresh(
  getBaseMs: () => { ms: number; jitterPct: number },
  tick: () => void
) {
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loop = () => {
      const { ms, jitterPct } = getBaseMs();
      const delay = Math.max(250, jitter(ms, jitterPct));
      timer.current = window.setTimeout(() => {
        if (!cancelled) {
          tick();
          loop();
        }
      }, delay) as unknown as number;
    };
    loop();

    const onFocus = () => tick();
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      if (timer.current) window.clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [getBaseMs, tick]);
}

