// C:\Users\Proma\Projects\promagen\frontend\src\components\providers\promagen-users-cell.tsx

'use client';

import * as React from 'react';
import { flag, type CountryCode } from '@/data/flags/flags';

export type PromagenUsersEntry = Readonly<{
  countryCode: CountryCode;
  count: number;
}>;

type Props = Readonly<{
  entries?: readonly PromagenUsersEntry[] | null;
  maxEntries?: number;
  className?: string;
}>;

/**
 * Renders "Promagen Users" as a single-line string of emoji flags + counts.
 *
 * Display contract:
 * - Top 5 countries by usage.
 * - One line max.
 * - If it would wrap, show "… +n" at the end (n = hidden items).
 */
export default function PromagenUsersCell({
  entries,
  maxEntries = 5,
  className,
}: Props): JSX.Element | null {
  const top = React.useMemo(() => {
    const list = (entries ?? []).filter((e) => e && typeof e.count === 'number');
    return list.slice(0, Math.max(0, maxEntries));
  }, [entries, maxEntries]);

  const tokens = React.useMemo(() => {
    return top.map((e) => ({
      key: `${String(e.countryCode)}:${String(e.count)}`,
      text: `${flag(e.countryCode)} ${Math.trunc(e.count)}`,
    }));
  }, [top]);

  const [visibleCount, setVisibleCount] = React.useState(tokens.length);

  const containerRef = React.useRef<HTMLSpanElement | null>(null);
  const measureRef = React.useRef<HTMLDivElement | null>(null);

  const recompute = React.useCallback(() => {
    const container = containerRef.current;
    const measure = measureRef.current;

    if (!container || !measure) return;

    const available = container.clientWidth;
    if (!Number.isFinite(available) || available <= 0) return;

    const tokenEls = Array.from(measure.querySelectorAll<HTMLElement>('[data-token]'));
    const ellipsisEl = measure.querySelector<HTMLElement>('[data-ellipsis]');

    if (tokenEls.length === 0) {
      setVisibleCount(0);
      return;
    }

    const tokenWidths = tokenEls.map((el) => el.getBoundingClientRect().width);
    const ellipsisWidth = ellipsisEl ? ellipsisEl.getBoundingClientRect().width : 0;

    // Find the largest k tokens that fits (k can be 0).
    for (let k = tokenWidths.length; k >= 0; k -= 1) {
      const tokensWidth = tokenWidths.slice(0, k).reduce((sum, w) => sum + w, 0);
      const needsEllipsis = k < tokenWidths.length;
      const total = tokensWidth + (needsEllipsis ? ellipsisWidth : 0);

      if (total <= available) {
        setVisibleCount(k);
        return;
      }
    }

    setVisibleCount(0);
  }, []);

  React.useLayoutEffect(() => {
    setVisibleCount(tokens.length);
  }, [tokens.length]);

  React.useLayoutEffect(() => {
    recompute();
  }, [recompute, tokens.length]);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      // Use rAF to avoid "ResizeObserver loop limit exceeded" in some browsers.
      requestAnimationFrame(() => recompute());
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, [recompute]);

  if (tokens.length === 0) return null;

  const clamped = Math.max(0, Math.min(visibleCount, tokens.length));
  const hidden = tokens.length - clamped;

  const wrapperClassName = ['relative inline-block w-full', className].filter(Boolean).join(' ');
  const fullText = tokens
    .map((t) => t.text)
    .join(' ')
    .trim();

  return (
    <span className={wrapperClassName}>
      <span
        ref={containerRef}
        className="block max-w-full whitespace-nowrap overflow-hidden align-middle tabular-nums"
        aria-label={fullText}
        title={fullText}
      >
        {tokens.slice(0, clamped).map((t) => (
          <span key={t.key} className="inline" data-visible-token>
            {t.text}{' '}
          </span>
        ))}
        {hidden > 0 ? (
          <span className="inline text-muted-foreground" aria-hidden="true">
            … +{hidden}
          </span>
        ) : null}
      </span>

      {/* Hidden measurement row (same typography, no wrapping) */}
      <div
        ref={measureRef}
        className="pointer-events-none absolute left-0 top-0 -z-10 opacity-0 whitespace-nowrap tabular-nums"
        aria-hidden="true"
      >
        {tokens.map((t) => (
          <span key={`m:${t.key}`} data-token>
            {t.text}{' '}
          </span>
        ))}
        <span data-ellipsis>… +{tokens.length}</span>
      </div>
    </span>
  );
}
