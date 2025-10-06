"use client";

import { createContext, useContext, useMemo, useState } from "react";

type NowCursorCtx = {
  x: number | null;                 // shared x position/index (null -> use "now")
  setX: (x: number | null) => void; // update from any chart
};

const Ctx = createContext<NowCursorCtx | null>(null);

export function NowCursorProvider({ children }: { children: React.ReactNode }) {
  const [x, setX] = useState<number | null>(null);
  const value = useMemo(() => ({ x, setX }), [x]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNowCursor() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useNowCursor must be used within NowCursorProvider");
  return ctx;
}

