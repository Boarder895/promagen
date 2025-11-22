// src/components/ribbon/finance-ribbon.tsx

'use client';

import React from 'react';

import { useFxQuotes } from '@/hooks/use-fx-quotes';
import { useFxSelection } from '@/hooks/use-fx-selection';

import freeFxPairIdsJson from '@/data/selected/fx.pairs.free.json';

import { getAllFxPairs, buildPairCode, type FxPairConfig } from '@/lib/finance/fx-pairs';

const FREE_FX_IDS = freeFxPairIdsJson as string[];
const RIBBON_ARIA_LABEL = 'Foreign exchange overview';

export interface FinanceRibbonProps {
  /**
   * When true, we do not touch real hooks that use timers or localStorage.
   * Used in tests and static demos. Renders a simple, deterministic ribbon.
   */
  demo?: boolean;

  /**
   * Optional explicit list of FX "codes" like 'EURUSD', 'GBPUSD', or slugs
   * like 'eur-usd'. Only honoured in demo mode – in live mode we use the
   * user selection from the FX selection store.
   */
  pairIds?: string[];

  /**
   * Optional polling interval override for the live FX hook.
   */
  intervalMs?: number;
}

/**
 * Resolve a list of FX codes/slugs to concrete FxPairConfig items
 * from the full catalogue.
 *
 * - If codes are omitted or empty, we fall back to the default free pair ids
 *   from data/selected/fx.pairs.free.json (5 today).
 * - Accepts either "eur-usd" style slugs or "EURUSD" style codes.
 */
function resolvePairsForCodes(codes?: string[]): FxPairConfig[] {
  const catalogue = getAllFxPairs();

  const effectiveCodes = !codes || codes.length === 0 ? FREE_FX_IDS : codes;

  const byCode = new Map<string, FxPairConfig>();

  for (const pair of catalogue) {
    const code = buildPairCode(pair.base, pair.quote); // e.g. "EURUSD"
    byCode.set(code, pair);
  }

  const resolved: FxPairConfig[] = [];

  for (const raw of effectiveCodes) {
    // Support both canonical codes ('EURUSD') and slug-style ids ('eur-usd').
    const key = raw.replace(/-/g, '').toUpperCase();
    const match = byCode.get(key);
    if (match && !resolved.includes(match)) {
      resolved.push(match);
    }
  }

  // Ultra-defensive fallback: if something went wrong and we resolved nothing,
  // take the first N unique pairs from the catalogue, where N is the number
  // of default free ids (usually 5).
  if (resolved.length === 0) {
    const targetCount = FREE_FX_IDS.length || 5;
    const seenCodes = new Set<string>();

    for (const pair of catalogue) {
      const code = buildPairCode(pair.base, pair.quote);
      if (seenCodes.has(code)) continue;
      seenCodes.add(code);
      resolved.push(pair);
      if (resolved.length >= targetCount) break;
    }
  }

  return resolved;
}

interface FxChipProps {
  pair: FxPairConfig;
  statusLabel: string;
  testId: string;
  variant: 'demo' | 'live';
}

/**
 * Single FX chip:
 * - fills available width (flex-1)
 * - inverts when the user clicks anywhere on the pill
 * - variant="demo" shows a static "demo" label
 * - variant="live" shows whatever statusLabel we pass in (…, live, —)
 *
 * State is kept *inside* the chip so it can’t be wiped out by parents.
 */
function FxChip({ pair, statusLabel, testId, variant }: FxChipProps) {
  const [isInverted, setIsInverted] = React.useState(false);

  const base = isInverted ? pair.quote : pair.base;
  const quote = isInverted ? pair.base : pair.quote;

  const statusText = variant === 'demo' ? 'demo' : statusLabel;

  const buttonClasses =
    variant === 'demo'
      ? 'flex w-full items-center justify-between gap-2 rounded-full border border-slate-600 px-3 py-1 text-xs font-medium'
      : 'flex w-full items-center justify-between gap-2 rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs font-medium';

  return (
    <li data-testid={testId} className="flex-1">
      <button
        type="button"
        className={buttonClasses}
        onClick={() => setIsInverted((prev) => !prev)}
        aria-label={`Invert ${pair.base}/${pair.quote}`}
        aria-pressed={isInverted}
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold">
            {base}/{quote}
          </span>
          <span className="text-slate-400">{statusText}</span>
        </div>
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-500/70 bg-slate-900/80 text-xs sm:text-sm text-slate-100">
          ↔
        </span>
      </button>
    </li>
  );
}

function DemoFxRow(props: { pairIds?: string[] }) {
  const pairs = resolvePairsForCodes(props.pairIds);

  return (
    <ul className="flex w-full flex-row gap-2" data-testid="finance-ribbon-row-fx">
      {pairs.map((pair) => {
        const code = buildPairCode(pair.base, pair.quote);
        const testId = `fx-${code}`;
        return (
          <FxChip
            key={pair.id ?? code}
            pair={pair}
            statusLabel="demo"
            testId={testId}
            variant="demo"
          />
        );
      })}
    </ul>
  );
}

/**
 * Live FX row uses useFxQuotes, which centralises:
 * - polling cadence + jitter,
 * - global pause handling,
 * - prefers-reduced-motion behaviour.
 *
 * We also clamp the selection to the free-tier length (5) so the ribbon
 * always stays as a single five-wide belt.
 */
function LiveFxRow(props: { intervalMs?: number }) {
  const { pairIds } = useFxSelection();

  // Never render more than the free-tier length in the homepage ribbon –
  // keeps the layout to 5 chips even if the underlying selection store
  // were to contain more.
  const limitedPairIds =
    pairIds && pairIds.length > 0 ? pairIds.slice(0, FREE_FX_IDS.length) : undefined;

  const pairs = resolvePairsForCodes(limitedPairIds);

  const { status, quotesByPairId } = useFxQuotes(
    props.intervalMs != null ? { intervalMs: props.intervalMs } : undefined,
  );

  const isLoading = status === 'idle' || status === 'loading';

  return (
    <ul className="flex w-full flex-row gap-2" data-testid="finance-ribbon-row-fx">
      {pairs.map((pair) => {
        const code = buildPairCode(pair.base, pair.quote);
        const hasQuote = quotesByPairId?.has(code);
        const liveStatusLabel = isLoading ? '…' : hasQuote ? 'live' : '—';
        const testId = `fx-${code}`;

        return (
          <FxChip
            key={pair.id ?? code}
            pair={pair}
            statusLabel={liveStatusLabel}
            testId={testId}
            variant="live"
          />
        );
      })}
    </ul>
  );
}

export function FinanceRibbon({ demo, pairIds, intervalMs }: FinanceRibbonProps) {
  // Important: early return BEFORE any hooks so demo mode does not touch
  // user-plan or localStorage in Jest / SSR.
  if (demo) {
    return (
      <section
        aria-label={RIBBON_ARIA_LABEL}
        role="complementary"
        data-testid="finance-ribbon"
        className="w-full"
      >
        {/* Centred belt above the three-column layout */}
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-0">
          <DemoFxRow pairIds={pairIds} />
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label={RIBBON_ARIA_LABEL}
      role="complementary"
      data-testid="finance-ribbon"
      className="w-full"
    >
      {/* Centred belt above the three-column layout */}
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-0">
        <LiveFxRow intervalMs={intervalMs} />
      </div>
    </section>
  );
}

export default FinanceRibbon;
