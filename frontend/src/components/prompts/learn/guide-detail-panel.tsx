// src/components/prompts/learn/guide-detail-panel.tsx
// ============================================================================
// GUIDE DETAIL PANEL
// ============================================================================
// Detailed view panel for reading a full guide.
// Authority: docs/authority/prompt-intelligence.md §9.3
// UPDATED: Each guide has its own unique color scheme (12 distinct colors)
// UPDATED: Tags use simple single-color styling matching family-card.tsx
// ============================================================================

'use client';

import React, { useMemo } from 'react';
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

export interface GuideDetailPanelProps {
  guide: LearnGuide;
  onClose: () => void;
  onRelatedClick: (guideId: string) => void;
  /** Selected platform tier */
  selectedTier?: PlatformTier | null;
  /** Selected platform ID */
  selectedPlatformId?: string | null;
  /** Platform name map */
  platformNames?: Map<string, string>;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function GuideDetailPanel({
  guide,
  onClose,
  onRelatedClick,
  selectedTier,
  selectedPlatformId,
  platformNames,
}: GuideDetailPanelProps) {
  // Get colours based on guide ID (each guide has unique colors)
  const colours = useMemo(() => {
    return GUIDE_COLOURS[guide.id] ?? DEFAULT_COLOURS;
  }, [guide.id]);

  // Generate DNA pattern
  const dnaPattern = useMemo(() => {
    const seed = guide.id.charCodeAt(0) + guide.sections.length;
    return [...Array(20)].map((_, i) => {
      const base = Math.sin(i * 0.5 + seed * 0.1);
      return 0.3 + (base * 0.35 + 0.35);
    });
  }, [guide.id, guide.sections.length]);

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

        {/* Tier-specific tip box when platform selected */}
        {selectedTier && selectedPlatformId && (
          <div className="mt-4 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
            <div className="flex items-start gap-2">
              <span className="text-emerald-400 text-sm">💡</span>
              <div className="flex-1">
                <p className="text-xs font-medium text-emerald-300 mb-1">
                  {platformNames?.get(selectedPlatformId)} Tips ({selectedTier.shortName})
                </p>
                <p className="text-xs text-emerald-300/70 leading-relaxed">
                  {selectedTier.promptStyle}. {selectedTier.tips[0]}
                </p>
              </div>
            </div>
          </div>
        )}
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

        {/* Tags - Simple single-color styling matching family-card.tsx */}
        <section>
          <div className="flex flex-wrap gap-1.5">
            {guide.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 text-[10px] rounded-md bg-white/5 text-white/40"
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
