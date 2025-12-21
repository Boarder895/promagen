// frontend/src/app/dev/health/page.tsx

import React from 'react';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Promagen · Dev Health',
  description: 'Internal health dashboard (local report reader).',
  robots: { index: false, follow: false },
};

type TrafficState = 'green' | 'amber' | 'red';
type CheckStatus = 'pass' | 'fail' | 'skip';

type CheckReport = {
  status: CheckStatus;
  durationMs?: number;
  summary?: string;
  details?: string;
};

type FxBudget = {
  state?: 'ok' | 'warn' | 'block';
  emoji?: string;
  used?: number;
  limit?: number;
  percent?: number;
  warningThreshold?: number;
  blockThreshold?: number;
};

type FxReport = {
  modeSummary?: { cached?: number; live?: number; unknown?: number };
  ttlSeconds?: number;
  asOf?: string;
  provider?: string;
  upstreamDelta?: number;
  budget?: FxBudget;
  headers?: Record<string, string | undefined>;
};

type HistoryEntry = {
  runId?: string;
  finishedAt?: string;
  overallState?: TrafficState;
  summaryLine?: string;
};

type LatestReport = {
  schemaVersion?: string;
  generatedAt?: string;
  env?: {
    nodeEnv?: string;
    vercelEnv?: string;
    host?: string;
  };
  overall?: {
    state?: TrafficState;
    reason?: string;
  };
  lastRun?: {
    runId?: string;
    startedAt?: string;
    finishedAt?: string;
    durationMs?: number;
  };
  checks?: {
    lint?: CheckReport;
    typecheck?: CheckReport;
    testCi?: CheckReport;
    playwright?: CheckReport;
    lighthouse?: CheckReport;
  };
  fx?: FxReport;
  history?: HistoryEntry[];
};

function safeNumber(n: unknown): number | undefined {
  if (typeof n !== 'number' || Number.isNaN(n)) return undefined;
  return n;
}

function fmtMs(ms?: number): string {
  const n = safeNumber(ms);
  if (n === undefined) return '—';
  if (n < 1000) return `${Math.round(n)}ms`;
  const s = n / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = (s % 60).toFixed(0).padStart(2, '0');
  return `${m}m ${rem}s`;
}

function fmtIso(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString();
}

