'use client';

/**
 * Admin — Vocabulary Crowdsourcing Review Queue (Phase 7.7, Part 5)
 * ==================================================================
 *
 * The one-stop admin page for reviewing user-submitted custom vocabulary.
 * Workflow: scan the batch → reject bad ones → Accept All Remaining.
 *
 * Features:
 *   - Auth gate (PROMAGEN_CRON_SECRET)
 *   - Stats bar (pending / accepted / rejected / auto-filtered)
 *   - Filter tabs (Pending / Accepted / Rejected / Auto-Filtered / All)
 *   - Live search across terms
 *   - Confidence badges (🟢 High / 🟡 Medium / 🔴 Low)
 *   - Smart Category Suggestion display
 *   - Reject individual terms → undo reject
 *   - Accept All Remaining (one-click batch)
 *   - Batch Preview: category colour map before accepting
 *   - Export-to-PR: download updated vocab JSONs as zip after accept
 *   - Growth Dashboard: daily submission timeline
 *
 * Protected: requires PROMAGEN_CRON_SECRET entered in-page.
 *
 * Route: /admin/vocab-submissions
 * API:   /api/admin/vocab-submissions
 *
 * @see docs/authority/prompt-builder-evolution-plan-v2.md § 7.7
 *
 * Version: 2.0.0 — Part 7 (live polling + category reassignment)
 * Created: 2026-02-27
 *
 * Existing features preserved: Yes.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// ============================================================================
// TYPES (local — mirroring server types without importing server-only modules)
// ============================================================================

type PromptCategory =
  | 'subject' | 'action' | 'style' | 'environment' | 'composition' | 'camera'
  | 'lighting' | 'colour' | 'atmosphere' | 'materials' | 'fidelity' | 'negative';

type ConfidenceLevel = 'high' | 'medium' | 'low';
type SubmissionStatus = 'pending' | 'accepted' | 'rejected';

interface VocabSubmission {
  id: string;
  term: string;
  category: PromptCategory;
  suggestedCategories: PromptCategory[];
  platformIds: string[];
  tier: number;
  count: number;
  uniqueSessions: number;
  confidence: ConfidenceLevel;
  status: SubmissionStatus;
  submittedAt: string;
  acceptedAt: string | null;
  rejectedAt: string | null;
}

interface FilteredSubmission {
  id: string;
  rawTerm: string;
  term: string;
  category: PromptCategory;
  reason: string;
  matchedPattern: string;
  filteredAt: string;
}

interface GrowthDataPoint {
  date: string;
  submitted: number;
  accepted: number;
  rejected: number;
  autoFiltered: number;
}

interface VocabStats {
  totalReceived: number;
  pending: number;
  accepted: number;
  rejected: number;
  autoFiltered: number;
}

interface GetResponse {
  ok: boolean;
  submissions: VocabSubmission[];
  filtered: FilteredSubmission[];
  stats: VocabStats;
  dailyGrowth: GrowthDataPoint[];
  lastBatchAt: string | null;
  error?: string;
}

interface AcceptBatchResponse {
  ok: boolean;
  message: string;
  accepted: number;
  categoriesModified: PromptCategory[];
  skippedDuplicates: number;
  batchedAt: string;
  acceptedByCategory: Partial<Record<PromptCategory, string[]>>;
  error?: string;
}

type TabFilter = 'pending' | 'accepted' | 'rejected' | 'auto-filtered' | 'all';

// ============================================================================
// CONSTANTS
// ============================================================================

const ALL_CATEGORIES: PromptCategory[] = [
  'subject', 'action', 'style', 'environment', 'composition', 'camera',
  'lighting', 'colour', 'atmosphere', 'materials', 'fidelity', 'negative',
];

/**
 * Category colour map — consistent with prompt builder category badges.
 * Each category gets a distinctive colour for visual scanning.
 */
const CATEGORY_COLOURS: Record<PromptCategory, { bg: string; text: string; ring: string }> = {
  subject:     { bg: 'bg-violet-500/20',  text: 'text-violet-300',  ring: 'ring-violet-500/30' },
  action:      { bg: 'bg-blue-500/20',    text: 'text-blue-300',    ring: 'ring-blue-500/30' },
  style:       { bg: 'bg-pink-500/20',    text: 'text-pink-300',    ring: 'ring-pink-500/30' },
  environment: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', ring: 'ring-emerald-500/30' },
  composition: { bg: 'bg-cyan-500/20',    text: 'text-cyan-300',    ring: 'ring-cyan-500/30' },
  camera:      { bg: 'bg-sky-500/20',     text: 'text-sky-300',     ring: 'ring-sky-500/30' },
  lighting:    { bg: 'bg-amber-500/20',   text: 'text-amber-300',   ring: 'ring-amber-500/30' },
  colour:      { bg: 'bg-rose-500/20',    text: 'text-rose-300',    ring: 'ring-rose-500/30' },
  atmosphere:  { bg: 'bg-indigo-500/20',  text: 'text-indigo-300',  ring: 'ring-indigo-500/30' },
  materials:   { bg: 'bg-orange-500/20',  text: 'text-orange-300',  ring: 'ring-orange-500/30' },
  fidelity:    { bg: 'bg-teal-500/20',    text: 'text-teal-300',    ring: 'ring-teal-500/30' },
  negative:    { bg: 'bg-red-500/20',     text: 'text-red-300',     ring: 'ring-red-500/30' },
};

const CONFIDENCE_BADGE: Record<ConfidenceLevel, { icon: string; cls: string }> = {
  high:   { icon: '🟢', cls: 'text-emerald-300' },
  medium: { icon: '🟡', cls: 'text-amber-300' },
  low:    { icon: '🔴', cls: 'text-red-300' },
};

const API = '/api/admin/vocab-submissions';

