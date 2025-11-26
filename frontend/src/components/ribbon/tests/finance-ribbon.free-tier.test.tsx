// frontend/src/components/ribbon/tests/finance-ribbon.free-tier.test.tsx
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import { FinanceRibbon } from '../finance-ribbon';
import { ALL_FX_PAIRS, DEFAULT_FREE_FX_PAIR_IDS, buildPairCode } from '@/lib/finance/fx-pairs';

jest.mock('@/hooks/use-fx-selection', () => ({
  useFxSelection: () => ({ pairIds: [] as string[] }),
}));

const mockUseFxQuotes = jest.fn();

jest.mock('@/hooks/use-fx-quotes', () => ({
  useFxQuotes: (options: unknown) => {
    mockUseFxQuotes(options);
    return {
      status: 'success',
      quotesByPairId: new Map(),
    };
  },
}));

describe('FinanceRibbon – free tier', () => {
  it('renders exactly five FX chips in the expected order', () => {
    render(<FinanceRibbon />);

    const list = screen.getByRole('list', { name: /foreign exchange pairs/i });
    const buttons = within(list).getAllByRole('button');

    expect(buttons).toHaveLength(5);

    const expectedCodes = DEFAULT_FREE_FX_PAIR_IDS.map((id) => {
      const pair = ALL_FX_PAIRS.find((candidate) => candidate.id === id);
      if (!pair) {
        throw new Error(`Missing FX pair config for id "${id}" in ALL_FX_PAIRS`);
      }
      return buildPairCode(pair.base, pair.quote);
    }).slice(0, 5);

    const actualCodes = buttons.map((button) => {
      const testId = button.getAttribute('data-testid');
      if (!testId) {
        throw new Error('FX chip button is missing data-testid');
      }
      return testId.replace(/^fx-/, '');
    });

    expect(actualCodes).toEqual(expectedCodes);
  });
});
