// src/components/pro-promagen/comparison-table.tsx
// ============================================================================
// COMPARISON TABLE (v2.4.0)
// ============================================================================
// Standard vs Pro Promagen comparison table.
//
// UPDATED v2.4.0 (29 Jan 2026):
// - CHANGED: FX picker now opens in fullscreen mode via parent callback
// - ADDED: FxPickerTrigger component (matches ExchangePickerTrigger pattern)
// - ADDED: onOpenFxPicker callback prop
// - REMOVED: ChipsDropdown usage for FX (replaced with trigger button)
// - REMOVED: ChipsDropdown component entirely (indices dropdown removed)
//
// UPDATED v2.3.0 (29 Jan 2026):
// - CHANGED: Exchange picker now opens in fullscreen mode via parent callback
// - REMOVED: Internal isExchangePickerOpen state
// - REMOVED: Inline picker rendering (parent handles fullscreen picker)
// - ADDED: onOpenExchangePicker callback prop
// - All other functionality preserved
//
// BUTTON STYLING: Uses canonical purple-pink gradient from code-standard.md §6.1
// - bg-gradient-to-r from-purple-600/20 to-pink-600/20
// - border-purple-500/70
// - text-purple-100
//
// Authority: docs/authority/paid_tier.md §5.10
// Authority: docs/authority/code-standard.md §6.1
// Authority: docs/authority/buttons.md
// ============================================================================

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  FEATURE_COMPARISON,
  WEATHER_PROMPT_TIER_OPTIONS,
  type FeatureRow,
} from '@/data/pro-promagen/presets';
import { PRO_SELECTION_LIMITS, type ExchangeCatalogEntry } from '@/lib/pro-promagen/types';
import type { PromptTier } from '@/lib/weather/weather-prompt-generator';

// ============================================================================
// TYPES
// ============================================================================

export interface SelectionItem {
  id: string;
  label: string;
  /** Optional secondary label (e.g., country names for FX pairs) */
  subLabel?: string;
  /** Optional status badge (e.g., "coming-soon" for indices) */
  status?: 'active' | 'coming-soon' | 'unavailable';
}

export interface ComparisonTableProps {
  /** FX pair options for dropdown */
  fxOptions: SelectionItem[];
  /** Exchange options for dropdown (legacy, kept for compatibility) */
  exchangeOptions: SelectionItem[];
  /** Full exchange catalog with iso2/continent data (for ExchangePicker) */
  exchangeCatalog?: ExchangeCatalogEntry[];
  /** Currently selected FX pair IDs */
  selectedFxPairs: string[];
  /** Currently selected exchange IDs */
  selectedExchanges: string[];
  /** Currently selected weather prompt tier */
  selectedPromptTier: PromptTier;
  /** Callback when FX selection changes */
  onFxChange: (ids: string[]) => void;
  /** Callback when exchange selection changes */
  onExchangeChange: (ids: string[]) => void;
  /** Callback when weather prompt tier changes */
  onPromptTierChange: (tier: PromptTier) => void;
  /** Whether user is paid tier (enables interaction) */
  isPaidUser: boolean;
  /** NEW v2.3.0: Callback to open fullscreen exchange picker (parent handles rendering) */
  onOpenExchangePicker?: () => void;
  /** NEW v2.4.0: Callback to open fullscreen FX picker (parent handles rendering) */
  onOpenFxPicker?: () => void;
}

// ============================================================================
// TOOLTIP COMPONENT
// ============================================================================

interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

function Tooltip({ content, children }: TooltipProps) {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleMouseEnter = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top - 8,
        left: rect.left + rect.width / 2,
      });
    }
    setShow(true);
  };

  const tooltipPortal =
    show && mounted
      ? createPortal(
          <div
            className="fixed z-[10000] px-3 py-2 text-xs text-white bg-slate-800 rounded-lg shadow-xl border border-white/10 max-w-[280px] transform -translate-x-1/2 -translate-y-full animate-in fade-in-0 zoom-in-95 duration-150"
            style={{ top: position.top, left: position.left }}
          >
            {content}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
          </div>,
          document.body,
        )
      : null;

  return (
    <span
      ref={triggerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShow(false)}
      className="cursor-help"
    >
      {children}
      {tooltipPortal}
    </span>
  );
}

// ============================================================================
// INFO ICON WITH TOOLTIP
// ============================================================================

interface InfoTooltipProps {
  content: string;
}

function InfoTooltip({ content }: InfoTooltipProps) {
  return (
    <Tooltip content={content}>
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 hover:bg-sky-500/30 hover:text-sky-300 transition-colors ml-2 cursor-help">
        <svg
          className="w-3 h-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </span>
    </Tooltip>
  );
}

