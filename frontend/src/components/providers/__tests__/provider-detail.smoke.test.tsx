import React from 'react';
import { render, screen } from '@testing-library/react';

import ProviderDetail from '../provider-detail';

import type { Provider } from '@/types/providers';

const SAMPLE_PROVIDER: Provider = {
  id: 'midjourney',
  name: 'Midjourney',
  score: 92,
  trend: 'up',
  tags: ['images'],
  website: 'https://example.com/midjourney',
  affiliateUrl: null,
  tagline: 'Best-in-class images.',
  tip: 'Try short prompts first, then iterate.',
  requiresDisclosure: true,
};

describe('ProviderDetail (smoke)', () => {
  it('renders provider details', () => {
    render(<ProviderDetail provider={SAMPLE_PROVIDER} />);

    expect(screen.getByRole('heading', { name: 'Midjourney' })).toBeInTheDocument();
    expect(screen.getByText(/provider id/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /prompt builder/i })).toBeInTheDocument();
  });

  it('routes outbound CTAs via /go (no direct external hrefs)', () => {
    render(<ProviderDetail provider={SAMPLE_PROVIDER} />);

    const visit = screen.getByRole('link', { name: /visit provider site/i });
    expect(visit).toHaveAttribute('href', '/go/midjourney?src=provider_detail');

    const officialSite = screen.getByRole('link', {
      name: /https:\/\/example\.com\/midjourney/i,
    });
    expect(officialSite).toHaveAttribute('href', '/go/midjourney?src=provider_detail');

    const allLinks = screen.getAllByRole('link');
    for (const link of allLinks) {
      const href = link.getAttribute('href') ?? '';
      expect(href.startsWith('/')).toBe(true);
      expect(href.startsWith('http')).toBe(false);
    }
  });
});
