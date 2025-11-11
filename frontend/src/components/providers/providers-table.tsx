"use client";
import list from "@/data/providers.json";

export default function ProvidersTable() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(list as any[]).map((p) => (
        <div key={p.id} className="rounded-lg border border-slate-700 p-3">
          <div className="text-sm font-medium">{p.name}</div>
          <div className="text-xs text-slate-400">{p.tagline ?? ""}</div>
        </div>
      ))}
    </div>
  );
}



