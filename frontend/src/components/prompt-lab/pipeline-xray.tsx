// src/components/prompt-lab/pipeline-xray.tsx
// ============================================================================
// PIPELINE X-RAY — Right Rail: The Glass Case (Phase 0 — Dormant)
// ============================================================================
// WWII-era decryption machine aesthetic viewed through a glass panel.
// Three sections: The Decoder (12 category rotors), The Switchboard
// (4 tier drum bars), The Alignment (platform cog cascade).
//
// Part 1: Phase 0 dormant state only — the machine at rest.
// Phases 1–3 (animated data visualisation) ship in later parts.
//
// Human factors:
//   §4 Zeigarnik Effect — the dormant, incomplete machine creates
//       psychological tension. It wants to run. The user wants to
//       see it run.
//   §14 Aesthetic-Usability Effect — the glass case gives the machine
//       perceived value. Same components without glass = dashboard.
//       With glass = museum exhibit.
//   §5 Optimal Stimulation — idle breathing animation keeps the rail
//       alive without demanding attention.
//
// Visual reference: Enigma Machine (rotors), Bombe (parallel drums),
// Colossus (patch cables, mechanical counters). NOT steampunk — this
// is precision military engineering. Bletchley Park, not Jules Verne.
//
// Code standards:
//   - All sizing via clamp() (§6.0)
//   - No grey text inside glass case — dim elements use dim brass (§6.0.2)
//   - Co-located animations in <style dangerouslySetInnerHTML> (§6.2)
//   - prefers-reduced-motion respected (§18)
//   - No interactive elements — display only, no focus traps
//
// v4.2.0 (3 Apr 2026):
// - User-facing score killed. XRayScore import removed. Score SectionWire
//   + XRayScore block removed. scoreResult/isScoring/scoreError removed
//   from props. Right rail: Decoder → Switchboard → Alignment (3 sections).
//   Scoring route stays deployed for internal batch runner.
//   Authority: docs/authority/builder-quality-intelligence.md v2.5.0 §12.1
//
// Authority: docs/authority/righthand-rail.md v1.2.0 §7
// Existing features preserved: Yes — Decoder, Switchboard, Alignment untouched.
// ============================================================================

'use client';

import React from 'react';
import type { CoverageAssessment } from '@/types/category-assessment';
import type { GeneratedPrompts } from '@/types/prompt-intelligence';
import type { AiOptimiseResult } from '@/hooks/use-ai-optimisation';
import { XRayDecoder } from './xray-decoder';
import { XRaySwitchboard } from './xray-switchboard';
import { XRayAlignment } from './xray-alignment';

// ============================================================================
// CO-LOCATED STYLES (code-standard.md §6.2)
// ============================================================================

const XRAY_STYLES = `
  /* Rotor idle breathing — each rotor gets staggered delay via inline style */
  @keyframes xray-rotor-breathe {
    0%, 100% { transform: rotate(0deg); }
    25% { transform: rotate(3deg); }
    75% { transform: rotate(-3deg); }
  }

  .xray-rotor-idle {
    animation: xray-rotor-breathe 8s ease-in-out infinite;
  }

  /* Dormant ticker tape colour pulse — NO opacity, uses colour shift */
  @keyframes xray-tape-pulse {
    0%, 100% { background-color: #5C4328; }
    50% { background-color: #7A5C3E; }
  }

  .xray-tape-dormant {
    animation: xray-tape-pulse 4s ease-in-out infinite;
  }

  /* §18 prefers-reduced-motion: disable all rotation */
  @media (prefers-reduced-motion: reduce) {
    .xray-rotor-idle {
      animation: none !important;
    }
    .xray-tape-dormant {
      animation: none !important;
    }
  }
`;

// ============================================================================
// WIRING — Thin vertical connector between sections
// ============================================================================

function SectionWire() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        padding: 'clamp(2px, 0.15vw, 3px) 0',
      }}
      aria-hidden="true"
    >
      <div
        style={{
          width: '1px',
          height: 'clamp(10px, 1vw, 16px)',
          backgroundColor: '#5C4328', // visible brass wire
        }}
      />
    </div>
  );
}

