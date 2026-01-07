// src/components/prompts/learn/guide-detail-panel.tsx
// ============================================================================
// GUIDE DETAIL PANEL
// ============================================================================
// Detailed view panel for reading a full guide.
// Authority: docs/authority/prompt-intelligence.md §9.3
// ============================================================================

'use client';

import React, { useMemo } from 'react';
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

export interface GuideDetailPanelProps {
  guide: LearnGuide;
  onClose: () => void;
  onRelatedClick: (guideId: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function GuideDetailPanel({
  guide,
  onClose,
  onRelatedClick,
}: GuideDetailPanelProps) {
  const colours = useMemo(() => {
    return CATEGORY_COLOURS[guide.category] ?? DEFAULT_COLOURS;
  }, [guide.category]);

  // Generate DNA pattern
  const dnaPattern = useMemo(() => {
    const seed = guide.id.charCodeAt(0) + guide.sections.length;
    return [...Array(20)].map((_, i) => {
      const base = Math.sin(i * 0.5 + seed * 0.1);
      return 0.3 + (base * 0.35 + 0.35);
    });
  }, [guide.id, guide.sections.length]);

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
        {/* DNA Helix Bar */}
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
          <div className="flex-1">
            <h2
              className="text-xl font-semibold text-white mb-1"
              style={{ textShadow: `0 0 20px ${colours.glow}` }}
            >
              {guide.title}
            </h2>
            <p className="text-sm text-white/50">{guide.description}</p>
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

        {/* Meta */}
        <div className="flex items-center gap-3 mt-3 text-xs">
          <span className={`px-2 py-0.5 rounded ${difficultyColour}`}>
            {guide.difficulty}
          </span>
          <span className="text-white/40">
            <svg className="w-3 h-3 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {guide.readTime} min read
          </span>
          <span className="text-white/40">{guide.sections.length} sections</span>
        </div>
      </div>

      {/* Content - scrollable */}
      <div className="relative z-10 flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20">
        {guide.sections.map((section, index) => (
          <section key={index} className="space-y-3">
            <h3 className={`text-base font-semibold ${colours.accent}`}>
              {section.title}
            </h3>
            
            <p className="text-sm text-white/70 leading-relaxed">
              {section.content}
            </p>

            {/* Example prompt */}
            {section.example && (
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="text-[10px] uppercase tracking-wide text-white/40 mb-2">Example</div>
                <code className="block text-xs text-white/80 bg-black/20 p-2 rounded-lg mb-2 font-mono">
                  {section.example.prompt}
                </code>
                <p className="text-xs text-white/50 italic">
                  {section.example.explanation}
                </p>
              </div>
            )}

            {/* Tips */}
            {section.tips && section.tips.length > 0 && (
              <div className="space-y-1.5">
                {section.tips.map((tip, tipIndex) => (
                  <div key={tipIndex} className="flex items-start gap-2 text-xs">
                    <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 mt-1.5" />
                    <span className="text-white/60">{tip}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}

        {/* Related Guides */}
        {guide.related.length > 0 && (
          <section className="pt-4 border-t border-white/5">
            <h3 className="text-xs font-medium text-white/50 uppercase tracking-wide mb-3">
              Related Guides
            </h3>
            <div className="flex flex-wrap gap-2">
              {guide.related.map((relatedId) => (
                <button
                  key={relatedId}
                  onClick={() => onRelatedClick(relatedId)}
                  className="px-3 py-1.5 text-xs rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-all"
                >
                  {relatedId.replace(/-/g, ' ')}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Tags */}
        <section>
          <div className="flex flex-wrap gap-1.5">
            {guide.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 text-[10px] rounded bg-white/5 text-white/40"
              >
                #{tag}
              </span>
            ))}
          </div>
        </section>
      </div>

      {/* Footer */}
      <div className="relative z-10 p-4 border-t border-white/5">
        <button
          onClick={onClose}
          className={`w-full py-2.5 text-sm font-medium rounded-xl bg-gradient-to-r ${colours.gradient} text-white hover:opacity-90 transition-opacity`}
          style={{
            boxShadow: `0 0 20px 2px ${colours.glow}`,
          }}
        >
          ← Back to All Guides
        </button>
      </div>
    </div>
  );
}

export default GuideDetailPanel;
