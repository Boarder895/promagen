'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';

type RegionChip = { id: string; name: string; tint: string };
type WindowInfo = { regionId: string; isOpen: boolean; nextFlipIso: string };
type OpenWindowBannerProps = { regions: RegionChip[]; windows: WindowInfo[] };

function humanCountdown(toIso: string) {
  const diff = Math.max(0, new Date(toIso).getTime() - Date.now());
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export function OpenWindowBanner({ regions, windows }: OpenWindowBannerProps) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const chips = useMemo(() => {
    return regions.map((r) => {
      const w = windows.find((w) => w.regionId === r.id);
      const isOpen = Boolean(w?.isOpen);
      const nextFlip = w?.nextFlipIso ? humanCountdown(w.nextFlipIso) : 'Ã¢â‚¬â€';
      return { ...r, isOpen, nextFlip };
    });
  }, [regions, windows]);

  return (
    <div className="mb-2 mt-1 flex items-center justify-between rounded-xl border px-3 py-2 backdrop-blur">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 opacity-70" />
        <div className="text-sm font-semibold">Open windows</div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {chips.map((c) => (
          <Badge
            key={c.id}
            className={[
              'border',
              c.tint,
              c.isOpen ? 'bg-emerald-100/50 text-emerald-800' : 'bg-slate-100 text-slate-700',
            ].join(' ')}
          >
            {c.name} Ã‚Â· {c.isOpen ? 'Open' : 'Closed'} Ã‚Â· {c.nextFlip}
          </Badge>
        ))}
      </div>
    </div>
  );
}