// ============================================================================
// EXCHANGE PICKER TRIGGER BUTTON
// ============================================================================
// Uses the canonical purple-pink gradient from code-standard.md §6.1
// Deviation: Slightly larger padding for better touch target
// ============================================================================

interface ExchangePickerTriggerProps {
  selectedCount: number;
  maxCount: number;
  onClick: () => void;
  disabled?: boolean;
}

function ExchangePickerTrigger({
  selectedCount,
  maxCount,
  onClick,
  disabled = false,
}: ExchangePickerTriggerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center gap-2 rounded-full
        border px-4 py-2 text-sm font-medium shadow-sm
        transition-all duration-200
        focus-visible:outline-none focus-visible:ring focus-visible:ring-purple-400/80
        ${
          disabled
            ? 'border-slate-700 bg-slate-800/50 text-slate-500 cursor-not-allowed'
            : 'border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-purple-100 hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400 cursor-pointer'
        }
      `}
      aria-label={`Select stock exchanges. Currently ${selectedCount} of ${maxCount} selected.`}
    >
      {/* Globe icon */}
      <svg
        className="w-4 h-4 text-purple-100"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
        />
      </svg>

      {/* Label */}
      <span className="text-purple-100">Select Stock Exchanges</span>

      {/* Count badge */}
      <span className="ml-1 px-2 py-0.5 text-xs font-mono rounded-full bg-purple-500/30 text-purple-200">
        {selectedCount}/{maxCount}
      </span>
    </button>
  );
}

// ============================================================================
// FX PICKER TRIGGER BUTTON (v2.4.0)
// ============================================================================
// Uses sky-emerald gradient to distinguish from exchange picker
// Deviation: Slightly larger padding for better touch target
// ============================================================================

interface FxPickerTriggerProps {
  selectedCount: number;
  maxCount: number;
  onClick: () => void;
  disabled?: boolean;
}

function FxPickerTrigger({
  selectedCount,
  maxCount,
  onClick,
  disabled = false,
}: FxPickerTriggerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center gap-2 rounded-full
        border px-4 py-2 text-sm font-medium shadow-sm
        transition-all duration-200
        focus-visible:outline-none focus-visible:ring focus-visible:ring-purple-400/80
        ${
          disabled
            ? 'border-slate-700 bg-slate-800/50 text-slate-500 cursor-not-allowed'
            : 'border-sky-500/70 bg-gradient-to-r from-sky-600/20 to-emerald-600/20 text-sky-100 hover:from-sky-600/30 hover:to-emerald-600/30 hover:border-sky-400 cursor-pointer'
        }
      `}
      aria-label={`Select FX pairs. Currently ${selectedCount} of ${maxCount} selected.`}
    >
      {/* Currency exchange icon */}
      <svg
        className="w-4 h-4 text-sky-100"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>

      {/* Label */}
      <span className="text-sky-100">Select FX Pairs</span>

      {/* Count badge */}
      <span className="ml-1 px-2 py-0.5 text-xs font-mono rounded-full bg-sky-500/30 text-sky-200">
        {selectedCount}/{maxCount}
      </span>
    </button>
  );
}

// ============================================================================
// WEATHER PROMPT TIER DROPDOWN (Single Select)
// ============================================================================

interface TierDropdownProps {
  selectedTier: PromptTier;
  onChange: (tier: PromptTier) => void;
  disabled?: boolean;
}

function TierDropdown({ selectedTier, onChange, disabled = false }: TierDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 280 });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate dropdown position
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        left: rect.left,
        width: Math.max(rect.width, 280),
      });
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const selectedOption = WEATHER_PROMPT_TIER_OPTIONS.find((o) => o.tier === selectedTier);

  const dropdownPanel =
    isOpen && mounted
      ? createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[9999] rounded-xl bg-slate-900/98 ring-1 ring-white/10 shadow-2xl backdrop-blur-sm overflow-hidden"
            style={{
              top: position.top,
              left: position.left,
              width: position.width,
            }}
          >
            <div className="p-2">
              {WEATHER_PROMPT_TIER_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    onChange(option.tier);
                    setIsOpen(false);
                  }}
                  className={`
                  w-full flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-lg
                  text-left transition-colors
                  ${
                    option.tier === selectedTier
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'text-slate-200 hover:bg-white/5'
                  }
                `}
                >
                  <span className="text-sm font-medium">{option.label}</span>
                  <span className="text-xs text-slate-400">{option.subLabel}</span>
                  <span className="text-[10px] text-slate-500">{option.platforms}</span>
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          flex items-center justify-between gap-2 w-full min-w-[160px]
          px-3 py-2 rounded-lg text-sm font-medium
          transition-all duration-200
          ${
            disabled
              ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed'
              : isOpen
                ? 'bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 text-white shadow-lg'
                : 'bg-slate-800/80 text-slate-200 hover:bg-slate-700/80 ring-1 ring-white/10'
          }
        `}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="truncate">
          {selectedOption ? `Tier ${selectedOption.tier}` : 'Select tier'}
        </span>
        <svg
          className={`w-4 h-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {dropdownPanel}
    </div>
  );
}

