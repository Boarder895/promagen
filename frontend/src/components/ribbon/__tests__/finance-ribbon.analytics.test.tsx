// src/components/ribbon/__tests__/finance-ribbon.analytics.test.tsx

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import FinanceRibbon from '@/components/ribbon/finance-ribbon';
import { trackRibbonPause } from '@/lib/analytics/finance';

jest.mock('@/lib/analytics/finance', () => ({
  // Preserve any other exports from the finance analytics module.
  ...jest.requireActual('@/lib/analytics/finance'),
  trackRibbonPause: jest.fn(),
}));

describe('FinanceRibbon analytics', () => {
  it('fires trackRibbonPause when the pause button is clicked', () => {
    render(<FinanceRibbon demo />);

    const pauseButton = screen.getByTestId('finance-ribbon-pause');

    fireEvent.click(pauseButton);

    expect(trackRibbonPause).toHaveBeenCalledTimes(1);
    expect(trackRibbonPause).toHaveBeenCalledWith({
      isPaused: true,
      source: 'homepage_ribbon',
    });
  });
});
