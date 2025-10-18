'use client';

import React, { createContext, useContext, useMemo } from 'react';

export type HealthStatus = 'ok' | 'degraded' | 'down';

export type HealthState = {
  ok: boolean;
  status: HealthStatus;
  apiBase?: string;
  message?: string;
};

// Safe default so 404/500 (or any render without provider) won't crash
const defaultHealth: HealthState = {
  ok: true,
  status: 'ok',
  apiBase: undefined,
  message: undefined,
};

const HealthContext = createContext<HealthState>(defaultHealth);

export function useHealth(): HealthState {
  return useContext(HealthContext);
}

export function HealthProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value?: Partial<HealthState>;
}) {
  const merged = useMemo<HealthState>(
    () => ({
      ...defaultHealth,
      ...value,
    }),
    [value],
  );

  return <HealthContext.Provider value={merged}>{children}</HealthContext.Provider>;
}

export default HealthProvider;




