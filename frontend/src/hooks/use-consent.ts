'use client';

import * as React from 'react';

export type ConsentState = {
  isGranted: boolean;
};

const KEY = 'promagen.consent.v1';

export default function useConsent(): ConsentState {
  const [isGranted, setGranted] = React.useState<boolean>(false);

  React.useEffect(() => {
    try {
      const v = typeof window !== 'undefined' ? window.localStorage.getItem(KEY) : null;
      setGranted(v === 'granted');
    } catch {
      setGranted(false);
    }
  }, []);

  return { isGranted };
}
