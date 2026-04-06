// src/components/home/new-homepage-client.tsx
// ============================================================================
// NEW HOMEPAGE CLIENT — Prompt-focused layout (Phase 6 + hero cleanup)
// ============================================================================
// Replaces the original homepage-client.tsx for the `/` route.
// The original (exchange rails, finance ribbon) is now used by /world-context.
//
// Phase 1 (Foundation): Shell layout with placeholder left/right rails.
// Phase 2 (Prompt Showcase): PromptShowcase wired into centre rail above table.
// Phase 3 (Scene Starters): SceneStartersPreview replaces left rail placeholder.
// Phase 5 (Community Pulse): CommunityPulse replaces right rail placeholder.
// Hero cleanup: LeaderboardIntro moved here (between Showcase + Table).
//
// ★ SSR POTM (v2.0): Accepts initialShowcaseData from server component.
//   Threads it through to PromptShowcase as initialData prop, eliminating
//   the 2-second client-fetch waterfall on first paint.
//
// Key differences from original homepage-client.tsx:
// - No exchange rails (replaced by Scene Starters + Community Pulse)
// - No finance ribbon (showFinanceRibbon = false always)
// - No exchange filtering, ordering, or index quote fetching
// - Centre column: PromptShowcase + LeaderboardIntro + ProvidersTable
// - Left column: SceneStartersPreview (200 scenes, pro gate)
// - Engine Bay and Mission Control: preserved
//
// Authority: docs/authority/homepage.md §3, §4, §5, §6
//
// Existing features preserved: Yes
// - ProvidersTable, Engine Bay, Mission Control untouched
// - All other pages unaffected (they still import homepage-client.tsx)
// ============================================================================

'use client';

import React, { useMemo, useCallback, useState, useEffect } from 'react';
import HomepageGrid, { LeaderboardIntro } from '@/components/layout/homepage-grid';
import ProvidersTable from '@/components/providers/providers-table';
import PromptShowcase from '@/components/home/prompt-showcase';
import SceneStartersPreview from '@/components/home/scene-starters-preview';
import CommunityPulse from '@/components/home/community-pulse';
import { usePromagenAuth } from '@/hooks/use-promagen-auth';
import { useWeather, type WeatherData } from '@/hooks/use-weather';
import type { Exchange } from '@/data/exchanges/types';
import type { ExchangeWeatherData } from '@/components/exchanges/types';
import type { Provider } from '@/types/providers';
import type { SerializableProviderRating } from '@/types/index-rating';
import type { PromptOfTheMoment } from '@/types/homepage';
import { type PlatformTierId, getPlatformTierId } from '@/data/platform-tiers';
// ============================================================================
// TYPES
// ============================================================================

