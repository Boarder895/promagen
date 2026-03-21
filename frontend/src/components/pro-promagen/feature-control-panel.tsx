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
  onDailyHover?: (hovering: boolean) => void;
  onFormatHover?: (hovering: boolean) => void;
  onScenesHover?: (hovering: boolean) => void;
  onSavedHover?: (hovering: boolean) => void;
  onLabHover?: (hovering: boolean) => void;
  onExchangesHover?: (hovering: boolean) => void;
  onFrameHover?: (hovering: boolean) => void;
  onImageGenHover?: (hovering: boolean) => void;
  onIntelligenceHover?: (hovering: boolean) => void;
  onDropdownSelect?: () => void;
}

export function FeatureControlPanel({
  isPaidUser,
  selectedPromptTier,
  onPromptTierChange,
  selectedExchangeCount,
  onOpenExchangePicker,
  onDailyHover,
  onFormatHover,
  onScenesHover,
  onSavedHover,
  onLabHover,
  onExchangesHover,
  onFrameHover,
  onImageGenHover,
  onIntelligenceHover,
  onDropdownSelect,
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
          proValue="Unlimited colour coded text prompts"
          actionLabel={isPaidUser ? 'Unlimited' : 'Go unlimited'}
          onAction={isPaidUser ? undefined : () => nav('/upgrade')}
          isPro={isPaidUser}
          stat={isPaidUser ? '∞' : `${promptCount}/${promptLimit}`}
          onHoverChange={onDailyHover}
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
          onHoverChange={onFormatHover}
          actionAlwaysColored={true}
        >
          {isPaidUser ? (
            <>
              {/* Paid: colour-coded tier dropdown */}
              <select
                value={selectedPromptTier}
                onChange={(e) => {
                  e.stopPropagation();
                  const val = Number(e.target.value) as 1 | 2 | 3 | 4;
                  onPromptTierChange(val);
                  onDropdownSelect?.();
                }}
                onClick={(e) => e.stopPropagation()}
                className="cursor-pointer rounded font-medium w-full"
                style={{
                  fontSize: 'clamp(0.6rem, 0.6vw, 0.7rem)',
                  padding: 'clamp(2px, 0.2vw, 4px) clamp(4px, 0.4vw, 8px)',
                  background: 'rgba(15, 23, 42, 0.9)',
                  border: `1px solid ${hexToRgba(tierLabel?.color ?? '#60a5fa', 0.5)}`,
                  color: tierLabel?.color ?? '#60a5fa',
                  outline: 'none',
                }}
              >
                {Object.entries(TIER_LABELS).map(([k, v]) => (
                  <option key={k} value={k} style={{ color: v.color, background: '#0f172a' }}>{v.short}</option>
                ))}
              </select>
            </>
          ) : (
            <>
              {/* Unpaid: same pattern as every other feature card */}
              <span
                className="text-white"
                style={{ fontSize: 'clamp(0.625rem, 0.55vw, 0.7rem)' }}
              >
                All current prompts are a spread
              </span>
              <span
                className="font-medium"
                style={{ color: '#60a5fa', fontSize: 'clamp(0.625rem, 0.6vw, 0.75rem)' }}
              >
                The choice of Prompt Text is yours
              </span>
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
          onHoverChange={onFrameHover}
        />

        {/* ── 🧠 Prompt Intelligence ─────────────────────── */}
        <FeatureCard
          emoji="🧠"
          label="Prompt Intelligence"
          color="#fb923c"
          freeValue="Standard assembly"
          proValue="45-platform adaptive engine"
          actionLabel={isPaidUser ? 'Active' : 'Pro only'}
          isPro={isPaidUser}
          actionAlwaysColored={true}
          onHoverChange={onIntelligenceHover}
        >
          <span className="text-white" style={{ fontSize: 'clamp(0.625rem, 0.55vw, 0.7rem)' }}>
            12 categories · 4 encoder types
          </span>
          <span className="font-medium" style={{ color: '#fb923c', fontSize: 'clamp(0.625rem, 0.6vw, 0.75rem)' }}>
            {isPaidUser ? 'Per-platform optimised' : 'Pro: Per-platform optimised'}
          </span>
        </FeatureCard>

        {/* ── 🖼️ Image Generation ─────────────────────────── */}
        <FeatureCard
          emoji="🖼️"
          label="Image Gen"
          color="#e879f9"
          freeValue="Copy & paste manually"
          proValue="Generate inside Promagen"
          actionLabel="Coming to Pro"
          isPro={isPaidUser}
          actionAlwaysColored={true}
          onHoverChange={onImageGenHover}
        >
          <span className="text-white" style={{ fontSize: 'clamp(0.625rem, 0.55vw, 0.7rem)' }}>
            Bring your own API key
          </span>
          <span className="font-medium" style={{ color: '#e879f9', fontSize: 'clamp(0.625rem, 0.6vw, 0.75rem)' }}>
            Coming to Pro
          </span>
        </FeatureCard>
      </div>
    </>
  );
}

export default FeatureControlPanel;
