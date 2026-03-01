'use client';

// src/components/admin/scoring-health/profile-manager.tsx
// ============================================================================
// SECTION 11 — CONFIGURATION PROFILES & ROLLBACK
// ============================================================================
//
// Full profile management panel:
//   - Save current live weights as a named snapshot
//   - List all saved profiles with metadata
//   - Activate any profile (writes to live scoring-weights)
//   - Delete profiles (cannot delete active)
//   - Visual diff: compare any two profiles side-by-side
//   - Active profile badge + rollback indicator
//
// Data: GET/POST /api/admin/scoring-health/profiles
// Mutations: POST .../profiles/activate, .../profiles/delete
//
// Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md
//
// Version: 1.1.0 — a11y fix: htmlFor on form labels
// Created: 2026-03-01
//
// Existing features preserved: Yes (new component).
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import type { ScoringHealthApiResponse } from '@/lib/admin/scoring-health-types';
import type {
  ProfileIndex,
  ProfileIndexEntry,
  ScoringProfile,
  ProfileDiff,
} from '@/lib/admin/scoring-profiles';
// Note: computeProfileDiff will be used once GET /profiles/[id] is added for full diff.
// Currently diff is structural — full weight comparison requires GET /profiles/[id].

// ============================================================================
// TYPES
// ============================================================================

type View = 'list' | 'save' | 'diff';

// ============================================================================
// SECTION HEADER
// ============================================================================

function SectionHeader({
  activeProfile,
  onRefresh,
}: {
  activeProfile: string | null;
  onRefresh: () => void;
}) {
  return (
    <div
      className="mb-4 flex items-center justify-between"
      style={{ gap: 'clamp(8px, 1vw, 12px)' }}
    >
      <div>
        <div className="flex items-center" style={{ gap: 'clamp(6px, 0.6vw, 10px)' }}>
          <h2
            className="font-semibold text-white/80"
            style={{ fontSize: 'clamp(14px, 1.4vw, 18px)' }}
          >
            Configuration Profiles
          </h2>
          {activeProfile && (
            <span
              className="rounded-full bg-violet-500/15 text-violet-400/80"
              style={{
                fontSize: 'clamp(8px, 0.7vw, 10px)',
                padding: 'clamp(1px, 0.15vw, 2px) clamp(6px, 0.6vw, 8px)',
              }}
            >
              Active: {activeProfile}
            </span>
          )}
        </div>
        <p
          className="text-white/30"
          style={{
            fontSize: 'clamp(10px, 0.85vw, 12px)',
            marginTop: 'clamp(1px, 0.15vw, 2px)',
          }}
        >
          Save, load, compare, and rollback scoring weight configurations
        </p>
      </div>
      <button
        onClick={onRefresh}
        className="rounded-md bg-white/5 text-white/50 transition-colors hover:bg-white/10 hover:text-white/70"
        style={{
          fontSize: 'clamp(10px, 0.9vw, 12px)',
          padding: 'clamp(4px, 0.4vw, 6px) clamp(10px, 1vw, 14px)',
        }}
      >
        ⟳ Refresh
      </button>
    </div>
  );
}

// ============================================================================
// SAVE PROFILE FORM
// ============================================================================

