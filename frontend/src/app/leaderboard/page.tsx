// frontend/src/app/leaderboard/page.tsx
// Route wrapper that renders the leaderboard component at /leaderboard.

import type { ProviderTile } from "@/types/ribbon";
import ProviderTable from "@/components/leaderboard/ProviderTable";
import providersJson from "@/data/providers.json";

type ProviderJson = {
  id?: string;
  name?: string;
  displayName?: string;
  url?: string;
  website?: string;
  affiliateUrl?: string | null;
  tagline?: string;
};

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function toTiles(src: unknown, limit = 20): ProviderTile[] {
  const arr = Array.isArray(src) ? (src as ProviderJson[]) : [];
  return arr.slice(0, limit).map((p): ProviderTile => {
    const name = String(p.name ?? p.displayName ?? "Unknown");
    const url = String(p.url ?? p.website ?? "#");
    const id = String(p.id ?? slug(name));
    return {
      id,
      name,
      url,
      affiliateUrl: p.affiliateUrl ?? undefined,
      tagline: p.tagline ?? undefined,
      score: 0,
      trend: "flat", // match your union ('flat' | 'up' | 'down')
    };
  });
}

export default function LeaderboardPage() {
  const items = toTiles(providersJson, 20);

  return (
    <main className="min-h-dvh bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-screen-xl px-6 py-8 space-y-4">
        <h1 className="text-2xl font-semibold">AI Image-Generation Platforms — Leaderboard</h1>
        <ProviderTable items={items} title="TOP 20 • LIVE LEADERBOARD" />
      </div>
    </main>
  );
}

