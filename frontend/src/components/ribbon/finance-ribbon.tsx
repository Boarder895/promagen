// src/components/ribbon/finance-ribbon.tsx
//
// Top-level finance ribbon component for the homepage centre rail.
//
// In this version the ribbon only renders the FX row; commodities / crypto
// can be layered in later without changing the public props.
//
// The component is intentionally "dumb":
//   - It receives normalised FX quotes + meta information via props.
//   - When no quotes are supplied it falls back to a deterministic free–tier
//     snapshot that is driven from the single source of truth in
//     src/data/fx/* via src/lib/finance/fx-pairs.ts.
//   - When `demo` is true we instead use the static demo row looked up from
//     src/data/finance-ribbon.demo.ts so Storybook / tests never need live
//     data.
//
// The tests exercise three main contracts:
//   1) Rendering of specific FX chips when pairIds are supplied (demo mode).
//   2) Behaviour of the free–tier row (five chips, canonical order).
//   3) Analytics when the pause button is clicked.
//

'use client';

import React from 'react';

import type { FxRibbonQuoteDto, RibbonMode } from '@/types/finance-ribbon.d';
import { ALL_FX_PAIRS, DEFAULT_FREE_FX_PAIR_IDS, buildPairCode } from '@/lib/finance/fx-pairs';
import { trackRibbonPause } from '@/lib/analytics/finance';
import { getDemoFxForPairIds } from '@/data/finance-ribbon.demo';

export interface FinanceRibbonProps {
  /**
   * Mode of the ribbon – live, demo, fallback, cached.
   * When omitted we infer it from the `demo` flag and whether we have
   * a real fx[] payload.
   */
  mode?: RibbonMode;
  /**
   * Optional build identifier used mainly in tests.
   */
  buildId?: string;
  /**
   * Normalised FX quotes for the row. When omitted or null a deterministic
   * snapshot is generated from the SSOT in src/data/fx.
   */
  fx?: FxRibbonQuoteDto[] | null;
  /**
   * Convenience flag for tests and storybook. When true we force demo mode
   * and generate demo quotes if none were supplied.
   */
  demo?: boolean;
  /**
   * Optional explicit list of FX pair codes (e.g. "EURUSD", "GBPUSD") that
   * should be rendered. When provided in demo mode we filter / re-order the
   * static demo row; when provided for live data the caller is expected to
   * pre–filter the fx[] payload.
   */
  pairIds?: string[];
}

/**
 * Choose the effective mode.
 *
 * Rules:
 * - If props.mode is explicitly provided, we trust it (gateway is the
 *   source of truth).
 * - If there is *no* fx[] payload (we are using a local synthetic
 *   fallback such as the free–tier snapshot or demo row), we treat
 *   the ribbon as 'demo' mode because provider is always 'demo'.
 * - Otherwise we fall back to the original rule:
 *     demo flag → 'demo'
 *     default   → 'live'
 */
function getEffectiveMode(props: FinanceRibbonProps, hasFxPayload: boolean): RibbonMode {
  if (props.mode) return props.mode;

  if (!hasFxPayload) {
    // Local synthetic data (free–tier or demo row) – always demo mode.
    return 'demo';
  }

  return props.demo ? 'demo' : 'live';
}

/**
 * Build a deterministic free–tier snapshot using the single source of truth
 * from src/data/fx. This is used when:
 *   - the component is rendered without fx[]
 *   - and demo mode is NOT enabled.
 *
 * The shape deliberately mirrors FxQuote coming back from /api/fx so the
 * component does not care how the data was produced.
 */
function buildFreeTierQuotes(): FxRibbonQuoteDto[] {
  const nowIso = new Date().toISOString();

  const pairs = DEFAULT_FREE_FX_PAIR_IDS.map((id) => {
    const pair = ALL_FX_PAIRS.find((candidate) => candidate.id === id);
    if (!pair) {
      throw new Error(
        `DEFAULT_FREE_FX_PAIR_IDS contains unknown pair id "${id}" – check fx.pairs.free.json against fx.pairs.json`,
      );
    }
    return pair;
  });

  return pairs.map((pair) => {
    const mid = 1.0;

    return {
      pairId: pair.id,
      base: pair.base,
      quote: pair.quote,
      mid,
      bid: mid,
      ask: mid,
      changePct: 0,
      changeAbs: 0,
      provider: 'demo',
      providerSymbol: 'DEMO',
      asOf: nowIso,
      asOfUtc: nowIso,
    } as FxRibbonQuoteDto;
  });
}

/**
 * Build demo quotes for Storybook / tests using the static demo row.
 * When specific pairIds are supplied we filter / re-order the demo row; if
 * nothing matches we fall back to the full demo row so the UI never looks
 * empty.
 */
