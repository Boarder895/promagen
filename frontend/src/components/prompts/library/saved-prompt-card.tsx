// src/components/prompts/library/saved-prompt-card.tsx
// ============================================================================
// SAVED PROMPT CARD (v2.0.0 — Compact Visual-First Redesign)
// ============================================================================
// Card component for displaying saved prompts in the library grid.
//
// v2.0.0: Full redesign per saved-page.md §5.3.
//   - Visual-first: DNA bar is the dominant element
//   - Compact: single-line prompt preview, no line-clamp-2
//   - Browse-only: NO action buttons on card. All actions in right rail.
//   - Click selects card (ring highlight, populates preview panel)
//   - Arrival glow: newly saved prompts pulse once on first render
//
// Human Factors Gate:
// - Feature: Compact card with arrival glow for new saves
// - Factor: Peak-End Rule + Anticipatory Dopamine (Schultz) — the arrival
//   glow is the payoff after saving. The user expects to see their prompt
//   in the library; the glow confirms it with a rewarding visual event.
// - Anti-pattern: No feedback (prompt silently appears) or persistent
//   animation (glow must be one-shot, ≤2s, never repeats)
//
// Authority: saved-page.md §5.3
// Sizing: All clamp() with 9px floor (code-standard.md §6.0.1)
// Animations: Co-located <style jsx> (code-standard.md §6.2)
// Banned: text-slate-500, text-slate-600 (code-standard.md §6.0.2)
// Existing features preserved: Yes (all existing exports maintained)
// ============================================================================

'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import Image from 'next/image';
import type { SavedPrompt } from '@/types/saved-prompt';

// ============================================================================
// FAMILY COLOUR MAPPING
// ============================================================================

const FAMILY_COLOURS: Record<string, { gradient: string; glow: string; accent: string }> = {
  'cyberpunk': {
    gradient: 'from-pink-500 via-purple-500 to-cyan-500',
    glow: 'rgba(236, 72, 153, 0.15)',
    accent: 'text-pink-400',
  },
  'sci-fi': {
    gradient: 'from-blue-500 via-indigo-500 to-violet-500',
    glow: 'rgba(99, 102, 241, 0.15)',
    accent: 'text-blue-400',
  },
  'retro': {
    gradient: 'from-amber-500 via-orange-400 to-yellow-500',
    glow: 'rgba(245, 158, 11, 0.15)',
    accent: 'text-amber-400',
  },
  'dark-moody': {
    gradient: 'from-gray-400 via-gray-500 to-gray-600',
    glow: 'rgba(148, 163, 184, 0.12)',
    accent: 'text-gray-300',
  },
  'organic': {
    gradient: 'from-emerald-500 via-green-500 to-lime-500',
    glow: 'rgba(16, 185, 129, 0.15)',
    accent: 'text-emerald-400',
  },
  'ethereal': {
    gradient: 'from-violet-400 via-fuchsia-400 to-pink-400',
    glow: 'rgba(167, 139, 250, 0.2)',
    accent: 'text-violet-400',
  },
  'fantasy': {
    gradient: 'from-purple-500 via-violet-500 to-indigo-500',
    glow: 'rgba(139, 92, 246, 0.15)',
    accent: 'text-purple-400',
  },
  'minimalist': {
    gradient: 'from-gray-400 via-gray-500 to-gray-600',
    glow: 'rgba(156, 163, 175, 0.12)',
    accent: 'text-gray-300',
  },
  'cinematic': {
    gradient: 'from-amber-600 via-orange-500 to-red-500',
    glow: 'rgba(234, 88, 12, 0.15)',
    accent: 'text-orange-400',
  },
  'anime': {
    gradient: 'from-rose-400 via-pink-400 to-fuchsia-400',
    glow: 'rgba(244, 114, 182, 0.15)',
    accent: 'text-rose-400',
  },
};

const DEFAULT_COLOURS = {
  gradient: 'from-sky-500 via-blue-500 to-indigo-500',
  glow: 'rgba(56, 189, 248, 0.15)',
  accent: 'text-sky-400',
};

// ============================================================================
// PLATFORM COLOURS — each platform gets its own visual identity
// ============================================================================
// DNA bars and selection glow are coloured by PLATFORM, not family.
// This ensures every card gets a distinct colour (every card has a platformId).
// Family colours were invisible because tooltip saves don't carry family data.
// ============================================================================

