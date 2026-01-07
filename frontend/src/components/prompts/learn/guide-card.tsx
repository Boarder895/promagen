// src/components/prompts/learn/guide-card.tsx
// ============================================================================
// GUIDE CARD
// ============================================================================
// Card component for displaying learning guides.
// Design: DNA Helix + Ethereal Glow hybrid
// Authority: docs/authority/prompt-intelligence.md §9.3
// ============================================================================

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import type { LearnGuide } from '@/types/learn-content';

// ============================================================================
// CATEGORY COLOUR MAPPING
// ============================================================================

const CATEGORY_COLOURS: Record<string, { gradient: string; glow: string; accent: string }> = {
  'fundamentals': {
    gradient: 'from-sky-500 via-blue-500 to-indigo-500',
    glow: 'rgba(56, 189, 248, 0.15)',
    accent: 'text-sky-400',
  },
  'advanced': {
    gradient: 'from-violet-500 via-purple-500 to-fuchsia-500',
    glow: 'rgba(139, 92, 246, 0.15)',
    accent: 'text-violet-400',
  },
  'platform-specific': {
    gradient: 'from-amber-500 via-orange-500 to-red-500',
    glow: 'rgba(245, 158, 11, 0.15)',
    accent: 'text-amber-400',
  },
  'tips': {
    gradient: 'from-emerald-500 via-green-500 to-teal-500',
    glow: 'rgba(16, 185, 129, 0.15)',
    accent: 'text-emerald-400',
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
}

// ============================================================================
// COMPONENT
// ============================================================================

export function GuideCard({ guide, onSelect }: GuideCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Get colours based on category
  const colours = useMemo(() => {
    return CATEGORY_COLOURS[guide.category] ?? DEFAULT_COLOURS;
  }, [guide.category]);

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

  // Difficulty badge colour
  const difficultyColour = useMemo(() => {
    switch (guide.difficulty) {
      case 'beginner':
        return 'bg-emerald-500/10 text-emerald-400';
      case 'intermediate':
        return 'bg-amber-500/10 text-amber-400';
      case 'advanced':
        return 'bg-red-500/10 text-red-400';
      default:
        return 'bg-slate-500/10 text-slate-400';
    }
  }, [guide.difficulty]);

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

        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3
            className="text-base font-semibold text-white truncate transition-all duration-300 flex-1"
            style={{
              textShadow: isHovered ? `0 0 15px ${colours.glow}` : 'none',
            }}
          >
            {guide.title}
          </h3>
          <span className={`shrink-0 px-2 py-0.5 text-[10px] uppercase tracking-wide rounded ${difficultyColour}`}>
            {guide.difficulty}
          </span>
        </div>

        {/* Description */}
        <p className="text-xs text-white/40 mb-3 line-clamp-2 leading-relaxed transition-colors duration-300 group-hover:text-white/60">
          {guide.description}
        </p>

        {/* Stats Row */}
        <div className="flex items-center gap-3 mb-3 text-xs">
          {/* Read time */}
          <div className="flex items-center gap-1.5">
            <svg className="w-3 h-3 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-white/50">{guide.readTime} min read</span>
          </div>

          {/* Sections count */}
          <span className="text-white/30">
            {guide.sections.length} sections
          </span>
        </div>

        {/* Tags */}
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
          <span className="text-[10px] text-white/30 capitalize">{guide.category.replace('-', ' ')}</span>
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