// ============================================================================
// PAGE
// ============================================================================

export default function VocabSubmissionsPage() {
  // --- Auth ---
  const [secret, setSecret] = useState('');
  const [isAuthed, setIsAuthed] = useState(false);

  // --- Data ---
  const [submissions, setSubmissions] = useState<VocabSubmission[]>([]);
  const [filtered, setFiltered] = useState<FilteredSubmission[]>([]);
  const [stats, setStats] = useState<VocabStats>({
    totalReceived: 0, pending: 0, accepted: 0, rejected: 0, autoFiltered: 0,
  });
  const [dailyGrowth, setDailyGrowth] = useState<GrowthDataPoint[]>([]);
  const [lastBatchAt, setLastBatchAt] = useState<string | null>(null);

  // --- UI state ---
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [tab, setTab] = useState<TabFilter>('pending');
  const [search, setSearch] = useState('');
  const [actionInFlight, setActionInFlight] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [lastAcceptResult, setLastAcceptResult] = useState<AcceptBatchResponse | null>(null);

  // --- Keyboard review mode (Phase 7.7 Part 6) ---
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);

  // --- Live Submission Counter (Phase 7.7 Part 7) ---
  const [baselinePending, setBaselinePending] = useState<number | null>(null);
  const [polledPending, setPolledPending] = useState<number | null>(null);
  const [pollPulse, setPollPulse] = useState(false);

  // --- Bulk Category Reassignment (Phase 7.7 Part 7) ---
  const [reassignOpenId, setReassignOpenId] = useState<string | null>(null);

  // ── Toast auto-dismiss ─────────────────────────────────────────────────
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Build API URL with secret ──────────────────────────────────────────
  const apiUrl = useCallback(
    (extra = '') => `${API}?secret=${encodeURIComponent(secret)}${extra}`,
    [secret],
  );

  // ── Fetch queue ────────────────────────────────────────────────────────
  const fetchQueue = useCallback(async () => {
    if (!secret) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(apiUrl());
      if (res.status === 404) {
        setError('Authentication failed — check your secret.');
        setIsAuthed(false);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = (await res.json()) as GetResponse;
      if (!json.ok) throw new Error(json.error ?? 'Unknown error');

      setIsAuthed(true);
      setSubmissions(json.submissions);
      setFiltered(json.filtered);
      setStats(json.stats);
      setDailyGrowth(json.dailyGrowth);
      setLastBatchAt(json.lastBatchAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setIsLoading(false);
    }
  }, [secret, apiUrl]);

  // ── Reject terms ───────────────────────────────────────────────────────
  const rejectTerms = useCallback(async (ids: string[]) => {
    setActionInFlight(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', ids }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { message: string };
      setToast(json.message);
      await fetchQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reject failed');
    } finally {
      setActionInFlight(false);
    }
  }, [apiUrl, fetchQueue]);

  // ── Undo reject ────────────────────────────────────────────────────────
  const undoReject = useCallback(async (ids: string[]) => {
    setActionInFlight(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'undo-reject', ids }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { message: string };
      setToast(json.message);
      await fetchQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Undo failed');
    } finally {
      setActionInFlight(false);
    }
  }, [apiUrl, fetchQueue]);

  // ── Accept batch ───────────────────────────────────────────────────────
  const acceptBatch = useCallback(async () => {
    setActionInFlight(true);
    setError(null);
    setShowPreview(false);
    try {
      const res = await fetch(apiUrl(), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept-batch' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as AcceptBatchResponse;
      if (!json.ok) throw new Error(json.error ?? 'Accept failed');
      setToast(json.message);
      setLastAcceptResult(json);
      await fetchQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Accept failed');
    } finally {
      setActionInFlight(false);
    }
  }, [apiUrl, fetchQueue]);

  // ── Rescue from auto-filter ────────────────────────────────────────────
  const rescue = useCallback(async (ids: string[]) => {
    setActionInFlight(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rescue', ids }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { message: string };
      setToast(json.message);
      await fetchQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rescue failed');
    } finally {
      setActionInFlight(false);
    }
  }, [apiUrl, fetchQueue]);

  // ── Reassign category ──────────────────────────────────────────────────
  const reassignCategory = useCallback(async (id: string, newCategory: string) => {
    setActionInFlight(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reassign-category', id, newCategory }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { ok: boolean; message: string };
      if (!json.ok) throw new Error('Reassign failed');
      setToast(json.message);
      setReassignOpenId(null);
      await fetchQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reassign failed');
    } finally {
      setActionInFlight(false);
    }
  }, [apiUrl, fetchQueue]);

  // ── Override confidence ────────────────────────────────────────────────
  const overrideConfidence = useCallback(async (id: string, newConfidence: string) => {
    setActionInFlight(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'override-confidence', id, newConfidence }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { ok: boolean; message: string };
      if (!json.ok) throw new Error('Override failed');
      setToast(json.message);
      await fetchQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Override failed');
    } finally {
      setActionInFlight(false);
    }
  }, [apiUrl, fetchQueue]);

  // ── Auto-fetch on auth ─────────────────────────────────────────────────
  useEffect(() => {
    if (isAuthed) { void fetchQueue(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed]);

  // ── Set baseline when stats first load / after full refresh ────────────
  useEffect(() => {
    if (stats.pending > 0 && baselinePending === null) {
      setBaselinePending(stats.pending);
      setPolledPending(stats.pending);
    }
  }, [stats.pending, baselinePending]);

  // ── Live polling (every 30s on Pending tab) ────────────────────────────
  useEffect(() => {
    if (!isAuthed || tab !== 'pending') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(apiUrl('&status=pending'));
        if (!res.ok) return;
        const json = (await res.json()) as GetResponse;
        if (!json.ok) return;

        const newPending = json.stats.pending;
        setPolledPending((prev) => {
          if (prev !== null && newPending > prev) {
            // Trigger pulse animation
            setPollPulse(true);
            setTimeout(() => setPollPulse(false), 2000);
          }
          return newPending;
        });
      } catch {
        // Silent — polling failure is not critical
      }
    }, 30_000);

    return () => clearInterval(interval);
  }, [isAuthed, tab, apiUrl]);

  // ── Filtered + searched list ───────────────────────────────────────────
  const visibleSubmissions = useMemo(() => {
    let list = submissions;

    // Tab filter
    if (tab === 'pending') list = list.filter((s) => s.status === 'pending');
    else if (tab === 'accepted') list = list.filter((s) => s.status === 'accepted');
    else if (tab === 'rejected') list = list.filter((s) => s.status === 'rejected');
    else if (tab === 'auto-filtered') return []; // Handled separately
    else if (tab !== 'all') list = list.filter((s) => s.status === 'pending');

    // Search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((s) => s.term.includes(q) || s.category.includes(q));
    }

    return list;
  }, [submissions, tab, search]);

  const pendingSubmissions = useMemo(
    () => submissions.filter((s) => s.status === 'pending'),
    [submissions],
  );

  // ── Batch preview data (Improvement 1) ─────────────────────────────────
  const previewByCategory = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const cat of ALL_CATEGORIES) {
      map[cat] = [];
    }
    for (const s of pendingSubmissions) {
      // Primary category
      const primary = map[s.category];
      if (primary && !primary.includes(s.term)) {
        primary.push(s.term);
      }
      // Suggested additional categories
      for (const sug of s.suggestedCategories) {
        if (sug === s.category) continue;
        const bucket = map[sug];
        if (bucket && !bucket.includes(s.term)) {
          bucket.push(s.term);
        }
      }
    }
    return map;
  }, [pendingSubmissions]);

  // ── Keyboard-driven review (J/K/X/U) ──────────────────────────────────
  useEffect(() => {
    if (!isAuthed || tab !== 'pending') return;

    function handleKeyDown(e: KeyboardEvent) {
      // Skip if typing in an input
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      // Skip if category reassign popover is open
      if (reassignOpenId) return;

      const maxIdx = visibleSubmissions.length - 1;
      if (maxIdx < 0) return;

      switch (e.key.toLowerCase()) {
        case 'j': // Next row
          e.preventDefault();
          setFocusedIdx((prev) => Math.min(prev + 1, maxIdx));
          break;
        case 'k': // Previous row
          e.preventDefault();
          setFocusedIdx((prev) => Math.max(prev - 1, 0));
          break;
        case 'x': { // Reject focused
          e.preventDefault();
          setFocusedIdx((cur) => {
            const item = visibleSubmissions[cur];
            if (item && item.status === 'pending') {
              void rejectTerms([item.id]);
            }
            return cur;
          });
          break;
        }
        case 'u': { // Undo reject focused
          e.preventDefault();
          setFocusedIdx((cur) => {
            const item = visibleSubmissions[cur];
            if (item && item.status === 'rejected') {
              void undoReject([item.id]);
            }
            return cur;
          });
          break;
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthed, tab, visibleSubmissions, rejectTerms, undoReject, reassignOpenId]);

  // Scroll focused row into view
  useEffect(() => {
    if (focusedIdx < 0 || !listRef.current) return;
    const rows = listRef.current.querySelectorAll('[data-vocab-row]');
    const row = rows[focusedIdx];
    if (row) {
      row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [focusedIdx]);

  // Reset focus when tab changes or data refreshes
  useEffect(() => { setFocusedIdx(-1); }, [tab, submissions]);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <h1
        style={{ fontSize: 'clamp(18px, 2vw, 28px)' }}
        className="mb-1 font-bold"
      >
        Vocabulary Submissions
      </h1>
      <p
        style={{ fontSize: 'clamp(12px, 1.2vw, 15px)' }}
        className="mb-6 text-white/50"
      >
        User-submitted custom terms from the prompt builder. Scan, reject the bad, accept the rest.
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
              onKeyDown={(e) => { if (e.key === 'Enter') void fetchQueue(); }}
              className="w-full rounded-lg bg-black/40 px-3 py-2 text-sm ring-1 ring-white/20 focus:outline-none focus:ring-white/40"
              placeholder="PROMAGEN_CRON_SECRET"
            />
          </div>
          <button
            type="button"
            onClick={() => void fetchQueue()}
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

      {/* ── Toast ────────────────────────────────────────────────── */}
      {toast && (
        <div className="mb-4 rounded-lg bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300 ring-1 ring-emerald-500/20">
          ✓ {toast}
        </div>
      )}

      {/* ── Stats bar ────────────────────────────────────────────── */}
      {isAuthed && (
        <div className="mb-4 flex flex-wrap items-center gap-5 border-b border-white/10 pb-3">
          <StatChip label="Pending" value={stats.pending} variant="amber" />

          {/* Live counter — shows when polling detects new submissions */}
          {polledPending !== null && baselinePending !== null && polledPending > baselinePending && (
            <span
              className={`rounded-full bg-amber-500/20 px-2.5 py-0.5 font-mono font-bold text-amber-300 ring-1 ring-amber-500/30 transition-all ${
                pollPulse ? 'scale-110 bg-amber-500/30' : 'scale-100'
              }`}
              style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}
            >
              +{polledPending - baselinePending} new
            </span>
          )}

          <StatChip label="Accepted" value={stats.accepted} variant="emerald" />
          <StatChip label="Rejected" value={stats.rejected} variant="red" />
          <StatChip label="Auto-Filtered" value={stats.autoFiltered} variant="orange" />
          <StatChip label="Total Received" value={stats.totalReceived} />

          {lastBatchAt && (
            <span
              className="ml-auto text-white/30"
              style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}
            >
              Last batch: {new Date(lastBatchAt).toLocaleString()}
            </span>
          )}

          <button
            type="button"
            onClick={() => {
              // Reset baseline on manual refresh
              setBaselinePending(null);
              setPolledPending(null);
              void fetchQueue();
            }}
            disabled={isLoading}
            className="rounded-md bg-white/10 px-3 py-1 text-xs ring-1 ring-white/20 hover:bg-white/15 disabled:opacity-40"
          >
            {isLoading ? '...' : 'Refresh'}
          </button>
        </div>
      )}

      {/* ── Filter tabs + Search ──────────────────────────────────── */}
      {isAuthed && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex gap-1">
            {(['pending', 'accepted', 'rejected', 'auto-filtered', 'all'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setTab(f)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  tab === f
                    ? 'bg-white/15 text-white ring-1 ring-white/30'
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                {f === 'auto-filtered' ? 'Auto-Filtered' : f.charAt(0).toUpperCase() + f.slice(1)}
                {f === 'pending' && stats.pending > 0 && (
                  <span className="ml-1 text-amber-300">({stats.pending})</span>
                )}
              </button>
            ))}
          </div>

          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ml-auto w-52 rounded-md bg-black/40 px-3 py-1 text-xs ring-1 ring-white/20 focus:outline-none focus:ring-white/40"
            placeholder="Search terms..."
          />
        </div>
      )}

      {/* ── Batch Preview + Accept toolbar (Pending tab) ──────────── */}
      {isAuthed && tab === 'pending' && pendingSubmissions.length > 0 && (
        <div className="mb-4">
          {/* Preview toggle */}
          <div className="mb-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium ring-1 ring-white/20 hover:bg-white/15"
            >
              {showPreview ? 'Hide' : 'Show'} Batch Preview
            </button>

            {/* Accept All Remaining */}
            <button
              type="button"
              onClick={() => void acceptBatch()}
              disabled={actionInFlight || pendingSubmissions.length === 0}
              className="rounded-md bg-emerald-600/30 px-4 py-1.5 text-xs font-bold text-emerald-200 ring-1 ring-emerald-500/40 transition-colors hover:bg-emerald-600/50 disabled:opacity-40"
            >
              {actionInFlight
                ? 'Processing...'
                : `Accept All Remaining (${pendingSubmissions.length})`}
            </button>
          </div>

          {/* ── Category Colour Map Preview (Improvement 1) ─────── */}
          {showPreview && (
            <BatchPreview previewByCategory={previewByCategory} />
          )}
        </div>
      )}

      {/* ── Export-to-PR (Improvement 2) — shown after batch accept ── */}
      {isAuthed && lastAcceptResult && lastAcceptResult.accepted > 0 && (
        <ExportPanel result={lastAcceptResult} onDismiss={() => setLastAcceptResult(null)} />
      )}

      {/* ── Auto-Filtered tab ─────────────────────────────────────── */}
      {isAuthed && tab === 'auto-filtered' && (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <EmptyState>No auto-filtered terms.</EmptyState>
          ) : (
            filtered.map((f) => (
              <FilteredRow
                key={f.id}
                item={f}
                disabled={actionInFlight}
                onRescue={() => void rescue([f.id])}
              />
            ))
          )}
        </div>
      )}

      {/* ── Submissions table ─────────────────────────────────────── */}
      {isAuthed && tab !== 'auto-filtered' && (
        <div className="space-y-1.5" ref={listRef}>
          {visibleSubmissions.length === 0 ? (
            <EmptyState>
              No {tab === 'all' ? '' : `${tab} `}submissions
              {search ? ` matching "${search}"` : ''}.
            </EmptyState>
          ) : (
            visibleSubmissions.map((s, idx) => (
              <SubmissionRow
                key={s.id}
                submission={s}
                disabled={actionInFlight}
                isFocused={tab === 'pending' && idx === focusedIdx}
                reassignOpen={reassignOpenId === s.id}
                onToggleReassign={() => setReassignOpenId(reassignOpenId === s.id ? null : s.id)}
                onReassign={(newCat) => void reassignCategory(s.id, newCat)}
                onOverrideConfidence={(level) => void overrideConfidence(s.id, level)}
                onReject={() => void rejectTerms([s.id])}
                onUndoReject={() => void undoReject([s.id])}
              />
            ))
          )}
        </div>
      )}

      {/* ── Keyboard hint (Pending tab with items) ────────────────── */}
      {isAuthed && tab === 'pending' && visibleSubmissions.length > 0 && (
        <div
          className="mt-3 flex items-center justify-center gap-4 rounded-lg bg-white/5 py-2 text-white/25"
          style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}
        >
          <span><kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white/50">J</kbd> next</span>
          <span><kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white/50">K</kbd> prev</span>
          <span><kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white/50">X</kbd> reject</span>
          <span><kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white/50">U</kbd> undo</span>
        </div>
      )}

      {/* ── Growth Dashboard ──────────────────────────────────────── */}
      {isAuthed && dailyGrowth.length > 0 && (
        <GrowthDashboard data={dailyGrowth} />
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
  variant?: 'amber' | 'emerald' | 'red' | 'orange';
}) {
  const valueColorClass =
    variant === 'amber' ? 'text-amber-300'
    : variant === 'emerald' ? 'text-emerald-300'
    : variant === 'red' ? 'text-red-300'
    : variant === 'orange' ? 'text-orange-300'
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

/** Category badge with colour */
function CategoryBadge({ category }: { category: PromptCategory }) {
  const colours = CATEGORY_COLOURS[category];
  if (!colours) return <span className="text-white/40">{category}</span>;

  return (
    <span
      className={`inline-block rounded-md px-2 py-0.5 ring-1 ${colours.bg} ${colours.text} ${colours.ring}`}
      style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}
    >
      {category}
    </span>
  );
}

