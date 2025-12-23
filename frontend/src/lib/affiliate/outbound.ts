// C:\Users\Proma\Projects\promagen\frontend\src\lib\affiliate\outbound.ts

/**
 * Outbound linking rules (Authority):
 * - UI must NEVER link directly to provider domains.
 * - All outbound must route through: /go/{providerId}?src=<surface>
 * - Keep src short, predictable, and non-exploitable.
 *
 * This module is the single “safe door” for constructing outbound hrefs.
 */

export type OutboundQueryValue = string | number | boolean | null | undefined;
export type OutboundQuery = Record<string, OutboundQueryValue>;

const SRC_MAX_LEN = 48;
const SRC_PATTERN = /^[a-z0-9._-]+$/;

/**
 * Normalises and validates the surface identifier.
 * - If invalid, falls back to "unknown".
 */
export function normaliseSrc(raw: string): string {
  const v = (raw ?? '').trim().toLowerCase();
  if (v.length === 0) return 'unknown';
  if (v.length > SRC_MAX_LEN) return 'unknown';
  if (!SRC_PATTERN.test(v)) return 'unknown';
  return v;
}

/**
 * Normalises providerId for use in a URL path segment.
 * - Must be non-empty.
 * - Encoded as a path segment, not a query value.
 */
export function encodeProviderId(providerId: string): string {
  const id = (providerId ?? '').trim();
  if (id.length === 0) {
    // Fail loudly in dev to catch wiring errors early; safe fallback in production.
    if (process.env.NODE_ENV !== 'production') {
      throw new Error('buildGoHref: providerId is required');
    }
    return 'unknown';
  }
  return encodeURIComponent(id);
}

/**
 * Builds a /go/{providerId}?src=... href.
 * Overload supports additional query params (e.g. utm_* passthroughs if you decide to allow them).
 *
 * NOTE: By design this function does NOT accept external URLs.
 */
export function buildGoHref(providerId: string, src: string): string;
export function buildGoHref(providerId: string, src: string, extra: OutboundQuery): string;
export function buildGoHref(providerId: string, src: string, extra?: OutboundQuery): string {
  const safeProviderId = encodeProviderId(providerId);
  const safeSrc = normaliseSrc(src);

  const params = new URLSearchParams();
  params.set('src', safeSrc);

  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value === undefined || value === null) continue;
      const k = (key ?? '').trim();
      if (!k) continue;

      // Keep keys sane; avoid allowing weird injection via query keys.
      if (!/^[a-zA-Z0-9._-]+$/.test(k)) continue;

      params.set(k, String(value));
    }
  }

  return `/go/${safeProviderId}?${params.toString()}`;
}
