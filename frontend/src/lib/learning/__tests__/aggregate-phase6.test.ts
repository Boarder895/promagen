/**
 * Tests for Learning Aggregation Cron — Phase 6 Integration (Part 6.8)
 *
 * Strategy:
 * - Mock next/server (NextResponse.json doesn't work in Jest runtime)
 * - Route reads PROMAGEN_CRON_SECRET and PHASE_6_SCORING_ENABLED at
 *   request time, so just set process.env before each call.
 * - Static import after all jest.mock() calls — mocks stay connected.
 */

import { LEARNING_CONSTANTS } from '@/lib/learning/constants';

// ── Mock next/server ─────────────────────────────────────────────────────────
// Jest doesn't have a full Next.js server runtime. Both the static
// NextResponse.json() and the instance .json() need to work.
jest.mock('next/server', () => {
  class MockNextResponse {
    public status: number;
    public headers: Map<string, string>;
    private _body: unknown;

    constructor(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
      this._body = body;
      this.status = init?.status ?? 200;
      this.headers = new Map(Object.entries(init?.headers ?? {}));
    }

    async json(): Promise<unknown> {
      if (typeof this._body === 'string') return JSON.parse(this._body);
      return this._body;
    }

    static json(
      body: unknown,
      init?: { status?: number; headers?: Record<string, string> },
    ): MockNextResponse {
      return new MockNextResponse(body, {
        status: init?.status ?? 200,
        headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
      });
    }
  }

  return { NextResponse: MockNextResponse };
});

// ── Default mock return values ───────────────────────────────────────────────
const DEFAULT_SCORING_WEIGHTS = {
  version: '1.0.0',
  generatedAt: new Date().toISOString(),
  eventCount: 200,
  global: { subject: 0.3, fill: 0.3, coherence: 0.2, negative: 0.2 },
  tiers: {},
};

const DEFAULT_CATEGORY_VALUES = {
  version: '1.0.0',
  generatedAt: new Date().toISOString(),
  tiers: { '1': {}, '2': {} },
};

const DEFAULT_TERM_QUALITY = {
  version: '1.0.0',
  generatedAt: new Date().toISOString(),
  global: { termCount: 50, terms: {} },
  tiers: {},
};

const DEFAULT_THRESHOLDS = {
  version: '1.0.0',
  generatedAt: new Date().toISOString(),
  global: { threshold: 85, eventCount: 200, bucketCount: 6 },
  tiers: {},
};

const DEFAULT_HEALTH_REPORT = {
  version: '1.0.0',
  generatedAt: new Date().toISOString(),
  overallCorrelation: 0.72,
  correlationTrend: 0.03,
  weightDrift: 0.12,
  tierCorrelations: {},
  alerts: [],
  history: [],
};

// ── Mock database ────────────────────────────────────────────────────────────
const mockEnsureAllTables = jest.fn().mockResolvedValue(undefined);
const mockAcquireLock = jest.fn().mockResolvedValue(true);
const mockReleaseLock = jest.fn().mockResolvedValue(undefined);
const mockCountEvents = jest.fn().mockResolvedValue(500);
const mockFetchEvents = jest.fn().mockResolvedValue(
  Array.from({ length: 200 }, (_, i) => ({
    id: `evt_${i}`,
    session_id: `sess_${i % 20}`,
    user_id: null,
    tier: (i % 4) + 1,
    provider: 'test-provider',
    categories_filled: JSON.stringify({ subject: 'landscape', lighting: 'golden hour' }),
    terms_used: JSON.stringify(['sunset', 'mountain', 'dramatic']),
    score: 70 + (i % 30),
    score_factors: JSON.stringify({ categoryCount: 3, coherence: 0.8, negative: 0 }),
    outcome: JSON.stringify({ copied: i % 3 === 0, saved: i % 5 === 0 }),
    created_at: new Date().toISOString(),
  })),
);
const mockUpsertWeights = jest.fn().mockResolvedValue(undefined);
const mockGetWeights = jest.fn().mockResolvedValue(null);
const mockLogCronRun = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/learning/database', () => ({
  ensureAllTables: (...args: unknown[]) => mockEnsureAllTables(...args),
  acquireAggregationLock: (...args: unknown[]) => mockAcquireLock(...args),
  releaseAggregationLock: (...args: unknown[]) => mockReleaseLock(...args),
  countQualifyingEvents: (...args: unknown[]) => mockCountEvents(...args),
  fetchQualifyingEvents: (...args: unknown[]) => mockFetchEvents(...args),
  upsertLearnedWeights: (...args: unknown[]) => mockUpsertWeights(...args),
  getLearnedWeights: (...args: unknown[]) => mockGetWeights(...args),
  logCronRun: (...args: unknown[]) => mockLogCronRun(...args),
}));

