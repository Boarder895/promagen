'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * useClockDrift
 * Very light Ã¢â‚¬Å“is the UI aliveÃ¢â‚¬Â detector.
 * - Ticks every 1s.
 * - If the gap between ticks ever exceeds THRESHOLD_MS, we assume the tab was frozen/heavily throttled.
 * - Returns { liveOk } where liveOk=true means timing looks healthy.
 *
 * Named export only (project rule).
 */
const TICK_MS = 1000;
const THRESHOLD_MS = 4000;

export function useClockDrift() {
  const [liveOk, setLiveOk] = useState(true);
  const last = useRef<number | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    function tick() {
      const now = Date.now();
      if (last.current !== null) {
        const delta = now - last.current;
        // If we missed several ticks (tab suspended / heavy lag), flag as not live.
        setLiveOk(delta < THRESHOLD_MS);
      }
      last.current = now;
    }

    // Prime once so last.current is set immediately:
    tick();
    timer.current = window.setInterval(tick, TICK_MS);

    return () => {
      if (timer.current !== null) window.clearInterval(timer.current);
    };
  }, []);

  return { liveOk };
}

