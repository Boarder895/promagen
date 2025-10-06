'use client';

import { useEffect, useRef } from 'react';

type FlipKind = 'open' | 'close' | 'mixed';

const CHIME_WINDOW_MS =
  Number(process.env.NEXT_PUBLIC_CHIME_WINDOW_MS ?? '1200') || 1200;

function playBeep(kind: FlipKind) {
  const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
  if (!Ctx) return; // SSR/unsupported
  const ctx = new Ctx();
  try { if (ctx.state === 'suspended') void ctx.resume(); } catch {}
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  const freq = kind === 'open' ? 880 : kind === 'close' ? 440 : 660;
  osc.type = 'sine';
  osc.frequency.value = freq;

  // 200ms envelope
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);

  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.2);
}

/**
 * Debounced Ã¢â‚¬Å“one bell per waveÃ¢â‚¬Â when any markets flip open/close.
 */
export function useMarketChime(
  status: Array<{ id: string; isOpen?: boolean }>,
  enabled = true,
  windowMs = CHIME_WINDOW_MS
) {
  const prev = useRef<Map<string, boolean>>(new Map());
  const last = useRef<number>(0);

  useEffect(() => {
    if (!enabled || !Array.isArray(status)) return;

    let opened = 0;
    let closed = 0;

    for (const s of status) {
      const prevVal = prev.current.get(s.id);
      if (typeof s.isOpen === 'boolean') {
        if (typeof prevVal === 'boolean') {
          if (s.isOpen && !prevVal) opened++;
          if (!s.isOpen && prevVal) closed++;
        }
        prev.current.set(s.id, s.isOpen);
      }
    }

    const now = Date.now();
    if (now - last.current < windowMs) return; // debounce
    if (opened || closed) {
      last.current = now;
      const kind: FlipKind = opened && closed ? 'mixed' : opened ? 'open' : 'close';
      try { playBeep(kind); } catch {}
    }
  }, [status, enabled, windowMs]);
}

