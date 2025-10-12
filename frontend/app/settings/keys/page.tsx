// app/settings/keys/page.tsx
import { headers } from 'next/headers';

export default async function KeysPage() {
  // Build absolute origin for server-side fetch
  const h = headers();
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('host') ?? 'localhost:3000';
  const origin = `${proto}://${host}`;

  const res = await fetch(`${origin}/api/health`, { cache: 'no-store' });
  const body = await res.json().catch(() => ({}));

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>Settings → Keys</h1>
      <p>
        API health: {res.status} {res.statusText} → {String((body as any).status ?? 'ok')}
      </p>
    </main>
  );
}
