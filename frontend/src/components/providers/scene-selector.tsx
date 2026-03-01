// src/components/providers/scene-selector.tsx
// ============================================================================
// SCENE SELECTOR v1.5.0 — Feedback Confidence Halos
// ============================================================================
// A collapsible horizontal strip that sits between the prompt builder header
// and the category dropdown grid. Lets users pick a curated scene template
// that pre-fills 5–7 categories at once.
//
// v1.3.0 (Step 2.8):
//   - Pro scenes are clickable (not disabled) — clicking shows upgrade prompt
//   - Inline upgrade dialog: scene name, benefit list, CTA to /pro-promagen
//   - Anonymous users get sign-in prompt via Clerk <SignInButton>
//   - Free users get "Upgrade to Pro" link
//   - 25 free scenes accessible, 175 visible but locked with 🔒
//
// v1.2.0 (Step 2.7):
//   - platformTier prop: receives optimizer tier 1–4 from prompt-builder
//   - Tier 4 (Plain) applies only reducedPrefills (3–5 categories)
//   - Tiers 1–3 apply full prefills (5–8 categories)
//   - Affinity dot on each SceneCard (green/amber/red = 8+/6+/below 6)
//   - Card shows "3/6 cat" for Tier 4 reduced vs full count
//   - Tier 4 complexity warning in trigger bar when scene active
//
// v1.1.0 (Step 2.6):
//   - Prefill snapshot tracking: stores what the scene set for diff detection
//   - hasUserModified detection: compares current state vs snapshot
//   - Confirmation dialog: warns before reset if user edited prefilled values
//   - onActiveSceneChange callback: informs parent of scene/prefill changes
//   - "Reset Scene" button: prominent clear next to active badge
//
// Layout:
//   ┌─ Trigger bar (collapsed): "🎬 Scene Starters · 200 scenes"  ─────────┐
//   │  Click to expand ▾                                                    │
//   └───────────────────────────────────────────────────────────────────────-┘
//   ┌─ Expanded panel ─────────────────────────────────────────────────────-┐
//   │  [World pills: Portraits | Landscapes | Mood | Style | ... ]         │
//   │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                       │
//   │  │ 🎭   │ │ ⚔️   │ │ 📸   │ │ 🕰️   │ │ 🤖   │  Scene cards        │
//   │  │Drama │ │Hero  │ │Street│ │Vintge│ │Cyber │  (click to apply)     │
//   │  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘                       │
//   └──────────────────────────────────────────────────────────────────────-┘
//
// Behaviour:
//   - Collapsed by default (doesn't eat space for power users)
//   - Selecting a scene fills categories (all editable after)
//   - Re-clicking the same scene toggles it off (clears prefills)
//   - "Clear Scene" chip on trigger bar resets without collapsing
//   - Pro scenes show lock for free-tier users
//   - Smooth expand/collapse with CSS transitions
//
// Animation placement: ALL animations are co-located in this file
// per best-working-practice.md § Animation placement (component-first rule).
// Nothing in globals.css.
//
// Authority: prompt-builder-evolution-plan-v2.md §6.5
// ============================================================================

'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { SignInButton } from '@clerk/nextjs';
import { allScenes, freeScenes, ALL_WORLDS, WORLD_BY_SLUG, getScenesByWorld } from '@/data/scenes';
import type { SceneEntry, WorldMeta } from '@/types/scene-starters';
import type { PromptCategory, CategoryState } from '@/types/prompt-builder';
import { trackEvent } from '@/lib/analytics/events';
import {
  enhanceScenePrefills,
  hasEnoughFeedbackForEnhancement,
  computeSceneConfidenceMap,
} from '@/lib/feedback/feedback-scene-enhancer';
import type { SceneConfidence } from '@/lib/feedback/feedback-scene-enhancer';
import { getOptions } from '@/data/vocabulary/prompt-builder';
import type { CategoryKey } from '@/data/vocabulary/prompt-builder';
import type { TermHint } from '@/hooks/use-feedback-memory';

// ============================================================================
// Types
// ============================================================================

export interface SceneSelectorProps {
  /** Current category state from prompt builder */
  categoryState: Record<PromptCategory, CategoryState>;
  /** State setter from prompt builder — called to apply scene prefills */
  setCategoryState: React.Dispatch<React.SetStateAction<Record<PromptCategory, CategoryState>>>;
  /** User tier: 'free' | 'paid' | 'anonymous' */
  userTier: 'free' | 'paid' | 'anonymous';
  /** Whether the prompt builder is locked (at usage limit) */
  isLocked: boolean;
  /**
   * Called when active scene changes (Step 2.6).
   * sceneId = undefined means no scene active.
   * prefills = the scene's prefill map (for origin tracking in combobox chips).
   */
  onActiveSceneChange?: (
    sceneId: string | undefined,
    prefills: Record<string, string[]> | undefined,
  ) => void;
  /**
   * Platform optimizer tier 1–4 (Step 2.7).
   * Tier 4 (Plain) gets reduced prefills (3–5 categories).
   * Tiers 1–3 get full prefills. Affinity indicator shown on cards.
   */
  platformTier: 1 | 2 | 3 | 4;
  /**
   * Term-level feedback hints from useFeedbackMemory (Phase 7.10g).
   * When present + strong enough signal, scene prefills are personalised
   * with the user's proven winning terms via feedback-scene-enhancer.
   */
  feedbackTermHints?: TermHint[];
}