function buildDemoQuotes(pairIds: string[] | undefined): FxRibbonQuoteDto[] {
  const nowIso = new Date().toISOString();
  const items = getDemoFxForPairIds(pairIds);

  return items.map((item) => {
    const [baseRaw, quoteRaw] = item.label.split('/').map((part) => part.trim());
    const base = baseRaw?.toUpperCase() ?? 'N/A';
    const quote = quoteRaw?.toUpperCase() ?? 'N/A';

    const mid = (item.bid + item.ask) / 2;

    return {
      pairId: item.id,
      base,
      quote,
      mid,
      bid: item.bid,
      ask: item.ask,
      changePct: item.changePct,
      changeAbs: 0,
      provider: 'demo',
      providerSymbol: 'DEMO',
      asOf: nowIso,
      asOfUtc: nowIso,
    } as FxRibbonQuoteDto;
  });
}

/**
 * Render helper for the visible label on each FX chip.
 */
function renderPairLabel(quote: FxRibbonQuoteDto): string {
  if (quote.base && quote.quote) {
    return buildPairCode(quote.base, quote.quote);
  }
  // Fallback to the raw pair id if something went wrong; this should only
  // happen in badly–formed demo data.
  return quote.pairId ?? '–';
}

/**
 * Helper for building the data-testid value used throughout the FX ribbon
 * tests. The rules are:
 *
 *   - Demo mode: "fx-" + compact pair id, e.g. "fx-GBPUSD".
 *   - Free tier / live mode: "fx-" + human label, e.g. "fx-GBP / USD".
 *
 * This matches what the various test files assert on.
 */
function getFxTestId(effectiveMode: RibbonMode, quote: FxRibbonQuoteDto): string {
  if (effectiveMode === 'demo') {
    const compact = (quote.pairId ?? '').replace(/[^A-Za-z]/g, '').toUpperCase();
    return `fx-${compact}`;
  }

  const labelCode = renderPairLabel(quote);
  return `fx-${labelCode}`;
}

export const FinanceRibbon: React.FC<FinanceRibbonProps> = (props) => {
  const hasFxPayload = !!(props.fx && props.fx.length > 0);
  const effectiveMode = getEffectiveMode(props, hasFxPayload);
  const effectiveBuildId = props.buildId ?? 'local';

  const [isPaused, setIsPaused] = React.useState(false);

  const quotes: FxRibbonQuoteDto[] = hasFxPayload
    ? (props.fx as FxRibbonQuoteDto[])
    : effectiveMode === 'demo'
    ? buildDemoQuotes(props.pairIds)
    : buildFreeTierQuotes();

  const handlePauseToggle = () => {
    const nextIsPaused = !isPaused;
    setIsPaused(nextIsPaused);

    trackRibbonPause({
      isPaused: nextIsPaused,
      source: 'homepage_ribbon',
    });
  };

  return (
    <section
      aria-label="Foreign exchange snapshot"
      data-testid="finance-ribbon"
      data-mode={effectiveMode}
      data-build-id={effectiveBuildId}
      className="w-full overflow-hidden rounded-2xl bg-slate-950 px-3 py-2 text-xs text-slate-50 shadow-md ring-1 ring-slate-800"
    >
      <div className="flex items-center justify-between gap-2">
        <ul
          aria-label="Foreign exchange pairs"
          data-testid="fx-row"
          className="flex flex-wrap items-center justify-center gap-2"
        >
          {quotes.map((quote) => {
            const label = renderPairLabel(quote);
            const midText = quote.mid.toFixed(4);
            const testId = getFxTestId(effectiveMode, quote);

            return (
              <li
                key={testId}
                className="flex items-baseline gap-1 rounded-full bg-slate-900 px-3 py-1 text-[11px] leading-none"
              >
                <button type="button" data-testid={testId} className="flex items-baseline gap-1">
                  <span className="font-semibold" data-testid="fx-label">
                    {label}
                  </span>
                  <span aria-hidden="true" className="text-slate-500">
                    ·
                  </span>
                  <span className="tabular-nums" data-testid="fx-mid">
                    {midText}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          data-testid="finance-ribbon-pause"
          aria-label="Pause live FX updates"
          aria-pressed={isPaused}
          onClick={handlePauseToggle}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 bg-slate-900/70 text-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          <span aria-hidden="true">{isPaused ? '▶' : 'Ⅱ'}</span>
        </button>
      </div>

      {effectiveMode === 'demo' && (
        <p className="mt-1 text-[10px] text-slate-400">Sample FX values, illustrative only.</p>
      )}
    </section>
  );
};

export default FinanceRibbon;
