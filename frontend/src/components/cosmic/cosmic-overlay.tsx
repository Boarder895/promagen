import * as React from 'react';

type Item = { e: React.ReactNode; at: number };
export default function CosmicOverlay({ upcoming = [] as Item[] }) {
  const next = upcoming.length ? upcoming[0] : undefined;
  return next ? <div aria-live="polite">{next.e}</div> : null;
}
