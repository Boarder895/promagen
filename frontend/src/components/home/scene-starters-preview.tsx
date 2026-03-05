// src/components/home/scene-starters-preview.tsx
// ============================================================================
// SCENE STARTERS PREVIEW — Left rail on new homepage (v4.1.0)
// ============================================================================
// v4.1.0 — Cascading glow cycle:
// - Each card takes its turn glowing: 3s on → 1s dark → next card
// - Cycles endlessly through all 8 cards (32s full cycle), then repeats
// - Uses existing glow system (glowRgba/glowBorder/glowSoft) — zero new animations
// - Parent controls activeGlowIndex + glowOn state, card receives isGlowActive prop
// - Resets to card 0 when batch rotates (5-minute rotation)
// - Hover overrides cascade (user hover always wins)
//
// v4.0.0 — 95/100 redesign:
// 1. Short punchy instruction (6 words): "Click a scene to start building."
// 2. Icon+rank moved to footer row (left), "25 free · 175 Pro" (right)
// 3. First card gets one-time 2-second glow pulse on page load
// 4. No-provider state: different instruction, dimmed cards
// 5. Arrow shows provider name on hover ("→ Flux") instead of plain "→"
// 6. Clean footer: icon + rank left, explore count right
//
// v3.3.x changes preserved:
// - Title case "Scene Starters", centred, gradient
// - Amber pulse on subtitle matching mission-control
// - Engine Bay icon size, vibe phrase uppercase, arrows
// - Banned colour compliance (no text-slate-500/600)
// - 9px minimum font-size floor
//
// Cards are STRUCTURALLY IDENTICAL to exchange-card.tsx.
// Authority: docs/authority/homepage.md §5
// Existing features preserved: Yes
// ============================================================================

'use client';

import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { allScenes, WORLD_BY_SLUG } from '@/data/scenes';
import type { SceneEntry, WorldMeta } from '@/types/scene-starters';
import type { Provider } from '@/types/providers';

// ============================================================================
// CONSTANTS
// ============================================================================

const PRELOAD_SCENE_KEY = 'promagen:preloaded-scene';
const BATCH_SIZE = 8;
const ROTATION_INTERVAL_MS = 5 * 60 * 1000;

// ── Snap-fit font — SAME constants as exchange-card.tsx ─────────────────
const MIN_FONT = 12;
const MAX_FONT = 20;
const FONT_SCALE = 0.042;

// ── Cascading glow timing ────────────────────────────────────────────────
const GLOW_ON_MS = 3000; // 3 seconds glowing
const GLOW_OFF_MS = 1000; // 1 second dark before next card

// ── Tier dot colours ────────────────────────────────────────────────────
const TIER_DOT_COLORS: Record<number, string> = {
  1: '#22D3EE',
  2: '#A78BFA',
  3: '#34D399',
  4: '#FBBF24',
};

// ── Provider icon display ────────────────────────────────────────────────
const DEFAULT_BRAND_COLOR = '#3B82F6';
const ICON_PATH_PATTERN = '/icons/providers/';
const PLATFORM_COLORS: Readonly<Record<string, string>> = {
  midjourney: '#7C3AED',
  flux: '#F97316',
  'google-imagen': '#4285F4',
  openai: '#10B981',
  leonardo: '#EC4899',
  'adobe-firefly': '#FF6B35',
  stability: '#8B5CF6',
  ideogram: '#06B6D4',
  canva: '#00C4CC',
  'imagine-meta': '#0668E1',
  dreamstudio: '#A855F7',
} as const;

// ============================================================================
// HELPERS
// ============================================================================

function getBestTier(scene: SceneEntry): number {
  const g = scene.tierGuidance;
  let best = 1;
  let bestScore = 0;
  for (const t of [1, 2, 3, 4] as const) {
    const a = g[`${t}`]?.affinity ?? 0;
    if (a > bestScore) {
      bestScore = a;
      best = t;
    }
  }
  return best;
}

