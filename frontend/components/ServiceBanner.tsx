"use client";

import { useEffect, useState } from "react";
import { pingHealth } from "@/lib/ping";

type View = { status: "ok" | "degraded" | "down" | "unset"; latency?: number; detail?: string };

export default function ServiceBanner() {
  const [view, setView] = useState<View>({ status: "unset" });
  const [dismissed, setDismissed] = useState(false);
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  useEffect(() => {
    let on = true;
    async function check() {
      if (!apiBase) { setView({ status: "unset" }); return; }
      const h = await pingHealth(3500);
      if (!on) return;
      if (!h.ok) setView({ status: "down", latency: h.latencyMs, detail: h.error });
      else if (h.status === "degraded") setView({ status: "degraded", latency: h.latencyMs });
      else setView({ status: "ok", latency: h.latencyMs });
    }
    check();
    const id = setInterval(check, 30000);
    return () => { on = false; clearInterval(id); };
  }, [apiBase]);

  if (dismissed) return null;
  if (view.status === "ok" || view.status === "unset") return null;

  const isDown = view.status === "down";
  const bg = isDown ? "#dc2626" : "#d97706";    // red / amber
  const label = isDown ? "Service unavailable" : "Service degraded";

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        backgroundColor: bg,
        color: "white",
        padding: "8px 12px",
        textAlign: "center",
        fontSize: 13,
      }}
    >
      <strong>{label}</strong>
      {typeof view.latency === "number" ? ` • ${view.latency}ms` : ""}
      {view.detail ? ` — ${view.detail}` : ""}
      <button
        onClick={() => setDismissed(true)}
        style={{
          marginLeft: 12,
          background: "transparent",
          border: "1px solid rgba(255,255,255,.7)",
          color: "white",
          borderRadius: 6,
          padding: "2px 8px",
          cursor: "pointer",
        }}
        aria-label="Dismiss service status message"
      >
        dismiss
      </button>
    </div>
  );
}
