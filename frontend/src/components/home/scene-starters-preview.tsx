// src/components/home/scene-starters-preview.tsx
// ============================================================================
// SCENE STARTERS PREVIEW — Left rail on new homepage (v3.0.0)
// ============================================================================
// Cards are STRUCTURALLY IDENTICAL to exchange-card.tsx:
// - Same snap-fit font system (ResizeObserver, width × 0.042, clamped 12–20px)
// - Same padding classes (px-4 py-1)
// - Same em-based font sizes (0.90em top row, 0.75em bottom row)
// - Same mt-1 gap between lines in top row
// - Same horizontal divider (border-t border-white/5)
// - Same dual radial glow overlays on hover
// - Same border/boxShadow treatment
// - Same gap between cards (space-y-3 from parent container)
//
// No provider UI — Engine Bay handles selection. Provider state from parent.
// Scene click + no provider → calls onNudgeProvider to open Engine Bay dropdown.
// Scene click + provider → navigates to prompt builder with scene pre-loaded.
//
// 8 free scenes per batch. Rotates every 5 minutes.
//
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

// ── Tier dot colours ────────────────────────────────────────────────────
const TIER_DOT_COLORS: Record<number, string> = {
  1: '#22D3EE', 2: '#A78BFA', 3: '#34D399', 4: '#FBBF24',
};

// ── Provider icon display (header only) ─────────────────────────────────
const DEFAULT_BRAND_COLOR = '#3B82F6';
const ICON_PATH_PATTERN = '/icons/providers/';
const PLATFORM_COLORS: Readonly<Record<string, string>> = {
  midjourney: '#7C3AED', flux: '#F97316', 'google-imagen': '#4285F4',
  openai: '#10B981', leonardo: '#EC4899', 'adobe-firefly': '#FF6B35',
  stability: '#8B5CF6', ideogram: '#06B6D4', canva: '#00C4CC',
  'imagine-meta': '#0668E1', dreamstudio: '#A855F7',
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
    if (a > bestScore) { bestScore = a; best = t; }
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
  if (arr && arr.length > 0) return arr[0] ?? '';
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
  onNavigate,
}: {
  scene: SceneEntry;
  worldMeta: WorldMeta | undefined;
  bestTier: number;
  vibePhrase: string;
  sceneFont: number;
  onNavigate: (sceneId: string) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const dotColor = TIER_DOT_COLORS[bestTier] ?? TIER_DOT_COLORS[1]!;
  const categoryCount = Object.keys(scene.prefills).length;

  // ── Glow colours — same pattern as exchange-card.tsx ───────────────────
  const glowRgba = hexToRgba(dotColor, 0.3);
  const glowBorder = hexToRgba(dotColor, 0.5);
  const glowSoft = hexToRgba(dotColor, 0.15);

  const handleClick = useCallback(() => {
    onNavigate(scene.id);
  }, [scene.id, onNavigate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); }
  }, [handleClick]);

  // ── Card style — same pattern as exchange-card.tsx cardStyle ───────────
  const cardStyle: React.CSSProperties = {
    fontSize: `${sceneFont}px`,
    background: 'rgba(255, 255, 255, 0.05)',
    border: `1px solid ${isHovered ? glowBorder : 'rgba(255, 255, 255, 0.1)'}`,
    boxShadow: isHovered
      ? `0 0 40px 8px ${glowRgba}, 0 0 80px 16px ${glowSoft}, inset 0 0 25px 3px ${glowRgba}`
      : '0 1px 3px rgba(0, 0, 0, 0.1)',
    transition: 'border-color 200ms ease-out, box-shadow 200ms ease-out',
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
          opacity: isHovered ? 1 : 0,
          transition: 'opacity 200ms ease-out',
        }}
        aria-hidden="true"
      />

      {/* Ethereal glow - bottom radial — SAME as exchange-card.tsx */}
      <span
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg"
        style={{
          background: `radial-gradient(ellipse at 50% 100%, ${glowSoft} 0%, transparent 60%)`,
          opacity: isHovered ? 0.6 : 0,
          transition: 'opacity 200ms ease-out',
        }}
        aria-hidden="true"
      />

      {/* MAIN LAYOUT — same vertical structure as exchange card left section */}
      <div className="relative z-10 flex flex-col">

        {/* TOP ROW — SAME px-4 py-1 as exchange card top row */}
        <div className="px-4 py-1">
          {/* Line 1: Tier dot + Emoji + Scene Name — matches exchange name line */}
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

        {/* BOTTOM ROW — SAME px-4 py-1 as exchange card index row */}
        <div className="flex items-center gap-2 px-4 py-1">
          <span className="shrink-0 text-slate-400" style={{ fontSize: '0.75em' }}>
            {categoryCount} categories
          </span>
          {vibePhrase && (
            <>
              <span className="shrink-0 text-slate-600" style={{ fontSize: '0.75em' }}>·</span>
              <span
                className="min-w-0 flex-1 truncate italic text-slate-500"
                style={{ fontSize: '0.70em' }}
              >
                {vibePhrase}
              </span>
            </>
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
  // SIMPLE: read the prop. If it has a provider id, navigate. Otherwise nudge.
  // No localStorage. No fallbacks. No cleverness.
  const handleNavigate = useCallback((sceneId: string) => {
    const id = selectedProvider?.id;
    if (!id) {
      onNudgeProvider?.();
      return;
    }
    try { sessionStorage.setItem(PRELOAD_SCENE_KEY, sceneId); } catch { /* noop */ }
    window.location.href = `/providers/${encodeURIComponent(id)}`;
  }, [selectedProvider, onNudgeProvider]);

  const sceneListOpacity = fadeState === 'fading-out' ? 0 : 1;

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="flex h-full flex-col" data-testid="scene-starters-preview">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between"
        style={{ marginBottom: 'clamp(4px, 0.4vw, 7px)' }}
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

          {/* Selected provider icon — confirms Engine Bay choice */}
          {selectedProvider && (
            <div
              className="relative overflow-hidden rounded-md"
              style={{
                width: 'clamp(16px, 1.2vw, 22px)',
                height: 'clamp(16px, 1.2vw, 22px)',
                border: `1px solid ${getBrandColor(selectedProvider.id)}`,
                boxShadow: `0 0 6px ${hexToRgba(getBrandColor(selectedProvider.id), 0.4)}`,
              }}
            >
              <Image
                src={getIconPath(selectedProvider)}
                alt={selectedProvider.name}
                fill
                sizes="22px"
                className="object-contain"
              />
            </div>
          )}
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
          fontSize: 'clamp(0.42rem, 0.52vw, 0.64rem)',
          marginBottom: 'clamp(5px, 0.5vw, 9px)',
        }}
      >
        Select a platform above, then click a scene to launch the prompt builder with categories pre-filled.
      </p>

      {/* ── Scene Cards — space-y-3 matches exchange rail gap ─────────── */}
      <div
        ref={containerRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30"
        style={{
          opacity: sceneListOpacity,
          transition: 'opacity 300ms ease-in-out',
        }}
      >
        {currentBatch.map((scene) => (
          <SceneCard
            key={scene.id}
            scene={scene}
            worldMeta={WORLD_BY_SLUG.get(scene.world)}
            bestTier={bestTierMap.get(scene.id) ?? 1}
            vibePhrase={vibeMap.get(scene.id) ?? ''}
            sceneFont={sceneFont}
            onNavigate={handleNavigate}
          />
        ))}
      </div>
    </div>
  );
}