const PLATFORM_COLOURS: Record<string, { gradient: string; glow: string; accent: string }> = {
  'midjourney': {
    gradient: 'from-violet-500 via-purple-500 to-fuchsia-500',
    glow: 'rgba(124, 58, 237, 0.18)',
    accent: 'text-violet-400',
  },
  'openai': {
    gradient: 'from-emerald-500 via-green-400 to-teal-500',
    glow: 'rgba(16, 185, 129, 0.18)',
    accent: 'text-emerald-400',
  },
  'flux': {
    gradient: 'from-orange-500 via-amber-400 to-yellow-500',
    glow: 'rgba(249, 115, 22, 0.18)',
    accent: 'text-orange-400',
  },
  'leonardo': {
    gradient: 'from-pink-500 via-rose-400 to-fuchsia-500',
    glow: 'rgba(236, 72, 153, 0.18)',
    accent: 'text-pink-400',
  },
  'stability': {
    gradient: 'from-violet-500 via-indigo-400 to-purple-500',
    glow: 'rgba(139, 92, 246, 0.18)',
    accent: 'text-violet-400',
  },
  'adobe-firefly': {
    gradient: 'from-orange-500 via-red-400 to-rose-500',
    glow: 'rgba(255, 107, 53, 0.18)',
    accent: 'text-orange-400',
  },
  'canva': {
    gradient: 'from-cyan-500 via-teal-400 to-emerald-500',
    glow: 'rgba(0, 196, 204, 0.18)',
    accent: 'text-cyan-400',
  },
  'ideogram': {
    gradient: 'from-cyan-500 via-sky-400 to-blue-500',
    glow: 'rgba(6, 182, 212, 0.18)',
    accent: 'text-cyan-400',
  },
  'craiyon': {
    gradient: 'from-yellow-500 via-amber-400 to-orange-400',
    glow: 'rgba(251, 191, 36, 0.18)',
    accent: 'text-yellow-400',
  },
  'bluewillow': {
    gradient: 'from-blue-500 via-sky-400 to-cyan-500',
    glow: 'rgba(59, 130, 246, 0.18)',
    accent: 'text-blue-400',
  },
  'novelai': {
    gradient: 'from-purple-500 via-violet-400 to-indigo-500',
    glow: 'rgba(168, 85, 247, 0.18)',
    accent: 'text-purple-400',
  },
  'playground': {
    gradient: 'from-blue-500 via-indigo-400 to-violet-500',
    glow: 'rgba(59, 130, 246, 0.18)',
    accent: 'text-blue-400',
  },
  'google-imagen': {
    gradient: 'from-blue-500 via-sky-400 to-green-500',
    glow: 'rgba(66, 133, 244, 0.18)',
    accent: 'text-blue-400',
  },
};

// ============================================================================
// SHORT PLATFORM NAMES
// ============================================================================

// ============================================================================
// TYPES
// ============================================================================

export interface SavedPromptCardProps {
  prompt: SavedPrompt;
  /** Whether this card is currently selected */
  isSelected: boolean;
  /** Whether this prompt is newly saved (< 60s ago) — triggers arrival glow */
  isNew?: boolean;
  /** Called when the card is clicked */
  onSelect: (prompt: SavedPrompt) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SavedPromptCard({
  prompt,
  isSelected,
  isNew = false,
  onSelect,
}: SavedPromptCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showArrivalGlow, setShowArrivalGlow] = useState(isNew);
  const arrivalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Arrival glow: one-shot, 2s, never repeats
  useEffect(() => {
    if (isNew && showArrivalGlow) {
      arrivalTimerRef.current = setTimeout(() => {
        setShowArrivalGlow(false);
      }, 2000);
    }
    return () => {
      if (arrivalTimerRef.current) clearTimeout(arrivalTimerRef.current);
    };
  }, [isNew, showArrivalGlow]);

  // Get colours — platform first (always available), family fallback
  const colours: { gradient: string; glow: string; accent: string } = useMemo(() => {
    // Platform colour (every card has a platformId)
    const platColour = PLATFORM_COLOURS[prompt.platformId];
    if (platColour) return platColour;
    // Family fallback for unknown platforms
    const primaryFamily = prompt.families[0];
    if (primaryFamily) {
      const famColour = FAMILY_COLOURS[primaryFamily];
      if (famColour) return famColour;
    }
    return DEFAULT_COLOURS;
  }, [prompt.platformId, prompt.families]);

