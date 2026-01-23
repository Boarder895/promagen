// frontend/src/app/api/indices/route.ts
/**
 * /api/indices — Secure frontend proxy to the Fly gateway Indices feed.
 *
 * Security goals (10/10):
 * - NEVER accept tier or exchangeIds from the browser (no query params, no POST body from client).
 * - Paid selection is derived server-side from Clerk publicMetadata:
 *     publicMetadata.tier === 'paid'
 *     publicMetadata.exchangeSelection.exchangeIds: string[]
 * - Server-to-server POST to Fly gateway uses x-promagen-gateway-secret.
 * - Strict validation: preserve order, dedupe, reject unknown IDs with 400.
 * - Caching:
 *     - Free/anonymous: public caching OK (cookie-free callers).
 *     - Paid: private, no-store (user-specific).
 *
 * Updated: 22 Jan 2026 - Added comprehensive try-catch error handling
 *                      - Proper status codes for different failure modes
 *                      - Server-side logging for debugging
 */

import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { z } from 'zod';

import exchangesCatalogJson from '@/data/exchanges/exchanges.catalog.json';

// ---------------------------------------------------------------------------
// ENV + CONSTANTS
// ---------------------------------------------------------------------------

export const runtime = 'nodejs';

const DEFAULT_GATEWAY_BASE_URL = 'https://promagen-api.fly.dev';

function getGatewayBaseUrl(): string {
  const raw =
    process.env['PROMAGEN_GATEWAY_URL'] ??
    process.env['PROMAGEN_API_URL'] ??
    process.env['NEXT_PUBLIC_PROMAGEN_GATEWAY_URL'] ??
    process.env['NEXT_PUBLIC_PROMAGEN_API_URL'] ??
    DEFAULT_GATEWAY_BASE_URL;

  return raw.replace(/\/+$/, '');
}

function getGatewaySecret(): string {
  return process.env['PROMAGEN_GATEWAY_SECRET'] ?? '';
}

const INDICES_MIN = 6;
const INDICES_MAX = 16;
const EXCHANGE_ID_RE = /^[a-z0-9-]{3,30}$/;

const PublicMetadataSchema = z
  .object({
    tier: z.enum(['free', 'paid']).optional(),
    exchangeSelection: z
      .object({
        exchangeIds: z.array(z.string()).optional(),
        updatedAt: z.string().optional(),
      })
      .optional(),
  })
  .passthrough();

const ExchangeCatalogItemSchema = z
  .object({
    id: z.string().min(1),
  })
  .passthrough();

const ExchangesCatalogSchema = z.array(ExchangeCatalogItemSchema);

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function normaliseAndValidateExchangeIds(
  input: unknown,
  allowedIds: Set<string>,
): { ok: true; value: string[] } | { ok: false; error: string; errors?: string[] } {
  if (!Array.isArray(input)) {
    return { ok: false, error: 'exchangeIds must be an array' };
  }

  // Normalise + dedupe while preserving order.
  const out: string[] = [];
  const seen = new Set<string>();

  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    const id = raw.toLowerCase().trim();
    if (!id) continue;
    if (id.length > 30) continue;

    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }

  const errs: string[] = [];

  if (out.length < INDICES_MIN) {
    errs.push(`Minimum ${INDICES_MIN} exchanges required, got ${out.length}`);
  }
  if (out.length > INDICES_MAX) {
    errs.push(`Maximum ${INDICES_MAX} exchanges allowed, got ${out.length}`);
  }

  const invalidFormat: string[] = [];
  const unknownIds: string[] = [];

  for (const id of out) {
    if (!EXCHANGE_ID_RE.test(id)) invalidFormat.push(id);
    else if (!allowedIds.has(id)) unknownIds.push(id);
  }

  if (invalidFormat.length) {
    errs.push(
      `Invalid exchange ID format: ${invalidFormat.slice(0, 5).join(', ')}${
        invalidFormat.length > 5 ? '...' : ''
      }`,
    );
  }

  if (unknownIds.length) {
    errs.push(
      `Unknown exchange IDs: ${unknownIds.slice(0, 5).join(', ')}${
        unknownIds.length > 5 ? '...' : ''
      }`,
    );
  }

  if (errs.length) {
    return { ok: false, error: 'Validation failed', errors: errs };
  }

  return { ok: true, value: out.slice(0, INDICES_MAX) };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

async function proxyGatewayJson(
  url: string,
  init: RequestInit,
): Promise<{ status: number; json: unknown; rawText?: string }> {
  const res = await fetchWithTimeout(url, init, 10_000);

  // We intentionally parse as text first to avoid throwing on invalid JSON.
  const text = await res.text().catch(() => '');
  const json = (() => {
    try {
      return text ? JSON.parse(text) : null;
    } catch {
      return null;
    }
  })();

  return {
    status: res.status,
    json: json ?? { error: 'Upstream returned non-JSON', body: text },
    rawText: text,
  };
}

// ---------------------------------------------------------------------------
// ERROR RESPONSE HELPERS
// ---------------------------------------------------------------------------

function errorResponse(
  status: number,
  message: string,
  details?: Record<string, unknown>,
): Response {
  return NextResponse.json(
    {
      error: message,
      ...details,
      timestamp: new Date().toISOString(),
    },
    {
      status,
      headers: { 'Cache-Control': 'private, no-store' },
    },
  );
}

// ---------------------------------------------------------------------------
// ROUTE
// ---------------------------------------------------------------------------

