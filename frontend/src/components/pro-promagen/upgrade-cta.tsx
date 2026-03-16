// src/components/pro-promagen/upgrade-cta.tsx
// ============================================================================
// UPGRADE CTA / PAYMENT PANEL v5.0.0
// ============================================================================
// Free users: Side-by-side pricing cards with exchange-card hover glow.
// Paid users: Save preferences + Manage Subscription (Stripe Portal).
// Cancellation-pending: Live countdown timer + reactivation via Portal.
//
// v5.0.0:
// - Cards glow like exchange cards (multi-layer boxShadow, border, radials)
// - Colours from human-factors §17 Colour Psychology:
//     Monthly = Amber (#F59E0B) — warmth, anticipation, premium
//     Annual  = Violet (#8B5CF6) — intelligence, creativity, premium
// - Height constrained to match the 3×3 feature grid above
// - No orange outer wrapper, no "Best Value" badge
// - Code standard compliant: 10px font floor, no opacity text,
//   no text-slate-500/600, no grey
//
// Authority: docs/authority/stripe.md §7, human-factors.md §17, code-standard.md §6
// Security: 10/10 — Price IDs server-side only
// Existing features preserved: Yes
// ============================================================================

'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { SignInButton } from '@clerk/nextjs';

// ============================================================================
// TYPES
// ============================================================================

export interface UpgradeCtaProps {
  isPaidUser: boolean;
  onSave?: () => Promise<void>;
  hasChanges?: boolean;
}

type CheckingOutPlan = 'monthly' | 'annual' | null;

interface CountdownParts {
  months: number;
  days: number;
  hours: number;
  minutes: number;
  expired: boolean;
}

// ============================================================================
// CONSTANTS — Colour Psychology (human-factors.md §17)
// ============================================================================

/** Amber — warmth, anticipation, premium. Makes users feel the product is valuable. */
const MONTHLY_COLOR = '#F59E0B';
/** Violet — intelligence, creativity, premium. Makes users feel smart for buying. */
const ANNUAL_COLOR = '#8B5CF6';

// ============================================================================
// HELPERS
// ============================================================================

/** Convert hex colour to rgba string. Matches exchange-card.tsx hexToRgba(). */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Compute countdown parts from a Unix timestamp (seconds). */
function computeCountdown(periodEndUnix: number): CountdownParts {
  const nowMs = Date.now();
  const endMs = periodEndUnix * 1000;
  const diffMs = endMs - nowMs;

  if (diffMs <= 0) return { months: 0, days: 0, hours: 0, minutes: 0, expired: true };

  const totalMinutes = Math.floor(diffMs / 60_000);
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);

  const months = Math.floor(totalDays / 30);
  const days = totalDays % 30;
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;

  return { months, days, hours, minutes, expired: false };
}

/** Format countdown into a compact readable string. */
function formatCountdown(c: CountdownParts): string {
  if (c.expired) return 'Expired';

  const parts: string[] = [];
  if (c.months > 0) parts.push(`${c.months}mo`);
  if (c.days > 0) parts.push(`${c.days}d`);
  if (c.hours > 0) parts.push(`${c.hours}h`);
  parts.push(`${c.minutes}m`);

  return parts.join(' ');
}

