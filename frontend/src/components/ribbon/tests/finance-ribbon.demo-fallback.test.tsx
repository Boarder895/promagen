// frontend/src/components/ribbon/tests/finance-ribbon.demo-fallback.test.tsx
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import { FinanceRibbon } from '../finance-ribbon';

jest.mock('@/hooks/use-fx-selection', () => ({
  useFxSelection: () => ({ pairIds: [] as string[] }),
}));

jest.mock('@/hooks/use-fx-quotes', () => ({
  useFxQuotes: () => ({
    status: 'success',
    quotesByPairId: new Map(),
  }),
}));

describe('FinanceRibbon – demo fallback', () => {
  it('renders five FX chips and marks demo mode as illustrative only', () => {
    render(<FinanceRibbon demo />);

    const list = screen.getByRole('list', { name: /foreign exchange pairs/i });
    const chips = within(list).getAllByRole('button');
    expect(chips).toHaveLength(5);

    const demoText = screen.getByText(/sample fx values, illustrative only/i);
    expect(demoText).toBeInTheDocument();
  });
});