export interface NewHomepageClientProps {
  /** All exchanges (passed to Mission Control for weather prompt preview) */
  exchanges: ReadonlyArray<Exchange>;
  /** Weather data indexed by exchange ID (from gateway API) */
  weatherIndex: Map<string, ExchangeWeatherData>;
  /** All AI providers */
  providers: Provider[];
  /** ★ SSR-generated POTM data — renders in initial HTML, no client fetch needed */
  initialShowcaseData?: PromptOfTheMoment | null;
  /** Server-prefetched Index Ratings — eliminates client-side fetch waterfall */
  initialRatings?: Record<string, SerializableProviderRating>;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * NewHomepageClient — Client wrapper for the prompt-focused homepage.
 *
 * Handles:
 * 1. Auth state (for voting in providers table)
 * 2. Weather data merging (SSR + live, for Mission Control prompt preview)
 * 3. Provider table expand/collapse
 * 4. Left rail: Scene Starters preview (Phase 3)
 * 5. Right rail: Community Pulse live feed (Phase 5)
 * 6. Centre: PromptShowcase (Phase 2) + ProvidersTable
 */
export default function NewHomepageClient({
  exchanges,
  weatherIndex,
  providers,
  initialShowcaseData,
  initialRatings,
}: NewHomepageClientProps) {
  const { isAuthenticated, userTier, locationInfo, setReferenceFrame } = usePromagenAuth();

  // ── Live weather (client-side update after hydration) ───────────────────
  const { weather: liveWeatherById } = useWeather();

  const liveWeatherIndex = useMemo(() => {
    const map = new Map<string, ExchangeWeatherData>();
    for (const [id, w] of Object.entries(liveWeatherById)) {
      map.set(id, {
        tempC: w.temperatureC,
        tempF: w.temperatureF,
        emoji: w.emoji,
        condition: w.conditions,
        humidity: w.humidity,
        windKmh: w.windSpeedKmh,
        description: w.description,
        sunriseUtc: w.sunriseUtc ?? undefined,
        sunsetUtc: w.sunsetUtc ?? undefined,
        timezoneOffset: w.timezoneOffset ?? undefined,
        isDayTime: w.isDayTime ?? undefined,
        windDegrees: w.windDegrees ?? undefined,
        windGustKmh: w.windGustKmh ?? undefined,
        visibility: w.visibility ?? undefined,
      });
    }
    return map;
  }, [liveWeatherById]);

  // Merge live weather ON TOP of SSR weather
  const effectiveWeatherIndex = useMemo(() => {
    if (liveWeatherIndex.size === 0) return weatherIndex;
    const merged = new Map(weatherIndex);
    for (const [id, data] of liveWeatherIndex) {
      merged.set(id, data);
    }
    return merged;
  }, [liveWeatherIndex, weatherIndex]);

  // ── Provider weather map (for ProvidersTable weather tooltips) ──────────
  const providerWeatherMap = useMemo(() => {
    const map: Record<string, WeatherData> = {};
    for (const [id, w] of effectiveWeatherIndex) {
      map[id] = {
        id,
        city: id,
        temperatureC: w.tempC ?? 0,
        temperatureF: w.tempF ?? (w.tempC !== null ? (w.tempC * 9) / 5 + 32 : 32),
        conditions: w.condition ?? 'Unknown',
        description: w.description ?? w.condition ?? '',
        humidity: w.humidity ?? 50,
        windSpeedKmh: w.windKmh ?? 5,
        emoji: w.emoji ?? '🌤️',
        asOf: new Date().toISOString(),
        sunriseUtc: w.sunriseUtc ?? null,
        sunsetUtc: w.sunsetUtc ?? null,
        timezoneOffset: w.timezoneOffset ?? null,
        isDayTime: w.isDayTime ?? undefined,
        windDegrees: w.windDegrees ?? null,
        windGustKmh: w.windGustKmh ?? null,
        visibility: w.visibility ?? null,
      };
    }
    return map;
  }, [effectiveWeatherIndex]);

  // ── Table state ────────────────────────────────────────────────────────
  const [displayedProviderIds, setDisplayedProviderIds] = useState<string[]>([]);
  const [isTableExpanded, setIsTableExpanded] = useState(false);

  // ── Showcase tier state (drives leaderboard bridge) ────────────────────
  const [showcaseTierId, setShowcaseTierId] = useState<number>(1);

  // ── Tier filter state (shared between LeaderboardIntro subtitle + ProvidersTable) ──
  const [tierFilter, setTierFilter] = useState<PlatformTierId | null>(null);
  const highlightCount = useMemo(() => {
    if (!showcaseTierId) return 0;
    return providers.filter((p) => getPlatformTierId(p.id) === showcaseTierId).length;
  }, [providers, showcaseTierId]);
  const handleActivateFilter = useCallback(() => {
    setTierFilter(showcaseTierId as PlatformTierId);
  }, [showcaseTierId]);
  const handleClearFilter = useCallback(() => {
    setTierFilter(null);
  }, []);

  // ── Engine Bay ↔ Scene Starters shared provider state ──────────────────
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);

  // Restore provider selection on mount (survives page navigation)
  useEffect(() => {
    try {
      const savedId = localStorage.getItem('promagen:homepage-provider');
      if (savedId && savedId !== 'undefined' && savedId !== 'null') {
        const found = providers.find((p) => p.id === savedId);
        if (found) setSelectedProvider(found);
      }
    } catch { /* noop */ }
  }, [providers]);

  const handleProviderChange = useCallback((provider: Provider | null) => {
    setSelectedProvider(provider);
    // Persist so it survives navigation back to homepage
    try {
      if (provider?.id) {
        localStorage.setItem('promagen:homepage-provider', provider.id);
      } else {
        localStorage.removeItem('promagen:homepage-provider');
      }
    } catch { /* noop */ }
  }, []);

  /** Called when user clicks a scene with no provider — auto-opens Engine Bay dropdown */
  const handleNudgeProvider = useCallback(() => {
    const input = document.getElementById('engine-bay-provider-select') as HTMLInputElement | null;
    if (input) {
      input.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setTimeout(() => input.focus(), 150);
    }
  }, []);

  const providerIds = useMemo(() => providers.map((p) => p.id), [providers]);

  const handleProvidersChange = useCallback((ids: string[]) => {
    setDisplayedProviderIds((prev) => {
      if (prev.length === ids.length && prev.every((id, i) => id === ids[i])) return prev;
      return ids;
    });
  }, []);

  const handleExpandToggle = useCallback(() => {
    setIsTableExpanded((prev) => !prev);
  }, []);

  // ── Location loading (same pattern as original) ────────────────────────
  const effectiveLocationLoading = isAuthenticated && locationInfo.isLoading;

  // ══════════════════════════════════════════════════════════════════════════
  // UI CONTENT
  // ══════════════════════════════════════════════════════════════════════════

