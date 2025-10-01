"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { pingHealth, fetchVersion } from "@/lib/ping";

type State = {
  status: "live" | "degraded" | "down" | "unset";
  latency?: number;
  version?: string;
  commit?: string;
  buildTime?: string;
  detail?: string;
};

export default function StatusChip() {
  const [state, setState] = useState<State>({ status: "unset" });
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  // stable callback so useEffect can depend on it
  const refresh = useCallback(async () => {
    if (!apiBase) {
      setState({ status: "unset", detail: "API base � not set" });
      return;
    }
    const [health, vers] = await Promise.all([pingHealth(3500), fetchVersion()]);
    if (health.ok) {
      setState({
        status: health.status === "degraded" ? "degraded" : "live",
        latency: health.latencyMs,
        version: vers?.version,
        commit: vers?.commit,
        buildTime: vers?.buildTime
      });
    } else {
      setState({ status: "down", detail: health.error });
    }
  }, [apiBase]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]); // <-- include refresh (fixes exhaustive-deps)

  const color = useMemo(() => {
    switch (state.status) {
      case "live": return "bg-green-600";
      case "degraded": return "bg-amber-500";
      case "down": return "bg-red-600";
      default: return "bg-gray-500";
    }
  }, [state.status]);

  const label = useMemo(() => {
    const latency = state.latency ? ` � ${state.latency}ms` : "";
    switch (state.status) {
      case "live": return `Live${latency}`;
      case "degraded": return `Degraded${latency}`;
      case "down": return "Down";
      default: return "API base � not set";
    }
  }, [state.status, state.latency]);

  const tooltip = useMemo(() => {
    const parts = [
      state.version ? `v${state.version}` : null,
      state.commit ? `commit ${state.commit}` : null,
      state.buildTime || null,
      state.detail ? `(${state.detail})` : null
    ].filter(Boolean);
    return parts.join(" � ") || "No build metadata";
  }, [state.version, state.commit, state.buildTime, state.detail]);

  return (
    <div className="inline-flex items-center gap-2">
      <span
        title={tooltip}
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-white ${color} shadow`}
      >
        <span className="h-2 w-2 rounded-full bg-white/90" />
        <span>{label}</span>
      </span>
      <button
        onClick={refresh}
        className="text-xs underline text-gray-500 hover:text-gray-800"
        aria-label="Refresh status"
        title="Refresh status"
      >
        refresh
      </button>
    </div>
  );
}