  // DNA bar pattern based on prompt ID
  const dnaPattern = useMemo(() => {
    const seed = prompt.id.charCodeAt(0) + prompt.id.charCodeAt(1);
    return [...Array(12)].map((_, i) => {
      const base = Math.sin(i * 0.7 + seed * 0.1);
      return 0.25 + (base * 0.35 + 0.35);
    });
  }, [prompt.id]);

  // Format relative time
  const relativeTime = useMemo(() => {
    const now = Date.now();
    const updated = new Date(prompt.updatedAt).getTime();
    const diffMs = now - updated;
    const mins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMs / 3600000);
    const days = Math.floor(diffMs / 86400000);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(prompt.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }, [prompt.updatedAt]);

  // Primary family name
  const primaryFamily = prompt.families[0] ?? '';

  // ── Glow colours for commodity-style treatment ──
  const glowBright = colours.glow.replace(/0\.\d+\)/, '0.5)');
  const glowSoft = colours.glow.replace(/0\.\d+\)/, '0.3)');
  const borderSelected = colours.glow.replace(/0\.\d+\)/, '0.9)');

  return (
    <>
      <button
        type="button"
        onClick={() => onSelect(prompt)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`saved-card relative w-full text-left overflow-hidden rounded-2xl transition-all duration-300 cursor-pointer ${
          showArrivalGlow ? 'saved-card--arrival' : ''
        }`}
        style={{
          background: 'rgba(255, 255, 255, 0.05)',
          border: `1px solid ${isSelected || isHovered ? borderSelected : 'rgba(255, 255, 255, 0.1)'}`,
          boxShadow: (isHovered || isSelected)
            ? `0 0 40px 8px ${glowBright}, 0 0 80px 16px ${glowSoft}, inset 0 0 25px 3px ${glowBright}`
            : '0 1px 3px rgba(0, 0, 0, 0.1)',
          transition: 'border-color 600ms ease-out, box-shadow 600ms ease-out',
          padding: 'clamp(8px, 0.7vw, 12px)',
        }}
        aria-pressed={isSelected}
        aria-label={`${prompt.name} — ${prompt.platformName}`}
      >
        {/* Ethereal glow — top radial (Community Pulse pattern) */}
        <span
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
          style={{
            background: `radial-gradient(ellipse at 50% 0%, ${glowBright} 0%, transparent 70%)`,
            opacity: (isHovered || isSelected) ? 1 : 0,
            transition: 'opacity 600ms ease-out',
          }}
          aria-hidden="true"
        />
        {/* Ethereal glow — bottom radial */}
        <span
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
          style={{
            background: `radial-gradient(ellipse at 50% 100%, ${glowSoft} 0%, transparent 60%)`,
            opacity: (isHovered || isSelected) ? 0.8 : 0,
            transition: 'opacity 600ms ease-out',
          }}
          aria-hidden="true"
        />
        {/* Card content — sits above glow overlays */}
        <div className="relative z-10">
        {/* ── DNA Bar (full width, identity stripe) ── */}
        <div
          className="flex rounded-md overflow-hidden"
          style={{
            gap: 'clamp(1px, 0.08vw, 2px)',
            height: 'clamp(10px, 0.8vw, 14px)',
            marginBottom: 'clamp(6px, 0.5vw, 10px)',
          }}
        >
          {dnaPattern.map((opacity, i) => (
            <div
              key={i}
              className={`flex-1 bg-gradient-to-r ${colours.gradient} transition-all duration-500`}
              style={{
                opacity: isHovered || showArrivalGlow ? Math.min(opacity + 0.3, 1) : opacity * 0.6,
                transform: isHovered ? 'scaleY(1.2)' : 'scaleY(1)',
                filter: showArrivalGlow ? `drop-shadow(0 0 4px ${colours.glow})` : 'none',
              }}
            />
          ))}
        </div>

        {/* ── Name + Platform Badge ── */}
        <div
          className="flex items-start justify-between"
          style={{
            gap: 'clamp(4px, 0.3vw, 6px)',
            marginBottom: 'clamp(2px, 0.2vw, 4px)',
          }}
        >
          <span
            className="text-white font-semibold truncate flex-1"
            style={{ fontSize: 'clamp(0.6rem, 0.75vw, 0.9rem)' }}
          >
            {prompt.name}
          </span>
          {/* Platform icon */}
          <span
            className="relative shrink-0 overflow-hidden rounded-sm"
            style={{ width: 'clamp(16px, 1.3vw, 22px)', height: 'clamp(16px, 1.3vw, 22px)' }}
          >
            <Image
              src={`/icons/providers/${prompt.platformId}.png`}
              alt={prompt.platformName}
              fill
              sizes="22px"
              className="object-contain"
              style={{ filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.4))' }}
            />
          </span>
        </div>

        {/* ── Prompt Preview (single line) ── */}
        <p
          className="text-slate-300 truncate"
          style={{
            fontSize: 'clamp(0.625rem, 0.7vw, 0.85rem)',
            marginBottom: 'clamp(4px, 0.35vw, 6px)',
          }}
        >
          {prompt.optimisedPrompt ?? prompt.positivePrompt}
        </p>

        {/* ── Stats Row: Score + Platform + Family ── */}
        <div
          className="flex items-center"
          style={{
            gap: 'clamp(6px, 0.5vw, 10px)',
            marginBottom: 'clamp(3px, 0.25vw, 5px)',
          }}
        >
          {/* Score dot + percentage */}
          {prompt.coherenceScore > 0 && (
            <div className="flex items-center" style={{ gap: 'clamp(3px, 0.2vw, 4px)' }}>
              <div
                className={`rounded-full bg-gradient-to-r ${colours.gradient}`}
                style={{
                  width: 'clamp(6px, 0.45vw, 8px)',
                  height: 'clamp(6px, 0.45vw, 8px)',
                }}
              />
              <span
                className={`${colours.accent} font-medium`}
                style={{ fontSize: 'clamp(0.625rem, 0.55vw, 0.8rem)' }}
              >
                {prompt.coherenceScore}%
              </span>
            </div>
          )}

          {/* Primary family */}
          {primaryFamily && (
            <span
              className="text-white/70 truncate"
              style={{ fontSize: 'clamp(0.625rem, 0.5vw, 0.75rem)' }}
            >
              {primaryFamily}
            </span>
          )}

          {/* Optimised badge */}
          {prompt.isOptimised && (
            <span
              className="shrink-0 rounded bg-amber-500/15 text-amber-400 font-medium border border-amber-500/20"
              style={{
                padding: 'clamp(0px, 0.05vw, 1px) clamp(4px, 0.3vw, 6px)',
                fontSize: 'clamp(0.5625rem, 0.5vw, 0.72rem)',
              }}
              title="This prompt went through the optimisation pipeline"
            >
              ✦ Optimised
            </span>
          )}
        </div>

        {/* ── Footer: Time + Folder Badge ── */}
        <div className="flex items-center justify-between">
          <span
            className="text-slate-400"
            style={{ fontSize: 'clamp(0.625rem, 0.5vw, 0.75rem)' }}
          >
            {relativeTime}
          </span>
          {prompt.folder && (
            <span
              className="text-cyan-300/90 bg-cyan-500/10 border border-cyan-500/20 rounded truncate"
              style={{
                padding: 'clamp(0px, 0.05vw, 1px) clamp(4px, 0.3vw, 5px)',
                fontSize: 'clamp(0.625rem, 0.55vw, 0.75rem)',
                maxWidth: '50%',
              }}
            >
              {prompt.folder}
            </span>
          )}
        </div>
        </div>{/* end relative z-10 content wrapper */}
      </button>

      {/* ── Arrival glow animation (co-located per code-standard.md §6.2) ── */}
      <style jsx>{`
        .saved-card--arrival {
          animation: arrivalPulse 2s ease-out forwards;
        }

        @keyframes arrivalPulse {
          0% {
            box-shadow:
              0 0 0 0 rgba(16, 185, 129, 0),
              inset 0 0 0 0 rgba(16, 185, 129, 0);
            border-color: rgba(16, 185, 129, 0.5);
          }
          15% {
            box-shadow:
              0 0 30px 8px rgba(16, 185, 129, 0.2),
              inset 0 0 15px 3px rgba(16, 185, 129, 0.1);
            border-color: rgba(16, 185, 129, 0.6);
          }
          50% {
            box-shadow:
              0 0 15px 4px rgba(16, 185, 129, 0.08),
              inset 0 0 8px 2px rgba(16, 185, 129, 0.04);
            border-color: rgba(16, 185, 129, 0.3);
          }
          100% {
            box-shadow: 0 0 0 0 transparent;
            border-color: rgba(255, 255, 255, 0.1);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .saved-card--arrival {
            animation: none;
          }
        }
      `}</style>
    </>
  );
}

export default SavedPromptCard;