// ============================================================================
// Constants
// ============================================================================

const TOTAL_SCENES = allScenes.length;
const FREE_SCENE_COUNT = freeScenes.length;

// ============================================================================
// Co-located styles (component-first rule)
// ============================================================================
// All keyframe animations, scrollbar hiding, and glow effects live here —
// not in globals.css. Delete scene-selector.tsx → all styles disappear too.
//
// Authority: best-working-practice.md § Animation placement
// ============================================================================

const SCENE_STYLES = `
  /* ── Pulse on scene apply ──────────────────────────────────── */
  @keyframes scene-apply-pulse {
    0%   { box-shadow: 0 0 0 0 rgba(34,211,238,0.35); }
    50%  { box-shadow: 0 0 0 8px rgba(34,211,238,0); }
    100% { box-shadow: 0 0 0 0 rgba(34,211,238,0); }
  }
  .ss-card--pulse { animation: scene-apply-pulse 0.7s ease-out; }

  /* ── Staggered card entrance ───────────────────────────────── */
  @keyframes scene-card-enter {
    from { opacity: 0; transform: translateY(6px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  .ss-card { animation: scene-card-enter 0.3s ease-out both; }

  /* ── Badge pop-in on trigger bar ───────────────────────────── */
  @keyframes ss-badge-pop {
    from { opacity: 0; transform: scale(0.85); }
    to   { opacity: 1; transform: scale(1); }
  }
  .ss-active-badge { animation: ss-badge-pop 0.25s ease-out; }

  /* ── Active card glow ──────────────────────────────────────── */
  .ss-card--active {
    box-shadow:
      0 0 16px -6px rgba(34,211,238,0.12),
      inset 0 1px 0 rgba(34,211,238,0.06);
  }

  /* ── Hide scrollbar on pills row ───────────────────────────── */
  .ss-pills-scroll {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .ss-pills-scroll::-webkit-scrollbar { display: none; }

  /* ── Panel expand ──────────────────────────────────────────── */
  .ss-panel { will-change: max-height, opacity; }

  /* ── Confidence Halos — feedback-driven glow rings ─────────── */
  @keyframes ss-halo-breathe {
    0%, 100% { opacity: 0.55; }
    50%      { opacity: 0.85; }
  }
  .ss-halo--proven {
    box-shadow:
      0 0 0 1px rgba(52, 211, 153, 0.25),
      0 0 12px -3px rgba(52, 211, 153, 0.18);
    animation: ss-halo-breathe 3s ease-in-out infinite;
  }
  .ss-halo--warm {
    box-shadow: 0 0 0 1px rgba(52, 211, 153, 0.12);
  }
  .ss-halo--risky {
    box-shadow:
      0 0 0 1px rgba(251, 191, 36, 0.25),
      0 0 10px -3px rgba(251, 191, 36, 0.14);
  }
`;

// ============================================================================
// Component
// ============================================================================

