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
// Authority: docs/authority/righthand-rail.md v1.2.0 §7
// Existing features preserved: Yes (new file, no modifications).
// ============================================================================

'use client';

import React from 'react';
import type { CoverageAssessment } from '@/types/category-assessment';
import { XRayDecoder } from './xray-decoder';

// ============================================================================
// COLOUR PALETTE — Brass, Copper, and Amber (righthand-rail.md §12)
// ============================================================================

const COLOURS = {
  // ── Solid colours only — NO rgba opacity dimming (§6.0.3) ──────────
  brass: '#B87333',          // Full brass — headers, active borders
  copper: '#CD7F32',         // Copper accent — smaller details
  activeAmber: '#FBBF24',    // Active/processing state
  warmAmber: '#FCD34D',      // Teletype text, counter digits
  lockEmerald: '#34D399',    // Completion/locked state
  dimBrass: '#5C4328',       // Dormant rotor rings — dark but VISIBLE on slate-950
  dormantText: '#9B7B55',    // Dormant text — muted gold, matches slate-400 luminance
  headerBrass: '#B87333',    // Section headers — full brass, always readable
  wireBrass: '#3D2A1A',      // Wiring between sections — dark brass line, visible
  barTrack: '#2A1F15',       // Dormant bar background — dark warm, not invisible
  phaseMarker: '#7A5C3E',    // Phase markers ①②③ — medium brass, readable
  phaseMarkerDim: '#5C4328', // Dimmer phase markers — still visible
} as const;

// ============================================================================
// TIER BAR LABELS
// ============================================================================

const TIER_BARS = [
  { tier: 1, label: 'T1', color: '#60a5fa', dimColor: '#4B7BB5' },
  { tier: 2, label: 'T2', color: '#c084fc', dimColor: '#8A60B5' },
  { tier: 3, label: 'T3', color: '#34d399', dimColor: '#2A9B70' },
  { tier: 4, label: 'T4', color: '#fb923c', dimColor: '#B5682A' },
] as const;

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

  /* Section header subtle glow on hover */
  .xray-section-header {
    transition: color 0.4s ease;
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
// SECTION HEADER — Stamped brass label
// ============================================================================

function SectionHeader({ text }: { text: string }) {
  return (
    <div
      className="xray-section-header"
      style={{
        fontSize: 'clamp(0.5rem, 0.55vw, 0.6rem)',
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: COLOURS.headerBrass,
        lineHeight: 1,
        userSelect: 'none',
      }}
      aria-hidden="true"
    >
      {text}
    </div>
  );
}

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
          backgroundColor: COLOURS.wireBrass,
        }}
      />
    </div>
  );
}

// ============================================================================
// THE SWITCHBOARD — 4 Tier Drum Bars (dormant)
// ============================================================================

function SwitchboardSection() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(6px, 0.5vw, 10px)' }}>
      <SectionHeader text="§ The Switchboard" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(3px, 0.25vw, 5px)' }}>
        {TIER_BARS.map((bar) => (
          <div
            key={bar.tier}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'clamp(6px, 0.5vw, 8px)',
            }}
          >
            {/* Tier label */}
            <span
              style={{
                fontSize: 'clamp(0.45rem, 0.48vw, 0.55rem)',
                fontWeight: 700,
                color: bar.dimColor, // solid muted tier colour — NO opacity
                width: 'clamp(14px, 1.2vw, 18px)',
                textAlign: 'right',
                flexShrink: 0,
                userSelect: 'none',
                lineHeight: 1,
              }}
            >
              {bar.label}
            </span>

            {/* Dormant bar track */}
            <div
              style={{
                flex: 1,
                height: 'clamp(4px, 0.35vw, 6px)',
                borderRadius: 'clamp(2px, 0.15vw, 3px)',
                backgroundColor: COLOURS.barTrack, // solid dark warm — visible
              }}
              aria-label={`Tier ${bar.tier} output: waiting`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// THE ALIGNMENT — Platform Optimisation (dormant)
// ============================================================================

function AlignmentSection() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(6px, 0.5vw, 10px)' }}>
      <SectionHeader text="§ The Alignment" />

      {/* Placeholder for platform badge + cogs — shows when Call 3 runs */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'clamp(4px, 0.3vw, 6px)',
          minHeight: 'clamp(30px, 2.5vw, 40px)',
        }}
      >
        {/* Dormant ticker tape line */}
        <div
          className="xray-tape-dormant"
          style={{
            height: '1px',
            backgroundColor: COLOURS.dimBrass,  // solid visible brass line
            borderRadius: '1px',
          }}
          aria-hidden="true"
        />

        {/* Phase markers — dim, waiting to activate */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'clamp(8px, 0.7vw, 12px)',
            justifyContent: 'center',
          }}
        >
          {['① Analyse', '② Generate', '③ Optimise'].map((label, idx) => (
            <span
              key={label}
              style={{
                fontSize: 'clamp(0.4rem, 0.42vw, 0.5rem)',
                fontWeight: 500,
                // Progressively dimmer but all VISIBLE — solid colours, no opacity
                color: idx === 0 ? COLOURS.phaseMarker : idx === 1 ? COLOURS.phaseMarkerDim : COLOURS.dimBrass,
                letterSpacing: '0.04em',
                userSelect: 'none',
                lineHeight: 1,
              }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT — The Glass Case
// ============================================================================

export interface PipelineXRayProps {
  /** Call 1 assessment data — null when not yet run */
  assessment?: CoverageAssessment | null;
  /** Whether Call 1 is currently in flight */
  isChecking?: boolean;
  /** Monotonic generation ID for animation cancellation */
  generationId?: number;
  /** Optional className for outer container */
  className?: string;
}

export function PipelineXRay({
  assessment = null,
  isChecking = false,
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
            `0 0 0 1px ${COLOURS.dimBrass}`,                 // brass frame ring — VISIBLE
            `0 0 12px ${COLOURS.wireBrass}`,                 // warm ambient glow
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

        {/* The Switchboard — 4 tier drum bars */}
        <SwitchboardSection />

        {/* Wiring: Switchboard → Alignment */}
        <SectionWire />

        {/* The Alignment — platform optimisation zone */}
        <AlignmentSection />
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