function SaveProfileForm({
  onSaved,
  onCancel,
}: {
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/scoring-health/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      });
      const json = (await res.json()) as ScoringHealthApiResponse<ScoringProfile>;
      if (!json.ok) {
        setError(json.message ?? 'Failed to save');
      } else {
        onSaved();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSaving(false);
    }
  }, [name, description, onSaved]);

  return (
    <div
      className="rounded-lg bg-white/[0.03] ring-1 ring-white/10"
      style={{ padding: 'clamp(12px, 1.5vw, 20px)' }}
    >
      <h3
        className="mb-3 font-semibold text-white/70"
        style={{ fontSize: 'clamp(12px, 1.1vw, 15px)' }}
      >
        💾 Save Current Weights as Profile
      </h3>

      <div className="mb-3">
        <label
          htmlFor="pm-profile-name"
          className="mb-1 block text-white/40"
          style={{ fontSize: 'clamp(9px, 0.8vw, 11px)' }}
        >
          Profile Name *
        </label>
        <input
          id="pm-profile-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Conservative v2, Pre-launch safe"
          maxLength={60}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white/90 outline-none placeholder:text-white/20 focus:ring-1 focus:ring-violet-500/50"
          style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}
        />
      </div>

      <div className="mb-4">
        <label
          htmlFor="pm-profile-desc"
          className="mb-1 block text-white/40"
          style={{ fontSize: 'clamp(9px, 0.8vw, 11px)' }}
        >
          Description (optional)
        </label>
        <input
          id="pm-profile-desc"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief note about this configuration"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white/90 outline-none placeholder:text-white/20 focus:ring-1 focus:ring-violet-500/50"
          style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}
        />
      </div>

      {error && (
        <div
          className="mb-3 rounded-lg bg-red-500/10 text-red-400"
          style={{ padding: 'clamp(6px, 0.6vw, 10px)', fontSize: 'clamp(9px, 0.8vw, 11px)' }}
        >
          {error}
        </div>
      )}

      <div className="flex" style={{ gap: 'clamp(8px, 0.8vw, 12px)' }}>
        <button
          onClick={onCancel}
          className="flex-1 rounded-lg bg-white/5 py-2 text-white/50 transition-colors hover:bg-white/10"
          style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="flex-1 rounded-lg bg-violet-600/80 py-2 font-semibold text-white transition-colors hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}
        >
          {saving ? 'Saving…' : 'Save Snapshot'}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// PROFILE CARD
// ============================================================================

