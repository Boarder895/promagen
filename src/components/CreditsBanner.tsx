import React, { useEffect, useState } from "react";

type Health = { ok: boolean; credits_feature?: "on" | "off" };

export default function CreditsBanner() {
  const [state, setState] = useState<"on" | "off" | "unknown">("unknown");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/health");
        const j: Health = await r.json();
        if (!alive) return;
        const cf = (j.credits_feature ?? "off") as "on" | "off";
        setState(cf);
      } catch {
        if (alive) setState("unknown");
      }
    })();
    return () => { alive = false; };
  }, []);

  const text =
    state === "on"
      ? "Credits: ON — usage is metered (optional feature enabled)"
      : state === "off"
      ? "Credits: OFF — optional feature parked (not engaged)"
      : "Credits: unknown — health check failed";

  const bg =
    state === "on" ? "#0b5" :
    state === "off" ? "#444" : "#b50";

  return (
    <div style={{
      position: "sticky",
      top: 0,
      zIndex: 1000,
      background: bg,
      color: "white",
      padding: "8px 12px",
      fontFamily: "system-ui, sans-serif",
      fontSize: 14
    }}>
      {text}
    </div>
  );
}


