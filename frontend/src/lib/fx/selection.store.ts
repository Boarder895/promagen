// frontend/src/lib/fx/selection.store.ts
'use client';

import { useCallback, useSyncExternalStore } from 'react';
import financeConfigJson from '@/data/finance.config.json';

type InvertMap = Record<string, boolean>;
type Listener = () => void;

type FxSelectionState = {
  selectedIds: string[];
  favorites: string[];
  invertMap: InvertMap;
};

type FxSelectionPersisted = {
  selectedIds?: string[];
  favorites?: string[];
  invertMap?: InvertMap;
};

type FinanceConfigFx = {
  fx?: {
    free?: {
      defaultPairIds?: string[];
    };
  };
};

const STORAGE_KEY = 'promagen.fxSelection.v1';
const MAX_SELECTED = 5;
const MAX_FAVOURITES = 2;

const financeConfig = financeConfigJson as FinanceConfigFx;

const DEFAULT_SELECTED_IDS: string[] = [...(financeConfig.fx?.free?.defaultPairIds ?? [])].slice(
  0,
  MAX_SELECTED,
);

// --- module state ---

let selectedIds: string[] = DEFAULT_SELECTED_IDS;
let favorites: string[] = [];
let invertMap: InvertMap = {};

const subscribers = new Set<Listener>();

const notify = () => {
  subscribers.forEach((listener) => listener());
};

// --- helpers ---

function normaliseSelected(ids: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of ids) {
    const id = raw.trim();
    if (!id || seen.has(id)) {
      continue;
    }
    result.push(id);
    seen.add(id);
    if (result.length >= MAX_SELECTED) {
      break;
    }
  }

  return result;
}

function normaliseFavorites(ids: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of ids) {
    const id = raw.trim();
    if (!id || seen.has(id)) {
      continue;
    }
    result.push(id);
    seen.add(id);
    if (result.length >= MAX_FAVOURITES) {
      break;
    }
  }

  return result;
}

function loadFromStorage(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw) as FxSelectionPersisted;

    if (Array.isArray(parsed.selectedIds)) {
      selectedIds = normaliseSelected(parsed.selectedIds);
    }

    if (Array.isArray(parsed.favorites)) {
      favorites = normaliseFavorites(parsed.favorites);
    }

    if (parsed.invertMap && typeof parsed.invertMap === 'object') {
      invertMap = { ...parsed.invertMap };
    }
  } catch {
    // Ignore storage problems – fall back to defaults.
  }
}

function saveToStorage(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const payload: FxSelectionPersisted = {
    selectedIds,
    favorites,
    invertMap,
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage write failures.
  }
}

let hasHydrated = false;

function hydrateOnce(): void {
  if (hasHydrated) {
    return;
  }
  hasHydrated = true;
  loadFromStorage();
}

// --- public mutators ---

function setSelectedIds(next: string[]): void {
  hydrateOnce();
  selectedIds = normaliseSelected(next);
  saveToStorage();
  notify();
}

function setFavorites(next: string[]): void {
  hydrateOnce();
  favorites = normaliseFavorites(next);
  saveToStorage();
  notify();
}

function setInvert(id: string, on: boolean): void {
  hydrateOnce();
  const nextMap: InvertMap = { ...invertMap };

  if (on) {
    nextMap[id] = true;
  } else {
    delete nextMap[id];
  }

  invertMap = nextMap;
  saveToStorage();
  notify();
}

// --- store hook ---

export function useFxSelectionStore() {
  const subscribe = useCallback((listener: Listener) => {
    hydrateOnce();
    subscribers.add(listener);
    return () => {
      subscribers.delete(listener);
    };
  }, []);

  const snapshot = useCallback((): FxSelectionState => {
    hydrateOnce();
    return {
      selectedIds,
      favorites,
      invertMap,
    };
  }, []);

  const state = useSyncExternalStore(subscribe, snapshot, snapshot);

  return {
    ...state,
    setSelectedIds,
    setFavorites,
    setInvert,
  };
}
