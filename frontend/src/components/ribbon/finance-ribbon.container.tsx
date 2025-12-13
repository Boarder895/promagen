'use client';

import React, { useMemo, useState } from 'react';

import { FinanceRibbon } from '@/components/ribbon/finance-ribbon';
import { useFxQuotes } from '@/hooks/use-fx-quotes';
import { assertFxPairsSsotValid, buildPairCode, getFxRibbonPairs } from '@/lib/finance/fx-pairs';

import type { FxApiQuote } from '@/types/finance-ribbon';

const POLL_INTERVAL_MS = 30 * 60_000;

function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

export const FinanceRibbonContainer: React.FC = () => {
  const [isPaused, setIsPaused] = useState(false);

  const { status, payload, quotesByProviderSymbol } = useFxQuotes({
    intervalMs: POLL_INTERVAL_MS,
    enabled: !isPaused,
  });

  const mode = payload?.meta?.mode ?? 'live';
  const buildId = payload?.meta?.buildId ?? 'local-dev';

  const pairs = useMemo(() => {
    assertFxPairsSsotValid();

    // Deterministic, VPN-proof, permission-free:
    // Fixed world ordering (east → west) using homeLongitude.
    return getFxRibbonPairs({ order: 'homeLongitude' });
  }, []);

  const quotesById = useMemo(() => {
    const map = new Map<string, FxApiQuote>();
    for (const q of payload?.data ?? []) map.set(q.id, q);
    return map;
  }, [payload]);

  const chips: FinanceRibbonChip[] = useMemo(() => {
    return pairs.map((p) => {
      // Primary: join by SSOT id
      let q = quotesById.get(p.id);

      // Fallback: join by normalised base+quote, e.g. GBPUSD
      if (!q) {
        const code = buildPairCode(p.base, p.quote);
        q = quotesByProviderSymbol.get(code);
      }

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
  }, [pairs, quotesById, quotesByProviderSymbol]);

  return (
    <section data-testid="finance-ribbon" data-status={status} className="w-full">
      <div className="w-full flex justify-center mb-4">
        <div className="w-full max-w-5xl">
          <FinanceRibbon
            buildId={buildId}
            mode={mode}
            chips={chips}
            isPaused={isPaused}
            onPauseToggle={() => setIsPaused((v) => !v)}
          />
        </div>
      </div>
    </section>
  );
};

export default FinanceRibbonContainer;
