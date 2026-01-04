// src/components/providers/prompt-builder.tsx
// ============================================================================
// ENHANCED PROMPT BUILDER v7.1.0 — Text Length Optimizer with Preview
// ============================================================================
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
// - Free authenticated users get 30/day
// - Paid users get unlimited + enhanced category limits
// - Lock states with purple-pink gradient (matches brand)
// - 🎲 Randomise button fills ALL categories including AR and negative
// - Clear all button styled with Core Colours gradient
// - Conditional free text for negative based on platform support
//
// Authority: docs/authority/paid_tier.md, docs/authority/prompt-builder-page.md
// ============================================================================

'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { SignInButton } from '@clerk/nextjs';
import { trackPromptBuilderOpen, trackPromptCopy } from '@/lib/analytics/providers';
import {
  assemblePrompt,
  formatPromptForCopy,
  getCategoryConfig,
  getAllCategories,
  supportsNativeNegative,
} from '@/lib/prompt-builder';
import { assembleCompositionPack, platformSupportsAR } from '@/lib/composition-engine';
import { Combobox } from '@/components/ui/combobox';
import { AspectRatioSelector } from '@/components/providers/aspect-ratio-selector';
import { CompositionModeToggle } from '@/components/composition-mode-toggle';
import { TextLengthOptimizer } from '@/components/providers/text-length-optimizer';
import { LengthIndicator } from '@/components/providers/length-indicator';
import { usePromagenAuth, type PromptLockState } from '@/hooks/use-promagen-auth';
import { useCompositionMode } from '@/hooks/use-composition-mode';
import { usePromptOptimization } from '@/hooks/use-prompt-optimization';
import type { PromptCategory, PromptSelections, CategoryState } from '@/types/prompt-builder';
import { CATEGORY_ORDER } from '@/types/prompt-builder';
import { VALID_ASPECT_RATIOS } from '@/types/composition';

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
}

// Categories to randomise - ALL categories now (except we handle negative specially)
const CORE_CATEGORIES: PromptCategory[] = [
  'subject',
  'action',
  'style',
  'environment',
  'lighting',
  'camera',
  'colour',
];

// Secondary categories (always included in randomise now)
const SECONDARY_CATEGORIES: PromptCategory[] = [
  'composition',
  'atmosphere',
  'materials',
  'fidelity',
];

// Platforms that use --no inline for negatives
const MIDJOURNEY_FAMILY = ['midjourney', 'bluewillow', 'nijijourney'];

// Initial state for all categories (12 total)
const createInitialState = (): Record<PromptCategory, CategoryState> => {
  const categories = getAllCategories();
  const state: Partial<Record<PromptCategory, CategoryState>> = {};
  for (const cat of categories) {
    state[cat] = { selected: [], customValue: '' };
  }
  return state as Record<PromptCategory, CategoryState>;
};

// Helper: pick random item from array
const pickRandom = <T,>(arr: T[]): T | undefined => {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
};

