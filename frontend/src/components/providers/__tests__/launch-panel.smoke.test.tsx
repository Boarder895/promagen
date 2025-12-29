// src/components/providers/__tests__/launch-panel.smoke.test.tsx

import React from 'react';
import { render, screen } from '@testing-library/react';

import LaunchPanel from '../launch-panel';

// Mock analytics to avoid side effects in tests
jest.mock('@/lib/analytics/providers', () => ({
  trackProviderLaunch: jest.fn(),
}));

const SAMPLE_PROVIDER = {
  id: 'midjourney',
  name: 'Midjourney',
  requiresDisclosure: false,
  tagline: 'Create stunning AI art with Midjourney',
};

const AFFILIATE_PROVIDER = {
  id: 'leonardo',
  name: 'Leonardo',
  requiresDisclosure: true,
  tagline: 'AI-powered creative tools',
};

describe('LaunchPanel (smoke)', () => {
  it('renders the launch button with provider name', () => {
    render(<LaunchPanel provider={SAMPLE_PROVIDER} />);

    const launchLink = screen.getByRole('link', { name: /open midjourney/i });
    expect(launchLink).toBeInTheDocument();
    expect(launchLink).toHaveAttribute('href', '/go/midjourney?src=prompt_builder');
    expect(launchLink).toHaveAttribute('target', '_blank');
    expect(launchLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders provider tagline when provided', () => {
    render(<LaunchPanel provider={SAMPLE_PROVIDER} />);

    expect(screen.getByText(/create stunning ai art/i)).toBeInTheDocument();
  });

  it('does not render affiliate badge when requiresDisclosure is false', () => {
    render(<LaunchPanel provider={SAMPLE_PROVIDER} />);

    expect(screen.queryByText(/affiliate/i)).not.toBeInTheDocument();
  });

  it('renders affiliate badge when requiresDisclosure is true', () => {
    render(<LaunchPanel provider={AFFILIATE_PROVIDER} />);

    expect(screen.getByText(/affiliate/i)).toBeInTheDocument();
  });

  it('uses custom src parameter when provided', () => {
    render(<LaunchPanel provider={SAMPLE_PROVIDER} src="custom_source" />);

    const launchLink = screen.getByRole('link', { name: /open midjourney/i });
    expect(launchLink).toHaveAttribute('href', '/go/midjourney?src=custom_source');
  });

  it('has accessible section label', () => {
    render(<LaunchPanel provider={SAMPLE_PROVIDER} />);

    expect(screen.getByRole('region', { name: /launch midjourney/i })).toBeInTheDocument();
  });

  it('renders workflow hint text', () => {
    render(<LaunchPanel provider={SAMPLE_PROVIDER} />);

    expect(screen.getByText(/your prompt is ready/i)).toBeInTheDocument();
  });
});