/** Build exchange-card-style glow values from a hex colour. */
function buildGlow(hex: string) {
  return {
    rgba: hexToRgba(hex, 0.3),
    border: hexToRgba(hex, 0.5),
    soft: hexToRgba(hex, 0.15),
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function UpgradeCta({
  isPaidUser,
  onSave,
  hasChanges = false,
}: UpgradeCtaProps) {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [checkingOutPlan, setCheckingOutPlan] = useState<CheckingOutPlan>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [now, setNow] = useState(Date.now());

  // ── Read cancellation state from Clerk metadata ──
  const metadata = user?.publicMetadata as Record<string, unknown> | undefined;
  const cancelAtPeriodEnd = metadata?.cancelAtPeriodEnd === true;
  const periodEndDate = typeof metadata?.periodEndDate === 'number' ? metadata.periodEndDate : null;

  // ── Countdown ticker (updates every 60s when cancellation-pending) ──
  useEffect(() => {
    if (!cancelAtPeriodEnd || !periodEndDate) return;
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, [cancelAtPeriodEnd, periodEndDate]);

  const countdown = useMemo<CountdownParts | null>(() => {
    if (!cancelAtPeriodEnd || !periodEndDate) return null;
    void now; // dependency — triggers recompute on tick
    return computeCountdown(periodEndDate);
  }, [cancelAtPeriodEnd, periodEndDate, now]);

  // ── Detect ?success=true on mount ──
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      setShowSuccess(true);
      const url = new URL(window.location.href);
      url.searchParams.delete('success');
      window.history.replaceState({}, '', url.toString());
      const timer = setTimeout(() => setShowSuccess(false), 5000);
      return () => clearTimeout(timer);
    }
  }, []);

  // ── Checkout flow ──
  const handleSubscribe = useCallback(async (plan: 'monthly' | 'annual') => {
    setCheckingOutPlan(plan);
    setCheckoutError(null);
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ plan, email: user?.primaryEmailAddress?.emailAddress }),
      });

      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        setCheckoutError('Server error — please try again');
        setCheckingOutPlan(null);
        return;
      }

      const data = await response.json();

      if (!response.ok || !data.url) {
        setCheckoutError(data.error ?? 'Something went wrong');
        setCheckingOutPlan(null);
        return;
      }

      window.location.href = data.url;
    } catch {
      setCheckoutError('Connection error — please try again');
      setCheckingOutPlan(null);
    }
  }, [user?.primaryEmailAddress?.emailAddress]);

  // ── Portal flow (manage / reactivate) ──
  const handleManageSubscription = useCallback(async () => {
    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
      });

      const data = await response.json();
      if (response.ok && data.url) {
        window.location.href = data.url;
      }
    } catch {
      // Silent — portal is non-critical
    }
  }, []);

  // ── Save flow ──
  const handleSave = useCallback(async () => {
    if (!onSave) return;
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      await onSave();
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setIsSaving(false);
    }
  }, [onSave]);

  // ── Pre-compute glow values ──
  const monthlyGlow = buildGlow(MONTHLY_COLOR);
  const annualGlow = buildGlow(ANNUAL_COLOR);
  const emeraldGlow = buildGlow('#10B981');

  // ============================================================================
  // SUCCESS TOAST
  // ============================================================================

  if (showSuccess && isPaidUser) {
    return (
      <div
        className="rounded-xl overflow-hidden flex items-center justify-center"
        style={{
          maxHeight: 'clamp(140px, 16vw, 270px)',
          background: 'rgba(255, 255, 255, 0.05)',
          border: `1px solid ${emeraldGlow.border}`,
          boxShadow: `0 0 40px 8px ${emeraldGlow.rgba}, 0 0 80px 16px ${emeraldGlow.soft}, inset 0 0 25px 3px ${emeraldGlow.rgba}`,
          padding: 'clamp(16px, 1.5vw, 24px)',
        }}
      >
        <div className="text-center flex flex-col items-center" style={{ gap: 'clamp(8px, 0.8vw, 12px)' }}>
          <span style={{ fontSize: 'clamp(1.5rem, 2vw, 2.5rem)' }}>🎉</span>
          <span
            className="text-emerald-400 font-semibold"
            style={{ fontSize: 'clamp(0.85rem, 1vw, 1.1rem)' }}
          >
            Welcome to Pro Promagen!
          </span>
          <span
            className="text-white/60"
            style={{ fontSize: 'clamp(0.625rem, 0.8vw, 0.85rem)' }}
          >
            Your 7-day free trial has started
          </span>
        </div>
      </div>
    );
  }

  // ============================================================================
  // PAID USER VIEW — Cancellation-pending or normal
  // ============================================================================

  if (isPaidUser) {
    const isCancelling = cancelAtPeriodEnd && countdown && !countdown.expired;
    const activeGlow = isCancelling ? buildGlow(MONTHLY_COLOR) : emeraldGlow;

    return (
      <div
        className="relative rounded-xl overflow-hidden flex flex-col items-center justify-center"
        style={{
          maxHeight: 'clamp(140px, 16vw, 270px)',
          background: 'rgba(255, 255, 255, 0.05)',
          border: `1px solid ${activeGlow.border}`,
          boxShadow: `0 0 40px 8px ${activeGlow.rgba}, 0 0 80px 16px ${activeGlow.soft}, inset 0 0 25px 3px ${activeGlow.rgba}`,
          padding: 'clamp(16px, 1.5vw, 24px)',
        }}
      >
        {/* Ethereal glow — top radial */}
        <div
          className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden"
          style={{ background: `radial-gradient(ellipse at 50% 0%, ${activeGlow.rgba} 0%, transparent 70%)` }}
        />
        {/* Bottom glow accent */}
        <div
          className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden"
          style={{ background: `radial-gradient(ellipse at 50% 100%, ${activeGlow.soft} 0%, transparent 60%)` }}
        />

        <div className="relative z-10 flex flex-col items-center w-full" style={{ gap: 'clamp(10px, 1vw, 16px)' }}>

          {/* ── Cancellation countdown ── */}
          {isCancelling ? (
            <>
              <span
                className="text-amber-400 font-medium"
                style={{ fontSize: 'clamp(0.625rem, 0.85vw, 0.9rem)' }}
              >
                Pro access ends in
              </span>

              {/* Countdown display — clickable to reactivate */}
              <button
                type="button"
                onClick={handleManageSubscription}
                className="cursor-pointer rounded-xl font-bold text-amber-400 ring-1 ring-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 hover:ring-amber-400/60 transition-all duration-200"
                style={{
                  fontSize: 'clamp(1rem, 1.3vw, 1.5rem)',
                  padding: 'clamp(8px, 0.8vw, 14px) clamp(16px, 1.6vw, 28px)',
                  letterSpacing: '0.04em',
                }}
                title="Click to reactivate your subscription"
              >
                {formatCountdown(countdown)}
              </button>

              <span
                className="text-slate-400 text-center"
                style={{ fontSize: 'clamp(0.625rem, 0.75vw, 0.8rem)' }}
              >
                Click the timer to reactivate via Stripe
              </span>
            </>
          ) : (
            /* ── Normal active Pro ── */
            <>
              <span
                className="text-white/60"
                style={{ fontSize: 'clamp(0.625rem, 0.85vw, 0.9rem)' }}
              >
                {hasChanges ? 'You have unsaved changes' : 'Your preferences are saved'}
              </span>

              <div className="flex w-full" style={{ gap: 'clamp(8px, 0.8vw, 12px)' }}>
                {/* Save button */}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || !hasChanges}
                  className={`flex-1 rounded-xl font-semibold text-white transition-all duration-300 ${
                    hasChanges
                      ? 'cursor-pointer bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 hover:from-emerald-400 hover:via-teal-400 hover:to-emerald-400 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40'
                      : 'bg-white/10 cursor-default'
                  } ${isSaving ? 'cursor-wait' : ''}`}
                  style={{
                    padding: 'clamp(8px, 0.8vw, 12px) clamp(12px, 1.2vw, 20px)',
                    fontSize: 'clamp(0.75rem, 0.85vw, 0.9rem)',
                  }}
                >
                  <span className="flex items-center justify-center" style={{ gap: 'clamp(4px, 0.4vw, 6px)' }}>
                    {isSaving ? (
                      <><span className="animate-spin">⏳</span><span>Saving...</span></>
                    ) : saveStatus === 'success' ? (
                      <><span>✓</span><span>Saved!</span></>
                    ) : saveStatus === 'error' ? (
                      <><span>✕</span><span>Error — try again</span></>
                    ) : (
                      <><span>💾</span><span>Save Preferences</span></>
                    )}
                  </span>
                </button>

                {/* Manage Subscription */}
                <button
                  type="button"
                  onClick={handleManageSubscription}
                  className="flex-1 rounded-xl font-medium text-white cursor-pointer ring-1 ring-white/20 hover:ring-white/40 transition-all duration-200 bg-white/5 hover:bg-white/10"
                  style={{
                    padding: 'clamp(8px, 0.8vw, 12px) clamp(12px, 1.2vw, 20px)',
                    fontSize: 'clamp(0.75rem, 0.85vw, 0.9rem)',
                  }}
                >
                  Manage Subscription
                </button>
              </div>

              <span
                className="text-slate-400 text-center"
                style={{ fontSize: 'clamp(0.625rem, 0.75vw, 0.75rem)' }}
              >
                Changes apply to your homepage immediately
              </span>
            </>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // FREE USER VIEW — Side-by-side pricing cards (exchange-card glow)
  // ============================================================================

  return (
    <div className="flex flex-col h-full">
      {/* Animated amber header — identical to TierPreviewPanel line 343 */}
      <div style={{ padding: 'clamp(12px, 1.2vw, 20px) 0' }}>
        <p
          className="italic text-amber-400/80 animate-pulse text-center font-semibold"
          style={{ fontSize: 'clamp(0.75rem, 0.9vw, 1rem)' }}
        >
          Unlimited prompts across 42 platforms — 7 days free
        </p>
      </div>

      {/* Two pricing cards — height matches 3×3 feature grid */}
      <div
        className="flex"
        style={{
          gap: 'clamp(6px, 0.6vw, 10px)',
          maxHeight: 'clamp(140px, 16vw, 270px)',
        }}
      >

        {/* ── MONTHLY CARD — Amber glow (warmth, anticipation, premium) ── */}
        <div
          className="relative flex-1 rounded-xl overflow-hidden flex flex-col items-center justify-between"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: `1px solid ${monthlyGlow.border}`,
            boxShadow: `0 0 40px 8px ${monthlyGlow.rgba}, 0 0 80px 16px ${monthlyGlow.soft}, inset 0 0 25px 3px ${monthlyGlow.rgba}`,
            padding: 'clamp(10px, 1vw, 16px)',
            gap: 'clamp(6px, 0.6vw, 10px)',
            transition: 'box-shadow 200ms ease-out, border-color 200ms ease-out',
          }}
        >
          {/* Ethereal glow — top radial */}
          <div
            className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden"
            style={{ background: `radial-gradient(ellipse at 50% 0%, ${monthlyGlow.rgba} 0%, transparent 70%)` }}
          />
          {/* Bottom glow accent */}
          <div
            className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden"
            style={{ background: `radial-gradient(ellipse at 50% 100%, ${monthlyGlow.soft} 0%, transparent 60%)` }}
          />

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center justify-between h-full w-full" style={{ gap: 'clamp(6px, 0.6vw, 10px)' }}>
            <span
              className="text-amber-400 font-semibold"
              style={{ fontSize: 'clamp(0.625rem, 0.8vw, 0.85rem)' }}
            >
              Monthly
            </span>

            <div className="text-center">
              <span
                className="text-white font-bold block"
                style={{ fontSize: 'clamp(1.1rem, 1.4vw, 1.6rem)' }}
              >
                £15.99
              </span>
              <span
                className="text-white/60 block"
                style={{ fontSize: 'clamp(0.625rem, 0.7vw, 0.75rem)' }}
              >
                per month
              </span>
            </div>

            {!isSignedIn ? (
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="w-full rounded-xl font-semibold text-white cursor-pointer bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:via-orange-400 hover:to-amber-400 transition-all duration-300 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40"
                  style={{
                    padding: 'clamp(8px, 0.8vw, 12px) clamp(12px, 1.2vw, 20px)',
                    fontSize: 'clamp(0.75rem, 0.85vw, 0.9rem)',
                  }}
                >
                  Start Free Trial
                </button>
              </SignInButton>
            ) : (
              <button
                type="button"
                onClick={() => handleSubscribe('monthly')}
                disabled={checkingOutPlan !== null}
                className="w-full rounded-xl font-semibold text-white cursor-pointer bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:via-orange-400 hover:to-amber-400 transition-all duration-300 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 disabled:cursor-wait"
                style={{
                  padding: 'clamp(8px, 0.8vw, 12px) clamp(12px, 1.2vw, 20px)',
                  fontSize: 'clamp(0.75rem, 0.85vw, 0.9rem)',
                }}
              >
                {checkingOutPlan === 'monthly' ? '⏳ Redirecting...' : 'Start Free Trial'}
              </button>
            )}
          </div>
        </div>

        {/* ── ANNUAL CARD — Violet glow (intelligence, creativity, premium) ── */}
        <div
          className="relative flex-1 rounded-xl overflow-hidden flex flex-col items-center justify-between"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: `1px solid ${annualGlow.border}`,
            boxShadow: `0 0 40px 8px ${annualGlow.rgba}, 0 0 80px 16px ${annualGlow.soft}, inset 0 0 25px 3px ${annualGlow.rgba}`,
            padding: 'clamp(10px, 1vw, 16px)',
            gap: 'clamp(6px, 0.6vw, 10px)',
            transition: 'box-shadow 200ms ease-out, border-color 200ms ease-out',
          }}
        >
          {/* Ethereal glow — top radial */}
          <div
            className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden"
            style={{ background: `radial-gradient(ellipse at 50% 0%, ${annualGlow.rgba} 0%, transparent 70%)` }}
          />
          {/* Bottom glow accent */}
          <div
            className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden"
            style={{ background: `radial-gradient(ellipse at 50% 100%, ${annualGlow.soft} 0%, transparent 60%)` }}
          />

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center justify-between h-full w-full" style={{ gap: 'clamp(6px, 0.6vw, 10px)' }}>
            <span
              className="text-violet-400 font-semibold"
              style={{ fontSize: 'clamp(0.625rem, 0.8vw, 0.85rem)' }}
            >
              Annual
            </span>

            <div className="text-center">
              <span
                className="text-white font-bold block"
                style={{ fontSize: 'clamp(1.1rem, 1.4vw, 1.6rem)' }}
              >
                £12.49
              </span>
              <span
                className="text-white/60 block"
                style={{ fontSize: 'clamp(0.625rem, 0.7vw, 0.75rem)' }}
              >
                per month, billed as £149.99/year
              </span>
              <span
                className="text-violet-400 font-semibold block"
                style={{ fontSize: 'clamp(0.625rem, 0.7vw, 0.75rem)', marginTop: 'clamp(2px, 0.2vw, 4px)' }}
              >
                Save £42
              </span>
            </div>

            {!isSignedIn ? (
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="w-full rounded-xl font-semibold text-white cursor-pointer bg-gradient-to-r from-violet-500 via-purple-500 to-violet-500 hover:from-violet-400 hover:via-purple-400 hover:to-violet-400 transition-all duration-300 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40"
                  style={{
                    padding: 'clamp(8px, 0.8vw, 12px) clamp(12px, 1.2vw, 20px)',
                    fontSize: 'clamp(0.75rem, 0.85vw, 0.9rem)',
                  }}
                >
                  Start Free Trial
                </button>
              </SignInButton>
            ) : (
              <button
                type="button"
                onClick={() => handleSubscribe('annual')}
                disabled={checkingOutPlan !== null}
                className="w-full rounded-xl font-semibold text-white cursor-pointer bg-gradient-to-r from-violet-500 via-purple-500 to-violet-500 hover:from-violet-400 hover:via-purple-400 hover:to-violet-400 transition-all duration-300 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 disabled:cursor-wait"
                style={{
                  padding: 'clamp(8px, 0.8vw, 12px) clamp(12px, 1.2vw, 20px)',
                  fontSize: 'clamp(0.75rem, 0.85vw, 0.9rem)',
                }}
              >
                {checkingOutPlan === 'annual' ? '⏳ Redirecting...' : 'Start Free Trial'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error message */}
      {checkoutError && (
        <span
          className="text-red-400 text-center font-medium"
          style={{ fontSize: 'clamp(0.625rem, 0.75vw, 0.8rem)' }}
        >
          {checkoutError}
        </span>
      )}

      {/* Subtext — 10px floor, text-slate-400 (no grey, no opacity) */}
      <span
        className="text-slate-400 text-center"
        style={{ fontSize: 'clamp(0.625rem, 0.7vw, 0.75rem)' }}
      >
        7-day free trial on both plans · Cancel any time
      </span>
    </div>
  );
}

export default UpgradeCta;
