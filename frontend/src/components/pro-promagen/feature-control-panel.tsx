// src/components/pro-promagen/feature-control-panel.tsx
// ============================================================================
// FEATURE CONTROL PANEL v2.0.0 — Pro Promagen Purchase/Config Page
// ============================================================================
// 3×3 grid of exchange-card-style feature cards.
// Each card: unique glow colour, hover effect, live data where relevant.
//
// v2.0.0 (15 Mar 2026):
// - REVERT to natural-height approach: cards size themselves based on content.
//   Parent wrapper uses shrink-0, preview panel takes flex-1.
// - REMOVED all cqh units and container queries — back to vw-based clamp()
// - 2 rows per card: Row 1 (emoji + label + stat), Row 2 (free value + pro value)
// - Row 3 (action label) removed per instruction
// - Free value text: WHITE (text-white) — no grey, no opacity, no slate
// - Pro value text: card's own bright colour
// - ZERO banned colours: no text-slate-500, no text-slate-600, no text-white/40
//
// Code Standard Compliance:
// - All clamp() sizing (§6.0), min 10px text (§6.0.1)
// - No text-slate-500/600 (§6.0.2), no opacity dimming (§6.0.3)
// - cursor-pointer on clickable, default on info-only
// - Animations co-located in style block
//
// Authority: docs/authority/paid_tier.md, docs/authority/code-standard.md
// Existing features preserved: Yes
// ============================================================================

'use client';

import React, { useState, useCallback } from 'react';
import { usePromagenAuth } from '@/hooks/use-promagen-auth';
import { useSavedPrompts } from '@/hooks/use-saved-prompts';
import type { PromptTier } from '@/lib/weather/weather-prompt-generator';

// ============================================================================
// HELPERS
// ============================================================================

