// src/app/api/stripe/webhook/__tests__/webhook.test.ts
// ============================================================================
// STRIPE WEBHOOK ROUTE — Unit Tests v1.1.0
// ============================================================================
//
// Tests the POST /api/stripe/webhook endpoint for:
// - Missing signature → 400
// - Invalid signature (verification fails) → 400
// - checkout.session.completed → tier:'paid' + periodEndDate stored
// - checkout.session.completed missing clerkUserId → no-op (no crash)
// - customer.subscription.updated → cancelAtPeriodEnd + periodEndDate stored
// - customer.subscription.updated with unknown customer → no-op
// - customer.subscription.deleted → tier:'free', periodEndDate cleared
// - Unhandled event type → 200 received:true
//
// v1.1.0: Fixed jest.mock hoisting — inline jest.fn() + jest.requireMock()
//
// Jest project: api (testMatch: src/app/api/**/*.test.ts)
// Console silencing handled by api-test-setup.ts
//
// Existing features preserved: Yes
// ============================================================================

// ── Mock modules — inline factories only, NO external variable refs ──
// jest.mock() is hoisted above all const/let/import by SWC/babel.
// Referencing a const from inside a hoisted factory causes TDZ errors.
// Fix: use jest.fn() inline, then get references via jest.requireMock().

jest.mock('@/lib/stripe/stripe', () => ({
  verifyWebhookEvent: jest.fn(),
  stripe: {
    subscriptions: {
      retrieve: jest.fn(),
    },
  },
}));

jest.mock('@clerk/nextjs/server', () => {
  // Create stable mock functions INSIDE the factory (no TDZ issues)
  const _getUser = jest.fn();
  const _updateUserMetadata = jest.fn();
  const _getUserList = jest.fn();

  return {
    clerkClient: jest.fn(async () => ({
      users: {
        getUser: _getUser,
        updateUserMetadata: _updateUserMetadata,
        getUserList: _getUserList,
      },
    })),
    // Expose inner mocks for test assertions
    __mockUsers: {
      getUser: _getUser,
      updateUserMetadata: _updateUserMetadata,
      getUserList: _getUserList,
    },
  };
});

// ── Imports (after mocks) ──

import { POST } from '../route';
import { NextRequest } from 'next/server';

// ── Get mock references via requireMock (safe — runs after hoisting resolves) ──

const stripeMocks = jest.requireMock('@/lib/stripe/stripe') as {
  verifyWebhookEvent: jest.Mock;
  stripe: { subscriptions: { retrieve: jest.Mock } };
};
const mockVerifyWebhookEvent = stripeMocks.verifyWebhookEvent;
const mockSubscriptionsRetrieve = stripeMocks.stripe.subscriptions.retrieve;

const clerkMocks = jest.requireMock('@clerk/nextjs/server') as {
  __mockUsers: {
    getUser: jest.Mock;
    updateUserMetadata: jest.Mock;
    getUserList: jest.Mock;
  };
};
const mockGetUser = clerkMocks.__mockUsers.getUser;
const mockUpdateUserMetadata = clerkMocks.__mockUsers.updateUserMetadata;
const mockGetUserList = clerkMocks.__mockUsers.getUserList;

// ============================================================================
// HELPERS
// ============================================================================

/** Build a NextRequest with the given body and optional stripe-signature header. */
function buildRequest(body: string, signature?: string): NextRequest {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (signature) headers.set('stripe-signature', signature);

  return new NextRequest('https://promagen.com/api/stripe/webhook', {
    method: 'POST',
    headers,
    body,
  });
}

/** Build a mock Stripe event object. */
function mockEvent(type: string, data: unknown) {
  return { type, data: { object: data } };
}

// ============================================================================
// SETUP
// ============================================================================

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});

  // Default: getUser returns a user with empty metadata
  mockGetUser.mockResolvedValue({
    id: 'user_test123',
    publicMetadata: {},
  });

  // Default: updateUserMetadata succeeds
  mockUpdateUserMetadata.mockResolvedValue({});

  // Default: getUserList returns one user with matching stripeCustomerId
  mockGetUserList.mockResolvedValue({
    data: [
      {
        id: 'user_test123',
        publicMetadata: { stripeCustomerId: 'cus_test456' },
      },
    ],
    totalCount: 1,
  });

  // Default: subscriptions.retrieve returns a subscription with period end
  mockSubscriptionsRetrieve.mockResolvedValue({
    current_period_end: 1713225600, // 2024-04-16T00:00:00Z
    cancel_at_period_end: false,
  });
});

// ============================================================================
// TESTS
// ============================================================================

