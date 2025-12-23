// C:\Users\Proma\Projects\promagen\frontend\src\app\go\[providerId]\route.ts

import crypto from 'node:crypto';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

import kv, { type Json } from '@/lib/kv';
import rawProviders from '@/data/providers/providers.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Authority rules (summary):
 * - UI must never link directly to external provider URLs.
 * - All outbound links MUST go through: /go/{providerId}?src=<surface>
 * - /go prefers affiliateUrl when present.
 * - /go appends click_id + UTMs to destination (cookie-free).
 * - /go writes KV log keyed by the exact click_id used in the redirect.
 * - /go must not set cookies; must be no-store.
 */

const KV_NAMESPACE = 'affiliate_click';

/** Conservative allowlist for src surface identifiers (short, predictable, non-exploitable). */
function safeSrc(raw: string | null): string {
  const v = (raw ?? '').trim().toLowerCase();
  if (v.length === 0) return 'unknown';
  if (v.length > 48) return 'unknown';
  if (!/^[a-z0-9._-]+$/.test(v)) return 'unknown';
  return v;
}

function safeUtm(raw: string | null, fallback: string): string {
  const v = (raw ?? '').trim();
  if (v.length === 0) return fallback;
  if (v.length > 80) return fallback;
  if (!/^[a-zA-Z0-9._\- ]+$/.test(v)) return fallback;
  return v;
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isHttps(url: URL): boolean {
  return url.protocol === 'https:';
}

function getCountryFromHeaders(headers: Headers): string | null {
  // Common geo headers (Vercel, Cloudflare, generic proxies)
  const candidates = [
    headers.get('x-vercel-ip-country'),
    headers.get('cf-ipcountry'),
    headers.get('x-geo-country'),
    headers.get('x-country'),
  ]
    .map((v) => (v ?? '').trim().toUpperCase())
    .filter(Boolean);

  for (const c of candidates) {
    // Cloudflare sometimes uses "T1" for Tor; treat as unknown.
    if (/^[A-Z]{2}$/.test(c) && c !== 'T1' && c !== 'XX') return c;
  }
  return null;
}

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

const AffiliateSchema = z
  .object({
    enabled: z.boolean().optional(),
    programme: z.string().min(1).optional(),
    // Optional: per-program sub-id parameter name (defaults to click_id).
    subIdParam: z.string().min(1).max(32).optional(),
    // Optional hard allowlist (if you ever want to hard-pin hosts)
    allowlistHosts: z.array(z.string().min(1)).optional(),
  })
  .optional();

const ProviderRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  website: z.string().min(1),
  affiliateUrl: z.string().nullable().optional(),
  requiresDisclosure: z.boolean().optional(),
  affiliate: AffiliateSchema,
});

type ProviderRecord = z.infer<typeof ProviderRecordSchema>;

let providersCache: ProviderRecord[] | null = null;

function getProviders(): ProviderRecord[] {
  if (providersCache) return providersCache;

  const arr = z.array(ProviderRecordSchema).parse(rawProviders);

  // Normalise and keep only what we need for outbound.
  providersCache = arr.map((p) => ({
    id: p.id,
    name: p.name,
    website: p.website,
    affiliateUrl: p.affiliateUrl ?? null,
    requiresDisclosure: p.requiresDisclosure ?? false,
    affiliate: p.affiliate,
  }));

  return providersCache;
}

function findProvider(providerId: string): ProviderRecord | null {
  const providers = getProviders();
  return providers.find((p) => p.id === providerId) ?? null;
}

