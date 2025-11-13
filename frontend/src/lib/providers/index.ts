// frontend/src/lib/providers/index.ts
// Typed provider catalog helpers, no any.

export type Provider = {
  id: string;
  name: string;
  score?: number;
  tags?: string[];
  url?: string;
};

export function byId(list: Provider[], id: string): Provider | undefined {
  return list.find((p) => p.id === id);
}

export function sortByScoreDesc(list: Provider[]): Provider[] {
  return [...list].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}

export function filterByTag(list: Provider[], tag: string): Provider[] {
  return list.filter((p) => (p.tags ?? []).includes(tag));
}