describe('POST /api/stripe/webhook', () => {
  // ── Signature validation ──

  it('returns 400 when stripe-signature header is missing', async () => {
    const req = buildRequest('{}');
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Missing signature');
  });

  it('returns 400 when webhook signature verification fails', async () => {
    mockVerifyWebhookEvent.mockReturnValue(null);

    const req = buildRequest('{}', 'sig_invalid');
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid signature');
  });

  // ── checkout.session.completed ──

  describe('checkout.session.completed', () => {
    it('sets tier to paid and stores periodEndDate from subscription', async () => {
      mockVerifyWebhookEvent.mockReturnValue(
        mockEvent('checkout.session.completed', {
          metadata: { clerkUserId: 'user_test123' },
          customer: 'cus_test456',
          subscription: 'sub_test789',
        }),
      );

      const req = buildRequest('{}', 'sig_valid');
      const res = await POST(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.received).toBe(true);

      // Should have fetched the subscription to get period end
      expect(mockSubscriptionsRetrieve).toHaveBeenCalledWith('sub_test789');

      // Should have updated Clerk metadata with periodEndDate
      expect(mockUpdateUserMetadata).toHaveBeenCalledWith('user_test123', {
        publicMetadata: expect.objectContaining({
          tier: 'paid',
          stripeCustomerId: 'cus_test456',
          stripeSubscriptionId: 'sub_test789',
          cancelAtPeriodEnd: false,
          periodEndDate: 1713225600,
        }),
      });
    });

    it('still activates Pro even if subscription fetch fails', async () => {
      mockSubscriptionsRetrieve.mockRejectedValue(new Error('Stripe API down'));

      mockVerifyWebhookEvent.mockReturnValue(
        mockEvent('checkout.session.completed', {
          metadata: { clerkUserId: 'user_test123' },
          customer: 'cus_test456',
          subscription: 'sub_test789',
        }),
      );

      const req = buildRequest('{}', 'sig_valid');
      const res = await POST(req);

      expect(res.status).toBe(200);

      // Should still set tier to paid, just without periodEndDate
      expect(mockUpdateUserMetadata).toHaveBeenCalledWith('user_test123', {
        publicMetadata: expect.objectContaining({
          tier: 'paid',
          stripeCustomerId: 'cus_test456',
          cancelAtPeriodEnd: false,
        }),
      });
    });

    it('does not crash when clerkUserId is missing from metadata', async () => {
      mockVerifyWebhookEvent.mockReturnValue(
        mockEvent('checkout.session.completed', {
          metadata: {},
          customer: 'cus_test456',
          subscription: 'sub_test789',
        }),
      );

      const req = buildRequest('{}', 'sig_valid');
      const res = await POST(req);

      expect(res.status).toBe(200);
      // Should NOT have tried to update any Clerk user
      expect(mockUpdateUserMetadata).not.toHaveBeenCalled();
    });
  });

  // ── customer.subscription.updated ──

  describe('customer.subscription.updated', () => {
    it('stores cancelAtPeriodEnd and periodEndDate when user cancels', async () => {
      mockVerifyWebhookEvent.mockReturnValue(
        mockEvent('customer.subscription.updated', {
          customer: 'cus_test456',
          cancel_at_period_end: true,
          current_period_end: 1716249600,
        }),
      );

      const req = buildRequest('{}', 'sig_valid');
      const res = await POST(req);

      expect(res.status).toBe(200);

      expect(mockUpdateUserMetadata).toHaveBeenCalledWith('user_test123', {
        publicMetadata: expect.objectContaining({
          cancelAtPeriodEnd: true,
          periodEndDate: 1716249600,
        }),
      });
    });

    it('stores cancelAtPeriodEnd:false and updated periodEndDate on reactivation', async () => {
      mockVerifyWebhookEvent.mockReturnValue(
        mockEvent('customer.subscription.updated', {
          customer: 'cus_test456',
          cancel_at_period_end: false,
          current_period_end: 1718841600,
        }),
      );

      const req = buildRequest('{}', 'sig_valid');
      const res = await POST(req);

      expect(res.status).toBe(200);

      expect(mockUpdateUserMetadata).toHaveBeenCalledWith('user_test123', {
        publicMetadata: expect.objectContaining({
          cancelAtPeriodEnd: false,
          periodEndDate: 1718841600,
        }),
      });
    });

    it('does nothing when customer is not found in Clerk', async () => {
      mockGetUserList.mockResolvedValue({ data: [], totalCount: 0 });

      mockVerifyWebhookEvent.mockReturnValue(
        mockEvent('customer.subscription.updated', {
          customer: 'cus_unknown',
          cancel_at_period_end: true,
          current_period_end: 1716249600,
        }),
      );

      const req = buildRequest('{}', 'sig_valid');
      const res = await POST(req);

      expect(res.status).toBe(200);
      expect(mockUpdateUserMetadata).not.toHaveBeenCalled();
    });
  });

  // ── customer.subscription.deleted ──

  describe('customer.subscription.deleted', () => {
    it('reverts tier to free and clears periodEndDate', async () => {
      mockVerifyWebhookEvent.mockReturnValue(
        mockEvent('customer.subscription.deleted', {
          customer: 'cus_test456',
        }),
      );

      const req = buildRequest('{}', 'sig_valid');
      const res = await POST(req);

      expect(res.status).toBe(200);

      expect(mockUpdateUserMetadata).toHaveBeenCalledWith('user_test123', {
        publicMetadata: expect.objectContaining({
          tier: 'free',
          stripeSubscriptionId: undefined,
          cancelAtPeriodEnd: undefined,
          periodEndDate: undefined,
        }),
      });
    });
  });

  // ── Unhandled events ──

  it('returns 200 for unhandled event types', async () => {
    mockVerifyWebhookEvent.mockReturnValue(
      mockEvent('invoice.payment_succeeded', { id: 'inv_123' }),
    );

    const req = buildRequest('{}', 'sig_valid');
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);

    // No Clerk calls for unhandled events
    expect(mockUpdateUserMetadata).not.toHaveBeenCalled();
  });

  // ── Error resilience ──

  it('returns 200 with error message when handler throws', async () => {
    mockVerifyWebhookEvent.mockReturnValue(
      mockEvent('checkout.session.completed', {
        metadata: { clerkUserId: 'user_test123' },
        customer: 'cus_test456',
        subscription: 'sub_test789',
      }),
    );

    // Make getUser throw to simulate Clerk outage
    mockGetUser.mockRejectedValue(new Error('Clerk API unavailable'));

    const req = buildRequest('{}', 'sig_valid');
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
    expect(body.error).toContain('Clerk API unavailable');
  });
});
