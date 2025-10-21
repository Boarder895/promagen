// frontend/src/components/leaderboard/ProviderTable.tsx
// Simple, typed leaderboard table. No data fetching here—just render what you're given.

import type { ProviderTile } from "@/types/ribbon";

type Props = {
  items: ProviderTile[];       // normalized tiles from the route/page
  title?: string;
};

export default function ProviderTable({ items, title }: Props) {
  const rows = Array.isArray(items) ? items : [];

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/60">
      {title ? (
        <div className="px-4 py-3 border-b border-neutral-800 text-sm text-neutral-300">
          {title}
        </div>
      ) : null}

      <div className="p-3">
        <div className="grid grid-cols-2 gap-3">
          {rows.map((p) => (
            <a
              key={p.id}
              href={p.affiliateUrl ?? p.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="block rounded-lg border border-neutral-800/80 bg-neutral-900/80 hover:bg-neutral-900 transition-shadow shadow"
              title={p.tagline ?? p.name}
            >
              <div className="flex items-center justify-between gap-2 px-3 py-3">
                <div className="font-medium truncate">{p.name}</div>
                <div className="text-xs text-neutral-400">
                  {p.trend ?? "flat"}
                </div>
              </div>
            </a>
          ))}

          {/* pad to 20 tiles so layout stays 10×2 even if fewer items */}
          {rows.length < 20 &&
            Array.from({ length: 20 - rows.length }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="rounded-lg border border-dashed border-neutral-800/60 bg-neutral-900/40 min-h-[48px]"
                aria-hidden
              />
            ))}
        </div>
      </div>
    </section>
  );
}

