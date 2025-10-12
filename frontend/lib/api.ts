const API = process.env.NEXT_PUBLIC_API_URL;

if (!API) {
  throw new Error(
    'NEXT_PUBLIC_API_URL is not set. Create frontend/.env.local with NEXT_PUBLIC_API_URL=http://localhost:4000',
  );
}

export async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    cache: 'no-store',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status} ${res.statusText} at ${path} — ${text || 'no body'}`);
  }

  return res.json() as Promise<T>;
}

export { API };
