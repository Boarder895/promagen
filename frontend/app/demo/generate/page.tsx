'use client';

import React, { useEffect, useState } from 'react';
import { getProviders, type Provider } from '@/lib/providers';

export default function GeneratePage() {
  const [providers, setProviders] = useState<Provider[]>([]);

  // Sync load: provider list is static and in-memory.
  useEffect(() => {
    const list = getProviders();
    setProviders([...list]);
  }, []);

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-lg font-semibold">Generate (Demo)</h1>
      <p className="text-sm text-gray-600">Providers loaded: {providers.length}</p>

      <ul className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {providers.map((p) => (
          <li key={p.id} className="rounded-lg border p-2 text-sm">
            <div className="font-medium">{p.name}</div>
            <div className="opacity-70">{p.id}</div>
          </li>
        ))}
      </ul>
    </main>
  );
}


