// C:\Users\Proma\Projects\promagen\frontend\src\lib\affiliate\outbound.ts

/**
 * Outbound linking rules (Authority):
 * - UI must NEVER link directly to provider domains.
 * - All outbound must route through: /go/{providerId}?src=<surface>[&sid=<sessionId>]
 * - Keep src short, predictable, and non-exploitable.
 *
 * This module is the single “safe door” for constructing outbound hrefs.
 *
 * sessionId notes:
 * - sessionId is anonymous, client-generated, and non-identifying.
 * - We only attach sid when running in the browser and storage is available.
 * - Server-rendered hrefs may not include sid; capture still works (but dedupe improves when sid is present).
 */

export type OutboundQueryValue = string | number | boolean | null | undefined;
export type OutboundQuery = Record<string, OutboundQueryValue>;

const SRC_MAX_LEN = 48;
const SRC_PATTERN = /^[a-z0-9._-]+$/;

const SID_STORAGE_KEY = 'promagen.sid.v1';
const SID_MIN_LEN = 8;
const SID_MAX_LEN = 96;
const SID_PATTERN = /^[a-zA-Z0-9_-]+$/;

function isBrowser(): boolean {
  // Contract: only attach `sid` in a real browser.
  // - Never attach during tests (Jest/jsdom) or server renders.
  // - Avoid relying on `window` presence alone (jsdom provides it).
  if (typeof process !== 'undefined') {
    if (process.env.NODE_ENV === 'test') return false;
    if (process.env.JEST_WORKER_ID) return false;
  }

  if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) return false;

  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function safeReadLocalStorage(key: string): string | null {
  if (!isBrowser()) return null;

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWriteLocalStorage(key: string, value: string): void {
  if (!isBrowser()) return;

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore: storage may be blocked/disabled.
  }
}

function randomId(): string {
  // Prefer crypto.randomUUID where available.
  if (isBrowser() && typeof window !== 'undefined' && typeof window.crypto !== 'undefined') {
    const crypto = window.crypto;

    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID().replace(/-/g, '_');
    }

    // Fallback: random bytes → base64url-ish string
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    // btoa → base64, then make it URL safe
    const b64 = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    return b64;
  }

  // Very last resort (should be rare in modern browsers)
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function normaliseSid(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim();
  if (v.length < SID_MIN_LEN || v.length > SID_MAX_LEN) return null;
  if (!SID_PATTERN.test(v)) return null;
  return v;
}

/**
 * Returns the current client sessionId (if available).
 * Does NOT create one.
 */
export function getClientSessionId(): string | null {
  const existing = safeReadLocalStorage(SID_STORAGE_KEY);
  return normaliseSid(existing);
}

/**
 * Creates and persists a client sessionId if one does not already exist.
 * Returns null if storage is unavailable.
 */
export function getOrCreateClientSessionId(): string | null {
  if (!isBrowser()) return null;

  const existing = getClientSessionId();
  if (existing) return existing;

  const created = normaliseSid(randomId());
  if (!created) return null;

  safeWriteLocalStorage(SID_STORAGE_KEY, created);

  // Only return a sid if it actually persisted.
  // If storage is blocked/disabled, we prefer `null` to avoid emitting an
  // ephemeral sid that breaks caching and contract tests.
  return getClientSessionId();
}

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
    // Next replaces process.env.NODE_ENV at build time; this is safe in shared modules.
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
 * By default, when running in the browser, we attach `sid` (anonymous sessionId) unless the caller
 * explicitly provides `sid` in extra.
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

  // Attach sid by default in browser if not provided explicitly.
  const explicitSid = normaliseSid(extra?.sid as string | undefined);
  const sid = explicitSid ?? getOrCreateClientSessionId();
  if (sid) params.set('sid', sid);

  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value === undefined || value === null) continue;

      const k = (key ?? '').trim();
      if (!k) continue;

      // Keep keys sane; avoid allowing weird injection via query keys.
      if (!/^[a-zA-Z0-9._-]+$/.test(k)) continue;

      // Prevent callers from overriding src silently.
      if (k === 'src') continue;

      // sid is handled above (validated + normalised). If caller provided invalid sid, we ignore it.
      if (k === 'sid') continue;

      params.set(k, String(value));
    }
  }

  return `/go/${safeProviderId}?${params.toString()}`;
}
