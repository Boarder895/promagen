'use client';

import { useEffect, useState } from 'react';
import { PROVIDERS, type Provider } from '@/lib/providers';

export function PreferredProvidersForm() {
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Load current prefs once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/user/me/preferences', { credentials: 'include' });
        const d = await r.json();
        if (!cancelled) {
          setSelected(Array.isArray(d?.preferredProviders) ? d.preferredProviders : []);
        }
      } catch {
        // ignore — keep defaults
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function save() {
    setSaving(true);
    try {
      await fetch('/api/user/me/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ preferredProviders: selected }),
      });
    } finally {
      setSaving(false);
    }
  }

  // Canonical list
  const list: Provider[] = [...PROVIDERS];

  return (
    <div>
      <h3 className="text-lg font-semibold mb-3">Preferred Platforms</h3>

      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))' }}
      >
        {list.map((p) => (
          <label
            key={p.id}
            className="cursor-pointer rounded-lg border border-zinc-200 p-3 flex items-center gap-2"
          >
            <input
              type="checkbox"
              checked={selected.includes(p.id)}
              onChange={() => toggle(p.id)}
            />
            <span className="font-medium">{p.name}</span>
            <span className="text-xs opacity-70 ml-auto">
              {p.hasApi ? 'API' : 'Manual'}
            </span>
          </label>
        ))}
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="mt-3 rounded-lg border px-3 py-1 text-sm"
      >
        {saving ? 'Saving...' : 'Save Preferences'}
      </button>
    </div>
  );
}



