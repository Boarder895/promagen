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

"use client";

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import type { PromptCategory, CategoryState } from "@/types/prompt-builder";
import { CATEGORY_ORDER } from "@/types/prompt-builder";
import { useSentenceConversion } from "@/hooks/use-sentence-conversion";
import { DriftIndicator } from "@/components/prompt-lab/drift-indicator";
import type { CoverageAssessment } from "@/types/category-assessment";
import {
  CATEGORY_COLOURS,
  CATEGORY_LABELS,
  CATEGORY_EMOJIS,
  parsePromptIntoSegments,
} from "@/lib/prompt-colours";
import {
  loadCategoryVocabulary,
  type CategoryKey,
} from "@/lib/vocabulary/vocabulary-loader";

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_CHARS = 1000;
const AMBER_THRESHOLD = 750;
const RED_THRESHOLD = 920;

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

  /* ── Category cycling animation during analysis ──────────── */
  @keyframes dyi-cycle-pop {
    0% { opacity: 0; transform: scale(0.85); }
    20% { opacity: 1; transform: scale(1.05); }
    100% { opacity: 1; transform: scale(1); }
  }
  .dyi-cycle-badge {
    animation: dyi-cycle-pop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }

  /* ── Coverage pill hover hint popover ───────────────────── */
  @keyframes dyi-hint-enter {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .dyi-hint-popover {
    animation: dyi-hint-enter 0.2s ease-out both;
  }

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

const CATEGORY_DISPLAY: Record<
  string,
  { emoji: string; label: string; color: string }
> = {
  subject: { emoji: "👤", label: "Subject", color: "#FCD34D" },
  action: { emoji: "🏃", label: "Action", color: "#A3E635" },
  style: { emoji: "🎨", label: "Style", color: "#C084FC" },
  environment: { emoji: "🌍", label: "Environment", color: "#38BDF8" },
  composition: { emoji: "📐", label: "Composition", color: "#34D399" },
  camera: { emoji: "📷", label: "Camera", color: "#FB923C" },
  lighting: { emoji: "💡", label: "Lighting", color: "#FBBF24" },
  colour: { emoji: "🎨", label: "Colour", color: "#F472B6" },
  atmosphere: { emoji: "🌫️", label: "Atmosphere", color: "#22D3EE" },
  materials: { emoji: "🧱", label: "Materials", color: "#2DD4BF" },
  fidelity: { emoji: "✨", label: "Fidelity", color: "#93C5FD" },
  negative: { emoji: "🚫", label: "Negative", color: "#F87171" },
};

// ============================================================================
// TYPES
// ============================================================================

export interface DescribeYourImageProps {
  /** Current category state from prompt builder */
  categoryState: Record<PromptCategory, CategoryState>;
  /** State setter from prompt builder — called to apply parsed terms */
  setCategoryState: React.Dispatch<
    React.SetStateAction<Record<PromptCategory, CategoryState>>
  >;
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
  /**
   * When true, handleGenerate calls ONLY onGenerate() and skips the internal
   * useSentenceConversion convert() call. Used by Prompt Lab v4 where the
   * orchestrator fires Call 1 (assess mode) instead of the old Call 1 (extract).
   * Default: false (standard builder behaviour unchanged).
   */
  skipInternalParse?: boolean;
  /** Whether the external assessment/generation is in progress (disables Generate button) */
  externalLoading?: boolean;
  // ── Coverage data from Call 1 (matched phrases for text colouring) ──
  /** Coverage assessment with matched phrases per category */
  coverageData?: CoverageAssessment | null;
  /** When true, the entire component is hidden (mutual exclusion with SceneSelector) */
  hidden?: boolean;
  /** Called when expand state changes (for parent coordination) */
  onExpandChange?: (expanded: boolean) => void;
  /** When true, the panel starts expanded on mount. Default: false (standard builder). */
  defaultExpanded?: boolean;
}

// ============================================================================
// FORMAT DETECTION — warn users pasting pre-formatted AI prompts
// ============================================================================

type FormatDetection =
  | { detected: false }
  | { detected: true; format: string; hint: string };

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
  const clipWeightPattern =
    /\([^)]+::\d+\.?\d*\)|\b\w+::\d+\.?\d*|\([^)]+:\d+\.?\d*\)/g;
  const clipMatches = trimmed.match(clipWeightPattern);
  if (clipMatches && clipMatches.length >= 2) {
    return {
      detected: true,
      format: "CLIP-Based (Tier 1)",
      hint: "This looks like a pre-formatted CLIP prompt with weight syntax. The generator works best with plain English descriptions.",
    };
  }

  // T2 — Midjourney flags: --ar, --stylize, --v, --s, --q, --no
  const mjFlagPattern =
    /--(?:ar|stylize|style|v|s|q|no|chaos|weird|tile|repeat|seed|stop|iw|niji)\b/gi;
  const mjMatches = trimmed.match(mjFlagPattern);
  if (mjMatches && mjMatches.length >= 1) {
    return {
      detected: true,
      format: "Midjourney (Tier 2)",
      hint: "This looks like a Midjourney prompt with parameter flags. The generator works best with plain English descriptions.",
    };
  }

  // Catch-all: excessive double-colon syntax (3+)
  const doubleColonCount = (trimmed.match(/::/g) || []).length;
  if (doubleColonCount >= 3) {
    return {
      detected: true,
      format: "Weighted prompt format",
      hint: "This looks like a weighted AI prompt. The generator works best with plain English descriptions — try describing what you want to see.",
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
  skipInternalParse = false,
  externalLoading = false,
  coverageData = null,
  hidden = false,
  onExpandChange,
  defaultExpanded = false,
}: DescribeYourImageProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [inputText, setInputText] = useState("");
  const [hasGenerated, setHasGenerated] = useState(false);
  const [formatWarning, setFormatWarning] = useState<FormatDetection>({
    detected: false,
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { categories, isLoading, error, populatingCategory, convert } =
    useSentenceConversion();

  // ── Category cycling animation during analysis ──────────────────
  const [cyclingIndex, setCyclingIndex] = useState(-1);
  const cycleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (externalLoading) {
      setCyclingIndex(0);
      let idx = 0;
      cycleTimerRef.current = setInterval(() => {
        idx = (idx + 1) % CATEGORY_ORDER.length;
        setCyclingIndex(idx);
      }, 150);
    } else {
      if (cycleTimerRef.current) {
        clearInterval(cycleTimerRef.current);
        cycleTimerRef.current = null;
      }
      setCyclingIndex(-1);
    }
    return () => {
      if (cycleTimerRef.current) clearInterval(cycleTimerRef.current);
    };
  }, [externalLoading]);

  // ── Build termIndex from coverageData matched phrases ──────────
  const termIndex = useMemo(() => {
    if (!coverageData) return new Map<string, PromptCategory>();
    const index = new Map<string, PromptCategory>();
    for (const [cat, data] of Object.entries(coverageData.coverage)) {
      if (data.matchedPhrases) {
        for (const phrase of data.matchedPhrases) {
          const key = phrase.toLowerCase().trim();
          if (key) index.set(key, cat as PromptCategory);
        }
      }
    }
    return index;
  }, [coverageData]);

  // ── Hover hint state for uncovered category pills ──────────────
  const [hoveredCategory, setHoveredCategory] = useState<PromptCategory | null>(
    null,
  );
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Get 6 example terms for a category from the vocabulary */
  const getHintTerms = useCallback((category: PromptCategory): string[] => {
    try {
      const vocab = loadCategoryVocabulary(category as CategoryKey);
      // Take top dropdown options, shuffle lightly, return 6
      const opts = vocab.dropdownOptions.slice(0, 30);
      const shuffled = [...opts].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, 6);
    } catch {
      return [];
    }
  }, []);

  const handlePillHover = useCallback((cat: PromptCategory) => {
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    setHoveredCategory(cat);
  }, []);

  const handlePillLeave = useCallback(() => {
    hintTimerRef.current = setTimeout(() => setHoveredCategory(null), 400);
  }, []);

  // ── External clear trigger (footer Clear All) ─────────────────────
  const clearSignalRef = useRef(clearSignal);
  useEffect(() => {
    if (clearSignal > 0 && clearSignal !== clearSignalRef.current) {
      clearSignalRef.current = clearSignal;
      setInputText("");
      setHasGenerated(false);
      setFormatWarning({ detected: false });
      setCategoryState(() => {
        const empty: Record<string, CategoryState> = {};
        for (const cat of [
          "subject",
          "action",
          "style",
          "environment",
          "composition",
          "camera",
          "lighting",
          "colour",
          "atmosphere",
          "materials",
          "fidelity",
          "negative",
        ]) {
          empty[cat] = { selected: [], customValue: "" };
        }
        return empty as Record<PromptCategory, CategoryState>;
      });
      onTextChange?.("");
      onClear?.();
    }
  }, [clearSignal, setCategoryState, onTextChange, onClear]);
  // ── Toggle expand/collapse ────────────────────────────────────────
  // Both setState calls are in the same event handler — React 18 batches
  // them into a single render. onExpandChange must NOT be inside the
  // setIsExpanded updater (that runs during render → React error).
  const handleToggle = useCallback(() => {
    if (isLocked) return;
    const next = !isExpanded;
    setIsExpanded(next);
    onExpandChange?.(next);
  }, [isLocked, isExpanded, onExpandChange]);

  // Focus textarea when expanded
  useEffect(() => {
    if (isExpanded && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 300);
    }
  }, [isExpanded]);

  // ── Auto-resize textarea to fit content (no scroll) ──────────────
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    // Reset to auto so shrinking works when text is deleted
    el.style.height = "auto";
    // Set to scrollHeight — the full content height
    el.style.height = `${el.scrollHeight}px`;
  }, [inputText]);

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
    if (!inputText.trim() || isLoading || externalLoading) return;

    // v4 mode: orchestrator handles Call 1 (assess). We just notify.
    if (skipInternalParse) {
      onGenerate?.(inputText);
      return;
    }

    // Standard builder mode: fire Call 1 (extract) + Call 2 in parallel
    setHasGenerated(false);
    // Fire Call 2 in parallel via orchestrator callback (ai-disguise.md §5)
    onGenerate?.(inputText);
    // Fire Call 1 (category extraction — existing)
    await convert(inputText);
    setHasGenerated(true);
  }, [
    inputText,
    isLoading,
    externalLoading,
    skipInternalParse,
    convert,
    onGenerate,
  ]);

  // ── Clear all — resets textarea, categories, AI state ─────────────
  // Fix: Full cascade reset — textarea + dropdowns + AI tiers + optimizer + drift
  const _handleClear = useCallback(() => {
    setInputText("");
    setHasGenerated(false);
    setFormatWarning({ detected: false });
    // Reset all 12 category dropdowns to empty
    setCategoryState(() => {
      const empty: Record<string, CategoryState> = {};
      for (const cat of [
        "subject",
        "action",
        "style",
        "environment",
        "composition",
        "camera",
        "lighting",
        "colour",
        "atmosphere",
        "materials",
        "fidelity",
        "negative",
      ]) {
        empty[cat] = { selected: [], customValue: "" };
      }
      return empty as Record<PromptCategory, CategoryState>;
    });
    onTextChange?.("");
    onClear?.();
  }, [setCategoryState, onTextChange, onClear]);

  // ── Mark generated when coverageData arrives (Prompt Lab path) ────
  useEffect(() => {
    if (coverageData && !hasGenerated) {
      setHasGenerated(true);
    }
  }, [coverageData, hasGenerated]);

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
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleGenerate();
      }
    },
    [handleGenerate],
  );

  // ── Character counter colours ─────────────────────────────────────
  const charCount = inputText.length;
  const counterColor =
    charCount >= RED_THRESHOLD
      ? "#F87171" // red — approaching limit
      : charCount >= AMBER_THRESHOLD
        ? "#FBBF24" // amber — getting long
        : "#34D399"; // bright green — good

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
          const state = (
            categories as Record<
              string,
              { selected: string[]; customValue: string }
            >
          )[cat];
          return !state || (state.selected.length === 0 && !state.customValue);
        })
        .map(([, display]) => display.label)
    : [];

  return (
    <div style={{ display: hidden ? "none" : undefined }}>
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
                ? "border-slate-700/60 bg-slate-900/80 shadow-[0_0_20px_-6px_rgba(251,146,60,0.08)]"
                : "border-slate-800/50 bg-slate-900/40 hover:border-slate-700/60 hover:bg-slate-900/60"
            }
            ${isLocked ? "cursor-not-allowed" : "cursor-pointer"}
          `}
          style={{ padding: "clamp(8px, 0.8vw, 12px) clamp(12px, 1vw, 16px)" }}
        >
          {/* Top accent shimmer — orange tint (distinct from Scene Starters cyan) */}
          <div
            className={`
              absolute inset-x-0 top-0 h-[1px] transition-opacity duration-500
              ${isExpanded ? "opacity-100" : "opacity-0 group-hover:opacity-70"}
            `}
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(251,146,60,0.35) 25%, rgba(249,115,22,0.35) 55%, rgba(245,158,11,0.25) 80%, transparent 100%)",
            }}
          />

          <div className="flex items-center justify-between">
            {/* Left: emoji + label */}
            <div
              className="flex items-center min-w-0"
              style={{ gap: "clamp(6px, 0.6vw, 10px)" }}
            >
              <span
                className="shrink-0"
                style={{ fontSize: "clamp(0.95rem, 1.05vw, 1.15rem)" }}
                aria-hidden="true"
              >
                ✍️
              </span>

              <span
                className="font-semibold text-slate-200 shrink-0"
                style={{ fontSize: "clamp(0.72rem, 0.82vw, 0.88rem)" }}
              >
                Describe Your Image
              </span>

              <span
                className="text-orange-400 shrink-0"
                style={{ fontSize: "clamp(0.625rem, 0.68vw, 0.73rem)" }}
              >
                ·&nbsp;paste any sentence
              </span>

              {/* Populated categories badges — show after generation */}
              {hasGenerated && populatedCats.length > 0 && (
                <span
                  className="dyi-cat-badge inline-flex items-center rounded-full bg-orange-500/10 ring-1 ring-orange-500/25 min-w-0"
                  style={{
                    fontSize: "clamp(0.625rem, 0.64vw, 0.7rem)",
                    marginLeft: "clamp(2px, 0.3vw, 6px)",
                    padding: "clamp(1px, 0.15vw, 3px) clamp(4px, 0.3vw, 6px)",
                    gap: "clamp(3px, 0.3vw, 6px)",
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
              className={`text-slate-300 shrink-0 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
              style={{
                width: "clamp(14px, 1vw, 16px)",
                height: "clamp(14px, 1vw, 16px)",
              }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </button>

        {/* ═══════════════════════ EXPANDED PANEL ═══════════════════════ */}
        <div
          id="describe-your-image-panel"
          role="region"
          aria-label="Describe your image input"
          className={`
            dyi-panel transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]
            ${isExpanded ? "opacity-100" : "max-h-0 opacity-0 pointer-events-none overflow-hidden"}
          `}
          style={{
            marginTop: isExpanded ? "clamp(4px, 0.5vw, 8px)" : "0",
            maxHeight: isExpanded ? "none" : "0",
            overflow: isExpanded ? "visible" : "hidden",
          }}
        >
          <div
            className="rounded-xl border border-slate-800/50 bg-slate-950/60 backdrop-blur-sm shadow-lg shadow-black/20"
            style={{ padding: "clamp(12px, 1.2vw, 18px)" }}
          >
            {/* ── Textarea with colour overlay ────────────────────── */}
            <div className="relative">
              {/* Colour overlay — renders behind transparent textarea */}
              {coverageData && termIndex.size > 0 && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg border border-transparent"
                  style={{
                    padding: "clamp(10px, 1vw, 14px)",
                    fontSize: "clamp(0.75rem, 0.85vw, 0.95rem)",
                    lineHeight: 1.6,
                    fontFamily: "inherit",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    overflowWrap: "break-word",
                  }}
                >
                  {parsePromptIntoSegments(inputText, termIndex).map(
                    (seg, i) => (
                      <span
                        key={i}
                        style={{
                          color:
                            seg.category === "structural"
                              ? CATEGORY_COLOURS.structural
                              : (CATEGORY_COLOURS[seg.category] ??
                                CATEGORY_COLOURS.structural),
                        }}
                      >
                        {seg.text}
                      </span>
                    ),
                  )}
                </div>
              )}
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => {
                  const val =
                    e.target.value.length > MAX_CHARS
                      ? e.target.value.slice(0, MAX_CHARS)
                      : e.target.value;
                  setInputText(val);
                  onTextChange?.(val);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Describe the image you want to create in plain English..."
                disabled={isLoading}
                className="w-full resize-none rounded-lg border border-slate-700/50 bg-slate-900/60 placeholder-slate-500 focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/30 transition-colors"
                style={{
                  padding: "clamp(10px, 1vw, 14px)",
                  fontSize: "clamp(0.75rem, 0.85vw, 0.95rem)",
                  lineHeight: 1.6,
                  minHeight: "clamp(80px, 8vw, 120px)",
                  overflow: "hidden",
                  // When coverage exists, text goes transparent so overlay shows through
                  color:
                    coverageData && termIndex.size > 0 ? "transparent" : "#fff",
                  caretColor: "#fff",
                  // Ensure identical rendering to overlay
                  fontFamily: "inherit",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  overflowWrap: "break-word",
                  background: "rgba(15, 23, 42, 0.6)",
                }}
                rows={4}
              />

              {/* Character counter */}
              <span
                className="absolute font-mono tabular-nums font-semibold"
                style={{
                  bottom: "clamp(6px, 0.6vw, 10px)",
                  right: "clamp(8px, 0.8vw, 12px)",
                  fontSize: "clamp(0.72rem, 0.72vw, 0.82rem)",
                  color: counterColor,
                }}
              >
                {charCount}/{MAX_CHARS}
              </span>
            </div>

            {/* ── Coverage category pills — 12 pills below textarea ──── */}
            {coverageData && (
              <div
                className="flex flex-wrap"
                style={{
                  marginTop: "clamp(6px, 0.6vw, 8px)",
                  gap: "clamp(4px, 0.4vw, 6px)",
                }}
              >
                {CATEGORY_ORDER.map((cat, catIndex) => {
                  const cov = coverageData.coverage[cat];
                  const isCovered = cov?.covered ?? false;
                  const colour = CATEGORY_COLOURS[cat] ?? "#94A3B8";
                  const label = CATEGORY_LABELS[cat] ?? cat;
                  const emoji = CATEGORY_EMOJIS[cat] ?? "";
                  const isHovered = hoveredCategory === cat;

                  // Tooltip alignment: first 4 → right, middle 4 → centre, last 4 → left
                  const tooltipAlign =
                    catIndex < 4 ? "left" : catIndex < 8 ? "center" : "right";

                  return (
                    <div key={cat} className="relative">
                      <span
                        onMouseEnter={() => !isCovered && handlePillHover(cat)}
                        onMouseLeave={handlePillLeave}
                        className="inline-flex items-center rounded-full transition-all"
                        style={{
                          padding:
                            "clamp(3px, 0.3vw, 5px) clamp(8px, 0.65vw, 11px)",
                          fontSize: "clamp(0.68rem, 0.74vw, 0.84rem)",
                          gap: "clamp(3px, 0.25vw, 5px)",
                          border: `1px solid ${isCovered ? colour + "80" : colour + "50"}`,
                          background: isCovered ? colour + "18" : colour + "08",
                          color: isCovered ? colour : colour,
                          cursor: isCovered ? "default" : "pointer",
                        }}
                      >
                        {/* Green tick for covered categories — pulse glow matches mission control */}
                        {isCovered && (
                          <svg
                            viewBox="0 0 16 16"
                            fill="none"
                            className="animate-pulse"
                            style={{
                              width: "clamp(14px, 1.2vw, 18px)",
                              height: "clamp(14px, 1.2vw, 18px)",
                              flexShrink: 0,
                              filter:
                                "drop-shadow(0 0 3px rgba(16, 185, 129, 0.6))",
                            }}
                          >
                            <circle
                              cx="8"
                              cy="8"
                              r="7"
                              fill="#10B981"
                              opacity="0.3"
                            />
                            <path
                              d="M5 8.5L7 10.5L11 6"
                              stroke="#34D399"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                        <span>{emoji}</span>
                        <span>{label}</span>
                      </span>

                      {/* Hover hint popover — uncovered categories only */}
                      {isHovered && !isCovered && (
                        <div
                          className="dyi-hint-popover absolute rounded-xl border border-slate-600 bg-slate-900/95 shadow-2xl backdrop-blur-sm"
                          style={{
                            top: "calc(100% + 6px)",
                            ...(tooltipAlign === "left" ? { left: 0 } : {}),
                            ...(tooltipAlign === "center"
                              ? { left: "50%", transform: "translateX(-50%)" }
                              : {}),
                            ...(tooltipAlign === "right" ? { right: 0 } : {}),
                            minWidth: "clamp(220px, 20vw, 320px)",
                            padding: "clamp(10px, 1vw, 16px)",
                            zIndex: 9999,
                          }}
                          onMouseEnter={() => {
                            if (hintTimerRef.current)
                              clearTimeout(hintTimerRef.current);
                          }}
                          onMouseLeave={handlePillLeave}
                        >
                          <p
                            className="font-medium text-white"
                            style={{
                              fontSize: "clamp(0.75rem, 0.85vw, 0.95rem)",
                              marginBottom: "clamp(6px, 0.5vw, 10px)",
                            }}
                          >
                            {emoji} {label} — try adding:
                          </p>
                          <div
                            className="flex flex-wrap"
                            style={{ gap: "clamp(4px, 0.4vw, 6px)" }}
                          >
                            {getHintTerms(cat).map((term, i) => (
                              <span
                                key={i}
                                className="inline-block rounded-md"
                                style={{
                                  padding:
                                    "clamp(2px, 0.2vw, 4px) clamp(6px, 0.5vw, 10px)",
                                  fontSize: "clamp(0.7rem, 0.78vw, 0.88rem)",
                                  border: `1px solid ${colour}40`,
                                  color: colour,
                                  background: colour + "12",
                                }}
                              >
                                {term}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Format detection warning ──────────────────────────── */}
            {formatWarning.detected && (
              <div
                className="flex items-start rounded-lg border border-amber-500/30 bg-amber-950/30"
                style={{
                  marginTop: "clamp(6px, 0.6vw, 8px)",
                  padding: "clamp(6px, 0.6vw, 10px) clamp(8px, 0.8vw, 12px)",
                  gap: "clamp(6px, 0.5vw, 8px)",
                }}
              >
                <span
                  className="shrink-0"
                  style={{ fontSize: "clamp(0.8rem, 0.85vw, 0.95rem)" }}
                  aria-hidden="true"
                >
                  ⚠️
                </span>
                <div>
                  <span
                    className="font-semibold text-amber-300"
                    style={{ fontSize: "clamp(0.625rem, 0.68vw, 0.75rem)" }}
                  >
                    Detected: {formatWarning.format}
                  </span>
                  <p
                    className="text-amber-200/70"
                    style={{
                      fontSize: "clamp(0.6rem, 0.62vw, 0.7rem)",
                      marginTop: "clamp(1px, 0.1vw, 2px)",
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
              style={{ marginTop: "clamp(20px, 2vw, 32px)" }}
            >
              <div
                className="flex items-center"
                style={{ gap: "clamp(8px, 0.8vw, 12px)" }}
              >
                {/* Generate / Regenerate Prompt button — engine bay styling when text present */}
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isLoading || externalLoading || !inputText.trim()}
                  className={`
                    group relative inline-flex items-center overflow-hidden rounded-lg font-semibold text-white
                    transition-all duration-200
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/80
                    ${
                      isLoading || externalLoading
                        ? "dyi-generating border-sky-400/40 bg-gradient-to-r from-sky-400/30 via-emerald-300/30 to-indigo-400/30"
                        : inputText.trim()
                          ? "dyi-generate-active border-sky-400/60 bg-gradient-to-r from-sky-400/40 via-emerald-300/40 to-indigo-400/40 cursor-pointer"
                          : "bg-slate-800/40 border-slate-700/30 cursor-not-allowed"
                    }
                  `}
                  style={{
                    padding: "clamp(6px, 0.6vw, 10px) clamp(12px, 1.2vw, 18px)",
                    fontSize: "clamp(0.7rem, 0.78vw, 0.85rem)",
                    border: "1px solid",
                    gap: "clamp(4px, 0.4vw, 6px)",
                  }}
                >
                  {/* Shimmer overlay — identical to engine bay */}
                  {inputText.trim() && !isLoading && !externalLoading && (
                    <div
                      className="dyi-generate-shimmer pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                      aria-hidden="true"
                    />
                  )}
                  {isLoading || externalLoading ? (
                    <span
                      className="relative z-10 inline-flex items-center"
                      style={{ gap: "clamp(4px, 0.4vw, 6px)" }}
                    >
                      <svg
                        className="animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                        style={{
                          width: "clamp(14px, 1vw, 16px)",
                          height: "clamp(14px, 1vw, 16px)",
                        }}
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth={4}
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      {externalLoading ? "Analysing..." : "Parsing..."}
                    </span>
                  ) : (
                    <span
                      className="relative z-10 inline-flex items-center"
                      style={{ gap: "clamp(4px, 0.4vw, 6px)" }}
                    >
                      <svg
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                        style={{
                          width: "clamp(14px, 1vw, 16px)",
                          height: "clamp(14px, 1vw, 16px)",
                        }}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                      {isDrifted && driftChangeCount >= 3 && hasGenerated
                        ? "Regenerate"
                        : "Generate Prompt"}
                    </span>
                  )}
                </button>

                {/* Category cycling badge — shows during analysis */}
                {externalLoading &&
                  cyclingIndex >= 0 &&
                  cyclingIndex < CATEGORY_ORDER.length &&
                  (() => {
                    const cyclingCat = CATEGORY_ORDER[cyclingIndex];
                    if (!cyclingCat) return null;
                    const display = CATEGORY_DISPLAY[cyclingCat];
                    return (
                      <span
                        key={cyclingIndex}
                        className="dyi-cycle-badge inline-flex items-center"
                        style={{
                          fontSize: "clamp(0.625rem, 0.65vw, 0.75rem)",
                          color: display?.color ?? "#fb923c",
                          gap: "clamp(3px, 0.3vw, 5px)",
                        }}
                      >
                        <span>{display?.emoji}</span>
                        <span>{display?.label}</span>
                      </span>
                    );
                  })()}

                {/* Standard builder: populating indicator (extract mode) */}
                {isLoading && !externalLoading && populatingCategory && (
                  <span
                    className="dyi-cat-badge inline-flex items-center"
                    style={{
                      fontSize: "clamp(0.625rem, 0.65vw, 0.75rem)",
                      color:
                        CATEGORY_DISPLAY[populatingCategory]?.color ??
                        "#fb923c",
                      gap: "clamp(3px, 0.3vw, 5px)",
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
                    style={{ fontSize: "clamp(0.625rem, 0.65vw, 0.75rem)" }}
                  >
                    {error}
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
                onClick={() => {
                  setIsExpanded(false);
                  onExpandChange?.(false);
                }}
                className="text-slate-300 hover:text-white transition-colors cursor-pointer"
                style={{
                  padding: "clamp(4px, 0.4vw, 6px)",
                  fontSize: "clamp(0.625rem, 0.65vw, 0.75rem)",
                }}
              >
                Close
              </button>
            </div>

            {/* ── Empty categories suggestion (Fix 5) ──────────────── */}
            {hasGenerated &&
              emptyCatLabels.length > 0 &&
              emptyCatLabels.length <= 5 && (
                <div
                  className="flex items-start rounded-lg border border-sky-500/20 bg-sky-950/20"
                  style={{
                    marginTop: "clamp(6px, 0.6vw, 8px)",
                    padding: "clamp(5px, 0.5vw, 8px) clamp(8px, 0.8vw, 12px)",
                    gap: "clamp(5px, 0.4vw, 7px)",
                  }}
                >
                  <span
                    className="shrink-0"
                    style={{ fontSize: "clamp(0.75rem, 0.8vw, 0.9rem)" }}
                    aria-hidden="true"
                  >
                    💡
                  </span>
                  <span
                    className="text-sky-300/80"
                    style={{
                      fontSize: "clamp(0.58rem, 0.62vw, 0.7rem)",
                      lineHeight: 1.4,
                    }}
                  >
                    {emptyCatLabels.length} empty: {emptyCatLabels.join(", ")}
                    <span className="text-sky-400/50">
                      {" "}
                      — add detail to these to boost your DNA score
                    </span>
                  </span>
                </div>
              )}

            {/* Fix 4: Hint — match mission control amber animated text */}
            {hasGenerated && !isLoading && !isDrifted && (
              <p
                className="italic animate-pulse"
                style={{
                  marginTop: "clamp(20px, 2vw, 32px)",
                  marginBottom: "clamp(12px, 1.2vw, 20px)",
                  fontSize: "clamp(0.65rem, 0.75vw, 1rem)",
                  lineHeight: 1.4,
                  color: "rgb(251 191 36 / 0.8)",
                }}
              >
                Edit your description above and click Regenerate to refine your
                prompts
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DescribeYourImage;