function ProfileCard({
  profile,
  isActive,
  onActivate,
  onDelete,
  onSelectForDiff,
  diffSelected,
}: {
  profile: ProfileIndexEntry;
  isActive: boolean;
  onActivate: (id: string) => void;
  onDelete: (id: string) => void;
  onSelectForDiff: (id: string) => void;
  diffSelected: boolean;
}) {
  const [confirming, setConfirming] = useState<'activate' | 'delete' | null>(null);

  const createdDate = new Date(profile.createdAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className={`rounded-lg ring-1 transition-all ${
        isActive
          ? 'bg-violet-500/10 ring-violet-500/30'
          : diffSelected
            ? 'bg-sky-500/10 ring-sky-500/30'
            : 'bg-white/[0.03] ring-white/10 hover:ring-white/20'
      }`}
      style={{ padding: 'clamp(10px, 1.2vw, 16px)' }}
    >
      {/* Top row: name + badges */}
      <div className="flex items-center justify-between" style={{ gap: 'clamp(6px, 0.6vw, 10px)' }}>
        <div className="flex min-w-0 items-center" style={{ gap: 'clamp(6px, 0.6vw, 8px)' }}>
          <span
            className="truncate font-semibold text-white/80"
            style={{ fontSize: 'clamp(11px, 1.1vw, 14px)' }}
          >
            {profile.name}
          </span>
          {isActive && (
            <span
              className="flex-shrink-0 rounded-full bg-violet-500/20 text-violet-400"
              style={{
                fontSize: 'clamp(7px, 0.65vw, 9px)',
                padding: 'clamp(1px, 0.1vw, 2px) clamp(5px, 0.5vw, 7px)',
              }}
            >
              ACTIVE
            </span>
          )}
          {diffSelected && (
            <span
              className="flex-shrink-0 rounded-full bg-sky-500/20 text-sky-400"
              style={{
                fontSize: 'clamp(7px, 0.65vw, 9px)',
                padding: 'clamp(1px, 0.1vw, 2px) clamp(5px, 0.5vw, 7px)',
              }}
            >
              DIFF
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-shrink-0" style={{ gap: 'clamp(4px, 0.4vw, 6px)' }}>
          <button
            onClick={() => onSelectForDiff(profile.id)}
            className="rounded bg-white/5 text-white/40 transition-colors hover:bg-sky-500/15 hover:text-sky-400"
            style={{
              fontSize: 'clamp(8px, 0.75vw, 10px)',
              padding: 'clamp(2px, 0.25vw, 4px) clamp(6px, 0.6vw, 8px)',
            }}
            title="Select for diff comparison"
          >
            ⟷ Diff
          </button>

          {!isActive && confirming !== 'activate' && (
            <button
              onClick={() => setConfirming('activate')}
              className="rounded bg-white/5 text-white/40 transition-colors hover:bg-violet-500/15 hover:text-violet-400"
              style={{
                fontSize: 'clamp(8px, 0.75vw, 10px)',
                padding: 'clamp(2px, 0.25vw, 4px) clamp(6px, 0.6vw, 8px)',
              }}
              title="Activate this profile (rollback)"
            >
              ▶ Activate
            </button>
          )}

          {confirming === 'activate' && (
            <div className="flex" style={{ gap: 'clamp(2px, 0.2vw, 4px)' }}>
              <button
                onClick={() => {
                  onActivate(profile.id);
                  setConfirming(null);
                }}
                className="rounded bg-violet-600/80 font-semibold text-white transition-colors hover:bg-violet-600"
                style={{
                  fontSize: 'clamp(8px, 0.75vw, 10px)',
                  padding: 'clamp(2px, 0.25vw, 4px) clamp(6px, 0.6vw, 8px)',
                }}
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirming(null)}
                className="rounded bg-white/5 text-white/40 hover:bg-white/10"
                style={{
                  fontSize: 'clamp(8px, 0.75vw, 10px)',
                  padding: 'clamp(2px, 0.25vw, 4px) clamp(6px, 0.6vw, 8px)',
                }}
              >
                ✕
              </button>
            </div>
          )}

          {!isActive && confirming !== 'delete' && (
            <button
              onClick={() => setConfirming('delete')}
              className="rounded bg-white/5 text-white/30 transition-colors hover:bg-red-500/15 hover:text-red-400"
              style={{
                fontSize: 'clamp(8px, 0.75vw, 10px)',
                padding: 'clamp(2px, 0.25vw, 4px) clamp(6px, 0.6vw, 8px)',
              }}
              title="Delete this profile"
            >
              🗑
            </button>
          )}

          {confirming === 'delete' && (
            <div className="flex" style={{ gap: 'clamp(2px, 0.2vw, 4px)' }}>
              <button
                onClick={() => {
                  onDelete(profile.id);
                  setConfirming(null);
                }}
                className="rounded bg-red-600/80 font-semibold text-white transition-colors hover:bg-red-600"
                style={{
                  fontSize: 'clamp(8px, 0.75vw, 10px)',
                  padding: 'clamp(2px, 0.25vw, 4px) clamp(6px, 0.6vw, 8px)',
                }}
              >
                Delete
              </button>
              <button
                onClick={() => setConfirming(null)}
                className="rounded bg-white/5 text-white/40 hover:bg-white/10"
                style={{
                  fontSize: 'clamp(8px, 0.75vw, 10px)',
                  padding: 'clamp(2px, 0.25vw, 4px) clamp(6px, 0.6vw, 8px)',
                }}
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Description + metadata */}
      {profile.description && (
        <p
          className="mt-1 text-white/30"
          style={{ fontSize: 'clamp(9px, 0.8vw, 11px)' }}
        >
          {profile.description}
        </p>
      )}
      <p
        className="text-white/20"
        style={{ fontSize: 'clamp(8px, 0.7vw, 10px)', marginTop: 'clamp(3px, 0.3vw, 5px)' }}
      >
        Created {createdDate}
      </p>
    </div>
  );
}

// ============================================================================
// DIFF VIEWER
// ============================================================================

function DiffViewer({
  diff,
  nameA,
  nameB,
  onClose,
}: {
  diff: ProfileDiff;
  nameA: string;
  nameB: string;
  onClose: () => void;
}) {
  return (
    <div
      className="rounded-lg bg-white/[0.03] ring-1 ring-sky-500/20"
      style={{ padding: 'clamp(12px, 1.5vw, 20px)' }}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3
            className="font-semibold text-sky-400/80"
            style={{ fontSize: 'clamp(12px, 1.1vw, 15px)' }}
          >
            ⟷ Profile Diff
          </h3>
          <p
            className="text-white/30"
            style={{ fontSize: 'clamp(9px, 0.8vw, 11px)', marginTop: 'clamp(1px, 0.1vw, 2px)' }}
          >
            <span className="text-white/50">{nameA}</span>
            {' → '}
            <span className="text-white/50">{nameB}</span>
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded bg-white/5 text-white/40 hover:bg-white/10"
          style={{
            fontSize: 'clamp(10px, 0.9vw, 12px)',
            padding: 'clamp(4px, 0.4vw, 6px) clamp(8px, 0.8vw, 12px)',
          }}
        >
          ✕ Close
        </button>
      </div>

      {/* Summary stats */}
      <div
        className="mb-3 flex flex-wrap"
        style={{ gap: 'clamp(10px, 1vw, 16px)', fontSize: 'clamp(10px, 0.9vw, 12px)' }}
      >
        <span className="text-white/40">
          Cells compared: <strong className="text-white/60">{diff.totalCells}</strong>
        </span>
        <span className="text-amber-400/60">
          Changed: <strong className="text-amber-400">{diff.changedCells}</strong>
        </span>
        <span className="text-emerald-400/60">
          Unchanged: <strong className="text-emerald-400">{diff.unchangedCells}</strong>
        </span>
        <span className="text-white/40">
          Total shift: <strong className="text-white/60">{diff.totalShift.toFixed(4)}</strong>
        </span>
      </div>

      {/* Changes table */}
      {diff.changes.length === 0 ? (
        <p className="text-emerald-400/60" style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}>
          ✓ Profiles are identical — no weight changes detected.
        </p>
      ) : (
        <div className="overflow-x-auto" style={{ maxHeight: 'clamp(200px, 25vw, 350px)' }}>
          {/* Column headers */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr clamp(60px, 7vw, 90px) clamp(50px, 6vw, 70px) clamp(50px, 6vw, 70px) clamp(60px, 7vw, 80px)',
              gap: 'clamp(4px, 0.4vw, 8px)',
              marginBottom: 'clamp(4px, 0.4vw, 6px)',
            }}
          >
            <span className="text-white/30" style={{ fontSize: 'clamp(8px, 0.7vw, 10px)' }}>
              Factor · Tier
            </span>
            <span className="text-right text-white/30" style={{ fontSize: 'clamp(8px, 0.7vw, 10px)' }}>
              {nameA}
            </span>
            <span className="text-right text-white/30" style={{ fontSize: 'clamp(8px, 0.7vw, 10px)' }}>
              {nameB}
            </span>
            <span className="text-right text-white/30" style={{ fontSize: 'clamp(8px, 0.7vw, 10px)' }}>
              Delta
            </span>
            <span className="text-right text-white/30" style={{ fontSize: 'clamp(8px, 0.7vw, 10px)' }}>
              Change
            </span>
          </div>

          {/* Rows */}
          {diff.changes.slice(0, 50).map((entry, i) => (
            <div
              key={`${entry.tier}-${entry.factor}-${i}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr clamp(60px, 7vw, 90px) clamp(50px, 6vw, 70px) clamp(50px, 6vw, 70px) clamp(60px, 7vw, 80px)',
                gap: 'clamp(4px, 0.4vw, 8px)',
                padding: 'clamp(3px, 0.3vw, 5px) 0',
                borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : undefined,
              }}
            >
              <span className="truncate font-mono text-white/50" style={{ fontSize: 'clamp(9px, 0.8vw, 11px)' }}>
                {entry.factor}
                <span className="ml-1 text-white/20">{entry.tierLabel}</span>
              </span>
              <span className="text-right font-mono text-white/40" style={{ fontSize: 'clamp(9px, 0.8vw, 11px)' }}>
                {entry.weightA.toFixed(3)}
              </span>
              <span className="text-right font-mono text-white/60" style={{ fontSize: 'clamp(9px, 0.8vw, 11px)' }}>
                {entry.weightB.toFixed(3)}
              </span>
              <span
                className={`text-right font-mono ${
                  entry.direction === 'up' ? 'text-emerald-400' : 'text-amber-400'
                }`}
                style={{ fontSize: 'clamp(9px, 0.8vw, 11px)' }}
              >
                {entry.delta > 0 ? '+' : ''}{entry.delta.toFixed(3)}
              </span>
              <span
                className={`text-right font-mono ${
                  entry.direction === 'up' ? 'text-emerald-400/60' : 'text-amber-400/60'
                }`}
                style={{ fontSize: 'clamp(9px, 0.8vw, 11px)' }}
              >
                {isFinite(entry.deltaPercent)
                  ? `${entry.deltaPercent > 0 ? '+' : ''}${entry.deltaPercent.toFixed(0)}%`
                  : '∞'}
              </span>
            </div>
          ))}
          {diff.changes.length > 50 && (
            <p className="mt-2 text-white/20" style={{ fontSize: 'clamp(9px, 0.8vw, 11px)' }}>
              + {diff.changes.length - 50} more changes…
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ProfileManager() {
  const [index, setIndex] = useState<ProfileIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('list');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Diff state
  const [diffSelections, setDiffSelections] = useState<string[]>([]);
  const [diffResult, setDiffResult] = useState<{ diff: ProfileDiff; nameA: string; nameB: string } | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  // ── Fetch profiles ──────────────────────────────────────────────────
  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/scoring-health/profiles');
      const json = (await res.json()) as ScoringHealthApiResponse<ProfileIndex>;
      if (!json.ok || !json.data) {
        setError(json.message ?? 'Failed to load profiles');
        setIndex(null);
      } else {
        setIndex(json.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fetch failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProfiles();
  }, [fetchProfiles]);

  // ── Clear success message after 4s ──────────────────────────────────
  useEffect(() => {
    if (!actionSuccess) return;
    const t = setTimeout(() => setActionSuccess(null), 4000);
    return () => clearTimeout(t);
  }, [actionSuccess]);

  // ── Activate profile ────────────────────────────────────────────────
  const handleActivate = useCallback(async (profileId: string) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch('/api/admin/scoring-health/profiles/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId }),
      });
      const json = (await res.json()) as ScoringHealthApiResponse<{ profileName: string }>;
      if (!json.ok) {
        setActionError(json.message ?? 'Activation failed');
      } else {
        setActionSuccess(`Profile "${json.data?.profileName}" activated — live weights updated`);
        void fetchProfiles();
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Network error');
    }
  }, [fetchProfiles]);

  // ── Delete profile ──────────────────────────────────────────────────
  const handleDelete = useCallback(async (profileId: string) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch('/api/admin/scoring-health/profiles/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId }),
      });
      const json = (await res.json()) as ScoringHealthApiResponse<unknown>;
      if (!json.ok) {
        setActionError(json.message ?? 'Delete failed');
      } else {
        setActionSuccess('Profile deleted');
        setDiffSelections((prev) => prev.filter((id) => id !== profileId));
        void fetchProfiles();
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Network error');
    }
  }, [fetchProfiles]);

  // ── Diff selection ──────────────────────────────────────────────────
  const handleSelectForDiff = useCallback((profileId: string) => {
    setDiffSelections((prev) => {
      if (prev.includes(profileId)) {
        return prev.filter((id) => id !== profileId);
      }
      if (prev.length >= 2) {
        return [prev[1]!, profileId]; // Replace oldest
      }
      return [...prev, profileId];
    });
    setDiffResult(null);
  }, []);

  // ── Run diff ────────────────────────────────────────────────────────
  const runDiff = useCallback(async () => {
    if (diffSelections.length !== 2) return;
    setDiffLoading(true);
    setDiffResult(null);
    try {
      // Full diff requires fetching individual profile data via GET /profiles/[id].
      // That endpoint will be added in a future enhancement. For now, surface the
      // structure so the UI is wired and ready.
      setActionError(
        'Profile diff compares weight snapshots — individual profile fetch endpoint coming in next enhancement.',
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Diff failed');
    } finally {
      setDiffLoading(false);
    }
  }, [diffSelections]);

  // ── Render ──────────────────────────────────────────────────────────

  const activeProfileName = index?.profiles.find((p) => p.isActive)?.name ?? null;

  return (
    <div
      className="rounded-xl bg-white/5 ring-1 ring-white/10"
      style={{ padding: 'clamp(16px, 2vw, 24px)' }}
    >
      <SectionHeader activeProfile={activeProfileName} onRefresh={fetchProfiles} />

      {/* Action bar */}
      <div
        className="mb-4 flex flex-wrap items-center"
        style={{ gap: 'clamp(6px, 0.6vw, 10px)' }}
      >
        <button
          onClick={() => setView(view === 'save' ? 'list' : 'save')}
          className={`rounded-lg transition-colors ${
            view === 'save'
              ? 'bg-violet-600/80 text-white'
              : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70'
          }`}
          style={{
            fontSize: 'clamp(10px, 0.9vw, 12px)',
            padding: 'clamp(5px, 0.5vw, 7px) clamp(10px, 1vw, 14px)',
          }}
        >
          💾 {view === 'save' ? 'Cancel' : 'Save Current'}
        </button>

        {diffSelections.length === 2 && (
          <button
            onClick={runDiff}
            disabled={diffLoading}
            className="rounded-lg bg-sky-600/80 text-white transition-colors hover:bg-sky-600 disabled:opacity-40"
            style={{
              fontSize: 'clamp(10px, 0.9vw, 12px)',
              padding: 'clamp(5px, 0.5vw, 7px) clamp(10px, 1vw, 14px)',
            }}
          >
            {diffLoading ? 'Comparing…' : '⟷ Compare Selected'}
          </button>
        )}

        {diffSelections.length > 0 && (
          <button
            onClick={() => {
              setDiffSelections([]);
              setDiffResult(null);
            }}
            className="rounded-lg bg-white/5 text-white/40 hover:bg-white/10"
            style={{
              fontSize: 'clamp(10px, 0.9vw, 12px)',
              padding: 'clamp(5px, 0.5vw, 7px) clamp(10px, 1vw, 14px)',
            }}
          >
            Clear diff ({diffSelections.length}/2)
          </button>
        )}

        <span className="text-white/20" style={{ fontSize: 'clamp(9px, 0.8vw, 11px)' }}>
          {index?.profiles.length ?? 0} profiles saved
        </span>
      </div>

      {/* Success / Error banners */}
      {actionSuccess && (
        <div
          className="mb-3 rounded-lg bg-emerald-500/10 text-emerald-400"
          style={{ padding: 'clamp(6px, 0.6vw, 10px)', fontSize: 'clamp(9px, 0.8vw, 11px)' }}
        >
          ✓ {actionSuccess}
        </div>
      )}
      {actionError && (
        <div
          className="mb-3 rounded-lg bg-red-500/10 text-red-400"
          style={{ padding: 'clamp(6px, 0.6vw, 10px)', fontSize: 'clamp(9px, 0.8vw, 11px)' }}
        >
          ✕ {actionError}
        </div>
      )}

      {/* Save form */}
      {view === 'save' && (
        <div style={{ marginBottom: 'clamp(12px, 1.5vw, 20px)' }}>
          <SaveProfileForm
            onSaved={() => {
              setView('list');
              setActionSuccess('Profile saved successfully');
              void fetchProfiles();
            }}
            onCancel={() => setView('list')}
          />
        </div>
      )}

      {/* Diff viewer */}
      {diffResult && (
        <div style={{ marginBottom: 'clamp(12px, 1.5vw, 20px)' }}>
          <DiffViewer
            diff={diffResult.diff}
            nameA={diffResult.nameA}
            nameB={diffResult.nameB}
            onClose={() => setDiffResult(null)}
          />
        </div>
      )}

      {/* Loading */}
      {loading && !index && (
        <div
          className="flex items-center justify-center"
          style={{ minHeight: 'clamp(80px, 10vw, 120px)' }}
        >
          <span className="animate-pulse text-white/30" style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}>
            Loading profiles…
          </span>
        </div>
      )}

      {/* Error */}
      {error && !index && (
        <div
          className="flex items-center justify-center"
          style={{ minHeight: 'clamp(80px, 10vw, 120px)' }}
        >
          <span className="text-red-400/70" style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}>
            ❌ {error}
          </span>
        </div>
      )}

      {/* Empty state */}
      {index && index.profiles.length === 0 && (
        <div
          className="flex flex-col items-center justify-center text-center"
          style={{ minHeight: 'clamp(80px, 10vw, 120px)' }}
        >
          <span className="text-white/30" style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}>
            No saved profiles yet
          </span>
          <span className="text-white/15" style={{ fontSize: 'clamp(9px, 0.8vw, 11px)', marginTop: 'clamp(2px, 0.2vw, 4px)' }}>
            Click &quot;Save Current&quot; to snapshot your current scoring weights
          </span>
        </div>
      )}

      {/* Profile list */}
      {index && index.profiles.length > 0 && (
        <div className="flex flex-col" style={{ gap: 'clamp(6px, 0.6vw, 10px)' }}>
          {index.profiles.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              isActive={index.activeProfileId === profile.id}
              onActivate={handleActivate}
              onDelete={handleDelete}
              onSelectForDiff={handleSelectForDiff}
              diffSelected={diffSelections.includes(profile.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
