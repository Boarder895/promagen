// FRONTEND · Next.js App Router
// Admin Settings page that shows live meta (incl. HMAC) and a Download CSV button.

import { getMeta, API_BASE } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const meta = await getMeta();
  const hmac =
    (meta as any)?.hmac === true ||
    (meta as any)?.hasHmac === true ||
    (meta as any)?.hmacEnabled === true;

  const csvUrl = `${API_BASE}/api/v1/audit/latest.csv`;

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin · Settings</h1>
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm border ${
            hmac ? "bg-green-50 border-green-300" : "bg-amber-50 border-amber-300"
          }`}
          title="HMAC enabled status from API meta"
        >
          <span
            className="h-2 w-2 rounded-full bg-current"
            style={{ color: hmac ? "#16a34a" : "#d97706" }}
          />
          HMAC {hmac ? "enabled" : "disabled"}
        </span>
      </header>

      <section className="rounded-2xl border p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <KV label="Schema" value={(meta as any).schema} />
        <KV label="DB Provider" value={(meta as any).dbProvider} />
        <KV label="Env" value={(meta as any).env} />
        <KV label="Node" value={(meta as any).node} />
        <KV label="API Base" value={API_BASE} />
        <KV label="Generated At" value={(meta as any).generatedAt} />
      </section>

      <section className="rounded-2xl border p-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm opacity-70">Latest Audit (from /api/v1/meta)</div>
          <pre className="mt-2 text-xs leading-6 bg-black/90 text-green-200 rounded-lg p-3 overflow-auto max-h-64">
{JSON.stringify((meta as any).latestAudit ?? null, null, 2)}
          </pre>
        </div>
        <a
          href={csvUrl}
          className="shrink-0 rounded-xl border px-4 py-2 hover:bg-gray-50"
        >
          Download CSV
        </a>
      </section>
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