// ============================================================================
// CATEGORY REASSIGN POPOVER (Phase 7.7 Part 7)
// ============================================================================

/**
 * Mini popover showing all 12 categories for reassignment.
 * Appears when admin clicks a category badge on a pending term.
 * Current category is highlighted and disabled.
 */
function CategoryReassignPopover({
  currentCategory,
  onSelect,
  onClose,
}: {
  currentCategory: PromptCategory;
  onSelect: (category: string) => void;
  onClose: () => void;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    // Use setTimeout to avoid the toggle click from immediately closing
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      ref={popoverRef}
      className="absolute left-0 top-full z-50 mt-1 grid grid-cols-3 gap-1 rounded-lg bg-[#111827] p-2 shadow-xl ring-1 ring-white/20"
      style={{ width: 'clamp(240px, 25vw, 320px)' }}
    >
      <p
        className="col-span-3 mb-1 text-center text-white/40"
        style={{ fontSize: 'clamp(9px, 0.8vw, 11px)' }}
      >
        Reassign to:
      </p>
      {ALL_CATEGORIES.map((cat) => {
        const isCurrent = cat === currentCategory;
        const colours = CATEGORY_COLOURS[cat];
        return (
          <button
            key={cat}
            type="button"
            disabled={isCurrent}
            onClick={() => onSelect(cat)}
            className={`rounded-md px-2 py-1 text-center transition-colors ${
              isCurrent
                ? `${colours?.bg ?? ''} ${colours?.text ?? ''} opacity-50 ring-1 ${colours?.ring ?? ''}`
                : 'bg-white/5 text-white/60 ring-1 ring-white/10 hover:bg-white/15 hover:text-white'
            }`}
            style={{ fontSize: 'clamp(9px, 0.8vw, 11px)' }}
            title={isCurrent ? 'Current category' : `Reassign to ${cat}`}
          >
            {cat}
            {isCurrent && ' ✓'}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// SUBMISSION ROW
// ============================================================================

function SubmissionRow({
  submission: s,
  disabled,
  isFocused,
  reassignOpen,
  onToggleReassign,
  onReassign,
  onOverrideConfidence,
  onReject,
  onUndoReject,
}: {
  submission: VocabSubmission;
  disabled: boolean;
  isFocused: boolean;
  reassignOpen: boolean;
  onToggleReassign: () => void;
  onReassign: (newCategory: string) => void;
  onOverrideConfidence: (newLevel: string) => void;
  onReject: () => void;
  onUndoReject: () => void;
}) {
  const conf = CONFIDENCE_BADGE[s.confidence];
  const isRejected = s.status === 'rejected';
  const isAccepted = s.status === 'accepted';
  const additionalCategories = s.suggestedCategories.filter((c) => c !== s.category);

  return (
    <div
      data-vocab-row
      className={`flex items-center gap-3 rounded-lg ring-1 transition-colors ${
        isFocused
          ? 'bg-sky-500/10 ring-sky-500/30'
          : isRejected
            ? 'bg-red-500/5 ring-white/5'
            : isAccepted
              ? 'bg-emerald-500/5 ring-white/5'
              : 'bg-white/[0.03] ring-white/10 hover:bg-white/[0.06]'
      }`}
      style={{ padding: 'clamp(8px, 1vw, 14px)' }}
    >
      {/* Confidence — clickable on pending terms to cycle levels */}
      {s.status === 'pending' ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            const cycle: Record<string, string> = { low: 'medium', medium: 'high', high: 'low' };
            const next = cycle[s.confidence] ?? 'low';
            onOverrideConfidence(next);
          }}
          className="shrink-0 cursor-pointer transition-transform hover:scale-125 disabled:opacity-40"
          title={`Confidence: ${s.confidence} — click to cycle`}
        >
          {conf?.icon ?? '🔴'}
        </button>
      ) : (
        <span title={`Confidence: ${s.confidence}`} className="shrink-0">
          {conf?.icon ?? '🔴'}
        </span>
      )}

      {/* Term */}
      <span
        className={`min-w-0 flex-1 truncate font-medium ${
          isRejected ? 'text-white/30 line-through' : 'text-white/90'
        }`}
        style={{ fontSize: 'clamp(12px, 1.2vw, 15px)' }}
        title={s.term}
      >
        {s.term}
      </span>

      {/* Category badge — clickable for pending terms to reassign */}
      {s.status === 'pending' ? (
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={onToggleReassign}
            disabled={disabled}
            className="cursor-pointer transition-opacity hover:opacity-80"
            title="Click to reassign category"
          >
            <CategoryBadge category={s.category} />
          </button>
          {reassignOpen && (
            <CategoryReassignPopover
              currentCategory={s.category}
              onSelect={onReassign}
              onClose={onToggleReassign}
            />
          )}
        </div>
      ) : (
        <CategoryBadge category={s.category} />
      )}

      {/* Additional suggested categories */}
      {additionalCategories.length > 0 && (
        <span className="hidden items-center gap-1 sm:flex">
          <span
            className="text-white/30"
            style={{ fontSize: 'clamp(9px, 0.8vw, 11px)' }}
          >
            also:
          </span>
          {additionalCategories.map((c) => (
            <CategoryBadge key={c} category={c} />
          ))}
        </span>
      )}

      {/* Count */}
      <span
        className="shrink-0 font-mono text-white/40"
        style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}
        title={`${s.count} submissions from ${s.uniqueSessions} sessions`}
      >
        ×{s.count}
      </span>

      {/* Platforms */}
      {s.platformIds.length > 0 && (
        <span
          className="hidden shrink-0 truncate text-white/30 md:block"
          style={{ fontSize: 'clamp(9px, 0.8vw, 11px)', maxWidth: '120px' }}
          title={s.platformIds.join(', ')}
        >
          {s.platformIds.slice(0, 2).join(', ')}
          {s.platformIds.length > 2 && ` +${s.platformIds.length - 2}`}
        </span>
      )}

      {/* Actions */}
      {s.status === 'pending' && (
        <button
          type="button"
          onClick={onReject}
          disabled={disabled}
          className="shrink-0 rounded-md bg-red-600/20 px-2.5 py-1 text-xs font-medium text-red-300 ring-1 ring-red-500/30 transition-colors hover:bg-red-600/30 disabled:opacity-40"
          title="Reject this term"
        >
          ✕
        </button>
      )}

      {s.status === 'rejected' && (
        <button
          type="button"
          onClick={onUndoReject}
          disabled={disabled}
          className="shrink-0 rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium text-white/50 ring-1 ring-white/20 transition-colors hover:bg-white/15 disabled:opacity-40"
          title="Undo reject — move back to pending"
        >
          ↩
        </button>
      )}

      {s.status === 'accepted' && (
        <span
          className="shrink-0 text-emerald-400"
          style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}
        >
          ✓
        </span>
      )}
    </div>
  );
}

// ============================================================================
// FILTERED ROW (Auto-filtered tab)
// ============================================================================

function FilteredRow({
  item,
  disabled,
  onRescue,
}: {
  item: FilteredSubmission;
  disabled: boolean;
  onRescue: () => void;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-lg bg-white/[0.03] ring-1 ring-white/10"
      style={{ padding: 'clamp(8px, 1vw, 14px)' }}
    >
      <span className="shrink-0 text-white/30">🚫</span>

      <span
        className="min-w-0 flex-1 truncate text-white/50"
        style={{ fontSize: 'clamp(12px, 1.2vw, 15px)' }}
      >
        {item.term}
      </span>

      <CategoryBadge category={item.category} />

      <span
        className="shrink-0 rounded-md bg-red-500/10 px-2 py-0.5 text-red-300 ring-1 ring-red-500/20"
        style={{ fontSize: 'clamp(9px, 0.8vw, 11px)' }}
      >
        {item.reason}: {item.matchedPattern}
      </span>

      <span
        className="shrink-0 text-white/20"
        style={{ fontSize: 'clamp(9px, 0.8vw, 11px)' }}
      >
        {new Date(item.filteredAt).toLocaleDateString()}
      </span>

      <button
        type="button"
        onClick={onRescue}
        disabled={disabled}
        className="shrink-0 rounded-md bg-amber-600/20 px-2.5 py-1 text-xs font-medium text-amber-300 ring-1 ring-amber-500/30 transition-colors hover:bg-amber-600/30 disabled:opacity-40"
        title="Rescue — move to pending queue"
      >
        Rescue
      </button>
    </div>
  );
}

// ============================================================================
// BATCH PREVIEW (Improvement 1 — Category Colour Map)
// ============================================================================

function BatchPreview({
  previewByCategory,
}: {
  previewByCategory: Record<string, string[]>;
}) {
  // ── Category distribution anomaly detection ──────────────────────────
  const totalTerms = ALL_CATEGORIES.reduce(
    (sum, cat) => sum + (previewByCategory[cat]?.length ?? 0),
    0,
  );
  const anomaly = useMemo(() => {
    if (totalTerms < 5) return null; // Too few to be meaningful
    const ANOMALY_THRESHOLD = 0.6;
    for (const cat of ALL_CATEGORIES) {
      const count = previewByCategory[cat]?.length ?? 0;
      const ratio = count / totalTerms;
      if (ratio > ANOMALY_THRESHOLD) {
        return { category: cat, count, percent: Math.round(ratio * 100) };
      }
    }
    return null;
  }, [previewByCategory, totalTerms]);

  return (
    <div className="rounded-xl bg-white/5 ring-1 ring-white/10" style={{ padding: 'clamp(12px, 1.5vw, 20px)' }}>
      <h3
        className="mb-3 font-semibold text-white/70"
        style={{ fontSize: 'clamp(13px, 1.3vw, 16px)' }}
      >
        Batch Preview — Terms by Category
      </h3>

      {/* ── Anomaly alert ─────────────────────────────────────── */}
      {anomaly && (
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-orange-500/10 px-4 py-2.5 ring-1 ring-orange-500/25">
          <span style={{ fontSize: 'clamp(14px, 1.3vw, 18px)' }}>⚠️</span>
          <div>
            <p
              className="font-medium text-orange-300"
              style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}
            >
              {anomaly.percent}% of submissions are in <strong>{anomaly.category}</strong> ({anomaly.count}/{totalTerms})
            </p>
            <p
              className="mt-0.5 text-orange-300/60"
              style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}
            >
              Possible bot or single-user bulk submission — check sessions/platforms before accepting.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {ALL_CATEGORIES.map((cat) => {
          const terms = previewByCategory[cat] ?? [];
          const colours = CATEGORY_COLOURS[cat];
          const isEmpty = terms.length === 0;

          return (
            <div
              key={cat}
              className={`rounded-lg ring-1 ${
                isEmpty
                  ? 'bg-white/[0.02] ring-white/5'
                  : `${colours?.bg ?? 'bg-white/10'} ${colours?.ring ?? 'ring-white/20'}`
              }`}
              style={{ padding: 'clamp(8px, 1vw, 12px)' }}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={`font-medium ${isEmpty ? 'text-white/20' : (colours?.text ?? 'text-white/70')}`}
                  style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}
                >
                  {cat}
                </span>
                <span
                  className={`font-mono font-bold ${isEmpty ? 'text-white/15' : 'text-white/70'}`}
                  style={{ fontSize: 'clamp(12px, 1.2vw, 15px)' }}
                >
                  {terms.length}
                </span>
              </div>
              {terms.length > 0 && (
                <div
                  className="truncate text-white/40"
                  style={{ fontSize: 'clamp(9px, 0.8vw, 11px)' }}
                  title={terms.join(', ')}
                >
                  {terms.slice(0, 5).join(', ')}
                  {terms.length > 5 && ` +${terms.length - 5} more`}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// EXPORT PANEL (Improvement 2 — Export-to-PR)
// ============================================================================

function ExportPanel({
  result,
  onDismiss,
}: {
  result: AcceptBatchResponse;
  onDismiss: () => void;
}) {
  const [isGenerating, setIsGenerating] = useState(false);

  /**
   * Generate a JSON blob for each modified category and trigger download.
   * The blob contains `{ category, termsToAdd: string[] }` entries
   * that can be applied to the vocab JSONs.
   */
  const handleExport = useCallback(() => {
    setIsGenerating(true);

    try {
      const exportData = {
        exportedAt: result.batchedAt,
        accepted: result.accepted,
        skippedDuplicates: result.skippedDuplicates,
        categories: Object.entries(result.acceptedByCategory).map(([cat, terms]) => ({
          category: cat,
          file: `src/data/vocabulary/prompt-builder/${cat}.json`,
          termsToAdd: terms ?? [],
          count: terms?.length ?? 0,
        })),
      };

      const blob = new Blob(
        [JSON.stringify(exportData, null, 2)],
        { type: 'application/json' },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vocab-export-${result.batchedAt.slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsGenerating(false);
    }
  }, [result]);

  /**
   * Generate an apply-vocab-export.ts script that automates merging the
   * accepted terms into the prompt-builder JSON files.
   * Run: ts-node apply-vocab-export.ts
   */
  const handleGenerateScript = useCallback(() => {
    const dateSlug = result.batchedAt.slice(0, 10);
    const exportFilename = `vocab-export-${dateSlug}.json`;

    const script = `#!/usr/bin/env ts-node
// apply-vocab-export.ts
// ============================================================================
// AUTO-MERGE SCRIPT — Apply vocab export to prompt-builder JSON files
// ============================================================================
//
// Generated: ${result.batchedAt}
// Accepted:  ${result.accepted} terms across ${result.categoriesModified.length} categories
//
// Usage (run from repo root / frontend folder):
//   ts-node apply-vocab-export.ts
//
// What it does:
//   1. Reads ${exportFilename}
//   2. For each category with new terms:
//      - Opens src/data/vocabulary/prompt-builder/{category}.json
//      - Appends new terms to the options[] array (dedup check)
//      - Sorts options alphabetically (preserving the leading "" empty string)
//      - Bumps meta.totalOptions
//      - Writes back with consistent JSON formatting
//   3. Prints a summary of changes
//
// After running, commit the changes and deploy.
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';

interface ExportCategory {
  category: string;
  file: string;
  termsToAdd: string[];
  count: number;
}

interface ExportData {
  exportedAt: string;
  accepted: number;
  skippedDuplicates: number;
  categories: ExportCategory[];
}

interface VocabJson {
  $schema: string;
  version: string;
  meta: {
    domain: string;
    category: string;
    label: string;
    description: string;
    tooltipGuidance: string;
    totalOptions: number;
    updated: string;
  };
  options: string[];
}

// ── Main ─────────────────────────────────────────────────────────────────────

const EXPORT_FILE = path.resolve(__dirname, '${exportFilename}');

function main(): void {
  // Find the export file — check current dir and frontend dir
  let exportPath = EXPORT_FILE;
  if (!fs.existsSync(exportPath)) {
    // Try relative to script location
    exportPath = path.resolve(process.cwd(), '${exportFilename}');
  }
  if (!fs.existsSync(exportPath)) {
    console.error('❌ Export file not found: ${exportFilename}');
    console.error('   Place it next to this script or in the current directory.');
    process.exit(1);
  }

  const raw = fs.readFileSync(exportPath, 'utf-8');
  const exportData: ExportData = JSON.parse(raw);

  console.log('\\n📦 Applying vocab export from', exportData.exportedAt);
  console.log('   Total accepted:', exportData.accepted);
  console.log('   Categories:', exportData.categories.length);
  console.log('');

  let totalAdded = 0;
  let totalSkipped = 0;

  for (const cat of exportData.categories) {
    if (cat.termsToAdd.length === 0) continue;

    // Resolve the vocab JSON path
    const vocabPath = path.resolve(process.cwd(), cat.file);
    if (!fs.existsSync(vocabPath)) {
      // Try from frontend subfolder
      const altPath = path.resolve(process.cwd(), 'frontend', cat.file);
      if (fs.existsSync(altPath)) {
        applyToFile(altPath, cat);
      } else {
        console.warn('  ⚠️  File not found:', cat.file);
      }
      continue;
    }

    const result = applyToFile(vocabPath, cat);
    totalAdded += result.added;
    totalSkipped += result.skipped;
  }

  console.log('');
  console.log('✅ Done!');
  console.log('   Added:', totalAdded, 'terms');
  if (totalSkipped > 0) console.log('   Skipped (already exist):', totalSkipped);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Review changes: git diff');
  console.log('  2. Commit: git add -A && git commit -m "vocab: add', totalAdded, 'crowdsourced terms"');
  console.log('  3. Deploy');
}

function applyToFile(
  filePath: string,
  cat: ExportCategory,
): { added: number; skipped: number } {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const vocab: VocabJson = JSON.parse(raw);

  // Lowercase set for dedup
  const existing = new Set(vocab.options.map((o) => o.toLowerCase()));

  let added = 0;
  let skipped = 0;

  for (const term of cat.termsToAdd) {
    const lower = term.toLowerCase();
    if (existing.has(lower)) {
      skipped++;
      continue;
    }
    vocab.options.push(term);
    existing.add(lower);
    added++;
  }

  if (added === 0) {
    console.log('  ⏭️ ', cat.category, '— all', cat.count, 'terms already exist');
    return { added, skipped };
  }

  // Sort options alphabetically, but keep the leading "" empty string first
  const hasEmpty = vocab.options[0] === '';
  const toSort = hasEmpty ? vocab.options.slice(1) : [...vocab.options];
  toSort.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  vocab.options = hasEmpty ? ['', ...toSort] : toSort;
  vocab.meta.totalOptions = vocab.options.length;
  vocab.meta.updated = new Date().toISOString().slice(0, 10);

  fs.writeFileSync(filePath, JSON.stringify(vocab, null, 2) + '\\n', 'utf-8');
  console.log('  ✅', cat.category, '— added', added, 'terms (now', vocab.meta.totalOptions, 'total)');

  return { added, skipped };
}

main();
`;

    const blob = new Blob([script], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'apply-vocab-export.ts';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [result]);

  return (
    <div
      className="mb-4 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20"
      style={{ padding: 'clamp(12px, 1.5vw, 20px)' }}
    >
      <div className="mb-2 flex items-start justify-between">
        <h3
          className="font-semibold text-emerald-300"
          style={{ fontSize: 'clamp(14px, 1.4vw, 18px)' }}
        >
          ✓ Batch Accepted
        </h3>
        <button
          type="button"
          onClick={onDismiss}
          className="text-white/30 hover:text-white/60"
          style={{ fontSize: 'clamp(16px, 1.4vw, 20px)' }}
        >
          ×
        </button>
      </div>

      <p
        className="mb-3 text-emerald-200/70"
        style={{ fontSize: 'clamp(12px, 1.2vw, 15px)' }}
      >
        {result.accepted} term{result.accepted !== 1 ? 's' : ''} accepted
        across {result.categoriesModified.length} categor{result.categoriesModified.length !== 1 ? 'ies' : 'y'}
        {result.skippedDuplicates > 0 && ` (${result.skippedDuplicates} duplicates skipped)`}
      </p>

      {/* Per-category breakdown */}
      <div className="mb-3 flex flex-wrap gap-2">
        {result.categoriesModified.map((cat) => {
          const terms = result.acceptedByCategory[cat];
          const count = terms?.length ?? 0;
          return (
            <div
              key={cat}
              className="flex items-center gap-1.5"
            >
              <CategoryBadge category={cat} />
              <span
                className="font-mono text-emerald-300/70"
                style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}
              >
                +{count}
              </span>
            </div>
          );
        })}
      </div>

      {/* Export buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleExport}
          disabled={isGenerating}
          className="rounded-md bg-emerald-600/30 px-4 py-2 text-sm font-bold text-emerald-200 ring-1 ring-emerald-500/40 transition-colors hover:bg-emerald-600/50 disabled:opacity-40"
        >
          {isGenerating ? 'Generating...' : 'Export Vocab Update JSON'}
        </button>
        <button
          type="button"
          onClick={handleGenerateScript}
          className="rounded-md bg-sky-600/30 px-4 py-2 text-sm font-bold text-sky-200 ring-1 ring-sky-500/40 transition-colors hover:bg-sky-600/50"
        >
          Generate Apply Script
        </button>
      </div>
      <p
        className="mt-2 text-emerald-300/40"
        style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}
      >
        Export JSON + download apply-vocab-export.ts → run <code className="rounded bg-black/30 px-1">ts-node apply-vocab-export.ts</code> from your repo root → commit.
      </p>
    </div>
  );
}

// ============================================================================
// GROWTH DASHBOARD
// ============================================================================

function GrowthDashboard({ data }: { data: GrowthDataPoint[] }) {
  // Take last 30 days max
  const recent = data.slice(-30);
  const maxVal = Math.max(
    ...recent.map((d) => Math.max(d.submitted, d.accepted, d.rejected, d.autoFiltered)),
    1,
  );

  return (
    <div
      className="mt-6 rounded-xl bg-white/5 ring-1 ring-white/10"
      style={{ padding: 'clamp(12px, 1.5vw, 20px)' }}
    >
      <h3
        className="mb-3 font-semibold text-white/70"
        style={{ fontSize: 'clamp(13px, 1.3vw, 16px)' }}
      >
        Vocabulary Growth (Last {recent.length} Days)
      </h3>

      {/* Legend */}
      <div className="mb-3 flex gap-4" style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-sky-400" /> Submitted
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-400" /> Accepted
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-400" /> Rejected
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-orange-400" /> Filtered
        </span>
      </div>

      {/* Bar chart */}
      <div className="flex items-end gap-px" style={{ height: 'clamp(60px, 8vw, 120px)' }}>
        {recent.map((d) => (
          <div
            key={d.date}
            className="group relative flex flex-1 flex-col items-center justify-end"
            style={{ height: '100%' }}
            title={`${d.date}: ${d.submitted} submitted, ${d.accepted} accepted, ${d.rejected} rejected, ${d.autoFiltered} filtered`}
          >
            {/* Stacked bars */}
            <div
              className="w-full rounded-t-sm bg-sky-400/60"
              style={{ height: `${Math.max((d.submitted / maxVal) * 100, 2)}%` }}
            />
          </div>
        ))}
      </div>

      {/* Date labels (first and last only) */}
      <div
        className="mt-1 flex justify-between text-white/20"
        style={{ fontSize: 'clamp(9px, 0.8vw, 11px)' }}
      >
        <span>{recent[0]?.date ?? ''}</span>
        <span>{recent[recent.length - 1]?.date ?? ''}</span>
      </div>
    </div>
  );
}
