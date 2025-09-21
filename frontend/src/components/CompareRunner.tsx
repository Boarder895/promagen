'use client';

import { useEffect, useState } from 'react';
import { ALL_PROVIDERS } from '@/lib/providers';

type CompareRunnerProps = {
  /** show all providers even if the user has preferences */
  showAll?: boolean;
};

export default function CompareRunner({ showAll = false }: CompareRunnerProps) {
  const [prefs, setPrefs] = useState<string[] | null>(null);

  useEffect(() => {
    // Load the user’s preferred providers (adjust the path if your API is different)
    fetch('/api/user/me/preferences', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setPrefs(d?.preferredProviders ?? []))
      .catch(() => setPrefs([]));
  }, []);

  if (prefs === null) return null;

  const providers =
    showAll || prefs.length === 0
      ? ALL_PROVIDERS
      : ALL_PROVIDERS.filter((p) => prefs.includes(p.id));

  return (
    <div>
      {/* Example toggle you could add later:
          <Switch label="Show all providers" checked={showAll} onChange={...} />
      */}

      {providers.map((p) => (
        <button
          key={p.id}
          className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50"
          onClick={() => runCompareWith(p.id)}
        >
          Run with {p.name}
        </button>
      ))}
    </div>
  );
}

async function runCompareWith(providerId: string) {
  // Call your backend with the canonical request + providerId
  // Adjust URL/body to your app’s actual contract
  await fetch('/api/compare/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerId }),
  });
}
