// src/components/home/control-dock.tsx
// ============================================================================
// CONTROL DOCK - Centralised control strip beneath PROMAGEN
// ============================================================================
// Houses the Reference Frame Toggle (and future controls like language selector)
// centered beneath the PROMAGEN heading.
//
// Design:
// - Glass effect background: bg-slate-900/40 backdrop-blur-sm
// - Purple-pink gradient border (matching nav buttons)
// - Pill-shaped container with rounded-full corners
// - Horizontally centered with flexbox
// - Designed to auto-expand for additional controls
//
// Authority: docs/authority/ribbon-homepage.md (Control Dock section)
// ============================================================================

'use client';

import React from 'react';
import ReferenceFrameToggle from '@/components/reference-frame-toggle';
import type { ReferenceFrame } from '@/lib/location';

// ============================================================================
// TYPES
// ============================================================================

export interface ControlDockProps {
  /** Current reference frame */
  referenceFrame: ReferenceFrame;
  /** Callback when reference frame changes */
  onReferenceFrameChange: (frame: ReferenceFrame) => void;
  /** Whether user is paid tier (Pro Promagen) */
  isPaidUser: boolean;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Whether location is loading */
  isLocationLoading?: boolean;
  /** User's city name (if detected) */
  cityName?: string;
  /** Additional className for outer container */
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * ControlDock - Centralised control strip beneath PROMAGEN heading.
 *
 * Contains the Reference Frame Toggle and is designed to accommodate
 * future controls (language selector, settings, etc.) on either side.
 *
 * Layout:
 * ┌─────────────────────────────────────────────────────────┐
 * │   [Future Tab]  │ 🌐 Greenwich Meridian ▾ │  [Future]  │
 * └─────────────────────────────────────────────────────────┘
 */
export function ControlDock({
  referenceFrame,
  onReferenceFrameChange,
  isPaidUser,
  isAuthenticated,
  isLocationLoading = false,
  cityName,
  className = '',
}: ControlDockProps): React.ReactElement {
  return (
    <div
      className={`flex items-center justify-center ${className}`}
      data-testid="control-dock"
    >
      {/* 
        Control Dock Container
        - Glass effect with subtle purple-pink gradient border
        - Rounded-full for pill shape
        - Inner padding for spacing
        - Designed to hold multiple controls with gaps
      */}
      <div
        className="
          inline-flex items-center justify-center gap-2
          rounded-full
          border border-purple-500/30
          bg-slate-900/40 backdrop-blur-sm
          px-1.5 py-1
          shadow-lg shadow-purple-900/10
        "
      >
        {/* 
          Future: Language selector would go here (left side)
          <LanguageSelector />
        */}

        {/* Reference Frame Toggle - EXACTLY as it appears on pro-promagen */}
        <ReferenceFrameToggle
          referenceFrame={referenceFrame}
          onReferenceFrameChange={onReferenceFrameChange}
          isPaidUser={isPaidUser}
          isAuthenticated={isAuthenticated}
          isLocationLoading={isLocationLoading}
          cityName={cityName}
        />

        {/* 
          Future: Settings/preferences would go here (right side)
          <SettingsToggle />
        */}
      </div>
    </div>
  );
}

export default ControlDock;
