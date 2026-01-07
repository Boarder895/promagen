// src/components/prompts/library/saved-prompt-card.tsx
// ============================================================================
// SAVED PROMPT CARD
// ============================================================================
// Card component for displaying saved prompts in the library.
// Design: DNA Helix + Ethereal Glow hybrid
// Authority: docs/authority/prompt-intelligence.md §9.2
// ============================================================================

'use client';

import React, { useState, useCallback, useMemo } from 'react';
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
    gradient: 'from-slate-400 via-slate-500 to-slate-600',
    glow: 'rgba(148, 163, 184, 0.12)',
    accent: 'text-slate-300',
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
// TYPES
// ============================================================================

export interface SavedPromptCardProps {
  prompt: SavedPrompt;
  onLoad: (prompt: SavedPrompt) => void;
  onDelete: (id: string) => void;
  onEdit?: (prompt: SavedPrompt) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SavedPromptCard({
  prompt,
  onLoad,
  onDelete,
  onEdit,
}: SavedPromptCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Get colours based on primary family - handle undefined safely
  const colours = useMemo(() => {
    const primaryFamily = prompt.families[0];
    if (!primaryFamily) {
      return DEFAULT_COLOURS;
    }
    return FAMILY_COLOURS[primaryFamily] ?? DEFAULT_COLOURS;
  }, [prompt.families]);

  // Generate DNA bar pattern based on prompt coherence
  const dnaPattern = useMemo(() => {
    const seed = prompt.id.charCodeAt(0) + prompt.id.charCodeAt(1);
    return [...Array(10)].map((_, i) => {
      const base = Math.sin(i * 0.7 + seed * 0.1);
      return 0.25 + (base * 0.35 + 0.35);
    });
  }, [prompt.id]);

  // Format relative time
  const relativeTime = useMemo(() => {
    const now = new Date();
    const updated = new Date(prompt.updatedAt);
    const diffMs = now.getTime() - updated.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return updated.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }, [prompt.updatedAt]);

  // Truncate prompt preview
  const promptPreview = useMemo(() => {
    const text = prompt.positivePrompt;
    if (text.length <= 100) return text;
    return text.slice(0, 97) + '...';
  }, [prompt.positivePrompt]);

  // Handlers
  const handleLoad = useCallback(() => {
    onLoad(prompt);
  }, [onLoad, prompt]);

  const handleDelete = useCallback(() => {
    if (showDeleteConfirm) {
      onDelete(prompt.id);
      setShowDeleteConfirm(false);
    } else {
      setShowDeleteConfirm(true);
    }
  }, [onDelete, prompt.id, showDeleteConfirm]);

  const handleCancelDelete = useCallback(() => {
    setShowDeleteConfirm(false);
  }, []);

  const handleEdit = useCallback(() => {
    onEdit?.(prompt);
  }, [onEdit, prompt]);

  return (
    <div
      className="group relative overflow-hidden rounded-2xl transition-all duration-500 ease-out cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowDeleteConfirm(false);
      }}
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

        {/* Header: Name + Platform */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3
            className="text-base font-semibold text-white truncate transition-all duration-300 flex-1"
            style={{
              textShadow: isHovered ? `0 0 15px ${colours.glow}` : 'none',
            }}
          >
            {prompt.name}
          </h3>
          <span className="shrink-0 px-2 py-0.5 text-xs rounded-lg bg-white/5 text-white/50">
            {prompt.platformName}
          </span>
        </div>

        {/* Prompt Preview */}
        <p className="text-xs text-white/40 mb-3 line-clamp-2 leading-relaxed transition-colors duration-300 group-hover:text-white/60">
          {promptPreview}
        </p>

        {/* Stats Row */}
        <div className="flex items-center gap-3 mb-3 text-xs">
          {/* Coherence */}
          <div className="flex items-center gap-1.5">
            <div
              className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${colours.gradient} transition-all duration-300`}
              style={{
                boxShadow: isHovered ? `0 0 6px 1px ${colours.glow}` : 'none',
              }}
            />
            <span className={`${colours.accent} font-medium`}>
              {prompt.coherenceScore}%
            </span>
          </div>

          {/* Character count */}
          <span className="text-white/30">
            {prompt.characterCount} chars
          </span>

          {/* Mood badge */}
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide ${
              prompt.mood === 'intense'
                ? 'bg-orange-500/10 text-orange-400'
                : prompt.mood === 'calm'
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-slate-500/10 text-slate-400'
            }`}
          >
            {prompt.mood}
          </span>
        </div>

        {/* Families */}
        {prompt.families.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {prompt.families.slice(0, 3).map((family) => (
              <span
                key={family}
                className="px-2 py-0.5 text-[10px] rounded-md bg-white/5 text-white/40 transition-colors duration-300 group-hover:text-white/60"
              >
                {family}
              </span>
            ))}
            {prompt.families.length > 3 && (
              <span className="px-2 py-0.5 text-[10px] rounded-md bg-white/5 text-white/30">
                +{prompt.families.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Footer: Time + Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <span className="text-[10px] text-white/30">
            {relativeTime}
          </span>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {showDeleteConfirm ? (
              <>
                <button
                  onClick={handleCancelDelete}
                  className="px-2 py-1 text-[10px] rounded bg-white/5 text-white/50 hover:bg-white/10 hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="px-2 py-1 text-[10px] rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all"
                >
                  Confirm
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleDelete}
                  className="p-1.5 text-white/30 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  aria-label="Delete prompt"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                {onEdit && (
                  <button
                    onClick={handleEdit}
                    className="p-1.5 text-white/30 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                    aria-label="Edit prompt"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={handleLoad}
                  className={`px-2.5 py-1 text-[10px] rounded-md transition-all ${colours.accent} bg-white/5 hover:bg-white/10`}
                  style={{
                    textShadow: isHovered ? `0 0 8px ${colours.glow}` : 'none',
                  }}
                >
                  Load →
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SavedPromptCard;
