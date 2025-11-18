// frontend/src/components/providers/__tests__/prompt-finance-toggles.test.tsx
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import PromptFinanceToggles from '../prompt-finance-toggles';
import type { FinanceWidgetPrefs } from '@/lib/ribbon/micro-widget-prefs';

describe('PromptFinanceToggles', () => {
  it('renders three toggles and calls onChange when a toggle is clicked', () => {
    const prefs: FinanceWidgetPrefs = { fx: true, commodities: false, crypto: true };
    const handleChange = jest.fn();

    render(<PromptFinanceToggles prefs={prefs} onChange={handleChange} isPaid={true} />);

    const fx = screen.getByRole('button', { name: 'FX' });
    const commodities = screen.getByRole('button', { name: 'Commodities' });
    const crypto = screen.getByRole('button', { name: 'Crypto' });

    expect(fx).toHaveAttribute('aria-pressed', 'true');
    expect(commodities).toHaveAttribute('aria-pressed', 'false');
    expect(crypto).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(commodities);

    expect(handleChange).toHaveBeenCalledWith({
      fx: true,
      commodities: true,
      crypto: true,
    });
  });

  it('renders nothing for free users', () => {
    const prefs: FinanceWidgetPrefs = { fx: true, commodities: true, crypto: true };
    const handleChange = jest.fn();

    const { container } = render(
      <PromptFinanceToggles prefs={prefs} onChange={handleChange} isPaid={false} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
