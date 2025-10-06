'use client';

import * as React from 'react';
import { PROVIDERS, type Provider } from '@/lib/providers';

export function ProviderGrid() {
  const list: Provider[] = [...PROVIDERS];

  return (
    <section className="p-4">
      <h2 className="text-base font-semibold mb-3">Providers ({list.length})</h2>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {list.map((p) => (
          <div key={p.id} className="rounded-xl border p-3">
            <div className="font-medium">{p.name}</div>
            <div className="text-xs opacity-70">{p.id}</div>

            <div className="mt-2 text-sm">
              <div>API: {p.hasApi ? 'Yes' : 'No'}</div>
              <div>Automation: {p.supportsAutomation === true ? 'Yes' : 'No'}</div>
              <div>Affiliate: {p.hasAffiliate === true ? 'Yes' : 'No'}</div>
            </div>

            {p.website && (
              <a href={p.website} className="mt-2 inline-block text-xs underline opacity-80" target="_blank" rel="noreferrer">
                Website
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}




