"use client";

import { useEffect, useState } from "react";
import { getRecentJobs, type AdminJob } from "@/lib/jobs_admin";

function fmt(ts?: number) {
  if (!ts) return "—";
  const d = new Date(ts);
  return `${d.toLocaleTimeString()} (${d.toLocaleDateString()})`;
}

export default function AdminJobsPage() {
  const [rows, setRows] = useState<AdminJob[]>([]);
  const [limit, setLimit] = useState(50);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    getRecentJobs(limit).then((j) => alive && setRows(j)).catch(() => alive && setRows([]));
    return () => { alive = false; };
  }, [limit, tick]);

  return (
    <main className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin · Jobs (recent)</h1>
        <div className="flex items-center gap-3">
          <select
            className="rounded-xl border px-2 py-1 text-sm"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            {[25, 50, 100, 150, 200].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <button onClick={() => setTick((t) => t + 1)} className="rounded-xl border px-3 py-1 text-sm hover:bg-gray-50">
            Refresh
          </button>
        </div>
      </header>

      <div className="overflow-auto rounded-2xl border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="p-3">Time</th>
              <th className="p-3">Provider</th>
              <th className="p-3">State</th>
              <th className="p-3">Progress</th>
              <th className="p-3">Took</th>
              <th className="p-3">Result</th>
              <th className="p-3">Error</th>
              <th className="p-3">ID</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((j) => (
              <tr key={j.id} className="border-t">
                <td className="p-3">{fmt(j.startedAt)}</td>
                <td className="p-3 font-mono">{j.provider}</td>
                <td className="p-3">{j.state}</td>
                <td className="p-3">{j.progress !== undefined ? `${Math.round(j.progress)}%` : "—"}</td>
                <td className="p-3">{j.tookMs !== undefined ? `${j.tookMs} ms` : "—"}</td>
                <td className="p-3">
                  {j.result?.imageUrl ? (
                    <a className="underline break-all" href={j.result.imageUrl} target="_blank" rel="noreferrer">image</a>
                  ) : "—"}
                </td>
                <td className="p-3 text-red-600">{j.error ?? "—"}</td>
                <td className="p-3 font-mono break-all">{j.id}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td className="p-6 text-center opacity-70" colSpan={8}>No jobs yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
