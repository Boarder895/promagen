"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE } from "@/lib/api";

type State =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "up"; ms: number; when: string }
  | { kind: "down"; error: string; when: string };

export default function ApiStatusBadge({
  intervalMs = 15000,
  timeoutMs = 5000,
  compact = false,
}: {
  intervalMs?: number;
  timeoutMs?: number;
  compact?: boolean;
}) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const timer = useRef<number | null>(null);

  const check = async () => {
    setState({ kind: "checking" });
    const start = performance.now();
    const ctrl = new AbortController();
    const t = window.setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(`${API_BASE}/health`, {
        cache: "no-store",
        signal: ctrl.signal,
      });
      const ok = res.ok;
      const ms = Math.round(performance.now() - start);
      const when = new Date().toLocaleTimeString();
      if (!ok) {
        setState({ kind: "down", error: `HTTP ${res.status}`, when });
      } else {
        setState({ kind: "up", ms, when });
      }
    } catch (e: any) {
      const when = new Date().toLocaleTimeString();
      setState({
        kind: "down",
        error: e?.name === "AbortError" ? `timeout ${timeoutMs}ms` : String(e?.message || e),
        when,
      });
    } finally {
      window.clearTimeout(t);
    }
  };

  useEffect(() => {
    // kick once
    check();
    // interval
    timer.current = window.setInterval(check, intervalMs) as unknown as number;
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API_BASE, intervalMs, timeoutMs]);

  const chip = useMemo(() => {
    if (state.kind === "up") {
      return (
        <span className="inline-flex items-center gap-2 rounded-full border border-green-300 bg-green-50 px-3 py-1 text-sm">
          <Dot color="#16a34a" />
          API up <span className="opacity-70">· {state.ms} ms</span>
        </span>
      );
    }
    if (state.kind === "down") {
      return (
        <span className="inline-flex items-center gap-2 rounded-full border border-red-300 bg-red-50 px-3 py-1 text-sm">
          <Dot color="#dc2626" />
          API down <span className="opacity-70">· {state.error}</span>
        </span>
      );
    }
    if (state.kind === "checking") {
      return (
        <span className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-gray-50 px-3 py-1 text-sm">
          <Spinner />
          Checking…
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-gray-50 px-3 py-1 text-sm">
        <Dot color="#6b7280" />
        Idle
      </span>
    );
  }, [state]);

  if (compact) {
    // small single-dot version
    return (
      <button
        onClick={check}
        title={`API: ${state.kind}${"when" in state ? ` · ${state.when}` : ""}`}
        className="inline-flex items-center gap-2"
      >
        {state.kind === "up" ? <Dot color="#16a34a" /> : state.kind === "down" ? <Dot color="#dc2626" /> : <Dot color="#6b7280" />}
        <span className="text-sm font-mono">{state.kind === "up" ? `${(state as any).ms}ms` : state.kind}</span>
      </button>
    );
  }

  return (
    <div className="inline-flex items-center gap-3">
      {chip}
      {"when" in state && (
        <span className="text-xs opacity-70">checked {state.when}</span>
      )}
      <button
        onClick={check}
        className="rounded-xl border px-2 py-1 text-xs hover:bg-gray-50"
        title="Re-check now"
      >
        Re-check
      </button>
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <span
      className="h-2.5 w-2.5 rounded-full"
      style={{ backgroundColor: color }}
      aria-hidden
    />
  );
}

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" className="animate-spin">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.25" />
      <path d="M22 12a10 10 0 0 1-10 10" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}


