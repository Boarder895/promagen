// frontend/src/lib/storage.ts
const NS = "promagen";

const k = (s: string) => `${NS}:${s}`;

export function saveLocal<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(k(key), JSON.stringify(value));
  } catch {
    // no-op
  }
}

export function loadLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(k(key));
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}



