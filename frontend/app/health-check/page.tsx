// Server component: simple “frontend → API” health peek.
// Uses the same lib/api helpers the rest of the app imports.

import API_BASE, { fetchJSON } from '@/lib/api';

export const revalidate = 30;

type ApiHealth = {
  status: 'ok' | 'degraded' | 'down';
  message?: string;
  latencyMs?: number;
  version?: string;
};

export default async function HealthCheckPage() {
  let api: ApiHealth | { error: string } = { status: 'down', message: 'unknown' };

  try {
    api = await fetchJSON<ApiHealth>(`${API_BASE}/health`);
  } catch (e) {
    api = { error: (e as Error).message ?? 'failed to fetch' };
  }

  return (
    <main className="mx-auto max-w-xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Health Check</h1>

      <article className="rounded-xl border p-4">
        <div className="text-sm opacity-70">Frontend → API</div>
        <div className="mt-1 font-mono text-sm">
          Base: <code>{API_BASE}</code>
        </div>

        {'error' in api ? (
          <p className="mt-3 rounded bg-red-50 p-3 text-sm text-red-800">
            Failed to fetch: {api.error}
          </p>
        ) : (
          <ul className="mt-3 text-sm">
            <li>Status: <b>{api.status}</b></li>
            {api.message ? <li>Message: {api.message}</li> : null}
            {typeof api.latencyMs === 'number' ? <li>Latency: {api.latencyMs} ms</li> : null}
            {api.version ? <li>Version: {api.version}</li> : null}
          </ul>
        )}
      </article>
    </main>
  );
}

