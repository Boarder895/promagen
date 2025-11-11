"use client";
import * as React from "react";
import type { ExceptionRec } from "./exchanges/page";

type Rec = {
  id: string;
  city?: string;
  tz?: string;
  latitude?: number;
  longitude?: number;
  hoursTemplate?: string | null;
  workdays?: string | null;
  holidaysRef?: string | null;
  exceptions?: ExceptionRec[];
};

export default function AdminIndex() {
  const [rows, setRows] = React.useState<Rec[]>([]);

  function upsert(idx: number, r: Partial<Rec>) {
    setRows((cur) => {
      const next = [...cur];
      const base = next[idx] ?? ({ id: crypto.randomUUID() } as Rec);
      next[idx] = { ...base, ...r, id: base.id || crypto.randomUUID() };
      return next;
    });
  }

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-semibold">Admin</h1>
      <pre className="rounded-xl bg-black/40 p-4 text-xs">{JSON.stringify(rows, null, 2)}</pre>
      <button
        type="button"
        className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-sm ring-1 ring-white/20 hover:bg-white/15"
        onClick={() => upsert(0, { city: "City", tz: "UTC" })}
      >
        Add / Update first row
      </button>
    </div>
  );
}
