"use client";

import { useEffect } from "react";
import { useProgress } from "./ProgressProvider";

export default function ProgressToast() {
  const { jobs, clearFinished } = useProgress();

  useEffect(() => {
    const t = setTimeout(clearFinished, 15000);
    return () => clearTimeout(t);
  }, [jobs, clearFinished]);

  if (jobs.length === 0) return null;

  return (
    <aside className="fixed bottom-4 right-4 z-50 w-80 space-y-2">
      {jobs.slice(0, 5).map((j) => (
        <div key={j.id} className="rounded-xl border bg-white shadow p-3">
          <div className="flex items-center justify-between">
            <div className="font-medium">{j.label}</div>
            <Badge state={j.state} />
          </div>
          <div className="mt-1 text-xs opacity-70">
            {j.state === "running" && `Generating… ${Math.round(j.progress ?? 0)}%`}
            {j.state === "queued" && "Queued…"}
            {j.state === "ok" && `Done${j.tookMs ? ` in ${j.tookMs} ms` : ""}`}
            {j.state === "error" && `Failed${j.error ? `: ${j.error}` : ""}`}
          </div>
          {j.state === "running" && (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-gray-200">
              <div
                className="h-full bg-blue-600"
                style={{ width: `${Math.max(0, Math.min(100, Math.round(j.progress ?? 0)))}%` }}
              />
            </div>
          )}
        </div>
      ))}
    </aside>
  );
}

function Badge({ state }: { state: "queued" | "running" | "ok" | "error" }) {
  const map = {
    queued: { text: "Queued", cls: "border-gray-300 bg-gray-50", dot: "#6b7280" },
    running: { text: "Running", cls: "border-blue-300 bg-blue-50", dot: "#2563eb" },
    ok: { text: "Success", cls: "border-green-300 bg-green-50", dot: "#16a34a" },
    error: { text: "Error", cls: "border-red-300 bg-red-50", dot: "#dc2626" },
  }[state];

  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-0.5 text-xs border ${map.cls}`}>
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: map.dot }} />
      {map.text}
    </span>
  );
}


