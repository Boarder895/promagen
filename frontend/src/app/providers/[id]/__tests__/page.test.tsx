// src/app/providers/[id]/__tests__/page.test.tsx
//
// Smoke + interaction tests for the provider prompt builder page.
// Authority: docs/authority/prompt-builder-page.md § Testing requirements

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ProviderPage from '../page';

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

// Mock analytics to avoid side effects
jest.mock('@/lib/analytics/providers', () => ({
  trackPromptBuilderOpen: jest.fn(),
  trackPromptCopy: jest.fn(),
  trackProviderLaunch: jest.fn(),
}));

// Mock the providers API
jest.mock('@/lib/providers/api', () => ({
  getProviders: () => [
    {
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
    },
    {
      id: 'leonardo',
      name: 'Leonardo',
      website: 'https://leonardo.ai',
      affiliateUrl: 'https://leonardo.ai/ref/promagen',
      requiresDisclosure: true,
      score: 88,
      trend: 'up',
      tags: ['images'],
      tagline: 'AI-powered creative tools',
    },
  ],
}));

// Mock exchange-order to avoid SSOT dependencies
jest.mock('@/lib/exchange-order', () => ({
  getRailsForHomepage: () => ({
    left: [],
    right: [],
  }),
}));

// Mock weather data
jest.mock('@/lib/weather/exchange-weather', () => ({
  DEMO_EXCHANGE_WEATHER: [],
}));

// Mock the FinanceRibbon to simplify rendering
jest.mock('@/components/ribbon/finance-ribbon.container', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-finance-ribbon">Finance Ribbon</div>,
}));

// ─────────────────────────────────────────────────────────────────────────────
// Smoke Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('ProviderPage (smoke)', () => {
  it('renders for valid provider ID', () => {
    render(<ProviderPage params={{ id: 'midjourney' }} />);

    // Main heading should mention the provider
    expect(
      screen.getByRole('heading', { name: /midjourney.*prompt builder/i, level: 2 })
    ).toBeInTheDocument();
  });

  it('renders "not found" state for invalid provider ID', () => {
    render(<ProviderPage params={{ id: 'nonexistent-provider' }} />);

    // The "Provider not found" heading in the not-found section
    expect(screen.getByText(/provider not found/i)).toBeInTheDocument();

    // The provider ID appears in multiple places (sr-only h1 + error message),
    // so use getAllByText and verify at least one match exists.
    const matches = screen.getAllByText(/nonexistent-provider/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders PromptBuilder section with textarea', () => {
    render(<ProviderPage params={{ id: 'midjourney' }} />);

    // The prompt editor region
    expect(screen.getByRole('region', { name: /prompt editor/i })).toBeInTheDocument();

    // The textarea
    expect(screen.getByLabelText(/image prompt/i)).toBeInTheDocument();
  });

  it('renders LaunchPanel section with button', () => {
    render(<ProviderPage params={{ id: 'midjourney' }} />);

    // Launch panel region
    expect(screen.getByRole('region', { name: /launch midjourney/i })).toBeInTheDocument();

    // Launch button
    expect(screen.getByRole('link', { name: /open midjourney/i })).toBeInTheDocument();
  });

  it('renders copy prompt button', () => {
    render(<ProviderPage params={{ id: 'midjourney' }} />);

    expect(screen.getByRole('button', { name: /copy prompt/i })).toBeInTheDocument();
  });

  it('renders exchange rails (empty state)', () => {
    render(<ProviderPage params={{ id: 'midjourney' }} />);

    // Both rails should be present (even if empty)
    expect(screen.getByTestId('rail-east-wrapper')).toBeInTheDocument();
    expect(screen.getByTestId('rail-west-wrapper')).toBeInTheDocument();
  });

  it('renders finance ribbon when showFinanceRibbon is true', () => {
    render(<ProviderPage params={{ id: 'midjourney' }} />);

    expect(screen.getByTestId('mock-finance-ribbon')).toBeInTheDocument();
  });

  it('renders affiliate disclosure for affiliate providers', () => {
    render(<ProviderPage params={{ id: 'leonardo' }} />);

    expect(screen.getByText(/affiliate/i)).toBeInTheDocument();
  });

  it('does not render affiliate disclosure for non-affiliate providers', () => {
    render(<ProviderPage params={{ id: 'midjourney' }} />);

    expect(screen.queryByText(/affiliate/i)).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Interaction Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('ProviderPage (interaction)', () => {
  it('launch button href matches /go/[id]?src=prompt_builder', () => {
    render(<ProviderPage params={{ id: 'midjourney' }} />);

    const launchLink = screen.getByRole('link', { name: /open midjourney/i });
    expect(launchLink).toHaveAttribute('href', '/go/midjourney?src=prompt_builder');
  });

  it('launch button opens in new tab', () => {
    render(<ProviderPage params={{ id: 'midjourney' }} />);

    const launchLink = screen.getByRole('link', { name: /open midjourney/i });
    expect(launchLink).toHaveAttribute('target', '_blank');
    expect(launchLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('copy button is clickable', async () => {
    const user = userEvent.setup();
    render(<ProviderPage params={{ id: 'midjourney' }} />);

    const copyButton = screen.getByRole('button', { name: /copy prompt/i });

    // Should not throw when clicked
    await user.click(copyButton);

    // Button should still be present
    expect(copyButton).toBeInTheDocument();
  });

  it('not found state includes link back to home', () => {
    render(<ProviderPage params={{ id: 'nonexistent' }} />);

    const homeLink = screen.getByRole('link', { name: /return to leaderboard/i });
    expect(homeLink).toHaveAttribute('href', '/');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Accessibility Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('ProviderPage (accessibility)', () => {
  it('has accessible main region', () => {
    render(<ProviderPage params={{ id: 'midjourney' }} />);

    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('textarea has associated label', () => {
    render(<ProviderPage params={{ id: 'midjourney' }} />);

    const textarea = screen.getByLabelText(/image prompt/i);
    expect(textarea).toBeInTheDocument();
    expect(textarea.tagName.toLowerCase()).toBe('textarea');
  });

  it('launch button has external link indication', () => {
    render(<ProviderPage params={{ id: 'midjourney' }} />);

    // The aria-label should indicate it opens in a new tab
    const launchLink = screen.getByRole('link', { name: /open midjourney.*new tab/i });
    expect(launchLink).toBeInTheDocument();
  });

  it('interactive elements are keyboard accessible', async () => {
    const user = userEvent.setup();
    render(<ProviderPage params={{ id: 'midjourney' }} />);

    // Tab through interactive elements
    await user.tab();
    await user.tab();
    await user.tab();

    // Should be able to tab to interactive elements without errors
    expect(document.activeElement).not.toBe(document.body);
  });
});
