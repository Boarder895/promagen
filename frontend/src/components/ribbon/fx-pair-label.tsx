// frontend/src/components/ribbon/fx-pair-label.tsx
//
// Shared FX pair label renderer:
// - SVG flags first (from /public/flags)
// - Emoji fallback if SVG is missing (rare, but safe)
// - SSOT provides the country codes; this component just renders them.

'use client';

import * as React from 'react';

import { countryCodeToFlagEmoji, flagAriaLabel, flagSrc } from '@/lib/flags';

export interface FxPairLabelProps {
  base: string;
  baseCountryCode?: string | null;
  quote: string;
  quoteCountryCode?: string | null;
  separator?: string;
  className?: string;
}

function FlagGlyph({ countryCode }: { countryCode?: string | null }) {
  const src = flagSrc(countryCode);
  const emoji = countryCodeToFlagEmoji(countryCode);
  const title = countryCode ? flagAriaLabel(countryCode) : undefined;

  const [svgFailed, setSvgFailed] = React.useState(false);

  if (src && !svgFailed) {
    return (
      // Using <img> intentionally for tiny local SVGs in /public (simple + fast).
      // If you later want next/image, we can switch — but SVG handling varies by config.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        width={12}
        height={12}
        alt=""
        aria-hidden="true"
        title={title}
        loading="lazy"
        decoding="async"
        onError={() => setSvgFailed(true)}
        className="h-3 w-3 rounded-[2px] ring-1 ring-slate-800"
      />
    );
  }

  if (emoji) {
    return (
      <span aria-hidden="true" title={title}>
        {emoji}
      </span>
    );
  }

  return null;
}

function CurrencyWithFlag({
  currencyCode,
  countryCode,
}: {
  currencyCode: string;
  countryCode?: string | null;
}) {
  const code = (currencyCode ?? '').trim().toUpperCase();

  return (
    <span className="inline-flex items-center gap-1">
      <span>{code}</span>
      <FlagGlyph countryCode={countryCode} />
    </span>
  );
}

export function FxPairLabel({
  base,
  baseCountryCode,
  quote,
  quoteCountryCode,
  separator = ' / ',
  className,
}: FxPairLabelProps) {
  return (
    <span className={className ?? 'inline-flex items-center gap-1'}>
      <CurrencyWithFlag currencyCode={base} countryCode={baseCountryCode} />
      <span aria-hidden="true" className="text-slate-500">
        {separator}
      </span>
      <CurrencyWithFlag currencyCode={quote} countryCode={quoteCountryCode} />
    </span>
  );
}

export default FxPairLabel;
