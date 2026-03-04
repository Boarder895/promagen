// src/components/home/prompt-showcase.tsx
// ============================================================================
// PROMPT OF THE MOMENT — Showcase Component (v7 — tooltip parity + countdown)
// ============================================================================
// Centre-column hero for the new homepage. Displays live weather-driven
// prompts for the current rotation city across all 4 tiers.
//
// Features:
// - City header: flag, weather/moon emoji with tooltip, venue, conditions, local time
// - Weather emoji: day → OWM emoji, night → moon phase (matches leaderboard exactly)
// - Tooltip: ProviderWeatherEmojiTooltip (identical data to leaderboard column 1)
//   Opens to the RIGHT of the emoji. TTS continues after tooltip closes.
// - Metadata line: Venue · Conditions · HH:MM (blinking colon, no mood, no TZ suffix)
// - Countdown: "Live weather prompt · next city in M:SS" amber italic (matches mission control)
// - 4 tier panels in 2×2 grid (CLIP, Midjourney, Natural Language, Plain)
// - Copy button per tier (clipboard + 1.5s "Copied!" feedback)
// - Like button per tier (♡/♥ with optimistic count + GTM events) — Phase 4
// - "Try in [Provider]" icons → sessionStorage + navigate to prompt builder
// - Crossfade transition on city rotation (800ms opacity)
// - Skeleton loader (pulse animation, fixed height — no CLS)
// - Online users by country (threshold ≥50, collapsed/expanded) — Phase 6
// - All sizing via CSS clamp() (desktop-only per Promagen rules)
// - prefers-reduced-motion respected
//
// Authority: docs/authority/homepage.md §4.4, §7, §8
// Existing features preserved: Yes
// ============================================================================

'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import Image from 'next/image';
import { usePromptShowcase } from '@/hooks/use-prompt-showcase';
import { useLike, type LikeState } from '@/hooks/use-like';
import { useOnlineUsers } from '@/hooks/use-online-users';
import { Flag } from '@/components/ui/flag';
import { resolveIsNight } from '@/lib/weather/day-night';
import { getMoonPhase } from '@/lib/weather/weather-prompt-generator';
import { ProviderWeatherEmojiTooltip } from '@/components/providers/provider-weather-emoji-tooltip';
import type { PromptOfTheMoment, ProviderShortcut, OnlineCountryEntry } from '@/types/homepage';
import type { WeatherCategoryMap } from '@/types/prompt-builder';

// ============================================================================
// TIER DISPLAY CONFIG
// ============================================================================

interface TierDisplay {
  key: 'tier1' | 'tier2' | 'tier3' | 'tier4';
  label: string;
  colour: string;
  ringColour: string;
  dotColour: string;
}

const TIER_DISPLAYS: TierDisplay[] = [
  {
    key: 'tier1',
    label: 'CLIP-Based',
    colour: 'text-violet-400',
    ringColour: 'ring-violet-500/20',
    dotColour: '#8B5CF6',
  },
  {
    key: 'tier2',
    label: 'Midjourney',
    colour: 'text-blue-400',
    ringColour: 'ring-blue-500/20',
    dotColour: '#3B82F6',
  },
  {
    key: 'tier3',
    label: 'Natural Language',
    colour: 'text-emerald-400',
    ringColour: 'ring-emerald-500/20',
    dotColour: '#10B981',
  },
  {
    key: 'tier4',
    label: 'Plain Language',
    colour: 'text-amber-400',
    ringColour: 'ring-amber-500/20',
    dotColour: '#F59E0B',
  },
];

/** Default like state for prompts (used as fallback) */
const EMPTY_LIKE_STATE: LikeState = { liked: false, count: 0, isUpdating: false };

// ============================================================================
// WEATHER EMOJI (derive from conditions text — same as used in exchange cards)
// ============================================================================

function conditionsToEmoji(conditions: string): string {
  const c = conditions.toLowerCase();
  if (c.includes('thunder') || c.includes('storm')) return '⛈️';
  if (c.includes('rain') || c.includes('drizzle')) return '🌧️';
  if (c.includes('snow') || c.includes('blizzard')) return '❄️';
  if (c.includes('fog') || c.includes('mist') || c.includes('haze')) return '🌫️';
  if (c.includes('overcast')) return '☁️';
  if (c.includes('cloud')) return '⛅';
  if (c.includes('clear') || c.includes('sunny')) return '☀️';
  return '🌤️';
}

