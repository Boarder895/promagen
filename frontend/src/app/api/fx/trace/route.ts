// frontend/src/app/api/fx/trace/route.ts
/**
 * /api/fx/trace — OBSERVER ONLY
 *
 * Non-negotiable (promagen-api-brain-v2):
 * - MUST NEVER trigger upstream/provider calls
 * - MUST NEVER refresh caches or mutate refresh authority
 * - MUST ONLY read from snapshot helpers in frontend/src/lib/fx/providers.ts
 *
 * This route returns the existing trace snapshot, plus additive diagnostics:
 * - observedAt (ISO)
 * - budget (ledger snapshot)
 * - budgetIndicator (emoji/state)
 * - warnings / violations (stable IDs)
 *
 * Cache-Control: diagnostics only → no-store (CDN-honest)
 *
 * Pro posture:
 * - Hidden in Vercel production unless authorised (returns 404 when unauthorised).
 * - App-level rate limiting is applied as defence in depth (WAF is the front line).
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getBudgetGuardEmoji } from '@/data/emoji/emoji';
import { env } from '@/lib/env';
import { allowFxTrace, getFxRequestId } from '@/lib/fx/route';
import { getFxRibbonBudgetSnapshot, getFxRibbonTraceSnapshot } from '@/lib/fx/providers';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Pro posture: keep trace cheap; it must never trigger upstream.
export const maxDuration = 10;

type BudgetState = 'ok' | 'warning' | 'blocked';

type BudgetIndicator = {
  state: BudgetState;
  // SSOT-first: emoji comes from Emoji Bank (budget_guard).
  emoji: string;
};

type NoticeLevel = 'warning' | 'violation';

type Notice = {
  id: string;
  level: NoticeLevel;
  message: string;
  meta?: Record<string, unknown>;
};

type NoticesResult = {
  warnings: Notice[];
  violations: Notice[];
  budget: BudgetIndicator;
};

type TracePayload = {
  observedAt?: string;
  budget?: unknown;
  budgetIndicator?: unknown;
  [k: string]: unknown;
};

function isoNow(): string {
  return new Date().toISOString();
}

function normaliseBudgetState(state: unknown): BudgetState {
  if (state === 'warning' || state === 'blocked' || state === 'ok') return state;
  return 'ok';
}

function budgetEmoji(state: BudgetState): string {
  return getBudgetGuardEmoji(state);
}

function getProp(obj: unknown, key: string): unknown | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  return (obj as Record<string, unknown>)[key];
}

function getNumber(obj: unknown, path: string[]): number | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  let cur: unknown = obj;
  for (const key of path) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return typeof cur === 'number' && Number.isFinite(cur) ? cur : undefined;
}

function getUnknownArray(obj: unknown, path: string[]): unknown[] | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  let cur: unknown = obj;
  for (const key of path) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return Array.isArray(cur) ? cur : undefined;
}

function buildNotices(params: {
  observedAt: string;
  snapshot: TracePayload;
  budgetIndicator: BudgetIndicator;
}): NoticesResult {
  const warnings: Notice[] = [];
  const violations: Notice[] = [];

  function add(notice: Notice): void {
    if (notice.level === 'violation') violations.push(notice);
    else warnings.push(notice);
  }

  // Budget stance: surface only.
  const budgetState = params.budgetIndicator.state;
  if (budgetState === 'blocked') {
    add({
      id: 'BUDGET_BLOCKED',
      level: 'violation',
      message: 'Budget is blocked: the authority must refuse upstream refresh.',
      meta: { observedAt: params.observedAt },
    });
  } else if (budgetState === 'warning') {
    add({
      id: 'BUDGET_WARNING',
      level: 'warning',
      message: 'Budget is in warning: upstream refresh is near limit.',
      meta: { observedAt: params.observedAt },
    });
  }

  // Basic snapshot sanity checks (observer-only).
  const ribbonCalls = getNumber(params.snapshot, ['counters', 'ribbonCalls']) ?? 0;
  const upstreamCalls = getNumber(params.snapshot, ['counters', 'upstreamCalls']) ?? 0;

  if (upstreamCalls > ribbonCalls) {
    add({
      id: 'UPSTREAM_CALLS_GT_RIBBON_CALLS',
      level: 'violation',
      message: 'Upstream calls exceeded ribbon calls. Possible bypass or counter bug.',
      meta: { ribbonCalls, upstreamCalls },
    });
  }

  const ttlSeconds = getNumber(params.snapshot, ['ttlSeconds']);
  if (typeof ttlSeconds === 'number' && ttlSeconds > 0 && ttlSeconds < 900) {
    add({
      id: 'TTL_LOW',
      level: 'warning',
      message: 'TTL appears low (< 15 minutes). Check FX_RIBBON_TTL_SECONDS / env duplication.',
      meta: { ttlSeconds },
    });
  }

  const missingA = getNumber(params.snapshot, ['lastFetch', 'missingA']) ?? 0;
  const missingB = getNumber(params.snapshot, ['lastFetch', 'missingB']) ?? 0;
  const missingTotal = missingA + missingB;

  if (missingTotal > 0) {
    add({
      id: 'MISSING_SYMBOLS',
      level: 'warning',
      message: 'Some symbols are missing rates (null prices in merged ribbon).',
      meta: {
        missingTotal,
        missingA,
        missingB,
        sample:
          getUnknownArray(params.snapshot, ['lastFetch', 'missingSymbols'])?.slice(0, 10) ?? [],
      },
    });
  }

  return { warnings, violations, budget: params.budgetIndicator };
}

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = getFxRequestId(req);
  const vercelEnv = process.env.VERCEL_ENV ?? '';
  const isVercelProd = vercelEnv === 'production';

  // Production hardening: hide trace unless authorised.
  if (!allowFxTrace(req)) {
    return new Response('Not Found', {
      status: 404,
      headers: {
        'Cache-Control': 'no-store',
        'X-Promagen-Request-Id': requestId,
        'X-Promagen-Safe-Mode': env.safeMode.enabled ? '1' : '0',
      },
    });
  }

  // App-level rate limiting (defence in depth). WAF is your front line.
  const rl = rateLimit(req, {
    keyPrefix: 'fx-trace',
    windowSeconds: 60,
    max: isVercelProd ? 240 : 10_000,
    keyParts: ['GET', '/api/fx/trace'],
  });

  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'RATE_LIMITED', observedAt: isoNow(), requestId },
      {
        status: 429,
        headers: {
          'Cache-Control': 'no-store',
          'Retry-After': String(rl.retryAfterSeconds),
          'X-RateLimit-Limit': String(rl.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rl.resetAt,
          'X-Promagen-Request-Id': requestId,
          'X-Promagen-Safe-Mode': env.safeMode.enabled ? '1' : '0',
        },
      },
    );
  }

  // OBSERVER ONLY: read snapshot state; do not trigger upstream/provider calls.
  const snapshot = getFxRibbonTraceSnapshot() as unknown as TracePayload;

  // Prefer authority-provided budget snapshot/indicator if present; fallback to snapshot helper.
  const budget = snapshot?.budget ?? getFxRibbonBudgetSnapshot();

  const budgetState = normaliseBudgetState(
    getProp(snapshot?.budgetIndicator, 'state') ?? getProp(budget, 'state'),
  );

  const budgetIndicator: BudgetIndicator = {
    state: budgetState,
    emoji: budgetEmoji(budgetState),
  };

  const observedAt = isoNow();
  const notices = buildNotices({ observedAt, snapshot, budgetIndicator });

  const payload: TracePayload = {
    ...snapshot,
    observedAt,
    requestId,
    safeMode: env.safeMode.enabled,
    budget,
    budgetIndicator,
    warnings: notices.warnings,
    violations: notices.violations,
  };

  return NextResponse.json(payload, {
    headers: {
      // API Brain: trace is observation-only and must never trigger refresh.
      // No caching promises for diagnostics.
      'Cache-Control': 'no-store',

      // Headers must be ASCII (undici/WebIDL ByteString). Emoji stays in the JSON body.
      'X-Promagen-Fx-Budget': notices.budget.state,
      'X-Promagen-Fx-Budget-State': notices.budget.state,
      'X-Promagen-Request-Id': requestId,
      'X-Promagen-Safe-Mode': env.safeMode.enabled ? '1' : '0',
      'X-RateLimit-Limit': String(rl.limit),
      'X-RateLimit-Remaining': String(rl.remaining),
      'X-RateLimit-Reset': rl.resetAt,
    },
  });
}
