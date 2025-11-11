'use client';

import * as React from 'react';

export default function usePrefersReducedMotion(): boolean {
  const [prefers, setPrefers] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setPrefers(Boolean(mq.matches));
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);

  return prefers;
}
