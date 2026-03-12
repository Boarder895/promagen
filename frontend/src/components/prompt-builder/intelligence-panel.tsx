/**
 * IntelligencePanel Component
 * ============================
 * Real-time intelligent feedback for prompt building.
 * 
 * Features:
 * - Conflict warnings with severity levels
 * - Style suggestions based on selections
 * - Market mood integration
 * - Weather-driven suggestions
 * - Platform optimization hints
 * 
 * @version 1.0.0
 * @updated 2026-01-21
 */

'use client';

import React, { useState } from 'react';
import type {
  ConflictWarning,
  StyleSuggestion,
  MarketMoodContext,
  PlatformTier
} from '../../types/prompt-intelligence';
import { TIER_CONFIGS } from '../../types/prompt-intelligence';

// ============================================================================
// TYPES
// ============================================================================

interface IntelligencePanelProps {
  conflicts: ConflictWarning[];
  suggestions: StyleSuggestion[];
  platformHints: string[];
  marketMood: MarketMoodContext | null;
  weatherSuggestions: string[];
  tier: PlatformTier;
  onSuggestionClick?: (suggestion: StyleSuggestion) => void;
  onMoodTermClick?: (term: string, category: 'atmosphere' | 'colour' | 'lighting') => void;
  compact?: boolean;
  /** Category metadata for suggestion chips — icon + color per familyId */
  categoryMeta?: Record<string, { icon: string; color: string }>;
}

// ============================================================================
// UTILITY — Same hexToRgba as exchange-card.tsx for consistent glow
// ============================================================================

