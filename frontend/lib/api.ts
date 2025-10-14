// Minimal API helpers for health-check and docs pages.

export const API = {
  baseUrl: process.env.NEXT_PUBLIC_API_URL || 'https://api.promagen.com',
};

// Generic JSON fetcher (stubbed; safe default)
export async function fetchJSON<T = any>(input: string, init?: RequestInit): Promise<T> {
  // In real code, you’d call fetch(`${API.baseUrl}${input}`, init) and parse JSON.
  // For build-unblock, return an empty object as T.
  return {} as T;
}

// Some pages expect getMeta()
export async function getMeta() {
  return { title: 'Promagen', description: 'Stub meta' };
}

// Default export allowed too: import getMeta from '@/lib/api'
export default getMeta;
