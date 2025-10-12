// frontend/lib/crypto.ts
// Zero-dependency helpers that work in Node/Edge/Browser.
// Named exports only.

function toUInt32(x: number): number {
  return x >>> 0;
}

/** FNV-1a 32-bit hash — simple, fast, deterministic across runtimes. */
export function fnv1a32(input: string): string {
  let h = 0x811c9dc5; // offset basis
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    // 32-bit multiply by 16777619
    h = toUInt32(h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)));
  }
  return ('00000000' + h.toString(16)).slice(-8);
}

/** Stable provider hash from id + salt. */
export function hashProvider(providerId: string, salt: string): string {
  return fnv1a32(`prov:${salt}:${providerId}`);
}

/**
 * Generate a short, URL-safe-ish id from providerId+salt.
 * Example: uidFrom("openai","prod",10) -> "a1b2c3d4e5"
 */
export function uidFrom(providerId: string, salt: string, length = 12): string {
  const hex = hashProvider(providerId, salt);
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
  let out = '';
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.slice(i, i + 2), 16);
    out += alphabet[(byte >> 3) & 31] + alphabet[byte & 31];
  }
  return out.slice(0, Math.max(1, length));
}

/** Mask a key for logs/UX (keep start/end visible). */
export function maskKey(key: string, visible = 4): string {
  if (!key) return '';
  const v = Math.max(1, visible);
  if (key.length <= v * 2) return key;
  return `${key.slice(0, v)}••••${key.slice(-v)}`;
}

/**
 * Retrieve a usable API key. Prefers the DB value if present; otherwise uses env.
 * Pass-through fallback (does not decrypt). Extend later if you store encrypted keys.
 */
export type GetKeyArgs = { db?: string | null; env?: string | null };

export function getDecryptedKey(
  dbOrArgs?: string | GetKeyArgs | null,
  envMaybe?: string | null,
): string | null {
  if (dbOrArgs && typeof dbOrArgs === 'object') {
    const db = (dbOrArgs.db ?? '').trim();
    if (db) return db;
    const env = (dbOrArgs.env ?? '').trim();
    return env || null;
  }
  const db = ((dbOrArgs as string | null) ?? '').toString().trim();
  if (db) return db;
  const env = (envMaybe ?? '').toString().trim();
  return env || null;
}
