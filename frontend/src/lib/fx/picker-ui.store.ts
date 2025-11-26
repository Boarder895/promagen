// frontend/src/lib/fx/picker-ui.store.ts
// Tiny UI store for the FX picker drawer.
// Remembers whether the user has opened it, their last search, and last facet.

import { useEffect, useState } from 'react';

export type FxPickerFacet = 'ALL' | 'EUROPE' | 'AMERICAS' | 'APAC' | 'MIDDLE_EAST' | 'AFRICA';

const KEY_OPENED = 'promagen.fxPicker.openedOnce.v1';
const KEY_SEARCH = 'promagen.fxPicker.lastSearch.v1';
const KEY_FACET = 'promagen.fxPicker.lastFacet.v1';

let openedOnce = false;
let lastSearch = '';
let lastFacet: FxPickerFacet = 'ALL';

function readFacet(raw: string | null): FxPickerFacet {
  if (!raw) {
    return 'ALL';
  }

  const allowed: FxPickerFacet[] = ['ALL', 'EUROPE', 'AMERICAS', 'APAC', 'MIDDLE_EAST', 'AFRICA'];
  return allowed.includes(raw as FxPickerFacet) ? (raw as FxPickerFacet) : 'ALL';
}

function loadFromStorage(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    openedOnce = window.localStorage.getItem(KEY_OPENED) === '1';
    lastSearch = window.localStorage.getItem(KEY_SEARCH) ?? '';
    lastFacet = readFacet(window.localStorage.getItem(KEY_FACET));
  } catch {
    // Ignore storage problems – UI will still work with defaults.
  }
}

function saveOpened(): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(KEY_OPENED, '1');
  } catch {
    // Ignore
  }
}

function saveSearch(value: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(KEY_SEARCH, value);
  } catch {
    // Ignore
  }
}

function saveFacet(facet: FxPickerFacet): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(KEY_FACET, facet);
  } catch {
    // Ignore
  }
}

export function usePickerUiStore() {
  const [state, setState] = useState<{
    openedOnce: boolean;
    lastSearch: string;
    lastFacet: FxPickerFacet;
  }>({
    openedOnce,
    lastSearch,
    lastFacet,
  });

  useEffect(() => {
    loadFromStorage();
    setState({ openedOnce, lastSearch, lastFacet });
  }, []);

  return {
    openedOnce: state.openedOnce,
    setOpenedOnce: (value: boolean) => {
      if (value && !state.openedOnce) {
        saveOpened();
      }
      setState((prev) => ({ ...prev, openedOnce: prev.openedOnce || value }));
    },
    lastSearch: state.lastSearch,
    setLastSearch: (value: string) => {
      saveSearch(value);
      setState((prev) => ({ ...prev, lastSearch: value }));
    },
    lastFacet: state.lastFacet,
    setLastFacet: (facet: FxPickerFacet) => {
      saveFacet(facet);
      setState((prev) => ({ ...prev, lastFacet: facet }));
    },
  };
}