export function SceneSelector({
  categoryState,
  setCategoryState,
  userTier,
  isLocked,
  onActiveSceneChange,
  platformTier,
  feedbackTermHints,
}: SceneSelectorProps) {
  // ── State ──────────────────────────────────────────────────────────────
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeWorldSlug, setActiveWorldSlug] = useState<string>(ALL_WORLDS[0]?.slug ?? '');
  const [activeSceneId, setActiveSceneId] = useState<string | undefined>();
  const [pulsingCardId, setPulsingCardId] = useState<string | undefined>();
  // Step 2.6: Prefill snapshot — what the scene originally set
  const [scenePrefillSnapshot, setScenePrefillSnapshot] = useState<
    Record<string, string[]> | undefined
  >();
  // Step 2.6: Confirmation dialog state
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  // Step 2.8: Upgrade prompt for locked pro scenes
  const [upgradeSceneId, setUpgradeSceneId] = useState<string | undefined>();

  const pillsRef = useRef<HTMLDivElement>(null);

  // ── Derived ────────────────────────────────────────────────────────────
  const isPro = userTier === 'paid';
  const isAnonymous = userTier === 'anonymous';

  const activeWorld = useMemo(() => WORLD_BY_SLUG.get(activeWorldSlug), [activeWorldSlug]);

  const scenesForWorld = useMemo(() => getScenesByWorld(activeWorldSlug), [activeWorldSlug]);

  // Phase 7.10 — Confidence halos: batch-compute overlap scores for visible scenes
  const confidenceMap = useMemo(
    () =>
      feedbackTermHints && feedbackTermHints.length > 0
        ? computeSceneConfidenceMap(scenesForWorld, feedbackTermHints)
        : new Map<string, SceneConfidence>(),
    [scenesForWorld, feedbackTermHints],
  );

  const activeScene = useMemo(
    () => (activeSceneId ? allScenes.find((s) => s.id === activeSceneId) : undefined),
    [activeSceneId],
  );

  // Step 2.8: Scene to show in upgrade prompt
  const upgradeScene = useMemo(
    () => (upgradeSceneId ? allScenes.find((s) => s.id === upgradeSceneId) : undefined),
    [upgradeSceneId],
  );

  const freeWorlds = useMemo(() => ALL_WORLDS.filter((w) => w.tier === 'free'), []);
  const proWorlds = useMemo(() => ALL_WORLDS.filter((w) => w.tier === 'pro'), []);

  // Step 2.6: Detect if user has modified any scene-prefilled values
  const hasUserModified = useMemo(() => {
    if (!scenePrefillSnapshot || !activeSceneId) return false;
    for (const [cat, originalValues] of Object.entries(scenePrefillSnapshot)) {
      const current = categoryState[cat as PromptCategory];
      if (!current) continue;
      // Check if the selected values differ from what the scene set
      const currentSet = new Set(current.selected);
      const originalSet = new Set(originalValues);
      if (currentSet.size !== originalSet.size) return true;
      for (const v of originalSet) {
        if (!currentSet.has(v)) return true;
      }
    }
    // Also check if user added values in categories the scene didn't touch
    for (const [cat, state] of Object.entries(categoryState) as [PromptCategory, CategoryState][]) {
      if (!(cat in (scenePrefillSnapshot ?? {})) && state.selected.length > 0) return true;
      if (state.customValue && state.customValue.trim() !== '') return true;
    }
    return false;
  }, [scenePrefillSnapshot, activeSceneId, categoryState]);

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleToggle = useCallback(() => {
    if (isLocked) return;
    setIsExpanded((prev) => !prev);
  }, [isLocked]);

  const handleWorldClick = useCallback((slug: string) => {
    setActiveWorldSlug(slug);
  }, []);

  const handleSceneApply = useCallback(
    (scene: SceneEntry) => {
      if (isLocked) return;

      // Step 2.8: Show upgrade prompt instead of silently blocking
      if (scene.tier === 'pro' && !isPro) {
        setUpgradeSceneId(scene.id);
        return;
      }

      // Toggle off if same scene — show confirmation if user modified values
      if (activeSceneId === scene.id) {
        if (hasUserModified) {
          setShowConfirmReset(true);
        } else {
          handleSceneClear();
        }
        return;
      }

      // Step 2.7: Determine which categories to prefill based on platform tier
      // Tier 4 (Plain) gets reduced 3–5 categories from tierGuidance['4'].reducedPrefills
      // Tiers 1–3 get full prefills from scene.prefills
      const tier4Guidance = scene.tierGuidance['4'];
      const reducedCats =
        platformTier === 4 && tier4Guidance.reducedPrefills
          ? new Set<string>(tier4Guidance.reducedPrefills)
          : null;

      // Step 2.6: Store prefill snapshot (only the categories we'll actually apply)
      const prefillMap: Record<string, string[]> = {};
      for (const [cat, values] of Object.entries(scene.prefills)) {
        if (reducedCats && !reducedCats.has(cat)) continue;
        prefillMap[cat] = [...(values ?? [])];
      }

      // Phase 7.10: Feedback-Aware Scene Enhancement
      // If user has enough feedback history, silently enrich prefills
      // with their proven winning terms from feedback memory.
      let effectivePrefills = prefillMap;
      if (
        feedbackTermHints &&
        feedbackTermHints.length > 0 &&
        hasEnoughFeedbackForEnhancement(feedbackTermHints)
      ) {
        const vocabLookup = (cat: string): string[] => {
          try {
            return getOptions(cat as CategoryKey);
          } catch {
            return [];
          }
        };
        const enhanced = enhanceScenePrefills(prefillMap, feedbackTermHints, vocabLookup);
        effectivePrefills = enhanced.prefills;
      }

      setScenePrefillSnapshot(effectivePrefills);

      // Apply prefills (tier-filtered for Tier 4, feedback-enhanced)
      setCategoryState((prev) => {
        const next = { ...prev };
        for (const [cat, values] of Object.entries(effectivePrefills)) {
          const category = cat as PromptCategory;
          if (next[category]) {
            next[category] = {
              ...next[category],
              selected: [...(values ?? [])],
              customValue: next[category].customValue ?? '',
            };
          }
        }
        return next;
      });

      setActiveSceneId(scene.id);
      setShowConfirmReset(false);

      // Step 2.6: Notify parent of scene activation
      onActiveSceneChange?.(scene.id, effectivePrefills);

      // Step 4.2: Analytics — scene_selected
      trackEvent('scene_selected', {
        scene_id: scene.id,
        scene_name: scene.name,
        world: scene.world,
        tier: scene.tier,
        platform_tier: platformTier,
        categories_prefilled: Object.keys(effectivePrefills).length,
      });

      // Pulse animation
      setPulsingCardId(scene.id);
      setTimeout(() => setPulsingCardId(undefined), 700);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      isLocked,
      isPro,
      activeSceneId,
      hasUserModified,
      platformTier,
      setCategoryState,
      onActiveSceneChange,
    ],
  );

  // Step 2.6: Clear all scene data
  const handleSceneClear = useCallback(() => {
    if (isLocked) return;

    // Step 4.2: Analytics — scene_reset (capture before clearing)
    if (activeSceneId) {
      trackEvent('scene_reset', {
        scene_id: activeSceneId,
        was_modified: hasUserModified,
      });
    }

    setCategoryState((prev) => {
      const next = { ...prev };
      for (const cat of Object.keys(next) as PromptCategory[]) {
        next[cat] = { selected: [], customValue: '' };
      }
      return next;
    });
    setActiveSceneId(undefined);
    setScenePrefillSnapshot(undefined);
    setShowConfirmReset(false);
    // Step 2.6: Notify parent scene is cleared
    onActiveSceneChange?.(undefined, undefined);
  }, [isLocked, activeSceneId, hasUserModified, setCategoryState, onActiveSceneChange]);

  // Step 2.6: Request reset — shows confirmation if user modified values
  const handleResetRequest = useCallback(() => {
    if (isLocked || !activeSceneId) return;
    if (hasUserModified) {
      setShowConfirmReset(true);
    } else {
      handleSceneClear();
    }
  }, [isLocked, activeSceneId, hasUserModified, handleSceneClear]);

  // Step 2.6: Cancel confirmation dialog
  const handleCancelReset = useCallback(() => {
    setShowConfirmReset(false);
  }, []);

  // Scroll world pill into view
  useEffect(() => {
    if (!pillsRef.current || !activeWorldSlug) return;
    const el = pillsRef.current.querySelector(`[data-world="${activeWorldSlug}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeWorldSlug]);

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      {/* Co-located styles — component-first rule */}
      <style dangerouslySetInnerHTML={{ __html: SCENE_STYLES }} />

      <div>
        {/* ═══════════════════════ TRIGGER BAR ═══════════════════════ */}
        <button
          type="button"
          onClick={handleToggle}
          disabled={isLocked}
          aria-expanded={isExpanded}
          aria-controls="scene-selector-panel"
          className={`
            group relative w-full overflow-hidden rounded-xl border
            text-left transition-all duration-300 ease-out
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60
            ${
              isExpanded
                ? 'border-slate-700/60 bg-slate-900/80 shadow-[0_0_20px_-6px_rgba(34,211,238,0.08)]'
                : 'border-slate-800/50 bg-slate-900/40 hover:border-slate-700/60 hover:bg-slate-900/60'
            }
            ${isLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
          `}
          style={{ padding: 'clamp(8px, 0.8vw, 12px) clamp(12px, 1vw, 16px)' }}
        >
          {/* Top accent shimmer */}
          <div
            className={`
              absolute inset-x-0 top-0 h-[1px] transition-opacity duration-500
              ${isExpanded ? 'opacity-100' : 'opacity-0 group-hover:opacity-70'}
            `}
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(34,211,238,0.35) 25%, rgba(139,92,246,0.35) 55%, rgba(236,72,153,0.25) 80%, transparent 100%)',
            }}
          />

          <div className="flex items-center justify-between">
            {/* Left: emoji + label + count + active scene badge */}
            <div className="flex items-center min-w-0" style={{ gap: 'clamp(6px, 0.6vw, 10px)' }}>
              <span
                className="shrink-0"
                style={{ fontSize: 'clamp(0.95rem, 1.05vw, 1.15rem)' }}
                aria-hidden="true"
              >
                🎬
              </span>

              <span
                className="font-semibold text-slate-200 shrink-0"
                style={{ fontSize: 'clamp(0.72rem, 0.82vw, 0.88rem)' }}
              >
                Scene Starters
              </span>

              <span
                className="text-slate-500 shrink-0"
                style={{ fontSize: 'clamp(0.6rem, 0.68vw, 0.73rem)' }}
              >
                ·&nbsp;{TOTAL_SCENES} scenes
                {!isPro && (
                  <span className="text-emerald-500/70">&nbsp;·&nbsp;{FREE_SCENE_COUNT} free</span>
                )}
              </span>

              {/* Active scene badge */}
              {activeScene && (
                <span
                  className="ss-active-badge inline-flex items-center rounded-full bg-cyan-500/10 ring-1 ring-cyan-500/25 min-w-0"
                  style={{
                    fontSize: 'clamp(0.56rem, 0.64vw, 0.7rem)',
                    marginLeft: 'clamp(2px, 0.3vw, 6px)',
                    padding: 'clamp(1px, 0.15vw, 3px) clamp(4px, 0.3vw, 6px)',
                    gap: 'clamp(3px, 0.3vw, 6px)',
                  }}
                >
                  <span className="shrink-0">{activeScene.emoji}</span>
                  <span
                    className="text-cyan-300 truncate"
                    style={{ maxWidth: 'clamp(80px, 8vw, 120px)' }}
                  >
                    {activeScene.name}
                  </span>
                  {/* Step 2.7: Tier 4 reduced indicator */}
                  {platformTier === 4 && (
                    <span
                      className="text-amber-400/60"
                      style={{ fontSize: 'clamp(0.46rem, 0.52vw, 0.56rem)' }}
                      title="Tier 4 (Plain) — reduced categories for simpler platforms"
                    >
                      ⚡ reduced
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleResetRequest();
                    }}
                    className="shrink-0 rounded-full text-cyan-400/50 hover:bg-cyan-500/20 hover:text-cyan-300 transition-colors"
                    style={{
                      padding: 'clamp(1px, 0.2vw, 3px)',
                      marginLeft: 'clamp(1px, 0.15vw, 3px)',
                    }}
                    aria-label="Clear active scene"
                  >
                    <svg
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      style={{
                        width: 'clamp(10px, 0.8vw, 12px)',
                        height: 'clamp(10px, 0.8vw, 12px)',
                      }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
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
          id="scene-selector-panel"
          role="region"
          aria-label="Scene starter selection"
          className={`
            ss-panel overflow-hidden transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]
            ${isExpanded ? 'opacity-100' : 'max-h-0 opacity-0 pointer-events-none'}
          `}
          style={{
            marginTop: isExpanded ? 'clamp(4px, 0.5vw, 8px)' : '0',
            maxHeight: isExpanded ? 'clamp(380px, 35vw, 500px)' : '0',
          }}
        >
          <div className="rounded-xl border border-slate-800/50 bg-slate-950/60 backdrop-blur-sm shadow-lg shadow-black/20">
            {/* ─── World Pills ─────────────────────────────────────── */}
            <div
              className="border-b border-slate-800/30"
              style={{
                padding: 'clamp(8px, 0.8vw, 12px) clamp(8px, 0.8vw, 12px) clamp(6px, 0.5vw, 8px)',
              }}
            >
              <div
                ref={pillsRef}
                className="ss-pills-scroll flex overflow-x-auto"
                style={{ gap: 'clamp(4px, 0.4vw, 6px)', paddingBottom: 'clamp(2px, 0.2vw, 4px)' }}
              >
                {freeWorlds.map((world) => (
                  <WorldPill
                    key={world.slug}
                    world={world}
                    isActive={activeWorldSlug === world.slug}
                    onClick={handleWorldClick}
                    sceneCount={getScenesByWorld(world.slug).length}
                  />
                ))}

                {/* Free / Pro divider */}
                {proWorlds.length > 0 && (
                  <div
                    className="flex shrink-0 items-center"
                    style={{ padding: '0 clamp(3px, 0.3vw, 6px)' }}
                    aria-hidden="true"
                  >
                    <div
                      className="bg-gradient-to-b from-transparent via-slate-700/60 to-transparent"
                      style={{ width: '1px', height: 'clamp(16px, 1.5vw, 20px)' }}
                    />
                  </div>
                )}

                {proWorlds.map((world) => (
                  <WorldPill
                    key={world.slug}
                    world={world}
                    isActive={activeWorldSlug === world.slug}
                    onClick={handleWorldClick}
                    isProLocked={!isPro}
                    sceneCount={getScenesByWorld(world.slug).length}
                  />
                ))}
              </div>
            </div>

            {/* ─── Scene Cards ─────────────────────────────────────── */}
            <div style={{ padding: 'clamp(8px, 0.8vw, 12px)' }}>
              {/* World heading row */}
              {activeWorld && (
                <div
                  className="flex items-center justify-between"
                  style={{ marginBottom: 'clamp(6px, 0.6vw, 10px)' }}
                >
                  <div className="flex items-center" style={{ gap: 'clamp(4px, 0.4vw, 8px)' }}>
                    <span
                      style={{ fontSize: 'clamp(0.85rem, 0.95vw, 1.05rem)' }}
                      aria-hidden="true"
                    >
                      {activeWorld.emoji}
                    </span>
                    <span
                      className="font-semibold text-slate-200"
                      style={{ fontSize: 'clamp(0.68rem, 0.78vw, 0.83rem)' }}
                    >
                      {activeWorld.label}
                    </span>
                    {activeWorld.tier === 'pro' && !isPro && (
                      <span
                        className="inline-flex items-center rounded-full bg-purple-500/12 text-purple-300/80 ring-1 ring-purple-500/25"
                        style={{
                          fontSize: 'clamp(0.52rem, 0.58vw, 0.62rem)',
                          padding: 'clamp(1px, 0.15vw, 3px) clamp(4px, 0.4vw, 6px)',
                          gap: 'clamp(1px, 0.15vw, 3px)',
                        }}
                      >
                        <LockIcon size="clamp(8px, 0.7vw, 10px)" />
                        Pro
                      </span>
                    )}
                  </div>
                  <span
                    className="text-slate-500/80"
                    style={{ fontSize: 'clamp(0.55rem, 0.62vw, 0.68rem)' }}
                  >
                    {scenesForWorld.length} scene{scenesForWorld.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}

              {/* Cards grid */}
              <div
                className="overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(88px, 8vw, 110px), 1fr))',
                  gap: 'clamp(4px, 0.5vw, 8px)',
                  maxHeight: 'clamp(260px, 24vw, 340px)',
                  paddingRight: 'clamp(2px, 0.2vw, 4px)',
                }}
              >
                {scenesForWorld.map((scene, idx) => (
                  <SceneCard
                    key={scene.id}
                    scene={scene}
                    isActive={activeSceneId === scene.id}
                    isProLocked={scene.tier === 'pro' && !isPro}
                    isPulsing={pulsingCardId === scene.id}
                    onClick={handleSceneApply}
                    animDelay={idx * 30}
                    platformTier={platformTier}
                    confidence={confidenceMap.get(scene.id) ?? null}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════ CONFIRMATION DIALOG (Step 2.6) ═══════════════════ */}
      {showConfirmReset && activeScene && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          {/* Backdrop — accessible dismiss button */}
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-default"
            onClick={handleCancelReset}
            aria-label="Close dialog"
            tabIndex={-1}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirm scene reset"
            className="relative rounded-xl border border-slate-700/60 bg-slate-900 shadow-2xl shadow-black/40"
            style={{
              padding: 'clamp(16px, 1.5vw, 24px)',
              maxWidth: 'clamp(300px, 28vw, 380px)',
              width: '90%',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center"
              style={{ gap: 'clamp(6px, 0.6vw, 10px)', marginBottom: 'clamp(8px, 0.8vw, 12px)' }}
            >
              <span style={{ fontSize: 'clamp(1rem, 1.1vw, 1.25rem)' }}>{activeScene.emoji}</span>
              <span
                className="font-semibold text-slate-100"
                style={{ fontSize: 'clamp(0.75rem, 0.85vw, 0.9rem)' }}
              >
                Reset &ldquo;{activeScene.name}&rdquo;?
              </span>
            </div>

            {/* Body */}
            <p
              className="text-slate-400"
              style={{
                fontSize: 'clamp(0.62rem, 0.7vw, 0.78rem)',
                marginBottom: 'clamp(12px, 1.2vw, 18px)',
                lineHeight: '1.5',
              }}
            >
              You&apos;ve made changes since applying this scene. Resetting will clear <em>all</em>{' '}
              categories &mdash; both scene values and your edits.
            </p>

            {/* Actions */}
            <div className="flex justify-end" style={{ gap: 'clamp(6px, 0.6vw, 10px)' }}>
              <button
                type="button"
                onClick={handleCancelReset}
                className="rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition-colors"
                style={{
                  padding: 'clamp(4px, 0.5vw, 8px) clamp(10px, 1vw, 16px)',
                  fontSize: 'clamp(0.62rem, 0.7vw, 0.78rem)',
                }}
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={handleSceneClear}
                className="rounded-lg border border-red-700/50 bg-red-900/30 text-red-300 hover:bg-red-800/40 hover:text-red-200 transition-colors"
                style={{
                  padding: 'clamp(4px, 0.5vw, 8px) clamp(10px, 1vw, 16px)',
                  fontSize: 'clamp(0.62rem, 0.7vw, 0.78rem)',
                }}
              >
                Reset scene
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════ UPGRADE PROMPT (Step 2.8) ═══════════════════════ */}
      {upgradeScene && !isPro && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          {/* Backdrop — accessible dismiss button */}
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-default"
            onClick={() => setUpgradeSceneId(undefined)}
            aria-label="Close dialog"
            tabIndex={-1}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Upgrade to Pro Promagen"
            className="relative rounded-xl border border-purple-700/40 bg-slate-900 shadow-2xl shadow-black/40"
            style={{
              padding: 'clamp(18px, 1.6vw, 28px)',
              maxWidth: 'clamp(320px, 30vw, 420px)',
              width: '90%',
            }}
          >
            {/* Scene preview */}
            <div
              className="flex items-center"
              style={{ gap: 'clamp(8px, 0.7vw, 12px)', marginBottom: 'clamp(10px, 1vw, 16px)' }}
            >
              <span style={{ fontSize: 'clamp(1.2rem, 1.3vw, 1.5rem)' }}>{upgradeScene.emoji}</span>
              <div className="min-w-0 flex-1">
                <span
                  className="block font-semibold text-slate-100 truncate"
                  style={{ fontSize: 'clamp(0.78rem, 0.88vw, 0.95rem)' }}
                >
                  {upgradeScene.name}
                </span>
                <span
                  className="block text-slate-500 truncate"
                  style={{ fontSize: 'clamp(0.58rem, 0.65vw, 0.72rem)' }}
                >
                  {upgradeScene.description}
                </span>
              </div>
              <LockIcon size="clamp(14px, 1.1vw, 18px)" className="text-purple-400/60 shrink-0" />
            </div>

            {/* Benefit blurb */}
            <div
              className="rounded-lg border border-purple-800/20 bg-purple-950/20"
              style={{
                padding: 'clamp(10px, 1vw, 14px)',
                marginBottom: 'clamp(12px, 1.2vw, 18px)',
              }}
            >
              <p
                className="font-medium text-purple-200"
                style={{
                  fontSize: 'clamp(0.68rem, 0.76vw, 0.82rem)',
                  marginBottom: 'clamp(4px, 0.4vw, 8px)',
                }}
              >
                🔓 Unlock 175 Pro scenes
              </p>
              <ul
                className="text-slate-400"
                style={{
                  fontSize: 'clamp(0.58rem, 0.65vw, 0.72rem)',
                  lineHeight: '1.6',
                  paddingLeft: 'clamp(12px, 1vw, 16px)',
                  listStyleType: 'disc',
                }}
              >
                <li>Cinematic, fantasy, sci-fi, architecture &amp; more</li>
                <li>Full tier-optimised prefills for every platform</li>
                <li>Unlimited prompt generation</li>
              </ul>
            </div>

            {/* Actions */}
            <div
              className="flex items-center justify-end"
              style={{ gap: 'clamp(8px, 0.7vw, 12px)' }}
            >
              <button
                type="button"
                onClick={() => setUpgradeSceneId(undefined)}
                className="rounded-lg border border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors"
                style={{
                  padding: 'clamp(5px, 0.5vw, 8px) clamp(12px, 1vw, 18px)',
                  fontSize: 'clamp(0.62rem, 0.7vw, 0.78rem)',
                }}
              >
                Maybe later
              </button>

              {isAnonymous ? (
                <SignInButton mode="modal">
                  <button
                    type="button"
                    className="rounded-lg border border-purple-600/50 bg-gradient-to-r from-purple-600/30 to-pink-600/20 text-purple-100 hover:from-purple-600/40 hover:to-pink-600/30 transition-all"
                    style={{
                      padding: 'clamp(5px, 0.5vw, 8px) clamp(12px, 1vw, 18px)',
                      fontSize: 'clamp(0.62rem, 0.7vw, 0.78rem)',
                    }}
                  >
                    Sign in first
                  </button>
                </SignInButton>
              ) : (
                <Link
                  href="/pro-promagen"
                  className="inline-flex items-center rounded-lg border border-purple-600/50 bg-gradient-to-r from-purple-600/30 to-pink-600/20 text-purple-100 hover:from-purple-600/40 hover:to-pink-600/30 transition-all"
                  style={{
                    padding: 'clamp(5px, 0.5vw, 8px) clamp(12px, 1vw, 18px)',
                    fontSize: 'clamp(0.62rem, 0.7vw, 0.78rem)',
                    gap: 'clamp(4px, 0.4vw, 6px)',
                  }}
                >
                  <svg
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    style={{
                      width: 'clamp(12px, 0.9vw, 14px)',
                      height: 'clamp(12px, 0.9vw, 14px)',
                    }}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                  Upgrade to Pro
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================================
// WorldPill — horizontal scrolling world tab
// ============================================================================

interface WorldPillProps {
  world: WorldMeta;
  isActive: boolean;
  onClick: (slug: string) => void;
  isProLocked?: boolean;
  sceneCount: number;
}

function WorldPill({ world, isActive, onClick, isProLocked = false, sceneCount }: WorldPillProps) {
  return (
    <button
      type="button"
      data-world={world.slug}
      onClick={() => onClick(world.slug)}
      className={`
        group/pill relative flex shrink-0 items-center rounded-lg
        transition-all duration-200
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50
        ${
          isActive
            ? 'bg-slate-800/70 text-slate-100 shadow-sm'
            : 'text-slate-400 hover:bg-slate-800/30 hover:text-slate-300'
        }
      `}
      style={{
        padding: 'clamp(4px, 0.4vw, 6px) clamp(6px, 0.6vw, 10px)',
        gap: 'clamp(3px, 0.35vw, 6px)',
      }}
      title={`${world.label} — ${sceneCount} scenes${isProLocked ? ' (Pro Promagen)' : ''}`}
    >
      <span style={{ fontSize: 'clamp(0.7rem, 0.78vw, 0.85rem)' }} aria-hidden="true">
        {world.emoji}
      </span>
      <span
        className="whitespace-nowrap font-medium"
        style={{ fontSize: 'clamp(0.56rem, 0.64vw, 0.7rem)' }}
      >
        {world.label}
      </span>
      {isProLocked && <LockIcon size="clamp(8px, 0.7vw, 10px)" className="text-purple-400/50" />}

      {/* Active accent underline */}
      {isActive && (
        <div
          className="absolute -bottom-px rounded-full"
          style={{
            left: 'clamp(4px, 0.4vw, 6px)',
            right: 'clamp(4px, 0.4vw, 6px)',
            height: '2px',
            background: 'linear-gradient(90deg, rgba(34,211,238,0.5), rgba(139,92,246,0.4))',
          }}
        />
      )}
    </button>
  );
}

// ============================================================================
// SceneCard — individual clickable scene tile
// ============================================================================

interface SceneCardProps {
  scene: SceneEntry;
  isActive: boolean;
  isProLocked: boolean;
  isPulsing: boolean;
  onClick: (scene: SceneEntry) => void;
  animDelay: number;
  /** Current platform tier for affinity indicator (Step 2.7) */
  platformTier: 1 | 2 | 3 | 4;
  /** Feedback confidence level for halo ring (Phase 7.10) */
  confidence: SceneConfidence;
}

function SceneCard({
  scene,
  isActive,
  isProLocked,
  isPulsing,
  onClick,
  animDelay,
  platformTier,
  confidence,
}: SceneCardProps) {
  // Step 2.7: Tier-specific data
  const tierKey = String(platformTier) as '1' | '2' | '3' | '4';
  const affinity = scene.tierGuidance[tierKey].affinity;
  const isReduced = platformTier === 4;
  const tier4 = scene.tierGuidance['4'];
  const reducedCount = isReduced && tier4.reducedPrefills ? tier4.reducedPrefills.length : null;
  const fullCount = Object.keys(scene.prefills).length;
  const displayCount = reducedCount ?? fullCount;

  // Phase 7.10: Halo CSS class — only show when card is not active and not locked
  const haloClass =
    !isActive && !isProLocked && confidence
      ? `ss-halo--${confidence}`
      : '';

  // Confidence label for tooltip
  const confidenceLabel = confidence === 'proven'
    ? ' ✦ Proven for you'
    : confidence === 'warm'
      ? ' ✦ Looks promising'
      : confidence === 'risky'
        ? ' ⚠ Mixed results'
        : '';

  return (
    <button
      type="button"
      onClick={() => onClick(scene)}
      className={`
        ss-card group/card relative flex flex-col items-center justify-center
        rounded-xl border text-center transition-all duration-200 ease-out
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40
        ${
          isActive
            ? 'ss-card--active border-cyan-500/30 bg-cyan-950/25'
            : isProLocked
              ? 'cursor-pointer border-purple-800/20 bg-slate-900/15 opacity-50 hover:opacity-60 hover:border-purple-700/30'
              : 'border-slate-800/30 bg-slate-900/25 hover:border-slate-700/50 hover:bg-slate-800/35 cursor-pointer'
        }
        ${isPulsing ? 'ss-card--pulse' : ''}
        ${haloClass}
      `}
      style={{
        animationDelay: `${animDelay}ms`,
        padding: 'clamp(8px, 0.8vw, 12px) clamp(6px, 0.5vw, 8px)',
        gap: 'clamp(2px, 0.25vw, 4px)',
      }}
      title={
        isProLocked
          ? `${scene.name} — Pro Promagen only`
          : `${scene.name}: ${scene.description}${confidenceLabel}`
      }
    >
      {/* Pro lock icon */}
      {isProLocked && (
        <div
          className="absolute"
          style={{ right: 'clamp(2px, 0.3vw, 4px)', top: 'clamp(2px, 0.3vw, 4px)' }}
        >
          <LockIcon size="clamp(10px, 0.8vw, 12px)" className="text-purple-400/50" />
        </div>
      )}

      {/* Active checkmark */}
      {isActive && (
        <div
          className="absolute"
          style={{ right: 'clamp(2px, 0.3vw, 4px)', top: 'clamp(2px, 0.3vw, 4px)' }}
        >
          <svg
            className="text-cyan-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
            style={{ width: 'clamp(11px, 0.9vw, 14px)', height: 'clamp(11px, 0.9vw, 14px)' }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      {/* Emoji */}
      <span
        className={`transition-transform duration-200 ${
          isActive ? 'scale-110' : isProLocked ? '' : 'group-hover/card:scale-105'
        }`}
        style={{ fontSize: 'clamp(1.1rem, 1.3vw, 1.5rem)' }}
        aria-hidden="true"
      >
        {scene.emoji}
      </span>

      {/* Name */}
      <span
        className={`font-medium leading-tight ${isActive ? 'text-cyan-200' : 'text-slate-300'}`}
        style={{ fontSize: 'clamp(0.56rem, 0.64vw, 0.7rem)' }}
      >
        {scene.name}
      </span>

      {/* Category count (tier-aware) + affinity dot */}
      <div className="flex items-center" style={{ gap: 'clamp(3px, 0.3vw, 5px)' }}>
        <span
          className={isActive ? 'text-cyan-400/50' : 'text-slate-600'}
          style={{ fontSize: 'clamp(0.46rem, 0.52vw, 0.58rem)' }}
        >
          {displayCount}
          {isReduced ? `/${fullCount}` : ''} cat
        </span>
        {/* Affinity dot — colour encodes fit with current platform tier */}
        <span
          className="inline-block rounded-full shrink-0"
          style={{
            width: 'clamp(5px, 0.4vw, 7px)',
            height: 'clamp(5px, 0.4vw, 7px)',
            backgroundColor:
              affinity >= 8
                ? 'rgba(52, 211, 153, 0.7)' // emerald — great fit
                : affinity >= 6
                  ? 'rgba(250, 204, 21, 0.6)' // amber — decent fit
                  : 'rgba(248, 113, 113, 0.5)', // red — weak fit
          }}
          title={`Tier ${platformTier} affinity: ${affinity}/10`}
          aria-label={`Affinity ${affinity} out of 10`}
        />
        {/* Confidence micro-badge — only when halo is active */}
        {!isProLocked && confidence && (
          <span
            style={{
              fontSize: 'clamp(7px, 0.5vw, 9px)',
              lineHeight: 1,
              color:
                confidence === 'risky'
                  ? 'rgba(251, 191, 36, 0.7)'
                  : 'rgba(52, 211, 153, 0.7)',
            }}
            aria-label={
              confidence === 'proven' ? 'Proven for you'
                : confidence === 'warm' ? 'Looks promising'
                  : 'Mixed results'
            }
          >
            {confidence === 'proven' ? '✦' : confidence === 'warm' ? '·' : '⚠'}
          </span>
        )}
      </div>

      {/* Active glow overlay */}
      {isActive && (
        <div
          className="absolute inset-[-1px] rounded-[inherit] pointer-events-none"
          style={{
            background:
              'linear-gradient(135deg, rgba(34,211,238,0.06) 0%, transparent 40%, transparent 60%, rgba(139,92,246,0.04) 100%)',
          }}
          aria-hidden="true"
        />
      )}

      {/* Confidence halo overlay — proven/warm get emerald tint, risky gets amber */}
      {!isActive && !isProLocked && confidence && (
        <div
          className="absolute inset-[-1px] rounded-[inherit] pointer-events-none"
          style={{
            background:
              confidence === 'proven'
                ? 'linear-gradient(135deg, rgba(52,211,153,0.06) 0%, transparent 50%, rgba(52,211,153,0.03) 100%)'
                : confidence === 'warm'
                  ? 'linear-gradient(135deg, rgba(52,211,153,0.03) 0%, transparent 70%)'
                  : 'linear-gradient(135deg, rgba(251,191,36,0.05) 0%, transparent 50%, rgba(251,191,36,0.03) 100%)',
          }}
          aria-hidden="true"
        />
      )}
    </button>
  );
}

// ============================================================================
// Shared lock icon — clamp()-sized
// ============================================================================

function LockIcon({
  className = '',
  size = 'clamp(10px, 0.8vw, 12px)',
}: {
  className?: string;
  size?: string;
}) {
  return (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 20 20"
      aria-hidden="true"
      style={{ width: size, height: size }}
    >
      <path
        fillRule="evenodd"
        d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default SceneSelector;
