// frontend/src/app/leaderboard/page.tsx
// Thin App Router page that renders the ProviderTable at /leaderboard.

import ProviderTable from "@/components/leaderboard/ProviderTable";
import providersJson from "@/data/providers.json";

// Local structural type matching what ProviderTable expects.
type ProviderRow = {
  id: string;
  name: string;
  url: string;
  affiliateUrl: string;  // required string
  tagline: string;       // required string
  score: number;
  trend: "flat" | "up" | "down";
};

type ProviderJson = {
  id?: string;
  name?: string;
  displayName?: string;
  url?: string;
  website?: string;
  affiliateUrl?: string | null;
  tagline?: string | null;
};

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function toRows(src: unknown, limit = 20): ProviderRow[] {
  const arr = Array.isArray(src) ? (src as ProviderJson[]) : [];
  return arr.slice(0, limit).map((p): ProviderRow => {
    const name = String(p.name ?? p.displayName ?? "Unknown");
    const url = String(p.url ?? p.website ?? "#");
    const id = String(p.id ?? slug(name));
    return {
      id,
      name,
      url,
      affiliateUrl: String(p.affiliateUrl ?? ""), // force string
      tagline: String(p.tagline ?? ""),           // force string
      score: 0,
      trend: "flat",
    };
  });
}

export default function LeaderboardPage() {
  const rows = toRows(providersJson, 20);

  return (
    <main className="min-h-dvh bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-screen-xl px-6 py-8 space-y-4">
        <h1 className="text-2xl font-semibold">AI Image-Generation Platforms — Leaderboard</h1>
        <ProviderTable rows={rows} />
      </div>
    </main>
  );
}






