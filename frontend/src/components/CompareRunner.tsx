'use client';

import * as React from 'react';
import { PROVIDERS, type Provider } from '@/lib/providers';

/**
 * Simple compare runner that lists API-capable providers.
 * (This replaces any legacy use of a lowercased `providers` import.)
 */
export function CompareRunner(): JSX.Element {
  const [filter, setFilter] = React.useState<'all' | 'api'>('all');

  const list: Provider[] = React.useMemo(() => {
    const base = [...PROVIDERS];
    return filter === 'api' ? base.filter((p) => p.hasApi) : base;
  }, [filter]);

  return (
    <section className="p-4">
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-base font-semibold">Compare Runner</h2>

        <select
          className="rounded border px-2 py-1 text-sm"
          value={filter}
          onChange={(e) => setFilter(e.target.value as 'all' | 'api')}
        >
          <option value="all">All providers</option>
          <option value="api">API-capable only</option>
        </select>

        <span className="text-xs opacity-70">Showing {list.length}</span>
      </div>

      <ul className="space-y-2">
        {list.map((p) => (
          <li key={p.id} className="rounded-lg border p-3">
            <div className="font-medium">{p.name}</div>
            <div className="text-xs opacity-70">{p.id}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}




