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

export function FxPairLabel({
  base,
  baseCountryCode,
  quote,
  quoteCountryCode,
  separator = '/',
  className,
}: FxPairLabelProps) {
  return (
    <span className={className ?? 'inline-flex items-center gap-2'}>
      {/* Base currency */}
      <span className="inline-flex items-center gap-2">
        <span>{base.trim().toUpperCase()}</span>
        <Flag countryCode={baseCountryCode} size={20} />
      </span>

      {/* Separator */}
      <span aria-hidden="true" className="text-slate-500">
        {separator}
      </span>

      {/* Quote currency */}
      <span className="inline-flex items-center gap-2">
        <span>{quote.trim().toUpperCase()}</span>
        <Flag countryCode={quoteCountryCode} size={20} />
      </span>
    </span>
  );
}

export default FxPairLabel;
