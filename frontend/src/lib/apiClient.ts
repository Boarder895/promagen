export async function api<T>(path: string, init?: RequestInit) {
  const r = await fetch(path, init);
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<T>;
}
