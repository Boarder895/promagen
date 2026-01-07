// src/components/prompts/explore/family-card.tsx
// ============================================================================
// FAMILY CARD
// ============================================================================
// Card component for displaying style families in the Explore page.
// Design: DNA Helix + Ethereal Glow hybrid
// Authority: docs/authority/prompt-intelligence.md §9.2
// ============================================================================

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import type { StyleFamily } from '@/types/style-family';

// ============================================================================
// FAMILY COLOUR MAPPING
// ============================================================================

const FAMILY_COLOURS: Record<string, { gradient: string; glow: string; accent: string }> = {
  'sci-fi': {
    gradient: 'from-blue-500 via-indigo-500 to-violet-500',
    glow: 'rgba(99, 102, 241, 0.15)',
    accent: 'text-blue-400',
  },
  'cyberpunk': {
    gradient: 'from-pink-500 via-purple-500 to-cyan-500',
    glow: 'rgba(236, 72, 153, 0.15)',
    accent: 'text-pink-400',
  },
  'retro': {
    gradient: 'from-amber-500 via-orange-400 to-yellow-500',
    glow: 'rgba(245, 158, 11, 0.15)',
    accent: 'text-amber-400',
  },
  'dark-moody': {
    gradient: 'from-slate-400 via-slate-500 to-slate-600',
    glow: 'rgba(148, 163, 184, 0.12)',
    accent: 'text-slate-300',
  },
  'organic': {
    gradient: 'from-emerald-500 via-green-500 to-lime-500',
    glow: 'rgba(16, 185, 129, 0.15)',
    accent: 'text-emerald-400',
  },
  'fantasy': {
    gradient: 'from-purple-500 via-violet-500 to-indigo-500',
    glow: 'rgba(139, 92, 246, 0.15)',
    accent: 'text-purple-400',
  },
  'minimal': {
    gradient: 'from-gray-400 via-gray-500 to-gray-600',
    glow: 'rgba(156, 163, 175, 0.12)',
    accent: 'text-gray-300',
  },
  'cinematic': {
    gradient: 'from-amber-600 via-orange-500 to-red-500',
    glow: 'rgba(234, 88, 12, 0.15)',
    accent: 'text-orange-400',
  },
  'portrait': {
    gradient: 'from-rose-400 via-pink-400 to-red-400',
    glow: 'rgba(251, 113, 133, 0.15)',
    accent: 'text-rose-400',
  },
  'landscape': {
    gradient: 'from-sky-400 via-cyan-400 to-teal-400',
    glow: 'rgba(34, 211, 238, 0.15)',
    accent: 'text-cyan-400',
  },
  'anime': {
    gradient: 'from-rose-400 via-pink-400 to-fuchsia-400',
    glow: 'rgba(244, 114, 182, 0.15)',
    accent: 'text-rose-400',
  },
  'watercolour': {
    gradient: 'from-sky-300 via-blue-300 to-indigo-300',
    glow: 'rgba(147, 197, 253, 0.18)',
    accent: 'text-sky-300',
  },
  'oil-painting': {
    gradient: 'from-amber-700 via-yellow-600 to-orange-600',
    glow: 'rgba(217, 119, 6, 0.15)',
    accent: 'text-amber-500',
  },
  'photorealistic': {
    gradient: 'from-neutral-400 via-zinc-400 to-stone-400',
    glow: 'rgba(161, 161, 170, 0.12)',
    accent: 'text-neutral-300',
  },
  'abstract': {
    gradient: 'from-fuchsia-500 via-purple-500 to-blue-500',
    glow: 'rgba(192, 38, 211, 0.15)',
    accent: 'text-fuchsia-400',
  },
  'horror': {
    gradient: 'from-red-700 via-red-600 to-rose-600',
    glow: 'rgba(185, 28, 28, 0.15)',
    accent: 'text-red-500',
  },
  'steampunk': {
    gradient: 'from-amber-600 via-yellow-700 to-stone-600',
    glow: 'rgba(180, 83, 9, 0.15)',
    accent: 'text-amber-500',
  },
  'ethereal': {
    gradient: 'from-violet-400 via-fuchsia-400 to-pink-400',
    glow: 'rgba(167, 139, 250, 0.2)',
    accent: 'text-violet-400',
  },
  'urban': {
    gradient: 'from-zinc-500 via-gray-500 to-slate-500',
    glow: 'rgba(113, 113, 122, 0.12)',
    accent: 'text-zinc-400',
  },
  'medieval': {
    gradient: 'from-stone-500 via-amber-600 to-yellow-700',
    glow: 'rgba(120, 113, 108, 0.15)',
    accent: 'text-stone-400',
  },
};

const DEFAULT_COLOURS = {
  gradient: 'from-sky-500 via-blue-500 to-indigo-500',
  glow: 'rgba(56, 189, 248, 0.15)',
  accent: 'text-sky-400',
};

// ============================================================================
// TYPES
// ============================================================================