function hexToRgba(hex: string, alpha: number): string {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return `rgba(168, 85, 247, ${alpha})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function ConflictCard({ conflict }: { conflict: ConflictWarning }) {
  const [expanded, setExpanded] = useState(false);
  
  const severityColors = {
    critical: 'bg-red-500/20 border-red-500/50 text-red-400',
    high: 'bg-orange-500/20 border-orange-500/50 text-orange-400',
    medium: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400',
    low: 'bg-blue-500/20 border-blue-500/50 text-blue-400'
  };
  
  const severityIcons = {
    critical: '🚫',
    high: '⚠️',
    medium: '💡',
    low: 'ℹ️'
  };
  
  return (
    <div
      className={`
        rounded-lg border p-3 cursor-pointer transition-all overflow-hidden
        ${severityColors[conflict.severity]}
      `}
      onClick={() => setExpanded(!expanded)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setExpanded(!expanded);
        }
      }}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
    >
      <div className="flex items-start gap-2">
        <span className="text-lg">{severityIcons[conflict.severity]}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <code className="px-1.5 py-0.5 bg-black/30 rounded text-xs font-mono">
              {conflict.term1}
            </code>
            <span className="text-xs opacity-60">↔</span>
            <code className="px-1.5 py-0.5 bg-black/30 rounded text-xs font-mono">
              {conflict.term2}
            </code>
          </div>
          
          {expanded && (
            <div className="mt-2 space-y-1">
              <p className="text-sm opacity-80">{conflict.reason}</p>
              {conflict.exception && (
                <p className="text-xs opacity-60 italic">
                  💡 Exception: {conflict.exception}
                </p>
              )}
            </div>
          )}
        </div>
        
        <span className={`
          px-2 py-0.5 rounded text-xs font-semibold uppercase
          ${conflict.severity === 'critical' ? 'bg-red-500 text-white' : 'bg-white/10'}
        `}>
          {conflict.severity}
        </span>
      </div>
    </div>
  );
}

function SuggestionChip({
  suggestion,
  onClick,
  meta
}: {
  suggestion: StyleSuggestion;
  onClick?: () => void;
  meta?: { icon: string; color: string };
}) {
  const [isHovered, setIsHovered] = useState(false);

  // ── Commodity-card-identical glow pattern ──────────────────────────
  // Copied from commodity-mover-card.tsx lines 176-190:
  //   border: always `2px solid ${hoverHex}` (colored outline)
  //   background: 0.05 default, 0.08 on hover
  //   boxShadow: ONLY on hover
  //   Ethereal radial gradient overlays on hover
  // ───────────────────────────────────────────────────────────────────
  const hoverHex = meta?.color ?? '#34d399';
  const glowRgba = hexToRgba(hoverHex, 0.5);
  const glowSoft = hexToRgba(hoverHex, 0.3);

  const chipStyle: React.CSSProperties = {
    padding: 'clamp(6px, 0.4vw, 10px) clamp(8px, 0.6vw, 14px)',
    borderRadius: 'clamp(8px, 0.6vw, 12px)',
    background: isHovered ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.05)',
    border: `2px solid ${hoverHex}`,
    boxShadow: isHovered
      ? `0 0 30px 6px ${glowRgba}, 0 0 60px 12px ${glowSoft}, inset 0 0 20px 2px ${glowRgba}`
      : 'none',
    transition: 'box-shadow 200ms ease-out, background 200ms ease-out',
  };

  return (
    <div className="relative w-full overflow-hidden" style={{ borderRadius: 'clamp(8px, 0.6vw, 12px)' }}>
      <button
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="relative flex items-center gap-2 w-full cursor-pointer"
        style={chipStyle}
      >
        {/* Ethereal glow — top radial (matches commodity-card) */}
        {isHovered && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at 50% 0%, ${glowRgba} 0%, transparent 70%)`,
              opacity: 0.6,
              borderRadius: 'inherit',
            }}
          />
        )}
        {/* Ethereal glow — bottom radial */}
        {isHovered && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at 50% 100%, ${glowSoft} 0%, transparent 60%)`,
              opacity: 0.4,
              borderRadius: 'inherit',
            }}
          />
        )}
        {meta?.icon && (
          <span className="shrink-0 relative z-10" style={{ fontSize: 'clamp(12px, 0.8vw, 16px)' }}>{meta.icon}</span>
        )}
        <span className="text-sm text-white font-medium truncate relative z-10">+ {suggestion.term}</span>
        <span className="text-xs text-slate-400 ml-auto shrink-0 truncate max-w-[40%] relative z-10">{suggestion.reason}</span>
      </button>
    </div>
  );
}

function MarketMoodCard({
  mood,
  onTermClick
}: {
  mood: MarketMoodContext;
  onTermClick?: (term: string, category: 'atmosphere' | 'colour' | 'lighting') => void;
}) {
  const stateColors: Record<string, string> = {
    bullish: 'from-green-500/20 to-emerald-500/20 border-green-500/50',
    bearish: 'from-red-500/20 to-rose-500/20 border-red-500/50',
    volatile: 'from-purple-500/20 to-pink-500/20 border-purple-500/50',
    consolidating: 'from-gray-500/20 to-slate-500/20 border-gray-500/50',
    recovery: 'from-sky-500/20 to-cyan-500/20 border-sky-500/50'
  };
  
  const stateEmojis: Record<string, string> = {
    bullish: '📈',
    bearish: '📉',
    volatile: '⚡',
    consolidating: '➡️',
    recovery: '🌱'
  };
  
  const colorClass = stateColors[mood.state] || stateColors.consolidating;
  const emoji = stateEmojis[mood.state] || '📊';
  
  return (
    <div className={`
      rounded-xl border p-4
      bg-gradient-to-br ${colorClass}
    `}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">{emoji}</span>
        <div>
          <h4 className="font-semibold text-white capitalize">{mood.state} Market</h4>
          <p className="text-xs text-white/60">Suggested visual mood</p>
        </div>
      </div>
      
      {/* Mood terms */}
      <div className="space-y-2">
        <div>
          <p className="text-xs text-white/50 mb-1">🎭 Atmosphere</p>
          <div className="flex flex-wrap gap-1">
            {mood.atmosphereSuggestions.slice(0, 3).map((term, i) => (
              <button
                key={i}
                onClick={() => onTermClick?.(term, 'atmosphere')}
                className="px-2 py-0.5 bg-white/10 rounded text-xs text-white/80 hover:bg-white/20 transition-colors"
              >
                + {term}
              </button>
            ))}
          </div>
        </div>
        
        <div>
          <p className="text-xs text-white/50 mb-1">🎨 Colours</p>
          <div className="flex flex-wrap gap-1">
            {mood.colorSuggestions.slice(0, 3).map((term, i) => (
              <button
                key={i}
                onClick={() => onTermClick?.(term, 'colour')}
                className="px-2 py-0.5 bg-white/10 rounded text-xs text-white/80 hover:bg-white/20 transition-colors"
              >
                + {term}
              </button>
            ))}
          </div>
        </div>
        
        <div>
          <p className="text-xs text-white/50 mb-1">💡 Lighting</p>
          <div className="flex flex-wrap gap-1">
            {mood.lightingSuggestions.slice(0, 3).map((term, i) => (
              <button
                key={i}
                onClick={() => onTermClick?.(term, 'lighting')}
                className="px-2 py-0.5 bg-white/10 rounded text-xs text-white/80 hover:bg-white/20 transition-colors"
              >
                + {term}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function IntelligencePanel({
  conflicts,
  suggestions,
  platformHints,
  marketMood,
  weatherSuggestions,
  tier,
  onSuggestionClick,
  onMoodTermClick,
  compact = false,
  categoryMeta,
}: IntelligencePanelProps) {
  const [activeTab, setActiveTab] = useState<'conflicts' | 'suggestions' | 'market'>('conflicts');
  const tierConfig = TIER_CONFIGS[tier];
  
  const hasContent = conflicts.length > 0 || suggestions.length > 0 || marketMood || platformHints.length > 0;
  
  if (!hasContent && compact) {
    return null;
  }
  
  return (
    <div className="rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-white/10 overflow-hidden">
      {/* Header with tabs */}
      <div className="px-4 py-3 border-b border-white/10 bg-black/20">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <span className="text-xl">🧠</span>
            <span className="truncate">Prompt Intelligence</span>
          </h3>
          
          {/* Platform badge */}
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-white/10 rounded text-xs text-white/60">
              Tier {tier}: {tierConfig.name}
            </span>
          </div>
        </div>
        
        {/* Tabs */}
        {!compact && (
          <div className="flex gap-1 mt-3">
            <button
              onClick={() => setActiveTab('conflicts')}
              className={`
                px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                ${activeTab === 'conflicts'
                  ? 'bg-white/20 text-white'
                  : 'text-white/50 hover:text-white/80'
                }
              `}
            >
              ⚠️ Conflicts {conflicts.length > 0 && `(${conflicts.length})`}
            </button>
            <button
              onClick={() => setActiveTab('suggestions')}
              className={`
                px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                ${activeTab === 'suggestions'
                  ? 'bg-white/20 text-white'
                  : 'text-white/50 hover:text-white/80'
                }
              `}
            >
              ✨ Suggestions {suggestions.length > 0 && `(${suggestions.length})`}
            </button>
            {marketMood && (
              <button
                onClick={() => setActiveTab('market')}
                className={`
                  px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                  ${activeTab === 'market'
                    ? 'bg-white/20 text-white'
                    : 'text-white/50 hover:text-white/80'
                  }
                `}
              >
                📊 Market Mood
              </button>
            )}
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="p-4 space-y-4 overflow-y-auto overflow-x-hidden">
        {/* Compact mode: show everything */}
        {compact ? (
          <>
            {/* Critical conflicts always shown */}
            {conflicts.filter(c => c.severity === 'critical').map((conflict, i) => (
              <ConflictCard key={i} conflict={conflict} />
            ))}
            
            {/* Platform hints */}
            {platformHints.length > 0 && (
              <div className="space-y-1">
                {platformHints.map((hint, i) => (
                  <p key={i} className="text-sm text-white/70">{hint}</p>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Conflicts tab */}
            {activeTab === 'conflicts' && (
              <div className="space-y-3">
                {conflicts.length === 0 ? (
                  <div className="py-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">✅</span>
                      <p className="text-sm text-white font-medium">Selections are harmonious</p>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Checked against 145 conflict rules (era clashes, lighting contradictions,
                      style incompatibilities). Try mixing opposing terms like
                      <span className="text-amber-300"> vintage </span> +
                      <span className="text-amber-300"> cyberpunk</span> or
                      <span className="text-amber-300"> golden hour </span> +
                      <span className="text-amber-300"> neon glow</span> to see conflicts appear.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-white/60">
                      {conflicts.length} potential {conflicts.length === 1 ? 'conflict' : 'conflicts'} found
                    </p>
                    {conflicts.map((conflict, i) => (
                      <ConflictCard key={i} conflict={conflict} />
                    ))}
                  </>
                )}
              </div>
            )}
            
            {/* Suggestions tab */}
            {activeTab === 'suggestions' && (
              <div className="space-y-4">
                {suggestions.length === 0 ? (
                  <div className="text-center py-8">
                    <span className="text-4xl mb-2 block">🎨</span>
                    <p className="text-white/60">Select some styles to see suggestions</p>
                    <p className="text-white/40 text-sm">We&apos;ll recommend complementary options</p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-slate-300">
                      Based on your style selections:
                    </p>
                    <div className="flex flex-col gap-2">
                      {suggestions.map((suggestion, i) => (
                        <SuggestionChip
                          key={i}
                          suggestion={suggestion}
                          onClick={() => onSuggestionClick?.(suggestion)}
                          meta={categoryMeta?.[suggestion.familyId]}
                        />
                      ))}
                    </div>
                  </>
                )}
                
                {/* Weather suggestions */}
                {weatherSuggestions.length > 0 && (
                  <div className="pt-4 border-t border-white/10">
                    <p className="text-sm text-white/60 mb-2 flex items-center gap-2">
                      <span>🌤️</span> Weather-inspired suggestions
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {weatherSuggestions.map((term, i) => (
                        <button
                          key={i}
                          onClick={() => onMoodTermClick?.(term, 'atmosphere')}
                          className="px-3 py-1.5 bg-sky-500/20 border border-sky-500/30 rounded-full text-sm text-sky-400 hover:border-sky-500/60 transition-colors"
                        >
                          + {term}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Market mood tab */}
            {activeTab === 'market' && marketMood && (
              <MarketMoodCard mood={marketMood} onTermClick={onMoodTermClick} />
            )}
          </>
        )}
        
        {/* Platform hints always shown at bottom */}
        {!compact && platformHints.length > 0 && (
          <div className="pt-4 border-t border-white/10">
            <p className="text-xs text-white/40 mb-2">Platform tips:</p>
            <div className="space-y-1">
              {platformHints.map((hint, i) => (
                <p key={i} className="text-sm text-white/70">{hint}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default IntelligencePanel;