function pickDestination(
  provider: ProviderRecord,
): { url: URL; isAffiliate: boolean; subIdParam: string } | null {
  const affiliateEnabled = provider.affiliate?.enabled ?? true; // backwards compatible: if no object, treat as enabled when affiliateUrl exists
  const subIdParam = provider.affiliate?.subIdParam?.trim() || 'click_id';

  const primary = provider.website;
  const affiliate = provider.affiliateUrl ?? null;

  // Prefer affiliateUrl when present AND enabled.
  const chosen = affiliate && affiliateEnabled ? affiliate : primary;

  const url = parseUrl(chosen);
  if (!url) return null;

  // Security + privacy: only allow https outbound.
  if (!isHttps(url)) return null;

  // Optional hard allowlist (only enforced if present)
  const allowlist = provider.affiliate?.allowlistHosts;
  if (Array.isArray(allowlist) && allowlist.length > 0) {
    const host = url.hostname.toLowerCase();
    const ok = allowlist.some((h) => h.toLowerCase() === host);
    if (!ok) return null;
  }

  return {
    url,
    isAffiliate: Boolean(affiliate && affiliateEnabled),
    subIdParam,
  };
}

function buildDestination(
  requestUrl: URL,
  provider: ProviderRecord,
  src: string,
): {
  destination: URL;
  clickId: string;
  isAffiliate: boolean;
  utm: { source: string; medium: string; campaign: string; content: string };
} | null {
  const picked = pickDestination(provider);
  if (!picked) return null;

  const clickId = crypto.randomUUID();

  const incoming = requestUrl.searchParams;

  const utmSource = safeUtm(incoming.get('utm_source'), 'promagen');
  const utmMedium = safeUtm(
    incoming.get('utm_medium'),
    picked.isAffiliate ? 'affiliate' : 'referral',
  );
  const utmCampaign = safeUtm(incoming.get('utm_campaign'), `ai_providers_${src}`);
  const utmContent = safeUtm(incoming.get('utm_content'), provider.id);

  // Append click_id + UTMs without relying on cookies.
  // Use provider-configured subIdParam when available, defaulting to click_id.
  picked.url.searchParams.set(picked.subIdParam, clickId);
  picked.url.searchParams.set('click_id', clickId); // always include canonical key too
  picked.url.searchParams.set('utm_source', utmSource);
  picked.url.searchParams.set('utm_medium', utmMedium);
  picked.url.searchParams.set('utm_campaign', utmCampaign);
  picked.url.searchParams.set('utm_content', utmContent);

  return {
    destination: picked.url,
    clickId,
    isAffiliate: picked.isAffiliate,
    utm: {
      source: utmSource,
      medium: utmMedium,
      campaign: utmCampaign,
      content: utmContent,
    },
  };
}

export async function GET(
  request: NextRequest,
  context: { params: { providerId: string } },
): Promise<Response> {
  const providerId = (context?.params?.providerId ?? '').trim();
  const provider = providerId ? findProvider(providerId) : null;

  if (!provider) {
    return new Response('Not found', {
      status: 404,
      headers: {
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }

  const requestUrl = new URL(request.url);
  const src = safeSrc(requestUrl.searchParams.get('src'));

  const built = buildDestination(requestUrl, provider, src);
  if (!built) {
    // Provider exists but outbound destination is misconfigured or insecure.
    return new Response('Invalid provider destination', {
      status: 400,
      headers: {
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }

  const destinationHash = sha256Hex(built.destination.toString());
  const country = getCountryFromHeaders(request.headers);

  // Best-effort logging: never block the user redirect on KV issues.
  // KV record is keyed by the exact click_id used in the redirect (non-negotiable).
  const logRecord: Json = {
    clickId: built.clickId,
    providerId: provider.id,
    providerName: provider.name,
    isAffiliate: built.isAffiliate,
    // Json forbids `undefined`; keep intent by persisting null when absent.
    requiresDisclosure: provider.requiresDisclosure ?? null,
    src,
    createdAt: new Date().toISOString(),
    country, // ISO-3166 alpha-2 when available; null otherwise
    destinationHost: built.destination.hostname,
    destinationPath: built.destination.pathname,
    destinationHash,
    utm: built.utm,
  };

  try {
    await kv.set(KV_NAMESPACE, built.clickId, logRecord);
  } catch {
    // Swallow KV failures; redirect must still succeed.
  }

  // IMPORTANT: Response.redirect(...) can yield an immutable Headers guard at runtime.
  // Construct the redirect response with headers set up-front (no post-creation mutation).
  return new Response(null, {
    status: 302,
    headers: {
      Location: built.destination.toString(),
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
