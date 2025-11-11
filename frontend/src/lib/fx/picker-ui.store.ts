import { useEffect, useState } from 'react';

const KEY_OPENED = 'promagen.fxPicker.openedOnce.v1';
const KEY_SEARCH = 'promagen.fxPicker.lastSearch.v1';
const KEY_FACET  = 'promagen.fxPicker.lastFacet.v1';

let openedOnce = false;
let lastSearch = '';
let lastFacet: 'ALL' | 'EUROPE' | 'AMERICAS' | 'APAC' | 'MIDDLE_EAST' | 'AFRICA' = 'ALL';

function load() {
  if (typeof window === 'undefined') {return;}
  try {
    openedOnce = window.localStorage.getItem(KEY_OPENED) === '1';
    lastSearch = window.localStorage.getItem(KEY_SEARCH) ?? '';
    const f = window.localStorage.getItem(KEY_FACET) as any;
    if (f) {lastFacet = f;}
  } catch {}
}
function saveOpened() {
  try { window.localStorage.setItem(KEY_OPENED, '1'); } catch {}
}
function saveSearch(s: string) {
  try { window.localStorage.setItem(KEY_SEARCH, s); } catch {}
}
function saveFacet(f: string) {
  try { window.localStorage.setItem(KEY_FACET, f); } catch {}
}

export function usePickerUiStore() {
  const [state, setState] = useState({ openedOnce, lastSearch, lastFacet });
  useEffect(() => { load(); setState({ openedOnce, lastSearch, lastFacet }); }, []);
  return {
    openedOnce: state.openedOnce,
    setOpenedOnce: (v: boolean) => { if (v) {saveOpened();} setState({ ...state, openedOnce: true }); },
    lastSearch: state.lastSearch,
    setLastSearch: (s: string) => { saveSearch(s); setState({ ...state, lastSearch: s }); },
    lastFacet: state.lastFacet,
    setLastFacet: (f: string) => { saveFacet(f); setState({ ...state, lastFacet: f as any }); }
  };
}
