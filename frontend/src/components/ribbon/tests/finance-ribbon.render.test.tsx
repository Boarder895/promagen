// src/components/ribbon/tests/finance-ribbon.render.test.tsx

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// FinanceRibbon is a default export
import FinanceRibbon from '../finance-ribbon';

describe('FinanceRibbon render (smoke)', () => {
  it('renders with provided pairIds', () => {
    render(<FinanceRibbon demo pairIds={['EURUSD', 'GBPUSD']} />);

    expect(screen.getByTestId('fx-EURUSD')).toBeInTheDocument();
    expect(screen.getByTestId('fx-GBPUSD')).toBeInTheDocument();

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
  });

  it('renders the default free set when pairIds are omitted', () => {
    render(<FinanceRibbon demo />);

    // We don’t hard-code the exact IDs here – the contract test in
    // src/__tests__/finance-ribbon.contracts.test.tsx already does that.
    // This smoke test just asserts that:
    //   - the component renders
    //   - and we have at least 5 chips present.
    const items = screen.getAllByRole('listitem');
    expect(items.length).toBeGreaterThanOrEqual(5);
  });
});
