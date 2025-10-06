"use client";

// FRONTEND ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ components/health/HealthContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { fetchHealth, type HealthResponse, type HealthStatus } from "@/lib/health";

type HealthCtx = {
  status: HealthStatus;
  lastCheck?: string;
  message?: string;
  checking: boolean;
  refresh: () => void;
};

const Ctx = createContext<HealthCtx | null>(null);

export function useHealth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useHealth must be used within <HealthProvider>");
  return ctx;
}

const POLL_MS = 30_000;

export function HealthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<HealthStatus>("ok");
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [lastCheck, setLastCheck] = useState<string | undefined>(undefined);
  const [checking, setChecking] = useState(false);
  const timerRef = useRef<number | null>(null);

  const runCheck = async () => {
    setChecking(true);
    const ctrl = new AbortController();
    const res: HealthResponse = await fetchHealth(ctrl.signal);
    setStatus(res.status);
    setMessage(res.message);
    setLastCheck(new Date().toISOString());
    setChecking(false);
  };

  useEffect(() => {
    runCheck();
    timerRef.current = window.setInterval(runCheck, POLL_MS);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  const value = useMemo(
    () => ({ status, message, lastCheck, checking, refresh: runCheck }),
    [status, message, lastCheck, checking]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}




