// frontend/src/lib/fx/selection.store.ts
'use client';

import { useCallback, useSyncExternalStore } from 'react';

// --- module state ---
type InvertMap = Record<string, boolean>;
type Listener = () => void;

let selectedIds: string[] = ['gbp-eur', 'gbp-usd', 'eur-usd'];
let favorites: string[] = [];
let invertMap: InvertMap = {};

const subs = new Set<Listener>();
const notify = () => subs.forEach((fn) => fn());

// --- public mutators ---
function setSelectedIds(next: string[]) {
  selectedIds = [...new Set(next)].slice(0, 5);
  notify();
}
function setFavorites(next: string[]) {
  favorites = [...new Set(next)].slice(0, 2);
  notify();
}
function setInvert(id: string, on: boolean) {
  const copy = { ...invertMap };
  if (on) {copy[id] = true;}
  else {delete copy[id];}
  invertMap = copy;
  notify();
}

// --- store hook ---
export function useFxSelectionStore() {
  const subscribe = useCallback((fn: Listener) => {
    subs.add(fn);
    return () => { subs.delete(fn); };
  }, []);

  const snapshot = useCallback(() => ({ selectedIds, favorites, invertMap }), []);

  const state = useSyncExternalStore(subscribe, snapshot, snapshot);

  return {
    ...state,
    setSelectedIds,
    setFavorites,
    setInvert,
  };
}
