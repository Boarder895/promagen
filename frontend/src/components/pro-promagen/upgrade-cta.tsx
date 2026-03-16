// src/components/pro-promagen/upgrade-cta.tsx
// ============================================================================
// UPGRADE CTA / PAYMENT PANEL v3.0.0
// ============================================================================
// Free users: Side-by-side pricing cards (monthly + annual) with Stripe Checkout.
// Paid users: Save preferences + Manage Subscription (Stripe Portal).
//
// Human factors applied:
// - Loss Aversion (§8): Monthly price next to annual makes £42 loss visible
// - Von Restorff (§12): Annual card has emerald accent — stands out
// - Cognitive Load (§11): Two cards, one glance, instant comparison, no toggle
// - Anchoring: Monthly shown left (high anchor), annual feels cheap by comparison
//
// This panel shares space with TierPreviewPanel — both must match height
// so the hover swap doesn't cause layout shift.
//
// Authority: docs/authority/stripe.md §7
// Security: 10/10 — Price IDs server-side only, no card data touches our code
// Existing features preserved: Yes (rewrite of placeholder)
// ============================================================================

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { SignInButton } from '@clerk/nextjs';

// ============================================================================
// TYPES
// ============================================================================

export interface UpgradeCtaProps {
  isPaidUser: boolean;
  onSave?: () => Promise<void>;
  hasChanges?: boolean;
}

// ============================================================================
// SUBSCRIBE BUTTON (handles auth + checkout redirect)
// ============================================================================

