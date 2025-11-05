// frontend/src/app/admin/exchanges/page.tsx
"use client";

import * as React from "react";

type ExceptionRec = { date: string; closed?: boolean; open?: string; close?: string; note?: string };
type Rec = {
  id: string;
  city: string;
  tz: string;
  latitude: number;
  longitude: number;
  hoursTemplate?: string | null;
  workdays?: string | null;
  holidaysRef?: string | null;
  exceptions?: ExceptionRec[];
};

type ApiResp =
  | { ok: true; data: Rec[]; path: string; saved?: boolean; backups?: string[] }
  | { ok: false; error: string; errors?: string[] };

const COLS = [
  { key: "id", label: "ID", width: "w-56" },
  { key: "city", label: "City", width: "w-40" },
  { key: "tz", label: "TZ", width: "w-48" },
  { key: "latitude", label: "Lat", width: "w-28" },
  { key: "longitude", label: "Lon", width: "w-28" },
  { key: "hoursTemplate", label: "Hours", width: "w-64" },
  { key: "workdays", label: "Workdays", width: "w-36" },
  { key: "holidaysRef", label: "Holidays", width: "w-24" },
  { key: "exceptions", label: "Exceptions", width: "w-40" },
] as const;

type ColKey = (typeof COLS)[number]["key"];

function usePersisted<T>(key: string, def: T) {
  const [v, setV] = React.useState<T>(() => {
    try {
      const s = localStorage.getItem(key);
      return s ? (JSON.parse(s) as T) : def;
    } catch {
      return def;
    }
  });
  React.useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {}
  }, [key, v]);
  return [v, setV] as const;
}

