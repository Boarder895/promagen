"use client";
import * as React from "react";

export type TabsContextValue = {
  // keep this loose so consumers donâ€™t cycle on types
  items: Array<{ id: string; panelId?: string; label?: string; disabled?: boolean }>;
  selectedId: string;
  setSelectedId: (id: string) => void;
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

export function useTabs(): TabsContextValue {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("useTabs must be used within <TabsProvider>");
  return ctx;
}

export function TabsProvider({
  value,
  children,
}: {
  value: TabsContextValue;
  children: React.ReactNode;
}) {
  return <TabsContext.Provider value={value}>{children}</TabsContext.Provider>;
}

