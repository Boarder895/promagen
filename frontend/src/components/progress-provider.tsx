// src/components/ProgressProvider.tsx
"use client";

import React from "react";

export const ProgressContext = React.createContext<{ value: number }>({ value: 0 });

export default function ProgressProvider({ children }: { children: React.ReactNode }) {
  return <ProgressContext.Provider value={{ value: 0 }}>{children}</ProgressContext.Provider>;
}








