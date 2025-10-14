'use client';

import * as React from 'react';

type View =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'done'; message: string }
  | { kind: 'error'; message: string };

export default function SyncForm() {
  const [view, setView] = React.useState<View>({ kind: 'idle' });

  async function runSync() {
    try {
      setView({ kind: 'running' });
      // Hit your API route instead of server actions to avoid import/type churn.
      const res = await fetch('/api/admin/sync', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { message?: string };
      setView({ kind: 'done', message: data?.message ?? 'Sync complete.' });
    } catch (e) {
      setView({ kind: 'error', message: (e as Error).message });
    }
  }

  return (
    <div className="rounded-xl border p-4">
      <div className="mb-3 text-sm font-semibold">Admin sync</div>
      <button
        type="button"
        onClick={runSync}
        disabled={view.kind === 'running'}
        className="rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
      >
        {view.kind === 'running' ? 'Syncing…' : 'Run sync'}
      </button>

      {view.kind === 'done' && (
        <p className="mt-3 text-sm text-green-700">{view.message}</p>
      )}
      {view.kind === 'error' && (
        <p className="mt-3 text-sm text-red-700">Error: {view.message}</p>
      )}
    </div>
  );
}




