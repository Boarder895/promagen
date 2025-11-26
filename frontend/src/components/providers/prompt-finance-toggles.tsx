// frontend/src/components/providers/prompt-finance-toggles.tsx
'use client';

import React from 'react';
import type { FinanceWidgetPrefs } from '@/lib/ribbon/micro-widget-prefs';
import { trackFinanceToggle } from '@/lib/analytics/finance';

export type PromptFinanceTogglesProps = {
  prefs: FinanceWidgetPrefs;
  onChange: (next: FinanceWidgetPrefs) => void;
  isPaid: boolean;
};

type ToggleKey = keyof FinanceWidgetPrefs;

type ToggleButtonProps = {
  label: string;
  active: boolean;
  onClick: () => void;
};

function ToggleButton({ label, active, onClick }: ToggleButtonProps): JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={
        active
          ? 'inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white'
          : 'inline-flex items-center rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-white'
      }
    >
      {label}
    </button>
  );
}

export default function PromptFinanceToggles({
  prefs,
  onChange,
  isPaid,
}: PromptFinanceTogglesProps): JSX.Element | null {
  if (!isPaid) {
    // On the free tier we hide the entire strip.
    return null;
  }

  const handleToggle = (key: ToggleKey): void => {
    const next: FinanceWidgetPrefs = { ...prefs, [key]: !prefs[key] };
    onChange(next);

    const assetClass = key as 'fx' | 'commodities' | 'crypto';
    const state = next[key] ? 'on' : 'off';

    trackFinanceToggle({
      assetClass,
      state,
    });
  };

  return (
    <section aria-label="Financial widgets">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-600">
          Finance widgets
          <span className="ml-1 text-[11px] text-slate-500">(paid tier)</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <ToggleButton label="FX" active={prefs.fx} onClick={() => handleToggle('fx')} />
          <ToggleButton
            label="Commodities"
            active={prefs.commodities}
            onClick={() => handleToggle('commodities')}
          />
          <ToggleButton
            label="Crypto"
            active={prefs.crypto}
            onClick={() => handleToggle('crypto')}
          />
        </div>
      </div>
    </section>
  );
}
