import { fetchJSON, API } from '../../lib/api';

type Health = { ok: boolean; service: string; time: string };

export default async function HealthCheckPage() {
  let data: Health | null = null;
  let error: string | null = null;

  try {
    data = await fetchJSON<Health>('/health');
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold mb-4">Health Check</h1>

      <div className="rounded-2xl border p-4">
        <p className="mb-2">
          Frontend → API: <code>{API.baseUrl}</code>
        </p>

        {data ? (
          <pre className="mt-2 overflow-auto rounded bg-black/5 p-3 text-sm">
            {JSON.stringify(data, null, 2)}
          </pre>
        ) : (
          <div className="text-red-600">
            Failed to fetch <code>/health</code>
            {error ? (
              <pre className="mt-2 overflow-auto rounded bg-black/5 p-3 text-sm">{error}</pre>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}

