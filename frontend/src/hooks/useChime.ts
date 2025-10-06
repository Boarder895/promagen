// @/hooks/useChime.ts
'use client';

import { useEffect, useRef, useState } from 'react';
import { loadBool, saveBool } from '@/lib/memory';

export type UseChimeOptions = {
  src?: string;          // default '/sounds/bell.mp3'
  volumeOpen?: number;   // default 0.15
  volumeClose?: number;  // default 0.08
  cooldownMs?: number;   // default 1500
  initialMuted?: boolean;// default false (overridden by saved pref)
};

export type UseChimeReturn = {
  playOpen: () => void;
  playClose: () => void;
  muted: boolean;
  setMuted: (v: boolean) => void;
  toggleMuted: () => void;
};

const STORAGE_KEY = 'chimeMuted';

export function useChime(opts: UseChimeOptions = {}): UseChimeReturn {
  const {
    src = '/sounds/bell.mp3',
    volumeOpen = 0.15,
    volumeClose = 0.08,
    cooldownMs = 1500,
    initialMuted = false,
  } = opts;

  const [muted, setMuted] = useState<boolean>(() => loadBool(STORAGE_KEY, initialMuted));
  useEffect(() => { saveBool(STORAGE_KEY, muted); }, [muted]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastMsRef = useRef(0);

  useEffect(() => {
    const a = new Audio(src);
    a.preload = 'auto';
    audioRef.current = a;
    return () => { audioRef.current?.pause(); audioRef.current = null; };
  }, [src]);

  const play = (vol: number) => {
    if (muted) return;
    const now = Date.now();
    if (now - lastMsRef.current < cooldownMs) return;
    lastMsRef.current = now;

    let a = audioRef.current;
    if (!a) { a = new Audio(src); a.preload = 'auto'; audioRef.current = a; }
    try { a.currentTime = 0; a.volume = Math.max(0, Math.min(1, vol)); void a.play(); } catch {}
  };

  const playOpen = () => play(volumeOpen);
  const playClose = () => play(volumeClose);
  const toggleMuted = () => setMuted(!muted);

  return { playOpen, playClose, muted, setMuted, toggleMuted };
}