  // Centre rail — PromptShowcase (Phase 2) + ProvidersTable
  const centreRail = (
    <div
      className="flex flex-col md:h-full md:min-h-0"
      style={{ gap: 'clamp(12px, 1.25vw, 24px)' }}
      data-testid="rail-centre-inner"
    >
      {/* Prompt of the Moment — NOW visible on all screens (Part 2: Shop Window) */}
      {!isTableExpanded && (
        <PromptShowcase
          selectedProviderId={selectedProvider?.id}
          onTierChange={setShowcaseTierId}
          initialData={initialShowcaseData ?? undefined}
        />
      )}

      {/* ── Mobile Conversion Bridge — <768px only ────────────────────
          Sits between the showcase and leaderboard. Two paths:
          Path A: Pro page (conversion). Path B: Copy link to revisit on desktop.
          Hidden on tablet+ where the full desktop experience takes over. */}
      {!isTableExpanded && (
        <div className="md:hidden" data-testid="mobile-conversion-bridge">
          <div
            className="flex flex-col items-center rounded-2xl border border-white/[0.08] bg-slate-950/60"
            style={{ padding: 'clamp(16px, 4vw, 24px)', gap: 'clamp(12px, 3vw, 16px)' }}
          >
            <p
              className="text-center font-medium text-white"
              style={{ fontSize: 'clamp(0.85rem, 3.8vw, 1rem)', lineHeight: 1.4 }}
            >
              That prompt was built by the Promagen engine.
              <br />
              <span className="text-sky-400">40 platforms. 4 quality tiers. Zero guesswork.</span>
            </p>

            <div className="flex w-full flex-col items-stretch" style={{ gap: 'clamp(8px, 2vw, 12px)' }}>
              {/* Path A: Pro page */}
              <a
                href="/pro-promagen"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-purple-500/70 bg-gradient-to-r from-purple-600/25 to-pink-600/25 font-semibold text-purple-100 shadow-sm transition-all hover:from-purple-600/35 hover:to-pink-600/35 hover:border-purple-400 cursor-pointer"
                style={{
                  padding: 'clamp(10px, 2.5vw, 14px) clamp(16px, 4vw, 24px)',
                  fontSize: 'clamp(0.85rem, 3.5vw, 0.95rem)',
                }}
              >
                <svg
                  className="shrink-0"
                  style={{ width: 'clamp(14px, 3.5vw, 18px)', height: 'clamp(14px, 3.5vw, 18px)' }}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                See what Pro unlocks
              </a>

              {/* Path B: Desktop reminder — subtle, secondary */}
              <p
                className="text-center text-white/50"
                style={{ fontSize: 'clamp(0.7rem, 2.8vw, 0.8rem)' }}
              >
                The full builder is a desktop experience
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard intro — desktop/tablet only (expand/collapse is a desktop interaction) */}
      {!isTableExpanded && (
        <div className="hidden md:block">
          <LeaderboardIntro
            isExpanded={isTableExpanded}
            onToggle={handleExpandToggle}
            activeTierId={showcaseTierId}
            tierFilter={tierFilter}
            onClearFilter={handleClearFilter}
            highlightCount={highlightCount}
            onActivateFilter={handleActivateFilter}
          />
        </div>
      )}

      {/* AI Providers Leaderboard */}
      <section
        aria-label="AI providers leaderboard"
        className="flex flex-col bg-transparent p-0 shadow-none ring-0 md:min-h-0 md:flex-1 md:rounded-3xl md:bg-slate-950/70 md:p-4 md:shadow-sm md:ring-1 md:ring-white/10"
      >
        <ProvidersTable
          providers={providers}
          title="AI Providers Leaderboard"
          caption="Scores and trends are illustrative while external APIs are being wired."
          showRank
          isAuthenticated={isAuthenticated}
          onProvidersChange={handleProvidersChange}
          isExpanded={isTableExpanded}
          onExpandToggle={handleExpandToggle}
          weatherMap={providerWeatherMap}
          highlightTierId={showcaseTierId}
          tierFilter={tierFilter}
          initialRatings={initialRatings}
        />
      </section>
    </div>
  );

  // Left rail — Scene Starters preview (v3.0.0: exchange-card structure match)
  const leftContent = (
    <SceneStartersPreview
      userTier={userTier}
      isAuthenticated={isAuthenticated}
      selectedProvider={selectedProvider}
      onNudgeProvider={handleNudgeProvider}
    />
  );

  // Right rail — Community Pulse (Phase 5)
  const rightContent = (
    <CommunityPulse />
  );

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <HomepageGrid
      mainLabel="Promagen home"
      leftContent={leftContent}
      centre={centreRail}
      rightContent={rightContent}
      showFinanceRibbon={false}
      isTableExpanded={isTableExpanded}
      onExpandToggle={handleExpandToggle}
      exchanges={exchanges}
      displayedProviderIds={displayedProviderIds.length > 0 ? displayedProviderIds : providerIds}
      isPaidUser={userTier === 'paid'}
      isAuthenticated={isAuthenticated}
      referenceFrame={locationInfo.referenceFrame}
      onReferenceFrameChange={setReferenceFrame}
      isLocationLoading={effectiveLocationLoading}
      cityName={locationInfo.cityName}
      countryCode={locationInfo.countryCode}
      providers={providers}
      showEngineBay
      showMissionControl
      weatherIndex={effectiveWeatherIndex}
      selectedProvider={selectedProvider}
      onProviderChange={handleProviderChange}
    />
  );
}
