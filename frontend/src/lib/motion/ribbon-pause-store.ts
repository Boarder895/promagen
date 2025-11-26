// frontend/src/lib/motion/ribbon-pause-store.ts
'use client';

import { useCallback, useSyncExternalStore } from 'react';

type Listener = () => void;

let isPaused = false;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return isPaused;
}

function setPausedInternal(next: boolean) {
  if (isPaused === next) {
    return;
  }
  isPaused = next;
  emit();
}

/**
 * Shared pause state for the finance ribbon.
 *
 * For now this is purely a UI / micro-motion toggle. It does not
 * stop live data refresh – that’s intentional so prices can still
 * update quietly in the background.
 */
export function useRibbonPause() {
  const paused = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setPaused = useCallback((value: boolean) => {
    setPausedInternal(value);
  }, []);

  const togglePause = useCallback(() => {
    setPausedInternal(!paused);
  }, [paused]);

  return {
    isPaused: paused,
    setPaused,
    togglePause,
  };
}
