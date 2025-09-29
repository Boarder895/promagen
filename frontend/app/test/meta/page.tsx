// Server component: fetches /api/v1/meta via our helper and renders it nicely
import { getMeta, API_BASE } from "@/lib/api";

export const dynamic = "force-dynamic"; // ensure no caching in dev/prod

export default async function MetaTestPage() {
  const meta = await getMeta();

  const pretty = JSON.stringify(meta, null, 2);

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">API Meta Probe</h1>

      <section className="rounded-2xl border p-4">
        <div className="text-sm opacity-70">API Base</div>
        <div className="font-mono">{API_BASE}</div>
      </section>

      <section className="rounded-2xl border p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Chip label="Schema" value={(meta as any).schema ?? "—"} />
        <Chip label="DB Provider" value={(meta as any).dbProvider ?? "—"} />
        <Chip label="Env" value={(meta as any).env ?? "—"} />
        <Chip label="Node" value={(meta as any).node ?? "—"} />
      </section>

      <section className="rounded-2xl border p-4">
        <div className="text-sm opacity-70 mb-2">Raw JSON</div>
        <pre className="overflow-auto text-sm leading-6 rounded-xl border bg-black/90 text-green-200 p-4">
{pretty}
        </pre>
      </section>
    </main>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="text-xs opacity-70">{label}</div>
      <div className="font-mono text-sm">{value}</div>
    </div>
  );
}
