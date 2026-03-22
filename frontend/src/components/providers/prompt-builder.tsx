// src/components/providers/prompt-builder.tsx
// ============================================================================
// ENHANCED PROMPT BUILDER v8.5.0 — Dropdown Population + Inspired By Badge
// ============================================================================
// NEW in v8.5.0:
// - §4.5: "Try in" from homepage populates REAL DROPDOWNS (not just raw text)
// - Reads sessionStorage('promagen:preloaded-selections') → applies to categoryState
// - Same pattern as scene preload — assemblePrompt() generates correct tier output
// - User can modify any dropdown and prompt updates naturally
// - §4.5 #2: "Inspired by" badge shows weather context (city, venue, conditions)
// - Badge links back to homepage; dismissed on "Clear all"
// - Replaces old raw-text preload (preloadedPrompt state removed)
//
// NEW in v8.4.0:
// - §4.5: Pre-loaded prompt from homepage "Try in" icons
// - Reads sessionStorage('promagen:preloaded-prompt') on mount
// - Displays weather-generated prompt in assembled output area
// - Shows info banner: "Prompt loaded from homepage — edit below or copy directly"
// - Dropdowns stay empty — user can modify via dropdowns or copy directly
// - Clears preloaded prompt when user starts building their own
// - Copy button works with preloaded prompt (no selections needed)
//
// NEW in v8.3.0:
// - Scene pre-load from homepage: reads sessionStorage('promagen:preloaded-scene')
// - On mount, looks up scene via getSceneById, applies prefills (tier-aware)
// - Same logic as SceneSelector handleSceneSelection (Tier 4 reduced prefills)
// - Authority: docs/authority/homepage.md §5.4
//
// CRITICAL FIX in v8.2.0:
// - Single-select dropdowns close IMMEDIATELY on click (before state update)
// - Prevents double-click race condition with ref guard
// - Proper singular/plural grammar in tooltips ("Pick 1 style" not "styles")
//
// NEW in v8.1.0:
// - Dynamic tooltip guidance: Shows actual limit per platform tier
// - "Pick 1 style" for Tier 4, "Pick up to 3 complementary styles" for Tier 2
// - Tooltips always match actual maxSelections (no more mismatch)
// - Category-specific guidance suffixes maintained
//
// NEW in v8.0.0:
// - Platform-aware category limits: Different platforms get different selection counts
// - Tier 1 (CLIP): High multi-select tolerance (Stability, Leonardo, NightCafe)
// - Tier 2 (MJ): Very high tolerance (Midjourney, BlueWillow) - style:3, lighting:3
// - Tier 3 (NatLang): Medium tolerance (DALL-E, Firefly, Ideogram)
// - Tier 4 (Plain): Low tolerance (Canva, Craiyon) - most categories: 1
// - Paid users get +1 on stackable categories (style, lighting, colour, etc.)
// - Silent auto-trim when switching platforms (excess selections removed)
// - Platform tier passed to usePromagenAuth for dynamic limits
//
// FIXES in v7.1.1:
// - Fixed optimized preview visibility: now shows when ANY change occurs
//   (compression OR trimming), not just when categories are trimmed
// - Condition changed from wasTrimmed to length comparison
//
// FIXES in v7.1.0:
// - Shows optimized prompt text in preview box (same styling as Assembled prompt)
// - Layout: Info bar → Optimized preview → Length indicator
// - Button styling matches Dynamic toggle exactly
//
// NEW in v7.0.0:
// - Text Length Optimizer toggle (right of Static/Dynamic, with divider)
// - Live length indicator in preview area
// - Platform-specific optimization on copy
// - Category suggestions when prompt is under minimum
// - Optimizer always starts OFF, no persistence
// - Disabled (Core Colours at full opacity) when Static mode ON
//
// Previous Features Preserved:
// - Aspect Ratio selector (13th row)
// - Composition Mode toggle (Static vs Dynamic)
// - Dynamic mode indicator in header
// - Context-aware composition pack assembly
// - Anonymous users get 5 free prompts, then must sign in
// - Free authenticated users get 10/day
// - Paid users get unlimited + enhanced category limits
// - Lock states with purple-pink gradient (matches brand)
// - 🎲 Randomise button fills ALL categories including AR and negative
// - Clear all button styled with Core Colours gradient
// - Conditional free text for negative based on platform support
//
// Authority: docs/authority/paid_tier.md, docs/authority/prompt-builder-page.md
// ============================================================================

"use client";

import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from "react";
import { SignInButton } from "@clerk/nextjs";
import {
  trackPromptBuilderOpen,
  trackPromptCopy,
} from "@/lib/analytics/providers";
import { sendPromptTelemetry } from "@/lib/telemetry/prompt-telemetry-client";
import FeedbackInvitation from "@/components/ux/feedback-invitation";
import FeedbackMemoryBanner from "@/components/ux/feedback-memory-banner";
import {
  storeFeedbackPending,
  readFeedbackPending,
  isDismissedRecently,
} from "@/lib/feedback/feedback-client";
import type { FeedbackPendingData } from "@/lib/feedback/feedback-client";
import { useFeedbackMemory } from "@/hooks/use-feedback-memory";
import type { FeedbackRating } from "@/types/feedback";
import {
  assemblePrompt,
  assembleStatic,
  formatPromptForCopy,
  getEnhancedCategoryConfig,
  getAllCategories,
  supportsNativeNegative,
  getCategoryChips,
} from "@/lib/prompt-builder";
import {
  assembleCompositionPack,
  platformSupportsAR,
} from "@/lib/composition-engine";
import { Combobox } from "@/components/ui/combobox";
import { AspectRatioSelector } from "@/components/providers/aspect-ratio-selector";
import { CompositionModeToggle } from "@/components/composition-mode-toggle";
import { TextLengthOptimizer } from "@/components/providers/text-length-optimizer";
import { LengthIndicator } from "@/components/providers/length-indicator";
import { OptimizationTransparencyPanel } from "@/components/providers/optimization-transparency-panel";
import {
  usePromagenAuth,
  type PromptLockState,
} from "@/hooks/use-promagen-auth";
import { useCompositionMode } from "@/hooks/use-composition-mode";
import { usePromptOptimization } from "@/hooks/use-prompt-optimization";
import type {
  PromptCategory,
  PromptSelections,
  CategoryState,
  WeatherCategoryMap,
} from "@/types/prompt-builder";
import { hashCategoryMap } from "@/lib/prompt-dna";
import {
  isBudgetAwareCategory,
  isFidelityParametric,
} from "@/lib/usage/constants";
import { rewriteWithSynergy } from "@/lib/weather/synergy-rewriter";
import { postProcessAssembled } from "@/lib/prompt-post-process";
import { incrementLifetimePrompts } from "@/lib/lifetime-counter";
import { CATEGORY_ORDER } from "@/types/prompt-builder";
import { VALID_ASPECT_RATIOS } from "@/types/composition";
import {
  CATEGORY_COLOURS,
  CATEGORY_LABELS as COLOUR_LEGEND_LABELS,
  CATEGORY_EMOJIS as COLOUR_LEGEND_EMOJIS,
  buildTermIndexFromSelections,
  parsePromptIntoSegments,
} from "@/lib/prompt-colours";

// Prompt Intelligence imports
import { usePromptAnalysis } from "@/hooks/prompt-intelligence";
import { useIntelligencePreferences } from "@/hooks/use-intelligence-preferences";
import { useLearningData } from "@/hooks/use-learning-data";
import { useVocabSubmission } from "@/hooks/use-vocab-submission";
import {
  DNABar,
  ConflictWarning,
  SuggestionChips,
  HealthBadge,
} from "@/components/prompt-intelligence";
import type {
  SuggestedOption,
  ScoredOption,
} from "@/lib/prompt-intelligence/types";
import {
  reorderByRelevance,
  generateCoherentPrompt,
} from "@/lib/prompt-intelligence";

// Save to Library imports
import { useSavedPrompts } from "@/hooks/use-saved-prompts";
import {
  SavePromptModal,
  type SavePromptData,
} from "@/components/prompts/save-prompt-modal";

// Scene Starters import (Phase 2)
import { SceneSelector } from "@/components/providers/scene-selector";
import { DescribeYourImage } from "@/components/providers/describe-your-image";
import {
  ExploreDrawer,
  type CascadeScoreMap,
} from "@/components/providers/explore-drawer";
import { getSceneById } from "@/data/scenes";
import { trackEvent } from "@/lib/analytics/events";
import { SaveIcon } from "@/components/prompts/library/save-icon";

// ============================================================================
// Types
// ============================================================================

export interface PromptBuilderProvider {
  id?: string;
  name: string;
  websiteUrl?: string;
  url?: string;
  description?: string;
  tags?: string[];
}

export interface PromptBuilderProps {
  id?: string;
  provider: PromptBuilderProvider;
  onDone?: () => void;
  /** Optional: Custom element to replace the static provider title (e.g., dropdown selector) */
  providerSelector?: React.ReactNode;
  // ── AI Disguise pass-through (lifted from playground-workspace) ────
  /** Called on every "Describe Your Image" textarea change */
  onDescribeTextChange?: (text: string) => void;
  /** Called when "Generate Prompt" clicked — fires Call 2 in parallel */
  onDescribeGenerate?: (sentence: string) => void;
  /** Whether the current text has drifted from last generation */
  isDrifted?: boolean;
  /** Number of word-level changes detected */
  driftChangeCount?: number;
  /** AI-generated tier prompts (overrides template tiers in 4-tier preview) */
  aiTierPrompts?: import('@/types/prompt-intelligence').GeneratedPrompts | null;
  /** Whether AI tier generation is in progress */
  isTierGenerating?: boolean;
  /** Provider name the AI tiers were generated for */
  generatedForProvider?: string | null;
}

// Platforms that use --no inline for negatives
const MIDJOURNEY_FAMILY = ["midjourney", "bluewillow", "nijijourney"];

// Initial state for all categories (12 total)
const createInitialState = (): Record<PromptCategory, CategoryState> => {
  const categories = getAllCategories();
  const state: Partial<Record<PromptCategory, CategoryState>> = {};
  for (const cat of categories) {
    state[cat] = { selected: [], customValue: "" };
  }
  return state as Record<PromptCategory, CategoryState>;
};

// Helper: pick random item from array (used for aspect ratio)
const pickRandom = <T,>(arr: T[]): T | undefined => {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
};

// ============================================================================
// Dynamic Tooltip Guidance (v8.1.0)
// ============================================================================

/**
 * Category-specific guidance - separate singular and plural forms
 */
const CATEGORY_GUIDANCE: Record<string, { singular: string; plural: string }> =
  {
    subject: {
      singular: "subject as your focal point.",
      plural: "subjects as focal points.",
    },
    action: {
      singular: "action for dynamic energy.",
      plural: "actions for dynamic energy.",
    },
    style: {
      singular: "style. Keep it focused.",
      plural: "complementary styles. Avoid conflicting aesthetics.",
    },
    environment: {
      singular: "setting for context.",
      plural: "settings for context.",
    },
    composition: {
      singular: "technique for visual structure.",
      plural: "techniques for visual structure.",
    },
    camera: {
      singular: "camera setting for precision.",
      plural: "camera settings for precision.",
    },
    lighting: {
      singular: "lighting setup for mood.",
      plural: "lighting setups for mood and dimension.",
    },
    colour: {
      singular: "colour treatment for harmony.",
      plural: "colour treatments for visual harmony.",
    },
    atmosphere: {
      singular: "atmospheric effect for mood.",
      plural: "atmospheric effects for depth and mood.",
    },
    materials: {
      singular: "material texture for realism.",
      plural: "material textures for tactile realism.",
    },
    fidelity: {
      singular: "quality booster for detail.",
      plural: "quality boosters for maximum detail.",
    },
    negative: {
      singular: "term to exclude.",
      plural: "terms to exclude from your image.",
    },
  };

/**
 * Generate dynamic tooltip guidance based on actual maxSelections.
 * This ensures the tooltip always matches the platform's actual limit.
 *
 * @param category - The prompt category
 * @param maxSelections - The actual limit for this platform/tier
 * @param baseGuidance - Optional base guidance from config (fallback)
 * @returns Dynamic tooltip text with correct limit and grammar
 */
function getDynamicTooltipGuidance(
  category: string,
  maxSelections: number,
  _baseGuidance?: string,
  platformId?: string,
): string {
  const guidance = CATEGORY_GUIDANCE[category];

  // Base guidance text
  let base: string;
  if (!guidance) {
    base =
      maxSelections === 1
        ? "Pick 1 option."
        : `Pick up to ${maxSelections} options.`;
  } else if (maxSelections === 1) {
    base = `Pick 1 ${guidance.singular}`;
  } else {
    base = `Pick up to ${maxSelections} ${guidance.plural}`;
  }

  // Improvement 2: Conversion-aware hint for budget-gated categories
  if (platformId && isBudgetAwareCategory(category, platformId)) {
    if (category === "fidelity" && isFidelityParametric(platformId)) {
      // MJ family: parametric = always included, no budget concern
      return `${base}\nConverts to parameters — always included.`;
    }
    if (category === "fidelity") {
      // NL conversion platforms (Flux, Recraft, Luma)
      return `${base}\nThe assembler converts and fits as many as your prompt budget allows.`;
    }
    // Negatives on none/inline platforms
    return `${base}\nConverted to positive reinforcement — the assembler decides how many fit.`;
  }

  return base;
}

