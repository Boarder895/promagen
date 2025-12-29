// src/components/providers/__tests__/provider-workspace.smoke.test.tsx

import React from 'react';
import { render, screen } from '@testing-library/react';

import ProviderWorkspace from '../provider-workspace';
import type { Provider } from '@/types/providers';

// Mock analytics to avoid side effects in tests
jest.mock('@/lib/analytics/providers', () => ({
  trackPromptBuilderOpen: jest.fn(),
  trackPromptCopy: jest.fn(),
  trackProviderLaunch: jest.fn(),
}));

const SAMPLE_PROVIDER: Provider = {
  id: 'midjourney',
  name: 'Midjourney',
  website: 'https://midjourney.com',
  url: 'https://midjourney.com',
  affiliateUrl: null,
  requiresDisclosure: false,
  score: 92,
  trend: 'up',
  tags: ['images', 'art'],
  tagline: 'Create stunning AI art',
};

const AFFILIATE_PROVIDER: Provider = {
  id: 'leonardo',
  name: 'Leonardo',
  website: 'https://leonardo.ai',
  affiliateUrl: 'https://leonardo.ai/ref/promagen',
  requiresDisclosure: true,
  score: 88,
  trend: 'up',
  tags: ['images'],
  tagline: 'AI-powered creative tools',
};

describe('ProviderWorkspace (smoke)', () => {
  it('renders the workspace container', () => {
    render(<ProviderWorkspace provider={SAMPLE_PROVIDER} />);

    expect(screen.getByTestId('provider-workspace')).toBeInTheDocument();
  });

  it('renders PromptBuilder with provider name', () => {
    render(<ProviderWorkspace provider={SAMPLE_PROVIDER} />);

    // PromptBuilder renders a heading with provider name
    expect(
      screen.getByRole('heading', { name: /midjourney.*prompt builder/i })
    ).toBeInTheDocument();
  });

  it('renders the prompt textarea', () => {
    render(<ProviderWorkspace provider={SAMPLE_PROVIDER} />);

    expect(screen.getByLabelText(/image prompt/i)).toBeInTheDocument();
  });

  it('renders the copy prompt button', () => {
    render(<ProviderWorkspace provider={SAMPLE_PROVIDER} />);

    expect(screen.getByRole('button', { name: /copy prompt/i })).toBeInTheDocument();
  });

  it('renders LaunchPanel with launch button', () => {
    render(<ProviderWorkspace provider={SAMPLE_PROVIDER} />);

    expect(screen.getByRole('link', { name: /open midjourney/i })).toBeInTheDocument();
  });

  it('renders provider tags when available', () => {
    render(<ProviderWorkspace provider={SAMPLE_PROVIDER} />);

    expect(screen.getByText('images')).toBeInTheDocument();
    expect(screen.getByText('art')).toBeInTheDocument();
  });

  it('renders affiliate disclosure for providers requiring disclosure', () => {
    render(<ProviderWorkspace provider={AFFILIATE_PROVIDER} />);

    expect(screen.getByText(/affiliate/i)).toBeInTheDocument();
  });

  it('does not render affiliate disclosure for non-affiliate providers', () => {
    render(<ProviderWorkspace provider={SAMPLE_PROVIDER} />);

    expect(screen.queryByText(/affiliate/i)).not.toBeInTheDocument();
  });

  it('launch button links through /go route', () => {
    render(<ProviderWorkspace provider={SAMPLE_PROVIDER} />);

    const launchLink = screen.getByRole('link', { name: /open midjourney/i });
    expect(launchLink).toHaveAttribute('href', '/go/midjourney?src=prompt_builder');
  });
});
