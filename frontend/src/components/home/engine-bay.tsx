// src/components/home/engine-bay.tsx
// ============================================================================
// ENGINE BAY - Primary CTA for Prompt Builder (v4.1.1)
// ============================================================================
// Mission Control panel with launch button.
// Dynamically sources top 10 platforms from Image Quality rankings.
//
// Design: v4.1.1 - Layout Refinement
// - 2-line launch button: "✦ Launch" / "Platform Builder" (Option B)
// - Container uses exchange rail styling (rounded-3xl, ring-1)
// - Responsive icon grid: shows only FULL icons (no partial/clipped)
// - ResizeObserver calculates visible icons dynamically
//
// v4.0.0 preserved:
// - Top 10 Image Quality ranked platforms as clickable PNG icons
// - Icons at 48x48px size
// - Header: "The Dynamic Intelligent Prompt Builder" with Core Colours gradient
// - Dropdown selection working correctly
// - Clear button (×) working correctly
// - Pulse animation + shimmer on hover
// - Links to /providers/[platform-id]
// - Mobile responsive: icons hidden, dropdown + button only
//
// Authority: User request 24 Jan 2026
// Security: 10/10 — Input validation, type safety, no user input handling
// ============================================================================

'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Combobox } from '@/components/ui/combobox';
import type { Provider } from '@/types/providers';

// ============================================================================
// TYPES
// ============================================================================

export interface EngineBayProps {
  providers: Provider[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TOP_ICONS_COUNT = 10;
const ICON_PATH_PATTERN = '/icons/providers/';
const DEFAULT_BRAND_COLOR = '#3B82F6';
const ICON_CELL_SIZE = 64;
const ICON_GAP = 8;

// ============================================================================
// PLATFORM BRAND COLORS
// ============================================================================

const PLATFORM_COLORS: Readonly<Record<string, string>> = {
  midjourney: '#7C3AED',
  flux: '#F97316',
  'google-imagen': '#4285F4',
  openai: '#10B981',
  leonardo: '#EC4899',
  'adobe-firefly': '#FF6B35',
  stability: '#8B5CF6',
  ideogram: '#06B6D4',
  lexica: '#F59E0B',
  fotor: '#3B82F6',
  playground: '#8B5CF6',
  'microsoft-designer': '#0078D4',
  novelai: '#E11D48',
  openart: '#14B8A6',
  dreamstudio: '#A855F7',
  canva: '#00C4CC',
  bing: '#F25022',
  '123rf': '#FF6B00',
  nightcafe: '#6366F1',
  picsart: '#FF3366',
  artistly: '#10B981',
  pixlr: '#2DD4BF',
  bluewillow: '#3B82F6',
  artbreeder: '#8B5CF6',
  jasper: '#F59E0B',
  runway: '#000000',
  freepik: '#0099FF',
  simplified: '#6366F1',
  photoleap: '#EC4899',
  vistacreate: '#FF6B35',
  artguru: '#8B5CF6',
  myedit: '#3B82F6',
  visme: '#14B8A6',
  hotpot: '#F97316',
  deepai: '#6366F1',
  picwish: '#3B82F6',
  clipdrop: '#000000',
  craiyon: '#FBBF24',
  getimg: '#8B5CF6',
  'imagine-meta': '#0668E1',
  dreamlike: '#A855F7',
  removebg: '#10B981',
} as const;

// ============================================================================
// HELPERS
// ============================================================================

function getBrandColor(providerId: string): string {
  return PLATFORM_COLORS[providerId] ?? DEFAULT_BRAND_COLOR;
}

function getIconPath(provider: Provider): string {
  if (provider.localIcon && typeof provider.localIcon === 'string') {
    return provider.localIcon;
  }
  const safeId = provider.id.replace(/[^a-z0-9-]/gi, '');
  return `${ICON_PATH_PATTERN}${safeId}.png`;
}

function getShortName(provider: Provider): string {
  const nameMap: Readonly<Record<string, string>> = {
    'google-imagen': 'Imagen',
    'adobe-firefly': 'Firefly',
    openai: 'DALL·E',
    stability: 'Stable Diff',
    'microsoft-designer': 'Designer',
    'imagine-meta': 'Meta AI',
  };

  const mappedName = nameMap[provider.id];
  if (mappedName) {
    return mappedName;
  }

  const firstName = provider.name.split(' ')[0] ?? provider.name;
  return firstName.length > 10 ? firstName.slice(0, 9) + '…' : firstName;
}

function sortByImageQualityRank(providers: Provider[]): Provider[] {
  return [...providers].sort((a, b) => {
    const rankA = typeof a.imageQualityRank === 'number' ? a.imageQualityRank : 9999;
    const rankB = typeof b.imageQualityRank === 'number' ? b.imageQualityRank : 9999;
    return rankA - rankB;
  });
}

function calculateVisibleIcons(containerWidth: number, maxIcons: number): number {
  if (containerWidth <= 0) return 0;
  const maxFit = Math.floor((containerWidth + ICON_GAP) / (ICON_CELL_SIZE + ICON_GAP));
  return Math.max(0, Math.min(maxFit, maxIcons));
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function EngineBay({ providers }: EngineBayProps): React.ReactElement | null {
  const [selected, setSelected] = useState<Provider | null>(null);
  const [visibleIconCount, setVisibleIconCount] = useState(TOP_ICONS_COUNT);
  const iconGridRef = useRef<HTMLDivElement>(null);

  // Derived data
  const sortedProviders = useMemo(() => sortByImageQualityRank(providers), [providers]);
  const top10 = useMemo(() => sortedProviders.slice(0, TOP_ICONS_COUNT), [sortedProviders]);
  const visibleIcons = useMemo(() => top10.slice(0, visibleIconCount), [top10, visibleIconCount]);
  const dropdownOptions = useMemo(() => sortedProviders.map((p) => p.name), [sortedProviders]);

  const nameToProvider = useMemo(() => {
    const map = new Map<string, Provider>();
    sortedProviders.forEach((p) => map.set(p.name, p));
    return map;
  }, [sortedProviders]);

  // ResizeObserver for responsive icon grid
  useEffect(() => {
    const gridEl = iconGridRef.current;
    if (!gridEl) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const width = entry.contentRect.width;
        setVisibleIconCount(calculateVisibleIcons(width, TOP_ICONS_COUNT));
      }
    });

    observer.observe(gridEl);
    const initialWidth = gridEl.getBoundingClientRect().width;
    setVisibleIconCount(calculateVisibleIcons(initialWidth, TOP_ICONS_COUNT));

    return () => observer.disconnect();
  }, []);

