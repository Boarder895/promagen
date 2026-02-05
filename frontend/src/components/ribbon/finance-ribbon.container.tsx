// frontend/src/components/ribbon/finance-ribbon.container.tsx
//
// Container/orchestrator only (API Brain compliant):
// - Calls the centralised FX hook (polling is client-only; authority remains server-side).
// - Joins SSOT pair metadata + API payload into presentational chips.
// - Preserves SSOT order end-to-end (no re-sorting).
// - No freshness inference, no "helpful" refresh logic, no upstream/provider knowledge.
//
// v2.0: Two Separate Ribbon Components
// - FinanceRibbonTop: 5 pairs (0-4) - EUR/USD, GBP/USD, GBP/ZAR, USD/CAD, USD/CNY
// - FinanceRibbonBottom: 5 pairs (5-9) - USD/INR, USD/BRL, AUD/USD, USD/NOK, USD/MYR
//
// Spec anchors:
// - SSOT order must be preserved end-to-end. (See Ribbon_Homepage.md)
// - UI is a renderer; it must not decide TTL/A-B/providers/costs. (See API Brain v2)
//
// Existing features preserved: Yes
// Removed: Pause functionality, budget state indicator, winner arrows (no longer needed)

'use client';

import React, { useMemo } from 'react';

import FinanceRibbon from '@/components/ribbon/finance-ribbon';
import FxPairLabel from '@/components/ribbon/fx-pair-label';

import { useFxQuotes, type FxTickDirection } from '@/hooks/use-fx-quotes';
import { assertFxPairsSsotValid, getFxRibbonPairs } from '@/lib/finance/fx-pairs';

import type { FxApiMode, FxApiQuote } from '@/types/finance-ribbon';

export interface FinanceRibbonChip {
  id: string;
  label: React.ReactNode;
  priceText: string;

  // Presentational "alive" language inputs
  tick: FxTickDirection;
  isNeutral: boolean;
}

/** Row split configuration - matches gateway scheduler */
const FX_ROW_CONFIG = {
  topRowSize: 5,    // Pairs 0-4
  bottomRowSize: 5, // Pairs 5-9
} as const;

const POLL_INTERVAL_MS = 300_000; // 5 minutes - prevents API quota exhaustion

function safeFiniteNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatPrice(price: number | null, precision?: number): string {
  if (price === null) return '—';

  const p = safeFiniteNumber(precision);
  const digits = p === null ? 2 : Math.max(0, Math.min(8, Math.floor(p)));

  return price.toLocaleString('en-GB', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/**
 * Shared hook for FX data - used by both Top and Bottom ribbons
 */
function useFxRibbonData() {
  const { payload, quotesById, movementById } = useFxQuotes({
    enabled: true,
    intervalMs: POLL_INTERVAL_MS,
  });

  // SSOT: validate once (dev/build feedback), then use SSOT order as-is.
  const pairs = useMemo(() => {
    assertFxPairsSsotValid();
    return getFxRibbonPairs({ order: 'ssot' });
  }, []);

  const buildId = payload?.meta?.buildId ?? 'unknown';
  const mode: FxApiMode = payload?.meta?.mode ?? 'cached';

  // Build all chips from pairs
  const allChips: FinanceRibbonChip[] = useMemo(() => {
    return pairs.map((p) => {
      const q: FxApiQuote | undefined = quotesById.get(p.id);
      const mv = movementById.get(p.id);

      const winnerSide = mv?.winnerSide ?? 'neutral';
      const tick: FxTickDirection = mv?.tick ?? 'flat';

      const isNeutral = winnerSide === 'neutral';

      return {
        id: p.id,
        label: (
          <FxPairLabel
            base={p.base}
            baseCountryCode={p.baseCountryCode ?? null}
            quote={p.quote}
            quoteCountryCode={p.quoteCountryCode ?? null}
          />
        ),
        priceText: formatPrice(q?.price ?? null, p.precision),

        tick,
        isNeutral,
      };
    });
  }, [pairs, quotesById, movementById]);

  return { buildId, mode, allChips };
}

/**
 * TOP FX RIBBON - 5 pairs (positions 0-4)
 * EUR/USD, GBP/USD, GBP/ZAR, USD/CAD, USD/CNY
 */
export function FinanceRibbonTop() {
  const { buildId, mode, allChips } = useFxRibbonData();

  const chips = useMemo(
    () => allChips.slice(0, FX_ROW_CONFIG.topRowSize),
    [allChips],
  );

  return (
    <FinanceRibbon
      buildId={buildId}
      mode={mode}
      chips={chips}
      rowLabel="FX pairs - majors and commodity currencies"
      testId="fx-ribbon-top"
    />
  );
}

/**
 * BOTTOM FX RIBBON - 5 pairs (positions 5-9)
 * USD/INR, USD/BRL, AUD/USD, USD/NOK, USD/MYR
 */
export function FinanceRibbonBottom() {
  const { buildId, mode, allChips } = useFxRibbonData();

  const chips = useMemo(
    () => allChips.slice(FX_ROW_CONFIG.topRowSize, FX_ROW_CONFIG.topRowSize + FX_ROW_CONFIG.bottomRowSize),
    [allChips],
  );

  return (
    <FinanceRibbon
      buildId={buildId}
      mode={mode}
      chips={chips}
      rowLabel="FX pairs - emerging market currencies"
      testId="fx-ribbon-bottom"
    />
  );
}

/**
 * Legacy default export - renders both rows stacked
 * @deprecated Use FinanceRibbonTop and FinanceRibbonBottom separately
 */
export function FinanceRibbonContainer() {
  return (
    <>
      <FinanceRibbonTop />
      <FinanceRibbonBottom />
    </>
  );
}

export default FinanceRibbonContainer;
