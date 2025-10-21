"use client";

import React from "react";
import { getTop20Providers, type ProviderItem } from "@/lib/providers/top20";

type CardProps = { item: ProviderItem | null };

function SlotCard({ item }: CardProps) {
  if (!item) {
    return (
      <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/60 min-h-[64px] flex items-center justify-center text-neutral-500">
        0 • •
      </div>
    );
  }

  return (
    <a
      href={item.affiliateUrl ?? item.url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="group block rounded-2xl border border-neutral-800/80 bg-neutral-900/70 hover:bg-neutral-900/90 transition-colors min-h-[64px] p-3"
      title={item.tagline ?? item.name}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="font-medium">{item.name}</div>
        <div className="text-xs opacity-70 group-hover:opacity-90 transition-opacity">
          {item.tagline ?? "—"}
        </div>
      </div>
    </a>
  );
}

export default function ProvidersGrid() {
  // read the canonical 20
  const items = getTop20Providers();

  // force exactly 20 slots (10 rows × 2 columns)
  const slots: (ProviderItem | null)[] = Array.from({ length: 20 }, (_, i) => items[i] ?? null);

  return (
    <div
      className="grid gap-3"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gridTemplateRows: "repeat(10, minmax(64px, auto))",
      }}
      aria-label="Top 20 AI Image-Generation Platforms"
    >
      {slots.map((it, i) => (
        <SlotCard key={i} item={it} />
      ))}
    </div>
  );
}
