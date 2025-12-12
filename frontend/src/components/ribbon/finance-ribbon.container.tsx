'use client';

import React, { useMemo, useState } from 'react';

import { FinanceRibbon } from '@/components/ribbon/finance-ribbon';
import { FxProvenanceBar } from '@/components/ribbon/fx-provenance-bar';
import { useFxQuotes } from '@/hooks/use-fx-quotes';
import { assertFxPairsSsotValid, getFxRibbonPairs } from '@/lib/finance/fx-pairs';

import type { FxApiMode, FxApiQuote } from '@/types/finance-ribbon';

const POLL_INTERVAL_MS = 30 * 60_000;

function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function formatDeltaPct(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export type FinanceRibbonChipDirection = 'up' | 'down' | 'flat';

export type FinanceRibbonChip = {
  id: string;
  label: string;
  category: string;
  emoji: string | null;
  priceText: string;
  deltaText: string;
  direction: FinanceRibbonChipDirection;
};

/**
 * IMPORTANT:
 * - No demo behaviour.
 * - UI/layout unchanged; this container only maps API payload -> chips.
 * - Polls every 30 minutes.
 */
export const FinanceRibbonContainer: React.FC = () => {
  const [isPaused, setIsPaused] = useState(false);

  const { status, payload } = useFxQuotes({
    intervalMs: POLL_INTERVAL_MS,
    enabled: !isPaused,
  });

  const mode: FxApiMode = payload?.meta?.mode ?? 'live';
  const buildId = payload?.meta?.buildId ?? 'local-dev';
  const providerId = payload?.meta?.sourceProvider ?? null;
  const asOf = payload?.meta?.asOf ?? null;

  const pairs = useMemo(() => {
    assertFxPairsSsotValid();
    return getFxRibbonPairs();
  }, []);

  const quotesById = useMemo(() => {
    const map = new Map<string, FxApiQuote>();
    for (const q of payload?.data ?? []) map.set(q.id, q);
    return map;
  }, [payload]);

  const chips: FinanceRibbonChip[] = useMemo(() => {
    return pairs.map((p) => {
      const q = quotesById.get(p.id);

      const priceText = formatPrice(q?.price ?? null);
      const deltaText = formatDeltaPct(q?.changePct ?? null);

      return {
        id: p.id,
        label: p.label,
        category: p.category,
        emoji: p.emoji ?? null,
        priceText,
        deltaText,
        direction:
          q?.changePct === null || q?.changePct === undefined
            ? 'flat'
            : q.changePct > 0
            ? 'up'
            : q.changePct < 0
            ? 'down'
            : 'flat',
      };
    });
  }, [pairs, quotesById]);

  return (
    <section data-testid="finance-ribbon" data-status={status}>
      <FinanceRibbon
        buildId={buildId}
        mode={mode}
        chips={chips}
        isPaused={isPaused}
        onPauseToggle={() => setIsPaused((v) => !v)}
      />

      <FxProvenanceBar mode={mode} providerId={providerId} lastUpdatedAt={asOf} />
    </section>
  );
};

export default FinanceRibbonContainer;
