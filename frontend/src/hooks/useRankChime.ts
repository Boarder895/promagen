'use client';

import { useEffect, useRef } from 'react';

type MoveKind = 'promotion' | 'demotion' | 'reshuffle';

const CHIME_WINDOW_MS =
  Number(process.env.NEXT_PUBLIC_CHIME_WINDOW_MS ?? '1200') || 1200;

function playJingle(freqs: number[], gainPeak = 0.14, step = 0.12) {
  const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
  if (!Ctx) return;
  const ctx = new Ctx();
  try { if (ctx.state === 'suspended') void ctx.resume(); } catch {}

  let t = ctx.currentTime;
  for (const f of freqs) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gainPeak, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.2);
    t += step;
  }
}

function chirp(kind: MoveKind) {
  if (kind === 'promotion') return playJingle([660, 880]); // rising
  if (kind === 'demotion')  return playJingle([440, 330]); // falling
  return playJingle([560, 700, 560], 0.12, 0.10);         // wiggle
}

/**
 * Fires a short jingle when Top-5 membership changes or a big internal move happens.
 * @param items Sorted desc by score. Needs stable `id`.
 * @param enabled Toggle from useSound().
 * @param windowMs One-chime-per-wave debounce.
 * @param bigMoveThreshold Absolute rank change inside Top-5 to count (default 2).
 */
export function useRankChime(
  items: Array<{ id: string; score?: number }>,
  enabled = true,
  windowMs = CHIME_WINDOW_MS,
  bigMoveThreshold = 2
) {
  const prevOrder = useRef<string[] | null>(null);
  const last = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    if (!Array.isArray(items) || items.length < 5) {
      prevOrder.current = items?.map(i => i.id) ?? null;
      return;
    }

    const nowOrder = items.map(i => i.id);
    const prev = prevOrder.current;
    prevOrder.current = nowOrder;
    if (!prev) return; // first snapshotÃ¢â‚¬â€no sound

    const prevTop = new Set(prev.slice(0, 5));
    const nowTop  = new Set(nowOrder.slice(0, 5));
    const enters = [...nowTop].filter(id => !prevTop.has(id));
    const exits  = [...prevTop].filter(id => !nowTop.has(id));

    const indexPrev = new Map(prev.map((id, idx) => [id, idx]));
    const indexNow  = new Map(nowOrder.map((id, idx) => [id, idx]));
    const internalBig = [...nowTop]
      .filter(id => prevTop.has(id))
      .some(id => Math.abs((indexPrev.get(id) ?? 0) - (indexNow.get(id) ?? 0)) >= bigMoveThreshold);

    const hasEvent = enters.length > 0 || exits.length > 0 || internalBig;
    if (!hasEvent) return;

    const now = Date.now();
    if (now - last.current < windowMs) return;
    last.current = now;

    let kind: MoveKind = 'reshuffle';
    if (enters.length && !exits.length) kind = 'promotion';
    else if (exits.length && !enters.length) kind = 'demotion';
    else kind = 'reshuffle';

    chirp(kind);
  }, [items, enabled, windowMs, bigMoveThreshold]);
}


