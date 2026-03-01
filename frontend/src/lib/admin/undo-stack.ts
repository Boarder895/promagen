// src/lib/admin/undo-stack.ts
// ============================================================================
// UNDO STACK — Chronological action history with revert capability
// ============================================================================
//
// Tracks every weight edit and profile activation as UndoEntry objects.
// Stored in-memory (React state) — cleared on page navigation.
//
// Features:
//   - Push new entries (weight-edit, profile-activate)
//   - Undo any entry by index (not just the last one)
//   - Maximum stack size (50) to prevent memory bloat
//   - Each entry records before/after state for reversal
//
// Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md
//
// Version: 1.0.0
// Created: 2026-03-01
//
// Existing features preserved: Yes (new file).
// ============================================================================

// ============================================================================
// TYPES
// ============================================================================

/** Types of undoable actions */
export type UndoActionType = 'weight-edit' | 'profile-activate';

/** A single undoable action */
export interface UndoEntry {
  /** Unique ID for this entry */
  id: string;
  /** When the action was performed */
  timestamp: string;
  /** Type of action */
  type: UndoActionType;
  /** Human-readable description */
  description: string;
  /** State before the action (for reverting) */
  revertPayload: WeightEditRevert | ProfileActivateRevert;
  /** Whether this entry has been undone */
  undone: boolean;
}

/** Revert data for a weight edit */
export interface WeightEditRevert {
  type: 'weight-edit';
  tier: string;
  factor: string;
  previousWeight: number;
  newWeight: number;
  normalise: boolean;
}

/** Revert data for a profile activation */
export interface ProfileActivateRevert {
  type: 'profile-activate';
  previousProfileId: string | null;
  previousProfileName: string | null;
  activatedProfileId: string;
  activatedProfileName: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum entries in the undo stack */
export const MAX_UNDO_ENTRIES = 50;

// ============================================================================
// STACK OPERATIONS (pure functions)
// ============================================================================

/** Generate a unique entry ID */
export function generateUndoId(): string {
  return `undo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Push a new entry onto the stack.
 * Trims oldest entries if stack exceeds MAX_UNDO_ENTRIES.
 */
export function pushUndoEntry(
  stack: UndoEntry[],
  entry: Omit<UndoEntry, 'id' | 'timestamp' | 'undone'>,
): UndoEntry[] {
  const newEntry: UndoEntry = {
    ...entry,
    id: generateUndoId(),
    timestamp: new Date().toISOString(),
    undone: false,
  };
  const updated = [newEntry, ...stack];
  return updated.slice(0, MAX_UNDO_ENTRIES);
}

/**
 * Mark an entry as undone by ID.
 * Returns the updated stack and the entry that was undone (for API call).
 */
export function markUndone(
  stack: UndoEntry[],
  entryId: string,
): { stack: UndoEntry[]; entry: UndoEntry | null } {
  const idx = stack.findIndex((e) => e.id === entryId);
  if (idx === -1) return { stack, entry: null };

  const updated = [...stack];
  updated[idx] = { ...updated[idx]!, undone: true };
  return { stack: updated, entry: updated[idx]! };
}

/**
 * Create an undo entry description for a weight edit.
 */
export function describeWeightEdit(
  factor: string,
  tierLabel: string,
  prevWeight: number,
  newWeight: number,
): string {
  const dir = newWeight > prevWeight ? '↑' : '↓';
  return `${dir} ${factor} on ${tierLabel}: ${prevWeight.toFixed(3)} → ${newWeight.toFixed(3)}`;
}

/**
 * Create an undo entry description for a profile activation.
 */
export function describeProfileActivate(
  profileName: string,
  previousName: string | null,
): string {
  if (previousName) {
    return `🔄 Switched profile: ${previousName} → ${profileName}`;
  }
  return `▶ Activated profile: ${profileName}`;
}

/**
 * Count pending (not-yet-undone) entries.
 */
export function countPending(stack: UndoEntry[]): number {
  return stack.filter((e) => !e.undone).length;
}

/**
 * Get the most recent N entries for display.
 */
export function getRecentEntries(stack: UndoEntry[], limit: number): UndoEntry[] {
  return stack.slice(0, limit);
}
