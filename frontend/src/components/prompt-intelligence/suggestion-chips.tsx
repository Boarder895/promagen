// src/components/prompt-intelligence/suggestion-chips.tsx
// ============================================================================
// SUGGESTION CHIPS COMPONENT
// ============================================================================
// Displays context-aware suggestion chips with educational "Why this?" tooltips.
// ============================================================================

'use client';

import { useMemo } from 'react';
import { Plus, Sparkles, TrendingUp, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SuggestedOption } from '@/lib/prompt-intelligence/types';
import type { PromptCategory } from '@/types/prompt-builder';
import Button from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';

// ============================================================================
// Types
// ============================================================================

export interface SuggestionChipsProps {
  /** Suggestions to display */
  suggestions: SuggestedOption[];
  
  /** Category to filter by (optional) */
  category?: PromptCategory;
  
  /** Callback when a suggestion is clicked */
  onSelect?: (suggestion: SuggestedOption) => void;
  
  /** Custom class name */
  className?: string;
  
  /** Maximum chips to show */
  maxChips?: number;
  
  /** Whether to show category labels */
  showCategory?: boolean;
  
  /** Whether to show score indicator */
  showScore?: boolean;
  
  /** Whether suggestions are from market mood */
  isMarketMood?: boolean;
  
  /** Size variant */
  size?: 'sm' | 'md';
  
  /** Whether to show "Why this?" help icon */
  showWhyThis?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getScoreIndicator(score: number): string {
  if (score >= 80) return '●●●';
  if (score >= 65) return '●●○';
  return '●○○';
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 65) return 'text-sky-400';
  return 'text-muted-foreground';
}

/**
 * Build educational "Why this?" tooltip text explaining the suggestion.
 */
function buildWhyThisTooltip(suggestion: SuggestedOption, showCategory: boolean): string {
  const lines: string[] = [];
  
  // Main reason (already educational from suggestion-engine)
  lines.push(`💡 ${suggestion.reason}`);
  
  // Add category context if requested
  if (showCategory) {
    const categoryLabels: Record<string, string> = {
      style: 'artistic style',
      lighting: 'light and shadow',
      colour: 'color palette',
      atmosphere: 'mood and feeling',
      environment: 'setting and background',
      action: 'movement and pose',
      composition: 'framing and layout',
      camera: 'camera angle and lens',
      materials: 'textures and surfaces',
      fidelity: 'detail and quality',
    };
    const label = categoryLabels[suggestion.category] ?? suggestion.category;
    lines.push(`📁 Adds to: ${label}`);
  }
  
  // Add relevance context
  const scoreLabel = suggestion.score >= 80 ? 'Highly relevant' :
                     suggestion.score >= 65 ? 'Good match' : 'Worth trying';
  lines.push(`✨ ${scoreLabel} (${suggestion.score}%)`);
  
  return lines.join('\n');
}

// ============================================================================
// Component
// ============================================================================

export function SuggestionChips({
  suggestions,
  category,
  onSelect,
  className,
  maxChips = 5,
  showCategory = false,
  showScore = true,
  isMarketMood = false,
  size = 'sm',
  showWhyThis = true,
}: SuggestionChipsProps) {
  // Filter and limit suggestions
  const displaySuggestions = useMemo(() => {
    let filtered = suggestions;
    
    if (category) {
      filtered = suggestions.filter(s => s.category === category);
    }
    
    return filtered.slice(0, maxChips);
  }, [suggestions, category, maxChips]);
  
  if (displaySuggestions.length === 0) {
    return null;
  }
  
  const Icon = isMarketMood ? TrendingUp : Sparkles;
  
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {/* Label with optional Why this? tooltip */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Icon className="h-3 w-3" />
        <span>{isMarketMood ? 'Market' : 'Suggested'}:</span>
        {showWhyThis && (
          <Tooltip text="These suggestions complement your current selections and match your prompt's style">
            <HelpCircle className="h-3 w-3 cursor-help opacity-50 hover:opacity-100 transition-opacity" />
          </Tooltip>
        )}
      </div>
      
      {/* Chips */}
      {displaySuggestions.map((suggestion) => (
        <Tooltip 
          key={`${suggestion.category}-${suggestion.option}`}
          text={buildWhyThisTooltip(suggestion, showCategory)}
        >
          <Button
            variant="outline"
            size={size === 'sm' ? 'sm' : 'default'}
            className={cn(
              'h-auto gap-1 px-2 py-1 transition-all',
              size === 'sm' && 'text-xs',
              isMarketMood && 'border-amber-500/30 hover:border-amber-500/50',
              suggestion.score >= 80 && 'border-emerald-500/30 hover:border-emerald-500/50',
              suggestion.score >= 65 && suggestion.score < 80 && 'border-sky-500/30 hover:border-sky-500/50'
            )}
            onClick={() => onSelect?.(suggestion)}
          >
            <Plus className={cn('opacity-50', size === 'sm' ? 'h-3 w-3' : 'h-4 w-4')} />
            <span>{suggestion.option}</span>
            {showScore && (
              <span className={cn('ml-0.5 opacity-70', getScoreColor(suggestion.score))}>
                {getScoreIndicator(suggestion.score)}
              </span>
            )}
          </Button>
        </Tooltip>
      ))}
    </div>
  );
}

export default SuggestionChips;
