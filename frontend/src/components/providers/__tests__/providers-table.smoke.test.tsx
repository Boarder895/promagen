// src/components/providers/__tests__/providers-table.smoke.test.tsx

import React from 'react';
import { render, screen } from '@testing-library/react';

import ProvidersTable from '../providers-table';

import type { Provider } from '@/types/provider';

const SAMPLE_PROVIDERS: Provider[] = [
  {
    id: 'alpha',
    name: 'Alpha Provider',
    score: 88,
    trend: 'up',
    tags: ['images'],
    website: 'https://example.com/alpha',
  },
  {
    id: 'beta',
    name: 'Beta Provider',
    score: 70,
    trend: 'flat',
    tags: ['text'],
  },
];

describe('ProvidersTable (smoke)', () => {
  it('renders a table with provider rows', () => {
    render(<ProvidersTable providers={SAMPLE_PROVIDERS} />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Alpha Provider')).toBeInTheDocument();
    expect(screen.getByText('Beta Provider')).toBeInTheDocument();
  });

  it('routes outbound provider links via /go (no direct external hrefs)', () => {
    render(<ProvidersTable providers={SAMPLE_PROVIDERS} />);

    const alphaLink = screen.getByRole('link', { name: 'Alpha Provider' });
    expect(alphaLink).toHaveAttribute('href', '/go/alpha?src=leaderboard');

    const allLinks = screen.getAllByRole('link');
    for (const link of allLinks) {
      const href = link.getAttribute('href') ?? '';
      expect(href.startsWith('/')).toBe(true);
      expect(href.startsWith('http')).toBe(false);
    }
  });
});