function getVibePhrase(scene: SceneEntry): string {
  const fp = scene.flavourPhrases;
  if (!fp) return '';
  const keys = Object.keys(fp);
  if (keys.length === 0) return '';
  const firstKey = keys[0] as keyof typeof fp;
  const arr = fp[firstKey];
  if (arr && arr.length > 0) {
    const raw = arr[0] ?? '';
    return raw.length > 0 ? raw.charAt(0).toUpperCase() + raw.slice(1) : '';
  }
  return '';
}

function getBrandColor(id: string): string {
  return PLATFORM_COLORS[id] ?? DEFAULT_BRAND_COLOR;
}

function getIconPath(p: Provider): string {
  if (p.localIcon && typeof p.localIcon === 'string') return p.localIcon;
  return `${ICON_PATH_PATTERN}${p.id.replace(/[^a-z0-9-]/gi, '')}.png`;
}

function hexToRgba(hex: string, alpha: number): string {
  const safe = /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : '#3B82F6';
  const r = parseInt(safe.slice(1, 3), 16);
  const g = parseInt(safe.slice(3, 5), 16);
  const b = parseInt(safe.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Format ordinal: 1 → "1st", 2 → "2nd", 3 → "3rd", 4 → "4th", etc. */
function formatOrdinal(n: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd'] as const;
  const v = n % 100;
  const suffix = suffixes[(v - 20) % 10] ?? suffixes[v] ?? 'th';
  return `${n}${suffix}`;
}

/** Build batches of exactly 8 from the 25 free scenes. Incomplete last batch excluded. */
function buildFreeBatches(): SceneEntry[][] {
  const free = allScenes.filter((s) => s.tier === 'free');
  const batches: SceneEntry[][] = [];
  for (let i = 0; i + BATCH_SIZE <= free.length; i += BATCH_SIZE) {
    batches.push(free.slice(i, i + BATCH_SIZE));
  }
  return batches.length > 0 ? batches : [free.slice(0, Math.min(BATCH_SIZE, free.length))];
}

// ============================================================================
// TYPES
// ============================================================================

interface SceneStartersPreviewProps {
  isAuthenticated: boolean;
  userTier: 'free' | 'paid';
  /** Selected provider from Engine Bay (null = none selected) */
  selectedProvider: Provider | null;
  /** Called when user clicks a scene but no provider is selected — opens Engine Bay dropdown */
  onNudgeProvider?: () => void;
}

// ============================================================================
// SCENE CARD — structurally identical to exchange-card.tsx
// ============================================================================

const SceneCard = React.memo(function SceneCard({
  scene,
  worldMeta,
  bestTier,
  vibePhrase,
  sceneFont,
  providerName,
  isGlowActive,
  onNavigate,
}: {
  scene: SceneEntry;
  worldMeta: WorldMeta | undefined;
  bestTier: number;
  vibePhrase: string;
  sceneFont: number;
  /** Provider name shown in arrow on hover — null when no provider selected */
  providerName: string | null;
  /** Parent-controlled cascading glow — true when this card's turn */
  isGlowActive: boolean;
  onNavigate: (sceneId: string) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const dotColor = TIER_DOT_COLORS[bestTier] ?? TIER_DOT_COLORS[1]!;

  // ── Glow colours — same pattern as exchange-card.tsx ───────────────────
  const glowRgba = hexToRgba(dotColor, 0.3);
  const glowBorder = hexToRgba(dotColor, 0.5);
  const glowSoft = hexToRgba(dotColor, 0.15);

  const handleClick = useCallback(() => {
    onNavigate(scene.id);
  }, [scene.id, onNavigate]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick],
  );

  // ── Card style — cascade glow OR hover glow (hover always wins) ────────
  const isGlowing = isHovered || isGlowActive;
  const cardStyle: React.CSSProperties = {
    fontSize: `${sceneFont}px`,
    background: 'rgba(255, 255, 255, 0.05)',
    border: `1px solid ${isGlowing ? glowBorder : 'rgba(255, 255, 255, 0.1)'}`,
    boxShadow: isGlowing
      ? `0 0 40px 8px ${glowRgba}, 0 0 80px 16px ${glowSoft}, inset 0 0 25px 3px ${glowRgba}`
      : '0 1px 3px rgba(0, 0, 0, 0.1)',
    transition: 'border-color 600ms ease-out, box-shadow 600ms ease-out',
  };

  return (
    <button
      type="button"
      className="relative w-full cursor-pointer rounded-lg text-left"
      style={cardStyle}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label={`${scene.name} — ${worldMeta?.label ?? scene.world}`}
    >
      {/* Ethereal glow - top radial — SAME as exchange-card.tsx */}
      <span
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${glowRgba} 0%, transparent 70%)`,
          opacity: isGlowing ? 1 : 0,
          transition: 'opacity 600ms ease-out',
        }}
        aria-hidden="true"
      />

      {/* Ethereal glow - bottom radial — SAME as exchange-card.tsx */}
      <span
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg"
        style={{
          background: `radial-gradient(ellipse at 50% 100%, ${glowSoft} 0%, transparent 60%)`,
          opacity: isGlowing ? 0.6 : 0,
          transition: 'opacity 600ms ease-out',
        }}
        aria-hidden="true"
      />

      {/* MAIN LAYOUT — same vertical structure as exchange card left section */}
      <div className="relative z-10 flex flex-col">
        {/* TOP ROW — SAME px-4 py-1 as exchange card top row */}
        <div className="px-4 py-1">
          {/* Line 1: Tier dot + Emoji + Scene Name + Arrow */}
          <div className="flex items-center gap-2">
            {/* Tier dot — matches market status dot */}
            <span
              className="shrink-0 rounded-full"
              style={{
                width: '0.6em',
                height: '0.6em',
                backgroundColor: dotColor,
                boxShadow: `0 0 4px ${dotColor}`,
              }}
              aria-hidden="true"
            />
            <span style={{ fontSize: '0.90em' }}>{scene.emoji}</span>
            <span
              className="min-w-0 flex-1 truncate font-medium leading-tight text-slate-100"
              style={{ fontSize: '0.90em' }}
            >
              {scene.name}
            </span>
            {/* Arrow — shows provider name on hover when provider selected */}
            <span
              className="shrink-0 truncate"
              style={{
                fontSize: '0.75em',
                maxWidth: '6em',
                transition: 'color 200ms ease-out',
                color: isHovered ? '#22D3EE' : 'rgba(255,255,255,0.85)',
              }}
              aria-hidden="true"
            >
              {isHovered && providerName ? `→ ${providerName}` : '→'}
            </span>
          </div>

          {/* Line 2: World emoji + label — matches exchange city + flag line */}
          <div className="mt-1 flex items-center gap-2" style={{ minHeight: '1.25em' }}>
            <span className="text-slate-400 whitespace-nowrap" style={{ fontSize: '0.75em' }}>
              {worldMeta?.emoji ?? '🎬'} {worldMeta?.label ?? scene.world}
            </span>
          </div>
        </div>

        {/* HORIZONTAL DIVIDER — SAME as exchange card */}
        <div className="border-t border-white/5" aria-hidden="true" />

        {/* BOTTOM ROW — vibe phrase only */}
        <div className="flex items-center gap-2 px-4 py-1">
          {vibePhrase && (
            <span
              className="min-w-0 flex-1 truncate italic text-white/60"
              style={{ fontSize: '0.75em' }}
            >
              {vibePhrase}
            </span>
          )}
        </div>
      </div>
    </button>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SceneStartersPreview({
  isAuthenticated: _isAuthenticated,
  userTier: _userTier,
  selectedProvider,
  onNudgeProvider,
}: SceneStartersPreviewProps) {
  // ── Snap-fit font from container width ─────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const [sceneFont, setSceneFont] = useState(16);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const computeFont = () => {
      const w = el.clientWidth;
      if (w <= 0) return;
      const px = Math.round(Math.min(MAX_FONT, Math.max(MIN_FONT, w * FONT_SCALE)));
      setSceneFont((prev) => (prev === px ? prev : px));
    };
    computeFont();
    const ro = new ResizeObserver(() => computeFont());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Rotation state ─────────────────────────────────────────────────────
  const freeBatches = useMemo(() => buildFreeBatches(), []);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const [fadeState, setFadeState] = useState<'visible' | 'fading-out' | 'fading-in'>('visible');

  useEffect(() => {
    if (freeBatches.length <= 1) return;
    const timer = setInterval(() => {
      setFadeState('fading-out');
      setTimeout(() => {
        setCurrentBatchIndex((prev) => (prev + 1) % freeBatches.length);
        setFadeState('fading-in');
        setTimeout(() => setFadeState('visible'), 300);
      }, 300);
    }, ROTATION_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [freeBatches.length]);

  const currentBatch = freeBatches[currentBatchIndex] ?? freeBatches[0]!;

  // ── Cascading glow cycle ───────────────────────────────────────────────
  // Card 0 glows 3s → 1s dark → Card 1 glows 3s → 1s dark → ... → loops
  const [activeGlowIndex, setActiveGlowIndex] = useState(0);
  const [glowOn, setGlowOn] = useState(true);

  useEffect(() => {
    // Phase 1: glow ON for GLOW_ON_MS, then turn off
    const offTimer = setTimeout(() => {
      setGlowOn(false);
    }, GLOW_ON_MS);

    // Phase 2: after GLOW_ON_MS + GLOW_OFF_MS, advance to next card
    const nextTimer = setTimeout(() => {
      setActiveGlowIndex((prev) => (prev + 1) % currentBatch.length);
      setGlowOn(true);
    }, GLOW_ON_MS + GLOW_OFF_MS);

    return () => {
      clearTimeout(offTimer);
      clearTimeout(nextTimer);
    };
  }, [activeGlowIndex, currentBatch.length]);

  // Reset glow to card 0 when batch rotates
  useEffect(() => {
    setActiveGlowIndex(0);
    setGlowOn(true);
  }, [currentBatchIndex]);

  // ── Caches ─────────────────────────────────────────────────────────────
  const bestTierMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of allScenes) m.set(s.id, getBestTier(s));
    return m;
  }, []);

  const vibeMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of allScenes) m.set(s.id, getVibePhrase(s));
    return m;
  }, []);

  // ── Scene click handler ────────────────────────────────────────────────
  const handleNavigate = useCallback(
    (sceneId: string) => {
      const id = selectedProvider?.id;
      if (!id) {
        onNudgeProvider?.();
        return;
      }
      try {
        sessionStorage.setItem(PRELOAD_SCENE_KEY, sceneId);
      } catch {
        /* noop */
      }
      window.location.href = `/providers/${encodeURIComponent(id)}`;
    },
    [selectedProvider, onNudgeProvider],
  );

  // ── "25 free · 175 Pro" click → prompt builder with empty dropdowns ────
  const handleExploreClick = useCallback(() => {
    const id = selectedProvider?.id;
    if (!id) {
      onNudgeProvider?.();
      return;
    }
    try {
      sessionStorage.removeItem(PRELOAD_SCENE_KEY);
    } catch {
      /* noop */
    }
    window.location.href = `/providers/${encodeURIComponent(id)}`;
  }, [selectedProvider, onNudgeProvider]);

  // ── Image Quality rank text (dynamic from provider data) ───────────────
  const rankText = useMemo(() => {
    const rank = selectedProvider?.imageQualityRank;
    if (typeof rank !== 'number') return null;
    return `Ranked ${formatOrdinal(rank)} for Image Quality`;
  }, [selectedProvider]);

  const hasProvider = selectedProvider !== null;
  const sceneListOpacity = fadeState === 'fading-out' ? 0 : 1;

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="flex h-full flex-col" data-testid="scene-starters-preview">
      {/* ── Inline animations (no globals) ────────────────────────────── */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes scene-subtitle-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .scene-subtitle-pulse {
          animation: scene-subtitle-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `,
        }}
      />

      {/* ── Header — centred title ────────────────────────────────────── */}
      <div
        className="flex items-center justify-center"
        style={{ gap: 'clamp(4px, 0.4vw, 8px)', marginBottom: 'clamp(4px, 0.4vw, 7px)' }}
      >
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
          className="font-semibold leading-tight"
          style={{ fontSize: 'clamp(0.65rem, 0.9vw, 1.2rem)' }}
        >
          <span className="whitespace-nowrap bg-gradient-to-r from-sky-400 via-emerald-300 to-indigo-400 bg-clip-text text-transparent">
            Scene Starters
          </span>
        </span>
      </div>

      {/* ── Subtitle — changes based on provider state ────────────────── */}
      <p
        className="scene-subtitle-pulse italic text-amber-400/80 truncate"
        style={{
          fontSize: 'clamp(0.5625rem, 0.75vw, 1rem)',
          marginBottom: 'clamp(5px, 0.5vw, 9px)',
          textAlign: 'center',
        }}
      >
        {hasProvider ? 'Click a scene to start building.' : 'Select a platform above to unlock scenes.'}
      </p>

      {/* ── Scene Cards ───────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30"
        style={{
          opacity: sceneListOpacity,
          transition: 'opacity 300ms ease-in-out',
        }}
      >
        {currentBatch.map((scene, index) => (
          <SceneCard
            key={scene.id}
            scene={scene}
            worldMeta={WORLD_BY_SLUG.get(scene.world)}
            bestTier={bestTierMap.get(scene.id) ?? 1}
            vibePhrase={vibeMap.get(scene.id) ?? ''}
            sceneFont={sceneFont}
            providerName={selectedProvider?.name ?? null}
            isGlowActive={glowOn && index === activeGlowIndex}
            onNavigate={handleNavigate}
          />
        ))}
      </div>

      {/* ── Footer: icon+rank left | "25 free · 175 Pro" right ─────── */}
      <div
        className="flex shrink-0 items-center justify-between"
        style={{ marginTop: 'clamp(6px, 0.5vw, 10px)' }}
      >
        {/* Left: provider icon + rank (only when provider selected) */}
        {selectedProvider ? (
          <div className="flex items-center">
            <div
              className="relative shrink-0 overflow-hidden rounded-md"
              style={{
                width: 'clamp(36px, 3vw, 48px)',
                height: 'clamp(36px, 3vw, 48px)',
                border: `1px solid ${getBrandColor(selectedProvider.id)}`,
                boxShadow: `0 0 6px ${hexToRgba(getBrandColor(selectedProvider.id), 0.4)}`,
              }}
            >
              <Image
                src={getIconPath(selectedProvider)}
                alt={selectedProvider.name}
                fill
                sizes="48px"
                className="object-contain"
              />
            </div>
            {rankText && (
              <span
                className="text-white"
                style={{ fontSize: 'clamp(0.5625rem, 0.7vw, 0.85rem)', marginLeft: '0.5em' }}
              >
                &nbsp;&nbsp;{rankText}
              </span>
            )}
          </div>
        ) : (
          <span />
        )}

        {/* Right: explore count — clickable */}
        <button
          type="button"
          onClick={handleExploreClick}
          className="shrink-0 cursor-pointer text-emerald-400 transition-colors hover:text-emerald-300"
          style={{ fontSize: 'clamp(0.5625rem, 0.65vw, 0.75rem)' }}
        >
          25 free · 175 Pro
        </button>
      </div>
    </div>
  );
}
