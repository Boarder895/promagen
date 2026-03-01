'use client';

// src/lib/admin/drill-through-context.tsx
// ============================================================================
// CROSS-SECTION DRILL-THROUGH CONTEXT
// ============================================================================
//
// Lightweight React context that enables section-to-section navigation
// with optional filter payloads. Used by:
//   - Anomaly Alert Banner: "Jump to [Section] ↓"
//   - Feedback Summary → Anti-Patterns: "Show patterns for this platform"
//   - Anti-Pattern Alerts → Term Inspector: "Inspect this term"
//
// Design:
//   drillTo(sectionId, filter?) → smooth-scrolls + pulse-highlights section
//                                 + sets activeDrill for the target to read
//   activeDrill                 → { sectionId, filter } | null
//   clearDrill()                → clears activeDrill
//
// Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md § 10
//
// Version: 1.0.0
// Created: 2026-03-01
//
// Existing features preserved: Yes (new file).
// ============================================================================

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

// ============================================================================
// TYPES
// ============================================================================

/** Payload carried with a drill-through action */
export interface DrillFilter {
  /** Optional platform name (for Feedback → Anti-Patterns) */
  platform?: string;
  /** Optional term name (for Anti-Patterns → Term Inspector) */
  term?: string;
}

/** Current active drill-through state */
export interface ActiveDrill {
  /** Target section ID */
  sectionId: string;
  /** Filter payload for the target section */
  filter: DrillFilter;
  /** Timestamp to distinguish repeated drills to same target */
  timestamp: number;
}

/** Context value shape */
export interface DrillThroughContextValue {
  /** Navigate to a section with optional filter */
  drillTo: (sectionId: string, filter?: DrillFilter) => void;
  /** Current drill target (null if none) */
  activeDrill: ActiveDrill | null;
  /** Clear the active drill state */
  clearDrill: () => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const DrillThroughContext = createContext<DrillThroughContextValue>({
  drillTo: () => {},
  activeDrill: null,
  clearDrill: () => {},
});

// ============================================================================
// PROVIDER
// ============================================================================

export function DrillThroughProvider({ children }: { children: ReactNode }) {
  const [activeDrill, setActiveDrill] = useState<ActiveDrill | null>(null);

  const drillTo = useCallback((sectionId: string, filter?: DrillFilter) => {
    // Set the active drill state so the target section can read it
    setActiveDrill({
      sectionId,
      filter: filter ?? {},
      timestamp: Date.now(),
    });

    // Smooth-scroll + pulse-highlight
    requestAnimationFrame(() => {
      const el = document.getElementById(sectionId);
      if (!el) return;

      el.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // Temporary violet ring pulse
      el.classList.add('ring-2', 'ring-violet-500/50', 'rounded-xl');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-violet-500/50', 'rounded-xl');
      }, 2500);
    });
  }, []);

  const clearDrill = useCallback(() => {
    setActiveDrill(null);
  }, []);

  const value = useMemo(
    () => ({ drillTo, activeDrill, clearDrill }),
    [drillTo, activeDrill, clearDrill],
  );

  return (
    <DrillThroughContext.Provider value={value}>
      {children}
    </DrillThroughContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useDrillThrough(): DrillThroughContextValue {
  return useContext(DrillThroughContext);
}
