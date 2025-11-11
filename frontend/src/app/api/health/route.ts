/**
 * Health endpoint – simple and auditable (no re-exports).
 * Adds cheap observability via x-runtime-ms and a provenance footer.
 */

export async function GET(): Promise<Response> {
  const started = performance.now();
  const body = {
    ok: true,
    service: "promagen-frontend",
    ts: new Date().toISOString(),
    provenance: "frontend/src/app/api/health/route.ts#GET",
    errorBudgetNote: "Keep A11y=100; SEO/Perf>=95; ribbon JS chunk within budget.",
  };

  const res = new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });

  const ms = Math.max(0, Math.round(performance.now() - started));
  res.headers.set("x-runtime-ms", String(ms));
  return res;
}
