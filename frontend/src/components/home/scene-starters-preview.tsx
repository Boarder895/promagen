// src/components/home/scene-starters-preview.tsx
// ============================================================================
// SCENE STARTERS PREVIEW — Left rail on new homepage
// ============================================================================
// Scrollable card list of 200 scenes (25 free first, then 175 Pro grouped
// by world). Clicking a scene card navigates to the prompt builder with the
// scene pre-loaded via sessionStorage.
//
// Features:
// - Free scenes first, Pro scenes after (grouped by world, SSOT order)
// - Tier affinity badge (★/◆/💬/⚡) derived from tierGuidance affinity scores
// - Pro gate: anonymous → Clerk sign-in modal, free → inline upgrade prompt
// - Provider routing: last-used from localStorage, else default (midjourney)
// - "View all 200 scenes →" footer link routes to prompt builder
// - All sizing via CSS clamp() (desktop-only, no mobile breakpoints)
//
// Authority: docs/authority/homepage.md §5
// Existing features preserved: Yes (additive component only)
// ============================================================================

'use client';

import React, { useMemo, useCallback, useState } from 'react';
import { SignInButton } from '@clerk/nextjs';
import { allScenes, WORLD_BY_SLUG } from '@/data/scenes';
import type { SceneEntry, WorldMeta } from '@/types/scene-starters';

// ============================================================================
// CONSTANTS
// ============================================================================

/** localStorage key for last-used provider (matches use-remember-provider.ts) */
const LAST_PROVIDER_KEY = 'lastProvider';

/** sessionStorage key for scene pre-load (read by prompt-builder.tsx on mount) */
const PRELOAD_SCENE_KEY = 'promagen:preloaded-scene';

/** Default provider when nothing stored */
const DEFAULT_PROVIDER = 'midjourney';

/** Tier affinity badge config — matches scene-starters.md badge system */
const TIER_BADGES: Record<number, { icon: string; colour: string; label: string }> = {
  1: { icon: '★', colour: 'text-cyan-400', label: 'Tier 1' },
  2: { icon: '◆', colour: 'text-violet-400', label: 'Tier 2' },
  3: { icon: '💬', colour: 'text-emerald-400', label: 'Tier 3' },
  4: { icon: '⚡', colour: 'text-amber-400', label: 'Tier 4' },
};

// ============================================================================
// HELPERS
// ============================================================================

/** Derive best tier from tierGuidance affinity scores (highest affinity wins). */
function getBestTier(scene: SceneEntry): number {
  const g = scene.tierGuidance;
  let best = 1;
  let bestScore = 0;
  for (const t of [1, 2, 3, 4] as const) {
    const a = g[`${t}`]?.affinity ?? 0;
    if (a > bestScore) { bestScore = a; best = t; }
  }
  return best;
}

/** Read last-used provider from localStorage. */
function getLastProvider(): string {
  try {
    const v = localStorage.getItem(LAST_PROVIDER_KEY);
    if (v) return v;
  } catch { /* noop */ }
  return DEFAULT_PROVIDER;
}

// ============================================================================
// TYPES
// ============================================================================

interface SceneStartersPreviewProps {
  /** User authentication + tier state */
  isAuthenticated: boolean;
  /** 'paid' for Pro users, 'free' otherwise (derived from usePromagenAuth) */
  userTier: 'free' | 'paid';
}

// ============================================================================
// SCENE CARD — single scene row
// ============================================================================

