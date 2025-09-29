'use client';

import { useEffect, useState } from 'react';

type ProviderOverride = {
  scoreAdjustment?: number | null;
  finalScore?: number | null;
  isHardOverride?: boolean | null;
  notes?: string | null;
} | null;

type ProviderRow = { id: string; name: string; override: ProviderOverride };

type AuditRow = {
  id: string;
  action: 'PATCH' | 'DELETE' | string;
  prevScore?: number | null;
  newScore?: number | null;
  ip?: string | null;
  userAgent?: string | null;
  createdAt: string;
};

export default function ClientProviders({ initialData }: { initialData: ProviderRow[] }) {
  const [rows, setRows] = useState<ProviderRow[]>(initialData);
  const [editing, setEditing] = useState<ProviderRow | null>(null);
  const [score, setScore] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditRow[] | null>(null);
  const [auditBusy, setAuditBusy] = useState(false);

  function openEdit(r: ProviderRow) {
    setEditing(r);
    setScore((r.override?.scoreAdjustment ?? '').toString());
    setAudit(null);
    void loadAudit(r.id);
  }

  async function loadAudit(id: string) {
    try {
      setAuditBusy(true);
      const res = await fetch(`/api/providers/${id}/override/audit`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && data?.ok) setAudit(data.rows ?? []);
      else setAudit([]);
    } catch {
      setAudit([]);
    } finally {
      setAuditBusy(false);
    }
  }

  async function save() {
    if (!editing) return;
    const num = Number(score);
    if (!Number.isInteger(num) || num < -100 || num > 100) {
      setToast('Enter an integer between -100 and 100'); 
      return;
    }

    setBusy(true);
    const prev = rows;
    setRows((rs) =>
      rs.map((p) =>
        p.id === editing.id ? { ...p, override: { ...(p.override ?? {}), scoreAdjustment: num } } : p
      )
    );

    try {
      const res = await fetch(`/api/providers/${editing.id}/override`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scoreAdjustment: num }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setToast('Saved');
      await loadAudit(editing.id);
      setEditing(null);
    } catch (e: any) {
      setRows(prev); // rollback
      setToast(`Save failed: ${e?.message ?? 'unknown'}`);
    } finally {
      setBusy(false);
      setTimeout(() => setToast(null), 2500);
    }
  }

  async function resetOverride() {
    if (!editing) return;
    setBusy(true);
    const prev = rows;
    // optimistic clear
    setRows((rs) =>
      rs.map((p) => (p.id === editing.id ? { ...p, override: null } : p))
    );
    try {
      const res = await fetch(`/api/providers/${editing.id}/override`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setToast(data.cleared ? 'Override reset' : 'No override to reset');
      await loadAudit(editing.id);
      setEditing(null);
    } catch (e: any) {
      setRows(prev); // rollback
      setToast(`Reset failed: ${e?.message ?? 'unknown'}`);
    } finally {
      setBusy(false);
      setTimeout(() => setToast(null), 2500);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-1 text-2xl font-bold">Image Model Providers</h1>
      <p className="mb-6 text-sm text-gray-600">{rows.length} providers loaded from the API.</p>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((p) => (
          <li key={p.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">{p.name}</div>
                <div className="text-xs text-gray-500">{p.id}</div>
              </div>
              {p.override ? (
                <span className="badge bg-blue-50">
                  Adj: {typeof p.override.scoreAdjustment === 'number' ? p.override.scoreAdjustment : '—'}
                </span>
              ) : (
                <span className="badge bg-gray-50">No override</span>
              )}
            </div>

            <div className="mt-3">
              <button className="btn" onClick={() => openEdit(p)}>Edit score</button>
            </div>
          </li>
        ))}
      </ul>

      {/* Dialog */}
      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
          <div className="card w-full max-w-lg p-4">
            <h2 className="mb-2 text-lg font-semibold">Edit score – {editing.name}</h2>

            <label className="mb-1 block text-sm text-gray-600" htmlFor="score">
              Score adjustment (-100 … 100)
            </label>
            <input
              id="score"
              type="number"
              min={-100}
              max={100}
              step={1}
              value={score}
              onChange={(e) => setScore(e.target.value)}
              className="input"
            />

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-gray-500">
                Server clamps to [-100, 100]; changes are audited.
              </div>
              <div className="flex gap-2">
                <button
                  className="btn bg-gray-200 text-gray-900 hover:bg-gray-300"
                  onClick={() => setEditing(null)}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button className="btn" onClick={save} disabled={busy}>
                  {busy ? 'Saving…' : 'Save'}
                </button>
                <button
                  className="btn bg-red-600 hover:bg-red-700"
                  onClick={resetOverride}
                  disabled={busy}
                  title="Reset override to none"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Tiny audit list */}
            <div className="mt-5">
              <div className="mb-2 text-sm font-semibold">Recent changes</div>
              <div className="rounded-lg border border-gray-200">
                {auditBusy ? (
                  <div className="p-3 text-sm text-gray-500">Loading…</div>
                ) : !audit?.length ? (
                  <div className="p-3 text-sm text-gray-500">No recent changes.</div>
                ) : (
                  <ul className="divide-y">
                    {audit.map((a) => (
                      <li key={a.id} className="p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{a.action}</div>
                          <div className="text-xs text-gray-500">
                            {new Date(a.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-gray-600">
                          {a.prevScore ?? '—'} → {a.newScore ?? '—'} · {a.ip ?? 'ip:—'}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
          <div className="rounded-lg bg-black px-3 py-2 text-sm text-white shadow">{toast}</div>
        </div>
      )}
    </main>
  );
}
