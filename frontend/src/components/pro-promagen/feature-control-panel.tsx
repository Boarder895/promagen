// src/components/pro-promagen/feature-control-panel.tsx
// ============================================================================
// FEATURE CONTROL PANEL v1.1.0 — Pro Promagen Purchase/Config Page
// ============================================================================
// 3×3 grid of exchange-card-style feature cards.
// Each card: unique glow colour, hover effect, live data where relevant.
//
// v1.1.0:
// - a11y: role="button", tabIndex, onKeyDown on actionable cards
// - Minimum text 10px (0.625rem) — code-standard §6.0.1
// - onAction optional — info-only cards don't navigate
// - "Go unlimited" is payment placeholder (links to /upgrade)
// - No link on: Daily Prompts (paid), Frame, Stacking, Vote Power
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
  /** Notifies parent when hover state changes */
  onHoverChange?: (hovering: boolean) => void;
  /** When true, action label uses card colour at rest (not grey) */
  actionAlwaysColored?: boolean;
}

function FeatureCard({
  emoji,
  label,
  color,
  freeValue,
  proValue,
  actionLabel,
  onAction,
  isPro,
  children,
  stat,
  onHoverChange,
  actionAlwaysColored,
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
        padding: 'clamp(8px, 0.8vw, 14px)',
        minHeight: 'clamp(80px, 7vw, 110px)',
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

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Row 1: Emoji + Label + Stat */}
        <div className="flex items-center gap-1.5 mb-auto">
          <span style={{ fontSize: 'clamp(0.9rem, 1.1vw, 1.2rem)' }}>{emoji}</span>
          <span
            className="font-semibold text-white truncate"
            style={{ fontSize: 'clamp(0.7rem, 0.85vw, 0.9rem)' }}
          >
            {label}
          </span>
          {stat && (
            <span
              className="ml-auto font-bold tabular-nums shrink-0"
              style={{ color, fontSize: 'clamp(0.75rem, 0.9vw, 0.95rem)' }}
            >
              {stat}
            </span>
          )}
        </div>

        {/* Row 2: Values or custom content */}
        <div className="flex-1 flex flex-col justify-center" style={{ gap: 'clamp(2px, 0.3vw, 4px)' }}>
          {children ?? (
            <>
              <span
                className="text-white/40"
                style={{ fontSize: 'clamp(0.625rem, 0.75vw, 0.75rem)' }}
              >
                {isPro ? '' : freeValue}
              </span>
              <span
                className="font-medium"
                style={{ color, fontSize: 'clamp(0.625rem, 0.8vw, 0.85rem)' }}
              >
                {isPro ? proValue : `Pro: ${proValue}`}
              </span>
            </>
          )}
        </div>

        {/* Row 3: Action label */}
        <div className="mt-auto pt-1">
          <span
            className={`inline-flex items-center gap-1 font-semibold uppercase tracking-wide ${hasAction ? 'cursor-pointer' : ''}`}
            style={{
              color: actionAlwaysColored ? color : (isHovered && hasAction ? color : 'rgba(255, 255, 255, 0.5)'),
              fontSize: 'clamp(0.625rem, 0.7vw, 0.75rem)',
              transition: 'color 200ms ease-out',
              letterSpacing: '0.05em',
            }}
          >
            {actionLabel}
            {hasAction && (
              <svg
                className="w-3 h-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
                style={{ transition: 'transform 200ms ease-out', transform: isHovered ? 'translateX(2px)' : 'none' }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MINI TIER SELECTOR
// ============================================================================

function MiniTierSelector({
  selectedTier,
  onChange,
  disabled,
}: {
  selectedTier: PromptTier;
  onChange: (tier: PromptTier) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex gap-1">
      {([1, 2, 3, 4] as PromptTier[]).map((t) => {
        const info = TIER_LABELS[t]!;
        const isActive = t === selectedTier;
        return (
          <button
            key={t}
            type="button"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled) onChange(t);
            }}
            className={`flex items-center gap-1 rounded-full transition-all duration-200 ${
              disabled ? 'cursor-default' : 'cursor-pointer'
            }`}
            style={{
              padding: 'clamp(2px, 0.3vw, 4px) clamp(6px, 0.6vw, 10px)',
              fontSize: 'clamp(0.625rem, 0.7vw, 0.75rem)',
              background: isActive ? hexToRgba(info.color, 0.35) : 'rgba(255,255,255,0.03)',
              border: `1px solid ${isActive ? hexToRgba(info.color, 0.7) : 'rgba(255,255,255,0.08)'}`,
              color: isActive ? info.color : 'rgba(255,255,255,0.4)',
              fontWeight: isActive ? 600 : 400,
            }}
          >
            <span
              className="rounded-full"
              style={{
                width: 'clamp(5px, 0.4vw, 6px)',
                height: 'clamp(5px, 0.4vw, 6px)',
                background: isActive ? info.color : 'rgba(255,255,255,0.2)',
              }}
            />
            T{t}
          </button>
        );
      })}
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
  /** Called when Prompt Format card hover state changes */
  onFormatHover?: (hovering: boolean) => void;
  /** Called when Scenes card hover state changes */
  onScenesHover?: (hovering: boolean) => void;
  /** Called when Saved card hover state changes */
  onSavedHover?: (hovering: boolean) => void;
  /** Called when Prompt Lab card hover state changes */
  onLabHover?: (hovering: boolean) => void;
}

export function FeatureControlPanel({
  isPaidUser,
  selectedPromptTier,
  onPromptTierChange,
  selectedExchangeCount,
  onOpenExchangePicker,
  onFormatHover,
  onScenesHover,
  onSavedHover,
  onLabHover,
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
          gap: clamp(6px, 0.6vw, 10px);
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
            <>
              <span className="text-amber-400 font-medium" style={{ fontSize: 'clamp(0.625rem, 0.75vw, 0.75rem)', marginBottom: 'clamp(2px, 0.2vw, 3px)' }}>
                Select tier ↓
              </span>
              <MiniTierSelector
                selectedTier={selectedPromptTier}
                onChange={onPromptTierChange}
                disabled={false}
              />
            </>
          ) : (
            <>
              <span className="text-white/40" style={{ fontSize: 'clamp(0.625rem, 0.75vw, 0.75rem)' }}>
                Varies by surface
              </span>
              <MiniTierSelector
                selectedTier={selectedPromptTier}
                onChange={onPromptTierChange}
                disabled={true}
              />
            </>
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
          <span className="text-white/40" style={{ fontSize: 'clamp(0.625rem, 0.75vw, 0.75rem)' }}>
            Style, Lighting, Colour, Atmosphere, Materials, Fidelity, Negative
          </span>
          <span className="font-medium" style={{ color: '#fb923c', fontSize: 'clamp(0.625rem, 0.8vw, 0.85rem)' }}>
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
