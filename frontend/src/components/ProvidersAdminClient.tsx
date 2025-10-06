// FRONTEND ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· Admin client for providers (NEW) ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· named exports only
"use client";
import { useEffect, useState } from 'react';

type Row = {
  slug: string;
  name: string;
  total: number;
  hasApi: boolean;
  hasAffiliate: boolean;
  criteria: Record<string, number>;
};

type Payload = {
  asOf: string;
  providers: Row[];
};

const NUM = (v: string) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));

export const ProvidersAdminClient = () => {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3001";

  const fetchList = async () => {
    try {
      const r = await fetch(`${base}/api/v1/providers/admin/providers`, {
        headers: { "X-Admin-Token": process.env.NEXT_PUBLIC_ADMIN_TOKEN ?? "" },
        cache: "no-store",
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setPayload(await r.json());
    } catch (e: any) {
      setErr(e.message || "Failed to load");
    }
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const providers = payload?.providers ?? [];

  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<{ name: string; hasApi: boolean; hasAffiliate: boolean; criteria: Record<string, number> } | null>(null);

  const openEdit = (row: Row) => {
    setEditing(row);
    setForm({ name: row.name, hasApi: row.hasApi, hasAffiliate: row.hasAffiliate, criteria: { ...row.criteria } });
  };

  const saveMeta = async (slug: string) => {
    if (!form) return;
    setSaving(true);
    try {
      const r = await fetch(`${base}/api/v1/providers/admin/providers/${slug}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": process.env.NEXT_PUBLIC_ADMIN_TOKEN ?? "",
        },
        body: JSON.stringify({
          displayName: form.name,
          hasApi: form.hasApi,
          hasAffiliate: form.hasAffiliate,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    } finally {
      setSaving(false);
    }
  };

  const saveScores = async (slug: string) => {
    if (!form) return;
    setSaving(true);
    try {
      const r = await fetch(`${base}/api/v1/providers/admin/providers/${slug}/scores`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": process.env.NEXT_PUBLIC_ADMIN_TOKEN ?? "",
        },
        body: JSON.stringify({
          adoption: NUM(String(form.criteria.adoption ?? 0)),
          quality: NUM(String(form.criteria.quality ?? 0)),
          speed: NUM(String(form.criteria.speed ?? 0)),
          cost: NUM(String(form.criteria.cost ?? 0)),
          trust: NUM(String(form.criteria.trust ?? 0)),
          automation: NUM(String(form.criteria.automation ?? 0)),
          ethics: NUM(String(form.criteria.ethics ?? 0)),
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    } finally {
      setSaving(false);
      setEditing(null);
      setForm(null);
      fetchList();
    }
  };

  if (err) return <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-rose-800">{err}</div>;
  if (!payload) return <div className="rounded-md border border-neutral-200 bg-white p-4 text-neutral-600">LoadingÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦</div>;

  return (
    <section className="space-y-3">
      <div className="text-xs text-neutral-500">As of {new Date(payload.asOf).toLocaleString()}</div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>
              <th className="px-3 py-2 text-left">Image Generation Platform</th>
              <th className="px-3 py-2 text-right">TOTAL</th>
              <th className="px-3 py-2 text-right">API</th>
              <th className="px-3 py-2 text-right">Affiliate</th>
              <th className="px-3 py-2 text-right">Edit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {providers.map((p) => (
              <tr key={p.slug} className="hover:bg-neutral-50">
                <td className="px-3 py-2">{p.name}</td>
                <td className="px-3 py-2 text-right tabular-nums">{p.total.toFixed(1)}</td>
                <td className="px-3 py-2 text-right">{p.hasApi ? "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€¦Ã¢â‚¬â„¢" : "ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â"}</td>
                <td className="px-3 py-2 text-right">{p.hasAffiliate ? "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â¤Ãƒâ€šÃ‚Â" : "ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â"}</td>
                <td className="px-3 py-2 text-right">
                  <button className="rounded-md border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50" onClick={() => openEdit(p)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!providers.length && <div className="p-4 text-neutral-600">No providers.</div>}
      </div>

      {editing && form && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="mb-2 font-semibold">Edit: {editing.slug}</div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <div className="text-neutral-600">Image Generation Platform</div>
              <input
                className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>

            <div className="flex items-end gap-3">
              <label className="text-sm inline-flex items-center gap-2">
                <input type="checkbox" checked={form.hasApi} onChange={(e) => setForm({ ...form, hasApi: e.target.checked })} />
                ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€¦Ã¢â‚¬â„¢ API
              </label>
              <label className="text-sm inline-flex items-center gap-2">
                <input type="checkbox" checked={form.hasAffiliate} onChange={(e) => setForm({ ...form, hasAffiliate: e.target.checked })} />
                ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â¤Ãƒâ€šÃ‚Â Affiliate
              </label>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            {["adoption","quality","speed","cost","trust","automation","ethics"].map((k) => (
              <label key={k} className="text-sm">
                <div className="text-neutral-600 capitalize">{k}</div>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1"
                  value={form.criteria[k] ?? 0}
                  onChange={(e) => setForm({ ...form, criteria: { ...form.criteria, [k]: NUM(e.target.value) } })}
                />
              </label>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              className="rounded-md bg-neutral-900 text-white px-3 py-1 text-sm disabled:opacity-50"
              disabled={saving}
              onClick={async () => {
                await saveMeta(editing.slug);
                await saveScores(editing.slug);
              }}
            >
              {saving ? "SavingÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦" : "Save changes"}
            </button>
            <button className="rounded-md border border-neutral-300 px-3 py-1 text-sm" onClick={() => { setEditing(null); setForm(null); }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
};


