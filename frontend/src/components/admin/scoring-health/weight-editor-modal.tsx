'use client';

// src/components/admin/scoring-health/weight-editor-modal.tsx
// ============================================================================
// WEIGHT EDITOR MODAL — Inline weight editing for Live Control Panel
// ============================================================================
//
// Opens when a heatmap cell is clicked. Provides:
//   - Slider (0–1) for visual adjustment
//   - Numeric input for precise values
//   - Before → After preview
//   - Auto-normalise toggle
//   - Confirm / Cancel actions
//
// On confirm, POSTs to /api/admin/scoring-health/weight-edit and triggers
// a refresh of the parent heatmap.
//
// Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md
//
// Version: 1.1.0 — a11y fix: backdrop uses <button>, dialog uses role="dialog"
// Created: 2026-03-01
//
// Existing features preserved: Yes.
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import type { ScoringHealthApiResponse, WeightEditResponse } from '@/lib/admin/scoring-health-types';

// ============================================================================
// PROPS
// ============================================================================

export interface WeightEditorProps {
  /** Factor being edited */
  factor: string;
  /** Tier being edited (e.g. "1", "global") */
  tier: string;
  /** Human-readable tier label */
  tierLabel: string;
  /** Current weight value */
  currentWeight: number;
  /** Callback when edit is saved (triggers heatmap refresh) */
  onSaved: () => void;
  /** Callback to close the modal */
  onClose: () => void;
}

// ============================================================================
// ACCESSIBLE MODAL BACKDROP
// ============================================================================

function ModalBackdrop({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop — accessible dismiss button */}
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close weight editor"
        tabIndex={-1}
      />
      {/* Dialog panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Weight editor"
        className="relative rounded-xl bg-[#111] ring-1 ring-white/10"
        style={{ padding: 'clamp(20px, 2.5vw, 32px)', width: 'clamp(320px, 35vw, 460px)' }}
      >
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function WeightEditorModal({
  factor,
  tier,
  tierLabel,
  currentWeight,
  onSaved,
  onClose,
}: WeightEditorProps) {
  const [value, setValue] = useState(currentWeight);
  const [normalise, setNormalise] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WeightEditResponse | null>(null);

  const delta = value - currentWeight;
  const deltaPercent = currentWeight > 0 ? (delta / currentWeight) * 100 : value > 0 ? Infinity : 0;

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/scoring-health/weight-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, factor, newWeight: value, normalise }),
      });
      const json = (await res.json()) as ScoringHealthApiResponse<WeightEditResponse>;
      if (!json.ok || !json.data) {
        setError(json.message ?? 'Failed to save');
      } else {
        setResult(json.data);
        onSaved();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSaving(false);
    }
  }, [tier, factor, value, normalise, onSaved]);

  // ── Success state ─────────────────────────────────────────────────
  if (result) {
    return (
      <ModalBackdrop onClose={onClose}>
        <div className="mb-4 text-center">
          <span
            className="text-emerald-400"
            style={{ fontSize: 'clamp(14px, 1.4vw, 18px)' }}
          >
            ✓ Weight Updated
          </span>
        </div>

        <div
          className="mb-4 rounded-lg bg-white/5"
          style={{ padding: 'clamp(10px, 1vw, 14px)', fontSize: 'clamp(10px, 0.9vw, 12px)' }}
        >
          <div className="text-white/40">
            {factor} on {tierLabel}
          </div>
          <div className="mt-1 font-mono text-white/70">
            {currentWeight.toFixed(4)} → {result.updatedWeights[factor]?.toFixed(4) ?? '?'}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-lg bg-white/10 py-2 text-white/70 transition-colors hover:bg-white/15"
          style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}
        >
          Close
        </button>
      </ModalBackdrop>
    );
  }

  // ── Editor state ──────────────────────────────────────────────────
  return (
    <ModalBackdrop onClose={onClose}>
      {/* Header */}
      <div className="mb-4">
        <h3
          className="font-semibold text-white/90"
          style={{ fontSize: 'clamp(13px, 1.3vw, 16px)' }}
        >
          Edit Weight
        </h3>
        <p
          className="text-white/40"
          style={{ fontSize: 'clamp(10px, 0.9vw, 12px)', marginTop: 'clamp(2px, 0.2vw, 3px)' }}
        >
          <span className="font-mono text-white/60">{factor}</span>
          {' '}on{' '}
          <span className="text-white/60">{tierLabel}</span>
        </p>
      </div>

      {/* Current value */}
      <div
        className="mb-4 flex items-center justify-between rounded-lg bg-white/5"
        style={{ padding: 'clamp(8px, 0.8vw, 12px)', fontSize: 'clamp(10px, 0.9vw, 12px)' }}
      >
        <span className="text-white/40">Current</span>
        <span className="font-mono text-white/70">{currentWeight.toFixed(4)}</span>
      </div>

      {/* Slider */}
      <div className="mb-3">
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={value}
          onChange={(e) => setValue(parseFloat(e.target.value))}
          className="w-full accent-emerald-500"
          style={{ height: 'clamp(6px, 0.6vw, 8px)' }}
          aria-label={`Weight for ${factor}`}
        />
      </div>

      {/* Numeric input + delta */}
      <div
        className="mb-4 flex items-center"
        style={{ gap: 'clamp(8px, 0.8vw, 12px)' }}
      >
        <input
          type="number"
          min={0}
          max={1}
          step={0.001}
          value={value.toFixed(4)}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (isFinite(v) && v >= 0 && v <= 1) setValue(v);
          }}
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-white/90 outline-none focus:ring-1 focus:ring-emerald-500/50"
          style={{ fontSize: 'clamp(11px, 1vw, 14px)' }}
          aria-label={`Exact weight value for ${factor}`}
        />
        <span
          className={`font-mono ${
            delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-amber-400' : 'text-white/30'
          }`}
          style={{ fontSize: 'clamp(10px, 0.9vw, 12px)', minWidth: 'clamp(50px, 5vw, 70px)', textAlign: 'right' }}
        >
          {delta > 0 ? '+' : ''}{delta.toFixed(4)}
          {isFinite(deltaPercent) && (
            <span className="ml-1 text-white/25">
              ({deltaPercent > 0 ? '+' : ''}{deltaPercent.toFixed(0)}%)
            </span>
          )}
        </span>
      </div>

      {/* Normalise toggle */}
      <label
        htmlFor="wem-normalise-toggle"
        className="mb-4 flex cursor-pointer items-center"
        style={{ gap: 'clamp(6px, 0.6vw, 10px)', fontSize: 'clamp(10px, 0.9vw, 12px)' }}
      >
        <input
          id="wem-normalise-toggle"
          type="checkbox"
          checked={normalise}
          onChange={(e) => setNormalise(e.target.checked)}
          className="rounded accent-emerald-500"
        />
        <span className="text-white/50">
          Auto-normalise tier (all weights sum to 1.0)
        </span>
      </label>

      {/* Error */}
      {error && (
        <div
          className="mb-3 rounded-lg bg-red-500/10 text-red-400"
          style={{ padding: 'clamp(6px, 0.6vw, 10px)', fontSize: 'clamp(9px, 0.8vw, 11px)' }}
        >
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex" style={{ gap: 'clamp(8px, 0.8vw, 12px)' }}>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-lg bg-white/5 py-2 text-white/50 transition-colors hover:bg-white/10"
          style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || Math.abs(delta) < 0.0001}
          className="flex-1 rounded-lg bg-emerald-600/80 py-2 font-semibold text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}
        >
          {saving ? 'Saving…' : 'Apply Change'}
        </button>
      </div>
    </ModalBackdrop>
  );
}
