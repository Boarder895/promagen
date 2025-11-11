// Versioned localStorage helpers so future schema changes don't brick users.
// If version mismatches, readers return null and writers stamp the new version.

export type Stored<T> = { v: number; data: T };

export function readSchema<T>(key: string, expectedVersion: number): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored<T> | T;
    // Support legacy unversioned blobs: treat as mismatch
    if (parsed && typeof parsed === "object" && "v" in (parsed as any)) {
      const pack = parsed as Stored<T>;
      return pack.v === expectedVersion ? pack.data : null;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeSchema<T>(key: string, version: number, data: T): void {
  try {
    const pack: Stored<T> = { v: version, data };
    localStorage.setItem(key, JSON.stringify(pack));
  } catch {
    // ignore quota/security errors — never throw from storage
  }
}
