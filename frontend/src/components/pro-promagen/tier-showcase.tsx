// src/components/pro-promagen/tier-showcase.tsx
// ============================================================================
// TIER SHOWCASE — Auto-Cycling Prompt Animation
// ============================================================================
// Shows a real prompt morphing between 4 tiers every 4 seconds.
// Human Factor: Curiosity Gap — users see the prompt literally change shape.
// Human Factor: Social Proof — counter shows scale of prompt generation.
//
// Authority: docs/authority/human-factors.md
// Existing features preserved: Yes
// ============================================================================

'use client';

import React, { useState, useEffect, useCallback } from 'react';

// ============================================================================
// TIER DATA — Representative prompts for London weather
// ============================================================================

const TIER_META: Record<number, { label: string; color: string; dot: string; platforms: string }> = {
  1: { label: 'CLIP-Based', color: '#60a5fa', dot: 'bg-blue-400', platforms: 'Stability · Leonardo · ComfyUI' },
  2: { label: 'Midjourney', color: '#c084fc', dot: 'bg-purple-400', platforms: 'Midjourney · BlueWillow' },
  3: { label: 'Natural Language', color: '#34d399', dot: 'bg-emerald-400', platforms: 'DALL·E · Imagen · Firefly' },
  4: { label: 'Plain Language', color: '#fb923c', dot: 'bg-orange-400', platforms: 'Canva · Craiyon · Picsart' },
};

/** Curated prompts showing the same London scene in 4 different formats */
const SHOWCASE_PROMPTS: Record<number, string> = {
  1: '(masterpiece:1.3), (professional photography:1.2), Tower Bridge at golden hour, warm amber light reflecting on Thames water, (scattered clouds:1.1), gentle breeze, cobblestone texture, sharp focus, high resolution, 50mm lens, shallow depth of field --neg blur, watermark, text',
  2: 'Tower Bridge London at golden hour, warm amber light on the Thames, scattered clouds catching sunset colour, cobblestone foreground texture, professional photography --ar 16:9 --v 7 --s 500 --no blur, watermark',
  3: 'A professional photograph of Tower Bridge in London during golden hour, with warm amber light reflecting off the Thames. Scattered clouds catch the sunset colours above while cobblestones line the riverbank foreground. Shot with natural depth of field on a 50mm lens.',
  4: 'Tower Bridge London, golden hour, warm light, Thames river, scattered clouds, cobblestones, professional photography',
};

const CYCLE_MS = 4000;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function TierShowcase() {
  const [activeTier, setActiveTier] = useState<number>(3);
  const [isPaused, setIsPaused] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Auto-cycle through tiers
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setActiveTier((prev) => (prev % 4) + 1);
        setIsTransitioning(false);
      }, 300);
    }, CYCLE_MS);

    return () => clearInterval(interval);
  }, [isPaused]);

  const handleTierClick = useCallback((tier: number) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setActiveTier(tier);
      setIsTransitioning(false);
      setIsPaused(true);
      // Resume after 8 seconds of inactivity
      setTimeout(() => setIsPaused(false), 8000);
    }, 200);
  }, []);

  const meta = TIER_META[activeTier]!;
  const prompt = SHOWCASE_PROMPTS[activeTier]!;

  return (
    <div
      className="mb-4 rounded-xl ring-1 ring-white/[0.08] overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes showcase-fade {
          0% { opacity: 0.3; transform: translateY(4px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .showcase-enter { animation: showcase-fade 0.4s ease-out forwards; }
        .showcase-exit { opacity: 0.3; transform: translateY(-4px); transition: all 0.3s ease-in; }
        @keyframes tier-pulse { 0%,100% { box-shadow: 0 0 0 0 var(--pulse-color); } 50% { box-shadow: 0 0 12px 2px var(--pulse-color); } }
        .tier-dot-active { animation: tier-pulse 2s ease-in-out infinite; }
      ` }} />

      {/* Header */}
      <div
        className="px-4 py-2.5 flex items-center justify-between"
        style={{ background: `linear-gradient(135deg, ${meta.color}12, transparent 60%)` }}
      >
        <span
          className="text-xs font-semibold text-white/70"
          style={{ fontSize: 'clamp(0.6rem, 0.8vw, 0.75rem)' }}
        >
          Same scene — 4 formats
        </span>
        <span
          className="text-xs text-white/40 tabular-nums"
          style={{ fontSize: 'clamp(0.55rem, 0.7vw, 0.65rem)' }}
        >
          42 platforms × 93 cities × 4 tiers
        </span>
      </div>

      {/* Tier selector dots */}
      <div className="flex items-center gap-2 px-4 py-2">
        {[1, 2, 3, 4].map((t) => {
          const m = TIER_META[t]!;
          const isActive = t === activeTier;
          return (
            <button
              key={t}
              type="button"
              onClick={() => handleTierClick(t)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full cursor-pointer transition-all duration-300 ${
                isActive
                  ? 'bg-white/10 ring-1 ring-white/20'
                  : 'bg-white/[0.03] hover:bg-white/[0.06]'
              }`}
              style={isActive ? { '--pulse-color': `${m.color}40` } as React.CSSProperties : undefined}
            >
              <span
                className={`w-2 h-2 rounded-full ${m.dot} ${isActive ? 'tier-dot-active' : ''}`}
                style={isActive ? { '--pulse-color': `${m.color}40` } as React.CSSProperties : undefined}
              />
              <span
                className={`text-xs font-medium ${isActive ? 'text-white' : 'text-white/40'}`}
                style={{ fontSize: 'clamp(0.55rem, 0.7vw, 0.65rem)', color: isActive ? m.color : undefined }}
              >
                T{t}
              </span>
            </button>
          );
        })}
      </div>

      {/* Prompt display */}
      <div className="px-4 pb-3">
        <div className="rounded-lg bg-white/[0.03] px-3.5 py-3 ring-1 ring-white/[0.06]">
          {/* Tier label */}
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`w-2 h-2 rounded-full ${meta.dot}`}
            />
            <span
              className="text-xs font-semibold"
              style={{ color: meta.color, fontSize: 'clamp(0.6rem, 0.75vw, 0.7rem)' }}
            >
              Tier {activeTier}: {meta.label}
            </span>
            <span
              className="text-xs text-white/30"
              style={{ fontSize: 'clamp(0.5rem, 0.65vw, 0.6rem)' }}
            >
              {meta.platforms}
            </span>
          </div>

          {/* Prompt text with transition */}
          <p
            className={`text-xs leading-relaxed text-white/70 ${isTransitioning ? 'showcase-exit' : 'showcase-enter'}`}
            style={{ fontSize: 'clamp(0.6rem, 0.75vw, 0.7rem)', minHeight: 'clamp(50px, 5vw, 80px)' }}
          >
            {prompt}
          </p>
        </div>
      </div>
    </div>
  );
}

export default TierShowcase;
