'use client';

import * as React from 'react';

type Ctx = { value: number; setValue: (n: number) => void };
const ProgressCtx = React.createContext<Ctx | null>(null);

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = React.useState(0);
  return <ProgressCtx.Provider value={{ value, setValue }}>{children}</ProgressCtx.Provider>;
}

export function useProgress() {
  const ctx = React.useContext(ProgressCtx);
  if (!ctx) return { value: 0, setValue: (_: number) => {} };
  return ctx;
}
