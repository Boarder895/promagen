'use client';

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

type Health = { ok: boolean; service: string; time: string };
type HealthState = {
  status: 'up' | 'down' | 'idle';
  last?: Health;
  error?: string;
  apiBase?: string;
};

const HealthCtx = createContext<HealthState>({ status: 'idle' });

export function HealthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<HealthState>({
    status: 'idle',
    apiBase: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
  });
  const timer = useRef<NodeJS.Timeout | null>(null);

  async function ping() {
    try {
      // call our own Next API to avoid CORS and browser/env differences
      const res = await fetch('/api/health', { cache: 'no-store' });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const json: Health = await res.json();
      setState((s) => ({ ...s, status: 'up', last: json, error: undefined }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setState((s) => ({ ...s, status: 'down', error: msg }));
    }
  }

  useEffect(() => {
    ping();
    timer.current = setInterval(ping, 60_000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const value = useMemo(() => state, [state]);
  return <HealthCtx.Provider value={value}>{children}</HealthCtx.Provider>;
}

export function useHealth() {
  return useContext(HealthCtx);
}
