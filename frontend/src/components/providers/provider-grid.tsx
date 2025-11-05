// frontend/src/components/providers/provider-grid.tsx
"use client";

import ProviderCard from "@/components/providers/provider-card";
import type { Provider } from "@/types/providers";

type ProviderGridProps = { providers: Provider[] };

function EmptySlot({ i }: { i: number }) {
  return (
    <div
      key={`empty-${i}`}
      className="rounded-2xl border border-neutral-800/60 bg-neutral-900/60 min-h-[64px] flex items-center justify-center text-neutral-500"
      aria-hidden="true"
    >
      ·
    </div>
  );
}

export default function ProviderGrid({ providers }: ProviderGridProps) {
  // Sort by score desc, then name asc
  const sorted = [...providers].sort(
    (a, b) => b.score - a.score || a.name.localeCompare(b.name)
  );

  // Exactly 20 slots
  const slots: (Provider | null)[] = Array.from(
    { length: 20 },
    (_, i) => sorted[i] ?? null
  );

  return (
    <div className="grid grid-cols-2 gap-3">
      {slots.map((p, i) =>
        p ? (
          <ProviderCard key={p.id} provider={{ ...p, rank: i + 1 }} index={i} />
        ) : (
          <EmptySlot key={`empty-${i}`} i={i} />
        )
      )}
    </div>
  );
}


