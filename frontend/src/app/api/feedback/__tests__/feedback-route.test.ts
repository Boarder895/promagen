// src/app/api/feedback/__tests__/feedback-route.test.ts
// ============================================================================
// FEEDBACK SUBMISSION ROUTE — Unit Tests
// ============================================================================
//
// Phase 7.10b — API Route tests.
//
// Tests the POST /api/feedback endpoint for:
// - Valid submissions (201 Created)
// - Zod validation failures (400)
// - Rate limiting (429)
// - Safe mode (200 + skipped)
// - No database (200 + skipped)
// - Duplicate feedback (200 + duplicate)
// - Database errors (503)
//
// Follows the pattern established by api.weather.route.test.ts.
//
// Console silencing handled by api-test-setup.ts (setupFilesAfterFramework).
//
// Existing features preserved: Yes.
// ============================================================================

 

// ── Mock external modules BEFORE imports ──

let mockSafeModeEnabled = false;
let mockIsProd = false;
let mockHasDb = true;

jest.mock('@/lib/env', () => ({
  env: {
    get safeMode() {
      return { enabled: mockSafeModeEnabled };
    },
    get isProd() {
      return mockIsProd;
    },
  },
}));

jest.mock('@/lib/db', () => ({
  db: jest.fn(() => jest.fn()),
  hasDatabaseConfigured: jest.fn(() => mockHasDb),
}));

let mockInsertResult = true;

jest.mock('@/lib/learning/database', () => ({
  ensureAllTables: jest.fn(),
  insertFeedbackEvent: jest.fn(() => Promise.resolve(mockInsertResult)),
}));

// Rate limiting: always allow by default
let mockRateLimitAllowed = true;

jest.mock('@/lib/rate-limit', () => ({
  rateLimit: jest.fn(() =>
    mockRateLimitAllowed
      ? {
          allowed: true as const,
          limit: 5,
          remaining: 4,
          resetAt: new Date().toISOString(),
        }
      : {
          allowed: false as const,
          limit: 5,
          remaining: 0,
          resetAt: new Date().toISOString(),
          retryAfterSeconds: 60,
          reason: 'rate_limited' as const,
        },
  ),
}));

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((payload: unknown, init?: { status?: number; headers?: Headers }) => {
      return {
        ok: (init?.status ?? 200) < 400,
        status: init?.status ?? 200,
        headers: init?.headers ?? new Headers(),
        json: async () => payload,
      } as unknown as Response;
    }),
  },
}));

// ── Now import the route ──

import { insertFeedbackEvent } from '@/lib/learning/database';

import { POST } from '../route';

// ── Helpers ──

function buildValidBody(overrides: Record<string, unknown> = {}) {
  return {
    promptEventId: 'evt_test-1234',
    rating: 'positive',
    credibilityScore: 1.25,
    credibilityFactors: { tier: 1.25, age: 1.0, frequency: 1.0, speed: 1.0 },
    responseTimeMs: 30_000,
    platform: 'midjourney',
    tier: 2,
    userTier: 'paid',
    accountAgeDays: 45,
    ...overrides,
  };
}

function buildRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as Request;
}

// ── Reset mocks between tests ──

beforeEach(() => {
  jest.clearAllMocks();
  mockSafeModeEnabled = false;
  mockIsProd = false;
  mockHasDb = true;
  mockRateLimitAllowed = true;
  mockInsertResult = true;
});

// ============================================================================
// Happy path
// ============================================================================

describe('POST /api/feedback — happy path', () => {
  it('returns 201 with id on valid submission', async () => {
    const res = await POST(buildRequest(buildValidBody()) as any);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.ok).toBe(true);
    expect(json.id).toMatch(/^fb_/);
    expect(json.requestId).toBeDefined();
  });

  it('calls insertFeedbackEvent with correct arguments', async () => {
    await POST(buildRequest(buildValidBody()) as any);

    expect(insertFeedbackEvent).toHaveBeenCalledTimes(1);

    const call = (insertFeedbackEvent as jest.Mock).mock.calls[0]![0];
    expect(call.promptEventId).toBe('evt_test-1234');
    expect(call.rating).toBe('positive');
    expect(call.credibilityScore).toBe(1.25);
    expect(call.platform).toBe('midjourney');
    expect(call.tier).toBe(2);
    expect(call.userTier).toBe('paid');
    expect(call.accountAgeDays).toBe(45);
  });

  it('accepts neutral rating', async () => {
    const res = await POST(
      buildRequest(buildValidBody({ rating: 'neutral' })) as any,
    );
    expect(res.status).toBe(201);
  });

  it('accepts negative rating', async () => {
    const res = await POST(
      buildRequest(buildValidBody({ rating: 'negative' })) as any,
    );
    expect(res.status).toBe(201);
  });

  it('accepts null userTier (anonymous)', async () => {
    const res = await POST(
      buildRequest(buildValidBody({ userTier: null })) as any,
    );
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.ok).toBe(true);
  });

  it('accepts null accountAgeDays', async () => {
    const res = await POST(
      buildRequest(buildValidBody({ accountAgeDays: null })) as any,
    );
    expect(res.status).toBe(201);
  });
});

