// src/components/pro-promagen/upgrade-cta.tsx
// ============================================================================
// UPGRADE CTA
// ============================================================================
// Call-to-action button for upgrading or saving preferences.
// Free users: "Upgrade to Pro Promagen" → Stripe placeholder
// Paid users: "Save Preferences" → localStorage + Clerk sync
// Authority: docs/authority/paid_tier.md
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

  // Handle upgrade (free users)
  const handleUpgrade = useCallback(() => {
    // Placeholder: Navigate to Stripe checkout
    // TODO: Integrate Stripe checkout
    window.location.href = '/upgrade';
  }, []);

  // Handle save (paid users)
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

  // Free user CTA
  if (!isPaidUser) {
    return (
      <div className="rounded-2xl overflow-hidden ring-1 ring-amber-500/30 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10">
        <div className="p-4 text-center">
          <p className="text-xs text-white/50 mb-3">
            Preview mode — your selections won&apos;t be saved
          </p>
          <button
            type="button"
            onClick={handleUpgrade}
            className="w-full py-3 px-6 rounded-xl font-semibold text-white bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:via-orange-400 hover:to-amber-400 transition-all duration-300 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40"
          >
            <span className="flex items-center justify-center gap-2">
              <span>✨</span>
              <span>Upgrade to Pro Promagen</span>
            </span>
          </button>
          <p className="text-[10px] text-white/30 mt-2">
            Unlock customization, unlimited prompts, and more
          </p>
        </div>
      </div>
    );
  }

  // Paid user CTA
  return (
    <div className="rounded-2xl overflow-hidden ring-1 ring-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/10">
      <div className="p-4 text-center">
        <p className="text-xs text-white/50 mb-3">
          {hasChanges ? 'You have unsaved changes' : 'Your preferences are saved'}
        </p>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
          className={`
            w-full py-3 px-6 rounded-xl font-semibold text-white transition-all duration-300
            ${
              hasChanges
                ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 hover:from-emerald-400 hover:via-teal-400 hover:to-emerald-400 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40'
                : 'bg-white/10 cursor-not-allowed'
            }
            ${isSaving ? 'opacity-50 cursor-wait' : ''}
          `}
        >
          <span className="flex items-center justify-center gap-2">
            {isSaving ? (
              <>
                <span className="animate-spin">⏳</span>
                <span>Saving...</span>
              </>
            ) : saveStatus === 'success' ? (
              <>
                <span>✓</span>
                <span>Saved!</span>
              </>
            ) : saveStatus === 'error' ? (
              <>
                <span>✕</span>
                <span>Error — try again</span>
              </>
            ) : (
              <>
                <span>💾</span>
                <span>Save Preferences</span>
              </>
            )}
          </span>
        </button>
        <p className="text-[10px] text-white/30 mt-2">
          Changes apply to your homepage immediately
        </p>
      </div>
    </div>
  );
}

export default UpgradeCta;
