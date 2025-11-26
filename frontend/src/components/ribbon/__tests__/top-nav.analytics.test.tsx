// src/components/nav/__tests__/top-nav.analytics.test.tsx

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import TopNav from '@/components/nav/top-nav';
import { trackNavClick } from '@/lib/analytics/nav';

jest.mock('@/lib/analytics/nav', () => ({
  trackNavClick: jest.fn(),
}));

describe('TopNav analytics', () => {
  it('fires trackNavClick for the Prompt Designer link', () => {
    render(<TopNav />);

    const link = screen.getByRole('link', { name: /prompt designer/i });
    fireEvent.click(link);

    expect(trackNavClick).toHaveBeenCalledWith({
      label: 'Prompt Designer',
      href: '/designer',
    });
  });

  it('fires trackNavClick for the My Prompts link', () => {
    render(<TopNav />);

    const link = screen.getByRole('link', { name: /my prompts/i });
    fireEvent.click(link);

    expect(trackNavClick).toHaveBeenCalledWith({
      label: 'My Prompts',
      href: '/saved',
    });
  });
});
