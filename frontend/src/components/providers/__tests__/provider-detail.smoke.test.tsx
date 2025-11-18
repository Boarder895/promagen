// src/components/providers/__tests__/provider-detail.smoke.test.tsx

import React from 'react';
import { render, screen } from '@testing-library/react';

import ProviderDetail from '../provider-detail';
import type { Provider } from '@/types/providers';

const SAMPLE_PROVIDER: Provider = {
  id: 'midjourney',
  name: 'Midjourney',
  country: 'United States',
  score: 92,
  trend: 'up',
  tags: ['images', 'creative'],
  url: 'https://example.com/midjourney',
  affiliateUrl: 'https://affiliate.example.com/midjourney',
  requiresDisclosure: true,
  tagline: 'Leading creative image generator',
  category: 'images',
  emoji: '🎨',
};

describe('ProviderDetail (smoke)', () => {
  it('renders key provider fields and primary actions', () => {
    render(<ProviderDetail provider={SAMPLE_PROVIDER} id={SAMPLE_PROVIDER.id} />);

    // Heading and basic label
    expect(screen.getByRole('heading', { name: /midjourney/i })).toBeInTheDocument();
    expect(screen.getByText(/ai provider/i)).toBeInTheDocument();

    // Score + value
    expect(screen.getByText(/promagen score/i)).toBeInTheDocument();
    expect(screen.getByText('92')).toBeInTheDocument();

    // Trend pill – assert against the accessible name
    expect(screen.getByLabelText(/trending up/i)).toBeInTheDocument();

    // Tags rendered as chips
    expect(screen.getByText('images')).toBeInTheDocument();
    expect(screen.getByText('creative')).toBeInTheDocument();

    // Primary actions
    expect(screen.getByRole('link', { name: /craft an image prompt/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /visit provider site/i })).toBeInTheDocument();
  });

  it('renders a friendly fallback when the provider is missing', () => {
    render(<ProviderDetail provider={null} id="unknown-provider" />);

    expect(screen.getByText(/not in the current promagen catalogue/i)).toBeInTheDocument();
  });
});