// ── Mock Phase 5 computation modules ─────────────────────────────────────────
jest.mock('@/lib/learning/co-occurrence', () => ({
  computeCoOccurrenceMatrix: jest.fn().mockReturnValue({
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    eventCount: 200,
    totalPairs: 50,
    tiers: {},
  }),
}));

jest.mock('@/lib/learning/sequence-patterns', () => ({
  computeSequencePatterns: jest.fn().mockReturnValue({
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    sessionCount: 20,
    tiers: {},
  }),
}));

jest.mock('@/lib/learning/scene-candidates', () => ({
  computeSceneCandidates: jest.fn().mockReturnValue({
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    eventsConsidered: 200,
    clustersFormed: 5,
    candidates: [{ id: 'c1' }],
  }),
}));

jest.mock('@/data/scenes/scene-starters.json', () => ({
  version: '1.0.0',
  scenes: [],
}));

// ── Mock Phase 6 computation modules ─────────────────────────────────────────
const mockComputeScoringWeights = jest.fn().mockReturnValue(DEFAULT_SCORING_WEIGHTS);
const mockComputeCategoryValues = jest.fn().mockReturnValue(DEFAULT_CATEGORY_VALUES);
const mockComputeTermQualityScores = jest.fn().mockReturnValue(DEFAULT_TERM_QUALITY);
const mockDiscoverThresholds = jest.fn().mockReturnValue(DEFAULT_THRESHOLDS);
const mockGenerateHealthReport = jest.fn().mockReturnValue(DEFAULT_HEALTH_REPORT);

jest.mock('@/lib/learning/weight-recalibration', () => ({
  computeScoringWeights: (...args: unknown[]) => mockComputeScoringWeights(...args),
}));

jest.mock('@/lib/learning/category-value-discovery', () => ({
  computeCategoryValues: (...args: unknown[]) => mockComputeCategoryValues(...args),
}));

jest.mock('@/lib/learning/term-quality-scoring', () => ({
  computeTermQualityScores: (...args: unknown[]) => mockComputeTermQualityScores(...args),
}));

jest.mock('@/lib/learning/threshold-discovery', () => ({
  discoverThresholds: (...args: unknown[]) => mockDiscoverThresholds(...args),
}));

jest.mock('@/lib/learning/scorer-health', () => ({
  generateHealthReport: (...args: unknown[]) => mockGenerateHealthReport(...args),
}));

// ── Import route AFTER all mocks are declared ────────────────────────────────
import { GET } from '@/app/api/learning/aggregate/route';

// =============================================================================
// HELPERS
// =============================================================================

function buildCronRequest(params: { dryRun?: boolean } = {}): Request {
  const secret = 'test-cron-secret-long-enough';
  const dryRunParam = params.dryRun ? '&dryRun=1' : '';
  const url = `http://localhost:3000/api/learning/aggregate?secret=${secret}${dryRunParam}`;
  return new Request(url, {
    method: 'GET',
    headers: { 'x-promagen-cron': secret },
  });
}

function resetPhase6MockDefaults(): void {
  mockComputeScoringWeights.mockReturnValue(DEFAULT_SCORING_WEIGHTS);
  mockComputeCategoryValues.mockReturnValue(DEFAULT_CATEGORY_VALUES);
  mockComputeTermQualityScores.mockReturnValue(DEFAULT_TERM_QUALITY);
  mockDiscoverThresholds.mockReturnValue(DEFAULT_THRESHOLDS);
  mockGenerateHealthReport.mockReturnValue(DEFAULT_HEALTH_REPORT);
}

