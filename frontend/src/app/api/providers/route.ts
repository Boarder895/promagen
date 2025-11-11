/**
 * /api/providers — stable payload with provenance.
 * No re-exports; local handler; cache disabled for freshness.
 */

type Provider = { id: string; name: string; url?: string; score?: number; trend?: "up" | "down" | "flat" };

function loadProviders(): Provider[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const data = require("@/data/providers.json") as Provider[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function buildId(): string | undefined {
  return process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_BUILD_ID || undefined;
}

export async function GET(): Promise<Response> {
  const providers = loadProviders();
  const body = {
    ok: true,
    count: providers.length,
    providers,
    ts: new Date().toISOString(),
    buildId: buildId(),
    mode: "live" as const,
  };

  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