export async function GET(): Promise<Response> {
  try {
    // Allowed IDs come from SSOT catalog.
    let catalog: z.infer<typeof ExchangesCatalogSchema>;
    try {
      catalog = ExchangesCatalogSchema.parse(exchangesCatalogJson);
    } catch (catalogError) {
      console.error('[/api/indices] Catalog parse error:', catalogError);
      return errorResponse(500, 'Server configuration error: invalid exchange catalog');
    }

    const allowedIds = new Set(catalog.map((c) => c.id.toLowerCase().trim()));

    const gatewayBase = getGatewayBaseUrl();
    const gatewayIndicesUrl = `${gatewayBase}/indices`;

    // Determine user (if any)
    let user: Awaited<ReturnType<typeof currentUser>> = null;
    try {
      user = await currentUser();
    } catch (authError) {
      // Clerk unavailable — treat as anonymous (free path)
      console.warn('[/api/indices] Clerk auth check failed, treating as anonymous:', authError);
      // Continue with user = null (free path)
    }

    // Anonymous users: always free path, public caching.
    if (!user) {
      try {
        const upstream = await proxyGatewayJson(gatewayIndicesUrl, {
          method: 'GET',
          headers: { accept: 'application/json' },
        });

        return NextResponse.json(upstream.json, {
          status: upstream.status,
          headers: {
            // Mirror gateway semantics for free feed (public caching).
            'Cache-Control': 'public, max-age=120, stale-while-revalidate=600',
          },
        });
      } catch (fetchError) {
        // Handle fetch errors (timeout, network issues)
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          console.error('[/api/indices] Gateway timeout (anonymous)');
          return errorResponse(504, 'Gateway timeout');
        }
        console.error('[/api/indices] Gateway fetch error (anonymous):', fetchError);
        return errorResponse(502, 'Gateway unavailable');
      }
    }

    // Signed-in user: tier derived server-side from Clerk metadata.
    let md: z.infer<typeof PublicMetadataSchema>;
    try {
      md = PublicMetadataSchema.parse((user.publicMetadata ?? {}) as unknown);
    } catch (metadataError) {
      console.error('[/api/indices] User metadata parse error:', metadataError);
      // Treat as free user if metadata is malformed
      md = { tier: 'free' };
    }

    const tier = md.tier === 'paid' ? 'paid' : 'free';

    // Free signed-in users still use gateway GET.
    // We keep this private to avoid any cookie-based shared caching surprises.
    if (tier !== 'paid') {
      try {
        const upstream = await proxyGatewayJson(gatewayIndicesUrl, {
          method: 'GET',
          headers: { accept: 'application/json' },
        });

        return NextResponse.json(upstream.json, {
          status: upstream.status,
          headers: {
            'Cache-Control': 'private, no-store',
          },
        });
      } catch (fetchError) {
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          console.error('[/api/indices] Gateway timeout (free user)');
          return errorResponse(504, 'Gateway timeout');
        }
        console.error('[/api/indices] Gateway fetch error (free user):', fetchError);
        return errorResponse(502, 'Gateway unavailable');
      }
    }

    // Paid users: selection comes ONLY from Clerk metadata.
    const exchangeIdsRaw = md.exchangeSelection?.exchangeIds;

    if (!exchangeIdsRaw || !Array.isArray(exchangeIdsRaw) || exchangeIdsRaw.length === 0) {
      return NextResponse.json(
        {
          error: 'Paid user has no exchange selection configured',
          hint: 'Set publicMetadata.exchangeSelection.exchangeIds in Clerk for this user.',
        },
        { status: 400, headers: { 'Cache-Control': 'private, no-store' } },
      );
    }

    const validated = normaliseAndValidateExchangeIds(exchangeIdsRaw, allowedIds);
    if (!validated.ok) {
      return NextResponse.json(
        { error: validated.error, errors: validated.errors ?? [] },
        { status: 400, headers: { 'Cache-Control': 'private, no-store' } },
      );
    }

    const secret = getGatewaySecret();
    if (!secret) {
      console.error('[/api/indices] PROMAGEN_GATEWAY_SECRET is not set');
      return NextResponse.json(
        { error: 'Server misconfiguration: PROMAGEN_GATEWAY_SECRET is not set' },
        { status: 500, headers: { 'Cache-Control': 'private, no-store' } },
      );
    }

    // Server-to-server POST to gateway (secret header).
    try {
      const upstream = await proxyGatewayJson(gatewayIndicesUrl, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-promagen-gateway-secret': secret,
        },
        body: JSON.stringify({
          tier: 'paid',
          exchangeIds: validated.value,
        }),
      });

      return NextResponse.json(upstream.json, {
        status: upstream.status,
        headers: {
          // User-specific: never cache in shared/CDN caches.
          'Cache-Control': 'private, no-store',
          Vary: 'Cookie',
        },
      });
    } catch (fetchError) {
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error('[/api/indices] Gateway timeout (paid user)');
        return errorResponse(504, 'Gateway timeout');
      }
      console.error('[/api/indices] Gateway fetch error (paid user):', fetchError);
      return errorResponse(502, 'Gateway unavailable');
    }
  } catch (unexpectedError) {
    // Catch-all for any unexpected errors
    console.error('[/api/indices] Unexpected error:', unexpectedError);
    return errorResponse(500, 'Internal server error');
  }
}

// Hard-disable POST from the browser.
// Paid selection is server-derived; client POST would be an escalation path.
export async function POST(): Promise<Response> {
  return NextResponse.json(
    { error: 'Method not allowed. Use GET. Selection is derived server-side.' },
    { status: 405 },
  );
}