// =============================================================================
// TESTS
// =============================================================================

describe('Aggregation Cron — Phase 6 Integration', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    resetPhase6MockDefaults();
    mockGetWeights.mockResolvedValue(null);
    process.env.PROMAGEN_CRON_SECRET = 'test-cron-secret-long-enough';
    process.env.PHASE_6_SCORING_ENABLED = 'false';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Feature flag gating
  // ─────────────────────────────────────────────────────────────────────────

  describe('Feature flag gating', () => {
    it('skips Phase 6 when PHASE_6_SCORING_ENABLED is false', async () => {
      process.env.PHASE_6_SCORING_ENABLED = 'false';
      const res = await GET(buildCronRequest() as never);
      const body = await res.json();

      expect(body.ok).toBe(true);
      expect(body.phase6Enabled).toBe(false);
      expect(body.scoringWeightsGenerated).toBe(false);
      expect(body.termQualityGenerated).toBe(false);
      expect(body.scorerHealthCorrelation).toBeNull();
      expect(body.phase6DurationMs).toBe(0);

      expect(mockComputeScoringWeights).not.toHaveBeenCalled();
      expect(mockComputeCategoryValues).not.toHaveBeenCalled();
      expect(mockComputeTermQualityScores).not.toHaveBeenCalled();
      expect(mockDiscoverThresholds).not.toHaveBeenCalled();
      expect(mockGenerateHealthReport).not.toHaveBeenCalled();
    });

    it('skips Phase 6 when PHASE_6_SCORING_ENABLED is unset', async () => {
      delete process.env.PHASE_6_SCORING_ENABLED;
      const res = await GET(buildCronRequest() as never);
      const body = await res.json();

      expect(body.ok).toBe(true);
      expect(body.phase6Enabled).toBe(false);
      expect(mockComputeScoringWeights).not.toHaveBeenCalled();
    });

    it('runs Phase 6 when PHASE_6_SCORING_ENABLED is true', async () => {
      process.env.PHASE_6_SCORING_ENABLED = 'true';
      const res = await GET(buildCronRequest() as never);
      const body = await res.json();

      expect(body.ok).toBe(true);
      expect(body.phase6Enabled).toBe(true);
      expect(body.scoringWeightsGenerated).toBe(true);
      expect(body.termQualityGenerated).toBe(true);
      expect(body.scorerHealthCorrelation).toBe(0.72);
      expect(body.phase6DurationMs).toBeGreaterThanOrEqual(0);
    });

    it('handles case-insensitive and whitespace-padded flag', async () => {
      process.env.PHASE_6_SCORING_ENABLED = '  True  ';
      const res = await GET(buildCronRequest() as never);
      const body = await res.json();

      expect(body.phase6Enabled).toBe(true);
      expect(mockComputeScoringWeights).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 6 execution
  // ─────────────────────────────────────────────────────────────────────────

  describe('Phase 6 execution', () => {
    beforeEach(() => {
      process.env.PHASE_6_SCORING_ENABLED = 'true';
    });

    it('fetches previous run data for all Phase 6 modules', async () => {
      await GET(buildCronRequest() as never);

      expect(mockGetWeights).toHaveBeenCalledTimes(4);
      expect(mockGetWeights).toHaveBeenCalledWith(LEARNING_CONSTANTS.SCORING_WEIGHTS_KEY);
      expect(mockGetWeights).toHaveBeenCalledWith(LEARNING_CONSTANTS.TERM_QUALITY_KEY);
      expect(mockGetWeights).toHaveBeenCalledWith(LEARNING_CONSTANTS.THRESHOLD_DISCOVERY_KEY);
      expect(mockGetWeights).toHaveBeenCalledWith(LEARNING_CONSTANTS.SCORER_HEALTH_KEY);
    });

    it('passes previous weights to computeScoringWeights', async () => {
      const mockPreviousWeights = { ...DEFAULT_SCORING_WEIGHTS, eventCount: 100 };
      mockGetWeights.mockImplementation((key: string) => {
        if (key === LEARNING_CONSTANTS.SCORING_WEIGHTS_KEY) {
          return Promise.resolve({ data: mockPreviousWeights, updatedAt: '2025-01-01T00:00:00Z' });
        }
        return Promise.resolve(null);
      });

      await GET(buildCronRequest() as never);

      expect(mockComputeScoringWeights).toHaveBeenCalledWith(
        expect.any(Array),
        mockPreviousWeights,
      );
    });

    it('passes previous term quality to computeTermQualityScores', async () => {
      const mockPreviousTermQuality = { ...DEFAULT_TERM_QUALITY };
      mockGetWeights.mockImplementation((key: string) => {
        if (key === LEARNING_CONSTANTS.TERM_QUALITY_KEY) {
          return Promise.resolve({
            data: mockPreviousTermQuality,
            updatedAt: '2025-01-01T00:00:00Z',
          });
        }
        return Promise.resolve(null);
      });

      await GET(buildCronRequest() as never);

      expect(mockComputeTermQualityScores).toHaveBeenCalledWith(
        expect.any(Array),
        mockPreviousTermQuality,
      );
    });

    it('calls all five Phase 6 computation modules', async () => {
      await GET(buildCronRequest() as never);

      expect(mockComputeScoringWeights).toHaveBeenCalledTimes(1);
      expect(mockComputeCategoryValues).toHaveBeenCalledTimes(1);
      expect(mockComputeTermQualityScores).toHaveBeenCalledTimes(1);
      expect(mockDiscoverThresholds).toHaveBeenCalledTimes(1);
      expect(mockGenerateHealthReport).toHaveBeenCalledTimes(1);
    });

    it('passes current weights to generateHealthReport', async () => {
      await GET(buildCronRequest() as never);

      expect(mockGenerateHealthReport).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ version: '1.0.0' }),
        null,
        null,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Persistence
  // ─────────────────────────────────────────────────────────────────────────

  describe('Phase 6 persistence', () => {
    beforeEach(() => {
      process.env.PHASE_6_SCORING_ENABLED = 'true';
    });

    it('persists all 5 Phase 6 results with correct keys', async () => {
      await GET(buildCronRequest() as never);

      // Phase 5: 3 writes + Phase 6: 5 writes = 8 total
      expect(mockUpsertWeights).toHaveBeenCalledTimes(8);

      const storedKeys = mockUpsertWeights.mock.calls.map((call: unknown[]) => call[0]);
      expect(storedKeys).toContain(LEARNING_CONSTANTS.SCORING_WEIGHTS_KEY);
      expect(storedKeys).toContain(LEARNING_CONSTANTS.CATEGORY_VALUES_KEY);
      expect(storedKeys).toContain(LEARNING_CONSTANTS.TERM_QUALITY_KEY);
      expect(storedKeys).toContain(LEARNING_CONSTANTS.THRESHOLD_DISCOVERY_KEY);
      expect(storedKeys).toContain(LEARNING_CONSTANTS.SCORER_HEALTH_KEY);
    });

    it('skips persistence in dry run mode', async () => {
      const res = await GET(buildCronRequest({ dryRun: true }) as never);
      const body = await res.json();

      expect(mockUpsertWeights).not.toHaveBeenCalled();
      expect(body.scoringWeightsGenerated).toBe(true);
      expect(body.termQualityGenerated).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Non-fatal failure
  // ─────────────────────────────────────────────────────────────────────────

  describe('Phase 6 non-fatal failure', () => {
    beforeEach(() => {
      process.env.PHASE_6_SCORING_ENABLED = 'true';
    });

    it('succeeds overall when Phase 6 throws', async () => {
      mockComputeScoringWeights.mockImplementation(() => {
        throw new Error('Phase 6 kaboom');
      });

      const res = await GET(buildCronRequest() as never);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(mockUpsertWeights).toHaveBeenCalledTimes(3);
      expect(body.scoringWeightsGenerated).toBe(false);
      expect(body.termQualityGenerated).toBe(false);
      expect(body.scorerHealthCorrelation).toBeNull();
    });

    it('Phase 5 results are unaffected by Phase 6 failure', async () => {
      mockComputeCategoryValues.mockImplementation(() => {
        throw new Error('Category discovery failed');
      });

      const res = await GET(buildCronRequest() as never);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.eventsProcessed).toBe(200);
      expect(body.pairsGenerated).toBe(50);
      expect(body.candidatesFound).toBe(1);

      const storedKeys = mockUpsertWeights.mock.calls.map((call: unknown[]) => call[0]);
      expect(storedKeys).toContain('co-occurrence');
      expect(storedKeys).toContain('sequences');
      expect(storedKeys).toContain('scene-candidates');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Response shape
  // ─────────────────────────────────────────────────────────────────────────

  describe('Response shape', () => {
    it('includes all Phase 6 fields in success response', async () => {
      process.env.PHASE_6_SCORING_ENABLED = 'true';
      const res = await GET(buildCronRequest() as never);
      const body = await res.json();

      expect(body).toHaveProperty('ok');
      expect(body).toHaveProperty('message');
      expect(body).toHaveProperty('eventsProcessed');
      expect(body).toHaveProperty('pairsGenerated');
      expect(body).toHaveProperty('candidatesFound');
      expect(body).toHaveProperty('durationMs');
      expect(body).toHaveProperty('requestId');
      expect(body).toHaveProperty('ranAt');
      expect(body).toHaveProperty('dryRun');

      expect(body).toHaveProperty('phase6Enabled', true);
      expect(body).toHaveProperty('scoringWeightsGenerated', true);
      expect(body).toHaveProperty('termQualityGenerated', true);
      expect(body).toHaveProperty('scorerHealthCorrelation', 0.72);
      expect(body).toHaveProperty('phase6DurationMs');
      expect(typeof body.phase6DurationMs).toBe('number');
    });

    it('includes Phase 6 fields even when Phase 6 is disabled', async () => {
      process.env.PHASE_6_SCORING_ENABLED = 'false';
      const res = await GET(buildCronRequest() as never);
      const body = await res.json();

      expect(body).toHaveProperty('phase6Enabled', false);
      expect(body).toHaveProperty('scoringWeightsGenerated', false);
      expect(body).toHaveProperty('termQualityGenerated', false);
      expect(body).toHaveProperty('scorerHealthCorrelation', null);
      expect(body).toHaveProperty('phase6DurationMs', 0);
    });

    it('includes Phase 6 summary in message when enabled', async () => {
      process.env.PHASE_6_SCORING_ENABLED = 'true';
      const res = await GET(buildCronRequest() as never);
      const body = await res.json();

      expect(body.message).toContain('Phase 6:');
      expect(body.message).toContain('weights=true');
      expect(body.message).toContain('quality=true');
      expect(body.message).toContain('r=0.720');
    });

    it('excludes Phase 6 from message when disabled', async () => {
      process.env.PHASE_6_SCORING_ENABLED = 'false';
      const res = await GET(buildCronRequest() as never);
      const body = await res.json();

      expect(body.message).not.toContain('Phase 6');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Storage key constants
  // ─────────────────────────────────────────────────────────────────────────

  describe('Storage key constants', () => {
    it('THRESHOLD_DISCOVERY_KEY exists in constants', () => {
      expect(LEARNING_CONSTANTS.THRESHOLD_DISCOVERY_KEY).toBe('threshold-discovery');
    });

    it('CATEGORY_VALUES_KEY exists in constants', () => {
      expect(LEARNING_CONSTANTS.CATEGORY_VALUES_KEY).toBe('category-values');
    });

    it('all Phase 6 storage keys are unique', () => {
      const keys = [
        LEARNING_CONSTANTS.SCORING_WEIGHTS_KEY,
        LEARNING_CONSTANTS.TERM_QUALITY_KEY,
        LEARNING_CONSTANTS.SCORER_HEALTH_KEY,
        LEARNING_CONSTANTS.THRESHOLD_DISCOVERY_KEY,
        LEARNING_CONSTANTS.CATEGORY_VALUES_KEY,
      ];
      const unique = new Set(keys);
      expect(unique.size).toBe(keys.length);
    });
  });
});