export interface FamilyCardProps {
  family: StyleFamily;
  onSelect: (family: StyleFamily) => void;
  isExpanded?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function FamilyCard({
  family,
  onSelect,
  isExpanded = false,
}: FamilyCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Get colours based on family ID
  const colours = useMemo(() => {
    return FAMILY_COLOURS[family.id] ?? DEFAULT_COLOURS;
  }, [family.id]);

  // Generate DNA bar pattern - unique per family based on member count
  const dnaPattern = useMemo(() => {
    const seed = family.id.charCodeAt(0) + family.members.length;
    return [...Array(10)].map((_, i) => {
      const base = Math.sin(i * 0.8 + seed * 0.15);
      return 0.3 + (base * 0.35 + 0.35);
    });
  }, [family.id, family.members.length]);

  // Handler
  const handleClick = useCallback(() => {
    onSelect(family);
  }, [onSelect, family]);

  // Preview members (first 5)
  const previewMembers = useMemo(() => {
    return family.members.slice(0, 5);
  }, [family.members]);

  // Keyboard handler for accessibility
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(family);
      }
    },
    [onSelect, family]
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Explore ${family.displayName} style family`}
      className="group relative overflow-hidden rounded-2xl transition-all duration-500 ease-out cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/30"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: 'rgba(15, 23, 42, 0.7)',
        boxShadow: isHovered
          ? `0 0 60px 10px ${colours.glow}, inset 0 0 30px 5px ${colours.glow}`
          : '0 0 0 0 transparent',
        border: `1px solid ${isHovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'}`,
      }}
    >
      {/* Ethereal glow overlay - top */}
      <div
        className="absolute inset-0 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${colours.glow} 0%, transparent 70%)`,
          opacity: isHovered ? 1 : 0,
        }}
      />

      {/* Ethereal glow overlay - bottom */}
      <div
        className="absolute inset-0 transition-opacity duration-700 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 100%, ${colours.glow} 0%, transparent 60%)`,
          opacity: isHovered ? 0.5 : 0,
        }}
      />

      <div className="relative z-10 p-4">
        {/* DNA Helix Bar */}
        <div className="flex gap-0.5 mb-3">
          {dnaPattern.map((opacity, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full bg-gradient-to-r ${colours.gradient} transition-all duration-500`}
              style={{
                opacity: isHovered ? Math.min(opacity + 0.3, 1) : opacity * 0.6,
                transform: isHovered ? 'scaleY(1.3)' : 'scaleY(1)',
                filter: isHovered ? `drop-shadow(0 0 3px ${colours.glow})` : 'none',
              }}
            />
          ))}
        </div>

        {/* Header: Name + Mood */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3
            className="text-base font-semibold text-white truncate transition-all duration-300 flex-1"
            style={{
              textShadow: isHovered ? `0 0 15px ${colours.glow}` : 'none',
            }}
          >
            {family.displayName}
          </h3>
          <span
            className={`shrink-0 px-2 py-0.5 text-[10px] uppercase tracking-wide rounded ${
              family.mood === 'intense'
                ? 'bg-orange-500/10 text-orange-400'
                : family.mood === 'calm'
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-slate-500/10 text-slate-400'
            }`}
          >
            {family.mood}
          </span>
        </div>

        {/* Description */}
        <p className="text-xs text-white/40 mb-3 line-clamp-2 leading-relaxed transition-colors duration-300 group-hover:text-white/60">
          {family.description}
        </p>

        {/* Stats Row */}
        <div className="flex items-center gap-3 mb-3 text-xs">
          {/* Member count */}
          <div className="flex items-center gap-1.5">
            <div
              className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${colours.gradient} transition-all duration-300`}
              style={{
                boxShadow: isHovered ? `0 0 6px 1px ${colours.glow}` : 'none',
              }}
            />
            <span className={`${colours.accent} font-medium`}>
              {family.members.length} terms
            </span>
          </div>

          {/* Related count */}
          <span className="text-white/30">
            {family.related.length} related
          </span>

          {/* Opposes count */}
          {family.opposes.length > 0 && (
            <span className="text-white/20">
              {family.opposes.length} conflicts
            </span>
          )}
        </div>

        {/* Preview Members */}
        <div className="flex flex-wrap gap-1 mb-3">
          {previewMembers.map((member) => (
            <span
              key={member}
              className="px-2 py-0.5 text-[10px] rounded-md bg-white/5 text-white/40 transition-colors duration-300 group-hover:text-white/60"
            >
              {member}
            </span>
          ))}
          {family.members.length > 5 && (
            <span className="px-2 py-0.5 text-[10px] rounded-md bg-white/5 text-white/30">
              +{family.members.length - 5}
            </span>
          )}
        </div>

        {/* Suggested sections - shown on hover or expanded */}
        {(isHovered || isExpanded) && (
          <div className="space-y-2 pt-2 border-t border-white/5 transition-all duration-300">
            {/* Colours */}
            {family.suggestedColours.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-[10px] text-white/30 w-14 shrink-0">Colours:</span>
                <div className="flex flex-wrap gap-1">
                  {family.suggestedColours.slice(0, 3).map((colour) => (
                    <span
                      key={colour}
                      className="px-1.5 py-0.5 text-[9px] rounded bg-white/5 text-white/50"
                    >
                      {colour}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Lighting */}
            {family.suggestedLighting.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-[10px] text-white/30 w-14 shrink-0">Light:</span>
                <div className="flex flex-wrap gap-1">
                  {family.suggestedLighting.slice(0, 3).map((light) => (
                    <span
                      key={light}
                      className="px-1.5 py-0.5 text-[9px] rounded bg-white/5 text-white/50"
                    >
                      {light}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer: Explore action */}
        <div className="flex items-center justify-end pt-2 mt-2 border-t border-white/5">
          <span
            className={`text-[10px] ${colours.accent} transition-all duration-300`}
            style={{
              textShadow: isHovered ? `0 0 8px ${colours.glow}` : 'none',
            }}
          >
            Explore →
          </span>
        </div>
      </div>
    </div>
  );
}

export default FamilyCard;