// Helper: pick multiple random items from array (no duplicates)
const pickMultipleRandom = <T,>(arr: T[], count: number): T[] => {
  if (arr.length === 0 || count <= 0) return [];
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, arr.length));
};

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

  const isMidjourneyFamily = MIDJOURNEY_FAMILY.includes(platformId.toLowerCase());

  if (isMidjourneyFamily && basePrompt.includes(' --no ')) {
    const parts = basePrompt.split(' --no ');
    const positiveSection = parts[0] ?? '';
    const negativeSection = parts[1] ?? '';
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
// Lock Overlay Components
// ============================================================================

interface LockOverlayProps {
  lockState: PromptLockState;
  anonymousRemaining?: number | null;
  dailyRemaining?: number | null;
  dailyResetTime?: string | null;
}

function LockOverlay({ lockState, dailyResetTime }: LockOverlayProps) {
  if (lockState === 'unlocked') return null;

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

  const isAnonymousLimit = lockState === 'anonymous_limit';
  const isQuotaReached = lockState === 'quota_reached';

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
                You&apos;ve used your 5 free prompts
              </h3>
              <p className="text-sm text-purple-200">
                Sign in to unlock 30 prompts per day — free forever.
              </p>
              <ul className="mt-0.1 text-left text-xs text-purple-300 space-y-1">
                <li className="flex items-center gap-2">
                  <svg className="h-3.5 w-3.5 text-emerald-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>30 prompts per day (resets at midnight)</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="h-3.5 w-3.5 text-emerald-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Dynamic composition packs</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="h-3.5 w-3.5 text-emerald-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
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
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Upgrade to Pro
            </button>
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-semibold text-white">Daily limit reached</h3>
              <p className="text-sm text-purple-200">
                {getTimeUntilReset() ? `Resets in ${getTimeUntilReset()}` : 'Resets at midnight in your timezone'}
              </p>
              <p className="text-xs text-slate-400">Upgrade to Pro Promagen for unlimited prompts.</p>
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
    <span className="text-xs text-slate-400">
      {remaining} of {limit} free prompts
    </span>
  );
}

