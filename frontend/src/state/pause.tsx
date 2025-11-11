'use client';

import * as React from 'react';

type PauseCtx = { paused: boolean; setPaused: (v: boolean) => void; toggle: () => void };
const Ctx = React.createContext<PauseCtx | null>(null);

export function PauseProvider({ children }: { children: React.ReactNode }) {
  const [paused, setPaused] = React.useState(false);
  const value = React.useMemo(() => ({ paused, setPaused, toggle: () => setPaused(p => !p) }), [paused]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePause(): PauseCtx {
  return React.useContext(Ctx) ?? { paused: false, setPaused: () => void 0, toggle: () => void 0 };
}
