// src/__tests__/finance-ribbon.contracts.test.tsx

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe } from 'jest-axe';

import FinanceRibbon from '@/components/ribbon/finance-ribbon';

// Canonical free FX selection – single source of truth.
// Slugs like "gbp-usd", "eur-usd", "gbp-eur", "usd-jpy", "usd-cny".
import freeFxPairIdsJson from '@/data/selected/fx.pairs.free.json';

const FREE_FX_IDS = freeFxPairIdsJson as string[];

/**
 * Matches the current FinanceRibbon API:
 *   - pairIds?: string[]
 *   - intervalMs?: number
 *   - demo?: boolean
 *
 * Behaviour:
 *   - When no pairIds are provided:
 *       → show exactly the free FX pairs from fx.pairs.free.json.
 *   - When pairIds are provided:
 *       → render exactly those, in that order.
 *   - intervalMs remains an optional hint prop and must be accepted.
 */
describe('FinanceRibbon (pairIds API)', () => {
  it('exposes a labelled foreign-exchange overview region', () => {
    render(<FinanceRibbon demo />);

    // We expect the ribbon wrapper to be a labelled section for FX.
    const region = screen.getByLabelText(/foreign exchange/i);
    expect(region).toBeInTheDocument();
    expect(region.tagName.toLowerCase()).toBe('section');
  });

  it('shows the default free pairs when no pairIds are provided', () => {
    render(<FinanceRibbon demo />);

    // Data-testid format is fx-TICKER, where TICKER is the upper-case
    // compact code, e.g. "GBPUSD", "EURUSD", "GBPEUR", "USDJPY", "USDCNY".
    for (const slug of FREE_FX_IDS) {
      const ticker = slug.replace(/-/g, '').toUpperCase();
      expect(screen.getByTestId(`fx-${ticker}`)).toBeInTheDocument();
    }

    // And we render exactly that many <li> items – no more, no fewer.
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(FREE_FX_IDS.length);
  });

  it('renders exactly the ids passed via pairIds', () => {
    render(<FinanceRibbon demo pairIds={['EURUSD', 'USDJPY']} />);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);

    expect(screen.getByTestId('fx-EURUSD')).toBeInTheDocument();
    expect(screen.getByTestId('fx-USDJPY')).toBeInTheDocument();
  });

  it('accepts intervalMs as an optional prop', () => {
    render(<FinanceRibbon demo pairIds={['EURUSD']} intervalMs={0} />);

    // Smoke: if the component renders and the chip is present, we are happy.
    expect(screen.getByTestId('fx-EURUSD')).toBeInTheDocument();
  });

  it('has no basic axe accessibility violations in demo mode', async () => {
    const { container } = render(<FinanceRibbon demo />);

    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});
