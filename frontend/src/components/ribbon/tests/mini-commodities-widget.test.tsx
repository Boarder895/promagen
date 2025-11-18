// src/components/ribbon/tests/mini-commodities-widget.test.tsx

import React from 'react';
import { render, screen } from '@testing-library/react';

import MiniCommoditiesWidget from '../mini-commodities-widget';

/**
 * The free commodities selection currently returns 5 items.
 * This test locks in that the widget renders all of them.
 * If the free set expands (e.g. to 7 for a 2–3–2 layout), this
 * expectation should be updated alongside the data change.
 */
describe('MiniCommoditiesWidget', () => {
  it('renders the full free commodities set (currently 5 items)', () => {
    render(<MiniCommoditiesWidget />);

    const container = screen.getByTestId('mini-commodities-widget');
    const items = (container as HTMLElement).querySelectorAll('li');

    expect(items.length).toBe(5);
  });
});