function SubscribeButton({
  plan,
  label,
  isLoading,
  onSubscribe,
}: {
  plan: 'monthly' | 'annual';
  label: string;
  isLoading: boolean;
  onSubscribe: (plan: 'monthly' | 'annual') => void;
}) {
  const { isSignedIn } = useAuth();

  const button = (
    <button
      type="button"
      onClick={() => onSubscribe(plan)}
      disabled={isLoading || !isSignedIn}
      className="w-full rounded-xl font-semibold text-white cursor-pointer bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:via-orange-400 hover:to-amber-400 transition-all duration-300 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 disabled:cursor-wait"
      style={{
        padding: 'clamp(8px, 0.8vw, 12px) clamp(12px, 1.2vw, 20px)',
        fontSize: 'clamp(0.75rem, 0.85vw, 0.9rem)',
      }}
    >
      {isLoading ? '⏳ Redirecting...' : label}
    </button>
  );

  // If not signed in, wrap in Clerk's SignInButton to trigger modal
  if (!isSignedIn) {
    return (
      <SignInButton mode="modal">
        <button
          type="button"
          className="w-full rounded-xl font-semibold text-white cursor-pointer bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:via-orange-400 hover:to-amber-400 transition-all duration-300 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40"
          style={{
            padding: 'clamp(8px, 0.8vw, 12px) clamp(12px, 1.2vw, 20px)',
            fontSize: 'clamp(0.75rem, 0.85vw, 0.9rem)',
          }}
        >
          {label}
        </button>
      </SignInButton>
    );
  }

  return button;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function UpgradeCta({
  isPaidUser,
  onSave,
  hasChanges = false,
}: UpgradeCtaProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Detect ?success=true on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      setShowSuccess(true);
      // Clean up URL without reload
      const url = new URL(window.location.href);
      url.searchParams.delete('success');
      window.history.replaceState({}, '', url.toString());
      // Auto-dismiss after 5 seconds
      const timer = setTimeout(() => setShowSuccess(false), 5000);
      return () => clearTimeout(timer);
    }
  }, []);

  // ── Checkout flow ──
  const handleSubscribe = useCallback(async (plan: 'monthly' | 'annual') => {
    setIsCheckingOut(true);
    setCheckoutError(null);
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });

      // Handle non-JSON responses (server crash, HTML error page)
      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        console.error('[upgrade-cta] Non-JSON response:', text.slice(0, 200));
        setCheckoutError('Server error — please try again');
        setIsCheckingOut(false);
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        console.error('[upgrade-cta] Checkout error:', data.error);
        setCheckoutError(data.error ?? 'Something went wrong');
        setIsCheckingOut(false);
        return;
      }

      if (!data.url) {
        console.error('[upgrade-cta] No URL in response:', data);
        setCheckoutError('No checkout URL returned');
        setIsCheckingOut(false);
        return;
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (error) {
      console.error('[upgrade-cta] Checkout fetch error:', error);
      setCheckoutError('Connection error — please try again');
      setIsCheckingOut(false);
    }
  }, []);

  // ── Portal flow ──
  const handleManageSubscription = useCallback(async () => {
    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[upgrade-cta] Portal error:', data.error);
        return;
      }

      window.location.href = data.url;
    } catch (error) {
      console.error('[upgrade-cta] Portal fetch error:', error);
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

  // ============================================================================
  // SUCCESS TOAST (shown after checkout redirect back)
  // ============================================================================

  if (showSuccess && isPaidUser) {
    return (
      <div
        className="rounded-2xl overflow-hidden ring-1 ring-emerald-500/40 flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(20, 184, 166, 0.08), rgba(16, 185, 129, 0.05))',
          minHeight: 'clamp(140px, 14vw, 200px)',
          padding: 'clamp(16px, 1.5vw, 24px)',
        }}
      >
        <div className="text-center" style={{ gap: 'clamp(8px, 0.8vw, 12px)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: 'clamp(1.5rem, 2vw, 2.5rem)' }}>🎉</span>
          <span
            className="text-emerald-400 font-semibold"
            style={{ fontSize: 'clamp(0.9rem, 1vw, 1.1rem)' }}
          >
            Welcome to Pro Promagen!
          </span>
          <span
            className="text-white/50"
            style={{ fontSize: 'clamp(0.7rem, 0.8vw, 0.85rem)' }}
          >
            Your 7-day free trial has started
          </span>
        </div>
      </div>
    );
  }

  // ============================================================================
  // PAID USER VIEW — Save + Manage Subscription
  // ============================================================================

  if (isPaidUser) {
    return (
      <div
        className="rounded-2xl overflow-hidden ring-1 ring-emerald-500/30"
        style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(20, 184, 166, 0.06), rgba(16, 185, 129, 0.04))',
          minHeight: 'clamp(140px, 14vw, 200px)',
          padding: 'clamp(16px, 1.5vw, 24px)',
        }}
      >
        <div className="flex flex-col items-center justify-center h-full" style={{ gap: 'clamp(10px, 1vw, 16px)' }}>
          <span
            className="text-white/50"
            style={{ fontSize: 'clamp(0.7rem, 0.85vw, 0.85rem)' }}
          >
            {hasChanges ? 'You have unsaved changes' : 'Your preferences are saved'}
          </span>

          {/* Button row */}
          <div className="flex w-full" style={{ gap: 'clamp(8px, 0.8vw, 12px)' }}>
            {/* Save Preferences — primary */}
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

            {/* Manage Subscription — secondary/ghost */}
            <button
              type="button"
              onClick={handleManageSubscription}
              className="flex-1 rounded-xl font-medium text-white/70 cursor-pointer ring-1 ring-white/20 hover:ring-white/40 hover:text-white transition-all duration-200 bg-white/5 hover:bg-white/10"
              style={{
                padding: 'clamp(8px, 0.8vw, 12px) clamp(12px, 1.2vw, 20px)',
                fontSize: 'clamp(0.75rem, 0.85vw, 0.9rem)',
              }}
            >
              Manage Subscription
            </button>
          </div>

          <span
            className="text-white/30 text-center"
            style={{ fontSize: 'clamp(0.625rem, 0.75vw, 0.75rem)' }}
          >
            Changes apply to your homepage immediately
          </span>
        </div>
      </div>
    );
  }

  // ============================================================================
  // FREE USER VIEW — Side-by-side pricing cards
  // ============================================================================

  return (
    <div
      className="rounded-2xl overflow-hidden ring-1 ring-amber-500/30"
      style={{
        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.06), rgba(249, 115, 22, 0.04), rgba(245, 158, 11, 0.03))',
        minHeight: 'clamp(140px, 14vw, 200px)',
        padding: 'clamp(12px, 1.2vw, 20px)',
      }}
    >
      <div className="flex flex-col h-full justify-center" style={{ gap: 'clamp(8px, 0.8vw, 12px)' }}>

        {/* Two pricing cards side-by-side */}
        <div className="flex w-full" style={{ gap: 'clamp(8px, 0.8vw, 12px)' }}>

          {/* ── MONTHLY CARD ── neutral styling */}
          <div
            className="flex-1 rounded-xl ring-1 ring-white/20 flex flex-col items-center justify-between"
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              padding: 'clamp(10px, 1vw, 16px)',
              gap: 'clamp(6px, 0.6vw, 10px)',
            }}
          >
            <span
              className="text-white/60 font-medium"
              style={{ fontSize: 'clamp(0.7rem, 0.8vw, 0.85rem)' }}
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
                className="text-white/40"
                style={{ fontSize: 'clamp(0.625rem, 0.7vw, 0.75rem)' }}
              >
                per month
              </span>
            </div>

            <SubscribeButton
              plan="monthly"
              label="Start Free Trial"
              isLoading={isCheckingOut}
              onSubscribe={handleSubscribe}
            />
          </div>

          {/* ── ANNUAL CARD ── emerald accent, "Best Value" badge (Von Restorff) */}
          <div
            className="flex-1 rounded-xl ring-1 ring-emerald-500/50 flex flex-col items-center justify-between relative"
            style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(20, 184, 166, 0.05))',
              padding: 'clamp(10px, 1vw, 16px)',
              gap: 'clamp(6px, 0.6vw, 10px)',
            }}
          >
            {/* Best Value badge */}
            <span
              className="absolute rounded-full bg-emerald-500/20 text-emerald-400 font-semibold ring-1 ring-emerald-500/40"
              style={{
                top: 'clamp(-8px, -0.6vw, -6px)',
                right: 'clamp(8px, 1vw, 16px)',
                fontSize: 'clamp(0.55rem, 0.6vw, 0.65rem)',
                padding: 'clamp(1px, 0.15vw, 3px) clamp(6px, 0.6vw, 10px)',
              }}
            >
              ★ Best Value
            </span>

            <span
              className="text-emerald-400 font-medium"
              style={{ fontSize: 'clamp(0.7rem, 0.8vw, 0.85rem)' }}
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
                className="text-white/40 block"
                style={{ fontSize: 'clamp(0.575rem, 0.65vw, 0.7rem)' }}
              >
                per month, billed as £149.99/year
              </span>
              <span
                className="text-emerald-400 font-semibold block"
                style={{ fontSize: 'clamp(0.625rem, 0.7vw, 0.75rem)', marginTop: 'clamp(2px, 0.2vw, 4px)' }}
              >
                Save £42
              </span>
            </div>

            <SubscribeButton
              plan="annual"
              label="Start Free Trial"
              isLoading={isCheckingOut}
              onSubscribe={handleSubscribe}
            />
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

        {/* Subtext */}
        <span
          className="text-white/30 text-center"
          style={{ fontSize: 'clamp(0.575rem, 0.65vw, 0.7rem)' }}
        >
          7-day free trial on both plans · Cancel any time
        </span>
      </div>
    </div>
  );
}

export default UpgradeCta;
