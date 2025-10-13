<<<<<<< HEAD
// Server Component
export const dynamic = 'force-dynamic';

type Health = { ok: boolean; service: string; time: string } | { ok: false; error: string };

async function getHealth(): Promise<Health> {
  try {
    const res = await fetch('/api/health', { cache: 'no-store' }); // hit Next API (proxy)
    if (!res.ok) return { ok: false, error: `${res.status} ${res.statusText}` };
    return (await res.json()) as Health;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export default async function StatusPage() {
  const health = await getHealth();

  const up = 'bg-green-100 text-green-900';
  const down = 'bg-red-100 text-red-900';

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">System Status</h1>

      <section className={`rounded-xl p-4 ${'ok' in health && health.ok ? up : down}`}>
        <div className="font-medium">API</div>
        <div className="text-sm opacity-80">
          {'ok' in health && health.ok
            ? `UP • ${('time' in health && (health as any).time) || ''}`
            : `DOWN • ${('error' in health && (health as any).error) || 'unknown'}`}
        </div>
      </section>

      <section className="rounded-xl bg-gray-50 p-4 text-sm">
        <div className="font-medium mb-2">Raw</div>
        <pre className="overflow-x-auto">{JSON.stringify(health, null, 2)}</pre>
      </section>
    </main>
  );
}
=======
import { getMeta } from '@/lib/api';

export default async function StatusPage() {
  // getMeta requires a key
  const meta = getMeta('status');

  return (
    <div className="max-w-xl px-6 space-y-3">
      <h1 className="text-xl font-semibold">Status</h1>
      <p className="opacity-70">{meta.title}</p>
      <ul className="list-disc pl-6">
        <li>Frontend: OK</li>
        <li>API: OK</li>
        <li>DB: OK</li>
      </ul>
    </div>
  );
}



>>>>>>> 2ae501b4f413143a9435e5c577312aa7dbda9955