function hexToRgba(hex: string, alpha: number): string {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(56, 189, 248, ${alpha})`;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ============================================================================
// TIER LABELS
// ============================================================================

const TIER_LABELS: Record<number, { short: string; color: string }> = {
  1: { short: 'T1 · CLIP', color: '#60a5fa' },
  2: { short: 'T2 · MJ', color: '#c084fc' },
  3: { short: 'T3 · Natural', color: '#34d399' },
  4: { short: 'T4 · Plain', color: '#fb923c' },
};

// ============================================================================
// FEATURE CARD
// ============================================================================

interface FeatureCardProps {
  emoji: string;
  label: string;
  color: string;
  freeValue: string;
  proValue: string;
  actionLabel: string;
  onAction?: () => void;
  isPro: boolean;
  children?: React.ReactNode;
  stat?: string;
  onHoverChange?: (hovering: boolean) => void;
  actionAlwaysColored?: boolean;
}

function FeatureCard({
  emoji,
  label,
  color,
  freeValue,
  proValue,
  actionLabel: _actionLabel,
  onAction,
  isPro,
  children,
  stat,
  onHoverChange,
  actionAlwaysColored: _actionAlwaysColored,
}: FeatureCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const hasAction = typeof onAction === 'function';

  const glowRgba = hexToRgba(color, 0.3);
  const glowBorder = hexToRgba(color, 0.5);
  const glowSoft = hexToRgba(color, 0.15);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (hasAction && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        onAction!();
      }
    },
    [hasAction, onAction],
  );

  return (
    <div
      role={hasAction ? 'button' : undefined}
      tabIndex={hasAction ? 0 : undefined}
      className={`relative flex flex-col rounded-lg overflow-hidden ${hasAction ? 'cursor-pointer' : ''}`}
      style={{
        background: 'rgba(255, 255, 255, 0.05)',
        border: `1px solid ${isHovered ? glowBorder : 'rgba(255, 255, 255, 0.1)'}`,
        boxShadow: isHovered
          ? `0 0 30px 6px ${glowRgba}, 0 0 60px 12px ${glowSoft}, inset 0 0 20px 2px ${glowRgba}`
          : '0 1px 3px rgba(0, 0, 0, 0.1)',
        transition: 'border-color 200ms ease-out, box-shadow 200ms ease-out',
        paddingInline: 'clamp(8px, 0.8vw, 14px)',
        minHeight: 'clamp(50px, 4.5vw, 80px)',
      }}
      onMouseEnter={() => { setIsHovered(true); onHoverChange?.(true); }}
      onMouseLeave={() => { setIsHovered(false); onHoverChange?.(false); }}
      onClick={hasAction ? onAction : undefined}
      onKeyDown={hasAction ? handleKeyDown : undefined}
    >
      {/* Ethereal glow — top radial */}
      <span
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${glowRgba} 0%, transparent 70%)`,
          opacity: isHovered ? 1 : 0,
          transition: 'opacity 200ms ease-out',
        }}
        aria-hidden="true"
      />
      {/* Bottom glow accent */}
      <span
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg"
        style={{
          background: `radial-gradient(ellipse at 50% 100%, ${glowSoft} 0%, transparent 60%)`,
          opacity: isHovered ? 0.6 : 0,
          transition: 'opacity 200ms ease-out',
        }}
        aria-hidden="true"
      />

      {/* Content — auto rows, space-evenly = equal gap above/between/below */}
      <div
        className="relative z-10 h-full"
        style={{ display: 'grid', gridTemplateRows: 'auto auto', alignContent: 'space-evenly' }}
      >
        {/* Row 1: Emoji + Label + Stat */}
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: 'clamp(0.85rem, 1.0vw, 1.15rem)', lineHeight: 1 }}>{emoji}</span>
          <span
            className="font-semibold truncate"
            style={{ color, fontSize: 'clamp(0.65rem, 0.75vw, 0.85rem)' }}
          >
            {label}
          </span>
          {stat && (
            <span
              className="ml-auto font-bold tabular-nums shrink-0"
              style={{ color, fontSize: 'clamp(0.7rem, 0.8vw, 0.9rem)' }}
            >
              {stat}
            </span>
          )}
        </div>

        {/* Row 2: Values or custom content */}
        <div className="flex flex-col" style={{ gap: 'clamp(2px, 0.25vw, 4px)' }}>
          {children ?? (
            <>
              <span
                className="text-white"
                style={{ fontSize: 'clamp(0.625rem, 0.55vw, 0.7rem)' }}
              >
                {isPro ? '' : freeValue}
              </span>
              <span
                className="font-medium"
                style={{ color, fontSize: 'clamp(0.625rem, 0.6vw, 0.75rem)' }}
              >
                {isPro ? proValue : `Pro: ${proValue}`}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export interface FeatureControlPanelProps {
  isPaidUser: boolean;
  selectedPromptTier: PromptTier;
  onPromptTierChange: (tier: PromptTier) => void;
  selectedExchangeCount: number;
  onOpenExchangePicker: () => void;
  onFormatHover?: (hovering: boolean) => void;
  onScenesHover?: (hovering: boolean) => void;
  onSavedHover?: (hovering: boolean) => void;
  onLabHover?: (hovering: boolean) => void;
  onExchangesHover?: (hovering: boolean) => void;
}

export function FeatureControlPanel({
  isPaidUser,
  selectedPromptTier,
  onPromptTierChange: _onPromptTierChange,
  selectedExchangeCount,
  onOpenExchangePicker,
  onFormatHover,
  onScenesHover,
  onSavedHover,
  onLabHover,
  onExchangesHover,
}: FeatureControlPanelProps) {
  const { dailyUsage, anonymousUsage } = usePromagenAuth();
  const { allPrompts } = useSavedPrompts();

  const promptCount = dailyUsage?.count ?? anonymousUsage?.count ?? 0;
  const promptLimit = dailyUsage?.limit ?? anonymousUsage?.limit ?? 3;
  const savedCount = allPrompts.length;

  const nav = useCallback((path: string) => {
    window.location.href = path;
  }, []);

  const tierLabel = TIER_LABELS[selectedPromptTier];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .feature-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          grid-template-rows: repeat(3, 1fr);
          gap: clamp(6px, 0.6vw, 10px);
          height: 100%;
        }
        @media (max-height: 820px) {
          .feature-grid > :nth-child(n+7) { display: none; }
          .feature-grid { grid-template-rows: repeat(2, 1fr); }
        }
      ` }} />

      <div className="feature-grid">
        {/* ── ⚡ Daily Prompts ─────────────────────────────── */}
        <FeatureCard
          emoji="⚡"
          label="Daily Prompts"
          color="#f59e0b"
          freeValue={`${promptCount} / ${promptLimit} today`}
          proValue="Unlimited"
          actionLabel={isPaidUser ? 'Unlimited' : 'Go unlimited'}
          onAction={isPaidUser ? undefined : () => nav('/upgrade')}
          isPro={isPaidUser}
          stat={isPaidUser ? '∞' : `${promptCount}/${promptLimit}`}
        />

        {/* ── 🎨 Prompt Format ────────────────────────────── */}
        <FeatureCard
          emoji="🎨"
          label="Prompt Format"
          color="#60a5fa"
          freeValue="Varies by surface"
          proValue="Your choice"
          actionLabel={isPaidUser ? 'Active' : 'Pro only'}
          isPro={isPaidUser}
          stat={isPaidUser ? (tierLabel?.short ?? 'T4') : ''}
          onHoverChange={onFormatHover}
          actionAlwaysColored={true}
        >
          {isPaidUser ? (
            <span
              className="inline-flex items-center gap-1 rounded-full font-medium"
              style={{
                fontSize: 'clamp(0.625rem, 0.6vw, 0.7rem)',
                padding: 'clamp(2px, 0.2vw, 3px) clamp(6px, 0.6vw, 10px)',
                background: hexToRgba(tierLabel?.color ?? '#60a5fa', 0.2),
                border: `1px solid ${hexToRgba(tierLabel?.color ?? '#60a5fa', 0.4)}`,
                color: tierLabel?.color ?? '#60a5fa',
              }}
            >
              <span
                className="rounded-full"
                style={{
                  width: 'clamp(5px, 0.4vw, 6px)',
                  height: 'clamp(5px, 0.4vw, 6px)',
                  background: tierLabel?.color ?? '#60a5fa',
                }}
              />
              {tierLabel?.short ?? 'T4 · Plain'}
            </span>
          ) : (
            <span className="text-slate-400" style={{ fontSize: 'clamp(0.625rem, 0.55vw, 0.7rem)' }}>
              Varies by surface
            </span>
          )}
        </FeatureCard>

        {/* ── 🎬 Scene Starters ───────────────────────────── */}
        <FeatureCard
          emoji="🎬"
          label="Scenes"
          color="#c084fc"
          freeValue="25 free scenes"
          proValue="200 · 23 worlds"
          actionLabel={isPaidUser ? 'Explore' : 'Unlock 175'}
          onAction={() => nav('/')}
          isPro={isPaidUser}
          stat={isPaidUser ? '200' : '25'}
          onHoverChange={onScenesHover}
        />

        {/* ── 📊 Exchanges ────────────────────────────────── */}
        <FeatureCard
          emoji="📊"
          label="Exchanges"
          color="#22d3ee"
          freeValue="16 fixed"
          proValue="0–16, your choice"
          actionLabel={isPaidUser ? 'Configure' : 'Customise'}
          onAction={() => onOpenExchangePicker()}
          isPro={isPaidUser}
          stat={String(selectedExchangeCount)}
          onHoverChange={onExchangesHover}
        />

        {/* ── 💾 Saved Prompts ────────────────────────────── */}
        <FeatureCard
          emoji="💾"
          label="Saved"
          color="#a78bfa"
          freeValue={`${savedCount} · browser only`}
          proValue="Synced across devices"
          actionLabel={isPaidUser ? 'Open library' : 'View library'}
          onAction={() => nav('/studio/library')}
          isPro={isPaidUser}
          stat={String(savedCount)}
          onHoverChange={onSavedHover}
          actionAlwaysColored={true}
        />

        {/* ── 🧪 Prompt Lab ───────────────────────────────── */}
        <FeatureCard
          emoji="🧪"
          label="Prompt Lab"
          color="#fb7185"
          freeValue="Pro exclusive"
          proValue="Full access"
          actionLabel={isPaidUser ? 'Open lab' : 'Pro only'}
          onAction={isPaidUser ? () => nav('/studio/playground') : undefined}
          isPro={isPaidUser}
          onHoverChange={onLabHover}
          actionAlwaysColored={true}
        />

        {/* ── 🌍 Reference Frame ──────────────────────────── */}
        <FeatureCard
          emoji="🌍"
          label="Frame"
          color="#34d399"
          freeValue="Your location"
          proValue="You / Greenwich toggle"
          actionLabel={isPaidUser ? 'Active' : 'Pro only'}
          isPro={isPaidUser}
          actionAlwaysColored={true}
        />

        {/* ── ⚙️ Prompt Stacking ─────────────────────────── */}
        <FeatureCard
          emoji="⚙️"
          label="Stacking"
          color="#fb923c"
          freeValue="Base limits"
          proValue="+1 on 7 categories"
          actionLabel={isPaidUser ? 'Active' : 'Pro only'}
          isPro={isPaidUser}
          actionAlwaysColored={true}
        >
          <span className="text-white" style={{ fontSize: 'clamp(0.625rem, 0.55vw, 0.7rem)' }}>
            Style, Lighting, Colour, Atmosphere, Materials, Fidelity
          </span>
          <span className="font-medium" style={{ color: '#fb923c', fontSize: 'clamp(0.625rem, 0.6vw, 0.75rem)' }}>
            {isPaidUser ? '+1 on each' : 'Pro: +1 on each'}
          </span>
        </FeatureCard>

        {/* ── 🏆 Vote Weight ──────────────────────────────── */}
        <FeatureCard
          emoji="🏆"
          label="Vote Power"
          color="#fbbf24"
          freeValue="1.0×"
          proValue="1.5× influence"
          actionLabel={isPaidUser ? 'Active' : 'Pro only'}
          isPro={isPaidUser}
          stat={isPaidUser ? '1.5×' : '1.0×'}
          actionAlwaysColored={true}
        />
      </div>
    </>
  );
}

export default FeatureControlPanel;
