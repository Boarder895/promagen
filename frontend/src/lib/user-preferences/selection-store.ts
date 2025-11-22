// src/lib/user-preferences/selection-store.ts

import type { UserPlanId } from '@/lib/user-plan';

export interface FxSelection {
  pairIds: string[];
}

interface SelectionState {
  /**
   * FX selection per plan. This is intentionally narrow for now:
   * we can extend this structure later for crypto / commodities etc.
   */
  fxByPlan: Record<UserPlanId, FxSelection | undefined>;
}

const STORAGE_KEY = 'promagen:selection-state';

let inMemoryState: SelectionState | null = null;

function createEmptyState(): SelectionState {
  return {
    fxByPlan: {} as Record<UserPlanId, FxSelection | undefined>,
  };
}

function readState(): SelectionState {
  if (inMemoryState) return inMemoryState;

  if (typeof window === 'undefined') {
    inMemoryState = createEmptyState();
    return inMemoryState;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      inMemoryState = createEmptyState();
      return inMemoryState;
    }

    const parsed = JSON.parse(raw) as Partial<SelectionState>;
    inMemoryState = {
      fxByPlan: parsed.fxByPlan ?? ({} as Record<UserPlanId, FxSelection | undefined>),
    };
    return inMemoryState;
  } catch {
    inMemoryState = createEmptyState();
    return inMemoryState;
  }
}

function writeState(next: SelectionState): void {
  inMemoryState = next;

  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Non-fatal; just skip persistence.
  }
}

export function getFxSelectionForPlan(planId: UserPlanId): FxSelection | null {
  const state = readState();
  const selection = state.fxByPlan[planId];
  return selection ?? null;
}

export function setFxSelectionForPlan(planId: UserPlanId, selection: FxSelection): void {
  const state = readState();

  const next: SelectionState = {
    ...state,
    fxByPlan: {
      ...state.fxByPlan,
      [planId]: selection,
    },
  };

  writeState(next);
}

export function resetAllSelections(): void {
  writeState(createEmptyState());
}
