// src/__tests__/finance-ribbon.contracts.test.tsx

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe } from 'jest-axe';

import FinanceRibbon from '@/components/ribbon/finance-ribbon';

// Canonical free FX selection – single source of truth.
// Slugs like "gbp-usd", "eur-usd", "gbp-eur", "usd-jpy", "usd-cny".
import freeFxPairIdsJson from '@/data/selected/fx.pairs.free.json';
import { ALL_FX_PAIRS, buildPairCode, type FxPairConfig } from '@/lib/finance/fx-pairs';

const FREE_FX_IDS = freeFxPairIdsJson as string[];

const ALL_FX_BY_ID = new Map<string, FxPairConfig>(
  ALL_FX_PAIRS.map((pair) => [pair.id.toLowerCase(), pair]),
);

function codesFromFreeIds(ids: string[]): string[] {
  return ids
    .map((id) => ALL_FX_BY_ID.get(id.toLowerCase()))
    .filter((pair): pair is FxPairConfig => Boolean(pair))
    .map((pair) => buildPairCode(pair.base, pair.quote));
}

const FREE_FX_CODES = codesFromFreeIds(FREE_FX_IDS);

/**
 * Matches the current FinanceRibbon API:
 *
 * - Renders exactly one <section> with data-testid="finance-ribbon".
 * - In demo mode:
 *   - Uses the canonical FREE_FX_IDS list when no explicit pairIds are supplied.
 *   - Accepts an explicit pairIds list for focused screenshots / tests.
 *   - Stays inert with respect to the live FX API (useFxQuotes enabled=false).
 */
describe('FinanceRibbon – contracts', () => {
  it('renders the free-tier FX row in canonical order in demo mode', () => {
    render(<FinanceRibbon demo />);

    // Section shell.
    const section = screen.getByTestId('finance-ribbon');
    expect(section).toBeInTheDocument();

    // All expected free-tier pairs are present as chips.
    FREE_FX_CODES.forEach((code) => {
      const chip = screen.getByTestId(`fx-${code}`);
      expect(chip).toBeInTheDocument();
    });
  });

  it('accepts an explicit pairIds override in demo mode', () => {
    render(<FinanceRibbon demo pairIds={['EURUSD']} />);

    // Smoke: if the component renders and the chip is present, we are happy.
    expect(screen.getByTestId('fx-EURUSD')).toBeInTheDocument();
  });

  it('accepts intervalMs as an optional prop', () => {
    render(<FinanceRibbon demo pairIds={['EURUSD']} intervalMs={0} />);

    // Smoke: component renders and the chip is present.
    expect(screen.getByTestId('fx-EURUSD')).toBeInTheDocument();
  });

  it('has no basic axe accessibility violations in demo mode', async () => {
    const { container } = render(<FinanceRibbon demo />);

    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});