function SceneCard({
  scene,
  worldMeta,
  bestTier,
  isPro: _isPro,
  isLocked,
  isAuthenticated,
  onNavigate,
}: {
  scene: SceneEntry;
  worldMeta: WorldMeta | undefined;
  bestTier: number;
  isPro: boolean;
  isLocked: boolean;
  isAuthenticated: boolean;
  onNavigate: (sceneId: string) => void;
}) {
  const [showUpgrade, setShowUpgrade] = useState(false);
  const badge = TIER_BADGES[bestTier] ?? TIER_BADGES[1]!;
  const categoryCount = Object.keys(scene.prefills).length;

  const handleClick = useCallback(() => {
    if (!isLocked) {
      onNavigate(scene.id);
      return;
    }
    // Locked + anonymous → SignInButton wrapper handles modal (below)
    if (!isAuthenticated) return;
    // Locked + free authenticated → toggle inline upgrade prompt
    setShowUpgrade((prev) => !prev);
  }, [isLocked, isAuthenticated, scene.id, onNavigate]);

  // ── Key handler for a11y ──────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick],
  );

  // ── Inner card JSX ─────────────────────────────────────────────────────
  const cardInner = (
    <div
      className={`group flex flex-col rounded-xl bg-slate-900/60 ring-1 ring-white/5 transition-all ${
        isLocked
          ? 'opacity-60 hover:opacity-80 hover:ring-white/10'
          : 'cursor-pointer hover:bg-slate-900/80 hover:ring-white/15'
      }`}
      style={{ padding: 'clamp(7px, 0.65vw, 11px)', gap: 'clamp(2px, 0.25vw, 5px)' }}
      role="button"
      tabIndex={0}
      onClick={isLocked && !isAuthenticated ? undefined : handleClick}
      onKeyDown={isLocked && !isAuthenticated ? undefined : handleKeyDown}
      aria-label={`${isLocked ? 'Pro: ' : ''}${scene.name} — ${worldMeta?.label ?? scene.world}`}
    >
      {/* Row 1: emoji + name + lock */}
      <div className="flex items-center" style={{ gap: 'clamp(4px, 0.4vw, 7px)' }}>
        <span
          className="shrink-0"
          style={{ fontSize: 'clamp(0.75rem, 0.85vw, 1rem)' }}
        >
          {scene.emoji}
        </span>
        <span
          className="min-w-0 flex-1 truncate font-medium text-white"
          style={{ fontSize: 'clamp(0.58rem, 0.7vw, 0.82rem)' }}
        >
          {scene.name}
        </span>
        {isLocked && (
          <span
            className="shrink-0 opacity-50"
            style={{ fontSize: 'clamp(0.6rem, 0.65vw, 0.75rem)' }}
            aria-label="Pro scene"
          >
            🔒
          </span>
        )}
      </div>

      {/* Row 2: world · N categories · ★ Tier X */}
      <div
        className="flex items-center text-slate-400"
        style={{
          gap: 'clamp(3px, 0.3vw, 6px)',
          fontSize: 'clamp(0.48rem, 0.58vw, 0.68rem)',
        }}
      >
        <span className="truncate">{worldMeta?.label ?? scene.world}</span>
        <span className="text-slate-600">·</span>
        <span className="shrink-0">{categoryCount} categories</span>
        <span className="text-slate-600">·</span>
        <span className={`shrink-0 font-semibold ${badge.colour}`}>
          {badge.icon} {badge.label}
        </span>
      </div>
    </div>
  );

  // ── Anonymous user + pro scene → wrap in Clerk SignInButton ────────────
  if (isLocked && !isAuthenticated) {
    return (
      <SignInButton mode="modal">
        {cardInner}
      </SignInButton>
    );
  }

  return (
    <>
      {cardInner}

      {/* Upgrade prompt — free authenticated user clicking a Pro scene */}
      {showUpgrade && isLocked && (
        <div
          className="rounded-lg border border-purple-500/30 bg-purple-950/40"
          style={{
            padding: 'clamp(5px, 0.5vw, 9px)',
            marginTop: 'clamp(2px, 0.2vw, 4px)',
          }}
        >
          <p
            className="text-slate-300"
            style={{
              fontSize: 'clamp(0.48rem, 0.58vw, 0.68rem)',
              marginBottom: 'clamp(4px, 0.35vw, 7px)',
            }}
          >
            <strong className="text-purple-300">{scene.name}</strong> requires Pro Promagen.
          </p>
          <a
            href="/pro-promagen"
            className="inline-flex items-center rounded-md border border-purple-500/50 bg-gradient-to-r from-purple-600/20 to-pink-600/20 font-medium text-purple-200 transition-all hover:from-purple-600/30 hover:to-pink-600/30"
            style={{
              padding: 'clamp(2px, 0.25vw, 5px) clamp(6px, 0.7vw, 12px)',
              fontSize: 'clamp(0.48rem, 0.55vw, 0.65rem)',
            }}
          >
            Upgrade to Pro →
          </a>
        </div>
      )}
    </>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SceneStartersPreview({
  isAuthenticated,
  userTier,
}: SceneStartersPreviewProps) {
  const isPro = userTier === 'paid';

  // ── Ordered scene list: free first, then pro grouped by world ──────────
  const orderedScenes = useMemo(() => {
    const free: SceneEntry[] = [];
    const proByWorld = new Map<string, SceneEntry[]>();

    for (const scene of allScenes) {
      if (scene.tier === 'free') {
        free.push(scene);
      } else {
        const list = proByWorld.get(scene.world) ?? [];
        list.push(scene);
        proByWorld.set(scene.world, list);
      }
    }

    // Sort pro world groups by WORLD_BY_SLUG order
    const proGroups = [...proByWorld.entries()].sort((a, b) => {
      const oA = WORLD_BY_SLUG.get(a[0])?.order ?? 999;
      const oB = WORLD_BY_SLUG.get(b[0])?.order ?? 999;
      return oA - oB;
    });

    const result: SceneEntry[] = [...free];
    for (const [, scenes] of proGroups) result.push(...scenes);
    return result;
  }, []);

  // ── Best-tier cache (one-time) ─────────────────────────────────────────
  const bestTierMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of allScenes) m.set(s.id, getBestTier(s));
    return m;
  }, []);

  // ── Navigate to provider's prompt builder with scene pre-loaded ────────
  const handleNavigate = useCallback((sceneId: string) => {
    try { sessionStorage.setItem(PRELOAD_SCENE_KEY, sceneId); } catch { /* noop */ }
    const pid = getLastProvider();
    window.location.href = `/providers/${pid}/prompt-builder`;
  }, []);

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div
      className="flex h-full flex-col rounded-3xl bg-slate-950/70 ring-1 ring-white/10"
      style={{ padding: 'clamp(10px, 1vw, 16px)' }}
      data-testid="scene-starters-preview"
    >
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between"
        style={{ marginBottom: 'clamp(4px, 0.45vw, 8px)' }}
      >
        <div className="flex items-center" style={{ gap: 'clamp(4px, 0.4vw, 8px)' }}>
          <div
            className="animate-pulse rounded-full"
            style={{
              backgroundColor: '#22D3EE',
              width: 'clamp(6px, 0.35vw, 10px)',
              height: 'clamp(6px, 0.35vw, 10px)',
            }}
            aria-hidden="true"
          />
          <span
            className="font-mono uppercase tracking-wider text-slate-400"
            style={{ fontSize: 'clamp(0.45rem, 0.6vw, 0.7rem)' }}
          >
            SCENE STARTERS
          </span>
        </div>
        <span
          className="text-slate-500"
          style={{ fontSize: 'clamp(0.4rem, 0.5vw, 0.6rem)' }}
        >
          25 free · 175 Pro
        </span>
      </div>

      {/* ── Subtitle ──────────────────────────────────────────────────── */}
      <p
        className="text-slate-400"
        style={{
          fontSize: 'clamp(0.48rem, 0.6vw, 0.72rem)',
          marginBottom: 'clamp(6px, 0.6vw, 10px)',
        }}
      >
        Click a scene to launch the prompt builder with categories pre-filled.
      </p>

      {/* ── Scrollable card list ──────────────────────────────────────── */}
      <div
        className="flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30"
        style={{ gap: 'clamp(4px, 0.35vw, 7px)' }}
      >
        {orderedScenes.map((scene) => (
          <SceneCard
            key={scene.id}
            scene={scene}
            worldMeta={WORLD_BY_SLUG.get(scene.world)}
            bestTier={bestTierMap.get(scene.id) ?? 1}
            isPro={isPro}
            isLocked={scene.tier === 'pro' && !isPro}
            isAuthenticated={isAuthenticated}
            onNavigate={handleNavigate}
          />
        ))}

        {/* ── Footer link ─────────────────────────────────────────────── */}
        <button
          type="button"
          onClick={() => {
            const pid = getLastProvider();
            window.location.href = `/providers/${pid}/prompt-builder`;
          }}
          className="flex items-center justify-center rounded-xl bg-slate-900/40 text-slate-400 ring-1 ring-white/5 transition-all hover:bg-slate-900/60 hover:text-slate-300 hover:ring-white/10"
          style={{
            padding: 'clamp(7px, 0.65vw, 11px)',
            fontSize: 'clamp(0.5rem, 0.62vw, 0.72rem)',
            marginTop: 'clamp(2px, 0.2vw, 4px)',
          }}
        >
          View all 200 scenes →
        </button>
      </div>
    </div>
  );
}
