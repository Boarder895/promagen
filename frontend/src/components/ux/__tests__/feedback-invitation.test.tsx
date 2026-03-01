/**
 * @file src/components/ux/__tests__/feedback-invitation.test.tsx
 *
 * Phase 7.10c — Unit tests for FeedbackInvitation component.
 *
 * Tests rendering, rating interaction, dismiss behaviour, success state,
 * and auto-dismiss timing. Uses React Testing Library.
 *
 * 12 tests across 4 groups.
 *
 * Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 7.10c
 * Version: 1.0.0
 * Created: 2026-03-01
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FeedbackInvitation from '@/components/ux/feedback-invitation';
import type { FeedbackInvitationProps } from '@/components/ux/feedback-invitation';
import type { FeedbackPendingData } from '@/lib/feedback/feedback-client';

// ============================================================================
// MOCK: feedback-client
// ============================================================================

const mockSendFeedback = jest.fn().mockResolvedValue(true);
const mockClearFeedbackPending = jest.fn();
const mockRecordDismissal = jest.fn();

jest.mock('@/lib/feedback/feedback-client', () => ({
  sendFeedback: (...args: unknown[]) => mockSendFeedback(...args),
  clearFeedbackPending: () => mockClearFeedbackPending(),
  recordDismissal: () => mockRecordDismissal(),
}));

// ============================================================================
// HELPERS
// ============================================================================

function makePending(overrides?: Partial<FeedbackPendingData>): FeedbackPendingData {
  return {
    eventId: 'evt_test_456',
    platform: 'midjourney',
    tier: 2,
    copiedAt: Date.now() - 5_000,
    ...overrides,
  };
}

function renderWidget(overrides?: Partial<FeedbackInvitationProps>) {
  const defaultProps: FeedbackInvitationProps = {
    pending: makePending(),
    onComplete: jest.fn(),
    ...overrides,
  };
  return {
    ...render(<FeedbackInvitation {...defaultProps} />),
    props: defaultProps,
  };
}

// ============================================================================
// SETUP / TEARDOWN
// ============================================================================

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

// ============================================================================
// TESTS
// ============================================================================

describe('FeedbackInvitation', () => {
  // --------------------------------------------------------------------------
  // Rendering
  // --------------------------------------------------------------------------
  describe('rendering', () => {
    it('renders the feedback region with subtitle text', () => {
      renderWidget();
      expect(
        screen.getByText('Rate how the AI image matched your vision'),
      ).toBeInTheDocument();
    });

    it('renders all three rating buttons', () => {
      renderWidget();
      expect(screen.getByTestId('feedback-btn-positive')).toBeInTheDocument();
      expect(screen.getByTestId('feedback-btn-neutral')).toBeInTheDocument();
      expect(screen.getByTestId('feedback-btn-negative')).toBeInTheDocument();
    });

    it('renders dismiss button', () => {
      renderWidget();
      expect(screen.getByTestId('feedback-dismiss')).toBeInTheDocument();
    });

    it('has accessible region role and label', () => {
      renderWidget();
      const region = screen.getByRole('region', { name: 'Rate this prompt' });
      expect(region).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Rating interaction
  // --------------------------------------------------------------------------
  describe('rating interaction', () => {
    it('calls sendFeedback with correct args on positive click', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const { props } = renderWidget();

      await user.click(screen.getByTestId('feedback-btn-positive'));

      expect(mockSendFeedback).toHaveBeenCalledTimes(1);
      expect(mockSendFeedback).toHaveBeenCalledWith(
        'positive',
        props.pending,
        undefined,
      );
    });

    it('passes userContext to sendFeedback when provided', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const ctx = { userTier: 'paid', accountAgeDays: 90 };
      const { props } = renderWidget({ userContext: ctx });

      await user.click(screen.getByTestId('feedback-btn-neutral'));

      expect(mockSendFeedback).toHaveBeenCalledWith(
        'neutral',
        props.pending,
        ctx,
      );
    });

    it('shows "Thanks!" text after rating', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      renderWidget();

      await user.click(screen.getByTestId('feedback-btn-negative'));

      expect(
        screen.getByText('Thanks! Your feedback helps Promagen learn.'),
      ).toBeInTheDocument();
    });

    it('hides rating buttons after selection', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      renderWidget();

      await user.click(screen.getByTestId('feedback-btn-positive'));

      expect(screen.queryByTestId('feedback-btn-positive')).not.toBeInTheDocument();
      expect(screen.queryByTestId('feedback-btn-neutral')).not.toBeInTheDocument();
      expect(screen.queryByTestId('feedback-btn-negative')).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Dismiss
  // --------------------------------------------------------------------------
  describe('dismiss', () => {
    it('calls recordDismissal and clearFeedbackPending on dismiss click', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      renderWidget();

      await user.click(screen.getByTestId('feedback-dismiss'));

      expect(mockRecordDismissal).toHaveBeenCalledTimes(1);
      expect(mockClearFeedbackPending).toHaveBeenCalledTimes(1);
    });

    it('calls onComplete after exit animation on dismiss', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const { props } = renderWidget();

      await user.click(screen.getByTestId('feedback-dismiss'));

      // Exit animation: 300ms
      act(() => {
        jest.advanceTimersByTime(350);
      });

      expect(props.onComplete).toHaveBeenCalledTimes(1);
    });
  });

  // --------------------------------------------------------------------------
  // Auto-dismiss timing
  // --------------------------------------------------------------------------
  describe('auto-dismiss', () => {
    it('calls onComplete ~1.5s + animation after rating', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const { props } = renderWidget();

      await user.click(screen.getByTestId('feedback-btn-positive'));

      // Step 1: Thanks display (1500ms) → triggers 'submitted' → 'exiting'
      // Must be a separate act() so React re-renders and registers the
      // exit-animation useEffect before we advance past it.
      act(() => {
        jest.advanceTimersByTime(1_600);
      });

      // Step 2: Exit animation (300ms) → triggers onComplete
      act(() => {
        jest.advanceTimersByTime(400);
      });

      expect(props.onComplete).toHaveBeenCalledTimes(1);
    });

    it('does NOT call onComplete before thanks period ends', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const { props } = renderWidget();

      await user.click(screen.getByTestId('feedback-btn-positive'));

      // Only 500ms — still showing "Thanks!"
      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(props.onComplete).not.toHaveBeenCalled();
    });
  });
});
