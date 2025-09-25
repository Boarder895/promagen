"use client";

// frontend/components/StatusChip.tsx — COMPLETE
import { useEffect, useMemo, useState } from "react";
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

  async function refresh() {
    if (!apiBase) {
      setState({ status: "unset", detail: "API base — not set" });
      return;
    }
    const [health, vers] = await Promise.all([pingHealth(3500), fetchVersion()]);
    if (health.ok) {
      const mapped =
        health.status === "degraded"
          ? "degraded"
          : "live"; // ok -> live unless server said degraded
      setState({
        status: mapped,
        latency: health.latencyMs,
        version: vers?.version,
        commit: vers?.commit,
        buildTime: vers?.buildTime,
      });
    } else {
      setState({ status: "down", detail: health.error });
    }
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, []);

  const color = useMemo(() => {
    switch (state.status) {
      case "live":
        return "bg-green-600";
      case "degraded":
        return "bg-amber-500";
      case "down":
        return "bg-red-600";
      default:
        return "bg-gray-500";
    }
  }, [state.status]);

  const label = useMemo(() => {
    switch (state.status) {
      case "live":
        return `Live${state.latency ? ` • ${state.latency}ms` : ""}`;
      case "degraded":
        return `Degraded${state.latency ? ` • ${state.latency}ms` : ""}`;
      case "down":
        return "Down";
      default:
        return "API base — not set";
    }
  }, [state.status, state.latency]);

  const tooltip = useMemo(() => {
    if (state.status === "unset") return "Set NEXT_PUBLIC_API_BASE_URL.";
    const parts = [
      state.version ? `v${state.version}` : null,
      state.commit ? `commit ${state.commit}` : null,
      state.buildTime ? state.buildTime : null,
      state.detail ? `(${state.detail})` : null,
    ].filter(Boolean);
    return parts.join(" • ") || "No build metadata";
  }, [state]);

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