export default function Page() {
  const [rows, setRows] = React.useState<Rec[]>([]);
  const [_orig, setOrig] = React.useState<Rec[]>([]);
  const [catalogPath, setCatalogPath] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<string[] | null>(null);
  const [visibleCols, setVisibleCols] = usePersisted<ColKey[]>("ex_cols", COLS.map(c => c.key));
  const [selectedBackup, setSelectedBackup] = React.useState<string>("");
  const [backups, setBackups] = React.useState<string[]>([]);

  const load = React.useCallback(async () => {
    setLoading(true); setError(null); setErrors(null);
    try {
      const res = await fetch("/api/admin/catalog", { cache: "no-store" });
      const json: ApiResp = await res.json();
      if (!json.ok) throw new Error(json.error || "bad response");
      setRows(json.data);
      setOrig(json.data);
      setCatalogPath(json.path || "");
    } catch (e: unknown) {
      setError((e as Error)?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true); setError(null); setErrors(null);
    try {
      const res = await fetch("/api/admin/catalog", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data: rows }),
      });
      const json: ApiResp = await res.json();
      if (!json.ok) {
        if ("errors" in json && Array.isArray(json.errors)) setErrors(json.errors);
        throw new Error(json.error || "Save failed");
      }
      setOrig(rows);
      if (json.backups && Array.isArray(json.backups)) setBackups(json.backups);
    } catch (e: unknown) {
      setError((e as Error)?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  const loadBackups = React.useCallback(async () => {
    setError(null); setErrors(null);
    try {
      const res = await fetch("/api/admin/catalog/backups", { cache: "no-store" });
      const json: ApiResp = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed to fetch backups");
      setBackups(json.backups ?? []);
    } catch (e: unknown) {
      setError((e as Error)?.message ?? String(e));
    }
  }, []);

  function onChange(idx: number, key: keyof Rec, value: string | number | undefined) {
    setRows(prev => {
      const next = [...prev];
      const r = { ...next[idx] };
      if (key === "latitude" || key === "longitude") {
        const num = typeof value === "string" ? Number(value) : value;
        (r as Rec)[key] = typeof num === "number" && !Number.isNaN(num) ? (num as never) : (undefined as never);
      } else {
        (r as Rec)[key] = (value as never);
      }
      next[idx] = r;
      return next;
    });
  }

  async function importBackup(name: string) {
    if (!name) return;
    setSaving(true);
    setError(null); setErrors(null);
    try {
      const res = await fetch(`/api/admin/catalog/backups?name=${encodeURIComponent(name)}`, { cache: "no-store" });
      const json: ApiResp = await res.json();
      if (!json.ok) throw new Error(json.error || "Import failed");
      setRows(json.data);
      setOrig(json.data);
      setCatalogPath(json.path || "");
    } catch (e: unknown) {
      setError(`Import failed: ${(e as Error)?.message ?? String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  function toggleCol(k: ColKey) {
    setVisibleCols(v => v.includes(k) ? v.filter(x=>x!==k) : [...v, k]);
  }

  return (
    <main className="min-h-dvh bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-[1400px] p-4">
        <header className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">Exchanges Admin</h1>
          <div className="text-xs text-neutral-400">Path: <span className="font-mono">{catalogPath || "?"}</span></div>

          {/* Backups */}
          <div className="ml-auto flex items-center gap-2">
            <button onClick={loadBackups} className="rounded-lg bg-neutral-800 hover:bg-neutral-700 px-2 py-1 text-xs">Backups</button>
            <select value={selectedBackup} onChange={(e)=>setSelectedBackup(e.target.value)} className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs">
              <option value="">Select backup?</option>
              {backups.map(b => (<option key={b} value={b}>{b}</option>))}
            </select>
            <button disabled={!selectedBackup || saving} onClick={()=>importBackup(selectedBackup)} className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-2 py-1 text-xs">
              Restore
            </button>
          </div>
        </header>

        {/* Table */}
        <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-800">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-900/60">
              <tr>
                {COLS.map(c => (
                  <th key={c.key} className={`px-3 py-2 text-left font-medium text-neutral-300 ${c.width}`}>
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={visibleCols.includes(c.key)} onChange={()=>toggleCol(c.key)} />
                      {c.label}
                    </label>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.id} className="odd:bg-neutral-950">
                  {visibleCols.includes("id") && <td className="px-3 py-2 font-mono">{r.id}</td>}
                  {visibleCols.includes("city") && <td className="px-3 py-2">{r.city}</td>}
                  {visibleCols.includes("tz") && <td className="px-3 py-2">{r.tz}</td>}
                  {visibleCols.includes("latitude") && (
                    <td className="px-3 py-2">
                      <Input type="number" step="0.0001" value={r.latitude} onChange={(v)=>onChange(idx, "latitude", v)} />
                    </td>
                  )}
                  {visibleCols.includes("longitude") && (
                    <td className="px-3 py-2">
                      <Input type="number" step="0.0001" value={r.longitude} onChange={(v)=>onChange(idx, "longitude", v)} />
                    </td>
                  )}
                  {visibleCols.includes("hoursTemplate") && (
                    <td className="px-3 py-2">
                      <Input value={r.hoursTemplate ?? ""} onChange={(v)=>onChange(idx, "hoursTemplate", v)} placeholder="CONTINUOUS_09:30_16:00 / SPLIT_09:00_11:30__12:30_15:00 / EXTENDED_..." />
                    </td>
                  )}
                  {visibleCols.includes("workdays") && (
                    <td className="px-3 py-2">
                      <Input value={r.workdays ?? ""} onChange={(v)=>onChange(idx, "workdays", v)} placeholder="MON-FRI / SUN-THU / MON-TUE,WED,FRI" />
                    </td>
                  )}
                  {visibleCols.includes("holidaysRef") && (
                    <td className="px-3 py-2">
                      <Input value={r.holidaysRef ?? ""} onChange={(v)=>onChange(idx, "holidaysRef", v)} placeholder="ISO2/REF-ID" />
                    </td>
                  )}
                  {visibleCols.includes("exceptions") && (
                    <td className="px-3 py-2">
                      <ExceptionsEditor rows={rows} index={idx} onChange={(list)=>setRows(prev => {
                        const next = [...prev];
                        next[idx] = { ...next[idx], exceptions: list };
                        return next;
                      })} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Actions */}
        <div className="mt-4 flex items-center gap-2">
          <button disabled={loading} onClick={load} className="rounded-lg bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5 text-sm">Reload</button>
          <button disabled={saving} onClick={save} className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-3 py-1.5 text-sm">Save</button>
          <span className="ml-auto text-xs text-red-400">{error ?? ""}</span>
        </div>

        {errors && errors.length > 0 && (
          <pre className="mt-3 rounded-lg bg-red-950/40 text-red-200 p-3 text-xs overflow-auto">{errors.join("\n")}</pre>
        )}
      </div>
    </main>
  );
}

function Input({
  value,
  onChange,
  className,
  type = "text",
  step,
  placeholder,
}: {
  value: string | number | undefined;
  onChange: (v: string | number | undefined) => void;
  className?: string;
  type?: string;
  step?: string | number;
  placeholder?: string;
}) {
  return (
    <input
      value={value ?? ""}
      onChange={(e)=>onChange(e.target.value)}
      className={`w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm ${className ?? ""}`}
      type={type}
      step={step}
      placeholder={placeholder}
    />
  );
}

function ExceptionsEditor({ rows, index, onChange }: { rows: Rec[]; index: number; onChange: (list: ExceptionRec[]) => void }) {
  const r = rows[index];
  const [list, setList] = React.useState<ExceptionRec[]>(r.exceptions ?? []);
  const [date, setDate] = React.useState<string>("");
  const [note, setNote] = React.useState<string>("");

  React.useEffect(() => {
    onChange(list);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input type="date" value={date} onChange={(e)=>setDate(e.target.value)} className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs" />
        <button className="rounded bg-neutral-800 hover:bg-neutral-700 px-2 py-1 text-xs" onClick={() => setList(prev => [{ date, closed: true, note }, ...prev])}>Add Closed</button>
        <button className="rounded bg-neutral-800 hover:bg-neutral-700 px-2 py-1 text-xs" onClick={() => setList(prev => [{ date, open: "09:00", close: "13:00", note }, ...prev])}>Add Half</button>
        <input type="text" placeholder="note?" value={note} onChange={(e)=>setNote(e.target.value)} className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs" />
      </div>
      {list.length === 0 ? (
        <div className="text-xs text-neutral-500">No exceptions.</div>
      ) : (
        <ul className="flex flex-col gap-1">
          {list.map((it, i) => (
            <li key={`${it.date}-${i}`} className="text-xs flex items-center gap-2">
              <code className="bg-neutral-900 border border-neutral-700 px-1 rounded">{it.date}</code>
              {it.closed ? <span className="text-red-300">CLOSED</span> : <span className="text-amber-300">{it.open} ? {it.close}</span>}
              {it.note && <span className="text-neutral-400 italic">({it.note})</span>}
              <button className="ml-auto rounded bg-neutral-800 hover:bg-neutral-700 px-1" onClick={()=>setList(prev => prev.filter((_,j)=>j!==i))}>?</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}




