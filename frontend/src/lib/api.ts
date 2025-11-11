// Tiny API helpers used by health/meta/test pages.

export const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.promagen.com';
const API_BASE = API;
export default API_BASE;

export async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {throw new Error(`fetchJSON ${res.status}`);}
  return (await res.json()) as T;
}

// Some pages call getMeta('key'); make the key optional.
export type Meta = { title?: string; description?: string };
export function getMeta(key?: string): Meta {
  return key
    ? { title: key.split('/').pop() || 'Promagen', description: 'Stub meta' }
    : { title: 'Promagen', description: 'Stub meta' };
}








