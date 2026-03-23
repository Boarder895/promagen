// src/components/providers/describe-your-image.tsx
// ============================================================================
// DESCRIBE YOUR IMAGE v1.0.0 — Human Sentence Conversion UI
// ============================================================================
// A collapsible horizontal strip identical in pattern to SceneSelector.
// Sits below Scene Starters, above the category dropdown grid.
//
// Collapsed: trigger bar "✍️ Describe Your Image"
// Expanded: textarea (1,000 char max) + "Generate Prompt" button
// On generate: API parses → dropdowns populate with staggered animation
//
// Layout:
//   ┌─ Trigger bar (collapsed): "✍️ Describe Your Image"  ──────────────────┐
//   │  Click to expand ▾                                                      │
//   └─────────────────────────────────────────────────────────────────────────┘
//   ┌─ Expanded panel ────────────────────────────────────────────────────────┐
//   │  ┌────────────────────────────────────────────────────────────────────┐ │
//   │  │ Paste your description here...                                    │ │
//   │  │                                                          750/1000 │ │
//   │  └────────────────────────────────────────────────────────────────────┘ │
//   │  [Generate Prompt]                                              [Close] │
//   └─────────────────────────────────────────────────────────────────────────┘
//
// Authority: human-sentence-conversion.md
// Code Standard: All clamp() (§6.0), min 10px (§6.0.1), cursor-pointer (§6.0.4)
// Animations co-located in <style dangerouslySetInnerHTML> per best-working-practice.md
// ============================================================================

'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { PromptCategory, CategoryState } from '@/types/prompt-builder';
import { useSentenceConversion } from '@/hooks/use-sentence-conversion';
import { DriftIndicator } from '@/components/prompt-lab/drift-indicator';

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_CHARS = 1000;
const AMBER_THRESHOLD = 800;

// ============================================================================
// Co-located styles
// ============================================================================

const DESCRIBE_STYLES = `
  @keyframes dyi-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(251, 146, 60, 0.3); }
    50% { box-shadow: 0 0 0 6px rgba(251, 146, 60, 0); }
  }
  .dyi-generating { animation: dyi-pulse 1.2s ease-in-out infinite; }

  @keyframes dyi-regen-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.3); }
    50% { box-shadow: 0 0 0 5px rgba(251, 191, 36, 0); }
  }
  .dyi-regen { animation: dyi-regen-pulse 1.4s ease-in-out infinite; }

  @keyframes dyi-category-pop {
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: scale(1); }
  }
  .dyi-cat-badge { animation: dyi-category-pop 0.2s ease-out both; }

  .dyi-panel { will-change: max-height, opacity; }

  @keyframes dyi-generate-pulse {
    0%, 100% {
      box-shadow: 0 0 20px rgba(56, 189, 248, 0.3), 0 0 40px rgba(52, 211, 153, 0.2);
    }
    50% {
      box-shadow: 0 0 30px rgba(56, 189, 248, 0.5), 0 0 60px rgba(52, 211, 153, 0.4);
    }
  }
  .dyi-generate-active {
    animation: dyi-generate-pulse 2s ease-in-out infinite;
  }

  @keyframes dyi-generate-shimmer-sweep {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  .dyi-generate-shimmer {
    background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.3) 50%, transparent 100%);
    animation: dyi-generate-shimmer-sweep 1.5s ease-in-out infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .dyi-generating, .dyi-regen { animation: none; }
    .dyi-generate-active {
      animation: none;
      box-shadow: 0 0 25px rgba(56, 189, 248, 0.4), 0 0 50px rgba(52, 211, 153, 0.3);
    }
    .dyi-generate-shimmer {
      animation: none;
      opacity: 0 !important;
    }
  }
`;

// ============================================================================
// CATEGORY DISPLAY CONFIG — for populated badges
// ============================================================================

