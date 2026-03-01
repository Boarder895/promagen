/**
 * @file src/components/ux/__tests__/feedback-memory-banner.test.tsx
 *
 * Phase 7.10g — Unit tests for FeedbackMemoryBanner.
 *
 * 10 tests across 3 groups.
 *
 * Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 7.10g
 * Version: 1.0.0
 * Created: 2026-03-01
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FeedbackMemoryBanner } from '@/components/ux/feedback-memory-banner';
import type { FeedbackOverlap } from '@/hooks/use-feedback-memory';

// ============================================================================
// HELPERS
// ============================================================================

function makeOverlap(
  rating: 'positive' | 'neutral' | 'negative',
  terms: string[] = ['cinematic lighting', 'bokeh'],
): FeedbackOverlap {
  return {
    rating,
    overlappingTerms: terms,
    timestamp: '2026-01-01T00:00:00Z',
  };
}

// ============================================================================
// SETUP
// ============================================================================

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

// ============================================================================
// Rendering
// ============================================================================

describe('FeedbackMemoryBanner — rendering', () => {
  it('renders nothing when overlap is null', () => {
    const { container } = render(
      <FeedbackMemoryBanner
        overlap={null}
        platformName="Midjourney"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders positive message with overlapping terms', () => {
    render(
      <FeedbackMemoryBanner
        overlap={makeOverlap('positive')}
        platformName="Midjourney"
      />,
    );
    const msg = screen.getByTestId('feedback-memory-message');
    expect(msg.textContent).toContain('cinematic lighting');
    expect(msg.textContent).toContain('bokeh');
    expect(msg.textContent).toContain('👍');
  });

  it('renders negative message with "consider alternatives"', () => {
    render(
      <FeedbackMemoryBanner
        overlap={makeOverlap('negative', ['watercolor', 'hyperrealistic'])}
        platformName="DALL·E 3"
      />,
    );
    const msg = screen.getByTestId('feedback-memory-message');
    expect(msg.textContent).toContain('watercolor');
    expect(msg.textContent).toContain('consider alternatives');
  });

  it('renders neutral message with "rated as okay"', () => {
    render(
      <FeedbackMemoryBanner
        overlap={makeOverlap('neutral')}
        platformName="Midjourney"
      />,
    );
    const msg = screen.getByTestId('feedback-memory-message');
    expect(msg.textContent).toContain('rated as okay');
  });

  it('shows "+N more" when more than 3 overlapping terms', () => {
    render(
      <FeedbackMemoryBanner
        overlap={makeOverlap('positive', ['a', 'b', 'c', 'd', 'e'])}
        platformName="Midjourney"
      />,
    );
    const msg = screen.getByTestId('feedback-memory-message');
    expect(msg.textContent).toContain('+2 more');
  });
});

// ============================================================================
// User tier messaging
// ============================================================================

describe('FeedbackMemoryBanner — user tier', () => {
  it('shows pro message for paid users', () => {
    render(
      <FeedbackMemoryBanner
        overlap={makeOverlap('positive')}
        platformName="Midjourney"
        userTier="paid"
      />,
    );
    expect(screen.getByText(/weighted 1\.25×/i)).toBeDefined();
  });

  it('shows generic message for free users', () => {
    render(
      <FeedbackMemoryBanner
        overlap={makeOverlap('positive')}
        platformName="Midjourney"
        userTier="free"
      />,
    );
    expect(screen.getByText(/helps Promagen learn/i)).toBeDefined();
  });
});

// ============================================================================
// Dismiss
// ============================================================================

describe('FeedbackMemoryBanner — dismiss', () => {
  it('dismiss button removes banner', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const onDismiss = jest.fn();
    render(
      <FeedbackMemoryBanner
        overlap={makeOverlap('positive')}
        platformName="Midjourney"
        onDismiss={onDismiss}
      />,
    );

    await user.click(screen.getByTestId('feedback-memory-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('banner disappears from DOM after dismiss', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <FeedbackMemoryBanner
        overlap={makeOverlap('positive')}
        platformName="Midjourney"
      />,
    );

    await user.click(screen.getByTestId('feedback-memory-dismiss'));
    expect(screen.queryByTestId('feedback-memory-banner')).toBeNull();
  });

  it('has accessible dismiss button', () => {
    render(
      <FeedbackMemoryBanner
        overlap={makeOverlap('positive')}
        platformName="Midjourney"
      />,
    );
    const btn = screen.getByTestId('feedback-memory-dismiss');
    expect(btn.getAttribute('aria-label')).toContain('Dismiss');
  });
});
