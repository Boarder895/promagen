// src/components/prompts/learn/guide-card.tsx
// ============================================================================
// GUIDE CARD
// ============================================================================
// Card component for displaying learning guides.
// Design: DNA Helix + Ethereal Glow hybrid (matches Explore page family-card.tsx)
// Authority: docs/authority/prompt-intelligence.md §9.3
// UPDATED: Each guide has its own unique color scheme (12 distinct colors)
// UPDATED: Tags use simple single-color styling matching family-card.tsx
// ============================================================================

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import type { LearnGuide } from '@/types/learn-content';
import type { PlatformTier } from '@/data/platform-tiers';

// ============================================================================
// GUIDE COLOUR MAPPING - 12 unique colors for 12 guides
// Each guide gets its own distinct color scheme like the Explore page
// ============================================================================

const GUIDE_COLOURS: Record<string, { gradient: string; glow: string; accent: string }> = {
  // 1. Prompt Engineering Fundamentals - Sky/Blue (foundational, overview)
  'prompt-fundamentals': {
    gradient: 'from-sky-400 via-blue-500 to-indigo-500',
    glow: 'rgba(56, 189, 248, 0.15)',
    accent: 'text-sky-400',
  },
  // 2. Crafting Your Subject - Rose/Pink (portrait-like, about subjects)
  'crafting-subject': {
    gradient: 'from-rose-400 via-pink-400 to-red-400',
    glow: 'rgba(251, 113, 133, 0.15)',
    accent: 'text-rose-400',
  },
  // 3. Action, Pose & Movement - Orange/Amber (dynamic, energetic)
  'action-pose': {
    gradient: 'from-orange-400 via-amber-500 to-yellow-500',
    glow: 'rgba(251, 146, 60, 0.15)',
    accent: 'text-orange-400',
  },
  // 4. Mastering Style Modifiers - Violet/Purple (artistic, creative)
  'style-modifiers': {
    gradient: 'from-violet-400 via-purple-500 to-fuchsia-500',
    glow: 'rgba(139, 92, 246, 0.15)',
    accent: 'text-violet-400',
  },
  // 5. Environments & Settings - Emerald/Green (organic, natural)
  'environments-settings': {
    gradient: 'from-emerald-400 via-green-500 to-teal-500',
    glow: 'rgba(16, 185, 129, 0.15)',
    accent: 'text-emerald-400',
  },
  // 6. Composition & Framing - Cyan/Teal (structural, composed)
  'composition-framing': {
    gradient: 'from-cyan-400 via-teal-500 to-emerald-500',
    glow: 'rgba(34, 211, 238, 0.15)',
    accent: 'text-cyan-400',
  },
  // 7. Camera & Lens Techniques - Slate/Gray (technical, neutral)
  'camera-lens': {
    gradient: 'from-slate-400 via-gray-500 to-zinc-500',
    glow: 'rgba(148, 163, 184, 0.12)',
    accent: 'text-slate-300',
  },
  // 8. Lighting & Atmosphere - Amber/Yellow (warm, golden)
  'lighting-atmosphere': {
    gradient: 'from-amber-400 via-yellow-500 to-orange-400',
    glow: 'rgba(245, 158, 11, 0.15)',
    accent: 'text-amber-400',
  },
  // 9. Colour in AI Prompts - Fuchsia/Pink (colorful, vibrant)
  'colour-theory': {
    gradient: 'from-fuchsia-400 via-pink-500 to-rose-500',
    glow: 'rgba(232, 121, 249, 0.15)',
    accent: 'text-fuchsia-400',
  },
  // 10. Materials, Textures & Surfaces - Stone/Brown (earthy, tactile)
  'materials-textures': {
    gradient: 'from-stone-400 via-amber-600 to-yellow-700',
    glow: 'rgba(168, 162, 158, 0.15)',
    accent: 'text-stone-400',
  },
  // 11. Fidelity & Quality Boosters - Indigo/Blue (precise, technical)
  'fidelity-quality': {
    gradient: 'from-indigo-400 via-blue-500 to-violet-500',
    glow: 'rgba(99, 102, 241, 0.15)',
    accent: 'text-indigo-400',
  },
  // 12. Using Negative Prompts - Red/Rose (constraints, negatives)
  'negative-prompts': {
    gradient: 'from-red-400 via-rose-500 to-pink-500',
    glow: 'rgba(248, 113, 113, 0.15)',
    accent: 'text-red-400',
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

export interface GuideCardProps {
  guide: LearnGuide;
  onSelect: (guide: LearnGuide) => void;
  /** Selected platform tier for tier-specific styling */
  selectedTier?: PlatformTier | null;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function GuideCard({ guide, onSelect, selectedTier }: GuideCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Get colours based on guide ID (each guide has unique colors)
  const colours = useMemo(() => {
    return GUIDE_COLOURS[guide.id] ?? DEFAULT_COLOURS;
  }, [guide.id]);

  // Generate DNA bar pattern
  const dnaPattern = useMemo(() => {
    const seed = guide.id.charCodeAt(0) + guide.sections.length;
    return [...Array(10)].map((_, i) => {
      const base = Math.sin(i * 0.7 + seed * 0.12);
      return 0.3 + (base * 0.35 + 0.35);
    });
  }, [guide.id, guide.sections.length]);

  // Handlers
  const handleClick = useCallback(() => {
    onSelect(guide);
  }, [onSelect, guide]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(guide);
      }
    },
    [onSelect, guide]
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Read guide: ${guide.title}`}
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

        {/* Header - Title only (removed difficulty badge) */}
        <div className="mb-2">
          <h3
            className="text-base font-semibold text-white truncate transition-all duration-300"
            style={{
              textShadow: isHovered ? `0 0 15px ${colours.glow}` : 'none',
            }}
          >
            {guide.title}
          </h3>
        </div>

        {/* Description */}
        <p className="text-xs text-white/40 mb-3 line-clamp-2 leading-relaxed transition-colors duration-300 group-hover:text-white/60">
          {guide.description}
        </p>

        {/* Tags - Simple single-color styling matching family-card.tsx */}
        <div className="flex flex-wrap gap-1 mb-3">
          {guide.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 text-[10px] rounded-md bg-white/5 text-white/40 transition-colors duration-300 group-hover:text-white/60"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/30 capitalize">{guide.category.replace('-', ' ')}</span>
            {selectedTier && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/40">
                {selectedTier.shortName} tips
              </span>
            )}
          </div>
          <span
            className={`text-[10px] ${colours.accent} transition-all duration-300`}
            style={{
              textShadow: isHovered ? `0 0 8px ${colours.glow}` : 'none',
            }}
          >
            Read Guide →
          </span>
        </div>
      </div>
    </div>
  );
}

export default GuideCard;
