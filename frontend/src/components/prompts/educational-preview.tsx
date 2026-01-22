// src/components/prompts/educational-preview.tsx
// ============================================================================
// EDUCATIONAL PREVIEW v1.0.0 — Playground Empty State
// ============================================================================
// Replaces the basic EmptyState with an educational experience.
// Shows quick tips, prompt anatomy, and encourages provider selection.
//
// Features:
// - Rotating quick tips (auto-cycle every 5s)
// - Prompt anatomy breakdown with interactive example
// - Platform tier overview cards
// - Prominent CTA to select a provider
// - Links to Learn page for deeper education
//
// Authority: docs/authority/prompt-intelligence.md §9
// ============================================================================

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Combobox } from '@/components/ui/combobox';
import type { Provider } from '@/types/providers';

// ============================================================================
// TYPES
// ============================================================================

export interface EducationalPreviewProps {
  providers: Provider[];
  onSelectProvider: (providerId: string) => void;
}

// ============================================================================
// EDUCATIONAL CONTENT
// ============================================================================

/** Quick tips that rotate in the hero section */
const QUICK_TIPS = [
  {
    icon: '💡',
    title: 'Front-load Keywords',
    content: 'Put your most important words at the start. AI models weight early words more heavily.',
  },
  {
    icon: '🎯',
    title: 'Be Specific',
    content: '"Beautiful landscape" is vague. "Snow-capped mountains at golden hour" is specific.',
  },
  {
    icon: '🎨',
    title: 'Use Style References',
    content: 'Reference artists or styles: "In the style of Studio Ghibli" or "Monet-inspired".',
  },
  {
    icon: '⚡',
    title: 'Stack Quality Terms',
    content: 'Terms like "8K, highly detailed, professional" can boost output quality.',
  },
  {
    icon: '⚠️',
    title: 'Avoid Contradictions',
    content: 'Don\'t combine conflicting styles. "Minimalist, cluttered" sends mixed signals.',
  },
  {
    icon: '🔄',
    title: 'Test Variations',
    content: 'Generate multiple versions with slight variations for dramatically different results.',
  },
];

/** Example prompt breakdown for anatomy section */
const EXAMPLE_PROMPT = {
  full: 'A cyberpunk hacker, typing on holographic keyboard, neon-lit alley, rain-soaked, cinematic lighting, 8K',
  parts: [
    { label: 'Subject', text: 'A cyberpunk hacker', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
    { label: 'Action', text: 'typing on holographic keyboard', color: 'text-sky-400', bg: 'bg-sky-500/20' },
    { label: 'Environment', text: 'neon-lit alley, rain-soaked', color: 'text-purple-400', bg: 'bg-purple-500/20' },
    { label: 'Lighting', text: 'cinematic lighting', color: 'text-amber-400', bg: 'bg-amber-500/20' },
    { label: 'Quality', text: '8K', color: 'text-pink-400', bg: 'bg-pink-500/20' },
  ],
};

/** Platform tier cards */
const PLATFORM_TIERS = [
  {
    tier: 1,
    name: 'CLIP-Based',
    description: 'Keyword-focused prompts with comma separation',
    examples: ['Stable Diffusion', 'Leonardo', 'NightCafe'],
    color: 'border-emerald-500/50',
    bg: 'bg-emerald-500/10',
  },
  {
    tier: 2,
    name: 'Midjourney Family',
    description: 'Natural language with --parameters',
    examples: ['Midjourney', 'BlueWillow', 'Niji'],
    color: 'border-purple-500/50',
    bg: 'bg-purple-500/10',
  },
  {
    tier: 3,
    name: 'Natural Language',
    description: 'Conversational descriptions work best',
    examples: ['DALL·E', 'Firefly', 'Ideogram'],
    color: 'border-sky-500/50',
    bg: 'bg-sky-500/10',
  },
  {
    tier: 4,
    name: 'Simple/Free',
    description: 'Keep it short and sweet',
    examples: ['Canva', 'Craiyon', 'Bing'],
    color: 'border-amber-500/50',
    bg: 'bg-amber-500/10',
  },
];

// ============================================================================
// PROVIDER SELECTOR (Inline)
// ============================================================================

interface ProviderSelectorProps {
  providers: Provider[];
  selectedId: string | null;
  onSelect: (providerId: string) => void;
}

function ProviderSelector({ providers, selectedId, onSelect }: ProviderSelectorProps) {
  const nameToId = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const p of providers) {
      map.set(p.name, p.id);
    }
    return map;
  }, [providers]);

  const idToName = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const p of providers) {
      map.set(p.id, p.name);
    }
    return map;
  }, [providers]);

  const options = React.useMemo(() => {
    return providers
      .map((p) => p.name)
      .sort((a, b) => {
        const aNum = /^\d/.test(a);
        const bNum = /^\d/.test(b);
        if (aNum && !bNum) return 1;
        if (!aNum && bNum) return -1;
        return a.localeCompare(b);
      });
  }, [providers]);

  const selected = React.useMemo(() => {
    if (!selectedId) return [];
    const name = idToName.get(selectedId);
    return name ? [name] : [];
  }, [selectedId, idToName]);

  const handleSelectChange = useCallback(
    (selectedNames: string[]) => {
      const name = selectedNames[0];
      if (name === undefined) return;
      const id = nameToId.get(name);
      if (id !== undefined) {
        onSelect(id);
      }
    },
    [nameToId, onSelect]
  );

  const handleCustomChange = useCallback(() => {}, []);

  return (
    <div className="w-[220px]">
      <Combobox
        id="playground-provider-selector"
        label="AI Provider"
        options={options}
        selected={selected}
        customValue=""
        onSelectChange={handleSelectChange}
        onCustomChange={handleCustomChange}
        placeholder="Select AI Provider..."
        maxSelections={1}
        allowFreeText={false}
        isLocked={false}
        compact
        singleColumn
      />
    </div>
  );
}

