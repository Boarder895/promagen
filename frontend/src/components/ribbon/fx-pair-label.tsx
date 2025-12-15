// frontend/src/components/ribbon/fx-pair-label.tsx
//
// Shared FX pair label renderer:
// - SVG flags first (from /public/flags)
// - Emoji fallback if SVG is missing (rare, but safe)
// - SSOT provides the country codes; this component just renders them.

'use client';

import * as React from 'react';

import Flag from '@/components/ui/flag';

export interface FxPairLabelProps {
  base: string;
  baseCountryCode?: string | null;
  quote: string;
  quoteCountryCode?: string | null;
  separator?: string;
  className?: string;
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
      <Flag countryCode={countryCode} />
    </span>
  );
}

export function FxPairLabel({
  base,
  baseCountryCode,
  quote,
  quoteCountryCode,
  separator = '/',
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
