// C:\Users\Proma\Projects\promagen\frontend\src\components\ribbon\fx-provenance-bar.tsx

'use client';

import { useMemo } from 'react';
import type { FxQuotesPayload } from '@/types/finance-ribbon';
import { getFxProviderSummary } from '@/lib/fx/providers';

export interface FxProvenanceBarProps {
  /**
   * The FX mode coming from the /api/fx payload:
   *   - "live"
   *   - "fallback"
   *   - "demo"
   */
  mode: FxQuotesPayload['mode'] | null | undefined;
  /**
   * Provider ID from the first quote (or null). This is used
   * together with `mode` to pick the right provider entry
   * from src/data/fx/providers.json.
   */
  providerId?: string | null;
  /**
   * ISO timestamp representing the newest quote in the current
   * payload, typically passed straight from useFxQuotes /
   * deriveLastUpdatedAt.
   */
  lastUpdatedAt?: string | null;
}

/**
 * Formats an ISO timestamp into "HH:mm" in the user's local time,
 * using 24-hour clock as required by the Global Standard. :contentReference[oaicite:4]{index=4}
 */
function formatAsOfLocal(timeIso: string | null | undefined): string | null {
  if (!timeIso) return null;

  const ts = Date.parse(timeIso);
  if (!Number.isFinite(ts)) {
    return null;
  }

  const date = new Date(ts);

  try {
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    // Very defensive: in the unlikely event of locale issues,
    // fall back to a simple HH:mm from UTC.
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}

/**
 * A compact bar summarising:
 *
 *   - whether the data is live / fallback / demo
 *   - which FX provider supplied it
 *   - "as of HH:mm (local)" timestamp
 *
 * This should typically sit in the header of the FX ribbon.
 */
export function FxProvenanceBar({ mode, providerId, lastUpdatedAt }: FxProvenanceBarProps) {
  const summary = useMemo(
    () => getFxProviderSummary(mode ?? null, providerId ?? null),
    [mode, providerId],
  );

  const asOfLabel = useMemo(() => formatAsOfLocal(lastUpdatedAt ?? null), [lastUpdatedAt]);

  return (
    <div
      className="flex min-w-0 flex-1 items-center justify-between gap-2 text-[11px] leading-tight text-white/60"
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
        {mode === 'demo' && (
          <span
            className="shrink-0 rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-300"
            aria-label="Demo FX data · illustrative only"
          >
            Demo · illustrative only
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {asOfLabel && <span aria-label={`FX data as of ${asOfLabel}`}>as of {asOfLabel}</span>}
      </div>
    </div>
  );
}
