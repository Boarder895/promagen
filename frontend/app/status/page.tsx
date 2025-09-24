// FRONTEND · NEXT.JS (APP ROUTER)
// FILE: app/status/page.tsx  — NEW
export const dynamic = "force-dynamic";

async function getHealth() {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "";
  const url = `${base.replace(/\/+$/, "")}/health`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      url,
      body: text.slice(0, 500),
    };
  } catch (err: any) {
    return { ok: false, status: 0, url, body: String(err?.message || err) };
  }
}

export default async function StatusPage() {
  const health = await getHealth();

  return (
    <main className="min-h-screen p-8 mx-auto max-w-2xl">
      <h1 className="text-3xl font-semibold mb-6">Promagen System Status</h1>

      <div className="rounded-2xl p-6 shadow border">
        <div className="flex items-center justify-between mb-4">
          <span className="text-lg">Backend API</span>
          <span
            className={`px-3 py-1 rounded-full text-sm ${
              health.ok ? "bg-green-200" : "bg-red-200"
            }`}
          >
            {health.ok ? "Healthy" : "Unreachable"}
          </span>
        </div>

        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium">URL: </span>
            <code>{health.url}</code>
          </div>
          <div>
            <span className="font-medium">HTTP: </span>
            <code>{health.status}</code>
          </div>
          <div>
            <span className="font-medium">Preview: </span>
            <pre className="whitespace-pre-wrap bg-black/5 p-3 rounded">
              {health.body || "(no body)"}
            </pre>
          </div>
        </div>
      </div>

      <p className="mt-6 text-sm opacity-70">
        This page pings the API’s <code>/health</code> endpoint on every load (no cache).
      </p>
    </main>
  );
}
