'use client';

import { useEffect, useRef } from 'react';

// super light chime Ã¢â‚¬â€ replace with your own asset later if desired
const BELL =
  'data:audio/mp3;base64,//uQZAAAAAAAAAAAAAAAAAAAA...'; // tiny inline placeholder tone

const audio = () => {
  const a = new Audio(BELL);
  a.volume = 0.35;
  return a;
};

export const useMarketTimes = () => {
  const openedRef = useRef<Record<string, boolean>>({});
  const lastPlay = useRef<number>(0);

  const onOpenChime = (id: string, isOpen: boolean) => {
    const wasOpen = openedRef.current[id];
    openedRef.current[id] = isOpen;
    const now = Date.now();
    const debounced = now - lastPlay.current > 5000;
    if (isOpen && !wasOpen && debounced) {
      lastPlay.current = now;
      audio().play().catch(() => {});
    }
  };

  useEffect(() => {
    // reset on mount (avoids stale cross-page state)
    openedRef.current = {};
    lastPlay.current = 0;
  }, []);

  return { onOpenChime };
};

