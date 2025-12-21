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
 */

import { NextResponse } from 'next/server';
import { getFxRibbonBudgetSnapshot, getFxRibbonTraceSnapshot } from '@/lib/fx/providers';

type BudgetState = 'ok' | 'warning' | 'blocked';

type BudgetIndicator = {
  state: BudgetState;
  emoji: string;
};

type TraceNoticeLevel = 'warning' | 'violation';

type TraceNotice = {
  id: string;
  level: TraceNoticeLevel;
  at: string; // ISO timestamp
  message: string;
  meta?: Record<string, unknown>;
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
  // Keep this stable: trace JSON uses this mapping (headers must remain ASCII).
  switch (state) {
    case 'warning':
      return '🏖️';
    case 'blocked':
      return '🧳';
    case 'ok':
    default:
      return '🛫';
  }
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

function getString(obj: unknown, path: string[]): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  let cur: unknown = obj;
  for (const key of path) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return typeof cur === 'string' ? cur : undefined;
}

function getBool(obj: unknown, path: string[]): boolean | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  let cur: unknown = obj;
  for (const key of path) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return typeof cur === 'boolean' ? cur : undefined;
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
  snapshot: unknown;
  budgetIndicator: BudgetIndicator;
}): { warnings: TraceNotice[]; violations: TraceNotice[]; budget: BudgetIndicator } {
  const warnings: TraceNotice[] = [];
  const violations: TraceNotice[] = [];

  const add = (n: Omit<TraceNotice, 'at'>) => {
    const entry: TraceNotice = { ...n, at: params.observedAt };
    if (entry.level === 'violation') violations.push(entry);
    else warnings.push(entry);
  };

  // Budget sanity (trace must explain budget gating)
  const dayUsed = getNumber(params.snapshot, ['budget', 'day', 'used']);
  const dayWarnAt = getNumber(params.snapshot, ['budget', 'day', 'warnAt']);
  const dayBlockAt = getNumber(params.snapshot, ['budget', 'day', 'blockAt']);

  if (params.budgetIndicator.state === 'blocked') {
    add({
      id: 'BUDGET_BLOCKED',
      level: 'violation',
      message: 'Budget is blocked; upstream FX calls should be forbidden.',
    });
  } else if (params.budgetIndicator.state === 'warning') {
    add({
      id: 'BUDGET_WARNING',
      level: 'warning',
      message: 'Budget is in warning range; upstream FX calls should be minimised.',
    });
  }

  if (typeof dayUsed === 'number' && typeof dayBlockAt === 'number' && dayUsed >= dayBlockAt) {
    add({
      id: 'DAY_CAP_BLOCKED',
      level: 'violation',
      message: 'Daily budget appears at/above block threshold.',
      meta: { used: dayUsed, blockAt: dayBlockAt },
    });
  } else if (typeof dayUsed === 'number' && typeof dayWarnAt === 'number' && dayUsed >= dayWarnAt) {
    add({
      id: 'DAY_CAP_WARNING',
      level: 'warning',
      message: 'Daily budget is in warning range.',
      meta: { used: dayUsed, warnAt: dayWarnAt },
    });
  }

  const rateLimitUntilIso =
    getString(params.snapshot, ['rateLimit', 'until']) ??
    getString(params.snapshot, ['rateLimitUntil']);
  if (rateLimitUntilIso) {
    add({
      id: 'RATE_LIMIT_ACTIVE',
      level: 'warning',
      message: 'Rate-limit cooldown active; serving cache/ride-cache until cooldown expires.',
      meta: { until: rateLimitUntilIso },
    });
  }

  // Cold-start / cache sanity
  const hasCacheValue =
    getBool(params.snapshot, ['cache', 'hasValue']) ??
    (getNumber(params.snapshot, ['cache', 'size']) ?? 0) > 0;

  const lastMergedA = getUnknownArray(params.snapshot, ['merged', 'A']);
  const lastMergedB = getUnknownArray(params.snapshot, ['merged', 'B']);

  const missingA =
    getUnknownArray(params.snapshot, ['merged', 'missing', 'A'])?.length ??
    getUnknownArray(params.snapshot, ['missing', 'A'])?.length ??
    0;

  const missingB =
    getUnknownArray(params.snapshot, ['merged', 'missing', 'B'])?.length ??
    getUnknownArray(params.snapshot, ['missing', 'B'])?.length ??
    0;

  const missingTotal = missingA + missingB;

  if (!hasCacheValue && (!lastMergedA || !lastMergedB)) {
    add({
      id: 'COLD_START_NO_CACHE',
      level: 'warning',
      message:
        'Cold start detected (no cache present yet). If upstream is allowed, first live fetch should warm the cache.',
    });
  }

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

  // TTL sanity (useful for “why is it 5 mins again?”)
  const ttlSeconds = getNumber(params.snapshot, ['ttlSeconds']);
  if (typeof ttlSeconds === 'number' && ttlSeconds > 0 && ttlSeconds < 900) {
    add({
      id: 'TTL_LOW',
      level: 'warning',
      message: 'TTL appears low (< 15 minutes). Check FX_RIBBON_TTL_SECONDS / env duplication.',
      meta: { ttlSeconds },
    });
  }

  return { warnings, violations, budget: params.budgetIndicator };
}

export async function GET(): Promise<Response> {
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
    },
  });
}
