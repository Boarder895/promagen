'use client';

import { useEffect, useRef } from 'react';

/**
 * useAutoRefresh
 * Runs `fn` on an interval. Pauses when the tab is hidden and resumes on focus/visibility.
 * Named exports only.
 */
export function useAutoRefresh(fn: () => void, ms: number) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let id: number | undefined;

    const tick = () => fnRef.current();

    const start = () => {
      if (!id) id = window.setInterval(tick, ms);
    };

    const stop = () => {
      if (id) {
        window.clearInterval(id);
        id = undefined;
      }
    };

    // run once immediately, then start interval while visible
    tick();
    if (!document.hidden) start();

    const onVis = () => (document.hidden ? stop() : (tick(), start()));
    const onFocus = () => (tick(), start());
    const onBlur = () => stop();

    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, [ms]);
}

