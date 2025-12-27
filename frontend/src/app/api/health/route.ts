// Simple health endpoint aligned to Promagen standards.
// - No PII, no secrets.
// - Fast JSON, cache disabled, CORS open for GET.

import { NextResponse } from 'next/server';

import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

function getRequestId(req: Request): string {
  const id = req.headers.get('x-vercel-id')?.trim();
  if (id && id.length > 0) return id;
  try {
    return crypto.randomUUID();
  } catch {
    return `rid_${Date.now()}`;
  }
}

function getBuildId(): string | undefined {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  if (sha && sha.length > 0) return sha;
  const deployment = process.env.VERCEL_DEPLOYMENT_ID?.trim();
  if (deployment && deployment.length > 0) return deployment;
  return undefined;
}

function headers(extra?: Record<string, string>) {
  return {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store, no-cache, must-revalidate',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, OPTIONS',
    'x-robots-tag': 'noindex, nofollow',
    ...(extra ?? {}),
  };
}

export async function GET(req: Request) {
  const requestId = getRequestId(req);

  const payload = {
    ok: true,
    service: 'promagen-frontend',
    nodeEnv: env.nodeEnv,
    vercelEnv: process.env.VERCEL_ENV ?? undefined,
    region: process.env.VERCEL_REGION ?? undefined,
    buildId: getBuildId(),
    safeMode: {
      enabled: env.safeMode.enabled,
    },
    asOf: new Date().toISOString(),
  };

  return new NextResponse(JSON.stringify(payload), {
    status: 200,
    headers: headers({
      'x-promagen-request-id': requestId,
      'x-promagen-safe-mode': env.safeMode.enabled ? '1' : '0',
    }),
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: headers() });
}
