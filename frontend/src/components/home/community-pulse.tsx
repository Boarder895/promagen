// src/components/home/community-pulse.tsx
// ============================================================================
// COMMUNITY PULSE — Right rail on new homepage (v9.0.0 — 8 platform prompt cards)
// ============================================================================
// Structurally mirrors scene-starters-preview.tsx for visual symmetry.
//
// All 8 cards: Platform prompt cards from 210 pre-generated entries
//   - Per-card glow from platform brand colour (same as scene-starters per-tier)
//   - Line 1: Platform icon + platform name
//   - Line 2: Prompt description (subject + style, italic)
//   - Line 3: "Created in" + flag + location name (city/town)
//   - Like heart: identical to PotM LikeButton (same JSX/sizes/colours)
//   - Flag hover: portal tooltip with full optimised prompt + copy button
//
// v9.0.0: Removed online users cards. Extended from 6 to 8 prompt cards.
//
// Rotation: all 8 picks rotate every 30 minutes (deterministic)
// Cascading glow cycle: 3s on → 1s dark → next card
//
// Authority: docs/authority/homepage.md §6
// Existing features preserved: Yes — window dimensions unchanged
// ============================================================================

'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import demoPrompts from '@/data/community-pulse/demo-prompts.json';
import { useCommunityPulse } from '@/hooks/use-community-pulse';
import type { CommunityPulseEntry } from '@/types/homepage';

// ============================================================================
// CONSTANTS — MATCHED TO scene-starters-preview.tsx
// ============================================================================

const MIN_FONT = 12;
const MAX_FONT = 20;
const FONT_SCALE = 0.042;

const GLOW_ON_MS = 3000;
const GLOW_OFF_MS = 1000;

const CARD_COUNT = 8;
const USER_CARD_COUNT = 8;

/** Rotation cadence: pick new top 6 every 30 minutes */
const ROTATION_MS = 30 * 60 * 1000;