function fmtAge(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const diffMs = Date.now() - d.getTime();
  const s = Math.max(0, Math.floor(diffMs / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return `${h}h ${remM}m ago`;
}

function statusLabel(s?: CheckStatus): string {
  if (s === 'pass') return 'PASS';
  if (s === 'fail') return 'FAIL';
  if (s === 'skip') return 'SKIP';
  return '—';
}

function statusPillClasses(s?: CheckStatus): string {
  if (s === 'pass') return 'bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/25';
  if (s === 'fail') return 'bg-rose-500/15 text-rose-700 ring-1 ring-rose-500/25';
  if (s === 'skip') return 'bg-slate-500/15 text-slate-700 ring-1 ring-slate-500/25';
  return 'bg-slate-500/10 text-slate-700 ring-1 ring-slate-500/20';
}

function trafficBannerClasses(state: TrafficState): string {
  if (state === 'green') return 'bg-emerald-500/15 ring-1 ring-emerald-500/25';
  if (state === 'amber') return 'bg-amber-500/15 ring-1 ring-amber-500/25';
  return 'bg-rose-500/15 ring-1 ring-rose-500/25';
}

function trafficTextClasses(state: TrafficState): string {
  if (state === 'green') return 'text-emerald-800';
  if (state === 'amber') return 'text-amber-800';
  return 'text-rose-800';
}

function trafficTitle(state: TrafficState): string {
  if (state === 'green') return 'SAFE';
  if (state === 'amber') return 'WARNING';
  return 'BLOCK';
}

function normaliseState(state?: TrafficState): TrafficState {
  if (state === 'green' || state === 'amber' || state === 'red') return state;
  return 'red';
}

function computeFallbackOverall(
  r: LatestReport | null,
  readError: string | null,
): { state: TrafficState; reason: string } {
  if (!r) {
    return {
      state: 'red',
      reason: readError ? `Report missing/unreadable: ${readError}` : 'Report missing/unreadable.',
    };
  }

  const explicit = r.overall?.state;
  const reason = r.overall?.reason;

  if (explicit) {
    return {
      state: normaliseState(explicit),
      reason: reason ?? 'Overall state provided by report.',
    };
  }

  // Fallback: derive from checks + FX budget if report didn’t compute overall.
  const checks = r.checks ?? {};
  const failures: string[] = [];

  const addIfFail = (name: string, c?: CheckReport) => {
    if (c?.status === 'fail') failures.push(name);
  };

  addIfFail('lint', checks.lint);
  addIfFail('typecheck', checks.typecheck);
  addIfFail('test:ci', checks.testCi);

  const budgetState = r.fx?.budget?.state;
  if (budgetState === 'block') failures.push('fx budget block');

  if (failures.length > 0) {
    return { state: 'red', reason: `Failures: ${failures.join(', ')}` };
  }

  if (budgetState === 'warn') {
    return { state: 'amber', reason: 'FX budget in warning state.' };
  }

  // If anything is missing, amber (because unknown is not green).
  const hasCore = Boolean(checks.lint?.status && checks.typecheck?.status && checks.testCi?.status);
  if (!hasCore) {
    return { state: 'amber', reason: 'Some core checks are missing from the report.' };
  }

  return { state: 'green', reason: 'All core checks passing and no budget warning/block.' };
}

async function readLatestReport(): Promise<{ report: LatestReport | null; error: string | null }> {
  try {
    const reportPath = path.join(process.cwd(), '.reports', 'latest.json');
    const raw = await fs.readFile(reportPath, 'utf8');
    const parsed = JSON.parse(raw) as LatestReport;
    return { report: parsed, error: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { report: null, error: msg };
  }
}

function Card({
  title,
  children,
  subtitle,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl bg-white/70 ring-1 ring-slate-900/5 shadow-sm backdrop-blur px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Kv({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-6 py-1">
      <div className="text-sm text-slate-600">{k}</div>
      <div className={mono ? 'text-sm text-slate-900 font-mono' : 'text-sm text-slate-900'}>
        {v}
      </div>
    </div>
  );
}

function CheckRow({ name, c }: { name: string; c?: CheckReport }) {
  const status = c?.status;
  const pill = (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusPillClasses(
        status,
      )}`}
    >
      {statusLabel(status)}
    </span>
  );

  return (
    <div className="rounded-2xl bg-white/60 ring-1 ring-slate-900/5 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm font-semibold text-slate-900">{name}</div>
        {pill}
      </div>
      <div className="mt-2 space-y-1">
        <Kv k="Duration" v={fmtMs(c?.durationMs)} mono />
        <Kv k="Summary" v={c?.summary ?? '—'} />
      </div>
    </div>
  );
}

function TrendStrip({ history }: { history?: HistoryEntry[] }) {
  const items = (history ?? []).slice(0, 10);
  const padded =
    items.length < 10 ? items.concat(Array.from({ length: 10 - items.length }, () => ({}))) : items;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {padded.map((h, idx) => {
        const s = h.overallState;
        const state = s === 'green' || s === 'amber' || s === 'red' ? s : undefined;
        const cls =
          state === 'green'
            ? 'bg-emerald-500/20 ring-1 ring-emerald-500/25'
            : state === 'amber'
            ? 'bg-amber-500/20 ring-1 ring-amber-500/25'
            : state === 'red'
            ? 'bg-rose-500/20 ring-1 ring-rose-500/25'
            : 'bg-slate-500/10 ring-1 ring-slate-500/15';

        const title = h.finishedAt
          ? `${state ?? 'unknown'} · ${fmtIso(h.finishedAt)} · ${h.summaryLine ?? ''}`.trim()
          : 'No data';

        return (
          <div
            key={`${idx}-${h.runId ?? 'none'}`}
            title={title}
            className={`h-3.5 w-8 rounded-full ${cls}`}
          />
        );
      })}
    </div>
  );
}

export default async function DevHealthPage() {
  const { report, error } = await readLatestReport();
  const overall = computeFallbackOverall(report, error);
  const bannerState = normaliseState(overall.state);

  const generatedAt = report?.generatedAt;
  const lastFinished = report?.lastRun?.finishedAt ?? report?.generatedAt;

  const fx = report?.fx;
  const checks = report?.checks;

  const budgetState = fx?.budget?.state ?? '—';
  const budgetEmoji = fx?.budget?.emoji ?? '';
  const ttlSeconds = fx?.ttlSeconds;
  const upstreamDelta = fx?.upstreamDelta;

  const cachedCount = fx?.modeSummary?.cached ?? 0;
  const liveCount = fx?.modeSummary?.live ?? 0;
  const unknownCount = fx?.modeSummary?.unknown ?? 0;

  const interestingHeaders = fx?.headers ?? {};

  return (
    <main className="mx-auto w-full max-w-7xl px-4 md:px-6 py-8">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
            Dev Health
          </h1>
          <p className="text-sm text-slate-600">
            Internal status view. Reads{' '}
            <span className="font-mono">frontend/.reports/latest.json</span> only.
          </p>
        </div>

        {/* Traffic-light banner */}
        <section className={`rounded-3xl px-5 py-4 shadow-sm ${trafficBannerClasses(bannerState)}`}>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <div className={`text-sm font-semibold ${trafficTextClasses(bannerState)}`}>
                {trafficTitle(bannerState)}
              </div>
              <div className="mt-1 text-base font-semibold text-slate-900">{overall.reason}</div>
              {error ? (
                <p className="mt-2 text-sm text-slate-700">
                  Report read error: <span className="font-mono">{error}</span>
                </p>
              ) : null}
            </div>

            <div className="rounded-2xl bg-white/60 ring-1 ring-slate-900/5 px-4 py-3 min-w-[260px]">
              <Kv k="Generated at" v={fmtIso(generatedAt)} mono />
              <Kv k="Age" v={fmtAge(lastFinished)} />
              <Kv
                k="Env"
                v={`${report?.env?.nodeEnv ?? '—'} / ${report?.env?.vercelEnv ?? '—'}`}
                mono
              />
            </div>
          </div>

          <div className="mt-4">
            <div className="text-xs font-semibold text-slate-700">Last 10 runs</div>
            <div className="mt-2">
              <TrendStrip history={report?.history} />
            </div>
          </div>
        </section>

        {/* Core checks */}
        <Card
          title="Core checks"
          subtitle="These decide whether the codebase is structurally sane (lint, typecheck, unit tests)."
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <CheckRow name="Lint" c={checks?.lint} />
            <CheckRow name="Typecheck" c={checks?.typecheck} />
            <CheckRow name="Unit tests (test:ci)" c={checks?.testCi} />
          </div>
        </Card>

        {/* FX status */}
        <Card title="FX status" subtitle="This is the ‘don’t accidentally burn credits’ section.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-white/60 ring-1 ring-slate-900/5 px-4 py-3">
              <Kv
                k="Mode summary"
                v={`cached=${cachedCount} live=${liveCount} unknown=${unknownCount}`}
                mono
              />
              <Kv k="TTL" v={ttlSeconds !== undefined ? `${ttlSeconds}s` : '—'} mono />
              <Kv k="asOf" v={fx?.asOf ?? '—'} mono />
              <Kv k="Provider" v={fx?.provider ?? '—'} mono />
              <Kv
                k="Upstream delta (burst)"
                v={upstreamDelta !== undefined ? upstreamDelta : '—'}
                mono
              />
            </div>

            <div className="rounded-2xl bg-white/60 ring-1 ring-slate-900/5 px-4 py-3">
              <Kv k="Budget state" v={`${budgetEmoji} ${budgetState}`} />
              <Kv
                k="Usage"
                v={
                  fx?.budget?.percent !== undefined
                    ? `${fx.budget.percent}% (${fx.budget.used ?? '—'} / ${fx.budget.limit ?? '—'})`
                    : '—'
                }
              />
              <Kv
                k="Thresholds"
                v={
                  fx?.budget?.warningThreshold !== undefined &&
                  fx?.budget?.blockThreshold !== undefined
                    ? `warn=${fx.budget.warningThreshold}% block=${fx.budget.blockThreshold}%`
                    : '—'
                }
                mono
              />
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-white/60 ring-1 ring-slate-900/5 px-4 py-3">
            <div className="text-sm font-semibold text-slate-900">Interesting headers</div>
            <div className="mt-2 space-y-1">
              <Kv
                k="cache-control"
                v={
                  interestingHeaders['cache-control'] ?? interestingHeaders['Cache-Control'] ?? '—'
                }
                mono
              />
              <Kv k="age" v={interestingHeaders['age'] ?? interestingHeaders['Age'] ?? '—'} mono />
              <Kv
                k="x-vercel-cache"
                v={
                  interestingHeaders['x-vercel-cache'] ??
                  interestingHeaders['X-Vercel-Cache'] ??
                  '—'
                }
                mono
              />
              <Kv
                k="etag"
                v={interestingHeaders['etag'] ?? interestingHeaders['ETag'] ?? '—'}
                mono
              />
              <Kv
                k="vary"
                v={interestingHeaders['vary'] ?? interestingHeaders['Vary'] ?? '—'}
                mono
              />
            </div>
          </div>
        </Card>

        {/* What to do if report is missing */}
        {!report ? (
          <Card
            title="No report found"
            subtitle="This page only reads a local report file. It does not run checks by itself."
          >
            <p className="text-sm text-slate-700">
              Create <span className="font-mono">frontend/.reports/latest.json</span> by running
              your verification pipeline (lint/typecheck/tests + FX checks). Once the report exists,
              refresh this page.
            </p>
          </Card>
        ) : null}

        <div className="text-xs text-slate-500">
          Note: this page intentionally does not call APIs. It only renders what the report says.
        </div>
      </div>
    </main>
  );
}
