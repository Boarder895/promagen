'use client';

import { useMemo, useState } from 'react';

type Row = { id: string; name: string; resolvedScore: number | null; reason: 'hard' | 'adjusted' | 'base' | 'none' };

const PROVIDERS: { id: string; name: string }[] = [
  { id: 'openai',     name: 'OpenAI DALL·E/GPT-Image' },
  { id: 'stability',  name: 'Stability AI' },
  { id: 'leonardo',   name: 'Leonardo AI' },
  { id: 'i23rf',      name: 'I23RF' },
  { id: 'artistly',   name: 'Artistly' },
  { id: 'adobe',      name: 'Adobe Firefly' },
  { id: 'midjourney', name: 'Midjourney' },
  { id: 'canva',      name: 'Canva Text-to-Image' },
  { id: 'bing',       name: 'Bing Image Creator' },
  { id: 'ideogram',   name: 'Ideogram' },
  { id: 'picsart',    name: 'Picsart' },
  { id: 'fotor',      name: 'Fotor' },
  { id: 'nightcafe',  name: 'NightCafe' },
  { id: 'playground', name: 'Playground AI' },
  { id: 'pixlr',      name: 'Pixlr' },
  { id: 'deepai',     name: 'DeepAI' },
  { id: 'novelai',    name: 'NovelAI' },
  { id: 'lexica',     name: 'Lexica' },
  { id: 'openart',    name: 'OpenArt' },
  { id: 'flux',       name: 'Flux Schnell' },
];

export default function WeeklyReviewPage() {
  const [defaultBase, setDefaultBase] = useState<string>('72');
  const [reviewer, setReviewer] = useState<string>('Martin');
  const [period, setPeriod] = useState<string>(suggestISOWeek());
  const [bases, setBases] = useState<Record<string, string>>(
    Object.fromEntries(PROVIDERS.map(p => [p.id, '']))
  );
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bodyJSON = useMemo(() => {
    const b: any = {};
    if (defaultBase.trim()) b.base = Number(defaultBase);
    const per: Record<string, number> = {};
    for (const p of PROVIDERS) {
      const v = bases[p.id].trim();
      if (v !== '') per[p.id] = Number(v);
    }
    if (Object.keys(per).length) b.bases = per;
    return b;
  }, [defaultBase, bases]);

  async function compute() {
    setLoading(true);
    setError(null);
    setRows(null);
    try {
      const qs = new URLSearchParams();
      const res = await fetch(`/api/providers/leaderboard/bulk?${qs.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyJSON),
      });
      if (!res.ok) throw new Error(`Upstream ${res.status}`);
      const data = await res.json();
      setRows(data.rows as Row[]);
    } catch (e: any) {
      setError(e.message || 'Failed');
    } finally {
      setLoading(false);
    }
  }

  async function downloadCSV() {
    const qs = new URLSearchParams();
    qs.set('format', 'csv');
    if (reviewer.trim()) qs.set('reviewer', reviewer.trim());
    if (period.trim()) qs.set('period', period.trim());

    const res = await fetch(`/api/providers/leaderboard/bulk?${qs.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyJSON),
    });
    if (!res.ok) {
      alert(`CSV error: ${res.status}`);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leaderboard.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold">Weekly Manual Review</h1>
      <p className="mb-6 text-sm text-gray-600">
        Set a default base and any per-provider bases. Compute to preview, or download a CSV with an audit header (SHA-256 + timestamp).
      </p>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="md:col-span-1">
          <label className="block text-sm font-medium mb-1">Default Base (0–100)</label>
          <input value={defaultBase} onChange={e => setDefaultBase(e.target.value)} className="w-full rounded border px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Reviewer</label>
          <input value={reviewer} onChange={e => setReviewer(e.target.value)} className="w-full rounded border px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Period (ISO week or label)</label>
          <input value={period} onChange={e => setPeriod(e.target.value)} className="w-full rounded border px-3 py-2" />
        </div>
        <div className="flex items-end gap-2">
          <button onClick={compute} disabled={loading} className="rounded bg-black text-white px-4 py-2">{loading ? 'Computing…' : 'Compute'}</button>
          <button onClick={downloadCSV} disabled={loading} className="rounded border px-4 py-2">Download CSV</button>
        </div>
      </div>

      <div className="mt-8 grid md:grid-cols-2 gap-6">
        {PROVIDERS.map(p => (
          <div key={p.id} className="rounded border p-3">
            <div className="mb-2 text-sm font-medium">{p.name} <span className="text-gray-500">({p.id})</span></div>
            <input
              value={bases[p.id]}
              onChange={e => setBases(prev => ({ ...prev, [p.id]: e.target.value }))}
              placeholder="Override (0–100)"
              className="w-full rounded border px-3 py-2"
            />
          </div>
        ))}
      </div>

      {error && <p className="mt-6 text-sm text-red-600">Error: {error}</p>}

      {rows && (
        <div className="mt-8 card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Provider</th>
                <th className="px-3 py-2 text-left">ID</th>
                <th className="px-3 py-2 text-right">Resolved</th>
                <th className="px-3 py-2 text-left">Reason</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="border-top">
                  <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2 text-gray-500">{r.id}</td>
                  <td className="px-3 py-2 text-right font-semibold">{r.resolvedScore ?? '—'}</td>
                  <td className="px-3 py-2">{r.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function suggestISOWeek() {
  const now = new Date();
  // ISO week number
  const tmp = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  // @ts-ignore quick ISO week helper
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  // @ts-ignore
  const weekNo = Math.ceil((((tmp as any) - (yearStart as any)) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}
