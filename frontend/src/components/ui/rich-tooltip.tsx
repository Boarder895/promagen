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

import React, { useState, useRef, useEffect } from 'react';

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

  // Detect edge position when hovered
  useEffect(() => {
    if (!isHovered || !triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;

    // Calculate position as percentage of viewport
    const leftEdge = rect.left / viewportWidth;
    const rightEdge = rect.right / viewportWidth;

    if (leftEdge < LEFT_EDGE_THRESHOLD) {
      // Near left edge (within exchange rail zone) - align tooltip to start from left (opens rightward)
      setAlign('left');
    } else if (rightEdge > 1 - RIGHT_EDGE_THRESHOLD) {
      // Near right edge - align tooltip to end at right (opens leftward)
      setAlign('right');
    } else {
      // Center is fine
      setAlign('center');
    }
  }, [isHovered]);

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
        // Align left edge of tooltip with left edge of trigger
        return `translateX(0%) ${yOffset} ${scale}`;
      case 'right':
        // Align right edge of tooltip with right edge of trigger
        return `translateX(-100%) ${yOffset} ${scale}`;
      case 'center':
      default:
        return `translateX(-50%) ${yOffset} ${scale}`;
    }
  };

  // Calculate left position based on alignment
  const getLeftPosition = (): string => {
    switch (align) {
      case 'left':
        return '0';
      case 'right':
        return '100%';
      case 'center':
      default:
        return '50%';
    }
  };

  return (
    <span
      ref={triggerRef}
      className="relative inline-flex"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Trigger element */}
      <span className="cursor-help">{children}</span>

      {/* Tooltip card - positioned above with edge-aware alignment */}
      <span
        role="tooltip"
        className="
          pointer-events-none absolute bottom-full mb-3
          whitespace-nowrap rounded-xl px-4 py-3
          text-xs text-slate-100
          transition-all duration-200 ease-out
        "
        style={{
          left: getLeftPosition(),
          zIndex: 9999,
          opacity: isHovered ? 1 : 0,
          transform: getTransform(isHovered),
          visibility: isHovered ? 'visible' : 'hidden',
          background: 'rgba(15, 23, 42, 0.97)',
          border: `1px solid ${isHovered ? glowBorder : 'rgba(148, 163, 184, 0.2)'}`,
          boxShadow: isHovered
            ? `0 0 40px 8px ${glowRgba}, 0 0 80px 16px ${glowSoft}, inset 0 0 25px 3px ${glowRgba}`
            : '0 4px 20px rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* Ethereal glow overlay - top radial */}
        <span
          className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden"
          style={{
            background: `radial-gradient(ellipse at 50% 0%, ${glowRgba} 0%, transparent 70%)`,
            opacity: isHovered ? 1 : 0,
            transition: 'opacity 200ms ease-out',
          }}
        />

        {/* Bottom glow accent */}
        <span
          className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden"
          style={{
            background: `radial-gradient(ellipse at 50% 100%, ${glowSoft} 0%, transparent 60%)`,
            opacity: isHovered ? 0.6 : 0,
            transition: 'opacity 200ms ease-out',
          }}
        />

        {/* Content */}
        <span className="relative z-10 flex flex-col gap-1.5">
          {title && (
            <span
              className="mb-1.5 pb-2 font-semibold text-white"
              style={{
                borderBottom: `1px solid ${hexToRgba(baseColour, 0.3)}`,
                textShadow: isHovered ? `0 0 12px ${glowRgba}` : 'none',
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
      </span>
    </span>
  );
}

export default RichTooltip;