// ============================================================================
// Composition Injection Helper
// ============================================================================

/**
 * Intelligently inject composition text into a prompt.
 * For Midjourney family: inserts BEFORE --no section
 * For others: appends to end
 */
function injectCompositionText(
  basePrompt: string,
  compositionText: string,
  platformId: string,
): string {
  if (!compositionText.trim()) return basePrompt;
  if (!basePrompt.trim()) return compositionText;

  const isMidjourneyFamily = MIDJOURNEY_FAMILY.includes(
    platformId.toLowerCase(),
  );

  if (isMidjourneyFamily && basePrompt.includes(" --no ")) {
    const parts = basePrompt.split(" --no ");
    const positiveSection = parts[0] ?? "";
    const negativeSection = parts[1] ?? "";
    return `${positiveSection.trim()}, ${compositionText} --no ${negativeSection}`;
  }

  return `${basePrompt.trim()}, ${compositionText}`;
}

/**
 * Append AR parameter to prompt (goes AFTER everything including --no)
 */
function appendARParameter(prompt: string, arParameter: string): string {
  if (!arParameter) return prompt;
  return `${prompt.trim()} ${arParameter}`;
}

// ============================================================================
// Improvement 1: Visual Diff — "Show Don't Tell" Mode Switching
// ============================================================================
// When switching Static ↔ Dynamic, highlights what intelligence added/changed
// so users SEE the value difference between raw selections and platform formatting.
//
// Green highlights  = terms ADDED by intelligence (quality prefix, neg→pos conversions)
// Purple highlights = terms MODIFIED by intelligence (CLIP weights, reordering)
// Highlights fade after 3s via CSS transition.
// ============================================================================

/** Normalise term for comparison — strip CLIP weight syntax, lowercase, trim */
function normaliseTerm(term: string): string {
  return term
    .replace(/\({1,2}([^)]+?)(?::[0-9.]+)?\){1,2}/g, "$1") // (term:1.2) → term
    .replace(/\{+([^}]+?)\}+/g, "$1") // {{{term}}} → term
    .replace(/::[0-9.]+/g, "") // term::1.2 → term
    .toLowerCase()
    .trim();
}

interface DiffResult {
  index: number;
  type: "added" | "modified";
}

/** Compute term-level diff between old and new prompt text */
function computePromptDiff(
  oldText: string,
  newText: string,
  separator: string = ", ",
): DiffResult[] {
  if (!oldText.trim() || !newText.trim()) return [];

  const oldTerms = oldText
    .split(separator)
    .map((t) => t.trim())
    .filter(Boolean);
  const newTerms = newText
    .split(separator)
    .map((t) => t.trim())
    .filter(Boolean);

  const oldNormalised = new Set(oldTerms.map(normaliseTerm));
  const oldExact = new Set(oldTerms);

  const diffs: DiffResult[] = [];
  for (let i = 0; i < newTerms.length; i++) {
    const term = newTerms[i]!;
    const norm = normaliseTerm(term);

    if (!oldNormalised.has(norm)) {
      diffs.push({ index: i, type: "added" });
    } else if (!oldExact.has(term)) {
      diffs.push({ index: i, type: "modified" });
    }
  }
  return diffs;
}

/** Render prompt text with highlighted diff terms that fade out */
function DiffHighlightedText({
  text,
  diffs,
  separator = ", ",
  fadingOut,
}: {
  text: string;
  diffs: DiffResult[];
  separator?: string;
  fadingOut: boolean;
}) {
  const terms = text
    .split(separator)
    .map((t) => t.trim())
    .filter(Boolean);
  const diffMap = new Map(diffs.map((d) => [d.index, d.type]));

  return (
    <>
      {terms.map((term, i) => {
        const diffType = diffMap.get(i);
        const isLast = i === terms.length - 1;
        const suffix = !isLast ? `${separator}` : "";

        if (!diffType) {
          return (
            <React.Fragment key={i}>
              {term}
              {suffix}
            </React.Fragment>
          );
        }

        const baseClass =
          diffType === "added"
            ? "bg-emerald-500/25 text-emerald-200 rounded px-0.5 -mx-0.5"
            : "bg-purple-500/20 text-purple-200 rounded px-0.5 -mx-0.5";

        return (
          <React.Fragment key={i}>
            <span
              className={`${baseClass} transition-all duration-1000 ease-out ${
                fadingOut ? "bg-transparent !text-inherit" : ""
              }`}
            >
              {term}
            </span>
            {suffix}
          </React.Fragment>
        );
      })}
    </>
  );
}

// ============================================================================
// Improvement 2: Stage Indicator Badge
// ============================================================================
// Small badge above assembled prompt showing which pipeline stage produced
// the current preview: 📋 Static | ✨ Dynamic | ⚡ Optimized | ✓ Optimal
// ============================================================================

function StageBadge({
  compositionMode,
  isOptimizerEnabled,
  wasOptimized,
}: {
  compositionMode: "static" | "dynamic";
  isOptimizerEnabled: boolean;
  wasOptimized: boolean;
}) {
  if (compositionMode === "static") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md border border-slate-600/50 bg-slate-800/60 px-1.5 py-0.5 text-[10px] font-medium text-slate-200"
        title="Raw selections — no intelligence applied. What you pick is what you get."
      >
        📋 Static
      </span>
    );
  }

  if (isOptimizerEnabled && wasOptimized) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400"
        title="Platform-formatted AND trimmed to optimal length for best results."
      >
        ⚡ Optimized
      </span>
    );
  }

  if (isOptimizerEnabled && !wasOptimized) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-950/30 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400"
        title="Platform-formatted and already within optimal length."
      >
        ✓ Optimal
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border border-purple-500/30 bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-medium text-purple-400"
      title="Platform intelligence applied — reordered, weighted, quality tags added. Enable Optimize to trim to ideal length."
    >
      ✨ Dynamic
    </span>
  );
}

// ============================================================================
// Pro Promagen: Colour-coded prompt text
// Human factor: Von Restorff Effect — each category colour isolates terms,
// making the prompt scannable. Loss Aversion — free users see plain text,
// Pro users see the rich colour-coded version (visible value-add).
// ============================================================================

/**
 * Renders prompt text with colour-coded category segments (Pro Promagen only).
 * When isPro is false, renders plain text with the given fallback class.
 */
function ColourCodedPromptText({
  text,
  termIndex,
  isPro,
  fallbackClass = "text-slate-100",
}: {
  text: string;
  termIndex: Map<string, PromptCategory>;
  isPro: boolean;
  fallbackClass?: string;
}) {
  if (!isPro || termIndex.size === 0) {
    return <>{text}</>;
  }

  const segments = parsePromptIntoSegments(text, termIndex);
  const hasAnatomy = segments.some((s) => s.category !== "structural");

  if (!hasAnatomy) {
    return <span className={fallbackClass}>{text}</span>;
  }

  return (
    <>
      {segments.map((seg, i) => {
        const segColour =
          CATEGORY_COLOURS[seg.category] ?? CATEGORY_COLOURS.structural;
        const isWeighted = seg.weight >= 1.05;
        return (
          <span
            key={i}
            style={{
              color: segColour,
              textShadow: isWeighted ? `0 0 10px ${segColour}50` : undefined,
            }}
          >
            {seg.text}
          </span>
        );
      })}
    </>
  );
}

/**
 * Colour legend tooltip — shows all 13 category→colour mappings.
 * Built per tooltip standards: 400ms close delay, min 10px font, no opacity.
 * Only visible for Pro Promagen users.
 */
function CategoryColourLegend({ isPro }: { isPro: boolean }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const closeTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const startCloseDelay = React.useCallback(() => {
    closeTimerRef.current = setTimeout(() => setIsOpen(false), 400);
  }, []);

  const cancelCloseDelay = React.useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  if (!isPro) return null;

  const categories: PromptCategory[] = [
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
  ];

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-lg px-1.5 py-1 transition-all cursor-pointer bg-white/5 hover:bg-white/10"
        style={{ fontSize: "clamp(18px, 1.4vw, 22px)" }}
        onMouseEnter={() => {
          cancelCloseDelay();
          setIsOpen(true);
        }}
        onMouseLeave={startCloseDelay}
        onClick={() => setIsOpen((o) => !o)}
        title="Prompt colour key — Pro Promagen"
        aria-label="Show category colour legend"
      >
        🎨
      </button>
      {isOpen && (
        <div
          className="absolute left-1/2 -translate-x-1/2 top-full z-[9999] mt-2 rounded-xl border border-slate-700 shadow-2xl"
          style={{
            width: "clamp(280px, 22vw, 340px)",
            background: "rgba(15, 23, 42, 0.97)",
            backdropFilter: "blur(16px)",
          }}
          onMouseEnter={cancelCloseDelay}
          onMouseLeave={startCloseDelay}
        >
          {/* Ethereal glow overlays (matches weather/commodity tooltips) */}
          <div className="pointer-events-none absolute inset-0 rounded-xl overflow-hidden">
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 80% 40% at 50% 0%, rgba(56,189,248,0.06), transparent)",
              }}
            />
          </div>
          {/* Arrow */}
          <div
            className="absolute -top-1.5 left-1/2 -translate-x-1/2 h-3 w-3 rotate-45 border-l border-t border-slate-700"
            style={{ background: "rgba(15, 23, 42, 0.97)" }}
          />
          <div className="relative px-4 py-3">
            <p
              className="font-semibold text-white mb-3"
              style={{ fontSize: "clamp(12px, 0.85vw, 14px)" }}
            >
              Category Colour Key
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {categories.map((cat) => (
                <div key={cat} className="flex items-center gap-2">
                  <span
                    className="inline-block rounded-full flex-shrink-0"
                    style={{
                      width: "clamp(8px, 0.6vw, 10px)",
                      height: "clamp(8px, 0.6vw, 10px)",
                      backgroundColor: CATEGORY_COLOURS[cat],
                    }}
                  />
                  <span
                    className="truncate"
                    style={{
                      fontSize: "clamp(11px, 0.75vw, 13px)",
                      color: CATEGORY_COLOURS[cat],
                    }}
                  >
                    {COLOUR_LEGEND_EMOJIS[cat]} {COLOUR_LEGEND_LABELS[cat]}
                  </span>
                </div>
              ))}
              {/* Structural (13th) */}
              <div className="flex items-center gap-2">
                <span
                  className="inline-block rounded-full flex-shrink-0"
                  style={{
                    width: "clamp(8px, 0.6vw, 10px)",
                    height: "clamp(8px, 0.6vw, 10px)",
                    backgroundColor: CATEGORY_COLOURS.structural,
                  }}
                />
                <span
                  className="truncate"
                  style={{
                    fontSize: "clamp(11px, 0.75vw, 13px)",
                    color: CATEGORY_COLOURS.structural,
                  }}
                >
                  ✏️ Structural
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </span>
  );
}

// ============================================================================
// Lock Overlay Components
// ============================================================================

interface LockOverlayProps {
  lockState: PromptLockState;
  anonymousRemaining?: number | null;
  dailyRemaining?: number | null;
  dailyResetTime?: string | null;
}

