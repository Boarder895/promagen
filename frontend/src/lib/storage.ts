/**
 * Versioned, schema-aware localStorage helpers with size guard.
 * No shims; no silent type casts beyond a narrow runtime check.
 */

export type Stored<T> = { v: number; data: T };

const MAX_BYTES = 10 * 1024; // 10KB per item to keep under browser budgets

function safeJsonParse<T>(raw: string | null): T | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function byteLength(str: string): number {
  // UTF-16 surrogate pair safe rough size
  return new TextEncoder().encode(str).length;
}

/** Read a versioned payload or return the provided fallback. */
export function readSchema<T>(key: string, v: number, fallback: T): T {
  try {
    const parsed = safeJsonParse<Stored<T>>(localStorage.getItem(key));
    if (!parsed || typeof parsed !== "object" || parsed.v !== v) return fallback;
    return parsed.data;
  } catch {
    return fallback;
  }
}

/** Write a versioned payload, enforcing a size limit. */
export function writeSchema<T>(key: string, v: number, data: T): void {
  try {
    const payload: Stored<T> = { v, data };
    const raw = JSON.stringify(payload);
    if (byteLength(raw) > MAX_BYTES) {
      // Refuse overly large writes to avoid exhausting quotas.
      return;
    }
    localStorage.setItem(key, raw);
  } catch {
    // Ignore quota/availability errors (private mode etc.)
  }
}
