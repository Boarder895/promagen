// C:\Users\Proma\Projects\promagen\frontend\src\components\ribbon\fx-provenance-bar.tsx
//
// Provenance bar:
// - No demo label (FX demo disabled)
// - Uses gateway truth: mode + provider + asOf
// - 24-hour clock (en-GB)

'use client';

import { useMemo } from 'react';

import type { FxApiMode } from '@/types/finance-ribbon';
import { getFxProviderSummary } from '@/lib/fx/providers';

export interface FxProvenanceBarProps {
  mode: FxApiMode | null | undefined;
  providerId?: string | null;
  lastUpdatedAt?: string | null;
}

function formatAsOfLocal(timeIso: string | null | undefined): string | null {
  if (!timeIso) return null;

  const ts = Date.parse(timeIso);
  if (!Number.isFinite(ts)) return null;

  const date = new Date(ts);

  try {
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}

export function FxProvenanceBar({ mode, providerId, lastUpdatedAt }: FxProvenanceBarProps) {
  const summary = useMemo(
    () => getFxProviderSummary(mode ?? null, providerId ?? null),
    [mode, providerId],
  );

  const asOfLabel = useMemo(() => formatAsOfLocal(lastUpdatedAt ?? null), [lastUpdatedAt]);

  return (
    <div
      className="flex items-center justify-between gap-2 text-[11px] leading-tight text-white/60"
      aria-label="FX data source and timestamp"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate">
          {summary.modeLabel} · {summary.meta.name}
        </span>

        {summary.emphasiseFallback && (
          <span
            className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300"
            aria-label="Using fallback FX provider"
          >
            Fallback
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {asOfLabel && <span aria-label={`FX data as of ${asOfLabel}`}>as of {asOfLabel}</span>}
      </div>
    </div>
  );
}
