'use client';

/**
 * Admin — Scene Candidate Review Queue
 * =====================================
 *
 * Displays auto-generated scene proposals from the Collective Intelligence
 * Engine. Admin can approve, reject, or reset each candidate.
 *
 * Protected: requires PROMAGEN_CRON_SECRET entered in-page.
 *
 * Route: /admin/scene-candidates
 * API:   /api/admin/learning/scene-candidates
 *
 * @see docs/authority/prompt-builder-evolution-plan-v2.md § 9.2
 *
 * Version: 1.0.0
 * Created: 2026-02-25
 *
 * Existing features preserved: Yes.
 */

import { useState, useEffect, useCallback } from 'react';

// ============================================================================
// TYPES
// ============================================================================

interface SceneCandidate {
  id: string;
  suggestedName: string;
  consensusSelections: Record<string, string[]>;
  eventCount: number;
  avgScore: number;
  dominantTier: 1 | 2 | 3 | 4;
  dominantPlatforms: string[];
  overlapWithExisting: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

interface SceneCandidatesData {
  version: string;
  generatedAt: string;
  eventsConsidered: number;
  clustersFormed: number;
  candidates: SceneCandidate[];
}

interface Stats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

interface GetResponse {
  ok: boolean;
  data: SceneCandidatesData | null;
  stats: Stats;
  updatedAt: string | null;
  message?: string;
  error?: string;
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';
type CandidateStatus = 'approved' | 'rejected' | 'pending';

// ============================================================================
// CONSTANTS
// ============================================================================

const TIER_LABELS: Record<number, string> = {
  1: 'T1 · CLIP',
  2: 'T2 · Midjourney',
  3: 'T3 · Natural Lang',
  4: 'T4 · Plain',
};

// ============================================================================
// PAGE
// ============================================================================

export default function SceneCandidatesPage() {
  // --- Auth ---
  const [secret, setSecret] = useState('');
  const [isAuthed, setIsAuthed] = useState(false);

  // --- Data ---
  const [data, setData] = useState<SceneCandidatesData | null>(null);
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  // --- UI state ---
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');

  // ── Fetch ───────────────────────────────────────────────────────────────
  const fetchCandidates = useCallback(async () => {
    if (!secret) return;
    setIsLoading(true);
    setError(null);

    try {
      const url = `/api/admin/learning/scene-candidates?secret=${encodeURIComponent(secret)}`;
      const res = await fetch(url);

      if (res.status === 404) {
        setError('Authentication failed — check your secret.');
        setIsAuthed(false);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = (await res.json()) as GetResponse;
      if (!json.ok) throw new Error(json.error ?? 'Unknown error');

      setIsAuthed(true);
      setData(json.data);
      setStats(json.stats);
      setUpdatedAt(json.updatedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setIsLoading(false);
    }
  }, [secret]);

  // ── Update status ───────────────────────────────────────────────────────
  const updateStatus = useCallback(
    async (candidateId: string, newStatus: CandidateStatus) => {
      if (!secret) return;
      setUpdatingId(candidateId);
      setError(null);

      try {
        const url = `/api/admin/learning/scene-candidates?secret=${encodeURIComponent(secret)}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ candidateId, status: newStatus }),
        });

        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error ?? `HTTP ${res.status}`);
        }

        // Refresh
        await fetchCandidates();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update');
      } finally {
        setUpdatingId(null);
      }
    },
    [secret, fetchCandidates],
  );

  // ── Auto-fetch on auth ──────────────────────────────────────────────────
  useEffect(() => {
    if (isAuthed) fetchCandidates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed]);

  // ── Filtered list ───────────────────────────────────────────────────────
  const filtered = (data?.candidates ?? []).filter(
    (c) => filter === 'all' || c.status === filter,
  );

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <h1
        style={{ fontSize: 'clamp(18px, 2vw, 28px)' }}
        className="mb-1 font-bold"
      >
        Scene Candidate Review
      </h1>
      <p
        style={{ fontSize: 'clamp(12px, 1.2vw, 15px)' }}
        className="mb-6 text-white/50"
      >
        Auto-generated scene proposals from nightly telemetry. Approve to add
        to scene-starters.json.
      </p>

      {/* ── Auth gate ────────────────────────────────────────────── */}
      {!isAuthed && (
        <div className="mb-6 flex items-end gap-3">
          <div className="flex-1">
            <label
              className="mb-1 block text-white/60"
              style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}
              htmlFor="admin-secret"
            >
              Admin Secret
            </label>
            <input
              id="admin-secret"
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') fetchCandidates(); }}
              className="w-full rounded-lg bg-black/40 px-3 py-2 text-sm ring-1 ring-white/20 focus:outline-none focus:ring-white/40"
              placeholder="PROMAGEN_CRON_SECRET"
            />
          </div>
          <button
            type="button"
            onClick={fetchCandidates}
            disabled={isLoading || !secret}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium ring-1 ring-white/20 hover:bg-white/15 disabled:opacity-40"
          >
            {isLoading ? 'Loading...' : 'Connect'}
          </button>
        </div>
      )}

      {/* ── Error banner ─────────────────────────────────────────── */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-300 ring-1 ring-red-500/20">
          {error}
        </div>
      )}

      {/* ── Stats bar ────────────────────────────────────────────── */}
      {isAuthed && (
        <div className="mb-4 flex items-center gap-5 border-b border-white/10 pb-3">
          <StatChip label="Total" value={stats.total} />
          <StatChip label="Pending" value={stats.pending} variant="amber" />
          <StatChip label="Approved" value={stats.approved} variant="emerald" />
          <StatChip label="Rejected" value={stats.rejected} variant="red" />

          {updatedAt && (
            <span
              className="ml-auto text-white/30"
              style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}
            >
              Cron: {new Date(updatedAt).toLocaleString()}
            </span>
          )}

          <button
            type="button"
            onClick={fetchCandidates}
            disabled={isLoading}
            className="rounded-md bg-white/10 px-3 py-1 text-xs ring-1 ring-white/20 hover:bg-white/15 disabled:opacity-40"
          >
            {isLoading ? '...' : 'Refresh'}
          </button>
        </div>
      )}

      {/* ── Filter tabs ──────────────────────────────────────────── */}
      {isAuthed && data && (
        <div className="mb-4 flex gap-1">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-white/15 text-white ring-1 ring-white/30'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* ── Empty states ─────────────────────────────────────────── */}
      {isAuthed && !data && !isLoading && (
        <EmptyState>
          No scene candidates yet — the nightly cron has not run or found no clusters.
        </EmptyState>
      )}

      {isAuthed && data && filtered.length === 0 && (
        <EmptyState>
          No {filter === 'all' ? '' : `${filter} `}candidates.
        </EmptyState>
      )}

      {/* ── Candidate cards ──────────────────────────────────────── */}
      <div className="space-y-3">
        {filtered.map((c) => (
          <CandidateCard
            key={c.id}
            candidate={c}
            isUpdating={updatingId === c.id}
            onUpdate={updateStatus}
          />
        ))}
      </div>

      {/* ── Pipeline info ────────────────────────────────────────── */}
      {isAuthed && data && (
        <div
          className="mt-6 rounded-lg bg-white/5 px-4 py-3 text-white/30"
          style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}
        >
          Pipeline v{data.version} · Generated {new Date(data.generatedAt).toLocaleString()} ·{' '}
          {data.eventsConsidered.toLocaleString()} events considered ·{' '}
          {data.clustersFormed} clusters formed ·{' '}
          {data.candidates.length} candidates extracted
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/** Small stat label+value pair */
function StatChip({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant?: 'amber' | 'emerald' | 'red';
}) {
  // Static class map — Tailwind JIT needs complete class strings
  const valueColorClass =
    variant === 'amber'
      ? 'text-amber-300'
      : variant === 'emerald'
        ? 'text-emerald-300'
        : variant === 'red'
          ? 'text-red-300'
          : 'text-white/70';

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-white/40" style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}>
        {label}
      </span>
      <span
        className={`font-mono font-bold ${valueColorClass}`}
        style={{ fontSize: 'clamp(14px, 1.4vw, 18px)' }}
      >
        {value}
      </span>
    </div>
  );
}

/** Empty-state box */
function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white/5 p-8 text-center text-white/40">
      <p style={{ fontSize: 'clamp(13px, 1.3vw, 16px)' }}>{children}</p>
    </div>
  );
}

/** Single candidate card with approve/reject/reset actions */
function CandidateCard({
  candidate,
  isUpdating,
  onUpdate,
}: {
  candidate: SceneCandidate;
  isUpdating: boolean;
  onUpdate: (id: string, status: CandidateStatus) => Promise<void>;
}) {
  const tierLabel = TIER_LABELS[candidate.dominantTier] ?? `Tier ${candidate.dominantTier}`;
  const categories = Object.keys(candidate.consensusSelections);

  // Status badge colour — static classes for Tailwind JIT
  const statusBadge =
    candidate.status === 'approved'
      ? 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/30'
      : candidate.status === 'rejected'
        ? 'bg-red-500/20 text-red-300 ring-red-500/30'
        : 'bg-amber-500/20 text-amber-300 ring-amber-500/30';

  return (
    <div className="rounded-xl bg-white/5 ring-1 ring-white/10 transition-colors hover:bg-white/[0.07]"
         style={{ padding: 'clamp(12px, 1.5vw, 20px)' }}>
      {/* ── Row 1: Name + Status ──────────────────────────────── */}
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3
            className="truncate font-semibold"
            style={{ fontSize: 'clamp(14px, 1.4vw, 18px)' }}
          >
            {candidate.suggestedName}
          </h3>
          <span
            className="font-mono text-white/30"
            style={{ fontSize: 'clamp(9px, 0.8vw, 11px)' }}
          >
            {candidate.id}
          </span>
        </div>

        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 font-medium ring-1 ${statusBadge}`}
          style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}
        >
          {candidate.status}
        </span>
      </div>

      {/* ── Row 2: Metadata ───────────────────────────────────── */}
      <div
        className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-white/50"
        style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}
      >
        <span>
          <strong className="text-white/70">{candidate.eventCount.toLocaleString()}</strong> events
        </span>
        <span>
          Avg score <strong className="text-white/70">{candidate.avgScore}%</strong>
        </span>
        <span>
          <strong className="text-white/70">{tierLabel}</strong>
        </span>
        <span>
          Overlap <strong className="text-white/70">{(candidate.overlapWithExisting * 100).toFixed(0)}%</strong>
        </span>
        {candidate.dominantPlatforms.length > 0 && (
          <span>
            Top: <strong className="text-white/70">{candidate.dominantPlatforms.slice(0, 3).join(', ')}</strong>
          </span>
        )}
      </div>

      {/* ── Row 3: Consensus selections ───────────────────────── */}
      <div className="mb-3">
        <span
          className="mb-1 block text-white/40"
          style={{ fontSize: 'clamp(10px, 0.9vw, 11px)' }}
        >
          Consensus selections · {categories.length} categories
        </span>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => {
            const terms = candidate.consensusSelections[cat] ?? [];
            return terms.map((term) => (
              <span
                key={`${cat}-${term}`}
                className="rounded-md bg-white/10 px-2 py-0.5 text-white/70"
                style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}
                title={cat}
              >
                <span className="text-white/30">{cat}:</span> {term}
              </span>
            ));
          })}
        </div>
      </div>

