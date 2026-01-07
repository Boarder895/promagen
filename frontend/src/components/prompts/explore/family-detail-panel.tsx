// src/components/prompts/explore/family-detail-panel.tsx
// ============================================================================
// FAMILY DETAIL PANEL
// ============================================================================
// Detailed view panel when a family is selected.
// Authority: docs/authority/prompt-intelligence.md §9.2
// ============================================================================

'use client';

import React, { useCallback, useMemo } from 'react';
import type { StyleFamily } from '@/types/style-family';

// ============================================================================
// FAMILY COLOUR MAPPING
// ============================================================================

const FAMILY_COLOURS: Record<string, { gradient: string; glow: string; accent: string }> = {
  'sci-fi': { gradient: 'from-blue-500 via-indigo-500 to-violet-500', glow: 'rgba(99, 102, 241, 0.15)', accent: 'text-blue-400' },
  'cyberpunk': { gradient: 'from-pink-500 via-purple-500 to-cyan-500', glow: 'rgba(236, 72, 153, 0.15)', accent: 'text-pink-400' },
  'retro': { gradient: 'from-amber-500 via-orange-400 to-yellow-500', glow: 'rgba(245, 158, 11, 0.15)', accent: 'text-amber-400' },
  'dark-moody': { gradient: 'from-slate-400 via-slate-500 to-slate-600', glow: 'rgba(148, 163, 184, 0.12)', accent: 'text-slate-300' },
  'organic': { gradient: 'from-emerald-500 via-green-500 to-lime-500', glow: 'rgba(16, 185, 129, 0.15)', accent: 'text-emerald-400' },
  'fantasy': { gradient: 'from-purple-500 via-violet-500 to-indigo-500', glow: 'rgba(139, 92, 246, 0.15)', accent: 'text-purple-400' },
  'minimal': { gradient: 'from-gray-400 via-gray-500 to-gray-600', glow: 'rgba(156, 163, 175, 0.12)', accent: 'text-gray-300' },
  'cinematic': { gradient: 'from-amber-600 via-orange-500 to-red-500', glow: 'rgba(234, 88, 12, 0.15)', accent: 'text-orange-400' },
  'portrait': { gradient: 'from-rose-400 via-pink-400 to-red-400', glow: 'rgba(251, 113, 133, 0.15)', accent: 'text-rose-400' },
  'landscape': { gradient: 'from-sky-400 via-cyan-400 to-teal-400', glow: 'rgba(34, 211, 238, 0.15)', accent: 'text-cyan-400' },
  'anime': { gradient: 'from-rose-400 via-pink-400 to-fuchsia-400', glow: 'rgba(244, 114, 182, 0.15)', accent: 'text-rose-400' },
  'watercolour': { gradient: 'from-sky-300 via-blue-300 to-indigo-300', glow: 'rgba(147, 197, 253, 0.18)', accent: 'text-sky-300' },
  'oil-painting': { gradient: 'from-amber-700 via-yellow-600 to-orange-600', glow: 'rgba(217, 119, 6, 0.15)', accent: 'text-amber-500' },
  'photorealistic': { gradient: 'from-neutral-400 via-zinc-400 to-stone-400', glow: 'rgba(161, 161, 170, 0.12)', accent: 'text-neutral-300' },
  'abstract': { gradient: 'from-fuchsia-500 via-purple-500 to-blue-500', glow: 'rgba(192, 38, 211, 0.15)', accent: 'text-fuchsia-400' },
  'horror': { gradient: 'from-red-700 via-red-600 to-rose-600', glow: 'rgba(185, 28, 28, 0.15)', accent: 'text-red-500' },
  'steampunk': { gradient: 'from-amber-600 via-yellow-700 to-stone-600', glow: 'rgba(180, 83, 9, 0.15)', accent: 'text-amber-500' },
  'ethereal': { gradient: 'from-violet-400 via-fuchsia-400 to-pink-400', glow: 'rgba(167, 139, 250, 0.2)', accent: 'text-violet-400' },
  'urban': { gradient: 'from-zinc-500 via-gray-500 to-slate-500', glow: 'rgba(113, 113, 122, 0.12)', accent: 'text-zinc-400' },
  'medieval': { gradient: 'from-stone-500 via-amber-600 to-yellow-700', glow: 'rgba(120, 113, 108, 0.15)', accent: 'text-stone-400' },
};

const DEFAULT_COLOURS = {
  gradient: 'from-sky-500 via-blue-500 to-indigo-500',
  glow: 'rgba(56, 189, 248, 0.15)',
  accent: 'text-sky-400',
};

// ============================================================================
// TYPES
// ============================================================================

