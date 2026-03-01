'use client';

// src/components/admin/scoring-health/css-sparkline.tsx
// ============================================================================
// CSS SPARKLINE — Lightweight, zero-dependency sparkline using CSS gradients
// ============================================================================
//
// Renders a small inline sparkline chart using only CSS linear-gradient.
// No canvas, no SVG, no charting library. Perfectly fluid — scales with
// container width via clamp().
//
// Each data point becomes a gradient stop. The sparkline is drawn as a
// background image using gradient stops that create a stepped area chart.
//
// Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md § 4
//
// Version: 1.0.0
// Created: 2026-03-01
//
// Existing features preserved: Yes (new component, no existing code changed).
// ============================================================================

import type { SparklinePoint } from '@/lib/admin/scoring-health-types';
import { normaliseSparkline } from '@/lib/admin/scoring-health-types';

// ============================================================================
// PROPS
// ============================================================================

interface CssSparklineProps {
  /** Raw data points (will be normalised internally) */
  points: SparklinePoint[];
  /** Height of the sparkline — CSS clamp() string */
  height?: string;
  /** Width of the sparkline — CSS clamp() string */
  width?: string;
  /** Colour of the sparkline fill (CSS colour value) */
  colour?: string;
  /** Colour of the sparkline line (CSS colour value) */
  lineColour?: string;
  /** Accessible label for screen readers */
  label?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CssSparkline({
  points,
  height = 'clamp(24px, 3vw, 40px)',
  width = '100%',
  colour = 'rgba(52, 211, 153, 0.2)',
  lineColour = 'rgba(52, 211, 153, 0.8)',
  label = 'Sparkline chart',
}: CssSparklineProps) {
  const normalised = normaliseSparkline(points);

  if (normalised.length === 0) {
    return (
      <div
        role="img"
        aria-label="No data available"
        style={{
          height,
          width,
          borderRadius: 'clamp(2px, 0.3vw, 4px)',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
        }}
      />
    );
  }

  // Build gradient stops for the area fill
  // Each point occupies an equal slice of the width
  const sliceWidth = 100 / (normalised.length - 1 || 1);
  const fillStops: string[] = [];
  const lineStops: string[] = [];

  for (let i = 0; i < normalised.length; i++) {
    const xPercent = (i * sliceWidth).toFixed(1);
    fillStops.push(`${colour} ${xPercent}%`);
    lineStops.push(`${lineColour} ${xPercent}%`);
  }

  // Area fill: gradient from bottom to data points
  // We approximate with a series of colour stops at each data-point X position
  // This creates a stepped chart effect

  // Build the SVG-like effect using multiple background layers
  // Layer 1: Thin line at the data points
  // Layer 2: Filled area below

  const barGradients = normalised.map((val, i) => {
    const x = i * sliceWidth;
    const barHeight = Math.max(val * 90 + 5, 5); // 5–95% of container height
    const xStart = x.toFixed(1);

    return `linear-gradient(to top, ${colour} ${barHeight.toFixed(1)}%, transparent ${barHeight.toFixed(1)}%) ${xStart}% 0 / ${(sliceWidth * 0.8).toFixed(1)}% 100% no-repeat`;
  });

  // Top line: dots at each data point
  const dotGradients = normalised.map((val, i) => {
    const x = i * sliceWidth;
    const dotY = (1 - val) * 90 + 5; // Inverted Y
    const dotSize = 'clamp(2px, 0.25vw, 3px)';

    return `radial-gradient(circle ${dotSize}, ${lineColour} 100%, transparent 100%) ${x.toFixed(1)}% ${dotY.toFixed(1)}% / ${dotSize} ${dotSize} no-repeat`;
  });

  return (
    <div
      role="img"
      aria-label={`${label}: ${normalised.length} data points`}
      style={{
        height,
        width,
        borderRadius: 'clamp(2px, 0.3vw, 4px)',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        background: [
          ...dotGradients,
          ...barGradients,
          'rgba(255, 255, 255, 0.03)', // Base colour
        ].join(', '),
        border: '1px solid rgba(255, 255, 255, 0.06)',
      }}
      title={`${label} — ${points.length} points, latest: ${points[points.length - 1]?.value.toFixed(3) ?? 'N/A'}`}
    />
  );
}
