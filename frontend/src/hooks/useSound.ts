'use client';

import { useEffect, useState } from 'react';

const KEY = 'promagen:sound-enabled';
let current = false; // default OFF (polite). Toggle will persist.
const listeners = new Set<(e: boolean) => void>();

function notify(next: boolean) {
  for (const fn of [...listeners]) {
    try { fn(next); } catch {}
  }
}

export function getSoundEnabled() {
  return current;
}

export function setSoundEnabled(next: boolean) {
  current = !!next;
  try { localStorage.setItem(KEY, current ? '1' : '0'); } catch {}
  notify(current);
}

export function toggleSound() {
  setSoundEnabled(!current);
}

export function useSound() {
  const [enabled, setEnabled] = useState<boolean>(current);

  useEffect(() => {
    // initial read
    try {
      const raw = localStorage.getItem(KEY);
      if (raw != null) {
        current = raw === '1';
        setEnabled(current);
      }
    } catch {}
    // subscribe to in-app changes
    const sub = (e: boolean) => setEnabled(e);
    listeners.add(sub);
    // cross-tab sync
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === KEY && ev.newValue != null) {
        setSoundEnabled(ev.newValue === '1');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(sub);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return { enabled, toggle: toggleSound, set: setSoundEnabled };
}

