import TrendingTable from '@/components/ux/trending-table';
import { pasteHints } from '@/data/paste-hints';

export const dynamic = 'force-dynamic';

export default function BridgeFallbackPage() {
  // Make the tuple type explicit so children is a string, not unknown.
  const entries = Object.entries(pasteHints) as [string, string][];

  return (
    <main className="px-6 py-8 grid grid-cols-12 gap-6">
      <section className="col-span-7">
        <h1 className="text-xl font-semibold mb-4">Bridge Fallback</h1>
        <p className="text-slate-600 mb-6">
          The embedded view was blocked. Copy your prompt and continue on the provider’s site.
        </p>

        <div className="grid grid-cols-2 gap-4">
          {entries.map(([id, hint]) => (
            <div key={id} className="rounded-2xl border border-slate-200 p-4 bg-white shadow-sm">
              <div className="text-sm font-semibold mb-1">{id}</div>
              <p className="text-sm text-slate-600">{hint}</p>
            </div>
          ))}
        </div>
      </section>

      <aside className="col-span-5">
        <TrendingTable />
      </aside>
    </main>
  );
}

