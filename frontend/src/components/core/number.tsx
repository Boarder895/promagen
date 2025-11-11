import * as React from 'react';

export function Num({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span className="font-mono tabular-nums" title={title}>
      {children}
    </span>
  );
}