// ============================================================================
// QUICK TIP ROTATOR
// ============================================================================

function QuickTipRotator() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % QUICK_TIPS.length);
        setIsAnimating(false);
      }, 200);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const tip = QUICK_TIPS[currentIndex];
  if (!tip) return null;

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{tip.icon}</span>
        <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
          Quick Tip {currentIndex + 1}/{QUICK_TIPS.length}
        </span>
      </div>
      <div
        className={`transition-opacity duration-200 ${isAnimating ? 'opacity-0' : 'opacity-100'}`}
      >
        <h4 className="font-semibold text-slate-100 mb-1">{tip.title}</h4>
        <p className="text-sm text-slate-400">{tip.content}</p>
      </div>
      {/* Dots indicator */}
      <div className="flex justify-center gap-1 mt-3">
        {QUICK_TIPS.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentIndex(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === currentIndex
                ? 'w-4 bg-emerald-400'
                : 'w-1.5 bg-slate-600 hover:bg-slate-500'
            }`}
            aria-label={`Go to tip ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// PROMPT ANATOMY BREAKDOWN
// ============================================================================

function PromptAnatomySection() {
  const [hoveredPart, setHoveredPart] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <svg
          className="h-5 w-5 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
          />
        </svg>
        <h3 className="text-sm font-semibold text-slate-200">Anatomy of a Prompt</h3>
      </div>

      {/* Interactive prompt display */}
      <div className="rounded-lg border border-slate-700/50 bg-slate-900/50 p-3">
        <p className="text-sm leading-relaxed">
          {EXAMPLE_PROMPT.parts.map((part, i) => (
            <span
              key={i}
              className={`inline cursor-default transition-colors ${
                hoveredPart === i ? part.color : 'text-slate-300'
              }`}
              onMouseEnter={() => setHoveredPart(i)}
              onMouseLeave={() => setHoveredPart(null)}
            >
              {part.text}
              {i < EXAMPLE_PROMPT.parts.length - 1 && ', '}
            </span>
          ))}
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {EXAMPLE_PROMPT.parts.map((part, i) => (
          <button
            key={i}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all ${part.bg} ${
              hoveredPart === i
                ? `${part.color} ring-1 ring-current`
                : 'text-slate-400'
            }`}
            onMouseEnter={() => setHoveredPart(i)}
            onMouseLeave={() => setHoveredPart(null)}
          >
            {part.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// PLATFORM TIER CARDS
// ============================================================================

function PlatformTierCards() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Platform Tiers</h3>
        <Link
          href="/studio/learn"
          className="text-xs text-slate-500 hover:text-emerald-400 transition-colors"
        >
          Learn more →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {PLATFORM_TIERS.map((tier) => (
          <div
            key={tier.tier}
            className={`rounded-lg border ${tier.color} ${tier.bg} p-3`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-slate-300">T{tier.tier}</span>
              <span className="text-xs font-medium text-slate-200">{tier.name}</span>
            </div>
            <p className="text-[10px] text-slate-400 mb-2 line-clamp-2">
              {tier.description}
            </p>
            <div className="flex flex-wrap gap-1">
              {tier.examples.slice(0, 2).map((ex) => (
                <span
                  key={ex}
                  className="rounded bg-slate-800/50 px-1.5 py-0.5 text-[9px] text-slate-500"
                >
                  {ex}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// FEATURED PROVIDERS (Quick Select)
// ============================================================================

interface FeaturedProvidersProps {
  providers: Provider[];
  onSelect: (providerId: string) => void;
}

function FeaturedProviders({ providers, onSelect }: FeaturedProvidersProps) {
  const featuredProviders = React.useMemo(() => {
    // Featured provider IDs (popular ones)
    const featuredIds = ['midjourney', 'openai', 'stability', 'leonardo', 'ideogram', 'firefly'];
    
    return featuredIds
      .map((id) => providers.find((p) => p.id === id))
      .filter((p): p is Provider => p !== undefined)
      .slice(0, 6);
  }, [providers]);

  if (featuredProviders.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-200">Quick Start</h3>
      <div className="flex flex-wrap gap-2">
        {featuredProviders.map((provider) => (
          <button
            key={provider.id}
            onClick={() => onSelect(provider.id)}
            className="group flex items-center gap-2 rounded-full border border-slate-700/50 bg-slate-800/30 px-3 py-1.5 text-sm transition-all hover:border-emerald-500/50 hover:bg-emerald-500/10"
          >
            <span className="text-slate-300 group-hover:text-emerald-300">
              {provider.name}
            </span>
            <svg
              className="h-3 w-3 text-slate-500 group-hover:text-emerald-400 transition-transform group-hover:translate-x-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function EducationalPreview({
  providers,
  onSelectProvider,
}: EducationalPreviewProps) {
  return (
    <section
      className="flex h-full min-h-0 flex-col rounded-3xl bg-slate-950/70 shadow-sm ring-1 ring-white/10"
      aria-label="Prompt Playground - Learn & Select a Provider"
    >
      {/* Header matching PromptBuilder style */}
      <header className="shrink-0 border-b border-slate-800/50 p-4 md:px-6 md:pt-5">
        <div className="flex items-center gap-3">
          <ProviderSelector
            providers={providers}
            selectedId={null}
            onSelect={onSelectProvider}
          />
          <span className="text-sm text-slate-400">· Prompt builder</span>
        </div>
      </header>

      {/* Scrollable Educational Content */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Hero section with sparkle icon */}
          <div className="text-center space-y-3">
            <div className="inline-flex rounded-full bg-gradient-to-br from-emerald-500/20 to-purple-500/20 p-4">
              <svg
                className="h-10 w-10 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-50">
              Build Perfect AI Prompts
            </h2>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Select an AI provider above to start building. Your prompt automatically 
              adapts to each platform&apos;s optimal format.
            </p>
          </div>

          {/* Featured Providers - Quick Select */}
          <FeaturedProviders providers={providers} onSelect={onSelectProvider} />

          {/* Two-column layout for tips and anatomy */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Quick Tips */}
            <QuickTipRotator />

            {/* Prompt Anatomy */}
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
              <PromptAnatomySection />
            </div>
          </div>

          {/* Platform Tiers */}
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
            <PlatformTierCards />
          </div>

          {/* Learn More CTA */}
          <div className="flex items-center justify-center gap-4 pt-2">
            <Link
              href="/studio/learn"
              className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-emerald-400 transition-colors"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
                />
              </svg>
              Learn prompting fundamentals
            </Link>
            <span className="text-slate-700">·</span>
            <Link
              href="/studio/explore"
              className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-purple-400 transition-colors"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                />
              </svg>
              Explore style families
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
