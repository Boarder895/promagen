"use client";

import { useState, ChangeEvent } from "react";

type ProviderOverride = {
  id: string;
  uiProviderId?: string | null;
  textProviderId?: string | null;
  imageProviderId?: string | null;
  embedProviderId?: string | null;
};

type ProviderRow = {
  id: string;
  name: string;
  override?: ProviderOverride | null;
};

type AuditRow = {
  id: string;
  providerId: string;
  userId: string;
  action: "override" | "clear";
  createdAt: string; // ISO string
  notes?: string | null;
};

type ClientProvidersProps = {
  initialData: ProviderRow[];
  audit?: AuditRow[];
  overrides?: ProviderOverride[];
  mutated?: boolean;
};

export function ClientProviders(props: ClientProvidersProps) {
  const { initialData, audit, overrides: initialOverrides, mutated } = props;
  const [rows] = useState<ProviderRow[]>(initialData ?? []);
  // underscore value to satisfy no-unused-vars; we only update it here
  const [_overrides, setOverrides] = useState<ProviderOverride[]>(initialOverrides ?? []);

  function updateOverride(providerId: string, patch: Partial<ProviderOverride>) {
    setOverrides((prev) => {
      const next = prev.slice();
      const idx = next.findIndex((o) => o.id === providerId);
      if (idx === -1) {
        next.push({ id: providerId, ...patch });
      } else {
        next[idx] = { ...next[idx], ...patch };
      }
      return next;
    });
  }

  function onChangeFactory(
    providerId: string,
    key: keyof Omit<ProviderOverride, "id">
  ) {
    return (e: ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value.trim();
      updateOverride(providerId, { [key]: v.length > 0 ? v : null } as Partial<ProviderOverride>);
    };
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Providers</h2>
        {mutated ? <span className="text-xs opacity-75">pending changes</span> : null}
      </div>

      <div className="grid gap-3">
        {rows.map((r) => (
          <div key={r.id} className="rounded border p-3">
            <div className="font-medium">{r.name}</div>

            <div className="mt-2 flex flex-wrap gap-3 text-sm">
              <label className="flex items-center gap-2">
                <span>Text</span>
                <input
                  className="rounded border px-2 py-1"
                  defaultValue={r.override?.textProviderId ?? ""}
                  onChange={onChangeFactory(r.id, "textProviderId")}
                />
              </label>

              <label className="flex items-center gap-2">
                <span>Image</span>
                <input
                  className="rounded border px-2 py-1"
                  defaultValue={r.override?.imageProviderId ?? ""}
                  onChange={onChangeFactory(r.id, "imageProviderId")}
                />
              </label>

              <label className="flex items-center gap-2">
                <span>UI</span>
                <input
                  className="rounded border px-2 py-1"
                  defaultValue={r.override?.uiProviderId ?? ""}
                  onChange={onChangeFactory(r.id, "uiProviderId")}
                />
              </label>

              <label className="flex items-center gap-2">
                <span>Embed</span>
                <input
                  className="rounded border px-2 py-1"
                  defaultValue={r.override?.embedProviderId ?? ""}
                  onChange={onChangeFactory(r.id, "embedProviderId")}
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      {audit && audit.length > 0 && (
        <details className="rounded border p-3">
          <summary className="cursor-pointer font-medium">Recent override activity</summary>
          <ul className="mt-2 text-sm">
            {audit.map((a) => (
              <li key={a.id}>
                {new Date(a.createdAt).toLocaleString()} - {a.action} - {a.providerId}
                {a.notes ? " — " + a.notes : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
