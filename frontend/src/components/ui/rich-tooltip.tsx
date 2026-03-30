// src/components/ui/rich-tooltip.tsx
//
// Rich tooltip for financial data (crypto, commodities).
// Displays structured multi-line info on hover with brand-specific glow.
// Uses React state for reliable hover detection.
//
// Features:
// - Edge-aware positioning: detects left/right edge and shifts tooltip accordingly
// - Left threshold is higher (35%) to clear exchange rail column
// - Brand-specific glow colours
// - High z-index to prevent clipping
//
// Follows code-standard.md § 7.1 Tooltip Standards:
// - Desktop only (hover)
// - Plain language
// - Never blocks interaction
//
// Existing features preserved: Yes

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface RichTooltipLine {
  label: string;
  value: string;
}

export interface RichTooltipProps {
  children: React.ReactNode;
  lines: RichTooltipLine[];
  /** Optional title shown at top of tooltip */
  title?: string;
  /** Brand glow colour (hex or rgba) - defaults to cyan if not provided */
  glowColour?: string;
}

/**
 * Convert hex colour to rgba with alpha.
 */
function hexToRgba(hex: string, alpha: number): string {
  // Handle rgba strings directly
  if (hex.startsWith('rgba')) return hex;
  if (hex.startsWith('rgb')) {
    return hex.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
  }

  // Parse hex
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    // Fallback to cyan
    return `rgba(56, 189, 248, ${alpha})`;
  }

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Default cyan glow
const DEFAULT_GLOW = '#38BDF8';

// Edge detection thresholds (percentage of viewport width)
// 35% on both sides ensures tooltips don't get clipped by side rails
const LEFT_EDGE_THRESHOLD = 0.35;  // 35% from left edge (clears exchange rail)
const RIGHT_EDGE_THRESHOLD = 0.35; // 35% from right edge (clears exchange rail)

type TooltipAlign = 'left' | 'center' | 'right';

/**
 * Rich tooltip for displaying structured financial data.
 * Shows on hover with smooth fade-in and brand-specific glow.
 * Automatically adjusts position when near viewport edges.
 */
export function RichTooltip({ children, lines, title, glowColour }: RichTooltipProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [align, setAlign] = useState<TooltipAlign>('center');
  const triggerRef = useRef<HTMLSpanElement>(null);

  // ★ Portal rendering — escape parent stacking contexts (backdrop-blur, overflow-hidden)
  const [isMounted, setIsMounted] = useState(false);
  const [tooltipCoords, setTooltipCoords] = useState({ top: 0, left: 0, triggerWidth: 0 });

  useEffect(() => { setIsMounted(true); }, []);

  // Calculate position + edge detection when hovered
  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;

    // Edge detection
    const leftEdge = rect.left / viewportWidth;
    const rightEdge = rect.right / viewportWidth;

    let newAlign: TooltipAlign = 'center';
    if (leftEdge < LEFT_EDGE_THRESHOLD) {
      newAlign = 'left';
    } else if (rightEdge > 1 - RIGHT_EDGE_THRESHOLD) {
      newAlign = 'right';
    }
    setAlign(newAlign);

    // Calculate fixed position — tooltip appears above the trigger
    setTooltipCoords({
      top: rect.top - 12, // 12px gap above trigger (mb-3 equivalent)
      left: newAlign === 'left' ? rect.left : newAlign === 'right' ? rect.right : rect.left + rect.width / 2,
      triggerWidth: rect.width,
    });
  }, []);

  const handleEnter = useCallback(() => {
    calculatePosition();
    setIsHovered(true);
  }, [calculatePosition]);

  const handleLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  if (lines.length === 0) {
    return <>{children}</>;
  }

  const baseColour = glowColour || DEFAULT_GLOW;
  const glowRgba = hexToRgba(baseColour, 0.3);
  const glowBorder = hexToRgba(baseColour, 0.5);
  const glowSoft = hexToRgba(baseColour, 0.15);

  // Calculate transform based on alignment
  const getTransform = (hovered: boolean): string => {
    const yOffset = hovered ? 'translateY(0)' : 'translateY(4px)';
    const scale = hovered ? 'scale(1)' : 'scale(0.95)';

    switch (align) {
      case 'left':
        return `translateY(-100%) ${yOffset} ${scale}`;
      case 'right':
        return `translateX(-100%) translateY(-100%) ${yOffset} ${scale}`;
      case 'center':
      default:
        return `translateX(-50%) translateY(-100%) ${yOffset} ${scale}`;
    }
  };

  return (
    <>
      <span
        ref={triggerRef}
        className="relative inline-flex"
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        {/* Trigger element */}
        <span className="cursor-help">{children}</span>
      </span>

      {/* ★ Portal-rendered tooltip — escapes all parent stacking contexts */}
      {isMounted && isHovered &&
        createPortal(
          <span
            role="tooltip"
            className="
              pointer-events-none
              whitespace-nowrap rounded-xl px-4 py-3
              text-xs text-slate-100
              transition-all duration-200 ease-out
            "
            style={{
              position: 'fixed',
              top: tooltipCoords.top,
              left: tooltipCoords.left,
              zIndex: 99999,
              opacity: 1,
              transform: getTransform(true),
              visibility: 'visible',
              background: 'rgba(15, 23, 42, 0.97)',
              border: `1px solid ${glowBorder}`,
              boxShadow: `0 0 40px 8px ${glowRgba}, 0 0 80px 16px ${glowSoft}, inset 0 0 25px 3px ${glowRgba}`,
            }}
          >
            {/* Ethereal glow overlay - top radial */}
            <span
              className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden"
              style={{
                background: `radial-gradient(ellipse at 50% 0%, ${glowRgba} 0%, transparent 70%)`,
              }}
            />

            {/* Bottom glow accent */}
            <span
              className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden"
              style={{
                background: `radial-gradient(ellipse at 50% 100%, ${glowSoft} 0%, transparent 60%)`,
                opacity: 0.6,
              }}
            />

            {/* Content */}
            <span className="relative z-10 flex flex-col gap-1.5">
              {title && (
                <span
                  className="mb-1.5 pb-2 font-semibold text-white"
                  style={{
                    borderBottom: `1px solid ${hexToRgba(baseColour, 0.3)}`,
                    textShadow: `0 0 12px ${glowRgba}`,
                  }}
                >
                  {title}
                </span>
              )}
              {lines.map((line, i) => (
                <span key={i} className="flex items-start gap-2 text-[11px]">
                  <span className="text-slate-400 shrink-0">{line.label}:</span>
                  <span className="text-slate-200">{line.value}</span>
                </span>
              ))}
            </span>
          </span>,
          document.body,
        )}
    </>
  );
}

export default RichTooltip;
