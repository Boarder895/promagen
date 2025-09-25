// src/components/ProviderGrid.tsx
'use client';

import * as React from 'react';
import PROVIDERS, { Provider, byKind } from '@/lib/providers';

// API helpers
import { checkHealth, getApiBase, fetchProviders, type RemoteProvider } from '@/lib/api';

type Props = {
  title?: string;
  subtitle?: string;
  filter?: 'all' | 'image' | 'text' | 'video' | 'audio';
  showSearch?: boolean;
  compact?: boolean;
};

const kindToEmoji: Record<string, string> = {
  image: '🖼️',
  text: '✍️',
  video: '🎬',
  audio: '🎧',
};

function toList(kind: Provider['kind'] | RemoteProvider['kind']): string[] {
  const v = Array.isArray(kind) ? kind : [kind];
  return v.filter(Boolean) as string[];
}

export default function ProviderGrid({
  title = 'Create across providers',
  subtitle = 'Pick a platform to generate with your preferred model — links include our affiliate tags where applicable.',
  filter = 'all',
  showSearch = true,
  compact = false,
}: Props) {
  const [q, setQ] = React.useState('');

  // API health/state
  const [apiOnline, setApiOnline] = React.useState<null | boolean>(null);
  const [apiBase, setApiBase] = React.useState<string>('');

  // Remote providers (optional) + load state
  const [remote, setRemote] = React.useState<RemoteProvider[] | null>(null);

  React.useEffect(() => {
    setApiBase(getApiBase());
    (async () => {
      const h = await checkHealth();
      setApiOnline(h.ok);

      // Fetch providers only if API is healthy; otherwise keep local fallback
      if (h.ok) {
        const list = await fetchProviders();
        if (Array.isArray(list) && list.length > 0) {
          setRemote(list);

          // Dev visibility for drift
          try {
            const localIds = new Set(PROVIDERS.map(p => p.id));
            const remoteIds = new Set(list.map(p => p.id));
            const added = [...remoteIds].filter(id => !localIds.has(id));
            const removed = [...localIds].filter(id => !remoteIds.has(id));
            if (added.length || removed.length) {
              // eslint-disable-next-line no-console
              console.table([
                { note: 'remote - local (NEW on server)', ids: added.join(', ') || '-' },
                { note: 'local - remote (MISSING on server)', ids: removed.join(', ') || '-' },
              ]);
            }
          } catch {}
        }
      }
    })();
  }, []);

  // Choose the working set: remote (if present), else local
  const source = React.useMemo(() => {
    return (remote ?? PROVIDERS) as Array<
      (Provider & { kind: Provider['kind'] }) | (RemoteProvider & { kind: RemoteProvider['kind'] })
    >;
  }, [remote]);

  const filtered = React.useMemo(() => {
    const base =
      filter === 'all'
        ? source
        : (source.filter(p => toList((p as any).kind).includes(filter)) as typeof source);

    if (!q.trim()) return base;

    const needle = q.toLowerCase();
    return base.filter(p =>
      (p.name ?? '').toLowerCase().includes(needle) ||
      (p as any).tags?.some((t: string) => t.toLowerCase().includes(needle)) ||
      toList((p as any).kind).some(k => k.includes(needle))
    );
  }, [q, filter, source]);

  // ----- Drift detector (remote vs local) -----
  const drift = React.useMemo(() => {
    if (!remote) return null;
    const localIds = new Set(PROVIDERS.map(p => p.id));
    const remoteIds = new Set(remote.map(p => p.id));
    const added = [...remoteIds].filter(id => !localIds.has(id));   // on server, not in local
    const removed = [...localIds].filter(id => !remoteIds.has(id)); // in local, not on server
    const countDiff = remote.length - PROVIDERS.length;
    const changed = added.length > 0 || removed.length > 0 || countDiff !== 0;
    return changed
      ? {
          added,
          removed,
          countDiff,
          summary: `Live: ${remote.length} • Local: ${PROVIDERS.length} • Δ ${countDiff >= 0 ? '+' : ''}${countDiff}`,
        }
      : null;
  }, [remote]);

  return (
    <section className="w-full">
      <header className="mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">{title}</h2>
            {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
            <p className="mt-1 text-xs text-gray-500">
              Showing <b>{filtered.length}</b> provider{filtered.length === 1 ? '' : 's'}
              {remote ? ' (live)' : ' (local)'}
            </p>
          </div>
          {/* API health chip */}
          <span
            className="rounded-full border px-3 py-1 text-xs"
            style={{
              background:
                apiOnline === null
                  ? 'rgba(255,255,255,0.06)'
                  : apiOnline
                  ? 'rgba(0,128,0,0.25)'
                  : 'rgba(128,0,0,0.25)',
            }}
          >
            {apiOnline === null
              ? 'Checking API…'
              : apiOnline
              ? `API Online ✅ ${apiBase}`
              : `API Offline ❌ ${apiBase}`}
          </span>
        </div>
      </header>

      {/* --- Drift banner --- */}
      {drift && (
        <div className="mb-4 rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-xs text-yellow-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <b>Provider list drift detected</b> — {drift.summary}
              {(drift.added.length > 0 || drift.removed.length > 0) && (
                <div className="mt-1 grid gap-1 sm:grid-cols-2">
                  <div>
                    <span className="font-medium">New on server:</span>{' '}
                    {drift.added.length ? drift.added.slice(0, 6).join(', ') : '—'}
                    {drift.added.length > 6 && ` …+${drift.added.length - 6}`}
                  </div>
                  <div>
                    <span className="font-medium">Missing on server:</span>{' '}
                    {drift.removed.length ? drift.removed.slice(0, 6).join(', ') : '—'}
                    {drift.removed.length > 6 && ` …+${drift.removed.length - 6}`}
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={(e) => {
                // simple dismiss without extra state libs
                (e.currentTarget.parentElement?.parentElement as HTMLElement).style.display = 'none';
              }}
              className="rounded-md border px-2 py-1 text-[11px] hover:bg-yellow-100"
              aria-label="Dismiss drift banner"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {showSearch && (
        <div className="mb-4">
          <input
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring"
            placeholder="Search providers (e.g., “sdxl”, “video”, “flux”, “midjourney”)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      )}

      <div
        className={`grid gap-3 ${
          compact ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        }`}
      >
        {filtered.map((p: any) => (
          <a
            key={p.id}
            href={p.href}
            target="_blank"
            rel={p.rel ?? 'noopener noreferrer'}
            className="group rounded-xl border p-4 transition hover:border-gray-400 hover:bg-gray-50"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{p.name}</span>
                  <div className="flex gap-1">
                    {toList(p.kind).map(k => (
                      <span key={k} title={k} className="text-xs">{kindToEmoji[k] ?? '✨'}</span>
                    ))}
                  </div>
                </div>
                {p.slogan && (
                  <p className="mt-1 line-clamp-2 text-sm text-gray-600">{p.slogan}</p>
                )}
              </div>
              {p.icon && <img src={p.icon} alt="" className="h-6 w-6 opacity-80" />}
            </div>
            {p.tags && p.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.tags.map((t: string) => (
                  <span
                    key={t}
                    className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-3 text-sm text-blue-600 group-hover:underline">
              Open&nbsp;↗
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