// ============================================================================
// COPY BUTTON
// ============================================================================

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may not be available
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex shrink-0 items-center justify-center rounded-md transition-all ${
        copied
          ? 'bg-emerald-500/20 text-emerald-400'
          : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
      }`}
      style={{
        width: 'clamp(24px, 1.8vw, 30px)',
        height: 'clamp(24px, 1.8vw, 30px)',
      }}
      title={copied ? 'Copied!' : 'Copy prompt'}
      aria-label={`${copied ? 'Copied' : 'Copy'} ${label} prompt`}
    >
      {copied ? (
        <svg
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
          style={{ width: 'clamp(12px, 0.9vw, 16px)', height: 'clamp(12px, 0.9vw, 16px)' }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          style={{ width: 'clamp(12px, 0.9vw, 16px)', height: 'clamp(12px, 0.9vw, 16px)' }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      )}
    </button>
  );
}

// ============================================================================
// LIKE BUTTON — Heart toggle with count (§7.8)
// ============================================================================

function LikeButton({
  likeState,
  onToggle,
  label,
}: {
  likeState: LikeState;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={likeState.isUpdating}
      className={`inline-flex shrink-0 items-center justify-center rounded-md transition-all ${
        likeState.liked ? 'text-pink-400' : 'text-slate-400 hover:text-pink-300'
      } ${likeState.isUpdating ? 'opacity-60' : ''}`}
      style={{
        gap: 'clamp(3px, 0.3vw, 5px)',
        padding: 'clamp(2px, 0.15vw, 3px) clamp(4px, 0.3vw, 6px)',
        fontSize: 'clamp(0.65rem, 0.8vw, 0.95rem)',
      }}
      title={likeState.liked ? `Unlike ${label} prompt` : `Like ${label} prompt`}
      aria-label={`${likeState.liked ? 'Unlike' : 'Like'} ${label} prompt (${likeState.count} likes)`}
    >
      {/* Heart icon — 2× size for visibility */}
      <span
        style={{
          fontSize: 'clamp(1.2rem, 1.4vw, 1.7rem)',
          transition: 'transform 200ms ease-out',
          transform: likeState.liked ? 'scale(1.2)' : 'scale(1)',
          display: 'inline-block',
        }}
        aria-hidden="true"
      >
        {likeState.liked ? '♥' : '♡'}
      </span>
      {/* Count */}
      {likeState.count > 0 && <span className="tabular-nums">{likeState.count}</span>}
    </button>
  );
}

// ============================================================================
// PROVIDER ICON — "Try in [Provider]"
// ============================================================================

function ProviderIcon({
  provider,
  promptText: _promptText,
  tierKey: _tierKey,
  tierPayload,
  inspiredBy,
}: {
  provider: ProviderShortcut;
  promptText: string;
  tierKey: string;
  tierPayload?: {
    promptText: string;
    selections: Record<string, string[]>;
    categoryMap?: WeatherCategoryMap;
  };
  inspiredBy?: {
    city: string;
    venue: string;
    conditions: string;
    emoji: string;
    tempC: number | null;
    localTime: string;
    mood: string;
    categoryMapHash?: string;
  };
}) {
  const handleClick = useCallback(() => {
    // Phase D: Store WeatherCategoryMap (preferred) + legacy payload for backward compat
    try {
      if (tierPayload) {
        sessionStorage.setItem('promagen:preloaded-payload', JSON.stringify(tierPayload));
      }
      if (inspiredBy) {
        sessionStorage.setItem('promagen:preloaded-inspiredBy', JSON.stringify(inspiredBy));
      }
    } catch {
      // sessionStorage unavailable — graceful degradation
    }
    // Navigate directly to /providers/[id] (not /prompt-builder which is deprecated)
    window.location.href = `/providers/${provider.id}`;
  }, [provider.id, tierPayload, inspiredBy]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/10 transition-all hover:bg-white/20 hover:ring-white/20"
      style={{
        width: 'clamp(26px, 2vw, 34px)',
        height: 'clamp(26px, 2vw, 34px)',
      }}
      title={`Try in ${provider.name}`}
      aria-label={`Open this prompt in ${provider.name}`}
    >
      <Image
        src={provider.iconPath}
        alt={provider.name}
        width={20}
        height={20}
        className="rounded-sm"
        style={{
          width: 'clamp(14px, 1.2vw, 20px)',
          height: 'clamp(14px, 1.2vw, 20px)',
          filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.4))',
        }}
      />
    </button>
  );
}

// ============================================================================
// TIER PANEL
// ============================================================================

function TierPanel({
  display,
  promptText,
  providers,
  likeState,
  onLike,
  tierPayload,
  inspiredBy,
}: {
  display: TierDisplay;
  promptText: string;
  providers: ProviderShortcut[];
  likeState: LikeState;
  onLike: () => void;
  tierPayload?: {
    promptText: string;
    selections: Record<string, string[]>;
    categoryMap?: WeatherCategoryMap;
  };
  inspiredBy?: {
    city: string;
    venue: string;
    conditions: string;
    emoji: string;
    tempC: number | null;
    localTime: string;
    mood: string;
    categoryMapHash?: string;
  };
}) {
  return (
    <div
      className={`flex flex-col rounded-xl bg-slate-900/60 ring-1 ${display.ringColour}`}
      style={{ padding: 'clamp(8px, 0.7vw, 12px)', gap: 'clamp(5px, 0.45vw, 8px)' }}
    >
      {/* Tier label + like + copy buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center" style={{ gap: 'clamp(4px, 0.4vw, 7px)' }}>
          <div
            className="rounded-full"
            style={{
              width: 'clamp(5px, 0.35vw, 8px)',
              height: 'clamp(5px, 0.35vw, 8px)',
              backgroundColor: display.dotColour,
            }}
            aria-hidden="true"
          />
          <span
            className={`font-semibold uppercase tracking-wider ${display.colour}`}
            style={{ fontSize: 'clamp(0.5rem, 0.6vw, 0.7rem)', letterSpacing: '0.08em' }}
          >
            {display.label} Tier {display.key.replace('tier', '')}
          </span>
        </div>
        <div className="flex items-center" style={{ gap: 'clamp(2px, 0.2vw, 4px)' }}>
          <LikeButton likeState={likeState} onToggle={onLike} label={display.label} />
          <CopyButton text={promptText} label={display.label} />
        </div>
      </div>

      {/* Prompt text */}
      <div
        className="overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10"
        style={{ maxHeight: 'clamp(55px, 5.5vw, 90px)' }}
      >
        <p
          className="font-mono leading-relaxed text-slate-300"
          style={{ fontSize: 'clamp(0.55rem, 0.68vw, 0.78rem)' }}
        >
          {promptText}
        </p>
      </div>

      {/* "Try in" provider icons — overflow-hidden hides partial icons (Engine Bay pattern) */}
      {providers.length > 0 && (
        <div
          className="flex items-center overflow-hidden"
          style={{ gap: 'clamp(4px, 0.35vw, 7px)' }}
        >
          <span
            className="shrink-0 text-slate-500"
            style={{ fontSize: 'clamp(0.45rem, 0.55vw, 0.62rem)' }}
          >
            Try in
          </span>
          <div
            className="flex flex-nowrap items-center overflow-hidden"
            style={{ gap: 'clamp(3px, 0.25vw, 5px)' }}
          >
            {providers.map((p) => (
              <ProviderIcon
                key={p.id}
                provider={p}
                promptText={promptText}
                tierKey={display.key}
                tierPayload={tierPayload}
                inspiredBy={inspiredBy}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SKELETON LOADER
// ============================================================================

function ShowcaseSkeleton() {
  return (
    <div
      className="flex flex-col rounded-3xl bg-slate-950/70 ring-1 ring-white/10"
      style={{ padding: 'clamp(12px, 1.1vw, 18px)', gap: 'clamp(8px, 0.8vw, 14px)' }}
    >
      {/* Header skeleton */}
      <div className="flex items-center" style={{ gap: 'clamp(8px, 0.7vw, 12px)' }}>
        <div
          className="animate-pulse rounded-sm bg-slate-800"
          style={{ width: 'clamp(24px, 2vw, 32px)', height: 'clamp(16px, 1.2vw, 22px)' }}
        />
        <div className="flex flex-col" style={{ gap: 'clamp(3px, 0.3vw, 6px)' }}>
          <div
            className="animate-pulse rounded bg-slate-800"
            style={{ width: 'clamp(100px, 9vw, 160px)', height: 'clamp(12px, 1vw, 18px)' }}
          />
          <div
            className="animate-pulse rounded bg-slate-800/60"
            style={{ width: 'clamp(70px, 6vw, 110px)', height: 'clamp(8px, 0.7vw, 12px)' }}
          />
        </div>
      </div>

      {/* Tier panel skeletons (2×2 grid) */}
      <div className="grid grid-cols-2" style={{ gap: 'clamp(6px, 0.5vw, 10px)' }}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl bg-slate-900/40"
            style={{ height: 'clamp(80px, 8vw, 130px)' }}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// LOCAL CLOCK — Blinking colon (matches provider-clock.tsx pattern)
// ============================================================================

function LocalClock({ time }: { time: string }) {
  const colonRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let visible = true;
    const id = setInterval(() => {
      visible = !visible;
      if (colonRef.current) colonRef.current.style.opacity = visible ? '1' : '0';
    }, 500);
    return () => clearInterval(id);
  }, []);

  const [hours, minutes] = time.split(':');
  if (!hours || !minutes) return <span>{time}</span>;

  return (
    <span className="tabular-nums">
      {hours}
      <span ref={colonRef} style={{ opacity: 1 }} aria-hidden="true">
        :
      </span>
      {minutes}
    </span>
  );
}

// ============================================================================
// COUNTDOWN TIMER — Live MM:SS until next city rotation
// ============================================================================

function CountdownTimer({ nextRotationAt }: { nextRotationAt: string }) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    const target = new Date(nextRotationAt).getTime();

    function tick() {
      const diff = Math.max(0, target - Date.now());
      const totalSec = Math.floor(diff / 1000);
      const m = Math.floor(totalSec / 60);
      const s = totalSec % 60;
      setRemaining(`${m}:${s.toString().padStart(2, '0')}`);
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextRotationAt]);

  return <span className="tabular-nums">{remaining}</span>;
}

// ============================================================================
// CITY CONTENT (rendered inside crossfade wrapper)
// ============================================================================

function CityContent({
  data,
  likeStates,
  onToggleLike,
}: {
  data: PromptOfTheMoment;
  likeStates: Map<string, LikeState>;
  onToggleLike: (promptId: string, tierKey: string) => void;
}) {
  // ── Resolve day/night + display emoji (matches provider-cell.tsx exactly) ──
  const w = data.weather;
  const isNight = w
    ? resolveIsNight(w.isDayTime, w.timezone, w.sunriseUtc, w.sunsetUtc, w.timezoneOffset)
    : false;
  const displayEmoji = w
    ? isNight
      ? getMoonPhase().emoji
      : (w.emoji ?? '🌤️')
    : conditionsToEmoji(data.conditions);

  return (
    <div className="flex flex-col" style={{ gap: 'clamp(8px, 0.7vw, 12px)' }}>
      {/* ── City Header ────────────────────────────────────────────────── */}
      <div className="flex items-center" style={{ gap: 'clamp(8px, 0.7vw, 12px)' }}>
        {/* Flag */}
        <div
          className="relative shrink-0 overflow-hidden rounded-sm shadow-sm"
          style={{
            width: 'clamp(24px, 2vw, 34px)',
            height: 'clamp(16px, 1.3vw, 24px)',
          }}
        >
          <Image
            src={`/flags/${data.countryCode.toLowerCase()}.svg`}
            alt={data.countryCode}
            fill
            className="object-cover"
          />
        </div>

        {/* City name + metadata */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center" style={{ gap: 'clamp(5px, 0.45vw, 8px)' }}>
            <h3
              className="truncate font-semibold text-white"
              style={{ fontSize: 'clamp(0.8rem, 1vw, 1.2rem)' }}
            >
              {data.city}
            </h3>
            {w ? (
              <ProviderWeatherEmojiTooltip
                city={data.city}
                tz={w.timezone}
                description={w.description}
                isNight={isNight}
                tempC={w.tempC}
                tempF={w.tempF}
                windKmh={w.windKmh}
                windDegrees={w.windDegrees}
                windGustKmh={w.windGustKmh}
                humidity={w.humidity}
                visibility={w.visibility}
                sunriseUtc={w.sunriseUtc}
                sunsetUtc={w.sunsetUtc}
                latitude={w.latitude}
                longitude={w.longitude}
                tooltipPosition="left"
              >
                <span
                  style={{ fontSize: 'clamp(0.85rem, 1vw, 1.3rem)', lineHeight: 1 }}
                  aria-label={isNight ? 'Moon phase' : 'Weather conditions'}
                >
                  {displayEmoji}
                </span>
              </ProviderWeatherEmojiTooltip>
            ) : (
              <span
                style={{ fontSize: 'clamp(0.85rem, 1vw, 1.3rem)' }}
                aria-label={data.conditions}
              >
                {displayEmoji}
              </span>
            )}
          </div>
          <p
            className="truncate text-slate-400"
            style={{ fontSize: 'clamp(0.5rem, 0.65vw, 0.75rem)' }}
          >
            <span>{data.venue}</span>
            <span className="text-slate-600"> · </span>
            <span>{data.conditions}</span>
            <span className="text-slate-600"> · </span>
            <LocalClock time={data.localTime} />
          </p>
        </div>
      </div>

      {/* ── Tier Panels (2×2 Grid) ─────────────────────────────────────── */}
      <div className="grid grid-cols-2" style={{ gap: 'clamp(6px, 0.5vw, 10px)' }}>
        {TIER_DISPLAYS.map((display) => {
          const promptId = `potm:${data.rotationIndex}:${display.key}`;
          return (
            <TierPanel
              key={display.key}
              display={display}
              promptText={data.prompts[display.key]}
              providers={data.tierProviders[display.key]}
              tierPayload={data.tierSelections?.[display.key]}
              inspiredBy={data.inspiredBy}
              likeState={likeStates.get(promptId) ?? EMPTY_LIKE_STATE}
              onLike={() => onToggleLike(promptId, display.key)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// ONLINE USERS BAR — Country flags with counts (Phase 6, §8.5)
// ============================================================================
// Only renders when total ≥ ONLINE_THRESHOLD (50).
// Collapsed: top 3 countries + expand indicator.
// Expanded: all countries inline.
// ============================================================================

/** Threshold: component hidden below this count (§8.2). */
const ONLINE_THRESHOLD = 50;

/** Max countries in collapsed view. */
const COLLAPSED_MAX = 3;

function OnlineUsersBar({ total, countries }: { total: number; countries: OnlineCountryEntry[] }) {
  const [expanded, setExpanded] = useState(false);

  // ── Threshold gate (§8.2) ─────────────────────────────────────────────
  if (total < ONLINE_THRESHOLD) return null;

  const visibleCountries = expanded ? countries : countries.slice(0, COLLAPSED_MAX);
  const remainingCount = countries.length - COLLAPSED_MAX;

  return (
    <div
      className="flex items-center"
      style={{
        gap: 'clamp(4px, 0.4vw, 8px)',
        paddingTop: 'clamp(6px, 0.5vw, 10px)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        marginTop: 'clamp(6px, 0.5vw, 10px)',
      }}
      data-testid="online-users-bar"
    >
      {/* Online dot + total */}
      <span
        className="shrink-0 text-slate-500"
        style={{ fontSize: 'clamp(0.4rem, 0.5vw, 0.6rem)' }}
      >
        <span
          className="mr-1 inline-block animate-pulse rounded-full"
          style={{
            backgroundColor: '#10B981',
            width: 'clamp(4px, 0.25vw, 6px)',
            height: 'clamp(4px, 0.25vw, 6px)',
            verticalAlign: 'middle',
          }}
          aria-hidden="true"
        />
        {total} online
      </span>

      {/* Separator */}
      <span
        className="text-slate-700"
        style={{ fontSize: 'clamp(0.35rem, 0.4vw, 0.5rem)' }}
        aria-hidden="true"
      >
        ·
      </span>

      {/* Country flags + counts */}
      <div
        className="flex flex-wrap items-center"
        style={{ gap: 'clamp(4px, 0.35vw, 6px)' }}
        aria-label={`Users online from ${countries.length} countries`}
      >
        {visibleCountries.map((entry) => (
          <span
            key={entry.countryCode}
            className="inline-flex items-center text-slate-400"
            style={{
              gap: 'clamp(1px, 0.1vw, 2px)',
              fontSize: 'clamp(0.42rem, 0.52vw, 0.62rem)',
            }}
          >
            <Flag countryCode={entry.countryCode} size={10} decorative />
            <span className="tabular-nums">{entry.count}</span>
          </span>
        ))}

        {/* Expand/collapse toggle */}
        {countries.length > COLLAPSED_MAX && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="text-slate-500 transition-colors hover:text-slate-300"
            style={{ fontSize: 'clamp(0.4rem, 0.48vw, 0.58rem)' }}
            aria-expanded={expanded}
            aria-label={expanded ? 'Show fewer countries' : `Show ${remainingCount} more countries`}
          >
            {expanded ? '▴ less' : `▾ +${remainingCount}`}
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PromptShowcase() {
  const { data, previousData, isLoading, isTransitioning, error } = usePromptShowcase();

  // ── Online users (Phase 6) ─────────────────────────────────────────────
  const { total: onlineTotal, countries: onlineCountries } = useOnlineUsers();

  // ── Like system (Phase 4) ──────────────────────────────────────────────
  // Compute deterministic prompt IDs: potm:{rotationIndex}:{tierKey}
  const promptIds = useMemo(() => {
    if (!data) return [];
    return TIER_DISPLAYS.map((d) => `potm:${data.rotationIndex}:${d.key}`);
  }, [data]);

  const { states: likeStates, toggleLike } = useLike(promptIds);

  const handleToggleLike = useCallback(
    (promptId: string, tierKey: string) => {
      toggleLike(promptId, {
        tier: tierKey,
        source: 'showcase',
      });
    },
    [toggleLike],
  );

  // Empty like props for the crossfade-out previous city (non-interactive)
  const emptyLikeStates = useMemo(() => new Map<string, LikeState>(), []);
  const noopToggle = useCallback(() => {}, []);

  // Hard error with no data at all
  if (error && !data) {
    return (
      <div
        className="flex items-center justify-center rounded-3xl bg-slate-950/70 ring-1 ring-white/10"
        style={{ padding: 'clamp(16px, 1.5vw, 24px)', minHeight: 'clamp(180px, 18vw, 300px)' }}
      >
        <p className="text-slate-500" style={{ fontSize: 'clamp(0.6rem, 0.75vw, 0.85rem)' }}>
          Prompt showcase unavailable — retrying...
        </p>
      </div>
    );
  }

  // Loading (no data yet)
  if (isLoading || !data) {
    return <ShowcaseSkeleton />;
  }

  return (
    <div
      className="flex flex-col rounded-3xl bg-slate-950/70 ring-1 ring-white/10"
      style={{ padding: 'clamp(12px, 1.1vw, 18px)' }}
      data-testid="prompt-showcase"
    >
      {/* Section header */}
      <div
        className="flex items-center"
        style={{
          gap: 'clamp(5px, 0.5vw, 8px)',
          marginBottom: 'clamp(8px, 0.7vw, 12px)',
        }}
      >
        <div
          className="animate-pulse rounded-full"
          style={{
            backgroundColor: '#F59E0B',
            width: 'clamp(6px, 0.35vw, 9px)',
            height: 'clamp(6px, 0.35vw, 9px)',
          }}
          aria-hidden="true"
        />
        <span
          className="font-mono uppercase tracking-wider text-slate-400"
          style={{ fontSize: 'clamp(0.45rem, 0.6vw, 0.7rem)' }}
        >
          PROMPT OF THE MOMENT
        </span>
        <span
          className="ml-auto italic text-amber-400/80 truncate"
          style={{ fontSize: 'clamp(0.1rem, 0.75vw, 1rem)' }}
        >
          Live weather prompt · next city in <CountdownTimer nextRotationAt={data.nextRotationAt} />
        </span>
      </div>

      {/* Crossfade container */}
      <div className="relative">
        {/* Previous city (fading out during transition) */}
        {isTransitioning && previousData && (
          <div className="showcase-fade-out absolute inset-0" aria-hidden="true">
            <CityContent
              data={previousData}
              likeStates={emptyLikeStates}
              onToggleLike={noopToggle}
            />
          </div>
        )}

        {/* Current city (fading in during transition) */}
        <div className={isTransitioning ? 'showcase-fade-in' : ''}>
          <CityContent data={data} likeStates={likeStates} onToggleLike={handleToggleLike} />
        </div>
      </div>

      {/* Online users by country (Phase 6 — threshold gated ≥50) */}
      <OnlineUsersBar total={onlineTotal} countries={onlineCountries} />

      {/* Crossfade keyframes + reduced-motion */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .showcase-fade-in {
          animation: showcaseFadeIn 800ms ease-in-out forwards;
        }
        .showcase-fade-out {
          animation: showcaseFadeOut 800ms ease-in-out forwards;
        }
        @keyframes showcaseFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes showcaseFadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .showcase-fade-in,
          .showcase-fade-out {
            animation-duration: 0ms !important;
          }
        }
      `,
        }}
      />
    </div>
  );
}
