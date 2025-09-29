// FRONTEND · Next.js App Router
// A simple page to showcase the API Status badge and meta summary.

import ApiStatusBadge from "@/components/ApiStatusBadge";
import { getMeta, API_BASE } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function StatusPage() {
  const meta = await getMeta();

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">System Status</h1>
        <ApiStatusBadge />
      </header>

      <section className="rounded-2xl border p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <KV label="API Base" value={API_BASE} />
        <KV label="Schema" value={(meta as any).schema} />
        <KV label="DB Provider" value={(meta as any).dbProvider} />
        <KV label="Env" value={(meta as any).env} />
        <KV label="Node" value={(meta as any).node} />
        <KV label="Generated At" value={(meta as any).generatedAt} />
      </section>

      <section className="rounded-2xl border p-4">
        <div className="text-sm opacity-70 mb-2">Raw Meta</div>
        <pre className="overflow-auto text-sm leading-6 rounded-xl border bg-black/90 text-green-200 p-4">
{JSON.stringify(meta, null, 2)}
        </pre>
      </section>

      <div className="text-sm">
        See also: <a className="underline" href="/admin/settings">Admin · Settings</a>
      </div>
    </main>
  );
}

function KV({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="text-xs opacity-70">{label}</div>
      <div className="font-mono text-sm break-all">{value ?? "—"}</div>
    </div>
  );
}