      {/* ── Row 4: Actions ────────────────────────────────────── */}
      <div className="flex gap-2">
        {candidate.status !== 'approved' && (
          <ActionButton
            label="Approve"
            onClick={() => onUpdate(candidate.id, 'approved')}
            disabled={isUpdating}
            variant="emerald"
          />
        )}
        {candidate.status !== 'rejected' && (
          <ActionButton
            label="Reject"
            onClick={() => onUpdate(candidate.id, 'rejected')}
            disabled={isUpdating}
            variant="red"
          />
        )}
        {candidate.status !== 'pending' && (
          <ActionButton
            label="Reset"
            onClick={() => onUpdate(candidate.id, 'pending')}
            disabled={isUpdating}
            variant="neutral"
          />
        )}
      </div>
    </div>
  );
}

/** Themed action button */
function ActionButton({
  label,
  onClick,
  disabled,
  variant,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  variant: 'emerald' | 'red' | 'neutral';
}) {
  const cls =
    variant === 'emerald'
      ? 'bg-emerald-600/20 text-emerald-300 ring-emerald-500/30 hover:bg-emerald-600/30'
      : variant === 'red'
        ? 'bg-red-600/20 text-red-300 ring-red-500/30 hover:bg-red-600/30'
        : 'bg-white/10 text-white/50 ring-white/20 hover:bg-white/15';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-3 py-1.5 font-medium ring-1 transition-colors disabled:opacity-40 ${cls}`}
      style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}
    >
      {disabled ? '...' : label}
    </button>
  );
}
