// src/app/settings/keys/page.tsx
import { headers } from "next/headers";

type HealthBody = { status?: unknown } & Record<string, unknown>;

export default async function KeysPage() {
  // Build absolute origin for server-side fetch
  const h = headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  const origin = `${proto}://${host}`;

  const res = await fetch(`${origin}/api/health`, { cache: "no-store" });
  const body: HealthBody = await res.json().catch(() => ({}));

  const status = typeof body.status === "string" ? body.status : "unknown";

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1>Settings � Keys</h1>
      <p>
        API health: {res.status} ({res.statusText}) � {status}
      </p>
    </main>
  );
}