const CATEGORY_DISPLAY: Record<string, { emoji: string; label: string; color: string }> = {
  subject: { emoji: '👤', label: 'Subject', color: '#FCD34D' },
  action: { emoji: '🏃', label: 'Action', color: '#A3E635' },
  style: { emoji: '🎨', label: 'Style', color: '#C084FC' },
  environment: { emoji: '🌍', label: 'Environment', color: '#38BDF8' },
  composition: { emoji: '📐', label: 'Composition', color: '#34D399' },
  camera: { emoji: '📷', label: 'Camera', color: '#FB923C' },
  lighting: { emoji: '💡', label: 'Lighting', color: '#FBBF24' },
  colour: { emoji: '🎨', label: 'Colour', color: '#F472B6' },
  atmosphere: { emoji: '🌫️', label: 'Atmosphere', color: '#22D3EE' },
  materials: { emoji: '🧱', label: 'Materials', color: '#2DD4BF' },
  fidelity: { emoji: '✨', label: 'Fidelity', color: '#93C5FD' },
  negative: { emoji: '🚫', label: 'Negative', color: '#F87171' },
};

// ============================================================================
// TYPES
// ============================================================================

export interface DescribeYourImageProps {
  /** Current category state from prompt builder */
  categoryState: Record<PromptCategory, CategoryState>;
  /** State setter from prompt builder — called to apply parsed terms */
  setCategoryState: React.Dispatch<React.SetStateAction<Record<PromptCategory, CategoryState>>>;
  /** Whether the prompt builder is locked (at usage limit) */
  isLocked: boolean;
  // ── AI Disguise callbacks (lifted to playground-workspace) ─────────
  /** Called on every textarea change so orchestrator can track human text */
  onTextChange?: (text: string) => void;
  /** Called when "Generate Prompt" succeeds — fires Call 2 in parallel */
  onGenerate?: (sentence: string) => void;
  /** Called when user clicks Clear — resets human text, AI tiers, AI optimise, drift */
  onClear?: () => void;
  /** Whether the current text has drifted from last generation */
  isDrifted?: boolean;
  /** Number of word-level changes detected since last generation */
  driftChangeCount?: number;
  /** Increment to trigger external clear (e.g., from footer Clear All) */
  clearSignal?: number;
}

// ============================================================================
// FORMAT DETECTION — warn users pasting pre-formatted AI prompts
// ============================================================================

type FormatDetection = { detected: false } | { detected: true; format: string; hint: string };

/**
 * Detect if input text is a pre-formatted AI prompt (Tier 1/2) rather than
 * a natural language description. T3/T4 are natural language and pass through.
 *
 * Patterns detected:
 *   T1 CLIP-Based:  (term::1.3)  or  (term:1.2)  or  term::1.5
 *   T2 Midjourney:  --ar  --stylize  --v  --s  --q  --no (at word boundary)
 *   Generic weights: multiple terms with ::number patterns
 */
