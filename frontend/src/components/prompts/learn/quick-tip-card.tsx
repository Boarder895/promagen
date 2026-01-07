// src/components/prompts/learn/quick-tip-card.tsx
// ============================================================================
// QUICK TIP CARD
// ============================================================================
// Small card for displaying quick tips.
// Authority: docs/authority/prompt-intelligence.md §9.3
// ============================================================================

'use client';

import React from 'react';
import type { QuickTip } from '@/types/learn-content';

// ============================================================================
// TYPES
// ============================================================================

export interface QuickTipCardProps {
  tip: QuickTip;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function QuickTipCard({ tip }: QuickTipCardProps) {
  return (
    <div className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-colors">
      <div className="flex items-start gap-2">
        <span className="shrink-0 w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
          </svg>
        </span>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-white mb-1">{tip.title}</h4>
          <p className="text-xs text-white/50 leading-relaxed">{tip.content}</p>
        </div>
      </div>
    </div>
  );
}

export default QuickTipCard;
