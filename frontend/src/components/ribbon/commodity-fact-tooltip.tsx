// src/components/ribbon/commodity-fact-tooltip.tsx
// ============================================================================
// COMMODITY FACT TOOLTIP — v3.0 (MINIMAL, BELOW-POSITION)
// ============================================================================
// Hover emoji → portal tooltip below with fun fact + year.
// No speech dependency. Positions BELOW the trigger, not to the right.
// ============================================================================

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface CommodityFactTooltipProps {
  children: React.ReactNode;
  name: string;
  fact: string | null;
  yearFirstTraded: number | null;
  brandColor: string;
}

const CLOSE_DELAY = 400;
const GAP = 10;
const WIDTH = 360;

function toRgba(hex: string, a: number): string {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(56,189,248,${a})`;
  return `rgba(${r},${g},${b},${a})`;
}

export function CommodityFactTooltip({
  children,
  name,
  fact,
  yearFirstTraded,
  brandColor,
}: CommodityFactTooltipProps) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [ready, setReady] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setReady(true); return () => setReady(false); }, []);
  useEffect(() => { if (copied) { const t = setTimeout(() => setCopied(false), 1500); return () => clearTimeout(t); } }, [copied]);
  useEffect(() => { return () => { if (timer.current) clearTimeout(timer.current); }; }, []);

  if (!fact) return <>{children}</>;

  const text = yearFirstTraded
    ? `${name}: ${fact} Futures trading since ${yearFirstTraded}.`
    : `${name}: ${fact}`;

  const glow = toRgba(brandColor, 0.4);
  const soft = toRgba(brandColor, 0.2);

  const calc = () => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    let l = r.left + r.width / 2 - WIDTH / 2;
    if (l + WIDTH > window.innerWidth - 8) l = window.innerWidth - WIDTH - 8;
    if (l < 8) l = 8;
    setPos({ top: r.bottom + GAP, left: l });
  };

  const clear = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  const close = () => { clear(); timer.current = setTimeout(() => setShow(false), CLOSE_DELAY); };

  return (
    <>
      <span
        ref={ref}
        className="relative inline-flex cursor-pointer"
        onMouseEnter={() => { clear(); calc(); setShow(true); }}
        onMouseLeave={close}
      >
        {children}
      </span>

      {ready && show && createPortal(
        <div
          role="tooltip"
          onMouseEnter={clear}
          onMouseLeave={close}
          className="fixed rounded-xl px-5 py-3 text-sm text-slate-100"
          style={{
            top: pos.top,
            left: pos.left,
            zIndex: 99999,
            background: 'rgba(15, 23, 42, 0.97)',
            border: `2px solid ${brandColor}`,
            boxShadow: `0 0 30px 6px ${glow}, 0 0 60px 12px ${soft}, inset 0 0 20px 2px ${glow}`,
            width: WIDTH,
            maxWidth: WIDTH,
            pointerEvents: 'auto',
          }}
        >
          {/* Top glow */}
          <div className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden"
            style={{ background: `radial-gradient(ellipse at 50% 0%, ${glow} 0%, transparent 70%)` }} />
          {/* Bottom glow */}
          <div className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden"
            style={{ background: `radial-gradient(ellipse at 50% 100%, ${soft} 0%, transparent 60%)`, opacity: 0.6 }} />

          <div className="relative z-10 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-base font-semibold text-white"
                style={{ textShadow: `0 0 12px ${glow}` }}>
                {name}
              </span>
              <button type="button"
                onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(text).then(() => setCopied(true)).catch(() => {}); }}
                className={`inline-flex items-center justify-center w-6 h-6 rounded-md transition-all duration-200 ${
                  copied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
                }`}
                title={copied ? 'Copied!' : 'Copy'}>
                {copied ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>
            <p className="text-sm leading-relaxed text-slate-200">{fact}</p>
            <p className="text-xs text-slate-300">
              {yearFirstTraded ? `Futures trading since ${yearFirstTraded}` : 'OTC / spot traded'}
            </p>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

export default CommodityFactTooltip;
