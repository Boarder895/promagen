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

// ============================================================================
// COLOUR PALETTE — Brass, Copper, and Amber (righthand-rail.md §12)
// ============================================================================

const COLOURS = {
  brass: '#B87333',
  copper: '#CD7F32',
  activeAmber: '#FBBF24',
  warmAmber: '#FCD34D',
  lockEmerald: '#34D399',
  dimBrass: 'rgba(184, 115, 51, 0.15)',
  veryDimBrass: 'rgba(184, 115, 51, 0.08)',
  headerBrass: 'rgba(184, 115, 51, 0.3)',
  wireAmber: 'rgba(251, 191, 36, 0.06)',
  glassReflection: 'rgba(255, 255, 255, 0.025)',
} as const;

// ============================================================================
// CATEGORY ABBREVIATIONS — 12 categories in 6×2 grid
// ============================================================================

const ROTOR_CATEGORIES = [
  { abbr: 'Sbj', full: 'Subject' },
  { abbr: 'Act', full: 'Action' },
  { abbr: 'Sty', full: 'Style' },
  { abbr: 'Env', full: 'Environment' },
  { abbr: 'Cmp', full: 'Composition' },
  { abbr: 'Cam', full: 'Camera' },
  { abbr: 'Lit', full: 'Lighting' },
  { abbr: 'Col', full: 'Colour' },
  { abbr: 'Atm', full: 'Atmosphere' },
  { abbr: 'Mat', full: 'Materials' },
  { abbr: 'Fid', full: 'Fidelity' },
  { abbr: 'Neg', full: 'Negative' },
] as const;

// ============================================================================
// TIER BAR LABELS
// ============================================================================

const TIER_BARS = [
  { tier: 1, label: 'T1', color: '#60a5fa' },
  { tier: 2, label: 'T2', color: '#c084fc' },
  { tier: 3, label: 'T3', color: '#34d399' },
  { tier: 4, label: 'T4', color: '#fb923c' },
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

  /* Dormant ticker tape pulse */
  @keyframes xray-tape-pulse {
    0%, 100% { opacity: 0.05; }
    50% { opacity: 0.1; }
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
      opacity: 0.08 !important;
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
          backgroundColor: COLOURS.wireAmber,
        }}
      />
    </div>
  );
}

// ============================================================================
// THE DECODER — 12 Category Rotors (6×2 grid, dormant)
// ============================================================================

function DecoderSection() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(6px, 0.5vw, 10px)' }}>
      <SectionHeader text="§ The Decoder" />

      {/* 6×2 rotor grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: 'clamp(4px, 0.35vw, 6px)',
          justifyItems: 'center',
        }}
      >
        {ROTOR_CATEGORIES.map((cat, idx) => (
          <div
            key={cat.abbr}
            className="xray-rotor-idle"
            style={{
              width: 'clamp(18px, 1.6vw, 24px)',
              height: 'clamp(18px, 1.6vw, 24px)',
              borderRadius: '50%',
              border: `1px solid ${COLOURS.dimBrass}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              // Stagger breathing animation so rotors don't sync
              animationDelay: `${idx * 0.6}s`,
            }}
            title={cat.full}
            aria-label={`${cat.full}: waiting`}
          >
            <span
              style={{
                fontSize: 'clamp(0.35rem, 0.38vw, 0.45rem)',
                fontWeight: 600,
                color: 'rgba(251, 191, 36, 0.2)', // very dim amber
                lineHeight: 1,
                userSelect: 'none',
                letterSpacing: '-0.02em',
              }}
            >
              {cat.abbr}
            </span>
          </div>
        ))}
      </div>
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
                color: `${bar.color}66`, // tier colour at 40%
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
                backgroundColor: COLOURS.veryDimBrass,
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
            backgroundColor: COLOURS.warmAmber,
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
                color: `rgba(184, 115, 51, ${0.3 - idx * 0.05})`, // progressively dimmer
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
  /** Reserved for Phase 1–3 data — unused in Part 1 (dormant state) */
  className?: string;
}

export function PipelineXRay({ className = '' }: PipelineXRayProps) {
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
          background: [
            `linear-gradient(180deg, ${COLOURS.glassReflection} 0%, transparent 20%)`,
            'rgba(2, 6, 23, 0.85)',
          ].join(', '),
          boxShadow: [
            'inset 0 1px 0 0 rgba(255, 255, 255, 0.04)',  // top glass reflection
            'inset 0 -1px 0 0 rgba(0, 0, 0, 0.3)',         // bottom shadow
            '0 0 0 1px rgba(184, 115, 51, 0.12)',            // brass frame ring
            '0 0 20px rgba(184, 115, 51, 0.03)',             // faint brass ambient
          ].join(', '),
          padding: 'clamp(10px, 0.9vw, 16px)',
          // Internal "back panel" texture — faint brass radial gradients
          backgroundImage: [
            `linear-gradient(180deg, ${COLOURS.glassReflection} 0%, transparent 20%)`,
            'radial-gradient(circle at 20% 50%, rgba(184, 115, 51, 0.02) 0%, transparent 50%)',
            'radial-gradient(circle at 80% 30%, rgba(251, 191, 36, 0.015) 0%, transparent 40%)',
          ].join(', '),
          backgroundColor: 'rgba(2, 6, 23, 0.85)',
        }}
        role="complementary"
        aria-label="Pipeline processing visualisation — dormant"
      >
        {/* The Decoder — 12 category rotors */}
        <DecoderSection />

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

export const GLASS_CASE_CLASS = [
  'flex min-h-0 flex-1 flex-col',
  // Override standard panel — glass case styling applied via inline below
].join(' ');

// Inline style for the glass case container (cannot be expressed in Tailwind)
export const GLASS_CASE_STYLE: React.CSSProperties = {
  borderRadius: 'clamp(12px, 1.2vw, 20px)',
  background: `linear-gradient(180deg, ${COLOURS.glassReflection} 0%, transparent 20%), rgba(2, 6, 23, 0.85)`,
  boxShadow: [
    'inset 0 1px 0 0 rgba(255, 255, 255, 0.04)', // top glass reflection
    'inset 0 -1px 0 0 rgba(0, 0, 0, 0.3)',         // bottom shadow
    '0 0 0 1px rgba(184, 115, 51, 0.12)',            // brass frame ring
    '0 0 20px rgba(184, 115, 51, 0.03)',             // faint brass ambient
  ].join(', '),
  padding: 'clamp(8px, 0.7vw, 14px)',
};

export default PipelineXRay;
