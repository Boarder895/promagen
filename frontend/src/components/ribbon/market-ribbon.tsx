"use client";
import * as React from "react";

type Item = { id: string; city: string; status: "OPEN" | "CLOSED" | "PRE" | "POST" };

export default function MarketRibbon() {
  const [items, setItems] = React.useState<Item[]>([]);

  React.useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch("/api/snapshot/markets", { cache: "no-store" });
        const json = (await res.json()) as { ok: boolean; data?: Item[] };
        if (alive && json.ok && json.data) {setItems(json.data);}
      } catch { /* noop */ }
    }
    load();
    const id = setInterval(load, 15 * 60 * 1000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  if (!items.length) {return null;}

  return (
    <div className="w-full border-y border-slate-200 bg-white/70 backdrop-blur">
      <div className="mx-auto max-w-[1400px] px-4 py-2 flex gap-3 overflow-x-auto">
        {items.map((m) => (
          <div key={m.id} className="px-2 py-1 rounded-md bg-white/80 border border-slate-200 text-sm">
            <span className="font-medium">{m.city}</span>
            <span className={`ml-2 text-xs ${m.status === "OPEN" ? "text-green-600" : "text-slate-500"}`}>{m.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}




