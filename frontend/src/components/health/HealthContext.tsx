// components/health/HealthContext.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { fetchHealth, type HealthResponse, type HealthStatus } from '@/lib/health';

type HealthState = {
  status: HealthStatus;            // 'ok' | 'degraded' | 'down'
  message?: string;
  apiBase?: string;
};

const Ctx = createContext<HealthState>({ status: 'ok' });

export function HealthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<HealthState>({ status: 'ok' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // fetchHealth(): no args per current lib signature
        const res: HealthResponse = await fetchHealth();
        if (!cancelled) setState(res);
      } catch (e: any) {
        if (!cancelled) setState({ status: 'down', message: String(e?.message || e) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useHealth = () => useContext(Ctx);


