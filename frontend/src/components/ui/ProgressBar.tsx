'use client';

import * as React from 'react';

type Props = {
  value?: number; // 0–100 by default
  max?: number;   // base for value; default 100
} & React.HTMLAttributes<HTMLDivElement>;

export function ProgressBar({ value = 0, max = 100, className = '', ...rest }: Props) {
  const pct = Math.min(100, Math.max(0, max ? (value / max) * 100 : value));
  return (
    <div className={`w-full h-2 rounded bg-gray-200 overflow-hidden ${className}`} {...rest}>
      <div className="h-full bg-gray-900" style={{ width: `${pct}%` }} />
    </div>
  );
}

// provide both named and default so imports work either way
export default ProgressBar;