// ============================================================================
// Validation failures (400)
// ============================================================================

describe('POST /api/feedback — validation', () => {
  it('rejects missing promptEventId', async () => {
    const body = buildValidBody();
    delete (body as any).promptEventId;

    const res = await POST(buildRequest(body) as any);
    expect(res.status).toBe(400);
  });

  it('rejects empty promptEventId', async () => {
    const res = await POST(
      buildRequest(buildValidBody({ promptEventId: '' })) as any,
    );
    expect(res.status).toBe(400);
  });

  it('rejects invalid rating', async () => {
    const res = await POST(
      buildRequest(buildValidBody({ rating: 'amazing' })) as any,
    );
    expect(res.status).toBe(400);
  });

  it('rejects missing rating', async () => {
    const body = buildValidBody();
    delete (body as any).rating;

    const res = await POST(buildRequest(body) as any);
    expect(res.status).toBe(400);
  });

  it('rejects credibilityScore > 2', async () => {
    const res = await POST(
      buildRequest(buildValidBody({ credibilityScore: 5 })) as any,
    );
    expect(res.status).toBe(400);
  });

  it('rejects negative credibilityScore', async () => {
    const res = await POST(
      buildRequest(buildValidBody({ credibilityScore: -0.5 })) as any,
    );
    expect(res.status).toBe(400);
  });

  it('rejects tier outside 1-4', async () => {
    const res = await POST(
      buildRequest(buildValidBody({ tier: 5 })) as any,
    );
    expect(res.status).toBe(400);
  });

  it('rejects responseTimeMs > 7 days', async () => {
    const res = await POST(
      buildRequest(
        buildValidBody({ responseTimeMs: 8 * 24 * 60 * 60 * 1_000 }),
      ) as any,
    );
    expect(res.status).toBe(400);
  });

  it('rejects invalid JSON', async () => {
    const req = new Request('http://localhost:3000/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });

    const res = await POST(req as any);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Invalid JSON');
  });
});

// ============================================================================
// Rate limiting (429)
// ============================================================================

describe('POST /api/feedback — rate limiting', () => {
  it('returns 429 when rate limited', async () => {
    mockRateLimitAllowed = false;

    const res = await POST(buildRequest(buildValidBody()) as any);
    expect(res.status).toBe(429);

    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error).toBe('Rate limited');
  });
});

// ============================================================================
// Safe mode
// ============================================================================

describe('POST /api/feedback — safe mode', () => {
  it('returns 200 + skipped when safe mode enabled', async () => {
    mockSafeModeEnabled = true;

    const res = await POST(buildRequest(buildValidBody()) as any);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.skipped).toBe(true);
    expect(json.reason).toBe('safe_mode');
  });

  it('does not call insertFeedbackEvent in safe mode', async () => {
    mockSafeModeEnabled = true;

    await POST(buildRequest(buildValidBody()) as any);
    expect(insertFeedbackEvent).not.toHaveBeenCalled();
  });
});

// ============================================================================
// No database
// ============================================================================

describe('POST /api/feedback — no database', () => {
  it('returns 200 + skipped when no database configured', async () => {
    mockHasDb = false;

    const res = await POST(buildRequest(buildValidBody()) as any);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.skipped).toBe(true);
    expect(json.reason).toBe('no_database');
  });
});

// ============================================================================
// Duplicate feedback (idempotent)
// ============================================================================

describe('POST /api/feedback — duplicate handling', () => {
  it('returns 200 + duplicate when already rated', async () => {
    mockInsertResult = false; // insertFeedbackEvent returns false = duplicate

    const res = await POST(buildRequest(buildValidBody()) as any);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.duplicate).toBe(true);
  });
});

// ============================================================================
// Database errors (503)
// ============================================================================

describe('POST /api/feedback — database errors', () => {
  it('returns 503 when insertFeedbackEvent throws', async () => {
    (insertFeedbackEvent as jest.Mock).mockRejectedValueOnce(
      new Error('Connection refused'),
    );

    const res = await POST(buildRequest(buildValidBody()) as any);
    expect(res.status).toBe(503);

    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error).toBe('Storage unavailable');
  });
});
