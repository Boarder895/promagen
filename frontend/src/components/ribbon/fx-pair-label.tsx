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
    <span className={className ?? 'inline-flex items-center'} style={{ gap: 'clamp(3px, 0.4vw, 8px)' }}>
      {/* Base currency */}
      <span className="inline-flex items-center" style={{ gap: 'clamp(2px, 0.3vw, 8px)' }}>
        <span>{base.trim().toUpperCase()}</span>
        <span
          className="inline-flex shrink-0 items-center overflow-hidden"
          style={{ width: 'clamp(12px, 1.2vw, 20px)', height: 'clamp(12px, 1.2vw, 20px)' }}
        >
          <Flag countryCode={baseCountryCode} size={20} />
        </span>
      </span>

      {/* Separator */}
      <span aria-hidden="true" className="text-slate-500">
        {separator}
      </span>

      {/* Quote currency */}
      <span className="inline-flex items-center" style={{ gap: 'clamp(2px, 0.3vw, 8px)' }}>
        <span>{quote.trim().toUpperCase()}</span>
        <span
          className="inline-flex shrink-0 items-center overflow-hidden"
          style={{ width: 'clamp(12px, 1.2vw, 20px)', height: 'clamp(12px, 1.2vw, 20px)' }}
        >
          <Flag countryCode={quoteCountryCode} size={20} />
        </span>
      </span>
    </span>
  );
}

export default FxPairLabel;
