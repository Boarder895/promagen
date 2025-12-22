// C:\Users\Proma\Projects\promagen\frontend\src\app\go\[providerId]\route.ts

import crypto from 'node:crypto';
import kv from '@/lib/kv';
import rawProviders from '@/data/providers/providers.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ProviderRecord = {
  id: string;
  name: string;
  website: string;
  affiliateUrl: string | null;
  requiresDisclosure: boolean;
};

type ClickLogRecord = {
  clickId: string;
  providerId: string;
  providerName: string;
  isAffiliate: boolean;
  requiresDisclosure: boolean;
  src: string;
  createdAt: string;
  destinationHost: string;
  destinationPath: string;
  destinationHash: string;
  utm: {
    source: string;
    medium: string;
    campaign: string;
    content: string;
  };
};

const KV_NAMESPACE = 'affiliate_click';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normaliseProviders(value: unknown): ProviderRecord[] {
  if (!Array.isArray(value)) return [];

  const out: ProviderRecord[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;

    const id = item.id;
    const name = item.name;
    const website = item.website;
    const affiliateUrl = item.affiliateUrl;
    const requiresDisclosure = item.requiresDisclosure;

    if (!isNonEmptyString(id)) continue;
    if (!isNonEmptyString(name)) continue;
    if (!isNonEmptyString(website)) continue;
    if (typeof requiresDisclosure !== 'boolean') continue;

    const aff = affiliateUrl === null ? null : isNonEmptyString(affiliateUrl) ? affiliateUrl : null;

    out.push({
      id,
      name,
      website,
      affiliateUrl: aff,
      requiresDisclosure,
    });
  }
  return out;
}

function safeSrc(raw: string | null): string {
  const v = (raw ?? '').trim().toLowerCase();
  if (v.length === 0) return 'unknown';
  if (v.length > 48) return 'unknown';
  if (!/^[a-z0-9._-]+$/.test(v)) return 'unknown';
  return v;
}

function parseHttpsUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    return url;
  } catch {
    return null;
  }
}

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function buildOutboundUrl(args: {
  provider: ProviderRecord;
  requestUrl: URL;
  clickId: string;
  src: string;
}): { destination: URL; isAffiliate: boolean; utm: ClickLogRecord['utm'] } | null {
  const { provider, requestUrl, clickId, src } = args;

  const destinationRaw = provider.affiliateUrl ?? provider.website;
  const destination = parseHttpsUrl(destinationRaw);
  if (!destination) return null;

  // Allowlist: only allow host(s) derived from provider.website and provider.affiliateUrl.
  const allowHosts = new Set<string>();
  const websiteUrl = parseHttpsUrl(provider.website);
  if (websiteUrl) allowHosts.add(websiteUrl.hostname);
  if (provider.affiliateUrl) {
    const affiliate = parseHttpsUrl(provider.affiliateUrl);
    if (affiliate) allowHosts.add(affiliate.hostname);
  }

  if (!allowHosts.has(destination.hostname)) return null;

  const isAffiliate = provider.affiliateUrl !== null;

  const incoming = requestUrl.searchParams;

  const utmSource = incoming.get('utm_source')?.trim() || 'promagen';
  const utmMedium = incoming.get('utm_medium')?.trim() || (isAffiliate ? 'affiliate' : 'referral');
  const utmCampaign = incoming.get('utm_campaign')?.trim() || `ai_providers_${src}`;
  const utmContent = incoming.get('utm_content')?.trim() || provider.id;

  // Append click_id + UTMs without relying on cookies.
  destination.searchParams.set('click_id', clickId);
  destination.searchParams.set('utm_source', utmSource);
  destination.searchParams.set('utm_medium', utmMedium);
  destination.searchParams.set('utm_campaign', utmCampaign);
  destination.searchParams.set('utm_content', utmContent);

  return {
    destination,
    isAffiliate,
    utm: {
      source: utmSource,
      medium: utmMedium,
      campaign: utmCampaign,
      content: utmContent,
    },
  };
}

export async function GET(
  request: Request,
  context: { params: { providerId: string } },
): Promise<Response> {
  const requestUrl = new URL(request.url);
  const providerId = context.params.providerId;

  const providers = normaliseProviders(rawProviders as unknown);
  const provider = providers.find((p) => p.id === providerId);

  if (!provider) {
    return new Response('Unknown provider', {
      status: 404,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  }

  const clickId = crypto.randomUUID();
  const src = safeSrc(requestUrl.searchParams.get('src'));

  const built = buildOutboundUrl({ provider, requestUrl, clickId, src });
  if (!built) {
    return new Response('Invalid provider destination', {
      status: 400,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  }

  const destinationHash = sha256Hex(built.destination.toString());

  const logRecord: ClickLogRecord = {
    clickId,
    providerId: provider.id,
    providerName: provider.name,
    isAffiliate: built.isAffiliate,
    requiresDisclosure: provider.requiresDisclosure,
    src,
    createdAt: new Date().toISOString(),
    destinationHost: built.destination.hostname,
    destinationPath: built.destination.pathname,
    destinationHash,
    utm: built.utm,
  };

  // Best-effort logging: never block the user redirect on KV issues.
  try {
    await kv.set(KV_NAMESPACE, clickId, logRecord);
  } catch {
    // swallow
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
