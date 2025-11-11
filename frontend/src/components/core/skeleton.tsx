'use client';

import React from 'react';

type LineProps = {
  width?: string; // e.g. 'w-24'
  className?: string;
  'aria-label'?: string;
};

export function SkeletonLine({ width = 'w-full', className = '', ...rest }: LineProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      className={`h-3 ${width} animate-pulse rounded bg-white/10 ${className}`}
      {...rest}
    />
  );
}

type BlockProps = {
  lines?: number;
  className?: string;
  'aria-label'?: string;
};

export function SkeletonBlock({ lines = 3, className = '', ...rest }: BlockProps) {
  return (
    <div className={`space-y-2 ${className}`} {...rest}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} width={i === 0 ? 'w-2/3' : i === lines - 1 ? 'w-4/5' : 'w-full'} />
      ))}
    </div>
  );
}