function DailyCounter({ count, limit }: { count: number; limit: number }) {
  return (
    <span className="text-xs text-slate-400">
      {count}/{limit} prompts today
    </span>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function PromptBuilder({ id = 'prompt-builder', provider, onDone }: PromptBuilderProps) {
  // ============================================================================
  // Hooks
  // ============================================================================

  const {
    isAuthenticated,
    userTier,
    promptLockState,
    anonymousUsage,
    dailyUsage,
    categoryLimits,
    trackPromptCopy: trackUsageCallback,
  } = usePromagenAuth();

  const { compositionMode, setCompositionMode, aspectRatio, setAspectRatio } = useCompositionMode();

  // ============================================================================
  // Local State
  // ============================================================================

  const [categoryState, setCategoryState] =
    useState<Record<PromptCategory, CategoryState>>(createInitialState());
  const [copied, setCopied] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ============================================================================
  // Computed Values
  // ============================================================================

  const platformId = provider.id ?? 'default';
  const isLocked = promptLockState !== 'unlocked';
  const allowNegativeFreeText = supportsNativeNegative(platformId);
  const _hasNativeAR = platformSupportsAR(platformId, aspectRatio ?? '1:1');
  const isMjFamily = MIDJOURNEY_FAMILY.includes(platformId.toLowerCase());

  // Build selections object from category state
  const selections = useMemo<PromptSelections>(() => {
    const result: PromptSelections = {};
    for (const [cat, state] of Object.entries(categoryState)) {
      const allValues = [...state.selected];
      if (state.customValue.trim()) {
        allValues.push(state.customValue.trim());
      }
      if (allValues.length > 0) {
        result[cat as PromptCategory] = allValues;
      }
    }
    return result;
  }, [categoryState]);

  // Assemble base prompt
  const assembled = useMemo(() => assemblePrompt(platformId, selections), [platformId, selections]);

  // Assemble composition pack if AR selected
  const compositionPack = useMemo(() => {
    if (!aspectRatio) return null;
    return assembleCompositionPack(platformId, aspectRatio, compositionMode, selections);
  }, [platformId, aspectRatio, compositionMode, selections]);

  // Build final prompt text
  const promptText = useMemo(() => {
    let basePrompt = formatPromptForCopy(assembled);

    if (compositionPack) {
      if (compositionPack.text) {
        basePrompt = injectCompositionText(basePrompt, compositionPack.text, platformId);
      }
      if (compositionPack.useNativeAR && compositionPack.arParameter) {
        basePrompt = appendARParameter(basePrompt, compositionPack.arParameter);
      }
    }

    return basePrompt;
  }, [assembled, compositionPack, platformId]);

  const hasContent = promptText.trim().length > 0;

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
    selections,
    isMidjourneyFamily: isMjFamily,
    compositionMode,
  });

  const optimizedResult = useMemo(() => getOptimizedPrompt(), [getOptimizedPrompt]);

  const displayCategories = useMemo(() => CATEGORY_ORDER as PromptCategory[], []);

  const outboundHref = provider.id ? `/go/${provider.id}?src=prompt_builder` : null;

  const _getLockMessage = () => {
    if (promptLockState === 'anonymous_limit') return 'Sign in to continue';
    if (promptLockState === 'quota_reached') return 'Daily limit reached';
    return undefined;
  };

  // ============================================================================
  // Effects
  // ============================================================================

  React.useEffect(() => {
    if (!provider.id) return;
    trackPromptBuilderOpen({ providerId: provider.id, location: 'providers_page' });
  }, [provider.id]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleSelectChange = useCallback((category: PromptCategory, selected: string[]) => {
    setCategoryState((prev) => ({
      ...prev,
      [category]: { ...prev[category], selected },
    }));
  }, []);

  const handleCustomChange = useCallback((category: PromptCategory, value: string) => {
    setCategoryState((prev) => ({
      ...prev,
      [category]: { ...prev[category], customValue: value },
    }));
  }, []);

  const handleRandomise = useCallback(() => {
    if (isLocked) return;

    const newState = createInitialState();

    for (const category of CORE_CATEGORIES) {
      const config = getCategoryConfig(category);
      if (config && config.options.length > 0) {
        const validOptions = config.options.filter((opt) => opt.trim() !== '');
        const randomOption = pickRandom(validOptions);
        if (randomOption) {
          newState[category] = { selected: [randomOption], customValue: '' };
        }
      }
    }

    for (const category of SECONDARY_CATEGORIES) {
      const config = getCategoryConfig(category);
      if (config && config.options.length > 0) {
        const validOptions = config.options.filter((opt) => opt.trim() !== '');
        const randomOption = pickRandom(validOptions);
        if (randomOption) {
          newState[category] = { selected: [randomOption], customValue: '' };
        }
      }
    }

    const negativeConfig = getCategoryConfig('negative');
    if (negativeConfig && negativeConfig.options.length > 0) {
      const validNegatives = negativeConfig.options.filter((opt) => opt.trim() !== '');
      const count = Math.floor(Math.random() * 2) + 2;
      const randomNegatives = pickMultipleRandom(validNegatives, count);
      if (randomNegatives.length > 0) {
        newState['negative'] = { selected: randomNegatives, customValue: '' };
      }
    }

    setCategoryState(newState);

    if (Math.random() > 0.5) {
      const randomAR = pickRandom([...VALID_ASPECT_RATIOS]);
      if (randomAR) setAspectRatio(randomAR);
    } else {
      setAspectRatio(null);
    }
  }, [isLocked, setAspectRatio]);

  const handleClear = useCallback(() => {
    if (isLocked) return;
    setCategoryState(createInitialState());
    setAspectRatio(null);
  }, [isLocked, setAspectRatio]);

  const handleCopyPrompt = useCallback(async () => {
    if (!hasContent || isLocked) return;

    const allowed = await trackUsageCallback(provider.id);
    if (!allowed) return;

    try {
      const textToCopy = optimizedResult.optimized;
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);

      if (provider.id) {
        trackPromptCopy({ providerId: provider.id, promptLength: textToCopy.length });
      }
    } catch (err) {
      console.error('Failed to copy prompt:', err);
    }
  }, [hasContent, isLocked, trackUsageCallback, provider.id, optimizedResult]);

  const handleDone = useCallback(() => {
    onDone?.();
  }, [onDone]);

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
            {/* Left side: Title + Toggles */}
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-50">
                {provider.name} · Prompt builder
              </h2>
              
              {/* Composition mode toggle */}
              <CompositionModeToggle
                compositionMode={compositionMode}
                onModeChange={setCompositionMode}
                disabled={isLocked}
                compact
              />

              {/* Divider */}
              <span className="text-slate-600" aria-hidden="true">│</span>

              {/* Text Length Optimizer toggle */}
              <TextLengthOptimizer
                isEnabled={isOptimizerEnabled}
                onToggle={setOptimizerEnabled}
                platformId={platformId}
                platformName={provider.name}
                disabled={isOptimizerDisabled || isLocked}
                tooltipContent={tooltipContent}
                analysis={hasContent ? analysis : null}
                compact
              />
            </div>

            {/* Right side: Usage counter */}
            <div className="flex items-center gap-3">
              {isMounted && !isAuthenticated && anonymousUsage && (
                <AnonymousCounter count={anonymousUsage.count} limit={anonymousUsage.limit} />
              )}
              {isMounted && isAuthenticated && dailyUsage && dailyUsage.limit !== null && (
                <DailyCounter count={dailyUsage.count} limit={dailyUsage.limit} />
              )}
            </div>
          </div>

          {/* Subtitle */}
          <p className="text-sm bg-gradient-to-r from-cyan-400 via-sky-400 to-purple-400 bg-clip-text text-transparent">
            Build your prompt by selecting from the criteria below. Not every field is required, but
            the more detail you provide, the better your results will be. Custom entries accepted.
          </p>

          {/* Paid user badge */}
          {userTier === 'paid' && (
            <span className="inline-flex items-center gap-1 self-start rounded-full bg-purple-600/20 px-2 py-0.5 text-xs font-medium text-purple-300 ring-1 ring-purple-500/30">
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
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
          isLocked ? 'pointer-events-none opacity-50' : ''
        }`}
      >
        <div className="flex flex-col gap-4">
          {/* Category dropdowns grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {displayCategories.map((category) => {
              const config = getCategoryConfig(category);
              if (!config) return null;

              const state = categoryState[category];
              const isNegative = category === 'negative';
              const maxSelections = categoryLimits[category] ?? 1;
              const allowFreeText = isNegative ? allowNegativeFreeText : true;

              return (
                <div key={category} className={isNegative ? 'sm:col-span-2 lg:col-span-4' : ''}>
                  <Combobox
                    id={`${id}-${category}`}
                    label={config.label}
                    description={undefined}
                    tooltipGuidance={config.tooltipGuidance || config.description}
                    options={config.options}
                    selected={state.selected}
                    customValue={state.customValue}
                    onSelectChange={(selected) => handleSelectChange(category, selected)}
                    onCustomChange={(value) => handleCustomChange(category, value)}
                    placeholder={`Select ${config.label.toLowerCase()}...`}
                    maxSelections={maxSelections}
                    maxCustomChars={50}
                    allowFreeText={allowFreeText}
                    isLocked={isLocked}
                  />
                </div>
              );
            })}
          </div>

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
                <span className="font-medium">💡 {provider.name}:</span> {assembled.tips}
              </p>
            </div>
          )}

          {/* Sparse input warning */}
          {hasContent && Object.keys(selections).length < 3 && (
            <p className="text-xs text-slate-500">💡 Tip: Add more detail for better results</p>
          )}

          {/* ============================================================ */}
          {/* Preview Area */}
          {/* ============================================================ */}
          <div className="flex flex-col gap-2 mt-2">
            {/* Header row: "Assembled prompt" + char count + Clear all */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-300">Assembled prompt</span>
              <div className="flex items-center gap-3">
                {/* Char count inline */}
                {hasContent && (
                  <span className="text-xs text-slate-500 tabular-nums">
                    {promptText.length} chars
                  </span>
                )}
                {hasContent && !isLocked && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-xs font-medium bg-gradient-to-r from-sky-400 via-emerald-300 to-indigo-400 bg-clip-text text-transparent hover:from-sky-300 hover:via-emerald-200 hover:to-indigo-300 transition-all"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>
            
            {/* Original prompt preview box */}
            <div
              className={`
                min-h-[80px] max-h-[200px] overflow-y-auto rounded-xl border bg-slate-950/80 p-3 text-sm scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30
                ${hasContent ? 'border-slate-600 text-slate-100' : 'border-slate-800 text-slate-500'}
              `}
            >
              {hasContent ? (
                <pre className="whitespace-pre-wrap font-sans text-[0.8rem] leading-relaxed">
                  {promptText}
                </pre>
              ) : (
                <span className="italic text-xs">
                  Start selecting options above to build your {provider.name} prompt...
                </span>
              )}
            </div>

            {/* ============================================================ */}
            {/* Optimization Section - Only when enabled AND will trim */}
            {/* ============================================================ */}
            {hasContent && isOptimizerEnabled && optimizedResult.wasTrimmed && (
              <div className="flex flex-col gap-2 mt-2">
                {/* Info bar: "Optimizing on copy: X → Y chars" */}
                <div className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-amber-400">↓</span>
                      <span className="text-xs text-amber-200">
                        <span className="font-medium">Optimizing on copy:</span>{' '}
                        {optimizedResult.originalLength} → {optimizedResult.optimizedLength} chars
                      </span>
                    </div>
                    {optimizedResult.removedCategories.length > 0 && (
                      <span className="text-[10px] text-amber-400/70">
                        Trimmed: {optimizedResult.removedCategories.join(', ')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Optimized prompt preview box - SAME STYLING as Assembled prompt */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-emerald-300">Optimized prompt</span>
                  <span className="text-xs text-emerald-400/70 tabular-nums">
                    {optimizedResult.optimizedLength} chars
                  </span>
                </div>
                <div
                  className="min-h-[60px] max-h-[150px] overflow-y-auto rounded-xl border border-emerald-600/50 bg-emerald-950/20 p-3 text-sm scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30"
                >
                  <pre className="whitespace-pre-wrap font-sans text-[0.8rem] leading-relaxed text-emerald-100">
                    {optimizedResult.optimized}
                  </pre>
                </div>

                {/* Length indicator with status */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">
                    Original: {optimizedResult.originalLength} → Optimized: {optimizedResult.optimizedLength}
                  </span>
                  <span className="text-amber-400">Will trim</span>
                </div>
                <p className="text-[10px] text-amber-400/70">
                  ↓ Prompt will be optimized on copy
                </p>
              </div>
            )}

            {/* Length indicator when optimizer enabled but NOT trimming */}
            {hasContent && isOptimizerEnabled && !optimizedResult.wasTrimmed && (
              <div className="mt-1">
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
          isLocked ? 'pointer-events-none opacity-50' : ''
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
                  ? 'border-slate-600 bg-slate-900 text-slate-50 hover:border-slate-400 hover:bg-slate-800'
                  : 'cursor-not-allowed border-slate-800 bg-slate-900/50 text-slate-600'
              }
              focus-visible:outline-none focus-visible:ring focus-visible:ring-sky-400/80
            `}
          >
            {copied ? (
              <>
                <svg className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {isOptimizerEnabled && optimizedResult.wasTrimmed
                  ? 'Copy optimized prompt'
                  : 'Copy prompt'}
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
                ? 'cursor-not-allowed border-slate-700 bg-slate-800/50 text-slate-500'
                : 'border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-purple-100 hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400'
            }`}
          >
            <span className="text-base">🎲</span>
            Randomise
          </button>

          {/* Done button */}
          <button
            type="button"
            onClick={handleDone}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-600 bg-slate-800 px-5 py-2 text-sm font-medium text-slate-100 shadow-sm transition-all hover:border-slate-400 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring focus-visible:ring-sky-400/80"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Done
          </button>

          {/* Open in platform button */}
          {outboundHref && (
            <a
              href={outboundHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-sky-500/70 bg-sky-600/10 px-4 py-2 text-sm font-medium text-sky-100 hover:bg-sky-500/20 focus-visible:outline-none focus-visible:ring focus-visible:ring-sky-400/80"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open in {provider.name}
            </a>
          )}
        </div>
      </footer>
    </section>
  );
}

export default PromptBuilder;
