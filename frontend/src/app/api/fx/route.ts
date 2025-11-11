/**
 * /api/fx — aggregate FX payload with guards and provenance.
 * Shape: { ok, quotes: Quote[], nextUpdateAt, buildId?, mode }
 */

type Quote = { id: string; value: number; prevClose: number };

function buildId(): string | undefined {
  return process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_BUILD_ID || undefined;
}

export async function GET(): Promise<Response> {
  // Wire real data later; keep stable shape now.
  const quotes: Quote[] = [];
  const nextUpdateAt = new Date(Date.now() + 60_000).toISOString();

  const body = {
    ok: true,
    quotes,
    nextUpdateAt,
    buildId: buildId(),
    mode: "demo" as const, // DOM-stable indicator for the client
  };

  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
