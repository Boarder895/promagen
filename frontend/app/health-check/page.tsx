// app/health-check/page.tsx
import API_BASE, { fetchJSON } from '../../lib/api';

export default async function HealthCheckPage() {
  // keep it simple; no types drama
  let body: unknown = null;
  let ok = false;
  try {
    body = await fetchJSON(`${API_BASE}/health`);
    ok = true;
  } catch (e: any) {
    body = { error: String(e?.message || e) };
  }

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Health Check</h1>
      <p>
        Frontend → API: <code>{API_BASE}</code>
      </p>
      <pre className="rounded-lg border bg-gray-50 p-3 text-sm overflow-auto">
        {JSON.stringify({ ok, body }, null, 2)}
      </pre>
    </main>
  );
}

