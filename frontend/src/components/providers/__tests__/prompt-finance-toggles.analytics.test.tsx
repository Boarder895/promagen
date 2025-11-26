// frontend/src/components/providers/__tests__/prompt-finance-toggles.analytics.test.tsx

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import PromptFinanceToggles from '../prompt-finance-toggles';
import type { FinanceWidgetPrefs } from '@/lib/ribbon/micro-widget-prefs';
import { trackFinanceToggle } from '@/lib/analytics/finance';

jest.mock('@/lib/analytics/finance', () => ({
  trackFinanceToggle: jest.fn(),
}));

describe('PromptFinanceToggles analytics', () => {
  it('fires trackFinanceToggle when a toggle is clicked', () => {
    const prefs: FinanceWidgetPrefs = { fx: true, commodities: false, crypto: true };
    const handleChange = jest.fn();

    render(<PromptFinanceToggles prefs={prefs} onChange={handleChange} isPaid={true} />);

    const commodities = screen.getByRole('button', { name: 'Commodities' });

    fireEvent.click(commodities);

    expect(handleChange).toHaveBeenCalledWith({
      fx: true,
      commodities: true,
      crypto: true,
    });

    expect(trackFinanceToggle).toHaveBeenCalledTimes(1);
    expect(trackFinanceToggle).toHaveBeenCalledWith({
      assetClass: 'commodities',
      state: 'on',
    });
  });
});
