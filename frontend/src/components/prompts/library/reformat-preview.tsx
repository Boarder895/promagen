// src/components/prompts/library/reformat-preview.tsx
// ============================================================================
// REFORMAT PREVIEW (v1.1.0 — Diff View)
// ============================================================================
// Inline overlay for reformatting a saved prompt to a different platform.
// Shown inside the right rail when "Reformat for…" is clicked.
//
// v1.1.0: Added diff/plain toggle. Diff view highlights word-level additions
//         (emerald) and removals (red) between original and reformatted text.
//         Uses PromptDiff component with zero-dependency LCS algorithm.
//
// Flow:
//   1. User clicks "Reformat for…" on a builder-origin prompt
//   2. This component shows a tier-grouped dropdown of all 42 platforms
//   3. Selecting a platform calls assemblePrompt() with saved selections
//   4. Reformatted text shown in preview (plain or diff view)
//   5. "Copy reformatted" copies to clipboard
//   6. "Save as new" creates a new SavedPrompt for the target platform
//
// Disabled for tooltip-origin prompts (no structured selections).
//
// Human Factors Gate:
// - Feature: One-click prompt reformatting with visual diff
// - Factor: Loss Aversion + Curiosity Gap — the diff makes the reformat
//   transparent. Users learn how prompts differ across platforms by seeing
//   the delta, turning a black box into an educational moment.
// - Anti-pattern: Two full texts without highlighting (high cognitive load)
//
// Authority: saved-page.md §10
// Sizing: All clamp() with 9px floor (code-standard.md §6.0.1)
// Existing features preserved: Yes
// ============================================================================

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { assemblePrompt } from '@/lib/prompt-builder';
import { PLATFORM_TIERS } from '@/data/platform-tiers';
import type { PlatformTierId } from '@/data/platform-tiers';
import type { SavedPrompt } from '@/types/saved-prompt';
import type { PromptSelections } from '@/types/prompt-builder';
import { PromptDiff } from './prompt-diff';
import { sendTrackEvent, getOrCreateSessionId } from '@/hooks/use-index-rating-events';

// ============================================================================
// PLATFORM DISPLAY NAMES
// ============================================================================
// Maps platformId → human-readable name. Covers all 42 platforms.
// Sourced from providers.json but kept inline here to avoid importing
// the full catalog (which would increase bundle size on the library page).
// ============================================================================

const PLATFORM_NAMES: Record<string, string> = {
  'midjourney': 'Midjourney',
  'openai': 'DALL·E 3',
  'google-imagen': 'Google Imagen',
  'leonardo': 'Leonardo',
  'flux': 'Flux',
  'stability': 'Stable Diffusion',
  'adobe-firefly': 'Adobe Firefly',
  'ideogram': 'Ideogram',
  'playground': 'Playground',
  'microsoft-designer': 'Microsoft Designer',
  'novelai': 'NovelAI',
  'lexica': 'Lexica',
  '123rf': '123RF',
  'canva': 'Canva',
  'bing': 'Bing Image Creator',
  'picsart': 'Picsart',
  'artistly': 'Artistly',
  'fotor': 'Fotor',
  'pixlr': 'Pixlr',
  'deepai': 'DeepAI',
  'craiyon': 'Craiyon',
  'bluewillow': 'BlueWillow',
  'dreamstudio': 'DreamStudio',
  'artbreeder': 'Artbreeder',
  'jasper-art': 'Jasper Art',
  'runway': 'Runway',
  'simplified': 'Simplified',
  'photoleap': 'Photoleap',
  'vistacreate': 'VistaCreate',
  'artguru': 'ArtGuru',
  'myedit': 'MyEdit',
  'visme': 'Visme',
  'hotpot': 'Hotpot',
  'picwish': 'PicWish',
  'clipdrop': 'Clipdrop',
  'imagine-meta': 'Imagine (Meta)',
  'dreamlike': 'Dreamlike',
  'remove-bg': 'Remove.bg',
  'recraft': 'Recraft',
  'kling': 'Kling AI',
  'luma-ai': 'Luma AI',
};

function getPlatformDisplayName(platformId: string): string {
  return PLATFORM_NAMES[platformId] ?? platformId;
}

// ============================================================================
// TIER LABELS
// ============================================================================

