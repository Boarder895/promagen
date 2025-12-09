import { render, screen } from '@testing-library/react';

import { MiniCommoditiesWidget } from '../mini-commodities-widget';

describe('MiniCommoditiesWidget', () => {
  test('renders the full free commodities set (currently 7 items)', () => {
    render(<MiniCommoditiesWidget />);

    const container = screen.getByTestId('mini-commodities-widget');
    const items = (container as HTMLElement).querySelectorAll('li');

    // Spec: 7 chips in a 2·3·2 layout, driven by commodities.free.json
    expect(items.length).toBe(7);
  });
});