function hexToRgba(hex: string, alpha: number): string {
  const safe = /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : '#3B82F6';
  const r = parseInt(safe.slice(1, 3), 16);
  const g = parseInt(safe.slice(3, 5), 16);
  const b = parseInt(safe.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ── Prompt tooltip constants (match weather-prompt-tooltip.tsx) ──────────
const CLOSE_DELAY_MS = 400;
const TOOLTIP_GAP = 8;
const TOOLTIP_WIDTH = 450;

// ── Platform brand colours (same map as scene-starters-preview.tsx) ─────
const PLATFORM_COLORS: Readonly<Record<string, string>> = {
  midjourney: '#7C3AED', openai: '#10B981', 'google-imagen': '#4285F4',
  leonardo: '#EC4899', flux: '#F97316', stability: '#8B5CF6',
  'adobe-firefly': '#FF6B35', ideogram: '#06B6D4', playground: '#3B82F6',
  'microsoft-designer': '#0078D4', novelai: '#A855F7', lexica: '#14B8A6',
  openart: '#F43F5E', '123rf': '#EF4444', canva: '#00C4CC',
  bing: '#0078D4', nightcafe: '#D946EF', picsart: '#FF3366',
  artistly: '#8B5CF6', fotor: '#22C55E', pixlr: '#3B82F6',
  deepai: '#6366F1', craiyon: '#FBBF24', bluewillow: '#3B82F6',
  dreamstudio: '#A855F7', artbreeder: '#10B981', 'jasper-art': '#F59E0B',
  runway: '#EF4444', freepik: '#0EA5E9', simplified: '#8B5CF6',
  photoleap: '#EC4899', vistacreate: '#F97316', artguru: '#06B6D4',
  myedit: '#3B82F6', visme: '#7C3AED', hotpot: '#F59E0B',
  picwish: '#10B981', clipdrop: '#6366F1', getimg: '#14B8A6',
  'imagine-meta': '#0668E1', dreamlike: '#D946EF', 'remove-bg': '#22C55E',
};
const DEFAULT_BRAND_COLOR = '#3B82F6';

/**
 * Convert a live CommunityPulseEntry (from API) into the DemoEntry format
 * that UserPromptCard expects. Maps fields and derives missing values.
 */
function apiEntryToCard(entry: CommunityPulseEntry): DemoEntry {
  const pid = entry.platformId || '';

  return {
    platformId: pid,
    platformName: entry.platform || pid,
    platformIcon: `/icons/providers/${pid}.png`,
    brandColor: PLATFORM_COLORS[pid] ?? DEFAULT_BRAND_COLOR,
    description: entry.description || '',
    optimisedPrompt: entry.promptText || entry.description || '',
    score: entry.score,
    countryCode: entry.countryCode || '',
    locationName: entry.locationName || '',
    likeCount: entry.likeCount,
    isLive: true,
  };
}

// ============================================================================
// DEMO ENTRY TYPE
// ============================================================================

interface DemoEntry {
  platformId: string;
  platformName: string;
  platformIcon: string;
  brandColor: string;
  description: string;
  optimisedPrompt: string;
  score: number;
  countryCode: string;
  locationName: string;
  likeCount: number;
  /** True = real user data from API, false = demo placeholder */
  isLive: boolean;
}

// ============================================================================
// PROMPT TOOLTIP — Portal-based (matches weather-prompt-tooltip.tsx exactly)
// ============================================================================

function PromptTooltipContent({
  entry,
  position,
  onMouseEnter,
  onMouseLeave,
  onCopy,
  copied,
}: {
  entry: DemoEntry;
  position: { top: number; left: number };
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onCopy: () => void;
  copied: boolean;
}) {
  const glowRgba = hexToRgba(entry.brandColor, 0.3);
  const glowBorder = hexToRgba(entry.brandColor, 0.5);
  const glowSoft = hexToRgba(entry.brandColor, 0.15);

  return (
    <div
      role="tooltip"
      className="fixed rounded-xl px-6 py-4 text-sm text-slate-100"
      style={{
        top: position.top,
        left: position.left,
        transform: 'translateY(-50%)',
        zIndex: 99999,
        background: 'rgba(15, 23, 42, 0.97)',
        border: `1px solid ${glowBorder}`,
        boxShadow: `0 0 40px 8px ${glowRgba}, 0 0 80px 16px ${glowSoft}, inset 0 0 25px 3px ${glowRgba}`,
        width: `${TOOLTIP_WIDTH}px`,
        maxWidth: `${TOOLTIP_WIDTH}px`,
        minWidth: '300px',
        pointerEvents: 'auto',
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Ethereal glow overlay - top radial */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${glowRgba} 0%, transparent 70%)` }}
      />
      {/* Bottom glow accent */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl"
        style={{ background: `radial-gradient(ellipse at 50% 100%, ${glowSoft} 0%, transparent 60%)`, opacity: 0.6 }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col gap-3">
        {/* Header: "Image Prompt" + copy button */}
        <div className="mb-1 flex items-center justify-between gap-2">
          <span
            className="text-base font-semibold text-white"
            style={{ textShadow: `0 0 12px ${glowRgba}` }}
          >
            Image Prompt
          </span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onCopy(); }}
            className={`inline-flex h-6 w-6 items-center justify-center rounded-md transition-all duration-200 ${
              copied
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
            }`}
            title={copied ? 'Copied!' : 'Copy prompt'}
            aria-label={copied ? 'Copied to clipboard' : 'Copy prompt to clipboard'}
          >
            {copied ? (
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        </div>

        {/* Platform label */}
        <span className="-mt-1 text-xs text-slate-300">
          {entry.platformName}
        </span>

        {/* Prompt text */}
        <p
          className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-200"
          style={{ maxWidth: '420px' }}
        >
          {entry.optimisedPrompt}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// USER PROMPT CARD
// ============================================================================

const UserPromptCard = React.memo(function UserPromptCard({
  entry,
  cardFont,
  isGlowActive,
}: {
  entry: DemoEntry;
  cardFont: number;
  isGlowActive: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipCoords, setTooltipCoords] = useState({ top: 0, left: 0 });
  const [copied, setCopied] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const flagRef = useRef<HTMLSpanElement>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isGlowing = isHovered || isGlowActive;

  useEffect(() => { setIsMounted(true); return () => setIsMounted(false); }, []);
  useEffect(() => { if (copied) { const t = setTimeout(() => setCopied(false), 1500); return () => clearTimeout(t); } }, [copied]);
  useEffect(() => { return () => { if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current); }; }, []);

  const clearCloseTimeout = useCallback(() => {
    if (closeTimeoutRef.current) { clearTimeout(closeTimeoutRef.current); closeTimeoutRef.current = null; }
  }, []);

  const startCloseDelay = useCallback(() => {
    clearCloseTimeout();
    closeTimeoutRef.current = setTimeout(() => setTooltipVisible(false), CLOSE_DELAY_MS);
  }, [clearCloseTimeout]);

  const handleFlagEnter = useCallback(() => {
    clearCloseTimeout();
    if (flagRef.current) {
      const rect = flagRef.current.getBoundingClientRect();
      setTooltipCoords({ top: rect.top + rect.height / 2, left: rect.left - TOOLTIP_WIDTH - TOOLTIP_GAP });
    }
    setTooltipVisible(true);
  }, [clearCloseTimeout]);

  const handleFlagLeave = useCallback(() => { startCloseDelay(); }, [startCloseDelay]);
  const handleTooltipEnter = useCallback(() => { clearCloseTimeout(); }, [clearCloseTimeout]);
  const handleTooltipLeave = useCallback(() => { startCloseDelay(); }, [startCloseDelay]);

  const handleCopy = useCallback(async () => {
    try { await navigator.clipboard.writeText(entry.optimisedPrompt); setCopied(true); } catch { /* noop */ }
  }, [entry.optimisedPrompt]);

  // ── Per-card glow from brand colour (same pattern as scene-starters) ──
  const glowRgba = hexToRgba(entry.brandColor, 0.3);
  const glowBorder = hexToRgba(entry.brandColor, 0.5);
  const glowSoft = hexToRgba(entry.brandColor, 0.15);

  const cardStyle: React.CSSProperties = {
    fontSize: `${cardFont}px`,
    height: 'clamp(74px, 6.2vw, 104px)',
    overflow: 'hidden',
    background: 'rgba(255, 255, 255, 0.05)',
    border: `1px solid ${isGlowing ? glowBorder : 'rgba(255, 255, 255, 0.1)'}`,
    boxShadow: isGlowing
      ? `0 0 40px 8px ${glowRgba}, 0 0 80px 16px ${glowSoft}, inset 0 0 25px 3px ${glowRgba}`
      : '0 1px 3px rgba(0, 0, 0, 0.1)',
    transition: 'border-color 600ms ease-out, box-shadow 600ms ease-out',
  };

  return (
    <div
      className="relative w-full rounded-lg"
      style={cardStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Ethereal glow - top radial */}
      <span
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${glowRgba} 0%, transparent 70%)`,
          opacity: isGlowing ? 1 : 0,
          transition: 'opacity 600ms ease-out',
        }}
        aria-hidden="true"
      />
      {/* Ethereal glow - bottom radial */}
      <span
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg"
        style={{
          background: `radial-gradient(ellipse at 50% 100%, ${glowSoft} 0%, transparent 60%)`,
          opacity: isGlowing ? 0.6 : 0,
          transition: 'opacity 600ms ease-out',
        }}
        aria-hidden="true"
      />

      {/* MAIN LAYOUT — 3 equal rows via fixed 33.333% height each */}
      <div
        className="relative z-10 flex h-full flex-col justify-between"
        style={{ padding: 'clamp(5px, 0.4vw, 8px) clamp(8px, 0.7vw, 14px)' }}
      >
        {/* LINE 1: Platform icon + platform name + heart */}
        <div className="flex items-center gap-2" style={{ height: '33.333%' }}>
          {/* Platform icon */}
          <span
            className="relative shrink-0 overflow-hidden rounded-sm"
            style={{ width: 'clamp(14px, 1.2vw, 20px)', height: 'clamp(14px, 1.2vw, 20px)' }}
          >
            <Image
              src={entry.platformIcon}
              alt={entry.platformName}
              fill
              sizes="20px"
              className="object-contain"
              style={{ filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.4))' }}
            />
          </span>
          {/* Platform name */}
          <span
            className="min-w-0 flex-1 truncate font-medium leading-tight text-slate-100"
            style={{ fontSize: '0.90em' }}
          >
            {entry.platformName}
          </span>
          {/* Score — only shown for live user entries (demo entries have no score) */}
          {entry.isLive && (
            <span
              className="shrink-0 tabular-nums text-white"
              style={{ fontSize: '0.85em' }}
            >
              {entry.score}/100
            </span>
          )}
          {/* Like heart — scaled to fit row height */}
          <span
            className="inline-flex shrink-0 items-center text-pink-400"
            style={{
              gap: 'clamp(4px, 0.4vw, 6px)',
              fontSize: '0.85em',
            }}
          >
            <span aria-hidden="true">
              {entry.likeCount > 0 ? '♥' : '♡'}
            </span>
            {entry.likeCount > 0 && (
              <span className="tabular-nums text-emerald-400">{entry.likeCount}</span>
            )}
          </span>
        </div>

        {/* LINE 2: Prompt description — uppercase first letter */}
        <div className="flex items-center" style={{ height: '33.333%' }}>
          <span
            className="min-w-0 flex-1 truncate italic text-slate-300"
            style={{ fontSize: '0.75em' }}
          >
            {entry.description.charAt(0).toUpperCase() + entry.description.slice(1)}
          </span>
        </div>

        {/* LINE 3: Created in + flag + location name */}
        <div
          className="flex items-center"
          style={{ height: '33.333%', fontSize: '0.68em' }}
        >
          <span className="text-slate-400">Created in</span>
          {/* Flag — tooltip trigger */}
          <span
            ref={flagRef}
            className="relative inline-flex shrink-0 cursor-pointer overflow-hidden rounded-sm"
            style={{
              width: 'clamp(18px, 1.5vw, 24px)',
              height: 'clamp(14px, 1.1vw, 18px)',
              marginLeft: 'clamp(6px, 0.6vw, 10px)',
              marginRight: 'clamp(6px, 0.6vw, 10px)',
            }}
            onMouseEnter={handleFlagEnter}
            onMouseLeave={handleFlagLeave}
          >
            <Image
              src={`/flags/${entry.countryCode.toLowerCase()}.svg`}
              alt={entry.countryCode}
              fill
              sizes="24px"
              className="object-cover"
            />
          </span>
          {/* Location name — brand colour tint per card */}
          {entry.locationName && (
            <span
              className="min-w-0 truncate font-medium"
              style={{ color: entry.brandColor }}
            >
              {entry.locationName}
            </span>
          )}
        </div>
      </div>

      {/* Tooltip via Portal */}
      {isMounted && tooltipVisible && createPortal(
        <PromptTooltipContent
          entry={entry}
          position={tooltipCoords}
          onMouseEnter={handleTooltipEnter}
          onMouseLeave={handleTooltipLeave}
          onCopy={handleCopy}
          copied={copied}
        />,
        document.body,
      )}
    </div>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CommunityPulse() {
  // ── Snap-fit font ─────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const [cardFont, setCardFont] = useState(16);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const computeFont = () => {
      const w = el.clientWidth;
      if (w <= 0) return;
      const px = Math.round(Math.min(MAX_FONT, Math.max(MIN_FONT, w * FONT_SCALE)));
      setCardFont((prev) => (prev === px ? prev : px));
    };
    computeFont();
    const ro = new ResizeObserver(() => computeFont());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Cascading glow cycle ──────────────────────────────────────────────
  const [activeGlowIndex, setActiveGlowIndex] = useState(0);
  const [glowOn, setGlowOn] = useState(true);

  useEffect(() => {
    const offTimer = setTimeout(() => setGlowOn(false), GLOW_ON_MS);
    const nextTimer = setTimeout(() => {
      setActiveGlowIndex((prev) => (prev + 1) % CARD_COUNT);
      setGlowOn(true);
    }, GLOW_ON_MS + GLOW_OFF_MS);
    return () => { clearTimeout(offTimer); clearTimeout(nextTimer); };
  }, [activeGlowIndex]);

  // ── Live data from API ─────────────────────────────────────────────
  const { entries: liveEntries } = useCommunityPulse();

  // Filter to user-created entries only (source === 'user')
  const userCards = useMemo(() =>
    liveEntries
      .filter((e) => e.source === 'user')
      .slice(0, USER_CARD_COUNT)
      .map(apiEntryToCard),
    [liveEntries],
  );

  // ── 30-minute rotation for demo fallback ──────────────────────────
  const [rotationSlot, setRotationSlot] = useState(() =>
    Math.floor(Date.now() / ROTATION_MS),
  );

  useEffect(() => {
    const id = setInterval(() => {
      setRotationSlot(Math.floor(Date.now() / ROTATION_MS));
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  // Real user entries take top slots, demo fills the rest
  const displayCards = useMemo(() => {
    const all = (demoPrompts as Array<Omit<DemoEntry, 'isLive'>>).map(
      (e) => ({ ...e, isLive: false }) as DemoEntry,
    );
    const demoSlotsNeeded = USER_CARD_COUNT - userCards.length;

    if (demoSlotsNeeded <= 0) {
      return userCards.slice(0, USER_CARD_COUNT);
    }

    const offset = (rotationSlot * demoSlotsNeeded) % all.length;
    const demoPicks: DemoEntry[] = [];
    for (let i = 0; i < demoSlotsNeeded; i++) {
      demoPicks.push(all[(offset + i) % all.length]!);
    }

    return [...userCards, ...demoPicks];
  }, [userCards, rotationSlot]);

  // ══════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════

  return (
    <div className="flex h-full flex-col" data-testid="community-pulse">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes pulse-subtitle-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .pulse-subtitle-pulse {
          animation: pulse-subtitle-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `,
        }}
      />

      {/* Header (MIRRORS scene-starters) */}
      <div
        className="flex items-center justify-center"
        style={{ gap: 'clamp(4px, 0.4vw, 8px)', marginBottom: 'clamp(4px, 0.4vw, 7px)' }}
      >
        <div
          className="animate-pulse rounded-full"
          style={{ backgroundColor: '#10B981', width: 'clamp(6px, 0.35vw, 10px)', height: 'clamp(6px, 0.35vw, 10px)' }}
          aria-hidden="true"
        />
        <span className="font-semibold leading-tight" style={{ fontSize: 'clamp(0.65rem, 0.9vw, 1.2rem)' }}>
          <span className="whitespace-nowrap bg-gradient-to-r from-sky-400 via-emerald-300 to-indigo-400 bg-clip-text text-transparent">
            Community Pulse
          </span>
        </span>
      </div>

      {/* Subtitle */}
      <p
        className="pulse-subtitle-pulse truncate italic text-amber-400/80"
        style={{ fontSize: 'clamp(0.5625rem, 0.75vw, 1rem)', marginBottom: 'clamp(5px, 0.5vw, 9px)', textAlign: 'center' }}
      >
        The most popular prompts
      </p>

      {/* Cards */}
      <div
        ref={containerRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30"
      >
        {/* All 8: Platform prompt cards */}
        {displayCards.map((entry, index) => (
          <UserPromptCard
            key={`${entry.platformId}-${entry.description}-${rotationSlot}`}
            entry={entry}
            cardFont={cardFont}
            isGlowActive={glowOn && index === activeGlowIndex}
          />
        ))}
      </div>

      {/* Footer */}
      <div
        className="flex shrink-0 items-center justify-between"
        style={{ marginTop: 'clamp(6px, 0.5vw, 10px)', minHeight: 'clamp(36px, 3vw, 48px)' }}
      >
        <span
          className="inline-flex items-center text-emerald-400"
          style={{ fontSize: 'clamp(0.5rem, 0.6vw, 0.75rem)', gap: 'clamp(3px, 0.25vw, 5px)' }}
        >
          <span
            className="inline-block animate-pulse rounded-full"
            style={{ backgroundColor: '#10B981', width: 'clamp(5px, 0.3vw, 7px)', height: 'clamp(5px, 0.3vw, 7px)' }}
            aria-hidden="true"
          />
          Live
        </span>
        <span
          className="shrink-0 text-emerald-400"
          style={{ fontSize: 'clamp(0.5625rem, 0.65vw, 0.75rem)' }}
        >
          42 platforms
        </span>
      </div>
    </div>
  );
}
