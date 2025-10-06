// @/lib/memory.ts
// Safe, tiny localStorage helpers. No-ops on server or when storage is blocked.

function canUseStorage(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const k = '__probe__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export function loadBool(key: string, fallback = false): boolean {
  if (!canUseStorage()) return fallback;
  try {
    const v = window.localStorage.getItem(key);
    return v === '1' ? true : v === '0' ? false : fallback;
  } catch {
    return fallback;
  }
}

export function saveBool(key: string, value: boolean): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(key, value ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function loadJSON<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJSON<T>(key: string, value: T): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
