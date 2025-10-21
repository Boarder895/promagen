// frontend/src/components/providers/ProvidersGrid.tsx
'use client';

import React from 'react';
import type { ProviderTile } from '@/types/ribbon';

type CardProps = { item: ProviderTile | null };

function SlotCard({ item }: CardProps) {
  if (!item) {
    return (
      <div className="rounded-2xl border border-neutral-800/60 bg-neutral-900/60 min-h-[64px] flex items-center justify-center text-neutral-500">
        <div>—</div>
      </div>
    );
  }

  return (
    <a
      href={item.affiliateUrl ?? item.url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="group block rounded-2xl border border-neutral-800/80 bg-neutral-900/90 hover:bg-neutral-900 transition-colors min-h-[64px] p-3"
      title={item.tagline ?? item.name}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="font-medium">{item.name}</div>
        <div className="text-xs opacity-70 group-hover:opacity-90 transition-opacity">
          {item.tagline ?? '–'}
        </div>
      </div>
    </a>
  );
}

export default function ProvidersGrid({ items }: { items: ProviderTile[] }) {
  // Force exactly 20 slots (10 rows × 2 columns)
  const slots: (ProviderTile | null)[] = Array.from({ length: 20 }, (_, i) => items[i] ?? null);

  return (
    <div className="grid grid-cols-2 gap-3">
      {slots.map((item, i) => (
        <SlotCard key={item?.id ?? `empty-${i}`} item={item} />
      ))}
    </div>
  );
}


