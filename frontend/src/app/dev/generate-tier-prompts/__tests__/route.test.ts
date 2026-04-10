// src/app/api/dev/generate-tier-prompts/__tests__/route.test.ts
// ============================================================================
// Tests for POST /api/dev/generate-tier-prompts — Call 2 Quality Harness
// ============================================================================
// Pattern: jest.mock() with inline factories (matches parse-sentence.test.ts).
// jest.mock() is hoisted above imports by SWC — no TDZ issues.
//
// Coverage (15 tests):
//   ── Auth gates (5) ──
//   1.  Missing X-Dev-Auth header                       → 404
//   2.  Wrong X-Dev-Auth header                         → 404
//   3.  Production env (isProd=true) + correct auth     → 404
//   4.  Endpoint disabled (no secret configured)        → 404
//   5.  Secret too short                                → 404
//
//   ── Input validation (3) ──
//   6.  Invalid JSON body                               → 400
//   7.  Missing systemPrompt                            → 400
//   8.  Empty userMessage after sanitisation            → 400
//
//   ── Operational gates (4 — added v1.1 per ChatGPT review) ──
//   9.  Rate limit triggered                            → 429
//   10. Missing OpenAI key                              → 500 CONFIG_ERROR
//   11. OpenAI returns non-OK                           → 502 OPENAI_ERROR
//   12. Engine returns content not matching TierBundle  → 502 SCHEMA_ERROR
//
//   ── Happy path + feature (2) ──
//   13. Correct auth + valid request → 200 with all four stages and metadata
//   14. reasoningEffort is forwarded to OpenAI as reasoning_effort when set
//
//   ── THE BIG ONE: rescue dependency signature (1) ──
//   15. Stage A T2 has duplicate --no blocks (model bug);
//       Stage B onwards has them merged (cleanup rescued).
//       This is the mechanical proof the harness can see what production hides.
//
// Authority: call-2-harness-build-plan-v1.md Phase A §5.2,
//            ChatGPT review of Phase A drop (10 Apr 2026)
// Jest project: api (testMatch: src/app/api/**/*.test.ts)
// Console silencing handled by api-test-setup.ts
// ============================================================================

// ── Mock modules — hoisted above all imports by SWC ─────────────────────────

jest.mock('@/lib/env', () => ({
  env: {
    isProd: false,
    isTest: true,
    nodeEnv: 'test',
    providers: {
      openAiApiKey: 'test-openai-key',
      twelveDataApiKey: undefined,
    },
    call2HarnessDevAuth: 'test-secret-32-chars-long-12345678',
  },
}));

jest.mock('@/lib/rate-limit', () => ({
  rateLimit: jest.fn(() => ({
    allowed: true,
    limit: 60,
    remaining: 59,
    resetAt: new Date(Date.now() + 60_000).toISOString(),
  })),
}));

// NOTE: We deliberately do NOT mock @/lib/harmony-post-processing or
// @/lib/harmony-compliance. The whole point of test 15 is to verify the REAL
// post-processing pipeline rescues a model bug, end-to-end. Mocking those
// would defeat the test.

// ── Imports ─────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { POST } from '../route';

// ── Mutable mock references ─────────────────────────────────────────────────

const mockEnv = jest.requireMock('@/lib/env') as {
  env: {
    isProd: boolean;
    isTest: boolean;
    nodeEnv: string;
    providers: { openAiApiKey: string | undefined; twelveDataApiKey: undefined };
    call2HarnessDevAuth: string | undefined;
  };
};

const mockRateLimit = jest.requireMock('@/lib/rate-limit') as {
  rateLimit: jest.Mock;
};

// ── Constants ───────────────────────────────────────────────────────────────

const VALID_AUTH = 'test-secret-32-chars-long-12345678';
const ENDPOINT = 'http://localhost:3000/api/dev/generate-tier-prompts';

const STUB_SYSTEM_PROMPT =
  'You are a test stub system prompt for the Call 2 quality harness. Return JSON with tier1, tier2, tier3, tier4 keys.';

// Lighthouse keeper canonical scene (Martin's confirmed wording, 10 Apr 2026).
const LIGHTHOUSE_KEEPER =
  'A weathered lighthouse keeper stands on the rain-soaked gallery deck at twilight, gripping the iron railing as enormous storm waves crash against the jagged rocks below. Salt spray rises high into the purple-and-copper sky while the lighthouse beam cuts a pale gold arc through sheets of driving rain, and a distant fishing village glows with tiny warm orange windows against the dark cliffs. Low, cinematic wide-angle view.';

