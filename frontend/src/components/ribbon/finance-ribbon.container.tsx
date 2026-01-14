// frontend/src/components/ribbon/finance-ribbon.container.tsx
//
// Container/orchestrator only (API Brain compliant):
// - Calls the centralised FX hook (polling is client-only; authority remains server-side).
// - Joins SSOT pair metadata + API payload into presentational chips.
// - Preserves SSOT order end-to-end (no re-sorting).
// - No freshness inference, no "helpful" refresh logic, no upstream/provider knowledge.
//
// Spec anchors:
// - SSOT order must be preserved end-to-end. (See Ribbon_Homepage.md)
// - UI is a renderer; it must not decide TTL/A-B/providers/costs. (See API Brain v2)
//
// Existing features preserved: Yes
// Removed: Pause functionality, budget state indicator (no longer needed)

'use client';

import React, { useMemo } from 'react';

import FinanceRibbon from '@/components/ribbon/finance-ribbon';
import FxPairLabel from '@/components/ribbon/fx-pair-label';

import { useFxQuotes, type FxTickDirection, type FxWinnerSide } from '@/hooks/use-fx-quotes';
import { assertFxPairsSsotValid, getFxRibbonPairs } from '@/lib/finance/fx-pairs';

import type { FxApiMode, FxApiQuote } from '@/types/finance-ribbon';

export interface FinanceRibbonChip {
  id: string;
  label: React.ReactNode;
  priceText: string;

  // Presentational "alive" language inputs
  tick: FxTickDirection;
  isNeutral: boolean;

  // Direction inputs for FxPairLabel (arrow + hover copy)
  winnerSide: FxWinnerSide;
  winnerOpacity: number;
  deltaPct: number | null;
}

const POLL_INTERVAL_MS = 300_000; // 5 minutes - prevents API quota exhaustion

function safeFiniteNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function normaliseCode(value: string): string {
  return String(value ?? '')
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase();
}

function isMajorPairByCodes(base: string, quote: string): boolean {
  const majors = new Set(['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD']);
  return majors.has(normaliseCode(base)) && majors.has(normaliseCode(quote));
}

/**
 * Confidence encoded via opacity (subtle):
 * - near threshold: ~0.75
 * - strong move (~>= 2x threshold): 1.0
 *
 * Thresholds mirror the behavioural intent from the ribbon spec; this is purely visual.
 */
function winnerOpacityFromDelta(deltaPct: number | null, base: string, quote: string): number {
  if (deltaPct === null) return 1;

  const abs = Math.abs(deltaPct);

  // These values align with the "appear" thresholds used by the FX motion rules.
  // Majors are tighter; volatile/EM are wider.
  const appearThreshold = isMajorPairByCodes(base, quote) ? 0.03 : 0.075;

  // Map abs delta into [0..1] where:
  // - abs == threshold -> 0
  // - abs == 2*threshold -> 1
  const t = Math.max(0, Math.min(1, (abs - appearThreshold) / appearThreshold));

  // Spec guidance: dimmer near threshold (~70–80%), full at strong moves.
  return 0.75 + 0.25 * t;
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

export function FinanceRibbonContainer() {
  // Weekend freeze is removed completely: the hook result no longer exposes it,
  // and the label props no longer accept it.
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

  const chips: FinanceRibbonChip[] = useMemo(() => {
    return pairs.map((p) => {
      const q: FxApiQuote | undefined = quotesById.get(p.id);
      const mv = movementById.get(p.id);

      const winnerSide: FxWinnerSide = mv?.winnerSide ?? 'neutral';
      const tick: FxTickDirection = mv?.tick ?? 'flat';
      const deltaPct: number | null =
        typeof mv?.deltaPct === 'number' && Number.isFinite(mv.deltaPct) ? mv.deltaPct : null;

      const isNeutral = winnerSide === 'neutral';
      const winnerOpacity = isNeutral ? 0 : winnerOpacityFromDelta(deltaPct, p.base, p.quote);

      return {
        id: p.id,
        label: (
          <FxPairLabel
            base={p.base}
            baseCountryCode={p.baseCountryCode ?? null}
            quote={p.quote}
            quoteCountryCode={p.quoteCountryCode ?? null}
            winnerSide={winnerSide}
            winnerOpacity={winnerOpacity}
            deltaPct={deltaPct}
          />
        ),
        priceText: formatPrice(q?.price ?? null, p.precision),

        tick,
        isNeutral,

        winnerSide,
        winnerOpacity,
        deltaPct,
      };
    });
  }, [pairs, quotesById, movementById]);

  // No behavioural branching based on status/mode here; renderer decides how to show.
  // This container only maps data to chips and passes through state.
  return (
    <FinanceRibbon
      buildId={buildId}
      mode={mode}
      chips={chips}
    />
  );
}

export default FinanceRibbonContainer;