function detectPromptFormat(text: string): FormatDetection {
  const trimmed = text.trim();
  if (!trimmed) return { detected: false };

  // T1 — CLIP weight syntax: (term::1.3) or term::1.3 or (term:1.2)
  const clipWeightPattern = /\([^)]+::\d+\.?\d*\)|\b\w+::\d+\.?\d*|\([^)]+:\d+\.?\d*\)/g;
  const clipMatches = trimmed.match(clipWeightPattern);
  if (clipMatches && clipMatches.length >= 2) {
    return {
      detected: true,
      format: 'CLIP-Based (Tier 1)',
      hint: 'This looks like a pre-formatted CLIP prompt with weight syntax. The generator works best with plain English descriptions.',
    };
  }

  // T2 — Midjourney flags: --ar, --stylize, --v, --s, --q, --no
  const mjFlagPattern = /--(?:ar|stylize|style|v|s|q|no|chaos|weird|tile|repeat|seed|stop|iw|niji)\b/gi;
  const mjMatches = trimmed.match(mjFlagPattern);
  if (mjMatches && mjMatches.length >= 1) {
    return {
      detected: true,
      format: 'Midjourney (Tier 2)',
      hint: 'This looks like a Midjourney prompt with parameter flags. The generator works best with plain English descriptions.',
    };
  }

  // Catch-all: excessive double-colon syntax (3+)
  const doubleColonCount = (trimmed.match(/::/g) || []).length;
  if (doubleColonCount >= 3) {
    return {
      detected: true,
      format: 'Weighted prompt format',
      hint: 'This looks like a weighted AI prompt. The generator works best with plain English descriptions — try describing what you want to see.',
    };
  }

  return { detected: false };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function DescribeYourImage({
  categoryState: _categoryState,
  setCategoryState,
  isLocked,
  onTextChange,
  onGenerate,
  onClear,
  isDrifted = false,
  driftChangeCount = 0,
  clearSignal = 0,
}: DescribeYourImageProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputText, setInputText] = useState('');
  const [hasGenerated, setHasGenerated] = useState(false);
  const [formatWarning, setFormatWarning] = useState<FormatDetection>({ detected: false });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { categories, isLoading, error, populatingCategory, convert } = useSentenceConversion();

  // ── External clear trigger (footer Clear All) ─────────────────────
  const clearSignalRef = useRef(clearSignal);
  useEffect(() => {
    if (clearSignal > 0 && clearSignal !== clearSignalRef.current) {
      clearSignalRef.current = clearSignal;
      setInputText('');
      setHasGenerated(false);
      setFormatWarning({ detected: false });
      setCategoryState(() => {
        const empty: Record<string, CategoryState> = {};
        for (const cat of ['subject','action','style','environment','composition','camera','lighting','colour','atmosphere','materials','fidelity','negative']) {
          empty[cat] = { selected: [], customValue: '' };
        }
        return empty as Record<PromptCategory, CategoryState>;
      });
      onTextChange?.('');
      onClear?.();
    }
  }, [clearSignal, setCategoryState, onTextChange, onClear]);
  // ── Toggle expand/collapse ────────────────────────────────────────
  const handleToggle = useCallback(() => {
    if (isLocked) return;
    setIsExpanded((prev) => !prev);
  }, [isLocked]);

  // Focus textarea when expanded
  useEffect(() => {
    if (isExpanded && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 300);
    }
  }, [isExpanded]);

  // ── Format detection on input change ──────────────────────────────
  useEffect(() => {
    if (inputText.trim().length > 10) {
      setFormatWarning(detectPromptFormat(inputText));
    } else {
      setFormatWarning({ detected: false });
    }
  }, [inputText]);

  // ── Generate prompt ───────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!inputText.trim() || isLoading) return;
    setHasGenerated(false);
    // Fire Call 2 in parallel via orchestrator callback (ai-disguise.md §5)
    onGenerate?.(inputText);
    // Fire Call 1 (category extraction — existing)
    await convert(inputText);
    setHasGenerated(true);
  }, [inputText, isLoading, convert, onGenerate]);

  // ── Clear all — resets textarea, categories, AI state ─────────────
  // Fix: Full cascade reset — textarea + dropdowns + AI tiers + optimizer + drift
  const handleClear = useCallback(() => {
    setInputText('');
    setHasGenerated(false);
    setFormatWarning({ detected: false });
    // Reset all 12 category dropdowns to empty
    setCategoryState(() => {
      const empty: Record<string, CategoryState> = {};
      for (const cat of ['subject','action','style','environment','composition','camera','lighting','colour','atmosphere','materials','fidelity','negative']) {
        empty[cat] = { selected: [], customValue: '' };
      }
      return empty as Record<PromptCategory, CategoryState>;
    });
    onTextChange?.('');
    onClear?.();
  }, [setCategoryState, onTextChange, onClear]);

  // ── Apply parsed categories to builder state ──────────────────────
  useEffect(() => {
    if (!categories || !hasGenerated) return;

    setCategoryState((prev) => {
      const next = { ...prev };
      for (const [cat, state] of Object.entries(categories)) {
        const key = cat as PromptCategory;
        // Only apply if the API returned content for this category
        if (state.selected.length > 0 || state.customValue) {
          next[key] = { ...state };
        }
      }
      return next;
    });
  }, [categories, hasGenerated, setCategoryState]);

  // ── Keyboard: Enter to generate ───────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleGenerate();
      }
    },
    [handleGenerate],
  );

  // ── Character counter colours ─────────────────────────────────────
  const charCount = inputText.length;
  const counterColor =
    charCount >= MAX_CHARS
      ? '#F87171' // red — at limit
      : charCount >= AMBER_THRESHOLD
        ? '#FBBF24' // amber — approaching
        : '#94A3B8'; // default

  // ── Populated categories for badges ───────────────────────────────
  const populatedCats = categories
    ? Object.entries(categories).filter(
        ([, state]) => state.selected.length > 0 || state.customValue,
      )
    : [];

  // ── Empty categories for suggestion (Fix 5) ────────────────────────
  const emptyCatLabels = categories
    ? Object.entries(CATEGORY_DISPLAY)
        .filter(([cat]) => {
          const state = (categories as Record<string, { selected: string[]; customValue: string }>)[cat];
          return !state || (state.selected.length === 0 && !state.customValue);
        })
        .map(([, display]) => display.label)
    : [];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: DESCRIBE_STYLES }} />

      <div>
        {/* ═══════════════════════ TRIGGER BAR ═══════════════════════ */}
        <button
          type="button"
          onClick={handleToggle}
          disabled={isLocked}
          aria-expanded={isExpanded}
          aria-controls="describe-your-image-panel"
          className={`
            group relative w-full overflow-hidden rounded-xl border
            text-left transition-all duration-300 ease-out
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60
            ${
              isExpanded
                ? 'border-slate-700/60 bg-slate-900/80 shadow-[0_0_20px_-6px_rgba(251,146,60,0.08)]'
                : 'border-slate-800/50 bg-slate-900/40 hover:border-slate-700/60 hover:bg-slate-900/60'
            }
            ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer'}
          `}
          style={{ padding: 'clamp(8px, 0.8vw, 12px) clamp(12px, 1vw, 16px)' }}
        >
          {/* Top accent shimmer — orange tint (distinct from Scene Starters cyan) */}
          <div
            className={`
              absolute inset-x-0 top-0 h-[1px] transition-opacity duration-500
              ${isExpanded ? 'opacity-100' : 'opacity-0 group-hover:opacity-70'}
            `}
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(251,146,60,0.35) 25%, rgba(249,115,22,0.35) 55%, rgba(245,158,11,0.25) 80%, transparent 100%)',
            }}
          />

          <div className="flex items-center justify-between">
            {/* Left: emoji + label */}
            <div className="flex items-center min-w-0" style={{ gap: 'clamp(6px, 0.6vw, 10px)' }}>
              <span
                className="shrink-0"
                style={{ fontSize: 'clamp(0.95rem, 1.05vw, 1.15rem)' }}
                aria-hidden="true"
              >
                ✍️
              </span>

              <span
                className="font-semibold text-slate-200 shrink-0"
                style={{ fontSize: 'clamp(0.72rem, 0.82vw, 0.88rem)' }}
              >
                Describe Your Image
              </span>

              <span
                className="text-orange-400/70 shrink-0"
                style={{ fontSize: 'clamp(0.625rem, 0.68vw, 0.73rem)' }}
              >
                ·&nbsp;paste any sentence
              </span>

              {/* Populated categories badges — show after generation */}
              {hasGenerated && populatedCats.length > 0 && (
                <span
                  className="dyi-cat-badge inline-flex items-center rounded-full bg-orange-500/10 ring-1 ring-orange-500/25 min-w-0"
                  style={{
                    fontSize: 'clamp(0.625rem, 0.64vw, 0.7rem)',
                    marginLeft: 'clamp(2px, 0.3vw, 6px)',
                    padding: 'clamp(1px, 0.15vw, 3px) clamp(4px, 0.3vw, 6px)',
                    gap: 'clamp(3px, 0.3vw, 6px)',
                  }}
                >
                  <span className="text-orange-300">
                    {populatedCats.length} categories populated
                  </span>
                </span>
              )}
            </div>

            {/* Right: chevron */}
            <svg
              className={`text-slate-500 shrink-0 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
              style={{ width: 'clamp(14px, 1vw, 16px)', height: 'clamp(14px, 1vw, 16px)' }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {/* ═══════════════════════ EXPANDED PANEL ═══════════════════════ */}
        <div
          id="describe-your-image-panel"
          role="region"
          aria-label="Describe your image input"
          className={`
            dyi-panel overflow-hidden transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]
            ${isExpanded ? 'opacity-100' : 'max-h-0 opacity-0 pointer-events-none'}
          `}
          style={{
            marginTop: isExpanded ? 'clamp(4px, 0.5vw, 8px)' : '0',
            maxHeight: isExpanded ? 'clamp(280px, 25vw, 380px)' : '0',
          }}
        >
          <div
            className="rounded-xl border border-slate-800/50 bg-slate-950/60 backdrop-blur-sm shadow-lg shadow-black/20"
            style={{ padding: 'clamp(12px, 1.2vw, 18px)' }}
          >
            {/* ── Textarea ──────────────────────────────────────────── */}
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => {
                  if (e.target.value.length <= MAX_CHARS) {
                    setInputText(e.target.value);
                    onTextChange?.(e.target.value);
                  }
                }}
                onKeyDown={handleKeyDown}
                placeholder="Describe the image you want to create in plain English..."
                disabled={isLoading}
                className="w-full resize-none rounded-lg border border-slate-700/50 bg-slate-900/60 text-white placeholder-slate-500 focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/30 transition-colors"
                style={{
                  padding: 'clamp(10px, 1vw, 14px)',
                  fontSize: 'clamp(0.75rem, 0.85vw, 0.95rem)',
                  lineHeight: 1.6,
                  minHeight: 'clamp(80px, 8vw, 120px)',
                  maxHeight: 'clamp(120px, 12vw, 180px)',
                }}
                rows={4}
              />

              {/* Character counter */}
              <span
                className="absolute font-mono tabular-nums"
                style={{
                  bottom: 'clamp(6px, 0.6vw, 10px)',
                  right: 'clamp(8px, 0.8vw, 12px)',
                  fontSize: 'clamp(0.625rem, 0.6vw, 0.7rem)',
                  color: counterColor,
                }}
              >
                {charCount}/{MAX_CHARS}
              </span>
            </div>

            {/* ── Format detection warning ──────────────────────────── */}
            {formatWarning.detected && (
              <div
                className="flex items-start rounded-lg border border-amber-500/30 bg-amber-950/30"
                style={{
                  marginTop: 'clamp(6px, 0.6vw, 8px)',
                  padding: 'clamp(6px, 0.6vw, 10px) clamp(8px, 0.8vw, 12px)',
                  gap: 'clamp(6px, 0.5vw, 8px)',
                }}
              >
                <span
                  className="shrink-0"
                  style={{ fontSize: 'clamp(0.8rem, 0.85vw, 0.95rem)' }}
                  aria-hidden="true"
                >⚠️</span>
                <div>
                  <span
                    className="font-semibold text-amber-300"
                    style={{ fontSize: 'clamp(0.625rem, 0.68vw, 0.75rem)' }}
                  >
                    Detected: {formatWarning.format}
                  </span>
                  <p
                    className="text-amber-200/70"
                    style={{
                      fontSize: 'clamp(0.6rem, 0.62vw, 0.7rem)',
                      marginTop: 'clamp(1px, 0.1vw, 2px)',
                      lineHeight: 1.4,
                    }}
                  >
                    {formatWarning.hint}
                  </p>
                </div>
              </div>
            )}

            {/* ── Action row: Generate button + status + close ──────── */}
            <div
              className="flex items-center justify-between"
              style={{ marginTop: 'clamp(8px, 0.8vw, 12px)' }}
            >
              <div className="flex items-center" style={{ gap: 'clamp(8px, 0.8vw, 12px)' }}>
                {/* Generate / Regenerate Prompt button — engine bay styling when text present */}
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isLoading || !inputText.trim()}
                  className={`
                    group relative inline-flex items-center overflow-hidden rounded-lg font-semibold text-white
                    transition-all duration-200
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/80
                    ${
                      isLoading
                        ? 'dyi-generating border-sky-400/40 bg-gradient-to-r from-sky-400/30 via-emerald-300/30 to-indigo-400/30'
                        : inputText.trim()
                          ? 'dyi-generate-active border-sky-400/60 bg-gradient-to-r from-sky-400/40 via-emerald-300/40 to-indigo-400/40 cursor-pointer'
                          : 'bg-slate-800/40 border-slate-700/30 cursor-not-allowed'
                    }
                  `}
                  style={{
                    padding: 'clamp(6px, 0.6vw, 10px) clamp(12px, 1.2vw, 18px)',
                    fontSize: 'clamp(0.7rem, 0.78vw, 0.85rem)',
                    border: '1px solid',
                    gap: 'clamp(4px, 0.4vw, 6px)',
                  }}
                >
                  {/* Shimmer overlay — identical to engine bay */}
                  {inputText.trim() && !isLoading && (
                    <div
                      className="dyi-generate-shimmer pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                      aria-hidden="true"
                    />
                  )}
                  {isLoading ? (
                    <span className="relative z-10 inline-flex items-center" style={{ gap: 'clamp(4px, 0.4vw, 6px)' }}>
                      <svg
                        className="animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                        style={{ width: 'clamp(14px, 1vw, 16px)', height: 'clamp(14px, 1vw, 16px)' }}
                      >
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Parsing...
                    </span>
                  ) : (
                    <span className="relative z-10 inline-flex items-center" style={{ gap: 'clamp(4px, 0.4vw, 6px)' }}>
                      <svg
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                        style={{ width: 'clamp(14px, 1vw, 16px)', height: 'clamp(14px, 1vw, 16px)' }}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      {isDrifted && driftChangeCount >= 3 && hasGenerated ? 'Regenerate' : 'Generate Prompt'}
                    </span>
                  )}
                </button>

                {/* Clear All button — purple gradient matching Dynamic/Randomise, white text */}
                {hasGenerated && !isLoading && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="inline-flex items-center rounded-full border border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 font-semibold text-white hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/80 shadow-sm"
                    style={{
                      padding: 'clamp(5px, 0.5vw, 8px) clamp(10px, 1vw, 16px)',
                      fontSize: 'clamp(0.65rem, 0.72vw, 0.8rem)',
                      gap: 'clamp(3px, 0.3vw, 5px)',
                    }}
                    title="Clear description and all generated prompts"
                  >
                    Clear All
                  </button>
                )}

                {/* Currently populating indicator */}
                {isLoading && populatingCategory && (
                  <span
                    className="dyi-cat-badge inline-flex items-center"
                    style={{
                      fontSize: 'clamp(0.625rem, 0.65vw, 0.75rem)',
                      color: CATEGORY_DISPLAY[populatingCategory]?.color ?? '#fb923c',
                      gap: 'clamp(3px, 0.3vw, 5px)',
                    }}
                  >
                    <span>{CATEGORY_DISPLAY[populatingCategory]?.emoji}</span>
                    <span>{CATEGORY_DISPLAY[populatingCategory]?.label}</span>
                  </span>
                )}

                {/* Error message */}
                {error && (
                  <span
                    className="text-red-400"
                    style={{ fontSize: 'clamp(0.625rem, 0.65vw, 0.75rem)' }}
                  >
                    {error}
                  </span>
                )}

                {/* Ctrl+Enter hint */}
                {!isLoading && inputText.trim() && (
                  <span
                    className="text-slate-500"
                    style={{ fontSize: 'clamp(0.625rem, 0.6vw, 0.7rem)' }}
                  >
                    Ctrl+Enter
                  </span>
                )}

                {/* Drift indicator — §4 Zeigarnik Effect: nags user to regenerate */}
                {!isLoading && hasGenerated && (
                  <DriftIndicator
                    isDrifted={isDrifted}
                    changeCount={driftChangeCount}
                  />
                )}
              </div>

              {/* Close button */}
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                style={{
                  padding: 'clamp(4px, 0.4vw, 6px)',
                  fontSize: 'clamp(0.625rem, 0.65vw, 0.75rem)',
                }}
              >
                Close
              </button>
            </div>

            {/* ── Empty categories suggestion (Fix 5) ──────────────── */}
            {hasGenerated && emptyCatLabels.length > 0 && emptyCatLabels.length <= 5 && (
              <div
                className="flex items-start rounded-lg border border-sky-500/20 bg-sky-950/20"
                style={{
                  marginTop: 'clamp(6px, 0.6vw, 8px)',
                  padding: 'clamp(5px, 0.5vw, 8px) clamp(8px, 0.8vw, 12px)',
                  gap: 'clamp(5px, 0.4vw, 7px)',
                }}
              >
                <span
                  className="shrink-0"
                  style={{ fontSize: 'clamp(0.75rem, 0.8vw, 0.9rem)' }}
                  aria-hidden="true"
                >💡</span>
                <span
                  className="text-sky-300/80"
                  style={{ fontSize: 'clamp(0.58rem, 0.62vw, 0.7rem)', lineHeight: 1.4 }}
                >
                  {emptyCatLabels.length} empty: {emptyCatLabels.join(', ')}
                  <span className="text-sky-400/50"> — add detail to these to boost your DNA score</span>
                </span>
              </div>
            )}

            {/* Fix 4: Hint — tell user they can edit and regenerate */}
            {hasGenerated && !isLoading && !isDrifted && (
              <p
                style={{
                  marginTop: 'clamp(4px, 0.4vw, 6px)',
                  fontSize: 'clamp(0.56rem, 0.58vw, 0.65rem)',
                  lineHeight: 1.4,
                  color: '#94A3B8',
                }}
              >
                Edit your description above and click Regenerate to refine your prompts
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default DescribeYourImage;
