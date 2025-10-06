// src/hooks/useClockDrift.ts
import { useEffect, useState } from "react";

export function useClockDrift() {
  const [driftMs, setDriftMs] = useState(0);
  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const res = await fetch("/", { method: "HEAD", cache: "no-store" });
        const dateHeader = res.headers.get("date");
        if (!dateHeader) return;
        const serverNow = new Date(dateHeader).getTime();
        const localNow = Date.now();
        if (mounted) setDriftMs(localNow - serverNow);
      } catch { /* ignore */ }
    };
    check();
    const id = window.setInterval(check, 60_000);
    return () => { mounted = false; window.clearInterval(id); };
  }, []);
  return { driftMs, liveOk: Math.abs(driftMs) < 2000 };
}