export interface FamilyDetailPanelProps {
  family: StyleFamily;
  onClose: () => void;
  onUseInBuilder: (terms: string[]) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function FamilyDetailPanel({
  family,
  onClose,
  onUseInBuilder,
}: FamilyDetailPanelProps) {
  const colours = useMemo(() => {
    return FAMILY_COLOURS[family.id] ?? DEFAULT_COLOURS;
  }, [family.id]);

  // Generate DNA pattern
  const dnaPattern = useMemo(() => {
    const seed = family.id.charCodeAt(0) + family.members.length;
    return [...Array(20)].map((_, i) => {
      const base = Math.sin(i * 0.5 + seed * 0.1);
      return 0.3 + (base * 0.35 + 0.35);
    });
  }, [family.id, family.members.length]);

  // Handler to use suggested terms
  const handleUseColours = useCallback(() => {
    onUseInBuilder(family.suggestedColours);
  }, [onUseInBuilder, family.suggestedColours]);

  const handleUseLighting = useCallback(() => {
    onUseInBuilder(family.suggestedLighting);
  }, [onUseInBuilder, family.suggestedLighting]);

  const handleUseAtmosphere = useCallback(() => {
    onUseInBuilder(family.suggestedAtmosphere);
  }, [onUseInBuilder, family.suggestedAtmosphere]);

  const handleUseAllSuggestions = useCallback(() => {
    const allTerms = [
      ...family.suggestedColours.slice(0, 1),
      ...family.suggestedLighting.slice(0, 1),
      ...family.suggestedAtmosphere.slice(0, 1),
    ];
    onUseInBuilder(allTerms);
  }, [onUseInBuilder, family]);

  return (
    <div
      className="relative overflow-hidden rounded-2xl h-full flex flex-col"
      style={{
        background: 'rgba(15, 23, 42, 0.7)',
        boxShadow: `0 0 40px 5px ${colours.glow}, inset 0 0 20px 3px ${colours.glow}`,
        border: '1px solid rgba(255,255,255,0.15)',
      }}
    >
      {/* Ethereal glow overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${colours.glow} 0%, transparent 60%)`,
          opacity: 0.8,
        }}
      />

      {/* Header */}
      <div className="relative z-10 p-4 border-b border-white/5">
        {/* DNA Helix Bar - wider */}
        <div className="flex gap-0.5 mb-3">
          {dnaPattern.map((opacity, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full bg-gradient-to-r ${colours.gradient}`}
              style={{
                opacity: opacity * 0.8,
                filter: `drop-shadow(0 0 2px ${colours.glow})`,
              }}
            />
          ))}
        </div>

        {/* Title + Close */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2
              className="text-xl font-semibold text-white mb-1"
              style={{ textShadow: `0 0 20px ${colours.glow}` }}
            >
              {family.displayName}
            </h2>
            <p className="text-sm text-white/50">{family.description}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/40 hover:text-white transition-colors rounded-lg hover:bg-white/5"
            aria-label="Close panel"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mt-3 text-xs">
          <span className={colours.accent}>
            <strong>{family.members.length}</strong> terms
          </span>
          <span className="text-white/40">
            <strong>{family.related.length}</strong> related
          </span>
          <span
            className={`px-2 py-0.5 rounded ${
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
      </div>

      {/* Content - scrollable */}
      <div className="relative z-10 flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20">
        {/* All Members */}
        <section>
          <h3 className="text-xs font-medium text-white/50 uppercase tracking-wide mb-2">
            All Terms
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {family.members.map((member) => (
              <span
                key={member}
                className="px-2.5 py-1 text-xs rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
              >
                {member}
              </span>
            ))}
          </div>
        </section>

        {/* Suggested Colours */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-medium text-white/50 uppercase tracking-wide">
              Suggested Colours
            </h3>
            <button
              onClick={handleUseColours}
              className="text-[10px] text-white/40 hover:text-white transition-colors"
            >
              Use →
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {family.suggestedColours.map((colour) => (
              <span
                key={colour}
                className="px-2 py-0.5 text-[11px] rounded bg-white/5 text-white/50"
              >
                {colour}
              </span>
            ))}
          </div>
        </section>

        {/* Suggested Lighting */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-medium text-white/50 uppercase tracking-wide">
              Suggested Lighting
            </h3>
            <button
              onClick={handleUseLighting}
              className="text-[10px] text-white/40 hover:text-white transition-colors"
            >
              Use →
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {family.suggestedLighting.map((light) => (
              <span
                key={light}
                className="px-2 py-0.5 text-[11px] rounded bg-white/5 text-white/50"
              >
                {light}
              </span>
            ))}
          </div>
        </section>

        {/* Suggested Atmosphere */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-medium text-white/50 uppercase tracking-wide">
              Suggested Atmosphere
            </h3>
            <button
              onClick={handleUseAtmosphere}
              className="text-[10px] text-white/40 hover:text-white transition-colors"
            >
              Use →
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {family.suggestedAtmosphere.map((atmo) => (
              <span
                key={atmo}
                className="px-2 py-0.5 text-[11px] rounded bg-white/5 text-white/50"
              >
                {atmo}
              </span>
            ))}
          </div>
        </section>

        {/* Related Families */}
        {family.related.length > 0 && (
          <section>
            <h3 className="text-xs font-medium text-white/50 uppercase tracking-wide mb-2">
              Related Families
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {family.related.map((rel) => (
                <span
                  key={rel}
                  className="px-2 py-0.5 text-[11px] rounded bg-emerald-500/10 text-emerald-400"
                >
                  {rel}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Opposing Families */}
        {family.opposes.length > 0 && (
          <section>
            <h3 className="text-xs font-medium text-white/50 uppercase tracking-wide mb-2">
              Conflicts With
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {family.opposes.map((opp) => (
                <span
                  key={opp}
                  className="px-2 py-0.5 text-[11px] rounded bg-red-500/10 text-red-400"
                >
                  {opp}
                </span>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Footer - Action */}
      <div className="relative z-10 p-4 border-t border-white/5">
        <button
          onClick={handleUseAllSuggestions}
          className={`w-full py-2.5 text-sm font-medium rounded-xl bg-gradient-to-r ${colours.gradient} text-white hover:opacity-90 transition-opacity`}
          style={{
            boxShadow: `0 0 20px 2px ${colours.glow}`,
          }}
        >
          Use Suggestions in Builder →
        </button>
      </div>
    </div>
  );
}

export default FamilyDetailPanel;
