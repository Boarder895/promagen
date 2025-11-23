// src/__tests__/finance-ribbon.inversion.test.tsx
//
// Historically the FX chips could be inverted (GBP/USD ↔ USD/GBP)
// by clicking the chip. The product decision is now to keep the
// homepage ribbon in canonical order only. These tests assert that
// clicking a chip is a no-op for the visible base / quote labels
// so we do not accidentally reintroduce inversion behaviour.

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import FinanceRibbon from '@/components/ribbon/finance-ribbon';

describe('FinanceRibbon – FX layout without inversion', () => {
  it('keeps pairs in canonical order when a chip is clicked', () => {
    render(<FinanceRibbon demo />);

    const chip = screen.getByTestId('fx-GBPUSD');
    const initialText = chip.textContent;

    expect(initialText).toContain('GBP');
    expect(initialText).toContain('USD');

    fireEvent.click(chip);

    // Clicking should not swap the visible currencies any more.
    expect(chip.textContent).toBe(initialText);
  });
});
