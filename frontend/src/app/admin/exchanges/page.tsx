"use client";
import * as React from "react";

export type ExceptionRec = { date: string; note?: string };
export type AdminExchange = {
  id: string;
  exchange?: string;
  city?: string;
  tz?: string;
  latitude?: number;
  longitude?: number;
  hoursTemplate?: string | null;
  workdays?: string | null;
  holidaysRef?: string | null;
  exceptions?: ExceptionRec[];
};

export default function AdminExchanges() {
  const [rows, setRows] = React.useState<AdminExchange[]>([]);

  function upsert(idx: number, r: Partial<AdminExchange>) {
    setRows((cur) => {
      const next = [...cur];
      const base = next[idx] ?? { id: crypto.randomUUID() } as AdminExchange;
      next[idx] = { ...base, ...r, id: base.id || crypto.randomUUID() };
      return next;
    });
  }

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-semibold">Exchanges</h1>
      <pre className="rounded-xl bg-black/40 p-4 text-xs">{JSON.stringify(rows, null, 2)}</pre>
      <button
        type="button"
        className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-sm ring-1 ring-white/20 hover:bg-white/15"
        onClick={() => upsert(0, { exchange: "Demo", city: "City", tz: "UTC" })}
      >
        Add / Update first row
      </button>
    </div>
  );
}
