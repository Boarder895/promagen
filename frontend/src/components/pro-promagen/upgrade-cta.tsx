// src/components/pro-promagen/upgrade-cta.tsx
// ============================================================================
// UPGRADE CTA / PAYMENT PANEL v2.0.0
// ============================================================================
// Proper payment placeholder panel with real height.
// Free users: Upgrade panel with Stripe placeholder area.
// Paid users: Save panel with status feedback.
//
// This panel shares space with TierPreviewPanel — both must match height
// so the hover swap doesn't cause layout shift.
//
// Authority: docs/authority/paid_tier.md
// Existing features preserved: Yes
// ============================================================================

'use client';

import React, { useState, useCallback } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface UpgradeCtaProps {
  isPaidUser: boolean;
  onSave?: () => Promise<void>;
  hasChanges?: boolean;
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

  const handleUpgrade = useCallback(() => {
    window.location.href = '/upgrade';
  }, []);

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

  // Free user — payment placeholder panel
  if (!isPaidUser) {
    return (
      <div
        className="rounded-2xl overflow-hidden ring-1 ring-amber-500/30"
        style={{
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(249, 115, 22, 0.06), rgba(245, 158, 11, 0.04))',
          minHeight: 'clamp(140px, 14vw, 200px)',
          padding: 'clamp(16px, 1.5vw, 24px)',
        }}
      >
        <div className="flex flex-col items-center justify-center h-full" style={{ gap: 'clamp(10px, 1vw, 16px)' }}>
          {/* Stripe placeholder area */}
          <div
            className="w-full rounded-xl ring-1 ring-white/10 flex items-center justify-center"
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              minHeight: 'clamp(48px, 4.5vw, 64px)',
              padding: 'clamp(8px, 0.8vw, 12px)',
            }}
          >
            <span
              className="text-white/30"
              style={{ fontSize: 'clamp(0.7rem, 0.85vw, 0.85rem)' }}
            >
              Payment integration coming soon
            </span>
          </div>

          {/* Upgrade button */}
          <button
            type="button"
            onClick={handleUpgrade}
            className="w-full rounded-xl font-semibold text-white cursor-pointer bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:via-orange-400 hover:to-amber-400 transition-all duration-300 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40"
            style={{
              padding: 'clamp(10px, 1vw, 14px) clamp(16px, 1.5vw, 24px)',
              fontSize: 'clamp(0.8rem, 0.95vw, 1rem)',
            }}
          >
            <span className="flex items-center justify-center" style={{ gap: 'clamp(6px, 0.5vw, 8px)' }}>
              <span>✨</span>
              <span>Upgrade to Pro Promagen</span>
            </span>
          </button>

          {/* Subtext */}
          <span
            className="text-white/30 text-center"
            style={{ fontSize: 'clamp(0.625rem, 0.75vw, 0.75rem)' }}
          >
            Preview mode — your selections won&apos;t be saved
          </span>
        </div>
      </div>
    );
  }

  // Paid user — save panel
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

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
          className={`w-full rounded-xl font-semibold text-white transition-all duration-300 ${
            hasChanges
              ? 'cursor-pointer bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 hover:from-emerald-400 hover:via-teal-400 hover:to-emerald-400 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40'
              : 'bg-white/10 cursor-default'
          } ${isSaving ? 'cursor-wait' : ''}`}
          style={{
            padding: 'clamp(10px, 1vw, 14px) clamp(16px, 1.5vw, 24px)',
            fontSize: 'clamp(0.8rem, 0.95vw, 1rem)',
          }}
        >
          <span className="flex items-center justify-center" style={{ gap: 'clamp(6px, 0.5vw, 8px)' }}>
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

export default UpgradeCta;