const TIER_LABELS: Record<PlatformTierId, { name: string; colour: string }> = {
  1: { name: 'Tier 1 — CLIP-Based', colour: 'text-blue-400' },
  2: { name: 'Tier 2 — Midjourney Family', colour: 'text-purple-400' },
  3: { name: 'Tier 3 — Natural Language', colour: 'text-emerald-400' },
  4: { name: 'Tier 4 — Plain Language', colour: 'text-orange-400' },
};

// ============================================================================
// TYPES
// ============================================================================

export interface ReformatPreviewProps {
  /** The prompt being reformatted */
  prompt: SavedPrompt;
  /** Called when user clicks "Save as new" */
  onSaveAsNew: (data: {
    positivePrompt: string;
    negativePrompt?: string;
    platformId: string;
    platformName: string;
    selections: PromptSelections;
    customValues: SavedPrompt['customValues'];
    families: string[];
    mood: SavedPrompt['mood'];
    coherenceScore: number;
    source: 'builder';
    tier: number;
  }) => void;
  /** Called when user clicks "Close" or back */
  onClose: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ReformatPreview({
  prompt,
  onSaveAsNew,
  onClose,
}: ReformatPreviewProps) {
  const [selectedPlatformId, setSelectedPlatformId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [viewMode, setViewMode] = useState<'diff' | 'plain'>('plain');

  // ── Build tier-grouped platform list ──
  const tierGroups = useMemo(() => {
    const groups: Array<{
      tierId: PlatformTierId;
      label: string;
      colour: string;
      platforms: Array<{ id: string; name: string }>;
    }> = [];

    for (const tierId of [1, 2, 3, 4] as PlatformTierId[]) {
      const tier = PLATFORM_TIERS[tierId];
      if (!tier) continue;
      const meta = TIER_LABELS[tierId];
      groups.push({
        tierId,
        label: meta.name,
        colour: meta.colour,
        platforms: tier.platforms
          .map((id) => ({ id, name: getPlatformDisplayName(id) }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      });
    }

    return groups;
  }, []);

  // ── Assemble prompt for selected platform ──
  const reformatted = useMemo(() => {
    if (!selectedPlatformId) return null;

    try {
      const selections = (prompt.selections ?? {}) as PromptSelections;
      const hasSelections = Object.values(selections).some(
        (arr) => Array.isArray(arr) && arr.length > 0
      );

      if (hasSelections) {
        // Structured data available — run through assemblePrompt pipeline
        const result = assemblePrompt(selectedPlatformId, selections);
        if (result.positive) return result;
      }

      // Fallback: use raw prompt text as-is (tooltip-origin or empty selections)
      return {
        positive: prompt.positivePrompt,
        negative: prompt.negativePrompt ?? undefined,
        tips: undefined,
        supportsNegative: true,
        negativeMode: 'none' as const,
      };
    } catch (error) {
      console.error('[ReformatPreview] Assembly failed:', error);
      return null;
    }
  }, [selectedPlatformId, prompt.selections, prompt.positivePrompt, prompt.negativePrompt]);

  // ── Handlers ──

  const handleCopy = useCallback(async () => {
    if (!reformatted) return;
    try {
      await navigator.clipboard.writeText(reformatted.positive);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may not be available
    }
  }, [reformatted]);

  const handleSaveAsNew = useCallback(() => {
    if (!reformatted || !selectedPlatformId) return;

    const tierId = (() => {
      for (const t of [1, 2, 3, 4] as PlatformTierId[]) {
        if (PLATFORM_TIERS[t].platforms.includes(selectedPlatformId)) return t;
      }
      return 4;
    })();

    onSaveAsNew({
      positivePrompt: reformatted.positive,
      negativePrompt: reformatted.negative,
      platformId: selectedPlatformId,
      platformName: getPlatformDisplayName(selectedPlatformId),
      selections: (prompt.selections ?? {}) as PromptSelections,
      customValues: prompt.customValues ?? {},
      families: prompt.families ?? [],
      mood: prompt.mood,
      coherenceScore: prompt.coherenceScore,
      source: 'builder',
      tier: tierId,
    });

    // ★ Index Rating: prompt reformatted for target platform (3pts, K=16)
    sendTrackEvent(selectedPlatformId, 'prompt_reformat', 'reformat_save_as_new', getOrCreateSessionId());

    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, [reformatted, selectedPlatformId, prompt, onSaveAsNew]);

  const selectedPlatformName = selectedPlatformId
    ? getPlatformDisplayName(selectedPlatformId)
    : null;

  return (
    <div className="flex flex-col" style={{ gap: 'clamp(8px, 0.7vw, 12px)' }}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h4
          className="text-white font-semibold"
          style={{ fontSize: 'clamp(0.85rem, 1.1vw, 1.3rem)' }}
        >
          Reformat Prompt
        </h4>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer text-white/70 hover:text-white transition-colors"
          style={{
            width: 'clamp(18px, 1.5vw, 22px)',
            height: 'clamp(18px, 1.5vw, 22px)',
          }}
          aria-label="Close reformat"
        >
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* ── Original platform ── */}
      <p className="text-white/70" style={{ fontSize: 'clamp(0.7rem, 0.85vw, 1rem)' }}>
        Original: <span className="text-white/60">{prompt.platformName}</span>
      </p>

      {/* ── Platform Selector (tier-grouped) ── */}
      <div
        className="overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30 rounded-lg bg-white/[0.03] border border-white/10"
        style={{ maxHeight: 'clamp(200px, 20vw, 320px)' }}
      >
        {tierGroups.map(({ tierId, label, colour, platforms }) => (
          <div key={tierId}>
            {/* Tier heading */}
            <div
              className={`sticky top-0 z-10 bg-slate-950/90 backdrop-blur-sm ${colour} font-medium uppercase tracking-wider`}
              style={{
                padding: 'clamp(6px, 0.5vw, 8px) clamp(10px, 0.8vw, 12px)',
                fontSize: 'clamp(0.7rem, 0.85vw, 1rem)',
              }}
            >
              {label}
            </div>

            {/* Platform rows */}
            {platforms.map(({ id, name }) => {
              const isOriginal = id === prompt.platformId;
              const isSelected = id === selectedPlatformId;

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    if (!isOriginal) {
                      setSelectedPlatformId(id);
                      setCopied(false);
                      setSaved(false);
                      setViewMode('plain');
                    }
                  }}
                  disabled={isOriginal}
                  className={`w-full text-left transition-colors ${
                    isOriginal
                      ? 'text-white/60 cursor-not-allowed'
                      : isSelected
                        ? 'cursor-pointer bg-white/10 text-white'
                        : 'cursor-pointer text-white/70 hover:text-white hover:bg-white/5'
                  }`}
                  style={{
                    padding: 'clamp(6px, 0.5vw, 8px) clamp(10px, 0.9vw, 14px)',
                    fontSize: 'clamp(0.75rem, 0.9vw, 1.05rem)',
                  }}
                >
                  {name}
                  {isOriginal && (
                    <span
                      className="text-white/60"
                      style={{
                        marginLeft: 'clamp(4px, 0.4vw, 6px)',
                        fontSize: 'clamp(0.7rem, 0.8vw, 0.95rem)',
                      }}
                    >
                      (current)
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── Reformatted Preview ── */}
      {reformatted && selectedPlatformName && (
        <div>
          {/* Label + Plain / Difference toggle — commodity-style buttons */}
          <div
            className="flex items-center justify-between"
            style={{ marginBottom: 'clamp(6px, 0.5vw, 10px)' }}
          >
            <p
              className="text-white"
              style={{ fontSize: 'clamp(0.7rem, 0.85vw, 1rem)' }}
            >
              Reformatted for <span className="text-white font-semibold">{selectedPlatformName}</span>
            </p>

            {/* Toggle buttons — commodity window style */}
            <div
              className="flex items-center"
              role="radiogroup"
              aria-label="View mode"
              style={{ gap: 'clamp(6px, 0.5vw, 8px)' }}
            >
              <button
                type="button"
                role="radio"
                aria-checked={viewMode === 'plain'}
                onClick={() => setViewMode('plain')}
                className="cursor-pointer rounded-lg transition-all"
                style={{
                  padding: 'clamp(4px, 0.35vw, 6px) clamp(10px, 0.8vw, 14px)',
                  fontSize: 'clamp(0.7rem, 0.8vw, 0.95rem)',
                  border: `2px solid ${viewMode === 'plain' ? 'rgba(16, 185, 129, 0.7)' : 'rgba(16, 185, 129, 0.3)'}`,
                  background: viewMode === 'plain' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.05)',
                  color: viewMode === 'plain' ? '#6ee7b7' : 'rgba(255,255,255,0.7)',
                  boxShadow: viewMode === 'plain' ? '0 0 12px 2px rgba(16, 185, 129, 0.3)' : 'none',
                }}
              >
                Plain
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={viewMode === 'diff'}
                onClick={() => setViewMode('diff')}
                className="cursor-pointer rounded-lg transition-all"
                style={{
                  padding: 'clamp(4px, 0.35vw, 6px) clamp(10px, 0.8vw, 14px)',
                  fontSize: 'clamp(0.7rem, 0.8vw, 0.95rem)',
                  border: `2px solid ${viewMode === 'diff' ? 'rgba(249, 115, 22, 0.7)' : 'rgba(249, 115, 22, 0.3)'}`,
                  background: viewMode === 'diff' ? 'rgba(249, 115, 22, 0.15)' : 'rgba(249, 115, 22, 0.05)',
                  color: viewMode === 'diff' ? '#fdba74' : 'rgba(255,255,255,0.7)',
                  boxShadow: viewMode === 'diff' ? '0 0 12px 2px rgba(249, 115, 22, 0.3)' : 'none',
                }}
              >
                Difference
              </button>
            </div>
          </div>

          {/* Conditional body: diff or plain */}
          {viewMode === 'diff' ? (
            <PromptDiff
              original={prompt.positivePrompt}
              reformatted={reformatted.positive}
            />
          ) : (
            <>
              {/* Plain text view (original Phase 8 behaviour) */}
              <div
                className="font-mono bg-slate-900/50 rounded-xl text-white/70 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30 whitespace-pre-wrap break-words"
                style={{
                  padding: 'clamp(8px, 0.7vw, 12px)',
                  fontSize: 'clamp(0.75rem, 0.9vw, 1.1rem)',
                  maxHeight: 'clamp(140px, 18vw, 260px)',
                  lineHeight: '1.6',
                }}
              >
                {reformatted.positive}
                {reformatted.negative && (
                  <>
                    <div
                      className="border-t border-white/10"
                      style={{ margin: 'clamp(6px, 0.5vw, 8px) 0' }}
                    />
                    <span className="text-red-400">Negative: </span>
                    {reformatted.negative}
                  </>
                )}
              </div>
            </>
          )}

          {/* Character count */}
          <p
            className="text-white/70"
            style={{
              fontSize: 'clamp(0.7rem, 0.8vw, 0.95rem)',
              marginTop: 'clamp(3px, 0.25vw, 4px)',
            }}
          >
            {reformatted.positive.length} characters
            {reformatted.wasTrimmed && (
              <span className="text-amber-400"> · trimmed to fit</span>
            )}
          </p>

          {/* Action buttons */}
          <div
            className="flex"
            style={{
              gap: 'clamp(4px, 0.35vw, 6px)',
              marginTop: 'clamp(6px, 0.5vw, 10px)',
            }}
          >
            <button
              type="button"
              onClick={handleCopy}
              className={`cursor-pointer flex-1 flex items-center justify-center rounded-lg transition-all ${
                copied
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
              }`}
              style={{
                padding: 'clamp(10px, 0.9vw, 14px)',
                fontSize: 'clamp(0.75rem, 0.9vw, 1.1rem)',
                gap: 'clamp(3px, 0.3vw, 5px)',
              }}
            >
              <svg
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                style={{ width: 'clamp(16px, 1.3vw, 20px)', height: 'clamp(16px, 1.3vw, 20px)' }}
              >
                {copied ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                )}
              </svg>
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAsNew}
              className={`cursor-pointer flex-1 flex items-center justify-center rounded-lg transition-all ${
                saved
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-gradient-to-r from-sky-400/10 to-emerald-400/10 text-sky-400 border border-sky-400/20 hover:border-sky-400/40'
              }`}
              style={{
                padding: 'clamp(10px, 0.9vw, 14px)',
                fontSize: 'clamp(0.75rem, 0.9vw, 1.1rem)',
                gap: 'clamp(3px, 0.3vw, 5px)',
              }}
            >
              <svg
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                style={{ width: 'clamp(16px, 1.3vw, 20px)', height: 'clamp(16px, 1.3vw, 20px)' }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <span>{saved ? 'Saved!' : 'Save as new'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ── No selection hint ── */}
      {!selectedPlatformId && (
        <p
          className="text-white/60 text-center"
          style={{
            fontSize: 'clamp(0.7rem, 0.85vw, 1rem)',
            paddingTop: 'clamp(4px, 0.4vw, 6px)',
          }}
        >
          Select a platform above to see the reformatted prompt
        </p>
      )}
    </div>
  );
}

export default ReformatPreview;