// ── Fixtures ────────────────────────────────────────────────────────────────

// A clean four-tier response with no rescue-needed bugs.
const CLEAN_TIER_BUNDLE = {
  tier1: {
    positive:
      'masterpiece, best quality, weathered lighthouse keeper, storm waves, twilight, sharp focus, 8K',
    negative: 'blurry, low quality',
  },
  tier2: {
    // NOTE: must include --ar, --v, --s AND --no so that enforceMjParameters
    // Step 2 (which auto-adds missing params) does not fire and mutate this
    // fixture in ways the test isn't asserting on.
    positive:
      'cinematic wide angle of a weathered lighthouse keeper on a storm-lashed gallery deck at twilight --ar 16:9 --v 6 --s 500 --no blurry, low quality',
    negative: '',
  },
  tier3: {
    positive:
      'A weathered lighthouse keeper grips the iron railing of a rain-soaked gallery deck at twilight. Enormous storm waves crash against the jagged rocks below as the beam cuts gold through driving rain.',
    negative: '',
  },
  tier4: {
    positive:
      'An old lighthouse keeper stands on the gallery deck in a storm. Big waves crash on the rocks below and the light cuts through the rain.',
    negative: '',
  },
};

// A response where T2 has DUPLICATE --no blocks. This is the model bug that
// post-processing rescues. Stage A should have it; Stage B/C/D should not.
//
// Includes --s 500 explicitly so enforceMjParameters Step 2 (auto-add missing
// params) does NOT fire — that way the test isolates exactly ONE rescue
// mechanism: deduplicateMjParams collapsing two --no blocks at Stage B.
const RESCUE_NEEDED_TIER_BUNDLE = {
  ...CLEAN_TIER_BUNDLE,
  tier2: {
    positive:
      'cinematic wide angle of a weathered lighthouse keeper on a storm-lashed gallery deck at twilight --ar 16:9 --v 6 --s 500 --no blurry --no low quality',
    negative: '',
  },
};

// ── Fetch mock helpers ──────────────────────────────────────────────────────

const originalFetch = global.fetch;

// Storage for the most recent fetch call's request body, for tests that need
// to assert what was sent to OpenAI.
let lastFetchBody: Record<string, unknown> | null = null;

function mockOpenAiResponse(tierBundle: unknown) {
  const openaiBody = {
    model: 'gpt-5.4-mini-2026-02-15',
    usage: { prompt_tokens: 1842, completion_tokens: 612 },
    choices: [
      {
        finish_reason: 'stop',
        message: { content: JSON.stringify(tierBundle) },
      },
    ],
  };
  global.fetch = jest.fn((_url: unknown, init?: { body?: string }) => {
    if (init?.body) {
      try {
        lastFetchBody = JSON.parse(init.body) as Record<string, unknown>;
      } catch {
        lastFetchBody = null;
      }
    }
    return Promise.resolve(
      new Response(JSON.stringify(openaiBody), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }) as unknown as typeof global.fetch;
}

// Mock that returns raw content (not a tier bundle) so the route's
// TierBundleSchema.safeParse fails — for the SCHEMA_ERROR test.
function mockOpenAiRawContent(rawContent: string) {
  const openaiBody = {
    model: 'gpt-5.4-mini-2026-02-15',
    usage: { prompt_tokens: 100, completion_tokens: 50 },
    choices: [
      {
        finish_reason: 'stop',
        message: { content: rawContent },
      },
    ],
  };
  global.fetch = jest.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify(openaiBody), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  ) as unknown as typeof global.fetch;
}

function mockOpenAiNonOk(status: number, errorBody: unknown) {
  global.fetch = jest.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify(errorBody), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  ) as unknown as typeof global.fetch;
}

