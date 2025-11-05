"use client";
import * as React from "react";

type Row = { providerId: string; name: string; uses: number };

export default function TrendingTable() {
  const [rows, setRows] = React.useState<Row[]>([]);

  // tick is internal to the effect; don't include in deps to avoid react-hooks warning
  React.useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const res = await fetch("/api/analytics/top3", { cache: "no-store" });
        const json = (await res.json()) as { ok: boolean; data?: Row[] };
        if (alive && json.ok && json.data) setRows(json.data.slice(0, 3));
      } catch {
        /* allowed: silent */
      }
    }

    load();
    const id = setInterval(load, 2 * 60 * 1000); // 2 minutes
    return () => { alive = false; clearInterval(id); };
  }, []);

  if (!rows.length) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white/80">
      <div className="px-3 py-2 text-sm font-semibold">Top 3 Platforms (last 2h)</div>
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2 text-left">Platform</th>
            <th className="px-3 py-2 text-right">Uses</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.providerId} className="odd:bg-white even:bg-slate-50/60">
              <td className="px-3 py-2">{r.name}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.uses}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}




