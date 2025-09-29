// app/admin/page.tsx
// Admin index with quick links and live health context.

import Link from "next/link";
import { getMeta } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function AdminIndexPage() {
  const meta = await getMeta();

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">Admin</h1>

      <section className="rounded-2xl border p-4">
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <Link className="underline" href="/admin/settings">
              Settings (HMAC · Meta · Download CSV)
            </Link>
          </li>
          <li>
            <Link className="underline" href="/admin/jobs">
              Jobs (recent)
            </Link>
          </li>
          <li>
            <Link className="underline" href="/status">
              System Status (API health + meta)
            </Link>
          </li>
          {/* Future: audits table, leaderboard controls, provider overrides */}
        </ul>
      </section>

      <section className="rounded-2xl border p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <KV label="Schema" value={(meta as any).schema} />
        <KV label="DB Provider" value={(meta as any).dbProvider} />
        <KV label="Env" value={(meta as any).env} />
        <KV label="Node" value={(meta as any).node} />
        <KV label="Generated At" value={(meta as any).generatedAt} />
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