// ============================================================================
// COMPARISON TABLE COMPONENT
// ============================================================================

export function ComparisonTable({
  fxOptions: _fxOptions, // Keep for type compat - now using fullscreen picker
  exchangeOptions: _exchangeOptions, // Keep for type compat
  exchangeCatalog: _exchangeCatalog, // Keep for type compat
  selectedFxPairs,
  selectedExchanges,
  selectedPromptTier,
  onFxChange: _onFxChange, // Handled by parent via fullscreen picker
  onExchangeChange: _onExchangeChange, // Handled by parent via fullscreen picker
  onPromptTierChange,
  isPaidUser,
  onOpenExchangePicker,
  onOpenFxPicker,
}: ComparisonTableProps) {
  // Render the Pro column value - either static text or dropdown
  const renderProValue = (row: FeatureRow) => {
    if (row.hasDropdown === 'fx') {
      // v2.4.0: Trigger opens fullscreen picker via parent callback
      return (
        <FxPickerTrigger
          selectedCount={selectedFxPairs.length}
          maxCount={PRO_SELECTION_LIMITS.FX_MAX}
          onClick={() => onOpenFxPicker?.()}
          disabled={false}
        />
      );
    }

    if (row.hasDropdown === 'exchange') {
      // v2.3.0: Trigger opens fullscreen picker via parent callback
      return (
        <ExchangePickerTrigger
          selectedCount={selectedExchanges.length}
          maxCount={PRO_SELECTION_LIMITS.EXCHANGE_MAX}
          onClick={() => onOpenExchangePicker?.()}
          disabled={false}
        />
      );
    }

    if (row.hasDropdown === 'weather-prompt-tier') {
      return (
        <TierDropdown
          selectedTier={selectedPromptTier}
          onChange={onPromptTierChange}
          disabled={false}
        />
      );
    }

    // Static value
    return (
      <span
        className={`text-sm font-medium ${row.highlight ? 'text-emerald-400' : 'text-white/60'}`}
      >
        {row.pro}
      </span>
    );
  };

  return (
    <div className="rounded-2xl overflow-hidden ring-1 ring-white/10 bg-slate-900/50">
      {/* Header */}
      <div className="bg-gradient-to-r from-sky-600/20 via-emerald-600/20 to-violet-600/20 px-4 py-3 border-b border-white/10">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-gradient-to-r from-sky-400 to-emerald-400" />
          Standard vs Pro Promagen
        </h3>
      </div>

      {/* Table - Always visible (v2.3.0: no conditional rendering) */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-4 py-2.5 text-left text-sm font-medium text-white/50">Feature</th>
              <th className="px-4 py-2.5 text-center text-sm font-medium text-white/50">
                Standard
              </th>
              <th className="px-4 py-2.5 text-center text-sm font-medium text-white/50">
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-amber-400">★</span>
                  Pro Promagen
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {FEATURE_COMPARISON.map((row) => (
              <tr
                key={row.feature}
                className={`
                  border-b border-white/5 transition-colors
                  ${
                    row.highlight
                      ? 'bg-gradient-to-r from-sky-500/5 via-transparent to-emerald-500/5'
                      : ''
                  }
                  hover:bg-white/5
                `}
              >
                <td className="px-4 py-3 text-sm font-medium text-white/80">
                  <span className="flex items-center">
                    {row.feature}
                    {row.tooltip && <InfoTooltip content={row.tooltip} />}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-sm font-medium text-white/40">
                  {row.standard}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center">{renderProValue(row)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Preview mode hint for free users */}
      {!isPaidUser && (
        <div className="px-4 py-2.5 border-t border-white/5 bg-amber-500/5">
          <p className="text-xs font-medium text-amber-400/70 text-center">
            ★ Try it out! Upgrade to Pro Promagen to save your selections
          </p>
        </div>
      )}
    </div>
  );
}

export default ComparisonTable;
