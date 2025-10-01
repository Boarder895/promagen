"use client";

// FRONTEND â€¢ components/health/HealthBanner.tsx
import React from "react";
import { useHealth } from "@/components/health/HealthContext";
import { AlertTriangle, Activity, RefreshCcw } from "lucide-react";

function tone(status: "ok" | "degraded" | "down") {
  switch (status) {
    case "ok":
      return { bg: "bg-green-50", text: "text-green-800", ring: "ring-green-200" };
    case "degraded":
      return { bg: "bg-amber-50", text: "text-amber-800", ring: "ring-amber-200" };
    case "down":
    default:
      return { bg: "bg-red-50", text: "text-red-800", ring: "ring-red-200" };
  }
}

export default function HealthBanner() {
  const { status, message, lastCheck, checking, refresh } = useHealth();

  if (status === "ok") return null;

  const t = tone(status);
  const label = status === "degraded" ? "Degraded performance" : "Service unavailable";

  return (
    <div className={`w-full sticky top-0 z-50 ${t.bg} ${t.text} ring-1 ${t.ring}`}>
      <div className="mx-auto max-w-7xl px-4 py-2 flex items-center gap-3">
        {status === "degraded" ? <Activity size={18} /> : <AlertTriangle size={18} />}
        <div className="text-sm">
          <strong className="mr-1">{label}.</strong>
          {message ? <span>{message}</span> : null}
          {lastCheck ? <span className="ml-2 opacity-80">Checked: {new Date(lastCheck).toLocaleTimeString()}</span> : null}
        </div>
        <button
          onClick={refresh}
          className="ml-auto inline-flex items-center gap-2 text-xs underline decoration-dotted"
          aria-label="Refresh health status"
        >
          <RefreshCcw size={14} className={checking ? "animate-spin" : ""} />
          {checking ? "Checkingâ€¦" : "Recheck"}
        </button>
      </div>
    </div>
  );
}


