type Item = {
  id: string;
  generatedAt: string;
  reviewer?: string | null;
  period?: string | null;
  base?: number | null;
  signature: string;
  hmacSignature?: string | null;
  shaValid: boolean;
  hmacValid: boolean | null; // null when server has no secret
};

async function fetchAudits(): Promise<Item[]> {
  const origin = process.env.NEXT_PUBLIC_APP_ORIGIN ?? 'http://localhost:3000';
  const r = await fetch(`${origin}/api/audit`, { cache: 'no-store' });
  const j = await r.json();
  if (!j.ok) throw new Error('Failed to load audits');
  return j.items as Item[];
}

export default async function HistoryPage() {
  const items = await fetchAudits();

  const Badge = ({ ok, unknown }: { ok?: boolean; unknown?: boolean }) => (
    unknown ? <span className="badge bg-gray-100 border-gray-300 text-gray-700">Unknown</span> :
    ok ? <span className="badge bg-green-100 border-green-300 text-green-800">Valid</span> :
         <span className="badge bg-red-100 border-red-300 text-red-800">Invalid</span>
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold">Leaderboard Audit History</h1>
      <p className="mb-6 text-sm text-gray-600">Signed CSVs with on-the-fly verification (SHA + HMAC).</p>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">When</th>
              <th className="px-3 py-2 text-left">Reviewer</th>
              <th className="px-3 py-2 text-left">Period</th>
              <th className="px-3 py-2 text-left">Base</th>
              <th className="px-3 py-2 text-left">SHA</th>
              <th className="px-3 py-2 text-left">HMAC</th>
              <th className="px-3 py-2 text-left">CSV</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t">
                <td className="px-3 py-2">{new Date(it.generatedAt).toLocaleString()}</td>
                <td className="px-3 py-2">{it.reviewer ?? '—'}</td>
                <td className="px-3 py-2">{it.period ?? '—'}</td>
                <td className="px-3 py-2">{it.base ?? '—'}</td>
                <td className="px-3 py-2"><Badge ok={it.shaValid} /></td>
                <td className="px-3 py-2"><Badge ok={it.hmacValid ?? undefined} unknown={it.hmacValid === null} /></td>
                <td className="px-3 py-2"><a className="underline" href={`/api/audit/${it.id}/csv`}>Download</a></td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td className="px-3 py-6 text-gray-500" colSpan={7}>No audits yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
