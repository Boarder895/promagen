// src/components/ribbon/finance-ribbon.container.tsx
'use client';

import React from 'react';

import FinanceRibbon from '@/components/ribbon/finance-ribbon';
import { FxProvenanceBar } from '@/components/ribbon/fx-provenance-bar';
import { useFxQuotes } from '@/hooks/use-fx-quotes';
import type { FxQuotesPayload } from '@/types/finance-ribbon';
import type { FxRibbonQuoteDto, RibbonMode } from '@/types/finance-ribbon.d';

const POLL_INTERVAL_MS = 60_000;

/**
 * Thin “smart” wrapper that:
 *
 *   - Calls useFxQuotes → /api/fx (which obeys the API Brain / gateway).
 *   - Normalises the result into the props FinanceRibbon expects.
 *   - Wires meta into FxProvenanceBar for provenance + freshness.
 *
 * It deliberately contains no provider logic, no env access and
 * no formatting – all of that lives in the gateway + API layer.
 */

type FxQuotesUiPayload = FxQuotesPayload & {
  data?: FxRibbonQuoteDto[] | null;
  buildId?: string;
  mode?: RibbonMode;
  sourceProvider?: string | null;
  asOf?: string | null;
};

export interface FinanceRibbonContainerProps {
  /**
   * When true, force the ribbon into demo mode regardless of gateway payload.
   * Used by homepage layout tests and story-style demo renders.
   */
  demo?: boolean;
}

export const FinanceRibbonContainer: React.FC<FinanceRibbonContainerProps> = ({ demo = false }) => {
  // We cast the hook result to a minimal shape so we don’t fight
  // with its internal generics. This keeps the container tiny.
  const { status, payload } = useFxQuotes({
    intervalMs: POLL_INTERVAL_MS,
  }) as {
    status: 'idle' | 'loading' | 'success' | 'error';
    payload: FxQuotesUiPayload | null;
  };

  // --- Meta derived from the gateway payload ---------------------

  // If we have a payload, trust its mode. If not, or if demo is forced,
  // we treat this as demo which lines up with the API Brain’s
  // “demo provider → demo mode” language.
  const mode: RibbonMode = (demo ? 'demo' : payload?.mode ?? 'demo') as RibbonMode;

  // Canonical FX quotes for the ribbon row. When null, FinanceRibbon will
  // fall back to its local synthetic free–tier or demo snapshot.
  const fx = demo ? null : payload?.data ?? null;

  // Build id for correlating ribbon behaviour with logs.
  const buildId = payload?.buildId ?? 'local-dev';

  // Provider id + timestamp for the provenance bar.
  // When we’re in demo mode without a real payload, we label the provider
  // as "demo".
  const sourceProvider = payload?.sourceProvider ?? (mode === 'demo' ? 'demo' : null);
  const asOf = payload?.asOf ?? null;

  // --- Render ----------------------------------------------------

  return (
    <section
      aria-label="Foreign exchange ribbon"
      data-status={status}
      className="flex flex-col gap-1"
    >
      <FinanceRibbon buildId={buildId} mode={mode} fx={fx} demo={mode === 'demo'} />

      <FxProvenanceBar mode={mode} providerId={sourceProvider} lastUpdatedAt={asOf} />
    </section>
  );
};

export default FinanceRibbonContainer;
