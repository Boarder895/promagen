'use client';

import { useEffect, useRef } from 'react';

type Props = {
  /** Message announced to assistive tech. Keep it short and human. */
  message: string;
  /** polite (default) won’t interrupt speech; assertive will. */
  politeness?: 'polite' | 'assertive';
  /** If true, clears the node after announcement to avoid duplicate reads later. */
  clearAfterMs?: number;
};

/**
 * SRLive — Single-purpose aria-live node.
 * Drop it once per page when you need to announce transient UI events.
 */
export default function SRLive({ message, politeness = 'polite', clearAfterMs }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (!message) return;

    // Force a brief clear to retrigger screen readers on identical messages
    const node = ref.current;
    const prev = node.textContent;
    node.textContent = '';
    const t = setTimeout(() => {
      node.textContent = message;
    }, 20);

    let clearTimer: number | undefined;
    if (typeof clearAfterMs === 'number' && clearAfterMs > 0) {
      clearTimer = window.setTimeout(() => {
        if (node) node.textContent = '';
      }, clearAfterMs);
    }

    return () => {
      clearTimeout(t);
      if (clearTimer) clearTimeout(clearTimer);
      if (node) node.textContent = prev ?? '';
    };
  }, [message, clearAfterMs]);

  return (
    <div ref={ref} aria-live={politeness} aria-atomic="true" className="sr-only" />
  );
}
