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
  observedAtIso: string;
  snapshot: unknown;
  budgetSnapshot: unknown;
  budgetIndicator: BudgetIndicator;
}): { warnings: TraceNotice[]; violations: TraceNotice[]; budget: BudgetIndicator } {
  const warnings: TraceNotice[] = [];
  const violations: TraceNotice[] = [];

  const add = (n: Omit<TraceNotice, 'at'>) => {
    const notice: TraceNotice = { ...n, at: params.observedAtIso };
    if (notice.level === 'violation') violations.push(notice);
    else warnings.push(notice);
  };

  const state = params.budgetIndicator.state;

  if (state === 'warning') {
    add({
      id: 'BUDGET_WARNING',
      level: 'warning',
      message:
        'Budget warning: upstream calls may soon be restricted by the Authority (watch for throttling).',
      meta: { state },
    });
  }

  if (state === 'blocked') {
    add({
      id: 'BUDGET_BLOCKED',
      level: 'violation',
      message:
        'Budget blocked: upstream calls should be refused by the Authority (ride-cache only).',
      meta: { state },
    });
  }

  // Minute / daily threshold details (read-only; no recompute)
  const minuteUsed =
    getNumber(params.budgetSnapshot, ['minute', 'used']) ??
    getNumber(params.budgetSnapshot, ['minute', 'count']);
  const minuteWarnAt = getNumber(params.budgetSnapshot, ['minute', 'warnAt']);
  const minuteBlockAt = getNumber(params.budgetSnapshot, ['minute', 'blockAt']);

  if (
    typeof minuteUsed === 'number' &&
    typeof minuteBlockAt === 'number' &&
    minuteUsed >= minuteBlockAt
  ) {
    add({
      id: 'MINUTE_CAP_BLOCKED',
      level: 'violation',
      message: 'Per-minute budget has hit the block threshold (ride-cache only).',
      meta: { used: minuteUsed, blockAt: minuteBlockAt },
    });
  } else if (
    typeof minuteUsed === 'number' &&
    typeof minuteWarnAt === 'number' &&
    minuteUsed >= minuteWarnAt
  ) {
    add({
      id: 'MINUTE_CAP_WARNING',
      level: 'warning',
      message: 'Per-minute budget is in warning range.',
      meta: { used: minuteUsed, warnAt: minuteWarnAt },
    });
  }

  const dayUsed =
    getNumber(params.budgetSnapshot, ['day', 'used']) ??
    getNumber(params.budgetSnapshot, ['day', 'count']);
  const dayWarnAt = getNumber(params.budgetSnapshot, ['day', 'warnAt']);
  const dayBlockAt = getNumber(params.budgetSnapshot, ['day', 'blockAt']);

  if (typeof dayUsed === 'number' && typeof dayBlockAt === 'number' && dayUsed >= dayBlockAt) {
    add({
      id: 'DAY_CAP_BLOCKED',
      level: 'violation',
      message: 'Daily budget has hit the block threshold (ride-cache only).',
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

  // Weekend freeze hint
  const weekendFreeze =
    getBool(params.snapshot, ['weekendFreezeActive']) ??
    getBool(params.snapshot, ['weekendFreeze', 'active']);
  if (weekendFreeze) {
    add({
      id: 'WEEKEND_FREEZE',
      level: 'warning',
      message: 'Weekend freeze active (upstream FX calls should be forbidden; cache-only).',
    });
  }

  const rateLimitUntilIso =
    getString(params.snapshot, ['rateLimit', 'until']) ??
    getString(params.snapshot, ['rateLimitUntil']);
  if (rateLimitUntilIso) {
    add({
      id: 'RATE_LIMIT_COOLDOWN',
      level: 'warning',
      message: 'Rate-limit cooldown active (upstream should be paused).',
      meta: { until: rateLimitUntilIso },
    });
  }

  const cacheHasValue =
    getBool(params.snapshot, ['cache', 'hasValue']) ??
    Boolean(getString(params.snapshot, ['cache', 'key']));
  if (cacheHasValue === false) {
    add({
      id: 'NO_CACHE',
      level: 'violation',
      message: 'No ride-cache available (any block/freeze will result in null prices / error).',
    });
  }

  const missingA = getNumber(params.snapshot, ['groups', 'A', 'missingCount']) ?? 0;
  const missingB = getNumber(params.snapshot, ['groups', 'B', 'missingCount']) ?? 0;
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
  const budgetSnapshot = snapshot.budget ?? getFxRibbonBudgetSnapshot();

  const budgetState = normaliseBudgetState(
    snapshot.budgetIndicator && typeof snapshot.budgetIndicator === 'object'
      ? (snapshot.budgetIndicator as Record<string, unknown>).state
      : budgetSnapshot && typeof budgetSnapshot === 'object'
      ? (budgetSnapshot as Record<string, unknown>).state
      : undefined,
  );

  const budgetIndicator: BudgetIndicator = {
    state: budgetState,
    emoji:
      (snapshot.budgetIndicator &&
      typeof snapshot.budgetIndicator === 'object' &&
      typeof (snapshot.budgetIndicator as Record<string, unknown>).emoji === 'string'
        ? String((snapshot.budgetIndicator as Record<string, unknown>).emoji)
        : budgetEmoji(budgetState)) || budgetEmoji(budgetState),
  };

  const observedAtIso = isoNow();

  const notices = buildNotices({
    observedAtIso,
    snapshot,
    budgetSnapshot,
    budgetIndicator,
  });

  // Preserve the existing snapshot shape at the root, only add fields.
  const payload: TracePayload = {
    ...(snapshot as Record<string, unknown>),
    observedAt: observedAtIso,

    // Raw budget snapshot (ledger + state) for forensic debugging.
    budget: budgetSnapshot,

    // Convenience indicator aligned to UI emoji mapping.
    budgetIndicator: notices.budget,

    // Human-auditable flags (stable IDs, suitable for tests/log grep).
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