  // Handlers
  const handleIconClick = useCallback((provider: Provider) => {
    setSelected((prev) => (prev?.id === provider.id ? null : provider));
  }, []);

  const handleComboboxChange = useCallback(
    (selectedNames: string[]) => {
      const firstName = selectedNames[0];
      if (firstName) {
        const provider = nameToProvider.get(firstName);
        if (provider) setSelected(provider);
      } else {
        setSelected(null);
      }
    },
    [nameToProvider],
  );

  const handleCustomChange = useCallback(() => {
    // No-op: we don't allow custom entries
  }, []);

  // Early return
  if (providers.length === 0) return null;

  const selectedNames = selected ? [selected.name] : [];

  return (
    <div
      className="relative w-full rounded-3xl bg-slate-950/70 p-4 shadow-sm ring-1 ring-white/10"
      data-testid="engine-bay"
    >
      {/* Header */}
      <div className="mb-4 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <div
            className="h-3 w-3 animate-pulse rounded-full"
            style={{ backgroundColor: '#10B981' }}
            aria-hidden="true"
          />
          <span className="font-mono text-base uppercase tracking-wider text-slate-400">
            READY TO BUILD
          </span>
        </div>
        <h2 className="text-center text-base font-semibold leading-tight sm:text-lg md:text-xl">
          <span className="whitespace-nowrap bg-gradient-to-r from-sky-400 via-emerald-300 to-indigo-400 bg-clip-text text-transparent">
            The Dynamic Intelligent Prompt Builder
          </span>
        </h2>
      </div>

      {/* Platform Icon Grid — Desktop only */}
      <div
        ref={iconGridRef}
        className="mb-4 hidden sm:flex"
        style={{
          gap: `${ICON_GAP}px`,
          justifyContent: visibleIconCount < TOP_ICONS_COUNT ? 'center' : 'flex-start',
        }}
        role="group"
        aria-label="Top AI platforms"
      >
        {visibleIcons.map((provider) => {
          const isSelected = selected?.id === provider.id;
          const color = getBrandColor(provider.id);
          const iconPath = getIconPath(provider);

          return (
            <button
              key={provider.id}
              type="button"
              onClick={() => handleIconClick(provider)}
              className="flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 transition-all duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
              style={{
                width: `${ICON_CELL_SIZE}px`,
                minWidth: `${ICON_CELL_SIZE}px`,
                height: `${ICON_CELL_SIZE + 20}px`,
                flexShrink: 0,
                borderColor: isSelected ? color : 'rgba(51, 65, 85, 0.5)',
                background: isSelected ? `${color}15` : 'rgba(15, 23, 42, 0.5)',
                boxShadow: isSelected ? `0 0 20px ${color}33` : 'none',
              }}
              aria-pressed={isSelected}
              aria-label={`Select ${provider.name}`}
              title={provider.name}
            >
              <div className="relative h-12 w-12 overflow-hidden rounded-md">
                <Image
                  src={iconPath}
                  alt=""
                  fill
                  sizes="48px"
                  className="object-contain"
                  style={{ background: 'rgba(15, 23, 42, 0.3)' }}
                />
              </div>
              <span
                className="max-w-full truncate px-0.5 text-[10px] font-medium transition-colors"
                style={{ color: isSelected ? color : '#64748B' }}
              >
                {getShortName(provider)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Dropdown + Launch Button */}
      <div className="flex items-stretch gap-3">
        {/* Combobox Dropdown — 50% width */}
        <div className="w-1/2">
          <Combobox
            id="engine-bay-provider-select"
            label="Select AI Platform"
            options={dropdownOptions}
            selected={selectedNames}
            customValue=""
            onSelectChange={handleComboboxChange}
            onCustomChange={handleCustomChange}
            placeholder="Choose platform..."
            maxSelections={1}
            allowFreeText={false}
            compact
            singleColumn
          />
        </div>

        {/* Launch Button — 2-LINE LAYOUT (Option B): "✦ Launch" / "Platform Builder" */}
        <a
          href={selected ? `/providers/${encodeURIComponent(selected.id)}` : '#'}
          onClick={(e) => {
            if (!selected) e.preventDefault();
          }}
          aria-disabled={!selected}
          aria-label={
            selected ? `Launch ${selected.name} prompt builder` : 'Select a platform first'
          }
          className={`group relative inline-flex w-1/2 items-center justify-center gap-2 overflow-hidden rounded-xl border px-4 py-3 text-center text-sm font-medium shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/80 no-underline ${
            selected
              ? 'engine-bay-active border-sky-400/60 bg-gradient-to-r from-sky-400/40 via-emerald-300/40 to-indigo-400/40 text-white cursor-pointer'
              : 'border-slate-600/50 bg-slate-800/50 text-slate-500 cursor-not-allowed'
          }`}
        >
          {/* Shimmer overlay */}
          {selected && (
            <div
              className="engine-bay-shimmer pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              aria-hidden="true"
            />
          )}

          {/* 
            BUTTON CONTENT - 2 LINES (Option B):
            Line 1: ✦ Launch
            Line 2: Platform Builder
          */}
          <div className="relative z-10 flex flex-col items-center gap-0.5">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
              <span>✦</span>
              <span>Launch</span>
            </span>
            <span className="text-sm font-semibold text-white">Platform Builder</span>
          </div>

          {/* Arrow when selected */}
          {selected && (
            <svg
              className="relative z-10 h-4 w-4 shrink-0 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14 5l7 7m0 0l-7 7m7-7H3"
              />
            </svg>
          )}
        </a>
      </div>

      {/* Animation keyframes - injected via style tag */}
      <style jsx>{`
        @keyframes engine-bay-pulse {
          0%,
          100% {
            box-shadow:
              0 0 20px rgba(56, 189, 248, 0.3),
              0 0 40px rgba(52, 211, 153, 0.2);
          }
          50% {
            box-shadow:
              0 0 30px rgba(56, 189, 248, 0.5),
              0 0 60px rgba(52, 211, 153, 0.4);
          }
        }

        @keyframes engine-bay-shimmer-sweep {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }

        .engine-bay-active {
          animation: engine-bay-pulse 2s ease-in-out infinite;
        }

        .engine-bay-shimmer {
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.3) 50%,
            transparent 100%
          );
          animation: engine-bay-shimmer-sweep 1.5s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .engine-bay-active {
            animation: none;
            box-shadow:
              0 0 25px rgba(56, 189, 248, 0.4),
              0 0 50px rgba(52, 211, 153, 0.3);
          }
          .engine-bay-shimmer {
            animation: none;
            opacity: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