function LockOverlay({ lockState, dailyResetTime }: LockOverlayProps) {
  if (lockState === "unlocked") return null;

  const getTimeUntilReset = () => {
    if (!dailyResetTime) return null;
    const reset = new Date(dailyResetTime);
    const now = new Date();
    const diff = reset.getTime() - now.getTime();
    if (diff <= 0) return null;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const isAnonymousLimit = lockState === "anonymous_limit";
  const isQuotaReached = lockState === "quota_reached";

  return (
    <div className="prompt-builder-lock-overlay w-full flex justify-center">
      <div className="flex flex-col items-center gap-4 text-center px-6 max-w-md">
        {isAnonymousLimit && (
          <>
            <SignInButton mode="modal">
              <button type="button" className="lock-cta-button translate-y-2">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                  />
                </svg>
                Sign in to continue
              </button>
            </SignInButton>
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-semibold text-white">
                You&apos;ve used your 3 free prompts
              </h3>
              <p className="text-sm text-purple-200">
                Sign in to unlock 5 prompts per day and the prompt optimizer —
                free forever.
              </p>
              <ul className="mt-0.1 text-left text-xs text-purple-300 space-y-1">
                <li className="flex items-center gap-2">
                  <svg
                    className="h-3.5 w-3.5 text-emerald-400 shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>5 prompts per day (resets at midnight)</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg
                    className="h-3.5 w-3.5 text-emerald-400 shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Prompt optimizer — platform-tuned output</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg
                    className="h-3.5 w-3.5 text-emerald-400 shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Exchanges arranged by your location</span>
                </li>
              </ul>
            </div>
          </>
        )}

        {isQuotaReached && (
          <>
            <button type="button" className="lock-cta-button translate-y-2">
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              Upgrade to Pro
            </button>
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-semibold text-white">
                Daily limit reached
              </h3>
              <p className="text-sm text-purple-200">
                {getTimeUntilReset()
                  ? `Resets in ${getTimeUntilReset()}`
                  : "Resets at midnight in your timezone"}
              </p>
              <p className="text-xs text-slate-200">
                Upgrade to Pro Promagen for unlimited prompts.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Counter Components
// ============================================================================

function AnonymousCounter({ count, limit }: { count: number; limit: number }) {
  const remaining = Math.max(0, limit - count);
  return (
    <span className="text-xs text-slate-200">
      {remaining} of {limit} free prompts
    </span>
  );
}

function DailyCounter({ count, limit }: { count: number; limit: number }) {
  return (
    <span className="text-xs text-slate-200">
      {count}/{limit} prompts today
    </span>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function PromptBuilder({
  id = "prompt-builder",
  provider,
  onDone,
  providerSelector,
  // AI Disguise pass-through (from playground-workspace orchestrator)
  onDescribeTextChange,
  onDescribeGenerate,
  isDrifted,
  driftChangeCount,
  aiTierPrompts: _aiTierPrompts,
  isTierGenerating: _isTierGenerating,
  generatedForProvider: _generatedForProvider,
}: PromptBuilderProps) {
  // ============================================================================
  // Platform ID (computed first for hook dependency)
  // ============================================================================

  const platformId = provider.id ?? "default";

  // ============================================================================
  // Hooks
  // ============================================================================

  const {
    isAuthenticated,
    userTier,
    accountAgeDays,
    promptLockState,
    anonymousUsage,
    dailyUsage,
    categoryLimits,
    platformTier,
    trackPromptCopy: trackUsageCallback,
    locationInfo,
  } = usePromagenAuth({ platformId });

  const { compositionMode, setCompositionMode, aspectRatio, setAspectRatio } =
    useCompositionMode();

  // Vocabulary crowdsourcing — silently captures custom terms (Phase 7.7)
  const submitCustomTerm = useVocabSubmission(platformId, platformTier);

  // Prompt Intelligence Preferences
  const { preferences: intelligencePrefs } = useIntelligencePreferences();

  // ============================================================================
  // Local State
  // ============================================================================

  const [categoryState, setCategoryState] =
    useState<Record<PromptCategory, CategoryState>>(createInitialState());
  const [copied, setCopied] = useState(false);
  const [copiedAssembled, setCopiedAssembled] = useState(false);
  const [copiedOptimized, setCopiedOptimized] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savedConfirmation, setSavedConfirmation] = useState(false);

  // §4.5: "Inspired by" badge — weather context from homepage "Try in" click
  const [inspiredByData, setInspiredByData] = useState<{
    city: string;
    venue: string;
    conditions: string;
    emoji: string;
    tempC: number | null;
    localTime: string;
    mood: string;
    categoryMapHash?: string; // Upgrade 5: original hash for fingerprint verification
  } | null>(null);

  // Weather intelligence weight overrides — forwarded to assemblePrompt()
  // so builder output matches homepage emphasis (environment::1.2, composition::1.05 etc.)
  const [weatherWeightOverrides, setWeatherWeightOverrides] = useState<
    Partial<Record<PromptCategory, number>> | undefined
  >(undefined);

  // Phase 7.10d: Feedback invitation state
  const [feedbackPending, setFeedbackPending] =
    useState<FeedbackPendingData | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Phase 7.10g: Contextual feedback memory + autopilot
  const { recordRatedPrompt, getOverlap, getTermHints } = useFeedbackMemory();

  // Step 2.6: Scene origin tracking — which values came from a Scene Starter
  const [scenePrefills, setScenePrefills] = useState<
    Record<string, string[]> | undefined
  >();
  // Phase 4: Track active scene ID for flavour phrases lookup
  const [activeSceneId, setActiveSceneId] = useState<string | undefined>();
  // Homepage pre-loaded scene: passed to SceneSelector to auto-expand
  const [preloadedSceneId, setPreloadedSceneId] = useState<
    string | undefined
  >();

  // Phase 3: Explore Drawer accordion — only one drawer open at a time
  const [expandedExploreCategory, setExpandedExploreCategory] =
    useState<PromptCategory | null>(null);

  const handleActiveSceneChange = useCallback(
    (
      sceneId: string | undefined,
      prefills: Record<string, string[]> | undefined,
    ) => {
      setScenePrefills(prefills);
      setActiveSceneId(sceneId);
    },
    [],
  );

  // Phase 4.1: Look up active scene's flavourPhrases
  const activeSceneFlavour = useMemo(() => {
    if (!activeSceneId) return undefined;
    const scene = getSceneById(activeSceneId);
    return scene?.flavourPhrases;
  }, [activeSceneId]);

  // Save to Library hook
  const { savePrompt } = useSavedPrompts();

  // Phase 5 + 7.1–7.6: Unified learning data (tier + platform + A/B testing)
  const {
    coOccurrenceLookup,
    blendRatio: learnedBlendRatio,
    antiPatternLookup,
    collisionLookup,
    weakTermLookup,
    redundancyLookup,
    comboLookup,
    platformTermQualityLookup,
    platformCoOccurrenceLookup,
    abVariantWeights,
    abHash,
    activeTestId: abTestId,
    abVariant,
    compressionLookup,
  } = useLearningData();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Phase 7.10d: Return-visit detection — show feedback if unrated prompt exists
  useEffect(() => {
    if (!isMounted) return;
    if (isDismissedRecently()) return;
    const pending = readFeedbackPending();
    if (pending) setFeedbackPending(pending);
  }, [isMounted]);

  // ============================================================================
  // Load Explore Terms from SessionStorage
  // ============================================================================

  useEffect(() => {
    if (!isMounted) return;

    try {
      const storedTerms = sessionStorage.getItem("promagen_explore_terms");
      if (storedTerms) {
        const terms: string[] = JSON.parse(storedTerms);

        if (Array.isArray(terms) && terms.length > 0) {
          // Map terms to appropriate categories based on what they likely are
          // From explore: suggestedColours, suggestedLighting, suggestedAtmosphere
          setCategoryState((prev) => {
            const newState = { ...prev };

            // Add first term to colour (usually a colour suggestion)
            if (terms[0] && prev.colour) {
              const limit = categoryLimits.colour ?? 1;
              const current = [...prev.colour.selected];
              if (!current.includes(terms[0]) && current.length < limit) {
                newState.colour = {
                  ...prev.colour,
                  selected: [...current, terms[0]],
                };
              }
            }

            // Add second term to lighting (usually a lighting suggestion)
            if (terms[1] && prev.lighting) {
              const limit = categoryLimits.lighting ?? 1;
              const current = [...prev.lighting.selected];
              if (!current.includes(terms[1]) && current.length < limit) {
                newState.lighting = {
                  ...prev.lighting,
                  selected: [...current, terms[1]],
                };
              }
            }

            // Add third term to atmosphere (usually an atmosphere suggestion)
            if (terms[2] && prev.atmosphere) {
              const limit = categoryLimits.atmosphere ?? 1;
              const current = [...prev.atmosphere.selected];
              if (!current.includes(terms[2]) && current.length < limit) {
                newState.atmosphere = {
                  ...prev.atmosphere,
                  selected: [...current, terms[2]],
                };
              }
            }

            return newState;
          });
        }

        // Clear after reading so it doesn't persist across navigations
        sessionStorage.removeItem("promagen_explore_terms");
      }
    } catch {
      // Silently ignore parse errors
    }
  }, [isMounted, categoryLimits]);

  // ============================================================================
  // Load Saved Prompt from Library (SessionStorage)
  // ============================================================================

  useEffect(() => {
    if (!isMounted) return;

    try {
      const storedPrompt = sessionStorage.getItem("promagen_load_prompt");
      console.debug(
        "[PromptBuilder] Load check — isMounted:",
        isMounted,
        "hasData:",
        !!storedPrompt,
      );

      if (storedPrompt) {
        const prompt = JSON.parse(storedPrompt) as {
          selections?: Record<PromptCategory, string[]>;
          customValues?: Record<PromptCategory, string>;
          _rawPositivePrompt?: string;
          _rawNegativePrompt?: string;
        };

        // Check if there are actual structured selections (non-empty)
        const hasSelections =
          prompt.selections &&
          Object.values(prompt.selections).some(
            (arr) => Array.isArray(arr) && arr.length > 0,
          );
        const hasCustomValues =
          prompt.customValues &&
          Object.values(prompt.customValues).some(
            (v) => typeof v === "string" && v.length > 0,
          );

        console.debug("[PromptBuilder] Load data:", {
          hasSelections,
          hasCustomValues,
          hasRawText: !!prompt._rawPositivePrompt,
          rawTextLength: prompt._rawPositivePrompt?.length ?? 0,
          selectionKeys: prompt.selections
            ? Object.keys(prompt.selections).filter((k) => {
                const v = prompt.selections?.[k as PromptCategory];
                return Array.isArray(v) && v.length > 0;
              })
            : [],
        });

        if (hasSelections || hasCustomValues) {
          // Structured load — populate category dropdowns
          setCategoryState((prev) => {
            const newState = { ...prev };

            if (prompt.selections) {
              for (const [cat, selected] of Object.entries(prompt.selections)) {
                const category = cat as PromptCategory;
                if (newState[category]) {
                  newState[category] = {
                    ...newState[category],
                    selected: selected || [],
                  };
                }
              }
            }

            if (prompt.customValues) {
              for (const [cat, value] of Object.entries(prompt.customValues)) {
                const category = cat as PromptCategory;
                if (newState[category]) {
                  newState[category] = {
                    ...newState[category],
                    customValue: value || "",
                  };
                }
              }
            }

            console.debug("[PromptBuilder] Structured load applied");
            return newState;
          });
        } else if (prompt._rawPositivePrompt) {
          // Fallback for tooltip-origin prompts: paste raw text into subject custom field
          console.debug(
            "[PromptBuilder] Raw text fallback — pasting into subject.customValue",
          );
          setCategoryState((prev) => ({
            ...prev,
            subject: {
              ...prev.subject,
              customValue: prompt._rawPositivePrompt ?? "",
            },
          }));
        } else {
          console.debug(
            "[PromptBuilder] No usable data found in stored prompt",
          );
        }

        // Clear after reading
        sessionStorage.removeItem("promagen_load_prompt");
        console.debug("[PromptBuilder] Cleared sessionStorage");
      }
    } catch (err) {
      console.error("[PromptBuilder] Load error:", err);
    }
  }, [isMounted]);

  // ============================================================================
  // Load Scene from Homepage (SessionStorage) — Phase 3, Step 3.3
  // ============================================================================
  // When user clicks a scene card on the homepage, the scene ID is stored in
  // sessionStorage. On mount, apply that scene's prefills to category state.
  // Authority: docs/authority/homepage.md §5.4

  useEffect(() => {
    if (!isMounted) return;

    try {
      const sceneId = sessionStorage.getItem("promagen:preloaded-scene");
      if (!sceneId) return;

      // Clear immediately so it doesn't persist across navigations
      sessionStorage.removeItem("promagen:preloaded-scene");

      const scene = getSceneById(sceneId);
      if (!scene) return;

      // Build prefill map (same pattern as scene-selector.tsx handleSceneSelection)
      // Tier 4 gets reduced prefills; tiers 1–3 get full prefills
      const tier4Guidance = scene.tierGuidance["4"];
      const reducedCats =
        platformTier === 4 && tier4Guidance?.reducedPrefills
          ? new Set<string>(tier4Guidance.reducedPrefills)
          : null;

      const prefillMap: Record<string, string[]> = {};
      for (const [cat, values] of Object.entries(scene.prefills)) {
        if (reducedCats && !reducedCats.has(cat)) continue;
        prefillMap[cat] = [...(values ?? [])];
      }

      // Apply prefills to category state
      setCategoryState((prev) => {
        const next = { ...prev };
        for (const [cat, values] of Object.entries(prefillMap)) {
          const category = cat as PromptCategory;
          if (next[category]) {
            next[category] = {
              ...next[category],
              selected: [...(values ?? [])],
              customValue: next[category].customValue ?? "",
            };
          }
        }
        return next;
      });

      // Set active scene tracking
      setScenePrefills(prefillMap);
      setActiveSceneId(sceneId);
      // Tell SceneSelector to auto-expand and show this scene's world
      setPreloadedSceneId(sceneId);
    } catch {
      // Silently ignore errors
    }
  }, [isMounted, platformTier]);

  // ============================================================================
  // Phase D: Pre-loaded Prompt from Homepage "Try in" Icons
  // ============================================================================
  // Reads 'promagen:preloaded-payload' from sessionStorage.
  //
  // Phase D (preferred): If payload contains categoryMap (WeatherCategoryMap),
  // populates ALL 12 categories from selections + customValues + negative.
  // This is the full physics-computed structured data from weather intelligence.
  //
  // Legacy fallback: If payload has promptText but no categoryMap, falls back to
  // old behaviour: stuff prompt text into subject.customValue + mood metadata.
  //
  // Also reads 'promagen:preloaded-inspiredBy' for the "Inspired by" badge.
  // Clears all sessionStorage keys immediately after reading (one-time use).

  useEffect(() => {
    if (!isMounted) return;

    try {
      const payloadRaw = sessionStorage.getItem("promagen:preloaded-payload");
      const inspiredByRaw = sessionStorage.getItem(
        "promagen:preloaded-inspiredBy",
      );

      // Also check legacy keys for backward compatibility
      const legacySelectionsRaw = sessionStorage.getItem(
        "promagen:preloaded-selections",
      );

      // Clear ALL preload keys immediately so they don't persist
      sessionStorage.removeItem("promagen:preloaded-payload");
      sessionStorage.removeItem("promagen:preloaded-inspiredBy");
      sessionStorage.removeItem("promagen:preloaded-selections");
      sessionStorage.removeItem("promagen:preloaded-prompt");
      sessionStorage.removeItem("promagen:preloaded-tier");

      // Apply "Inspired by" badge data
      if (inspiredByRaw) {
        try {
          setInspiredByData(JSON.parse(inspiredByRaw));
        } catch {
          // Invalid JSON — ignore
        }
      }

      // ── Parse payload ──────────────────────────────────────────────
      if (payloadRaw) {
        let payload: {
          promptText?: string;
          selections?: Record<string, string[]>;
          categoryMap?: {
            selections?: Partial<Record<string, string[]>>;
            customValues?: Partial<Record<string, string>>;
            negative?: string[];
            weightOverrides?: Partial<Record<string, number>>;
            confidence?: Partial<Record<string, number>>;
          };
        };
        try {
          payload = JSON.parse(payloadRaw);
        } catch {
          return;
        }

        // ── Phase D path: WeatherCategoryMap present ─────────────────
        // Populates ALL 12 categories from structured weather intelligence.
        if (payload.categoryMap) {
          const catMap = payload.categoryMap;
          const mapSelections = catMap.selections ?? {};
          const mapCustomValues = catMap.customValues ?? {};
          const mapNegative = catMap.negative ?? [];

          setCategoryState((prev) => {
            const next = { ...prev };

            // Apply dropdown selections per category
            for (const [cat, values] of Object.entries(mapSelections)) {
              const category = cat as PromptCategory;
              if (
                !next[category] ||
                !Array.isArray(values) ||
                values.length === 0
              )
                continue;
              const limit = categoryLimits[category] ?? 1;
              const shown = values.slice(0, limit);
              const overflow = values.slice(limit);
              next[category] = {
                ...next[category],
                selected: shown,
                // Carry overflow selections into customValue so the assembler
                // still includes them — same pattern as negative overflow.
                // If a real customValue exists (weather-intelligence phrase),
                // the next loop overwrites this with the richer content.
                customValue:
                  overflow.length > 0
                    ? overflow.join(", ")
                    : next[category]!.customValue,
              };
            }

            // Apply customValues (rich physics phrases) per category
            for (const [cat, value] of Object.entries(mapCustomValues)) {
              const category = cat as PromptCategory;
              if (!next[category] || typeof value !== "string" || !value.trim())
                continue;
              next[category] = {
                ...next[category],
                customValue: value.trim(),
              };
            }

            // Apply negative terms — Improvement 3: carry ALL negatives.
            // Selected gets up to limit; overflow goes into customValue so
            // the assembler still includes them in the prompt output.
            if (mapNegative.length > 0 && next.negative) {
              const limit = categoryLimits.negative ?? 5;
              const shown = mapNegative.slice(0, limit);
              const overflow = mapNegative.slice(limit);
              next.negative = {
                ...next.negative,
                selected: shown,
                // Overflow terms join into customValue so assembler picks them up
                customValue: overflow.length > 0 ? overflow.join(", ") : "",
              };
            }

            return next;
          });

          // Capture weather weight overrides so assemblePrompt() can
          // reproduce the same emphasis the homepage generator used.
          if (catMap.weightOverrides) {
            setWeatherWeightOverrides(
              catMap.weightOverrides as Partial<Record<PromptCategory, number>>,
            );
          }

          return; // Phase D handled — skip legacy paths
        }

        // ── Legacy path: promptText + mood selections (pre-Phase D) ──
        const rawPromptText = payload.promptText ?? "";
        const moodSelections = payload.selections ?? {};

        if (rawPromptText) {
          setCategoryState((prev) => {
            const next = { ...prev };

            // ── Parse Tier 1 CLIP positive/negative split ──────────
            let positiveText = rawPromptText;
            let negativeText = "";

            const posMatch = rawPromptText.match(
              /Positive prompt:\s*([\s\S]*?)(?:\nNegative prompt:|$)/i,
            );
            const negMatch = rawPromptText.match(
              /Negative prompt:\s*([\s\S]*?)$/i,
            );

            if (posMatch?.[1]) {
              positiveText = posMatch[1].trim();
              negativeText = negMatch?.[1]?.trim() ?? "";
            }

            // ── Subject: the ACTUAL prompt text (the good stuff) ───
            next.subject = {
              ...next.subject,
              customValue: positiveText,
            };

            // ── Negative: CLIP negative terms if present ───────────
            if (negativeText && next.negative) {
              next.negative = {
                ...next.negative,
                customValue: negativeText,
              };
            }

            // ── Metadata dropdowns: style, atmosphere, colour ──────
            for (const [cat, values] of Object.entries(moodSelections)) {
              const category = cat as PromptCategory;
              // Only apply metadata categories — not scene descriptors
              if (
                category === "subject" ||
                category === "environment" ||
                category === "lighting"
              )
                continue;
              if (
                next[category] &&
                Array.isArray(values) &&
                values.length > 0
              ) {
                const limit = categoryLimits[category] ?? 1;
                const trimmed = values.slice(0, limit);
                next[category] = {
                  ...next[category],
                  selected: trimmed,
                };
              }
            }

            return next;
          });
        }

        return; // New payload handled, skip legacy
      }

      // ── Legacy flat selections format (backward compat) ────────────
      if (legacySelectionsRaw) {
        try {
          const parsed = JSON.parse(legacySelectionsRaw);
          // Support both { selections, customValues } and flat Record shapes
          const selectionsMap =
            parsed.selections ??
            (Array.isArray(Object.values(parsed)[0]) ? parsed : {});
          const customValuesMap = parsed.customValues ?? {};

          setCategoryState((prev) => {
            const next = { ...prev };
            for (const [cat, values] of Object.entries(selectionsMap)) {
              const category = cat as PromptCategory;
              if (
                next[category] &&
                Array.isArray(values) &&
                (values as string[]).length > 0
              ) {
                const limit = categoryLimits[category] ?? 1;
                next[category] = {
                  ...next[category],
                  selected: (values as string[]).slice(0, limit),
                  customValue: next[category].customValue ?? "",
                };
              }
            }
            for (const [cat, value] of Object.entries(customValuesMap)) {
              const category = cat as PromptCategory;
              if (next[category] && typeof value === "string" && value.trim()) {
                next[category] = {
                  ...next[category],
                  customValue: value.trim(),
                };
              }
            }
            return next;
          });
        } catch {
          // Invalid JSON — ignore
        }
      }
    } catch {
      // sessionStorage unavailable — graceful degradation
    }
  }, [isMounted, categoryLimits]);

  // ============================================================================
  // Auto-Trim Effect (Silent Platform Switch)
  // ============================================================================

  // When categoryLimits change (platform switch), silently trim excess selections
  useEffect(() => {
    setCategoryState((prev) => {
      let hasChanges = false;
      const newState = { ...prev };

      for (const [category, state] of Object.entries(prev) as [
        PromptCategory,
        CategoryState,
      ][]) {
        const limit = categoryLimits[category] ?? 1;
        if (state.selected.length > limit) {
          // Trim to new limit (keep first N selections)
          newState[category] = {
            ...state,
            selected: state.selected.slice(0, limit),
          };
          hasChanges = true;
        }
      }

      return hasChanges ? newState : prev;
    });
  }, [categoryLimits]);

  // ============================================================================
  // Computed Values
  // ============================================================================

  const isLocked = promptLockState !== "unlocked";
  const allowNegativeFreeText = supportsNativeNegative(platformId);
  const _hasNativeAR = platformSupportsAR(platformId, aspectRatio ?? "1:1");
  const isMjFamily = MIDJOURNEY_FAMILY.includes(platformId.toLowerCase());

  // Tier badge config — tells users what prompt style this platform expects
  const tierBadge =
    {
      1: {
        label: "CLIP-Based",
        bg: "bg-blue-500/15",
        text: "text-blue-400",
        ring: "ring-blue-500/30",
      },
      2: {
        label: "Midjourney",
        bg: "bg-purple-500/15",
        text: "text-purple-400",
        ring: "ring-purple-500/30",
      },
      3: {
        label: "Natural Language",
        bg: "bg-emerald-500/15",
        text: "text-emerald-400",
        ring: "ring-emerald-500/30",
      },
      4: {
        label: "Plain Language",
        bg: "bg-orange-500/15",
        text: "text-orange-400",
        ring: "ring-orange-500/30",
      },
    }[platformTier] ?? null;

  // Build selections object from category state
  const selections = useMemo<PromptSelections>(() => {
    const result: PromptSelections = {};
    for (const [cat, state] of Object.entries(categoryState)) {
      const allValues = [...state.selected];
      if (state.customValue.trim()) {
        if (cat === "negative") {
          // Negative overflow was joined with ', ' when it exceeded the
          // category limit — split back to individual terms so each one
          // can be matched by NEGATIVE_TO_POSITIVE conversion and inline
          // negation ("without X or Y") in the assembler.
          allValues.push(
            ...state.customValue
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
          );
        } else {
          allValues.push(state.customValue.trim());
        }
      }
      if (allValues.length > 0) {
        result[cat as PromptCategory] = allValues;
      }
    }
    return result;
  }, [categoryState]);

  // ── Pro Promagen: Colour-coded prompt anatomy ──────────────────────────
  const isPro = userTier === "paid";

  // NOTE: colourTermIndex is declared AFTER rewrittenSelections (below)
  // to avoid temporal dead zone. See "Build term → category index" comment.

  // ── Upgrade 5: Prompt Fingerprint Verification ──────────────────────────
  // Computes hash of current builder state, compares with original hash
  // from homepage generator. Shows badge: match → green, modified → amber.
  const fingerprintStatus = useMemo<"match" | "modified" | null>(() => {
    if (!inspiredByData?.categoryMapHash) return null;

    // Build a minimal WeatherCategoryMap from current builder state
    const currentSelections: Partial<Record<PromptCategory, string[]>> = {};
    const currentCustomValues: Partial<Record<PromptCategory, string>> = {};

    for (const [cat, state] of Object.entries(categoryState)) {
      const category = cat as PromptCategory;
      if (category === "negative") continue; // hash ignores negatives

      if (state.selected.length > 0) {
        currentSelections[category] = [...state.selected];
      }
      if (state.customValue.trim()) {
        currentCustomValues[category] = state.customValue.trim();
      }
    }

    const currentMap: WeatherCategoryMap = {
      selections: currentSelections,
      customValues: currentCustomValues,
      negative: [], // ignored by hash
      meta: {
        city: "",
        venue: "",
        venueSetting: "",
        mood: "",
        conditions: "",
        emoji: "",
        tempC: null,
        localTime: "",
        source: "weather-intelligence",
      },
    };

    const currentHash = hashCategoryMap(currentMap);
    return currentHash === inspiredByData.categoryMapHash
      ? "match"
      : "modified";
  }, [categoryState, inspiredByData?.categoryMapHash]);

  // Phase 7.10g: Contextual feedback overlap detection
  const feedbackOverlap = useMemo(
    () => getOverlap(platformId, selections),
    [getOverlap, platformId, selections],
  );

  // Phase 7.10g: Autopilot term hints — Record<term, 'positive'|'negative'>
  const feedbackHintTerms = useMemo(() => {
    const hints = getTermHints(platformId);
    if (hints.length === 0) return undefined;
    const map: Record<string, "positive" | "negative"> = {};
    for (const h of hints) {
      map[h.term] = h.type;
    }
    return map;
  }, [getTermHints, platformId]);

  // Phase 7.10: Raw TermHint[] for Feedback-Aware Scene Starters
  const rawTermHints = useMemo(
    () => getTermHints(platformId),
    [getTermHints, platformId],
  );

  // ── Gap 1 fix: Synergy-aware rewriting ──────────────────────────────────
  // Pre-processes selections before assembly to resolve physics contradictions
  // (e.g. "golden hour" + "midnight" → "warm amber artificial light") and
  // inject bridging phrases for strong reinforcements.
  // Matches the same step the homepage generator runs via rewriteWithSynergy().
  // ONLY applies in Dynamic mode — Static mode is raw user input, no intelligence.
  const rewrittenSelections = useMemo(() => {
    if (compositionMode === "static") return selections;
    const { selections: rewritten } = rewriteWithSynergy(selections);
    return rewritten;
  }, [selections, compositionMode]);

  // ── Pro Promagen: Build term → category index for colour coding ────────
  // Placed here (after rewrittenSelections) to avoid temporal dead zone.
  // Uses BOTH rewrittenSelections (matches the assembled prompt text) AND
  // original selections (catches terms the synergy rewriter didn't touch).
  const colourTermIndex = useMemo(() => {
    if (!isPro) return new Map<string, PromptCategory>();
    const index = buildTermIndexFromSelections(rewrittenSelections);
    // Layer original selections underneath (rewritten terms win on conflicts)
    const origIndex = buildTermIndexFromSelections(selections);
    for (const [term, cat] of origIndex) {
      if (!index.has(term)) index.set(term, cat);
    }
    return index;
  }, [isPro, selections, rewrittenSelections]);

  // ============================================================================
  // 3-Stage Assembly Pipeline
  // ============================================================================
  // Stage 1 (Static):  assembleStatic()  — raw comma join in CATEGORY_ORDER
  // Stage 2 (Dynamic): assemblePrompt(skipTrim: true) — platform formatting, no trim
  // Stage 3 (Optimize): optimizer pipeline — trims dynamic output to sweet spot
  // ============================================================================

  // Assemble base prompt — routes through 3-stage pipeline based on compositionMode.
  // ── Gap 2 fix: Post-processing polish pass (Dynamic only) ──────────────
  // After assembly, applies the same 4 polish functions the homepage generator
  // runs: leak phrase neutralisation, CLIP dedup (Tier 1), redundant phenomenon
  // removal, MJ phenomenon trim (Tier 2), and grammar cleanup.
  // Static mode skips post-processing to preserve raw user input.
  const assembled = useMemo(() => {
    if (compositionMode === "static") {
      // Stage 1: Raw user selections, no intelligence
      return assembleStatic(platformId, selections);
    }

    // Stage 2: Full platform-specific formatting, skipTrim for optimizer (Stage 3)
    const raw = assemblePrompt(
      platformId,
      rewrittenSelections,
      weatherWeightOverrides,
      { skipTrim: true },
    );

    // Derive atmosphere hint from category state for phenomenon dedup.
    // In the generator this comes from lighting.atmosphereModifier; in the
    // builder we derive it from the atmosphere category selections + customValue.
    const atmosHint = [
      ...(categoryState.atmosphere?.selected ?? []),
      categoryState.atmosphere?.customValue ?? "",
    ].join(" ");

    return postProcessAssembled(raw, platformTier as 1 | 2 | 3 | 4, atmosHint);
  }, [
    platformId,
    rewrittenSelections,
    weatherWeightOverrides,
    platformTier,
    categoryState.atmosphere,
    compositionMode,
    selections,
  ]);

  // Assemble composition pack if AR selected
  const compositionPack = useMemo(() => {
    if (!aspectRatio) return null;
    return assembleCompositionPack(
      platformId,
      aspectRatio,
      compositionMode,
      selections,
    );
  }, [platformId, aspectRatio, compositionMode, selections]);

  // Build final prompt text
  const promptText = useMemo(() => {
    let basePrompt = formatPromptForCopy(assembled);

    if (compositionPack) {
      if (compositionPack.text) {
        basePrompt = injectCompositionText(
          basePrompt,
          compositionPack.text,
          platformId,
        );
      }
      if (compositionPack.useNativeAR && compositionPack.arParameter) {
        basePrompt = appendARParameter(basePrompt, compositionPack.arParameter);
      }
    }

    return basePrompt;
  }, [assembled, compositionPack, platformId]);

  const hasContent = promptText.trim().length > 0;

  // ============================================================================
  // Improvement 1: Visual Diff State — tracks mode switches for highlighting
  // ============================================================================
  const prevModeRef = useRef(compositionMode);
  const prevPromptRef = useRef(promptText);
  const [diffActive, setDiffActive] = useState(false);
  const [diffFading, setDiffFading] = useState(false);
  const [diffResults, setDiffResults] = useState<DiffResult[]>([]);
  const diffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (prevModeRef.current !== compositionMode && hasContent) {
      const diffs = computePromptDiff(prevPromptRef.current, promptText);
      setDiffResults(diffs);
      setDiffActive(true);
      setDiffFading(false);

      // Start fading after 2s
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = setTimeout(() => setDiffFading(true), 2000);

      // Remove highlights completely after 3.5s
      if (diffTimerRef.current) clearTimeout(diffTimerRef.current);
      diffTimerRef.current = setTimeout(() => {
        setDiffActive(false);
        setDiffFading(false);
        setDiffResults([]);
      }, 3500);
    }

    prevModeRef.current = compositionMode;
    prevPromptRef.current = promptText;

    return () => {
      if (diffTimerRef.current) clearTimeout(diffTimerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, [compositionMode, promptText, hasContent]);

  // §4.5: Clear "Inspired by" badge when user manually modifies via Clear all
  // (badge persists during normal editing since the selections ARE the prompt)

  // Build selections that include composition pack terms so the optimizer
  // can see (and trim) composition content when needed. Without this,
  // composition text is invisible to applyCategoryTrimming and survives
  // while creative content gets destroyed.
  const selectionsForOptimizer = useMemo((): PromptSelections => {
    if (!compositionPack?.terms?.length) return selections;
    return {
      ...selections,
      composition: [
        ...(selections.composition ?? []),
        ...compositionPack.terms,
      ],
    };
  }, [selections, compositionPack]);

  // ============================================================================
  // Text Length Optimizer Hook
  // ============================================================================

  const {
    isOptimizerEnabled,
    setOptimizerEnabled,
    analysis,
    getOptimizedPrompt,
    isToggleDisabled: isOptimizerDisabled,
    tooltipContent,
  } = usePromptOptimization({
    platformId,
    promptText,
    selections: selectionsForOptimizer,
    isMidjourneyFamily: isMjFamily,
    compositionMode,
  });

  const optimizedResult = useMemo(
    () => getOptimizedPrompt(),
    [getOptimizedPrompt],
  );

  // ============================================================================
  // Prompt Intelligence Hook
  // ============================================================================

  // Build negatives array from category state
  const negativesArray = useMemo(() => {
    const negState = categoryState["negative"];
    const arr = [...(negState?.selected ?? [])];
    if (negState?.customValue?.trim()) {
      arr.push(negState.customValue.trim());
    }
    return arr;
  }, [categoryState]);

  // Get prompt analysis (conflicts, DNA, suggestions, health)
  const {
    analysis: promptAnalysis,
    healthScore,
    hasHardConflicts,
    conflictCount,
  } = usePromptAnalysis(
    {
      subject: categoryState["subject"]?.customValue ?? "",
      selections,
      negatives: negativesArray,
      platformId,
    },
    {
      enabled: hasContent,
      debounceMs: 200,
    },
  );

  // Handler for suggestion chip clicks
  const handleSuggestionClick = useCallback(
    (suggestion: SuggestedOption) => {
      const category = suggestion.category;
      setCategoryState((prev) => {
        const currentSelected = prev[category]?.selected ?? [];
        const maxAllowed = categoryLimits[category] ?? 1;

        // Don't add if already selected or at max
        if (currentSelected.includes(suggestion.option)) return prev;
        if (currentSelected.length >= maxAllowed) return prev;

        return {
          ...prev,
          [category]: {
            ...prev[category],
            selected: [...currentSelected, suggestion.option],
          },
        };
      });
    },
    [categoryLimits],
  );

  // Compute top suggestions from analysis
  const topSuggestions = useMemo(() => {
    if (!promptAnalysis?.suggestions?.suggestions) return [];

    const all: SuggestedOption[] = [];
    for (const categorySuggestions of Object.values(
      promptAnalysis.suggestions.suggestions,
    )) {
      if (categorySuggestions) {
        all.push(...categorySuggestions);
      }
    }

    // Sort by score descending and take top 6
    all.sort((a, b) => b.score - a.score);
    return all.slice(0, 6);
  }, [promptAnalysis]);

  // Compute reordered options for all categories (smart dropdown ordering)
  const reorderedOptionsMap = useMemo(() => {
    const map = new Map<PromptCategory, ScoredOption[]>();

    // Skip if live reorder is disabled in preferences
    if (!intelligencePrefs.liveReorderEnabled) return map;

    // Only reorder if there's content (context to base ordering on)
    if (!hasContent) return map;

    // Performance measurement (Phase 1.7) — target: <16ms (one frame)
    const start = typeof performance !== "undefined" ? performance.now() : 0;

    const categories = getAllCategories();
    for (const category of categories) {
      if (category === "negative") continue; // Skip negative, doesn't benefit from reorder

      const config = getEnhancedCategoryConfig(category);
      if (!config || config.options.length === 0) continue;

      // Reorder options based on current selections + tier + learned weights
      const scoredOptions = reorderByRelevance(
        config.options,
        category,
        selections,
        false,
        null,
        platformTier,
        coOccurrenceLookup,
        learnedBlendRatio,
        antiPatternLookup,
        collisionLookup,
        weakTermLookup,
        redundancyLookup,
        comboLookup,
        platformTermQualityLookup,
        platformCoOccurrenceLookup,
        platformId,
        abVariantWeights,
      );

      map.set(category, scoredOptions);
    }

    // Log warning if reorder exceeds one frame budget
    const elapsed =
      typeof performance !== "undefined" ? performance.now() - start : 0;
    if (
      typeof performance !== "undefined" &&
      process.env.NODE_ENV === "development"
    ) {
      if (elapsed > 16) {
        console.warn(
          `[Cascade] Reorder took ${elapsed.toFixed(1)}ms (target: <16ms) — ${map.size} categories`,
        );
      }
    }

    return map;
  }, [
    hasContent,
    selections,
    intelligencePrefs.liveReorderEnabled,
    platformTier,
    coOccurrenceLookup,
    learnedBlendRatio,
    antiPatternLookup,
    collisionLookup,
    weakTermLookup,
    redundancyLookup,
    comboLookup,
    platformTermQualityLookup,
    platformCoOccurrenceLookup,
    platformId,
    abVariantWeights,
  ]);

  // Step 4.2: Track cascade reorder events (useEffect for purity)
  useEffect(() => {
    if (reorderedOptionsMap.size > 0) {
      trackEvent("cascade_reorder_triggered", {
        categories_reordered: reorderedOptionsMap.size,
        elapsed_ms: 0, // elapsed only available inside memo scope
      });
    }
  }, [reorderedOptionsMap]);

  // Helper to get options for a category (reordered if available)
  const getOptionsForCategory = useCallback(
    (category: PromptCategory, originalOptions: string[]): string[] => {
      const scored = reorderedOptionsMap.get(category);
      if (scored && scored.length > 0) {
        // Return just the option strings, already sorted by relevance
        return scored.map((s) => s.option);
      }
      return originalOptions;
    },
    [reorderedOptionsMap],
  );

  // Computed: did optimization change the prompt? (compression OR trimming)
  const wasOptimized =
    optimizedResult.originalLength !== optimizedResult.optimizedLength;

  const displayCategories = useMemo(
    () => CATEGORY_ORDER as PromptCategory[],
    [],
  );

  // Step 2.6: Get scene-origin values for a category (for combobox chip tinting)
  const getSceneOriginValues = useCallback(
    (category: PromptCategory): string[] | undefined => {
      if (!scenePrefills) return undefined;
      return scenePrefills[category];
    },
    [scenePrefills],
  );

  // Phase 4.4: Derive cascade score map for a category (for Explore Drawer ordering)
  const getCascadeScores = useCallback(
    (category: PromptCategory): CascadeScoreMap | undefined => {
      const scored = reorderedOptionsMap.get(category);
      if (!scored || scored.length === 0) return undefined;
      const map: CascadeScoreMap = new Map();
      for (const s of scored) {
        map.set(s.option.toLowerCase(), s.score);
      }
      return map;
    },
    [reorderedOptionsMap],
  );

  // Phase 4.1: Get scene flavour phrases for a category
  const getSceneFlavourPhrases = useCallback(
    (category: PromptCategory): string[] | undefined => {
      if (!activeSceneFlavour) return undefined;
      const phrases =
        activeSceneFlavour[category as keyof typeof activeSceneFlavour];
      return phrases && phrases.length > 0 ? phrases : undefined;
    },
    [activeSceneFlavour],
  );

  const outboundHref = provider.id
    ? `/go/${provider.id}?src=prompt_builder`
    : null;

  const _getLockMessage = () => {
    if (promptLockState === "anonymous_limit") return "Sign in to continue";
    if (promptLockState === "quota_reached") return "Daily limit reached";
    return undefined;
  };

  // ============================================================================
  // Effects
  // ============================================================================

  React.useEffect(() => {
    if (!provider.id) return;
    trackPromptBuilderOpen({
      providerId: provider.id,
      location: "providers_page",
    });
  }, [provider.id]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleSelectChange = useCallback(
    (category: PromptCategory, selected: string[]) => {
      setCategoryState((prev) => ({
        ...prev,
        [category]: { ...prev[category], selected },
      }));
    },
    [],
  );

  const handleCustomChange = useCallback(
    (category: PromptCategory, value: string) => {
      setCategoryState((prev) => ({
        ...prev,
        [category]: { ...prev[category], customValue: value },
      }));
    },
    [],
  );

  const handleRandomise = useCallback(() => {
    if (isLocked) return;

    // Get user's typed subject if present (to preserve it)
    const userSubject = categoryState.subject?.customValue?.trim() || undefined;

    // Generate coherent prompt using style families
    const result = generateCoherentPrompt({
      preserveSubject: userSubject,
      categoryLimits,
    });

    // Build new state from result
    const newState = createInitialState();

    for (const [cat, selected] of Object.entries(result.selections)) {
      const category = cat as PromptCategory;
      newState[category] = {
        selected: selected || [],
        customValue: result.customValues[category] || "",
      };
    }

    setCategoryState(newState);

    // Random aspect ratio (50% chance)
    if (Math.random() > 0.5) {
      const randomAR = pickRandom([...VALID_ASPECT_RATIOS]);
      if (randomAR) setAspectRatio(randomAR);
    } else {
      setAspectRatio(null);
    }
  }, [
    isLocked,
    setAspectRatio,
    categoryState.subject?.customValue,
    categoryLimits,
  ]);

  const handleClear = useCallback(() => {
    if (isLocked) return;
    setCategoryState(createInitialState());
    setAspectRatio(null);
    setScenePrefills(undefined); // Step 2.6: Clear scene tracking on full clear
  }, [isLocked, setAspectRatio]);

  const handleCopyPrompt = useCallback(async () => {
    if (!hasContent || isLocked) return;

    const allowed = await trackUsageCallback(provider.id);
    if (!allowed) return;

    try {
      const textToCopy = optimizedResult.optimized;
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      incrementLifetimePrompts();
      setTimeout(() => setCopied(false), 2000);

      if (provider.id) {
        trackPromptCopy({
          providerId: provider.id,
          promptLength: textToCopy.length,
        });
      }

      // Phase 5: Fire telemetry for the learning pipeline
      // Phase 7.10d: Await to capture eventId for feedback linkage
      const eventId = await sendPromptTelemetry({
        selections,
        healthScore,
        scoreFactors: {
          coherence: promptAnalysis?.dna?.coherenceScore ?? 0,
          fill: promptAnalysis?.summary?.fillPercent ?? 0,
          conflicts: promptAnalysis?.summary?.conflictCount ?? 0,
        },
        promptText: textToCopy,
        platformId,
        tier: platformTier as 1 | 2 | 3 | 4,
        sceneUsed: activeSceneId ?? null,
        copied: true,
        saved: false,
        reusedFromLibrary: false,
        userTier: userTier as "free" | "paid",
        accountAgeDays,
        abHash,
        activeTestId: abTestId,
        activeVariant: abVariant,
      });

      // Phase 7.10d: Schedule feedback widget 4s after copy
      if (eventId && !isDismissedRecently()) {
        const pending: FeedbackPendingData = {
          eventId,
          platform: platformId,
          tier: platformTier as number,
          copiedAt: Date.now(),
        };
        storeFeedbackPending(pending);
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = setTimeout(() => {
          setFeedbackPending(pending);
        }, 4_000);
      }

      // Community Pulse: log user prompt (fire-and-forget)
      // Derives description from subject + style selections
      const subjectTerms = selections.subject ?? [];
      const styleTerms = selections.style ?? [];
      const pulseDesc =
        [subjectTerms[0], styleTerms[0]]
          .filter(Boolean)
          .join(", ")
          .slice(0, 60) || "Custom prompt";
      void fetch("/api/homepage/community-pulse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platformId,
          platformName: provider.name,
          tier: `tier${platformTier}`,
          promptText: textToCopy,
          description: pulseDesc,
          score: healthScore,
          countryCode: locationInfo.countryCode ?? "",
        }),
      }).catch(() => {
        /* fire-and-forget — never block copy */
      });
    } catch (err) {
      console.error("Failed to copy prompt:", err);
    }
  }, [
    hasContent,
    isLocked,
    trackUsageCallback,
    provider.id,
    provider.name,
    optimizedResult,
    selections,
    healthScore,
    promptAnalysis,
    platformTier,
    platformId,
    activeSceneId,
    userTier,
    accountAgeDays,
    abHash,
    abTestId,
    abVariant,
    locationInfo,
  ]);

  // Inline copy: Assembled prompt box (bottom-right icon)
  const handleCopyAssembled = useCallback(async () => {
    if (!hasContent || isLocked) return;
    const allowed = await trackUsageCallback(provider.id);
    if (!allowed) return;
    try {
      await navigator.clipboard.writeText(promptText);
      setCopiedAssembled(true);
      incrementLifetimePrompts();
      setTimeout(() => setCopiedAssembled(false), 2000);
      if (provider.id) {
        trackPromptCopy({
          providerId: provider.id,
          promptLength: promptText.length,
        });
      }
    } catch (err) {
      console.error("Failed to copy assembled prompt:", err);
    }
  }, [hasContent, isLocked, trackUsageCallback, provider.id, promptText]);

  // Inline copy: Optimized prompt box (bottom-right icon)
  const handleCopyOptimized = useCallback(async () => {
    if (!hasContent || isLocked) return;
    const allowed = await trackUsageCallback(provider.id);
    if (!allowed) return;
    try {
      const textToCopy = optimizedResult.optimized;
      await navigator.clipboard.writeText(textToCopy);
      setCopiedOptimized(true);
      incrementLifetimePrompts();
      setTimeout(() => setCopiedOptimized(false), 2000);
      if (provider.id) {
        trackPromptCopy({
          providerId: provider.id,
          promptLength: textToCopy.length,
        });
      }
    } catch (err) {
      console.error("Failed to copy optimized prompt:", err);
    }
  }, [hasContent, isLocked, trackUsageCallback, provider.id, optimizedResult]);

  const handleDone = useCallback(() => {
    onDone?.();
  }, [onDone]);

  // Handle save to library
  const handleSavePrompt = useCallback(
    (data: SavePromptData) => {
      if (!hasContent) return;

      // Get analysis data for the saved prompt
      const coherenceScore = promptAnalysis?.dna?.coherenceScore ?? 75;
      const dominantFamily = promptAnalysis?.dna?.dominantFamily ?? null;
      const dominantMood = promptAnalysis?.dna?.dominantMood ?? "neutral";

      // Extract families from selections
      const families: string[] = [];
      if (dominantFamily) families.push(dominantFamily);

      // Build custom values
      const customValues: Partial<Record<PromptCategory, string>> = {};
      for (const [cat, state] of Object.entries(categoryState)) {
        if (state.customValue.trim()) {
          customValues[cat as PromptCategory] = state.customValue.trim();
        }
      }

      const result = savePrompt({
        name: data.name,
        platformId,
        platformName: provider.name,
        positivePrompt: optimizedResult.optimized,
        negativePrompt:
          negativesArray.length > 0 ? negativesArray.join(", ") : undefined,
        selections,
        customValues,
        families,
        mood: dominantMood as "calm" | "intense" | "neutral",
        coherenceScore,
        characterCount: optimizedResult.optimizedLength,
        notes: data.notes,
        tags: data.tags,
      });

      if (result) {
        setShowSaveModal(false);
        setSavedConfirmation(true);
        setTimeout(() => setSavedConfirmation(false), 2000);

        // Phase 5: Fire telemetry for the learning pipeline (fire-and-forget)
        sendPromptTelemetry({
          selections,
          healthScore,
          scoreFactors: {
            coherence: promptAnalysis?.dna?.coherenceScore ?? 0,
            fill: promptAnalysis?.summary?.fillPercent ?? 0,
            conflicts: promptAnalysis?.summary?.conflictCount ?? 0,
          },
          promptText: optimizedResult.optimized,
          platformId,
          tier: platformTier as 1 | 2 | 3 | 4,
          sceneUsed: activeSceneId ?? null,
          copied: false,
          saved: true,
          reusedFromLibrary: false,
          userTier: userTier as "free" | "paid",
          accountAgeDays,
          abHash,
          activeTestId: abTestId,
          activeVariant: abVariant,
        });
      }
    },
    [
      hasContent,
      promptAnalysis,
      categoryState,
      savePrompt,
      platformId,
      provider.name,
      optimizedResult,
      negativesArray,
      selections,
      healthScore,
      platformTier,
      activeSceneId,
      userTier,
      accountAgeDays,
      abHash,
      abTestId,
      abVariant,
    ],
  );

  // Generate suggested name from selections
  const suggestedSaveName = useMemo(() => {
    const parts: string[] = [];

    // Add subject if present
    const subject = categoryState.subject?.customValue?.trim();
    if (subject && subject.length < 30) {
      parts.push(subject);
    }

    // Add first style
    const style = categoryState.style?.selected[0];
    if (style) parts.push(style);

    // Add first atmosphere
    const atmosphere = categoryState.atmosphere?.selected[0];
    if (atmosphere && parts.length < 2) parts.push(atmosphere);

    if (parts.length > 0) {
      return parts.join(" · ");
    }

    return "";
  }, [categoryState]);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <section
      id={id}
      aria-label={`Prompt builder for ${provider.name}`}
      className="relative flex h-full min-h-0 flex-col rounded-3xl bg-slate-950/70 shadow-sm ring-1 ring-white/10"
    >
      {/* Lock overlay when at limit */}
      <LockOverlay
        lockState={promptLockState}
        anonymousRemaining={anonymousUsage?.remaining}
        dailyRemaining={dailyUsage?.remaining}
        dailyResetTime={dailyUsage?.resetTime}
      />

      {/* Fixed Header */}
      <header className="shrink-0 border-b border-slate-800/50 p-4 md:px-6 md:pt-5">
        <div className="flex flex-col gap-1">
          {/* Title row with toggles (left) and counter (right) */}
          <div className="flex items-center justify-between gap-2">
            {/* Left side: Title/Selector + Toggles */}
            <div className="flex items-center gap-3">
              {/* Provider selector (Playground) or static title (Provider page) */}
              {providerSelector ? (
                <div className="flex items-center gap-2">
                  {providerSelector}
                  <span className="text-sm text-slate-200">
                    · Prompt builder
                  </span>
                </div>
              ) : (
                <h2 className="text-lg font-semibold text-slate-50">
                  {provider.name} · Prompt builder
                </h2>
              )}

              {/* Tier badge — shows prompt style this platform expects */}
              {tierBadge && (
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tierBadge.bg} ${tierBadge.text} ${tierBadge.ring}`}
                  title={`Tier ${platformTier}: ${tierBadge.label} — this platform works best with ${platformTier <= 2 ? "keyword-based" : "natural language"} prompts`}
                >
                  {tierBadge.label}
                </span>
              )}

              {/* Composition mode toggle */}
              <CompositionModeToggle
                compositionMode={compositionMode}
                onModeChange={setCompositionMode}
                platformId={platformId}
                disabled={isLocked}
                compact
              />

              {/* Divider */}
              <span className="text-slate-600" aria-hidden="true">
                │
              </span>

              {/* Text Length Optimizer toggle — locked for anonymous users */}
              <TextLengthOptimizer
                isEnabled={isOptimizerEnabled}
                onToggle={setOptimizerEnabled}
                platformId={platformId}
                platformName={provider.name}
                disabled={isOptimizerDisabled || isLocked || !isAuthenticated}
                tooltipContent={tooltipContent}
                analysis={hasContent ? analysis : null}
                compact
                lockedForAnonymous={!isAuthenticated}
              />

              {/* Pro Promagen: Colour legend — centered between optimizer and intelligence badges */}
              {hasContent && <CategoryColourLegend isPro={isPro} />}
            </div>

            {/* Right side: Intelligence badges + Usage counter */}
            <div className="flex items-center gap-3">
              {/* Prompt Intelligence indicators */}
              {hasContent && promptAnalysis && (
                <div className="flex items-center gap-2">
                  {/* Conflict warning - only if enabled in preferences */}
                  {intelligencePrefs.conflictWarningsEnabled &&
                    conflictCount > 0 && (
                      <ConflictWarning
                        conflicts={promptAnalysis.conflicts.conflicts}
                        hasHardConflicts={hasHardConflicts}
                        variant="badge"
                      />
                    )}
                  {/* Health badge - only if enabled in preferences */}
                  {intelligencePrefs.showCoherenceScore && (
                    <HealthBadge
                      score={healthScore}
                      hasConflicts={conflictCount > 0}
                      hasHardConflicts={hasHardConflicts}
                      variant="score"
                    />
                  )}
                </div>
              )}

              {isMounted && !isAuthenticated && anonymousUsage && (
                <AnonymousCounter
                  count={anonymousUsage.count}
                  limit={anonymousUsage.limit}
                />
              )}
              {isMounted &&
                isAuthenticated &&
                dailyUsage &&
                dailyUsage.limit !== null && (
                  <DailyCounter
                    count={dailyUsage.count}
                    limit={dailyUsage.limit}
                  />
                )}
            </div>
          </div>

          {/* Subtitle */}
          <p className="text-sm bg-gradient-to-r from-cyan-400 via-sky-400 to-purple-400 bg-clip-text text-transparent">
            Build your prompt by selecting from the criteria below. Not every
            field is required, but the more detail you provide, the better your
            results will be. Custom entries accepted.
          </p>

          {/* Paid user badge */}
          {userTier === "paid" && (
            <span className="inline-flex items-center gap-1 self-start rounded-full bg-purple-600/20 px-2 py-0.5 text-xs font-medium text-purple-300 ring-1 ring-purple-500/30">
              <svg
                className="h-3 w-3"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              Pro: Enhanced limits active
            </span>
          )}
        </div>
      </header>

      {/* Scrollable Content Area */}
      <section
        aria-label="Prompt editor"
        className={`min-h-0 flex-1 overflow-y-auto p-4 pr-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30 md:px-6 md:pr-3 ${
          isLocked ? "pointer-events-none opacity-50" : ""
        }`}
      >
        <div className="flex flex-col gap-4">
          {/* Instruction text - green style */}
          <p className="text-xs text-emerald-400">
            <span className="text-emerald-400">
              Click Done or click away to close dropdowns. Type in any field to
              add custom entries.
            </span>
          </p>

          {/* ════════════════════════════════════════════════════════ */}
          {/* Scene Starters — quick-start strip (Phase 2)           */}
          {/* Sits between instructions and category grid.           */}
          {/* Collapsed by default. Expands to show world accordion. */}
          {/* ════════════════════════════════════════════════════════ */}
          <SceneSelector
            categoryState={categoryState}
            setCategoryState={setCategoryState}
            userTier={userTier}
            isLocked={isLocked}
            onActiveSceneChange={handleActiveSceneChange}
            platformTier={platformTier}
            feedbackTermHints={rawTermHints}
            initialSceneId={preloadedSceneId}
          />

          {/* ════════════════════════════════════════════════════════ */}
          {/* Describe Your Image — Human Sentence Conversion         */}
          {/* Prompt Lab only (providerSelector is the differentiator) */}
          {/* Collapsed by default. Expands to textarea + Generate.   */}
          {/* Authority: human-sentence-conversion.md                  */}
          {/* ════════════════════════════════════════════════════════ */}
          {providerSelector && (
            <DescribeYourImage
              categoryState={categoryState}
              setCategoryState={setCategoryState}
              isLocked={isLocked}
              onTextChange={onDescribeTextChange}
              onGenerate={onDescribeGenerate}
              isDrifted={isDrifted}
              driftChangeCount={driftChangeCount}
            />
          )}

          {/* Category dropdowns grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {displayCategories.map((category) => {
              const config = getEnhancedCategoryConfig(category);
              if (!config) return null;

              const state = categoryState[category];
              const isNegative = category === "negative";
              const maxSelections = categoryLimits[category] ?? 1;
              const allowFreeText = isNegative ? allowNegativeFreeText : true;

              // Generate dynamic tooltip based on actual platform limit
              const dynamicTooltip = getDynamicTooltipGuidance(
                category,
                maxSelections,
                config.tooltipGuidance,
                platformId,
              );

              return (
                <div
                  key={category}
                  className={isNegative ? "sm:col-span-2 lg:col-span-4" : ""}
                >
                  <Combobox
                    id={`${id}-${category}`}
                    label={config.label}
                    description={undefined}
                    tooltipGuidance={dynamicTooltip}
                    options={getOptionsForCategory(category, config.options)}
                    selected={state.selected}
                    customValue={state.customValue}
                    onSelectChange={(selected) =>
                      handleSelectChange(category, selected)
                    }
                    onCustomChange={(value) =>
                      handleCustomChange(category, value)
                    }
                    placeholder={`Select ${config.label.toLowerCase()}...`}
                    maxSelections={maxSelections}
                    maxCustomChars={50}
                    allowFreeText={allowFreeText}
                    isLocked={isLocked}
                    chipOptions={getCategoryChips(
                      category,
                      state.selected,
                      state.customValue,
                    )}
                    chipSectionLabel="More options"
                    sceneOriginValues={getSceneOriginValues(category)}
                    onCustomTermSubmitted={(term) =>
                      submitCustomTerm(term, category)
                    }
                    feedbackHintTerms={feedbackHintTerms}
                    labelColour={isPro ? CATEGORY_COLOURS[category] : undefined}
                  />
                  {/* Improvement 3: Negative overflow badge — shows when "Try in" carried more negatives than the dropdown limit */}
                  {isNegative &&
                    state.customValue &&
                    state.selected.length >= maxSelections && (
                      <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-200">
                        <svg
                          className="h-3 w-3 text-sky-400"
                          viewBox="0 0 16 16"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm6.5-.25A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                          />
                        </svg>
                        <span>
                          {state.selected.length} shown +{" "}
                          {state.customValue.split(",").filter(Boolean).length}{" "}
                          overflow — all included in prompt
                        </span>
                      </div>
                    )}
                  {/* Phase 3: Explore Drawer — expandable vocabulary panel */}
                  <ExploreDrawer
                    category={category}
                    selectedTerms={state.selected}
                    onAddTerm={(term) =>
                      handleSelectChange(category, [...state.selected, term])
                    }
                    maxSelections={maxSelections}
                    isLocked={isLocked}
                    platformTier={platformTier}
                    isExpanded={expandedExploreCategory === category}
                    onToggle={() =>
                      setExpandedExploreCategory(
                        expandedExploreCategory === category ? null : category,
                      )
                    }
                    sceneFlavourPhrases={getSceneFlavourPhrases(category)}
                    cascadeScores={getCascadeScores(category)}
                    compressionLookup={compressionLookup}
                  />
                </div>
              );
            })}
          </div>

          {/* Prompt Intelligence Suggestions - only if enabled in preferences */}
          {intelligencePrefs.suggestionsEnabled &&
            hasContent &&
            topSuggestions.length > 0 && (
              <div className="rounded-lg border border-slate-800/50 bg-slate-900/30 px-3 py-2">
                <SuggestionChips
                  suggestions={topSuggestions}
                  onSelect={handleSuggestionClick}
                  maxChips={intelligencePrefs.compactSuggestions ? 4 : 6}
                  showScore={!intelligencePrefs.compactSuggestions}
                  size="sm"
                />
              </div>
            )}

          {/* Aspect Ratio Selector - 13th row */}
          <div className="border-t border-slate-800/50 pt-4">
            <AspectRatioSelector
              selected={aspectRatio}
              onSelect={setAspectRatio}
              platformId={platformId}
              compositionMode={compositionMode}
              disabled={false}
              isLocked={isLocked}
            />
          </div>

          {/* Platform tips */}
          {assembled.tips && (
            <div className="rounded-lg border border-sky-900/50 bg-sky-950/30 px-3 py-2">
              <p className="text-xs text-sky-200">
                <span className="font-medium">💡 {provider.name}:</span>{" "}
                {assembled.tips}
              </p>
            </div>
          )}

          {/* Sparse input warning */}
          {hasContent && Object.keys(selections).length < 3 && (
            <p className="text-xs text-slate-200">
              💡 Tip: Add more detail for better results
            </p>
          )}

          {/* ============================================================ */}
          {/* Preview Area */}
          {/* ============================================================ */}
          <div className="flex flex-col gap-2 mt-2">
            {/* Header row: "Assembled prompt" + char count + Clear all */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-white">
                  Assembled prompt
                </span>
                {/* Improvement 2: Stage indicator badge */}
                {hasContent && (
                  <StageBadge
                    compositionMode={compositionMode}
                    isOptimizerEnabled={isOptimizerEnabled}
                    wasOptimized={wasOptimized}
                  />
                )}
                {/* DNA Bar - shows category fill status (only if enabled in preferences) */}
                {intelligencePrefs.showDNABar &&
                  hasContent &&
                  promptAnalysis && (
                    <DNABar
                      dna={promptAnalysis.dna}
                      showCoherence={intelligencePrefs.showCoherenceScore}
                      showTooltips={intelligencePrefs.showWhyThisTooltips}
                      size="sm"
                    />
                  )}
              </div>
              <div className="flex items-center gap-3">
                {/* Char count + token estimate inline */}
                {hasContent && (
                  <span className="flex items-center gap-2 text-xs tabular-nums">
                    <span className="text-slate-200">
                      {promptText.length} chars
                    </span>
                    {assembled.estimatedTokens != null && (
                      <span
                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${
                          assembled.tokenLimit &&
                          assembled.estimatedTokens > assembled.tokenLimit
                            ? "bg-amber-500/10 text-amber-400"
                            : "text-slate-200"
                        }`}
                        title={
                          assembled.tokenLimit &&
                          assembled.estimatedTokens > assembled.tokenLimit
                            ? `Estimated ${assembled.estimatedTokens} tokens exceeds this platform's ${assembled.tokenLimit}-token encoding window. Tail terms may receive weaker attention.`
                            : `Estimated CLIP tokens (approximate)`
                        }
                      >
                        {assembled.tokenLimit &&
                          assembled.estimatedTokens > assembled.tokenLimit && (
                            <svg
                              className="h-3 w-3 flex-shrink-0"
                              viewBox="0 0 16 16"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575L6.457 1.047ZM8 5a.75.75 0 0 1 .75.75v2.5a.75.75 0 0 1-1.5 0v-2.5A.75.75 0 0 1 8 5Zm0 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                              />
                            </svg>
                          )}
                        ~{assembled.estimatedTokens}
                        {assembled.tokenLimit
                          ? `/${assembled.tokenLimit}`
                          : ""}{" "}
                        tokens
                      </span>
                    )}
                  </span>
                )}
                {hasContent && !isLocked && (
                  <button
                    type="button"
                    onClick={() => {
                      handleClear();
                      setInspiredByData(null);
                      setWeatherWeightOverrides(undefined);
                    }}
                    className="text-xs font-medium bg-gradient-to-r from-sky-400 via-emerald-300 to-indigo-400 bg-clip-text text-transparent hover:from-sky-300 hover:via-emerald-200 hover:to-indigo-300 transition-all cursor-pointer"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>

            {/* §4.5 #2: "Inspired by" weather badge — shows when prompt was loaded from homepage */}
            {inspiredByData && hasContent && (
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href="/"
                  className="group flex items-center gap-2 rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-1.5 transition-colors hover:border-sky-500/30 hover:bg-sky-500/8"
                >
                  <span className="text-xs text-sky-300/90">
                    {inspiredByData.emoji} Inspired by live weather in{" "}
                    {inspiredByData.city}, {inspiredByData.venue}
                    {" · "}
                    {inspiredByData.localTime}
                    {inspiredByData.tempC !== null
                      ? ` · ${inspiredByData.tempC}°C`
                      : ""}
                    {" · "}
                    {inspiredByData.conditions}
                  </span>
                  <span className="text-xs text-sky-400 opacity-0 transition-opacity group-hover:opacity-100">
                    ← back
                  </span>
                </a>
                {/* Upgrade 5: Prompt Fingerprint Verification badge */}
                {fingerprintStatus === "match" && (
                  <span
                    className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400"
                    title="Builder selections match the original weather-generated prompt exactly"
                  >
                    <svg
                      className="h-3 w-3"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"
                      />
                    </svg>
                    Matches original
                  </span>
                )}
                {fingerprintStatus === "modified" && (
                  <span
                    className="inline-flex items-center gap-1 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400"
                    title="You've edited selections — prompt differs from the original weather-generated version"
                  >
                    <svg
                      className="h-3 w-3"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Zm1.414 1.06a.25.25 0 0 0-.354 0L3.463 11.098l-.47 1.643 1.643-.47 8.61-8.61a.25.25 0 0 0 0-.354l-1.086-1.086Z"
                      />
                    </svg>
                    Modified from original
                  </span>
                )}
              </div>
            )}

            {/* Original prompt preview box */}
            <div
              className={`
                min-h-[80px] max-h-[200px] overflow-y-auto rounded-xl border bg-slate-950/80 p-3 text-sm scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30
                ${hasContent ? "border-slate-600 text-slate-100" : "border-slate-800 text-slate-500"}
              `}
            >
              {hasContent ? (
                <pre className="whitespace-pre-wrap font-sans text-[0.8rem] leading-relaxed">
                  {/* Improvement 1: Show diff highlights when switching modes */}
                  {diffActive && diffResults.length > 0 ? (
                    <DiffHighlightedText
                      text={promptText}
                      diffs={diffResults}
                      fadingOut={diffFading}
                    />
                  ) : (
                    <ColourCodedPromptText
                      text={promptText}
                      termIndex={colourTermIndex}
                      isPro={isPro}
                      fallbackClass="text-slate-100"
                    />
                  )}
                  {/* Inline copy icon — flows after last character, floats right */}
                  {!isLocked && (
                    <span className="ml-1 inline-flex float-right gap-1">
                      <SaveIcon
                        positivePrompt={promptText}
                        platformId={provider.id ?? ""}
                        platformName={provider.name}
                        source="builder"
                        tier={platformTier}
                        selections={selections as Record<string, unknown>}
                        size="sm"
                      />
                      <button
                        type="button"
                        onClick={handleCopyAssembled}
                        className={`inline-flex items-center justify-center rounded-md p-1 transition-all cursor-pointer ${
                          copiedAssembled
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
                        }`}
                        title={
                          copiedAssembled ? "Copied!" : "Copy assembled prompt"
                        }
                        aria-label={
                          copiedAssembled
                            ? "Copied to clipboard"
                            : "Copy assembled prompt to clipboard"
                        }
                      >
                        {copiedAssembled ? (
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                        )}
                      </button>
                    </span>
                  )}
                </pre>
              ) : (
                <span className="italic text-xs">
                  Start selecting options above to build your {provider.name}{" "}
                  prompt...
                </span>
              )}
            </div>

            {/* ============================================================ */}
            {/* Optimization Section - Shows when optimizer is enabled */}
            {/* Shows amber bar when prompt will be trimmed on copy */}
            {/* Shows green bar when prompt is already within optimal range */}
            {/* ============================================================ */}
            {hasContent && isOptimizerEnabled && wasOptimized && (
              <div className="flex flex-col gap-2 mt-2">
                {/* Info bar: "Optimized: X → Y chars" + removed terms */}
                <div className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400">↓</span>
                    <span className="text-xs text-amber-200">
                      <span className="font-medium">Optimized:</span>{" "}
                      {optimizedResult.originalLength} →{" "}
                      {optimizedResult.optimizedLength} chars{" "}
                      <span className="text-amber-400/60">
                        (saved{" "}
                        {optimizedResult.originalLength -
                          optimizedResult.optimizedLength}
                        )
                      </span>
                    </span>
                  </div>
                  {/* Show what was removed and why */}
                  {optimizedResult.removedTermNames &&
                    optimizedResult.removedTermNames.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {optimizedResult.removedTermNames.map((name, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center rounded-md bg-amber-900/30 px-1.5 py-0.5 text-xs text-amber-300"
                          >
                            ✕ {name}
                          </span>
                        ))}
                      </div>
                    )}
                </div>

                {/* Phase D: Optimization Transparency Panel (Pro-only) */}
                <OptimizationTransparencyPanel
                  removedTerms={optimizedResult.removedTerms ?? []}
                  achievedAtPhase={optimizedResult.achievedAtPhase ?? -1}
                  originalLength={optimizedResult.originalLength}
                  optimizedLength={optimizedResult.optimizedLength}
                  isPro={userTier === "paid"}
                  conversions={assembled.conversions}
                  conversionBudget={assembled.conversionBudget}
                />

                {/* Optimized prompt preview box - SAME STYLING as Assembled prompt */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-emerald-300">
                    Optimized prompt
                  </span>
                  <span className="text-xs text-emerald-400/70 tabular-nums">
                    {optimizedResult.optimizedLength} chars
                  </span>
                </div>
                <div className="min-h-[60px] max-h-[150px] overflow-y-auto rounded-xl border border-emerald-600/50 bg-emerald-950/20 p-3 text-sm scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30">
                  <pre className="whitespace-pre-wrap font-sans text-[0.8rem] leading-relaxed text-emerald-100">
                    <ColourCodedPromptText
                      text={optimizedResult.optimized}
                      termIndex={colourTermIndex}
                      isPro={isPro}
                      fallbackClass="text-emerald-100"
                    />
                    {/* Inline copy icon — flows after last character, floats right */}
                    {!isLocked && (
                      <span className="ml-1 inline-flex float-right gap-1">
                        <SaveIcon
                          positivePrompt={promptText}
                          optimisedPrompt={optimizedResult.optimized}
                          isOptimised={true}
                          platformId={provider.id ?? ""}
                          platformName={provider.name}
                          source="builder"
                          tier={platformTier}
                          selections={selections as Record<string, unknown>}
                          size="sm"
                        />
                        <button
                          type="button"
                          onClick={handleCopyOptimized}
                          className={`inline-flex items-center justify-center rounded-md p-1 transition-all cursor-pointer ${
                            copiedOptimized
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-white/5 text-emerald-300 hover:bg-white/10 hover:text-emerald-200 cursor-pointer"
                          }`}
                          title={
                            copiedOptimized
                              ? "Copied!"
                              : "Copy optimized prompt"
                          }
                          aria-label={
                            copiedOptimized
                              ? "Copied to clipboard"
                              : "Copy optimized prompt to clipboard"
                          }
                        >
                          {copiedOptimized ? (
                            <svg
                              className="h-3.5 w-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2.5}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          ) : (
                            <svg
                              className="h-3.5 w-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                              />
                            </svg>
                          )}
                        </button>
                      </span>
                    )}
                  </pre>
                </div>

                {/* Length indicator */}
                <LengthIndicator
                  analysis={analysis}
                  isOptimizerEnabled={isOptimizerEnabled}
                  optimizedLength={optimizedResult.optimizedLength}
                  willTrim={true}
                />
              </div>
            )}

            {/* Optimized preview when optimizer enabled but prompt is already optimal */}
            {hasContent && isOptimizerEnabled && !wasOptimized && (
              <div className="flex flex-col gap-2 mt-2">
                {/* Info bar: "Already within optimal range" */}
                <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400">✓</span>
                      <span className="text-xs text-emerald-200">
                        <span className="font-medium">
                          Within optimal range
                        </span>{" "}
                        — {optimizedResult.optimizedLength} chars
                      </span>
                    </div>
                    <span className="text-[0.7rem] text-emerald-400/70">
                      No trimming needed
                    </span>
                  </div>
                </div>

                {/* Optimized prompt preview box */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-emerald-300">
                    Optimized prompt
                  </span>
                  <span className="text-xs text-emerald-400/70 tabular-nums">
                    {optimizedResult.optimizedLength} chars
                  </span>
                </div>
                <div className="min-h-[60px] max-h-[150px] overflow-y-auto rounded-xl border border-emerald-600/50 bg-emerald-950/20 p-3 text-sm scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30">
                  <pre className="whitespace-pre-wrap font-sans text-[0.8rem] leading-relaxed text-emerald-100">
                    <ColourCodedPromptText
                      text={optimizedResult.optimized}
                      termIndex={colourTermIndex}
                      isPro={isPro}
                      fallbackClass="text-emerald-100"
                    />
                    {/* Inline copy icon — flows after last character, floats right */}
                    {!isLocked && (
                      <span className="ml-1 inline-flex float-right gap-1">
                        <SaveIcon
                          positivePrompt={promptText}
                          optimisedPrompt={optimizedResult.optimized}
                          isOptimised={true}
                          platformId={provider.id ?? ""}
                          platformName={provider.name}
                          source="builder"
                          tier={platformTier}
                          selections={selections as Record<string, unknown>}
                          size="sm"
                        />
                        <button
                          type="button"
                          onClick={handleCopyOptimized}
                          className={`inline-flex items-center justify-center rounded-md p-1 transition-all cursor-pointer ${
                            copiedOptimized
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-white/5 text-emerald-300 hover:bg-white/10 hover:text-emerald-200 cursor-pointer"
                          }`}
                          title={
                            copiedOptimized
                              ? "Copied!"
                              : "Copy optimized prompt"
                          }
                          aria-label={
                            copiedOptimized
                              ? "Copied to clipboard"
                              : "Copy optimized prompt to clipboard"
                          }
                        >
                          {copiedOptimized ? (
                            <svg
                              className="h-3.5 w-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2.5}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          ) : (
                            <svg
                              className="h-3.5 w-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                              />
                            </svg>
                          )}
                        </button>
                      </span>
                    )}
                  </pre>
                </div>

                {/* Length indicator */}
                <LengthIndicator
                  analysis={analysis}
                  isOptimizerEnabled={isOptimizerEnabled}
                  optimizedLength={optimizedResult.optimizedLength}
                  willTrim={false}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Fixed Footer with Actions */}
      <footer
        className={`shrink-0 border-t border-slate-800/50 p-4 md:px-6 ${
          isLocked ? "pointer-events-none opacity-50" : ""
        }`}
      >
        <div className="flex flex-wrap items-center justify-center gap-3">
          {/* Copy prompt button */}
          <button
            type="button"
            onClick={handleCopyPrompt}
            disabled={!hasContent || isLocked}
            className={`
              inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-sm transition-all
              ${
                hasContent && !isLocked
                  ? "border-slate-600 bg-slate-900 text-slate-50 hover:border-slate-400 hover:bg-slate-800 cursor-pointer"
                  : "cursor-not-allowed border-slate-800 bg-slate-900/50 text-slate-600"
              }
              focus-visible:outline-none focus-visible:ring focus-visible:ring-sky-400/80
            `}
          >
            {copied ? (
              <>
                <svg
                  className="h-4 w-4 text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                {isOptimizerEnabled && wasOptimized
                  ? "Copy optimized prompt"
                  : "Copy prompt"}
              </>
            )}
          </button>

          {/* 🎲 Randomise button */}
          <button
            type="button"
            onClick={handleRandomise}
            disabled={isLocked}
            className={`inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-sm transition-all focus-visible:outline-none focus-visible:ring focus-visible:ring-purple-400/80 ${
              isLocked
                ? "cursor-not-allowed border-slate-700 bg-slate-800/50 text-slate-500"
                : "border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-purple-100 hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400 cursor-pointer"
            }`}
          >
            <span className="text-base">🎲</span>
            Randomise
          </button>

          {/* Save to Library button */}
          <button
            type="button"
            onClick={() => setShowSaveModal(true)}
            disabled={!hasContent || isLocked}
            className={`inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-sm transition-all focus-visible:outline-none focus-visible:ring focus-visible:ring-emerald-400/80 ${
              hasContent && !isLocked
                ? savedConfirmation
                  ? "border-emerald-400 bg-emerald-500/20 text-emerald-300 cursor-pointer"
                  : "border-emerald-500/70 bg-gradient-to-r from-emerald-600/20 to-teal-600/20 text-emerald-100 hover:from-emerald-600/30 hover:to-teal-600/30 hover:border-emerald-400 cursor-pointer"
                : "cursor-not-allowed border-slate-700 bg-slate-800/50 text-slate-500"
            }`}
          >
            {savedConfirmation ? (
              <>
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Saved!
              </>
            ) : (
              <>
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                  />
                </svg>
                Save
              </>
            )}
          </button>

          {/* Done button */}
          <button
            type="button"
            onClick={handleDone}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-600 bg-slate-800 px-5 py-2 text-sm font-medium text-slate-100 shadow-sm transition-all hover:border-slate-400 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring focus-visible:ring-sky-400/80 cursor-pointer"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            Done
          </button>

          {/* Open in platform button */}
          {outboundHref && (
            <a
              href={outboundHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-sky-500/70 bg-sky-600/10 px-4 py-2 text-sm font-medium text-sky-100 hover:bg-sky-500/20 focus-visible:outline-none focus-visible:ring focus-visible:ring-sky-400/80 cursor-pointer"
            >
              <svg
                className="h-4 w-4 text-sky-100"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
              <span className="text-sky-100">Open in {provider.name}</span>
            </a>
          )}

          {/* Prompt Lab link — visible when on single-provider builder (not playground) */}
          {/* TODO: Gate behind userTier === 'paid' for production launch */}
          {!providerSelector && (
            <a
              href="/studio/playground"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-amber-500/70 bg-gradient-to-r from-amber-600/20 to-orange-600/20 px-4 py-2 text-sm font-medium text-amber-100 hover:from-amber-600/30 hover:to-orange-600/30 hover:border-amber-400 focus-visible:outline-none focus-visible:ring focus-visible:ring-amber-400/80 cursor-pointer"
            >
              <svg
                className="text-amber-100"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
                style={{
                  width: "clamp(14px, 1vw, 18px)",
                  height: "clamp(14px, 1vw, 18px)",
                }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"
                />
              </svg>
              <span className="text-amber-100">Prompt Lab</span>
            </a>
          )}
        </div>
      </footer>

      {/* Phase 7.10g: Feedback Memory Banner — contextual overlap hint */}
      {feedbackOverlap && !feedbackPending && (
        <div style={{ marginTop: "clamp(6px, 0.4vw, 10px)" }}>
          <FeedbackMemoryBanner
            overlap={feedbackOverlap}
            platformName={provider.name}
            userTier={userTier as string | null}
          />
        </div>
      )}

      {/* Phase 7.10d: Feedback Invitation Widget */}
      {feedbackPending && (
        <div style={{ marginTop: "clamp(8px, 0.6vw, 12px)" }}>
          <FeedbackInvitation
            pending={feedbackPending}
            userContext={{
              userTier: userTier as string | null,
              accountAgeDays,
            }}
            onComplete={(rating?: FeedbackRating) => {
              // Phase 7.10g: Record to feedback memory if rated
              if (rating && feedbackPending) {
                recordRatedPrompt(
                  platformId,
                  rating,
                  selections,
                  feedbackPending.eventId,
                );
              }
              setFeedbackPending(null);
              if (feedbackTimerRef.current) {
                clearTimeout(feedbackTimerRef.current);
                feedbackTimerRef.current = null;
              }
            }}
          />
        </div>
      )}

      {/* Save Prompt Modal */}
      <SavePromptModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSavePrompt}
        promptPreview={optimizedResult.optimized.slice(0, 200)}
        platformName={provider.name}
        suggestedName={suggestedSaveName}
      />
    </section>
  );
}

export default PromptBuilder;
