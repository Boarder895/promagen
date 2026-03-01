'use client';

// src/components/admin/scoring-health/undo-timeline.tsx
// ============================================================================
// UNDO TIMELINE — Visual strip of reversible actions
// ============================================================================
//
// Compact horizontal strip displayed at the top of the scoring health dashboard.
// Shows the most recent weight edits and profile activations with:
//   - Chronological order (newest first)
//   - One-click undo for each entry
//   - Visual feedback for undone entries (strikethrough)
//   - Relative timestamps
//
// Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md
//
// Version: 1.0.0
// Created: 2026-03-01
//
// Existing features preserved: Yes (new component).
// ============================================================================

import { useCallback, useState } from 'react';
import type { UndoEntry } from '@/lib/admin/undo-stack';
import { formatRelativeTime } from '@/lib/admin/scoring-health-types';

// ============================================================================
// PROPS
// ============================================================================

export interface UndoTimelineProps {
  entries: UndoEntry[];
  /** Called when user clicks undo on an entry */
  onUndo: (entry: UndoEntry) => Promise<void>;
  /** Maximum entries to show */
  maxVisible?: number;
}

// ============================================================================
// ENTRY ROW
// ============================================================================

function TimelineEntry({
  entry,
  onUndo,
}: {
  entry: UndoEntry;
  onUndo: (entry: UndoEntry) => Promise<void>;
}) {
  const [undoing, setUndoing] = useState(false);

  const handleUndo = useCallback(async () => {
    setUndoing(true);
    try {
      await onUndo(entry);
    } finally {
      setUndoing(false);
    }
  }, [entry, onUndo]);

  const icon = entry.type === 'weight-edit' ? '⚖️' : '🔄';
  const relTime = formatRelativeTime(entry.timestamp);

  return (
    <div
      className={`flex items-center rounded-lg ring-1 transition-all ${
        entry.undone
          ? 'bg-white/[0.01] ring-white/5 opacity-50'
          : 'bg-white/[0.03] ring-white/10'
      }`}
      style={{
        padding: 'clamp(4px, 0.4vw, 6px) clamp(8px, 0.8vw, 12px)',
        gap: 'clamp(6px, 0.6vw, 8px)',
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: 'clamp(10px, 1vw, 13px)' }}>{icon}</span>

      <span
        className={`whitespace-nowrap font-mono ${
          entry.undone ? 'text-white/25 line-through' : 'text-white/60'
        }`}
        style={{ fontSize: 'clamp(9px, 0.8vw, 11px)' }}
      >
        {entry.description}
      </span>

      <span
        className="whitespace-nowrap text-white/20"
        style={{ fontSize: 'clamp(8px, 0.7vw, 9px)' }}
      >
        {relTime}
      </span>

      {!entry.undone && (
        <button
          type="button"
          onClick={handleUndo}
          disabled={undoing}
          className="rounded bg-amber-500/10 text-amber-400/70 transition-colors hover:bg-amber-500/20 hover:text-amber-400 disabled:opacity-40"
          style={{
            fontSize: 'clamp(8px, 0.7vw, 9px)',
            padding: 'clamp(1px, 0.15vw, 2px) clamp(5px, 0.5vw, 7px)',
            flexShrink: 0,
          }}
          title="Undo this action"
        >
          {undoing ? '…' : '↩ Undo'}
        </button>
      )}

      {entry.undone && (
        <span
          className="whitespace-nowrap text-white/20"
          style={{ fontSize: 'clamp(8px, 0.7vw, 9px)' }}
        >
          undone
        </span>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function UndoTimeline({ entries, onUndo, maxVisible = 8 }: UndoTimelineProps) {
  const [expanded, setExpanded] = useState(false);

  if (entries.length === 0) return null;

  const visible = expanded ? entries : entries.slice(0, maxVisible);
  const hiddenCount = entries.length - maxVisible;
  const pendingCount = entries.filter((e) => !e.undone).length;

  return (
    <div
      className="rounded-xl bg-white/[0.03] ring-1 ring-white/10"
      style={{ padding: 'clamp(8px, 1vw, 12px)' }}
    >
      {/* Header */}
      <div
        className="mb-2 flex items-center justify-between"
        style={{ gap: 'clamp(6px, 0.6vw, 10px)' }}
      >
        <div className="flex items-center" style={{ gap: 'clamp(4px, 0.4vw, 6px)' }}>
          <span
            className="font-semibold text-white/50"
            style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}
          >
            ↩ Action Timeline
          </span>
          {pendingCount > 0 && (
            <span
              className="rounded-full bg-amber-500/15 text-amber-400/70"
              style={{
                fontSize: 'clamp(8px, 0.7vw, 9px)',
                padding: 'clamp(1px, 0.1vw, 2px) clamp(5px, 0.5vw, 7px)',
              }}
            >
              {pendingCount} reversible
            </span>
          )}
        </div>

        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-white/30 hover:text-white/50"
            style={{ fontSize: 'clamp(9px, 0.8vw, 10px)' }}
          >
            {expanded ? 'Show less' : `+${hiddenCount} more…`}
          </button>
        )}
      </div>

      {/* Scrollable entry list */}
      <div
        className="flex flex-wrap"
        style={{ gap: 'clamp(4px, 0.4vw, 6px)' }}
      >
        {visible.map((entry) => (
          <TimelineEntry key={entry.id} entry={entry} onUndo={onUndo} />
        ))}
      </div>
    </div>
  );
}