function makeReq(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function withAuth(extra: Record<string, string> = {}): Record<string, string> {
  return { 'X-Dev-Auth': VALID_AUTH, ...extra };
}

function makeValidBody(overrides: Record<string, unknown> = {}): unknown {
  return {
    systemPrompt: STUB_SYSTEM_PROMPT,
    userMessage: LIGHTHOUSE_KEEPER,
    ...overrides,
  };
}

// ============================================================================

describe('POST /api/dev/generate-tier-prompts', () => {
  beforeEach(() => {
    // Reset env to defaults before each test
    mockEnv.env.isProd = false;
    mockEnv.env.providers.openAiApiKey = 'test-openai-key';
    mockEnv.env.call2HarnessDevAuth = VALID_AUTH;
    // Reset rate-limit mock to "allowed" default
    mockRateLimit.rateLimit.mockImplementation(() => ({
      allowed: true,
      limit: 60,
      remaining: 59,
      resetAt: new Date(Date.now() + 60_000).toISOString(),
    }));
    // Reset captured fetch body
    lastFetchBody = null;
    // Default fetch mock returns clean tier bundle
    mockOpenAiResponse(CLEAN_TIER_BUNDLE);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // ── AUTH GATES ────────────────────────────────────────────────────────────

  describe('auth gates', () => {
    it('returns 404 when X-Dev-Auth header is missing', async () => {
      const req = makeReq(makeValidBody());
      const res = await POST(req as never);
      expect(res.status).toBe(404);
    });

    it('returns 404 when X-Dev-Auth header is wrong', async () => {
      const req = makeReq(makeValidBody(), { 'X-Dev-Auth': 'wrong-secret' });
      const res = await POST(req as never);
      expect(res.status).toBe(404);
    });

    it('returns 404 in production even with correct auth', async () => {
      mockEnv.env.isProd = true;
      const req = makeReq(makeValidBody(), withAuth());
      const res = await POST(req as never);
      expect(res.status).toBe(404);
    });

    it('returns 404 when CALL2_HARNESS_DEV_AUTH is not configured', async () => {
      mockEnv.env.call2HarnessDevAuth = undefined;
      const req = makeReq(makeValidBody(), withAuth());
      const res = await POST(req as never);
      expect(res.status).toBe(404);
    });

    it('returns 404 when CALL2_HARNESS_DEV_AUTH is too short', async () => {
      mockEnv.env.call2HarnessDevAuth = 'short';
      const req = makeReq(makeValidBody(), { 'X-Dev-Auth': 'short' });
      const res = await POST(req as never);
      expect(res.status).toBe(404);
    });
  });

  // ── INPUT VALIDATION ──────────────────────────────────────────────────────

  describe('input validation', () => {
    it('returns 400 for invalid JSON body', async () => {
      const req = makeReq('not json at all', withAuth());
      const res = await POST(req as never);
      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe('INVALID_JSON');
    });

    it('returns 400 when systemPrompt is missing', async () => {
      const req = makeReq({ userMessage: LIGHTHOUSE_KEEPER }, withAuth());
      const res = await POST(req as never);
      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when userMessage is empty after sanitisation', async () => {
      const req = makeReq(
        makeValidBody({ userMessage: '<p></p><span></span>' }),
        withAuth(),
      );
      const res = await POST(req as never);
      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe('VALIDATION_ERROR');
    });
  });

  // ── OPERATIONAL GATES (v1.1 — added per ChatGPT review) ───────────────────

  describe('operational gates', () => {
    it('returns 429 when rate limit is exceeded', async () => {
      mockRateLimit.rateLimit.mockImplementation(() => ({
        allowed: false,
        limit: 60,
        remaining: 0,
        resetAt: new Date(Date.now() + 60_000).toISOString(),
        retryAfterSeconds: 42,
        reason: 'rate_limited',
      }));
      const req = makeReq(makeValidBody(), withAuth());
      const res = await POST(req as never);
      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBe('42');
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe('RATE_LIMITED');
    });

    it('returns 500 CONFIG_ERROR when OpenAI key is missing', async () => {
      mockEnv.env.providers.openAiApiKey = undefined;
      const req = makeReq(makeValidBody(), withAuth());
      const res = await POST(req as never);
      expect(res.status).toBe(500);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe('CONFIG_ERROR');
    });

    it('returns 502 OPENAI_ERROR when OpenAI returns non-OK', async () => {
      mockOpenAiNonOk(503, { error: { message: 'Service unavailable' } });
      const req = makeReq(makeValidBody(), withAuth());
      const res = await POST(req as never);
      expect(res.status).toBe(502);
      const data = (await res.json()) as {
        error: string;
        status: number;
        openaiError: unknown;
      };
      expect(data.error).toBe('OPENAI_ERROR');
      expect(data.status).toBe(503);
      expect(data.openaiError).toEqual({
        error: { message: 'Service unavailable' },
      });
    });

    it('returns 502 SCHEMA_ERROR when engine content does not match TierBundle', async () => {
      // Engine returns valid JSON, but the JSON is not a tier bundle (no
      // tier1/tier2/tier3/tier4 keys). This is what happens when GPT
      // hallucinates a different shape.
      mockOpenAiRawContent('{"foo": "bar", "baz": [1, 2, 3]}');
      const req = makeReq(makeValidBody(), withAuth());
      const res = await POST(req as never);
      expect(res.status).toBe(502);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe('SCHEMA_ERROR');
    });
  });

  // ── HAPPY PATH + FEATURE TESTS ────────────────────────────────────────────

  describe('happy path', () => {
    it('returns 200 with all four stages and metadata', async () => {
      const req = makeReq(makeValidBody(), withAuth());
      const res = await POST(req as never);
      expect(res.status).toBe(200);

      const data = (await res.json()) as {
        stage_a_raw_model: unknown;
        stage_b_post_processed: unknown;
        stage_c_compliance_enforced: unknown;
        stage_d_final: unknown;
        metadata: {
          model_version: string;
          latency_ms: number;
          tokens_used: { prompt: number | null; completion: number | null };
          stages_applied: readonly string[];
          provider_context_present: boolean;
          reasoning_effort: string | null;
        };
      };

      // All four stages present
      expect(data.stage_a_raw_model).toBeDefined();
      expect(data.stage_b_post_processed).toBeDefined();
      expect(data.stage_c_compliance_enforced).toBeDefined();
      expect(data.stage_d_final).toBeDefined();

      // Each stage has all four tiers
      const stageA = data.stage_a_raw_model as Record<string, unknown>;
      expect(stageA.tier1).toBeDefined();
      expect(stageA.tier2).toBeDefined();
      expect(stageA.tier3).toBeDefined();
      expect(stageA.tier4).toBeDefined();

      // Metadata sanity
      expect(data.metadata.model_version).toBe('gpt-5.4-mini-2026-02-15');
      expect(typeof data.metadata.latency_ms).toBe('number');
      expect(data.metadata.tokens_used.prompt).toBe(1842);
      expect(data.metadata.tokens_used.completion).toBe(612);
      expect(data.metadata.stages_applied).toEqual(['a', 'b', 'c', 'd']);
      expect(data.metadata.provider_context_present).toBe(false);
      expect(data.metadata.reasoning_effort).toBeNull();
    });

    it('forwards reasoningEffort to OpenAI as reasoning_effort when provided', async () => {
      const req = makeReq(
        makeValidBody({ reasoningEffort: 'high' }),
        withAuth(),
      );
      const res = await POST(req as never);
      expect(res.status).toBe(200);

      // Verify the body sent to OpenAI included reasoning_effort
      expect(lastFetchBody).not.toBeNull();
      expect(lastFetchBody?.reasoning_effort).toBe('high');

      // Verify the response metadata reflects it
      const data = (await res.json()) as {
        metadata: { reasoning_effort: string | null };
      };
      expect(data.metadata.reasoning_effort).toBe('high');
    });
  });

  // ── RESCUE DEPENDENCY SIGNATURE — the whole point of Phase A ──────────────

  describe('rescue dependency signature (the whole point of Phase A)', () => {
    it('Stage A preserves duplicate --no blocks; Stages B/C/D have them merged', async () => {
      mockOpenAiResponse(RESCUE_NEEDED_TIER_BUNDLE);

      const req = makeReq(makeValidBody(), withAuth());
      const res = await POST(req as never);
      expect(res.status).toBe(200);

      const data = (await res.json()) as {
        stage_a_raw_model: { tier2: { positive: string } };
        stage_b_post_processed: { tier2: { positive: string } };
        stage_c_compliance_enforced: { tier2: { positive: string } };
        stage_d_final: { tier2: { positive: string } };
      };

      const stageAT2 = data.stage_a_raw_model.tier2.positive;
      const stageBT2 = data.stage_b_post_processed.tier2.positive;
      const stageDT2 = data.stage_d_final.tier2.positive;

      // Stage A: model bug intact — TWO --no blocks
      const stageANoCount = (stageAT2.match(/--no\s/g) ?? []).length;
      expect(stageANoCount).toBe(2);
      expect(stageAT2).toContain('--no blurry --no low quality');

      // Stage B: rescued — ONE --no block, both terms preserved
      const stageBNoCount = (stageBT2.match(/--no\s/g) ?? []).length;
      expect(stageBNoCount).toBe(1);
      expect(stageBT2).toContain('--no blurry, low quality');

      // Stage D: same as Stage B (no further mutation in this case)
      expect(stageDT2).toBe(stageBT2);

      // The diff between A and D is the rescue. This is the mechanical proof
      // the harness can see what production hides.
      expect(stageAT2).not.toBe(stageDT2);
    });
  });
});