// ============================================================================
// ============================================================================
// ============================================================================
// MAIN COMPONENT — The Glass Case
// ============================================================================

export interface PipelineXRayProps {
  /** Call 1 assessment data — null when not yet run */
  assessment?: CoverageAssessment | null;
  /** Whether Call 1 is currently in flight */
  isChecking?: boolean;
  /** Call 2 tier prompts — null when not yet generated */
  tierPrompts?: GeneratedPrompts | null;
  /** Whether Call 2 is currently in flight */
  isTierGenerating?: boolean;
  /** Call 3 optimisation result — null when not yet optimised */
  optimiseResult?: AiOptimiseResult | null;
  /** Whether Call 3 is currently in flight */
  isOptimising?: boolean;
  /** Selected platform name for Alignment badge */
  platformName?: string | null;
  /** Selected platform tier for Alignment badge colour */
  platformTier?: number | null;
  /** Platform maxChars for capacity gauge */
  maxChars?: number | null;
  /** Monotonic generation ID for animation cancellation */
  generationId?: number;
  /** Optional className for outer container */
  className?: string;
}

export function PipelineXRay({
  assessment = null,
  isChecking = false,
  tierPrompts = null,
  isTierGenerating = false,
  optimiseResult = null,
  isOptimising = false,
  platformName = null,
  platformTier = null,
  maxChars = null,
  generationId = 0,
  className = '',
}: PipelineXRayProps) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: XRAY_STYLES }} />
      <div
        className={`${className} overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: '1 1 0',
          minHeight: 0,
          gap: 'clamp(10px, 0.9vw, 16px)',
          // ── Glass Case visual chrome (righthand-rail.md §11) ────────
          borderRadius: 'clamp(12px, 1.2vw, 20px)',
          backgroundColor: '#0A0D14',  // solid dark — slightly warmer than slate-950
          boxShadow: [
            'inset 0 1px 0 0 rgba(255, 255, 255, 0.06)',   // top glass reflection edge
            'inset 0 -1px 0 0 rgba(0, 0, 0, 0.4)',          // bottom shadow
            '0 0 0 1px #7A5C3E',                              // brass frame ring — visible
            '0 0 0 2px #2A1F15',                              // outer dark trim
            '0 0 16px #1A1208',                               // warm ambient glow
          ].join(', '),
          padding: 'clamp(10px, 0.9vw, 16px)',
          // Internal "back panel" warm tint
          backgroundImage: [
            'radial-gradient(circle at 20% 50%, #1A1210 0%, transparent 50%)',
            'radial-gradient(circle at 80% 30%, #181310 0%, transparent 40%)',
          ].join(', '),
        }}
        role="complementary"
        aria-label="Pipeline processing visualisation — dormant"
      >
        {/* The Decoder — 12 category rotors (live when Call 1 data available) */}
        <XRayDecoder
          assessment={assessment}
          isChecking={isChecking}
          generationId={generationId}
        />

        {/* Wiring: Decoder → Switchboard */}
        <SectionWire />

        {/* The Switchboard — 4 tier drum bars (live when Call 2 data available) */}
        <XRaySwitchboard
          tierPrompts={tierPrompts}
          isGenerating={isTierGenerating}
          generationId={generationId}
        />

        {/* Wiring: Switchboard → Alignment */}
        <SectionWire />

        {/* The Alignment — platform optimisation (live when Call 3 data available) */}
        <XRayAlignment
          optimiseResult={optimiseResult}
          isOptimising={isOptimising}
          platformName={platformName}
          platformTier={platformTier}
          maxChars={maxChars}
          generationId={generationId}
        />
      </div>
    </>
  );
}

// ============================================================================
// GLASS CASE CLASSNAME — For HomepageGrid rightRailClassName prop
// ============================================================================
// This replaces the standard rail chrome with the glass case aesthetic.
// Applied via the rightRailClassName prop on HomepageGrid.

export default PipelineXRay;
