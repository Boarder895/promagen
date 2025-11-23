'use client';

import React, { useMemo } from 'react';

import { useFxQuotes } from '@/hooks/use-fx-quotes';
import { useFxSelection } from '@/hooks/use-fx-selection';
import freeFxPairIdsJson from '@/data/selected/fx.pairs.free.json';
import {
  ALL_FX_PAIRS,
  DEFAULT_FREE_FX_PAIR_IDS,
  buildPairCode,
  type FxPairConfig,
} from '@/lib/finance/fx-pairs';
import type { FxQuote } from '@/types/finance-ribbon';

const FREE_FX_IDS = freeFxPairIdsJson as string[];
const RIBBON_ARIA_LABEL = 'Foreign exchange overview';

/**
 * Hard cap for the homepage ribbon – always 5 chips wide.
 * Any extra pairs in data or user selection are ignored visually.
 */
const MAX_FX_CHIPS = 5;

export interface FinanceRibbonProps {
  /**
   * Demo mode is only for tests and as a hard fallback when
   * live APIs are unavailable. You won’t pass this in normal use.
   */
  demo?: boolean;
  /**
   * Optional explicit list of FX pair ids or codes for demo mode.
   * - Slugs:  "gbp-usd"
   * - Codes:  "GBPUSD"
   * When omitted we fall back to the canonical free-tier set.
   */
  pairIds?: string[];
  /**
   * Optional polling interval override for the live quotes hook.
   */
  intervalMs?: number;
}

type FxQuoteMap = Map<string, FxQuote>;

const ALL_FX_BY_ID = new Map<string, FxPairConfig>(
  ALL_FX_PAIRS.map((pair) => [pair.id.toLowerCase(), pair]),
);

const ALL_FX_BY_CODE = new Map<string, FxPairConfig>(
  ALL_FX_PAIRS.map((pair) => [buildPairCode(pair.base, pair.quote), pair]),
);

/**
 * Resolve an ordered list of FX pairs from a mixed list of
 * canonical slugs ("gbp-usd") or codes ("GBPUSD").
 */
function resolveFxPairs(inputIds: string[] | undefined): FxPairConfig[] {
  const sourceIds = inputIds && inputIds.length > 0 ? inputIds : DEFAULT_FREE_FX_PAIR_IDS;

  const seen = new Set<string>();
  const result: FxPairConfig[] = [];

  for (const idOrCode of sourceIds) {
    const slugKey = idOrCode.toLowerCase();
    const codeKey = idOrCode.toUpperCase();

    let pair = ALL_FX_BY_ID.get(slugKey);

    if (!pair) {
      pair = ALL_FX_BY_CODE.get(codeKey);
    }

    if (pair && !seen.has(pair.id)) {
      seen.add(pair.id);
      result.push(pair);
    }
  }

  return result;
}

function formatQuoteValue(
  pair: FxPairConfig,
  quotesByPairId: FxQuoteMap,
  isLoading: boolean,
): string {
  const code = buildPairCode(pair.base, pair.quote);
  const quote = quotesByPairId.get(code);
  const mid = quote?.mid;

  if (typeof mid === 'number' && Number.isFinite(mid)) {
    // FX values are typically quoted to 4–5 decimal places.
    return mid.toFixed(4);
  }

  if (isLoading) {
    return '…';
  }

  return '—';
}

interface FxChipProps {
  pair: FxPairConfig;
  quotesByPairId: FxQuoteMap;
  isLoading: boolean;
}

/**
 * Single FX chip – no inversion, always canonical base/quote.
 */
function FxChip({ pair, quotesByPairId, isLoading }: FxChipProps) {
  const code = buildPairCode(pair.base, pair.quote);
  const value = formatQuoteValue(pair, quotesByPairId, isLoading);

  return (
    <li className="min-w-0 flex-1">
      <button
        type="button"
        data-testid={`fx-${code}`}
        className="inline-flex w-full items-center justify-between gap-3 rounded-full border border-slate-700/70 bg-slate-900/80 px-4 py-2 text-xs font-medium text-slate-50 shadow-sm focus-visible:outline-none focus-visible:ring focus-visible:ring-sky-400/80"
      >
        <span className="truncate text-sm tracking-wide">
          {pair.base}
          <span className="mx-1 text-slate-500">/</span>
          {pair.quote}
        </span>
        <span className="text-xs tabular-nums text-slate-300">{value}</span>
      </button>
    </li>
  );
}

/**
 * Top-of-centre-column FX ribbon.
 * Free: 5 locked pairs (homepage).
 * Paid: same component, but useFxSelection will supply the user’s 5.
 */
export function FinanceRibbon({ demo = false, pairIds, intervalMs }: FinanceRibbonProps) {
  // Plan-aware selection store. For now, free users still get the
  // same 5; paid users will later update this via the FX picker UI.
  const { pairIds: savedPairIds } = useFxSelection();

  const effectiveIds = useMemo(() => {
    if (demo) {
      if (pairIds && pairIds.length > 0) {
        return pairIds;
      }
      // Keep the canonical free FX list for demos so tests
      // and screenshots stay in sync with the homepage.
      return FREE_FX_IDS;
    }

    if (savedPairIds && savedPairIds.length > 0) {
      return savedPairIds;
    }

    return DEFAULT_FREE_FX_PAIR_IDS;
  }, [demo, pairIds, savedPairIds]);

  // Always render at most 5 chips so the ribbon stays aligned
  // with the design spec and centred above the providers table.
  const pairs = useMemo(() => resolveFxPairs(effectiveIds).slice(0, MAX_FX_CHIPS), [effectiveIds]);

  // Live quotes are only enabled when not in demo.
  const quotesOptions = demo ? { enabled: false as const } : { enabled: true as const, intervalMs };
  const { status, quotesByPairId } = useFxQuotes(quotesOptions);
  const isLoading = status === 'idle' || status === 'loading';

  return (
    <section
      aria-label={RIBBON_ARIA_LABEL}
      role="complementary"
      data-testid="finance-ribbon"
      className="rounded-3xl bg-slate-950/60 px-3 py-2 shadow-md"
    >
      <ul aria-label="Foreign exchange pairs" className="flex gap-2">
        {pairs.map((pair) => (
          <FxChip key={pair.id} pair={pair} quotesByPairId={quotesByPairId} isLoading={isLoading} />
        ))}
      </ul>
    </section>
  );
}

export default FinanceRibbon;
